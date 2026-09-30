import { describe, expect, it } from 'vitest';
import type { Discount, Offer } from '../data/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOfferPrice, computeOfferPriceUpdates } from '../offer-price';
import { recomputeOfferPrices } from '../offer-price-admin';
import { calculatePriceBreakdown } from '../pricing';

const activeOffer: Pick<Offer, 'is_active' | 'start_date' | 'end_date'> = {
  is_active: true,
  start_date: null,
  end_date: null,
};

function discount(discount_type: Discount['discount_type'], value: number): Discount {
  return { id: 'discount', offer_id: 'offer', discount_type, value };
}

function adminBreakdown(
  product: {
    price: number;
    price_auto_calculated?: boolean;
    material_type?: string | null;
    purity_carats?: number | null;
    weight_grams?: number | null;
    making_charge_type?: string | null;
    making_charge_percent?: number | null;
    making_charge_flat?: number | null;
    gold_price_used?: number | null;
    gst_percent?: number | null;
  },
  price = product.price,
  makingChargeType = product.making_charge_type,
  makingChargePercent = product.making_charge_percent,
  makingChargeFlat = product.making_charge_flat,
) {
  return calculatePriceBreakdown({
    price,
    priceAutoCalculated: product.price_auto_calculated,
    materialType: product.material_type,
    purityCarats: product.purity_carats,
    weightGrams: product.weight_grams,
    makingChargeType,
    makingChargePercent,
    makingChargeFlat,
    goldPriceUsed: product.gold_price_used,
    gstPercent: product.gst_percent,
  });
}

describe('computeOfferPrice', () => {
  it('applies percentage discounts with the display rounding', () => {
    expect(computeOfferPrice({ price: 1001 }, activeOffer, discount('percentage', 10), {})).toEqual({
      offerPrice: 901,
      discountAmount: 100,
      discountType: 'percentage',
    });
  });

  it('applies flat discounts to the GST-inclusive product price', () => {
    expect(computeOfferPrice({ price: 12000 }, activeOffer, discount('flat', 5000), {})).toEqual({
      offerPrice: 7000,
      discountAmount: 5000,
      discountType: 'flat',
    });
  });

  it('recomputes making charge with metal value and GST using admin rounding', () => {
    const product = {
      price: 2000,
      price_auto_calculated: true,
      material_type: 'gold',
      purity_carats: 24,
      weight_grams: 1,
      making_charge_type: 'percent',
      making_charge_percent: 10,
      gold_price_used: 1000,
      gst_percent: 5,
    };
    const result = computeOfferPrice(product, activeOffer, discount('making_charge', 10), { metalPricePerGram: 1000 });
    const before = adminBreakdown(product);
    const after = adminBreakdown(product, result.offerPrice!, 'percent', 10, null);
    expect(result.offerPrice).toBe(1155);
    expect(result.discountType).toBe('making_charge');
    expect(result.discountAmount).toBe(before.makingCharge - after.makingCharge);
  });

  it('rounds the GST-inclusive making-charge price exactly as the admin display', () => {
    const product = {
      price: 2000,
      price_auto_calculated: true,
      material_type: 'gold',
      purity_carats: 22,
      weight_grams: 1,
      making_charge_type: 'percent',
      gold_price_used: 1000.4,
      gst_percent: 5,
    };
    const result = computeOfferPrice(product, activeOffer, discount('making_charge', 10), {});
    const before = adminBreakdown(product);
    const after = adminBreakdown(product, result.offerPrice!, 'percent', 10, null);
    expect(result.offerPrice).toBe(1063);
    expect(result.discountAmount).toBe(before.makingCharge - after.makingCharge);
  });

  it('computes the displayed making-charge reduction when the product charge is flat', () => {
    const product = {
      price: 1365,
      price_auto_calculated: true,
      material_type: 'gold',
      making_charge_type: 'flat',
      making_charge_flat: 300,
      gst_percent: 5,
    };
    const result = computeOfferPrice(product, activeOffer, discount('making_charge', 10), {});
    const before = adminBreakdown(product);
    const after = adminBreakdown(product, result.offerPrice!, 'percent', 10, null);

    expect(result.offerPrice).toBe(1155);
    expect(result.discountAmount).toBe(before.makingCharge - after.makingCharge);
    expect(result.discountType).toBe('making_charge');
  });

  it('uses the first discount when an offer has multiple discounts', () => {
    expect(computeOfferPrice(
      { price: 1000 },
      activeOffer,
      [discount('percentage', 10), discount('flat', 500)],
      {},
    )).toEqual({ offerPrice: 900, discountAmount: 100, discountType: 'mixed' });
  });

  it('returns null when there is no offer or no discount', () => {
    const noPrice = { offerPrice: null, discountAmount: null, discountType: null };
    expect(computeOfferPrice({ price: 1000 }, null, discount('percentage', 10), {})).toEqual(noPrice);
    expect(computeOfferPrice({ price: 1000 }, activeOffer, null, {})).toEqual(noPrice);
  });

  it('returns null for inactive and expired offers', () => {
    const noPrice = { offerPrice: null, discountAmount: null, discountType: null };
    expect(computeOfferPrice(
      { price: 1000 },
      { ...activeOffer, is_active: false },
      discount('percentage', 10),
      {},
    )).toEqual(noPrice);
    expect(computeOfferPrice(
      { price: 1000 },
      { ...activeOffer, end_date: '2000-01-01' },
      discount('percentage', 10),
      {},
    )).toEqual(noPrice);
    expect(computeOfferPrice(
      { price: 1000 },
      { ...activeOffer, start_date: '2999-01-01' },
      discount('percentage', 10),
      {},
    )).toEqual(noPrice);
  });

  it('recomputes every product linked to an offer after its discount changes', () => {
    const updates = computeOfferPriceUpdates(
      [{ id: 'product-1', price: 1000 }, { id: 'product-2', price: 2000 }],
      activeOffer,
      discount('percentage', 20),
    );
    expect(updates).toEqual([
      { id: 'product-1', offer_price: 800, offer_discount_amount: 200, offer_discount_type: 'percentage' },
      { id: 'product-2', offer_price: 1600, offer_discount_amount: 400, offer_discount_type: 'percentage' },
    ]);
  });

  it('clears offer_price when an offer is removed', () => {
    expect(computeOfferPriceUpdates(
      [{ id: 'product-1', price: 1000 }],
      null,
      null,
    )).toEqual([{
      id: 'product-1',
      offer_price: null,
      offer_discount_amount: null,
      offer_discount_type: null,
    }]);
  });

  it('recomputes all linked products after the offer discount changes', async () => {
    const updatedRows: Array<{ id: string; offer_id: string; offer_price: number | null; offer_discount_amount: number | null; offer_discount_type: string | null }> = [];
    const products = [
      { id: 'product-1', price: 1000 },
      { id: 'product-2', price: 2000 },
    ];
    const client = {
      rpc: async (_name: string, args: { p_items: typeof updatedRows }) => {
        updatedRows.push(...args.p_items);
        return { data: args.p_items.length, error: null };
      },
      from(table: string) {
        if (table === 'offers') {
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => ({
              data: { ...activeOffer, discounts: [discount('percentage', 25)] },
              error: null,
            }),
          };
          return query;
        }
        let offset = 0;
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          range: async (start: number) => {
            offset = start;
            return { data: offset === 0 ? products : [], error: null };
          },
          update: (values: { offer_price: number | null }) => ({
            eq: async (_column: string, id: string) => {
              updatedRows.push({ id, offer_price: values.offer_price });
              return { error: null };
            },
          }),
        };
        return query;
      },
    };

    const result = await recomputeOfferPrices(client as unknown as SupabaseClient, 'offer');
    expect(result).toEqual({ updated: 2, error: null });
    expect(updatedRows).toEqual([
      { id: 'product-1', offer_id: 'offer', offer_price: 750, offer_discount_amount: 250, offer_discount_type: 'percentage' },
      { id: 'product-2', offer_id: 'offer', offer_price: 1500, offer_discount_amount: 500, offer_discount_type: 'percentage' },
    ]);
  });
});
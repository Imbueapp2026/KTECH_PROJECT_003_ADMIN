import { describe, expect, it } from 'vitest';
import type { Discount, Offer } from '../data/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOfferPrice, computeOfferPriceUpdates } from '../offer-price';
import { recomputeOfferPrices } from '../offer-price-admin';

const activeOffer: Pick<Offer, 'is_active' | 'start_date' | 'end_date'> = {
  is_active: true,
  start_date: null,
  end_date: null,
};

function discount(discount_type: Discount['discount_type'], value: number): Discount {
  return { id: 'discount', offer_id: 'offer', discount_type, value };
}

describe('computeOfferPrice', () => {
  it('applies percentage discounts with the display rounding', () => {
    expect(computeOfferPrice({ price: 1001 }, activeOffer, discount('percentage', 10), {})).toBe(901);
  });

  it('applies flat discounts to the GST-inclusive product price', () => {
    expect(computeOfferPrice({ price: 12000 }, activeOffer, discount('flat', 5000), {})).toBe(7000);
  });

  it('recomputes making charge with metal value and GST using admin rounding', () => {
    const price = computeOfferPrice({
      price: 2000,
      price_auto_calculated: true,
      material_type: 'gold',
      purity_carats: 24,
      weight_grams: 1,
      making_charge_type: 'percent',
      making_charge_percent: 10,
      gold_price_used: 1000,
      gst_percent: 5,
    }, activeOffer, discount('making_charge', 10), { metalPricePerGram: 1000 });
    expect(price).toBe(1155);
  });

  it('rounds the GST-inclusive making-charge price exactly as the admin display', () => {
    expect(computeOfferPrice({
      price: 2000,
      price_auto_calculated: true,
      material_type: 'gold',
      purity_carats: 22,
      weight_grams: 1,
      making_charge_type: 'percent',
      gold_price_used: 1000.4,
      gst_percent: 5,
    }, activeOffer, discount('making_charge', 10), {})).toBe(1063);
  });

  it('uses the first discount when an offer has multiple discounts', () => {
    expect(computeOfferPrice(
      { price: 1000 },
      activeOffer,
      [discount('percentage', 10), discount('flat', 500)],
      {},
    )).toBe(900);
  });

  it('returns null when there is no offer or no discount', () => {
    expect(computeOfferPrice({ price: 1000 }, null, discount('percentage', 10), {})).toBeNull();
    expect(computeOfferPrice({ price: 1000 }, activeOffer, null, {})).toBeNull();
  });

  it('returns null for inactive and expired offers', () => {
    expect(computeOfferPrice(
      { price: 1000 },
      { ...activeOffer, is_active: false },
      discount('percentage', 10),
      {},
    )).toBeNull();
    expect(computeOfferPrice(
      { price: 1000 },
      { ...activeOffer, end_date: '2000-01-01' },
      discount('percentage', 10),
      {},
    )).toBeNull();
  });

  it('recomputes every product linked to an offer after its discount changes', () => {
    const updates = computeOfferPriceUpdates(
      [{ id: 'product-1', price: 1000 }, { id: 'product-2', price: 2000 }],
      activeOffer,
      discount('percentage', 20),
    );
    expect(updates).toEqual([
      { id: 'product-1', offer_price: 800 },
      { id: 'product-2', offer_price: 1600 },
    ]);
  });

  it('clears offer_price when an offer is removed', () => {
    expect(computeOfferPriceUpdates(
      [{ id: 'product-1', price: 1000 }],
      null,
      null,
    )).toEqual([{ id: 'product-1', offer_price: null }]);
  });

  it('recomputes all linked products after the offer discount changes', async () => {
    const updatedRows: Array<{ id: string; offer_price: number | null }> = [];
    const products = [
      { id: 'product-1', price: 1000 },
      { id: 'product-2', price: 2000 },
    ];
    const client = {
      rpc: async (_name: string, args: { p_items: Array<{ id: string; offer_price: number | null }> }) => {
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
      { id: 'product-1', offer_price: 750 },
      { id: 'product-2', offer_price: 1500 },
    ]);
  });
});
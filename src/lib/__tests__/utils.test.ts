import { describe, it, expect } from 'vitest';
import { formatPrice, resolveDiscounted } from '../utils';
import type { Offer, Discount } from '@/lib/data/types';

describe('Admin Utils', () => {
  describe('formatPrice', () => {
    it('formats price in Indian Rupee currency format without decimals', () => {
      const formatted = formatPrice(125000);
      // Indian numbering format: ₹1,25,000
      expect(formatted).toMatch(/₹\s?1,25,000/);
    });

    it('formats 0 properly', () => {
      const formatted = formatPrice(0);
      expect(formatted).toMatch(/₹\s?0/);
    });
  });

  describe('resolveDiscounted', () => {
    it('returns null if offer is null', () => {
      expect(resolveDiscounted(10000, null)).toBeNull();
    });

    it('returns null if offer is not active', () => {
      const inactiveOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Festival Sale',
        description: null,
        is_active: false,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'percentage',
          value: 10,
        },
      };
      expect(resolveDiscounted(10000, inactiveOffer)).toBeNull();
    });

    it('calculates percentage discount accurately', () => {
      const percentageOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Diwali Special',
        description: null,
        is_active: true,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'percentage',
          value: 20,
        },
      };
      expect(resolveDiscounted(50000, percentageOffer)).toBe(40000);
    });

    it('calculates flat discount accurately and clamps at 0', () => {
      const flatOffer: Offer & { discount: Discount[] } = {
        id: '1',
        label: 'Flat Off',
        description: null,
        is_active: true,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        created_at: '2026-01-01',
        discount: [
          {
            id: 'd1',
            offer_id: '1',
            discount_type: 'flat',
            value: 5000,
          },
        ],
      };
      expect(resolveDiscounted(12000, flatOffer)).toBe(7000);
      expect(resolveDiscounted(3000, flatOffer)).toBe(0);
    });

    it('rounds decimal prices to nearest integer (e.g. 1111.67 -> 1112)', () => {
      const percentageOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Odd Sale',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'percentage',
          value: 33.33,
        },
      };
      // 1000 * (1 - 0.3333) = 666.7 => rounds to 667
      expect(resolveDiscounted(1000, percentageOffer)).toBe(667);
      expect(formatPrice(1111.67)).toMatch(/₹\s?1,112/);
      expect(formatPrice(1111.20)).toMatch(/₹\s?1,111/);
    });

    it('calculates making charge discount accurately and ensures price decreases', () => {
      const mcOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Festive MC',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'making_charge',
          value: 8, // promotional 8% making charge
        },
      };

      // 10g 22K gold, gold price 7000, base MC 14%
      // metalValue = 7000 * 10 * 0.92 = 64,400
      // original MC 14% = 9,016 => base = 73,416 => GST 5% = 3,670.80 => original = 77,087
      const originalPrice = 77087;
      const product = {
        price_auto_calculated: true,
        material_type: 'gold' as const,
        purity_carats: 22,
        weight_grams: 10,
        making_charge_type: 'percent' as const,
        making_charge_percent: 14,
        making_charge_flat: null,
        gold_price_used: 7000,
        gst_percent: 5,
      };

      const discounted = resolveDiscounted(originalPrice, mcOffer, product);
      // new MC 8% = 5,152 => base = 69,552 => GST 5% = 3,477.60 => new = 73,030
      expect(discounted).toBe(73030);
      expect(discounted).toBeLessThan(originalPrice);
    });

    it('NEVER increases price when promotional MC is higher than product original MC', () => {
      const mcOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Promotional MC',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'making_charge',
          value: 12, // offer is 12%
        },
      };

      // Product originally has 8% MC (which is already lower than offer)
      const originalPrice = 73030;
      const product = {
        price_auto_calculated: true,
        material_type: 'gold' as const,
        purity_carats: 22,
        weight_grams: 10,
        making_charge_type: 'percent' as const,
        making_charge_percent: 8,
        making_charge_flat: null,
        gold_price_used: 7000,
        gst_percent: 5,
      };

      // Should return null (never increase from 73,030 to 75,734)
      expect(resolveDiscounted(originalPrice, mcOffer, product)).toBeNull();
    });

    it('NEVER returns same price when promotional MC equals product original MC', () => {
      const mcOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Same MC',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'making_charge',
          value: 10,
        },
      };

      // Product has 10% MC, offer is 10% MC
      const originalPrice = 74382;
      const product = {
        price_auto_calculated: true,
        material_type: 'gold' as const,
        purity_carats: 22,
        weight_grams: 10,
        making_charge_type: 'percent' as const,
        making_charge_percent: 10,
        making_charge_flat: null,
        gold_price_used: 7000,
        gst_percent: 5,
      };

      // Should return null because price is not reduced
      expect(resolveDiscounted(originalPrice, mcOffer, product)).toBeNull();
    });

    it('correctly calculates discount when gold_price_used is missing from product', () => {
      const mcOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Festive MC',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'making_charge',
          value: 8,
        },
      };

      // gold_price_used is null, but we have price and making_charge_percent
      const originalPrice = 77087;
      const product = {
        price_auto_calculated: true,
        material_type: 'gold' as const,
        purity_carats: 22,
        weight_grams: 10,
        making_charge_type: 'percent' as const,
        making_charge_percent: 14,
        making_charge_flat: null,
        gold_price_used: null,
        gst_percent: 5,
      };

      const discounted = resolveDiscounted(originalPrice, mcOffer, product);
      expect(discounted).toBe(73030);
      expect(discounted).toBeLessThan(originalPrice);
    });

    it('handles legacy product with material_type null and preserves purity factor', () => {
      const mcOffer: Offer & { discount: Discount } = {
        id: '1',
        label: 'Festive MC',
        description: null,
        is_active: true,
        start_date: null,
        end_date: null,
        created_at: '2026-01-01',
        discount: {
          id: 'd1',
          offer_id: '1',
          discount_type: 'making_charge',
          value: 8,
        },
      };

      // material_type is null in legacy row, but purity_carats is 22
      const originalPrice = 77087;
      const legacyProduct = {
        price_auto_calculated: true,
        material_type: null,
        purity_carats: 22,
        weight_grams: 10,
        making_charge_type: 'percent' as const,
        making_charge_percent: 14,
        making_charge_flat: null,
        gold_price_used: 7000,
        gst_percent: 5,
      };

      const discounted = resolveDiscounted(originalPrice, mcOffer, legacyProduct);
      expect(discounted).toBe(73030);
      expect(discounted).toBeLessThan(originalPrice);
    });
  });

  describe('calculatePriceBreakdown', () => {
    it('enforces exact sum invariant: base + gst = final, metal + making = base', () => {
      const { calculatePriceBreakdown } = require('../pricing');

      // Test 1: Standard auto product with exact components
      const b1 = calculatePriceBreakdown({
        price: 77087,
        materialType: 'gold',
        purityCarats: 22,
        weightGrams: 10,
        makingChargeType: 'percent',
        makingChargePercent: 14,
        goldPriceUsed: 7000,
        gstPercent: 5,
        priceAutoCalculated: true,
      });

      expect(b1.metalValue + b1.makingCharge).toBe(b1.basePrice);
      expect(b1.basePrice + b1.gst).toBe(b1.finalPrice);
      expect(b1.finalPrice).toBe(77087);
      expect(b1.gst).toBeGreaterThan(0);
      expect(Number.isInteger(b1.metalValue)).toBe(true);
      expect(Number.isInteger(b1.makingCharge)).toBe(true);
      expect(Number.isInteger(b1.basePrice)).toBe(true);
      expect(Number.isInteger(b1.gst)).toBe(true);
      expect(Number.isInteger(b1.finalPrice)).toBe(true);

      // Test 2: Breakdown on discounted price (e.g. promotional making charge)
      const b2 = calculatePriceBreakdown({
        price: 73030,
        materialType: 'gold',
        purityCarats: 22,
        weightGrams: 10,
        makingChargeType: 'percent',
        makingChargePercent: 8,
        goldPriceUsed: 7000,
        gstPercent: 5,
        priceAutoCalculated: true,
      });

      expect(b2.metalValue + b2.makingCharge).toBe(b2.basePrice);
      expect(b2.basePrice + b2.gst).toBe(b2.finalPrice);
      expect(b2.finalPrice).toBe(73030);
      expect(b2.gst).toBeGreaterThan(0);

      // Test 3: Breakdown on flat discounted price (e.g. ₹5,000 off)
      const b3 = calculatePriceBreakdown({
        price: 72087,
        materialType: 'gold',
        purityCarats: 22,
        weightGrams: 10,
        makingChargeType: 'percent',
        makingChargePercent: 14,
        goldPriceUsed: 7000,
        gstPercent: 5,
        priceAutoCalculated: true,
      });

      expect(b3.metalValue + b3.makingCharge).toBe(b3.basePrice);
      expect(b3.basePrice + b3.gst).toBe(b3.finalPrice);
      expect(b3.finalPrice).toBe(72087);
      expect(b3.gst).toBeGreaterThan(0);
      expect(b3.makingCharge).toBeGreaterThanOrEqual(0);

      // Test 4: Direct price (non-auto) product
      const b4 = calculatePriceBreakdown({
        price: 52500,
        priceAutoCalculated: false,
        gstPercent: 5,
      });

      expect(b4.basePrice + b4.gst).toBe(b4.finalPrice);
      expect(b4.finalPrice).toBe(52500);
      expect(b4.basePrice).toBe(50000);
      expect(b4.gst).toBe(2500);
    });
  });
});

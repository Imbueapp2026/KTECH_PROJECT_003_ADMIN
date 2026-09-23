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
  });
});

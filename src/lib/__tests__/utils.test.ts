import { describe, expect, it } from 'vitest';
import { resolveDiscounted } from '../utils';

describe('resolveDiscounted', () => {
	it('uses the shared offer-price calculation displayed by admin screens', () => {
		const result = resolveDiscounted(1001, {
			id: 'offer',
			label: 'Offer',
			description: null,
			is_active: true,
			start_date: null,
			end_date: null,
			created_at: '2026-01-01T00:00:00.000Z',
			discounts: [{ id: 'discount', offer_id: 'offer', discount_type: 'percentage', value: 10 }],
		});

		expect(result).toBe(901);
	});
});


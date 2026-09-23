import { describe, it, expect } from 'vitest';
import { calculateMetalPrice, PURITY_OPTIONS, MAKING_CHARGE_TYPES } from '../pricing';

describe('calculateMetalPrice', () => {
  it('calculates 24K gold price with percentage making charge and default 5% GST', () => {
    // 24K purityFactor = 1.0
    // metalPricePerGram = 7000, weight = 10g => metalValue = 70,000
    // makingCharge = 10% => charge = 7,000
    // basePrice = 77,000
    // GST 5% = 3,850 => Total = 80,850
    const price = calculateMetalPrice({
      metalPricePerGram: 7000,
      purityCarats: 24,
      weightGrams: 10,
      makingCharge: 10,
      makingChargeType: 'percent',
    });

    expect(price).toBe(80850);
  });

  it('calculates 22K gold price accurately using 0.92 purity factor', () => {
    // 22K purityFactor = 0.92
    // metalPricePerGram = 7000, weight = 10g => metalValue = 7000 * 10 * 0.92 = 64,400
    // flat making charge = 2,000 => basePrice = 66,400
    // GST 3% = 1,992 => Total = 68,392
    const price = calculateMetalPrice({
      metalPricePerGram: 7000,
      purityCarats: 22,
      weightGrams: 10,
      makingCharge: 2000,
      makingChargeType: 'flat',
      gstPercent: 3,
    });

    expect(price).toBe(68392);
  });

  it('calculates 18K gold price using 0.76 purity factor', () => {
    // 18K purityFactor = 0.76
    // metalPrice = 6000, weight = 5g => metalValue = 6000 * 5 * 0.76 = 22,800
    // flat making charge = 1000 => basePrice = 23,800
    // GST 5% = 1,190 => Total = 24,990
    const price = calculateMetalPrice({
      metalPricePerGram: 6000,
      purityCarats: 18,
      weightGrams: 5,
      makingCharge: 1000,
      makingChargeType: 'flat',
    });

    expect(price).toBe(24990);
  });

  it('calculates non-gold materials (silver) without purity carats degradation', () => {
    // silver, purityFactor = 1.0
    // metalPrice = 80/g, weight = 100g => metalValue = 8,000
    // making charge = 500 flat => basePrice = 8,500
    // GST 5% = 425 => Total = 8,925
    const price = calculateMetalPrice({
      metalPricePerGram: 80,
      purityCarats: null,
      weightGrams: 100,
      makingCharge: 500,
      makingChargeType: 'flat',
      materialType: 'silver',
    });

    expect(price).toBe(8925);
  });

  it('exposes expected PURITY_OPTIONS and MAKING_CHARGE_TYPES', () => {
    expect(PURITY_OPTIONS).toHaveLength(5);
    expect(MAKING_CHARGE_TYPES.map(t => t.value)).toEqual(['percent', 'flat']);
  });
});

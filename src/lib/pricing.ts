export interface CalculateMetalPriceParams {
  metalPricePerGram: number;
  purityCarats: 24 | 22 | 18 | 14 | 9 | null;
  weightGrams: number;
  makingCharge: number;
  makingChargeType: 'percent' | 'flat';
  gstPercent?: number;
  materialType?: 'gold' | 'silver' | 'platinum';
}

export function getPurityFactor(purityCarats: number | null | undefined, materialType = 'gold'): number {
  const mat = (materialType || 'gold').toLowerCase();
  if (mat !== 'gold' || !purityCarats) return 1.0;
  const p = Number(purityCarats);
  const factorMap: Record<number, number> = {
    24: 1.0,
    22: 0.92,
    18: 0.76,
    14: 0.5833,
    9: 0.40,
  };
  return factorMap[p] ?? 1.0;
}

export function calculateMetalPrice({
  metalPricePerGram,
  purityCarats,
  weightGrams,
  makingCharge,
  makingChargeType,
  gstPercent = 5,
  materialType = 'gold',
}: CalculateMetalPriceParams): number {
  if (metalPricePerGram <= 0 || weightGrams <= 0) return 0;
  const safeGstPercent = gstPercent >= 0 ? gstPercent : 5;
  const purityFactor = getPurityFactor(purityCarats, materialType);

  const metalValue = metalPricePerGram * weightGrams * purityFactor;
  const safeCharge = Math.max(0, Number(makingCharge) || 0);
  const charge = makingChargeType === 'percent' 
    ? metalValue * (safeCharge / 100) 
    : safeCharge;
  
  const basePrice = metalValue + charge;
  const gst = basePrice * (safeGstPercent / 100);
  
  return Math.round(basePrice + gst);
}

export function calculateDirectPrice(price: number, gstPercent = 5): number {
  const safePrice = Math.max(0, price || 0);
  const safeGstPercent = gstPercent >= 0 ? gstPercent : 5;
  return Math.round(safePrice + safePrice * (safeGstPercent / 100));
}

export interface PriceBreakdownResult {
  isAuto: boolean;
  materialType: 'gold' | 'silver' | 'platinum';
  metalValue: number;
  makingCharge: number;
  basePrice: number;
  gst: number;
  finalPrice: number;
  purityFactor: number;
}

export function calculatePriceBreakdown(params: {
  price: number;
  materialType?: string | null;
  purityCarats?: number | null;
  weightGrams?: number | null;
  makingChargeType?: 'percent' | 'flat' | string | null;
  makingChargePercent?: number | null;
  makingChargeFlat?: number | null;
  goldPriceUsed?: number | null;
  gstPercent?: number | null;
  priceAutoCalculated?: boolean;
}): PriceBreakdownResult {
  const gstPercent = params.gstPercent != null && params.gstPercent >= 0 ? params.gstPercent : 5;
  const gstFactor = 1 + gstPercent / 100;
  const rawMat = (params.materialType || (params.purityCarats ? 'gold' : 'gold')).toLowerCase();
  const materialType = (rawMat === 'silver' ? 'silver' : rawMat === 'platinum' ? 'platinum' : 'gold') as 'gold' | 'silver' | 'platinum';

  const finalPriceTarget = Math.max(0, Math.round(Number(params.price) || 0));

  if (params.priceAutoCalculated === false) {
    const base = Math.round(finalPriceTarget / gstFactor);
    const gstVal = finalPriceTarget - base;
    return {
      isAuto: false,
      materialType,
      metalValue: 0,
      makingCharge: 0,
      basePrice: base,
      gst: gstVal,
      finalPrice: finalPriceTarget,
      purityFactor: 1.0,
    };
  }

  const purityFactor = getPurityFactor(params.purityCarats, materialType);

  let rawMetalValue = 0;
  if (params.goldPriceUsed && params.goldPriceUsed > 0 && params.weightGrams && params.weightGrams > 0) {
    rawMetalValue = params.goldPriceUsed * params.weightGrams * purityFactor;
  }

  let rawCharge = 0;
  if (params.makingChargeType === 'percent' && params.makingChargePercent != null) {
    rawCharge = rawMetalValue * (params.makingChargePercent / 100);
  } else if (params.makingChargeType === 'flat' && params.makingChargeFlat != null) {
    rawCharge = Math.max(0, params.makingChargeFlat);
  }

  // If no price target was provided, compute from metalValue + charge + GST
  if (finalPriceTarget <= 0) {
    const metalVal = Math.round(rawMetalValue);
    const chg = Math.round(rawCharge);
    const base = metalVal + chg;
    const computedFinal = Math.round(base * gstFactor);
    const gst = computedFinal - base;
    return {
      isAuto: true,
      materialType,
      metalValue: metalVal,
      makingCharge: chg,
      basePrice: base,
      gst,
      finalPrice: computedFinal,
      purityFactor,
    };
  }

  // When finalPriceTarget is known (e.g. stored product price or discounted price):
  // Guarantee exact sum invariant: basePrice + gst = finalPriceTarget
  const basePriceTarget = Math.round(finalPriceTarget / gstFactor);
  const gstRounded = finalPriceTarget - basePriceTarget;

  let metalValueRounded: number;
  let chargeRounded: number;

  if (rawMetalValue > 0) {
    if (rawMetalValue <= basePriceTarget) {
      metalValueRounded = Math.round(rawMetalValue);
      chargeRounded = basePriceTarget - metalValueRounded;
    } else {
      metalValueRounded = basePriceTarget;
      chargeRounded = 0;
    }
  } else {
    // Derive metal value from basePriceTarget using making charge settings
    if (params.makingChargeType === 'percent' && params.makingChargePercent != null) {
      const derivedMetal = basePriceTarget / (1 + params.makingChargePercent / 100);
      metalValueRounded = Math.round(derivedMetal);
      chargeRounded = basePriceTarget - metalValueRounded;
    } else if (params.makingChargeType === 'flat' && params.makingChargeFlat != null) {
      chargeRounded = Math.min(basePriceTarget, Math.round(params.makingChargeFlat));
      metalValueRounded = basePriceTarget - chargeRounded;
    } else {
      metalValueRounded = basePriceTarget;
      chargeRounded = 0;
    }
  }

  return {
    isAuto: true,
    materialType,
    metalValue: metalValueRounded,
    makingCharge: chargeRounded,
    basePrice: basePriceTarget,
    gst: gstRounded,
    finalPrice: finalPriceTarget,
    purityFactor,
  };
}

export const PURITY_OPTIONS = [
  { value: 24, label: '24K' },
  { value: 22, label: '22K' },
  { value: 18, label: '18K' },
  { value: 14, label: '14K' },
  { value: 9, label: '9K' },
] as const;

export const MAKING_CHARGE_TYPES = [
  { value: 'percent', label: 'Percent of gold value' },
  { value: 'flat', label: 'Flat amount (₹)' },
] as const;

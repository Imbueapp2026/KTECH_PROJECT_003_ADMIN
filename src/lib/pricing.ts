export interface CalculateMetalPriceParams {
  metalPricePerGram: number;
  purityCarats: 24 | 22 | 18 | 14 | 9 | null;
  weightGrams: number;
  makingCharge: number;
  makingChargeType: 'percent' | 'flat';
  gstPercent?: number;
  materialType?: 'gold' | 'silver' | 'platinum';
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
  let purityFactor = 1.0;

  if (materialType === 'gold' && purityCarats) {
    purityFactor = {
      24: 1.0,
      22: 0.92,
      18: 0.76,
      14: 0.5833,
      9: 0.40,
    }[purityCarats] || 1.0;
  }

  const metalValue = metalPricePerGram * weightGrams * purityFactor;
  const charge = makingChargeType === 'percent' 
    ? metalValue * (makingCharge / 100) 
    : makingCharge;
  
  const basePrice = metalValue + charge;
  const gst = basePrice * (gstPercent / 100);
  
  return Math.round(basePrice + gst);
}

export function calculateDirectPrice(price: number, gstPercent = 5): number {
  return Math.round(price + price * (gstPercent / 100));
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

import type { Offer, Discount } from "@/lib/data/types";
import { calculateMetalPrice } from "@/lib/pricing";

export function formatPrice(n: number): string {
  const rounded = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
}

export function formatWeight(n: number | null | undefined): string {
  if (n == null) return "—";
  // Always show 3 decimal places to preserve precision
  return n.toFixed(3);
}

export function resolveDiscounted(
  price: number,
  offer: (Offer & { discount?: Discount[] | Discount | null; discounts?: Discount[] | null }) | null,
  product?: {
    price_auto_calculated?: boolean;
    material_type?: 'gold' | 'silver' | string | null;
    purity_carats?: number | null;
    weight_grams?: number | null;
    making_charge_type?: 'percent' | 'flat' | string | null;
    making_charge_percent?: number | null;
    making_charge_flat?: number | null;
    gold_price_used?: number | null;
    gst_percent?: number | null;
  }
): number | null {
  if (!offer || !offer.is_active) return null;
  if (!price || price <= 0) return null;

  // Date range check if provided
  if (offer.start_date) {
    const start = new Date(offer.start_date).getTime();
    if (!isNaN(start) && Date.now() < start) return null;
  }
  if (offer.end_date) {
    const end = new Date(offer.end_date);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    if (!isNaN(endMs) && Date.now() > endMs) return null;
  }

  const discountSource = offer.discount || offer.discounts;
  const d = Array.isArray(discountSource) ? discountSource[0] : discountSource;
  if (!d || d.value == null || d.value <= 0) return null;

  let discounted: number | null = null;

  if (d.discount_type === "making_charge") {
    // Promotional making charge rate override (d.value in %)
    const gstPercent = product?.gst_percent ?? 5;
    const gstFactor = 1 + gstPercent / 100;
    const rawMat = (product?.material_type || (product?.purity_carats ? 'gold' : 'gold')).toLowerCase();
    const materialType = (rawMat === 'silver' ? 'silver' : rawMat === 'platinum' ? 'platinum' : 'gold') as 'gold' | 'silver' | 'platinum';

    if (
      product &&
      product.price_auto_calculated !== false &&
      product.weight_grams &&
      product.weight_grams > 0 &&
      product.gold_price_used &&
      product.gold_price_used > 0
    ) {
      const purityCarats = materialType === 'gold'
        ? ((product.purity_carats ?? 24) as 24 | 22 | 18 | 14 | 9)
        : null;

      discounted = calculateMetalPrice({
        metalPricePerGram: product.gold_price_used,
        purityCarats,
        weightGrams: product.weight_grams,
        makingCharge: d.value,
        makingChargeType: 'percent',
        gstPercent,
        materialType,
      });
    } else if (
      product &&
      product.price_auto_calculated !== false &&
      (product.making_charge_percent != null || product.making_charge_flat != null)
    ) {
      // Calculate from base price when gold_price_used is missing
      const basePrice = price / gstFactor;
      let metalValue = 0;
      if (product.making_charge_type === 'percent' && product.making_charge_percent != null) {
        metalValue = basePrice / (1 + product.making_charge_percent / 100);
      } else if (product.making_charge_type === 'flat' && product.making_charge_flat != null) {
        metalValue = Math.max(0, basePrice - product.making_charge_flat);
      }
      if (metalValue > 0) {
        const newBase = metalValue * (1 + d.value / 100);
        discounted = Math.round(newBase * gstFactor);
      }
    }
  } else if (d.discount_type === "percentage" || (d.discount_type as string) === "percent") {
    discounted = Math.round(price * (1 - d.value / 100));
  } else if (d.discount_type === "flat") {
    discounted = Math.round(price - d.value);
  }

  // An offer is a DISCOUNT: the final discounted price must be strictly less than
  // the original price and at least 0. If it would increase or equal the price,
  // this promotional offer provides no benefit for this product, so return null.
  if (discounted != null && discounted < price && discounted >= 0) {
    return Math.max(0, discounted);
  }

  return null;
}

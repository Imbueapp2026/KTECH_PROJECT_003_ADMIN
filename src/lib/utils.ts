import type { Offer, Discount } from "@/lib/data/types";
import { calculateMetalPrice } from "@/lib/pricing";

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
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
  const discountSource = offer.discount || offer.discounts;
  const d = Array.isArray(discountSource) ? discountSource[0] : discountSource;
  if (!d) return null;

  if (d.discount_type === "making_charge") {
    if (product && product.price_auto_calculated !== false && product.weight_grams && product.gold_price_used) {
      return calculateMetalPrice({
        metalPricePerGram: product.gold_price_used,
        purityCarats: product.material_type === 'gold' ? (product.purity_carats as any) : null,
        weightGrams: product.weight_grams,
        makingCharge: d.value,
        makingChargeType: 'percent',
        gstPercent: product.gst_percent ?? 5,
        materialType: (product.material_type as any) || 'gold'
      });
    }
    return null;
  }

  if (d.discount_type === "percentage" || (d.discount_type as string) === "percent") {
    return price * (1 - d.value / 100);
  }
  return Math.max(0, price - d.value);
}

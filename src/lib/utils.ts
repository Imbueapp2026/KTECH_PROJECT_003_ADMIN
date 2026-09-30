import type { Offer, Discount } from "./data/types";
import { computeOfferPrice } from "./offer-price";

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
  if (!offer) return null;
  const discountSource = offer.discount || offer.discounts;
  return computeOfferPrice(
    { ...product, price },
    offer,
    discountSource ?? null,
    { metalPricePerGram: product?.gold_price_used },
  );
}

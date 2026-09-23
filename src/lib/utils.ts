import type { Offer, Discount } from "@/lib/data/types";

export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function resolveDiscounted(
  price: number,
  offer: (Offer & { discount: Discount[] | Discount | null }) | null,
): number | null {
  if (!offer || !offer.is_active) return null;
  const d = Array.isArray(offer.discount) ? offer.discount[0] : offer.discount;
  if (!d) return null;
  if (d.discount_type === "percentage") {
    return price * (1 - d.value / 100);
  }
  return Math.max(0, price - d.value);
}

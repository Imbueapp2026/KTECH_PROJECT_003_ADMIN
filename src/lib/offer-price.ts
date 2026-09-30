import type { Discount, Offer } from "./data/types";
import { calculateMetalPrice } from "./pricing";

export interface OfferPriceProduct {
  price: number;
  price_auto_calculated?: boolean;
  material_type?: "gold" | "silver" | "platinum" | string | null;
  purity_carats?: number | null;
  weight_grams?: number | null;
  making_charge_type?: "percent" | "flat" | string | null;
  making_charge_percent?: number | null;
  making_charge_flat?: number | null;
  gold_price_used?: number | null;
  gst_percent?: number | null;
}

export interface OfferPriceRates {
  metalPricePerGram?: number | null;
}

export type OfferPriceUpdate = { id: string; offer_price: number | null };

export function computeOfferPrice(
  product: OfferPriceProduct,
  offer: Pick<Offer, "is_active" | "start_date" | "end_date"> | null,
  discounts: Discount[] | Discount | null,
  rates: OfferPriceRates,
): number | null {
  if (!offer || !offer.is_active || !product.price || product.price <= 0) return null;

  if (offer.start_date) {
    const start = new Date(offer.start_date).getTime();
    if (!Number.isNaN(start) && Date.now() < start) return null;
  }
  if (offer.end_date) {
    const end = new Date(offer.end_date);
    end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    if (!Number.isNaN(endMs) && Date.now() > endMs) return null;
  }

  const discount = Array.isArray(discounts) ? discounts[0] : discounts;
  if (!discount || discount.value == null || discount.value <= 0) return null;

  let discounted: number | null = null;
  if (discount.discount_type === "making_charge") {
    const gstPercent = product.gst_percent ?? 5;
    const gstFactor = 1 + gstPercent / 100;
    const rawMaterial = (product.material_type || "gold").toLowerCase();
    const materialType = (rawMaterial === "silver" ? "silver" : rawMaterial === "platinum" ? "platinum" : "gold") as "gold" | "silver" | "platinum";
    const metalPrice = product.gold_price_used ?? rates.metalPricePerGram;

    if (
      product.price_auto_calculated !== false &&
      product.weight_grams &&
      product.weight_grams > 0 &&
      metalPrice &&
      metalPrice > 0
    ) {
      const purityCarats = materialType === "gold"
        ? ((product.purity_carats ?? 24) as 24 | 22 | 18 | 14 | 9)
        : null;
      discounted = calculateMetalPrice({
        metalPricePerGram: metalPrice,
        purityCarats,
        weightGrams: product.weight_grams,
        makingCharge: discount.value,
        makingChargeType: "percent",
        gstPercent,
        materialType,
      });
    } else if (
      product.price_auto_calculated !== false &&
      (product.making_charge_percent != null || product.making_charge_flat != null)
    ) {
      const basePrice = product.price / gstFactor;
      let metalValue = 0;
      if (product.making_charge_type === "percent" && product.making_charge_percent != null) {
        metalValue = basePrice / (1 + product.making_charge_percent / 100);
      } else if (product.making_charge_type === "flat" && product.making_charge_flat != null) {
        metalValue = Math.max(0, basePrice - product.making_charge_flat);
      }
      if (metalValue > 0) {
        const newBase = metalValue * (1 + discount.value / 100);
        discounted = Math.round(newBase * gstFactor);
      }
    }
  } else if (discount.discount_type === "percentage" || (discount.discount_type as string) === "percent") {
    discounted = Math.round(product.price * (1 - discount.value / 100));
  } else if (discount.discount_type === "flat") {
    discounted = Math.round(product.price - discount.value);
  }

  if (discounted != null && discounted < product.price && discounted >= 0) {
    return Math.max(0, discounted);
  }
  return null;
}

export function computeOfferPriceUpdates(
  products: Array<OfferPriceProduct & { id: string }>,
  offer: Pick<Offer, "is_active" | "start_date" | "end_date"> | null,
  discounts: Discount[] | Discount | null,
): OfferPriceUpdate[] {
  return products.map((product) => ({
    id: product.id,
    offer_price: computeOfferPrice(product, offer, discounts, {
      metalPricePerGram: product.gold_price_used,
    }),
  }));
}
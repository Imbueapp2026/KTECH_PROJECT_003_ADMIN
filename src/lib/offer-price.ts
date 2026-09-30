import type { Discount, Offer } from "./data/types";
import { calculateMetalPrice, calculatePriceBreakdown } from "./pricing";

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

export type OfferDiscountType = "flat" | "percentage" | "making_charge" | "mixed";
export type OfferPriceResult = {
  offerPrice: number | null;
  discountAmount: number | null;
  discountType: OfferDiscountType | null;
};
export type OfferPriceUpdate = {
  id: string;
  offer_price: number | null;
  offer_discount_amount: number | null;
  offer_discount_type: OfferDiscountType | null;
};

const NO_OFFER_PRICE: OfferPriceResult = {
  offerPrice: null,
  discountAmount: null,
  discountType: null,
};

export function computeOfferPrice(
  product: OfferPriceProduct,
  offer: Pick<Offer, "is_active" | "start_date" | "end_date"> | null,
  discounts: Discount[] | Discount | null,
  rates: OfferPriceRates,
): OfferPriceResult {
  if (!offer || !offer.is_active || !product.price || product.price <= 0) return NO_OFFER_PRICE;

  if (offer.start_date) {
    const start = new Date(offer.start_date).getTime();
    if (!Number.isNaN(start) && Date.now() < start) return NO_OFFER_PRICE;
  }
  if (offer.end_date) {
    const endMs = new Date(offer.end_date).getTime();
    if (!Number.isNaN(endMs) && Date.now() >= endMs) return NO_OFFER_PRICE;
  }

  const discountList = Array.isArray(discounts) ? discounts : discounts ? [discounts] : [];
  const discount = discountList[0];
  if (!discount || discount.value == null || discount.value <= 0) return NO_OFFER_PRICE;

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

  if (discounted == null || discounted >= product.price || discounted < 0) return NO_OFFER_PRICE;

  const offerPrice = Math.max(0, Math.round(discounted));
  const discountType: OfferDiscountType = discountList.length > 1
    ? "mixed"
    : (discount.discount_type as string) === "percent" ? "percentage" : discount.discount_type;
  let discountAmount = Math.max(0, Math.round(product.price - offerPrice));

  if (discountList.length === 1 && discount.discount_type === "making_charge") {
    const rawMaterial = (product.material_type || "gold").toLowerCase();
    const materialType = rawMaterial === "silver" ? "silver" : rawMaterial === "platinum" ? "platinum" : "gold";
    const metalPrice = product.gold_price_used ?? rates.metalPricePerGram;
    const originalBreakdown = calculatePriceBreakdown({
      price: product.price,
      materialType,
      purityCarats: product.purity_carats,
      weightGrams: product.weight_grams,
      makingChargeType: product.making_charge_type,
      makingChargePercent: product.making_charge_percent,
      makingChargeFlat: product.making_charge_flat,
      goldPriceUsed: metalPrice,
      gstPercent: product.gst_percent,
      priceAutoCalculated: product.price_auto_calculated,
    });
    const offerBreakdown = calculatePriceBreakdown({
      price: offerPrice,
      materialType,
      purityCarats: product.purity_carats,
      weightGrams: product.weight_grams,
      makingChargeType: "percent",
      makingChargePercent: discount.value,
      makingChargeFlat: null,
      goldPriceUsed: metalPrice,
      gstPercent: product.gst_percent,
      priceAutoCalculated: product.price_auto_calculated,
    });
    discountAmount = Math.max(0, originalBreakdown.makingCharge - offerBreakdown.makingCharge);
  }

  return { offerPrice, discountAmount, discountType };
}

export function computeOfferPriceUpdates(
  products: Array<OfferPriceProduct & { id: string }>,
  offer: Pick<Offer, "is_active" | "start_date" | "end_date"> | null,
  discounts: Discount[] | Discount | null,
): OfferPriceUpdate[] {
  return products.map((product) => {
    const result = computeOfferPrice(product, offer, discounts, {
      metalPricePerGram: product.gold_price_used,
    });
    return {
      id: product.id,
      offer_price: result.offerPrice,
      offer_discount_amount: result.discountAmount,
      offer_discount_type: result.discountType,
    };
  });
}
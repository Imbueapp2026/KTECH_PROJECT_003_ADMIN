import type { SupabaseClient } from "@supabase/supabase-js";
import type { Discount, Offer } from "./data/types";
import { applyOfferPriceItems, MAX_OFFER_ASSIGNMENT_ITEMS } from "./offer-assignment-admin";
import {
  computeOfferPrice,
  computeOfferPriceUpdates,
  type OfferPriceUpdate,
  type OfferPriceResult,
  type OfferPriceProduct,
} from "./offer-price";

type OfferContext = Pick<Offer, "is_active" | "start_date" | "end_date"> & {
  discounts: Discount[] | null;
};

const PRODUCT_PRICE_FIELDS = "price, price_auto_calculated, material_type, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat, gold_price_used, gst_percent";

export async function computeProductOfferPrice(
  supabase: SupabaseClient,
  product: OfferPriceProduct,
  offerId: string | null,
): Promise<{ data: OfferPriceResult; error: unknown | null }> {
  if (!offerId) {
    return { data: computeOfferPrice(product, null, null, {}), error: null };
  }
  const { data, error } = await supabase
    .from("offers")
    .select("is_active, start_date, end_date, discounts(id, offer_id, discount_type, value)")
    .eq("id", offerId)
    .maybeSingle();
  if (error) return { data: computeOfferPrice(product, null, null, {}), error };
  if (!data) return { data: computeOfferPrice(product, null, null, {}), error: new Error("Offer not found") };
  const context = data as OfferContext;
  return {
    data: computeOfferPrice(product, context, context.discounts, {
      metalPricePerGram: product.gold_price_used,
    }),
    error: null,
  };
}

export async function recomputeOfferPrices(
  supabase: SupabaseClient,
  offerId: string,
): Promise<{ updated: number; error: unknown | null }> {
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("is_active, start_date, end_date, discounts(id, offer_id, discount_type, value)")
    .eq("id", offerId)
    .maybeSingle();
  if (offerError) return { updated: 0, error: offerError };
  if (!offer) return { updated: 0, error: new Error("Offer not found") };

  const context = offer as OfferContext;
  const updates: Array<OfferPriceUpdate & { offer_id: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data: products, error } = await supabase
      .from("products")
      .select(`id, ${PRODUCT_PRICE_FIELDS}`)
      .eq("offer_id", offerId)
      .order("id")
      .range(offset, offset + 499);
    if (error) return { updated: 0, error };
    if (!products?.length) break;

    const priceUpdates = computeOfferPriceUpdates(
      products as Array<OfferPriceProduct & { id: string }>,
      context,
      context.discounts,
    );
    updates.push(...priceUpdates.map((item) => ({ ...item, offer_id: offerId })));
    if (updates.length > MAX_OFFER_ASSIGNMENT_ITEMS) {
      return { updated: 0, error: new Error(`Cannot recompute more than ${MAX_OFFER_ASSIGNMENT_ITEMS} products atomically`) };
    }
    if (products.length < 500) break;
  }
  try {
    return { updated: await applyOfferPriceItems(supabase, updates), error: null };
  } catch (error) {
    return { updated: 0, error };
  }
}

export async function recomputeAllOfferPrices(
  supabase: SupabaseClient,
): Promise<{ updated: number; error: unknown | null }> {
  const products: Array<OfferPriceProduct & { id: string; offer_id: string }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("products")
      .select(`id, offer_id, ${PRODUCT_PRICE_FIELDS}`)
      .not("offer_id", "is", null)
      .order("id")
      .range(offset, offset + 499);
    if (error) return { updated: 0, error };
    products.push(...((data ?? []) as Array<OfferPriceProduct & { id: string; offer_id: string }>));
    if (products.length > MAX_OFFER_ASSIGNMENT_ITEMS) {
      return { updated: 0, error: new Error(`Cannot recompute more than ${MAX_OFFER_ASSIGNMENT_ITEMS} products atomically`) };
    }
    if (!data || data.length < 500) break;
  }

  if (!products.length) return { updated: 0, error: null };
  const offerIds = [...new Set(products.map((product) => product.offer_id))];
  const { data: offerData, error: offersError } = await supabase
    .from("offers")
    .select("id, is_active, start_date, end_date, discounts(id, offer_id, discount_type, value)")
    .in("id", offerIds);
  if (offersError) return { updated: 0, error: offersError };
  const offersById = new Map<string, OfferContext>();
  for (const value of offerData ?? []) {
    const offer = value as OfferContext & { id: string };
    offersById.set(offer.id, offer);
  }

  const updates: Array<OfferPriceUpdate & { offer_id: string }> = [];
  for (const product of products) {
    const offer = offersById.get(product.offer_id);
    if (!offer) return { updated: 0, error: new Error(`Offer ${product.offer_id} not found`) };
    const result = computeOfferPrice(product, offer, offer.discounts, {
      metalPricePerGram: product.gold_price_used,
    });
    updates.push({
      id: product.id,
      offer_id: product.offer_id,
      offer_price: result.offerPrice,
      offer_discount_amount: result.discountAmount,
      offer_discount_type: result.discountType,
    });
  }
  try {
    return { updated: await applyOfferPriceItems(supabase, updates), error: null };
  } catch (error) {
    return { updated: 0, error };
  }
}
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Discount, Offer } from "./data/types";
import {
  computeOfferPrice,
  computeOfferPriceUpdates,
  type OfferPriceProduct,
} from "./offer-price";

type OfferContext = Pick<Offer, "is_active" | "start_date" | "end_date"> & {
  discounts: Discount[] | null;
};

const PRODUCT_PRICE_FIELDS = "id, price, price_auto_calculated, material_type, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat, gold_price_used, gst_percent";

export async function computeProductOfferPrice(
  supabase: SupabaseClient,
  product: OfferPriceProduct,
  offerId: string | null,
): Promise<{ data: number | null; error: unknown | null }> {
  if (!offerId) return { data: null, error: null };
  const { data, error } = await supabase
    .from("offers")
    .select("is_active, start_date, end_date, discounts(id, offer_id, discount_type, value)")
    .eq("id", offerId)
    .maybeSingle();
  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error("Offer not found") };
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
  let updated = 0;
  for (let offset = 0; ; offset += 500) {
    const { data: products, error } = await supabase
      .from("products")
      .select(PRODUCT_PRICE_FIELDS)
      .eq("offer_id", offerId)
      .order("id")
      .range(offset, offset + 499);
    if (error) return { updated, error };
    if (!products?.length) break;

    const updates = computeOfferPriceUpdates(
      products as Array<OfferPriceProduct & { id: string }>,
      context,
      context.discounts,
    );
    const results = await Promise.all(updates.map(({ id, offer_price }) =>
      supabase.from("products").update({ offer_price }).eq("id", id),
    ));
    const failed = results.find((result) => result.error)?.error;
    if (failed) return { updated, error: failed };
    updated += updates.length;
    if (products.length < 500) break;
  }
  return { updated, error: null };
}

export async function recomputeAllOfferPrices(
  supabase: SupabaseClient,
): Promise<{ updated: number; error: unknown | null }> {
  const offerIds = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("products")
      .select("id, offer_id")
      .not("offer_id", "is", null)
      .order("id")
      .range(offset, offset + 499);
    if (error) return { updated: 0, error };
    for (const product of data ?? []) offerIds.add(product.offer_id as string);
    if (!data || data.length < 500) break;
  }

  let updated = 0;
  for (const offerId of offerIds) {
    const result = await recomputeOfferPrices(supabase, offerId);
    updated += result.updated;
    if (result.error) return { updated, error: result.error };
  }
  return { updated, error: null };
}
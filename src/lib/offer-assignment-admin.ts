import type { SupabaseClient } from "@supabase/supabase-js";
import type { Discount, Offer } from "./data/types";
import { computeOfferPrice, type OfferPriceProduct } from "./offer-price";

export const MAX_OFFER_ASSIGNMENT_ITEMS = 5000;
const PAGE_SIZE = 500;
const PRODUCT_FIELDS = "id, offer_id, price, price_auto_calculated, material_type, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat, gold_price_used, gst_percent";

export type OfferConflictGroup = {
  offerId: string;
  label: string;
  productCount: number;
};

export type OfferAssignmentItem = {
  id: string;
  offer_id: string | null;
  offer_price: number | null;
};

type AssignmentProduct = OfferPriceProduct & {
  id: string;
  offer_id: string | null;
};

type AssignmentOffer = Pick<Offer, "id" | "label" | "is_active" | "start_date" | "end_date"> & {
  discounts: Discount[] | null;
};

export type OfferAssignmentPlan = {
  items: OfferAssignmentItem[];
  conflicts: number;
  byOffer: OfferConflictGroup[];
  productCount: number;
};

export class OfferAssignmentError extends Error {}

async function fetchAllProducts(supabase: SupabaseClient, offerId?: string): Promise<AssignmentProduct[]> {
  const products: AssignmentProduct[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("products")
      .select(PRODUCT_FIELDS)
      .order("id");
    if (offerId) query = query.eq("offer_id", offerId);
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as AssignmentProduct[];
    products.push(...page);
    if (products.length > MAX_OFFER_ASSIGNMENT_ITEMS) {
      throw new OfferAssignmentError(`Cannot apply one offer to more than ${MAX_OFFER_ASSIGNMENT_ITEMS} products atomically`);
    }
    if (page.length < PAGE_SIZE) return products;
  }
}

export async function prepareOfferAssignment(
  supabase: SupabaseClient,
  offerId: string,
  productIds?: string[],
): Promise<OfferAssignmentPlan> {
  const { data: offerData, error: offerError } = await supabase
    .from("offers")
    .select("id, label, is_active, start_date, end_date, discounts(id, offer_id, discount_type, value)")
    .eq("id", offerId)
    .maybeSingle();
  if (offerError) throw offerError;
  if (!offerData) throw new OfferAssignmentError("Offer not found");
  const offer = offerData as AssignmentOffer;

  let products: AssignmentProduct[];
  if (productIds) {
    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) throw new OfferAssignmentError("Select at least one product");
    if (uniqueIds.length > MAX_OFFER_ASSIGNMENT_ITEMS) {
      throw new OfferAssignmentError(`Cannot apply one offer to more than ${MAX_OFFER_ASSIGNMENT_ITEMS} products atomically`);
    }
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_FIELDS)
      .in("id", uniqueIds);
    if (error) throw error;
    products = (data ?? []) as AssignmentProduct[];
    if (products.length !== uniqueIds.length) throw new OfferAssignmentError("One or more selected products were not found");
  } else {
    products = await fetchAllProducts(supabase);
  }

  const conflictingProducts = products.filter((product) => product.offer_id && product.offer_id !== offerId);
  const conflictCounts = new Map<string, number>();
  for (const product of conflictingProducts) {
    conflictCounts.set(product.offer_id!, (conflictCounts.get(product.offer_id!) ?? 0) + 1);
  }

  let byOffer: OfferConflictGroup[] = [];
  if (conflictCounts.size) {
    const conflictOfferIds = [...conflictCounts.keys()];
    const { data: existingOffers, error } = await supabase
      .from("offers")
      .select("id, label")
      .in("id", conflictOfferIds);
    if (error) throw error;
    const labels = new Map((existingOffers ?? []).map((item: { id: string; label: string }) => [item.id, item.label]));
    byOffer = conflictOfferIds
      .map((id) => ({ offerId: id, label: labels.get(id) ?? id, productCount: conflictCounts.get(id)! }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  const items = products.map((product) => ({
    id: product.id,
    offer_id: offerId,
    offer_price: computeOfferPrice(product, offer, offer.discounts, {
      metalPricePerGram: product.gold_price_used,
    }),
  }));

  return {
    items,
    conflicts: conflictingProducts.length,
    byOffer,
    productCount: products.length,
  };
}

export async function applyOfferAssignment(
  supabase: SupabaseClient,
  plan: OfferAssignmentPlan,
  confirmOverride: boolean,
) {
  if (!confirmOverride) {
    return {
      conflicts: plan.conflicts,
      byOffer: plan.byOffer,
      productCount: plan.productCount,
      updated: 0,
    };
  }

  if (!plan.items.length) return { conflicts: plan.conflicts, byOffer: plan.byOffer, productCount: 0, updated: 0 };
  const updated = await applyOfferPriceItems(supabase, plan.items);
  return {
    conflicts: plan.conflicts,
    byOffer: plan.byOffer,
    productCount: plan.productCount,
    updated,
  };
}

export async function applyOfferPriceItems(
  supabase: SupabaseClient,
  items: OfferAssignmentItem[],
): Promise<number> {
  if (items.length > MAX_OFFER_ASSIGNMENT_ITEMS) {
    throw new OfferAssignmentError(`Cannot update more than ${MAX_OFFER_ASSIGNMENT_ITEMS} products atomically`);
  }
  if (!items.length) return 0;
  const { data, error } = await supabase.rpc("apply_offer_prices", { p_items: items });
  if (error) throw error;
  return typeof data === "number" ? data : items.length;
}

export async function clearOfferAssignments(
  supabase: SupabaseClient,
  offerId: string,
): Promise<number> {
  const products = await fetchAllProducts(supabase, offerId);
  const items = products.map((product) => ({ id: product.id, offer_id: null, offer_price: null }));
  return applyOfferPriceItems(supabase, items);
}
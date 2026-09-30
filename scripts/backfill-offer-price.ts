import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import type { Discount, Offer } from "../src/lib/data/types";
import { computeOfferPrice, type OfferPriceProduct, type OfferDiscountType } from "../src/lib/offer-price";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--apply")) {
  throw new Error("Only the optional --apply argument is supported.");
}

loadEnvConfig(process.cwd());
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Supabase environment is not configured.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const apply = args.includes("--apply");
const pageSize = 500;

type BackfillProduct = OfferPriceProduct & {
  id: string;
  offer_id: string | null;
  offer_price: number | null;
  offer_discount_amount: number | null;
  offer_discount_type: OfferDiscountType | null;
  offer: (Pick<Offer, "is_active" | "start_date" | "end_date"> & { discounts: Discount[] | null }) | null;
};

async function backfill() {
  console.log("id\told_offer_price\tnew_offer_price\told_offer_discount_amount\tnew_offer_discount_amount\told_offer_discount_type\tnew_offer_discount_type");
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, offer_id, offer_price, offer_discount_amount, offer_discount_type, price, price_auto_calculated, material_type, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat, gold_price_used, gst_percent, offer:offers(is_active, start_date, end_date, discounts(id, offer_id, discount_type, value))")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("Failed to read products for offer-price backfill.");
    const products = (data ?? []) as unknown as BackfillProduct[];
    for (const product of products) {
      const offer = Array.isArray(product.offer) ? product.offer[0] : product.offer;
      const result = computeOfferPrice(
        product,
        offer ?? null,
        offer?.discounts ?? null,
        { metalPricePerGram: product.gold_price_used },
      );
      console.log([
        product.id,
        product.offer_price ?? "null",
        result.offerPrice ?? "null",
        product.offer_discount_amount ?? "null",
        result.discountAmount ?? "null",
        product.offer_discount_type ?? "null",
        result.discountType ?? "null",
      ].join("\t"));

      if (apply) {
        const { error: updateError } = await supabase
          .from("products")
          .update({
            offer_price: result.offerPrice,
            offer_discount_amount: result.discountAmount,
            offer_discount_type: result.discountType,
          })
          .eq("id", product.id);
        if (updateError) throw new Error("Failed to write an offer price during backfill.");
      }
    }

    if (products.length < pageSize) break;
  }
}

backfill().catch(() => {
  console.error("Offer-price backfill failed; verify the schema and database connection.");
  process.exitCode = 1;
});
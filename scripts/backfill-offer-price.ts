import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import type { Discount, Offer } from "../src/lib/data/types";
import { computeOfferPrice, type OfferPriceProduct } from "../src/lib/offer-price";

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
  offer_price: number | null;
  offer: (Pick<Offer, "is_active" | "start_date" | "end_date"> & { discounts: Discount[] | null }) | null;
};

async function backfill() {
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, offer_id, offer_price, price, price_auto_calculated, material_type, purity_carats, weight_grams, making_charge_type, making_charge_percent, making_charge_flat, gold_price_used, gst_percent, offer:offers(is_active, start_date, end_date, discounts(id, offer_id, discount_type, value))")
      .not("offer_id", "is", null)
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("Failed to read products for offer-price backfill.");
    const products = (data ?? []) as unknown as BackfillProduct[];
    for (const product of products) {
      const offer = Array.isArray(product.offer) ? product.offer[0] : product.offer;
      const offerPrice = computeOfferPrice(
        product,
        offer ?? null,
        offer?.discounts ?? null,
        { metalPricePerGram: product.gold_price_used },
      );
      console.log(`${product.id}\t${product.offer_price ?? "null"}\t${offerPrice ?? "null"}`);

      if (apply) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ offer_price: offerPrice })
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
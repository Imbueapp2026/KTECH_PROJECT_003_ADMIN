/**
 * FILE PATH: src/app/api/admin/products/[id]/route.ts   (the [id] folder)
 *
 * GET    /api/admin/products/[id]   — single product with category + offer join
 * PATCH  /api/admin/products/[id]   — partial update
 * DELETE /api/admin/products/[id]   — soft delete (status='archived')
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  notFound,
  parseJson,
  serverError,
  unauthorized,
  asBool,
  asEnum,
  asNumber,
  asString,
  asUuid,
} from "@/lib/http";
import { calculateDirectPrice, calculateMetalPrice } from "@/lib/pricing";
import type { Availability, ProductStatus } from "@/lib/data/types";

const AVAILABILITY = ["available", "made_to_order", "sold"] as const;
const STATUS = ["draft", "published", "archived"] as const;
const PURITY_CARATS = ["24", "22", "18", "14", "9"] as const;
const MAKING_CHARGE_TYPE = ["percent", "flat"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(_req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, category_id, description, hallmark_certified, availability, price, offer_id, status, image_urls, created_at, updated_at, purity_carats, weight_grams, net_weight_grams, making_charge_percent, making_charge_flat, making_charge_type, price_auto_calculated, certifications, gold_price_used, material_type, gst_percent, category:categories(id, name, slug, icon_svg)",
    )
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
}

interface ProductPatch {
  name?: unknown;
  category_id?: unknown;
  description?: unknown;
  hallmark_certified?: unknown;
  availability?: unknown;
  price?: unknown;
  offer_id?: unknown;
  status?: unknown;
  image_urls?: unknown;
  // Gold pricing fields
  purity_carats?: unknown;
  weight_grams?: unknown;
  net_weight_grams?: unknown;
  making_charge_percent?: unknown;
  making_charge_flat?: unknown;
  making_charge_type?: unknown;
  price_auto_calculated?: unknown;
  certifications?: unknown;
  gold_price_used?: unknown;
  material_type?: unknown;
  gst_percent?: unknown;
  festival_id?: unknown;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin(req))) return unauthorized();
    const { id } = await params;
    if (!asUuid(id)) return badRequest("invalid id");
    const body = (await parseJson<ProductPatch>(req)) ?? {};

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = asString(body.name, 200);
    if (!v) return badRequest("name invalid");
    patch.name = v;
  }
  if (body.category_id !== undefined) {
    const v = asUuid(body.category_id);
    if (!v) return badRequest("category_id invalid");
    patch.category_id = v;
  }
  if (body.description !== undefined) {
    const v = asString(body.description, 5000);
    if (!v) return badRequest("description invalid");
    patch.description = v;
  }
  if (body.hallmark_certified !== undefined) {
    const v = asBool(body.hallmark_certified);
    if (v === null) return badRequest("hallmark_certified must be boolean");
    patch.hallmark_certified = v;
  }
  if (body.availability !== undefined) {
    const v = asEnum<Availability>(body.availability, AVAILABILITY);
    if (!v) return badRequest("availability invalid");
    patch.availability = v;
  }
  const directPrice = body.price === undefined || body.price === null || body.price === ""
    ? null
    : asNumber(body.price);
  if (body.price !== undefined) {
    if (body.price !== null && body.price !== "" && directPrice == null) return badRequest("price must be a valid number");
    if (directPrice != null && directPrice <= 0) return badRequest("price must be positive");
    if (directPrice != null) {
      patch.price = directPrice;
      patch.price_auto_calculated = false;
      patch.gold_price_used = null;
    }
  }
  if (body.offer_id !== undefined) {
    patch.offer_id = body.offer_id == null ? null : asUuid(body.offer_id);
  }
  if (body.status !== undefined) {
    const v = asEnum<ProductStatus>(body.status, STATUS);
    if (!v) return badRequest("status invalid");
    patch.status = v;
  }
  if (body.image_urls !== undefined) {
    if (!Array.isArray(body.image_urls)) return badRequest("image_urls must be array");
    patch.image_urls = body.image_urls
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 4);
  }
  
  // Gold pricing fields
  if (body.purity_carats !== undefined) {
    // Accept both string and number for purity_carats
    let v: string | undefined;
    if (typeof body.purity_carats === 'number') {
      v = body.purity_carats.toString();
    } else if (typeof body.purity_carats === 'string') {
      v = body.purity_carats;
    } else {
      const enumResult = asEnum(body.purity_carats, PURITY_CARATS);
      v = enumResult || undefined;
    }
    // Allow null for silver, otherwise validate
    if (v !== null && v !== undefined && !PURITY_CARATS.includes(v as (typeof PURITY_CARATS)[number])) {
      return badRequest("purity_carats invalid");
    }
    patch.purity_carats = v ? parseInt(v, 10) : null;
  }
  if (body.weight_grams !== undefined) {
    const v = asNumber(body.weight_grams);
    if (v != null && v <= 0) return badRequest("weight_grams must be positive");
    patch.weight_grams = v;
  }
  if (body.net_weight_grams !== undefined) {
    const v = body.net_weight_grams !== null && body.net_weight_grams !== ""
      ? asNumber(body.net_weight_grams)
      : null;
    if (v != null && v <= 0) return badRequest("net_weight_grams must be positive");
    patch.net_weight_grams = v;
  }
  if (body.making_charge_percent !== undefined) {
    const v = asNumber(body.making_charge_percent);
    if (v != null && v < 0) return badRequest("making_charge_percent must be non-negative");
    patch.making_charge_percent = v;
  }
  if (body.making_charge_flat !== undefined) {
    const v = asNumber(body.making_charge_flat);
    if (v != null && v < 0) return badRequest("making_charge_flat must be non-negative");
    patch.making_charge_flat = v;
  }
  if (body.making_charge_type !== undefined) {
    if (body.making_charge_type === null || body.making_charge_type === "") {
      patch.making_charge_type = null;
    } else {
    const v = asEnum(body.making_charge_type, MAKING_CHARGE_TYPE);
    if (!v) return badRequest("making_charge_type invalid");
    patch.making_charge_type = v;
    }
  }
  if (body.price_auto_calculated !== undefined) {
    const v = asBool(body.price_auto_calculated);
    if (v === null) return badRequest("price_auto_calculated must be boolean");
    patch.price_auto_calculated = v;
  }
  if (body.certifications !== undefined) {
    patch.certifications = body.certifications
      ? String(body.certifications).split(",").map((c) => c.trim()).filter(Boolean)
      : null;
  }
  // gold_price_used is optional - backend will fetch current price from database
  if (body.gold_price_used !== undefined) {
    const v = asNumber(body.gold_price_used);
    if (v !== null && v <= 0) return badRequest("gold_price_used must be positive");
    patch.gold_price_used = v;
  }
  if (body.material_type !== undefined) {
    const v = asEnum(body.material_type, ["gold", "silver"]);
    if (!v) return badRequest("material_type invalid");
    patch.material_type = v;
  }
  if (body.gst_percent !== undefined) {
    const v = asNumber(body.gst_percent);
    if (v != null && (v < 0 || v > 100)) return badRequest("gst_percent must be between 0 and 100");
    patch.gst_percent = v;
  }
  if (body.festival_id !== undefined) {
    patch.festival_id = body.festival_id == null ? null : asUuid(body.festival_id);
  }
  
  // Fetch current product to get existing values
  const supabase = getServiceClient();
  const { data: currentProduct } = await supabase
    .from("products")
    .select("price, price_auto_calculated, purity_carats, weight_grams, making_charge_percent, making_charge_flat, making_charge_type, gold_price_used, material_type, gst_percent")
    .eq("id", id)
    .single();
  
  if (!currentProduct) return notFound();
  
  // Always recalculate price if product has required gold pricing fields
  const materialType = (patch.material_type ?? currentProduct.material_type) as "gold" | "silver" | null;
  const purity = (patch.purity_carats ?? currentProduct.purity_carats) as 24 | 22 | 18 | 14 | 9 | null;
  const weight = patch.weight_grams ?? currentProduct.weight_grams;
  const makingType = (patch.making_charge_type ?? currentProduct.making_charge_type) as "percent" | "flat" | null;
  const makingPercent = patch.making_charge_percent ?? currentProduct.making_charge_percent;
  const makingFlat = patch.making_charge_flat ?? currentProduct.making_charge_flat;
  const gstPercent = patch.gst_percent ?? currentProduct.gst_percent ?? 5;

  if (directPrice != null) {
    patch.price = calculateDirectPrice(directPrice, gstPercent);
  }
  
  const shouldRecalculate = directPrice == null && currentProduct.price_auto_calculated !== false;
  let usedMetalPrice: number | null = null;

  if (shouldRecalculate) {
    const priceTable = materialType === 'silver' ? 'silver_prices' : 'gold_prices';
    const priceResult = await supabase
      .from(priceTable)
      .select("price_per_gram")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (priceResult.error) {
      console.error(`[API] Failed to fetch ${materialType} price for update:`, priceResult.error);
      if (priceResult.error.code === '42P01') {
        return badRequest(`${materialType === 'silver' ? 'Silver' : 'Gold'} prices table does not exist. Please run database migrations.`);
      }
      return serverError(`Failed to fetch current ${materialType} price from database`);
    }

    usedMetalPrice = priceResult.data?.price_per_gram ?? null;
  }

  // Only recalculate automatic products when all required fields are present.
  if (shouldRecalculate && weight && makingType && usedMetalPrice) {
    const makingCharge = makingType === 'percent' ? makingPercent : makingFlat;
    
    // Validate required fields
    if (weight <= 0) {
      return badRequest("weight_grams must be positive");
    }
    if (usedMetalPrice <= 0) {
      return badRequest("metal_price_used must be positive");
    }
    if (makingType === 'percent' && (makingCharge == null || makingCharge < 0)) {
      return badRequest("making_charge_percent is required and must be non-negative for percent-based making charge");
    }
    if (makingType === 'flat' && (makingCharge == null || makingCharge < 0)) {
      return badRequest("making_charge_flat is required and must be non-negative for flat making charge");
    }
    
    patch.price = calculateMetalPrice({
      metalPricePerGram: usedMetalPrice,
      purityCarats: materialType === 'gold' ? purity : null, // Will handle null for silver
      weightGrams: weight,
      makingCharge: makingCharge!,
      makingChargeType: makingType,
      gstPercent: gstPercent,
      materialType: materialType || 'gold',
    });
    patch.gold_price_used = usedMetalPrice;
    patch.price_auto_calculated = true;
    patch.gst_percent = gstPercent;
  }
  
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error('[API] PATCH product error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
  } catch (error) {
    console.error('[API] PATCH /api/admin/products/[id] CATCH BLOCK ERROR:', error);
    if (error instanceof Error) {
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
    } else {
      console.error('[API] Non-error object caught:', error);
    }
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  // Soft delete — preserve inquiry history.
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
}
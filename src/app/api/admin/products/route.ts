/**
 * FILE PATH: src/app/api/admin/products/route.ts   (NOT the [id] folder)
 *
 * GET  /api/admin/products       — list (filterable by status, category_id, q)
 * POST /api/admin/products       — create (draft until image upload completes)
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  parsePagination,
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

interface ProductBody {
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
  festival_id?: unknown; // Optional - available after migration
}

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return unauthorized();
    const url = new URL(req.url);
    const { page, limit, offset } = parsePagination(url);
    const status = asEnum<ProductStatus>(
      url.searchParams.get("status"),
      STATUS,
    );
    const categoryId = asUuid(url.searchParams.get("category_id"));
    const q = asString(url.searchParams.get("q"), 100);

    const supabase = getServiceClient();
    
    // Try to fetch products with all fields including new festival_id
    // If some columns don't exist yet, we'll fall back to a simpler query
    let query = supabase
      .from("products")
      .select(
        "id, name, category_id, description, hallmark_certified, availability, price, offer_id, status, image_urls, created_at, updated_at, purity_carats, weight_grams, net_weight_grams, making_charge_percent, making_charge_flat, making_charge_type, price_auto_calculated, certifications, gold_price_used, material_type, gst_percent, festival_id, categories(id, name, slug)",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (q) query = query.ilike("name", `%${q}%`);
    
    let result = await query.range(offset, offset + limit - 1);
    
    // If the query fails due to missing columns, try a simpler query without festival_id
    if (result.error && (result.error.code === '42703' || result.error.message?.includes('column'))) {
      console.warn('[API] Schema mismatch detected - retrying with simpler query');
      
      // Fallback to query without festival_id
      const fallbackQuery = supabase
        .from("products")
        .select(
          "id, name, category_id, description, hallmark_certified, availability, price, offer_id, status, image_urls, created_at, updated_at, purity_carats, weight_grams, net_weight_grams, making_charge_percent, making_charge_flat, making_charge_type, price_auto_calculated, certifications, gold_price_used, material_type, gst_percent, categories(id, name, slug)",
          { count: "exact" },
        )
        .order("updated_at", { ascending: false });
      if (status) fallbackQuery.eq("status", status);
      if (categoryId) fallbackQuery.eq("category_id", categoryId);
      if (q) fallbackQuery.ilike("name", `%${q}%`);
      
      result = (await fallbackQuery.range(offset, offset + limit - 1)) as typeof result;
    }
    
    const { data, error, count } = result;
    
    if (error) {
      console.error('[API] GET /api/admin/products query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return serverError(error);
    }
    
    return Response.json({ data, pagination: { page, limit, total: count || 0 } });
  } catch (error) {
    console.error('[API] GET /api/admin/products error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function POST(req: Request) {
  try {
    if (!(await requireAdmin(req))) return unauthorized();
    
    const body = (await parseJson<ProductBody>(req)) ?? {};
    
    const name = asString(body.name, 200);
    const category_id = asUuid(body.category_id);
    const description = asString(body.description, 5000);
    
    const hallmark_certified = asBool(body.hallmark_certified) ?? false;
    const availability = (asEnum<Availability>(body.availability, AVAILABILITY) ??
      "available") as Availability;
    const offer_id = body.offer_id == null ? null : asUuid(body.offer_id);
    const status = asEnum<ProductStatus>(body.status, STATUS) ?? "published";
    const image_urls = Array.isArray(body.image_urls)
      ? body.image_urls
          .filter((u): u is string => typeof u === "string" && u.length > 0)
          .slice(0, 4)
      : [];

    // Gold pricing fields - required for gold, optional for silver
    // Accept both string and number for purity_carats
    let purity_carats: 24 | 22 | 18 | 14 | 9 | null = null;
    
    // Only validate purity_carats if material_type is gold
    const material_type = asEnum(body.material_type, ["gold", "silver"]) ?? "gold";
    
    const directPrice = body.price !== undefined && body.price !== null && body.price !== ""
      ? asNumber(body.price)
      : null;
    if (directPrice != null && directPrice <= 0) return badRequest("price must be positive");

    if (material_type === 'gold' && directPrice == null) {
      let purity_carats_str: string | undefined;
      if (typeof body.purity_carats === 'number') {
        purity_carats_str = body.purity_carats.toString();
      } else if (typeof body.purity_carats === 'string') {
        purity_carats_str = body.purity_carats;
      } else {
        const enumResult = asEnum(body.purity_carats, PURITY_CARATS);
        purity_carats_str = enumResult || undefined;
      }
      
      if (!purity_carats_str || !PURITY_CARATS.includes(purity_carats_str as (typeof PURITY_CARATS)[number])) {
        return badRequest("purity_carats is required for gold items and must be one of: 24, 22, 18, 14, 9");
      }
      purity_carats = parseInt(purity_carats_str, 10) as 24 | 22 | 18 | 14 | 9;
    } else if (material_type === 'gold' && body.purity_carats) {
      const purity_carats_str = body.purity_carats.toString();
      if (PURITY_CARATS.includes(purity_carats_str as (typeof PURITY_CARATS)[number])) {
        purity_carats = parseInt(purity_carats_str, 10) as 24 | 22 | 18 | 14 | 9;
      }
    }
    const weight_grams = asNumber(body.weight_grams);
    if (directPrice == null && (weight_grams == null || weight_grams <= 0)) return badRequest("weight_grams is required and must be positive");
    
    const net_weight_grams = body.net_weight_grams !== undefined && body.net_weight_grams !== null && body.net_weight_grams !== ""
      ? asNumber(body.net_weight_grams)
      : null;
    if (net_weight_grams != null && net_weight_grams <= 0) return badRequest("net_weight_grams must be positive");
    
    const making_charge_percent = asNumber(body.making_charge_percent);
    const making_charge_flat = asNumber(body.making_charge_flat);
    const making_charge_type = asEnum(body.making_charge_type, MAKING_CHARGE_TYPE);
    if (directPrice == null && !making_charge_type) return badRequest("making_charge_type is required");
    
    // certifications column is a Postgres array — convert comma-separated string to array
    const certifications = body.certifications
      ? String(body.certifications).split(",").map((c) => c.trim()).filter(Boolean)
      : null;
    
    const gst_percent = asNumber(body.gst_percent) ?? 5;
    const festival_id = asUuid(body.festival_id); // Optional - will be added after migration

    // Validation
    if (!name) return badRequest("name is required");
    if (!description) return badRequest("description is required");
    if (directPrice == null) {
      if (making_charge_type === 'percent' && (making_charge_percent == null || making_charge_percent < 0)) {
        return badRequest("making_charge_percent is required and must be non-negative for percent-based making charge");
      }
      if (making_charge_type === 'flat' && (making_charge_flat == null || making_charge_flat < 0)) {
        return badRequest("making_charge_flat is required and must be non-negative for flat making charge");
      }
    }

    // Fetch a metal price only when the product price must be calculated.
    const supabase = getServiceClient();
    let finalPrice = directPrice;
    let isAutoCalculated = false;
    let goldPriceUsedValue: number | null = null;

    if (directPrice != null) {
      finalPrice = calculateDirectPrice(directPrice, gst_percent);
    }

    if (directPrice == null) {
      const priceTable = material_type === 'silver' ? 'silver_prices' : 'gold_prices';
      const priceResult = await supabase
        .from(priceTable)
        .select("price_per_gram")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (priceResult.error) {
        console.error(`[API] Failed to fetch ${material_type} price:`, priceResult.error);
        if (priceResult.error.code === '42P01') {
          return badRequest(`${material_type === 'silver' ? 'Silver' : 'Gold'} prices table does not exist. Please run database migrations.`);
        }
        return serverError(`Failed to fetch current ${material_type} price from database`);
      }

      const usedMetalPrice = priceResult.data?.price_per_gram;
      if (!usedMetalPrice || usedMetalPrice <= 0) {
        return badRequest(`No ${material_type} price is set in the database. Please set a ${material_type} price first in the admin panel.`);
      }

      const makingCharge = making_charge_type === 'percent' ? making_charge_percent : making_charge_flat;
      finalPrice = calculateMetalPrice({
        metalPricePerGram: usedMetalPrice,
        purityCarats: purity_carats || 24, // Default to 24K for silver
        weightGrams: weight_grams || 0,
        makingCharge: makingCharge!,
        makingChargeType: making_charge_type as 'percent' | 'flat',
        gstPercent: gst_percent,
        materialType: material_type as 'gold' | 'silver' | 'platinum',
      });
      isAutoCalculated = true;
      goldPriceUsedValue = usedMetalPrice;
    }

    // Build insert object - festival_id is now available after migration
    const insertData: Record<string, unknown> = {
      name,
      category_id: category_id || null, // Ensure category_id is null if empty
      description,
      hallmark_certified,
      availability,
      status,
      image_urls,
      offer_id,
      purity_carats: material_type === 'gold' ? purity_carats : null, // Only store purity for gold
      weight_grams,
      making_charge_percent,
      making_charge_flat,
      making_charge_type,
      certifications: certifications || null,
      price: finalPrice,
      price_auto_calculated: isAutoCalculated,
      gold_price_used: goldPriceUsedValue,
      // New fields
      material_type,
      gst_percent,
      net_weight_grams,
    };

    // Only include certifications if it's not null
    if (certifications !== null) {
      insertData.certifications = certifications;
    }

    // Include festival_id if provided
    if (festival_id) {
      insertData.festival_id = festival_id;
    }

    let result = await supabase
      .from("products")
      .insert(insertData)
      .select()
      .single();
    
    // If insert fails due to missing festival_id column, try without it
    if (result.error && (result.error.code === '42703' || result.error.message?.includes('column') || result.error.message?.includes('festival_id'))) {
      console.warn('[API] Insert failed due to festival_id column, retrying without it:', result.error);
      delete insertData.festival_id;
      
      result = await supabase
        .from("products")
        .insert(insertData)
        .select()
        .single();
    }
    
    const { data, error } = result;
    
    if (error) {
      console.error('[API] Insert failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return serverError(error.message, {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
    
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /api/admin/products CATCH BLOCK ERROR:', error);
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
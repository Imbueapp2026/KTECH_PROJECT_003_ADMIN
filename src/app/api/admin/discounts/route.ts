/**
 * GET  /api/admin/discounts — list (filterable by offer_id)
 * POST /api/admin/discounts — create
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  parsePagination,
  serverError,
  unauthorized,
  asEnum,
  asNumber,
  asUuid,
} from "@/lib/http";
import type { DiscountType } from "@/lib/data/types";

const TYPES = ["percentage", "flat", "making_charge"] as const;

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const offerId = asUuid(url.searchParams.get("offer_id"));
  const supabase = getServiceClient();
  let query = supabase
    .from("discounts")
    .select("id, offer_id, discount_type, value", { count: "exact" })
    .order("created_at", { ascending: false });
  if (offerId) query = query.eq("offer_id", offerId);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return serverError(error);
  return Response.json({ data, pagination: { page, limit, total: count || 0 } });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body =
    (await parseJson<{
      offer_id?: unknown;
      discount_type?: unknown;
      value?: unknown;
    }>(req)) ?? {};
  const offer_id = asUuid(body.offer_id);
  const discount_type = asEnum<DiscountType>(body.discount_type, TYPES);
  const value = asNumber(body.value);
  if (!offer_id) return badRequest("offer_id is required");
  if (!discount_type) return badRequest("discount_type must be percentage|flat|making_charge");
  if (value == null || value < 0) return badRequest("value is required (number)");
  if (discount_type === "percentage" && value > 100)
    return badRequest("percentage cannot exceed 100");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("discounts")
    .insert({ offer_id, discount_type, value })
    .select()
    .single();
  if (error) {
    // 23514 = check constraint violation — DB enum doesn't include making_charge yet
    if (error.code === "23514" || error.code === "23P01" || error.code === "22P02") {
      return Response.json(
        {
          error:
            "Database enum error: the 'discount_type' PostgreSQL ENUM does not yet include 'making_charge'. " +
            "Run this SQL once in your Supabase SQL editor:\n\n" +
            "ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'making_charge';\n\n" +
            "Then retry creating the offer.",
          sql_fix: "ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'making_charge';",
        },
        { status: 422 },
      );
    }
    return serverError(error);
  }
  return Response.json({ data }, { status: 201 });
}
/**
 * GET  /api/admin/offers — list
 * POST /api/admin/offers — create
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
  asString,
} from "@/lib/http";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const supabase = getServiceClient();
  const { data, error, count } = await supabase
    .from("offers")
    .select(
      "id, label, description, is_active, start_date, end_date, created_at, discounts(id, discount_type, value)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return serverError(error);
  return Response.json({ data, pagination: { page, limit, total: count || 0 } });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body =
    (await parseJson<{
      label?: unknown;
      description?: unknown;
      is_active?: unknown;
      start_date?: unknown;
      end_date?: unknown;
    }>(req)) ?? {};
  const label = asString(body.label, 200);
  const description =
    body.description == null ? null : asString(body.description, 1000);
  const is_active = asBool(body.is_active) ?? true;
  const start_date = body.start_date == null ? null : asString(body.start_date, 10);
  const end_date = body.end_date == null ? null : asString(body.end_date, 10);
  if (!label) return badRequest("label is required");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("offers")
    .insert({ label, description, is_active, start_date, end_date })
    .select()
    .single();
  if (error) return serverError(error);
  return Response.json({ data }, { status: 201 });
}
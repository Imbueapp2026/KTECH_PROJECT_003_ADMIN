/**
 * GET  /api/admin/categories — list
 * POST /api/admin/categories — create
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  parsePagination,
  serverError,
  unauthorized,
  asString,
} from "@/lib/http";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const supabase = getServiceClient();
  const { data, error, count } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, is_system, created_at, products(count)", { count: "exact" })
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return serverError(error);
  return Response.json({ data, pagination: { page, limit, total: count || 0 } });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await parseJson<{ name?: unknown; slug?: unknown }>(req)) ?? {};
  const name     = asString(body.name, 100);
  const slug     = asString(body.slug, 100)?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (!name) return badRequest("name is required");
  if (!slug) return badRequest("slug is required");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, slug })
    .select()
    .single();
  if (error) return serverError(error);
  return Response.json({ data }, { status: 201 });
}
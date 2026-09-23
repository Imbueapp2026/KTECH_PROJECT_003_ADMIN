/**
 * GET  /api/admin/inquiries — list (filterable by status)
 * POST /api/admin/inquiries — not exposed (public posts via /api/inquiries, anon-insert per RLS)
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  parsePagination,
  serverError,
  unauthorized,
  asEnum,
} from "@/lib/http";
import type { InquiryStatus } from "@/lib/data/types";

const STATUS = ["new", "contacted", "resolved"] as const;

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const url = new URL(req.url);
  const { page, limit, offset } = parsePagination(url);
  const status = asEnum<InquiryStatus>(url.searchParams.get("status"), STATUS);
  const supabase = getServiceClient();
  let query = supabase
    .from("inquiries")
    .select(
      "id, name, phone, email, message, product_id, source_page, status, created_at, product:products(id, name, image_urls)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return serverError(error);
  return Response.json({ data, pagination: { page, limit, total: count || 0 } });
}
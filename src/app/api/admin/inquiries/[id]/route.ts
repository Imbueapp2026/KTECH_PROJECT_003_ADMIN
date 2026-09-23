/**
 * PATCH /api/admin/inquiries/[id] — update status (new → open → closed)
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  notFound,
  parseJson,
  serverError,
  unauthorized,
  asEnum,
  asUuid,
} from "@/lib/http";
import type { InquiryStatus } from "@/lib/data/types";

const STATUS = ["new", "contacted", "resolved"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");
  const body = (await parseJson<{ status?: unknown }>(req)) ?? {};
  const status = asEnum<InquiryStatus>(body.status, STATUS);
  if (!status) return badRequest("status must be new|contacted|resolved");

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("inquiries")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
}
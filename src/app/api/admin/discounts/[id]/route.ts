/**
 * PATCH  /api/admin/discounts/[id]
 * DELETE /api/admin/discounts/[id]
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
  asNumber,
  asUuid,
} from "@/lib/http";
import type { DiscountType } from "@/lib/data/types";

const TYPES = ["percentage", "flat"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");
  const body =
    (await parseJson<{
      discount_type?: unknown;
      value?: unknown;
    }>(req)) ?? {};
  const patch: Record<string, unknown> = {};
  
  // Fetch current discount for cross-field validation
  const supabase = getServiceClient();
  const { data: current, error: fetchError } = await supabase
    .from("discounts")
    .select("discount_type, value")
    .eq("id", id)
    .single();
  if (fetchError) {
    if (fetchError.code === "PGRST116") return notFound();
    return serverError(fetchError);
  }

  if (body.discount_type !== undefined) {
    const v = asEnum<DiscountType>(body.discount_type, TYPES);
    if (!v) return badRequest("discount_type invalid");
    patch.discount_type = v;
  }
  if (body.value !== undefined) {
    const v = asNumber(body.value);
    if (v == null || v < 0) return badRequest("value invalid");
    patch.value = v;
  }

  // Cross-field validation: percentage cannot exceed 100
  const discountType = (patch.discount_type as DiscountType) ?? current.discount_type;
  const value = patch.value !== undefined ? patch.value : current.value;
  if (discountType === "percentage" && Number(value) > 100) {
    return badRequest("percentage cannot exceed 100");
  }

  const { data, error } = await supabase
    .from("discounts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const supabase = getServiceClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) return serverError(error);
  return Response.json({ ok: true });
}
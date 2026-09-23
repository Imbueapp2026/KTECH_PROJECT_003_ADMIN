/**
 * PATCH  /api/admin/offers/[id]
 * DELETE /api/admin/offers/[id]
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
  asString,
  asUuid,
} from "@/lib/http";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");
  const body =
    (await parseJson<{
      label?: unknown;
      description?: unknown;
      is_active?: unknown;
      start_date?: unknown;
      end_date?: unknown;
    }>(req)) ?? {};
  const patch: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const v = asString(body.label, 200);
    if (!v) return badRequest("label invalid");
    patch.label = v;
  }
  if (body.description !== undefined) {
    patch.description =
      body.description == null ? null : asString(body.description, 1000);
  }
  if (body.is_active !== undefined) {
    const v = asBool(body.is_active);
    if (v === null) return badRequest("is_active must be boolean");
    patch.is_active = v;
  }
  if (body.start_date !== undefined) {
    patch.start_date =
      body.start_date == null ? null : asString(body.start_date, 10);
  }
  if (body.end_date !== undefined) {
    patch.end_date =
      body.end_date == null ? null : asString(body.end_date, 10);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("offers")
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

  // Use Supabase RPC for transactional delete
  // This ensures all operations succeed or fail together
  const { error } = await supabase.rpc("delete_offer_cascade", { offer_id: id });
  
  if (error) {
    // Fallback to sequential operations if RPC doesn't exist
    // Clear references on products, then delete discounts attached to this offer,
    // then delete the offer itself.
    const { error: clearErr } = await supabase
      .from("products")
      .update({ offer_id: null })
      .eq("offer_id", id);
    if (clearErr) return serverError(clearErr);

    const { error: disErr } = await supabase
      .from("discounts")
      .delete()
      .eq("offer_id", id);
    if (disErr) return serverError(disErr);

    const { error: delErr } = await supabase.from("offers").delete().eq("id", id);
    if (delErr) return serverError(delErr);
  }

  return Response.json({ ok: true });
}
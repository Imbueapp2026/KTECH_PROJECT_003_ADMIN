/**
 * POST /api/admin/offers/[id]/apply-all  — set offer_id on ALL products
 * DELETE /api/admin/offers/[id]/apply-all — clear offer_id from all products in this offer
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { badRequest, serverError, unauthorized, asUuid } from "@/lib/http";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const supabase = getServiceClient();

  // Verify the offer exists
  const { error: offerErr } = await supabase
    .from("offers")
    .select("id")
    .eq("id", id)
    .single();
  if (offerErr) return badRequest("offer not found");

  // Apply this offer to ALL published/draft products that don't already have a different offer
  const { data, error } = await supabase
    .from("products")
    .update({ offer_id: id })
    .in("status", ["published", "draft"])
    .select("id");

  if (error) return serverError(error);

  return Response.json({ ok: true, updated: data?.length ?? 0 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const supabase = getServiceClient();

  // Remove this offer from all products that have it
  const { data, error } = await supabase
    .from("products")
    .update({ offer_id: null })
    .eq("offer_id", id)
    .select("id");

  if (error) return serverError(error);

  return Response.json({ ok: true, updated: data?.length ?? 0 });
}

/**
 * POST /api/admin/offers/[id]/apply-all  — set offer_id on ALL products
 * DELETE /api/admin/offers/[id]/apply-all — clear offer_id from all products in this offer
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { applyOfferAssignment, clearOfferAssignments, OfferAssignmentError, prepareOfferAssignment } from "@/lib/offer-assignment-admin";
import { badRequest, parseJson, serverError, unauthorized, asUuid } from "@/lib/http";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const body = (await parseJson<{ confirmOverride?: unknown }>(req)) ?? {};
  if (body.confirmOverride !== undefined && typeof body.confirmOverride !== "boolean") {
    return badRequest("confirmOverride must be boolean");
  }

  try {
    const supabase = getServiceClient();
    const plan = await prepareOfferAssignment(supabase, id);
    const result = await applyOfferAssignment(supabase, plan, body.confirmOverride === true);
    return Response.json(body.confirmOverride === true ? { ok: true, ...result } : result);
  } catch (error) {
    if (error instanceof OfferAssignmentError) return badRequest(error.message);
    return serverError(error);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  try {
    const updated = await clearOfferAssignments(getServiceClient(), id);
    return Response.json({ ok: true, updated });
  } catch (error) {
    if (error instanceof OfferAssignmentError) return badRequest(error.message);
    return serverError(error);
  }
}

import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { applyOfferAssignment, OfferAssignmentError, prepareOfferAssignment } from "@/lib/offer-assignment-admin";
import { asUuid, badRequest, parseJson, serverError, unauthorized } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  if (!(await requireAdmin(req))) return unauthorized();
  const offerId = asUuid((await context.params).id);
  if (!offerId) return badRequest("Invalid offer id");

  const body = await parseJson<{ productIds?: unknown; confirmOverride?: unknown }>(req);
  if (!body || !Array.isArray(body.productIds) || !body.productIds.length) {
    return badRequest("productIds must be a non-empty array");
  }
  const productIds = body.productIds.map(asUuid);
  if (productIds.some((productId) => !productId)) return badRequest("Invalid product id");
  if (body.confirmOverride !== undefined && typeof body.confirmOverride !== "boolean") {
    return badRequest("confirmOverride must be boolean");
  }

  try {
    const supabase = getServiceClient();
    const plan = await prepareOfferAssignment(supabase, offerId, productIds as string[]);
    const result = await applyOfferAssignment(supabase, plan, body.confirmOverride === true);
    return Response.json(body.confirmOverride === true ? { ok: true, ...result } : result);
  } catch (error) {
    if (error instanceof OfferAssignmentError) return badRequest(error.message);
    return serverError(error);
  }
}
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { recomputeAllOfferPrices } from "@/lib/offer-price-admin";
import { serverError, unauthorized } from "@/lib/http";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`);
  if (!cronAuthorized && !(await requireAdmin(req))) {
    return unauthorized();
  }

  try {
    const result = await recomputeAllOfferPrices(getServiceClient());
    if (result.error) return serverError(result.error);
    return Response.json({ ok: true, updated: result.updated });
  } catch (error) {
    return serverError(error);
  }
}
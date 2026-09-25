import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { asBool, asString, asUuid, badRequest, parseJson, serverError, unauthorized } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  if (!(await requireAdmin(req))) return unauthorized();

  const offerId = asUuid((await context.params).id);
  if (!offerId) return badRequest("Invalid offer id");
  const body = (await parseJson<{
    product_id?: unknown;
    image_url?: unknown;
    alt_text?: unknown;
    is_active?: unknown;
    display_order?: unknown;
  }>(req)) ?? {};
  const productId = body.product_id == null ? null : asUuid(body.product_id);
  const imageUrl = asString(body.image_url, 2000);
  const altText = asString(body.alt_text, 200);
  const displayOrder = typeof body.display_order === "number" && Number.isInteger(body.display_order)
    ? body.display_order
    : 0;
  const isActive = asBool(body.is_active) ?? true;

  if (!imageUrl || !altText) {
    return badRequest("image_url and alt_text are required");
  }
  if (displayOrder < 0) return badRequest("display_order must be non-negative");

  const supabase = getServiceClient();
  const { data: offer } = await supabase.from("offers").select("id").eq("id", offerId).maybeSingle();
  if (!offer) return badRequest("Offer not found");
  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("status", "published")
      .maybeSingle();
    if (!product) return badRequest("Product must be published");
  }

  const { data, error } = await supabase
    .from("offer_banners")
    .upsert({ offer_id: offerId, product_id: productId ?? null, image_url: imageUrl, alt_text: altText, is_active: isActive, display_order: displayOrder }, { onConflict: "offer_id" })
    .select("id, offer_id, product_id, image_url, alt_text, is_active, display_order, created_at, updated_at")
    .single();
  if (error) return serverError(error);
  return Response.json({ data });
}

export async function DELETE(req: Request, context: RouteContext) {
  if (!(await requireAdmin(req))) return unauthorized();
  const offerId = asUuid((await context.params).id);
  if (!offerId) return badRequest("Invalid offer id");
  const { error } = await getServiceClient().from("offer_banners").delete().eq("offer_id", offerId);
  if (error) return serverError(error);
  return new Response(null, { status: 204 });
}
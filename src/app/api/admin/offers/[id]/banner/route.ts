import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { asBool, asString, asUuid, badRequest, parseJson, serverError, unauthorized } from "@/lib/http";
import { deleteOfferBanner, OfferBannerInputError, saveOfferBanner } from "@/lib/offer-banner-admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  if (!(await requireAdmin(req))) return unauthorized();

  const offerId = asUuid((await context.params).id);
  if (!offerId) return badRequest("Invalid offer id");

  const isMultipart = req.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  let body: Record<string, unknown> = {};
  let file: File | null = null;
  if (isMultipart) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Invalid multipart form data");
    }
    const rawFile = formData.get("file");
    if (rawFile !== null && !(rawFile instanceof File)) return badRequest("Invalid banner image");
    file = rawFile;
    body = Object.fromEntries(formData.entries());
  } else {
    body = (await parseJson<Record<string, unknown>>(req)) ?? {};
  }

  const productValue = body.product_id;
  const productId = productValue == null || productValue === "" ? null : asUuid(productValue);
  if (productValue != null && productValue !== "" && !productId) return badRequest("Invalid product id");
  const altText = asString(body.alt_text, 200);
  if (!altText) return badRequest("alt_text is required");

  let displayOrder = 0;
  if (body.display_order !== undefined && body.display_order !== null && body.display_order !== "") {
    displayOrder = typeof body.display_order === "number"
      ? body.display_order
      : typeof body.display_order === "string" && /^\d+$/.test(body.display_order)
        ? Number(body.display_order)
        : Number.NaN;
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return badRequest("display_order must be a non-negative integer");
    }
  }

  let isActive = true;
  if (typeof body.is_active === "boolean") {
    isActive = body.is_active;
  } else if (body.is_active === "true" || body.is_active === "false") {
    isActive = body.is_active === "true";
  } else if (body.is_active !== undefined && body.is_active !== null && body.is_active !== "") {
    const parsed = asBool(body.is_active);
    if (parsed === null) return badRequest("is_active must be boolean");
    isActive = parsed;
  }

  const supabase = getServiceClient();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id")
    .eq("id", offerId)
    .maybeSingle();
  if (offerError) return serverError(offerError);
  if (!offer) return badRequest("Offer not found");
  if (productId) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("status", "published")
      .maybeSingle();
    if (productError) return serverError(productError);
    if (!product) return badRequest("Product must be published");
  }

  try {
    const data = await saveOfferBanner(supabase, {
      offerId,
      productId,
      file,
      altText,
      isActive,
      displayOrder,
    });
    return Response.json({ data });
  } catch (error) {
    if (error instanceof OfferBannerInputError) return badRequest(error.message);
    return serverError(error);
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  if (!(await requireAdmin(req))) return unauthorized();
  const offerId = asUuid((await context.params).id);
  if (!offerId) return badRequest("Invalid offer id");
  try {
    await deleteOfferBanner(getServiceClient(), offerId);
  } catch (error) {
    return serverError(error);
  }
  return new Response(null, { status: 204 });
}
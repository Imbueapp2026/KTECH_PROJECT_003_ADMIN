/**
 * GET    /api/admin/festivals/[id]/products       — get products in festival
 * POST   /api/admin/festivals/[id]/products       — add product to festival
 * DELETE /api/admin/festivals/[id]/products       — remove product from festival
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  serverError,
  unauthorized,
  notFound,
  asUuid,
} from "@/lib/http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const supabase = getServiceClient();
  const url = new URL(req.url);
  const source = url.searchParams.get("source"); // 'offer', 'manual', or 'all'

  // Build query based on source filter
  let query = supabase
    .from("products")
    .select(`
      id,
      name,
      category_id,
      offer_id,
      festival_id,
      status,
      image_urls,
      price,
      categories(id, name)
    `)
    .eq("festival_id", id)
    .order("updated_at", { ascending: false });

  // Filter by source if specified
  if (source === 'offer') {
    query = query.not("offer_id", "is", null);
  } else if (source === 'manual') {
    query = query.is("offer_id", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[API] Failed to fetch festival products:', error);
    return serverError(error);
  }

  // Transform response to match expected type and add source flag
  const transformedData = data?.map((item: Record<string, unknown>) => ({
    ...item,
    category: Array.isArray(item.categories) ? item.categories[0] : item.categories || null,
    categories: undefined,
    source: item.offer_id ? 'offer' : 'manual',
  })) || [];

  return Response.json({ data: transformedData });
}

interface AddProductBody {
  product_id?: unknown;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid festival id");

  const body = (await parseJson<AddProductBody>(req)) ?? {};
  const product_id = asUuid(body.product_id);
  
  if (!product_id) return badRequest("product_id is required");

  const supabase = getServiceClient();

  // Check if festival exists
  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("id")
    .eq("id", id)
    .single();

  if (festivalError || !festival) {
    return notFound();
  }

  // Check if product exists
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", product_id)
    .single();

  if (productError || !product) {
    return badRequest("product not found");
  }

  // Add product to festival
  const { data, error } = await supabase
    .from("products")
    .update({ 
      festival_id: id,
      updated_at: new Date().toISOString()
    })
    .eq("id", product_id)
    .select("id, festival_id")
    .single();

  if (error) {
    console.error('[API] Failed to add product to festival:', error);
    return serverError(error);
  }

  return Response.json({ data }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid festival id");

  const url = new URL(req.url);
  const product_id = url.searchParams.get("product_id");
  
  if (!product_id || !asUuid(product_id)) return badRequest("valid product_id is required");

  const supabase = getServiceClient();

  // Remove product from festival (set festival_id to null)
  const { data, error } = await supabase
    .from("products")
    .update({ 
      festival_id: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", product_id)
    .eq("festival_id", id) // Ensure product is actually in this festival
    .select("id, festival_id")
    .single();

  if (error) {
    console.error('[API] Failed to remove product from festival:', error);
    return serverError(error);
  }

  if (!data) {
    return badRequest("product not found in this festival");
  }

  return Response.json({ data });
}
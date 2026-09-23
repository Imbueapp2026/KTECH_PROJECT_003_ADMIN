/**
 * GET /api/admin/banners - Get all banner items
 * POST /api/admin/banners - Create new banner item
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { badRequest, serverError, unauthorized } from "@/lib/http";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();

  try {
    const supabase = getServiceClient();
    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    let query = supabase
      .from("products")
      .select("id, name, image_urls, price, is_limited, banner_priority, status, availability")
      .order("banner_priority", { ascending: false });

    if (type === "limited") {
      query = query.eq("is_limited", true);
    }

    const { data: products, error } = await query;

    if (error) return serverError(error);

    // Get featured categories
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, name, slug, icon_svg, is_featured, banner_priority")
      .order("banner_priority", { ascending: false });

    if (catError) return serverError(catError);

    return Response.json({
      products: products || [],
      categories: categories || []
    });
  } catch (error) {
    console.error('[API] GET /api/admin/banners error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();

  try {
    const body = await req.json();
    const { type, id, is_featured, is_limited, banner_priority } = body;

    if (!type || !id) {
      return badRequest("type and id are required");
    }

    const supabase = getServiceClient();

    if (type === "category") {
      const { data, error } = await supabase
        .from("categories")
        .update({ 
          is_featured: is_featured !== undefined ? is_featured : true,
          banner_priority: banner_priority || 0
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return serverError(error);
      return Response.json({ data });
    } else if (type === "product") {
      const { data, error } = await supabase
        .from("products")
        .update({ 
          is_limited: is_limited !== undefined ? is_limited : true,
          banner_priority: banner_priority || 0
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return serverError(error);
      return Response.json({ data });
    }

    return badRequest("Invalid type. Must be 'category' or 'product'");
  } catch (error) {
    console.error('[API] POST /api/admin/banners error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

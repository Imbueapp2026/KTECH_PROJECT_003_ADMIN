/**
 * GET    /api/admin/categories/[id]
 * PATCH  /api/admin/categories/[id]
 * DELETE /api/admin/categories/[id]
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  notFound,
  parseJson,
  serverError,
  unauthorized,
  asString,
  asUuid,
} from "@/lib/http";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin(req))) return unauthorized();
    const { id } = await params;
    if (!asUuid(id)) return badRequest("invalid id");

    console.log("Fetching category:", id);
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, icon_svg, sort_order, is_system, created_at")
      .eq("id", id)
      .maybeSingle();
    
    console.log("Category query result:", { data, error });
    
    if (error) {
      console.error("Category fetch error:", error);
      return serverError(error);
    }
    
    if (!data) {
      return notFound();
    }
    
    return Response.json({ data });
  } catch (error) {
    console.error("Unexpected error in category GET:", error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");
  const body = (await parseJson<{ name?: unknown; slug?: unknown; icon_url?: unknown; icon_svg?: unknown; sort_order?: unknown }>(req)) ?? {};
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const v = asString(body.name, 100);
    if (!v) return badRequest("name invalid");
    patch.name = v;
  }
  if (body.slug !== undefined) {
    const v = asString(body.slug, 100);
    patch.slug = v?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  if (body.icon_svg !== undefined) {
    patch.icon_svg = body.icon_svg == null ? null : asString(body.icon_svg, 8000);
  }
  if (body.sort_order !== undefined) {
    patch.sort_order = Number(body.sort_order);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    console.error("Category update error:", error);
    return serverError(error);
  }
  if (!data) {
    return notFound();
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
  // Check for products referencing this category; refuse if any are non-archived.
  const { count, error: countErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .neq("status", "archived");
  if (countErr) return serverError(countErr);
  if ((count ?? 0) > 0) {
    return Response.json(
      {
        error: "conflict",
        message: `Cannot delete: ${count} non-archived product(s) reference this category.`,
      },
      { status: 409 },
    );
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return serverError(error);
  return Response.json({ ok: true });
}
/**
 * GET    /api/admin/festivals/[id]       — get single festival
 * PATCH  /api/admin/festivals/[id]       — update festival
 * DELETE /api/admin/festivals/[id]       — end/delete festival
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  serverError,
  unauthorized,
  notFound,
  asBool,
  asString,
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
  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  return Response.json({ data });
}

interface FestivalUpdateBody {
  name?: unknown;
  description?: unknown;
  image_url?: unknown;
  date?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: unknown;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauthorized();
  const { id } = await params;
  if (!asUuid(id)) return badRequest("invalid id");

  const body = (await parseJson<FestivalUpdateBody>(req)) ?? {};
  
  const name = body.name == null ? null : asString(body.name, 200);
  const description = body.description == null ? null : asString(body.description, 5000);
  const image_url = body.image_url == null ? null : asString(body.image_url, 1000);
  const date = body.date == null ? null : asString(body.date, 100);
  const start_date = body.start_date == null ? null : asString(body.start_date, 100);
  const end_date = body.end_date == null ? null : asString(body.end_date, 100);
  const is_active = body.is_active == null ? null : asBool(body.is_active);

  // Validate date range if both are provided
  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    return badRequest("end_date must be after or equal to start_date");
  }

  const supabase = getServiceClient();
  
  // If setting this festival as active, deactivate all other festivals
  if (is_active === true) {
    await supabase.from("festivals").update({ is_active: false }).neq("id", id);
  }

  const updateData: Record<string, unknown> = {};
  if (name != null) updateData.name = name;
  if (description != null) updateData.description = description;
  if (image_url != null) updateData.image_url = image_url;
  if (date != null) updateData.date = date;
  if (start_date != null) updateData.start_date = start_date;
  if (end_date != null) updateData.end_date = end_date;
  if (is_active != null) updateData.is_active = is_active;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("festivals")
    .update(updateData)
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

  // First, remove festival_id from all products that have this festival
  const { error: productUpdateError } = await supabase
    .from("products")
    .update({ festival_id: null })
    .eq("festival_id", id);

  if (productUpdateError) {
    console.error('[API] Failed to remove festival from products:', productUpdateError);
    return serverError("Failed to remove festival from products");
  }

  // Then, set the festival as inactive (soft delete)
  const { data, error } = await supabase
    .from("festivals")
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id, is_active")
    .single();

  if (error) {
    if (error.code === "PGRST116") return notFound();
    return serverError(error);
  }
  
  return Response.json({ data });
}
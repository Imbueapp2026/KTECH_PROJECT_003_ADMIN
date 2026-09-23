/**
 * GET  /api/admin/festivals       — list all festivals
 * POST /api/admin/festivals       — create new festival
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import {
  badRequest,
  parseJson,
  serverError,
  unauthorized,
  asBool,
  asString,
} from "@/lib/http";

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return unauthorized();

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("festivals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error('[API] GET /api/admin/festivals error:', error);
      // If table doesn't exist yet, return empty array
      if (error.code === '42P01') {
        return Response.json({ data: [] });
      }
      return serverError(error);
    }
    
    // Always return data as array, even if null
    return Response.json({ data: data || [] });
  } catch (error) {
    console.error('[API] GET /api/admin/festivals error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

interface FestivalBody {
  name?: unknown;
  description?: unknown;
  image_url?: unknown;
  date?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: unknown;
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body = (await parseJson<FestivalBody>(req)) ?? {};
  
  const name = asString(body.name, 200);
  const description = asString(body.description, 5000) ?? null;
  const image_url = asString(body.image_url, 1000) ?? null;
  const date = asString(body.date, 100) ?? null;
  const start_date = body.start_date == null ? null : asString(body.start_date, 100);
  const end_date = body.end_date == null ? null : asString(body.end_date, 100);
  const is_active = asBool(body.is_active) ?? false;

  // Validation
  if (!name) return badRequest("name is required");
  
  // Validate date range
  if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
    return badRequest("end_date must be after or equal to start_date");
  }

  const supabase = getServiceClient();
  
  // If setting this festival as active, deactivate all other festivals
  if (is_active) {
    await supabase.from("festivals").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data, error } = await supabase
    .from("festivals")
    .insert({
      name,
      description,
      image_url,
      date,
      start_date,
      end_date,
      is_active,
    })
    .select()
    .single();

  if (error) return serverError(error);
  return Response.json({ data }, { status: 201 });
}

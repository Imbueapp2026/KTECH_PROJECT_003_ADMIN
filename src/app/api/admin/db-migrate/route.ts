/**
 * POST /api/admin/db-migrate — run one-time database schema patches.
 * 
 * Supported patches:
 *   - "discount_type_making_charge": adds 'making_charge' to the discounts CHECK constraint
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { badRequest, unauthorized } from "@/lib/http";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json().catch(() => ({})) as { patch?: string };
  const patch = body.patch;

  if (!patch) return badRequest("patch name is required");

  const supabase = getServiceClient();

  if (patch === "discount_type_making_charge") {
    // Add 'making_charge' to the discount_type PostgreSQL ENUM
    const { error } = await supabase.rpc("run_sql", {
      query: "ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'making_charge';",
    }).single();

    if (error) {
      return Response.json(
        {
          ok: false,
          message: "Could not auto-apply. Please run this SQL manually in your Supabase SQL editor:",
          sql: "ALTER TYPE discount_type ADD VALUE IF NOT EXISTS 'making_charge';",
        },
        { status: 422 },
      );
    }

    return Response.json({ ok: true, message: "discount_type enum updated with 'making_charge'." });
  }

  return badRequest(`Unknown patch: ${patch}`);
}

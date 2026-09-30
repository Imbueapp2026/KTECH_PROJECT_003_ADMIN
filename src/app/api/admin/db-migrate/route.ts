/**
 * POST /api/admin/db-migrate — run one-time database schema patches.
 * 
 * Supported patches:
 *   - "discount_type_making_charge": adds 'making_charge' to the discounts CHECK constraint
 */
import { requireAdmin } from "@/lib/firebase-admin";
import { getServiceClient } from "@/lib/supabase";
import { badRequest, serverError, unauthorized } from "@/lib/http";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();

  const body = await req.json().catch(() => ({})) as { patch?: string };
  const patch = body.patch;

  if (!patch) return badRequest("patch name is required");

  const supabase = getServiceClient();

  if (patch === "discount_type_making_charge") {
    // Drop the old CHECK constraint and recreate with making_charge included
    const { error } = await supabase.rpc("run_sql", {
      query:
        "ALTER TABLE discounts DROP CONSTRAINT IF EXISTS discounts_discount_type_check; " +
        "ALTER TABLE discounts ADD CONSTRAINT discounts_discount_type_check " +
        "CHECK (discount_type IN ('percentage', 'flat', 'making_charge'));",
    }).single();

    if (error) {
      // Supabase may not expose raw SQL RPC — return the SQL for manual execution
      return Response.json(
        {
          ok: false,
          message: "Could not auto-apply. Please run this SQL manually in your Supabase SQL editor:",
          sql:
            "ALTER TABLE discounts DROP CONSTRAINT IF EXISTS discounts_discount_type_check;\n" +
            "ALTER TABLE discounts ADD CONSTRAINT discounts_discount_type_check " +
            "CHECK (discount_type IN ('percentage', 'flat', 'making_charge'));",
        },
        { status: 422 },
      );
    }

    return Response.json({ ok: true, message: "discount_type_making_charge constraint updated." });
  }

  return badRequest(`Unknown patch: ${patch}`);
}

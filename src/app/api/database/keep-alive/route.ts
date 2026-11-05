import "server-only";

import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight database heartbeat used by the Vercel cron job.
 * A real query keeps Supabase project compute active without writing data.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${cronSecret}`) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("categories").select("id").limit(1);

    if (error) {
      console.error("[database keep-alive] Supabase query failed", error);
      return Response.json(
        { ok: false, error: "Database query failed", timestamp: new Date().toISOString() },
        { status: 503 },
      );
    }

    return Response.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[database keep-alive] Unexpected error", error);
    return Response.json(
      { ok: false, error: "Database keep-alive failed", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}

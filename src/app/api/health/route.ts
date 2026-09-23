/**
 * GET /api/health — health check endpoint
 */
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("categories").select("id").limit(1);
    
    if (error) {
      return Response.json(
        { status: "error", message: "Database connection failed" },
        { status: 503 },
      );
    }

    return Response.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    return Response.json(
      { status: "error", message: "Health check failed" },
      { status: 503 },
    );
  }
}

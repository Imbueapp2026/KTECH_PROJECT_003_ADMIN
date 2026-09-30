/**
 * GET /api/ping — simple health-check / heartbeat used by Firebase auth and uptime monitors.
 */
export async function GET() {
  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}

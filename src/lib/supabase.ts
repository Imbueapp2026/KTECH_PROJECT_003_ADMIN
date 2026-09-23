/**
 * Server-only Supabase clients for the admin app using @supabase/server.
 *
 * Per AGENT_LOG §A.2: the service-role client MUST NEVER be imported from a
 * browser bundle. Use only inside API routes (`app/api/**`) or server actions.
 * Use `requireServerOnly()` as a tripwire at the top of every file that imports
 * this module — if it runs on the client, the build will explode loud, not
 * leak a key silently.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";
let cachedService: SupabaseClient | null = null;
let cachedAnon: SupabaseClient | null = null;

/** Public read-only client (anon key, RLS-enforced). Used for SSR/RSC reads. */
export function getAnonClient(): SupabaseClient {
  if (cachedAnon) return cachedAnon;
  const env = getEnv();
  cachedAnon = createClient(
    env.supabaseUrl,
    env.supabaseAnonKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cachedAnon;
}

/** Service-role client. Server-only. Bypasses RLS — trust boundary is the route. */
export function getServiceClient(): SupabaseClient {
  if (cachedService) return cachedService;
  try {
    const env = getEnv();
    cachedService = createClient(
      env.supabaseUrl,
      env.supabaseServiceKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    return cachedService;
  } catch (error) {
    console.error("[supabase-admin] Service client creation failed:", error);
    console.error("[supabase-admin] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
        serviceKey: process.env.SUPABASE_SECRET_KEY ? 'SET' : 'MISSING'
      }
    });
    throw new Error(`Failed to create Supabase service client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/** Strip server-only keys from anything that might leak to a client bundle. */
export function publicEnv() {
  const env = getEnv();
  return {
    supabaseUrl: env.supabaseUrl,
    supabasePublishableKey: env.supabaseAnonKey,
    firebaseApiKey: env.firebaseApiKey,
    firebaseAuthDomain: env.firebaseAuthDomain,
    firebaseProjectId: env.firebaseProjectId,
  };
}
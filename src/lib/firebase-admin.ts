/**
 * Firebase Admin SDK — server-side session verification for /api/admin/*.
 *
 * Per AGENT_LOG §A.2: every admin API route MUST verify a valid Firebase Auth
 * session before touching Supabase with the service-role key. `requireAdmin`
 * is the single chokepoint — call it at the top of each route handler and
 * return 401 if it returns null.
 *
 * Auth method (PRD §2, TASKS_INITIAL_SETUP §2): email/password. The client
 * signs in via Firebase Auth, gets an ID token, sends it as `Authorization:
 * Bearer <token>`. We verify it here.
 *
 * Credentials:
 *   FIREBASE_PROJECT_ID          — service account project_id
 *   FIREBASE_CLIENT_EMAIL        — service account client_email
 *   FIREBASE_SERVICE_ACCOUNT_KEY — base64 of the service account JSON file
 *                                  (encode with scripts/encode-firebase-key.mjs)
 */
import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length) return getApp();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase admin environment variables in .env. " +
        "Please provide FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  const formattedKey = privateKey.replace(/\\n/g, "\n");

  try {
    app = initializeApp({
      credential: cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: formattedKey,
      }),
    });
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    throw error;
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export type AdminPrincipal = {
  uid: string;
  email: string | null;
  role?: "staff" | "owner";
};

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Verify the Firebase session attached to the request. Returns the principal
 * on success, null on any failure (missing token, expired, revoked, malformed).
 * Use the result as your route's auth gate — do NOT trust the client to claim
 * an admin role via a header or cookie.
 */
export async function requireAdmin(req: Request): Promise<AdminPrincipal | null> {
  const token = extractBearer(req);
  if (!token) {
    console.warn("[auth] 401 — missing token", {
      route: new URL(req.url).pathname,
      ip: req.headers.get("x-forwarded-for") ?? "unknown",
      ts: new Date().toISOString(),
    });
    return null;
  }
  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token, true);
    return { 
      uid: decoded.uid, 
      email: decoded.email ?? null,
      role: decoded.role as "staff" | "owner" | undefined
    };
  } catch (err) {
    console.warn("[auth] 401 — token verification failed", {
      route: new URL(req.url).pathname,
      reason: err instanceof Error ? err.message : "unknown",
      ip: req.headers.get("x-forwarded-for") ?? "unknown",
      ts: new Date().toISOString(),
    });
    return null;
  }
}

/**
 * Require a minimum role for a route handler.
 * Role hierarchy: staff (1) < owner (2)
 * Returns null if the user has the required role, otherwise returns null
 * (same pattern as requireAdmin for consistency).
 */
export async function requireRole(req: Request, minRole: "staff" | "owner"): Promise<AdminPrincipal | null> {
  const principal = await requireAdmin(req);
  if (!principal) return null;
  
  // If no role is set, default to staff (lowest privilege)
  const userRole = principal.role || "staff";
  
  const roleHierarchy: Record<"staff" | "owner", number> = {
    staff: 1,
    owner: 2,
  };
  
  if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
    console.warn("[auth] 403 — insufficient role", {
      route: new URL(req.url).pathname,
      requiredRole: minRole,
      userRole,
      uid: principal.uid,
      ts: new Date().toISOString(),
    });
    return null;
  }
  
  return principal;
}

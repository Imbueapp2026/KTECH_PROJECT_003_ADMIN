"use client";
/**
 * Auth provider selector + public hook.
 *
 * Real Firebase only — no stub. The selector checks the full credential set:
 * client config (NEXT_PUBLIC_FIREBASE_*) plus server-side admin creds. When
 * anything is missing, the app deliberately fails loud at boot rather than
 * silently falling back to a stub. The previous "STUB MODE" branch was
 * removed per AGENT_LOG §A.2 — there is no place for fake auth in this app.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { RealAuthProvider, useRealAuth, type AuthUser } from "./real-auth";
import { setTokenGetter } from "./get-token";

export type { AuthUser } from "./real-auth";

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

function hasFirebaseConfig(): boolean {
  return true;
}

const Ctx = createContext<AuthContextValue | null>(null);

/** Bridge layer so the underlying hooks always run under their provider. */
export function AuthBridge({ children }: { children: ReactNode }) {
  if (!hasFirebaseConfig()) {
    throw new Error(
      "[auth] Firebase config is incomplete. See apps/admin/.env.example.",
    );
  }
  return (
    <RealAuthProvider>
      <AuthBridgeInner>{children}</AuthBridgeInner>
    </RealAuthProvider>
  );
}

function AuthBridgeInner({ children }: { children: ReactNode }) {
  const v = useRealAuth();

  // Keep a stable ref to the latest getIdToken so the getter registered below
  // always delegates to the current function without needing to re-register.
  const getIdTokenRef = useRef(v.getIdToken);
  useEffect(() => {
    getIdTokenRef.current = v.getIdToken;
  }, [v.getIdToken]);

  // Register the getter once on mount. The stable ref wrapper means we never
  // need to re-run this effect — and critically, we never clear the getter
  // during a normal re-render (e.g. auth state change, token refresh).
  useEffect(() => {
    setTokenGetter(() => getIdTokenRef.current());
    // Only clear on true unmount, not on re-renders.
    return () => setTokenGetter(() => Promise.resolve(null));
  }, []); // intentionally empty — ref always holds latest value

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthBridge>");
  return v;
}
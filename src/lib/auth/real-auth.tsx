"use client";
/**
 * Real Firebase Auth provider. Wired by AuthBridge when all required env
 * vars (client + server) are present. Subscribes to onAuthStateChanged so
 * `user` and `loading` stay in sync with the Firebase SDK.
 */
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFirebaseAuth } from "./firebase-client";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

type RealAuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const RealAuthContext = createContext<RealAuthContextValue | null>(null);

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, email: u.email, displayName: u.displayName };
}

export function RealAuthProvider({ children }: { children: ReactNode }) {
  const auth = getFirebaseAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(auth));

  useEffect(() => {
    if (!auth) {
      return;
    }
    
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(toAuthUser(u));
      setLoading(false);
    });
    
    return unsub;
  }, [auth]);

  const value = useMemo<RealAuthContextValue>(
    () => ({
      user,
      loading,
      getIdToken: async () => {
        const u = auth?.currentUser;
        if (!u) return null;
        // Don't force refresh - let Firebase SDK handle token refresh automatically
        // Only force refresh if we explicitly need to (e.g., after a 401 error)
        return u.getIdToken(/* forceRefresh */ false);
      },
      signInWithEmail: async (email, password) => {
        const firebaseAuth = auth || getFirebaseAuth();
        if (!firebaseAuth) {
          throw new Error("Firebase auth client is not initialized.");
        }
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      signOut: async () => {
        const firebaseAuth = auth || getFirebaseAuth();
        if (firebaseAuth) {
          await fbSignOut(firebaseAuth);
        }
      },
      resetPassword: async (email) => {
        if (!auth) throw new Error("Firebase not configured.");
        await sendPasswordResetEmail(auth, email);
      },
    }),
    [user, loading, auth],
  );

  return <RealAuthContext.Provider value={value}>{children}</RealAuthContext.Provider>;
}

export function useRealAuth(): RealAuthContextValue {
  const ctx = useContext(RealAuthContext);
  
  // ponytail: SSR prerender runs the hook without a provider in scope (the
  // provider only mounts under AuthBridge, which is rendered client-side via
  // its own hooks). Fall back to a loading-shaped stub so static pages don't
  // throw — AuthGate handles the redirect on the client.
  if (!ctx) {
    return {
      user: null,
      loading: true,
      getIdToken: async () => null,
      signInWithEmail: async () => {
        throw new Error("Auth not ready.");
      },
      signOut: async () => {},
      resetPassword: async () => {
        throw new Error("Auth not ready.");
      },
    };
  }
  return ctx;
}
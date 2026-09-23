"use client";
/**
 * Firebase Web SDK init (client-side).
 *
 * Real Firebase project config is read from NEXT_PUBLIC_FIREBASE_* env vars.
 * In stub mode (any value missing) the AuthProvider in index.tsx short-circuits
 * to the fake provider — this file is never imported.
 *
 * ponytail: server-only assumption removed; the firebase/app client SDK can
 * safely bundle in the browser (that's how Firebase Auth works). Service-role
 * key handling stays in src/lib/firebase-admin.ts and never reaches the browser.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (cachedApp) return cachedApp;
  
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (getApps().length) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }
  try {
    cachedApp = initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
    });
    return cachedApp;
  } catch (error) {
    console.error("[firebase-client] Firebase initialization failed:", error);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) {
    console.warn("[firebase-client] Cannot get auth - Firebase app not initialized");
    return null;
  }
  try {
    cachedAuth = getAuth(app);
    return cachedAuth;
  } catch (err) {
    console.error("[firebase-client] getAuth failed:", err);
    return null;
  }
}
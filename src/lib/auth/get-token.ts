"use client";
/**
 * Tiny helper that calls the current auth provider's getIdToken. Lives outside
 * the auth module so non-component code (like the api fetch wrapper) can
 * reach the token without dragging in React hooks.
 *
 * The auth provider registers a getter via setTokenGetter; the api wrapper
 * calls it.
 */
type TokenGetter = () => Promise<string | null>;

let getter: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter) {
  getter = fn;
}

export async function getIdToken(): Promise<string | null> {
  if (!getter) {
    if (typeof window !== "undefined") {
      console.warn("[get-token] Token getter not set — AuthBridge may not be mounted.");
    }
    return null;
  }
  return getter();
}
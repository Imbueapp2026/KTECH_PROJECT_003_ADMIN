"use client";

/**
 * Server-side HTTP client for the admin browser.
 *
 * Every admin fetch should go through here so the Firebase ID token is
 * attached to every request and JSON errors are decoded consistently.
 *
 * Per AGENT_LOG §A.2: the service-role key never leaves the server. The
 * browser only ever talks to /api/admin/* routes, which use requireAdmin
 * server-side. This client never imports Supabase.
 */

import { getIdToken } from "@/lib/auth/get-token";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<T> {
  const token = await getIdToken().catch(() => null);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { 
    ...init, 
    headers,
    cache: 'no-store',
    next: { revalidate: 0 }
  });
  
  // Track if we had a token to distinguish between "no auth" vs "expired auth"
  const hadToken = !!token;
  const ct = res.headers.get("content-type") ?? "";
  
  let body: unknown;
  try {
    body = ct.includes("application/json")
      ? await res.json()
      : await res.text();
  } catch {
    body = null;
  }

  // Handle both old and new response formats
  let responseData = body;
  if (body && typeof body === "object") {
    // New standardized format: { data: T, timestamp: string }
    if ("data" in body && "timestamp" in body) {
      responseData = (body as { data: unknown }).data;
    }
    // Old format with pagination: { data: T, pagination: {...} }
    else if ("data" in body && "pagination" in body) {
      // Return the full object to preserve pagination data
      responseData = body;
    }
    // Old format without pagination: { data: T }
    else if ("data" in body) {
      responseData = (body as { data: unknown }).data;
    }
  }

  if (!res.ok) {
    // Handle both old and new error response formats
    let message = res.statusText;
    
    if (body && typeof body === "object") {
      // New standardized error format
      if ("error" in body) {
        message = String((body as { error: unknown }).error);
      }
      // Old format (fallback)
      else if ("message" in body) {
        message = String((body as { message: unknown }).message);
      }
    }

    if (res.status === 401) {
      // Token is invalid/expired — redirect to login only if we had a token
      // If we never had a token, don't redirect - just throw the error
      if (typeof window !== "undefined" && hadToken) {
        window.location.href = "/login?expired=1";
      }
      throw new ApiError(401, "Session expired. Please sign in again.", body);
    }
    throw new ApiError(
      res.status,
      message || `Request failed (${res.status}) for ${path}`,
      body,
    );
  }
  return responseData as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
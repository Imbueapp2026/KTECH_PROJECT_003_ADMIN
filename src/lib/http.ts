/**
 * Standardized HTTP utility functions for API responses
 * Provides consistent error format across all admin endpoints
 */

import { NextResponse } from "next/server";

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
  timestamp: string;
}

export interface SuccessResponse<T> {
  data: T;
  timestamp: string;
}

// Error codes for common scenarios
export enum ErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

function createErrorResponse(
  message: string,
  code: ErrorCode,
  status: number,
  details?: unknown
): NextResponse {
  const error: ErrorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
  };
  
  if (details !== undefined) {
    error.details = details;
  }
  
  // Log error for debugging
  console.error(`[API Error] ${code}: ${message}`, details || '');
  
  return NextResponse.json(error, { status });
}

export function unauthorized(message: string = "Unauthorized") {
  return createErrorResponse(message, ErrorCode.UNAUTHORIZED, 401);
}

export function forbidden(message: string = "Forbidden") {
  return createErrorResponse(message, ErrorCode.FORBIDDEN, 403);
}

export function badRequest(message: string = "Bad request", details?: unknown) {
  return createErrorResponse(message, ErrorCode.BAD_REQUEST, 400, details);
}

export function notFound(message: string = "Resource not found") {
  return createErrorResponse(message, ErrorCode.NOT_FOUND, 404);
}

export function conflict(message: string = "Resource conflict") {
  return createErrorResponse(message, ErrorCode.CONFLICT, 409);
}

export function validationError(message: string = "Validation failed", details?: unknown) {
  return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, 400, details);
}

export function rateLimitExceeded(message: string = "Rate limit exceeded") {
  return createErrorResponse(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429);
}

export function payloadTooLarge(message: string = "Request payload too large") {
  return createErrorResponse(message, ErrorCode.PAYLOAD_TOO_LARGE, 413);
}

export function serverError(err: unknown, details?: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";
  const isDev = process.env.NODE_ENV === "development";
  
  // In development, include the full error details
  const errorDetails = isDev ? {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    originalError: err
  } : undefined;
  
  // Log error for debugging with more context
  console.error("[api/admin] serverError called:", {
    errorMessage: message,
    errorType: err instanceof Error ? err.constructor.name : typeof err,
    isDev,
    additionalDetails: details
  });
  console.error("[api/admin] Full error object:", err);
  
  return createErrorResponse(
    message,
    ErrorCode.INTERNAL_ERROR,
    500,
    details || errorDetails
  );
}

export function serviceUnavailable(message: string = "Service temporarily unavailable") {
  return createErrorResponse(message, ErrorCode.SERVICE_UNAVAILABLE, 503);
}

export function success<T>(data: T, status: number = 200): NextResponse {
  const response: SuccessResponse<T> = {
    data,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response, { status });
}

export function parseJson<T>(req: Request): Promise<T | null> {
  return req
    .json()
    .then((v) => v as T)
    .catch((error) => {
      console.error('[parseJson] Failed to parse JSON:', error);
      return null;
    });
}

export function asString(v: unknown, max = 5000): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function asUuid(v: unknown): string | null {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

export function asBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export function asEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null;
}

export function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
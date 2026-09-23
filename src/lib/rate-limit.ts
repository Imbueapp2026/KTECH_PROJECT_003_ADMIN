/**
 * Simple in-memory rate limiting
 * For production, consider using Redis or a similar distributed cache
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(identifier);
  }

  const currentEntry = rateLimitStore.get(identifier) || {
    count: 0,
    resetTime: now + windowMs,
  };

  if (currentEntry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: currentEntry.resetTime,
    };
  }

  currentEntry.count++;
  rateLimitStore.set(identifier, currentEntry);

  return {
    allowed: true,
    remaining: limit - currentEntry.count,
    resetTime: currentEntry.resetTime,
  };
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return "unknown";
}

/**
 * Rate limit middleware for API routes
 * Returns a Response if rate limited, null otherwise
 */
export async function rateLimit(
  req: Request,
  limit: number = 100,
  windowMs: number = 60000,
): Promise<Response | null> {
  const ip = getClientIp(req);
  const result = checkRateLimit(ip, limit, windowMs);
  
  if (!result.allowed) {
    const resetSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ error: "Too many requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.resetTime.toString(),
          "Retry-After": resetSeconds.toString(),
        },
      },
    );
  }
  
  return null;
}

/**
 * Clean up expired rate limit entries periodically
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

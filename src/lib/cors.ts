/**
 * CORS middleware for API routes
 * Handles Cross-Origin Resource Sharing headers
 */

import { NextResponse } from "next/server";

interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

function isOriginAllowed(origin: string, allowed: string | string[] | ((origin: string) => boolean)): boolean {
  if (typeof allowed === 'string') {
    return origin === allowed;
  }
  if (Array.isArray(allowed)) {
    return allowed.includes(origin);
  }
  if (typeof allowed === 'function') {
    return allowed(origin);
  }
  return false;
}

const getTargetOrigin = (): string | string[] => {
  const envOrigin = process.env.ADMIN_ORIGIN || process.env.NEXT_PUBLIC_ADMIN_URL;
  if (envOrigin) {
    return envOrigin.split(',').map(s => s.trim());
  }
  // In development, allow localhost ports
  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
  }
  return [];
};

export function cors(options: CorsOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allowedOrigins = opts.origin || getTargetOrigin();

  return (req: Request, response?: NextResponse) => {
    const origin = req.headers.get('origin');
    
    // Set Access-Control-Allow-Origin
    if (allowedOrigins === '*') {
      if (response) {
        response.headers.set('Access-Control-Allow-Origin', '*');
      }
    } else if (origin) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        if (response) {
          response.headers.set('Access-Control-Allow-Origin', origin);
        }
      }
    }

    // Set other CORS headers
    if (response) {
      response.headers.set('Access-Control-Allow-Methods', opts.methods?.join(', ') || 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', opts.allowedHeaders?.join(', ') || 'Content-Type, Authorization');
      
      if (opts.credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }
      
      if (opts.maxAge) {
        response.headers.set('Access-Control-Max-Age', opts.maxAge.toString());
      }
    }

    return response;
  };
}

/**
 * Handle preflight OPTIONS requests
 */
export function handlePreflight(req: Request, options: CorsOptions = {}): NextResponse | null {
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    cors(options)(req, response);
    return response;
  }
  return null;
}

/**
 * Wrap a response with CORS headers
 */
export function withCors(response: NextResponse, req: Request, options: CorsOptions = {}): NextResponse {
  cors(options)(req, response);
  return response;
}

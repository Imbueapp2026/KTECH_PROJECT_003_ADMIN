/**
 * GET /api/geoip — Proxy for MaxMind GeoIP API to avoid CORS issues
 * 
 * This server-side route handles MaxMind GeoIP requests with proper authentication
 * and caching to avoid rate limits and keep credentials secure.
 */
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache (for production, consider using Redis or similar)
const geoipCache = new Map<string, { data: Record<string, unknown>; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

function getCacheKey(ip: string): string {
  return `geoip:${ip}`;
}

function getCachedResponse(ip: string): Record<string, unknown> | null {
  const key = getCacheKey(ip);
  const cached = geoipCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Remove expired cache entry
  if (cached) {
    geoipCache.delete(key);
  }
  
  return null;
}

function setCachedResponse(ip: string, data: Record<string, unknown>): void {
  const key = getCacheKey(ip);
  geoipCache.set(key, { data, timestamp: Date.now() });
  
  // Clean up old cache entries periodically
  if (geoipCache.size > 1000) {
    const now = Date.now();
    for (const [cacheKey, value] of geoipCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL) {
        geoipCache.delete(cacheKey);
      }
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the client's IP from the request
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'me';

    // Check cache first
    const cachedResponse = getCachedResponse(ip);
    if (cachedResponse) {
      console.log('[GeoIP] Cache hit for IP:', ip);
      return NextResponse.json(cachedResponse);
    }

    // Get MaxMind credentials from environment variables
    const accountId = process.env.MAXMIND_ACCOUNT_ID;
    const licenseKey = process.env.MAXMIND_LICENSE_KEY;

    if (!accountId || !licenseKey) {
      console.error('[GeoIP] Missing MaxMind credentials');
      return NextResponse.json(
        { error: 'GeoIP service not configured' },
        { status: 500 }
      );
    }

    // Create HTTP Basic Auth header
    const auth = Buffer.from(`${accountId}:${licenseKey}`).toString('base64');

    // Make the request to MaxMind from the server (no CORS issues)
    const response = await fetch(`https://geoip.maxmind.com/geoip/v2.1/country/${ip}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GeoIP] MaxMind API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      return NextResponse.json(
        { error: 'Failed to fetch geo location data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract only the data we need and cache it
    const simplifiedData = {
      country: data.country?.iso_code || null,
      continent: data.continent?.code || null,
      ip: ip,
    };
    
    setCachedResponse(ip, simplifiedData);
    
    console.log('[GeoIP] Successfully fetched and cached data for IP:', ip);
    return NextResponse.json(simplifiedData);
  } catch (error) {
    console.error('[GeoIP] Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

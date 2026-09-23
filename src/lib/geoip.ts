/**
 * Frontend utility for GeoIP lookups using our backend proxy
 * 
 * This provides a clean interface for components that need geo-location data
 * without exposing MaxMind credentials or dealing with CORS issues.
 */

export interface GeoIPResponse {
  country: string | null;
  continent: string | null;
  ip: string;
}

/**
 * Get geo-location data for the current user using our backend proxy
 * This avoids CORS issues and keeps MaxMind credentials secure on the server
 */
export async function getGeoLocation(): Promise<GeoIPResponse> {
  try {
    const response = await fetch('/api/geoip');
    
    if (!response.ok) {
      throw new Error(`GeoIP request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as GeoIPResponse;
  } catch (error) {
    console.error('[GeoIP] Failed to get location:', error);
    // Return default values on error
    return {
      country: null,
      continent: null,
      ip: 'unknown'
    };
  }
}

/**
 * Example usage in a component:
 * 
 * ```tsx
 * import { getGeoLocation } from '@/lib/geoip';
 * 
 * function MyComponent() {
 *   const [location, setLocation] = useState(null);
 *   
 *   useEffect(() => {
 *     getGeoLocation().then(setLocation);
 *   }, []);
 *   
 *   return <div>Your country: {location?.country || 'Unknown'}</div>;
 * }
 * ```
 */
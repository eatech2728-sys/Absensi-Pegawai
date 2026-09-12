/**
 * Utility functions for Geolocation & Geofencing calculations
 */

// Calculate distance between two lat/long points using Haversine formula in meters
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return Math.round(R * c);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'LU' : 'LS';
  const lngDir = lng >= 0 ? 'BT' : 'BB';
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}

const geocodeCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'id, en',
          'User-Agent': 'PresensiPegawaiApp/1.0',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        // Build concise address: road, suburb, city
        const addr = data.address || {};
        const road = addr.road || addr.building || addr.amenity || '';
        const suburb = addr.suburb || addr.neighbourhood || addr.village || '';
        const city = addr.city || addr.town || addr.county || addr.state || '';
        
        const parts = [road, suburb, city].filter(Boolean);
        const shortAddress = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
        geocodeCache.set(cacheKey, shortAddress);
        return shortAddress;
      }
    }
  } catch (err) {
    console.warn('Reverse geocode fallback:', err);
  }

  // Fallback if offline or service unavailable
  const fallback = `Area Koordinat [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  geocodeCache.set(cacheKey, fallback);
  return fallback;
}

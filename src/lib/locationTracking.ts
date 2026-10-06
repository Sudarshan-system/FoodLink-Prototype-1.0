/**
 * Pure business logic and utilities for Live Pickup Location Tracking.
 * Complies with 10-second throttling, 45-minute auto-expiry, and Haversine ETA computation.
 */

export const LOCATION_THROTTLE_MS = 10000; // 10 seconds throttle
export const PICKUP_SESSION_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes safety timeout
export const DEFAULT_URBAN_SPEED_KMH = 22; // Typical urban cargo runner speed (km/h)

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PickupLocation extends Coordinates {
  speed?: number | null;
  heading?: number | null;
  updatedAt: number; // Milliseconds timestamp
}

export interface LivePickupRecord {
  id: string;
  listingId: string;
  donorId: string;
  donorName?: string;
  recipientId: string;
  recipientName?: string;
  courierId: string;
  courierName?: string;
  status: 'active' | 'completed' | 'expired';
  location: PickupLocation;
  startedAt: number;
  expiresAt: number;
  destination?: {
    lat: number;
    lng: number;
    address: string;
    name: string;
  };
}

/**
 * Validates whether enough time has elapsed since the last location update (10 seconds throttle).
 */
export function shouldWriteLocation(
  lastWriteTimestamp: number,
  currentTimestamp: number = Date.now(),
  throttleMs: number = LOCATION_THROTTLE_MS
): boolean {
  if (lastWriteTimestamp <= 0) return true;
  return currentTimestamp - lastWriteTimestamp >= throttleMs;
}

/**
 * Calculates Great-Circle Distance between two coordinates in kilometers using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  // Round to two decimal places
  return Math.round(d * 100) / 100;
}

/**
 * Computes estimated time of arrival (ETA) in minutes based on distance and current/average speed.
 */
export function calculateEtaMinutes(
  distanceKm: number,
  speedKmh?: number | null,
  defaultSpeedKmh: number = DEFAULT_URBAN_SPEED_KMH
): number {
  if (distanceKm <= 0.05) return 0; // Less than 50 meters = arrived

  const effectiveSpeed = speedKmh && speedKmh >= 5 ? speedKmh : defaultSpeedKmh;
  const hours = distanceKm / effectiveSpeed;
  const minutes = Math.round(hours * 60);

  return Math.max(1, minutes);
}

/**
 * Checks whether an active pickup session has exceeded its maximum lifetime (45 minutes).
 */
export function isPickupSessionExpired(
  startedAtMillis: number,
  currentTimestamp: number = Date.now(),
  timeoutMs: number = PICKUP_SESSION_TIMEOUT_MS
): boolean {
  if (!startedAtMillis || startedAtMillis <= 0) return true;
  return currentTimestamp - startedAtMillis >= timeoutMs;
}

/**
 * Formats speed in km/h for display.
 */
export function formatSpeedKmh(speedMps?: number | null): string {
  if (speedMps === null || speedMps === undefined || isNaN(speedMps) || speedMps < 0.5) {
    return '0 km/h';
  }
  const kmh = Math.round(speedMps * 3.6);
  return `${kmh} km/h`;
}

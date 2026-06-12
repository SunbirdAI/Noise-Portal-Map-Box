import type { CoordinateSource } from '../models/sensor';

export interface Coordinates {
  latitude: number;
  longitude: number;
  source: CoordinateSource;
}

const fixedLatitudeKeys = ['latitude', 'lat', 'gps_latitude', 'gps_lat', 'location_latitude'];
const fixedLongitudeKeys = ['longitude', 'lng', 'lon', 'gps_longitude', 'gps_lng', 'gps_lon', 'location_longitude'];
const mobileLatitudeKeys = ['mobile_latitude', 'mobile_lat', 'current_latitude', 'device_latitude'];
const mobileLongitudeKeys = ['mobile_longitude', 'mobile_lng', 'mobile_lon', 'current_longitude', 'device_longitude'];

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);

  if (lat === undefined || lng === undefined) {
    return false;
  }

  if (lat === 0 && lng === 0) {
    return false;
  }

  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function getFirstNumber(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(raw[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

export function extractCoordinates(raw: Record<string, unknown>): Coordinates | undefined {
  const mobileLatitude = getFirstNumber(raw, mobileLatitudeKeys);
  const mobileLongitude = getFirstNumber(raw, mobileLongitudeKeys);

  if (isValidCoordinate(mobileLatitude, mobileLongitude)) {
    return {
      latitude: mobileLatitude!,
      longitude: mobileLongitude!,
      source: 'mobile',
    };
  }

  const fixedLatitude = getFirstNumber(raw, fixedLatitudeKeys);
  const fixedLongitude = getFirstNumber(raw, fixedLongitudeKeys);

  if (isValidCoordinate(fixedLatitude, fixedLongitude)) {
    return {
      latitude: fixedLatitude!,
      longitude: fixedLongitude!,
      source: 'fixed',
    };
  }

  return undefined;
}

import { API_BASE_URL, DEFAULT_API_BASE_URL } from '../../config/env';
import type { AiInference, DeviceInfo, EnvironmentalReading, LocationMetrics, SensorLocation } from '../../models/sensor';
import { ApiError } from './errors';
import {
  extractNextPage,
  normalizeAiInference,
  normalizeDeviceInfo,
  normalizeEnvironmentalReading,
  normalizeLocationMetrics,
  normalizeLocationsResponse,
} from './normalizers';

const REQUEST_TIMEOUT_MS = 12_000;

function resolveUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    if (!/^https?:\/\//i.test(API_BASE_URL)) {
      const url = new URL(pathOrUrl);
      const defaultApiUrl = new URL(DEFAULT_API_BASE_URL);

      if (url.host === defaultApiUrl.host) {
        return `${API_BASE_URL}${url.pathname}${url.search}${url.hash}`;
      }
    }

    return pathOrUrl;
  }

  return `${API_BASE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

async function requestJson<T>(pathOrUrl: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const url = resolveUrl(pathOrUrl);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, url, response.status);
    }

    if (!contentType.includes('application/json')) {
      throw new ApiError('Backend returned a non-JSON response', url, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', url);
    }

    throw new ApiError(error instanceof Error ? error.message : 'Request failed', url);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchAllLocations(): Promise<SensorLocation[]> {
  const locations: SensorLocation[] = [];
  let nextUrl: string | undefined = '/devices/locations/?page=1';
  const seen = new Set<string>();

  while (nextUrl && !seen.has(nextUrl)) {
    seen.add(nextUrl);
    const payload = await requestJson<unknown>(nextUrl);
    locations.push(...normalizeLocationsResponse(payload));
    nextUrl = extractNextPage(payload);
  }

  return locations;
}

export async function fetchLocationMetrics(locationId: string): Promise<LocationMetrics> {
  const encodedLocationId = encodeURIComponent(locationId);
  const payload = await requestJson<unknown>(`/devices/location_metrics/${encodedLocationId}/`);
  return normalizeLocationMetrics(payload);
}

export async function fetchDeviceByName(deviceName: string): Promise<DeviceInfo> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const payload = await requestJson<unknown>(`/devices/devices/by-device-id/${encodedDeviceName}/`);
  return normalizeDeviceInfo(payload);
}

export async function fetchAiInference(deviceName: string): Promise<AiInference | undefined> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const payload = await requestJson<unknown>(`/device_metrics/sound-inference-data/by-device-id/${encodedDeviceName}/`);
  return normalizeAiInference(payload);
}

export async function fetchEnvironmentalReading(deviceName: string): Promise<EnvironmentalReading | undefined> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const payload = await requestJson<unknown>(`/device_metrics/environmental-parameters/by-device-id/${encodedDeviceName}/`);
  return normalizeEnvironmentalReading(payload);
}

export async function fetchAnalysis(): Promise<unknown> {
  return requestJson<unknown>('/analysis');
}

import { API_BASE_URL, DEFAULT_API_BASE_URL } from '../../config/env';
import type {
  AiInference,
  DeviceInfo,
  EnvironmentalReading,
  LocationMetrics,
  NoiseMetric,
  PaginatedData,
  SensorLocation,
} from '../../models/sensor';
import { ApiError } from './errors';
import {
  extractNextPage,
  normalizeAiInference,
  normalizeAiInferencePage,
  normalizeDeviceInfo,
  normalizeEnvironmentalReading,
  normalizeEnvironmentalReadingPage,
  normalizeLocationMetrics,
  normalizeLocationsResponse,
  normalizeMetricPage,
} from './normalizers';

const REQUEST_TIMEOUT_MS = 12_000;
const HISTORY_PAGE_SIZE = 500;
const MAX_HISTORY_PAGES = 200;
const AI_HISTORY_PAGE_SIZE = 100;
const HISTORY_TIMEOUT_MS = 20_000;

export interface MetricRangeRequest {
  startDate: string;
  endDate: string;
  pageSize?: number;
}

export interface AggregateMetricRangeRequest extends MetricRangeRequest {
  granularity: 'raw' | 'hourly' | 'daily';
  timezone?: string;
}

function resolveUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    const defaultApiUrl = new URL(DEFAULT_API_BASE_URL);

    if (url.host === defaultApiUrl.host) {
      return `${API_BASE_URL}${url.pathname}${url.search}${url.hash}`;
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

function rangeSearchParams(params: MetricRangeRequest, extra?: Record<string, string | undefined>): string {
  const search = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
    page_size: String(params.pageSize ?? HISTORY_PAGE_SIZE),
    ...Object.fromEntries(Object.entries(extra ?? {}).filter(([, value]) => value !== undefined)),
  });

  return search.toString();
}

async function fetchPaginatedData<T>(
  path: string,
  normalize: (payload: unknown) => PaginatedData<T>,
  options: { maxPages?: number; timeoutMs?: number } = {},
): Promise<PaginatedData<T>> {
  let nextUrl: string | undefined = path;
  const seen = new Set<string>();
  let pageCount = 0;
  let firstPage: PaginatedData<T> | undefined;
  const results: T[] = [];
  const maxPages = options.maxPages ?? MAX_HISTORY_PAGES;

  while (nextUrl && !seen.has(nextUrl) && pageCount < maxPages) {
    seen.add(nextUrl);
    const payload = await requestJson<unknown>(nextUrl, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const page = normalize(payload);
    firstPage ??= page;
    results.push(...page.results);
    nextUrl = page.next;
    pageCount += 1;
  }

  return {
    count: firstPage?.count ?? results.length,
    next: nextUrl,
    previous: firstPage?.previous,
    range: firstPage?.range,
    device: firstPage?.device,
    results,
    truncated: Boolean(nextUrl),
  };
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

export async function fetchDeviceMetricHistoryByName(deviceName: string, params: MetricRangeRequest): Promise<PaginatedData<NoiseMetric>> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const query = rangeSearchParams(params, {
    ordering: 'time_uploaded',
  });

  return fetchPaginatedData(`/device_metrics/device/by-device-id/${encodedDeviceName}/history/?${query}`, normalizeMetricPage);
}

export async function fetchDeviceMetricAggregates(
  deviceName: string,
  params: AggregateMetricRangeRequest,
): Promise<PaginatedData<NoiseMetric>> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const query = rangeSearchParams(params, {
    granularity: params.granularity,
    ordering: 'timestamp',
    timezone: params.timezone,
  });

  return fetchPaginatedData(`/device_metrics/device/by-device-id/${encodedDeviceName}/aggregates/?${query}`, normalizeMetricPage);
}

export async function fetchEnvironmentalHistory(
  deviceName: string,
  params: MetricRangeRequest,
): Promise<PaginatedData<EnvironmentalReading>> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const query = rangeSearchParams({ ...params, pageSize: params.pageSize ?? AI_HISTORY_PAGE_SIZE }, {
    ordering: '-created_at',
  });

  return fetchPaginatedData(
    `/device_metrics/environmental-parameters/by-device-id/${encodedDeviceName}/history/?${query}`,
    normalizeEnvironmentalReadingPage,
    { maxPages: 1, timeoutMs: HISTORY_TIMEOUT_MS },
  );
}

export async function fetchAiInferenceHistory(deviceName: string, params: MetricRangeRequest): Promise<PaginatedData<AiInference>> {
  const encodedDeviceName = encodeURIComponent(deviceName);
  const query = rangeSearchParams({ ...params, pageSize: params.pageSize ?? AI_HISTORY_PAGE_SIZE }, {
    ordering: '-created_at',
  });

  return fetchPaginatedData(
    `/device_metrics/sound-inference-data/by-device-id/${encodedDeviceName}/history/?${query}`,
    normalizeAiInferencePage,
    { maxPages: 2, timeoutMs: HISTORY_TIMEOUT_MS },
  );
}

export async function fetchAnalysis(): Promise<unknown> {
  return requestJson<unknown>('/analysis');
}

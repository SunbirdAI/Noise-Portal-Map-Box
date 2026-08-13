import { API_ORIGIN } from '../../config/env';
import type {
  ApiScope,
  AuthUser,
  InvitationAcceptance,
  ManagedMembership,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationSummary,
  PaginatedResponse,
  PartnerRole,
  ScopedDevice,
} from '../../models/portal';
import type {
  AiInference,
  AdvisorAudience,
  AdvisorLanguage,
  DeviceInfo,
  EnvironmentalReading,
  NoiseAdvisorInsight,
  NoiseMetric,
  PaginatedData,
  SensorLocation,
} from '../../models/sensor';
import { extractCoordinates } from '../coordinates';
import { detectSensorType } from '../sensors';
import { ApiError } from './errors';
import { notifyPortalAuthFailure } from '../../auth/sessionEvents';
import {
  normalizeAdvisorInsight,
  normalizeAiInference,
  normalizeAiInferencePage,
  normalizeEnvironmentalReading,
  normalizeEnvironmentalReadingPage,
  normalizeMetric,
  normalizeMetricPage,
} from './normalizers';

const REQUEST_TIMEOUT_MS = 15_000;
const HISTORY_TIMEOUT_MS = 25_000;
const MAX_PAGES = 200;
const MAX_CONCURRENT_CURRENT_REQUESTS = 8;

let activeCurrentRequests = 0;
const currentRequestQueue: Array<() => void> = [];

type JsonRecord = Record<string, unknown>;

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function resolveApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${API_ORIGIN}${url.pathname}${url.search}${url.hash}`;
  }

  return `${API_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function errorMessage(payload: unknown, status: number): string {
  const raw = asRecord(payload);
  const detail = stringValue(raw.detail);

  if (detail) {
    return detail;
  }

  for (const [field, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) {
      return `${field}: ${value}`;
    }

    if (Array.isArray(value) && value.length > 0) {
      return `${field}: ${value.map(String).join(' ')}`;
    }
  }

  return `Request failed with status ${status}`;
}

function isPortalRequest(url: string): boolean {
  return new URL(url, window.location.origin).pathname.startsWith('/api/v2/portal/');
}

async function withCurrentRequestSlot<T>(request: () => Promise<T>): Promise<T> {
  if (activeCurrentRequests >= MAX_CONCURRENT_CURRENT_REQUESTS) {
    await new Promise<void>((resolve) => currentRequestQueue.push(resolve));
  }

  activeCurrentRequests += 1;
  try {
    return await request();
  } finally {
    activeCurrentRequests -= 1;
    currentRequestQueue.shift()?.();
  }
}

export async function apiRequest<T>(pathOrUrl: string, options: RequestOptions = {}): Promise<T> {
  const url = resolveApiUrl(pathOrUrl);
  const requestUrl = new URL(url, window.location.origin);
  const credentials: RequestCredentials =
    requestUrl.origin === window.location.origin ? 'include' : 'omit';

  if (credentials === 'omit' && !requestUrl.pathname.startsWith('/api/v2/public/')) {
    throw new ApiError('Authenticated API requests require a same-origin deployment.', url);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      ...options,
      body,
      credentials,
      headers,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && isPortalRequest(url)) {
        notifyPortalAuthFailure();
      }
      throw new ApiError(errorMessage(payload, response.status), url, response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', url, undefined, undefined, 'timeout');
    }

    throw new ApiError(error instanceof Error ? error.message : 'Request failed', url);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return entry ? decodeURIComponent(entry.slice(prefix.length)) : undefined;
}

export async function initializeCsrf(): Promise<string> {
  const csrfUrl = resolveApiUrl('/api/v2/auth/csrf/');
  try {
    await apiRequest<{ detail: string }>('/api/v2/auth/csrf/');
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(
        `Authentication security check failed: ${error.message}`,
        csrfUrl,
        error.status,
        error.details,
        'csrf',
      );
    }
    throw error;
  }
  const token = readCookie('csrftoken');

  if (!token) {
    throw new ApiError('The backend did not provide a CSRF token.', csrfUrl, undefined, undefined, 'csrf');
  }

  return token;
}

export async function csrfRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const token = readCookie('csrftoken') ?? (await initializeCsrf());
  const headers = new Headers(options.headers);
  headers.set('X-CSRFToken', token);
  return apiRequest<T>(path, { ...options, headers });
}

function normalizeOrganization(value: unknown): OrganizationSummary {
  const raw = asRecord(value);
  return {
    id: stringValue(raw.id) ?? '',
    name: stringValue(raw.name) ?? 'Unnamed organization',
    slug: stringValue(raw.slug) ?? '',
  };
}

function normalizeMembership(value: unknown): OrganizationMembership {
  const raw = asRecord(value);
  return {
    id: stringValue(raw.id) ?? '',
    organization: normalizeOrganization(raw.organization),
    role: raw.role === 'PARTNER_ADMIN' ? 'PARTNER_ADMIN' : 'PARTNER_MEMBER',
    isActive: booleanValue(raw.is_active),
    createdAt: stringValue(raw.created_at) ?? '',
  };
}

export function normalizeAuthUser(value: unknown): AuthUser {
  const raw = asRecord(value);
  return {
    id: typeof raw.id === 'number' ? raw.id : Number(raw.id) || 0,
    username: stringValue(raw.username) ?? '',
    email: stringValue(raw.email) ?? '',
    isPlatformAdministrator: booleanValue(raw.is_platform_administrator),
    memberships: Array.isArray(raw.memberships) ? raw.memberships.map(normalizeMembership) : [],
  };
}

export async function fetchMe(): Promise<AuthUser> {
  return normalizeAuthUser(await apiRequest<unknown>('/api/v2/auth/me/'));
}

export async function login(identifier: string, password: string): Promise<AuthUser> {
  return normalizeAuthUser(
    await csrfRequest<unknown>('/api/v2/auth/login/', {
      method: 'POST',
      body: { identifier, password },
    }),
  );
}

export async function logout(): Promise<void> {
  await csrfRequest('/api/v2/auth/logout/', { method: 'POST' });
}

function scopeBasePath(scope: ApiScope): string {
  return scope.kind === 'public'
    ? '/api/v2/public'
    : `/api/v2/portal/organizations/${encodeURIComponent(scope.organizationId)}`;
}

export function scopeKey(scope: ApiScope): string {
  return scope.kind === 'public' ? 'public' : `organization:${scope.organizationId}`;
}

function normalizeLocation(value: unknown, deviceUuid: string): SensorLocation | undefined {
  const raw = asRecord(value);
  const coordinates = extractCoordinates(raw);
  const locationId = stringValue(raw.id);
  const deviceName = stringValue(raw.device_id);

  if (!coordinates || !locationId || !deviceName || !deviceUuid) {
    return undefined;
  }

  return {
    id: deviceUuid,
    locationId,
    deviceUuid,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    coordinateSource: coordinates.source,
    city: stringValue(raw.city) ?? 'Unknown city',
    division: stringValue(raw.division),
    parish: stringValue(raw.parish),
    village: stringValue(raw.village),
    description: stringValue(raw.location_description),
    dayLimit: typeof raw.day_limit === 'number' ? raw.day_limit : Number(raw.day_limit) || undefined,
    nightLimit: typeof raw.night_limit === 'number' ? raw.night_limit : Number(raw.night_limit) || undefined,
    deviceName,
  };
}

export function normalizeScopedDevice(value: unknown): ScopedDevice {
  const raw = asRecord(value);
  const id = stringValue(raw.id) ?? '';
  const deviceId = stringValue(raw.device_id) ?? 'Unknown device';
  const rawDeviceType = stringValue(raw.device_type);
  const visibility = raw.visibility === 'PUBLIC' ? 'PUBLIC' : raw.visibility === 'PRIVATE' ? 'PRIVATE' : undefined;

  return {
    id,
    deviceId,
    displayName: stringValue(raw.device_name) ?? deviceId,
    sensorType: detectSensorType({ deviceName: deviceId, deviceType: rawDeviceType }),
    rawDeviceType,
    versionNumber: stringValue(raw.version_number),
    productionStage: stringValue(raw.production_stage),
    visibility,
    organization: raw.organization ? normalizeOrganization(raw.organization) : undefined,
    location: raw.location ? normalizeLocation(raw.location, id) : undefined,
    lastSeen: stringValue(raw.last_seen),
  };
}

function normalizePage<T>(payload: unknown, normalizeItem: (value: unknown) => T): PaginatedResponse<T> {
  const raw = asRecord(payload);
  const results = Array.isArray(raw.results) ? raw.results.map(normalizeItem) : [];
  return {
    count: typeof raw.count === 'number' ? raw.count : results.length,
    next: stringValue(raw.next),
    previous: stringValue(raw.previous),
    results,
  };
}

async function fetchEveryPage<T>(path: string, normalizeItem: (value: unknown) => T): Promise<T[]> {
  const results: T[] = [];
  const seen = new Set<string>();
  let next: string | undefined = path;
  let pages = 0;

  while (next && !seen.has(next) && pages < MAX_PAGES) {
    seen.add(next);
    const page: PaginatedResponse<T> = normalizePage(await apiRequest<unknown>(next), normalizeItem);
    results.push(...page.results);
    next = page.next;
    pages += 1;
  }

  return results;
}

export async function fetchScopedDevices(scope: ApiScope): Promise<ScopedDevice[]> {
  return fetchEveryPage(`${scopeBasePath(scope)}/devices/`, normalizeScopedDevice);
}

export async function fetchScopedDevice(scope: ApiScope, deviceId: string): Promise<ScopedDevice> {
  return normalizeScopedDevice(
    await apiRequest<unknown>(`${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/`),
  );
}

async function optionalRequest<T>(path: string, normalize: (value: unknown) => T): Promise<T | undefined> {
  try {
    return normalize(await apiRequest<unknown>(path));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function fetchCurrentMetric(scope: ApiScope, deviceId: string): Promise<NoiseMetric | undefined> {
  return withCurrentRequestSlot(() =>
    optionalRequest(`${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/metrics/current/`, normalizeMetric),
  );
}

export async function fetchCurrentEnvironmental(scope: ApiScope, deviceId: string): Promise<EnvironmentalReading | undefined> {
  return withCurrentRequestSlot(() =>
    optionalRequest(
      `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/environmental/current/`,
      normalizeEnvironmentalReading,
    ),
  );
}

export async function fetchCurrentInference(scope: ApiScope, deviceId: string): Promise<AiInference | undefined> {
  return withCurrentRequestSlot(() =>
    optionalRequest(
      `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/inferences/current/`,
      normalizeAiInference,
    ),
  );
}

export interface MetricRangeRequest {
  startDate: string;
  endDate: string;
  pageSize?: number;
}

export interface AggregateRangeRequest extends MetricRangeRequest {
  granularity: 'raw' | 'hourly' | 'daily';
  timezone?: string;
}

function rangeQuery(params: MetricRangeRequest, extra: Record<string, string | undefined>): string {
  return new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
    page_size: String(params.pageSize ?? 500),
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)),
  }).toString();
}

async function fetchHistory<T>(path: string, normalize: (payload: unknown) => PaginatedData<T>): Promise<PaginatedData<T>> {
  const results: T[] = [];
  const seen = new Set<string>();
  let next: string | undefined = path;
  let first: PaginatedData<T> | undefined;
  let pages = 0;

  while (next && !seen.has(next) && pages < MAX_PAGES) {
    seen.add(next);
    const page = normalize(await apiRequest<unknown>(next, { timeoutMs: HISTORY_TIMEOUT_MS }));
    first ??= page;
    results.push(...page.results);
    next = page.next;
    pages += 1;
  }

  return {
    count: first?.count ?? results.length,
    previous: first?.previous,
    next,
    range: first?.range,
    device: first?.device,
    results,
    truncated: Boolean(next),
  };
}

export async function fetchMetricAggregates(
  scope: ApiScope,
  deviceId: string,
  params: AggregateRangeRequest,
): Promise<PaginatedData<NoiseMetric>> {
  const query = rangeQuery(params, {
    granularity: params.granularity,
    timezone: params.timezone,
    ordering: 'timestamp',
  });
  return fetchHistory(
    `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/metrics/aggregates/?${query}`,
    normalizeMetricPage,
  );
}

export async function fetchEnvironmentalHistory(
  scope: ApiScope,
  deviceId: string,
  params: MetricRangeRequest,
): Promise<PaginatedData<EnvironmentalReading>> {
  const query = rangeQuery({ ...params, pageSize: params.pageSize ?? 100 }, { ordering: '-created_at' });
  return fetchHistory(
    `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/environmental/history/?${query}`,
    normalizeEnvironmentalReadingPage,
  );
}

export async function fetchInferenceHistory(
  scope: ApiScope,
  deviceId: string,
  params: MetricRangeRequest,
): Promise<PaginatedData<AiInference>> {
  const query = rangeQuery({ ...params, pageSize: params.pageSize ?? 100 }, { ordering: '-created_at' });
  return fetchHistory(
    `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/inferences/history/?${query}`,
    normalizeAiInferencePage,
  );
}

export async function fetchScopedAdvisor(
  scope: ApiScope,
  deviceId: string,
  lang: AdvisorLanguage,
  audience: AdvisorAudience,
): Promise<NoiseAdvisorInsight> {
  const query = new URLSearchParams({ lang, audience });
  return normalizeAdvisorInsight(
    await apiRequest<unknown>(
      `${scopeBasePath(scope)}/devices/${encodeURIComponent(deviceId)}/advisor/?${query}`,
      { timeoutMs: HISTORY_TIMEOUT_MS },
    ),
  );
}

export function scopedDeviceInfo(device: ScopedDevice, metrics: NoiseMetric[] = []): DeviceInfo {
  return {
    id: device.id,
    deviceId: device.deviceId,
    displayName: device.displayName,
    sensorType: device.sensorType,
    lastSeen: device.lastSeen,
    versionNumber: device.versionNumber,
    productionStage: device.productionStage,
    metrics,
  };
}

function normalizeMember(value: unknown): ManagedMembership {
  const raw = asRecord(value);
  const user = asRecord(raw.user);
  return {
    id: stringValue(raw.id) ?? '',
    user: {
      id: typeof user.id === 'number' ? user.id : Number(user.id) || 0,
      username: stringValue(user.username) ?? '',
      email: stringValue(user.email) ?? '',
    },
    role: raw.role === 'PARTNER_ADMIN' ? 'PARTNER_ADMIN' : 'PARTNER_MEMBER',
    isActive: booleanValue(raw.is_active),
    createdAt: stringValue(raw.created_at) ?? '',
  };
}

function normalizeInvitation(value: unknown): OrganizationInvitation {
  const raw = asRecord(value);
  const invitedBy = asRecord(raw.invited_by);
  return {
    id: stringValue(raw.id) ?? '',
    organization: normalizeOrganization(raw.organization),
    email: stringValue(raw.email) ?? '',
    role: raw.role === 'PARTNER_ADMIN' ? 'PARTNER_ADMIN' : 'PARTNER_MEMBER',
    invitedBy: Object.keys(invitedBy).length
      ? {
          id: typeof invitedBy.id === 'number' ? invitedBy.id : Number(invitedBy.id) || 0,
          username: stringValue(invitedBy.username) ?? '',
          email: stringValue(invitedBy.email) ?? '',
        }
      : undefined,
    expiresAt: stringValue(raw.expires_at) ?? '',
    acceptedAt: raw.accepted_at === null ? null : stringValue(raw.accepted_at),
    revokedAt: raw.revoked_at === null ? null : stringValue(raw.revoked_at),
    createdAt: stringValue(raw.created_at) ?? '',
    status:
      raw.status === 'ACCEPTED' || raw.status === 'REVOKED' || raw.status === 'EXPIRED'
        ? raw.status
        : 'PENDING',
  };
}

function organizationPortalPath(organizationId: string): string {
  return `/api/v2/portal/organizations/${encodeURIComponent(organizationId)}`;
}

export async function fetchMembers(organizationId: string): Promise<ManagedMembership[]> {
  return fetchEveryPage(`${organizationPortalPath(organizationId)}/members/`, normalizeMember);
}

export async function updateMembership(
  organizationId: string,
  membershipId: string,
  isActive: boolean,
): Promise<ManagedMembership> {
  return normalizeMember(
    await csrfRequest<unknown>(
      `${organizationPortalPath(organizationId)}/members/${encodeURIComponent(membershipId)}/`,
      { method: 'PATCH', body: { is_active: isActive } },
    ),
  );
}

export async function fetchInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  return fetchEveryPage(`${organizationPortalPath(organizationId)}/invitations/`, normalizeInvitation);
}

export async function createInvitation(
  organizationId: string,
  email: string,
  role: PartnerRole,
): Promise<OrganizationInvitation> {
  return normalizeInvitation(
    await csrfRequest<unknown>(`${organizationPortalPath(organizationId)}/invitations/`, {
      method: 'POST',
      body: { email, role },
    }),
  );
}

export async function revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
  await csrfRequest(
    `${organizationPortalPath(organizationId)}/invitations/${encodeURIComponent(invitationId)}/`,
    { method: 'DELETE' },
  );
}

export async function resendInvitation(
  organizationId: string,
  invitationId: string,
): Promise<OrganizationInvitation> {
  return normalizeInvitation(
    await csrfRequest<unknown>(
      `${organizationPortalPath(organizationId)}/invitations/${encodeURIComponent(invitationId)}/resend/`,
      { method: 'POST' },
    ),
  );
}

export async function fetchInvitation(token: string): Promise<OrganizationInvitation> {
  return normalizeInvitation(
    await apiRequest<unknown>(`/api/v2/auth/invitations/${encodeURIComponent(token)}/`),
  );
}

export async function acceptInvitation(
  token: string,
  payload: { username?: string; password?: string },
): Promise<InvitationAcceptance> {
  const raw = asRecord(
    await csrfRequest<unknown>(`/api/v2/auth/invitations/${encodeURIComponent(token)}/`, {
      method: 'POST',
      body: payload,
    }),
  );
  return {
    detail: stringValue(raw.detail) ?? 'Invitation accepted.',
    membership: normalizeMembership(raw.membership),
    user: normalizeAuthUser(raw.user),
  };
}

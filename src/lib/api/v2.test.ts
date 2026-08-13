import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  acceptInvitation,
  apiRequest,
  fetchCurrentMetric,
  fetchInvitation,
  fetchMe,
  fetchScopedDevices,
  login,
  logout,
} from './v2';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('API v2 client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads same-origin public devices with credentials included and exactly one /api prefix', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'public-uuid',
            device_id: 'SB1006',
            device_name: 'Naguru Summit View',
            device_type: 'MCU',
            location: {
              id: 'location-uuid',
              device_id: 'SB1006',
              latitude: 0.3476,
              longitude: 32.5825,
              city: 'Kampala',
              village: 'Kiwatule',
              category: 'B',
              day_limit: 50,
              night_limit: 35,
            },
          },
        ],
      }),
    );

    const devices = await fetchScopedDevices({ kind: 'public' });

    expect(devices[0]).toMatchObject({
      id: 'public-uuid',
      deviceId: 'SB1006',
      sensorType: 'MCU',
      location: { locationId: 'location-uuid', deviceUuid: 'public-uuid', city: 'Kampala' },
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v2/public/devices/');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/api/');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('uses the explicit organization UUID for portal device scope', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, next: null, previous: null, results: [] }));

    await fetchScopedDevices({ kind: 'organization', organizationId: 'org-uuid' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/portal/organizations/org-uuid/devices/');
  });

  it('uses the organization and device UUID for a partner current metric', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'metric-1', db_level: 52 }));

    await fetchCurrentMetric({ kind: 'organization', organizationId: 'org-uuid' }, 'device-uuid');

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v2/portal/organizations/org-uuid/devices/device-uuid/metrics/current/',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('initializes CSRF and sends the token on login', async () => {
    fetchMock
      .mockImplementationOnce(async () => {
        document.cookie = 'csrftoken=csrf-test-token; path=/';
        return jsonResponse({ detail: 'CSRF cookie initialized.' });
      })
      .mockResolvedValueOnce(
        jsonResponse({
          id: 12,
          username: 'partner-admin',
          email: 'admin@example.test',
          is_platform_administrator: false,
          memberships: [],
        }),
      );

    const user = await login('partner-admin', 'password');

    expect(user.username).toBe('partner-admin');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/auth/csrf/');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v2/auth/login/');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    const headers = fetchMock.mock.calls[1][1].headers as Headers;
    expect(headers.get('X-CSRFToken')).toBe('csrf-test-token');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('includes credentials for same-origin me, logout, invitation, and portal requests', async () => {
    document.cookie = 'csrftoken=same-origin-token; path=/';
    fetchMock.mockImplementation(async (input: string, init: RequestInit) => {
      const path = new URL(input, window.location.origin).pathname;

      if (path === '/api/v2/auth/me/') {
        return jsonResponse({
          id: 12,
          username: 'partner-admin',
          email: 'admin@example.test',
          is_platform_administrator: false,
          memberships: [],
        });
      }

      if (path === '/api/v2/auth/logout/') {
        return new Response(null, { status: 204 });
      }

      if (path === '/api/v2/auth/invitations/invitation-token/' && init.method === 'POST') {
        return jsonResponse({
          detail: 'Invitation accepted.',
          membership: {
            id: 'membership-1',
            organization: { id: 'org-uuid', name: 'Partner', slug: 'partner' },
            role: 'PARTNER_MEMBER',
            is_active: true,
            created_at: '2026-01-01T00:00:00Z',
          },
          user: {
            id: 12,
            username: 'partner-admin',
            email: 'admin@example.test',
            is_platform_administrator: false,
            memberships: [],
          },
        });
      }

      if (path === '/api/v2/auth/invitations/invitation-token/') {
        return jsonResponse({
          id: 'invitation-1',
          organization: { id: 'org-uuid', name: 'Partner', slug: 'partner' },
          email: 'invitee@example.test',
          role: 'PARTNER_MEMBER',
          status: 'PENDING',
          expires_at: '2026-12-01T00:00:00Z',
          created_at: '2026-01-01T00:00:00Z',
        });
      }

      return jsonResponse({ count: 0, next: null, previous: null, results: [] });
    });

    await fetchMe();
    await logout();
    await fetchInvitation('invitation-token');
    await acceptInvitation('invitation-token', {});
    await fetchScopedDevices({ kind: 'organization', organizationId: 'org-uuid' });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ credentials: 'include' });
    }
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/v2/auth/me/',
      '/api/v2/auth/logout/',
      '/api/v2/auth/invitations/invitation-token/',
      '/api/v2/auth/invitations/invitation-token/',
      '/api/v2/portal/organizations/org-uuid/devices/',
    ]);
  });

  it('rewrites absolute Heroku pagination links to same-origin API paths', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          count: 1,
          next: 'https://noise-sensors-dashboard.herokuapp.com/api/v2/public/devices/?page=2',
          previous: null,
          results: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ count: 1, next: null, previous: null, results: [] }));

    await fetchScopedDevices({ kind: 'public' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v2/public/devices/',
      '/api/v2/public/devices/?page=2',
    ]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ credentials: 'include' });
  });

  it('keeps invalid credentials distinct from CSRF initialization failure', async () => {
    document.cookie = 'csrftoken=existing-token; path=/';
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Invalid username/email or password.' }, 403));

    await expect(login('wrong@example.test', 'wrong')).rejects.toMatchObject({
      status: 403,
      kind: 'http',
      message: 'Invalid username/email or password.',
    });

    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Proxy unavailable.' }, 502));

    await expect(login('partner', 'password')).rejects.toMatchObject({
      status: 502,
      kind: 'csrf',
      message: 'Authentication security check failed: Proxy unavailable.',
    });
  });

  it('announces portal 401/403 responses for session revalidation but not resource 404', async () => {
    const listener = vi.fn();
    window.addEventListener('sunbird:portal-auth-failure', listener);
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Authentication required.' }, 403));

    await expect(apiRequest('/api/v2/portal/organizations/org-1/devices/')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Not found.' }, 404));
    await expect(apiRequest('/api/v2/portal/organizations/org-1/devices/device-2/')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('sunbird:portal-auth-failure', listener);
  });

  it('treats a missing current metric as an empty device reading', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not found.' }, 404));

    await expect(fetchCurrentMetric({ kind: 'public' }, 'device-uuid')).resolves.toBeUndefined();
  });
});

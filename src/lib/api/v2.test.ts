import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentMetric, fetchScopedDevices, login } from './v2';

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

  it('loads and normalizes anonymous public devices with credentials included', async () => {
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
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/public/devices/');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('uses the explicit organization UUID for portal device scope', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, next: null, previous: null, results: [] }));

    await fetchScopedDevices({ kind: 'organization', organizationId: 'org-uuid' });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/portal/organizations/org-uuid/devices/');
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
    const headers = fetchMock.mock.calls[1][1].headers as Headers;
    expect(headers.get('X-CSRFToken')).toBe('csrf-test-token');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('treats a missing current metric as an empty device reading', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not found.' }, 404));

    await expect(fetchCurrentMetric({ kind: 'public' }, 'device-uuid')).resolves.toBeUndefined();
  });
});

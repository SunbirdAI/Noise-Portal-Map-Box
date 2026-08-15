import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_ORIGIN: 'https://noise-sensors-dashboard.herokuapp.com',
  API_DEBUG_ENABLED: false,
}));

import { fetchCurrentMetric, fetchMe, fetchScopedDevices } from './v2';

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('API v2 public-only cross-origin mode', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('omits credentials from direct cross-origin public device requests', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, next: null, previous: null, results: [] }));

    await fetchScopedDevices({ kind: 'public' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://noise-sensors-dashboard.herokuapp.com/api/v2/public/devices/',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/api/');
  });

  it('blocks authenticated API endpoints entirely in cross-origin mode', async () => {
    await expect(fetchMe()).rejects.toThrow(
      'Authenticated API requests require a same-origin deployment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the v2 device UUID current-reading path without legacy endpoints', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'metric-1', db_level: 51 }));

    await fetchCurrentMetric({ kind: 'public' }, 'device-uuid');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://noise-sensors-dashboard.herokuapp.com/api/v2/public/devices/device-uuid/metrics/current/',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  });

  it('keeps absolute Heroku pagination URLs on the configured public API origin', async () => {
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
      'https://noise-sensors-dashboard.herokuapp.com/api/v2/public/devices/',
      'https://noise-sensors-dashboard.herokuapp.com/api/v2/public/devices/?page=2',
    ]);
    expect(fetchMock.mock.calls.every(([, init]) => init.credentials === 'omit')).toBe(true);
  });
});

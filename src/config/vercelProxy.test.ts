import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import proxy from '../../api/proxy';

describe('Vercel API proxy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('BACKEND_ORIGIN', 'https://noise-sensors-dashboard.herokuapp.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('forwards method, body, cookies, CSRF, full API path, and query string without caching', async () => {
    const upstreamHeaders = new Headers({ 'Content-Type': 'application/json' });
    upstreamHeaders.append(
      'Set-Cookie',
      'csrftoken=csrf-value; Domain=noise-sensors-dashboard.herokuapp.com; Path=/; Secure; SameSite=Lax',
    );
    upstreamHeaders.append(
      'Set-Cookie',
      'sessionid=session-value; Domain=noise-sensors-dashboard.herokuapp.com; Path=/; Secure; HttpOnly; SameSite=Lax',
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Signed in.' }), { status: 200, headers: upstreamHeaders }),
    );

    const response = await proxy.fetch(
      new Request(
        'https://noise-preview.vercel.app/api/proxy?__proxy_path=v2/auth/login/&next=%2Fportal',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: 'csrftoken=csrf-value',
            'X-CSRFToken': 'csrf-value',
            Origin: 'https://untrusted.example',
          },
          body: JSON.stringify({ identifier: 'partner', password: 'secret' }),
        },
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamRequest = fetchMock.mock.calls[0][0] as Request;
    expect(upstreamRequest.url).toBe(
      'https://noise-sensors-dashboard.herokuapp.com/api/v2/auth/login/?next=%2Fportal',
    );
    expect(upstreamRequest.method).toBe('POST');
    expect(upstreamRequest.headers.get('Cookie')).toBe('csrftoken=csrf-value');
    expect(upstreamRequest.headers.get('X-CSRFToken')).toBe('csrf-value');
    expect(upstreamRequest.headers.get('Origin')).toBe('https://noise-preview.vercel.app');
    expect(await upstreamRequest.json()).toEqual({ identifier: 'partner', password: 'secret' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    const cookies = response.headers.get('Set-Cookie') ?? '';
    expect(cookies).toContain('csrftoken=csrf-value');
    expect(cookies).toContain('sessionid=session-value');
    expect(cookies).not.toMatch(/Domain=/i);
  });

  it('rejects attempts to proxy paths outside API v2', async () => {
    const response = await proxy.fetch(
      new Request('https://noise-preview.vercel.app/api/proxy?__proxy_path=admin/'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ detail: 'Only API v2 paths can be proxied.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the server-side backend origin is missing', async () => {
    vi.stubEnv('BACKEND_ORIGIN', '');

    const response = await proxy.fetch(
      new Request('https://noise-preview.vercel.app/api/proxy?__proxy_path=v2/public/devices/'),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ detail: 'The API proxy is not configured.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

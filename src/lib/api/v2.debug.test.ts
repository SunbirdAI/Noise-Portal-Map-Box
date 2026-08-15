import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  API_ORIGIN: '',
  API_DEBUG_ENABLED: true,
}));

import { apiRequest } from './v2';

describe('API v2 browser diagnostics', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs safe routing metadata and redacts invitation tokens and query values', async () => {
    fetchMock.mockResolvedValue(
      new Response('<!doctype html><html><body>SPA fallback</body></html>', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-disposition': 'inline; filename="index.html"',
          'x-vercel-cache': 'HIT',
        },
      }),
    );

    await expect(
      apiRequest('/api/v2/auth/invitations/super-secret-token/?email=private@example.test'),
    ).rejects.toThrow('unexpected non-JSON response');

    const responseLog = infoSpy.mock.calls.find(
      (call: unknown[]) => call[0] === '[Sunbird API debug] response',
    );
    expect(responseLog?.[1]).toMatchObject({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      contentDisposition: 'inline; filename="index.html"',
      vercelCache: 'HIT',
      proxyMarker: null,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[Sunbird API debug] request failed',
      expect.objectContaining({ status: 200, kind: 'http' }),
    );

    const diagnostics = JSON.stringify([infoSpy.mock.calls, errorSpy.mock.calls]);
    expect(diagnostics).toContain('/api/v2/auth/invitations/[redacted]/');
    expect(diagnostics).toContain('email');
    expect(diagnostics).not.toContain('super-secret-token');
    expect(diagnostics).not.toContain('private@example.test');
  });
});

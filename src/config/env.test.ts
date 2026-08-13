import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnvironment(apiOrigin: string, partnerEnabled: string) {
  vi.resetModules();
  vi.stubEnv('VITE_API_ORIGIN', apiOrigin);
  vi.stubEnv('VITE_PARTNER_PORTAL_ENABLED', partnerEnabled);
  return import('./env');
}

describe('deployment environment modes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('enables the partner portal only for an empty same-origin API origin', async () => {
    const environment = await loadEnvironment('', 'true');
    expect(environment.API_ORIGIN).toBe('');
    expect(environment.PARTNER_PORTAL_ENABLED).toBe(true);
  });

  it('forces a complete external API origin into public-only mode', async () => {
    const environment = await loadEnvironment(
      'https://noise-sensors-dashboard.herokuapp.com/',
      'true',
    );
    expect(environment.API_ORIGIN).toBe('https://noise-sensors-dashboard.herokuapp.com');
    expect(environment.PARTNER_PORTAL_ENABLED).toBe(false);
  });

  it('rejects /api because v2 methods already include the API prefix', async () => {
    await expect(loadEnvironment('/api', 'true')).rejects.toThrow(
      'VITE_API_ORIGIN must be empty or a complete http(s) origin. Never set it to /api.',
    );
  });
});

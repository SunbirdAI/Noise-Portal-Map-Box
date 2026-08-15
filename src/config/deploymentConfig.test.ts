import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub Pages deployment configuration', () => {
  it('uses the direct Heroku origin in explicit public-only mode', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

    expect(workflow).toContain(
      'VITE_API_ORIGIN: https://noise-sensors-dashboard.herokuapp.com',
    );
    expect(workflow).toContain('VITE_PARTNER_PORTAL_ENABLED: false');
    expect(workflow).not.toContain('VITE_API_ORIGIN: /api');
  });
});

describe('Vercel partner deployment configuration', () => {
  it('routes only API v2 through the proxy before the SPA fallback', () => {
    const configuration = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      framework: string;
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
    };

    expect(configuration.framework).toBe('vite');
    expect(configuration.outputDirectory).toBe('dist');
    expect(configuration.rewrites).toEqual([
      {
        source: '/api/:__proxy_path(v2/.*)',
        destination: '/api/proxy?__proxy_path=:__proxy_path',
      },
      {
        source: '/((?!api/v2(?:/|$)).*)',
        destination: '/index.html',
      },
    ]);

    const compiledApiRoute = /^\/api\/(v2\/.*)$/;
    expect(compiledApiRoute.test('/api/v2/public/devices/')).toBe(true);
    expect(compiledApiRoute.test('/api/v2/auth/me/')).toBe(true);
    expect(compiledApiRoute.test('/api/v2/public/devices')).toBe(true);
    expect(compiledApiRoute.test('/portal/organizations/example')).toBe(false);

    const spaFallback = /^\/((?!api\/v2(?:\/|$)).*)$/;
    expect(spaFallback.test('/portal/organizations/example')).toBe(true);
    expect(spaFallback.test('/api/v2/public/devices/')).toBe(false);
  });

  it('has removed Cloudflare-specific deployment files', () => {
    expect(existsSync('functions/api/[[path]].js')).toBe(false);
    expect(existsSync('public/_routes.json')).toBe(false);
    expect(existsSync('public/_redirects')).toBe(false);
  });
});

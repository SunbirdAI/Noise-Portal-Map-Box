import { readFileSync } from 'node:fs';
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

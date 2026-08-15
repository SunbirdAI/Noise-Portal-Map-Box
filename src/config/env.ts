const configuredApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim() ?? '';

function normalizeApiOrigin(value: string): string {
  if (!value) return '';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('VITE_API_ORIGIN must be empty or a complete http(s) origin. Never set it to /api.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_ORIGIN must be empty or a complete http(s) origin without a path.');
  }

  return url.origin;
}

/**
 * Empty by default so browser-visible API URLs stay on the frontend origin.
 * A full origin is supported only for explicit public-only diagnostics.
 */
export const API_ORIGIN = normalizeApiOrigin(configuredApiOrigin);

export const PARTNER_PORTAL_ENABLED =
  API_ORIGIN.length === 0 && import.meta.env.VITE_PARTNER_PORTAL_ENABLED !== 'false';

export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';

export const PASSWORD_RESET_URL = import.meta.env.VITE_PASSWORD_RESET_URL?.trim() ?? '';

export const INTERNAL_DASHBOARD_URL = import.meta.env.VITE_INTERNAL_DASHBOARD_URL?.trim() ?? '';

export const SHOW_API_ORIGIN = import.meta.env.DEV && import.meta.env.VITE_SHOW_API_ORIGIN === 'true';

/**
 * Opt-in browser-console diagnostics. This value is public build configuration,
 * so it must never contain secrets.
 */
export const API_DEBUG_ENABLED = import.meta.env.VITE_API_DEBUG === 'true';

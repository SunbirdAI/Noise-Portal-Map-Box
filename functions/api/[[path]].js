/* global URL, Request, fetch, Headers, Response */

const DEFAULT_BACKEND_ORIGIN = 'https://noise-sensors-dashboard.herokuapp.com';

export async function onRequest({ request, env }) {
  const backendOrigin = normalizeOrigin(env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN);
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin);
  const upstreamRequest = new Request(upstreamUrl, request);
  const upstreamResponse = await fetch(upstreamRequest);
  const headers = new Headers(upstreamResponse.headers);

  // Authentication and organization responses must never enter an edge cache.
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Pragma', 'no-cache');
  copyHostOnlyCookies(upstreamResponse.headers, headers);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function normalizeOrigin(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}`;
}

function copyHostOnlyCookies(sourceHeaders, targetHeaders) {
  const cookies =
    typeof sourceHeaders.getSetCookie === 'function'
      ? sourceHeaders.getSetCookie()
      : splitCombinedSetCookie(sourceHeaders.get('Set-Cookie'));
  if (cookies.length === 0) {
    return;
  }

  targetHeaders.delete('Set-Cookie');
  for (const cookie of cookies) {
    // A proxied cookie belongs to the frontend host. Remove any upstream
    // Domain attribute while preserving Path, Secure, HttpOnly and SameSite.
    targetHeaders.append('Set-Cookie', cookie.replace(/;\s*Domain=[^;]+/gi, ''));
  }
}

function splitCombinedSetCookie(value) {
  if (!value) return [];
  // A comma starts a new cookie only when the following segment starts with a
  // cookie name. Commas inside an Expires date therefore remain intact.
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
}

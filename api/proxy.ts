export default {
  async fetch(request: Request): Promise<Response> {
    if (!process.env.BACKEND_ORIGIN) {
      return proxyJson({ detail: 'The API proxy is not configured.' }, 503);
    }

    const backendOrigin = normalizeOrigin(process.env.BACKEND_ORIGIN);
    const incomingUrl = new URL(request.url);
    const upstreamPath = incomingUrl.searchParams.get('__proxy_path');

    if (!upstreamPath || !isAllowedApiPath(upstreamPath)) {
      return proxyJson({ detail: 'Only API v2 paths can be proxied.' }, 400);
    }

    incomingUrl.searchParams.delete('__proxy_path');
    const upstreamUrl = new URL(`/api/${normalizePath(upstreamPath)}${incomingUrl.search}`, backendOrigin);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('host');
    requestHeaders.delete('content-length');
    requestHeaders.delete('x-forwarded-host');
    requestHeaders.delete('x-forwarded-proto');
    requestHeaders.set('origin', incomingUrl.origin);

    const requestBody =
      request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
    const upstreamRequest = new Request(upstreamUrl, {
      method: request.method,
      headers: requestHeaders,
      body: requestBody,
      redirect: 'manual',
    });
    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);

    responseHeaders.delete('connection');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.set('Cache-Control', 'private, no-store');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('X-Sunbird-Api-Proxy', 'vercel-function');
    copyHostOnlyCookies(upstreamResponse.headers, responseHeaders);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

function proxyJson(payload: Record<string, unknown>, status: number): Response {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Pragma: 'no-cache',
      'X-Sunbird-Api-Proxy': 'vercel-function',
    },
  });
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('BACKEND_ORIGIN must be a complete http(s) origin without a path.');
  }
  return url.origin;
}

function normalizePath(value: string): string {
  return value.replace(/^\/+/, '');
}

function isAllowedApiPath(value: string): boolean {
  const normalized = normalizePath(value);
  return normalized.startsWith('v2/') && !normalized.split('/').some((segment) => segment === '.' || segment === '..');
}

function copyHostOnlyCookies(sourceHeaders: Headers, targetHeaders: Headers): void {
  const getSetCookie = (sourceHeaders as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(sourceHeaders)
      : splitCombinedSetCookie(sourceHeaders.get('Set-Cookie'));

  if (cookies.length === 0) return;

  targetHeaders.delete('Set-Cookie');
  for (const cookie of cookies) {
    targetHeaders.append('Set-Cookie', cookie.replace(/;\s*Domain=[^;]+/gi, ''));
  }
}

function splitCombinedSetCookie(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
}

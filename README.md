# Sunbird AI Noise Dashboard

React frontend for two deliberately separate experiences:

- an anonymous, read-only dashboard containing only `PUBLIC` devices and public serializer fields;
- a Django-session-authenticated partner portal containing only organizations from the signed-in user's active memberships.

Sunbird's platform administration remains in the internal Django dashboard. Organization creation, device assignment, visibility changes, and cross-organization administration are intentionally not React features.

## Stack

- React 18, TypeScript, Vite, React Router and TanStack Query
- Mapbox GL JS, Tailwind CSS and Recharts
- Vitest and React Testing Library

## Local development

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env.local
```

For a local Django backend on port 8000:

```dotenv
VITE_API_ORIGIN=
VITE_PARTNER_PORTAL_ENABLED=true
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
VITE_MAPBOX_ACCESS_TOKEN=your_public_mapbox_token
```

Then run:

```bash
npm run dev
```

The browser calls exact relative paths such as `/api/v2/auth/me/`. Vite proxies `/api/...` to Django without removing the `/api` prefix. `VITE_API_PROXY_TARGET` is development-only and is not embedded in a production bundle.

## Environment variables

### Frontend build variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `VITE_API_ORIGIN` | Yes; normally empty | Empty/unset means same-origin `/api/v2/...`. The complete Heroku origin is allowed only for public-only cross-origin deployments. Never set `/api`; API functions already use exact `/api/v2/...` paths and the configuration validator rejects paths. |
| `VITE_PARTNER_PORTAL_ENABLED` | Yes | `true` for a same-origin deployment; `false` for static public-only builds. A direct `VITE_API_ORIGIN` always disables partner auth. |
| `VITE_MAPBOX_ACCESS_TOKEN` | Recommended | Public browser token used by Mapbox GL. The dashboard provides a configuration state when absent. |
| `VITE_PASSWORD_RESET_URL` | Optional | Existing password-reset page. “Forgot password?” is hidden when this is empty. |
| `VITE_INTERNAL_DASHBOARD_URL` | Optional | Link shown to a platform-only account. It must point to the server-rendered Sunbird internal dashboard, not a React admin page. |
| `VITE_SHOW_API_ORIGIN` | Optional | Development-only diagnostic host label. It has no effect in a production build. |
| `VITE_BASE_PATH` | Optional | Vite application base, normally `/` for `noise.sunbird.ai`. |

### Development server variable

`VITE_API_PROXY_TARGET` is the Django origin used by the Vite proxy. It defaults to the existing hosted backend if omitted; use `http://127.0.0.1:8000` for full-stack local work.

### Cloudflare runtime variable

`BACKEND_ORIGIN` is read by the Cloudflare Pages Function at runtime and must be a complete origin. Production value:

```dotenv
BACKEND_ORIGIN=https://noise-sensors-dashboard.herokuapp.com
```

It is server-side proxy configuration, not a `VITE_` variable and not a secret credential.

## API and security model

All active screens use API v2:

- public: `/api/v2/public/...`;
- authentication: `/api/v2/auth/...`;
- partner data: `/api/v2/portal/organizations/<organization_uuid>/...`.

Credential mode is derived from the fully resolved request URL. Same-origin requests use `credentials: "include"`; direct cross-origin public requests use `credentials: "omit"`. The frontend never sends `Access-Control-Allow-Credentials` as a request header because that is a server-controlled response header.

In same-origin partner mode, mutating requests initialize `/api/v2/auth/csrf/`, read the host-owned `csrftoken` cookie, and send `X-CSRFToken`. The Django `sessionid` remains an HttpOnly cookie. Passwords, sessions, CSRF values and invitation tokens are never written to `localStorage` or `sessionStorage`. Cross-origin builds are public-only: partner UI is disabled and the API client rejects any cross-origin path outside `/api/v2/public/...`.

Frontend membership checks prevent out-of-scope organization queries and improve the user experience, but they are not an authorization boundary. Django must continue returning 404 for out-of-scope resources and enforcing every permission.

Public detail pages do not render organization, visibility, firmware, production stage, device-health fields, system health, power usage or internal inference audio names. Partner detail pages render those fields only when the portal serializer returns them; unavailable values are not fabricated.

## Production hosting decision: Cloudflare Pages

Cloudflare Pages is the production-capable host for the partner portal. Build the site with:

```dotenv
VITE_API_ORIGIN=
VITE_PARTNER_PORTAL_ENABLED=true
VITE_BASE_PATH=/
VITE_MAPBOX_ACCESS_TOKEN=...
VITE_PASSWORD_RESET_URL=https://noise-sensors-dashboard.herokuapp.com/accounts/password_reset/
VITE_INTERNAL_DASHBOARD_URL=https://noise-sensors-dashboard.herokuapp.com/
```

Use `npm run build` with output directory `dist`. The repository includes:

- `functions/api/[[path]].js`: same-origin edge proxy;
- `public/_routes.json`: invokes the Function only for `/api/*`;
- `public/_redirects`: SPA fallback to `index.html` for direct route refreshes.

The proxy rewrite is exact:

```text
https://noise.sunbird.ai/api/v2/auth/login/?next=x
  -> https://noise-sensors-dashboard.herokuapp.com/api/v2/auth/login/?next=x
```

It preserves the method, request body, query string, `Cookie`, `Origin`, `X-CSRFToken` and other request headers. It forwards the response body/status and all `Set-Cookie` values, removing an upstream `Domain` attribute so cookies belong to `noise.sunbird.ai`. API responses receive `Cache-Control: private, no-store` and `Pragma: no-cache`; authentication and portal data must not be cached.

Production Django must include `https://noise.sunbird.ai` in `CSRF_TRUSTED_ORIGINS`. Secure cookie settings and allowed hosts must also include the actual production topology. CORS alone is not a solution: the browser must see authentication and API traffic on the frontend origin.

### GitHub Pages limitation

The existing GitHub Pages workflow uses:

```dotenv
VITE_API_ORIGIN=https://noise-sensors-dashboard.herokuapp.com
VITE_PARTNER_PORTAL_ENABLED=false
VITE_BASE_PATH=/
```

It is explicitly public-only and hides login/invitation entry points. Public browser requests go directly to Heroku and omit credentials, avoiding credentialed-CORS requirements. GitHub Pages cannot execute `functions/api/[[path]].js`; `/api/v2/...` on the GitHub Pages origin would be a static-host 404. Partner login therefore remains disabled until the site moves to Cloudflare Pages or another same-origin proxy host. Do not point Cloudflare and GitHub Pages deployments at the same production hostname simultaneously.

## Authentication behavior

Authentication restoration has four states: loading, authenticated, confirmed anonymous, and service unavailable. A 401/403 from `/me/` confirms anonymous; network/proxy/5xx errors do not. Public pages remain usable during an auth outage and show a quiet warning. Protected routes show “Authentication service unavailable” instead of redirecting repeatedly.

A portal 401/403 triggers `/me/` revalidation. If Django confirms expiry, organization query caches are removed and the user is redirected to login with the intended destination preserved. Resource 404 responses do not trigger session-expiry behavior. Logout also removes organization caches.

## Partner memberships and user management

- One active membership redirects directly to that organization.
- Multiple active memberships render an organization selector.
- No active memberships render a clear empty state.
- Route organization UUIDs are checked against active memberships before device, member or invitation queries start.
- `is_platform_administrator` never bypasses partner membership checks. Platform-only accounts use the optional internal-dashboard link.
- Only `PARTNER_ADMIN` memberships render user management.
- Self-deactivation and deactivation of the last active partner administrator are disabled and explained.
- Member deactivation and invitation revocation require confirmation; duplicate mutation submissions are disabled.
- Backend 400/409 validation details are displayed. A 503 during invitation creation explains that the invitation may have been saved and refreshes the list.

The self-deactivation and final-administrator rules are currently frontend safeguards only. The backend must independently enforce both before this protection is security-complete.

## Invitations and password reset

`/accept-invitation/:token` handles new accounts, signed-in existing accounts, and PENDING/ACCEPTED/REVOKED/EXPIRED states. New accounts confirm their password and receive strong-password guidance; Django remains the validator. A successful acceptance redirects to the accepted organization. Signing in first preserves the invitation URL as the destination.

The backend invitation email URL must target:

```text
https://noise.sunbird.ai/accept-invitation/<token>
```

Do not attach invitation tokens to analytics or error-reporting payloads. This frontend currently has no analytics/error-reporting integration.

There are no versioned JSON password-reset endpoints in the reviewed backend contract. `VITE_PASSWORD_RESET_URL` provides a safe entry point to the existing server-rendered `/accounts/password_reset/` page. That direct backend page owns its own CSRF flow. A fully integrated React reset request/confirmation flow remains blocked on versioned backend endpoints; unrestricted signup is not provided.

## Request scaling

Public and organization query keys are separate. TanStack Query deduplicates identical active requests, live polling does not continue in a background tab, and current-reading requests are limited to eight concurrent requests. The backend should eventually add a scoped dashboard/current-readings batch endpoint for large fleets; the frontend does not invent one.

## Production browser verification checklist

Run this checklist against the deployed frontend hostname before enabling partner login:

1. Open DevTools on `https://noise.sunbird.ai/login` with storage cleared.
2. Confirm `GET /api/v2/auth/csrf/` is sent to `noise.sunbird.ai`, returns success, is `no-store`, and creates `csrftoken` for the frontend host.
3. Submit valid credentials and confirm `POST /api/v2/auth/login/` includes `Cookie: csrftoken=...` and `X-CSRFToken` with the matching value.
4. Confirm login creates a usable frontend-host `sessionid` cookie and no credential/session/token appears in local or session storage.
5. Refresh a partner route and confirm `GET /api/v2/auth/me/` restores the session without another login.
6. Directly refresh `/login`, `/portal/organizations/<member-org>`, and `/accept-invitation/<test-token>`; each must load the React application rather than a host 404.
7. Enter another organization's UUID. Confirm the frontend starts no organization data requests and displays access unavailable. Confirm a direct backend attempt still returns 404.
8. Sign out. Confirm `POST /api/v2/auth/logout/` carries CSRF, clears/invalidates `sessionid`, `/me/` then confirms anonymous, and private data is absent from the query cache.
9. Simulate a backend 5xx and verify public pages remain usable while protected routes show the service-unavailable state.

## Verification commands

```bash
npm run lint
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm audit --omit=dev
```

## Remaining backend/deployment dependencies

- Enforce self-deactivation and final-active-`PARTNER_ADMIN` guards in Django.
- Add versioned JSON password-reset request and confirmation endpoints for a native React flow.
- Coordinate the production invitation URL and frontend host in email settings.
- Configure Django trusted CSRF origins, allowed hosts and secure cookies for `noise.sunbird.ai` behind the proxy.
- Add a membership-scoped dashboard/current-readings batch endpoint for large fleets.
- Complete the production browser checklist before enabling partner login.

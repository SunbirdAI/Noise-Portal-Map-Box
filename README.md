# Sunbird AI Noise Dashboard

React frontend for the Sunbird public noise network and organization-isolated partner device portals. Anonymous visitors retain access to PUBLIC devices, while authenticated partner users see only devices assigned to their active organization memberships.

## Stack

- React + Vite + TypeScript
- Mapbox GL JS for the main clustered map
- TanStack Query for API fetching, caching, retries, and partial failure handling
- React Router for dashboard/detail/404 routes
- Tailwind CSS for the responsive UI
- Recharts for detail-page charts
- Vitest + React Testing Library for tests

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set the environment values:

```bash
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_public_token
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Environment Variables

`VITE_API_BASE_URL`

Backend API base URL. Defaults to `https://noise-sensors-dashboard.herokuapp.com` when unset.

For local full-stack development, use `VITE_API_BASE_URL=/api` and set `VITE_API_PROXY_TARGET` to the local Django origin, normally `http://127.0.0.1:8000`. When the proxy target is omitted it defaults to the existing hosted backend. The development proxy also normalizes the request origin so Django's CSRF origin check sees the backend origin.

`VITE_API_PROXY_TARGET`

Development-only Vite proxy target. It is not read by the built browser application.

`VITE_MAPBOX_ACCESS_TOKEN`

Public Mapbox token used by Mapbox GL JS. The token is read only from the environment and is not hardcoded in source. If it is missing, the app keeps the dashboard usable and shows a clear map configuration state.

## Backend API v2

All active dashboard and portal routes use the UUID-based v2 contract:

- Anonymous public data: `/api/v2/public/...`
- Session authentication: `/api/v2/auth/csrf/`, `/login/`, `/logout/`, and `/me/`
- Private organization data: `/api/v2/portal/organizations/<organization_uuid>/...`
- Partner administration: organization-scoped `/members/` and `/invitations/`

Every request sends `credentials: "include"`. POST, PATCH, and DELETE requests initialize Django CSRF and send the `csrftoken` value as `X-CSRFToken`. Authentication uses the Django session cookie; credentials are never placed in browser storage.

The client follows paginated `next` links and normalizes backend snake_case responses into typed frontend models in `src/lib/api/v2.ts`. Public and private details are addressed by device UUID. Date-range charts use `start_date`, `end_date`, `granularity`, and `timezone=Africa/Kampala` on the scoped aggregate/history endpoints.

Platform-only operations—creating organizations, assigning devices, and changing PUBLIC/PRIVATE visibility—remain in Django admin. The frontend does not attempt to provide those controls.

## CORS

The Heroku API does not currently return `Access-Control-Allow-Origin` for browser requests from `localhost`, so direct frontend calls to `https://noise-sensors-dashboard.herokuapp.com` are blocked by CORS.

Local development uses the Vite proxy:

```bash
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

For the production partner portal, deploy a same-origin reverse proxy or edge/serverless function at `/api` and build with `VITE_API_BASE_URL=/api`. CORS headers alone are not enough for the current Django session-cookie design when the frontend and backend are on different sites. A deliberately cross-site deployment would also require coordinated backend cookie and CSRF policy changes.

The anonymous public API can still be called directly when the backend allows the deployed frontend origin. A static frontend cannot provide its own same-origin session proxy.

## Dashboard Behavior

- Filters invalid GPS coordinates, including `0,0` and out-of-range latitude/longitude.
- Prefers mobile coordinates when the backend supplies valid mobile coordinate fields.
- Fetches device metrics per sensor without failing the whole dashboard if one device request fails.
- Uses real backend values only; missing values are shown as `No data`.
- Detects sensor type as `MCU`, `MOBILE`, `AI`, or `Unknown` from device metadata and naming conventions.
- Keeps public devices without a mapped location visible in a separate device list.
- Supports direct refresh on `/locations/:deviceUuid` and organization-scoped private detail URLs.

## Partner Portal

- `/login` signs in with username or email and a Django session.
- `/portal` selects an active organization membership.
- `/portal/organizations/:organizationId` displays that organization's private devices.
- Partner administrators can list/deactivate members and create, resend, or revoke invitations under `/users`.
- Partner members do not receive the Users navigation and cannot render the administration page.
- `/accept-invitation/:token` supports both new users and existing authenticated accounts.

Frontend route checks improve the experience, but the Django API remains the authorization boundary for every organization and device request.

## Deployment

This is a static frontend. Any static host that supports SPA fallback routing can serve the `dist` directory generated by `npm run build`.

### GitHub Pages

The repo now includes a GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) that builds and deploys the app from `main`.

The current GitHub Pages workflow points directly at the hosted backend, which is suitable for anonymous public reads. Before enabling partner sign-in in production, move the deployment behind a host that can proxy `/api` on the same site (or add an equivalent edge proxy) and set `VITE_API_BASE_URL=/api`.

Before enabling it in GitHub, set these repository settings:

- Turn on Pages deployment from GitHub Actions in the repository settings.
- Add `VITE_MAPBOX_ACCESS_TOKEN` as a repository secret.

The app is configured for the custom domain root `https://noise.sunbird.ai/`, with `VITE_BASE_PATH=/` and [public/CNAME](public/CNAME). If you move back to a repository project URL, update the base path in [vite.config.ts](vite.config.ts), [.github/workflows/deploy.yml](.github/workflows/deploy.yml), and the redirect script in [public/404.html](public/404.html).

For production hosting, configure:

- Static asset root: `dist`
- SPA fallback: route unknown paths to `dist/index.html`
- Environment variables at build time: `VITE_API_BASE_URL`, `VITE_MAPBOX_ACCESS_TOKEN`
- If the backend CORS policy is unchanged, deploy a same-origin `/api` proxy and set `VITE_API_BASE_URL=/api`.

## Key Improvements

- Scoped v2 API layer with session/CSRF support, pagination, timeouts, normalization, and partial failure handling.
- One shared frontend for anonymous public devices and authenticated partner organizations.
- Partner administrator member and invitation management.
- Mapbox GL clustered map with dB labels, color-coded noise bands, and detail popups.
- Direct-load location detail pages with metric cards, daily/hourly charts, heatmap, and AI/environmental panels.
- Responsive dashboard layout with real loading, empty, error, and missing-configuration states.
- Lazy-loaded map and route chunks to keep the initial app bundle focused.
- Test coverage for normalization, sensor type detection, coordinate validation, dashboard states, and direct detail routing.

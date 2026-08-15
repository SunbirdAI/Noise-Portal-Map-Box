# Vercel deployment guide

This guide moves `noise.sunbird.ai` from GitHub Pages to Vercel. GitHub remains the source-code host. Vercel replaces GitHub Pages as the production web host and runs the same-origin API proxy required for Django session authentication.

Do not change DNS until the Vercel preview has passed the public checks and the backend is ready to trust the production frontend origin.

## 1. Create the Sunbird Vercel account

1. Visit [vercel.com/signup](https://vercel.com/signup) and continue with GitHub.
2. Use a Sunbird-owned Vercel team rather than leaving the production project under one person's private account.
3. Enable multi-factor authentication on the owning GitHub and Vercel accounts.
4. Invite at least one additional Sunbird administrator so production access is not held by one person.
5. When Vercel requests GitHub access, grant access to the frontend repository. Repository-only access is preferable if the organization does not want to authorize every repository.

## 2. Import the frontend repository

1. From the Vercel dashboard, select **Add New → Project**.
2. Import the GitHub repository containing `noise-portal-map-box`.
3. Configure the project:

   - Framework preset: `Vite`
   - Root directory: repository root (`.`)
   - Install command: `npm install` (the default is acceptable)
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node.js: a version satisfying `>=22.12.0`
   - Production branch: `main`

The committed `vercel.json` already contains the build/output settings, API rewrite and SPA fallback. The `api/proxy.ts` file becomes the Vercel Function.

## 3. Configure Vercel environments

Open **Project → Settings → Environment Variables**. Environment changes apply only to new deployments, so redeploy after changing them.

### Production

For the first import, keep `VITE_PARTNER_PORTAL_ENABLED=false`. This gives you a safe public-only Vercel production deployment while DNS and backend settings are prepared:

```dotenv
VITE_PARTNER_PORTAL_ENABLED=false
VITE_BASE_PATH=/
VITE_MAPBOX_ACCESS_TOKEN=<public Mapbox browser token>
VITE_PASSWORD_RESET_URL=https://noise-sensors-dashboard.herokuapp.com/accounts/password_reset/
VITE_INTERNAL_DASHBOARD_URL=https://noise-sensors-dashboard.herokuapp.com/
BACKEND_ORIGIN=https://noise-sensors-dashboard.herokuapp.com
```

Do not create `VITE_API_ORIGIN` in Vercel. Omitting it gives the required empty value and keeps browser requests on `/api/v2/...` at the frontend origin.

Do not rename `BACKEND_ORIGIN` to `VITE_BACKEND_ORIGIN`. Only the server-side Function may read the backend target.

After `noise.sunbird.ai` is attached, public checks pass, and the backend trusts that exact origin, change the **Production** value to:

```dotenv
VITE_PARTNER_PORTAL_ENABLED=true
```

Then redeploy and perform the authentication checklist below. The final production configuration uses `true`.

### Preview

Initially set Preview to public-only while infrastructure is being checked:

```dotenv
VITE_PARTNER_PORTAL_ENABLED=false
VITE_BASE_PATH=/
VITE_MAPBOX_ACCESS_TOKEN=<public Mapbox browser token>
BACKEND_ORIGIN=https://noise-sensors-dashboard.herokuapp.com
```

Leave `VITE_API_ORIGIN` unset. Public requests will still use the Vercel same-origin proxy, but login and invitation UI remain disabled.

To test partner authentication on a Vercel preview URL, that exact preview origin must first be accepted by the backend's CSRF configuration. Coordinate that change in the backend project; do not broadly trust arbitrary origins merely to make previews convenient.

## 4. Create and verify a preview deployment

Push the prepared branch or open a pull request after the frontend changes are committed through the normal team workflow. Vercel creates a `*.vercel.app` preview.

Before touching `noise.sunbird.ai`, confirm on the preview:

1. `/` loads public devices.
2. The Network panel shows browser requests to the preview hostname at `/api/v2/public/...`.
3. `GET /api/v2/public/devices/` returns HTTP 200 with `Content-Type: application/json`. If it returns `index.html` or `text/html`, the SPA fallback is intercepting the API route and the deployment must not be promoted.
4. The Function forwards the request to Heroku and returns the public device collection.
5. Direct refresh works for `/login`, `/portal`, and `/accept-invitation/test-token` without a Vercel 404. With Preview partner mode disabled, these routes may show the public-only unavailable state; they must still load React.
6. `/api/v2/auth/csrf/` responses are `Cache-Control: private, no-store`.
7. Invalid proxy targets such as `/api/proxy?__proxy_path=admin/` return 400 and are not sent upstream.

Vercel documents preview deployments and Vite projects in its [Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite).

## 5. Prepare the backend for the production hostname

Before partner login is enabled, the backend deployment must have:

- `https://noise.sunbird.ai` in `CSRF_TRUSTED_ORIGINS`;
- the production invitation base URL set to `https://noise.sunbird.ai/accept-invitation`;
- secure Django CSRF and session cookies;
- the backend self-deactivation and final-active-administrator safeguards completed.

These are backend/deployment responsibilities and are not changed by this frontend repository.

## 6. Attach `noise.sunbird.ai`

1. In Vercel, open **Project → Settings → Domains**.
2. Add `noise.sunbird.ai` to the project.
3. Vercel will display the DNS record it expects. At the DNS provider for `sunbird.ai`, replace the existing GitHub Pages record for `noise` with the exact Vercel value shown in the dashboard.
4. Wait until Vercel reports the domain and TLS certificate as valid.
5. Confirm public devices on `https://noise.sunbird.ai` while partner mode is still disabled.
6. Change the Production `VITE_PARTNER_PORTAL_ENABLED` value to `true` and redeploy only after the backend preparation is complete.

Because this is a subdomain, the usual change is a CNAME. Use the value displayed by Vercel rather than copying an old value from a guide. Vercel's current domain workflow is documented in [Adding and configuring a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Do not delete the GitHub Pages project before the Vercel preview is verified. During cutover, however, `noise.sunbird.ai` must resolve to only one host.

## 7. Production authentication verification

With browser storage cleared, verify:

1. `GET https://noise.sunbird.ai/api/v2/auth/csrf/` creates a `csrftoken` for `noise.sunbird.ai`.
2. Login sends `Cookie: csrftoken=...` and the matching `X-CSRFToken` to the same frontend URL.
3. Login creates a frontend-host `sessionid` cookie.
4. Refreshing a partner URL calls `/api/v2/auth/me/` and restores the session.
5. Organization URLs outside the user's active memberships start no organization queries and the backend still returns 404 if requested directly.
6. Logout clears the server session and organization caches.
7. No password, CSRF value, session value or invitation token appears in local or session storage.
8. Public and partner device detail pages retain their separate field sets.

Do not announce partner login as available until this checklist passes on the custom production hostname.

## 8. Retire GitHub Pages after cutover

After Vercel production is stable:

1. Disable the GitHub Pages deployment workflow or remove its automatic trigger in a separate reviewed change.
2. Disable the custom domain in GitHub Pages settings.
3. Remove `public/CNAME` once GitHub Pages is no longer a rollback target.
4. Keep GitHub itself connected to Vercel for source control and automatic deployments.

## Rollback

If the production proxy or authentication checks fail, keep partner login disabled and restore the `noise` DNS record to the previous GitHub Pages target. GitHub Pages supports only the public-only build:

```dotenv
VITE_API_ORIGIN=https://noise-sensors-dashboard.herokuapp.com
VITE_PARTNER_PORTAL_ENABLED=false
```

Never enable partner authentication on that fallback deployment.

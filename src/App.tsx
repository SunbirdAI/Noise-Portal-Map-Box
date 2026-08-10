import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth';
import AppShell from './components/AppShell';
import LoadingPanel from './components/LoadingPanel';
import NotFoundPage from './pages/NotFoundPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LocationDetailPage = lazy(() => import('./pages/LocationDetailPage'));
const InvitationAcceptPage = lazy(() => import('./pages/InvitationAcceptPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PartnerUsersPage = lazy(() => import('./pages/PartnerUsersPage'));
const PortalDashboardPage = lazy(() => import('./pages/PortalDashboardPage'));
const PortalDeviceDetailPage = lazy(() => import('./pages/PortalDeviceDetailPage'));
const PortalLandingPage = lazy(() => import('./pages/PortalLandingPage'));

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

export function createAppRouter() {
  return createBrowserRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        errorElement: <NotFoundPage />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingPanel title="Loading dashboard" />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: 'locations/:deviceId',
            element: (
              <Suspense fallback={<LoadingPanel title="Loading location details" />}>
                <LocationDetailPage />
              </Suspense>
            ),
          },
          {
            path: 'login',
            element: (
              <Suspense fallback={<LoadingPanel title="Loading sign in" />}>
                <LoginPage />
              </Suspense>
            ),
          },
          {
            path: 'accept-invitation/:token',
            element: (
              <Suspense fallback={<LoadingPanel title="Loading invitation" />}>
                <InvitationAcceptPage />
              </Suspense>
            ),
          },
          {
            path: 'portal',
            element: (
              <RequireAuth>
                <Suspense fallback={<LoadingPanel title="Loading partner portal" />}>
                  <PortalLandingPage />
                </Suspense>
              </RequireAuth>
            ),
          },
          {
            path: 'portal/organizations/:organizationId',
            element: (
              <RequireAuth>
                <Suspense fallback={<LoadingPanel title="Loading organization devices" />}>
                  <PortalDashboardPage />
                </Suspense>
              </RequireAuth>
            ),
          },
          {
            path: 'portal/organizations/:organizationId/devices/:deviceId',
            element: (
              <RequireAuth>
                <Suspense fallback={<LoadingPanel title="Loading device details" />}>
                  <PortalDeviceDetailPage />
                </Suspense>
              </RequireAuth>
            ),
          },
          {
            path: 'portal/organizations/:organizationId/users',
            element: (
              <RequireAuth>
                <Suspense fallback={<LoadingPanel title="Loading organization users" />}>
                  <PartnerUsersPage />
                </Suspense>
              </RequireAuth>
            ),
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
    {
      basename,
    },
  );
}

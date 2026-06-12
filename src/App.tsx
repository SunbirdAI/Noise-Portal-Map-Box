import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import AppShell from './components/AppShell';
import LoadingPanel from './components/LoadingPanel';
import NotFoundPage from './pages/NotFoundPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LocationDetailPage = lazy(() => import('./pages/LocationDetailPage'));

const basename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

const App = createBrowserRouter(
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
          path: 'locations/:locationId',
          element: (
            <Suspense fallback={<LoadingPanel title="Loading location details" />}>
              <LocationDetailPage />
            </Suspense>
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
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

export default App;

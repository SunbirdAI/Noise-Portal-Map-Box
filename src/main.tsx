import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function restoreGitHubPagesRoute() {
  const routeParam = new URLSearchParams(window.location.search).get('p');

  if (!routeParam) {
    return;
  }

  const redirectedUrl = new URL(decodeURIComponent(routeParam), window.location.origin);
  const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');

  window.history.replaceState(null, '', `${basePath}${redirectedUrl.pathname}${redirectedUrl.search}${redirectedUrl.hash}`);
}

restoreGitHubPagesRoute();
const appRouter = createAppRouter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={appRouter} future={{ v7_startTransition: true }} />
    </QueryClientProvider>
  </React.StrictMode>,
);

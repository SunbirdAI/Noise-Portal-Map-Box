import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingPanel from '../components/LoadingPanel';
import StatusPanel from '../components/StatusPanel';
import { useAuth } from './authContext';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return <LoadingPanel title="Checking your session" body="Confirming access to the partner portal." />;
  }

  if (auth.status === 'error') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <StatusPanel
          title="Authentication service unavailable"
          body="We could not confirm your partner session. Try again when the service is reachable; public device pages remain available."
          actionLabel="Try again"
          onAction={() => void auth.refresh()}
        />
      </div>
    );
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import LoadingPanel from '../components/LoadingPanel';
import { useAuth } from './authContext';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return <LoadingPanel title="Checking your session" body="Confirming access to the partner portal." />;
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

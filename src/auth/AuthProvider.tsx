import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '../models/portal';
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../lib/api/v2';
import { ApiError } from '../lib/api/errors';
import { PARTNER_PORTAL_ENABLED } from '../config/env';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import { clearPrivateQueries } from './privateCache';
import { PORTAL_AUTH_FAILURE_EVENT } from './sessionEvents';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string>();
  const queryClient = useQueryClient();
  const refreshInFlight = useRef<Promise<AuthUser | null>>();

  const refresh = useCallback(() => {
    if (!PARTNER_PORTAL_ENABLED) {
      setUser(null);
      setError(undefined);
      setStatus('anonymous');
      return Promise.resolve(null);
    }

    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }

    const request = (async () => {
      try {
        const nextUser = await fetchMe();
        setUser(nextUser);
        setError(undefined);
        setStatus('authenticated');
        return nextUser;
      } catch (nextError) {
        setUser(null);
        if (nextError instanceof ApiError && (nextError.status === 401 || nextError.status === 403)) {
          clearPrivateQueries(queryClient);
          setError(undefined);
          setStatus('anonymous');
        } else {
          setError('Authentication service is unavailable. Public device data may still be available.');
          setStatus('error');
        }
        return null;
      } finally {
        refreshInFlight.current = undefined;
      }
    })();

    refreshInFlight.current = request;
    return request;
  }, [queryClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const revalidateSession = () => void refresh();
    window.addEventListener(PORTAL_AUTH_FAILURE_EVENT, revalidateSession);
    return () => window.removeEventListener(PORTAL_AUTH_FAILURE_EVENT, revalidateSession);
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const nextUser = await loginRequest(identifier, password);
    setUser(nextUser);
    setError(undefined);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setError(undefined);
    setStatus('anonymous');
    clearPrivateQueries(queryClient);
  }, [queryClient]);

  const adoptUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    setError(undefined);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, login, logout, refresh, adoptUser }),
    [adoptUser, error, login, logout, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

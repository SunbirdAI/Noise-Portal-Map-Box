import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '../models/portal';
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../lib/api/v2';
import { ApiError } from '../lib/api/errors';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchMe();
      setUser(nextUser);
      setStatus('authenticated');
      return nextUser;
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) {
        // Public routes remain usable when session restoration cannot reach the backend.
      }
      setUser(null);
      setStatus('anonymous');
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const nextUser = await loginRequest(identifier, password);
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus('anonymous');
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === 'portal' ||
        query.queryKey.some((part) => typeof part === 'string' && part.startsWith('organization:')),
    });
  }, [queryClient]);

  const adoptUser = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, refresh, adoptUser }),
    [adoptUser, login, logout, refresh, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

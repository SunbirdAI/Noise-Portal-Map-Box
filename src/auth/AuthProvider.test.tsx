import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/errors';
import { fetchMe, logout } from '../lib/api/v2';
import type { AuthUser } from '../models/portal';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './authContext';
import { notifyPortalAuthFailure } from './sessionEvents';

vi.mock('../lib/api/v2', () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

const partnerUser: AuthUser = {
  id: 42,
  username: 'partner-user',
  email: 'partner@example.test',
  isPlatformAdministrator: false,
  memberships: [
    {
      id: 'membership-1',
      organization: { id: 'org-1', name: 'Partner One', slug: 'partner-one' },
      role: 'PARTNER_ADMIN',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
};

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <span>{auth.status}</span>
      <span>{auth.user?.email}</span>
      <span>{auth.error}</span>
      <button type="button" onClick={() => void auth.logout()}>Sign out test</button>
    </div>
  );
}

function renderProvider(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AuthProbe /></AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(fetchMe).mockReset();
    vi.mocked(logout).mockReset();
  });

  it('restores a valid session', async () => {
    vi.mocked(fetchMe).mockResolvedValue(partnerUser);
    renderProvider();

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('partner@example.test')).toBeInTheDocument();
  });

  it('uses anonymous only when the backend confirms no session', async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError('Authentication required.', '/api/v2/auth/me/', 403));
    renderProvider();

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(screen.queryByText(/service is unavailable/i)).not.toBeInTheDocument();
  });

  it('keeps backend and proxy failures distinct from anonymous', async () => {
    vi.mocked(fetchMe).mockRejectedValue(new ApiError('Bad gateway', '/api/v2/auth/me/', 502));
    renderProvider();

    expect(await screen.findByText('error')).toBeInTheDocument();
    expect(screen.getByText(/Authentication service is unavailable/i)).toBeInTheDocument();
  });

  it('revalidates after a portal permission failure and clears organization caches when the session expired', async () => {
    vi.mocked(fetchMe)
      .mockResolvedValueOnce(partnerUser)
      .mockRejectedValueOnce(new ApiError('Authentication required.', '/api/v2/auth/me/', 403));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['v2', 'device', 'organization:org-1', 'device-1'], { private: true });
    queryClient.setQueryData(['v2', 'devices', 'public'], { public: true });
    renderProvider(queryClient);
    await screen.findByText('authenticated');

    notifyPortalAuthFailure();

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(queryClient.getQueryData(['v2', 'device', 'organization:org-1', 'device-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['v2', 'devices', 'public'])).toEqual({ public: true });
  });

  it('clears private caches after logout', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMe).mockResolvedValue(partnerUser);
    vi.mocked(logout).mockResolvedValue();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['portal', 'org-1', 'members'], [{ private: true }]);
    renderProvider(queryClient);
    await screen.findByText('authenticated');

    await user.click(screen.getByRole('button', { name: 'Sign out test' }));

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
    expect(queryClient.getQueryData(['portal', 'org-1', 'members'])).toBeUndefined();
  });
});

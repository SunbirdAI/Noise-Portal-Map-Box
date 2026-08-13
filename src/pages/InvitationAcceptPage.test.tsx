import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { ApiError } from '../lib/api/errors';
import { acceptInvitation, fetchInvitation } from '../lib/api/v2';
import type { AuthUser, InvitationAcceptance, OrganizationInvitation } from '../models/portal';
import InvitationAcceptPage from './InvitationAcceptPage';

vi.mock('../lib/api/v2', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/v2')>('../lib/api/v2');
  return { ...actual, fetchInvitation: vi.fn(), acceptInvitation: vi.fn() };
});

const organization = { id: 'org-1', name: 'Partner One', slug: 'partner-one' };
const authenticatedUser: AuthUser = {
  id: 7,
  username: 'existing-user',
  email: 'invitee@example.test',
  isPlatformAdministrator: false,
  memberships: [],
};

function pendingInvitation(status: OrganizationInvitation['status'] = 'PENDING'): OrganizationInvitation {
  return {
    id: 'invite-1',
    organization,
    email: 'invitee@example.test',
    role: 'PARTNER_MEMBER',
    expiresAt: '2026-12-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    status,
  };
}

const acceptance: InvitationAcceptance = {
  detail: 'Invitation accepted.',
  membership: {
    id: 'membership-1',
    organization,
    role: 'PARTNER_MEMBER',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  user: { ...authenticatedUser, memberships: [] },
};

function LoginStateProbe() {
  const location = useLocation();
  return <span>return to {(location.state as { from?: string } | null)?.from}</span>;
}

function renderPage(status: 'anonymous' | 'authenticated' = 'anonymous') {
  const auth: AuthContextValue = {
    status,
    user: status === 'authenticated' ? authenticatedUser : null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(null),
    adoptUser: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/accept-invitation/secret-token']}>
          <Routes>
            <Route path="/accept-invitation/:token" element={<InvitationAcceptPage />} />
            <Route path="/portal/organizations/:organizationId" element={<span>organization dashboard</span>} />
            <Route path="/login" element={<LoginStateProbe />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return auth;
}

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    vi.mocked(fetchInvitation).mockReset();
    vi.mocked(acceptInvitation).mockReset();
    vi.mocked(fetchInvitation).mockResolvedValue(pendingInvitation());
  });

  it('accepts a new-user invitation with password confirmation and redirects to the organization', async () => {
    const user = userEvent.setup();
    vi.mocked(acceptInvitation).mockResolvedValue(acceptance);
    const auth = renderPage();
    await screen.findByRole('heading', { name: 'Join Partner One' });

    await user.type(screen.getByLabelText('Username'), 'new-user');
    await user.type(screen.getByLabelText('Password'), 'A-strong-password-123!');
    await user.type(screen.getByLabelText('Confirm password'), 'A-strong-password-123!');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByText('organization dashboard')).toBeInTheDocument();
    expect(acceptInvitation).toHaveBeenCalledWith('secret-token', {
      username: 'new-user',
      password: 'A-strong-password-123!',
    });
    expect(auth.adoptUser).toHaveBeenCalledWith(acceptance.user);
  });

  it('accepts for an existing authenticated account without sending a password', async () => {
    const user = userEvent.setup();
    vi.mocked(acceptInvitation).mockResolvedValue(acceptance);
    renderPage('authenticated');

    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));

    expect(await screen.findByText('organization dashboard')).toBeInTheDocument();
    expect(acceptInvitation).toHaveBeenCalledWith('secret-token', {});
  });

  it.each([
    ['EXPIRED', 'This invitation has expired. Ask an organization administrator to send a new invitation.'],
    ['REVOKED', 'This invitation was revoked by an organization administrator.'],
    ['ACCEPTED', 'This invitation has already been accepted and cannot be used again.'],
  ] as const)('explains the %s invitation state', async (status, message) => {
    vi.mocked(fetchInvitation).mockResolvedValue(pendingInvitation(status));
    renderPage();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });

  it('blocks a mismatched password before calling the backend', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Join Partner One' });
    await user.type(screen.getByLabelText('Password'), 'one-password');
    await user.type(screen.getByLabelText('Confirm password'), 'another-password');
    await user.click(screen.getByRole('button', { name: 'Accept invitation' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('shows backend password validation and existing-account conflicts clearly', async () => {
    const user = userEvent.setup();
    vi.mocked(acceptInvitation)
      .mockRejectedValueOnce(new ApiError('password: This password is too common.', '/api/v2/auth/invitations/token/', 400))
      .mockRejectedValueOnce(new ApiError('An account already exists for this email.', '/api/v2/auth/invitations/token/', 409));
    renderPage();
    await screen.findByRole('heading', { name: 'Join Partner One' });
    await user.type(screen.getByLabelText('Password'), 'matching-password');
    await user.type(screen.getByLabelText('Confirm password'), 'matching-password');
    const submit = screen.getByRole('button', { name: 'Accept invitation' });

    await user.click(submit);
    expect(await screen.findByText('password: This password is too common.')).toBeInTheDocument();
    await user.click(submit);
    expect(await screen.findByText(/An account already exists for this email.*Sign in with the existing account/i)).toBeInTheDocument();
  });

  it('preserves the invitation URL when the user chooses to sign in first', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('link', { name: 'Sign in first' }));
    expect(screen.getByText('return to /accept-invitation/secret-token')).toBeInTheDocument();
  });
});

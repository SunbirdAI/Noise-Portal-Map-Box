import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { ApiError } from '../lib/api/errors';
import {
  createInvitation,
  fetchInvitations,
  fetchMembers,
  resendInvitation,
  revokeInvitation,
  updateMembership,
} from '../lib/api/v2';
import type { AuthUser, ManagedMembership, OrganizationInvitation } from '../models/portal';
import PartnerUsersPage from './PartnerUsersPage';

vi.mock('../lib/api/v2', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/v2')>('../lib/api/v2');
  return {
    ...actual,
    fetchMembers: vi.fn(),
    fetchInvitations: vi.fn(),
    updateMembership: vi.fn(),
    createInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  };
});

const organization = { id: 'org-1', name: 'Partner One', slug: 'partner-one' };

function signedInUser(role: 'PARTNER_ADMIN' | 'PARTNER_MEMBER' = 'PARTNER_ADMIN'): AuthUser {
  return {
    id: 1,
    username: 'signed-in',
    email: 'signed-in@example.test',
    isPlatformAdministrator: false,
    memberships: [{ id: 'mine', organization, role, isActive: true, createdAt: '2026-01-01T00:00:00Z' }],
  };
}

function member(id: string, userId: number, role: 'PARTNER_ADMIN' | 'PARTNER_MEMBER', isActive = true): ManagedMembership {
  return {
    id,
    user: { id: userId, username: `user-${userId}`, email: `user-${userId}@example.test` },
    role,
    isActive,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function invitation(): OrganizationInvitation {
  return {
    id: 'invite-1',
    organization,
    email: 'invitee@example.test',
    role: 'PARTNER_MEMBER',
    expiresAt: '2026-12-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'PENDING',
  };
}

function renderPage(user: AuthUser, route = '/portal/organizations/org-1/users') {
  const auth: AuthContextValue = {
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(user),
    adoptUser: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/portal/organizations/:organizationId/users" element={<PartnerUsersPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return auth;
}

describe('PartnerUsersPage safeguards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(fetchMembers).mockReset();
    vi.mocked(fetchInvitations).mockReset();
    vi.mocked(updateMembership).mockReset();
    vi.mocked(createInvitation).mockReset();
    vi.mocked(resendInvitation).mockReset();
    vi.mocked(revokeInvitation).mockReset();
    vi.mocked(fetchMembers).mockResolvedValue([member('mine', 1, 'PARTNER_ADMIN'), member('other', 2, 'PARTNER_ADMIN')]);
    vi.mocked(fetchInvitations).mockResolvedValue([]);
  });

  it('does not render or query user administration for a partner member', async () => {
    renderPage(signedInUser('PARTNER_MEMBER'));
    expect(screen.getByText('Administrator access required')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMembers).not.toHaveBeenCalled();
      expect(fetchInvitations).not.toHaveBeenCalled();
    });
  });

  it('lets a partner administrator load their own organization management page', async () => {
    renderPage(signedInUser());
    expect(await screen.findByRole('heading', { name: 'Users and invitations' })).toBeInTheDocument();
    expect(fetchMembers).toHaveBeenCalledWith('org-1');
    expect(fetchInvitations).toHaveBeenCalledWith('org-1');
  });

  it('does not query members or invitations for another organization URL', async () => {
    renderPage(signedInUser(), '/portal/organizations/org-2/users');
    expect(screen.getByText('Administrator access required')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMembers).not.toHaveBeenCalled();
      expect(fetchInvitations).not.toHaveBeenCalled();
    });
  });

  it('disables self-deactivation and explains why', async () => {
    renderPage(signedInUser());
    const row = (await screen.findByText('user-1')).closest<HTMLElement>('div.flex-wrap')!;
    const button = within(row).getByRole('button', { name: 'Deactivate' });
    expect(button).toBeDisabled();
    expect(within(row).getByText('You cannot deactivate your own membership.')).toBeInTheDocument();
  });

  it('disables deactivating the last active partner administrator', async () => {
    vi.mocked(fetchMembers).mockResolvedValue([member('last-admin', 2, 'PARTNER_ADMIN'), member('ordinary', 3, 'PARTNER_MEMBER')]);
    renderPage(signedInUser());
    const row = (await screen.findByText('user-2')).closest<HTMLElement>('div.flex-wrap')!;
    expect(within(row).getByRole('button', { name: 'Deactivate' })).toBeDisabled();
    expect(within(row).getByText('The last active partner administrator cannot be deactivated.')).toBeInTheDocument();
  });

  it('requires deactivation confirmation and displays an exact backend rejection', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.mocked(updateMembership).mockRejectedValue(
      new ApiError('At least one active partner administrator is required.', '/api/v2/portal/members/other/', 409),
    );
    const user = userEvent.setup();
    renderPage(signedInUser());
    const row = (await screen.findByText('user-2')).closest<HTMLElement>('div.flex-wrap')!;
    const button = within(row).getByRole('button', { name: 'Deactivate' });

    await user.click(button);
    expect(updateMembership).not.toHaveBeenCalled();
    await user.click(button);

    expect(browserConfirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('At least one active partner administrator is required.')).toBeInTheDocument();
  });

  it('requires confirmation before revoking an invitation', async () => {
    const browserConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(fetchInvitations).mockResolvedValue([invitation()]);
    const user = userEvent.setup();
    renderPage(signedInUser());

    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(browserConfirm).toHaveBeenCalled();
    expect(revokeInvitation).not.toHaveBeenCalled();
  });
});

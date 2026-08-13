import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import type { AuthUser, OrganizationMembership } from '../models/portal';
import PortalLandingPage from './PortalLandingPage';

function membership(id: string, name: string): OrganizationMembership {
  return {
    id: `membership-${id}`,
    organization: { id, name, slug: name.toLowerCase().replace(' ', '-') },
    role: 'PARTNER_MEMBER',
    isActive: true,
    createdAt: '',
  };
}

function Destination() {
  return <span>destination {useLocation().pathname}</span>;
}

function renderLanding(memberships: OrganizationMembership[]) {
  const user: AuthUser = {
    id: 1,
    username: 'partner',
    email: 'partner@example.test',
    isPlatformAdministrator: false,
    memberships,
  };
  const auth: AuthContextValue = {
    status: 'authenticated',
    user,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(user),
    adoptUser: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/portal']}>
        <Routes>
          <Route path="/portal" element={<PortalLandingPage />} />
          <Route path="/portal/organizations/:organizationId" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PortalLandingPage', () => {
  it('redirects one active membership directly to its organization', () => {
    renderLanding([membership('org-1', 'Partner One')]);
    expect(screen.getByText('destination /portal/organizations/org-1')).toBeInTheDocument();
  });

  it('shows a selector for multiple active memberships', () => {
    renderLanding([membership('org-1', 'Partner One'), membership('org-2', 'Partner Two')]);
    expect(screen.getByRole('link', { name: /Partner One/ })).toHaveAttribute('href', '/portal/organizations/org-1');
    expect(screen.getByRole('link', { name: /Partner Two/ })).toHaveAttribute('href', '/portal/organizations/org-2');
  });

  it('shows a clear state when there are no active memberships', () => {
    renderLanding([]);
    expect(screen.getByText('No active organization membership')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import type { AuthUser } from '../models/portal';
import PortalDashboardPage from './PortalDashboardPage';
import PortalDeviceDetailPage from './PortalDeviceDetailPage';

const dashboardRender = vi.hoisted(() => vi.fn());
const detailRender = vi.hoisted(() => vi.fn());

vi.mock('./DashboardPage', () => ({
  default: (props: unknown) => {
    dashboardRender(props);
    return <span>organization devices loaded</span>;
  },
}));

vi.mock('./LocationDetailPage', () => ({
  default: (props: unknown) => {
    detailRender(props);
    return <span>organization device loaded</span>;
  },
}));

const organization = { id: 'org-1', name: 'Partner One', slug: 'partner-one' };

function renderRoute(path: string, element: React.ReactNode, user: AuthUser) {
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
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portal/organizations/:organizationId" element={element} />
          <Route path="/portal/organizations/:organizationId/devices/:deviceId" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function partnerUser(): AuthUser {
  return {
    id: 1,
    username: 'partner',
    email: 'partner@example.test',
    isPlatformAdministrator: false,
    memberships: [{ id: 'membership-1', organization, role: 'PARTNER_MEMBER', isActive: true, createdAt: '' }],
  };
}

describe('membership-driven portal routes', () => {
  it('does not start organization device queries for an organization outside active memberships', () => {
    dashboardRender.mockClear();
    renderRoute('/portal/organizations/org-2', <PortalDashboardPage />, partnerUser());
    expect(screen.getByText('Organization access unavailable')).toBeInTheDocument();
    expect(dashboardRender).not.toHaveBeenCalled();
  });

  it('passes an organization scope only after membership validation', () => {
    dashboardRender.mockClear();
    renderRoute('/portal/organizations/org-1', <PortalDashboardPage />, partnerUser());
    expect(screen.getByText('organization devices loaded')).toBeInTheDocument();
    expect(dashboardRender).toHaveBeenCalledWith(expect.objectContaining({ scope: { kind: 'organization', organizationId: 'org-1' } }));
  });

  it('does not let platform-only accounts bypass partner membership checks', () => {
    detailRender.mockClear();
    renderRoute(
      '/portal/organizations/arbitrary-org/devices/device-1',
      <PortalDeviceDetailPage />,
      { ...partnerUser(), isPlatformAdministrator: true, memberships: [] },
    );
    expect(screen.getByText('Organization access unavailable')).toBeInTheDocument();
    expect(detailRender).not.toHaveBeenCalled();
  });
});

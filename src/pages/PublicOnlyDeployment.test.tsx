import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';

vi.mock('../config/env', () => ({
  API_ORIGIN: 'https://noise-sensors-dashboard.herokuapp.com',
  PARTNER_PORTAL_ENABLED: false,
  PASSWORD_RESET_URL: '',
  INTERNAL_DASHBOARD_URL: '',
  SHOW_API_ORIGIN: false,
}));

import LoginPage from './LoginPage';
import AppShell from '../components/AppShell';

describe('public-only deployment UI', () => {
  it('does not expose the partner login form for an external API origin', () => {
    const auth: AuthContextValue = {
      status: 'anonymous',
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockResolvedValue(null),
      adoptUser: vi.fn(),
    };

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter><LoginPage /></MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText('Partner sign in is not available on this deployment')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('does not render partner navigation even if an authenticated value is supplied', () => {
    const auth: AuthContextValue = {
      status: 'authenticated',
      user: {
        id: 1,
        username: 'partner',
        email: 'partner@example.test',
        isPlatformAdministrator: false,
        memberships: [
          {
            id: 'membership-1',
            organization: { id: 'org-1', name: 'Partner One', slug: 'partner-one' },
            role: 'PARTNER_ADMIN',
            isActive: true,
            createdAt: '',
          },
        ],
      },
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockResolvedValue(null),
      adoptUser: vi.fn(),
    };

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter><AppShell /></MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.queryByText('Partner portal')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sign out')).not.toBeInTheDocument();
  });
});

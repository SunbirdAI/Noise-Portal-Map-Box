import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RequireAuth from './RequireAuth';
import { AuthContext } from './authContext';
import type { AuthContextValue } from './authContext';

function LocationProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <span>login destination: {state?.from}</span>;
}

function renderProtected(status: AuthContextValue['status']) {
  const auth: AuthContextValue = {
    status,
    user: null,
    error: status === 'error' ? 'Unavailable' : undefined,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(null),
    adoptUser: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/portal/organizations/org-1?tab=devices']}>
        <Routes>
          <Route path="/portal/organizations/:organizationId" element={<RequireAuth><span>private portal</span></RequireAuth>} />
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireAuth', () => {
  it('preserves the intended destination when a confirmed anonymous session redirects to login', () => {
    renderProtected('anonymous');
    expect(screen.getByText('login destination: /portal/organizations/org-1?tab=devices')).toBeInTheDocument();
  });

  it('shows service unavailable without redirecting when restoration failed', () => {
    renderProtected('error');
    expect(screen.getByText('Authentication service unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/login destination/)).not.toBeInTheDocument();
  });
});

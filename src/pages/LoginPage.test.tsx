import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/authContext';
import type { AuthContextValue } from '../auth/authContext';
import { ApiError } from '../lib/api/errors';
import LoginPage from './LoginPage';

vi.mock('../config/env', async () => {
  const actual = await vi.importActual<typeof import('../config/env')>('../config/env');
  return { ...actual, PASSWORD_RESET_URL: 'https://accounts.example.test/password-reset/' };
});

function renderLogin(login: AuthContextValue['login']) {
  const auth: AuthContextValue = {
    status: 'anonymous',
    user: null,
    login,
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(null),
    adoptUser: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function submitLogin() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Username or email'), 'partner@example.test');
  await user.type(screen.getByLabelText('Password'), 'password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  it('shows a configured password-reset entry point and exact invalid-credential feedback', async () => {
    renderLogin(vi.fn().mockRejectedValue(new ApiError('Invalid username/email or password.', '/api/v2/auth/login/', 403)));
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      'https://accounts.example.test/password-reset/',
    );
    await submitLogin();
    expect(await screen.findByText('Invalid username/email or password.')).toBeInTheDocument();
  });

  it('reports CSRF initialization failure separately', async () => {
    renderLogin(
      vi.fn().mockRejectedValue(
        new ApiError('Authentication security check failed: Proxy unavailable.', '/api/v2/auth/csrf/', 502, undefined, 'csrf'),
      ),
    );
    await submitLogin();
    expect(await screen.findByText('Authentication security check failed: Proxy unavailable.')).toBeInTheDocument();
  });
});

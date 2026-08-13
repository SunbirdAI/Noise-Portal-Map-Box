import { useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { PARTNER_PORTAL_ENABLED, PASSWORD_RESET_URL } from '../config/env';
import StatusPanel from '../components/StatusPanel';

interface LoginLocationState {
  from?: string;
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (auth.status === 'authenticated') {
    return <Navigate to={state?.from ?? '/portal'} replace />;
  }

  if (!PARTNER_PORTAL_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <StatusPanel
          title="Partner sign in is not available on this deployment"
          body="This host is configured for anonymous public devices only. Use the production partner portal to sign in."
        />
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      await auth.login(identifier.trim(), password);
      navigate(state?.from ?? '/portal', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white">
          <KeyRound size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-slate-950">Partner portal</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in to see the devices and users assigned to your organization.
        </p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-bold text-slate-700">
            Username or email
            <input
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 font-medium outline-none transition focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
            />
          </label>
          <div className="grid gap-1.5 text-sm font-bold text-slate-700">
            <span className="flex items-center justify-between gap-3">
              <label htmlFor="login-password">Password</label>
              {PASSWORD_RESET_URL ? (
                <a href={PASSWORD_RESET_URL} className="font-semibold text-lagoon hover:underline">
                  Forgot password?
                </a>
              ) : null}
            </span>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 font-medium outline-none transition focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          {auth.status === 'error' ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              Session restoration is unavailable. You can retry sign in, but the authentication service may still be offline.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            ) : (
              <LogIn size={17} aria-hidden="true" />
            )}
            {submitting ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}

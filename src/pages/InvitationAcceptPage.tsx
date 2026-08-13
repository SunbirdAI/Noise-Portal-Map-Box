import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import LoadingPanel from '../components/LoadingPanel';
import StatusPanel from '../components/StatusPanel';
import { acceptInvitation, fetchInvitation } from '../lib/api/v2';
import { ApiError } from '../lib/api/errors';
import { PARTNER_PORTAL_ENABLED } from '../config/env';

const inactiveInvitationMessage = {
  ACCEPTED: 'This invitation has already been accepted and cannot be used again.',
  REVOKED: 'This invitation was revoked by an organization administrator.',
  EXPIRED: 'This invitation has expired. Ask an organization administrator to send a new invitation.',
} as const;

export default function InvitationAcceptPage() {
  const { token = '' } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => fetchInvitation(token),
    enabled: Boolean(token) && PARTNER_PORTAL_ENABLED,
    retry: false,
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (!PARTNER_PORTAL_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <StatusPanel
          title="Invitation acceptance is not available on this deployment"
          body="Open this invitation on the production partner portal, which supports secure same-origin sessions."
        />
      </div>
    );
  }

  if (invitation.isPending || auth.status === 'loading') {
    return <LoadingPanel title="Checking invitation" body="Confirming the organization and invitation status." />;
  }

  if (invitation.isError || !invitation.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <StatusPanel title="Invitation unavailable" body="This invitation link is invalid, expired, revoked, or no longer available." />
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <StatusPanel
          title="Authentication service unavailable"
          body="We cannot safely determine whether this invitation should use an existing account. Try again before accepting it."
          actionLabel="Try again"
          onAction={() => void auth.refresh()}
        />
      </div>
    );
  }

  const data = invitation.data;
  const authenticated = auth.status === 'authenticated';
  const isPending = data.status === 'PENDING';

  async function handleAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!authenticated && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await acceptInvitation(token, authenticated ? {} : { username: username.trim() || undefined, password });
      auth.adoptUser(result.user);
      navigate(`/portal/organizations/${result.membership.organization.id}`, { replace: true });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'The invitation could not be accepted.';
      setError(
        nextError instanceof ApiError && nextError.status === 409
          ? `${message} Sign in with the existing account for this email, then reopen this invitation.`
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-3xl items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <MailCheck className="text-lagoon" size={38} aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black text-slate-950">Join {data.organization.name}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Invitation for <strong>{data.email}</strong> as {data.role === 'PARTNER_ADMIN' ? 'a partner administrator' : 'a partner member'}.
        </p>

        {!isPending ? (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            {inactiveInvitationMessage[data.status as keyof typeof inactiveInvitationMessage]}
          </p>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={handleAccept}>
            {authenticated ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Accepting as <strong>{auth.user?.email || auth.user?.username}</strong>.
              </p>
            ) : (
              <>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Username
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
                    placeholder="Optional"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Password
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                  Confirm password
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
                  />
                </label>
                <p className="text-xs leading-5 text-slate-500">
                  Use a strong, unique password. The server applies the final password validation rules.
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Already have an account with this email? <Link className="font-bold text-lagoon" to="/login" state={{ from: `/accept-invitation/${token}` }}>Sign in first</Link>.
                </p>
              </>
            )}

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Accepting invitation' : 'Accept invitation'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

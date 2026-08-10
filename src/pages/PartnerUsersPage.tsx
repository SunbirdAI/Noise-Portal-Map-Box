import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailPlus, RefreshCw, ShieldCheck, UserCheck, UserX, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { membershipForOrganization } from '../auth/access';
import { useAuth } from '../auth/authContext';
import Badge from '../components/Badge';
import LoadingPanel from '../components/LoadingPanel';
import PortalNavigation from '../components/PortalNavigation';
import StatusPanel from '../components/StatusPanel';
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
  updateMembership,
} from '../lib/api/v2';
import { invitationsQuery, membersQuery } from '../lib/api/v2Queries';
import { formatDateTime } from '../lib/format';
import type { OrganizationSummary, PartnerRole } from '../models/portal';

export default function PartnerUsersPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = membershipForOrganization(user, organizationId);
  const hasPlatformAccess = Boolean(user?.isPlatformAdministrator);
  const canManageUsers = membership?.role === 'PARTNER_ADMIN' || hasPlatformAccess;
  const organization: OrganizationSummary = membership?.organization ?? {
    id: organizationId,
    name: 'Organization',
    slug: '',
  };
  const membersResult = useQuery(membersQuery(organizationId, canManageUsers));
  const invitationsResult = useQuery(invitationsQuery(organizationId, canManageUsers));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PartnerRole>('PARTNER_MEMBER');
  const [formMessage, setFormMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  const memberMutation = useMutation({
    mutationFn: ({ membershipId, isActive }: { membershipId: string; isActive: boolean }) =>
      updateMembership(organizationId, membershipId, isActive),
    onSuccess: async () => {
      setActionError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['portal', organizationId, 'members'] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'The member could not be updated.'),
  });

  const invitationMutation = useMutation({
    mutationFn: () => createInvitation(organizationId, email.trim(), role),
    onSuccess: async (invitation) => {
      setEmail('');
      setFormMessage(`Invitation created for ${invitation.email}.`);
      setActionError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['portal', organizationId, 'invitations'] });
    },
    onError: async (error) => {
      setFormMessage(undefined);
      setActionError(error instanceof Error ? error.message : 'The invitation could not be created.');
      await queryClient.invalidateQueries({ queryKey: ['portal', organizationId, 'invitations'] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => resendInvitation(organizationId, invitationId),
    onSuccess: async () => {
      setFormMessage('Invitation email resent.');
      setActionError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['portal', organizationId, 'invitations'] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'The invitation could not be resent.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(organizationId, invitationId),
    onSuccess: async () => {
      setFormMessage('Invitation revoked.');
      setActionError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['portal', organizationId, 'invitations'] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'The invitation could not be revoked.'),
  });

  if (!canManageUsers) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Administrator access required"
          body="Only a partner administrator can view members or send invitations for this organization."
        />
      </div>
    );
  }

  if (membersResult.isPending || invitationsResult.isPending) {
    return <LoadingPanel title="Loading organization users" body="Fetching members and invitations." />;
  }

  return (
    <>
      <PortalNavigation organization={organization} canManageUsers />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-lagoon">Access management</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Users and invitations</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Manage who can sign in to {organization.name}. Device visibility is enforced by the backend membership.
          </p>
        </div>

        {actionError ? (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">
            {actionError}
          </p>
        ) : null}
        {formMessage ? (
          <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
            {formMessage}
          </p>
        ) : null}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <MailPlus size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Invite a user</h2>
              <p className="text-sm text-slate-600">The email link lets a new or existing user join this organization.</p>
            </div>
          </div>
          <form
            className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(undefined);
              invitationMutation.mutate();
            }}
          >
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as PartnerRole)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
              >
                <option value="PARTNER_MEMBER">Partner member</option>
                <option value="PARTNER_ADMIN">Partner administrator</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={invitationMutation.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <MailPlus size={16} aria-hidden="true" />
              {invitationMutation.isPending ? 'Sending' : 'Send invitation'}
            </button>
          </form>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-950">Members</h2>
            <p className="mt-1 text-sm text-slate-600">Active members can see this organization’s private devices.</p>
          </div>
          {membersResult.isError ? (
            <InlineError label="Members could not be loaded." onRetry={() => void membersResult.refetch()} />
          ) : membersResult.data?.length ? (
            <div className="divide-y divide-slate-100">
              {membersResult.data.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-950">{item.user.username || item.user.email}</p>
                    <p className="truncate text-sm text-slate-500">{item.user.email || 'No email address'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={item.role === 'PARTNER_ADMIN' ? 'blue' : 'neutral'}>
                        {item.role === 'PARTNER_ADMIN' ? 'Administrator' : 'Member'}
                      </Badge>
                      <Badge tone={item.isActive ? 'green' : 'neutral'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={memberMutation.isPending}
                    onClick={() => memberMutation.mutate({ membershipId: item.id, isActive: !item.isActive })}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {item.isActive ? <UserX size={16} aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}
                    {item.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyRow label="No organization members were returned." />
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-950">Invitations</h2>
            <p className="mt-1 text-sm text-slate-600">Pending, accepted, revoked, and expired invitations.</p>
          </div>
          {invitationsResult.isError ? (
            <InlineError label="Invitations could not be loaded." onRetry={() => void invitationsResult.refetch()} />
          ) : invitationsResult.data?.length ? (
            <div className="divide-y divide-slate-100">
              {invitationsResult.data.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-slate-950">{invitation.email}</p>
                    <p className="mt-1 text-sm text-slate-500">Expires {formatDateTime(invitation.expiresAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={invitation.role === 'PARTNER_ADMIN' ? 'blue' : 'neutral'}>
                        {invitation.role === 'PARTNER_ADMIN' ? 'Administrator' : 'Member'}
                      </Badge>
                      <Badge tone={invitation.status === 'PENDING' ? 'green' : 'neutral'}>{invitation.status}</Badge>
                    </div>
                  </div>
                  {invitation.status === 'PENDING' ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={resendMutation.isPending || revokeMutation.isPending}
                        onClick={() => resendMutation.mutate(invitation.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <RefreshCw size={15} aria-hidden="true" />
                        Resend
                      </button>
                      <button
                        type="button"
                        disabled={resendMutation.isPending || revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(invitation.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <XCircle size={15} aria-hidden="true" />
                        Revoke
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
                      <ShieldCheck size={16} aria-hidden="true" />
                      No action needed
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyRow label="No invitations have been created." />
          )}
        </section>
      </div>
    </>
  );
}

function InlineError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-5 text-sm font-semibold text-amber-900">
      <span>{label}</span>
      <button type="button" onClick={onRetry} className="rounded-lg border border-slate-200 px-3 py-2 font-extrabold text-slate-700">
        Retry
      </button>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="px-5 py-6 text-sm text-slate-500">{label}</p>;
}

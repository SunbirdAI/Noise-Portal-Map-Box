import { Building2, ChevronRight, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

export default function PortalLandingPage() {
  const { user } = useAuth();
  const memberships = user?.memberships.filter((membership) => membership.isActive) ?? [];

  if (memberships.length === 1) {
    return <Navigate to={`/portal/organizations/${memberships[0].organization.id}`} replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-lagoon">Partner portal</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Choose an organization</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Each organization has an isolated device fleet and user directory.
        </p>
      </div>

      {memberships.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {memberships.map((membership) => (
            <Link
              key={membership.id}
              to={`/portal/organizations/${membership.organization.id}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Building2 size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-extrabold text-slate-950">{membership.organization.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                    <ShieldCheck size={13} aria-hidden="true" />
                    {membership.role === 'PARTNER_ADMIN' ? 'Partner administrator' : 'Partner member'}
                  </span>
                </span>
              </span>
              <ChevronRight className="text-slate-400 transition group-hover:translate-x-1" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-extrabold text-slate-950">No active organization membership</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ask your partner administrator or Sunbird platform administrator to add your account.
          </p>
        </div>
      )}
    </div>
  );
}

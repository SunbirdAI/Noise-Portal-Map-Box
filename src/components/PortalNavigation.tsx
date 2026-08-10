import { LayoutDashboard, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { OrganizationSummary } from '../models/portal';

export default function PortalNavigation({
  organization,
  canManageUsers,
}: {
  organization: OrganizationSummary;
  canManageUsers: boolean;
}) {
  const basePath = `/portal/organizations/${organization.id}`;

  return (
    <div className="border-b border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-sky-300">Partner workspace</p>
          <p className="truncate font-extrabold">{organization.name}</p>
        </div>
        <nav className="flex items-center gap-1" aria-label={`${organization.name} navigation`}>
          <PortalLink to={basePath} end icon={<LayoutDashboard size={15} aria-hidden="true" />}>
            Devices
          </PortalLink>
          {canManageUsers ? (
            <PortalLink to={`${basePath}/users`} icon={<Users size={15} aria-hidden="true" />}>
              Users
            </PortalLink>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

function PortalLink({
  to,
  end = false,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold transition',
          isActive ? 'bg-white text-slate-950' : 'text-slate-200 hover:bg-white/10 hover:text-white',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

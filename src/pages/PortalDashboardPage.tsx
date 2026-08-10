import { useParams } from 'react-router-dom';
import { membershipForOrganization } from '../auth/access';
import { useAuth } from '../auth/authContext';
import PortalNavigation from '../components/PortalNavigation';
import StatusPanel from '../components/StatusPanel';
import type { OrganizationSummary } from '../models/portal';
import DashboardPage from './DashboardPage';

export default function PortalDashboardPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const membership = membershipForOrganization(user, organizationId);
  const hasPlatformAccess = Boolean(user?.isPlatformAdministrator);

  if (!membership && !hasPlatformAccess) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Organization access unavailable"
          body="Your account does not have an active membership for this organization."
        />
      </div>
    );
  }

  const organization: OrganizationSummary = membership?.organization ?? {
    id: organizationId,
    name: 'Organization devices',
    slug: '',
  };
  const canManageUsers = membership?.role === 'PARTNER_ADMIN' || hasPlatformAccess;
  const basePath = `/portal/organizations/${organizationId}`;

  return (
    <>
      <PortalNavigation organization={organization} canManageUsers={canManageUsers} />
      <DashboardPage
        scope={{ kind: 'organization', organizationId }}
        title={organization.name}
        subtitle="Private organization device fleet"
        detailPath={(deviceId) => `${basePath}/devices/${encodeURIComponent(deviceId)}`}
        portal
      />
    </>
  );
}

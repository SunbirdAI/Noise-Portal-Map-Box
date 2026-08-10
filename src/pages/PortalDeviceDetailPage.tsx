import { useParams } from 'react-router-dom';
import { membershipForOrganization } from '../auth/access';
import { useAuth } from '../auth/authContext';
import PortalNavigation from '../components/PortalNavigation';
import StatusPanel from '../components/StatusPanel';
import type { OrganizationSummary } from '../models/portal';
import LocationDetailPage from './LocationDetailPage';

export default function PortalDeviceDetailPage() {
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
  const dashboardPath = `/portal/organizations/${organizationId}`;

  return (
    <>
      <PortalNavigation organization={organization} canManageUsers={canManageUsers} />
      <LocationDetailPage
        scope={{ kind: 'organization', organizationId }}
        backPath={dashboardPath}
        backLabel={`${organization.name} devices`}
      />
    </>
  );
}

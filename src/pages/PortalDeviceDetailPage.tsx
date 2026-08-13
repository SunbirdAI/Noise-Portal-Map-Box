import { useParams } from 'react-router-dom';
import { membershipForOrganization } from '../auth/access';
import { useAuth } from '../auth/authContext';
import PortalNavigation from '../components/PortalNavigation';
import StatusPanel from '../components/StatusPanel';
import LocationDetailPage from './LocationDetailPage';

export default function PortalDeviceDetailPage() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const membership = membershipForOrganization(user, organizationId);

  if (!membership) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Organization access unavailable"
          body="Your account does not have an active membership for this organization."
        />
      </div>
    );
  }

  const organization = membership.organization;
  const canManageUsers = membership.role === 'PARTNER_ADMIN';
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

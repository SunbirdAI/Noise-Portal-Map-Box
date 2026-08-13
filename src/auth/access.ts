import type { AuthUser, OrganizationMembership } from '../models/portal';

export function membershipForOrganization(
  user: AuthUser | null,
  organizationId: string | undefined,
): OrganizationMembership | undefined {
  return user?.memberships.find(
    (membership) => membership.isActive && membership.organization.id === organizationId,
  );
}

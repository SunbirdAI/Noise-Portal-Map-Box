import type { DeviceInfo, SensorLocation, SensorType } from './sensor';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export type PartnerRole = 'PARTNER_ADMIN' | 'PARTNER_MEMBER';

export interface OrganizationMembership {
  id: string;
  organization: OrganizationSummary;
  role: PartnerRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  isPlatformAdministrator: boolean;
  memberships: OrganizationMembership[];
}

export type ApiScope =
  | { kind: 'public' }
  | { kind: 'organization'; organizationId: string };

export const PUBLIC_SCOPE: ApiScope = { kind: 'public' };

export interface ScopedDevice {
  id: string;
  deviceId: string;
  displayName: string;
  sensorType: SensorType;
  rawDeviceType?: string;
  versionNumber?: string;
  productionStage?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  organization?: OrganizationSummary;
  location?: SensorLocation;
  lastSeen?: string;
}

export interface MemberUser {
  id: number;
  username: string;
  email: string;
}

export interface ManagedMembership {
  id: string;
  user: MemberUser;
  role: PartnerRole;
  isActive: boolean;
  createdAt: string;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface OrganizationInvitation {
  id: string;
  organization: OrganizationSummary;
  email: string;
  role: PartnerRole;
  invitedBy?: MemberUser;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  status: InvitationStatus;
}

export interface InvitationAcceptance {
  detail: string;
  membership: OrganizationMembership;
  user: AuthUser;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ScopedDeviceLiveContext {
  scopedDevice: ScopedDevice;
  deviceInfo: DeviceInfo;
}

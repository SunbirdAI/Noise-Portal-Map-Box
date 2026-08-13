import { queryOptions } from '@tanstack/react-query';
import type { ApiScope, ScopedDevice } from '../../models/portal';
import type { AdvisorAudience, AdvisorLanguage, NoiseAdvisorInsight } from '../../models/sensor';
import type { DateRangeSelection } from '../dateRanges';
import { fetchScopedSensorLiveData, fetchScopedSensorRangeData } from '../v2SensorData';
import {
  fetchInvitations,
  fetchMembers,
  fetchScopedAdvisor,
  fetchScopedDevice,
  fetchScopedDevices,
  scopeKey,
} from './v2';

const LIVE_SENSOR_POLL_MS = 60_000;
const ADVISOR_GENERATING_RETRY_MS = 4_000;

export const scopedDevicesQuery = (scope: ApiScope) =>
  queryOptions({
    queryKey: ['v2', 'devices', scopeKey(scope)],
    queryFn: () => fetchScopedDevices(scope),
    staleTime: 5 * 60_000,
  });

export const scopedDeviceQuery = (scope: ApiScope, deviceId: string) =>
  queryOptions({
    queryKey: ['v2', 'device', scopeKey(scope), deviceId],
    queryFn: () => fetchScopedDevice(scope, deviceId),
    enabled: Boolean(deviceId),
    staleTime: 60_000,
  });

export const scopedLiveSensorQuery = (scope: ApiScope, device: ScopedDevice | undefined) =>
  queryOptions({
    queryKey: ['v2', 'sensorLiveData', scopeKey(scope), device?.id ?? ''],
    queryFn: () => fetchScopedSensorLiveData(scope, device!),
    enabled: Boolean(device?.id),
    staleTime: 45_000,
    refetchInterval: LIVE_SENSOR_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always' as const,
  });

export const scopedSensorRangeQuery = (
  scope: ApiScope,
  device: ScopedDevice | undefined,
  range: DateRangeSelection,
) =>
  queryOptions({
    queryKey: ['v2', 'sensorRangeData', scopeKey(scope), device?.id ?? '', range.startDate, range.endDate],
    queryFn: () => fetchScopedSensorRangeData(scope, device!, range),
    enabled: Boolean(device?.id),
    staleTime: 60_000,
  });

export const scopedAdvisorQuery = (
  scope: ApiScope,
  deviceId: string,
  lang: AdvisorLanguage,
  audience: AdvisorAudience,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: ['v2', 'advisorInsight', scopeKey(scope), deviceId, lang, audience],
    queryFn: () => fetchScopedAdvisor(scope, deviceId, lang, audience),
    enabled: Boolean(deviceId) && enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as NoiseAdvisorInsight | undefined;
      return data?.status === 'generating' && query.state.dataUpdateCount <= 1 && query.state.fetchStatus !== 'fetching'
        ? ADVISOR_GENERATING_RETRY_MS
        : false;
    },
  });

export const membersQuery = (organizationId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ['portal', organizationId, 'members'],
    queryFn: () => fetchMembers(organizationId),
    enabled: Boolean(organizationId) && enabled,
  });

export const invitationsQuery = (organizationId: string, enabled: boolean) =>
  queryOptions({
    queryKey: ['portal', organizationId, 'invitations'],
    queryFn: () => fetchInvitations(organizationId),
    enabled: Boolean(organizationId) && enabled,
  });

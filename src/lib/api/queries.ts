import { queryOptions } from '@tanstack/react-query';
import {
  fetchAiInference,
  fetchAllLocations,
  fetchDeviceByName,
  fetchDeviceInsight,
  fetchEnvironmentalReading,
  fetchLocationMetrics,
} from './client';
import { fetchSensorLiveData } from '../liveSensorData';
import { fetchSensorRangeData } from '../rangeSensorData';
import type { DateRangeSelection } from '../dateRanges';
import type { AdvisorAudience, AdvisorLanguage, NoiseAdvisorInsight } from '../../models/sensor';

const ADVISOR_GENERATING_RETRY_MS = 4_000;

export const locationsQuery = () =>
  queryOptions({
    queryKey: ['locations'],
    queryFn: fetchAllLocations,
    staleTime: 5 * 60_000,
  });

export const locationMetricsQuery = (locationId: string) =>
  queryOptions({
    queryKey: ['locationMetrics', locationId],
    queryFn: () => fetchLocationMetrics(locationId),
    staleTime: 2 * 60_000,
    enabled: Boolean(locationId),
  });

export const deviceQuery = (deviceName: string) =>
  queryOptions({
    queryKey: ['device', deviceName],
    queryFn: () => fetchDeviceByName(deviceName),
    staleTime: 60_000,
    enabled: Boolean(deviceName),
  });

export const liveSensorQuery = (deviceName: string) =>
  queryOptions({
    queryKey: ['sensorLiveData', deviceName],
    queryFn: () => fetchSensorLiveData(deviceName),
    staleTime: 45_000,
    enabled: Boolean(deviceName),
  });

export const sensorRangeDataQuery = (deviceName: string, range: DateRangeSelection) =>
  queryOptions({
    queryKey: ['sensorRangeData', deviceName, range.startDate, range.endDate],
    queryFn: () => fetchSensorRangeData(deviceName, range),
    staleTime: 60_000,
    enabled: Boolean(deviceName),
  });

export const aiInferenceQuery = (deviceName: string) =>
  queryOptions({
    queryKey: ['aiInference', deviceName],
    queryFn: () => fetchAiInference(deviceName),
    staleTime: 60_000,
    enabled: Boolean(deviceName),
    retry: false,
  });

export const advisorQuery = (
  deviceName: string,
  lang: AdvisorLanguage,
  audience: AdvisorAudience,
  enabled = Boolean(deviceName),
) =>
  queryOptions({
    queryKey: ['advisorInsight', deviceName, lang, audience],
    queryFn: () => fetchDeviceInsight(deviceName, lang, audience),
    staleTime: 5 * 60_000,
    enabled: Boolean(deviceName) && enabled,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as NoiseAdvisorInsight | undefined;

      if (data?.status === 'generating' && query.state.dataUpdateCount <= 1 && query.state.fetchStatus !== 'fetching') {
        return ADVISOR_GENERATING_RETRY_MS;
      }

      return false;
    },
  });

export const environmentalQuery = (deviceName: string) =>
  queryOptions({
    queryKey: ['environmental', deviceName],
    queryFn: () => fetchEnvironmentalReading(deviceName),
    staleTime: 60_000,
    enabled: Boolean(deviceName),
    retry: false,
  });

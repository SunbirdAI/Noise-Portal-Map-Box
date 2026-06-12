import { queryOptions } from '@tanstack/react-query';
import {
  fetchAiInference,
  fetchAllLocations,
  fetchDeviceByName,
  fetchEnvironmentalReading,
  fetchLocationMetrics,
} from './client';
import { fetchSensorLiveData } from '../liveSensorData';
import { fetchSensorRangeData } from '../rangeSensorData';
import type { DateRangeSelection } from '../dateRanges';

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

export const environmentalQuery = (deviceName: string) =>
  queryOptions({
    queryKey: ['environmental', deviceName],
    queryFn: () => fetchEnvironmentalReading(deviceName),
    staleTime: 60_000,
    enabled: Boolean(deviceName),
    retry: false,
  });

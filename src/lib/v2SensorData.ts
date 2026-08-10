import type { ApiScope, ScopedDevice } from '../models/portal';
import type { AiInference, EnvironmentalReading, NoiseMetric, SensorLiveData } from '../models/sensor';
import { KAMPALA_TIME_ZONE } from './dateRanges';
import type { DateRangeSelection } from './dateRanges';
import {
  fetchCurrentEnvironmental,
  fetchCurrentInference,
  fetchCurrentMetric,
  fetchEnvironmentalHistory,
  fetchInferenceHistory,
  fetchMetricAggregates,
  scopedDeviceInfo,
} from './api/v2';

export async function fetchScopedSensorLiveData(
  scope: ApiScope,
  device: ScopedDevice,
): Promise<SensorLiveData> {
  if (device.sensorType === 'AI') {
    const [environmentResult, inferenceResult] = await Promise.allSettled([
      fetchCurrentEnvironmental(scope, device.id),
      fetchCurrentInference(scope, device.id),
    ]);
    const environment = environmentResult.status === 'fulfilled' ? environmentResult.value : undefined;
    const inference = inferenceResult.status === 'fulfilled' ? inferenceResult.value : undefined;

    return {
      type: device.sensorType,
      deviceName: device.deviceId,
      latestNoise: environment?.dbLevel ?? null,
      lastUpdated: environment?.createdAt ?? inference?.createdAt ?? device.lastSeen ?? null,
      battery: null,
      device: scopedDeviceInfo(device),
      environment,
      inference,
    };
  }

  const metric = await fetchCurrentMetric(scope, device.id);
  return {
    type: device.sensorType,
    deviceName: device.deviceId,
    latestNoise: metric?.dbLevel ?? metric?.avgDbLevel ?? null,
    lastUpdated: metric?.uploadedAt ?? device.lastSeen ?? null,
    battery: metric?.batteryVoltage ?? null,
    device: scopedDeviceInfo(device, metric ? [metric] : []),
    metric,
    metrics: metric ? [metric] : [],
  };
}

export interface ScopedSensorRangeData {
  hourlyMetrics: NoiseMetric[];
  dailyMetrics: NoiseMetric[];
  environmentalHistory: EnvironmentalReading[];
  inferenceHistory: AiInference[];
  partialFailures: string[];
  rangeNotices: string[];
  source: 'device-aggregates' | 'ai-history';
}

export async function fetchScopedSensorRangeData(
  scope: ApiScope,
  device: ScopedDevice,
  range: DateRangeSelection,
): Promise<ScopedSensorRangeData> {
  if (device.sensorType === 'AI') {
    const [environmentResult, inferenceResult] = await Promise.allSettled([
      fetchEnvironmentalHistory(scope, device.id, range),
      fetchInferenceHistory(scope, device.id, range),
    ]);
    const environmentalHistory = environmentResult.status === 'fulfilled' ? environmentResult.value.results : [];
    const inferenceHistory = inferenceResult.status === 'fulfilled' ? inferenceResult.value.results : [];

    return {
      hourlyMetrics: environmentalHistoryToMetrics(environmentalHistory),
      dailyMetrics: [],
      environmentalHistory,
      inferenceHistory,
      partialFailures: [
        ...(environmentResult.status === 'rejected' ? ['Environmental history'] : []),
        ...(inferenceResult.status === 'rejected' ? ['Inference history'] : []),
      ],
      rangeNotices: [
        ...(environmentResult.status === 'fulfilled' && environmentResult.value.truncated
          ? [`Showing ${environmentResult.value.results.length} of ${environmentResult.value.count} environmental readings.`]
          : []),
        ...(inferenceResult.status === 'fulfilled' && inferenceResult.value.truncated
          ? [`Showing ${inferenceResult.value.results.length} of ${inferenceResult.value.count} inference readings.`]
          : []),
      ],
      source: 'ai-history',
    };
  }

  const [hourlyResult, dailyResult] = await Promise.allSettled([
    fetchMetricAggregates(scope, device.id, {
      ...range,
      granularity: 'hourly',
      timezone: KAMPALA_TIME_ZONE,
    }),
    fetchMetricAggregates(scope, device.id, {
      ...range,
      granularity: 'daily',
      timezone: KAMPALA_TIME_ZONE,
    }),
  ]);

  if (hourlyResult.status === 'rejected' && dailyResult.status === 'rejected') {
    throw hourlyResult.reason instanceof Error ? hourlyResult.reason : new Error('Unable to load range metrics');
  }

  return {
    hourlyMetrics: hourlyResult.status === 'fulfilled' ? hourlyResult.value.results : [],
    dailyMetrics: dailyResult.status === 'fulfilled' ? dailyResult.value.results : [],
    environmentalHistory: [],
    inferenceHistory: [],
    partialFailures: [
      ...(hourlyResult.status === 'rejected' ? ['Hourly aggregates'] : []),
      ...(dailyResult.status === 'rejected' ? ['Daily aggregates'] : []),
    ],
    rangeNotices: [],
    source: 'device-aggregates',
  };
}

function environmentalHistoryToMetrics(readings: EnvironmentalReading[]): NoiseMetric[] {
  return readings
    .filter((reading) => reading.createdAt || reading.dbLevel !== undefined)
    .map((reading) => ({
      id: reading.id === undefined ? undefined : String(reading.id),
      deviceName: reading.deviceName,
      dbLevel: reading.dbLevel,
      uploadedAt: reading.createdAt,
    }));
}

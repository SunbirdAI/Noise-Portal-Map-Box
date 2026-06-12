import type { AiInference, EnvironmentalReading, NoiseMetric } from '../models/sensor';
import {
  fetchAiInferenceHistory,
  fetchDeviceMetricAggregates,
  fetchEnvironmentalHistory,
} from './api/client';
import { KAMPALA_TIME_ZONE } from './dateRanges';
import type { DateRangeSelection } from './dateRanges';
import { isSeasDeviceName } from './sensors';

export interface SensorRangeData {
  hourlyMetrics: NoiseMetric[];
  dailyMetrics: NoiseMetric[];
  environmentalHistory: EnvironmentalReading[];
  inferenceHistory: AiInference[];
  partialFailures: string[];
  rangeNotices: string[];
  source: 'device-aggregates' | 'ai-history';
}

export async function fetchSensorRangeData(deviceName: string, range: DateRangeSelection): Promise<SensorRangeData> {
  if (isSeasDeviceName(deviceName)) {
    const [environmentResult, inferenceResult] = await Promise.allSettled([
      fetchEnvironmentalHistory(deviceName, range),
      fetchAiInferenceHistory(deviceName, range),
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
          ? [`Showing latest ${environmentResult.value.results.length} of ${environmentResult.value.count} environmental readings in this range.`]
          : []),
        ...(inferenceResult.status === 'fulfilled' && inferenceResult.value.truncated
          ? [`Showing latest ${inferenceResult.value.results.length} of ${inferenceResult.value.count} inference readings in this range.`]
          : []),
      ],
      source: 'ai-history',
    };
  }

  const [hourlyResult, dailyResult] = await Promise.allSettled([
    fetchDeviceMetricAggregates(deviceName, {
      ...range,
      granularity: 'hourly',
      timezone: KAMPALA_TIME_ZONE,
    }),
    fetchDeviceMetricAggregates(deviceName, {
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
    rangeNotices: [
      ...(hourlyResult.status === 'fulfilled' && hourlyResult.value.truncated
        ? [`Showing first ${hourlyResult.value.results.length} of ${hourlyResult.value.count} hourly buckets in this range.`]
        : []),
      ...(dailyResult.status === 'fulfilled' && dailyResult.value.truncated
        ? [`Showing first ${dailyResult.value.results.length} of ${dailyResult.value.count} daily buckets in this range.`]
        : []),
    ],
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

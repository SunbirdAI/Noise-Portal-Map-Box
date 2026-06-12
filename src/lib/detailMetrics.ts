import type { NoiseMetric, SensorLiveData } from '../models/sensor';
import { liveDataToNoiseMetric } from './sensors';

export function selectDetailNoiseMetrics(
  hourlyMetrics: NoiseMetric[] | undefined,
  liveData?: SensorLiveData,
): NoiseMetric[] {
  if (hourlyMetrics && hourlyMetrics.length > 0) {
    return hourlyMetrics;
  }

  if (liveData?.metrics && liveData.metrics.length > 0) {
    return liveData.metrics;
  }

  const liveMetric = liveDataToNoiseMetric(liveData);
  return liveMetric ? [liveMetric] : [];
}

import type { DeviceInfo, NoiseMetric, SensorLiveData, SensorLocation, SensorSummary, SensorType } from '../models/sensor';

export function isSeasDeviceName(deviceName?: string): boolean {
  return /^seas/i.test(deviceName?.trim() ?? '');
}

export function isMobileDeviceName(deviceName?: string): boolean {
  return /^mobile/i.test(deviceName?.trim() ?? '');
}

export function detectSensorType(input: {
  deviceName?: string;
  deviceType?: string;
  uploadAddress?: string;
  metricsUrl?: string;
}): SensorType {
  const tokens = [input.deviceName, input.deviceType, input.uploadAddress, input.metricsUrl]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!tokens.trim()) {
    return 'Unknown';
  }

  if (isSeasDeviceName(input.deviceName) || /\b(ai|saes|seas)\b/.test(tokens) || tokens.includes('/audio/')) {
    return 'AI';
  }

  if (tokens.includes('mobile') || tokens.includes('phone') || tokens.includes('android')) {
    return 'MOBILE';
  }

  if (tokens.includes('mcu') || /^sb\d+/.test(input.deviceName?.toLowerCase() ?? '')) {
    return 'MCU';
  }

  return 'Unknown';
}

export function getLatestMetric(metrics: NoiseMetric[]): NoiseMetric | undefined {
  return [...metrics]
    .filter((metric) => metric.uploadedAt || metric.dbLevel !== undefined || metric.avgDbLevel !== undefined)
    .sort((a, b) => {
      const left = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const right = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return right - left;
    })[0];
}

export function createSensorSummary(
  location: SensorLocation,
  device?: DeviceInfo,
  status: SensorSummary['metricStatus'] = 'empty',
): SensorSummary {
  const latestMetric = device ? getLatestMetric(device.metrics) : undefined;
  const sensorType =
    device?.sensorType ??
    detectSensorType({
      deviceName: location.deviceName,
    });

  return {
    ...location,
    sensorType,
    latestMetric,
    device,
    metricStatus: latestMetric ? 'ready' : status,
  };
}

export function createSensorSummaryFromLiveData(
  location: SensorLocation,
  liveData?: SensorLiveData,
  status: SensorSummary['metricStatus'] = 'empty',
): SensorSummary {
  const latestMetric = liveDataToNoiseMetric(liveData);
  const sensorType =
    liveData?.type ??
    detectSensorType({
      deviceName: location.deviceName,
    });

  return {
    ...location,
    sensorType,
    latestMetric,
    device: liveData?.device,
    environment: liveData?.environment,
    inference: liveData?.inference,
    liveData,
    metricStatus: latestMetric ? 'ready' : status,
  };
}

export function liveDataToNoiseMetric(liveData?: SensorLiveData): NoiseMetric | undefined {
  if (!liveData) {
    return undefined;
  }

  if (liveData.metric) {
    return liveData.metric;
  }

  if (liveData.latestNoise === null && liveData.lastUpdated === null) {
    return undefined;
  }

  return {
    deviceName: liveData.deviceName,
    dbLevel: liveData.latestNoise ?? undefined,
    uploadedAt: liveData.lastUpdated ?? undefined,
  };
}

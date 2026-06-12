import type { SensorLiveData } from '../models/sensor';
import { fetchAiInference, fetchDeviceByName, fetchEnvironmentalReading } from './api/client';
import { getLatestMetric, isSeasDeviceName } from './sensors';

export async function fetchSensorLiveData(deviceName: string): Promise<SensorLiveData> {
  if (isSeasDeviceName(deviceName)) {
    const [environmentResult, inferenceResult] = await Promise.allSettled([
      fetchEnvironmentalReading(deviceName),
      fetchAiInference(deviceName),
    ]);

    const environment =
      environmentResult.status === 'fulfilled' ? environmentResult.value : undefined;
    const inference = inferenceResult.status === 'fulfilled' ? inferenceResult.value : undefined;

    return {
      type: 'AI',
      deviceName,
      latestNoise: environment?.dbLevel ?? null,
      lastUpdated: environment?.createdAt ?? inference?.createdAt ?? null,
      battery: null,
      environment,
      inference,
    };
  }

  const device = await fetchDeviceByName(deviceName);
  const latestMetric = getLatestMetric(device.metrics);

  return {
    type: device.sensorType,
    deviceName,
    latestNoise: latestMetric?.dbLevel ?? latestMetric?.avgDbLevel ?? null,
    lastUpdated: latestMetric?.uploadedAt ?? device.lastSeen ?? null,
    battery: latestMetric?.batteryVoltage ?? null,
    device,
    metric: latestMetric,
  };
}

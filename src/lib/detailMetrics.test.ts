import { describe, expect, it } from 'vitest';
import { selectDetailNoiseMetrics } from './detailMetrics';
import type { NoiseMetric, SensorLiveData } from '../models/sensor';

describe('selectDetailNoiseMetrics', () => {
  it('uses location hourly metrics before live device history', () => {
    const hourly: NoiseMetric[] = [
      { id: 'hourly-1', avgDbLevel: 51, uploadedAt: '2026-06-08T09:00:00Z' },
    ];
    const liveData: SensorLiveData = {
      type: 'MCU',
      deviceName: 'SB1003',
      latestNoise: 54,
      lastUpdated: '2026-06-08T11:00:00Z',
      battery: null,
      metrics: [
        { id: 'device-1', avgDbLevel: 53, uploadedAt: '2026-06-08T10:00:00Z' },
      ],
    };

    expect(selectDetailNoiseMetrics(hourly, liveData)).toBe(hourly);
  });

  it('preserves the full generic device metric history when location hourly metrics are absent', () => {
    const deviceMetrics: NoiseMetric[] = [
      { id: 'metric-1', avgDbLevel: 46, maxDbLevel: 59, dbLevel: 52, uploadedAt: '2026-06-08T10:00:00Z' },
      { id: 'metric-2', avgDbLevel: 48, maxDbLevel: 61, dbLevel: 53, uploadedAt: '2026-06-08T11:00:00Z' },
      { id: 'metric-3', avgDbLevel: 50, maxDbLevel: 64, dbLevel: 56, uploadedAt: '2026-06-08T12:00:00Z' },
    ];
    const liveData: SensorLiveData = {
      type: 'MCU',
      deviceName: 'SB1003',
      latestNoise: 56,
      lastUpdated: '2026-06-08T12:00:00Z',
      battery: 3.9,
      metric: deviceMetrics[2],
      metrics: deviceMetrics,
    };

    expect(selectDetailNoiseMetrics([], liveData)).toBe(deviceMetrics);
    expect(selectDetailNoiseMetrics(undefined, liveData)).toHaveLength(3);
  });

  it('falls back to a single live AI reading when no historical series exists', () => {
    const liveData: SensorLiveData = {
      type: 'AI',
      deviceName: 'SEAS-1',
      latestNoise: 52.14,
      lastUpdated: '2026-06-10T14:54:02.847961+03:00',
      battery: null,
    };

    expect(selectDetailNoiseMetrics([], liveData)).toEqual([
      {
        deviceName: 'SEAS-1',
        dbLevel: 52.14,
        uploadedAt: '2026-06-10T14:54:02.847961+03:00',
      },
    ]);
  });
});

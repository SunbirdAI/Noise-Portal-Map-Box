import { describe, expect, it } from 'vitest';
import { normalizeDeviceInfo, normalizeLocationsResponse, normalizeMetric } from './normalizers';

describe('API normalizers', () => {
  it('normalizes paginated locations and drops invalid coordinates', () => {
    const locations = normalizeLocationsResponse({
      results: [
        {
          id: 'valid-location',
          latitude: 0.3357,
          longitude: 32.5724,
          city: 'Kampala',
          village: 'Busia A',
          day_limit: 60,
          night_limit: 50,
          device_name: 'SB1003',
        },
        {
          id: 'invalid-location',
          latitude: 0,
          longitude: 0,
          city: 'Kampala',
          device_name: 'SB0',
        },
      ],
    });

    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({
      id: 'valid-location',
      city: 'Kampala',
      village: 'Busia A',
      dayLimit: 60,
      nightLimit: 50,
      deviceName: 'SB1003',
    });
  });

  it('normalizes device metrics and health fields', () => {
    const device = normalizeDeviceInfo({
      id: 'location-id',
      lastseen: '2026-06-08T11:42:48Z',
      device_id: 'SB5',
      device_name: 'Village Shopping Mall',
      device_type: 'MCU',
      configured: 1,
      get_metrics: [
        {
          id: 'metric-id',
          db_level: 54.2,
          avg_db_level: 45.2,
          max_db_level: 60.1,
          no_of_exceedances: 2,
          battery_voltage: 3.8,
          time_uploaded: '2026-06-08T14:42:48+03:00',
        },
      ],
    });

    expect(device.sensorType).toBe('MCU');
    expect(device.configured).toBe(true);
    expect(device.metrics[0]).toMatchObject({
      dbLevel: 54.2,
      avgDbLevel: 45.2,
      maxDbLevel: 60.1,
      exceedances: 2,
      batteryVoltage: 3.8,
    });
  });

  it('accepts alternative metric field names', () => {
    expect(
      normalizeMetric({
        db: '48.5',
        average: '44.1',
        max: 58,
        median: 45,
        exceedance_count: 1,
        timestamp: '2026-06-08T12:00:00Z',
      }),
    ).toMatchObject({
      dbLevel: 48.5,
      avgDbLevel: 44.1,
      maxDbLevel: 58,
      medianDbLevel: 45,
      exceedances: 1,
    });
  });
});

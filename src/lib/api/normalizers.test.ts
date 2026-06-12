import { describe, expect, it } from 'vitest';
import {
  normalizeAiInferencePage,
  normalizeDeviceInfo,
  normalizeEnvironmentalReadingPage,
  normalizeLocationsResponse,
  normalizeMetric,
  normalizeMetricPage,
} from './normalizers';

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

  it('normalizes Django hourly aggregate fields', () => {
    expect(
      normalizeMetric({
        id: 'aggregate-id',
        date: '2026-06-08T10:00:00Z',
        hour: 10,
        hourly_avg_db_level: '44.5',
        hourly_max_db_level: 61,
        hourly_median_db_level: 45,
        hourly_no_of_exceedances: 3,
      }),
    ).toMatchObject({
      avgDbLevel: 44.5,
      maxDbLevel: 61,
      medianDbLevel: 45,
      exceedances: 3,
      uploadedAt: '2026-06-08T10:00:00Z',
    });
  });

  it('normalizes paginated metric history and range metadata', () => {
    const page = normalizeMetricPage({
      count: 2,
      next: 'http://noise-sensors-dashboard.herokuapp.com/device_metrics/device/by-device-id/SB1006/history/?page=2',
      range: {
        start_date: '2026-06-12T00:00:00+03:00',
        end_date: '2026-06-12T23:59:59+03:00',
        timezone: 'Africa/Kampala',
      },
      device: {
        id: 'device-uuid',
        device_id: 'SB1006',
        type: 'MCU',
      },
      results: [
        {
          id: 'metric-1',
          device: 'SB1006',
          avg_db_level: 40,
          max_db_level: 55,
          no_of_exceedances: 1,
          timestamp: '2026-06-12T00:00:00+03:00',
        },
      ],
    });

    expect(page.count).toBe(2);
    expect(page.range).toMatchObject({
      startDate: '2026-06-12T00:00:00+03:00',
      endDate: '2026-06-12T23:59:59+03:00',
      timezone: 'Africa/Kampala',
    });
    expect(page.device?.deviceId).toBe('SB1006');
    expect(page.results[0]).toMatchObject({
      avgDbLevel: 40,
      maxDbLevel: 55,
      exceedances: 1,
      uploadedAt: '2026-06-12T00:00:00+03:00',
    });
  });

  it('normalizes paginated AI history pages', () => {
    const environmental = normalizeEnvironmentalReadingPage({
      count: 1,
      results: [
        {
          id: 1,
          device: 'SEAS-1',
          db_level: 52.14,
          temperature: 24.5,
          created_at: '2026-06-12T07:58:24+03:00',
        },
      ],
    });
    const inference = normalizeAiInferencePage({
      count: 1,
      results: [
        {
          id: 2,
          device: 'SEAS-1',
          inference_class: 'generator',
          inference_probability: 0.7,
          inferred_audio_name: '46.wav',
          created_at: '2026-06-12T07:54:11+03:00',
        },
      ],
    });

    expect(environmental.results[0]).toMatchObject({
      deviceName: 'SEAS-1',
      dbLevel: 52.14,
      temperature: 24.5,
      createdAt: '2026-06-12T07:58:24+03:00',
    });
    expect(inference.results[0]).toMatchObject({
      deviceName: 'SEAS-1',
      className: 'generator',
      probability: 0.7,
      audioName: '46.wav',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildDashboardCsvRows,
  buildLocationCsvRows,
  dashboardCsvFilename,
  formatCsvTimestamp,
  locationCsvFilename,
  serializeCsv,
} from './csvExport';
import type { SensorSummary } from '../models/sensor';

describe('CSV export helpers', () => {
  it('formats timestamps in the dashboard timezone', () => {
    expect(formatCsvTimestamp('2026-06-24T14:17:00+03:00')).toBe('2026-06-24 14:17:00');
  });

  it('builds useful filenames', () => {
    const date = new Date('2026-06-24T11:00:00Z');

    expect(locationCsvFilename('Upper Naguru East Road', 'SB1006', date)).toBe(
      'noise-data-upper-naguru-east-road-2026-06-24.csv',
    );
    expect(dashboardCsvFilename('All', date)).toBe('noise-data-all-visible-locations-2026-06-24.csv');
  });

  it('serializes CSV with clear escaping', () => {
    const csv = serializeCsv([
      {
        'Location Name': 'Road, North "A"',
        'Device ID': 'SB1006',
        'dB Value': '47.2',
      },
    ]);

    expect(csv).toContain('"Road, North ""A"""');
    expect(csv).toContain('SB1006');
  });

  it('exports dashboard rows with location metadata and exceedance status', () => {
    const sensors: SensorSummary[] = [
      {
        id: 'location-1',
        latitude: 0.3483587,
        longitude: 32.6051805,
        coordinateSource: 'fixed',
        city: 'Kampala',
        division: 'Naguru',
        parish: 'SB6',
        village: 'Upper Naguru East Road',
        dayLimit: 55,
        nightLimit: 45,
        deviceName: 'SB1006',
        sensorType: 'MCU',
        latestMetric: {
          dbLevel: 47.25,
          avgDbLevel: 42.51,
          maxDbLevel: 51.62,
          exceedances: 1,
          batteryVoltage: 3.82,
          uploadedAt: '2026-06-24T14:17:00+03:00',
        },
        metricStatus: 'ready',
      },
    ];

    expect(buildDashboardCsvRows(sensors)[0]).toMatchObject({
      'Location Name': 'Upper Naguru East Road',
      'Device ID': 'SB1006',
      'Sensor Type': 'MCU',
      'Timestamp (Africa/Kampala)': '2026-06-24 14:17:00',
      'dB Value': '47.3',
      'Average dB': '42.5',
      'Max dB': '51.6',
      'Day Limit dB': '55',
      'Night Limit dB': '45',
      'Exceedance Status': 'Yes',
      'Battery Voltage V': '3.82',
      Latitude: '0.348359',
      Longitude: '32.605181',
    });
  });

  it('preserves valid zero dB readings in location exports', () => {
    const rows = buildLocationCsvRows({
      location: {
        id: 'location-2',
        latitude: 0,
        longitude: 32.5,
        coordinateSource: 'fixed',
        city: 'Kampala',
        deviceName: 'SB0',
      },
      deviceName: 'SB0',
      sensorType: 'MCU',
      dataSource: 'Selected range: 24 hours',
      metrics: [
        {
          dbLevel: 0,
          uploadedAt: '2026-06-24T01:00:00+03:00',
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]['dB Value']).toBe('0');
  });
});

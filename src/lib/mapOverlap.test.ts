import { describe, expect, it } from 'vitest';
import type { SensorSummary } from '../models/sensor';
import { buildOverlapIndex, distanceMeters } from './mapOverlap';

describe('map overlap grouping', () => {
  it('groups sensors with identical coordinates', () => {
    const sensors = [
      makeSensor('SB1006', 0.34835875484301404, 32.60518059396207),
      makeSensor('SEAS-2', 0.34835875484301404, 32.60518059396207),
    ];

    const index = buildOverlapIndex(sensors);

    expect(index.groups).toHaveLength(1);
    expect(index.groups[0].sensors.map((sensor) => sensor.deviceName)).toEqual(['SB1006', 'SEAS-2']);
    expect(index.sensorMeta.get('SB1006')?.size).toBe(2);
  });

  it('groups sensors that are close enough to remain visually overlapped at high zoom', () => {
    const sensors = [
      makeSensor('SB1003', 0.3357147535153399, 32.57245647396038),
      makeSensor('SEAS-1', 0.3357175171684733, 32.572466178949064),
    ];

    expect(distanceMeters(sensors[0], sensors[1])).toBeLessThan(2);
    expect(buildOverlapIndex(sensors).groups).toHaveLength(1);
  });

  it('leaves well-separated sensors as individual markers', () => {
    const sensors = [
      makeSensor('SB1006', 0.34835875484301404, 32.60518059396207),
      makeSensor('SB5', 0.3770421433162495, 32.599528451872565),
    ];

    const index = buildOverlapIndex(sensors);

    expect(index.groups).toHaveLength(0);
    expect(index.sensorMeta.size).toBe(0);
  });
});

function makeSensor(deviceName: string, latitude: number, longitude: number): SensorSummary {
  return {
    id: deviceName,
    latitude,
    longitude,
    coordinateSource: 'fixed',
    city: 'Kampala',
    deviceName,
    sensorType: deviceName.startsWith('SEAS') ? 'AI' : 'MCU',
    metricStatus: 'empty',
  };
}

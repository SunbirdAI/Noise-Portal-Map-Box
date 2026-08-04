import { describe, expect, it } from 'vitest';
import { detectSensorType, getLatestMetric } from './sensors';
import { getNoiseCategory } from './noiseScale';

describe('sensor helpers', () => {
  it('detects common backend sensor type variants', () => {
    expect(detectSensorType({ deviceName: 'SB5', deviceType: 'MCU' })).toBe('MCU');
    expect(detectSensorType({ deviceName: 'SEAS-1', uploadAddress: 'https://example.com/audio/' })).toBe('AI');
    expect(detectSensorType({ deviceName: 'phone-01', deviceType: 'mobile' })).toBe('MOBILE');
    expect(detectSensorType({ deviceName: '' })).toBe('Unknown');
  });

  it('trusts an explicit MCU device_type over an /audio/ upload address', () => {
    // Real backend shape for SB5: an MCU device whose metrics happen to be
    // relayed through an /audio/ upload endpoint. The explicit device_type
    // must win so MCU devices don't get misclassified as AI sensors.
    expect(
      detectSensorType({
        deviceName: 'SB5',
        deviceType: 'MCU',
        uploadAddress: 'https://noise-sensors-dashboard.herokuapp.com/audio/upload/',
      }),
    ).toBe('MCU');
  });

  it('falls back to device-name rules when device_type is missing', () => {
    expect(detectSensorType({ deviceName: 'SEAS-2' })).toBe('AI');
    expect(detectSensorType({ deviceName: 'SB1006' })).toBe('MCU');
  });

  it('only uses URL/address hints as a last resort', () => {
    expect(detectSensorType({ uploadAddress: 'https://example.com/audio/' })).toBe('AI');
    expect(detectSensorType({ metricsUrl: 'https://example.com/mobile/metrics' })).toBe('MOBILE');
  });

  it('selects the newest metric with data', () => {
    expect(
      getLatestMetric([
        { dbLevel: 42, uploadedAt: '2026-06-08T10:00:00Z' },
        { dbLevel: 51, uploadedAt: '2026-06-08T11:00:00Z' },
      ])?.dbLevel,
    ).toBe(51);
  });

  it('classifies noise categories without inventing values', () => {
    expect(getNoiseCategory(undefined)).toBe('No data');
    expect(getNoiseCategory(40)).toBe('Quiet');
    expect(getNoiseCategory(50)).toBe('Quiet');
    expect(getNoiseCategory(60)).toBe('Moderate');
    expect(getNoiseCategory(75)).toBe('Noisy');
  });
});

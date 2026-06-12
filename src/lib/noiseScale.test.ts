import { describe, expect, it } from 'vitest';
import {
  NOISE_LEVEL_RANGES,
  NOISE_NO_DATA_COLOR,
  getNoiseCategory,
  getNoiseColor,
  getNoiseColorExpression,
  getNoiseRange,
} from './noiseScale';

describe('noise scale', () => {
  it('defines the requested dB ranges in order', () => {
    expect(NOISE_LEVEL_RANGES.map((range) => range.label)).toEqual([
      '< 35 dB',
      '35-39 dB',
      '40-44 dB',
      '45-49 dB',
      '50-54 dB',
      '55-59 dB',
      '60-64 dB',
      '65-69 dB',
      '70-74 dB',
      '75-79 dB',
      '>= 80 dB',
    ]);
  });

  it('maps readings to category and color using the shared scale', () => {
    expect(getNoiseCategory(undefined)).toBe('No data');
    expect(getNoiseColor(undefined)).toBe(NOISE_NO_DATA_COLOR);
    expect(getNoiseRange(0)?.label).toBe('< 35 dB');
    expect(getNoiseCategory(54.9)).toBe('Quiet');
    expect(getNoiseCategory(55)).toBe('Moderate');
    expect(getNoiseCategory(69.9)).toBe('Moderate');
    expect(getNoiseCategory(70)).toBe('Noisy');
    expect(getNoiseRange(80)?.label).toBe('>= 80 dB');
  });

  it('builds a Mapbox color expression from the exact range colors', () => {
    const expression = getNoiseColorExpression(['get', 'latestDb']);

    for (const range of NOISE_LEVEL_RANGES) {
      expect(expression).toContain(range.color);
    }
  });
});

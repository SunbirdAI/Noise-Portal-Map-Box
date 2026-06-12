import { describe, expect, it } from 'vitest';
import { extractCoordinates, isValidCoordinate } from './coordinates';

describe('coordinate validation', () => {
  it('rejects null island and out-of-range coordinates', () => {
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate(91, 32)).toBe(false);
    expect(isValidCoordinate(0.3476, 181)).toBe(false);
  });

  it('accepts valid latitude and longitude strings', () => {
    expect(isValidCoordinate('0.3476', '32.5825')).toBe(true);
  });

  it('prefers mobile coordinates when they are available and valid', () => {
    expect(
      extractCoordinates({
        latitude: 0.1,
        longitude: 32.1,
        mobile_latitude: 0.35,
        mobile_longitude: 32.6,
      }),
    ).toEqual({
      latitude: 0.35,
      longitude: 32.6,
      source: 'mobile',
    });
  });
});

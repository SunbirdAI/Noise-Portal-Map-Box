import { describe, expect, it } from 'vitest';
import { createCustomDateRange, createPresetDateRange, toDateInputValue } from './dateRanges';

describe('date range helpers', () => {
  it('creates Kampala ISO preset ranges', () => {
    const range = createPresetDateRange('24h', new Date('2026-06-12T09:00:00Z'));

    expect(range).toMatchObject({
      preset: '24h',
      label: '24 hours',
      startDate: '2026-06-11T12:00:00+03:00',
      endDate: '2026-06-12T12:00:00+03:00',
    });
  });

  it('creates inclusive custom date ranges in Africa/Kampala', () => {
    const range = createCustomDateRange('2026-06-01', '2026-06-12');

    expect(range).toMatchObject({
      preset: 'custom',
      startDate: '2026-06-01T00:00:00+03:00',
      endDate: '2026-06-12T23:59:59+03:00',
      customStartDate: '2026-06-01',
      customEndDate: '2026-06-12',
    });
  });

  it('converts ISO values back to date input values in Kampala time', () => {
    expect(toDateInputValue('2026-06-11T22:30:00Z')).toBe('2026-06-12');
  });
});

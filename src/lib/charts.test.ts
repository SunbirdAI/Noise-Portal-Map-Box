import { describe, expect, it } from 'vitest';
import { aggregateDailyPoints, countUniqueTrendTimestamps, metricsToDailyChartPoints, normalizeHourlyTrendData } from './charts';

describe('chart helpers', () => {
  it('normalizes hourly trend data with sorted numeric timestamps', () => {
    const points = normalizeHourlyTrendData([
      {
        id: 'later',
        avgDbLevel: 48,
        maxDbLevel: 61,
        dbLevel: 52,
        uploadedAt: '2026-06-08T12:00:00Z',
      },
      {
        id: 'earlier',
        avgDbLevel: 46,
        maxDbLevel: 58,
        dbLevel: 51,
        uploadedAt: '2026-06-08T10:00:00Z',
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points.map((point) => point.key)).toEqual(['2026-06-08T10:00:00Z', '2026-06-08T12:00:00Z']);
    expect(points[0].timestamp).toBe(new Date('2026-06-08T10:00:00Z').getTime());
    expect(countUniqueTrendTimestamps(points)).toBe(2);
  });

  it('preserves valid zero values and removes invalid timestamp rows', () => {
    const points = normalizeHourlyTrendData([
      {
        id: 'zero',
        avgDbLevel: 0,
        maxDbLevel: 0,
        dbLevel: 0,
        uploadedAt: '2026-06-08T10:00:00Z',
      },
      {
        id: 'bad-time',
        avgDbLevel: 50,
        uploadedAt: 'not-a-date',
      },
    ]);

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      average: 0,
      max: 0,
      reading: 0,
    });
  });

  it('keeps raw timestamps unique even when display labels are identical', () => {
    const points = normalizeHourlyTrendData([
      {
        id: 'first',
        avgDbLevel: 52,
        uploadedAt: '2026-06-08T10:07:00Z',
      },
      {
        id: 'second',
        avgDbLevel: 54,
        uploadedAt: '2026-06-08T10:07:30Z',
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0].label).toBe(points[1].label);
    expect(points[0].timestamp).not.toBe(points[1].timestamp);
    expect(countUniqueTrendTimestamps(points)).toBe(2);
  });

  it('formats backend daily metrics as calendar dates instead of midnight times', () => {
    const points = metricsToDailyChartPoints([
      {
        id: 'daily',
        avgDbLevel: 49,
        maxDbLevel: 64,
        uploadedAt: '2026-06-08T00:00:00+03:00',
      },
    ]);

    expect(points[0].label).toBe('Jun 8');
    expect(points[0].label).not.toBe('00:00');
  });

  it('labels aggregated daily points with readable dates', () => {
    const points = aggregateDailyPoints([
      {
        id: 'hourly',
        dbLevel: 52,
        uploadedAt: '2026-06-08T12:00:00+03:00',
      },
    ]);

    expect(points[0]).toMatchObject({
      key: '2026-06-08',
      label: 'Jun 8',
      avg: 52,
    });
  });
});

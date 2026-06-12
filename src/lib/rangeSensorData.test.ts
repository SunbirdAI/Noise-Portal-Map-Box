import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAiInferenceHistory,
  fetchDeviceMetricAggregates,
  fetchEnvironmentalHistory,
} from './api/client';
import { createPresetDateRange } from './dateRanges';
import { fetchSensorRangeData } from './rangeSensorData';

vi.mock('./api/client', () => ({
  fetchAiInferenceHistory: vi.fn(),
  fetchDeviceMetricAggregates: vi.fn(),
  fetchEnvironmentalHistory: vi.fn(),
}));

describe('fetchSensorRangeData', () => {
  const range = createPresetDateRange('24h', new Date('2026-06-12T09:00:00Z'));

  beforeEach(() => {
    vi.mocked(fetchAiInferenceHistory).mockReset();
    vi.mocked(fetchDeviceMetricAggregates).mockReset();
    vi.mocked(fetchEnvironmentalHistory).mockReset();
  });

  it('uses hourly and daily aggregate endpoints for generic devices', async () => {
    vi.mocked(fetchDeviceMetricAggregates).mockImplementation(async (_deviceName, params) => ({
      count: 1,
      results: [
        {
          id: `${params.granularity}-1`,
          avgDbLevel: params.granularity === 'hourly' ? 42 : 45,
          uploadedAt: '2026-06-12T00:00:00+03:00',
        },
      ],
    }));

    const data = await fetchSensorRangeData('SB1006', range);

    expect(data.source).toBe('device-aggregates');
    expect(data.hourlyMetrics[0].avgDbLevel).toBe(42);
    expect(data.dailyMetrics[0].avgDbLevel).toBe(45);
    expect(fetchDeviceMetricAggregates).toHaveBeenCalledWith(
      'SB1006',
      expect.objectContaining({
        granularity: 'hourly',
        timezone: 'Africa/Kampala',
      }),
    );
    expect(fetchEnvironmentalHistory).not.toHaveBeenCalled();
  });

  it('uses AI environmental and inference history for SEAS devices', async () => {
    vi.mocked(fetchEnvironmentalHistory).mockResolvedValue({
      count: 200,
      truncated: true,
      results: [
        {
          id: 1,
          deviceName: 'SEAS-1',
          dbLevel: 52.14,
          createdAt: '2026-06-12T07:58:24+03:00',
        },
      ],
    });
    vi.mocked(fetchAiInferenceHistory).mockResolvedValue({
      count: 1,
      results: [
        {
          id: 2,
          deviceName: 'SEAS-1',
          className: 'generator',
          probability: 0.6,
          createdAt: '2026-06-12T07:54:11+03:00',
        },
      ],
    });

    const data = await fetchSensorRangeData('SEAS-1', range);

    expect(data.source).toBe('ai-history');
    expect(data.rangeNotices[0]).toContain('Showing latest 1 of 200 environmental readings');
    expect(data.hourlyMetrics).toEqual([
      {
        id: '1',
        deviceName: 'SEAS-1',
        dbLevel: 52.14,
        uploadedAt: '2026-06-12T07:58:24+03:00',
      },
    ]);
    expect(data.inferenceHistory[0].className).toBe('generator');
    expect(fetchDeviceMetricAggregates).not.toHaveBeenCalled();
  });
});

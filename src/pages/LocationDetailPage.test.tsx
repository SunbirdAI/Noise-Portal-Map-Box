import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocationDetailPage from './LocationDetailPage';
import { renderRoute } from '../test/render';
import {
  fetchAiInference,
  fetchAllLocations,
  fetchDeviceByName,
  fetchDeviceMetricAggregates,
  fetchEnvironmentalHistory,
  fetchEnvironmentalReading,
  fetchAiInferenceHistory,
  fetchLocationMetrics,
} from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  fetchAllLocations: vi.fn(),
  fetchDeviceByName: vi.fn(),
  fetchDeviceMetricAggregates: vi.fn(),
  fetchEnvironmentalHistory: vi.fn(),
  fetchLocationMetrics: vi.fn(),
  fetchAiInference: vi.fn(),
  fetchAiInferenceHistory: vi.fn(),
  fetchEnvironmentalReading: vi.fn(),
}));

describe('LocationDetailPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAllLocations).mockReset();
    vi.mocked(fetchDeviceByName).mockReset();
    vi.mocked(fetchDeviceMetricAggregates).mockReset();
    vi.mocked(fetchEnvironmentalHistory).mockReset();
    vi.mocked(fetchLocationMetrics).mockReset();
    vi.mocked(fetchAiInference).mockReset();
    vi.mocked(fetchAiInferenceHistory).mockReset();
    vi.mocked(fetchEnvironmentalReading).mockReset();
  });

  it('loads a detail route directly from the locationId param', async () => {
    vi.mocked(fetchAllLocations).mockResolvedValue([
      {
        id: 'location-1',
        latitude: 0.3357,
        longitude: 32.5724,
        coordinateSource: 'fixed',
        city: 'Kampala',
        division: 'Kawempe',
        parish: 'Katanga',
        village: 'Busia A',
        description: 'Category D',
        dayLimit: 60,
        nightLimit: 50,
        deviceName: 'SB1003',
      },
    ]);
    vi.mocked(fetchLocationMetrics).mockResolvedValue({
      id: 'location-1',
      deviceName: 'SB1003',
      hourly: [],
      daily: [],
    });
    vi.mocked(fetchDeviceByName).mockResolvedValue({
      id: 'location-1',
      deviceId: 'SB1003',
      displayName: 'Katanga sensor',
      sensorType: 'MCU',
      lastSeen: '2026-06-08T11:46:47Z',
      metrics: [
        {
          id: 'metric-1',
          dbLevel: 52,
          avgDbLevel: 46,
          maxDbLevel: 59,
          exceedances: 1,
          batteryVoltage: 3.8,
          uploadedAt: '2026-06-08T14:46:47+03:00',
        },
        {
          id: 'metric-2',
          dbLevel: 54,
          avgDbLevel: 48,
          maxDbLevel: 62,
          exceedances: 2,
          batteryVoltage: 3.9,
          uploadedAt: '2026-06-08T15:46:47+03:00',
        },
      ],
    });
    vi.mocked(fetchAiInference).mockResolvedValue(undefined);
    vi.mocked(fetchEnvironmentalReading).mockResolvedValue(undefined);
    vi.mocked(fetchDeviceMetricAggregates).mockImplementation(async (_deviceName, params) => ({
      count: params.granularity === 'daily' ? 1 : 2,
      results:
        params.granularity === 'daily'
          ? [
              {
                id: 'daily-1',
                avgDbLevel: 49,
                maxDbLevel: 64,
                exceedances: 3,
                uploadedAt: '2026-06-08T00:00:00+03:00',
              },
            ]
          : [
              {
                id: 'hourly-1',
                avgDbLevel: 47,
                maxDbLevel: 60,
                uploadedAt: '2026-06-08T14:00:00+03:00',
              },
              {
                id: 'hourly-2',
                avgDbLevel: 50,
                maxDbLevel: 66,
                uploadedAt: '2026-06-08T15:00:00+03:00',
              },
            ],
    }));

    renderRoute('/locations/:locationId', <LocationDetailPage />, '/locations/location-1');

    expect(await screen.findByRole('heading', { name: 'Busia A' })).toBeInTheDocument();
    expect(screen.getByText('SB1003')).toBeInTheDocument();
    expect(screen.getByText('Latest range average')).toBeInTheDocument();
    expect(await screen.findAllByText('50.0 dB')).not.toHaveLength(0);
    expect(screen.queryByText('Only one reading available.')).not.toBeInTheDocument();
    expect(fetchDeviceMetricAggregates).toHaveBeenCalledWith(
      'SB1003',
      expect.objectContaining({
        granularity: 'hourly',
        timezone: 'Africa/Kampala',
      }),
    );
  });
});

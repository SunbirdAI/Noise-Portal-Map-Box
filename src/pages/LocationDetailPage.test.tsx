import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocationDetailPage from './LocationDetailPage';
import { renderRoute } from '../test/render';
import {
  fetchAiInference,
  fetchAllLocations,
  fetchDeviceByName,
  fetchEnvironmentalReading,
  fetchLocationMetrics,
} from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  fetchAllLocations: vi.fn(),
  fetchDeviceByName: vi.fn(),
  fetchLocationMetrics: vi.fn(),
  fetchAiInference: vi.fn(),
  fetchEnvironmentalReading: vi.fn(),
}));

describe('LocationDetailPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAllLocations).mockReset();
    vi.mocked(fetchDeviceByName).mockReset();
    vi.mocked(fetchLocationMetrics).mockReset();
    vi.mocked(fetchAiInference).mockReset();
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
      ],
    });
    vi.mocked(fetchAiInference).mockResolvedValue(undefined);
    vi.mocked(fetchEnvironmentalReading).mockResolvedValue(undefined);

    renderRoute('/locations/:locationId', <LocationDetailPage />, '/locations/location-1');

    expect(await screen.findByRole('heading', { name: 'Busia A' })).toBeInTheDocument();
    expect(screen.getByText('SB1003')).toBeInTheDocument();
    expect(screen.getByText('Latest hourly average')).toBeInTheDocument();
    expect(await screen.findByText('46.0 dB')).toBeInTheDocument();
  });
});

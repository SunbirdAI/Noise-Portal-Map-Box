import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocationDetailPage from './LocationDetailPage';
import { renderRoute } from '../test/render';
import { fetchScopedAdvisor, fetchScopedDevice } from '../lib/api/v2';
import { fetchScopedSensorLiveData, fetchScopedSensorRangeData } from '../lib/v2SensorData';

vi.mock('../lib/api/v2', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/v2')>('../lib/api/v2');
  return {
    ...actual,
    fetchScopedDevice: vi.fn(),
    fetchScopedAdvisor: vi.fn(),
  };
});

vi.mock('../lib/v2SensorData', async () => {
  const actual = await vi.importActual<typeof import('../lib/v2SensorData')>('../lib/v2SensorData');
  return {
    ...actual,
    fetchScopedSensorLiveData: vi.fn(),
    fetchScopedSensorRangeData: vi.fn(),
  };
});

const device = {
  id: 'device-uuid',
  deviceId: 'SB1003',
  displayName: 'Katanga sensor',
  sensorType: 'MCU' as const,
  lastSeen: '2026-06-08T11:46:47Z',
  location: {
    id: 'device-uuid',
    locationId: 'location-1',
    deviceUuid: 'device-uuid',
    latitude: 0.3357,
    longitude: 32.5724,
    coordinateSource: 'fixed' as const,
    city: 'Kampala',
    division: 'Kawempe',
    parish: 'Katanga',
    village: 'Busia A',
    description: 'Category D',
    dayLimit: 60,
    nightLimit: 50,
    deviceName: 'SB1003',
  },
};

describe('LocationDetailPage', () => {
  beforeEach(() => {
    vi.mocked(fetchScopedDevice).mockReset();
    vi.mocked(fetchScopedAdvisor).mockReset();
    vi.mocked(fetchScopedSensorLiveData).mockReset();
    vi.mocked(fetchScopedSensorRangeData).mockReset();
    vi.mocked(fetchScopedDevice).mockResolvedValue(device);
    vi.mocked(fetchScopedSensorLiveData).mockResolvedValue({
      type: 'MCU',
      deviceName: 'SB1003',
      latestNoise: 54,
      lastUpdated: '2026-06-08T15:46:47+03:00',
      battery: 3.9,
      device: {
        id: 'device-uuid',
        deviceId: 'SB1003',
        displayName: 'Katanga sensor',
        sensorType: 'MCU',
        lastSeen: '2026-06-08T11:46:47Z',
        metrics: [],
      },
      metric: {
        id: 'metric-2',
        dbLevel: 54,
        avgDbLevel: 48,
        maxDbLevel: 62,
        exceedances: 2,
        batteryVoltage: 3.9,
        uploadedAt: '2026-06-08T15:46:47+03:00',
      },
    });
    vi.mocked(fetchScopedSensorRangeData).mockResolvedValue({
      hourlyMetrics: [
        { id: 'hourly-1', avgDbLevel: 47, maxDbLevel: 60, uploadedAt: '2026-06-08T14:00:00+03:00' },
        { id: 'hourly-2', avgDbLevel: 50, maxDbLevel: 66, uploadedAt: '2026-06-08T15:00:00+03:00' },
      ],
      dailyMetrics: [
        { id: 'daily-1', avgDbLevel: 49, maxDbLevel: 64, exceedances: 3, uploadedAt: '2026-06-08T00:00:00+03:00' },
      ],
      environmentalHistory: [],
      inferenceHistory: [],
      partialFailures: [],
      rangeNotices: [],
      source: 'device-aggregates',
    });
  });

  it('loads a detail route directly from the device UUID param', async () => {
    renderRoute('/locations/:deviceId', <LocationDetailPage />, '/locations/device-uuid');

    expect(await screen.findByRole('heading', { name: 'Busia A' })).toBeInTheDocument();
    expect(screen.getByText('SB1003')).toBeInTheDocument();
    expect(screen.getByText('Latest range average')).toBeInTheDocument();
    expect(screen.getByText('Instant dB')).toBeInTheDocument();
    expect(await screen.findAllByText('50.0 dB')).not.toHaveLength(0);
    expect(fetchScopedDevice).toHaveBeenCalledWith({ kind: 'public' }, 'device-uuid');
    expect(fetchScopedSensorRangeData).toHaveBeenCalledWith(
      { kind: 'public' },
      expect.objectContaining({ id: 'device-uuid' }),
      expect.objectContaining({ label: '24 hours' }),
    );
  });

  it('keeps device sections rendered when the advisor request fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchScopedAdvisor).mockRejectedValue(new Error('Advisor failed'));

    renderRoute('/locations/:deviceId', <LocationDetailPage />, '/locations/device-uuid');

    expect(await screen.findByRole('heading', { name: 'Busia A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain this location noise data' }));

    expect(await screen.findByText(/The summary is unavailable right now/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Busia A' })).toBeInTheDocument();
    expect(screen.getByText('Export data')).toBeInTheDocument();
    expect(screen.getByText('Latest range average')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hourly Noise Trend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Device Health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Inference' })).toBeInTheDocument();
  });
});

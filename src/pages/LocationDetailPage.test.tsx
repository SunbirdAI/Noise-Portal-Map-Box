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
    expect(screen.queryByRole('heading', { name: 'Device Health' })).not.toBeInTheDocument();
    expect(screen.queryByText('Battery')).not.toBeInTheDocument();
    expect(screen.queryByText('Panel voltage')).not.toBeInTheDocument();
    expect(screen.queryByText('Signal strength')).not.toBeInTheDocument();
    expect(screen.queryByText('Data balance')).not.toBeInTheDocument();
    expect(screen.queryByText('Firmware')).not.toBeInTheDocument();
    expect(screen.queryByText('Stage')).not.toBeInTheDocument();
    expect(screen.queryByText('Organization')).not.toBeInTheDocument();
    expect(screen.queryByText('Visibility')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: 'Device Health' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Inference' })).toBeInTheDocument();
  });

  it('hides private AI and health fields from a public detail page even if supplied by a fixture', async () => {
    vi.mocked(fetchScopedDevice).mockResolvedValue({
      ...device,
      sensorType: 'AI',
      versionNumber: '9.9.9',
      productionStage: 'PRODUCTION',
      visibility: 'PUBLIC',
      organization: { id: 'org-1', name: 'Private owner', slug: 'private-owner' },
    });
    vi.mocked(fetchScopedSensorLiveData).mockResolvedValue({
      type: 'AI',
      deviceName: 'SB1003',
      latestNoise: 54,
      lastUpdated: '2026-06-08T15:46:47+03:00',
      battery: 3.9,
      device: { ...device, sensorType: 'AI', versionNumber: '9.9.9', productionStage: 'PRODUCTION', metrics: [] },
      metric: { id: 'metric-2', dbLevel: 54, batteryVoltage: 3.9, panelVoltage: 5, signalStrength: -70, dataBalance: 2 },
      inference: { className: 'traffic', probability: 0.91, audioName: 'private.wav', createdAt: '2026-06-08T15:00:00Z' },
      environment: {
        temperature: 24,
        humidity: 60,
        pressure: 1009,
        airQuality: 18,
        systemTemperature: 42,
        powerUsage: 3.1,
        dbLevel: 53,
        createdAt: '2026-06-08T15:00:00Z',
      },
    });

    renderRoute('/locations/:deviceId', <LocationDetailPage />, '/locations/device-uuid');

    expect(await screen.findByText('traffic')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
    for (const privateLabel of ['Audio sample', 'System temperature', 'Power usage', 'Firmware', 'Stage', 'Organization', 'Visibility']) {
      expect(screen.queryByText(privateLabel)).not.toBeInTheDocument();
    }
  });

  it('renders portal-only device and health fields for an organization scope', async () => {
    vi.mocked(fetchScopedDevice).mockResolvedValue({
      ...device,
      versionNumber: '2.4.1',
      productionStage: 'PRODUCTION',
      visibility: 'PRIVATE',
      organization: { id: 'org-1', name: 'Partner One', slug: 'partner-one' },
    });

    renderRoute(
      '/portal/organizations/:organizationId/devices/:deviceId',
      <LocationDetailPage scope={{ kind: 'organization', organizationId: 'org-1' }} />,
      '/portal/organizations/org-1/devices/device-uuid',
    );

    expect(await screen.findByRole('heading', { name: 'Device Health' })).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Partner One')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    expect(screen.getByText('Firmware')).toBeInTheDocument();
    expect(screen.getByText('2.4.1')).toBeInTheDocument();
    expect(screen.getByText('Battery')).toBeInTheDocument();
  });
});

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { renderWithProviders } from '../test/render';
import { fetchScopedDevices } from '../lib/api/v2';
import { fetchScopedSensorLiveData } from '../lib/v2SensorData';

vi.mock('../lib/api/v2', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/v2')>('../lib/api/v2');
  return { ...actual, fetchScopedDevices: vi.fn() };
});

vi.mock('../lib/v2SensorData', async () => {
  const actual = await vi.importActual<typeof import('../lib/v2SensorData')>('../lib/v2SensorData');
  return { ...actual, fetchScopedSensorLiveData: vi.fn() };
});

// SensorMap creates a real mapbox-gl Map, which needs a WebGL context jsdom
// doesn't provide. Stub it so tests can render the loaded dashboard state.
vi.mock('../components/SensorMap', () => ({ default: () => null }));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(fetchScopedDevices).mockReset();
    vi.mocked(fetchScopedSensorLiveData).mockReset();
  });

  it('shows the dashboard loading state', () => {
    vi.mocked(fetchScopedDevices).mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Loading sensor network')).toBeInTheDocument();
  });

  it('shows an API failure state', async () => {
    vi.mocked(fetchScopedDevices).mockRejectedValue(new Error('network down'));

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Unable to load sensor locations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('exposes accessible pressed state on city filter buttons', async () => {
    vi.mocked(fetchScopedDevices).mockResolvedValue([
      {
        id: 'device-1',
        deviceId: 'SB1',
        displayName: 'Kampala sensor',
        sensorType: 'MCU',
        location: {
          id: 'device-1',
          locationId: 'loc-1',
          deviceUuid: 'device-1',
          latitude: 0.3136,
          longitude: 32.5811,
          coordinateSource: 'fixed',
          city: 'Kampala',
          deviceName: 'SB1',
        },
      },
      {
        id: 'device-2',
        deviceId: 'SB2',
        displayName: 'Entebbe sensor',
        sensorType: 'MCU',
        location: {
          id: 'device-2',
          locationId: 'loc-2',
          deviceUuid: 'device-2',
          latitude: 0.0512,
          longitude: 32.4637,
          coordinateSource: 'fixed',
          city: 'Entebbe',
          deviceName: 'SB2',
        },
      },
    ]);
    vi.mocked(fetchScopedSensorLiveData).mockImplementation(async (_scope, device) => ({
      type: device.sensorType,
      deviceName: device.deviceId,
      latestNoise: null,
      lastUpdated: null,
      battery: null,
    }));

    const user = userEvent.setup();
    renderWithProviders(<DashboardPage />);

    const group = await screen.findByRole('group', { name: 'City filter' });
    const allButton = within(group).getByRole('button', { name: 'All' });
    const kampalaButton = within(group).getByRole('button', { name: 'Kampala' });

    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(kampalaButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(kampalaButton);

    expect(kampalaButton).toHaveAttribute('aria-pressed', 'true');
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
  });
});

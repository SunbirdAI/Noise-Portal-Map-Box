import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage';
import { renderWithProviders } from '../test/render';
import { fetchAllLocations, fetchDeviceByName } from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  fetchAllLocations: vi.fn(),
  fetchDeviceByName: vi.fn(),
  fetchLocationMetrics: vi.fn(),
  fetchAiInference: vi.fn(),
  fetchEnvironmentalReading: vi.fn(),
}));

// SensorMap creates a real mapbox-gl Map, which needs a WebGL context jsdom
// doesn't provide. Stub it so tests can render the loaded dashboard state.
vi.mock('../components/SensorMap', () => ({
  default: () => null,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(fetchAllLocations).mockReset();
    vi.mocked(fetchDeviceByName).mockReset();
  });

  it('shows the dashboard loading state', () => {
    vi.mocked(fetchAllLocations).mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Loading sensor network')).toBeInTheDocument();
  });

  it('shows an API failure state', async () => {
    vi.mocked(fetchAllLocations).mockRejectedValue(new Error('network down'));

    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Unable to load sensor locations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('exposes accessible pressed state on city filter buttons', async () => {
    vi.mocked(fetchAllLocations).mockResolvedValue([
      {
        id: 'loc-1',
        latitude: 0.3136,
        longitude: 32.5811,
        coordinateSource: 'fixed',
        city: 'Kampala',
        deviceName: 'SB1',
      },
      {
        id: 'loc-2',
        latitude: 0.0512,
        longitude: 32.4637,
        coordinateSource: 'fixed',
        city: 'Entebbe',
        deviceName: 'SB2',
      },
    ]);
    vi.mocked(fetchDeviceByName).mockResolvedValue({
      deviceId: 'SB1',
      sensorType: 'MCU',
      metrics: [],
    });

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

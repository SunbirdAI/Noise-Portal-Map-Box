import { screen } from '@testing-library/react';
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
});

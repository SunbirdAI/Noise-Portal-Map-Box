import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAiInference, fetchDeviceByName, fetchEnvironmentalReading } from './api/client';
import { fetchSensorLiveData } from './liveSensorData';
import { liveDataToNoiseMetric } from './sensors';

vi.mock('./api/client', () => ({
  fetchAiInference: vi.fn(),
  fetchDeviceByName: vi.fn(),
  fetchEnvironmentalReading: vi.fn(),
}));

describe('fetchSensorLiveData', () => {
  beforeEach(() => {
    vi.mocked(fetchAiInference).mockReset();
    vi.mocked(fetchDeviceByName).mockReset();
    vi.mocked(fetchEnvironmentalReading).mockReset();
  });

  it('uses the environmental endpoint as the live noise source for SEAS-1', async () => {
    vi.mocked(fetchEnvironmentalReading).mockResolvedValue({
      deviceName: 'SEAS-1',
      dbLevel: 52.14,
      createdAt: '2026-06-10T14:54:02.847961+03:00',
    });
    vi.mocked(fetchAiInference).mockResolvedValue({
      deviceName: 'SEAS-1',
      className: 'generator',
      probability: 0.36,
      audioName: '40.wav',
      createdAt: '2026-06-10T14:54:00.000000+03:00',
    });

    const data = await fetchSensorLiveData('SEAS-1');

    expect(fetchDeviceByName).not.toHaveBeenCalled();
    expect(data).toMatchObject({
      type: 'AI',
      deviceName: 'SEAS-1',
      latestNoise: 52.14,
      lastUpdated: '2026-06-10T14:54:02.847961+03:00',
      battery: null,
    });
    expect(data.inference?.className).toBe('generator');
  });

  it('does not use stale generic metrics for SEAS-2', async () => {
    vi.mocked(fetchDeviceByName).mockResolvedValue({
      deviceId: 'SEAS-2',
      sensorType: 'AI',
      metrics: [
        {
          dbLevel: 0,
          uploadedAt: '2026-02-01T10:00:00+03:00',
        },
      ],
    });
    vi.mocked(fetchEnvironmentalReading).mockResolvedValue({
      deviceName: 'SEAS-2',
      dbLevel: 62.35,
      createdAt: '2026-06-10T14:53:35.006602+03:00',
    });
    vi.mocked(fetchAiInference).mockResolvedValue(undefined);

    const data = await fetchSensorLiveData('SEAS-2');

    expect(fetchDeviceByName).not.toHaveBeenCalled();
    expect(data.latestNoise).toBe(62.35);
    expect(data.lastUpdated).toBe('2026-06-10T14:53:35.006602+03:00');
  });

  it('keeps SEAS marker data when one AI endpoint fails', async () => {
    vi.mocked(fetchEnvironmentalReading).mockResolvedValue({
      deviceName: 'SEAS-1',
      dbLevel: 52.14,
      createdAt: '2026-06-10T14:54:02.847961+03:00',
    });
    vi.mocked(fetchAiInference).mockRejectedValue(new Error('inference unavailable'));

    const data = await fetchSensorLiveData('SEAS-1');

    expect(data.latestNoise).toBe(52.14);
    expect(data.inference).toBeUndefined();
  });

  it('treats zero as a real live value', () => {
    const metric = liveDataToNoiseMetric({
      type: 'AI',
      deviceName: 'SEAS-2',
      latestNoise: 0,
      lastUpdated: '2026-06-10T14:53:35.006602+03:00',
      battery: null,
    });

    expect(metric?.dbLevel).toBe(0);
    expect(metric?.uploadedAt).toBe('2026-06-10T14:53:35.006602+03:00');
  });
});

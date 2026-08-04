import { QueryClient, QueryObserver, focusManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveSensorQuery } from './queries';
import { fetchSensorLiveData } from '../liveSensorData';
import type { SensorLiveData } from '../../models/sensor';

vi.mock('../liveSensorData', () => ({
  fetchSensorLiveData: vi.fn(),
}));

function liveData(overrides: Partial<SensorLiveData> = {}): SensorLiveData {
  return {
    type: 'MCU',
    deviceName: 'SB5',
    latestNoise: 42,
    lastUpdated: '2026-08-03T00:00:00Z',
    battery: 3.9,
    ...overrides,
  };
}

describe('liveSensorQuery', () => {
  let queryClient: QueryClient;
  let observer: QueryObserver<SensorLiveData, Error, SensorLiveData, SensorLiveData, string[]>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetchSensorLiveData).mockReset().mockResolvedValue(liveData());
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.mount();
    focusManager.setFocused(true);
  });

  afterEach(() => {
    observer?.destroy();
    queryClient.unmount();
    queryClient.clear();
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it('polls every 60 seconds while the tab is focused', async () => {
    observer = new QueryObserver(queryClient, liveSensorQuery('SB5'));
    const unsubscribe = observer.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(3);

    unsubscribe();
  });

  it('pauses polling while the tab is in the background', async () => {
    observer = new QueryObserver(queryClient, liveSensorQuery('SB5'));
    const unsubscribe = observer.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(1);

    focusManager.setFocused(false);

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('refetches immediately when the user returns to the tab', async () => {
    observer = new QueryObserver(queryClient, liveSensorQuery('SB5'));
    const unsubscribe = observer.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(1);

    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(1);

    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSensorLiveData).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('keeps the previous reading visible while a background refetch is in flight', async () => {
    observer = new QueryObserver(queryClient, liveSensorQuery('SB5'));
    const unsubscribe = observer.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data?.latestNoise).toBe(42);

    vi.mocked(fetchSensorLiveData).mockResolvedValue(liveData({ latestNoise: 58 }));
    void queryClient.refetchQueries({ queryKey: ['sensorLiveData', 'SB5'] });

    const duringRefetch = observer.getCurrentResult();
    expect(duringRefetch.isFetching).toBe(true);
    expect(duringRefetch.data?.latestNoise).toBe(42);

    await vi.advanceTimersByTimeAsync(0);
    expect(observer.getCurrentResult().data?.latestNoise).toBe(58);

    unsubscribe();
  });
});

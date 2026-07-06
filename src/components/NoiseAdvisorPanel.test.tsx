import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NoiseAdvisorPanel from './NoiseAdvisorPanel';
import { renderWithProviders } from '../test/render';

let fetchMock: ReturnType<typeof vi.fn>;

function advisorPayload(overrides: Record<string, unknown> = {}) {
  return {
    device_id: 'SB1003',
    lang: 'en',
    audience: 'resident',
    insight: 'Noise is moderate today. Keep windows closed during the loudest periods if it bothers you.',
    status: 'ready',
    cached: false,
    generated_at: '2026-06-12T07:58:24+03:00',
    range: {
      start_date: '2026-06-11T07:58:24+03:00',
      end_date: '2026-06-12T07:58:24+03:00',
    },
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('NoiseAdvisorPanel', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders a CTA by default and fetches a ready insight only after user action', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(advisorPayload()));

    renderWithProviders(<NoiseAdvisorPanel deviceName="SB1003" />);

    expect(screen.getByRole('heading', { name: /Noise Advisor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explain this location noise data' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Explain this location noise data' }));

    expect(await screen.findByText(/Noise is moderate today/i)).toBeInTheDocument();
    expect(screen.getByText('New summary')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders the not-enough-data note for empty responses', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(advisorPayload({ insight: null, status: 'empty' })));

    renderWithProviders(<NoiseAdvisorPanel deviceName="SB1003" />);

    await user.click(screen.getByRole('button', { name: 'Explain this location noise data' }));

    expect(await screen.findByText('Not enough data yet for this location.')).toBeInTheDocument();
  });

  it('renders a quiet retry note for unavailable responses', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(advisorPayload({ insight: null, status: 'unavailable' })));

    renderWithProviders(<NoiseAdvisorPanel deviceName="SB1003" />);

    await user.click(screen.getByRole('button', { name: 'Explain this location noise data' }));

    expect(await screen.findByText(/The summary could not be prepared right now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('does one delayed retry for a generating response and then renders ready data', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(advisorPayload({ insight: null, status: 'generating' })))
      .mockResolvedValueOnce(jsonResponse(advisorPayload({ insight: 'The summary is ready after a short wait.', status: 'ready' })));

    renderWithProviders(<NoiseAdvisorPanel deviceName="SB1003" />);

    fireEvent.click(screen.getByRole('button', { name: 'Explain this location noise data' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Preparing this location's summary...")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
      await Promise.resolve();
    });

    expect(screen.getByText('The summary is ready after a short wait.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches with lang=lug after the language toggle changes following first load', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(advisorPayload()))
      .mockResolvedValueOnce(
        jsonResponse(
          advisorPayload({
            lang: 'lug',
            insight: "Eddoboozi lya leero liri wakati. Ggalawo amadirisa ng'eddoboozi lisinga.",
            cached: true,
          }),
        ),
      );

    renderWithProviders(<NoiseAdvisorPanel deviceName="SB1003" />);

    await user.click(screen.getByRole('button', { name: 'Explain this location noise data' }));
    expect(await screen.findByText(/Noise is moderate today/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show advisor in Luganda' }));

    expect(await screen.findByRole('heading', { name: /Omuwabuzi w'eddoboozi/i })).toBeInTheDocument();
    expect(await screen.findByText(/Eddoboozi lya leero/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('lang=lug');
  });
});

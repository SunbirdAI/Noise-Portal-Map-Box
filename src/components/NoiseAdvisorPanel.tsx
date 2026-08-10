import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageSquare, RefreshCw } from 'lucide-react';
import Badge from './Badge';
import { scopedAdvisorQuery } from '../lib/api/v2Queries';
import { formatDateTime, formatRelative } from '../lib/format';
import type { ApiScope } from '../models/portal';
import { PUBLIC_SCOPE } from '../models/portal';
import type { AdvisorAudience, AdvisorLanguage, NoiseAdvisorInsight } from '../models/sensor';

interface NoiseAdvisorPanelProps {
  deviceId: string;
  scope?: ApiScope;
}

interface PanelCopy {
  title: string;
  body: string;
  languageGroup: string;
  audienceGroup: string;
  english: string;
  luganda: string;
  resident: string;
  official: string;
  selectEnglish: string;
  selectLuganda: string;
  selectResident: string;
  selectOfficial: string;
  explain: string;
  explainAria: string;
  refresh: string;
  tryAgain: string;
  loading: string;
  empty: string;
  unavailable: string;
  generating: string;
  error: string;
  noDevice: string;
  cached: string;
  fresh: string;
  generated: string;
  generatedUnknown: string;
}

const COPY: Record<AdvisorLanguage, PanelCopy> = {
  en: {
    title: 'Noise Advisor',
    body: 'Get a short explanation of what these readings may mean for people nearby.',
    languageGroup: 'Language',
    audienceGroup: 'Audience',
    english: 'English',
    luganda: 'Luganda',
    resident: 'Resident',
    official: 'Official',
    selectEnglish: 'Show advisor in English',
    selectLuganda: 'Show advisor in Luganda',
    selectResident: 'Explain for residents',
    selectOfficial: 'Explain for officials',
    explain: 'Explain this data',
    explainAria: 'Explain this location noise data',
    refresh: 'Refresh',
    tryAgain: 'Try again',
    loading: "Preparing this location's summary...",
    empty: 'Not enough data yet for this location.',
    unavailable: 'The summary could not be prepared right now. The rest of the location data is still available.',
    generating: 'Your summary is being prepared. Check back shortly.',
    error: 'The summary is unavailable right now. The rest of the location data is still available.',
    noDevice: 'A device ID is needed before the advisor can run.',
    cached: 'Cached',
    fresh: 'New summary',
    generated: 'Generated',
    generatedUnknown: 'Generated time unavailable',
  },
  lug: {
    title: "Omuwabuzi w'eddoboozi",
    body: "Funa okunnyonnyola okumpi ku makulu g'ebipimo bino eri abantu abali okumpi.",
    languageGroup: 'Olulimi',
    audienceGroup: 'Abasomi',
    english: 'Olungereza',
    luganda: 'Oluganda',
    resident: 'Abatuuze',
    official: 'Abakungu',
    selectEnglish: 'Laga omuwabuzi mu Lungereza',
    selectLuganda: 'Laga omuwabuzi mu Luganda',
    selectResident: 'Nnyonnyola eri abatuuze',
    selectOfficial: 'Nnyonnyola eri abakungu',
    explain: 'Nnyonnyola data eno',
    explainAria: "Nnyonnyola data y'eddoboozi ey'ekifo kino",
    refresh: 'Zza bugya',
    tryAgain: 'Ddamu',
    loading: "Tutegeka okunnyonnyola kw'ekifo kino...",
    empty: 'Data temala kunnyonnyola kifo kino.',
    unavailable: "Okunnyonnyola tekusobose kati. Data endala ey'ekifo ekyaliwo.",
    generating: 'Okunnyonnyola kutegekebwa. Ddamu olabe mu kaseera katono.',
    error: "Okunnyonnyola tekuliiwo kati. Data endala ey'ekifo ekyaliwo.",
    noDevice: "ID y'ekyuma yeetaagibwa omuwabuzi okutandika.",
    cached: 'Kyaterekebwa',
    fresh: 'Kiggya',
    generated: 'Kyakoleddwa',
    generatedUnknown: 'Obudde bwe kyakoleddwa tebuliwo',
  },
};

export default function NoiseAdvisorPanel({ deviceId, scope = PUBLIC_SCOPE }: NoiseAdvisorPanelProps) {
  const [lang, setLang] = useState<AdvisorLanguage>('en');
  const [audience, setAudience] = useState<AdvisorAudience>('resident');
  const [requested, setRequested] = useState(false);
  const copy = COPY[lang];
  const hasDevice = Boolean(deviceId);
  const advisorOptions = scopedAdvisorQuery(scope, deviceId, lang, audience, requested);
  const advisorResult = useQuery(advisorOptions);
  const queryClient = useQueryClient();
  const queryState = queryClient.getQueryState<NoiseAdvisorInsight>(advisorOptions.queryKey);
  const data = advisorResult.data;
  const generatingRetryPending = data?.status === 'generating' && (queryState?.dataUpdateCount ?? 0) <= 1;
  const showLoading = requested && (advisorResult.isPending || generatingRetryPending);

  function handleExplain() {
    if (hasDevice) {
      setRequested(true);
    }
  }

  function handleRefresh() {
    setRequested(true);
    void advisorResult.refetch();
  }

  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <MessageSquare size={18} aria-hidden="true" />
            </span>
            {copy.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{copy.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl label={copy.languageGroup}>
            <ToggleButton active={lang === 'en'} ariaLabel={copy.selectEnglish} onClick={() => setLang('en')}>
              {copy.english}
            </ToggleButton>
            <ToggleButton active={lang === 'lug'} ariaLabel={copy.selectLuganda} onClick={() => setLang('lug')}>
              {copy.luganda}
            </ToggleButton>
          </SegmentedControl>
          <SegmentedControl label={copy.audienceGroup}>
            <ToggleButton active={audience === 'resident'} ariaLabel={copy.selectResident} onClick={() => setAudience('resident')}>
              {copy.resident}
            </ToggleButton>
            <ToggleButton active={audience === 'official'} ariaLabel={copy.selectOfficial} onClick={() => setAudience('official')}>
              {copy.official}
            </ToggleButton>
          </SegmentedControl>
        </div>
      </div>

      <div className="mt-4">
        {!hasDevice ? <QuietNote message={copy.noDevice} /> : null}
        {hasDevice && !requested ? (
          <button
            type="button"
            onClick={handleExplain}
            aria-label={copy.explainAria}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-extrabold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <MessageSquare size={16} aria-hidden="true" />
            {copy.explain}
          </button>
        ) : null}
        {hasDevice && showLoading ? <AdvisorLoading message={copy.loading} /> : null}
        {hasDevice && requested && !showLoading ? (
          <AdvisorContent
            data={data}
            copy={copy}
            isError={advisorResult.isError}
            isFetching={advisorResult.isFetching}
            onRefresh={handleRefresh}
          />
        ) : null}
      </div>
    </section>
  );
}

function AdvisorContent({
  data,
  copy,
  isError,
  isFetching,
  onRefresh,
}: {
  data?: NoiseAdvisorInsight;
  copy: PanelCopy;
  isError: boolean;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  if (isError) {
    return <QuietNote message={copy.error} actionLabel={copy.tryAgain} onAction={onRefresh} loading={isFetching} />;
  }

  if (!data) {
    return null;
  }

  if (data.status === 'ready' && data.insight) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="max-w-4xl text-sm leading-6 text-slate-700">{data.insight}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
          <span>{data.generatedAt ? `${copy.generated} ${formatRelative(data.generatedAt)} (${formatDateTime(data.generatedAt)})` : copy.generatedUnknown}</span>
          <Badge tone={data.cached ? 'neutral' : 'blue'}>{data.cached ? copy.cached : copy.fresh}</Badge>
          <RefreshButton label={copy.refresh} onClick={onRefresh} loading={isFetching} />
        </div>
      </div>
    );
  }

  if (data.status === 'empty') {
    return <QuietNote message={copy.empty} />;
  }

  if (data.status === 'generating') {
    return <QuietNote message={copy.generating} actionLabel={copy.refresh} onAction={onRefresh} loading={isFetching} />;
  }

  return <QuietNote message={copy.unavailable} actionLabel={copy.tryAgain} onAction={onRefresh} loading={isFetching} />;
}

function AdvisorLoading({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-lagoon" aria-hidden="true" />
        {message}
      </div>
      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

function QuietNote({
  message,
  actionLabel,
  onAction,
  loading = false,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="max-w-3xl text-sm leading-6 text-slate-600">{message}</p>
      {actionLabel && onAction ? <RefreshButton label={actionLabel} onClick={onAction} loading={loading} /> : null}
    </div>
  );
}

function RefreshButton({ label, onClick, loading }: { label: string; onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw size={15} aria-hidden="true" className={clsx(loading && 'animate-spin')} />
      {label}
    </button>
  );
}

function SegmentedControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-extrabold transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

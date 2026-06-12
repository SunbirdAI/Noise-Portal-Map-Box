import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Battery, BrainCircuit, CloudSun, Gauge, RadioTower, ShieldAlert } from 'lucide-react';
import Badge from '../components/Badge';
import LoadingPanel from '../components/LoadingPanel';
import MetricCard from '../components/MetricCard';
import StatusPanel from '../components/StatusPanel';
import LocationCharts from '../components/LocationCharts';
import {
  liveSensorQuery,
  locationMetricsQuery,
  locationsQuery,
} from '../lib/api/queries';
import { aggregateDailyPoints, buildHeatmap, metricsToChartPoints, normalizeHourlyTrendData } from '../lib/charts';
import { selectDetailNoiseMetrics } from '../lib/detailMetrics';
import { formatDateTime, formatDb, formatInteger, formatNumber, formatRelative } from '../lib/format';
import { detectSensorType, getLatestMetric } from '../lib/sensors';
import type { NoiseMetric } from '../models/sensor';

export default function LocationDetailPage() {
  const { locationId = '' } = useParams();
  const locationsResult = useQuery(locationsQuery());
  const locationMetricsResult = useQuery(locationMetricsQuery(locationId));
  const location = useMemo(
    () => locationsResult.data?.find((candidate) => candidate.id === locationId),
    [locationId, locationsResult.data],
  );
  const deviceName = location?.deviceName ?? locationMetricsResult.data?.deviceName ?? '';
  const liveSensorResult = useQuery({
    ...liveSensorQuery(deviceName),
    enabled: Boolean(deviceName),
  });
  const liveData = liveSensorResult.data;
  const device = liveData?.device;
  const inferredType = liveData?.type ?? detectSensorType({ deviceName });
  const isAiSensor = inferredType === 'AI';

  const availableMetrics = useMemo<NoiseMetric[]>(() => {
    return selectDetailNoiseMetrics(locationMetricsResult.data?.hourly, liveData);
  }, [liveData, locationMetricsResult.data?.hourly]);

  const latestMetric = useMemo(() => getLatestMetric(availableMetrics), [availableMetrics]);
  const hourlyPoints = useMemo(() => normalizeHourlyTrendData(availableMetrics), [availableMetrics]);
  const dailyPoints = useMemo(() => {
    const daily = locationMetricsResult.data?.daily ?? [];
    return daily.length > 0 ? metricsToChartPoints(daily) : aggregateDailyPoints(availableMetrics);
  }, [availableMetrics, locationMetricsResult.data?.daily]);
  const heatmap = useMemo(() => buildHeatmap(availableMetrics), [availableMetrics]);

  if (locationsResult.isPending && locationMetricsResult.isPending) {
    return <LoadingPanel title="Loading location details" body="Reconstructing this sensor from the direct route and live API data." />;
  }

  if (!location && locationsResult.isSuccess && locationMetricsResult.isSuccess && !locationMetricsResult.data.deviceName) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Location not found"
          body="No location with this ID was returned by the backend. It may have been removed or the URL may be incorrect."
        />
      </div>
    );
  }

  if (locationsResult.isError && locationMetricsResult.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Unable to load this location"
          body="Both the location list and location metrics requests failed. Check the API base URL and try again."
          actionLabel="Retry"
          onAction={() => {
            void locationsResult.refetch();
            void locationMetricsResult.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isAiSensor ? 'blue' : inferredType === 'MCU' ? 'green' : 'neutral'}>{inferredType}</Badge>
          <Badge tone={latestMetric ? 'green' : 'neutral'}>{latestMetric ? 'Live metrics' : 'No live data'}</Badge>
        </div>
      </div>

      {locationsResult.isError || locationMetricsResult.isError || liveSensorResult.isError ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Some location detail requests failed. The page is showing all data that could be loaded from the backend.
        </div>
      ) : null}

      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-slate-500">{location?.city ?? 'Location'}</p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-slate-950">
              {(location?.village ?? location?.parish ?? device?.displayName ?? deviceName) || 'Unknown sensor'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {location?.description ?? 'Location metadata is unavailable from the current backend response.'}
            </p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Metadata label="Device ID" value={deviceName || 'No data'} />
              <Metadata label="Division" value={location?.division ?? 'No data'} />
              <Metadata label="Parish" value={location?.parish ?? 'No data'} />
              <Metadata label="Coordinates" value={location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'No data'} />
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-slate-500">Limits and Health</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <Metadata label="Day limit" value={formatDb(location?.dayLimit)} />
              <Metadata label="Night limit" value={formatDb(location?.nightLimit)} />
              <Metadata label="Last seen" value={formatDateTime(device?.lastSeen ?? latestMetric?.uploadedAt)} />
              <Metadata label="Updated" value={formatRelative(device?.lastSeen ?? latestMetric?.uploadedAt)} />
            </dl>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Latest hourly average"
          value={formatDb(latestMetric?.avgDbLevel ?? latestMetric?.dbLevel)}
          detail="Most recent backend reading"
          icon={<Gauge size={18} aria-hidden="true" />}
          tone={(latestMetric?.avgDbLevel ?? latestMetric?.dbLevel ?? 0) > 55 ? 'warn' : 'good'}
        />
        <MetricCard
          label="Hourly max"
          value={formatDb(latestMetric?.maxDbLevel)}
          detail="Peak value in the latest metric"
          icon={<Activity size={18} aria-hidden="true" />}
        />
        <MetricCard
          label="Median dB"
          value={formatDb(latestMetric?.medianDbLevel)}
          detail="Shown only when supplied by backend"
          icon={<RadioTower size={18} aria-hidden="true" />}
        />
        <MetricCard
          label="Exceedances"
          value={formatInteger(latestMetric?.exceedances)}
          detail="Latest metric exceedance count"
          icon={<ShieldAlert size={18} aria-hidden="true" />}
          tone={(latestMetric?.exceedances ?? 0) > 0 ? 'warn' : 'good'}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Suspense fallback={<LoadingPanel title="Loading charts" />}>
          <LocationCharts hourlyPoints={hourlyPoints} dailyPoints={dailyPoints} heatmap={heatmap} />
        </Suspense>

        <aside className="grid content-start gap-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">
              <Battery size={18} aria-hidden="true" />
              Device Health
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <Metadata label="Battery" value={formatNumber(latestMetric?.batteryVoltage, 'V')} />
              <Metadata label="Panel voltage" value={formatNumber(latestMetric?.panelVoltage, 'V')} />
              <Metadata label="Signal strength" value={formatNumber(latestMetric?.signalStrength)} />
              <Metadata label="Data balance" value={formatNumber(latestMetric?.dataBalance)} />
              <Metadata label="Firmware" value={device?.versionNumber ?? 'No data'} />
              <Metadata label="Stage" value={device?.productionStage ?? 'No data'} />
            </dl>
          </section>

          <AiPanels
            enabled={isAiSensor}
            aiLoading={liveSensorResult.isPending && isAiSensor}
            envLoading={liveSensorResult.isPending && isAiSensor}
            aiError={liveSensorResult.isError}
            envError={liveSensorResult.isError}
            inference={liveData?.inference}
            environmental={liveData?.environment}
          />
        </aside>
      </section>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-bold text-slate-700">{value}</dd>
    </div>
  );
}

function AiPanels({
  enabled,
  aiLoading,
  envLoading,
  aiError,
  envError,
  inference,
  environmental,
}: {
  enabled: boolean;
  aiLoading: boolean;
  envLoading: boolean;
  aiError: boolean;
  envError: boolean;
  inference?: { className?: string; probability?: number; audioName?: string; createdAt?: string };
  environmental?: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    airQuality?: number;
    ramValue?: number;
    systemTemperature?: number;
    powerUsage?: number;
    dbLevel?: number;
    createdAt?: string;
  };
}) {
  if (!enabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <BrainCircuit size={18} aria-hidden="true" />
          AI Inference
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">AI inference and environmental telemetry are shown for AI sensors only.</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <BrainCircuit size={18} aria-hidden="true" />
          AI Inference
        </h2>
        {aiLoading ? <MiniLoading /> : null}
        {aiError ? <MiniError label="AI inference is unavailable." /> : null}
        {!aiLoading && !aiError ? (
          inference ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <Metadata label="Class" value={inference.className ?? 'No data'} />
              <Metadata label="Probability" value={formatNumber(inference.probability === undefined ? undefined : inference.probability * 100, '%')} />
              <Metadata label="Audio sample" value={inference.audioName ?? 'No data'} />
              <Metadata label="Created" value={formatDateTime(inference.createdAt)} />
            </dl>
          ) : (
            <MiniEmpty label="No AI inference has been returned for this sensor." />
          )
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-950">
          <CloudSun size={18} aria-hidden="true" />
          Environmental Data
        </h2>
        {envLoading ? <MiniLoading /> : null}
        {envError ? <MiniError label="Environmental telemetry is unavailable." /> : null}
        {!envLoading && !envError ? (
          environmental ? (
            <dl className="mt-4 grid gap-3 text-sm">
              <Metadata label="Temperature" value={formatNumber(environmental.temperature, 'C')} />
              <Metadata label="Humidity" value={formatNumber(environmental.humidity, '%')} />
              <Metadata label="Pressure" value={formatNumber(environmental.pressure)} />
              <Metadata label="Air quality" value={formatNumber(environmental.airQuality)} />
              <Metadata label="System temperature" value={formatNumber(environmental.systemTemperature, 'C')} />
              <Metadata label="Power usage" value={formatNumber(environmental.powerUsage, 'W')} />
              <Metadata label="Noise reading" value={formatDb(environmental.dbLevel)} />
              <Metadata label="Created" value={formatDateTime(environmental.createdAt)} />
            </dl>
          ) : (
            <MiniEmpty label="No environmental telemetry has been returned for this sensor." />
          )
        ) : null}
      </section>
    </>
  );
}

function MiniLoading() {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-lagoon" />
      Loading
    </div>
  );
}

function MiniError({ label }: { label: string }) {
  return <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{label}</p>;
}

function MiniEmpty({ label }: { label: string }) {
  return <p className="mt-4 text-sm leading-6 text-slate-600">{label}</p>;
}

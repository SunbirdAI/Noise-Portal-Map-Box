import { lazy, Suspense, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Download, Gauge, MapPin, RadioTower } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import LoadingPanel from '../components/LoadingPanel';
import MetricCard from '../components/MetricCard';
import SensorList from '../components/SensorList';
import StatusPanel from '../components/StatusPanel';
import { scopedDevicesQuery, scopedLiveSensorQuery } from '../lib/api/v2Queries';
import { buildDashboardCsvRows, dashboardCsvFilename, downloadCsv } from '../lib/csvExport';
import { formatDb, formatInteger } from '../lib/format';
import { createSensorSummaryFromLiveData } from '../lib/sensors';
import type { ApiScope, ScopedDevice } from '../models/portal';
import { PUBLIC_SCOPE } from '../models/portal';
import type { SensorSummary } from '../models/sensor';

const SensorMap = lazy(() => import('../components/SensorMap'));

const DEFAULT_CITIES = ['Kampala', 'Entebbe'];
const EMPTY_DEVICES: ScopedDevice[] = [];

interface DashboardPageProps {
  scope?: ApiScope;
  title?: string;
  subtitle?: string;
  detailPath?: (deviceId: string) => string;
  portal?: boolean;
}

export default function DashboardPage({
  scope = PUBLIC_SCOPE,
  title = 'Noise Monitor',
  subtitle = 'Sunbird public sensor network',
  detailPath = (deviceId) => `/locations/${encodeURIComponent(deviceId)}`,
  portal = false,
}: DashboardPageProps) {
  const [cityFilter, setCityFilter] = useState('All');
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | undefined>();
  const devicesQueryResult = useQuery(scopedDevicesQuery(scope));
  const devices = devicesQueryResult.data ?? EMPTY_DEVICES;

  const cities = useMemo(() => {
    const unique = new Set([
      ...DEFAULT_CITIES,
      ...devices.map((device) => device.location?.city).filter((city): city is string => Boolean(city)),
    ]);
    return ['All', ...[...unique].sort((a, b) => a.localeCompare(b))];
  }, [devices]);

  const filteredDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.location &&
          (cityFilter === 'All' || device.location.city.toLowerCase() === cityFilter.toLowerCase()),
      ),
    [cityFilter, devices],
  );

  const liveSensorQueries = useQueries({
    queries: filteredDevices.map((device) => ({
      ...scopedLiveSensorQuery(scope, device),
      retry: 1,
    })),
  });

  const sensors = useMemo<SensorSummary[]>(
    () =>
      filteredDevices.map((device, index) => {
        const query = liveSensorQueries[index];
        return createSensorSummaryFromLiveData(
          { ...device.location!, detailRoute: detailPath(device.id) },
          query?.data,
          query?.isPending ? 'loading' : query?.isError ? 'error' : 'empty',
        );
      }),
    [detailPath, liveSensorQueries, filteredDevices],
  );

  const stats = useMemo(() => buildDashboardStats(sensors), [sensors]);
  const hasPartialMetricFailures = liveSensorQueries.some((query) => query.isError);
  const metricsLoading = liveSensorQueries.some((query) => query.isPending);

  async function handleExportCsv() {
    setExportMessage(undefined);
    setExportingCsv(true);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      const rows = buildDashboardCsvRows(sensors);

      if (rows.length === 0) {
        setExportMessage('No live noise data is available for the current filter yet.');
        return;
      }

      downloadCsv(dashboardCsvFilename(cityFilter), rows);
      setExportMessage(`${rows.length} row${rows.length === 1 ? '' : 's'} exported from the current dashboard view.`);
    } catch {
      setExportMessage('CSV export could not be prepared. Please try again.');
    } finally {
      setExportingCsv(false);
    }
  }

  if (devicesQueryResult.isPending) {
    return <LoadingPanel title="Loading sensor network" body="Fetching locations from the Sunbird noise sensor API." />;
  }

  if (devicesQueryResult.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Unable to load sensor locations"
          body="The dashboard could not load the visible device scope. Check the API connection and try again."
          actionLabel="Retry"
          onAction={() => void devicesQueryResult.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Mapped devices"
          value={formatInteger(stats.totalSensors)}
          detail={`${stats.reportingSensors} reporting · ${devices.length} visible total`}
          icon={<MapPin size={18} aria-hidden="true" />}
        />
        <MetricCard
          label="Network average"
          value={formatDb(stats.averageDb)}
          detail="Current readings only; no data is estimated"
          icon={<Gauge size={18} aria-hidden="true" />}
          tone={stats.averageDb && stats.averageDb >= 55 ? 'warn' : 'good'}
        />
        <MetricCard
          label="Exceedances"
          value={formatInteger(stats.exceedances)}
          detail="Reported by latest device metrics"
          icon={<AlertTriangle size={18} aria-hidden="true" />}
          tone={stats.exceedances > 0 ? 'warn' : 'good'}
        />
        <MetricCard
          label="Sensor mix"
          value={stats.sensorMix}
          detail="MCU, AI, mobile, and unknown sensors"
          icon={<RadioTower size={18} aria-hidden="true" />}
        />
      </section>

      {hasPartialMetricFailures ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Some device metric requests failed. Locations remain visible and unavailable values are shown as No data.
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-h-[520px]">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                  <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-lagoon" />
                  Loading map
                </div>
              </div>
            }
          >
            <SensorMap sensors={sensors} />
          </Suspense>
        </div>

        <aside className="min-w-0">
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-black text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700">
                <Activity size={15} aria-hidden="true" />
                Live API
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="City filter">
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    aria-pressed={cityFilter === city}
                    onClick={() => setCityFilter(city)}
                    className={clsx(
                      'rounded-lg px-3 py-2 text-sm font-bold transition',
                      cityFilter === city
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100',
                    )}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <div className="min-w-[150px]">
                <button
                  type="button"
                  onClick={() => void handleExportCsv()}
                  disabled={exportingCsv || metricsLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportingCsv ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" aria-hidden="true" />
                  ) : (
                    <Download size={15} aria-hidden="true" />
                  )}
                  {metricsLoading ? 'Loading data' : exportingCsv ? 'Preparing' : 'Export CSV'}
                </button>
                {exportMessage ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{exportMessage}</p> : null}
              </div>
            </div>
          </div>

          <SensorList sensors={sensors} />
        </aside>
      </section>

      <UnmappedDeviceList
        devices={devices.filter((device) => !device.location)}
        detailPath={detailPath}
        organizationScoped={portal}
      />
    </div>
  );
}

function UnmappedDeviceList({
  devices,
  detailPath,
  organizationScoped,
}: {
  devices: ScopedDevice[];
  detailPath: (deviceId: string) => string;
  organizationScoped: boolean;
}) {
  if (devices.length === 0) {
    return null;
  }

  return (
    <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-950">Devices awaiting a mapped location</h2>
      <p className="mt-1 text-sm text-slate-600">
        {organizationScoped
          ? 'These devices belong to this organization but cannot be placed on the map yet.'
          : 'These public devices remain available even though they cannot be placed on the map yet.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <Link
            key={device.id}
            to={detailPath(device.id)}
            className="rounded-lg border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <span className="block truncate font-extrabold text-slate-900">{device.displayName}</span>
            <span className="mt-1 block text-xs font-bold text-slate-500">{device.deviceId} · {device.sensorType}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function buildDashboardStats(sensors: SensorSummary[]) {
  const readings = sensors
    .map((sensor) => sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel)
    .filter((value): value is number => value !== undefined);
  const typeCounts = sensors.reduce<Record<string, number>>((counts, sensor) => {
    counts[sensor.sensorType] = (counts[sensor.sensorType] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalSensors: sensors.length,
    reportingSensors: readings.length,
    averageDb: readings.length ? readings.reduce((sum, value) => sum + value, 0) / readings.length : undefined,
    exceedances: sensors.reduce((total, sensor) => total + (sensor.latestMetric?.exceedances ?? 0), 0),
    sensorMix:
      Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(' / ') || 'No mapped devices',
  };
}

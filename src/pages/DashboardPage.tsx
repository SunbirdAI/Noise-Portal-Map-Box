import { lazy, Suspense, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Gauge, MapPin, RadioTower } from 'lucide-react';
import clsx from 'clsx';
import LoadingPanel from '../components/LoadingPanel';
import MetricCard from '../components/MetricCard';
import SensorList from '../components/SensorList';
import StatusPanel from '../components/StatusPanel';
import { liveSensorQuery, locationsQuery } from '../lib/api/queries';
import { formatDb, formatInteger } from '../lib/format';
import { createSensorSummaryFromLiveData } from '../lib/sensors';
import type { SensorLocation, SensorSummary } from '../models/sensor';

const SensorMap = lazy(() => import('../components/SensorMap'));

const DEFAULT_CITIES = ['Kampala', 'Entebbe'];
const EMPTY_LOCATIONS: SensorLocation[] = [];

export default function DashboardPage() {
  const [cityFilter, setCityFilter] = useState('All');
  const locationsQueryResult = useQuery(locationsQuery());
  const locations = locationsQueryResult.data ?? EMPTY_LOCATIONS;

  const cities = useMemo(() => {
    const unique = new Set([...DEFAULT_CITIES, ...locations.map((location) => location.city).filter(Boolean)]);
    return ['All', ...[...unique].sort((a, b) => a.localeCompare(b))];
  }, [locations]);

  const filteredLocations = useMemo(
    () => locations.filter((location) => cityFilter === 'All' || location.city.toLowerCase() === cityFilter.toLowerCase()),
    [cityFilter, locations],
  );

  const liveSensorQueries = useQueries({
    queries: filteredLocations.map((location) => ({
      ...liveSensorQuery(location.deviceName),
      retry: 1,
    })),
  });

  const sensors = useMemo<SensorSummary[]>(
    () =>
      filteredLocations.map((location, index) => {
        const query = liveSensorQueries[index];
        return createSensorSummaryFromLiveData(
          location,
          query?.data,
          query?.isPending ? 'loading' : query?.isError ? 'error' : 'empty',
        );
      }),
    [liveSensorQueries, filteredLocations],
  );

  const stats = useMemo(() => buildDashboardStats(sensors), [sensors]);
  const hasPartialMetricFailures = liveSensorQueries.some((query) => query.isError);

  if (locationsQueryResult.isPending) {
    return <LoadingPanel title="Loading sensor network" body="Fetching locations from the Sunbird noise sensor API." />;
  }

  if (locationsQueryResult.isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <StatusPanel
          title="Unable to load sensor locations"
          body="The dashboard could not reach the locations endpoint. Check the API base URL and network access, then try again."
          actionLabel="Retry"
          onAction={() => void locationsQueryResult.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Valid locations"
          value={formatInteger(stats.totalSensors)}
          detail={`${stats.reportingSensors} reporting live metrics`}
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
                <h1 className="text-xl font-black text-slate-950">Noise Monitor</h1>
                <p className="mt-1 text-sm text-slate-500">Kampala and Entebbe public sensor network</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700">
                <Activity size={15} aria-hidden="true" />
                Live API
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="City filter">
              {cities.map((city) => (
                <button
                  key={city}
                  type="button"
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
          </div>

          <SensorList sensors={sensors} />
        </aside>
      </section>
    </div>
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
    sensorMix: Object.entries(typeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(' / '),
  };
}

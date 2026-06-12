import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint, HeatmapCell, HourlyTrendPoint } from '../models/sensor';
import { formatDb } from '../lib/format';
import { countUniqueTrendTimestamps, formatTrendDateTime, formatTrendTime } from '../lib/charts';

interface LocationChartsProps {
  hourlyPoints: HourlyTrendPoint[];
  dailyPoints: ChartPoint[];
  heatmap: HeatmapCell[];
}

const hourlySeries = [
  { key: 'average', name: 'Average', color: '#087f8c' },
  { key: 'max', name: 'Max', color: '#d95d39' },
  { key: 'reading', name: 'Reading', color: '#247a4d' },
] as const;

export default function LocationCharts({ hourlyPoints, dailyPoints, heatmap }: LocationChartsProps) {
  const uniqueHourlyTimestamps = countUniqueTrendTimestamps(hourlyPoints);
  const drawableHourlySeries = hourlySeries.filter((series) => countNumericValues(hourlyPoints, series.key) >= 2);

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Hourly Noise Trend</h2>
            <p className="mt-1 text-sm text-slate-500">Average, peak, and observed dB readings from the latest available metrics.</p>
          </div>
        </div>
        {hourlyPoints.length === 0 ? (
          <EmptyChart />
        ) : uniqueHourlyTimestamps < 2 ? (
          <SingleReadingChart point={hourlyPoints[0]} />
        ) : drawableHourlySeries.length === 0 ? (
          <NoDrawableTrend />
        ) : (
          <ChartFrame>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={hourlyPoints} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={formatTrendTime}
                  minTickGap={28}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} unit=" dB" width={58} />
                <Tooltip formatter={formatTooltipValue} labelFormatter={formatTooltipLabel} />
                <Legend />
                {drawableHourlySeries.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.name}
                    stroke={series.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-950">Daily Summary</h2>
          <p className="mt-1 text-sm text-slate-500">Aggregated daily values when the backend has daily metrics; otherwise derived from recent device readings.</p>
        </div>
        <ChartFrame empty={dailyPoints.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyPoints} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} width={58} />
              <Tooltip formatter={(value, name) => (name === 'Exceedances' ? Number(value).toLocaleString() : formatDb(Number(value)))} />
              <Legend />
              <Bar dataKey="avg" name="Average" fill="#087f8c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="max" name="Max" fill="#d95d39" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exceedances" name="Exceedances" fill="#f6ae2d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-950">Weekly Hour Heatmap</h2>
          <p className="mt-1 text-sm text-slate-500">Average dB by day and hour from available timestamped readings.</p>
        </div>
        {heatmap.length === 0 ? (
          <EmptyChart />
        ) : (
          <HeatmapGrid cells={heatmap} />
        )}
      </section>
    </div>
  );
}

function ChartFrame({ empty = false, children }: { empty?: boolean; children: React.ReactNode }) {
  if (empty) {
    return <EmptyChart />;
  }

  return <div className="h-[320px] w-full">{children}</div>;
}

function EmptyChart() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
      No chart data is available for this sensor yet.
    </div>
  );
}

function SingleReadingChart({ point }: { point?: HourlyTrendPoint }) {
  const values = hourlySeries
    .map((series) => ({ ...series, value: point?.[series.key] }))
    .filter((series) => series.value !== null && series.value !== undefined);

  return (
    <div className="flex min-h-64 flex-col justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-bold text-slate-800">Only one reading available.</p>
        <p className="mt-2 leading-6">Trend will appear after more readings are collected.</p>
        {point ? <p className="mt-2 text-xs font-semibold text-slate-500">{formatTrendDateTime(point.timestamp)}</p> : null}
      </div>
      {values.length > 0 ? (
        <dl className="mx-auto mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-3">
          {values.map((series) => (
            <div key={series.key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: series.color }} aria-hidden="true" />
                {series.name}
              </dt>
              <dd className="mt-1 font-black text-slate-900">{formatDb(series.value ?? undefined)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function NoDrawableTrend() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm leading-6 text-slate-600">
      Multiple timestamps were returned, but no noise series has enough numeric values to draw a trend.
    </div>
  );
}

function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
  const days = [...new Set(cells.map((cell) => cell.day))].sort();
  const cellByKey = new Map(cells.map((cell) => [`${cell.day}-${cell.hour}`, cell]));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: '92px repeat(24, minmax(22px, 1fr))' }}>
        <div />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="text-center text-[11px] font-bold text-slate-400">
            {hour}
          </div>
        ))}
        {days.map((day) => (
          <div key={day} className="contents">
            <div className="pr-2 text-xs font-bold text-slate-500">{day}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = cellByKey.get(`${day}-${hour}`);
              return (
                <div
                  key={`${day}-${hour}`}
                  title={cell?.avg === undefined ? 'No data' : `${day} ${hour}:00 - ${formatDb(cell.avg)}`}
                  className="h-7 rounded"
                  style={{ backgroundColor: heatColor(cell?.avg) }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function countNumericValues(points: HourlyTrendPoint[], key: keyof Pick<HourlyTrendPoint, 'average' | 'max' | 'reading'>): number {
  return points.filter((point) => {
    const value = point[key];
    return typeof value === 'number' && Number.isFinite(value);
  }).length;
}

function formatTooltipValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatDb(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? formatDb(parsed) : 'No data';
  }

  return 'No data';
}

function formatTooltipLabel(label: unknown): string {
  if (typeof label === 'number' && Number.isFinite(label)) {
    return formatTrendDateTime(label);
  }

  if (typeof label === 'string') {
    const parsed = Number(label);
    return Number.isFinite(parsed) ? formatTrendDateTime(parsed) : label;
  }

  return 'No timestamp';
}

function heatColor(value?: number): string {
  if (value === undefined) {
    return '#f1f5f9';
  }

  if (value < 45) {
    return '#bbf7d0';
  }

  if (value < 55) {
    return '#99f6e4';
  }

  if (value < 70) {
    return '#fde68a';
  }

  return '#fecdd3';
}

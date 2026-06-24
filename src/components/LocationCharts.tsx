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
import { countUniqueTrendTimestamps, formatDateKeyLabel, formatTrendDateTime, formatTrendTime } from '../lib/charts';
import { getNoiseColor, NOISE_LEVEL_RANGES, NOISE_NO_DATA_COLOR, NOISE_NO_DATA_LABEL } from '../lib/noiseScale';

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
          <div className="h-full">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={dailyPoints} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} minTickGap={18} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} width={58} />
                <Tooltip
                  formatter={(value, name) => (name === 'Exceedances' ? Number(value).toLocaleString() : formatDb(Number(value)))}
                  labelFormatter={(label) => `Date: ${String(label)}`}
                />
                <Legend verticalAlign="bottom" height={34} />
                <Bar dataKey="avg" name="Average" fill="#087f8c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="max" name="Max" fill="#d95d39" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exceedances" name="Exceedances" fill="#f6ae2d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-xs font-semibold text-slate-500">Date (Africa/Kampala)</p>
          </div>
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
          <>
            <HeatmapGrid cells={heatmap} />
            <HeatmapLegend />
          </>
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
            <div className="pr-2 text-xs font-bold text-slate-500" title={day}>
              {formatDateKeyLabel(day)}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = cellByKey.get(`${day}-${hour}`);
              const label = cell?.avg === undefined ? `${formatDateKeyLabel(day)} ${hour}:00 - No data` : `${formatDateKeyLabel(day)} ${hour}:00 - ${formatDb(cell.avg)}`;
              return (
                <div
                  key={`${day}-${hour}`}
                  aria-label={label}
                  title={label}
                  className="h-7 rounded"
                  style={{
                    backgroundColor: heatColor(cell?.avg),
                    opacity: cell?.avg === undefined ? 0.24 : 1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div
      className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
      aria-label="Weekly hour heatmap color key"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Heatmap key</p>
        <p className="text-xs font-semibold text-slate-500">Average decibels (dB)</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {NOISE_LEVEL_RANGES.map((range) => (
          <li key={range.id} className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: range.color }}
              aria-hidden="true"
            />
            <span className="truncate">
              <span className="font-bold text-slate-700">{range.label}</span>
              <span className="text-slate-500"> · {range.category}</span>
            </span>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
          <span
            className="size-3 shrink-0 rounded-sm"
            style={{ backgroundColor: NOISE_NO_DATA_COLOR, opacity: 0.35 }}
            aria-hidden="true"
          />
          <span className="font-bold text-slate-700">{NOISE_NO_DATA_LABEL}</span>
        </li>
      </ul>
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
  return getNoiseColor(value);
}

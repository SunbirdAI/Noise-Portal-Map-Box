import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint, HeatmapCell } from '../models/sensor';
import { formatDb } from '../lib/format';

interface LocationChartsProps {
  hourlyPoints: ChartPoint[];
  dailyPoints: ChartPoint[];
  heatmap: HeatmapCell[];
}

export default function LocationCharts({ hourlyPoints, dailyPoints, heatmap }: LocationChartsProps) {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">Hourly Noise Trend</h2>
            <p className="mt-1 text-sm text-slate-500">Average, peak, and observed dB readings from the latest available metrics.</p>
          </div>
        </div>
        <ChartFrame empty={hourlyPoints.length === 0}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={hourlyPoints} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} minTickGap={28} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} unit=" dB" width={58} />
              <Tooltip formatter={(value) => formatDb(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="avg" name="Average" stroke="#087f8c" fill="#99f6e4" strokeWidth={2} connectNulls />
              <Area type="monotone" dataKey="max" name="Max" stroke="#d95d39" fill="#fed7aa" strokeWidth={2} connectNulls />
              <Area type="monotone" dataKey="db" name="Reading" stroke="#247a4d" fill="#bbf7d0" strokeWidth={2} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
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

function ChartFrame({ empty, children }: { empty: boolean; children: React.ReactNode }) {
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

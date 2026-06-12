import { ArrowRight, Battery, MapPin, RadioTower } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SensorSummary } from '../models/sensor';
import { formatDateTime, formatDb, formatNumber } from '../lib/format';
import { getNoiseCategory, type NoiseCategory } from '../lib/noiseScale';
import Badge from './Badge';

interface SensorListProps {
  sensors: SensorSummary[];
}

const categoryTone: Record<NoiseCategory, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  'No data': 'neutral',
  Quiet: 'green',
  Moderate: 'amber',
  Noisy: 'red',
};

export default function SensorList({ sensors }: SensorListProps) {
  if (sensors.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
        No valid sensor locations match the selected filter.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sensors.map((sensor) => {
        const category = getNoiseCategory(sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel);

        return (
          <Link
            key={sensor.id}
            to={`/locations/${sensor.id}`}
            className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-extrabold text-slate-950">
                    {sensor.village ?? sensor.parish ?? sensor.deviceName}
                  </h3>
                  <Badge tone={categoryTone[category]}>{formatDb(sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel)}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={14} aria-hidden="true" />
                  <span className="truncate">
                    {sensor.city}
                    {sensor.division ? `, ${sensor.division}` : ''}
                  </span>
                </p>
              </div>
              <ArrowRight
                size={18}
                className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700"
                aria-hidden="true"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Device</span>
                <span className="mt-1 flex items-center gap-1 font-bold text-slate-700">
                  <RadioTower size={14} aria-hidden="true" />
                  {sensor.deviceName}
                </span>
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Type</span>
                <span className="mt-1 block font-bold text-slate-700">{sensor.sensorType}</span>
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Updated</span>
                <span className="mt-1 block font-bold text-slate-700">
                  {formatDateTime(sensor.latestMetric?.uploadedAt ?? sensor.device?.lastSeen)}
                </span>
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">Battery</span>
                <span className="mt-1 flex items-center gap-1 font-bold text-slate-700">
                  <Battery size={14} aria-hidden="true" />
                  {formatNumber(sensor.latestMetric?.batteryVoltage, 'V')}
                </span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

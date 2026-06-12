import { CalendarDays } from 'lucide-react';
import {
  DATE_RANGE_PRESETS,
  createCustomDateRange,
  createPresetDateRange,
  formatKampalaRange,
  toDateInputValue,
} from '../lib/dateRanges';
import type { DateRangeSelection } from '../lib/dateRanges';

interface DateRangeSelectorProps {
  value: DateRangeSelection;
  onChange: (value: DateRangeSelection) => void;
  loading?: boolean;
}

export default function DateRangeSelector({ value, onChange, loading = false }: DateRangeSelectorProps) {
  const customStart = value.customStartDate ?? toDateInputValue(value.startDate);
  const customEnd = value.customEndDate ?? toDateInputValue(value.endDate);
  const updateCustomRange = (startDate: string, endDate: string) => {
    if (startDate && endDate) {
      onChange(createCustomDateRange(startDate, endDate));
    }
  };

  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.08em] text-slate-500">
            <CalendarDays size={16} aria-hidden="true" />
            Date range
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-900">{value.label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatKampalaRange(value)} · Africa/Kampala</p>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-2">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={value.preset === preset.id}
              className={`rounded-md border px-3 py-2 text-xs font-extrabold transition ${
                value.preset === preset.id
                  ? 'border-lagoon bg-lagoon text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => onChange(createPresetDateRange(preset.id))}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={value.preset === 'custom'}
            className={`rounded-md border px-3 py-2 text-xs font-extrabold transition ${
              value.preset === 'custom'
                ? 'border-lagoon bg-lagoon text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => onChange(createCustomDateRange(customStart, customEnd))}
          >
            Custom
          </button>
        </div>
      </div>

      {value.preset === 'custom' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Start date
            <input
              type="date"
              value={customStart}
              max={customEnd}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
              onChange={(event) => updateCustomRange(event.target.value, customEnd)}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            End date
            <input
              type="date"
              value={customEnd}
              min={customStart}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none transition focus:border-lagoon focus:ring-2 focus:ring-lagoon/20"
              onChange={(event) => updateCustomRange(customStart, event.target.value)}
            />
          </label>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-xs font-bold text-slate-500">Updating range metrics...</p> : null}
    </section>
  );
}

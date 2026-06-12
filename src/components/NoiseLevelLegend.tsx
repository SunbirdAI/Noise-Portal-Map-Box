import { useState } from 'react';
import clsx from 'clsx';
import {
  NOISE_CATEGORY_DESCRIPTIONS,
  NOISE_LEVEL_RANGES,
  NOISE_NO_DATA_COLOR,
  NOISE_NO_DATA_LABEL,
  type NoiseCategory,
} from '../lib/noiseScale';

const CATEGORY_ORDER: Exclude<NoiseCategory, 'No data'>[] = ['Quiet', 'Moderate', 'Noisy'];

export default function NoiseLevelLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:left-3 sm:w-80">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-sm font-extrabold text-slate-900 shadow-soft backdrop-blur transition hover:bg-white sm:hidden"
        aria-expanded={isOpen}
        aria-controls="noise-level-legend"
      >
        <span
          className="size-3 rounded-full ring-1 ring-white"
          style={{ backgroundColor: NOISE_LEVEL_RANGES[7].color }}
          aria-hidden="true"
        />
        Noise Level Key
      </button>

      <section
        id="noise-level-legend"
        aria-label="Noise Level Key for marker colors in decibels"
        className={clsx(
          'pointer-events-auto mt-2 max-h-[48vh] overflow-auto rounded-lg border border-slate-200 bg-white/95 p-3 text-slate-900 shadow-soft backdrop-blur sm:block',
          isOpen ? 'block' : 'hidden',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-950">Noise Level Key</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">decibels (dB)</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:hidden"
          >
            Close
          </button>
        </div>

        <div
          className="mt-3 h-2 rounded-full ring-1 ring-inset ring-slate-200"
          style={{
            background: `linear-gradient(90deg, ${NOISE_LEVEL_RANGES.map((range) => range.color).join(', ')})`,
          }}
          aria-hidden="true"
        />

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="rounded-md bg-slate-50 px-2 py-1.5 ring-1 ring-slate-200">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-700">{category}</p>
              <p className="mt-0.5 text-[10px] font-semibold leading-3 text-slate-500">{NOISE_CATEGORY_DESCRIPTIONS[category]}</p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <h3 className="sr-only">Noise level ranges</h3>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
            {NOISE_LEVEL_RANGES.map((range) => (
              <li key={range.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <span
                  className="size-3 shrink-0 rounded-sm ring-1 ring-slate-200"
                  style={{ backgroundColor: range.color }}
                  aria-hidden="true"
                />
                <span>
                  <span className="sr-only">{range.category}: </span>
                  {range.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-2 text-xs font-semibold text-slate-600">
          <span
            className="size-3 shrink-0 rounded-sm ring-1 ring-slate-200"
            style={{ backgroundColor: NOISE_NO_DATA_COLOR }}
            aria-hidden="true"
          />
          <span>{NOISE_NO_DATA_LABEL}</span>
        </div>
      </section>
    </div>
  );
}

import type { ExpressionSpecification } from 'mapbox-gl';

export type NoiseCategory = 'Quiet' | 'Moderate' | 'Noisy' | 'No data';

export interface NoiseLevelRange {
  id: string;
  label: string;
  min: number;
  maxExclusive?: number;
  category: Exclude<NoiseCategory, 'No data'>;
  color: string;
}

export const NOISE_NO_DATA_COLOR = '#94a3b8';
export const NOISE_NO_DATA_LABEL = 'No data';

const NOISE_NO_DATA_SENTINEL = -999;

export const NOISE_LEVEL_RANGES: NoiseLevelRange[] = [
  { id: 'lt-35', label: '< 35 dB', min: 0, maxExclusive: 35, category: 'Quiet', color: '#166534' },
  { id: '35-39', label: '35-39 dB', min: 35, maxExclusive: 40, category: 'Quiet', color: '#15803d' },
  { id: '40-44', label: '40-44 dB', min: 40, maxExclusive: 45, category: 'Quiet', color: '#0f766e' },
  { id: '45-49', label: '45-49 dB', min: 45, maxExclusive: 50, category: 'Quiet', color: '#087f8c' },
  { id: '50-54', label: '50-54 dB', min: 50, maxExclusive: 55, category: 'Quiet', color: '#0e7490' },
  { id: '55-59', label: '55-59 dB', min: 55, maxExclusive: 60, category: 'Moderate', color: '#b45309' },
  { id: '60-64', label: '60-64 dB', min: 60, maxExclusive: 65, category: 'Moderate', color: '#c2410c' },
  { id: '65-69', label: '65-69 dB', min: 65, maxExclusive: 70, category: 'Moderate', color: '#ea580c' },
  { id: '70-74', label: '70-74 dB', min: 70, maxExclusive: 75, category: 'Noisy', color: '#dc2626' },
  { id: '75-79', label: '75-79 dB', min: 75, maxExclusive: 80, category: 'Noisy', color: '#b91c1c' },
  { id: 'gte-80', label: '>= 80 dB', min: 80, category: 'Noisy', color: '#7f1d1d' },
];

export const NOISE_CATEGORY_DESCRIPTIONS: Record<Exclude<NoiseCategory, 'No data'>, string> = {
  Quiet: 'Below 55 dB',
  Moderate: '55-69 dB',
  Noisy: '70 dB and above',
};

export function getNoiseRange(dbLevel?: number | null): NoiseLevelRange | undefined {
  if (dbLevel === null || dbLevel === undefined || !Number.isFinite(dbLevel) || dbLevel < 0) {
    return undefined;
  }

  return NOISE_LEVEL_RANGES.find(
    (range) => dbLevel >= range.min && (range.maxExclusive === undefined || dbLevel < range.maxExclusive),
  );
}

export function getNoiseColor(dbLevel?: number | null): string {
  return getNoiseRange(dbLevel)?.color ?? NOISE_NO_DATA_COLOR;
}

export function getNoiseCategory(dbLevel?: number | null): NoiseCategory {
  return getNoiseRange(dbLevel)?.category ?? 'No data';
}

export function getNoiseColorExpression(
  valueExpression: ExpressionSpecification = ['get', 'latestDb'] as ExpressionSpecification,
): ExpressionSpecification {
  const stops = NOISE_LEVEL_RANGES.flatMap((range) => [range.min, range.color]);

  return [
    'step',
    ['to-number', valueExpression, NOISE_NO_DATA_SENTINEL],
    NOISE_NO_DATA_COLOR,
    ...stops,
  ] as ExpressionSpecification;
}

export function getNoiseClusterMaxExpression(): ExpressionSpecification {
  return ['max', ['to-number', ['get', 'latestDb'], NOISE_NO_DATA_SENTINEL]] as ExpressionSpecification;
}

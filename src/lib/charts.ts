import type { ChartPoint, HeatmapCell, HourlyTrendPoint, NoiseMetric } from '../models/sensor';
import { KAMPALA_TIME_ZONE } from './dateRanges';

function parseDate(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function timestampValue(value?: string): number | undefined {
  return parseDate(value)?.getTime();
}

function dateKey(value?: string): string {
  if (!value) {
    return 'Unknown';
  }

  const date = parseDate(value);
  if (!date) {
    return value;
  }

  return formatKampalaDateKey(date);
}

export function formatTrendTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: KAMPALA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

export function formatTrendDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: KAMPALA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function timeLabel(value?: string): string {
  const timestamp = timestampValue(value);
  return timestamp === undefined ? value ?? 'No timestamp' : formatTrendTime(timestamp);
}

export function normalizeHourlyTrendData(metrics: NoiseMetric[]): HourlyTrendPoint[] {
  return metrics
    .map((metric, index) => {
      const timestamp = timestampValue(metric.uploadedAt);

      if (timestamp === undefined) {
        return undefined;
      }

      const average = nullableNumber(metric.avgDbLevel);
      const maxValue = nullableNumber(metric.maxDbLevel);
      const reading = nullableNumber(metric.dbLevel);

      if (average === null && maxValue === null && reading === null) {
        return undefined;
      }

      return {
        key: metric.uploadedAt ?? metric.id ?? String(index),
        timestamp,
        label: formatTrendTime(timestamp),
        average,
        max: maxValue,
        reading,
      };
    })
    .filter((point): point is HourlyTrendPoint => point !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function countUniqueTrendTimestamps(points: HourlyTrendPoint[]): number {
  return new Set(points.map((point) => point.timestamp)).size;
}

export function metricsToChartPoints(metrics: NoiseMetric[]): ChartPoint[] {
  return [...metrics]
    .filter((metric) => metric.uploadedAt || metric.dbLevel !== undefined || metric.avgDbLevel !== undefined)
    .sort((a, b) => {
      const left = timestampValue(a.uploadedAt) ?? 0;
      const right = timestampValue(b.uploadedAt) ?? 0;
      return left - right;
    })
    .map((metric, index) => ({
      key: metric.uploadedAt ?? metric.id ?? String(index),
      label: timeLabel(metric.uploadedAt),
      timestamp: metric.uploadedAt,
      db: metric.dbLevel,
      avg: metric.avgDbLevel,
      max: metric.maxDbLevel,
      median: metric.medianDbLevel,
      exceedances: metric.exceedances,
    }));
}

export function aggregateDailyPoints(metrics: NoiseMetric[]): ChartPoint[] {
  const grouped = new Map<string, NoiseMetric[]>();

  for (const metric of metrics) {
    const key = dateKey(metric.uploadedAt);
    grouped.set(key, [...(grouped.get(key) ?? []), metric]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => {
      const avgValues = values.map((metric) => metric.avgDbLevel ?? metric.dbLevel).filter(isNumber);
      const maxValues = values.map((metric) => metric.maxDbLevel ?? metric.dbLevel).filter(isNumber);
      const medianValues = values.map((metric) => metric.medianDbLevel ?? metric.avgDbLevel).filter(isNumber);

      return {
        key,
        label: key,
        avg: average(avgValues),
        max: max(maxValues),
        median: median(medianValues),
        exceedances: values.reduce((total, metric) => total + (metric.exceedances ?? 0), 0),
      };
    });
}

export function buildHeatmap(metrics: NoiseMetric[]): HeatmapCell[] {
  const grouped = new Map<string, number[]>();

  for (const metric of metrics) {
    if (!metric.uploadedAt) {
      continue;
    }

    const date = parseDate(metric.uploadedAt);
    const value = metric.avgDbLevel ?? metric.dbLevel;

    if (!date || value === undefined) {
      continue;
    }

    const key = `${dateKey(metric.uploadedAt)}-${kampalaHour(date)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }

  return [...grouped.entries()].map(([key, values]) => {
    const [day, hourValue] = key.split(/-(?=\d+$)/);
    return {
      day,
      hour: Number(hourValue),
      avg: average(values),
      count: values.length,
    };
  });
}

function isNumber(value: number | undefined | null): value is number {
  return value !== undefined && value !== null && Number.isFinite(value);
}

function formatKampalaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KAMPALA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';

  return `${value('year')}-${value('month')}-${value('day')}`;
}

function kampalaHour(date: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: KAMPALA_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);

  return Number(hour);
}

function nullableNumber(value: number | undefined | null): number | null {
  return isNumber(value) ? value : null;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values);
}

function median(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

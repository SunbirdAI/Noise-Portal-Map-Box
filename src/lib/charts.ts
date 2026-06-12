import type { ChartPoint, HeatmapCell, NoiseMetric } from '../models/sensor';

function dateKey(value?: string): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().slice(0, 10);
}

function timeLabel(value?: string): string {
  if (!value) {
    return 'No timestamp';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function metricsToChartPoints(metrics: NoiseMetric[]): ChartPoint[] {
  return [...metrics]
    .filter((metric) => metric.uploadedAt || metric.dbLevel !== undefined || metric.avgDbLevel !== undefined)
    .sort((a, b) => {
      const left = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const right = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
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

    const date = new Date(metric.uploadedAt);
    const value = metric.avgDbLevel ?? metric.dbLevel;

    if (Number.isNaN(date.getTime()) || value === undefined) {
      continue;
    }

    const key = `${dateKey(metric.uploadedAt)}-${date.getHours()}`;
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

function isNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
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

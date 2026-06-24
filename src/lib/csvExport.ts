import { KAMPALA_TIME_ZONE } from './dateRanges';
import type { NoiseMetric, SensorLocation, SensorSummary, SensorType } from '../models/sensor';

type CsvCell = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvCell>;

const CSV_COLUMNS = [
  'Location ID',
  'Location Name',
  'Device ID',
  'Sensor Type',
  'Timestamp (Africa/Kampala)',
  'dB Value',
  'Average dB',
  'Max dB',
  'Median dB',
  'Day Limit dB',
  'Night Limit dB',
  'Active Limit dB',
  'Exceedance Status',
  'Exceedance Count',
  'Battery Voltage V',
  'City',
  'Division',
  'Parish',
  'Latitude',
  'Longitude',
  'Data Source',
] as const;

interface NoiseCsvRowInput {
  location?: SensorLocation;
  deviceName?: string;
  sensorType?: SensorType;
  metric?: NoiseMetric;
  batteryVoltage?: number | null;
  dataSource: string;
}

export function buildDashboardCsvRows(sensors: SensorSummary[]): CsvRow[] {
  return sensors
    .map((sensor) =>
      buildNoiseCsvRow({
        location: sensor,
        deviceName: sensor.deviceName,
        sensorType: sensor.sensorType,
        metric: sensor.latestMetric,
        batteryVoltage: sensor.latestMetric?.batteryVoltage ?? sensor.liveData?.battery,
        dataSource: 'Dashboard current view',
      }),
    )
    .filter(hasExportableNoiseData);
}

export function buildLocationCsvRows(input: {
  location?: SensorLocation;
  deviceName: string;
  sensorType: SensorType;
  metrics: NoiseMetric[];
  dataSource: string;
}): CsvRow[] {
  return input.metrics
    .map((metric) =>
      buildNoiseCsvRow({
        location: input.location,
        deviceName: input.deviceName || metric.deviceName,
        sensorType: input.sensorType,
        metric,
        batteryVoltage: metric.batteryVoltage,
        dataSource: input.dataSource,
      }),
    )
    .filter(hasExportableNoiseData);
}

export function serializeCsv(rows: CsvRow[], columns: readonly string[] = CSV_COLUMNS): string {
  const lines = [
    columns.map(escapeCsvCell).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(',')),
  ];

  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, rows: CsvRow[]) {
  const csv = serializeCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function dashboardCsvFilename(cityFilter: string, date = new Date()): string {
  const scope = cityFilter === 'All' ? 'all-visible-locations' : cityFilter;
  return `noise-data-${slugifyFilenamePart(scope)}-${formatKampalaDateForFilename(date)}.csv`;
}

export function locationCsvFilename(locationName: string | undefined, deviceName: string, date = new Date()): string {
  const scope = locationName || deviceName || 'location';
  return `noise-data-${slugifyFilenamePart(scope)}-${formatKampalaDateForFilename(date)}.csv`;
}

export function formatCsvTimestamp(value?: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = getKampalaParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function slugifyFilenamePart(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'export';
}

function buildNoiseCsvRow(input: NoiseCsvRowInput): CsvRow {
  const metric = input.metric;
  const location = input.location;
  const dbValue = metric?.dbLevel ?? metric?.avgDbLevel;
  const activeLimit = getActiveLimit(location, metric?.uploadedAt);

  return {
    'Location ID': location?.id,
    'Location Name': location?.village ?? location?.parish ?? input.deviceName,
    'Device ID': input.deviceName ?? location?.deviceName ?? metric?.deviceName,
    'Sensor Type': input.sensorType,
    'Timestamp (Africa/Kampala)': formatCsvTimestamp(metric?.uploadedAt),
    'dB Value': formatNumericCell(dbValue, 1),
    'Average dB': formatNumericCell(metric?.avgDbLevel, 1),
    'Max dB': formatNumericCell(metric?.maxDbLevel, 1),
    'Median dB': formatNumericCell(metric?.medianDbLevel, 1),
    'Day Limit dB': formatNumericCell(location?.dayLimit, 1),
    'Night Limit dB': formatNumericCell(location?.nightLimit, 1),
    'Active Limit dB': formatNumericCell(activeLimit, 1),
    'Exceedance Status': getExceedanceStatus(metric, dbValue, activeLimit),
    'Exceedance Count': metric?.exceedances,
    'Battery Voltage V': formatNumericCell(input.batteryVoltage ?? metric?.batteryVoltage, 2),
    City: location?.city,
    Division: location?.division,
    Parish: location?.parish,
    Latitude: formatNumericCell(location?.latitude, 6),
    Longitude: formatNumericCell(location?.longitude, 6),
    'Data Source': input.dataSource,
  };
}

function hasExportableNoiseData(row: CsvRow): boolean {
  return Boolean(row['Timestamp (Africa/Kampala)'] || row['dB Value'] || row['Average dB'] || row['Max dB']);
}

function getExceedanceStatus(metric: NoiseMetric | undefined, dbValue: number | undefined, activeLimit: number | undefined): string {
  if (metric?.exceedances !== undefined) {
    return metric.exceedances > 0 ? 'Yes' : 'No';
  }

  if (dbValue !== undefined && activeLimit !== undefined) {
    return dbValue > activeLimit ? 'Yes' : 'No';
  }

  return '';
}

function getActiveLimit(location: SensorLocation | undefined, timestamp?: string): number | undefined {
  if (!location) {
    return undefined;
  }

  const hour = getKampalaHour(timestamp);

  if (hour === undefined) {
    return location.dayLimit ?? location.nightLimit;
  }

  return hour >= 6 && hour < 22 ? location.dayLimit : location.nightLimit;
}

function getKampalaHour(timestamp?: string): number | undefined {
  if (!timestamp) {
    return undefined;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return Number(getKampalaParts(date).hour);
}

function formatNumericCell(value: number | null | undefined, maximumFractionDigits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    useGrouping: false,
  });
}

function formatKampalaDateForFilename(date: Date): string {
  const parts = getKampalaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getKampalaParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KAMPALA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

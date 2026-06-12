export const KAMPALA_TIME_ZONE = 'Africa/Kampala';

export type DateRangePreset = '24h' | '4d' | '7d' | '30d' | '3m' | 'custom';

export interface DateRangeSelection {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  label: string;
  customStartDate?: string;
  customEndDate?: string;
}

export const DATE_RANGE_PRESETS: Array<{ id: Exclude<DateRangePreset, 'custom'>; label: string; days?: number; hours?: number }> = [
  { id: '24h', label: '24 hours', hours: 24 },
  { id: '4d', label: '4 days', days: 4 },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '3m', label: '3 months', days: 90 },
];

const KAMPALA_OFFSET = '+03:00';

export function createPresetDateRange(preset: Exclude<DateRangePreset, 'custom'>, now = new Date()): DateRangeSelection {
  const definition = DATE_RANGE_PRESETS.find((candidate) => candidate.id === preset) ?? DATE_RANGE_PRESETS[0];
  const durationMs = definition.hours ? definition.hours * 60 * 60 * 1000 : (definition.days ?? 1) * 24 * 60 * 60 * 1000;
  const start = new Date(now.getTime() - durationMs);

  return {
    preset,
    startDate: toKampalaIso(start),
    endDate: toKampalaIso(now),
    label: definition.label,
  };
}

export function createCustomDateRange(startDateInput: string, endDateInput: string): DateRangeSelection {
  const start = startOfKampalaDate(startDateInput);
  const end = endOfKampalaDate(endDateInput);

  return {
    preset: 'custom',
    startDate: start,
    endDate: end,
    customStartDate: startDateInput,
    customEndDate: endDateInput,
    label: `${formatKampalaDate(start)} - ${formatKampalaDate(end)}`,
  };
}

export function toDateInputValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = getKampalaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatKampalaRange(selection: DateRangeSelection): string {
  return `${formatKampalaDateTime(selection.startDate)} - ${formatKampalaDateTime(selection.endDate)}`;
}

export function formatKampalaDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No date';
  }

  return new Intl.DateTimeFormat(undefined, {
    timeZone: KAMPALA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function toKampalaIso(date: Date): string {
  const parts = getKampalaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${KAMPALA_OFFSET}`;
}

function startOfKampalaDate(dateInput: string): string {
  return `${dateInput}T00:00:00${KAMPALA_OFFSET}`;
}

function endOfKampalaDate(dateInput: string): string {
  return `${dateInput}T23:59:59${KAMPALA_OFFSET}`;
}

function formatKampalaDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    timeZone: KAMPALA_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
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

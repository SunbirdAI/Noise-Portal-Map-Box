export function formatDb(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'No data';
  }

  return `${value.toFixed(1)} dB`;
}

export function formatNumber(value?: number, unit = ''): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'No data';
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;
}

export function formatInteger(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'No data';
  }

  return Math.round(value).toLocaleString();
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return 'No data';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No data';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelative(value?: string): string {
  if (!value) {
    return 'No data';
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) {
    return 'No data';
  }

  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 48) {
    return `${hours} hr ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} days ago`;
}

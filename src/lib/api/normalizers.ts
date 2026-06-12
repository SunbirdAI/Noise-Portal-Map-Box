import { extractCoordinates, toNumber } from '../coordinates';
import { detectSensorType } from '../sensors';
import type {
  AiInference,
  DeviceInfo,
  EnvironmentalReading,
  LocationMetrics,
  NoiseMetric,
  SensorLocation,
} from '../../models/sensor';

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringField(raw: RawRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function numberField(raw: RawRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(raw[key]);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function booleanField(raw: RawRecord, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return value === 1;
    }
  }

  return undefined;
}

export function normalizeLocation(rawValue: unknown): SensorLocation | undefined {
  const raw = asRecord(rawValue);
  const coordinates = extractCoordinates(raw);
  const id = stringField(raw, ['id', 'location_id', 'uuid']);
  const deviceName = stringField(raw, ['device_name', 'device', 'device_id', 'deviceName']);

  if (!coordinates || !id || !deviceName) {
    return undefined;
  }

  return {
    id,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    coordinateSource: coordinates.source,
    city: stringField(raw, ['city', 'municipality']) ?? 'Unknown city',
    division: stringField(raw, ['division', 'county']),
    parish: stringField(raw, ['parish', 'subcounty']),
    village: stringField(raw, ['village', 'street', 'name']),
    description: stringField(raw, ['location_description', 'description', 'category']),
    dayLimit: numberField(raw, ['day_limit', 'dayLimit']),
    nightLimit: numberField(raw, ['night_limit', 'nightLimit']),
    deviceName,
  };
}

export function normalizeLocationsResponse(payload: unknown): SensorLocation[] {
  const raw = asRecord(payload);
  const items = 'results' in raw ? asArray(raw.results) : asArray(payload);
  return items.map(normalizeLocation).filter((location): location is SensorLocation => Boolean(location));
}

export function normalizeMetric(rawValue: unknown): NoiseMetric {
  const raw = asRecord(rawValue);

  return {
    id: stringField(raw, ['id']),
    deviceName: stringField(raw, ['device', 'device_name', 'deviceId']),
    dbLevel: numberField(raw, ['db_level', 'dbLevel', 'db', 'leq', 'value']),
    avgDbLevel: numberField(raw, ['avg_db_level', 'average_db_level', 'avg', 'average', 'hourly_average']),
    maxDbLevel: numberField(raw, ['max_db_level', 'maximum_db_level', 'max', 'hourly_max']),
    medianDbLevel: numberField(raw, ['median_db_level', 'median', 'hourly_median']),
    exceedances: numberField(raw, ['no_of_exceedances', 'exceedances', 'exceedance_count']),
    signalStrength: numberField(raw, ['sig_strength', 'signal_strength', 'rssi']),
    panelVoltage: numberField(raw, ['panel_voltage']),
    batteryVoltage: numberField(raw, ['battery_voltage', 'battery', 'battery_level']),
    dataBalance: numberField(raw, ['data_balance']),
    uploadedAt: stringField(raw, ['time_uploaded', 'uploaded_at', 'created_at', 'timestamp', 'date', 'hour']),
  };
}

export function normalizeLocationMetrics(payload: unknown): LocationMetrics {
  const raw = asRecord(payload);
  const id = stringField(raw, ['id', 'location_id']) ?? '';
  const deviceName = stringField(raw, ['device_name', 'device']);

  return {
    id,
    deviceName,
    hourly: asArray(raw.location_hourly_metrics ?? raw.hourly ?? raw.results).map(normalizeMetric),
    daily: asArray(raw.location_daily_metrics ?? raw.daily).map(normalizeMetric),
  };
}

export function normalizeDeviceInfo(payload: unknown): DeviceInfo {
  const raw = asRecord(payload);
  const deviceId = stringField(raw, ['device_id', 'device', 'device_name']) ?? 'Unknown device';
  const rawDeviceType = stringField(raw, ['device_type', 'type']);
  const metricsUrl = stringField(raw, ['metrics_url']);
  const uploadAddress = stringField(raw, ['uploadAddr', 'upload_address']);
  const uptime = asRecord(raw.uptime);

  return {
    id: stringField(raw, ['id']),
    deviceId,
    displayName: stringField(raw, ['device_name', 'name', 'display_name']),
    sensorType: detectSensorType({
      deviceName: deviceId,
      deviceType: rawDeviceType,
      uploadAddress,
      metricsUrl,
    }),
    lastSeen: stringField(raw, ['lastseen', 'last_seen', 'lastSeen']),
    phoneNumber: stringField(raw, ['phone_number']),
    imei: stringField(raw, ['imei']),
    versionNumber: stringField(raw, ['version_number']),
    productionStage: stringField(raw, ['production_stage']),
    configured: booleanField(raw, ['configured']),
    mode: numberField(raw, ['mode']),
    dbThreshold: numberField(raw, ['dbLevel', 'db_threshold']),
    recLength: numberField(raw, ['recLength', 'rec_length']),
    recInterval: numberField(raw, ['recInterval', 'rec_interval']),
    metricsUrl,
    uploadAddress,
    metrics: asArray(raw.get_metrics ?? raw.metrics).map(normalizeMetric),
    uptime: {
      uptime: numberField(uptime, ['uptime']),
      previousDowntime: stringField(uptime, ['previous_downtime']) ?? null,
      uploadGaps: asArray(uptime.upload_gaps),
      uploadGapsLength: numberField(uptime, ['upload_gaps_len']),
    },
  };
}

export function normalizeAiInference(payload: unknown): AiInference | undefined {
  const raw = asRecord(payload);

  if (Object.keys(raw).length === 0) {
    return undefined;
  }

  return {
    id: stringField(raw, ['id']) ?? numberField(raw, ['id']),
    deviceName: stringField(raw, ['device', 'device_name']),
    probability: numberField(raw, ['inference_probability', 'probability']),
    className: stringField(raw, ['inference_class', 'class_name']),
    audioName: stringField(raw, ['inferred_audio_name', 'audio_name']),
    createdAt: stringField(raw, ['created_at', 'timestamp']),
  };
}

export function normalizeEnvironmentalReading(payload: unknown): EnvironmentalReading | undefined {
  const raw = asRecord(payload);

  if (Object.keys(raw).length === 0) {
    return undefined;
  }

  return {
    id: stringField(raw, ['id']) ?? numberField(raw, ['id']),
    deviceName: stringField(raw, ['device', 'device_name']),
    temperature: numberField(raw, ['temperature']),
    pressure: numberField(raw, ['pressure']),
    humidity: numberField(raw, ['humidity']),
    airQuality: numberField(raw, ['air_quality', 'airQuality']),
    ramValue: numberField(raw, ['ram_value', 'ramValue']),
    systemTemperature: numberField(raw, ['system_temperature', 'systemTemperature']),
    powerUsage: numberField(raw, ['power_usage', 'powerUsage']),
    dbLevel: numberField(raw, ['db_level', 'dbLevel']),
    createdAt: stringField(raw, ['created_at', 'timestamp']),
  };
}

export function extractNextPage(payload: unknown): string | undefined {
  const raw = asRecord(payload);
  const next = raw.next;
  return typeof next === 'string' && next.trim() !== '' ? next : undefined;
}

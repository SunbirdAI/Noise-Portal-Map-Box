export type SensorType = 'MCU' | 'MOBILE' | 'AI' | 'Unknown';

export type CoordinateSource = 'fixed' | 'mobile';

export interface SensorLocation {
  id: string;
  latitude: number;
  longitude: number;
  coordinateSource: CoordinateSource;
  city: string;
  division?: string;
  parish?: string;
  village?: string;
  description?: string;
  dayLimit?: number;
  nightLimit?: number;
  deviceName: string;
}

export interface NoiseMetric {
  id?: string;
  deviceName?: string;
  dbLevel?: number;
  avgDbLevel?: number;
  maxDbLevel?: number;
  medianDbLevel?: number;
  exceedances?: number;
  signalStrength?: number;
  panelVoltage?: number;
  batteryVoltage?: number;
  dataBalance?: number;
  uploadedAt?: string;
}

export interface LocationMetrics {
  id: string;
  deviceName?: string;
  hourly: NoiseMetric[];
  daily: NoiseMetric[];
}

export interface ApiDateRange {
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

export interface ApiDeviceSummary {
  id?: string;
  deviceId?: string;
  type?: string;
}

export interface PaginatedData<T> {
  count: number;
  next?: string;
  previous?: string;
  range?: ApiDateRange;
  device?: ApiDeviceSummary;
  results: T[];
  truncated?: boolean;
}

export interface DeviceInfo {
  id?: string;
  deviceId: string;
  displayName?: string;
  sensorType: SensorType;
  lastSeen?: string;
  phoneNumber?: string;
  imei?: string;
  versionNumber?: string;
  productionStage?: string;
  configured?: boolean;
  mode?: number;
  dbThreshold?: number;
  recLength?: number;
  recInterval?: number;
  metricsUrl?: string;
  uploadAddress?: string;
  metrics: NoiseMetric[];
  uptime?: {
    uptime?: number;
    previousDowntime?: string | null;
    uploadGaps?: unknown[];
    uploadGapsLength?: number;
  };
}

export interface AiInference {
  id?: string | number;
  deviceName?: string;
  probability?: number;
  className?: string;
  audioName?: string;
  createdAt?: string;
}

export interface EnvironmentalReading {
  id?: string | number;
  deviceName?: string;
  temperature?: number;
  pressure?: number;
  humidity?: number;
  airQuality?: number;
  ramValue?: number;
  systemTemperature?: number;
  powerUsage?: number;
  dbLevel?: number;
  createdAt?: string;
}

export interface SensorLiveData {
  type: SensorType;
  deviceName: string;
  latestNoise: number | null;
  lastUpdated: string | null;
  battery: number | null;
  device?: DeviceInfo;
  metric?: NoiseMetric;
  metrics?: NoiseMetric[];
  environment?: EnvironmentalReading;
  inference?: AiInference;
}

export interface SensorSummary extends SensorLocation {
  sensorType: SensorType;
  latestMetric?: NoiseMetric;
  device?: DeviceInfo;
  environment?: EnvironmentalReading;
  inference?: AiInference;
  liveData?: SensorLiveData;
  metricStatus: 'loading' | 'ready' | 'error' | 'empty';
}

export interface ChartPoint {
  key: string;
  label: string;
  timestamp?: string;
  avg?: number;
  max?: number;
  median?: number;
  db?: number;
  exceedances?: number;
}

export interface HourlyTrendPoint {
  key: string;
  timestamp: number;
  label: string;
  average: number | null;
  max: number | null;
  reading: number | null;
}

export interface HeatmapCell {
  day: string;
  hour: number;
  avg?: number;
  count: number;
}

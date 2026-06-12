import type { SensorSummary } from '../models/sensor';

export const OVERLAP_DISTANCE_METERS = 10;

export interface OverlapGroup {
  id: string;
  center: [number, number];
  sensors: SensorSummary[];
}

export interface SensorGroupMeta {
  groupId: string;
  size: number;
  index: number;
}

export interface OverlapIndex {
  groups: OverlapGroup[];
  sensorMeta: Map<string, SensorGroupMeta>;
}

export function buildOverlapIndex(
  sensors: SensorSummary[],
  thresholdMeters = OVERLAP_DISTANCE_METERS,
): OverlapIndex {
  const parent = sensors.map((_, index) => index);

  function find(index: number): number {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }

    return index;
  }

  function union(left: number, right: number) {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  }

  for (let left = 0; left < sensors.length; left += 1) {
    for (let right = left + 1; right < sensors.length; right += 1) {
      if (distanceMeters(sensors[left], sensors[right]) <= thresholdMeters) {
        union(left, right);
      }
    }
  }

  const grouped = new Map<number, SensorSummary[]>();

  sensors.forEach((sensor, index) => {
    const root = find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), sensor]);
  });

  const groups = [...grouped.values()]
    .filter((groupSensors) => groupSensors.length > 1)
    .map((groupSensors) => {
      const sortedSensors = [...groupSensors].sort((a, b) => a.id.localeCompare(b.id));
      return {
        id: sortedSensors.map((sensor) => sensor.id).join('__'),
        center: getCentroid(sortedSensors),
        sensors: sortedSensors,
      };
    });

  const sensorMeta = new Map<string, SensorGroupMeta>();

  for (const group of groups) {
    group.sensors.forEach((sensor, index) => {
      sensorMeta.set(sensor.id, {
        groupId: group.id,
        size: group.sensors.length,
        index,
      });
    });
  }

  return { groups, sensorMeta };
}

export function distanceMeters(
  left: Pick<SensorSummary, 'latitude' | 'longitude'>,
  right: Pick<SensorSummary, 'latitude' | 'longitude'>,
): number {
  const earthRadiusMeters = 6_371_000;
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLng = toRadians(right.longitude - left.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function getCentroid(sensors: SensorSummary[]): [number, number] {
  const totals = sensors.reduce(
    (sum, sensor) => ({
      latitude: sum.latitude + sensor.latitude,
      longitude: sum.longitude + sensor.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return [totals.longitude / sensors.length, totals.latitude / sensors.length];
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

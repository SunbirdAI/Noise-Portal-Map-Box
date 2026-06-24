import { useCallback, useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useNavigate } from 'react-router-dom';
import { MAPBOX_ACCESS_TOKEN } from '../config/env';
import type { SensorSummary } from '../models/sensor';
import { formatDateTime, formatDb, formatNumber } from '../lib/format';
import { buildOverlapIndex, type OverlapGroup, type SensorGroupMeta } from '../lib/mapOverlap';
import { getNoiseCategory, getNoiseClusterMaxExpression, getNoiseColorExpression } from '../lib/noiseScale';
import NoiseLevelLegend from './NoiseLevelLegend';

const appBaseUrl = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
const detailLinkSelector = '[data-sensor-detail-link]';

interface SensorMapProps {
  sensors: SensorSummary[];
}

const KAMPALA_CENTER: [number, number] = [32.5825, 0.3476];
const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: [],
};

export default function SensorMap({ sensors }: SensorMapProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const overlapIndex = useMemo(() => buildOverlapIndex(sensors), [sensors]);
  const data = useMemo(() => buildFeatureCollection(sensors, overlapIndex.sensorMeta), [sensors, overlapIndex]);
  const overlapGroupData = useMemo(() => buildOverlapGroupCollection(overlapIndex.groups), [overlapIndex.groups]);
  const dataRef = useRef(data);
  const overlapGroupDataRef = useRef(overlapGroupData);
  const overlapGroupsRef = useRef(overlapIndex.groups);
  const sensorsRef = useRef(sensors);

  const handlePopupNavigation = useCallback(
    (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(detailLinkSelector) : null;
      const detailRoute = target?.dataset.sensorDetailRoute;

      if (!target || !containerRef.current?.contains(target) || !detailRoute) {
        return;
      }

      event.preventDefault();
      popupRef.current?.remove();
      navigate(detailRoute);
    },
    [navigate],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    container.addEventListener('click', handlePopupNavigation);

    return () => {
      container.removeEventListener('click', handlePopupNavigation);
    };
  }, [handlePopupNavigation]);

  useEffect(() => {
    dataRef.current = data;
    overlapGroupDataRef.current = overlapGroupData;
    overlapGroupsRef.current = overlapIndex.groups;
    sensorsRef.current = sensors;

    const map = mapRef.current;
    const sensorSource = map?.getSource('sensors') as mapboxgl.GeoJSONSource | undefined;
    const groupSource = map?.getSource('overlap-groups') as mapboxgl.GeoJSONSource | undefined;

    if (sensorSource) {
      sensorSource.setData(data);
      groupSource?.setData(overlapGroupData);
      clearSpiderExpansion(map!);
      fitSensorBounds(map!, sensors);
    }
  }, [data, overlapGroupData, overlapIndex.groups, sensors]);

  useEffect(() => {
    if (!MAPBOX_ACCESS_TOKEN || !containerRef.current) {
      return;
    }

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: KAMPALA_CENTER,
      zoom: 11.2,
      minZoom: 7,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      map.addSource('sensors', {
        type: 'geojson',
        data: dataRef.current,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
        clusterProperties: {
          maxDb: getNoiseClusterMaxExpression(),
        },
      });

      map.addSource('overlap-groups', {
        type: 'geojson',
        data: overlapGroupDataRef.current,
      });

      map.addSource('spider-points', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addSource('spider-lines', {
        type: 'geojson',
        data: EMPTY_FEATURE_COLLECTION,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'sensors',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': getNoiseColorExpression(['get', 'maxDb']),
          'circle-radius': ['step', ['get', 'point_count'], 20, 5, 26, 10, 32],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'sensors',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: {
          'text-color': '#0f172a',
        },
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'sensors',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'overlapGroupSize'], 1]],
        paint: {
          'circle-color': getNoiseColorExpression(['get', 'latestDb']),
          'circle-radius': 18,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'unclustered-label',
        type: 'symbol',
        source: 'sensors',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'overlapGroupSize'], 1]],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'overlap-group-marker',
        type: 'circle',
        source: 'overlap-groups',
        minzoom: 15,
        paint: {
          'circle-color': getNoiseColorExpression(['get', 'latestDb']),
          'circle-radius': 23,
          'circle-stroke-width': 4,
          'circle-stroke-color': '#0f172a',
          'circle-opacity': 0.95,
        },
      });

      map.addLayer({
        id: 'overlap-group-count',
        type: 'symbol',
        source: 'overlap-groups',
        minzoom: 15,
        layout: {
          'text-field': ['to-string', ['get', 'count']],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'spider-lines',
        type: 'line',
        source: 'spider-lines',
        paint: {
          'line-color': '#475569',
          'line-width': 1.4,
          'line-opacity': 0.72,
        },
      });

      map.addLayer({
        id: 'spider-point',
        type: 'circle',
        source: 'spider-points',
        paint: {
          'circle-color': getNoiseColorExpression(['get', 'latestDb']),
          'circle-radius': 17,
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.98,
        },
      });

      map.addLayer({
        id: 'spider-label',
        type: 'symbol',
        source: 'spider-points',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      fitSensorBounds(map, sensorsRef.current);
    });

    const handleClusterClick = (event: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ['clusters'] });
      const clusterId = features[0]?.properties?.cluster_id;
      const source = map.getSource('sensors') as mapboxgl.GeoJSONSource | undefined;

      if (!source || clusterId === undefined || !features[0].geometry || features[0].geometry.type !== 'Point') {
        return;
      }

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || zoom === null || !features[0].geometry || features[0].geometry.type !== 'Point') {
          return;
        }

        map.easeTo({
          center: features[0].geometry.coordinates as [number, number],
          zoom,
          });
      });
    };

    map.on('click', 'clusters', handleClusterClick);
    map.on('click', 'cluster-count', handleClusterClick);

    const handleOverlapGroupClick = (event: mapboxgl.MapMouseEvent) => {
      const feature = event.features?.[0];
      const groupId = stringValue(feature?.properties?.id);
      const group = overlapGroupsRef.current.find((candidate) => candidate.id === groupId);

      if (!group) {
        return;
      }

      popupRef.current?.remove();
      showSpiderExpansion(map, group);
    };

    map.on('click', 'overlap-group-marker', handleOverlapGroupClick);
    map.on('click', 'overlap-group-count', handleOverlapGroupClick);

    map.on('click', 'unclustered-point', (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') {
        return;
      }

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(renderPopup(feature.properties ?? {}))
        .addTo(map);
    });

    map.on('click', 'spider-point', (event) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') {
        return;
      }

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(renderPopup(feature.properties ?? {}))
        .addTo(map);
    });

    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseenter', 'cluster-count', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseleave', 'cluster-count', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'overlap-group-marker', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseenter', 'overlap-group-count', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'overlap-group-marker', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseleave', 'overlap-group-count', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'spider-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'spider-point', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('zoomstart', () => clearSpiderExpansion(map));
    map.on('dragstart', () => clearSpiderExpansion(map));

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <div className="max-w-md">
          <h2 className="text-lg font-extrabold text-slate-950">Mapbox token required</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add `VITE_MAPBOX_ACCESS_TOKEN` to your environment to render the interactive clustered map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
      <div ref={containerRef} className="h-full min-h-[420px]" />
      <NoiseLevelLegend />
    </div>
  );
}

function buildFeatureCollection(sensors: SensorSummary[], sensorMeta: Map<string, SensorGroupMeta>) {
  return {
    type: 'FeatureCollection' as const,
    features: sensors.map((sensor) => {
      const latestDb = sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel;
      const overlapMeta = sensorMeta.get(sensor.id);

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [sensor.longitude, sensor.latitude],
        },
        properties: {
          id: sensor.id,
          name: sensor.village ?? sensor.parish ?? sensor.deviceName,
          deviceName: sensor.deviceName,
          sensorType: sensor.sensorType,
          latestDb: latestDb ?? null,
          label: latestDb === undefined ? 'N/A' : String(Math.round(latestDb)),
          noiseCategory: getNoiseCategory(latestDb),
          overlapGroupId: overlapMeta?.groupId ?? '',
          overlapGroupSize: overlapMeta?.size ?? 1,
          overlapGroupIndex: overlapMeta?.index ?? 0,
          lastUpdated: sensor.latestMetric?.uploadedAt ?? sensor.device?.lastSeen ?? '',
          battery: sensor.latestMetric?.batteryVoltage ?? null,
          temperature: sensor.environment?.temperature ?? null,
          pressure: sensor.environment?.pressure ?? null,
          humidity: sensor.environment?.humidity ?? null,
          airQuality: sensor.environment?.airQuality ?? null,
          powerUsage: sensor.environment?.powerUsage ?? null,
          inferenceClass: sensor.inference?.className ?? '',
          inferenceProbability: sensor.inference?.probability ?? null,
          dayLimit: sensor.dayLimit ?? null,
          nightLimit: sensor.nightLimit ?? null,
        },
      };
    }),
  };
}

function buildOverlapGroupCollection(groups: OverlapGroup[]) {
  return {
    type: 'FeatureCollection' as const,
    features: groups.map((group) => {
      const groupDb = Math.max(
        ...group.sensors
          .map((sensor) => sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel)
          .filter((value): value is number => value !== undefined),
      );
      const latestDb = Number.isFinite(groupDb) ? groupDb : undefined;

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: group.center,
        },
        properties: {
          id: group.id,
          count: group.sensors.length,
          latestDb: latestDb ?? null,
          noiseCategory: getNoiseCategory(latestDb),
        },
      };
    }),
  };
}

function showSpiderExpansion(map: mapboxgl.Map, group: OverlapGroup) {
  const centerPoint = map.project(group.center);
  const radius = getSpiderRadius(group.sensors.length);
  const pointFeatures = [];
  const lineFeatures = [];

  for (let index = 0; index < group.sensors.length; index += 1) {
    const sensor = group.sensors[index];
    const angle = getSpiderAngle(index, group.sensors.length);
    const displayPoint = {
      x: centerPoint.x + Math.cos(angle) * radius,
      y: centerPoint.y + Math.sin(angle) * radius,
    };
    const displayLngLat = map.unproject([displayPoint.x, displayPoint.y]);
    const coordinates: [number, number] = [displayLngLat.lng, displayLngLat.lat];

    pointFeatures.push(buildSpiderPointFeature(sensor, coordinates, group.id, group.sensors.length));
    lineFeatures.push({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [group.center, coordinates],
      },
      properties: {
        id: `${group.id}-${sensor.id}`,
      },
    });
  }

  setSourceData(map, 'spider-lines', {
    type: 'FeatureCollection',
    features: lineFeatures,
  });
  setSourceData(map, 'spider-points', {
    type: 'FeatureCollection',
    features: pointFeatures,
  });
}

function buildSpiderPointFeature(
  sensor: SensorSummary,
  coordinates: [number, number],
  groupId: string,
  groupCount: number,
) {
  const latestDb = sensor.latestMetric?.dbLevel ?? sensor.latestMetric?.avgDbLevel;

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates,
    },
    properties: {
      id: sensor.id,
      name: sensor.village ?? sensor.parish ?? sensor.deviceName,
      deviceName: sensor.deviceName,
      sensorType: sensor.sensorType,
      latestDb: latestDb ?? null,
      label: latestDb === undefined ? 'N/A' : String(Math.round(latestDb)),
      noiseCategory: getNoiseCategory(latestDb),
      overlapGroupId: groupId,
      overlapGroupSize: groupCount,
      lastUpdated: sensor.latestMetric?.uploadedAt ?? sensor.device?.lastSeen ?? '',
      battery: sensor.latestMetric?.batteryVoltage ?? null,
      temperature: sensor.environment?.temperature ?? null,
      pressure: sensor.environment?.pressure ?? null,
      humidity: sensor.environment?.humidity ?? null,
      airQuality: sensor.environment?.airQuality ?? null,
      powerUsage: sensor.environment?.powerUsage ?? null,
      inferenceClass: sensor.inference?.className ?? '',
      inferenceProbability: sensor.inference?.probability ?? null,
      dayLimit: sensor.dayLimit ?? null,
      nightLimit: sensor.nightLimit ?? null,
    },
  };
}

function clearSpiderExpansion(map: mapboxgl.Map) {
  setSourceData(map, 'spider-lines', EMPTY_FEATURE_COLLECTION);
  setSourceData(map, 'spider-points', EMPTY_FEATURE_COLLECTION);
}

function setSourceData(map: mapboxgl.Map, sourceId: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(data);
}

function getSpiderRadius(count: number): number {
  if (count <= 2) {
    return 48;
  }

  return Math.min(82, 42 + count * 7);
}

function getSpiderAngle(index: number, count: number): number {
  if (count === 2) {
    return index === 0 ? Math.PI : 0;
  }

  return -Math.PI / 2 + (2 * Math.PI * index) / count;
}

function fitSensorBounds(map: mapboxgl.Map, sensors: SensorSummary[]) {
  if (sensors.length === 0) {
    map.easeTo({ center: KAMPALA_CENTER, zoom: 11.2 });
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  sensors.forEach((sensor) => bounds.extend([sensor.longitude, sensor.latitude]));

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: { top: 64, bottom: 64, left: 64, right: 64 },
      maxZoom: 13.5,
      duration: 700,
    });
  }
}

function renderPopup(properties: Record<string, unknown>): string {
  const id = stringValue(properties.id);
  const name = stringValue(properties.name);
  const deviceName = stringValue(properties.deviceName);
  const sensorType = stringValue(properties.sensorType);
  const latestDb = numberValue(properties.latestDb);
  const lastUpdated = stringValue(properties.lastUpdated);
  const battery = numberValue(properties.battery);
  const temperature = numberValue(properties.temperature);
  const pressure = numberValue(properties.pressure);
  const humidity = numberValue(properties.humidity);
  const airQuality = numberValue(properties.airQuality);
  const powerUsage = numberValue(properties.powerUsage);
  const inferenceClass = stringValue(properties.inferenceClass);
  const inferenceProbability = numberValue(properties.inferenceProbability);
  const dayLimit = numberValue(properties.dayLimit);
  const nightLimit = numberValue(properties.nightLimit);
  const isAiSensor = sensorType === 'AI';
  const detailRoute = id ? `/locations/${encodeURIComponent(id)}` : '';
  const detailHref = detailRoute ? `${appBaseUrl}${detailRoute}` : '#';
  const detailLink = detailRoute
    ? `<a class="sensor-popup__link" href="${escapeHtml(detailHref)}" data-sensor-detail-link data-sensor-detail-route="${escapeHtml(detailRoute)}">View details</a>`
    : '<span class="sensor-popup__link sensor-popup__link--disabled" aria-disabled="true">Details unavailable</span>';

  return `
    <div class="sensor-popup">
      <div class="sensor-popup__header">
        <div>
          <h3 class="sensor-popup__title">${escapeHtml(name)}</h3>
          <p class="sensor-popup__label">${escapeHtml(deviceName)}</p>
        </div>
        <span class="sensor-popup__type">${escapeHtml(sensorType)}</span>
      </div>
      <dl class="sensor-popup__grid">
        ${popupRow('Latest noise', formatDb(latestDb))}
        ${popupRow('Last updated', formatDateTime(lastUpdated))}
        ${popupRow('Battery', formatNumber(battery, 'V'))}
        ${isAiSensor ? optionalPopupRow('Temperature', formatNumber(temperature, 'C'), temperature) : ''}
        ${isAiSensor ? optionalPopupRow('Humidity', formatNumber(humidity, '%'), humidity) : ''}
        ${isAiSensor ? optionalPopupRow('Air quality', formatNumber(airQuality), airQuality) : ''}
        ${isAiSensor ? optionalPopupRow('Power usage', formatNumber(powerUsage, 'W'), powerUsage) : ''}
        ${isAiSensor ? optionalPopupRow('Inference', inferenceClass, inferenceClass) : ''}
        ${isAiSensor ? optionalPopupRow('Probability', formatNumber(inferenceProbability === undefined ? undefined : inferenceProbability * 100, '%'), inferenceProbability) : ''}
        ${isAiSensor ? optionalPopupRow('Pressure', formatNumber(pressure), pressure) : ''}
        ${popupRow('Day limit', formatDb(dayLimit))}
        ${popupRow('Night limit', formatDb(nightLimit))}
      </dl>
      ${detailLink}
    </div>
  `;
}

function optionalPopupRow(label: string, value: string, rawValue: string | number | undefined): string {
  return rawValue === undefined || rawValue === '' ? '' : popupRow(label, value);
}

function popupRow(label: string, value: string): string {
  return `
    <div class="sensor-popup__row">
      <dt class="sensor-popup__label">${escapeHtml(label)}</dt>
      <dd class="sensor-popup__value">${escapeHtml(value)}</dd>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

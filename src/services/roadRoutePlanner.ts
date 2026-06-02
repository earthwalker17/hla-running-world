import type { AMapLngLatLike, AMapNamespace } from './amapLoader';
import type {
  RouteGeoPoint,
  RouteMapPoint,
  RouteMeasurement,
  RoutePlanSource,
  RoutePlanningMode,
  SeasonRoute,
} from '../types';
import { roundKm } from './progress';

export interface RoadRouteSegment {
  mode: RoutePlanningMode;
  distanceKm: number;
  path: RouteGeoPoint[];
}

export interface RoadRoutePlan extends RouteMeasurement {
  segmentCount: number;
}

interface AMapRouteStep {
  path?: unknown[];
}

interface AMapRouteResult {
  routes?: Array<{
    distance?: number | string;
    steps?: AMapRouteStep[];
  }>;
}

const routePlanCache = new Map<string, Promise<RoadRoutePlan | null>>();
const pluginLoadCache = new Map<RoutePlanningMode, Promise<void>>();
const routePlanningTimeoutMs = 12000;
const maxConcurrentSegmentRequests = 3;
let activeSegmentRequests = 0;
const queuedSegmentRequests: Array<() => void> = [];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function withSegmentRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeSegmentRequests >= maxConcurrentSegmentRequests) {
    await new Promise<void>((resolve) => {
      queuedSegmentRequests.push(resolve);
    });
  }

  activeSegmentRequests += 1;
  try {
    return await task();
  } finally {
    activeSegmentRequests = Math.max(0, activeSegmentRequests - 1);
    queuedSegmentRequests.shift()?.();
  }
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getDistanceKm(start: RouteGeoPoint, end: RouteGeoPoint): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPathDistances(path: RouteGeoPoint[]): number[] {
  const distances = [0];
  let totalDistance = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalDistance += getDistanceKm(path[index - 1], path[index]);
    distances.push(totalDistance);
  }

  return distances;
}

function normalizeGeoPoint(value: unknown): RouteGeoPoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = Number(value[0]);
    const lat = Number(value[1]);
    return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
  }

  const point = value as AMapLngLatLike | null;
  if (!point) {
    return null;
  }

  const lng = typeof point.getLng === 'function' ? point.getLng() : point.lng;
  const lat = typeof point.getLat === 'function' ? point.getLat() : point.lat;

  return Number.isFinite(lng) && Number.isFinite(lat)
    ? { lng: Number(lng), lat: Number(lat) }
    : null;
}

function normalizePath(rawPath: unknown[] | undefined): RouteGeoPoint[] {
  if (!Array.isArray(rawPath)) {
    return [];
  }

  return rawPath
    .map((point) => normalizeGeoPoint(point))
    .filter((point): point is RouteGeoPoint => Boolean(point));
}

function getSegmentDistanceKm(path: RouteGeoPoint[], apiDistance: number | string | undefined): number {
  const parsedApiDistance = Number(apiDistance);
  if (Number.isFinite(parsedApiDistance) && parsedApiDistance > 0) {
    return parsedApiDistance / 1000;
  }

  const distances = getPathDistances(path);
  return distances[distances.length - 1] ?? 0;
}

function isSamePoint(start: RouteGeoPoint, end: RouteGeoPoint): boolean {
  return Math.abs(start.lng - end.lng) < 0.000001 && Math.abs(start.lat - end.lat) < 0.000001;
}

function getPlannerPluginName(mode: RoutePlanningMode): 'AMap.Walking' | 'AMap.Driving' {
  return mode === 'walking' ? 'AMap.Walking' : 'AMap.Driving';
}

function getPlannerConstructor(amap: AMapNamespace, mode: RoutePlanningMode) {
  return mode === 'walking' ? amap.Walking : amap.Driving;
}

function ensureRoutePlugin(amap: AMapNamespace, mode: RoutePlanningMode): Promise<void> {
  const constructor = getPlannerConstructor(amap, mode);
  if (constructor) {
    return Promise.resolve();
  }

  const cached = pluginLoadCache.get(mode);
  if (cached) {
    return cached;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (!amap.plugin) {
      reject(new Error('AMap route plugin loader is unavailable'));
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error(`${getPlannerPluginName(mode)} load timeout`));
    }, routePlanningTimeoutMs);

    amap.plugin(getPlannerPluginName(mode), () => {
      window.clearTimeout(timeout);
      if (getPlannerConstructor(amap, mode)) {
        resolve();
      } else {
        reject(new Error(`${getPlannerPluginName(mode)} is unavailable`));
      }
    });
  });

  pluginLoadCache.set(mode, promise);
  return promise;
}

function createPlannerOptions(mode: RoutePlanningMode): Record<string, unknown> {
  if (mode === 'driving') {
    return {
      extensions: 'base',
      hideMarkers: true,
      showTraffic: false,
    };
  }

  return {
    extensions: 'base',
    hideMarkers: true,
  };
}

async function planSegmentWithMode(
  amap: AMapNamespace,
  from: RouteGeoPoint,
  to: RouteGeoPoint,
  mode: RoutePlanningMode,
): Promise<RoadRouteSegment> {
  await ensureRoutePlugin(amap, mode);

  const Planner = getPlannerConstructor(amap, mode);
  if (!Planner) {
    throw new Error(`${getPlannerPluginName(mode)} is unavailable`);
  }

  return withSegmentRequestSlot(() => new Promise((resolve, reject) => {
    const planner = new Planner(createPlannerOptions(mode));
    const timeout = window.setTimeout(() => {
      planner.clear?.();
      reject(new Error(`${mode} route planning timeout`));
    }, routePlanningTimeoutMs);

    const finish = (status: unknown, result: unknown) => {
      window.clearTimeout(timeout);

      if (status !== 'complete') {
        reject(new Error(`${mode} route planning failed`));
        return;
      }

      const route = (result as AMapRouteResult).routes?.[0];
      const path = route?.steps?.flatMap((step) => normalizePath(step.path)) ?? [];
      const normalizedPath = path.length >= 2 ? path : [from, to];
      const distanceKm = getSegmentDistanceKm(normalizedPath, route?.distance);

      if (distanceKm <= 0) {
        reject(new Error(`${mode} route planning returned empty distance`));
        return;
      }

      resolve({
        mode,
        distanceKm,
        path: normalizedPath,
      });
    };

    try {
      planner.search([from.lng, from.lat], [to.lng, to.lat], finish);
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error);
    }
  }));
}

async function planSegment(
  amap: AMapNamespace,
  from: RouteGeoPoint,
  to: RouteGeoPoint,
  modes: RoutePlanningMode[],
): Promise<RoadRouteSegment> {
  let lastError: unknown;

  for (const mode of modes) {
    try {
      return await planSegmentWithMode(amap, from, to, mode);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('route planning failed');
}

async function planSegmentsInParallel(
  amap: AMapNamespace,
  stops: RouteGeoPoint[],
  modes: RoutePlanningMode[],
): Promise<RoadRouteSegment[]> {
  return Promise.all(
    stops
      .slice(1)
      .map((stop, index) => planSegment(amap, stops[index], stop, modes)),
  );
}

async function planSegmentsSequentially(
  amap: AMapNamespace,
  stops: RouteGeoPoint[],
  modes: RoutePlanningMode[],
): Promise<RoadRouteSegment[]> {
  const segments: RoadRouteSegment[] = [];

  for (let index = 1; index < stops.length; index += 1) {
    segments.push(await planSegment(amap, stops[index - 1], stops[index], modes));
  }

  return segments;
}

function getRouteStops(route: SeasonRoute): RouteGeoPoint[] {
  if (route.nodes.length >= 2) {
    return route.nodes.map((node) => node.coord);
  }

  return route.map.path.map((point) => ({ lng: point.lng, lat: point.lat }));
}

function getRouteCacheKey(route: SeasonRoute): string {
  const routing = route.map.routing;
  const stops = getRouteStops(route)
    .map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join('|');

  return `${route.id}:${routing?.mode ?? 'walking'}:${routing?.fallbackMode ?? 'none'}:${stops}`;
}

function getRoutePlanningModes(route: SeasonRoute): RoutePlanningMode[] {
  const primaryMode = route.map.routing?.mode ?? 'walking';
  const fallbackMode =
    route.map.routing?.fallbackMode ?? (primaryMode === 'walking' ? 'driving' : undefined);

  return fallbackMode && fallbackMode !== primaryMode ? [primaryMode, fallbackMode] : [primaryMode];
}

function getPlanSource(segments: RoadRouteSegment[]): RoutePlanSource {
  const modes = Array.from(new Set(segments.map((segment) => segment.mode)));
  if (modes.length > 1) return 'amap-mixed';
  return modes[0] === 'walking' ? 'amap-walking' : 'amap-driving';
}

export function buildRoadRoutePlanFromSegments(
  route: SeasonRoute,
  segments: RoadRouteSegment[],
): RoadRoutePlan | null {
  if (segments.length === 0 || route.nodes.length < 2) {
    return null;
  }

  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (totalDistanceKm <= 0) {
    return null;
  }

  let cumulativeDistanceKm = 0;
  const path: RouteMapPoint[] = [];
  const nodeKms: Record<string, number> = {
    [route.nodes[0].id]: 0,
  };

  segments.forEach((segment, segmentIndex) => {
    const pathDistances = getPathDistances(segment.path);
    const pathLengthKm = pathDistances[pathDistances.length - 1] || segment.distanceKm || 1;

    segment.path.forEach((point, pointIndex) => {
      if (segmentIndex > 0 && pointIndex === 0 && path.length > 0 && isSamePoint(path[path.length - 1], point)) {
        return;
      }

      const localDistanceKm = (pathDistances[pointIndex] / pathLengthKm) * segment.distanceKm;
      const distanceKm = cumulativeDistanceKm + localDistanceKm;
      path.push({
        lng: point.lng,
        lat: point.lat,
        at: Math.min(1, Math.max(0, distanceKm / totalDistanceKm)),
      });
    });

    cumulativeDistanceKm += segment.distanceKm;
    const nextNode = route.nodes[segmentIndex + 1];
    if (nextNode) {
      nodeKms[nextNode.id] = roundKm(cumulativeDistanceKm);
    }
  });

  if (path.length < 2) {
    return null;
  }

  path[0].at = 0;
  path[path.length - 1].at = 1;

  return {
    routeId: route.id,
    distanceKm: roundKm(totalDistanceKm),
    nodeKms,
    path,
    source: getPlanSource(segments),
    segmentCount: segments.length,
  };
}

export function createLocalFallbackPlan(route: SeasonRoute): RoadRoutePlan {
  return {
    routeId: route.id,
    distanceKm: route.distanceKm,
    nodeKms: Object.fromEntries(route.nodes.map((node) => [node.id, node.km])),
    path: route.map.path,
    source: 'local-fallback',
    segmentCount: Math.max(0, route.nodes.length - 1),
  };
}

async function requestRoadRoutePlan(amap: AMapNamespace, route: SeasonRoute): Promise<RoadRoutePlan | null> {
  const stops = getRouteStops(route);
  if (stops.length < 2 || route.nodes.length < 2) {
    return null;
  }

  const modes = getRoutePlanningModes(route);
  let segments: RoadRouteSegment[];

  try {
    segments = await planSegmentsInParallel(amap, stops, modes);
  } catch {
    await wait(600);
    segments = await planSegmentsSequentially(amap, stops, modes);
  }

  return buildRoadRoutePlanFromSegments(route, segments);
}

export function planRoadRoute(amap: AMapNamespace, route: SeasonRoute): Promise<RoadRoutePlan | null> {
  const cacheKey = getRouteCacheKey(route);
  const cached = routePlanCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = requestRoadRoutePlan(amap, route).catch(() => null);
  routePlanCache.set(cacheKey, promise);
  return promise;
}

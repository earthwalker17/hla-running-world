import type { RouteGeoPoint, RouteMapPoint, RouteNode, RoutePoint, SeasonRoute } from '../types';

export interface MapProvider {
  getAvatarPoint(route: SeasonRoute, progressPercent: number): RoutePoint;
  getNodePoint(route: SeasonRoute, node: RouteNode): RoutePoint;
  getRoutePointsBetween(route: SeasonRoute, startPercent: number, endPercent: number): RoutePoint[];
  getAvatarGeoPoint(route: SeasonRoute, progressPercent: number): RouteGeoPoint;
  getNodeGeoPoint(route: SeasonRoute, node: RouteNode): RouteGeoPoint;
  getCompletedGeoPath(route: SeasonRoute, progressPercent: number): RouteGeoPoint[];
  getGeoPathBetween(route: SeasonRoute, startPercent: number, endPercent: number): RouteGeoPoint[];
}

function interpolate(points: RoutePoint[], ratio: number): RoutePoint {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const clamped = Math.min(1, Math.max(0, ratio));

  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    if (clamped <= end.at) {
      const span = end.at - start.at || 1;
      const localRatio = (clamped - start.at) / span;
      return {
        at: clamped,
        x: start.x + (end.x - start.x) * localRatio,
        y: start.y + (end.y - start.y) * localRatio,
      };
    }
  }

  return sorted[sorted.length - 1];
}

function interpolateGeo(points: RouteMapPoint[], ratio: number): RouteMapPoint {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const clamped = Math.min(1, Math.max(0, ratio));

  for (let index = 1; index < sorted.length; index += 1) {
    const start = sorted[index - 1];
    const end = sorted[index];
    if (clamped <= end.at) {
      const span = end.at - start.at || 1;
      const localRatio = (clamped - start.at) / span;
      return {
        at: clamped,
        lng: start.lng + (end.lng - start.lng) * localRatio,
        lat: start.lat + (end.lat - start.lat) * localRatio,
      };
    }
  }

  return sorted[sorted.length - 1];
}

export const localMapProvider: MapProvider = {
  getAvatarPoint(route, progressPercent) {
    return interpolate(route.points, progressPercent / 100);
  },
  getNodePoint(route, node) {
    return interpolate(route.points, node.km / route.distanceKm);
  },
  getRoutePointsBetween(route, startPercent, endPercent) {
    const start = Math.min(1, Math.max(0, startPercent / 100));
    const end = Math.min(1, Math.max(start, endPercent / 100));
    const startPoint = interpolate(route.points, start);
    const endPoint = interpolate(route.points, end);
    const middle = route.points.filter((point) => point.at > start && point.at < end);
    return [startPoint, ...middle, endPoint];
  },
  getAvatarGeoPoint(route, progressPercent) {
    const point = interpolateGeo(route.map.path, progressPercent / 100);
    return { lng: point.lng, lat: point.lat };
  },
  getNodeGeoPoint(_route, node) {
    return node.coord;
  },
  getCompletedGeoPath(route, progressPercent) {
    const clamped = Math.min(1, Math.max(0, progressPercent / 100));
    const geoPoint = interpolateGeo(route.map.path, progressPercent / 100);
    const avatarPoint = { lng: geoPoint.lng, lat: geoPoint.lat };
    const completed = route.map.path
      .filter((point) => point.at <= clamped)
      .map((point) => ({ lng: point.lng, lat: point.lat }));

    if (completed.length === 0) {
      return [avatarPoint];
    }

    const last = completed[completed.length - 1];
    if (Math.abs(last.lng - avatarPoint.lng) > 0.00001 || Math.abs(last.lat - avatarPoint.lat) > 0.00001) {
      completed.push(avatarPoint);
    }

    return completed;
  },
  getGeoPathBetween(route, startPercent, endPercent) {
    const start = Math.min(1, Math.max(0, startPercent / 100));
    const end = Math.min(1, Math.max(start, endPercent / 100));
    const startPoint = interpolateGeo(route.map.path, start);
    const endPoint = interpolateGeo(route.map.path, end);
    const middle = route.map.path.filter((point) => point.at > start && point.at < end);
    return [startPoint, ...middle, endPoint].map((point) => ({ lng: point.lng, lat: point.lat }));
  },
};

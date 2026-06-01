import type { RunRecord, RouteNode, SeasonRoute } from '../types';
import { addDaysToKey } from '../utils/dates';

export function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampDistance(value: number, min = 0, max = 60): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, roundKm(value)));
}

export function getTotalDistance(records: RunRecord[]): number {
  return roundKm(records.reduce((sum, record) => sum + record.distanceKm, 0));
}

export function getProgressPercent(totalDistance: number, routeDistance: number): number {
  if (routeDistance <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (totalDistance / routeDistance) * 100));
}

export function getUnlockedNodes(route: SeasonRoute, totalDistance: number): RouteNode[] {
  return route.nodes.filter((node) => totalDistance >= node.km);
}

export function getCurrentNode(route: SeasonRoute, totalDistance: number): RouteNode {
  const unlocked = getUnlockedNodes(route, totalDistance);
  return unlocked[unlocked.length - 1] ?? route.nodes[0];
}

export function getNextNode(route: SeasonRoute, totalDistance: number): RouteNode | null {
  return route.nodes.find((node) => node.km > totalDistance) ?? null;
}

export function getDistanceToNextNode(route: SeasonRoute, totalDistance: number): number {
  const nextNode = getNextNode(route, totalDistance);
  return nextNode ? roundKm(nextNode.km - totalDistance) : 0;
}

export function getNewlyUnlockedNodes(
  route: SeasonRoute,
  beforeDistance: number,
  afterDistance: number,
): RouteNode[] {
  return route.nodes.filter((node) => node.km > beforeDistance && node.km <= afterDistance);
}

export function getContinuousDays(records: RunRecord[]): number {
  const days = Array.from(new Set(records.map((record) => record.date))).sort();
  if (days.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = days.length - 1; index > 0; index -= 1) {
    const previous = addDaysToKey(days[index], -1);
    if (previous !== days[index - 1]) {
      break;
    }
    streak += 1;
  }

  return streak;
}

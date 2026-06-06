import type { RunRecord } from '../types';
import { routes } from '../data/season';
import {
  clampDistance,
  getContinuousDays,
  getDistanceToNextNode,
  getNewlyUnlockedNodes,
  getProgressPercent,
  getTotalDistance,
  getUnlockedNodes,
} from './progress';

const jiangyinRoute = routes[0];

describe('progress service', () => {
  it('clamps and rounds manual run distance', () => {
    expect(clampDistance(6.24)).toBe(6.2);
    expect(clampDistance(-4)).toBe(0);
    expect(clampDistance(80)).toBe(60);
  });

  it('calculates total distance and route progress', () => {
    const records: RunRecord[] = [
      { id: 'r1', date: '2026-05-16', distanceKm: 4.6, source: 'manual-demo' },
      { id: 'r2', date: '2026-05-17', distanceKm: 6.8, source: 'manual-demo' },
      { id: 'r3', date: '2026-05-18', distanceKm: 7.2, source: 'manual-demo' },
    ];

    const total = getTotalDistance(records);
    expect(total).toBe(18.6);
    expect(Math.round(getProgressPercent(total, jiangyinRoute.distanceKm))).toBe(43);
  });

  it('detects unlocked nodes and next node distance', () => {
    const unlocked = getUnlockedNodes(jiangyinRoute, 24.8);
    expect(unlocked.map((node) => node.id)).toEqual(['feima', 'xinqiao', 'longzhuang']);
    expect(getDistanceToNextNode(jiangyinRoute, 24.8)).toBe(7.8);
  });

  it('finds nodes unlocked by the latest run', () => {
    const unlocked = getNewlyUnlockedNodes(jiangyinRoute, 18.6, 24.8);
    expect(unlocked.map((node) => node.id)).toEqual(['longzhuang']);
  });

  it('counts consecutive training days from the latest record', () => {
    const records: RunRecord[] = [
      { id: 'r1', date: '2026-05-15', distanceKm: 4, source: 'manual-demo' },
      { id: 'r2', date: '2026-05-17', distanceKm: 5, source: 'manual-demo' },
      { id: 'r3', date: '2026-05-18', distanceKm: 5, source: 'manual-demo' },
      { id: 'r4', date: '2026-05-19', distanceKm: 5, source: 'manual-demo' },
    ];

    expect(getContinuousDays(records)).toBe(3);
  });
});

import { routes } from '../data/season';
import type { RoadRouteSegment } from './roadRoutePlanner';
import { buildRoadRoutePlanFromSegments, createLocalFallbackPlan } from './roadRoutePlanner';

const jiangyinRoute = routes[0];

describe('road route planner', () => {
  it('builds measured route distance and node kilometers from planned segments', () => {
    const route = {
      ...jiangyinRoute,
      nodes: jiangyinRoute.nodes.slice(0, 3),
    };
    const [start, middle, end] = route.nodes.map((node) => node.coord);
    const segments: RoadRouteSegment[] = [
      {
        mode: 'walking',
        distanceKm: 1,
        path: [start, middle],
      },
      {
        mode: 'walking',
        distanceKm: 2,
        path: [middle, end],
      },
    ];

    const plan = buildRoadRoutePlanFromSegments(route, segments);

    expect(plan).not.toBeNull();
    if (!plan) return;

    expect(plan.distanceKm).toBe(3);
    expect(plan.nodeKms).toEqual({
      feima: 0,
      xinqiao: 1,
      longzhuang: 3,
    });
    expect(plan.path[0].at).toBe(0);
    expect(plan.path[plan.path.length - 1].at).toBe(1);
    expect(plan.source).toBe('amap-walking');
  });

  it('keeps the original local route as a fallback plan', () => {
    const plan = createLocalFallbackPlan(jiangyinRoute);

    expect(plan.distanceKm).toBe(jiangyinRoute.distanceKm);
    expect(plan.nodeKms.xinqiao).toBe(8.6);
    expect(plan.path).toBe(jiangyinRoute.map.path);
    expect(plan.source).toBe('local-fallback');
  });
});

import { routes } from '../data/season';
import type { CoachContext } from '../types';
import { requestCoachFeedback } from './coachClient';

const route = routes[0];

function createContext(): CoachContext {
  return {
    route,
    todayDistance: 5,
    totalDistance: 23.6,
    streakDays: 4,
    progressPercent: 55,
    unlockedNodes: route.nodes.slice(0, 2),
    newlyUnlockedNodes: [],
  };
}

describe('coach client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts local fallback responses from the AI proxy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            text: '本地保底反馈',
            source: 'local',
            provider: 'local',
            model: 'rule-fallback',
          }),
      }),
    );

    const result = await requestCoachFeedback(createContext(), '本地保底反馈');

    expect(result.text).toBe('本地保底反馈');
    expect(result.source).toBe('local');
    expect(result.provider).toBe('local');
  });
});

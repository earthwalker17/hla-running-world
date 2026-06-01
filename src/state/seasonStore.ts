import { computed, reactive, watch } from 'vue';
import { createSeedRecords, routes } from '../data/season';
import type { CoachContext, DemoState, RunRecord, SeasonRoute } from '../types';
import { toDateKey } from '../utils/dates';
import { buildCoachFeedback } from '../services/aiCoach';
import { requestCoachFeedback } from '../services/coachClient';
import {
  clampDistance,
  getContinuousDays,
  getCurrentNode,
  getDistanceToNextNode,
  getNewlyUnlockedNodes,
  getProgressPercent,
  getTotalDistance,
  getUnlockedNodes,
} from '../services/progress';

const storageKey = 'hla-running-world-demo:v1';

let store: ReturnType<typeof createSeasonStore> | null = null;

function createDefaultState(): DemoState {
  return {
    selectedRouteId: 'jiangyin-city',
    records: createSeedRecords(),
    lastCoachText: '连续训练已经开始，今天再提交一次跑量，就能看见路线节点被点亮。',
    lastUnlockedNodeIds: [],
    coachStatus: 'local',
    coachProvider: 'local',
    coachModel: 'rule-fallback',
    lastRunDistanceKm: 0,
    lastRunBeforeKm: 0,
    lastRunAfterKm: 0,
    shareCardVersion: 0,
  };
}

function loadState(): DemoState {
  if (typeof window === 'undefined') {
    return createDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createDefaultState();
    }
    const parsed = JSON.parse(raw) as DemoState;
    if (!routes.some((route) => route.id === parsed.selectedRouteId)) {
      return createDefaultState();
    }
    return {
      selectedRouteId: parsed.selectedRouteId,
      records: Array.isArray(parsed.records) ? parsed.records : createSeedRecords(),
      lastCoachText: parsed.lastCoachText || createDefaultState().lastCoachText,
      lastUnlockedNodeIds: Array.isArray(parsed.lastUnlockedNodeIds)
        ? parsed.lastUnlockedNodeIds
        : [],
      coachStatus:
        parsed.coachStatus === 'remote' ||
        parsed.coachStatus === 'pending' ||
        parsed.coachStatus === 'error'
          ? parsed.coachStatus
          : 'local',
      coachProvider: parsed.coachProvider || 'local',
      coachModel: parsed.coachModel || 'rule-fallback',
      coachError: parsed.coachError,
      lastRunDistanceKm: Number.isFinite(parsed.lastRunDistanceKm) ? parsed.lastRunDistanceKm : 0,
      lastRunBeforeKm: Number.isFinite(parsed.lastRunBeforeKm) ? parsed.lastRunBeforeKm : 0,
      lastRunAfterKm: Number.isFinite(parsed.lastRunAfterKm) ? parsed.lastRunAfterKm : 0,
      shareCardVersion: Number.isFinite(parsed.shareCardVersion) ? parsed.shareCardVersion : 0,
    };
  } catch {
    return createDefaultState();
  }
}

function createSeasonStore() {
  const state = reactive<DemoState>(loadState());

  const activeRoute = computed<SeasonRoute>(() => {
    return routes.find((route) => route.id === state.selectedRouteId) ?? routes[0];
  });

  const totalDistance = computed(() => getTotalDistance(state.records));
  const progressPercent = computed(() =>
    getProgressPercent(totalDistance.value, activeRoute.value.distanceKm),
  );
  const unlockedNodes = computed(() => getUnlockedNodes(activeRoute.value, totalDistance.value));
  const currentNode = computed(() => getCurrentNode(activeRoute.value, totalDistance.value));
  const distanceToNextNode = computed(() =>
    getDistanceToNextNode(activeRoute.value, totalDistance.value),
  );
  const streakDays = computed(() => getContinuousDays(state.records));
  const recentRecords = computed(() => [...state.records].slice(-5).reverse());

  function persist() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }

  function selectRoute(routeId: string) {
    if (routes.some((route) => route.id === routeId)) {
      state.selectedRouteId = routeId;
    }
  }

  function buildCoachContext(
    route: SeasonRoute,
    todayDistance: number,
    afterDistance: number,
    newlyUnlocked: ReturnType<typeof getNewlyUnlockedNodes>,
  ): CoachContext {
    return {
      route,
      todayDistance,
      totalDistance: afterDistance,
      streakDays: getContinuousDays(state.records),
      progressPercent: getProgressPercent(afterDistance, route.distanceKm),
      unlockedNodes: getUnlockedNodes(route, afterDistance),
      newlyUnlockedNodes: newlyUnlocked,
    };
  }

  function addRun(distance: number) {
    const todayDistance = clampDistance(distance);
    if (todayDistance <= 0) {
      return {
        coachText: state.lastCoachText,
        unlocked: [],
        context: null,
      };
    }

    const beforeDistance = totalDistance.value;
    const route = activeRoute.value;
    const record: RunRecord = {
      date: toDateKey(new Date()),
      distanceKm: todayDistance,
      source: 'manual-demo',
    };
    state.records.push(record);

    const afterDistance = getTotalDistance(state.records);
    const newlyUnlocked = getNewlyUnlockedNodes(route, beforeDistance, afterDistance);
    const context = buildCoachContext(route, todayDistance, afterDistance, newlyUnlocked);
    state.lastUnlockedNodeIds = newlyUnlocked.map((node) => node.id);
    state.lastCoachText = buildCoachFeedback(context);
    state.coachStatus = 'local';
    state.coachProvider = 'local';
    state.coachModel = 'rule-fallback';
    state.coachError = undefined;
    state.lastRunDistanceKm = todayDistance;
    state.lastRunBeforeKm = beforeDistance;
    state.lastRunAfterKm = afterDistance;
    state.shareCardVersion += 1;

    return {
      coachText: state.lastCoachText,
      unlocked: newlyUnlocked,
      context,
    };
  }

  async function addRunWithCoach(distance: number) {
    const result = addRun(distance);
    if (!result.context) {
      return result;
    }

    state.coachStatus = 'pending';

    try {
      const coach = await requestCoachFeedback(result.context, result.coachText);
      state.lastCoachText = coach.text;
      state.coachStatus = coach.source === 'remote' ? 'remote' : 'local';
      state.coachProvider = coach.provider;
      state.coachModel = coach.model;
      state.coachError = coach.error;

      return {
        ...result,
        coachText: coach.text,
      };
    } catch (error) {
      state.coachStatus = 'error';
      state.coachProvider = 'local';
      state.coachModel = 'rule-fallback';
      state.coachError = error instanceof Error ? error.message : 'AI feedback request failed';
      return result;
    }
  }

  function resetDemo() {
    Object.assign(state, createDefaultState());
  }

  function resetRoadshowPreset() {
    Object.assign(state, {
      ...createDefaultState(),
      records: [
        {
          date: toDateKey(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
          distanceKm: 4.8,
          source: 'manual-demo',
        },
        {
          date: toDateKey(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
          distanceKm: 6.4,
          source: 'manual-demo',
        },
        {
          date: toDateKey(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
          distanceKm: 7.6,
          source: 'manual-demo',
        },
        {
          date: toDateKey(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
          distanceKm: 8.1,
          source: 'manual-demo',
        },
      ],
      lastCoachText: '路演演示状态已就绪：连续训练、节点解锁和分享卡都能在下一次跑量提交后自然出现。',
      lastUnlockedNodeIds: ['xinqiao', 'longzhuang'],
      lastRunDistanceKm: 0,
      lastRunBeforeKm: 0,
      lastRunAfterKm: 26.9,
      shareCardVersion: state.shareCardVersion + 1,
    } satisfies DemoState);
  }

  watch(state, persist, { deep: true });

  return {
    state,
    routes,
    activeRoute,
    totalDistance,
    progressPercent,
    unlockedNodes,
    currentNode,
    distanceToNextNode,
    streakDays,
    recentRecords,
    addRun,
    addRunWithCoach,
    resetDemo,
    resetRoadshowPreset,
    selectRoute,
  };
}

export function useSeasonStore() {
  store ??= createSeasonStore();
  return store;
}

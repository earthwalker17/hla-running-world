import { computed, reactive, watch } from 'vue';
import { createSeedRecords, routes as seedRoutes } from '../data/season';
import type {
  CoachContext,
  DemoState,
  RouteMeasurement,
  RunRecord,
  SeasonRoute,
  VisitorProfile,
} from '../types';
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

const legacyStorageKey = 'hla-running-world-demo:v1';
const visitorStorageKey = 'hla-running-world-demo:visitor:v1';
const stateStoragePrefix = 'hla-running-world-demo:state';
const stateStorageVersion = 'v2';

const visitorSeeds = [
  { city: '江阴', teamId: 'team-01' },
  { city: '无锡', teamId: 'team-03' },
  { city: '南京', teamId: 'team-08' },
  { city: '苏州', teamId: 'team-09' },
  { city: '常州', teamId: 'team-10' },
  { city: '镇江', teamId: 'team-11' },
  { city: '徐州', teamId: 'team-12' },
  { city: '连云港', teamId: 'team-13' },
];

let store: ReturnType<typeof createSeasonStore> | null = null;

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function createStateStorageKey(visitorId: string): string {
  return `${stateStoragePrefix}:${visitorId}:${stateStorageVersion}`;
}

function hashText(value: string): number {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);
}

function createVisitorId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return `visitor-${window.crypto.randomUUID()}`;
  }

  return `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getVisitorSuffix(visitorId: string): string {
  return visitorId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || 'HLA0';
}

function createVisitorProfile(): VisitorProfile {
  const visitorId = createVisitorId();
  const seed = visitorSeeds[hashText(visitorId) % visitorSeeds.length] ?? {
    city: '江阴',
    teamId: 'team-01',
  };
  const suffix = getVisitorSuffix(visitorId);

  return {
    visitorId,
    displayName: `${seed.city}跑友 ${suffix}`,
    city: seed.city,
    teamId: seed.teamId,
    createdAt: new Date().toISOString(),
  };
}

function normalizeVisitorProfile(raw: unknown): VisitorProfile | null {
  const profile = raw as Partial<VisitorProfile>;
  if (
    !profile ||
    !profile.visitorId ||
    !profile.displayName ||
    !profile.city ||
    !profile.teamId
  ) {
    return null;
  }

  return {
    visitorId: profile.visitorId,
    displayName: profile.displayName,
    city: profile.city,
    teamId: profile.teamId,
    createdAt: profile.createdAt || new Date().toISOString(),
  };
}

function loadVisitorProfile(): VisitorProfile {
  try {
    const raw = readStorage(visitorStorageKey);
    const parsed = raw ? normalizeVisitorProfile(JSON.parse(raw)) : null;
    if (parsed) {
      return parsed;
    }
  } catch {
    // A malformed profile should not block the demo.
  }

  const profile = createVisitorProfile();
  writeStorage(visitorStorageKey, JSON.stringify(profile));
  return profile;
}

function createRecordId(date: string, distanceKm: number, prefix = 'run'): string {
  return `${prefix}-${date}-${distanceKm.toFixed(1)}-${Date.now().toString(36)}`;
}

function normalizeRecords(records: unknown): RunRecord[] {
  if (!Array.isArray(records)) {
    return createSeedRecords();
  }

  return records
    .map((record, index): RunRecord | null => {
      const item = record as Partial<RunRecord>;
      if (!item.date || !Number.isFinite(item.distanceKm)) {
        return null;
      }

      return {
        id: item.id || `stored-${item.date}-${Number(item.distanceKm).toFixed(1)}-${index}`,
        date: item.date,
        distanceKm: Number(item.distanceKm),
        source: 'manual-demo',
      };
    })
    .filter((record): record is RunRecord => Boolean(record));
}

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

function normalizeState(raw: unknown): DemoState | null {
  const parsed = raw as Partial<DemoState>;
  const selectedRouteId = parsed?.selectedRouteId;

  if (
    typeof selectedRouteId !== 'string' ||
    !seedRoutes.some((route) => route.id === selectedRouteId)
  ) {
    return null;
  }

  const defaultState = createDefaultState();

  return {
    selectedRouteId,
    records: normalizeRecords(parsed.records),
    lastCoachText: parsed.lastCoachText || defaultState.lastCoachText,
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
    lastRunDistanceKm:
      typeof parsed.lastRunDistanceKm === 'number' && Number.isFinite(parsed.lastRunDistanceKm)
        ? parsed.lastRunDistanceKm
        : 0,
    lastRunBeforeKm:
      typeof parsed.lastRunBeforeKm === 'number' && Number.isFinite(parsed.lastRunBeforeKm)
        ? parsed.lastRunBeforeKm
        : 0,
    lastRunAfterKm:
      typeof parsed.lastRunAfterKm === 'number' && Number.isFinite(parsed.lastRunAfterKm)
        ? parsed.lastRunAfterKm
        : 0,
    shareCardVersion:
      typeof parsed.shareCardVersion === 'number' && Number.isFinite(parsed.shareCardVersion)
        ? parsed.shareCardVersion
        : 0,
  };
}

function readStateFromKey(storageKey: string): DemoState | null {
  try {
    const raw = readStorage(storageKey);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function loadState(visitorId: string): DemoState {
  const currentStateKey = createStateStorageKey(visitorId);
  const scopedState = readStateFromKey(currentStateKey);
  if (scopedState) {
    return scopedState;
  }

  const migratedLegacyState = readStateFromKey(legacyStorageKey);
  if (migratedLegacyState) {
    writeStorage(currentStateKey, JSON.stringify(migratedLegacyState));
    return migratedLegacyState;
  }

  return createDefaultState();
}

function createSeasonStore() {
  const visitorProfile = reactive<VisitorProfile>(loadVisitorProfile());
  const state = reactive<DemoState>(loadState(visitorProfile.visitorId));
  const routeMeasurements = reactive<Record<string, RouteMeasurement>>({});

  function applyRouteMeasurement(route: SeasonRoute): SeasonRoute {
    const measurement = routeMeasurements[route.id];
    if (!measurement) {
      return route;
    }

    return {
      ...route,
      distanceKm: measurement.distanceKm,
      map: {
        ...route.map,
        path: measurement.path,
      },
      nodes: route.nodes.map((node) => ({
        ...node,
        km: measurement.nodeKms[node.id] ?? node.km,
      })),
    };
  }

  const routes = computed<SeasonRoute[]>(() => seedRoutes.map((route) => applyRouteMeasurement(route)));

  const activeRoute = computed<SeasonRoute>(() => {
    return routes.value.find((route) => route.id === state.selectedRouteId) ?? routes.value[0];
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
  const allRecords = computed(() => [...state.records].reverse());
  const recentRecords = computed(() => [...state.records].slice(-5).reverse());

  function persist() {
    writeStorage(createStateStorageKey(visitorProfile.visitorId), JSON.stringify(state));
  }

  function selectRoute(routeId: string) {
    if (seedRoutes.some((route) => route.id === routeId)) {
      state.selectedRouteId = routeId;
    }
  }

  function setRouteMeasurement(measurement: RouteMeasurement) {
    if (
      !seedRoutes.some((route) => route.id === measurement.routeId) ||
      measurement.distanceKm <= 0 ||
      measurement.path.length < 2
    ) {
      return;
    }

    const existing = routeMeasurements[measurement.routeId];
    const hasSameDistance =
      existing && Math.abs(existing.distanceKm - measurement.distanceKm) < 0.05;
    const hasSamePath =
      existing &&
      existing.path.length === measurement.path.length &&
      existing.path[0]?.lng === measurement.path[0]?.lng &&
      existing.path[existing.path.length - 1]?.lng === measurement.path[measurement.path.length - 1]?.lng;

    if (hasSameDistance && hasSamePath && existing.source === measurement.source) {
      return;
    }

    routeMeasurements[measurement.routeId] = measurement;
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
      id: createRecordId(toDateKey(new Date()), todayDistance),
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

  function undoRunRecord(recordId: string) {
    const index = state.records.findIndex((record) => record.id === recordId);
    if (index < 0) {
      return false;
    }

    const [removed] = state.records.splice(index, 1);
    state.lastUnlockedNodeIds = [];
    state.lastRunDistanceKm = 0;
    state.lastRunBeforeKm = 0;
    state.lastRunAfterKm = getTotalDistance(state.records);
    state.coachStatus = 'local';
    state.coachProvider = 'local';
    state.coachModel = 'rule-fallback';
    state.coachError = undefined;
    state.lastCoachText = `${removed.date} 的 ${removed.distanceKm.toFixed(1)} km 已撤销。现在累计 ${state.lastRunAfterKm.toFixed(1)} km，可以重新提交正确跑量。`;
    state.shareCardVersion += 1;
    return true;
  }

  function resetRoadshowPreset() {
    Object.assign(state, {
      ...createDefaultState(),
      records: [
        {
          id: `roadshow-${toDateKey(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000))}`,
          date: toDateKey(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
          distanceKm: 4.8,
          source: 'manual-demo',
        },
        {
          id: `roadshow-${toDateKey(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))}`,
          date: toDateKey(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
          distanceKm: 6.4,
          source: 'manual-demo',
        },
        {
          id: `roadshow-${toDateKey(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))}`,
          date: toDateKey(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
          distanceKm: 7.6,
          source: 'manual-demo',
        },
        {
          id: `roadshow-${toDateKey(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000))}`,
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
    visitorProfile,
    state,
    routes,
    activeRoute,
    totalDistance,
    progressPercent,
    unlockedNodes,
    currentNode,
    distanceToNextNode,
    streakDays,
    allRecords,
    recentRecords,
    addRun,
    addRunWithCoach,
    undoRunRecord,
    resetDemo,
    resetRoadshowPreset,
    selectRoute,
    setRouteMeasurement,
  };
}

export function useSeasonStore() {
  store ??= createSeasonStore();
  return store;
}

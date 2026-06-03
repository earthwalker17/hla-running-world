export type RouteDifficulty = 'light' | 'standard' | 'challenge' | 'flagship';

export interface RoutePoint {
  at: number;
  x: number;
  y: number;
}

export interface RouteGeoPoint {
  lng: number;
  lat: number;
}

export interface RouteMapPoint extends RouteGeoPoint {
  at: number;
}

export type RoutePlanningMode = 'walking' | 'driving';

export type RoutePlanSource = 'amap-walking' | 'amap-driving' | 'amap-mixed' | 'local-fallback';

export interface RouteMapConfig {
  center: RouteGeoPoint;
  zoom: number;
  path: RouteMapPoint[];
  routing?: {
    mode: RoutePlanningMode;
    fallbackMode?: RoutePlanningMode;
  };
}

export interface RouteNode {
  id: string;
  name: string;
  city: string;
  mapLabel?: string;
  km: number;
  coord: RouteGeoPoint;
  story: string;
  brandHint: string;
}

export interface RouteReward {
  id: string;
  title: string;
  unlockKm: number;
  type: 'badge' | 'coupon' | 'lottery' | 'offline';
}

export interface SeasonRoute {
  id: string;
  title: string;
  subtitle: string;
  distanceKm: number;
  durationDays: number;
  difficulty: RouteDifficulty;
  accent: string;
  summary: string;
  points: RoutePoint[];
  map: RouteMapConfig;
  nodes: RouteNode[];
  rewards: RouteReward[];
}

export interface RouteMeasurement {
  routeId: string;
  distanceKm: number;
  nodeKms: Record<string, number>;
  path: RouteMapPoint[];
  source: RoutePlanSource;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  unlockKm: number;
}

export interface TeamRank {
  id: string;
  name: string;
  members: number;
  distanceKm: number;
  trend: string;
}

export interface SeasonProfile {
  name: string;
  routeLabel: string;
  memberCount: number;
  activeTeams: number;
  shareCount: number;
}

export interface RunRecord {
  date: string;
  distanceKm: number;
  source: 'manual-demo';
}

export interface DemoState {
  selectedRouteId: string;
  records: RunRecord[];
  lastCoachText: string;
  lastUnlockedNodeIds: string[];
  coachStatus: 'local' | 'remote' | 'pending' | 'error';
  coachProvider: string;
  coachModel?: string;
  coachError?: string;
  lastRunDistanceKm: number;
  lastRunBeforeKm: number;
  lastRunAfterKm: number;
  shareCardVersion: number;
}

export interface CoachContext {
  route: SeasonRoute;
  todayDistance: number;
  totalDistance: number;
  streakDays: number;
  progressPercent: number;
  unlockedNodes: RouteNode[];
  newlyUnlockedNodes: RouteNode[];
}

export interface CoachApiPayload {
  routeTitle: string;
  todayDistance: number;
  totalDistance: number;
  streakDays: number;
  progressPercent: number;
  currentNode: string;
  newlyUnlockedNodes: string[];
  distanceToNextNode: number;
  fallbackText: string;
}

export interface CoachApiResult {
  text: string;
  source: 'remote' | 'local';
  provider: 'zhipu' | 'deepseek' | 'qwen' | 'local';
  model: string;
  tone?: string;
  shareReady?: boolean;
  error?: string;
}

export interface CommunityParticipant {
  id: string;
  displayName: string;
  city: string;
  teamId: string;
  totalDistanceKm: number;
  streakDays: number;
  submissions: number;
  shareCards: number;
  lastSubmitDaysAgo: number;
  couponTriggered: boolean;
}

export interface CommunityTeam {
  id: string;
  name: string;
  city: string;
  members: number;
  totalDistanceKm: number;
  activeRate: number;
  shareCards: number;
}

export interface CommunityMetrics {
  totalParticipants: number;
  activeToday: number;
  active7d: number;
  activeRate: number;
  totalDistanceKm: number;
  averageDistanceKm: number;
  finishers: number;
  projectedFinishers: number;
  completionRate: number;
  shareCards: number;
  couponTriggered: number;
  needsWakeup: number;
}

export interface CommunityRunnerStats {
  overallRank: number;
  overallTotal: number;
  teamRank: number;
  teamMembers: number;
  teamName: string;
  teamCity: string;
  teamTotalDistanceKm: number;
  communityPercentile: number;
}

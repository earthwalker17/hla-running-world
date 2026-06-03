import type {
  CommunityMetrics,
  CommunityParticipant,
  CommunityRunnerStats,
  CommunityTeam,
} from '../types';
import { roundKm } from '../services/progress';

const cities = ['江阴', '无锡', '南京', '苏州', '常州', '镇江', '徐州', '连云港'];
const teamNames = [
  '澜跑研习社 A 队',
  '江阴晨跑团',
  '锡马训练营',
  '海澜员工跑团',
  '飞马水城夜跑队',
  '新桥绿道团',
  '无锡湖湾跑团',
  '南京周三轻跑',
  '苏州城市探索队',
  '常州补给站',
  '镇江江岸跑团',
  '徐州挑战组',
  '连云港海风队',
  '江阴亲友团',
];

function seededRandom(seed: number): number {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

function createTeam(index: number): CommunityTeam {
  const nameSeed = teamNames[index % teamNames.length];
  const suffix = index >= teamNames.length ? ` ${Math.floor(index / teamNames.length) + 1}` : '';
  return {
    id: `team-${String(index + 1).padStart(2, '0')}`,
    name: `${nameSeed}${suffix}`,
    city: cities[index % cities.length],
    members: 0,
    totalDistanceKm: 0,
    activeRate: 0,
    shareCards: 0,
  };
}

export function createCommunityParticipants(count = 1000, teamCount = 42): CommunityParticipant[] {
  return Array.from({ length: count }, (_, index) => {
    const serial = index + 1;
    const activity = seededRandom(serial);
    const consistency = seededRandom(serial + 17);
    const teamIndex = Math.floor(seededRandom(serial + 29) * teamCount);
    const submissions = Math.max(1, Math.round(4 + consistency * 19 + activity * 6));
    const streakDays = Math.min(18, Math.max(0, Math.round(consistency * 9 + seededRandom(serial + 41) * 4)));
    const baseDistance = 6 + activity * 46 + streakDays * 1.2 + submissions * 0.45;
    const lastSubmitDaysAgo = Math.floor(Math.pow(seededRandom(serial + 71), 1.8) * 15);
    const totalDistanceKm = roundKm(baseDistance);
    const shareCards = Math.max(0, Math.round(seededRandom(serial + 53) * 5 + (totalDistanceKm >= 42.8 ? 2 : 0)));
    const city = cities[Math.floor(seededRandom(serial + 11) * cities.length)];

    return {
      id: `runner-${String(serial).padStart(4, '0')}`,
      displayName: `${city}跑友 ${String(serial).padStart(3, '0')}`,
      city,
      teamId: `team-${String(teamIndex + 1).padStart(2, '0')}`,
      totalDistanceKm,
      streakDays,
      submissions,
      shareCards,
      lastSubmitDaysAgo,
      couponTriggered: totalDistanceKm >= 24.4,
    };
  });
}

export function createCommunityTeams(
  participants: CommunityParticipant[],
  teamCount = 42,
): CommunityTeam[] {
  const teams = Array.from({ length: teamCount }, (_, index) => createTeam(index));

  participants.forEach((participant) => {
    const team = teams.find((item) => item.id === participant.teamId);
    if (!team) return;
    team.members += 1;
    team.totalDistanceKm = roundKm(team.totalDistanceKm + participant.totalDistanceKm);
    team.shareCards += participant.shareCards;
  });

  return teams.map((team) => {
    const activeMembers = participants.filter(
      (participant) => participant.teamId === team.id && participant.lastSubmitDaysAgo <= 6,
    ).length;
    return {
      ...team,
      activeRate: team.members > 0 ? activeMembers / team.members : 0,
    };
  });
}

export function getCommunityMetrics(
  participants: CommunityParticipant[],
  routeDistanceKm = 42.8,
): CommunityMetrics {
  const totalParticipants = participants.length;
  const activeToday = participants.filter((participant) => participant.lastSubmitDaysAgo === 0).length;
  const active7d = participants.filter((participant) => participant.lastSubmitDaysAgo <= 6).length;
  const totalDistanceKm = roundKm(
    participants.reduce((sum, participant) => sum + participant.totalDistanceKm, 0),
  );
  const finishers = participants.filter((participant) => participant.totalDistanceKm >= routeDistanceKm).length;
  const projectedFinishers = participants.filter(
    (participant) =>
      participant.totalDistanceKm >= routeDistanceKm * 0.72 || participant.streakDays >= 7,
  ).length;
  const shareCards = participants.reduce((sum, participant) => sum + participant.shareCards, 0);
  const couponTriggered = participants.filter((participant) => participant.couponTriggered).length;
  const needsWakeup = participants.filter(
    (participant) => participant.lastSubmitDaysAgo >= 7 || participant.totalDistanceKm < 12,
  ).length;

  return {
    totalParticipants,
    activeToday,
    active7d,
    activeRate: totalParticipants > 0 ? active7d / totalParticipants : 0,
    totalDistanceKm,
    averageDistanceKm: totalParticipants > 0 ? roundKm(totalDistanceKm / totalParticipants) : 0,
    finishers,
    projectedFinishers,
    completionRate: totalParticipants > 0 ? finishers / totalParticipants : 0,
    shareCards,
    couponTriggered,
    needsWakeup,
  };
}

export const communityParticipants = createCommunityParticipants();
export const communityTeams = createCommunityTeams(communityParticipants);
export const communityMetrics = getCommunityMetrics(communityParticipants);
export const topCommunityTeams = [...communityTeams]
  .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm)
  .slice(0, 6);

export const currentRunner: CommunityParticipant = {
  id: 'runner-current',
  displayName: '林若舟',
  city: '江阴',
  teamId: 'team-01',
  totalDistanceKm: 37.6,
  streakDays: 8,
  submissions: 14,
  shareCards: 3,
  lastSubmitDaysAgo: 0,
  couponTriggered: true,
};

function getRunnerRank(
  runner: CommunityParticipant,
  participants: CommunityParticipant[],
): number {
  return participants.filter((participant) => participant.totalDistanceKm > runner.totalDistanceKm).length + 1;
}

export function getCommunityRunnerStats(
  runner: CommunityParticipant,
  participants: CommunityParticipant[],
  teams: CommunityTeam[],
): CommunityRunnerStats {
  const team = teams.find((item) => item.id === runner.teamId) ?? teams[0];
  const sameTeamParticipants = participants.filter((participant) => participant.teamId === runner.teamId);
  const overallRank = getRunnerRank(runner, participants);
  const teamRank = getRunnerRank(runner, sameTeamParticipants);
  const overallTotal = participants.length + 1;
  const teamMembers = sameTeamParticipants.length + 1;

  return {
    overallRank,
    overallTotal,
    teamRank,
    teamMembers,
    teamName: team.name,
    teamCity: team.city,
    teamTotalDistanceKm: roundKm(team.totalDistanceKm + runner.totalDistanceKm),
    communityPercentile: Math.round(((overallTotal - overallRank + 1) / overallTotal) * 100),
  };
}

export const currentRunnerStats = getCommunityRunnerStats(
  currentRunner,
  communityParticipants,
  communityTeams,
);

export const wakeupSegments = [
  {
    id: 'newcomer',
    title: '新手待推进',
    count: communityParticipants.filter((participant) => participant.totalDistanceKm < 12).length,
    hint: '适合推送 5 km 轻量任务',
  },
  {
    id: 'inactive',
    title: '7 天未提交',
    count: communityParticipants.filter((participant) => participant.lastSubmitDaysAgo >= 7).length,
    hint: '适合跑团群提醒和权益召回',
  },
  {
    id: 'near-finish',
    title: '临近完赛',
    count: communityParticipants.filter(
      (participant) => participant.totalDistanceKm >= 34 && participant.totalDistanceKm < 42.8,
    ).length,
    hint: '适合触发完赛卡和装备券提示',
  },
];

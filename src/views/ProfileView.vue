<template>
  <div class="screen">
    <header class="compact-header">
      <div>
        <span class="eyebrow">Runner Profile</span>
        <h1>我的赛季</h1>
      </div>
      <RouterLink class="icon-button" to="/route" aria-label="查看真实路线">
        <Map :size="19" />
      </RouterLink>
    </header>

    <section class="profile-hero">
      <div class="profile-avatar">{{ runnerInitial }}</div>
      <div class="profile-copy">
        <span>{{ profileRunner.city }} · {{ runnerStats.teamName }}</span>
        <h2>{{ profileRunner.displayName }}</h2>
        <p>{{ activeRoute.title }} · 已抵达 {{ currentNode.name }}</p>
      </div>
      <Medal :size="32" />
    </section>

    <section class="profile-kpi-grid" aria-label="个人赛季数据">
      <MetricTile label="累计跑量" :value="`${totalDistance.toFixed(1)} km`" />
      <MetricTile label="连续训练" :value="`${streakDays} 天`" />
      <MetricTile label="全体排名" :value="`#${runnerStats.overallRank}`" />
      <MetricTile label="跑团排名" :value="`#${runnerStats.teamRank}`" />
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>赛季进度</h2>
        <span>{{ Math.round(progressPercent) }}% 完成</span>
      </div>
      <div class="profile-progress">
        <div class="profile-progress-head">
          <strong>{{ totalDistance.toFixed(1) }} / {{ activeRoute.distanceKm.toFixed(1) }} km</strong>
          <span>距下一节点 {{ distanceToNextNode.toFixed(1) }} km</span>
        </div>
        <div class="profile-progress-bar">
          <span :style="{ width: `${Math.round(progressPercent)}%` }"></span>
        </div>
        <p>{{ currentNode.story }}</p>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>徽章与权益</h2>
        <span>{{ unlockedRewardCount }} / {{ routeRewards.length }}</span>
      </div>
      <div class="reward-list">
        <article
          v-for="reward in routeRewards"
          :key="reward.id"
          class="reward-item"
          :class="{ unlocked: reward.unlocked }"
        >
          <div>
            <Award :size="18" />
            <strong>{{ reward.title }}</strong>
          </div>
          <span>{{ reward.unlocked ? '已解锁' : `${reward.unlockKm} km 解锁` }}</span>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>整体排行</h2>
        <span>{{ runnerStats.overallTotal.toLocaleString('zh-CN') }} 名跑者</span>
      </div>
      <div class="rank-list">
        <div
          v-for="row in runnerLeaderboard"
          :key="row.id"
          class="rank-row"
          :class="{ current: row.id === profileRunner.id }"
        >
          <span>{{ getRunnerRankLabel(row.id) }}</span>
          <div>
            <strong>{{ row.displayName }}</strong>
            <small>{{ row.city }} · 连续 {{ row.streakDays }} 天 · {{ row.shareCards }} 张卡</small>
          </div>
          <b>{{ row.totalDistanceKm.toFixed(1) }}</b>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>跑团排行</h2>
        <span>今日更新</span>
      </div>
      <div class="rank-list">
        <div v-for="(team, index) in topCommunityTeams" :key="team.id" class="rank-row">
          <span>{{ index + 1 }}</span>
          <div>
            <strong>{{ team.name }}</strong>
            <small>{{ team.city }} · {{ team.members }} 人 · 活跃 {{ Math.round(team.activeRate * 100) }}%</small>
          </div>
          <b>{{ team.totalDistanceKm.toFixed(1) }}</b>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Award, Map, Medal } from 'lucide-vue-next';
import MetricTile from '../components/MetricTile.vue';
import {
  communityParticipants,
  communityTeams,
  getCommunityRunnerStats,
  topCommunityTeams,
} from '../data/community';
import { useSeasonStore } from '../state/seasonStore';

const store = useSeasonStore();
const activeRoute = computed(() => store.activeRoute.value);
const currentNode = store.currentNode;
const totalDistance = store.totalDistance;
const progressPercent = store.progressPercent;
const distanceToNextNode = store.distanceToNextNode;
const streakDays = store.streakDays;

const profileRunner = computed(() => ({
  id: store.visitorProfile.visitorId,
  displayName: store.visitorProfile.displayName,
  city: store.visitorProfile.city,
  teamId: store.visitorProfile.teamId,
  totalDistanceKm: totalDistance.value,
  streakDays: streakDays.value,
  submissions: store.state.records.length,
  shareCards: Math.max(0, store.state.shareCardVersion),
  lastSubmitDaysAgo: 0,
  couponTriggered: totalDistance.value >= 24.4,
}));

const runnerStats = computed(() =>
  getCommunityRunnerStats(profileRunner.value, communityParticipants, communityTeams),
);

const runnerInitial = computed(() => profileRunner.value.displayName.slice(0, 1));

const routeRewards = computed(() =>
  activeRoute.value.rewards.map((reward) => ({
    ...reward,
    unlocked: totalDistance.value >= reward.unlockKm,
  })),
);

const unlockedRewardCount = computed(
  () => routeRewards.value.filter((reward) => reward.unlocked).length,
);

const topRunners = computed(() =>
  [...communityParticipants]
    .sort((a, b) => b.totalDistanceKm - a.totalDistanceKm)
    .slice(0, 4),
);

const runnerLeaderboard = computed(() => [...topRunners.value, profileRunner.value]);

function getRunnerRankLabel(runnerId: string): string {
  if (runnerId === profileRunner.value.id) {
    return String(runnerStats.value.overallRank);
  }

  const row = communityParticipants.find((participant) => participant.id === runnerId);
  if (!row) {
    return '-';
  }

  return String(
    communityParticipants.filter(
      (participant) => participant.totalDistanceKm > row.totalDistanceKm,
    ).length + 1,
  );
}
</script>

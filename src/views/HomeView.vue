<template>
  <div class="screen">
    <header class="app-header">
      <div>
        <span class="brand-mark">HLA RW</span>
        <h1>{{ seasonProfile.name }}</h1>
        <p>{{ seasonProfile.routeLabel }}</p>
      </div>
      <div class="header-actions">
        <button class="icon-button" type="button" aria-label="切换到路演演示状态" @click="store.resetRoadshowPreset">
          <Sparkles :size="19" />
        </button>
        <button class="icon-button" type="button" aria-label="重置演示数据" @click="store.resetDemo">
          <RotateCcw :size="19" />
        </button>
      </div>
    </header>

    <section class="season-hero">
      <div class="hero-copy">
        <span class="eyebrow">30 天品牌数字远征</span>
        <h2>把真实跑步，推进成一条江苏路线。</h2>
        <div class="hero-actions">
          <RouterLink class="primary-action" to="/run">
            <PenLine :size="18" />
            记录今日跑量
          </RouterLink>
          <RouterLink class="ghost-action" to="/route">
            <Map :size="18" />
            查看路线
          </RouterLink>
        </div>
      </div>
      <ProgressRing :percent="progressPercent" />
    </section>

    <section class="metrics-grid" aria-label="赛季数据">
      <MetricTile label="累计跑量" :value="`${totalDistance.toFixed(1)} km`" />
      <MetricTile label="社区跑者" :value="communityMetrics.totalParticipants.toLocaleString('zh-CN')" />
      <MetricTile label="7 日活跃" :value="`${Math.round(communityMetrics.activeRate * 100)}%`" />
      <MetricTile label="分享卡" :value="`${communityMetrics.shareCards.toLocaleString('zh-CN')} 张`" />
    </section>

    <RouterLink class="profile-cta" to="/profile">
      <div>
        <span>Runner Profile</span>
        <strong>我的赛季与跑团排行</strong>
      </div>
      <ChevronRight :size="18" />
    </RouterLink>

    <section class="section-block">
      <div class="section-title">
        <h2>路线选择</h2>
        <span>{{ activeRoute.durationDays }} 天</span>
      </div>
      <div class="route-list">
        <button
          v-for="route in routes"
          :key="route.id"
          class="route-card"
          :class="{ selected: route.id === activeRoute.id }"
          type="button"
          @click="selectRoute(route.id)"
        >
          <div class="route-card-main">
            <span :style="{ backgroundColor: route.accent }"></span>
            <div>
              <strong>{{ route.title }}</strong>
              <small>{{ route.subtitle }}</small>
            </div>
          </div>
          <div class="route-card-meta">
            <b>{{ formatDistanceKm(route.distanceKm) }} km</b>
          </div>
        </button>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>跑团榜</h2>
        <span>今日更新</span>
      </div>
      <div class="rank-list">
        <div v-for="(team, index) in topCommunityTeams.slice(0, 3)" :key="team.id" class="rank-row">
          <span>{{ index + 1 }}</span>
          <div>
            <strong>{{ team.name }}</strong>
            <small>{{ team.members }} 人 · 活跃 {{ Math.round(team.activeRate * 100) }}%</small>
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
import { ChevronRight, Map, PenLine, RotateCcw, Sparkles } from 'lucide-vue-next';
import MetricTile from '../components/MetricTile.vue';
import ProgressRing from '../components/ProgressRing.vue';
import { seasonProfile } from '../data/season';
import { communityMetrics, topCommunityTeams } from '../data/community';
import { useSeasonStore } from '../state/seasonStore';

const store = useSeasonStore();
const routes = store.routes;
const activeRoute = computed(() => store.activeRoute.value);
const progressPercent = store.progressPercent;
const totalDistance = store.totalDistance;

function selectRoute(routeId: string) {
  store.selectRoute(routeId);
}

function formatDistanceKm(distanceKm: number): string {
  return Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1);
}
</script>

<template>
  <div class="screen">
    <header class="compact-header">
      <div>
        <span class="eyebrow">Route Gallery</span>
        <h1>三条品牌路线</h1>
      </div>
      <RouterLink class="icon-button" to="/run" aria-label="记录跑量">
        <PenLine :size="19" />
      </RouterLink>
    </header>

    <section class="route-gallery">
      <article
        v-for="route in routes"
        :key="route.id"
        class="route-overview-card"
        :class="{ selected: route.id === activeRoute.id }"
      >
        <RouteMap
          :route="route"
          :total-distance="totalDistance"
          :progress-percent="getRouteProgress(route)"
          compact
          @route-measured="store.setRouteMeasurement"
        />
        <div class="route-overview-copy">
          <div>
            <span>{{ route.durationDays }} 天 · {{ formatDistanceKm(route.distanceKm) }} km</span>
            <strong>{{ route.title }}</strong>
            <p>{{ route.summary }}</p>
          </div>
          <button class="route-start-button" type="button" @click="selectAndRun(route.id)">
            <Navigation :size="17" />
            跑这条线
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Navigation, PenLine } from 'lucide-vue-next';
import RouteMap from '../components/RouteMap.vue';
import { useSeasonStore } from '../state/seasonStore';
import type { SeasonRoute } from '../types';
import { getProgressPercent } from '../services/progress';

const router = useRouter();
const store = useSeasonStore();
const routes = store.routes;
const activeRoute = computed(() => store.activeRoute.value);
const totalDistance = store.totalDistance;

function getRouteProgress(route: SeasonRoute): number {
  return getProgressPercent(totalDistance.value, route.distanceKm);
}

function formatDistanceKm(distanceKm: number): string {
  return Number.isInteger(distanceKm) ? String(distanceKm) : distanceKm.toFixed(1);
}

function selectAndRun(routeId: string) {
  store.selectRoute(routeId);
  void router.push('/run');
}
</script>

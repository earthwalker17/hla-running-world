<template>
  <section
    class="route-map-panel"
    :class="{ compact }"
    :style="{ '--route-accent': route.accent }"
  >
    <div v-if="showHeader" class="map-topline">
      <div>
        <span class="eyebrow">Digital Route</span>
        <h2>{{ route.title }}</h2>
      </div>
      <strong>{{ Math.round(progressPercent) }}%</strong>
    </div>

    <div class="map-viewport" :class="{ real: isRealMapActive }">
      <div v-show="isRealMapActive" ref="mapContainer" class="amap-canvas" />
      <div class="map-mode-pill" :class="mapStatus">{{ mapModeLabel }}</div>

      <svg
        v-if="!isRealMapActive"
        class="route-map"
        viewBox="0 0 520 310"
        role="img"
        :aria-label="route.title"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ef4f2f" />
            <stop offset="52%" stop-color="#ffb000" />
            <stop offset="100%" stop-color="#208f73" />
          </linearGradient>
        </defs>

        <path class="province-shape" d="M68 240 C84 152 142 86 228 70 C298 56 374 84 438 130 C476 158 494 214 454 246 C392 296 272 282 186 268 C136 260 94 260 68 240 Z" />
        <polyline class="route-line-bg" :points="polylinePoints" pathLength="520" />
        <polyline
          class="route-line-active"
          :points="polylinePoints"
          pathLength="520"
          :stroke="`url(#${gradientId})`"
          :style="{ strokeDashoffset }"
        />
        <polyline
          v-if="deltaPolylinePoints"
          class="route-line-delta"
          :points="deltaPolylinePoints"
          pathLength="160"
        />

        <g v-for="node in nodeMarkers" :key="node.id" class="node-marker">
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="node.unlocked ? 11 : 8"
            :class="{ unlocked: node.unlocked, current: node.current }"
          />
          <text :x="node.x" :y="node.y - 19">{{ node.mapLabel ?? node.city }}</text>
        </g>

        <g
          class="avatar"
          :class="{ pulse: shouldAnimateDelta }"
          :transform="`translate(${avatarPoint.x} ${avatarPoint.y})`"
        >
          <circle r="18" />
          <path d="M-6 3 L0 -9 L7 3 L1 1 L1 10 L-2 10 L-2 1 Z" />
        </g>
      </svg>
    </div>

    <div v-if="showStatus" class="map-status">
      <span>当前位置</span>
      <strong>{{ currentNode.name }}</strong>
      <small v-if="lastRunDistance > 0">本次 +{{ lastRunDistance.toFixed(1) }} km</small>
      <small v-else-if="distanceToNextNode > 0">下一站 {{ distanceToNextNode.toFixed(1) }} km</small>
      <small v-else>路线已完成</small>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { SeasonRoute } from '../types';
import type { AMapNamespace } from '../services/amapLoader';
import { loadAmap } from '../services/amapLoader';
import { localMapProvider } from '../services/mapProvider';
import {
  getCurrentNode,
  getDistanceToNextNode,
  getProgressPercent,
  getUnlockedNodes,
} from '../services/progress';

const props = withDefaults(
  defineProps<{
    route: SeasonRoute;
    totalDistance: number;
    progressPercent: number;
    showHeader?: boolean;
    showStatus?: boolean;
    compact?: boolean;
    highlightFromDistance?: number;
    lastRunDistance?: number;
    animationKey?: number | string;
  }>(),
  {
    showHeader: true,
    showStatus: true,
    compact: false,
    highlightFromDistance: 0,
    lastRunDistance: 0,
    animationKey: 0,
  },
);

const gradientId = computed(() => `routeGradient-${props.route.id}`);
const polylinePoints = computed(() => props.route.points.map((point) => `${point.x},${point.y}`).join(' '));
const avatarPoint = computed(() => localMapProvider.getAvatarPoint(props.route, props.progressPercent));
const currentNode = computed(() => getCurrentNode(props.route, props.totalDistance));
const unlockedNodes = computed(() => getUnlockedNodes(props.route, props.totalDistance));
const distanceToNextNode = computed(() => getDistanceToNextNode(props.route, props.totalDistance));
const strokeDashoffset = computed(() => `${520 - (Math.min(100, props.progressPercent) / 100) * 520}`);
const deltaStartPercent = computed(() =>
  getProgressPercent(Math.max(0, props.highlightFromDistance), props.route.distanceKm),
);
const shouldAnimateDelta = computed(
  () => props.lastRunDistance > 0 && props.highlightFromDistance < props.totalDistance,
);
const deltaPolylinePoints = computed(() => {
  if (!shouldAnimateDelta.value) return '';
  return localMapProvider
    .getRoutePointsBetween(props.route, deltaStartPercent.value, props.progressPercent)
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
});
const mapContainer = ref<HTMLDivElement | null>(null);
const mapStatus = ref<'loading' | 'ready' | 'missing-key' | 'error'>('loading');
const isRealMapActive = ref(false);
const amapRef = shallowRef<AMapNamespace | null>(null);
const mapRef = shallowRef<unknown | null>(null);
let overlays: unknown[] = [];

const mapModeLabel = computed(() => {
  if (mapStatus.value === 'ready') return '真实地图';
  if (mapStatus.value === 'loading') return '地图加载中';
  if (mapStatus.value === 'missing-key') return '本地兜底 · 待配置高德 Key';
  return '本地兜底 · 地图加载失败';
});

const nodeMarkers = computed(() =>
  props.route.nodes.map((node) => {
    const point = localMapProvider.getNodePoint(props.route, node);
    return {
      ...node,
      x: point.x,
      y: point.y,
      unlocked: unlockedNodes.value.some((unlocked) => unlocked.id === node.id),
      current: currentNode.value.id === node.id,
    };
  }),
);

function toLngLat(amap: AMapNamespace, point: { lng: number; lat: number }) {
  return new amap.LngLat(point.lng, point.lat);
}

function clearOverlays() {
  const map = mapRef.value as { remove?: (items: unknown[]) => void } | null;
  if (map && overlays.length > 0) {
    map.remove?.(overlays);
    overlays = [];
  }
}

function fitRouteToView(routeLine: unknown) {
  const map = mapRef.value as {
    resize?: () => void;
    setFitView?: (items: unknown[], immediately?: boolean, padding?: number[]) => void;
  } | null;
  if (!map) return;

  window.setTimeout(() => {
    map.resize?.();
    map.setFitView?.([routeLine], false, props.compact ? [8, 8, 8, 8] : [14, 14, 14, 14]);
  }, 80);
}

function updateRealMap() {
  const amap = amapRef.value;
  const map = mapRef.value as {
    add?: (items: unknown[]) => void;
  } | null;
  if (!amap || !map) return;

  clearOverlays();

  const fullPath = props.route.map.path.map((point) => toLngLat(amap, point));
  const completedPath = localMapProvider
    .getCompletedGeoPath(props.route, props.progressPercent)
    .map((point) => toLngLat(amap, point));
  const deltaPath = shouldAnimateDelta.value
    ? localMapProvider
        .getGeoPathBetween(props.route, deltaStartPercent.value, props.progressPercent)
        .map((point) => toLngLat(amap, point))
    : [];
  const routeLine = new amap.Polyline({
    path: fullPath,
    strokeColor: '#c9c4b8',
    strokeOpacity: 0.88,
    strokeWeight: props.compact ? 8 : 10,
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 18,
  });

  overlays = [
    routeLine,
    new amap.Polyline({
      path: completedPath,
      strokeColor: props.route.accent,
      strokeOpacity: 0.98,
      strokeWeight: props.compact ? 5 : 7,
      lineJoin: 'round',
      lineCap: 'round',
      zIndex: 28,
    }),
  ];

  if (deltaPath.length >= 2) {
    overlays.push(
      new amap.Polyline({
        path: deltaPath,
        strokeColor: '#ffb000',
        strokeOpacity: 1,
        strokeWeight: props.compact ? 7 : 9,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 42,
      }),
    );
  }

  props.route.nodes.forEach((node) => {
    const unlocked = unlockedNodes.value.some((unlockedNode) => unlockedNode.id === node.id);
    const current = currentNode.value.id === node.id;
    overlays.push(
      new amap.Marker({
        position: toLngLat(amap, localMapProvider.getNodeGeoPoint(props.route, node)),
        content: `<div class="amap-node-marker ${unlocked ? 'unlocked' : ''} ${current ? 'current' : ''}"><span>${node.mapLabel ?? node.city}</span></div>`,
        offset: new amap.Pixel(-18, -18),
        zIndex: current ? 80 : 52,
      }),
    );
  });

  const avatar = localMapProvider.getAvatarGeoPoint(props.route, props.progressPercent);
  overlays.push(
    new amap.Marker({
      position: toLngLat(amap, avatar),
      content: `<div class="amap-avatar-marker ${shouldAnimateDelta.value ? 'pulse' : ''}"><span></span></div>`,
      offset: new amap.Pixel(-20, -20),
      zIndex: 100,
    }),
  );

  map.add?.(overlays);
  fitRouteToView(routeLine);
}

async function initRealMap() {
  await nextTick();
  if (!mapContainer.value) return;

  try {
    const amap = await loadAmap();
    if (!amap) {
      mapStatus.value = 'missing-key';
      return;
    }

    amapRef.value = amap;
    mapRef.value = new amap.Map(mapContainer.value, {
      center: toLngLat(amap, props.route.map.center),
      zoom: props.route.map.zoom,
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke',
      resizeEnable: true,
      dragEnable: true,
      zoomEnable: true,
      jogEnable: false,
      pitchEnable: false,
    });
    isRealMapActive.value = true;
    mapStatus.value = 'ready';
    updateRealMap();
  } catch {
    mapStatus.value = 'error';
    isRealMapActive.value = false;
  }
}

onMounted(() => {
  void initRealMap();
});

onBeforeUnmount(() => {
  clearOverlays();
  const map = mapRef.value as { destroy?: () => void } | null;
  map?.destroy?.();
});

watch(
  () => [
    props.route.id,
    props.totalDistance,
    props.progressPercent,
    props.highlightFromDistance,
    props.lastRunDistance,
    props.animationKey,
  ],
  () => updateRealMap(),
);
</script>

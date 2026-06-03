<template>
  <div class="screen">
    <header class="compact-header">
      <div>
        <span class="eyebrow">Share Card</span>
        <h1>个人赛季卡</h1>
      </div>
      <button class="icon-button" type="button" aria-label="重新绘制分享卡" @click="drawCard">
        <RefreshCw :size="18" />
      </button>
    </header>

    <section class="share-canvas-wrap">
      <canvas ref="canvasRef" width="900" height="1200" aria-label="HLA Running World 分享卡"></canvas>
    </section>

    <section class="share-actions">
      <button class="primary-action" type="button" @click="downloadCard">
        <Download :size="18" />
        保存卡片
      </button>
      <RouterLink class="ghost-action" to="/run">
        <PenLine :size="18" />
        再跑一次
      </RouterLink>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>传播信息</h2>
        <span>路演样张</span>
      </div>
      <div class="share-copy">
        <strong>{{ profileRunner.displayName }} · {{ route.title }}</strong>
        <p>
          {{ runnerStats.teamName }}，累计 {{ totalDistance.toFixed(1) }} km，
          全体排名 #{{ runnerStats.overallRank }}。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Download, PenLine, RefreshCw } from 'lucide-vue-next';
import {
  communityParticipants,
  communityTeams,
  currentRunner,
  getCommunityRunnerStats,
} from '../data/community';
import { seasonProfile } from '../data/season';
import { useSeasonStore } from '../state/seasonStore';
import { loadAmap } from '../services/amapLoader';
import { localMapProvider } from '../services/mapProvider';
import { planRoadRoute } from '../services/roadRoutePlanner';

interface MapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GeoBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

interface StaticMapView {
  center: {
    lng: number;
    lat: number;
  };
  zoom: number;
  bounds: GeoBounds;
}

const store = useSeasonStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const route = computed(() => store.activeRoute.value);
const currentNode = store.currentNode;
const totalDistance = store.totalDistance;
const profileRunner = computed(() => ({
  ...currentRunner,
  totalDistanceKm: totalDistance.value,
  streakDays: store.streakDays.value,
  submissions: store.state.records.length,
  shareCards: currentRunner.shareCards + Math.max(0, store.state.shareCardVersion),
  couponTriggered: totalDistance.value >= 24.4,
}));
const runnerStats = computed(() =>
  getCommunityRunnerStats(profileRunner.value, communityParticipants, communityTeams),
);
let measuredRouteId = '';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getGeoBounds(points: Array<{ lng: number; lat: number }>): GeoBounds {
  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngPadding = Math.max(0.02, (maxLng - minLng) * 0.16);
  const latPadding = Math.max(0.02, (maxLat - minLat) * 0.16);
  return {
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
  };
}

function toMercator(point: { lng: number; lat: number }) {
  const sinLat = Math.sin((clamp(point.lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  return {
    x: (point.lng + 180) / 360,
    y: 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI),
  };
}

function fromMercator(point: { x: number; y: number }) {
  return {
    lng: point.x * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y))) * 180) / Math.PI,
  };
}

function getMercatorBounds(bounds: GeoBounds) {
  const corners = [
    { lng: bounds.minLng, lat: bounds.minLat },
    { lng: bounds.minLng, lat: bounds.maxLat },
    { lng: bounds.maxLng, lat: bounds.minLat },
    { lng: bounds.maxLng, lat: bounds.maxLat },
  ].map((point) => toMercator(point));

  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function getStaticMapView(bounds: GeoBounds, box: MapBox): StaticMapView {
  const tileSize = 256;
  const mercatorBounds = getMercatorBounds(bounds);
  const spanX = Math.max(mercatorBounds.maxX - mercatorBounds.minX, 0.000001);
  const spanY = Math.max(mercatorBounds.maxY - mercatorBounds.minY, 0.000001);
  const zoomX = Math.log2(box.width / (tileSize * spanX));
  const zoomY = Math.log2(box.height / (tileSize * spanY));
  const zoom = clamp(Math.floor(Math.min(zoomX, zoomY)), 4, 17);
  const center = fromMercator({
    x: (mercatorBounds.minX + mercatorBounds.maxX) / 2,
    y: (mercatorBounds.minY + mercatorBounds.maxY) / 2,
  });

  return {
    center,
    zoom,
    bounds,
  };
}

function projectMercatorPoint(point: { lng: number; lat: number }, view: StaticMapView, box: MapBox) {
  const scale = 256 * 2 ** view.zoom;
  const center = toMercator(view.center);
  const projected = toMercator(point);

  return {
    x: box.x + box.width / 2 + (projected.x - center.x) * scale,
    y: box.y + box.height / 2 + (projected.y - center.y) * scale,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('map image failed'));
    image.src = src;
  });
}

async function ensureRouteMeasurement() {
  if (measuredRouteId === route.value.id) {
    return;
  }

  measuredRouteId = route.value.id;

  try {
    const amap = await loadAmap();
    if (!amap) {
      return;
    }

    const plan = await planRoadRoute(amap, route.value);
    if (plan) {
      store.setRouteMeasurement(plan);
      await nextTick();
    }
  } catch {
    // Share card keeps the local route fallback if dynamic route planning is unavailable.
  }
}

function sampleStaticPath(points: Array<{ lng: number; lat: number }>, maxPoints = 80) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)]);
}

function getStaticMapPathParam(points: Array<{ lng: number; lat: number }>): string {
  return sampleStaticPath(points)
    .map((point) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`)
    .join(';');
}

function getShareMapView(box: MapBox): StaticMapView {
  const avatar = localMapProvider.getAvatarGeoPoint(route.value, store.progressPercent.value);
  const bounds = getGeoBounds([
    ...route.value.map.path,
    ...route.value.nodes.map((node) => node.coord),
    avatar,
  ]);

  return getStaticMapView(bounds, box);
}

function drawMapPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ lng: number; lat: number }>,
  view: StaticMapView,
  box: MapBox,
  options: {
    color: string;
    width: number;
    opacity?: number;
  },
) {
  if (points.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = options.opacity ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.width;
  ctx.beginPath();
  points.forEach((point, index) => {
    const projected = projectMercatorPoint(point, view, box);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.stroke();
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let output = text;
  while (output.length > 2 && ctx.measureText(`${output.slice(0, -1)}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }

  return `${output.slice(0, -1)}...`;
}

function drawNodeLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  point: { x: number; y: number },
  box: MapBox,
  offset: { x: number; y: number },
  active: boolean,
) {
  ctx.font = '800 19px "Microsoft YaHei", Arial, sans-serif';
  const maxTextWidth = 178;
  const label = fitText(ctx, text, maxTextWidth);
  const textWidth = ctx.measureText(label).width;
  const labelWidth = textWidth + 22;
  const labelHeight = 32;
  const x = clamp(point.x + offset.x - labelWidth / 2, box.x + 10, box.x + box.width - labelWidth - 10);
  const preferredY = point.y + offset.y;
  const y = clamp(preferredY, box.y + 10, box.y + box.height - labelHeight - 10);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 7;
  drawRoundedRect(ctx, x, y, labelWidth, labelHeight, 12);
  ctx.fillStyle = active ? '#111111' : 'rgba(255, 255, 255, 0.94)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = active ? '#ffffff' : '#161616';
  ctx.fillText(label, x + 11, y + 22);
  ctx.restore();
}

function drawRunnerMarker(ctx: CanvasRenderingContext2D, point: { x: number; y: number }) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffb000';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(point.x - 8, point.y + 5);
  ctx.lineTo(point.x, point.y - 12);
  ctx.lineTo(point.x + 10, point.y + 5);
  ctx.lineTo(point.x + 2, point.y + 2);
  ctx.lineTo(point.x + 2, point.y + 14);
  ctx.lineTo(point.x - 3, point.y + 14);
  ctx.lineTo(point.x - 3, point.y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMapProgressChip(ctx: CanvasRenderingContext2D, box: MapBox) {
  const progressText = `${totalDistance.value.toFixed(1)} / ${route.value.distanceKm.toFixed(1)} km · ${Math.round(store.progressPercent.value)}%`;
  ctx.font = '800 20px "Microsoft YaHei", Arial, sans-serif';
  const width = ctx.measureText(progressText).width + 28;
  const x = box.x + 18;
  const y = box.y + box.height - 48;

  ctx.save();
  drawRoundedRect(ctx, x, y, width, 34, 13);
  ctx.fillStyle = 'rgba(17, 17, 17, 0.82)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(progressText, x + 14, y + 23);
  ctx.restore();
}

function drawRouteOverlay(ctx: CanvasRenderingContext2D, box: MapBox, view: StaticMapView) {
  const fullPath = route.value.map.path;
  const completedPath = localMapProvider.getCompletedGeoPath(route.value, store.progressPercent.value);
  const avatar = localMapProvider.getAvatarGeoPoint(route.value, store.progressPercent.value);
  const labelOffsets = [
    { x: 0, y: -46 },
    { x: 62, y: -36 },
    { x: -62, y: 20 },
    { x: 62, y: 18 },
    { x: -62, y: -38 },
  ];

  ctx.save();
  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 24);
  ctx.clip();

  drawMapPath(ctx, fullPath, view, box, {
    color: '#c9c4b8',
    width: 19,
    opacity: 0.92,
  });
  drawMapPath(ctx, completedPath, view, box, {
    color: route.value.accent,
    width: 12,
  });

  route.value.nodes.forEach((node, index) => {
    const projected = projectMercatorPoint(node.coord, view, box);
    const unlocked = store.unlockedNodes.value.some((unlockedNode) => unlockedNode.id === node.id);
    const active = currentNode.value.id === node.id;
    ctx.fillStyle = unlocked ? '#111111' : '#ffffff';
    ctx.strokeStyle = active ? '#ffb000' : unlocked ? '#111111' : '#ffffff';
    ctx.lineWidth = active ? 7 : 5;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, active ? 15 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawNodeLabel(ctx, node.name, projected, box, labelOffsets[index % labelOffsets.length], active);
  });

  drawRunnerMarker(ctx, projectMercatorPoint(avatar, view, box));
  drawMapProgressChip(ctx, box);
  ctx.restore();
}

async function drawRealMap(ctx: CanvasRenderingContext2D) {
  const box = { x: 64, y: 318, width: 772, height: 396 };
  const view = getShareMapView(box);
  const path = encodeURIComponent(getStaticMapPathParam(route.value.map.path));
  const center = `${view.center.lng.toFixed(6)},${view.center.lat.toFixed(6)}`;
  const url = `/api/static-map?routeId=${route.value.id}&center=${center}&zoom=${view.zoom}&path=${path}&v=${store.state.shareCardVersion}`;

  try {
    const image = await loadImage(url);
    drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 24);
    ctx.save();
    ctx.clip();
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
    drawRouteOverlay(ctx, box, view);
  } catch {
    drawGeoRouteFallback(ctx, box, view);
  }
}

function drawGeoRouteFallback(
  ctx: CanvasRenderingContext2D,
  box: MapBox,
  view: StaticMapView,
) {
  ctx.save();
  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 24);
  ctx.fillStyle = '#e8eee8';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#f7f4ed';
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.strokeStyle = 'rgba(80, 96, 88, 0.14)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const x = box.x + (box.width / 6) * index;
    const y = box.y + (box.height / 6) * index;
    ctx.beginPath();
    ctx.moveTo(x, box.y);
    ctx.lineTo(x, box.y + box.height);
    ctx.moveTo(box.x, y);
    ctx.lineTo(box.x + box.width, y);
    ctx.stroke();
  }
  ctx.restore();
  drawRouteOverlay(ctx, box, view);
}

function drawQrPlaceholder(ctx: CanvasRenderingContext2D) {
  const startX = 690;
  const startY = 980;
  const size = 112;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(startX, startY, size, size);
  ctx.fillStyle = '#111111';
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if ((row * col + row + col) % 3 !== 0) {
        ctx.fillRect(startX + col * 16, startY + row * 16, 11, 11);
      }
    }
  }
}

function drawProfileAvatar(ctx: CanvasRenderingContext2D) {
  const centerX = 768;
  const centerY = 124;

  ctx.save();
  ctx.fillStyle = '#ffb000';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.font = '900 42px "Microsoft YaHei", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(profileRunner.value.displayName.slice(0, 1), centerX, centerY + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

async function drawCard() {
  void ensureRouteMeasurement();

  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, 270);
  ctx.fillStyle = route.value.accent;
  ctx.fillRect(0, 250, canvas.width, 20);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(seasonProfile.name, 64, 82);
  ctx.font = '700 28px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`${profileRunner.value.displayName} · ${runnerStats.value.teamName}`, 64, 132);
  ctx.font = '500 24px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(
    `${profileRunner.value.city} · 连续 ${profileRunner.value.streakDays} 天 · 全体 #${runnerStats.value.overallRank}`,
    64,
    172,
  );
  ctx.font = '700 76px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`${store.totalDistance.value.toFixed(1)} km`, 64, 242);
  drawProfileAvatar(ctx);

  await drawRealMap(ctx);

  drawRoundedRect(ctx, 64, 770, 772, 240, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.font = '700 38px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(route.value.title, 96, 840);
  ctx.font = '500 28px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`抵达 ${store.currentNode.value.name}`, 96, 890);
  ctx.fillStyle = '#59554c';
  ctx.font = '500 24px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`完成 ${Math.round(store.progressPercent.value)}% · 连续 ${store.streakDays.value} 天`, 96, 940);
  ctx.fillText(`跑团排名 #${runnerStats.value.teamRank} · 分享卡 ${profileRunner.value.shareCards} 张`, 96, 982);

  ctx.fillStyle = '#111111';
  ctx.font = '700 28px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText('每一次训练，都让品牌陪伴自然发生。', 64, 1092);
  drawQrPlaceholder(ctx);
}

function downloadCard() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  canvas.toBlob((blob) => {
    if (!blob) return;

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'hla-running-world-share-card.png';
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

onMounted(async () => {
  await nextTick();
  await drawCard();
});

watch(
  () => [
    store.totalDistance.value,
    store.progressPercent.value,
    route.value.distanceKm,
    route.value.map.path.length,
    currentNode.value.id,
    store.activeRoute.value.id,
    store.state.shareCardVersion,
  ],
  () => {
    void drawCard();
  },
);
</script>

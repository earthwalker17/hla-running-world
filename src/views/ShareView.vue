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
        <strong>{{ route.title }}</strong>
        <p>累计 {{ totalDistance.toFixed(1) }} km，抵达 {{ currentNode.name }}。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Download, PenLine, RefreshCw } from 'lucide-vue-next';
import { seasonProfile } from '../data/season';
import { useSeasonStore } from '../state/seasonStore';

const store = useSeasonStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const route = computed(() => store.activeRoute.value);
const currentNode = store.currentNode;
const totalDistance = store.totalDistance;

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

function projectGeoPoint(
  point: { lng: number; lat: number },
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  box: { x: number; y: number; width: number; height: number },
) {
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  return {
    x: box.x + ((point.lng - bounds.minLng) / lngSpan) * box.width,
    y: box.y + (1 - (point.lat - bounds.minLat) / latSpan) * box.height,
  };
}

function getGeoBounds(points: Array<{ lng: number; lat: number }>) {
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('map image failed'));
    image.src = src;
  });
}

async function drawRealMap(ctx: CanvasRenderingContext2D) {
  const box = { x: 64, y: 318, width: 772, height: 396 };
  const url = `/api/static-map?routeId=${route.value.id}&totalDistance=${store.totalDistance.value}&v=${store.state.shareCardVersion}`;

  try {
    const image = await loadImage(url);
    drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 24);
    ctx.save();
    ctx.clip();
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
  } catch {
    drawGeoRouteFallback(ctx, box);
  }
}

function drawGeoRouteFallback(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
) {
  const pathPoints = route.value.map.path;
  const bounds = getGeoBounds(pathPoints);
  const completed = route.value.map.path.filter((point) => point.at <= store.progressPercent.value / 100);
  const avatar = route.value.map.path.reduce((closest, point) => {
    const target = store.progressPercent.value / 100;
    return Math.abs(point.at - target) < Math.abs(closest.at - target) ? point : closest;
  }, route.value.map.path[0]);

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

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#c7c2b6';
  ctx.lineWidth = 18;
  ctx.beginPath();
  pathPoints.forEach((point, index) => {
    const projected = projectGeoPoint(point, bounds, box);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.stroke();

  ctx.strokeStyle = route.value.accent;
  ctx.lineWidth = 12;
  ctx.beginPath();
  (completed.length >= 2 ? completed : [pathPoints[0]]).forEach((point, index) => {
    const projected = projectGeoPoint(point, bounds, box);
    if (index === 0) ctx.moveTo(projected.x, projected.y);
    else ctx.lineTo(projected.x, projected.y);
  });
  ctx.stroke();

  route.value.nodes.forEach((node) => {
    const { x, y } = projectGeoPoint(node.coord, bounds, box);
    const unlocked = store.unlockedNodes.value.some((unlockedNode) => unlockedNode.id === node.id);
    ctx.fillStyle = unlocked ? '#111111' : '#ffffff';
    ctx.strokeStyle = unlocked ? '#111111' : '#bcb6a9';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, unlocked ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const avatarPoint = projectGeoPoint(avatar, bounds, box);
  ctx.fillStyle = '#ffb000';
  ctx.beginPath();
  ctx.arc(avatarPoint.x, avatarPoint.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

async function drawCard() {
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
  ctx.font = '700 42px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(seasonProfile.name, 64, 92);
  ctx.font = '500 28px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText('江苏数字跑步赛季', 64, 142);
  ctx.font = '700 86px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`${store.totalDistance.value.toFixed(1)} km`, 64, 228);

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

  ctx.fillStyle = '#111111';
  ctx.font = '700 28px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText('把真实跑步，变成 30 天品牌数字远征。', 64, 1092);
  drawQrPlaceholder(ctx);
}

function downloadCard() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'hla-running-world-share-card.png';
  link.click();
}

onMounted(async () => {
  await nextTick();
  await drawCard();
});

watch(
  () => [
    store.totalDistance.value,
    store.progressPercent.value,
    store.activeRoute.value.id,
    store.state.shareCardVersion,
  ],
  () => {
    void drawCard();
  },
);
</script>

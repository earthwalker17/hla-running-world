<template>
  <div class="screen">
    <header class="compact-header">
      <div>
        <span class="eyebrow">After Run</span>
        <h1>{{ activeRoute.title }}</h1>
      </div>
      <button class="icon-button" type="button" aria-label="展开最近提交" @click="showRecords = true">
        <History :size="19" />
      </button>
    </header>

    <RouteMap
      :route="activeRoute"
      :total-distance="totalDistance"
      :progress-percent="progressPercent"
      :highlight-from-distance="highlightFromDistance"
      :last-run-distance="store.state.lastRunDistanceKm"
      :animation-key="store.state.shareCardVersion"
      @route-measured="store.setRouteMeasurement"
    />

    <section class="run-card">
      <div class="run-card-head">
        <div>
          <span>今日跑量</span>
        </div>
        <Zap :size="28" />
      </div>

      <input
        v-model="distanceInput"
        class="distance-input"
        type="text"
        inputmode="decimal"
        placeholder="输入今日跑量"
        aria-label="今日跑量"
        @input="normalizeDistanceInput"
      />

      <div class="preset-row">
        <button v-for="value in presets" :key="value" type="button" @click="distanceInput = String(value)">
          {{ value }} km
        </button>
      </div>

      <button class="submit-run" type="button" :disabled="isSubmitting || !canSubmit" @click="submitRun">
        <LoaderCircle v-if="isSubmitting" class="spin-icon" :size="19" />
        <Navigation v-else :size="19" />
        {{ isSubmitting ? '生成陪跑反馈' : '推进赛季路线' }}
      </button>
    </section>

    <section class="feedback-panel" :class="{ active: hasSubmitted }">
      <div class="feedback-icon">
        <Sparkles :size="22" />
      </div>
      <div>
        <span>AI 陪跑者 · {{ coachStatusLabel }}</span>
        <p>{{ store.state.lastCoachText }}</p>
        <small v-if="store.state.coachProvider !== 'local'">
          {{ store.state.coachProvider }} · {{ store.state.coachModel }}
        </small>
        <small v-else-if="store.state.coachError" class="coach-error">
          {{ coachErrorLabel }}
        </small>
      </div>
    </section>

    <section v-if="store.state.lastUnlockedNodeIds.length" class="unlock-panel">
      <Trophy :size="22" />
      <div>
        <span>新节点已解锁</span>
        <strong>{{ unlockedNames }}</strong>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>节点故事</h2>
        <span>{{ unlockedCount }}/{{ activeRoute.nodes.length }}</span>
      </div>
      <div class="timeline">
        <article
          v-for="node in activeRoute.nodes"
          :key="node.id"
          class="timeline-item"
          :class="{ unlocked: isUnlocked(node.id), current: currentNode.id === node.id }"
        >
          <div class="timeline-dot">
            <Check v-if="isUnlocked(node.id)" :size="15" />
            <LockKeyhole v-else :size="14" />
          </div>
          <div>
            <span>{{ node.city }} · {{ node.km.toFixed(1) }} km</span>
            <strong>{{ node.name }}</strong>
            <p>{{ node.story }}</p>
            <small>{{ node.brandHint }}</small>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>赛季徽章</h2>
        <span>权益入口</span>
      </div>
      <BadgeStrip :badges="badges" :total-distance="totalDistance" />
    </section>

    <div v-if="showRecords" class="record-drawer-backdrop" @click="showRecords = false"></div>
    <aside v-if="showRecords" class="record-drawer open" aria-label="最近提交">
      <header>
        <div>
          <span>Recent Runs</span>
          <strong>{{ streakDays }} 天连续</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭最近提交" @click="showRecords = false">
          <X :size="18" />
        </button>
      </header>
      <div class="record-list">
        <div v-for="record in recentRecords" :key="`${record.date}-${record.distanceKm}`">
          <span>{{ formatShortDate(record.date) }}</span>
          <strong>{{ record.distanceKm.toFixed(1) }} km</strong>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, History, LoaderCircle, LockKeyhole, Navigation, Sparkles, Trophy, X, Zap } from 'lucide-vue-next';
import BadgeStrip from '../components/BadgeStrip.vue';
import RouteMap from '../components/RouteMap.vue';
import { badges } from '../data/season';
import { useSeasonStore } from '../state/seasonStore';
import { formatShortDate } from '../utils/dates';

const store = useSeasonStore();
const presets = [5, 10, 15, 20];
const distanceInput = ref('');
const hasSubmitted = ref(false);
const isSubmitting = ref(false);
const showRecords = ref(false);
const activeRoute = computed(() => store.activeRoute.value);
const currentNode = store.currentNode;
const progressPercent = store.progressPercent;
const recentRecords = store.recentRecords;
const streakDays = store.streakDays;
const totalDistance = store.totalDistance;
const unlockedCount = computed(() => store.unlockedNodes.value.length);
const parsedDistance = computed(() => Number(distanceInput.value));
const canSubmit = computed(() => Number.isFinite(parsedDistance.value) && parsedDistance.value > 0);
const highlightFromDistance = computed(() =>
  store.state.lastRunDistanceKm > 0 ? store.state.lastRunBeforeKm : 0,
);

const unlockedNames = computed(() =>
  activeRoute.value.nodes
    .filter((node) => store.state.lastUnlockedNodeIds.includes(node.id))
    .map((node) => node.name)
    .join('、'),
);

const coachStatusLabel = computed(() => {
  if (store.state.coachStatus === 'pending') return '国内模型生成中';
  if (store.state.coachStatus === 'remote') return '国内模型';
  if (store.state.coachStatus === 'error') return '本地保底';
  return '本地保底';
});
const coachErrorLabel = computed(() => store.state.coachError || '国内模型暂不可用，已用本地保底');

function isUnlocked(nodeId: string): boolean {
  return store.unlockedNodes.value.some((node) => node.id === nodeId);
}

function normalizeDistanceInput(event: Event) {
  const input = event.target as HTMLInputElement;
  let value = input.value.replace(/[^\d.]/g, '');
  const firstDot = value.indexOf('.');
  if (firstDot >= 0) {
    value = `${value.slice(0, firstDot + 1)}${value.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  distanceInput.value = value;
}

async function submitRun() {
  if (isSubmitting.value || !canSubmit.value) return;
  isSubmitting.value = true;
  hasSubmitted.value = true;
  try {
    await store.addRunWithCoach(parsedDistance.value);
    distanceInput.value = '';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

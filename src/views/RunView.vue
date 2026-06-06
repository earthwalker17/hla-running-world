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
      <div class="feedback-copy">
        <div class="feedback-headline">
          <span>AI 陪跑者 · {{ coachStatusLabel }}</span>
          <button class="chat-toggle-button" type="button" aria-label="打开 AI 陪跑聊天" @click="showCoachChat = true">
            <MessageCircle :size="17" />
          </button>
        </div>
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
          :class="{
            unlocked: isUnlocked(node.id),
            current: currentNode.id === node.id,
            locked: !canOpenNode(node),
          }"
        >
          <div class="timeline-dot">
            <Check v-if="isUnlocked(node.id)" :size="15" />
            <LockKeyhole v-else :size="14" />
          </div>
          <div class="timeline-copy">
            <span>{{ node.city }} · {{ node.km.toFixed(1) }} km</span>
            <strong>{{ node.name }}</strong>
            <p>{{ node.story }}</p>
            <div class="timeline-footer">
              <small>{{ node.brandHint }}</small>
              <button
                class="timeline-action"
                type="button"
                :disabled="!canOpenNode(node)"
                @click="openNodeStory(node.id)"
              >
                <MapPinned :size="15" />
                {{ nodeActionLabel(node) }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>赛季徽章</h2>
        <button class="section-action" type="button" @click="showRewards = true">
          <Gift :size="15" />
          权益入口
        </button>
      </div>
      <BadgeStrip :badges="badges" :total-distance="totalDistance" />
    </section>

    <div v-if="hasSideDrawer" class="record-drawer-backdrop" @click="closeSideDrawers"></div>

    <aside v-if="showRecords" class="record-drawer open" aria-label="所有提交记录">
      <header>
        <div>
          <span>Run History</span>
          <strong>{{ allRecords.length }} 次提交</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭提交记录" @click="showRecords = false">
          <X :size="18" />
        </button>
      </header>
      <div class="record-list compact">
        <article v-for="record in allRecords" :key="record.id">
          <span>{{ formatShortDate(record.date) }}</span>
          <strong>{{ record.distanceKm.toFixed(1) }} km</strong>
          <button type="button" aria-label="撤销这条跑量记录" @click="undoRecord(record.id)">
            <Undo2 :size="14" />
            撤销
          </button>
        </article>
      </div>
      <p v-if="!allRecords.length" class="empty-state">暂无提交记录。</p>
    </aside>

    <aside v-if="selectedNode && selectedNodeStory" class="record-drawer story-drawer open" aria-label="节点故事详情">
      <header>
        <div>
          <span>{{ selectedNodeStatusLabel }}</span>
          <strong>{{ selectedNode.name }}</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭节点故事" @click="selectedNodeId = null">
          <X :size="18" />
        </button>
      </header>
      <img class="node-story-image" :src="selectedNodeStory.image" :alt="selectedNode.name" />
      <div class="node-story-meta">
        <span>{{ selectedNode.city }} · {{ selectedNode.km.toFixed(1) }} km</span>
        <strong>{{ selectedNode.brandHint }}</strong>
      </div>
      <p class="drawer-lead">{{ selectedNode.story }}</p>
      <p>{{ selectedNodeStoryText }}</p>
    </aside>

    <aside v-if="showRewards" class="record-drawer reward-drawer open" aria-label="赛季权益列表">
      <header>
        <div>
          <span>Reward Pool</span>
          <strong>赛季权益</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭赛季权益" @click="showRewards = false">
          <X :size="18" />
        </button>
      </header>
      <div class="benefit-list">
        <article v-for="reward in rewardItems" :key="reward.id" :class="{ unlocked: reward.unlocked }">
          <Ticket :size="18" />
          <div>
            <span>{{ reward.status }}</span>
            <strong>{{ reward.title }}</strong>
            <p>{{ reward.description }}</p>
          </div>
        </article>
      </div>
    </aside>

    <section v-if="showCoachChat" class="coach-chat-window" aria-label="AI 陪跑聊天窗">
      <header>
        <div>
          <span>HLA Coach</span>
          <strong>陪跑者在线</strong>
        </div>
        <button class="icon-button" type="button" aria-label="关闭 AI 陪跑聊天" @click="showCoachChat = false">
          <X :size="17" />
        </button>
      </header>
      <div class="coach-chat-messages">
        <article
          v-for="(message, index) in coachMessages"
          :key="`${message.role}-${index}`"
          class="coach-message"
          :class="message.role"
        >
          {{ message.content }}
        </article>
        <article v-if="chatSubmitting" class="coach-message assistant">我看一下，马上回你。</article>
      </div>
      <form class="coach-chat-form" @submit.prevent="sendCoachMessage">
        <input v-model="chatInput" type="text" placeholder="问训练、赛季或权益" aria-label="输入聊天问题" />
        <button type="submit" :disabled="chatSubmitting || !chatInput.trim()" aria-label="发送聊天问题">
          <Send :size="16" />
        </button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Check,
  Gift,
  History,
  LoaderCircle,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  Navigation,
  Send,
  Sparkles,
  Ticket,
  Trophy,
  Undo2,
  X,
  Zap,
} from 'lucide-vue-next';
import BadgeStrip from '../components/BadgeStrip.vue';
import RouteMap from '../components/RouteMap.vue';
import { badges } from '../data/season';
import { nodeStories } from '../data/nodeStories';
import { requestCoachChatReply } from '../services/coachChatClient';
import { useSeasonStore } from '../state/seasonStore';
import type { CoachChatMessage, RouteNode, RouteReward } from '../types';
import { formatShortDate } from '../utils/dates';

const store = useSeasonStore();
const presets = [5, 10, 15, 20];
const distanceInput = ref('');
const hasSubmitted = ref(false);
const isSubmitting = ref(false);
const showRecords = ref(false);
const showRewards = ref(false);
const showCoachChat = ref(false);
const selectedNodeId = ref<string | null>(null);
const chatInput = ref('');
const chatSubmitting = ref(false);
const coachMessages = ref<CoachChatMessage[]>([
  {
    role: 'assistant',
    content: '我在。想聊今天怎么跑、下一站在哪，或者赛季权益，都可以直接问。',
  },
]);

const activeRoute = computed(() => store.activeRoute.value);
const currentNode = store.currentNode;
const progressPercent = store.progressPercent;
const allRecords = store.allRecords;
const streakDays = store.streakDays;
const totalDistance = store.totalDistance;
const unlockedCount = computed(() => store.unlockedNodes.value.length);
const parsedDistance = computed(() => Number(distanceInput.value));
const canSubmit = computed(() => Number.isFinite(parsedDistance.value) && parsedDistance.value > 0);
const highlightFromDistance = computed(() =>
  store.state.lastRunDistanceKm > 0 ? store.state.lastRunBeforeKm : 0,
);

const nextNode = computed(() => activeRoute.value.nodes.find((node) => node.km > totalDistance.value) ?? null);
const hasSideDrawer = computed(() => showRecords.value || Boolean(selectedNodeId.value) || showRewards.value);
const selectedNode = computed(() =>
  activeRoute.value.nodes.find((node) => node.id === selectedNodeId.value) ?? null,
);
const selectedNodeStory = computed(() => (selectedNode.value ? nodeStories[selectedNode.value.id] : null));
const selectedNodeIsPreview = computed(() => {
  const node = selectedNode.value;
  return Boolean(node && !isUnlocked(node.id) && nextNode.value?.id === node.id);
});
const selectedNodeStatusLabel = computed(() => (selectedNodeIsPreview.value ? 'Next Stop Preview' : 'Unlocked Story'));
const selectedNodeStoryText = computed(() => {
  if (!selectedNodeStory.value) return '';
  return selectedNodeIsPreview.value ? selectedNodeStory.value.teaser : selectedNodeStory.value.detail;
});

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

const rewardCopy: Record<string, string> = {
  r1: '完成早期训练后点亮个人主页徽章，用来标记赛季正式起跑。',
  r2: '进入路线中段后获得装备券抽奖资格，可模拟为速干衣、跑袜或训练包。',
  r3: '首条路线完赛后进入线下活动候选池，适合承接跑团体验课或品牌活动。',
  r4: '抵达镇江段后获得赛前训练营身份，可作为跑团榜单和分享卡标签。',
  r5: '中段补给权益，可模拟为 HLA POW 装备券、门店体验券或补给包。',
  r6: '完成锡马训练线后获得赛事互动资格，用于线下打卡、合影或抽奖。',
  r7: '旗舰路线编号给高投入跑者更强身份感，适合展示在个人页。',
  r8: '抵达苏州段后解锁跑团荣誉展示机会，适合社群传播和团队 PK。',
  r9: '完成大环线后进入年度活动候选席位，作为旗舰路线最高等级权益。',
};

const rewardItems = computed(() =>
  activeRoute.value.rewards.map((reward) => {
    const unlocked = totalDistance.value >= reward.unlockKm;
    return {
      ...reward,
      unlocked,
      status: unlocked ? '可领取' : `${reward.unlockKm.toFixed(1)} km 解锁`,
      description: rewardCopy[reward.id] ?? buildRewardFallback(reward),
    };
  }),
);

function buildRewardFallback(reward: RouteReward): string {
  const label = {
    badge: '赛季徽章',
    coupon: '装备优惠',
    lottery: '抽奖资格',
    offline: '线下名额',
  }[reward.type];
  return `${label}示意权益，可在正式活动中替换为真实奖品池。`;
}

function isUnlocked(nodeId: string): boolean {
  return store.unlockedNodes.value.some((node) => node.id === nodeId);
}

function canOpenNode(node: RouteNode): boolean {
  return isUnlocked(node.id) || nextNode.value?.id === node.id;
}

function nodeActionLabel(node: RouteNode): string {
  if (isUnlocked(node.id)) return '查看故事';
  if (nextNode.value?.id === node.id) return '查看预告';
  return '待解锁';
}

function openNodeStory(nodeId: string) {
  const node = activeRoute.value.nodes.find((item) => item.id === nodeId);
  if (!node || !canOpenNode(node)) return;
  selectedNodeId.value = nodeId;
}

function closeSideDrawers() {
  showRecords.value = false;
  showRewards.value = false;
  selectedNodeId.value = null;
}

function undoRecord(recordId: string) {
  store.undoRunRecord(recordId);
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

async function sendCoachMessage() {
  const question = chatInput.value.trim();
  if (!question || chatSubmitting.value) return;

  coachMessages.value.push({ role: 'user', content: question });
  chatInput.value = '';
  chatSubmitting.value = true;

  const reply = await requestCoachChatReply({
    question,
    routeTitle: activeRoute.value.title,
    totalDistance: totalDistance.value,
    streakDays: streakDays.value,
    currentNode: currentNode.value.name,
    nextNode: nextNode.value?.name,
    recentMessages: coachMessages.value.slice(-6),
  });

  coachMessages.value.push({ role: 'assistant', content: reply.text });
  chatSubmitting.value = false;
}
</script>

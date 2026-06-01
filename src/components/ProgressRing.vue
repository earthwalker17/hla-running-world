<template>
  <div class="progress-ring" :style="{ '--ring-offset': ringOffset }">
    <svg viewBox="0 0 120 120" role="img" aria-label="赛季进度">
      <circle class="ring-track" cx="60" cy="60" r="52" />
      <circle class="ring-value" cx="60" cy="60" r="52" />
    </svg>
    <div>
      <strong>{{ displayPercent }}%</strong>
      <span>完成</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  percent: number;
}>();

const displayPercent = computed(() => Math.round(props.percent));
const ringOffset = computed(() => {
  const circumference = 327;
  const clamped = Math.min(100, Math.max(0, props.percent));
  return `${circumference - (circumference * clamped) / 100}`;
});
</script>

<template>
  <div class="badge-strip">
    <div
      v-for="badge in badges"
      :key="badge.id"
      class="badge-chip"
      :class="{ earned: totalDistance >= badge.unlockKm }"
    >
      <Medal :size="17" />
      <span>{{ badge.title }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Medal } from 'lucide-vue-next';
import type { Badge } from '../types';

defineProps<{
  badges: Badge[];
  totalDistance: number;
}>();
</script>

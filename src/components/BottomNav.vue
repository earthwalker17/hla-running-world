<template>
  <nav class="bottom-nav" aria-label="主导航">
    <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="nav-item">
      <component :is="item.icon" :size="19" stroke-width="2.2" />
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { Flag, Map, PenLine, Share2, UserRound } from 'lucide-vue-next';

const items = [
  { to: '/', label: '赛季', icon: Flag },
  { to: '/route', label: '路线', icon: Map },
  { to: '/run', label: '跑后', icon: PenLine },
  { to: '/share', label: '分享', icon: Share2 },
  { to: '/profile', label: '我的', icon: UserRound },
];
</script>

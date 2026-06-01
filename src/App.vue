<template>
  <div class="desktop-stage">
    <aside class="pitch-panel">
      <div class="pitch-kicker">Roadshow Demo</div>
      <h1>HLA Running World</h1>
      <p>江苏数字跑步赛季</p>
      <div class="pitch-metrics">
        <span>30 天</span>
        <span>1000 人试点</span>
        <span>真实地图</span>
      </div>
    </aside>

    <main class="phone-shell" aria-label="HLA Running World mobile demo">
      <RouterView />
      <BottomNav />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import BottomNav from './components/BottomNav.vue';
</script>

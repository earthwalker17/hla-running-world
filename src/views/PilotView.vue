<template>
  <div class="screen">
    <header class="compact-header">
      <div>
        <span class="eyebrow">Pilot Console</span>
        <h1>封闭试点看板</h1>
      </div>
      <RouterLink class="icon-button" to="/route" aria-label="查看真实路线">
        <Map :size="19" />
      </RouterLink>
    </header>

    <section class="pilot-hero">
      <div>
        <span>1000 人 · 30 天</span>
        <strong>{{ pilotMetrics.totalDistanceKm.toLocaleString('zh-CN') }} km</strong>
        <p>匿名模拟数据底座，用于展示封闭试点的运营视角。</p>
      </div>
      <Activity :size="34" />
    </section>

    <section class="pilot-kpi-grid" aria-label="试点指标">
      <MetricTile label="7 日活跃" :value="`${Math.round(pilotMetrics.activeRate * 100)}%`" />
      <MetricTile label="今日提交" :value="`${pilotMetrics.activeToday} 人`" />
      <MetricTile label="预计完赛" :value="`${pilotMetrics.projectedFinishers} 人`" />
      <MetricTile label="权益触发" :value="`${pilotMetrics.couponTriggered} 人`" />
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>跑团排行</h2>
        <span>{{ topPilotTeams.length }} 支重点队伍</span>
      </div>
      <div class="rank-list">
        <div v-for="(team, index) in topPilotTeams" :key="team.id" class="rank-row">
          <span>{{ index + 1 }}</span>
          <div>
            <strong>{{ team.name }}</strong>
            <small>{{ team.city }} · {{ team.members }} 人 · 活跃 {{ Math.round(team.activeRate * 100) }}%</small>
          </div>
          <b>{{ team.totalDistanceKm.toFixed(1) }}</b>
        </div>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>运营唤醒</h2>
        <span>{{ pilotMetrics.needsWakeup }} 人</span>
      </div>
      <div class="wakeup-list">
        <article v-for="segment in wakeupSegments" :key="segment.id" class="wakeup-item">
          <div>
            <strong>{{ segment.count }}</strong>
            <span>{{ segment.title }}</span>
          </div>
          <p>{{ segment.hint }}</p>
        </article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>完赛预测</h2>
        <span>{{ Math.round(pilotMetrics.completionRate * 100) }}% 已完成</span>
      </div>
      <div class="pilot-progress">
        <div>
          <span :style="{ width: `${Math.round(pilotMetrics.completionRate * 100)}%` }"></span>
        </div>
        <p>
          当前已完赛 {{ pilotMetrics.finishers }} 人，预计可推进到
          {{ pilotMetrics.projectedFinishers }} 人。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { Activity, Map } from 'lucide-vue-next';
import MetricTile from '../components/MetricTile.vue';
import { pilotMetrics, topPilotTeams, wakeupSegments } from '../data/pilot';
</script>

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import PilotView from './views/PilotView.vue';
import RouteView from './views/RouteView.vue';
import RunView from './views/RunView.vue';
import ShareView from './views/ShareView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/route', name: 'route', component: RouteView },
    { path: '/run', name: 'run', component: RunView },
    { path: '/share', name: 'share', component: ShareView },
    { path: '/pilot', name: 'pilot', component: PilotView },
  ],
});

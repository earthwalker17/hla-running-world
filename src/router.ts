import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import ProfileView from './views/ProfileView.vue';
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
    { path: '/profile', name: 'profile', component: ProfileView },
    { path: '/pilot', redirect: '/profile' },
  ],
});

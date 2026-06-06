import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import {
  createCoachApiHandler,
  createCoachChatApiHandler,
  createDemoConfigHandler,
  createStaticMapHandler,
} from './server/roadshowApi';

function roadshowApiPlugin(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'hla-roadshow-api',
    configureServer(server) {
      server.middlewares.use('/api/running-coach-chat', createCoachChatApiHandler(env));
      server.middlewares.use('/api/coach', createCoachApiHandler(env));
      server.middlewares.use('/api/demo-config', createDemoConfigHandler(env));
      server.middlewares.use('/api/static-map', createStaticMapHandler(env));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/running-coach-chat', createCoachChatApiHandler(env));
      server.middlewares.use('/api/coach', createCoachApiHandler(env));
      server.middlewares.use('/api/demo-config', createDemoConfigHandler(env));
      server.middlewares.use('/api/static-map', createStaticMapHandler(env));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue(), roadshowApiPlugin(env)],
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    test: {
      environment: 'node',
      globals: true,
    },
  };
});

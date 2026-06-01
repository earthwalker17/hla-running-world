import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routes } from '../src/data/season';
import { localMapProvider } from '../src/services/mapProvider';
import { getProgressPercent } from '../src/services/progress';

type ProviderId = 'zhipu' | 'deepseek' | 'qwen' | 'local';
type Env = Record<string, string | undefined>;
type NextFunction = (error?: unknown) => void;
type Middleware = (request: IncomingMessage, response: ServerResponse, next: NextFunction) => void;

interface CoachRequestPayload {
  routeTitle?: string;
  todayDistance?: number;
  totalDistance?: number;
  streakDays?: number;
  progressPercent?: number;
  currentNode?: string;
  newlyUnlockedNodes?: string[];
  distanceToNextNode?: number;
  fallbackText?: string;
}

interface ProviderConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  endpoint: string;
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
}

function sendBuffer(response: ServerResponse, statusCode: number, contentType: string, data: Buffer) {
  response.statusCode = statusCode;
  response.setHeader('content-type', contentType);
  response.setHeader('cache-control', 'no-store');
  response.end(data);
}

function readJsonBody(request: IncomingMessage): Promise<CoachRequestPayload> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    request.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > 64 * 1024) {
        reject(new Error('Request body is too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw) as CoachRequestPayload);
      } catch (error) {
        reject(error);
      }
    });

    request.on('error', reject);
  });
}

function normalizeProvider(value: string | undefined): ProviderId {
  if (value === 'deepseek' || value === 'qwen' || value === 'local') {
    return value;
  }
  return 'zhipu';
}

function createProviderConfig(provider: ProviderId, env: Env, useExplicitModel: boolean): ProviderConfig | null {
  const explicitModel = useExplicitModel ? env.AI_MODEL?.trim() : undefined;

  if (provider === 'local') {
    return null;
  }

  if (provider === 'deepseek') {
    const apiKey = env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: explicitModel || 'deepseek-v4-flash',
      endpoint: env.DEEPSEEK_API_ENDPOINT || 'https://api.deepseek.com/chat/completions',
    };
  }

  if (provider === 'qwen') {
    const apiKey = env.DASHSCOPE_API_KEY?.trim();
    if (!apiKey) return null;
    return {
      provider,
      apiKey,
      model: explicitModel || 'qwen3.6-flash',
      endpoint:
        env.DASHSCOPE_API_ENDPOINT ||
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    };
  }

  const apiKey = env.ZHIPU_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    provider: 'zhipu',
    apiKey,
    model: explicitModel || 'glm-4.7-flash',
    endpoint: env.ZHIPU_API_ENDPOINT || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  };
}

function getProviderConfig(env: Env): ProviderConfig | null {
  const preferred = normalizeProvider(env.AI_PROVIDER);
  if (preferred === 'local') {
    return null;
  }

  const candidates = [preferred, 'zhipu', 'deepseek', 'qwen'] as const;

  for (const provider of candidates) {
    const config = createProviderConfig(provider, env, provider === preferred);
    if (config) return config;
  }

  return null;
}

function getFallbackText(payload: CoachRequestPayload): string {
  return (
    payload.fallbackText ||
    `今天的 ${Number(payload.todayDistance ?? 0).toFixed(1)} km 已记录，继续把真实训练推进成品牌赛季故事。`
  );
}

function buildMessages(payload: CoachRequestPayload) {
  const currentNode = payload.currentNode || '当前节点';
  const newlyUnlockedNodes = Array.isArray(payload.newlyUnlockedNodes)
    ? payload.newlyUnlockedNodes
    : [];

  return [
    {
      role: 'system',
      content:
        '你是 HLA Running World 的中文 AI 陪跑者。请生成 60 到 90 字中文反馈，语气温暖、克制、像品牌数字赛季中的跑后鼓励。不要编造个人隐私，不要提到 API 或模型，不要使用表情符号。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        routeTitle: payload.routeTitle,
        todayDistance: payload.todayDistance,
        totalDistance: payload.totalDistance,
        streakDays: payload.streakDays,
        progressPercent: payload.progressPercent,
        currentNode,
        newlyUnlockedNodes,
        distanceToNextNode: payload.distanceToNextNode,
      }),
    },
  ];
}

function extractText(data: unknown): string {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  return response.choices?.[0]?.message?.content?.trim() ?? '';
}

function formatProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'ai-provider-error';
  if (message.includes('429')) return '国内模型限流或额度不足，已回退本地保底';
  if (message.includes('401') || message.includes('403')) return '国内模型 Key 权限未通过，已回退本地保底';
  if (message.includes('404')) return '国内模型或接口地址不可用，已回退本地保底';
  if (message.toLowerCase().includes('aborted')) return '国内模型响应超时，已回退本地保底';
  return '国内模型暂不可用，已回退本地保底';
}

async function requestRemoteCoach(payload: CoachRequestPayload, config: ProviderConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(payload),
        temperature: 0.65,
        max_tokens: 120,
        thinking: {
          type: 'disabled',
        },
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI provider returned ${response.status}${errorText ? `: ${errorText.slice(0, 160)}` : ''}`);
    }

    const data = await response.json();
    const text = extractText(data);
    if (!text) {
      throw new Error('AI provider returned empty content');
    }

    return text.slice(0, 220);
  } finally {
    clearTimeout(timeout);
  }
}

function toStaticMapColor(hex: string): string {
  return `0x${hex.replace('#', '')}`;
}

function getStaticMapUrl(env: Env, requestUrl: string): string | null {
  const key = env.AMAP_STATIC_KEY || env.AMAP_WEB_SERVICE_KEY || env.AMAP_KEY || env.VITE_AMAP_KEY;
  if (!key) return null;

  const url = new URL(requestUrl, 'http://localhost');
  const routeId = url.searchParams.get('routeId') || 'jiangyin-city';
  const totalDistance = Number(url.searchParams.get('totalDistance') || 0);
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const progressPercent = getProgressPercent(totalDistance, route.distanceKm);
  const completedPath = localMapProvider.getCompletedGeoPath(route, progressPercent);
  const pathPoints = completedPath.length >= 2 ? completedPath : route.map.path;
  const path = pathPoints.map((point) => `${point.lng},${point.lat}`).join(';');
  const markers = route.nodes
    .map((node) => `${node.coord.lng},${node.coord.lat}`)
    .join(';');

  const params = new URLSearchParams({
    key,
    size: '750*470',
    scale: '2',
    paths: `${route.id === 'jiangyin-city' ? 10 : 8},${toStaticMapColor(route.accent)},0.9,,0:${path}`,
    markers: `small,0x111111,A:${markers}`,
  });

  return `https://restapi.amap.com/v3/staticmap?${params.toString()}`;
}

export function createCoachApiHandler(env: Env): Middleware {
  return async (request, response, next) => {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    try {
      const payload = await readJsonBody(request);
      const fallbackText = getFallbackText(payload);
      const config = getProviderConfig(env);

      if (!config) {
        sendJson(response, 200, {
          text: fallbackText,
          source: 'local',
          provider: 'local',
          model: 'rule-fallback',
          error: 'missing-api-key-or-local-provider',
        });
        return;
      }

      try {
        const text = await requestRemoteCoach(payload, config);
        sendJson(response, 200, {
          text,
          source: 'remote',
          provider: config.provider,
          model: config.model,
          tone: 'warm-roadshow',
          shareReady: true,
        });
      } catch (error) {
        sendJson(response, 200, {
          text: fallbackText,
          source: 'local',
          provider: 'local',
          model: 'rule-fallback',
          error: formatProviderError(error),
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export function createDemoConfigHandler(env: Env): Middleware {
  return (request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    sendJson(response, 200, {
      amapKey: env.AMAP_KEY || env.VITE_AMAP_KEY || '',
      amapSecurityCode: env.AMAP_SECURITY_CODE || env.VITE_AMAP_SECURITY_CODE || '',
    });
  };
}

export function createStaticMapHandler(env: Env): Middleware {
  return async (request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    const staticMapUrl = getStaticMapUrl(env, request.url || '/');
    if (!staticMapUrl) {
      sendJson(response, 404, { error: 'missing-amap-key' });
      return;
    }

    try {
      const mapResponse = await fetch(staticMapUrl);
      const contentType = mapResponse.headers.get('content-type') || '';
      const arrayBuffer = await mapResponse.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      if (!mapResponse.ok || !contentType.includes('image')) {
        const detail = data
          .toString('utf8')
          .replace(/"key"\s*:\s*"[^"]+"/g, '"key":"[redacted]"')
          .replace(/"sec[^"]*"\s*:\s*"[^"]+"/g, '"security":"[redacted]"')
          .slice(0, 160);
        sendJson(response, 502, {
          error: 'static-map-request-failed',
          status: mapResponse.status,
          detail,
        });
        return;
      }

      sendBuffer(response, 200, contentType, data);
    } catch (error) {
      sendJson(response, 502, {
        error: error instanceof Error ? error.message : 'static-map-request-failed',
      });
    }
  };
}

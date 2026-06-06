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

interface CoachChatRequestPayload {
  question?: string;
  routeTitle?: string;
  totalDistance?: number;
  streakDays?: number;
  currentNode?: string;
  nextNode?: string;
  recentMessages?: Array<{
    role?: 'user' | 'assistant';
    content?: string;
  }>;
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

function buildLocalChatText(payload: CoachChatRequestPayload): string {
  const question = (payload.question || '').toLowerCase();
  const totalDistance = Number(payload.totalDistance ?? 0);
  const nextNodeText = payload.nextNode ? `下一站是「${payload.nextNode}」。` : '你已经接近路线收尾。';

  if (question.includes('痛') || question.includes('伤') || question.includes('膝') || question.includes('累')) {
    return '先把强度降下来，今天可以改成轻松跑或休息。疼痛持续的话，别硬顶，优先找专业人士看看。';
  }

  if (question.includes('配速') || question.includes('节奏') || question.includes('训练')) {
    return `你现在累计 ${totalDistance.toFixed(1)} km，先稳住舒适配速。${nextNodeText} 连续性更重要。`;
  }

  if (question.includes('节点') || question.includes('路线') || question.includes('赛季')) {
    return `你在「${payload.currentNode || '当前节点'}」附近推进。${nextNodeText} 跑完回来，我继续帮你点亮进度。`;
  }

  if (question.includes('权益') || question.includes('奖') || question.includes('券') || question.includes('品牌')) {
    return '权益先按 Demo 示意：徽章、装备券、抽奖和线下名额。真正上线时可以和 HLA POW 澜跑活动池打通。';
  }

  return '收到。我会按陪跑者的方式陪你聊训练、赛季和品牌活动。先把今天这一步跑稳，故事自然会往前走。';
}

function buildChatMessages(payload: CoachChatRequestPayload) {
  const recentMessages = Array.isArray(payload.recentMessages)
    ? payload.recentMessages
        .filter((message) => message.role && message.content)
        .slice(-4)
        .map((message) => ({
          role: message.role,
          content: String(message.content).slice(0, 180),
        }))
    : [];

  return [
    {
      role: 'system',
      content:
        '你是 HLA Running World 的中文 AI 陪跑者。请用 1 到 2 句中文回答，温暖、简短、像真实品牌陪跑者。只回答训练、赛季、跑团、海澜之家/HLA POW 澜跑品牌活动相关内容。不要长篇科普，不要使用表情符号，不要提 API 或模型。',
    },
    {
      role: 'user',
      content: JSON.stringify({
        routeTitle: payload.routeTitle,
        totalDistance: payload.totalDistance,
        streakDays: payload.streakDays,
        currentNode: payload.currentNode,
        nextNode: payload.nextNode,
      }),
    },
    ...recentMessages,
    {
      role: 'user',
      content: String(payload.question || '').slice(0, 260),
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

async function requestRemoteCoachChat(payload: CoachChatRequestPayload, config: ProviderConfig): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildChatMessages(payload),
        temperature: 0.55,
        max_tokens: 90,
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

    return text.slice(0, 180);
  } finally {
    clearTimeout(timeout);
  }
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

function parseStaticPathParam(value: string | null): Array<{ lng: number; lat: number }> {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .slice(0, 120)
    .map((item) => {
      const [lng, lat] = item.split(',').map(Number);
      return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
    })
    .filter((point): point is { lng: number; lat: number } => Boolean(point));
}

function parseStaticCenterParam(value: string | null): { lng: number; lat: number } | null {
  if (!value) {
    return null;
  }

  const [lng, lat] = value.split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
}

function parseStaticZoomParam(value: string | null): string | null {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) {
    return null;
  }

  return String(Math.min(17, Math.max(4, Math.round(zoom))));
}

function getStaticMapUrl(env: Env, requestUrl: string): string | null {
  const key =
    env.AMAP_STATIC_KEY ||
    env.AMAP_WEB_SERVICE_KEY ||
    env.VITE_AMAP_STATIC_KEY ||
    env.VITE_AMAP_WEB_SERVICE_KEY;
  if (!key) return null;

  const url = new URL(requestUrl, 'http://localhost');
  const routeId = url.searchParams.get('routeId') || 'jiangyin-city';
  const totalDistance = Number(url.searchParams.get('totalDistance') || 0);
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const progressPercent = getProgressPercent(totalDistance, route.distanceKm);
  const completedPath = localMapProvider.getCompletedGeoPath(route, progressPercent);
  const clientPath = parseStaticPathParam(url.searchParams.get('path'));
  const center = parseStaticCenterParam(url.searchParams.get('center')) ?? route.map.center;
  const zoom = parseStaticZoomParam(url.searchParams.get('zoom')) ?? String(Math.round(route.map.zoom));
  const pathPoints = clientPath.length >= 2 ? clientPath : completedPath.length >= 2 ? completedPath : route.map.path;
  const path = pathPoints.map((point) => `${point.lng},${point.lat}`).join(';');

  const params = new URLSearchParams({
    key,
    location: `${center.lng},${center.lat}`,
    zoom,
    size: '772*396',
    scale: '2',
    traffic: '0',
    paths: `${route.id === 'jiangyin-city' ? 8 : 6},${toStaticMapColor(route.accent)},0.45,,0:${path}`,
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

export function createCoachChatApiHandler(env: Env): Middleware {
  return async (request, response, next) => {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    try {
      const payload = (await readJsonBody(request)) as CoachChatRequestPayload;
      const fallbackText = buildLocalChatText(payload);
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
        const text = await requestRemoteCoachChat(payload, config);
        sendJson(response, 200, {
          text,
          source: 'remote',
          provider: config.provider,
          model: config.model,
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
      sendJson(response, 404, { error: 'missing-amap-static-key' });
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

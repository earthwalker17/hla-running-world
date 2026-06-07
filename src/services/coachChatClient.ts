import type { CoachChatPayload, CoachChatResult } from '../types';
import { shouldUseRemoteRoadshowApi } from './deploymentMode';

function buildLocalCoachChatReply(payload: CoachChatPayload): string {
  const question = payload.question.toLowerCase();
  const nextNodeText = payload.nextNode ? `下一站是「${payload.nextNode}」。` : '你已经接近路线收尾。';

  if (question.includes('痛') || question.includes('伤') || question.includes('膝') || question.includes('累')) {
    return '先把强度降下来，今天可以改成轻松跑或休息。疼痛持续的话，别硬顶，优先找专业人士看看。';
  }

  if (question.includes('配速') || question.includes('节奏') || question.includes('训练')) {
    return `你现在累计 ${payload.totalDistance.toFixed(1)} km，先稳住舒适配速。${nextNodeText} 不用急，连续性更重要。`;
  }

  if (question.includes('节点') || question.includes('路线') || question.includes('赛季')) {
    return `你在「${payload.currentNode}」附近推进。${nextNodeText} 跑完回来，我会继续帮你把进度点亮。`;
  }

  if (question.includes('权益') || question.includes('奖') || question.includes('券') || question.includes('品牌')) {
    return '权益先按 Demo 示意：徽章、装备券、抽奖和线下名额。真正上线时可以和 HLA POW 澜跑活动池打通。';
  }

  return '收到。我会按陪跑者的方式陪你聊训练、赛季和品牌活动。先把今天这一步跑稳，故事自然会往前走。';
}

export async function requestCoachChatReply(payload: CoachChatPayload): Promise<CoachChatResult> {
  const fallbackText = buildLocalCoachChatReply(payload);

  if (!payload.question.trim() || !shouldUseRemoteRoadshowApi()) {
    return {
      text: fallbackText,
      source: 'local',
      provider: 'local',
      model: 'rule-fallback',
    };
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch('/api/running-coach-chat', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI chat proxy returned ${response.status}`);
    }

    const data = (await response.json()) as Partial<CoachChatResult>;
    if (!data.text) {
      throw new Error('AI chat proxy returned empty text');
    }

    return {
      text: data.text.slice(0, 180),
      source: data.source === 'remote' ? 'remote' : 'local',
      provider: data.provider ?? 'local',
      model: data.model ?? 'rule-fallback',
      error: data.error,
    };
  } catch (error) {
    return {
      text: fallbackText,
      source: 'local',
      provider: 'local',
      model: 'rule-fallback',
      error: error instanceof Error ? error.message : 'AI chat request failed',
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

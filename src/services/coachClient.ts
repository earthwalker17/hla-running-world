import type { CoachApiPayload, CoachApiResult, CoachContext } from '../types';
import { getDistanceToNextNode } from './progress';

function toPayload(context: CoachContext, fallbackText: string): CoachApiPayload {
  const currentNode = context.unlockedNodes[context.unlockedNodes.length - 1] ?? context.route.nodes[0];

  return {
    routeTitle: context.route.title,
    todayDistance: context.todayDistance,
    totalDistance: context.totalDistance,
    streakDays: context.streakDays,
    progressPercent: context.progressPercent,
    currentNode: currentNode.name,
    newlyUnlockedNodes: context.newlyUnlockedNodes.map((node) => node.name),
    distanceToNextNode: getDistanceToNextNode(context.route, context.totalDistance),
    fallbackText,
  };
}

export async function requestCoachFeedback(
  context: CoachContext,
  fallbackText: string,
): Promise<CoachApiResult> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toPayload(context, fallbackText)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI proxy returned ${response.status}`);
    }

    const data = (await response.json()) as Partial<CoachApiResult>;
    if (!data.text) {
      throw new Error('AI proxy returned empty text');
    }

    return {
      text: data.text,
      source: data.source === 'remote' ? 'remote' : 'local',
      provider: data.provider ?? 'local',
      model: data.model ?? 'rule-fallback',
      tone: data.tone,
      shareReady: data.shareReady,
      error: data.error,
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

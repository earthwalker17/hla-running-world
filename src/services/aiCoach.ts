import type { CoachContext } from '../types';
import { roundKm } from './progress';

export function buildCoachFeedback(context: CoachContext): string {
  const {
    route,
    todayDistance,
    totalDistance,
    streakDays,
    progressPercent,
    newlyUnlockedNodes,
    unlockedNodes,
  } = context;

  const currentNode = unlockedNodes[unlockedNodes.length - 1] ?? route.nodes[0];
  const remaining = roundKm(route.distanceKm - totalDistance);

  if (newlyUnlockedNodes.length > 0) {
    const node = newlyUnlockedNodes[newlyUnlockedNodes.length - 1];
    return `今天的 ${todayDistance.toFixed(1)} km 把你推进到「${node.name}」。这是一个很适合发给跑团的节点：真实训练被看见，城市故事也被点亮了。`;
  }

  if (progressPercent >= 100) {
    return `你已经完成「${route.title}」。这张完赛卡可以作为品牌赛季的转发样张，适合放在路演的收尾 5 秒。`;
  }

  if (todayDistance >= 8) {
    return `今天跑量很扎实，累计来到 ${totalDistance.toFixed(1)} km。保持这个节奏，${Math.max(1, streakDays)} 天连续训练会成为你最有说服力的赛季故事。`;
  }

  if (streakDays >= 4) {
    return `连续第 ${streakDays} 天完成训练，稳定性比单次大跑量更难得。你现在停在「${currentNode.name}」附近，距离完赛还差 ${remaining.toFixed(1)} km。`;
  }

  return `今天的 ${todayDistance.toFixed(1)} km 已经记录。你正在「${currentNode.name}」段推进，下一次跑完回来，路线会继续替你把努力翻译成可分享的进度。`;
}

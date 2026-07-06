import { GrasslandAchievement, DifficultyTier } from 'shared-types';
import type { GameState } from 'shared-types';
import { BOSS_FAST_CLEAR_MS } from '../balance.js';

export function evaluateGrasslandAchievements(
  state: GameState,
  bossDefeatedAt: number,
): GrasslandAchievement[] {
  try {
    const results: GrasslandAchievement[] = [];

    const push = (achievement: GrasslandAchievement, achieved: boolean) => {
      if (achieved) results.push(achievement);
    };

    push(GrasslandAchievement.NoDeath,
      state.players.every(p => p.downCount === 0));

    push(GrasslandAchievement.FastBoss,
      bossDefeatedAt - state.session.bossLevelStartedAt <= BOSS_FAST_CLEAR_MS);

    push(GrasslandAchievement.AllBondsActive,
      state.session.allBondsAtBossStart);

    push(GrasslandAchievement.HardCleared,
      state.session.difficulty === DifficultyTier.HARD);

    push(GrasslandAchievement.VigilHeld,
      state.session.anyPlayerDownedDuringBoss);

    return results;
  } catch (err) {
    console.error('[achievements] evaluateGrasslandAchievements error:', err);
    return [];
  }
}

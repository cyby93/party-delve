export enum GrasslandAchievement {
  NoDeath = 'no_death',
  FastBoss = 'fast_boss',
  AllBondsActive = 'all_bonds',
  HardCleared = 'hard_cleared',
  VigilHeld = 'vigil_held',
}

export interface AchievementState {
  achievement: GrasslandAchievement;
  completed: boolean;
}

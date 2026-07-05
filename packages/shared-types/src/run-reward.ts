import type { GrasslandAchievement } from './achievements.js';

export interface PlayerReward {
  playerId: string;
  essence: number;
  masteryMilestones: string[];
}

export interface RunReward {
  essenceTotal: number;
  perPlayer: PlayerReward[];
  achievements: GrasslandAchievement[];
}

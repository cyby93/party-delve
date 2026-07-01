import type { DifficultyTier } from './enemy.js';

export interface RunProposal {
  biome: 'grassland';
  difficulty: DifficultyTier;
  proposedBy: string;
}

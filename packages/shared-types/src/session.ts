import type { BondType } from './bond.js';
import type { DifficultyTier } from './enemy.js';

export interface SessionState {
  roomId: string;
  hostId: string;
  phase: 'lobby' | 'hub' | 'dungeon' | 'post-run';
  playerCount: number;
  maxPlayers: number;
  runSeed: number;
  levelIndex: number;
  difficulty: DifficultyTier | null;
  levelObjective: 'clear' | 'survive-waves';
  waveIndex: number;
  totalWaves: number;
}

export interface RoomOptions {
  maxPlayers: number;
  seed?: number;
}

export interface SimEvents {
  'player:downed': { playerId: string; downCount: number };
  'bond:assigned': { playerA: string; playerB: string; bondType: BondType };
  'enemy:killed': { enemyId: string; byPlayerId: string };
  'level:complete': { levelIndex: number };
}

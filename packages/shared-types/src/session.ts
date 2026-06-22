import type { BondType } from './bond.js';

export interface SessionState {
  roomId: string;
  hostId: string;
  phase: 'lobby' | 'hub' | 'dungeon' | 'post-run';
  playerCount: number;
  maxPlayers: number;
  runSeed: number;
  levelIndex: number;
}

export interface RoomOptions {
  maxPlayers: number;
  seed?: number;
}

export interface SimEvents {
  'player:downed': { playerId: string; downCount: number };
  'bond:assigned': { playerAId: string; playerBId: string; bondType: BondType };
  'enemy:killed': { enemyId: string; byPlayerId: string };
  'level:complete': { levelIndex: number };
}

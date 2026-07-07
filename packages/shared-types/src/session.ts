import type { BondType } from './bond.js';
import type { DifficultyTier } from './enemy.js';
import type { BossPhase } from './boss.js';
import type { RunReward } from './run-reward.js';

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
  bossLevelStartedAt: number;
  anyPlayerDownedDuringBoss: boolean;
  allBondsAtBossStart: boolean;
}

export interface RoomOptions {
  maxPlayers: number;
  seed?: number;
}

export interface SimEvents {
  'player:downed': { playerId: string; downCount: number };
  // bondColor is not part of SimEvents: it's computed in game-rules' assignBond
  // (BOND_TYPE_COLORS[bondType]) and forwarded through GameRoom into the wire-level
  // BondAssignedDelta (net-protocol) — never silently undefined at broadcast time.
  'bond:assigned': { playerA: string; playerB: string; bondType: BondType };
  'enemy:killed': { enemyId: string; byPlayerId: string };
  'level:complete': { levelIndex: number };
  'boss:phaseChanged': { bossId: string; newPhase: BossPhase };
  'boss:defeated': { bossId: string; reward: RunReward };
}

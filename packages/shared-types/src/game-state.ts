import type { PlayerState } from './player.js';
import type { EnemyState } from './enemy.js';
import type { BondState } from './bond.js';
import type { SessionState } from './session.js';
import type { FloorLayout } from './floor-layout.js';
import type { RunProposal } from './run-proposal.js';
import type { AbandonProposal } from './abandon-proposal.js';
import type { BossState } from './boss.js';
import type { ProjectileState } from './projectile.js';
import type { ZoneState } from './zone.js';

export interface EssenceDrop {
  id: string;
  x: number;
  y: number;
  amount: number;
}

export interface GameState {
  session: SessionState;
  players: PlayerState[];
  enemies: EnemyState[];
  activeBonds: BondState[];
  essenceDrops: EssenceDrop[];
  tick: number;
  floorLayout: FloorLayout | null;
  runProposal: RunProposal | null;
  abandonProposal: AbandonProposal | null;
  boss: BossState | null;
  projectiles: ProjectileState[];
  zones: ZoneState[];
}

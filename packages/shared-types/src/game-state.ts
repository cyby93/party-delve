import type { PlayerState } from './player.js';
import type { EnemyState } from './enemy.js';
import type { BondState } from './bond.js';
import type { SessionState } from './session.js';
import type { FloorLayout } from './floor-layout.js';

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
  bonds: BondState[];
  essenceDrops: EssenceDrop[];
  tick: number;
  floorLayout: FloorLayout | null;
}

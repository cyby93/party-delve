import type { PlayerClass } from './player.js';

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  class: PlayerClass;
  abilityIndex: number;
}

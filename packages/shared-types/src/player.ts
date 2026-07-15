import type { StatusEffect } from './status-effect.js';

export enum PlayerClass {
  STONEHIDE = 'stonehide',
  SPIRITCALLER = 'spiritcaller',
  SOULDRINKER = 'souldrinker',
  STORMCALLER = 'stormcaller',
}

export enum SessionColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  PURPLE = 'purple',
  ORANGE = 'orange',
  PINK = 'pink',
  TEAL = 'teal',
}

export interface PlayerState {
  id: string;
  displayName: string;
  class: PlayerClass | null;
  x: number;
  y: number;
  // Story 3.21: fixed body position, set once when isDown first becomes true.
  // Optional (not required) so apps/simulation-server's existing PlayerState/
  // player:downed object literals keep typechecking until 3.21b populates them.
  bodyX?: number;
  bodyY?: number;
  hp: number;
  maxHp: number;
  isFrozen: boolean;
  isDown: boolean;
  isSpirit: boolean;
  sessionColor: SessionColor;
  downCount: number;
  nearPoiId: string | null;  // null = not near any interactive POI
  essenceTotal: number;
  reviveTimerExpiresAt: number;  // server-epoch ms; 0 = not downed or expired
  statusEffects: StatusEffect[];
  channelingAbility: { abilityIndex: number; targetPlayerId: string; startedAt: number; durationMs: number } | null;
}

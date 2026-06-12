import type { Vec2, SkillSlot } from './input';

export type CharacterState = 'idle' | 'moving' | 'casting' | 'dead' | 'reviving';

/** Subset used by the Hub movement layer — broadens to CharacterState in combat phases. */
export type PlayerMovementState = 'moving' | 'idle';

export interface PlayerState {
  playerId: string;
  position: Vec2;
  facing: number;
  hp: number;
  maxHp: number;
  state: CharacterState;
  activeSkillSlot?: SkillSlot | 'none';
}

/** Network message emitted by the simulation server each tick for each changed player. */
export interface PlayerStateSnapshot extends PlayerState {
  tick: number;
  /** Whether the player's WebSocket is currently connected. False means frozen/disconnected. */
  connected: boolean;
}

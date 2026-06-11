export interface Vec2 {
  x: number;
  y: number;
}

export type SkillSlot = 'primary' | 'secondary' | 'ultimate';

export interface MoveInputEvent {
  playerId: string;
  sequenceNumber: number;
  direction: Vec2;
  timestamp: number;
}

export interface SkillInputEvent {
  playerId: string;
  sequenceNumber: number;
  skillSlot: SkillSlot;
  phase: 'start' | 'release';
  timestamp: number;
}

export type InputEvent = MoveInputEvent | SkillInputEvent;

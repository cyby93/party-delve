import type { InputEvent, JoinRequest, PlayerClass, DifficultyTier } from 'shared-types';

export interface InputEventMsg {
  type: 'input';
  event: InputEvent;
}

export interface JoinRequestMsg {
  type: 'join_request';
  request: JoinRequest;
}

export interface ClassSelectMsg {
  type: 'class:select';
  classId: PlayerClass;
}

export interface RunProposeMsg {
  type: 'run:propose';
  biome: 'grassland';
  difficulty: DifficultyTier;
}

export interface VoteMsg {
  type: 'run:vote';
  accept: boolean;
}

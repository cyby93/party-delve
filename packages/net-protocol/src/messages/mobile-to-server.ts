import type { InputEvent, JoinRequest, PlayerClass } from 'shared-types';

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

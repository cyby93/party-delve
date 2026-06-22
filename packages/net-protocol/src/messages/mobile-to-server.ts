import type { InputEvent, JoinRequest } from 'shared-types';

export interface InputEventMsg {
  type: 'input';
  event: InputEvent;
}

export interface JoinRequestMsg {
  type: 'join_request';
  request: JoinRequest;
}

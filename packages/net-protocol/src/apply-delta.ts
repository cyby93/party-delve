import type { GameState } from 'shared-types';
import type { DeltaEventMsg } from './messages/server-to-host.js';

export function applyDelta(state: GameState, _evt: DeltaEventMsg): GameState {
  // stub — returns state unchanged until delta types are fully implemented in E1.5/E3
  return state;
}

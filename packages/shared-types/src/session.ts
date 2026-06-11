import type { PlayerState } from './player';

/** Session lifecycle states from the session state machine. */
export type SessionState =
  | 'idle'
  | 'creating'
  | 'waiting_for_players'
  | 'in_run'
  | 'ended';

export type SessionEventType =
  | 'session-start'
  | 'session-end'
  | 'player-joined'
  | 'player-left'
  | 'player-reconnected';

/** Broadcast by the simulation server on any session lifecycle transition. */
export interface SessionStateEvent {
  sessionId: string;
  event: SessionEventType;
  tick: number;
  affectedPlayerId?: string;
  /** Only present on player-joined, sent only to the joining player. */
  reconnectToken?: string;
  /** Only present on session-start, directed to the host. The room code players use to join. */
  roomCode?: string;
}

/** Accumulated room state maintained by the host client. */
export interface RoomState {
  sessionId: string;
  sessionState: SessionState;
  players: Record<string, PlayerState>;
  tick: number;
}

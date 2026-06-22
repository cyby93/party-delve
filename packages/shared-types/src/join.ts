import type { SessionColor } from './player.js';

export interface JoinRequest {
  sessionCode: string;
  playerName: string;
}

export interface JoinResponse {
  success: boolean;
  playerId?: string;
  sessionColor?: SessionColor;
  errorCode?: string;
}

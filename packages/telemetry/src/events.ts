export interface TelemetryBaseEvent {
  event: string;
  timestamp: number;
  session_id: string;
  build_version: string;
  mode: 'local' | 'remote';
  region: string | null;
  platform: 'host' | 'mobile' | 'server';
}

export interface SessionCreateStarted extends TelemetryBaseEvent {
  event: 'session_create_started';
  platform: 'host';
}

export interface SessionCreateSucceeded extends TelemetryBaseEvent {
  event: 'session_create_succeeded';
  platform: 'host';
  room_code: string;
  duration_ms: number;
}

export interface JoinAttemptStarted extends TelemetryBaseEvent {
  event: 'join_attempt_started';
  platform: 'mobile';
  player_id: string;
  room_code: string;
}

export interface JoinAttemptSucceeded extends TelemetryBaseEvent {
  event: 'join_attempt_succeeded';
  platform: 'mobile';
  player_id: string;
  duration_ms: number;
}

export interface JoinAttemptFailed extends TelemetryBaseEvent {
  event: 'join_attempt_failed';
  platform: 'mobile';
  player_id: string;
  room_code: string;
  error_code: string;
  duration_ms: number;
}

export type SessionFunnelEvent =
  | SessionCreateStarted
  | SessionCreateSucceeded
  | JoinAttemptStarted
  | JoinAttemptSucceeded
  | JoinAttemptFailed;

export type TelemetryEvent = SessionFunnelEvent;

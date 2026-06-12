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

// ---------------------------------------------------------------------------
// Hub events — KPI funnel step: fires after session.player_joined
// ---------------------------------------------------------------------------

/** Fires once when a player's WebSocket first connects and enters the hub. */
export interface HubPlayerEntered extends TelemetryBaseEvent {
  event: 'hub.player_entered';
  player_id: string;
  slot_index: number;
}

// ---------------------------------------------------------------------------
// Input events — engagement signal: measures active controller usage per session
// ---------------------------------------------------------------------------

/**
 * Fires when joystick delta exceeds dead zone (magnitude > 0.05).
 * Dead zone filtering is applied inside trackInputMove before calling track().
 * Responsibility: mobile controller (client-side filtering reduces event volume).
 */
export interface InputMove extends TelemetryBaseEvent {
  event: 'input.move';
  player_id: string;
  dx: number;
  dy: number;
  sequence_number: number;
}

export type HubEvent = HubPlayerEntered;
export type InputEvent = InputMove;

export type TelemetryEvent = SessionFunnelEvent | HubEvent | InputEvent;

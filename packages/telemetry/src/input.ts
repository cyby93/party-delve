import { track } from './logger';

/** Joystick deltas below this magnitude are considered noise and not tracked. */
const DEAD_ZONE = 0.05;

interface InputMovePayload {
  player_id: string;
  session_id: string;
  dx: number;
  dy: number;
  sequence_number: number;
  timestamp: number;
  build_version?: string;
  mode?: 'local' | 'remote';
  region?: string | null;
}

/**
 * Engagement signal: measures active controller usage per session.
 * Dead zone: no-ops silently when Math.hypot(dx, dy) <= 0.05.
 * Dead zone responsibility: this function (mobile controller calls trackInputMove
 * unconditionally; filtering happens here to reduce event volume on the client).
 */
export function trackInputMove(payload: InputMovePayload): void {
  if (Math.hypot(payload.dx, payload.dy) <= DEAD_ZONE) return;

  track({
    event: 'input.move',
    timestamp: payload.timestamp,
    session_id: payload.session_id,
    build_version: payload.build_version ?? '0.1.0',
    mode: payload.mode ?? 'local',
    region: payload.region ?? null,
    platform: 'mobile',
    player_id: payload.player_id,
    dx: payload.dx,
    dy: payload.dy,
    sequence_number: payload.sequence_number,
  });
}

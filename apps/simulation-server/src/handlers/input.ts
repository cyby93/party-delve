import type { WebSocket } from 'ws';
import type { MoveInputEvent } from 'shared-types';
import type { SessionStore } from '../session-store.js';

export function handleMoveInput(
  socket: WebSocket,
  payload: unknown,
  store: SessionStore,
): void {
  const entry = store.findSlotBySocket(socket);
  if (!entry) {
    console.warn('[input] MoveInputEvent from unknown socket — discarding');
    return;
  }
  const { slot } = entry;
  const p = payload as MoveInputEvent;
  const dir = p?.direction;
  if (
    dir == null ||
    typeof dir.x !== 'number' ||
    typeof dir.y !== 'number' ||
    !isFinite(dir.x) ||
    !isFinite(dir.y)
  ) {
    console.warn('[input] invalid direction payload — discarding');
    return;
  }
  const mag = Math.hypot(dir.x, dir.y);
  if (mag > 1) {
    slot.pendingDirection = { x: dir.x / mag, y: dir.y / mag };
  } else {
    slot.pendingDirection = { x: dir.x, y: dir.y };
  }
}

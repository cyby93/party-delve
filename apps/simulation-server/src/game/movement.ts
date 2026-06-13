import { WebSocket } from 'ws';
import type { PlayerStateSnapshot } from 'shared-types';
import type { SessionStore } from '../session-store.js';
import { send } from '../broadcast.js';

export const PLAYER_SPEED = 100; // world units per second
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;

export function applyMovementTick(
  store: SessionStore,
  tickRateHz: number,
  tick: number,
): void {
  const dt = 1 / tickRateHz;

  for (const session of store.allSessions()) {
    // Phase 1: apply movement for connected players
    for (const slot of session.players.values()) {
      if (!slot.connected) continue;
      const { x: dx, y: dy } = slot.pendingDirection;
      if (dx !== 0 || dy !== 0) {
        slot.position.x = Math.max(0, Math.min(MAP_WIDTH, slot.position.x + dx * PLAYER_SPEED * dt));
        slot.position.y = Math.max(0, Math.min(MAP_HEIGHT, slot.position.y + dy * PLAYER_SPEED * dt));
      }
    }

    // Phase 2: broadcast snapshots for all players (including frozen disconnected ones)
    if (session.hostSocket.readyState !== WebSocket.OPEN) continue;
    for (const slot of session.players.values()) {
      const mag = Math.hypot(slot.pendingDirection.x, slot.pendingDirection.y);
      const snapshot: PlayerStateSnapshot = {
        playerId: slot.playerId,
        tick,
        position: slot.position,
        facing: 0,
        hp: 100,
        maxHp: 100,
        state: mag > 0 && slot.connected ? 'moving' : 'idle',
        activeSkillSlot: 'none',
        connected: slot.connected,
      };
      send(session.hostSocket, { v: 1, t: 'PlayerStateSnapshot', p: snapshot });
    }
  }
}

/**
 * Unit tests for applyMovementTick — determinism, boundary clamping,
 * and disconnect freeze.
 *
 * Import paths are relative to tests/ and resolve once all shard branches
 * are merged: apps/simulation-server/src/game/movement.ts is produced by
 * the simulation-engineer shard (GDS-001).
 */
import { describe, it, expect, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { SessionStore } from '../../apps/simulation-server/src/session-store.js';
import {
  applyMovementTick,
  PLAYER_SPEED,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../../apps/simulation-server/src/game/movement.js';

/** Minimal WebSocket mock — readyState = 0 so applyMovementTick skips broadcast. */
function mockSocket(open = false): WebSocket {
  return { readyState: open ? 1 : 0, send: vi.fn() } as unknown as WebSocket;
}

describe('applyMovementTick', () => {
  describe('movement determinism', () => {
    it('moves a player 5 units in X at full speed for one tick at 20 Hz', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      // direction { x: 1, y: 0 } — full speed rightward
      slot.pendingDirection = { x: 1, y: 0 };

      applyMovementTick(store, 20, 1);

      // dt = 1/20 = 0.05s; displacement = 1 * PLAYER_SPEED * 0.05 = 5
      const expectedX = PLAYER_SPEED / 20; // 5
      expect(slot.position.x).toBeCloseTo(expectedX, 6);
      expect(slot.position.y).toBeCloseTo(0, 6);
    });

    it('does not move a player with zero pendingDirection', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      slot.pendingDirection = { x: 0, y: 0 };
      slot.position = { x: 100, y: 200 };

      applyMovementTick(store, 20, 1);

      expect(slot.position.x).toBe(100);
      expect(slot.position.y).toBe(200);
    });

    it('moves diagonally — both axes advance each tick', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      slot.pendingDirection = { x: 0.6, y: 0.8 }; // magnitude 1.0
      slot.position = { x: 0, y: 0 };

      applyMovementTick(store, 20, 1);

      const dt = 1 / 20;
      expect(slot.position.x).toBeCloseTo(0.6 * PLAYER_SPEED * dt, 6);
      expect(slot.position.y).toBeCloseTo(0.8 * PLAYER_SPEED * dt, 6);
    });
  });

  describe('map boundary clamping', () => {
    it('clamps position.x to MAP_WIDTH when moving past the right edge', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      // Start near the right edge; 3 ticks at full speed will overshoot
      slot.position = { x: MAP_WIDTH - 2, y: 0 };
      slot.pendingDirection = { x: 1, y: 0 };

      for (let i = 0; i < 3; i++) {
        applyMovementTick(store, 20, i + 1);
      }

      expect(slot.position.x).toBeLessThanOrEqual(MAP_WIDTH);
      expect(slot.position.x).toBe(MAP_WIDTH);
    });

    it('clamps position.x to 0 when moving past the left edge', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      slot.position = { x: 0, y: 0 };
      slot.pendingDirection = { x: -1, y: 0 };

      applyMovementTick(store, 20, 1);

      expect(slot.position.x).toBeGreaterThanOrEqual(0);
      expect(slot.position.x).toBe(0);
    });

    it('clamps position.y to MAP_HEIGHT at the bottom edge', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      slot.position = { x: 0, y: MAP_HEIGHT - 1 };
      slot.pendingDirection = { x: 0, y: 1 };

      for (let i = 0; i < 3; i++) {
        applyMovementTick(store, 20, i + 1);
      }

      expect(slot.position.y).toBeLessThanOrEqual(MAP_HEIGHT);
      expect(slot.position.y).toBe(MAP_HEIGHT);
    });

    it('clamps position.y to 0 at the top edge', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const slot = store.addPlayer(session, mockSocket());

      slot.position = { x: 0, y: 0 };
      slot.pendingDirection = { x: 0, y: -1 };

      applyMovementTick(store, 20, 1);

      expect(slot.position.y).toBeGreaterThanOrEqual(0);
      expect(slot.position.y).toBe(0);
    });
  });

  describe('disconnect freeze', () => {
    it('does not move a disconnected player even with non-zero pendingDirection', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const playerSocket = mockSocket();
      const slot = store.addPlayer(session, playerSocket);

      slot.position = { x: 100, y: 100 };

      // Simulate disconnect — freezes connected=false and pendingDirection={0,0}
      store.removeSocket(playerSocket);

      // Manually set a non-zero direction to confirm it's ignored
      slot.pendingDirection = { x: 1, y: 0 };

      applyMovementTick(store, 20, 1);

      // connected=false means the movement branch is skipped
      expect(slot.position.x).toBe(100);
      expect(slot.position.y).toBe(100);
    });

    it('removeSocket sets connected=false and zeros pendingDirection', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const playerSocket = mockSocket();
      const slot = store.addPlayer(session, playerSocket);

      slot.pendingDirection = { x: 0.5, y: 0.3 };

      store.removeSocket(playerSocket);

      expect(slot.connected).toBe(false);
      expect(slot.pendingDirection).toEqual({ x: 0, y: 0 });
      // Position unchanged after disconnect
      expect(slot.position).toEqual({ x: 0, y: 0 });
      // Slot still in session — not removed
      expect(session.players.size).toBe(1);
    });

    it('keeps frozen slot in session after disconnect (host canvas retains dot)', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const playerSocket = mockSocket();
      const slot = store.addPlayer(session, playerSocket);

      slot.position = { x: 300, y: 400 };

      store.removeSocket(playerSocket);

      applyMovementTick(store, 20, 1);

      const frozenSlot = session.players.get(slot.playerId);
      expect(frozenSlot).toBeDefined();
      expect(frozenSlot?.position.x).toBe(300);
      expect(frozenSlot?.position.y).toBe(400);
    });
  });

  describe('no-op on empty store', () => {
    it('does not throw when there are no sessions', () => {
      const store = new SessionStore();
      expect(() => applyMovementTick(store, 20, 1)).not.toThrow();
    });
  });
});

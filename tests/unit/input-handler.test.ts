/**
 * Unit tests for handleMoveInput — direction validation, normalization,
 * NaN/Infinity rejection, and unknown-socket guard.
 *
 * Import paths resolve once all shard branches are merged.
 * apps/simulation-server/src/handlers/input.ts is produced by the
 * simulation-engineer shard (GDS-001).
 */
import { describe, it, expect, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { SessionStore } from '../../apps/simulation-server/src/session-store.js';
import { handleMoveInput } from '../../apps/simulation-server/src/handlers/input.js';

function mockSocket(open = false): WebSocket {
  return { readyState: open ? 1 : 0, send: vi.fn() } as unknown as WebSocket;
}

function makeConnectedPlayer() {
  const store = new SessionStore();
  const session = store.createSession(mockSocket());
  const playerSocket = mockSocket();
  const slot = store.addPlayer(session, playerSocket);
  return { store, session, playerSocket, slot };
}

describe('handleMoveInput', () => {
  describe('direction validation', () => {
    it('stores a valid unit direction', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 1, y: 0 }, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual({ x: 1, y: 0 });
    });

    it('stores a zero-vector stop signal', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      slot.pendingDirection = { x: 0.5, y: 0.3 };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 0, y: 0 }, sequenceNumber: 2, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual({ x: 0, y: 0 });
    });

    it('stores a sub-unit magnitude direction unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 0.6, y: 0.8 }, sequenceNumber: 1, timestamp: 0 }, store);

      // magnitude = 1.0 exactly → no normalization needed
      expect(slot.pendingDirection.x).toBeCloseTo(0.6, 6);
      expect(slot.pendingDirection.y).toBeCloseTo(0.8, 6);
    });
  });

  describe('over-magnitude normalization', () => {
    it('normalizes a direction with magnitude > 1 to unit length', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();

      // magnitude = 5 (3,4,5 Pythagorean triple scaled by 5/5=1 ... wait: hypot(3,4)=5)
      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 3, y: 4 }, sequenceNumber: 1, timestamp: 0 }, store);

      const mag = Math.hypot(slot.pendingDirection.x, slot.pendingDirection.y);
      expect(mag).toBeCloseTo(1, 6);
      // Direction should be preserved: (3/5, 4/5)
      expect(slot.pendingDirection.x).toBeCloseTo(0.6, 6);
      expect(slot.pendingDirection.y).toBeCloseTo(0.8, 6);
    });

    it('normalizes any over-unit vector to magnitude ≤ 1', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 100, y: 0 }, sequenceNumber: 1, timestamp: 0 }, store);

      const mag = Math.hypot(slot.pendingDirection.x, slot.pendingDirection.y);
      expect(mag).toBeLessThanOrEqual(1);
      expect(mag).toBeCloseTo(1, 6);
    });
  });

  describe('invalid direction rejection', () => {
    it('discards NaN x-component — pendingDirection unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      const original = { ...slot.pendingDirection };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: NaN, y: 0 }, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual(original);
    });

    it('discards NaN y-component — pendingDirection unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      const original = { ...slot.pendingDirection };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 0, y: NaN }, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual(original);
    });

    it('discards Infinity x-component — pendingDirection unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      const original = { ...slot.pendingDirection };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: Infinity, y: 0 }, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual(original);
    });

    it('discards -Infinity y-component — pendingDirection unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      const original = { ...slot.pendingDirection };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: { x: 0, y: -Infinity }, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual(original);
    });

    it('discards null direction — pendingDirection unchanged', () => {
      const { store, playerSocket, slot } = makeConnectedPlayer();
      const original = { ...slot.pendingDirection };

      handleMoveInput(playerSocket, { playerId: slot.playerId, direction: null, sequenceNumber: 1, timestamp: 0 }, store);

      expect(slot.pendingDirection).toEqual(original);
    });
  });

  describe('unknown socket guard', () => {
    it('does not throw when socket has no associated player', () => {
      const store = new SessionStore();
      const unknownSocket = mockSocket();

      expect(() =>
        handleMoveInput(unknownSocket, { direction: { x: 1, y: 0 }, sequenceNumber: 1, timestamp: 0 } as never, store),
      ).not.toThrow();
    });

    it('logs a warning for an unknown socket', () => {
      const store = new SessionStore();
      const unknownSocket = mockSocket();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handleMoveInput(unknownSocket, { direction: { x: 1, y: 0 }, sequenceNumber: 1, timestamp: 0 } as never, store);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});

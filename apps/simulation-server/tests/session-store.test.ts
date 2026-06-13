import { describe, it, expect, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { SessionStore } from '../src/session-store.js';

/** Minimal WebSocket mock — only the fields SessionStore touches. */
function mockSocket(): WebSocket {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket;
}

describe('SessionStore', () => {
  describe('createSession', () => {
    it('returns a session with a non-empty sessionId and 4-char roomCode', () => {
      const store = new SessionStore();
      const host = mockSocket();
      const session = store.createSession(host);

      expect(session.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(session.roomCode).toHaveLength(4);
      expect(session.hostSocket).toBe(host);
      expect(session.players.size).toBe(0);
    });

    it('increments sessionCount', () => {
      const store = new SessionStore();
      expect(store.sessionCount).toBe(0);
      store.createSession(mockSocket());
      expect(store.sessionCount).toBe(1);
      store.createSession(mockSocket());
      expect(store.sessionCount).toBe(2);
    });
  });

  describe('findByRoomCode', () => {
    it('finds a session by its exact room code', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      expect(store.findByRoomCode(session.roomCode)).toBe(session);
    });

    it('is case-insensitive', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const lower = session.roomCode.toLowerCase();
      expect(store.findByRoomCode(lower)).toBe(session);
    });

    it('returns undefined for unknown code', () => {
      const store = new SessionStore();
      expect(store.findByRoomCode('XXXX')).toBeUndefined();
    });
  });

  describe('addPlayer', () => {
    it('registers a player slot with unique playerId and reconnectToken', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const playerSocket = mockSocket();
      const slot = store.addPlayer(session, playerSocket);

      expect(slot.playerId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(slot.reconnectToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(slot.socket).toBe(playerSocket);
      expect(session.players.size).toBe(1);
      expect(session.players.get(slot.playerId)).toMatchObject({
        playerId: slot.playerId,
        socket: playerSocket,
        reconnectToken: slot.reconnectToken,
      });
    });

    it('allows up to 4 players', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      for (let i = 0; i < 4; i++) {
        store.addPlayer(session, mockSocket());
      }
      expect(session.players.size).toBe(4);
    });
  });

  describe('removeSocket — host', () => {
    it('removes host and cleans up the session', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);
      const playerSocket = mockSocket();
      store.addPlayer(session, playerSocket);

      const result = store.removeSocket(hostSocket);

      expect(result).toBeDefined();
      expect(result?.role).toBe('host');
      expect(result?.session).toBe(session);
      // Session should be gone
      expect(store.findByRoomCode(session.roomCode)).toBeUndefined();
      expect(store.sessionCount).toBe(0);
    });

    it('returns undefined when socket is unknown', () => {
      const store = new SessionStore();
      expect(store.removeSocket(mockSocket())).toBeUndefined();
    });
  });

  describe('removeSocket — player', () => {
    it('freezes the player slot on disconnect (keeps in session, marks connected false)', () => {
      const store = new SessionStore();
      const session = store.createSession(mockSocket());
      const playerSocket = mockSocket();
      const slot = store.addPlayer(session, playerSocket);

      const result = store.removeSocket(playerSocket);

      expect(result).toBeDefined();
      expect(result?.role).toBe('player');
      expect(result?.playerId).toBe(slot.playerId);
      expect(result?.session).toBe(session);
      // Session remains; slot is frozen (not removed) so the host canvas retains the dot
      expect(session.players.size).toBe(1);
      expect(store.sessionCount).toBe(1);
      const frozen = session.players.get(slot.playerId);
      expect(frozen?.connected).toBe(false);
      expect(frozen?.pendingDirection).toEqual({ x: 0, y: 0 });
    });
  });

  describe('allSockets', () => {
    it('returns host socket when no players are present', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);

      expect(store.allSockets(session)).toEqual([hostSocket]);
    });

    it('returns host + all player sockets', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);
      const p1 = mockSocket();
      const p2 = mockSocket();
      store.addPlayer(session, p1);
      store.addPlayer(session, p2);

      const sockets = store.allSockets(session);
      expect(sockets).toHaveLength(3);
      expect(sockets[0]).toBe(hostSocket);
      expect(sockets).toContain(p1);
      expect(sockets).toContain(p2);
    });
  });
});

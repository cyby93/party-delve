import { describe, it, expect, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { SessionStore } from '../src/session-store.js';
import { handleJoin } from '../src/handlers/join.js';

/** Minimal WebSocket mock. */
function mockSocket(): WebSocket {
  return { readyState: 1, send: vi.fn() } as unknown as WebSocket;
}

/** Parse the most recent JSON string sent to a mock socket. */
function lastSent(socket: WebSocket): unknown {
  const mock = (socket.send as ReturnType<typeof vi.fn>);
  const calls = mock.mock.calls;
  if (calls.length === 0) return undefined;
  const lastArg = calls[calls.length - 1][0] as string;
  return JSON.parse(lastArg);
}

describe('handleJoin', () => {
  describe('host join', () => {
    it('creates a session and sends SessionStateEvent {event:"session-start"} back to host', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();

      handleJoin(hostSocket, { role: 'host' }, store, 0);

      expect(store.sessionCount).toBe(1);
      const msg = lastSent(hostSocket) as { v: number; t: string; p: Record<string, unknown> };
      expect(msg.t).toBe('SessionStateEvent');
      expect(msg.v).toBe(1);
      expect(msg.p.event).toBe('session-start');
      expect(typeof msg.p.sessionId).toBe('string');
      expect(typeof msg.p.roomCode).toBe('string');
      expect((msg.p.roomCode as string)).toHaveLength(4);
    });

    it('does not send to other sockets', () => {
      const store = new SessionStore();
      const otherSocket = mockSocket();
      // Add another session so otherSocket exists somewhere
      store.createSession(otherSocket);

      const hostSocket = mockSocket();
      handleJoin(hostSocket, { role: 'host' }, store, 0);

      // otherSocket.send should not have been called
      expect((otherSocket.send as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    });
  });

  describe('player join — valid room code', () => {
    it('broadcasts SessionStateEvent {event:"player-joined"} to all sockets', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);

      const playerSocket = mockSocket();
      handleJoin(playerSocket, { role: 'player', roomCode: session.roomCode }, store, 5);

      // Both host and player should have received the broadcast
      const hostMsg = lastSent(hostSocket) as { v: number; t: string; p: Record<string, unknown> };
      const playerMsg = lastSent(playerSocket) as { v: number; t: string; p: Record<string, unknown> };

      expect(hostMsg.t).toBe('SessionStateEvent');
      expect(hostMsg.p.event).toBe('player-joined');
      expect(typeof hostMsg.p.affectedPlayerId).toBe('string');
      expect(typeof hostMsg.p.reconnectToken).toBe('string');
      expect(hostMsg.p.tick).toBe(5);

      expect(playerMsg.t).toBe('SessionStateEvent');
      expect(playerMsg.p.event).toBe('player-joined');
    });

    it('accepts room code case-insensitively', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);

      const playerSocket = mockSocket();
      handleJoin(
        playerSocket,
        { role: 'player', roomCode: session.roomCode.toLowerCase() },
        store,
        0,
      );

      const msg = lastSent(playerSocket) as { p: { event: string } };
      expect(msg.p.event).toBe('player-joined');
    });
  });

  describe('player join — invalid room code', () => {
    it('sends an error envelope with code ROOM_NOT_FOUND', () => {
      const store = new SessionStore();
      const playerSocket = mockSocket();

      handleJoin(playerSocket, { role: 'player', roomCode: 'ZZZZ' }, store, 0);

      const msg = lastSent(playerSocket) as { t: string; p: { code: string } };
      expect(msg.t).toBe('error');
      expect(msg.p.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('player join — full room', () => {
    it('sends ROOM_FULL error when 4 players are already in the session', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);

      // Fill up to 4 players
      for (let i = 0; i < 4; i++) {
        const s = mockSocket();
        handleJoin(s, { role: 'player', roomCode: session.roomCode }, store, 0);
      }

      // 5th player
      const fifthSocket = mockSocket();
      handleJoin(fifthSocket, { role: 'player', roomCode: session.roomCode }, store, 0);

      const msg = lastSent(fifthSocket) as { t: string; p: { code: string } };
      expect(msg.t).toBe('error');
      expect(msg.p.code).toBe('ROOM_FULL');
    });

    it('allows exactly 4 players to join', () => {
      const store = new SessionStore();
      const hostSocket = mockSocket();
      const session = store.createSession(hostSocket);

      for (let i = 0; i < 4; i++) {
        const s = mockSocket();
        handleJoin(s, { role: 'player', roomCode: session.roomCode }, store, 0);
        const msg = lastSent(s) as { p: { event: string } };
        expect(msg.p.event).toBe('player-joined');
      }
      expect(session.players.size).toBe(4);
    });
  });
});

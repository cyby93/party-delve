import type { WebSocket } from 'ws';
import type { JoinRequest, SessionStateEvent } from 'shared-types';
import type { SessionStore } from '../session-store.js';
import { send, broadcast } from '../broadcast.js';

const MAX_PLAYERS = 4;
const PROTOCOL_VERSION = 1;

/** Build a typed MessageEnvelope for SessionStateEvent payloads. */
function sessionEnvelope(event: SessionStateEvent) {
  return { v: PROTOCOL_VERSION, t: 'SessionStateEvent' as const, p: event };
}

/** Build an error envelope. */
function errorEnvelope(code: string, message: string) {
  return { v: PROTOCOL_VERSION, t: 'error' as const, p: { code, message } };
}

export function handleJoin(
  socket: WebSocket,
  payload: unknown,
  store: SessionStore,
  tick: number,
): void {
  const req = payload as JoinRequest;

  if (req.role === 'host') {
    const session = store.createSession(socket);
    const event: SessionStateEvent = {
      sessionId: session.sessionId,
      event: 'session-start',
      tick,
      roomCode: session.roomCode,
    };
    send(socket, sessionEnvelope(event));
    console.log(
      `[join] host created session ${session.sessionId} roomCode=${session.roomCode}`,
    );
    return;
  }

  if (req.role === 'player') {
    const session = store.findByRoomCode(req.roomCode);
    if (!session) {
      send(
        socket,
        errorEnvelope('ROOM_NOT_FOUND', `No session with room code ${req.roomCode}`),
      );
      return;
    }
    if (session.players.size >= MAX_PLAYERS) {
      send(socket, errorEnvelope('ROOM_FULL', 'Session is full (4 players max)'));
      return;
    }
    const slot = store.addPlayer(session, socket);
    const event: SessionStateEvent = {
      sessionId: session.sessionId,
      event: 'player-joined',
      tick,
      affectedPlayerId: slot.playerId,
      reconnectToken: slot.reconnectToken,
    };
    // Broadcast to host + all players in the session.
    // Note: reconnectToken is visible to all sockets in P1; Phase 5 will direct it
    // only to the joining player after per-socket filtering is added.
    broadcast(store.allSockets(session), sessionEnvelope(event));
    console.log(
      `[join] player ${slot.playerId} joined session ${session.sessionId}`,
    );
    return;
  }
}

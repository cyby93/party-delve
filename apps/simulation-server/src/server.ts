import { WebSocket, WebSocketServer } from 'ws';
import { isMessageEnvelope, EVENT_NAMES } from 'net-protocol';
import type { SessionStore } from './session-store.js';
import { handleJoin } from './handlers/join.js';
import { handleMoveInput } from './handlers/input.js';

export interface WsServerWithTick extends WebSocketServer {
  setTick(tick: number): void;
}

export function createWsServer(port: number, store: SessionStore): WsServerWithTick {
  const wss = new WebSocketServer({ port });
  let currentTick = 0;

  wss.on('listening', () => {
    console.log(`[server] WebSocket listening on port ${port}`);
  });

  wss.on('connection', (socket, req) => {
    const remote = req.socket.remoteAddress ?? 'unknown';
    console.log(`[server] client connected from ${remote}`);

    socket.on('message', (data) => {
      try {
        const msg: unknown = JSON.parse(data.toString());
        if (!isMessageEnvelope(msg)) {
          console.warn('[server] invalid envelope — ignoring');
          return;
        }
        switch (msg.t) {
          case EVENT_NAMES.JOIN:
            handleJoin(socket, msg.p, store, currentTick);
            break;
          case EVENT_NAMES.MOVE_INPUT_EVENT:
            handleMoveInput(socket, msg.p, store);
            break;
          default:
            console.log(`[server] unhandled event: ${msg.t}`);
        }
      } catch {
        console.warn('[server] failed to parse message');
      }
    });

    socket.on('close', () => {
      console.log(`[server] client disconnected from ${remote}`);
      const removed = store.removeSocket(socket);
      if (!removed) return;

      if (removed.role === 'player' && removed.playerId) {
        const { session } = removed;
        const event = {
          v: 1 as const,
          t: 'SessionStateEvent' as const,
          p: {
            sessionId: session.sessionId,
            event: 'player-left' as const,
            tick: currentTick,
            affectedPlayerId: removed.playerId,
          },
        };
        const remaining = store.allSockets(session);
        for (const s of remaining) {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(event));
          }
        }
        console.log(
          `[join] player ${removed.playerId} left session ${session.sessionId}`,
        );
      }
      // Host close: session already cleaned up by removeSocket; no broadcast needed for P1.
    });
  });

  const extended = Object.assign(wss, {
    setTick(t: number) {
      currentTick = t;
    },
  });

  return extended;
}

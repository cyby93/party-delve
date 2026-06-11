import { useEffect, useRef, useState } from 'react';
import type { SessionStateEvent } from 'shared-types';
import type { MessageEnvelope } from 'net-protocol';
import { track } from 'telemetry';

export interface PlayerEntry {
  playerId: string;
  connected: boolean;
}

export interface HostSessionState {
  status: 'connecting' | 'connected' | 'offline';
  sessionId: string | null;
  roomCode: string | null;
  players: PlayerEntry[];
}

export function useHostSession(url: string): HostSessionState {
  const [state, setState] = useState<HostSessionState>({
    status: 'connecting',
    sessionId: null,
    roomCode: null,
    players: [],
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket;
    // Closure variables shared between onopen and onmessage for timing the session create funnel.
    let createStartedAt = 0;
    let provisionalSessionId = '';

    try {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        createStartedAt = Date.now();
        provisionalSessionId = crypto.randomUUID();
        track({
          event: 'session_create_started',
          timestamp: createStartedAt,
          session_id: provisionalSessionId,
          build_version: '0.1.0',
          mode: 'local',
          region: null,
          platform: 'host',
        });
        ws.send(JSON.stringify({ v: 1, t: 'join', p: { role: 'host' } }));
        setState(s => ({ ...s, status: 'connected' }));
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data as string) as MessageEnvelope<unknown>;
          if (msg.t !== 'SessionStateEvent') return;
          const payload = msg.p as SessionStateEvent;

          setState(s => {
            switch (payload.event) {
              case 'session-start':
                track({
                  event: 'session_create_succeeded',
                  timestamp: Date.now(),
                  session_id: payload.sessionId,
                  build_version: '0.1.0',
                  mode: 'local',
                  region: null,
                  platform: 'host',
                  room_code: payload.roomCode ?? '',
                  duration_ms: Date.now() - createStartedAt,
                });
                return {
                  ...s,
                  sessionId: payload.sessionId,
                  roomCode: payload.roomCode ?? null,
                };
              case 'player-joined': {
                if (!payload.affectedPlayerId) return s;
                // avoid duplicates
                if (s.players.some(p => p.playerId === payload.affectedPlayerId)) return s;
                return {
                  ...s,
                  players: [...s.players, { playerId: payload.affectedPlayerId, connected: true }],
                };
              }
              case 'player-left':
                return {
                  ...s,
                  players: s.players.map(p =>
                    p.playerId === payload.affectedPlayerId ? { ...p, connected: false } : p
                  ),
                };
              default:
                return s;
            }
          });
        } catch { /* ignore parse errors */ }
      };

      ws.onerror = () => {
        if (!cancelled) setState(s => ({ ...s, status: 'offline' }));
      };
      ws.onclose = () => {
        if (!cancelled) setState(s => ({ ...s, status: 'offline' }));
      };
    } catch {
      setState(s => ({ ...s, status: 'offline' }));
    }

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [url]);

  return state;
}

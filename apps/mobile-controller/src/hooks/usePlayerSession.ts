import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionStateEvent } from 'shared-types';

type ConnectionStatus = 'connecting' | 'connected' | 'offline';
type JoinStatus = 'idle' | 'joining' | 'joined' | 'error';

export interface PlayerSessionState {
  connectionStatus: ConnectionStatus;
  joinStatus: JoinStatus;
  joinError: string | null;
  sessionId: string | null;
  playerId: string | null;
  reconnectToken: string | null;
  join: (roomCode: string) => void;
}

export function usePlayerSession(url: string): PlayerSessionState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [joinStatus, setJoinStatus] = useState<JoinStatus>('idle');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [reconnectToken, setReconnectToken] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Use a ref to avoid stale closure in onmessage
  const joinStatusRef = useRef<JoinStatus>('idle');

  // Keep joinStatusRef in sync with state
  useEffect(() => {
    joinStatusRef.current = joinStatus;
  }, [joinStatus]);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnectionStatus('connected');
      };
      ws.onerror = () => {
        if (!cancelled) setConnectionStatus('offline');
      };
      ws.onclose = () => {
        if (!cancelled) setConnectionStatus('offline');
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(ev.data as string) as { t: string; p: unknown };

          if (msg.t === 'SessionStateEvent') {
            const payload = msg.p as SessionStateEvent;
            // Accept the first player-joined event while we have a pending join.
            // The server broadcasts to all sockets; since this client only has
            // one pending join at a time, the first player-joined we receive is ours.
            if (
              payload.event === 'player-joined' &&
              joinStatusRef.current === 'joining'
            ) {
              setSessionId(payload.sessionId);
              setPlayerId(payload.affectedPlayerId ?? null);
              setReconnectToken(payload.reconnectToken ?? null);
              setJoinStatus('joined');
            }
          }

          if (msg.t === 'error') {
            const err = msg.p as { code: string; message: string };
            setJoinError(err.message ?? err.code);
            setJoinStatus('error');
          }
        } catch {
          // Ignore malformed messages
        }
      };
    } catch {
      setConnectionStatus('offline');
    }

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, [url]);

  const join = useCallback((roomCode: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Set the ref immediately so onmessage sees 'joining' even before
    // the state setter has flushed.
    joinStatusRef.current = 'joining';
    setJoinStatus('joining');
    setJoinError(null);
    ws.send(
      JSON.stringify({
        v: 1,
        t: 'join',
        p: { role: 'player', roomCode: roomCode.toUpperCase() },
      }),
    );
  }, []);

  return {
    connectionStatus,
    joinStatus,
    joinError,
    sessionId,
    playerId,
    reconnectToken,
    join,
  };
}

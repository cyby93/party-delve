import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionStateEvent } from 'shared-types';
import { track } from 'telemetry';

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
  sendMessage: (envelope: object) => void;
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
  // Telemetry timing refs shared across effect and join callback
  const joinStartedAtRef = useRef<number | null>(null);
  const provisionalPlayerIdRef = useRef<string | null>(null);
  const lastRoomCodeRef = useRef<string | null>(null);

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
              track({
                event: 'join_attempt_succeeded',
                timestamp: Date.now(),
                session_id: payload.sessionId,
                build_version: '0.1.0',
                mode: 'local',
                region: null,
                platform: 'mobile',
                player_id: payload.affectedPlayerId ?? provisionalPlayerIdRef.current ?? '',
                duration_ms: Date.now() - (joinStartedAtRef.current ?? Date.now()),
              });
              setSessionId(payload.sessionId);
              setPlayerId(payload.affectedPlayerId ?? null);
              setReconnectToken(payload.reconnectToken ?? null);
              setJoinStatus('joined');
            }
          }

          if (msg.t === 'error') {
            const err = msg.p as { code: string; message: string };
            track({
              event: 'join_attempt_failed',
              timestamp: Date.now(),
              session_id: '',
              build_version: '0.1.0',
              mode: 'local',
              region: null,
              platform: 'mobile',
              player_id: provisionalPlayerIdRef.current ?? '',
              room_code: lastRoomCodeRef.current ?? '',
              error_code: err.code,
              duration_ms: Date.now() - (joinStartedAtRef.current ?? Date.now()),
            });
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

    const joinStartedAt = Date.now();
    const provisionalPlayerId = crypto.randomUUID();
    joinStartedAtRef.current = joinStartedAt;
    provisionalPlayerIdRef.current = provisionalPlayerId;
    lastRoomCodeRef.current = roomCode.toUpperCase();

    track({
      event: 'join_attempt_started',
      timestamp: joinStartedAt,
      // session_id is not known before join completes; spec allows empty for started event
      session_id: '',
      build_version: '0.1.0',
      mode: 'local',
      region: null,
      platform: 'mobile',
      player_id: provisionalPlayerId,
      room_code: roomCode.toUpperCase(),
    });

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

  const sendMessage = useCallback((envelope: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }, []);

  return {
    connectionStatus,
    joinStatus,
    joinError,
    sessionId,
    playerId,
    reconnectToken,
    join,
    sendMessage,
  };
}

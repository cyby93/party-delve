import { useState, useCallback, useEffect, useRef } from 'react';
import { AuthChoiceScreen } from './screens/AuthChoiceScreen';
import { SessionCodeEntryScreen } from './screens/SessionCodeEntryScreen';
import { OrientationPromptScreen } from './screens/OrientationPromptScreen';
import { ControllerScreen } from './screens/ControllerScreen';
import { ReconnectScreen } from './screens/ReconnectScreen';
import { joinSession, reconnectToSession, getPersistedSession, clearPersistedSession, type MobileSession } from './session/mobile-session';
import type { GameState } from 'shared-types';
import type { DeltaEventMsg, CooldownUpdateMsg } from 'net-protocol';
import { applyDelta } from 'net-protocol';

export interface CooldownState {
  startAt: number;
  expiresAt: number;
}

type AppScreen = 'auth-choice' | 'session-entry' | 'orientation-prompt' | 'controller' | 'reconnect';

// CloseCode.CONSENTED = 4000 (Colyseus intentional leave — do not show reconnect screen)
const CLOSE_CONSENTED = 4000;

export function App() {
  const [screen, setScreen] = useState<AppScreen>('auth-choice');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [cooldowns, setCooldowns] = useState<(CooldownState | null)[]>([null, null, null, null]);
  const [runOutcome, setRunOutcome] = useState<'complete' | 'failed' | null>(null);
  const [reconnectRoomId, setReconnectRoomId] = useState<string>('');
  const [sessionEntryInitialCode, setSessionEntryInitialCode] = useState<string | undefined>(undefined);
  // Ref keeps handleDelta dep-free while always reading the live playerId.
  // The callback is wired into room.onMessage once at join time — a closure
  // over `session` state would capture null and never update.
  const sessionRef = useRef<MobileSession | null>(null);

  useEffect(() => {
    return () => { session?.disconnect(); };
  }, [session]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const handleDelta = useCallback((delta: DeltaEventMsg) => {
    // Skip self-targeted freeze/thaw deltas — the mobile controller should not
    // freeze its own state based on the server's broadcast to all clients.
    if (
      (delta.type === 'player:disconnected' || delta.type === 'player:reconnected') &&
      delta.playerId === sessionRef.current?.playerId
    ) {
      return;
    }
    if (delta.type === 'run:complete') setRunOutcome('complete');
    else if (delta.type === 'run:failed') setRunOutcome('failed');
    setGameState(prev => prev !== null ? applyDelta(prev, delta) : prev);
  }, []);

  const handleCooldownUpdate = useCallback((msg: CooldownUpdateMsg) => {
    setCooldowns(prev => {
      const next = [...prev] as (CooldownState | null)[];
      if (msg.remainingMs > 0) {
        const now = Date.now();
        next[msg.abilityIndex] = { startAt: now, expiresAt: now + msg.remainingMs };
      } else {
        next[msg.abilityIndex] = null;
      }
      return next;
    });
  }, []);

  const handleDisconnect = useCallback((code: number) => {
    if (code === CLOSE_CONSENTED) {
      clearPersistedSession();
      return;
    }
    const persisted = getPersistedSession();
    setReconnectRoomId(persisted?.roomId ?? '');
    setScreen('reconnect');
  }, []);

  const handleGuestContinue = useCallback(() => {
    setSessionEntryInitialCode(undefined);
    setScreen('session-entry');
  }, []);

  const handleJoin = useCallback(async (roomId: string, playerName: string) => {
    try {
      const s = await joinSession(
        roomId,
        playerName,
        setGameState,
        handleDelta,
        handleCooldownUpdate,
        (code, msg) => { console.warn('[session] room error after join', code, msg); },
        handleDisconnect,
      );
      setSession(s);
      // delay navigation so SessionCodeEntryScreen renders the accent-purify flash (AC4)
      setTimeout(() => setScreen('orientation-prompt'), 500);
    } catch (err) {
      throw err; // re-throw so SessionCodeEntryScreen can reset its loading state and show the error
    }
  }, [handleDelta, handleCooldownUpdate, handleDisconnect]);

  const handleOrientationDismiss = useCallback(() => {
    setScreen('controller');
  }, []);

  const handleReconnect = useCallback(async () => {
    const persisted = getPersistedSession();
    if (!persisted) throw new Error('no session data');
    const s = await reconnectToSession(
      persisted.reconnectionToken,
      setGameState,
      handleDelta,
      handleCooldownUpdate,
      (code, msg) => { console.warn('[session] reconnect error', code, msg); },
      handleDisconnect,
    );
    setSession(s);
    setCooldowns([null, null, null, null]);
    setScreen('controller');
  }, [handleDelta, handleCooldownUpdate, handleDisconnect]);

  const handleGiveUp = useCallback(() => {
    clearPersistedSession();
    setSession(null);
    setSessionEntryInitialCode(reconnectRoomId || undefined);
    setScreen('session-entry');
  }, [reconnectRoomId]);

  if (screen === 'auth-choice') {
    return <AuthChoiceScreen onGuestContinue={handleGuestContinue} />;
  }
  if (screen === 'session-entry') {
    return (
      <SessionCodeEntryScreen
        {...(sessionEntryInitialCode !== undefined ? { initialCode: sessionEntryInitialCode } : {})}
        onJoin={handleJoin}
      />
    );
  }
  if (screen === 'orientation-prompt') {
    return <OrientationPromptScreen onDismiss={handleOrientationDismiss} />;
  }
  if (screen === 'reconnect') {
    return (
      <ReconnectScreen
        roomId={reconnectRoomId}
        onReconnect={handleReconnect}
        onGiveUp={handleGiveUp}
      />
    );
  }
  if (gameState?.session.phase === 'post-run' && runOutcome === 'failed') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: 'var(--corruption-blood)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-xl)',
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}>
          Run Failed
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}>
          Return to Camp — coming soon.
        </div>
      </div>
    );
  }
  if (gameState?.session.phase === 'post-run' && runOutcome === 'complete') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-xl)',
          color: 'var(--accent-spirit)',
          textAlign: 'center',
        }}>
          Level Clear!
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
        }}>
          Return to Camp — coming soon.
        </div>
      </div>
    );
  }
  return <ControllerScreen session={session} gameState={gameState} cooldowns={cooldowns} />;
}

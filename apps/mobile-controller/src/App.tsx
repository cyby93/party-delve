import { useState, useCallback, useEffect, useRef } from 'react';
import { AuthChoiceScreen } from './screens/AuthChoiceScreen';
import { SessionCodeEntryScreen } from './screens/SessionCodeEntryScreen';
import { OrientationPromptScreen } from './screens/OrientationPromptScreen';
import { ControllerScreen, ClassSelectionScreen } from './screens/ControllerScreen';
import { ReconnectScreen } from './screens/ReconnectScreen';
import { joinSession, reconnectToSession, getPersistedSession, clearPersistedSession, type MobileSession } from './session/mobile-session';
import type { GameState } from 'shared-types';
import type { DeltaEventMsg, CooldownUpdateMsg, BondNotificationMsg, RunVictoryMsg } from 'net-protocol';
import { applyDelta } from 'net-protocol';

export interface CooldownState {
  startAt: number;
  expiresAt: number;
}

type AppScreen = 'auth-choice' | 'session-entry' | 'class-select-forced' | 'orientation-prompt' | 'controller' | 'reconnect';

// CloseCode.CONSENTED = 4000 (Colyseus intentional leave — do not show reconnect screen)
const CLOSE_CONSENTED = 4000;

function PostRunMobileScreen({ isVictory, onReturnToCamp }: { isVictory: boolean; onReturnToCamp: () => void }) {
  const [returned, setReturned] = useState(false);
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: isVictory ? 'var(--bg-base)' : 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: '0 32px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        color: isVictory ? 'var(--accent-spirit)' : 'var(--text-secondary)',
        textAlign: 'center',
      }}>
        {isVictory ? 'Victory!' : 'Run Ended'}
      </div>
      <button
        disabled={returned}
        onPointerDown={e => {
          if (returned) return;
          e.preventDefault();
          setReturned(true);
          onReturnToCamp();
        }}
        style={{
          minHeight: 56,
          minWidth: 200,
          background: returned ? 'var(--bg-surface)' : 'var(--interactive)',
          border: 'none',
          borderRadius: 8,
          cursor: returned ? 'default' : 'pointer',
          opacity: returned ? 0.5 : 1,
          pointerEvents: returned ? 'none' : 'auto',
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-md)',
          color: returned ? 'var(--text-secondary)' : 'var(--bg-base)',
          touchAction: 'manipulation',
        }}
      >
        {returned ? 'Waiting for others…' : 'Return to Camp'}
      </button>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<AppScreen>('auth-choice');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [cooldowns, setCooldowns] = useState<(CooldownState | null)[]>([null, null, null, null]);
  const [runOutcome, setRunOutcome] = useState<'complete' | 'failed' | null>(null);
  const [bondNotification, setBondNotification] = useState<BondNotificationMsg | null>(null);
  const [runVictoryEssence, setRunVictoryEssence] = useState<number | null>(null);
  const [inBondMoment, setInBondMoment] = useState(false);
  const [reconnectRoomId, setReconnectRoomId] = useState<string>('');
  const [sessionEntryInitialCode, setSessionEntryInitialCode] = useState<string | undefined>(undefined);
  // Ref keeps handleDelta dep-free while always reading the live playerId.
  // The callback is wired into room.onMessage once at join time — a closure
  // over `session` state would capture null and never update.
  const sessionRef = useRef<MobileSession | null>(null);
  const bondMomentLevelRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    return () => { session?.disconnect(); };
  }, [session]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    if (gameState?.session.phase === 'hub') {
      setRunOutcome(null);
      setRunVictoryEssence(null);
    }
  }, [gameState?.session.phase]);

  const handleDelta = useCallback((delta: DeltaEventMsg) => {
    // Skip self-targeted freeze/thaw deltas — the mobile controller should not
    // freeze its own state based on the server's broadcast to all clients.
    if (
      (delta.type === 'player:disconnected' || delta.type === 'player:reconnected') &&
      delta.playerId === sessionRef.current?.playerId
    ) {
      return;
    }
    if (delta.type === 'bond:assigned') {
      bondMomentLevelRef.current = gameStateRef.current?.session.levelIndex ?? null;
      setInBondMoment(true);
    }
    if (delta.type === 'run:complete') { setRunOutcome('complete'); setRunVictoryEssence(null); setInBondMoment(false); setBondNotification(null); }
    else if (delta.type === 'run:failed') { setRunOutcome('failed'); setRunVictoryEssence(null); setInBondMoment(false); setBondNotification(null); }
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

  const handleBondNotification = useCallback((msg: BondNotificationMsg) => {
    setBondNotification(msg);
  }, []);

  const handleRunVictory = useCallback((msg: RunVictoryMsg) => {
    setRunVictoryEssence(msg.essenceEarned);
    setRunOutcome('complete');
  }, []);

  const handleJoin = useCallback(async (roomId: string, playerName: string) => {
    try {
      const s = await joinSession(
        roomId,
        playerName,
        setGameState,
        handleDelta,
        handleCooldownUpdate,
        handleBondNotification,
        handleRunVictory,
        (code, msg) => { console.warn('[session] room error after join', code, msg); },
        handleDisconnect,
      );
      setSession(s);
      history.replaceState(null, '', '?session=' + roomId);
      setScreen('class-select-forced');
    } catch (err) {
      throw err; // re-throw so SessionCodeEntryScreen can reset its loading state and show the error
    }
  }, [handleDelta, handleCooldownUpdate, handleBondNotification, handleRunVictory, handleDisconnect]);

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
      handleBondNotification,
      handleRunVictory,
      (code, msg) => { console.warn('[session] reconnect error', code, msg); },
      handleDisconnect,
    );
    setSession(s);
    setCooldowns([null, null, null, null]);
    setInBondMoment(false);
    setBondNotification(null);
    bondMomentLevelRef.current = null;
    setScreen('controller');
  }, [handleDelta, handleCooldownUpdate, handleBondNotification, handleRunVictory, handleDisconnect]);

  useEffect(() => {
    if (!inBondMoment || bondMomentLevelRef.current === null) return;
    const level = gameState?.session.levelIndex;
    if (level !== undefined && level !== bondMomentLevelRef.current) {
      setInBondMoment(false);
      setBondNotification(null);
      bondMomentLevelRef.current = null;
    }
  }, [gameState?.session.levelIndex, inBondMoment]);

  const handleContinue = useCallback(() => { sessionRef.current?.sendContinue(); }, []);

  const handleGiveUp = useCallback(() => {
    clearPersistedSession();
    setSession(null);
    setRunVictoryEssence(null);
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
  if (screen === 'class-select-forced') {
    return (
      <ClassSelectionScreen
        onBack={() => {
          session?.disconnect();
          setSession(null);
          setScreen('session-entry');
        }}
        onPickClass={(classId) => {
          session?.sendClassSelect({ type: 'class:select', classId });
          setScreen('orientation-prompt');
        }}
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
  if (gameState?.session.phase === 'post-run' && session !== null) {
    return (
      <PostRunMobileScreen
        isVictory={runOutcome === 'complete'}
        onReturnToCamp={() => session.sendReturnToCamp()}
      />
    );
  }
  if (runVictoryEssence !== null && gameState?.session.phase !== 'post-run') {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '0 32px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          color: 'var(--accent-spirit)',
          textAlign: 'center',
        }}>
          Victory!
        </div>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 24,
          color: '#f0c070',
          textAlign: 'center',
        }}>
          {runVictoryEssence} Spirit Essence
        </div>
        <button
          disabled
          style={{
            minHeight: 44,
            minWidth: 160,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            opacity: 0.6,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            color: 'var(--text-secondary)',
            touchAction: 'manipulation',
          }}
        >
          Return to Camp
        </button>
      </div>
    );
  }
  return <ControllerScreen session={session} gameState={gameState} cooldowns={cooldowns} bondNotification={bondNotification} inBondMoment={inBondMoment} onContinue={handleContinue} />;
}

import { useState, useCallback, useEffect } from 'react';
import { AuthChoiceScreen } from './screens/AuthChoiceScreen';
import { SessionCodeEntryScreen } from './screens/SessionCodeEntryScreen';
import { OrientationPromptScreen } from './screens/OrientationPromptScreen';
import { ControllerScreen } from './screens/ControllerScreen';
import { ReconnectScreen } from './screens/ReconnectScreen';
import { joinSession, reconnectToSession, getPersistedSession, clearPersistedSession, type MobileSession } from './session/mobile-session';
import type { GameState } from 'shared-types';
import type { DeltaEventMsg } from 'net-protocol';
import { applyDelta } from 'net-protocol';

type AppScreen = 'auth-choice' | 'session-entry' | 'orientation-prompt' | 'controller' | 'reconnect';

// CloseCode.CONSENTED = 4000 (Colyseus intentional leave — do not show reconnect screen)
const CLOSE_CONSENTED = 4000;

export function App() {
  const [screen, setScreen] = useState<AppScreen>('auth-choice');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [reconnectRoomId, setReconnectRoomId] = useState<string>('');

  useEffect(() => {
    return () => { session?.disconnect(); };
  }, [session]);

  const handleDelta = useCallback((delta: DeltaEventMsg) => {
    setGameState(prev => prev !== null ? applyDelta(prev, delta) : prev);
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
    setScreen('session-entry');
  }, []);

  const handleJoin = useCallback(async (roomId: string, playerName: string) => {
    try {
      const s = await joinSession(
        roomId,
        playerName,
        setGameState,
        handleDelta,
        (code, msg) => { console.warn('[session] room error after join', code, msg); },
        handleDisconnect,
      );
      setSession(s);
      // delay navigation so SessionCodeEntryScreen renders the accent-purify flash (AC4)
      setTimeout(() => setScreen('orientation-prompt'), 500);
    } catch (err) {
      throw err; // re-throw so SessionCodeEntryScreen can reset its loading state and show the error
    }
  }, [handleDelta, handleDisconnect]);

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
      (code, msg) => { console.warn('[session] reconnect error', code, msg); },
      handleDisconnect,
    );
    setSession(s);
    setScreen('controller');
  }, [handleDelta, handleDisconnect]);

  const handleGiveUp = useCallback(() => {
    clearPersistedSession();
    setSession(null);
    setScreen('session-entry');
  }, []);

  if (screen === 'auth-choice') {
    return <AuthChoiceScreen onGuestContinue={handleGuestContinue} />;
  }
  if (screen === 'session-entry') {
    return <SessionCodeEntryScreen onJoin={handleJoin} />;
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
  return <ControllerScreen session={session} gameState={gameState} />;
}

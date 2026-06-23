import { useState, useCallback, useEffect } from 'react';
import { AuthChoiceScreen } from './screens/AuthChoiceScreen';
import { SessionCodeEntryScreen } from './screens/SessionCodeEntryScreen';
import { OrientationPromptScreen } from './screens/OrientationPromptScreen';
import { ControllerScreen } from './screens/ControllerScreen';
import { joinSession, type MobileSession } from './session/mobile-session';
import type { GameState } from 'shared-types';

type AppScreen = 'auth-choice' | 'session-entry' | 'orientation-prompt' | 'controller';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('auth-choice');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // P4: disconnect the Colyseus room when the session changes or the component unmounts
  useEffect(() => {
    return () => { session?.disconnect(); };
  }, [session]);

  const handleGuestContinue = useCallback(() => {
    setScreen('session-entry');
  }, []);

  const handleJoin = useCallback(async (roomId: string, playerName: string) => {
    try {
      const s = await joinSession(
        roomId,
        playerName,
        setGameState,
        (_delta) => { /* delta processing in Story 1.5 */ },
        (code, msg) => { console.warn('[session] room error after join', code, msg); }
      );
      setSession(s);
      // delay navigation so SessionCodeEntryScreen renders the accent-purify flash (AC4)
      setTimeout(() => setScreen('orientation-prompt'), 500);
    } catch (err) {
      throw err; // re-throw so SessionCodeEntryScreen can reset its loading state and show the error
    }
  }, []);

  const handleOrientationDismiss = useCallback(() => {
    setScreen('controller');
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
  return <ControllerScreen session={session} gameState={gameState} />;
}

import { useState, useCallback } from 'react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { HubWorldScreen } from './screens/HubWorldScreen';
import { createHostSession } from './session/host-session';
import type { HostSession } from './session/host-session';
import type { GameState } from 'shared-types';

type AppScreen = 'main-menu' | 'lobby' | 'hub-world';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('main-menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateSession = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const s = await createHostSession(setGameState, (code, msg) => {
        setError(`Connection error ${code}: ${msg}`);
      });
      setSession(s);
      setScreen('lobby');
    } catch (err) {
      setError(`Failed to create session: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  const handleStartGame = useCallback(() => {
    session?.sendStartGame();
    setScreen('hub-world');
  }, [session]);

  if (screen === 'main-menu') {
    return (
      <MainMenuScreen
        onCreateSession={handleCreateSession}
        error={error}
        isCreating={isCreating}
      />
    );
  }
  if (screen === 'lobby' && session !== null) {
    return (
      <LobbyScreen
        roomId={session.roomId}
        gameState={gameState}
        onStartGame={handleStartGame}
      />
    );
  }
  return <HubWorldScreen gameState={gameState} session={session} />;
}

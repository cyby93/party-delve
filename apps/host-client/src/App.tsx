import { useState, useCallback, useEffect } from 'react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { HubWorldScreen } from './screens/HubWorldScreen';
import { DungeonScreen } from './screens/DungeonScreen';
import { createHostSession } from './session/host-session';
import type { HostSession } from './session/host-session';
import type { GameState } from 'shared-types';
import type { DeltaEventMsg } from 'net-protocol';

type AppScreen = 'main-menu' | 'lobby' | 'hub-world';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('main-menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [latestTransientDelta, setLatestTransientDelta] = useState<DeltaEventMsg | null>(null);

  const handleCreateSession = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const s = await createHostSession(setGameState, (code, msg) => {
        setError(`Connection error ${code}: ${msg}`);
      }, setLatestTransientDelta);
      setSession(s);
      setScreen('lobby');
    } catch (err) {
      setError(`Failed to create session: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  useEffect(() => {
    if (!latestTransientDelta) return;
    const timer = setTimeout(() => setLatestTransientDelta(null), 400);
    return () => clearTimeout(timer);
  }, [latestTransientDelta]);

  const handleStartGame = useCallback(() => {
    setScreen('hub-world');
  }, []);

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
  if (gameState?.session.phase === 'dungeon' || gameState?.session.phase === 'post-run') {
    return <DungeonScreen gameState={gameState} session={session} latestTransientDelta={latestTransientDelta} />;
  }
  return <HubWorldScreen gameState={gameState} session={session} />;
}

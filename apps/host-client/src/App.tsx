import { useState, useCallback, useEffect } from 'react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { HubWorldScreen } from './screens/HubWorldScreen';
import { DungeonScreen } from './screens/DungeonScreen';
import { PostRunSummaryScreen } from './screens/PostRunSummaryScreen';
import { createHostSession } from './session/host-session';
import type { HostSession } from './session/host-session';
import type { GameState, RunReward } from 'shared-types';
import type { DeltaEventMsg } from 'net-protocol';

type AppScreen = 'main-menu' | 'lobby' | 'hub-world';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('main-menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [transientDeltaQueue, setTransientDeltaQueue] = useState<DeltaEventMsg[]>([]);
  const [runOutcome, setRunOutcome] = useState<'complete' | 'failed' | null>(null);
  const [runReward, setRunReward] = useState<RunReward | null>(null);

  const handleCreateSession = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const s = await createHostSession(setGameState, (code, msg) => {
        setError(`Connection error ${code}: ${msg}`);
      }, (delta: DeltaEventMsg) => setTransientDeltaQueue(prev => [...prev, delta]));
      setSession(s);
      setScreen('lobby');
    } catch (err) {
      setError(`Failed to create session: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  useEffect(() => {
    if (transientDeltaQueue.length === 0) return;
    for (const delta of transientDeltaQueue) {
      if (delta.type === 'run:complete') setRunOutcome('complete');
      else if (delta.type === 'run:failed') { setRunOutcome('failed'); setRunReward(null); }
      else if (delta.type === 'boss:defeated') setRunReward(delta.reward);
    }
    setTransientDeltaQueue([]);
  }, [transientDeltaQueue]);

  useEffect(() => {
    if (gameState?.session.phase === 'hub') {
      setRunReward(null);
      setRunOutcome(null);
    }
  }, [gameState?.session.phase]);

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
  if (gameState?.session.phase === 'dungeon') {
    return <DungeonScreen gameState={gameState} session={session} transientDeltaQueue={transientDeltaQueue} />;
  }
  if (gameState?.session.phase === 'post-run') {
    return <PostRunSummaryScreen gameState={gameState} runOutcome={runOutcome ?? 'complete'} reward={runReward} />;
  }
  // Story 7.14b: the hub receives the same transient-delta queue the dungeon does.
  // It was already populated for hub deltas — `host-session.ts` filters by delta
  // type, never by session phase — the hub screen simply was not handed it.
  return <HubWorldScreen gameState={gameState} session={session} transientDeltaQueue={transientDeltaQueue} />;
}

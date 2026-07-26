import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize, applyDelta } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface HostSession {
  roomId: string;
  sessionId: string;
  sendStartGame: () => void;
  sendDebugKillAll: () => void;
  sendDebugKillBoss: () => void;
  disconnect: () => void;
}

// Colyseus may deliver the payload as a msgpack-decoded object or as a JSON string
// depending on how the server sent it. Accept both.
function decode<T>(data: unknown): T {
  return (typeof data === 'string' ? deserialize<T>(data) : data) as T;
}

export async function createHostSession(
  onStateUpdate: (state: GameState) => void,
  onError: (code: number, message: string) => void,
  onTransientDelta?: (delta: DeltaEventMsg) => void,
): Promise<HostSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.create<any>('game_room', { isHost: true });

  let currentState: GameState | null = null;

  room.onMessage(EventNames.SNAPSHOT, (data: unknown) => {
    try {
      const msg = decode<SnapshotMsg>(data);
      currentState = msg.state;
      onStateUpdate(currentState);
    } catch { /* ignore malformed snapshot */ }
  });

  room.onMessage(EventNames.DELTA, (data: unknown) => {
    if (!currentState) return;
    try {
      const delta = decode<DeltaEventMsg>(data);
      if (onTransientDelta && (
        delta.type === 'ability:fired' ||
        delta.type === 'spirit-ability:fired' ||
        delta.type === 'enemy:killed' ||
        delta.type === 'enemy:damaged' ||
        delta.type === 'essence:dropped' ||
        delta.type === 'player:downed' ||
        delta.type === 'player:revived' ||
        delta.type === 'player:spirit' ||
        delta.type === 'player:hp-updated' ||
        // Story 7.4: forward projectile:hit so the host can drive Souldrinker's
        // Blood Spike lifesteal-return and Void Pulse impact visuals. Host-local
        // delivery filtering only — applyDelta runs unconditionally below (:74)
        // and already handles it (apply-delta.ts:247-249), so mirror state is
        // unchanged; this only decides whether it reaches React/DungeonScreen.
        delta.type === 'projectile:hit' ||
        delta.type === 'run:failed' ||
        delta.type === 'level:complete' ||
        delta.type === 'run:complete' ||
        delta.type === 'bond:assigned' ||
        // Story 7.3: forward the three cast deltas so the host can drive Soul
        // Mend's channel/terminal visuals. This is host-local delivery filtering
        // only — applyDelta runs unconditionally below (:67) and already handles
        // all three (apply-delta.ts:260,271,280), so mirror state is unchanged.
        delta.type === 'cast:started' ||
        delta.type === 'cast:cancelled' ||
        delta.type === 'cast:completed' ||
        delta.type === 'boss:phaseChanged' ||
        delta.type === 'boss:damaged' ||
        delta.type === 'boss:stomped' ||
        delta.type === 'boss:charged' ||
        delta.type === 'boss:defeated' ||
        // Story 7.5: forward zone:strike so the host can draw Storm Eye's bonus-
        // strike accent. Host-local delivery filtering only — applyDelta runs
        // unconditionally below and already handles it (apply-delta.ts:258), so
        // mirror state is unchanged; this only decides whether it reaches
        // React/DungeonScreen. zone:tick is deliberately NOT forwarded (2/s per
        // zone would displace other deltas in the single-value latestTransientDelta).
        delta.type === 'zone:strike'
      )) {
        onTransientDelta(delta);
      }
      currentState = applyDelta(currentState, delta);
      onStateUpdate(currentState);
    } catch { /* ignore malformed delta */ }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    roomId: room.roomId,
    sessionId: room.sessionId,
    sendStartGame: () => room.send(EventNames.HOST_START, ''),
    sendDebugKillAll: () => room.send('debug:kill-all', ''),
    sendDebugKillBoss: () => room.send('debug:kill-boss', ''),
    disconnect: () => room.leave(),
  };
}

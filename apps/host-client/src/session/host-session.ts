import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize, applyDelta } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface HostSession {
  roomId: string;
  sessionId: string;
  sendStartGame: () => void;
  disconnect: () => void;
}

export async function createHostSession(
  onStateUpdate: (state: GameState) => void,
  onError: (code: number, message: string) => void
): Promise<HostSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.create<any>('game_room', { isHost: true });

  let currentState: GameState | null = null;

  // P3: wrap handlers so a throw doesn't leak the connected room
  room.onMessage(EventNames.SNAPSHOT, (data: string) => {
    try {
      const msg = deserialize<SnapshotMsg>(data);
      currentState = msg.state;
      onStateUpdate(currentState);
    } catch (err) {
      room.leave();
      onError(-1, `Snapshot parse error: ${String(err)}`);
    }
  });

  room.onMessage(EventNames.DELTA, (data: string) => {
    if (!currentState) return;
    try {
      const delta = deserialize<DeltaEventMsg>(data);
      currentState = applyDelta(currentState, delta);
      onStateUpdate(currentState);
    } catch (err) {
      room.leave();
      onError(-1, `Delta parse error: ${String(err)}`);
    }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    roomId: room.roomId,
    sessionId: room.sessionId,
    // TODO: add EventNames.HOST_START (deferred to Protocol Architect, see deferred-work.md D38)
    sendStartGame: () => room.send('host:start', ''),
    disconnect: () => room.leave(),
  };
}

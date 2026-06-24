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

// Colyseus may deliver the payload as a msgpack-decoded object or as a JSON string
// depending on how the server sent it. Accept both.
function decode<T>(data: unknown): T {
  return (typeof data === 'string' ? deserialize<T>(data) : data) as T;
}

export async function createHostSession(
  onStateUpdate: (state: GameState) => void,
  onError: (code: number, message: string) => void
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
    disconnect: () => room.leave(),
  };
}

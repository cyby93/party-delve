import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface MobileSession {
  playerId: string;
  roomId: string;
  disconnect: () => void;
}

export async function joinSession(
  roomId: string,
  playerName: string,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onError: (code: number, message: string) => void
): Promise<MobileSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.joinById<any>(roomId, { playerName });

  room.onMessage(EventNames.SNAPSHOT, (data: string) => {
    try {
      const msg = deserialize<SnapshotMsg>(data);
      onStateUpdate(msg.state);
    } catch {
      // malformed snapshot — ignore
    }
  });

  room.onMessage(EventNames.DELTA, (data: string) => {
    try {
      const delta = deserialize<DeltaEventMsg>(data);
      onDelta(delta);
    } catch {
      // malformed delta — ignore
    }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    playerId: room.sessionId,
    roomId: room.roomId,
    disconnect: () => room.leave(),
  };
}

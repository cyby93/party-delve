import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface MobileSession {
  playerId: string;
  roomId: string;
  sendInput: (msg: InputEventMsg) => void;
  disconnect: () => void;
}

// Colyseus may deliver the payload as a msgpack-decoded object or as a JSON string
// depending on how the server sent it. Accept both.
function decode<T>(data: unknown): T {
  return (typeof data === 'string' ? deserialize<T>(data) : data) as T;
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

  room.onMessage(EventNames.SNAPSHOT, (data: unknown) => {
    try {
      const msg = decode<SnapshotMsg>(data);
      onStateUpdate(msg.state);
    } catch { /* ignore malformed snapshot */ }
  });

  room.onMessage(EventNames.DELTA, (data: unknown) => {
    try {
      const delta = decode<DeltaEventMsg>(data);
      onDelta(delta);
    } catch { /* ignore malformed delta */ }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    playerId: room.sessionId,
    roomId: room.roomId,
    // Send input as a plain object — Colyseus msgpack-encodes it for us.
    // The server INPUT handler accepts both plain objects and JSON strings defensively.
    sendInput: (msg: InputEventMsg) => room.send(EventNames.INPUT, msg),
    disconnect: () => room.leave(),
  };
}

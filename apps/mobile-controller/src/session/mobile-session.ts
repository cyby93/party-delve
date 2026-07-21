import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, ClassSelectMsg, CooldownUpdateMsg, BondNotificationMsg, RunProposeMsg, VoteMsg, ReturnToCampMsg, ContinueMsg, RunVictoryMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? `ws://${window.location.hostname || 'localhost'}:2567`;
const SESSION_STORAGE_KEY = 'party-delve-session';

interface PersistedSession {
  reconnectionToken: string;
  roomId: string;
  playerName: string;
}

export interface MobileSession {
  playerId: string;
  roomId: string;
  sendInput: (msg: InputEventMsg) => void;
  sendClassSelect: (msg: ClassSelectMsg) => void;
  sendRunPropose: (msg: RunProposeMsg) => void;
  sendVote: (msg: VoteMsg) => void;
  sendReturnToCamp: () => void;
  sendContinue: () => void;
  // Debug-only, dev-build-gated at the call site (see ControllerScreen.tsx) — mirrors the
  // server's own NODE_ENV-gated 'debug:toggle-god-mode' handler (GameRoom.ts). Untyped raw
  // string message, same precedent as debug:kill-all/debug:kill-boss — no EventNames entry.
  sendDebugToggleGodMode: () => void;
  disconnect: () => void;
}

// Colyseus may deliver the payload as a msgpack-decoded object or as a JSON string
// depending on how the server sent it. Accept both.
function decode<T>(data: unknown): T {
  return (typeof data === 'string' ? deserialize<T>(data) : data) as T;
}

function persistSession(token: string, roomId: string, playerName: string): void {
  const data: PersistedSession = { reconnectionToken: token, roomId, playerName };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

export function getPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function wireRoomHandlers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  room: Colyseus.Room<any>,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onCooldownUpdate: (msg: CooldownUpdateMsg) => void,
  onBondNotification: (msg: BondNotificationMsg) => void,
  onRunVictory: (msg: RunVictoryMsg) => void,
  onError: (code: number, message: string) => void,
  onDisconnect: (code: number) => void,
): void {
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

  room.onMessage(EventNames.COOLDOWN_UPDATE, (data: unknown) => {
    try {
      const msg = decode<CooldownUpdateMsg>(data);
      onCooldownUpdate(msg);
    } catch { /* ignore malformed */ }
  });

  room.onMessage(EventNames.BOND_NOTIFICATION, (data: unknown) => {
    try {
      const msg = decode<BondNotificationMsg>(data);
      onBondNotification(msg);
    } catch { /* ignore malformed */ }
  });

  room.onMessage(EventNames.RUN_VICTORY, (data: unknown) => {
    try {
      const msg = decode<RunVictoryMsg>(data);
      onRunVictory(msg);
    } catch { /* ignore malformed */ }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  room.onLeave.once((code) => {
    onDisconnect(code);
  });

  // Disable SDK's built-in auto-reconnect so onLeave fires immediately on network drop,
  // giving the app's manual reconnect UX the full 30-second server grace window to work with.
  // Verified against installed @colyseus/sdk 0.17.43: `reconnection.enabled` is a real,
  // typed field on Room (see node_modules/@colyseus/sdk/build/Room.d.ts) and
  // handleReconnection() checks it before attempting auto-reconnect — not a no-op.
  room.reconnection.enabled = false;
}

export async function joinSession(
  roomId: string,
  playerName: string,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onCooldownUpdate: (msg: CooldownUpdateMsg) => void,
  onBondNotification: (msg: BondNotificationMsg) => void,
  onRunVictory: (msg: RunVictoryMsg) => void,
  onError: (code: number, message: string) => void,
  onDisconnect: (code: number) => void,
): Promise<MobileSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.joinById<any>(roomId, { playerName });

  // Persist before wiring handlers — ensures token is available if onLeave fires during setup.
  persistSession(room.reconnectionToken, room.roomId, playerName);

  wireRoomHandlers(room, onStateUpdate, onDelta, onCooldownUpdate, onBondNotification, onRunVictory, onError, onDisconnect);

  return {
    playerId: room.sessionId,
    roomId: room.roomId,
    // Send input as a plain object — Colyseus msgpack-encodes it for us.
    // The server INPUT handler accepts both plain objects and JSON strings defensively.
    sendInput: (msg: InputEventMsg) => room.send(EventNames.INPUT, msg),
    sendClassSelect: (msg: ClassSelectMsg) => room.send(EventNames.CLASS_SELECT, msg),
    sendRunPropose: (msg: RunProposeMsg) => room.send(EventNames.RUN_PROPOSE, msg),
    sendVote: (msg: VoteMsg) => room.send(EventNames.VOTE, msg),
    sendReturnToCamp: () => room.send(EventNames.RETURN_TO_CAMP, { type: 'return:to-camp' } satisfies ReturnToCampMsg),
    sendContinue: () => room.send(EventNames.CONTINUE, { type: 'bond:continue' } satisfies ContinueMsg),
    sendDebugToggleGodMode: () => room.send('debug:toggle-god-mode', {}),
    disconnect: () => {
      try { room.leave(); } catch { /* socket may already be closed */ }
    },
  };
}

export async function reconnectToSession(
  reconnectionToken: string,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onCooldownUpdate: (msg: CooldownUpdateMsg) => void,
  onBondNotification: (msg: BondNotificationMsg) => void,
  onRunVictory: (msg: RunVictoryMsg) => void,
  onError: (code: number, message: string) => void,
  onDisconnect: (code: number) => void,
): Promise<MobileSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.reconnect<any>(reconnectionToken);

  // Refresh token before wiring handlers — mirrors joinSession ordering so the
  // fresh token is available if onLeave fires during setup.
  const existing = getPersistedSession();
  if (existing) {
    persistSession(room.reconnectionToken, existing.roomId, existing.playerName);
  }

  wireRoomHandlers(room, onStateUpdate, onDelta, onCooldownUpdate, onBondNotification, onRunVictory, onError, onDisconnect);

  return {
    playerId: room.sessionId,
    roomId: room.roomId,
    sendInput: (msg: InputEventMsg) => room.send(EventNames.INPUT, msg),
    sendClassSelect: (msg: ClassSelectMsg) => room.send(EventNames.CLASS_SELECT, msg),
    sendRunPropose: (msg: RunProposeMsg) => room.send(EventNames.RUN_PROPOSE, msg),
    sendVote: (msg: VoteMsg) => room.send(EventNames.VOTE, msg),
    sendReturnToCamp: () => room.send(EventNames.RETURN_TO_CAMP, { type: 'return:to-camp' } satisfies ReturnToCampMsg),
    sendContinue: () => room.send(EventNames.CONTINUE, { type: 'bond:continue' } satisfies ContinueMsg),
    sendDebugToggleGodMode: () => room.send('debug:toggle-god-mode', {}),
    disconnect: () => {
      try { room.leave(); } catch { /* socket may already be closed */ }
    },
  };
}

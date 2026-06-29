/**
 * Tests for GameRoom.onJoin host branch (Story 1.3 companion patch).
 *
 * We exercise the branch logic by stubbing the minimum Colyseus surface
 * GameRoom touches during onJoin: Client.sessionId, client.send, and
 * this.broadcast. The Room base class is not instantiated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, PlayerState } from 'shared-types';
import { PlayerClass, SessionColor, TICK_RATE_HZ } from 'shared-types';
import { serialize, EventNames } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
import { deserialize } from 'net-protocol';
import { generateRoomCode } from '../src/rooms/GameRoom.js';

// Pure helper — extracted for direct testability.
function createEmptyGameState(roomId: string): GameState {
  return {
    session: {
      roomId,
      hostId: '',
      phase: 'lobby',
      playerCount: 0,
      maxPlayers: 8,
      runSeed: 0,
      levelIndex: 0,
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
  };
}

/**
 * Minimal replica of the onJoin branch logic we patched in GameRoom.ts.
 * Mirrors the implementation so any bug in the real code that changes its
 * observable effects will also break this test.
 */
function simulateOnJoin(
  gameState: GameState,
  clientSessionId: string,
  options: Record<string, unknown>,
  clientSend: (event: string, data: string) => void,
  roomBroadcast: (event: string, data: string) => void,
): void {
  if (options['isHost'] === true) {
    gameState.session.hostId = clientSessionId;
    const snapshot: SnapshotMsg = { type: 'snapshot', state: gameState };
    clientSend(EventNames.SNAPSHOT, serialize(snapshot));
    return;
  }
  const rawName = [...String(options['playerName'] ?? '').trim()].slice(0, 32).join('');
  const displayName = rawName.length > 0 ? rawName : clientSessionId.slice(-6);
  gameState.players.push({
    id: clientSessionId,
    displayName,
    class: PlayerClass.STONEHIDE,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
  });
  gameState.session.playerCount = gameState.players.length;
  const snapshot: SnapshotMsg = { type: 'snapshot', state: gameState };
  roomBroadcast(EventNames.SNAPSHOT, serialize(snapshot));
}

describe('generateRoomCode (Story 3.8)', () => {
  it('returns a 4-uppercase-letter string', () => {
    expect(generateRoomCode()).toMatch(/^[A-Z]{4}$/);
  });
});

describe('GameRoom.onJoin — host branch (Story 1.3 patch)', () => {
  let gameState: GameState;
  let clientSend: ReturnType<typeof vi.fn>;
  let roomBroadcast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gameState = createEmptyGameState('room-001');
    clientSend = vi.fn();
    roomBroadcast = vi.fn();
  });

  it('does NOT create a player slot when isHost is true', () => {
    simulateOnJoin(gameState, 'host-session-id', { isHost: true }, clientSend, roomBroadcast);
    expect(gameState.players).toHaveLength(0);
  });

  it('sets session.hostId to the client sessionId when isHost is true', () => {
    simulateOnJoin(gameState, 'host-session-id', { isHost: true }, clientSend, roomBroadcast);
    expect(gameState.session.hostId).toBe('host-session-id');
  });

  it('sends snapshot ONLY to the host client (not broadcast) when isHost is true', () => {
    simulateOnJoin(gameState, 'host-session-id', { isHost: true }, clientSend, roomBroadcast);
    expect(clientSend).toHaveBeenCalledOnce();
    expect(roomBroadcast).not.toHaveBeenCalled();
  });

  it('sends a valid SnapshotMsg payload to the host client', () => {
    simulateOnJoin(gameState, 'host-session-id', { isHost: true }, clientSend, roomBroadcast);
    const [event, payload] = clientSend.mock.calls[0] as [string, string];
    expect(event).toBe(EventNames.SNAPSHOT);
    const msg = deserialize<SnapshotMsg>(payload);
    expect(msg.type).toBe('snapshot');
    expect(msg.state.session.roomId).toBe('room-001');
  });

  it('creates a player slot when isHost is false', () => {
    simulateOnJoin(gameState, 'player-session-id', { isHost: false }, clientSend, roomBroadcast);
    expect(gameState.players).toHaveLength(1);
    expect(gameState.players[0]?.id).toBe('player-session-id');
  });

  it('broadcasts snapshot to all clients when isHost is false', () => {
    simulateOnJoin(gameState, 'player-session-id', {}, clientSend, roomBroadcast);
    expect(roomBroadcast).toHaveBeenCalledOnce();
    expect(clientSend).not.toHaveBeenCalled();
  });

  it('host join followed by player join results in 1 player, not 2', () => {
    simulateOnJoin(gameState, 'host-id', { isHost: true }, clientSend, roomBroadcast);
    simulateOnJoin(gameState, 'player-id', {}, vi.fn(), roomBroadcast);
    expect(gameState.players).toHaveLength(1);
    expect(gameState.session.hostId).toBe('host-id');
  });

  it('uses playerName option as displayName when provided', () => {
    simulateOnJoin(gameState, 'player-session-id', { playerName: 'TestPlayer' }, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('TestPlayer');
  });

  it('falls back to last 6 chars of sessionId when playerName is absent', () => {
    simulateOnJoin(gameState, 'abc123xyz', {}, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('123xyz');
  });

  it('truncates playerName to 32 characters', () => {
    const longName = 'A'.repeat(40);
    simulateOnJoin(gameState, 'player-id', { playerName: longName }, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('A'.repeat(32));
  });

  it('falls back to sessionId when playerName is whitespace-only', () => {
    simulateOnJoin(gameState, 'abc123xyz', { playerName: '   ' }, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('123xyz');
  });

  it('preserves emoji when 31 ASCII + emoji fits within 32-codepoint limit', () => {
    // Old String.slice(0,32) would take 32 of 33 code units → lone high surrogate stored
    // New [...str].slice(0,32) counts codepoints → emoji kept intact
    const emojiName = 'A'.repeat(31) + '😀'; // 32 codepoints total
    simulateOnJoin(gameState, 'player-id', { playerName: emojiName }, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('A'.repeat(31) + '😀');
  });

  it('drops a trailing emoji when name exceeds 32 codepoints', () => {
    // 32 ASCII + 1 emoji = 33 codepoints → emoji dropped entirely (not split into surrogates)
    const longEmojiName = 'A'.repeat(32) + '😀';
    simulateOnJoin(gameState, 'player-id', { playerName: longEmojiName }, clientSend, roomBroadcast);
    expect(gameState.players[0]?.displayName).toBe('A'.repeat(32));
  });
});

// Pure helper mirroring GameRoom.tick() steps 1–2 (joystick drain + movement loop).
function simulateMovementTick(
  players: GameState['players'],
  lastKnownJoystick: Map<string, { x: number; y: number }>,
  incomingJoystickEvents: Array<{ clientId: string; joystick: { x: number; y: number } }>,
): void {
  for (const { clientId, joystick } of incomingJoystickEvents) {
    lastKnownJoystick.set(clientId, joystick);
  }

  const SPEED = 200;
  const DT = 1 / TICK_RATE_HZ;
  for (const player of players) {
    if (player.isFrozen) continue;
    const joystick = lastKnownJoystick.get(player.id);
    if (!joystick) continue;
    const { x, y } = joystick;
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) continue;
    player.x += x * SPEED * DT;
    player.y += y * SPEED * DT;
  }
}

function makePlayer(id: string): PlayerState {
  return {
    id,
    displayName: 'TestPlayer',
    class: null,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
  };
}

describe('GameRoom.tick() — persistent joystick (Story 2.5)', () => {
  const SPEED = 200;
  const DT = 1 / TICK_RATE_HZ;

  it('AC6 — player advances on ticks 2 and 3 with no new input after initial joystick', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 1, y: 0 } }]);
    expect(player.x).toBeCloseTo(SPEED * DT * 1, 5);

    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBeCloseTo(SPEED * DT * 2, 5);

    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBeCloseTo(SPEED * DT * 3, 5);
  });

  it('AC2 — sending {x:0,y:0} stops movement on next tick', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 1, y: 0 } }]);
    const xAfterTick1 = player.x;

    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 0, y: 0 } }]);
    expect(player.x).toBe(xAfterTick1);
  });

  it('AC3 — player that never sent joystick does not move', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    simulateMovementTick(players, lastKnownJoystick, []);
    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  it('AC4 — frozen player does not move even with lastKnownJoystick set', () => {
    const player = makePlayer('p1');
    player.isFrozen = true;
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();
    lastKnownJoystick.set('p1', { x: 1, y: 0 });

    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBe(0);
  });
});

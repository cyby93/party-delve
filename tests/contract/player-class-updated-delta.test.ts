import { describe, it, expect } from 'vitest';
import { serialize, deserialize, applyDelta } from 'net-protocol';
import type { PlayerClassUpdatedDelta, DeltaEventMsg } from 'net-protocol';
import type { GameState, PlayerState } from 'shared-types';
import { PlayerClass, SessionColor } from 'shared-types';

function mockGameState(): GameState {
  return {
    session: {
      roomId: 'test-room',
      hostId: 'host-1',
      phase: 'lobby',
      playerCount: 0,
      maxPlayers: 8,
      runSeed: 42,
      levelIndex: 0,
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
  };
}

function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'p1',
    displayName: 'Test',
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
    ...overrides,
  };
}

describe('PlayerClassUpdatedDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const delta: PlayerClassUpdatedDelta = {
      type: 'player:class-updated',
      playerId: 'abc123',
      class: PlayerClass.STORMCALLER,
    };
    expect(deserialize<PlayerClassUpdatedDelta>(serialize(delta))).toEqual(delta);
  });

  it('round-trips for each PlayerClass value', () => {
    for (const classId of Object.values(PlayerClass)) {
      const delta: PlayerClassUpdatedDelta = {
        type: 'player:class-updated',
        playerId: 'p1',
        class: classId,
      };
      expect(deserialize<PlayerClassUpdatedDelta>(serialize(delta))).toEqual(delta);
    }
  });
});

describe('applyDelta player:class-updated', () => {
  it('sets class on matching player', () => {
    const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
    const delta: DeltaEventMsg = {
      type: 'player:class-updated',
      playerId: 'p1',
      class: PlayerClass.STONEHIDE,
    };
    const next = applyDelta(state, delta);
    expect(next.players[0]?.class).toBe(PlayerClass.STONEHIDE);
  });

  it('does not mutate original state', () => {
    const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
    const delta: DeltaEventMsg = {
      type: 'player:class-updated',
      playerId: 'p1',
      class: PlayerClass.SPIRITCALLER,
    };
    applyDelta(state, delta);
    expect(state.players[0]?.class).toBeNull();
  });

  it('does not affect other players', () => {
    const p2 = mockPlayer({ id: 'p2', class: null });
    const state: GameState = { ...mockGameState(), players: [mockPlayer(), p2] };
    const delta: DeltaEventMsg = {
      type: 'player:class-updated',
      playerId: 'p1',
      class: PlayerClass.SOULDRINKER,
    };
    const next = applyDelta(state, delta);
    expect(next.players[1]?.class).toBeNull();
  });

  it('returns same reference for unknown playerId', () => {
    const state: GameState = { ...mockGameState(), players: [] };
    const delta: DeltaEventMsg = {
      type: 'player:class-updated',
      playerId: 'ghost',
      class: PlayerClass.STONEHIDE,
    };
    const next = applyDelta(state, delta);
    expect(next).toBe(state);
  });

  it('allows re-confirmation with a different class', () => {
    const state: GameState = { ...mockGameState(), players: [mockPlayer({ class: PlayerClass.STONEHIDE })] };
    const delta: DeltaEventMsg = {
      type: 'player:class-updated',
      playerId: 'p1',
      class: PlayerClass.STORMCALLER,
    };
    const next = applyDelta(state, delta);
    expect(next.players[0]?.class).toBe(PlayerClass.STORMCALLER);
  });
});

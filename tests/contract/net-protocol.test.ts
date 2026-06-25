import { describe, it, expect } from 'vitest';
import { serialize, deserialize, applyDelta, EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, PlayerPoiEnteredDelta, PlayerPoiExitedDelta } from 'net-protocol';
import type { GameState, PlayerState } from 'shared-types';
import { PlayerClass, SessionColor, EnemyType, DifficultyTier, EnemyFSMState } from 'shared-types';

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

describe('net-protocol contract tests', () => {
  describe('SnapshotMsg round-trip', () => {
    it('survives serialize → deserialize', () => {
      const msg: SnapshotMsg = { type: 'snapshot', state: mockGameState() };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });

    it('preserves nested player array', () => {
      const state = mockGameState();
      state.players.push({
        id: 'player-1',
        displayName: 'TestPlayer',
        class: PlayerClass.STONEHIDE,
        x: 10,
        y: 20,
        hp: 80,
        maxHp: 100,
        isFrozen: false,
        isDown: false,
        isSpirit: false,
        sessionColor: SessionColor.RED,
        downCount: 1,
        nearPoiId: null,
      });
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });

    it('preserves EnemyState with fsmState and attackCooldownTicks', () => {
      const state = mockGameState();
      state.enemies.push({
        id: 'e1',
        type: EnemyType.GRUNT,
        x: 100,
        y: 100,
        hp: 100,
        maxHp: 100,
        difficultyTier: DifficultyTier.EASY,
        isAlive: true,
        fsmState: EnemyFSMState.CHASE,
        attackCooldownTicks: 0,
      });
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('DeltaEventMsg round-trip', () => {
    it('enemy:stomped survives serialize → deserialize', () => {
      const delta = {
        type: 'enemy:stomped' as const,
        enemyId: 'e1',
        x: 100,
        y: 200,
        radius: 150,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:moved survives serialize → deserialize', () => {
      const delta = { type: 'player:moved' as const, playerId: 'p1', x: 5, y: 10 } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:left survives serialize → deserialize', () => {
      const delta = { type: 'player:left' as const, playerId: 'p1' } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:disconnected survives serialize → deserialize', () => {
      const delta = { type: 'player:disconnected' as const, playerId: 'p1' } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:reconnected survives serialize → deserialize', () => {
      const delta = { type: 'player:reconnected' as const, playerId: 'p1' } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });
  });

  describe('applyDelta behavior', () => {
    function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
      return {
        id: 'p1',
        displayName: 'Test',
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
        ...overrides,
      };
    }

    it('player:disconnected sets isFrozen=true on matching player', () => {
      const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
      const next = applyDelta(state, { type: 'player:disconnected', playerId: 'p1' });
      expect(next.players[0]?.isFrozen).toBe(true);
    });

    it('player:reconnected sets isFrozen=false on matching player', () => {
      const state: GameState = { ...mockGameState(), players: [mockPlayer({ isFrozen: true })] };
      const next = applyDelta(state, { type: 'player:reconnected', playerId: 'p1' });
      expect(next.players[0]?.isFrozen).toBe(false);
      expect(state.players[0]?.isFrozen).toBe(true); // original state must not be mutated
    });

    it('player:disconnected does not mutate other players', () => {
      const p2 = mockPlayer({ id: 'p2', isFrozen: false });
      const state: GameState = { ...mockGameState(), players: [mockPlayer(), p2] };
      const next = applyDelta(state, { type: 'player:disconnected', playerId: 'p1' });
      expect(next.players[1]?.isFrozen).toBe(false);
    });

    it('player:moved returns same reference for unknown playerId', () => {
      const state: GameState = { ...mockGameState(), players: [] };
      const next = applyDelta(state, { type: 'player:moved', playerId: 'ghost', x: 1, y: 2 });
      expect(next).toBe(state);
    });

    it('player:disconnected returns same reference for unknown playerId', () => {
      const state: GameState = { ...mockGameState(), players: [] };
      const next = applyDelta(state, { type: 'player:disconnected', playerId: 'ghost' });
      expect(next).toBe(state);
    });

    it('player:reconnected returns same reference for unknown playerId', () => {
      const state: GameState = { ...mockGameState(), players: [] };
      const next = applyDelta(state, { type: 'player:reconnected', playerId: 'ghost' });
      expect(next).toBe(state);
    });
  });

  describe('PlayerPoiEnteredDelta round-trip', () => {
    it('serializes and deserializes', () => {
      const msg: PlayerPoiEnteredDelta = {
        type: 'player:poi-entered',
        playerId: 'p1',
        poiId: 'class-select',
        poiType: 'class-select',
      };
      expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('PlayerPoiExitedDelta round-trip', () => {
    it('serializes and deserializes', () => {
      const msg: PlayerPoiExitedDelta = { type: 'player:poi-exited', playerId: 'p1' };
      expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('applyDelta POI cases', () => {
    function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
      return {
        id: 'p1',
        displayName: 'Test',
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
        ...overrides,
      };
    }

    it('player:poi-entered sets nearPoiId', () => {
      const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
      const next = applyDelta(state, { type: 'player:poi-entered', playerId: 'p1', poiId: 'class-select', poiType: 'class-select' });
      expect(next.players[0]!.nearPoiId).toBe('class-select');
    });

    it('player:poi-exited clears nearPoiId', () => {
      const base: GameState = { ...mockGameState(), players: [mockPlayer()] };
      const withPoi = applyDelta(base, { type: 'player:poi-entered', playerId: 'p1', poiId: 'class-select', poiType: 'class-select' });
      const cleared = applyDelta(withPoi, { type: 'player:poi-exited', playerId: 'p1' });
      expect(cleared.players[0]!.nearPoiId).toBeNull();
    });

    it('player:poi-entered returns same reference for unknown playerId', () => {
      const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
      const next = applyDelta(state, { type: 'player:poi-entered', playerId: 'ghost', poiId: 'class-select', poiType: 'class-select' });
      expect(next).toBe(state);
    });

    it('player:poi-exited returns same reference for unknown playerId', () => {
      const state: GameState = { ...mockGameState(), players: [mockPlayer()] };
      const next = applyDelta(state, { type: 'player:poi-exited', playerId: 'ghost' });
      expect(next).toBe(state);
    });
  });

  describe('EventNames constants', () => {
    it('HOST_START matches the wire string expected by the server', () => {
      expect(EventNames.HOST_START).toBe('host:start');
    });
  });

  describe('InputEventMsg round-trip', () => {
    it('joystick input survives serialize → deserialize', () => {
      const msg: InputEventMsg = {
        type: 'input',
        event: { type: 'joystick', joystick: { x: 0.5, y: -0.75 } },
      };
      expect(deserialize<InputEventMsg>(serialize(msg))).toEqual(msg);
    });

    it('ability input survives serialize → deserialize', () => {
      const msg: InputEventMsg = {
        type: 'input',
        event: { type: 'ability', ability: { abilityIndex: 2, directionX: 1, directionY: 0 } },
      };
      expect(deserialize<InputEventMsg>(serialize(msg))).toEqual(msg);
    });
  });
});

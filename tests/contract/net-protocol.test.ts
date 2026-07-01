import { describe, it, expect } from 'vitest';
import { serialize, deserialize, applyDelta, EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, PlayerPoiEnteredDelta, PlayerPoiExitedDelta, AbilityFiredDelta, EnemyDamagedDelta, PlayerDownedDelta } from 'net-protocol';
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
      difficulty: null,
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
    floorLayout: null,
    runProposal: null,
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
        essenceTotal: 0,
        reviveTimerExpiresAt: 0,
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
        essenceTotal: 0,
        reviveTimerExpiresAt: 0,
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
        essenceTotal: 0,
        reviveTimerExpiresAt: 0,
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

  describe('EnemyDamagedDelta round-trip', () => {
    it('enemy:damaged delta survives serialize → deserialize', () => {
      const delta = {
        type: 'enemy:damaged' as const,
        enemyId: 'e1',
        damage: 20,
        remainingHp: 40,
      } satisfies EnemyDamagedDelta;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });
  });

  describe('essenceTotal in SnapshotMsg', () => {
    it('SnapshotMsg with player essenceTotal survives serialize → deserialize', () => {
      const state = mockGameState();
      state.players.push({
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
        essenceTotal: 25,
        reviveTimerExpiresAt: 0,
      });
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('Story 4.1 floorLayout in SnapshotMsg', () => {
    it('SnapshotMsg with non-null floorLayout survives serialize → deserialize', () => {
      const state = mockGameState();
      state.floorLayout = {
        rooms: [
          { id: 'room-0', templateId: 'grassland-01', x: 280, y: 540, isExit: false },
          { id: 'room-1', templateId: 'grassland-02', x: 840, y: 490, isExit: true },
        ],
        corridors: [{ fromRoomId: 'room-0', toRoomId: 'room-1' }],
      };
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });

    it('SnapshotMsg with null floorLayout survives serialize → deserialize', () => {
      const msg: SnapshotMsg = { type: 'snapshot', state: mockGameState() };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
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

  describe('AbilityFiredDelta round-trip', () => {
    it('ability:fired delta survives serialize → deserialize', () => {
      const delta = {
        type: 'ability:fired' as const,
        playerId: 'p1',
        abilityIndex: 2,
        directionX: 0.5,
        directionY: -0.5,
      } satisfies DeltaEventMsg;
      expect(deserialize<AbilityFiredDelta>(serialize(delta))).toEqual(delta);
    });

    it('SnapshotMsg with dungeon phase survives serialize → deserialize', () => {
      const state = mockGameState();
      state.session.phase = 'dungeon';
      state.session.levelIndex = 1;
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('Story 3.7 delta round-trips', () => {
    it('level:complete delta survives serialize → deserialize', () => {
      const delta = {
        type: 'level:complete' as const,
        levelIndex: 0,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('run:complete delta survives serialize → deserialize', () => {
      const delta = {
        type: 'run:complete' as const,
        totalEssence: 240,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('applyDelta level:complete returns state unchanged', () => {
      const state: GameState = mockGameState();
      const next = applyDelta(state, { type: 'level:complete', levelIndex: 0 });
      expect(next).toBe(state);
    });

    it('applyDelta run:complete sets phase to post-run', () => {
      const state: GameState = { ...mockGameState(), session: { ...mockGameState().session, phase: 'dungeon' } };
      const next = applyDelta(state, { type: 'run:complete', totalEssence: 100 });
      expect(next.session.phase).toBe('post-run');
    });
  });

  describe('Story 3.6 delta round-trips', () => {
    it('spirit-ability:fired delta survives serialize → deserialize', () => {
      const delta = {
        type: 'spirit-ability:fired' as const,
        playerId: 'p1',
        class: PlayerClass.STORMCALLER,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('run:failed delta survives serialize → deserialize', () => {
      const delta = {
        type: 'run:failed' as const,
        partialEssence: 120,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });
  });

  describe('Story 3.5 delta round-trips', () => {
    it('player:hp-updated delta survives serialize → deserialize', () => {
      const delta = { type: 'player:hp-updated' as const, playerId: 'p1', hp: 65 } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:spirit delta survives serialize → deserialize', () => {
      const delta = { type: 'player:spirit' as const, playerId: 'p1' } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:downed delta with reviveWindowMs survives serialize → deserialize', () => {
      const delta = { type: 'player:downed' as const, playerId: 'p1', downCount: 2, reviveWindowMs: 40000 } satisfies PlayerDownedDelta;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });
  });

  describe('Story 4.2 delta round-trips', () => {
    it('run:proposed delta survives serialize → deserialize', () => {
      const delta = {
        type: 'run:proposed' as const,
        biome: 'grassland' as const,
        difficulty: DifficultyTier.NORMAL,
        proposedBy: 'player-1',
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('run:starting delta survives serialize → deserialize', () => {
      const delta = {
        type: 'run:starting' as const,
        biome: 'grassland' as const,
        difficulty: DifficultyTier.HARD,
      } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('applyDelta run:proposed sets runProposal', () => {
      const state: GameState = mockGameState();
      const next = applyDelta(state, { type: 'run:proposed', biome: 'grassland', difficulty: DifficultyTier.NORMAL, proposedBy: 'p1' });
      expect(next.runProposal).toEqual({ biome: 'grassland', difficulty: DifficultyTier.NORMAL, proposedBy: 'p1' });
      expect(state.runProposal).toBeNull(); // original must not be mutated
    });

    it('applyDelta run:starting clears runProposal and sets phase to dungeon', () => {
      const base: GameState = mockGameState();
      const withProposal = applyDelta(base, { type: 'run:proposed', biome: 'grassland', difficulty: DifficultyTier.HARD, proposedBy: 'p1' });
      const next = applyDelta(withProposal, { type: 'run:starting', biome: 'grassland', difficulty: DifficultyTier.HARD });
      expect(next.runProposal).toBeNull();
      expect(next.session.phase).toBe('dungeon');
      expect(next.session.difficulty).toBe(DifficultyTier.HARD);
    });

    it('SnapshotMsg with runProposal survives serialize → deserialize', () => {
      const state = mockGameState();
      state.runProposal = { biome: 'grassland', difficulty: DifficultyTier.EASY, proposedBy: 'p1' };
      const msg = { type: 'snapshot' as const, state };
      expect(deserialize<typeof msg>(serialize(msg))).toEqual(msg);
    });
  });
});

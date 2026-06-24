import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';
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
      });
      const msg: SnapshotMsg = { type: 'snapshot', state };
      expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
    });
  });

  describe('DeltaEventMsg round-trip', () => {
    it('player:moved survives serialize → deserialize', () => {
      const delta = { type: 'player:moved' as const, playerId: 'p1', x: 5, y: 10 } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
    });

    it('player:left survives serialize → deserialize', () => {
      const delta = { type: 'player:left' as const, playerId: 'p1' } satisfies DeltaEventMsg;
      expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
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

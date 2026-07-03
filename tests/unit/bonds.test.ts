import { describe, it, expect } from 'vitest';
import { createRng, assignBond, selectBondType, selectBondPair } from 'game-rules';
import { BondType, SessionColor, DifficultyTier, OFFSET_SPIRIT_BOND } from 'shared-types';
import type { GameState } from 'shared-types';

const SEED = 0xdeadbeef;

function makeState(playerCount: number): GameState {
  return {
    session: {
      roomId: 'test', hostId: 'h', phase: 'dungeon',
      playerCount, maxPlayers: 8, runSeed: SEED,
      levelIndex: 0, difficulty: DifficultyTier.NORMAL, levelObjective: 'clear',
      waveIndex: 0, totalWaves: 0,
    },
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`, displayName: `Player${i}`, class: null,
      x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      sessionColor: SessionColor.RED,
      downCount: 0, nearPoiId: null, essenceTotal: 0,
      reviveTimerExpiresAt: 0,
    })),
    enemies: [],
    activeBonds: [],
    essenceDrops: [],
    tick: 0,
    floorLayout: null,
    runProposal: null,
  };
}

describe('selectBondType', () => {
  it('returns Proximity or Fate', () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 100; i++) {
      const t = selectBondType(rng);
      expect([BondType.Proximity, BondType.Fate]).toContain(t);
    }
  });

  it('both variants are reachable', () => {
    const rng = createRng(1);
    const types = new Set(Array.from({ length: 200 }, () => selectBondType(rng)));
    expect(types.has(BondType.Proximity)).toBe(true);
    expect(types.has(BondType.Fate)).toBe(true);
  });
});

describe('selectBondPair', () => {
  it('always returns two distinct player IDs', () => {
    const rng = createRng(SEED);
    const players = makeState(3).players;
    for (let i = 0; i < 50; i++) {
      const [a, b] = selectBondPair(players, rng);
      expect(a).not.toBe(b);
    }
  });

  it('works with exactly 2 players', () => {
    const rng = createRng(42);
    const [a, b] = selectBondPair(makeState(2).players, rng);
    expect(a).not.toBe(b);
    expect(['p0', 'p1']).toContain(a);
    expect(['p0', 'p1']).toContain(b);
  });

  it('with 3 players, a player may appear in multiple bonds (repeats expected)', () => {
    const rng = createRng(SEED);
    const players = makeState(3).players;
    const pairs: [string, string][] = Array.from({ length: 50 }, () => selectBondPair(players, rng));
    const allIds = pairs.flat();
    expect(allIds).toContain('p0');
    expect(allIds).toContain('p1');
    expect(allIds).toContain('p2');
    // at least one ID must appear more than once — repeats are expected
    const counts = allIds.reduce<Record<string, number>>((acc, id) => { acc[id] = (acc[id] ?? 0) + 1; return acc; }, {});
    expect(Math.max(...Object.values(counts))).toBeGreaterThan(1);
  });
});

describe('assignBond', () => {
  it('returns NOT_ENOUGH_PLAYERS when fewer than 2 players', () => {
    const rng = createRng(SEED);
    expect(assignBond(makeState(0), rng)).toEqual({ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } });
    expect(assignBond(makeState(1), rng)).toEqual({ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } });
  });

  it('pushes a BondState into activeBonds on success', () => {
    const rng = createRng(SEED);
    const state = makeState(3);
    const result = assignBond(state, rng);
    expect(result.ok).toBe(true);
    expect(state.activeBonds).toHaveLength(1);
    if (result.ok) {
      expect(state.activeBonds[0]).toEqual({
        playerA: result.value.playerA,
        playerB: result.value.playerB,
        type: result.value.bondType,
        color: result.value.bondColor,
      });
    }
  });

  it('accumulates 3 bonds across 3 calls — does not replace', () => {
    const rng = createRng(SEED);
    const state = makeState(3);
    assignBond(state, rng);
    assignBond(state, rng);
    assignBond(state, rng);
    expect(state.activeBonds).toHaveLength(3);
  });

  it('determinism: identical seeds produce identical bond sequences', () => {
    const state1 = makeState(3);
    const rng1 = createRng(SEED ^ OFFSET_SPIRIT_BOND);
    const state2 = makeState(3);
    const rng2 = createRng(SEED ^ OFFSET_SPIRIT_BOND);

    for (let i = 0; i < 3; i++) {
      const r1 = assignBond(state1, rng1);
      const r2 = assignBond(state2, rng2);
      expect(r1).toEqual(r2);
    }

    expect(state1.activeBonds).toEqual(state2.activeBonds);
  });
});

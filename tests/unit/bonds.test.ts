import { describe, it, expect } from 'vitest';
import {
  createRng, assignBond, selectBondType, selectBondPair,
  bondKey, getProximityBuffedPlayers, getFateBuffedPlayers,
  getFateBondWipeTargets, getProximityDrainTargets,
  BOND_DRAIN_THRESHOLD_S,
} from 'game-rules';
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
      bossLevelStartedAt: 0, anyPlayerDownedDuringBoss: false, allBondsAtBossStart: false,
    },
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`, displayName: `Player${i}`, class: null,
      x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      sessionColor: SessionColor.RED,
      downCount: 0, nearPoiId: null, essenceTotal: 0,
      reviveTimerExpiresAt: 0, statusEffects: [],
    })),
    enemies: [],
    activeBonds: [],
    essenceDrops: [],
    tick: 0,
    floorLayout: null,
    runProposal: null,
    boss: null,
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
      const [a, b] = selectBondPair(players, [], rng);
      expect(a).not.toBe(b);
    }
  });

  it('works with exactly 2 players', () => {
    const rng = createRng(42);
    const [a, b] = selectBondPair(makeState(2).players, [], rng);
    expect(a).not.toBe(b);
    expect(['p0', 'p1']).toContain(a);
    expect(['p0', 'p1']).toContain(b);
  });

  it('with 3 players, a player may appear in multiple bonds (repeats expected)', () => {
    const rng = createRng(SEED);
    const players = makeState(3).players;
    const pairs: [string, string][] = Array.from({ length: 50 }, () => selectBondPair(players, [], rng));
    const allIds = pairs.flat();
    expect(allIds).toContain('p0');
    expect(allIds).toContain('p1');
    expect(allIds).toContain('p2');
    // at least one ID must appear more than once — repeats are expected
    const counts = allIds.reduce<Record<string, number>>((acc, id) => { acc[id] = (acc[id] ?? 0) + 1; return acc; }, {});
    expect(Math.max(...Object.values(counts))).toBeGreaterThan(1);
  });

  it('prioritizes unbonded players — with 4 players and p0+p1 bonded, always picks p2 and p3', () => {
    const rng = createRng(SEED);
    const players = makeState(4).players;
    const existingBond = { playerA: 'p0', playerB: 'p1', type: BondType.Proximity, color: '#6ea8d8' };
    for (let i = 0; i < 50; i++) {
      const [a, b] = selectBondPair(players, [existingBond], rng);
      expect(['p2', 'p3']).toContain(a);
      expect(['p2', 'p3']).toContain(b);
    }
  });

  it('with 1 unbonded player, always includes them in the pair', () => {
    const rng = createRng(SEED);
    const players = makeState(3).players; // p0, p1, p2
    const bonds = [{ playerA: 'p0', playerB: 'p1', type: BondType.Proximity, color: '#6ea8d8' }];
    // p2 is the only unbonded player — must always appear in the pair
    for (let i = 0; i < 30; i++) {
      const pair = selectBondPair(players, bonds, rng);
      expect(pair).toContain('p2');
    }
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

  it('skips duplicate pair — with 2 players, the pair is always the same and a second call does not push', () => {
    const rng = createRng(SEED);
    const state = makeState(2);
    assignBond(state, rng);
    assignBond(state, rng);
    expect(state.activeBonds).toHaveLength(1);
  });

  it('duplicate-pair call reports the EXISTING bond, not a freshly-rolled one', () => {
    const rng = createRng(SEED);
    const state = makeState(2);
    const first = assignBond(state, rng);
    const second = assignBond(state, rng);
    expect(state.activeBonds).toHaveLength(1);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      // second call must describe exactly the bond that's actually stored —
      // not a new roll that the caller would broadcast as if it were real.
      expect(second.value.bondType).toBe(first.value.bondType);
      expect(second.value.bondColor).toBe(first.value.bondColor);
      expect(second.value).toEqual(first.value);
    }
  });

  it('bondKey is stable across repeat calls for the same pair (D-5.7-A regression)', () => {
    const rng = createRng(SEED);
    const state = makeState(2);
    const first = assignBond(state, rng);
    const second = assignBond(state, rng);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(bondKey(first.value.playerA, first.value.playerB))
        .toBe(bondKey(second.value.playerA, second.value.playerB));
    }
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

// ─── Story 5.3: per-tick bond effect helpers ───────────────────────────────

function makeProximityBond(playerA: string, playerB: string) {
  return { playerA, playerB, type: BondType.Proximity, color: '#6ea8d8' };
}
function makeFateBond(playerA: string, playerB: string) {
  return { playerA, playerB, type: BondType.Fate, color: '#f5a623' };
}

describe('bondKey', () => {
  it('returns a stable string for a pair', () => {
    expect(bondKey('p0', 'p1')).toBe('p0+p1');
    expect(bondKey('abc', 'xyz')).toBe('abc+xyz');
  });
});

describe('getProximityBuffedPlayers', () => {
  it('returns empty set when no bonds are in range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getProximityBuffedPlayers(bonds, new Set(), new Set()).size).toBe(0);
  });

  it('buffs both players when their bond key is in range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const result = getProximityBuffedPlayers(bonds, inRange, new Set());
    expect(result.has('p0')).toBe(true);
    expect(result.has('p1')).toBe(true);
  });

  it('ignores Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']); // even if key is in set, Fate bonds are not proximity
    expect(getProximityBuffedPlayers(bonds, inRange, new Set()).size).toBe(0);
  });

  it('handles multiple proximity bonds independently', () => {
    const bonds = [makeProximityBond('p0', 'p1'), makeProximityBond('p0', 'p2')];
    const inRange = new Set(['p0+p1']); // only first bond in range
    const result = getProximityBuffedPlayers(bonds, inRange, new Set());
    expect(result.has('p0')).toBe(true);  // p0 is in the in-range bond
    expect(result.has('p1')).toBe(true);
    expect(result.has('p2')).toBe(false); // second bond not in range
  });

  it('excludes a pair where either player is isSpirit (D-5.7-B)', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const resultA = getProximityBuffedPlayers(bonds, inRange, new Set(['p0']));
    expect(resultA.size).toBe(0);
    const resultB = getProximityBuffedPlayers(bonds, inRange, new Set(['p1']));
    expect(resultB.size).toBe(0);
  });

  it('excludes only the spirit pair when multiple in-range bonds are present', () => {
    const bonds = [makeProximityBond('p0', 'p1'), makeProximityBond('p2', 'p3')];
    const inRange = new Set(['p0+p1', 'p2+p3']);
    const result = getProximityBuffedPlayers(bonds, inRange, new Set(['p0']));
    expect(result.has('p0')).toBe(false);
    expect(result.has('p1')).toBe(false);
    expect(result.has('p2')).toBe(true);
    expect(result.has('p3')).toBe(true);
  });
});

describe('getFateBuffedPlayers', () => {
  it('includes all players in Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const result = getFateBuffedPlayers(bonds);
    expect(result.has('p0')).toBe(true);
    expect(result.has('p1')).toBe(true);
  });

  it('ignores Proximity bonds', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getFateBuffedPlayers(bonds).size).toBe(0);
  });

  it('returns empty for no bonds', () => {
    expect(getFateBuffedPlayers([]).size).toBe(0);
  });
});

describe('getFateBondWipeTargets', () => {
  const alivePlayers = [
    { id: 'p0', isDown: false, isSpirit: false, isFrozen: false },
    { id: 'p1', isDown: false, isSpirit: false, isFrozen: false },
    { id: 'p2', isDown: false, isSpirit: false, isFrozen: false },
  ];

  it('returns the partner when a Fate bonded player is downed', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual(['p1']);
    expect(getFateBondWipeTargets(bonds, 'p1', alivePlayers)).toEqual(['p0']);
  });

  it('skips a partner who is already isDown', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const players = [
      { id: 'p0', isDown: false, isSpirit: false, isFrozen: false },
      { id: 'p1', isDown: true,  isSpirit: false, isFrozen: false }, // already down
    ];
    expect(getFateBondWipeTargets(bonds, 'p0', players)).toEqual([]);
  });

  it('skips a partner who is isSpirit', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const players = [
      { id: 'p0', isDown: false, isSpirit: false, isFrozen: false },
      { id: 'p1', isDown: false, isSpirit: true, isFrozen: false },
    ];
    expect(getFateBondWipeTargets(bonds, 'p0', players)).toEqual([]);
  });

  it('skips a partner who is isFrozen (AC3)', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const players = [
      { id: 'p0', isDown: false, isSpirit: false, isFrozen: false },
      { id: 'p1', isDown: false, isSpirit: false, isFrozen: true },
    ];
    expect(getFateBondWipeTargets(bonds, 'p0', players)).toEqual([]);
  });

  it('returns empty for Proximity bonds', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual([]);
  });

  it('returns empty when the downed player is not in any Fate bond', () => {
    const bonds = [makeFateBond('p1', 'p2')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual([]);
  });
});

describe('getProximityDrainTargets', () => {
  const NOW = 10_000;
  const THRESHOLD_MS = BOND_DRAIN_THRESHOLD_S * 1000;

  it('does not drain before threshold', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS + 1]]); // 1ms short
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set())).toHaveLength(0);
  });

  it('drains at exactly the threshold', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS]]); // exactly at threshold
    const result = getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ playerA: 'p0', playerB: 'p1' });
  });

  it('does not drain when pair is out of range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set<string>(); // not in range
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS * 2]]); // long past threshold
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set())).toHaveLength(0);
  });

  it('ignores Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS * 2]]);
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set())).toHaveLength(0);
  });

  it('excludes a pair where either player is isSpirit (D-5.7-B)', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS]]); // at threshold
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set(['p0']))).toHaveLength(0);
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set(['p1']))).toHaveLength(0);
  });

  it('excludes only the spirit pair when multiple bonds are past threshold', () => {
    const bonds = [makeProximityBond('p0', 'p1'), makeProximityBond('p2', 'p3')];
    const inRange = new Set(['p0+p1', 'p2+p3']);
    const enterTimes = new Map([
      ['p0+p1', NOW - THRESHOLD_MS],
      ['p2+p3', NOW - THRESHOLD_MS],
    ]);
    const result = getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW, new Set(['p0']));
    expect(result).toEqual([{ playerA: 'p2', playerB: 'p3' }]);
  });
});

import { describe, it, expect } from 'vitest';
import type { PlayerState, BondState } from 'shared-types';
import { BondType } from 'shared-types';
import { selectBondPair } from '../../src/systems/bonds.js';

function makePlayer(id: string): PlayerState {
  return {
    id, displayName: id, class: null, x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionColor: 'red' as any, downCount: 0,
    nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
    channelingAbility: null,
  };
}

function makeBond(playerA: string, playerB: string): BondState {
  return { playerA, playerB, type: BondType.Proximity, color: '#fff' };
}

// Deterministic fake RNG: returns a fixed sequence of [0,1) fractions, one per call.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('selectBondPair', () => {
  const A = makePlayer('A');
  const B = makePlayer('B');
  const C = makePlayer('C');
  const players = [A, B, C];

  it('D-6.9-B/D1 repro: with A-B and A-C already bonded, always returns B-C regardless of RNG draw', () => {
    const bonds = [makeBond('A', 'B'), makeBond('A', 'C')];
    // Sweep several distinct RNG draw pairs — all must resolve to B-C, never re-selecting
    // an existing A-B or A-C pair.
    for (const [fa, fb] of [[0, 0], [0.5, 0.5], [0.99, 0.99], [0.1, 0.9], [0.9, 0.1]]) {
      const [p1, p2] = selectBondPair(players, bonds, seqRng([fa!, fb!]));
      const pair = new Set([p1, p2]);
      expect(pair.has('A')).toBe(false);
      expect(pair.has('B')).toBe(true);
      expect(pair.has('C')).toBe(true);
    }
  });

  it('fully-saturated 2-player roster: returns the only pair without throwing (assignBond dedup handles it)', () => {
    const twoPlayers = [A, B];
    const bonds = [makeBond('A', 'B')];
    const [p1, p2] = selectBondPair(twoPlayers, bonds, seqRng([0.3, 0.7]));
    const pair = new Set([p1, p2]);
    expect(pair.has('A')).toBe(true);
    expect(pair.has('B')).toBe(true);
  });

  it('common case (no existing bonds) is unchanged: always returns 2 distinct valid ids', () => {
    const [p1, p2] = selectBondPair(players, [], seqRng([0.4, 0.6]));
    expect(p1).not.toBe(p2);
    expect(['A', 'B', 'C']).toContain(p1);
    expect(['A', 'B', 'C']).toContain(p2);
  });

  it('calls rng() exactly twice per invocation', () => {
    let calls = 0;
    const rng = () => { calls++; return 0.5; };
    selectBondPair(players, [makeBond('A', 'B'), makeBond('A', 'C')], rng);
    expect(calls).toBe(2);
  });
});

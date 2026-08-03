import { describe, it, expect } from 'vitest';
import {
  isInConeZone,
  findNearestCandidate,
  resolveLightningArcChain,
  ABILITY_GEOMETRY,
  LIGHTNING_ARC_CORRIDOR_ANGLE_DEG,
  LIGHTNING_ARC_CHAIN_RADIUS_PX,
  LIGHTNING_ARC_MAX_BOUNCES,
  LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF,
} from 'game-rules';
import { PlayerClass } from 'shared-types';
import type { LightningArcCandidate } from 'game-rules';

const LIGHTNING_ARC_RANGE_PX = ABILITY_GEOMETRY[PlayerClass.STORMCALLER][0].hitRangePx;

// Composes the same pure pipeline GameRoom.ts's handleLightningArc uses: corridor
// gather (isInConeZone) -> nearest pick (findNearestCandidate) -> chain resolution
// (resolveLightningArcChain). GameRoom itself only gathers live candidates and
// applies the resolved hits — this test exercises the pure math end-to-end without
// any Colyseus/planck dependency.
function fireLightningArc(
  casterX: number,
  casterY: number,
  dirX: number,
  dirY: number,
  candidates: LightningArcCandidate[],
  rawDamage: number,
) {
  const inCorridor = candidates.filter(c =>
    isInConeZone(casterX, casterY, dirX, dirY, c.x, c.y, LIGHTNING_ARC_RANGE_PX, LIGHTNING_ARC_CORRIDOR_ANGLE_DEG));
  const firstTarget = findNearestCandidate(casterX, casterY, inCorridor);
  if (!firstTarget) return null;

  const remaining = candidates.filter(c => c.id !== firstTarget.id);
  return resolveLightningArcChain(
    casterX, casterY, firstTarget, rawDamage, remaining,
    LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF,
  );
}

describe('Lightning Arc first-target selection (AC1)', () => {
  it('picks the nearest candidate inside the corridor, aimed along +x', () => {
    const candidates: LightningArcCandidate[] = [
      { id: 'far', x: 150, y: 0 }, // still within the 160px range, just farther than 'near'
      { id: 'near', x: 100, y: 0 },
    ];
    const hits = fireLightningArc(0, 0, 1, 0, candidates, 18);
    expect(hits?.[0]?.id).toBe('near');
  });

  it('is a no-op when no candidate is inside the corridor', () => {
    const candidates: LightningArcCandidate[] = [{ id: 'behind', x: -100, y: 0 }];
    const hits = fireLightningArc(0, 0, 1, 0, candidates, 18);
    expect(hits).toBeNull();
  });

  it('excludes a candidate outside the 30deg corridor even if closer than an in-corridor one', () => {
    const candidates: LightningArcCandidate[] = [
      { id: 'off-axis', x: 10, y: 50 }, // wide angle from +x — outside a 30deg cone
      { id: 'on-axis', x: 120, y: 0 },
    ];
    const hits = fireLightningArc(0, 0, 1, 0, candidates, 18);
    expect(hits?.[0]?.id).toBe('on-axis');
  });

  it('boss-in-corridor: the boss is a valid first target, same as any enemy', () => {
    const candidates: LightningArcCandidate[] = [{ id: 'boss-1', x: 80, y: 0 }];
    const hits = fireLightningArc(0, 0, 1, 0, candidates, 18);
    expect(hits?.[0]?.id).toBe('boss-1');
  });
});

describe('Lightning Arc chain (AC2)', () => {
  it('chains to the nearest not-yet-hit candidate within the chain radius, applying 70% falloff', () => {
    const first: LightningArcCandidate = { id: 't0', x: 100, y: 0 };
    const chained: LightningArcCandidate = { id: 't1', x: 200, y: 0 }; // 100px from t0 — within 150px radius
    const hits = resolveLightningArcChain(0, 0, first, 18, [chained], LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF);

    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ id: 't0', damage: 18, chainIndex: 0, fromX: 0, fromY: 0 });
    expect(hits[1]).toMatchObject({ id: 't1', chainIndex: 1, fromX: 100, fromY: 0 });
    expect(hits[1]!.damage).toBeCloseTo(18 * 0.7);
  });

  it('caps the chain at LIGHTNING_ARC_MAX_BOUNCES (2) even with more in-range candidates available', () => {
    const first: LightningArcCandidate = { id: 't0', x: 0, y: 0 };
    const rest: LightningArcCandidate[] = [
      { id: 't1', x: 50, y: 0 },
      { id: 't2', x: 100, y: 0 },
      { id: 't3', x: 150, y: 0 },
    ];
    const hits = resolveLightningArcChain(0, 0, first, 100, rest, LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF);

    // first hit + 2 bounces = 3 total, never a 3rd bounce (4th hit)
    expect(hits).toHaveLength(1 + LIGHTNING_ARC_MAX_BOUNCES);
    expect(hits.map(h => h.chainIndex)).toEqual([0, 1, 2]);
    expect(hits[1]!.damage).toBeCloseTo(100 * 0.7);
    expect(hits[2]!.damage).toBeCloseTo(100 * 0.7 * 0.7);
  });

  it('stops the chain early (not an error) once no candidate remains within the chain radius', () => {
    const first: LightningArcCandidate = { id: 't0', x: 0, y: 0 };
    const farAway: LightningArcCandidate = { id: 't1', x: 1000, y: 0 }; // far outside 150px
    const hits = resolveLightningArcChain(0, 0, first, 18, [farAway], LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF);
    expect(hits).toHaveLength(1);
  });

  it('does not hit the same enemy twice in one cast (hitIds-style dedup) — a closer already-hit target is skipped in favor of the next-nearest', () => {
    const first: LightningArcCandidate = { id: 't0', x: 0, y: 0 };
    // t1 is nearer to t0 but must be excluded from remainingCandidates by the caller
    // (mirroring GameRoom's own "candidates minus firstTarget" filter) — verify the
    // chain never re-selects the first target even if it were mistakenly left in the pool.
    const rest: LightningArcCandidate[] = [
      { id: 't0', x: 0, y: 0 }, // duplicate of first target — must never be re-picked
      { id: 't2', x: 60, y: 0 },
    ];
    const hits = resolveLightningArcChain(0, 0, first, 18, rest, LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF);
    const ids = hits.map(h => h.id);
    expect(ids).toEqual(['t0', 't2']);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  it('boss-as-chain-target: the boss can be a chain-hop target, consistent with every other multi-hit ability in this codebase (see Dev Notes ambiguity call)', () => {
    const first: LightningArcCandidate = { id: 'enemy-1', x: 0, y: 0 };
    const boss: LightningArcCandidate = { id: 'boss-1', x: 80, y: 0 };
    const hits = resolveLightningArcChain(0, 0, first, 18, [boss], LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF);
    expect(hits[1]?.id).toBe('boss-1');
  });
});

describe('findNearestCandidate', () => {
  it('returns null for an empty candidate list', () => {
    expect(findNearestCandidate(0, 0, [])).toBeNull();
  });

  it('respects an optional maxRadiusPx cap', () => {
    const candidates: LightningArcCandidate[] = [{ id: 'far', x: 1000, y: 0 }];
    expect(findNearestCandidate(0, 0, candidates, 150)).toBeNull();
    expect(findNearestCandidate(0, 0, candidates)).toEqual(candidates[0]);
  });
});

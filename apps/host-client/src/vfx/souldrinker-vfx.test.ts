import { describe, expect, it } from 'vitest';
import { ABILITY_GEOMETRY, VOID_PULSE_ZONE_RADIUS_PX } from 'shared-types';
import {
  planSouldrinkerCast,
  planVoidPulseImpact,
  classifyHpChanges,
  type CastInput,
  type VfxSpec,
} from './souldrinker-vfx';

// Pure planners + classifier only — no canvas. Rendering correctness is the
// Client-UX manual pass (Story 7.4 §8.3). One runnable check per project
// convention, covering AC1's machine-checkable core and the AC3 classifier.

const cast = (over: Partial<CastInput>): CastInput => ({
  abilityIndex: 0, casterX: 500, casterY: 400, dirX: 1, dirY: 0, hpFraction: 1, ...over,
});

describe('planSouldrinkerCast', () => {
  it('produces a non-empty AND mutually distinct spec list for each of the four abilities (AC1)', () => {
    const plans = [0, 1, 2, 3].map(i => planSouldrinkerCast(cast({ abilityIndex: i })));
    for (const [i, specs] of plans.entries()) {
      expect(specs.length, `idx ${i} non-empty`).toBeGreaterThan(0);
    }
    // Pairwise distinctness: no two abilities serialize to the same effect list.
    const serialized = plans.map(p => JSON.stringify(p));
    for (let a = 0; a < serialized.length; a++) {
      for (let b = a + 1; b < serialized.length; b++) {
        expect(serialized[a], `idx ${a} vs ${b} distinct`).not.toBe(serialized[b]);
      }
    }
  });

  it('returns [] for a zero-length aim vector — the sim skips every Souldrinker cast (SILENT rule)', () => {
    for (const i of [0, 1, 2, 3]) {
      expect(planSouldrinkerCast(cast({ abilityIndex: i, dirX: 0, dirY: 0 })), `idx ${i}`).toEqual([]);
    }
  });

  it('returns [] for non-finite or out-of-range inputs without throwing', () => {
    expect(() => planSouldrinkerCast(cast({ dirX: NaN }))).not.toThrow();
    expect(planSouldrinkerCast(cast({ dirX: NaN }))).toEqual([]);
    expect(planSouldrinkerCast(cast({ casterX: Infinity }))).toEqual([]);
    expect(planSouldrinkerCast(cast({ dirY: NaN }))).toEqual([]);
    for (const idx of [-1, 4, 1.5, NaN]) {
      expect(planSouldrinkerCast(cast({ abilityIndex: idx })), `idx ${idx}`).toEqual([]);
    }
  });

  it('Crimson Lash impact ring sits at the real hit circle (caster + dir * range) with the real hit radius (AC1)', () => {
    const specs = planSouldrinkerCast(cast({ abilityIndex: 1, casterX: 500, casterY: 400, dirX: 1, dirY: 0 }));
    const impactRing = specs.find((s): s is Extract<VfxSpec, { kind: 'ring' }> => s.kind === 'ring');
    expect(impactRing).toBeDefined();
    expect(impactRing!.x).toBeCloseTo(500 + ABILITY_GEOMETRY.souldrinker[1].hitRangePx, 6);
    expect(impactRing!.y).toBeCloseTo(400, 6);
    expect(impactRing!.maxRadius).toBe(ABILITY_GEOMETRY.souldrinker[1].hitRadiusPx);
  });

  it('Crimson Lash carries an actual cone wedge sized to the live coneAngleDeg/hitRangePx, not just a re-angled beam fan (AC4)', () => {
    const specs = planSouldrinkerCast(cast({ abilityIndex: 1, casterX: 500, casterY: 400, dirX: 1, dirY: 0 }));
    const wedge = specs.find((s): s is Extract<VfxSpec, { kind: 'cone' }> => s.kind === 'cone');
    expect(wedge).toBeDefined();
    expect(wedge!.angleDeg).toBe(ABILITY_GEOMETRY.souldrinker[1].coneAngleDeg);
    expect(wedge!.maxRadius).toBe(ABILITY_GEOMETRY.souldrinker[1].hitRangePx);
    expect(wedge!.dirX).toBeCloseTo(1, 6);
    expect(wedge!.dirY).toBeCloseTo(0, 6);
  });

  it('Crimson Lash\'s side strokes fan at exactly half the real cone angle, not the old hardcoded 0.30 rad (AC4)', () => {
    const specs = planSouldrinkerCast(cast({ abilityIndex: 1, casterX: 500, casterY: 400, dirX: 1, dirY: 0 }));
    const beams = specs.filter((s): s is Extract<VfxSpec, { kind: 'beam' }> => s.kind === 'beam');
    expect(beams.length).toBe(3);
    const halfAngleRad = ((ABILITY_GEOMETRY.souldrinker[1].coneAngleDeg ?? 0) / 2) * (Math.PI / 180);
    const angleOf = (b: Extract<VfxSpec, { kind: 'beam' }>) => Math.atan2(b.toY - 400, b.toX - 500);
    const angles = beams.map(angleOf).sort((a, b) => a - b);
    expect(angles[0]).toBeCloseTo(-halfAngleRad, 6);
    expect(angles[1]).toBeCloseTo(0, 6); // centre stroke, unfanned
    expect(angles[2]).toBeCloseTo(halfAngleRad, 6);
    // Not the old fixed ~17.19° literal — 45°/2 = 22.5° is meaningfully wider.
    expect(Math.abs(angles[2]!)).not.toBeCloseTo(0.30, 3);
  });

  it('Crimson Lash beam width increases monotonically as hpFraction falls (HP-scaled read)', () => {
    const midWidthAt = (hpFraction: number): number => {
      const specs = planSouldrinkerCast(cast({ abilityIndex: 1, hpFraction }));
      const beams = specs.filter((s): s is Extract<VfxSpec, { kind: 'beam' }> => s.kind === 'beam');
      // The centre stroke is the widest of the three; compare it across HP levels.
      return Math.max(...beams.map(b => b.width));
    };
    expect(midWidthAt(0.5)).toBeGreaterThan(midWidthAt(1.0));
    expect(midWidthAt(0.0)).toBeGreaterThan(midWidthAt(0.5));
  });

  it('normalizes an un-normalized aim before projecting (magnitude-invariant)', () => {
    const unit = planSouldrinkerCast(cast({ abilityIndex: 1, dirX: 1, dirY: 0 }));
    const scaled = planSouldrinkerCast(cast({ abilityIndex: 1, dirX: 5, dirY: 0 }));
    expect(JSON.stringify(scaled)).toBe(JSON.stringify(unit));
  });
});

describe('planVoidPulseImpact', () => {
  it('implodes from exactly the chained pull-zone radius (startRadius > maxRadius, AC1)', () => {
    const [impact] = planVoidPulseImpact({ hitX: 100, hitY: 200 });
    expect(impact?.kind).toBe('ring');
    const ring = impact as Extract<VfxSpec, { kind: 'ring' }>;
    expect(ring.startRadius).toBe(VOID_PULSE_ZONE_RADIUS_PX);
    expect(ring.startRadius).toBeGreaterThan(ring.maxRadius);
  });
});

describe('classifyHpChanges', () => {
  it('reports loss on a decrease, gain on an increase, nothing on equality', () => {
    const prev = new Map([['a', 100], ['b', 40], ['c', 70]]);
    const next = [{ id: 'a', hp: 80 }, { id: 'b', hp: 60 }, { id: 'c', hp: 70 }];
    const changes = classifyHpChanges(prev, next);
    expect(changes).toEqual([
      { playerId: 'a', direction: 'loss', amount: 20 },
      { playerId: 'b', direction: 'gain', amount: 20 },
    ]);
  });

  it('yields no change for a player absent from prev (join / reconnect)', () => {
    const prev = new Map<string, number>();
    expect(classifyHpChanges(prev, [{ id: 'new', hp: 50 }])).toEqual([]);
  });
});

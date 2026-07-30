import { describe, expect, it } from 'vitest';
import type { PlayerState, ZoneState } from 'shared-types';
import { PlayerClass, TEMPEST_HURL_BLAST_RADIUS_PX } from 'shared-types';
import {
  resolveStormcallerCast,
  stormEyeTickCadence,
  planChainHitBeam,
  planTempestHurlImpact,
  spawnStormcallerSpecs,
  type StormcallerCastPlan,
  type StormcallerVfxSpec,
} from './stormcaller-vfx';
import { resolveZoneVisual, STORM_EYE_ZONE_VISUAL, VOID_PULSE_ZONE_VISUAL } from './ability-vfx-config';
import { VfxEngine } from './engine';
import type { VfxStage } from './types';

function fakeStage(): VfxStage & { children: unknown[] } {
  const children: unknown[] = [];
  return {
    children,
    addChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
  };
}

// Pure planner + cadence + zone-seam only — no canvas. Rendering correctness is
// the Client-UX manual pass (Story 7.5 §8.3). One runnable check per project
// convention, covering AC1/AC2 (distinct, honestly-sized casts), AC3 (cadence)
// and AC5 (the today-behavior zone default).

const rings = (p: StormcallerCastPlan): Extract<StormcallerVfxSpec, { kind: 'ring' }>[] =>
  p.specs.filter((s): s is Extract<StormcallerVfxSpec, { kind: 'ring' }> => s.kind === 'ring');

describe('resolveStormcallerCast', () => {
  it('each of indices 0–3 returns a plan whose serialized signature differs from the other three (AC1)', () => {
    const plans = [0, 1, 2, 3].map(i => resolveStormcallerCast(i, 100, 100, 1, 0));
    for (const [i, plan] of plans.entries()) expect(plan, `idx ${i} non-null`).not.toBeNull();
    const serialized = plans.map(p => JSON.stringify(p));
    for (let a = 0; a < serialized.length; a++) {
      for (let b = a + 1; b < serialized.length; b++) {
        expect(serialized[a], `idx ${a} vs ${b} distinct`).not.toBe(serialized[b]);
      }
    }
  });

  it('Lightning Arc (0): beam endpoint at caster + dir*160 (AC2)', () => {
    const plan = resolveStormcallerCast(0, 100, 100, 1, 0)!;
    const beams = plan.specs.filter((s): s is Extract<StormcallerVfxSpec, { kind: 'beam' }> => s.kind === 'beam');
    expect(beams.length).toBe(2); // glow + core
    for (const b of beams) {
      expect(b.toX).toBeCloseTo(260, 6); // 100 + 160
      expect(b.toY).toBeCloseTo(100, 6);
    }
    // Story 7.13: the old fixed-endpoint "crack ring" is removed — the real
    // per-hop connections now come from ability:chain-hit's planChainHitBeam.
    expect(rings(plan).length).toBe(0);
  });

  it('Tempest Hurl (1): cast plan is only the launch puff — no flight field (Story 7.13)', () => {
    const plan = resolveStormcallerCast(1, 0, 0, 1, 0)!;
    expect(plan.specs.length).toBeGreaterThan(0);
    expect((plan as unknown as { flight?: unknown }).flight).toBeUndefined();
  });

  it('Thunder Clap (2): tolerates a zero direction and its bright ring reaches exactly 110 (AC2)', () => {
    const plan = resolveStormcallerCast(2, 50, 50, 0, 0);
    expect(plan).not.toBeNull();
    // The honest bright ring is the one growing to the real hit radius from 0.
    const bright = rings(plan!).find(r => r.startRadius === 0 && r.maxRadius === 110);
    expect(bright, 'bright 110px ring present').toBeDefined();
  });

  it('Storm Eye (3): dir (0,1) places the implode ring at (x, y+160) with the zone radius 150 (AC2)', () => {
    const plan = resolveStormcallerCast(3, 300, 200, 0, 1)!;
    const implode = rings(plan).find(r => r.maxRadius === 150)!;
    expect(implode).toBeDefined();
    expect(implode.x).toBeCloseTo(300, 6);
    expect(implode.y).toBeCloseTo(360, 6); // 200 + 160
  });

  it('directional abilities (0/1/3) return null on a zero aim; Thunder Clap (2) does not (SILENT rule)', () => {
    for (const i of [0, 1, 3]) expect(resolveStormcallerCast(i, 0, 0, 0, 0), `idx ${i}`).toBeNull();
    expect(resolveStormcallerCast(2, 0, 0, 0, 0)).not.toBeNull();
  });

  it('returns null for out-of-range or non-finite inputs without throwing', () => {
    for (const i of [-1, 4, 1.5, NaN]) expect(resolveStormcallerCast(i, 0, 0, 1, 0), `idx ${i}`).toBeNull();
    expect(() => resolveStormcallerCast(0, NaN, 0, 1, 0)).not.toThrow();
    expect(resolveStormcallerCast(0, NaN, 0, 1, 0)).toBeNull();
    expect(resolveStormcallerCast(0, 0, 0, NaN, 0)).toBeNull();
  });

  it('normalizes an un-normalized aim before projecting (magnitude-invariant)', () => {
    const unit = resolveStormcallerCast(0, 100, 100, 0.6, 0.8);
    const scaled = resolveStormcallerCast(0, 100, 100, 3, 4); // same direction, |v|=5
    expect(JSON.stringify(scaled)).toBe(JSON.stringify(unit));
  });
});

describe('stormEyeTickCadence', () => {
  it('ticksRemaining decreases by exactly 1 across one 500 ms step', () => {
    const a = stormEyeTickCadence(0, 5000, 500)!;
    const b = stormEyeTickCadence(500, 5000, 500)!;
    expect(a.ticksRemaining - b.ticksRemaining).toBe(1);
  });

  it('is monotonically non-increasing over the zone life and decrements once per real tick boundary', () => {
    // Sweep 0..4900 in 100 ms steps against a 5000 ms / 500 ms zone. ticksRemaining
    // runs 10 → 1; the 10th tick lands at expiry (now >= expiresAtMs → null), so
    // exactly 9 decrement events are observed within the live window.
    let prev = Infinity;
    let decrements = 0;
    for (let now = 0; now <= 4900; now += 100) {
      const c = stormEyeTickCadence(now, 5000, 500)!;
      expect(c, `alive at ${now}`).not.toBeNull();
      expect(c.ticksRemaining).toBeLessThanOrEqual(prev);
      if (c.ticksRemaining < prev && prev !== Infinity) decrements++;
      expect(c.phase).toBeGreaterThanOrEqual(0);
      expect(c.phase).toBeLessThan(1);
      prev = c.ticksRemaining;
    }
    expect(decrements).toBe(9);
    expect(prev).toBe(1); // final observed value just before expiry
  });

  it('returns null for a non-positive interval, non-finite inputs, or an expired zone', () => {
    expect(stormEyeTickCadence(0, 5000, 0)).toBeNull();
    expect(stormEyeTickCadence(0, 5000, -500)).toBeNull();
    expect(stormEyeTickCadence(NaN, 5000, 500)).toBeNull();
    expect(stormEyeTickCadence(0, NaN, 500)).toBeNull();
    expect(stormEyeTickCadence(0, 5000, NaN)).toBeNull();
    expect(stormEyeTickCadence(5000, 5000, 500)).toBeNull(); // now === expiry
    expect(stormEyeTickCadence(6000, 5000, 500)).toBeNull(); // past expiry
  });
});

describe('planChainHitBeam / spawnStormcallerSpecs (Story 7.13)', () => {
  it('produces a beam spec from the hop\'s real fromX/fromY to the resolved target', () => {
    const spec = planChainHitBeam(10, 20, 110, 40);
    expect(spec.kind).toBe('beam');
    const b = spec as Extract<StormcallerVfxSpec, { kind: 'beam' }>;
    expect(b.x).toBe(10);
    expect(b.y).toBe(20);
    expect(b.toX).toBe(110);
    expect(b.toY).toBe(40);
  });

  it('spawns one live beam per hop, even for N same-tick hits — no batch-collapse (7.11 contract)', () => {
    const stage = fakeStage();
    const engine = new VfxEngine(stage);
    spawnStormcallerSpecs(engine, [planChainHitBeam(0, 0, 100, 0)], 1000);
    spawnStormcallerSpecs(engine, [planChainHitBeam(100, 0, 200, 0)], 1000);
    spawnStormcallerSpecs(engine, [planChainHitBeam(200, 0, 300, 0)], 1000);
    expect(engine.size).toBe(3);
  });
});

describe('planTempestHurlImpact (Story 7.13)', () => {
  it('sizes its ring to TEMPEST_HURL_BLAST_RADIUS_PX, not the old hitscan-era 70px', () => {
    const specs = planTempestHurlImpact({ hitX: 300, hitY: 200 });
    const impactRing = specs.find((s): s is Extract<StormcallerVfxSpec, { kind: 'ring' }> => s.kind === 'ring');
    expect(impactRing).toBeDefined();
    expect(impactRing!.maxRadius).toBe(TEMPEST_HURL_BLAST_RADIUS_PX);
    expect(impactRing!.x).toBe(300);
    expect(impactRing!.y).toBe(200);
  });
});

describe('resolveZoneVisual (Story 7.8 seam)', () => {
  const player = (over: Partial<PlayerState>): PlayerState => ({
    id: 'p1', displayName: 'P', sessionColor: 0, class: PlayerClass.STORMCALLER,
    x: 0, y: 0, hp: 100, maxHp: 100, isDown: false, isSpirit: false, isFrozen: false,
    statusEffects: [], channelingAbility: null,
    // Cast to satisfy the full PlayerState shape without enumerating every optional
    // field the seam never reads (it only touches id + class).
    ...over,
  } as unknown as PlayerState);

  const zone = (over: Partial<ZoneState>): ZoneState => ({
    id: 'z1', ownerId: 'p1', x: 0, y: 0, radius: 150, effectType: 'damage',
    tickIntervalMs: 500, expiresAtMs: 5000, ...over,
  });

  it("a 'damage' zone owned by a Stormcaller → STORM_EYE_ZONE_VISUAL", () => {
    const v = resolveZoneVisual(zone({}), [player({})]);
    expect(v).toBe(STORM_EYE_ZONE_VISUAL);
  });

  it("a 'pull' zone owned by a Souldrinker → VOID_PULSE_ZONE_VISUAL (Story 7.8's own case)", () => {
    const v = resolveZoneVisual(zone({ effectType: 'pull' }), [player({ class: PlayerClass.SOULDRINKER })]);
    expect(v).toBe(VOID_PULSE_ZONE_VISUAL);
  });

  it("a 'damage' zone whose owner is not present → the effectType-only fallback tier, not the global default, no throw (late join / reconnect, Story 7.8 AC2)", () => {
    expect(() => resolveZoneVisual(zone({ ownerId: 'ghost' }), [player({})])).not.toThrow();
    const v = resolveZoneVisual(zone({ ownerId: 'ghost' }), [player({})]);
    expect(v).not.toBe(STORM_EYE_ZONE_VISUAL);
    expect(v.fillColor).toBe(STORM_EYE_ZONE_VISUAL.fillColor);
    expect(v.fillColor).not.toBe(0x9b59b6);
  });
});

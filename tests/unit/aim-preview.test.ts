import { describe, it, expect } from 'vitest';
import { resolveAimPoint, isInHitZone } from 'game-rules';
import { ABILITY_GEOMETRY, CLASS_DEFINITIONS, PlayerClass } from 'shared-types';

/**
 * Story 7.15b (ADR-0008). The point of these tests is NOT "the preview target is
 * at caster + dir × range" — that would just restate the implementation. It is
 * that the preview target equals what the REAL cast path resolves for the same
 * inputs, which is the property ADR-0008 exists to guarantee and the one that
 * breaks silently when someone retunes an ability's range.
 */

// The four abilities that get a destination preview, per the declarative rule
// `inputType === 'RELEASE' && delivery !== 'projectile'`.
const DESTINATION_PREVIEW_ABILITIES = [
  { name: 'Stone Wall',   cls: PlayerClass.STONEHIDE,   index: 0 },
  { name: 'Crimson Lash', cls: PlayerClass.SOULDRINKER, index: 1 },
  { name: 'Dark Pact',    cls: PlayerClass.SOULDRINKER, index: 2 },
  { name: 'Storm Eye',    cls: PlayerClass.STORMCALLER, index: 3 },
] as const;

describe('resolveAimPoint (Story 7.15b)', () => {
  it('normalizes a non-unit direction before applying range', () => {
    // (3,4) has magnitude 5; the aim point must be 100px away, not 500.
    const aim = resolveAimPoint(0, 0, 3, 4, 100);
    expect(aim).not.toBeNull();
    expect(Math.hypot(aim!.x, aim!.y)).toBeCloseTo(100, 6);
    expect(aim!.dirX).toBeCloseTo(0.6, 6);
    expect(aim!.dirY).toBeCloseTo(0.8, 6);
  });

  it('returns null for a zero direction (SILENT rule — the sim skips such a cast)', () => {
    expect(resolveAimPoint(100, 200, 0, 0, 160)).toBeNull();
  });

  it('returns null for NaN — the result of normalizing a zero-length drag (0/0)', () => {
    expect(resolveAimPoint(100, 200, NaN, NaN, 160)).toBeNull();
    expect(resolveAimPoint(100, 200, NaN, 1, 160)).toBeNull();
  });

  it('returns null for Infinity and for null-from-JSON in a field typed number', () => {
    expect(resolveAimPoint(100, 200, Infinity, 0, 160)).toBeNull();
    // JSON.stringify turns non-finite numbers into null; deserialize is an
    // unchecked cast, so the sim really can receive this shape.
    expect(resolveAimPoint(100, 200, null as unknown as number, null as unknown as number, 160)).toBeNull();
  });

  it('a zero-magnitude check written as `=== 0` would NOT catch NaN — this is why the guard is `!(mag > 0)`', () => {
    const mag = Math.hypot(NaN, NaN);
    expect(mag === 0).toBe(false);      // the naive guard passes it through
    expect(!(mag > 0)).toBe(true);      // the guard actually used rejects it
  });

  it('hitRangePx of 0 yields the caster position (self-centred abilities)', () => {
    const aim = resolveAimPoint(500, 400, 1, 0, 0);
    expect(aim).toEqual({ x: 500, y: 400, dirX: 1, dirY: 0 });
  });
});

describe('preview target matches real cast placement (AC2)', () => {
  const casterX = 500;
  const casterY = 400;

  for (const { name, cls, index } of DESTINATION_PREVIEW_ABILITIES) {
    it(`${name}: the previewed point is the centre the real hit-test uses`, () => {
      const geometry = ABILITY_GEOMETRY[cls][index];
      const dirX = 3;
      const dirY = 4; // deliberately non-unit — the cast path normalizes, so must the preview

      const aim = resolveAimPoint(casterX, casterY, dirX, dirY, geometry.hitRangePx)!;
      expect(aim).not.toBeNull();

      // The real cast path's hit circle is centred on the aim point. Probe it
      // through the actual production predicate rather than re-deriving the
      // centre: a target exactly at the previewed point must register as a hit,
      // and one just beyond the radius must not. This is what ties the preview
      // to the cast — if either drifts, one of these two assertions fails.
      const probeRadius = geometry.hitShape === 'cone' ? geometry.hitRangePx : geometry.hitRadiusPx;
      expect(
        isInHitZone(casterX, casterY, aim.dirX, aim.dirY, aim.x, aim.y, probeRadius, geometry.hitRangePx, true),
      ).toBe(true);
      expect(
        isInHitZone(
          casterX, casterY, aim.dirX, aim.dirY,
          aim.x + probeRadius + 1, aim.y,
          probeRadius, geometry.hitRangePx, true,
        ),
      ).toBe(false);
    });

    it(`${name}: is RELEASE-type and non-projectile, so the declarative target rule selects it`, () => {
      const abilityDef = CLASS_DEFINITIONS[cls].abilities[index];
      const geometry = ABILITY_GEOMETRY[cls][index];
      expect(abilityDef.inputType).toBe('RELEASE');
      expect(geometry.delivery).not.toBe('projectile');
    });
  }

  it('Storm Eye: the preview point is exactly where the real zone is placed', () => {
    // Storm Eye is the one ability whose cast-time placement is a literal
    // position (a ZoneState), so it can be asserted directly rather than probed.
    const geometry = ABILITY_GEOMETRY[PlayerClass.STORMCALLER][3];
    const aim = resolveAimPoint(casterX, casterY, 0, 1, geometry.hitRangePx)!;
    // GameRoom's zone branch now calls the same resolveAimPoint, so this is the
    // spawn position by construction — the assertion pins the contract, not the maths.
    expect(aim.x).toBeCloseTo(casterX, 6);
    expect(aim.y).toBeCloseTo(casterY + geometry.hitRangePx, 6);
  });
});

describe('abilities that must NOT get a destination preview', () => {
  const cases = [
    { name: 'Void Pulse',   cls: PlayerClass.SOULDRINKER, index: 3, why: 'projectile — resolves on contact' },
    { name: 'Tempest Hurl', cls: PlayerClass.STORMCALLER, index: 1, why: 'projectile — resolves on contact' },
  ] as const;

  for (const { name, cls, index, why } of cases) {
    it(`${name} is RELEASE but projectile-delivery, so the rule excludes it (${why})`, () => {
      expect(CLASS_DEFINITIONS[cls].abilities[index].inputType).toBe('RELEASE');
      expect(ABILITY_GEOMETRY[cls][index].delivery).toBe('projectile');
    });
  }

  it('Lightning Arc is AUTO, so it gets an arrow but never a target', () => {
    // Its real landing point is a corridor-gathered nearest enemy, not
    // caster + dir × range, so a destination preview would be a lie.
    expect(CLASS_DEFINITIONS[PlayerClass.STORMCALLER].abilities[0].inputType).toBe('AUTO');
  });

  it('the declarative rule selects exactly the four named abilities, repo-wide', () => {
    const selected: string[] = [];
    for (const cls of Object.values(PlayerClass)) {
      CLASS_DEFINITIONS[cls].abilities.forEach((def, i) => {
        const geometry = ABILITY_GEOMETRY[cls][i as 0 | 1 | 2 | 3];
        if (def.inputType === 'RELEASE' && geometry.delivery !== 'projectile') selected.push(def.name);
      });
    }
    expect(selected.sort()).toEqual(['Crimson Lash', 'Dark Pact', 'Stone Wall', 'Storm Eye']);
  });
});

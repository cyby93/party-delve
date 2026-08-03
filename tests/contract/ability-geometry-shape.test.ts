import { describe, expect, it } from 'vitest';
import { PlayerClass, ABILITY_GEOMETRY } from 'shared-types';
import type { AbilityGeometry } from 'shared-types';

/**
 * Migration-correctness contract test (Story 3.27, ADR-0006). `ABILITY_GEOMETRY`
 * replaces 5 flat per-class tables (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`,
 * `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`) that existed
 * before this story — this test pins every class/slot's migrated fields to the
 * exact pre-refactor literal values, so a transcription slip during the
 * consolidation itself would fail loudly instead of silently re-tuning an ability.
 */

// The documented pre-refactor values (Story 3.27's Dev Notes table), one entry
// per PlayerClass/ability-slot pair.
const EXPECTED: Record<PlayerClass, readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]> = {
  stonehide: [
    { hitRangePx: 160, hitRadiusPx: 160, hitShape: 'cone', coneAngleDeg: 50, delivery: 'hitscan' },
    { hitRangePx: 0, hitRadiusPx: 300, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 0, hitRadiusPx: 200, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 75, hitRadiusPx: 50, hitShape: 'cone', coneAngleDeg: 40, delivery: 'hitscan' },
  ],
  spiritcaller: [
    { hitRangePx: 100, hitRadiusPx: 120, hitShape: 'cone', coneAngleDeg: 70, delivery: 'hitscan' },
    { hitRangePx: 0, hitRadiusPx: 90, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 200, hitRadiusPx: 60, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 0, hitRadiusPx: 90, hitShape: 'circle', delivery: 'hitscan' },
  ],
  souldrinker: [
    { hitRangePx: 150, hitRadiusPx: 50, hitShape: 'circle', delivery: 'projectile' },
    { hitRangePx: 180, hitRadiusPx: 65, hitShape: 'cone', coneAngleDeg: 45, delivery: 'hitscan' },
    { hitRangePx: 180, hitRadiusPx: 80, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 0, hitRadiusPx: 80, hitShape: 'circle', delivery: 'projectile' },
  ],
  stormcaller: [
    { hitRangePx: 160, hitRadiusPx: 60, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 200, hitRadiusPx: 70, hitShape: 'circle', delivery: 'projectile' },
    { hitRangePx: 0, hitRadiusPx: 110, hitShape: 'circle', delivery: 'hitscan' },
    { hitRangePx: 160, hitRadiusPx: 80, hitShape: 'circle', delivery: 'zone' },
  ],
};

const CLASSES = [
  PlayerClass.STONEHIDE,
  PlayerClass.SPIRITCALLER,
  PlayerClass.SOULDRINKER,
  PlayerClass.STORMCALLER,
] as const;

describe('ABILITY_GEOMETRY byte-identical migration guard (Story 3.27)', () => {
  for (const cls of CLASSES) {
    for (let slot = 0; slot < 4; slot++) {
      it(`${cls}[${slot}] matches its pre-refactor flat-table values`, () => {
        expect(ABILITY_GEOMETRY[cls][slot]).toEqual(EXPECTED[cls][slot]);
      });
    }
  }

  it('coneAngleDeg is present only on cone-shaped entries', () => {
    for (const cls of CLASSES) {
      for (let slot = 0; slot < 4; slot++) {
        const geometry = ABILITY_GEOMETRY[cls][slot]!;
        if (geometry.hitShape === 'cone') {
          expect(geometry.coneAngleDeg).toBeTypeOf('number');
        } else {
          expect(geometry.coneAngleDeg).toBeUndefined();
        }
      }
    }
  });
});

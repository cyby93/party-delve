import { describe, expect, it } from 'vitest';
import { PlayerClass, VOID_PULSE_ZONE_RADIUS_PX } from 'shared-types';
import { ABILITY_BALANCE } from 'game-rules';
import type { AbilityBalance } from 'game-rules';

/**
 * Migration-correctness contract test (Story 3.28, D-CC1). `ABILITY_BALANCE`
 * replaces 9 flat per-class tables (`ABILITY_COOLDOWNS_MS`, `ABILITY_DAMAGE`,
 * `ABILITY_HEAL_AMOUNT`, `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`,
 * `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`, `ABILITY_STATUS_EFFECT`,
 * `ABILITY_DISPLACEMENT_STRENGTH`) that existed before this story — this test
 * pins every class/slot's migrated fields to the exact pre-refactor literal
 * values, so a transcription slip during the consolidation itself would fail
 * loudly instead of silently re-tuning an ability.
 */

// The documented pre-refactor values (Story 3.28's Dev Notes table), one entry
// per PlayerClass/ability-slot pair.
const EXPECTED: Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]> = {
  stonehide: [
    { cooldownMs: 2000, damage: 15, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 40, statusEffect: null, chainedZone: null },
    { cooldownMs: 4000, damage: 35, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' }, chainedZone: null },
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' }, chainedZone: null },
    { cooldownMs: 1000, damage: 50, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
  ],
  spiritcaller: [
    { cooldownMs: 1500, damage: 15, healAmount: 10, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 5000, damage: 40, healAmount: 30, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 4000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' }, chainedZone: null },
  ],
  souldrinker: [
    { cooldownMs: 1000, damage: 12, healAmount: 0, selfCostHp: 10, hpScaledDamage: 0, lifestealPct: 0.5, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 3000, damage: 30, healAmount: 0, selfCostHp: 0, hpScaledDamage: 1.0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 5000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageBuff', magnitude: 0.25, durationMs: 4000, scope: 'self' }, chainedZone: null },
    { cooldownMs: 4000, damage: 25, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: { effectType: 'pull', radius: VOID_PULSE_ZONE_RADIUS_PX, tickIntervalMs: 500, durationMs: 2000 } },
  ],
  stormcaller: [
    { cooldownMs: 1000, damage: 18, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 3000, damage: 40, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 5000, damage: 45, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
    { cooldownMs: 2000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null },
  ],
};

const CLASSES = [
  PlayerClass.STONEHIDE,
  PlayerClass.SPIRITCALLER,
  PlayerClass.SOULDRINKER,
  PlayerClass.STORMCALLER,
] as const;

describe('ABILITY_BALANCE byte-identical migration guard (Story 3.28)', () => {
  for (const cls of CLASSES) {
    for (let slot = 0; slot < 4; slot++) {
      it(`${cls}[${slot}] matches its pre-refactor flat-table values`, () => {
        expect(ABILITY_BALANCE[cls][slot]).toEqual(EXPECTED[cls][slot]);
      });
    }
  }
});

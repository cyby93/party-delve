import { describe, expect, it } from 'vitest';
import { PlayerClass, ABILITY_GEOMETRY } from 'shared-types';
import type { StatusEffect } from 'shared-types';
import {
  getAbilityVfxConfig,
  resolveAbilityVfxPlacement,
  ownsIronSkinShell,
  type AbilityVfxConfig,
} from './ability-vfx';

// Pure mapping + placement math only — no canvas, no PixiJS display objects.
// Rendering correctness is verified by the Client-UX manual pass (story 7.2).
//
// The cooldown-budget invariant (every effect shorter than its cooldown) moved to
// tests/contract/ability-vfx-budget.test.ts (Story 7.9) — the one tier allowed to
// import both game-rules and the host constants, so it asserts against the LIVE
// ABILITY_COOLDOWNS_MS instead of a hand-copied literal here.

/** Shape+color+motion signature used for the AC1 distinctness assertion. */
function signatureOf(cfg: AbilityVfxConfig): string {
  const rings = cfg.rings
    .map(r => `ring(${r.at},${r.startRadius}->${r.maxRadius},${r.filled ? 'fill' : 'stroke'},${r.color})`)
    .join('|');
  const beam = cfg.beam ? `beam(${cfg.beam.originOffsetPx}->${cfg.beam.target},${cfg.beam.color})` : '';
  const burst = cfg.burst ? `burst(${cfg.burst.count},${cfg.burst.speed},${cfg.burst.colors.join('/')})` : '';
  return `${rings}#${beam}#${burst}`;
}

describe('getAbilityVfxConfig', () => {
  it('returns a config for all four Stonehide abilities', () => {
    for (let i = 0; i < 4; i++) {
      expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, i), `index ${i}`).not.toBeNull();
    }
  });

  it('gives no two Stonehide abilities the same shape+color+motion signature (AC1)', () => {
    const signatures = [0, 1, 2, 3].map(i => signatureOf(getAbilityVfxConfig(PlayerClass.STONEHIDE, i)!));
    expect(new Set(signatures).size).toBe(4);
  });

  it('returns null for every other class — the legacy ABILITY_FLASH_MS contract (AC3)', () => {
    for (const cls of [PlayerClass.SPIRITCALLER, PlayerClass.SOULDRINKER, PlayerClass.STORMCALLER]) {
      for (let i = 0; i < 4; i++) {
        expect(getAbilityVfxConfig(cls, i), `${cls} index ${i}`).toBeNull();
      }
    }
    expect(getAbilityVfxConfig(null, 0)).toBeNull();
  });

  it('returns null instead of throwing for an out-of-range ability index', () => {
    expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, -1)).toBeNull();
    expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, 4)).toBeNull();
    expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, 1.5)).toBeNull();
    expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, NaN)).toBeNull();
  });

  it('gives Avalanche no particle burst — the AUTO-fire volume decision (AC5)', () => {
    expect(getAbilityVfxConfig(PlayerClass.STONEHIDE, 3)!.burst).toBeUndefined();
  });
});

describe('resolveAbilityVfxPlacement', () => {
  const place = (index: number, dx: number, dy: number) =>
    resolveAbilityVfxPlacement(getAbilityVfxConfig(PlayerClass.STONEHIDE, index)!, 500, 400, dx, dy);

  it('centres Stone Wall, Tremor Stomp and Iron Skin on the caster (AC2)', () => {
    for (const index of [0, 1, 2]) {
      const p = place(index, 1, 0)!;
      expect({ x: p.hitX, y: p.hitY }, `index ${index}`).toEqual({ x: 500, y: 400 });
    }
  });

  it('puts Avalanche at caster + normalizedDirection x the live contract range for a non-unit direction (AC2/AC4)', () => {
    // Reads the shared contract, not a literal 200 — proves the VFX placement is
    // driven by the same value the sim resolves the hit with (Story 7.9 / D-7.2-A).
    const range = ABILITY_GEOMETRY.stonehide[3].hitRangePx;
    const p = place(3, 3, 4)!; // magnitude 5 — proves normalization
    expect(p.hitX).toBeCloseTo(500 + (3 / 5) * range, 6);
    expect(p.hitY).toBeCloseTo(400 + (4 / 5) * range, 6);
    expect(p.casterX).toBe(500);
    expect(p.casterY).toBe(400);
  });

  it('renders nothing for a zero-direction Avalanche — the sim skips that hit too', () => {
    expect(place(3, 0, 0)).toBeNull();
  });

  it('still places a zero-direction Tremor Stomp, which the sim fires regardless', () => {
    const p = place(1, 0, 0)!;
    expect({ x: p.hitX, y: p.hitY }).toEqual({ x: 500, y: 400 });
  });
});

describe('ownsIronSkinShell', () => {
  const dr: StatusEffect = { type: 'damageReduction', magnitude: 0.3, expiresAtMs: 1 };
  const slow: StatusEffect = { type: 'slow', magnitude: 0.4, expiresAtMs: 1 };

  it('is true only for a Stonehide carrying damageReduction (the 7.6 hand-off gate)', () => {
    expect(ownsIronSkinShell({ class: PlayerClass.STONEHIDE, statusEffects: [dr] })).toBe(true);
    expect(ownsIronSkinShell({ class: PlayerClass.STONEHIDE, statusEffects: [slow] })).toBe(false);
    expect(ownsIronSkinShell({ class: PlayerClass.STONEHIDE, statusEffects: [] })).toBe(false);
    expect(ownsIronSkinShell({ class: PlayerClass.STORMCALLER, statusEffects: [dr] })).toBe(false);
    expect(ownsIronSkinShell({ class: null, statusEffects: [dr] })).toBe(false);
  });
});

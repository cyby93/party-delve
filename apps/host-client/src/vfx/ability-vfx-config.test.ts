import { describe, expect, it } from 'vitest';
import { PlayerClass } from 'shared-types';
import type { PlayerState, ZoneState } from 'shared-types';
import {
  resolveProjectileAppearance,
  DEFAULT_PROJECTILE_APPEARANCE,
  PROJECTILE_APPEARANCE,
  resolveZoneVisual,
  STORM_EYE_ZONE_VISUAL,
  VOID_PULSE_ZONE_VISUAL,
} from './ability-vfx-config';

// Pure data + lookups only — no pixi.js import, so this suite runs in
// milliseconds (Story 7.8 Task 9.1). Rendering itself is verified manually via
// the Client-UX hook; these are the machine-checkable AC1-3 guarantees.

const player = (over: Partial<PlayerState>): PlayerState =>
  ({ id: 'p1', class: PlayerClass.SOULDRINKER, ...over } as PlayerState);

const zone = (over: Partial<ZoneState>): ZoneState =>
  ({ id: 'z1', ownerId: 'p1', x: 0, y: 0, radius: 150, effectType: 'pull', tickIntervalMs: 500, expiresAtMs: 0, ...over } as ZoneState);

describe('resolveProjectileAppearance', () => {
  it('Souldrinker idx 0 (Blood Spike) and idx 3 (Void Pulse) each return their own distinct entry', () => {
    const bloodSpike = resolveProjectileAppearance(PlayerClass.SOULDRINKER, 0);
    const voidPulse = resolveProjectileAppearance(PlayerClass.SOULDRINKER, 3);
    expect(bloodSpike).not.toEqual(voidPulse);
    expect(bloodSpike).not.toEqual(DEFAULT_PROJECTILE_APPEARANCE);
    expect(voidPulse).not.toEqual(DEFAULT_PROJECTILE_APPEARANCE);
    expect(bloodSpike).toBe(PROJECTILE_APPEARANCE[PlayerClass.SOULDRINKER]![0]);
    expect(voidPulse).toBe(PROJECTILE_APPEARANCE[PlayerClass.SOULDRINKER]![3]);
  });

  it('an unmapped (class, abilityIndex) pair returns DEFAULT_PROJECTILE_APPEARANCE', () => {
    expect(resolveProjectileAppearance(PlayerClass.SOULDRINKER, 1)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(resolveProjectileAppearance(PlayerClass.STONEHIDE, 0)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
  });

  it('Stormcaller idx 1 (Tempest Hurl) resolves to its own entry; idx 0/2/3 fall through to the default (Story 7.13)', () => {
    const tempestHurl = resolveProjectileAppearance(PlayerClass.STORMCALLER, 1);
    expect(tempestHurl).not.toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(tempestHurl).toBe(PROJECTILE_APPEARANCE[PlayerClass.STORMCALLER]![1]);
    for (const idx of [0, 2, 3]) {
      expect(resolveProjectileAppearance(PlayerClass.STORMCALLER, idx), `idx ${idx}`).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    }
  });

  it('undefined class and undefined/NaN/-1/99 index each return the default without throwing', () => {
    expect(() => resolveProjectileAppearance(undefined, undefined)).not.toThrow();
    expect(resolveProjectileAppearance(undefined, 0)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(resolveProjectileAppearance(PlayerClass.SOULDRINKER, undefined)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(resolveProjectileAppearance(PlayerClass.SOULDRINKER, NaN)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(resolveProjectileAppearance(PlayerClass.SOULDRINKER, -1)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
    expect(resolveProjectileAppearance(PlayerClass.SOULDRINKER, 99)).toBe(DEFAULT_PROJECTILE_APPEARANCE);
  });
});

describe('resolveZoneVisual', () => {
  it('Souldrinker pull and Stormcaller damage zones return distinct entries', () => {
    const pull = resolveZoneVisual(zone({ effectType: 'pull', ownerId: 'a' }), [player({ id: 'a', class: PlayerClass.SOULDRINKER })]);
    const damage = resolveZoneVisual(zone({ effectType: 'damage', ownerId: 'b' }), [player({ id: 'b', class: PlayerClass.STORMCALLER })]);
    expect(pull).toBe(VOID_PULSE_ZONE_VISUAL);
    expect(damage).toBe(STORM_EYE_ZONE_VISUAL);
    expect(pull).not.toEqual(damage);
  });

  it('owner-disconnected path (owner not found) lands on the effectType-only tier, distinct per effectType and never the exact-identity visual', () => {
    const pullNoOwner = resolveZoneVisual(zone({ effectType: 'pull', ownerId: 'gone' }), []);
    const damageNoOwner = resolveZoneVisual(zone({ effectType: 'damage', ownerId: 'gone' }), []);
    expect(pullNoOwner).not.toBe(VOID_PULSE_ZONE_VISUAL);
    expect(damageNoOwner).not.toBe(STORM_EYE_ZONE_VISUAL);
    expect(pullNoOwner).not.toEqual(damageNoOwner);
  });

  it('owner present but wrong class also falls to the effectType-only tier, not the global default', () => {
    const wrongClassOwner = resolveZoneVisual(
      zone({ effectType: 'damage', ownerId: 'a' }),
      [player({ id: 'a', class: PlayerClass.SOULDRINKER })],
    );
    expect(wrongClassOwner.fillColor).toBe(STORM_EYE_ZONE_VISUAL.fillColor);
    expect(wrongClassOwner).not.toBe(STORM_EYE_ZONE_VISUAL);
  });

  it('never throws on an empty player list or a missing owner', () => {
    expect(() => resolveZoneVisual(zone({ ownerId: 'nobody' }), [])).not.toThrow();
  });
});

describe('table sanity — every visual is renderable', () => {
  const allProjectiles = [
    DEFAULT_PROJECTILE_APPEARANCE,
    ...Object.values(PROJECTILE_APPEARANCE).flatMap(table => table ?? []),
  ].filter((v): v is NonNullable<typeof v> => v !== null);

  it('every projectile appearance has finite numeric colors and 0..1 alphas', () => {
    for (const v of allProjectiles) {
      for (const layer of [v.core, v.halo].filter(Boolean) as { color: number; alpha: number }[]) {
        expect(Number.isFinite(layer.color)).toBe(true);
        expect(layer.color).toBeGreaterThanOrEqual(0x000000);
        expect(layer.color).toBeLessThanOrEqual(0xffffff);
        expect(layer.alpha).toBeGreaterThanOrEqual(0);
        expect(layer.alpha).toBeLessThanOrEqual(1);
      }
      expect(Number.isFinite(v.trail.color)).toBe(true);
      expect(v.trail.alpha).toBeGreaterThanOrEqual(0);
      expect(v.trail.alpha).toBeLessThanOrEqual(1);
    }
  });

  const allZones = [
    STORM_EYE_ZONE_VISUAL,
    VOID_PULSE_ZONE_VISUAL,
    resolveZoneVisual(zone({ effectType: 'pull', ownerId: 'nobody' }), []),
    resolveZoneVisual(zone({ effectType: 'damage', ownerId: 'nobody' }), []),
    // An unrecognized effectType (future-proofing tier) — ZoneEffectType is
    // exactly 'pull' | 'damage' today, so this can only be reached via a cast.
    resolveZoneVisual(zone({ effectType: 'unknown-future-type' as ZoneState['effectType'] }), []),
  ];

  it('every zone visual has finite numeric colors and 0..1 alphas', () => {
    for (const v of allZones) {
      expect(Number.isFinite(v.fillColor)).toBe(true);
      expect(v.fillAlpha).toBeGreaterThanOrEqual(0);
      expect(v.fillAlpha).toBeLessThanOrEqual(1);
      if (v.rimColor !== undefined) expect(Number.isFinite(v.rimColor)).toBe(true);
      if (v.rimAlpha !== undefined) {
        expect(v.rimAlpha).toBeGreaterThanOrEqual(0);
        expect(v.rimAlpha).toBeLessThanOrEqual(1);
      }
      if (v.spawnRing) {
        expect(Number.isFinite(v.spawnRing.color)).toBe(true);
        expect(v.spawnRing.alpha).toBeGreaterThanOrEqual(0);
        expect(v.spawnRing.alpha).toBeLessThanOrEqual(1);
        expect(v.spawnRing.lineWidth).toBeGreaterThan(0);
        expect(v.spawnRing.durationMs).toBeGreaterThan(0);
      }
    }
  });
});

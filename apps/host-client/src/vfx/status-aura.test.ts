import { describe, expect, it } from 'vitest';
import type { StatusEffectType } from 'shared-types';
import {
  statusAuraSpec,
  slowOrbitPoint,
  AURA_COLORS,
  AURA_EXPIRY_FADE_MS,
  SHIELD_REFERENCE_HP,
  SLOW_ORBIT_PERIOD_MS,
} from './status-aura';

// Pure mapping only — no canvas, no Application. Rendering correctness (shape
// legibility, layering, reconnect/down-spirit behavior) is the Client-UX
// manual pass (story Task 7). One runnable check per project convention.

const ENEMY_RADIUS = 20;
const PLAYER_RADIUS = 24;
const ALL_TYPES: StatusEffectType[] = ['damageReduction', 'slow', 'damageBuff', 'shield'];

describe('statusAuraSpec — colours', () => {
  it('all four colours are pairwise distinct', () => {
    const colors = ALL_TYPES.map(t => AURA_COLORS[t]);
    expect(new Set(colors).size).toBe(4);
  });

  it('all four colours are disjoint from every other canvas colour in play', () => {
    // SESSION_COLOR_HEX (DungeonScreen.tsx) + enemy red + zone purple +
    // essence/YELLOW gold + accent-purify + accent-spirit.
    const otherColors = new Set([
      0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0xff69b4, 0x1abc9c, // SESSION_COLOR_HEX
      0xe74c3c, // enemy red
      0x9b59b6, // zone purple
      0xf1c40f, // essence / SessionColor.YELLOW gold
      0x90d8f0, // accent-purify
      0x6ea8d8, // accent-spirit
    ]);
    for (const type of ALL_TYPES) {
      expect(otherColors.has(AURA_COLORS[type]), `${type} color ${AURA_COLORS[type].toString(16)} collides`).toBe(false);
    }
  });

  it('each type identifies itself correctly (the AC1 "shape-distinct per type" contract)', () => {
    // damageReduction and shield both compose from createRingShockwave (Dev
    // Notes' per-effect visual spec table names the same primitive for both),
    // so `kind` alone is shared between them by design — AC1's distinctness
    // comes from filled-vs-stroked + radius + colour, not a 4th primitive.
    // `type`, which is what actually keys the aura map, is distinct for all four.
    const types = ALL_TYPES.map(t => statusAuraSpec(t, ENEMY_RADIUS, 0.5, 1000).type);
    expect(new Set(types).size).toBe(4);
    const kinds = ALL_TYPES.map(t => statusAuraSpec(t, ENEMY_RADIUS, 0.5, 1000).kind);
    expect(new Set(kinds)).toEqual(new Set(['ring', 'burst', 'trail']));
  });
});

describe('statusAuraSpec — slot radius (AC2)', () => {
  it('is a pure function of (type, entityRadius), independent of what else is active', () => {
    // magnitude/msRemaining vary; radius must not.
    const a = statusAuraSpec('slow', PLAYER_RADIUS, 0.1, 100).radius;
    const b = statusAuraSpec('slow', PLAYER_RADIUS, 0.9, 5000).radius;
    expect(a).toBe(b);
  });

  it('the minimum slot radius at ENEMY_RADIUS clears the enemy health bar (>= 38)', () => {
    const radii = ALL_TYPES.map(t => statusAuraSpec(t, ENEMY_RADIUS, 0.5, 1000).radius);
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(38);
  });

  it('matches the documented fixed radii for player (r=24) and enemy (r=20)', () => {
    expect(statusAuraSpec('shield', ENEMY_RADIUS, 30, 1000).radius).toBe(38);
    expect(statusAuraSpec('damageReduction', ENEMY_RADIUS, 0.3, 1000).radius).toBe(49);
    expect(statusAuraSpec('damageBuff', ENEMY_RADIUS, 0.25, 1000).radius).toBe(60);
    expect(statusAuraSpec('slow', ENEMY_RADIUS, 0.4, 1000).radius).toBe(71);
    expect(statusAuraSpec('shield', PLAYER_RADIUS, 30, 1000).radius).toBe(42);
    expect(statusAuraSpec('slow', PLAYER_RADIUS, 0.4, 1000).radius).toBe(75);
  });
});

describe('statusAuraSpec — magnitude scaling', () => {
  it('damageReduction: lineWidth at magnitude 0.3 is smaller than at 1.0', () => {
    const low = statusAuraSpec('damageReduction', ENEMY_RADIUS, 0.3, 1000);
    const high = statusAuraSpec('damageReduction', ENEMY_RADIUS, 1.0, 1000);
    expect(low.kind).toBe('ring');
    expect(high.kind).toBe('ring');
    if (low.kind === 'ring' && high.kind === 'ring') {
      expect(low.lineWidth).toBeLessThan(high.lineWidth);
    }
  });

  it('shield: alpha at magnitude 30 (the reference) is not exceeded at magnitude 60', () => {
    const reference = statusAuraSpec('shield', ENEMY_RADIUS, SHIELD_REFERENCE_HP, 1000);
    const doubled = statusAuraSpec('shield', ENEMY_RADIUS, SHIELD_REFERENCE_HP * 2, 1000);
    expect(doubled.alpha).toBeCloseTo(reference.alpha, 10);
    expect(doubled.alpha).toBeLessThanOrEqual(reference.alpha + 1e-9);
  });
});

describe('statusAuraSpec — expiry fade', () => {
  it('msRemaining >= AURA_EXPIRY_FADE_MS yields full (unfaded) alpha', () => {
    const full = statusAuraSpec('damageReduction', ENEMY_RADIUS, 1, AURA_EXPIRY_FADE_MS);
    const evenMore = statusAuraSpec('damageReduction', ENEMY_RADIUS, 1, AURA_EXPIRY_FADE_MS * 10);
    expect(full.alpha).toBeCloseTo(evenMore.alpha, 10);
  });

  it('msRemaining === 0 fades to ~0 alpha', () => {
    const spec = statusAuraSpec('damageReduction', ENEMY_RADIUS, 1, 0);
    expect(spec.alpha).toBeCloseTo(0, 10);
  });

  it('negative or NaN msRemaining clamps to 0 alpha, never NaN', () => {
    const negative = statusAuraSpec('shield', ENEMY_RADIUS, 30, -500);
    const nan = statusAuraSpec('slow', ENEMY_RADIUS, 0.4, NaN);
    expect(negative.alpha).toBe(0);
    expect(Number.isNaN(nan.alpha)).toBe(false);
    expect(nan.alpha).toBe(0);
  });
});

describe('slowOrbitPoint', () => {
  it('stays on the circle (distance from centre ≈ radius) for any phase/time', () => {
    const radius = 71;
    for (const t of [0, 137, 700, 1399, 5000]) {
      const p = slowOrbitPoint(100, 200, radius, 1.23, t);
      const dist = Math.hypot(p.x - 100, p.y - 200);
      expect(dist).toBeCloseTo(radius, 6);
    }
  });

  it('completes exactly one revolution per SLOW_ORBIT_PERIOD_MS', () => {
    const p0 = slowOrbitPoint(0, 0, 50, 0, 0);
    const pFull = slowOrbitPoint(0, 0, 50, 0, SLOW_ORBIT_PERIOD_MS);
    expect(pFull.x).toBeCloseTo(p0.x, 6);
    expect(pFull.y).toBeCloseTo(p0.y, 6);
  });
});

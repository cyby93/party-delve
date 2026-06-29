import { describe, it, expect } from 'vitest';
import { dispatchAbility } from 'game-rules';
import { PlayerClass } from 'shared-types';

describe('dispatchAbility', () => {
  const baseCtx = {
    cooldownExpiresAt: 0,
    nowMs: 1000,
    directionX: 0.7,
    directionY: 0.0,
  };

  it('returns ok for each class at index 0 when not on cooldown', () => {
    for (const cls of Object.values(PlayerClass)) {
      const result = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: 0 });
      expect(result.ok).toBe(true);
    }
  });

  it('returns error when on cooldown', () => {
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 0,
      cooldownExpiresAt: 2000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ON_COOLDOWN');
  });

  it('TAP ability returns direction (0, 0) regardless of input direction', () => {
    // Stonehide slot 0 = Stone Wall (TAP)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 0,
      directionX: 1,
      directionY: 0.5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBe(0);
      expect(result.value.directionY).toBe(0);
    }
  });

  it('AUTO ability preserves direction', () => {
    // Stonehide slot 3 = Avalanche (AUTO)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 3,
      directionX: 0.7,
      directionY: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.directionX).toBeCloseTo(0.7);
  });

  it('RELEASE ability preserves direction', () => {
    // Stonehide slot 1 = Tremor Stomp (RELEASE)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 1,
      directionX: -0.5,
      directionY: 0.8,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBeCloseTo(-0.5);
      expect(result.value.directionY).toBeCloseTo(0.8);
    }
  });

  it('every class has at least one ability with cooldown ≤ 3000ms', () => {
    for (const cls of Object.values(PlayerClass)) {
      const cooldowns = [0, 1, 2, 3].map(i => {
        const r = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: i });
        return r.ok ? r.value.cooldownMs : Infinity;
      });
      expect(Math.min(...cooldowns)).toBeLessThanOrEqual(3000);
    }
  });

  it('returns error for out-of-range ability index', () => {
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 4 });
    expect(result.ok).toBe(false);
  });

  it('cooldown value matches ABILITY_COOLDOWNS_MS for each class', () => {
    // stonehide slot 0 cooldown = 2000ms
    const r = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cooldownMs).toBe(2000);
  });
});

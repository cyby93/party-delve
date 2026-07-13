import { describe, it, expect } from 'vitest';
import { calculateSelfCostHp, calculateHpScaledDamage, healPlayer, calculateLifesteal } from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    displayName: 'Test',
    class: PlayerClass.SOULDRINKER,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
    statusEffects: [],
    ...overrides,
  };
}

describe('calculateSelfCostHp', () => {
  it('deducts the full cost when caster HP is well above the floor', () => {
    expect(calculateSelfCostHp(20, 100)).toBe(20);
  });

  it('caps the cost at casterHp - 1 (1-HP floor) instead of blocking the cast', () => {
    expect(calculateSelfCostHp(20, 10)).toBe(9);
  });

  it('deducts zero when caster HP is already 1', () => {
    expect(calculateSelfCostHp(20, 1)).toBe(0);
  });

  it('deducts zero for a zero-cost ability', () => {
    expect(calculateSelfCostHp(0, 100)).toBe(0);
  });
});

describe('calculateHpScaledDamage', () => {
  it('returns base damage unchanged when scaleCoef is 0', () => {
    expect(calculateHpScaledDamage(30, 0, 50, 100)).toBe(30);
  });

  it('increases damage as caster HP decreases', () => {
    const fullHp = calculateHpScaledDamage(30, 1, 100, 100);
    const halfHp = calculateHpScaledDamage(30, 1, 50, 100);
    const lowHp = calculateHpScaledDamage(30, 1, 10, 100);
    expect(halfHp).toBeGreaterThan(fullHp);
    expect(lowHp).toBeGreaterThan(halfHp);
  });

  it('applies no scaling at full HP', () => {
    expect(calculateHpScaledDamage(30, 1, 100, 100)).toBe(30);
  });
});

describe('healPlayer', () => {
  it('adds the heal amount to current HP', () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    expect(healPlayer(player, 20).hp).toBe(70);
  });

  it('caps healing at maxHp', () => {
    const player = makePlayer({ hp: 90, maxHp: 100 });
    expect(healPlayer(player, 50).hp).toBe(100);
  });

  it('never reduces HP for a negative amount', () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    expect(healPlayer(player, -10).hp).toBe(50);
  });
});

describe('calculateLifesteal', () => {
  it('computes a percentage of damage dealt', () => {
    expect(calculateLifesteal(40, 0.5)).toBe(20);
  });

  it('returns zero lifesteal for a miss (zero damage dealt)', () => {
    expect(calculateLifesteal(0, 0.5)).toBe(0);
  });
});

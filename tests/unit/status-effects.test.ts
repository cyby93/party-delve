import { describe, it, expect } from 'vitest';
import { applyStatusEffect, tickStatusEffects, applyDamage, applyPlayerDamage, getStatusEffectMagnitude } from 'game-rules';
import { EnemyType, DifficultyTier, EnemyFSMState, PlayerClass, SessionColor } from 'shared-types';
import type { EnemyState, PlayerState, StatusEffect } from 'shared-types';

function mockEnemy(overrides?: Partial<EnemyState>): EnemyState {
  return {
    id: 'e1',
    type: EnemyType.GRUNT,
    x: 500,
    y: 300,
    hp: 60,
    maxHp: 60,
    difficultyTier: DifficultyTier.EASY,
    isAlive: true,
    fsmState: EnemyFSMState.IDLE,
    attackCooldownTicks: 0,
    statusEffects: [],
    ...overrides,
  };
}

function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'p1',
    displayName: 'TestPlayer',
    class: PlayerClass.STONEHIDE,
    x: 500, y: 300,
    hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
    statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

describe('applyStatusEffect', () => {
  it('appends a new effect', () => {
    const effect: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 1000 };
    const result = applyStatusEffect(mockEnemy(), effect, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.statusEffects).toEqual([effect]);
    }
  });

  it('replaces (does not stack) an existing effect of the same type', () => {
    const first: StatusEffect = { type: 'slow', magnitude: 0.3, expiresAtMs: 1000 };
    const second: StatusEffect = { type: 'slow', magnitude: 0.6, expiresAtMs: 2000 };
    const enemy = mockEnemy({ statusEffects: [first] });
    const result = applyStatusEffect(enemy, second, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.statusEffects).toEqual([second]);
    }
  });

  it('preserves effects of a different type when adding a new one', () => {
    const damageReduction: StatusEffect = { type: 'damageReduction', magnitude: 0.2, expiresAtMs: 1000 };
    const slow: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 1000 };
    const enemy = mockEnemy({ statusEffects: [damageReduction] });
    const result = applyStatusEffect(enemy, slow, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.statusEffects).toEqual([damageReduction, slow]);
    }
  });

  it('returns an error when the effect is already expired', () => {
    const effect: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 500 };
    const result = applyStatusEffect(mockEnemy(), effect, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EFFECT_ALREADY_EXPIRED');
  });

  it('does not mutate the original target', () => {
    const enemy = mockEnemy();
    applyStatusEffect(enemy, { type: 'slow', magnitude: 0.5, expiresAtMs: 1000 }, 0);
    expect(enemy.statusEffects).toEqual([]);
  });

  it('rejects a fractional-type effect with magnitude > 1', () => {
    const result = applyStatusEffect(mockEnemy(), { type: 'slow', magnitude: 1.5, expiresAtMs: 1000 }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_MAGNITUDE');
  });

  it('rejects a fractional-type effect with negative magnitude', () => {
    const result = applyStatusEffect(mockEnemy(), { type: 'damageReduction', magnitude: -0.1, expiresAtMs: 1000 }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_MAGNITUDE');
  });

  it('accepts magnitude at the 0 and 1 boundaries for fractional types', () => {
    expect(applyStatusEffect(mockEnemy(), { type: 'slow', magnitude: 0, expiresAtMs: 1000 }, 0).ok).toBe(true);
    expect(applyStatusEffect(mockEnemy(), { type: 'slow', magnitude: 1, expiresAtMs: 1000 }, 0).ok).toBe(true);
  });

  it('does not bound-check shield magnitude (flat HP, not a fraction)', () => {
    const result = applyStatusEffect(mockEnemy(), { type: 'shield', magnitude: 50, expiresAtMs: 1000 }, 0);
    expect(result.ok).toBe(true);
  });
});

describe('tickStatusEffects', () => {
  it('removes effects whose expiresAtMs <= nowMs', () => {
    const expired: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 1000 };
    const active: StatusEffect = { type: 'damageReduction', magnitude: 0.3, expiresAtMs: 5000 };
    const enemy = mockEnemy({ statusEffects: [expired, active] });
    const result = tickStatusEffects(enemy, 1000);
    expect(result.statusEffects).toEqual([active]);
  });

  it('keeps effects that have not yet expired', () => {
    const active: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 5000 };
    const enemy = mockEnemy({ statusEffects: [active] });
    const result = tickStatusEffects(enemy, 1000);
    expect(result.statusEffects).toEqual([active]);
  });

  it('returns the same reference when there is nothing to expire', () => {
    const enemy = mockEnemy();
    expect(tickStatusEffects(enemy, 1000)).toBe(enemy);
  });

  it('returns the same reference when no active effects have expired yet', () => {
    const enemy = mockEnemy({ statusEffects: [{ type: 'slow', magnitude: 0.5, expiresAtMs: 5000 }] });
    expect(tickStatusEffects(enemy, 1000)).toBe(enemy);
  });

  it('does not mutate the original target', () => {
    const expired: StatusEffect = { type: 'slow', magnitude: 0.5, expiresAtMs: 1000 };
    const enemy = mockEnemy({ statusEffects: [expired] });
    tickStatusEffects(enemy, 2000);
    expect(enemy.statusEffects).toEqual([expired]);
  });
});

describe('damageReduction multiplier', () => {
  it('applyDamage reduces incoming damage by (1 - magnitude) when damageReduction is active', () => {
    const enemy = mockEnemy({ statusEffects: [{ type: 'damageReduction', magnitude: 0.5, expiresAtMs: 5000 }] });
    const result = applyDamage(enemy, 20, 'drop-1', 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.enemy.hp).toBe(50); // 60 - (20 * 0.5)
  });

  it('applyDamage ignores an expired damageReduction effect', () => {
    const enemy = mockEnemy({ statusEffects: [{ type: 'damageReduction', magnitude: 0.5, expiresAtMs: 500 }] });
    const result = applyDamage(enemy, 20, 'drop-1', 1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.enemy.hp).toBe(40); // full damage applied
  });

  it('applyDamage is unaffected by an empty statusEffects array', () => {
    const result = applyDamage(mockEnemy(), 20, 'drop-1', 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.enemy.hp).toBe(40);
  });

  it('applyPlayerDamage reduces incoming damage by (1 - magnitude) when damageReduction is active', () => {
    const player = mockPlayer({ statusEffects: [{ type: 'damageReduction', magnitude: 0.25, expiresAtMs: 5000 }] });
    const result = applyPlayerDamage(player, 40, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.player.hp).toBe(70); // 100 - (40 * 0.75)
  });

  it('applyPlayerDamage is unaffected by an empty statusEffects array', () => {
    const result = applyPlayerDamage(mockPlayer(), 15, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.player.hp).toBe(85);
  });
});

describe('slow multiplier (getStatusEffectMagnitude — the primitive fsm.ts and GameRoom.ts multiply movement by)', () => {
  it('returns the magnitude of an active slow effect', () => {
    const enemy = mockEnemy({ statusEffects: [{ type: 'slow', magnitude: 0.4, expiresAtMs: 5000 }] });
    expect(getStatusEffectMagnitude(enemy, 'slow', 0)).toBe(0.4);
  });

  it('returns 0 for an expired slow effect', () => {
    const enemy = mockEnemy({ statusEffects: [{ type: 'slow', magnitude: 0.4, expiresAtMs: 500 }] });
    expect(getStatusEffectMagnitude(enemy, 'slow', 1000)).toBe(0);
  });

  it('returns 0 when statusEffects is empty (movement unaffected by default)', () => {
    expect(getStatusEffectMagnitude(mockEnemy(), 'slow', 0)).toBe(0);
    expect(getStatusEffectMagnitude(mockPlayer(), 'slow', 0)).toBe(0);
  });

  it('a full-magnitude slow effect zeroes out movement speed', () => {
    const player = mockPlayer({ statusEffects: [{ type: 'slow', magnitude: 1, expiresAtMs: 5000 }] });
    const slowMagnitude = getStatusEffectMagnitude(player, 'slow', 0);
    expect(200 * (1 - slowMagnitude)).toBe(0);
  });
});

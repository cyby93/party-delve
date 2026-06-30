import { describe, it, expect } from 'vitest';
import { applyDamage, isInHitZone } from 'game-rules';
import { EnemyType, DifficultyTier, EnemyFSMState } from 'shared-types';
import type { EnemyState } from 'shared-types';

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
    ...overrides,
  };
}

describe('applyDamage', () => {
  it('reduces hp by damage amount', () => {
    const result = applyDamage(mockEnemy(), 20, 'drop-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(40);
      expect(result.value.killed).toBe(false);
      expect(result.value.essenceDrop).toBeUndefined();
    }
  });

  it('clamps hp to 0, sets killed=true, includes essenceDrop when damage >= hp', () => {
    const result = applyDamage(mockEnemy({ hp: 15 }), 100, 'drop-2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(0);
      expect(result.value.enemy.isAlive).toBe(false);
      expect(result.value.killed).toBe(true);
      expect(result.value.essenceDrop).toBeDefined();
      expect(result.value.essenceDrop?.id).toBe('drop-2');
    }
  });

  it('returns error for already-dead enemy', () => {
    const result = applyDamage(mockEnemy({ isAlive: false, hp: 0 }), 10, 'drop-3');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ENEMY_ALREADY_DEAD');
  });

  it('returns error for negative damage', () => {
    const result = applyDamage(mockEnemy(), -5, 'drop-4');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NEGATIVE_DAMAGE');
  });

  it('does not mutate the original enemy object', () => {
    const enemy = mockEnemy();
    applyDamage(enemy, 10, 'drop-5');
    expect(enemy.hp).toBe(60);
  });
});

describe('isInHitZone', () => {
  it('TAP (AoE): returns true when enemy is within hitRadius', () => {
    expect(isInHitZone(500, 300, 0, 1, 500, 380, 100, 0, false)).toBe(true);
  });

  it('TAP (AoE): returns false when enemy is beyond hitRadius', () => {
    expect(isInHitZone(500, 300, 0, 1, 500, 500, 100, 0, false)).toBe(false);
  });

  it('TAP ignores direction: hits enemy behind player too', () => {
    expect(isInHitZone(500, 300, 0, 1, 500, 220, 100, 0, false)).toBe(true);
  });

  it('Directional: returns true when enemy is in front of player within range+radius', () => {
    // direction=(1,0), range=200, radius=60 → hit center at (700,300); enemy at (700,300)
    expect(isInHitZone(500, 300, 1, 0, 700, 300, 60, 200, true)).toBe(true);
  });

  it('Directional: returns false when enemy is behind player', () => {
    // direction=(1,0), hit center at (700,300); enemy at (300,300) — behind player
    expect(isInHitZone(500, 300, 1, 0, 300, 300, 60, 200, true)).toBe(false);
  });

  it('Directional: returns false when enemy is past the hit circle', () => {
    // direction=(1,0), hit center at (700,300); enemy at (900,300) — too far
    expect(isInHitZone(500, 300, 1, 0, 900, 300, 60, 200, true)).toBe(false);
  });
});

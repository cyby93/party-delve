import { describe, it, expect } from 'vitest';
import { resolveProjectileHit, isProjectileExpired } from 'game-rules';
import { EnemyType, DifficultyTier, EnemyFSMState, PlayerClass } from 'shared-types';
import type { EnemyState, ProjectileState } from 'shared-types';

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

function mockProjectile(overrides?: Partial<ProjectileState>): ProjectileState {
  return {
    id: 'proj-1',
    ownerId: 'p1',
    x: 500,
    y: 300,
    class: PlayerClass.SOULDRINKER,
    abilityIndex: 3,
    ...overrides,
  };
}

describe('resolveProjectileHit', () => {
  it('applies damage to the enemy via combat.ts', () => {
    const result = resolveProjectileHit(mockProjectile(), mockEnemy(), 25, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.enemy.hp).toBe(35);
  });

  it('kills the enemy when damage exceeds hp', () => {
    const result = resolveProjectileHit(mockProjectile(), mockEnemy({ hp: 10 }), 25, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(0);
      expect(result.value.enemy.isAlive).toBe(false);
    }
  });

  it('surfaces an essenceDrop when the hit kills the enemy', () => {
    const result = resolveProjectileHit(mockProjectile({ id: 'proj-9' }), mockEnemy({ hp: 10 }), 25, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.essenceDrop).toBeDefined();
      expect(result.value.essenceDrop?.id).toBe('drop-proj-9');
    }
  });

  it('omits essenceDrop when the enemy survives', () => {
    const result = resolveProjectileHit(mockProjectile(), mockEnemy(), 25, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.essenceDrop).toBeUndefined();
  });

  it('returns error for an already-dead enemy', () => {
    const result = resolveProjectileHit(mockProjectile(), mockEnemy({ isAlive: false, hp: 0 }), 25, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ENEMY_ALREADY_DEAD');
  });

  it('does not mutate the original enemy object', () => {
    const enemy = mockEnemy();
    resolveProjectileHit(mockProjectile(), enemy, 25, 0);
    expect(enemy.hp).toBe(60);
  });
});

describe('isProjectileExpired', () => {
  it('returns false when travel distance is under max range', () => {
    expect(isProjectileExpired({ x: 550, y: 300 }, 500, 300, 800)).toBe(false);
  });

  it('returns true when travel distance meets max range', () => {
    expect(isProjectileExpired({ x: 1300, y: 300 }, 500, 300, 800)).toBe(true);
  });

  it('returns true when travel distance exceeds max range', () => {
    expect(isProjectileExpired({ x: 1500, y: 300 }, 500, 300, 800)).toBe(true);
  });

  it('is frame-rate independent — pure function of position, not tick count', () => {
    const spawnX = 0, spawnY = 0, maxRangePx = 100;
    // Same position reached via different "paths" (irrelevant to this pure check) yields the same result
    expect(isProjectileExpired({ x: 100, y: 0 }, spawnX, spawnY, maxRangePx)).toBe(true);
    expect(isProjectileExpired({ x: 99, y: 0 }, spawnX, spawnY, maxRangePx)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  resolveProjectileHit,
  isProjectileExpired,
  isInHitZone,
  ABILITY_GEOMETRY,
  TEMPEST_HURL_PROJECTILE_RADIUS_PX,
  TEMPEST_HURL_SPEED_PX_S,
  TEMPEST_HURL_BLAST_RADIUS_PX,
} from 'game-rules';
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

describe('Tempest Hurl projectile spawn parameters (AC4, Story 3.26)', () => {
  it('is a projectile-delivery ability', () => {
    expect(ABILITY_GEOMETRY[PlayerClass.STORMCALLER][1].delivery).toBe('projectile');
  });

  it('has a bigger, slower body than the shared projectile defaults', () => {
    expect(TEMPEST_HURL_PROJECTILE_RADIUS_PX).toBe(28);
    expect(TEMPEST_HURL_SPEED_PX_S).toBe(300);
  });

  it('derives its blast radius from the projectile radius, not a separately-tuned literal (AC5)', () => {
    expect(TEMPEST_HURL_BLAST_RADIUS_PX).toBe(TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2);
  });
});

describe('Tempest Hurl blast resolution (AC5, Story 3.26)', () => {
  it('hits every living enemy within the blast radius of the impact point, not just the contacted one', () => {
    const impactX = 500, impactY = 300;
    const enemies = [
      mockEnemy({ id: 'contacted', x: 500, y: 300 }),
      mockEnemy({ id: 'nearby', x: 520, y: 300 }), // 20px away — within a 56px blast
      mockEnemy({ id: 'far', x: 700, y: 300 }),    // 200px away — outside the blast
    ];
    const inBlast = enemies.filter(e =>
      isInHitZone(impactX, impactY, 0, 0, e.x, e.y, TEMPEST_HURL_BLAST_RADIUS_PX, 0, false));
    expect(inBlast.map(e => e.id)).toEqual(['contacted', 'nearby']);
  });

  it('the boss counts as a blast target via the same non-directional circle test (manual proximity check, since the boss never fires a contact event)', () => {
    const impactX = 500, impactY = 300;
    const bossPos = { x: 530, y: 300 }; // 30px from impact — within the 56px blast
    expect(isInHitZone(impactX, impactY, 0, 0, bossPos.x, bossPos.y, TEMPEST_HURL_BLAST_RADIUS_PX, 0, false)).toBe(true);
  });

  it('excludes a boss position outside the blast radius', () => {
    const impactX = 500, impactY = 300;
    const bossPos = { x: 700, y: 300 }; // 200px away — outside the blast
    expect(isInHitZone(impactX, impactY, 0, 0, bossPos.x, bossPos.y, TEMPEST_HURL_BLAST_RADIUS_PX, 0, false)).toBe(false);
  });
});

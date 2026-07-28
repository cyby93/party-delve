import { describe, it, expect } from 'vitest';
import { applyDamage, isInHitZone, isInConeZone } from 'game-rules';
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
    statusEffects: [],
    ...overrides,
  };
}

describe('applyDamage', () => {
  it('reduces hp by damage amount', () => {
    const result = applyDamage(mockEnemy(), 20, 'drop-1', 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(40);
      expect(result.value.killed).toBe(false);
      expect(result.value.essenceDrop).toBeUndefined();
    }
  });

  it('clamps hp to 0, sets killed=true, includes essenceDrop when damage >= hp', () => {
    const result = applyDamage(mockEnemy({ hp: 15 }), 100, 'drop-2', 0);
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
    const result = applyDamage(mockEnemy({ isAlive: false, hp: 0 }), 10, 'drop-3', 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ENEMY_ALREADY_DEAD');
  });

  it('returns error for negative damage', () => {
    const result = applyDamage(mockEnemy(), -5, 'drop-4', 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NEGATIVE_DAMAGE');
  });

  it('does not mutate the original enemy object', () => {
    const enemy = mockEnemy();
    applyDamage(enemy, 10, 'drop-5', 0);
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

// Story 3.25 (ADR-0005): apex at caster, aimed along (dirX, dirY), length =
// rangePx, half-angle = half of coneAngleDeg. Caster (500,300), dir=(1,0),
// range=200, full cone angle=60° (half=30°) unless noted.
describe('isInConeZone', () => {
  it('inside near the apex (short distance, dead ahead)', () => {
    expect(isInConeZone(500, 300, 1, 0, 520, 300, 200, 60)).toBe(true);
  });

  it('inside near max length (angle well within the half-angle)', () => {
    // dist=190, angle=20° < half-angle 30°
    const x = 500 + 190 * Math.cos((20 * Math.PI) / 180);
    const y = 300 + 190 * Math.sin((20 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, x, y, 200, 60)).toBe(true);
  });

  it('outside by distance (dead ahead, past range)', () => {
    expect(isInConeZone(500, 300, 1, 0, 750, 300, 200, 60)).toBe(false);
  });

  it('outside by angle (within range, angle beyond the half-angle)', () => {
    // dist=100, angle=45° > half-angle 30°
    const x = 500 + 100 * Math.cos((45 * Math.PI) / 180);
    const y = 300 + 100 * Math.sin((45 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, x, y, 200, 60)).toBe(false);
  });

  it('exactly at the angle boundary counts as inside (<=, not <)', () => {
    // dist=100 (well within range), angle exactly 30° == half-angle
    const half = (30 * Math.PI) / 180;
    const x = 500 + 100 * Math.cos(half);
    const y = 300 + 100 * Math.sin(half);
    expect(isInConeZone(500, 300, 1, 0, x, y, 200, 60)).toBe(true);
  });

  it('exactly at max length counts as inside (<=, not <)', () => {
    expect(isInConeZone(500, 300, 1, 0, 700, 300, 200, 60)).toBe(true);
  });

  it('target at caster\'s own position (distance=0) is trivially inside (apex edge case)', () => {
    expect(isInConeZone(500, 300, 1, 0, 500, 300, 200, 60)).toBe(true);
  });

  it('non-axis-aligned direction (0,1): target ahead along that axis is inside', () => {
    expect(isInConeZone(500, 300, 0, 1, 500, 380, 200, 60)).toBe(true);
  });

  it('non-axis-aligned direction (0,1): target directly behind (opposite aim) is outside', () => {
    expect(isInConeZone(500, 300, 0, 1, 500, 220, 200, 60)).toBe(false);
  });

  it('diagonal direction: target along the same diagonal is inside', () => {
    const s = Math.SQRT1_2;
    expect(isInConeZone(500, 300, s, s, 500 + 100 * s, 300 + 100 * s, 200, 60)).toBe(true);
  });

  it('diagonal direction: target directly behind (opposite diagonal) is outside', () => {
    const s = Math.SQRT1_2;
    expect(isInConeZone(500, 300, s, s, 500 - 100 * s, 300 - 100 * s, 200, 60)).toBe(false);
  });
});

// Story 3.25: each converted ability's real ABILITY_CONE_ANGLE_DEG/ABILITY_HIT_RANGE_PX
// values, exercised directly through isInConeZone (no live GameRoom needed).
describe('isInConeZone — real ability values', () => {
  it('Stone Wall (stonehide[0]): range=160, angle=50° — inside and outside', () => {
    const inside = 500 + 150 * Math.cos((20 * Math.PI) / 180);
    const insideY = 300 + 150 * Math.sin((20 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, inside, insideY, 160, 50)).toBe(true);

    const outsideAngle = 500 + 150 * Math.cos((30 * Math.PI) / 180);
    const outsideAngleY = 300 + 150 * Math.sin((30 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, outsideAngle, outsideAngleY, 160, 50)).toBe(false);

    expect(isInConeZone(500, 300, 1, 0, 700, 300, 160, 50)).toBe(false); // dist=200 > range 160
  });

  it("Avalanche (stonehide[3]): range=75, angle=40° — inside and outside", () => {
    const inside = 500 + 50 * Math.cos((10 * Math.PI) / 180);
    const insideY = 300 + 50 * Math.sin((10 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, inside, insideY, 75, 40)).toBe(true);

    const outsideAngle = 500 + 50 * Math.cos((25 * Math.PI) / 180);
    const outsideAngleY = 300 + 50 * Math.sin((25 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, outsideAngle, outsideAngleY, 75, 40)).toBe(false);
  });

  it("Ancestor's Voice (spiritcaller[0]): range=100, angle=70° — inside and outside", () => {
    const inside = 500 + 80 * Math.cos((30 * Math.PI) / 180);
    const insideY = 300 + 80 * Math.sin((30 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, inside, insideY, 100, 70)).toBe(true);

    const outsideAngle = 500 + 80 * Math.cos((40 * Math.PI) / 180);
    const outsideAngleY = 300 + 80 * Math.sin((40 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, outsideAngle, outsideAngleY, 100, 70)).toBe(false);
  });

  it('Crimson Lash (souldrinker[1]): range=180, angle=45° — inside and outside', () => {
    const inside = 500 + 150 * Math.cos((15 * Math.PI) / 180);
    const insideY = 300 + 150 * Math.sin((15 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, inside, insideY, 180, 45)).toBe(true);

    const outsideAngle = 500 + 150 * Math.cos((30 * Math.PI) / 180);
    const outsideAngleY = 300 + 150 * Math.sin((30 * Math.PI) / 180);
    expect(isInConeZone(500, 300, 1, 0, outsideAngle, outsideAngleY, 180, 45)).toBe(false);
  });
});

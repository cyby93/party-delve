import { describe, it, expect } from 'vitest';
import { resolveMixedFactionTargets, resolveExpandingRadius } from 'game-rules';
import { PlayerClass, SessionColor, EnemyType, DifficultyTier, EnemyFSMState } from 'shared-types';
import type { PlayerState, EnemyState } from 'shared-types';

function makePlayer(id: string): PlayerState {
  return {
    id,
    displayName: id,
    class: PlayerClass.SPIRITCALLER,
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
    channelingAbility: null,
  };
}

function makeEnemy(id: string): EnemyState {
  return {
    id,
    type: EnemyType.GRUNT,
    x: 0,
    y: 0,
    hp: 50,
    maxHp: 50,
    difficultyTier: DifficultyTier.NORMAL,
    isAlive: true,
    fsmState: EnemyFSMState.IDLE,
    attackCooldownTicks: 0,
    statusEffects: [],
  };
}

describe('resolveMixedFactionTargets', () => {
  it('splits a mixed target list into allies and enemies', () => {
    const caster = makePlayer('caster');
    const ally = makePlayer('ally');
    const enemy = makeEnemy('enemy-1');

    const { allies, enemies } = resolveMixedFactionTargets(caster.id, [caster, ally, enemy]);

    expect(allies).toEqual([ally]);
    expect(enemies).toEqual([enemy]);
  });

  it('excludes the caster from their own AoE allies list', () => {
    const caster = makePlayer('caster');
    const { allies } = resolveMixedFactionTargets(caster.id, [caster]);
    expect(allies).toEqual([]);
  });

  it('returns empty arrays for an empty target list', () => {
    const { allies, enemies } = resolveMixedFactionTargets('caster', []);
    expect(allies).toEqual([]);
    expect(enemies).toEqual([]);
  });

  it('handles an all-enemy target list with no allies', () => {
    const enemies = [makeEnemy('e1'), makeEnemy('e2')];
    const result = resolveMixedFactionTargets('caster', enemies);
    expect(result.allies).toEqual([]);
    expect(result.enemies).toEqual(enemies);
  });
});

describe('resolveExpandingRadius (Story 3.17: Spirit Nova)', () => {
  it('is 0 at elapsedMs=0', () => {
    expect(resolveExpandingRadius(0, 600, 220)).toBe(0);
  });

  it('grows linearly with elapsed time', () => {
    expect(resolveExpandingRadius(300, 600, 220)).toBeCloseTo(110);
  });

  it('caps at maxRadiusPx once elapsedMs reaches durationMs', () => {
    expect(resolveExpandingRadius(600, 600, 220)).toBe(220);
    expect(resolveExpandingRadius(900, 600, 220)).toBe(220); // past duration — still capped, not extrapolated
  });

  it('clamps negative elapsedMs to 0 radius', () => {
    expect(resolveExpandingRadius(-100, 600, 220)).toBe(0);
  });

  it('hit-once-per-target guard: a target already recorded in hitIds is excluded even once the growing radius reaches it', () => {
    // Simulates GameRoom.ts's stateful sweep bookkeeping (hitIds Set) using synthetic
    // targets and resolveExpandingRadius's pure output — the bookkeeping itself is
    // GameRoom-local, not part of this pure helper, but this proves the combination
    // behaves correctly independent of any real ability wiring.
    const targets = [{ id: 't1', distance: 50 }, { id: 't2', distance: 150 }];
    const hitIds = new Set<string>();
    const durationMs = 600;
    const maxRadiusPx = 220;

    function sweepTick(elapsedMs: number): string[] {
      const radius = resolveExpandingRadius(elapsedMs, durationMs, maxRadiusPx);
      const newlyHit = targets.filter(t => !hitIds.has(t.id) && t.distance <= radius);
      for (const t of newlyHit) hitIds.add(t.id);
      return newlyHit.map(t => t.id);
    }

    expect(sweepTick(100)).toEqual([]); // radius ~36.7px — neither target in range yet
    expect(sweepTick(200)).toEqual(['t1']); // radius ~73.3px — only t1 (50px) now in range
    expect(sweepTick(600)).toEqual(['t2']); // radius 220px — t2 now in range, t1 NOT re-hit
    expect(hitIds).toEqual(new Set(['t1', 't2']));
  });
});

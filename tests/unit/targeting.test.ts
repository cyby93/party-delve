import { describe, it, expect } from 'vitest';
import { resolveMixedFactionTargets } from 'game-rules';
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

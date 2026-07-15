import type { EnemyState, EssenceDrop } from 'shared-types';
import type { Result } from '../state/result.js';
import { ESSENCE_DROP_AMOUNT } from '../balance.js';
import { getStatusEffectMagnitude } from './status-effects.js';

export interface DamageResult {
  enemy: EnemyState;
  killed: boolean;
  essenceDrop?: EssenceDrop;
}

export type CombatError = { code: string; detail?: string };

// Pure — no planck, no Colyseus, no I/O.
export function applyDamage(
  enemy: EnemyState,
  damage: number,
  dropId: string,
  nowMs: number,
): Result<DamageResult, CombatError> {
  if (!enemy.isAlive) return { ok: false, error: { code: 'ENEMY_ALREADY_DEAD' } };
  if (damage < 0) return { ok: false, error: { code: 'NEGATIVE_DAMAGE', detail: String(damage) } };

  const damageReduction = getStatusEffectMagnitude(enemy, 'damageReduction', nowMs);
  const mitigatedDamage = damage * (1 - damageReduction);
  const newHp = Math.max(0, enemy.hp - mitigatedDamage);
  const killed = newHp === 0;
  const updatedEnemy: EnemyState = { ...enemy, hp: newHp, isAlive: !killed };

  const base = { enemy: updatedEnemy, killed };
  return {
    ok: true,
    value: killed
      ? { ...base, essenceDrop: { id: dropId, x: enemy.x, y: enemy.y, amount: ESSENCE_DROP_AMOUNT } }
      : base,
  };
}

// Pure spatial hit-zone check — no physics, no I/O.
// Directional: hit circle at (player + direction * hitRangePx), radius = hitRadiusPx
// TAP (non-directional): hit circle at player position, radius = hitRadiusPx
export function isInHitZone(
  playerX: number,
  playerY: number,
  dirX: number,
  dirY: number,
  enemyX: number,
  enemyY: number,
  hitRadiusPx: number,
  hitRangePx: number,
  isDirectional: boolean,
): boolean {
  if (isDirectional) {
    const cx = playerX + dirX * hitRangePx;
    const cy = playerY + dirY * hitRangePx;
    const dx = enemyX - cx;
    const dy = enemyY - cy;
    return dx * dx + dy * dy <= hitRadiusPx * hitRadiusPx;
  }
  const dx = enemyX - playerX;
  const dy = enemyY - playerY;
  return dx * dx + dy * dy <= hitRadiusPx * hitRadiusPx;
}

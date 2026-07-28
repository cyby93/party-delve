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

// Pure spatial cone check — no physics, no I/O. Sibling to isInHitZone; isInHitZone
// stays unchanged for every circle ability (TAP/self/proximity/zone).
// Apex at (casterX, casterY), aimed along (dirX, dirY) — dirX/dirY MUST already be
// a unit vector (every call site normalizes before calling, same precondition
// isInHitZone's directional branch relies on).
// Boundary inclusivity matches isInHitZone: <= on both the range and the angle
// check, so a target exactly at max length or exactly on the cone's edge counts
// as a hit. A target exactly at the caster's own position (distance = 0) has an
// undefined direction angle (0/0) — treated as trivially inside the cone (apex
// edge case) rather than dividing by zero or returning false.
export function isInConeZone(
  casterX: number,
  casterY: number,
  dirX: number,
  dirY: number,
  targetX: number,
  targetY: number,
  rangePx: number,
  coneAngleDeg: number,
): boolean {
  const dx = targetX - casterX;
  const dy = targetY - casterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > rangePx) return false;
  if (dist === 0) return true;

  const cosHalfAngle = Math.cos((coneAngleDeg / 2) * (Math.PI / 180));
  const dot = (dx / dist) * dirX + (dy / dist) * dirY;
  return dot >= cosHalfAngle;
}

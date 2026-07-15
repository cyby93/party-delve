import type { ProjectileState, EnemyState, EssenceDrop } from 'shared-types';
import type { Result } from '../state/result.js';
import { applyDamage } from './combat.js';

export type ProjectileError = { code: string; detail?: string };

// Pure — no planck, no Colyseus, no I/O. Surfaces essenceDrop (when the hit kills the
// enemy) so callers can drop essence on projectile kills, same as every other kill path.
export function resolveProjectileHit(
  projectile: ProjectileState,
  enemy: EnemyState,
  damage: number,
  nowMs: number,
): Result<{ enemy: EnemyState; essenceDrop?: EssenceDrop }, ProjectileError> {
  const dmgResult = applyDamage(enemy, damage, `drop-${projectile.id}`, nowMs);
  if (!dmgResult.ok) return { ok: false, error: dmgResult.error };
  const { enemy: updatedEnemy, essenceDrop } = dmgResult.value;
  return { ok: true, value: essenceDrop ? { enemy: updatedEnemy, essenceDrop } : { enemy: updatedEnemy } };
}

// Pure spatial check — no lifetime-tick counter needed since travel distance is
// a pure function of spawn position vs. the projectile's current (already-stepped) position.
export function isProjectileExpired(
  projectile: Pick<ProjectileState, 'x' | 'y'>,
  spawnX: number,
  spawnY: number,
  maxRangePx: number,
): boolean {
  const dx = projectile.x - spawnX;
  const dy = projectile.y - spawnY;
  return dx * dx + dy * dy >= maxRangePx * maxRangePx;
}

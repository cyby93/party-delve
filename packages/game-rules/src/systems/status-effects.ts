import type { PlayerState, EnemyState, StatusEffect } from 'shared-types';
import type { Result } from '../state/result.js';

export type StatusEffectTarget = PlayerState | EnemyState;
export type StatusEffectError = { code: string; detail?: string };

// Pure — no planck, no Colyseus, no I/O.
export function applyStatusEffect(
  target: StatusEffectTarget,
  effect: StatusEffect,
  nowMs: number,
): Result<{ target: StatusEffectTarget }, StatusEffectError> {
  if (effect.expiresAtMs <= nowMs) {
    return { ok: false, error: { code: 'EFFECT_ALREADY_EXPIRED', detail: String(effect.expiresAtMs) } };
  }
  // damageReduction/slow/damageBuff are 0-1 fractions (see StatusEffect's own type comment) —
  // out-of-range values invert their multiplier math at the read sites (combat.ts, player-health.ts,
  // fsm.ts, GameRoom.ts all compute `* (1 - magnitude)`), turning damage into healing or movement
  // into reverse. shield's magnitude is flat HP, not a fraction, so it's exempt from the
  // upper bound — but never negative, like every other effect type.
  if (effect.magnitude < 0 || (effect.type !== 'shield' && effect.magnitude > 1)) {
    return { ok: false, error: { code: 'INVALID_MAGNITUDE', detail: String(effect.magnitude) } };
  }

  const statusEffects = [
    ...target.statusEffects.filter(e => e.type !== effect.type),
    effect,
  ];
  return { ok: true, value: { target: { ...target, statusEffects } } };
}

// Pure — no planck, no Colyseus, no I/O. Called every tick per entity, so avoid
// allocating when there's nothing to expire (the common case until 3.16+ lands).
// Generic (rather than the StatusEffectTarget union used above) so callers keep the
// concrete PlayerState/EnemyState type of whatever they passed in.
export function tickStatusEffects<T extends StatusEffectTarget>(target: T, nowMs: number): T {
  if (target.statusEffects.length === 0) return target;

  const statusEffects = target.statusEffects.filter(e => e.expiresAtMs > nowMs);
  if (statusEffects.length === target.statusEffects.length) return target;

  return { ...target, statusEffects };
}

export function getStatusEffectMagnitude(
  target: StatusEffectTarget,
  type: StatusEffect['type'],
  nowMs: number,
): number {
  const effect = target.statusEffects.find(e => e.type === type && e.expiresAtMs > nowMs);
  return effect?.magnitude ?? 0;
}

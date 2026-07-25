import type { PlayerClass, AbilityInputType } from 'shared-types';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { Result } from '../state/result.js';
import { ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE, ABILITY_SELF_COST_HP, ABILITY_HP_SCALED_DAMAGE } from '../balance.js';

export interface AbilityDispatchContext {
  playerClass: PlayerClass;
  abilityIndex: number;
  directionX: number;
  directionY: number;
  cooldownExpiresAt: number;
  nowMs: number;
  casterHp: number;
  casterMaxHp: number;
}

export interface AbilityFiredEvent {
  cooldownMs: number;
  expiresAt: number;
  directionX: number;
  directionY: number;
  damage: number;
  selfCostHpApplied: number;
}

export type AbilityGameError = { code: string; detail?: string };

// 1-HP safety floor: caps the cost rather than blocking the cast.
export function calculateSelfCostHp(selfCostHp: number, casterHp: number): number {
  return Math.min(selfCostHp, Math.max(casterHp - 1, 0));
}

// scaleCoef === 0 means no scaling (every ability until Story 3.19 sets one).
export function calculateHpScaledDamage(baseDamage: number, scaleCoef: number, casterHp: number, casterMaxHp: number): number {
  if (scaleCoef <= 0 || casterMaxHp <= 0) return baseDamage;
  return baseDamage * (1 + scaleCoef * (1 - casterHp / casterMaxHp));
}

// Pure — no Colyseus, no planck, no I/O.
export function dispatchAbility(ctx: AbilityDispatchContext): Result<AbilityFiredEvent, AbilityGameError> {
  if (ctx.abilityIndex < 0 || ctx.abilityIndex > 3) {
    return { ok: false, error: { code: 'INVALID_ABILITY_INDEX', detail: String(ctx.abilityIndex) } };
  }

  if (ctx.cooldownExpiresAt > ctx.nowMs) {
    return { ok: false, error: { code: 'ON_COOLDOWN' } };
  }

  const classDef = CLASS_DEFINITIONS[ctx.playerClass];
  const ability = classDef.abilities[ctx.abilityIndex];
  if (!ability) {
    return { ok: false, error: { code: 'ABILITY_NOT_FOUND' } };
  }

  const idx = ctx.abilityIndex as 0 | 1 | 2 | 3;
  const cooldownMs = ABILITY_COOLDOWNS_MS[ctx.playerClass][idx];
  const damage = calculateHpScaledDamage(
    ABILITY_DAMAGE[ctx.playerClass][idx],
    ABILITY_HP_SCALED_DAMAGE[ctx.playerClass][idx],
    ctx.casterHp,
    ctx.casterMaxHp,
  );
  const selfCostHpApplied = calculateSelfCostHp(ABILITY_SELF_COST_HP[ctx.playerClass][idx], ctx.casterHp);

  const inputType: AbilityInputType = ability.inputType;

  // Directional abilities (AUTO/RELEASE) require a real aim vector. A zero-aim cast
  // is skipped downstream by the sim's `mag === 0` hit guard, so accepting it here
  // would spend the full cooldown and broadcast cooldown:update + ability:fired for
  // a cast that does nothing (the "cooldown burned, nothing happened" symptom). Gate
  // it out before the cooldown is set. TAP is self-centred and ignores direction, so
  // it is exempt. (Cooldown-sync fix 2026-07-25.)
  if (inputType !== 'TAP' && !(Math.hypot(ctx.directionX, ctx.directionY) > 0)) {
    return { ok: false, error: { code: 'ZERO_AIM' } };
  }

  const dirX = inputType === 'TAP' ? 0 : ctx.directionX;
  const dirY = inputType === 'TAP' ? 0 : ctx.directionY;

  return {
    ok: true,
    value: {
      cooldownMs,
      expiresAt: ctx.nowMs + cooldownMs,
      directionX: dirX,
      directionY: dirY,
      damage,
      selfCostHpApplied,
    },
  };
}

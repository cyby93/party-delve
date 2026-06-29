import type { PlayerClass, AbilityInputType } from 'shared-types';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { Result } from '../state/result.js';
import { ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE } from '../balance.js';

export interface AbilityDispatchContext {
  playerClass: PlayerClass;
  abilityIndex: number;
  directionX: number;
  directionY: number;
  cooldownExpiresAt: number;
  nowMs: number;
}

export interface AbilityFiredEvent {
  cooldownMs: number;
  expiresAt: number;
  directionX: number;
  directionY: number;
  damage: number;
}

export type AbilityGameError = { code: string; detail?: string };

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
  const damage = ABILITY_DAMAGE[ctx.playerClass][idx];

  const inputType: AbilityInputType = ability.inputType;
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
    },
  };
}

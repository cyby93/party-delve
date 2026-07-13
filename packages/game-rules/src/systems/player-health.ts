import type { PlayerState } from 'shared-types';
import type { Result } from '../state/result.js';
import { REVIVE_WINDOWS_MS } from '../balance.js';
import { getStatusEffectMagnitude } from './status-effects.js';

export interface PlayerDamageResult {
  player: PlayerState;
  downed: boolean;
  reviveWindowMs?: number;
}

export type HealthError = { code: string; detail?: string };

export function applyPlayerDamage(
  player: PlayerState,
  damage: number,
  nowMs: number,
): Result<PlayerDamageResult, HealthError> {
  if (player.isDown || player.isSpirit) {
    return { ok: false, error: { code: 'PLAYER_NOT_DAMAGEABLE' } };
  }
  if (player.isFrozen) {
    return { ok: false, error: { code: 'PLAYER_FROZEN' } };
  }
  if (damage < 0) {
    return { ok: false, error: { code: 'NEGATIVE_DAMAGE', detail: String(damage) } };
  }

  const damageReduction = getStatusEffectMagnitude(player, 'damageReduction', nowMs);
  const mitigatedDamage = damage * (1 - damageReduction);
  const newHp = Math.max(0, player.hp - mitigatedDamage);
  const downed = newHp === 0;
  const newDownCount = downed ? player.downCount + 1 : player.downCount;
  const reviveWindowMs = downed ? getReviveWindowMs(newDownCount) : undefined;

  const updatedPlayer: PlayerState = {
    ...player,
    hp: newHp,
    isDown: downed,
    downCount: newDownCount,
  };

  const result: PlayerDamageResult = { player: updatedPlayer, downed };
  if (reviveWindowMs !== undefined) result.reviveWindowMs = reviveWindowMs;
  return { ok: true, value: result };
}

export function getReviveWindowMs(downCount: number): number {
  return REVIVE_WINDOWS_MS[Math.min(Math.max(downCount, 1), REVIVE_WINDOWS_MS.length) - 1] ?? 2000;
}

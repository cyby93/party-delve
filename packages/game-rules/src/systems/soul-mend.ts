import type { PlayerState } from 'shared-types';
import { isInHitZone } from './combat.js';

// Pure — no Colyseus, no planck, no I/O.
// AIM_CAST is directional (not TAP), same aimed-cone rule as every other
// directional ability — reuses isInHitZone against downed allies instead of enemies.
export function findSoulMendTarget(
  casterX: number,
  casterY: number,
  dirX: number,
  dirY: number,
  downedPlayers: PlayerState[],
  hitRangePx: number,
  hitRadiusPx: number,
): PlayerState | null {
  for (const player of downedPlayers) {
    if (!player.isDown) continue;
    if (isInHitZone(casterX, casterY, dirX, dirY, player.x, player.y, hitRadiusPx, hitRangePx, true)) {
      return player;
    }
  }
  return null;
}

// Pure — no Colyseus, no planck, no I/O. Mirrors AUTO's "no explicit stop
// signal" design: liveness timeout stands in for an explicit release/cancel
// message. Also cancels if the caster is incapacitated (downed/frozen/spirit —
// e.g. an enemy hit dropped them mid-channel), the target is no longer a valid
// revive target (left, revived by someone else, or entered full spirit form),
// or the caster has moved out of range since the channel started.
export function shouldCancelSoulMendChannel(
  target: PlayerState | undefined,
  casterX: number,
  casterY: number,
  casterIncapacitated: boolean,
  lastInputAtMs: number,
  nowMs: number,
  livenessMs: number,
  maxRangePx: number,
): boolean {
  if (casterIncapacitated) return true;
  if (nowMs - lastInputAtMs > livenessMs) return true;
  if (!target || !target.isDown) return true;
  const dx = target.x - casterX;
  const dy = target.y - casterY;
  return dx * dx + dy * dy > maxRangePx * maxRangePx;
}

// Pure — no Colyseus, no planck, no I/O.
// Same state transition as the existing proximity-based revive (see
// GameRoom.ts's proximity-revive block) — Soul Mend bypasses that flow's
// trigger logic entirely but reuses its exact output shape.
export function reviveBySoulMend(target: PlayerState, reviveHp: number): PlayerState {
  return { ...target, isDown: false, isSpirit: false, hp: reviveHp, reviveTimerExpiresAt: 0 };
}

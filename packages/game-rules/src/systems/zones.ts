import type { ZoneState } from 'shared-types';

// Pure — no planck, no Colyseus, no I/O. Actual effect reapplication (who's
// overlapping) is tracked by GameRoom via planck contact events; this only
// answers "is it time".
export function shouldZoneTick(zone: ZoneState, nowMs: number, lastTickAtMs: number): boolean {
  if (zone.tickIntervalMs <= 0) return false;
  return nowMs - lastTickAtMs >= zone.tickIntervalMs;
}

export function isZoneExpired(zone: ZoneState, nowMs: number): boolean {
  return nowMs >= zone.expiresAtMs;
}

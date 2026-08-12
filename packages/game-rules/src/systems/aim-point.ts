/**
 * Story 7.15b (ADR-0008): the single expression for "where along the aim does
 * this ability land".
 *
 * This exists so an aim *preview* and the real cast can never disagree. ADR-0008's
 * Consequences section is explicit about why: "the preview reuses the exact
 * functions that already compute real cast placement, so preview and actual
 * landing spot can never drift apart the way D-7.2-A (ADR-0003's motivating drift
 * bug) did." A preview that re-derives `caster + dir × range` in its own function
 * is correct today and wrong the first time an ability's range is retuned.
 *
 * Before this function the same expression appeared twice, independently:
 *   - `isInHitZone`'s directional branch (`combat.ts`) — the hit circle's centre
 *   - `GameRoom`'s zone-delivery placement — where Storm Eye's ZoneState is put
 *
 * Pure: no I/O, no Colyseus, no planck.js. Never throws — returns `null` rather
 * than propagating an error, per the game-rules Result/no-throw convention.
 */
export interface AimPoint {
  x: number;
  y: number;
  /** The normalized aim direction actually used. */
  dirX: number;
  dirY: number;
}

/**
 * Resolve the aim point for a directional ability.
 *
 * Returns `null` when the direction carries no usable aim, which covers three
 * cases the callers must all treat identically (skip, render nothing):
 *  - a true zero vector — every cast path in the sim already rejects this
 *    (`mag === 0 → continue`), and the host's SILENT rule depends on it;
 *  - `NaN` — the result of normalizing a zero-length drag (`0/0`) on a client;
 *  - `null` arriving from the wire in a field typed `number` — JSON turns
 *    non-finite numbers into `null` (`JSON.stringify({x: NaN})` → `{"x":null}`)
 *    and `deserialize` is an unchecked cast, so the sim must not assume the type.
 *
 * The guard is `Number.isFinite` plus `!(mag > 0)` — deliberately NOT `mag === 0`,
 * which `NaN` fails to satisfy and would therefore pass. This mirrors the
 * NaN-safe idiom `dispatchAbility` already uses on the fire path.
 *
 * `hitRangePx` of 0 (a self-centred TAP ability) yields the caster's own
 * position, which is the correct hit-circle centre for those abilities.
 */
export function resolveAimPoint(
  casterX: number,
  casterY: number,
  dirX: number,
  dirY: number,
  hitRangePx: number,
): AimPoint | null {
  if (!Number.isFinite(dirX) || !Number.isFinite(dirY)) return null;
  if (!Number.isFinite(casterX) || !Number.isFinite(casterY)) return null;
  if (!Number.isFinite(hitRangePx)) return null;

  const mag = Math.hypot(dirX, dirY);
  if (!(mag > 0)) return null;

  const normX = dirX / mag;
  const normY = dirY / mag;
  return {
    x: casterX + normX * hitRangePx,
    y: casterY + normY * hitRangePx,
    dirX: normX,
    dirY: normY,
  };
}

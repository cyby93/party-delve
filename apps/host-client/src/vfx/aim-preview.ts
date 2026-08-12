import { Graphics } from 'pixi.js';
import type { PlayerState } from 'shared-types';
import { ABILITY_GEOMETRY, STORM_EYE_ZONE_RADIUS_PX, PlayerClass } from 'shared-types';

/**
 * Story 7.15c (ADR-0008): the host's aim-direction arrow and destination preview.
 *
 * Two things make this unlike every other Epic 7 visual:
 *
 * 1. **It is persistent, not an effect.** `VfxEngine` effects self-expire — they
 *    fade over `durationMs` and get reaped. An aim preview lives until an external
 *    event ends it and must follow a moving caster every frame, so it is modelled
 *    as a per-frame `Graphics` (the bond-tether / status-aura pattern), not as an
 *    engine effect that would have to be re-added or given a fake duration.
 *
 * 2. **Nothing tells the host when aiming stops.** The contract has one delta type
 *    and no terminator: the phone simply stops sending (7.15d), the sim stops
 *    broadcasting (7.15b), and the host observes silence. Silence is
 *    indistinguishable from a dropped packet, which is why the staleness window
 *    below is a deliberate, justified value rather than "one tick", and why the
 *    `ability:fired` clear matters — it handles the common exit exactly.
 *    Confirmed as the intended design by the user on 2026-08-05, in preference to
 *    amending ADR-0008 with a cancel event or a timestamp.
 */

/**
 * How long a preview survives without a refresh before the host assumes aiming
 * stopped.
 *
 * Sized against the send cadence, not guessed: the phone sends at
 * `INPUT_INTERVAL_MS` (33ms) and the sim broadcasts at most once per 30hz tick,
 * so 150ms is ~4-5 refresh intervals. Long enough to ride out a dropped frame or
 * a scheduling hiccup without the arrow strobing; short enough that an abandoned
 * aim clears within a sixth of a second, which reads as immediate.
 *
 * Getting this wrong degrades gracefully in one direction only: too long leaves a
 * briefly-lingering ghost arrow (cosmetic), never a wrong gameplay signal. The
 * common exit — release into a real cast — does not depend on this value at all,
 * because `ability:fired` clears the preview exactly.
 *
 * It IS however the sole mechanism for every non-fire exit, including the one the
 * 7.15a review surfaced: a drag that ends while the ability is still on cooldown
 * produces no `ability:fired` either, because `dispatchAbility` rejects the cast.
 */
export const AIM_PREVIEW_STALE_MS = 150;

/** One player's live aim, as last reported by the sim. */
export interface AimPreviewState {
  abilityIndex: number;
  directionX: number;
  directionY: number;
  targetX?: number;
  targetY?: number;
  /** Host clock (`Date.now()`) at which this was last refreshed. */
  lastSeenAtMs: number;
}

/**
 * Pure staleness predicate — extracted rather than inlined in the render loop so
 * it is directly testable, per this story's Required tests.
 */
export function isAimPreviewStale(lastSeenAtMs: number, nowMs: number): boolean {
  // `>=` so a preview exactly at the boundary is dropped rather than kept for one
  // more frame; and a non-finite timestamp is treated as stale rather than as
  // "infinitely fresh", which would pin an arrow on screen forever.
  if (!Number.isFinite(lastSeenAtMs)) return true;
  return nowMs - lastSeenAtMs >= AIM_PREVIEW_STALE_MS;
}

/** Drop every entry whose last refresh is older than the window. */
export function pruneStaleAimPreviews(
  previews: Map<string, AimPreviewState>,
  nowMs: number,
): void {
  for (const [playerId, state] of previews) {
    if (isAimPreviewStale(state.lastSeenAtMs, nowMs)) previews.delete(playerId);
  }
}

// ── Appearance ────────────────────────────────────────────────────────────────
// Single-source tuning constants. The manual Client-UX pass is expected to adjust
// these rather than restructure code — up to MAX_PLAYERS (8) arrows plus four
// ghost shapes can be live at once on a shared screen viewed from 2-4m, so
// legibility is the real acceptance risk here, not correctness.
export const AIM_ARROW_LENGTH_PX = 110;
export const AIM_ARROW_WIDTH = 6;
export const AIM_ARROW_ALPHA = 0.38;
export const AIM_ARROW_HEAD_PX = 22;
export const AIM_ARROW_HEAD_SPREAD_RAD = 0.42;
/** Gap between the caster's rim and the arrow's tail, so it doesn't grow out of the body. */
export const AIM_ARROW_ORIGIN_OFFSET_PX = 26;
export const AIM_ZONE_FILL_ALPHA = 0.14;
export const AIM_ZONE_RIM_ALPHA = 0.42;
export const AIM_ZONE_RIM_WIDTH = 3;

/**
 * What ghost shape (if any) a given ability's destination preview should be.
 * Pure and table-driven off `ABILITY_GEOMETRY`, so a balance change to a cone
 * angle or a range moves this with it.
 *
 * Reading geometry for *shape* is required — the delta carries a point, not a
 * radius or an angle. Recomputing the *point* is what ADR-0008 forbids, and this
 * function never does that: every caller passes in the delta's own target.
 */
export type AimPreviewShape =
  | { kind: 'circle'; radius: number }
  | { kind: 'cone'; angleDeg: number; lengthPx: number }
  | null;

export function resolveAimPreviewShape(
  playerClass: PlayerClass,
  abilityIndex: number,
): AimPreviewShape {
  const geometry = ABILITY_GEOMETRY[playerClass]?.[abilityIndex as 0 | 1 | 2 | 3];
  if (!geometry) return null;

  // Storm Eye is the only 'zone'-delivery ability; its ghost is the zone the cast
  // would place, sized to the real zone radius rather than to its hit radius.
  if (geometry.delivery === 'zone') {
    return { kind: 'circle', radius: STORM_EYE_ZONE_RADIUS_PX };
  }
  // Cone abilities (Stone Wall 50°, Crimson Lash 45°) preview the sector they
  // actually sweep — apex at the caster, length = hitRangePx, exactly as the
  // sim's isInConeZone reads it.
  if (geometry.hitShape === 'cone' && geometry.coneAngleDeg !== undefined) {
    return { kind: 'cone', angleDeg: geometry.coneAngleDeg, lengthPx: geometry.hitRangePx };
  }
  // Everything else with a knowable landing point (Dark Pact) previews its
  // existing hit shape: a circle of hitRadiusPx at the target.
  return { kind: 'circle', radius: geometry.hitRadiusPx };
}

/**
 * Build the polygon of a circular sector, apex-first.
 *
 * Extracted deliberately rather than re-derived inline. `createConeWedge`
 * (primitives.ts) encodes a fix that cost a full manual-QA round in Story 7.13:
 * PixiJS's `GraphicsContext.arc()` does not insert an implicit connecting segment
 * from the current path point to the arc's start (unlike Canvas2D), so the initial
 * `lineTo` must target the arc's own start-angle tip. Getting that wrong produced
 * a shape filling ~12% of the intended area — a sliver near the rim, easily
 * mistaken for "nothing rendered". A second hand-rolled sector here would
 * reintroduce exactly that bug, and 7.13's regression test guards the primitive,
 * not this code.
 *
 * Returned as an explicit point list so it can be area-checked in a test without
 * a PixiJS renderer.
 */
export function coneSectorPoints(
  apexX: number,
  apexY: number,
  dirX: number,
  dirY: number,
  angleDeg: number,
  lengthPx: number,
  segments = 24,
): { x: number; y: number }[] {
  const mag = Math.hypot(dirX, dirY);
  if (!(mag > 0) || !Number.isFinite(lengthPx) || lengthPx <= 0) return [];
  const nx = dirX / mag;
  const ny = dirY / mag;
  const baseAngle = Math.atan2(ny, nx);
  const half = (Math.max(angleDeg, 0) * Math.PI) / 180 / 2;

  const points: { x: number; y: number }[] = [{ x: apexX, y: apexY }];
  for (let i = 0; i <= segments; i++) {
    const a = baseAngle - half + (2 * half * i) / segments;
    points.push({ x: apexX + Math.cos(a) * lengthPx, y: apexY + Math.sin(a) * lengthPx });
  }
  return points;
}

/**
 * Draw one player's aim preview into an already-positioned `Graphics`.
 *
 * The `Graphics` is cleared and redrawn every frame from the caster's *current*
 * snapshot position — the caster can walk while aiming, and both the arrow and a
 * cone ghost are apex-anchored to them, so neither may be frozen at the position
 * held when the delta arrived.
 */
export function drawAimPreview(
  g: Graphics,
  player: PlayerState,
  preview: AimPreviewState,
  color: number,
): void {
  g.clear();

  const mag = Math.hypot(preview.directionX, preview.directionY);
  if (!(mag > 0)) return; // the sim suppresses zero aims, but never trust the wire
  const nx = preview.directionX / mag;
  const ny = preview.directionY / mag;

  // ── Destination / zone ghost (only when the sim resolved a target) ──────────
  // No host-side re-derivation: if targetX/targetY are absent the ability has no
  // knowable landing point (projectile delivery, or an AUTO ability) and only the
  // arrow renders. `Number.isFinite` rather than `!== undefined` because JSON
  // turns a non-finite number into `null`, which passes an undefined check and
  // then coerces to 0 — that would draw the ghost at the world origin.
  //
  // Note the asymmetry between the two shape kinds. A CIRCLE ghost is positioned
  // by the delta's target and therefore genuinely requires it. A CONE ghost is
  // apex-anchored at the caster and derives its extent from the ability's own
  // geometry, so it does not read the target at all — it is gated on one only
  // because the sim's `showsTarget` rule (RELEASE && !projectile) happens to
  // select exactly the cone abilities too. That coupling is implicit; if 7.15b
  // ever stops sending a target for Stone Wall or Crimson Lash, their cones would
  // silently vanish. Flagged by code review 2026-08-06 and left as-is
  // deliberately: gating both kinds on "the sim resolved an aim point" is the
  // honest reading of ADR-0008, and drawing a cone the sim did not confirm would
  // be exactly the kind of unilateral host-side inference the ADR forbids.
  if (player.class !== null && Number.isFinite(preview.targetX) && Number.isFinite(preview.targetY)) {
    const shape = resolveAimPreviewShape(player.class, preview.abilityIndex);
    if (shape?.kind === 'circle') {
      g.circle(preview.targetX!, preview.targetY!, shape.radius)
        .fill({ color, alpha: AIM_ZONE_FILL_ALPHA })
        .stroke({ color, width: AIM_ZONE_RIM_WIDTH, alpha: AIM_ZONE_RIM_ALPHA });
    } else if (shape?.kind === 'cone') {
      // Apex at the caster, not at the target — a cone sweeps outward from the
      // player, so it must re-orient every frame as they move.
      const pts = coneSectorPoints(player.x, player.y, nx, ny, shape.angleDeg, shape.lengthPx);
      if (pts.length > 2) {
        g.poly(pts.map(p => [p.x, p.y]).flat())
          .fill({ color, alpha: AIM_ZONE_FILL_ALPHA })
          .stroke({ color, width: AIM_ZONE_RIM_WIDTH, alpha: AIM_ZONE_RIM_ALPHA });
      }
    }
  }

  // ── Direction arrow ────────────────────────────────────────────────────────
  const originX = player.x + nx * AIM_ARROW_ORIGIN_OFFSET_PX;
  const originY = player.y + ny * AIM_ARROW_ORIGIN_OFFSET_PX;
  const tipX = originX + nx * AIM_ARROW_LENGTH_PX;
  const tipY = originY + ny * AIM_ARROW_LENGTH_PX;

  g.moveTo(originX, originY).lineTo(tipX, tipY)
    .stroke({ color, width: AIM_ARROW_WIDTH, alpha: AIM_ARROW_ALPHA });

  // Head: two barbs swept back from the tip, so direction reads at couch distance
  // even when the shaft is faint.
  const baseAngle = Math.atan2(ny, nx);
  for (const sign of [-1, 1]) {
    const a = baseAngle + Math.PI + sign * AIM_ARROW_HEAD_SPREAD_RAD;
    g.moveTo(tipX, tipY)
      .lineTo(tipX + Math.cos(a) * AIM_ARROW_HEAD_PX, tipY + Math.sin(a) * AIM_ARROW_HEAD_PX)
      .stroke({ color, width: AIM_ARROW_WIDTH, alpha: AIM_ARROW_ALPHA });
  }
}

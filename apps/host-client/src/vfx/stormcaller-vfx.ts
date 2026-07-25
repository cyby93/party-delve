import {
  ABILITY_HIT_RANGE_PX,
  ABILITY_HIT_RADIUS_PX,
  PlayerClass,
  STORM_EYE_ZONE_RADIUS_PX,
} from 'shared-types';
import type { ZoneState } from 'shared-types';
import { STORMCALLER_PALETTE } from './ability-vfx-config';
import { VfxEngine } from './engine';
import { createBeam, createParticleBurst, createRingShockwave, createTrail, type TrailHandle } from './primitives';

/**
 * Stormcaller ability VFX — pure planners that emit serializable specs plus thin
 * executors that translate each spec into the matching `create*` primitive.
 * Rendering only; no game logic, no cooldowns, no collision. `resolveStormcallerCast`
 * and `stormEyeTickCadence` are pure (no PixiJS, no clock read) so the test collects
 * instantly and asserts on the data directly (Story 7.5 Task 7).
 *
 * The spatial hit geometry (hit range, hit radius, the Storm Eye zone radius) is
 * imported live from the shared ability presentation contract in `shared-types`
 * (Story 7.9 / ADR-0003) — the same values the sim resolves hits with, so a
 * range/radius re-tune moves the VFX automatically instead of drifting from a
 * hand-copied literal. Colors, stroke widths, alphas and cosmetic durations stay
 * local. Colors are PixiJS numeric literals, never CSS strings.
 *
 * CLOCK CONTRACT: every timestamp here is `Date.now()` (the ticker's clock, the
 * one `VfxEngine.update()` runs on) — never `performance.now()`. Delta-triggered
 * effects (the cast in the `ability:fired` handler, the `zone:strike` accent)
 * stamp `startedAt` at trigger and thread it through, so a cast queued while a
 * hidden tab's ticker is stopped self-expires on resume instead of piling up
 * (BACKGROUNDED-TICKER rule, Story 7.2 review). Ticker-driven effects (the Storm
 * Eye pulse, the Tempest Hurl trail) use the ticker's own `now`.
 */

// ── Palette: derived from the single PixiJS-free definition ──────────────────
/** White-hot filament — the bright inner line of every bolt / clap edge. */
export const STORM_CORE = STORMCALLER_PALETTE.core;
/** Electric blue — bolt glow, arc impact, Storm Eye tick pulse. */
export const STORM_BOLT = STORMCALLER_PALETTE.bolt;
/** Violet charge — Tempest Hurl impact, Thunder Clap halo, Storm Eye implode. */
export const STORM_CHARGE = STORMCALLER_PALETTE.charge;
/** Dark storm slate — the Storm Eye zone body. */
export const STORM_SLATE = STORMCALLER_PALETTE.slate;

// ── Geometry, read live from the shared contract (Story 7.9 / ADR-0003) ──────
const STORMCALLER_RANGE = ABILITY_HIT_RANGE_PX[PlayerClass.STORMCALLER];   // [160, 200, 0, 160]
const STORMCALLER_RADIUS = ABILITY_HIT_RADIUS_PX[PlayerClass.STORMCALLER]; // [ 60,  70, 110,  80]

// ── Cosmetic constants (no corresponding sim value — local to the visual) ────
/** Tempest Hurl's host-side thrown-flight duration. Kept short: the hit already
 *  resolved server-side (hitscan, no ProjectileState), so a long flight would
 *  visibly desync the trail from its damage number. */
export const TEMPEST_HURL_FLIGHT_MS = 170;

// ── Spec model ───────────────────────────────────────────────────────────────
// A serializable description of one instant primitive effect, in absolute
// coordinates. `spawnSpecs` maps each to a `create*` factory, adding the
// trigger-time `startedAt`. Data-only so the planner is pure and pairwise-comparable.
export type StormcallerVfxSpec =
  | {
      kind: 'ring';
      x: number; y: number; color: number;
      startRadius: number; maxRadius: number; lineWidth: number;
      filled: boolean; alpha: number; durationMs: number;
    }
  | {
      kind: 'beam';
      x: number; y: number; toX: number; toY: number;
      color: number; width: number; alpha: number; durationMs: number;
    }
  | {
      kind: 'burst';
      x: number; y: number; color: number | readonly number[];
      count: number; speed: number; spread: number; particleRadius: number;
      alpha: number; durationMs: number;
    };

const ring = (o: Omit<Extract<StormcallerVfxSpec, { kind: 'ring' }>, 'kind' | 'filled'>): StormcallerVfxSpec =>
  ({ kind: 'ring', filled: false, ...o });
const beam = (o: Omit<Extract<StormcallerVfxSpec, { kind: 'beam' }>, 'kind'>): StormcallerVfxSpec => ({ kind: 'beam', ...o });
const burst = (o: Omit<Extract<StormcallerVfxSpec, { kind: 'burst' }>, 'kind'>): StormcallerVfxSpec => ({ kind: 'burst', ...o });

/** Parameters for Tempest Hurl's per-frame thrown-flight trail (idx 1 only). */
export interface StormcallerFlightPlan {
  originX: number; originY: number;
  /** Normalized aim direction. */
  dirX: number; dirY: number;
  rangePx: number;
  trail: { color: number; width: number; pointCount: number; alpha: number; durationMs: number };
  /** Ring + burst spawned at the endpoint when the flight completes. */
  impact: StormcallerVfxSpec[];
}

export interface StormcallerCastPlan {
  abilityIndex: number;
  /** Instant fire-and-forget effects, in draw order (glow before core, etc.). */
  specs: StormcallerVfxSpec[];
  /** Present only for Tempest Hurl (idx 1). */
  flight?: StormcallerFlightPlan;
}

// ── Cast planner (delta-driven, `ability:fired`) ─────────────────────────────

/**
 * The primitive plan for one Stormcaller cast, or `null` when nothing should
 * render.
 *
 * Returns `null` for an unknown/non-integer `abilityIndex`, a non-finite spatial
 * input, and — for the three *directional* abilities (Lightning Arc / Tempest
 * Hurl / Storm Eye) — a zero-length aim vector, matching the sim's own
 * `if (mag === 0) continue` (`GameRoom.ts:2104-2105`, `:2203`): the sim skips the
 * hit, so the honest visual is none at all and no fallback flash (SILENT rule).
 * Thunder Clap (idx 2) is self-centred, ignores direction, and always plans.
 * Never throws.
 */
export function resolveStormcallerCast(
  abilityIndex: number,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): StormcallerCastPlan | null {
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0 || abilityIndex > 3) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(dirX) || !Number.isFinite(dirY)) return null;

  const mag = Math.hypot(dirX, dirY);
  const directional = abilityIndex !== 2;
  if (directional && !(mag > 0)) return null;
  const nx = mag > 0 ? dirX / mag : 0;
  const ny = mag > 0 ? dirY / mag : 0;

  switch (abilityIndex) {
    case 0: return planLightningArc(x, y, nx, ny);
    case 1: return planTempestHurl(x, y, nx, ny);
    case 2: return planThunderClap(x, y);
    case 3: return planStormEye(x, y, nx, ny);
    default: return null;
  }
}

// Index 0 — Lightning Arc (range 160, radius 60). Instant, thin, bright: a wide
// dim glow beam UNDER a narrow bright core beam (the two-layer stack is the
// "fork" read — there is no forked-bolt primitive and none is hand-rolled), then
// an honest crack ring at the real hit circle.
function planLightningArc(px: number, py: number, nx: number, ny: number): StormcallerCastPlan {
  const ex = px + nx * STORMCALLER_RANGE[0];
  const ey = py + ny * STORMCALLER_RANGE[0];
  return {
    abilityIndex: 0,
    specs: [
      beam({ x: px, y: py, toX: ex, toY: ey, color: STORM_BOLT, width: 9, alpha: 0.45, durationMs: 200 }),
      beam({ x: px, y: py, toX: ex, toY: ey, color: STORM_CORE, width: 3, alpha: 1, durationMs: 140 }),
      ring({ x: ex, y: ey, color: STORM_BOLT, startRadius: 12, maxRadius: STORMCALLER_RADIUS[0], lineWidth: 3, alpha: 0.9, durationMs: 220 }),
    ],
  };
}

// Index 1 — Tempest Hurl (range 200, radius 70). Reads as thrown even though the
// sim resolves it hitscan in the same tick and no ProjectileState exists: a
// launch puff at the caster, a moving trail flourish, then a fat violet impact
// ring + burst at the real hit circle.
function planTempestHurl(px: number, py: number, nx: number, ny: number): StormcallerCastPlan {
  const ex = px + nx * STORMCALLER_RANGE[1];
  const ey = py + ny * STORMCALLER_RANGE[1];
  return {
    abilityIndex: 1,
    specs: [
      burst({ x: px, y: py, color: [STORM_CHARGE, STORM_BOLT], count: 7, speed: 0.10, spread: 0.9, particleRadius: 4, alpha: 1, durationMs: 200 }),
    ],
    flight: {
      originX: px, originY: py, dirX: nx, dirY: ny, rangePx: STORMCALLER_RANGE[1],
      trail: { color: STORM_BOLT, width: 11, pointCount: 10, alpha: 0.9, durationMs: 160 },
      impact: [
        ring({ x: ex, y: ey, color: STORM_CHARGE, startRadius: 18, maxRadius: STORMCALLER_RADIUS[1], lineWidth: 5, alpha: 0.95, durationMs: 300 }),
        burst({ x: ex, y: ey, color: [STORM_CORE, STORM_CHARGE], count: 12, speed: 0.18, spread: 0.6, particleRadius: 6, alpha: 1, durationMs: 320 }),
      ],
    },
  };
}

// Index 2 — Thunder Clap (self-centred, radius 110 — the largest AoE in the game).
// Direction is irrelevant. Imploding air-collapse ring crossing the honest bright
// ring, a dim wide halo (deliberately overshoots to 132 at half alpha so the eye
// still reads 110 as the boundary), and a particle burst.
function planThunderClap(px: number, py: number): StormcallerCastPlan {
  return {
    abilityIndex: 2,
    specs: [
      ring({ x: px, y: py, color: STORM_BOLT, startRadius: 150, maxRadius: 24, lineWidth: 4, alpha: 0.7, durationMs: 180 }),
      ring({ x: px, y: py, color: STORM_CORE, startRadius: 0, maxRadius: STORMCALLER_RADIUS[2], lineWidth: 8, alpha: 0.95, durationMs: 260 }),
      ring({ x: px, y: py, color: STORM_CHARGE, startRadius: 30, maxRadius: 132, lineWidth: 3, alpha: 0.5, durationMs: 420 }),
      burst({ x: px, y: py, color: [STORM_CORE, STORM_BOLT, STORM_CHARGE], count: 14, speed: 0.40, spread: 0.9, particleRadius: 4, alpha: 1, durationMs: 275 }),
    ],
  };
}

// Index 3 — Storm Eye cast moment (RELEASE, zone delivery). Fires at the zone
// placement point (caster + dir * 160 — exactly where the sim puts the zone) and
// implodes onto the zone's real 150 px footprint (NOT the hitscan radius 80,
// which is dead data for this ability), with the vertical sky-bolt motif striking
// down into it and a ground burst.
function planStormEye(px: number, py: number, nx: number, ny: number): StormcallerCastPlan {
  const ex = px + nx * STORMCALLER_RANGE[3];
  const ey = py + ny * STORMCALLER_RANGE[3];
  return {
    abilityIndex: 3,
    specs: [
      ring({ x: ex, y: ey, color: STORM_CHARGE, startRadius: 230, maxRadius: STORM_EYE_ZONE_RADIUS_PX, lineWidth: 6, alpha: 0.85, durationMs: 400 }),
      beam({ x: ex, y: ey - 260, toX: ex, toY: ey, color: STORM_CORE, width: 6, alpha: 1, durationMs: 200 }),
      burst({ x: ex, y: ey, color: [STORM_BOLT, STORM_CORE], count: 10, speed: 0.16, spread: 0.7, particleRadius: 5, alpha: 1, durationMs: 300 }),
    ],
  };
}

// ── Storm Eye tick cadence (snapshot-derived, PixiJS-free, the AC3 path) ──────

/**
 * The snapshot-derived pulse cadence for a live Storm Eye zone. Counts *backwards
 * from expiry* so it needs no host mirror of the sim's 5000 ms duration constant
 * (which could drift): `ticksRemaining = ceil((expiresAtMs - now) / tickIntervalMs)`
 * decreases by exactly 1 at each real tick boundary, and each decrement is the
 * pulse trigger.
 *
 * `phase` is progress through the current tick cell in `[0, 1)` — 0 just after a
 * boundary, approaching 1 at the next. Computed as `ceil(r/t) - r/t`, which equals
 * the spec's `1 - (r % t)/t` everywhere off-boundary and resolves the exact
 * boundary to 0 (a new cell just began) rather than 1, keeping it half-open.
 *
 * Returns `null` for a non-positive/non-finite `tickIntervalMs`, any non-finite
 * input, or an already-expired zone (`now >= expiresAtMs`). Never throws.
 *
 * Assumption noted for the record: the sim sets `expiresAtMs = spawn + 5000` and
 * `tickIntervalMs = 500`, and `5000 % 500 === 0`, so the derived boundaries land
 * on the sim's real tick boundaries. If that ratio ever stops being integral the
 * cadence stays correct-period and only picks up a constant cosmetic phase offset.
 */
export function stormEyeTickCadence(
  now: number,
  expiresAtMs: number,
  tickIntervalMs: number,
): { ticksRemaining: number; phase: number } | null {
  if (!Number.isFinite(now) || !Number.isFinite(expiresAtMs) || !Number.isFinite(tickIntervalMs)) return null;
  if (!(tickIntervalMs > 0)) return null;
  const remaining = expiresAtMs - now;
  if (!(remaining > 0)) return null;
  const q = remaining / tickIntervalMs;
  const ticksRemaining = Math.ceil(q);
  const phase = ticksRemaining - q; // [0, 1)
  return { ticksRemaining, phase };
}

// ── Executors (the only PixiJS-touching functions here) ──────────────────────

/** Translate each instant spec into its `create*` primitive and add it to the
 *  engine, threading `startedAt` into every factory (CLOCK CONTRACT). Returns the
 *  ids in spec order. */
function spawnSpecs(engine: VfxEngine, specs: readonly StormcallerVfxSpec[], startedAt: number): number[] {
  const ids: number[] = [];
  for (const spec of specs) {
    switch (spec.kind) {
      case 'ring':
        ids.push(engine.add(createRingShockwave({
          x: spec.x, y: spec.y, color: spec.color, startRadius: spec.startRadius, maxRadius: spec.maxRadius,
          lineWidth: spec.lineWidth, filled: spec.filled, alpha: spec.alpha, durationMs: spec.durationMs, startedAt,
        })));
        break;
      case 'beam':
        ids.push(engine.add(createBeam({
          x: spec.x, y: spec.y, toX: spec.toX, toY: spec.toY, color: spec.color,
          width: spec.width, alpha: spec.alpha, durationMs: spec.durationMs, startedAt,
        })));
        break;
      case 'burst':
        ids.push(engine.add(createParticleBurst({
          x: spec.x, y: spec.y, color: spec.color, count: spec.count, speed: spec.speed, spread: spec.spread,
          particleRadius: spec.particleRadius, alpha: spec.alpha, durationMs: spec.durationMs, startedAt,
        })));
        break;
    }
  }
  return ids;
}

/** One in-flight Tempest Hurl record, advanced per ticker frame by
 *  `advanceHurlFlights`. */
export interface HurlFlight {
  trail: TrailHandle;
  originX: number; originY: number;
  dirX: number; dirY: number;
  rangePx: number;
  startedAt: number;
  impact: StormcallerVfxSpec[];
}

/**
 * Spawn a cast plan's instant specs and, for Tempest Hurl, create its flight
 * trail. Returns the `HurlFlight` record for the caller to register (advanced by
 * `advanceHurlFlights`), or `null` for the three abilities with no flight.
 *
 * `now` is stamped into every instant effect's `startedAt` (BACKGROUNDED-TICKER
 * rule — this is a delta-triggered call). Layer order is preserved: the plan
 * lists the wide dim glow beam before the narrow bright core beam, and `add`
 * appends to the stage in call order, so the core draws on top.
 */
export function spawnStormcallerCast(engine: VfxEngine, plan: StormcallerCastPlan, now: number): HurlFlight | null {
  spawnSpecs(engine, plan.specs, now);
  const f = plan.flight;
  if (!f) return null;
  const trail = createTrail({
    x: f.originX, y: f.originY, color: f.trail.color, width: f.trail.width,
    pointCount: f.trail.pointCount, alpha: f.trail.alpha, durationMs: f.trail.durationMs, startedAt: now,
  });
  engine.add(trail);
  return {
    trail,
    originX: f.originX, originY: f.originY, dirX: f.dirX, dirY: f.dirY, rangePx: f.rangePx,
    startedAt: now, impact: f.impact,
  };
}

/**
 * Advance every in-flight Tempest Hurl by one ticker frame: push the trail's head
 * toward the endpoint (guarding `trail.disposed` — pushing into a reaped trail is
 * a silent write into a destroyed Graphics), and when the flight completes spawn
 * its impact ring + burst at the endpoint and drop the record. Ticker-driven, so
 * `now` is the ticker's own clock. Mutates `flights` in place.
 */
export function advanceHurlFlights(engine: VfxEngine, flights: HurlFlight[], now: number): void {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]!;
    const t = Math.min(1, Math.max(0, (now - f.startedAt) / TEMPEST_HURL_FLIGHT_MS));
    if (!f.trail.disposed) {
      f.trail.moveTo(f.originX + f.dirX * f.rangePx * t, f.originY + f.dirY * f.rangePx * t, now);
    }
    if (t >= 1) {
      spawnSpecs(engine, f.impact, now);
      flights.splice(i, 1);
    }
  }
}

/**
 * One Storm Eye tick pulse: a ring expanding from a fraction of the zone radius
 * out to the real radius, sized live from `zone.radius`. `durationMs: 380 <`
 * `tickIntervalMs: 500`, so at most one is ever live per zone once the caller
 * enforces remove-before-add (AC4). Returns the effect id for that bound.
 * Ticker-driven, so `now` is the ticker's own clock.
 */
export function spawnStormEyePulse(engine: VfxEngine, zone: ZoneState, now: number): number {
  return engine.add(createRingShockwave({
    x: zone.x, y: zone.y, color: STORM_BOLT,
    startRadius: zone.radius * 0.35, maxRadius: zone.radius,
    lineWidth: 4, alpha: 0.7, durationMs: 380, startedAt: now,
  }));
}

/**
 * The optional `zone:strike` bonus-beat accent (Story 7.5 Task 6): the sky-bolt
 * motif reused at the struck target (enemy or boss) plus a small ground ring, so
 * the zone's bonus strike reads as the same weather system as the cast. Decorative
 * and NOT the AC3 tick path. Delta-triggered → `now` is stamped at trigger.
 */
export function spawnStormEyeStrike(engine: VfxEngine, x: number, y: number, now: number): void {
  spawnSpecs(engine, [
    beam({ x, y: y - 300, toX: x, toY: y, color: STORM_CORE, width: 5, alpha: 1, durationMs: 220 }),
    ring({ x, y, color: STORM_BOLT, startRadius: 8, maxRadius: 46, lineWidth: 4, alpha: 0.85, durationMs: 240 }),
  ], now);
}

import type { Container } from 'pixi.js';
import type { StatusEffectType } from 'shared-types';
import { createParticleBurst, createRingShockwave, createTrail, type TrailHandle } from './primitives';
import type { EffectHandle } from './types';

/**
 * Story 7.6 — the generic, snapshot-driven, shape-distinct status-effect aura.
 * Pure mapping (this file, no `pixi.js` import) + a thin primitive-forwarding
 * factory. All per-frame lifecycle (create-on-first-seen, cleanup-on-missing,
 * repositioning, cadence re-trigger) lives in DungeonScreen.tsx's `renderFrame`.
 */

// ── Slot layout ────────────────────────────────────────────────────────────
export const AURA_BASE_GAP = 18;
export const AURA_SLOT_STEP = 11;
export const AURA_SLOT_INDEX: Record<StatusEffectType, number> = {
  shield: 0,
  damageReduction: 1,
  damageBuff: 2,
  slow: 3,
};

// ── Colours (PixiJS numeric literals) — off the session-colour collisions,
//    reconciled against the UX token set (see story Dev Notes). ─────────────
export const AURA_COLORS: Record<StatusEffectType, number> = {
  damageReduction: 0xa89ec0, // text-secondary — pale mauve-grey, stone/armour register
  shield: 0xc07d35,          // accent-warm — firelight, absorb-shield register
  damageBuff: 0xc0392b,      // corruption-blood — Dark Pact's HP-drain-funded buff
  slow: 0x7d2dff,            // accent-corruption — debilitating debuff register
};

// ── Shared tuning ─────────────────────────────────────────────────────────
export const AURA_EXPIRY_FADE_MS = 600;
export const SHIELD_REFERENCE_HP = 30;
export const SLOW_ORBIT_PERIOD_MS = 1400;
export const MAX_STATUS_AURAS = 64;

// ── Per-type tuning (named per project-context's no-inline-magic-numbers rule) ─
const DAMAGE_REDUCTION_DURATION_MS = 900;
const DAMAGE_REDUCTION_START_OFFSET = 10;
const DAMAGE_REDUCTION_LINE_WIDTH_BASE = 3;
const DAMAGE_REDUCTION_LINE_WIDTH_FLOOR = 0.7;
const DAMAGE_REDUCTION_LINE_WIDTH_MAGNITUDE_MULT = 0.6;
const DAMAGE_REDUCTION_ALPHA_BASE = 0.9;

const SHIELD_DURATION_MS = 1100;
const SHIELD_START_OFFSET = 8;
const SHIELD_END_OFFSET = 4;
// Bumped from the story's original 0.22 (2026-07-26, user live-test finding): at 0.22
// peak, a *filled* dome with no rim stroke faded 0.22 -> 0 -> 0.22 every 1.1s without
// reading as a pulse at all — too little contrast against the dark background to
// notice, unlike the other three effects, which are 0.55-0.95 peak and/or stroked.
const SHIELD_ALPHA_BASE = 0.45;

const DAMAGE_BUFF_DURATION_MS = 700;
const DAMAGE_BUFF_PARTICLE_COUNT = 6;
const DAMAGE_BUFF_SPEED_DIVISOR = 700;
const DAMAGE_BUFF_SPREAD = 1.2;
const DAMAGE_BUFF_PARTICLE_RADIUS = 3;
const DAMAGE_BUFF_ALPHA_BASE = 0.95;
const DAMAGE_BUFF_ALPHA_FLOOR = 0.7;
const DAMAGE_BUFF_ALPHA_MAGNITUDE_MULT = 0.6;

const SLOW_TRAIL_ALPHA = 0.55;
const SLOW_WIDTH_BASE = 8;
const SLOW_WIDTH_MAGNITUDE_MULT = 6;
const SLOW_TRAIL_POINT_COUNT = 14;

export type StatusAuraKind = 'ring' | 'burst' | 'trail';

interface BaseAuraSpec {
  type: StatusEffectType;
  color: number;
  /** Fixed per-type slot radius — independent of what else is active (AC2). */
  radius: number;
  durationMs: number;
  /** Re-trigger interval for the cadence kinds; 0 for the persistent `slow` trail. */
  cadenceMs: number;
  /**
   * Cadence kinds: trigger alpha, magnitude scaling AND expiry fade already
   * baked in (they are re-created every cadence anyway). `slow`: the
   * *current* expiry fade alone (0..1), meant to be assigned to
   * `TrailHandle.view.alpha` every frame — the trail's own creation alpha is
   * the fixed `SLOW_TRAIL_ALPHA`, applied once inside `createStatusAura` and
   * never re-read from this spec.
   */
  alpha: number;
}

export interface RingAuraSpec extends BaseAuraSpec {
  type: 'damageReduction' | 'shield';
  kind: 'ring';
  startRadius: number;
  maxRadius: number;
  filled: boolean;
  lineWidth: number;
}

export interface BurstAuraSpec extends BaseAuraSpec {
  type: 'damageBuff';
  kind: 'burst';
  count: number;
  speed: number;
  spread: number;
  particleRadius: number;
}

export interface TrailAuraSpec extends BaseAuraSpec {
  type: 'slow';
  kind: 'trail';
  width: number;
  pointCount: number;
}

/** Pure visual parameters for one (effect type, entity, moment) triple —
 *  discriminated by `kind` so each primitive's params are fully required. */
export type StatusAuraSpec = RingAuraSpec | BurstAuraSpec | TrailAuraSpec;

const clampExpiryFade = (msRemaining: number): number => {
  if (!Number.isFinite(msRemaining)) return 0;
  return Math.min(1, Math.max(0, msRemaining / AURA_EXPIRY_FADE_MS));
};

/** Pure, canvas-free: maps (type, entity radius, magnitude, time-to-live) to
 *  visual parameters. Called every frame — cheap, no allocation of display
 *  objects. `magnitude` is a 0-1 fraction except for `shield` (flat HP,
 *  `status-effect.ts:5`). `msRemaining` may be negative or non-finite; always
 *  clamps, never leaks `NaN` into a PixiJS alpha. */
export function statusAuraSpec(
  type: StatusEffectType,
  entityRadius: number,
  magnitude: number,
  msRemaining: number,
): StatusAuraSpec {
  const radius = entityRadius + AURA_BASE_GAP + AURA_SLOT_STEP * AURA_SLOT_INDEX[type];
  const expiryFade = clampExpiryFade(msRemaining);
  const color = AURA_COLORS[type];

  switch (type) {
    case 'damageReduction':
      return {
        type, kind: 'ring', color, radius,
        durationMs: DAMAGE_REDUCTION_DURATION_MS,
        cadenceMs: DAMAGE_REDUCTION_DURATION_MS,
        alpha: DAMAGE_REDUCTION_ALPHA_BASE * expiryFade,
        startRadius: radius + DAMAGE_REDUCTION_START_OFFSET,
        maxRadius: radius,
        filled: false,
        lineWidth: DAMAGE_REDUCTION_LINE_WIDTH_BASE *
          (DAMAGE_REDUCTION_LINE_WIDTH_FLOOR + DAMAGE_REDUCTION_LINE_WIDTH_MAGNITUDE_MULT * magnitude),
      };
    case 'shield':
      return {
        type, kind: 'ring', color, radius,
        durationMs: SHIELD_DURATION_MS,
        cadenceMs: SHIELD_DURATION_MS,
        alpha: SHIELD_ALPHA_BASE * Math.min(1, magnitude / SHIELD_REFERENCE_HP) * expiryFade,
        startRadius: radius - SHIELD_START_OFFSET,
        maxRadius: radius + SHIELD_END_OFFSET,
        filled: true,
        lineWidth: 0, // ignored by createRingShockwave when filled
      };
    case 'damageBuff':
      return {
        type, kind: 'burst', color, radius,
        durationMs: DAMAGE_BUFF_DURATION_MS,
        cadenceMs: DAMAGE_BUFF_DURATION_MS,
        alpha: Math.min(1, DAMAGE_BUFF_ALPHA_BASE *
          (DAMAGE_BUFF_ALPHA_FLOOR + DAMAGE_BUFF_ALPHA_MAGNITUDE_MULT * magnitude) * expiryFade),
        count: DAMAGE_BUFF_PARTICLE_COUNT,
        speed: radius / DAMAGE_BUFF_SPEED_DIVISOR,
        spread: DAMAGE_BUFF_SPREAD,
        particleRadius: DAMAGE_BUFF_PARTICLE_RADIUS,
      };
    case 'slow':
      return {
        type, kind: 'trail', color, radius,
        durationMs: SLOW_ORBIT_PERIOD_MS / 2,
        cadenceMs: 0,
        alpha: expiryFade,
        width: SLOW_WIDTH_BASE + SLOW_WIDTH_MAGNITUDE_MULT * magnitude,
        pointCount: SLOW_TRAIL_POINT_COUNT,
      };
  }
}

/** The orbit position driving the `slow` drag arc — a per-entity `phase`
 *  (drawn once at creation) keeps a pack of slowed enemies from sweeping in
 *  lockstep. Pure; `now` is the same clock as `VfxEngine.update`. */
export function slowOrbitPoint(
  x: number,
  y: number,
  radius: number,
  phase: number,
  now: number,
): { x: number; y: number } {
  const theta = phase + ((now % SLOW_ORBIT_PERIOD_MS) / SLOW_ORBIT_PERIOD_MS) * Math.PI * 2;
  return { x: x + Math.cos(theta) * radius, y: y + Math.sin(theta) * radius };
}

/**
 * Thin 4-branch switch (one per `StatusEffectType`, `damageReduction` and
 * `shield` both landing on `createRingShockwave`) — forwards `spec`'s values
 * to the one Story 7.1 primitive each type composes from. No geometry
 * authored here. `x`/`y` is the entity centre; for `slow` the initial orbit
 * point is derived internally from `phase` at a zero time-basis (a single
 * frame of drift versus the caller's own `now` is invisible — `moveTo`
 * immediately takes over with the real clock every frame after).
 */
export function createStatusAura(
  spec: StatusAuraSpec,
  x: number,
  y: number,
  phase: number,
): EffectHandle | TrailHandle {
  switch (spec.kind) {
    case 'ring':
      return createRingShockwave({
        x, y, color: spec.color, durationMs: spec.durationMs, alpha: spec.alpha,
        startRadius: spec.startRadius, maxRadius: spec.maxRadius, lineWidth: spec.lineWidth,
        filled: spec.filled,
      });
    case 'burst':
      return createParticleBurst({
        x, y, color: spec.color, durationMs: spec.durationMs, alpha: spec.alpha,
        count: spec.count, speed: spec.speed, spread: spec.spread, particleRadius: spec.particleRadius,
      });
    case 'trail': {
      const seed = slowOrbitPoint(x, y, spec.radius, phase, 0);
      return createTrail({
        x: seed.x, y: seed.y, color: spec.color, durationMs: spec.durationMs,
        alpha: SLOW_TRAIL_ALPHA, width: spec.width, pointCount: spec.pointCount,
      });
    }
  }
}

// ── DungeonScreen-side lifecycle types ──────────────────────────────────────
// Owned here (not declared inline in DungeonScreen.tsx) so the 1000+ line
// screen file only imports types instead of authoring them.

export interface StatusAuraHandle {
  /** `VfxEngine` id — the entry's only handle to remove it. */
  effectId: number;
  /** `handle.view` — for per-frame repositioning / alpha (trail only). */
  view: Container | null;
  /** Non-null only for `slow`; lets the caller check `TrailHandle.disposed`. */
  trail: TrailHandle | null;
  /** Next cadence re-trigger time; 0 for the persistent `slow` kind. */
  nextRetriggerAt: number;
}

export interface StatusAuraEntry {
  /** Per-entity orbit phase, drawn once with `Math.random()` at creation. */
  phase: number;
  auras: Map<StatusEffectType, StatusAuraHandle>;
}

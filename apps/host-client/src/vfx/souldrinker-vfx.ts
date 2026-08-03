import {
  ABILITY_GEOMETRY,
  PlayerClass,
  VOID_PULSE_ZONE_RADIUS_PX,
} from 'shared-types';
import { SOULDRINKER_PALETTE } from './ability-vfx-config';
import { VfxEngine } from './engine';
import { createBeam, createConeWedge, createParticleBurst, createRingShockwave } from './primitives';

/**
 * Souldrinker ability VFX — pure planners that emit serializable `VfxSpec`s plus
 * one thin `spawnSouldrinkerVfx` executor that translates each spec into the
 * matching `create*` primitive. Rendering only; no game logic, no clock reads,
 * no PixiJS import in the planners (so the test collects instantly and asserts on
 * the specs directly, Story 7.4 Task 8.1).
 *
 * The spatial hit geometry (hit range, hit radius, the Void Pulse chained-zone
 * radius) is imported live from the shared ability presentation contract in
 * `shared-types` (Story 7.9 / ADR-0003) — the same values the sim resolves hits
 * with, so a range/radius re-tune moves the VFX automatically instead of drifting
 * from a hand-copied literal. Colors, stroke widths, alphas, cosmetic beam
 * lengths and fade durations (which correspond to no real sim value) stay local.
 * The host never imports game-rules *logic*; only this shared spatial contract.
 * Colors are PixiJS numeric literals, never CSS strings.
 *
 * Every trigger in this story fires from the transient-delta / snapshot
 * `useEffect`s, which are NOT requestAnimationFrame-gated, so each call site
 * stamps `startedAt = Date.now()` and threads it through `spawnSouldrinkerVfx`
 * (BACKGROUNDED-TICKER rule, Story 7.2 review): an effect added with no start
 * while a hidden tab's ticker is stopped would otherwise pile up un-started and
 * fire all at once on resume. `Date.now()` matches `VfxEngine.update()`'s clock.
 */

// ── Palette: Souldrinker's blood/void register ───────────────────────────────
// Derived from the single palette definition in the PixiJS-free config module.
/** UX token `corruption-blood` — Blood Spike, Crimson Lash, lifesteal return. */
export const BLOOD = SOULDRINKER_PALETTE.blood;
/** Shade of `corruption-blood` — HP-cost droplets, Dark Pact's drain cone. */
export const BLOOD_DARK = SOULDRINKER_PALETTE.bloodDark;
/** UX token `accent-corruption` — Void Pulse, Dark Pact's buff-gained pulse. */
export const VOID = SOULDRINKER_PALETTE.corruption;
/** Shade of `accent-corruption` — pull-zone fill (spec for Story 7.8). */
export const VOID_DIM = SOULDRINKER_PALETTE.corruptionDim;

// ── Geometry, read live from the shared contract (Story 7.9 / ADR-0003, consolidated 3.27 / ADR-0006) ──
const SOULDRINKER_GEOMETRY = ABILITY_GEOMETRY[PlayerClass.SOULDRINKER]; // hitRangePx: [150, 180, 180, 0], hitRadiusPx: [50, 65, 80, 80]

// ── Cosmetic constants (no corresponding sim value — local to the visual) ────
const PLAYER_RADIUS = 24; // mirror of DungeonScreen's PLAYER_RADIUS (host-only)
/** Blood Spike's launch streak reach — a short cosmetic flourish, NOT the
 *  projectile's real range (the projectile body itself is Story 7.8's). */
const BLOOD_SPIKE_LAUNCH_LEN = 90;
/** Crimson Lash's three strokes fan ± half of the ability's real cone angle
 *  (Story 7.13 — previously a fixed, disconnected `0.30` rad / ~17.19°). */
const CRIMSON_LASH_FAN_RAD = (SOULDRINKER_GEOMETRY[1].coneAngleDeg ?? 0) / 2 * (Math.PI / 180);
/** Cosmetic stroke lengths — the centre stroke reaches slightly past the two
 *  side strokes. The *impact ring* is what tells the truth about reach (range). */
const CRIMSON_LASH_STROKE_LEN_MID = 205;
const CRIMSON_LASH_STROKE_LEN_SIDE = 185;

/** Correlation window for the classifier-driven Dark Pact cost/gain cue: an HP
 *  change is treated as a Dark Pact drain/transfer only within this long of a
 *  Souldrinker Dark Pact `ability:fired`. Keeps every other HP change (enemy
 *  melee, bond drain, Blood Spike self-cost/lifesteal) out of this story's lane. */
export const DARK_PACT_COST_CUE_WINDOW_MS = 400;

// ── Spec model ───────────────────────────────────────────────────────────────
// A serializable description of one primitive effect, in absolute coordinates.
// `spawnSouldrinkerVfx` maps each to a `create*` factory, adding the trigger-time
// `startedAt`. Kept data-only so the planner is pure and pairwise-comparable.

export type VfxSpec =
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
    }
  | {
      kind: 'cone';
      x: number; y: number; dirX: number; dirY: number; angleDeg: number;
      startRadius: number; maxRadius: number; lineWidth: number;
      filled: boolean; color: number; alpha: number; durationMs: number;
    };

const ring = (o: Omit<Extract<VfxSpec, { kind: 'ring' }>, 'kind' | 'filled'>): VfxSpec =>
  ({ kind: 'ring', filled: false, ...o });
const beam = (o: Omit<Extract<VfxSpec, { kind: 'beam' }>, 'kind'>): VfxSpec => ({ kind: 'beam', ...o });
const burst = (o: Omit<Extract<VfxSpec, { kind: 'burst' }>, 'kind'>): VfxSpec => ({ kind: 'burst', ...o });
const cone = (o: Omit<Extract<VfxSpec, { kind: 'cone' }>, 'kind'>): VfxSpec => ({ kind: 'cone', ...o });

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Cast planner (delta-driven, `ability:fired`) ─────────────────────────────

export interface CastInput {
  abilityIndex: number;
  casterX: number;
  casterY: number;
  /** Raw (un-normalized) aim vector from the delta; normalized here. */
  dirX: number;
  dirY: number;
  /** `clamp(hp / maxHp, 0, 1)`; only Crimson Lash reads it. */
  hpFraction: number;
}

/**
 * The primitive specs for one Souldrinker cast, or `[]` when nothing should
 * render.
 *
 * Returns `[]` for an unknown/non-integer `abilityIndex`, a non-finite spatial
 * input, and — crucially — a zero-length aim vector. All four Souldrinker
 * abilities are AUTO/RELEASE/projectile with a non-zero hit range or projectile
 * launch (none is a self-centred TAP), so the sim skips each on a zero direction
 * (`GameRoom.ts:2074` projectile guard, `:2203` hitscan guard, `handleDarkPact`
 * early-return). The host must not draw an effect the sim did not resolve — no
 * fallback flash either (SILENT rule, mirroring Story 7.2's Avalanche). Never
 * throws.
 */
export function planSouldrinkerCast(input: CastInput): VfxSpec[] {
  const { abilityIndex, casterX: px, casterY: py, dirX, dirY, hpFraction } = input;
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0 || abilityIndex > 3) return [];
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(dirX) || !Number.isFinite(dirY)) return [];
  const mag = Math.hypot(dirX, dirY);
  if (!(mag > 0)) return [];
  const dx = dirX / mag;
  const dy = dirY / mag;

  switch (abilityIndex) {
    case 0: return planBloodSpikeCast(px, py, dx, dy);
    case 1: return planCrimsonLashCast(px, py, dx, dy, hpFraction);
    case 2: return planDarkPactCast(px, py, dx, dy);
    case 3: return planVoidPulseCast(px, py);
    default: return [];
  }
}

// Blood Spike (0) — forward launch streak + outward dark self-cost droplets.
// Blood Spike always pays 10 HP on cast, so the self-cost cue is part of the
// cast plan (driven off `ability:fired`, not HP inference — Story 7.4 Task 4.2).
function planBloodSpikeCast(px: number, py: number, dx: number, dy: number): VfxSpec[] {
  return [
    beam({
      x: px + dx * PLAYER_RADIUS, y: py + dy * PLAYER_RADIUS,
      toX: px + dx * BLOOD_SPIKE_LAUNCH_LEN, toY: py + dy * BLOOD_SPIKE_LAUNCH_LEN,
      color: BLOOD, width: 3, alpha: 0.95, durationMs: 140,
    }),
    burst({
      x: px, y: py, color: BLOOD_DARK, count: 6, speed: 0.07, spread: 1.4,
      particleRadius: 3, alpha: 0.85, durationMs: 280,
    }),
  ];
}

// Crimson Lash (1) — a cone wedge reading the real 45° hit shape, plus three
// fanned claw strokes + a truthful impact ring at the real hit circle.
// Intensity scales with missing HP, matching the HP-scaled damage mechanic
// (a rendering read of broadcast state, not a damage calc). Story 7.13: the
// wedge was added after the re-angled beam fan alone didn't read as "a cone"
// in manual testing (live user feedback, 2026-07-30) — matches the treatment
// Stone Wall/Avalanche/Ancestor's Voice already get. Two layered wedges (fill
// + bright outline) since a single flat 0.3-alpha fill read as "hardly
// visible" in the same manual pass, round 3.
function planCrimsonLashCast(px: number, py: number, dx: number, dy: number, hpFraction: number): VfxSpec[] {
  const lowHp = 1 - (Number.isFinite(hpFraction) ? clamp01(hpFraction) : 1);
  const cx = px + dx * SOULDRINKER_GEOMETRY[1].hitRangePx;
  const cy = py + dy * SOULDRINKER_GEOMETRY[1].hitRangePx;
  const coneAngleDeg = SOULDRINKER_GEOMETRY[1].coneAngleDeg ?? 0;
  const specs: VfxSpec[] = [
    cone({
      x: px, y: py, dirX: dx, dirY: dy,
      angleDeg: coneAngleDeg,
      startRadius: 0, maxRadius: SOULDRINKER_GEOMETRY[1].hitRangePx,
      lineWidth: 0, filled: true, color: BLOOD, alpha: 0.6 + 0.2 * lowHp, durationMs: 160,
    }),
    cone({
      x: px, y: py, dirX: dx, dirY: dy,
      angleDeg: coneAngleDeg,
      startRadius: 0, maxRadius: SOULDRINKER_GEOMETRY[1].hitRangePx,
      lineWidth: 4, filled: false, color: BLOOD_DARK, alpha: 0.95, durationMs: 140,
    }),
  ];
  for (const k of [-1, 0, 1] as const) {
    const theta = k * CRIMSON_LASH_FAN_RAD;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const len = k === 0 ? CRIMSON_LASH_STROKE_LEN_MID : CRIMSON_LASH_STROKE_LEN_SIDE;
    specs.push(beam({
      x: px, y: py, toX: px + rx * len, toY: py + ry * len,
      color: BLOOD, width: (k === 0 ? 5 : 3) + 4 * lowHp, alpha: 0.55 + 0.45 * lowHp, durationMs: 220,
    }));
  }
  specs.push(ring({
    x: cx, y: cy, color: BLOOD, startRadius: 10, maxRadius: SOULDRINKER_GEOMETRY[1].hitRadiusPx,
    lineWidth: 3, alpha: 0.5 + 0.4 * lowHp, durationMs: 260,
  }));
  specs.push(burst({
    x: cx, y: cy, color: BLOOD, count: 6 + Math.round(6 * lowHp), speed: 0.12,
    spread: 0.9, particleRadius: 4, alpha: 1, durationMs: 300,
  }));
  return specs;
}

// Dark Pact (2) — one wide dark cone to the search reach + a static outline ring
// at the cone end (start == max radius = a fading outline). Always rendered,
// target found or not: the delta carries no target and the host must not stall.
function planDarkPactCast(px: number, py: number, dx: number, dy: number): VfxSpec[] {
  const ex = px + dx * SOULDRINKER_GEOMETRY[2].hitRangePx;
  const ey = py + dy * SOULDRINKER_GEOMETRY[2].hitRangePx;
  return [
    beam({ x: px, y: py, toX: ex, toY: ey, color: BLOOD_DARK, width: 9, alpha: 0.5, durationMs: 340 }),
    ring({
      x: ex, y: ey, color: BLOOD_DARK, startRadius: SOULDRINKER_GEOMETRY[2].hitRadiusPx, maxRadius: SOULDRINKER_GEOMETRY[2].hitRadiusPx,
      lineWidth: 2, alpha: 0.35, durationMs: 340,
    }),
  ];
}

// Void Pulse (3) — outward void ring sized to its own hit radius + a slow, heavy,
// non-explosive burst (contrast with Crimson Lash's fast spray). Self-centred at
// the caster; the projectile body + impact are separate triggers.
function planVoidPulseCast(px: number, py: number): VfxSpec[] {
  return [
    ring({
      x: px, y: py, color: VOID, startRadius: 8, maxRadius: SOULDRINKER_GEOMETRY[3].hitRadiusPx,
      lineWidth: 3, alpha: 0.8, durationMs: 260,
    }),
    burst({ x: px, y: py, color: VOID, count: 8, speed: 0.05, spread: 1.0, particleRadius: 4, alpha: 0.7, durationMs: 300 }),
  ];
}

// ── Impact planners (delta-driven, `projectile:hit`) ─────────────────────────

/**
 * Blood Spike's lifesteal return: a beam from the impact back to the caster plus
 * a blood ring that **implodes into** the caster (= HP returning). Spawn only
 * when the caster actually healed (owner present, not down, not spirit — the sim
 * skips the heal otherwise, `GameRoom.ts:1774`).
 *
 * The imploding ring is guaranteed **last** in the array so the caller can bound
 * it to one live effect per player (Task 4.6): `spawnSouldrinkerVfx` returns ids
 * in spec order, so `ids[ids.length - 1]` is the ring to cancel on re-trigger.
 */
export function planBloodSpikeImpact(input: { hitX: number; hitY: number; casterX: number; casterY: number }): VfxSpec[] {
  const { hitX, hitY, casterX, casterY } = input;
  return [
    beam({ x: hitX, y: hitY, toX: casterX, toY: casterY, color: BLOOD, width: 3, alpha: 0.9, durationMs: 260 }),
    ring({ x: casterX, y: casterY, color: BLOOD, startRadius: 64, maxRadius: 18, lineWidth: 5, alpha: 0.9, durationMs: 240 }),
  ];
}

/**
 * The minimal impact puff shown when Blood Spike hit but no heal landed (caster
 * missing / down / spirit) — so the shot's impact is not wholly invisible while
 * honestly promising no lifesteal.
 */
export function planBloodSpikeSplash(input: { hitX: number; hitY: number }): VfxSpec[] {
  return [burst({ x: input.hitX, y: input.hitY, color: BLOOD, count: 5, speed: 0.1, spread: 1.2, particleRadius: 3, alpha: 0.8, durationMs: 220 })];
}

/**
 * Void Pulse's impact: a void ring imploding from exactly the chained pull
 * zone's radius (150, from the shared contract) down to 20 — visually announcing
 * the pull field about to appear.
 */
export function planVoidPulseImpact(input: { hitX: number; hitY: number }): VfxSpec[] {
  return [ring({
    x: input.hitX, y: input.hitY, color: VOID, startRadius: VOID_PULSE_ZONE_RADIUS_PX, maxRadius: 20,
    lineWidth: 5, alpha: 0.9, durationMs: 320,
  })];
}

// ── Cue planners (snapshot / classifier-driven) ──────────────────────────────

/** Dark Pact's buff-gained cue on the caster: a bright void ring collapsing
 *  inward + a slow void burst. Distinct in color (void purple), direction
 *  (inward) and shape (ring) from the cost cue (dark red, outward, particles). */
export function planDamageBuffOnset(input: { x: number; y: number }): VfxSpec[] {
  return [
    ring({ x: input.x, y: input.y, color: VOID, startRadius: 76, maxRadius: 26, lineWidth: 4, alpha: 0.95, durationMs: 300 }),
    burst({ x: input.x, y: input.y, color: VOID, count: 8, speed: 0.05, spread: 0.8, particleRadius: 3, alpha: 0.8, durationMs: 300 }),
  ];
}

/** The shared HP-loss cue — dark droplets scattering outward = HP leaving. Used
 *  for Dark Pact's drained ally (the classifier-only case). */
export function planHpLossCue(input: { x: number; y: number }): VfxSpec[] {
  return [burst({ x: input.x, y: input.y, color: BLOOD_DARK, count: 8, speed: 0.09, spread: 1.6, particleRadius: 3, alpha: 0.9, durationMs: 320 })];
}

/** The opposed HP-gain cue — a bright blood ring collapsing inward = HP
 *  returning. Never the same shape/direction as the loss cue (AC3). */
export function planHpGainCue(input: { x: number; y: number }): VfxSpec[] {
  return [ring({ x: input.x, y: input.y, color: BLOOD, startRadius: 60, maxRadius: 16, lineWidth: 4, alpha: 0.85, durationMs: 260 })];
}

// ── Classifier (the only HP-direction logic in the story) ────────────────────

export interface HpChange {
  playerId: string;
  direction: 'gain' | 'loss';
  amount: number;
}

/**
 * Compare last frame's HP map against this frame's snapshot and report the sign
 * of each change. This is the *only* loss-vs-gain logic in the story; it decides
 * direction purely from the sign, importing no game rule.
 *
 * Players absent from `prev` (join / reconnect) yield no change — a first sight
 * seeds silently. Equal HP yields no change.
 */
export function classifyHpChanges(
  prev: ReadonlyMap<string, number>,
  next: readonly { id: string; hp: number }[],
): HpChange[] {
  const out: HpChange[] = [];
  for (const p of next) {
    const before = prev.get(p.id);
    if (before === undefined) continue;
    if (p.hp === before) continue;
    out.push({ playerId: p.id, direction: p.hp > before ? 'gain' : 'loss', amount: Math.abs(p.hp - before) });
  }
  return out;
}

// ── Executor (the only PixiJS-touching function here) ────────────────────────

/**
 * Translate each spec into its `create*` primitive and add it to the engine,
 * threading `startedAt` into every factory (BACKGROUNDED-TICKER rule). Returns
 * the effect ids in spec order, so a caller that needs to cancel one (e.g. the
 * Blood Spike lifesteal ring's per-player bound) can key off a known index.
 */
export function spawnSouldrinkerVfx(engine: VfxEngine, specs: readonly VfxSpec[], startedAt: number): number[] {
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
      case 'cone':
        ids.push(engine.add(createConeWedge({
          x: spec.x, y: spec.y, dirX: spec.dirX, dirY: spec.dirY, angleDeg: spec.angleDeg,
          startRadius: spec.startRadius, maxRadius: spec.maxRadius, lineWidth: spec.lineWidth,
          filled: spec.filled, color: spec.color, alpha: spec.alpha, durationMs: spec.durationMs, startedAt,
        })));
        break;
    }
  }
  return ids;
}

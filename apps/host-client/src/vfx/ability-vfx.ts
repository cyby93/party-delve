import { PlayerClass, ABILITY_GEOMETRY } from 'shared-types';
import type { StatusEffect } from 'shared-types';

/**
 * Ability → visual configuration, kept pure so the DungeonScreen delta handler
 * stays a thin dispatcher and the mapping/placement math is testable without a
 * canvas.
 *
 * The spatial geometry below (hit range / hit radius) is **imported live** from
 * the shared ability presentation contract in `shared-types`
 * (`ABILITY_GEOMETRY`, Story 7.9 / ADR-0003, consolidated 3.27 / ADR-0006) — the
 * same values the sim resolves hits with, so tuning a range/radius moves the VFX
 * automatically instead of drifting from a hand-copied literal (`D-7.2-A`). The
 * host still never imports game-rules *logic*; only this shared spatial contract.
 * Colors, stroke widths, alphas and cosmetic fade durations stay local. Colors
 * are PixiJS numeric literals, never CSS strings.
 *
 * Story 7.2 fills in Stonehide only. 7.3-7.5 add their four entries each; every
 * class/index without an entry returns `null`, which is the single source of
 * truth for "fall back to the legacy ABILITY_FLASH_MS cast flash".
 */

// Stonehide's real hit geometry, read live from the shared contract (Story 7.9).
// Rule for `hitRangePx`, mirroring the sim's own `isDirectional = inputType !== 'TAP'`
// (GameRoom.ts:2185, combat.ts `isInHitZone`): a *directional* ability (RELEASE /
// AUTO) offsets its hit circle to `caster + aim × range`, so its VFX reads the
// contract range and tracks a re-tune. A *TAP* ability hits a circle on the caster
// and the sim ignores its range entirely, so its VFX uses a hard `0`.
//   slot 0 Stone Wall  — RELEASE → directional → reads STONEHIDE_GEOMETRY[0].hitRangePx
//   slot 1 Tremor Stomp — TAP     → hard 0 (sim ignores its range 160)
//   slot 2 Iron Skin    — TAP     → hard 0 (sim ignores its range)
//   slot 3 Avalanche    — AUTO    → directional → reads STONEHIDE_GEOMETRY[3].hitRangePx
// Radii always track the contract regardless of delivery.
const STONEHIDE_GEOMETRY = ABILITY_GEOMETRY[PlayerClass.STONEHIDE];

// ── Palette: Stonehide's earth register ──────────────────────────────────────
/** The `accent-warm` design token (#c07d35) — firelight/ochre. Impact color. */
export const STONEHIDE_OCHRE = 0xc07d35;
/** Darkened, desaturated `accent-warm` — kicked-up earth and debris. */
export const STONEHIDE_DUST = 0x8a6f4a;
/** The `border` token lightened for couch legibility — Iron Skin's mineral read. */
export const STONEHIDE_SLATE = 0x8f8aa0;

// ── Iron Skin persistent shell (read by DungeonScreen's renderFrame) ─────────
/** Radius of the shell's inner ring. Player radius is 24, so it clears the body.
 *
 *  Note the renderer strokes a second ring at `+ 5`, and the inner ring's own
 *  4 px stroke spans r 28-32 — so the shell as drawn reaches r 35.5, not 30, and
 *  does cross the status badge row (badges sit at y = -38 with radius 6, i.e.
 *  down to -32). Both rings are thin strokes and the badges are opaque fills
 *  drawn above them, so nothing is hidden; the earlier "2 px gap, never occludes"
 *  derivation counted only the inner ring and was wrong (code review 2026-07-22). */
export const IRON_SKIN_SHELL_RADIUS = 30;
/** The shell fades out over the final 400 ms of the effect's lifetime. */
export const IRON_SKIN_FADE_MS = 400;
/** Time constant of the shell's alpha "breathing", NOT its period: the renderer
 *  uses `|cos(now / this)|`, whose period is `π × 260 ≈ 817 ms` with a cusp at
 *  each zero crossing. Halve this to breathe twice as fast. */
export const IRON_SKIN_BREATHE_MS = 260;

// ── Config shape ─────────────────────────────────────────────────────────────

/** Where a handle is anchored: the caster's body, or the centre of the hit zone. */
export type VfxAnchor = 'caster' | 'hit';

export interface RingSpec {
  at: VfxAnchor;
  /** Radius at trigger. `startRadius > maxRadius` is an implode (supported: the
   *  primitive clamps radius at >= 0). */
  startRadius: number;
  maxRadius: number;
  /** Ignored when `filled`. Required rather than optional so the delta handler
   *  can spread the spec straight into the primitive under
   *  `exactOptionalPropertyTypes`. */
  lineWidth: number;
  filled: boolean;
  color: number;
  alpha: number;
  durationMs: number;
}

export interface BeamSpec {
  /** Origin distance from the caster along the aimed direction. 0 = the caster's
   *  body. Non-zero draws the beam from a point on the hit-circle rim, so the
   *  line never promises reach the sim does not have. */
  originOffsetPx: number;
  target: VfxAnchor;
  width: number;
  color: number;
  alpha: number;
  durationMs: number;
}

export interface BurstSpec {
  at: VfxAnchor;
  colors: readonly number[];
  count: number;
  /** px/ms. */
  speed: number;
  spread: number;
  particleRadius: number;
  alpha: number;
  durationMs: number;
}

export interface AbilityVfxConfig {
  /** The ability's real reach: `ABILITY_GEOMETRY[class][slot].hitRangePx` when the
   *  sim treats the cast as directional, otherwise 0 — TAP abilities hit a circle
   *  on the caster and ignore `hitRange` entirely (`GameRoom.ts:2186`, `combat.ts:42-63`). */
  hitRangePx: number;
  /** Composed in order ring -> beam -> burst. */
  rings: readonly RingSpec[];
  beam?: BeamSpec;
  burst?: BurstSpec;
}

// ── Stonehide table ──────────────────────────────────────────────────────────
// Cooldowns [2000, 4000, 6000, 1000] ms bound each ability's total duration, so
// at most one instance per ability per player can ever be live (AC5).

const STONEHIDE_VFX: readonly AbilityVfxConfig[] = [
  // 0 — Stone Wall (RELEASE, hitRange 0, hitRadius 100, pull 40 px inward).
  // The only imploding effect in the kit: the ring starts at the real hit radius
  // and collapses onto the caster along the same vector the displacement pulls.
  {
    hitRangePx: STONEHIDE_GEOMETRY[0].hitRangePx, // directional RELEASE — reads the contract range (0 today → hits at caster)
    rings: [
      { at: 'caster', startRadius: STONEHIDE_GEOMETRY[0].hitRadiusPx, maxRadius: 26, lineWidth: 6, filled: false, color: STONEHIDE_DUST, alpha: 0.95, durationMs: 320 },
    ],
    beam: { originOffsetPx: STONEHIDE_GEOMETRY[0].hitRadiusPx, target: 'caster', width: 5, color: STONEHIDE_DUST, alpha: 0.8, durationMs: 260 },
    burst: {
      at: 'caster', colors: [STONEHIDE_DUST, STONEHIDE_OCHRE], count: 8,
      // Near-static (~13 px of travel) so the dust reads as ground breaking
      // underfoot rather than an outward blast contradicting the implode.
      speed: 0.04, spread: 1.2, particleRadius: 5, alpha: 0.9, durationMs: 320,
    },
  },
  // 1 — Tremor Stomp (TAP, hitRadius 60, slow 0.4). hitRangePx is a hard 0, not
  // STONEHIDE_GEOMETRY[1].hitRangePx (=160): a TAP ability hits a circle on the caster and the
  // sim ignores its hitRange entirely, so its 160 is dead data — a delivery
  // semantic, not geometry the VFX should read. Pure outward motion from the
  // body, the exact opposite vector of Stone Wall.
  {
    hitRangePx: 0,
    rings: [
      { at: 'caster', startRadius: 0, maxRadius: STONEHIDE_GEOMETRY[1].hitRadiusPx, lineWidth: 7, filled: false, color: STONEHIDE_OCHRE, alpha: 1, durationMs: 380 },
      { at: 'caster', startRadius: 0, maxRadius: STONEHIDE_GEOMETRY[1].hitRadiusPx, lineWidth: 0, filled: true, color: STONEHIDE_DUST, alpha: 0.35, durationMs: 260 },
    ],
    burst: {
      at: 'caster', colors: [STONEHIDE_OCHRE, STONEHIDE_DUST], count: 14,
      speed: 0.16, spread: 0.9, particleRadius: 6, alpha: 1, durationMs: 420,
    },
  },
  // 2 — Iron Skin (TAP, hitRange 0, hitRadius 120, damageReduction on self).
  // Cast moment only: armour snapping shut. The 3000 ms state itself is the
  // persistent shell in renderFrame, driven from GameState (AC4).
  {
    hitRangePx: 0, // TAP — sim ignores range, hits at caster (see the hitRangePx rule above the table)
    rings: [
      { at: 'caster', startRadius: STONEHIDE_GEOMETRY[2].hitRadiusPx, maxRadius: 30, lineWidth: 5, filled: false, color: STONEHIDE_SLATE, alpha: 0.9, durationMs: 300 },
    ],
  },
  // 3 — Avalanche (AUTO, 1000 ms CD, directional at range 200, hitRadius 50).
  // Translational motion, and deliberately the only effect with no particle
  // burst: it fires once a second for the whole run. Do not add sparks.
  {
    hitRangePx: STONEHIDE_GEOMETRY[3].hitRangePx, // 200 — directional reach, read live
    rings: [
      { at: 'hit', startRadius: 0, maxRadius: STONEHIDE_GEOMETRY[3].hitRadiusPx, lineWidth: 4, filled: false, color: STONEHIDE_OCHRE, alpha: 0.85, durationMs: 180 },
    ],
    beam: { originOffsetPx: 0, target: 'hit', width: 6, color: STONEHIDE_OCHRE, alpha: 0.75, durationMs: 140 },
  },
];

const CLASS_VFX: Partial<Record<PlayerClass, readonly AbilityVfxConfig[]>> = {
  [PlayerClass.STONEHIDE]: STONEHIDE_VFX,
};

/**
 * The bespoke visual for a cast, or `null` when the class/index has none yet —
 * `null` means "use the legacy ABILITY_FLASH_MS flash", which keeps every other
 * class's behaviour unchanged mechanically rather than by hand.
 *
 * Never throws: a malformed delta index returns `null` like any other miss.
 */
export function getAbilityVfxConfig(
  playerClass: PlayerClass | null,
  abilityIndex: number,
): AbilityVfxConfig | null {
  if (playerClass === null) return null;
  const table = CLASS_VFX[playerClass];
  if (!table) return null;
  if (!Number.isInteger(abilityIndex) || abilityIndex < 0 || abilityIndex >= table.length) return null;
  return table[abilityIndex] ?? null;
}

export interface AbilityVfxPlacement {
  casterX: number;
  casterY: number;
  /** Centre of the zone the server actually tests. Equals the caster for every
   *  ability whose `hitRangePx` is 0. */
  hitX: number;
  hitY: number;
  /** Normalized aim direction; `(0, 0)` when the cast carried no direction. */
  normX: number;
  normY: number;
}

/**
 * Project the caster + aim direction onto the ability's real hit geometry,
 * normalizing exactly the way the sim does (`GameRoom.ts:2108-2110`).
 *
 * Returns `null` for a zero-direction cast of a ranged ability: the sim skips
 * that hit outright (`GameRoom.ts:2203`) while still having broadcast the delta,
 * so the honest visual is none at all rather than a zero-length beam at the
 * caster's feet.
 */
export function resolveAbilityVfxPlacement(
  config: AbilityVfxConfig,
  casterX: number,
  casterY: number,
  directionX: number,
  directionY: number,
): AbilityVfxPlacement | null {
  const magnitude = Math.hypot(directionX, directionY);
  if (!(magnitude > 0)) {
    if (config.hitRangePx > 0) return null;
    return { casterX, casterY, hitX: casterX, hitY: casterY, normX: 0, normY: 0 };
  }
  const normX = directionX / magnitude;
  const normY = directionY / magnitude;
  return {
    casterX,
    casterY,
    hitX: casterX + normX * config.hitRangePx,
    hitY: casterY + normY * config.hitRangePx,
    normX,
    normY,
  };
}

/**
 * Composition contract with Story 7.6 (generic status-effect treatment).
 *
 * 7.2 owns Stonehide's Iron Skin cast-and-persist visual; 7.6 owns the generic
 * four-type status treatment. If 7.6 ships second, its `damageReduction` aura
 * must exclude players for which this predicate is true, or replace the shell
 * outright — never render both.
 */
export const ownsIronSkinShell = (p: {
  class: PlayerClass | null;
  statusEffects: readonly StatusEffect[];
}): boolean =>
  p.class === PlayerClass.STONEHIDE && p.statusEffects.some(e => e.type === 'damageReduction');

import { PlayerClass } from 'shared-types';
import type { ZoneState, PlayerState } from 'shared-types';

/**
 * Projectile-body and zone-body **appearance spec** — the 7.8 seam.
 *
 * Story 7.8 owns replacing the hardcoded white projectile circle
 * (`DungeonScreen.tsx` Projectiles block) and the hardcoded purple zone disc
 * (Zones block). Story 7.4 only *authors* the data 7.8 will read; it renders
 * none of it and edits neither `renderFrame` block, so 7.4 and 7.8 cannot
 * collide or double-implement.
 *
 * Deliberately **plain data — no PixiJS import** — so 7.8 (and any future class)
 * can import it without dragging in the effect executor. The trail sub-spec is
 * the argument shape for `createTrail`, but this file never calls it. Colors are
 * PixiJS numeric literals (`0xrrggbb`), never CSS strings.
 *
 * The shape is class-generic (`Record<PlayerClass, [4 entries]>`) with only
 * Souldrinker populated, so 7.2/7.3/7.5/7.8 extend it rather than fork it. If
 * 7.8 has already landed when a later Souldrinker change is picked up, add the
 * missing entries here instead of creating a second module.
 */

/** Souldrinker's blood/void palette — the single source of truth for the class's
 *  hues, re-exported as named constants by `souldrinker-vfx.ts`. Kept here (the
 *  PixiJS-free module) so both the effect planners and this appearance spec share
 *  one definition without either importing the other's dependencies. */
export const SOULDRINKER_PALETTE = {
  /** UX token `corruption-blood`. */
  blood: 0xc0392b,
  /** Shade of `corruption-blood`. */
  bloodDark: 0x7a2019,
  /** UX token `accent-corruption`. */
  corruption: 0x7d2dff,
  /** Shade of `accent-corruption`. */
  corruptionDim: 0x4a1a99,
} as const;

/** Stormcaller's storm-blue / white-hot register (Story 7.5), re-exported as
 *  named constants by `stormcaller-vfx.ts`. Kept here (the PixiJS-free module) so
 *  the cast planners and the Storm Eye zone visual below share one definition.
 *  Deliberately avoids the two reserved tokens `accent-purify` (0x90d8f0) and
 *  `accent-spirit` (0x6ea8d8), and today's flat zone purple (0x9b59b6). */
export const STORMCALLER_PALETTE = {
  /** White-hot filament — the bright inner line of every bolt / clap edge. */
  core: 0xeaf2ff,
  /** Electric blue — bolt glow, arc impact, Storm Eye tick pulse. */
  bolt: 0x8fb8ff,
  /** Violet charge — the heavier cooldown abilities (Tempest / Clap / Storm Eye). */
  charge: 0xb9a3ff,
  /** Dark storm slate — the Storm Eye zone body, so it reads as a weather cell. */
  slate: 0x3d4a6b,
} as const;

/** A layered circular projectile body: an opaque core inside a translucent halo,
 *  trailing a fading streak. All radii in px, durations in ms. */
export interface ProjectileAppearance {
  core: { radius: number; color: number; alpha: number };
  halo: { radius: number; color: number; alpha: number };
  /** `createTrail` arguments (Story 7.8 constructs the handle from these). */
  trail: { color: number; width: number; durationMs: number; pointCount: number };
}

/** A persistent field body: a filled disc, a rim stroke, and a per-tick inward
 *  pulse ring. `radius` is taken from `ZoneState.radius` at render time (7.8);
 *  `pulseMaxRadiusFactor` scales that radius for the inward pulse's inner bound. */
export interface ZoneAppearance {
  fill: { color: number; alpha: number };
  stroke: { color: number; alpha: number; width: number };
  /** Per-tick inward pulse — `createRingShockwave` from `radius` to
   *  `radius * pulseMaxRadiusFactor`, on the zone's own tick cadence. Whether
   *  7.8 drives that from `zone:tick` (not currently whitelisted) or a local
   *  timer seeded off `zone.expiresAtMs` is 7.8's call. */
  pulse: { color: number; alpha: number; lineWidth: number; durationMs: number; pulseMaxRadiusFactor: number };
}

const P = SOULDRINKER_PALETTE;

// Souldrinker's two projectile abilities. Slots 1 (Crimson Lash, hitscan) and 2
// (Dark Pact, hitscan) have no projectile body → null. Identity at render time:
// `ProjectileState.class === 'souldrinker' && abilityIndex === 0 | 3` (both
// fields exist on ProjectileState).
const SOULDRINKER_PROJECTILES: readonly (ProjectileAppearance | null)[] = [
  // 0 — Blood Spike
  {
    core: { radius: 6, color: P.blood, alpha: 1 },
    halo: { radius: 11, color: P.bloodDark, alpha: 0.4 },
    trail: { color: P.blood, width: 5, durationMs: 220, pointCount: 12 },
  },
  null, // 1 — Crimson Lash (hitscan)
  null, // 2 — Dark Pact (hitscan)
  // 3 — Void Pulse
  {
    core: { radius: 9, color: P.corruption, alpha: 1 },
    halo: { radius: 17, color: P.corruptionDim, alpha: 0.35 },
    trail: { color: P.corruption, width: 7, durationMs: 300, pointCount: 14 },
  },
];

/**
 * Per-class projectile appearance, keyed `class → [4 entries]`. A `null` entry
 * (or a class with no table) means "no bespoke projectile body — Story 7.8 keeps
 * the legacy white circle for it." Only Souldrinker is populated today.
 */
export const PROJECTILE_APPEARANCE: Partial<Record<PlayerClass, readonly (ProjectileAppearance | null)[]>> = {
  [PlayerClass.SOULDRINKER]: SOULDRINKER_PROJECTILES,
};

/**
 * Zone appearance, keyed by `effectType`. **`ZoneState` carries no
 * `class`/`abilityIndex`**, so 7.8 must derive Void Pulse's zone identity from
 * `effectType === 'pull'` **and** `players.find(p => p.id === zone.ownerId)?.class
 * === 'souldrinker'`. Adding a schema field is out of scope (it would trigger the
 * Contract-change hook for a rendering story). Today `'pull'` is only Void Pulse
 * and `'damage'` is only Storm Eye; a future pull ability would need a real
 * disambiguator, so this comment is the disambiguator of record.
 */
export const ZONE_APPEARANCE: Record<'pull', ZoneAppearance> = {
  pull: {
    fill: { color: P.corruptionDim, alpha: 0.18 },
    stroke: { color: P.corruption, alpha: 0.5, width: 2 },
    pulse: { color: P.corruption, alpha: 0.5, lineWidth: 2, durationMs: 400, pulseMaxRadiusFactor: 0.35 },
  },
};

// ── Zone-body render seam (Story 7.5 → Story 7.8) ────────────────────────────
/**
 * The flat appearance a `renderFrame` zone-body redraw consumes: a filled disc
 * plus an optional rim stroke. Deliberately a *different, flatter* shape than the
 * richer `ZONE_APPEARANCE` above — this one is what the zone-body draw call at the
 * render site actually spreads, with no per-tick `pulse` field (the Storm Eye tick
 * pulse is a separate `VfxEngine` effect layered above the body, not part of the
 * static shape). `pulseColor`/`pulseAlpha` are carried here purely as the contract
 * value the pulse effect reads, so a future consumer has one source for the hue.
 */
export interface ZoneVisual {
  fillColor: number;
  fillAlpha: number;
  rimColor?: number;
  rimWidth?: number;
  rimAlpha?: number;
  pulseColor?: number;
  pulseAlpha?: number;
}

/** Storm Eye's weather-cell body — a slate disc with an electric-blue rim, plus
 *  the tick-pulse hue. The exported half of the 7.8 seam. */
export const STORM_EYE_ZONE_VISUAL: ZoneVisual = {
  fillColor: STORMCALLER_PALETTE.slate,
  fillAlpha: 0.22,
  rimColor: STORMCALLER_PALETTE.bolt,
  rimWidth: 2,
  rimAlpha: 0.55,
  pulseColor: STORMCALLER_PALETTE.bolt,
  pulseAlpha: 0.7,
};

/** Today's exact zone body (`DungeonScreen.tsx` zone loop: `0x9b59b6 @ 0.25`, no
 *  rim). The regression guard for AC5/AC7 — every non-Storm-Eye zone keeps it,
 *  byte-identical, until Story 7.8 adds its own cases (e.g. Void Pulse `'pull'`). */
const DEFAULT_ZONE_VISUAL: ZoneVisual = { fillColor: 0x9b59b6, fillAlpha: 0.25 };

/**
 * The single place Storm Eye's zone identity is derived. `ZoneState` carries no
 * `class`/`abilityIndex` (the epic's 7.8 premise is wrong about that), so identity
 * comes from `effectType === 'damage'` **and** the owner resolving to a
 * Stormcaller — both signals required, so the helper stays correct if a future
 * class ever gains a `'damage'` zone. Owner not found (late join / reconnect
 * race) → `false`, never throws. No schema field is added.
 */
export function isStormEyeZone(zone: ZoneState, players: readonly PlayerState[]): boolean {
  if (zone.effectType !== 'damage') return false;
  return players.find(p => p.id === zone.ownerId)?.class === PlayerClass.STORMCALLER;
}

/**
 * Map a zone to its body appearance. Storm Eye → `STORM_EYE_ZONE_VISUAL`;
 * everything else → today's exact purple default. Story 7.8's job is adding
 * further cases here (Void Pulse, projectile bodies), not touching the call site.
 */
export function resolveZoneVisual(zone: ZoneState, players: readonly PlayerState[]): ZoneVisual {
  return isStormEyeZone(zone, players) ? STORM_EYE_ZONE_VISUAL : DEFAULT_ZONE_VISUAL;
}

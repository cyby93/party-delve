import {
  PlayerClass,
  ABILITY_HIT_RANGE_PX,
  ABILITY_HIT_RADIUS_PX,
  SPIRIT_NOVA_MAX_RADIUS_PX,
  SPIRIT_NOVA_DURATION_MS,
} from 'shared-types';
import { VfxEngine } from './engine';
import { createBeam, createParticleBurst, createRingShockwave, createTintPulse, type TintTarget } from './primitives';

/**
 * Spiritcaller ability VFX — pure planning/classification plus thin primitive
 * composers. Rendering only; no game logic. The spatial hit geometry (hit range,
 * hit radius, the Spirit Nova sweep) is imported live from the shared ability
 * presentation contract in `shared-types` (Story 7.9 / ADR-0003), so the effect
 * tracks the sim's real geometry instead of drifting from a hand-copied literal.
 * Colors, stroke widths, alphas, cosmetic accent radii and fallback durations
 * (which correspond to no real sim value) stay local. The host still never
 * imports game-rules *logic*; only this shared spatial contract.
 *
 * Ancestor's Voice / Spirit Nova / Warding Cry are delta-driven (`ability:fired`).
 * Soul Mend is channel-driven from `PlayerState.channelingAbility` and lives in
 * `DungeonScreen`'s `renderFrame`; its primitive composers are here too.
 */

// ── Palette (PixiJS numeric literals, never CSS strings) ─────────────────────
/** `accent-warm` — restoration/heal register. */
export const SPIRIT_HEAL = 0xc07d35;
/** `corruption-blood` — applied-harm register (darker than the enemy fill). */
export const SPIRIT_HARM = 0xc0392b;
/** `text-primary` pale — Spiritcaller's structural "ancestral breath" stroke. */
export const ANCESTOR_BONE = 0xd8d0e8;
/** `text-secondary` — a failed channel reads as "nothing happened", never damage. */
export const FIZZLE_ASH = 0xa89ec0;

// ── Geometry constants (derived live from the shared ability presentation
//    contract in shared-types, Story 7.9 / ADR-0003 — not transcribed) ─────────
const SPIRITCALLER_RANGE = ABILITY_HIT_RANGE_PX[PlayerClass.SPIRITCALLER];
const SPIRITCALLER_RADIUS = ABILITY_HIT_RADIUS_PX[PlayerClass.SPIRITCALLER];
export const ANCESTORS_VOICE_RANGE_PX = SPIRITCALLER_RANGE[0];    // real hit range 180
export const ANCESTORS_VOICE_RADIUS_PX = SPIRITCALLER_RADIUS[0];  // real hit radius 50
export const SPIRIT_NOVA_MAX_RADIUS_VFX_PX = SPIRIT_NOVA_MAX_RADIUS_PX; // visible sweep == real swept radius 220
export const SPIRIT_NOVA_DURATION_VFX_MS = SPIRIT_NOVA_DURATION_MS;     // sweep duration 600
// Soul Mend (slot 2, AIM_CAST) needs no host range constant: its channel VFX draws
// a beam to the *actual* downed ally the sim selected via findSoulMendTarget (which
// uses ABILITY_HIT_RANGE_PX.spiritcaller[2] = 200), so the visual tracks a range
// re-tune implicitly — the beam follows wherever the real target is.
export const WARDING_CRY_RADIUS_PX = SPIRITCALLER_RADIUS[3];      // real hit radius 90
// Cosmetic-only, no corresponding sim value: a fallback used when the state/delta
// carries no channel duration (prefer the real durationMs when present).
export const SOUL_MEND_CHANNEL_VFX_MS = 2500;
export const MAX_FACTION_ACCENTS_PER_CAST = 8;
export const FACTION_ACCENT_RADIUS_PX = 70;
export const FACTION_ACCENT_WINDOW_MS = 420;
export const SOUL_MEND_BEAM_INTERVAL_MS = 120;
export const SOUL_MEND_BEAM_FADE_MS = 240;
export const SHIELD_PULSE_INTERVAL_MS = 900;
export const SHIELD_PULSE_FADE_MS = 700;
const PLAYER_RADIUS = 24; // mirror of DungeonScreen's PLAYER_RADIUS (host-only constant)

// ── Pure planner ─────────────────────────────────────────────────────────────

export type SpiritcallerAbility = 'ancestors-voice' | 'spirit-nova' | 'warding-cry';

export interface SpiritcallerCastPlan {
  ability: SpiritcallerAbility;
  originX: number;
  originY: number;
  /** Hit-zone centre; equals origin for the self-centred TAP abilities. */
  focusX: number;
  focusY: number;
  /** Gating radius for best-effort per-target accents. */
  accentRadiusPx: number;
  /** Correlation window for best-effort per-target accents. */
  accentWindowMs: number;
}

const ABILITY_BY_INDEX: Record<0 | 1 | 3, SpiritcallerAbility> = {
  0: 'ancestors-voice',
  1: 'spirit-nova',
  3: 'warding-cry',
};

/**
 * The delta-driven cast plan, or `null` when nothing should render.
 *
 * Returns `null` for: a non-Spiritcaller caster; `abilityIndex === 2` (Soul Mend
 * is channel-driven, not delta-driven); any out-of-range/non-integer index; and
 * a zero-aim Ancestor's Voice (idx 0, directional at range 180) — the sim skips
 * that hit (`GameRoom.ts:2203`), so the host renders nothing and fires no flash
 * (SILENT rule). Spirit Nova (1) and Warding Cry (3) are self-centred, which the
 * sim fires regardless of aim, so they always plan with `focus === origin`.
 */
export function planSpiritcallerCast(
  caster: { class: PlayerClass | null; x: number; y: number },
  abilityIndex: number,
  directionX: number,
  directionY: number,
): SpiritcallerCastPlan | null {
  if (caster.class !== PlayerClass.SPIRITCALLER) return null;
  if (!Number.isInteger(abilityIndex)) return null;
  if (abilityIndex !== 0 && abilityIndex !== 1 && abilityIndex !== 3) return null;

  const ability = ABILITY_BY_INDEX[abilityIndex];
  const base = {
    ability,
    originX: caster.x,
    originY: caster.y,
    accentRadiusPx: FACTION_ACCENT_RADIUS_PX,
    // Spirit Nova's accents track its expanding ring edge, so its window must
    // cover the full visual sweep (600 ms), not the default 420 ms — otherwise
    // the cast is pruned from activeCasts before the ring reaches its outer band
    // and those targets never accent (code review 2026-07-23).
    accentWindowMs: ability === 'spirit-nova' ? SPIRIT_NOVA_DURATION_VFX_MS : FACTION_ACCENT_WINDOW_MS,
  };

  if (ability === 'ancestors-voice') {
    // Directional at range 180: mirror the sim's zero-aim skip exactly.
    const mag = Math.hypot(directionX, directionY);
    if (!(mag > 0)) return null;
    const nx = directionX / mag;
    const ny = directionY / mag;
    return {
      ...base,
      focusX: caster.x + nx * ANCESTORS_VOICE_RANGE_PX,
      focusY: caster.y + ny * ANCESTORS_VOICE_RANGE_PX,
    };
  }

  // Spirit Nova / Warding Cry: self-centred (hitRange 0), fire regardless of aim.
  return { ...base, focusX: caster.x, focusY: caster.y };
}

/** Sign of an HP change → faction accent kind, or `null` when unchanged. */
export function factionAccentFor(hpBefore: number, hpAfter: number): 'heal' | 'damage' | null {
  if (hpAfter > hpBefore) return 'heal';
  if (hpAfter < hpBefore) return 'damage';
  return null;
}

// ── Cast composers (delta-triggered → stamp startedAt, per the 7.2 rule) ─────

/**
 * Build and add the primitive handles for one delta-driven cast. `startedAt` is
 * the trigger-time `Date.now()` (BACKGROUNDED-TICKER rule, Story 7.2 review):
 * the delta `useEffect` is not rAF-gated, so effects must carry an absolute
 * start or they pile up un-started while a backgrounded tab's ticker is stopped.
 * `casterCircle` is the caster's own `Graphics` for the tint pulse (optional —
 * a tint pulse is skipped when it is absent, e.g. a late-join race).
 */
export function triggerSpiritcallerCast(
  engine: VfxEngine,
  plan: SpiritcallerCastPlan,
  startedAt: number,
  casterCircle: TintTarget | null,
): void {
  if (plan.ability === 'ancestors-voice') {
    engine.add(createBeam({
      x: plan.originX, y: plan.originY, toX: plan.focusX, toY: plan.focusY,
      color: ANCESTOR_BONE, width: 3, alpha: 0.55, durationMs: 220, startedAt,
    }));
    engine.add(createRingShockwave({
      x: plan.focusX, y: plan.focusY, color: SPIRIT_HEAL,
      startRadius: ANCESTORS_VOICE_RADIUS_PX, maxRadius: 18, lineWidth: 3,
      durationMs: 260, alpha: 0.9, startedAt,
    })); // implode = gather/mend
    engine.add(createRingShockwave({
      x: plan.focusX, y: plan.focusY, color: SPIRIT_HARM,
      startRadius: 0, maxRadius: ANCESTORS_VOICE_RADIUS_PX, lineWidth: 2,
      durationMs: 260, alpha: 0.8, startedAt,
    })); // expand = strike, ends ON the real hit radius
    engine.add(createParticleBurst({
      x: plan.focusX, y: plan.focusY, color: [SPIRIT_HEAL, ANCESTOR_BONE],
      count: 6, speed: 0.09, spread: 0.9, particleRadius: 3, durationMs: 300, startedAt,
    }));
    return;
  }

  if (plan.ability === 'spirit-nova') {
    engine.add(createRingShockwave({
      x: plan.originX, y: plan.originY, color: SPIRIT_HARM,
      startRadius: 0, maxRadius: SPIRIT_NOVA_MAX_RADIUS_VFX_PX, lineWidth: 5,
      durationMs: SPIRIT_NOVA_DURATION_VFX_MS, alpha: 0.85, startedAt,
    })); // leading edge == real swept radius
    engine.add(createRingShockwave({
      x: plan.originX, y: plan.originY, color: SPIRIT_HEAL,
      startRadius: 0, maxRadius: SPIRIT_NOVA_MAX_RADIUS_VFX_PX - 30, lineWidth: 8,
      durationMs: SPIRIT_NOVA_DURATION_VFX_MS, alpha: 0.5, startedAt,
    })); // warm halo trailing 30 px inside the real swept edge (cosmetic)
    engine.add(createParticleBurst({
      x: plan.originX, y: plan.originY, color: [SPIRIT_HEAL, SPIRIT_HARM, ANCESTOR_BONE],
      count: 16, speed: 0.28, spread: 0.7, particleRadius: 5,
      durationMs: SPIRIT_NOVA_DURATION_VFX_MS, startedAt,
    }));
    if (casterCircle) {
      engine.add(createTintPulse({
        target: casterCircle, color: ANCESTOR_BONE, durationMs: 300, minAlpha: 0.45, maxAlpha: 1, startedAt,
      })); // replaces the generic flash
    }
    return;
  }

  // warding-cry
  engine.add(createRingShockwave({
    x: plan.originX, y: plan.originY, color: SPIRIT_HEAL,
    // Cosmetic overshoot: starts wide and snaps inward onto the real shield radius.
    startRadius: WARDING_CRY_RADIUS_PX + 60, maxRadius: WARDING_CRY_RADIUS_PX, lineWidth: 6,
    durationMs: 420, alpha: 0.9, startedAt,
  }));
  engine.add(createRingShockwave({
    x: plan.originX, y: plan.originY, color: ANCESTOR_BONE,
    startRadius: WARDING_CRY_RADIUS_PX, maxRadius: WARDING_CRY_RADIUS_PX + 6, lineWidth: 2,
    durationMs: 420, alpha: 0.6, startedAt,
  }));
  if (casterCircle) {
    engine.add(createTintPulse({
      target: casterCircle, color: ANCESTOR_BONE, durationMs: 260, minAlpha: 0.5, maxAlpha: 1, startedAt,
    }));
  }
}

/** One small per-target faction burst (best-effort mixed-faction accent). */
export function triggerFactionAccent(
  engine: VfxEngine,
  kind: 'heal' | 'damage',
  x: number,
  y: number,
  startedAt: number,
): void {
  engine.add(createParticleBurst({
    x, y, color: kind === 'heal' ? SPIRIT_HEAL : SPIRIT_HARM,
    count: 5, speed: 0.06, spread: 0.8, particleRadius: 4, durationMs: 260, startedAt,
  }));
}

// ── Soul Mend composers (ticker-driven → lazy startedAt is safe) ─────────────

/**
 * Channel-start rings: an imploding progress ring on the target + a bloom on the
 * caster. Returns the **progress-ring effect id** so the caller can cancel it on
 * an early termination (a 2500 ms ring must not keep imploding after a cancel).
 * On a normal completion the ring has already been reaped, so removing that id is
 * a safe no-op.
 */
export function triggerSoulMendStart(
  engine: VfxEngine,
  casterX: number, casterY: number,
  targetX: number, targetY: number,
  channelDurationMs: number,
): number {
  const progressRingId = engine.add(createRingShockwave({
    x: targetX, y: targetY, color: SPIRIT_HEAL,
    startRadius: 120, maxRadius: PLAYER_RADIUS, lineWidth: 4,
    durationMs: channelDurationMs, alpha: 0.9,
  })); // imploding radius == channel progress
  engine.add(createRingShockwave({
    x: casterX, y: casterY, color: ANCESTOR_BONE,
    startRadius: 30, maxRadius: 52, lineWidth: 2, durationMs: 300, alpha: 0.7,
  }));
  return progressRingId;
}

/** One warm link pulse from caster to target — re-triggered as both move. */
export function triggerSoulMendLink(
  engine: VfxEngine,
  casterX: number, casterY: number,
  targetX: number, targetY: number,
): void {
  engine.add(createBeam({
    x: casterX, y: casterY, toX: targetX, toY: targetY,
    color: SPIRIT_HEAL, width: 3, alpha: 0.7, durationMs: SOUL_MEND_BEAM_FADE_MS,
  }));
}

/** Terminal effect: a warm bloom on success, a dim ash fizzle on failure. */
export function triggerSoulMendTerminal(
  engine: VfxEngine,
  targetX: number, targetY: number,
  outcome: 'success' | 'fizzle',
): void {
  if (outcome === 'success') {
    engine.add(createParticleBurst({
      x: targetX, y: targetY, color: [SPIRIT_HEAL, ANCESTOR_BONE],
      count: 14, speed: 0.16, spread: 0.5, particleRadius: 6, durationMs: 520,
    }));
    engine.add(createRingShockwave({
      x: targetX, y: targetY, color: SPIRIT_HEAL,
      startRadius: PLAYER_RADIUS, maxRadius: 140, lineWidth: 4, durationMs: 520, alpha: 0.9,
    }));
    return;
  }
  engine.add(createParticleBurst({
    x: targetX, y: targetY, color: FIZZLE_ASH,
    count: 8, speed: 0.05, spread: 1.2, particleRadius: 4, durationMs: 300,
  }));
}

/** One contracting halo hugging a shielded entity — re-triggered on a slow cadence. */
export function triggerShieldPulse(engine: VfxEngine, x: number, y: number): void {
  engine.add(createRingShockwave({
    x, y, color: SPIRIT_HEAL,
    startRadius: PLAYER_RADIUS + 8, maxRadius: PLAYER_RADIUS + 2, lineWidth: 2,
    durationMs: SHIELD_PULSE_FADE_MS, alpha: 0.5,
  }));
}

/**
 * The persistent shield aura for one entity: a cadence-gated contracting halo,
 * at most one live pulse per entity (the D-7.1-D answer). Single named function
 * (Story 7.3 Task 7.2 / §7) so Story 7.6 can adopt it verbatim as its `shield`
 * case — the composition contract says exactly one shield treatment exists after
 * both ship. `pulseAt` is the per-entity next-allowed-pulse map (caller-owned so
 * it survives across frames and is cleared on unmount).
 */
export function renderShieldAura(
  engine: VfxEngine,
  pulseAt: Map<string, number>,
  entityId: string,
  x: number,
  y: number,
  now: number,
): void {
  const nextAt = pulseAt.get(entityId) ?? 0;
  if (now >= nextAt) {
    triggerShieldPulse(engine, x, y);
    pulseAt.set(entityId, now + SHIELD_PULSE_INTERVAL_MS);
  }
}

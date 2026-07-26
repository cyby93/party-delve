import { BossPhase } from 'shared-types';

/**
 * Grassland boss attack/reaction VFX — pure planner mapping a boss delta to a
 * PixiJS-free descriptor list. Story 7.7b.
 *
 * `BossVfxInput` is a **structural** type (not imported from `net-protocol`) so
 * this module compiles whether or not Story 7.7a's `BossChargedDelta` has
 * landed on `DeltaEventMsg` (Dev Notes → "Dependency on 7.7a"). It never
 * imports `pixi.js`, `net-protocol`, or `packages/game-rules` — the balance
 * numbers referenced in comments below were consulted at authoring time only;
 * the stomp radius arrives on the delta, every other number here is a visual
 * constant.
 */

export type BossVfxInput =
  | { type: 'boss:charged'; x: number; y: number }
  | { type: 'boss:stomped'; x: number; y: number; radius: number }
  | { type: 'boss:phaseChanged'; newPhase: BossPhase }
  | { type: 'boss:damaged' };

export interface BossVfxContext {
  bossX: number;
  bossY: number;
  prevX: number;
  prevY: number;
}

// ── Descriptor union ──────────────────────────────────────────────────────────
// Keeps the planner pure and testable while the pixi factories stay at the call
// site (DungeonScreen.tsx's applyBossVfxPlan). `tint` names its target
// symbolically ('boss') so this module never touches a Container.

export type VfxDescriptor =
  | { kind: 'ring'; x: number; y: number; color: number; startRadius: number; maxRadius: number; lineWidth: number; durationMs: number; alpha: number }
  | { kind: 'beam'; x: number; y: number; toX: number; toY: number; color: number; width: number; durationMs: number; alpha: number }
  | { kind: 'burst'; x: number; y: number; color: readonly number[]; count: number; speed: number; spread: number; particleRadius: number; durationMs: number; alpha: number }
  | { kind: 'tint'; target: 'boss'; color: number; durationMs: number; minAlpha: number; maxAlpha: number };

// ── Constants ──────────────────────────────────────────────────────────────────

export const BOSS_RADIUS_PX = 48; // mirrors DungeonScreen.tsx boss main circle
export const BOSS_PHASE2_GLOW_RADIUS_PX = 56; // mirrors DungeonScreen.tsx phase-2 glow ring

/** Legibility length of the charge streak — NOT the ~11.7px real per-tick
 *  displacement (`BOSS_CHARGE_SPEED (350) * dt (1/30)`). See Dev Notes → "The
 *  charge is post-hoc". Never "fix" this to match the real displacement —
 *  that would shrink the streak to an invisible smear and delete the effect. */
export const BOSS_CHARGE_STREAK_PX = 160;
export const BOSS_CHARGE_MIN_DISPLACEMENT_PX = 1;
export const BOSS_CHARGE_BEAM_MS = 320;
export const BOSS_CHARGE_BURST_MS = 380;

export const BOSS_STOMP_RING_MS = 420; // was a raw 66ms Graphics ring — ~4 frames, unreadable at couch distance
export const BOSS_STOMP_BURST_MS = 500;

export const BOSS_PHASE_IMPLODE_START_PX = 320;
export const BOSS_PHASE_IMPLODE_MS = 700;
export const BOSS_PHASE_TINT_MS = 600;

export const BOSS_DAMAGE_BURST_MS = 260;
/** Call-site throttle: `boss:damaged` is the only unbounded-rate trigger in
 *  this story (D-7.1-D response). Cosmetic render throttle only — never gates
 *  state, HP bookkeeping, or the HUD damage number. */
export const BOSS_DAMAGE_VFX_MIN_INTERVAL_MS = 120;

export const VFX_CORRUPTION = 0x7d2dff; // accent-corruption — the boss's own color
export const VFX_BLOOD = 0xc0392b; // corruption-blood — injury / danger
export const VFX_WARM = 0xc07d35; // accent-warm — kicked-up ground
export const VFX_PHASE3 = 0xff2222; // matches the existing phase-3 eye, DungeonScreen.tsx

/**
 * Map one boss delta to its render-ready effect descriptors. Pure, throws
 * never. `ctx` supplies boss position (and, for the charge case, the
 * pre-charge position used only to derive direction — see Dev Notes).
 */
export function planBossVfx(input: BossVfxInput, ctx: BossVfxContext): VfxDescriptor[] {
  switch (input.type) {
    case 'boss:charged':
      return planBossCharged(input, ctx);
    case 'boss:stomped':
      return planBossStomped(input);
    case 'boss:phaseChanged':
      return planBossPhaseChanged(input, ctx);
    case 'boss:damaged':
      return planBossDamaged(ctx);
  }
}

// `boss:charged` — a post-hoc dash visual. Honesty clause (AC1, binding): this
// is NOT a telegraph/windup/warning — the sim event describes a charge that has
// already happened, in the same tick it moved the boss. See Dev Notes → "The
// charge is post-hoc" for why only *direction* (not distance) is drawn, and why
// `ctx.prevX/prevY` (the pre-charge position) is safe to diff against.
function planBossCharged(input: { x: number; y: number }, ctx: BossVfxContext): VfxDescriptor[] {
  const { x, y } = input;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(ctx.prevX) || !Number.isFinite(ctx.prevY)) return [];
  const dx = x - ctx.prevX;
  const dy = y - ctx.prevY;
  const dist = Math.hypot(dx, dy);

  const burst: VfxDescriptor = {
    kind: 'burst',
    x, y,
    color: [VFX_CORRUPTION, VFX_BLOOD],
    count: 10, speed: 0.22, spread: 0.9, particleRadius: 5,
    durationMs: BOSS_CHARGE_BURST_MS, alpha: 0.9,
  };

  // Degenerate displacement: no direction to draw. No beam, no NaN, no
  // zero-length line — burst only.
  if (!(dist >= BOSS_CHARGE_MIN_DISPLACEMENT_PX)) return [burst];

  const ux = dx / dist;
  const uy = dy / dist;
  const originX = x - ux * BOSS_CHARGE_STREAK_PX;
  const originY = y - uy * BOSS_CHARGE_STREAK_PX;

  return [
    { kind: 'beam', x: originX, y: originY, toX: x, toY: y, color: VFX_CORRUPTION, width: 14, durationMs: BOSS_CHARGE_BEAM_MS, alpha: 0.75 },
    burst,
  ];
}

// `boss:stomped` — replaces the raw 66ms Graphics ring. `radius` MUST come
// from the delta (BOSS_STOMP_RADIUS = 280 in game-rules, never hardcoded here).
function planBossStomped(input: { x: number; y: number; radius: number }): VfxDescriptor[] {
  const { x, y, radius } = input;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) return [];
  return [
    { kind: 'ring', x, y, color: VFX_BLOOD, startRadius: BOSS_RADIUS_PX, maxRadius: radius, lineWidth: 8, durationMs: BOSS_STOMP_RING_MS, alpha: 0.9 },
    { kind: 'burst', x, y, color: [VFX_BLOOD, VFX_WARM], count: 12, speed: 0.30, spread: 0.6, particleRadius: 6, durationMs: BOSS_STOMP_BURST_MS, alpha: 0.85 },
  ];
}

// `boss:phaseChanged` — today renders nothing. An inward-collapsing ring
// (implode: maxRadius < startRadius, explicitly safe per primitives.ts) that
// terminates on the phase-2 glow ring radius, plus a tint pulse handing off to
// the persistent glow the caller's `bossPhaseRef` switches on.
function planBossPhaseChanged(input: { newPhase: BossPhase }, ctx: BossVfxContext): VfxDescriptor[] {
  const phaseColor = input.newPhase === BossPhase.Phase3 ? VFX_PHASE3 : VFX_CORRUPTION;
  return [
    {
      kind: 'ring', x: ctx.bossX, y: ctx.bossY, color: phaseColor,
      startRadius: BOSS_PHASE_IMPLODE_START_PX, maxRadius: BOSS_PHASE2_GLOW_RADIUS_PX,
      lineWidth: 6, durationMs: BOSS_PHASE_IMPLODE_MS, alpha: 0.85,
    },
    { kind: 'tint', target: 'boss', color: phaseColor, durationMs: BOSS_PHASE_TINT_MS, minAlpha: 0.45, maxAlpha: 1 },
  ];
}

// `boss:damaged` — small, cheap, throttled at the call site
// (BOSS_DAMAGE_VFX_MIN_INTERVAL_MS) since it is the only high-frequency
// trigger in this story. Does not replace the HUD damage number — it locates
// the hit on the canvas, which the HUD number cannot.
function planBossDamaged(ctx: BossVfxContext): VfxDescriptor[] {
  return [
    { kind: 'burst', x: ctx.bossX, y: ctx.bossY, color: [VFX_BLOOD], count: 6, speed: 0.14, spread: 0.8, particleRadius: 4, durationMs: BOSS_DAMAGE_BURST_MS, alpha: 0.9 },
  ];
}

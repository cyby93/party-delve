import type { Container } from 'pixi.js';

/**
 * A live effect owned by the VFX engine.
 *
 * Same shape as the create-on-first-seen / cleanup-on-missing pattern used for
 * players/enemies/tethers in DungeonScreen.tsx, except the "still alive?" test
 * is elapsed time instead of "still present in state".
 */
export interface EffectHandle {
  /** Display object the engine adds to / removes from the stage. `null` = the
   *  effect animates a display object it does not own (see tint-pulse). */
  readonly view: Container | null;
  /** Advance to `now`. Returns `false` once the effect is complete. */
  update(now: number): boolean;
  /** Release PixiJS resources. Called by the engine exactly once. */
  dispose(): void;
}

/** Minimal structural view of a PixiJS stage — keeps the engine testable without a renderer. */
export interface VfxStage {
  addChild(child: Container): unknown;
  removeChild(child: Container): unknown;
}

/**
 * Parameters every primitive accepts.
 *
 * CLOCK CONTRACT: primitives never read a clock themselves. An effect's lifetime
 * starts at the first `update(now)` the engine gives it, so whatever clock the
 * ticker uses (`Date.now()` in DungeonScreen.tsx, `performance.now()` elsewhere)
 * is automatically the effect's clock too. Pass `startedAt` only to backdate or
 * delay an effect — and then it MUST come from the same clock as `update(now)`.
 */
export interface VfxTriggerParams {
  x: number;
  y: number;
  /** PixiJS numeric color, e.g. `0x90d8f0` — never a CSS hex string. */
  color: number;
  durationMs: number;
  /** Peak alpha. Default 1. */
  alpha?: number;
  /** Explicit start time, in the same clock as `update(now)`. Defaults to the first `update`. */
  startedAt?: number;
}

/**
 * Elapsed fraction of an effect's lifetime, clamped to 0..1.
 * Non-finite inputs and non-positive durations report "complete" rather than
 * leaking `NaN` into geometry.
 */
export function progress(now: number, startedAt: number, durationMs: number): number {
  if (!(durationMs > 0) || !Number.isFinite(now) || !Number.isFinite(startedAt)) return 1;
  return Math.min(Math.max((now - startedAt) / durationMs, 0), 1);
}

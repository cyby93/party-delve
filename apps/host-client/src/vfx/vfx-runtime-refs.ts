import { useRef } from 'react';
import type { PlayerClass } from 'shared-types';
import type { SpiritcallerCastPlan } from './spiritcaller-vfx';
import type { AimPreviewState } from './aim-preview';

/**
 * Story 7.14b: the per-session VFX correlation state that both `HubWorldScreen`
 * and `DungeonScreen` need, extracted out of `DungeonScreen`'s eleven separate
 * `useRef` declarations so the hub does not have to duplicate them.
 *
 * These are all *runtime* maps, never PixiJS `Graphics` — display objects stay
 * owned by whichever screen created them, because their lifecycle is tied to
 * that screen's stage. What lives here is the bookkeeping that correlates
 * deltas with snapshots: which cast is inside its accent window, which
 * projectile belonged to which ability, what HP each entity had last frame.
 */

/** A Spiritcaller cast inside its best-effort mixed-faction accent window (Story 7.3). */
export interface ActiveCast extends SpiritcallerCastPlan {
  startedAt: number;
  accentsSpawned: number;
}

/** Live Soul Mend channel visual state (Story 7.3, Task 6). */
export interface SoulMendVisual {
  targetPlayerId: string;
  localStartedAt: number;
  durationMs: number;
  nextBeamAt: number;
  lastTargetX: number;
  lastTargetY: number;
  /** Cancel the imploding progress ring on early termination. */
  progressRingId: number;
}

export interface VfxRuntimeRefs {
  /** entityId -> last observed hp (Story 7.3 faction-accent correlation). */
  hpMemory: Map<string, number>;
  /** casterId -> cast inside its accent window. */
  activeCasts: Map<string, ActiveCast>;
  /** casterId -> channel visual state. */
  soulMend: Map<string, SoulMendVisual>;
  /** casterId -> observed terminal delta. */
  soulMendTerminal: Map<string, 'completed' | 'cancelled'>;
  /**
   * Story 7.4: projectileId -> its owning class/ability/owner, cached at
   * create-on-first-seen. `applyDelta` removes the projectile from `GameState`
   * on `projectile:hit`, so this cache is the only thing that survives to
   * identify the impact in the delta effect.
   */
  projectileMeta: Map<string, { class: PlayerClass; abilityIndex: number; ownerId: string }>;
  /**
   * Story 7.5: zoneId -> its last observed ticksRemaining + live pulse handle.
   * effectId -1 = "seen but not yet pulsed" (first sighting). The
   * remove-before-add on each tick boundary is AC4's one-live-pulse-per-zone
   * invariant.
   */
  stormEyePulse: Map<string, { ticksRemaining: number; effectId: number }>;
  /** Story 7.4: ownerId -> live lifesteal implode id (one per player). */
  lifestealEffectId: Map<string, number>;
  /** playerIds currently carrying damageBuff (onset diff). */
  buffedPlayers: Set<string>;
  /** playerId -> last observed hp (Dark Pact cost/gain classifier). */
  prevPlayerHp: Map<string, number>;
  /**
   * `Date.now()` of the last Souldrinker Dark Pact `ability:fired`. Boxed rather
   * than a bare number because the dispatch function must be able to write it —
   * this is the one piece of mutable scalar state in the bundle.
   */
  lastDarkPactCastAt: { value: number };
  /**
   * Story 7.15c: playerId -> their live in-progress aim. Host-local presentation
   * state, never written back into mirror state. Entries are refreshed by
   * `ability:aim-preview`, cleared on `ability:fired`, and otherwise expire by
   * staleness — the contract has no terminator, so absence is the only signal
   * that aiming stopped.
   */
  aimPreviews: Map<string, AimPreviewState>;
  /** Reset everything. Call from the screen's Pixi teardown. */
  clear(): void;
}

export function createVfxRuntimeRefs(): VfxRuntimeRefs {
  const refs: VfxRuntimeRefs = {
    hpMemory: new Map(),
    activeCasts: new Map(),
    soulMend: new Map(),
    soulMendTerminal: new Map(),
    projectileMeta: new Map(),
    stormEyePulse: new Map(),
    lifestealEffectId: new Map(),
    buffedPlayers: new Set(),
    prevPlayerHp: new Map(),
    lastDarkPactCastAt: { value: 0 },
    aimPreviews: new Map(),
    clear() {
      refs.hpMemory.clear();
      refs.activeCasts.clear();
      refs.soulMend.clear();
      refs.soulMendTerminal.clear();
      refs.projectileMeta.clear();
      refs.stormEyePulse.clear();
      refs.lifestealEffectId.clear();
      refs.buffedPlayers.clear();
      refs.prevPlayerHp.clear();
      refs.lastDarkPactCastAt.value = 0;
      refs.aimPreviews.clear();
    },
  };
  return refs;
}

/** Stable across renders — the maps are mutated in place, never replaced. */
export function useVfxRuntimeRefs(): VfxRuntimeRefs {
  const ref = useRef<VfxRuntimeRefs | null>(null);
  if (ref.current === null) ref.current = createVfxRuntimeRefs();
  return ref.current;
}

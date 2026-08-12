import { Graphics } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState, PlayerState } from 'shared-types';
import type { VfxEngine } from './engine';
import type { VfxRuntimeRefs } from './vfx-runtime-refs';
import { progress } from './types';
import type { EffectHandle } from './types';
import {
  statusAuraSpec, createStatusAura, slowOrbitPoint, MAX_STATUS_AURAS,
  type StatusAuraEntry, type StatusAuraHandle,
} from './status-aura';
import type { TrailHandle } from './primitives';
import {
  factionAccentFor, triggerFactionAccent, triggerSoulMendStart, triggerSoulMendLink, triggerSoulMendTerminal,
  SPIRIT_NOVA_MAX_RADIUS_VFX_PX, SPIRIT_NOVA_DURATION_VFX_MS, MAX_FACTION_ACCENTS_PER_CAST,
  SOUL_MEND_BEAM_INTERVAL_MS,
} from './spiritcaller-vfx';
import { spawnStormEyePulse, stormEyeTickCadence } from './stormcaller-vfx';
import { isStormEyeZone } from './ability-vfx-config';
import { pruneStaleAimPreviews, drawAimPreview } from './aim-preview';

/**
 * Story 7.14b: the snapshot-driven half of the VFX layer, extracted verbatim out
 * of `DungeonScreen.tsx`'s `renderFrame` so `HubWorldScreen.tsx` can run the same
 * per-frame passes.
 *
 * All four passes here are driven by `GameState`, not by deltas — which is why
 * they are correct after reconnect, late join, and batched-delta loss, and why
 * they must run every frame rather than on a delta event.
 *
 * In the hub, passes 1-3 are live (players carry `statusEffects`,
 * `channelingAbility` and `hp` there just as in a dungeon) and pass 4 is
 * naturally inert, because Story 7.14a leaves zone placement dungeon-only so
 * `state.zones` is always empty outside a run.
 */

// Story 7.6: warn at most once (never per-frame at 60fps) when MAX_STATUS_AURAS
// load-sheds a new status aura. Module-level so the once-only property holds
// across both screens rather than resetting when the screen changes.
let auraCeilingWarned = false;
function warnAuraCeiling(): void {
  if (auraCeilingWarned) return;
  auraCeilingWarned = true;
  console.warn(`[vfx] MAX_STATUS_AURAS (${MAX_STATUS_AURAS}) reached — shedding new status aura creation`);
}

export interface SnapshotVfxParams {
  state: GameState;
  app: Application;
  /** The single `Date.now()` for this frame — CLOCK CONTRACT (vfx/types.ts). */
  now: number;
  engine: VfxEngine;
  statusAuras: Map<string, StatusAuraEntry>;
  refs: VfxRuntimeRefs;
  playerRadius: number;
  enemyRadius: number;
  /** Story 7.15c: playerId -> the persistent Graphics its aim preview draws into. */
  aimPreviewGraphics: Map<string, Graphics>;
  /** Story 7.15c: the caster's session colour, so each preview is attributable. */
  colorForPlayer: (player: PlayerState) => number;
}

export function renderSnapshotVfx({
  state, app, now, engine, statusAuras, refs, playerRadius, enemyRadius,
  aimPreviewGraphics, colorForPlayer,
}: SnapshotVfxParams): void {
  // ── Aim previews (Story 7.15c) ─────────────────────────────────────────────
  // Persistent per-frame Graphics, not VfxEngine effects: an aim has no duration
  // and must follow a moving caster, so this is the bond-tether/status-aura
  // lifecycle (create on first sight, redraw every frame, destroy on absence)
  // rather than a fire-and-forget effect.
  //
  // Pruned FIRST, so a preview that went stale this frame is gone before the
  // draw loop rather than lingering one extra frame. `ability:fired` clears
  // entries directly in the dispatcher; this covers every other exit — release
  // without a cast, touch-cancel, a backgrounded phone, and the cooldown-rejected
  // cast (where the sim broadcasts no `ability:fired` either).
  pruneStaleAimPreviews(refs.aimPreviews, now);

  for (const [playerId, g] of aimPreviewGraphics) {
    if (!refs.aimPreviews.has(playerId)) {
      app.stage.removeChild(g);
      g.destroy();
      aimPreviewGraphics.delete(playerId);
    }
  }

  for (const [playerId, preview] of refs.aimPreviews) {
    const player = state.players.find(p => p.id === playerId);
    // A player who left, went down, or became a spirit is not aiming. Drop the
    // entry rather than just skipping the draw, so it cannot resurrect later.
    if (!player || player.isDown || player.isSpirit || player.isFrozen) {
      refs.aimPreviews.delete(playerId);
      // Destroy the Graphics here too, not on the next frame's sweep above:
      // otherwise a player who goes down mid-aim leaves a stale arrow drawn at
      // their old position for one frame (code review 2026-08-06).
      const orphan = aimPreviewGraphics.get(playerId);
      if (orphan) {
        app.stage.removeChild(orphan);
        orphan.destroy();
        aimPreviewGraphics.delete(playerId);
      }
      continue;
    }
    let g = aimPreviewGraphics.get(playerId);
    if (!g) {
      g = new Graphics();
      app.stage.addChildAt(g, 0); // below sprites, matching bond tethers and auras
      aimPreviewGraphics.set(playerId, g);
    }
    drawAimPreview(g, player, preview, colorForPlayer(player));
  }

  // ── Status effect auras (Story 7.6) ────────────────────────────────────────
  // Four shape-distinct, per-entity, persistent auras built entirely from the
  // Story 7.1 primitive library. Snapshot-driven only (AC4) — survives
  // reconnect, late join, batched-delta loss.
  const badgeTargets = [
    ...state.players.map(p => ({ id: p.id, x: p.x, y: p.y, radius: playerRadius, effects: p.statusEffects })),
    ...state.enemies.filter(e => e.isAlive).map(e => ({ id: e.id, x: e.x, y: e.y, radius: enemyRadius, effects: e.statusEffects })),
  ];

  const activeAuraIds = new Set(badgeTargets.filter(t => t.effects.length > 0).map(t => t.id));
  for (const [id, entry] of statusAuras) {
    if (!activeAuraIds.has(id)) {
      for (const handle of entry.auras.values()) engine.remove(handle.effectId);
      statusAuras.delete(id);
    }
  }

  const liveAuraCount = (): number => {
    let n = 0;
    for (const entry of statusAuras.values()) n += entry.auras.size;
    return n;
  };

  for (const target of badgeTargets) {
    if (target.effects.length === 0) continue;
    let entry = statusAuras.get(target.id);
    if (!entry) {
      // Math.random() is permitted here — cosmetic host-side effect only.
      entry = { phase: Math.random() * Math.PI * 2, auras: new Map() };
      statusAuras.set(target.id, entry);
    }

    const liveTypes = new Set(target.effects.map(e => e.type));
    for (const [type, handle] of entry.auras) {
      if (!liveTypes.has(type)) {
        engine.remove(handle.effectId);
        entry.auras.delete(type);
      }
    }

    for (const effect of target.effects) {
      const spec = statusAuraSpec(effect.type, target.radius, effect.magnitude, effect.expiresAtMs - now);
      let handle: StatusAuraHandle | undefined = entry.auras.get(effect.type);

      if (spec.kind === 'trail') {
        // Persistent handle: fed every frame, never re-created except when the
        // engine has reaped a stalled trail (disposed).
        if (!handle || handle.trail!.disposed) {
          if (liveAuraCount() >= MAX_STATUS_AURAS) {
            warnAuraCeiling();
            // Drop the stale bookkeeping entry rather than leaving a disposed
            // trail parked in the map: it would otherwise count against
            // liveAuraCount() forever (never re-checked once its type stays
            // active) while rendering nothing, ratcheting the shed ceiling
            // tighter every time it's hit instead of shedding only this frame.
            if (handle) entry.auras.delete(effect.type);
            continue;
          }
          const raw = createStatusAura(spec, target.x, target.y, entry.phase) as TrailHandle;
          const effectId = engine.add(raw);
          if (raw.view) app.stage.setChildIndex(raw.view, 0);
          handle = { effectId, view: raw.view, trail: raw, nextRetriggerAt: 0 };
          entry.auras.set(effect.type, handle);
        }
        const point = slowOrbitPoint(target.x, target.y, spec.radius, entry.phase, now);
        handle.trail!.moveTo(point.x, point.y, now);
        // createTrail.update never assigns view.alpha itself (primitives.ts),
        // so this composes cleanly on top of its per-segment fade.
        if (handle.view) handle.view.alpha = spec.alpha;
        continue;
      }

      // Cadence kinds (damageReduction/shield/damageBuff): re-trigger a fresh
      // handle on `spec.cadenceMs`; the outgoing pulse expires on its own
      // (cadenceMs === durationMs), so it is never explicitly removed — at most
      // one handoff frame of overlap. Reposition every frame in between.
      if (!handle || now >= handle.nextRetriggerAt) {
        if (liveAuraCount() >= MAX_STATUS_AURAS) {
          warnAuraCeiling();
          // Same rationale as the trail branch above: an expired-but-uncreated
          // handle must not linger in the map counting against the ceiling.
          if (handle) entry.auras.delete(effect.type);
          continue;
        }
        const raw = createStatusAura(spec, target.x, target.y, entry.phase) as EffectHandle;
        const effectId = engine.add(raw);
        if (raw.view) app.stage.setChildIndex(raw.view, 0);
        handle = { effectId, view: raw.view, trail: null, nextRetriggerAt: now + spec.cadenceMs };
        entry.auras.set(effect.type, handle);
      }
      handle.view?.position.set(target.x, target.y);
    }
  }

  // ── Spiritcaller: Soul Mend channel indicator (Story 7.3, Task 6) ───────────
  // State-driven (from player.channelingAbility), not delta-driven, so it is
  // correct after reconnect/late-join and immune to delta batching.
  const channelingIds = new Set(
    state.players.filter(p => p.channelingAbility !== null).map(p => p.id),
  );
  // Start a visual for each newly-channeling caster.
  for (const player of state.players) {
    const channel = player.channelingAbility;
    if (!channel || refs.soulMend.has(player.id)) continue;
    const target = state.players.find(p => p.id === channel.targetPlayerId);
    const tx = target ? (target.bodyX ?? target.x) : player.x;
    const ty = target ? (target.bodyY ?? target.y) : player.y;
    const progressRingId = triggerSoulMendStart(engine, player.x, player.y, tx, ty, channel.durationMs);
    refs.soulMend.set(player.id, {
      targetPlayerId: channel.targetPlayerId,
      localStartedAt: now, // host clock; never the server-epoch channel.startedAt (clock contract)
      durationMs: channel.durationMs,
      nextBeamAt: now + SOUL_MEND_BEAM_INTERVAL_MS,
      lastTargetX: tx,
      lastTargetY: ty,
      progressRingId,
    });
  }
  // Advance / terminate existing channel visuals.
  for (const [casterId, visual] of refs.soulMend) {
    const caster = state.players.find(p => p.id === casterId);
    const target = state.players.find(p => p.id === visual.targetPlayerId);
    if (target) {
      visual.lastTargetX = target.bodyX ?? target.x;
      visual.lastTargetY = target.bodyY ?? target.y;
    }
    const stillChanneling = channelingIds.has(casterId) && caster !== undefined;
    if (stillChanneling && caster) {
      // Re-trigger the link beam on its cadence, following both live positions.
      if (now >= visual.nextBeamAt) {
        triggerSoulMendLink(engine, caster.x, caster.y, visual.lastTargetX, visual.lastTargetY);
        visual.nextBeamAt = now + SOUL_MEND_BEAM_INTERVAL_MS;
      }
      continue;
    }
    // Terminated: pick the terminal effect. Prefer an observed cast delta, else
    // infer from the target's revived state (the load-bearing path — a
    // cast:completed usually collapses with player:revived under batching).
    const marker = refs.soulMendTerminal.get(casterId);
    let outcome: 'success' | 'fizzle';
    if (marker === 'completed') outcome = 'success';
    else if (marker === 'cancelled') outcome = 'fizzle';
    else outcome = target && !target.isDown ? 'success' : 'fizzle';
    // Cancel the imploding progress ring so it doesn't keep animating after an
    // early end (safe no-op if it already completed and was reaped).
    engine.remove(visual.progressRingId);
    triggerSoulMendTerminal(engine, visual.lastTargetX, visual.lastTargetY, outcome);
    refs.soulMendTerminal.delete(casterId);
    refs.soulMend.delete(casterId);
  }
  // Prune orphan terminal markers (code review 2026-07-23): a cast:completed /
  // cast:cancelled delta whose channel visual was already resolved by the isDown
  // inference — or was never created — leaves a marker with no live soulMend
  // entry. Without this it would leak unboundedly and, keyed by casterId,
  // mis-resolve this caster's NEXT channel (a fizzle painted as success). A
  // marker for a still-live visual is kept (consumed by the loop above).
  for (const id of [...refs.soulMendTerminal.keys()]) {
    if (!refs.soulMend.has(id)) refs.soulMendTerminal.delete(id);
  }

  // ── Spiritcaller: best-effort mixed-faction accents (Story 7.3, Task 5) ─────
  // A COSMETIC CORRELATION HEURISTIC, never a rule check: it reads only `hp`,
  // and may mis-attribute another source's HP change that overlaps a cast in
  // time and space, or miss a change that nets to zero in the window. Accents
  // are capped per cast. See Story 7.3 §5.
  for (const [casterId, cast] of [...refs.activeCasts]) {
    if (now - cast.startedAt > cast.accentWindowMs) refs.activeCasts.delete(casterId);
  }
  const anyActiveCast = refs.activeCasts.size > 0;
  const hpEntities: { id: string; x: number; y: number; hp: number }[] = [
    ...state.players.map(p => ({ id: p.id, x: p.x, y: p.y, hp: p.hp })),
    ...state.enemies.filter(e => e.isAlive).map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })),
  ];
  const liveEntityIds = new Set(hpEntities.map(e => e.id));
  for (const entity of hpEntities) {
    const before = refs.hpMemory.get(entity.id);
    refs.hpMemory.set(entity.id, entity.hp);
    if (before === undefined) continue; // seed silently — no accent on first sight / reconnect
    if (!anyActiveCast) continue;
    const kind = factionAccentFor(before, entity.hp);
    if (!kind) continue;
    for (const cast of refs.activeCasts.values()) {
      if (cast.accentsSpawned >= MAX_FACTION_ACCENTS_PER_CAST) continue;
      // Spirit Nova accents track the visible ring edge; the others use a fixed radius.
      const gate = cast.ability === 'spirit-nova'
        ? SPIRIT_NOVA_MAX_RADIUS_VFX_PX * progress(now, cast.startedAt, SPIRIT_NOVA_DURATION_VFX_MS)
        : cast.accentRadiusPx;
      const dx = entity.x - cast.focusX;
      const dy = entity.y - cast.focusY;
      if (dx * dx + dy * dy > gate * gate) continue;
      triggerFactionAccent(engine, kind, entity.x, entity.y - 8, now);
      cast.accentsSpawned++;
      break; // one accent per entity per frame
    }
  }
  // Prune HP memory for entities no longer present (leave, death) so a respawned
  // id re-seeds silently rather than firing a phantom accent.
  for (const id of [...refs.hpMemory.keys()]) {
    if (!liveEntityIds.has(id)) refs.hpMemory.delete(id);
  }

  // ── Stormcaller: Storm Eye zone tick pulse (Story 7.5, AC3/AC4) ─────────────
  // Snapshot-derived (from ZoneState.expiresAtMs + tickIntervalMs), not delta-
  // driven, so it is correct after reconnect/late-join and immune to delta
  // batching. Each decrement of the backwards-counted ticksRemaining is a real
  // tick boundary; on each, remove-before-add keeps at most one live pulse per
  // zone id (the concrete D-7.1-D answer for that story).
  //
  // Inert in the hub: Story 7.14a keeps zone placement dungeon-only, so
  // `state.zones` is empty there and both loops below no-op.
  const liveStormEyeIds = new Set<string>();
  for (const zone of state.zones) {
    if (!isStormEyeZone(zone, state.players)) continue;
    const cadence = stormEyeTickCadence(now, zone.expiresAtMs, zone.tickIntervalMs);
    if (!cadence) continue;
    liveStormEyeIds.add(zone.id);
    const prev = refs.stormEyePulse.get(zone.id);
    if (!prev) {
      // First sighting: record without pulsing (a zone seen mid-life on reconnect
      // must not fire a spurious pulse the instant it appears).
      refs.stormEyePulse.set(zone.id, { ticksRemaining: cadence.ticksRemaining, effectId: -1 });
      continue;
    }
    if (cadence.ticksRemaining < prev.ticksRemaining) {
      if (prev.effectId >= 0) engine.remove(prev.effectId);
      prev.effectId = spawnStormEyePulse(engine, zone, now);
    }
    // Re-baseline every frame (not only on a decrease): a backward Date.now()
    // step (host clock / NTP correction — Date.now() is not monotonic) can push
    // the observed ticksRemaining *up*; if the baseline only tracked decreases it
    // would latch stale-high and suppress pulses for several ticks. The pulse
    // still fires only on a genuine decrease above; the baseline just always
    // follows the latest observation (code review 2026-07-24).
    prev.ticksRemaining = cadence.ticksRemaining;
  }
  for (const [id, entry] of refs.stormEyePulse) {
    if (!liveStormEyeIds.has(id)) {
      if (entry.effectId >= 0) engine.remove(entry.effectId);
      refs.stormEyePulse.delete(id);
    }
  }
}

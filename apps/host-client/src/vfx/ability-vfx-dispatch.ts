import type { GameState } from 'shared-types';
import { PlayerClass, CLASS_DEFINITIONS } from 'shared-types';
import type { DeltaEventMsg } from 'net-protocol';
import type { VfxEngine } from './engine';
import type { VfxRuntimeRefs } from './vfx-runtime-refs';
import { createRingShockwave, createConeWedge, createBeam, createParticleBurst } from './primitives';
import type { TintTarget } from './primitives';
import { getAbilityVfxConfig, resolveAbilityVfxPlacement } from './ability-vfx';
import { planSpiritcallerCast, triggerSpiritcallerCast } from './spiritcaller-vfx';
import {
  planSouldrinkerCast, spawnSouldrinkerVfx, planBloodSpikeImpact, planBloodSpikeSplash, planVoidPulseImpact,
} from './souldrinker-vfx';
import {
  resolveStormcallerCast, spawnStormcallerCast, spawnStormcallerSpecs, planChainHitBeam, planTempestHurlImpact,
  spawnStormEyeStrike,
} from './stormcaller-vfx';

/**
 * Story 7.14b: the ability/cast delta → VFX dispatch, extracted verbatim out of
 * `DungeonScreen.tsx` so `HubWorldScreen.tsx` can drive the same per-class cast
 * visuals from the same deltas.
 *
 * Deliberately NOT included: boss branches (`applyBossVfxPlan`/`planBossVfx`),
 * which need the borrowed boss `Graphics` and have no hub counterpart, and the
 * non-VFX branches (bond overlay, level flash, damage numbers, essence flashes)
 * which are dungeon HUD concerns. Those stay in `DungeonScreen.tsx`.
 *
 * Which of these deltas actually arrive depends on session phase: Story 7.14a
 * broadcasts `ability:fired` everywhere but leaves projectile/zone/chain
 * resolution dungeon-only, so in the hub only `ability:fired` and the two
 * `cast:*` deltas are ever seen. The other branches are inert there rather than
 * guarded — there is nothing to guard against, since the deltas never come.
 */
export interface AbilityVfxDispatchContext {
  engine: VfxEngine | null;
  /** Current mirror state; may be null during the pre-first-snapshot window. */
  gameState: GameState | null;
  refs: VfxRuntimeRefs;
  /**
   * Fallback cast flash for the legacy path (no per-class planner, no config
   * entry, caster missing from state, or engine absent). A callback rather than
   * a field write because the two screens flash differently: `DungeonScreen`
   * uses a 300ms `ABILITY_FLASH_MS` curve on `PlayerEntry.flashUntil`, while
   * `HubWorldScreen` already uses a field of that exact name for its own 600ms
   * class-confirmation pulse. Writing a shared field would have truncated one
   * animation with the other's timing.
   */
  onCastFlash: (playerId: string) => void;
  /**
   * The caster's own sprite, for effects that tint it rather than drawing beside
   * it. Currently only Spirit Nova uses this: `triggerSpiritcallerCast` applies a
   * `createTintPulse` to the caster's `Graphics` which explicitly "replaces the
   * generic flash", so passing null silently drops that cast's caster-side visual.
   *
   * A callback for the same reason `onCastFlash` is one — the `Graphics` belongs
   * to whichever screen created it, and its lifetime is that screen's stage.
   * Screens with no per-player sprite to borrow may return null.
   */
  castTintTarget?: (playerId: string) => TintTarget | null;
}

/**
 * Resolve a target id (from a delta that carries no x/y of its own, e.g.
 * `zone:strike`'s `targetId` or `ability:chain-hit`'s `toEnemyId`) against the
 * current snapshot: an enemy first, then the boss by id. `null` when neither
 * matches — an already-dead/left target, stale by the time the delta renders —
 * so the caller can silently skip rather than throw.
 */
export function resolveEnemyOrBossPosition(
  targetId: string,
  gameState: GameState | null,
): { x: number; y: number } | null {
  const enemy = gameState?.enemies.find(e => e.id === targetId);
  if (enemy) return { x: enemy.x, y: enemy.y };
  if (gameState?.boss?.id === targetId) return { x: gameState.boss.position.x, y: gameState.boss.position.y };
  return null;
}

/**
 * Handle one transient delta. Returns `true` if this dispatcher owns the delta
 * type (so the caller can `continue`), `false` if the caller must handle it.
 */
export function dispatchAbilityVfx(delta: DeltaEventMsg, ctx: AbilityVfxDispatchContext): boolean {
  const { engine, gameState, refs } = ctx;

  switch (delta.type) {
    case 'ability:aim-preview': {
      // Story 7.15c: refresh this player's live aim. Presentation-only host state
      // — never written back into mirror state. Expiry is by staleness
      // (`pruneStaleAimPreviews`, called each frame) or by the `ability:fired`
      // clear below; the contract carries no terminator, so those are the only
      // two mechanisms that exist.
      // Conditional spread rather than assigning `undefined`: the repo runs with
      // `exactOptionalPropertyTypes: true`, so an absent target must be an absent
      // key, not a present key holding `undefined`. That distinction is exactly
      // what the renderer branches on to decide whether a destination ghost exists.
      refs.aimPreviews.set(delta.playerId, {
        abilityIndex: delta.abilityIndex,
        directionX: delta.directionX,
        directionY: delta.directionY,
        ...(delta.targetX !== undefined ? { targetX: delta.targetX } : {}),
        ...(delta.targetY !== undefined ? { targetY: delta.targetY } : {}),
        lastSeenAtMs: Date.now(),
      });
      return true;
    }

    case 'ability:fired': {
      const d = delta;
      // AbilityFiredDelta carries no class — resolve the caster from state.
      const caster = gameState?.players.find(p => p.id === d.playerId);

      // Story 7.15c AC4, refined by 7.15e: a cast ends the aim — but only for
      // RELEASE abilities, where firing genuinely means the thumb lifted.
      //
      // AUTO/AIM_CAST abilities are HELD. The player keeps aiming straight
      // through the cast at the next shot, so clearing here would blink their
      // arrow off once per cast: each delta arrives as its own message and
      // therefore its own dispatch pass, so the `ability:aim-preview` that
      // re-establishes the aim lands a frame later than this delete. For those
      // two input types the staleness window is the correct and only terminator
      // — it fires when the thumb actually lifts and the stream stops.
      //
      // Unknown caster (late join / reconnect race) falls through to clearing,
      // which is the safe default: a stale arrow is worse than a missing one.
      const firedInputType = caster?.class != null
        ? CLASS_DEFINITIONS[caster.class].abilities[d.abilityIndex]?.inputType
        : undefined;
      if (firedInputType !== 'AUTO' && firedInputType !== 'AIM_CAST') {
        // Cleared before this branch spawns the cast's own VFX, so a preview and
        // the cast visual never overlap for a frame.
        refs.aimPreviews.delete(d.playerId);
      }

      // Story 7.3: Spiritcaller owned delta-casts (idx 0/1/3) take the planner
      // path and never fall back to the cast flash (AC1). Soul Mend (idx 2) is
      // channel-driven and never emits ability:fired, so it is excluded here.
      if (caster && engine && caster.class === PlayerClass.SPIRITCALLER && d.abilityIndex !== 2) {
        const plan = planSpiritcallerCast(caster, d.abilityIndex, d.directionX, d.directionY);
        if (plan) {
          // Delta-triggered → stamp startedAt at trigger (BACKGROUNDED-TICKER rule).
          const triggeredAt = Date.now();
          triggerSpiritcallerCast(engine, plan, triggeredAt, ctx.castTintTarget?.(d.playerId) ?? null);
          // Register for the best-effort mixed-faction accent window (Task 5).
          refs.activeCasts.set(caster.id, { ...plan, startedAt: triggeredAt, accentsSpawned: 0 });
        }
        // plan === null → zero-aim Ancestor's Voice: SILENT (no effect, no flash).
        return true;
      }

      if (caster && engine && caster.class === PlayerClass.SOULDRINKER) {
        // Story 7.4: Souldrinker owned cast → suppress-and-replace (AC1, user
        // decision 2026-07-23). Never flash for any of the four abilities.
        // planSouldrinkerCast returns [] for a zero-aim cast (the sim skips it),
        // so rendering [] draws nothing: no VFX and no flash (SILENT rule).
        const triggeredAt = Date.now();
        const hpFraction = caster.maxHp > 0 ? Math.max(0, Math.min(1, caster.hp / caster.maxHp)) : 1;
        const souldrinkerSpecs = planSouldrinkerCast({
          abilityIndex: d.abilityIndex,
          casterX: caster.x, casterY: caster.y,
          dirX: d.directionX, dirY: d.directionY,
          hpFraction,
        });
        spawnSouldrinkerVfx(engine, souldrinkerSpecs, triggeredAt);
        // Dark Pact (idx 2): open the cost/gain-cue correlation window (Task 6.3),
        // but only when the cast actually resolved. A zero-aim Dark Pact returns []
        // (the sim skips it), so arming the window then would mislabel any coincident
        // HP change as Dark Pact's drain (code review 2026-07-24).
        if (d.abilityIndex === 2 && souldrinkerSpecs.length > 0) refs.lastDarkPactCastAt.value = triggeredAt;
        return true;
      }

      if (caster && engine && caster.class === PlayerClass.STORMCALLER) {
        // Story 7.5: Stormcaller owned cast → suppress-and-replace (AC1). Never
        // flash for any of the four abilities. resolveStormcallerCast returns null
        // for a zero-aim directional cast (Lightning Arc / Tempest Hurl / Storm
        // Eye) — the sim skipped that hit, so rendering nothing (no VFX, no flash)
        // is the honest result (SILENT rule). Thunder Clap (idx 2) always plans.
        const triggeredAt = Date.now();
        const plan = resolveStormcallerCast(d.abilityIndex, caster.x, caster.y, d.directionX, d.directionY);
        if (plan) {
          // Story 7.13: Tempest Hurl's cast plan carries no more flight — its real
          // body streams via the generic state.projectiles path and its impact is
          // driven by the projectile:hit handler below.
          spawnStormcallerCast(engine, plan, triggeredAt);
        }
        return true;
      }

      const cfg = caster ? getAbilityVfxConfig(caster.class, d.abilityIndex) : null;
      if (!cfg || !caster || !engine) {
        // Legacy path, unchanged: any class 7.3-7.5 has not reached yet; the
        // late-join/reconnect race where the caster is not in state; and the
        // engine being absent (a delta landing inside the await app.init()
        // window, or after teardown nulled the ref). That last case is an
        // implementation state, not a deliberate skip, so it still deserves
        // the cast flash (code review 2026-07-22).
        ctx.onCastFlash(d.playerId);
        return true;
      }

      const place = resolveAbilityVfxPlacement(cfg, caster.x, caster.y, d.directionX, d.directionY);
      // place === null: the sim skipped this cast's hit too (zero direction on
      // a ranged ability) — render nothing rather than lie. No flash either:
      // reviewed and kept spec-literal (Story 7.2 Task 3.4).
      if (!place) return true;

      // Stamped once at trigger rather than captured on the first update()
      // (code review 2026-07-22): the ticker stops with requestAnimationFrame on
      // a backgrounded tab while deltas keep arriving, so effects that never got
      // a first update() would pile up un-started and un-reaped, then all play at
      // once on resume. An absolute deadline self-expires instead.
      // Date.now() is mandatory here: it must match VfxEngine.update()'s clock.
      const triggeredAt = Date.now();
      const anchor = (at: 'caster' | 'hit') =>
        at === 'hit' ? { x: place.hitX, y: place.hitY } : { x: place.casterX, y: place.casterY };
      for (const ring of cfg.rings) {
        const { x, y } = anchor(ring.at);
        engine.add(createRingShockwave({
          x, y,
          color: ring.color,
          alpha: ring.alpha,
          durationMs: ring.durationMs,
          startedAt: triggeredAt,
          startRadius: ring.startRadius,
          maxRadius: ring.maxRadius,
          lineWidth: ring.lineWidth,
          filled: ring.filled,
        }));
      }
      if (cfg.cones) {
        // No independent zero-aim check here (Story 7.13 Dev Notes) — `place` is
        // already null for a zero-aim cast of any ability with hitRangePx > 0,
        // which is true of every cone ability today, so reaching this line
        // already guarantees normX/normY are non-zero. Layered wedges (fill +
        // bright outline) draw in array order, outline last so it reads crisply.
        for (const cone of cfg.cones) {
          engine.add(createConeWedge({
            x: place.casterX, y: place.casterY,
            dirX: place.normX, dirY: place.normY,
            angleDeg: cone.angleDeg,
            startRadius: cone.startRadius,
            maxRadius: cone.maxRadius,
            lineWidth: cone.lineWidth,
            filled: cone.filled,
            color: cone.color,
            alpha: cone.alpha,
            durationMs: cone.durationMs,
            startedAt: triggeredAt,
          }));
        }
      }
      if (cfg.beam) {
        const beam = cfg.beam;
        const target = anchor(beam.target);
        const originX = place.casterX + place.normX * beam.originOffsetPx;
        const originY = place.casterY + place.normY * beam.originOffsetPx;
        // A rim-anchored beam with no aim direction collapses to a point —
        // skip it rather than draw a zero-length line.
        if (beam.originOffsetPx === 0 || place.normX !== 0 || place.normY !== 0) {
          engine.add(createBeam({
            x: originX, y: originY,
            toX: target.x, toY: target.y,
            color: beam.color,
            alpha: beam.alpha,
            durationMs: beam.durationMs,
            startedAt: triggeredAt,
            width: beam.width,
          }));
        }
      }
      if (cfg.burst) {
        const burst = cfg.burst;
        const { x, y } = anchor(burst.at);
        engine.add(createParticleBurst({
          x, y,
          color: burst.colors,
          alpha: burst.alpha,
          durationMs: burst.durationMs,
          startedAt: triggeredAt,
          count: burst.count,
          speed: burst.speed,
          spread: burst.spread,
          particleRadius: burst.particleRadius,
        }));
      }
      return true;
    }

    case 'projectile:hit': {
      // Story 7.4: Souldrinker projectile impacts. projectileMeta is the only
      // surviving identity — applyDelta already removed the projectile from
      // gameState by the time this runs.
      const meta = refs.projectileMeta.get(delta.projectileId);
      if (meta && engine && meta.class === PlayerClass.SOULDRINKER) {
        const triggeredAt = Date.now();
        const { x: hitX, y: hitY } = delta;
        if (meta.abilityIndex === 0) {
          // Blood Spike lifesteal return. The heal lands only when the caster is
          // present, alive and not a spirit; otherwise show just the impact
          // splash so the visual never promises a heal that the sim skipped.
          const owner = gameState?.players.find(p => p.id === meta.ownerId);
          if (owner && !owner.isDown && !owner.isSpirit) {
            const prevId = refs.lifestealEffectId.get(meta.ownerId);
            if (prevId !== undefined) engine.remove(prevId); // one live implode per player (D-7.1-D)
            const ids = spawnSouldrinkerVfx(
              engine,
              planBloodSpikeImpact({ hitX, hitY, casterX: owner.x, casterY: owner.y }),
              triggeredAt,
            );
            refs.lifestealEffectId.set(meta.ownerId, ids[ids.length - 1]!); // implode ring is last by contract
          } else {
            spawnSouldrinkerVfx(engine, planBloodSpikeSplash({ hitX, hitY }), triggeredAt);
          }
        } else if (meta.abilityIndex === 3) {
          // Void Pulse impact — implodes from the chained pull-zone's radius,
          // announcing the pull field about to appear.
          spawnSouldrinkerVfx(engine, planVoidPulseImpact({ hitX, hitY }), triggeredAt);
        }
      } else if (meta && engine && meta.class === PlayerClass.STORMCALLER && meta.abilityIndex === 1) {
        // Story 7.13: Tempest Hurl's real impact — the only impact visual for
        // this ability now that the stale fake-flight ring is removed.
        spawnStormcallerSpecs(engine, planTempestHurlImpact({ hitX: delta.x, hitY: delta.y }), Date.now());
      }
      return true;
    }

    case 'ability:chain-hit': {
      // Story 7.13: Lightning Arc's chain-lightning VFX — one beam per hop, from
      // the delta's real fromX/fromY to the resolved toEnemyId (an enemy or the
      // boss). A toEnemyId resolving to neither (already-dead/left, stale by
      // render time) silently skips that hop's beam rather than throwing.
      const { fromX, fromY, toEnemyId, chainIndex } = delta;
      const target = resolveEnemyOrBossPosition(toEnemyId, gameState);
      if (engine && target) {
        // Chain visual pacing (judgment call, not an AC): stagger same-tick hops'
        // startedAt by chainIndex so each hop starts fading a little later than
        // the last — every beam still appears at full alpha on the same frame
        // (geometry/alpha are fixed at creation, and progress() clamps a
        // not-yet-reached startedAt to t=0), so the read is a staggered fade-out
        // across the chain. Guard: a non-finite chainIndex (code review
        // 2026-07-30, round 2) would NaN startedAt and silently drop this beam.
        const startedAt = Date.now() + (Number.isFinite(chainIndex) ? chainIndex * 40 : 0);
        spawnStormcallerSpecs(engine, [planChainHitBeam(fromX, fromY, target.x, target.y)], startedAt);
      }
      return true;
    }

    case 'zone:strike': {
      // Story 7.5 Task 6: Storm Eye's bonus-strike accent (decorative, NOT the AC3
      // tick path — that is the snapshot pulse in renderSnapshotVfx). The delta
      // carries no x/y, so resolve the target from the snapshot. Target-not-found
      // → silently skip. Delta-triggered → stamp Date.now() (clock contract).
      const target = resolveEnemyOrBossPosition(delta.targetId, gameState);
      if (engine && target) spawnStormEyeStrike(engine, target.x, target.y, Date.now());
      return true;
    }

    case 'cast:cancelled':
      // Story 7.3: record the terminal so renderSnapshotVfx picks the fizzle
      // effect. Often collapsed by batching — the isDown inference is the backstop.
      refs.soulMendTerminal.set(delta.casterId, 'cancelled');
      return true;

    case 'cast:completed':
      refs.soulMendTerminal.set(delta.casterId, 'completed');
      return true;

    default:
      return false;
  }
}

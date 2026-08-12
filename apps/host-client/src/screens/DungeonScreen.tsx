import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Assets, Text, TextStyle } from 'pixi.js';
import type { GameState, PlayerState } from 'shared-types';
import { SessionColor, CLASS_DEFINITIONS, PlayerClass, BossPhase, PURIFICATION_PULSE_DURATION_MS, REWARD_REVEAL_DURATION_MS } from 'shared-types';
import type { HostSession } from '../session/host-session';
import type { DeltaEventMsg } from 'net-protocol';
import {
  VfxEngine,
  createRingShockwave,
  createBeam,
  createParticleBurst,
  createTrail,
  createTintPulse,
  planBossVfx,
  BOSS_DAMAGE_VFX_MIN_INTERVAL_MS,
  type VfxDescriptor,
  spawnSouldrinkerVfx,
  planDamageBuffOnset,
  planHpLossCue,
  planHpGainCue,
  classifyHpChanges,
  DARK_PACT_COST_CUE_WINDOW_MS,
  resolveZoneVisual,
  resolveProjectileAppearance,
  type StatusAuraEntry,
  type TrailHandle,
  // Story 7.14b: the shared VFX wiring, also used by HubWorldScreen.
  useVfxRuntimeRefs,
  type VfxRuntimeRefs,
  dispatchAbilityVfx,
  renderSnapshotVfx,
} from '../vfx';

interface DungeonScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
  transientDeltaQueue: DeltaEventMsg[];
}

const SESSION_COLOR_HEX: Record<SessionColor, number> = {
  [SessionColor.RED]:    0xe74c3c,
  [SessionColor.BLUE]:   0x3498db,
  [SessionColor.GREEN]:  0x2ecc71,
  [SessionColor.YELLOW]: 0xf1c40f,
  [SessionColor.PURPLE]: 0x9b59b6,
  [SessionColor.ORANGE]: 0xe67e22,
  [SessionColor.PINK]:   0xff69b4,
  [SessionColor.TEAL]:   0x1abc9c,
};

const PLAYER_RADIUS = 24;
const ENEMY_RADIUS = 20;
const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;
const ABILITY_FLASH_MS = 300;
const SPIRIT_ABILITY_FLASH_MS = 200;
const KILL_FADE_MS = 300;
const ESSENCE_FLASH_MS = 400;
const DAMAGE_NUMBER_DURATION_MS = 700;
const DAMAGE_NUMBER_RISE_PX = 30;
const DAMAGE_NUMBER_Y_OFFSET = ENEMY_RADIUS + 24; // clears the health bar at -32
// Story 7.8 Task 6.2: the magic 1400 formerly inline in the purification-pulse ticker block.
const PURIFICATION_PULSE_MAX_RADIUS_PX = 1400;
// Story 7.8 Task 7.2: the reward-reveal particle burst's duration (was a local
// PARTICLE_DURATION_MS inside the old ticker block).
const REWARD_PARTICLE_DURATION_MS = 1000;
// Story 7.8 Task 8: bond tether restyle constants.
const BOND_TETHER_GLOW_WIDTH = 8;
const BOND_TETHER_CORE_WIDTH = 3;
const BOND_TETHER_BREATH_PERIOD_MS = 1800;

/** Parse a `BondState.color` CSS hex string (`'#6ea8d8'`) to a PixiJS numeric
 *  color. Guards the `NaN` case — `parseInt('zz', 16)` is `NaN`, and an
 *  unguarded `NaN` color reaches PixiJS today — falling back to `accent-spirit`,
 *  the established bond color. */
function parseCssHexColor(css: string, fallback: number): number {
  const parsed = parseInt(css.slice(1), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Story 7.14b: `resolveEnemyOrBossPosition` and `warnAuraCeiling` moved to
// vfx/ability-vfx-dispatch.ts and vfx/snapshot-vfx.ts respectively, alongside
// their only remaining call sites.

interface PlayerEntry {
  circle: Graphics;
  body: Graphics | null; // Story 3.21c: lazily created while isDown/isSpirit, destroyed when neither holds
  flashUntil: number;
}

interface EnemyEntry {
  circle: Graphics;
  healthBar: Graphics;
  deadUntil: number;  // 0 = alive; >0 = fading out
}

// Story 7.8: one persistent trail per live projectile, created on first-seen and
// fed every frame — never re-created per frame (D-7.1-D / Task 3.4-3.5).
interface ProjectileEntry {
  g: Graphics;
  trail: TrailHandle | null;
}

interface EssenceFlash {
  g: Graphics;
  deadline: number;
}

interface DamageNumberEntry {
  text: Text;
  spawnTime: number;
  startY: number;
}

/** The Epic 7 engine + correlation state threaded into renderFrame, extending
 *  the object rather than adding another positional param. Story 7.14b moved the
 *  correlation maps themselves into `VfxRuntimeRefs` (vfx/vfx-runtime-refs.ts) so
 *  HubWorldScreen can hold the same bundle without re-declaring eleven refs. */
interface VfxContext {
  engine: VfxEngine | null;
  refs: VfxRuntimeRefs;
}

/**
 * Translate a `planBossVfx` plan into live effects on `engine`. Lives here
 * (not in vfx/boss-vfx.ts) because it needs both the pixi factories and the
 * borrowed boss `Graphics` (Story 7.7b Task 7). Stamps `Date.now()` as every
 * primitive's `startedAt` (BACKGROUNDED-TICKER rule, Story 7.2 review — matches
 * `spawnSouldrinkerVfx`/`triggerSpiritcallerCast`): this is called from the
 * transient-delta `useEffect`, not from inside the RAF-gated ticker, so an
 * effect added with no explicit start would sit un-started while a hidden
 * tab's ticker is stopped and all fire at once on resume.
 *
 * Returns the effect id of the `tint` descriptor if one was created, else
 * `null`, so the caller can track and later cancel it (D-7.1-C).
 */
function applyBossVfxPlan(engine: VfxEngine, plan: VfxDescriptor[], bossTarget: Graphics | null): number | null {
  const startedAt = Date.now();
  let tintId: number | null = null;
  for (const d of plan) {
    switch (d.kind) {
      case 'ring':
        engine.add(createRingShockwave({
          x: d.x, y: d.y, color: d.color, startRadius: d.startRadius, maxRadius: d.maxRadius,
          lineWidth: d.lineWidth, durationMs: d.durationMs, alpha: d.alpha, startedAt,
        }));
        break;
      case 'beam':
        engine.add(createBeam({
          x: d.x, y: d.y, toX: d.toX, toY: d.toY, color: d.color,
          width: d.width, durationMs: d.durationMs, alpha: d.alpha, startedAt,
        }));
        break;
      case 'burst':
        engine.add(createParticleBurst({
          x: d.x, y: d.y, color: d.color, count: d.count, speed: d.speed, spread: d.spread,
          particleRadius: d.particleRadius, durationMs: d.durationMs, alpha: d.alpha, startedAt,
        }));
        break;
      case 'tint':
        // Boss already despawned/defeated — skip silently, never throw (7.1 AC3).
        if (bossTarget === null) break;
        tintId = engine.add(createTintPulse({
          target: bossTarget, color: d.color, durationMs: d.durationMs,
          minAlpha: d.minAlpha, maxAlpha: d.maxAlpha, startedAt,
        }));
        break;
    }
  }
  return tintId;
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  enemyGraphics: Map<string, EnemyEntry>,
  essenceFlashes: Map<string, EssenceFlash>,
  tetherGraphics: Map<string, Graphics>,
  isPurified: boolean,
  statusAuras: Map<string, StatusAuraEntry>,
  projectileGraphics: Map<string, ProjectileEntry>,
  zoneGraphics: Map<string, Graphics>,
  damageNumberGraphics: Map<string, DamageNumberEntry>,
  aimPreviewGraphics: Map<string, Graphics>,
  vfxRefs: VfxContext,
): void {
  app.stage.scale.set(app.screen.width / VIRTUAL_W, app.screen.height / VIRTUAL_H);

  const now = Date.now();

  // ── Players ──────────────────────────────────────────────────────────────────
  const currentPlayerIds = new Set(state.players.map(p => p.id));
  for (const [id, entry] of playerGraphics) {
    if (!currentPlayerIds.has(id)) {
      app.stage.removeChild(entry.circle);
      entry.circle.destroy();
      if (entry.body) {
        app.stage.removeChild(entry.body);
        entry.body.destroy();
      }
      playerGraphics.delete(id);
    }
  }

  for (const player of state.players) {
    let entry = playerGraphics.get(player.id);
    if (!entry) {
      const circle = new Graphics();
      app.stage.addChild(circle);
      entry = { circle, body: null, flashUntil: 0 };
      playerGraphics.set(player.id, entry);
    }
    const { circle } = entry;
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    const isFlashing = !player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil;
    const showSpirit = player.isSpirit && !isPurified;
    circle.position.set(player.x, player.y);
    circle.clear();
    if (showSpirit) {
      // Luminous spirit form: outer glow ring + inner circle
      circle.alpha = isFlashing
        ? 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * (entry.flashUntil - now) / ABILITY_FLASH_MS))
        : 1;
      circle.circle(0, 0, 28).fill({ color, alpha: 0.35 });
      circle.circle(0, 0, 14).fill({ color, alpha: 0.85 });
    } else if (player.isDown) {
      // Body sprite (below) is the only visual for the down-not-yet-spirit state —
      // it renders at bodyX/bodyY, which equals player.x/y here anyway (frozen),
      // so drawing the normal circle too would just duplicate it at the same spot.
      circle.alpha = 0;
    } else {
      circle.alpha = isFlashing
        ? 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * (entry.flashUntil - now) / ABILITY_FLASH_MS))
        : (player.isFrozen ? 0.3 : 1);
      circle.circle(0, 0, PLAYER_RADIUS).fill({ color });
    }

    // Body sprite (Story 3.21c): visible for the whole isDown+isSpirit window,
    // anchored at bodyX/bodyY — the fixed down location, independent of the
    // spirit's own (possibly wandered-off) position above.
    if (player.isDown || (player.isSpirit && !isPurified)) {
      if (!entry.body) {
        const body = new Graphics();
        app.stage.addChildAt(body, 0); // below circle/spirit, matches tether layering
        entry.body = body;
      }
      const bodyX = player.bodyX ?? player.x;
      const bodyY = player.bodyY ?? player.y;
      entry.body.position.set(bodyX, bodyY);
      entry.body.clear();
      // Dimmed fill + outline stroke — distinct from both the opaque alive circle
      // and the plain frozen/disconnected dim (which has no stroke and sits at
      // player.x/y). Further dimmed when isFrozen so the pre-existing disconnect
      // cue (frozen ? 0.3 : 1 on the alive circle) isn't lost for a down/spirit
      // player who has also disconnected — Client-UX hook's reconnect-state-
      // visibility check.
      const fillAlpha = player.isFrozen ? 0.15 : 0.35;
      const strokeAlpha = player.isFrozen ? 0.4 : 0.9;
      entry.body.circle(0, 0, PLAYER_RADIUS).fill({ color, alpha: fillAlpha }).stroke({ color, width: 3, alpha: strokeAlpha });
    } else if (entry.body) {
      app.stage.removeChild(entry.body);
      entry.body.destroy();
      entry.body = null;
    }
  }

  // ── Enemies ───────────────────────────────────────────────────────────────────
  // Add entries for new alive enemies
  for (const enemy of state.enemies) {
    if (!enemy.isAlive && !enemyGraphics.has(enemy.id)) continue;
    if (!enemyGraphics.has(enemy.id)) {
      const circle = new Graphics();
      const healthBar = new Graphics();
      app.stage.addChild(circle);
      app.stage.addChild(healthBar);
      enemyGraphics.set(enemy.id, { circle, healthBar, deadUntil: 0 });
    }
  }

  // Render/clean all enemy entries
  for (const [id, entry] of enemyGraphics) {
    const enemy = state.enemies.find(e => e.id === id);

    if (entry.deadUntil > 0) {
      // Fading out after kill
      const remaining = entry.deadUntil - now;
      if (remaining <= 0) {
        app.stage.removeChild(entry.circle);
        app.stage.removeChild(entry.healthBar);
        entry.circle.destroy();
        entry.healthBar.destroy();
        enemyGraphics.delete(id);
        continue;
      }
      const alpha = remaining / KILL_FADE_MS;
      entry.circle.alpha = alpha;
      entry.healthBar.alpha = 0;
      continue;
    }

    if (!enemy || !enemy.isAlive) {
      // Enemy removed from state without kill delta (e.g. snapshot reconciliation)
      app.stage.removeChild(entry.circle);
      app.stage.removeChild(entry.healthBar);
      entry.circle.destroy();
      entry.healthBar.destroy();
      enemyGraphics.delete(id);
      continue;
    }

    entry.circle.alpha = 1;
    entry.circle.position.set(enemy.x, enemy.y);
    entry.circle.clear();
    entry.circle.circle(0, 0, ENEMY_RADIUS).fill({ color: 0xe74c3c });

    // Health bar: 30px wide, 4px tall, red fill proportional to hp/maxHp
    const hpRatio = enemy.maxHp > 0 ? Math.max(0, enemy.hp / enemy.maxHp) : 0;
    entry.healthBar.alpha = 1;
    entry.healthBar.position.set(enemy.x, enemy.y);
    entry.healthBar.clear();
    entry.healthBar.rect(-15, -32, 30 * hpRatio, 4).fill({ color: 0xff0000 });
  }

  // ── Bond tethers ─────────────────────────────────────────────────────────────
  const activeBondKeys = new Set(state.activeBonds.map(b => `${b.playerA}+${b.playerB}`));
  for (const [key, g] of tetherGraphics) {
    if (!activeBondKeys.has(key)) {
      app.stage.removeChild(g); g.destroy(); tetherGraphics.delete(key);
    }
  }
  for (const bond of state.activeBonds) {
    const key = `${bond.playerA}+${bond.playerB}`;
    let g = tetherGraphics.get(key);
    if (!g) {
      g = new Graphics();
      app.stage.addChildAt(g, 0); // ponytail: addChildAt(0) keeps tethers below all sprites
      tetherGraphics.set(key, g);
    }
    const pA = state.players.find(p => p.id === bond.playerA);
    const pB = state.players.find(p => p.id === bond.playerB);
    g.clear();
    if (pA && pB) {
      const color = parseCssHexColor(bond.color, 0x6ea8d8);
      // Story 7.8 Task 8: two-pass restyle — a soft glow underlay plus a
      // breathing core, so the tether reads as living spirit energy rather than
      // a flat debug line. Breath stays in 0.48-0.76 (never invisible, never
      // opaque enough to compete with sprites) — couch-readability check.
      const coreAlpha = 0.62 + 0.14 * Math.sin((now / BOND_TETHER_BREATH_PERIOD_MS) * Math.PI * 2);
      g.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y).stroke({ color, width: BOND_TETHER_GLOW_WIDTH, alpha: 0.16 });
      g.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y).stroke({ color, width: BOND_TETHER_CORE_WIDTH, alpha: coreAlpha });
    }
  }

  // ── Snapshot-driven VFX (Story 7.14b) ────────────────────────────────────────
  // Status auras, the Soul Mend channel indicator, Spiritcaller faction accents,
  // and Storm Eye's zone tick pulse all moved verbatim into vfx/snapshot-vfx.ts
  // so HubWorldScreen can run the identical passes. Behaviour is unchanged: the
  // module is called at exactly the point the inlined blocks used to run, with
  // the same `now` and the same engine null-guard.
  if (vfxRefs.engine) {
    renderSnapshotVfx({
      state, app, now,
      engine: vfxRefs.engine,
      statusAuras,
      refs: vfxRefs.refs,
      playerRadius: PLAYER_RADIUS,
      enemyRadius: ENEMY_RADIUS,
      aimPreviewGraphics,
      colorForPlayer: (p) => SESSION_COLOR_HEX[p.sessionColor] ?? 0xffffff,
    });
  }

  // ── Projectiles ───────────────────────────────────────────────────────────────
  // Story 7.8: per-ability body (resolveProjectileAppearance) + one persistent
  // motion trail per live projectile (AC1, AC4). Cleanup-on-missing destroys the
  // body Graphics but deliberately does NOT engine.remove() the trail — it just
  // stops feeding it, so it fades point-by-point and the engine reaps it within
  // its own trailDurationMs (the fade-out *is* the despawn read, Task 3.5).
  const activeProjectileIds = new Set(state.projectiles.map(p => p.id));
  for (const [id, entry] of projectileGraphics) {
    if (!activeProjectileIds.has(id)) {
      app.stage.removeChild(entry.g);
      entry.g.destroy();
      projectileGraphics.delete(id);
      vfxRefs.refs.projectileMeta.delete(id); // Story 7.4: drop the meta cache alongside the Graphics
    }
  }
  for (const projectile of state.projectiles) {
    let entry = projectileGraphics.get(projectile.id);
    const appearance = resolveProjectileAppearance(projectile.class, projectile.abilityIndex);
    if (!entry) {
      const g = new Graphics();
      app.stage.addChild(g);
      const engine = vfxRefs.engine;
      let trail: TrailHandle | null = null;
      if (engine) {
        trail = createTrail({
          x: projectile.x, y: projectile.y,
          color: appearance.trail.color, width: appearance.trail.width, alpha: appearance.trail.alpha,
          durationMs: appearance.trail.durationMs, pointCount: appearance.trail.pointCount,
        });
        engine.add(trail);
      }
      entry = { g, trail };
      projectileGraphics.set(projectile.id, entry);
      // Story 7.4: cache class/ability/owner while the projectile is still in
      // state — projectile:hit removes it before the delta effect can read it.
      vfxRefs.refs.projectileMeta.set(projectile.id, {
        class: projectile.class,
        abilityIndex: projectile.abilityIndex,
        ownerId: projectile.ownerId,
      });
    }
    entry.g.position.set(projectile.x, projectile.y);
    entry.g.clear();
    if (appearance.halo) {
      entry.g.circle(0, 0, appearance.halo.radius).fill({ color: appearance.halo.color, alpha: appearance.halo.alpha });
    }
    entry.g.circle(0, 0, appearance.core.radius).fill({ color: appearance.core.color, alpha: appearance.core.alpha });
    if (entry.trail && !entry.trail.disposed) entry.trail.moveTo(projectile.x, projectile.y, now);
  }

  // ── Zones/Fields ──────────────────────────────────────────────────────────────
  const activeZoneIds = new Set(state.zones.map(z => z.id));
  for (const [id, g] of zoneGraphics) {
    if (!activeZoneIds.has(id)) {
      app.stage.removeChild(g);
      g.destroy();
      zoneGraphics.delete(id);
    }
  }
  for (const zone of state.zones) {
    let g = zoneGraphics.get(zone.id);
    // Story 7.5 → 7.8 seam: per-ability zone body via resolveZoneVisual. The
    // default branch reproduces today's exact 0x9b59b6 @ 0.25 for every unmapped
    // zone; the tick pulse (Storm Eye, above) is a separate VfxEngine effect
    // layered on top of this static body.
    const zoneVisual = resolveZoneVisual(zone, state.players);
    if (!g) {
      g = new Graphics();
      app.stage.addChildAt(g, 0); // below sprites, like bond tethers
      zoneGraphics.set(zone.id, g);
      // Task 4.4: one spawn ring on first-seen only, scaled to this zone's own
      // radius — never per-tick, never per-frame.
      if (vfxRefs.engine && zoneVisual.spawnRing) {
        const { color, startRadiusFactor, maxRadiusFactor, lineWidth, durationMs, alpha } = zoneVisual.spawnRing;
        vfxRefs.engine.add(createRingShockwave({
          x: zone.x, y: zone.y, color,
          startRadius: zone.radius * startRadiusFactor,
          maxRadius: zone.radius * maxRadiusFactor,
          lineWidth, durationMs, alpha, startedAt: now,
        }));
      }
    }
    g.position.set(zone.x, zone.y);
    g.clear();
    g.circle(0, 0, zone.radius).fill({ color: zoneVisual.fillColor, alpha: zoneVisual.fillAlpha });
    if (zoneVisual.rimColor !== undefined) {
      g.circle(0, 0, zone.radius).stroke({ color: zoneVisual.rimColor, width: zoneVisual.rimWidth ?? 2, alpha: zoneVisual.rimAlpha ?? 0.5 });
    }
  }

  // ── Essence flashes ───────────────────────────────────────────────────────────
  for (const [dropId, flash] of essenceFlashes) {
    const remaining = flash.deadline - now;
    if (remaining <= 0) {
      app.stage.removeChild(flash.g);
      flash.g.destroy();
      essenceFlashes.delete(dropId);
      continue;
    }
    // Pulse: 0 → 1 → 0 over the flash duration
    const progress = remaining / ESSENCE_FLASH_MS;
    const alpha = Math.sin(Math.PI * progress);
    flash.g.alpha = alpha;
  }

  // ── Damage numbers ───────────────────────────────────────────────────────────
  for (const [id, entry] of damageNumberGraphics) {
    const elapsed = now - entry.spawnTime;
    if (elapsed >= DAMAGE_NUMBER_DURATION_MS) {
      app.stage.removeChild(entry.text);
      entry.text.destroy();
      damageNumberGraphics.delete(id);
      continue;
    }
    const t = elapsed / DAMAGE_NUMBER_DURATION_MS;
    entry.text.position.set(entry.text.position.x, entry.startY - t * DAMAGE_NUMBER_RISE_PX);
    entry.text.alpha = 1 - t;
  }
}

interface ReviveDeadline {
  deadline: number;
  windowMs: number;
  name: string;
}

export function DungeonScreen({ gameState, session, transientDeltaQueue }: DungeonScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const enemyGraphicsRef = useRef<Map<string, EnemyEntry>>(new Map());
  const essenceFlashesRef = useRef<Map<string, EssenceFlash>>(new Map());
  const tetherGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const statusAurasRef = useRef<Map<string, StatusAuraEntry>>(new Map());
  const projectileGraphicsRef = useRef<Map<string, ProjectileEntry>>(new Map());
  const zoneGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const damageNumberGraphicsRef = useRef<Map<string, DamageNumberEntry>>(new Map());
  // Story 7.15c: one persistent Graphics per aiming player (arrow + zone ghost).
  const aimPreviewGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const vfxEngineRef = useRef<VfxEngine | null>(null);
  // Story 7.14b: the Epic 7.3-7.5 correlation/channel state (runtime maps, never
  // Graphics) now lives in one shared bundle so HubWorldScreen holds the same one.
  const vfxRuntimeRefs = useVfxRuntimeRefs();
  const damageNumberIdCounterRef = useRef(0);
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;
  const reviveDeadlinesRef = useRef<Map<string, ReviveDeadline>>(new Map());
  const bossGraphicsRef = useRef<Graphics | null>(null);
  const bossPhaseRef = useRef<BossPhase | null>(null);
  const lastBossHpRef = useRef<number | null>(null);
  const bossDefeatedRef = useRef(false);
  const isPurifiedRef = useRef(false);
  // Story 7.8 Task 6.3: the purification pulse's completion deadline. VfxEngine
  // reaps the pulse effect silently (no completion callback), so this ref is what
  // drives the reward-reveal handoff — set when the pulse is added, nulled first
  // (so it fires exactly once) when the ticker observes now >= deadline.
  const purificationPulseEndsAtRef = useRef<number | null>(null);
  const rewardRevealActiveRef = useRef(false);
  const bossLastPositionRef = useRef({ x: 960, y: 540 });
  const bossTintEffectIdRef = useRef<number | null>(null);
  const bossDamageVfxAtRef = useRef(0);
  const essenceDisplayRef = useRef<number | null>(null);
  const [, setTimerTick] = useState(0);
  const [levelClearFlash, setLevelClearFlash] = useState(false);
  const [bondOverlay, setBondOverlay] = useState<{ text: string; fading: boolean } | null>(null);
  const [bondOverlayTrigger, setBondOverlayTrigger] = useState(0);
  const [bossDamageFlash, setBossDamageFlash] = useState<{ amount: number; until: number } | null>(null);
  const [isPurified, setIsPurified] = useState(false);
  const [rewardRevealVisible, setRewardRevealVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initPixi() {
      if (!canvasContainerRef.current) return;
      const app = new Application();
      await app.init({
        background: 0x0a0a12,
        resizeTo: window,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      canvasContainerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;
      // app.stage structurally satisfies VfxStage (vfx/types.ts:21-24)
      vfxEngineRef.current = new VfxEngine(app.stage);
      app.ticker.add(() => {
        // CLOCK CONTRACT (vfx/types.ts:26-34): one Date.now() per tick, reused for
        // everything below — vfxEngineRef.current.update() and the purification-
        // pulse deadline check. renderFrame recomputes its own (they agree; left
        // alone, Story 7.8 Dev Notes "The clock unification").
        const now = Date.now();
        const state = latestGameStateRef.current;
        if (state) renderFrame(
          state,
          app,
          playerGraphicsRef.current,
          enemyGraphicsRef.current,
          essenceFlashesRef.current,
          tetherGraphicsRef.current,
          isPurifiedRef.current,
          statusAurasRef.current,
          projectileGraphicsRef.current,
          zoneGraphicsRef.current,
          damageNumberGraphicsRef.current,
          aimPreviewGraphicsRef.current,
          { engine: vfxEngineRef.current, refs: vfxRuntimeRefs },
        );

        // CLOCK CONTRACT (vfx/types.ts:26-34): Date.now() only — no other clock.
        // Placed AFTER renderFrame (code review 2026-07-23): renderFrame rewrites
        // circle.alpha every frame, so a borrowed-target tint pulse (Spirit Nova /
        // Warding Cry casts) must be applied after it or it is clobbered within the
        // same frame (7.1 clock contract + Task 1.5). It still runs when state is
        // null — outside the guard below — so effects live at that moment keep
        // advancing and get reaped (the Story 7.2 review concern that first moved
        // this call up; satisfied here without shadowing the tint pulses).
        vfxEngineRef.current?.update(now);
        if (!state) return;

        // Boss sprite — managed in ticker to keep renderFrame signature stable
        if (state.boss && !bossDefeatedRef.current) {
          if (!bossGraphicsRef.current) {
            const g = new Graphics();
            app.stage.addChild(g);
            bossGraphicsRef.current = g;
          }
          const g = bossGraphicsRef.current;
          g.clear();
          g.position.set(state.boss.position.x, state.boss.position.y);
          const phase = bossPhaseRef.current;
          // Phase 2 glow ring (drawn first, below main circle)
          if (phase === BossPhase.Phase2 || phase === BossPhase.Phase3) {
            g.circle(0, 0, 56).fill({ color: 0x7d2dff, alpha: 0.3 });
          }
          // Main boss circle
          g.circle(0, 0, 48).fill({ color: 0x7d2dff });
          // Phase 3 eye glow (Hard only)
          if (phase === BossPhase.Phase3) {
            g.circle(0, 0, 12).fill({ color: 0xff2222 });
          }
        } else if (bossGraphicsRef.current) {
          // Cancel any live phase-tint pulse before the target it animates is
          // destroyed (D-7.1-C: neither the engine nor the primitive detects an
          // externally destroyed target — Story 7.7b Dev Notes).
          if (bossTintEffectIdRef.current !== null) {
            vfxEngineRef.current?.remove(bossTintEffectIdRef.current);
            bossTintEffectIdRef.current = null;
          }
          app.stage.removeChild(bossGraphicsRef.current);
          bossGraphicsRef.current.destroy();
          bossGraphicsRef.current = null;
        }

        // Purification pulse → reward-reveal handoff (Story 7.8 Task 6.3). The
        // pulse graphic itself now lives entirely inside VfxEngine (createRingShockwave,
        // added from the boss:defeated delta handler) — VfxEngine reaps it silently
        // with no completion callback, so this deadline ref is the one thing that
        // must not get wrong: null-out FIRST so the handoff fires exactly once,
        // using the same `now` the deadline was computed from.
        if (purificationPulseEndsAtRef.current !== null && now >= purificationPulseEndsAtRef.current) {
          purificationPulseEndsAtRef.current = null;
          rewardRevealActiveRef.current = true;
          setRewardRevealVisible(true);
          setVoiceVisible(true);
        }
      });
    }
    void initPixi();
    return () => {
      cancelled = true;
      const app = pixiAppRef.current;
      if (app) {
        // Before app.destroy: clear() calls stage.removeChild on a live stage.
        bossTintEffectIdRef.current = null;
        bossDamageVfxAtRef.current = 0;
        vfxEngineRef.current?.clear();
        vfxEngineRef.current = null;
        app.canvas.remove();
        app.destroy(true, { children: true });
        pixiAppRef.current = null;
      }
      if (bossGraphicsRef.current) {
        bossGraphicsRef.current.destroy();
        bossGraphicsRef.current = null;
      }
      purificationPulseEndsAtRef.current = null;
      bossDefeatedRef.current = false;
      isPurifiedRef.current = false;
      rewardRevealActiveRef.current = false;
      playerGraphicsRef.current.clear();
      enemyGraphicsRef.current.clear();
      essenceFlashesRef.current.clear();
      tetherGraphicsRef.current.clear();
      statusAurasRef.current.clear();
      damageNumberGraphicsRef.current.clear();
      aimPreviewGraphicsRef.current.clear();
      vfxRuntimeRefs.clear();
    };
  }, []);

  // Preload biome assets during Level 1 to avoid mid-combat hitches on later levels
  useEffect(() => {
    if (gameState?.session.levelIndex === 1) {
      // ponytail: no-op for alpha — wire real Grassland biome bundle URL in Epic 9
      void Assets.backgroundLoad([]);
    }
  }, [gameState?.session.levelIndex]);

  // Handle transient delta visuals: ability flash, enemy kill fade, essence drop flash, level-complete flash
  useEffect(() => {
    for (const latestTransientDelta of transientDeltaQueue) {
    const app = pixiAppRef.current;

    // Story 7.14b: the ability/cast VFX branches moved verbatim into
    // vfx/ability-vfx-dispatch.ts so HubWorldScreen drives the same visuals from
    // the same deltas. Runs first and `continue`s when it owns the delta type,
    // preserving the original if/else-if semantics (each delta handled once).
    // Boss branches and the non-VFX HUD branches below stay here.
    if (dispatchAbilityVfx(latestTransientDelta, {
      engine: vfxEngineRef.current,
      gameState,
      refs: vfxRuntimeRefs,
      onCastFlash: (playerId) => {
        const entry = playerGraphicsRef.current.get(playerId);
        if (entry) entry.flashUntil = Date.now() + ABILITY_FLASH_MS;
      },
      // Spirit Nova tints the caster's own circle instead of flashing it.
      castTintTarget: (playerId) => playerGraphicsRef.current.get(playerId)?.circle ?? null,
    })) continue;

    if (latestTransientDelta.type === 'bond:assigned') {
      // Story 7.11: level:complete and bond:assigned in the same batch now both
      // reach here (queue conversion) — no longer skipped. Two bond:assigned in
      // the same batch can still collapse to the last one's overlay text, since
      // setBondOverlay itself is single-slot (see deferred-work.md D-7.11-F).
      const nameA = gameState?.players.find(p => p.id === latestTransientDelta.playerA)?.displayName ?? latestTransientDelta.playerA;
      const nameB = gameState?.players.find(p => p.id === latestTransientDelta.playerB)?.displayName ?? latestTransientDelta.playerB;
      const label = latestTransientDelta.bondType === 'fate' ? 'Fate' : 'Proximity';
      // ponytail: timers live in a separate effect keyed on trigger counter so they survive transientDeltaQueue being cleared synchronously (Story 7.11)
      setBondOverlay({ text: `${nameA} · ${nameB} — ${label} Bond`, fading: false });
      setBondOverlayTrigger(c => c + 1);
    } else if (latestTransientDelta.type === 'level:complete') {
      setLevelClearFlash(true);
    } else if (latestTransientDelta.type === 'spirit-ability:fired') {
      const entry = playerGraphicsRef.current.get(latestTransientDelta.playerId);
      if (entry) entry.flashUntil = Date.now() + SPIRIT_ABILITY_FLASH_MS;
    } else if (latestTransientDelta.type === 'enemy:killed') {
      const entry = enemyGraphicsRef.current.get(latestTransientDelta.enemyId);
      if (entry && entry.deadUntil === 0) entry.deadUntil = Date.now() + KILL_FADE_MS;
    } else if (latestTransientDelta.type === 'enemy:damaged' && app) {
      const enemy = gameState?.enemies.find(e => e.id === latestTransientDelta.enemyId);
      if (enemy) {
        const text = new Text({
          text: `-${latestTransientDelta.damage}`,
          style: new TextStyle({ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 'bold', fill: 0xffffff }),
        });
        const startY = enemy.y - DAMAGE_NUMBER_Y_OFFSET;
        text.anchor.set(0.5, 1);
        text.position.set(enemy.x, startY);
        app.stage.addChild(text);
        const key = `dn-${damageNumberIdCounterRef.current++}`;
        damageNumberGraphicsRef.current.set(key, {
          text,
          spawnTime: Date.now(),
          startY,
        });
      }
    } else if (latestTransientDelta.type === 'essence:dropped' && app) {
      const { drop } = latestTransientDelta;
      const g = new Graphics();
      g.position.set(drop.x, drop.y);
      g.circle(0, 0, 20).fill({ color: 0xf1c40f });
      app.stage.addChild(g);
      essenceFlashesRef.current.set(drop.id, { g, deadline: Date.now() + ESSENCE_FLASH_MS });
    } else if (latestTransientDelta.type === 'boss:phaseChanged') {
      bossPhaseRef.current = latestTransientDelta.newPhase;         // UNCHANGED — drives the glow ring + eye
      const engine = vfxEngineRef.current;
      if (engine) {
        const pos = bossLastPositionRef.current;
        const plan = planBossVfx(
          { type: 'boss:phaseChanged', newPhase: latestTransientDelta.newPhase },
          { bossX: pos.x, bossY: pos.y, prevX: pos.x, prevY: pos.y },
        );
        if (bossTintEffectIdRef.current !== null) engine.remove(bossTintEffectIdRef.current);
        bossTintEffectIdRef.current = applyBossVfxPlan(engine, plan, bossGraphicsRef.current);
      }
    } else if (latestTransientDelta.type === 'boss:damaged') {
      const prevHp = lastBossHpRef.current;
      const damage = prevHp != null ? Math.max(0, prevHp - latestTransientDelta.newHp) : 0;
      lastBossHpRef.current = latestTransientDelta.newHp;
      setBossDamageFlash({ amount: damage, until: Date.now() + 800 });
      setTimeout(() => setBossDamageFlash(null), 800);

      const engine = vfxEngineRef.current;
      const nowMs = Date.now();
      if (engine && nowMs - bossDamageVfxAtRef.current >= BOSS_DAMAGE_VFX_MIN_INTERVAL_MS) {
        bossDamageVfxAtRef.current = nowMs;
        const pos = bossLastPositionRef.current;
        applyBossVfxPlan(engine, planBossVfx({ type: 'boss:damaged' }, { bossX: pos.x, bossY: pos.y, prevX: pos.x, prevY: pos.y }), bossGraphicsRef.current);
      }
    } else if (latestTransientDelta.type === 'boss:stomped') {
      const engine = vfxEngineRef.current;
      if (engine) {
        const { x, y, radius } = latestTransientDelta;
        applyBossVfxPlan(engine, planBossVfx({ type: 'boss:stomped', x, y, radius }, { bossX: x, bossY: y, prevX: x, prevY: y }), bossGraphicsRef.current);
      }
    } else if (latestTransientDelta.type === 'boss:charged') {
      const engine = vfxEngineRef.current;
      if (engine) {
        const prev = bossLastPositionRef.current;
        const { x, y } = latestTransientDelta;
        applyBossVfxPlan(engine, planBossVfx({ type: 'boss:charged', x, y }, { bossX: x, bossY: y, prevX: prev.x, prevY: prev.y }), bossGraphicsRef.current);
      }
    } else if (latestTransientDelta.type === 'boss:defeated' && app && !bossDefeatedRef.current) {
      // Story 7.8 review: guard against a duplicate boss:defeated delta re-adding
      // a second overlapping pulse and pushing the reward-reveal deadline later
      // (pre-existing gap, hardened while already touching this branch).
      bossDefeatedRef.current = true;
      isPurifiedRef.current = true;
      setIsPurified(true);
      essenceDisplayRef.current = latestTransientDelta.reward.essenceTotal;
      // Record boss last position for pulse origin (fall back to arena center,
      // UX-DR16 — keep using bossLastPositionRef; state.boss may already be gone).
      const bossPos = bossLastPositionRef.current;
      // Background color swap: light purification tint
      app.renderer.background.color = 0x90d8f0;
      // Story 7.8 Task 6.2/6.3: the pulse itself is now a VfxEngine primitive —
      // createRingShockwave was generalized from this exact block (primitives.ts:187).
      // Delta-triggered (not RAF-gated) → stamp Date.now() explicitly (BACKGROUNDED-
      // TICKER rule) and set the completion deadline from the same timestamp so the
      // reward-reveal handoff (ticker, Task 6.3) fires off the same clock.
      const triggeredAt = Date.now();
      vfxEngineRef.current?.add(createRingShockwave({
        x: bossPos.x, y: bossPos.y, color: 0x90d8f0, alpha: 0.6, filled: true,
        startRadius: 0, maxRadius: PURIFICATION_PULSE_MAX_RADIUS_PX,
        durationMs: PURIFICATION_PULSE_DURATION_MS, startedAt: triggeredAt,
      }));
      purificationPulseEndsAtRef.current = triggeredAt + PURIFICATION_PULSE_DURATION_MS;
    }
    }
  }, [transientDeltaQueue]);

  // Story 7.11 Task 3: populate projectileMetaRef from every gameState update,
  // not only renderFrame's ticker-cadenced pass — a projectile whose whole
  // lifetime falls between two ticker frames would otherwise never get cached,
  // making its projectile:hit cue no-op. renderFrame's own population
  // (:699-703) and its :676 cleanup on Graphics teardown are untouched.
  // This effect's own cleanup below (review finding, Story 7.11) prunes any
  // id no longer in gameState.projectiles: for a projectile the ticker never
  // observes, no projectileGraphics entry is ever created for it, so
  // renderFrame's Graphics-teardown cleanup can never reach it either — this
  // is the only removal path for that specific case. Harmless no-op for ids
  // renderFrame's own cleanup would also reach.
  useEffect(() => {
    if (!gameState) return;
    const activeIds = new Set(gameState.projectiles.map(p => p.id));
    for (const p of gameState.projectiles) {
      if (!vfxRuntimeRefs.projectileMeta.has(p.id)) {
        vfxRuntimeRefs.projectileMeta.set(p.id, {
          class: p.class,
          abilityIndex: p.abilityIndex,
          ownerId: p.ownerId,
        });
      }
    }
    for (const id of vfxRuntimeRefs.projectileMeta.keys()) {
      if (!activeIds.has(id)) vfxRuntimeRefs.projectileMeta.delete(id);
    }
  }, [gameState]);

  // Story 7.4 Task 6.2: Dark Pact buff-gained cue — snapshot-driven onset pulse.
  // Uses player.statusEffects (in every snapshot, reconciled across reconnects)
  // rather than status:applied (not whitelisted). damageBuff is applied by exactly
  // one ability in the shipped game — Dark Pact (balance.ts:216-219) — so no class
  // gate is needed. Story 7.6 owns the *persistent* per-status aura; 7.4 owns only
  // this one-shot onset, so the two do not double-draw.
  useEffect(() => {
    const engine = vfxEngineRef.current;
    if (!gameState || !engine) return;
    const now = Date.now();
    const current = new Set<string>();
    for (const player of gameState.players) {
      if (!player.statusEffects.some(e => e.type === 'damageBuff')) continue;
      current.add(player.id);
      if (!vfxRuntimeRefs.buffedPlayers.has(player.id)) {
        spawnSouldrinkerVfx(engine, planDamageBuffOnset({ x: player.x, y: player.y }), now);
      }
    }
    // Overwrite (drops expired ids) so a second Dark Pact re-triggers the onset.
    vfxRuntimeRefs.buffedPlayers = current;
  }, [gameState]);

  // Story 7.4 Task 6.3: Dark Pact cost/gain cue — classifier-driven, windowed.
  // The drained ally's HP drop is the one change no delta identifies (AC3), so it
  // is resolved from the pure classifier + a short window after a Souldrinker Dark
  // Pact ability:fired. Scope guard: the loss cue only inside the window; the gain
  // cue additionally only for Souldrinkers (Spiritcaller heal visuals are 7.3's).
  // Every other HP change — enemy melee, bond drain, Blood Spike's own self-cost
  // (Task 4.2) and lifesteal (Task 4.5) — is deliberately left untouched.
  useEffect(() => {
    if (!gameState) return;
    const engine = vfxEngineRef.current;
    const now = Date.now();
    const withinWindow = now - vfxRuntimeRefs.lastDarkPactCastAt.value <= DARK_PACT_COST_CUE_WINDOW_MS;
    if (engine && withinWindow) {
      for (const change of classifyHpChanges(vfxRuntimeRefs.prevPlayerHp, gameState.players)) {
        const player = gameState.players.find(p => p.id === change.playerId);
        if (!player) continue;
        if (change.direction === 'loss') {
          // Loss cue = the drained ally only. Skip Souldrinkers so the caster's own
          // Blood Spike self-cost (already shown by Task 4.2) does not double-draw a
          // spurious loss cue inside the window (code review 2026-07-24). Pairs with
          // the gain cue below: loss = non-Souldrinker allies, gain = Souldrinkers.
          if (player.class !== PlayerClass.SOULDRINKER) {
            spawnSouldrinkerVfx(engine, planHpLossCue({ x: player.x, y: player.y }), now);
          }
        } else if (player.class === PlayerClass.SOULDRINKER) {
          spawnSouldrinkerVfx(engine, planHpGainCue({ x: player.x, y: player.y }), now);
        }
      }
    }
    // Refresh the HP baseline every pass (even outside the window) so the next
    // comparison is against the latest snapshot, not a stale one.
    const next = new Map<string, number>();
    for (const player of gameState.players) next.set(player.id, player.hp);
    vfxRuntimeRefs.prevPlayerHp = next;
  }, [gameState]);

  // Track revive deadlines from downed/revived/spirit deltas
  useEffect(() => {
    for (const latestTransientDelta of transientDeltaQueue) {
    if (latestTransientDelta.type === 'player:downed') {
      const player = gameState?.players.find(p => p.id === latestTransientDelta.playerId);
      reviveDeadlinesRef.current.set(latestTransientDelta.playerId, {
        deadline: Date.now() + latestTransientDelta.reviveWindowMs,
        windowMs: latestTransientDelta.reviveWindowMs,
        name: player?.displayName ?? latestTransientDelta.playerId,
      });
    } else if (
      latestTransientDelta.type === 'player:revived' ||
      latestTransientDelta.type === 'player:spirit'
    ) {
      reviveDeadlinesRef.current.delete(latestTransientDelta.playerId);
    }
    }
  }, [transientDeltaQueue, gameState]);

  // Track boss HP reference for damage number computation
  useEffect(() => {
    if (gameState?.boss != null) {
      lastBossHpRef.current = gameState.boss.hp;
    } else {
      lastBossHpRef.current = null;
    }
  }, [gameState?.boss?.hp]);

  // Track boss position for purification pulse origin
  useEffect(() => {
    if (gameState?.boss != null) {
      bossLastPositionRef.current = { x: gameState.boss.position.x, y: gameState.boss.position.y };
    }
  }, [gameState?.boss?.position.x, gameState?.boss?.position.y]);

  // Seed bossPhaseRef from snapshot — handles reconnect/late-join when phase is already >1
  useEffect(() => {
    if (gameState?.boss != null) {
      bossPhaseRef.current = gameState.boss.phase;
    } else {
      bossPhaseRef.current = null;
    }
  }, [gameState?.boss?.phase]);

  // Reconcile revive overlays from gameState snapshot (handles reconnect)
  useEffect(() => {
    if (!gameState) return;
    for (const player of gameState.players) {
      if (!player.isDown || player.reviveTimerExpiresAt === 0) continue;
      if (reviveDeadlinesRef.current.has(player.id)) continue;
      const remaining = Math.max(0, player.reviveTimerExpiresAt - Date.now());
      reviveDeadlinesRef.current.set(player.id, {
        deadline: player.reviveTimerExpiresAt,
        windowMs: remaining,
        name: player.displayName,
      });
    }
    for (const [id] of reviveDeadlinesRef.current) {
      const player = gameState.players.find(p => p.id === id);
      if (!player?.isDown) reviveDeadlinesRef.current.delete(id);
    }
  }, [gameState]);

  // Bond overlay fade/clear lifecycle — keyed on trigger counter so timers survive transientDeltaQueue being cleared synchronously (Story 7.11)
  // and correctly restart if the same pair is bonded again (same text, different trigger)
  useEffect(() => {
    if (bondOverlayTrigger === 0) return;
    const fadeTimer = setTimeout(() => setBondOverlay(o => o ? { ...o, fading: true } : o), 2700);
    const clearTimer = setTimeout(() => setBondOverlay(null), 3200);
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
  }, [bondOverlayTrigger]);

  // Level-clear flash auto-clear — separate effect so it survives bond:assigned arriving right after level:complete
  useEffect(() => {
    if (!levelClearFlash) return;
    const timer = setTimeout(() => setLevelClearFlash(false), 300);
    return () => clearTimeout(timer);
  }, [levelClearFlash]);

  // Reward reveal: spawn particles and set voice line hide timer.
  // Story 7.8 Task 7: like-for-like port onto createParticleBurst — the
  // primitive this exact block was generalized from (primitives.ts:17). Keeps
  // the randomized count/palette/spread/speed/radius exactly; the only change
  // is the clock (Date.now() only — this is a useEffect, not
  // the RAF-gated ticker, so BACKGROUNDED-TICKER rule applies: stamp startedAt
  // explicitly). Still originates at arena centre (AC6.4), not the boss position.
  useEffect(() => {
    if (!rewardRevealVisible) return;
    const engine = vfxEngineRef.current;
    if (engine) {
      engine.add(createParticleBurst({
        x: VIRTUAL_W / 2, y: VIRTUAL_H / 2,
        color: [0x6ea8d8, 0xf0c070],
        count: 8 + Math.floor(Math.random() * 5), // 8-12
        speed: 0.175,
        spread: 0.5,
        particleRadius: 8,
        durationMs: REWARD_PARTICLE_DURATION_MS,
        startedAt: Date.now(),
      }));
    }
    const voiceTimer = setTimeout(() => setVoiceVisible(false), 2000);
    return () => clearTimeout(voiceTimer);
  }, [rewardRevealVisible]);

  // Force re-render at 100ms intervals while any revive timers are active
  const anyTimerActive = reviveDeadlinesRef.current.size > 0;
  useEffect(() => {
    if (!anyTimerActive) return;
    const id = setInterval(() => setTimerTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [anyTimerActive]);

  const players = gameState?.players ?? [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`@keyframes fadeInReward { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div ref={canvasContainerRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Player chip strip with HP pips */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: 'rgba(15,14,16,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          zIndex: 10,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        {players.map(player => {
          const playerBondColors = gameState?.activeBonds
            .filter(b => b.playerA === player.id || b.playerB === player.id)
            .map(b => b.color) ?? [];
          return <PlayerChipHUD key={player.id} player={player} bondColors={playerBondColors} isPurified={isPurified} />;
        })}
        {gameState?.session.phase === 'dungeon' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
            {session && (
              <>
                <button
                  onPointerDown={() => session.sendDebugKillAll()}
                  style={{
                    padding: '4px 10px',
                    background: 'rgba(231,76,60,0.8)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                  }}
                >
                  Kill All
                </button>
                {gameState?.session.levelIndex === 4 && !bossDefeatedRef.current && (
                  <button
                    onPointerDown={() => session.sendDebugKillBoss()}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(155,89,182,0.8)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      fontFamily: 'var(--font-body)',
                      fontWeight: 700,
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Kill Boss
                  </button>
                )}
              </>
            )}
            <div style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 2,
              pointerEvents: 'none',
            }}>
              {(gameState.session.levelObjective ?? 'clear') === 'survive-waves'
                ? `Level ${gameState.session.levelIndex} — Survive: ${gameState.session.totalWaves} Waves`
                : `Level ${gameState.session.levelIndex} — Grassland`
              }
              {(gameState.session.levelObjective ?? 'clear') === 'survive-waves' && gameState.session.waveIndex > 0 && (
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  Wave {gameState.session.waveIndex} / {gameState.session.totalWaves}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Boss HP bar — hidden after boss defeated */}
      {gameState?.boss != null && !bossDefeatedRef.current && (
        <div
          style={{
            position: 'absolute',
            top: 54,
            left: 0,
            right: 0,
            height: 6,
            background: 'rgba(30,15,30,0.6)',
            zIndex: 11,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, (gameState.boss.hp / gameState.boss.maxHp) * 100)}%`,
              background: '#7d2dff',
              transition: 'width 80ms linear',
            }}
          />
        </div>
      )}
      {/* Boss damage number */}
      {bossDamageFlash && bossDamageFlash.amount > 0 && Date.now() < bossDamageFlash.until && (
        <div
          style={{
            position: 'absolute',
            top: 62,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#ff99ff',
            fontSize: 20,
            fontWeight: 'bold',
            fontFamily: 'var(--font-body)',
            pointerEvents: 'none',
            zIndex: 12,
          }}
        >
          -{bossDamageFlash.amount}
        </div>
      )}
      {/* Level-complete canvas flash */}
      {levelClearFlash && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'white',
          opacity: 0.3,
          zIndex: 20,
          pointerEvents: 'none',
        }} />
      )}
      {/* Bond assignment overlay — centered, fades out after 3s */}
      {bondOverlay && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          pointerEvents: 'none',
          opacity: bondOverlay.fading ? 0 : 1,
          transition: bondOverlay.fading ? 'opacity 0.5s' : 'opacity 0.3s',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            color: 'var(--accent-spirit)',
            textShadow: '0 0 40px rgba(110,168,216,0.7)',
            textAlign: 'center',
          }}>
            {bondOverlay.text}
          </div>
        </div>
      )}
      {/* Purification reward overlay — floating, no panel, same pattern as bond overlay */}
      {rewardRevealVisible && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 35,
          pointerEvents: 'none',
          animation: 'fadeInReward 0.3s ease-in both',
        }}>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 40,
            color: '#f0c070',
            textShadow: '0 0 40px rgba(240,192,112,0.7)',
          }}>
            {essenceDisplayRef.current ?? 0} Spirit Essence
          </div>
          {voiceVisible && (
            <div style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontStyle: 'italic',
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginTop: 8,
            }}>
              The plains are quieter tonight. You did this.
            </div>
          )}
        </div>
      )}
      {/* Revive timer overlay — bottom-center */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 20,
        pointerEvents: 'none',
      }}>
        {Array.from(reviveDeadlinesRef.current.entries()).map(([playerId, { deadline, windowMs, name }]) => {
          const remaining = Math.max(0, deadline - Date.now());
          const seconds = Math.ceil(remaining / 1000);
          const fraction = windowMs > 0 ? remaining / windowMs : 0;
          const isSafe = remaining > 10000;
          const timerColor = isSafe ? 'var(--accent-warm)' : 'var(--corruption-blood)';
          const haloSize = 8 + (1 - fraction) * 32;
          return (
            <div key={playerId} style={{
              background: 'var(--bg-surface)',
              border: '2px solid var(--accent-corruption)',
              borderRadius: 6,
              padding: '8px 16px',
              minWidth: 280,
              textAlign: 'center',
              boxShadow: `0 0 ${haloSize}px var(--accent-warm)`,
            }}>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {name}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 40, color: timerColor, lineHeight: 1 }}>
                {seconds}
              </div>
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: '100%', width: `${fraction * 100}%`, background: timerColor, borderRadius: 2, transition: 'width 100ms linear' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerChipHUD({ player, bondColors = [], isPurified = false }: { player: PlayerState; bondColors: string[]; isPurified?: boolean }) {
  const showSpirit = player.isSpirit && !isPurified;
  const pips = [0, 1, 2, 3, 4].map(i => (isPurified ? true : player.hp > i * 20));
  const spiritGlow = showSpirit ? { boxShadow: '0 0 6px var(--accent-spirit)' } : {};

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: player.isFrozen ? '1px dashed var(--border)' : '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        minHeight: 40,
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
        minWidth: 80,
        ...spiritGlow,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          color: (player.isFrozen || showSpirit) ? 'var(--text-secondary)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 80,
        }}
      >
        {player.displayName}
      </span>
      {showSpirit ? (
        <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>◌◌◌◌◌</span>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {pips.map((filled, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: filled ? 'var(--accent-warm)' : 'transparent',
                border: '1px solid var(--border)',
              }}
            />
          ))}
        </div>
      )}
      {bondColors.length > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          {bondColors.map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
        </div>
      )}
    </div>
  );
}

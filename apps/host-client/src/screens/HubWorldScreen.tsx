import { useEffect, useRef } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from 'shared-types';
import { SessionColor, HUB_POIS, PoiType, PlayerClass, CLASS_DEFINITIONS } from 'shared-types';
import type { HostSession } from '../session/host-session';
import type { DeltaEventMsg } from 'net-protocol';
import {
  VfxEngine,
  useVfxRuntimeRefs,
  type VfxRuntimeRefs,
  dispatchAbilityVfx,
  renderSnapshotVfx,
  type StatusAuraEntry,
} from '../vfx';

interface HubWorldScreenProps {
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
// Virtual coordinate space the simulation server uses
const VIRTUAL_W = 1920;
const VIRTUAL_H = 1080;
// Story 7.14b: the hub has no enemies (Story 7.14a keeps combat dungeon-only),
// but renderSnapshotVfx takes an enemy radius for the shared aura sizing path.
// The value is never used here because `state.enemies` is empty; it is passed
// as the dungeon's own constant so the two screens cannot drift.
const ENEMY_RADIUS = 20;
const CLASS_CONFIRM_FLASH_MS = 600;
// Story 7.14b: the hub's own cast flash, deliberately a SEPARATE field from
// `flashUntil`. `DungeonScreen` uses `flashUntil` for a 300ms ability flash;
// this screen has always used it for the 600ms class-confirmation pulse. Sharing
// one field would let a cast truncate a class-confirmation animation (and be
// rendered on the wrong curve), which is why `dispatchAbilityVfx` takes an
// `onCastFlash` callback instead of writing a field it does not own.
const ABILITY_FLASH_MS = 300;

interface PlayerEntry {
  circle: Graphics;
  chatBubble: Text;
  flashUntil: number;
  abilityFlashUntil: number;
  knownClass: PlayerClass | null;
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
): void {
  // Scale stage so virtual coords map to actual canvas pixels.
  // Virtual center (960, 540) always lands at screen center regardless of display size.
  app.stage.scale.set(app.screen.width / VIRTUAL_W, app.screen.height / VIRTUAL_H);

  const currentIds = new Set(state.players.map(p => p.id));

  for (const [id, entry] of playerGraphics) {
    if (!currentIds.has(id)) {
      app.stage.removeChild(entry.circle);
      entry.circle.destroy();
      app.stage.removeChild(entry.chatBubble);
      entry.chatBubble.destroy();
      playerGraphics.delete(id);
    }
  }

  for (const player of state.players) {
    if (player.class === null) {
      const existing = playerGraphics.get(player.id);
      if (existing) {
        app.stage.removeChild(existing.circle); existing.circle.destroy();
        app.stage.removeChild(existing.chatBubble); existing.chatBubble.destroy();
        playerGraphics.delete(player.id);
      }
      continue;
    }
    let entry = playerGraphics.get(player.id);
    if (!entry) {
      const circle = new Graphics();
      const chatBubble = new Text({ text: '💬', style: new TextStyle({ fontSize: 20 }) });
      chatBubble.anchor.set(0.5, 1);
      app.stage.addChild(circle);
      app.stage.addChild(chatBubble);
      entry = { circle, chatBubble, flashUntil: 0, abilityFlashUntil: 0, knownClass: null };
      playerGraphics.set(player.id, entry);
    }
    const { circle, chatBubble } = entry;

    // Detect class confirmation and start flash
    if (entry.knownClass !== player.class && player.class !== null) {
      entry.knownClass = player.class;
      entry.flashUntil = Date.now() + CLASS_CONFIRM_FLASH_MS;
    }

    // Alpha pulse during flash; frozen state overrides. Class confirmation wins
    // over an ability flash when both are live — it is the rarer, more
    // informative event, and it is the one the player is watching for.
    const now = Date.now();
    if (!player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil) {
      const progress = (entry.flashUntil - now) / CLASS_CONFIRM_FLASH_MS; // 1.0 → 0.0 as time passes
      circle.alpha = 0.6 + 0.4 * Math.cos(2 * Math.PI * (1 - progress)); // 1→0.2→1
    } else if (!player.isFrozen && entry.abilityFlashUntil > 0 && now < entry.abilityFlashUntil) {
      // Story 7.14b: same curve DungeonScreen uses for its cast flash, so a
      // fallback-path cast reads identically in both screens.
      circle.alpha = 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * (entry.abilityFlashUntil - now) / ABILITY_FLASH_MS));
    } else {
      circle.alpha = player.isFrozen ? 0.3 : 1;
    }
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    circle.position.set(player.x, player.y);
    circle.clear();
    circle.circle(0, 0, PLAYER_RADIUS).fill({ color });

    // Chat bubble appears PLAYER_RADIUS + 8 above the circle center
    chatBubble.visible = player.nearPoiId !== null;
    chatBubble.position.set(player.x, player.y - PLAYER_RADIUS - 8);
  }

}

export function HubWorldScreen({ gameState, session, transientDeltaQueue }: HubWorldScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const poiGraphicsRef = useRef<Map<string, { body: Graphics; label: Text }>>(new Map());
  // Always holds the latest gameState so initPixi can render it after async init
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;
  // Story 7.14b: the same VFX wiring DungeonScreen uses.
  const vfxEngineRef = useRef<VfxEngine | null>(null);
  const statusAurasRef = useRef<Map<string, StatusAuraEntry>>(new Map());
  // Story 7.15c: one persistent Graphics per aiming player (arrow + zone ghost).
  const aimPreviewGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const vfxRuntimeRefs: VfxRuntimeRefs = useVfxRuntimeRefs();

  useEffect(() => {
    let cancelled = false;
    async function initPixi() {
      if (!canvasContainerRef.current) return;
      const app = new Application();
      await app.init({
        background: 0x0f0e10,
        resizeTo: window,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      canvasContainerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      // Draw static POI icons into the stage once
      for (const poi of HUB_POIS) {
        const isDungeon = poi.type === PoiType.DUNGEON_ENTRANCE;
        const color = poi.type === PoiType.CLASS_SELECT ? 0x6ea8d8 : 0x36334a;
        const g = new Graphics();
        g.roundRect(-24, -24, 48, 48, 6).fill({ color });
        g.position.set(poi.x, poi.y);
        g.alpha = isDungeon ? 0.35 : 1.0;
        app.stage.addChild(g);

        const label = new Text({
          text: poi.type === PoiType.CLASS_SELECT ? 'CLASS' : 'GATE',
          style: new TextStyle({
            fontFamily: 'Lora, serif',
            fontSize: 14,
            fill: isDungeon ? 0x6b6480 : 0xd8d0e8,
          }),
        });
        label.anchor.set(0.5, 0);
        label.position.set(poi.x, poi.y + 28);
        label.alpha = isDungeon ? 0.35 : 1.0;
        app.stage.addChild(label);

        poiGraphicsRef.current.set(poi.id, { body: g, label });
      }

      // app.stage structurally satisfies VfxStage (vfx/types.ts)
      vfxEngineRef.current = new VfxEngine(app.stage);

      // Story 7.14b: a real per-frame ticker, replacing the short-lived rAF loop
      // that previously ran only while a class-confirmation flash was live.
      // VfxEngine.update() must run every frame or effects never advance and are
      // never reaped, so the hub now needs a continuous loop — and two loops (a
      // Pixi ticker plus a bespoke rAF) would be two clocks driving one stage.
      // Registered here, in the mount-once effect, NOT in the [gameState] effect:
      // a per-update ticker.add/remove would tear the loop down on every snapshot.
      app.ticker.add(() => {
        // CLOCK CONTRACT (vfx/types.ts): one Date.now() per tick, reused below.
        const now = Date.now();
        const state = latestGameStateRef.current;
        if (state) renderFrame(state, app, playerGraphicsRef.current);

        // Ordering matches DungeonScreen exactly, and the order is load-bearing:
        // there, renderSnapshotVfx runs INSIDE renderFrame, i.e. before
        // engine.update(now). Effects created or fed this frame must be advanced
        // by the same frame's update, or every aura trail lags one frame behind
        // the dungeon's. (An earlier version of this ticker had update() first and
        // claimed to match — code review 2026-08-06.)
        //
        // Safe with respect to the invariant that put update() after renderFrame
        // in the first place: that exists because renderFrame rewrites
        // circle.alpha every frame and would clobber a borrowed-target tint pulse.
        // renderSnapshotVfx never touches circle.alpha, so it can precede update.
        if (state && vfxEngineRef.current) {
          renderSnapshotVfx({
            state, app, now,
            engine: vfxEngineRef.current,
            statusAuras: statusAurasRef.current,
            refs: vfxRuntimeRefs,
            playerRadius: PLAYER_RADIUS,
            enemyRadius: ENEMY_RADIUS,
            aimPreviewGraphics: aimPreviewGraphicsRef.current,
            colorForPlayer: (p) => SESSION_COLOR_HEX[p.sessionColor] ?? 0xffffff,
          });
        }

        // Runs even when state is null, outside the guard above, so live effects
        // keep advancing and get reaped rather than piling up.
        vfxEngineRef.current?.update(now);
      });

      // Render any state that arrived while PixiJS was initializing
      if (latestGameStateRef.current) {
        renderFrame(latestGameStateRef.current, app, playerGraphicsRef.current);
      }
    }
    void initPixi();
    return () => {
      cancelled = true;
      const app = pixiAppRef.current;
      if (app) {
        // Before app.destroy: clear() calls stage.removeChild on a live stage.
        vfxEngineRef.current?.clear();
        vfxEngineRef.current = null;
        app.canvas.remove();
        app.destroy(true, { children: true });
        pixiAppRef.current = null;
      }
      playerGraphicsRef.current.clear();
      poiGraphicsRef.current.clear();
      statusAurasRef.current.clear();
      aimPreviewGraphicsRef.current.clear();
      vfxRuntimeRefs.clear();
    };
    // vfxRuntimeRefs is stable for the component's lifetime (useVfxRuntimeRefs
    // holds it in a ref), so this stays a mount-once effect — matching
    // DungeonScreen's own initPixi effect.
  }, []);

  // Story 7.14b: drive per-class cast VFX from the same deltas DungeonScreen uses.
  // Only `ability:fired` and the two `cast:*` deltas actually arrive in the hub —
  // Story 7.14a leaves projectile/zone/chain resolution dungeon-only — so the
  // dispatcher's other branches are simply never exercised here.
  useEffect(() => {
    for (const delta of transientDeltaQueue) {
      dispatchAbilityVfx(delta, {
        engine: vfxEngineRef.current,
        gameState,
        refs: vfxRuntimeRefs,
        onCastFlash: (playerId) => {
          const entry = playerGraphicsRef.current.get(playerId);
          if (entry) entry.abilityFlashUntil = Date.now() + ABILITY_FLASH_MS;
        },
        // Spirit Nova tints the caster's own circle instead of flashing it.
        castTintTarget: (playerId) => playerGraphicsRef.current.get(playerId)?.circle ?? null,
      });
    }
    // Keyed on the queue alone, exactly like DungeonScreen's dispatch effect:
    // `gameState` is read for caster lookup but must not re-run the effect, or
    // every snapshot would replay the whole queue's visuals.
  }, [transientDeltaQueue]);

  // Story 7.14b: the render-on-gameState-change effect and its short-lived rAF
  // flash loop are both gone — the ticker registered in initPixi now renders
  // every frame from `latestGameStateRef`, which is assigned on every render.
  // The class-confirmation flash therefore animates continuously rather than
  // needing its own loop, at the same 600ms duration and the same alpha curve.

  const players = gameState?.players ?? [];
  const allClassesConfirmed = players.length > 0 && players.every(p => p.class !== null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        ref={canvasContainerRef}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* 48px top strip — HTML overlay, no border-radius at screen edges per UX-DR6 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          zIndex: 10,
          boxSizing: 'border-box',
        }}
      >
        {players.map(player => (
          <PlayerChip key={player.id} name={player.displayName} isFrozen={player.isFrozen} playerClass={player.class} />
        ))}
        <div style={{ marginLeft: 'auto' }}>
          {(gameState?.runProposal ?? null) !== null ? (
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--accent-spirit)',
            }}>
              ⚔ Vote in progress…
            </span>
          ) : (
            <button
              onClick={() => session?.sendStartGame()}
              disabled={!allClassesConfirmed}
              style={{
                background: allClassesConfirmed ? 'var(--interactive)' : 'var(--bg-surface)',
                color: allClassesConfirmed ? 'var(--bg-base)' : 'var(--text-secondary)',
                border: allClassesConfirmed ? 'none' : '1px solid var(--border)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-sm)',
                borderRadius: 6,
                height: 32,
                padding: '0 12px',
                cursor: allClassesConfirmed ? 'pointer' : 'not-allowed',
              }}
            >
              {allClassesConfirmed ? 'Start Dungeon' : 'Waiting for classes…'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerChip({ name, isFrozen, playerClass }: { name: string; isFrozen: boolean; playerClass: PlayerClass | null }) {
  const classLabel = playerClass !== null
    ? CLASS_DEFINITIONS[playerClass].displayName
    : 'Class TBD';

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: isFrozen ? '1px dashed var(--border)' : '1px solid var(--border)',
        borderRadius: 6,
        padding: '0 8px',
        height: 36,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        minWidth: 80,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-base)',
          color: isFrozen ? 'var(--text-secondary)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {classLabel}
      </span>
    </div>
  );
}

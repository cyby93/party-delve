import { useEffect, useRef } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from 'shared-types';
import { SessionColor, HUB_POIS, PoiType, PlayerClass, CLASS_DEFINITIONS } from 'shared-types';
import type { HostSession } from '../session/host-session';

interface HubWorldScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
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

interface PlayerEntry {
  circle: Graphics;
  chatBubble: Text;
  flashUntil: number;
  knownClass: PlayerClass | null;
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  poiGraphics: Map<string, { body: Graphics; label: Text }>,
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
    let entry = playerGraphics.get(player.id);
    if (!entry) {
      const circle = new Graphics();
      const chatBubble = new Text({ text: '💬', style: new TextStyle({ fontSize: 20 }) });
      chatBubble.anchor.set(0.5, 1);
      app.stage.addChild(circle);
      app.stage.addChild(chatBubble);
      entry = { circle, chatBubble, flashUntil: 0, knownClass: player.class };
      playerGraphics.set(player.id, entry);
    }
    const { circle, chatBubble } = entry;

    // Detect class confirmation and start flash
    if (entry.knownClass !== player.class && player.class !== null) {
      entry.knownClass = player.class;
      entry.flashUntil = Date.now() + 600;
    }

    // Alpha pulse during flash; frozen state overrides
    const now = Date.now();
    if (!player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil) {
      const progress = (entry.flashUntil - now) / 600; // 1.0 → 0.0 as time passes
      circle.alpha = 0.6 + 0.4 * Math.cos(2 * Math.PI * (1 - progress)); // 1→0.2→1
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

  // Training dummy targeting indicator
  const anyNearDummy = state.players.some(p => p.nearPoiId === 'training-dummy');
  const dummyEntry = poiGraphics.get('training-dummy');
  if (dummyEntry) {
    dummyEntry.body.clear();
    dummyEntry.body.roundRect(-24, -24, 48, 48, 6).fill({ color: 0xc07d35 });
    if (anyNearDummy) {
      dummyEntry.body
        .roundRect(-32, -32, 64, 64, 10)
        .stroke({ color: 0xc07d35, width: 2, alpha: 0.7 });
    }
  }
}

export function HubWorldScreen({ gameState, session: _session }: HubWorldScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const poiGraphicsRef = useRef<Map<string, { body: Graphics; label: Text }>>(new Map());
  // Always holds the latest gameState so initPixi can render it after async init
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;

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
        const color = poi.type === PoiType.CLASS_SELECT ? 0x6ea8d8
          : poi.type === PoiType.TRAINING_DUMMY ? 0xc07d35
          : 0x36334a;
        const g = new Graphics();
        g.roundRect(-24, -24, 48, 48, 6).fill({ color });
        g.position.set(poi.x, poi.y);
        g.alpha = isDungeon ? 0.35 : 1.0;
        app.stage.addChild(g);

        const label = new Text({
          text: poi.type === PoiType.CLASS_SELECT ? 'CLASS'
            : poi.type === PoiType.TRAINING_DUMMY ? 'TRAIN'
            : 'GATE',
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

      // Render any state that arrived while PixiJS was initializing
      if (latestGameStateRef.current) {
        renderFrame(latestGameStateRef.current, app, playerGraphicsRef.current, poiGraphicsRef.current);
      }
    }
    void initPixi();
    return () => {
      cancelled = true;
      const app = pixiAppRef.current;
      if (app) {
        app.canvas.remove();
        app.destroy(true, { children: true });
        pixiAppRef.current = null;
      }
      playerGraphicsRef.current.clear();
      poiGraphicsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!pixiAppRef.current || !gameState) return;
    renderFrame(gameState, pixiAppRef.current, playerGraphicsRef.current, poiGraphicsRef.current);
  }, [gameState]);

  const players = gameState?.players ?? [];

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

import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GameState } from 'shared-types';
import { SessionColor } from 'shared-types';
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

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, Graphics>,
): void {
  // Scale stage so virtual coords map to actual canvas pixels.
  // Virtual center (960, 540) always lands at screen center regardless of display size.
  app.stage.scale.set(app.screen.width / VIRTUAL_W, app.screen.height / VIRTUAL_H);

  const currentIds = new Set(state.players.map(p => p.id));

  for (const [id, g] of playerGraphics) {
    if (!currentIds.has(id)) {
      app.stage.removeChild(g);
      g.destroy();
      playerGraphics.delete(id);
    }
  }

  for (const player of state.players) {
    let g = playerGraphics.get(player.id);
    if (!g) {
      g = new Graphics();
      app.stage.addChild(g);
      playerGraphics.set(player.id, g);
    }
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    g.position.set(player.x, player.y);
    g.clear();
    g.circle(0, 0, PLAYER_RADIUS).fill({ color });
  }
}

export function HubWorldScreen({ gameState, session: _session }: HubWorldScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, Graphics>>(new Map());
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
        app.canvas.remove();
        app.destroy(true, { children: true });
        pixiAppRef.current = null;
      }
      playerGraphicsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!pixiAppRef.current || !gameState) return;
    renderFrame(gameState, pixiAppRef.current, playerGraphicsRef.current);
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
          <PlayerChip key={player.id} name={player.displayName} />
        ))}
      </div>
    </div>
  );
}

function PlayerChip({ name }: { name: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
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
          color: 'var(--text-primary)',
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
        Class TBD
      </span>
    </div>
  );
}

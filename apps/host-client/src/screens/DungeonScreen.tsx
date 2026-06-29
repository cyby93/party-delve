import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GameState } from 'shared-types';
import { SessionColor, CLASS_DEFINITIONS, PlayerClass } from 'shared-types';
import type { HostSession } from '../session/host-session';
import type { DeltaEventMsg } from 'net-protocol';

interface DungeonScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
  latestTransientDelta: DeltaEventMsg | null;
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
const KILL_FADE_MS = 300;
const ESSENCE_FLASH_MS = 400;

interface PlayerEntry {
  circle: Graphics;
  flashUntil: number;
}

interface EnemyEntry {
  circle: Graphics;
  healthBar: Graphics;
  deadUntil: number;  // 0 = alive; >0 = fading out
}

interface EssenceFlash {
  g: Graphics;
  deadline: number;
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  enemyGraphics: Map<string, EnemyEntry>,
  essenceFlashes: Map<string, EssenceFlash>,
): void {
  app.stage.scale.set(app.screen.width / VIRTUAL_W, app.screen.height / VIRTUAL_H);

  const now = Date.now();

  // ── Players ──────────────────────────────────────────────────────────────────
  const currentPlayerIds = new Set(state.players.map(p => p.id));
  for (const [id, entry] of playerGraphics) {
    if (!currentPlayerIds.has(id)) {
      app.stage.removeChild(entry.circle);
      entry.circle.destroy();
      playerGraphics.delete(id);
    }
  }

  for (const player of state.players) {
    let entry = playerGraphics.get(player.id);
    if (!entry) {
      const circle = new Graphics();
      app.stage.addChild(circle);
      entry = { circle, flashUntil: 0 };
      playerGraphics.set(player.id, entry);
    }
    const { circle } = entry;
    if (!player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil) {
      const progress = (entry.flashUntil - now) / ABILITY_FLASH_MS;
      circle.alpha = 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * progress));
    } else {
      circle.alpha = player.isFrozen ? 0.3 : 1;
    }
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    circle.position.set(player.x, player.y);
    circle.clear();
    circle.circle(0, 0, PLAYER_RADIUS).fill({ color });
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
}

export function DungeonScreen({ gameState, session: _session, latestTransientDelta }: DungeonScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const enemyGraphicsRef = useRef<Map<string, EnemyEntry>>(new Map());
  const essenceFlashesRef = useRef<Map<string, EssenceFlash>>(new Map());
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;

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
      app.ticker.add(() => {
        if (latestGameStateRef.current) {
          renderFrame(
            latestGameStateRef.current,
            app,
            playerGraphicsRef.current,
            enemyGraphicsRef.current,
            essenceFlashesRef.current,
          );
        }
      });
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
      enemyGraphicsRef.current.clear();
      essenceFlashesRef.current.clear();
    };
  }, []);

  // Handle transient delta visuals: ability flash, enemy kill fade, essence drop flash
  useEffect(() => {
    if (!latestTransientDelta) return;
    const app = pixiAppRef.current;

    if (latestTransientDelta.type === 'ability:fired') {
      const entry = playerGraphicsRef.current.get(latestTransientDelta.playerId);
      if (entry) entry.flashUntil = Date.now() + ABILITY_FLASH_MS;
    } else if (latestTransientDelta.type === 'enemy:killed') {
      const entry = enemyGraphicsRef.current.get(latestTransientDelta.enemyId);
      if (entry && entry.deadUntil === 0) entry.deadUntil = Date.now() + KILL_FADE_MS;
    } else if (latestTransientDelta.type === 'essence:dropped' && app) {
      const { drop } = latestTransientDelta;
      const g = new Graphics();
      g.position.set(drop.x, drop.y);
      g.circle(0, 0, 20).fill({ color: 0xf1c40f });
      app.stage.addChild(g);
      essenceFlashesRef.current.set(drop.id, { g, deadline: Date.now() + ESSENCE_FLASH_MS });
    }
  }, [latestTransientDelta]);

  const players = gameState?.players ?? [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={canvasContainerRef} style={{ position: 'absolute', inset: 0 }} />
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

import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Assets } from 'pixi.js';
import type { GameState, PlayerState } from 'shared-types';
import { SessionColor, CLASS_DEFINITIONS, PlayerClass } from 'shared-types';
import type { HostSession } from '../session/host-session';
import type { DeltaEventMsg } from 'net-protocol';

interface DungeonScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
  latestTransientDelta: DeltaEventMsg | null;
  runOutcome: 'complete' | 'failed' | null;
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
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    const isFlashing = !player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil;
    circle.position.set(player.x, player.y);
    circle.clear();
    if (player.isSpirit) {
      // Luminous spirit form: outer glow ring + inner circle
      circle.alpha = isFlashing
        ? 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * (entry.flashUntil - now) / ABILITY_FLASH_MS))
        : 1;
      circle.circle(0, 0, 28).fill({ color, alpha: 0.35 });
      circle.circle(0, 0, 14).fill({ color, alpha: 0.85 });
    } else {
      circle.alpha = isFlashing
        ? 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * (entry.flashUntil - now) / ABILITY_FLASH_MS))
        : (player.isFrozen ? 0.3 : 1);
      circle.circle(0, 0, PLAYER_RADIUS).fill({ color });
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

interface ReviveDeadline {
  deadline: number;
  windowMs: number;
  name: string;
}

export function DungeonScreen({ gameState, session: _session, latestTransientDelta, runOutcome }: DungeonScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const enemyGraphicsRef = useRef<Map<string, EnemyEntry>>(new Map());
  const essenceFlashesRef = useRef<Map<string, EssenceFlash>>(new Map());
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;
  const reviveDeadlinesRef = useRef<Map<string, ReviveDeadline>>(new Map());
  const [, setTimerTick] = useState(0);
  const [levelClearFlash, setLevelClearFlash] = useState(false);

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

  // Preload biome assets during Level 1 to avoid mid-combat hitches on later levels
  useEffect(() => {
    if (gameState?.session.levelIndex === 1) {
      // ponytail: no-op for alpha — wire real Grassland biome bundle URL in Epic 9
      void Assets.backgroundLoad([]);
    }
  }, [gameState?.session.levelIndex]);

  // Handle transient delta visuals: ability flash, enemy kill fade, essence drop flash, level-complete flash
  useEffect(() => {
    if (!latestTransientDelta) return;
    const app = pixiAppRef.current;

    if (latestTransientDelta.type === 'level:complete') {
      setLevelClearFlash(true);
      const flashTimer = setTimeout(() => setLevelClearFlash(false), 300);
      return () => clearTimeout(flashTimer);
    } else if (latestTransientDelta.type === 'ability:fired') {
      const entry = playerGraphicsRef.current.get(latestTransientDelta.playerId);
      if (entry) entry.flashUntil = Date.now() + ABILITY_FLASH_MS;
    } else if (latestTransientDelta.type === 'spirit-ability:fired') {
      const entry = playerGraphicsRef.current.get(latestTransientDelta.playerId);
      if (entry) entry.flashUntil = Date.now() + SPIRIT_ABILITY_FLASH_MS;
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

  // Track revive deadlines from downed/revived/spirit deltas
  useEffect(() => {
    if (!latestTransientDelta) return;
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
  }, [latestTransientDelta, gameState]);

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
        {players.map(player => (
          <PlayerChipHUD key={player.id} player={player} />
        ))}
        {gameState?.session.phase === 'dungeon' && (
          <div style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}>
            Level {gameState.session.levelIndex} — Grassland
          </div>
        )}
      </div>
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
      {/* Post-run failure overlay */}
      {gameState?.session.phase === 'post-run' && runOutcome === 'failed' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          zIndex: 50,
        }}>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-xl)',
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}>
            The run ends here.
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
            color: 'var(--accent-warm)',
          }}>
            Spirit Essence carried: {gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}>
            Full run summary coming in Epic 4.
          </div>
        </div>
      )}
      {/* Post-run success overlay */}
      {gameState?.session.phase === 'post-run' && runOutcome === 'complete' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          zIndex: 50,
        }}>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-xl)',
            color: 'var(--accent-spirit)',
            textAlign: 'center',
          }}>
            Level Clear.
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
            color: 'var(--accent-warm)',
          }}>
            Spirit Essence carried: {gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)}
          </div>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}>
            Full run summary coming in Epic 4.
          </div>
        </div>
      )}
      {/* Post-run fallback: outcome delta not yet received (packet loss / reconnect) */}
      {gameState?.session.phase === 'post-run' && runOutcome === null && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Run ended.
          </div>
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

function PlayerChipHUD({ player }: { player: PlayerState }) {
  const pips = [0, 1, 2, 3, 4].map(i => player.hp > i * 20);
  const spiritGlow = player.isSpirit ? { boxShadow: '0 0 6px var(--accent-spirit)' } : {};

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: player.isFrozen ? '1px dashed var(--border)' : '1px solid var(--border)',
        borderRadius: 6,
        padding: '2px 8px',
        height: 40,
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
          color: (player.isFrozen || player.isSpirit) ? 'var(--text-secondary)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 80,
        }}
      >
        {player.displayName}
      </span>
      {player.isSpirit ? (
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
    </div>
  );
}

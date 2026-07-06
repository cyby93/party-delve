import { useEffect, useRef, useState } from 'react';
import { Application, Graphics, Assets } from 'pixi.js';
import type { GameState, PlayerState } from 'shared-types';
import { SessionColor, CLASS_DEFINITIONS, PlayerClass, BossPhase, PURIFICATION_PULSE_DURATION_MS, REWARD_REVEAL_DURATION_MS } from 'shared-types';
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

interface PurificationPulse {
  graphic: Graphics;
  startTime: number;
  originX: number;
  originY: number;
  duration: number;
}

interface PurificationParticle {
  graphic: Graphics;
  startTime: number;
  vx: number;
  vy: number;
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  enemyGraphics: Map<string, EnemyEntry>,
  essenceFlashes: Map<string, EssenceFlash>,
  tetherGraphics: Map<string, Graphics>,
  isPurified: boolean,
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
      const color = parseInt(bond.color.slice(1), 16);
      g.moveTo(pA.x, pA.y).lineTo(pB.x, pB.y).stroke({ color, width: 2, alpha: 0.7 });
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
}

interface ReviveDeadline {
  deadline: number;
  windowMs: number;
  name: string;
}

export function DungeonScreen({ gameState, session, latestTransientDelta }: DungeonScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerGraphicsRef = useRef<Map<string, PlayerEntry>>(new Map());
  const enemyGraphicsRef = useRef<Map<string, EnemyEntry>>(new Map());
  const essenceFlashesRef = useRef<Map<string, EssenceFlash>>(new Map());
  const tetherGraphicsRef = useRef<Map<string, Graphics>>(new Map());
  const latestGameStateRef = useRef<GameState | null>(null);
  latestGameStateRef.current = gameState;
  const reviveDeadlinesRef = useRef<Map<string, ReviveDeadline>>(new Map());
  const bossGraphicsRef = useRef<Graphics | null>(null);
  const bossPhaseRef = useRef<BossPhase | null>(null);
  const lastBossHpRef = useRef<number | null>(null);
  const bossDefeatedRef = useRef(false);
  const isPurifiedRef = useRef(false);
  const purificationPulseRef = useRef<PurificationPulse | null>(null);
  const rewardRevealActiveRef = useRef(false);
  const bossLastPositionRef = useRef({ x: 960, y: 540 });
  const essenceDisplayRef = useRef<number | null>(null);
  const purificationParticlesRef = useRef<PurificationParticle[]>([]);
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
      app.ticker.add(() => {
        const state = latestGameStateRef.current;
        if (!state) return;
        renderFrame(
          state,
          app,
          playerGraphicsRef.current,
          enemyGraphicsRef.current,
          essenceFlashesRef.current,
          tetherGraphicsRef.current,
          isPurifiedRef.current,
        );

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
          app.stage.removeChild(bossGraphicsRef.current);
          bossGraphicsRef.current.destroy();
          bossGraphicsRef.current = null;
        }

        // Purification pulse animation
        const pulse = purificationPulseRef.current;
        if (pulse) {
          const elapsed = performance.now() - pulse.startTime;
          const t = Math.min(elapsed / pulse.duration, 1);
          const radius = t * 1400;
          const alpha = 0.6 * (1 - t);
          pulse.graphic.clear();
          pulse.graphic.circle(0, 0, radius).fill({ color: 0x90d8f0, alpha });
          if (t >= 1) {
            app.stage.removeChild(pulse.graphic);
            pulse.graphic.destroy();
            purificationPulseRef.current = null;
            rewardRevealActiveRef.current = true;
            setRewardRevealVisible(true);
            setVoiceVisible(true);
          }
        }

        // Reward reveal particles (8-12 bursting circles)
        const PARTICLE_DURATION_MS = 1000;
        const particles = purificationParticlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]!;
          const elapsed = performance.now() - p.startTime;
          const t = Math.min(elapsed / PARTICLE_DURATION_MS, 1);
          p.graphic.position.set(
            VIRTUAL_W / 2 + p.vx * elapsed,
            VIRTUAL_H / 2 + p.vy * elapsed,
          );
          p.graphic.alpha = 1 - t;
          if (t >= 1) {
            app.stage.removeChild(p.graphic);
            p.graphic.destroy();
            particles.splice(i, 1);
          }
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
      if (bossGraphicsRef.current) {
        bossGraphicsRef.current.destroy();
        bossGraphicsRef.current = null;
      }
      purificationPulseRef.current = null;
      purificationParticlesRef.current = [];
      bossDefeatedRef.current = false;
      isPurifiedRef.current = false;
      rewardRevealActiveRef.current = false;
      playerGraphicsRef.current.clear();
      enemyGraphicsRef.current.clear();
      essenceFlashesRef.current.clear();
      tetherGraphicsRef.current.clear();
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

    if (latestTransientDelta.type === 'bond:assigned') {
      // ponytail: level:complete flash may be skipped when bond-moment follows in same batch; deferred
      const nameA = gameState?.players.find(p => p.id === latestTransientDelta.playerA)?.displayName ?? latestTransientDelta.playerA;
      const nameB = gameState?.players.find(p => p.id === latestTransientDelta.playerB)?.displayName ?? latestTransientDelta.playerB;
      const label = latestTransientDelta.bondType === 'fate' ? 'Fate' : 'Proximity';
      // ponytail: timers live in a separate effect keyed on trigger counter so they survive latestTransientDelta being cleared at 400ms
      setBondOverlay({ text: `${nameA} · ${nameB} — ${label} Bond`, fading: false });
      setBondOverlayTrigger(c => c + 1);
    } else if (latestTransientDelta.type === 'level:complete') {
      setLevelClearFlash(true);
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
    } else if (latestTransientDelta.type === 'boss:phaseChanged') {
      bossPhaseRef.current = latestTransientDelta.newPhase;
    } else if (latestTransientDelta.type === 'boss:damaged') {
      const prevHp = lastBossHpRef.current;
      const damage = prevHp != null ? Math.max(0, prevHp - latestTransientDelta.newHp) : 0;
      lastBossHpRef.current = latestTransientDelta.newHp;
      setBossDamageFlash({ amount: damage, until: Date.now() + 800 });
      setTimeout(() => setBossDamageFlash(null), 800);
    } else if (latestTransientDelta.type === 'boss:stomped' && app) {
      const ring = new Graphics();
      ring.circle(0, 0, latestTransientDelta.radius).stroke({ color: 0xff4444, width: 3, alpha: 0.7 });
      ring.position.set(latestTransientDelta.x, latestTransientDelta.y);
      app.stage.addChild(ring);
      setTimeout(() => {
        app.stage.removeChild(ring);
        ring.destroy();
      }, 66);
    } else if (latestTransientDelta.type === 'boss:defeated' && app) {
      bossDefeatedRef.current = true;
      isPurifiedRef.current = true;
      setIsPurified(true);
      essenceDisplayRef.current = latestTransientDelta.reward.essenceTotal;
      // Record boss last position for pulse origin (fall back to arena center)
      const bossPos = bossLastPositionRef.current;
      // Background color swap: light purification tint
      app.renderer.background.color = 0x90d8f0;
      // Create purification pulse circle
      const pulseGraphic = new Graphics();
      pulseGraphic.position.set(bossPos.x, bossPos.y);
      app.stage.addChild(pulseGraphic);
      purificationPulseRef.current = {
        graphic: pulseGraphic,
        startTime: performance.now(),
        originX: bossPos.x,
        originY: bossPos.y,
        duration: PURIFICATION_PULSE_DURATION_MS,
      };
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

  // Bond overlay fade/clear lifecycle — keyed on trigger counter so timers survive latestTransientDelta being cleared at 400ms
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

  // Reward reveal: spawn particles and set voice line hide timer
  useEffect(() => {
    if (!rewardRevealVisible) return;
    const app = pixiAppRef.current;
    if (app) {
      const PARTICLE_COLORS = [0x6ea8d8, 0xf0c070];
      const count = 8 + Math.floor(Math.random() * 5); // 8-12
      for (let i = 0; i < count; i++) {
        const g = new Graphics();
        const color = PARTICLE_COLORS[i % 2]!;
        g.circle(0, 0, 8 + Math.random() * 8).fill({ color });
        g.position.set(VIRTUAL_W / 2, VIRTUAL_H / 2);
        app.stage.addChild(g);
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 0.1 + Math.random() * 0.15; // pixels per ms
        purificationParticlesRef.current.push({
          graphic: g,
          startTime: performance.now(),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        });
      }
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

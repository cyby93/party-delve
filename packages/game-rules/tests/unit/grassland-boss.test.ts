import { describe, it, expect } from 'vitest';
import { BossPhase, BossFSMState, DifficultyTier } from 'shared-types';
import type { BossState, GameState, PlayerState } from 'shared-types';
import { SessionColor, PlayerClass } from 'shared-types';
import { createBossState, tickBoss } from '../../src/entities/grassland-boss.js';
import type { BossAddSpawnedEvent } from '../../src/entities/grassland-boss.js';
import { BOSS_GRASSLAND_MAX_HP, BOSS_PHASE2_STOMP_COOLDOWN_TICKS } from '../../src/balance.js';
import { BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO, BOSS_REWARD_ESSENCE_BASE } from 'shared-types';

function makeBossState(overrides: Partial<BossState> = {}): BossState {
  return Object.assign(createBossState(42), overrides);
}

function makeGameState(playerCount: number, downCount = 0, spiritCount = 0): GameState {
  const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    displayName: `P${i}`,
    class: PlayerClass.STONEHIDE,
    x: 200,
    y: 200,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: i < downCount,
    isSpirit: i >= downCount && i < downCount + spiritCount,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
    statusEffects: [],
    channelingAbility: null,
  }));
  return {
    session: {
      roomId: 'test', hostId: 'h', phase: 'dungeon', playerCount,
      maxPlayers: 8, runSeed: 0, levelIndex: 3, difficulty: null,
      levelObjective: 'clear', waveIndex: 0, totalWaves: 0,
      bossLevelStartedAt: 0, anyPlayerDownedDuringBoss: false, allBondsAtBossStart: false,
    },
    players, enemies: [], activeBonds: [], essenceDrops: [],
    tick: 0, floorLayout: null, runProposal: null,
    boss: null,
    projectiles: [], zones: [],
  };
}

const SPAWN_POINTS = [{ x: 100, y: 100 }, { x: 800, y: 100 }, { x: 100, y: 800 }, { x: 800, y: 800 }];

describe('createBossState', () => {
  it('initializes all fields correctly', () => {
    const boss = createBossState(42);
    expect(boss.hp).toBe(BOSS_GRASSLAND_MAX_HP);
    expect(boss.maxHp).toBe(BOSS_GRASSLAND_MAX_HP);
    expect(boss.phase).toBe(BossPhase.Phase1);
    expect(boss.isDefeated).toBe(false);
    expect(boss.fsmState).toBe(BossFSMState.IDLE);
    expect(boss.attackCooldownTicks).toBe(0);
    expect(boss.id).toBe('boss-grassland-42');
  });
});

describe('tickBoss — zero alive players', () => {
  it('returns empty events without crash when all players are down', () => {
    const boss = makeBossState({ hp: 1000 });
    const state = makeGameState(4, 4);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('returns empty events without crash when all players are in spirit form', () => {
    const boss = makeBossState({ hp: 1000 });
    const state = makeGameState(4, 0, 4);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('tickBoss — phase transitions', () => {
  it('Phase 1 → Phase 2 on Easy at correct HP threshold', () => {
    const thresholdHp = Math.floor(BOSS_PHASE2_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.EASY, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const phaseEvt = result.value.find(e => e.type === 'boss:phaseChanged');
    expect(phaseEvt).toBeDefined();
    expect((phaseEvt as { newPhase: BossPhase }).newPhase).toBe(BossPhase.Phase2);
    expect(boss.phase).toBe(BossPhase.Phase2);
  });

  it('Phase 1 → Phase 2 on Normal at correct HP threshold', () => {
    const thresholdHp = Math.floor(BOSS_PHASE2_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some(e => e.type === 'boss:phaseChanged')).toBe(true);
    expect(boss.phase).toBe(BossPhase.Phase2);
  });

  it('Phase 1 → Phase 2 on Hard at correct HP threshold', () => {
    const thresholdHp = Math.floor(BOSS_PHASE2_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some(e => e.type === 'boss:phaseChanged')).toBe(true);
    expect(boss.phase).toBe(BossPhase.Phase2);
  });

  it('Phase 2 → Phase 3 only on Hard', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const phaseEvt = result.value.find(e => e.type === 'boss:phaseChanged');
    expect(phaseEvt).toBeDefined();
    expect((phaseEvt as { newPhase: BossPhase }).newPhase).toBe(BossPhase.Phase3);
    expect(boss.phase).toBe(BossPhase.Phase3);
  });

  it('Phase 3 does NOT trigger on Easy', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.EASY, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some(e => e.type === 'boss:phaseChanged')).toBe(false);
    expect(boss.phase).toBe(BossPhase.Phase2);
  });

  it('Phase 3 does NOT trigger on Normal', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some(e => e.type === 'boss:phaseChanged')).toBe(false);
    expect(boss.phase).toBe(BossPhase.Phase2);
  });

  it('phase transition emits exactly once (guard prevents re-emission)', () => {
    const thresholdHp = Math.floor(BOSS_PHASE2_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp });
    const state = makeGameState(2);
    tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(boss.phase).toBe(BossPhase.Phase2);
    // second tick at same HP — guard prevents another phase event
    const result2 = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;
    expect(result2.value.filter(e => e.type === 'boss:phaseChanged').length).toBe(0);
  });
});

describe('tickBoss — GrasslandAdd spawning on Phase 3 (Hard)', () => {
  it('spawns BOSS_ADD_COUNT_HARD adds when Phase 3 triggers on Hard', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const addEvts = result.value.filter(e => e.type === 'add:spawned');
    expect(addEvts.length).toBe(3);
  });

  it('cycles spawn positions from spawnPoints array', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const pts = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const result = tickBoss(boss, state, DifficultyTier.HARD, pts, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const addEvts = result.value.filter(e => e.type === 'add:spawned') as Array<{ x: number; y: number }>;
    expect(addEvts[0]).toMatchObject({ x: 10, y: 20 });
    expect(addEvts[1]).toMatchObject({ x: 30, y: 40 });
    expect(addEvts[2]).toMatchObject({ x: 10, y: 20 }); // cycles
  });

  it('uses fallback position when spawnPoints is empty', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.HARD, [], 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const addEvts = result.value.filter(e => e.type === 'add:spawned') as Array<{ x: number; y: number }>;
    expect(addEvts.length).toBe(3);
    addEvts.forEach(e => { expect(e.x).toBe(960); expect(e.y).toBe(200); });
  });
});

describe('tickBoss — phase transition capped at one per tick (DN1)', () => {
  it('does not cascade from Phase 1 to Phase 3 in a single tick on Hard', () => {
    // HP below BOTH thresholds simultaneously on Hard
    const hp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP) - 1;
    const boss = makeBossState({ hp });
    expect(boss.phase).toBe(BossPhase.Phase1);
    const state = makeGameState(2);
    const result = tickBoss(boss, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only Phase 1→2 should fire; Phase 2→3 is deferred to the next tick
    expect(boss.phase).toBe(BossPhase.Phase2);
    const phaseEvts = result.value.filter(e => e.type === 'boss:phaseChanged');
    expect(phaseEvts.length).toBe(1);
    expect((phaseEvts[0] as { newPhase: BossPhase }).newPhase).toBe(BossPhase.Phase2);
    // No adds on this tick
    expect(result.value.some(e => e.type === 'add:spawned')).toBe(false);
  });
});

describe('tickBoss — layer cooldowns persist (P1)', () => {
  it('stomp does not fire on consecutive ticks within cooldown window', () => {
    // Place boss within stomp range (250px) of players at (200,200)
    const boss = makeBossState({ hp: 1800, phase: BossPhase.Phase2 });
    boss.position = { x: 200, y: 300 }; // distance = 100 <= BOSS_STOMP_ACTIVATION_RANGE=250
    const state = makeGameState(2);
    const r1 = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.some(e => e.type === 'boss:stomped')).toBe(true);
    expect(boss.stompCooldownTicks).toBe(BOSS_PHASE2_STOMP_COOLDOWN_TICKS);
    // Tick 2: stomp must NOT fire (on cooldown)
    const r2 = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.some(e => e.type === 'boss:stomped')).toBe(false);
    expect(boss.stompCooldownTicks).toBe(BOSS_PHASE2_STOMP_COOLDOWN_TICKS - 1);
  });
});

describe('tickBoss — deterministic add IDs (DN2)', () => {
  it('add:spawned enemyIds are identical across two runs with same seed and tick', () => {
    const thresholdHp = Math.floor(BOSS_PHASE3_HP_RATIO * BOSS_GRASSLAND_MAX_HP);
    const boss1 = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const boss2 = makeBossState({ hp: thresholdHp, phase: BossPhase.Phase2 });
    const state = makeGameState(2); // tick: 0, runSeed: 0
    const r1 = tickBoss(boss1, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    const r2 = tickBoss(boss2, state, DifficultyTier.HARD, SPAWN_POINTS, 0);
    if (!r1.ok || !r2.ok) return;
    const ids1 = r1.value.filter(e => e.type === 'add:spawned').map(e => (e as BossAddSpawnedEvent).enemyId);
    const ids2 = r2.value.filter(e => e.type === 'add:spawned').map(e => (e as BossAddSpawnedEvent).enemyId);
    expect(ids1).toEqual(ids2);
    expect(ids1.length).toBe(3);
  });
});

describe('tickBoss — defeat', () => {
  it('sets isDefeated and emits BossDefeatedEvt', () => {
    const boss = makeBossState({ hp: 0 });
    const state = makeGameState(4);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(boss.isDefeated).toBe(true);
    const defeatEvt = result.value.find(e => e.type === 'boss:defeated');
    expect(defeatEvt).toBeDefined();
  });

  it('already-defeated boss returns empty events', () => {
    const boss = makeBossState({ hp: 0, isDefeated: true });
    const state = makeGameState(4);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it('reward: 4-player run, 2 alive, 2 in spirit form → correct essenceTotal and equal per-player split', () => {
    const boss = makeBossState({ hp: 0 });
    // 2 alive, 2 spirit (isSpirit=true means not alive)
    const state = makeGameState(4, 0, 2);
    const result = tickBoss(boss, state, DifficultyTier.NORMAL, SPAWN_POINTS, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const defeatEvt = result.value.find(e => e.type === 'boss:defeated') as { reward: { essenceTotal: number; perPlayer: Array<{ essence: number }> } } | undefined;
    expect(defeatEvt).toBeDefined();
    if (!defeatEvt) return;
    const { reward } = defeatEvt;
    // aliveCount = 2; essenceTotal = 200 + 2*50 = 300
    expect(reward.essenceTotal).toBe(300);
    // perPlayer: floor(300 / 4) = 75 each
    expect(reward.perPlayer.length).toBe(4);
    reward.perPlayer.forEach(p => expect(p.essence).toBe(75));
  });
});

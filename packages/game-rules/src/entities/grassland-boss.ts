import { BossPhase, BossFSMState, DifficultyTier, BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO, BOSS_REWARD_ESSENCE_BASE } from 'shared-types';
import type { BossState, RunReward, GameState } from 'shared-types';
import type { Result, GameError } from '../state/result.js';
import type { EnemyContext } from '../systems/ai/fsm.js';
import {
  BOSS_GRASSLAND_MAX_HP,
  BOSS_CHASE_RANGE, BOSS_ATTACK_RANGE, BOSS_CHASE_SPEED, BOSS_ATTACK_COOLDOWN_TICKS,
  BOSS_STOMP_ACTIVATION_RANGE, BOSS_STOMP_RADIUS, BOSS_PHASE2_STOMP_COOLDOWN_TICKS,
  BOSS_CHARGE_ACTIVATION_MIN, BOSS_CHARGE_ACTIVATION_MAX, BOSS_CHARGE_SPEED, BOSS_CHARGE_COOLDOWN_TICKS,
  BOSS_REWARD_PER_ALIVE_PLAYER, BOSS_ADD_COUNT_HARD,
} from '../balance.js';

export type BossMovedEvent      = { type: 'boss:moved';       bossId: string; x: number; y: number };
export type BossStompedEvent    = { type: 'boss:stomped';     bossId: string; x: number; y: number; radius: number };
export type BossChargedEvent    = { type: 'boss:charged';     bossId: string; x: number; y: number };
export type BossPhaseChangedEvt = { type: 'boss:phaseChanged'; bossId: string; newPhase: BossPhase };
export type BossDefeatedEvt     = { type: 'boss:defeated';    bossId: string; reward: RunReward };
export type BossAddSpawnedEvent = { type: 'add:spawned';      enemyId: string; x: number; y: number };

export type BossEvent =
  | BossMovedEvent
  | BossStompedEvent
  | BossChargedEvent
  | BossPhaseChangedEvt
  | BossDefeatedEvt
  | BossAddSpawnedEvent;

export function createBossState(runSeed: number): BossState {
  return {
    id: `boss-grassland-${runSeed}`,
    entityType: 'grassland-boss',
    hp: BOSS_GRASSLAND_MAX_HP,
    maxHp: BOSS_GRASSLAND_MAX_HP,
    phase: BossPhase.Phase1,
    position: { x: 960, y: 540 },
    isDefeated: false,
    fsmState: BossFSMState.IDLE,
    attackCooldownTicks: 0,
    stompCooldownTicks: 0,
    chargeCooldownTicks: 0,
  };
}

function buildBossContext(boss: BossState, state: GameState, nowMs: number): EnemyContext {
  // nowMs is unused today — BossState has no statusEffects (out of scope per 3.12's
  // Non-goals), so the boss never reads a slow multiplier off this context. Threaded
  // through as the real tick timestamp anyway (not a hardcoded 0) so a future boss
  // slow-effect wiring through this same context builder doesn't silently read every
  // effect as permanently active.
  const alivePlayers = state.players.filter(p => !p.isDown && !p.isSpirit);
  if (alivePlayers.length === 0) {
    return { nearestPlayerPos: null, nearestPlayerDistance: Infinity, dt: 1 / 30, nowMs };
  }
  let nearest = alivePlayers[0]!;
  let minDist = Infinity;
  for (const p of alivePlayers) {
    const dx = p.x - boss.position.x;
    const dy = p.y - boss.position.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) { minDist = d; nearest = p; }
  }
  return { nearestPlayerPos: { x: nearest.x, y: nearest.y }, nearestPlayerDistance: minDist, dt: 1 / 30, nowMs };
}

function computeRunReward(state: GameState): RunReward {
  const alive = state.players.filter(p => !p.isDown && !p.isSpirit);
  const essenceTotal = BOSS_REWARD_ESSENCE_BASE + alive.length * BOSS_REWARD_PER_ALIVE_PLAYER;
  const perShare = Math.floor(essenceTotal / Math.max(1, state.players.length));
  return {
    essenceTotal,
    perPlayer: state.players.map(p => ({ playerId: p.id, essence: perShare, masteryMilestones: [] })),
    achievements: [], // ponytail: achievements filled by Story 6.5
  };
}

// Returns events if charge fires, null if on cooldown or out of range.
// Mutates boss.chargeCooldownTicks in both cases.
function tryCharge(boss: BossState, ctx: EnemyContext): BossEvent[] | null {
  if (boss.chargeCooldownTicks > 0) { boss.chargeCooldownTicks--; return null; }
  if (!ctx.nearestPlayerPos) return null;
  if (ctx.nearestPlayerDistance < BOSS_CHARGE_ACTIVATION_MIN || ctx.nearestPlayerDistance > BOSS_CHARGE_ACTIVATION_MAX) return null;
  const dx = ctx.nearestPlayerPos.x - boss.position.x;
  const dy = ctx.nearestPlayerPos.y - boss.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  boss.chargeCooldownTicks = BOSS_CHARGE_COOLDOWN_TICKS;
  const dist = Math.min(len, BOSS_CHARGE_SPEED * ctx.dt);
  boss.position.x += (dx / len) * dist;
  boss.position.y += (dy / len) * dist;
  return [{ type: 'boss:charged', bossId: boss.id, x: boss.position.x, y: boss.position.y }];
}

// Returns events if stomp fires, null if on cooldown or out of range.
// Mutates boss.stompCooldownTicks in both cases.
function tryStomp(boss: BossState, ctx: EnemyContext, cooldown: number): BossEvent[] | null {
  if (boss.stompCooldownTicks > 0) { boss.stompCooldownTicks--; return null; }
  if (ctx.nearestPlayerDistance > BOSS_STOMP_ACTIVATION_RANGE) return null;
  boss.stompCooldownTicks = cooldown;
  return [{ type: 'boss:stomped', bossId: boss.id, x: boss.position.x, y: boss.position.y, radius: BOSS_STOMP_RADIUS }];
}

function tickBossIdle(boss: BossState, ctx: EnemyContext): BossEvent[] {
  if (ctx.nearestPlayerDistance <= BOSS_CHASE_RANGE) {
    boss.fsmState = BossFSMState.CHASE;
  }
  return [];
}

function tickBossChase(boss: BossState, ctx: EnemyContext): BossEvent[] {
  if (ctx.nearestPlayerDistance > BOSS_CHASE_RANGE) {
    boss.fsmState = BossFSMState.IDLE;
    return [];
  }
  if (ctx.nearestPlayerDistance <= BOSS_ATTACK_RANGE) {
    boss.fsmState = BossFSMState.ATTACK;
    boss.attackCooldownTicks = BOSS_ATTACK_COOLDOWN_TICKS;
    return [];
  }
  if (!ctx.nearestPlayerPos) return [];
  const dx = ctx.nearestPlayerPos.x - boss.position.x;
  const dy = ctx.nearestPlayerPos.y - boss.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];
  const move = BOSS_CHASE_SPEED * ctx.dt;
  boss.position.x += (dx / len) * move;
  boss.position.y += (dy / len) * move;
  return [{ type: 'boss:moved', bossId: boss.id, x: boss.position.x, y: boss.position.y }];
}

function tickBossAttack(boss: BossState): BossEvent[] {
  if (boss.attackCooldownTicks > 0) {
    boss.attackCooldownTicks--;
    if (boss.attackCooldownTicks === 0) {
      boss.fsmState = BossFSMState.IDLE;
    }
  }
  return [];
}

function tickBossBaseFSM(boss: BossState, ctx: EnemyContext): BossEvent[] {
  switch (boss.fsmState) {
    case BossFSMState.IDLE:   return tickBossIdle(boss, ctx);
    case BossFSMState.CHASE:  return tickBossChase(boss, ctx);
    case BossFSMState.ATTACK: return tickBossAttack(boss);
  }
}

export function tickBoss(
  boss: BossState,
  state: GameState,
  difficulty: DifficultyTier,
  spawnPoints: ReadonlyArray<{ x: number; y: number }>,
  nowMs: number,
): Result<BossEvent[], GameError> {
  if (boss.isDefeated) return { ok: true, value: [] };

  if (boss.hp <= 0) {
    boss.isDefeated = true;
    const reward = computeRunReward(state);
    return { ok: true, value: [{ type: 'boss:defeated', bossId: boss.id, reward }] };
  }

  const ctx = buildBossContext(boss, state, nowMs);
  if (ctx.nearestPlayerPos === null) return { ok: true, value: [] };

  const phaseEvents: BossEvent[] = [];

  // else if caps at one phase transition per tick (DN1 fix)
  if (boss.phase === BossPhase.Phase1 && boss.hp <= BOSS_PHASE2_HP_RATIO * boss.maxHp) {
    boss.phase = BossPhase.Phase2;
    phaseEvents.push({ type: 'boss:phaseChanged', bossId: boss.id, newPhase: BossPhase.Phase2 });
  } else if (boss.phase === BossPhase.Phase2 && boss.hp <= BOSS_PHASE3_HP_RATIO * boss.maxHp && difficulty === DifficultyTier.HARD) {
    boss.phase = BossPhase.Phase3;
    phaseEvents.push({ type: 'boss:phaseChanged', bossId: boss.id, newPhase: BossPhase.Phase3 });
    const fallback = { x: 960, y: 200 };
    for (let i = 0; i < BOSS_ADD_COUNT_HARD; i++) {
      const pos = spawnPoints.length > 0 ? spawnPoints[i % spawnPoints.length]! : fallback;
      // deterministic ID: seed + tick + index (DN2 fix)
      phaseEvents.push({ type: 'add:spawned', enemyId: `boss-add-${state.session.runSeed}-${state.tick}-${i}`, x: pos.x, y: pos.y });
    }
  }

  // Behavior layers — cooldowns tracked on boss state, not in discarded layer instances
  const stompCooldown = boss.phase === BossPhase.Phase1 ? 240 : BOSS_PHASE2_STOMP_COOLDOWN_TICKS;

  if (boss.phase !== BossPhase.Phase1 && difficulty !== DifficultyTier.EASY) {
    const chargeEvents = tryCharge(boss, ctx);
    if (chargeEvents) return { ok: true, value: [...phaseEvents, ...chargeEvents] };
  }

  const stompEvents = tryStomp(boss, ctx, stompCooldown);
  if (stompEvents) return { ok: true, value: [...phaseEvents, ...stompEvents] };

  return { ok: true, value: [...phaseEvents, ...tickBossBaseFSM(boss, ctx)] };
}

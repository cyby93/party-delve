import { EnemyFSMState } from 'shared-types';
import type { EnemyState } from 'shared-types';
import type { Result, GameError } from '../../state/result.js';
import {
  ENEMY_CHASE_RANGE, ENEMY_ATTACK_RANGE,
  ENEMY_CHASE_SPEED, ENEMY_ATTACK_COOLDOWN_TICKS,
} from '../../balance.js';

// Local event types — structurally identical to DeltaEventMsg variants in net-protocol.
// The sim server assigns EnemyAIEvent to DeltaEventMsg via structural typing — no cast needed.
export type EnemyMovedEvent   = { type: 'enemy:moved';   enemyId: string; x: number; y: number };
export type EnemyStompedEvent = { type: 'enemy:stomped'; enemyId: string; x: number; y: number; radius: number };
export type EnemyAIEvent      = EnemyMovedEvent | EnemyStompedEvent;

export interface EnemyContext {
  nearestPlayerPos: { x: number; y: number } | null;
  nearestPlayerDistance: number;
  dt: number;
}

export interface BehaviorLayer {
  shouldActivate(ctx: EnemyContext): boolean;
  execute(enemy: EnemyState, ctx: EnemyContext): EnemyAIEvent[];
  cooldown: number;
  currentCooldown: number;
}

const VALID_FSM_STATES = new Set(Object.values(EnemyFSMState));

export function tickEnemy(
  enemy: EnemyState,
  ctx: EnemyContext,
  layers: BehaviorLayer[],
): Result<EnemyAIEvent[], GameError> {
  if (!VALID_FSM_STATES.has(enemy.fsmState)) {
    return { ok: false, error: { code: 'INVALID_FSM_STATE', message: `Unknown fsmState: ${String(enemy.fsmState)}` } };
  }

  for (const layer of layers) {
    if (layer.currentCooldown === 0 && layer.shouldActivate(ctx)) {
      layer.currentCooldown = layer.cooldown;
      return { ok: true, value: layer.execute(enemy, ctx) };
    }
    if (layer.currentCooldown > 0) layer.currentCooldown--;
  }

  return { ok: true, value: tickBaseFSM(enemy, ctx) };
}

// Exported for unit testing only — call tickEnemy in production code.
export function tickBaseFSM(enemy: EnemyState, ctx: EnemyContext): EnemyAIEvent[] {
  switch (enemy.fsmState) {
    case EnemyFSMState.IDLE:   return tickIdle(enemy, ctx);
    case EnemyFSMState.CHASE:  return tickChase(enemy, ctx);
    case EnemyFSMState.ATTACK: return tickAttack(enemy);
  }
}

function tickIdle(enemy: EnemyState, ctx: EnemyContext): EnemyAIEvent[] {
  if (ctx.nearestPlayerDistance <= ENEMY_CHASE_RANGE) {
    enemy.fsmState = EnemyFSMState.CHASE;
  }
  return [];
}

function tickChase(enemy: EnemyState, ctx: EnemyContext): EnemyAIEvent[] {
  if (ctx.nearestPlayerDistance > ENEMY_CHASE_RANGE) {
    enemy.fsmState = EnemyFSMState.IDLE;
    return [];
  }
  if (ctx.nearestPlayerDistance <= ENEMY_ATTACK_RANGE) {
    enemy.fsmState = EnemyFSMState.ATTACK;
    enemy.attackCooldownTicks = ENEMY_ATTACK_COOLDOWN_TICKS;
    return [];
  }
  if (!ctx.nearestPlayerPos) return [];

  const dx = ctx.nearestPlayerPos.x - enemy.x;
  const dy = ctx.nearestPlayerPos.y - enemy.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];

  const moveAmount = ENEMY_CHASE_SPEED * ctx.dt;
  enemy.x += (dx / len) * moveAmount;
  enemy.y += (dy / len) * moveAmount;

  return [{ type: 'enemy:moved', enemyId: enemy.id, x: enemy.x, y: enemy.y }];
}

function tickAttack(enemy: EnemyState): EnemyAIEvent[] {
  if (enemy.attackCooldownTicks > 0) {
    enemy.attackCooldownTicks--;
    if (enemy.attackCooldownTicks === 0) {
      enemy.fsmState = EnemyFSMState.IDLE;
    }
  }
  return [];
}

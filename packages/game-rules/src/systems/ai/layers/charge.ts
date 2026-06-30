import type { EnemyState } from 'shared-types';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent } from '../fsm.js';
import {
  CHARGE_ACTIVATION_MIN, CHARGE_ACTIVATION_MAX,
  CHARGE_SPEED, CHARGE_COOLDOWN_TICKS,
} from '../../../balance.js';

export class ChargeLayer implements BehaviorLayer {
  cooldown = CHARGE_COOLDOWN_TICKS;
  currentCooldown = 0;

  shouldActivate(ctx: EnemyContext): boolean {
    return (
      ctx.nearestPlayerDistance >= CHARGE_ACTIVATION_MIN &&
      ctx.nearestPlayerDistance <= CHARGE_ACTIVATION_MAX
    );
  }

  execute(enemy: EnemyState, ctx: EnemyContext): EnemyAIEvent[] {
    if (!ctx.nearestPlayerPos) return [];

    const dx = ctx.nearestPlayerPos.x - enemy.x;
    const dy = ctx.nearestPlayerPos.y - enemy.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return [];

    const chargeDistance = Math.min(len, CHARGE_SPEED * ctx.dt);
    enemy.x += (dx / len) * chargeDistance;
    enemy.y += (dy / len) * chargeDistance;

    return [{ type: 'enemy:moved', enemyId: enemy.id, x: enemy.x, y: enemy.y }];
  }
}

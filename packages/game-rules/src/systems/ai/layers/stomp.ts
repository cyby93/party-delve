import type { EnemyState } from 'shared-types';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent } from '../fsm.js';
import { STOMP_ACTIVATION_RANGE, STOMP_RADIUS, STOMP_COOLDOWN_TICKS } from '../../../balance.js';

export class StompLayer implements BehaviorLayer {
  cooldown = STOMP_COOLDOWN_TICKS;
  currentCooldown = 0;

  shouldActivate(ctx: EnemyContext): boolean {
    return ctx.nearestPlayerDistance <= STOMP_ACTIVATION_RANGE;
  }

  execute(enemy: EnemyState, _ctx: EnemyContext): EnemyAIEvent[] {
    return [{
      type: 'enemy:stomped',
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      radius: STOMP_RADIUS,
    }];
  }
}

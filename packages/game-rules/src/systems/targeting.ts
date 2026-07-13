import type { PlayerState, EnemyState } from 'shared-types';

export interface MixedFactionSplit {
  allies: PlayerState[];
  enemies: EnemyState[];
}

// Faction is derived structurally (PlayerState has `class`, EnemyState doesn't) —
// no stored faction field, per AC1.
export function resolveMixedFactionTargets(
  casterId: string,
  targetsInZone: Array<PlayerState | EnemyState>,
): MixedFactionSplit {
  const allies: PlayerState[] = [];
  const enemies: EnemyState[] = [];
  for (const t of targetsInZone) {
    if ('class' in t) {
      if (t.id !== casterId) allies.push(t); // exclude caster from their own AoE
    } else {
      enemies.push(t);
    }
  }
  return { allies, enemies };
}

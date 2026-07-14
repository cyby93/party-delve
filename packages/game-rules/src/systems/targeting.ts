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

// Pure radius-at-time calculation for Spirit Nova's expanding-ring sweep (Story 3.17).
// The stateful sweep bookkeeping (which targets were already hit, when to retire the
// sweep) lives in GameRoom.ts, not here — keeps the pure/impure boundary consistent
// with the rest of this codebase.
export function resolveExpandingRadius(
  elapsedMs: number,
  durationMs: number,
  maxRadiusPx: number,
): number {
  return maxRadiusPx * Math.min(1, Math.max(0, elapsedMs / durationMs));
}

// Pure index-selection math for Storm Eye's random bonus-strike target (Story
// 3.20) — extracted so it's testable for determinism without a live GameRoom.
// rngValue must come from the seeded xoshiro128++ stream (this.prng()), never
// Math.random() (project-context.md's PRNG rule).
export function pickRandomIndex(rngValue: number, count: number): number {
  return Math.floor(rngValue * count);
}

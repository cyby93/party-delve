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

// ── Lightning Arc (Stormcaller slot 0, Story 3.26) ───────────────────────────
// Pure targeting/falloff math only — gathering live candidates (which enemies
// are alive, where the boss is) and applying damage/broadcasting deltas stays
// impure in GameRoom.ts, same pure/impure boundary as resolveExpandingRadius above.
export interface LightningArcCandidate {
  id: string;
  x: number;
  y: number;
}

// Nearest candidate to (originX, originY), optionally capped to maxRadiusPx.
// Returns null when the candidate list is empty or none fall within the radius.
export function findNearestCandidate(
  originX: number,
  originY: number,
  candidates: readonly LightningArcCandidate[],
  maxRadiusPx?: number,
): LightningArcCandidate | null {
  let nearest: LightningArcCandidate | null = null;
  let nearestDistSq = Infinity;
  for (const c of candidates) {
    const dx = c.x - originX;
    const dy = c.y - originY;
    const distSq = dx * dx + dy * dy;
    if (maxRadiusPx !== undefined && distSq > maxRadiusPx * maxRadiusPx) continue;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = c;
    }
  }
  return nearest;
}

export interface LightningArcHit {
  id: string;
  x: number;
  y: number;
  damage: number;
  fromX: number;
  fromY: number;
  chainIndex: number;
}

// Given the first (already-picked, corridor-nearest) target, chains up to
// maxBounces additional hits: each hop searches from the PREVIOUS hit's
// position (not re-aimed) for the nearest not-yet-hit candidate within
// chainRadiusPx, applying `falloff` damage multiplier per hop. Stops early
// (not an error) once no further candidate is found in radius.
export function resolveLightningArcChain(
  originX: number,
  originY: number,
  firstTarget: LightningArcCandidate,
  firstDamage: number,
  remainingCandidates: readonly LightningArcCandidate[], // must NOT include firstTarget
  chainRadiusPx: number,
  maxBounces: number,
  falloff: number,
): LightningArcHit[] {
  const hits: LightningArcHit[] = [
    { id: firstTarget.id, x: firstTarget.x, y: firstTarget.y, damage: firstDamage, fromX: originX, fromY: originY, chainIndex: 0 },
  ];
  const hitIds = new Set<string>([firstTarget.id]);
  let current = firstTarget;
  let damage = firstDamage;

  for (let chainIndex = 1; chainIndex <= maxBounces; chainIndex++) {
    const pool = remainingCandidates.filter(c => !hitIds.has(c.id));
    const next = findNearestCandidate(current.x, current.y, pool, chainRadiusPx);
    if (!next) break; // chain ends early — no target in radius, not an error

    damage *= falloff;
    hits.push({ id: next.id, x: next.x, y: next.y, damage, fromX: current.x, fromY: current.y, chainIndex });
    hitIds.add(next.id);
    current = next;
  }

  return hits;
}

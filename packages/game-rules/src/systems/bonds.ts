import type { GameState, PlayerState, BondState } from 'shared-types';
import { BondType } from 'shared-types';
import type { Result } from '../state/result.js';
import { BOND_TYPE_COLORS } from '../balance.js';

export interface BondAssignedEvt {
  playerA: string;
  playerB: string;
  bondType: BondType;
  bondColor: string;
}

export type BondError = { code: 'NOT_ENOUGH_PLAYERS' };

export function selectBondType(rng: () => number): BondType {
  return rng() < 0.5 ? BondType.Proximity : BondType.Fate;
}

export function selectBondPair(players: PlayerState[], bonds: BondState[], rng: () => number): [string, string] {
  const bondedIds = new Set(bonds.flatMap(b => [b.playerA, b.playerB]));
  const unbonded = players.filter(p => !bondedIds.has(p.id));

  // Prefer unbonded for first pick; if 2+ unbonded also prefer unbonded for second pick
  const poolA = unbonded.length >= 1 ? unbonded : players;
  const idxA = Math.floor(rng() * poolA.length);
  const chosen = poolA[idxA]!;

  const poolB = (unbonded.length >= 2 ? unbonded : players).filter(p => p.id !== chosen.id);
  const idxB = Math.floor(rng() * poolB.length);
  return [chosen.id, poolB[idxB]!.id];
}

export function assignBond(
  state: GameState,
  rng: () => number,
): Result<BondAssignedEvt, BondError> {
  if (state.players.length < 2) {
    return { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } };
  }

  const [playerA, playerB] = selectBondPair(state.players, state.activeBonds, rng);

  // ponytail: skip duplicate bond assignment — with few unbonded players left,
  // selectBondPair can return a pair that's already bonded; pushing again would
  // double-count that pair in every per-tick drain/buff pass. Report the EXISTING
  // bond's type/color (not a freshly-rolled one) so the broadcast the caller sends
  // from this return value matches what's actually stored in activeBonds.
  const existing = state.activeBonds.find(
    b => (b.playerA === playerA && b.playerB === playerB) ||
         (b.playerA === playerB && b.playerB === playerA),
  );
  if (existing) {
    return {
      ok: true,
      value: { playerA: existing.playerA, playerB: existing.playerB, bondType: existing.type, bondColor: existing.color },
    };
  }

  const bondType = selectBondType(rng);
  const bondColor = BOND_TYPE_COLORS[bondType];
  const bond: BondState = { playerA, playerB, type: bondType, color: bondColor };
  state.activeBonds.push(bond);

  return { ok: true, value: { playerA, playerB, bondType, bondColor } };
}

// ─── Story 5.3: per-tick effects helpers ────────────────────────────────────

/** Stable bond identifier: always playerA+playerB in assignment order. */
export function bondKey(playerA: string, playerB: string): string {
  return `${playerA}+${playerB}`;
}

/**
 * Returns IDs of players currently buffed by an in-range Proximity Bond.
 * inRangeKeys: Set of bondKey strings whose planck sensor is overlapping this tick.
 */
export function getProximityBuffedPlayers(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (!inRangeKeys.has(bondKey(bond.playerA, bond.playerB))) continue;
    buffed.add(bond.playerA);
    buffed.add(bond.playerB);
  }
  return buffed;
}

/** Returns IDs of all players in any Fate Bond (speed buff is always active). */
export function getFateBuffedPlayers(bonds: BondState[]): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Fate) continue;
    buffed.add(bond.playerA);
    buffed.add(bond.playerB);
  }
  return buffed;
}

/**
 * Returns partner IDs that should be force-downed due to Fate Bond wipe.
 * downedPlayerId: the player who just became isDown === true this tick.
 * Skips partners already isDown or isSpirit (no double-wipe).
 */
export function getFateBondWipeTargets(
  bonds: BondState[],
  downedPlayerId: string,
  players: ReadonlyArray<{ id: string; isDown: boolean; isSpirit: boolean; isFrozen: boolean }>,
): string[] {
  const targets: string[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Fate) continue;
    let partnerId: string | null = null;
    if (bond.playerA === downedPlayerId) partnerId = bond.playerB;
    else if (bond.playerB === downedPlayerId) partnerId = bond.playerA;
    if (partnerId === null) continue;
    const partner = players.find(p => p.id === partnerId);
    // ponytail: explicit isFrozen guard — applyPlayerDamage rejects frozen players too,
    // but we make the invariant visible here rather than relying on that downstream check
    if (!partner || partner.isDown || partner.isSpirit || partner.isFrozen) continue;
    targets.push(partnerId);
  }
  return targets;
}

export interface ProximityDrainTarget {
  playerA: string;
  playerB: string;
}

/**
 * Returns Proximity Bond pairs that have been in-range long enough to drain HP.
 * enterTimes: Map of bondKey → epoch ms when pair entered sensor range.
 * drainThresholdMs: computed from BOND_DRAIN_THRESHOLD_S * 1000 by caller.
 */
export function getProximityDrainTargets(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
  enterTimes: ReadonlyMap<string, number>,
  drainThresholdMs: number,
  nowMs: number,
): ProximityDrainTarget[] {
  const result: ProximityDrainTarget[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    const key = bondKey(bond.playerA, bond.playerB);
    if (!inRangeKeys.has(key)) continue;
    const enterTime = enterTimes.get(key);
    if (enterTime === undefined) continue;
    if (nowMs - enterTime >= drainThresholdMs) {
      result.push({ playerA: bond.playerA, playerB: bond.playerB });
    }
  }
  return result;
}

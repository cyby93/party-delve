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

  // A player is only a valid first pick if at least one OTHER player exists who
  // isn't already bonded to them — otherwise every possible partner draw for them
  // would just re-select an existing bond (D1, 2026-07-03 / D-6.9-B, 2026-07-17).
  const bondedPartnersOf = (playerId: string): Set<string> => {
    const ids = new Set<string>();
    for (const b of bonds) {
      if (b.playerA === playerId) ids.add(b.playerB);
      else if (b.playerB === playerId) ids.add(b.playerA);
    }
    return ids;
  };
  const hasAvailablePartner = (p: PlayerState): boolean => {
    const partners = bondedPartnersOf(p.id);
    return players.some(other => other.id !== p.id && !partners.has(other.id));
  };

  // Prefer any unbonded player for the first pick — an unbonded player always has
  // an available partner whenever another player exists, so no extra filtering is
  // needed for this tier; fall back to anyone with an available partner; fall back
  // to the full roster only when every possible pair is already bonded (pathological
  // — a saturated small roster).
  const anyWithPartner = players.filter(hasAvailablePartner);
  const poolA = unbonded.length >= 1 ? unbonded
    : anyWithPartner.length >= 1 ? anyWithPartner
    : players;
  const idxA = Math.floor(rng() * poolA.length);
  const chosen = poolA[idxA]!;

  const chosenPartners = bondedPartnersOf(chosen.id);
  // Prefer an unbonded second pick when 2+ unbonded players exist (preserves the
  // existing "spread bonds to fresh players first" bias for the common case), but
  // never at the cost of re-selecting a pair already bonded to `chosen`; fall back
  // to the full roster only when every possible pair with `chosen` is already bonded.
  const validPoolB = (unbonded.length >= 2 ? unbonded : players)
    .filter(p => p.id !== chosen.id && !chosenPartners.has(p.id));
  const finalPoolB = validPoolB.length > 0 ? validPoolB : players.filter(p => p.id !== chosen.id);
  const idxB = Math.floor(rng() * finalPoolB.length);
  return [chosen.id, finalPoolB[idxB]!.id];
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
  spiritPlayerIds: ReadonlySet<string>,
): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (!inRangeKeys.has(bondKey(bond.playerA, bond.playerB))) continue;
    if (spiritPlayerIds.has(bond.playerA) || spiritPlayerIds.has(bond.playerB)) continue;
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
  spiritPlayerIds: ReadonlySet<string>,
): ProximityDrainTarget[] {
  const result: ProximityDrainTarget[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (spiritPlayerIds.has(bond.playerA) || spiritPlayerIds.has(bond.playerB)) continue;
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

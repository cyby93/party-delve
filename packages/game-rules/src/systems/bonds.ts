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

export function selectBondPair(players: PlayerState[], rng: () => number): [string, string] {
  const idxA = Math.floor(rng() * players.length);
  const idxB = Math.floor(rng() * (players.length - 1));
  // shift-up: skip the slot idxA occupies so playerA ≠ playerB, exactly 2 rng calls
  const adjustedB = idxB >= idxA ? idxB + 1 : idxB;
  return [players[idxA]!.id, players[adjustedB]!.id];
}

export function assignBond(
  state: GameState,
  rng: () => number,
): Result<BondAssignedEvt, BondError> {
  if (state.players.length < 2) {
    return { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } };
  }

  const [playerA, playerB] = selectBondPair(state.players, rng);
  const bondType = selectBondType(rng);
  const bondColor = BOND_TYPE_COLORS[bondType];

  const bond: BondState = { playerA, playerB, type: bondType, color: bondColor };
  state.activeBonds.push(bond);

  return { ok: true, value: { playerA, playerB, bondType, bondColor } };
}

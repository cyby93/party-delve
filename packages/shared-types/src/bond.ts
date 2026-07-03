export enum BondType {
  Proximity = 'proximity',
  Fate = 'fate',
}

export interface BondState {
  playerA: string;
  playerB: string;
  type: BondType;
  color: string;
}

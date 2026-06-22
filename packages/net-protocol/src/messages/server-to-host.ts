import type { GameState, BondState, EssenceDrop } from 'shared-types';

export interface SnapshotMsg {
  type: 'snapshot';
  state: GameState;
}

export type PlayerMovedDelta = {
  type: 'player:moved';
  playerId: string;
  x: number;
  y: number;
};

export type PlayerDownedDelta = {
  type: 'player:downed';
  playerId: string;
  downCount: number;
};

export type PlayerReviveDelta = {
  type: 'player:revived';
  playerId: string;
};

export type PlayerLeftDelta = {
  type: 'player:left';
  playerId: string;
};

export type EnemyKilledDelta = {
  type: 'enemy:killed';
  enemyId: string;
  byPlayerId: string;
};

export type EnemyMovedDelta = {
  type: 'enemy:moved';
  enemyId: string;
  x: number;
  y: number;
};

export type BondAssignedDelta = {
  type: 'bond:assigned';
  bond: BondState;
};

export type EssenceDroppedDelta = {
  type: 'essence:dropped';
  drop: EssenceDrop;
};

export type EssenceCollectedDelta = {
  type: 'essence:collected';
  dropId: string;
  byPlayerId: string;
};

export type DeltaEventMsg =
  | PlayerMovedDelta
  | PlayerDownedDelta
  | PlayerReviveDelta
  | PlayerLeftDelta
  | EnemyKilledDelta
  | EnemyMovedDelta
  | BondAssignedDelta
  | EssenceDroppedDelta
  | EssenceCollectedDelta;

import type { GameState, BondType, EssenceDrop, PlayerClass, DifficultyTier, BossPhase, RunReward } from 'shared-types';

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
  reviveWindowMs: number;
};

export type PlayerReviveDelta = {
  type: 'player:revived';
  playerId: string;
};

export type PlayerLeftDelta = {
  type: 'player:left';
  playerId: string;
};

export type PlayerDisconnectedDelta = {
  type: 'player:disconnected';
  playerId: string;
};

export type PlayerReconnectedDelta = {
  type: 'player:reconnected';
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

export type EnemyStompedDelta = {
  type: 'enemy:stomped';
  enemyId: string;
  x: number;
  y: number;
  radius: number;
};

export type BondAssignedDelta = {
  type: 'bond:assigned';
  playerA: string;
  playerB: string;
  bondType: BondType;
  bondColor: string;
};

export type BondPriceActiveDelta = {
  type: 'bond:price-active';
  playerA: string;
  playerB: string;
};

export type EssenceDroppedDelta = {
  type: 'essence:dropped';
  drop: EssenceDrop;
};

export type EssenceCollectedDelta = {
  type: 'essence:collected';
  dropId: string;
  byPlayerId: string;
  newTotal: number;
};

export type EnemyDamagedDelta = {
  type: 'enemy:damaged';
  enemyId: string;
  damage: number;
  remainingHp: number;
};

export type PlayerPoiEnteredDelta = {
  type: 'player:poi-entered';
  playerId: string;
  poiId: string;
  poiType: string;  // PoiType value — string to avoid circular import between packages
};

export type PlayerPoiExitedDelta = {
  type: 'player:poi-exited';
  playerId: string;
};

export type PlayerClassUpdatedDelta = {
  type: 'player:class-updated';
  playerId: string;
  class: PlayerClass;
};

export type AbilityFiredDelta = {
  type: 'ability:fired';
  playerId: string;
  abilityIndex: number;
  directionX: number;
  directionY: number;
};

export type PlayerHpUpdatedDelta = {
  type: 'player:hp-updated';
  playerId: string;
  hp: number;
};

export type PlayerSpiritDelta = {
  type: 'player:spirit';
  playerId: string;
};

export type SpiritAbilityFiredDelta = {
  type: 'spirit-ability:fired';
  playerId: string;
  class: PlayerClass;
};

export type RunFailedDelta = {
  type: 'run:failed';
  partialEssence: number;
};

export type LevelCompleteDelta = {
  type: 'level:complete';
  levelIndex: number;
};

export type RunCompleteDelta = {
  type: 'run:complete';
  totalEssence: number;
};

export type RunProposedDelta = {
  type: 'run:proposed';
  biome: 'grassland';
  difficulty: DifficultyTier;
  proposedBy: string;
};

export type RunStartingDelta = {
  type: 'run:starting';
  biome: 'grassland';
  difficulty: DifficultyTier;
};

export type WaveStartedDelta = {
  type: 'wave:started';
  waveIndex: number;
  totalWaves: number;
};

export type WaveCompleteDelta = {
  type: 'wave:complete';
  waveIndex: number;
};

export type BossMovedDelta = {
  type: 'boss:moved';
  bossId: string;
  x: number;
  y: number;
};

export type BossStompedDelta = {
  type: 'boss:stomped';
  bossId: string;
  x: number;
  y: number;
  radius: number;
};

export type BossAddSpawnedDelta = {
  type: 'add:spawned';
  enemyId: string;
  x: number;
  y: number;
};

export type BossDamagedDelta = {
  type: 'boss:damaged';
  bossId: string;
  newHp: number;
};

export type BossPhaseChangedDelta = {
  type: 'boss:phaseChanged';
  bossId: string;
  newPhase: BossPhase;
};

export type BossDefeatedDelta = {
  type: 'boss:defeated';
  bossId: string;
  reward: RunReward;
};

export type DeltaEventMsg =
  | PlayerMovedDelta
  | PlayerDownedDelta
  | PlayerReviveDelta
  | PlayerLeftDelta
  | PlayerDisconnectedDelta
  | PlayerReconnectedDelta
  | EnemyDamagedDelta
  | EnemyKilledDelta
  | EnemyMovedDelta
  | EnemyStompedDelta
  | BondAssignedDelta
  | BondPriceActiveDelta
  | EssenceDroppedDelta
  | EssenceCollectedDelta
  | PlayerPoiEnteredDelta
  | PlayerPoiExitedDelta
  | PlayerClassUpdatedDelta
  | AbilityFiredDelta
  | PlayerHpUpdatedDelta
  | PlayerSpiritDelta
  | SpiritAbilityFiredDelta
  | RunFailedDelta
  | LevelCompleteDelta
  | RunCompleteDelta
  | RunProposedDelta
  | RunStartingDelta
  | WaveStartedDelta
  | WaveCompleteDelta
  | BossDamagedDelta
  | BossPhaseChangedDelta
  | BossDefeatedDelta
  | BossMovedDelta
  | BossStompedDelta
  | BossAddSpawnedDelta;

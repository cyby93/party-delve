import type { GameState, BondType, EssenceDrop, PlayerClass, DifficultyTier, BossPhase, RunReward, StatusEffectType } from 'shared-types';

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
  // Story 3.21: optional until 3.21b's sim-side down-transitions populate them —
  // see PlayerState.bodyX/bodyY for why these must stay optional.
  bodyX?: number;
  bodyY?: number;
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

// Lightning Arc's chain-lightning visual signal (Story 3.26) — broadcast once
// per hit in the chain (including the first) so the host can draw connected
// arcs without guessing which same-tick deltas belong to which cast. toEnemyId
// may carry the boss's id (gameState.boss.id) — plain string, no separate boss
// field, per ADR-0005's exact wire shape.
export type AbilityChainHitDelta = {
  type: 'ability:chain-hit';
  casterId: string;
  fromX: number;
  fromY: number;
  toEnemyId: string;
  chainIndex: number;
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

// ponytail: no payload. The proposer id already rides on gameState.abandonProposal
// (cleared by this same delta in apply-delta.ts), and Story 4.15c's Non-goals rule out
// a host banner, so there is nothing left for a field to carry. Do not "helpfully" add
// abandonedBy/proposedBy — that would duplicate state the clients already hold.
export type RunAbandonedDelta = {
  type: 'run:abandoned';
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

// The Grassland boss's charge lunge (Story 7.7a). Post-hoc: tryCharge moves the boss
// and fires this in the same tick — there is no windup/telegraph state on the sim side.
// x/y are the boss's POST-charge position. No radius (unlike boss:stomped) — the sim
// event carries none; charge damage is resolved by contact, not an AoE radius.
export type BossChargedDelta = {
  type: 'boss:charged';
  bossId: string;
  x: number;
  y: number;
};

export type BossAddSpawnedDelta = {
  type: 'add:spawned';
  enemyId: string;
  x: number;
  y: number;
};

export type StatusAppliedDelta = {
  type: 'status:applied';
  targetId: string;
  effectType: StatusEffectType;
  magnitude: number;
  expiresAtMs: number;
};

export type StatusExpiredDelta = {
  type: 'status:expired';
  targetId: string;
  effectType: StatusEffectType;
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

export type ProjectileMovedDelta = {
  type: 'projectile:moved';
  projectileId: string;
  x: number;
  y: number;
};

export type ProjectileHitDelta = {
  type: 'projectile:hit';
  projectileId: string;
  x: number;
  y: number;
};

export type ProjectileExpiredDelta = {
  type: 'projectile:expired';
  projectileId: string;
};

export type ZoneTickDelta = {
  type: 'zone:tick';
  zoneId: string;
};

export type ZoneExpiredDelta = {
  type: 'zone:expired';
  zoneId: string;
};

// Storm Eye's periodic bonus lightning strike (Story 3.20) — visual-only, distinct
// from the steady zone:tick. The actual HP change is broadcast separately via
// enemy:damaged/enemy:killed for the struck target.
export type ZoneStrikeDelta = {
  type: 'zone:strike';
  zoneId: string;
  targetId: string;
  damage: number;
};

export type CastStartedDelta = {
  type: 'cast:started';
  casterId: string;
  targetPlayerId: string;
  abilityIndex: number;
  startedAt: number; // server-epoch ms — clients must not substitute their own clock
  durationMs: number;
};

export type CastCancelledDelta = {
  type: 'cast:cancelled';
  casterId: string;
};

export type CastCompletedDelta = {
  type: 'cast:completed';
  casterId: string;
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
  | AbilityChainHitDelta
  | PlayerHpUpdatedDelta
  | PlayerSpiritDelta
  | SpiritAbilityFiredDelta
  | RunFailedDelta
  | LevelCompleteDelta
  | RunCompleteDelta
  | RunProposedDelta
  | RunStartingDelta
  | RunAbandonedDelta
  | WaveStartedDelta
  | WaveCompleteDelta
  | BossDamagedDelta
  | BossPhaseChangedDelta
  | BossDefeatedDelta
  | BossMovedDelta
  | BossStompedDelta
  | BossChargedDelta
  | BossAddSpawnedDelta
  | StatusAppliedDelta
  | StatusExpiredDelta
  | ProjectileMovedDelta
  | ProjectileHitDelta
  | ProjectileExpiredDelta
  | ZoneTickDelta
  | ZoneExpiredDelta
  | ZoneStrikeDelta
  | CastStartedDelta
  | CastCancelledDelta
  | CastCompletedDelta;

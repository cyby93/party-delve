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

// A player's in-progress aim, before the ability actually fires (Story 7.15a,
// ADR-0008). Presentation-only and throttled: derived per tick from the aiming
// player's live direction, never written to persistent GameState, never touching
// the PRNG or tick determinism — same category as ability:fired/ability:chain-hit,
// which apply-delta.ts also treats as state no-ops.
//
// targetX/targetY are OPTIONAL because most aiming abilities have no destination
// point at all. The sim (Story 7.15b) fills them only for the four abilities whose
// landing spot is knowable at aim time — Storm Eye, Stone Wall, Dark Pact, Crimson
// Lash — using the same placement math the real cast uses, never a second copy.
// Void Pulse and Tempest Hurl are RELEASE-type too but resolve on projectile
// contact, so their landing point is genuinely unknowable while aiming and no
// target is sent: the host renders a direction arrow only.
//
// WIRE INVARIANTS — all four coordinate fields are JSON numbers, and
// `serialize`/`deserialize` are bare JSON.stringify/parse with an unchecked cast:
// - A non-finite value (NaN/±Infinity) serializes to `null`, arriving typed
//   `number` while being `null` at runtime. `null` passes an `!== undefined`
//   optional check and coerces to `0` in arithmetic, so a naive
//   `if (d.targetX !== undefined)` would draw a preview at the world origin.
//   Prefer `Number.isFinite(d.targetX)`. The sim (Story 7.15b) is responsible
//   for never emitting one — this note exists so the host does not assume so.
// - `directionX`/`directionY` are NOT guaranteed normalized; see the matching
//   note on `AimPreviewInput` in `packages/shared-types/src/input.ts`.
//
// There is deliberately NO terminator in this contract — no `aim:cancelled`
// delta, no timestamp, no TTL. Cessation is signalled by the phone simply
// ceasing to send (ADR-0008), so the host must infer "stopped aiming" from
// absence plus a locally-defined staleness window, and from `ability:fired`.
// Note the gap that leaves: when a drag ends but `dispatchAbility` rejects the
// cast (e.g. still on cooldown), no `ability:fired` is broadcast either, so the
// staleness window is the ONLY thing that clears the preview in that path.
export type AbilityAimPreviewDelta = {
  type: 'ability:aim-preview';
  playerId: string;
  abilityIndex: number;
  directionX: number;
  directionY: number;
  targetX?: number;
  targetY?: number;
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
  | AbilityAimPreviewDelta
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

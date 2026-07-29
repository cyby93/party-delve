export { createRng } from './prng/xoshiro128.js';
export { generateFloorLayout } from './generation/floor-layout.js';
export type { LevelTier } from './generation/floor-layout.js';
export { GRASSLAND_ROOM_POOL, BOSS_FLOOR_LAYOUT } from './generation/room-pool.js';
export type { Result, GameError } from './state/result.js';
export {
  JOYSTICK_DEADBAND,
  ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE,
  ABILITY_GEOMETRY,
  ESSENCE_DROP_AMOUNT, ESSENCE_COLLECT_RADIUS_PX,
  ENEMY_CHASE_RANGE, ENEMY_ATTACK_RANGE, ENEMY_CHASE_SPEED, ENEMY_ATTACK_COOLDOWN_TICKS,
  CHARGE_ACTIVATION_MIN, CHARGE_ACTIVATION_MAX, CHARGE_SPEED, CHARGE_COOLDOWN_TICKS,
  STOMP_ACTIVATION_RANGE, STOMP_RADIUS, STOMP_COOLDOWN_TICKS,
  getEnemyCount,
  REVIVE_WINDOWS_MS, REVIVE_HP, REVIVE_RADIUS_PX,
  ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS,
  SPIRIT_ABILITY_NAMES,
  SPIRIT_ABILITY_COOLDOWN_MS,
  WAVE_COUNTS,
  WAVE_PAUSE_MS,
  WAVE_ENEMY_SCALE,
  BOSS_ADD_HP,
  BOSS_STOMP_DAMAGE,
  PROJECTILE_SPEED_PX_S,
  PROJECTILE_MAX_RANGE_PX,
  ABILITY_CHAINED_ZONE,
  ABILITY_SELF_COST_HP,
  ABILITY_HP_SCALED_DAMAGE,
  ABILITY_LIFESTEAL_PCT,
  ABILITY_STATUS_EFFECT,
  ABILITY_DISPLACEMENT_STRENGTH,
  ABILITY_HEAL_AMOUNT,
  VOID_PULSE_PULL_STRENGTH_PX,
  DARK_PACT_DRAIN_PCT,
  LIGHTNING_ARC_CORRIDOR_ANGLE_DEG,
  LIGHTNING_ARC_CHAIN_RADIUS_PX,
  LIGHTNING_ARC_MAX_BOUNCES,
  LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF,
  SPIRIT_NOVA_DURATION_MS,
  SPIRIT_NOVA_MAX_RADIUS_PX,
  SOUL_MEND_CHANNEL_DURATION_MS,
  SOUL_MEND_LIVENESS_MS,
  STORM_EYE_ZONE_RADIUS_PX,
  STORM_EYE_TICK_MS,
  STORM_EYE_TICK_DAMAGE,
  STORM_EYE_DURATION_MS,
  STORM_EYE_STRIKE_INTERVAL_MS,
  STORM_EYE_STRIKE_DAMAGE,
  STORM_EYE_PLACEMENT_RANGE_PX,
  TEMPEST_HURL_PROJECTILE_RADIUS_PX,
  TEMPEST_HURL_SPEED_PX_S,
  TEMPEST_HURL_BLAST_RADIUS_PX,
} from './balance.js';
export type { ChainedZoneConfig, AbilityStatusEffectConfig, StatusEffectScope, AbilityDeliveryType, AbilityHitShape, AbilityGeometry } from './balance.js';
export { applyPlayerDamage, getReviveWindowMs, healPlayer, calculateLifesteal } from './systems/player-health.js';
export type { PlayerDamageResult, HealthError } from './systems/player-health.js';
export { resolveMixedFactionTargets, resolveExpandingRadius, pickRandomIndex, findNearestCandidate, resolveLightningArcChain } from './systems/targeting.js';
export type { MixedFactionSplit, LightningArcCandidate, LightningArcHit } from './systems/targeting.js';
export { applyDamage, isInHitZone, isInConeZone } from './systems/combat.js';
export type { DamageResult, CombatError } from './systems/combat.js';
export { tickEnemy, tickBaseFSM, createEasyLayers, createNormalLayers, createHardLayers } from './systems/ai/fsm.js';
export type { EnemyContext, BehaviorLayer, EnemyAIEvent } from './systems/ai/fsm.js';
export { ChargeLayer } from './systems/ai/layers/charge.js';
export { StompLayer } from './systems/ai/layers/stomp.js';
export { dispatchAbility, calculateSelfCostHp, calculateHpScaledDamage } from './systems/abilities.js';
export type { AbilityDispatchContext, AbilityFiredEvent, AbilityGameError } from './systems/abilities.js';
export { assignBond, selectBondPair, selectBondType, bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets } from './systems/bonds.js';
export type { BondAssignedEvt, BondError, ProximityDrainTarget } from './systems/bonds.js';
export { BOND_TYPE_COLORS, BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_DAMAGE_MULT, BOND_SPEED_MULT, BOND_DESCRIPTIONS, BOND_MECHANICS, DEBUG_GOD_MODE_DAMAGE_MULT, resolveOutgoingDamage } from './balance.js';
export { createBossState, tickBoss } from './entities/grassland-boss.js';
export type { BossEvent, BossAddSpawnedEvent, BossStompedEvent } from './entities/grassland-boss.js';
export { evaluateGrasslandAchievements } from './systems/achievements.js';
export { applyStatusEffect, tickStatusEffects, getStatusEffectMagnitude } from './systems/status-effects.js';
export type { StatusEffectTarget, StatusEffectError } from './systems/status-effects.js';
export { resolveProjectileHit, isProjectileExpired } from './systems/projectiles.js';
export type { ProjectileError } from './systems/projectiles.js';
export { shouldZoneTick, isZoneExpired } from './systems/zones.js';
export { applyDisplacement } from './systems/displacement.js';
export { findSoulMendTarget, shouldCancelSoulMendChannel, reviveBySoulMend } from './systems/soul-mend.js';

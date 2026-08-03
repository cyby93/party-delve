export { VfxEngine } from './engine';
export { progress } from './types';
export type { EffectHandle, VfxStage, VfxTriggerParams } from './types';
export {
  createParticleBurst,
  createTrail,
  createRingShockwave,
  createBeam,
  createTintPulse,
  createConeWedge,
} from './primitives';
export {
  STONEHIDE_OCHRE,
  STONEHIDE_DUST,
  STONEHIDE_SLATE,
  IRON_SKIN_SHELL_RADIUS,
  IRON_SKIN_FADE_MS,
  IRON_SKIN_BREATHE_MS,
  getAbilityVfxConfig,
  resolveAbilityVfxPlacement,
  ownsIronSkinShell,
} from './ability-vfx';
export type {
  AbilityVfxConfig,
  AbilityVfxPlacement,
  VfxAnchor,
  RingSpec,
  BeamSpec,
  BurstSpec,
} from './ability-vfx';
export {
  SPIRIT_HEAL,
  SPIRIT_HARM,
  ANCESTOR_BONE,
  FIZZLE_ASH,
  ANCESTORS_VOICE_RANGE_PX,
  SPIRIT_NOVA_MAX_RADIUS_VFX_PX,
  SPIRIT_NOVA_DURATION_VFX_MS,
  MAX_FACTION_ACCENTS_PER_CAST,
  SOUL_MEND_BEAM_INTERVAL_MS,
  SHIELD_PULSE_INTERVAL_MS,
  planSpiritcallerCast,
  factionAccentFor,
  triggerSpiritcallerCast,
  triggerFactionAccent,
  triggerSoulMendStart,
  triggerSoulMendLink,
  triggerSoulMendTerminal,
  triggerShieldPulse,
  renderShieldAura,
} from './spiritcaller-vfx';
export type { SpiritcallerCastPlan, SpiritcallerAbility } from './spiritcaller-vfx';
export {
  BLOOD,
  BLOOD_DARK,
  VOID,
  VOID_DIM,
  DARK_PACT_COST_CUE_WINDOW_MS,
  planSouldrinkerCast,
  planBloodSpikeImpact,
  planBloodSpikeSplash,
  planVoidPulseImpact,
  planDamageBuffOnset,
  planHpLossCue,
  planHpGainCue,
  classifyHpChanges,
  spawnSouldrinkerVfx,
} from './souldrinker-vfx';
export type { CastInput, VfxSpec, HpChange } from './souldrinker-vfx';
export {
  SOULDRINKER_PALETTE,
  PROJECTILE_APPEARANCE,
  DEFAULT_PROJECTILE_APPEARANCE,
  resolveProjectileAppearance,
  ZONE_APPEARANCE,
  STORMCALLER_PALETTE,
  STORM_EYE_ZONE_VISUAL,
  VOID_PULSE_ZONE_VISUAL,
  isStormEyeZone,
  resolveZoneVisual,
} from './ability-vfx-config';
export type { ProjectileAppearance, ZoneAppearance, ZoneVisual } from './ability-vfx-config';
export {
  STORM_CORE,
  STORM_BOLT,
  STORM_CHARGE,
  STORM_SLATE,
  resolveStormcallerCast,
  stormEyeTickCadence,
  spawnStormcallerCast,
  spawnStormcallerSpecs,
  spawnStormEyePulse,
  spawnStormEyeStrike,
  planChainHitBeam,
  planTempestHurlImpact,
} from './stormcaller-vfx';
export type { StormcallerCastPlan, StormcallerVfxSpec } from './stormcaller-vfx';
export type {
  ParticleBurstParams,
  TrailParams,
  TrailHandle,
  RingShockwaveParams,
  BeamParams,
  TintPulseParams,
  TintTarget,
  ConeWedgeParams,
} from './primitives';
export {
  AURA_COLORS,
  AURA_SLOT_INDEX,
  AURA_BASE_GAP,
  AURA_SLOT_STEP,
  AURA_EXPIRY_FADE_MS,
  SHIELD_REFERENCE_HP,
  SLOW_ORBIT_PERIOD_MS,
  MAX_STATUS_AURAS,
  statusAuraSpec,
  createStatusAura,
  slowOrbitPoint,
} from './status-aura';
export type { StatusAuraSpec, StatusAuraKind, StatusAuraHandle, StatusAuraEntry } from './status-aura';
export {
  BOSS_RADIUS_PX,
  BOSS_PHASE2_GLOW_RADIUS_PX,
  BOSS_CHARGE_STREAK_PX,
  BOSS_CHARGE_MIN_DISPLACEMENT_PX,
  BOSS_CHARGE_BEAM_MS,
  BOSS_CHARGE_BURST_MS,
  BOSS_STOMP_RING_MS,
  BOSS_STOMP_BURST_MS,
  BOSS_PHASE_IMPLODE_START_PX,
  BOSS_PHASE_IMPLODE_MS,
  BOSS_PHASE_TINT_MS,
  BOSS_DAMAGE_BURST_MS,
  BOSS_DAMAGE_VFX_MIN_INTERVAL_MS,
  VFX_CORRUPTION,
  VFX_BLOOD,
  VFX_WARM,
  VFX_PHASE3,
  planBossVfx,
} from './boss-vfx';
export type { BossVfxInput, BossVfxContext, VfxDescriptor } from './boss-vfx';

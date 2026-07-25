export { VfxEngine } from './engine';
export { progress } from './types';
export type { EffectHandle, VfxStage, VfxTriggerParams } from './types';
export {
  createParticleBurst,
  createTrail,
  createRingShockwave,
  createBeam,
  createTintPulse,
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
  ZONE_APPEARANCE,
  STORMCALLER_PALETTE,
  STORM_EYE_ZONE_VISUAL,
  isStormEyeZone,
  resolveZoneVisual,
} from './ability-vfx-config';
export type { ProjectileAppearance, ZoneAppearance, ZoneVisual } from './ability-vfx-config';
export {
  STORM_CORE,
  STORM_BOLT,
  STORM_CHARGE,
  STORM_SLATE,
  TEMPEST_HURL_FLIGHT_MS,
  resolveStormcallerCast,
  stormEyeTickCadence,
  spawnStormcallerCast,
  advanceHurlFlights,
  spawnStormEyePulse,
  spawnStormEyeStrike,
} from './stormcaller-vfx';
export type { StormcallerCastPlan, StormcallerVfxSpec, StormcallerFlightPlan, HurlFlight } from './stormcaller-vfx';
export type {
  ParticleBurstParams,
  TrailParams,
  TrailHandle,
  RingShockwaveParams,
  BeamParams,
  TintPulseParams,
  TintTarget,
} from './primitives';

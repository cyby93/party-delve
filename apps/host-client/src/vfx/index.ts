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
export type {
  ParticleBurstParams,
  TrailParams,
  TrailHandle,
  RingShockwaveParams,
  BeamParams,
  TintPulseParams,
  TintTarget,
} from './primitives';

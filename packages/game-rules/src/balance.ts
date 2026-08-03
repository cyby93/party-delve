import type { PlayerClass, BondType, ZoneEffectType, StatusEffectType } from 'shared-types';
import { VOID_PULSE_ZONE_RADIUS_PX } from 'shared-types';

// ── Ability presentation contract (Story 7.9 / ADR-0003, consolidated 3.27 / ADR-0006) ──
// The ability spatial + delivery + spatial-sweep constants live in `shared-types`
// so the host renderer and the sim read the SAME values (VFX tracks balance;
// resolves D-7.2-A). Re-exported here so every existing
// `import { ABILITY_GEOMETRY, ... } from 'game-rules'` keeps resolving with
// zero sim churn — the public surface of game-rules is unchanged.
export {
  ABILITY_GEOMETRY,
  PROJECTILE_SPEED_PX_S,
  PROJECTILE_MAX_RANGE_PX,
  VOID_PULSE_ZONE_RADIUS_PX,
  SPIRIT_NOVA_DURATION_MS,
  SPIRIT_NOVA_MAX_RADIUS_PX,
  STORM_EYE_ZONE_RADIUS_PX,
  TEMPEST_HURL_PROJECTILE_RADIUS_PX,
  TEMPEST_HURL_SPEED_PX_S,
  TEMPEST_HURL_BLAST_RADIUS_PX,
  STORM_EYE_PLACEMENT_RANGE_PX,
} from 'shared-types';
export type { AbilityDeliveryType, AbilityHitShape, AbilityGeometry } from 'shared-types';

// ── Movement ──────────────────────────────────────────────────────────────────
export const JOYSTICK_DEADBAND = 0.05;

// ── Revive system ─────────────────────────────────────────────────────────────
// Escalating revive windows per down (1-indexed: downCount=1 → index 0 → 60s).
export const REVIVE_WINDOWS_MS = [60000, 40000, 20000, 10000, 5000, 2000] as const;
export const REVIVE_HP = 30;
export const REVIVE_RADIUS_PX = 80;

// ── Enemy melee attacks ───────────────────────────────────────────────────────
export const ENEMY_MELEE_DAMAGE = 15;
export const ENEMY_MELEE_RANGE_PX = 64;
export const ENEMY_ATTACK_COOLDOWN_MS = 1500;

// ── Spirit ability ─────────────────────────────────────────────────────────────
// ponytail: uniform cooldown for all classes in alpha; per-class values when spirit mechanics are fully designed
export const SPIRIT_ABILITY_COOLDOWN_MS = 5000;

// ── Spirit ability names (display only) ──────────────────────────────────────
export const SPIRIT_ABILITY_NAMES: Record<PlayerClass, string> = {
  stonehide:    'Earthen Vigil',
  spiritcaller: 'Soul Tether',
  souldrinker:  'Void Drain',
  stormcaller:  'Storm Echo',
};

// ── Ability Balance ───────────────────────────────────────────────────────────
// GDD: "core abilities fire on 1–2 second cycles; tempo never lets the player disengage."
// AC1 requires at least one ability per class with cooldown ≤ 3000ms.
// One consolidated object per class/slot (Story 3.28 / D-CC1) — replaces the 9
// former parallel per-field tables (ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE,
// ABILITY_HEAL_AMOUNT, ABILITY_SELF_COST_HP, ABILITY_HP_SCALED_DAMAGE,
// ABILITY_LIFESTEAL_PCT, ABILITY_CHAINED_ZONE, ABILITY_STATUS_EFFECT,
// ABILITY_DISPLACEMENT_STRENGTH), mirroring 3.27's ABILITY_GEOMETRY consolidation.
export interface AbilityBalance {
  readonly cooldownMs: number;
  readonly damage: number;
  readonly healAmount: number;
  readonly selfCostHp: number;
  readonly hpScaledDamage: number;
  readonly lifestealPct: number;
  readonly displacementStrength: number;
  readonly statusEffect: AbilityStatusEffectConfig | null;
  readonly chainedZone: ChainedZoneConfig | null;
}

export const ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]> = {
  stonehide: [
    { cooldownMs: 2000, damage: 15, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 40, statusEffect: null, chainedZone: null }, // Stone Wall
    { cooldownMs: 4000, damage: 35, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' }, chainedZone: null }, // Tremor Stomp
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' }, chainedZone: null }, // Iron Skin
    { cooldownMs: 1000, damage: 50, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Avalanche
  ],
  spiritcaller: [
    { cooldownMs: 1500, damage: 15, healAmount: 10, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Ancestor's Voice
    { cooldownMs: 5000, damage: 40, healAmount: 30, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Spirit Nova
    { cooldownMs: 4000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Soul Mend
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' }, chainedZone: null }, // Warding Cry
  ],
  souldrinker: [
    { cooldownMs: 1000, damage: 12, healAmount: 0, selfCostHp: 10, hpScaledDamage: 0, lifestealPct: 0.5, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Blood Spike
    { cooldownMs: 3000, damage: 30, healAmount: 0, selfCostHp: 0, hpScaledDamage: 1.0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Crimson Lash
    { cooldownMs: 5000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageBuff', magnitude: 0.25, durationMs: 4000, scope: 'self' }, chainedZone: null }, // Dark Pact
    { cooldownMs: 4000, damage: 25, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: { effectType: 'pull', radius: VOID_PULSE_ZONE_RADIUS_PX, tickIntervalMs: 500, durationMs: 2000 } }, // Void Pulse
  ],
  stormcaller: [
    { cooldownMs: 1000, damage: 18, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Lightning Arc
    { cooldownMs: 3000, damage: 40, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Tempest Hurl
    { cooldownMs: 5000, damage: 45, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Thunder Clap
    { cooldownMs: 2000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Storm Eye
  ],
};

// ── Enemy AI ──────────────────────────────────────────────────────────────────
export const ENEMY_CHASE_RANGE = 300;         // pixels — triggers IDLE→CHASE
export const ENEMY_ATTACK_RANGE = 60;         // pixels — triggers CHASE→ATTACK
export const ENEMY_CHASE_SPEED = 80;          // pixels per second
export const ENEMY_ATTACK_COOLDOWN_TICKS = 90; // 3 seconds at 30hz — ATTACK duration

// ── Behavior Layers ───────────────────────────────────────────────────────────
export const CHARGE_ACTIVATION_MIN = 100;     // pixels — minimum distance for charge
export const CHARGE_ACTIVATION_MAX = 300;     // pixels — maximum distance for charge
export const CHARGE_SPEED = 400;              // pixels per second (fast dash)
export const CHARGE_COOLDOWN_TICKS = 180;     // 6 seconds at 30hz

export const STOMP_ACTIVATION_RANGE = 80;     // pixels — player must be this close
export const STOMP_RADIUS = 150;              // pixels — AoE radius of stomp effect
export const STOMP_COOLDOWN_TICKS = 240;      // 8 seconds at 30hz

// ABILITY_GEOMETRY (+ AbilityGeometry, AbilityDeliveryType, AbilityHitShape),
// PROJECTILE_SPEED_PX_S, PROJECTILE_MAX_RANGE_PX live in shared-types/ability-geometry.ts
// (Story 7.9 / ADR-0003, consolidated 3.27 / ADR-0006) and are re-exported at the top of this file.

// ── Declarative projectile→zone chaining ─────────────────────────────────────
// Set per-ability via AbilityBalance.chainedZone (Story 3.28); Void Pulse
// (souldrinker[3]) is the only ability whose entry is non-null.
export interface ChainedZoneConfig {
  effectType: ZoneEffectType;
  radius: number;
  tickIntervalMs: number;
  durationMs: number;
}

// Void Pulse's chained pull zone (Story 3.19) — plain named constant, not a
// per-class table, same rationale as Spirit Nova/Soul Mend's constants below:
// it's the only ability in the full spec that spawns a 'pull' zone.
export const VOID_PULSE_PULL_STRENGTH_PX = 50;

// Dark Pact's ally-HP drain percentage (Story 3.19) — named rather than a
// bare literal at the call site, matching this file's tunable-constant convention.
export const DARK_PACT_DRAIN_PCT = 0.10;

// ── Lightning Arc corridor + chain (Story 3.26) ──────────────────────────────
// Plain named constants, not a per-class table — Lightning Arc is the only
// ability in the full spec with this mechanic, same rationale as Spirit Nova/
// Soul Mend/Storm Eye's constants above.
export const LIGHTNING_ARC_CORRIDOR_ANGLE_DEG = 30;
export const LIGHTNING_ARC_CHAIN_RADIUS_PX = 150;
export const LIGHTNING_ARC_MAX_BOUNCES = 2;
export const LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF = 0.7;

// ── Declarative per-ability status-effect application ───────────────────────
// Populated per-ability by each kit-rework story (3.16 sets Stonehide; 3.17
// adds Spiritcaller's Warding Cry). GameRoom reads this table instead of
// special-casing any one ability by class/index.
export type StatusEffectScope = 'self' | 'enemies-in-zone' | 'allies-in-zone';

// SPIRIT_NOVA_DURATION_MS / SPIRIT_NOVA_MAX_RADIUS_PX moved to
// shared-types/ability-geometry.ts (Story 7.9) — the visible sweep must match the
// real swept radius, so they are contract values. Re-exported at the top of this file.

// ── Soul Mend hold-to-channel revive (Story 3.18) ────────────────────────────
// Plain named constants, not a per-class table — Soul Mend is the only AIM_CAST
// ability in the full spec, same rationale as Spirit Nova's constants above.
export const SOUL_MEND_CHANNEL_DURATION_MS = 2500;
// Fire-attempts arrive every 33ms (mobile's AUTO-style continuous-send interval)
// while held; a few missed beats tolerates jitter without feeling laggy on release.
export const SOUL_MEND_LIVENESS_MS = 150;

// ── Storm Eye persistent zone + bonus strike (Story 3.20) ───────────────────
// Plain named constants, not per-class tables — Storm Eye is the only 'zone'-
// delivery ability in the full spec, same rationale as Spirit Nova/Soul Mend above.
// STORM_EYE_TICK_DAMAGE is separate from ABILITY_BALANCE.stormcaller[3].damage (0):
// that field is read by the hit-scan path only, which this ability's 'zone'
// delivery never reaches (see GameRoom.ts's ABILITY_GEOMETRY delivery-dispatch branch).
// STORM_EYE_ZONE_RADIUS_PX moved to shared-types/ability-geometry.ts (Story 7.9) —
// the visible zone radius is a contract value; its tick cadence/damage/duration below
// stay balance-only. Re-exported at the top of this file.
export const STORM_EYE_TICK_MS = 500;
export const STORM_EYE_TICK_DAMAGE = 10;
export const STORM_EYE_DURATION_MS = 5000;
export const STORM_EYE_STRIKE_INTERVAL_MS = 1500; // longer than the steady STORM_EYE_TICK_MS cadence, per AC2
export const STORM_EYE_STRIKE_DAMAGE = 30;

export interface AbilityStatusEffectConfig {
  effectType: StatusEffectType;
  magnitude: number;
  durationMs: number;
  scope: StatusEffectScope;
}

// ABILITY_STATUS_EFFECT and ABILITY_DISPLACEMENT_STRENGTH (0 = no displacement)
// are now set per-ability via AbilityBalance.statusEffect / .displacementStrength
// (Story 3.28) — see ABILITY_BALANCE above for the current per-class/slot values.

// ── Spirit Essence ────────────────────────────────────────────────────────────
export const ESSENCE_DROP_AMOUNT = 10;
export const ESSENCE_COLLECT_RADIUS_PX = 50;

// ── Survive the Waves ─────────────────────────────────────────────────────────
export const WAVE_COUNTS: Record<'early' | 'mid' | 'late', number> = {
  early: 2,  // unused in alpha (Level 1 = Clear)
  mid:   3,
  late:  3,  // unused in alpha (Level 3 = Clear)
};
export const WAVE_PAUSE_MS = 2500;
// Per-wave multiplier: Wave 1 = 70%, Wave 2 = 85%, Wave 3 = 100% of getEnemyCount
export const WAVE_ENEMY_SCALE = [0.7, 0.85, 1.0] as const;

// ── Enemy Count Scaling ───────────────────────────────────────────────────────
// Enemy count scales with player count only — difficulty tier does NOT affect count (FR22)
const ENEMY_RATIO: Record<'early' | 'mid' | 'late', number> = {
  early: 1.5,
  mid:   2.0,
  late:  2.5,
};

export function getEnemyCount(
  playerCount: number,
  levelTier: 'early' | 'mid' | 'late',
): number {
  if (playerCount <= 0) return 0;
  return Math.ceil(playerCount * ENEMY_RATIO[levelTier]);
}

export const BOND_DESCRIPTIONS: Record<BondType, string> = {
  proximity: 'Your spirits entwine — drawing power from closeness, but paying a toll when you linger.',
  fate:      'Your fates are now bound. What befalls one, befalls the other.',
};

export const BOND_MECHANICS: Record<BondType, string> = {
  proximity: '+20% damage when in range · HP drain after 5 s together',
  fate:      '+20% movement speed always · If one falls, both fall',
};

// ponytail: type-based colors for alpha; per-bond-instance colors if Story 5.5 needs them
export const BOND_TYPE_COLORS: Record<BondType, string> = {
  proximity: '#6ea8d8',  // accent-spirit — matches 5.1 contract test fixture
  fate:      '#f5a623',  // warm amber
};

// ── Spirit Bond effects ───────────────────────────────────────────────────────
export const BOND_PROXIMITY_RANGE_PX = 200;  // planck sensor radius — tunable
export const BOND_DRAIN_THRESHOLD_S  = 5;    // seconds in-range before drain starts
export const BOND_DRAIN_HP_PER_TICK  = 1;    // HP drained per 30hz tick (~30/s at threshold)
export const BOND_DAMAGE_MULT        = 1.2;  // Proximity buff: +20% damage
export const BOND_SPEED_MULT         = 1.2;  // Fate buff: +20% movement speed

// ── Grassland Boss ────────────────────────────────────────────────────────────
export const BOSS_GRASSLAND_MAX_HP              = 2000 as const;
export const BOSS_CHASE_RANGE                   = 600 as const;
export const BOSS_ATTACK_RANGE                  = 100 as const;
export const BOSS_ATTACK_COOLDOWN_TICKS         = 60 as const;
export const BOSS_CHASE_SPEED                   = 60 as const;
export const BOSS_STOMP_ACTIVATION_RANGE        = 250 as const;
export const BOSS_STOMP_RADIUS                  = 280 as const;
export const BOSS_PHASE2_STOMP_COOLDOWN_TICKS   = 120 as const;
export const BOSS_CHARGE_ACTIVATION_MIN         = 200 as const;
export const BOSS_CHARGE_ACTIVATION_MAX         = 600 as const;
export const BOSS_CHARGE_SPEED                  = 350 as const;
export const BOSS_CHARGE_COOLDOWN_TICKS         = 150 as const;
export const BOSS_REWARD_PER_ALIVE_PLAYER       = 50 as const;
export const BOSS_ADD_COUNT_HARD                = 3 as const;
export const BOSS_ADD_HP                        = 200 as const;
export const BOSS_FAST_CLEAR_MS                 = 120_000 as const; // 2 minutes
export const BOSS_STOMP_DAMAGE                  = 40 as const;

// ── Debug / Dev Tools ────────────────────────────────────────────────────────
export const DEBUG_GOD_MODE_DAMAGE_MULT = 10;  // Debug-only: multiplies outgoing damage while god mode is toggled on

// Folds every active outgoing-damage multiplier (Bond buff, debug god-mode) into one call.
export function resolveOutgoingDamage(rawDamage: number, isBonded: boolean, isGodMode: boolean): number {
  const mult = (isBonded ? BOND_DAMAGE_MULT : 1) * (isGodMode ? DEBUG_GOD_MODE_DAMAGE_MULT : 1);
  return mult !== 1 ? Math.round(rawDamage * mult) : rawDamage;
}

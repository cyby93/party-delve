import type { PlayerClass, BondType, ZoneEffectType, StatusEffectType } from 'shared-types';

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
export const ABILITY_COOLDOWNS_MS: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [2000, 4000, 6000, 1000],  // Stone Wall, Tremor Stomp, Iron Skin, Avalanche(AUTO)
  spiritcaller: [1500, 5000, 4000, 6000],  // Ancestor's Voice(AUTO), Spirit Nova, Soul Mend, Warding Cry
  souldrinker:  [1000, 3000, 5000, 4000],  // Blood Draw(AUTO), Crimson Lash, Dark Pact, Void Pulse
  stormcaller:  [1000, 3000, 5000, 2000],  // Lightning Arc(AUTO), Tempest Hurl, Thunder Clap, Storm Eye(AUTO)
};

// Base damage per ability per class (applied in Story 3.4; defined here for balance).
export const ABILITY_DAMAGE: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [15, 35,  0, 50],  // Stone Wall(no dmg), Tremor AoE, Iron Skin(buff), Avalanche
  spiritcaller: [15, 40,  0,  0],  // Ancestor's Voice(mixed-faction), Spirit Nova(mixed-faction), Soul Mend, Warding Cry(buff)
  souldrinker:  [12, 30,  0, 25],  // Blood Draw drain, Crimson Lash, Dark Pact(debuff), Void Pulse
  stormcaller:  [18, 40, 45,  0],  // Lightning Arc, Tempest Hurl, Thunder Clap AoE, Storm Eye(field)
};

// Heal value applied to allies for Spiritcaller's mixed-faction abilities (Story 3.17).
// Soul Mend (slot 2) heals via full revive, not this table (Story 3.18); Warding Cry
// (slot 3) shields, doesn't heal. All zero for every other class — no mixed-faction
// ability exists outside Spiritcaller.
export const ABILITY_HEAL_AMOUNT: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [10, 30, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

// ── Self-cost / HP-scaled damage / lifesteal ─────────────────────────────────
// All zero until Story 3.19 (Blood Spike self-cost/lifesteal, Crimson Lash
// HP-scaled damage) sets Souldrinker's slots.
export const ABILITY_SELF_COST_HP: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_HP_SCALED_DAMAGE: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_LIFESTEAL_PCT: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
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

// ── Ability hit zones (alpha tuning values) ───────────────────────────────────
// Directional abilities: hit circle at (player + direction * hitRange), radius = hitRadius
// TAP abilities: hit circle at player position, radius = hitRadius (hitRange unused)
export const ABILITY_HIT_RANGE_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [  0, 160,   0, 200],
  spiritcaller: [180,   0, 200,   0],
  souldrinker:  [150, 180,   0,   0],
  stormcaller:  [160, 200,   0, 160],
};

export const ABILITY_HIT_RADIUS_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [100, 60, 120,  50],
  spiritcaller: [ 50, 90,  60,  90],
  souldrinker:  [ 50, 65,  80,  80],
  stormcaller:  [ 60, 70, 110,  80],
};

// ── Projectiles ───────────────────────────────────────────────────────────────
export const PROJECTILE_SPEED_PX_S = 600;
export const PROJECTILE_MAX_RANGE_PX = 800;

// ── Declarative projectile→zone chaining ─────────────────────────────────────
// Populated per-ability by Story 3.19 (Void Pulse); all-null until then so
// GameRoom reads this table instead of special-casing any one ability.
export interface ChainedZoneConfig {
  effectType: ZoneEffectType;
  radius: number;
  tickIntervalMs: number;
  durationMs: number;
}

export const ABILITY_CHAINED_ZONE: Record<PlayerClass, readonly [ChainedZoneConfig | null, ChainedZoneConfig | null, ChainedZoneConfig | null, ChainedZoneConfig | null]> = {
  stonehide:    [null, null, null, null],
  spiritcaller: [null, null, null, null],
  souldrinker:  [null, null, null, null],
  stormcaller:  [null, null, null, null],
};

// ── Declarative per-ability status-effect application ───────────────────────
// Populated per-ability by each kit-rework story (3.16 sets Stonehide; 3.17
// adds Spiritcaller's Warding Cry). GameRoom reads this table instead of
// special-casing any one ability by class/index.
export type StatusEffectScope = 'self' | 'enemies-in-zone' | 'allies-in-zone';

// ── Spirit Nova expanding-radius sweep (Story 3.17) ──────────────────────────
// Plain named constants, not a per-class table — Spirit Nova is the only ability
// in the full spec that uses this delivery type (see resolveExpandingRadius in
// targeting.ts); a 4-tuple table would be mostly-unused ceremony for one consumer.
export const SPIRIT_NOVA_DURATION_MS = 600;
export const SPIRIT_NOVA_MAX_RADIUS_PX = 220;

// ── Soul Mend hold-to-channel revive (Story 3.18) ────────────────────────────
// Plain named constants, not a per-class table — Soul Mend is the only AIM_CAST
// ability in the full spec, same rationale as Spirit Nova's constants above.
export const SOUL_MEND_CHANNEL_DURATION_MS = 2500;
// Fire-attempts arrive every 33ms (mobile's AUTO-style continuous-send interval)
// while held; a few missed beats tolerates jitter without feeling laggy on release.
export const SOUL_MEND_LIVENESS_MS = 150;

export interface AbilityStatusEffectConfig {
  effectType: StatusEffectType;
  magnitude: number;
  durationMs: number;
  scope: StatusEffectScope;
}

export const ABILITY_STATUS_EFFECT: Record<PlayerClass, readonly [AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null]> = {
  stonehide: [
    null, // Stone Wall — displacement, not a status effect (see ABILITY_DISPLACEMENT_STRENGTH)
    { effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' }, // Tremor Stomp
    { effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' }, // Iron Skin
    null, // Avalanche
  ],
  spiritcaller: [
    null, // Ancestor's Voice — mixed-faction damage/heal, not a status effect
    null, // Spirit Nova — mixed-faction damage/heal, not a status effect
    null, // Soul Mend — Story 3.18
    { effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' }, // Warding Cry
  ],
  souldrinker:  [null, null, null, null],
  stormcaller:  [null, null, null, null],
};

// ── Declarative per-ability displacement strength ────────────────────────────
// 0 = no displacement. Populated per-ability by each kit-rework story.
export const ABILITY_DISPLACEMENT_STRENGTH: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [40, 0, 0, 0], // Stone Wall pulls hit enemies toward the caster
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

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

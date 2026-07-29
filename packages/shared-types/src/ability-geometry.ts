import type { PlayerClass } from './player.js';

/**
 * The **ability presentation contract** — the spatial + delivery + spatial-sweep
 * subset of ability tuning that both the authoritative simulation and the host
 * renderer must agree on, so a range/radius change moves the sim hit *and* its
 * on-screen effect from a single edit (Story 7.9, ADR-0003).
 *
 * These constants used to live in `packages/game-rules/src/balance.ts` and were
 * hand-transcribed into `apps/host-client` (the host may not import game-rules
 * *logic*). That transcription silently drifted (`D-7.2-A`). They now live here,
 * in `shared-types`, which both the sim (via a `game-rules` re-export) and the
 * host import directly. Values are byte-identical to their former `balance.ts`
 * definitions — this is a relocation, not a re-tune.
 *
 * Pure balance the host never renders as geometry — damage, cooldown, heal,
 * status magnitude, displacement, lifesteal, self-cost — stays in `balance.ts`
 * and remains host-forbidden. See ADR-0003 for the boundary rule.
 */

// ── Ability hit zones (alpha tuning values) ───────────────────────────────────
// Directional abilities: hit circle at (player + direction * hitRange), radius = hitRadius
// TAP abilities: hit circle at player position, radius = hitRadius (hitRange unused)
export const ABILITY_HIT_RANGE_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [160, 0,   0, 75],
  spiritcaller: [100,   0, 200,   0],
  souldrinker:  [150, 180, 180,   0], // Dark Pact (slot 2) now aims a forward cone for its ally-target search (Story 3.19)
  stormcaller:  [160, 200,   0, 160],
};

export const ABILITY_HIT_RADIUS_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [160, 300, 200,  50],
  spiritcaller: [ 120, 90,  60,  90],
  souldrinker:  [ 50, 65,  80,  80],  
  stormcaller:  [ 60, 70, 110,  80],
};

// ── Ability hit shape (Story 3.25, ADR-0005) ─────────────────────────────────
// Cone abilities reuse ABILITY_HIT_RANGE_PX for length (no second range value) —
// only the shape and the cone's full angle are new. 'circle' abilities keep
// resolving through isInHitZone exactly as before; ABILITY_HIT_RADIUS_PX becomes
// inert (unread) for 'cone' entries but stays in the table for width symmetry
// (ADR-0005's "addition, not restructuring" discipline).
export type AbilityHitShape = 'circle' | 'cone';

export const ABILITY_HIT_SHAPE: Record<PlayerClass, readonly [AbilityHitShape, AbilityHitShape, AbilityHitShape, AbilityHitShape]> = {
  stonehide:    ['cone', 'circle', 'circle', 'cone'], // Stone Wall, Avalanche
  spiritcaller: ['cone', 'circle', 'circle', 'circle'], // Ancestor's Voice
  souldrinker:  ['circle', 'cone', 'circle', 'circle'], // Crimson Lash
  stormcaller:  ['circle', 'circle', 'circle', 'circle'], // untouched — Story 3.26's scope
};

// Full cone angle in degrees (half-angle is applied on each side of the aim
// direction by isInConeZone). Entries are 0 for every 'circle' ability — unread.
export const ABILITY_CONE_ANGLE_DEG: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [50, 0, 0, 40],
  spiritcaller: [70, 0, 0, 0],
  souldrinker:  [0, 45, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

// ── Ability delivery type ────────────────────────────────────────────────────
// Story 3.19: the first abilities to resolve via a spawned ProjectileState
// (Story 3.13) instead of the default same-tick hit-scan. Declarative so
// GameRoom branches on this table instead of special-casing any one ability.
// Story 3.20: extended with 'zone' — Storm Eye places a ZoneState directly
// (via createZoneBody in GameRoom's dispatch block) rather than through a
// spawned ProjectileState like the 'projectile' abilities above.
export type AbilityDeliveryType = 'hitscan' | 'projectile' | 'zone';

export const ABILITY_DELIVERY: Record<PlayerClass, readonly [AbilityDeliveryType, AbilityDeliveryType, AbilityDeliveryType, AbilityDeliveryType]> = {
  stonehide:    ['hitscan', 'hitscan', 'hitscan', 'hitscan'],
  spiritcaller: ['hitscan', 'hitscan', 'hitscan', 'hitscan'],
  souldrinker:  ['projectile', 'hitscan', 'hitscan', 'projectile'], // Blood Spike, Void Pulse
  stormcaller:  ['hitscan', 'projectile', 'hitscan', 'zone'], // Tempest Hurl (Story 3.26), Storm Eye
};

// ── Projectiles ───────────────────────────────────────────────────────────────
export const PROJECTILE_SPEED_PX_S = 600;
export const PROJECTILE_MAX_RANGE_PX = 800;

// ── Tempest Hurl projectile + blast (Story 3.26) ─────────────────────────────
// Plain named constants, not a per-class table — mirrors Spirit Nova/Storm Eye's
// single-consumer-constant convention. Bigger/slower than the shared projectile
// defaults (28px vs. 12px radius, 300px/s vs. 600px/s speed). Blast radius is
// derived from the projectile radius, not a separately-tuned literal (AC5).
export const TEMPEST_HURL_PROJECTILE_RADIUS_PX = 28;
export const TEMPEST_HURL_SPEED_PX_S = 300;
export const TEMPEST_HURL_BLAST_RADIUS_PX = TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2;

// ── Void Pulse chained-zone radius (Story 3.19) ──────────────────────────────
// The spatial radius of Void Pulse's chained 'pull' zone. Extracted out of
// balance.ts's ABILITY_CHAINED_ZONE table into a named contract constant so the
// host can size the zone visual (Story 7.8) from the same value the sim uses;
// the table's game-logic fields (effectType, tickIntervalMs, durationMs) stay in
// balance.ts and reference this radius.
export const VOID_PULSE_ZONE_RADIUS_PX = 150;

// ── Spirit Nova expanding-radius sweep (Story 3.17) ──────────────────────────
// Plain named constants, not a per-class table — Spirit Nova is the only ability
// in the full spec that uses this delivery type (see resolveExpandingRadius in
// targeting.ts); a 4-tuple table would be mostly-unused ceremony for one consumer.
// The visible sweep must match the real swept radius, so both are contract values.
export const SPIRIT_NOVA_DURATION_MS = 600;
export const SPIRIT_NOVA_MAX_RADIUS_PX = 220;

// ── Storm Eye persistent zone radius (Story 3.20) ────────────────────────────
// Plain named constant, not a per-class table — Storm Eye is the only 'zone'-
// delivery ability in the full spec. The zone's tick cadence/damage/duration are
// game-logic and stay in balance.ts; only the visible zone *radius* is a contract
// value the host renders.
export const STORM_EYE_ZONE_RADIUS_PX = 150;

// Documents where to tune Storm Eye's placement distance (Story 3.26) — not a
// second tunable value, just an alias onto the existing hit-range entry.
export const STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3];

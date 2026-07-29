import type { PlayerClass } from './player.js';

/**
 * The **ability presentation contract** — the spatial + delivery + spatial-sweep
 * subset of ability tuning that both the authoritative simulation and the host
 * renderer must agree on, so a range/radius change moves the sim hit *and* its
 * on-screen effect from a single edit (Story 7.9, ADR-0003).
 *
 * Ability-indexed geometry (`ABILITY_GEOMETRY`, ADR-0006) is one `AbilityGeometry`
 * object per ability, replacing 5 parallel per-field tables (`ABILITY_HIT_RANGE_PX`,
 * `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`,
 * `ABILITY_DELIVERY`) that grew one new top-level table per new spatial property
 * (D-CC1). Values are byte-identical to the tables it replaces — this is a
 * restructuring, not a re-tune.
 *
 * Pure balance the host never renders as geometry — damage, cooldown, heal,
 * status magnitude, displacement, lifesteal, self-cost — stays in `balance.ts`
 * and remains host-forbidden. See ADR-0003 for the boundary rule.
 */

// ── Ability hit shape ─────────────────────────────────────────────────────────
export type AbilityHitShape = 'circle' | 'cone';

// ── Ability delivery type ─────────────────────────────────────────────────────
// Story 3.19: the first abilities to resolve via a spawned ProjectileState
// (Story 3.13) instead of the default same-tick hit-scan. Declarative so
// GameRoom branches on this table instead of special-casing any one ability.
// Story 3.20: extended with 'zone' — Storm Eye places a ZoneState directly
// (via createZoneBody in GameRoom's dispatch block) rather than through a
// spawned ProjectileState like the 'projectile' abilities above.
export type AbilityDeliveryType = 'hitscan' | 'projectile' | 'zone';

// ── Per-ability geometry (Story 3.27, ADR-0006) ──────────────────────────────
// hitRangePx: directional abilities hit a circle at (player + direction *
//   hitRangePx), radius hitRadiusPx; TAP abilities hit a circle at the player's
//   position, radius hitRadiusPx (hitRangePx unused).
// coneAngleDeg: only present when hitShape is 'cone' — the cone's full angle in
//   degrees (half-angle applied on each side of the aim direction by
//   isInConeZone). Cone abilities reuse hitRangePx for length; hitRadiusPx is
//   unread for 'cone' entries.
export interface AbilityGeometry {
  readonly hitRangePx: number;
  readonly hitRadiusPx: number;
  readonly hitShape: AbilityHitShape;
  readonly coneAngleDeg?: number;
  readonly delivery: AbilityDeliveryType;
}

export const ABILITY_GEOMETRY: Record<PlayerClass, readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]> = {
  stonehide: [
    { hitRangePx: 160, hitRadiusPx: 160, hitShape: 'cone', coneAngleDeg: 50, delivery: 'hitscan' }, // Stone Wall
    { hitRangePx: 0, hitRadiusPx: 300, hitShape: 'circle', delivery: 'hitscan' }, // Tremor Stomp
    { hitRangePx: 0, hitRadiusPx: 200, hitShape: 'circle', delivery: 'hitscan' }, // Iron Skin
    { hitRangePx: 75, hitRadiusPx: 50, hitShape: 'cone', coneAngleDeg: 40, delivery: 'hitscan' }, // Avalanche
  ],
  spiritcaller: [
    { hitRangePx: 100, hitRadiusPx: 120, hitShape: 'cone', coneAngleDeg: 70, delivery: 'hitscan' }, // Ancestor's Voice
    { hitRangePx: 0, hitRadiusPx: 90, hitShape: 'circle', delivery: 'hitscan' }, // Spirit Nova
    { hitRangePx: 200, hitRadiusPx: 60, hitShape: 'circle', delivery: 'hitscan' }, // Soul Mend
    { hitRangePx: 0, hitRadiusPx: 90, hitShape: 'circle', delivery: 'hitscan' }, // Warding Cry
  ],
  souldrinker: [
    { hitRangePx: 150, hitRadiusPx: 50, hitShape: 'circle', delivery: 'projectile' }, // Blood Spike
    { hitRangePx: 180, hitRadiusPx: 65, hitShape: 'cone', coneAngleDeg: 45, delivery: 'hitscan' }, // Crimson Lash
    { hitRangePx: 180, hitRadiusPx: 80, hitShape: 'circle', delivery: 'hitscan' }, // Dark Pact — directional single-ally search (Story 3.19); hitShape stays 'circle', not a real cone hit-test
    { hitRangePx: 0, hitRadiusPx: 80, hitShape: 'circle', delivery: 'projectile' }, // Void Pulse
  ],
  stormcaller: [
    { hitRangePx: 160, hitRadiusPx: 60, hitShape: 'circle', delivery: 'hitscan' }, // Lightning Arc
    { hitRangePx: 200, hitRadiusPx: 70, hitShape: 'circle', delivery: 'projectile' }, // Tempest Hurl (Story 3.26)
    { hitRangePx: 0, hitRadiusPx: 110, hitShape: 'circle', delivery: 'hitscan' }, // Thunder Clap
    { hitRangePx: 160, hitRadiusPx: 80, hitShape: 'circle', delivery: 'zone' }, // Storm Eye
  ],
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
export const STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_GEOMETRY.stormcaller[3].hitRangePx;

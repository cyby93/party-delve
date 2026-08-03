# ADR-0006: Ability Geometry Consolidation

## Status
Accepted

## Context

`packages/shared-types/src/ability-geometry.ts` (established by ADR-0003, extended by ADR-0005) stored ability geometry as 5 parallel "struct-of-arrays" tables, each `Record<PlayerClass, readonly [T,T,T,T]>` indexed `[class][abilitySlot 0-3]`: `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`.

Every new spatial property requires a new top-level table, back-filled with placeholder values for every class/slot that doesn't use it. ADR-0005 added 2 such tables (`ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`) on top of roughly 15 already in `balance.ts` and this file combined. The user flagged this sprawl directly during that session; a consolidation to per-ability config objects was discussed and deliberately deferred, tracked as **D-CC1** in `deferred-work.md`. ADR-0005's own "Alternatives considered" section already named the target shape: one `AbilityGeometry` object per ability in `shared-types`, one `AbilityBalance` object per ability in `game-rules` — directionally right, out of scope for that change.

This ADR resolves D-CC1's `shared-types` half. The `game-rules`/`balance.ts` half (`AbilityBalance`) is intentionally **not** addressed here — an import-graph check found `ABILITY_GEOMETRY`'s consumers span 3 ownership areas (`shared-types` itself, `GameRoom.ts` in `apps/simulation-server`, and 4 VFX files in `apps/host-client`), while `balance.ts`'s tables are read only by `GameRoom.ts`, entirely within Simulation Engineer ownership. Splitting the two halves keeps the balance-side consolidation single-owner; it is tracked as a separate future story (3-28, not yet created).

## Decision

Replace the 5 flat tables with one interface and one consolidated table:

```ts
export interface AbilityGeometry {
  hitRangePx: number;
  hitRadiusPx: number;
  hitShape: AbilityHitShape;
  coneAngleDeg?: number; // present only for 'cone'-shaped abilities
  delivery: AbilityDeliveryType;
}

export const ABILITY_GEOMETRY: Record<PlayerClass, readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]>
```

Every class/slot's values are byte-identical to the removed tables — this is a restructuring, not a re-tune. `coneAngleDeg` is a plain optional field, present only where `hitShape === 'cone'` (Stone Wall, Avalanche, Ancestor's Voice, Crimson Lash); omitted everywhere else.

The 5 old table exports (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`) are **removed**, not kept as derived re-exports. Every known read site — `GameRoom.ts`'s ~15 lookups (plus its two shared helpers, `gatherPlayersInHitZone`/`isInAbilityHitZone`, which now accept an `AbilityGeometry` object directly instead of 3-5 separate scalar parameters), the 4 host-client VFX files, and 10 test files — is migrated in this same story, atomically.

The non-table, single-consumer constants (`PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`, `TEMPEST_HURL_*`, `VOID_PULSE_ZONE_RADIUS_PX`, `SPIRIT_NOVA_*`, `STORM_EYE_ZONE_RADIUS_PX`) are unchanged — D-CC1 targets the per-class flat-table sprawl, not these. `STORM_EYE_PLACEMENT_RANGE_PX` keeps its alias role, now deriving from `ABILITY_GEOMETRY.stormcaller[3].hitRangePx`.

`packages/game-rules/src/balance.ts` and `index.ts` update their re-export lists to pass through `ABILITY_GEOMETRY` (and the `AbilityGeometry` type) instead of the 5 removed names — `apps/simulation-server` sees a compile-time-only churn at its import line and read sites, no runtime behavior change.

## Consequences

Positive:
- Adding a future ability property is one optional field on `AbilityGeometry` instead of a new top-level table requiring placeholder back-fill across every class/slot.
- `gatherPlayersInHitZone`/`isInAbilityHitZone` collapse from 3-5 scalar parameters to one object parameter — the consolidation actually simplifies call sites, not just renames imports.
- One place these values live, not five (or, counting `balance.ts`'s untouched tables, one fewer axis of sprawl).

Negative / trade-offs:
- **This is the first non-additive change to `ability-geometry.ts` since ADR-0003.** Every prior story (7.9, 3.25, 3.26) framed its change as additive — existing exports were extended, never removed. This one removes 5 exported symbols outright. Mitigated by migrating every known read site atomically within one story (verified via typecheck + full test suite), so no caller is ever left importing a removed symbol mid-migration; there is no soft-deprecation window.
- `AbilityBalance` (D-CC1's other half) remains unresolved — `balance.ts` still has ~15 flat per-class tables. Tracked as future Story 3-28.

## Alternatives considered

- **A discriminated union on `hitShape`** (`{ hitShape: 'cone'; coneAngleDeg: number; ... } | { hitShape: 'circle'; ... }`). More type-precise, but forces every read site to narrow on `hitShape` before touching any other field, when in practice `hitRangePx`/`hitRadiusPx`/`delivery` are already read unconditionally regardless of shape at every existing call site. Rejected as disproportionate for a mechanical migration; a plain optional field achieves the same "no placeholder back-fill" goal with far less churn.
- **Keeping the 5 old table names as derived re-exports** (computed from `ABILITY_GEOMETRY` for backward compatibility). Rejected — it would let old and new access patterns coexist indefinitely, defeating D-CC1's actual goal (one source, not two). A hard, atomic cutover was chosen instead, consistent with D-CC1's own framing ("touches every read site... needs its own story").
- **Consolidating `AbilityBalance` in the same story.** Rejected — its consumers are entirely within Simulation Engineer ownership (`GameRoom.ts` only), while `AbilityGeometry`'s consumers span 3 ownership areas; combining them would needlessly widen this story's cross-boundary surface. Split into a separate future story (3-28).

## References

- ADR-0003 (ability presentation contract — established the `shared-types`/`game-rules` package boundary this consolidation stays inside)
- ADR-0005 (cone hit-geometry and extended delivery — named the `AbilityGeometry`/`AbilityBalance` target shape in its "Alternatives considered" section, deferred it as D-CC1)
- `D-CC1` — `_bmad-output/implementation-artifacts/deferred-work.md`
- Story 3.27 — `_bmad-output/implementation-artifacts/3-27-ability-geometry-consolidation-per-ability-objects.md` (this ADR's implementing story)

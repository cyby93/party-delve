# ADR-0005: Cone Hit-Geometry and Extended Ability Delivery

## Status
Accepted

## Context

Stories 3.16, 3.17, and 3.19 (Stonehide, Spiritcaller, Souldrinker kit reworks) each documented Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash as `Cone/Line` delivery in their acceptance criteria. None of them ever were — `isInHitZone` (`packages/game-rules/src/systems/combat.ts`) has only ever implemented a circle-vs-circle test, offset along the aim direction for directional abilities. The "cone" language in three separate stories' acceptance criteria was written against a shape that was never built; the sim and the epics silently diverged the same way `ABILITY_HIT_RANGE_PX` and the host's hand-transcribed VFX literals diverged before ADR-0003 — except here the drift is between design intent and implementation, not between two runtime copies of one value.

Separately, Story 3.20 explicitly scoped Lightning Arc and Tempest Hurl out of Stormcaller's rework ("the session confirmed them as already correct, no rework needed"). Story 7.5's VFX work later found that judgment didn't hold up under scrutiny: Tempest Hurl's VFX planner fakes a thrown-projectile look for an ability that resolves same-tick hit-scan, with no `ProjectileState` behind it at all.

A 2026-07-28 correct-course session (triggered by the user's own `TODO.md` notes) revisited both gaps together, since fixing the cone-shape gap meant building a `isInConeZone` primitive that Lightning Arc's new "first target in the aimed direction" behavior could reuse as a narrow targeting corridor.

## Decision

Extend the ability presentation contract (`packages/shared-types/src/ability-geometry.ts`, established by ADR-0003) with:

- **`AbilityHitShape` / `ABILITY_HIT_SHAPE`** — a `'circle' | 'cone'` per-class 4-tuple table, same declarative-table pattern as `ABILITY_DELIVERY`. Applies to: Stone Wall, Avalanche (stonehide), Ancestor's Voice (spiritcaller), Crimson Lash (souldrinker).
- **`ABILITY_CONE_ANGLE_DEG`** — the cone's full angle in degrees, per ability. Cone *length* is **not** a new value — it reuses each ability's existing `ABILITY_HIT_RANGE_PX` entry, so there is exactly one place that tunes reach for any ability regardless of shape.
- **`isInConeZone`** (`packages/game-rules/src/systems/combat.ts`) — a new pure function, sibling to `isInHitZone` (kept unchanged for every circle ability: TAP/self/proximity/zone abilities all stay circles). Apex at the caster, aimed along the cast direction, in/out test via distance ≤ length and angle-to-target ≤ half-angle.
- **Lightning Arc's "first target" behavior reuses `isInConeZone`** with a narrow corridor angle (30°) instead of a new raycast mechanism — there is no planck `world.rayCast` usage anywhere in this codebase, and adding one would be a physics-layer change disproportionate to what "hit the first thing roughly in front of you" requires. The sim gathers corridor candidates and picks the nearest one, rather than damaging everyone the cone touches.
- **Lightning Arc's chain** (bounce to nearby enemies after the first hit) is new game-rules logic, not a contract addition — `LIGHTNING_ARC_MAX_BOUNCES`, `LIGHTNING_ARC_CHAIN_RADIUS_PX`, `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF` are plain balance constants (`packages/game-rules/src/balance.ts`), following the Config Hierarchy rule — no different in kind from any other tunable magnitude in that file.
- **A new delta, `ability:chain-hit`** (`packages/net-protocol`): `{casterId, fromX, fromY, toEnemyId, chainIndex}`, broadcast once per hit in a Lightning Arc chain (including the first strike). Existing `enemy:damaged` deltas carry no position or chain-grouping data, and same-WS-flush deltas are already a known correlation hazard in this codebase (`D-7.11-B`, `D-dev5-B`) — without this, the host has no reliable way to draw connected chain-lightning arcs for a specific cast. This is additive: no existing message shape changes.
- **Tempest Hurl becomes real `'projectile'` delivery** (was `'hitscan'`), reusing Blood Spike/Void Pulse's existing `ProjectileState`/planck-body machinery rather than building new infrastructure. Two new spatial constants — `TEMPEST_HURL_PROJECTILE_RADIUS_PX` (28px, vs. the 12px default every other projectile uses) and `TEMPEST_HURL_SPEED_PX_S` (300px/s, vs. the shared 600px/s default) — required widening `createProjectileBody` (`apps/simulation-server/src/physics/world.ts`) with an optional `radiusPx` parameter (default 12, so Blood Spike/Void Pulse are byte-identical). `TEMPEST_HURL_BLAST_RADIUS_PX` is defined as `TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2` — a computed relationship, not a second tuned literal, so it can't drift from the "blast = radius × 2" rule it encodes.
- **Storm Eye's placement distance gets a documentation alias**, not a new value: `STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3]`. The distance was already tunable — it just wasn't findable, buried in a generically-named table. A genuinely separate constant here would create two numbers that could silently diverge, the same drift class this ADR (and ADR-0003) already exists to close; the alias avoids introducing a new instance of the problem while fixing it.

## Consequences

Positive:
- Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash finally match what Stories 3.16/3.17/3.19 always said they should be — closes a design/implementation drift that predates this ADR by weeks.
- Lightning Arc and Tempest Hurl gain their intended feel (single-target strike + chain, slow AoE-on-impact projectile) without new physics infrastructure (no raycast system, reuses existing projectile machinery).
- `ability:chain-hit` gives the host a reliable, minimal signal for a genuinely new visual (connected arcs across a same-tick multi-hit sequence) instead of guessing from delta ordering.
- Every new constant follows an existing declarative pattern (`ABILITY_HIT_SHAPE` mirrors `ABILITY_DELIVERY`; `TEMPEST_HURL_BLAST_RADIUS_PX` as a computed relationship mirrors how `SPIRIT_NOVA_MAX_RADIUS_PX`/`_DURATION_MS` are already named-and-paired) — no new architectural idiom introduced.

Negative / trade-offs:
- Two more flat per-class tables (`ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`) added to a config style (`balance.ts` + `ability-geometry.ts`) that already has roughly 15 such tables. The user flagged this sprawl directly during this session; a consolidation to per-ability config objects (within each existing package boundary, not across it — see the "Alternatives considered" section) was discussed and deliberately deferred, tracked as **D-CC1** in `deferred-work.md`, so it isn't repeated here as a live decision.
- `ABILITY_HIT_RADIUS_PX` entries for the four newly-cone-shaped abilities become inert (radius has no meaning for a cone) but are left in place for table-width symmetry, rather than restructured — consistent with the "relocation, not a re-tune" discipline ADR-0003 established, applied here to "addition, not restructuring."
- Existing Epic 7 VFX for all six touched abilities (Stone Wall, Avalanche, Ancestor's Voice, Crimson Lash, Lightning Arc, Tempest Hurl) now visually mismatches its sim behavior (circle where the sim hits a cone; a static point-hit where the sim now chains; a same-tick hitscan flash where the sim now throws a slow, bigger ball) until a follow-up Epic 7 VFX story adds the needed primitives (a cone/wedge shape, chain-arc rendering, and a resized/re-timed projectile + blast burst). This is the same category of gap Epic 7 has repeatedly logged as deferred host-side follow-up work elsewhere (e.g. `D-7.8-A`) — tracked here, not fixed in this change.

## Alternatives considered

- **A full per-ability config object, unifying spatial and balance fields.** Rejected for this change — it would collide with ADR-0003's authority boundary (spatial data is host-importable, balance data is host-forbidden, currently enforced by physical package separation). Merging both into one object forces a choice between breaking that boundary or splitting the "unified" object across two files anyway. A narrower version — one config object per ability *within* each existing package (an `AbilityGeometry` object in `shared-types`, an `AbilityBalance` object in `game-rules`) — was judged directionally right but out of scope for this change; tracked as `D-CC1`.
- **A real planck.js raycast for Lightning Arc.** Rejected — no raycast usage exists anywhere in this codebase today, and a narrow-cone-plus-nearest-pick achieves the same "first thing in front of me" result using a primitive this ADR was already introducing, with no new physics-layer surface.
- **Reusing Void Pulse's chained-`ZoneState` machinery for Tempest Hurl's explosion.** Rejected — that machinery is built for a *persistent, ticking* zone (Void Pulse's pull field); Tempest Hurl's explosion is a one-shot instant burst. Reusing it would mean fighting its duration/tick semantics for no benefit over a direct AoE-damage loop at the impact point (the same shape the mixed-faction and generic hit-scan loops already use).
- **A dedicated `STORM_EYE_PLACEMENT_RANGE_PX` constant, independent of `ABILITY_HIT_RANGE_PX`.** Rejected — would create two numbers for one placement distance, reintroducing the exact drift class this ADR (and ADR-0003) exists to close. An alias keeps one source of truth while fixing discoverability.

## References

- ADR-0003 (ability presentation contract — this ADR extends it)
- `D-CC1` — `_bmad-output/implementation-artifacts/deferred-work.md` (deferred per-ability config consolidation)
- `D-7.11-B`, `D-dev5-B` — same-WS-flush delta correlation hazard, motivating `ability:chain-hit`
- Stories 3.16, 3.17, 3.19, 3.20 — original (now superseded-in-part) acceptance criteria
- Stories 3.25, 3.26 — this ADR's implementing stories (`_bmad-output/planning-artifacts/epics.md`)
- `TODO.md` — the user's own notes that triggered this correct-course session (2026-07-28)

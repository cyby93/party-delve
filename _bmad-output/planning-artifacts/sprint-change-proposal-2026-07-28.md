# Sprint Change Proposal — 2026-07-28

**Trigger:** User-authored `TODO.md` notes ("class ability mechanical fixes to align with expectation"), worked through via `gds-correct-course`.

---

## 1. Issue Summary

Two related problems, discovered together:

1. **A pre-existing spec/implementation drift.** Stories 3.16 (Stonehide), 3.17 (Spiritcaller), and 3.19 (Souldrinker) each documented Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash as `Cone/Line` delivery in their own acceptance criteria — but `isInHitZone` (`packages/game-rules/src/systems/combat.ts`) has only ever implemented a circle-vs-circle hit test, offset along the aim direction. No cone shape has ever existed in this codebase. The epics said cone; the sim did circle. This was invisible until the user asked for a real CONE geometry type and the review turned up that three already-shipped stories' acceptance criteria were never actually satisfied.

2. **A reopened scoping decision.** Story 3.20 explicitly ruled Lightning Arc and Tempest Hurl "already correct, no rework needed." Story 7.5's VFX work later found Tempest Hurl's VFX fakes a thrown-projectile look for an ability that has no `ProjectileState` behind it — a sign that ruling didn't hold up. The user has now explicitly asked to rework both: Lightning Arc into a first-target-plus-chain-lightning ability, Tempest Hurl into a real slow/large exploding projectile.

Additionally, drafting the CONE contract surfaced a legitimate, separate architecture concern: the ability config tables (`balance.ts`, `ability-geometry.ts`) already comprise ~15 parallel per-property tables (struct-of-arrays), and this change adds 2 more. The user asked to proceed with the existing pattern for now and defer a consolidation refactor — tracked as **D-CC1** (`deferred-work.md`), not resolved by this proposal.

---

## 2. Impact Analysis

### Epic Impact

- **Epic 3 (Core Combat)** — cannot be considered fully closed as originally understood: 3 of its already-"completed" stories (3.16, 3.17, 3.19) had acceptance criteria that were never actually met (cone shape). Per this project's own established convention (see 3.21a–c, 3.22–3.24), completed stories are not edited in place — a new "Epic 3 Correction" section was appended to `epics.md` with two new stories:
  - **Story 3.25** — CONE hit-geometry contract + Stonehide/Spiritcaller/Souldrinker cone conversion (Stone Wall, Avalanche, Ancestor's Voice, Crimson Lash)
  - **Story 3.26** — Stormcaller Rework II: Lightning Arc chain lightning + Tempest Hurl real projectile + Storm Eye placement discoverability, reopening Story 3.20's scoping note for these two abilities only (Thunder Clap untouched)
- **Epic 7 (Ability & Environmental VFX)** — not modified by this proposal, but now has a real follow-up debt: 6 abilities' existing VFX will visually mismatch their new sim behavior (cone shape, chain arcs, resized/re-timed projectile) until a follow-up VFX story lands. Not scoped into 3.25/3.26 (Host Experience Engineer ownership, separate from this Simulation Engineer change per CLAUDE.md).
- No other epic is affected. MVP scope, GDD, and architecture are unaffected in substance — this is ability-content/mechanic depth, not a pillar or platform change.

### Artifact Conflicts

| Artifact | Impact |
|---|---|
| GDD | None — ability-level hit-shape detail lives below the GDD's altitude; no section references circle/cone specifics. |
| Architecture (`game-architecture.md`) | None directly; ADR-0005 extends ADR-0003's ability presentation contract, same location/pattern. |
| `epics.md` | Updated — new "Epic 3 Correction" section, Stories 3.25/3.26 (see above; full text already written into the file). |
| `docs/adr/` | New `ADR-0005-cone-hit-geometry-and-extended-delivery.md`, extending ADR-0003. |
| `deferred-work.md` | New entry `D-CC1` (per-ability config consolidation, deferred). |
| UX Design | None — mobile controller input mapping (2×2 grid, joystick/tap types) is unchanged for every affected ability. |
| Tests | New coverage needed: cone-geometry unit tests, Lightning Arc chain/no-double-hit tests, Tempest Hurl projectile+blast tests, `ability:chain-hit` contract round-trip test — all called out in Stories 3.25/3.26's acceptance criteria. |

### Technical Impact

- **Contract-change hook triggered** — `packages/shared-types` (`ability-geometry.ts`) and `packages/net-protocol` (new `ability:chain-hit` delta) are both touched. Requires Protocol Architect review, a compatibility note (additive only, no existing message shape changes), and the contract tests named in Story 3.26.
- **Simulation-safety hook triggered** — `apps/simulation-server/src/rooms/GameRoom.ts`, `apps/simulation-server/src/physics/world.ts`, and `packages/game-rules/src/systems/combat.ts`/`balance.ts` are all touched. Requires typecheck, unit tests, a deterministic-tick test, and a perf sanity check (Lightning Arc's chain search and Tempest Hurl's blast query both add per-cast enemy-list scans — bounded by existing enemy counts, expected negligible, but the hook still calls for a sanity check, not an assumption).
- No session-lifecycle, reconnect, room-state, join-flow, or prediction/reconciliation surface is touched — none of that machinery is involved in ability targeting.

---

## 3. Recommended Approach

**Selected: Direct Adjustment (Option 1)** — new stories within the existing Epic 3 structure, no rollback, no MVP/PRD scope change.

- **Effort:** Medium. Two stories, one shared primitive (`isInConeZone`), one new protocol delta, one new physics-body parameter, several new named balance constants — all following patterns already established elsewhere in this codebase (declarative per-class tables, `hitIds`-style dedup, `createZoneBody`'s existing `radiusPx` parameter as precedent for widening `createProjectileBody`).
- **Risk:** Low-to-medium. The riskiest single piece is Lightning Arc's chain + new delta (touches sim combat-critical code and adds a wire message), which is why it's split into its own story (3.26) with its own explicit hook requirements, separate from the more mechanical cone conversions (3.25).
- **Rollback (Option 2) was not viable/needed** — nothing about the current implementation is broken or blocking; this is additive rework, not a fix for a defect that demands reverting prior work.
- **MVP/PRD review (Option 3) was not needed** — no GDD/PRD goal, pillar, or platform requirement is affected. This stays entirely within "ability mechanics," a layer the GDD explicitly delegates to "Specifics TBD per class."

---

## 4. Detailed Change Proposals

All eight were reviewed and approved incrementally with the user before this document was compiled. Full technical detail for each lives in this conversation's proposal messages; summarized here for the record:

1. **CONE hit-shape contract** — `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` tables (`shared-types/ability-geometry.ts`), `isInConeZone` (`game-rules/combat.ts`). Foundation for all cone conversions.
2. **Stone Wall → CONE** (50°, length reuses existing 160px range) — shared `GameRoom.ts` hit-scan-loop shape branch.
3. **Avalanche → CONE** (40°, length reuses existing 75px range) — same shared branch as #2.
4. **Ancestor's Voice → CONE** (70°, length reuses existing 100px range) — its own mixed-faction dispatch branch + optional cone mode on `gatherPlayersInHitZone`.
5. **Crimson Lash → CONE** (45°, length reuses existing 180px range) — same shared branch as #2/#3; HP-scaled damage math untouched.
6. **Lightning Arc → first-target-in-corridor + chain lightning** — narrow 30° `isInConeZone` corridor, nearest-pick, then up to 2 bounces at 70% falloff within a 150px search radius from the last hit; new `ability:chain-hit` protocol delta for host chain-arc rendering.
7. **Tempest Hurl → real slow/big exploding projectile** — `ABILITY_DELIVERY.stormcaller[1]` becomes `'projectile'`; 28px body (vs. 12px default), 300px/s speed (vs. 600px/s default); on impact, AoE burst to every enemy within `radius*2` (56px) instead of single-target resolution.
8. **Storm Eye placement discoverability** — `STORM_EYE_PLACEMENT_RANGE_PX` alias to the existing `ABILITY_HIT_RANGE_PX.stormcaller[3]` value (no new number, no behavior change).

Plus:
- **D-CC1** filed in `deferred-work.md` — per-ability config object consolidation (within existing package boundaries), deliberately deferred by the user's explicit choice.
- **ADR-0005** written, extending ADR-0003 with the cone contract, the corridor-based "first target" approach, the new chain-hit delta, and the projectile-geometry parameterization.
- **`epics.md`** updated with the new "Epic 3 Correction" section and Stories 3.25/3.26.

---

## 5. Implementation Handoff

**Scope classification: Moderate.** Not Minor (touches a contract surface — `shared-types` and `net-protocol` — and needs Protocol Architect sign-off, not just a Developer-agent direct patch), not Major (no PM/Architect-level replan, no PRD/GDD change, no epic resequencing).

**Handoff:**
- **Protocol Architect** — review `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` (`shared-types`) and the new `ability:chain-hit` delta (`net-protocol`) against ADR-0005; sign off on the compatibility note (additive-only) before Story 3.26 merges.
- **Simulation Engineer** — implement Stories 3.25 and 3.26 in `apps/simulation-server` and `packages/game-rules`: `isInConeZone`, the five ability rewires, Lightning Arc's chain logic, Tempest Hurl's projectile/blast resolution, `createProjectileBody`'s new parameter. Owns the Simulation-safety hook (typecheck, unit tests, deterministic tick test, perf sanity) and all new unit/contract test coverage named in both stories' acceptance criteria.
- **Host Experience Engineer (follow-up, not blocking)** — a new VFX story is needed for: a cone/wedge primitive (`primitives.ts`) for the four cone abilities, chain-arc rendering off `ability:chain-hit` for Lightning Arc, and Tempest Hurl's resized/re-timed projectile + blast-radius burst visual. Not scoped into this proposal; flagged so it isn't lost.
- **Orchestrator** — sequence Story 3.25 before 3.26 (3.26 reuses 3.25's `isInConeZone`), and create the follow-up VFX story once 3.25/3.26 land.

**Success criteria:** Stories 3.25 and 3.26's acceptance criteria (as written in `epics.md`) pass; new unit/contract tests green; Protocol Architect sign-off recorded; no regression in existing `tests/unit/abilities.test.ts` coverage for the untouched parts of each reworked kit (Iron Skin, Tremor Stomp, Spirit Nova, Warding Cry, Blood Spike, Dark Pact, Void Pulse, Storm Eye's zone/strike behavior, Thunder Clap).

---

## Documents produced/modified by this proposal

- `docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (new entry: `D-CC1`)
- `_bmad-output/planning-artifacts/epics.md` (new section: "Epic 3 Correction: Cone Hit-Geometry & Stormcaller Delivery Rework", Stories 3.25 & 3.26)
- This document

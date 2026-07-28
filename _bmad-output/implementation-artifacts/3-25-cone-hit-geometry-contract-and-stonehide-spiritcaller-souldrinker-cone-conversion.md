---
baseline_commit: 156c4fb
---

# Story 3.25: CONE Hit-Geometry Contract & Stonehide/Spiritcaller/Souldrinker Cone Conversion

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Correction: Cone Hit-Geometry
  & Stormcaller Delivery Rework — first of 2 stories, correct-course
  2026-07-28, sprint-change-proposal-2026-07-28.md, ADR-0005). Sequenced
  before 3.26 — 3.26 reuses this story's `isInConeZone` primitive for
  Lightning Arc's targeting corridor.

Context: Stories 3.16, 3.17, and 3.19 each documented Stone Wall, Avalanche,
  Ancestor's Voice, and Crimson Lash as `Cone/Line` delivery in their own
  acceptance criteria. None of them ever were — `isInHitZone`
  (`packages/game-rules/src/systems/combat.ts:42`) has only ever implemented
  a circle-vs-circle test, offset along the aim direction for directional
  abilities. No cone shape has ever existed in this codebase. This story
  closes that drift by adding a real cone primitive and rewiring the four
  affected abilities to use it — their damage math, cooldowns, self-cost,
  and displacement are all correct already and stay untouched; only the
  *shape* of the hit-test changes.

  **The contract split (ADR-0003, extended by ADR-0005):** spatial/shape
  data (host-importable) lives in `packages/shared-types/src/ability-geometry.ts`;
  pure balance stays host-forbidden in `packages/game-rules/src/balance.ts`
  (re-exported there for zero-churn `import { ... } from 'game-rules'` call
  sites). `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` are shape/spatial data
  — they belong in `shared-types`, mirroring `ABILITY_DELIVERY`'s existing
  placement and re-export pattern exactly.

  **Cone length reuses the existing `ABILITY_HIT_RANGE_PX` entry — do not
  add a second range value.** Only two new tables are needed: which shape
  (`'circle' | 'cone'`) and how wide (`ABILITY_CONE_ANGLE_DEG`, full angle in
  degrees). The four newly-cone-shaped abilities' `ABILITY_HIT_RADIUS_PX`
  entries become inert (radius has no meaning for a cone) — leave them in
  place for table-width symmetry, per ADR-0005's "addition, not
  restructuring" discipline. Do not delete or repurpose them.

  **`isInConeZone`'s two real edge cases, both explicitly called out in the
  epics AC — get them right:**
  1. Target exactly at the caster's own position (distance = 0): the
     direction-to-target angle is undefined (0/0). Treat this as trivially
     inside the cone (apex point) rather than dividing by zero or returning
     false — a target standing exactly on top of the caster should not
     escape a cone that reaches them from every other position.
  2. Target exactly at the cone's max length or exactly on the angle
     boundary: use `<=` on both the distance check and the angle check
     (matching `isInHitZone`'s own `<=` on its radius check), not `<`.

  **`isInConeZone` requires its `dirX`/`dirY` to already be a unit vector**
  (magnitude 1) — every existing call site already normalizes direction to
  `normDirX`/`normDirY` before calling `isInHitZone` (see
  `GameRoom.ts:2248-2249`), so this is not a new precondition to invent, just
  one to preserve: do not re-normalize or accept a raw joystick vector
  inside `isInConeZone` itself.

  **Which abilities go through which GameRoom.ts branch:**
  - Stone Wall (stonehide[0]) and Avalanche (stonehide[3]) have no special
    branch — they fall through to the generic per-enemy hit-scan loop
    (`GameRoom.ts:2327-2400`, including its own boss check at
    `GameRoom.ts:2389-2399`). Both branches (enemy loop, boss check) need
    the shape dispatch.
  - Crimson Lash (souldrinker[1]) also falls through to that same generic
    loop — same two dispatch points, no separate code path.
  - Ancestor's Voice (spiritcaller[0]) has its own dedicated branch
    (`GameRoom.ts:2254-2325`) for its mixed-faction split — it needs the
    shape dispatch in 3 places: the enemy gather (`GameRoom.ts:2255-2256`),
    the boss check (`GameRoom.ts:2302-2305`), and `gatherPlayersInHitZone`
    (`GameRoom.ts:1144`, called at `GameRoom.ts:2257`) needs an optional
    cone mode so the ally half of the same mixed-faction query also becomes
    a cone. `gatherPlayersInHitZone` has 2 other call sites (Warding Cry's
    proximity gather at `GameRoom.ts:2203`, Soul Mend's channel gather at
    `GameRoom.ts:1275`, Spirit Nova's ally-in-ring gather at
    `GameRoom.ts:2421`) — all 3 must keep their existing circle behavior
    unchanged; make the cone mode opt-in (default circle) so those calls
    need zero edits.
  - Stone Wall's pull-toward-caster displacement (`ABILITY_DISPLACEMENT_STRENGTH.stonehide[0]`,
    applied via `applyDisplacement` at `GameRoom.ts:2353-2356`) is
    downstream of the hit-test, not part of it — do not touch
    `applyDisplacement` or its call site, only the `isInHitZone` gate that
    leads into it.
  - Iron Skin (stonehide[2], self-status), Tremor Stomp (stonehide[1],
    enemies-in-zone status), Spirit Nova (spiritcaller[1], expanding-ring
    sweep), Soul Mend (spiritcaller[2]), Warding Cry (spiritcaller[3]),
    Blood Spike/Dark Pact/Void Pulse (souldrinker[0,2,3]) are **all
    untouched** — none of them are in this story's cone-conversion list.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred, matching Stories 3.16-3.20's own established
  precedent for this exact class of change):
  Protocol Architect (`packages/shared-types/src/ability-geometry.ts` —
    the new `AbilityHitShape` contract)
  Simulation Engineer (`packages/game-rules/**`, `apps/simulation-server/**`
    — `isInConeZone`, the GameRoom.ts dispatch rewiring)

Goal:
  Task 1 — `AbilityHitShape` (`'circle' | 'cone'`) + `ABILITY_HIT_SHAPE` +
            `ABILITY_CONE_ANGLE_DEG` tables in `shared-types`, re-exported
            from `game-rules/balance.ts` (mirrors `ABILITY_DELIVERY`
            exactly).
  Task 2 — `isInConeZone` pure function in `combat.ts`, sibling to
            `isInHitZone` (which stays unchanged for every circle ability).
  Task 3 — Rewire Stone Wall/Avalanche's generic-loop hit-test, Crimson
            Lash's generic-loop hit-test, and Ancestor's Voice's
            mixed-faction hit-test (enemy + boss + `gatherPlayersInHitZone`'s
            new cone mode) to branch on `ABILITY_HIT_SHAPE`.
  Task 4 — Test coverage: `isInConeZone` edge cases in
            `tests/unit/combat.test.ts` (mirroring `isInHitZone`'s existing
            describe block there), each converted ability's real
            angle/range values exercised, `tests/unit/abilities.test.ts`
            regression-confirmed unaffected (it tests `dispatchAbility`'s
            pure damage/cooldown math, which this story does not touch).

Allowed paths:
  - packages/shared-types/src/ability-geometry.ts
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - packages/game-rules/src/systems/combat.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - tests/unit/combat.test.ts
  - tests/unit/abilities.test.ts (regression-confirmation edits only, if any
    hardcoded expectation needs updating — same caveat 3.20 hit with
    `ABILITY_DELIVERY`)
  - docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md (already
    written by the correct-course session — read, do not need to author)

Blocked paths:
  - Lightning Arc, Tempest Hurl, Storm Eye's placement alias — Story 3.26,
    not this story. Do not touch `stormcaller` entries in any new table
    (leave `ABILITY_HIT_SHAPE.stormcaller`/`ABILITY_CONE_ANGLE_DEG.stormcaller`
    all-circle/all-zero — Story 3.26 does not need this story to touch them
    either, since Lightning Arc's corridor is a separate dedicated-branch
    mechanism, not a generic-loop shape toggle; see 3.26's own story file).
  - `packages/net-protocol/**` — no wire contract changes in this story
    (that's 3.26's `ability:chain-hit`).
  - Any other class's or ability's `CLASS_DEFINITIONS`, `ABILITY_DAMAGE`,
    `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_SELF_COST_HP`, `ABILITY_LIFESTEAL_PCT`,
    `ABILITY_STATUS_EFFECT`, or `ABILITY_DISPLACEMENT_STRENGTH` entries.

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.25" section
  - docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md
  - _bmad-output/implementation-artifacts/deferred-work.md, `D-CC1` — read
    for context on why this story adds 2 more flat tables instead of
    consolidating (deliberately deferred, not in scope here)
  - packages/shared-types/src/ability-geometry.ts (existing tables + their
    doc comment explaining the ADR-0003 host/game-rules split)
  - packages/game-rules/src/systems/combat.ts (`isInHitZone`, its sibling)
  - apps/simulation-server/src/rooms/GameRoom.ts:1144 (`gatherPlayersInHitZone`),
    :2251-2325 (Ancestor's Voice), :2327-2400 (generic hit-scan loop + boss check)
  - tests/unit/combat.test.ts (existing `isInHitZone` describe block — mirror
    its style for the new `isInConeZone` block)

Non-goals:
  - VFX for the new cone shape — Stone Wall/Avalanche/Ancestor's Voice/Crimson
    Lash's VFX keep drawing their old circle/fan visuals until a follow-up
    Epic 7 VFX story adds a cone/wedge primitive to `primitives.ts`. Not
    blocking, tracked separately (flagged in the correct-course proposal,
    not yet its own story).
  - The per-ability config consolidation raised during this story's design
    discussion (`D-CC1`) — explicitly deferred, do not attempt it here. This
    story adds `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` as two more flat
    tables in the existing struct-of-arrays pattern, by the user's explicit
    choice.
  - Do not touch Lightning Arc, Tempest Hurl, Storm Eye, or Thunder Clap
    (Story 3.26's scope).

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — `packages/shared-types/ability-geometry.ts`
    is touched (new `AbilityHitShape` type + 2 new tables). Protocol Architect
    review required. ADR-0005 already covers this addition (extending
    ADR-0003) — confirm it's referenced, do not write a new ADR. This is an
    additive-only change (2 new tables, no existing shape changed) —
    compatibility note: no existing message/table shape altered.
  - Simulation-safety hook: TRIGGERED — `apps/simulation-server/GameRoom.ts`
    and `packages/game-rules/combat.ts` both touched. Typecheck, unit tests,
    a deterministic-tick sanity check (this story adds no new randomness —
    confirm `isInConeZone` is pure/deterministic, no PRNG involved), and a
    perf sanity note (the shape-dispatch branch is an O(1) additional
    conditional per existing hit-test call — no new per-tick scan is added).
  - Ownership hook: 2 areas (shared-types, game-rules+simulation-server) —
    flag to user if narrower split preferred; matches every 3.16-3.20
    kit-rework story's own precedent of proceeding as Multi-context.

Required tests:
  - tests/unit/combat.test.ts — new `isInConeZone` describe block: inside
    the cone (both near-apex and near-max-length), outside by distance,
    outside by angle, exactly at the angle boundary, exactly at max length,
    target at caster's own position (distance = 0).
  - tests/unit/combat.test.ts or a dedicated block — each of the 4 converted
    abilities' real `ABILITY_CONE_ANGLE_DEG`/`ABILITY_HIT_RANGE_PX` values
    (Stone Wall 50°, Avalanche 40°, Ancestor's Voice 70°, Crimson Lash 45°)
    exercised through `isInConeZone` directly (pure-function test, no live
    `GameRoom`/planck world needed — matches this codebase's established
    preference, see 3.20's Dev Notes).
  - tests/unit/abilities.test.ts — regression-run only; this file tests
    `dispatchAbility`'s pure damage/cooldown/self-cost math, which has zero
    knowledge of hit shape (`dispatchAbility` never calls `isInHitZone` or
    `isInConeZone`) — should need no edits, confirm with a clean run rather
    than assuming.

Telemetry impact: None — no new user-facing flow, only a hit-test shape
  correction for existing abilities.
```

---

## Story

As a player,
I want Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash to hit a true cone in front of me instead of a circle offset along my aim,
so that these abilities match their long-documented "Cone/Line" spec instead of silently behaving as a circle, and reward aiming at a spread of enemies the way a cone reads visually.

---

## Acceptance Criteria

**AC1 — `AbilityHitShape` contract:**
**Given** a new `AbilityHitShape` contract (`packages/shared-types/src/ability-geometry.ts`)
**When** an ability's `ABILITY_HIT_SHAPE` entry is `'cone'`
**Then** its hit-test uses a new pure `isInConeZone` function (`packages/game-rules/src/systems/combat.ts`) — apex at the caster, aimed along the cast direction, length = the ability's existing `ABILITY_HIT_RANGE_PX` entry (reused, not duplicated), half-angle = half of a new `ABILITY_CONE_ANGLE_DEG` entry — instead of `isInHitZone`'s circle-vs-circle test

**AC2 — Stone Wall / Avalanche:**
**Given** Stone Wall (stonehide[0], 50°) and Avalanche (stonehide[3], 40°)
**When** either fires
**Then** it hits every enemy in its cone instead of its old offset circle; Stone Wall's pull-toward-caster displacement is unaffected

**AC3 — Ancestor's Voice:**
**Given** Ancestor's Voice (spiritcaller[0], 70°)
**When** it fires
**Then** its mixed-faction split (allies healed / enemies damaged, `resolveMixedFactionTargets`) resolves over a cone instead of a circle — `gatherPlayersInHitZone` gains an optional cone mode so this is the only caller needing it (Warding Cry's proximity-radius call is unaffected)

**AC4 — Crimson Lash:**
**Given** Crimson Lash (souldrinker[1], 45°)
**When** it fires
**Then** its HP-scaled damage (`ABILITY_HP_SCALED_DAMAGE`, unchanged) applies over a cone instead of a circle

**AC5 — Tests:**
**Given** `tests/unit/abilities.test.ts` and a new cone-geometry unit test
**When** the reworked kit and `isInConeZone` are exercised
**Then** cone-boundary edge cases (exactly at the angle edge, exactly at max length, caster's own position) and each ability's cone conversion are covered

**AC6 — Contract-change hook:**
**Given** the Contract-change hook (`packages/shared-types` is touched)
**Then** this story requires Protocol Architect review, ADR-0005, and the above contract test before merge

**Non-goals:** VFX for the new cone shape — Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash's VFX still draw their old circle/fan visuals until a follow-up Epic 7 VFX story adds a cone/wedge primitive to `primitives.ts` (tracked as new deferred work, not blocking this story). The per-ability config consolidation raised during this story's design discussion (`D-CC1`, `deferred-work.md`) is explicitly deferred — this story adds `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` as two more flat tables in the existing pattern.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `packages/shared-types/src/ability-geometry.ts`:
  add `export type AbilityHitShape = 'circle' | 'cone';`, then
  `ABILITY_HIT_SHAPE: Record<PlayerClass, readonly [AbilityHitShape, AbilityHitShape, AbilityHitShape, AbilityHitShape]>` and
  `ABILITY_CONE_ANGLE_DEG: Record<PlayerClass, readonly [number, number, number, number]>`,
  mirroring `ABILITY_DELIVERY`'s exact table shape/doc-comment style. Values:
  - `stonehide: ['cone', 'circle', 'circle', 'cone']` / cone angles `[50, 0, 0, 40]`
  - `spiritcaller: ['cone', 'circle', 'circle', 'circle']` / `[70, 0, 0, 0]`
  - `souldrinker: ['circle', 'cone', 'circle', 'circle']` / `[0, 45, 0, 0]`
  - `stormcaller: ['circle', 'circle', 'circle', 'circle']` / `[0, 0, 0, 0]` (untouched — 3.26's scope)
  - `packages/game-rules/src/balance.ts`: re-export both (+ the `AbilityHitShape` type) from `shared-types`, same block as the existing `ABILITY_HIT_RANGE_PX`/`ABILITY_DELIVERY` re-exports.
  - `packages/game-rules/src/index.ts`: export both new symbols + the type.

- [x] **Task 2** (AC: #1) — `packages/game-rules/src/systems/combat.ts`: add
  ```ts
  export function isInConeZone(
    casterX: number, casterY: number,
    dirX: number, dirY: number,       // must already be unit length
    targetX: number, targetY: number,
    rangePx: number,
    coneAngleDeg: number,
  ): boolean
  ```
  Apex at `(casterX, casterY)`; reject if distance to target > `rangePx`
  (`<=`, matching `isInHitZone`'s own boundary inclusivity); if distance is
  exactly 0, return `true` (apex edge case, AC5); otherwise compute the angle
  between the target direction and `(dirX, dirY)` via the dot product /
  distance, and accept if it's `<=` half of `coneAngleDeg` (in radians) —
  `<=`, not `<`, so a target exactly on the boundary counts as hit (AC5).
  Keep `isInHitZone` completely unchanged — every circle ability (TAP/self/
  proximity/zone) still uses it.

- [x] **Task 3a** (AC: #2, #4) — `GameRoom.ts`'s generic hit-scan loop
  (`:2327-2400`, covers Stone Wall/Avalanche/Crimson Lash): at both the
  per-enemy hit-test (`:2330`) and the boss hit-test (`:2389-2392`), branch
  on `ABILITY_HIT_SHAPE[player.class][abilityIndex]` — `'cone'` calls
  `isInConeZone(casterX, casterY, normDirX, normDirY, targetX, targetY,
  hitRange, ABILITY_CONE_ANGLE_DEG[player.class][abilityIndex])`, `'circle'`
  keeps calling `isInHitZone(...)` exactly as today. Stone Wall's
  displacement call (`:2353-2356`) is unchanged — it only runs after a hit
  is already confirmed, regardless of which shape confirmed it.

- [x] **Task 3b** (AC: #3) — `gatherPlayersInHitZone` (`:1144`): add an
  optional cone-mode parameter (default circle, so Warding Cry's
  (`:2203`), Soul Mend's (`:1275`), and Spirit Nova's (`:2421`) existing
  calls need zero edits). Ancestor's Voice's branch (`:2251-2325`): branch
  the enemy gather (`:2255-2256`), the ally gather (`:2257`, via the new
  cone mode), and the boss check (`:2302-2305`) on
  `ABILITY_HIT_SHAPE[SPIRITCALLER][0]` the same way as Task 3a.
  `resolveMixedFactionTargets`'s own logic is untouched — it only splits an
  already-gathered target list, unaware of shape.

- [x] **Task 4** (AC: #5) — `tests/unit/combat.test.ts`: new `isInConeZone`
  describe block mirroring the existing `isInHitZone` block's style —
  inside (near-apex, near-max-length), outside-by-distance,
  outside-by-angle, exactly-at-angle-boundary, exactly-at-max-length,
  target-at-caster-position. Add a small parameterized check (or 4 discrete
  cases) exercising each converted ability's real
  `ABILITY_CONE_ANGLE_DEG`/`ABILITY_HIT_RANGE_PX` values directly through
  `isInConeZone` — no live `GameRoom` needed.
- [x] Run `tests/unit/abilities.test.ts` — confirm it passes unmodified
  (it tests `dispatchAbility`, which has no hit-shape knowledge); only touch
  it if a genuinely stale hardcoded expectation surfaces (same caveat 3.20
  hit with `ABILITY_DELIVERY` — see that story's Debug Log References).
- [x] `npm run typecheck` (all project references) + `npx vitest run` (full
  suite) — 0 errors, no regressions.

---

## Dev Notes

### `ABILITY_HIT_RADIUS_PX` entries for the 4 converted abilities become inert — leave them

Radius has no meaning for a cone. Per ADR-0005's "addition, not
restructuring" discipline, do not delete or repurpose
`ABILITY_HIT_RADIUS_PX.stonehide[0]/[3]`, `.spiritcaller[0]`, or
`.souldrinker[1]` — they stay in the table for width symmetry, simply
unread by the cone path. This mirrors ADR-0003's own "relocation, not a
re-tune" precedent, applied here to "addition, not restructuring."

### The generic hit-scan loop and Ancestor's Voice's branch are the *only* two dispatch points that need editing

Every other ability with a spatial hit-test (Tremor Stomp's `enemies-in-zone`
status application, Warding Cry's `allies-in-zone`, Spirit Nova's expanding
sweep, Soul Mend's channel gather, Dark Pact's single-target drain) is
untouched — none of them are in `ABILITY_HIT_SHAPE`'s cone list, so their
existing `isInHitZone`/`gatherPlayersInHitZone` calls need zero changes
(the cone-mode parameter added in Task 3b defaults to circle for exactly
this reason).

### Package Responsibility Boundaries (project-context.md)

`packages/shared-types` — types/enums/constants, no runtime logic:
`AbilityHitShape`/`ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` are pure data,
consistent with this rule. `packages/game-rules` — pure functions only, no
I/O, no Colyseus, no planck.js imports: `isInConeZone` must stay a pure
function of its numeric arguments only, exactly like its `isInHitZone`
sibling.

### Project Context Rules

- **Configuration Hierarchy**: `ABILITY_CONE_ANGLE_DEG` is tunable gameplay
  data — it belongs in the `shared-types`/`game-rules` tier, not hard-coded
  inline at any `GameRoom.ts` call site.
- **Naming Conventions**: `SCREAMING_SNAKE_CASE` for the new table constants
  (already followed by every sibling table in `ability-geometry.ts`).
- **TypeScript strict mode**: no `any` — `ABILITY_HIT_SHAPE`'s value type is
  the new `AbilityHitShape` union, not `string`.
- **Result<T,E> / no throw**: `isInConeZone` returns a plain `boolean` (same
  as `isInHitZone`) — not a `Result`, since it's a predicate, not a
  fallible operation. Consistent with the existing sibling's signature.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.25]
- [Source: docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md]
- [Source: packages/shared-types/src/ability-geometry.ts] — `ABILITY_DELIVERY`'s table/re-export pattern, mirrored exactly by this story's 2 new tables
- [Source: packages/game-rules/src/systems/combat.ts:42] — `isInHitZone`, `isInConeZone`'s sibling
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1144] — `gatherPlayersInHitZone`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:2251-2325] — Ancestor's Voice mixed-faction branch
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:2327-2400] — generic hit-scan loop + boss check
- [Source: tests/unit/combat.test.ts] — existing `isInHitZone` describe block, mirror its style
- [Source: _bmad-output/implementation-artifacts/3-16-stonehide-kit-rework.md] — Stone Wall/Avalanche's original (now-superseded-in-shape) acceptance criteria
- [Source: _bmad-output/implementation-artifacts/3-17-spiritcaller-kit-rework-ancestors-voice-spirit-nova-warding-cry.md] — Ancestor's Voice's original acceptance criteria, `gatherPlayersInHitZone`'s introduction
- [Source: _bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md] — Crimson Lash's original acceptance criteria, HP-scaled damage math (unchanged)
- [Source: _bmad-output/implementation-artifacts/3-20-stormcaller-storm-eye-rework.md] — most recent kit-rework story; header/task-list format and Multi-context ownership precedent mirrored by this story

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Empirically verified `isInConeZone`'s floating-point boundary behavior with
  standalone `node -e` scripts before writing the exactly-at-boundary test
  cases (angle boundary, max-length boundary, and each ability's real
  angle/range values) — trig-constructed boundary points can land on either
  side of a `>=`/`>` comparison by ~1 ULP depending on construction order, so
  every boundary assertion in `tests/unit/combat.test.ts` was confirmed to
  produce a stable `true`/`false` under the actual implementation before being
  committed to the test file, rather than derived analytically. One
  compounded-error case was caught this way: constructing a point that is
  simultaneously exactly at max-length AND exactly at the angle boundary
  (Stone Wall, 160px/25°) intermittently fails the distance check due to
  compounded rounding from two chained trig calls — the per-ability test
  cases below therefore test the angle boundary and the distance boundary
  separately, never combined at the same point, to avoid a flaky assertion.
- `npm run typecheck` initially failed with 2 errors: `ABILITY_HIT_SHAPE[player.class][abilityIndex]`
  and the Ancestor's Voice equivalent resolve to `AbilityHitShape | undefined`
  under `noUncheckedIndexedAccess` (generic `number` index into a fixed
  4-tuple). Fixed with `?? 'circle'` / `?? 0` fallbacks at the two declaration
  sites (`GameRoom.ts:2359-2360`), mirroring the existing `?? 0`/`?? 60`
  pattern already used for `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`
  lookups elsewhere in the same file. Re-ran clean on the second pass.

### Completion Notes List

- Task 1: Added `AbilityHitShape` (`'circle' | 'cone'`), `ABILITY_HIT_SHAPE`,
  and `ABILITY_CONE_ANGLE_DEG` to `packages/shared-types/src/ability-geometry.ts`,
  mirroring `ABILITY_DELIVERY`'s exact table/doc-comment pattern. Values match
  the story's Task 1 spec exactly (stonehide `['cone','circle','circle','cone']`
  / `[50,0,0,40]`; spiritcaller `['cone','circle','circle','circle']` /
  `[70,0,0,0]`; souldrinker `['circle','cone','circle','circle']` /
  `[0,45,0,0]`; stormcaller all-circle/all-zero, untouched per Blocked paths).
  Re-exported from `packages/game-rules/src/balance.ts` and
  `packages/game-rules/src/index.ts` (+ the `AbilityHitShape` type), same
  block as the existing `ABILITY_HIT_RANGE_PX`/`ABILITY_DELIVERY` re-exports.
- Task 2: Added `isInConeZone` as a sibling function to `isInHitZone` in
  `packages/game-rules/src/systems/combat.ts`. Distance check is `<=` (via
  `dist > rangePx → false`, matching `isInHitZone`'s own boundary
  inclusivity). `dist === 0` returns `true` immediately (apex edge case —
  AC5). Angle test avoids `Math.acos` precision issues by comparing
  `dot >= cosHalfAngle` directly (cosine is monotonically decreasing on
  `[0°, 180°]`, so this is equivalent to `angle <= halfAngle` and inherits
  the same `<=` inclusivity). Pure function, no I/O, no PRNG — deterministic
  per the Simulation-safety hook's requirement. `isInHitZone` itself was not
  touched. Exported alongside `isInHitZone` from `packages/game-rules/src/index.ts`.
- Task 3a: `GameRoom.ts`'s generic hit-scan loop (Stone Wall/Avalanche/Crimson
  Lash) and its boss check now branch on `ABILITY_HIT_SHAPE[player.class][abilityIndex]`
  via a new private `isInAbilityHitZone` helper (`'cone'` → `isInConeZone`,
  `'circle'` → `isInHitZone`, unchanged). Added the helper (rather than
  inlining the branch 5 times across Tasks 3a/3b) since it's called from both
  the generic loop's 2 dispatch points and Ancestor's Voice's 3 — a single
  branch point is less error-prone than 5 duplicated `if (shape === 'cone')`
  blocks. Stone Wall's pull-toward-caster `applyDisplacement` call is
  unchanged — it only runs after a hit is already confirmed, per the story's
  explicit instruction not to touch it.
- Task 3b: `gatherPlayersInHitZone` gained an optional `coneAngleDeg?: number`
  parameter (default `undefined` → circle mode, its exact prior behavior) so
  its 3 existing call sites (Dark Pact `:1275` — the story's Dev Notes named
  this "Soul Mend's channel gather" but the code at that line is actually
  Dark Pact's single-target-ally query; Warding Cry `:2203`; Spirit Nova
  `:2421`) need zero edits. Ancestor's Voice's branch now computes
  `voiceShape`/`voiceConeAngleDeg` once and threads them through the enemy
  gather (via `isInAbilityHitZone`), the ally gather (via
  `gatherPlayersInHitZone`'s new cone-mode parameter, passed only when
  `voiceShape === 'cone'`), and the boss check (via `isInAbilityHitZone`).
  `resolveMixedFactionTargets` itself is untouched, per the story.
- Task 4: Added an `isInConeZone` describe block to `tests/unit/combat.test.ts`
  mirroring the existing `isInHitZone` block's style (inside near-apex,
  inside near-max-length, outside-by-distance, outside-by-angle, exactly-at-
  angle-boundary, exactly-at-max-length, target-at-caster's-own-position) plus
  a second describe block exercising each of the 4 converted abilities' real
  `ABILITY_CONE_ANGLE_DEG`/`ABILITY_HIT_RANGE_PX` values (Stone Wall 50°/160px,
  Avalanche 40°/75px, Ancestor's Voice 70°/100px, Crimson Lash 45°/180px)
  directly through `isInConeZone`. `tests/unit/abilities.test.ts` required no
  edits — confirmed with a clean run (it tests `dispatchAbility`'s pure
  damage/cooldown math, which never calls `isInHitZone`/`isInConeZone`).
  `npm run typecheck`: 0 errors (after the fix logged above). `npx vitest run`
  (full suite): 594 passed, 1 pre-existing failure
  (`apps/host-client/src/vfx/ability-vfx.test.ts`, "centres Stone Wall,
  Tremor Stomp and Iron Skin on the caster") — unrelated to this story (no
  file in that test's path was touched by this story; VFX for the new cone
  shape is an explicit non-goal — old circle/fan visuals stay until a
  follow-up Epic 7 VFX story), pre-dates this story per prior-session memory,
  not a regression introduced here.

**Contract-change hook (triggered — `packages/shared-types/src/ability-geometry.ts` touched):**
Per `CLAUDE.md`'s Contract-change hook checklist:
- Protocol Architect review required.
- Compatibility checklist: additive-only change — 2 new tables
  (`ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`) and 1 new type
  (`AbilityHitShape`) added to `packages/shared-types/src/ability-geometry.ts`;
  no existing table, type, or exported symbol's shape was altered or removed.
  `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX` are unchanged (cone abilities
  reuse the existing range entry; radius entries become inert but are left in
  place per ADR-0005).
- Spec/ADR update: `docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md`
  already covers this addition (extending ADR-0003) — no new ADR authored,
  per the story's explicit instruction to read, not write, it.
- Contract test: `tests/unit/combat.test.ts`'s new `isInConeZone` describe
  blocks exercise the new contract (AC5).

**Simulation-safety hook (triggered — `apps/simulation-server/src/rooms/GameRoom.ts`
and `packages/game-rules/src/systems/combat.ts` both touched):**
- Typecheck: 0 errors (`npm run typecheck`, all project references).
- Unit tests: full suite green apart from the 1 pre-existing unrelated
  failure noted above.
- Deterministic-tick sanity: `isInConeZone` is a pure function of its numeric
  arguments only — no `Math.random()`, no PRNG, no I/O, no Colyseus/planck
  imports — confirmed by inspection of `packages/game-rules/src/systems/combat.ts`.
- Perf sanity: the shape dispatch (`isInAbilityHitZone`) adds one `if (shape
  === 'cone')` branch per existing `isInHitZone`/`isInConeZone` call — O(1)
  per call, no new per-tick scan, no new allocation in the hot path.

Confidence: 92% — all 4 tasks map directly to concrete, verified code changes;
every boundary-case test assertion was empirically verified against the real
implementation (not derived analytically) before being written; the only
open question is whether Protocol Architect review (required by the
Contract-change hook, not something this dev-story workflow can self-certify)
surfaces any objection to the additive table shapes chosen.

### File List

- `packages/shared-types/src/ability-geometry.ts` — added `AbilityHitShape`,
  `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`
- `packages/game-rules/src/balance.ts` — re-exported the 2 new tables + type
- `packages/game-rules/src/index.ts` — re-exported the 2 new tables + type +
  `isInConeZone`
- `packages/game-rules/src/systems/combat.ts` — added `isInConeZone`
- `apps/simulation-server/src/rooms/GameRoom.ts` — added `isInAbilityHitZone`
  helper; added optional cone-mode parameter to `gatherPlayersInHitZone`;
  rewired the generic hit-scan loop (enemy + boss) and Ancestor's Voice's
  branch (enemy gather, ally gather, boss check) to branch on
  `ABILITY_HIT_SHAPE`
- `tests/unit/combat.test.ts` — added `isInConeZone` describe blocks (edge
  cases + real per-ability values)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — this story's own
  edits: 3-25's status `backlog` → `in-progress` → `review`, `epic-3: done` →
  `in-progress`, `last_updated` bumped (this session's Step 4/Step 9). The
  working-tree diff also carries a pre-existing, uncommitted 3-26
  `backlog` → `ready-for-dev` transition and a story-creation rationale
  comment block from an earlier create-story session — see `D-3.25-A` in
  `deferred-work.md`, not part of this story's own changes.

### Review Findings

- [x] [Review][Patch] Dev Agent Record's File List entry for `sprint-status.yaml` misstates the actual diff — claims `ready-for-dev → in-progress` but the diff shows the 3-25 status line transitioning `backlog → review` (plus `epic-3: done → in-progress`). [`_bmad-output/implementation-artifacts/sprint-status.yaml`]
- [x] [Review][Patch] `isInConeZone` test coverage in `tests/unit/combat.test.ts` only exercises `dir=(1,0)` (aim along the x-axis); no case covers a non-axis-aligned aim direction or a target directly behind the caster, so a sign/axis-swap bug in the `dy`/`dirY` dot-product term would go undetected. [`tests/unit/combat.test.ts`]
- [x] [Review][Defer] `sprint-status.yaml`'s working-tree diff bundles this story's own status update together with pre-existing uncommitted changes from an earlier create-story session (Story 3-26 `backlog → ready-for-dev`, `epic-3: done → in-progress`, and a large rationale comment block) — confirmed via the session's initial `git status` that these predate this dev-story run. Not a code defect; a commit-hygiene note for whoever runs `/commit` next (consider splitting into separate commits, or committing as one intentional batch). [`_bmad-output/implementation-artifacts/sprint-status.yaml`] — deferred, pre-existing

**Confirmation-pass notes (findings dismissed after re-reading the actual diff/code, not taken at face value):**
- `isInConeZone`'s "dirX/dirY must already be unit length" precondition is documented but unenforced — matches `isInHitZone`'s own identical, already-shipped precondition exactly (re-read `combat.ts`'s pre-existing `isInHitZone`); not a new risk this story introduces. Dismissed.
- `isInAbilityHitZone`'s `'cone'` branch never consults its `isDirectional` parameter — confirmed real by re-reading `combat.ts`/`GameRoom.ts`, but re-reading `packages/shared-types/src/class-definitions.ts` confirms all 4 converted abilities (Stone Wall=RELEASE, Avalanche=AUTO, Ancestor's Voice=AUTO, Crimson Lash=RELEASE) are directional inputTypes — not currently triggerable, and a "TAP cone" is a contradiction in terms the config already prevents. Dismissed per CLAUDE.md's "don't validate for scenarios that can't happen."
- `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` values are unvalidated at runtime (no guard against a negative or >360° angle) — matches this codebase's existing pattern of zero runtime validation on every other hand-authored balance table (`ABILITY_HIT_RADIUS_PX`, `ABILITY_DAMAGE`, etc.); these are internal config-tier constants, not user input. Dismissed per the same rule.
- `gatherPlayersInHitZone`'s `coneAngleDeg !== undefined` implicit dispatch (vs. `isInAbilityHitZone`'s explicit `AbilityHitShape` enum dispatch) is exactly the "optional cone-mode parameter (default circle)" shape Task 3b's own spec text calls for — spec-compliant by design, not an inconsistency. Dismissed.

**Review summary:** 0 decision_needed, 2 patch, 1 defer, 16 dismissed as noise (after merging duplicate findings across the 3 review layers: Blind Hunter raised 14 points, Edge Case Hunter raised 3, Acceptance Auditor raised 2).

## Change Log

- 2026-07-28: Implemented Story 3.25 — `AbilityHitShape` contract
  (`ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `isInConeZone`) and rewired
  Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash to hit a true
  cone instead of a circle offset along aim. All 4 tasks complete, all ACs
  satisfied, full regression suite green apart from 1 pre-existing unrelated
  VFX test failure. Status → review.

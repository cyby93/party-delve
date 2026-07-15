---
baseline_commit: f6083d8
---

# Story 3.11: Ability Input Taxonomy Expansion & Type Corrections

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework, first of 5 shared-engine-capability stories 3.11-3.15; kit-rework
  stories 3.16-3.20 depend on this one landing first)

Context: Epic 3 (done, all 10 stories 3.1-3.10 closed) is being extended per
  the 2026-07-08 brainstorming session
  (_bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md).
  Of the 16 class abilities in packages/shared-types/src/class-definitions.ts,
  7 are damage=0 no-op placeholders and the session designed real mechanics
  for all of them. Story 3.11 is purely a taxonomy + type-correction story —
  it adds zero new gameplay behavior. It exists so that every ability's
  server-side `inputType` matches its final designed activation feel BEFORE
  Stories 3.12-3.20 build real mechanics on top of it. Stories 3.16-3.20 (kit
  reworks) explicitly reference "Story 3.11's correction" for Tremor Stomp,
  Stone Wall, Dark Pact, Void Pulse, and Storm Eye — those stories assume this
  one has already landed.

  CORRECTION TO epics.md: Story 3.11's AC1 in epics.md says
  `packages/shared-types/src/input.ts defines AbilityInputType` — this is
  WRONG. `AbilityInputType` is actually defined in
  `packages/shared-types/src/class-definitions.ts:3`. `input.ts` only
  contains `JoystickInput`/`AbilityInput`/`InputEvent` (the wire input-event
  shapes, unrelated to the per-ability activation-type taxonomy). Edit
  `class-definitions.ts`, NOT `input.ts`.

  Current codebase state (verified by reading the files directly, not
  epics.md's description of them):
  - `packages/shared-types/src/class-definitions.ts:3` —
    `export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP';`
  - `packages/game-rules/src/systems/abilities.ts:45-47` — `dispatchAbility`
    already computes `const dirX = inputType === 'TAP' ? 0 : ctx.directionX`
    (and same for dirY). This is an inclusive-else, not an exhaustive switch —
    adding `'AIM_CAST'` to the union requires ZERO code changes here. AC3 is
    already true today; the task is to add a regression test that locks it in,
    not to change the function.
  - `apps/simulation-server/src/rooms/GameRoom.ts:1355` —
    `const isDirectional = abilityDef.inputType !== 'TAP';` — same pattern,
    already generalizes correctly to `AIM_CAST`. No change needed.
  - `apps/mobile-controller/src/screens/ControllerScreen.tsx:211-215` —
    `const ABILITY_BADGE_BORDER: Record<AbilityInputType, string> = { AUTO:
    ..., RELEASE: ..., TAP: ... }`. This IS an exhaustive `Record` type.
    Adding `'AIM_CAST'` to the union WITHOUT adding a key here is a
    monorepo-wide TypeScript compile break (`npm run typecheck` fails on this
    file). This must be fixed in the same story or the build is red.
  - `apps/mobile-controller/src/screens/ControllerScreen.tsx:679,698` — the
    touch `onTouchEnd`/`onDocumentTouchEnd` handlers only fire the ability if
    `ability.inputType === 'RELEASE'`. Soul Mend moves from `RELEASE` to
    `AIM_CAST` in this story (AC2). Without a matching change here, Soul Mend
    becomes silently un-castable on mobile (touch starts tracking at
    `onTouchStart` since it's not `'TAP'`, but `onTouchEnd` never fires
    because the check is `=== 'RELEASE'` exactly) — a real regression, not a
    cosmetic gap. Story 3.18 (not yet built) is where `AIM_CAST`'s real
    hold-to-channel-with-cancel UX gets implemented (see its AC: "caster
    releases input early... channel is cancelled"). Until 3.18 lands,
    `AIM_CAST` needs a minimal bridge: fire on release exactly like `RELEASE`
    does today. This preserves current behavior (ability fires on touch-up)
    without building any of 3.18's channel/cancel/interrupt logic.
  - `tests/unit/abilities.test.ts` (top-level `tests/unit/`, NOT
    `packages/game-rules/tests/` — this repo keeps `dispatchAbility` tests at
    the monorepo root per the existing file) hardcodes ability-slot
    assumptions in its test names and assertions: "Stonehide slot 0 = Stone
    Wall (TAP)" and "Stonehide slot 1 = Tremor Stomp (RELEASE)". AC2's
    corrections swap exactly these two (Stone Wall TAP→RELEASE, Tremor Stomp
    RELEASE→TAP), so both of these existing tests assert the OPPOSITE of the
    post-correction behavior and MUST be rewritten, not left in place. This
    is not a hypothetical risk — the current test suite will go red for the
    right reason (correctness) unless it's part of this story's diff.

Owner agent: Multi-context (explicit cross-context approval per CLAUDE.md
  Ownership Rules — task needs 3 ownership areas but each fix is 1-5 lines;
  precedent for bundling small cross-context corrections into one story is
  established by 1.8, 1.9, 2.6, 2.7, 3.9, 3.10, 4.9, 5.7 in this repo):
  Protocol Architect (Task 1 — packages/shared-types/**)
  Simulation Engineer (Task 2 — regression test only, no production code change)
  Mobile Controller Engineer (Task 3 — apps/mobile-controller/**, required to
    keep the build green and Soul Mend castable; NOT a scope expansion into
    3.18's channel/cancel UX)

Goal:
  Task 1 — Add `'AIM_CAST'` to `AbilityInputType` in class-definitions.ts and
            apply the 6 documented inputType corrections to `CLASS_DEFINITIONS`.
  Task 2 — Rewrite tests/unit/abilities.test.ts as a table-driven test
            asserting all 16 corrected inputTypes AND dispatchAbility's
            direction-zeroing behavior for all 4 input types (TAP zeroes,
            AUTO/RELEASE/AIM_CAST pass through). No production code change in
            packages/game-rules — the existing ternary already satisfies AC3.
  Task 3 — Fix the compile-breaking `ABILITY_BADGE_BORDER` Record in
            ControllerScreen.tsx (add an `AIM_CAST` key) and extend the
            touchend fire condition so `AIM_CAST` fires-on-release identically
            to `RELEASE` (temporary bridge; superseded by Story 3.18's real
            channel/cancel implementation).

Allowed paths:
  - packages/shared-types/src/class-definitions.ts        (Task 1)
  - tests/unit/abilities.test.ts                            (Task 2)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (Task 3)

Blocked paths:
  - packages/shared-types/src/input.ts (epics.md's AC1 wording is wrong about
    this file — do not touch it; see Context above)
  - packages/game-rules/src/systems/abilities.ts (no change needed — verify
    via test only, do not "fix" what isn't broken)
  - apps/simulation-server/** (GameRoom.ts's `isDirectional` check already
    generalizes correctly — do not touch)
  - apps/host-client/**
  - packages/net-protocol/** (no wire-shape change; AbilityInputType never
    crosses the WebSocket boundary as its own field — it only drives
    server-side dispatch and client-side touch-input UX)
  - packages/game-rules/src/balance.ts (no balance/damage/cooldown changes —
    that's stories 3.12+ and the 3.16-3.20 kit reworks)
  - Any file implementing real channel/cast/cancel logic for AIM_CAST — that
    is Story 3.18's scope, not this one's

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.11: Ability Input
    Taxonomy Expansion & Type Corrections" section (the AC source — note the
    input.ts file-path error documented above)
  - _bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md —
    full session; the "Final Ability Spec Sheet" tables are the source of
    truth for all 16 abilities' final inputType
  - packages/shared-types/src/class-definitions.ts (read fully — current
    inputType values for all 16 abilities)
  - packages/game-rules/src/systems/abilities.ts (read fully — confirm
    dispatchAbility's existing ternary already satisfies AC3 before touching
    anything)
  - apps/simulation-server/src/rooms/GameRoom.ts:1340-1373 (read — confirm
    `isDirectional` already generalizes; do not edit)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (read fully,
    especially lines 211-215, 600-732, 1287-1304 — the ability-badge color
    map, the touch-input useEffect, and the spirit-cell override)
  - tests/unit/abilities.test.ts (read fully — every existing test, to know
    exactly which ones assert now-incorrect slot behavior)

Non-goals:
  - Do not implement Soul Mend's actual remote-revive mechanic, channel timer,
    `channelingAbility` state, or `cast:started`/`cast:cancelled` events —
    all of that is Story 3.18.
  - Do not implement the status-effect engine, projectile physics, zone/field
    entities, displacement/pull, or self-cost mechanics — Stories 3.12-3.15.
  - Do not touch any of the 7 placeholder abilities' damage/effect values in
    balance.ts — this story only corrects `inputType`, nothing else.
  - Do not rename `AUTO`/`RELEASE`/`TAP` — epics.md AC1 explicitly says keep
    them as-is to avoid unnecessary churn.
  - Do not "fix" the badgeBorderColor ternary at ControllerScreen.tsx:1300-1304
    (the second, non-Record color lookup for the spirit-cell override path) —
    it already falls through safely to the TAP border color for any
    unrecognized inputType (including the new AIM_CAST), so it doesn't
    compile-break and isn't a functional regression, only a cosmetic nit.
    Leave it; a follow-up story can extend it if the color mismatch is ever
    reported as a UX issue.

Acceptance criteria:
  1. `AbilityInputType` in class-definitions.ts becomes
     `'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST'`. No rename of existing values.
  2. Exactly 6 `CLASS_DEFINITIONS` corrections applied: Tremor Stomp
     RELEASE→TAP, Stone Wall TAP→RELEASE, Soul Mend RELEASE→AIM_CAST, Dark
     Pact TAP→RELEASE, Void Pulse TAP→RELEASE, Storm Eye AUTO→RELEASE.
     Avalanche and Ancestor's Voice stay AUTO — unchanged.
  3. `dispatchAbility` continues to zero direction only for TAP and pass
     direction through for AUTO/RELEASE/AIM_CAST — proven by a table-driven
     test covering all 16 abilities' corrected inputType and all 4 input
     types' direction behavior. No production code change required.
  4. `npm run typecheck` (full monorepo) passes with 0 errors — specifically
     confirming `ABILITY_BADGE_BORDER` in ControllerScreen.tsx has an
     `AIM_CAST` entry.
  5. Soul Mend remains castable (fires on touch release) on mobile after the
     inputType change — `onTouchEnd`/`onDocumentTouchEnd` fire for `AIM_CAST`
     the same way they do for `RELEASE`.
  6. Full Vitest suite passes with no regressions.

Required hooks:
  - Ownership hook: triggered (3 areas) — resolved via Multi-context header
    above per CLAUDE.md's "split unless there is a strong reason not to";
    reason: every individual fix is 1-5 lines and each is a mechanical
    consequence of the same one-line type-union change, not independent work.
  - Contract-change hook: nominally scoped-in since Task 1 touches
    `packages/shared-types/**`, but there is no wire message shape change —
    `AbilityInputType` never serializes onto the wire, it only drives local
    dispatch/UX logic on each surface independently. No new contract test
    required; state this explicitly in the Dev Agent Record.
  - Client-UX hook: triggered by Task 3 (mobile UI touched) — mobile checks:
    skill mapping (verify Soul Mend's 2×2 grid cell still fires) is the only
    applicable check; joystick mapping, reconnect UX, and sleep/background
    recovery are untouched by this story.
  - Simulation-safety hook: NOT triggered — no `apps/simulation-server/**` or
    `packages/game-rules/**` production file is modified (game-rules test file
    only).

Required tests:
  - tests/unit/abilities.test.ts rewritten as table-driven: all 16 abilities'
    `inputType` checked against the corrected spec; `dispatchAbility`
    direction-zeroing verified for all 4 `AbilityInputType` values.
  - No new contract or e2e tests required (no wire-shape change, no new
    server-broadcast behavior).

Telemetry impact: None — no new user-facing flow, no new event.
```

---

## Story

As a simulation engineer,
I want the `AbilityInputType` taxonomy extended to cover Aim+Cast alongside the existing three types, and the real input-type mismatches corrected,
so that every ability's server-side dispatch matches its actual intended activation feel before any ability rework begins.

---

## Acceptance Criteria

**AC1 — `AbilityInputType` gains `AIM_CAST`:**
**Given** `packages/shared-types/src/class-definitions.ts` defines `AbilityInputType`
**When** the type is extended
**Then** it becomes `'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST'`
**And** `AUTO`/`RELEASE`/`TAP` are kept unrenamed (they already map to Aim+Hold/Channel, Aim+Release, and Instant/Tap respectively)
**And** no other file defines or shadows `AbilityInputType` — it lives in `class-definitions.ts` only (NOT `input.ts`, despite what epics.md's wording implies)

**AC2 — 6 `CLASS_DEFINITIONS` corrections applied:**
**Given** `CLASS_DEFINITIONS` in `class-definitions.ts`
**When** cross-checked against the brainstorming session's Final Ability Spec Sheet
**Then** exactly these 6 corrections are applied:
  | Ability | Class | Before | After |
  |---|---|---|---|
  | Tremor Stomp | Stonehide (slot 1) | `RELEASE` | `TAP` |
  | Stone Wall | Stonehide (slot 0) | `TAP` | `RELEASE` |
  | Soul Mend | Spiritcaller (slot 2) | `RELEASE` | `AIM_CAST` |
  | Dark Pact | Souldrinker (slot 2) | `TAP` | `RELEASE` |
  | Void Pulse | Souldrinker (slot 3) | `TAP` | `RELEASE` |
  | Storm Eye | Stormcaller (slot 3) | `AUTO` | `RELEASE` |
**And** Avalanche (Stonehide slot 3, `AUTO`) and Ancestor's Voice (Spiritcaller slot 0, `AUTO`) are left unchanged
**And** all remaining 8 abilities' `inputType` are untouched

**AC3 — `dispatchAbility` direction handling verified, not changed:**
**Given** `packages/game-rules/src/systems/abilities.ts` `dispatchAbility`
**When** resolving `directionX`/`directionY`
**Then** only `TAP` abilities zero the direction; `AUTO`, `RELEASE`, and `AIM_CAST` all pass the caller-supplied direction through unchanged
**And** this is proven by a test, not a code change — the existing `inputType === 'TAP' ? 0 : ctx.directionX` ternary already satisfies this for any 4th union member
**And** `dispatchAbility` accepts an ability with `inputType: 'AIM_CAST'` without throwing or returning an error (it never branches on the literal set of input types, so this is automatic)

**AC4 — Table-driven unit test:**
**Given** `tests/unit/abilities.test.ts`
**When** the suite runs
**Then** a table-driven test asserts all 16 abilities' `inputType` in `CLASS_DEFINITIONS` matches the AC2 table (post-correction values)
**And** `dispatchAbility`'s direction-zeroing behavior is verified for representative abilities of all 4 input types (TAP zeroes both axes; AUTO/RELEASE/AIM_CAST preserve both axes)
**And** the two pre-existing tests whose names/assertions assume the pre-correction Stone Wall/Tremor Stomp slot behavior are rewritten to match post-correction reality, not left contradicting it

**AC5 — Mobile build stays green and Soul Mend stays castable (not in original epics.md text — added because AC1/AC2 break the mobile build and Soul Mend's touch input otherwise; see Context):**
**Given** `apps/mobile-controller/src/screens/ControllerScreen.tsx`
**When** `AIM_CAST` is added to the `AbilityInputType` union
**Then** `ABILITY_BADGE_BORDER` (a `Record<AbilityInputType, string>`) gains an `AIM_CAST` entry so `npm run typecheck` still passes
**And** the `onTouchEnd`/`onDocumentTouchEnd` handlers fire the ability for `AIM_CAST` the same way they already do for `RELEASE` (fire-on-release), so Soul Mend remains castable on mobile
**And** no channel/cancel/interrupt logic is added — that remains Story 3.18's scope

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2) — In `packages/shared-types/src/class-definitions.ts`:
  - [x] Change line 3 to `export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST';`
  - [x] In `CLASS_DEFINITIONS[PlayerClass.STONEHIDE].abilities`: Stone Wall → `'RELEASE'`, Tremor Stomp → `'TAP'`
  - [x] In `CLASS_DEFINITIONS[PlayerClass.SPIRITCALLER].abilities`: Soul Mend → `'AIM_CAST'`
  - [x] In `CLASS_DEFINITIONS[PlayerClass.SOULDRINKER].abilities`: Dark Pact → `'RELEASE'`, Void Pulse → `'RELEASE'`
  - [x] In `CLASS_DEFINITIONS[PlayerClass.STORMCALLER].abilities`: Storm Eye → `'RELEASE'`

- [x] **Task 2** (AC: #3, #4) — Rewrite `tests/unit/abilities.test.ts`:
  - [x] Add a table-driven test (e.g. `it.each` or a plain loop over a
        `{ class, index, name, inputType }[]` fixture built from the AC2
        table) asserting `CLASS_DEFINITIONS[cls].abilities[i].inputType`
        equals the expected corrected value for all 16 abilities
  - [x] Fix/replace the existing "TAP ability returns direction (0, 0)..."
        test (currently keyed to Stonehide slot 0 = Stone Wall) — Stone Wall
        is `RELEASE` now; use a still-TAP ability instead (e.g. Stonehide
        slot 2 = Iron Skin, or Stonehide slot 1 = Tremor Stomp post-correction)
  - [x] Fix/replace the existing "RELEASE ability preserves direction" test
        (currently keyed to Stonehide slot 1 = Tremor Stomp) — Tremor Stomp
        is `TAP` now; use a still-RELEASE ability instead (e.g. Stonehide
        slot 0 = Stone Wall post-correction, or Souldrinker slot 1 = Crimson
        Lash)
  - [x] Add one new test case verifying an `AIM_CAST` ability (Spiritcaller
        slot 2 = Soul Mend) preserves direction, mirroring the existing
        AUTO/RELEASE direction-preservation tests
  - [x] Leave the cooldown, out-of-range-index, and "every class has ≤3000ms
        ability" tests untouched — they don't depend on inputType values

- [x] **Task 3** (AC: #5) — In `apps/mobile-controller/src/screens/ControllerScreen.tsx`:
  - [x] Add `AIM_CAST: 'var(--accent-warm)',` (reuse RELEASE's color — AIM_CAST
        is a release-fired ability today, same as RELEASE, until 3.18) to the
        `ABILITY_BADGE_BORDER` Record at line ~211-215
  - [x] At line ~679 and line ~698, change
        `if (ability.inputType === 'RELEASE' && !t.releaseFired)` to
        `if ((ability.inputType === 'RELEASE' || ability.inputType === 'AIM_CAST') && !t.releaseFired)`
        in both `onTouchEnd` and `onDocumentTouchEnd`

- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors
- [x] Run `npx vitest run` (full suite) — confirm no regressions, especially
      `tests/unit/abilities.test.ts` and `tests/contract/net-protocol.test.ts`
      (sanity check — no wire-shape change expected there)
- [x] Manual grep: confirm no other `Record<AbilityInputType, ...>` or
      exhaustive switch/union match exists anywhere else in the repo that
      would need an `AIM_CAST` case (verified absent during story creation —
      re-verify at implementation time in case new code landed since)

### Review Findings

- [x] [Review][Patch] Stone Wall & Void Pulse whiff on a no-drag release after their TAP→RELEASE correction — `apps/simulation-server/src/rooms/GameRoom.ts:1366` gated the hit-scan with `if (isDirectional && mag === 0) continue;`. Stone Wall (Stonehide slot 0, `ABILITY_DAMAGE.stonehide[0]=15`) and Void Pulse (Souldrinker slot 3, `ABILITY_DAMAGE.souldrinker[3]=25`) both have `ABILITY_HIT_RANGE_PX` = 0, so their hit-circle position never actually depended on direction — but now that AC2 makes them `RELEASE` (`isDirectional=true`), a clean tap-release with no drag (`dirX=dirY=0`) was skipping the hit-scan entirely, where before (`TAP`) it always hit. **Resolved per explicit user decision** (cross-context approval to touch this Blocked path for a minimal, mechanical guard): changed the guard to `if (isDirectional && mag === 0 && hitRange > 0) continue;` so only abilities whose hit circle actually depends on direction require a nonzero drag. `packages/game-rules/balance.ts` values untouched.
- [x] [Review][Defer] Tremor Stomp's RELEASE→TAP correction collapses its effective reach — `packages/game-rules/src/systems/combat.ts:49-58` (`isInHitZone`) ignores `hitRangePx` entirely when `isDirectional` is false, so Tremor Stomp's (Stonehide slot 1) previously-directional 160px-offset AoE (`ABILITY_HIT_RANGE_PX.stonehide[1]=160`) collapses to a point-blank radius-60 hit centered on the player; the 160 value becomes dead/orphaned config. **Deferred per explicit user decision**: the point-blank tap-AoE reach is plausible by design intent (a stomp, not a ranged strike); no code change made. Story 3.16 (Stonehide kit rework) owns re-tuning `ABILITY_HIT_RANGE_PX.stonehide[1]` if the real mechanic needs more reach.
- [x] [Review][Patch] Live in-game skill-grid HUD showed the wrong border color for Soul Mend (AIM_CAST) — `apps/mobile-controller/src/screens/ControllerScreen.tsx:1301-1305`. This story's own Dev Notes/Non-goals claimed this `badgeBorderColor` ternary is "used only for the spirit-cell override rendering path" and safe to leave unfixed — that claim was factually wrong: it's computed for all 4 cells in the live `[0,1,2,3].map(...)` skill grid (the actual in-dungeon HUD) and passed to every `SkillCell`, distinct from `ABILITY_BADGE_BORDER` (only used by `AbilityChip` on the class-selection screen, line 233). **Resolved**: added an `AIM_CAST` case to the ternary, matching `ABILITY_BADGE_BORDER`'s warm-accent color.
- [x] [Review][Dismiss] 6 findings dismissed as noise/expected-per-spec: tautological table-driven test (AC4 explicitly asked for a spec-comparison test — that's the design, not a flaw); "unexplained bulk reclassification" (fully justified by AC2's table, flagged only because the Blind Hunter layer intentionally has no spec context); AIM_CAST shipping with RELEASE-identical behavior (explicit incremental scoping — Story 3.18 owns the real channel mechanic); AIM_CAST test not exercising AIM_CAST-unique logic (none exists yet, by design); hardcoded 4-ability tuple shape in the test (mirrors the pre-existing `ClassDef.abilities` 4-tuple type, not new fragility); "until Story 3.18" being an untracked TODO (3.18 is a real, sprint-tracked story in `sprint-status.yaml`, not a dangling comment).

Re-verification after patches: `npm run typecheck` — 0 errors. `npx vitest run` — 381 passed, 0 failed, 7 skipped.

---

## Dev Notes

### Context

This is the first of 5 "shared engine capability" stories (3.11-3.15) that
Stories 3.16-3.20 (per-class kit reworks) build on. It is deliberately scoped
to be the smallest possible slice: a type-union extension plus 6 one-word
corrections. It adds **zero new gameplay behavior** — Soul Mend still does
nothing when cast (damage=0 in `balance.ts`, unchanged by this story), Dark
Pact still doesn't drain HP, etc. Those come in 3.12-3.20.

Full source of truth for the corrected values: the brainstorming session's
"Final Ability Spec Sheet" tables
(`_bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md`,
"Idea Organization and Prioritization" section, 4 per-class tables). Read
those tables directly rather than trusting the prose summary elsewhere in
that document — the tables are the converged, SCAMPER-confirmed final state.

### Why 3 ownership areas for one small story

Task 1 is a pure type/data change in `packages/shared-types`. Task 2 is a
test-only change verifying game-rules behavior that doesn't need to change.
Task 3 is a **forced consequence** of Task 1, not independent scope: widening
`AbilityInputType` to 4 members breaks an existing exhaustive `Record` type
in mobile-controller (a hard TypeScript compile error, not a style nit) and
silently removes Soul Mend's only way to fire on mobile (a functional
regression). Splitting Task 3 into its own story would mean this story ships
a broken build — worse than bundling. This mirrors the "Multi-context
(explicit cross-context approval)" pattern already used repeatedly in this
repo for small, mechanically-linked cross-boundary fixes.

### Implementation

**Task 1** — `packages/shared-types/src/class-definitions.ts`

```ts
// Before
export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP';

// After
export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST';
```

Then in `CLASS_DEFINITIONS`, only these lines change (everything else in the
file — `name`, class metadata, `role`, `flavor` — stays exactly as-is):

```ts
// Stonehide
{ name: 'Stone Wall',    inputType: 'RELEASE'  },  // was 'TAP'
{ name: 'Tremor Stomp',  inputType: 'TAP'      },  // was 'RELEASE'
// Spiritcaller
{ name: 'Soul Mend',     inputType: 'AIM_CAST' },  // was 'RELEASE'
// Souldrinker
{ name: 'Dark Pact',     inputType: 'RELEASE'  },  // was 'TAP'
{ name: 'Void Pulse',    inputType: 'RELEASE'  },  // was 'TAP'
// Stormcaller
{ name: 'Storm Eye',     inputType: 'RELEASE'  },  // was 'AUTO'
```

**Task 2** — `tests/unit/abilities.test.ts`

Current file has 8 tests, all passing today. Two must change because they
hardcode the pre-correction Stone Wall/Tremor Stomp slot assumptions:

- `'TAP ability returns direction (0, 0) regardless of input direction'`
  (lines 31-45) uses Stonehide `abilityIndex: 0` (Stone Wall) as its TAP
  example. After Task 1, slot 0 is `RELEASE`, so this test's assertion
  (`directionX`/`directionY` both `0`) becomes **false** and the test fails
  for the right reason. Swap to a slot that's still `TAP` post-correction:
  Stonehide slot 1 (Tremor Stomp, now `TAP`) or slot 2 (Iron Skin, unchanged
  `TAP`).
- `'RELEASE ability preserves direction'` (lines 60-74) uses Stonehide
  `abilityIndex: 1` (Tremor Stomp) as its RELEASE example. After Task 1,
  slot 1 is `TAP`, so this test's assertion (direction preserved) becomes
  **false**. Swap to a slot that's still/now `RELEASE`: Stonehide slot 0
  (Stone Wall, now `RELEASE`) or Souldrinker slot 1 (Crimson Lash, unchanged
  `RELEASE`).

Add the table-driven assertion as a new `it` block, e.g.:

```ts
const EXPECTED_INPUT_TYPES: Record<PlayerClass, [string, string, string, string]> = {
  [PlayerClass.STONEHIDE]:    ['RELEASE', 'TAP', 'TAP', 'AUTO'],
  [PlayerClass.SPIRITCALLER]: ['AUTO', 'TAP', 'AIM_CAST', 'TAP'],
  [PlayerClass.SOULDRINKER]:  ['AUTO', 'RELEASE', 'RELEASE', 'RELEASE'],
  [PlayerClass.STORMCALLER]:  ['AUTO', 'RELEASE', 'TAP', 'RELEASE'],
};

it('all 16 abilities have the corrected inputType', () => {
  for (const cls of Object.values(PlayerClass)) {
    CLASS_DEFINITIONS[cls].abilities.forEach((ability, i) => {
      expect(ability.inputType).toBe(EXPECTED_INPUT_TYPES[cls][i]);
    });
  }
});
```

(Import `CLASS_DEFINITIONS` and `PlayerClass` from `shared-types` — both
already used/importable in this file's package graph via the existing
`PlayerClass` import.)

Add one `AIM_CAST` direction-preservation test mirroring the existing
AUTO/RELEASE ones, using Spiritcaller slot 2 (Soul Mend):

```ts
it('AIM_CAST ability preserves direction', () => {
  const result = dispatchAbility({
    ...baseCtx,
    playerClass: PlayerClass.SPIRITCALLER,
    abilityIndex: 2,
    directionX: 0.3,
    directionY: -0.9,
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.directionX).toBeCloseTo(0.3);
    expect(result.value.directionY).toBeCloseTo(-0.9);
  }
});
```

**Task 3** — `apps/mobile-controller/src/screens/ControllerScreen.tsx`

```ts
// Before (line ~211-215)
const ABILITY_BADGE_BORDER: Record<AbilityInputType, string> = {
  AUTO:    'var(--accent-spirit)',
  RELEASE: 'var(--accent-warm)',
  TAP:     'var(--border)',
};

// After
const ABILITY_BADGE_BORDER: Record<AbilityInputType, string> = {
  AUTO:     'var(--accent-spirit)',
  RELEASE:  'var(--accent-warm)',
  TAP:      'var(--border)',
  AIM_CAST: 'var(--accent-warm)',  // shares RELEASE's fire-on-release behavior until Story 3.18
};
```

```ts
// Before (onTouchEnd, ~line 679, and onDocumentTouchEnd, ~line 698 — same
// condition appears in both, change both)
if (ability.inputType === 'RELEASE' && !t.releaseFired) {

// After
if ((ability.inputType === 'RELEASE' || ability.inputType === 'AIM_CAST') && !t.releaseFired) {
```

Do not touch the `onTouchStart`/`onTouchMove` logic, the `AUTO` interval
setup, or the `TAP`-only `onPointerDown` handler — all of them already treat
"not TAP" as "track touch" and only special-case `AUTO` for continuous fire,
which is correct and unaffected by adding `AIM_CAST`.

### Known pitfalls

- Do not edit `packages/shared-types/src/input.ts` — epics.md's AC1 names
  this file but it's wrong; `AbilityInputType` is in `class-definitions.ts`.
- Do not touch `packages/game-rules/src/systems/abilities.ts` — its existing
  ternary (`inputType === 'TAP' ? 0 : ...`) already handles a 4th union
  member correctly with zero changes. Adding an explicit `AIM_CAST` branch
  would be redundant code, not a fix.
- Do not touch `apps/simulation-server/src/rooms/GameRoom.ts` —
  `isDirectional = abilityDef.inputType !== 'TAP'` at line 1355 already
  generalizes correctly. Soul Mend's damage is 0 in `balance.ts` (unchanged
  by this story), so the hit-scan loop skips it entirely
  (`if (rawDamage <= 0) continue`) regardless of inputType — there is no
  hit-scan behavior change to verify for Soul Mend in this story.
- Do not implement any part of Soul Mend's actual channel/cast/interrupt/
  revive mechanic — Story 3.18 owns all of that, including the "real" mobile
  UX for `AIM_CAST` (hold-to-channel with cancel-on-release-early). Task 3's
  mobile fix here is a deliberate placeholder ("fire on any release", not
  "channel while held") — this is intentional scope discipline, not an
  oversight.
- `ABILITY_BADGE_BORDER`'s new `AIM_CAST` color choice (reusing RELEASE's
  `var(--accent-warm)`) is arbitrary but consistent with AIM_CAST's
  fire-on-release behavior in this story. Story 3.18 may want a distinct
  color once real channel UX exists — not this story's concern.
- The `badgeBorderColor` ternary at ControllerScreen.tsx:1300-1304 (used only
  for the spirit-cell override rendering path, a *different* code path from
  `ABILITY_BADGE_BORDER`) is NOT a `Record` and does not need an `AIM_CAST`
  branch — it's an `if/else if/else` chain that already falls through safely
  to the TAP color for any value it doesn't explicitly check. Confirmed this
  compiles fine as-is; leave it alone per Non-goals.

### Project Structure Notes

- No new files. All 3 touched files already exist in their established
  locations. `tests/unit/abilities.test.ts` is a monorepo-root-level test
  file (not `packages/game-rules/tests/unit/`) — this is the existing
  convention for this specific test, established before this story; don't
  move it.
- No `packages/shared-types/src/index.ts` change — `AbilityInputType` is
  already exported via `export * from './class-definitions.js'`.

### Project Context Rules

- **Ownership** (project-context.md, Code Organization Rules → Monorepo
  Ownership): Task 1 is Protocol Architect (`packages/shared-types/**`);
  Task 2 touches a test file, closest to Simulation Engineer's domain
  (game-rules behavior) even though the literal path is `tests/unit/` at
  repo root; Task 3 is Mobile Controller Engineer
  (`apps/mobile-controller/**`). Bundled under "Multi-context (explicit
  cross-context approval)" per the established repo precedent for small
  mechanically-linked fixes (see CLAUDE.md Required Task Header above for
  the full precedent list).
- **Contract-change hook** (project-context.md, Testing Rules): nominally
  triggered because Task 1 touches `packages/shared-types/**`, but
  `AbilityInputType` never appears on the wire — it's a local dispatch/UX
  driver on each surface independently, not a `net-protocol` message field.
  No new contract test required; this is stated explicitly here per the
  hook's own instruction not to silently skip it.
- **TypeScript strict mode** (project-context.md, Build & Package
  Management): "no `any` without explicit suppression comment" — not
  triggered; no `any` introduced by this story.
- **Naming conventions** (project-context.md, Code Organization Rules):
  `AIM_CAST` matches the existing `SCREAMING_SNAKE_CASE`-within-union-literal
  style of `AUTO`/`RELEASE`/`TAP`.
- **Configuration Hierarchy** (project-context.md): no new constants needed —
  this is a literal type-union extension and data-table correction, not a
  tunable value.
- **Client-UX hook** (CLAUDE.md): triggered by Task 3 (mobile UI touched).
  Mobile check applicable: skill mapping — verify in a running mobile client
  (or by reading the touch-handler diff) that Soul Mend's ability cell still
  responds to a tap-and-release gesture after the change. Joystick mapping,
  reconnect UX, and sleep/background recovery are unaffected and don't need
  re-verification.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.11: Ability Input Taxonomy Expansion & Type Corrections] — original AC text (note the input.ts file-path error corrected in this story's Context section)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3 Extension: Ability Mechanics Rework] — scoping note explaining why 3.11-3.15 precede 3.16-3.20
- [Source: _bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md#Final Ability Spec Sheet (by class)] — authoritative per-class input-type tables
- [Source: packages/shared-types/src/class-definitions.ts] — current `AbilityInputType` and `CLASS_DEFINITIONS` (read fully before editing)
- [Source: packages/game-rules/src/systems/abilities.ts] — `dispatchAbility`; confirmed no change needed
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1340-1373] — `isDirectional` hit-scan gating; confirmed no change needed
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx] — `ABILITY_BADGE_BORDER`, touch-input `useEffect`, spirit-cell override
- [Source: packages/game-rules/src/balance.ts:40-45] — `ABILITY_DAMAGE`; confirms Soul Mend's damage=0 is unchanged by this story
- [Source: tests/unit/abilities.test.ts] — existing 8 tests; 2 require rewriting, not just extension
- [Source: _bmad-output/implementation-artifacts/3-10-epic-3-post-39-deferred-hardening.md] — most recent Epic 3 story; established the "Multi-context (explicit cross-context approval)" header pattern this story follows

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — no test failures encountered during implementation (typecheck and
unit/contract tests passed on first run).

### Completion Notes List

- Task 1: Added `'AIM_CAST'` to `AbilityInputType` and applied all 6
  `CLASS_DEFINITIONS` corrections exactly as specified in AC2. Verified via
  Read before editing that the pre-correction values matched the story's
  documented current state.
- Task 2: Rewrote `tests/unit/abilities.test.ts` — swapped the TAP example
  from Stonehide slot 0 (Stone Wall, now RELEASE) to slot 1 (Tremor Stomp,
  now TAP); swapped the RELEASE example from slot 1 (Tremor Stomp, now TAP)
  to slot 0 (Stone Wall, now RELEASE); added a new `AIM_CAST` direction test
  using Spiritcaller slot 2 (Soul Mend); added the table-driven "all 16
  abilities" test. Cooldown/out-of-range/≤3000ms tests left untouched.
- Task 3: Added `AIM_CAST` entry to `ABILITY_BADGE_BORDER` and extended both
  `onTouchEnd`/`onDocumentTouchEnd` fire conditions to include `AIM_CAST`
  (fire-on-release bridge, per Non-goals — no channel/cancel logic added).
  Confirmed via grep the spirit-cell override ternary at ~line 1302 needed no
  change (falls through safely, not a `Record`).
- Verified via grep that `ABILITY_BADGE_BORDER` is the only exhaustive
  `Record<AbilityInputType, ...>` in the repo — no other site needed an
  `AIM_CAST` case.
- `packages/game-rules/src/systems/abilities.ts` and
  `apps/simulation-server/src/rooms/GameRoom.ts` were read and confirmed
  unchanged, per Blocked paths — both already generalize correctly to a 4th
  union member.
- Contract-change hook: nominally triggered (Task 1 touches
  `packages/shared-types/**`) but `AbilityInputType` never serializes onto
  the wire — no new contract test required, stated here per the hook's own
  instruction.
- `npm run typecheck` (full monorepo, 10 project references): 0 errors.
- `npx vitest run` (full suite): 376 passed, 0 failed, 12 skipped. 3 e2e
  suites (`tests/e2e/full-run.test.ts`, `tests/e2e/reconnect.test.ts`, and a
  test file under an unrelated agent's `.claude/worktrees/**` checkout) threw
  `EADDRINUSE` on ports 2568/2569 during setup — a pre-existing
  port-contention/zombie-process environment issue (see project memory on
  WSL2 zombie tsx processes), not caused by this story's diff, which touches
  only `packages/shared-types`, `apps/mobile-controller`, and a unit test
  file, none of which affect server port binding. `tests/unit/abilities.test.ts`
  and `tests/contract/net-protocol.test.ts` both passed.
- Confidence: 95% — all ACs verified directly against the diff and a green
  typecheck/test run; the only uncertainty is the pre-existing e2e port
  conflict, which is environmental and outside this story's scope.

### File List

- `packages/shared-types/src/class-definitions.ts` (modified)
- `tests/unit/abilities.test.ts` (modified)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (modified — Task 3, plus a review-patch fix to the `badgeBorderColor` ternary at ~line 1303)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — review-patch only, cross-context approved; outside this story's original Allowed paths, see Review Findings)

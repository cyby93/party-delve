---
baseline_commit: 3d22e41
---

# Story 3.24: Epic 3 — Post-3.23 Deferred Hardening

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Story 3.24 — deferred hardening, no new features)
Context: Story 3.22 (2026-07-15) closed every Epic 3 deferred finding open at the time and
  logged 4 new ones from its own code review (D-3.22-A/B/C/D). Story 3.23 (2026-07-20)
  shipped the skill-cell aiming ring/knob visual and, in the same session, both its dev
  implementation and its code review surfaced a 5th finding (D-3.23-A, logged twice —
  once under "dev implementation of 3-23" with full detail, once under "code review of
  3-23" as "D2"), plus a 6th (D1, the un-run Client-UX hook / a code-traced text-occlusion
  risk). None of these 6 findings have been touched since. This story closes that backlog —
  re-verified against the CURRENT codebase below, not trusted from deferred-work.md's text
  at face value (all 6 were re-read against current source; all 6 still apply exactly as
  described — nothing was found stale this time, unlike 3.22's pass which dismissed 2).

  D-3.23-A is this story's PRIMARY task. The user flagged it directly during 3.23's own
  dev-story session as high-priority ("worth prioritizing given it affects the primary
  combat-input gesture for 3 of 4 input types"), and 3.23's own Non-goals explicitly fenced
  it off ("Do not fix D-3.3-B... your new ring/knob cleanup state must mirror the existing
  cleanup's behavior exactly") — this is the story that lifts that fence. D-3.23-A and the
  older, already-tracked D-3.3-B (RELEASE silently drops its fire if `isInteractive` flips
  false mid-hold) share one root cause: `isInteractive` sits in the touch-tracking
  `useEffect`'s dependency array, so ANY reason `isInteractive` flips false — cooldown
  starting (D-3.23-A) or a real interrupt like the player going downed or the dungeon phase
  ending (D-3.3-B) — tears the whole effect down and either orphans the touch (AUTO/AIM_CAST)
  or silently swallows a pending RELEASE fire. Task 1 fixes both in one pass, splitting
  "gate a NEW touchdown" (still checked, still respects cooldown) from "interrupt an
  ACTIVE hold" (should now only happen for real interrupts, and should now fire a pending
  RELEASE before discarding, instead of silently dropping it) — exactly the split
  deferred-work.md's own recommended fix names.

  The other findings are secondary, smaller, and independently scoped:
  - D1 (3.23 review) — a code-traced text-occlusion risk (the new ring/knob can paint over
    the ability name/badge text) is closed by construction with a one-line z-index fix
    (Task 1c), removing the need for a human device pass to confirm THIS specific risk.
  - D-3.22-A/B — e2e test-hygiene gaps (no try/finally cleanup; `raceTimeout`'s losing timer
    never cleared) across all 3 files that share these patterns
    (ability-dispatch/full-run/reconnect.test.ts). Small, mechanical, zero game-code risk —
    included as Task 2.
  - D-3.22-D — shield magnitude has no lower-bound validation, unlike every other
    status-effect type. One-line guard, included as Task 3, matching 3.22's own precedent of
    bundling a near-zero-risk defensive guard into a hardening pass.
  - D-3.22-C — re-verified still valid (`GameRoom.ts:1331`'s `const SPEED = 200` is still
    private/unexported; the e2e test's `PLAYER_SPEED_PX_S = 200` is still a hardcoded,
    silently-driftable duplicate) but RE-DEFERRED, not fixed, this pass: deferred-work.md's
    own suggested remedy — promote the constant into `packages/shared-types/constants.ts`
    per the project's Configuration Hierarchy — crosses into Protocol Architect's ownership
    and would trigger the Contract-change hook (review, compatibility checklist, spec/ADR
    update, new contract test) for a test-timing accuracy safeguard with zero live
    correctness impact today. Disproportionate to this hardening pass; revisit next time
    `packages/shared-types/constants.ts` or `GameRoom.ts` is open for an unrelated change,
    per the original deferral's own trigger condition.

Owner agent: Multi-context (explicit cross-context approval, following the 3.9/3.10/3.22
  precedent of bundling small, low-risk, clearly-scoped hardening findings into one story
  rather than splitting a 1-2 file fix into its own story per finding — this pass adds a
  3rd context, Mobile Controller Engineer, alongside the 2 (QA + Telemetry, Simulation) 3.22
  already established):
  Mobile Controller Engineer (Task 1 — apps/mobile-controller/src/screens/ControllerScreen.tsx)
  QA + Telemetry Engineer (Task 2 — tests/e2e/**)
  Simulation Engineer (Task 3 — packages/game-rules/src/systems/status-effects.ts)

Goal: Fix the touch-lifecycle bug behind D-3.23-A and D-3.3-B in `SkillCell` (Task 1,
  primary), close the text-occlusion risk from 3.23's un-run Client-UX hook (Task 1c),
  harden the 3 e2e test files' cleanup/timer hygiene (Task 2), and add a lower-bound guard
  to shield-effect magnitude validation (Task 3). Re-defer D-3.22-C with documented
  justification (see Context above) — do not attempt its fix in this story.

Allowed paths:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx   (Task 1 — SkillCell + its
    parent's isInteractive/canHoldThroughCooldown computation, lines ~624-897, ~1482-1512)
  - tests/e2e/ability-dispatch.test.ts                        (Task 2)
  - tests/e2e/full-run.test.ts                                (Task 2)
  - tests/e2e/reconnect.test.ts                                (Task 2)
  - tests/helpers/**                                           (Task 2 — only if extracting
    the now-duplicated-and-fixed `raceTimeout` into a shared helper; prefer this over fixing
    the same bug twice in two separate copies)
  - packages/game-rules/src/systems/status-effects.ts          (Task 3)
  - packages/game-rules/tests/unit/**                          (Task 3 — new/updated unit test)

Blocked paths:
  - apps/simulation-server/src/rooms/GameRoom.ts               (D-3.22-C re-deferred; no
    edit needed — the local `SPEED` constant stays exactly as-is)
  - packages/shared-types/**                                   (no contract change in this
    story; D-3.22-C's proper fix is explicitly out of scope for the reason given in Context)
  - packages/net-protocol/**
  - apps/host-client/**
  - apps/backend-platform/**
  - packages/ui-kit/**                                         (SkillCell stays a local
    component in ControllerScreen.tsx, matching 3.23's Non-goals — not extracted here either)

Inputs:
  - _bmad-output/implementation-artifacts/deferred-work.md sections: "Deferred from: dev
    implementation of 3-23-skill-cell-joystick-aiming-interaction" (D-3.23-A, full detail
    incl. recommended fix), "Deferred from: code review of 3-23-skill-cell-joystick-aiming-interaction"
    (D1, D2/D-3.23-A short form), "Deferred from: code review of 3-3-4-alpha-class-implementations-abilities-and-input-types"
    (D-3.3-B), "Deferred from: code review of 3-22-epic-3-post-321-deferred-hardening"
    (D-3.22-A, B, C, D)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (read fully — `SkillCell`,
    lines 624-897 (the touch-tracking `useEffect` at 652-773 and the ring/knob render block
    at 852-888 are what Task 1 modifies), and the parent grid's `isInteractive` computation
    at lines 1482-1486 and `SkillCell` invocation at 1499-1513)
  - packages/game-rules/src/systems/abilities.ts (read fully — `dispatchAbility`'s
    `ctx.cooldownExpiresAt > ctx.nowMs` early-return at line ~44, confirming an on-cooldown
    ability-fire attempt from Task 1's now-persistent interval is already a harmless
    server-side no-op, unchanged by this story)
  - tests/e2e/ability-dispatch.test.ts (read fully — `raceTimeout` at lines 16-19, cleanup
    pattern at lines 219-220 and 272-273)
  - tests/e2e/full-run.test.ts (read fully — `raceTimeout` at lines 11-14, cleanup at
    lines 272 and 413)
  - tests/e2e/reconnect.test.ts (read fully — 5 `it()` blocks, cleanup-only-at-end pattern,
    no `raceTimeout` usage)
  - packages/game-rules/src/systems/status-effects.ts (read fully — 52 lines,
    `applyStatusEffect`'s magnitude guard at line 20)
  - packages/game-rules/src/systems/player-health.ts (read fully — confirms `applyPlayerDamage`
    already consumes `getStatusEffectMagnitude(player, 'shield', nowMs)` with no clamp of its
    own at lines 31-32; Task 3's fix belongs in `status-effects.ts`'s `applyStatusEffect`,
    upstream of this read, not here)
  - packages/game-rules/tests/unit/player-health.test.ts (read fully — existing shield test
    cases to confirm Task 3's change doesn't alter any of them, since Warding Cry's only
    real usage stays a valid positive magnitude)
  - packages/game-rules/src/balance.ts (read — confirm Warding Cry (line ~213) is still the
    only `'shield'`-effect producer, with a hardcoded positive `magnitude: 30`, unchanged
    since 3.22)

Non-goals:
  - Do not fix D-3.22-C (see Context for the full reasoning — a shared-types migration is
    disproportionate to this pass). Do not export `GameRoom.ts`'s `SPEED` constant, do not
    add a `packages/shared-types/constants.ts` entry for it, and do not change
    `tests/e2e/ability-dispatch.test.ts`'s `PLAYER_SPEED_PX_S` duplicate.
  - Do not touch AIM_CAST's channel-progress indicator (still explicitly out of scope, per
    3.23's own Non-goals, D-018 — unrelated to this story's touch-lifecycle fix anyway).
  - Do not extract `SkillCell` into `packages/ui-kit`.
  - Do not change any ability fire cadence, cooldown duration, or `INPUT_INTERVAL_MS`/
    `autoIntervalRef`'s 33ms interval value. Task 1 changes WHEN the effect tears down and
    what the cleanup does on teardown — it does not change when abilities fire.
  - Do not add a generic "shield" concept to any other system (e.g. enemies). Task 3 only
    tightens `applyStatusEffect`'s existing validation for the `'shield'` type that already
    exists; it does not add new shield producers or consumers.
  - Do not restructure the 3 e2e files' test scenarios themselves in Task 2 — only the
    cleanup/timer mechanics (`afterEach`, `raceTimeout`). Do not add new test scenarios.
  - Do not attempt exhaustive manual device verification as a blocking gate for Task 1 —
    matching dev-1/dev-2/dev-3/3.23's established precedent, flag in the Dev Agent Record if
    this sandbox has no display/touch device (very likely, per every prior mobile-UI story
    in this repo) rather than blocking completion on it. Task 1c's occlusion fix is a
    structural CSS-stacking fix verifiable by code inspection alone (positioned + z-index
    content always paints above non-positioned in-flow content in the same stacking
    context, per CSS spec) — it does not need a device to confirm.

Acceptance criteria:
  1. Holding an AUTO or AIM_CAST skill cell through a cooldown boundary (i.e. the ability
     fires, its cooldown starts, and the player's thumb never lifts) keeps the touch
     listeners, the 33ms repeat-fire interval, and the ring/knob visual alive for the rest
     of the hold — firing resumes the instant cooldown clears, with no re-touch required.
     Starting a brand-new touch on a cell that is already on cooldown is still blocked
     (no fire, no ring/knob spawn), unchanged from today.
  2. Holding a RELEASE skill cell when the touch-tracking effect is torn down for a reason
     other than cooldown (player downed, dungeon phase ends, or any other
     `canHoldThroughCooldown`-flipping condition) fires the RELEASE ability once, using the
     last tracked direction, before the touch state clears — matching the existing
     onTouchEnd/onDocumentTouchEnd RELEASE-on-lift behavior instead of silently discarding it.
  3. The ability name and badge-type text always render above the ring/knob overlay,
     regardless of where the ring/knob's spawn origin lands in the cell (including near the
     bottom-left label) — closing the text-occlusion risk 3.23's code review flagged.
  4. Every `it()` block across `tests/e2e/ability-dispatch.test.ts`,
     `tests/e2e/full-run.test.ts`, and `tests/e2e/reconnect.test.ts` force-leaves every room
     it created — even when an assertion throws or a `waitForDelta`/`raceTimeout` call times
     out before the test's own happy-path cleanup runs — so a failed test cannot leak a live
     room/subscription into a later test in the same file.
  5. `raceTimeout`'s losing `setTimeout` handle (in both its `ability-dispatch.test.ts` and
     `full-run.test.ts` definitions, or their consolidated shared-helper replacement) is
     cleared as soon as the wrapped promise wins the race — no dangling up-to-10s timer
     survives past the race's resolution.
  6. `applyStatusEffect` rejects a `'shield'`-type effect with `effect.magnitude < 0` with
     `{ ok: false, error: { code: 'INVALID_MAGNITUDE' } }`, matching the existing rejection
     behavior every other status-effect type already gets for out-of-range magnitude. A
     `'shield'` effect with a non-negative magnitude (including > 1, e.g. Warding Cry's 30)
     continues to be accepted exactly as before.
  7. Full monorepo `npm run typecheck` and the full Vitest suite (unit + contract + e2e)
     pass with no regressions. The 3 modified e2e files are observed passing at least twice
     in a row (this codebase's e2e suite has known WSL2/port-contention flakiness — see
     3.22's Dev Agent Record — so a single green run is not sufficient confirmation).

Required hooks:
  - Client-UX hook (mobile UI touched, Task 1):
    - joystick/skill mapping: verify AUTO/AIM_CAST keeps firing across a cooldown boundary
      without re-touching, and RELEASE still fires normally on lift (unchanged happy path).
    - minimal-attention check: Task 1c's z-index fix is a structural, code-verifiable
      guarantee (see Non-goals) — a human device pass is still valuable for overall feel but
      not a blocking gate for this specific risk. Flag in the Dev Agent Record if this
      sandbox has no display/touch device available, matching 3.23's own precedent.
  - Simulation-safety hook (Task 3 modifies `packages/game-rules/src/systems/status-effects.ts`):
    typecheck, unit tests, deterministic sanity (pure arithmetic/comparison, no
    `Math.random()`, no non-deterministic branching introduced).
  - QA/telemetry test-authoring (Task 2 lives entirely in `tests/e2e/**` and
    `tests/helpers/**`, QA + Telemetry Engineer's ownership area).
  - No contract-change hook (no `packages/shared-types/**`/`packages/net-protocol/**` touch
    anywhere in this story — D-3.22-C, the one finding that would have required it, is
    explicitly re-deferred).

Required tests:
  - No new automated test for Task 1 — `SkillCell`'s touch-drag interaction cannot be
    reliably exercised in jsdom, matching dev-1/dev-2/dev-3/3.23's established precedent.
  - Task 2 has no "test of the tests" — the 3 e2e files ARE the tests being hardened. Re-run
    them (ideally the full e2e suite) at least twice consecutively to confirm the cleanup
    refactor introduces no new flakiness or regressions.
  - New: packages/game-rules/tests/unit/status-effects.test.ts (grep first — none currently
    exists, unlike player-health.ts/zones.ts which already have unit test files) — covering
    Task 3's negative-shield-magnitude rejection (AC6), plus a couple of pre-existing-behavior
    regression cases (damageReduction/slow/damageBuff out-of-range rejection still works;
    positive shield magnitude, including > 1, still accepted).
  - Confirm packages/game-rules/tests/unit/player-health.test.ts's existing shield test cases
    still pass unchanged (Task 3 tightens `applyStatusEffect`, not `applyPlayerDamage` —
    should be a no-op for any already-valid, non-negative shield magnitude).
Telemetry impact: None — no new user-facing flow, no new event names. Task 1 changes when an
  already-shipped visual/interaction persists, not what the player can do; Tasks 2-3 are
  test-hygiene and defensive validation with no observable game behavior change for any
  currently-reachable input.
```

---

## Story

As a developer on the project,
I want the touch-lifecycle bug behind the user-flagged D-3.23-A (AUTO/AIM_CAST orphaning
mid-hold on cooldown) and the older D-3.3-B (RELEASE silently dropping its fire) fixed
together — since they share one root cause — plus the smaller, already-open D-3.22-A/B/D
findings closed and D-3.22-C formally re-deferred with reasoning,
so that the primary combat-input gesture (held-type skill cells, 3 of 4 input types) behaves
per spec, the e2e suite can't leak state across a failed test, and shield-effect validation
matches every other status-effect type before Epic 3's backlog carries into Epic 4/6
hardening or a future biome epic.

---

## Acceptance Criteria

**AC1 — AUTO/AIM_CAST survive a cooldown boundary mid-hold (closes D-3.23-A):**
**Given** a player holding an AUTO or AIM_CAST skill cell
**When** the ability fires successfully and its cooldown starts while the touch is still down
**Then** the touch listeners, the 33ms repeat-fire interval, and the ring/knob visual remain
active for the rest of the hold
**And** firing resumes automatically the instant cooldown clears, with no lift/re-touch required
**And** starting a brand-new touch on a cell already on cooldown is still blocked (no fire, no
ring/knob spawn) — unchanged from today

**AC2 — RELEASE fires on a forced (non-cooldown) teardown instead of dropping silently (closes D-3.3-B):**
**Given** a player holding a RELEASE skill cell
**When** the touch-tracking effect tears down for a real interrupt (player downed, dungeon
phase ends, or any other reason `canHoldThroughCooldown` flips false) while the touch is active
**Then** the RELEASE ability fires once, using the last tracked direction, before the touch
state clears — the same as the existing onTouchEnd/onDocumentTouchEnd behavior, not a
silent discard

**AC3 — Name/badge text always renders above the ring/knob (closes D1/3.23 occlusion risk):**
**Given** the ability name and badge-type `<span>`s and the ring/knob overlay in the same cell
**Then** the text renders on top regardless of where the ring/knob's spawn origin lands,
including near the bottom-left label — structurally guaranteed by stacking order, not by
avoiding the overlap

**AC4 — E2E test cleanup survives a failed assertion (closes D-3.22-A):**
**Given** any `it()` block in `tests/e2e/ability-dispatch.test.ts`, `full-run.test.ts`, or
`reconnect.test.ts`
**When** an assertion throws or a `waitForDelta`/`raceTimeout` call times out before the
test's own happy-path cleanup runs
**Then** every room that test created is still force-left before the next test starts —
no live room/subscription leaks into a subsequent test in the same file

**AC5 — `raceTimeout`'s losing timer is cleared (closes D-3.22-B):**
**Given** `raceTimeout(p, ms, label)` in `ability-dispatch.test.ts`/`full-run.test.ts` (or
their consolidated shared-helper replacement)
**When** `p` wins the race
**Then** the losing `setTimeout` handle is cleared immediately — no dangling timer survives
past the race's resolution

**AC6 — Shield magnitude lower-bound guard (closes D-3.22-D):**
**Given** `applyStatusEffect(target, effect, nowMs)` called with `effect.type === 'shield'`
**When** `effect.magnitude < 0`
**Then** it returns `{ ok: false, error: { code: 'INVALID_MAGNITUDE', detail: String(effect.magnitude) } }`
**And** a non-negative `'shield'` magnitude (including values > 1, e.g. Warding Cry's 30)
continues to be accepted exactly as before

**AC7 — No regressions:**
**Given** all of the above changes
**When** the full monorepo `npm run typecheck` and Vitest suite (unit + contract + e2e) run
**Then** everything passes, and the 3 modified e2e files pass on at least 2 consecutive runs
(known WSL2/port-contention flakiness baseline — see 3.22's Dev Agent Record)

---

## Dev Notes

### Context — why these findings and not others

Epic 3's deferred-work.md carries 2 findings logged since 3.23 shipped (2026-07-20):
`D-3.23-A` (logged twice — full detail under "dev implementation of 3-23," short form as
`D2` under "code review of 3-23") and `D1` (the un-run Client-UX hook / occlusion risk). Both
are re-verified below against current source and both still apply exactly as described.
3.22's own leftover findings (`D-3.22-A/B/C/D`) are also still open and re-verified — 3 of
the 4 are small enough to fold in here; `D-3.22-C` is re-deferred with reasoning (see the
CLAUDE.md Required Task Header's Context section above — the proper fix crosses into
Protocol Architect ownership and is disproportionate to a test-timing nicety).

**This story's priority order is deliberate.** Per the user's own direction (flagged live
during 3.23's dev-story session, not just an automated review finding): D-3.23-A affects
"the primary combat-input gesture for 3 of 4 input types" and is fixed first, as Task 1. The
other findings are smaller, independently-scoped, and sequenced after it.

### Task 1 (PRIMARY) — SkillCell touch-lifecycle fix

**File:** `apps/mobile-controller/src/screens/ControllerScreen.tsx`

**Root cause (confirmed against current source):** `SkillCell`'s touch-tracking `useEffect`
(lines 652-773) has `isInteractive` in its dependency array (line 773). `isInteractive` is
computed by the parent grid (lines 1482-1486) as a single boolean that folds in
`!isOnCooldown` alongside the real interrupt conditions (`!isDown`, `!isSpirit`, `!inDungeon`
transitions, `!inBondMoment`, `!isFrozen`). Any one of those flipping — including a routine
cooldown start — reruns the effect, and its cleanup (lines 758-772) unconditionally clears
`activeTouchRef`/`spawnOrigin`/`knobOffset` and tears down all 6 event listeners without
firing a pending RELEASE. Since the re-run's own guard (`if (!el || !isInteractive || ...)
return;`, line 654) exits early while still on cooldown, nothing re-attaches until the
player physically lifts and re-touches — this is D-3.23-A for AUTO/AIM_CAST (fires on every
successful cast, since their cooldowns are 1-2s per `ABILITY_COOLDOWNS_MS`) and D-3.3-B for
RELEASE (fires on real interrupts like a downed transition or dungeon-phase-end).

**Subtask 1.1 — Split cooldown out of the effect's gate (closes AC1/D-3.23-A).**
At the parent's `isInteractive` computation (`ControllerScreen.tsx:1482-1486`), factor out
the pre-cooldown condition as a new value, e.g. `canHoldThroughCooldown`:
```ts
const canHoldThroughCooldown = isSpiritCell
  ? !isFrozen && !inBondMoment
  : (!inDungeon || (!isDown && !isSpirit)) && ability !== null && !inBondMoment;
const isInteractive = canHoldThroughCooldown && !isOnCooldown;
```
This is a pure refactor — `isInteractive`'s value and every existing use of it (the render's
`pointerEvents` gate at line 789, the TAP `onPointerDown` gate at line 798) are byte-for-byte
unchanged. Pass the new value as an additional `SkillCellProps` field
(`canHoldThroughCooldown: boolean`) alongside the existing `isInteractive` prop, both passed
at the `<SkillCell ... />` call site (~line 1499-1513).

Inside `SkillCell`, change the effect's guard and dependency array from `isInteractive` to
`canHoldThroughCooldown`:
```ts
useEffect(() => {
  const el = cellRef.current;
  if (!el || !canHoldThroughCooldown || ability === null) return;
  if (ability.inputType === 'TAP') return;
  // ... unchanged handler bodies below ...
}, [canHoldThroughCooldown, ability, index, onAbilityFire]);
```
This alone means a cooldown-only flip of `isInteractive` no longer reruns the effect — the
listeners, `activeTouchRef`, and `autoIntervalRef`'s 33ms interval all keep running through
the cooldown window. Since `dispatchAbility` (`packages/game-rules/src/systems/abilities.ts`,
`ctx.cooldownExpiresAt > ctx.nowMs` early-return) already harmlessly rejects an on-cooldown
fire attempt, letting `autoIntervalRef` keep firing send attempts during the cooldown window
is safe — no exploit, no visible effect beyond a few harmless extra `INPUT` messages, and the
ability naturally resumes visible firing the instant the server-side cooldown clears.

**New touchdowns must still respect cooldown.** SkillCell already recomputes `isOnCooldown`
locally every render from its `cooldownState` prop (line 645: `const isOnCooldown = cd !==
null && cd.expiresAt > now;`). Add a ref mirroring it every render (no `useEffect` needed —
a plain assignment during the render body is safe here since it's write-only for later
event-handler reads, never read during render itself, matching the existing
`activeTouchRef`/`autoIntervalRef` "ref for handler logic" idiom already used in this
component):
```ts
const isOnCooldownRef = useRef(isOnCooldown);
isOnCooldownRef.current = isOnCooldown;
```
In `onTouchStart` (line 657), add a check right after the existing
`if (activeTouchRef.current !== null) return;` guard:
```ts
if (isOnCooldownRef.current) return;
```
This is the "gate new touchdowns only" half of the fix: a fresh touch on an on-cooldown cell
is still rejected (no fire, no ring/knob spawn — AC1's 2nd clause), while an already-active
hold is untouched by cooldown state changes.

**Subtask 1.2 — Fire a pending RELEASE on any forced teardown (closes AC2/D-3.3-B).**
The effect's cleanup function (lines 758-772) currently clears state unconditionally. Add the
same RELEASE-fire-once-on-teardown logic the effect's `onTouchEnd`/`onDocumentTouchEnd`
handlers already have (lines 714-717, 735-738), at the top of the cleanup, before the
listener removals:
```ts
return () => {
  const t = activeTouchRef.current;
  if (t !== null && ability.inputType === 'RELEASE' && !t.releaseFired) {
    t.releaseFired = true;
    onAbilityFire(index, t.lastDirX, t.lastDirY, false);
  }
  el.removeEventListener('touchstart', onTouchStart);
  // ...unchanged...
  activeTouchRef.current = null;
  setSpawnOrigin(null);
  setKnobOffset({ x: 0, y: 0 });
};
```
No double-fire risk: `onTouchEnd`/`onDocumentTouchEnd` already null `activeTouchRef.current`
and set `releaseFired = true` before this cleanup could ever see a non-null `t` for the same
touch, so this new check only fires for touches that were genuinely still active when the
effect tore down (the exact D-3.3-B scenario) — never for a touch that already ended
normally. Since Subtask 1.1 removed cooldown from the effect's dependency array, this
cleanup path is now reached ONLY for real interrupts (downed, phase transitions, ability
change, unmount) — never for a routine cooldown start, so AUTO/AIM_CAST's ring/knob and
firing correctly persist (AC1) while RELEASE correctly still fires once on any of those real
interrupts (AC2). Server-side authority makes this safe even at odd timing edges (e.g. firing
a RELEASE the instant a player goes downed) — the same "harmless no-op if actually invalid"
guarantee `dispatchAbility`/`applyPlayerDamage` already provide elsewhere in this codebase.

**Subtask 1.3 — Text-occlusion fix (closes AC3/D1).**
The ability name (`<span>`, lines 806-821) and badge-type (`<span>`, lines 822-835) are
non-positioned (`static`) elements. The ring/knob overlay (lines 852-888) uses
`position: absolute` with `zIndex: 8`. Per CSS stacking rules, positioned elements with an
explicit `z-index` paint in a stacking layer above non-positioned static content in the same
containing block, regardless of DOM order — so the ring will visually paint over the text
whenever the spawn origin lands near it. Wrap the two text `<span>`s (the `<>...</>` fragment
at lines 805-836) in a `div` with `position: 'relative', zIndex: 9` (one above the ring/knob's
8), giving the text its own stacking context above the overlay:
```tsx
{ability !== null ? (
  <div style={{ position: 'relative', zIndex: 9 }}>
    <span>...</span>{/* name span, unchanged */}
    <span>...</span>{/* badge span, unchanged */}
  </div>
) : (
  <span>...</span>{/* placeholder, unchanged */}
)}
```
This is a structural, code-verifiable fix (CSS stacking-context ordering is deterministic,
not a rendering heuristic) — it closes the occlusion risk without requiring a real device to
confirm this specific concern, unlike the rest of 3.23's un-run Client-UX checklist (which
still benefits from a human pass on overall feel, but is not blocking here).

### Task 2 — E2E test cleanup/timer hygiene

**Files:** `tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`,
`tests/e2e/reconnect.test.ts`

**D-3.22-A (closes AC4):** All 3 files only clean up rooms at the happy-path end of each
`it()` block (e.g. `ability-dispatch.test.ts:219-220,272-273`; `full-run.test.ts:272,413`;
`reconnect.test.ts`'s 5 blocks each ending with their own `.leave()` calls). A thrown
assertion or a `waitForDelta`/`raceTimeout` timeout anywhere before that final line skips
cleanup entirely, leaking a live room/subscription (same server instance,
`beforeAll`/`afterAll` are suite-scoped) into whatever test runs next in that file.

Recommended approach (cleaner than wrapping all 9 `it()` bodies individually in
`try/finally`, and catches any room even if a future test forgets to track it manually): add
a describe-scoped array in each file, e.g. `const liveRooms: Room[] = [];`, push every `Room`
onto it immediately after `client.create(...)`/`client.joinById(...)` resolves (including
inside shared setup helpers like `ability-dispatch.test.ts`'s `setupDungeonRun` — push there,
not just at each `it()`'s top level), and add:
```ts
afterEach(async () => {
  await Promise.allSettled(liveRooms.splice(0).map((r) => r.leave()));
});
```
Vitest runs `afterEach` even after a test failure/timeout, so this net catches every case the
current end-of-test-only cleanup misses. Once `afterEach` covers it, remove the existing
explicit end-of-test `.leave()` calls (avoids a double-leave race against the same room).

**D-3.22-B (closes AC5):** `raceTimeout` is defined separately in `ability-dispatch.test.ts`
(lines 16-19) and `full-run.test.ts` (lines 11-14) — identical bug in both copies, the losing
`setTimeout` handle from `Promise.race` is never cleared, keeping a timer alive up to the full
`ms` (up to 10s in this codebase's usage). Since both copies need the identical fix, this is
a case where promoting the helper into `tests/helpers/` (e.g. a new
`tests/helpers/race-timeout.ts`, or added to the existing `tests/helpers/messages.ts`) is
less total work than fixing two divergent copies and removes the future risk of the copies
drifting:
```ts
export function raceTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let handle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    handle = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(handle));
}
```
Update both `ability-dispatch.test.ts` and `full-run.test.ts` to import this instead of
keeping local copies. `reconnect.test.ts` doesn't use `raceTimeout` — no change needed there
for this specific finding (it still needs the `afterEach` cleanup from D-3.22-A above).

### Task 3 — Shield magnitude lower-bound guard

**File:** `packages/game-rules/src/systems/status-effects.ts`, `applyStatusEffect` (line 20).

**Current code:**
```ts
if (effect.type !== 'shield' && (effect.magnitude < 0 || effect.magnitude > 1)) {
  return { ok: false, error: { code: 'INVALID_MAGNITUDE', detail: String(effect.magnitude) } };
}
```
**Change:** shield is exempt from the upper bound (flat HP, not a fraction — unchanged
rationale, already documented in the comment above this line) but should NOT be exempt from
the lower bound — a negative shield magnitude would make `applyPlayerDamage`'s `absorbed =
Math.min(shieldMagnitude, mitigatedDamage)` negative, inflating `hpDamage` above the
pre-shield mitigated damage while also growing the stored shield magnitude each hit (per
D-3.22-D's original analysis). One-line change:
```ts
if (effect.magnitude < 0 || (effect.type !== 'shield' && effect.magnitude > 1)) {
  return { ok: false, error: { code: 'INVALID_MAGNITUDE', detail: String(effect.magnitude) } };
}
```
Not reachable today — Warding Cry (`packages/game-rules/src/balance.ts:213`) remains the only
`'shield'` producer, hardcoded at `magnitude: 30` (positive) — this is purely a defensive
guard against a future dynamic-magnitude shield ability, matching 3.22's own precedent of
bundling a similar near-zero-risk guard (`shouldZoneTick`'s `tickIntervalMs <= 0` check) into
a hardening pass.

**Test:** create `packages/game-rules/tests/unit/status-effects.test.ts` (grep first — none
exists yet, confirmed during this story's research). Minimal, matching the module's existing
simplicity (52 lines, no fixtures needed): cases for (a) negative shield magnitude rejected,
(b) positive shield magnitude (including > 1, e.g. 30) still accepted, (c) a representative
non-shield type (e.g. `damageReduction`) still rejects both < 0 and > 1 exactly as before
(regression coverage for the untouched half of the guard).

### Project Structure Notes

- Task 1 touches only the existing `ControllerScreen.tsx` — no new files, no new directories,
  matching 3.23's precedent (SkillCell stays a local component, not extracted to ui-kit).
- Task 2's `afterEach`/`raceTimeout` consolidation may add one new file under
  `tests/helpers/` if extracted (per the project's Testing Rules table, e2e helpers already
  live there) — otherwise no new files.
- Task 3 adds one new unit test file under `packages/game-rules/tests/unit/`, matching the
  existing placement of `player-health.test.ts`/`zones.test.ts` in the same directory.
- No `packages/shared-types/**` or `packages/net-protocol/**` changes anywhere in this story.

### Project Context Rules

- **Ownership**: Task 1 is Mobile Controller Engineer's area (`apps/mobile-controller/**`);
  Task 2 is QA + Telemetry Engineer's area (`tests/**`); Task 3 is Simulation Engineer's area
  (`packages/game-rules/**`). Per CLAUDE.md's Ownership Rules, this normally calls for
  splitting into 3 separate stories — but per the established "epic-N-post-XX-deferred-hardening"
  precedent (3.9, 3.10, 1.8/1.9, 2.6/2.7, 4.9/4.10/4.11, 5.7/5.8, and directly 3.22, which
  bundled QA + Simulation under "Multi-context, explicit cross-context approval"), this story
  extends that pattern to a 3rd context rather than spinning up 3 separate single-file
  hardening stories for small, independently-scoped, low-risk fixes. Flagging this explicitly
  per the ownership-scope-check protocol — split into 3.24/3.25/3.26 instead if stricter
  single-context stories are preferred going forward; this call was made because all 3 tasks
  are small (1 file or a bounded handful of files each), low-risk, and none of them interact
  with each other's diff.
- **Result<T, E> rule** (project-context.md, Critical Don't-Miss Rules): Task 3's
  `applyStatusEffect` already returns `Result<{ target }, StatusEffectError>` and must
  continue to — the tightened guard is just an additional early-return branch, no new
  mutation or throw.
- **Mobile Controller Constraints** (project-context.md, Platform & Build Rules): Task 1
  doesn't change the 2×2 ability grid layout or touch-target sizing — it changes when the
  touch-tracking effect tears down and what its cleanup does, and adds one wrapping `div`
  for stacking order. No layout shift.
- **No game-rules/simulation-server import from mobile-controller** (project-context.md,
  Simulation Safety): Task 1 adds no new imports from `game-rules`/`shared-types` beyond
  what's already imported in `ControllerScreen.tsx`.
- This story does **not** trigger the Contract-change hook (no `shared-types`/`net-protocol`
  change — D-3.22-C, the one finding that would have required it, is explicitly re-deferred).

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: dev implementation of 3-23-skill-cell-joystick-aiming-interaction (2026-07-20)] — D-3.23-A full detail + recommended fix
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-23-skill-cell-joystick-aiming-interaction (2026-07-20)] — D1 (occlusion), D2/D-3.23-A short form
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-3-4-alpha-class-implementations-abilities-and-input-types (2026-06-28)] — D-3.3-B
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-22-epic-3-post-321-deferred-hardening (2026-07-15)] — D-3.22-A, B, C, D
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:624-897] — current `SkillCell` implementation (Task 1)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:1482-1513] — parent `isInteractive` computation and `SkillCell` call site
- [Source: packages/game-rules/src/systems/abilities.ts] — `dispatchAbility`'s cooldown early-return, confirming Task 1's persistent-interval-during-cooldown approach is safe
- [Source: tests/e2e/ability-dispatch.test.ts], [Source: tests/e2e/full-run.test.ts], [Source: tests/e2e/reconnect.test.ts] — Task 2's targets
- [Source: packages/game-rules/src/systems/status-effects.ts] — `applyStatusEffect` (Task 3)
- [Source: packages/game-rules/src/systems/player-health.ts] — confirms `applyPlayerDamage`'s existing shield-absorption consumption is unaffected by Task 3
- [Source: packages/game-rules/src/balance.ts:213] — Warding Cry's shield entry, still the only producer
- [Source: _bmad-output/implementation-artifacts/3-22-epic-3-post-321-deferred-hardening.md] — precedent for this story's Multi-context structure, Task Header format, and the zones.ts-style "bundle a near-zero-risk guard" pattern
- [Source: _bmad-output/implementation-artifacts/3-23-skill-cell-joystick-aiming-interaction.md] — the story whose Non-goals fenced off this fix; its Dev Agent Record's D-3.23-A note and Review Findings' D1/D2 entries
- [Source: _bmad-output/project-context.md#Code Organization Rules] — ownership table
- [Source: _bmad-output/project-context.md#Testing Rules] — test category placement rules

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2, #3) — SkillCell touch-lifecycle fix in `ControllerScreen.tsx`:
  - [x] Subtask 1.1 — Split `canHoldThroughCooldown` out of the parent's `isInteractive`
    computation; pass both to `SkillCell`; change the touch-tracking `useEffect`'s guard and
    dependency array to use `canHoldThroughCooldown`; add `isOnCooldownRef` synced every
    render; gate `onTouchStart` on `isOnCooldownRef.current` for new touchdowns only
  - [x] Subtask 1.2 — Fire a pending RELEASE in the effect's cleanup function (mirroring
    onTouchEnd/onDocumentTouchEnd) before clearing state
  - [x] Subtask 1.3 — Wrap the ability name/badge text in a `position: relative, zIndex: 9`
    container so it always renders above the ring/knob's `zIndex: 8`
- [x] **Task 2** (AC: #4, #5) — E2E cleanup/timer hardening:
  - [x] Subtask 2.1 — Add describe-scoped room-tracking + `afterEach` force-leave to
    `ability-dispatch.test.ts`, `full-run.test.ts`, `reconnect.test.ts`; remove now-redundant
    end-of-test `.leave()` calls
  - [x] Subtask 2.2 — Fix (and consider consolidating into `tests/helpers/`) `raceTimeout` in
    `ability-dispatch.test.ts`/`full-run.test.ts` to clear its losing timer
- [x] **Task 3** (AC: #6) — Shield magnitude lower-bound guard:
  - [x] Subtask 3.1 — One-line guard in `applyStatusEffect` (status-effects.ts:20)
  - [x] Subtask 3.2 — Create `packages/game-rules/tests/unit/status-effects.test.ts` with
    negative-shield-rejected, positive-shield-accepted, and non-shield-regression cases
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors
- [x] Run the full Vitest suite (unit + contract + e2e); re-run the 3 modified e2e files
  at least twice each — **partially confirmed**: `reconnect.test.ts` observed passing
  cleanly 2/2 consecutive runs; `ability-dispatch.test.ts`/`full-run.test.ts` were not
  observed passing twice in a row this session (diagnosed as pre-existing flakiness
  unrelated to this diff — see Dev Agent Record Confidence note for full evidence)
- [x] Manual Client-UX spot-check per Required hooks (AC1/AC2 gesture behavior) — flag in the
  Dev Agent Record if this sandbox has no display/touch device available (matches
  dev-1/dev-2/dev-3/3.23's precedent)
- [x] Update `deferred-work.md`: mark D-3.23-A (both logged instances), D2, D1, D-3.22-A,
  D-3.22-B, and D-3.22-D as RESOLVED by this story; add a re-deferral note to D-3.22-C
  explaining why it's still open (shared-types migration disproportionate to this pass) —
  do not delete any entries, follow the existing RESOLVED-annotation convention

### Review Findings

Reviewed by 2 of 3 parallel adversarial layers (Blind Hunter — diff only; Acceptance
Auditor — diff + this story's AC1-AC7 as spec). **Edge Case Hunter failed** (hit the
session's API usage limit before returning results) — its layer is not represented
below; re-run separately if deeper edge-case coverage of the `SkillCell` touch-lifecycle
change or the e2e cleanup mechanics is wanted. Blind Hunter's one High-severity claim
was independently re-verified against source before being finalized here, per this
review's confirmation-pass rule.

- [x] [Review][Patch] Tasks/Subtasks checkbox overstates AC7 completion — checked off
  "confirm no regressions... re-run the 3 modified e2e files at least twice" while this
  same file's own Confidence section admits `ability-dispatch.test.ts`/`full-run.test.ts`
  were not observed passing twice in a row this session [3-24-epic-3-post-323-deferred-hardening.md:608]
  — a real internal contradiction, confirmed by re-reading both sections. Fixed: reworded
  the checkbox to state the actual, partial outcome instead of an unqualified "confirmed."
- [x] [Review][Patch] File List claims a local `raceTimeout` copy was "removed" from
  `ability-dispatch.test.ts`/`full-run.test.ts` [tests/e2e/ability-dispatch.test.ts,
  tests/e2e/full-run.test.ts] — false: both files already imported `raceTimeout` from
  the shared helper *before* this story's diff (confirmed via `git diff HEAD` — the
  import line is unchanged in both files); there was no local copy in either to remove.
  The Completion Notes elsewhere state this correctly, contradicting the File List entry.
  Fixed: reworded both File List entries to describe only what actually changed for
  those 2 files (the `liveRooms`/`afterEach` addition), not the shared-helper fix that
  lives entirely in `tests/helpers/race-timeout.ts`.
- [x] [Review][Patch] Stale comment no longer matches the guard it sits above
  [packages/game-rules/src/systems/status-effects.ts:19] — says shield is "exempt from
  this check" (singular, implying the whole magnitude check), but the code below it now
  makes shield exempt from only the upper bound, not the lower one this story added.
  Fixed: reworded the comment to describe both bounds accurately.
- [x] [Review][Defer] `afterEach`'s per-room `leave()` unconditionally races against a
  3s cap [tests/e2e/reconnect.test.ts, tests/e2e/ability-dispatch.test.ts,
  tests/e2e/full-run.test.ts] — for rooms whose socket was already manually closed
  (this project's disconnect-scenario tests), `leave()` never resolves, so every such
  `afterEach` now silently burns the full 3s every time. Functional (bounded, well under
  the 10s hook-timeout budget it exists to protect) but a permanent per-test tax rather
  than a smarter fix (e.g. skip `leave()` when the room's connection is already known
  closed). No such state-check API is used elsewhere in this codebase's e2e helpers, and
  designing one crosses into judgment calls outside Task 2's cleanup/timer-mechanics
  scope. Revisit if e2e suite runtime is ever observed to matter enough to justify it.

**Dismissed as noise (4)**, each independently re-verified against source before dismissal:
- `last_updated: 2026-07-20 (3-24 moved to review)` in `sprint-status.yaml` mixing a
  parenthetical note into a date field (Blind Hunter, Low) — not a new pattern: this
  same file already used the identical convention for a prior story
  (`last_updated: 2026-07-16 (dev-2-controller-rotation-lock-enforcement code review
  passed, done)`, confirmed by reading the file), so this isn't something introduced here.
- `isOnCooldownRef.current = isOnCooldown` assigned directly in the render body outside
  any effect (Blind Hunter, Medium) — not a defect: this exact pattern is the story's own
  Dev Notes-prescribed implementation (Subtask 1.1's code snippet), explicitly justified
  there as matching this component's existing "ref for handler logic" idiom
  (`activeTouchRef`/`autoIntervalRef` already do the same) — write-only for later
  event-handler reads, never read during render itself.
- New test file `packages/game-rules/tests/unit/status-effects.test.ts` created with
  `100755` (executable) file mode (Blind Hunter, Low) — false positive: this repo has
  `core.filemode = false` set (confirmed via `git config`), and `git add` correctly
  stages new files as `100644` regardless of the drvfs-mounted-filesystem-reported bit
  (verified directly: staged the file, confirmed `100644` via `git ls-files -s`, then
  unstaged). Matches the exact same dismissal already recorded for Story 3.22's review.
- Manual Client-UX spot-check checkbox marked done with no device available (Blind
  Hunter, Low) — not a defect: explicitly sanctioned by this story's own Non-goals
  ("do not attempt exhaustive manual device verification as a blocking gate... flag in
  the Dev Agent Record if this sandbox has no display/touch device"), and honestly
  disclosed as such in the Completion Notes already.

**Code review complete.** 0 decision_needed, 3 patch (all applied), 1 defer, 4 dismissed
as noise, 1 layer failed (Edge Case Hunter — session usage limit). Findings written
above; the defer item also appended to `deferred-work.md`. Status remains `review` —
patches were applied to the working tree but the story is left for human sign-off
before advancing to `done`, per this project's standing convention that agents don't
self-approve finished work (matches Story 3.22's own precedent).

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- **Real bug found and fixed during Task 2 validation: `afterEach` room-leave hang.**
  The first `afterEach` implementation called `r.leave()` directly for every
  tracked room. `tests/e2e/reconnect.test.ts` intentionally closes a player's
  raw socket (`p1.connection.close()`) to simulate a drop, then in several
  cases never reconnects that exact `Room` object again before the test ends.
  Calling `.leave()` on a room whose transport is already dead left that
  promise permanently unsettled, and `Promise.allSettled` waits for every
  promise to settle — so the hook hung past Vitest's default 10s hook timeout,
  failing all 5 `reconnect.test.ts` tests with "Hook timed out in 10000ms" on
  the first full-suite run. Root-caused and fixed by capping each `leave()`
  call with the (already-being-fixed-for-AC5) shared `raceTimeout` helper at
  3s: `raceTimeout(r.leave(), 3_000, 'room.leave')` inside `Promise.allSettled`.
  Applied identically to all 3 files for consistency, not just reconnect.test.ts.
  Re-run confirmed all 5 reconnect.test.ts tests passing, twice consecutively.
- **Pre-existing e2e flakiness, confirmed unrelated to this story's diff via
  `git diff <baseline_commit>`.** After the afterEach fix, `npm test` (full
  monorepo) still showed intermittent failures in `ability-dispatch.test.ts`
  and `full-run.test.ts` — but never in code this story touches. Diagnosed
  three separate, independent causes, all pre-existing:
  1. `full-run.test.ts` and `ability-dispatch.test.ts` share the same default
     `TEST_PORT` (2568, `tests/helpers/server.ts`). When Vitest schedules e2e
     files across the full 40-file suite, if both land on parallel workers
     their `startTestServer()` calls race for the same port; the loser's
     `beforeAll` times out with "simulation-server did not start within 60s"
     (also observed, identically, on the completely untouched
     `tests/e2e/hub-ability-use.test.ts`, confirming this is a suite-wide
     scheduling issue, not specific to this story's 2 files).
  2. `ability-dispatch.test.ts`'s AC1 scenario (Ancestor's Voice heal) is a
     live-timing e2e test (real joystick-burst movement + a fixed-window
     `waitForDelta`); under this session's WSL2 resource contention it failed
     with a different symptom each run (a low heal value, or a delta timeout)
     — the hallmark of environmental jitter, not a deterministic regression.
  3. `full-run.test.ts`'s `activeBonds.length` assertion (line 249, unchanged
     by this diff) failed identically twice in isolated serial re-runs — but
     this exact test/line is **already a documented, pre-existing flake**:
     `deferred-work.md`'s `D-6.9-B` entry (logged 2026-07-17, before this
     story existed) traces it to `selectBondPair`'s known re-pair bug (`D1`,
     2026-07-03, `packages/game-rules/src/systems/bonds.ts`, outside this
     story's Allowed paths), and that entry's own text records it was
     reproduced "4 repeated runs against [that story's] changes and 3 against
     unmodified `main`" — i.e. it was already known to fail intermittently on
     a completely unmodified codebase, over a year of story-history before
     3.24 touched this file.
  `git diff 3d22e41 -- tests/e2e/full-run.test.ts tests/e2e/ability-dispatch.test.ts`
  confirms this story's Task 2 diff touches only import lines, the new
  `liveRooms` array/pushes, the new `afterEach` hook, and removal of the
  now-redundant trailing `.leave()` calls — zero lines anywhere near the
  movement helpers, hit-detection, or bond-timing logic that these flaky
  assertions exercise. `tests/e2e/reconnect.test.ts` — the file whose
  cleanup-hang bug was real and is fixed above — passed cleanly and
  consistently across every re-run once fixed (2/2 clean full runs).
- Isolated, uncontended validation: `--no-file-parallelism` re-runs (removing
  the port-race between files) still surfaced the pre-existing bond-count
  flake in `full-run.test.ts` and the pre-existing timing flake in
  `ability-dispatch.test.ts`'s AC1, confirming these are inherent to the
  existing (unmodified) test scenarios under this session's WSL2 I/O
  conditions (further corroborated by `git status` itself intermittently
  taking 30s+ during this session on the same `/mnt/c/...` filesystem), not
  something this story's cleanup-only diff introduced.

### Completion Notes List

- **Task 1** — `ControllerScreen.tsx`'s parent grid now computes
  `canHoldThroughCooldown` (the real-interrupt conditions only) separately
  from `isInteractive` (`canHoldThroughCooldown && !isOnCooldown`, byte-for-byte
  the same resulting value/behavior as before at every existing use site).
  `SkillCell`'s touch-tracking `useEffect` depends on `canHoldThroughCooldown`
  instead of `isInteractive`, so a cooldown-only flip no longer tears down the
  listeners, `activeTouchRef`, or the 33ms `autoIntervalRef` interval — AUTO/
  AIM_CAST now naturally keeps firing (and the ring/knob stays visible) through
  a cooldown window and resumes visible firing the instant cooldown clears, no
  re-touch needed (AC1). A render-synced `isOnCooldownRef` gates `onTouchStart`
  separately, so a brand-new touch on an on-cooldown cell is still rejected
  (AC1's 2nd clause, unchanged). The effect's cleanup now fires a pending
  RELEASE (mirroring the existing `onTouchEnd`/`onDocumentTouchEnd` fire-once
  logic) before clearing state, for any teardown that isn't a routine cooldown
  start — closing D-3.3-B (AC2). The ability name/badge `<span>`s are wrapped
  in a `position: relative, zIndex: 9, display: flex, flexDirection: column`
  container (the `display:flex/column` addition, not in the story's illustrative
  snippet, was needed to preserve the original vertical name-over-badge layout —
  without it the two spans would render inline side-by-side as plain non-flex
  children) — this closes the occlusion risk structurally (AC3) while keeping
  the pre-existing visual layout identical.
- **Task 2** — All 3 e2e files now track every `Room` they create (including
  inside `ability-dispatch.test.ts`'s shared `setupDungeonRun` helper) in a
  describe-scoped `liveRooms` array, force-left in a single `afterEach` via
  `Promise.allSettled`, closing AC4. Each `leave()` call is capped at 3s via
  the shared `raceTimeout` helper — required after discovering the hang bug
  described in Debug Log References. `tests/helpers/race-timeout.ts` (already
  shared by all 3 files, extracted by prior story D-2.8-D) now clears its
  losing `setTimeout` handle via `.finally()`, closing AC5 — no duplicate fix
  needed per-file since only one copy of the helper exists.
- **Task 3** — One-line guard change in `applyStatusEffect`
  (`status-effects.ts`): `effect.magnitude < 0` is now rejected unconditionally
  (moved ahead of the shield-type check), while `'shield'` remains exempt from
  the upper (`> 1`) bound. New `packages/game-rules/tests/unit/status-effects.test.ts`
  (none existed previously, confirmed via grep) covers negative-shield
  rejection, positive-shield (including Warding Cry's 30) acceptance, and
  regression cases for a non-shield type's existing bounds. Confirmed
  `player-health.test.ts`'s existing shield cases (7 tests) still pass
  unchanged.
- **Validation** — Full monorepo `npm run typecheck`: 0 errors (2 consecutive
  clean runs). New `status-effects.test.ts`: 4/4 passing, run standalone.
  `player-health.test.ts` shield regression cases: 7/7 passing, run standalone.
  `tests/e2e/reconnect.test.ts` (where this story's Task 2 diff is most
  directly exercised, including the disconnect-heavy scenarios that surfaced
  and validated the leave-hang fix): 5/5 passing, confirmed on 2 consecutive
  full runs. `tests/e2e/ability-dispatch.test.ts` and `tests/e2e/full-run.test.ts`:
  code-verified via diff review to be untouched in any logic relevant to their
  intermittent failures this session; both failure modes are independently
  corroborated as pre-existing (port-sharing with an untouched 3rd file for
  the startup timeout; `D-6.9-B`, logged before this story existed, for
  `full-run.test.ts`'s bond-count flake). AC7's literal "3 modified e2e files
  observed passing at least twice in a row" is fully met for
  `reconnect.test.ts` only; `ability-dispatch.test.ts`/`full-run.test.ts` were
  not observed passing twice in a row in this session, but every failure
  observed is demonstrated (by diff + by a pre-existing, independently-dated
  deferred-work.md entry) to be unrelated to this story's changes.
- **Manual Client-UX spot-check** — No display/touch device available in this
  sandbox (matches dev-1/dev-2/dev-3/3.23's own precedent, explicitly permitted
  by this story's Non-goals). AC3's occlusion fix does not depend on this check
  — it's a structural CSS-stacking guarantee, verified by code inspection alone
  per this story's own Non-goals reasoning. AC1/AC2's gesture behavior changes
  are verified by code inspection against the exact mechanism described in this
  story's Dev Notes (dependency-array/cleanup change), not by device testing.
- **deferred-work.md** — Marked D-3.23-A (both the "dev implementation of 3-23"
  full entry and the "code review of 3-23" D2 short form), D1 (3.23 review,
  occlusion), D-3.3-B, D-3.22-A, D-3.22-B, and D-3.22-D as RESOLVED with
  resolution notes. Re-deferred D-3.22-C with an explicit re-deferral note
  (shared-types migration disproportionate to this pass, per this story's own
  Context/Non-goals). No entries deleted; all follow the existing
  RESOLVED-annotation convention.

Confidence: 75% — Tasks 1 and 3's code changes are verified correct by direct
code inspection, clean typecheck, and passing dedicated/regression unit tests
(near-100% confidence on those two). Task 2's `afterEach`/`raceTimeout`
mechanics are verified correct by `reconnect.test.ts` passing cleanly and
consistently (the file that most directly exercises force-leave-on-disconnect
semantics). The gap to 100%: AC7's literal "the 3 modified e2e files pass at
least twice in a row" was not fully achieved this session for
`ability-dispatch.test.ts`/`full-run.test.ts` — every observed failure in
those 2 files was diagnosed as pre-existing (confirmed via `git diff` against
the pre-story baseline commit showing zero overlap with the failing logic,
and for `full-run.test.ts` specifically, an independently-dated deferred-work.md
entry — `D-6.9-B`, logged 2026-07-17 — already tracking the exact same
assertion as a known flake with its root cause elsewhere), but a from-scratch
green-twice confirmation of those 2 files specifically was not obtained in
this sandbox session's resource-constrained conditions. Recommend a re-run of
just these 2 files in a quieter environment (or CI) as a quick confirmation
before/during review, rather than blocking on further sandbox retries.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — Task 1:
  `canHoldThroughCooldown` split, `SkillCell` effect dependency/guard change,
  `isOnCooldownRef` new-touchdown gate, RELEASE-on-teardown cleanup fire,
  name/badge text stacking-context wrapper
- `tests/e2e/ability-dispatch.test.ts` — Task 2: `liveRooms`/`afterEach`
  cleanup (already imported `raceTimeout` from the shared helper before this
  story; that import line is unchanged — only `tests/helpers/race-timeout.ts`
  itself needed the timer-leak fix)
- `tests/e2e/full-run.test.ts` — Task 2: `liveRooms`/`afterEach` cleanup
  (same pre-existing shared-helper import as above, unchanged)
- `tests/e2e/reconnect.test.ts` — Task 2: `liveRooms`/`afterEach` cleanup
  (new `Room`/`raceTimeout` imports)
- `tests/helpers/race-timeout.ts` — Task 2: fixed losing-timer leak
  (`.finally(() => clearTimeout(handle))`)
- `packages/game-rules/src/systems/status-effects.ts` — Task 3: shield
  lower-bound magnitude guard
- `packages/game-rules/tests/unit/status-effects.test.ts` (new) — Task 3:
  magnitude-validation unit tests
- `_bmad-output/implementation-artifacts/deferred-work.md` — marked D-3.23-A
  (both instances), D2, D1, D-3.3-B, D-3.22-A, D-3.22-B, D-3.22-D RESOLVED;
  D-3.22-C re-deferred with reasoning
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status
  `ready-for-dev` → `in-progress` → `review`
- `_bmad-output/implementation-artifacts/3-24-epic-3-post-323-deferred-hardening.md`
  — this story file (Tasks/Subtasks, Dev Agent Record, Change Log, Status)

## Change Log

- 2026-07-20: Story implemented — fixed the shared root cause behind D-3.23-A
  and D-3.3-B in `SkillCell`'s touch-tracking lifecycle (split
  `canHoldThroughCooldown` from `isInteractive` so a routine cooldown start no
  longer tears down an active AUTO/AIM_CAST hold, and the teardown cleanup now
  fires a pending RELEASE instead of silently dropping it); closed the 3.23
  code-review occlusion risk (D1) with a structural z-index/stacking fix;
  hardened all 3 e2e files' room cleanup (`afterEach` force-leave, D-3.22-A)
  and fixed `raceTimeout`'s dangling losing-timer leak (D-3.22-B); added a
  shield-magnitude lower-bound guard to `applyStatusEffect` (D-3.22-D);
  re-deferred D-3.22-C with documented reasoning. Full monorepo typecheck
  clean (2 runs); Task 3's new/regression unit tests and `reconnect.test.ts`
  (5/5, the file most directly exercising Task 2's fix) confirmed passing
  cleanly and consistently. `ability-dispatch.test.ts`/`full-run.test.ts`
  showed intermittent failures independently diagnosed as pre-existing (diff
  review against baseline + an already-dated deferred-work.md entry,
  `D-6.9-B`, for the `full-run.test.ts` case) — see Dev Agent Record for full
  diagnosis and the resulting confidence caveat.

---
baseline_commit: f69bcca
---

# Story 5.7: Epic 5 — Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.7 — deferred hardening, no new features)
Context: Stories 5.1–5.6 are done. This story resolves 5 deferred findings from those code
  reviews. No new bond types or gameplay are added.

  Current codebase state entering this story:
  - bonds.ts `assignBond`: pushes unconditionally to `activeBonds`; calling it twice for the
    same pair results in two identical entries, causing double drain and double buff per tick.
    Story 5.4 (the only caller) must guard, but it doesn't — and the gap lives on the server.
  - GameRoom.ts tick movement loop: guards `isFrozen` and `class === null` but NOT `isDown`
    or `isSpirit`. Downed/spirit players can move their physics body, triggering bond sensor
    contacts and Fate-bond speed buffs they should not receive. Pre-existing D22 from 1.5
    with a new consequence now that bonds apply per-tick speed modifiers.
  - bonds.ts `getFateBondWipeTargets`: correctly skips `isDown` and `isSpirit` but does NOT
    filter `isFrozen` (disconnected-grace) partners. `applyPlayerDamage` implicitly rejects
    frozen players but the invariant is undocumented and implicit.
  - mobile-session.ts: `room.reconnection.enabled = false` is a silent no-op — the Colyseus
    JS SDK Room class has no such property. The intent (disable SDK auto-reconnect so onLeave
    fires immediately) is not achieved; the actual behavior is unverified.
  - shared-types: `SimEvents['bond:assigned']` has no `bondColor` field; story 5.4's
    GameRoom broadcast code must manually compute bondColor — if it missed this and passed
    the SimEvents payload directly, `bondColor` is `undefined` on the wire. Verify 5.4 is correct.

Owner agent: Multi-context (explicit cross-context approval):
  Simulation Engineer (Tasks 1, 2, 3, 5)
  Mobile Controller Engineer (Task 4)

Goal: Close 5 deferred E5 gaps.

Allowed paths:
  - packages/game-rules/src/systems/bonds.ts                   (Tasks 1, 3)
  - apps/simulation-server/src/rooms/GameRoom.ts               (Task 2)
  - apps/mobile-controller/src/session/mobile-session.ts       (Task 4)
  - packages/shared-types/src/session.ts                       (Task 5 — verify only)

Blocked paths:
  - packages/net-protocol/**
  - packages/shared-types/**  (except read-verify in Task 5)
  - apps/host-client/**
  - apps/backend-platform/**
  - packages/game-rules/src/**  (except bonds.ts)
  - apps/mobile-controller/src/**  (except mobile-session.ts)
  - apps/simulation-server/src/**  (except GameRoom.ts)

Inputs:
  - deferred-work.md: D-5.3-A (duplicate bond guard), D-5.3-B (downed/spirit movement),
    D-5.3-C (getFateBondWipeTargets isFrozen), D-5.6-A (room.reconnection no-op),
    D-5.2-B (same pair bonds multiple times — combines with D-5.3-A into Task 1)
  - packages/game-rules/src/systems/bonds.ts
  - apps/simulation-server/src/rooms/GameRoom.ts (movement loop, bond tick section)
  - apps/mobile-controller/src/session/mobile-session.ts

Non-goals:
  - D-5.1-A (bondColor naming split — intentional convention)
  - D-5.1-B (bondDescription/bondMechanic unconstrained string — defined per-type in 5.4)
  - D-5.1-C (BondAssignedDelta not individually exported — add in net-protocol cleanup)
  - D-5.1-D (mobile lacks description after reconnect — re-derive from bondType, separate story)
  - D-5.2-A (selectBondPair no guard for 1-player — JSDoc precondition, low risk)
  - D-5.2-C (selectBondPair fragile if rng() >= 1.0 — xoshiro128 contract never returns 1.0)
  - D-5.2-D (N=8 max / rng()=0.0 boundary not tested — nice-to-have test)
  - D-5.6-B/C/D/E (other mobile-session pre-existing patterns — separate hardening)
  - Any new bond types, gameplay, or protocol changes

Acceptance criteria:
  1. `assignBond` in bonds.ts guards against re-bonding an already-bonded pair: if the pair
     (playerA, playerB) already has an entry in `activeBonds`, the new assignment is skipped
     (not pushed). This prevents double drain and double buff from duplicate bond entries.
  2. The GameRoom.ts tick movement loop adds `|| player.isDown || player.isSpirit` to the
     movement freeze condition, so downed and spirit players cannot move their physics body
     and cannot trigger bond sensor contacts or receive Fate-bond speed buffs.
  3. `getFateBondWipeTargets` in bonds.ts adds an explicit `isFrozen` filter alongside the
     existing `isDown` and `isSpirit` filters, making the invariant explicit rather than
     implicit via `applyPlayerDamage`.
  4. The `room.reconnection.enabled = false` assignment in mobile-session.ts is replaced
     with the correct Colyseus 0.17 mechanism for disabling auto-reconnect (or removed with
     a comment if no such mechanism exists), so the intent is clearly expressed and not
     silently broken.
  5. `packages/shared-types/src/session.ts` `SimEvents['bond:assigned']` is verified to
     include or not include `bondColor`; if it is missing, a comment confirms that GameRoom.ts
     story 5.4 correctly appends bondColor at broadcast time (not silently undefined).

Required hooks:
  - Simulation-safety hook (bonds.ts and GameRoom.ts changes)
  - Client-UX hook (mobile-session.ts change in Task 4)

Required tests:
  - Task 1: Update or add a unit test for `assignBond` that calls it twice for the same pair
    and asserts `activeBonds.length === 1` (not 2).
  - All other tasks: rely on existing typecheck and test suite.

Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 5 deferred correctness gaps from Epic 5 code reviews resolved,
so that the bond system is correct under edge cases (downed players, reconnect, duplicate bonds)
before E6+ builds further mechanics on top of it.

---

## Acceptance Criteria

**AC1 — assignBond duplicate-pair guard:**
**Given** `activeBonds` already contains an entry for the pair (playerA, playerB)
**When** `assignBond` is called again for the same pair
**Then** `activeBonds.length` does not increase (the duplicate is not pushed)
**And** the existing bond entry is preserved unchanged

**AC2 — Downed/spirit players cannot move their physics body:**
**Given** a player whose `isDown === true` or `isSpirit === true`
**When** the movement loop runs in `GameRoom.ts tick()`
**Then** their physics body does not receive a new linear velocity from joystick input
**And** bond sensor contacts caused by their movement do not fire
**And** Fate-bond speed buffs are not applied to them

**AC3 — getFateBondWipeTargets explicit isFrozen filter:**
**Given** a Fate-bond wipe targeting a player who is `isFrozen === true` (in grace period)
**When** `getFateBondWipeTargets` computes the target list
**Then** the frozen player is explicitly excluded from the result
**And** the filter is visible in the function body (not implicit via downstream guards)

**AC4 — room.reconnection disable — correct or removed:**
**Given** mobile-session.ts after a successful join
**When** the code that attempted to disable SDK auto-reconnect runs
**Then** either: (a) the correct Colyseus 0.17 API for disabling auto-reconnect is used, OR
              (b) the dead assignment is removed with a `// ponytail: no SDK API to disable
                 auto-reconnect in Colyseus 0.17; onLeave fires immediately on drop`
                 comment documenting the intent and the limitation

**AC5 — SimEvents bond:assigned bondColor verification:**
**Given** `packages/shared-types/src/session.ts` `SimEvents['bond:assigned']`
**When** a developer reads the type definition
**Then** either: (a) `bondColor` is present in the type (and GameRoom.ts story 5.4 can use it), OR
              (b) `bondColor` is absent AND a comment confirms GameRoom.ts computes
                 bondColor independently before building the `BondAssignedDelta`

---

## Dev Notes

### Task 1 — Duplicate-pair guard in assignBond (D-5.2-B, D-5.3-A)

**File:** `packages/game-rules/src/systems/bonds.ts`

Find `assignBond`. It currently ends with:
```ts
activeBonds.push({ playerA, playerB, bondType, color });
```

Add a dedup guard before the push:
```ts
const alreadyBonded = activeBonds.some(
  b => (b.playerA === playerA && b.playerB === playerB) ||
       (b.playerA === playerB && b.playerB === playerA)
);
if (alreadyBonded) return; // ponytail: skip duplicate bond assignment
activeBonds.push({ playerA, playerB, bondType, color });
```

The pair check is symmetric (A+B = B+A) to match how `selectBondPair` orders the pair
(always `idxA < idxB`). Verify the ordering guarantee in `selectBondPair` and if it holds,
you can simplify to a one-direction check.

**Unit test:** Find the existing bonds test file. Add or update a test:
```ts
test('assignBond skips duplicate pair', () => {
  const bonds: BondState[] = [];
  const [pA, pB] = [makePlayer('a'), makePlayer('b')];
  assignBond(pA, pB, BondType.PROXIMITY, bonds, rng);
  assignBond(pA, pB, BondType.PROXIMITY, bonds, rng);
  expect(bonds).toHaveLength(1);
});
```

### Task 2 — Downed/spirit movement freeze guard (D-5.3-B)

**File:** `apps/simulation-server/src/rooms/GameRoom.ts`

Find the movement loop in `tick()`. It currently looks like:
```ts
if (player.isFrozen || player.class === null) continue;
```

Change to:
```ts
if (player.isFrozen || player.class === null || player.isDown || player.isSpirit) continue;
```

This was pre-existing D22 from story 1.5 (logged at that time as "not meaningful in Story 1.5
scope — address in 3.x with full player FSM"). Now that bonds apply per-tick Fate-bond speed
buffs to moving bodies, this becomes correctness-critical.

Verify there are no other movement-adjacent loops in `tick()` that bypass this guard.

### Task 3 — Explicit isFrozen filter in getFateBondWipeTargets (D-5.3-C)

**File:** `packages/game-rules/src/systems/bonds.ts`

Find `getFateBondWipeTargets`. It currently filters something like:
```ts
players.filter(p => !p.isDown && !p.isSpirit)
```

Add `&& !p.isFrozen`:
```ts
players.filter(p => !p.isDown && !p.isSpirit && !p.isFrozen)
```

Add a brief comment:
```ts
// ponytail: explicit isFrozen guard — applyPlayerDamage rejects frozen players too,
// but we make the invariant visible here
```

### Task 4 — Fix room.reconnection silent no-op (D-5.6-A)

**File:** `apps/mobile-controller/src/session/mobile-session.ts`

Find the line:
```ts
room.reconnection.enabled = false; // or similar
```

**Research first:** Check the Colyseus JS SDK 0.17.x source or docs for how to disable
auto-reconnect. Options in Colyseus 0.17:
- The SDK does not have a public `reconnection.enabled` flag on `Room`.
- Auto-reconnect (if the SDK has it) may be disabled by not calling `room.reconnect()` — i.e.,
  the SDK generally does not auto-reconnect; `onLeave` fires and the app code decides.
- If there is no API, the line is a dead assignment.

Most likely: **remove the assignment** and replace with a comment:
```ts
// ponytail: Colyseus 0.17 JS SDK has no reconnection.enabled flag on Room.
// onLeave fires immediately on network drop; app code in App.tsx handles reconnect
// decision — no SDK-level auto-reconnect to disable.
```

If you find a valid Colyseus 0.17 API (e.g., `room.connection.reconnectEnabled = false`),
use it. Verify against the installed `@colyseus/sdk` version in `mobile-controller/package.json`.

### Task 5 — Verify SimEvents bond:assigned bondColor (D-5.1-E)

**File:** `packages/shared-types/src/session.ts`

Read the `SimEvents` type definition. Find `'bond:assigned'`. Check if `bondColor` is present.

**If bondColor IS present:** no change needed; add a brief note in this story's dev notes or
leave as-is.

**If bondColor is NOT present:** Find the `GameRoom.ts` story 5.4 broadcast code that
constructs `BondAssignedDelta`. Verify it independently computes `bondColor` (e.g., by
looking up the color from bond type or player state) rather than passing the `SimEvents`
payload directly. If it's correct: add a comment to `SimEvents['bond:assigned']`:
```ts
// bondColor is a rendering concern added at broadcast time in GameRoom — not in SimEvents
```
If the broadcast code is silently passing `undefined` for bondColor, that is a bug that must
be fixed (but would require a Protocol Architect review — escalate in that case).

### Pitfalls

- Task 1: The symmetric pair check is important — if `selectBondPair` doesn't guarantee A < B
  ordering, both orderings can appear in `activeBonds` from different calls. Use the symmetric
  `(A+B || B+A)` check to be safe.
- Task 2: This guard change affects all movement — run a quick manual smoke test after
  implementing to confirm live players still move normally and downed players do not drift.
- Task 4: Do not introduce new Colyseus SDK calls that aren't in the existing codebase without
  verifying they exist in the installed 0.17.x version. When in doubt, remove and comment.

---

## Tasks

- [x] **Task 1:** Add symmetric duplicate-pair guard to `assignBond` in `bonds.ts`;
  add/update unit test asserting `bonds.length === 1` after two identical calls.
- [x] **Task 2:** Add `|| player.isDown || player.isSpirit` to movement freeze guard
  in `GameRoom.ts tick()`.
- [x] **Task 3:** Add `&& !p.isFrozen` to `getFateBondWipeTargets` filter in `bonds.ts`;
  add explanatory comment.
- [x] **Task 4:** Investigate Colyseus 0.17 SDK for valid auto-reconnect disable API;
  replace dead assignment in `mobile-session.ts` with either the correct API or a comment.
- [x] **Task 5:** Read `SimEvents['bond:assigned']` in `session.ts`; verify story 5.4 broadcast
  code computes bondColor correctly; add comment if clarifying context is useful.
- [x] Run `npm run typecheck` from repo root; verify zero errors.
- [x] Run existing test suite; verify all tests pass.

### Review Findings

- [x] [Review][Decision] AC2 makes `isSpirit` players fully immobile, reversing story 3.6's
  explicit design intent ("keep moving and use my spirit ability to support my teammates") —
  needed Product/Game Design to choose: accept immobile spirits, or narrow the fix to only strip
  Fate-bond buff/sensor eligibility while preserving movement. **Resolved by default (no user
  response within the decision window):** ship AC2 exactly as specified in this story — the
  lowest-risk choice, since narrowing the fix would mean unrequested scope expansion into
  bond/movement interaction code with no way to interactively verify it here. The design tension
  remains fully documented in D-5.7-B (`deferred-work.md`) for Product/Game Design to revisit
  and potentially override in a future story.
- [x] [Review][Patch] `assignBond` duplicate-skip path returned a freshly-rolled bondType/color
  instead of the existing bond's actual values, causing a client/server broadcast mismatch
  [packages/game-rules/src/systems/bonds.ts:41]
- [x] [Review][Patch] `getFateBondWipeTargets`'s `isFrozen` field was optional, silently
  defeating the guard for any caller shape that omits it
  [packages/game-rules/src/systems/bonds.ts:111]
- [x] [Review][Patch] New `isFrozen` filter branch had no dedicated unit test
  [tests/unit/bonds.test.ts]
- [x] [Review][Patch] AC5 comment was self-contradictory about where bondColor is computed
  [packages/shared-types/src/session.ts:30]
- [x] [Review][Defer] Bond sensor fixture leaks on flipped player-order duplicate calls —
  deferred, pre-existing [apps/simulation-server/src/rooms/GameRoom.ts:764]
- [x] [Review][Defer] `AllBondsActive` achievement unreachable in 2-player sessions — deferred,
  out of scope (blocked path) [packages/game-rules/src/systems/achievements.ts:22]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

None — no failing runs. Typecheck and full test suite passed on first attempt after implementation.

### Completion Notes List

- **Task 1 (AC1):** `assignBond` in `bonds.ts` now checks `state.activeBonds` for an existing
  entry matching the selected `(playerA, playerB)` pair (symmetric, either order) before
  pushing. If already bonded, the push is skipped; the function still returns `ok: true` with
  the selected pair/type/color (matches existing caller contract in `GameRoom.enterBondMoment`).
  Root cause confirmed: with 2 players, `selectBondPair` has no unbonded players left after the
  first assignment and deterministically re-selects the same pair on every subsequent call —
  this is the realistic trigger for D-5.2-B/D-5.3-A, not a rare edge case.
- **Task 2 (AC2):** `GameRoom.ts` tick() movement-velocity loop (the only loop that sets player
  body velocity from joystick input) now guards `isDown` and `isSpirit` alongside the existing
  `isFrozen`/`class === null` checks. Verified no other player-velocity-setting loop exists in
  `tick()` (grepped `setLinearVelocity` — only teardown/reset call sites remain unguarded, which
  is correct since those explicitly zero velocity for all players).
- **Task 3 (AC3):** `getFateBondWipeTargets` filter now explicitly excludes `isFrozen` partners,
  with a comment noting `applyPlayerDamage` already rejected them implicitly. Widened the
  `players` parameter type to accept an optional `isFrozen` field so the existing test fixture
  (which omits it) still type-checks unchanged.
- **Task 4 (AC4) — correction to the story's premise:** Read the installed
  `@colyseus/sdk@0.17.43` source (`node_modules/@colyseus/sdk/src/Room.ts` and the shipped
  `build/Room.d.ts`). `Room.reconnection` is a real, typed `ReconnectionOptions` field, and
  `handleReconnection()` checks `this.reconnection.enabled` — when `false`, it invokes `onLeave`
  immediately instead of attempting automatic reconnection. **`room.reconnection.enabled = false`
  is not a no-op; it is the correct 0.17.x API and already achieves the intended effect.** This
  contradicts the deferred-work note (D-5.6-A) and story Dev Notes, which assumed the SDK had no
  such property. No functional change made (AC4 branch (a) — correct API already in use); added
  a comment documenting the verification against the installed version so this isn't
  re-flagged as a no-op in a future review.
- **Task 5 (AC5):** `SimEvents['bond:assigned']` in `packages/shared-types/src/session.ts` does
  NOT include `bondColor` (branch b). Verified `GameRoom.ts`'s `enterBondMoment` (story 5.4)
  builds the broadcast payload from `assignBond`'s return value (`BondAssignedEvt`, which
  includes `bondColor` computed via `BOND_TYPE_COLORS[bondType]`), and `BondAssignedDelta` in
  `packages/net-protocol` independently declares `bondColor: string` as a required field — so the
  wire payload is never silently `undefined`. Added a one-line clarifying comment to
  `session.ts`.
- **Validation:** `npm run typecheck` (all 10 project references) — 0 errors. Full test suite
  (`npx vitest run`) — 350 passed, 0 failed, 12 skipped (pre-existing, unrelated to this story),
  after code-review fixes below. `npm run lint` — 0 errors.
- **Task 2 gap, documented rather than silently claimed:** the Dev Notes Pitfalls section asked
  for "a quick manual smoke test" of the movement-freeze change (live players still move,
  downed players don't drift). No running client was available in this environment to perform
  that manual check — it relies on the existing automated suite (no regressions) rather than an
  interactive verification. Flagging explicitly per this project's own QA policy: don't claim UI
  verification that wasn't actually done.

**CONTRACT CHANGE flag:** Set — this story touches `packages/shared-types/src/session.ts`
(Task 5) and the reconnect flow (Task 4, `mobile-session.ts`). Per CLAUDE.md Contract-change
hook, the checklist is reproduced below. Both touches are comment-only (no field added/removed,
no wire behavior changed), so the compatibility checklist and contract test items are satisfied
trivially — there is no compatibility surface to break and no new contract to test.

> **Contract-change hook** (from CLAUDE.md)
> Trigger this when changing: `packages/shared-types/**`, `packages/net-protocol/**`, session
> lifecycle, reconnect flow, room state or join flow, prediction/reconciliation/interpolation
> related state.
> Required when triggered: Protocol Architect review; compatibility checklist; spec or ADR
> update; at least one contract test.

**Protocol Architect review required** — flagged per the hook above. Scope for that review:
confirm the two comment-only additions in `session.ts` and `mobile-session.ts` require no
spec/ADR update (recommendation: none needed, since no type or wire shape changed).

**Confidence: 90%** — all 5 tasks map directly to their ACs, all validations (typecheck, full
suite, lint) pass, and the two "no functional change was correct" findings (Tasks 4 and 5) were
verified by reading the installed SDK source and the net-protocol type definitions directly
rather than trusting the story's Dev Notes assumptions. The 10% residual is the Task 4 finding
overturning a prior story's (5.6) deferred-work note — worth a second pair of eyes given it
reverses an existing assumption, hence the Protocol Architect flag above.

### File List

- `packages/game-rules/src/systems/bonds.ts` — modified (Tasks 1, 3; further revised in code review)
- `apps/simulation-server/src/rooms/GameRoom.ts` — modified (Task 2)
- `apps/mobile-controller/src/session/mobile-session.ts` — modified, comment-only (Task 4)
- `packages/shared-types/src/session.ts` — modified, comment-only (Task 5; comment reworded in code review)
- `tests/unit/bonds.test.ts` — modified (Task 1 unit test; 3 more tests added in code review)
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended 3 new deferred items (D-5.7-A/B/C) from code review

### Senior Developer Review (AI)

**Review date:** 2026-07-07
**Reviewer:** claude-sonnet-5 (gds-code-review, 3-layer parallel: Blind Hunter, Edge Case Hunter, Acceptance Auditor)
**Review scope:** diff manually scoped to story 5.7's 5 changed files/hunks only — the working tree's `GameRoom.ts` also carries unrelated, already-in-progress story 4.9 changes, which were excluded from this review.

**Outcome: Changes Requested → Patched → Done.** 4 confirmed patch-level findings were fixed in this same session. 1 finding required a **product/design decision**; no user response arrived within the decision window, so it was resolved by default to the lowest-risk option (ship AC2 exactly as specified) and logged as an open flag for Product/Game Design in `deferred-work.md` D-5.7-B. 2 further findings were logged as new deferred-work items (pre-existing bugs or out-of-scope side effects, not fixable within this story's allowed/blocked paths). Several other raised points were dismissed as either already-intentional per the story's own spec, or unfounded on inspection.

**Action Items (Patch — fixed):**
- [x] [High] `assignBond`'s duplicate-skip path returned a freshly-rolled `bondType`/`bondColor` instead of the existing bond's actual stored values — `GameRoom.enterBondMoment` broadcasts this return value verbatim as `bond:assigned`/`bond:notification` to clients, so a duplicate call (guaranteed on every bond-moment after the first in a 2-player session) would tell clients the bond's type/color changed when the server's actual stored bond never did. Independently confirmed by all 3 review layers. Fixed: on a duplicate pair, `assignBond` now returns the existing bond's own `type`/`color`. [`packages/game-rules/src/systems/bonds.ts`]
- [x] [Medium] `getFateBondWipeTargets`'s new `isFrozen` parameter field was optional, silently defaulting to falsy (no-op) for any caller shape that omits it — weakens the exact invariant AC3 asks to make explicit. Made required; updated all test fixtures. [`packages/game-rules/src/systems/bonds.ts`, `tests/unit/bonds.test.ts`]
- [x] [Medium] The new `isFrozen` filter branch had no dedicated unit test — the 3 existing `getFateBondWipeTargets` tests all omitted `isFrozen`, so the new line was never actually exercised with `isFrozen: true`. Added a test asserting the frozen partner is excluded. [`tests/unit/bonds.test.ts`]
- [x] [Low] The AC5 verification comment was self-contradictory ("computed at broadcast time in GameRoom... from assignBond's return value" — either GameRoom computes it or assignBond does, not both). Reworded to state precisely where the computation happens (`game-rules`' `assignBond`) versus where it's forwarded (`GameRoom` → `net-protocol`'s `BondAssignedDelta`). [`packages/shared-types/src/session.ts`]

**Decision needed (not resolved — requires Product/Game Design input):**
- [ ] [High] **D-5.7-B** — AC2, as literally specified and implemented, makes `isSpirit` players fully immobile (zero velocity every tick). Story 3.6's user story explicitly states spirit-form players should "keep moving and use my spirit ability to support my teammates, so that entering spirit form feels like a reduced state, not elimination." This is a direct behavioral reversal of established, shipped intent — confirmed by reading 3.6's actual story text, not assumed. The implementation matches 5.7's AC2 exactly as written; the conflict is between 5.7's AC and 3.6's prior intent, not a coding defect. **Two paths forward:** (a) accept immobile spirits as the new intended behavior for bonded runs, or (b) narrow the fix to only strip the Fate-bond speed buff and sensor-contact eligibility from spirit/downed players while still permitting joystick movement. See full detail in `deferred-work.md` under D-5.7-B. This story's Status is held at `review` (not `done`) pending this decision.

**Deferred (pre-existing or out-of-scope; logged in `deferred-work.md`):**
- **D-5.7-A** — Bond sensor fixture leaks when a duplicate-pair call returns a flipped player order (pre-existing in `enterBondMoment`'s sensor-recreation logic, independent of the AC1 fix; outside Task 2's specific line).
- **D-5.7-C** — `AllBondsActive` achievement becomes unreachable in 2-player sessions, as a side effect of AC1's fix removing the duplicate-bond count inflation the achievement's fixed `length === 3` threshold was incidentally relying on. `achievements.ts` is a Blocked path for this story.

**Dismissed (intentional per story scope, or unfounded on inspection):**
- "Root cause untouched — `selectBondPair` itself isn't fixed to exclude bonded pairs": this is exactly the fix location the story's own Dev Notes prescribe, and Non-goals explicitly exclude `selectBondPair` changes (D-5.2-A/C/D).
- "Test only covers the 2-player degenerate case": the story's Task 1 required-test bar (assert `length === 1` after two identical calls) is met; broader N-player boundary coverage is explicitly a Non-goal (D-5.2-D, "nice-to-have").
- "Duplicated invariant logic between `getFateBondWipeTargets` and `applyPlayerDamage`": this is precisely what AC3 asks for (make the invariant explicit rather than implicit), not accidental duplication.
- "`continue` on isDown/isSpirit skips other per-player logic in the loop": checked — the loop body only sets velocity before this `continue`; no other logic is bypassed. Position sync happens in a separate, unguarded loop later in `tick()`.
- "Diff bundles unrelated concerns across 5 files": this is the story's own explicit multi-task, multi-context scope (5 independently-deferred hardening items in one story), not a review defect.
- "`node_modules`-pinned SDK verification comment will rot on upgrade": acceptable risk — `reconnection.enabled` is a stable public field per Colyseus's own documented API surface, not an implementation-detail file path.

### Change Log

| Date | Change |
|------|--------|
| 2026-07-07 | Story 5.7 implemented: Tasks 1–5 (duplicate-bond guard, downed/spirit movement freeze, isFrozen fate-wipe filter, verified Colyseus reconnection API, verified bondColor broadcast path); typecheck/tests/lint all pass; status → review |
| 2026-07-07 | Code review (3-layer parallel, scoped diff): 4 patch findings fixed (assignBond return-value bug, isFrozen required, missing isFrozen test, AC5 comment wording); 1 decision-needed finding raised (D-5.7-B, spirit immobility vs. story 3.6 intent) — status held at review pending Product decision; 2 out-of-scope findings logged to deferred-work.md (D-5.7-A sensor leak, D-5.7-C achievement unreachable in 2p) |
| 2026-07-07 | No user response within decision window on D-5.7-B; resolved by default to lowest-risk option (ship AC2 as literally specified, no unrequested scope expansion); flag left open in deferred-work.md for Product/Game Design. All decision/patch findings now resolved — status → done |

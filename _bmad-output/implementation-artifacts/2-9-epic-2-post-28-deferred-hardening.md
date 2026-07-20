---
baseline_commit: 3d22e41
---

# Story 2.9: Epic 2 — Post-2.8 Deferred Hardening

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E2 — Hub World & Class Selection (Story 2.9 — post-2.8 deferred hardening, no new
  features)
Context: Story 2.7 was epic 2's last hardening pass (2026-07-07). Story 2.8
  (hub-ability-use-outside-training-dummy-poi, 2026-07-15) shipped a feature fix in between
  and generated its own deferred findings. This story sweeps everything left open in
  deferred-work.md since 2.7, re-verified against current source before being scoped in.

  Re-verification results (read all affected files fully before writing this story):
  - D-2.6-A (rAF stale rafRef if renderFrame throws) — STILL OPEN. Confirmed at
    `HubWorldScreen.tsx:201` (`tick` closure inside the `[gameState]` effect). The guard
    (`if (rafRef.current === null)`) at line 198 still gates restart, and `tick`'s body still
    has no try/catch around `renderFrame` — a throw would skip the `rafRef.current = null`
    assignment at line 209/216.
  - D-2.6-B (stopJoystick unconditional zero-send on cleanup) — STILL OPEN. Confirmed: the
    joystick `useEffect`'s cleanup (`ControllerScreen.tsx`, currently ~line 1225) calls
    `stopJoystick()` unconditionally, with no `activeTouchIdRef.current !== null` guard.
  - D-2.8-A (`isInteractive`'s `!inDungeon` bypass) — STILL OPEN. Confirmed at
    `ControllerScreen.tsx:1486`: `(!inDungeon || (!isDown && !isSpirit)) && ability !== null
    && !isOnCooldown && !inBondMoment`. Unchanged since 2.8's code review.
  - D-2.8-B (no mobile-controller test coverage) — STILL OPEN but RE-DEFERRED (see Non-goals).
    Confirmed via `find apps/mobile-controller -name "*.test.*"`: zero test files exist in
    this app, and neither `apps/mobile-controller/package.json` nor `apps/host-client/
    package.json` has `@testing-library/react` or any jsdom-component-test setup — this
    project has NEVER written a React component test in either client app. Bootstrapping that
    infra is a materially bigger initiative than a hardening item; see Non-goals.
  - D-2.8-C (no regression test for surviving ability-input guards) — STILL OPEN. The guard
    (`!player || player.class === null || player.isFrozen || player.isDown ||
    player.isSpirit`) now lives at `GameRoom.ts:1961` (shifted from the finding's original
    line 1896 by intervening boss/god-mode code, same logic, unchanged). No test exercises it.
  - D-2.8-D (`raceTimeout` duplicated) — STILL OPEN and WORSE. Originally duplicated in 2
    files (`ability-dispatch.test.ts`, `hub-ability-use.test.ts`); a 3rd copy now exists in
    `full-run.test.ts` too (confirmed via grep — all 3 files define an identical local
    `raceTimeout` const). `tests/helpers/` exists (`messages.ts`, `server.ts`) but has no
    shared timeout helper.

  Excluded (verified NOT in scope for this story):
  - "D-6.6-C" (reconnecting player during boss purification window landing on ControllerScreen
    then jumping to PostRunMobileScreen) — this entry is filed in deferred-work.md immediately
    after D-2.8-D under the "2-8-hub-ability-use..." section header, but its own ID prefix and
    entire content (`GameRoom.ts:1184`, boss purification, PostRunMobileScreen) is Epic 6
    subject matter, not Epic 2. This is a mis-filed/mislabeled entry in the source doc, not a
    real Epic 2 deferred item. Do NOT scope it here — Epic 6's own hardening story owns it.
  - QD-6-A ("player abilities never damage the boss") — RESOLVED. Confirmed by reading
    `GameRoom.ts`: boss hit-scan branches broadcasting `boss:damaged` now exist at multiple
    sites (e.g. ~line 1860 hit-scan/mixed-faction, ~1560 zone-tick, ~1595 Storm Eye strike),
    all clamping `hp` via `Math.max(0, hp - damage)`. This was closed by Story 6.7 (boss
    combat resolution wiring) and extended by 6.9. No action needed.

Owner agent: Multi-context (explicit cross-context approval — matches the established Epic 2
  hardening-story pattern from 2.6/2.7, which also spanned multiple owner roles):
  Host Experience Engineer (Task 1 — HubWorldScreen.tsx)
  Mobile Controller Engineer (Task 2, Task 3 — ControllerScreen.tsx)
  Simulation Engineer (Task 4 — GameRoom.ts guard regression test, unit-test-only, no
    production code change)
  QA + Telemetry Engineer (Task 5 — tests/helpers/ extraction)

Goal: Close the 5 still-open findings accumulated since Story 2.7 with minimal, targeted
  diffs. Re-triage confirms D-2.8-B should stay deferred (test-infra bootstrap, out of
  proportion for a hardening sweep) and both D-6.6-C-mislabeled and QD-6-A are out of scope
  (wrong epic / already resolved, respectively).

Allowed paths:
  - apps/host-client/src/screens/HubWorldScreen.tsx                (Task 1)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx        (Tasks 2, 3)
  - apps/simulation-server/tests/game-room-ability-guard.test.ts   (Task 4 — new file)
  - tests/helpers/race-timeout.ts                                  (Task 5 — new file)
  - tests/e2e/ability-dispatch.test.ts                             (Task 5 — import swap only)
  - tests/e2e/hub-ability-use.test.ts                              (Task 5 — import swap only)
  - tests/e2e/full-run.test.ts                                     (Task 5 — import swap only)
  - _bmad-output/implementation-artifacts/deferred-work.md         (mark items resolved)

Blocked paths:
  - packages/**  (no protocol/shared-types/game-rules change needed for any of the 5 items)
  - apps/simulation-server/src/**  (except no production file changes at all for Task 4 — it
    is test-only; do not touch GameRoom.ts itself)
  - apps/backend-platform/**
  - apps/host-client/src/**  (except HubWorldScreen.tsx)
  - apps/mobile-controller/src/**  (except ControllerScreen.tsx)
  - sprint-status.yaml  (being updated separately by the orchestrator to avoid a multi-agent
    collision on this file — do not edit it as part of this story)

Inputs:
  - deferred-work.md: D-2.6-A, D-2.6-B, D-2.8-A, D-2.8-C, D-2.8-D (D-2.8-B re-deferred, not
    in scope; "D-6.6-C" and QD-6-A excluded per Context above)
  - apps/host-client/src/screens/HubWorldScreen.tsx (read the full `[gameState]` effect,
    ~lines 193-217, before editing)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (read the joystick `useEffect`,
    ~lines 1162-1234, and the skill-grid `isInteractive` computation, ~lines 1474-1486, before
    editing)
  - apps/simulation-server/src/rooms/GameRoom.ts (read-only — the ability-guard line at
    ~1961 is the source of truth to mirror in the new test; do not edit this file)
  - apps/simulation-server/tests/game-room-revive-proximity.test.ts (pattern to copy for
    Task 4 — hand-mirrors a GameRoom guard/loop verbatim in a `mockPlayer`-based unit test,
    since GameRoom isn't instantiable outside a live Colyseus room)
  - tests/helpers/server.ts, tests/helpers/messages.ts (existing shared-helper precedent for
    Task 5's new file)

Non-goals:
  - D-2.8-B (no mobile-controller test coverage) — re-deferred. Confirmed zero React
    component-test precedent exists anywhere in this repo (host-client or mobile-controller).
    Bootstrapping jsdom + a component-testing library for the first time is a standalone
    initiative, not a hardening-sweep item. This story's Task 4 (server-side guard regression
    test) already covers the security-relevant half of the same underlying finding — the
    client-side gate audited by D-2.8-A remains defense-in-depth only, per D-2.8-A's own
    text ("server-side is unaffected"). Revisit if/when a dedicated client-test-infra story is
    planned for either React app.
  - Any change to `packages/shared-types`, `packages/net-protocol`, or `packages/game-rules`.
  - Any change to `GameRoom.ts` production code (Task 4 is test-only, hand-mirroring the
    existing guard, not modifying it).
  - Any new gameplay feature or UX change beyond the 5 targeted fixes.

Acceptance criteria:
  1. `HubWorldScreen.tsx`'s flash-animation `tick` closure catches a thrown `renderFrame` and
     always resolves `rafRef.current` to either `null` or a freshly scheduled RAF id — never
     leaves a stale non-null id that would block a future restart. (D-2.6-A)
  2. `ControllerScreen.tsx`'s joystick `useEffect` cleanup only calls `stopJoystick()` (and
     therefore only sends the zero-velocity input) when a touch was actually active at
     unmount time. (D-2.6-B)
  3. `ControllerScreen.tsx`'s non-spirit-cell `isInteractive` computation gates on
     `!isDown && !isSpirit` unconditionally, regardless of `inDungeon` — matching the
     spirit-cell branch's own unconditional `!isFrozen` gate. (D-2.8-A)
  4. A new unit test in `apps/simulation-server/tests/game-room-ability-guard.test.ts` mirrors
     `GameRoom.ts`'s ability-processing guard (`!player || player.class === null ||
     player.isFrozen || player.isDown || player.isSpirit`) and asserts each of the 4
     rejection conditions (frozen, down, spirit, class===null) independently blocks dispatch,
     plus one passing case where all 4 are clear. (D-2.8-C)
  5. `raceTimeout` is extracted to `tests/helpers/race-timeout.ts` and imported (not
     redefined) by `ability-dispatch.test.ts`, `hub-ability-use.test.ts`, and
     `full-run.test.ts`. (D-2.8-D)
  6. `npm run typecheck` and the full test suite (`npx vitest run` equivalent across
     workspaces, plus `tests/e2e`) pass with no regressions.
  7. `deferred-work.md` marks D-2.6-A, D-2.6-B, D-2.8-A, D-2.8-C, D-2.8-D as resolved by this
     story (same "RESOLVED by ..." convention used elsewhere in the file), and records that
     "D-6.6-C" was identified as mis-filed (Epic 6 content) and QD-6-A as already resolved by
     Story 6.7/6.9 — do not delete either entry, annotate them.

Required hooks: Client-UX hook (host HUD readability — Task 1 touches host render loop
  robustness only, no visual change expected; mobile joystick mapping / skill mapping —
  Tasks 2-3 touch input-gating logic, no visual change expected). Simulation-safety hook is
  NOT triggered — Task 4 adds a test only, no `apps/simulation-server/src/**` file changes.
Required tests: New unit test (Task 4). Existing full suite (typecheck + vitest across all
  workspaces + tests/e2e) must stay green. No new e2e test required — none of the 5 fixes
  changes observable client behavior in any currently-reachable path (D-2.6-A/D-2.6-B are
  cleanup-path robustness fixes with no throw path today; D-2.8-A is unreachable dead code
  today per its own finding text).
Telemetry impact: None — no new user-facing flow, no new event.
```

---

## Story

As a developer on the project,
I want the five still-open Epic 2 deferred-hardening findings from the 2.6/2.8 code reviews
closed with minimal, targeted diffs,
so that the small accumulated defects (a stale-rAF footgun, a spurious joystick zero-send, a
dead-but-fragile client-side ability gate, and duplicated/uncovered test logic) don't keep
compounding as more stories build on top of `HubWorldScreen.tsx`, `ControllerScreen.tsx`, and
the e2e test suite.

---

## Acceptance Criteria

**AC1 — rAF loop survives a thrown `renderFrame` (D-2.6-A):**
**Given** the flash-animation `tick` closure in `HubWorldScreen.tsx`'s `[gameState]` effect
**When** `renderFrame` throws inside `tick`
**Then** `rafRef.current` is set to `null` (via a catch) instead of being left holding the
stale, already-consumed RAF id — so a future flash animation can restart normally

**AC2 — `stopJoystick` only fires on an actually-active touch (D-2.6-B):**
**Given** the joystick `useEffect` in `ControllerScreen.tsx` unmounts with no active touch
(`activeTouchIdRef.current === null`)
**When** the cleanup function runs
**Then** `stopJoystick()` is NOT called and no `{ joystick: { x: 0, y: 0 } }` input message is
sent

**AC3 — Ability-cell interactivity gates on isDown/isSpirit regardless of dungeon phase
(D-2.8-A):**
**Given** a player has `isDown: true` or `isSpirit: true`
**When** the non-spirit-cell `isInteractive` boolean is computed in `ControllerScreen.tsx`
**Then** it evaluates to `false` regardless of whether `inDungeon` is `true` or `false`

**AC4 — Ability-processing guards have regression coverage (D-2.8-C):**
**Given** a new unit test file mirroring `GameRoom.ts`'s ability-dispatch guard
**When** the test runs each of `isFrozen`, `isDown`, `isSpirit`, and `class === null`
independently
**Then** each case is asserted to block dispatch, and a fifth "all clear" case is asserted to
allow it through

**AC5 — `raceTimeout` centralized (D-2.8-D):**
**Given** `tests/helpers/race-timeout.ts` exports a `raceTimeout` function
**When** `ability-dispatch.test.ts`, `hub-ability-use.test.ts`, and `full-run.test.ts` are
inspected
**Then** none of them defines its own local `raceTimeout` — all three import it from the
shared helper

**AC6 — No regressions:**
**Given** all 5 fixes above
**When** `npm run typecheck` and the full test suite run
**Then** both are clean/green with no new failures

---

## Tasks / Subtasks

- [ ] **Task 1 (AC1):** `apps/host-client/src/screens/HubWorldScreen.tsx` — wrap the
  `renderFrame(...)` call inside the flash-animation `tick` closure (`[gameState]` effect,
  ~lines 201-211) in try/catch. On catch: `console.error('[HubWorldScreen] renderFrame threw
  during flash animation', err)`, set `rafRef.current = null`, and `return` (do not
  reschedule — stop the loop gracefully rather than looping into repeated throws). On success,
  keep the existing reschedule-or-null logic unchanged.
- [ ] **Task 2 (AC2):** `apps/mobile-controller/src/screens/ControllerScreen.tsx` — in the
  joystick `useEffect`'s cleanup function (currently unconditionally calling `stopJoystick()`
  alongside the 4 `removeEventListener` calls), guard the `stopJoystick()` call with
  `if (activeTouchIdRef.current !== null) stopJoystick();`. Leave the 4
  `removeEventListener` calls unconditional (they're always safe/needed).
- [ ] **Task 3 (AC3):** Same file — in the skill-grid `isInteractive` computation
  (~line 1486), change
  `(!inDungeon || (!isDown && !isSpirit)) && ability !== null && !isOnCooldown && !inBondMoment`
  to
  `(!isDown && !isSpirit) && ability !== null && !isOnCooldown && !inBondMoment`
  (drop the `!inDungeon ||` bypass entirely — `isDown`/`isSpirit` should gate unconditionally,
  matching the spirit-cell branch's own unconditional `!isFrozen` gate one line above it).
- [ ] **Task 4 (AC4):** Create `apps/simulation-server/tests/game-room-ability-guard.test.ts`.
  Follow the exact pattern of `game-room-revive-proximity.test.ts` (mockPlayer helper +
  hand-mirrored guard function, since `GameRoom` isn't instantiable outside a live Colyseus
  room). Mirror `GameRoom.ts:1961`'s guard:
  `if (!player || player.class === null || player.isFrozen || player.isDown ||
  player.isSpirit) continue;`
  Write 5 test cases: frozen blocks, down blocks, spirit blocks, class===null blocks, and one
  baseline case (all clear) that passes through to confirm the mirrored function isn't
  vacuously rejecting everything.
- [ ] **Task 5 (AC5):** Create `tests/helpers/race-timeout.ts` exporting:
  ```ts
  export const raceTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([p, new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms)
    )]);
  ```
  Then in `tests/e2e/ability-dispatch.test.ts`, `tests/e2e/hub-ability-use.test.ts`, and
  `tests/e2e/full-run.test.ts`: delete each file's local `raceTimeout` const definition and
  add `import { raceTimeout } from '../helpers/race-timeout.js';` (match the existing
  `.js` extension convention used by the other `tests/helpers/*` imports in these same files).
- [ ] Update `deferred-work.md`: mark D-2.6-A, D-2.6-B, D-2.8-A, D-2.8-C, D-2.8-D as
  "RESOLVED by 2-9-epic-2-post-28-deferred-hardening" following the existing convention (see
  D-dev5-A/D-dev5-B resolution entries for the exact style — append a "Resolution: ..." line
  under the original finding, don't delete the finding). Also annotate (do not delete) the
  mis-filed "D-6.6-C" entry noting it was identified as Epic 6 subject matter incorrectly
  filed under the 2.8 review section, and annotate QD-6-A as resolved by Story 6.7/6.9.
- [ ] Run `npm run typecheck` from repo root; verify zero errors.
- [ ] Run the full test suite (`npx vitest run` equivalent across workspaces, plus
  `tests/e2e`); verify no regressions and the new Task 4 test passes.

---

## Dev Notes

### Why these 5 and not the other 2 candidates

- **"D-6.6-C"** (reconnecting player during boss purification landing briefly on
  ControllerScreen before PostRunMobileScreen) is filed in `deferred-work.md` under the
  "code review of 2-8-hub-ability-use..." section header, but its ID prefix (`6.6`) and its
  entire content (`GameRoom.ts:1184`, boss purification window, `PostRunMobileScreen`) are
  Epic 6 subject matter. This looks like a copy/paste or mis-sectioning error in the source
  document, not an actual Epic 2 finding. Left untouched here — an Epic 6 hardening story is
  the correct owner.
- **QD-6-A** ("player abilities never damage the boss") is filed under the "2-6-epic-2-
  deferred-hardening" code-review section but is boss-combat subject matter. Verified
  resolved: `GameRoom.ts` now has boss `isInHitZone` branches broadcasting `boss:damaged` at
  multiple sites (hit-scan/mixed-faction ~1860, zone-tick ~1560, Storm Eye strike ~1595),
  closed by Story 6.7 and extended by 6.9. No action needed; left in `deferred-work.md`
  unmodified (already carries no "RESOLVED" marker from 6.7/6.9's own resolution passes —
  this story's Task 5.5 (deferred-work.md update) adds one).

### Existing code (read before editing)

**`HubWorldScreen.tsx`** (~lines 193-217): the `[gameState]` effect calls `renderFrame`
directly, then separately starts a self-rescheduling `tick` closure IF any player graphic has
an active `flashUntil`. The `rafRef.current === null` check at line 198 is how the effect
avoids double-starting the loop on every `gameState` update. `tick` itself has no error
handling at all today — this is the entire gap.

**`ControllerScreen.tsx`** joystick `useEffect` (~lines 1162-1234): `stopJoystick` (defined
~line 1147) resets 4 refs/state values AND unconditionally sends a `{ joystick: { x: 0, y: 0
} }` input message. The cleanup return (~line 1225) calls it unconditionally alongside
`removeEventListener` calls — this is correct for the ref/state resets (idempotent) but wrong
for the network send when there was never an active touch to begin with.

**`ControllerScreen.tsx`** skill-grid `isInteractive` (~line 1484-1486): two branches — the
spirit-cell branch (`isSpiritCell ? ...`) already gates unconditionally on `!isFrozen`; only
the non-spirit branch has the `!inDungeon ||` bypass that lets `isDown`/`isSpirit` be ignored
outside a dungeon. Per D-2.8-A's own finding text, this is currently unreachable dead code
(App.tsx routing + resetToHub already prevent the bad state from arising) — this fix is
pure defense-in-depth, not a live bug fix. Do not expect any observable behavior change from
Task 3 in the current build.

**`GameRoom.ts`** ability-processing guard (read-only, do not edit — currently ~line 1961,
inside the `for (const { clientId, msg } of this.inputQueue)` loop, right after finding
`player`): `if (!player || player.class === null || player.isFrozen || player.isDown ||
player.isSpirit) continue;`. This is the server-side authority that makes D-2.8-A's client
gate cosmetic rather than exploitable — Task 4 exists to lock in that this guard doesn't
silently regress in a future story.

### Known pitfalls

- Do not touch `GameRoom.ts` for Task 4 — the test hand-mirrors the guard's boolean logic in
  a standalone function inside the new test file (see `game-room-revive-proximity.test.ts`
  for the exact established pattern: a `mockPlayer()` factory + a small function copying the
  production logic verbatim, with a comment noting it's a mirror, not an import — `GameRoom`
  requires a live Colyseus room context and isn't unit-testable directly).
- Task 1's catch block should **stop** the rAF loop (set `rafRef.current = null` and
  `return`), not swallow-and-reschedule — rescheduling after a genuine render error would spin
  the loop into a throw-every-frame spiral instead of degrading gracefully.
- Task 5's import path: match the existing `.js`-suffixed relative import convention already
  used for `../helpers/server.js` and `../helpers/messages.js` in these same 3 files (ESM
  resolution requires the `.js` extension even though the source file is `.ts`).
- Do not add cooldown/protocol/shared-types changes anywhere — none of these 5 fixes touches
  the wire contract.

### Project Context Rules

- Per CLAUDE.md: keep gameplay authority in the simulation server. Task 4 only adds a test
  that verifies the existing authority boundary (server-side guard) — it does not move or add
  any authority logic to a client.
- Per CLAUDE.md Ownership Rules: this story spans 4 owner roles (Host Experience Engineer,
  Mobile Controller Engineer, Simulation Engineer for a test-only file, QA + Telemetry
  Engineer for the shared test helper). This mirrors the explicit cross-context pattern
  already established and accepted in Story 2.6 (4 owner roles) and Story 2.7 (2 owner
  roles) for Epic 2 hardening stories specifically — each Task's Allowed path is scoped to
  exactly one owner's area, so no single task crosses a boundary even though the story as a
  whole does.
- Do NOT edit `_bmad-output/implementation-artifacts/sprint-status.yaml` as part of this
  story — it is being updated separately to avoid a multi-agent write collision (several
  other epic hardening stories are being authored concurrently). The required manual edit is:
  add `2-9-epic-2-post-28-deferred-hardening: ready-for-dev` under the existing `epic-2` block
  in `development_status`.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md — "Deferred from: code
  review of 2-6-epic-2-deferred-hardening (2026-07-06)" (D-2.6-A, D-2.6-B, QD-6-A) and
  "Deferred from: code review of 2-8-hub-ability-use-outside-training-dummy-poi (2026-07-15)"
  (D-2.8-A through D-2.8-D, and the mis-filed "D-6.6-C")]
- [Source: apps/host-client/src/screens/HubWorldScreen.tsx — flash-animation tick closure]
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx — joystick useEffect,
  skill-grid isInteractive computation]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts — ability-processing guard,
  read-only reference for Task 4]
- [Source: apps/simulation-server/tests/game-room-revive-proximity.test.ts — pattern to
  follow for Task 4's new test file]
- [Source: _bmad-output/implementation-artifacts/2-7-epic-2-post-26-deferred-hardening.md —
  prior Epic 2 hardening story, narrow-scope precedent]
- [Source: _bmad-output/implementation-artifacts/2-6-epic-2-deferred-hardening.md — prior
  Epic 2 hardening story, multi-owner-role precedent]

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

- 2026-07-20: Story created via gds-create-story. Scoped to 5 re-verified open findings
  (D-2.6-A, D-2.6-B, D-2.8-A, D-2.8-C, D-2.8-D); D-2.8-B re-deferred (test-infra bootstrap,
  disproportionate to a hardening sweep); "D-6.6-C" excluded as mis-filed Epic 6 content;
  QD-6-A excluded as already resolved by Story 6.7/6.9.

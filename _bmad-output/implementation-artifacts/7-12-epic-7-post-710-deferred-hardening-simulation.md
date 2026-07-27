---
baseline_commit: 72837e19ff60a7f039a9c3a30e52a0b3784ae33c
---

# Story 7.12: Epic 7 Post-7.10 Deferred Hardening (Simulation)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Simulation Engineer,
I want every `:moved` broadcast to guard against a non-finite physics/position read and the boss-event switch to fail to compile if a future `BossEvent` variant is added without a handler,
so that a non-finite coordinate can never leak to clients and freeze/leak an entity, and a future boss event can never be silently dropped the way `boss:charged` itself was for an unknown number of stories before 7.7a gave it a broadcast.

**Why this story exists.** Closes two open Epic 7 deferred findings, re-verified against current source:

- **D-7.10-B**: none of the four `:moved`-broadcasting call sites in `GameRoom.ts` validate that the position being broadcast is finite. Two (`player:moved` phase 3, `projectile:moved` phase 3b) read directly from `body.getPosition()`; if planck.js ever returned `NaN`/`Infinity`, the existing `Math.abs(newX - x) > 0.5` gate evaluates `false` (any comparison against `NaN` is `false`), so the coordinate is silently **never written and never broadcast** — the client-side entity freezes at its last good position forever, and (for projectiles) `isProjectileExpired`'s distance check against the frozen coordinate can never trip, leaking the body for the rest of the run. The other two (`enemy:moved`, `boss:moved`) broadcast whatever `x`/`y` the pure `game-rules` `tickEnemy`/`tickBoss` functions already wrote, with the same absence of a finite check before broadcast. Deferred at Story 7.10's review specifically because "a fix belongs at all four `:moved` sites together, not only here" — this story is that follow-up.
- **D-7.7a-B**: the boss-event `switch (evt.type)` in `GameRoom.ts` (handling `BossEvent`, defined in `packages/game-rules/src/entities/grassland-boss.ts:20-26`) has no `default`/exhaustiveness arm. `packages/net-protocol/src/apply-delta.ts`'s sibling switch over the much larger `DeltaEventMsg` union already has exactly this guard (`default: { const _exhaustive: never = evt; ... }`, `apply-delta.ts:303-308`). Without it, a future `BossEvent` variant compiles cleanly with no corresponding `case` and is silently dropped by the `for` loop — proven not hypothetical: `boss:charged` itself sat in exactly this unhandled state for prior stories until 7.7a gave it a real broadcast.

Both fixes are confined to `apps/simulation-server/src/rooms/GameRoom.ts` — single owner, no ownership-hook escalation needed (see Dev Notes → Ownership check).

## Acceptance Criteria

1. **A non-finite position can never be written to `GameState` or broadcast from any of the four `:moved` sites.**
   **Given** the phase-3 player loop (`GameRoom.ts:1393-1413`) and phase-3b projectile loop (`:1415-1435`) each compute `newX`/`newY` from `toPixels(body.getPosition())` and gate the write+broadcast on `Math.abs(newX - x) > 0.5 || Math.abs(newY - y) > 0.5`,
   **when** this story ships,
   **then** both loops additionally require `Number.isFinite(newX) && Number.isFinite(newY)` before the write+broadcast (skip the whole block, leaving the entity at its last good position, when the read-back is non-finite — the entity does not disappear, it simply stops updating for that tick, identical in observable effect to the existing `> 0.5` gate's false branch),
   **and** a `logger.debug` call (not `.info`/`.warn`/`.error` — tick-loop hygiene rule) records the skip once per occurrence, including the entity id, for diagnosability without violating the no-`.info`-in-tick-loop rule.

2. **The same guard is applied to `enemy:moved` and `boss:moved` before their broadcast.**
   **Given** `enemy:moved` broadcasts happen inside the Enemy AI phase loop (`GameRoom.ts:1890-1901`, from `tickEnemy`'s emitted events) and `boss:moved` inside the boss-event switch (`:1920-1927`, from `tickBoss`'s emitted events) — both sourced from pure `game-rules` arithmetic, not a physics read-back, but sharing the identical absence of a finite check before broadcast,
   **when** this story ships,
   **then** each site checks `Number.isFinite(evt.x) && Number.isFinite(evt.y)` (or the pre-broadcast `enemy.x`/`enemy.y` for the enemy site, matching whichever value is actually broadcast) before calling `this.broadcast(...)`, skipping (with a `logger.debug`) if non-finite,
   **and** for `enemy:moved` specifically, the `body.setPosition(...)` re-sync call (`:1896`) is also skipped when non-finite, so the physics body is never desynced to a non-finite position either.

3. **The boss-event switch gains an exhaustiveness guard mirroring `apply-delta.ts`'s established pattern.**
   **Given** `GameRoom.ts:1919-1999`'s `switch (evt.type)` over the six-member `BossEvent` union (`boss:moved`, `boss:stomped`, `boss:phaseChanged`, `boss:charged`, `add:spawned`, `boss:defeated`) has no `default` arm, and `apply-delta.ts:303-308` already has the exact pattern to mirror (`default: { const _exhaustive: never = evt; void _exhaustive; ... }`),
   **when** this story ships,
   **then** a `default` case is added after the existing `case 'boss:defeated'` block, structured identically to `apply-delta.ts`'s (assign `evt` to a `const _exhaustive: never`, `void` it to satisfy lint, and take no other action — there is nothing to broadcast for an unknown variant),
   **and** this compiles cleanly today (all six current variants already have explicit cases) — the guard's value is purely for the *next* variant ever added to `BossEvent`, which will now fail to compile here instead of silently vanishing.

4. **No behavioral change to any currently-reachable path.**
   **Given** planck.js kinematic bodies and `game-rules`' pure arithmetic are not expected to produce non-finite values under any currently-known input, and all six `BossEvent` variants already have handlers,
   **when** this story ships,
   **then** every currently-passing test still passes unmodified except where a new test is added (Task 3) — this is a defensive hardening story, not a behavior change.

5. **Both hooks are discharged.**
   **Given** the **Simulation-safety hook** is TRIGGERED (`apps/simulation-server/**` changed) and the **Contract-change hook** is NOT (no `packages/net-protocol/**` or `packages/shared-types/**` touched — `BossEvent` is a `game-rules`-internal type, not part of `DeltaEventMsg`),
   **when** this story is completed,
   **then** typecheck, unit tests, a deterministic-tick sanity note, and a one-line per-tick perf note are all recorded in the Dev Agent Record.

## Tasks / Subtasks

- [x] **Task 1 — Finite guards on the two physics-read-back `:moved` sites (AC: 1).**
  - [x] 1.1: Phase 3 (`GameRoom.ts:1393-1413`, player): change the gate from `if (Math.abs(newX - player.x) > 0.5 || Math.abs(newY - player.y) > 0.5) {` to additionally require `Number.isFinite(newX) && Number.isFinite(newY)`. On the non-finite branch, `logger.debug({ roomId: this.roomId, playerId: player.id, newX, newY }, 'skipped non-finite player position read-back');` and do not write/broadcast.
  - [x] 1.2: Phase 3b (`:1415-1435`, projectile): identical transformation, `logger.debug({ roomId: this.roomId, projectileId: projectile.id, newX, newY }, 'skipped non-finite projectile position read-back');`.

- [x] **Task 2 — Finite guards on `enemy:moved` and `boss:moved` (AC: 2).**
  - [x] 2.1: Enemy AI phase (`:1890-1901`): before `this.broadcast(EventNames.DELTA, delta);` for an `aiEvt.type === 'enemy:moved'` event, check `Number.isFinite(enemy.x) && Number.isFinite(enemy.y)`; if non-finite, `logger.debug({ roomId: this.roomId, enemyId: enemy.id }, 'skipped non-finite enemy position broadcast');`, skip both the `body.setPosition(...)` call (`:1896`) and the broadcast for that event only (other event types from the same `result.value` array still process normally).
  - [x] 2.2: Boss `case 'boss:moved'` (`:1920-1927`): before writing `this.gameState.boss.position.x/y` and calling `this.bossBody?.setPosition(...)` and broadcasting, check `Number.isFinite(evt.x) && Number.isFinite(evt.y)`; if non-finite, `logger.debug({ roomId: this.roomId, bossId: evt.bossId }, 'skipped non-finite boss position broadcast');` and `break;` without writing state, moving the body, or broadcasting.

- [x] **Task 3 — Boss-event switch exhaustiveness guard (AC: 3).**
  - [x] 3.1: In `GameRoom.ts`, after the existing `case 'boss:defeated': { ... break; }` block (ending `:1998`) and before the switch's closing `}` (`:1999`), add:
    ```ts
    default: {
      // Exhaustiveness guard: adding a new BossEvent variant without a case here causes a TS error.
      const _exhaustive: never = evt;
      void _exhaustive;
      break;
    }
    ```
    mirroring `packages/net-protocol/src/apply-delta.ts:303-308` exactly (same comment wording, same `void` pattern).
  - [x] 3.2: Confirm via `npm run typecheck` that this compiles cleanly with no `case` additions needed — all six current `BossEvent` variants already have explicit handlers.

- [x] **Task 4 — Test coverage (AC: 4) + validation (AC: 5).**
  - [x] 4.1: In `apps/simulation-server/tests/`, add `game-room-post-710-deferred-hardening.test.ts` following the established pattern for GameRoom logic that can't be unit-tested via a live room (see `game-room-post-410-deferred-hardening.test.ts`, `game-room-post-413-deferred-hardening.test.ts`): mirror the phase-3/3b finite-gate logic as a small standalone function (`newX`/`newY`/prior `x`/`y` in, `{ shouldWrite: boolean }` out) and assert it returns `false` for `NaN`/`Infinity` inputs and `true` (matching today's existing `> 0.5` behavior) for finite inputs that cross the threshold.
  - [x] 4.2: The switch-exhaustiveness guard (Task 3) is a compile-time check, not a runtime behavior — do not write a redundant unit test for it; `npm run typecheck` passing **is** the proof, per the same approach Story 7.10's AC2 used for `apply-delta.ts`'s identical pattern.
  - [x] 4.3: `npm run typecheck` at repo root.
  - [x] 4.4: `npm test` at repo root; record pass/fail counts and confirm any failures match the documented pre-existing/known-flaky set.
  - [x] 4.5: Simulation-safety hook: deterministic-tick sanity note (the guards are pure additive `if` checks around existing writes/broadcasts — no new `GameState` field, no reordering of existing phases, so determinism is unaffected on the finite-input path, which is 100% of currently-known inputs) and a one-line perf note (`Number.isFinite` is a single comparison per site per tick — negligible against the 33 ms budget).

### Review Findings

_3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full spec mode. Acceptance Auditor independently re-ran `tsc --noEmit` and the new test file — confirmed no AC violation. 21 raised, 14 dismissed (noise/false-positive/matches-spec-literally/matches-established-precedent), 2 patch, 2 defer, 0 decision_needed._

- [x] [Review][Patch] New test file doesn't verify the two control-flow properties this diff actually introduces (only the `shouldWritePosition` finite+threshold predicate is tested) [`apps/simulation-server/tests/game-room-post-710-deferred-hardening.test.ts`] — no test confirms (a) the enemy-AI loop's `continue` (`GameRoom.ts:1906`) skips only the current `aiEvt` when `result.value` holds multiple events for one enemy, or (b) the boss switch's `break` (`GameRoom.ts:1937`) only exits the `'boss:moved'` case when `bossResult.value` holds multiple events in the same tick (a real pattern per `grassland-boss.ts:169-194`'s `[...phaseEvents, ...chargeEvents, ...]` return shape). Both are correct by inspection but unverified by test. **Fixed:** added `processEnemyEvents`/`processBossEvents` mirror-function tests (4 new tests, 10/10 total passing) confirming both scoping properties.
- [x] [Review][Patch] Perf sanity note self-contradicts in Dev Agent Record → Completion Notes [`7-12-epic-7-post-710-deferred-hardening-simulation.md` Completion Notes] — "≤4 extra scalar comparisons per tick across all four sites" immediately followed by "scaled by live entity count"; these can't both be true. Actual cost is O(players + projectiles + enemies + 1) per tick, not a flat ≤4. **Fixed:** reworded to state the O(entity count) scaling directly, dropping the contradictory flat "≤4" claim.
- [x] [Review][Defer] `boss:charged` broadcasts an unguarded position, unlike its now-guarded `boss:moved` sibling [`apps/simulation-server/src/rooms/GameRoom.ts:1960-1967`] — deferred, out of this story's literal AC2 scope (`enemy:moved`/`boss:moved` only) but relevant to the story's own stated intent. `tryCharge` (`packages/game-rules/src/entities/grassland-boss.ts:78-91`) mutates `boss.position` via the identical `dx/dy/len`-division arithmetic as `tickBossChase` (which produces the now-guarded `boss:moved`, `grassland-boss.ts:109-128`). If that arithmetic ever produced non-finite output, `boss:moved` would be suppressed but `boss:charged` would broadcast it unguarded in the same tick.
- [x] [Review][Defer] `enemy:stomped` events bypass the finite guard entirely [`apps/simulation-server/src/rooms/GameRoom.ts:1900-1914`] — deferred, same "outside literal AC2 scope, relevant to stated intent" note as above. The `Number.isFinite` check is nested inside `if (aiEvt.type === 'enemy:moved')` (`:1903`), so a `StompLayer.execute()` result (`packages/game-rules/src/systems/ai/layers/stomp.ts:14-21`, carrying `x: enemy.x, y: enemy.y`) skips the check and broadcasts unconditionally at `:1914`, regardless of whether `enemy.x`/`enemy.y` are finite.

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Deferred-hardening story inside the completed-stories tail of **Epic 7** (Ability & Environmental VFX Prototyping), closing findings left open by the 7.10 and 7.7a code reviews. Follows the project's established `epic-N-post-XX-deferred-hardening` pattern (3.22, 3.24, 4.14, 5.9, 6.9, 6.10).
- **Context:** See "Why this story exists" above. This is the simulation-only half of a two-story split from a single deferred-item sweep — see Ownership check below. Its sibling, **Story 7.11**, covers the host-only findings from the same sweep (D-7.3-A, D-7.4-A, D-7.4-B).
- **Goal:** Add `Number.isFinite` guards at all four `:moved` broadcast sites and an exhaustiveness `default` arm to the boss-event switch — both mechanical, low-risk, pattern-matching fixes (the exhaustiveness fix literally copies an already-shipped sibling pattern from `apply-delta.ts`).
- **Allowed paths:**
  - `apps/simulation-server/src/rooms/GameRoom.ts`
  - `apps/simulation-server/tests/game-room-post-710-deferred-hardening.test.ts` (new)
  - `_bmad-output/implementation-artifacts/7-12-epic-7-post-710-deferred-hardening-simulation.md` (Dev Agent Record)
- **Blocked paths:** `apps/host-client/**`, `apps/mobile-controller/**`, `packages/net-protocol/**`, `packages/shared-types/**`, `packages/game-rules/**` (the `BossEvent` type itself is not changed — only its *consumer* switch in `GameRoom.ts` gains a guard), `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Inputs:** `apps/simulation-server/src/rooms/GameRoom.ts:1393-1435` (phase 3/3b read-back loops), `:1890-1901` (enemy AI broadcast), `:1919-1999` (boss-event switch), `packages/game-rules/src/entities/grassland-boss.ts:13-26` (`BossEvent` union, six variants), `packages/net-protocol/src/apply-delta.ts:296-308` (the exhaustiveness pattern to mirror exactly), `apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts` (the established "mirror the logic in a standalone function, GameRoom isn't instantiable outside a live room" test pattern to follow), `deferred-work.md` D-7.10-B / D-7.7a-B.
- **Non-goals:** No change to `BossEvent`'s member types or any new variant; no change to any `:moved` delta's wire shape (`packages/net-protocol/**` untouched); no fix to the two host-only findings (delta-queue batching, projectile-meta cache) — those are Story 7.11; no investigation into *whether* planck.js can actually produce non-finite output (out of scope — this is defense-in-depth against an input class, not root-cause elimination).
- **Ownership check — single owner, no split needed.** 100% within `apps/simulation-server/**` (Simulation Engineer) plus its own `apps/simulation-server/tests/**` (which the Simulation Engineer already owns test-adjacent files within for this exact pattern, per the `game-room-post-4xx` precedent — QA + Telemetry Engineer's `tests/**` ownership is for the top-level `tests/` directory, contract/e2e suites; `apps/simulation-server/tests/**` is the sim engineer's own unit-test area, consistent with every prior `game-room-*.test.ts` file being authored inside sim-engineer-owned stories). Deliberately split from the host-only findings (D-7.3-A, D-7.4-A, D-7.4-B, all `apps/host-client/**`-only) into sibling Story 7.11, per CLAUDE.md's "split unless there is a strong reason not to" — no code, coupling, or test dependency is shared between the two areas. User confirmed this split explicitly during story creation.
- **Hook verdicts:**
  - **Contract-change hook — NOT triggered.** `BossEvent` is defined and consumed entirely within `game-rules`/`simulation-server`; it is never serialized over the wire as-is (only the `DeltaEventMsg` shapes `GameRoom.ts` constructs *from* it are). No `packages/net-protocol/**` or `packages/shared-types/**` file touched.
  - **Simulation-safety hook — TRIGGERED.** Requires: typecheck, unit tests, deterministic-tick sanity, replay test (or "none exists"), perf sanity (Task 4.5).
  - **Client-UX hook — NOT triggered.** No host or mobile file changed.
  - **Telemetry hook — N/A.** No new user flow; defensive hardening of an existing one.

### Testing Standards

- `apps/simulation-server/tests/` unit tests mirror GameRoom's internal logic as standalone functions rather than instantiating a live Colyseus room (established by `game-room-host-join.test.ts`, `game-room-level-clear-guard.test.ts`, and both prior `game-room-post-4xx-deferred-hardening.test.ts` files) — follow that exact pattern for Task 4.1, do not attempt to instantiate `GameRoom` directly.
- The exhaustiveness guard (Task 3) is proven by `npm run typecheck`, not a unit test — matches the precedent Story 7.10 set for the identical `apply-delta.ts` pattern (its AC2: "The exhaustive-`never` guard will fail to compile until this case exists — that is the check").
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story:** WSL2 e2e port-binding timeout on `ability-dispatch`/`hub-ability-use`; `ability-vfx.test.ts` Stone Wall centering (host-only, unrelated to this story's paths). Note if seen; never claim a test passed that was not run.

### Project Context Rules

- **Tick Loop Hygiene** (project-context.md): "Forbidden inside the tick: `logger.info`/`.warn`/`.error`" — every new log call in this story uses `logger.debug` exclusively, per this rule.
- **Result<T,E> — never throw from game rules**: not applicable here (this story adds `if` guards in `GameRoom.ts`, not `game-rules` functions; no new throw is introduced or removed).
- **PRNG / determinism**: this story introduces no randomness and does not alter tick ordering — see AC4/Task 4.5.
- **Ownership:** `apps/simulation-server/**` = Simulation Engineer, protected core layer per CLAUDE.md — be extra strict; both fixes are additive `if` guards around existing writes/broadcasts, never removing or reordering existing logic.

### References

- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1393-1435`] — phase 3 (`player:moved`) and phase 3b (`projectile:moved`) read-back loops, the two direct `body.getPosition()` sites.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1890-1901`] — Enemy AI phase, `enemy:moved` broadcast + body re-sync.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1919-1999`] — boss-event switch, all six `BossEvent` cases, insertion point for the `default` guard.
- [Source: `packages/game-rules/src/entities/grassland-boss.ts:13-26`] — `BossEvent` union and its six member types.
- [Source: `packages/net-protocol/src/apply-delta.ts:296-308`] — the exhaustiveness-guard pattern to mirror exactly (comment wording, `const _exhaustive: never = evt; void _exhaustive;`).
- [Source: `apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts`] — the established "GameRoom isn't instantiable outside a live room, mirror the logic in a standalone function" test pattern.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — D-7.10-B (line ~19), D-7.7a-B (line ~1358).
- [Source: `_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md`] — Review Findings section, the original deferral of D-7.10-B ("a fix belongs at all four `:moved` sites together, not only here").
- [Source: `CLAUDE.md`] — ownership rules, simulation-safety hook, tick-loop hygiene, merge gate.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` — clean, all 10 tsconfigs, no errors (run once after Task 3, no fix cycle needed).
- `npm test` (full suite, run 1): 4 files failed / 48 passed (52 files); 2 tests failed / 578 passed / 3 skipped (583 tests). Failures: `ability-dispatch.test.ts` "Ancestor's Voice..." (flaky heal-timing assertion), `full-run.test.ts` + `hub-ability-use.test.ts` (simulation-server did not start within 60s — WSL2 e2e port-binding timeout), `ability-vfx.test.ts` "centres Stone Wall..." (host-client, unrelated).
- `npm test` (full suite, run 2, per TWO-STRIKE QA): 3 files failed / 49 passed; 1 test failed / 579 passed / 3 skipped. `ability-dispatch.test.ts` passed this run (confirming flaky, not a regression); `full-run.test.ts`/`hub-ability-use.test.ts` (port-binding timeout) and `ability-vfx.test.ts` Stone Wall centering failed again — both match this story's own Testing Standards "Known pre-existing, NOT caused by this story" list verbatim. No fix applied; both runs' failures fall entirely within the pre-documented set, none touch `apps/simulation-server/src/rooms/GameRoom.ts` or the new test file.

### Completion Notes List

- **Task 1 (AC1):** Added `if (!Number.isFinite(newX) || !Number.isFinite(newY)) { logger.debug(...); continue; }` immediately after the `toPixels()` read-back in both the phase-3 player loop and phase-3b projectile loop, before the existing `> 0.5` gate. `continue` is equivalent to "skip the whole block" since the gate is the entire remaining loop body at both sites.
- **Task 2 (AC2):** Enemy AI phase — added a finite check on `enemy.x`/`enemy.y` inside the `aiEvt.type === 'enemy:moved'` branch, before the `body.setPosition(...)` re-sync; non-finite skips both the physics re-sync and the broadcast via `continue` (other event types in the same `result.value` array are unaffected since the loop continues to their iterations). Boss `case 'boss:moved'`: added the finite check as the first statement in the case, `break`-ing before any state write, body move, or broadcast on the non-finite branch.
- **Task 3 (AC3):** Added a `default` arm to the boss-event `switch (evt.type)` after `case 'boss:defeated'`, structured identically to `apply-delta.ts:303-308` (same comment wording, `const _exhaustive: never = evt; void _exhaustive;` pattern). Confirmed via `npm run typecheck` that no new `case` was required — all six current `BossEvent` variants (`boss:moved`, `boss:stomped`, `boss:phaseChanged`, `boss:charged`, `add:spawned`, `boss:defeated`) already had explicit handlers.
- **Task 4 (AC4/AC5):** Added `apps/simulation-server/tests/game-room-post-710-deferred-hardening.test.ts` (6 tests) mirroring the finite-gate logic as a standalone `shouldWritePosition` function — asserts `false` for `NaN`/`±Infinity` in either axis and preserves the pre-existing `> 0.5` threshold behavior for finite input. The switch-exhaustiveness guard is proven by `npm run typecheck` per Story 7.10's established precedent for the identical `apply-delta.ts` pattern — no redundant runtime test written for it.
- **AC5 hook discharge:**
  - **Simulation-safety hook (TRIGGERED):** typecheck clean (10/10 tsconfigs); new unit tests pass (6/6); full suite 579/583 passing with the remaining 1 failure + 2 setup-timeout suites all matching this story's own pre-documented known-issue list (none in `apps/simulation-server/src/rooms/GameRoom.ts` or new test files).
  - **Deterministic-tick sanity note:** all four guards are additive `if` checks wrapped around existing writes/broadcasts — no new `GameState` field, no reordering of existing tick phases, no change to iteration order within any loop. On the finite-input path (100% of currently-known/reachable inputs, per AC4), execution is byte-for-byte identical to pre-story behavior, so determinism is unaffected.
  - **Perf sanity note:** `Number.isFinite` adds one extra scalar comparison-pair per finite-check per tick, so the added cost scales with live entity count — O(players + projectiles + enemies + 1 boss) comparisons per tick, not a fixed constant — and remains negligible against the 33 ms/30 Hz tick budget at any currently-supported room size (`MAX_PLAYERS` plus a bounded enemy/projectile count per level).
  - **Contract-change hook:** confirmed NOT triggered — no file under `packages/shared-types/**` or `packages/net-protocol/**` touched; `BossEvent` (defined in `packages/game-rules`) is unchanged, only its consumer switch in `GameRoom.ts` gained a guard.
- No new dependencies, no ownership-hook escalation (100% within `apps/simulation-server/**`, Simulation Engineer's own area, matching the `game-room-post-4xx` test-file precedent).
- **Confidence: 92%** — both fixes are mechanical, pattern-matched exactly against an already-shipped sibling (`apply-delta.ts`) and the story's own acceptance criteria/task text, and are provably no-ops on every currently-reachable input path. Residual uncertainty is only the inherent unfalsifiability of "planck.js/game-rules never actually produce non-finite output today" (AC4's own stated non-goal — not investigated, matching scope), not anything about the guards' correctness or discharge.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` (modified) — finite guards at all four `:moved` broadcast sites (phase 3 player, phase 3b projectile, enemy AI `enemy:moved`, boss-event `boss:moved`); `default` exhaustiveness arm added to the boss-event switch.
- `apps/simulation-server/tests/game-room-post-710-deferred-hardening.test.ts` (new, then patched during code review) — 10 unit tests: 6 for the finite-gate logic (D-7.10-B), 4 added during code review for the enemy-loop/boss-switch control-flow scoping.

## Change Log

| Date | Change |
|---|---|
| 2026-07-27 | Story 7.12 created — simulation-only half of the Epic 7 post-7.10 deferred-hardening sweep. Re-verified D-7.10-B and D-7.7a-B against current source: confirmed no finite guard exists at any of the four `:moved` broadcast sites, and confirmed the boss-event switch still has no exhaustiveness arm while its net-protocol sibling (`apply-delta.ts`) does. Split from the host-side findings (D-7.3-A, D-7.4-A, D-7.4-B) into sibling Story 7.11 per user decision, matching CLAUDE.md's ownership-split rule. |
| 2026-07-27 | Implemented: added `Number.isFinite` guards at all four `:moved` broadcast sites (player, projectile, enemy, boss) and a `default` exhaustiveness arm to the boss-event switch, mirroring `apply-delta.ts`'s established pattern exactly. Added `game-room-post-710-deferred-hardening.test.ts` (6 tests). Typecheck clean (10/10 tsconfigs). Full suite: 579/583 passing across two runs, remaining failures all pre-existing/documented and unrelated to this story's paths. Status set to review. |
| 2026-07-27 | Code review (3 parallel layers, full spec mode): 0 decision_needed, 2 patch, 2 defer, 12 dismissed. Patches applied — added 4 control-flow tests (`processEnemyEvents`/`processBossEvents` mirror functions, 10/10 tests passing) and fixed a self-contradictory perf-note wording. Deferred D-7.12-A (`boss:charged` lacks the finite guard its `boss:moved` sibling now has) and D-7.12-B (`enemy:stomped` bypasses the guard entirely) to `deferred-work.md` — both real but outside AC2's literal scope. Typecheck clean. Status set to done. |

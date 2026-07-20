---
baseline_commit: 3d22e41a41a9fae1f18e86c72cca8529ae173c96
---

# Story 5.9: Epic 5 — Post-5.8 Deferred Hardening

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.9 — post-5.8 deferred hardening, no new features)
Context: Story 5.8's own code review (2026-07-07) closed 3 findings from 5.7 (D-5.7-A/B/C)
  and, along the way, surfaced one new deferred finding from its own Task 3 fix — D-5.8-A —
  logged in deferred-work.md under "Deferred from: code review of
  5-8-epic-5-post-57-deferred-hardening (2026-07-07)". This is the only open item for Epic 5;
  epic-5 is currently marked `done` in sprint-status.yaml and is being reopened to
  `in-progress` for this story, matching this project's established precedent of reopening a
  "done" epic when a leftover deferred finding needs a follow-up story (epic-1, epic-2,
  epic-3 were each reopened the same way).

  D-5.8-A, re-verified against the current codebase before scoping this story (still holds
  exactly as described): `loadLevel`'s boss branch (apps/simulation-server/src/rooms/
  GameRoom.ts:1034-1039) computes `maxAchievableBonds` from `this.gameState.players.length`
  read LIVE at boss-start time — not the roster that was actually present while bonds were
  being assigned across levels 1-3. `onJoin` (line 431) has no phase guard, so a client can
  join mid-dungeon; `onLeave(CloseCode.CONSENTED)` (line 463-464) removes the player slot
  immediately regardless of phase. So if the roster size changes between bond-assignment
  time and boss-level start, `maxAchievableBonds` is computed against a roster that doesn't
  match the one `activeBonds` was actually built against. Example: a 2-player session's 1
  achievable bond is assigned across levels 1-3, then a 3rd player joins right before boss
  start — `maxAchievableBonds` becomes `min(3, 3)=3` but only 1 bond exists, so
  `allBondsAtBossStart` (and the `AllBondsActive` achievement) stays false even though the
  original 2 players did everything the achievable-bonds design intended for their session
  size. Cosmetic/achievement-only impact — no gameplay-blocking effect.

Owner agent: Simulation Engineer (single file touched:
  apps/simulation-server/src/rooms/GameRoom.ts — no shared-types, net-protocol, or
  cross-context change needed).

Goal: Make `maxAchievableBonds` use the player-roster size that was actually present when
  bond assignment began for this run, not a live re-read at boss-start — closing D-5.8-A.

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/simulation-server/tests/**  (updated unit tests)
  - _bmad-output/implementation-artifacts/deferred-work.md  (mark D-5.8-A resolved)

Blocked paths:
  - packages/**
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - tests/e2e/**  (no new e2e repro required — cosmetic achievement-flag fix)

Inputs:
  - apps/simulation-server/src/rooms/GameRoom.ts — read in full before editing: the private
    field block (~line 147-148), `startDungeon` (~line 630-654), `enterBondMoment`
    (~line 883-934), `loadLevel`'s boss branch (~line 1028-1039), `onJoin` (~line 431-457),
    `onLeave` (~line 459 onward, CONSENTED branch ~463-490). Line numbers may have shifted —
    confirm current locations before editing.
  - _bmad-output/implementation-artifacts/deferred-work.md — "Deferred from: code review of
    5-8-epic-5-post-57-deferred-hardening (2026-07-07)", finding D-5.8-A, for the original
    text and recommended fix.
  - apps/simulation-server/tests/game-room-level-clear-guard.test.ts — existing
    `allBondsAtBossStart` mirror-function test block (Story 5.8) to extend.

Non-goals:
  - Do NOT add a phase guard to `onJoin` or change `onLeave`'s immediate-removal behavior.
    D-5.8-A's own recommended fix targets the `maxAchievableBonds` computation only —
    restricting mid-dungeon join/leave would be a session-lifecycle/reconnect-flow change
    (CLAUDE.md Contract-change hook territory: session lifecycle, reconnect flow, room
    state), a materially bigger and differently-owned change than this hardening story scopes.
  - Do NOT widen the fix into a general "N choose 2" combinatorics helper or a new
    `packages/game-rules` export — matches 5.7/5.8's own established Non-goals precedent for
    this exact code (a 2-vs-3+-player branch is already the accepted level of generality;
    this story only changes which roster count feeds that branch, not the branch itself).
  - Do NOT persist `bondEligiblePlayerCount` into `GameState`/session (no wire-protocol
    field, no shared-types change) — it is a run-scoped private `GameRoom` field, exactly
    like the existing `bondMomentNextLevel` it sits beside.
  - Do NOT touch `resetToHub` — `startDungeon` is the correct, sole reset point (matches how
    `bondMomentNextLevel` is already reset there, not in `resetToHub`).

Acceptance criteria:
  1. `GameRoom` snapshots the player roster size once, at the first bond-assignment attempt
     of a run (the first `enterBondMoment` call for a level below `BOSS_LEVEL_INDEX`), into a
     new private field.
  2. The snapshot is reset to "not yet captured" at the start of every new dungeon run
     (`startDungeon`), so a 2nd run in the same room re-snapshots correctly.
  3. `loadLevel`'s boss branch computes `maxAchievableBonds` from the snapshotted count when
     available, falling back to the live `this.gameState.players.length` only if no snapshot
     was ever captured (defensive; not expected to occur in practice once a run reaches boss
     level, since at least one bond-assignment attempt always precedes it).
  4. A late-joining or -leaving player between bond-assignment time and boss-level start no
     longer changes `maxAchievableBonds` — it stays pinned to the roster size that was
     present when bonds were actually being assigned.
  5. Unchanged behavior for the common case (stable roster throughout the run): identical
     `maxAchievableBonds`/`allBondsAtBossStart` results as before this fix for 2-player and
     3+-player sessions with no mid-run join/leave.
  6. New unit test coverage proves the fix resolves the exact scenario D-5.8-A describes (a
     2-player session's 1 bond, then a 3rd player joins before boss start, no longer inflates
     `maxAchievableBonds` to 3).
  7. Full monorepo typecheck and Vitest suite pass with no regressions.
  8. `deferred-work.md`'s D-5.8-A entry is annotated as resolved by this story (matching the
     project's established "Resolution:" note-append convention — see D-5.7-C, D-dev5-A for
     precedent), not deleted or rewritten.

Required hooks:
  - Simulation-safety hook (GameRoom.ts modified — typecheck, unit tests; deterministic tick
    test N/A [no PRNG/tick-order change — the snapshot is a one-shot capture at a
    message-handler-triggered transition, not tick() itself]; replay test N/A [no wire-format
    change — `allBondsAtBossStart`'s type and meaning in SnapshotMsg are unchanged, only its
    input roster-count is now correct]; perf sanity check N/A [same O(1) field read/write
    that already existed for `bondMomentNextLevel`, no new per-tick cost]).

Required tests:
  - Extend apps/simulation-server/tests/game-room-level-clear-guard.test.ts's existing
    `allBondsAtBossStart` describe block (Story 5.8) with a new block covering the snapshot
    resolution: snapshot-present takes precedence over live count; the D-5.8-A repro scenario
    (snapshot=2, live=3 after a late join) now correctly resolves to `true` for
    `allBondsAtBossStart(1, resolvedCount)`; and the defensive no-snapshot-yet fallback.
  - No changes expected to existing `allBondsAtBossStart` or `levelClearFires` tests in the
    same file — this story only changes what `playerCount` value feeds the existing formula,
    not the formula itself.

Telemetry impact: None — no new user-facing flow, no new event, no payload shape change
  (`allBondsAtBossStart` remains the same boolean field in the same snapshot, now fed a
  correct input).
```

---

## Story

As a developer on the project,
I want `allBondsAtBossStart`'s player-count formula to use the roster size that was actually
present while bonds were being assigned, not a live re-read at boss-start,
so that a mid-dungeon join or leave can't desync the `AllBondsActive` achievement from the
bonds a session's original players actually earned.

---

## Acceptance Criteria

**Given** `loadLevel` reaches the boss branch and computes `maxAchievableBonds`
**When** the player roster changed size between bond-assignment time (levels 1-3) and
boss-level start (a player joined mid-dungeon, or left via consented disconnect)
**Then** `maxAchievableBonds` is computed from the roster size that was present when bond
assignment began for this run, not the live roster size at boss-start
**And** a session with a stable roster throughout sees no change in behavior
**And** `onJoin`/`onLeave`'s own behavior (no phase guard; immediate consented-leave slot
removal) is left untouched — this story only changes what count feeds `maxAchievableBonds`

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #1, #2) — Add a new private field `bondEligiblePlayerCount = -1` to
  `GameRoom`, declared next to `bondMomentNextLevel` (~line 148). Reset it to `-1` in
  `startDungeon` alongside the existing `this.bondMomentNextLevel = -1;` (~line 638).
- [ ] **Task 2** (AC: #1) — In `enterBondMoment` (~line 883), immediately after the
  `levelIndex >= BOSS_LEVEL_INDEX` early-return block (~line 888) and before the
  `assignBond` call (~line 889), snapshot the roster once:
  ```ts
  if (this.bondEligiblePlayerCount === -1) {
    this.bondEligiblePlayerCount = this.gameState.players.length;
  }
  ```
- [ ] **Task 3** (AC: #3, #4, #5) — In `loadLevel`'s boss branch (~line 1034), replace the
  live read with the snapshot (fallback to live only if no snapshot exists):
  ```ts
  const playerCount = this.bondEligiblePlayerCount >= 2
    ? this.bondEligiblePlayerCount
    : this.gameState.players.length;
  ```
  (Keep the rest of the `maxAchievableBonds`/`allBondsAtBossStart` formula exactly as-is —
  only the source of `playerCount` changes.)
- [ ] **Task 4** (AC: #6) — Add unit test coverage in
  `apps/simulation-server/tests/game-room-level-clear-guard.test.ts` per Dev Notes below.
- [ ] **Task 5** (AC: #8) — Append a "Resolution:" note to D-5.8-A's entry in
  `deferred-work.md`, matching the established convention (see D-5.7-C's, D-dev5-A's
  resolution notes for format).
- [ ] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [ ] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions.

---

## Dev Notes

### Context — re-verification of D-5.8-A against current source

Read directly before scoping this story (baseline commit `3d22e41`):

- `apps/simulation-server/src/rooms/GameRoom.ts:1034-1039` (`loadLevel`'s boss branch):
  ```ts
  const playerCount = this.gameState.players.length;
  const maxAchievableBonds = playerCount >= 2
    ? Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)
    : 0;
  this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === maxAchievableBonds
    && maxAchievableBonds > 0;
  ```
  Confirmed: `playerCount` is read live, at boss-start, from the current `gameState.players`
  array.
- `apps/simulation-server/src/rooms/GameRoom.ts:431` (`onJoin`): no phase check anywhere in
  the function — a client can join while `session.phase === 'dungeon'` and immediately gets
  pushed into `this.gameState.players`.
- `apps/simulation-server/src/rooms/GameRoom.ts:463-464` (`onLeave`, `CONSENTED` branch):
  `this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);`
  runs unconditionally on consented leave, regardless of `session.phase`.

**D-5.8-A's premise holds exactly as described** — unlike D-5.7-A in story 5.8 (which turned
out to already be fixed by an unrelated prior patch), this finding is still live. Proceeding
with the fix as scoped.

### The fix

`enterBondMoment` is the single function that performs bond assignment, called once per
dungeon level (levels 1-3) via `tryEnterBondMoment` (`GameRoom.ts:942`,
`this.enterBondMoment(levelIndex)`) — confirmed the only call site. By the time `loadLevel`
reaches the boss branch (level 4), `enterBondMoment` has already run at least once (for level
1's completion), so a roster snapshot captured on its first invocation is always available by
boss-start — the "no snapshot yet" fallback in Task 3 is defensive only, not expected to
trigger in practice.

Snapshot once, at the earliest point bond assignment is attempted for this run:

```ts
// enterBondMoment, right after the boss-level early-return, before assignBond:
if (this.bondEligiblePlayerCount === -1) {
  this.bondEligiblePlayerCount = this.gameState.players.length;
}
const result = assignBond(this.gameState, this.bondRng);
```

This captures the roster size regardless of whether `assignBond` itself succeeds — if it
fails (e.g. `NOT_ENOUGH_PLAYERS`), the snapshot correctly records `< 2`, which the boss
branch's existing `maxAchievableBonds` formula already handles (`playerCount >= 2` guard
evaluates false, `maxAchievableBonds = 0`, `allBondsAtBossStart` stays `false` — same
behavior as if bonds genuinely were never assignable for this session).

Reset the snapshot once per run, in `startDungeon` next to the existing
`bondMomentNextLevel` reset (~line 638) — NOT in `resetToHub`, matching how
`bondMomentNextLevel` itself is scoped (a 2nd dungeon run in the same room must re-snapshot
from a clean `-1`, exactly like `bondMomentNextLevel` already does):

```ts
this.bondMomentNextLevel = -1;
this.bondEligiblePlayerCount = -1;
```

Boss branch (`loadLevel`, ~line 1034) — only the `playerCount` source line changes, the rest
of the formula is untouched:

```ts
// Before
const playerCount = this.gameState.players.length;

// After
// Story 5.9 (D-5.8-A): use the roster snapshotted at first bond assignment, not the live
// roster at boss-start — a mid-dungeon join/leave between bond assignment and boss start
// must not desync maxAchievableBonds from the bonds that were actually assigned.
const playerCount = this.bondEligiblePlayerCount >= 2
  ? this.bondEligiblePlayerCount
  : this.gameState.players.length;
```

### Why not the deferred item's other suggested alternative

D-5.8-A's text also floats deriving `maxAchievableBonds` from "the distinct player IDs that
have actually appeared in `activeBonds` plus current unbonded-but-present players" as an
alternative. Worked through against the entry's own example (2-player session bonds 1 pair,
then a 3rd player joins before boss start): distinct IDs in `activeBonds` = 2 original
players; current unbonded-but-present = the 1 newcomer; union = 3 — same wrong answer the bug
already produces today. That alternative doesn't actually fix the cited scenario, so this
story implements the entry's other, primary suggestion instead: snapshot the count at
first-bond-assignment time. Simpler, and it's the one that demonstrably closes the example
in the deferred-work entry itself.

### Why not touch `onJoin`/`onLeave`

Restricting mid-dungeon join or making consented leave phase-aware would be a session
lifecycle change — CLAUDE.md's Contract-change hook explicitly lists "session lifecycle" and
"room state" as trigger conditions requiring Protocol Architect review, a compatibility
checklist, and a spec/ADR update. That's a different, larger, differently-owned piece of
work than this one-field hardening fix, and D-5.8-A's own recommended fix never asked for it
— it targets the `maxAchievableBonds` computation only. Out of scope here.

### Testing approach — extend the existing mirror-function test file

`GameRoom` isn't instantiable outside a live Colyseus room (confirmed, same constraint noted
in stories 4.12 and 5.8). `apps/simulation-server/tests/game-room-level-clear-guard.test.ts`
already has an `allBondsAtBossStart` mirror function (added by Story 5.8) — reuse it
unchanged, and add a small mirror of the new snapshot-resolution logic:

```ts
/**
 * Mirrors the bondEligiblePlayerCount snapshot resolution in loadLevel's boss branch
 * (Story 5.9, D-5.8-A): playerCount must come from the roster snapshotted at first bond
 * assignment, not the live roster at boss-start.
 */
function resolvePlayerCountForBondCheck(bondEligiblePlayerCount: number, livePlayerCount: number): number {
  return bondEligiblePlayerCount >= 2 ? bondEligiblePlayerCount : livePlayerCount;
}

describe('GameRoom — bondEligiblePlayerCount snapshot resolution (Story 5.9, D-5.8-A)', () => {
  it('uses the snapshot over the live roster once a snapshot exists', () => {
    expect(resolvePlayerCountForBondCheck(2, 3)).toBe(2);
  });

  it('fixes the D-5.8-A scenario: a late-joining 3rd player no longer inflates maxAchievableBonds', () => {
    // 2-player session assigns its 1 achievable bond; a 3rd player joins before boss start.
    const resolvedPlayerCount = resolvePlayerCountForBondCheck(2, 3);
    expect(allBondsAtBossStart(1, resolvedPlayerCount)).toBe(true); // was false pre-fix (live count = 3)
  });

  it('falls back to the live count when no snapshot exists yet (defensive; not expected at boss-start in practice)', () => {
    expect(resolvePlayerCountForBondCheck(-1, 3)).toBe(3);
  });

  it('unchanged for a stable roster (common case): snapshot equals live count', () => {
    expect(resolvePlayerCountForBondCheck(3, 3)).toBe(3);
  });
});
```

Add this to the same file as the existing `allBondsAtBossStart` block (Story 5.8's block,
~line 66) — do not create a new test file for one additional describe block.

### Project Structure Notes

- Single-file production change (`GameRoom.ts`), one existing test file extended — no new
  files, no new directories, no new exports, no new dependencies.
- `bondEligiblePlayerCount` follows the exact existing pattern of `bondMomentNextLevel`
  (private `GameRoom` field, `-1` sentinel, reset in `startDungeon`) — no new state-management
  idiom introduced.

### Project Context Rules

- **Ownership**: change confined to `apps/simulation-server/**`, owned by Simulation
  Engineer — single ownership area, no cross-context approval needed.
- **Simulation-safety hook**: triggered because `GameRoom.ts` is modified. Typecheck and full
  unit test suite required; deterministic tick test N/A (no PRNG/tick-order change); replay
  test N/A (no wire-format change — `allBondsAtBossStart`'s shape in `SnapshotMsg` is
  unchanged, only its computed value is now correct in the join/leave-during-run edge case).
- **Contract-change hook**: not triggered — no `shared-types`/`net-protocol` change, and this
  story explicitly does not touch session lifecycle, reconnect, or room-state/join-flow
  behavior (see Non-goals).
- **Result<T, E> rule**: not applicable — no new function that can fail; this is a direct
  field read/write inside `GameRoom`, matching `bondMomentNextLevel`'s existing pattern.
- **Tick loop hygiene**: not applicable — `enterBondMoment`/`loadLevel` run once per level
  transition or bond-moment, not inside the 30Hz `tick()` loop.
- **Testing Rules**: unit tests for `GameRoom`-internal logic that can't be exercised by
  instantiating the class directly live in `apps/simulation-server/tests/`, using the
  established mirrored-logic pattern (`game-room-level-clear-guard.test.ts`,
  `game-room-post-410-deferred-hardening.test.ts`).

### Previous Story Intelligence (from 5.8)

- Story 5.8 (the story whose code review produced D-5.8-A) established the
  `maxAchievableBonds` player-count-aware formula this story feeds a corrected input into —
  do not change the formula itself (`Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)`),
  only the `playerCount` source.
- 5.8's own Non-goals repeatedly rejected adding a general combinatorics helper or expanding
  scope beyond the specific 2-vs-3+-player distinction — this story follows the same
  discipline, changing only what feeds the existing branch.
- 5.8's `game-room-level-clear-guard.test.ts` additions established the exact mirror-function
  test pattern this story extends (GameRoom isn't instantiable — replicate the logic
  directly, same file, same style).
- 5.8's code review already flagged D-5.8-A as "cosmetic-achievement impact only, explicitly
  out of Task 3's Non-goals" when deferring it — this story is the intentional follow-up that
  Non-goals language pointed to.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 5-8-epic-5-post-57-deferred-hardening (2026-07-07)] — D-5.8-A original finding and recommended fix
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#loadLevel] — boss branch, `maxAchievableBonds` computation (~line 1028-1039 as of baseline commit)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#enterBondMoment] — bond-assignment call site (~line 883-934), only call site confirmed via grep of `enterBondMoment(`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#startDungeon] — existing `bondMomentNextLevel` reset pattern this story's `bondEligiblePlayerCount` reset mirrors (~line 630-654)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#onJoin, #onLeave] — confirmed no phase guard on join (~line 431) and immediate consented-leave slot removal (~line 463-464), per D-5.8-A's cited root cause
- [Source: apps/simulation-server/tests/game-room-level-clear-guard.test.ts] — existing `allBondsAtBossStart` mirror-function test block (Story 5.8) this story extends
- [Source: _bmad-output/implementation-artifacts/5-8-epic-5-post-57-deferred-hardening.md] — immediately prior story in this epic; originated D-5.8-A during its own code review
- [Source: _bmad-output/implementation-artifacts/4-12-full-hp-restore-on-level-transition.md] — precedent for a small, single-file, single-finding hardening story's scope and size
- [Source: _bmad-output/project-context.md#Testing Rules, #Code Organization Rules] — test category placement, monorepo ownership boundaries

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

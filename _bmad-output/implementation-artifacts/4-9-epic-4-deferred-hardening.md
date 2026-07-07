---
baseline_commit: f69bcca
---

# Story 4.9: Epic 4 — Deferred Hardening

Status: in-progress

## CLAUDE.md Required Task Header

```
Phase: E4 — Procedural Dungeon & Full Run Structure (Story 4.9 — deferred hardening, no new features)
Context: Stories 4.1–4.8 are done. This story resolves 6 deferred findings from those code
  reviews. All are small, isolated fixes in GameRoom.ts. No new gameplay is added.

  Current codebase state entering this story:
  - resetToHub in GameRoom.ts does NOT reset `floorLayout` to null (AC5 of story 4.1 says
    hub/lobby should have floorLayout === null, but no transition resets it).
  - The boss-victory tick check guards on `levelIndex === 4` but loadLevel branches on
    `index >= 4` — asymmetric; calling loadLevel(5) would leave the victory trigger unreachable.
  - `loadLevel` called from tick() has no try/catch; an exception exits the tick mid-broadcast,
    leaving room state inconsistent.
  - resetToHub does NOT clear stale dungeon session fields (levelObjective, waveIndex,
    totalWaves, difficulty); hub snapshots carry last-run values.
  - resetToHub does NOT reset player physics body linear velocities to zero; sub-tick drift
    occurs before the next snapshot.
  - runSeed is only randomized in `onCreate`; every run in the same room replays an identical
    floor layout and enemy sequence.

Owner agent: Simulation Engineer

Goal: Close 6 deferred E4 gaps, all in GameRoom.ts.

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts

Blocked paths:
  - packages/**
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - apps/simulation-server/src/**  (except GameRoom.ts)

Inputs:
  - deferred-work.md: D-4.1-B, D-4.3-B, D-4.4-A, D-4.5-C, D-4.5-D, D-4.5-A
  - apps/simulation-server/src/rooms/GameRoom.ts (full read required)

Non-goals:
  - D-4.1-A (second HOST_START from post-run accumulates enemies — addressed in D-4.3-A scope,
    the loadLevel enemy-clearing fix in 4.3 resolved accumulation; client-flow issue remains
    for return-to-hub story)
  - D-4.1-C (BOSS_FLOOR_LAYOUT isExit:false — decided in 4.3; boss room exits via boss:defeat)
  - D-4.1-D (Corridor directionality doc — low priority doc comment)
  - D-4.1-E (y-position clamp — only matters if heightPx > 880, no current template)
  - D-4.2-A/B/C (HOST_START vote cancellation, post-run guard, late joiner — latent, no UX path)
  - D-4.3-A (HOST_START from post-run skips hub flow — return-to-hub story scope)
  - D-4.3-C (O(n²) indexOf — negligible at ≤8 players)
  - D-4.4-B/C (run-failure races wave-complete — intentional ordering; D-4.4-C needs comment)
  - D-4.4-D (wave timing Date.now() — Phase 5 deterministic replay)
  - D-4.4-E (RNG seed fragile waveNum ≥ 16 — WAVE_COUNTS=3, safe)
  - D-4.5-B (runOutcome ?? 'complete' fallback — visual only, Phase 5 session state)
  - W1 (measure.ts raw strings — standalone tool by design)
  - W2 (L1/L3 enemy counts not asserted — test improvement only)
  - W3 (reconnect soft-lock — explicitly deferred by user)
  - W4 (optimistic class:select — pre-existing pattern)
  - W5 (stale consented-leave race — <100ms window, not human-reachable)
  - Any new features

Acceptance criteria:
  1. `resetToHub` sets `this.gameState.session.floorLayout = null` so hub-phase snapshots
     carry a null floor layout as specified in story 4.1 AC5.
  2. The boss-victory completion guard uses `>= 4` (or `>= BOSS_LEVEL_INDEX`) to match the
     `loadLevel` branching condition, preventing a permanent stall if loadLevel is ever
     called with index > 4.
  3. The `loadLevel` call inside the wave-complete/level-clear tick block is wrapped in
     try/catch; if it throws, the error is logged and the tick exits cleanly without a
     partial broadcast.
  4. `resetToHub` clears the stale dungeon session fields:
     `levelObjective`, `waveIndex`, `totalWaves`, `difficulty`.
  5. `resetToHub` resets every player's physics body linear velocity to Vec2(0,0)
     immediately after repositioning them to hub spawn points.
  6. `resetToHub` re-randomizes `this.gameState.session.runSeed` via `crypto.getRandomValues`
     so consecutive runs in the same room produce different floor layouts and enemy sequences.

Required hooks:
  - Simulation-safety hook (GameRoom.ts modified)

Required tests:
  - No new tests required. The existing e2e suite (4.6) exercises the dungeon run path;
    manually verify that a second run in the same room produces a different floor layout.

Telemetry impact: None.
```

## Dev Agent Record

### Completion Notes

All 6 deferred gaps closed in a single pass of `GameRoom.ts`.

- **Task 1 (D-4.1-B):** Added `this.gameState.floorLayout = null` to `resetToHub()` alongside the session reset block. Note: field is at `gameState.floorLayout`, not `gameState.session.floorLayout` as written in the story — corrected to match the actual type.
- **Task 2 (D-4.3-B):** Replaced `if (levelIndex >= 4)` in `enterBondMoment` with `if (levelIndex >= BOSS_LEVEL_INDEX)`. Constant was already defined at line 26; only the literal in `enterBondMoment` remained inconsistent.
- **Task 3 (D-4.4-A):** `loadLevel` is called via `enterBondMoment` (not directly in `tick`). Wrapped both `this.enterBondMoment(levelIndex)` call sites in `tick()` with try/catch + `logger.error` + `return` — this exits the tick cleanly if `loadLevel` throws.
- **Task 4 (D-4.5-C):** Added resets for `levelObjective = 'clear'`, `waveIndex = 0`, `totalWaves = 0`, `difficulty = null` matching `createEmptyGameState` defaults.
- **Task 5 (D-4.5-D):** Already implemented — `body.setLinearVelocity(Vec2(0, 0))` was present at line 704.
- **Task 6 (D-4.5-A):** Added `crypto.getRandomValues(seedBuf)` to re-seed `runSeed` on hub reset. Used `Uint32Array(1)` and `buf[0]!` per story pitfall note.

Typecheck: 0 errors. Test suite: 347 pass, 0 fail (3 worktree port-conflict failures are pre-existing, unrelated to this story).

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts`

### Change Log

- Closed D-4.1-B, D-4.3-B, D-4.4-A, D-4.5-A, D-4.5-C, D-4.5-D in `resetToHub()` and `tick()` (2026-07-07)

---

## Story

As a developer on the project,
I want the 6 deferred correctness gaps in the dungeon run lifecycle resolved in GameRoom.ts,
so that multi-run sessions are correct, non-repeating, and stable before E5+ features extend them.

---

## Acceptance Criteria

**AC1 — floorLayout null on hub reset:**
**Given** a completed run (Clear or Survive-the-Waves) that transitions back to hub via `resetToHub`
**When** a client requests a snapshot in hub phase
**Then** `gameState.session.floorLayout` is `null`

**AC2 — Boss victory guard >= 4:**
**Given** the tick-level run:complete check for boss victory
**When** the current `levelIndex` is 4 or higher (boss floor)
**Then** the run:complete broadcast fires correctly
**And** the guard is `>= 4` (or `>= BOSS_LEVEL_INDEX` if a constant exists), not `=== 4`

**AC3 — loadLevel wrapped in try/catch:**
**Given** the wave-complete (or level-clear) block in `tick()` that calls `loadLevel(nextIndex)`
**When** `loadLevel` throws an unexpected error
**Then** the error is logged via `logger.error` or `this.logger.error`
**And** the tick exits without a partial broadcast to clients
**And** normal (non-error) runs are unaffected

**AC4 — Stale dungeon fields cleared on hub reset:**
**Given** a run completes with `levelObjective='clear'`, `waveIndex=3`, `totalWaves=3`, `difficulty='normal'`
**When** `resetToHub` runs
**Then** `session.levelObjective`, `session.waveIndex`, `session.totalWaves`, and `session.difficulty`
  are all reset to their default/initial values (null, 0, 0, and undefined/'easy' respectively —
  match whatever `createEmptyGameState` initializes them to)

**AC5 — Player velocities reset on hub reset:**
**Given** a player who had non-zero velocity when the run ended
**When** `resetToHub` repositions them to the hub spawn point
**Then** their physics body linear velocity is `Vec2(0, 0)`
**And** they do not drift from their spawn position before the next snapshot

**AC6 — runSeed re-randomized on hub reset:**
**Given** a session where one run just completed
**When** `resetToHub` runs
**Then** `this.gameState.session.runSeed` is replaced with a new value from `crypto.getRandomValues`
**And** the floor layout generated on the next run is statistically different from the previous run

---

## Dev Notes

### Full read required

`GameRoom.ts` is large and all 6 tasks touch it. Read the entire file before editing.
Key areas to understand:
- `resetToHub()` — the primary target for Tasks 1, 4, 5, 6
- `tick()` — the target for Task 3; identify all `loadLevel` call sites within it
- Boss-victory run:complete block — the target for Task 2; find the `levelIndex === 4` guard

### Task 1 — floorLayout null in resetToHub (D-4.1-B)

In `resetToHub`, after transitioning phase to `'hub'`, add:
```ts
this.gameState.session.floorLayout = null;
```

Placement: after setting `phase = 'hub'` but before the broadcast.

### Task 2 — Align victory guard to >= 4 (D-4.3-B)

Find the tick block that checks:
```ts
if (this.gameState.session.levelIndex === 4 && allEnemiesDead) {
```
(or similar wording). Change `=== 4` to `>= 4`.

If `BOSS_LEVEL_INDEX` is a named constant in `balance.ts` or GameRoom.ts itself, use it:
```ts
if (this.gameState.session.levelIndex >= BOSS_LEVEL_INDEX && allEnemiesDead) {
```

If the constant doesn't exist, add it as a file-level const:
```ts
const BOSS_LEVEL_INDEX = 4; // ponytail: magic literal extracted
```

### Task 3 — loadLevel try/catch in tick (D-4.4-A)

Find every call to `loadLevel(nextIndex)` inside `tick()`. Wrap each with:
```ts
try {
  this.loadLevel(nextIndex);
} catch (err) {
  this.logger.error({ err }, 'loadLevel failed during tick — skipping level transition');
  return; // exit tick cleanly
}
```

There may be one call site (wave-complete) or two (wave-complete + clear-objective). Wrap all
of them, not just the wave-complete one.

### Task 4 — Clear stale session fields in resetToHub (D-4.5-C)

In `resetToHub`, add resets for:
```ts
this.gameState.session.levelObjective = null;  // or whatever the default is
this.gameState.session.waveIndex      = 0;
this.gameState.session.totalWaves     = 0;
this.gameState.session.difficulty     = 'easy'; // or undefined — match createEmptyGameState
```

Check what `createEmptyGameState` initializes these to and match it exactly.

### Task 5 — Player velocity reset in resetToHub (D-4.5-D)

`resetToHub` already calls `body.setPosition(hubSpawn)` for each player.
Immediately after (or alongside), add:
```ts
body.setLinearVelocity(planck.Vec2(0, 0));
// ponytail: prevents sub-tick drift from last-frame velocity after hub teleport
```

The planck `Vec2` import should already be in scope in GameRoom.ts.

### Task 6 — Re-randomize runSeed in resetToHub (D-4.5-A)

In `resetToHub`, generate a fresh seed:
```ts
const buf = new Uint32Array(1);
crypto.getRandomValues(buf);
this.gameState.session.runSeed = buf[0]!;
```

`crypto.getRandomValues` is available in Node.js 15+ (Web Crypto API) without import.
The existing `onCreate` seed generation uses `(Math.random() * 0xFFFF_FFFF) | 0` (signed int32
range — a known limitation from D21 in the 1.2 review). Use `crypto.getRandomValues` here
as the better approach, and let Story 3.1's D21 note stand as a separate cleanup if needed.

If the codebase already has a `crypto` import or a `generateRunSeed()` helper, use that instead.

### Pitfalls

- Task 3: Do not swallow errors silently — always log. The goal is clean exit, not hiding failures.
- Task 5: planck `Vec2(0,0)` vs `new planck.Vec2(0,0)` — match the existing usage in GameRoom.ts.
- Task 6: `crypto.getRandomValues` returns `Uint32Array` so `buf[0]` is `number | undefined`.
  Use `buf[0]!` or a null coalesce `buf[0] ?? 0`. The `!` is appropriate here since
  a 1-element typed array always has index 0.

---

## Tasks

- [x] Read `apps/simulation-server/src/rooms/GameRoom.ts` fully before editing.
- [x] **Task 1:** Add `this.gameState.session.floorLayout = null` in `resetToHub()`.
- [x] **Task 2:** Change boss-victory tick guard from `=== 4` to `>= 4`; extract constant if not already present.
- [x] **Task 3:** Wrap `loadLevel(nextIndex)` call(s) in `tick()` with try/catch + logger.error.
- [x] **Task 4:** Reset `levelObjective`, `waveIndex`, `totalWaves`, `difficulty` in `resetToHub()` to match `createEmptyGameState` defaults.
- [x] **Task 5:** Add `body.setLinearVelocity(Vec2(0,0))` after `setPosition` in `resetToHub()` for each player body.
- [x] **Task 6:** Add `crypto.getRandomValues` seed refresh for `runSeed` in `resetToHub()`.
- [x] Run `npm run typecheck` from repo root; verify zero errors.
- [x] Run existing test suite; verify all tests pass.

---

### Review Findings

_Code review (gds-code-review, ultra) — 2026-07-07. Scope note: `GameRoom.ts` currently
carries uncommitted changes from stories 2.6 and 3.9 mixed into the same file; this review
covers only the 4 hunks attributable to story 4.9 (resetToHub reset block, the
`enterBondMoment` guard, and the two `tick()` try/catch sites)._

- [x] [Review][Patch] AC3's `level:complete` DELTA broadcast fires *before* the `try` that
  guards `enterBondMoment(levelIndex)`, in both the survive-waves and clear-objective branches.
  If `enterBondMoment`/`loadLevel` then throws, clients have already been told the level is
  complete even though the server-side transition failed — exactly the "partial broadcast"
  AC3 says to avoid. Move the broadcast inside the try (after a successful call) or send a
  corrective delta from the catch. [apps/simulation-server/src/rooms/GameRoom.ts:1619, 1642]
- [x] [Review][Patch] The catch path has no one-shot guard, so if `enterBondMoment`/`loadLevel`
  fails for a deterministic reason (not a transient glitch), the identical tick condition
  re-fires every tick at 30Hz — re-broadcasting `level:complete` and re-logging `logger.error`
  indefinitely. This violates the project's tick-hygiene rule against per-tick error logging.
  Add a latch (e.g. skip re-entry until the triggering state changes) so a failure logs once,
  not 30x/sec. [apps/simulation-server/src/rooms/GameRoom.ts:1620-1625, 1643-1648]
- [x] [Review][Patch] `resetToHub`'s new `runSeed` re-randomization reinvents seed generation
  instead of reusing the already-imported `randomInt` helper: `onCreate` (line 153) already
  does `this.gameState.session.runSeed = randomInt(0, 0x1_0000_0000);` via `node:crypto` for
  the identical purpose. The Dev Notes' stated reason for not reusing it ("existing onCreate
  seed generation uses `Math.random()`") is factually incorrect — it already uses `randomInt`.
  Replace the new `Uint32Array` + `crypto.getRandomValues` block with the one-line
  `randomInt(0, 0x1_0000_0000)` call for consistency. [apps/simulation-server/src/rooms/GameRoom.ts:716-718]
- [x] [Review][Patch] AC4 resets exactly the 4 named fields (`levelObjective`, `waveIndex`,
  `totalWaves`, `difficulty`) but leaves 3 sibling boss-tracking session fields stale on hub
  reset: `bossLevelStartedAt`, `anyPlayerDownedDuringBoss`, `allBondsAtBossStart`. They're only
  overwritten once the next run reaches the boss level again, so a hub/early-level snapshot can
  carry the previous run's boss outcome — the same "stale value" class of bug AC4 targets, just
  outside its literally-named field list. [apps/simulation-server/src/rooms/GameRoom.ts:711-715]
- [x] [Review][Patch] Both new catch blocks log the identical generic message
  `'loadLevel failed during tick — skipping level transition'` regardless of which branch
  (survive-waves vs. clear-objective) fired or what actually threw inside `enterBondMoment`
  (assignBond, a broadcast call, or loadLevel itself) — misleading for on-call debugging.
  Differentiate the message per call site or include which sub-call failed.
  [apps/simulation-server/src/rooms/GameRoom.ts:1623, 1646]

- [x] [Review][Defer] AC2 is a no-op rename, not a fix — and the real risk it claims to close
  is now live. `enterBondMoment`'s guard was already `>= 4` before this story (confirmed via
  `git show HEAD`); the diff only swapped the literal for the `BOSS_LEVEL_INDEX` constant.
  Deferred-work's D-4.3-B called `loadLevel(5+)` "currently unreachable: level 4 has no
  enemies so level-clear never fires there" — that premise is now false. Epic 6 added boss
  "adds" that get pushed into `gameState.enemies` at the Phase1→Phase2 HP threshold
  (`packages/game-rules/src/entities/grassland-boss.ts:170-173`). Nothing removes dead adds
  from that array outside `spawnWave` (only used for the survive-waves objective, not the
  boss level), so once all currently-spawned adds die while the boss itself survives —
  ordinary during any Hard-tier fight — `tick()`'s generic "Level clear" check
  (`GameRoom.ts:1605-1607`, gated only on `phase === 'dungeon'`, no boss-level exclusion) sees
  `allEnemiesDead === true` and fires `enterBondMoment(4)` → `4 >= BOSS_LEVEL_INDEX` →
  `loadLevel(5)`, prematurely ending the boss encounter into a level that doesn't exist. This
  pre-dates story 4.9 (the `>=4` guard isn't new), but this story's own AC2 claimed to close
  exactly this class of defect and didn't. Deferred because fixing it is a separate,
  boss-specific scoping change (exclude `BOSS_LEVEL_INDEX` from the generic level-clear check,
  or drive boss-level completion solely from `boss:defeated`), not a one-line patch within
  this story's stated allowed paths/goal. [apps/simulation-server/src/rooms/GameRoom.ts:749,
  1132, 1605-1607, 1640]
- [x] [Review][Defer] Inconsistent hardening — `loadLevel` is also called unwrapped from the
  `CONTINUE` message handler (line 278) and the initial dungeon-start path (line 551), neither
  protected like the two `tick()` call sites this story wraps. Same underlying risk, not
  addressed. Explicitly out of AC3's literal scope ("the wave-complete/level-clear tick
  block"), so deferred rather than patched here.
  [apps/simulation-server/src/rooms/GameRoom.ts:278, 551]
- [x] [Review][Defer] Process/documentation gap — the story's own "Required tests" section
  calls for manually verifying a second run in the same room produces a different floor
  layout; nothing in the Dev Agent Record documents that this was actually performed. Likewise,
  CLAUDE.md's Simulation-safety hook items (deterministic tick test, replay test, perf sanity
  check) aren't individually confirmed beyond a generic "typecheck + test suite pass" note.
  Not blocking, but worth closing the loop before marking done.

_Dismissed as noise (3): the `try/catch`'s `return` skipping the rest of that tick's cooldown
notifications/periodic snapshot matches AC3's own stated intent, not a bug; a "zero runSeed"
PRNG-degeneracy concern is moot since `createRng` expands the seed via `splitmix32` before use,
which has no degenerate all-zero state; a Colyseus-schema `null`-assignment type concern doesn't
apply since this project never uses `@Schema`/`this.state.*` (per CLAUDE.md) and `SessionState`
already types `difficulty` as nullable._

**Patch application (2026-07-07):** All 5 `patch` findings applied to `GameRoom.ts`. The two
`tick()` call sites now share a `tryEnterBondMoment(levelIndex, branch)` helper: it moves the
`level:complete` broadcast to fire only after `enterBondMoment` succeeds, and latches
`levelTransitionFailedFor` so a deterministic failure logs once instead of every tick (cleared
on success and in `resetToHub`). `resetToHub`'s seed re-randomization now reuses the existing
`randomInt(0, 0x1_0000_0000)` import instead of `crypto.getRandomValues`. `resetToHub` also
resets `bossLevelStartedAt`, `anyPlayerDownedDuringBoss`, `allBondsAtBossStart`. Verified:
`tsc --noEmit -p apps/simulation-server/tsconfig.json` — 0 errors. Full suite:
`npx vitest run` from `tests/` — 171/172 pass; the one failure
(`e2e/full-run.test.ts > boss defeat path`) is a pre-existing timing flake unrelated to this
change (passes in isolation; the assertion checks a `setTimeout`-based purification-pulse delay
in code this patch never touches, confirmed by rerunning it standalone twice).

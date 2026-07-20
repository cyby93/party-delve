---
baseline_commit: 3d22e41a41a9fae1f18e86c72cca8529ae173c96
---

# Story 4.14: Epic 4 — Post-4.13 Deferred Hardening

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E4 — Procedural Dungeon & Full Run Structure (Story 4.14 — post-4.13 deferred
  hardening, no new features)
Context: Story 4.11 closed the last epic-4 hardening backlog (D-4.10-A through D-4.10-E).
  Its own code review deferred 2 new findings (D-4.11-A, D-4.11-B). Two non-hardening
  feature stories shipped since (4.12 full-HP-restore-on-level-transition, 4.13
  vote-accept-button-submitted-state), each deferring 1 new finding of their own
  (D1-4.12, D1-4.13). This story sweeps all 4 open items. All 4 were re-verified against
  the CURRENT codebase before being scoped in below — none were taken on the deferred-work
  file's text alone.

  - **D-4.11-A (confirmed still open):** `loadLevel`'s level-2 (survive-waves) and default
    (clear) branches still commit `session.levelIndex = index` before their own risky calls
    (`spawnWave`/`spawnEnemies`, both of which create planck.js physics bodies and can
    throw) — the exact ordering risk 4.11's AC4 fixed for the boss branch only, per its own
    explicit scope note ("only the boss branch has this ordering risk").
  - **D-4.11-B (confirmed still open):** `resetToHub()` destroys enemy/essence/victory-
    trigger/bond-sensor physics bodies but never destroys `this.bossBody`/
    `this.arenaWallBodies`. Only `loadLevel` (unconditionally, at the top, for any level)
    and the `boss:defeated` handler (`bossBody` only, not `arenaWallBodies`) ever destroy
    them. A boss-branch construction failure mid-`loadLevel` (loadBossArena succeeds,
    subsequent body/fixture creation throws) leaves orphaned arena-wall bodies alive in the
    physics world until the next `loadLevel` call — `resetToHub()` running in between does
    not clean them up.
  - **D1-4.12 (confirmed still open):** `loadLevel`'s per-player reset loop restores every
    player's `hp` to `maxHp` and clears `isDown`/`isSpirit` for the down/spirit subset, but
    never touches `isFrozen` — unlike `resetToHub()`, which explicitly sets
    `player.isFrozen = false`. A disconnected/frozen player passing through a level
    transition keeps `isFrozen === true` indefinitely.
  - **D1-4.13 (confirmed still open):** `startDungeon`'s catch block (the failure path for
    a `loadLevel(1)`/floor-layout throw) reverts `phase`/`difficulty`/`runProposal` and
    clears `runVotes`, but never broadcasts anything. Since 4.13 added mobile's optimistic
    `VotePopup` `hasAccepted` pending state, and `runProposal` is restored to the SAME
    non-null proposal object (deliberately, per 4.11's AC2, so a fresh vote can retry), the
    popup's render condition (`runProposal !== null`) never flips, so the component never
    unmounts and `hasAccepted` never resets — the tapping player's Accept button is stuck on
    "Waiting..." (`pointerEvents: 'none'`) indefinitely, with no recovery short of a
    reconnect.

  Re-verified as ALREADY RESOLVED, not re-scoped here (see Non-goals):
  - **D-4.9-A** ("boss level prematurely ends when adds die but the boss survives") — read
    the current generic level-clear check directly
    (`apps/simulation-server/src/rooms/GameRoom.ts`, tick()'s "Level clear / wave objective
    check" block, clear-objective branch): it now reads
    `if (this.gameState.session.levelIndex !== BOSS_LEVEL_INDEX && this.bondMomentNextLevel
    === -1 && allEnemiesDead)`, with an explicit comment "Boss-level completion is driven
    solely by the `boss:defeated` event from `tickBoss` ... never by this generic check."
    This is exactly the fix 4.10's AC1 introduced. Confirmed resolved — no action taken.

  Current codebase state entering this story (all in
  apps/simulation-server/src/rooms/GameRoom.ts unless noted):
  - `loadLevel`'s boss branch (~line 1028-1060) already defers `session.levelIndex = index`
    to its last line, after `gameState.boss` is assigned (4.11's fix). The level-2 branch
    (~line 1061-1070) and default branch (~line 1071-1080) both still assign
    `this.gameState.session.levelIndex = index` as their FIRST statement, before
    `spawnWave`/`spawnEnemies`.
  - `resetToHub()` (~line 763-881) has no reference to `this.bossBody` or
    `this.arenaWallBodies` anywhere in its body.
  - `loadLevel`'s per-player reset loop (~line 1007-1026) sets `player.hp = player.maxHp`
    unconditionally (4.12's fix) but has no `player.isFrozen = false` anywhere in the loop.
  - `startDungeon`'s catch block (~line 645-655) reverts `phase`/`difficulty`/`runProposal`
    and calls `this.runVotes.clear()`, then `logger.error(...); return;` — no
    `this.broadcast(...)` call of any kind.
  - `apps/mobile-controller/src/screens/ControllerScreen.tsx`'s `VotePopup` (~line 574-622)
    has a local `hasAccepted` boolean with no reset mechanism; it is rendered at ~line
    1517-1524 gated only on `(gameState?.runProposal ?? null) !== null`.

Owner agent: Multi-context (explicit cross-context approval, following this project's
  established precedent of bundling small, low-risk, clearly-scoped hardening fixes into one
  story — see 3-22-epic-3-post-321-deferred-hardening.md, 3-9/3-10, 1-8/1-9, 5-7/5-8,
  4-9/4-10/4-11):
  Simulation Engineer (Tasks 1-3 — apps/simulation-server/src/rooms/GameRoom.ts)
  Mobile Controller Engineer (Task 4 — apps/mobile-controller/src/screens/ControllerScreen.tsx)

  Ownership scope note: Task 4 is the only item outside apps/simulation-server. It was
  deliberately kept client-side-only (a bounded UI recovery timeout, no protocol/shared-types
  change) specifically so this story does not also require a Protocol Architect review — see
  Non-goals for why the "add a server broadcast on failure" alternative was rejected.

Goal: Close all 4 confirmed-open deferred findings with minimal diffs: defer levelIndex
  commits in loadLevel's remaining 2 branches (mirroring 4.11's boss-branch pattern exactly),
  destroy boss physics bodies in resetToHub, clear isFrozen on level transition, and give
  VotePopup a bounded self-recovery timeout.

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/simulation-server/tests/**  (new/updated unit tests)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx

Blocked paths:
  - packages/**
  - apps/host-client/**
  - apps/backend-platform/**
  - tests/e2e/**  (no e2e repro required — see Non-goals)

Inputs:
  - deferred-work.md: D-4.11-A, D-4.11-B (under "Deferred from: code review of
    4-11-epic-4-post-410-deferred-hardening"); D1 (under "Deferred from: code review of
    4-12-full-hp-restore-on-level-transition"); D1 (under "Deferred from: code review of
    4-13-vote-accept-button-submitted-state")
  - apps/simulation-server/src/rooms/GameRoom.ts — read `loadLevel` in full (~954-1081,
    especially the boss/level-2/default branches), `resetToHub` in full (~763-881),
    `startDungeon` in full (~630-664); confirm exact current line numbers before editing
    (drift is expected from prior stories' diffs)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx — read `VotePopup` (~574-622)
    and its render site (~1517-1524) in full
  - 4-11-epic-4-post-410-deferred-hardening.md — established the exact "defer the
    levelIndex commit past the risky call" pattern Task 1 re-applies; established the
    mirrored-logic unit-test pattern (GameRoom isn't instantiable outside a live Colyseus
    room) Tasks 1-3's tests follow
  - game-room-post-410-deferred-hardening.test.ts, game-room-level-transition-hp.test.ts —
    existing mirrored-logic test examples to follow for the new test file

Non-goals:
  - Do not add a `session.levelIndex`-gating change to the level-2/default branches' OTHER
    fields (`levelObjective`, `waveIndex`, `totalWaves`). Per 4.11's own established
    precedent for the boss branch ("do not also move those three fields... cheap,
    non-externally-visible bookkeeping writes that don't gate any other guard"), only the
    field that other guards actually key off (`session.levelIndex`, read by the generic
    level-clear check and `tickBoss`) needs to move. `levelObjective`/wave-count fields stay
    where they are.
  - Do not add a client-facing `level:load-failed`-style delta or any other new wire message
    for Task 4. `startDungeon`'s catch-path silence is a deliberate design choice from
    4.11's own AC2 ("no run:starting or snapshot broadcast fires" on failure) — reversing it
    to add a broadcast would not even fully fix the mobile bug on its own (React only
    remounts `VotePopup` when `runProposal` transitions to/from `null`, and 4.11's AC2 design
    intentionally restores the SAME non-null proposal so a fresh vote can retry — a broadcast
    alone would not flip that condition). Do not touch `packages/net-protocol/**` or
    `packages/shared-types/**` for this story; keep Task 4 entirely client-side.
  - Do not build a full e2e repro of any of these 4 failure paths (matches 4.11's own
    Non-goals: no existing test hook exists to force `spawnWave`/`spawnEnemies`/boss-body
    creation/`loadLevel(1)` to fail on demand). Follow 4.11's precedent: unit-level tests
    that mirror the guard/ordering logic directly.
  - Do not add an automated test for Task 4 (mobile-controller). This app has no existing
    test harness of any kind (`apps/mobile-controller/package.json` defines no test script,
    and no `*.test.*` file exists anywhere under `apps/mobile-controller/`) — introducing one
    is out of scope for a 1-file UI hardening fix. Verify Task 4 manually per the Client-UX
    hook instead (see Required hooks).
  - Do not attempt to fix `gameState.boss` itself lingering (non-null, `isDefeated: true`)
    between `boss:defeated` and the next `loadLevel` call in resetToHub. This was NOT named
    by D-4.11-B (which only calls out `bossBody`/`arenaWallBodies`, the physics-body leak) —
    `gameState.boss` is inert serialized state, not a physics resource, and is already
    cleared unconditionally at the top of every `loadLevel` call regardless of which level is
    being loaded. Expanding scope to this un-flagged item is not warranted for a hardening
    story.

Acceptance criteria:
  1. In `loadLevel`'s level-2 (survive-waves) branch, `this.gameState.session.levelIndex =
     index` is assigned only after `this.spawnWave(1, 'mid', index)` returns without
     throwing (moved from the branch's first statement to its last). In the default (clear)
     branch, `this.gameState.session.levelIndex = index` is assigned only after
     `this.spawnEnemies(tier, index)` returns without throwing (same move). The boss branch
     (already fixed by 4.11) and every other field in both branches (`levelObjective`,
     `waveIndex`, `totalWaves`, and their `gameState.session` mirrors) are unchanged in
     position.
  2. `resetToHub()` destroys `this.bossBody` (if non-null, via
     `this.physicsWorld.destroyBody`, then sets it to `null`) and every body in
     `this.arenaWallBodies` (then clears the array), mirroring `loadLevel`'s existing
     equivalent cleanup block exactly.
  3. `loadLevel`'s per-player reset loop sets `player.isFrozen = false` unconditionally for
     every player (matching the existing unconditional `player.hp = player.maxHp` line added
     by Story 4.12, and matching `resetToHub()`'s existing `player.isFrozen = false`
     precedent).
  4. `VotePopup` (`apps/mobile-controller/src/screens/ControllerScreen.tsx`) starts a bounded
     timeout when `hasAccepted` becomes `true`; if the component is still mounted (vote not
     yet resolved) when the timeout elapses, `hasAccepted` resets to `false`, re-enabling the
     Accept button. The timeout is cleared on unmount and whenever `hasAccepted` is `false`
     (no leaked timer). This applies uniformly regardless of failure cause (server-side
     `startDungeon` throw, or `session` being null/undefined at tap time) — no new
     server-side or protocol signal is required.
  5. New/updated unit tests in `apps/simulation-server/tests/` prove: (a) AC1's
     levelIndex-commit-after-success ordering for BOTH the level-2 and default branches
     (mirroring 4.11's own boss-branch test pattern), (b) AC2's boss-body/arena-wall
     destruction in the mirrored `resetToHub` logic, (c) AC3's `isFrozen` clearing in the
     mirrored per-player reset-loop logic.
  6. Full monorepo typecheck and test suite pass with no regressions.

Required hooks:
  - Simulation-safety hook (GameRoom.ts modified — typecheck, unit tests, deterministic tick
    test N/A [no PRNG/tick-order change], replay test N/A [no wire-format/delta-shape
    change], perf sanity check N/A [reordering existing one-shot `loadLevel`/`resetToHub`
    mutations, no new per-tick cost])
  - Client-UX hook (ControllerScreen.tsx modified — mobile checks only, since Task 4 is a
    controller-only change: reconnect/skill-mapping/joystick checks are unaffected; the
    relevant check is "does the Accept button ever get permanently stuck, and does the
    bounded-timeout recovery feel reasonable, not jarring, if it fires during a normal slow
    vote resolution." No display device available in this dev sandbox per this project's
    established pattern for mobile-controller stories (see dev-3's Dev Agent Record) — verify
    by code trace (confirm the timeout duration comfortably exceeds a normal same-LAN
    round-trip) and note in Dev Agent Record that a live-device pass is still recommended.

Required tests:
  - New/updated unit tests (apps/simulation-server/tests/, e.g. extending or creating
    `game-room-post-413-deferred-hardening.test.ts`) per AC5 above.
  - No changes expected to existing e2e/unit/contract tests for the happy paths (successful
    level 2/3 load, successful resetToHub, successful level-transition reset, successful
    vote-and-start) — this story only changes behavior on exception/failure/timeout paths.
    Confirm by running the full suite.
  - No automated test for Task 4 — see Non-goals.

Telemetry impact: None — no new user-facing event, no payload change. Task 4's timeout is
  purely a client-local UI-state recovery with no new broadcast, delta, or telemetry event.
```

---

## Story

As a developer on the project,
I want the 4 confirmed-open deferred findings from Stories 4.11, 4.12, and 4.13 resolved,
so that a partial `loadLevel` failure in the level-2/default branches can no longer commit
`levelIndex` ahead of a throwing physics-body call, a boss-arena construction failure can no
longer leak physics bodies past an intervening `resetToHub()`, a frozen/disconnected player
can no longer carry a stale freeze flag through a level transition, and a failed dungeon-start
attempt can no longer permanently strand a mobile player's Accept button on "Waiting...".

---

## Acceptance Criteria

**AC1 — level-2/default branches defer levelIndex commit past their risky call:**
**Given** `loadLevel`'s level-2 (survive-waves) branch
**When** `this.spawnWave(1, 'mid', index)` throws
**Then** `this.gameState.session.levelIndex` has NOT been mutated to `index`
**And given** the default (clear) branch, **when** `this.spawnEnemies(tier, index)` throws,
**then** `this.gameState.session.levelIndex` has NOT been mutated to `index` either
**And** on success in both branches, `levelIndex` IS updated (same effective end state as
before this story — only the ordering relative to the throwing call changes)

**AC2 — resetToHub destroys boss physics bodies:**
**Given** `this.bossBody` and/or `this.arenaWallBodies` are non-null/non-empty when
`resetToHub()` runs
**When** `resetToHub()` executes
**Then** `this.bossBody` is destroyed via `this.physicsWorld.destroyBody` and set to `null`
**And** every body in `this.arenaWallBodies` is destroyed and the array is cleared
**And** if both were already `null`/empty, `resetToHub()` behaves exactly as before (no-op
guard, matching `loadLevel`'s existing equivalent block)

**AC3 — loadLevel's reset loop clears isFrozen:**
**Given** any player passing through `loadLevel`'s per-player reset loop
**When** the loop runs
**Then** `player.isFrozen` is set to `false` unconditionally for every player (not gated on
`isDown`/`isSpirit`), matching the existing unconditional `player.hp = player.maxHp` line

**AC4 — VotePopup self-recovers from a stuck pending state:**
**Given** a player taps Accept (`hasAccepted` becomes `true`)
**When** 6 seconds elapse with the component still mounted (the vote never resolved —
`gameState.runProposal` never became `null` and the screen never left the popup)
**Then** `hasAccepted` resets to `false`, re-enabling the Accept button
**And** the timeout is cleared if the component unmounts first (successful vote resolution)
**And** re-tapping Accept after a reset restarts the same bounded recovery cycle

**AC5 — Regression-safe with new coverage:**
**Given** AC1-AC3's ordering/cleanup fixes
**When** the full monorepo typecheck and Vitest suite run
**Then** all existing tests pass unchanged, and new unit tests prove all three simulation-
server fixes' behavior per the task header's Required tests

---

## Dev Notes

### Context

Story 4.11 closed the last epic-4 hardening backlog and deferred 2 new findings from its own
review (D-4.11-A, D-4.11-B). Since then, 2 feature stories shipped (4.12, 4.13), each
deferring exactly 1 finding from its own review. This story is the sweep — 4 items total, all
re-verified against current source before being scoped in (see the task header's "Re-verified
as ALREADY RESOLVED" note for the one candidate — D-4.9-A — that was checked and found to no
longer apply; it is NOT part of this story's scope).

**D-4.11-A** is the direct continuation of 4.11's own AC4 fix. 4.11 deferred `levelIndex`'s
commit in the boss branch until after boss construction succeeds, but explicitly left the
level-2/default branches alone ("only the boss branch has this ordering risk, per D-4.10-D").
This story closes that gap by applying the identical pattern to the other 2 branches.

**D-4.11-B** is a physics-resource leak, not a state-consistency bug: a boss-construction
failure (now non-deadlocking, thanks to 4.10/4.11) can still leave `arenaWallBodies` alive in
the physics world if `resetToHub()` runs before the room's next `loadLevel` call.

**D1-4.12** predates 4.12 (the reset loop never touched `isFrozen`, before or after that
story's HP-restore diff) but is newly worth closing now: 4.12 made the reset loop apply to
*every* player unconditionally (healing + repositioning), which makes the missing
`isFrozen` clear more visible as an inconsistency with that same loop's new "every player"
scope.

**D1-4.13** is the most subtle of the 4. Read `startDungeon`'s catch block and `VotePopup`
together before touching either:
- `startDungeon`'s catch (own `apps/simulation-server/src/rooms/GameRoom.ts`) reverts
  `runProposal` to the SAME proposal object that was there before the (now-failed) attempt —
  by design, per 4.11's AC2, so a fresh vote can retry without the host re-proposing.
- `VotePopup` renders based on `(gameState?.runProposal ?? null) !== null`. Since the
  reverted `runProposal` is non-null (same as before the failed attempt), this condition
  never flips false→true→false, so React never unmounts/remounts the component, so the
  local `hasAccepted` state never resets — even if a broadcast were added.
- This means a server-side broadcast fix is a dead end on its own (see Non-goals for why).
  The fix that actually resolves the user-facing symptom is a bounded client-side recovery
  timeout, entirely inside `VotePopup`.

### Task 1 — level-2/default branches defer levelIndex commit (AC1)

**File:** `apps/simulation-server/src/rooms/GameRoom.ts`, `loadLevel` (~line 954-1081).

**Current code** (verified today, ~line 1061-1080):
```ts
} else if (index === 2) {
  this.gameState.session.levelIndex = index;
  this.levelObjective = 'survive-waves';
  this.totalWaves = WAVE_COUNTS['mid'];
  this.waveIndex = 0;
  this.wavePauseUntil = 0;
  this.gameState.session.levelObjective = 'survive-waves';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = this.totalWaves;
  this.spawnWave(1, 'mid', index);
} else {
  this.gameState.session.levelIndex = index;
  this.levelObjective = 'clear';
  this.waveIndex = 0; this.totalWaves = 0; this.wavePauseUntil = 0;
  this.gameState.session.levelObjective = 'clear';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = 0;
  const tier = index === 1 ? 'early' : 'late';
  this.spawnEnemies(tier, index);
}
```

**After** — move only the `levelIndex` line to the end of each branch (mirrors the boss
branch's existing 4.11 fix exactly):
```ts
} else if (index === 2) {
  this.levelObjective = 'survive-waves';
  this.totalWaves = WAVE_COUNTS['mid'];
  this.waveIndex = 0;
  this.wavePauseUntil = 0;
  this.gameState.session.levelObjective = 'survive-waves';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = this.totalWaves;
  this.spawnWave(1, 'mid', index);
  this.gameState.session.levelIndex = index; // commit only after spawnWave succeeds
} else {
  this.levelObjective = 'clear';
  this.waveIndex = 0; this.totalWaves = 0; this.wavePauseUntil = 0;
  this.gameState.session.levelObjective = 'clear';
  this.gameState.session.waveIndex = 0;
  this.gameState.session.totalWaves = 0;
  const tier = index === 1 ? 'early' : 'late';
  this.spawnEnemies(tier, index);
  this.gameState.session.levelIndex = index; // commit only after spawnEnemies succeeds
}
```
Do not touch anything else in either branch — only the `levelIndex` line's position moves,
exactly matching the diff shape 4.11 applied to the boss branch.

### Task 2 — resetToHub destroys boss physics bodies (AC2)

**File:** `apps/simulation-server/src/rooms/GameRoom.ts`, `resetToHub()` (~line 763-881).

Add a block mirroring `loadLevel`'s existing boss-cleanup block (~line 991-999) — insert it
among `resetToHub`'s other body-cleanup blocks (near the essence-sensor/victory-trigger
cleanup, before the "Clear game state arrays" comment):
```ts
// Destroy boss body and arena walls if a run ended mid-boss-fight or boss construction
// failed partway through (Story 4.14 — mirrors loadLevel's equivalent cleanup block)
if (this.bossBody) {
  this.physicsWorld.destroyBody(this.bossBody);
  this.bossBody = null;
}
for (const wall of this.arenaWallBodies) this.physicsWorld.destroyBody(wall);
this.arenaWallBodies.length = 0;
```
Do not add a `this.gameState.boss = null` line here — that is out of this story's scope (see
Non-goals); this task is strictly about the 2 physics-body fields D-4.11-B named.

### Task 3 — loadLevel's reset loop clears isFrozen (AC3)

**File:** `apps/simulation-server/src/rooms/GameRoom.ts`, `loadLevel`'s per-player reset loop
(~line 1007-1026).

**Current code** (verified today):
```ts
for (const player of this.gameState.players) {
  if (player.isDown || player.isSpirit) {
    const wasSpirit = player.isSpirit;
    player.isDown = false;
    player.isSpirit = false;
    player.reviveTimerExpiresAt = 0;
    if (wasSpirit) this.flushExpiredClassCooldowns(player.id);
  }
  // Full HP restore on every level transition (Story 4.12) — applies to every player,
  // not only the isDown/isSpirit subset; matches resetToHub()'s existing pattern.
  player.hp = player.maxHp;
  const spawnIdx = this.gameState.players.indexOf(player);
  const spawn = DUNGEON_SPAWN_POSITIONS[spawnIdx] ?? { x: 400, y: 540 };
  player.x = spawn.x;
  player.y = spawn.y;
  const body = this.playerBodies.get(player.id);
  if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
}
```

**Add** one line alongside the existing "every player" HP-restore comment:
```ts
  // Full HP restore on every level transition (Story 4.12) — applies to every player,
  // not only the isDown/isSpirit subset; matches resetToHub()'s existing pattern.
  player.hp = player.maxHp;
  // Clear isFrozen on every level transition too (Story 4.14) — matches
  // resetToHub()'s existing player.isFrozen = false precedent; a disconnected/frozen
  // player must not carry a stale freeze flag across a level boundary.
  player.isFrozen = false;
```

### Task 4 — VotePopup bounded self-recovery timeout (AC4)

**File:** `apps/mobile-controller/src/screens/ControllerScreen.tsx`, `VotePopup` (~line
574-622). `useEffect` is already imported at the top of this file (line 1) — no new import
needed.

**Current code** (verified today):
```tsx
function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const [hasAccepted, setHasAccepted] = useState(false);
  const difficultyLabel: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  return (
    /* ... Decline/Accept buttons; Accept's onPointerDown sets hasAccepted(true) ... */
  );
}
```

**Add** a module-level constant near the file's other UI-timing constants (~line 23-26,
alongside `INPUT_INTERVAL_MS`/`SKILL_JOYSTICK_RING_PX`):
```ts
// ponytail: bounded last-resort recovery for a startDungeon failure that leaves
// gameState.runProposal unchanged (see deferred-work.md D1-4.13) — VotePopup can't rely on
// a server signal to unmount in that case, so it self-resets after this long. Comfortably
// exceeds a normal same-LAN vote-resolution round-trip (well under 1s in practice); revisit
// if this ever proves too short/long in real play.
const VOTE_ACCEPT_STUCK_TIMEOUT_MS = 6000;
```

Inside `VotePopup`, add a `useEffect` that arms/clears the recovery timer:
```tsx
function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    if (!hasAccepted) return;
    const timer = setTimeout(() => setHasAccepted(false), VOTE_ACCEPT_STUCK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasAccepted]);

  const difficultyLabel: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  return (
    /* unchanged JSX below */
  );
}
```
Do not change the Accept/Decline button JSX, `onAccept`/`onDecline` props, or the render
site's gating condition (~line 1517-1524) — this task only adds the timeout effect.

### Project Structure Notes

- Tasks 1-3 are edits to `GameRoom.ts`, already open for editing in prior epic-4 hardening
  stories — no new files, no new exports.
- Task 4 is a single-function edit inside `ControllerScreen.tsx` — no new files.
- Task 5 (tests) adds one new file under `apps/simulation-server/tests/` — suggested name
  `game-room-post-413-deferred-hardening.test.ts`, following this project's established
  naming convention of naming the test file after the STORY WHOSE FINDINGS it closes (e.g.
  4.11's own test file is named `game-room-post-410-deferred-hardening.test.ts`, closing
  4.10's findings) — this file closes 4.11/4.12/4.13's findings, hence `post-413`.

### Project Context Rules

- **Ownership**: Tasks 1-3 are Simulation Engineer's area (`apps/simulation-server/**`);
  Task 4 is Mobile Controller Engineer's area (`apps/mobile-controller/**`). Per CLAUDE.md's
  Ownership Rules this normally calls for splitting into 2 stories, but per the established
  precedent (3.22, 3.9/3.10, 1.8/1.9, 5.7/5.8, 4.9/4.10/4.11 — all bundle small, low-risk,
  clearly-scoped multi-context hardening fixes into one story), this story follows the same
  pattern. Flagged explicitly per the ownership-scope-check protocol.
- **Simulation-safety hook** (project-context.md, Engine-Specific Rules / Testing Rules):
  triggered because `GameRoom.ts` is modified. Typecheck and full unit test suite are
  required; deterministic tick test and replay test are N/A (no PRNG/tick-order change, no
  wire-format change).
- **Client-UX hook**: triggered because `ControllerScreen.tsx` is modified (mobile).
  `apps/mobile-controller` has no automated test harness at all (confirmed: no test script in
  `package.json`, no `*.test.*` files anywhere in the app) — verify Task 4 by code trace and
  reasoning about the timeout duration; a live-device pass is recommended but not required to
  close this story, matching this project's established precedent for mobile-controller-only
  stories with no display device available (see `dev-3-controller-fullscreen-toggle`'s Dev
  Agent Record).
- **Testing Rules**: unit tests for Tasks 1-3 live in `apps/simulation-server/tests/`,
  mirroring the implementation logic in test-local functions (GameRoom isn't instantiable
  outside a live Colyseus room) — exactly the pattern `game-room-post-410-deferred-
  hardening.test.ts` and `game-room-level-transition-hp.test.ts` already establish.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 4-11-epic-4-post-410-deferred-hardening (2026-07-07)] — D-4.11-A, D-4.11-B
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 4-12-full-hp-restore-on-level-transition (2026-07-15)] — D1
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 4-13-vote-accept-button-submitted-state (2026-07-15)] — D1
- [Source: _bmad-output/implementation-artifacts/4-11-epic-4-post-410-deferred-hardening.md] — established the exact levelIndex-defer pattern (Task 3 of that story) this story's Task 1 re-applies verbatim to the 2 remaining branches; established the mirrored-logic unit test pattern Tasks 1-3's tests follow
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — `loadLevel` (boss/level-2/default branches, per-player reset loop), `resetToHub`, `startDungeon`'s catch block, the generic level-clear check (confirms D-4.9-A already resolved)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx] — `VotePopup` and its render site
- [Source: apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts, game-room-level-transition-hp.test.ts] — established mirrored-logic unit test patterns and naming convention
- [Source: _bmad-output/project-context.md#Testing Rules, #Code Organization Rules] — monorepo ownership boundaries, test category placement

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #1) — In `loadLevel`'s level-2 branch, move
  `this.gameState.session.levelIndex = index;` from the branch's first statement to after
  `this.spawnWave(1, 'mid', index)` succeeds. Apply the identical move in the default branch,
  after `this.spawnEnemies(tier, index)` succeeds.
- [ ] **Task 2** (AC: #2) — In `resetToHub()`, add the boss-body/arena-wall destruction block
  (mirroring `loadLevel`'s existing equivalent block).
- [ ] **Task 3** (AC: #3) — In `loadLevel`'s per-player reset loop, add
  `player.isFrozen = false;` alongside the existing unconditional `player.hp = player.maxHp`
  line.
- [ ] **Task 4** (AC: #4) — In `ControllerScreen.tsx`'s `VotePopup`, add the
  `VOTE_ACCEPT_STUCK_TIMEOUT_MS` constant and the `useEffect` that resets `hasAccepted` to
  `false` after the timeout if the component is still mounted.
- [ ] **Task 5** (AC: #5) — Add unit tests in `apps/simulation-server/tests/` (new file
  `game-room-post-413-deferred-hardening.test.ts`, following the established mirrored-logic
  pattern) for: (a) Task 1's levelIndex-commit-after-success ordering in both the level-2 and
  default branches, (b) Task 2's boss-body/arena-wall destruction in `resetToHub`, (c) Task
  3's `isFrozen` clearing in the per-player reset loop.
- [ ] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [ ] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions.
- [ ] Manually code-trace Task 4 per the Client-UX hook (no display device required): confirm
  `VOTE_ACCEPT_STUCK_TIMEOUT_MS` comfortably exceeds a normal same-LAN vote round-trip, and
  that the timeout is cleared on unmount (no leaked timer warning path).
- [ ] Update `deferred-work.md`: mark D-4.11-A, D-4.11-B, D1-4.12, D1-4.13 as RESOLVED by
  this story (do not delete entries — follow the existing RESOLVED-annotation convention).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

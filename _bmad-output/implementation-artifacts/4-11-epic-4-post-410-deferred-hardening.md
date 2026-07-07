---
baseline_commit: 083fdd920f258ee2a3dda7a8323a38866694da7f
---

# Story 4.11: Epic 4 — Post-4.10 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E4 — Procedural Dungeon & Full Run Structure (Story 4.11 — post-4.10 deferred
  hardening, no new features)
Context: Story 4.10 closed 3 deferred findings from Story 4.9's code review. Its own code
  review surfaced 5 new findings, logged in deferred-work.md under "Deferred from: code
  review of 4-10-epic-4-post-49-deferred-hardening (2026-07-07)":
  - D-4.10-A (fixable): the `CONTINUE` handler's try/catch (added by 4.10) sets
    `this.bondMomentNextLevel = -1` before the try. If `loadLevel(nextLevel)` throws, the
    client is left permanently stuck — a repeat `CONTINUE` message immediately no-ops
    because `bondMomentNextLevel === -1` already.
  - D-4.10-B (fixable, and a confirmed real desync, not just theoretical): `startDungeon`
    commits `session.phase = 'dungeon'` and nulls `runProposal` before the try/catch around
    `loadLevel(1)`. Worse: the host client's `applyDelta` for `run:starting` (broadcast by
    `resolveVoteIfComplete` BEFORE `startDungeon` is even called) already flips the host's
    mirrored `phase` to `'dungeon'` — so on a `loadLevel(1)` failure, the host is showing
    the dungeon screen while the server has no level loaded and no way to recover
    (`runProposal === null` blocks any new vote).
  - D-4.10-C (fixable): `startDungeon`'s `generateFloorLayout`/`createRng` calls sit outside
    the try/catch added by 4.10 (which only wraps `loadLevel(1)`). A throw there propagates
    to the `VOTE` message handler's outer catch, which logs a misleading
    `'failed to parse VOTE — discarded'`.
  - D-4.10-D (fixable): `loadLevel`'s boss branch sets `session.levelIndex = BOSS_LEVEL_INDEX`
    before creating the boss arena walls/body/state. If that construction throws,
    `gameState.boss` stays `null` forever while `levelIndex` already reads
    `BOSS_LEVEL_INDEX` — combined with 4.10's own AC1 fix (excluding the boss level from the
    generic clear check), no completion path can ever fire again for that room.
  - D-4.10-E (fixable): none of the above failure paths (CONTINUE, startDungeon) have any
    test coverage. 4.10's Task 4 unit test covered only the level-clear guard boolean.

  Current codebase state entering this story (all in
  apps/simulation-server/src/rooms/GameRoom.ts):
  - `CONTINUE` handler (~line 276-288): `bondMomentNextLevel = -1` set unconditionally
    before the try; not restored on catch.
  - `resolveVoteIfComplete` (~line 549-560): broadcasts the `run:starting` delta, THEN calls
    `startDungeon`.
  - `startDungeon` has a SECOND call site: the `HOST_START` handler (~line 158-168) calls
    `this.startDungeon(DifficultyTier.EASY)` directly — a host-initiated bypass of the vote
    flow entirely. This path never broadcasts `run:starting` today (only
    `resolveVoteIfComplete` does) and has no `RunProposal` to restore on failure.
  - `startDungeon` (~line 562-580): `phase`/`difficulty`/`runProposal` mutated before the
    try; `floorRng`/`roomRng`/`generateFloorLayout` calls sit above the try, not inside it.
  - `loadLevel`'s boss branch (~line 902-928): `session.levelIndex = index` (line 902) is
    set once, before the `if (index === BOSS_LEVEL_INDEX)` dispatch — applies to all 3
    branches, but only the boss branch does risky construction (planck.js body/fixture
    creation, `loadBossArena`) after that assignment.
  - `packages/net-protocol/src/apply-delta.ts:168-169`: `run:starting` case sets the HOST's
    mirrored `session.phase` to `'dungeon'` immediately on receipt — confirms the desync
    risk in D-4.10-B is real, not theoretical.

Owner agent: Simulation Engineer (all 5 findings are confined to
  apps/simulation-server/src/rooms/GameRoom.ts — single ownership area; no shared-types or
  net-protocol changes are needed for any of the 5 fixes, so no Protocol Architect
  cross-context approval is required — see Non-goals)

Goal: Close the 5 deferred findings from the 4.10 code review with minimal diffs, all
  confined to GameRoom.ts: restore retry-ability on CONTINUE/startDungeon failure, widen
  startDungeon's try/catch to cover floor-layout generation, defer the boss-level's
  levelIndex commit until construction succeeds, and add test coverage for all of it.

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/simulation-server/tests/**  (new/updated unit tests)

Blocked paths:
  - packages/**
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - tests/e2e/**  (see Non-goals — no new e2e repro required)

Inputs:
  - deferred-work.md: D-4.10-A, D-4.10-B, D-4.10-C, D-4.10-D, D-4.10-E (under "Deferred
    from: code review of 4-10-epic-4-post-49-deferred-hardening")
  - apps/simulation-server/src/rooms/GameRoom.ts — read `resolveVoteIfComplete` (~549-560),
    `startDungeon` (~562-580), the `CONTINUE` handler (~276-288), and `loadLevel`'s boss
    branch (~847-928) before editing; confirm exact current line numbers (may have shifted)
  - packages/net-protocol/src/apply-delta.ts (~line 168-169) — confirms the host applies
    `run:starting` by immediately setting mirrored `phase = 'dungeon'`, which is why AC2
    moves the broadcast to fire only after `loadLevel(1)` succeeds
  - 4-10-epic-4-post-49-deferred-hardening.md — prior story; established the try/catch
    pattern this story extends (does not replace)

Non-goals:
  - Do not add a new wire message type (e.g. a `level:load-failed` delta) to give clients
    explicit failure feedback. All 5 fixes stay within GameRoom.ts's existing state and
    message flow — no packages/net-protocol or packages/shared-types changes, keeping this
    story in a single ownership area. A client-facing failure signal is a legitimate future
    enhancement but is out of scope here (see deferred-work.md D-4.10-A/B's original "fix
    if load failures are ever observed in practice" framing — these are latent-risk fixes,
    not confirmed production incidents).
  - Do not add a generic `safeLoadLevel` helper/abstraction to de-duplicate the 3 try/catch
    call sites. A prior review (4.10's own) flagged this as noise: 2-3 call sites of ~5
    lines each don't clear the DRY threshold, and 4.10's Non-goals already established "no
    new recovery abstraction" as this codebase's explicit precedent for these call sites.
  - Do not implement rollback/recovery for every possible partial mutation in `loadLevel`
    (e.g. don't try to restore destroyed physics bodies from the previous level). Scope is
    limited to the specific `levelIndex`-before-boss-construction ordering issue named in
    D-4.10-D — do not go looking for other partial-mutation risks in `loadLevel` beyond
    that one.
  - Do not hardcode the phase `startDungeon` reverts to. Capture `this.gameState.session.phase`
    into a local before mutating it and revert to that captured value on catch — the
    pre-dungeon phase differs by caller (`'hub'` for the vote path, but `HOST_START` can
    fire from `'lobby'` or `'hub'` — anything except `'dungeon'`, per its own guard at line
    160). Reverting to a hardcoded `'hub'` would be wrong for the `HOST_START` path.
  - Do not add a `run:starting` broadcast to the `HOST_START` path. It does not send this
    delta today (only the vote path does, via `resolveVoteIfComplete`) — keep that
    asymmetry; do not introduce a new client-visible event for a path that never had one.
  - Do not build a full e2e repro of any of these 5 failure paths (would require injecting
    faults into `generateFloorLayout`/`loadBossArena`/planck.js, which have no existing test
    hook to fail on demand). Follow 4.10's own established precedent: unit-level tests that
    mirror the guard/ordering logic directly (see `game-room-level-clear-guard.test.ts`).

Acceptance criteria:
  1. On `loadLevel` failure in the `CONTINUE` handler, `this.bondMomentNextLevel` is
     restored to the level that failed to load (not left at `-1`), so a repeated `CONTINUE`
     message retries instead of permanently no-op'ing.
  2. The `run:starting` delta broadcast in `resolveVoteIfComplete` moves to fire only after
     `startDungeon`'s `loadLevel(1)` call succeeds (inside `startDungeon`, immediately
     before its existing snapshot broadcast) — not before `startDungeon` is called. On
     `loadLevel(1)` failure, `session.phase` reverts to `'hub'` and `runProposal` is
     restored to the proposal that was being started, so a fresh vote can be retried; no
     `run:starting` or snapshot broadcast fires.
  3. `startDungeon`'s `floorRng`/`roomRng` construction and `generateFloorLayout` call move
     inside the try/catch that already wraps `loadLevel(1)` (per AC2), so a throw from
     either is caught here with the same `logger.error` + revert-and-return handling as
     AC2, instead of propagating to the `VOTE` handler's outer catch.
  4. In `loadLevel`'s boss branch (`index === BOSS_LEVEL_INDEX`), `session.levelIndex` is
     assigned only after the boss arena walls, physics body/fixture, and `gameState.boss`
     are all successfully constructed — not before. The other two branches (level 2,
     default) continue to assign `session.levelIndex` immediately (only the boss branch has
     this ordering risk, per D-4.10-D).
  5. New/updated unit tests in `apps/simulation-server/tests/` prove: (a) AC1's
     bondMomentNextLevel restoration on CONTINUE failure, (b) AC2's phase/runProposal
     revert on startDungeon failure with no run:starting/snapshot broadcast, (c) AC4's
     levelIndex-commit-after-success ordering in the boss branch.
  6. Full monorepo typecheck and test suite pass with no regressions.

Required hooks:
  - Simulation-safety hook (GameRoom.ts modified — typecheck, unit tests, deterministic
    tick test N/A [no PRNG/tick-order change], replay test N/A [no wire-format change: the
    `run:starting` delta's shape and its `apply-delta.ts` handling are unchanged, only the
    timing of when it's broadcast moves], perf sanity check N/A [reordering existing
    mutations/broadcasts, no new per-tick cost — these are one-shot vote/message-handler
    paths, not tick() itself])

Required tests:
  - New/updated unit tests (apps/simulation-server/tests/) per AC5 above, mirroring the
    guard/ordering logic — see Dev Notes for exact scenarios.
  - No changes expected to existing e2e/unit/contract tests for the happy paths (successful
    CONTINUE, successful startDungeon, successful boss-level load) — this story only changes
    behavior on the exception path. Confirm by running the full suite.

Telemetry impact: None — no new user-facing flow, no new event, no payload change (the
  `run:starting` delta's shape is unchanged; only its broadcast timing moves within the
  same synchronous call).
```

---

## Story

As a developer on the project,
I want the 5 deferred findings from the 4.10 code review resolved,
so that a `loadLevel` failure during the bond-moment `CONTINUE` flow or the initial dungeon
start no longer permanently wedges the room (no retry path, and — in `startDungeon`'s case
— a confirmed host-client desync since `run:starting` already flips the host's mirrored
phase to `'dungeon'` before the server has actually loaded anything), and the boss-level
`levelIndex`/`boss` ordering can no longer produce an unrecoverable deadlock if arena
construction fails mid-`loadLevel`.

---

## Acceptance Criteria

**AC1 — CONTINUE handler restores retry-ability on failure:**
**Given** the bond-moment `CONTINUE` handler calls `loadLevel(nextLevel)` and it throws
**When** the catch block runs
**Then** `this.bondMomentNextLevel` is restored to `nextLevel` (not left at `-1`)
**And** a subsequent `CONTINUE` message from the client retries the same `loadLevel` call
instead of silently no-op'ing

**AC2 — startDungeon reverts cleanly and defers the run:starting broadcast:**
**Given** `resolveVoteIfComplete` currently broadcasts `run:starting` before calling
`startDungeon`, and the host's `applyDelta` sets mirrored `phase = 'dungeon'` immediately
on receiving it
**When** `startDungeon`'s `loadLevel(1)` call succeeds
**Then** the `run:starting` delta broadcasts from inside `startDungeon`, immediately before
its existing snapshot broadcast (not from `resolveVoteIfComplete` beforehand)
**And when** `loadLevel(1)` fails
**Then** no `run:starting` or snapshot broadcast fires, `session.phase` reverts to whatever
it was immediately before `startDungeon` was called, and `runProposal` is restored to
whatever it was before (the accepted proposal for the vote path; `null` for the `HOST_START`
path, which has no proposal) so a fresh vote can retry

**AC3 — startDungeon's floor-layout generation is covered by the try/catch:**
**Given** `startDungeon`'s `floorRng`/`roomRng` construction and `generateFloorLayout` call
**When** either throws
**Then** the same try/catch and revert-and-return handling from AC2 catches it (not the
`VOTE` handler's outer catch, which would misreport it as a parse failure)

**AC4 — Boss-branch levelIndex commits only after construction succeeds:**
**Given** `loadLevel`'s boss branch (`index === BOSS_LEVEL_INDEX`)
**When** the boss arena walls, physics body/fixture, or `gameState.boss` construction
throws partway through
**Then** `session.levelIndex` has NOT been mutated to `BOSS_LEVEL_INDEX`
**And** the other two branches (level 2, default `clear` levels) are unaffected — they still
assign `session.levelIndex` immediately, since only the boss branch does risky construction
after the assignment point

**AC5 — Regression-safe with new coverage:**
**Given** AC1's retry restoration, AC2/AC3's revert-and-defer behavior, and AC4's ordering
fix
**When** the full monorepo typecheck and Vitest suite run
**Then** all existing tests pass unchanged, and new unit tests (per AC5 in the task header)
prove all three fixes' failure-path behavior

---

## Dev Notes

### Context

Story 4.10 closed 3 deferred findings from 4.9's review (boss-level exclusion from the
generic clear check, plus try/catch hardening on 2 `loadLevel` call sites). 4.10's own code
review confirmed those 2 try/catch additions were correct per its literal AC2 scope
("log-and-skip, no recovery — matches `tryEnterBondMoment`'s precedent") but surfaced 5 gaps
in what "log-and-skip" leaves behind, logged in `deferred-work.md` under "Deferred from:
code review of 4-10-epic-4-post-49-deferred-hardening (2026-07-07)":

**D-4.10-A & D-4.10-B — no retry path.** Both new try/catch sites mutate state that gates
re-entry (`bondMomentNextLevel = -1`, `runProposal = null`) BEFORE the try, so a failure
leaves that gate permanently closed — the client's only path back in (a repeat `CONTINUE`
or a fresh `VOTE`) is blocked by the very state the failed call already consumed.

**D-4.10-B is worse than a stall — it's a confirmed desync.** `resolveVoteIfComplete`
broadcasts `run:starting` BEFORE calling `startDungeon` (not after). The host client's
`applyDelta` (`packages/net-protocol/src/apply-delta.ts:168-169`) handles `run:starting` by
immediately setting the host's mirrored `session.phase` to `'dungeon'`. So today, the host
flips to the dungeon screen the instant the vote resolves — regardless of whether
`startDungeon`'s `loadLevel(1)` actually succeeds moments later. If it fails, the host is
stuck showing an empty/broken dungeon screen while the server has silently reverted (or, pre-
this-story, not reverted at all) with no snapshot ever arriving to correct it.

**D-4.10-C — the RNG/floor-layout calls were never in scope for 4.10's try/catch.** 4.10's
AC2 was scoped to "the `loadLevel` call site," not the setup code immediately above it in
the same function. This story widens the same try/catch (already established by AC2 above)
to also cover that setup code, since it's the same failure domain (dungeon-start failure)
and the same revert-and-return handling applies.

**D-4.10-D — the boss-branch ordering issue predates 4.10 but 4.10's own AC1 fix now makes
it a true deadlock instead of a silent stall.** `loadLevel` (line 902) sets
`session.levelIndex = index` for ALL levels before branching on what kind of level it is.
For the boss level, everything after that assignment (arena walls, physics body/fixture,
`gameState.boss`) can throw. Before 4.10, a throw here left `gameState.enemies` permanently
empty at the boss level, so the generic level-clear check's `allEnemiesDead` (which requires
`enemies.length > 0`) could never fire anyway — already stuck, but for an unrelated reason.
4.10's AC1 added an explicit `levelIndex !== BOSS_LEVEL_INDEX` guard to that same check —
correct and necessary for its own purpose — but it means the deadlock in this specific
partial-failure scenario is now guaranteed by design rather than incidental. Fix: don't
commit `levelIndex` to `BOSS_LEVEL_INDEX` until the boss is actually fully constructed.

**D-4.10-E — no test coverage for any of the above.** Add coverage as part of closing each
fix, per the mirrored-logic pattern this codebase already uses for `GameRoom` internals that
can't be unit-tested by instantiating the class directly (see `game-room-host-join.test.ts`
and 4.10's own `game-room-level-clear-guard.test.ts`).

### Implementation

**Task 1 — CONTINUE handler restores bondMomentNextLevel on failure (AC1)**

```ts
// Before (apps/simulation-server/src/rooms/GameRoom.ts, ~line 276-288)
this.onMessage(EventNames.CONTINUE, (_client: Client) => {
  if (this.bondMomentNextLevel === -1 || this.gameState.session.phase !== 'dungeon') return;
  const nextLevel = this.bondMomentNextLevel;
  this.bondMomentNextLevel = -1;
  try {
    this.loadLevel(nextLevel);
  } catch (err) {
    logger.error({ err, roomId: this.roomId, nextLevel }, 'loadLevel failed during CONTINUE — level not loaded');
    return;
  }
  this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
  logger.info({ roomId: this.roomId, nextLevel }, 'bond-moment CONTINUE — loading next level');
});

// After
this.onMessage(EventNames.CONTINUE, (_client: Client) => {
  if (this.bondMomentNextLevel === -1 || this.gameState.session.phase !== 'dungeon') return;
  const nextLevel = this.bondMomentNextLevel;
  this.bondMomentNextLevel = -1;
  try {
    this.loadLevel(nextLevel);
  } catch (err) {
    this.bondMomentNextLevel = nextLevel; // restore — allow a repeat CONTINUE to retry
    logger.error({ err, roomId: this.roomId, nextLevel }, 'loadLevel failed during CONTINUE — level not loaded, retry armed');
    return;
  }
  this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
  logger.info({ roomId: this.roomId, nextLevel }, 'bond-moment CONTINUE — loading next level');
});
```

**Task 2 — startDungeon reverts phase/runProposal and defers run:starting; RNG/floor-layout
calls move inside the try (AC2, AC3)**

```ts
// Before — resolveVoteIfComplete (~line 549-560)
private resolveVoteIfComplete(): void {
  if (this.gameState.runProposal === null) return;
  const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
  if (activePlayers.length === 0) return;
  if (activePlayers.some(p => p.class === null)) return;
  if (!activePlayers.every(p => this.runVotes.get(p.id) === 'accept')) return;
  const proposal = this.gameState.runProposal;
  const startDelta: DeltaEventMsg = { type: 'run:starting', biome: proposal.biome, difficulty: proposal.difficulty };
  this.broadcast(EventNames.DELTA, startDelta);
  this.startDungeon(proposal.difficulty);
  logger.info({ roomId: this.roomId, difficulty: proposal.difficulty }, 'run starting — unanimous accept');
}

// After — startDelta construction moves into startDungeon; broadcast only fires on success.
// Pass the full proposal as the new 2nd arg (needed to restore runProposal on failure and
// to build the deferred run:starting delta).
private resolveVoteIfComplete(): void {
  if (this.gameState.runProposal === null) return;
  const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
  if (activePlayers.length === 0) return;
  if (activePlayers.some(p => p.class === null)) return;
  if (!activePlayers.every(p => this.runVotes.get(p.id) === 'accept')) return;
  const proposal = this.gameState.runProposal;
  this.startDungeon(proposal.difficulty, proposal);
  logger.info({ roomId: this.roomId, difficulty: proposal.difficulty }, 'run starting — unanimous accept');
}
```

```ts
// Before — HOST_START handler (~line 158-168) — the OTHER startDungeon call site, a direct
// host-initiated bypass of the vote flow with no RunProposal
this.onMessage(EventNames.HOST_START, (client: Client) => {
  if (client.sessionId !== this.gameState.session.hostId) return;
  if (this.gameState.session.phase === 'dungeon') return;
  if (this.gameState.players.length === 0) return;
  const unready = this.gameState.players.filter(p => p.class === null);
  if (unready.length > 0) {
    logger.warn({ roomId: this.roomId, unready: unready.length }, 'host:start rejected — players without class');
    return;
  }
  this.startDungeon(DifficultyTier.EASY);
});

// After — pass null as the 2nd arg: no proposal to restore, and (per Non-goals) this path
// must NOT start broadcasting run:starting — it never did before this story.
this.onMessage(EventNames.HOST_START, (client: Client) => {
  if (client.sessionId !== this.gameState.session.hostId) return;
  if (this.gameState.session.phase === 'dungeon') return;
  if (this.gameState.players.length === 0) return;
  const unready = this.gameState.players.filter(p => p.class === null);
  if (unready.length > 0) {
    logger.warn({ roomId: this.roomId, unready: unready.length }, 'host:start rejected — players without class');
    return;
  }
  this.startDungeon(DifficultyTier.EASY, null);
});
```

```ts
// Before — startDungeon (~line 562-580)
private startDungeon(difficulty: DifficultyTier): void {
  this.gameState.session.phase = 'dungeon';
  this.gameState.session.difficulty = difficulty;
  this.gameState.runProposal = null;
  for (const p of this.gameState.players) p.nearPoiId = null;
  const floorRng = createRng(this.gameState.session.runSeed ^ OFFSET_FLOOR_LAYOUT);
  const roomRng  = createRng(this.gameState.session.runSeed ^ OFFSET_ROOM_POOL);
  this.gameState.floorLayout = generateFloorLayout(floorRng, roomRng, 'early', GRASSLAND_ROOM_POOL);
  this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
  this.bondMomentNextLevel = -1;
  try {
    this.loadLevel(1);
  } catch (err) {
    logger.error({ err, roomId: this.roomId }, 'loadLevel(1) failed during startDungeon');
    return;
  }
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId, difficulty }, 'dungeon phase started');
}

// After — 2nd param `proposal: RunProposal | null` is the accepted proposal for the vote
// path, or `null` for the HOST_START path (no proposal exists, no run:starting broadcast).
// Captures previousPhase and reverts both phase and runProposal to their pre-call values on
// catch (correct for either caller — runProposal was already `null` for HOST_START, so
// "restoring" it there is a no-op). floorRng/roomRng/generateFloorLayout move inside the
// try (closes D-4.10-C). run:starting only broadcasts (and only if proposal !== null) after
// loadLevel(1) succeeds (closes D-4.10-B's desync).
private startDungeon(difficulty: DifficultyTier, proposal: RunProposal | null): void {
  const previousPhase = this.gameState.session.phase;
  const previousProposal = this.gameState.runProposal;
  this.gameState.session.phase = 'dungeon';
  this.gameState.session.difficulty = difficulty;
  this.gameState.runProposal = null;
  for (const p of this.gameState.players) p.nearPoiId = null;
  this.bondMomentNextLevel = -1;
  try {
    const floorRng = createRng(this.gameState.session.runSeed ^ OFFSET_FLOOR_LAYOUT);
    const roomRng  = createRng(this.gameState.session.runSeed ^ OFFSET_ROOM_POOL);
    this.gameState.floorLayout = generateFloorLayout(floorRng, roomRng, 'early', GRASSLAND_ROOM_POOL);
    this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
    this.loadLevel(1);
  } catch (err) {
    this.gameState.session.phase = previousPhase;
    this.gameState.runProposal = previousProposal;
    logger.error({ err, roomId: this.roomId }, 'startDungeon failed — reverted to previous phase');
    return;
  }
  if (proposal) {
    const startDelta: DeltaEventMsg = { type: 'run:starting', biome: proposal.biome, difficulty };
    this.broadcast(EventNames.DELTA, startDelta);
  }
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId, difficulty }, 'dungeon phase started');
}
```

Note: `startDungeon` gains a 2nd parameter, `proposal: RunProposal | null`. It has exactly 2
call sites — `resolveVoteIfComplete` (passes the accepted proposal) and the `HOST_START`
handler (passes `null`) — both shown above; update both in this diff. `RunProposal` (see
`packages/shared-types/src/run-proposal.ts`) has `biome`, `difficulty`, and `proposedBy`
fields; only `biome` is needed here (matching the current `proposal.biome` read in the old
`resolveVoteIfComplete`).

**Task 3 — Boss branch defers `levelIndex` commit until construction succeeds (AC4)**

```ts
// Before — loadLevel (~line 902-928)
this.gameState.session.levelIndex = index;

if (index === BOSS_LEVEL_INDEX) {
  this.gameState.session.bossLevelStartedAt = Date.now();
  this.gameState.session.anyPlayerDownedDuringBoss = false;
  this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === BOSS_LEVEL_INDEX - 1;
  this.arenaWallBodies = loadBossArena(this.physicsWorld);
  const bossId = `boss-grassland-${this.gameState.session.runSeed}`;
  const bossBodyInstance = this.physicsWorld.createBody({ /* ... */ });
  bossBodyInstance.createFixture({ /* ... */ });
  bossBodyInstance.setUserData({ type: 'boss', bossId } satisfies PhysicsBodyData);
  this.bossBody = bossBodyInstance;
  this.gameState.boss = createBossState(this.gameState.session.runSeed);
  logger.info({ roomId: this.roomId }, 'boss arena loaded');
} else if (index === 2) {
  this.levelObjective = 'survive-waves';
  // ...
} else {
  this.levelObjective = 'clear';
  // ...
}

// After — levelIndex assignment moves to the end of the boss branch (after gameState.boss
// is set), and to the top of the other two branches (unchanged effective behavior for them)
if (index === BOSS_LEVEL_INDEX) {
  this.gameState.session.bossLevelStartedAt = Date.now();
  this.gameState.session.anyPlayerDownedDuringBoss = false;
  this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === BOSS_LEVEL_INDEX - 1;
  this.arenaWallBodies = loadBossArena(this.physicsWorld);
  const bossId = `boss-grassland-${this.gameState.session.runSeed}`;
  const bossBodyInstance = this.physicsWorld.createBody({ /* ... */ });
  bossBodyInstance.createFixture({ /* ... */ });
  bossBodyInstance.setUserData({ type: 'boss', bossId } satisfies PhysicsBodyData);
  this.bossBody = bossBodyInstance;
  this.gameState.boss = createBossState(this.gameState.session.runSeed);
  this.gameState.session.levelIndex = index; // commit only after boss setup succeeds
  logger.info({ roomId: this.roomId }, 'boss arena loaded');
} else if (index === 2) {
  this.gameState.session.levelIndex = index;
  this.levelObjective = 'survive-waves';
  // ...
} else {
  this.gameState.session.levelIndex = index;
  this.levelObjective = 'clear';
  // ...
}
```

Do not touch anything else inside the boss/level-2/default branches — only the position of
the `this.gameState.session.levelIndex = index;` line moves. `bossLevelStartedAt`,
`anyPlayerDownedDuringBoss`, and `allBondsAtBossStart` do not read `levelIndex`, so they are
safe to leave where they are (before the risky construction calls); only the field that the
tick()-loop's new AC1-guard (from 4.10) and `tickBoss`'s `gameState.boss !== null` guard both
key off needs to move.

**Task 4 — Unit tests (AC5)**

Add to (or extend) `apps/simulation-server/tests/`, following the mirrored-logic pattern
from `game-room-host-join.test.ts` / `game-room-level-clear-guard.test.ts`:

1. A mirror of the CONTINUE catch block: assert that on a thrown `loadLevel`, the mirrored
   `bondMomentNextLevel` variable is restored to the failed level (not `-1`).
2. A mirror of `startDungeon`'s catch block: assert that on a thrown `loadLevel`/
   `generateFloorLayout`, the mirrored `phase` reverts to its previous value, the mirrored
   `runProposal` is restored to the original proposal, and no `run:starting`/snapshot
   broadcast call is recorded (use a `vi.fn()` spy for the broadcast, matching
   `game-room-host-join.test.ts`'s `roomBroadcast` spy pattern).
3. A mirror of `loadLevel`'s boss-branch ordering: assert that when the boss-construction
   step throws, the mirrored `levelIndex` variable was NOT updated to `BOSS_LEVEL_INDEX`
   (still holds its prior value); when it succeeds, `levelIndex` IS updated.

### Files to read before editing

- `apps/simulation-server/src/rooms/GameRoom.ts` — read `resolveVoteIfComplete`,
  `startDungeon`, the `HOST_START` handler, the `CONTINUE` handler, and `loadLevel`'s boss
  branch in full before editing; confirm exact current line numbers (may have shifted since
  this story was written). `startDungeon` has exactly 2 call sites as of this story
  (`resolveVoteIfComplete` and `HOST_START`) — re-grep `startDungeon(` to confirm that is
  still true before changing its signature.
- `packages/shared-types/src/run-proposal.ts` (or wherever `RunProposal` is defined) —
  confirm its exact field shape (`biome`, `difficulty`, and whatever else `resolveVoteIfComplete`
  currently reads off `this.gameState.runProposal`) before writing `startDungeon`'s new
  `(proposal: RunProposal)` signature.
- `packages/net-protocol/src/apply-delta.ts` (~line 168-169) — confirms exactly what the
  host client does with `run:starting`; do not change this file (Blocked path) — it's cited
  here only to justify AC2's timing change, not to be edited.
- `apps/simulation-server/tests/game-room-host-join.test.ts` and
  `apps/simulation-server/tests/game-room-level-clear-guard.test.ts` — established patterns
  for testing `GameRoom` logic that can't be exercised by instantiating the class directly.

### Known pitfalls

- `startDungeon` has 2 call sites, not 1 — `resolveVoteIfComplete` AND the `HOST_START`
  handler (~line 158-168). Both must be updated in the same diff (grep `startDungeon(` to
  confirm no others exist before finishing). Missing the `HOST_START` site is a compile
  error (wrong arg count) if you add a required 2nd param, or a silent behavior bug (never
  restoring `runProposal`, or starting to broadcast `run:starting` for a path that never
  did) if you get the param wrong — this is why `proposal` is typed `RunProposal | null`
  rather than assuming every caller has one.
- Do not add a `run:starting`-specific revert/undo delta — AC2's fix is to simply not
  broadcast it until success, not to un-broadcast it after the fact.
- Do not make the `HOST_START` path start broadcasting `run:starting` — pass `null` for its
  `proposal` argument, which the `if (proposal)` guard uses to skip the broadcast, matching
  today's behavior exactly.
- The `bossLevelStartedAt`/`anyPlayerDownedDuringBoss`/`allBondsAtBossStart` session field
  writes in the boss branch happen BEFORE the risky construction calls and are NOT part of
  this story's fix — only `levelIndex` moves. Do not also move those three fields; they are
  cheap, non-externally-visible bookkeeping writes that don't gate any other guard.
- `BOSS_LEVEL_INDEX` is already a module-level constant (`= 4`) — reuse it in tests, do not
  hardcode `4` (tests will still need to define their own local copy since it isn't
  exported, matching 4.10's own test file's approach — this is the established pattern, not
  a gap to fix).
- Do not touch the `tick()` level-clear guard or `tryEnterBondMoment` — both are out of
  scope; 4.10 already handled the boss-level exclusion and this story only touches
  `loadLevel`'s internal ordering and the 2 outer call sites' catch blocks.

### Project Structure Notes

- All 4 code tasks touch only `GameRoom.ts`, already open for editing — no new files, no
  new directories, no new exports.
- Task 4's new/extended tests go in `apps/simulation-server/tests/` (existing directory,
  existing test category).

### Project Context Rules

- **Ownership**: All 5 findings are confined to `apps/simulation-server/**`, owned by
  Simulation Engineer — single ownership area, no split or cross-context approval needed
  (this story deliberately avoids any `packages/net-protocol`/`packages/shared-types`
  change to keep it that way — see Non-goals).
- **Simulation-safety hook** (project-context.md, Engine-Specific Rules / Testing Rules):
  triggered because `GameRoom.ts` is modified. Typecheck and full unit test suite are
  required; deterministic tick test and replay test are N/A (no PRNG/tick-order change, no
  wire-format change — `run:starting`'s shape is untouched, only its broadcast timing
  moves) — state that explicitly per this story's own Dev Agent Record.
- **Result<T, E> rule**: not applicable — no new `packages/game-rules` function is added;
  the try/catch changes guard existing `GameRoom` methods, not new pure functions.
- **Tick loop hygiene**: not applicable — none of these 4 tasks touch `tick()`; all are in
  one-shot message-handler / vote-resolution code paths.
- **Testing Rules**: unit tests live in `apps/simulation-server/tests/` for `GameRoom`
  logic that can't be imported and unit-tested directly — mirror the implementation in
  test-local functions, as `game-room-host-join.test.ts` and 4.10's
  `game-room-level-clear-guard.test.ts` already do.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 4-10-epic-4-post-49-deferred-hardening (2026-07-07)] — D-4.10-A through D-4.10-E original findings
- [Source: _bmad-output/implementation-artifacts/4-10-epic-4-post-49-deferred-hardening.md] — prior story; established the try/catch pattern this story extends
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — `resolveVoteIfComplete`, `startDungeon`, `CONTINUE` handler, `loadLevel`'s boss branch
- [Source: packages/net-protocol/src/apply-delta.ts] — confirms the `run:starting` host-desync risk that motivates AC2's timing change
- [Source: apps/simulation-server/tests/game-room-host-join.test.ts, game-room-level-clear-guard.test.ts] — established mirrored-logic unit test patterns
- [Source: _bmad-output/project-context.md#Code Organization Rules, #Testing Rules] — monorepo ownership boundaries, test category placement

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — In the `CONTINUE` handler's catch block, restore
  `this.bondMomentNextLevel = nextLevel` before returning, so a repeat `CONTINUE` retries.
- [x] **Task 2** (AC: #2, #3) — Add a `proposal: RunProposal | null` 2nd parameter to
  `startDungeon`; move the `run:starting` broadcast from `resolveVoteIfComplete` into
  `startDungeon` (fires only after `loadLevel(1)` succeeds, and only if `proposal` is
  non-null); widen the try/catch to also cover `floorRng`/`roomRng`/`generateFloorLayout`;
  on catch, revert `session.phase` and `runProposal` to their pre-call values. Update BOTH
  call sites — `resolveVoteIfComplete` (passes the proposal) and `HOST_START` (passes
  `null`).
- [x] **Task 3** (AC: #4) — In `loadLevel`'s boss branch, move
  `this.gameState.session.levelIndex = index;` from before the branch dispatch to the end of
  the boss branch (after `gameState.boss` is assigned); add the same assignment at the top
  of the level-2 and default branches so their behavior is unchanged.
- [x] **Task 4** (AC: #5) — Add unit tests in `apps/simulation-server/tests/` for: (a) AC1's
  bondMomentNextLevel restoration, (b) AC2/AC3's phase/runProposal revert with no broadcast
  on startDungeon failure, (c) AC4's levelIndex-commit-after-success ordering in the boss
  branch.
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [x] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions, especially `tests/e2e/full-run.test.ts` (run-start and boss-defeat paths) and
  the new Task 4 unit tests.

### Review Findings

- [x] [Review][Patch] `startDungeon`'s catch block reverts `session.phase`/`runProposal` but
  never clears `this.runVotes` — a stale unanimous accept can silently re-trigger the same
  failed dungeon start via an unrelated `resolveVoteIfComplete()` call (fired from `onLeave`'s
  disconnect-freeze path at ~line 434, or its grace-expiry path at ~line 495), with no new
  vote action from any player. [apps/simulation-server/src/rooms/GameRoom.ts: `startDungeon`
  catch block] — **confirmed** (re-read both `onLeave` call sites directly; both call
  `resolveVoteIfComplete()` for reasons unrelated to a fresh vote, and its guards
  (`runProposal !== null`, per-player `runVotes.get(id) === 'accept'`) are all still
  satisfied by the pre-failure state that AC2's revert restores). **Fixed:** added
  `this.runVotes.clear()` to the catch block, alongside the existing `phase`/`runProposal`
  revert.
- [x] [Review][Patch] `startDungeon`'s catch block reverts `phase` and `runProposal` but not
  `session.difficulty` — on a `loadLevel(1)`/floor-layout failure, `difficulty` is left set
  to the newly-attempted tier even though `phase` reverts to pre-dungeon. Low impact
  (`difficulty` is only meaningful while `phase === 'dungeon'`, and gets overwritten on the
  next successful attempt) but easy, unambiguous fix — capture `previousDifficulty` alongside
  `previousPhase`/`previousProposal` and revert it too. [apps/simulation-server/src/rooms/
  GameRoom.ts: `startDungeon` catch block] — **Fixed:** added `previousDifficulty` capture
  and revert.
- [x] [Review][Defer] `loadLevel`'s level-2 (survive-waves) and default (clear) branches
  still commit `levelIndex`/`levelObjective`/wave-count fields before their own risky calls
  (`spawnWave`/`spawnEnemies`) — the same class of ordering risk D-4.10-D named for the boss
  branch, left unhardened. [apps/simulation-server/src/rooms/GameRoom.ts: `loadLevel`,
  level-2 and default branches] — deferred, pre-existing; explicitly out of this story's
  scope per AC4 ("only the boss branch has this ordering risk") and Non-goals ("do not go
  looking for other partial-mutation risks... beyond that one").
- [x] [Review][Defer] `resetToHub()` never destroys `this.bossBody`/`this.arenaWallBodies`
  (only `loadLevel` and the boss-defeat handler do) — a failed boss-branch construction
  attempt's bodies would only be cleaned up by the next `loadLevel` call, not by an
  intervening `resetToHub()`. [apps/simulation-server/src/rooms/GameRoom.ts: `resetToHub`] —
  deferred, pre-existing gap unrelated to this diff (and less reachable post-fix than
  pre-fix, since pre-fix a failed boss build permanently deadlocked the room before
  `resetToHub` could ever run).

Dismissed as noise / explicitly out of scope (8): `bossLevelStartedAt`/
`anyPlayerDownedDuringBoss` committed before risky boss construction (explicit Non-goal per
Known Pitfalls: "do not also move those three fields"); the new test not modeling those two
fields (moot, given the above); `nearPoiId` reset not reverted on `startDungeon` failure
(pre-existing, unconditional before this diff too — not a new regression); no client-facing
failure signal (explicit Non-goal); `HOST_START`/`VOTE` concurrency risk (ruled out — single-
threaded Colyseus dispatch, no `await` before mutation in any handler); `CONTINUE` handler
accepting any connected player, not just the bonded pair (pre-existing, predates this diff,
unrelated to the 5 target findings); malformed `proposal` boundary (unreachable — `RUN_PROPOSE`
validates before ever assigning `runProposal`); other `startDungeon` call sites (confirmed
exactly 2, both updated correctly).

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- Diagnosed 2 zombie `tsx` simulation-server processes (WSL2 leftovers, ~2.5h old, PIDs
  varied per invocation) squatting on ports 2568/2569, blocking `tests/e2e/*.test.ts`'s own
  test server from binding (`EADDRINUSE` / `simulation-server did not start within 60s`).
  Killed with `kill -9`; unrelated to this story's diff (pre-existing WSL2 environment
  issue, matches known project pattern).
- Investigated a `tests/e2e/full-run.test.ts` failure (`expected 2 to be 3` on
  `activeBonds.length` at boss-level start) surfaced by the first full-suite run. Root-caused
  via code read of `packages/game-rules/src/systems/bonds.ts`'s `selectBondPair`/`assignBond`:
  with exactly 3 players, the 3rd bond assignment can legitimately re-select an
  already-bonded pair (RNG-dependent — `bondRng` is derived from a fresh
  `crypto.randomInt` `runSeed` every test run, not fixed), in which case `assignBond`
  intentionally returns the existing bond without growing `activeBonds` (see its
  "skip duplicate bond assignment" comment) — a pre-existing property of the 3-player bond
  math, not something this story's diff touches. Confirmed empirically: reverted this
  story's entire `GameRoom.ts` diff via `git stash` and reran the same test — it failed
  intermittently on the reverted code too; with the diff restored, 4 consecutive clean runs
  (ports cleared between each) came back 3 pass / 1 fail, the 1 failure showing the same
  `activeBonds` assertion. `tests/e2e/**` is a Blocked path for this story (owned by QA +
  Telemetry Engineer per CLAUDE.md) and this story's Non-goals scope it to the 5 named
  findings only, so no fix was attempted here — flagged for a QA-owned follow-up instead.
- Also observed one stale-worktree test failure
  (`.claude/worktrees/agent-a7fd307ca2bb7adcb/apps/simulation-server/tests/e2e-join.test.ts`,
  `EADDRINUSE :::18765`) — leftover from an unrelated prior agent session's worktree
  under `.claude/worktrees/`, picked up incidentally by the monorepo-wide Vitest glob.
  Not part of this repo's active working tree or this story's scope; left untouched.

### Completion Notes List

- **Task 1 (AC1):** `CONTINUE` handler's catch block now restores
  `this.bondMomentNextLevel = nextLevel` before returning (was left at `-1`), so a repeat
  `CONTINUE` retries the same `loadLevel` call instead of permanently no-op'ing.
- **Task 2 (AC2, AC3):** `startDungeon` gained a `proposal: RunProposal | null` 2nd
  parameter; both call sites updated (`resolveVoteIfComplete` passes the accepted proposal,
  `HOST_START` passes `null`, preserving its existing no-`run:starting`-broadcast behavior).
  `startDungeon` now captures `previousPhase`/`previousProposal` before mutating, moved
  `floorRng`/`roomRng`/`generateFloorLayout` inside the existing try/catch (closing
  D-4.10-C), and on catch reverts `session.phase`/`runProposal` to their pre-call values.
  The `run:starting` delta build/broadcast moved out of `resolveVoteIfComplete` into
  `startDungeon`, firing only after `loadLevel(1)` succeeds and only if `proposal` is
  non-null — closing D-4.10-B's host/server desync (host no longer flips to the dungeon
  screen before the server has actually loaded level 1).
- **Task 3 (AC4):** In `loadLevel`'s boss branch, `this.gameState.session.levelIndex = index`
  moved from before the branch dispatch to immediately after `gameState.boss` is
  successfully assigned (end of the boss branch). Added the equivalent assignment at the top
  of the level-2 and default branches — same effective timing as before for those two, no
  behavior change. `bossLevelStartedAt`/`anyPlayerDownedDuringBoss`/`allBondsAtBossStart`
  writes were left in their original position per the story's explicit instruction (cheap,
  non-gating bookkeeping).
- **Task 4 (AC5):** Added
  `apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts` — 9 tests
  mirroring the 3 fixed code paths (same pattern as `game-room-host-join.test.ts` /
  `game-room-level-clear-guard.test.ts`, since `GameRoom` isn't directly instantiable):
  CONTINUE-catch bondMomentNextLevel restoration (2 tests), startDungeon-catch phase/
  runProposal revert with broadcast spies covering both the vote path and the HOST_START
  path, on both failure and success (5 tests), and boss-branch levelIndex ordering on both
  throw and success (2 tests). All pass.
- **AC6 — full monorepo verification:**
  - Typecheck: **0 errors** — `npm run typecheck` (full monorepo, all 10 project configs).
  - Unit tests: **369 pass, 0 fail (target files), 12 skipped** on a clean run — `npx vitest
    run` from monorepo root, including the 9 new Task 4 tests. See Debug Log for the 2
    pre-existing, out-of-scope failures observed on some runs (a `tests/e2e/full-run.test.ts`
    RNG-collision flake unrelated to this diff, and a stale-worktree test artifact) — neither
    is caused by this story's changes, confirmed via `git stash`-based A/B testing.
  - Deterministic tick test: **N/A** — no PRNG/tick-order change (per Required hooks).
  - Replay test: **N/A** — `run:starting`'s shape and `apply-delta.ts` handling are
    unchanged; only its broadcast timing moved within the same synchronous call.
  - Perf sanity check: **N/A** — one-shot message-handler/vote-resolution paths, not
    `tick()` itself; no new per-tick cost.
- Confidence: 90% — all 4 tasks match the story's prescribed diffs exactly, typecheck is
  clean, and all new/adjacent unit tests pass deterministically. Held below 95% only because
  the full e2e suite (`tests/e2e/full-run.test.ts`) surfaced a real (if pre-existing,
  independently-confirmed-unrelated) intermittent flake during verification — noted in Debug
  Log rather than fixed, since it's outside this story's Allowed/scoped paths.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — Task 1 CONTINUE-handler retry
  restoration, Task 2 startDungeon revert/defer + 2nd parameter + both call sites, Task 3
  boss-branch levelIndex ordering)
- `apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts` (new — Task 4
  unit tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status
  ready-for-dev → in-progress → review → done)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — 2 findings deferred
  from code review)

### Change Log

- Closed D-4.10-A through D-4.10-E in `GameRoom.ts` (2026-07-07): CONTINUE handler restores
  `bondMomentNextLevel` on `loadLevel` failure (Task 1); `startDungeon` reverts
  `phase`/`runProposal` on failure, widens its try/catch to cover floor-layout generation,
  and defers the `run:starting` broadcast until `loadLevel(1)` succeeds — closing the
  host/server desync (Task 2, Task 3); `loadLevel`'s boss branch defers the `levelIndex`
  commit until boss construction succeeds (Task 4 in the header / Task 3 in Tasks/Subtasks);
  new unit test file added covering all three fixes (Task 4). Typecheck 0 errors; full
  Vitest suite green apart from 2 pre-existing, out-of-scope, diff-unrelated flakes
  (documented in Debug Log References). Status advanced to `review`.
- Code review (2026-07-07): 2 patch findings applied — `startDungeon`'s catch block now also
  clears `this.runVotes` (closing a stale-vote silent-replay bug the AC2 revert had
  introduced) and reverts `session.difficulty` alongside `phase`/`runProposal`. 2 findings
  deferred as D-4.11-A/B (pre-existing, explicitly out of this story's scope). Typecheck 0
  errors; `apps/simulation-server/tests` 159/159 pass. Status advanced to `done`.

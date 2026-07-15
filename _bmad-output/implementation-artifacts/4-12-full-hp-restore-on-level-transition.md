---
baseline_commit: 1f9b932f57fcab246b1dcffdda5367da338fc243
---

# Story 4.12: Full HP Restore on Level Transition

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E4 — Procedural Dungeon & Full Run Structure (Story 4.12 — bug fix, no new
  features)
Context: `GameRoom.loadLevel()` (apps/simulation-server/src/rooms/GameRoom.ts, ~line
  937-1007) runs on every level transition (level 1→2, 2→3, 3→boss, and the bond-moment
  `CONTINUE` flow) and already resets/repositions every player for the new level. But its
  HP-reset logic is conditional: only players who were `isDown`/`isSpirit` get their `hp`
  reset (to `REVIVE_HP = 30`, packages/game-rules/src/balance.ts:9) — a player who survived
  the previous level at, say, 20/100 HP carries that 20 HP straight into the next level.
  This is the one gap: `resetToHub()` (~line 746-799, the "Return to Camp" hub-reset path)
  already does the correct thing — `player.hp = player.maxHp;` unconditionally for every
  player (line 787) — `loadLevel()` just never adopted that same unconditional reset when it
  was written back in Story 4.3.
Owner agent: Simulation Engineer (change confined to
  apps/simulation-server/src/rooms/GameRoom.ts — single ownership area; no shared-types or
  net-protocol changes needed, see Non-goals)
Goal: In `loadLevel()`, reset every player's `hp` to `player.maxHp` unconditionally,
  matching `resetToHub()`'s existing unconditional-reset pattern — not only the
  isDown/isSpirit subset that already gets revived to REVIVE_HP.
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
  - apps/simulation-server/src/rooms/GameRoom.ts — read `loadLevel()`'s player-reset loop in
    full (~line 990-1007) and `resetToHub()`'s equivalent loop (~line 781-799) before editing;
    confirm exact current line numbers (may have shifted since this story was written)
  - packages/game-rules/src/balance.ts — confirms `REVIVE_HP = 30` (line 9), the value the
    isDown/isSpirit branch currently (and still, post-fix) assigns before the unconditional
    `maxHp` reset runs
Non-goals:
  - Do not change what happens to a downed/spirit player's `isDown`/`isSpirit`/
    `reviveTimerExpiresAt`/cooldown-flush handling. That logic (clearing the down/spirit flags,
    flushing expired class-ability cooldowns for players who were in spirit form) is correct
    and unrelated to the HP value itself — leave it exactly as-is; only the HP assignment
    changes scope and value.
  - Do not clear `player.statusEffects` at level transition. `resetToHub()` — the story's own
    cited precedent for "full reset on transition" — does NOT clear statusEffects either (see
    its loop at ~line 781-799), so extending that behavior here would be scope creep beyond
    what this story's AC asks for (HP only) and beyond the established precedent it cites.
  - Do not add a new wire message or change the snapshot/delta shape. Every `loadLevel()` call
    site already broadcasts a full `SnapshotMsg` immediately afterward (see Dev Notes) — the
    corrected `hp` value rides along for free. No protocol change, no Protocol Architect
    review needed.
  - Do not extract a shared helper function (e.g. `resetPlayerForTransition`) to de-duplicate
    `loadLevel()`'s and `resetToHub()`'s now-identical `player.hp = player.maxHp` line. One
    matching line in two places is not a DRY violation worth an abstraction — this codebase's
    established precedent (4.10/4.11 Non-goals) is to keep small per-call-site fixes small.
Acceptance criteria:
  1. In `loadLevel()`'s player-reset loop, every player's `hp` is set to `player.maxHp`
     unconditionally — including players who were NOT `isDown`/`isSpirit` (previously left
     untouched at whatever HP they ended the prior level with).
  2. Players who WERE `isDown`/`isSpirit` still have their down/spirit state cleared exactly
     as before (`isDown = false`, `isSpirit = false`, `reviveTimerExpiresAt = 0`, expired
     class-ability cooldowns flushed) — this story only changes what HP value they land on
     (`maxHp` instead of `REVIVE_HP`), not any of the surrounding state transition.
  3. The fix applies uniformly across every `loadLevel()` call site (level 1→2, 2→3, 3→boss
     transitions via `enterBondMoment`, the bond-moment `CONTINUE` handler, and the initial
     `startDungeon`'s `loadLevel(1)`) — it is a single change inside `loadLevel()` itself, not
     duplicated per call site.
  4. New unit test coverage proves: (a) a player who ended the previous level at partial HP
     (not down/spirit) has `hp === maxHp` after the mirrored transition logic runs; (b) a
     player who was down/spirit at the previous level's end also has `hp === maxHp` (not
     `REVIVE_HP`) after the transition, with `isDown`/`isSpirit`/`reviveTimerExpiresAt` still
     correctly cleared.
  5. Full monorepo typecheck and Vitest suite pass with no regressions.

Required hooks:
  - Simulation-safety hook (GameRoom.ts modified — typecheck, unit tests, deterministic tick
    test N/A [no PRNG/tick-order change — this is a one-shot state reset inside a
    message-handler-triggered transition, not tick() itself], replay test N/A [no wire-format
    change: SnapshotMsg's shape is unchanged, only the hp value it carries is now correct],
    perf sanity check N/A [same O(players) loop that already existed, one assignment moved out
    of a conditional — no new per-tick cost, this code doesn't even run every tick]).

Required tests:
  - New/updated unit tests in apps/simulation-server/tests/ per AC4 — mirror
    `loadLevel()`'s reset-loop logic directly (GameRoom isn't instantiable outside a live
    Colyseus room; follow the established pattern in
    apps/simulation-server/tests/game-room-level-clear-guard.test.ts and
    game-room-post-410-deferred-hardening.test.ts).
  - No changes expected to existing tests — this is a bug fix to previously-unguarded
    behavior; no test currently asserts the old (buggy) partial-HP-carryover behavior.

Telemetry impact: None — no new user-facing flow, no new event, no payload shape change (only
  a data value correction inside the existing SnapshotMsg broadcast).
```

---

## Story

As a player,
I want my health restored to full when a new dungeon level loads,
so that a hard-fought level doesn't carry a health penalty into the next one.

---

## Acceptance Criteria

**Given** `loadLevel()` runs at a level transition
**When** it processes each player
**Then** every player's `hp` is reset to `maxHp`, not only players who were `isDown`/`isSpirit`
(which already reset to `REVIVE_HP`)
**And** this applies uniformly regardless of how much HP a player had remaining at the end of
the previous level

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #1) — In `GameRoom.loadLevel()`'s player-reset loop
  (`apps/simulation-server/src/rooms/GameRoom.ts`, ~line 990-1007), move the HP assignment
  out of the `if (player.isDown || player.isSpirit)` branch so it runs unconditionally for
  every player, and change its value from `REVIVE_HP` to `player.maxHp`. See exact diff below.
- [ ] **Task 2** (AC: #1) — Verify the down/spirit branch still clears `isDown`, `isSpirit`,
  `reviveTimerExpiresAt`, and still flushes expired class-ability cooldowns for players who
  were in spirit form — none of that logic changes, only the HP line moves and its value
  changes.
- [ ] **Task 3** (AC: #4) — Add unit test coverage in `apps/simulation-server/tests/`
  mirroring the corrected reset-loop logic: one case for a partial-HP survivor (not
  down/spirit) landing at `maxHp`, one case for a down/spirit player landing at `maxHp` (not
  `REVIVE_HP`) with down/spirit state still cleared correctly.
- [ ] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [ ] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions, especially `tests/e2e/full-run.test.ts` (level-transition paths).

---

## Dev Notes

### Context — the exact gap

`GameRoom.loadLevel()` is the single function that runs on every dungeon level transition
(level 1→2, 2→3, 3→boss via `enterBondMoment`; the bond-moment `CONTINUE` handler; and the
initial `startDungeon`'s `loadLevel(1)` call). Its player-reset loop, as of this story's
baseline commit, reads (`apps/simulation-server/src/rooms/GameRoom.ts`, ~line 990-1007):

```ts
// Auto-revive downed/spirit players; carry downCount (shorter next revive window)
for (const player of this.gameState.players) {
  if (player.isDown || player.isSpirit) {
    const wasSpirit = player.isSpirit;
    player.isDown = false;
    player.isSpirit = false;
    player.reviveTimerExpiresAt = 0;
    player.hp = REVIVE_HP;
    // Flush class-ability cooldowns that expired during spirit form (AC7 fix)
    if (wasSpirit) this.flushExpiredClassCooldowns(player.id);
  }
  const spawnIdx = this.gameState.players.indexOf(player);
  const spawn = DUNGEON_SPAWN_POSITIONS[spawnIdx] ?? { x: 400, y: 540 };
  player.x = spawn.x;
  player.y = spawn.y;
  const body = this.playerBodies.get(player.id);
  if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
}
```

Two problems, both closed by the same fix:

1. A player who was NOT down/spirit keeps whatever `hp` they ended the previous level with —
   no reset at all for that subset.
2. A player who WAS down/spirit gets reset to `REVIVE_HP` (30, per
   `packages/game-rules/src/balance.ts:9`), not `maxHp` (100) — undershooting the AC's "full
   HP restore" requirement even for the subset that does get touched.

**Established precedent already exists in the same file.** `resetToHub()` (~line 746-799, the
"Return to Camp" hub-reset path) already does this correctly and unconditionally:

```ts
// resetToHub(), ~line 781-799 — for reference, do not edit this function
for (let i = 0; i < this.gameState.players.length; i++) {
  const player = this.gameState.players[i]!;
  const spawn = SPAWN_POSITIONS[i] ?? { x: 960, y: 540 };
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = player.maxHp;        // ← the pattern this story brings to loadLevel()
  player.isDown = false;
  player.isSpirit = false;
  player.isFrozen = false;
  player.nearPoiId = null;
  player.reviveTimerExpiresAt = 0;
  player.essenceTotal = 0;
  player.downCount = 0;
  // ...
}
```

`loadLevel()` simply never adopted `resetToHub()`'s unconditional `player.hp = player.maxHp`
when it was written (Story 4.3). This story brings it into line — nothing more.

### The fix

Move `player.hp = ...` out of the `if` block and change its value:

```ts
// After
for (const player of this.gameState.players) {
  if (player.isDown || player.isSpirit) {
    const wasSpirit = player.isSpirit;
    player.isDown = false;
    player.isSpirit = false;
    player.reviveTimerExpiresAt = 0;
    // Flush class-ability cooldowns that expired during spirit form (AC7 fix)
    if (wasSpirit) this.flushExpiredClassCooldowns(player.id);
  }
  // Full HP restore on every level transition (Story 4.12) — applies to every player,
  // not only the isDown/isSpirit subset; matches resetToHub()'s existing pattern (~line 787).
  player.hp = player.maxHp;
  const spawnIdx = this.gameState.players.indexOf(player);
  const spawn = DUNGEON_SPAWN_POSITIONS[spawnIdx] ?? { x: 400, y: 540 };
  player.x = spawn.x;
  player.y = spawn.y;
  const body = this.playerBodies.get(player.id);
  if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
}
```

`REVIVE_HP` stays imported and used elsewhere in `GameRoom.ts` (revive-by-proximity at
~line 2575/2594, Soul Mend revive at ~line 2855/2862) — those are mid-level revive paths,
unrelated to this story's level-transition fix; do not touch them.

### No protocol/broadcast change needed

Every `loadLevel()` call site already broadcasts a full `SnapshotMsg` (containing the whole
`gameState`, including corrected player `hp`) immediately after calling it:

- `startDungeon()` (~line 627 `loadLevel(1)`) → broadcasts `SNAPSHOT` after
- `enterBondMoment()` (~line 868, 875 `loadLevel(levelIndex + 1)`, both branches) →
  broadcasts `SNAPSHOT` after
- `CONTINUE` handler (~line 324 `loadLevel(nextLevel)`) → broadcasts `SNAPSHOT` after

The corrected `hp` value rides along in the existing snapshot for free — no new delta type,
no `apply-delta.ts` change, no Protocol Architect review, no contract test needed.

### Why not a shared helper / bigger refactor

`resetToHub()` and `loadLevel()` will now share one identical line
(`player.hp = player.maxHp;`) inside otherwise-different reset loops (different spawn tables,
different surrounding fields reset). That is not a DRY violation worth extracting a shared
`resetPlayerForTransition()` helper for — matches this codebase's own established precedent
(Story 4.10/4.11 Non-goals repeatedly reject introducing shared abstractions for 2-3
near-identical call sites). Leave both loops as they are; only change the one line inside
`loadLevel()`.

### Testing approach — mirror the logic, don't instantiate GameRoom

`GameRoom` is not instantiable outside a live Colyseus room (no exported constructor path for
unit tests). Every existing test that covers `GameRoom`-internal logic mirrors the relevant
snippet directly as a standalone function and asserts on it — see
`apps/simulation-server/tests/game-room-level-clear-guard.test.ts` and
`game-room-post-410-deferred-hardening.test.ts` for the established pattern. Follow the same
approach here: replicate the corrected reset-loop body (or just the `hp`-assignment
condition) as a small function, and assert:

1. A player with `hp: 20, maxHp: 100, isDown: false, isSpirit: false` → after the mirrored
   loop runs, `hp === 100`.
2. A player with `hp: 0, maxHp: 100, isDown: true, isSpirit: false` → after the mirrored loop
   runs, `hp === 100` (not `30`/`REVIVE_HP`), and `isDown === false`.
3. (Optional, cheap to add) A player with `isSpirit: true` → after the mirrored loop runs,
   `hp === 100` and `isSpirit === false`.

No existing test currently asserts on `loadLevel()`'s HP-reset behavior (confirmed by search
of `apps/simulation-server/tests/*.test.ts` and `tests/e2e/*.test.ts` for `hp`/`maxHp`/
`REVIVE_HP` near `loadLevel`/`level:complete`) — this is genuinely new coverage, not an
update to a test that encoded the old (buggy) behavior.

### Project Structure Notes

- Single-line-scope change, already inside an open file (`GameRoom.ts`) — no new files, no
  new directories, no new exports, no new dependencies.
- New test coverage goes in `apps/simulation-server/tests/` (existing directory, existing
  unit-test category per project-context.md's Testing Rules table).

### Project Context Rules

- **Ownership**: Change confined to `apps/simulation-server/**`, owned by Simulation
  Engineer — single ownership area, no cross-context approval needed.
- **Simulation-safety hook** (project-context.md, Engine-Specific Rules / Testing Rules):
  triggered because `GameRoom.ts` is modified. Typecheck and full unit test suite required;
  deterministic tick test N/A (no PRNG/tick-order change — this runs inside a level
  transition, not `tick()`); replay test N/A (no wire-format change, `SnapshotMsg`'s shape is
  untouched — only the `hp` value inside it is now correct).
- **Result<T, E> rule**: not applicable — this is a direct field mutation inside `GameRoom`
  (a Colyseus room method), matching the existing pattern at this exact call site and at
  `resetToHub()`; not a new `packages/game-rules` pure function.
- **Tick loop hygiene**: not applicable — `loadLevel()` runs once per level transition, not
  inside the 30Hz `tick()` loop.
- **Testing Rules**: unit tests for `GameRoom`-internal logic that can't be exercised by
  instantiating the class directly live in `apps/simulation-server/tests/`, using the
  mirrored-logic pattern already established by `game-room-level-clear-guard.test.ts` and
  `game-room-post-410-deferred-hardening.test.ts`.

### Previous Story Intelligence (from 4.11)

Story 4.11 (the immediately prior story in this epic) hardened `GameRoom.ts`'s
`startDungeon`/`CONTINUE`/`loadLevel`-boss-branch failure paths and reinforced two patterns
worth carrying forward here:

- **Read the exact current state before editing** — line numbers drift between stories;
  4.11's own header explicitly flagged this, and this story does the same (all line numbers
  above are "as of this story's baseline commit," confirm via re-read before editing).
- **Small, scoped diffs; no speculative abstractions** — 4.11's Non-goals repeatedly rejected
  building a shared helper to de-duplicate 2-3 near-identical call sites, and rejected fixing
  adjacent-but-out-of-scope issues found along the way (deferring them to `deferred-work.md`
  instead). This story follows the same discipline: one line, one behavior change, no
  speculative extraction (see "Why not a shared helper / bigger refactor" above).
- **GameRoom unit tests mirror logic, they don't instantiate the room** — 4.11's Task 4 added
  `game-room-post-410-deferred-hardening.test.ts` using exactly this pattern; this story's
  Task 3 should follow the same file-naming/structuring convention (either a new small test
  file, e.g. `game-room-level-transition-hp.test.ts`, or an addition to
  `game-room-level-clear-guard.test.ts` if that reads more naturally as "level-transition
  behavior" — dev's judgment, both are consistent with the established pattern).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.12: Full HP Restore on Level Transition] — original AC
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#loadLevel] — the function this story
  fixes (~line 937-1007 as of baseline commit)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#resetToHub] — established precedent
  for the unconditional `player.hp = player.maxHp` pattern (~line 746-799)
- [Source: packages/game-rules/src/balance.ts] — `REVIVE_HP = 30` (line 9), the value the
  isDown/isSpirit branch assigned before this fix
- [Source: apps/simulation-server/tests/game-room-level-clear-guard.test.ts,
  game-room-post-410-deferred-hardening.test.ts] — established mirrored-logic unit test
  pattern for `GameRoom`-internal behavior
- [Source: _bmad-output/implementation-artifacts/4-11-epic-4-post-410-deferred-hardening.md] —
  immediately prior story in this epic; established scoped-diff and no-speculative-
  abstraction discipline this story follows
- [Source: _bmad-output/project-context.md#Testing Rules, #Code Organization Rules] — test
  category placement, monorepo ownership boundaries

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

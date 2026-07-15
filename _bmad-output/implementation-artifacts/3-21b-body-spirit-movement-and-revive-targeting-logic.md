---
baseline_commit: f6b5db7
---

# Story 3.21b: Body/Spirit Movement & Revive-Targeting Logic

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / Epic 3 Correction (Downed Player Body/Spirit
  Entity Split — second of the 3.21a → 3.21b → 3.21c sequence. Depends on
  3.21a's `PlayerState.bodyX/bodyY` and `PlayerDownedDelta.bodyX/bodyY`
  schema, which must be merged before this story starts.)

Context: 3.21a added optional `bodyX`/`bodyY` to the schema but touched
  zero simulation code (it was schema/contract-only, blocked from
  `apps/simulation-server/**`). This story is where the fields actually
  get populated and consumed. Two pieces of good news from tracing the
  actual current code before writing this story's tasks:

  1. **"Stop the body moving on isSpirit transition" requires NO new
     code.** The physics velocity-gate (`GameRoom.ts`'s Planck phase 1,
     ~line 1316) already zeroes velocity only for `isFrozen || class ===
     null || isDown` — it does NOT gate on `isSpirit`, which is exactly
     why the spirit currently moves freely once `isDown` flips off. Once
     this story sets `bodyX`/`bodyY` at down-time and nothing else ever
     writes to those two fields again, they stay fixed automatically —
     there is no separate "body" physics body or velocity to stop, because
     `bodyX`/`bodyY` are plain data fields the movement loop never
     touches. Do not add an `isSpirit` branch to the velocity gate; it
     would incorrectly freeze the spirit's own movement.

  2. **There are FOUR places a player transitions to `isDown = true`,
     not one — and only THREE of them go through the same pure function.**
     Melee damage (`GameRoom.ts` ~line 2387), the ability/Dark-Pact-drain
     path (~line 1241), and the Fate Bond wipe cascade (~line 2437) all
     call `applyPlayerDamage` (`packages/game-rules/src/systems/
     player-health.ts`) — a single pure function is the natural, DRY place
     to set `bodyX`/`bodyY` for all three. But **boss stomp damage
     (~line 1734) bypasses `applyPlayerDamage` entirely** and mutates
     `player.hp`/`isDown`/`downCount`/`reviveTimerExpiresAt` inline — it
     needs its own explicit `bodyX`/`bodyY` assignment, or boss-stomp-
     downed players will silently have no body position. Grep for
     `isDown = true`/`isDown: true` yourself before starting to confirm
     this hasn't changed since this story was written.

  3. **Story 3.18's Soul Mend already scopes its `downedAllies` filter to
     `p.isDown` only** (never `p.isSpirit` — `handleSoulMendFireAttempt`,
     `GameRoom.ts` ~line 2782) per its own story's explicit AC ("rejects
     targets not currently in `isDown` state"). Since an `isDown`
     (not-yet-spirit) player's `x`/`y` is frozen and now equals `bodyX`/
     `bodyY` by construction, Soul Mend's existing `caster.x/y` vs
     `target.x/y` targeting math needs **no functional change** — only a
     regression test confirming it still resolves correctly in a game
     state where *other* players have diverged spirit positions.

  4. **Neither existing revive path resets `x`/`y` to the body location —
     this story must add that, or 3.21c's rendering assumption breaks.**
     Epics.md's 3.21c AC states "the player's normal alive-state rendering
     resumes at the body's location" after revive. Today, both revive
     paths — the proximity-revive block (`GameRoom.ts` ~line 2548) and
     `reviveBySoulMend` (`packages/game-rules/src/systems/soul-mend.ts`) —
     only reset `isDown`/`isSpirit`/`hp`/`reviveTimerExpiresAt`; neither
     touches `x`/`y`. If a player was revived after wandering in spirit
     form, their post-revive `x`/`y` would still be wherever the spirit
     last stood, not the body's location — a teleport-feeling discontinuity
     that also means 3.21c would have nothing correct to render "at the
     body's location" for the revived player. This story adds `x:
     player.bodyX ?? player.x, y: player.bodyY ?? player.y` to both revive
     transitions, so the AC's fiction (revived where the body was found)
     is actually true in `GameState`, not just implied by rendering.

Owner agent: Simulation Engineer (single ownership area)

Goal:
  Task 1 — Set `bodyX`/`bodyY` at every down-transition (the shared
            `applyPlayerDamage` pure function, plus the boss-stomp inline
            path) and include them in all 4 `player:downed` delta
            broadcasts.
  Task 2 — Revive proximity check compares against `bodyX`/`bodyY`
            instead of the (now spirit-moving) `x`/`y`.
  Task 3 — Both revive paths (proximity, Soul Mend) snap `x`/`y` back to
            `bodyX`/`bodyY` on revive, so the revived player actually ends
            up where the body was found.
  Task 4 — Regression test confirming Soul Mend's existing `isDown`-only
            targeting still resolves correctly once body/spirit positions
            diverge for other players.

Allowed paths:
  - packages/game-rules/src/systems/player-health.ts
  - packages/game-rules/src/systems/soul-mend.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - tests/unit/player-health.test.ts
  - tests/unit/soul-mend.test.ts
  - apps/simulation-server/tests/** (if a GameRoom-level regression test is
    added — optional, see Dev Notes on this codebase's existing gap here)

Blocked paths:
  - packages/shared-types/** (3.21a — schema already landed, do not modify)
  - packages/net-protocol/** (3.21a — do not modify the delta type itself,
    only populate the fields this story's own broadcasts already have
    available)
  - apps/host-client/** (3.21c — rendering)
  - Any ability/class logic unrelated to down/revive/Soul Mend

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.21b" section
  - _bmad-output/implementation-artifacts/3-21a-body-spirit-position-schema-and-protocol-contract.md
    — the schema this story consumes (confirm it has landed/merged first)
  - packages/game-rules/src/systems/player-health.ts (`applyPlayerDamage`)
  - apps/simulation-server/src/rooms/GameRoom.ts — down-transition call
    sites (~1241 Dark Pact, ~1734 boss stomp, ~2387 melee, ~2437 Fate Bond
    wipe), `player:downed` broadcasts (~1253, ~1744, ~2409, ~2451), the
    revive timer-expiry/proximity block (~2507-2572), and Soul Mend's
    `handleSoulMendFireAttempt` (~2759-2802)
  - _bmad-output/implementation-artifacts/3-18-soul-mend-ranged-spirit-targeting-revive.md
    — original Soul Mend scope (`isDown`-only targeting, deliberate)

Non-goals:
  - Do not change the physics velocity gate to also check `isSpirit` — see
    Context point 1, this would break spirit movement.
  - Do not change Soul Mend's `downedAllies` filter to include `isSpirit`
    players — that would expand 3.18's scope, which this story explicitly
    does not touch (regression test only, confirming unchanged behavior).
  - Do not reset `bodyX`/`bodyY` on revive/level-transition — their value
    is only ever read while `isDown`/`isSpirit`, and gets overwritten at
    the next down-transition regardless; leaving stale values between runs
    is harmless and not worth the extra code.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED (`apps/simulation-server/**`,
    `packages/game-rules/**`). Requires: typecheck, unit tests,
    deterministic-tick sanity (this story adds no new randomness, so this
    reduces to "no behavior change to existing deterministic paths"),
    basic perf sanity (no new per-tick allocations — `bodyX`/`bodyY` are
    plain number assignments, same cost class as the existing `x`/`y`
    assignments).
  - Contract-change hook: NOT triggered by this story alone (the wire
    shape was already finalized in 3.21a) — this story only populates
    fields the contract already declares.
  - Ownership hook: single ownership area — no split needed.

Required tests:
  - tests/unit/player-health.test.ts — `applyPlayerDamage` sets `bodyX`/
    `bodyY` to the pre-damage `x`/`y` when the hit downs the player, and
    leaves them untouched (or absent) when the hit doesn't down the
    player.
  - tests/unit/soul-mend.test.ts — `reviveBySoulMend` resets `x`/`y` to
    `bodyX`/`bodyY` per AC4; a separate regression test per AC5/Context
    confirms `findSoulMendTarget` still resolves the correct `isDown`
    target when other players in the same candidate set have diverged
    `x`/`y` (spirit position) vs `bodyX`/`bodyY` — confirms the pre-existing
    `isDown`-only filter and coordinate read are unaffected by the schema
    split.

Telemetry impact: None.
```

---

## Story

As a simulation engineer,
I want the downed body to stay fixed while the spirit moves independently once spirit form begins,
so that teammates revive the body's location, not a moving target, while the downed player can still act via their spirit.

---

## Acceptance Criteria

**AC1 — Body position fixed at down-time:**
**Given** a player's health reaches zero
**When** `player:downed` fires (from any of the 4 down-transition paths: melee, boss stomp, ability/Dark-Pact-drain, Fate Bond wipe)
**Then** `bodyX`/`bodyY` are set to the player's current position and velocity is zeroed (unchanged from today's frozen-while-down behavior), and the broadcast `player:downed` delta includes `bodyX`/`bodyY`

**AC2 — Spirit moves independently of the fixed body:**
**Given** the revive timer expires and `isSpirit` becomes `true`
**When** the spirit-form player sends movement input
**Then** `x`/`y` move independently of `bodyX`/`bodyY`, which remain fixed at the down location

**AC3 — Revive proximity targets the body, not the spirit:**
**Given** a teammate attempts to revive a downed player
**When** the proximity check runs (`GameRoom.ts` revive resolution)
**Then** it compares against `bodyX`/`bodyY` instead of the player's current `x`/`y`, regardless of where the spirit has moved

**AC4 — Revive snaps position back to the body location:**
**Given** a downed player is revived, whether by proximity or by Soul Mend
**When** the revive state transition applies
**Then** `x`/`y` are set to `bodyX`/`bodyY` (in addition to the existing `isDown: false, isSpirit: false, hp: <revive HP>, reviveTimerExpiresAt: 0` transition), so the player's controllable position resumes at the body's location rather than wherever the spirit last wandered

**AC5 — Soul Mend regression:**
**Given** Story 3.18's Soul Mend ranged revive
**When** a Spiritcaller channels Soul Mend at a downed ally
**Then** it continues to target the (still-`isDown`) ally's current `x`/`y` (unchanged targeting behavior — Soul Mend only ever targets `isDown`, never `isSpirit`, players per 3.18's original scope) — verified with a regression test added to `tests/unit/soul-mend.test.ts` confirming Soul Mend still resolves correctly once body and spirit positions diverge for other players in the same game state

---

## Tasks / Subtasks

- [x] **Task 1a** (AC: #1) — `packages/game-rules/src/systems/player-health.ts`:
  in `applyPlayerDamage`, when `downed` is `true`, set `bodyX: player.x,
  bodyY: player.y` on the `updatedPlayer` object (the pre-damage position —
  read `player.x`/`player.y` before they'd ever change, which they don't
  in this function anyway). Covers melee, Dark Pact drain, and Fate Bond
  wipe (all 3 call sites already route through this function).

- [x] **Task 1b** (AC: #1) — `apps/simulation-server/src/rooms/GameRoom.ts`:
  in the boss-stomp inline down block (~line 1734-1737, the one path that
  bypasses `applyPlayerDamage`), add `player.bodyX = player.x; player.bodyY
  = player.y;` alongside the existing `player.isDown = true` / `downCount++`
  mutations.

- [x] **Task 1c** (AC: #1) — Update all 4 `player:downed` delta broadcasts
  (~1253 Dark Pact, ~1744 boss stomp, ~2409 melee, ~2451 Fate Bond wipe) to
  include `bodyX`/`bodyY` in the payload, reading from the now-set
  `player.bodyX`/`player.bodyY` (or `dmgResult.value.player.bodyX/bodyY`
  where the payload is built from the `applyPlayerDamage` result).

- [x] **Task 2** (AC: #3) — `GameRoom.ts`'s proximity-revive distance check
  (~line 2538-2540, inside the "Revive timer expiry and proximity revive"
  block): change the comparison from `teammate.x/y` vs `player.x/y` to
  `teammate.x/y` vs `player.bodyX ?? player.x` / `player.bodyY ?? player.y`.
  The `??` fallback should never actually trigger once Task 1 is complete
  (every down-transition sets `bodyX`/`bodyY` before this loop can ever run
  against that player) — it's defensive, not load-bearing.

- [x] **Task 3a** (AC: #4) — `GameRoom.ts`'s proximity-revive block
  (~line 2548): add `x: player.bodyX ?? player.x, y: player.bodyY ??
  player.y` to the object-spread that already resets `isDown: false,
  isSpirit: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0`.

- [x] **Task 3b** (AC: #4) — `packages/game-rules/src/systems/
  soul-mend.ts`'s `reviveBySoulMend`: add the same `x: target.bodyX ??
  target.x, y: target.bodyY ?? target.y` to its returned object, alongside
  the existing `isDown: false, isSpirit: false, hp: reviveHp,
  reviveTimerExpiresAt: 0`.

- [x] Write `tests/unit/player-health.test.ts` coverage per AC1 (see
  Required tests above).

- [x] Write a `reviveBySoulMend` test in `tests/unit/soul-mend.test.ts` per
  AC4 confirming it resets `x`/`y` to `bodyX`/`bodyY` when the target's
  spirit position had diverged.

- [x] Write the Soul Mend targeting regression test in `tests/unit/
  soul-mend.test.ts` per AC5 — construct a scenario with a downed target
  (`isDown: true`,
  `bodyX`/`bodyY` set to the down location) and at least one other player
  whose `x`/`y` (spirit position) has diverged from their own `bodyX`/
  `bodyY`, confirm `findSoulMendTarget` still correctly resolves the
  `isDown` target using its (unchanged) `x`/`y`.

- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.
  Pay particular attention to any existing test in `tests/unit/
  player-health.test.ts`, `tests/unit/soul-mend.test.ts`, or `apps/
  simulation-server/tests/**` that constructs a `PlayerState` or
  `player:downed`-adjacent fixture — those may need `bodyX`/`bodyY` added
  to stay meaningful, though the optional-field schema means none of them
  will fail to typecheck without it.

### Review Findings

- [x] [Review][Patch] Self-caught during implementation, before external review: the proximity-revive loop's pre-existing outer guard (`if (!player.isDown) continue;`) never admitted `isSpirit` players, so a player who already transitioned to spirit form could never re-enter the loop on any later tick — meaning the bodyX/bodyY-targeting fix (Task 2) never actually executed for the exact "spirit has wandered off" scenario this story exists to fix. **Fixed:** guard changed to `if (!player.isDown && !player.isSpirit) continue;`; confirmed correct by the Acceptance Auditor and by a new dedicated test.
- [x] [Review][Patch] No test exercised the actual per-tick revive-proximity loop (only pure-function unit tests existed) — the most complex and most bug-prone part of the change, and the one that would have caught the guard bug above automatically. **Fixed:** added `apps/simulation-server/tests/game-room-revive-proximity.test.ts` (5 tests), mirroring `game-room-soul-mend-channel.test.ts`'s established precedent for testing `GameRoom`'s per-tick orchestration without a live Colyseus room.
- [x] [Review][Patch] Soul Mend's revive completion added a physics-body reposition call justified only as "consistency/forward-safety" for a scenario its own comment admitted is unreachable today (Soul Mend never targets `isSpirit` players) — speculative code for a hypothetical future scope change. **Fixed:** removed; also eliminates a DRY/duplication concern since only one revive path (proximity) now touches the physics body.
- [x] [Review][Patch] Comment volume was disproportionate to the one-line changes in `player-health.ts`/`soul-mend.ts`. **Fixed:** trimmed both to their essential "why," keeping the exactOptionalPropertyTypes rationale (non-obvious) and dropping restated context.
- [x] [Review][Defer] `?? player.x`/`?? target.x` fallbacks in the proximity-revive check and `reviveBySoulMend` silently resolve to the player's current (possibly-wandered) position if a future down-transition path ever omits `bodyX`/`bodyY`, rather than failing loudly — deferred, same class of accepted tradeoff as Story 3.21a's deferred fallback-related items (`D-3.21a-A`/`D-3.21a-B`). All 4 current down-paths set `bodyX`/`bodyY` unconditionally, and the new `game-room-revive-proximity.test.ts` + `player-health.test.ts` coverage substantially reduces the practical risk.

---

## Dev Notes

### Grep before you start — call sites may have shifted

Line numbers above were read directly from the current `GameRoom.ts` at
story-creation time, but this file changes often (5 kit-rework stories
touched it in this same batch). Re-grep `isDown = true`, `isDown: true`,
`isDown: downed`, and `'player:downed'` before starting Task 1 to confirm
there are still exactly 4 down-transition sites and the boss-stomp one is
still the only one bypassing `applyPlayerDamage`.

### `applyPlayerDamage`'s current shape (read before editing)

```ts
export function applyPlayerDamage(
  player: PlayerState, damage: number, nowMs: number,
): Result<PlayerDamageResult, HealthError> {
  // ...guards...
  const newHp = Math.max(0, player.hp - mitigatedDamage);
  const downed = newHp === 0;
  const newDownCount = downed ? player.downCount + 1 : player.downCount;
  const reviveWindowMs = downed ? getReviveWindowMs(newDownCount) : undefined;

  const updatedPlayer: PlayerState = {
    ...player, hp: newHp, isDown: downed, downCount: newDownCount,
  };
  // add bodyX/bodyY here, conditionally on `downed`
  // ...
}
```

Only set `bodyX`/`bodyY` when `downed` is `true` — do not overwrite them
on every call (a non-downing hit shouldn't touch the body position, and
once a player is already `isDown`, `applyPlayerDamage`'s own guard at the
top (`if (player.isDown || player.isSpirit) return err`) means this
function is never called again for that player until they're revived
anyway, so there's no double-set risk either way — but be explicit for
readability).

### Why the boss-stomp path is special

`GameRoom.ts`'s "Boss stomp damage from previous tick" block mutates
`player.hp`/`isDown`/`downCount`/`reviveTimerExpiresAt` directly on the
live `GameState` object rather than through `applyPlayerDamage` — this
predates this story and is out of scope to refactor (no ticket calls for
unifying the two down-paths, and doing so is a bigger, riskier change than
this story needs). Just mirror the same 2-line `bodyX`/`bodyY` assignment
inline there too.

### `PlayerChipHUD` and other read-only consumers

`apps/host-client` is a blocked path for this story (3.21c owns it) — do
not touch it even if you notice it doesn't yet render the split
body/spirit visual. That's explicitly 3.21c's job.

### Project Context Rules

- `packages/game-rules` — pure functions only, no I/O, no Colyseus/planck
  imports. Task 1a's `applyPlayerDamage` change is a pure data assignment,
  consistent with this rule.
- Result<T, E> — never throw from game-rules. `applyPlayerDamage` already
  returns `Result`; this story doesn't add a new error path, just extends
  the success-case object.
- PRNG rule: not applicable — this story adds no randomness.
- Same tick-loop-hygiene rules as every other story touching `GameRoom.ts`
  in this batch: no `logger.info`/`warn`/`error` inside the tick, no new
  per-tick heap allocations beyond the existing per-player object spreads
  already present in these code paths.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.21b]
- [Source: _bmad-output/implementation-artifacts/3-21a-body-spirit-position-schema-and-protocol-contract.md] — schema this story consumes
- [Source: packages/game-rules/src/systems/player-health.ts] — `applyPlayerDamage`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — down-transition call sites, revive block, Soul Mend dispatch
- [Source: _bmad-output/implementation-artifacts/3-18-soul-mend-ranged-spirit-targeting-revive.md] — original Soul Mend `isDown`-only scope

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- Re-grepped `isDown = true`/`isDown: true`/`'player:downed'` before starting —
  confirmed all 4 down-transition sites and their line numbers were unchanged
  from story-creation time (Dark Pact ~1253, boss stomp ~1737/1744, melee
  ~2409, Fate Bond wipe ~2451).
- `npm run typecheck` — 0 errors across all 10 project references.
- `npx vitest run` (full suite) — 479 passed, 0 failed, 12 skipped (474
  pre-story + 5 new tests: 2 in `player-health.test.ts`, 3 in
  `soul-mend.test.ts`).
- `npm run lint` — clean (no output).
- TypeScript issue hit and fixed during Task 1a: a ternary like `bodyX:
  hasBody ? evt.bodyX : p.x` (checking a hoisted `const hasBody` boolean)
  fails under this project's `exactOptionalPropertyTypes: true` because TS
  loses the narrowing connection between the hoisted boolean and the original
  `evt.bodyX`/`target.bodyX` expression — the ternary's result type stays
  `number | undefined`, which an optional property can't accept explicitly.
  Fixed by using a conditional object spread in `applyPlayerDamage`
  (`...(downed ? { bodyX: player.x, bodyY: player.y } : {})`) instead of a
  ternary assignment, and by using `!` non-null assertions at the 4
  `player:downed` broadcast sites (matching this file's existing convention,
  e.g. `reviveWindowMs!`), since the surrounding `if (dmgResult.value.downed)`
  guard already guarantees `bodyX`/`bodyY` are set at that point even though
  TS can't express that connection through the type system alone.

### Completion Notes List

- Task 1a: `applyPlayerDamage` (`packages/game-rules/src/systems/
  player-health.ts`) now sets `bodyX`/`bodyY` to the pre-damage `x`/`y` via a
  conditional spread, only when the hit actually downs the player — covers
  melee, Dark Pact drain, and Fate Bond wipe (all 3 route through this
  function).
- Task 1b: the boss-stomp inline down block (`GameRoom.ts`, bypasses
  `applyPlayerDamage`) now also sets `player.bodyX`/`player.bodyY` directly,
  alongside its existing `isDown`/`downCount` mutations.
- Task 1c: all 4 `player:downed` broadcasts now include `bodyX`/`bodyY`.
- Task 2: the proximity-revive distance check now compares `teammate.x/y`
  against `player.bodyX ?? player.x` / `player.bodyY ?? player.y` instead of
  the (now independently-moving) `player.x/y`.
- Task 3a/3b — **judgment call beyond the story's literal task text**: while
  implementing the revive-position snap (setting `x`/`y` to `bodyX`/`bodyY`
  on both revive paths), traced through `GameRoom.ts`'s Planck physics loop
  and found that a direct `gameState.players[i].x/y` mutation alone is
  insufficient — the next tick's "Planck phase 3: read back positions" block
  reads each player's actual physics-body position and overwrites `player.x/y`
  from it whenever they differ by more than 0.5px. Without also repositioning
  the physics body, the very next tick would have silently undone the revive
  snap, reverting the player back to wherever their spirit's body had
  physically drifted to. Fixed by also calling `body.setPosition(...)` at
  both revive sites (mirroring the existing `applyDisplacementToPlayer`
  pattern), and broadcasting a `player:moved` delta from the proximity-revive
  path so the host's mirrored state picks up the corrected position too
  (omitted for the Soul Mend path since it's a no-op there today — Soul Mend
  only ever targets `isDown`, not `isSpirit`, players, so `x`/`y` never
  actually differs from `bodyX`/`bodyY` at that point; the fix is still
  applied for consistency and forward-safety, matching this story's Context
  section point 3, but produces no observable position change today given
  the physics body was already at the snap target).
- Tests: added 2 tests to `tests/unit/player-health.test.ts` (bodyX/bodyY set
  on down, untouched on non-downing hit) and 3 to `tests/unit/
  soul-mend.test.ts` (reviveBySoulMend resets x/y; falls back when
  bodyX/bodyY absent; findSoulMendTarget regression with a diverged-position
  spirit in the candidate set).

Confidence: 85% — the physics-body repositioning gap (see Task 3a/3b note)
was caught by manually tracing the tick loop rather than by an automated
test, since no test in this codebase spins up a live `GameRoom`/Planck world
(same pre-existing gap this batch has repeatedly noted, e.g. D-3.16-A/
D-3.17-B). The fix itself mirrors an established pattern
(`applyDisplacementToPlayer`) so confidence in its correctness is high, but
it is unverified by an integration test — flagging per this codebase's
convention of disclosing exactly this class of gap rather than silently
shipping it.

### File List

- `packages/game-rules/src/systems/player-health.ts` — `applyPlayerDamage` sets `bodyX`/`bodyY` on down
- `packages/game-rules/src/systems/soul-mend.ts` — `reviveBySoulMend` resets `x`/`y` to `bodyX`/`bodyY`
- `apps/simulation-server/src/rooms/GameRoom.ts` — boss-stomp `bodyX`/`bodyY` set; 4 `player:downed` broadcasts carry `bodyX`/`bodyY`; proximity-revive loop guard fixed to admit `isSpirit` players, targets `bodyX`/`bodyY`, and snaps `x`/`y` + physics body + `player:moved` on revive
- `tests/unit/player-health.test.ts` — 2 new tests
- `tests/unit/soul-mend.test.ts` — 3 new tests
- `apps/simulation-server/tests/game-room-revive-proximity.test.ts` (new) — 5 tests mirroring the per-tick revive-proximity loop

## Change Log

- 2026-07-14: Story implemented — `bodyX`/`bodyY` populated at all 4
  down-transition sites; revive-proximity targets the body; both revive
  paths snap `x`/`y` (and the physics body) back to the body location; Soul
  Mend regression test added. Status → `review`.
- 2026-07-14: Code review — 4 patches applied, most notably a self-caught fix
  to the revive-proximity loop's outer guard (previously never admitted
  `isSpirit` players, so the core fix never actually executed for a
  wandered-off spirit) plus a new GameRoom-level test for that exact loop.
  Also removed speculative dead code from the Soul Mend revive path (YAGNI).
  1 item deferred (silent fallback masking a future omission — logged in
  `deferred-work.md`). 0 decision_needed. Status → `done`.

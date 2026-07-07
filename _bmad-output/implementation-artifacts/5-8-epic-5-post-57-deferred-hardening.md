---
baseline_commit: 083fdd9
---

# Story 5.8: Epic 5 — Post-5.7 Deferred Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.8 — post-5.7 deferred hardening, no new features)
Context: Story 5.7 (epic-5-deferred-hardening) closed 5 deferred findings from Stories
  5.1-5.6's code reviews. Its own code review surfaced 3 new findings, logged in
  deferred-work.md under "Deferred from: code review of 5-7-epic-5-deferred-hardening
  (2026-07-07)": D-5.7-A (bond sensor fixture leak), D-5.7-B (isSpirit players made fully
  immobile by 5.7's AC2, reversing story 3.6's stated intent), D-5.7-C (AllBondsActive
  achievement unreachable in 2-player sessions). No other Epic 5 work remains open.

  Product/Game Design decision on D-5.7-B (asked directly, since deferred-work.md flagged
  it as needing exactly this call): narrow 5.7's AC2 rather than keep it as shipped —
  isSpirit players regain joystick-driven movement (matching 3.6's "keep moving and use my
  spirit ability to support my teammates" intent), but stay excluded from the Fate-bond
  speed buff and from Proximity-bond buff/drain eligibility, so the exploit 5.7 was
  actually guarding against (an incapacitated player's body triggering bond effects) stays
  closed. isDown players are NOT touched by this story — they remain fully frozen exactly
  as 5.7 left them; only isSpirit's movement-freeze is being narrowed.

  Current codebase state entering this story (apps/simulation-server/src/rooms/GameRoom.ts,
  packages/game-rules/src/systems/bonds.ts — read both in full before editing):
  - GameRoom.ts tick()'s movement-velocity loop (~line 1015) freezes on
    `player.isFrozen || player.class === null || player.isDown || player.isSpirit`. The
    `|| player.isSpirit` clause is what D-5.7-B's fix narrows away.
  - GameRoom.ts tick()'s Fate-bond speed calc (~line 1025) is
    `fateBuffed.has(player.id) ? SPEED * BOND_SPEED_MULT : SPEED` — today `fateBuffed`
    never contains a spirit player's effective speed because the loop `continue`s before
    reaching this line for isSpirit. Once the freeze clause above is narrowed, this line
    must independently exclude isSpirit or spirit players regain the Fate speed buff.
  - bonds.ts `getProximityBuffedPlayers` and `getProximityDrainTargets` compute proximity
    buff/drain eligibility purely from `bondsInRange` (a physics-contact-driven Set) with
    no player-state filter at all — unlike `getFateBondWipeTargets`, which already takes a
    `players` array and filters `isDown`/`isSpirit`/`isFrozen`. `apps/simulation-server/src
    /physics/sensors.ts`'s `extractBondSensorContact` is purely geometric (fixture
    userData + body userData) and has no player-state awareness — it cannot be the filter
    point. Once isSpirit players can move again, their body can create fresh bond-sensor
    contacts with their bonded partner exactly like 5.7's D-5.3-B originally described for
    downed players, but this time re-opened specifically for spirit form.
  - D-5.7-A's premise ("assignBond's returned pair order flips on repeat calls, leaking the
    old sensor fixture") does NOT reproduce against the current code: 5.7's own code review
    already patched `assignBond`'s duplicate-pair branch to return
    `{ playerA: existing.playerA, playerB: existing.playerB, bondType: existing.type,
    bondColor: existing.color }` — i.e. the STORED bond's own order, not a freshly-drawn
    `selectBondPair` result. `enterBondMoment`'s `bondKey(playerA, playerB)` is computed
    from that same returned value, so the key is stable across repeat calls for the same
    pair regardless of what `selectBondPair` draws internally. Read `bonds.ts` `assignBond`
    (lines ~34-63) to confirm this yourself before touching anything — Task 1 below is a
    verification-and-regression-test task, not a fix, and must not re-implement a canonical
    sort key or otherwise touch `enterBondMoment`'s sensor-fixture block unless your own
    reading finds the premise still holds.
  - `allBondsAtBossStart` is computed in `GameRoom.ts loadLevel()` (~line 920) as
    `this.gameState.activeBonds.length === BOSS_LEVEL_INDEX - 1` (`=== 3`), a fixed literal
    assuming 3 distinct pairs always accumulate. With 5.7's AC1 duplicate-pair guard now
    correctly capping `activeBonds` at 1 unique entry for a 2-player session (only one pair
    ever possible), `allBondsAtBossStart` can never become true for 2 players —
    `AllBondsActive` is permanently unreachable in 2-player sessions. `achievements.ts`
    itself just reads the boolean (`packages/game-rules/src/systems/achievements.ts:22-23`)
    — the fix belongs entirely in `GameRoom.ts`'s computation, not in `achievements.ts`.

Owner agent: Simulation Engineer (single context — all 3 tasks touch only
  apps/simulation-server/** and packages/game-rules/**, no cross-boundary split needed).

Goal: Close the 3 deferred findings from the 5.7 code review.
  Task 1 — Verify D-5.7-A no longer reproduces; add a regression test locking in the
            invariant (bondKey stability across repeat assignBond calls for the same pair)
            instead of re-implementing an already-fixed bug.
  Task 2 — Narrow 5.7's AC2 per the Product/Game Design decision: isSpirit players regain
            joystick movement; Fate-bond speed buff and Proximity-bond buff/drain
            eligibility explicitly exclude isSpirit players. isDown is untouched.
  Task 3 — Make `allBondsAtBossStart` player-count-aware so `AllBondsActive` is reachable
            in 2-player sessions (and remains capped at 3 for 3+ players, unchanged).

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts                (Tasks 2, 3)
  - packages/game-rules/src/systems/bonds.ts                    (Task 2)
  - tests/unit/bonds.test.ts                                    (Tasks 1, 2)
  - apps/simulation-server/tests/**                              (Task 3, if a suitable
    existing test file covers loadLevel/allBondsAtBossStart — do not create a new test
    directory for one assertion)

Blocked paths:
  - packages/net-protocol/**
  - packages/shared-types/**
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - packages/game-rules/src/systems/achievements.ts (the fix is in GameRoom.ts's
    computation of the input boolean, not in the achievement's own read of it)
  - packages/game-rules/src/** except systems/bonds.ts

Inputs:
  - deferred-work.md: D-5.7-A, D-5.7-B, D-5.7-C (under "Deferred from: code review of
    5-7-epic-5-deferred-hardening")
  - packages/game-rules/src/systems/bonds.ts (read fully — `assignBond`,
    `getProximityBuffedPlayers`, `getFateBuffedPlayers`, `getFateBondWipeTargets`,
    `getProximityDrainTargets`, and `bondKey`)
  - apps/simulation-server/src/rooms/GameRoom.ts (read fully: `enterBondMoment` ~line 790,
    `loadLevel`'s boss branch ~line 916-921, `tick()`'s movement-velocity loop ~line
    1007-1030, and the proximity-drain block ~line 1552-1585)
  - apps/simulation-server/src/physics/sensors.ts (read `extractBondSensorContact` — confirm
    it is purely geometric, so player-state filtering cannot live there)
  - tests/unit/bonds.test.ts (existing test fixtures and conventions for
    `getProximityBuffedPlayers`/`getProximityDrainTargets`/`getFateBondWipeTargets`)
  - _bmad-output/implementation-artifacts/5-7-epic-5-deferred-hardening.md (prior story;
    read its Dev Agent Record and Senior Developer Review sections for why AC2 was shipped
    as full-freeze and why D-5.7-A/B/C were deferred rather than fixed inline)

Non-goals:
  - Do not touch `isDown`'s movement-freeze or bond eligibility — only `isSpirit` is being
    narrowed. A downed player's body must remain fully frozen exactly as 5.7 left it.
  - Do not add player-state filtering inside `extractBondSensorContact` or any other
    physics/sensors.ts code — physics stays geometric; eligibility filtering belongs in
    game-rules/GameRoom per the codebase's existing split (see `getFateBondWipeTargets` for
    precedent).
  - Do not refactor `getFateBuffedPlayers` to accept a player-state parameter — the
    isSpirit exclusion for Fate speed is a single-player check already available inline in
    GameRoom.ts's per-player tick loop; adding a parameter to the pure function for a
    one-line inline check elsewhere would be an unrequested abstraction.
  - Do not change `BOSS_LEVEL_INDEX - 1` (3) as the cap for 3+ players — only the 2-player
    case changes. Do not add a general "N choose 2" combinatorics helper; a 2-vs-3+-player
    branch is sufficient and this is the only player count that currently breaks the
    literal-3 assumption (session `maxPlayers` is 8, but only 3 bond-moments ever occur —
    one per dungeon level — so 3+ players already caps correctly at the existing literal).
  - Do not touch `achievements.ts` — the achievement itself is already correct ("if
    `allBondsAtBossStart` is true, award it"); only the boolean's computation is wrong.

Acceptance criteria:
  1. A new or updated test in `tests/unit/bonds.test.ts` asserts that `assignBond` called
     twice for the same 2-player pair returns an identical `bondKey`-derivable
     `(playerA, playerB)` order both times — locking in that D-5.7-A cannot silently
     regress. No production code change is required if (as expected) the assertion already
     passes against current `bonds.ts`.
  2. `GameRoom.ts`'s tick() movement-velocity loop no longer freezes `isSpirit` players —
     they receive joystick-driven velocity like a normal player. `isDown` and `isFrozen`
     freezing is unchanged.
  3. A spirit-form player never receives the Fate-bond speed buff, even while Fate-bonded
     to another player, even while moving.
  4. A spirit-form player's movement never triggers Proximity-bond buff eligibility (for
     themselves or their bonded partner) or resets/starts the Proximity-bond drain timer
     for their pair — i.e. `getProximityBuffedPlayers` and `getProximityDrainTargets`
     exclude any bond pair where either player is currently `isSpirit`.
  5. In a 2-player session, `allBondsAtBossStart` becomes `true` once the single achievable
     bond exists by boss start (instead of requiring 3, which is structurally impossible
     with only 2 players and 5.7's duplicate-pair guard in place). In a 3+ player session,
     behavior is unchanged (still requires 3 distinct bonds).
  6. Full monorepo typecheck and test suite pass with no regressions.

Required hooks:
  - Simulation-safety hook (GameRoom.ts and bonds.ts changes — typecheck, unit tests,
    deterministic tick test N/A since no PRNG-affecting logic changes, perf sanity check
    N/A since this changes existing per-tick branches, not adds new O(n²) work)

Required tests:
  - Task 1: `tests/unit/bonds.test.ts` — regression test per AC1 (bondKey stability across
    repeat `assignBond` calls for the same pair).
  - Task 2: `tests/unit/bonds.test.ts` — update `getProximityBuffedPlayers` and
    `getProximityDrainTargets` test suites for the new required spirit-exclusion parameter;
    add at least one test per function asserting a spirit player's presence in the pair
    excludes it from the result. No new test needed for the Fate-speed exclusion (it is a
    GameRoom.ts inline condition, not a pure function — cover it via the existing
    typecheck/test suite, since GameRoom.ts's tick loop has no dedicated unit test today).
  - Task 3: Add or extend a simulation-server unit test asserting `allBondsAtBossStart`
    becomes `true` for a 2-player session with 1 bond and `false` for a 2-player session
    with 0 bonds; assert unchanged behavior for 3-player sessions (still requires 3).
  - All tasks: run `npm run typecheck` (full monorepo) and the full Vitest suite — 0 errors,
    no regressions.

Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 3 deferred findings from the 5.7 code review resolved,
so that Epic 5's bond system correctly excludes incapacitated players from bond effects
without contradicting story 3.6's spirit-mobility intent, and the AllBondsActive
achievement is reachable regardless of session size, before E7+ builds further meta
systems on top of it.

---

## Acceptance Criteria

**AC1 — D-5.7-A verified closed, regression-locked:**
**Given** `assignBond` is called twice for the same 2-player pair
**When** a developer reads `enterBondMoment`'s `bondKey(playerA, playerB)` computation
**Then** the key is identical on both calls (the stored bond's own order is returned on the
duplicate-pair path, not a freshly-drawn order)
**And** a test in `tests/unit/bonds.test.ts` asserts this explicitly

**AC2 — isSpirit players regain joystick movement:**
**Given** a player whose `isSpirit === true`
**When** the movement loop runs in `GameRoom.ts tick()`
**Then** their physics body receives joystick-driven velocity exactly like a normal player
**And** `isDown` players remain fully frozen (unchanged from 5.7)

**AC3 — isSpirit excluded from Fate-bond speed buff:**
**Given** a spirit-form player who is Fate-bonded to another player
**When** the per-tick speed calculation runs for that player
**Then** they never receive the `BOND_SPEED_MULT` speed multiplier, regardless of their
Fate-bond partner's state

**AC4 — isSpirit excluded from Proximity-bond buff/drain eligibility:**
**Given** a spirit-form player whose bond-sensor fixture is in physical contact range with
their bonded partner
**When** `getProximityBuffedPlayers` or `getProximityDrainTargets` runs for that tick
**Then** the pair is excluded from both the returned buffed-players set and the drain
targets list — neither player in that pair receives the proximity damage buff or proximity
drain from that contact while either is `isSpirit`

**AC5 — AllBondsActive reachable in 2-player sessions:**
**Given** a 2-player dungeon run reaching boss level start with the single achievable bond
already assigned
**When** `loadLevel` computes `allBondsAtBossStart`
**Then** it evaluates `true`
**And** a 3-player (or larger) session's requirement is unchanged (still needs 3 distinct
bonds)

**AC6 — No other regressions:**
**Given** the fixes in Tasks 1-3
**When** the full monorepo typecheck and Vitest suite run
**Then** both pass with zero errors and zero regressions

---

## Dev Notes

### Context

Story 5.7 closed 5 deferred findings from Stories 5.1-5.6. Its own code review surfaced 3
new ones, logged in `deferred-work.md` under "Deferred from: code review of
5-7-epic-5-deferred-hardening (2026-07-07)":

**D-5.7-A — Bond sensor fixture leak on flipped player order (verify only, likely already fixed)**

The finding describes `enterBondMoment` looking up `this.bondSensorFixtures.get(key)` using
a key derived from `assignBond`'s returned pair order, and worried that a duplicate call
could return the pair in flipped order (since `selectBondPair`'s internal draw is
~50/50 each call), leaking the old fixture under the stale key.

**This premise no longer holds against the current code.** Read `bonds.ts`'s `assignBond`:
the duplicate-pair branch (added by 5.7's own code-review patch, to fix a *different* bug —
returning stale `bondType`/`bondColor`) returns
`{ playerA: existing.playerA, playerB: existing.playerB, bondType: existing.type,
bondColor: existing.color }` — i.e. the bond's **stored, immutable** order from when it was
first created, not a fresh `selectBondPair` draw. `enterBondMoment` derives its `key` from
this same returned value, so `bondKey(playerA, playerB)` is stable across every repeat call
for the same pair, regardless of what `selectBondPair` draws internally on that call. The
type/color patch and the order stability turned out to be the same fix.

Do not re-implement a canonical-sort-order key or touch `enterBondMoment`'s sensor block.
Confirm this reasoning yourself by reading the current `assignBond` function, then write the
regression test in Task 1 to lock in the invariant so a future refactor can't silently
reintroduce the original bug.

**D-5.7-B — isSpirit players made fully immobile (Product/Game Design decision: narrow the fix)**

5.7's AC2 added `|| player.isDown || player.isSpirit` to the movement-freeze guard, which
correctly stops downed players from drifting but also makes spirit-form players unable to
move at all — directly reversing story 3.6's shipped intent ("As a downed player in spirit
form, I want to keep moving and use my spirit ability to support my teammates, so that
entering spirit form feels like a reduced state, not elimination").

Asked directly (this is exactly the decision `deferred-work.md` flagged as needing
Product/Game Design input): **narrow the fix**. IsSpirit players regain movement; only the
specific bond-related side effects that motivated 5.7's over-broad freeze are excluded:
- Fate-bond speed buff (a spirit player should never speed up from a bond)
- Proximity-bond buff/drain eligibility (a spirit player's ghost body drifting near their
  bonded partner should not grant a damage buff or start draining the partner's HP)

`isDown` is untouched — a downed player is genuinely incapacitated (on the ground, waiting
for revive) and stays fully frozen exactly as 5.7 left it. Only `isSpirit` changes.

**D-5.7-C — AllBondsActive unreachable in 2-player sessions**

5.7's AC1 fix (duplicate-pair guard in `assignBond`) is the *correct* behavior — it stops
`activeBonds` from accumulating fake duplicate entries. But `allBondsAtBossStart`'s
computation (`GameRoom.ts loadLevel`, `=== BOSS_LEVEL_INDEX - 1` i.e. `=== 3`) assumed 3
distinct bonds always accumulate. In a 2-player session there is only ever 1 possible pair,
so `activeBonds.length` caps at 1 forever — `allBondsAtBossStart` can never be `true`, and
`AllBondsActive` is permanently unreachable for 2-player sessions specifically *because*
5.7's fix is correct. The achievement's own read of the boolean
(`packages/game-rules/src/systems/achievements.ts:22-23`) needs no change — fix the
computation, not the consumer.

### Implementation

**Task 1 — Regression test locking in D-5.7-A's already-fixed invariant**

File: `tests/unit/bonds.test.ts`, in the existing `describe('assignBond', ...)` block
(alongside the existing "duplicate-pair call reports the EXISTING bond" test at line ~151).

```ts
it('bondKey is stable across repeat calls for the same pair (D-5.7-A regression)', () => {
  const rng = createRng(SEED);
  const state = makeState(2);
  const first = assignBond(state, rng);
  const second = assignBond(state, rng);
  expect(first.ok && second.ok).toBe(true);
  if (first.ok && second.ok) {
    expect(bondKey(first.value.playerA, first.value.playerB))
      .toBe(bondKey(second.value.playerA, second.value.playerB));
  }
});
```

This should pass with **zero production code changes** — if it fails, stop and re-read
`assignBond`'s duplicate branch; the story's premise (that D-5.7-A is already fixed) would
be wrong and Task 1 becomes a real fix (canonicalize the sensor-fixture lookup key to a
sorted pair order in `GameRoom.ts enterBondMoment` instead). Expected outcome: it passes as
written, confirming no further change is needed.

**Task 2a — Un-freeze isSpirit movement**

File: `apps/simulation-server/src/rooms/GameRoom.ts`, `tick()`'s movement-velocity loop
(~line 1015):

```ts
// Before
if (player.isFrozen || player.class === null || player.isDown || player.isSpirit) {
  body.setLinearVelocity(Vec2(0, 0));
  continue;
}

// After
if (player.isFrozen || player.class === null || player.isDown) {
  body.setLinearVelocity(Vec2(0, 0));
  continue;
}
```

**Task 2b — Exclude isSpirit from Fate-bond speed buff**

Same loop, a few lines later (~line 1025):

```ts
// Before
const speed = fateBuffed.has(player.id) ? SPEED * BOND_SPEED_MULT : SPEED;

// After
const speed = (fateBuffed.has(player.id) && !player.isSpirit) ? SPEED * BOND_SPEED_MULT : SPEED;
```

**Task 2c — Exclude isSpirit pairs from Proximity buff/drain eligibility**

File: `packages/game-rules/src/systems/bonds.ts`. Add a required `spiritPlayerIds` parameter
to both functions, mirroring `getFateBondWipeTargets`'s existing player-state-filter
pattern (that function already takes player state and filters `isDown`/`isSpirit`/
`isFrozen` — reuse the same shape of idea, not a new abstraction):

```ts
export function getProximityBuffedPlayers(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
  spiritPlayerIds: ReadonlySet<string>,
): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (!inRangeKeys.has(bondKey(bond.playerA, bond.playerB))) continue;
    if (spiritPlayerIds.has(bond.playerA) || spiritPlayerIds.has(bond.playerB)) continue;
    buffed.add(bond.playerA);
    buffed.add(bond.playerB);
  }
  return buffed;
}
```

```ts
export function getProximityDrainTargets(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
  enterTimes: ReadonlyMap<string, number>,
  drainThresholdMs: number,
  nowMs: number,
  spiritPlayerIds: ReadonlySet<string>,
): ProximityDrainTarget[] {
  const result: ProximityDrainTarget[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (spiritPlayerIds.has(bond.playerA) || spiritPlayerIds.has(bond.playerB)) continue;
    const key = bondKey(bond.playerA, bond.playerB);
    const enterTime = enterTimes.get(key);
    if (enterTime === undefined) continue;
    if (nowMs - enterTime >= drainThresholdMs) {
      result.push({ playerA: bond.playerA, playerB: bond.playerB });
    }
  }
  return result;
}
```

Note the `spiritPlayerIds` check happens before the in-range/enter-time lookups in
`getProximityDrainTargets` — order doesn't affect correctness here, but keep it early so a
spirit pair short-circuits without touching `enterTimes` (matches the existing
early-continue style in this file).

In `GameRoom.ts`, build the set once per tick (near where `proximityBuffed`/`fateBuffed` are
already computed, ~line 990-996) and pass it to both call sites:

```ts
const spiritPlayerIds = new Set(
  this.gameState.players.filter(p => p.isSpirit).map(p => p.id),
);
const proximityBuffed = this.gameState.activeBonds.length > 0
  ? getProximityBuffedPlayers(this.gameState.activeBonds, this.bondsInRange, spiritPlayerIds)
  : new Set<string>();
```

And at the drain call site (~line 1555):

```ts
const drainTargets = getProximityDrainTargets(
  this.gameState.activeBonds,
  this.bondsInRange,
  this.bondEnterTime,
  BOND_DRAIN_THRESHOLD_S * 1000,
  nowDrain,
  spiritPlayerIds,
);
```

`spiritPlayerIds` is computed once at the top of `tick()` and reused at both call sites —
do not recompute it a second time near the drain block.

**Task 3 — Player-count-aware allBondsAtBossStart**

File: `apps/simulation-server/src/rooms/GameRoom.ts`, `loadLevel`'s boss branch (~line 920):

```ts
// Before
// ponytail: one bond assigned per dungeon level; BOSS_LEVEL_INDEX-1 = 3 expected bonds
this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === BOSS_LEVEL_INDEX - 1;

// After
// ponytail: one bond assigned per dungeon level (BOSS_LEVEL_INDEX-1 = 3 max), but a
// 2-player session only has 1 possible pair — expect min(3, achievable pairs), not a
// fixed 3, or AllBondsActive is permanently unreachable for 2-player sessions (D-5.7-C)
const playerCount = this.gameState.players.length;
const maxAchievableBonds = playerCount >= 2
  ? Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)
  : 0;
this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === maxAchievableBonds
  && maxAchievableBonds > 0;
```

The `(playerCount * (playerCount - 1)) / 2` term is the number of distinct unordered pairs
possible for `playerCount` players (2 players → 1 pair, 3 players → 3 pairs, 4+ players →
6+ pairs but capped at `BOSS_LEVEL_INDEX - 1` = 3 since only 3 bond-moments ever occur — one
per dungeon level). The `&& maxAchievableBonds > 0` guard keeps the 0-or-1-player edge case
(`playerCount < 2`) from evaluating `activeBonds.length === 0` as trivially true.

### Files to read before editing

- `packages/game-rules/src/systems/bonds.ts` — read the full file. Confirm `assignBond`'s
  current duplicate-pair branch (Task 1) and the exact current signatures of
  `getProximityBuffedPlayers`/`getProximityDrainTargets` (Task 2c) before editing — line
  numbers may have shifted.
- `apps/simulation-server/src/rooms/GameRoom.ts` — read `tick()` in full (~line 986-1030 for
  the movement/speed loop, ~line 1552-1585 for the drain block) and `loadLevel`'s boss
  branch (~line 916-921). Confirm current line numbers and that no other code path sets
  player body velocity (grep `setLinearVelocity` — 5.7's Dev Agent Record already confirmed
  only this one loop does; re-verify before assuming it still holds).
- `tests/unit/bonds.test.ts` — read the full `getProximityBuffedPlayers` and
  `getProximityDrainTargets` `describe` blocks; every existing test call site must be
  updated to pass a `spiritPlayerIds` argument (an empty `new Set()` for tests where no
  player is spirit-form).
- `_bmad-output/implementation-artifacts/deferred-work.md` — read the "Deferred from: code
  review of 5-7-epic-5-deferred-hardening (2026-07-07)" section (D-5.7-A, D-5.7-B, D-5.7-C)
  for the original finding text and the D-5.7-B resolution note.

### Known pitfalls

- Do not forget any existing `getProximityBuffedPlayers`/`getProximityDrainTargets` call
  site or test fixture when adding the new required `spiritPlayerIds` parameter — making it
  optional (defaulting to empty) would silently defeat the guard for any caller that omits
  it, the same mistake 5.7's code review caught and fixed for `getFateBondWipeTargets`'s
  `isFrozen` field. Keep it required.
- Task 2a's freeze-guard change affects all movement — after implementing, grep
  `setLinearVelocity` in `GameRoom.ts` to confirm the movement loop is still the only
  velocity-setting site, and that removing `isSpirit` from its guard doesn't accidentally
  affect any other `continue`-gated logic later in the same loop iteration (checked in 5.7:
  the loop body only sets velocity before this `continue`, nothing else is skipped).
- Task 2c: the `spiritPlayerIds` Set must be built from `this.gameState.players` (current
  tick's live state), not from a stale snapshot — build it fresh each `tick()` call, same
  lifetime as `proximityBuffed`/`fateBuffed`.
- Task 3: `maxAchievableBonds` must use `this.gameState.players.length` (the actual number
  of players in the session), not `session.playerCount` or `session.maxPlayers` — confirm
  which field is authoritative by checking how `activeBonds`/`assignBond` already determine
  player count (`state.players.length` in `bonds.ts`'s own `assignBond` guard).
- Do not widen Task 3's fix to also handle 1-player or 0-player sessions "for completeness"
  — dungeon runs require a minimum of 2 players per existing `assignBond` behavior
  (`NOT_ENOUGH_PLAYERS` error below that), so `playerCount < 2` inside a boss-level
  `loadLevel` call should not occur in practice; the `maxAchievableBonds > 0` guard exists
  only to keep the boolean logic correct if it ever did, not to add new session-size
  validation.

### Project Structure Notes

- All three tasks touch existing files in their established locations — no new files, no
  new directories, no new shared-types.
- Task 2c extends two existing pure functions in `packages/game-rules` with an additional
  required parameter, following the exact pattern `getFateBondWipeTargets` already
  established in the same file (a `ReadonlySet`/array of player-state data used purely to
  filter results — no I/O, no Colyseus/planck imports, matches the "game-rules: pure
  functions only" rule in project-context.md).
- No `packages/shared-types/**` change — `spiritPlayerIds` is a runtime `Set<string>`
  computed per-tick in `GameRoom.ts`, not a wire-protocol field.

### Project Context Rules

- **Ownership**: all three tasks touch only `apps/simulation-server/**` and
  `packages/game-rules/**`, both owned by Simulation Engineer — single context, no split
  needed (unlike 5.7, which also touched mobile-controller).
- **Contract-change hook**: not triggered — no `packages/shared-types/**` or
  `packages/net-protocol/**` changes, no session lifecycle/reconnect/join-flow changes.
- **Result<T, E> rule**: not applicable — none of the three tasks add a function that can
  fail; `getProximityBuffedPlayers`/`getProximityDrainTargets` already return plain
  collections (their existing convention, unchanged by this story).
- **Tick loop hygiene rule** (project-context.md, Performance Rules): the new
  `spiritPlayerIds` Set is built once per tick via `.filter().map()` over
  `this.gameState.players` — a small, bounded (`maxPlayers = 8`) heap allocation already
  consistent with how `proximityBuffed`/`fateBuffed` are computed in the same spot. Do not
  move this computation inside a nested per-enemy or per-bond loop.
- **planck.js rule**: not applicable — no `Vec2`/fixture changes in this story (Task 2a
  reads/writes existing velocity calls unchanged in style).

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 5-7-epic-5-deferred-hardening (2026-07-07)] — D-5.7-A, D-5.7-B, D-5.7-C original findings and the D-5.7-B resolution note
- [Source: _bmad-output/implementation-artifacts/5-7-epic-5-deferred-hardening.md] — prior story; established the isDown/isSpirit movement freeze (Task 2), the isFrozen-required-parameter precedent for `getFateBondWipeTargets` (Task 2c pattern), and the assignBond duplicate-pair fix (Task 1's premise)
- [Source: _bmad-output/implementation-artifacts/3-6-spirit-form-downed-player-contribution-and-run-failure.md] — original spirit-form mobility intent that D-5.7-B's narrowed fix restores
- [Source: packages/game-rules/src/systems/bonds.ts] — `assignBond`, `getFateBondWipeTargets` (parameter pattern to mirror), `getProximityBuffedPlayers`, `getProximityDrainTargets`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — `tick()` movement/speed loop, proximity-drain block, `loadLevel`'s boss branch
- [Source: _bmad-output/project-context.md#Code Organization Rules] — monorepo ownership boundaries; `packages/game-rules` pure-functions-only rule

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — Add regression test in `tests/unit/bonds.test.ts` asserting
  `bondKey` stability across repeat `assignBond` calls for the same pair. Confirm it passes
  with zero production changes; if it fails, escalate before implementing a fix (the
  story's premise would be wrong).
- [x] **Task 2a** (AC: #2) — Remove `|| player.isSpirit` from the movement-freeze guard in
  `GameRoom.ts tick()`.
- [x] **Task 2b** (AC: #3) — Add `&& !player.isSpirit` to the Fate-bond speed calc in the
  same loop.
- [x] **Task 2c** (AC: #4) — Add required `spiritPlayerIds: ReadonlySet<string>` parameter
  to `getProximityBuffedPlayers` and `getProximityDrainTargets` in `bonds.ts`; update both
  call sites in `GameRoom.ts tick()` to build and pass the set; update every existing test
  call site in `tests/unit/bonds.test.ts` for the new parameter; add at least one new test
  per function asserting spirit-pair exclusion.
- [x] **Task 3** (AC: #5) — Replace the fixed `=== BOSS_LEVEL_INDEX - 1` check with a
  player-count-aware `maxAchievableBonds` computation in `loadLevel`'s boss branch; add a
  simulation-server unit test covering 2-player (reachable) and 3-player (unchanged)
  sessions.
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [x] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions.
- [x] Manual/traced verification: grep `setLinearVelocity` in `GameRoom.ts` to confirm the
  movement loop is still the only player-velocity-setting site after Task 2a; grep every
  call site of `getProximityBuffedPlayers`/`getProximityDrainTargets` (production and test)
  to confirm none were missed for the new parameter.

### Review Findings

- [x] [Review][Patch] Spirit-form players could farm essence orbs once Task 2a un-froze their movement — no `isSpirit` guard existed on the essence-collection flush block [apps/simulation-server/src/rooms/GameRoom.ts:1097-1121]
- [x] [Review][Patch] `spiritPlayerIds` was built unconditionally every tick instead of being gated behind `activeBonds.length > 0` like its sibling sets [apps/simulation-server/src/rooms/GameRoom.ts:~995]
- [x] [Review][Patch] No test exercised a multi-bond list where only one pair is spirit-excluded, for either `getProximityBuffedPlayers` or `getProximityDrainTargets` [tests/unit/bonds.test.ts]
- [x] [Review][Patch] `allBondsAtBossStart` test coverage skipped the playerCount=4 cap boundary and the playerCount=0/1 short-circuit boundary [apps/simulation-server/tests/game-room-level-clear-guard.test.ts]
- [x] [Review][Defer] `allBondsAtBossStart`'s player-count-aware formula reads a live, mutable roster rather than the roster present when bonds were assigned — a mid-dungeon join/leave can desync it [apps/simulation-server/src/rooms/GameRoom.ts:916-921] — deferred, logged as D-5.8-A in deferred-work.md; cosmetic-achievement impact only, explicitly out of Task 3's Non-goals scope

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (gds-dev-story)

### Debug Log References

- `npm run typecheck` (full monorepo, 10 packages/apps): 0 errors.
- `npx vitest run` (full suite): PASS 380 / FAIL 0 / skipped 2.
- Post-review re-run — `npm run typecheck`: 0 errors. `npx vitest run`: PASS 374 / FAIL 0 /
  pending 12 (4 new tests added by review patches; the 12 pending are pre-existing e2e suites
  requiring live infra not running in this sandbox — `full-run.test.ts`, `reconnect.test.ts`,
  and one stray leftover-worktree test file, none touched by this story).

### Completion Notes List

- Task 1: Confirmed D-5.7-A's premise no longer holds — read `assignBond`'s duplicate-pair
  branch and verified it returns the stored bond's own order (`existing.playerA/playerB`),
  not a fresh `selectBondPair` draw. Added the regression test as specified; it passed with
  zero production changes, confirming the story's premise.
- Task 2a: Removed `|| player.isSpirit` from `GameRoom.ts tick()`'s movement-freeze guard.
  `isDown`/`isFrozen` freezing unchanged.
- Task 2b: Added `&& !player.isSpirit` to the Fate-bond speed calculation in the same loop.
- Task 2c: Added required `spiritPlayerIds: ReadonlySet<string>` parameter to
  `getProximityBuffedPlayers` and `getProximityDrainTargets` in `bonds.ts`. Built the set
  once per tick in `GameRoom.ts` (near `proximityBuffed`/`fateBuffed`) and passed it to both
  call sites (buff computation ~line 991, drain block ~line 1558). Updated every existing
  test call site in `tests/unit/bonds.test.ts` and added one spirit-exclusion test per
  function.
- Task 3: Replaced the fixed `=== BOSS_LEVEL_INDEX - 1` check in `loadLevel`'s boss branch
  with a player-count-aware `maxAchievableBonds` (`min(3, nC2)`) computation, guarded against
  the `playerCount < 2` edge case. Added a new describe block to the existing
  `game-room-level-clear-guard.test.ts` (mirrors its established "replicate the guard
  condition directly, GameRoom isn't instantiable outside a live room" pattern) covering
  2-player (reachable at 1 bond), 3-player (unchanged, needs 3), and 8-player (unchanged,
  capped at 3) cases.
- Verification: grepped `setLinearVelocity` in `GameRoom.ts` — 3 sites total, only the
  `tick()` movement loop (2 of the 3, one for the deadzone-zero case) sets velocity from
  input; the third is the pre-existing disconnect-freeze path (unrelated, unchanged). Grepped
  every call site of `getProximityBuffedPlayers`/`getProximityDrainTargets` across
  `apps/`, `packages/`, and `tests/` — all updated for the new parameter, none missed.
- No `packages/shared-types/**` or `packages/net-protocol/**` changes — Contract-change hook
  not triggered.

**Confidence: 92%** — all 3 tasks map directly to their ACs and prescribed diffs, every
required test was added, full monorepo typecheck and Vitest suite both pass with zero
regressions, and D-5.7-A's premise was independently re-verified by reading `assignBond`
rather than trusting the story's claim. The 8% residual is ordinary risk on Task 2's
behavioral change (isSpirit players regaining movement) — the story's Non-goals scope this
precisely and no dedicated `tick()` unit test exists to exercise the movement loop directly
(per the story's own Required Tests, covered instead by typecheck/full-suite regression
absence), so a live playtest is the only way to visually confirm spirit-form drift feels
right.

### Senior Developer Review (AI)

**Review date:** 2026-07-07
**Reviewer:** claude-sonnet-5 (gds-code-review, 3-layer parallel: Blind Hunter, Edge Case Hunter, Acceptance Auditor)
**Review scope:** diff manually scoped to story 5.8's 4 changed files/hunks only — the working tree's `GameRoom.ts` and `game-room-level-clear-guard.test.ts` also carry unrelated, already-in-progress changes from other stories, which were excluded from this review (same precedent 5.7's review established).

**Outcome: Changes Requested → Patched → Done.** Acceptance Auditor found zero violations across all 6 ACs and all Non-goals. Blind Hunter and Edge Case Hunter together raised 13 points; 1 was a real regression this diff introduced (High), 3 were minor test-coverage/efficiency gaps (Low), 1 was logged as deferred work, and 8 were dismissed as already explicitly scoped by the story's own Non-goals/Required-Tests/Dev-Notes or as literal restatements of the spec.

**Action Items (Patch — fixed):**
- [x] [High] Task 2a's un-freezing of `isSpirit` movement had an unaccounted side effect: the essence-collection flush block (`GameRoom.ts` ~line 1097) had no `isSpirit` guard, so a mobile ghost body could now actively walk into essence-drop sensors and farm essence for the rest of the run — a real exploit, not covered by the Product/Game Design decision (which only named Fate-speed buff and Proximity-bond eligibility as the narrow exclusions). Confirmed by direct code read (3.6 listed "essence collection by spirit-form players" as a Non-goal at the time, deferred rather than blocked, and relied on 5.7's full-freeze as an incidental guard that this story removes). Fixed: `if (!player || player.isSpirit) continue;` before crediting essence. [`apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Low] `spiritPlayerIds` was built unconditionally every tick; its siblings `proximityBuffed`/`fateBuffed` are gated behind `activeBonds.length > 0`. Gated it the same way. [`apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Low] No test exercised a multi-bond list where only one pair is spirit-excluded (the existing "handles multiple proximity bonds independently" pattern was never extended to the new parameter). Added one test per function. [`tests/unit/bonds.test.ts`]
- [x] [Low] `allBondsAtBossStart` test coverage skipped the playerCount=4 cap-vs-combinatorics boundary and the playerCount=0/1 short-circuit boundary. Added both. [`apps/simulation-server/tests/game-room-level-clear-guard.test.ts`]

**Deferred (real, but out of this story's approved scope; logged in `deferred-work.md`):**
- **D-5.8-A** — `allBondsAtBossStart`'s player-count-aware formula reads `this.gameState.players.length` live at boss-start, not the roster present when bonds were actually assigned. A mid-dungeon join (`onJoin` has no phase guard) or leave (`onLeave(CONSENTED)` removes the slot immediately) can desync `maxAchievableBonds` from `activeBonds`. Cosmetic-achievement impact only; explicitly out of Task 3's Non-goals ("do not add new session-size validation... a 2-vs-3+-player branch is sufficient").

**Dismissed (already scoped by the story itself, or literal restatements of spec):**
- "Combinatorics formula duplicated in `GameRoom.ts` and hand-copied into the test file, no shared source of truth": this is the established project pattern for `GameRoom`-internal logic (`GameRoom` isn't instantiable outside a live Colyseus room — see `game-room-host-join.test.ts` and the pre-existing `game-room-level-clear-guard.test.ts` block), not a new inconsistency.
- "Combinatorics belongs in `game-rules`, not `GameRoom.ts`": Non-goals explicitly forbid extracting a general "N choose 2" helper; Task 3's Allowed paths don't include adding new `game-rules` exports for this.
- "No test/coverage for Hunks C/D/E (movement freeze, Fate-speed exclusion) at the `tick()` level": explicitly scoped in the story's own Required Tests ("no dedicated `tick()` unit test today... cover it via the existing typecheck/test suite").
- "Inconsistent check-order between `getProximityBuffedPlayers` and `getProximityDrainTargets`": the story's own Dev Notes explicitly prescribe checking `spiritPlayerIds` before the in-range lookup in the drain function specifically ("keep it early... matches the existing early-continue style").
- "Solo/1-player session makes `allBondsAtBossStart` permanently false": explicit Non-goal ("do not widen Task 3's fix to also handle 1-player or 0-player sessions for completeness").
- "Unmotivated design choice — excluding a pair if *either* player is spirit, including the living partner": this is AC4's literal text ("the pair is excluded... while either is `isSpirit`"), not an unstated assumption.
- "Test file naming — `game-room-level-clear-guard.test.ts` now holds two unrelated concerns under a misleading name": the story's own Allowed paths explicitly direct reusing a suitable existing file rather than creating a new one for one assertion.
- "Self-declared review scope-cutting critique": a comment on the review's own curation methodology, not a code defect.

### File List

- `packages/game-rules/src/systems/bonds.ts` — modified (Task 2c: added `spiritPlayerIds`
  parameter to `getProximityBuffedPlayers` and `getProximityDrainTargets`)
- `apps/simulation-server/src/rooms/GameRoom.ts` — modified (Task 2a: un-froze `isSpirit`
  movement; Task 2b: excluded `isSpirit` from Fate-bond speed buff; Task 2c: build/pass
  `spiritPlayerIds` at both call sites, gated behind `activeBonds.length > 0` (review patch);
  Task 3: player-count-aware `allBondsAtBossStart`; review patch: `isSpirit` guard on the
  essence-collection flush block)
- `tests/unit/bonds.test.ts` — modified (Task 1: bondKey-stability regression test; Task 2c:
  updated all existing call sites for the new parameter, added 2 spirit-exclusion tests plus
  2 more multi-bond spirit-exclusion tests from the review)
- `apps/simulation-server/tests/game-room-level-clear-guard.test.ts` — modified (Task 3: new
  describe block for `allBondsAtBossStart`'s player-count-aware computation, plus 2 boundary
  tests — playerCount=4 cap, playerCount=0/1 — from the review)
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended 1 new deferred item
  (D-5.8-A) from code review

### Change Log

| Date | Change |
|------|--------|
| 2026-07-07 | Story implemented: D-5.7-A verified closed + regression-locked (Task 1); isSpirit movement un-frozen per Product/Game Design decision, with Fate-speed and Proximity buff/drain eligibility narrowed to exclude isSpirit (Task 2); allBondsAtBossStart made player-count-aware so AllBondsActive is reachable in 2-player sessions (Task 3). Full monorepo typecheck and Vitest suite pass with zero regressions. |
| 2026-07-07 | Code review (3-layer): fixed 1 High finding (spirit players could farm essence orbs once movement was un-frozen — added `isSpirit` guard) and 3 Low findings (unconditional per-tick `spiritPlayerIds` allocation, missing multi-bond spirit-exclusion tests, missing `allBondsAtBossStart` boundary tests). Deferred 1 item (D-5.8-A — live roster count vs. bond-assignment-time roster). Zero Acceptance Auditor violations. Full monorepo typecheck and Vitest suite re-confirmed green. |

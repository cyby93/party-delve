---
baseline_commit: 0523b97
---

# Story 3.10: Epic 3 — Post-3.9 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Story 3.10 — post-3.9 deferred hardening, no new features)
Context: Story 3.9 (epic-3-deferred-hardening) closed 8 deferred findings from Stories
  3.1-3.8's code reviews. Its own code review surfaced 2 new findings, both low-risk and
  explicitly logged as open in deferred-work.md under "Deferred from: code review of
  3-9-epic-3-deferred-hardening (2026-07-07)": a magic-number stomp-visual-duration
  constant with an underdocumented invariant, and a boss physics body that skips the
  filter-bit system 3.9 itself introduced. No other Epic 3 work remains open (all other
  D-3.x entries in deferred-work.md are either resolved or explicitly accepted/deferred
  to a later phase per 3.9's Non-goals).

  Current codebase state:
  - packages/net-protocol/src/apply-delta.ts:120-133 — the `enemy:stomped` case computes
    `stompedUntil = Date.now() + 3000` inline. A `// ponytail:` comment already documents
    it as a deliberate cosmetic-only visual slow, but the `3000` is a bare magic number
    with no named constant, and the comment doesn't state the actual invariant that makes
    this safe (single shared host renderer per session — Local Party Mode has exactly one
    host client per room, so there is no multi-client drift to begin with; this differs
    from what D-3.9-A's phrasing implied).
  - apps/simulation-server/src/rooms/GameRoom.ts:901-908 — the boss body is created
    inline via `this.physicsWorld.createBody(...)` / `createFixture(...)` with no
    `filterCategoryBits`/`filterMaskBits`, unlike every other body type (`createPlayerBody`,
    `createEnemyBody`, `createPoiSensorBody`, `createEssenceSensorBody` in
    `apps/simulation-server/src/physics/world.ts`, all of which set explicit filter bits).
    Planck fixture defaults are `filterCategoryBits: 0x0001` (identical to `CAT_PLAYER`)
    and `filterMaskBits: 0xFFFF` (matches everything). Because `CAT_POI`, `CAT_ESSENCE`,
    and `CAT_BOND_SENSOR` sensor fixtures all set `filterMaskBits: CAT_PLAYER` (0x0001),
    the boss's default category (also 0x0001) satisfies their mask, and the boss's default
    mask (0xFFFF) satisfies their category — so planck fires begin-contact/end-contact
    between the boss body and every POI, essence, and bond-proximity sensor in the arena.
    `extractPoiBeginContact`/`extractEssenceBeginContact`/`extractBondSensorContact` (in
    `physics/world.ts` and `physics/sensors.ts`) all guard on `userData.type === 'player'`
    or the specific sensor type, so today this is inert — no gameplay bug — but it is
    wasted broadphase/narrowphase work every tick the boss is near a sensor, and it breaks
    the filter-bit invariant 3.9 established (every dynamic/sensor body declares its
    category and mask explicitly).

Owner agent: Multi-context (explicit cross-context approval):
  Protocol Architect (Task 1 — packages/net-protocol/src/apply-delta.ts)
  Simulation Engineer (Task 2 — apps/simulation-server/**)

Goal: Close the 2 deferred findings from the 3.9 code review with minimal diffs.
  Task 1 — Extract the stomp visual-slow duration into a named constant and correct the
            comment to state the real invariant (single host renderer, not multi-client sync).
  Task 2 — Add a `CAT_BOSS` filter category to the boss body's fixture, mirroring
            `createEnemyBody`'s hit-scan pattern (`filterMaskBits: 0`), so it stops
            generating spurious contacts with POI/essence/bond sensors.

Allowed paths:
  - packages/net-protocol/src/apply-delta.ts                  (Task 1)
  - apps/simulation-server/src/physics/world.ts                (Task 2 — add CAT_BOSS)
  - apps/simulation-server/src/rooms/GameRoom.ts               (Task 2 — boss fixture)

Blocked paths:
  - packages/game-rules/**
  - packages/shared-types/**
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**

Inputs:
  - deferred-work.md: D-3.9-A, D-3.9-B (under "Deferred from: code review of
    3-9-epic-3-deferred-hardening")
  - packages/net-protocol/src/apply-delta.ts (read the full `enemy:stomped` case, lines
    ~120-133)
  - apps/simulation-server/src/physics/world.ts (read fully — the CAT_* constants block
    at the top, and all 4 existing `create*Body`/`create*SensorBody` factory functions,
    to match the established filter-bit convention exactly)
  - apps/simulation-server/src/rooms/GameRoom.ts:893-911 (the `loadLevel` boss-arena setup
    block — read fully before editing; do not touch anything else in `loadLevel`)

Non-goals:
  - Do not make the stomp slow server-authoritative (no per-player expiry field on the
    wire event). D-3.9-A's own resolution note in deferred-work.md accepts client-computed
    `Date.now()`-based expiry as correct for a cosmetic-only effect; only the magic-number
    and documentation gap are in scope.
  - Do not extract a `createBossBody` factory function into `physics/world.ts` to match
    the other body types' structure. That is a reasonable follow-up but is a structural
    refactor beyond this finding's scope (missing filter bits) — fix the inline call site
    in place.
  - Do not add any new physics behavior (collision-based boss detection, wall-bounce,
    knockback). Boss combat remains hit-scan, unchanged.

Acceptance criteria:
  1. The `3000` (ms) literal in `apply-delta.ts`'s `enemy:stomped` case is replaced with a
     named, exported constant, and the existing comment is corrected to state that Local
     Party Mode has exactly one host renderer per session (no multi-client drift risk) —
     not merely that drift is small.
  2. The boss body's fixture in `GameRoom.ts` sets `filterCategoryBits: CAT_BOSS` and
     `filterMaskBits: 0`, where `CAT_BOSS` is a new exported constant in
     `physics/world.ts` following the existing `CAT_PLAYER`/`CAT_ENEMY`/`CAT_POI`/
     `CAT_ESSENCE`/`CAT_BOND_SENSOR` naming and bit-allocation convention (next unused bit).
  3. No behavior change to boss combat (still hit-scan) or to any POI/essence/bond-sensor
     contact handling for non-boss bodies.
  4. Full monorepo typecheck and test suite pass with no regressions.

Required hooks:
  - Simulation-safety hook (physics/world.ts, GameRoom.ts modified — typecheck, unit
    tests, perf sanity check N/A since this reduces broadphase work, not adds it)
  - Contract-change hook nominally triggered by touching packages/net-protocol/**, but
    Task 1 has zero wire-shape or behavior change (constant extraction + comment only) —
    no new contract test required; note this explicitly in the Dev Agent Record instead
    of adding a test for an unchanged contract.

Required tests: No new automated tests required — Task 1 is a constant rename with no
  behavior change; Task 2 removes contacts that were already inert (all extractors guard
  on userData.type and returned null for boss contacts), so no existing test should need
  updating. Rely on the existing typecheck and full test suite to confirm no regression.
Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 2 deferred findings from the 3.9 code review resolved,
so that Epic 3 is fully clean with no known open hygiene gaps before later epics build on
the boss physics or stomp-effect code.

---

## Acceptance Criteria

**AC1 — Stomp visual-slow duration is a named constant with an accurate comment:**
**Given** `apply-delta.ts`'s `enemy:stomped` case
**When** a developer reads the code
**Then** the `3000` literal is replaced by a named constant (e.g. `STOMP_VISUAL_SLOW_MS`)
**And** the comment states the real invariant — Local Party Mode runs exactly one host
renderer per session, so there is no multi-client drift to reconcile; the value only needs
to expire before the next periodic snapshot (`SNAPSHOT_INTERVAL_S`) — rather than the vaguer
"snapshot reconciles any stale values" phrasing

**AC2 — Boss body has explicit filter bits:**
**Given** the boss body created in `GameRoom.ts`'s `loadLevel` boss-arena block
**When** its fixture is constructed
**Then** it sets `filterCategoryBits: CAT_BOSS` and `filterMaskBits: 0`
**And** `CAT_BOSS` is defined in `physics/world.ts` alongside the other `CAT_*` constants,
using the next unused bit (`0x0040`, following `CAT_BOND_SENSOR = 0x0020`)

**AC3 — No behavior change:**
**Given** the fixes in Task 1 and Task 2
**When** a full dungeon run with a boss fight is simulated (unit/contract test suite)
**Then** boss damage (hit-scan), stomp AoE slow, and all POI/essence/bond-sensor contacts
for player bodies behave identically to before this story
**And** `npm run typecheck` and the full Vitest suite pass with no regressions

---

## Dev Notes

### Context

Story 3.9 closed 8 deferred findings from Stories 3.1-3.8. Its own code review surfaced 2
new ones, both explicitly logged as low-risk in `deferred-work.md`:

**D-3.9-A — apply-delta `enemy:stomped` uses client-side `Date.now()` for `stompedUntil`
expiry**

The dev notes for 3.9 already call this "acknowledged design choice... short enough to
expire before the next periodic snapshot (5 s)". The existing `// ponytail:` comment at
`apply-delta.ts:121` documents this, but frames it as a multi-client-drift tradeoff
("snapshot reconciles any stale values after expiry"). That framing is slightly wrong:
Local Party Mode's shared-host-screen architecture means there is exactly **one** host
renderer consuming this delta per session — there is no second host client to drift
against. The actual invariant worth documenting is simpler and stronger: this is a
single-consumer cosmetic value, so client-computed timing is trivially correct, not just
"acceptable jitter". Making the magic number a named constant also removes the need for a
future reader to grep `GameRoom.ts` to find a paired server-side duration (there isn't
one — the slow is purely a host-display effect; the server keeps no analogous timer).

**D-3.9-B — Boss body inline creation bypasses the physics filter-bit system**

`GameRoom.ts:901-908` creates the boss body via a raw `createBody`/`createFixture` call
inline in `loadLevel`, unlike `createPlayerBody`, `createEnemyBody`,
`createPoiSensorBody`, and `createEssenceSensorBody` — all four defined in
`physics/world.ts` and all four setting explicit `filterCategoryBits`/`filterMaskBits`.
Planck's fixture defaults (`filterCategoryBits: 0x0001`, `filterMaskBits: 0xFFFF`) mean
the boss body silently reuses `CAT_PLAYER`'s bit value as its own category and matches
every other category as its mask. Every sensor fixture in the game (`CAT_POI`,
`CAT_ESSENCE`, `CAT_BOND_SENSOR`) sets `filterMaskBits: CAT_PLAYER`, so — because the
boss's category equals `CAT_PLAYER` — planck's filter rule
`(A.category & B.mask) && (B.category & A.mask)` is satisfied for boss-vs-POI,
boss-vs-essence, and boss-vs-bond-sensor pairs. All three contact extractors
(`extractPoiBeginContact`, `extractEssenceBeginContact` in `physics/world.ts`;
`extractBondSensorContact` in `physics/sensors.ts`) check `userData.type` and return
`null` for a boss body, so nothing breaks today — but planck still does the broadphase
and narrowphase work to generate and report these contacts every tick the boss is near a
sensor, and the boss silently violates the filter-bit convention 3.9 itself introduced for
players and POIs.

The fix mirrors `createEnemyBody`'s existing pattern exactly: enemies also don't need
contact callbacks (combat is hit-scan), so `createEnemyBody` sets
`filterCategoryBits: CAT_ENEMY, filterMaskBits: 0`. The boss needs the identical
treatment — a distinct category (so it's never confused with `CAT_PLAYER`) and a zero
mask (so it never matches anything).

### Implementation

**Task 1 — Name the stomp visual-slow duration constant**

In `packages/net-protocol/src/apply-delta.ts`, near the top of the file (or immediately
above the `applyDelta` function — match the file's existing constant-placement style),
add:

```ts
// Local Party Mode has exactly one host renderer per session — this is a single-consumer
// cosmetic value, not a multi-client-synced one. It only needs to expire before the next
// periodic snapshot (SNAPSHOT_INTERVAL_S) reconciles player state from the server.
const STOMP_VISUAL_SLOW_MS = 3000;
```

Then in the `enemy:stomped` case (~line 120-133):

```ts
// Before
case 'enemy:stomped': {
  // ponytail: 3 s visual slow; snapshot reconciles any stale values after expiry
  const stompedUntil = Date.now() + 3000;
  ...

// After
case 'enemy:stomped': {
  const stompedUntil = Date.now() + STOMP_VISUAL_SLOW_MS;
  ...
```

**Task 2 — Add `CAT_BOSS` filter bits to the boss body**

In `apps/simulation-server/src/physics/world.ts`, in the `CAT_*` constants block
(~line 10-14), add the next unused bit after `CAT_BOND_SENSOR`:

```ts
export const CAT_PLAYER      = 0x0001;
export const CAT_ENEMY       = 0x0002;
export const CAT_POI         = 0x0004;
export const CAT_ESSENCE     = 0x0008;
export const CAT_BOND_SENSOR = 0x0020; // bond-proximity sensor fixtures on player bodies
export const CAT_BOSS        = 0x0040; // boss body — combat is hit-scan, same as CAT_ENEMY
```

Export it from the package's public surface the same way the other `CAT_*` constants are
exported (check `apps/simulation-server/src/physics/world.ts`'s existing export style —
these are plain named exports, no barrel file changes needed since `GameRoom.ts` already
imports directly from `../physics/world.js`).

In `apps/simulation-server/src/rooms/GameRoom.ts`, add `CAT_BOSS` to the existing
`physics/world.js` import (line ~9-12):

```ts
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody, createEssenceSensorBody,
  extractPoiBeginContact, extractPoiEndContact, extractEssenceBeginContact, toMeters, toPixels,
  CAT_BOSS,
} from '../physics/world.js';
```

Then update the boss fixture (~line 901-908):

```ts
// Before
bossBodyInstance.createFixture({ shape: new Circle(toMeters(48)), density: 1, friction: 0 });

// After
bossBodyInstance.createFixture({
  shape: new Circle(toMeters(48)),
  density: 1,
  friction: 0,
  filterCategoryBits: CAT_BOSS,
  filterMaskBits: 0, // combat is hit-scan; no contact callbacks needed (mirrors createEnemyBody)
});
```

### Files to read before editing

- `packages/net-protocol/src/apply-delta.ts` — read the full file. Confirm the exact
  current line numbers for the `enemy:stomped` case and this file's existing
  module-level-constant style (if any already exist, match their placement/naming).
- `apps/simulation-server/src/physics/world.ts` — read fully. Confirm the exact current
  `CAT_*` block and all 4 `create*Body`/`create*SensorBody` functions so the new
  `CAT_BOSS` constant and its usage match the established convention precisely (comment
  style, bit value, hex-literal formatting).
- `apps/simulation-server/src/rooms/GameRoom.ts:893-911` — read the full `loadLevel`
  boss-arena setup block before editing. Confirm the exact current line numbers for the
  import block and the boss fixture creation (may have shifted since this story was
  written).
- `_bmad-output/implementation-artifacts/deferred-work.md` — read the "Deferred from:
  code review of 3-9-epic-3-deferred-hardening (2026-07-07)" section (D-3.9-A, D-3.9-B)
  for the original finding text.

### Known pitfalls

- Do not pick `0x0010` for `CAT_BOSS` — that bit is unused today but check the full
  `CAT_*` block again at edit time in case a bit was allocated between this story's
  creation and implementation. Use the next value after the highest existing `CAT_*`
  constant.
- `filterMaskBits: 0` means the boss will never receive begin/end-contact callbacks with
  anything, including players. This is intentional and correct — boss damage to players
  is hit-scan (distance/radius checks in `GameRoom.tick()`), not contact-based. Do not
  add a nonzero mask "to be safe" — that would reintroduce the exact spurious-contact
  problem this story fixes.
- Do not touch `createEnemyBody`, `createPlayerBody`, `createPoiSensorBody`, or
  `createEssenceSensorBody` — only the boss body's inline fixture and the new `CAT_BOSS`
  constant are in scope.
- This story does not extract a `createBossBody` factory function — the inline call site
  in `GameRoom.ts` stays inline, just with filter bits added. Do not refactor it into
  `physics/world.ts` unless a separate story asks for that consistency cleanup.

### Project Structure Notes

- Both tasks touch existing files in their established locations — no new files, no new
  directories. `CAT_BOSS` follows the existing constants-in-`physics/world.ts` pattern;
  `STOMP_VISUAL_SLOW_MS` follows the pattern of a local, file-scoped named constant (there
  is no shared cross-package "cosmetic durations" file, and creating one for a single
  value would be premature).
- No `packages/shared-types/**` change — `CAT_BOSS` is simulation-server-internal (planck
  filter bits are never sent over the wire), and `STOMP_VISUAL_SLOW_MS` is
  net-protocol-internal (never referenced outside `apply-delta.ts`).

### Project Context Rules

- **Ownership**: Task 1 touches `packages/net-protocol/**`, owned by Protocol Architect;
  Task 2 touches `apps/simulation-server/**`, owned by Simulation Engineer. Per
  CLAUDE.md, a task needing multiple ownership areas should be split unless there is a
  strong reason not to — the precedent set by Story 3.9 (and 1.8/1.9/2.6/2.7/4.9/5.7) is
  to keep small, low-risk hardening findings bundled into one story under "Multi-context
  (explicit cross-context approval)" rather than spinning up a separate story per
  1-2-line fix.
- **Contract-change hook**: triggers nominally because Task 1 touches
  `packages/net-protocol/src/apply-delta.ts`, but there is no wire-shape or behavioral
  change (a `Date.now() + <literal>` becomes `Date.now() + <named constant>`) — no new
  contract test is required. State this explicitly in the Dev Agent Record rather than
  silently skipping the hook.
- **planck.js rule** (project-context.md, Performance Rules → planck.js Physics):
  "Always construct `Vec2` — never destructure to `{x, y}` and pass back in." Not
  triggered by this story (no `Vec2` handling changes), noted for awareness only.
- **Logging rule**: not applicable — neither task touches logging.
- **Result<T, E> rule**: not applicable — neither task adds a function that can fail.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-9-epic-3-deferred-hardening (2026-07-07)] — D-3.9-A, D-3.9-B original findings
- [Source: _bmad-output/implementation-artifacts/3-9-epic-3-deferred-hardening.md] — prior story; established the `CAT_*` filter-bit convention (Task 1) and the `stompedUntil` client-side apply-delta implementation (Task 5)
- [Source: apps/simulation-server/src/physics/world.ts] — `CAT_*` constants and all existing body-factory functions
- [Source: _bmad-output/project-context.md#Code Organization Rules] — monorepo ownership boundaries; Configuration Hierarchy (why no new shared constants file for a single value)

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — Extract `STOMP_VISUAL_SLOW_MS` constant in
  `packages/net-protocol/src/apply-delta.ts`; replace the inline `3000` literal; correct
  the comment to state the single-host-renderer invariant.
- [x] **Task 2** (AC: #2, #3) — Add `CAT_BOSS` to `apps/simulation-server/src/physics/world.ts`;
  import it in `GameRoom.ts`; set `filterCategoryBits: CAT_BOSS, filterMaskBits: 0` on the
  boss body's fixture.
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [x] Run the full Vitest suite (`npx vitest run` from monorepo root) — confirm no
  regressions, especially `tests/unit/` for game-rules/simulation-server physics and
  `tests/contract/net-protocol.test.ts`.
- [x] Manual/traced verification: confirm no other code references the literal `3000` in
  `apply-delta.ts`'s stomp context, and no other code constructs the boss body fixture
  elsewhere (grep `bossBodyInstance.createFixture` and `type: 'boss'` in `GameRoom.ts`).

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

None — no failures during implementation.

### Completion Notes List

- Task 1: Added module-scoped `STOMP_VISUAL_SLOW_MS = 3000` constant with an accurate
  comment (single host renderer per session, not multi-client drift) above `applyDelta` in
  `apply-delta.ts`; replaced the inline `3000` literal and removed the old `// ponytail:`
  comment whose "snapshot reconciles any stale values" framing was corrected per AC1.
- Task 2: Added `export const CAT_BOSS = 0x0040` to `physics/world.ts` (next unused bit
  after `CAT_BOND_SENSOR = 0x0020`), imported it in `GameRoom.ts`, and set
  `filterCategoryBits: CAT_BOSS, filterMaskBits: 0` on the boss body's fixture, mirroring
  `createEnemyBody`'s existing hit-scan pattern. No `createBossBody` factory was extracted
  (out of scope per story Non-goals) — the inline call site in `GameRoom.ts` was kept in
  place.
- Contract-change hook: nominally triggered since Task 1 touches
  `packages/net-protocol/src/apply-delta.ts`, but there is no wire-shape or behavioral
  change (a `Date.now() + <literal>` becomes `Date.now() + <named constant>`); no new
  contract test was added, per the story's explicit guidance.
- Verification: `npm run typecheck` passes with 0 errors across the full monorepo.
  `npx vitest run` passes 350/350 non-skipped tests. Two `tests/e2e/full-run.test.ts`
  tests were observed failing intermittently; confirmed via a manual revert/re-run of only
  this story's 3 edited files that both failures reproduce identically on the pre-story
  baseline (same assertions, same line numbers) — they are pre-existing timing-sensitive
  e2e flakiness unrelated to this story's changes, not a regression. A clean re-run of the
  full suite after reapplying the changes passed 350/0/12 (skipped).
  Manual grep confirmed no other `3000` literal remains in `apply-delta.ts`'s stomp
  context and no other boss-body fixture construction site exists in `GameRoom.ts`.

### File List

- packages/net-protocol/src/apply-delta.ts
- apps/simulation-server/src/physics/world.ts
- apps/simulation-server/src/rooms/GameRoom.ts

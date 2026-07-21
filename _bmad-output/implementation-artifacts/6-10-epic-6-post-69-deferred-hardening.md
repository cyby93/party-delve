---
baseline_commit: 3d22e41a41a9fae1f18e86c72cca8529ae173c96
---

# Story 6.10: Epic 6 — Post-6.9 Deferred Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.10 — post-6.9 deferred hardening, no new features)
Context: Story 6.9's dev implementation and code review (both 2026-07-17) each left findings
  open in deferred-work.md; nothing has swept epic 6's backlog since. This story re-verifies
  every open item against the current codebase and fixes the one that is both tractable and
  root-cause-worthy for a hardening story: D-6.9-B (the flaky 3-player bond-count assertion in
  `tests/e2e/full-run.test.ts`, caused by the pre-existing `selectBondPair` re-pair bug, D1,
  2026-07-03). Everything else re-verified as still-open is deliberately left deferred, with
  reasoning recorded below — this story does not attempt every open item, only the one that
  fits a tight hardening scope.

  Re-verified against current source (commit 3d22e41, 2026-07-20) before scoping:
  - **D-6.9-A** (projectile-vs-boss can never hit) — still fully present.
    `apps/simulation-server/src/rooms/GameRoom.ts:1054` still creates the boss fixture with
    `filterMaskBits: 0`; `pendingProjectileHitContacts` (populated only via
    `ProjectileEnemyContactEvent`, enemy-only) is the sole input to the projectile hit-resolution
    loop at line 1683. Confirmed this is genuinely physics-layer scope, not a quick fix: the
    boss's physics radius (`Circle(toMeters(48))`, GameRoom.ts:1050) and the projectile's radius
    (`Circle(toMeters(12))`, `apps/simulation-server/src/physics/world.ts:121`) are both local
    magic numbers with no exported constants — unlike the zone-tick/Storm-Eye boss checks 6.9
    added (which reused an already-public `zone.radius` field), a direct-position check here
    would require exporting new radius constants from `physics/world.ts` (a story-6.9-established
    Blocked path) or adding real contact-event wiring. Left deferred — see Non-goals.
  - **D-6.9-B** (bonds.ts re-pair bug, flaky e2e assertion) — still fully present. FIXED by this
    story. See Goal/Acceptance Criteria below.
  - **D-6.9-C** (boss can take 2 hits in 1 tick when the zone-tick and Storm-Eye-strike boss
    branches both fire) — still present (`STORM_EYE_STRIKE_INTERVAL_MS`=1500ms is still exactly
    3× `STORM_EYE_TICK_MS`=500ms, GameRoom.ts:1579). No new signal that this has caused an
    observed problem since 6.9 deferred it as "harmless duplicate broadcast." Left deferred
    again, unchanged reasoning — see Non-goals.
  - **D-6.9-D** (duplicated `isInHitZone(zone.x, zone.y, 0, 0, boss.position...)` boss-in-range
    check, zone-tick vs Storm-Eye-strike branches) — re-checked the "revisit at 3rd instance"
    condition directly: grepped all 9 `isInHitZone(` call sites in `GameRoom.ts` (lines 1125,
    1561, 1596, 2182, 2229, 2256, 2316, 2346, 2354). Only lines 1561 and 1596 share the exact
    zone/boss-range signature this finding describes — every other call site is a differently-
    shaped hit-scan-cone or Spirit-Nova-ring check with different arguments (directional cone,
    per-enemy loop, or a `hitIds`-tracked one-shot sweep). No 3rd occurrence of the specific
    duplicated snippet has appeared. Per this project's established "revisit at 3rd instance"
    convention (D-dev5-D precedent), **dropped from this story's scope** — do not extract a
    helper, do not carry it forward as a to-do; it can be re-surfaced from deferred-work.md
    itself if a 3rd instance ever appears.
  - **Mislabeled entry** (found under "Deferred from: code review of
    2-8-hub-ability-use-outside-training-dummy-poi", tagged "D-6.6-C" despite the section being
    for a different story) — re-verified the underlying claim against current source (it is
    NOT the same code the ID suggests; the ID is simply wrong for its section). Confirmed still
    real: `GameRoom.ts`'s `boss:defeated` handler (~line 1918-1946) sets
    `session.phase = 'post-run'` and sends `RUN_VICTORY`/reward broadcasts synchronously, but the
    final `run:complete` delta is delayed by a `setTimeout` of
    `PURIFICATION_PULSE_DURATION_MS + REWARD_REVEAL_DURATION_MS` (~5.5s, line 1941-1945). A
    mobile client that reconnects during that window (`apps/mobile-controller/src/session/
    mobile-session.ts`'s `reconnectToSession`, `App.tsx`'s `handleReconnect`) can show
    `ControllerScreen` for one render before the delayed `SNAPSHOT`/`gameState` update flips the
    phase-based render check (`App.tsx:276`) to `PostRunMobileScreen` — a real, still-open
    client-side render race. **Not folded into this story**: the fix surface is
    `apps/mobile-controller/**` (Mobile Controller Engineer ownership per CLAUDE.md), not
    Simulation Engineer/`packages/game-rules`. Folding a cross-owner UI fix into this
    single-owner hardening story would violate CLAUDE.md's Ownership Rule ("if a task needs
    multiple ownership areas, split it unless there is a strong reason not to") — no strong
    reason exists here. Left as a Non-goal with a recommendation for the Orchestrator to
    re-file it under epic 6 with a correct ID and route it to a Mobile Controller Engineer
    story when picked up.

Owner agent: Simulation Engineer
  Single-owner story — the only production change is confined to
  `packages/game-rules/src/systems/bonds.ts` (owned by Simulation Engineer per CLAUDE.md:
  `apps/simulation-server/**` and `packages/game-rules/**`). No protocol, host, or mobile changes.

Goal: Fix `selectBondPair`'s pre-existing re-pair bug (D1, 2026-07-03) so it can no longer
  select an already-bonded pair whenever an unbonded pair still exists among the roster — closing
  D-6.9-B's flaky `tests/e2e/full-run.test.ts` assertion at its root cause, not by patching the
  test.

Allowed paths:
  - packages/game-rules/src/systems/bonds.ts             (MODIFY — fix selectBondPair)
  - packages/game-rules/tests/unit/bonds.test.ts          (ADD — new unit test file)
  - _bmad-output/implementation-artifacts/deferred-work.md (MODIFY — mark D-6.9-B resolved,
      per this project's established "Resolution:" note-append convention)

Blocked paths:
  - apps/simulation-server/src/rooms/GameRoom.ts      (assignBond's only call site is unchanged;
      no GameRoom.ts edit needed — do not touch)
  - apps/simulation-server/src/physics/**             (D-6.9-A stays out of scope — see Context)
  - apps/host-client/**                               (no rendering changes needed)
  - apps/mobile-controller/**                         (mislabeled D-6.6-C stays out of scope —
      different ownership area, see Context)
  - packages/shared-types/**, packages/net-protocol/** (no protocol/type changes — `BondState`'s
      shape is unchanged, only which pair `selectBondPair` is allowed to return)

Inputs:
  - deferred-work.md entries: D-6.9-B (this story's fix), D1 (2026-07-03, the original root
    cause D-6.9-B points back to), D-6.9-A/C/D and the mislabeled epic-2-section entry
    (re-verified, left deferred — see Context)
  - packages/game-rules/src/systems/bonds.ts (selectBondPair, assignBond — read in full before
    editing)
  - tests/e2e/full-run.test.ts:240 (the flaky assertion this fix resolves — read for context,
    do not modify; no e2e changes needed once the root cause is fixed)
  - packages/game-rules/tests/unit/player-health.test.ts (existing `makePlayer(overrides)`
    factory pattern to mirror for this story's new player fixtures — do not import across
    files, duplicate the small factory locally per that file's own established precedent)

Non-goals:
  - D-6.9-A (projectile-vs-boss physics gap) — confirmed still genuinely physics-layer scope
    (see Context re-verification above); revisit only as its own dedicated story if Blood
    Spike/Void Pulse-vs-boss is ever reported as a gameplay gap.
  - D-6.9-C (boss double-hit-per-tick when zone-tick and Storm-Eye-strike coincide) — still
    harmless (idempotent `Math.max(0, hp - damage)`, worst case a duplicate VFX flash), still
    not observed causing a real problem. Revisit only if that changes.
  - D-6.9-D (duplicated boss-in-zone `isInHitZone` check) — re-checked, no 3rd instance has
    appeared (see Context). Dropped per this project's "revisit at 3rd instance" convention —
    do not extract a shared helper in this story.
  - The mislabeled epic-2-section entry (mobile reconnect-during-purification-window UX flash)
    — real, but `apps/mobile-controller/**` is a different ownership area. Do not touch mobile
    code in this story. Recommend the Orchestrator re-file the entry under epic 6 with a
    correct ID in a future deferred-work.md pass.
  - Do not change `assignBond`'s "skip duplicate bond assignment" fallback (bonds.ts:43-57) —
    it remains correct defensive behavior for the genuinely-saturated case (e.g. a 2-player
    session's 2nd bond-assignment attempt after its 1 achievable bond already exists); this
    story only prevents `selectBondPair` from feeding it an avoidable duplicate.
  - Do not change `selectBondType`, `bondKey`, or any of the per-tick bond-effect helpers
    (`getProximityBuffedPlayers`, `getFateBuffedPlayers`, `getFateBondWipeTargets`,
    `getProximityDrainTargets`) in the same file — untouched by this fix.
  - Any new gameplay features, protocol changes, or architecture changes.

Acceptance criteria:
  1. `selectBondPair` never returns a pair that is already bonded to each other as long as at
     least one valid (not-already-bonded) pair exists anywhere in the current roster —
     regardless of which player the RNG happens to pick first.
  2. When every possible pair in the roster is already bonded (fully saturated — e.g. a
     2-player session's 2nd+ bond-assignment attempt), `selectBondPair` still returns *some*
     valid pair of distinct player ids without throwing — `assignBond`'s existing duplicate
     dedup (bonds.ts:48-57) continues to handle that case exactly as it does today.
  3. `selectBondPair` still calls `rng()` exactly twice per invocation in every branch (same
     as today) — no change to the number or order of RNG draws, since `bondRng` is a seeded
     PRNG stream shared with deterministic-replay expectations elsewhere in the simulation.
  4. Behavior for the common case (any player never yet in a bond, i.e. `unbonded` is
     non-empty) is unchanged from current behavior — this fix only changes what happens when
     `unbonded` is empty but an unbonded *pair* still exists among already-once-bonded players.
  5. New unit test coverage in `packages/game-rules/tests/unit/bonds.test.ts` proves the exact
     D-6.9-B/D1 scenario (3 players, 2 of the 3 possible pairs already bonded) now
     deterministically returns the one remaining unbonded pair, across multiple different RNG
     draws that would have hit the old bug under the pre-fix implementation.
  6. `tests/e2e/full-run.test.ts`'s existing `activeBonds.length === 3` assertion (line 240) is
     not modified — it should now pass deterministically as a side effect of the root-cause
     fix, not because the test itself changed. (No requirement to run this specific e2e file
     dozens of times to "prove" it; the unit test in AC5 exercises the logic directly and
     deterministically. If run, treat pre-existing unrelated e2e environment failures per the
     6.9/dev-4 precedent as non-blocking.)
  7. Full monorepo typecheck and Vitest suite pass with no regressions.
  8. `deferred-work.md`'s D-6.9-B entry is annotated as resolved by this story (the established
     "Resolution:" note-append convention — see D-5.7-C, D-dev5-A, D-dev4-B for precedent), not
     deleted or rewritten.

Required hooks:
  - Simulation-safety hook (packages/game-rules/** modified — typecheck, unit tests;
    deterministic-tick/replay test: N/A in the sense that `selectBondPair` doesn't run inside
    the 30Hz tick loop, but AC3 exists specifically to preserve its RNG-draw-count contract
    with `bondRng`, which callers *do* rely on for determinism; perf sanity: N/A, `enterBondMoment`
    runs once per level-complete transition, not per tick — the new `hasAvailablePartner` filter
    is O(playerCount²) at absolute worst, trivial at the project's <=4-player scale).
Required tests: New unit tests in packages/game-rules/tests/unit/bonds.test.ts (AC1, 2, 3, 4, 5).
  No new e2e test required — the existing full-run.test.ts assertion (AC6) is the integration-
  level proof; a dedicated e2e repro isn't needed once the unit-level root cause is closed
  (matches 6.9's own precedent of not requiring a new e2e file for internal-logic hardening
  fixes).
Telemetry impact: None — no new event, no payload shape change. `bond:assigned` continues to
  broadcast identically; this fix only changes which pair is eligible to be selected before
  that broadcast is built.
```

## Story

As a developer,
I want `selectBondPair` to stop re-selecting an already-bonded pair whenever an unbonded pair still exists in the roster,
so that a 3-player session's 3rd bond moment reliably assigns the one remaining unbonded pair instead of intermittently re-picking an existing bond and silently failing to grow `activeBonds`.

## Acceptance Criteria

1. `selectBondPair` never returns an already-bonded pair while any valid (not-yet-bonded) pair exists in the roster, regardless of which player the RNG draws first.
2. When the roster is fully saturated (every possible pair already bonded), `selectBondPair` still returns some valid distinct-id pair without throwing — `assignBond`'s existing duplicate-dedup fallback (bonds.ts:48-57) continues to absorb that case unchanged.
3. `selectBondPair` calls `rng()` exactly twice per invocation in every branch, unchanged from today — preserves the RNG-draw-count contract with the seeded `bondRng` stream.
4. The common case (an unbonded player still exists) is behaviorally unchanged.
5. A new unit test in `packages/game-rules/tests/unit/bonds.test.ts` proves the exact D-6.9-B/D1 3-player scenario now deterministically resolves to the one remaining unbonded pair across varied RNG draws.
6. `tests/e2e/full-run.test.ts:240`'s `activeBonds.length === 3` assertion is left untouched and passes as a consequence of the root-cause fix.
7. Full monorepo typecheck and Vitest suite pass, no regressions.
8. `deferred-work.md`'s D-6.9-B entry gets a "Resolution:" note appended (not deleted/rewritten).

## Tasks / Subtasks

- [x] **Task 1** (AC: 1, 2, 3, 4) — Fix `selectBondPair` in `packages/game-rules/src/systems/bonds.ts` (currently lines 19-31):
  ```ts
  export function selectBondPair(players: PlayerState[], bonds: BondState[], rng: () => number): [string, string] {
    const bondedIds = new Set(bonds.flatMap(b => [b.playerA, b.playerB]));
    const unbonded = players.filter(p => !bondedIds.has(p.id));

    // A player is only a valid first pick if at least one OTHER player exists who
    // isn't already bonded to them — otherwise every possible partner draw for them
    // would just re-select an existing bond (D1, 2026-07-03 / D-6.9-B, 2026-07-17).
    const bondedPartnersOf = (playerId: string): Set<string> => {
      const ids = new Set<string>();
      for (const b of bonds) {
        if (b.playerA === playerId) ids.add(b.playerB);
        else if (b.playerB === playerId) ids.add(b.playerA);
      }
      return ids;
    };
    const hasAvailablePartner = (p: PlayerState): boolean => {
      const partners = bondedPartnersOf(p.id);
      return players.some(other => other.id !== p.id && !partners.has(other.id));
    };

    // Prefer unbonded players with an available partner (keeps the existing "spread
    // bonds to fresh players first" bias intact); fall back to anyone with an
    // available partner; fall back to the full roster only when every possible pair
    // is already bonded (pathological — a saturated small roster).
    const unbondedWithPartner = unbonded.filter(hasAvailablePartner);
    const anyWithPartner = players.filter(hasAvailablePartner);
    const poolA = unbondedWithPartner.length >= 1 ? unbondedWithPartner
      : anyWithPartner.length >= 1 ? anyWithPartner
      : players;
    const idxA = Math.floor(rng() * poolA.length);
    const chosen = poolA[idxA]!;

    const chosenPartners = bondedPartnersOf(chosen.id);
    const poolB = players.filter(p => p.id !== chosen.id && !chosenPartners.has(p.id));
    const finalPoolB = poolB.length > 0 ? poolB : players.filter(p => p.id !== chosen.id);
    const idxB = Math.floor(rng() * finalPoolB.length);
    return [chosen.id, finalPoolB[idxB]!.id];
  }
  ```
  > **Note (added at code review):** the shipped implementation diverges from the verbatim code
  > block above — this suggested `poolB` formula drops the "prefer unbonded second pick" bias,
  > which regresses the pre-existing `tests/unit/bonds.test.ts` "prioritizes unbonded players"
  > case. See the Dev Agent Record's Debug Log / Completion Notes below for the actual shipped
  > logic and why it differs.
  - [x] Confirm exactly 2 `rng()` calls remain in every branch (AC3) — one for `idxA`, one for `idxB`, matching the pre-fix call count.
  - [x] Do not touch `assignBond` (lines 33-65) or anything below it in the file — only `selectBondPair` changes.

- [x] **Task 2** (AC: 5) — Add `packages/game-rules/tests/unit/bonds.test.ts` (new file; no existing test file for this module):
  ```ts
  import { describe, it, expect } from 'vitest';
  import type { PlayerState, BondState } from 'shared-types';
  import { BondType } from 'shared-types';
  import { selectBondPair } from '../../src/systems/bonds.js';

  function makePlayer(id: string): PlayerState {
    return {
      id, displayName: id, class: null, x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sessionColor: 'red' as any, downCount: 0,
      nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
      channelingAbility: null,
    };
  }

  function makeBond(playerA: string, playerB: string): BondState {
    return { playerA, playerB, type: BondType.Proximity, color: '#fff' };
  }

  // Deterministic fake RNG: returns a fixed sequence of [0,1) fractions, one per call.
  function seqRng(values: number[]): () => number {
    let i = 0;
    return () => values[i++ % values.length]!;
  }

  describe('selectBondPair', () => {
    const A = makePlayer('A');
    const B = makePlayer('B');
    const C = makePlayer('C');
    const players = [A, B, C];

    it('D-6.9-B/D1 repro: with A-B and A-C already bonded, always returns B-C regardless of RNG draw', () => {
      const bonds = [makeBond('A', 'B'), makeBond('A', 'C')];
      // Sweep several distinct RNG draw pairs — all must resolve to B-C, never re-selecting
      // an existing A-B or A-C pair.
      for (const [fa, fb] of [[0, 0], [0.5, 0.5], [0.99, 0.99], [0.1, 0.9], [0.9, 0.1]]) {
        const [p1, p2] = selectBondPair(players, bonds, seqRng([fa, fb]));
        const pair = new Set([p1, p2]);
        expect(pair.has('A')).toBe(false);
        expect(pair.has('B')).toBe(true);
        expect(pair.has('C')).toBe(true);
      }
    });

    it('fully-saturated 2-player roster: returns the only pair without throwing (assignBond dedup handles it)', () => {
      const twoPlayers = [A, B];
      const bonds = [makeBond('A', 'B')];
      const [p1, p2] = selectBondPair(twoPlayers, bonds, seqRng([0.3, 0.7]));
      const pair = new Set([p1, p2]);
      expect(pair.has('A')).toBe(true);
      expect(pair.has('B')).toBe(true);
    });

    it('common case (no existing bonds) is unchanged: always returns 2 distinct valid ids', () => {
      const [p1, p2] = selectBondPair(players, [], seqRng([0.4, 0.6]));
      expect(p1).not.toBe(p2);
      expect(['A', 'B', 'C']).toContain(p1);
      expect(['A', 'B', 'C']).toContain(p2);
    });

    it('calls rng() exactly twice per invocation', () => {
      let calls = 0;
      const rng = () => { calls++; return 0.5; };
      selectBondPair(players, [makeBond('A', 'B'), makeBond('A', 'C')], rng);
      expect(calls).toBe(2);
    });
  });
  ```
  - [x] Run `npx vitest run packages/game-rules/tests/unit/bonds.test.ts` — confirm all 4 cases pass.

- [x] **Task 3** (AC: 7) — Run `npm run typecheck` (full monorepo) and `npx vitest run` (full suite) from repo root. Confirm 0 typecheck errors and no new test regressions (pre-existing e2e environment failures documented in 6.9's own Debug Log — `ability-dispatch.test.ts`, `hub-ability-use.test.ts` port-binding timeouts — are not this story's concern; `full-run.test.ts` should now pass its bond-count assertion deterministically rather than intermittently).

- [x] **Task 4** (AC: 8) — Append a "Resolution:" note to D-6.9-B's entry in `deferred-work.md` (section "Deferred from: dev implementation of 6-9-epic-6-post-66-deferred-hardening"), matching the exact style used for D-dev4-B/D-dev5-A's resolution notes. Do not touch D1's own original entry (2026-07-03 section) beyond what the existing project convention does for a referenced-but-not-owning finding — D-6.9-B is the entry this story resolves; D1 is its root-cause reference, already correctly cross-linked in D-6.9-B's own text.

### Review Findings

- [x] [Review][Patch] Story's embedded Task 1 code block is stale vs. the shipped implementation — a reader skimming the code block (not Completion Notes) would see the pre-fix-adjacent formula, not what actually shipped [`_bmad-output/implementation-artifacts/6-10-epic-6-post-69-deferred-hardening.md` Task 1 code block] — fixed: added an inline note pointing to the Dev Agent Record
- [x] [Review][Patch] `selectBondPair`'s pool-building has redundant/near-duplicate filter logic — `unbondedWithPartner` is provably identical to `unbonded` for every reachable (2+ player) input, and `preferredPoolB`/`poolB`/`finalPoolB` repeat near-identical `p.id !== chosen.id [&& !chosenPartners.has(p.id)]` predicates that could collapse into fewer pools [`packages/game-rules/src/systems/bonds.ts:43-62`] — fixed: removed the redundant `unbondedWithPartner` filter (proven identical to `unbonded`) and the dead `poolB` fallback tier (proven always equal to its own preferred pool)
- [x] [Review][Defer] `selectBondPair` assumes unique `PlayerState.id` values across the roster — a duplicate id can make the id-based filters crash (empty `finalPoolB`) or silently re-select an already-bonded pair [`packages/game-rules/src/systems/bonds.ts:43-62`] — deferred, pre-existing (no caller currently allows duplicate ids to reach this function; not introduced or worsened by this diff)
- [x] [Review][Defer] `selectBondPair` still throws via non-null assertion for 0 or 1 player rosters [`packages/game-rules/src/systems/bonds.ts:60-62`] — deferred, pre-existing (identical crash existed pre-fix; unreachable in production since `assignBond` guards `state.players.length < 2` before calling)

## Dev Notes

### Re-verification against current source (baseline commit 3d22e41, read before editing)

`packages/game-rules/src/systems/bonds.ts` (current lines 19-31), the buggy function:
```ts
export function selectBondPair(players: PlayerState[], bonds: BondState[], rng: () => number): [string, string] {
  const bondedIds = new Set(bonds.flatMap(b => [b.playerA, b.playerB]));
  const unbonded = players.filter(p => !bondedIds.has(p.id));

  const poolA = unbonded.length >= 1 ? unbonded : players;
  const idxA = Math.floor(rng() * poolA.length);
  const chosen = poolA[idxA]!;

  const poolB = (unbonded.length >= 2 ? unbonded : players).filter(p => p.id !== chosen.id);
  const idxB = Math.floor(rng() * poolB.length);
  return [chosen.id, poolB[idxB]!.id];
}
```
Confirmed exactly as D-6.9-B/D1 describe: once every player has appeared in at least one bond
(`unbonded` is empty, even though not every *pair* is bonded), `poolB` falls back to the full
`players` array filtered only by `id !== chosen.id` — it never excludes players already bonded
*to `chosen` specifically*. This can re-select an existing pair.

**Traced the exact 3-player failure mode** (why the old code fails ~1/3 of the time on the 3rd
bond moment, matching `full-run.test.ts`'s observed intermittent failure): with bonds A-B (moment
1) and A-C (moment 2) already assigned, at moment 3 `unbonded` is empty (all 3 ids appear in
`bondedIds`), so `poolA = players = [A, B, C]`. If `chosen = A` (bonded to both others already),
*every* possible `poolB` pick (`B` or `C`) re-selects an existing pair — `assignBond`'s dedup
fallback (bonds.ts:48-57) then returns the *existing* bond's info without pushing to
`activeBonds`, so `activeBonds.length` stays at 2 instead of reaching 3. Only when `chosen` is
`B` or `C` (and the 2nd draw picks the *other* of the two) does the correct new `B-C` bond get
created. Verified this reproduces exactly the "expected 2 to be 3" flake documented in 6.9's own
Debug Log and `deferred-work.md`'s D-6.9-B entry.

**Why the fix works:** filtering `poolA` down to players who still have *some* available
(not-yet-bonded-to-them) partner excludes `A` from being `chosen` in the scenario above — only
`B` and `C` qualify (each is missing a bond to the other). Whichever of `B`/`C` is drawn as
`chosen`, the corresponding `poolB` (filtered to exclude players already bonded to `chosen`)
deterministically contains only the other one. Verified by direct simulation across a dense grid
of RNG draw values before writing this story (not shipped as repo code — a scratch check only):
every combination resolves to `B-C`, never a duplicate, and the common no-existing-bonds and
fully-saturated-2-player paths are both unaffected by the change (identical output to the current
implementation).

### `assignBond`'s duplicate-dedup fallback stays as-is

`assignBond` (bonds.ts:33-65) already has a "skip duplicate bond assignment" branch (lines 43-57)
that returns the *existing* bond's data (not a fresh roll) when `selectBondPair` returns an
already-bonded pair — this is correct, intentional behavior for the genuinely-saturated case
(e.g., a 2-player session's repeated bond-moment attempts after its 1 achievable bond already
exists) and must not be removed. This story's fix reduces how *often* that fallback is needed
(it now only fires when the roster is truly fully saturated), it does not replace it — AC2
explicitly requires the saturated case to keep working via this exact existing fallback.

### Why not a full pair-graph rewrite

A "enumerate every unbonded pair and pick uniformly" rewrite would also fix the D-6.9-B scenario,
but it changes the existing weighting design (the current code's own comment: "Prefer unbonded
for first pick... to spread bonds to fresh players first") to a uniform-over-all-remaining-pairs
distribution instead. That's a bigger behavioral change than this hardening story's scope
justifies — the `hasAvailablePartner`-filtered `poolA`/`poolB` approach above preserves the
existing pick-weighting bias for every case except the one D-6.9-B actually describes, and is a
much smaller diff. Do not widen scope to a general combinatorics rewrite.

### RNG-call-count constraint (AC3) — why it matters

`selectBondPair` is called via `assignBond(this.gameState, this.bondRng)` from
`enterBondMoment` (`apps/simulation-server/src/rooms/GameRoom.ts:889`), where `this.bondRng` is a
seeded PRNG stream (`createRng(runSeed ^ OFFSET_SPIRIT_BOND)`, `GameRoom.ts:643`) — a separate
stream from the general per-tick `this.prng()`. Nothing in this fix should change how many times
`bondRng()` advances per call, since that would shift every subsequent `bondRng` draw for the
rest of the run relative to today's behavior (not itself dangerous — no replay/determinism test
currently locks in specific bond-selection outcomes by exact value — but changing the draw count
is an unnecessary, easily-avoided behavioral shift). The fix above preserves exactly 2 calls
(`idxA`, `idxB`) in every branch, same as before.

### Testing approach — new file, mirrors existing factory pattern

No test file exists yet for `bonds.ts`'s pure functions (confirmed via search). Mirror the
`makePlayer(overrides)` factory pattern already established in
`packages/game-rules/tests/unit/player-health.test.ts` (do not import it across files — that
file's own factory is local/unexported; duplicate the same minimal-fields pattern locally in the
new `bonds.test.ts`, consistent with how `player-health.test.ts` itself doesn't share it with
`achievements.test.ts` either).

### Project Structure Notes

- Single production file changed (`bonds.ts`), one new test file added — no new exports, no
  new dependencies, no change to `packages/game-rules/src/index.ts` (`selectBondPair` is already
  exported there).
- `BondState`/`PlayerState` shapes are unchanged — this is a pure logic fix inside an existing
  exported function's implementation, not a contract change.

### Project Context Rules

- **Ownership**: change confined to `packages/game-rules/**`, owned by Simulation Engineer —
  single ownership area, no cross-context approval needed.
- **Simulation-safety hook**: triggered (packages/game-rules/** modified) — typecheck + unit
  tests required (AC7); no deterministic-tick test applies (`selectBondPair` doesn't run in the
  30Hz tick loop), but AC3's RNG-draw-count preservation serves the same "don't quietly change
  simulation-affecting behavior" spirit.
- **Contract-change hook**: not triggered — no `shared-types`/`net-protocol` change, no session
  lifecycle/reconnect/room-state change.
- **Result<T, E> rule**: not applicable — `selectBondPair` has no failure mode (same as today);
  only `assignBond` (unchanged by this story) uses `Result`.
- **Testing Rules**: pure-function unit tests for `packages/game-rules` code live in
  `packages/game-rules/tests/unit/`, matching every existing file in that directory
  (`achievements.test.ts`, `balance.test.ts`, `grassland-boss.test.ts`, `player-health.test.ts`,
  `zones.test.ts`).

### Previous Story Intelligence (from 6.9)

- 6.9 already root-caused this exact flake once (see its own Debug Log — 4 repeated runs against
  its own changes and 3 against unmodified `main`, both showing the identical intermittent
  "expected 2 to be 3" pattern) and correctly logged it as D-6.9-B rather than fixing it, since
  `bonds.ts` was outside 6.9's own Allowed paths (`GameRoom.ts`/`packages/game-rules` balance
  helpers only). This story is the intentional follow-up 6.9's own deferred note pointed to.
- 6.9 established the "verify against current source before scoping, note exact line numbers,
  call out non-goals with reasoning" story-writing convention this story follows — matches 5.9's
  identical practice for D-5.8-A.
- 6.9's own code review left D-6.9-C and D-6.9-D open with explicit "revisit only if X" framing;
  this story re-checked both conditions directly against current source rather than assuming
  they still apply — D-6.9-D's "3rd instance" condition was checked by grepping every
  `isInHitZone(` call site in `GameRoom.ts` and confirming none newly match the duplicated
  snippet's exact shape.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: dev implementation of 6-9-epic-6-post-66-deferred-hardening (2026-07-17)] — D-6.9-A, D-6.9-B original findings
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 6-9-epic-6-post-66-deferred-hardening (2026-07-17)] — D-6.9-C, D-6.9-D original findings
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of bond-overlay-and-pair-priority-bugfixes (2026-07-03)] — D1, the original root-cause finding D-6.9-B points back to
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-8-hub-ability-use-outside-training-dummy-poi (2026-07-15)] — the mislabeled "D-6.6-C" entry (mobile reconnect-during-purification-window UX flash), re-verified and left as a Non-goal
- [Source: packages/game-rules/src/systems/bonds.ts] — `selectBondPair` (lines 19-31, this story's fix target), `assignBond` (lines 33-65, unchanged, its dedup fallback this fix reduces reliance on)
- [Source: packages/game-rules/src/index.ts] — confirms `selectBondPair` already exported, no export changes needed
- [Source: packages/game-rules/tests/unit/player-health.test.ts] — `makePlayer(overrides)` factory pattern this story's new test file mirrors
- [Source: tests/e2e/full-run.test.ts:234-240] — the flaky 3-player bond-count assertion this fix resolves at the root
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:643, :883-889] — `bondRng` seeding and `assignBond`'s only call site (read for context; not modified)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1054, :1050; apps/simulation-server/src/physics/world.ts:121] — boss/projectile fixture radii confirming D-6.9-A's physics-layer scope
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1918-1946, :276 in apps/mobile-controller/src/App.tsx] — the mislabeled-entry's underlying reconnect-race code, re-verified and left out of scope
- [Source: _bmad-output/implementation-artifacts/6-9-epic-6-post-66-deferred-hardening.md] — immediately prior story in this epic; originated D-6.9-A/B/C/D during its own dev implementation and code review
- [Source: _bmad-output/implementation-artifacts/5-9-epic-5-post-58-deferred-hardening.md] — sibling hardening story from the same batch; precedent for a small, single-finding, single-owner hardening story's scope and size

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx vitest run packages/game-rules/tests/unit/bonds.test.ts`: 4/4 pass.
- `npm run typecheck` (full monorepo, 10 project references): 0 errors.
- `npx vitest run` (full monorepo): 467 passed, 0 failed, 3 skipped. Only
  `tests/e2e/ability-dispatch.test.ts` and `tests/e2e/hub-ability-use.test.ts` suites failed
  to even start (pre-existing port-binding timeouts, documented as non-blocking in 6.9's own
  Debug Log). `tests/e2e/full-run.test.ts` — the story's target flaky assertion — passed.

### Completion Notes List

- Fixed `selectBondPair` (`packages/game-rules/src/systems/bonds.ts`): the first pick is now
  restricted to players who still have at least one available (not-already-bonded-to-them)
  partner; the second pick excludes players already bonded to the first pick, preferring an
  unbonded second pick when 2+ unbonded players exist. Falls back to the full roster only when
  the roster is genuinely saturated, where `assignBond`'s existing duplicate-dedup fallback
  (unchanged) continues to absorb it. Exactly 2 `rng()` calls preserved in every branch (AC3).
- Discrepancy found during implementation: the story's own Task 1 code block (verbatim) drops
  the "prefer unbonded player for the 2nd pick" bias entirely, which regressed a pre-existing
  test in `tests/unit/bonds.test.ts` ("prioritizes unbonded players — with 4 players and
  p0+p1 bonded, always picks p2 and p3") that the story's Dev Notes didn't know existed (it
  states "No test file exists yet for bonds.ts's pure functions" — true for the
  `packages/game-rules/tests/unit/` path, but a separate root-level `tests/unit/bonds.test.ts`
  already covers this module extensively). Fixed per Step 7 (regression must be resolved before
  continuing) by keeping an unbonded-preferred second-pick pool ahead of the
  not-already-bonded-to-`chosen` filter — this preserves both AC1 (never re-select an
  already-bonded pair while a valid pair exists) and AC4 (common case unchanged), verified by
  re-running the full suite (467 passing, 0 regressions). Did not modify the story's Allowed
  paths or touch `assignBond`.
- Added `packages/game-rules/tests/unit/bonds.test.ts` exactly as specified in Task 2 — 4 new
  tests (D-6.9-B/D1 repro, saturated 2-player, common-case unchanged, RNG-call-count contract),
  all pass against the refined implementation.
- Appended a "Resolution:" note to D-6.9-B in `deferred-work.md`, matching the
  D-5.7-C/D-dev4-B/D-dev5-A convention, including a note on the test-regression discrepancy
  found and fixed during implementation.
- `assignBond`, `selectBondType`, `bondKey`, and the per-tick bond-effect helpers were not
  touched, per Non-goals.

### File List

- `packages/game-rules/src/systems/bonds.ts` (modified)
- `packages/game-rules/tests/unit/bonds.test.ts` (added)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

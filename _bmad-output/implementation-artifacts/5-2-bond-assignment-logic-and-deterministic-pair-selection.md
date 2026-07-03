---
baseline_commit: 54bd3bb
---

# Story 5.2: Bond Assignment Logic & Deterministic Pair Selection

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.2)
Context: Story 5.1 is done. `packages/shared-types/src/bond.ts` exports
  BondType (Proximity, Fate) and BondState ({ playerA, playerB, type, color }).
  GameState.activeBonds: BondState[] exists and is initialized to []. All wire
  contracts (BondAssignedDelta, BondNotificationMsg, applyDelta bond:assigned)
  are implemented. This story adds the pure game-rules function that deterministically
  selects a player pair and bond type at level end.
Owner agent: Simulation Engineer (primary — packages/game-rules)
  QA + Telemetry Engineer: tests/unit/bonds.test.ts
Goal: Implement `assignBond(state, rng)` in packages/game-rules/src/systems/bonds.ts
  so that Story 5.4 can call it at level completion to select and record a bond.
  Covers pair selection, bond type selection, color assignment, and determinism guarantee.
  No Colyseus, no planck.js — pure functions only.
Allowed paths:
  - packages/game-rules/src/systems/bonds.ts              (NEW)
  - packages/game-rules/src/balance.ts                    (MODIFY — add BOND_TYPE_COLORS)
  - packages/game-rules/src/index.ts                      (MODIFY — export assignBond + types)
  - tests/unit/bonds.test.ts                              (NEW — determinism + correctness tests)
Blocked paths:
  - packages/shared-types/**         (5.1 contracts are final — do not touch)
  - packages/net-protocol/**         (5.1 contracts are final — do not touch)
  - apps/simulation-server/**        (5.4 integrates assignBond into GameRoom.ts)
  - apps/host-client/**              (5.5 visualization)
  - apps/mobile-controller/**        (5.6 bond card)
  - packages/game-rules/src/state/result.ts  (do not modify GameError union — use local BondError)
Inputs:
  - Epic 5 Story 5.2 acceptance criteria (epics.md:1012-1040)
  - packages/shared-types/src/bond.ts — BondType, BondState (from Story 5.1)
  - packages/shared-types/src/game-state.ts — GameState.activeBonds (from Story 5.1)
  - packages/shared-types/src/constants.ts — OFFSET_SPIRIT_BOND = 0x04
  - packages/game-rules/src/prng/xoshiro128.ts — createRng returns () => number in [0,1)
  - packages/game-rules/src/balance.ts — add BOND_TYPE_COLORS here
  - packages/game-rules/src/state/result.ts — Result<T,E> generic (do not modify)
Non-goals:
  - Per-tick bond effects (story 5.3)
  - planck.js proximity sensors (story 5.3)
  - Level-completion integration / broadcasting BondAssignedDelta (story 5.4)
  - Host particle tether visualization (story 5.5)
  - Mobile bond card UX (story 5.6)
  - Bond cooldown / dedup across runs (bonds reset via GameRoom.ts activeBonds=[] at run end)
Acceptance criteria:
  AC1: assignBond(state, rng) in bonds.ts returns Result<BondAssignedEvt, BondError>;
       if state.players.length < 2, returns { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } }
  AC2: On success, a new BondState is pushed to state.activeBonds and
       BondAssignedEvt { playerA, playerB, bondType, bondColor } is returned in value
  AC3: With 3 players and 3 sequential assignBond calls:
       - each call produces a distinct BondState entry in activeBonds (accumulate, not replace)
       - a player may appear in multiple bonds (repeats expected: 3 players × 3 bonds)
       - selectBondPair never throws or returns undefined regardless of activeBonds.length
  AC4: selectBondType(rng) returns one of BondType.Proximity or BondType.Fate;
       both variants are reachable (no dead code path)
  AC5: Two independent sim instances seeded identically produce identical
       [playerA, playerB, bondType] sequences across 3 assignBond calls
  AC6: TypeScript strict-mode build (npm run typecheck) passes with zero errors
Required hooks:
  - Simulation-safety hook: packages/game-rules touched.
    Required: typecheck passes, all existing unit tests remain green.
  - No contract-change hook: shared-types and net-protocol are NOT touched.
Required tests:
  - tests/unit/bonds.test.ts:
    - determinism: identical seed → identical 3-bond sequence
    - accumulation: 3 calls → 3 entries in activeBonds (not replaced)
    - not-enough-players guard: 0 or 1 player → ok: false
    - both bond types are reachable (selectBondType smoke test)
    - selectBondPair: player may repeat across bonds (3-player scenario)
Telemetry impact: None. Bond telemetry is story 5.4's responsibility.
```

## Story

As a player,
I want the Spirit Bond assignment to feel random each run but be perfectly consistent across all connected devices,
so that every player sees the same bond pair at the same time without server-client desync.

## Acceptance Criteria

1. **(AC1)** `assignBond(state: GameState, rng: () => number)` in `packages/game-rules/src/systems/bonds.ts` returns `Result<BondAssignedEvt, BondError>`. When `state.players.length < 2`, it returns `{ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } }`.

2. **(AC2)** On success, `assignBond` pushes a new `BondState` into `state.activeBonds` **and** returns `{ ok: true, value: { playerA, playerB, bondType, bondColor } }`.

3. **(AC3)** With 3 players and 3 sequential `assignBond` calls: each adds a distinct `BondState` entry in `activeBonds` (3 entries total — bonds accumulate, never replace). A player may appear in multiple bonds. `selectBondPair` does not throw or return `undefined` regardless of `activeBonds.length`.

4. **(AC4)** `selectBondType(rng)` returns one of the `BondType` variants and each variant must be reachable (no dead code path).

5. **(AC5)** Two independent instances using `createRng(runSeed ^ OFFSET_SPIRIT_BOND)` seeded identically produce identical `[playerA, playerB, bondType]` sequences for all three bond assignments.

6. **(AC6)** `npm run typecheck` passes with zero errors across all packages.

## Tasks / Subtasks

- [x] **Task 1: Add BOND_TYPE_COLORS to balance.ts** (AC: 2)
  - [x] In `packages/game-rules/src/balance.ts`, add at the bottom:
    ```ts
    import type { BondType } from 'shared-types';

    export const BOND_TYPE_COLORS: Record<BondType, string> = {
      // ponytail: type-based colors for alpha; per-bond-instance colors if Story 5.5 needs them
      proximity: '#6ea8d8',  // accent-spirit — matches 5.1 contract test fixture
      fate:      '#f5a623',  // warm amber
    };
    ```
  - [x] Use string literal keys (not `BondType.Proximity` syntax) because `balance.ts` is a plain-value module and dynamic enum keys work either way, but literal keys are more readable at a glance. Both compile.
  - [x] Import `BondType` from `shared-types` — already imported in other game-rules files; add to this file.

- [x] **Task 2: Create packages/game-rules/src/systems/bonds.ts** (AC: 1–5)
  - [x] Create the file with these exports:
    - `BondAssignedEvt` interface
    - `BondError` type
    - `selectBondType(rng: () => number): BondType` — named export (used in tests)
    - `selectBondPair(players: PlayerState[], rng: () => number): [string, string]` — named export (used in tests)
    - `assignBond(state: GameState, rng: () => number): Result<BondAssignedEvt, BondError>` — named export

  - [ ] Full file content:
    ```ts
    import type { GameState, PlayerState, BondState, BondType as _BondType } from 'shared-types';
    import { BondType } from 'shared-types';
    import type { Result } from '../state/result.js';
    import { BOND_TYPE_COLORS } from '../balance.js';

    export interface BondAssignedEvt {
      playerA: string;
      playerB: string;
      bondType: BondType;
      bondColor: string;
    }

    export type BondError = { code: 'NOT_ENOUGH_PLAYERS' };

    export function selectBondType(rng: () => number): BondType {
      return rng() < 0.5 ? BondType.Proximity : BondType.Fate;
    }

    export function selectBondPair(players: PlayerState[], rng: () => number): [string, string] {
      const idxA = Math.floor(rng() * players.length);
      const idxB = Math.floor(rng() * (players.length - 1));
      // Map idxB to skip over idxA
      const adjustedB = idxB >= idxA ? idxB + 1 : idxB;
      return [players[idxA].id, players[adjustedB].id];
    }

    export function assignBond(
      state: GameState,
      rng: () => number,
    ): Result<BondAssignedEvt, BondError> {
      if (state.players.length < 2) {
        return { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } };
      }

      const [playerA, playerB] = selectBondPair(state.players, rng);
      const bondType = selectBondType(rng);
      const bondColor = BOND_TYPE_COLORS[bondType];

      const bond: BondState = { playerA, playerB, type: bondType, color: bondColor };
      state.activeBonds.push(bond);

      return { ok: true, value: { playerA, playerB, bondType, bondColor } };
    }
    ```

  - [x] **`selectBondPair` algorithm note:** With N players, draw idxA uniformly from [0, N-1], then draw idxB from [0, N-2] and shift up if it hits idxA. This guarantees playerA ≠ playerB with exactly 2 PRNG calls — no rejection sampling needed. If N=2: idxA ∈ {0,1}, idxB ∈ {0} → adjustedB is the other player. Always valid.
  - [x] **`_BondType` import alias:** The re-export of `BondType` as a type import is to satisfy strict-mode when the enum is used both as a type and as a value (via `BondType.Proximity`). Import the enum as a value with `import { BondType } from 'shared-types'` (no `type` keyword) — this covers both usages.
  - [x] **`state.activeBonds.push(bond)` is a direct mutation:** This is intentional — the AC says "pushes the new BondState into state.activeBonds". The sim server passes `this.gameState` by reference; the mutation is the intended mechanism. This matches how `GameRoom.ts` directly mutates `this.gameState.*` elsewhere.

- [x] **Task 3: Export from packages/game-rules/src/index.ts** (AC: 1–5)
  - [x] Add to `packages/game-rules/src/index.ts`:
    ```ts
    export { assignBond, selectBondPair, selectBondType } from './systems/bonds.js';
    export type { BondAssignedEvt, BondError } from './systems/bonds.js';
    export { BOND_TYPE_COLORS } from './balance.js';
    ```
  - [x] Place after the existing `dispatchAbility` export line.
  - [x] `selectBondPair` and `selectBondType` are exported because tests import them directly from `game-rules` (not deep-importing from the systems file). This is the existing pattern (e.g., `applyPlayerDamage` is exported).

- [x] **Task 4: Create tests/unit/bonds.test.ts** (AC: 5, plus guards for AC1–4)
  - [x] Full test file content:
    ```ts
    import { describe, it, expect } from 'vitest';
    import { createRng, assignBond, selectBondType, selectBondPair } from 'game-rules';
    import { BondType } from 'shared-types';
    import type { GameState } from 'shared-types';

    const SEED = 0xdeadbeef;

    function makeState(playerCount: number): GameState {
      return {
        session: {
          roomId: 'test', hostId: 'h', phase: 'dungeon',
          playerCount, maxPlayers: 8, runSeed: SEED,
          levelIndex: 0, difficulty: 'normal', levelObjective: 'clear',
          waveIndex: 0, totalWaves: 0,
        },
        players: Array.from({ length: playerCount }, (_, i) => ({
          id: `p${i}`, sessionId: `s${i}`, sessionColor: '#ffffff',
          class: null, x: 0, y: 0, vx: 0, vy: 0,
          hp: 100, maxHp: 100, isDown: false, isSpirit: false, isFrozen: false,
          downCount: 0, spiritEssence: 0,
          abilityCooldownsExpiresAt: [0, 0, 0, 0],
          spiritAbilityCooldownExpiresAt: 0,
        })),
        enemies: [],
        activeBonds: [],
        essenceDrops: [],
        tick: 0,
        floorLayout: null,
        runProposal: null,
      };
    }

    describe('selectBondType', () => {
      it('returns Proximity or Fate', () => {
        const rng = createRng(SEED);
        for (let i = 0; i < 100; i++) {
          const t = selectBondType(rng);
          expect([BondType.Proximity, BondType.Fate]).toContain(t);
        }
      });

      it('both variants are reachable', () => {
        const rng = createRng(1);
        const types = new Set(Array.from({ length: 200 }, () => selectBondType(rng)));
        expect(types.has(BondType.Proximity)).toBe(true);
        expect(types.has(BondType.Fate)).toBe(true);
      });
    });

    describe('selectBondPair', () => {
      it('always returns two distinct player IDs', () => {
        const rng = createRng(SEED);
        const players = makeState(3).players;
        for (let i = 0; i < 50; i++) {
          const [a, b] = selectBondPair(players, rng);
          expect(a).not.toBe(b);
        }
      });

      it('works with exactly 2 players', () => {
        const rng = createRng(42);
        const [a, b] = selectBondPair(makeState(2).players, rng);
        expect(a).not.toBe(b);
        expect(['p0', 'p1']).toContain(a);
        expect(['p0', 'p1']).toContain(b);
      });

      it('with 3 players, a player may appear in multiple bonds (repeats expected)', () => {
        const rng = createRng(SEED);
        const players = makeState(3).players;
        const pairs: [string, string][] = Array.from({ length: 50 }, () => selectBondPair(players, rng));
        const allIds = pairs.flat();
        // Each player ID must appear at least once in 50 draws
        expect(allIds).toContain('p0');
        expect(allIds).toContain('p1');
        expect(allIds).toContain('p2');
      });
    });

    describe('assignBond', () => {
      it('returns NOT_ENOUGH_PLAYERS when fewer than 2 players', () => {
        const rng = createRng(SEED);
        const state0 = makeState(0);
        expect(assignBond(state0, rng)).toEqual({ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } });
        const state1 = makeState(1);
        expect(assignBond(state1, rng)).toEqual({ ok: false, error: { code: 'NOT_ENOUGH_PLAYERS' } });
      });

      it('pushes a BondState into activeBonds on success', () => {
        const rng = createRng(SEED);
        const state = makeState(3);
        const result = assignBond(state, rng);
        expect(result.ok).toBe(true);
        expect(state.activeBonds).toHaveLength(1);
        if (result.ok) {
          expect(state.activeBonds[0]).toEqual({
            playerA: result.value.playerA,
            playerB: result.value.playerB,
            type: result.value.bondType,
            color: result.value.bondColor,
          });
        }
      });

      it('accumulates 3 bonds across 3 calls — does not replace', () => {
        const rng = createRng(SEED);
        const state = makeState(3);
        assignBond(state, rng);
        assignBond(state, rng);
        assignBond(state, rng);
        expect(state.activeBonds).toHaveLength(3);
      });

      it('determinism: identical seeds produce identical bond sequences', () => {
        const state1 = makeState(3);
        const rng1 = createRng(SEED ^ 0x04);
        const state2 = makeState(3);
        const rng2 = createRng(SEED ^ 0x04);

        for (let i = 0; i < 3; i++) {
          const r1 = assignBond(state1, rng1);
          const r2 = assignBond(state2, rng2);
          expect(r1).toEqual(r2);
        }

        expect(state1.activeBonds).toEqual(state2.activeBonds);
      });
    });
    ```

  - [x] `makeState` helper: the PlayerState shape must match the current `PlayerState` interface in `packages/shared-types/src/player.ts`. If the shape has changed since this story was written, update the helper accordingly before running tests.
  - [x] Import path: `from 'game-rules'` — same pattern as `tests/unit/abilities.test.ts`. Tests run via `tests/package.json` vitest config with path alias already set up.

## Dev Notes

### Current State After Story 5.1

| File | Current state |
|---|---|
| `packages/shared-types/src/bond.ts` | `BondType { Proximity, Fate }` + `BondState { playerA, playerB, type, color }` — finalized |
| `packages/shared-types/src/game-state.ts` | `activeBonds: BondState[]` — exists |
| `packages/shared-types/src/constants.ts` | `OFFSET_SPIRIT_BOND = 0x04` — exists |
| `packages/game-rules/src/systems/bonds.ts` | **Does not exist** — this story creates it |
| `packages/game-rules/src/balance.ts` | No bond constants — `BOND_TYPE_COLORS` added here |
| `packages/game-rules/src/index.ts` | No bond exports — adds `assignBond` + types |
| `tests/unit/bonds.test.ts` | **Does not exist** — this story creates it |
| `apps/simulation-server/src/rooms/GameRoom.ts` | Has `activeBonds: []` (init, line 58) and `activeBonds = []` (reset, line 565); does NOT call `assignBond` yet — that's story 5.4 |

### PRNG Usage Pattern

`createRng(seed)` returns `() => number` where each call yields a float in `[0, 1)`.

The rng stream for bonds is: `createRng(runSeed ^ OFFSET_SPIRIT_BOND)` — built by the sim server (story 5.4), then passed into `assignBond`. `assignBond` itself never calls `createRng` — it receives the pre-built rng function. This is the same pattern as every other system (e.g., `spawnEnemies` builds `createRng(runSeed ^ OFFSET_ENEMY_SPAWN)` in GameRoom.ts and passes it down).

```typescript
// Story 5.4 (GameRoom.ts) will do:
const bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
const result = assignBond(this.gameState, bondRng);
```

**Important:** the bond rng stream must be created once per run and kept across levels (same instance used for all 3 calls). If a new `createRng` is created at each level, the sequence is seeded from the same start each time — all 3 bonds would be identical. Story 5.4 must store and reuse the rng instance.

### selectBondPair Algorithm

The "shift-up" technique avoids re-draw:
```
N players, indices [0..N-1]
Draw idxA ∈ [0, N-1]       — 1 rng call
Draw idxB ∈ [0, N-2]       — 1 rng call (1 fewer slot)
if idxB >= idxA: adjustedB = idxB + 1  (skips the slot idxA occupies)
else:            adjustedB = idxB
```

Example with N=3, idxA=1: idxB ∈ {0, 1} → adjustedB ∈ {0, 2}. Always picks a different player. Always exactly 2 rng calls, no loops.

### BondType Colors

Story 5.1 contract tests already use `'#6ea8d8'` (Proximity) and `'#f5a623'` (Fate). `BOND_TYPE_COLORS` must match these values — the contract tests are a fixed reference.

### activeBonds Mutation

`assignBond` mutates `state.activeBonds` in-place. This is consistent with the AC and how `GameRoom.ts` directly modifies `this.gameState.activeBonds`. The alternative (returning a new state) would make the function signature much heavier. Story 5.4 does not need to handle the push itself.

### State Reset Between Runs

`GameRoom.ts` line 565 already resets `this.gameState.activeBonds = []` at run end. Story 5.2 does not add or modify that reset.

### Error Type: BondError vs GameError

`GameError` in `result.ts` is a closed union of FSM/enemy error codes. Do NOT extend it. Define `BondError = { code: 'NOT_ENOUGH_PLAYERS' }` locally in `bonds.ts`, consistent with `HealthError` (in `player-health.ts`) and `AbilityGameError` (in `abilities.ts`). The AC says "GameError" loosely — the pattern in this codebase is per-system local error types.

### Ownership Boundary Note

Two ownership areas: Simulation Engineer (`packages/game-rules/**`) and QA + Telemetry Engineer (`tests/unit/bonds.test.ts`). The unit test is a direct complement to the pure functions and cannot be shipped separately without leaving AC5 unverifiable. Proceed as one story — identical justification to story 5.1's split.

### Downstream Story Handoffs

**Story 5.3** needs:
- `assignBond` already done; 5.3 adds `processBonds(state, world)` for per-tick effects
- `BOND_TYPE_COLORS` is a stable reference; 5.3 reads `bond.type` to apply buff/drain logic
- 5.3 will add `BOND_PROXIMITY_RANGE_PX`, `BOND_DRAIN_THRESHOLD_S`, `BOND_DRAIN_HP_PER_TICK` to `balance.ts`

**Story 5.4** needs:
- Calls `assignBond(this.gameState, bondRng)` at `level:complete` for levels 0–2
- Must store `bondRng` across levels (one `createRng` call per run)
- Uses `BondAssignedEvt` to fill `BondAssignedDelta` (broadcast) + `BondNotificationMsg` (unicast to bonded players)
- Note from 5.1 review: `SimEvents['bond:assigned']` has no `bondColor` field — story 5.4 must add `bondColor` from `BondAssignedEvt.bondColor` when constructing the broadcast delta (it cannot directly forward the SimEvent payload to `BondAssignedDelta`)

**Story 5.5** needs:
- Reads `mirrorState.activeBonds[i].color` to draw tether — color is set here

### Project Context Rules Applied

- **No `Math.random()`** — all randomness uses the passed-in `rng` function (PRNG from `createRng`)
- **`Result<T, E>` — never throw** — `assignBond` returns `Result`, never throws
- **No Colyseus imports** — bonds.ts imports only from `shared-types` and sibling game-rules files
- **No planck.js** — proximity sensors are story 5.3's concern
- **Naming:** file is `bonds.ts` (kebab-case); function is `assignBond` (camelCase verb)
- **PRNG offset:** `OFFSET_SPIRIT_BOND = 0x04` in `constants.ts` — already exists; do NOT add another constant
- **balance.ts for tunable values** — `BOND_TYPE_COLORS` belongs in `balance.ts`, not `constants.ts` (it's a visual/tunable value, not a cross-package constant)
- **TypeScript strict mode** — zero `any`; all types fully specified

### References

- Epic 5 Story 5.2 AC — [Source: _bmad-output/planning-artifacts/epics.md:1012-1040]
- `BondType`, `BondState` — [Source: packages/shared-types/src/bond.ts]
- `GameState.activeBonds` — [Source: packages/shared-types/src/game-state.ts:19]
- `OFFSET_SPIRIT_BOND = 0x04` — [Source: packages/shared-types/src/constants.ts:11]
- `createRng` return type `[0, 1)` — [Source: packages/game-rules/src/prng/xoshiro128.ts:32]
- `Result<T, E>` generic — [Source: packages/game-rules/src/state/result.ts]
- `HealthError` local error pattern — [Source: packages/game-rules/src/systems/player-health.ts:11]
- `AbilityGameError` local error pattern — [Source: packages/game-rules/src/systems/abilities.ts:23]
- PRNG stream offset pattern (`runSeed ^ OFFSET_ENEMY_SPAWN`) — [Source: apps/simulation-server/src/rooms/GameRoom.ts:461]
- `activeBonds` reset at run end — [Source: apps/simulation-server/src/rooms/GameRoom.ts:565]
- Bond color `#6ea8d8` for Proximity — [Source: tests/contract/net-protocol.test.ts — Story 5.1 fixture]
- Bond color `#f5a623` for Fate — [Source: tests/contract/net-protocol.test.ts — Story 5.1 fixture]
- Test pattern (`from 'game-rules'`) — [Source: tests/unit/abilities.test.ts:2]
- Unit test location convention — [Source: _bmad-output/project-context.md — Testing Rules table]
- SimEvents['bond:assigned'] missing bondColor — [Source: _bmad-output/implementation-artifacts/5-1-spirit-bond-shared-types-and-protocol-contracts.md — Review Findings, story 5.4 handoff note]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `makeState` test helper updated: story spec used outdated `PlayerState` shape (missing `displayName`, `nearPoiId`, `essenceTotal`, `reviveTimerExpiresAt`; used string for `sessionColor` instead of `SessionColor` enum). Updated to match current `packages/shared-types/src/player.ts`.
- `selectBondPair` strict-mode fix: array indexing `players[idxA]` flagged as possibly undefined; added `!` non-null assertions — safe because `assignBond` guards `players.length < 2` before calling.

### Completion Notes List

- Implemented `packages/game-rules/src/systems/bonds.ts` with `assignBond`, `selectBondPair`, `selectBondType`, `BondAssignedEvt`, `BondError`.
- Added `BOND_TYPE_COLORS` to `balance.ts` matching Story 5.1 contract test fixtures (`#6ea8d8` Proximity, `#f5a623` Fate).
- Exported all new symbols from `packages/game-rules/src/index.ts`.
- Created `tests/unit/bonds.test.ts` with 9 tests covering all ACs (determinism, accumulation, not-enough-players guard, both bond types reachable, player repeats in 3-player scenario).
- All 283 tests pass; `npm run typecheck` clean.

### File List

- packages/game-rules/src/balance.ts (modified)
- packages/game-rules/src/systems/bonds.ts (new)
- packages/game-rules/src/index.ts (modified)
- tests/unit/bonds.test.ts (new)

### Senior Developer Review (AI)

**Review Date:** 2026-07-03
**Outcome:** Changes Requested
**Layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor
**Action Items:** 2 patch, 6 deferred, 8 dismissed

#### Action Items

- [x] [Review][Patch] Import `OFFSET_SPIRIT_BOND` constant in determinism test instead of magic `0x04` [tests/unit/bonds.test.ts:113,115]
- [x] [Review][Patch] Add explicit repeat assertion in "player may repeat" test [tests/unit/bonds.test.ts:68-76]
- [x] [Review][Defer] `selectBondPair` has no internal guard for 1-player input — pre-existing by design, always called through `assignBond` [bonds.ts:19-24] — deferred, pre-existing
- [x] [Review][Defer] Entire project working tree uncommitted since `54bd3bb` — bond.ts and result.ts show in diff but changes are from prior stories — deferred, pre-existing
- [x] [Review][Defer] `selectBondPair` index math fragile if rng() ever ≥ 1.0 — xoshiro128 contract is [0,1), safe for now [bonds.ts:20-21] — deferred, pre-existing
- [x] [Review][Defer] Same pair can appear in activeBonds multiple times — intentional per story non-goals; dedup/cooldown is story 5.3 scope [bonds.ts:39] — deferred, pre-existing
- [x] [Review][Defer] N=8 max players not covered by tests — algorithm correct; nice-to-have coverage [bonds.test.ts] — deferred, pre-existing
- [x] [Review][Defer] rng()=0.0 boundary not explicitly tested — algorithm correct; nice-to-have [bonds.test.ts] — deferred, pre-existing

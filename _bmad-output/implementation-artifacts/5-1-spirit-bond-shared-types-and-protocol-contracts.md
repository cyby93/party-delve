---
baseline_commit: 54bd3bb
---

# Story 5.1: Spirit Bond Shared Types & Protocol Contracts

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (GDD Epic 5, first story)
Context: Epic 4 is done. The codebase has placeholder bond types in
  packages/shared-types/src/bond.ts (BondType.SHIELD_LINK etc. + BondState
  with playerAId/playerBId) and placeholder bond message shapes in
  net-protocol (BondAssignedDelta wraps a BondState object; BondNotificationMsg
  wraps a BondState object). GameState has `bonds: BondState[]`. None of these
  are wired to actual game logic yet — they are stubs from the architecture
  scaffold. This story replaces every placeholder with the contract shapes the
  Epic 5 stories will actually implement against.
Owner agent: Protocol Architect (primary)
  Simulation Engineer: bonds → activeBonds rename in GameRoom.ts (2 lines)
  QA + Telemetry Engineer: contract tests, rename in tests/contract/
Goal: Replace placeholder bond types/shapes with the agreed-upon contract so
  all downstream stories (5.2–5.6) can implement against a stable interface.
  No game logic is added here — this is types + wire messages + applyDelta
  + round-trip tests only.
Allowed paths:
  - packages/shared-types/src/bond.ts                        (MODIFY — replace BondType + BondState)
  - packages/shared-types/src/game-state.ts                  (MODIFY — bonds → activeBonds)
  - packages/shared-types/src/session.ts                     (MODIFY — SimEvents bond:assigned payload)
  - packages/net-protocol/src/messages/server-to-host.ts     (MODIFY — BondAssignedDelta shape + imports)
  - packages/net-protocol/src/messages/server-to-mobile.ts   (MODIFY — BondNotificationMsg shape + imports)
  - packages/net-protocol/src/apply-delta.ts                 (MODIFY — implement bond:assigned case)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — bonds → activeBonds rename only)
  - apps/simulation-server/tests/game-room-host-join.test.ts (MODIFY — bonds → activeBonds rename only)
  - tests/contract/net-protocol.test.ts                      (MODIFY — rename + add bond round-trip tests)
  - tests/contract/player-class-updated-delta.test.ts        (MODIFY — bonds → activeBonds rename only)
Blocked paths:
  - packages/game-rules/**     (no logic yet — story 5.2 adds bonds.ts)
  - apps/host-client/**        (visualization story 5.5)
  - apps/mobile-controller/**  (bond card story 5.6)
  - docs/adr/**                (no new ADR needed — existing architecture covers this)
Inputs:
  - Epic 5 Story 5.1 acceptance criteria (epics.md:980-1009)
  - packages/shared-types/src/bond.ts (current stub — replace contents)
  - packages/shared-types/src/game-state.ts (rename bonds field)
  - packages/shared-types/src/session.ts (SimEvents map)
  - packages/net-protocol/src/messages/server-to-host.ts (BondAssignedDelta)
  - packages/net-protocol/src/messages/server-to-mobile.ts (BondNotificationMsg)
  - packages/net-protocol/src/apply-delta.ts (bond:assigned no-op → push)
  - apps/simulation-server/src/rooms/GameRoom.ts (bonds: [] refs at lines 58, 565)
  - tests/contract/net-protocol.test.ts (mockGameState bonds field + new tests)
Non-goals:
  - Bond assignment logic (story 5.2)
  - Per-tick bond effects (story 5.3)
  - Level-completion integration (story 5.4)
  - Host particle tether visualization (story 5.5)
  - Mobile bond card UX (story 5.6)
  - Adding bond constants to balance.ts (story 5.3)
  - Adding bond:price-active delta (story 5.3)
  - Any planck.js sensor code (story 5.3)
Acceptance criteria:
  AC1: packages/shared-types/src/bond.ts exports BondType enum with at
       least Proximity and Fate variants, and BondState interface with
       { playerA: string; playerB: string; type: BondType; color: string; }
  AC2: GameState.activeBonds: BondState[] exists (field renamed from bonds);
       createEmptyGameState initializes it to []
  AC3: SimEvents['bond:assigned'] payload is
       { playerA: string; playerB: string; bondType: BondType }
  AC4: BondAssignedDelta in DeltaEventMsg union is
       { type: 'bond:assigned'; playerA: string; playerB: string; bondType: BondType; bondColor: string; }
  AC5: BondNotificationMsg is
       { type: 'bond:notification'; playerA: string; playerB: string; bondType: BondType; bondColor: string; bondDescription: string; bondMechanic: string; }
  AC6: applyDelta bond:assigned case pushes a new BondState to state.activeBonds
       (constructed from delta fields) and returns the updated state
  AC7: Contract round-trip tests for BondAssignedDelta and BondNotificationMsg
       both pass in tests/contract/net-protocol.test.ts
  AC8: TypeScript strict-mode build passes with zero errors across all packages
Required hooks:
  - Contract-change hook: changes touch shared-types and net-protocol.
    Requires: at least two new contract tests (AC7); spec already covered
    by this story file + epics.md; no ADR update needed.
  - Simulation-safety hook: GameRoom.ts touched. Required: typecheck passes,
    all existing unit tests green (bonds rename is mechanical — no logic change).
Required tests:
  - BondAssignedDelta round-trip: serialize → deserialize produces identical value
  - BondNotificationMsg round-trip: serialize → deserialize produces identical value
  - applyDelta bond:assigned pushes to activeBonds (optional but strongly recommended)
  - mockGameState in net-protocol.test.ts updated: bonds → activeBonds
Telemetry impact: None.
```

## Story

As a developer on the project,
I want the Spirit Bond data types and wire message contracts defined in shared-types and net-protocol,
so that all agent roles can implement bond logic, host visualization, and mobile UX against agreed-upon interfaces.

## Acceptance Criteria

1. **(AC1)** `packages/shared-types/src/bond.ts` exports `BondType` enum with at least `Proximity` and `Fate` variants, and `BondState` interface `{ playerA: string; playerB: string; type: BondType; color: string; }`.

2. **(AC2)** `GameState.activeBonds: BondState[]` field exists (renamed from `bonds`); `createEmptyGameState` in `GameRoom.ts` initializes it to `[]`.

3. **(AC3)** `SimEvents['bond:assigned']` in `packages/shared-types/src/session.ts` has payload `{ playerA: string; playerB: string; bondType: BondType }`.

4. **(AC4)** `BondAssignedDelta` in the `DeltaEventMsg` union is `{ type: 'bond:assigned'; playerA: string; playerB: string; bondType: BondType; bondColor: string; }`.

5. **(AC5)** `BondNotificationMsg` in `packages/net-protocol/src/messages/server-to-mobile.ts` is `{ type: 'bond:notification'; playerA: string; playerB: string; bondType: BondType; bondColor: string; bondDescription: string; bondMechanic: string; }`.

6. **(AC6)** `applyDelta` `bond:assigned` case pushes a new `BondState` onto `state.activeBonds` (constructed from delta fields) and returns the updated state instead of the current `return state` no-op.

7. **(AC7)** `BondAssignedDelta` and `BondNotificationMsg` both survive `serialize → deserialize` round-trip tests in `tests/contract/net-protocol.test.ts`.

8. **(AC8)** TypeScript strict-mode build (`npm run typecheck`) passes with zero errors across all packages after the changes.

## Tasks / Subtasks

- [x] **Task 1: Rewrite bond.ts in shared-types** (AC: 1)
  - [x] Replace the entire contents of `packages/shared-types/src/bond.ts` with:
    ```ts
    export enum BondType {
      Proximity = 'proximity',
      Fate = 'fate',
    }

    export interface BondState {
      playerA: string;
      playerB: string;
      type: BondType;
      color: string;
    }
    ```
  - [x] Do NOT touch `packages/shared-types/src/index.ts` — it already re-exports `bond.ts` via `export * from './bond.js'`.
  - [x] Note: old enum values (`SHIELD_LINK`, `SPIRIT_BRIDGE`, etc.) and old interface fields (`id`, `playerAId`, `playerBId`, `buff`, `price`, `isActive`) are dropped. No code currently uses them beyond type declarations.

- [x] **Task 2: Rename GameState.bonds → GameState.activeBonds** (AC: 2)
  - [x] In `packages/shared-types/src/game-state.ts`, change `bonds: BondState[]` to `activeBonds: BondState[]`.
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts` line 58: `bonds: []` → `activeBonds: []`.
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts` line 565: `this.gameState.bonds = []` → `this.gameState.activeBonds = []`.
  - [x] In `apps/simulation-server/tests/game-room-host-join.test.ts` line 34: `bonds: []` → `activeBonds: []`.
  - [x] In `tests/contract/net-protocol.test.ts` line 24 (inside `mockGameState()`): `bonds: []` → `activeBonds: []`.
  - [x] In `tests/contract/player-class-updated-delta.test.ts` line 20: `bonds: []` → `activeBonds: []`.

- [x] **Task 3: Update SimEvents in session.ts** (AC: 3)
  - [x] In `packages/shared-types/src/session.ts`, inside the `SimEvents` interface, change:
    ```ts
    // FROM:
    'bond:assigned': { playerAId: string; playerBId: string; bondType: BondType };
    // TO:
    'bond:assigned': { playerA: string; playerB: string; bondType: BondType };
    ```

- [x] **Task 4: Update BondAssignedDelta in server-to-host.ts** (AC: 4)
  - [x] In `packages/net-protocol/src/messages/server-to-host.ts`:
    - Change the import line from:
      ```ts
      import type { GameState, BondState, EssenceDrop, PlayerClass, DifficultyTier } from 'shared-types';
      ```
      to:
      ```ts
      import type { GameState, BondType, EssenceDrop, PlayerClass, DifficultyTier } from 'shared-types';
      ```
    - Replace `BondAssignedDelta` type from:
      ```ts
      export type BondAssignedDelta = {
        type: 'bond:assigned';
        bond: BondState;
      };
      ```
      to:
      ```ts
      export type BondAssignedDelta = {
        type: 'bond:assigned';
        playerA: string;
        playerB: string;
        bondType: BondType;
        bondColor: string;
      };
      ```
  - [x] The `BondAssignedDelta` is already a member of the `DeltaEventMsg` union — no change needed there.

- [x] **Task 5: Update BondNotificationMsg in server-to-mobile.ts** (AC: 5)
  - [x] In `packages/net-protocol/src/messages/server-to-mobile.ts`:
    - Change the import line from:
      ```ts
      import type { BondState, SessionColor } from 'shared-types';
      ```
      to:
      ```ts
      import type { BondType, SessionColor } from 'shared-types';
      ```
    - Replace `BondNotificationMsg` interface from:
      ```ts
      export interface BondNotificationMsg {
        type: 'bond:notification';
        bond: BondState;
      }
      ```
      to:
      ```ts
      export interface BondNotificationMsg {
        type: 'bond:notification';
        playerA: string;
        playerB: string;
        bondType: BondType;
        bondColor: string;
        bondDescription: string;
        bondMechanic: string;
      }
      ```

- [x] **Task 6: Implement bond:assigned in applyDelta** (AC: 6)
  - [x] In `packages/net-protocol/src/apply-delta.ts`, replace the `bond:assigned` case:
    ```ts
    // FROM:
    case 'bond:assigned':
      return state;  // ponytail: bond display in Story 3.6

    // TO:
    case 'bond:assigned':
      return {
        ...state,
        activeBonds: [
          ...state.activeBonds,
          { playerA: evt.playerA, playerB: evt.playerB, type: evt.bondType, color: evt.bondColor },
        ],
      };
    ```
  - [x] The `BondState` type is already available via `GameState` import from `shared-types` — no new import needed.

- [x] **Task 7: Add contract round-trip tests** (AC: 7)
  - [x] In `tests/contract/net-protocol.test.ts`, add a new `describe` block for Story 5.1 bond contracts:
    ```ts
    describe('Story 5.1 bond contract round-trips', () => {
      it('BondAssignedDelta survives serialize → deserialize', () => {
        const delta = {
          type: 'bond:assigned' as const,
          playerA: 'player-1',
          playerB: 'player-2',
          bondType: BondType.Proximity,
          bondColor: '#6ea8d8',
        } satisfies DeltaEventMsg;
        expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
      });

      it('applyDelta bond:assigned pushes to activeBonds', () => {
        const state: GameState = mockGameState();
        const next = applyDelta(state, {
          type: 'bond:assigned',
          playerA: 'player-1',
          playerB: 'player-2',
          bondType: BondType.Proximity,
          bondColor: '#6ea8d8',
        });
        expect(next.activeBonds).toHaveLength(1);
        expect(next.activeBonds[0]).toEqual({
          playerA: 'player-1',
          playerB: 'player-2',
          type: BondType.Proximity,
          color: '#6ea8d8',
        });
        expect(state.activeBonds).toHaveLength(0); // original must not be mutated
      });
    });
    ```
  - [x] Add `BondType` to imports from `shared-types` in the test file:
    ```ts
    import { PlayerClass, SessionColor, EnemyType, DifficultyTier, EnemyFSMState, BondType } from 'shared-types';
    ```
  - [x] Add the `BondNotificationMsg` round-trip test — this is a `server-to-mobile.ts` message, so it needs to be imported and serialized directly:
    ```ts
    it('BondNotificationMsg survives serialize → deserialize', () => {
      const msg: BondNotificationMsg = {
        type: 'bond:notification',
        playerA: 'player-1',
        playerB: 'player-2',
        bondType: BondType.Fate,
        bondColor: '#f5a623',
        bondDescription: 'Your fates are intertwined.',
        bondMechanic: 'Shared doom: if one falls, so does the other.',
      };
      expect(deserialize<BondNotificationMsg>(serialize(msg))).toEqual(msg);
    });
    ```
  - [x] Ensure `BondNotificationMsg` is already exported from `net-protocol` index — it is, per `index.ts`.
  - [x] Import `BondNotificationMsg` in the test file if not already imported.

- [x] **Task 8: Typecheck verification** (AC: 8)
  - [x] Run `npm run typecheck` from workspace root (or per-package).
  - [x] All packages must pass strict-mode typecheck with zero errors.
  - [x] Run existing tests: `npm test` — all 279 tests pass (1 stale-worktree e2e failure from pre-existing WSL2 zombie port conflict, unrelated to this story).

### Review Findings

- [x] [Review][Decision→Patch] `applyDelta bond:assigned` dedup guard added — `if (state.activeBonds.some(b => b.playerA === evt.playerA && b.playerB === evt.playerB)) return state;` prevents duplicate accumulation on reconnect/retry. Dedup test added. [`packages/net-protocol/src/apply-delta.ts:129`]
- [x] [Review][Defer] `bondColor` (wire) vs `color` (state) naming split — `BondAssignedDelta.bondColor` maps to `BondState.color`; `apply-delta.ts` bridges manually. TypeScript catches any mismatch; asymmetry is consistent with how `bondType→type` works in the same mapping. [`packages/net-protocol/src/apply-delta.ts:135`] — deferred, intentional convention
- [x] [Review][Defer] `bondDescription`/`bondMechanic` are unconstrained `string` — no union type or lookup table. Valid values will be established in story 5.4. Premature to constrain now. [`packages/net-protocol/src/messages/server-to-mobile.ts`] — deferred, story 5.4 scope
- [x] [Review][Defer] `BondAssignedDelta` not individually exported from net-protocol index — accessible via `DeltaEventMsg` union; switch-narrowing in host client works without named import. Matches pre-existing pattern (no other delta types exported individually either). [`packages/net-protocol/src/index.ts`] — deferred, pre-existing pattern
- [x] [Review][Defer] Mobile lacks `bondDescription`/`bondMechanic` after reconnect — snapshot carries `activeBonds: BondState[]` (type+color only); unicast `BondNotificationMsg` is not re-sent on reconnect. Story 5.6 should re-derive description/mechanic from `bondType` on the client. — deferred, story 5.6 scope
- [x] [Review][Defer] `SimEvents['bond:assigned']` missing `bondColor` — latent story 5.4 hazard. The internal sim event cannot be forwarded directly to `BondAssignedDelta`; story 5.4 must add `bondColor` when constructing the broadcast. Not a bug here but needs story 5.4 awareness. [`packages/shared-types/src/session.ts:25`] — deferred, story 5.4 handoff note

## Dev Notes

### Current State vs. Required State

| Location | Current | Required |
|---|---|---|
| `bond.ts` BondType | `SHIELD_LINK, SPIRIT_BRIDGE, ESSENCE_FLOW, WAR_PACT` | `Proximity = 'proximity', Fate = 'fate'` |
| `bond.ts` BondState | `{ id, type, playerAId, playerBId, buff, price, isActive }` | `{ playerA, playerB, type, color }` |
| `game-state.ts` | `bonds: BondState[]` | `activeBonds: BondState[]` |
| `session.ts` SimEvents | `playerAId, playerBId` | `playerA, playerB` |
| `BondAssignedDelta` | `{ type; bond: BondState }` | `{ type; playerA; playerB; bondType; bondColor }` |
| `BondNotificationMsg` | `{ type; bond: BondState }` | `{ type; playerA; playerB; bondType; bondColor; bondDescription; bondMechanic }` |
| `applyDelta bond:assigned` | `return state` (no-op) | push new BondState to `activeBonds` |

### Why the Old Fields Are Dropped

The old `BondState` fields (`id`, `buff`, `price`, `isActive`) were never used by any game logic — they were architecture scaffolding. The epic's contract specifies the minimal shape:
- `playerA`/`playerB` replace `playerAId`/`playerBId` (shorter, consistent with how other delta events name player references — e.g., `byPlayerId` was shortened in other places too)
- `color` is assigned by the sim server at bond-assignment time (story 5.2) — it must travel in the wire message so host and mobile render the same color
- `buff`/`price` semantics are delivered via `bondDescription`/`bondMechanic` in `BondNotificationMsg` (human-readable strings) and computed by type in story 5.3's `processBonds`
- `isActive` is implicit: all entries in `activeBonds[]` are active

### Impact on Downstream Stories

Story 5.2 (`assignBond`) will:
- Create `BondState` objects with the new shape
- Use `BondType.Proximity` and `BondType.Fate`
- Push to `state.activeBonds` (server-side)

Story 5.3 (`processBonds`) will:
- Read `bond.type` to apply correct behavior (Proximity = damage buff + drain; Fate = speed buff + shared doom)

Story 5.4 (level integration) will:
- Call `assignBond()`, broadcast `BondAssignedDelta` with the new shape
- Unicast `BondNotificationMsg` to bonded players with human-readable `bondDescription`/`bondMechanic`

Story 5.5 (host visualization) will:
- Read `mirrorState.activeBonds` (updated by `applyDelta` from this story)
- Render tethers using `bond.color`

Story 5.6 (mobile bond card) will:
- Render `bondDescription`, `bondMechanic` from `BondNotificationMsg`
- Use `bondColor` for the phone frame glow

### Exact File Locations and Line Numbers

| File | Change | Line(s) |
|---|---|---|
| `packages/shared-types/src/bond.ts` | Replace entire file contents | all |
| `packages/shared-types/src/game-state.ts` | `bonds` → `activeBonds` | line 19 |
| `packages/shared-types/src/session.ts` | SimEvents bond:assigned payload | line 25 |
| `packages/net-protocol/src/messages/server-to-host.ts` | Import + BondAssignedDelta shape | lines 1, 65–67 |
| `packages/net-protocol/src/messages/server-to-mobile.ts` | Import + BondNotificationMsg shape | lines 1, 10–13 |
| `packages/net-protocol/src/apply-delta.ts` | bond:assigned case body | ~line 101 (`case 'bond:assigned': return state;`) |
| `apps/simulation-server/src/rooms/GameRoom.ts` | `bonds: []` → `activeBonds: []` | lines 58, 565 |
| `apps/simulation-server/tests/game-room-host-join.test.ts` | `bonds: []` → `activeBonds: []` | line 34 |
| `tests/contract/net-protocol.test.ts` | mockGameState rename + new tests | line 24 + append new describe |
| `tests/contract/player-class-updated-delta.test.ts` | `bonds: []` → `activeBonds: []` | line 20 |

### BondAssignedDelta Export

`BondAssignedDelta` is NOT currently explicitly exported from `packages/net-protocol/src/index.ts`. It is part of the `DeltaEventMsg` union (which is exported). The contract test can access it via `DeltaEventMsg` with `satisfies`. No change to index.ts needed.

### applyDelta: GameState import

`apply-delta.ts` already imports `GameState` from `shared-types`. After the rename, `state.activeBonds` will be available — no additional imports needed.

### No Changes to net-protocol/src/index.ts

`index.ts` already exports `BondNotificationMsg` from `server-to-mobile.ts`. No changes needed.

### Colyseus / Authority Notes

This story touches no Colyseus `@Schema` or state sync — pure TypeScript interfaces and wire protocol. The `applyDelta` update is the only runtime logic addition, and it's a simple immutable spread into the host's mirror state array.

### Project Context Rules

- **No new dependencies** — all changes are TypeScript type definitions and plain object manipulation.
- **`bonds → activeBonds`**: search-and-replace is safe because the only references outside of type files are the 5 locations listed above (confirmed by `grep -rn "\bbonds\b"` over apps/ packages/ tests/).
- **Naming conventions**: enum values use PascalCase (`Proximity`, `Fate`) per TypeScript convention for string enums — not SCREAMING_SNAKE_CASE (that rule applies to constants in `constants.ts`, not enum variants).
- **Contract-change hook**: any change to `packages/shared-types/**` or `packages/net-protocol/**` requires at least one new or updated contract test — satisfied by Task 7.
- **Serialization**: do not call `JSON.stringify`/`JSON.parse` directly — always use `serialize()`/`deserialize()` from `net-protocol`. The contract tests use these wrappers.
- **Result<T, E>**: not applicable here — no game-rules functions are touched.
- **TypeScript strict mode**: zero `any` without suppression comment. All new types are fully specified.

### Ownership Boundary Note

This story touches three ownership areas:
- Protocol Architect: all `packages/` changes (primary work)
- Simulation Engineer: 2-line rename in `GameRoom.ts` + 1-line rename in `game-room-host-join.test.ts`
- QA + Telemetry Engineer: rename in `tests/contract/` + new contract tests

The sim-server and test changes are mechanical renames cascading from the contract change — they cannot be shipped separately without creating a TypeScript build error. Recommend proceeding as one story. If splitting is required: ship Task 1–3 (shared-types only) first (build will error in net-protocol until Task 4–6 land), then Task 4–8 together.

### References

- Epic 5 Story 5.1 AC — [Source: _bmad-output/planning-artifacts/epics.md:980-1009]
- Current `BondType` / `BondState` — [Source: packages/shared-types/src/bond.ts]
- Current `GameState.bonds` — [Source: packages/shared-types/src/game-state.ts:19]
- Current `SimEvents` — [Source: packages/shared-types/src/session.ts:21-26]
- Current `BondAssignedDelta` — [Source: packages/net-protocol/src/messages/server-to-host.ts:63-66]
- Current `BondNotificationMsg` — [Source: packages/net-protocol/src/messages/server-to-mobile.ts:9-12]
- Current `applyDelta` bond:assigned case — [Source: packages/net-protocol/src/apply-delta.ts ~line 101]
- `createEmptyGameState` bonds init — [Source: apps/simulation-server/src/rooms/GameRoom.ts:58]
- Run-end bonds reset — [Source: apps/simulation-server/src/rooms/GameRoom.ts:565]
- Contract test file — [Source: tests/contract/net-protocol.test.ts]
- PRNG stream offset for bonds — [Source: packages/shared-types/src/constants.ts — OFFSET_SPIRIT_BOND = 0x04]
- Spirit Bond system rules — [Source: _bmad-output/project-context.md — "Spirit Bond System" section]
- UX-DR12: bond assignment overlay spec — [Source: _bmad-output/planning-artifacts/epics.md:122]
- Bond color glow (accent-spirit) — [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:344]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

First typecheck run failed: `player-class-updated-delta.test.ts` had a pre-existing incomplete `SessionState` (missing `difficulty`, `levelObjective`, `waveIndex`, `totalWaves`) and `GameState` (missing `floorLayout`, `runProposal`). Fixed in the same pass as the `bonds → activeBonds` rename since the file was already being touched. Second run passed.

### Completion Notes List

- Replaced `BondType` (4 SCREAMING_SNAKE variants) with `Proximity`/`Fate` string enum per AC1.
- Replaced `BondState` (7 fields: id, type, playerAId, playerBId, buff, price, isActive) with minimal 4-field shape (playerA, playerB, type, color) per AC1.
- Renamed `GameState.bonds` → `activeBonds` across 6 files (game-state.ts, GameRoom.ts ×2, 3 test files) per AC2.
- Updated `SimEvents['bond:assigned']` payload: `playerAId`/`playerBId` → `playerA`/`playerB` per AC3.
- Updated `BondAssignedDelta`: replaced `bond: BondState` with flat `playerA`, `playerB`, `bondType`, `bondColor` fields; swapped `BondState` import for `BondType` per AC4.
- Updated `BondNotificationMsg`: replaced `bond: BondState` with 6 flat fields; swapped `BondState` import for `BondType` per AC5.
- Implemented `applyDelta bond:assigned`: replaced `return state` no-op with immutable spread push to `activeBonds` per AC6.
- Added 3 new contract tests (BondAssignedDelta round-trip, BondNotificationMsg round-trip, applyDelta push behavior) per AC7.
- Typecheck: zero errors across all 9 packages + tests/tsconfig.json (AC8). All 279 tests pass.
- Pre-existing bug fixed: `player-class-updated-delta.test.ts` had incomplete `SessionState`/`GameState` shapes that never caused prior TS errors (possibly masked by config drift).

**Contract-change hook checklist (required per CLAUDE.md):**
- [x] Changes touch `packages/shared-types/**` and `packages/net-protocol/**`
- [x] At least two new contract tests added (AC7: 3 new tests)
- [x] Spec covered by this story file + epics.md:980–1009
- [x] No ADR update needed (existing architecture covers this per story header)
- [x] Protocol Architect review required before merge

**Simulation-safety hook checklist:**
- [x] `apps/simulation-server/src/rooms/GameRoom.ts` touched (2-line rename only, no logic change)
- [x] Typecheck passes
- [x] All existing unit tests green

**Confidence: 99%** — all changes are mechanical renames or literal replacements from the story spec. No logic was invented; applyDelta push is a direct immutable spread identical to patterns in 10+ other cases in the same file.

### File List

- `packages/shared-types/src/bond.ts` — replaced
- `packages/shared-types/src/game-state.ts` — `bonds` → `activeBonds`
- `packages/shared-types/src/session.ts` — `playerAId`/`playerBId` → `playerA`/`playerB`
- `packages/net-protocol/src/messages/server-to-host.ts` — import + BondAssignedDelta shape
- `packages/net-protocol/src/messages/server-to-mobile.ts` — import + BondNotificationMsg shape
- `packages/net-protocol/src/apply-delta.ts` — bond:assigned no-op → push
- `apps/simulation-server/src/rooms/GameRoom.ts` — `bonds` → `activeBonds` (lines 58, 565)
- `apps/simulation-server/tests/game-room-host-join.test.ts` — `bonds` → `activeBonds`
- `tests/contract/net-protocol.test.ts` — rename + 3 new bond contract tests
- `tests/contract/player-class-updated-delta.test.ts` — `bonds` → `activeBonds` + fix pre-existing incomplete SessionState/GameState

## Change Log

- 2026-07-02: Story 5.1 implemented. Replaced bond stub types with E5 contract shapes; renamed `bonds` → `activeBonds` across 6 files; implemented `applyDelta bond:assigned`; added 3 contract tests. Typecheck: zero errors. Tests: 279 pass.

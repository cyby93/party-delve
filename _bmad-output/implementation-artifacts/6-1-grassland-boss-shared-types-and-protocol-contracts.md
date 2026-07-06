---
baseline_commit: 23b8a4e
---

# Story 6.1: Grassland Boss — Shared Types & Protocol Contracts

Status: done

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.1 — types + protocol contracts only)
Context: Epics 1–5 complete. The codebase has no boss-related types anywhere.
  Codebase state entering this story:
  - packages/shared-types/src/game-state.ts: GameState has no boss field
  - packages/net-protocol/src/apply-delta.ts: has a `default: never` exhaustiveness
    guard — adding new DeltaEventMsg variants WITHOUT a matching case is a TypeScript
    compile error. All three new boss delta types MUST have cases added.
  - apps/simulation-server/src/rooms/GameRoom.ts: createEmptyGameState at line 43
    constructs a GameState literal — must add boss: null for TS to compile
  - apps/simulation-server/tests/game-room-host-join.test.ts: has a local
    createEmptyGameState helper at line 17 that also needs boss: null
  - tests/contract/net-protocol.test.ts: mockGameState() at line 7 constructs
    GameState and also needs boss: null
  - Boss placeholder in GameRoom.ts currently triggers at `if (index >= 4)` (line ~775).
    Note: 0-indexed, so boss is level index 3, not 4. This is a pre-existing condition
    that Story 6.3 will fix — do NOT touch it in this story.
  Existing patterns to follow:
  - bond.ts → boss.ts (same file style: enum then interface, no runtime logic)
  - BondAssignedDelta pattern → BossDefeatedDelta (import types from shared-types)
  - OFFSET_SPIRIT_BOND in constants.ts → BOSS_PHASE2_HP_RATIO etc. (same `as const` style)
  - SimEvents in session.ts follows 'noun:verb' key, plain payload interface style
Owner agent: Protocol Architect (primary)
  Simulation Engineer: add boss: null to GameRoom.ts createEmptyGameState (1 line)
                       add boss: null to game-room-host-join.test.ts helper (1 line)
  QA + Telemetry Engineer: net-protocol.test.ts mockGameState update + 4 new tests
Goal: Define all boss entity types, run reward structures, wire message contracts, and
  applyDelta reducer cases in shared-types and net-protocol so Stories 6.2–6.5 can
  implement against a stable, type-safe interface. No game logic, no balance values,
  no host/mobile UI changes in this story.
Allowed paths:
  - packages/shared-types/src/boss.ts                          (NEW)
  - packages/shared-types/src/achievements.ts                  (NEW)
  - packages/shared-types/src/run-reward.ts                    (NEW)
  - packages/shared-types/src/constants.ts                     (MODIFY — 4 new constants)
  - packages/shared-types/src/session.ts                       (MODIFY — 2 new SimEvents entries)
  - packages/shared-types/src/game-state.ts                    (MODIFY — add boss field + import)
  - packages/shared-types/src/index.ts                         (MODIFY — export 3 new files)
  - packages/net-protocol/src/messages/server-to-host.ts       (MODIFY — 3 delta types + union + SnapshotMsg)
  - packages/net-protocol/src/messages/server-to-mobile.ts     (MODIFY — add RunVictoryMsg)
  - packages/net-protocol/src/apply-delta.ts                   (MODIFY — 3 new cases)
  - packages/net-protocol/src/event-names.ts                   (MODIFY — add RUN_VICTORY)
  - packages/net-protocol/src/index.ts                         (MODIFY — export new types)
  - tests/contract/net-protocol.test.ts                        (MODIFY — mockGameState + 4 tests)
  - apps/simulation-server/src/rooms/GameRoom.ts               (MODIFY — boss: null in createEmptyGameState)
  - apps/simulation-server/tests/game-room-host-join.test.ts   (MODIFY — boss: null in helper)
Blocked paths:
  - packages/game-rules/**          (boss AI + balance values — story 6.2)
  - apps/host-client/**             (rendering — story 6.3 and 6.4)
  - apps/mobile-controller/**       (mobile victory UX — story 6.4)
  - apps/backend-platform/**        (achievement persistence — story 6.5)
  - docs/adr/**                     (no ADR needed; boss entity is natural GameState extension)
Inputs:
  - Epic 6 Story 6.1 acceptance criteria (epics.md lines 1183–1233)
  - packages/shared-types/src/bond.ts (style reference for boss.ts)
  - packages/shared-types/src/constants.ts (current constants — extend, do not rewrite)
  - packages/shared-types/src/session.ts (SimEvents map — extend)
  - packages/shared-types/src/game-state.ts (add boss field + import)
  - packages/shared-types/src/index.ts (add 3 new exports)
  - packages/net-protocol/src/messages/server-to-host.ts (add delta types + DeltaEventMsg union entries)
  - packages/net-protocol/src/messages/server-to-mobile.ts (add RunVictoryMsg)
  - packages/net-protocol/src/apply-delta.ts (add 3 cases; preserve exhaustiveness guard)
  - packages/net-protocol/src/event-names.ts (add RUN_VICTORY)
  - packages/net-protocol/src/index.ts (add exports)
  - apps/simulation-server/src/rooms/GameRoom.ts (boss: null in createEmptyGameState at line ~43)
  - apps/simulation-server/tests/game-room-host-join.test.ts (boss: null in helper at line ~17)
  - tests/contract/net-protocol.test.ts (mockGameState + new describe blocks)
Non-goals:
  - Boss AI FSM, phase logic, behavior layers (story 6.2)
  - balance.ts constants for boss HP, phase thresholds, rewards (story 6.2)
  - Boss arena room definition and planck.js geometry (story 6.3)
  - Host boss HP bar, phase visual changes, or audio (story 6.3)
  - Purification pulse animation (story 6.4)
  - GameRoom.ts wiring of BossDefeatedDelta broadcast or RunVictoryMsg unicast (story 6.4)
  - Achievement tracking logic (story 6.5)
Acceptance criteria:
  AC1: packages/shared-types/src/boss.ts exports BossPhase enum (Phase1/Phase2/Phase3)
       and BossState interface per spec
  AC2: packages/shared-types/src/achievements.ts exports GrasslandAchievement enum
       (NoDeath/FastBoss/AllBondsActive/HardCleared/VigilHeld) and AchievementState interface
  AC3: packages/shared-types/src/run-reward.ts exports PlayerReward and RunReward interfaces
  AC4: constants.ts adds the 4 boss constants at the end of the file
  AC5: GameState.boss: BossState | null field added; all 3 createEmptyGameState/
       mockGameState call sites updated with boss: null
  AC6: SimEvents adds 'boss:phaseChanged' and 'boss:defeated' entries
  AC7: server-to-host.ts adds 3 delta types and extends DeltaEventMsg union;
       SnapshotMsg type is updated
  AC8: server-to-mobile.ts adds RunVictoryMsg
  AC9: event-names.ts adds RUN_VICTORY = 'run:victory'
  AC10: apply-delta.ts adds cases for the 3 new delta types without breaking
        the exhaustiveness guard
  AC11: net-protocol/index.ts exports all new types
  AC12: tests/contract/net-protocol.test.ts adds boss: null to mockGameState() and
        4 new round-trip describe blocks
  AC13: npm run typecheck (all workspaces) passes zero errors;
        npm test in tests/contract/ passes
Required hooks:
  - Contract-change hook: shared-types and net-protocol touched.
    Satisfied by: 4 new contract round-trip tests (AC12); story file + epics.md are spec;
    no ADR needed.
  - Simulation-safety hook: GameRoom.ts touched (mechanical, 1-line change).
    Satisfied by: typecheck passes; existing simulation-server tests still green.
Required tests:
  - BossDamagedDelta round-trip: serialize → deserialize produces identical value
  - BossPhaseChangedDelta round-trip: serialize → deserialize produces identical value
  - BossDefeatedDelta round-trip: serialize → deserialize with nested RunReward
  - RunVictoryMsg round-trip: serialize → deserialize produces identical value
  - mockGameState() in net-protocol.test.ts returns boss: null (implicit — TS enforces it)
Telemetry impact: None.
```

## Story

As a developer on the project,
I want the boss entity types, run reward structures, and wire message contracts defined in shared-types and net-protocol,
so that all agent roles can implement boss logic, host visualization, and reward sequencing against agreed-upon interfaces.

## Acceptance Criteria

1. **(AC1)** `packages/shared-types/src/boss.ts` (new file) exports:
   - `BossPhase` enum: `Phase1 = 1, Phase2 = 2, Phase3 = 3`
   - `BossState` interface: `{ id: string; entityType: 'grassland-boss'; hp: number; maxHp: number; phase: BossPhase; position: { x: number; y: number }; isDefeated: boolean; }`

2. **(AC2)** `packages/shared-types/src/achievements.ts` (new file) exports:
   - `GrasslandAchievement` enum: `NoDeath = 'no_death'`, `FastBoss = 'fast_boss'`, `AllBondsActive = 'all_bonds'`, `HardCleared = 'hard_cleared'`, `VigilHeld = 'vigil_held'`
   - `AchievementState` interface: `{ achievement: GrasslandAchievement; completed: boolean; }`

3. **(AC3)** `packages/shared-types/src/run-reward.ts` (new file) exports:
   - `PlayerReward` interface: `{ playerId: string; essence: number; masteryMilestones: string[]; }`
   - `RunReward` interface: `{ essenceTotal: number; perPlayer: PlayerReward[]; achievements: GrasslandAchievement[]; }`

4. **(AC4)** `packages/shared-types/src/constants.ts` gains 4 new exports appended after existing constants:
   - `BOSS_PHASE2_HP_RATIO = 0.6 as const`
   - `BOSS_PHASE3_HP_RATIO = 0.3 as const`
   - `PURIFICATION_PULSE_DURATION_MS = 1500 as const`
   - `BOSS_REWARD_ESSENCE_BASE = 200 as const`

5. **(AC5)** `GameState.boss: BossState | null` field is added (import `BossState` from `./boss.js`). All three `createEmptyGameState` / `mockGameState` call sites that construct a `GameState` literal are updated to include `boss: null`:
   - `apps/simulation-server/src/rooms/GameRoom.ts` — function at line 43
   - `apps/simulation-server/tests/game-room-host-join.test.ts` — helper at line 17
   - `tests/contract/net-protocol.test.ts` — `mockGameState()` at line 7

6. **(AC6)** `SimEvents` in `packages/shared-types/src/session.ts` gains two entries:
   - `'boss:phaseChanged': { bossId: string; newPhase: BossPhase }`
   - `'boss:defeated': { bossId: string; reward: RunReward }`

7. **(AC7)** `packages/net-protocol/src/messages/server-to-host.ts` adds:
   - `BossDamagedDelta`: `{ type: 'boss:damaged'; bossId: string; newHp: number; }`
   - `BossPhaseChangedDelta`: `{ type: 'boss:phaseChanged'; bossId: string; newPhase: BossPhase; }`
   - `BossDefeatedDelta`: `{ type: 'boss:defeated'; bossId: string; reward: RunReward; }`
   - All three are added to the `DeltaEventMsg` union
   - `SnapshotMsg` adds `boss: BossState | null` to its `state: GameState` property type (automatic via `GameState` update, but the import line must include `BossState` if used directly)

8. **(AC8)** `packages/net-protocol/src/messages/server-to-mobile.ts` adds:
   - `RunVictoryMsg`: `{ type: 'run:victory'; essenceEarned: number; }`

9. **(AC9)** `packages/net-protocol/src/event-names.ts` adds:
   - `RUN_VICTORY = 'run:victory'`

10. **(AC10)** `packages/net-protocol/src/apply-delta.ts` adds three new cases before the `default` exhaustiveness guard:
    - `'boss:damaged'`: guard `if (!state.boss) return state;` then return `{ ...state, boss: { ...state.boss, hp: evt.newHp } }`
    - `'boss:phaseChanged'`: guard then return `{ ...state, boss: { ...state.boss, phase: evt.newPhase } }`
    - `'boss:defeated'`: guard then return `{ ...state, boss: { ...state.boss, isDefeated: true } }` — **do NOT set `session.phase = 'post-run'` here**; that comes from `run:complete` delta (existing behaviour)
    - The `default: never` exhaustiveness guard must still compile with zero errors

11. **(AC11)** `packages/net-protocol/src/index.ts` exports:
    - `BossDamagedDelta`, `BossPhaseChangedDelta`, `BossDefeatedDelta` from server-to-host
    - `RunVictoryMsg` from server-to-mobile

12. **(AC12)** `tests/contract/net-protocol.test.ts` is updated:
    - `mockGameState()` return literal gains `boss: null`
    - New `describe('Story 6.1 boss delta round-trips', ...)` block with 4 `it` tests, one per new message type

13. **(AC13)** `npm run typecheck --workspaces` passes with zero TypeScript errors. `npm test` in `tests/contract/` passes all tests including the 4 new ones.

## Tasks / Subtasks

- [x] **Task 1: Create packages/shared-types/src/boss.ts** (AC: 1)
  - [x] Export `BossPhase` enum with Phase1=1, Phase2=2, Phase3=3
  - [x] Export `BossState` interface (id, entityType literal, hp, maxHp, phase, position, isDefeated)

- [x] **Task 2: Create packages/shared-types/src/achievements.ts** (AC: 2)
  - [x] Export `GrasslandAchievement` enum (5 string variants)
  - [x] Export `AchievementState` interface

- [x] **Task 3: Create packages/shared-types/src/run-reward.ts** (AC: 3)
  - [x] Export `PlayerReward` interface
  - [x] Export `RunReward` interface — imports `GrasslandAchievement` from `./achievements.js`

- [x] **Task 4: Update packages/shared-types/src/constants.ts** (AC: 4)
  - [x] Append the 4 boss constants after the OFFSET_SPIRIT_BOND block; preserve existing content exactly

- [x] **Task 5: Update packages/shared-types/src/game-state.ts** (AC: 5)
  - [x] Add `import type { BossState } from './boss.js';` at top
  - [x] Add `boss: BossState | null;` field to `GameState` interface

- [x] **Task 6: Update packages/shared-types/src/session.ts** (AC: 6)
  - [x] Add `import type { BossPhase } from './boss.js';` and `import type { RunReward } from './run-reward.js';`
  - [x] Add `'boss:phaseChanged'` and `'boss:defeated'` entries to `SimEvents`

- [x] **Task 7: Update packages/shared-types/src/index.ts** (AC: 5, 11)
  - [x] Add `export * from './boss.js';`
  - [x] Add `export * from './achievements.js';`
  - [x] Add `export * from './run-reward.js';`

- [x] **Task 8: Update packages/net-protocol/src/messages/server-to-host.ts** (AC: 7)
  - [x] Add imports: `BossPhase, BossState` from `shared-types` (join existing import line)
  - [x] Add `RunReward` to import from `shared-types`
  - [x] Add `BossDamagedDelta` type
  - [x] Add `BossPhaseChangedDelta` type
  - [x] Add `BossDefeatedDelta` type
  - [x] Add all three to `DeltaEventMsg` union
  - [x] `SnapshotMsg.state` already picks up the boss field via `GameState` — no change needed there

- [x] **Task 9: Update packages/net-protocol/src/messages/server-to-mobile.ts** (AC: 8)
  - [x] Add `RunVictoryMsg` interface

- [x] **Task 10: Update packages/net-protocol/src/event-names.ts** (AC: 9)
  - [x] Add `RUN_VICTORY = 'run:victory'` to EventNames enum

- [x] **Task 11: Update packages/net-protocol/src/apply-delta.ts** (AC: 10)
  - [x] Add `BossPhase` and `BossState` to import from `shared-types` (needed for `BossState` type guard)
  - [x] Add `'boss:damaged'` case before the `default` block
  - [x] Add `'boss:phaseChanged'` case
  - [x] Add `'boss:defeated'` case — mark isDefeated only; no session phase change
  - [x] Confirm `default: never` guard still compiles (TypeScript will error if a new variant is in the union but missing a case)

- [x] **Task 12: Update packages/net-protocol/src/index.ts** (AC: 11)
  - [x] Export `BossDamagedDelta`, `BossPhaseChangedDelta`, `BossDefeatedDelta` from server-to-host
  - [x] Export `RunVictoryMsg` from server-to-mobile

- [x] **Task 13: Update all GameState construction sites** (AC: 5)
  - [x] `apps/simulation-server/src/rooms/GameRoom.ts` — add `boss: null,` after `runProposal: null,` in `createEmptyGameState`
  - [x] `apps/simulation-server/tests/game-room-host-join.test.ts` — add `boss: null,` in the helper
  - [x] `tests/contract/net-protocol.test.ts` — add `boss: null,` to `mockGameState()` return object

- [x] **Task 14: Add contract tests** (AC: 12)
  - [x] Add `import type { BossDefeatedDelta, BossPhaseChangedDelta, BossDamagedDelta, RunVictoryMsg } from 'net-protocol';` (or use the combined import)
  - [x] Add `import type { BossPhase, RunReward } from 'shared-types';` imports
  - [x] Add `import { BossPhase } from 'shared-types';` for enum values
  - [x] Add `describe('Story 6.1 boss delta round-trips', () => { ... })` with 4 it blocks

- [x] **Task 15: Typecheck and test** (AC: 13)
  - [x] `npm run typecheck --workspaces` — zero errors
  - [x] `npm test` in `tests/contract/` — all tests pass including the 4 new ones

## Dev Notes

### Critical: exhaustiveness guard in apply-delta.ts

`apply-delta.ts` line 158–163 has:
```typescript
default: {
  const _exhaustive: never = evt;
  void _exhaustive;
  return state;
}
```
Adding `BossDamagedDelta | BossPhaseChangedDelta | BossDefeatedDelta` to `DeltaEventMsg` without adding `case 'boss:damaged':` etc. will cause a TypeScript compile error (`Type 'BossDamagedDelta' is not assignable to type 'never'`). All 3 new cases MUST be added.

### Critical: boss:defeated does NOT set session phase

`applyDelta` `'boss:defeated'` must only set `boss.isDefeated = true`. It must **not** set `session.phase = 'post-run'`. That transition happens when `run:complete` delta arrives (existing `'run:complete'` case in apply-delta.ts line 149). The boss defeat and run completion are two separate events — the host renders the purification pulse between them (Story 6.4). Setting phase eagerly on `boss:defeated` would cause the host to skip the purification sequence.

### Critical: boss null guard pattern

`GameState.boss` is `BossState | null`. All three apply-delta cases must guard:
```typescript
case 'boss:damaged': {
  if (!state.boss) return state;  // same reference — no GameState for non-boss levels
  return { ...state, boss: { ...state.boss, hp: evt.newHp } };
}
```
This matches the `if (!state.players.some(...)) return state;` pattern used throughout apply-delta.ts.

### BossPhase enum values

Use numeric values `Phase1 = 1, Phase2 = 2, Phase3 = 3` (not string variants). Numeric enums serialize cleanly to JSON and are safe to compare with `===`. String enums would require the `as const` serialization trick. All other enums in shared-types use string values (BondType, PlayerClass) — but BossPhase is distinct: it's an ordered progression, and numeric ordering matters to the boss FSM (Story 6.2 needs `boss.phase < BossPhase.Phase3` comparisons).

### GameState field ordering

Add `boss: BossState | null;` at the end of `GameState` interface (after `runProposal`) to minimize diff size and follow the existing "append" pattern used for `activeBonds`, `essenceDrops`, `floorLayout`, and `runProposal` additions in prior stories.

### RunReward nesting

`BossDefeatedDelta.reward` embeds a `RunReward` object. The serialize/deserialize round-trip test must construct a realistic nested value:
```typescript
const reward: RunReward = {
  essenceTotal: 420,
  perPlayer: [{ playerId: 'p1', essence: 210, masteryMilestones: [] }],
  achievements: [GrasslandAchievement.HardCleared],
};
```
This tests that enum values survive JSON round-trip correctly.

### RunVictoryMsg channel

`RunVictoryMsg` is a unicast server-to-mobile message sent on `EventNames.RUN_VICTORY = 'run:victory'`. The mobile controller will listen on this channel in Story 6.4. No mobile changes in this story — just add the type and the EventNames entry.

### Pre-existing bug note (do not fix)

`GameRoom.ts` line ~775: `if (index >= 4)` loads the boss placeholder. This is wrong — the boss level is index 3 (0-indexed). Story 6.3 will fix this when implementing the real boss arena. Do not touch this condition in Story 6.1.

### File structure for new files

```
packages/shared-types/src/
  boss.ts           ← NEW
  achievements.ts   ← NEW
  run-reward.ts     ← NEW
```

All three follow the same style as `bond.ts`: import only what is needed from other files in the package, export only interfaces and enums, zero runtime logic.

### Project Structure Notes

- New files follow the existing `packages/shared-types/src/` pattern: kebab-case filenames, `.js` extensions in import paths (ESM with TypeScript)
- `run-reward.ts` imports from `./achievements.js` for the `GrasslandAchievement` type
- `session.ts` imports from both `./boss.js` and `./run-reward.js` for SimEvents payload types
- `server-to-host.ts` extends the existing `import type { ..., BondType, ... } from 'shared-types';` line — add `BossPhase`, `BossState`, `RunReward` to the same import

### Project Context Rules

- **Authority model**: `packages/shared-types` and `packages/net-protocol` are Protocol Architect territory. The two mechanical 1-line changes in `apps/simulation-server` are explicitly cross-boundary but sanctioned (same pattern as Story 5.1 which modified `GameRoom.ts` for the `bonds → activeBonds` rename). No gameplay logic is added.
- **No `Math.random()` or game rules here**: This story is pure types. No logic, no PRNG, no planck.js.
- **TypeScript strict mode**: All new interfaces must be clean under `"strict": true`. No `any`.
- **ESM imports in TypeScript**: All intra-package imports use `.js` extension (e.g., `from './boss.js'` not `from './boss'`). See existing `bond.ts`, `game-state.ts` for the pattern.
- **Enum string values**: `GrasslandAchievement` uses string values (`'no_death'` etc.) for JSON serialization transparency. `BossPhase` uses numeric values for ordered-comparison semantics.
- **`as const` for number constants**: Follow the existing pattern in `constants.ts` — all new constants must use `= N as const`.

### References

- Epic 6 Story 6.1 acceptance criteria: `_bmad-output/planning-artifacts/epics.md` lines 1183–1233
- bond.ts style reference: `packages/shared-types/src/bond.ts`
- Exhaustiveness guard: `packages/net-protocol/src/apply-delta.ts` lines 158–163
- SimEvents pattern: `packages/shared-types/src/session.ts` lines 23–28
- constants.ts pattern: `packages/shared-types/src/constants.ts` (full file)
- Existing GameState construction: `apps/simulation-server/src/rooms/GameRoom.ts` lines 43–62
- Contract test style: `tests/contract/net-protocol.test.ts` — `describe('Story 5.1 bond contract round-trips'...)` block at lines 515–567

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

All 15 tasks complete. Pure types story — no game logic, no balance values. 3 new shared-types files (boss.ts, achievements.ts, run-reward.ts), 9 modified files, 4 new contract round-trip tests. Exhaustiveness guard in apply-delta.ts preserved and compiles clean. All 5 TypeScript configs (shared-types, net-protocol, simulation-server, host-client, mobile-controller) pass zero errors. Contract + sim-server tests all green (e2e failures are pre-existing WSL2 port-conflict, unrelated).

### File List

- packages/shared-types/src/boss.ts (new)
- packages/shared-types/src/achievements.ts (new)
- packages/shared-types/src/run-reward.ts (new)
- packages/shared-types/src/constants.ts
- packages/shared-types/src/game-state.ts
- packages/shared-types/src/session.ts
- packages/shared-types/src/index.ts
- packages/net-protocol/src/messages/server-to-host.ts
- packages/net-protocol/src/messages/server-to-mobile.ts
- packages/net-protocol/src/event-names.ts
- packages/net-protocol/src/apply-delta.ts
- packages/net-protocol/src/index.ts
- apps/simulation-server/src/rooms/GameRoom.ts
- apps/simulation-server/tests/game-room-host-join.test.ts
- tests/contract/net-protocol.test.ts

### Review Findings

- [x] [Review][Defer] `boss:defeated` carries `RunReward` not persisted to `GameState` [packages/net-protocol/src/apply-delta.ts] — deferred, spec AC10 prescribes only `isDefeated:true`; host reads reward from raw event. Story 6.4 must decide: raw-event pattern (ephemeral) vs. add `runReward: RunReward | null` to GameState (reconnect-safe).
- [x] [Review][Defer] Out-of-range `BossPhase` value passes deserialization silently [packages/net-protocol/src/serialize.ts] — deferred, no runtime validation anywhere in protocol stack (cross-cutting concern; see D8 from 1-1 review). Address in Phase 5 schema hardening.
- [x] [Review][Defer] `reviveTimerExpiresAt: Date.now() + reviveWindowMs` evaluated on client creates clock-skew error [packages/net-protocol/src/apply-delta.ts:65] — deferred, pre-existing bug not introduced by story 6.1. Server should send absolute timestamp; fix in dedicated delta hardening story.
- [x] [Review][Defer] `masteryMilestones: string[]` unbounded, no max-length cap [packages/shared-types/src/run-reward.ts] — deferred, out of scope for types-only story. Define cap when milestone generation is implemented in story 6.5+.

## Change Log

- 2026-07-05: Code review complete — 0 patch, 0 decision_needed, 4 deferred, 7 dismissed. Story marked done.
- 2026-07-04: Story 6.1 implemented — boss types, achievement types, run reward types, protocol contracts, apply-delta cases, 4 contract tests. All ACs satisfied.

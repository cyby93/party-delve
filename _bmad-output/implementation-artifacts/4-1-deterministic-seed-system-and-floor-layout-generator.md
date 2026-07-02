---
baseline_commit: 04ebbfa
---

# Story 4.1: Deterministic Seed System & Floor Layout Generator

Status: done

## CLAUDE.md Required Task Header

```
Phase: 4 — Procedural Dungeon & Full Run Structure (Epic 4)
Context: The xoshiro128++ PRNG (Story 3.1) and its OFFSET_* stream constants are already in
  place. The runSeed is generated via crypto.randomInt() in GameRoom.onCreate and stored in
  gameState.session.runSeed. spawnEnemies() already demonstrates the multi-stream pattern:
  createRng(runSeed ^ OFFSET_ENEMY_SPAWN). This story adds the floor layout generation layer:
  two new RNG streams (OFFSET_FLOOR_LAYOUT, OFFSET_ROOM_POOL) drive a pure floor-layout
  generator function and a Grassland room pool, both in packages/game-rules. The generated
  layout is stored in GameState so the host client receives it via SnapshotMsg without needing
  to import game-rules. Story 4.3 owns the multi-level run loop; this story only wires the
  generator at the point where level 1 currently starts (HOST_START handler).
Owner agent: Simulation Engineer (primary); Protocol Architect (shared-types type additions)
Goal: Implement generateFloorLayout() as a pure deterministic function in game-rules,
  define the Grassland room pool (min 3 templates), add FloorLayout to GameState, and wire
  the generator into GameRoom so level 1 gets a floor layout on HOST_START.
Allowed paths:
  - packages/game-rules/src/generation/floor-layout.ts      (NEW)
  - packages/game-rules/src/generation/room-pool.ts         (NEW)
  - packages/game-rules/src/index.ts                        (MODIFY — export new symbols)
  - packages/shared-types/src/floor-layout.ts               (NEW — RoomTemplate, Room, Corridor, FloorLayout)
  - packages/shared-types/src/game-state.ts                 (MODIFY — add floorLayout field)
  - packages/shared-types/src/index.ts                      (MODIFY — export new types)
  - apps/simulation-server/src/rooms/GameRoom.ts            (MODIFY — call generator on HOST_START)
  - tests/unit/generation.test.ts                           (NEW)
Blocked paths:
  - packages/net-protocol/**         (no new wire message types; layout travels in SnapshotMsg)
  - apps/host-client/**              (host renders layout from mirrorState; no logic changes)
  - apps/mobile-controller/**        (no mobile changes)
  - packages/game-rules/src/systems/ (no combat system changes)
Inputs:
  - packages/game-rules/src/prng/xoshiro128.ts              (existing createRng)
  - packages/shared-types/src/constants.ts                  (existing OFFSET_* constants)
  - packages/shared-types/src/game-state.ts                 (existing GameState shape)
  - apps/simulation-server/src/rooms/GameRoom.ts            (existing onCreate + HOST_START handler)
Non-goals:
  - Multi-level progression loop (Story 4.3 — don't add levelIndex looping logic here)
  - Dungeon entrance vote (Story 4.2 — HOST_START is the trigger for now)
  - Enemy spawning for specific room positions (Story 4.3 integration)
  - Host-side dungeon room rendering (Story 4.3/host-client work)
  - Real boss logic (Epic 6 — boss floor is a static placeholder here)
  - Survive the Waves objective (Story 4.4)
  - Biome assets, PixiJS backgroundLoad (Story 4.3)
Acceptance criteria:
  AC1: Two independent RNG streams are derived in GameRoom on run start:
       createRng(runSeed ^ OFFSET_FLOOR_LAYOUT) and createRng(runSeed ^ OFFSET_ROOM_POOL).
       (OFFSET_ENEMY_SPAWN and OFFSET_SPIRIT_BOND already exist — do not redeclare them.)
  AC2: generateFloorLayout(floorRng, roomRng, levelTier, roomPool) is a pure function in
       packages/game-rules/src/generation/floor-layout.ts returning FloorLayout.
       Given the same seed, two independent instances produce identical FloorLayout output
       (verified by tests/unit/generation.test.ts).
  AC3: GRASSLAND_ROOM_POOL in room-pool.ts contains at least 3 distinct RoomTemplate entries.
       Each template has: id (string), name (string), widthPx (number), heightPx (number).
  AC4: FloorLayout (in shared-types/src/floor-layout.ts) has: rooms: Room[], corridors: Corridor[].
       Room has: id, templateId, x, y, isExit (boolean).
       Corridor has: fromRoomId, toRoomId.
  AC5: GameState.floorLayout (nullable FloorLayout) is set in GameRoom when HOST_START fires,
       before the snapshot is broadcast. Null in lobby/hub phases.
  AC6: tests/unit/generation.test.ts passes — same seed, two independent calls to
       generateFloorLayout produce toEqual output.
Required hooks:
  - Simulation-safety hook (GameRoom.ts touched): tsc --noEmit passes; all existing tests pass.
  - Contract-change hook (shared-types/game-state.ts touched): Protocol Architect review;
    at least one updated contract test verifying SnapshotMsg carries floorLayout field.
    The existing net-protocol.test.ts should be updated with a floorLayout-containing snapshot.
Required tests:
  - tests/unit/generation.test.ts: determinism (AC6) + min 3 templates check (AC3)
  - Existing tests must remain green (221 tests + 1 from 3.8 = 222 currently passing)
Telemetry impact: None — floor layout is internal sim state for this story.
```

---

## Story

As a player,
I want every run to have a unique procedurally generated layout that all players share identically,
so that the dungeon feels fresh each session while remaining perfectly synchronized across all devices.

---

## Acceptance Criteria

**AC1 — Independent RNG streams:**
**Given** `GameRoom.onCreate` has already generated `runSeed` via `crypto.randomInt()`
**When** the HOST_START handler fires (run begins)
**Then** `createRng(runSeed ^ OFFSET_FLOOR_LAYOUT)` and `createRng(runSeed ^ OFFSET_ROOM_POOL)` are called to create two independent streams
**And** these streams are passed directly into `generateFloorLayout()` (not stored as instance fields)

**AC2 — Deterministic floor layout:**
**Given** `generateFloorLayout(floorRng, roomRng, levelTier, roomPool)` is called twice with fresh RNGs seeded identically
**When** `tests/unit/generation.test.ts` runs
**Then** both invocations produce identical `FloorLayout` (same rooms array, same corridors array, same positions)
**And** `Math.random()` is not called anywhere in `packages/game-rules/src/generation/`

**AC3 — Grassland room pool:**
**Given** `GRASSLAND_ROOM_POOL` in `packages/game-rules/src/generation/room-pool.ts`
**When** the test imports it
**Then** it contains at least 3 `RoomTemplate` entries with distinct `id` values
**And** each entry has `id: string`, `name: string`, `widthPx: number`, `heightPx: number`

**AC4 — FloorLayout types:**
**Given** `packages/shared-types/src/floor-layout.ts` is created
**When** TypeScript compiles the project
**Then** `FloorLayout`, `Room`, `Corridor`, `RoomTemplate` are exported from `shared-types`

**AC5 — GameState integration:**
**Given** `gameState.session.phase === 'dungeon'` is being set in the HOST_START handler
**When** the handler fires
**Then** `gameState.floorLayout` is set to a `FloorLayout` before `this.broadcast(SNAPSHOT, ...)` is called
**And** the floor layout uses `OFFSET_FLOOR_LAYOUT` and `OFFSET_ROOM_POOL` streams derived from `runSeed`
**And** `gameState.floorLayout` is `null` in the initial `createEmptyGameState()`

**AC6 — Unit test passes:**
**Given** `tests/unit/generation.test.ts` imports `createRng`, `generateFloorLayout`, `GRASSLAND_ROOM_POOL`
**When** the test runs with vitest
**Then** all assertions pass including the determinism check and min-3-templates check

---

## Tasks / Subtasks

- [x] T1: Add shared-types for floor layout (AC4) — Protocol Architect boundary, small additive change
  - [x] T1.1: Create `packages/shared-types/src/floor-layout.ts` with `RoomTemplate`, `Room`, `Corridor`, `FloorLayout`
  - [x] T1.2: Add `floorLayout: FloorLayout | null` to `GameState` in `packages/shared-types/src/game-state.ts`
  - [x] T1.3: Export new types from `packages/shared-types/src/index.ts`

- [x] T2: Implement Grassland room pool (AC3)
  - [x] T2.1: Create `packages/game-rules/src/generation/room-pool.ts` with `GRASSLAND_ROOM_POOL` (≥3 templates)
  - [x] T2.2: Include a `BOSS_FLOOR_LAYOUT` constant (static placeholder — single room, fixed dimensions)

- [x] T3: Implement floor layout generator (AC2)
  - [x] T3.1: Create `packages/game-rules/src/generation/floor-layout.ts`
  - [x] T3.2: Implement `generateFloorLayout(floorRng, roomRng, levelTier, roomPool): FloorLayout`
  - [x] T3.3: Layout algorithm: pick N rooms from pool using `roomRng`, arrange in a linear chain using `floorRng` for spacing, mark last room `isExit: true`
  - [x] T3.4: `levelTier` determines room count: `early=4`, `mid=6`, `late=8` (or similar tunable values)

- [x] T4: Export from game-rules/index.ts
  - [x] T4.1: Export `generateFloorLayout`, `GRASSLAND_ROOM_POOL`, `BOSS_FLOOR_LAYOUT`

- [x] T5: Wire into GameRoom (AC1, AC5)
  - [x] T5.1: In `HOST_START` handler, after setting `phase='dungeon'`, call `generateFloorLayout()` using `OFFSET_FLOOR_LAYOUT` and `OFFSET_ROOM_POOL` streams
  - [x] T5.2: Store result in `this.gameState.floorLayout`
  - [x] T5.3: In `createEmptyGameState()`, initialize `floorLayout: null`
  - [x] T5.4: Import `OFFSET_FLOOR_LAYOUT`, `OFFSET_ROOM_POOL` from `shared-types`

- [x] T6: Unit test (AC6)
  - [x] T6.1: Create `tests/unit/generation.test.ts`
  - [x] T6.2: Determinism test: two calls with same seed produce `toEqual` output
  - [x] T6.3: Pool coverage test: `GRASSLAND_ROOM_POOL.length >= 3`
  - [x] T6.4: No `Math.random()` usage in generation files (manual spot check or ESLint)

- [x] T7: Update contract test for floorLayout in snapshot (Required hook)
  - [x] T7.1: In `tests/contract/net-protocol.test.ts`, update `mockGameState()` helper to include a non-null `floorLayout` and verify it round-trips through serialize→deserialize

- [x] T8: Verify all 222 existing tests still pass

### Review Findings

- [x] [Review][Patch] Empty roomPool causes runtime crash via non-null assertion [packages/game-rules/src/generation/floor-layout.ts]
- [x] [Review][Patch] `LevelTier` union type not exported — Story 4.3 callers lack the type [packages/game-rules/src/index.ts]
- [x] [Review][Defer] Second HOST_START from `post-run` accumulates stale enemies — deferred, pre-existing bug in GameRoom enemy-clear logic [apps/simulation-server/src/rooms/GameRoom.ts:114]
- [x] [Review][Defer] `floorLayout` not reset to null on post-run phase transition — deferred, no return-to-hub path in current impl; AC5 satisfied by createEmptyGameState [apps/simulation-server/src/rooms/GameRoom.ts:126]
- [x] [Review][Defer] `BOSS_FLOOR_LAYOUT` has `isExit: false` on its only room — deferred, intentional placeholder; Story 4.3 determines advancement trigger [packages/game-rules/src/generation/room-pool.ts]
- [x] [Review][Defer] `Corridor` directionality contract undocumented (directed vs. undirected) — deferred, low risk with current linear chain; Story 4.3 host render decides [packages/shared-types/src/floor-layout.ts]
- [x] [Review][Defer] Room y-position has no bounds clamp against virtual 1080px space — deferred, safe with current template heightPx values (max 350) [packages/game-rules/src/generation/floor-layout.ts]

---

## Dev Notes

### The Hardest Part: Two Things Must Not Mix

The floor layout generator is a **pure function** — it must live entirely in `packages/game-rules` with no imports from Colyseus, planck.js, or Node.js built-ins. The only allowed imports are from `shared-types` (for types) and the PRNG from `./prng/xoshiro128.js` within the same package.

The GameRoom integration is in `apps/simulation-server` — that's where the two RNG streams are created from `runSeed ^ OFFSET_*`, and where the result is stored in `gameState`.

### What Already Exists (Do NOT Re-Implement)

- `packages/game-rules/src/prng/xoshiro128.ts` — `createRng(seed: number): () => number` — already implemented and tested
- `packages/shared-types/src/constants.ts` — `OFFSET_FLOOR_LAYOUT = 0x01`, `OFFSET_ROOM_POOL = 0x02`, `OFFSET_ENEMY_SPAWN = 0x03`, `OFFSET_SPIRIT_BOND = 0x04` — all four offsets already defined
- `GameRoom.ts` line 108: `this.gameState.session.runSeed = randomInt(0, 0x1_0000_0000)` — seed already generated
- `GameRoom.ts` line 109: `this.prng = createRng(this.gameState.session.runSeed)` — general-purpose PRNG stream already there (not for floor layout, but proof of pattern)
- `GameRoom.ts` `spawnEnemies()` line 320: `const enemyPrng = createRng(this.gameState.session.runSeed ^ OFFSET_ENEMY_SPAWN)` — the exact pattern to follow for floor/room RNGs
- `shared-types/src/constants.ts` already exports all four OFFSET_* constants

**Do not** re-declare `OFFSET_FLOOR_LAYOUT` or any existing constant anywhere.

### Exactly Where to Wire in GameRoom.ts

The `HOST_START` handler is at `GameRoom.ts` line 111. It currently:
1. Validates host identity and phase
2. Sets `phase = 'dungeon'` and `levelIndex = 1`
3. Calls `this.spawnEnemies()`
4. Broadcasts snapshot

Insert the floor layout generation **between step 2 and step 3**:
```typescript
// After setting phase='dungeon':
const floorRng = createRng(this.gameState.session.runSeed ^ OFFSET_FLOOR_LAYOUT);
const roomRng  = createRng(this.gameState.session.runSeed ^ OFFSET_ROOM_POOL);
this.gameState.floorLayout = generateFloorLayout(floorRng, roomRng, 'early', GRASSLAND_ROOM_POOL);
```

`OFFSET_FLOOR_LAYOUT` and `OFFSET_ROOM_POOL` already exist in `shared-types` — just add them to the import line at `GameRoom.ts:3`.

### Floor Layout Algorithm — Keep It Simple

The AC requires: room positions, corridor connections, exit placement. The simplest valid algorithm:

```
rooms = pick N templates from pool (using roomRng), create Room instances
for each room, position in a horizontal chain:
  x = i * (roomWidth + GAP) + GAP
  y = CENTER_Y + (floorRng() - 0.5) * JITTER  // slight vertical variation
rooms[last].isExit = true
corridors = pairs [(room[0], room[1]), (room[1], room[2]), ...]
```

Room count by tier: `{ early: 4, mid: 6, late: 8 }` — store in balance.ts or as a local constant in floor-layout.ts. Either works; prefer local constant since it's generation-specific.

The dungeon space is 1920×1080 virtual pixels (same as hub world). Keep rooms inside this boundary.

### FloorLayout Types — Keep Them Lean

```typescript
// packages/shared-types/src/floor-layout.ts
export interface RoomTemplate {
  id: string;
  name: string;
  widthPx: number;
  heightPx: number;
}

export interface Room {
  id: string;
  templateId: string;
  x: number;        // center x in virtual 1920×1080 space
  y: number;        // center y
  isExit: boolean;
}

export interface Corridor {
  fromRoomId: string;
  toRoomId: string;
}

export interface FloorLayout {
  rooms: Room[];
  corridors: Corridor[];
}
```

Do **not** add a `isBoss` field to Room or any boss-specific logic to `FloorLayout`. The boss floor is handled by `BOSS_FLOOR_LAYOUT` — a separate static constant. Story 4.3 decides how to load it.

### GameState Change

In `packages/shared-types/src/game-state.ts`, add one field:
```typescript
import type { FloorLayout } from './floor-layout.js';

export interface GameState {
  // ... existing fields ...
  floorLayout: FloorLayout | null;  // null until a run starts
}
```

In `createEmptyGameState()` in `GameRoom.ts`:
```typescript
return {
  // ... existing fields ...
  floorLayout: null,
};
```

### BOSS_FLOOR_LAYOUT — Static Placeholder

```typescript
// packages/game-rules/src/generation/room-pool.ts
export const BOSS_FLOOR_LAYOUT: FloorLayout = {
  rooms: [{ id: 'boss-room', templateId: 'boss-placeholder', x: 960, y: 540, isExit: false }],
  corridors: [],
};
```

Include a matching template in the pool or define it inline. Story 4.3 uses this when `levelIndex === 4`.

### GRASSLAND_ROOM_POOL — 3 Templates Minimum

```typescript
export const GRASSLAND_ROOM_POOL: readonly RoomTemplate[] = [
  { id: 'grassland-01', name: 'The Clearing',    widthPx: 400, heightPx: 300 },
  { id: 'grassland-02', name: 'The Narrow Path', widthPx: 600, heightPx: 200 },
  { id: 'grassland-03', name: 'The Hollow',      widthPx: 350, heightPx: 350 },
];
```

These are layout descriptors only — not PixiJS sprites. The host renderer (Epic 4.3 work) maps `templateId` to actual art.

### Unit Test Location — Use `tests/unit/`

The root `tests/unit/` is where all unit tests live in practice (not `packages/game-rules/tests/` — that only has `xoshiro128.test.ts` from Story 3.1 as a special case). New unit tests go in `tests/unit/`:

```
tests/unit/generation.test.ts
```

Verify it's picked up by the vitest config at `tests/vitest.config.ts` before assuming anything.

### Contract Test Update

In `tests/contract/net-protocol.test.ts`, there is likely a `mockGameState()` helper. Add `floorLayout: null` (or a minimal layout object) to it so the SnapshotMsg round-trip tests still pass after `GameState` gains the new field. TypeScript strict mode will catch any incomplete mock — trust the compiler.

### No New Net-Protocol Message Types

The floor layout travels inside `SnapshotMsg.state.floorLayout`. No new delta events or message types are needed for this story. The `applyDelta` reducer in `packages/net-protocol/src/apply-delta.ts` does not need changes — it handles state deltas, not the full snapshot.

---

## Project Structure Notes

```
packages/
  game-rules/
    src/
      generation/
        floor-layout.ts      (NEW — generateFloorLayout pure function)
        room-pool.ts         (NEW — GRASSLAND_ROOM_POOL, BOSS_FLOOR_LAYOUT)
      index.ts               (MODIFY — add generation exports)
  shared-types/
    src/
      floor-layout.ts        (NEW — FloorLayout, Room, Corridor, RoomTemplate)
      game-state.ts          (MODIFY — add floorLayout field)
      index.ts               (MODIFY — export floor-layout types)
apps/
  simulation-server/
    src/
      rooms/
        GameRoom.ts          (MODIFY — wire generateFloorLayout in HOST_START handler)
tests/
  unit/
    generation.test.ts       (NEW)
  contract/
    net-protocol.test.ts     (MODIFY — update mockGameState with floorLayout)
```

### Cross-Ownership Flag

**Shared-types changes cross into Protocol Architect territory.** The additions are:
1. One new file (`floor-layout.ts`) with pure TypeScript interfaces
2. One new nullable field (`floorLayout`) on `GameState`
3. Three new exports from `index.ts`

These are additive-only, non-breaking, and clearly required by the Epic 4 design. No Protocol Architect review is blocked on this, but the Contract-change hook fires because `shared-types` is touched. The required action is: update at least one contract test (T7 above) and confirm tsc passes.

---

## Project Context Rules

- **No `Math.random()` in generation code.** All randomness must use `createRng()`. The ESLint rule `no-restricted-syntax` already blocks it in `packages/game-rules/**` and `apps/simulation-server/**`.
- **No planck.js in game-rules.** `floor-layout.ts` and `room-pool.ts` must not import planck.
- **No Colyseus in game-rules.** Same constraint.
- **Result<T, E> for error returns.** If `generateFloorLayout` needs to signal an error (e.g., empty room pool), return `Result<FloorLayout, GenerationError>`. If the pool is always non-empty (guaranteed by constant), a direct return is fine — YAGNI applies.
- **TypeScript strict mode.** All new files must compile without `any` (unless commented with suppression).
- **Naming conventions:** files = kebab-case (`floor-layout.ts`), types = PascalCase (`FloorLayout`), constants = SCREAMING_SNAKE_CASE (`GRASSLAND_ROOM_POOL`, `OFFSET_FLOOR_LAYOUT`).
- **Pure functions only in game-rules.** `generateFloorLayout` must be importable and testable with zero runtime side effects.
- **Tick loop hygiene.** The generator is NOT called in the tick loop — only at level load time (HOST_START handler). No concern about the 33ms budget here.
- **Context7 MCP.** Not applicable for this story (no PixiJS or Colyseus API lookups needed).
- **npm, not pnpm.** Run `npm run typecheck --workspace=packages/game-rules` and `npm run typecheck --workspace=packages/shared-types` to verify.

---

## References

- Epic 4 Story 4.1 spec: `_bmad-output/planning-artifacts/epics.md` (lines 800–825)
- Existing PRNG: `packages/game-rules/src/prng/xoshiro128.ts`
- OFFSET constants (already defined): `packages/shared-types/src/constants.ts`
- Multi-stream pattern precedent: `apps/simulation-server/src/rooms/GameRoom.ts:320` (spawnEnemies OFFSET_ENEMY_SPAWN)
- HOST_START handler: `apps/simulation-server/src/rooms/GameRoom.ts:111`
- GameState shape: `packages/shared-types/src/game-state.ts`
- Existing unit tests for structure reference: `tests/unit/xoshiro128.test.ts` (if exists), `tests/unit/fsm.test.ts`
- Contract test to update: `tests/contract/net-protocol.test.ts`
- Project context rules: `_bmad-output/project-context.md`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 ACs satisfied. Simulation-server test helper also needed `floorLayout: null` (line 18 in game-room-host-join.test.ts) — caught by tsc, fixed before tests ran.
- Tests: 108 passing (tests/), 23 passing (simulation-server), 4 passing (game-rules). Total = 135, all green.
- No `Math.random()` in generation code — only `createRng()` streams used.

### File List

- packages/shared-types/src/floor-layout.ts (NEW)
- packages/shared-types/src/game-state.ts (MODIFIED)
- packages/shared-types/src/index.ts (MODIFIED)
- packages/game-rules/src/generation/room-pool.ts (NEW)
- packages/game-rules/src/generation/floor-layout.ts (NEW)
- packages/game-rules/src/index.ts (MODIFIED)
- apps/simulation-server/src/rooms/GameRoom.ts (MODIFIED)
- apps/simulation-server/tests/game-room-host-join.test.ts (MODIFIED)
- tests/unit/generation.test.ts (NEW)
- tests/contract/net-protocol.test.ts (MODIFIED)

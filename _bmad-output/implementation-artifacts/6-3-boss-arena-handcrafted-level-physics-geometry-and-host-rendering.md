---
baseline_commit: 23b8a4e
---

# Story 6.3: Boss Arena — Handcrafted Level Physics Geometry & Host Rendering

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.3 — arena geometry, GameRoom wiring, host rendering)
Context: Stories 6.1 AND 6.2 MUST be complete before implementing this story.
  6.1 provides: BossState, BossPhase, BossFSMState, RunReward types in shared-types;
               BossPhaseChangedDelta, BossDefeatedDelta, BossDamagedDelta in net-protocol;
               apply-delta.ts cases for boss:phase-changed, boss:defeated, boss:damaged;
               BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO, BOSS_REWARD_ESSENCE_BASE in constants.ts.
  6.2 provides: createBossState(runSeed), tickBoss(boss, state, difficulty, spawnPoints), BossEvent
               union, BossAddSpawnedEvent from packages/game-rules/src/entities/grassland-boss.ts;
               all BOSS_* balance constants in packages/game-rules/src/balance.ts;
               EnemyType.GRASSLAND_ADD in packages/shared-types/src/enemy.ts.

  Codebase state entering this story:
  - apps/simulation-server/src/levels/: DOES NOT EXIST — create it
  - apps/simulation-server/src/rooms/GameRoom.ts: has a boss placeholder at `if (index >= 4)` that
    creates a victory trigger sensor; this story REPLACES that branch with real boss arena setup
    and wires tickBoss into the tick loop
  - LEVEL INDEX DISCREPANCY (MUST INVESTIGATE — see Dev Notes): The placeholder uses `index >= 4`,
    which implies the run sequence is levels 1→2→3 (dungeon) then 4 (boss). The epics spec says
    "boss level (index 3)". Check startRun() → loadLevel() call to determine the actual first-level
    index; the fix must be consistent across loadLevel(), enterBondMoment(), and startRun().
  - packages/net-protocol/src/messages/server-to-host.ts: has BossPhaseChangedDelta,
    BossDefeatedDelta, BossDamagedDelta from 6.1 but is MISSING BossMovedDelta, BossStompedDelta,
    BossAddSpawnedDelta — this story adds all three and adds them to DeltaEventMsg union
  - packages/net-protocol/src/apply-delta.ts: has cases for boss:phase-changed, boss:defeated,
    boss:damaged from 6.1; needs boss:moved and add:spawned cases
  - apps/host-client/src/screens/DungeonScreen.tsx: renders players, enemies, bond tethers,
    essence flashes, revive timers — no boss rendering; this story adds boss sprite, HP bar,
    phase visuals, stomp warning ring, and floating damage number

  Patterns to follow:
  - createVictoryTriggerBody in world.ts → loadBossArena in boss-arena.ts (same World-mutating
    pattern; export standalone function, no class)
  - createEnemyBody in world.ts → boss body creation inline in GameRoom.loadLevel()
    (boss body is unique; no need for a shared factory for one product)
  - EnemyMovedDelta / EnemyStompedDelta shape → BossMovedDelta / BossStompedDelta (structural match)
  - pendingVictoryContact pattern in GameRoom → pendingBossStompEvents[] (1-tick delay array)
  - revive timer overlay in DungeonScreen (React DOM div) → boss HP bar (same React overlay pattern)
  - enemy circle Graphics in renderFrame → boss circle Graphics via bossGraphicsRef (same PixiJS pattern)

Owner agent: Host Experience Engineer (arena physics geometry + host rendering),
  Simulation Engineer (GameRoom wiring + boss-arena.ts physics)
  NOTE: This story crosses two ownership areas. Split the work if two agents are available —
  the sim-side (boss-arena.ts + GameRoom.ts changes) and host-side (DungeonScreen.tsx + net-protocol
  additions) can be done in parallel once the net-protocol delta types are established first.

Goal: Wire the 6.2 boss FSM into GameRoom.ts with real boss arena physics, replace the
  placeholder victory trigger with a proper arena, broadcast all boss events as typed deltas, and
  render the boss on the host screen with HP bar, phase visuals, and stomp warning.

Allowed paths:
  - apps/simulation-server/src/levels/boss-arena.ts           (NEW)
  - apps/simulation-server/src/rooms/GameRoom.ts              (MODIFY — wire tickBoss, arena load)
  - packages/net-protocol/src/messages/server-to-host.ts      (MODIFY — 3 new delta types + union)
  - packages/net-protocol/src/apply-delta.ts                  (MODIFY — boss:moved, add:spawned)
  - packages/net-protocol/src/index.ts                        (MODIFY — export new delta types)
  - apps/host-client/src/screens/DungeonScreen.tsx            (MODIFY — boss rendering)

Blocked paths:
  - packages/game-rules/**        (boss FSM complete from 6.2 — do not touch)
  - packages/shared-types/**      (all boss types complete from 6.1 and 6.2 — do not touch)
  - apps/mobile-controller/**     (mobile victory UX — story 6.4)
  - packages/telemetry/**         (not in scope)
  - Purification pulse animation  (story 6.4)
  - BossDefeatedDelta broadcast logic / RunVictoryMsg unicast (story 6.4)
  - Achievement tracking (story 6.5)

Inputs:
  - Epic 6 Story 6.3 acceptance criteria (epics.md)
  - apps/simulation-server/src/rooms/GameRoom.ts (boss placeholder at loadLevel(); tick loop)
  - apps/simulation-server/src/physics/world.ts (toMeters, createEnemyBody, createVictoryTriggerBody)
  - packages/game-rules/src/entities/grassland-boss.ts (createBossState, tickBoss, BossEvent — from 6.2)
  - packages/game-rules/src/balance.ts (BOSS_ADD_HP — from 6.2)
  - packages/net-protocol/src/messages/server-to-host.ts (extend DeltaEventMsg)
  - packages/net-protocol/src/apply-delta.ts (add boss:moved, add:spawned cases)
  - apps/host-client/src/screens/DungeonScreen.tsx (renderFrame + transient delta effects)
  - packages/shared-types/src/boss.ts (BossState.position.x / BossState.position.y shape)

Non-goals:
  - Purification pulse / boss defeat animation (story 6.4)
  - BossDefeatedDelta broadcast and RunVictoryMsg unicast to mobile (story 6.4)
  - Mobile victory screen (story 6.4)
  - Achievement tracking and GrasslandAchievement emission (story 6.5)
  - Biome art assets — all boss visuals use Graphics primitives (PixiJS shape-only)
  - Boss audio / SFX (separate story or Epic 9 asset pass)
  - Collision between boss body and walls (planck static walls in arena ARE solid bodies that block
    the boss body; player-wall collision is out of scope — players can walk off-screen for now)
  - Difficulty selection UI changes (not touched)

Acceptance criteria:
  AC1: apps/simulation-server/src/levels/boss-arena.ts exports:
       BOSS_ARENA_SPAWN_POINTS as ReadonlyArray<{x:number; y:number}> with 4 entries at arena edges,
       loadBossArena(world: planck.World): void that creates 4 static wall bodies (top, bottom, left,
       right) as polygon box shapes forming a rectangular arena.
       Zero game-rules imports. Zero shared-types imports.
  AC2: GameRoom.loadLevel() boss branch (replacing `if (index >= 4)` placeholder) creates the boss
       physics body (dynamic circle, radius 48px in meters), calls createBossState(runSeed) to set
       gameState.boss, and calls loadBossArena(this.physicsWorld). No victory trigger body is created
       for the boss level (it is replaced entirely).
  AC3: Level index correctness: after investigation of startRun() → loadLevel() call, the boss level
       condition in loadLevel() and the bond-skip condition in enterBondMoment() are consistent with
       the actual run sequence. If the first dungeon level is index 1, boss is index 4 and the
       placeholder `index >= 4` is correct; if first level is index 0, boss is index 3. Document
       the verified index in a // ponytail: comment at the branch.
  AC4: In the GameRoom tick loop, when gameState.session.levelIndex equals the boss level index AND
       gameState.boss is non-null AND !gameState.boss.isDefeated: calls tickBoss(...) and routes all
       returned BossEvent variants (boss:moved, boss:stomped, boss:phaseChanged, add:spawned,
       boss:defeated). Stomp damage applied to players in radius on the NEXT tick (1-tick delay).
  AC5: BossMovedDelta, BossStompedDelta, BossAddSpawnedDelta are added to:
       packages/net-protocol/src/messages/server-to-host.ts (type definitions)
       DeltaEventMsg union (three new members)
       packages/net-protocol/src/apply-delta.ts (boss:moved updates mirror.boss.position;
       add:spawned is a no-op with ponytail comment — GrasslandAdds arrive via next snapshot broadcast)
       packages/net-protocol/src/index.ts (re-exported)
  AC6: GrasslandAdd enemies spawned on boss:defeated event by GameRoom: createEnemyBody() called for
       each BossAddSpawnedEvent, enemy added to gameState.enemies, a snapshot is broadcast immediately
       so the host mirror reflects the new enemies within one tick.
  AC7: boss:defeated event handling in GameRoom (placeholder for Story 6.4):
       gameState.session.phase = 'post-run'; broadcast RunCompleteDelta (type: 'run:complete',
       totalEssence from the RunReward in the event). Story 6.4 replaces this with
       BossDefeatedDelta + RunVictoryMsg unicast.
  AC8: DungeonScreen renders boss sprite: a Graphics circle (radius 48, color 0x7d2dff) at
       boss.position.x, boss.position.y each renderFrame tick when mirrorState.boss is non-null.
       Boss Graphics object stored in a ref, created once, removed and destroyed when boss becomes null.
  AC9: DungeonScreen renders boss HP bar: a React DOM element (div) positioned at top: 48px, width
       proportional to boss.hp / boss.maxHp × 100%, height 6px, background #7d2dff. Hidden (display:
       none or null render) when mirrorState.boss is null.
  AC10: On BossDamagedDelta received as latestTransientDelta: HP bar fill updates (driven by
        mirrorState.boss.hp after applyDelta); a floating damage number appears above the boss sprite
        for 800ms (React overlay positioned via inline style, same pattern as revive timer).
  AC11: On BossPhaseChangedDelta to Phase2: boss Graphics gains a secondary circle (radius 56, same
        color, alpha 0.3) drawn around the boss as a glow ring. On Phase3 (Hard): a small red inner
        circle (radius 12, color 0xff2222) is added at boss center. Phase state tracked in a ref.
  AC12: On BossStompedDelta received as latestTransientDelta: a thin ring Graphics (radius from delta,
        color 0xff4444, alpha 0.7, stroke width 3) appears at the stomp position and is removed after
        66ms (2 ticks). No permanent stage children left behind.
  AC13: GrasslandAdd enemies (EnemyType.GRASSLAND_ADD) are rendered by the existing enemy rendering
        path in renderFrame without modification — they appear in state.enemies after the snapshot
        broadcast triggered by AC6.
  AC14: npm run typecheck passes across all workspaces with zero errors.

Required hooks:
  - Simulation-safety hook: GameRoom.ts and new boss-arena.ts modified.
    Satisfied by: typecheck passes; manual verification that tickBoss is called in the tick loop.
  - Contract-change hook: DeltaEventMsg union extended with 3 new members; apply-delta.ts updated.
    Required: compatibility checklist (all new types are additive, no existing cases removed);
    round-trip serialize/deserialize test for BossMovedDelta.

Required tests:
  - TypeScript typecheck across all workspaces: zero errors
  - BossMovedDelta round-trip: JSON.stringify / JSON.parse preserves type, bossId, x, y
  - boss-arena.ts shape check: BOSS_ARENA_SPAWN_POINTS.length === 4; loadBossArena is a function
  - Regression: tickBoss unit tests from Story 6.2 still pass (no game-rules changes expected)

Telemetry impact: None in this story.
```

## Story

As a player on the host screen,
I want to see the Grassland Boss rendered in its arena with a full-width HP bar and phase-transition
visuals that react to damage and phase changes,
so that the boss fight has clear visual weight and I can track the encounter state without looking
at my phone.

## Acceptance Criteria

1. **(AC1)** `apps/simulation-server/src/levels/boss-arena.ts` is created and exports:
   - `BOSS_ARENA_SPAWN_POINTS: ReadonlyArray<{ x: number; y: number }>` — exactly 4 entries at arena
     edges: `{ x: 960, y: 100 }` (north), `{ x: 960, y: 980 }` (south), `{ x: 120, y: 540 }` (west),
     `{ x: 1800, y: 540 }` (east)
   - `loadBossArena(world: planck.World): void` — creates 4 static wall bodies (top, bottom, left,
     right) as `planck.Box` polygon shapes forming a rectangular arena; angled or notched corners
     optional but noted as upgrade path if corner-sticking is observed
   - Zero `game-rules` imports. Zero `shared-types` imports. Only `planck` and `../physics/world.js`
     (`toMeters`) imported.

2. **(AC2)** `GameRoom.loadLevel()` at the boss level index: replaces the placeholder branch
   (`if (index >= 4)`) with real setup:
   - Calls `loadBossArena(this.physicsWorld)`
   - Creates a dynamic planck body for the boss (circle fixture, radius `toMeters(48)`, `fixedRotation: true`)
   - Sets body userData to `{ type: 'boss', bossId: string }` (add `'boss'` variant to `PhysicsBodyData`
     union in `world.ts`)
   - Calls `createBossState(this.gameState.session.runSeed)` and assigns to `this.gameState.boss`
   - Stores the body in `this.bossBody: Body | null` (new private field)
   - Does NOT create a victory trigger sensor body for this level

3. **(AC3)** Level index is verified and documented. Current code: `startRun()` calls `this.loadLevel(1)`,
   so dungeon levels are 1, 2, 3 and boss is 4. The `index >= 4` check is correct. Change it to
   `index === 4` for precision (the `>=` was a placeholder guard). `enterBondMoment`'s
   `if (levelIndex >= 4)` skip condition stays as-is. Add a `// ponytail: boss is level index 4;
   dungeon runs levels 1-3` comment at the branch.

4. **(AC4)** In the tick loop (after the enemy AI section), when
   `this.gameState.session.levelIndex === BOSS_LEVEL_INDEX` (define `const BOSS_LEVEL_INDEX = 4` near
   top of file) AND `this.gameState.boss !== null` AND `!this.gameState.boss.isDefeated`:
   - Calls `tickBoss(this.gameState.boss, this.gameState, this.gameState.session.difficulty!, BOSS_ARENA_SPAWN_POINTS)`
   - Routes returned `BossEvent[]` (see Dev Notes for the full switch)
   - Applies stomp damage to players in radius one tick after receiving `boss:stomped` (via
     `this.pendingBossStompEvents: BossStompedEvent[]`)

5. **(AC5)** `packages/net-protocol/src/messages/server-to-host.ts` gains three new exported types:
   ```typescript
   export type BossMovedDelta    = { type: 'boss:moved';    bossId: string; x: number; y: number };
   export type BossStompedDelta  = { type: 'boss:stomped';  bossId: string; x: number; y: number; radius: number };
   export type BossAddSpawnedDelta = { type: 'add:spawned'; enemyId: string; x: number; y: number };
   ```
   All three added to the `DeltaEventMsg` union. `apply-delta.ts` gains:
   - `case 'boss:moved'`: updates `mirror.boss.position.x` and `mirror.boss.position.y` when
     `mirror.boss` is non-null; no-op otherwise
   - `case 'add:spawned'`: `return state; // ponytail: GrasslandAdds arrive via snapshot broadcast`
   - `case 'boss:stomped'`: `return state; // ponytail: visual only; DungeonScreen reads raw delta`
   The exhaustiveness guard in the `default` case continues to catch unhandled variants.

6. **(AC6)** On `add:spawned` BossEvent from `tickBoss`: GameRoom creates an enemy body via
   `createEnemyBody(this.physicsWorld, enemyId, evt.x, evt.y)`, pushes a new `EnemyState` (type:
   `EnemyType.GRASSLAND_ADD`, hp: `BOSS_ADD_HP`, maxHp: `BOSS_ADD_HP`, isAlive: true) into
   `this.gameState.enemies`, and immediately broadcasts a `SnapshotMsg` so the host mirror receives
   the new enemy within the same tick.

7. **(AC7)** On `boss:defeated` BossEvent: GameRoom sets `this.gameState.session.phase = 'post-run'`
   and broadcasts `{ type: 'run:complete', totalEssence: evt.reward.essenceTotal } satisfies RunCompleteDelta`.
   A `// ponytail: Story 6.4 replaces this with BossDefeatedDelta + RunVictoryMsg unicast` comment
   marks the placeholder.

8. **(AC8)** `DungeonScreen.tsx` renders the boss as a PixiJS `Graphics` circle (radius 48,
   fill color `0x7d2dff`) at `boss.position.x, boss.position.y` per `renderFrame` tick.
   The `Graphics` object is stored in `bossGraphicsRef` (a `useRef<Graphics | null>`), created on
   the first tick where `state.boss` is non-null, and destroyed when `state.boss` becomes null.
   `renderFrame` receives `bossGraphics: Graphics | null` as a parameter (or the ref is managed
   inside the component effect — see Dev Notes for the simpler pattern).

9. **(AC9)** Boss HP bar is a React DOM `div` overlay (not PixiJS), positioned `top: 54px` (just
   below the 48px player chip strip), `left: 0`, `right: 0`, height `6px`,
   background `#7d2dff`. Its inner `div` (the fill) has width `${hpPct}%` where
   `hpPct = Math.max(0, (gameState.boss.hp / gameState.boss.maxHp) * 100)`.
   Hidden via `display: 'none'` when `gameState?.boss == null`.

10. **(AC10)** On `BossDamagedDelta` (from 6.1 — already in `DeltaEventMsg`): the HP bar width
    re-renders automatically because `gameState.boss.hp` is updated via `applyDelta`. A floating
    damage number (React `div` absolute-positioned near the boss sprite's canvas coordinates)
    appears for 800ms. Store `bossDamageFlash: { damage: number; until: number } | null` in React
    state; clear via `setTimeout`. The canvas x/y of the boss sprite maps to screen coordinates via
    `app.screen.width / VIRTUAL_W` scale — compute approximate screen position or fix at a static
    location above the HP bar.

11. **(AC11)** Boss phase visuals: track `bossPhaseRef = useRef<BossPhase>(BossPhase.Phase1)`.
    On `BossPhaseChangedDelta` received as `latestTransientDelta`:
    - Update `bossPhaseRef.current`
    - Phase 2: `renderFrame` draws an additional circle (radius 56, alpha 0.3, same color `0x7d2dff`)
      around the boss — a glow ring
    - Phase 3 (Hard): `renderFrame` additionally draws a small red circle (radius 12, color `0xff2222`)
      at boss center — "eye glow"
    `renderFrame` reads `bossPhaseRef.current` to decide which overlays to draw. No new assets needed.

12. **(AC12)** On `BossStompedDelta` received as `latestTransientDelta`, and `app` is non-null:
    create a `Graphics` ring at `(evt.x, evt.y)`, draw a circle stroke (radius `evt.radius`,
    color `0xff4444`, width 3, alpha 0.7), add to `app.stage`, remove and destroy after 66ms.
    No lingering stage children.

13. **(AC13)** GrasslandAdd enemies (arriving in `state.enemies` after snapshot) are rendered by
    the existing enemy rendering path in `renderFrame` without modification — the existing loop
    handles all `EnemyState` entries regardless of type.

14. **(AC14)** `npm run typecheck --workspaces` passes with zero errors across all packages and apps.

## Tasks / Subtasks

- [ ] **Task 1: Add PhysicsBodyData 'boss' variant** (AC: 2)
  - [ ] In `apps/simulation-server/src/physics/world.ts`, add `| { type: 'boss'; bossId: string }`
        to the `PhysicsBodyData` union
  - [ ] No other changes to world.ts

- [ ] **Task 2: Create boss-arena.ts** (AC: 1)
  - [ ] Create `apps/simulation-server/src/levels/` directory
  - [ ] Create `apps/simulation-server/src/levels/boss-arena.ts`
  - [ ] Export `BOSS_ARENA_SPAWN_POINTS` constant (4 edge positions)
  - [ ] Export `loadBossArena(world: planck.World): void` that creates 4 static wall polygon bodies
        (see Dev Notes for wall geometry)
  - [ ] Import only `planck` and `toMeters` from `'../physics/world.js'`
  - [ ] Zero game-rules or shared-types imports

- [ ] **Task 3: Add new delta types to net-protocol** (AC: 5)
  - [ ] Add `BossMovedDelta`, `BossStompedDelta`, `BossAddSpawnedDelta` type exports to
        `packages/net-protocol/src/messages/server-to-host.ts`
  - [ ] Add all three to the `DeltaEventMsg` union
  - [ ] Add `case 'boss:moved'`, `case 'boss:stomped'`, `case 'add:spawned'` to `apply-delta.ts`
  - [ ] Re-export new types from `packages/net-protocol/src/index.ts`

- [ ] **Task 4: Wire boss into GameRoom.loadLevel()** (AC: 2, 3)
  - [ ] Add `private bossBody: Body | null = null;` field to GameRoom
  - [ ] Add `private pendingBossStompEvents: BossStompedEvent[] = [];` field to GameRoom
        (import `BossStompedEvent` type from game-rules)
  - [ ] Define `const BOSS_LEVEL_INDEX = 4;` near the top of the file
  - [ ] Replace the `if (index >= 4)` branch with `if (index === BOSS_LEVEL_INDEX)`:
        - Call `loadBossArena(this.physicsWorld)`
        - Destroy any existing `this.bossBody` if non-null
        - Create boss dynamic body with `Circle(toMeters(48))` fixture
        - Set body userData `{ type: 'boss', bossId: bossId }` (derive bossId from runSeed)
        - Call `createBossState(this.gameState.session.runSeed)` → `this.gameState.boss`
        - Import `createBossState` and `BOSS_ARENA_SPAWN_POINTS` from game-rules and boss-arena.ts
  - [ ] In level cleanup at start of `loadLevel()`: destroy `this.bossBody` if non-null, set to null;
        set `this.gameState.boss = null`; clear `this.pendingBossStompEvents`

- [ ] **Task 5: Wire tickBoss into the tick loop** (AC: 4, 6, 7)
  - [ ] In the tick method, after the enemy AI section, add a boss tick block guarded by
        `levelIndex === BOSS_LEVEL_INDEX && this.gameState.boss && !this.gameState.boss.isDefeated`
  - [ ] Call `tickBoss(...)` and iterate the returned events with a switch statement
        (see Dev Notes for the full routing switch)
  - [ ] Implement stomp damage: at the START of each tick (before tickBoss), iterate
        `this.pendingBossStompEvents`, apply player HP damage for players within radius,
        broadcast `PlayerHpUpdatedDelta` for each affected player, then clear the array
  - [ ] On `boss:moved`: update `this.gameState.boss.position`, call `bossBody.setPosition()`,
        broadcast `BossMovedDelta`
  - [ ] On `boss:stomped`: push to `pendingBossStompEvents`, broadcast `BossStompedDelta`
  - [ ] On `boss:phaseChanged`: broadcast `BossPhaseChangedDelta`
  - [ ] On `add:spawned`: call `createEnemyBody()`, push to `gameState.enemies`, broadcast snapshot
  - [ ] On `boss:defeated`: set phase to `'post-run'`, broadcast `RunCompleteDelta` (placeholder —
        ponytail comment for Story 6.4)

- [ ] **Task 6: Host rendering — boss sprite** (AC: 8, 11)
  - [ ] Add `bossGraphicsRef = useRef<Graphics | null>(null)` to DungeonScreen
  - [ ] Add `bossPhaseRef = useRef<BossPhase>(BossPhase.Phase1)` to DungeonScreen
  - [ ] Extend `renderFrame` signature to accept `bossGraphics: { ref: React.MutableRefObject<Graphics | null>; phase: BossPhase }` or
        manage the boss Graphics object inside the ticker callback (see Dev Notes — simpler pattern)
  - [ ] In `renderFrame` (or ticker): if `state.boss` is non-null and `bossGraphicsRef.current` is null,
        create a `Graphics`, add to `app.stage`, store in ref. If `state.boss` is null and ref is
        non-null, remove from stage, destroy, set ref to null.
  - [ ] Draw boss: clear ref, draw base circle (radius 48, fill `0x7d2dff`), set position. If
        Phase 2 or 3: draw glow ring (radius 56, alpha 0.3, fill or stroke `0x7d2dff`). If Phase 3:
        draw red inner circle (radius 12, fill `0xff2222`).

- [ ] **Task 7: Host rendering — boss HP bar** (AC: 9, 10)
  - [ ] Add `bossDamageFlash: { damage: number; until: number } | null` to React state
  - [ ] In the JSX return, add a boss HP bar overlay div below the player chip strip:
        `top: 54px`, height `6px`, full width, background `rgba(30,15,30,0.5)` as track;
        inner div with width `hpPct%`, background `#7d2dff`
  - [ ] On `BossDamagedDelta` in the transient delta effect: set `bossDamageFlash` with
        `damage: delta.damage` and `until: Date.now() + 800`; clear via setTimeout
  - [ ] Render floating damage number as a React div: absolute positioned, fades after 800ms

- [ ] **Task 8: Host rendering — transient boss effects** (AC: 12)
  - [ ] In the transient delta `useEffect`, add `else if` branch for `boss:phase-changed`:
        update `bossPhaseRef.current = delta.newPhase`
  - [ ] Add `else if` branch for `boss:stomped` and `app`: create ring Graphics, add to stage,
        remove and destroy via `setTimeout(66)`
  - [ ] Add `else if` branch for `boss:damaged`: handled by HP bar state update above (AC10)

- [ ] **Task 9: Typecheck and test** (AC: 14)
  - [ ] `npm run typecheck --workspaces` — zero errors
  - [ ] BossMovedDelta round-trip: `JSON.parse(JSON.stringify(delta))` preserves shape
  - [ ] boss-arena.ts smoke check: BOSS_ARENA_SPAWN_POINTS.length === 4, loadBossArena is a function
  - [ ] Confirm Story 6.2 unit tests still pass

## Dev Notes

### Critical: level index — investigation required

Before writing any code, open `apps/simulation-server/src/rooms/GameRoom.ts` and check line ~500:

```typescript
this.loadLevel(1);  // startRun() call
```

The run starts at `loadLevel(1)`, which means dungeon levels are at indices 1, 2, 3 and the boss is
at index 4. The existing `if (index >= 4)` placeholder is consistent with this. The epics spec's
"boss level (index 3)" appears to count from 0 starting at level 1 (i.e., "the 4th level" = index 3
in 0-based counting from the first dungeon level, not from 0 in absolute terms). **Do not change
`loadLevel(1)` or the `enterBondMoment` guard.** The fix is to change `>= 4` to `=== 4` for
precision and add the constant `BOSS_LEVEL_INDEX = 4`.

If somehow you find `this.loadLevel(0)` in `startRun()`, then levels are 0, 1, 2 (dungeon) and 3
(boss) and you should use `BOSS_LEVEL_INDEX = 3` consistently everywhere. This scenario is unlikely
given the codebase evidence but document the deviation.

### boss-arena.ts wall geometry

The arena is 1920×1080 virtual pixels. Create 4 static bodies as thin box shapes:

```typescript
import * as planck from 'planck';
import { toMeters } from '../physics/world.js';

const WALL_THICKNESS_PX = 40;
const ARENA_W = 1920;
const ARENA_H = 1080;

export const BOSS_ARENA_SPAWN_POINTS = [
  { x: 960,  y: 100  },  // north
  { x: 960,  y: 980  },  // south
  { x: 120,  y: 540  },  // west
  { x: 1800, y: 540  },  // east
] as const satisfies ReadonlyArray<{ x: number; y: number }>;

export function loadBossArena(world: planck.World): void {
  const hw = toMeters(ARENA_W / 2);
  const hh = toMeters(ARENA_H / 2);
  const cx = toMeters(ARENA_W / 2);
  const cy = toMeters(ARENA_H / 2);
  const t  = toMeters(WALL_THICKNESS_PX / 2);

  // Top wall
  const top = world.createBody({ type: 'static', position: planck.Vec2(cx, toMeters(WALL_THICKNESS_PX / 2)) });
  top.createFixture({ shape: planck.Box(hw, t) });

  // Bottom wall
  const bot = world.createBody({ type: 'static', position: planck.Vec2(cx, toMeters(ARENA_H - WALL_THICKNESS_PX / 2)) });
  bot.createFixture({ shape: planck.Box(hw, t) });

  // Left wall
  const lft = world.createBody({ type: 'static', position: planck.Vec2(toMeters(WALL_THICKNESS_PX / 2), cy) });
  lft.createFixture({ shape: planck.Box(t, hh) });

  // Right wall
  const rgt = world.createBody({ type: 'static', position: planck.Vec2(toMeters(ARENA_W - WALL_THICKNESS_PX / 2), cy) });
  rgt.createFixture({ shape: planck.Box(t, hh) });

  // ponytail: no corner notching — add diagonal corner bodies if corner-sticking observed in playtest
}
```

Note: `planck.Box(halfW, halfH)` is the polygon box factory. Check if the planck version in use
exports it as `planck.Box` or `new planck.Box` — the existing `world.ts` uses `new Circle(...)` not
`planck.Circle`, so import the constructors accordingly:

```typescript
import { World, Vec2, Box } from 'planck';
```

### PhysicsBodyData extension

Add to `apps/simulation-server/src/physics/world.ts`:

```typescript
export type PhysicsBodyData =
  | { type: 'player';  playerId: string }
  | { type: 'poi';     poiId: string; poiType: PoiType }
  | { type: 'enemy';   enemyId: string }
  | { type: 'essence'; dropId: string }
  | { type: 'boss';    bossId: string };   // ← add this
```

No new function needed — boss body is created inline in GameRoom.loadLevel().

### GameRoom boss event routing switch

```typescript
// In tick loop — after enemy AI section:
if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX &&
    this.gameState.boss !== null &&
    !this.gameState.boss.isDefeated) {

  const result = tickBoss(
    this.gameState.boss,
    this.gameState,
    this.gameState.session.difficulty!,
    BOSS_ARENA_SPAWN_POINTS,
  );

  if (result.ok) {
    for (const evt of result.value) {
      switch (evt.type) {
        case 'boss:moved':
          this.gameState.boss.position.x = evt.x;
          this.gameState.boss.position.y = evt.y;
          if (this.bossBody) this.bossBody.setPosition(Vec2(toMeters(evt.x), toMeters(evt.y)));
          this.broadcast(EventNames.DELTA, {
            type: 'boss:moved', bossId: evt.bossId, x: evt.x, y: evt.y,
          } satisfies DeltaEventMsg);
          break;

        case 'boss:stomped':
          this.pendingBossStompEvents.push(evt);
          this.broadcast(EventNames.DELTA, {
            type: 'boss:stomped', bossId: evt.bossId, x: evt.x, y: evt.y, radius: evt.radius,
          } satisfies DeltaEventMsg);
          break;

        case 'boss:phaseChanged':
          this.broadcast(EventNames.DELTA, {
            type: 'boss:phase-changed', bossId: evt.bossId, newPhase: evt.newPhase,
          } satisfies DeltaEventMsg);
          break;

        case 'add:spawned': {
          const addEnemy: EnemyState = {
            id: evt.enemyId, type: EnemyType.GRASSLAND_ADD,
            x: evt.x, y: evt.y, hp: BOSS_ADD_HP, maxHp: BOSS_ADD_HP,
            isAlive: true, fsmState: EnemyFSMState.IDLE,
          };
          this.gameState.enemies.push(addEnemy);
          const addBody = createEnemyBody(this.physicsWorld, evt.enemyId, evt.x, evt.y);
          this.enemyBodies.set(evt.enemyId, addBody);
          this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
          break;
        }

        case 'boss:defeated':
          // ponytail: Story 6.4 replaces with BossDefeatedDelta + RunVictoryMsg unicast
          this.gameState.session.phase = 'post-run';
          this.broadcast(EventNames.DELTA, {
            type: 'run:complete', totalEssence: evt.reward.essenceTotal,
          } satisfies DeltaEventMsg);
          break;
      }
    }
  } else {
    logger.error({ roomId: this.roomId, error: result.error }, 'tickBoss returned error');
  }
}
```

### Stomp damage processing (1-tick delay)

At the **start** of the tick (before the tickBoss block):

```typescript
// Apply stomp damage from previous tick
if (this.pendingBossStompEvents.length > 0) {
  for (const stompEvt of this.pendingBossStompEvents) {
    for (const player of this.gameState.players) {
      if (player.isDown || player.isSpirit || player.isFrozen) continue;
      const dx = player.x - stompEvt.x;
      const dy = player.y - stompEvt.y;
      if (Math.sqrt(dx * dx + dy * dy) > stompEvt.radius) continue;
      // Use applyDamage from combat.ts (or inline — same pattern as enemy damage)
      player.hp = Math.max(0, player.hp - BOSS_STOMP_DAMAGE);
      this.broadcast(EventNames.DELTA, {
        type: 'player:hp-updated', playerId: player.id, hp: player.hp,
      } satisfies DeltaEventMsg);
      if (player.hp <= 0) {
        // trigger down state — reuse existing down logic
      }
    }
  }
  this.pendingBossStompEvents = [];
}
```

`BOSS_STOMP_DAMAGE` is a new constant — add it to `packages/game-rules/src/balance.ts` in the boss
section. Suggested value: 40 (one-quarter of a typical player's max HP). Because this requires
touching `balance.ts` (which is nominally blocked by this story's constraints on game-rules), the
stomp damage constant can be defined as a local constant in `GameRoom.ts` if the team wants to avoid
any game-rules modifications: `const BOSS_STOMP_DAMAGE = 40; // ponytail: move to balance.ts in 6.5`.

### DungeonScreen boss sprite — simpler pattern (no renderFrame param change)

Rather than threading the boss Graphics ref through `renderFrame`'s parameter list, manage the boss
Graphics lifecycle inside the PixiJS ticker callback directly:

```typescript
const bossGraphicsRef = useRef<Graphics | null>(null);
const bossPhaseRef = useRef<BossPhase | null>(null);

// Inside app.ticker.add callback (where renderFrame is already called):
app.ticker.add(() => {
  const state = latestGameStateRef.current;
  if (!state) return;

  renderFrame(state, app, playerGraphicsRef.current, ...);

  // Boss sprite (managed separately from renderFrame to keep renderFrame signature stable)
  if (state.boss) {
    if (!bossGraphicsRef.current) {
      const g = new Graphics();
      app.stage.addChild(g);
      bossGraphicsRef.current = g;
    }
    const g = bossGraphicsRef.current;
    g.clear();
    g.position.set(state.boss.position.x, state.boss.position.y);
    g.circle(0, 0, 48).fill({ color: 0x7d2dff });
    // Phase 2 glow ring
    if (bossPhaseRef.current === BossPhase.Phase2 || bossPhaseRef.current === BossPhase.Phase3) {
      g.circle(0, 0, 56).fill({ color: 0x7d2dff, alpha: 0.3 });
    }
    // Phase 3 eye glow (Hard only)
    if (bossPhaseRef.current === BossPhase.Phase3) {
      g.circle(0, 0, 12).fill({ color: 0xff2222 });
    }
  } else if (bossGraphicsRef.current) {
    app.stage.removeChild(bossGraphicsRef.current);
    bossGraphicsRef.current.destroy();
    bossGraphicsRef.current = null;
  }
});
```

Add `bossGraphicsRef` and `bossPhaseRef` to the cleanup in the `useEffect` return:

```typescript
if (bossGraphicsRef.current) {
  bossGraphicsRef.current.destroy();
  bossGraphicsRef.current = null;
}
```

### DungeonScreen boss HP bar JSX

Insert below the player chip strip div (the 48px top strip):

```tsx
{/* Boss HP bar */}
{gameState?.boss != null && (
  <div
    style={{
      position: 'absolute',
      top: 54,
      left: 0,
      right: 0,
      height: 6,
      background: 'rgba(30,15,30,0.6)',
      zIndex: 11,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        height: '100%',
        width: `${Math.max(0, (gameState.boss.hp / gameState.boss.maxHp) * 100)}%`,
        background: '#7d2dff',
        transition: 'width 80ms linear',
      }}
    />
  </div>
)}
```

The `transition: 'width 80ms linear'` gives a smooth fill drain without any manual animation code.

### Floating damage number

Add to React state:

```typescript
const [bossDamageFlash, setBossDamageFlash] = useState<{ amount: number; until: number } | null>(null);
```

In the transient delta `useEffect`, add:

```typescript
} else if (latestTransientDelta.type === 'boss:damaged') {
  setBossDamageFlash({ amount: latestTransientDelta.damage, until: Date.now() + 800 });
  setTimeout(() => setBossDamageFlash(null), 800);
}
```

In JSX (approximate position — above the boss HP bar, centered):

```tsx
{bossDamageFlash && Date.now() < bossDamageFlash.until && (
  <div
    style={{
      position: 'absolute',
      top: 62,
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#ff99ff',
      fontSize: 20,
      fontWeight: 'bold',
      pointerEvents: 'none',
      zIndex: 12,
    }}
  >
    -{bossDamageFlash.amount}
  </div>
)}
```

`// ponytail: fixed position above HP bar; per-hit canvas coordinates would require converting
// boss.position through the PixiJS scale transform — add if the static position is confusing`

### BossPhaseChangedDelta field name mismatch risk

The 6.1 delta type from `server-to-host.ts` uses `newPhase: BossPhase`. The 6.2 local event type
`BossPhaseChangedEvt` uses `newPhase: BossPhase`. These are structurally compatible. When broadcasting
in GameRoom, use `satisfies DeltaEventMsg` to catch any mismatch at compile time.

### apply-delta.ts exhaustiveness

The `default: never` guard in `apply-delta.ts` will cause a TypeScript compile error if any new
`DeltaEventMsg` member is added without a corresponding `case`. All three new cases MUST be added
before `npm run typecheck` will pass.

### ESM import paths

```typescript
// In boss-arena.ts:
import { Vec2, Box } from 'planck';
import { toMeters } from '../physics/world.js';

// In GameRoom.ts (additions):
import { createBossState, tickBoss, BossEvent, BossStompedEvent } from 'game-rules';
import { BOSS_ARENA_SPAWN_POINTS, loadBossArena } from '../levels/boss-arena.js';
import { BOSS_ADD_HP } from 'game-rules';

// In DungeonScreen.tsx (additions):
import { BossPhase } from 'shared-types';
import type { BossMovedDelta, BossStompedDelta } from 'net-protocol';
```

Check that `game-rules` exports `BossStompedEvent` from its index — it should be re-exported from
`grassland-boss.ts` by Task 5 of Story 6.2. If missing, import directly:
`import type { BossStompedEvent } from 'game-rules/src/entities/grassland-boss.js'`.

### File structure after this story

```
apps/simulation-server/src/
  levels/
    boss-arena.ts              ← NEW
  physics/
    world.ts                   (MODIFY — boss variant in PhysicsBodyData)
  rooms/
    GameRoom.ts                (MODIFY — BOSS_LEVEL_INDEX, bossBody, pendingBossStompEvents,
                                         loadLevel boss branch, tickBoss in tick loop)

packages/net-protocol/src/
  messages/
    server-to-host.ts          (MODIFY — BossMovedDelta, BossStompedDelta, BossAddSpawnedDelta + union)
  apply-delta.ts               (MODIFY — boss:moved, boss:stomped, add:spawned cases)
  index.ts                     (MODIFY — re-export new delta types)

apps/host-client/src/
  screens/
    DungeonScreen.tsx          (MODIFY — bossGraphicsRef, bossPhaseRef, HP bar, damage flash,
                                         stomp warning ring, phase visual branch)
```

## Project Context Rules

- **Authority model**: `GameRoom.ts` is the only place that calls `tickBoss` — game logic flows
  from game-rules into GameRoom, never the reverse. Boss position updates flow from the sim to the
  host via `BossMovedDelta`; the host never writes to `mirrorState.boss.position` directly.
- **No Math.random()**: `boss-arena.ts` has no randomness. Boss add IDs are generated by `tickBoss`
  in game-rules (using `Date.now()` — acceptable for entity IDs, not for simulation determinism).
- **No Colyseus Schema**: boss state flows through `gameState.boss: BossState | null` and explicit
  delta messages. No `@Schema` annotation anywhere.
- **TypeScript strict mode**: all new code under `"strict": true`. The `| null` union for bossBody
  and bossGraphicsRef requires null guards before use — do not use `!` non-null assertion unless
  you have just verified non-null in the same scope.
- **Ponytail discipline**: Boss wall collisions for PLAYERS are out of scope — if a player walks off
  the arena edge, they teleport via the normal out-of-bounds handling. Add walls that block the
  BOSS body. Player-wall collision is an Epic 9 concern (level boundaries).
- **Contract-change hook**: DeltaEventMsg is a contract boundary. Adding 3 new members is additive
  and backward-compatible (old clients that don't handle the new types will hit the `default` case
  which is a no-op or log). Still requires a round-trip test for BossMovedDelta.

## References

- Epic 6 Story 6.3 acceptance criteria: `_bmad-output/planning-artifacts/epics.md`
- Boss placeholder (current): `apps/simulation-server/src/rooms/GameRoom.ts` line ~774
- Physics helpers: `apps/simulation-server/src/physics/world.ts` (full file — especially `createEnemyBody`, `createVictoryTriggerBody`, `toMeters`, `PhysicsBodyData`)
- Delta protocol (current): `packages/net-protocol/src/messages/server-to-host.ts` (full file)
- apply-delta.ts (current): `packages/net-protocol/src/apply-delta.ts` (full file)
- DungeonScreen (current): `apps/host-client/src/screens/DungeonScreen.tsx` (full file — especially `renderFrame`, transient delta `useEffect`, revive timer overlay pattern)
- Boss FSM (from 6.2): `packages/game-rules/src/entities/grassland-boss.ts`
- Boss balance (from 6.2): `packages/game-rules/src/balance.ts` (boss section)
- BossState shape: `packages/shared-types/src/boss.ts` — note `position: { x, y }` not top-level `x/y`
- enterBondMoment: `apps/simulation-server/src/rooms/GameRoom.ts` line ~677

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---
baseline_commit: 23b8a4e
---

# Story 6.2: Grassland Boss FSM — Phase System & Difficulty-Tiered Behaviors

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.2 — boss FSM, phase system, behavior layers)
Context: Story 6.1 MUST be complete before implementing this story.
  6.1 provides: BossState, BossPhase, RunReward, GrasslandAchievement types in shared-types;
               BossPhaseChangedDelta, BossDefeatedDelta in net-protocol;
               BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO, BOSS_REWARD_ESSENCE_BASE in constants.ts.
  This story adds pure boss AI logic: no Colyseus, no net-protocol changes, no host rendering.
  The boss FSM is wired into GameRoom.ts in Story 6.3. Tests here are unit-only.

  Codebase state entering this story:
  - packages/game-rules/src/entities/: DOES NOT EXIST — create it
  - packages/game-rules/src/balance.ts: has enemy/layer/bond constants; boss section is absent
  - packages/game-rules/src/index.ts: exports tickEnemy, BehaviorLayer, etc. — extend, do not rewrite
  - packages/shared-types/src/boss.ts (from story 6.1): exports BossPhase and BossState;
    BossState has NO fsmState or attackCooldownTicks fields — this story adds them
  - packages/shared-types/src/enemy.ts: EnemyType enum has no GRASSLAND_ADD variant — this story adds it
  - packages/shared-types/src/constants.ts (from story 6.1):
    BOSS_PHASE2_HP_RATIO = 0.6, BOSS_PHASE3_HP_RATIO = 0.3, BOSS_REWARD_ESSENCE_BASE = 200
  - packages/shared-types/src/index.ts: must export BossFSMState once added to boss.ts
  - No boss-related code exists anywhere else in the repo

  Patterns to follow:
  - tickEnemy in fsm.ts → tickBoss in grassland-boss.ts (same Result<events, GameError> return)
  - StompLayer / ChargeLayer → BossStompLayer / BossChargeLayer (same BehaviorLayer interface;
    see reuse note in Dev Notes — boss layers use EnemyState-compatible positioning)
  - applyDamage in combat.ts → applyBossDamage (same pure pattern)
  - BossPhaseChangedDelta shape in net-protocol → BossPhaseChangedEvt local type (structural match)

Owner agent: Simulation Engineer
Goal: Implement pure game-rules boss AI — phase transitions, behavior layers, defeat detection,
  add spawning event — so Story 6.3 can wire it into GameRoom with no further FSM work needed.
  No GameRoom.ts changes, no host UI changes, no net-protocol changes in this story.

Allowed paths:
  - packages/game-rules/src/entities/grassland-boss.ts             (NEW)
  - packages/game-rules/src/balance.ts                             (MODIFY — boss constants)
  - packages/game-rules/src/index.ts                               (MODIFY — export new symbols)
  - packages/game-rules/tests/unit/grassland-boss.test.ts          (NEW — unit tests)
  - packages/shared-types/src/boss.ts                              (MODIFY — BossFSMState enum + 2 fields)
  - packages/shared-types/src/enemy.ts                             (MODIFY — add GRASSLAND_ADD to EnemyType)
  - packages/shared-types/src/index.ts                             (MODIFY — export BossFSMState)

Blocked paths:
  - apps/simulation-server/**   (GameRoom integration — story 6.3)
  - apps/host-client/**         (rendering — story 6.3 and 6.4)
  - apps/mobile-controller/**   (mobile victory UX — story 6.4)
  - packages/net-protocol/**    (wire protocol already complete from story 6.1)
  - packages/game-rules/src/systems/achievements.ts  (story 6.5)

Inputs:
  - Epic 6 Story 6.2 acceptance criteria (epics.md lines 1235–1305)
  - packages/game-rules/src/systems/ai/fsm.ts (tickEnemy pattern — adapt for boss)
  - packages/game-rules/src/systems/ai/layers/stomp.ts (StompLayer — extend for boss telegraph)
  - packages/game-rules/src/systems/ai/layers/charge.ts (ChargeLayer — reuse as-is via BehaviorLayer)
  - packages/game-rules/src/balance.ts (add boss section at end)
  - packages/game-rules/src/state/result.ts (Result<T, E> type — unchanged)
  - packages/shared-types/src/boss.ts (extend BossState and add BossFSMState enum)
  - packages/shared-types/src/enemy.ts (add GRASSLAND_ADD to EnemyType)
  - packages/shared-types/src/constants.ts (BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO,
    BOSS_REWARD_ESSENCE_BASE — read-only, do not modify)
  - packages/shared-types/src/game-state.ts (GameState — read-only; boss: BossState | null added by 6.1)

Non-goals:
  - GameRoom.ts integration of tickBoss (story 6.3)
  - Boss arena physics geometry and planck bodies (story 6.3)
  - Host boss HP bar, phase visual changes, or audio (story 6.3)
  - Purification pulse animation (story 6.4)
  - BossDefeatedDelta broadcast or RunVictoryMsg unicast in GameRoom (story 6.4)
  - Achievement tracking logic (story 6.5)
  - enemy:spawned or add:spawned delta types in net-protocol
    (the BossAddSpawnedEvent is a local game-rules type; net-protocol union extension
     happens when story 6.3 wires the event into GameRoom)

Acceptance criteria:
  AC1: packages/shared-types/src/boss.ts adds BossFSMState enum (IDLE, CHASE, ATTACK)
       and extends BossState with fsmState: BossFSMState and attackCooldownTicks: number
  AC2: packages/shared-types/src/enemy.ts adds GRASSLAND_ADD = 'grassland-add' to EnemyType
  AC3: packages/game-rules/src/balance.ts adds a boss section with all required constants
       (BOSS_GRASSLAND_MAX_HP, BOSS_PHASE2_STOMP_COOLDOWN_TICKS, BOSS_REWARD_PER_ALIVE_PLAYER,
       BOSS_ADD_COUNT_HARD, BOSS_ADD_HP, BOSS_CHASE_SPEED, BOSS_CHASE_RANGE, BOSS_ATTACK_RANGE,
       BOSS_ATTACK_COOLDOWN_TICKS, BOSS_STOMP_RADIUS, BOSS_STOMP_ACTIVATION_RANGE,
       BOSS_CHARGE_ACTIVATION_MIN, BOSS_CHARGE_ACTIVATION_MAX, BOSS_CHARGE_SPEED,
       BOSS_CHARGE_COOLDOWN_TICKS)
  AC4: createBossState(runSeed: number): BossState returns a fully initialized BossState with
       hp === maxHp (BOSS_GRASSLAND_MAX_HP), phase: BossPhase.Phase1, isDefeated: false,
       fsmState: BossFSMState.IDLE, attackCooldownTicks: 0
       AND the function has zero Colyseus or planck.js imports
  AC5: tickBoss(boss, state, difficulty, spawnPoints) returns Result<BossEvent[], GameError>
       — never throws, always returns { ok: true/false }
       — on zero alive players, returns { ok: true, value: [] }
  AC6: Phase transition events emitted correctly:
       - Phase 2 triggers at boss.hp <= BOSS_PHASE2_HP_RATIO * maxHp (all difficulties)
       - Phase 3 triggers at boss.hp <= BOSS_PHASE3_HP_RATIO * maxHp (Hard only)
       - Each transition emits exactly one BossPhaseChangedEvt per run
  AC7: GrasslandAdd spawning: on Phase 3 trigger (Hard only), BOSS_ADD_COUNT_HARD BossAddSpawnedEvents
       are emitted with positions cycled from the spawnPoints array
  AC8: Boss defeat: when boss.hp <= 0, isDefeated is set to true and a BossDefeatedEvt is emitted
       containing a RunReward with essenceTotal = BOSS_REWARD_ESSENCE_BASE +
       (alive player count × BOSS_REWARD_PER_ALIVE_PLAYER), with essence split equally across
       ALL connected players
  AC9: Easy difficulty: Phase 2 triggered by same HP threshold (shorter StompLayer cooldown,
       no ChargeLayer); Phase 3 never triggers
  AC10: tests/unit/grassland-boss.test.ts has zero Colyseus or planck.js imports and all
        described test cases pass under vitest

Required hooks:
  - Simulation-safety hook: game-rules package changed.
    Satisfied by: vitest unit tests (AC10); typecheck passes.
  - Contract-change hook: packages/shared-types touched (BossState extension + EnemyType addition).
    MITIGATION: BossState extension adds fields to the interface only — no wire-breaking change since
    new fields are initialized in createBossState and in the 6.1 GameRoom.ts createEmptyGameState
    (which must also be updated to initialize fsmState: BossFSMState.IDLE, attackCooldownTicks: 0).
    EnemyType.GRASSLAND_ADD is additive — no existing code breaks.
    No new protocol tests required (pure simulation state, not in any delta message).

Required tests:
  - Phase 1 → Phase 2 HP threshold for each difficulty tier (Easy/Normal/Hard)
  - Phase 2 → Phase 3 (Hard only) transition and GrasslandAdd spawn count
  - Phase 3 does NOT trigger on Easy or Normal
  - Reward calculation: 4-player run with 2 alive, 2 in spirit form → correct essenceTotal
    and equal per-player split across all 4 players
  - Zero alive players: returns { ok: true, value: [] } without crash
  - Boss defeat: isDefeated true, BossDefeatedEvt emitted, reward present

Telemetry impact: None.
```

## Story

As a player,
I want the Grassland boss to escalate through multiple distinct phases with harder difficulties adding
new attack behaviors,
so that the boss fight feels like the climax of everything we fought through in the three preceding levels.

## Acceptance Criteria

1. **(AC1)** `packages/shared-types/src/boss.ts` is extended (appended — do not rewrite existing content):
   - `BossFSMState` enum: `IDLE = 'idle'`, `CHASE = 'chase'`, `ATTACK = 'attack'`
   - `BossState` interface gains two new fields: `fsmState: BossFSMState` and `attackCooldownTicks: number`
   - `packages/shared-types/src/index.ts` exports `BossFSMState`

2. **(AC2)** `packages/shared-types/src/enemy.ts` adds `GRASSLAND_ADD = 'grassland-add'` to the `EnemyType`
   enum. No other changes to enemy.ts.

3. **(AC3)** `packages/game-rules/src/balance.ts` gains a boss section appended after the bond constants.
   All values are `as const`. Required constants (use these exact names):
   - `BOSS_GRASSLAND_MAX_HP = 2000`
   - `BOSS_CHASE_RANGE = 600`
   - `BOSS_ATTACK_RANGE = 100`
   - `BOSS_ATTACK_COOLDOWN_TICKS = 60`
   - `BOSS_CHASE_SPEED = 60`
   - `BOSS_STOMP_ACTIVATION_RANGE = 250`
   - `BOSS_STOMP_RADIUS = 280`
   - `BOSS_PHASE2_STOMP_COOLDOWN_TICKS = 120` (vs. normal enemy STOMP_COOLDOWN_TICKS=240; Phase 2 Easy/Normal/Hard)
   - `BOSS_CHARGE_ACTIVATION_MIN = 200`
   - `BOSS_CHARGE_ACTIVATION_MAX = 600`
   - `BOSS_CHARGE_SPEED = 350`
   - `BOSS_CHARGE_COOLDOWN_TICKS = 150`
   - `BOSS_REWARD_PER_ALIVE_PLAYER = 50`
   - `BOSS_ADD_COUNT_HARD = 3`
   - `BOSS_ADD_HP = 200`

4. **(AC4)** `packages/game-rules/src/entities/grassland-boss.ts` is created.
   `createBossState(runSeed: number): BossState` returns:
   ```
   { id: `boss-grassland-${runSeed}`, entityType: 'grassland-boss', hp: BOSS_GRASSLAND_MAX_HP,
     maxHp: BOSS_GRASSLAND_MAX_HP, phase: BossPhase.Phase1, position: { x: 960, y: 540 },
     isDefeated: false, fsmState: BossFSMState.IDLE, attackCooldownTicks: 0 }
   ```
   Zero Colyseus or planck.js imports in this file.

5. **(AC5)** `tickBoss(boss: BossState, state: GameState, difficulty: DifficultyTier, spawnPoints: ReadonlyArray<{ x: number; y: number }>): Result<BossEvent[], GameError>`:
   - When zero alive players (all isDown or isSpirit): returns `{ ok: true, value: [] }`
   - Never throws — all errors returned as `{ ok: false, error: ... }`
   - `boss` parameter is mutated in place (same as tickEnemy mutates EnemyState.fsmState)

6. **(AC6)** Phase transitions (per tick, checked before behavior execution):
   - Phase 1 → Phase 2: when `boss.hp <= BOSS_PHASE2_HP_RATIO * boss.maxHp` AND `boss.phase === BossPhase.Phase1` → set `boss.phase = BossPhase.Phase2`, emit `BossPhaseChangedEvt`
   - Phase 2 → Phase 3: when `boss.hp <= BOSS_PHASE3_HP_RATIO * boss.maxHp` AND `boss.phase === BossPhase.Phase2` AND `difficulty === DifficultyTier.HARD` → set `boss.phase = BossPhase.Phase3`, emit `BossPhaseChangedEvt`
   - Phase 3 never triggered on Easy or Normal
   - Each transition emits exactly once (guard on `boss.phase` prevents re-emission)

7. **(AC7)** Phase 3 add spawning: when Phase 3 triggers, `BOSS_ADD_COUNT_HARD` `BossAddSpawnedEvent`s are
   appended to the events array. Positions cycle through `spawnPoints`: `spawnPoints[i % spawnPoints.length]`.
   Fallback position `{ x: 960, y: 200 }` used when `spawnPoints` is empty. IDs: `boss-add-${Date.now()}-${i}`.

8. **(AC8)** Defeat detection: when `boss.hp <= 0` AND `!boss.isDefeated`:
   - Set `boss.isDefeated = true`
   - Compute `RunReward`: `essenceTotal = BOSS_REWARD_ESSENCE_BASE + aliveCount × BOSS_REWARD_PER_ALIVE_PLAYER`
     where `aliveCount = state.players.filter(p => !p.isDown && !p.isSpirit).length`
   - `perPlayer`: distribute `Math.floor(essenceTotal / Math.max(1, state.players.length))` to each player
   - `achievements`: empty array (Story 6.5 fills this)
   - Return `{ ok: true, value: [{ type: 'boss:defeated', bossId: boss.id, reward }] }` immediately
     (skip behavior execution this tick)

9. **(AC9)** Behavior matrix by difficulty and phase:
   | Phase | Easy | Normal | Hard |
   |-------|------|--------|------|
   | Phase 1 | Base FSM + BossStompLayer (cooldown=STOMP_COOLDOWN_TICKS) | Same | Same |
   | Phase 2 | Base FSM + BossStompLayer (cooldown=BOSS_PHASE2_STOMP_COOLDOWN_TICKS) | + ChargeLayer prepended | + ChargeLayer prepended |
   | Phase 3 | Never reached | Never reached | Phase 2 layers + 3 adds spawned on transition |

10. **(AC10)** `packages/game-rules/tests/unit/grassland-boss.test.ts`:
    - Zero `colyseus` or `planck` imports
    - Uses vitest `describe`/`it`/`expect`
    - All specified test cases pass (see Required Tests section)

## Tasks / Subtasks

- [ ] **Task 1: Extend BossState in shared-types** (AC: 1)
  - [ ] Append `BossFSMState` enum to `packages/shared-types/src/boss.ts` after existing exports
  - [ ] Add `fsmState: BossFSMState` and `attackCooldownTicks: number` to `BossState` interface
  - [ ] `export * from './boss.js'` is already in index.ts from 6.1 — `BossFSMState` will be re-exported automatically via the wildcard; no change to index.ts needed

- [ ] **Task 2: Add GRASSLAND_ADD to EnemyType** (AC: 2)
  - [ ] Append `GRASSLAND_ADD = 'grassland-add'` to `EnemyType` enum in `packages/shared-types/src/enemy.ts`

- [ ] **Task 3: Add boss balance constants** (AC: 3)
  - [ ] Append boss section to `packages/game-rules/src/balance.ts` after the bond section
  - [ ] All 15 constants from AC3, each with `as const`

- [ ] **Task 4: Create packages/game-rules/src/entities/grassland-boss.ts** (AC: 4, 5, 6, 7, 8, 9)
  - [ ] Define local `BossEvent` union type (see Dev Notes — local event types section)
  - [ ] Export `BossAddSpawnedEvent` and `BossEvent` types (for GameRoom use in 6.3)
  - [ ] Implement `createBossState(runSeed: number): BossState`
  - [ ] Implement `tickBoss(boss, state, difficulty, spawnPoints)` main function
  - [ ] Implement defeat detection (guard first, returns immediately on defeat)
  - [ ] Implement phase transition detection (checked before behavior dispatch)
  - [ ] Implement `buildBossContext(boss, state)` → `EnemyContext` (reuse existing EnemyContext type)
  - [ ] Construct layer array based on difficulty and current phase (see behavior matrix in AC9)
  - [ ] Implement `tickBossBaseFSM(boss, ctx)` → `BossEvent[]` (mirrors tickBaseFSM from fsm.ts)
  - [ ] Implement `BossStompLayer` class (BehaviorLayer-compatible; 1-tick telegraph — see Dev Notes)
  - [ ] Implement `computeRunReward(state)` → `RunReward` private helper

- [ ] **Task 5: Update game-rules index.ts** (AC: 4)
  - [ ] Export `createBossState`, `tickBoss` from `./entities/grassland-boss.js`
  - [ ] Export `BossEvent`, `BossAddSpawnedEvent` types

- [ ] **Task 6: Write unit tests** (AC: 10)
  - [ ] Create `packages/game-rules/tests/unit/grassland-boss.test.ts`
  - [ ] Helper: `makeBossState(hp?: number, phase?: BossPhase)` — factory with sensible defaults
  - [ ] Helper: `makeGameState(playerCount: number, downCount: number)` — minimal GameState with players
  - [ ] All test cases from Required Tests section

- [ ] **Task 7: Typecheck and test** (AC: all)
  - [ ] `npm run typecheck --workspaces` — zero errors
  - [ ] `npm test` in `packages/game-rules/` — all tests pass

## Dev Notes

### Critical: Story 6.1 dependency

This story imports `BossState`, `BossPhase`, `RunReward`, and `GrasslandAchievement` from
`shared-types`, and `BOSS_PHASE2_HP_RATIO`, `BOSS_PHASE3_HP_RATIO`, `BOSS_REWARD_ESSENCE_BASE` from
`shared-types/constants`. These are all created in Story 6.1. **Do not implement Story 6.2 until
Story 6.1 is merged.** If you find these types missing, stop and check the sprint status.

### Critical: BossState extension must not break 6.1

Story 6.1's `createEmptyGameState` in `GameRoom.ts` initializes `boss: null`. When the boss is
created via `createBossState()`, the returned object will now have `fsmState` and `attackCooldownTicks`.
No call site breaks from adding fields to the interface — TypeScript will only complain if you
construct a `BossState` literal without the new fields. Check:
- `createBossState()` in this story — must include new fields
- If Story 6.1's dev adds any literal `BossState` construction anywhere, update it

### Critical: function signature deviates from epics spec

The epics spec lists `tickBoss(boss, state, world, difficulty)` with a `planck.World` parameter.
**This story drops the `world` parameter** and replaces it with
`spawnPoints: ReadonlyArray<{ x: number; y: number }>`.

Reason: `tickBoss` is a pure game-rules function (no planck runtime calls). The `world` would have
no role here — spawn point positions come from the boss arena definition (Story 6.3), and the unit
tests cannot construct a real planck World without importing planck. Passing spawn points as plain
data keeps the function pure and testable.

Story 6.3's GameRoom integration will pass the arena's four edge spawn points when calling
`tickBoss`. The ponytail deviation is recorded here — if a reviewr asks about the World param,
point to this note.

### Local event types

Define these locally in `grassland-boss.ts` (same pattern as `EnemyAIEvent` in fsm.ts):

```typescript
export type BossMovedEvent   = { type: 'boss:moved';   bossId: string; x: number; y: number };
export type BossStompedEvent = { type: 'boss:stomped'; bossId: string; x: number; y: number; radius: number };
export type BossChargedEvent = { type: 'boss:charged'; bossId: string; x: number; y: number };
// These two are structurally identical to BossPhaseChangedDelta / BossDefeatedDelta from net-protocol.
// GameRoom can assign them to DeltaEventMsg union via structural typing — no cast needed (same trick as EnemyAIEvent → EnemyMovedDelta/EnemyStompedDelta).
export type BossPhaseChangedEvt = { type: 'boss:phaseChanged'; bossId: string; newPhase: BossPhase };
export type BossDefeatedEvt     = { type: 'boss:defeated';     bossId: string; reward: RunReward };
// Not yet in DeltaEventMsg — Story 6.3 adds it when wiring GameRoom
export type BossAddSpawnedEvent = { type: 'add:spawned'; enemyId: string; x: number; y: number };

export type BossEvent =
  | BossMovedEvent
  | BossStompedEvent
  | BossChargedEvent
  | BossPhaseChangedEvt
  | BossDefeatedEvt
  | BossAddSpawnedEvent;
```

### Reusing BehaviorLayer for the boss

The existing `BehaviorLayer` interface (`game-rules/src/systems/ai/fsm.ts`) uses `EnemyState` in
`execute()`. The boss has its own `BossState` — similar shape but different type. Two options:

**Option A (recommended — ponytail)**: Adapt `BehaviorLayer` to generic:
```typescript
export interface BehaviorLayer<S = EnemyState> {
  shouldActivate(ctx: EnemyContext): boolean;
  execute(entity: S, ctx: EnemyContext): EnemyAIEvent[];  // EnemyAIEvent for enemy layers
  cooldown: number;
  currentCooldown: number;
}
```
...but this requires changing the existing interface, which risks breaking existing StompLayer/ChargeLayer.

**Option B (simplest — use same BehaviorLayer, cast or adapt)**: Since `BossState` and `EnemyState`
share the positional fields `x/y` (boss uses `position.{x,y}` not top-level — **watch this difference**),
define `BossBehaviorLayer` as a parallel interface in `grassland-boss.ts`:

```typescript
interface BossBehaviorLayer {
  shouldActivate(ctx: EnemyContext): boolean;
  execute(boss: BossState, ctx: EnemyContext): BossEvent[];
  cooldown: number;
  currentCooldown: number;
}
```

Use this local interface for boss-specific layers. **Do not modify** the existing `BehaviorLayer`
interface — it's used by enemy code that should not be touched.

**WARNING — position field difference**: `EnemyState` has `x` and `y` as top-level fields.
`BossState` (from Story 6.1 spec) has `position: { x: number; y: number }`. When reading boss
coordinates, use `boss.position.x / boss.position.y`. When mutating, update `boss.position.x`.
The `EnemyContext.nearestPlayerPos` is fine as-is.

### BossStompLayer — 1-tick telegraph

The existing `StompLayer` fires immediately on activation. The boss stomp needs:
- Tick N (telegraph): set internal `telegraphing = true`, return `[{ type: 'boss:stomped', ...radius }]`
  with radius as the FULL stomp radius (host shows warning circle — same event, host decides how to render it)
- Tick N+1 (activation): emit NO event; damage is applied by GameRoom when it processes the initial event

Wait — the simpler interpretation: the "telegraph for one tick" means the GameRoom applies damage
with a 1-tick delay after receiving `boss:stomped`. **The boss function just emits the event once.**
The host shows a warning circle for 1 tick before the damage tick. This matches the simpler
implementation:

```typescript
class BossStompLayer implements BossBehaviorLayer {
  cooldown: number;
  currentCooldown = 0;
  constructor(cooldown: number) { this.cooldown = cooldown; }

  shouldActivate(ctx: EnemyContext): boolean {
    return ctx.nearestPlayerDistance <= BOSS_STOMP_ACTIVATION_RANGE;
  }

  execute(boss: BossState, _ctx: EnemyContext): BossEvent[] {
    return [{ type: 'boss:stomped', bossId: boss.id, x: boss.position.x, y: boss.position.y, radius: BOSS_STOMP_RADIUS }];
  }
}
```

For the unit tests, telegraph timing is NOT tested (that's a GameRoom concern in 6.3). The test
only verifies that `boss:stomped` events are returned when the stomp layer activates.

### Boss base FSM

Mirror `tickBaseFSM` from `fsm.ts` but adapted for BossState's `position.{x,y}`:

```typescript
function tickBossBaseFSM(boss: BossState, ctx: EnemyContext): BossEvent[] {
  switch (boss.fsmState) {
    case BossFSMState.IDLE:   return tickBossIdle(boss, ctx);
    case BossFSMState.CHASE:  return tickBossChase(boss, ctx);
    case BossFSMState.ATTACK: return tickBossAttack(boss);
  }
}
```

Behavior: same transitions as enemy FSM but using `BOSS_CHASE_RANGE`, `BOSS_ATTACK_RANGE`,
`BOSS_CHASE_SPEED`, `BOSS_ATTACK_COOLDOWN_TICKS`.

### tickBoss overall structure

```
1. If boss.isDefeated → return { ok: true, value: [] }
2. If boss.hp <= 0 → set isDefeated, compute reward, return defeat event
3. Check and emit phase transitions (Phase 1→2, then Phase 1/2→3 if Hard)
   Immediately append phase events to result
4. Build EnemyContext (nearest alive player)
5. If no alive players → return { ok: true, value: phase_events_so_far }
6. Build layer array for current difficulty + phase (per behavior matrix in AC9)
7. Run layer loop (same as tickEnemy): first activated layer short-circuits
8. If no layer fired: run tickBossBaseFSM
9. Return { ok: true, value: [...phase_events, ...behavior_events] }
```

### Phase transition must emit before behavior

Phase events should be collected first, then appended to behavior events in the return value.
This means a phase transition tick may contain BOTH a phase event AND a movement/attack event.

### computeRunReward

```typescript
function computeRunReward(state: GameState): RunReward {
  const alive = state.players.filter(p => !p.isDown && !p.isSpirit);
  const essenceTotal = BOSS_REWARD_ESSENCE_BASE + alive.length * BOSS_REWARD_PER_ALIVE_PLAYER;
  const perShare = Math.floor(essenceTotal / Math.max(1, state.players.length));
  return {
    essenceTotal,
    perPlayer: state.players.map(p => ({ playerId: p.id, essence: perShare, masteryMilestones: [] })),
    achievements: [],  // ponytail: achievements filled by Story 6.5
  };
}
```

`BOSS_REWARD_ESSENCE_BASE` is imported from `'shared-types'` (constants.ts, added by Story 6.1).
`BOSS_REWARD_PER_ALIVE_PLAYER` is imported from `'../../balance.js'` (added in this story, Task 3).

### Test helper patterns

```typescript
function makeBossState(overrides: Partial<BossState> = {}): BossState {
  const s = createBossState(42);
  return Object.assign(s, overrides);
}

function makeGameState(playerCount: number, downCount = 0): GameState {
  const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`, displayName: `P${i}`, class: null,
    x: 200, y: 200, hp: 100, maxHp: 100,
    isFrozen: false, isDown: i < downCount, isSpirit: false,
    sessionColor: 'red' as SessionColor, downCount: 0,
    nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0,
  }));
  return {
    session: { roomId: 'test', hostId: 'h', phase: 'dungeon', playerCount,
      maxPlayers: 8, runSeed: 0, levelIndex: 3, difficulty: null,
      levelObjective: 'clear', waveIndex: 0, totalWaves: 0 },
    players, enemies: [], activeBonds: [], essenceDrops: [],
    tick: 0, floorLayout: null, runProposal: null,
    boss: null,  // not needed for tickBoss (boss is passed directly)
  };
}
```

### File structure after this story

```
packages/game-rules/src/
  entities/
    grassland-boss.ts   ← NEW
  systems/
    ai/
      fsm.ts            (unchanged)
      layers/
        charge.ts       (unchanged)
        stomp.ts        (unchanged)
    combat.ts           (unchanged)
    bonds.ts            (unchanged)
    player-health.ts    (unchanged)
  balance.ts            (MODIFY — boss section appended)
  index.ts              (MODIFY — new exports)

packages/game-rules/tests/
  unit/
    grassland-boss.test.ts  ← NEW
  xoshiro128.test.ts    (unchanged)

packages/shared-types/src/
  boss.ts               (MODIFY — BossFSMState + 2 BossState fields)
  enemy.ts              (MODIFY — GRASSLAND_ADD in EnemyType)
```

### ESM import paths

All intra-package imports use `.js` extension:
- `import { BOSS_GRASSLAND_MAX_HP, ... } from '../../balance.js';`
- `import type { BossState, BossPhase, BossFSMState, RunReward, GameState } from 'shared-types';`
- `import { BossPhase, BossFSMState, DifficultyTier } from 'shared-types';`
- `import type { Result, GameError } from '../../state/result.js';`
- `import { BOSS_PHASE2_HP_RATIO, BOSS_PHASE3_HP_RATIO, BOSS_REWARD_ESSENCE_BASE } from 'shared-types';`

### DifficultyTier enum import

`DifficultyTier` (EASY/NORMAL/HARD) lives in `packages/shared-types/src/enemy.ts`. It's already
exported from `shared-types` index. Import as: `import { DifficultyTier } from 'shared-types';`

### Project Context Rules

- **Pure simulation**: `grassland-boss.ts` has zero Colyseus imports. It may import planck types
  (`import type { World }` is NOT needed with this story's signature change). No planck runtime calls.
- **Authority model**: `packages/game-rules` is Simulation Engineer territory. The two shared-types
  changes (BossState extension, EnemyType addition) are mechanical cross-boundary changes sanctioned
  by the same precedent as Story 6.1's `boss: null` additions to GameRoom.ts.
- **No Math.random()**: PRNG not needed in this story. Boss ID uses `runSeed` directly.
- **TypeScript strict mode**: All new code must be clean under `"strict": true`. No `any`.
- **No `as const` needed for enum values**: Only needed for numeric/string literal constants in
  balance.ts — use `= N as const` there.
- **Mutation pattern**: `tickBoss` mutates `boss` in place (fsmState, position.x/y, phase,
  attackCooldownTicks, isDefeated), same as `tickEnemy` mutates `enemy.fsmState`, `enemy.x/y`.

### References

- Epic 6 Story 6.2 acceptance criteria: `_bmad-output/planning-artifacts/epics.md` lines 1235–1305
- Enemy FSM pattern: `packages/game-rules/src/systems/ai/fsm.ts` (full file)
- StompLayer reference: `packages/game-rules/src/systems/ai/layers/stomp.ts` (full file)
- ChargeLayer reference: `packages/game-rules/src/systems/ai/layers/charge.ts` (full file)
- BossState spec (after 6.1): `packages/shared-types/src/boss.ts`
- balance.ts current state: `packages/game-rules/src/balance.ts` (append after line 128)
- Result type: `packages/game-rules/src/state/result.ts`
- Vitest test style: `packages/game-rules/tests/xoshiro128.test.ts`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---
baseline_commit: SET_TO_HEAD_AFTER_STORY_3_2_MERGE
---

# Story 3.3: 4 Alpha Class Implementations — Abilities & Input Types

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Story 3.1 added the physics world and PRNG. Story 3.2 (must be merged
  first) adds the enemy AI FSM, balance.ts (with getEnemyCount / OFFSET_ENEMY_SPAWN),
  and the no-op enemy AI tick loop in GameRoom.ts. Story 3.3 brings the first
  playable dungeon moment: host:start transitions the session to 'dungeon', enemies
  are spawned using PRNG + balance.ts, and the 4 alpha classes (Stonehide,
  Spiritcaller, Souldrinker, Stormcaller) dispatch abilities with per-class cooldowns
  and damage from balance.ts. Skill cells on the mobile controller become interactive
  during the dungeon phase (not just near the training dummy). The host receives an
  AbilityFiredDelta for in-canvas feedback.
Owner agent: Simulation Engineer (primary); Protocol Architect co-owns the
  shared-types and net-protocol changes (contract-change hook required); Mobile
  Controller Engineer co-owns ControllerScreen changes (client-UX hook required);
  Host Experience Engineer co-owns host App.tsx + DungeonScreen (client-UX hook).
Goal: Wire host:start into a dungeon phase transition that spawns enemies; create
  a pure ability dispatch system in game-rules; extend balance.ts with per-class
  cooldown + damage tables; broadcast AbilityFiredDelta to host on ability fire;
  send CooldownUpdateMsg to mobile with per-class values; unlock skill cells during
  dungeon phase; fix D-2.3-D double-RELEASE-fire; fix D-2.3-C applyDelta
  exhaustiveness; add a placeholder DungeonScreen on the host.
Allowed paths:
  - packages/game-rules/src/systems/abilities.ts              (NEW)
  - packages/game-rules/src/balance.ts                       (MODIFY — add ability tables)
  - packages/game-rules/src/index.ts                         (MODIFY — export ability symbols)
  - packages/net-protocol/src/messages/server-to-host.ts     (MODIFY — AbilityFiredDelta)
  - packages/net-protocol/src/apply-delta.ts                 (MODIFY — ability:fired + exhaustiveness)
  - packages/net-protocol/src/index.ts                       (MODIFY — export AbilityFiredDelta)
  - packages/net-protocol/src/event-names.ts                 (MODIFY if needed for new event names)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — host:start, dungeon init, ability dispatch)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — dungeon isInteractive, fix D-2.3-D)
  - apps/host-client/src/App.tsx                            (MODIFY — route 'dungeon' phase)
  - apps/host-client/src/screens/DungeonScreen.tsx          (NEW — placeholder dungeon canvas)
  - tests/unit/abilities.test.ts                             (NEW)
  - tests/contract/net-protocol.test.ts                      (MODIFY — AbilityFiredDelta round-trip)
Blocked paths:
  - packages/shared-types/src/player.ts          (no new player fields this story)
  - apps/backend-platform/**                     (no backend changes)
Inputs:
  - packages/game-rules/src/balance.ts           (created by 3.2 — extend it)
  - packages/game-rules/src/state/result.ts      (created by 3.2 — reuse Result<T,E>)
  - packages/shared-types/src/class-definitions.ts   (current — 4 classes, abilities, inputTypes)
  - packages/shared-types/src/session.ts         (current — phase: 'lobby'|'hub'|'dungeon'|'post-run')
  - packages/shared-types/src/enemy.ts           (as modified by 3.2 — includes FSM fields)
  - packages/net-protocol/src/messages/server-to-host.ts   (current)
  - packages/net-protocol/src/apply-delta.ts     (current)
  - apps/simulation-server/src/rooms/GameRoom.ts (as modified by 3.2)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (current)
  - apps/host-client/src/App.tsx                 (current)
Non-goals:
  - Combat hitboxes and damage application against enemies (Story 3.4)
  - Enemy-player collision detection (Story 3.4)
  - Player health reduction from enemy attacks (Story 3.4)
  - Spirit Essence drops and collection (Story 3.4)
  - Player downed / revive timer (Story 3.5)
  - Spirit form (Story 3.6)
  - Clear objective completion (Story 3.7)
  - Full host dungeon rendering (enemy sprites, health bars, ability VFX) (Story 3.4+)
  - Extracting movement into game-rules/systems/movement.ts (future refactor)
  - Mastery counter tracking (Epic 7)
  - Difficulty selection UX (Epic 4)
  - Bounds clamping for dungeon enemies (deferred D-3.1-C)
Acceptance criteria:
  AC1: balance.ts has per-class cooldown tables: every class has at least one
       ability with cooldown ≤ 3000ms; no hardcoded values in GameRoom.ts for
       ability cooldowns.
  AC2: host:start message transitions session.phase to 'dungeon'; enemies are
       spawned using getEnemyCount(playerCount, /* easy tier */ 0) from balance.ts
       and PRNG positions (deterministic from runSeed); full snapshot broadcast.
  AC3: In 'dungeon' phase, an InputEventMsg with ability index fires the correct
       ability dispatch: per-class cooldown from balance.ts is applied; CooldownUpdateMsg
       is sent to the mobile client with the correct remainingMs; AbilityFiredDelta
       is broadcast to all (host renders in-canvas effect placeholder).
  AC4: Skill cells in ControllerScreen are interactive when session.phase === 'dungeon'
       (not only trainingDummyActive); touchAction: 'none' applies to the right zone
       in dungeon mode; joystick and skill cell can be held simultaneously without
       one cancelling the other (multi-touch, NFR6).
  AC5: D-2.3-D fixed — RELEASE-type ability fires exactly once per lift (not twice
       when lift occurs inside the cell's bounds).
  AC6: D-2.3-C fixed — applyDelta switch has exhaustiveness guard: the default
       branch asserts `satisfies never` so TypeScript catches missing delta cases
       at compile time.
  AC7: tests/unit/abilities.test.ts passes: correct cooldown value returned for
       each class slot; AUTO ability fires direction; TAP fires with (0, 0); RELEASE
       fires direction from stored vector. No Colyseus or planck imports in abilities.ts.
  AC8: tests/contract/net-protocol.test.ts passes: AbilityFiredDelta round-trip;
       snapshot with session.phase = 'dungeon' survives serialize → deserialize.
  AC9: DungeonScreen renders a PixiJS canvas in place of HubWorldScreen when
       session.phase === 'dungeon' on the host; ability:fired delta causes a brief
       flash (opacity pulse) on the firing player's circle; enemy circles are drawn
       at their positions.
  AC10: npm run typecheck clean across all packages.
Required hooks:
  - Contract-change hook: Protocol Architect review required (new delta type in
    server-to-host.ts). At least one contract test per new message type.
  - Simulation-safety hook: typecheck + unit tests pass before merge.
  - Client-UX hook (mobile): joystick mapping, skill mapping, multi-touch check.
  - Client-UX hook (host): dungeon canvas visible, ability flash visible.
Required tests:
  - tests/unit/abilities.test.ts — cooldown table, direction dispatch, input types
  - tests/contract/net-protocol.test.ts — AbilityFiredDelta round-trip
Telemetry impact: none this story
```

---

## Story

As a player,
I want to play as Stonehide, Spiritcaller, Souldrinker, or Stormcaller with fully functional abilities,
So that each class feels mechanically distinct and fulfills its role in a run.

---

## Acceptance Criteria

**AC1 — Class abilities loaded from balance:**
**Given** a player has confirmed a class and the host starts the dungeon
**When** the simulation server initializes the dungeon phase
**Then** each player's ability cooldowns are read from `balance.ts` per their class and ability index
**And** every class has at least one ability with a cooldown ≤ 3000ms (Pillar 1 floor)
**And** no hardcoded `TRAINING_DUMMY_COOLDOWN_MS` constant exists in `GameRoom.ts`

**AC2 — Dungeon phase transition and enemy spawn:**
**Given** the host sends `host:start` and all connected players have a non-null class
**When** the `HOST_START` handler runs in `GameRoom.ts`
**Then** `session.phase` is set to `'dungeon'` and `session.levelIndex` is set to `1`
**And** `getEnemyCount(playerCount, 0)` enemies are spawned using PRNG positions derived from `runSeed` via the `OFFSET_ENEMY_SPAWN` constant from `balance.ts`
**And** each enemy has a planck.js dynamic body created in the physics world
**And** a full `SnapshotMsg` is broadcast to all clients with the updated state

**AC3 — Ability fires in dungeon with correct cooldown and deltas:**
**Given** a player sends an `InputEventMsg` with `event.type === 'ability'` while `session.phase === 'dungeon'`
**When** the sim tick processes the input
**Then** the correct ability fires using direction from `ability.directionX / directionY`
**And** the ability enters cooldown using the class-specific value from `balance.ts`; a `CooldownUpdateMsg` with the correct `remainingMs` is sent directly to the mobile client
**And** an `AbilityFiredDelta` is broadcast to all clients (including host) containing `playerId`, `abilityIndex`, `directionX`, `directionY`
**And** the server does not apply actual damage to enemies (Story 3.4)

**AC4 — Skill cells interactive in dungeon (multi-touch):**
**Given** `session.phase === 'dungeon'` on the mobile controller
**When** the `ControllerScreen` renders
**Then** skill cells are interactive (`isInteractive = true`) regardless of `trainingDummyActive`
**And** `touchAction: 'none'` is applied to the right zone so multi-touch is not suppressed
**When** the player holds both the left joystick and a right-zone skill cell simultaneously
**Then** both touches are tracked independently by `Touch.identifier`; movement and ability aim operate independently

**AC5 — RELEASE fires exactly once (fix D-2.3-D):**
**Given** the player holds a RELEASE-type skill cell and lifts inside the cell's bounds
**When** the lift event fires
**Then** `onAbilityFire` is called exactly once (not twice)
**And** lifting outside the cell bounds still fires exactly once via the document-level handler

**AC6 — applyDelta exhaustiveness guard (fix D-2.3-C):**
**Given** a new `DeltaEventMsg` variant is added to `server-to-host.ts`
**When** `applyDelta` is not updated to handle it
**Then** TypeScript compile fails at the `default` branch assertion

**AC7 — Ability unit tests:**
**Given** `tests/unit/abilities.test.ts` runs
**Then** all cooldown table tests pass (correct ms per class per slot)
**And** AUTO dispatch with direction (0.7, 0.7) returns direction (0.7, 0.7)
**And** TAP dispatch always returns direction (0, 0)
**And** RELEASE dispatch returns the stored drag direction
**And** no Colyseus or planck imports exist in `packages/game-rules`

**AC8 — AbilityFiredDelta contract test:**
**Given** `tests/contract/net-protocol.test.ts` runs
**Then** `ability:fired` delta survives serialize → deserialize round-trip
**And** a `SnapshotMsg` with `session.phase = 'dungeon'` survives serialize → deserialize

**AC9 — Dungeon canvas on host:**
**Given** `session.phase === 'dungeon'` in `gameState`
**When** the host `App.tsx` renders
**Then** `DungeonScreen` is rendered instead of `HubWorldScreen`
**And** enemy circles appear at their positions in the virtual 1920×1080 space (scaled)
**And** when `AbilityFiredDelta` is received, the firing player's circle briefly flashes (opacity pulse ~300ms)

**AC10 — Typecheck clean:**
**Given** `npm run typecheck` runs across all packages
**Then** no TypeScript errors; all new types satisfy the `satisfies` checks used in `GameRoom.ts`

---

## Dev Notes

### Critical dependency: Story 3.2 must be merged first

This story builds directly on artifacts Story 3.2 creates. Do not begin implementation until 3.2 is merged:

| 3.2 artifact | Used by 3.3 |
|---|---|
| `packages/game-rules/src/balance.ts` | Extend with per-class ability tables |
| `packages/game-rules/src/state/result.ts` | `Result<T,E>` in `abilities.ts` |
| `packages/shared-types/src/constants.ts` (`OFFSET_ENEMY_SPAWN`) | Enemy spawn positions |
| `balance.ts` `getEnemyCount(playerCount, tier)` | Enemy count at dungeon start |
| `EnemyState` FSM fields | Enemy bodies already created by 3.2's no-op loop |
| `tests/unit/` directory (created by fsm.test.ts) | Add `abilities.test.ts` here |
| `GameRoom.ts` enemy AI loop scaffold | 3.3 wires it by populating `gameState.enemies` |

### What already exists and must be preserved

**`packages/shared-types/src/class-definitions.ts`** — Already has all 4 alpha classes with 4 abilities each and `inputType: 'AUTO' | 'RELEASE' | 'TAP'`. Do NOT add cooldown or damage to `ClassAbilityDef` — those live in `balance.ts`. The client uses `class-definitions.ts` for display only.

**`packages/net-protocol/src/messages/server-to-mobile.ts`** — `CooldownUpdateMsg` already exists:
```typescript
{ type: 'cooldown:update'; abilityIndex: number; remainingMs: number }
```
`remainingMs > 0` = cooldown started; `remainingMs === 0` = cooldown expired. This is sent via `EventNames.COOLDOWN_UPDATE` directly to the mobile client (not broadcast). Keep this pattern.

**`apps/mobile-controller/src/screens/ControllerScreen.tsx`** — `SkillCell` is fully implemented including conic-gradient cooldown overlay, AUTO interval firing, RELEASE direction tracking, TAP tap-flash. The only changes needed are: (1) `isInteractive` condition, (2) `touchAction` on right zone, (3) fix D-2.3-D.

**`apps/simulation-server/src/rooms/GameRoom.ts`** — `cooldownMap` already exists. The training dummy block (lines ~354–385) hardcodes `TRAINING_DUMMY_COOLDOWN_MS = 3000` and gates on `player.nearPoiId !== 'training-dummy'`. Story 3.3 replaces this block with a generalized ability dispatch that works in any phase where ability input is valid.

**`packages/shared-types/src/session.ts`** — phase type already includes `'dungeon'`. No changes needed here.

**`apps/host-client/src/App.tsx`** — Local `AppScreen` state is separate from `session.phase`. The simplest routing: inside the `hub-world` branch, check `gameState?.session.phase === 'dungeon'` and render `DungeonScreen` instead.

---

### balance.ts additions (extend what 3.2 creates)

Add to `packages/game-rules/src/balance.ts`:

```typescript
import type { PlayerClass } from 'shared-types';

// Cooldowns in milliseconds per class per ability slot (index 0–3).
// GDD: "core abilities fire on 1–2 second cycles; tempo never lets the player disengage."
// AC requires at least one ability per class with cooldown ≤ 3000ms.
export const ABILITY_COOLDOWNS_MS: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:     [2000, 4000, 6000, 1000],  // Stone Wall, Tremor Stomp, Iron Skin, Avalanche(AUTO)
  spiritcaller:  [1500, 5000, 4000, 6000],  // Ancestor's Voice(AUTO), Spirit Nova, Soul Mend, Warding Cry
  souldrinker:   [1000, 3000, 5000, 4000],  // Blood Draw(AUTO), Crimson Lash, Dark Pact, Void Pulse
  stormcaller:   [1000, 3000, 5000, 2000],  // Lightning Arc(AUTO), Tempest Hurl, Thunder Clap, Storm Eye(AUTO)
};

// Base damage per ability per class (used by Story 3.4 combat resolution; defined here for balance).
// Placeholder alpha values — tune during playtesting.
export const ABILITY_DAMAGE: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:     [15, 35, 0,  50],   // Avalanche is continuous (15/hit), Tremor AoE 35, Iron Skin = 0 (buff), Avalanche again
  spiritcaller:  [0,  40, 0,  0],    // Ancestor's Voice = heal (no damage), Spirit Nova = burst heal, Soul Mend = heal, Warding Cry = buff
  souldrinker:   [12, 30, 0,  25],   // Blood Draw drain, Crimson Lash whip, Dark Pact = debuff, Void Pulse
  stormcaller:   [18, 40, 45, 0],    // Lightning Arc continuous, Tempest Hurl thrown, Thunder Clap AoE, Storm Eye = field (no damage)
};
```

Note: These are ALPHA PLACEHOLDER values. Damage numbers are referenced but not applied until Story 3.4. The cooldowns ARE applied in this story.

---

### abilities.ts — new pure function system

Create `packages/game-rules/src/systems/abilities.ts`:

```typescript
import type { PlayerClass } from 'shared-types';
import type { AbilityInputType } from 'shared-types';
import type { Result } from '../state/result.js';
import { ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE } from '../balance.js';
import { CLASS_DEFINITIONS } from 'shared-types';

export interface AbilityDispatchContext {
  playerClass: PlayerClass;
  abilityIndex: number;  // 0–3
  directionX: number;
  directionY: number;
  cooldownExpiresAt: number;  // current expiry from cooldownMap (0 = not on cooldown)
  nowMs: number;
}

export interface AbilityFiredEvent {
  cooldownMs: number;
  expiresAt: number;
  directionX: number;
  directionY: number;
  damage: number;
}

export type GameError = { code: string; detail?: string };

// Pure function — no Colyseus, no planck, no I/O.
// Returns the dispatch result or an error if ability cannot fire.
export function dispatchAbility(ctx: AbilityDispatchContext): Result<AbilityFiredEvent, GameError> {
  if (ctx.abilityIndex < 0 || ctx.abilityIndex > 3) {
    return { ok: false, error: { code: 'INVALID_ABILITY_INDEX', detail: String(ctx.abilityIndex) } };
  }

  if (ctx.cooldownExpiresAt > ctx.nowMs) {
    return { ok: false, error: { code: 'ON_COOLDOWN' } };
  }

  const classDef = CLASS_DEFINITIONS[ctx.playerClass];
  const ability = classDef.abilities[ctx.abilityIndex];
  if (!ability) {
    return { ok: false, error: { code: 'ABILITY_NOT_FOUND' } };
  }

  const cooldownMs = ABILITY_COOLDOWNS_MS[ctx.playerClass][ctx.abilityIndex];
  const damage = ABILITY_DAMAGE[ctx.playerClass][ctx.abilityIndex];

  // TAP abilities have no direction (fired from player position, no aim)
  const inputType: AbilityInputType = ability.inputType;
  const dirX = inputType === 'TAP' ? 0 : ctx.directionX;
  const dirY = inputType === 'TAP' ? 0 : ctx.directionY;

  return {
    ok: true,
    value: {
      cooldownMs,
      expiresAt: ctx.nowMs + cooldownMs,
      directionX: dirX,
      directionY: dirY,
      damage,
    },
  };
}
```

**No Colyseus or planck imports** — `dispatchAbility` is pure. Test it without any server bootstrap.

Export from `packages/game-rules/src/index.ts`:
```typescript
export { dispatchAbility } from './systems/abilities.js';
export type { AbilityDispatchContext, AbilityFiredEvent, GameError } from './systems/abilities.js';
```

---

### AbilityFiredDelta — new protocol type

Add to `packages/net-protocol/src/messages/server-to-host.ts`:

```typescript
export type AbilityFiredDelta = {
  type: 'ability:fired';
  playerId: string;
  abilityIndex: number;
  directionX: number;
  directionY: number;
};
```

Add `AbilityFiredDelta` to the `DeltaEventMsg` union.

Export from `packages/net-protocol/src/index.ts`.

---

### apply-delta.ts — add ability:fired case + exhaustiveness guard (fix D-2.3-C)

```typescript
case 'ability:fired': {
  // ponytail: no-op on host state — effect is purely visual; DungeonScreen reads the raw delta
  return state;
}
// After all cases:
default: {
  // Type-level exhaustiveness: if a new DeltaEventMsg variant is added without a case here,
  // TypeScript will error on this line. Never remove this.
  const _exhaustive: never = evt;
  void _exhaustive;
  return state;
}
```

Note: The `default` guard requires that `DeltaEventMsg` union is exhausted. This will catch `ability:fired` if forgotten — but since we're adding the case, it's handled. The guard protects ALL future stories that add new delta types.

Also add handling for `player:downed` and `player:revived` (currently in DeltaEventMsg union but missing from applyDelta — verified by compiling after adding the never-guard):
```typescript
case 'player:downed': {
  // ponytail: tracked via delta for host HUD (Story 3.5) — update isDown in state
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return { ...state, players: state.players.map(p =>
    p.id === evt.playerId ? { ...p, isDown: true, downCount: evt.downCount } : p
  )};
}
case 'player:revived': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return { ...state, players: state.players.map(p =>
    p.id === evt.playerId ? { ...p, isDown: false } : p
  )};
}
```

Check what other delta types are in the union that may be missing from the switch after adding the guard. Add no-op `return state` cases for any that are in the union but have no state effect yet (e.g., `enemy:stomped` from 3.2, `bond:assigned`, etc.).

---

### GameRoom.ts changes

**1. Replace training dummy ability block with general dispatch:**

Remove the block starting at:
```typescript
// Process ability inputs — training dummy only (inline cooldown; Story 3.x moves to game-rules/balance.ts)
const TRAINING_DUMMY_COOLDOWN_MS = 3000;
```

Replace with:
```typescript
// Process ability inputs — valid in dungeon phase or near training dummy
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type !== 'ability') continue;
  const { abilityIndex, directionX, directionY } = msg.event.ability;

  const player = this.gameState.players.find(p => p.id === clientId);
  if (!player || player.class === null || player.isFrozen) continue;

  const inDungeon = this.gameState.session.phase === 'dungeon';
  const atTrainingDummy = player.nearPoiId === 'training-dummy';
  if (!inDungeon && !atTrainingDummy) continue;

  const playerCooldowns = this.cooldownMap.get(clientId);
  if (!playerCooldowns) continue;

  const nowAbility = Date.now();
  const result = dispatchAbility({
    playerClass: player.class,
    abilityIndex,
    directionX,
    directionY,
    cooldownExpiresAt: playerCooldowns[abilityIndex] ?? 0,
    nowMs: nowAbility,
  });

  if (!result.ok) continue;  // on cooldown or invalid — discard silently

  const { cooldownMs, expiresAt, directionX: dirX, directionY: dirY } = result.value;
  playerCooldowns[abilityIndex] = expiresAt;

  const targetClient = this.clients.find(c => c.sessionId === clientId);
  if (targetClient) {
    targetClient.send(EventNames.COOLDOWN_UPDATE, {
      type: 'cooldown:update',
      abilityIndex,
      remainingMs: cooldownMs,
    } satisfies CooldownUpdateMsg);
  }

  if (inDungeon) {
    const abilityDelta = {
      type: 'ability:fired' as const,
      playerId: clientId,
      abilityIndex,
      directionX: dirX,
      directionY: dirY,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, abilityDelta);
  }

  logger.debug({ roomId: this.roomId, clientId, abilityIndex, dirX, dirY }, 'ability fired');
}
```

**2. Wire host:start to dungeon phase:**

Replace the current no-op `HOST_START` handler:
```typescript
this.onMessage(EventNames.HOST_START, () => {
  // Validate: all players must have a confirmed class
  const unready = this.gameState.players.filter(p => p.class === null);
  if (unready.length > 0) {
    logger.warn({ roomId: this.roomId, unready: unready.length }, 'host:start rejected — players without class');
    return;
  }

  this.gameState.session.phase = 'dungeon';
  this.gameState.session.levelIndex = 1;

  // Spawn enemies: PRNG-deterministic from runSeed (via OFFSET_ENEMY_SPAWN)
  this.spawnEnemies();

  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId }, 'dungeon phase started');
});
```

**3. Add spawnEnemies() private method:**

```typescript
private spawnEnemies(): void {
  const count = getEnemyCount(this.gameState.players.length, 0);  // 0 = Easy tier
  // Advance PRNG to enemy spawn offset before using it for enemy positions
  for (let i = 0; i < OFFSET_ENEMY_SPAWN; i++) this.prng();

  for (let i = 0; i < count; i++) {
    const id = `enemy-${i}`;
    // Scatter enemies around the dungeon virtual space (avoid center player spawn)
    const x = 200 + this.prng() * 1520;  // [200, 1720] in virtual pixels
    const y = 200 + this.prng() * 680;   // [200, 880] in virtual pixels
    const enemy: EnemyState = {
      id,
      type: EnemyType.GRUNT,
      x,
      y,
      hp: 60,
      maxHp: 60,
      difficultyTier: DifficultyTier.EASY,
      isAlive: true,
      // FSM fields from story 3.2:
      fsmState: EnemyFSMState.IDLE,
      // ... any other FSM fields 3.2 adds
    };
    this.gameState.enemies.push(enemy);
    // Create planck body for enemy (using createEnemyBody from story 3.1 physics/world.ts)
    // Store in this.enemyBodies (new Map similar to playerBodies)
  }
}
```

> **Note on EnemyState FSM fields:** The exact fields added by Story 3.2 are unknown at time of writing (3.3 story file). Read Story 3.2 implementation and `packages/shared-types/src/enemy.ts` before implementing `spawnEnemies()` to include any required FSM initializer values.

**4. Add enemyBodies map (mirror of playerBodies):**

```typescript
private enemyBodies = new Map<string, Body>();
```

Clean up enemy bodies in `onDispose()` — same pattern as `playerBodies`.

**5. Import additions needed in GameRoom.ts:**

```typescript
import { dispatchAbility, getEnemyCount } from 'game-rules';
import { OFFSET_ENEMY_SPAWN } from 'shared-types';  // constant from balance.ts exported through shared-types, OR from 'game-rules' — check 3.2
import { EnemyType, DifficultyTier, EnemyFSMState } from 'shared-types'; // check exact names from 3.2
import type { EnemyState } from 'shared-types';
import { createEnemyBody } from '../physics/world.js';  // already exists from story 3.1
```

> Check whether `OFFSET_ENEMY_SPAWN` lives in `shared-types/src/constants.ts` or `game-rules/src/balance.ts` after Story 3.2 is merged. Follow wherever 3.2 put it.

---

### ControllerScreen.tsx changes

**1. Enable skill cells in dungeon phase:**

Find the `isInteractive` computation (inside the `[0,1,2,3].map` at line ~1006):
```typescript
// BEFORE:
const isInteractive = trainingDummyActive && ability !== null && !isOnCooldown;
// AFTER:
const inDungeon = (gameState?.session.phase === 'dungeon') ?? false;
const isInteractive = (trainingDummyActive || inDungeon) && ability !== null && !isOnCooldown;
```

**2. Enable touchAction on right zone in dungeon:**
```typescript
// BEFORE:
touchAction: trainingDummyActive ? 'none' : 'auto',
// AFTER:
touchAction: (trainingDummyActive || inDungeon) ? 'none' : 'auto',
```

Where `inDungeon` is derived once at the top of the `ControllerScreen` component from `gameState?.session.phase === 'dungeon'`.

**3. Fix D-2.3-D — RELEASE fires twice on lift inside cell:**

In `SkillCell`, add a `releaseFiredRef` field to the `activeTouchRef` tracking object:

```typescript
interface ActiveTouch {
  id: number;
  originX: number;
  originY: number;
  lastDirX: number;
  lastDirY: number;
  releaseFired: boolean;  // guards against element + document both firing on in-cell lift
}
```

In `onTouchEnd` (element-level handler):
```typescript
if (e.changedTouches[i]!.identifier === t.id) {
  if (ability.inputType === 'RELEASE' && !t.releaseFired) {
    t.releaseFired = true;
    onAbilityFire(index, t.lastDirX, t.lastDirY, false);
  }
  // ... clear interval, set activeTouchRef to null
}
```

In `onDocumentTouchEnd`:
```typescript
if (e.changedTouches[i]!.identifier === t.id) {
  if (ability.inputType === 'RELEASE' && !t.releaseFired) {
    t.releaseFired = true;
    onAbilityFire(index, t.lastDirX, t.lastDirY, false);
  }
  // ... clear interval, set activeTouchRef to null
}
```

The `releaseFiredRef` flag is set on the first handler to fire; the second handler sees it and skips. This correctly handles both lift-inside (element fires first, document second → only element fires) and lift-outside (only document fires → fires once).

**4. No changes needed for multi-touch independence:**

The joystick zone (left 40%) and skill cell zone (right 60%) are separate DOM elements with separate event listeners. Each tracks by `Touch.identifier`. They cannot interfere. The only thing needed was enabling `touchAction: 'none'` on the right zone in dungeon mode (change 2 above).

---

### DungeonScreen.tsx — new host screen

Create `apps/host-client/src/screens/DungeonScreen.tsx`:

This is a PixiJS canvas screen following the exact pattern of `HubWorldScreen.tsx`. Key differences:
- Renders enemy circles (red, radius 20px) at enemy positions in virtual 1920×1080 space
- Renders player circles at player positions (same as HubWorldScreen)
- On `ability:fired` delta arrival, briefly pulses the firing player circle alpha (0→1→0, ~300ms)
- No POI markers needed in dungeon
- The `session` prop is needed to send game events if any

Structure:
```typescript
interface DungeonScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
}
```

Subscribe to `ability:fired` deltas: the host session already broadcasts all deltas via `applyDelta` into `gameState`. The dungeon screen needs to know WHEN an `ability:fired` arrives, not just the resulting state. Options:
1. Pass a separate `onAbilityFired` callback from `App.tsx` (add to host session's delta handler)
2. Track a `lastAbilityFired: AbilityFiredDelta | null` state in `App.tsx`

Simplest approach: add `onAbilityFiredDelta?: (delta: AbilityFiredDelta) => void` to the host session's delta listener in `App.tsx`, and pass a ref/state down. This does not require touching the `applyDelta` function — it's a side-effect-only notification.

OR: since `ability:fired` leaves `GameState` unchanged (no-op in `applyDelta`), store a `latestAbilityFired` in App state:

```typescript
// In App.tsx:
const [latestAbilityFired, setLatestAbilityFired] = useState<AbilityFiredDelta | null>(null);

// In delta handler (host session):
if (delta.type === 'ability:fired') {
  setLatestAbilityFired(delta);
}
```

Pass `latestAbilityFired` to `DungeonScreen`. In `DungeonScreen`, when it changes, trigger a 300ms flash on the corresponding player circle.

Look at how `HubWorldScreen.tsx` handles the PixiJS init pattern (`useRef<Application>`, cleanup in `useEffect` return). Copy that pattern exactly — do not invent a new PixiJS setup approach.

---

### App.tsx (host) — route dungeon phase

Minimal change inside the final `return` fallback:
```typescript
// BEFORE:
return <HubWorldScreen gameState={gameState} session={session} />;

// AFTER:
if (gameState?.session.phase === 'dungeon') {
  return <DungeonScreen gameState={gameState} session={session} latestAbilityFired={latestAbilityFired} />;
}
return <HubWorldScreen gameState={gameState} session={session} />;
```

No local `AppScreen` enum change needed — the phase comes from server state.

---

### tests/unit/abilities.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { dispatchAbility } from 'game-rules';
import { PlayerClass } from 'shared-types';

describe('dispatchAbility', () => {
  const baseCtx = {
    cooldownExpiresAt: 0,
    nowMs: 1000,
    directionX: 0.7,
    directionY: 0.0,
  };

  it('returns ok for each class at index 0 when not on cooldown', () => {
    for (const cls of Object.values(PlayerClass)) {
      const result = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: 0 });
      expect(result.ok).toBe(true);
    }
  });

  it('returns error when on cooldown', () => {
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 0, cooldownExpiresAt: 2000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ON_COOLDOWN');
  });

  it('TAP ability returns direction (0, 0) regardless of input direction', () => {
    // Stonehide slot 0 = Stone Wall (TAP)
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 0, directionX: 1, directionY: 0.5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBe(0);
      expect(result.value.directionY).toBe(0);
    }
  });

  it('AUTO ability preserves direction', () => {
    // Stonehide slot 3 = Avalanche (AUTO)
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 3, directionX: 0.7, directionY: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.directionX).toBeCloseTo(0.7);
  });

  it('every class has at least one ability with cooldown ≤ 3000ms', () => {
    for (const cls of Object.values(PlayerClass)) {
      const cooldowns = [0, 1, 2, 3].map(i => {
        const r = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: i });
        return r.ok ? r.value.cooldownMs : Infinity;
      });
      expect(Math.min(...cooldowns)).toBeLessThanOrEqual(3000);
    }
  });

  it('returns error for out-of-range ability index', () => {
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 4 });
    expect(result.ok).toBe(false);
  });
});
```

---

### tests/contract/net-protocol.test.ts additions

Add to the existing test file:
```typescript
it('ability:fired delta survives serialize → deserialize', () => {
  const delta = {
    type: 'ability:fired' as const,
    playerId: 'p1',
    abilityIndex: 2,
    directionX: 0.5,
    directionY: -0.5,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('SnapshotMsg with dungeon phase survives serialize → deserialize', () => {
  const state = mockGameState();
  state.session.phase = 'dungeon';
  state.session.levelIndex = 1;
  const msg: SnapshotMsg = { type: 'snapshot', state };
  expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
});
```

---

### Deferred items addressed in this story

| Deferred | Location | Fix |
|---|---|---|
| D-2.3-C (applyDelta no exhaustiveness) | `apply-delta.ts` | `satisfies never` default branch — see AC6 |
| D-2.3-D (RELEASE fires twice) | `ControllerScreen.tsx SkillCell` | `releaseFired` flag on activeTouchRef — see AC5 |
| Story 3.x comment in `host:start` handler | `GameRoom.ts:90` | Wire host:start to dungeon — see AC2 |
| Story 3.x comment in training dummy block | `GameRoom.ts:354` | Replace with general dispatch — see AC3 |

---

### Hooks triggered

| Hook | Required action |
|---|---|
| Contract-change hook | Protocol Architect review of `AbilityFiredDelta`; contract test added |
| Simulation-safety hook | typecheck + `tests/unit/abilities.test.ts` must pass |
| Client-UX hook (mobile) | isInteractive in dungeon, touchAction none, D-2.3-D fixed, multi-touch verified |
| Client-UX hook (host) | DungeonScreen renders, ability flash visible, enemy circles visible |

---

### What remains after this story

- Story 3.4 applies damage using `ABILITY_DAMAGE` from balance.ts (hitboxes in planck.js)
- Story 3.4 broadcasts `enemy:damaged` / `enemy:killed` and drops Spirit Essence
- Story 3.5 implements player downed state (player health already in `PlayerState.hp`)
- Full enemy movement in dungeon (Story 3.2's FSM tick loop becomes live when enemies are in `gameState.enemies`)
- Difficulty selection (Epic 4); currently hard-coded to Easy tier in `spawnEnemies()`
```

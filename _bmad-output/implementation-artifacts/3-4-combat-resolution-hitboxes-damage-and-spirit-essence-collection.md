---
baseline_commit: SET_TO_HEAD_AFTER_STORY_3_3_MERGE
---

# Story 3.4: Combat Resolution — Hitboxes, Damage & Spirit Essence Collection

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Story 3.3 (must be merged first) added ability dispatch in dungeon phase,
  AbilityFiredDelta to the host, per-class cooldowns from balance.ts, and the
  dungeon phase transition. Enemies exist in GameState.enemies and have planck.js
  bodies in enemyBodies map. Ability fires broadcast AbilityFiredDelta but cause
  NO damage yet. Story 3.4 closes the combat loop: ability hits are resolved via
  spatial scan against enemy positions, damage is applied via a pure Result-returning
  function in game-rules/systems/combat.ts, enemy:damaged and enemy:killed deltas
  are broadcast, and killed enemies drop Spirit Essence which is auto-collected via
  planck.js sensor overlap. Host DungeonScreen gains enemy health bars, a killed
  fade animation, and an essence pickup flash. PlayerState gains essenceTotal so
  totals survive snapshots.
Owner agent: Simulation Engineer (primary); Protocol Architect co-owns shared-types
  and net-protocol changes (contract-change hook required); Host Experience Engineer
  co-owns DungeonScreen rendering (client-UX hook required).
Goal: Wire ability hit resolution into the existing dungeon ability dispatch block;
  add pure applyDamage + isInHitZone to game-rules/combat.ts; add EnemyDamagedDelta;
  add essence sensor bodies and contact flush; update PlayerState with essenceTotal;
  make DungeonScreen render enemy health bars and essence pickup visual.
Allowed paths:
  - packages/game-rules/src/systems/combat.ts               (NEW)
  - packages/game-rules/src/balance.ts                     (MODIFY — add hit zone + essence tables)
  - packages/game-rules/src/index.ts                       (MODIFY — export combat symbols)
  - packages/shared-types/src/player.ts                    (MODIFY — add essenceTotal)
  - packages/net-protocol/src/messages/server-to-host.ts   (MODIFY — EnemyDamagedDelta)
  - packages/net-protocol/src/apply-delta.ts               (MODIFY — enemy + essence cases)
  - packages/net-protocol/src/index.ts                     (MODIFY — export EnemyDamagedDelta)
  - apps/simulation-server/src/physics/world.ts            (MODIFY — essence sensor factory)
  - apps/simulation-server/src/rooms/GameRoom.ts           (MODIFY — hit-scan, essence drop/collect)
  - apps/host-client/src/screens/DungeonScreen.tsx         (MODIFY — health bars, essence visual)
  - tests/unit/combat.test.ts                              (NEW)
  - tests/contract/net-protocol.test.ts                    (MODIFY — enemy:damaged round-trip)
Blocked paths:
  - apps/mobile-controller/**                     (no controller changes this story)
  - apps/backend-platform/**                      (no backend changes)
  - packages/shared-types/src/enemy.ts            (no new enemy fields this story)
  - apps/simulation-server/src/rooms/GameRoom.ts  (only modify the ability dispatch block and tick
                                                  POI flush section — do not touch reconnect, join,
                                                  CLASS_SELECT, or movement logic)
Inputs:
  - packages/game-rules/src/systems/abilities.ts           (from 3.3 — read dispatchAbility pattern)
  - packages/game-rules/src/balance.ts                     (from 3.3 — extend with combat values)
  - packages/game-rules/src/state/result.ts                (from 3.2 — reuse Result<T,E>)
  - packages/shared-types/src/player.ts                    (current — add essenceTotal)
  - packages/shared-types/src/game-state.ts                (current — EssenceDrop already defined)
  - packages/net-protocol/src/messages/server-to-host.ts   (current — EnemyKilledDelta, EssenceDroppedDelta, EssenceCollectedDelta already exist)
  - packages/net-protocol/src/apply-delta.ts               (as modified by 3.3 — has exhaustiveness guard)
  - apps/simulation-server/src/physics/world.ts            (current — read createPoiSensorBody pattern)
  - apps/simulation-server/src/rooms/GameRoom.ts           (as modified by 3.3 — ability dispatch, enemyBodies map)
  - apps/host-client/src/screens/DungeonScreen.tsx         (from 3.3 — extend it)
Non-goals:
  - Enemy melee attacks on players / player health reduction (Story 3.5)
  - Player downed state / revive (Story 3.5)
  - Spirit form (Story 3.6)
  - Clear objective (Story 3.7)
  - Projectile physics bodies (sensor-based moving projectiles) — alpha uses immediate
    spatial scan; deferred to visual polish phase
  - Ability VFX (projectile sprites, impact particles) — placeholder flash only in alpha
  - Player total essence display on host HUD (Story 3.7 handles post-level tally)
  - Enemy pathfinding changes (enemy AI bodies still use velocity-set movement from 3.2)
  - filterCategory / filterMask on physics fixtures (deferred D-3.1-D — add in Phase 5)
  - Difficulty modifier on damage output (all classes use base damage at Easy tier)
Acceptance criteria:
  AC1: In dungeon phase, when an ability fires and the player has a confirmed class,
       all enemies within the ability hit zone are damaged via applyDamage() from
       combat.ts; an enemy:damaged delta is broadcast immediately after each hit.
  AC2: When an enemy's hp reaches zero, enemy:killed delta is broadcast, the enemy
       is removed from gameState.enemies, and its planck body is destroyed. The
       host removes the enemy circle from the canvas on receiving enemy:killed.
  AC3: When an enemy is killed, an EssenceDrop is added to gameState.essenceDrops
       and an essence:dropped delta is broadcast; a planck sensor body is created at
       the drop position.
  AC4: When a player planck body overlaps an essence sensor, the essence is
       collected: the EssenceDrop is removed from gameState.essenceDrops, the sensor
       body is destroyed, the player's essenceTotal is incremented, an
       essence:collected delta is broadcast.
  AC5: PlayerState has essenceTotal: number (default 0); a player:essenceTotal-updated
       delta OR the essence:collected delta carries enough info for host/snapshot to
       stay consistent. Using essence:collected delta + applyDelta update on host is
       the preferred path (no extra delta type needed if essence:collected carries
       the updated total or the host accumulates from delta).
  AC6: applyDelta handles enemy:damaged (update hp in state.enemies), enemy:killed
       (remove from state.enemies), essence:dropped (add to state.essenceDrops),
       essence:collected (remove from state.essenceDrops, update player essenceTotal).
       Exhaustiveness guard from 3.3 still compiles cleanly.
  AC7: tests/unit/combat.test.ts passes: applyDamage reduces hp correctly; applyDamage
       returns killed=true and essenceDrop when hp ≤ 0; applyDamage returns error
       for already-dead enemy; isInHitZone returns correct results for TAP and
       directional cases. No planck imports in combat.ts.
  AC8: tests/contract/net-protocol.test.ts: enemy:damaged delta round-trip passes.
  AC9: Host DungeonScreen shows a red health bar over each enemy circle (proportional
       to hp/maxHp); enemy circle fades out (alpha 1→0, ~300ms) on enemy:killed;
       a brief yellow flash appears at the drop position on essence:dropped.
  AC10: npm run typecheck clean.
Required hooks:
  - Contract-change hook: EnemyDamagedDelta is a new wire type; essenceTotal on
    PlayerState changes the snapshot schema. Protocol Architect review required.
  - Simulation-safety hook: typecheck + combat unit tests pass before merge.
  - Client-UX hook (host): health bars visible, killed fade visible, essence flash visible.
Required tests:
  - tests/unit/combat.test.ts — applyDamage, isInHitZone
  - tests/contract/net-protocol.test.ts — enemy:damaged round-trip,
    snapshot with essenceTotal survives serialize → deserialize
Telemetry impact: none this story
```

---

## Story

As a player,
I want my abilities to hit enemies and deal damage, and for defeated enemies to drop Spirit Essence I can collect,
So that fighting enemies feels impactful and rewarding.

---

## Acceptance Criteria

**AC1 — Ability hit detection and enemy damage:**
**Given** an ability fires in dungeon phase and the player has a direction vector
**When** the server processes the ability in the tick
**Then** all enemies in the hit zone receive damage from `applyDamage()` in `game-rules/src/systems/combat.ts`
**And** an `enemy:damaged` delta `{ type: 'enemy:damaged', enemyId, damage, remainingHp }` is broadcast for each hit enemy
**And** `applyDamage()` returns `Result<DamageResult, GameError>` — it never throws

**AC2 — Enemy death and removal:**
**Given** an enemy's hp reaches zero after taking damage
**When** `applyDamage()` returns `killed: true`
**Then** the server broadcasts `enemy:killed` delta `{ type: 'enemy:killed', enemyId, byPlayerId }`
**And** the enemy is removed from `gameState.enemies` and its planck body is destroyed from `enemyBodies` map
**And** the host's `DungeonScreen` removes the enemy circle from the canvas when `applyDelta` processes `enemy:killed`

**AC3 — Spirit Essence drop on kill:**
**Given** an enemy is killed
**When** the server processes the kill
**Then** a new `EssenceDrop` `{ id, x: enemy.x, y: enemy.y, amount: ESSENCE_DROP_AMOUNT }` is added to `gameState.essenceDrops`
**And** an `essence:dropped` delta is broadcast containing the full `EssenceDrop`
**And** a planck.js static sensor body is created at the drop position for collection detection

**AC4 — Essence auto-collection via planck sensor:**
**Given** an essence sensor exists in the physics world
**When** a player's dynamic body enters the sensor during `physicsWorld.step()`
**Then** the essence contact event is queued (same deferred-flush pattern as POI contacts)
**And** in the same tick's flush phase: the `EssenceDrop` is removed from `gameState.essenceDrops`, the sensor body is destroyed, the player's `essenceTotal` is incremented by `drop.amount`
**And** an `essence:collected` delta `{ type: 'essence:collected', dropId, byPlayerId, newTotal }` is broadcast

**AC5 — essenceTotal on PlayerState:**
**Given** `PlayerState` has `essenceTotal: number` (default 0)
**When** a snapshot is broadcast after essence collection
**Then** the updated `essenceTotal` is included in the player's entry in the snapshot
**And** `createPlayer()` in `GameRoom.ts` initialises `essenceTotal: 0`
**And** the contract test verifies a snapshot with non-zero `essenceTotal` survives serialize → deserialize

**AC6 — applyDelta handles all combat deltas:**
**Given** the exhaustiveness guard added in Story 3.3 compiles
**When** new delta types `enemy:damaged`, `enemy:killed`, `essence:dropped`, `essence:collected` are added
**Then** `applyDelta` handles all four cases:
- `enemy:damaged` → update matching enemy `hp` and `remainingHp` in `state.enemies`
- `enemy:killed` → filter out matching enemy from `state.enemies`
- `essence:dropped` → push `drop` into `state.essenceDrops`
- `essence:collected` → filter out matching drop from `state.essenceDrops`; update `player.essenceTotal`
**And** TypeScript exhaustiveness guard still compiles clean with no error

**AC7 — combat.ts unit tests:**
**Given** `tests/unit/combat.test.ts` runs
**Then** `applyDamage` reduces enemy hp by the damage amount
**And** `applyDamage` returns `killed: true` and a non-null `essenceDrop` when `damage >= enemy.hp`
**And** `applyDamage` returns `{ ok: false }` for an already-dead enemy (`isAlive: false`)
**And** `applyDamage` clamps hp to 0, never goes negative
**And** `isInHitZone` returns true for a TAP ability at player position when enemy is within aoeRadius
**And** `isInHitZone` returns true for a directional ability when enemy is in the cone ahead of the direction
**And** `isInHitZone` returns false when enemy is behind the player for a directional ability
**And** no planck import exists in `combat.ts`

**AC8 — Contract test:**
**Given** `tests/contract/net-protocol.test.ts` runs
**Then** `enemy:damaged` delta survives serialize → deserialize
**And** a snapshot containing a player with `essenceTotal: 25` survives serialize → deserialize

**AC9 — Host DungeonScreen combat visuals:**
**Given** the host receives combat deltas via the session's broadcast channel
**When** `DungeonScreen` processes them
**Then** a red health bar (proportional to `hp/maxHp`, 30px wide, 4px tall) appears above each enemy circle
**And** when `enemy:killed` is received, the enemy circle and health bar fade out (alpha 1→0, 300ms) then the PixiJS objects are destroyed and removed
**And** when `essence:dropped` is received, a brief yellow flash circle (opacity pulse 0→1→0, 400ms) appears at the drop position
**And** the host calls no damage-calculation logic — it only renders what deltas deliver

**AC10 — Typecheck clean:**
**Given** `npm run typecheck` across all packages
**Then** no TypeScript errors; `EnemyDamagedDelta satisfies DeltaEventMsg` compiles

---

## Dev Notes

### Critical dependency: Story 3.3 must be merged first

Story 3.4 builds directly on what 3.3 adds. Do not begin until 3.3 is merged:

| 3.3 artifact | Used by 3.4 |
|---|---|
| `dispatchAbility()` in `abilities.ts` | Ability dispatch block extended with hit-scan |
| `AbilityFiredDelta` in protocol | Broadcast BEFORE hit-scan; hit deltas come after |
| `balance.ts` ability cooldowns + damage | `ABILITY_DAMAGE[class][index]` is the damage param |
| Dungeon phase transition (`host:start`) | Hit-scan only runs when `session.phase === 'dungeon'` |
| `this.enemyBodies` map in `GameRoom.ts` | Body lookup needed to destroy killed enemy body |
| `DungeonScreen.tsx` PixiJS setup | Extend it with health bars and essence visuals |
| `applyDelta` exhaustiveness guard | Adding new delta cases must keep it compiling |

### What already exists — DO NOT reinvent

**`EnemyKilledDelta`** already exists in `server-to-host.ts`:
```typescript
export type EnemyKilledDelta = {
  type: 'enemy:killed';
  enemyId: string;
  byPlayerId: string;
};
```

**`EssenceDroppedDelta`** already exists:
```typescript
export type EssenceDroppedDelta = {
  type: 'essence:dropped';
  drop: EssenceDrop;  // { id, x, y, amount }
};
```

**`EssenceCollectedDelta`** already exists:
```typescript
export type EssenceCollectedDelta = {
  type: 'essence:collected';
  dropId: string;
  byPlayerId: string;
};
```

**What is MISSING and must be added:**
- `EnemyDamagedDelta` — not in protocol yet
- `essence:collected` needs `newTotal` field to keep host in sync (or host tracks from snapshots — see AC5 note below)
- `applyDelta` cases for all enemy/essence deltas — currently hit the exhaustiveness guard default and would fail

**About `EssenceCollectedDelta.newTotal`:**
The existing `EssenceCollectedDelta` type has `dropId` and `byPlayerId` only. For the host to display running totals without relying solely on snapshots, we need `newTotal`. Two options:
1. Extend `EssenceCollectedDelta` with `newTotal: number` — but this changes an existing type (contract-change hook: yes, already triggered for this story anyway)
2. Host accumulates from `delta.amount` (looked up from `state.essenceDrops` before it's removed)

Option 2 is NOT reliable because the host's `applyDelta` processes `essence:collected` AFTER `essence:dropped` only if both arrive correctly. Option 1 is safer. Add `newTotal: number` to `EssenceCollectedDelta`:
```typescript
export type EssenceCollectedDelta = {
  type: 'essence:collected';
  dropId: string;
  byPlayerId: string;
  newTotal: number;  // ADD THIS — player's updated essenceTotal after collection
};
```

Update the contract test for this field.

---

### New delta type: EnemyDamagedDelta

Add to `packages/net-protocol/src/messages/server-to-host.ts`:
```typescript
export type EnemyDamagedDelta = {
  type: 'enemy:damaged';
  enemyId: string;
  damage: number;
  remainingHp: number;
};
```

Add to `DeltaEventMsg` union. Export from `packages/net-protocol/src/index.ts`.

---

### PlayerState change: add essenceTotal

In `packages/shared-types/src/player.ts`, add to `PlayerState`:
```typescript
essenceTotal: number;  // accumulated Spirit Essence this run (resets per run)
```

In `GameRoom.ts`, update `createPlayer()` to initialize `essenceTotal: 0`.

This is a contract-change (shared-types change changes the snapshot schema). The existing contract test for `SnapshotMsg` will need to include `essenceTotal` in the mock player.

---

### combat.ts — new pure game-rules system

Create `packages/game-rules/src/systems/combat.ts`:

```typescript
import type { EnemyState, EssenceDrop } from 'shared-types';
import type { Result } from '../state/result.js';
import { ESSENCE_DROP_AMOUNT } from '../balance.js';

export interface DamageResult {
  enemy: EnemyState;          // updated state (hp reduced, isAlive updated)
  killed: boolean;
  essenceDrop?: EssenceDrop;  // defined only if killed; id must be supplied by caller
}

export type CombatError = { code: string; detail?: string };

// Pure — no planck, no Colyseus, no I/O.
export function applyDamage(
  enemy: EnemyState,
  damage: number,
  dropId: string,  // pre-generated unique ID for the essence drop (e.g. `drop-${tick}-${enemyId}`)
): Result<DamageResult, CombatError> {
  if (!enemy.isAlive) {
    return { ok: false, error: { code: 'ENEMY_ALREADY_DEAD' } };
  }
  if (damage < 0) {
    return { ok: false, error: { code: 'NEGATIVE_DAMAGE', detail: String(damage) } };
  }

  const newHp = Math.max(0, enemy.hp - damage);
  const killed = newHp === 0;

  const updatedEnemy: EnemyState = { ...enemy, hp: newHp, isAlive: !killed };

  return {
    ok: true,
    value: {
      enemy: updatedEnemy,
      killed,
      essenceDrop: killed
        ? { id: dropId, x: enemy.x, y: enemy.y, amount: ESSENCE_DROP_AMOUNT }
        : undefined,
    },
  };
}

// Spatial hit-zone check — pure, no physics, no I/O.
// For directional (AUTO/RELEASE): hit circle at player + direction * hitRangePx, radius = hitRadiusPx
// For AoE (TAP): hit circle at player position, radius = hitRadiusPx
export function isInHitZone(
  playerX: number,
  playerY: number,
  dirX: number,
  dirY: number,
  enemyX: number,
  enemyY: number,
  hitRadiusPx: number,
  hitRangePx: number,
  isDirectional: boolean,
): boolean {
  if (isDirectional) {
    // Hit circle center is projected along direction vector
    const cx = playerX + dirX * hitRangePx;
    const cy = playerY + dirY * hitRangePx;
    const dx = enemyX - cx;
    const dy = enemyY - cy;
    return (dx * dx + dy * dy) <= hitRadiusPx * hitRadiusPx;
  }
  // TAP = radius around player
  const dx = enemyX - playerX;
  const dy = enemyY - playerY;
  return (dx * dx + dy * dy) <= hitRadiusPx * hitRadiusPx;
}
```

Export from `packages/game-rules/src/index.ts`:
```typescript
export { applyDamage, isInHitZone } from './systems/combat.js';
export type { DamageResult, CombatError } from './systems/combat.js';
```

---

### balance.ts additions

Add to `packages/game-rules/src/balance.ts`:

```typescript
// ── Ability hit zones (alpha tuning values) ───────────────────────────────
// Directional abilities: hit circle placed at (player + direction * range), radius = hitRadius
// TAP abilities: hit circle at player position, radius = hitRadius (hitRange unused)

// hitRangePx: how far forward the hit-circle center is placed (directional abilities)
export const ABILITY_HIT_RANGE_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:     [  0, 160,   0, 200],  // TAP(0), RELEASE(160), TAP(0), AUTO(200)
  spiritcaller:  [180,   0, 200,   0],  // AUTO(180), TAP(0), RELEASE(200), TAP(0)
  souldrinker:   [150, 180,   0,   0],  // AUTO(150), RELEASE(180), TAP(0), TAP(0)
  stormcaller:   [160, 200,   0, 160],  // AUTO(160), RELEASE(200), TAP(0), AUTO(160)
};

// hitRadiusPx: radius of the hit circle (AoE radius for TAP; accuracy radius for directional)
export const ABILITY_HIT_RADIUS_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:     [100, 60, 120, 50],   // Stone Wall AoE, Tremor cone, Iron Skin AoE, Avalanche
  spiritcaller:  [ 50, 90, 60,  90],   // Ancestor's Voice, Spirit Nova AoE, Soul Mend, Warding Cry AoE
  souldrinker:   [ 50, 65, 80,  80],   // Blood Draw, Crimson Lash, Dark Pact AoE, Void Pulse AoE
  stormcaller:   [ 60, 70, 110, 80],   // Lightning Arc, Tempest Hurl, Thunder Clap AoE, Storm Eye
};

// ── Spirit Essence values ─────────────────────────────────────────────────
export const ESSENCE_DROP_AMOUNT = 10;        // essence dropped per enemy kill
export const ESSENCE_COLLECT_RADIUS_PX = 50; // player must be within this to collect
```

> **Balance note:** These are alpha placeholder values. Adjust during playtesting — the `balance.ts` centralization exists exactly for this. Directional hit ranges and AoE radii should feel "accurate but forgiving" for a first playable.

---

### physics/world.ts additions

Add to `apps/simulation-server/src/physics/world.ts`:

**1. Extend `PhysicsBodyData` union:**
```typescript
export type PhysicsBodyData =
  | { type: 'player'; playerId: string }
  | { type: 'poi';    poiId: string; poiType: PoiType }
  | { type: 'enemy';  enemyId: string }
  | { type: 'essence'; dropId: string };  // NEW
```

**2. Add essence sensor factory:**
```typescript
import { ESSENCE_COLLECT_RADIUS_PX } from 'game-rules';  // from balance.ts export

export const ESSENCE_SENSOR_RADIUS_M = ESSENCE_COLLECT_RADIUS_PX / PIXELS_PER_METER;

export function createEssenceSensorBody(
  world: World,
  dropId: string,
  x: number,
  y: number,
): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(toMeters(x), toMeters(y)),
  });
  body.createFixture({ shape: new Circle(ESSENCE_SENSOR_RADIUS_M), isSensor: true });
  body.setUserData({ type: 'essence', dropId } satisfies PhysicsBodyData);
  return body;
}
```

**3. Add essence contact extractor (follows the exact POI pattern):**
```typescript
export interface EssenceBeginContactEvent {
  playerId: string;
  dropId: string;
}

export function extractEssenceBeginContact(contact: Contact): EssenceBeginContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData  = dataA?.type === 'player'  ? dataA : dataB?.type === 'player'  ? dataB : null;
  const essenceData = dataA?.type === 'essence' ? dataA : dataB?.type === 'essence' ? dataB : null;
  if (!playerData || !essenceData) return null;
  return { playerId: playerData.playerId, dropId: essenceData.dropId };
}
```

---

### GameRoom.ts changes

Read the full `GameRoom.ts` (as modified by 3.3) before editing. Changes below are surgical — only the ability dispatch block and tick flush section change.

**1. New imports:**
```typescript
import { applyDamage, isInHitZone, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX } from 'game-rules';
import { CLASS_DEFINITIONS } from 'shared-types';
import { createEssenceSensorBody } from '../physics/world.js';
import type { EssenceBeginContactEvent } from '../physics/world.js';
import { extractEssenceBeginContact } from '../physics/world.js';
```

**2. New private fields:**
```typescript
private essenceSensorBodies = new Map<string, Body>();
private pendingEssenceBeginContacts: Array<EssenceBeginContactEvent> = [];
```

**3. Wire essence contact listener in `onCreate`** (alongside the existing begin-contact listener):
```typescript
// In the existing this.physicsWorld.on('begin-contact', ...) handler, add:
const essenceEvt = extractEssenceBeginContact(contact);
if (essenceEvt) this.pendingEssenceBeginContacts.push(essenceEvt);
```

**4. Extend ability dispatch block** (the block added in Story 3.3, after `AbilityFiredDelta` broadcast):

After broadcasting `AbilityFiredDelta`, extend with hit-scan:
```typescript
// Hit-scan: check all living enemies against this ability's hit zone
if (inDungeon && result.ok) {
  const { directionX: dirX, directionY: dirY, damage } = result.value;
  const abilityDef = CLASS_DEFINITIONS[player.class].abilities[abilityIndex];
  const isDirectional = abilityDef.inputType !== 'TAP';
  const hitRange  = ABILITY_HIT_RANGE_PX[player.class][abilityIndex] ?? 0;
  const hitRadius = ABILITY_HIT_RADIUS_PX[player.class][abilityIndex] ?? 60;

  for (let ei = 0; ei < this.gameState.enemies.length; ei++) {
    const enemy = this.gameState.enemies[ei]!;
    if (!enemy.isAlive) continue;

    if (!isInHitZone(player.x, player.y, dirX, dirY, enemy.x, enemy.y, hitRadius, hitRange, isDirectional)) {
      continue;
    }

    const dropId = `drop-${this.tickCount}-${enemy.id}`;
    const dmgResult = applyDamage(enemy, damage, dropId);
    if (!dmgResult.ok) continue;

    // Update enemy in state
    this.gameState.enemies[ei] = dmgResult.value.enemy;

    // Broadcast enemy:damaged
    const damagedDelta = {
      type: 'enemy:damaged' as const,
      enemyId: enemy.id,
      damage,
      remainingHp: dmgResult.value.enemy.hp,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, damagedDelta);

    if (dmgResult.value.killed) {
      // Broadcast enemy:killed
      const killedDelta = {
        type: 'enemy:killed' as const,
        enemyId: enemy.id,
        byPlayerId: clientId,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, killedDelta);

      // Destroy enemy physics body
      const enemyBody = this.enemyBodies.get(enemy.id);
      if (enemyBody) {
        this.physicsWorld.destroyBody(enemyBody);
        this.enemyBodies.delete(enemy.id);
      }

      // Drop essence
      const drop = dmgResult.value.essenceDrop!;
      this.gameState.essenceDrops.push(drop);
      const droppedDelta = {
        type: 'essence:dropped' as const,
        drop,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, droppedDelta);

      // Create essence sensor
      const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
      this.essenceSensorBodies.set(drop.id, sensor);
    }
  }
}
```

> **Important:** The above loop mutates `this.gameState.enemies[ei]` directly. This is intentional — we need the updated hp to be reflected in the next snapshot. Do not create a new array per hit (O(n) allocation per enemy hit is wasteful in a tight loop).

**5. Flush essence contacts in `tick()`** (add after the existing POI contact flush section):

```typescript
// ── Flush essence collection contacts ────────────────────────────────────
for (const { playerId, dropId } of this.pendingEssenceBeginContacts) {
  // Skip if already collected this tick (contact may fire twice for same pair)
  const dropIdx = this.gameState.essenceDrops.findIndex(d => d.id === dropId);
  if (dropIdx === -1) continue;

  const drop = this.gameState.essenceDrops[dropIdx]!;
  const player = this.gameState.players.find(p => p.id === playerId);
  if (!player) continue;

  // Remove drop from state
  this.gameState.essenceDrops.splice(dropIdx, 1);

  // Destroy sensor body
  const sensorBody = this.essenceSensorBodies.get(dropId);
  if (sensorBody) {
    this.physicsWorld.destroyBody(sensorBody);
    this.essenceSensorBodies.delete(dropId);
  }

  // Increment player essence
  player.essenceTotal += drop.amount;

  // Broadcast
  const collectedDelta = {
    type: 'essence:collected' as const,
    dropId,
    byPlayerId: playerId,
    newTotal: player.essenceTotal,
  } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, collectedDelta);
}
this.pendingEssenceBeginContacts.length = 0;
```

**6. Clean up in `onDispose()`:**
```typescript
for (const body of this.essenceSensorBodies.values()) {
  this.physicsWorld.destroyBody(body);
}
this.essenceSensorBodies.clear();
```

---

### applyDelta.ts — add all combat cases

Read `apply-delta.ts` as modified by Story 3.3 (has exhaustiveness guard on default). Add these cases before the default:

```typescript
case 'enemy:damaged': {
  const enemies = state.enemies.map(e =>
    e.id === evt.enemyId ? { ...e, hp: evt.remainingHp } : e
  );
  return { ...state, enemies };
}
case 'enemy:killed': {
  return { ...state, enemies: state.enemies.filter(e => e.id !== evt.enemyId) };
}
case 'essence:dropped': {
  return { ...state, essenceDrops: [...state.essenceDrops, evt.drop] };
}
case 'essence:collected': {
  const essenceDrops = state.essenceDrops.filter(d => d.id !== evt.dropId);
  const players = state.players.map(p =>
    p.id === evt.byPlayerId ? { ...p, essenceTotal: evt.newTotal } : p
  );
  return { ...state, essenceDrops, players };
}
```

Also ensure the other deltas that exist in `DeltaEventMsg` but haven't been handled yet (from before the 3.3 exhaustiveness guard was added) are all covered. After adding all the above, the `satisfies never` default guard must still compile — if it doesn't, TypeScript will tell you which variant is missing.

---

### DungeonScreen.tsx — combat visuals

Read the file as created by Story 3.3 before editing. The PixiJS init pattern and stage scale are already set up.

**Enemy health bars:**
Add a `Graphics` object per enemy (alongside the enemy circle Graphics):
```typescript
interface EnemyEntry {
  circle: Graphics;
  healthBar: Graphics;  // red bar above circle
  deadUntil: number;    // 0 = alive; >0 = fade-out deadline
}
```

In `renderFrame()`:
- For each enemy: draw `healthBar` as a red `rect(x - 15, y - 32, 30 * (hp/maxHp), 4)` (30px wide × 4px, proportional fill)
- Dim / hide healthBar when enemy is in dead fade-out

**Enemy kill fade:**
On receiving `enemy:killed` (detected via `latestAbilityFired`-style approach, OR via a dedicated `lastKilledEnemyId` state prop passed from `App.tsx`):
- Set `entry.deadUntil = Date.now() + 300`
- In `renderFrame()` loop: if `Date.now() < entry.deadUntil`, set `circle.alpha = (entry.deadUntil - Date.now()) / 300`; when deadline passes, destroy objects and delete from map

**Approach for receiving combat deltas on host:**
The host session already handles all `DeltaEventMsg` via `applyDelta` into `gameState`. But for transient visuals (kill fade, essence flash), the host needs to know WHEN a delta arrived, not just the resulting state.

Follow the same pattern as `latestAbilityFired` from Story 3.3 in `App.tsx`:
```typescript
const [latestCombatEvent, setLatestCombatEvent] = useState<DeltaEventMsg | null>(null);
// In host session delta handler:
if (delta.type === 'enemy:killed' || delta.type === 'essence:dropped') {
  setLatestCombatEvent(delta);
}
```

Pass `latestCombatEvent` to `DungeonScreen`. In `DungeonScreen`, use a `useEffect` on `latestCombatEvent` to trigger the visual. This avoids modifying the PixiJS update loop — the effect fires once on delta arrival and sets a deadline, then `renderFrame()` reads the deadline each frame.

> **Note:** If `App.tsx` is already passing `latestAbilityFired` from Story 3.3, extend the same state to cover all transient combat events rather than duplicating state. One `DeltaEventMsg | null` state for "latest visual trigger" covers all cases.

**Essence drop flash:**
On `essence:dropped` delta: store drop position in a `Map<string, { x, y, deadline }>`. In `renderFrame()`, draw a yellow circle (radius 20px, alpha based on remaining time) at each active flash position. Clean up entries whose deadline has passed.

---

### tests/unit/combat.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { applyDamage, isInHitZone } from 'game-rules';
import { EnemyType, DifficultyTier } from 'shared-types';
import type { EnemyState } from 'shared-types';

function mockEnemy(overrides?: Partial<EnemyState>): EnemyState {
  return {
    id: 'e1',
    type: EnemyType.GRUNT,
    x: 500,
    y: 300,
    hp: 60,
    maxHp: 60,
    difficultyTier: DifficultyTier.EASY,
    isAlive: true,
    // Include any FSM fields added by Story 3.2 with default values
    ...overrides,
  };
}

describe('applyDamage', () => {
  it('reduces hp by damage amount', () => {
    const result = applyDamage(mockEnemy(), 20, 'drop-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(40);
      expect(result.value.killed).toBe(false);
      expect(result.value.essenceDrop).toBeUndefined();
    }
  });

  it('clamps hp to 0, sets killed=true, includes essenceDrop when damage >= hp', () => {
    const result = applyDamage(mockEnemy({ hp: 15 }), 100, 'drop-2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.enemy.hp).toBe(0);
      expect(result.value.enemy.isAlive).toBe(false);
      expect(result.value.killed).toBe(true);
      expect(result.value.essenceDrop).toBeDefined();
      expect(result.value.essenceDrop?.id).toBe('drop-2');
    }
  });

  it('returns error for already-dead enemy', () => {
    const result = applyDamage(mockEnemy({ isAlive: false, hp: 0 }), 10, 'drop-3');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ENEMY_ALREADY_DEAD');
  });

  it('returns error for negative damage', () => {
    const result = applyDamage(mockEnemy(), -5, 'drop-4');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NEGATIVE_DAMAGE');
  });

  it('does not mutate the original enemy object', () => {
    const enemy = mockEnemy();
    applyDamage(enemy, 10, 'drop-5');
    expect(enemy.hp).toBe(60);  // original unchanged
  });
});

describe('isInHitZone', () => {
  // Player at (500, 300), enemy at (500, 300 + 80) = just above player

  it('TAP (AoE): returns true when enemy is within hitRadius', () => {
    expect(isInHitZone(500, 300, 0, 1, 500, 380, 100, 0, false)).toBe(true);
  });

  it('TAP (AoE): returns false when enemy is beyond hitRadius', () => {
    expect(isInHitZone(500, 300, 0, 1, 500, 500, 100, 0, false)).toBe(false);
  });

  it('TAP ignores direction: hits enemy behind player too', () => {
    // Enemy is "behind" relative to direction, but TAP is AoE so it still hits
    expect(isInHitZone(500, 300, 0, 1, 500, 220, 100, 0, false)).toBe(true);
  });

  it('Directional: returns true when enemy is in front of player within range+radius', () => {
    // direction = (1, 0), range = 200, radius = 60, enemy at (700, 300) = exactly at hit center
    expect(isInHitZone(500, 300, 1, 0, 700, 300, 60, 200, true)).toBe(true);
  });

  it('Directional: returns false when enemy is behind player', () => {
    // direction = (1, 0), enemy at (300, 300) — behind the player
    expect(isInHitZone(500, 300, 1, 0, 300, 300, 60, 200, true)).toBe(false);
  });

  it('Directional: returns false when enemy is past the hit circle', () => {
    // direction = (1, 0), hit center at (700, 300), enemy at (900, 300) — too far
    expect(isInHitZone(500, 300, 1, 0, 900, 300, 60, 200, true)).toBe(false);
  });
});
```

> **Note on FSM fields in `mockEnemy()`:** After Story 3.2 is merged, `EnemyState` has additional FSM fields (e.g., `fsmState`). Add any required fields to `mockEnemy()` with sensible defaults so the object satisfies the type. Check the actual `EnemyState` type before implementing the test.

---

### tests/contract/net-protocol.test.ts additions

```typescript
it('enemy:damaged delta survives serialize → deserialize', () => {
  const delta = {
    type: 'enemy:damaged' as const,
    enemyId: 'e1',
    damage: 20,
    remainingHp: 40,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('SnapshotMsg with player essenceTotal survives serialize → deserialize', () => {
  const state = mockGameState();
  state.players.push({
    id: 'p1', displayName: 'Test', class: PlayerClass.STONEHIDE,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
    essenceTotal: 25,  // the new field
  });
  const msg: SnapshotMsg = { type: 'snapshot', state };
  expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
});
```

---

### Deferred items addressed in this story

| Deferred | Fix |
|---|---|
| `story 3.x` comment on enemy removal logic | Enemy removal now implemented in ability dispatch block |
| No applyDelta cases for EnemyKilledDelta/EssenceDroppedDelta/EssenceCollectedDelta | Added in AC6 |
| `EssenceCollectedDelta` missing `newTotal` | Extended with `newTotal: number` |
| No PlayerState.essenceTotal | Added; initialized to 0 in createPlayer() |

### Deferred items NOT addressed this story (do not try to fix them here)

| Deferred | Reason |
|---|---|
| D-3.1-D — no filterCategory/filterMask on fixtures | Deferred to Phase 5; adding now would change planck fixture setup and risk regressions |
| D-3.1-C — no boundary walls for dungeon | Out of scope; enemies can reach arena edges |
| D-3.1-B — O(n) player scan in contact flush | Bounded by ≤8 players; acceptable at alpha |
| Enemy melee damage to players | Story 3.5 |

### Hooks triggered

| Hook | Required action |
|---|---|
| Contract-change hook | EnemyDamagedDelta (new), EssenceCollectedDelta.newTotal (changed), PlayerState.essenceTotal (snapshot schema change). Protocol Architect review. |
| Simulation-safety hook | typecheck + combat unit tests pass |
| Client-UX hook (host) | health bars, killed fade, essence flash all visible in DungeonScreen |

### What remains after this story

- Story 3.5: enemy melee damage to players (player hp reduction, downed state, revive timer)
  - `D-3.1-D` filterCategory/filterMask becomes relevant here (player-enemy contacts)
  - Uses the same `applyDamage`-style pattern for player hp
- Story 3.6: spirit form and run failure
- Story 3.7: Clear objective checks `gameState.enemies.every(e => !e.isAlive)` — already expressible from current state
```

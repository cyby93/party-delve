---
baseline_commit: 84acaf6
---

# Story 3.1: xoshiro128++ PRNG & planck.js Physics World

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Story 3.1 lays the deterministic infrastructure that every subsequent combat story
  depends on: (1) the xoshiro128++ PRNG for reproducible randomness, and (2) the planck.js
  physics world for sensor-based proximity detection. The hub world currently uses manual
  Euclidean distance checks for POI proximity (GameRoom.ts:250-283, with comment "planck.js
  sensor migration deferred to Story 3.1"). GameRoom.ts:75 has a Math.random() call that
  violates the existing ESLint no-restricted-syntax rule and must be replaced.
Owner agent: Simulation Engineer (primary); minor ESLint change touches root eslint.config.mjs
  which is QA/Telemetry territory — acceptable here as it enforces the architecture contract.
Goal: Implement the deterministic xoshiro128++ PRNG module and wire a planck.js physics world
  into the sim server tick loop. Replace the manual POI proximity Euclidean distance check with
  planck contact listeners. Replace Math.random() seed generation with crypto.randomInt().
Allowed paths:
  - packages/game-rules/src/prng/xoshiro128.ts        (NEW — pure PRNG module)
  - packages/game-rules/src/index.ts                   (MODIFY — export PRNG)
  - packages/game-rules/tests/xoshiro128.test.ts       (NEW — PRNG unit test)
  - apps/simulation-server/src/physics/world.ts        (NEW — physics world + factories)
  - apps/simulation-server/src/rooms/GameRoom.ts       (MODIFY — integrate planck + crypto seed)
  - apps/simulation-server/tests/physics-world.test.ts (NEW — physics integration test)
  - eslint.config.mjs                                  (MODIFY — add planck import restrictions)
Blocked paths:
  - packages/shared-types/**              (no type changes needed)
  - packages/net-protocol/**              (no protocol changes needed)
  - apps/host-client/**                   (no client changes)
  - apps/mobile-controller/**             (no client changes)
Non-goals:
  - Bounds clamping players to the world rect (deferred to 3.x)
  - PRNG OFFSET_* constants in shared-types (deferred to 3.2 when first used)
  - Planck-based movement physics (movement arithmetic stays; planck drives sensor contacts only)
  - Enemy physics bodies in the TICK loop (createEnemyBody() factory is created but not called yet)
  - Any combat system work (3.3+)
Acceptance criteria:
  AC1: xoshiro128++ — createRng(seed) called twice with same seed produces identical float
       sequences; Math.random() is absent from all game-rules and sim-server files (ESLint).
  AC2: Physics world — world.step() is called exactly once per tick inside tick() only;
       createPlayerBody() and createEnemyBody() factory functions exist in sim-server/physics/world.ts.
  AC3: Sensor contacts — POI proximity detection uses planck contact listeners, not Euclidean;
       no planck imports exist in host-client or mobile-controller (ESLint).
  AC4: Seed generation — GameRoom.onCreate replaces Math.random() with crypto.randomInt() for
       runSeed; createRng(runSeed) is stored as this.prng for use in 3.2+.
Required hooks:
  - Simulation-safety hook: typecheck clean + all tests pass before merge.
  - Contract-change hook: NOT triggered (no shared-types or net-protocol changes).
Required tests:
  - packages/game-rules/tests/xoshiro128.test.ts — same seed → same 1000-value sequence
  - apps/simulation-server/tests/physics-world.test.ts — sensor contact fires when player
    body overlaps POI sensor after world.step()
Telemetry impact: none
```

---

## Story

As a simulation engineer,
I want a deterministic PRNG and a planck.js physics world running inside the sim server tick loop,
so that all physics-driven gameplay is reproducible from the same seed and never leaks outside the server.

---

## Acceptance Criteria

**AC1 — Deterministic PRNG:**
**Given** `packages/game-rules/src/prng/xoshiro128.ts` exports `createRng(seed: number): () => number`
**When** `createRng(42)` is called twice and each instance generates 1000 values
**Then** both sequences are identical
**And** all returned values are in `[0, 1)` (float)
**And** `Math.random()` does not appear in any `.ts` file under `packages/game-rules/` or `apps/simulation-server/` (enforced by ESLint `no-restricted-syntax` — rule already exists in `eslint.config.mjs:59-68`)

**AC2 — Physics world in tick loop:**
**Given** `GameRoom.onCreate` initializes a planck.js `World` with zero gravity
**When** `tick()` runs
**Then** `this.physicsWorld.step(DT, 8, 3)` is called exactly once per tick, nowhere else
**And** player bodies are created via `createPlayerBody()` from `apps/simulation-server/src/physics/world.ts`
**And** `createEnemyBody()` factory exists in the same file (called in 3.2, not yet in this story)
**And** no `planck` import exists in `apps/host-client/**` or `apps/mobile-controller/**`
**And** no `planck` import exists in `packages/game-rules/**`

**AC3 — Planck sensor contacts replace Euclidean POI check:**
**Given** the physics world is stepping and INTERACTIVE_HUB_POIS have static sensor bodies
**When** a player's dynamic body overlaps a POI sensor circle
**Then** `begin-contact` listener fires and broadcasts `player:poi-entered` delta (matching current behavior)
**And** `end-contact` listener fires and broadcasts `player:poi-exited` delta
**And** the manual Euclidean distance loop in `tick()` (`GameRoom.ts:250-283`) is fully removed

**AC4 — Crypto seed + PRNG stored:**
**Given** `GameRoom.onCreate` runs
**When** the room is created
**Then** `this.gameState.session.runSeed` is set using `import { randomInt } from 'node:crypto'`
**And** `this.prng = createRng(this.gameState.session.runSeed)` is called once and the instance is stored

---

## Tasks / Subtasks

- [x] **Task 1: Implement xoshiro128++ PRNG** (AC: #1, #4)
  - [x] Read `packages/game-rules/src/index.ts` before editing
  - [x] Create `packages/game-rules/src/prng/xoshiro128.ts` (see Dev Notes §xoshiro128 implementation)
  - [x] Export `createRng` from `packages/game-rules/src/index.ts`
  - [x] Create `packages/game-rules/tests/xoshiro128.test.ts` (see Dev Notes §PRNG tests)
  - [x] Run `npm test --workspace=packages/game-rules` — must pass

- [x] **Task 2: Create physics world module** (AC: #2, #3)
  - [x] Create directory `apps/simulation-server/src/physics/`
  - [x] Create `apps/simulation-server/src/physics/world.ts` (see Dev Notes §physics/world.ts)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 3: Add ESLint import restrictions for planck** (AC: #2)
  - [x] Read `eslint.config.mjs` before editing
  - [x] Add `planck` to `no-restricted-imports` for `packages/game-rules/**/*.ts`
  - [x] Add `planck` to `no-restricted-imports` for `apps/host-client/**/*.{ts,tsx}` and `apps/mobile-controller/**/*.{ts,tsx}` (see Dev Notes §ESLint changes)
  - [x] Run `npm run lint` — must pass

- [x] **Task 4: Integrate planck into GameRoom.ts** (AC: #2, #3, #4)
  - [x] Read `apps/simulation-server/src/rooms/GameRoom.ts` in full before editing
  - [x] Add `import { randomInt } from 'node:crypto'`
  - [x] Add `import { Vec2, Body, Contact } from 'planck'`
  - [x] Add imports from `../physics/world.js`
  - [x] Add `import { createRng } from 'game-rules'`
  - [x] Add class fields: `private physicsWorld!: ...`, `private playerBodies`, `private prng`, `private pendingPoiBeginContacts`, `private pendingPoiEndContacts` (see Dev Notes §GameRoom fields)
  - [x] In `onCreate`: replace Math.random() seed with crypto.randomInt(); init physics world; create POI sensor bodies; register contact listeners (see Dev Notes §onCreate changes)
  - [x] In `onJoin` (non-host): create player body and store in `playerBodies` (see Dev Notes §onJoin changes)
  - [x] In `onLeave` consented branch: destroy player body (see Dev Notes §onLeave changes)
  - [x] In `onLeave` grace-expiry catch: destroy player body (same pattern)
  - [x] In `tick()`: replace arithmetic movement loop + Euclidean POI loop with planck-driven approach (see Dev Notes §tick() changes)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 5: Add physics integration test** (AC: #2, #3)
  - [x] Create `apps/simulation-server/tests/physics-world.test.ts` (see Dev Notes §physics test)
  - [x] Run `npm test --workspace=apps/simulation-server` — all tests must pass
  - [x] Run `npm run typecheck` — must be clean

### Review Findings

- [x] [Review][Patch] `PoiEndContactEvent` missing `poiId` — end-contact flush clears `nearPoiId` unconditionally; guard should check `player.nearPoiId === event.poiId` [apps/simulation-server/src/physics/world.ts, apps/simulation-server/src/rooms/GameRoom.ts:tick()]
- [x] [Review][Patch] `randomInt(0, 0xffffffff)` excludes max uint32 seed — use `randomInt(0, 0x1_0000_0000)` for full range [apps/simulation-server/src/rooms/GameRoom.ts:87]
- [x] [Review][Patch] `playerBodies` and contact listeners not cleaned up in `onDispose` — memory leak in multi-room server process [apps/simulation-server/src/rooms/GameRoom.ts:252-258]
- [x] [Review][Defer] `onLeave` catch block runs after room disposal — pre-existing architecture, logged as D19 [apps/simulation-server/src/rooms/GameRoom.ts:onLeave]
- [x] [Review][Defer] O(n) player scan in POI contact flush loops — acceptable for ≤8 players; deferred to 3.x [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
- [x] [Review][Defer] No boundary walls / `linearDamping:0` — explicitly non-goal per story; deferred
- [x] [Review][Defer] Player-player contact callbacks (no filter bits) — O(n²) noise with no incorrect behavior; deferred to 3.x [apps/simulation-server/src/physics/world.ts]
- [x] [Review][Defer] `nextSlotIndex` never recycled — pre-existing (D27), deferred
- [x] [Review][Defer] `planck` in `game-rules/package.json` — explicitly noted as deferred cleanup in story Dev Notes [packages/game-rules/package.json]

---

## Dev Notes

### Architecture Decision: Physics World in sim-server, NOT game-rules

**CRITICAL:** The epics.md AC text references `packages/game-rules/src/physics/world.ts`, but this **conflicts with two explicit project-context.md rules**:
1. `packages/game-rules` — pure functions only; **no planck.js imports**
2. **"Never import planck.js outside `apps/simulation-server`"**

Additionally, Story 3.2 requires "enemy AI testable with no planck.js imports" — confirming game-rules must stay planck-free.

**Resolution:** Physics world and all factory functions live in `apps/simulation-server/src/physics/world.ts`. The xoshiro128++ PRNG (pure function, no imports) correctly lives in `packages/game-rules/src/prng/xoshiro128.ts`.

This is a deliberate deviation from the epics.md file path. Follow project-context.md.

---

### §xoshiro128 implementation

**File:** `packages/game-rules/src/prng/xoshiro128.ts`

The algorithm is xoshiro128++ with splitmix32 seeding. All arithmetic must use `>>> 0` to maintain unsigned 32-bit semantics — JavaScript's `<<` produces signed results.

```typescript
function rotl32(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function createRng(seed: number): () => number {
  const sm = splitmix32(seed >>> 0);
  let s0 = sm();
  let s1 = sm();
  let s2 = sm();
  let s3 = sm();

  return (): number => {
    const result = (rotl32((s0 + s3) >>> 0, 23) + s0) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotl32(s3, 11);
    return result / 0x1_0000_0000; // [0, 1)
  };
}
```

Key points:
- `Math.imul(a, b)` performs 32-bit integer multiplication — always use instead of `*` for 32-bit math
- `>>> 0` after every operation ensures unsigned 32-bit
- `s0+s3` and `result+s0` must each be `>>> 0` before further use
- `splitmix32` fills all 4 state words from a single 32-bit seed (avoids zero state)
- Do NOT add a warm-up loop — determinism tests rely on the raw initial sequence

**package.json note:** `packages/game-rules/package.json` already has `"planck": "1.5.0"` as a dependency — this was pre-planned. After Task 3 adds the ESLint restriction, game-rules cannot import planck even though it's in package.json. The dependency can be removed in a separate cleanup task.

---

### §PRNG tests

**File:** `packages/game-rules/tests/xoshiro128.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/prng/xoshiro128.js';

describe('xoshiro128++ PRNG', () => {
  it('produces identical sequences for the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const seq1 = Array.from({ length: 1000 }, () => rng1());
    const seq2 = Array.from({ length: 1000 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const seq1 = Array.from({ length: 10 }, createRng(1));
    const seq2 = Array.from({ length: 10 }, createRng(2));
    expect(seq1).not.toEqual(seq2);
  });

  it('all values are in [0, 1)', () => {
    const rng = createRng(99);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seed 0 does not produce all-zero sequence', () => {
    const rng = createRng(0);
    const values = Array.from({ length: 10 }, () => rng());
    expect(values.some(v => v > 0)).toBe(true);
  });
});
```

**vitest config:** The game-rules package already has `vitest ^2.0.0` in devDependencies. The test file uses `.js` extension on the import because the package uses `"type": "module"` and `"moduleResolution": "NodeNext"`.

---

### §physics/world.ts

**File:** `apps/simulation-server/src/physics/world.ts`

**Key design decisions:**
- `PIXELS_PER_METER = 64` — virtual 1920×1080 space; POI radius 120px → 1.875m (sensible)
- Player body type: **`dynamic`** (NOT kinematic). Dynamic bodies generate contacts with static sensors. Kinematic-static contacts are not guaranteed in planck.js.
- Player body: `fixedRotation: true`, `linearDamping: 0` (we set velocity directly), zero world gravity means no drift
- POI bodies: `static` with `isSensor: true` circle fixtures
- Player fixtures: small radius (20px = 0.3m) — player hitbox, solid (non-sensor)
- userData: typed union `PhysicsBodyData` to avoid untyped casts

```typescript
import { World, Vec2, Body, Circle, Contact } from 'planck';
import type { PoiDefinition, EnemyState, PoiType } from 'shared-types';

export const PIXELS_PER_METER = 64;
export const PLAYER_BODY_RADIUS_M = 20 / PIXELS_PER_METER; // 20px
export const ENEMY_BODY_RADIUS_M  = 24 / PIXELS_PER_METER; // 24px

export function toMeters(pixels: number): number {
  return pixels / PIXELS_PER_METER;
}
export function toPixels(meters: number): number {
  return meters * PIXELS_PER_METER;
}

// Tagged union stored as body userData — lets contact listeners identify bodies without a lookup map
export type PhysicsBodyData =
  | { type: 'player'; playerId: string }
  | { type: 'poi';    poiId: string; poiType: PoiType }
  | { type: 'enemy';  enemyId: string };

export function createPhysicsWorld(): World {
  return new World({ gravity: Vec2(0, 0) });
}

export function createPlayerBody(world: World, playerId: string, x: number, y: number): Body {
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(x), toMeters(y)),
    fixedRotation: true,
    linearDamping: 0,
  });
  body.createFixture({ shape: new Circle(PLAYER_BODY_RADIUS_M), density: 1, friction: 0 });
  body.setUserData({ type: 'player', playerId } satisfies PhysicsBodyData);
  return body;
}

export function createEnemyBody(world: World, enemyId: string, x: number, y: number): Body {
  const body = world.createBody({
    type: 'dynamic',
    position: Vec2(toMeters(x), toMeters(y)),
    fixedRotation: true,
    linearDamping: 0,
  });
  body.createFixture({ shape: new Circle(ENEMY_BODY_RADIUS_M), density: 1, friction: 0 });
  body.setUserData({ type: 'enemy', enemyId } satisfies PhysicsBodyData);
  return body;
}

export function createPoiSensorBody(world: World, poi: PoiDefinition): Body {
  const body = world.createBody({
    type: 'static',
    position: Vec2(toMeters(poi.x), toMeters(poi.y)),
  });
  body.createFixture({
    shape: new Circle(toMeters(poi.radius)),
    isSensor: true,
  });
  body.setUserData({ type: 'poi', poiId: poi.id, poiType: poi.type } satisfies PhysicsBodyData);
  return body;
}

// Contact event types returned to GameRoom for processing AFTER world.step()
export interface PoiBeginContactEvent {
  playerId: string;
  poiId: string;
  poiType: PoiType;
}
export interface PoiEndContactEvent {
  playerId: string;
}

export function extractPoiBeginContact(contact: Contact): PoiBeginContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData = dataA?.type === 'player' ? dataA : dataB?.type === 'player' ? dataB : null;
  const poiData   = dataA?.type === 'poi'    ? dataA : dataB?.type === 'poi'    ? dataB : null;
  if (!playerData || !poiData) return null;
  return { playerId: playerData.playerId, poiId: poiData.poiId, poiType: poiData.poiType };
}

export function extractPoiEndContact(contact: Contact): PoiEndContactEvent | null {
  const dataA = contact.getFixtureA().getBody().getUserData() as PhysicsBodyData | null;
  const dataB = contact.getFixtureB().getBody().getUserData() as PhysicsBodyData | null;
  const playerData = dataA?.type === 'player' ? dataA : dataB?.type === 'player' ? dataB : null;
  const poiData   = dataA?.type === 'poi'    ? dataA : dataB?.type === 'poi'    ? dataB : null;
  if (!playerData || !poiData) return null;
  return { playerId: playerData.playerId };
}
```

**Import note for GameRoom.ts:** Import as `import { ... } from '../physics/world.js'` (`.js` extension, NodeNext resolution).

---

### §ESLint changes

**File:** `eslint.config.mjs`

Two additions needed:

**1. Block planck in game-rules** (add to the existing `packages/game-rules/**` block at line ~39):
```javascript
{
  group: ['planck', 'planck/**'],
  message: 'planck.js must not be imported in game-rules — physics runs in sim-server only',
},
```

**2. Block planck in host-client and mobile-controller** (add to the existing host/mobile block at line ~23):
```javascript
{
  group: ['planck', 'planck/**'],
  message: 'planck.js must not be imported in client apps — physics is server authority only',
},
```

No changes to the existing `Math.random()` restriction — it already covers sim-server and game-rules.

---

### §GameRoom fields

New private fields to add alongside `lastKnownJoystick` (after line 68 in current GameRoom.ts):

```typescript
private physicsWorld!: World;
private playerBodies = new Map<string, Body>();
private prng!: () => number;
private pendingPoiBeginContacts: Array<PoiBeginContactEvent> = [];
private pendingPoiEndContacts:   Array<PoiEndContactEvent>   = [];
```

New imports to add at the top of GameRoom.ts:
```typescript
import { randomInt } from 'node:crypto';
import { Vec2, Body, Contact } from 'planck';
import type { World } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody,
  extractPoiBeginContact, extractPoiEndContact, toMeters, toPixels,
} from '../physics/world.js';
import type { PoiBeginContactEvent, PoiEndContactEvent } from '../physics/world.js';
import { createRng } from 'game-rules';
```

---

### §onCreate changes

Replace lines 74-75 (Math.random() seed) with:
```typescript
this.gameState.session.runSeed = randomInt(0, 0xffffffff);
this.prng = createRng(this.gameState.session.runSeed);
```

After the existing `onMessage` registrations and before `setInterval`, initialize physics:
```typescript
// Initialize physics world
this.physicsWorld = createPhysicsWorld();

// Create static sensor bodies for interactive hub POIs
for (const poi of INTERACTIVE_HUB_POIS) {
  createPoiSensorBody(this.physicsWorld, poi);
}

// Contact listeners — capture events during world.step() for processing after
this.physicsWorld.on('begin-contact', (contact: Contact) => {
  const evt = extractPoiBeginContact(contact);
  if (evt) this.pendingPoiBeginContacts.push(evt);
});
this.physicsWorld.on('end-contact', (contact: Contact) => {
  const evt = extractPoiEndContact(contact);
  if (evt) this.pendingPoiEndContacts.push(evt);
});
```

The HOST_START no-op handler registration stays unchanged.

---

### §onJoin changes

In the non-host branch, after `this.cooldownMap.set(client.sessionId, [0, 0, 0, 0])`:
```typescript
// Create physics body at this player's spawn position
const body = createPlayerBody(this.physicsWorld, client.sessionId, player.x, player.y);
this.playerBodies.set(client.sessionId, body);
```

No change to the host branch (`isHost === true`).

---

### §onLeave changes

In the **consented leave** branch, after `this.lastKnownJoystick.delete(client.sessionId)`:
```typescript
const leaveBody = this.playerBodies.get(client.sessionId);
if (leaveBody) {
  this.physicsWorld.destroyBody(leaveBody);
  this.playerBodies.delete(client.sessionId);
}
```

In the **grace-expiry catch** block, after `this.lastKnownJoystick.delete(client.sessionId)`:
```typescript
const expireBody = this.playerBodies.get(client.sessionId);
if (expireBody) {
  this.physicsWorld.destroyBody(expireBody);
  this.playerBodies.delete(client.sessionId);
}
```

**Do NOT** destroy the body during the grace period (frozen players stay in the physics world — their body is stopped via zero velocity in tick()).

---

### §tick() changes

The tick() method currently has two loops to replace: movement (lines ~229-248) and POI proximity (lines ~250-283). Replace **both** with the following planck-driven equivalent. Preserve all other tick sections unchanged (joystick drain, ability processing, queue clear, cooldown expiry, periodic snapshot).

**Replace the movement + POI proximity sections with:**

```typescript
// ── Planck phase 1: set player body velocities ──────────────────────────────
const SPEED = 200; // pixels per second in virtual 1920×1080 space
const DT = 1 / TICK_RATE_HZ;

for (const player of this.gameState.players) {
  const body = this.playerBodies.get(player.id);
  if (!body) continue;

  if (player.isFrozen) {
    body.setLinearVelocity(Vec2(0, 0));
    continue;
  }

  const joystick = this.lastKnownJoystick.get(player.id);
  const jx = joystick?.x ?? 0;
  const jy = joystick?.y ?? 0;
  const inDeadzone = Math.abs(jx) < 0.05 && Math.abs(jy) < 0.05;

  body.setLinearVelocity(inDeadzone
    ? Vec2(0, 0)
    : Vec2(toMeters(jx * SPEED), toMeters(jy * SPEED))
  );
}

// ── Planck phase 2: step world (integrates velocities + fires contact events) ─
this.physicsWorld.step(DT, 8, 3);

// ── Planck phase 3: read back positions, broadcast player:moved deltas ───────
for (const player of this.gameState.players) {
  const body = this.playerBodies.get(player.id);
  if (!body) continue;

  const pos = body.getPosition();
  const newX = toPixels(pos.x);
  const newY = toPixels(pos.y);

  if (Math.abs(newX - player.x) > 0.5 || Math.abs(newY - player.y) > 0.5) {
    player.x = newX;
    player.y = newY;
    const delta = {
      type: 'player:moved' as const,
      playerId: player.id,
      x: player.x,
      y: player.y,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, delta);
  }
}

// ── Planck phase 4: process POI contact events from this tick's world.step() ─
for (const { playerId, poiId, poiType } of this.pendingPoiBeginContacts) {
  const player = this.gameState.players.find(p => p.id === playerId);
  if (!player || player.nearPoiId === poiId) continue;
  player.nearPoiId = poiId;
  const enteredDelta = {
    type: 'player:poi-entered' as const,
    playerId,
    poiId,
    poiType,
  } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, enteredDelta);
}
for (const { playerId } of this.pendingPoiEndContacts) {
  const player = this.gameState.players.find(p => p.id === playerId);
  if (!player || player.nearPoiId === null) continue;
  player.nearPoiId = null;
  const exitedDelta = {
    type: 'player:poi-exited' as const,
    playerId,
  } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, exitedDelta);
}
this.pendingPoiBeginContacts.length = 0;
this.pendingPoiEndContacts.length = 0;
```

**Tick order after changes** (for reference):
1. Increment tick count (UNCHANGED)
2. Drain joystick events into `lastKnownJoystick` (UNCHANGED)
3. **NEW**: Set player body velocities → world.step() → read positions → process POI contacts (replaces old movement + POI loops)
4. Process ability inputs from `inputQueue` (UNCHANGED)
5. Clear `inputQueue.length = 0` (UNCHANGED)
6. Notify cooldown expiries (UNCHANGED)
7. Periodic snapshot (UNCHANGED)

**WARNING:** `world.step()` fires contact callbacks DURING its execution. The `pendingPoiBeginContacts` and `pendingPoiEndContacts` arrays are populated inside the step. Do NOT process them inside the contact callbacks — only after `world.step()` returns. Do NOT clear the pending arrays before world.step() — clear them at the end of step 3 after processing.

---

### §physics test

**File:** `apps/simulation-server/tests/physics-world.test.ts`

Tests the physics/world.ts module directly — no Colyseus, no GameRoom instantiation.

```typescript
import { describe, it, expect } from 'vitest';
import { Contact } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody,
  extractPoiBeginContact, extractPoiEndContact, toMeters, toPixels,
  PIXELS_PER_METER,
} from '../src/physics/world.js';
import { PoiType } from 'shared-types';
import type { PoiDefinition } from 'shared-types';

const TEST_POI: PoiDefinition = {
  id: 'test-poi',
  x: 400,
  y: 540,
  radius: 120,
  type: PoiType.CLASS_SELECT,
};

describe('physics/world', () => {
  it('toMeters / toPixels round-trip', () => {
    expect(toMeters(toPixels(5))).toBeCloseTo(5, 5);
    expect(toPixels(toMeters(320))).toBeCloseTo(320, 5);
  });

  it('PIXELS_PER_METER is 64', () => {
    expect(PIXELS_PER_METER).toBe(64);
  });

  describe('sensor contact detection', () => {
    it('begin-contact fires when player body overlaps POI sensor', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);

      // Place player body inside the POI radius
      const playerBody = createPlayerBody(world, 'p1', TEST_POI.x, TEST_POI.y);

      const events: Array<ReturnType<typeof extractPoiBeginContact>> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractPoiBeginContact(contact));
      });

      world.step(1 / 30, 8, 3);

      const hit = events.find(e => e?.playerId === 'p1');
      expect(hit).toBeDefined();
      expect(hit?.poiId).toBe('test-poi');
      expect(hit?.poiType).toBe(PoiType.CLASS_SELECT);
    });

    it('end-contact fires when player body leaves POI sensor', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);
      const playerBody = createPlayerBody(world, 'p1', TEST_POI.x, TEST_POI.y);

      // First step — player inside POI
      world.step(1 / 30, 8, 3);

      // Move player far away
      const { Vec2 } = await import('planck');
      playerBody.setPosition(Vec2(toMeters(0), toMeters(0)));
      playerBody.setLinearVelocity(Vec2(0, 0));

      const endEvents: Array<ReturnType<typeof extractPoiEndContact>> = [];
      world.on('end-contact', (contact: Contact) => {
        endEvents.push(extractPoiEndContact(contact));
      });

      world.step(1 / 30, 8, 3);

      expect(endEvents.some(e => e?.playerId === 'p1')).toBe(true);
    });

    it('no contact fires when player is outside POI radius', () => {
      const world = createPhysicsWorld();
      createPoiSensorBody(world, TEST_POI);
      // Place player far from POI
      createPlayerBody(world, 'p1', TEST_POI.x + 500, TEST_POI.y + 500);

      const events: Array<unknown> = [];
      world.on('begin-contact', (contact: Contact) => {
        events.push(extractPoiBeginContact(contact));
      });

      world.step(1 / 30, 8, 3);

      expect(events.filter(Boolean)).toHaveLength(0);
    });
  });
});
```

**Note on dynamic import in end-contact test:** If TypeScript disallows the dynamic `import('planck')` in a sync context, use a top-level import instead. The end-contact test can alternatively move the player by setting velocity and stepping multiple times until it exits the radius.

---

### §Existing tests: impact analysis

**`apps/simulation-server/tests/game-room-host-join.test.ts`**

The `simulateMovementTick` helper added in Story 2.5 uses arithmetic movement. With Story 3.1, real `GameRoom.tick()` movement now goes through planck. This creates a divergence between the helper and production code — this is a **pre-existing constraint** (same pattern established in Story 2.5). The Story 2.5 deferred item about this divergence applies here.

**No changes required to `game-room-host-join.test.ts` for this story.** The existing 17 tests cover onJoin, class selection, and persistent joystick behavior — none directly exercise the planck integration. The new `physics-world.test.ts` covers the planck integration separately.

If the arithmetic tests (AC2, AC3, AC4, AC6 from Story 2.5) fail due to test file import errors from new imports, check that `game-rules` and `net-protocol` workspace references are correct.

---

### §What Must Not Break

**POI proximity behavior:** The visual behavior seen by players (POI highlight appears/disappears at ~120px radius) must be preserved. The planck sensor uses the same radius from `INTERACTIVE_HUB_POIS`. Verify both class-select and training-dummy POIs work after the change.

**Frozen player movement:** A frozen player's body must have `setLinearVelocity(Vec2(0, 0))` called every tick. Without this, a frozen player retains their last velocity and continues moving.

**Cooldown system:** The training dummy ability cooldowns (Task 4 in story 2.4) use `this.cooldownMap` and `EventNames.COOLDOWN_UPDATE`. These loops are in tick() after the planck section and must not be touched.

**Snapshot broadcasts:** `onJoin` broadcasts a snapshot after `this.broadcast`. The player body creation must happen BEFORE the snapshot (so the body exists when the first tick fires). Current `onJoin` order: create player → push to gameState → init cooldownMap → snapshot broadcast. Body creation goes after cooldownMap init, before snapshot.

**Reconnect:** When a player reconnects (`allowReconnection` resolves), their physics body still exists (it was not destroyed — only consented-leave and grace-expiry destroy bodies). `player.isFrozen` is set back to `false`, so the body resumes normal velocity on the next tick. No special reconnect handling needed for physics.

---

### §project-context.md Key Rules for this Story

- **No planck outside sim-server.** `packages/game-rules/**` and client apps must never import planck.
- **No Math.random() in game logic.** GameRoom.ts currently violates this (line 75). Story 3.1 fixes it with `crypto.randomInt`.
- **world.step() in tick only.** Never call `physicsWorld.step()` from host, mobile, or `onCreate`/`onJoin`/`onLeave`.
- **Always construct Vec2.** Never pass plain `{x, y}` where planck expects `Vec2`. Use `Vec2(x, y)`.
- **Sensor detection via isSensor:true.** POI proximity is sensor-based — do not add a manual distance fallback.
- **logger.debug in tick.** No `logger.info/warn/error` inside tick() or the contact listeners.
- **Result<T,E> not needed here.** No game-rules functions are mutated — no Result wrappers needed for this story.
- **npm only.** Commands: `npm run typecheck`, `npm test --workspace=packages/game-rules`, `npm test --workspace=apps/simulation-server`, `npm run lint`.
- **TypeScript strict mode.** `PhysicsBodyData` casts from `getUserData()` are `as PhysicsBodyData | null` — check for null before accessing `.type`.

---

### §Previous Story Learnings (from Story 2.5)

- Test helpers in `game-room-host-join.test.ts` do NOT instantiate `GameRoom` — always test through pure extracted helpers. New physics test correctly tests `world.ts` functions directly.
- All `onLeave` cleanup must be applied to BOTH leave branches (consented + grace-expiry). Story 3.1 follows the same `cooldownMap.delete` / `lastKnownJoystick.delete` pattern — add `playerBodies` destruction to both.
- `DT = 1 / TICK_RATE_HZ` — import `TICK_RATE_HZ` from `shared-types`, do not hardcode in tests.
- `player.id === client.sessionId` is the invariant for map lookups (set in createPlayer via sessionId).

---

### §References

- Current Math.random() violation: `apps/simulation-server/src/rooms/GameRoom.ts:75`
- Manual Euclidean POI check to remove: `apps/simulation-server/src/rooms/GameRoom.ts:250-283`
- ESLint Math.random() rule (already active): `eslint.config.mjs:59-69`
- planck.js 1.5.0 package: `node_modules/planck/dist/planck.d.ts`
- POI definitions (radii + positions): `packages/shared-types/src/poi.ts`
- TICK_RATE_HZ constant: `packages/shared-types/src/constants.ts`
- game-rules package.json (planck dep already present): `packages/game-rules/package.json`
- Story 2.5 (persistent joystick — test helper pattern): `_bmad-output/implementation-artifacts/2-5-server-persistent-joystick-vector.md`
- epics.md E3 Story 3.1 ACs: `_bmad-output/planning-artifacts/epics.md:575-601`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- game-rules tsconfig had `"rootDir": "./src"` which rejected the new `tests/` directory. Fixed by removing `rootDir` (outDir still governs output location).
- `_playerBody` unused-var lint error in physics test fixed by dropping the assignment (body not needed after creation for begin-contact test).
- Added `"planck": "1.5.0"` to `apps/simulation-server/package.json` — it was only in game-rules; sim-server needs it directly for the physics module.

### Completion Notes List

- AC1: `createRng(42)` called twice → identical 1000-value sequences. 4 PRNG tests pass. `Math.random()` removed from GameRoom.ts (ESLint `no-restricted-syntax` rule already active).
- AC2: `physicsWorld.step(DT, 8, 3)` called exactly once per tick inside `tick()`. `createPlayerBody()` and `createEnemyBody()` exist in `apps/simulation-server/src/physics/world.ts`. ESLint `no-restricted-imports` blocks planck in game-rules, host-client, and mobile-controller.
- AC3: Euclidean distance loop (former lines 250–283) fully removed. Contact listeners capture begin/end events into pending arrays during `world.step()`, processed and cleared after. 5 physics tests pass including begin-contact, end-contact, and no-contact scenarios.
- AC4: `randomInt(0, 0xffffffff)` replaces `Math.random()` for `runSeed`. `this.prng = createRng(this.gameState.session.runSeed)` stored on class for use in 3.2+.
- No pre-existing test regressions: 17 game-room-host-join tests continue to pass.
- Typecheck clean on both `packages/game-rules` and `apps/simulation-server`.
- Pre-existing lint errors (setInterval/process/console/window not-defined) exist across the project and are unrelated to this story; all new files lint clean.

Confidence: 97% — all ACs verified by passing tests, typecheck clean, and code review against AC text.

### File List

- packages/game-rules/src/prng/xoshiro128.ts (NEW)
- packages/game-rules/src/index.ts (MODIFY)
- packages/game-rules/src/tsconfig.json (MODIFY — removed rootDir)
- packages/game-rules/tests/xoshiro128.test.ts (NEW)
- apps/simulation-server/src/physics/world.ts (NEW)
- apps/simulation-server/src/rooms/GameRoom.ts (MODIFY)
- apps/simulation-server/tests/physics-world.test.ts (NEW)
- apps/simulation-server/package.json (MODIFY — added planck dep)
- eslint.config.mjs (MODIFY)

## Change Log

- 2026-06-25: Story 3.1 implemented — xoshiro128++ PRNG, planck.js physics world, POI sensor contacts, crypto seed. 26 tests passing (4 PRNG + 5 physics + 17 existing). Typecheck clean. Status → review.

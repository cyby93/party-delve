---
baseline_commit: 836f263
---

# Story 5.3: Per-Tick Bond Effects — Proximity & Fate Bond Types

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.3)
Context: Stories 5.1 and 5.2 are done.
  - packages/shared-types/src/bond.ts: BondType { Proximity, Fate }, BondState { playerA, playerB, type, color }
  - packages/game-rules/src/systems/bonds.ts: assignBond, selectBondPair, selectBondType, BondAssignedEvt, BondError
  - packages/game-rules/src/balance.ts: BOND_TYPE_COLORS
  - packages/shared-types/src/game-state.ts: activeBonds: BondState[] (initialized to [])
  - apps/simulation-server/src/rooms/GameRoom.ts: resets activeBonds = [] in resetToHub (line 565)
  - apps/simulation-server/src/physics/world.ts: PhysicsBodyData union, createPlayerBody, planck patterns
  State.activeBonds is populated by story 5.4 (assignBond at level completion). Story 5.3 adds:
    (a) pure game-rules helpers for computing buff/drain/wipe state from activeBonds
    (b) createBondSensor() in physics/sensors.ts — called by story 5.4 when assigning bonds
    (c) BondPriceActiveDelta wire type
    (d) GameRoom tick integration: speed buff, damage buff, proximity drain, Fate Bond wipe
    (e) GameRoom contact tracking: bondsInRange Set, bondEnterTime Map
    (f) GameRoom cleanup: bond sensor fixtures removed in resetToHub and onLeave/onDispose
Owner agent: Simulation Engineer (primary — game-rules + sim-server)
  Protocol Architect: packages/net-protocol (contract-change hook applies)
  QA + Telemetry Engineer: tests/unit/bonds.test.ts, tests/contract/net-protocol.test.ts
Goal: Implement the per-tick Spirit Bond effects system so that when bonds are active in
  state.activeBonds, they affect gameplay every tick: Proximity bonds give a +20% damage buff
  when the pair is in planck sensor range (and drain HP after threshold); Fate bonds give
  permanent +20% speed and chain-down their partner when downed.
Allowed paths:
  - packages/game-rules/src/systems/bonds.ts                   (MODIFY — add 5 pure helpers)
  - packages/game-rules/src/balance.ts                         (MODIFY — add 5 balance constants)
  - packages/game-rules/src/index.ts                           (MODIFY — export new symbols)
  - packages/net-protocol/src/messages/server-to-host.ts       (MODIFY — add BondPriceActiveDelta)
  - packages/net-protocol/src/apply-delta.ts                   (MODIFY — handle bond:price-active)
  - packages/net-protocol/src/index.ts                         (MODIFY — export BondPriceActiveDelta)
  - apps/simulation-server/src/physics/sensors.ts              (NEW — createBondSensor, extractBondSensorContact)
  - apps/simulation-server/src/rooms/GameRoom.ts               (MODIFY — tick integration, contact tracking, cleanup)
  - tests/unit/bonds.test.ts                                   (MODIFY — add story 5.3 pure helper tests)
  - tests/contract/net-protocol.test.ts                        (MODIFY — add bond:price-active round-trip)
Blocked paths:
  - packages/shared-types/**        (5.1 contracts are final — do not touch)
  - apps/host-client/**             (5.5 visualization)
  - apps/mobile-controller/**       (5.6 bond card)
  - packages/game-rules/src/state/result.ts  (do not modify Result/GameError union)
Inputs:
  - Epic 5 Story 5.3 acceptance criteria (epics.md:1042-1074)
  - packages/shared-types/src/bond.ts — BondType, BondState
  - packages/shared-types/src/game-state.ts — GameState.activeBonds
  - packages/game-rules/src/systems/bonds.ts — existing assignBond, selectBondPair, selectBondType
  - packages/game-rules/src/balance.ts — existing constants, BOND_TYPE_COLORS
  - packages/game-rules/src/systems/player-health.ts — applyPlayerDamage signature
  - apps/simulation-server/src/physics/world.ts — PhysicsBodyData, planck patterns, PIXELS_PER_METER
  - apps/simulation-server/src/rooms/GameRoom.ts — tick loop, contact listener, resetToHub, onLeave
  - packages/net-protocol/src/messages/server-to-host.ts — DeltaEventMsg union
  - packages/net-protocol/src/apply-delta.ts — switch pattern and exhaustiveness guard
Non-goals:
  - Bond assignment at level completion (story 5.4 — calls assignBond and createBondSensor)
  - Host particle tether visualization (story 5.5)
  - Mobile bond card UX (story 5.6)
  - boss level bond behaviour (bonds persist during boss — effects just run; no special boss interaction)
  - Bond dedup / cooldown across runs (reset via activeBonds=[] at run end — existing)
Acceptance criteria:
  AC1: Proximity Bond: when pair is within BOND_PROXIMITY_RANGE_PX (planck sensor overlap),
       both players deal damage * BOND_DAMAGE_MULT (1.2); when out of range, buff does not apply
  AC2: Proximity drain: after pair has been continuously in-range for >= BOND_DRAIN_THRESHOLD_S
       seconds, both players lose BOND_DRAIN_HP_PER_TICK HP per tick; emits bond:price-active delta;
       drain bottoms out at 1 HP (never kills)
  AC3: Fate Bond: both bonded players have speed = SPEED * BOND_SPEED_MULT every tick (always,
       regardless of proximity); if either bonded player goes isDown: true this tick, the other
       is immediately also set isDown via applyPlayerDamage(partner, partner.hp)
  AC4: processBonds() called with zero active bonds: returned deltas array is empty, no planck
       bodies created or destroyed
  AC5: createBondSensor() in physics/sensors.ts creates a sensor fixture on a player body with
       BondSensorFixtureData; extractBondSensorContact detects fixture contact between bond sensor
       and target player body
  AC6: bond:price-active delta round-trips through serialize/deserialize; applyDelta returns state
       unchanged for bond:price-active
  AC7: npm run typecheck passes with zero errors across all packages
Required hooks:
  - Simulation-safety hook: packages/game-rules and apps/simulation-server touched.
    Required: typecheck passes, all existing unit tests remain green.
  - Contract-change hook: packages/net-protocol touched (BondPriceActiveDelta is additive).
    Required: Protocol Architect review, at least one contract test, no spec/ADR update needed
    (additive-only delta type, no breaking change to existing messages).
Required tests:
  - tests/unit/bonds.test.ts additions:
    - getProximityBuffedPlayers: returns empty when no bonds in range
    - getProximityBuffedPlayers: buffs both players when bond key is in range set
    - getProximityBuffedPlayers: ignores Fate bonds
    - getFateBuffedPlayers: includes all Fate bond players regardless of proximity
    - getFateBuffedPlayers: ignores Proximity bonds
    - getFateBondWipeTargets: returns partner when bonded player is downed
    - getFateBondWipeTargets: skips partner already isDown
    - getFateBondWipeTargets: returns empty for Proximity bonds
    - getProximityDrainTargets: does not drain before threshold
    - getProximityDrainTargets: drains at and after threshold
    - getProximityDrainTargets: does not drain when out of range
  - tests/contract/net-protocol.test.ts addition:
    - BondPriceActiveDelta round-trip: { type: 'bond:price-active', playerA, playerB }
Telemetry impact: None for this story. Bond drain/buff telemetry is story 5.4's or 5.5's scope.
```

## Story

As a player,
I want Spirit Bonds to actively affect gameplay each tick — making bonded pair coordination matter,
So that bonds feel consequential and create emergent team dynamics.

## Acceptance Criteria

1. **(AC1)** When a Proximity Bond pair are within `BOND_PROXIMITY_RANGE_PX` of each other (planck sensor overlap), both deal damage × `BOND_DAMAGE_MULT` (1.2). When out of range, no buff applies.

2. **(AC2)** After a Proximity Bond pair has been continuously in-range for ≥ `BOND_DRAIN_THRESHOLD_S` seconds, both players lose `BOND_DRAIN_HP_PER_TICK` HP per tick. A `bond:price-active` delta is emitted each tick drain fires. Drain bottoms out at 1 HP (does not kill).

3. **(AC3)** A Fate Bond permanently grants both bonded players speed × `BOND_SPEED_MULT` (1.2) every tick (no proximity check). If either bonded player transitions to `isDown: true` in a tick, the other is immediately also set to `isDown: true` with their revive timer started.

4. **(AC4)** When `processBonds()` is called (internally: the bond-effects section in `GameRoom.tick()`) with zero active bonds, the returned deltas array is empty and no planck bodies are created or destroyed.

5. **(AC5)** `createBondSensor()` in `apps/simulation-server/src/physics/sensors.ts` adds an `isSensor: true` fixture to an existing player body with `BondSensorFixtureData` as fixture userData. `extractBondSensorContact` correctly identifies begin/end proximity contacts.

6. **(AC6)** `bond:price-active` delta survives `serialize → deserialize` round-trip. `applyDelta` returns `state` unchanged for `bond:price-active`.

7. **(AC7)** `npm run typecheck` passes with zero errors across all packages.

## Tasks / Subtasks

---

### Task 1: Add balance constants to `packages/game-rules/src/balance.ts` (AC: 1, 2, 3) ✅

Add at the bottom of `balance.ts`, after the existing `BOND_TYPE_COLORS` block:

```typescript
// ── Spirit Bond effects ───────────────────────────────────────────────────────
export const BOND_PROXIMITY_RANGE_PX = 200;  // planck sensor radius — tunable
export const BOND_DRAIN_THRESHOLD_S  = 5;    // seconds in-range before drain starts
export const BOND_DRAIN_HP_PER_TICK  = 1;    // HP drained per 30hz tick (~30/s at threshold)
export const BOND_DAMAGE_MULT        = 1.2;  // Proximity buff: +20% damage
export const BOND_SPEED_MULT         = 1.2;  // Fate buff: +20% movement speed
```

These belong in `balance.ts` (tunable gameplay values), NOT `constants.ts` (cross-package constants).

---

### Task 2: Add pure helpers to `packages/game-rules/src/systems/bonds.ts` (AC: 1, 2, 3, 4) ✅

Append the following exports to the existing `bonds.ts` file (after the `assignBond` function):

```typescript
// ─── Story 5.3: per-tick effects helpers ────────────────────────────────────

/** Stable bond identifier: always playerA+playerB in assignment order. */
export function bondKey(playerA: string, playerB: string): string {
  return `${playerA}+${playerB}`;
}

/**
 * Returns IDs of players currently buffed by an in-range Proximity Bond.
 * inRangeKeys: Set of bondKey strings whose planck sensor is overlapping this tick.
 */
export function getProximityBuffedPlayers(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    if (!inRangeKeys.has(bondKey(bond.playerA, bond.playerB))) continue;
    buffed.add(bond.playerA);
    buffed.add(bond.playerB);
  }
  return buffed;
}

/** Returns IDs of all players in any Fate Bond (speed buff is always active). */
export function getFateBuffedPlayers(bonds: BondState[]): Set<string> {
  const buffed = new Set<string>();
  for (const bond of bonds) {
    if (bond.type !== BondType.Fate) continue;
    buffed.add(bond.playerA);
    buffed.add(bond.playerB);
  }
  return buffed;
}

/**
 * Returns partner IDs that should be force-downed due to Fate Bond wipe.
 * downedPlayerId: the player who just became isDown === true this tick.
 * Skips partners already isDown or isSpirit (no double-wipe).
 */
export function getFateBondWipeTargets(
  bonds: BondState[],
  downedPlayerId: string,
  players: ReadonlyArray<{ id: string; isDown: boolean; isSpirit: boolean }>,
): string[] {
  const targets: string[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Fate) continue;
    let partnerId: string | null = null;
    if (bond.playerA === downedPlayerId) partnerId = bond.playerB;
    else if (bond.playerB === downedPlayerId) partnerId = bond.playerA;
    if (partnerId === null) continue;
    const partner = players.find(p => p.id === partnerId);
    if (!partner || partner.isDown || partner.isSpirit) continue;
    targets.push(partnerId);
  }
  return targets;
}

export interface ProximityDrainTarget {
  playerA: string;
  playerB: string;
}

/**
 * Returns Proximity Bond pairs that have been in-range long enough to drain HP.
 * enterTimes: Map of bondKey → epoch ms when pair entered sensor range.
 * drainThresholdMs: computed from BOND_DRAIN_THRESHOLD_S * 1000 by caller.
 */
export function getProximityDrainTargets(
  bonds: BondState[],
  inRangeKeys: ReadonlySet<string>,
  enterTimes: ReadonlyMap<string, number>,
  drainThresholdMs: number,
  nowMs: number,
): ProximityDrainTarget[] {
  const result: ProximityDrainTarget[] = [];
  for (const bond of bonds) {
    if (bond.type !== BondType.Proximity) continue;
    const key = bondKey(bond.playerA, bond.playerB);
    if (!inRangeKeys.has(key)) continue;
    const enterTime = enterTimes.get(key);
    if (enterTime === undefined) continue;
    if (nowMs - enterTime >= drainThresholdMs) {
      result.push({ playerA: bond.playerA, playerB: bond.playerB });
    }
  }
  return result;
}
```

**Import note:** `BondState` is already imported at the top of `bonds.ts` — no new imports needed. `BondType` is also already imported.

**`bondKey` ordering:** The key uses the `playerA`/`playerB` order from `assignBond` output. Story 5.4 must use `bondKey(evt.playerA, evt.playerB)` when creating the sensor so keys match. Never sort the pair — assignment order is the canonical order.

**`getFateBondWipeTargets` chaining:** If player P0 is Fate-bonded to P1, and P1 is Fate-bonded to P2, and P0 goes down: P1 gets wiped. Then GameRoom calls `getFateBondWipeTargets` for P1's down — which returns P2. This cascade is intentional (Fate Bond description: "shared doom"). GameRoom must re-call after each wipe. The `partner.isDown` guard prevents infinite loops.

---

### Task 3: Export new symbols from `packages/game-rules/src/index.ts` (AC: 1–4) ✅

Add to `packages/game-rules/src/index.ts` after the existing bond exports:

```typescript
export { bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets } from './systems/bonds.js';
export type { ProximityDrainTarget } from './systems/bonds.js';
export {
  BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK,
  BOND_DAMAGE_MULT, BOND_SPEED_MULT,
} from './balance.js';
```

---

### Task 4: Add `BondPriceActiveDelta` to net-protocol (AC: 6) — Contract-change hook ✅

**File: `packages/net-protocol/src/messages/server-to-host.ts`**

Add the new delta type after `BondAssignedDelta`:

```typescript
export type BondPriceActiveDelta = {
  type: 'bond:price-active';
  playerA: string;
  playerB: string;
};
```

Add `BondPriceActiveDelta` to the `DeltaEventMsg` union (after `BondAssignedDelta`):

```typescript
export type DeltaEventMsg =
  | PlayerMovedDelta
  // ... existing entries ...
  | BondAssignedDelta
  | BondPriceActiveDelta    // ← add here
  | EssenceDroppedDelta
  // ... rest unchanged ...
```

**File: `packages/net-protocol/src/apply-delta.ts`**

Add a case in the switch before the `default:` exhaustiveness guard:

```typescript
case 'bond:price-active':
  return state; // ponytail: visual indicator only; HP changes come via separate player:hp-updated deltas
```

**File: `packages/net-protocol/src/index.ts`**

Add `BondPriceActiveDelta` to the existing type export line:
```typescript
export type { ..., BondPriceActiveDelta } from './messages/server-to-host.js';
```

**Compatibility note:** This is additive — no existing message types change shape. Old host clients that don't handle `bond:price-active` will hit their own `default:` case and ignore it.

---

### Task 5: Create `apps/simulation-server/src/physics/sensors.ts` (AC: 5) ✅

New file — bond-proximity sensor utilities, following the existing `world.ts` patterns:

```typescript
import type { Body, Fixture, Contact } from 'planck';
import { Circle } from 'planck';
import type { PhysicsBodyData } from './world.js';

/** Stored as fixture.getUserData() on bond sensor fixtures. */
export interface BondSensorFixtureData {
  type: 'bond-sensor';
  bondKey: string;        // "${playerA}+${playerB}" — matches bondKey() in game-rules
  targetPlayerId: string; // the OTHER player in the bond (not the one this fixture is on)
}

export interface BondProximityEvent {
  bondKey: string;
}

/**
 * Adds a proximity sensor fixture to an existing player body.
 * The sensor fires contact events when the target player's body enters/exits range.
 * Called by story 5.4 when a bond is assigned; stored in GameRoom.bondSensorFixtures.
 */
export function createBondSensor(
  playerBody: Body,
  rangeM: number,
  bondKey: string,
  targetPlayerId: string,
): Fixture {
  const fixture = playerBody.createFixture({
    shape: new Circle(rangeM),
    isSensor: true,
  });
  fixture.setUserData({ type: 'bond-sensor', bondKey, targetPlayerId } satisfies BondSensorFixtureData);
  return fixture;
}

/**
 * Extracts a bond proximity event from a planck contact if one fixture is a bond sensor
 * and the other fixture's body is the target player.
 * Returns null for any other contact pair.
 */
export function extractBondSensorContact(contact: Contact): BondProximityEvent | null {
  const fixtureA = contact.getFixtureA();
  const fixtureB = contact.getFixtureB();

  const dataA = fixtureA.getUserData() as BondSensorFixtureData | null;
  const dataB = fixtureB.getUserData() as BondSensorFixtureData | null;

  // Identify which fixture is the bond sensor
  const sensorData = dataA?.type === 'bond-sensor' ? dataA
    : dataB?.type === 'bond-sensor' ? dataB
    : null;
  if (!sensorData) return null;

  // Identify the other fixture's body
  const otherFixture = dataA?.type === 'bond-sensor' ? fixtureB : fixtureA;
  const otherBodyData = otherFixture.getBody().getUserData() as PhysicsBodyData | null;

  // Verify it's the intended target player
  if (otherBodyData?.type !== 'player' || otherBodyData.playerId !== sensorData.targetPlayerId) return null;

  return { bondKey: sensorData.bondKey };
}
```

**Why fixture userData (not body userData):** The existing `PhysicsBodyData` is stored on the body. A player body has a regular movement fixture AND a bond sensor fixture. We need to distinguish them by storing `BondSensorFixtureData` on the fixture itself, not the body. Body userData remains `PhysicsBodyData` unchanged.

**Why sensor on playerA's body targeting playerB:** The bond sensor detects when playerB enters playerA's range. We only create one sensor per bond (on playerA), not two — one sensor is sufficient for detecting overlap.

---

### Task 6: Modify `apps/simulation-server/src/rooms/GameRoom.ts` (AC: 1–5) ✅

This is the largest change. Four sections of GameRoom.ts are modified:

#### 6a: Add imports and private fields

Add to the `import` from `'game-rules'`:
```typescript
bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets,
BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_DAMAGE_MULT, BOND_SPEED_MULT,
```

Add to the `import` from `'../physics/world.js'`:
```typescript
toMeters,  // already imported — verify it's present
```

Add a new import:
```typescript
import { createBondSensor, extractBondSensorContact } from '../physics/sensors.js';
import type { BondProximityEvent } from '../physics/sensors.js';
```

Add import for `BondPriceActiveDelta` from net-protocol:
```typescript
// BondPriceActiveDelta is part of DeltaEventMsg union — already covered by the DeltaEventMsg type import
```
(No extra import needed — `BondPriceActiveDelta` is a union member of `DeltaEventMsg`.)

Add private fields to the `GameRoom` class (after `private pendingVictoryContact`):
```typescript
// ── Bond proximity tracking ───────────────────────────────────────────────
private bondSensorFixtures = new Map<string, Fixture>(); // bondKey → sensor fixture on playerA's body
private bondsInRange        = new Set<string>();          // bondKeys currently in planck sensor overlap
private bondEnterTime       = new Map<string, number>();  // bondKey → epoch ms when pair entered range
private pendingBondProximityBegin: BondProximityEvent[] = [];
private pendingBondProximityEnd:   BondProximityEvent[] = [];
```

Add `Fixture` to the planck import: `import { Vec2, Body, Contact, Fixture } from 'planck';`

#### 6b: Add contact listener branches in `onCreate`

In the `physicsWorld.on('begin-contact', ...)` handler, after the victory contact check, add:
```typescript
// Bond proximity sensor
const bondBeginEvt = extractBondSensorContact(contact);
if (bondBeginEvt) this.pendingBondProximityBegin.push(bondBeginEvt);
```

In the `physicsWorld.on('end-contact', ...)` handler, after the POI end-contact extraction, add:
```typescript
const bondEndEvt = extractBondSensorContact(contact);
if (bondEndEvt) this.pendingBondProximityEnd.push(bondEndEvt);
```

#### 6c: Add bond proximity flush in `tick()` (dungeon phase only)

Add a new section in `tick()` immediately after the `// ── Flush essence collection contacts ──` section (around line 819):

```typescript
// ── Flush bond proximity contacts ────────────────────────────────────────
if (this.gameState.session.phase === 'dungeon') {
  const nowBond = Date.now();
  for (const { bondKey: key } of this.pendingBondProximityBegin) {
    if (!this.bondsInRange.has(key)) {
      this.bondsInRange.add(key);
      this.bondEnterTime.set(key, nowBond);
    }
  }
  for (const { bondKey: key } of this.pendingBondProximityEnd) {
    this.bondsInRange.delete(key);
    this.bondEnterTime.delete(key);
  }
}
this.pendingBondProximityBegin.length = 0;
this.pendingBondProximityEnd.length = 0;
```

**Note:** Always drain the pending arrays (even outside dungeon) to prevent unbounded growth.

#### 6d: Compute per-tick buff sets (beginning of `tick()`)

At the START of `tick()`, after `this.gameState.tick = this.tickCount;` and before the joystick drain loop, add:

```typescript
// Pre-compute bond buff sets for this tick (empty unless activeBonds is populated by 5.4)
const proximityBuffed = this.gameState.activeBonds.length > 0
  ? getProximityBuffedPlayers(this.gameState.activeBonds, this.bondsInRange)
  : new Set<string>();
const fateBuffed = this.gameState.activeBonds.length > 0
  ? getFateBuffedPlayers(this.gameState.activeBonds)
  : new Set<string>();
```

#### 6e: Apply speed buff in movement phase

In the movement phase section (around line 732), replace:
```typescript
body.setLinearVelocity(inDeadzone
  ? Vec2(0, 0)
  : Vec2(toMeters(jx * SPEED), toMeters(jy * SPEED))
);
```
with:
```typescript
const speed = fateBuffed.has(player.id) ? SPEED * BOND_SPEED_MULT : SPEED;
body.setLinearVelocity(inDeadzone
  ? Vec2(0, 0)
  : Vec2(toMeters(jx * speed), toMeters(jy * speed))
);
```

#### 6f: Apply damage buff in ability hit-scan

In the ability dispatch section, find where `damage` is computed from `result.value.damage` and used in `applyDamage`. Change:
```typescript
const damage = result.value.damage;
if (damage <= 0) continue;
```
to:
```typescript
const rawDamage = result.value.damage;
if (rawDamage <= 0) continue;
const damage = proximityBuffed.has(clientId)
  ? Math.round(rawDamage * BOND_DAMAGE_MULT)
  : rawDamage;
```

The existing `applyDamage(enemy, damage, dropId)` call is unchanged — it uses the (potentially multiplied) `damage`.

#### 6g: Apply Fate Bond wipe after enemy melee downs a player

In the enemy melee section, after the existing `if (dmgResult.value.downed) { ... }` block that handles the downed event, add Fate Bond wipe immediately after:

```typescript
if (dmgResult.value.downed && this.gameState.activeBonds.length > 0) {
  // Collect newly downed players for wipe cascade
  const justDowned = [targetPlayer.id];
  while (justDowned.length > 0) {
    const downedId = justDowned.pop()!;
    const wipeTargets = getFateBondWipeTargets(
      this.gameState.activeBonds,
      downedId,
      this.gameState.players,
    );
    for (const partnerId of wipeTargets) {
      const partnerIdx = this.gameState.players.findIndex(p => p.id === partnerId);
      const partner = this.gameState.players[partnerIdx];
      if (!partner) continue;
      const wipeResult = applyPlayerDamage(partner, partner.hp);
      if (!wipeResult.ok) continue; // already down/spirit/frozen
      this.gameState.players[partnerIdx] = wipeResult.value.player;
      const wipeWindowMs = wipeResult.value.reviveWindowMs!;
      this.gameState.players[partnerIdx]!.reviveTimerExpiresAt = nowMelee + wipeWindowMs;
      this.broadcast(EventNames.DELTA, {
        type: 'player:downed' as const,
        playerId: partnerId,
        downCount: wipeResult.value.player.downCount,
        reviveWindowMs: wipeWindowMs,
      } satisfies DeltaEventMsg);
      const wipeClient = this.clients.find(c => c.sessionId === partnerId);
      if (wipeClient) {
        wipeClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
      }
      logger.info({ roomId: this.roomId, playerId: partnerId, downedBy: downedId }, 'fate bond wipe — partner downed');
      justDowned.push(partnerId); // cascade: partner may also have a Fate Bond
    }
  }
}
```

**Why a while loop:** Handles the rare case where P1 (fate-bonded to P0) is also fate-bonded to P2. When P0 goes down, P1 is wiped → P1's wipe triggers another `getFateBondWipeTargets` for P1 → P2 is found. The `partner.isDown` check in `getFateBondWipeTargets` prevents P0 from being returned again.

#### 6h: Add proximity drain section in `tick()` (dungeon phase)

Add after the `// ── Enemy melee attacks ──` section and before `// ── Revive timer expiry ──`:

```typescript
// ── Proximity bond drain ─────────────────────────────────────────────────
if (this.gameState.session.phase === 'dungeon' && this.gameState.activeBonds.length > 0) {
  const nowDrain = Date.now();
  const drainTargets = getProximityDrainTargets(
    this.gameState.activeBonds,
    this.bondsInRange,
    this.bondEnterTime,
    BOND_DRAIN_THRESHOLD_S * 1000,
    nowDrain,
  );
  for (const { playerA, playerB } of drainTargets) {
    let drained = false;
    for (const playerId of [playerA, playerB]) {
      const pi = this.gameState.players.findIndex(p => p.id === playerId);
      const player = this.gameState.players[pi];
      if (!player || player.isDown || player.isSpirit || player.isFrozen) continue;
      const newHp = Math.max(1, player.hp - BOND_DRAIN_HP_PER_TICK); // ponytail: drain never kills
      if (newHp !== player.hp) {
        player.hp = newHp;
        drained = true;
        this.broadcast(EventNames.DELTA, {
          type: 'player:hp-updated' as const,
          playerId,
          hp: newHp,
        } satisfies DeltaEventMsg);
      }
    }
    if (drained) {
      this.broadcast(EventNames.DELTA, {
        type: 'bond:price-active' as const,
        playerA,
        playerB,
      } satisfies DeltaEventMsg);
    }
  }
}
```

**Why `Math.max(1, ...)`:** Drain is the "price" mechanic — it weakens the pair without killing them outright. This preserves the buff+price balance and avoids a drain-caused instant-death edge case.

**Why `drained` flag:** Only emit `bond:price-active` if at least one player's HP actually changed (prevents spurious events if both players are already at 1 HP).

#### 6i: Cleanup in `resetToHub()` and `onLeave` and `onDispose`

**In `resetToHub()`**, after `this.gameState.activeBonds = [];` (line 565), add:
```typescript
// Remove bond sensor fixtures from player bodies
for (const fixture of this.bondSensorFixtures.values()) {
  const body = fixture.getBody();
  body.destroyFixture(fixture);
}
this.bondSensorFixtures.clear();
this.bondsInRange.clear();
this.bondEnterTime.clear();
this.pendingBondProximityBegin.length = 0;
this.pendingBondProximityEnd.length = 0;
```

**In `onLeave` (consented path)**, after `this.physicsWorld.destroyBody(leaveBody)`, add:
```typescript
// Remove any bond sensor fixtures associated with this player
for (const [key, fixture] of this.bondSensorFixtures) {
  if (fixture.getBody() === leaveBody) { // body already destroyed — just remove the map entry
    this.bondSensorFixtures.delete(key);
    this.bondsInRange.delete(key);
    this.bondEnterTime.delete(key);
  }
}
```
Note: the fixture is automatically destroyed when its body is destroyed — no need to call `destroyFixture` separately here.

**In `onDispose()`**, after `this.playerBodies.clear()`, add:
```typescript
this.bondSensorFixtures.clear();
this.bondsInRange.clear();
this.bondEnterTime.clear();
```
Fixtures are gone when their bodies are destroyed above — just clear the maps.

**For the grace-period expiry path in `onLeave`**: same pattern as consented, after `this.physicsWorld.destroyBody(expireBody)`.

---

### Task 7: Extend `tests/unit/bonds.test.ts` (AC: 1–4) ✅

Add a new top-level `import` for the story 5.3 helpers:
```typescript
import {
  createRng, assignBond, selectBondType, selectBondPair,
  bondKey, getProximityBuffedPlayers, getFateBuffedPlayers,
  getFateBondWipeTargets, getProximityDrainTargets,
  BOND_DRAIN_THRESHOLD_S,
} from 'game-rules';
```

Add these describe blocks at the end of the file:

```typescript
// ─── Story 5.3: per-tick bond effect helpers ───────────────────────────────

function makeProximityBond(playerA: string, playerB: string) {
  return { playerA, playerB, type: BondType.Proximity, color: '#6ea8d8' };
}
function makeFateBond(playerA: string, playerB: string) {
  return { playerA, playerB, type: BondType.Fate, color: '#f5a623' };
}

describe('bondKey', () => {
  it('returns a stable string for a pair', () => {
    expect(bondKey('p0', 'p1')).toBe('p0+p1');
    expect(bondKey('abc', 'xyz')).toBe('abc+xyz');
  });
});

describe('getProximityBuffedPlayers', () => {
  it('returns empty set when no bonds are in range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getProximityBuffedPlayers(bonds, new Set()).size).toBe(0);
  });

  it('buffs both players when their bond key is in range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const result = getProximityBuffedPlayers(bonds, inRange);
    expect(result.has('p0')).toBe(true);
    expect(result.has('p1')).toBe(true);
  });

  it('ignores Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']); // even if key is in set, Fate bonds are not proximity
    expect(getProximityBuffedPlayers(bonds, inRange).size).toBe(0);
  });

  it('handles multiple proximity bonds independently', () => {
    const bonds = [makeProximityBond('p0', 'p1'), makeProximityBond('p0', 'p2')];
    const inRange = new Set(['p0+p1']); // only first bond in range
    const result = getProximityBuffedPlayers(bonds, inRange);
    expect(result.has('p0')).toBe(true);  // p0 is in the in-range bond
    expect(result.has('p1')).toBe(true);
    expect(result.has('p2')).toBe(false); // second bond not in range
  });
});

describe('getFateBuffedPlayers', () => {
  it('includes all players in Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const result = getFateBuffedPlayers(bonds);
    expect(result.has('p0')).toBe(true);
    expect(result.has('p1')).toBe(true);
  });

  it('ignores Proximity bonds', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getFateBuffedPlayers(bonds).size).toBe(0);
  });

  it('returns empty for no bonds', () => {
    expect(getFateBuffedPlayers([]).size).toBe(0);
  });
});

describe('getFateBondWipeTargets', () => {
  const alivePlayers = [
    { id: 'p0', isDown: false, isSpirit: false },
    { id: 'p1', isDown: false, isSpirit: false },
    { id: 'p2', isDown: false, isSpirit: false },
  ];

  it('returns the partner when a Fate bonded player is downed', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual(['p1']);
    expect(getFateBondWipeTargets(bonds, 'p1', alivePlayers)).toEqual(['p0']);
  });

  it('skips a partner who is already isDown', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const players = [
      { id: 'p0', isDown: false, isSpirit: false },
      { id: 'p1', isDown: true,  isSpirit: false }, // already down
    ];
    expect(getFateBondWipeTargets(bonds, 'p0', players)).toEqual([]);
  });

  it('skips a partner who is isSpirit', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const players = [
      { id: 'p0', isDown: false, isSpirit: false },
      { id: 'p1', isDown: false, isSpirit: true },
    ];
    expect(getFateBondWipeTargets(bonds, 'p0', players)).toEqual([]);
  });

  it('returns empty for Proximity bonds', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual([]);
  });

  it('returns empty when the downed player is not in any Fate bond', () => {
    const bonds = [makeFateBond('p1', 'p2')];
    expect(getFateBondWipeTargets(bonds, 'p0', alivePlayers)).toEqual([]);
  });
});

describe('getProximityDrainTargets', () => {
  const NOW = 10_000;
  const THRESHOLD_MS = BOND_DRAIN_THRESHOLD_S * 1000;

  it('does not drain before threshold', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS + 1]]); // 1ms short
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW)).toHaveLength(0);
  });

  it('drains at exactly the threshold', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS]]); // exactly at threshold
    const result = getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ playerA: 'p0', playerB: 'p1' });
  });

  it('does not drain when pair is out of range', () => {
    const bonds = [makeProximityBond('p0', 'p1')];
    const inRange = new Set<string>(); // not in range
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS * 2]]); // long past threshold
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW)).toHaveLength(0);
  });

  it('ignores Fate bonds', () => {
    const bonds = [makeFateBond('p0', 'p1')];
    const inRange = new Set(['p0+p1']);
    const enterTimes = new Map([['p0+p1', NOW - THRESHOLD_MS * 2]]);
    expect(getProximityDrainTargets(bonds, inRange, enterTimes, THRESHOLD_MS, NOW)).toHaveLength(0);
  });
});
```

---

### Task 8: Add `bond:price-active` contract test (AC: 6) ✅

In `tests/contract/net-protocol.test.ts`, add inside the existing `'Story 5.1 bond contract round-trips'` describe block or as a new describe:

```typescript
describe('Story 5.3 bond:price-active contract', () => {
  it('BondPriceActiveDelta survives serialize → deserialize', () => {
    const delta: DeltaEventMsg = { type: 'bond:price-active', playerA: 'p0', playerB: 'p1' };
    expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
  });

  it('applyDelta bond:price-active returns state unchanged', () => {
    const state = makeGameState(); // use existing helper in the file
    const delta: DeltaEventMsg = { type: 'bond:price-active', playerA: 'p0', playerB: 'p1' };
    expect(applyDelta(state, delta)).toBe(state); // same reference — no mutation
  });
});
```

Check the existing `tests/contract/net-protocol.test.ts` for the `makeGameState()` helper name — use whatever is already defined. Also verify the imports include `applyDelta` (it should already be imported there).

---

### Review Findings

- [x] [Review][Patch] `activeBonds` not purged on player leave → permanent Fate speed buff for remaining bonded player [`GameRoom.ts:onLeave`] — filter `activeBonds` to remove bonds involving the departing player in both the consented path and the grace-expired path
- [x] [Review][Patch] Sensor-vs-sensor contact fires at double effective proximity range in `extractBondSensorContact` [`apps/simulation-server/src/physics/sensors.ts:48`] — when both fixtures have `type === 'bond-sensor'`, the contact fires at 400px (sum of radii); add `if (dataA?.type === 'bond-sensor' && dataB?.type === 'bond-sensor') return null;` guard
- [x] [Review][Patch] `loadLevel` does not reset bond proximity state → drain fires immediately on first tick of Level 2 if spawns are within sensor range [`GameRoom.ts:loadLevel`] — add `this.bondsInRange.clear(); this.bondEnterTime.clear(); this.pendingBondProximityBegin.length = 0; this.pendingBondProximityEnd.length = 0;` to `loadLevel`
- [x] [Review][Patch] Fate Bond wipe cascade missing `player:hp-updated` delta → host mirror state shows stale (non-zero) HP for cascade-wiped players [`GameRoom.ts:1141`] — broadcast `{ type: 'player:hp-updated', playerId: partnerId, hp: 0 }` before `player:downed` in the cascade loop, consistent with the primary melee-downed path
- [x] [Review][Defer] No server-side duplicate-bond guard in `assignBond` — same pair can appear twice if story 5.4 calls `assignBond` multiple times; double drain results [`game-rules/src/systems/bonds.ts:39`] — deferred, story 5.4 scope (story 5.4 must guard against calling `assignBond` for an already-bonded pair, or add dedup in `assignBond`)
- [x] [Review][Defer] Downed/spirit players receive physics movement and Fate speed buff, can reset bond drain timer by exiting/re-entering sensor range [`GameRoom.ts:770`] — deferred, pre-existing (movement loop missing `isDown`/`isSpirit` guard, logged as D-1.5 scope); new consequence in 5.3 context
- [x] [Review][Defer] `getFateBondWipeTargets` does not filter `isFrozen` — cascade relies implicitly on `applyPlayerDamage` to reject frozen partners [`game-rules/src/systems/bonds.ts:99`] — deferred, not a live bug; document as a precondition invariant on `applyPlayerDamage` if that guard is ever relaxed

## Dev Notes

### Current State After Stories 5.1 + 5.2

| File | Current state |
|---|---|
| `packages/shared-types/src/bond.ts` | `BondType { Proximity, Fate }` + `BondState` — finalized |
| `packages/shared-types/src/game-state.ts` | `activeBonds: BondState[]` — exists |
| `packages/game-rules/src/systems/bonds.ts` | `assignBond`, `selectBondPair`, `selectBondType` — done. Story 5.3 **appends** 5 more exports |
| `packages/game-rules/src/balance.ts` | `BOND_TYPE_COLORS` — done. Story 5.3 adds 5 more constants |
| `packages/net-protocol/src/messages/server-to-host.ts` | `BondAssignedDelta` in `DeltaEventMsg` — done. Story 5.3 adds `BondPriceActiveDelta` |
| `apps/simulation-server/src/physics/world.ts` | `PhysicsBodyData`, planck helpers — story 5.3 does NOT modify this file |
| `apps/simulation-server/src/physics/sensors.ts` | Does NOT exist — story 5.3 creates it |
| `apps/simulation-server/src/rooms/GameRoom.ts` | activeBonds = [] (init + reset) — story 5.3 integrates tick effects |
| `tests/unit/bonds.test.ts` | 9 tests passing — story 5.3 appends 11 more |

### Architecture Boundary: Why `processBonds` Doesn't Live in game-rules

The epics mention `processBonds(state, world)`. The `world` parameter is planck.js — **planck is forbidden in `packages/game-rules`** (project-context.md, line 144: "no planck.js imports"). The per-tick effects are split:

- **Pure computation** (buff sets, drain targets, wipe targets) → `game-rules/src/systems/bonds.ts` — these are the unit-testable helpers.
- **Physics sensor tracking** (contact events, `bondsInRange`) → `apps/simulation-server` contact listener.
- **State mutation + delta broadcast** (HP drain, player down, speed application) → `GameRoom.tick()`.

The "bond effects phase" in `GameRoom.tick()` IS the `processBonds` concept, implemented inline with pure helpers.

### Bond Sensor Placement: Why on playerA's Body

The sensor is placed on playerA's body (not a separate static body) because both players move freely. A static sensor at a fixed position can't track two moving players. Adding the sensor fixture to playerA's body means it moves with playerA — whenever playerA's sensor circle overlaps playerB's body circle, the contact fires.

Story 5.4 will call `createBondSensor(this.playerBodies.get(bond.playerA)!, toMeters(BOND_PROXIMITY_RANGE_PX), bondKey, bond.playerB)` when a bond is assigned.

The returned `Fixture` is stored in `bondSensorFixtures.set(bondKey, fixture)` by story 5.4 so that 5.3's cleanup code (`resetToHub`, `onLeave`) can destroy it.

### Contact Listener: Fixture vs Body userData

The existing contact helpers (`extractPoiBeginContact`, `extractEssenceBeginContact`) read from **body.getUserData()** (`PhysicsBodyData`). Bond sensors need fixture-level userData because a player body has both a movement fixture and a bond sensor fixture — the body's userData identifies the player, but not which fixture is which.

`extractBondSensorContact` reads from **fixture.getUserData()** (`BondSensorFixtureData | null`). This is a different lookup path from the existing helpers and does not conflict.

### Fate Bond Speed Buff: SPEED is a Local Constant

`SPEED = 200` is a `const` declared inside `GameRoom.tick()` (line 716). It's not exported or in balance.ts. The speed buff multiplies it: `SPEED * BOND_SPEED_MULT`. Do not move `SPEED` to balance.ts — it's not requested and GameRoom owns this value.

### Proximity Drain: drain never kills

`Math.max(1, player.hp - BOND_DRAIN_HP_PER_TICK)` prevents drain from zeroing HP. This avoids:
1. An awkward "drained to death" state (no `player:downed` delta from drain).
2. A `applyPlayerDamage(player, BOND_DRAIN_HP_PER_TICK)` call that would need full downed-handling logic in the drain path.

If the game design later requires drain to kill, remove the `Math.max(1, ...)` guard and add full downed-handling (like the melee path).

### Fate Bond Wipe Cascade

With 3 bonds: P0→P1 (Fate), P1→P2 (Fate), P2→P3 (Fate). P0 goes down:
- `getFateBondWipeTargets(bonds, 'p0', players)` → ['p1']
- Push P1 to `justDowned` queue
- `getFateBondWipeTargets(bonds, 'p1', players)` → ['p2'] (P0 is already down, skipped)
- Push P2 to queue
- `getFateBondWipeTargets(bonds, 'p2', players)` → ['p3']
- And so on — terminates when no new targets

### applyDelta `bond:price-active` returns same reference

Note: most `applyDelta` cases return `{ ...state, ... }` (new object). `bond:price-active` returns the same `state` reference (no mutation). The contract test uses `toBe(state)` (reference equality) to verify this — consistent with `ability:fired`, `enemy:stomped`, `level:complete`, etc. which all return `state` unchanged.

### GameRoom Tick Performance

Bond effect computation is gated by `this.gameState.activeBonds.length > 0`. Until story 5.4 assigns bonds, this is always 0 and the checks short-circuit. No performance impact during non-bond gameplay.

`getProximityBuffedPlayers` and `getFateBuffedPlayers` are O(n) in bonds (max 3). The wipe loop is O(bonds × players). These are negligible in the 30hz tick budget.

### Downstream Story Handoffs

**Story 5.4 needs:**
- Call `assignBond(this.gameState, bondRng)` at level completion → gets `BondAssignedEvt`
- Call `createBondSensor(this.playerBodies.get(evt.playerA)!, toMeters(BOND_PROXIMITY_RANGE_PX), bondKey(evt.playerA, evt.playerB), evt.playerB)` → store returned `Fixture` in `this.bondSensorFixtures.set(key, fixture)`
- The bond sensor fixture must be stored immediately after creation — story 5.3's `resetToHub` cleanup reads from `this.bondSensorFixtures`

**Story 5.5 needs:**
- The host client receives `bond:price-active` deltas — story 5.5 shows a drain visual indicator on the tether when this delta arrives

### Project Context Rules Applied

- **No `Math.random()`** in game-rules functions — N/A for story 5.3 (no randomness in effect calculation)
- **No Colyseus imports** in `physics/sensors.ts` or game-rules functions
- **planck.js only in `apps/simulation-server`** — `createBondSensor` is in `physics/sensors.ts`, not game-rules
- **Result<T, E> — never throw** — pure helpers return plain values (no Result needed; they're total functions)
- **TypeScript strict mode** — `ReadonlySet<string>` and `ReadonlyMap<string, number>` parameters prevent accidental mutation of GameRoom's internal tracking sets
- **balance.ts for tunable values** — all 5 new constants go to `balance.ts`
- **`satisfies DeltaEventMsg`** — use `{ type: 'bond:price-active' as const, ... } satisfies DeltaEventMsg` in GameRoom, consistent with existing delta broadcasts
- **logger.debug inside tick** — Fate Bond wipe uses `logger.info` (it's a significant game event, not per-tick noise). Drain does NOT log (it fires every tick per-bond — use `logger.debug` or omit entirely)

### References

- Epic 5 Story 5.3 AC — [Source: _bmad-output/planning-artifacts/epics.md:1042-1074]
- `BondType`, `BondState` — [Source: packages/shared-types/src/bond.ts]
- `GameState.activeBonds` — [Source: packages/shared-types/src/game-state.ts:19]
- `assignBond`, `BondAssignedEvt` — [Source: packages/game-rules/src/systems/bonds.ts]
- `BOND_TYPE_COLORS` — [Source: packages/game-rules/src/balance.ts:107]
- `applyPlayerDamage` (returns Result, PLAYER_NOT_DAMAGEABLE guard) — [Source: packages/game-rules/src/systems/player-health.ts]
- `PhysicsBodyData`, `createPlayerBody` planck pattern — [Source: apps/simulation-server/src/physics/world.ts]
- `PIXELS_PER_METER = 64` and `toMeters()` — [Source: apps/simulation-server/src/physics/world.ts:4]
- `DeltaEventMsg` union, `BondAssignedDelta` — [Source: packages/net-protocol/src/messages/server-to-host.ts]
- `applyDelta` exhaustiveness guard — [Source: packages/net-protocol/src/apply-delta.ts:156]
- `net-protocol/src/index.ts` type exports pattern — [Source: packages/net-protocol/src/index.ts:5]
- `GameRoom.tick()` structure, SPEED const, joystick phase, ability hit-scan — [Source: apps/simulation-server/src/rooms/GameRoom.ts:702-1230]
- `resetToHub()` at line 544 — [Source: apps/simulation-server/src/rooms/GameRoom.ts:544]
- Spirit Bond system rules — [Source: _bmad-output/project-context.md: "Spirit Bond System" section]
- Proximity sensors (isSensor: true) rule — [Source: _bmad-output/project-context.md line ~111]
- planck forbidden in game-rules — [Source: _bmad-output/project-context.md line ~144]
- Test import pattern `from 'game-rules'` — [Source: tests/unit/bonds.test.ts:2]
- Test file location — [Source: _bmad-output/project-context.md — Testing Rules table]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No blockers. All tasks followed the story spec exactly.

### Completion Notes List

- ✅ Task 1: Added 5 balance constants (BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_DAMAGE_MULT, BOND_SPEED_MULT) to balance.ts
- ✅ Task 2: Added bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets, ProximityDrainTarget to bonds.ts
- ✅ Task 3: Exported all new symbols and types from game-rules/src/index.ts
- ✅ Task 4: Added BondPriceActiveDelta type to server-to-host.ts, to DeltaEventMsg union, handled in apply-delta.ts (returns state unchanged), exported from net-protocol/src/index.ts
- ✅ Task 5: Created apps/simulation-server/src/physics/sensors.ts with createBondSensor and extractBondSensorContact
- ✅ Task 6: Modified GameRoom.ts — added Fixture import, imported new game-rules helpers + sensors module, added 5 private fields (bondSensorFixtures, bondsInRange, bondEnterTime, pendingBondProximityBegin, pendingBondProximityEnd), added bond contact listener branches, pre-computed buff sets per tick, applied Fate speed buff in movement phase, applied Proximity damage buff in ability hit-scan, added Fate Bond wipe cascade after enemy melee down, added bond proximity flush section, added proximity drain section, added cleanup in resetToHub/onLeave(both paths)/onDispose
- ✅ Task 7: Added 17 new unit tests across bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets — total 26 tests passing
- ✅ Task 8: Added 2 contract tests for bond:price-active round-trip and applyDelta no-op behavior — total 53 contract tests passing
- ✅ AC7: npm run typecheck exits 0, zero errors across all packages

### File List

- packages/game-rules/src/systems/bonds.ts (modified)
- packages/game-rules/src/balance.ts (modified)
- packages/game-rules/src/index.ts (modified)
- packages/net-protocol/src/messages/server-to-host.ts (modified)
- packages/net-protocol/src/apply-delta.ts (modified)
- packages/net-protocol/src/index.ts (modified)
- apps/simulation-server/src/physics/sensors.ts (new)
- apps/simulation-server/src/rooms/GameRoom.ts (modified)
- tests/unit/bonds.test.ts (modified)
- tests/contract/net-protocol.test.ts (modified)
- _bmad-output/implementation-artifacts/5-3-per-tick-bond-effects-proximity-and-fate-bond-types.md (this file)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Change Log

- 2026-07-03: Implemented story 5.3 — per-tick Spirit Bond effects (Proximity damage buff + drain, Fate speed buff + wipe cascade), BondPriceActiveDelta contract, physics proximity sensors, 17 new unit tests, 2 new contract tests. typecheck clean, all existing tests green.

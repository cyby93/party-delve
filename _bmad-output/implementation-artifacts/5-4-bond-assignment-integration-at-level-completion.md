---
baseline_commit: 3ba3199
---

# Story 5.4: Bond Assignment Integration at Level Completion

Status: done

## CLAUDE.md Required Task Header

```
Phase: E5 — Spirit Bond System (Story 5.4)
Context: Stories 5.1, 5.2, and 5.3 are done.
  Existing contracts (DO NOT change):
    - packages/shared-types/src/bond.ts: BondType { Proximity='proximity', Fate='fate' }, BondState { playerA, playerB, type, color }
    - packages/shared-types/src/constants.ts: OFFSET_SPIRIT_BOND = 0x04
    - packages/game-rules/src/systems/bonds.ts: assignBond(state, rng) → Result<BondAssignedEvt, BondError>
    - packages/game-rules/src/balance.ts: BOND_TYPE_COLORS, BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_DAMAGE_MULT, BOND_SPEED_MULT
    - packages/game-rules/src/index.ts: exports assignBond, BondAssignedEvt, BondError
    - packages/net-protocol/src/messages/server-to-host.ts: BondAssignedDelta in DeltaEventMsg union
    - packages/net-protocol/src/messages/server-to-mobile.ts: BondNotificationMsg { type, playerA, playerB, bondType, bondColor, bondDescription, bondMechanic }
    - apps/simulation-server/src/physics/sensors.ts: createBondSensor(body, rangeM, bondKey, targetPlayerId) → Fixture
    - apps/simulation-server/src/rooms/GameRoom.ts: bondSensorFixtures, bondsInRange, bondEnterTime, bondKey() calls — all story 5.3 code is live
  Key state: GameRoom.prng is the main PRNG (single stream, not suitable for bond isolation).
             OFFSET_SPIRIT_BOND (0x04) is in shared-types but NOT yet imported in GameRoom.
             BondNotificationMsg is in net-protocol/index.ts but NOT yet imported in GameRoom.
             EventNames enum has no CONTINUE entry.
             The dungeon starts at levelIndex=1 (not 0) — startDungeon calls loadLevel(1).
             Level sequence: 1 (clear), 2 (survive-waves), 3 (clear), 4 (boss placeholder).
             Level completion currently calls loadLevel(levelIndex + 1) immediately (no pause).
Owner agent: Simulation Engineer (primary — game-rules + sim-server)
  Protocol Architect: packages/net-protocol, packages/shared-types (contract-change hook applies for ContinueMsg)
  QA + Telemetry Engineer: tests/e2e/full-run.test.ts
Goal: Wire bond assignment into level completion so that when a dungeon level (1, 2, or 3) ends:
  (1) assignBond() is called, BondAssignedDelta is broadcast to all clients,
  (2) BondNotificationMsg is unicast to each of the two bonded players' mobile clients,
  (3) the server enters a bond-moment pause and waits for any CONTINUE message,
  (4) on CONTINUE, loadLevel(nextIndex) is called and the run resumes.
  Boss level (4) completion continues to the existing run:complete flow unchanged.
  The existing E2E test (full-run.test.ts) must also be updated to send CONTINUE after each bond-moment.
Allowed paths:
  - packages/net-protocol/src/event-names.ts                  (MODIFY — add CONTINUE = 'bond:continue')
  - packages/net-protocol/src/messages/mobile-to-server.ts    (MODIFY — add ContinueMsg)
  - packages/net-protocol/src/index.ts                        (MODIFY — export ContinueMsg)
  - packages/game-rules/src/balance.ts                        (MODIFY — add BOND_DESCRIPTIONS, BOND_MECHANICS)
  - packages/game-rules/src/index.ts                          (MODIFY — export new constants)
  - apps/simulation-server/src/rooms/GameRoom.ts              (MODIFY — bond-moment state, CONTINUE handler, level completion wiring)
  - tests/e2e/full-run.test.ts                                (MODIFY — update for bond-moment CONTINUE flow)
Blocked paths:
  - packages/shared-types/**           (5.1 contracts are final — OFFSET_SPIRIT_BOND already exported via constants.ts)
  - apps/simulation-server/src/physics/sensors.ts  (5.3 createBondSensor already correct — call it, don't change it)
  - apps/host-client/**                (5.5 host visualization)
  - apps/mobile-controller/**          (5.6 mobile bond card)
  - packages/game-rules/src/systems/bonds.ts  (5.1–5.3 pure helpers are final)
Inputs:
  - Epic 5 Story 5.4 acceptance criteria (epics.md)
  - packages/game-rules/src/systems/bonds.ts — assignBond signature
  - packages/game-rules/src/balance.ts — BOND_TYPE_COLORS (reference for BOND_DESCRIPTIONS placement)
  - packages/net-protocol/src/messages/server-to-mobile.ts — BondNotificationMsg shape
  - packages/net-protocol/src/messages/server-to-host.ts — BondAssignedDelta shape
  - apps/simulation-server/src/physics/sensors.ts — createBondSensor signature
  - apps/simulation-server/src/rooms/GameRoom.ts — level completion code (lines 1289–1328), onCreate handlers (lines 140–255), startDungeon (lines 479–491), loadLevel (lines 663–729)
  - tests/e2e/full-run.test.ts — existing E2E test (lines 86–113) that must be updated
Non-goals:
  - Host particle tether visualization (story 5.5)
  - Mobile bond card rendering (story 5.6)
  - Boss level bond assignment (never assigns; existing run:complete flow is unchanged)
  - Bond persistence between runs (already reset via activeBonds=[] in resetToHub)
  - Mandatory read delay enforcement (that is mobile-side UX, story 5.6)
  - Any change to bond effect processing — processBonds() already runs correctly in tick (story 5.3)
Acceptance criteria:
  AC1: Level completion for dungeon levels (levelIndex 1, 2, 3) calls assignBond(), broadcasts
       BondAssignedDelta to all clients, unicasts BondNotificationMsg to each bonded player's mobile,
       and enters bond-moment pause (no auto-advance to next level)
  AC2: bond-moment: server only advances when ANY connected player sends CONTINUE → calls loadLevel(nextIndex), broadcasts snapshot
  AC3: activeBonds accumulates: length=1 after level 1, length=2 after level 2, length=3 after level 3;
       all 3 remain active during boss level (processBonds runs on all 3)
  AC4: Level 4 (boss placeholder) completion → existing victory trigger → run:complete; assignBond NOT called
  AC5: E2E test updated: level completes → BondAssignedDelta received → CONTINUE sent → next level snapshot verified with correct activeBonds.length
Required hooks:
  - Contract-change hook (adding ContinueMsg to net-protocol)
  - Simulation-safety hook (modifying GameRoom tick/message flow)
Required tests:
  - tests/e2e/full-run.test.ts extended per AC5
  - tests/contract/net-protocol.test.ts: add ContinueMsg round-trip (serialize → deserialize)
Telemetry impact: No new telemetry events required (bond:assigned delta is already the observable event)
```

## Story

As a group of players,
I want a dramatic pause at the end of each dungeon level where the spirits assign a bond,
so that the bond moment feels ceremonial and the group can read and acknowledge before advancing.

## Acceptance Criteria

1. **AC1 — Bond assignment at level completion**
   - **Given** a dungeon level's objective is completed (`level:complete` fires) for level index 1, 2, or 3
   - **When** the server processes the completion
   - **Then** `assignBond()` is called with the current `GameState` and the bond PRNG stream (`createRng(runSeed ^ OFFSET_SPIRIT_BOND)`)
   - **And** the resulting `BondAssignedEvt` is broadcast as `BondAssignedDelta` to all clients
   - **And** a `BondNotificationMsg` is unicast directly to each of the two bonded players' mobile clients (not broadcast to all)
   - **And** the sim server enters a `bond-moment` pause — it does not auto-advance to the next level

2. **AC2 — CONTINUE message resumes the run**
   - **Given** the `bond-moment` pause is active
   - **When** any connected player sends a `CONTINUE` message to the server
   - **Then** the server calls `loadLevel(nextIndex)` and the run resumes
   - **And** a full snapshot is broadcast after loading the next level

3. **AC3 — Bonds accumulate across levels**
   - **Given** bonds accumulate across levels
   - **When** levels 1, 2, and 3 each complete (with CONTINUE after each bond-moment)
   - **Then** `state.activeBonds.length` is 1 after level 1, 2 after level 2, and 3 after level 3
   - **And** all 3 bonds remain active during the boss level and `processBonds()` processes all of them each tick

4. **AC4 — Boss level completion: no bond assigned**
   - **Given** level index 4 (boss placeholder) ends via victory trigger
   - **When** `run:complete` fires
   - **Then** `assignBond()` is NOT called
   - **And** the existing run-complete flow proceeds unchanged

5. **AC5 — E2E test extended**
   - **Given** `tests/e2e/full-run.test.ts` is updated
   - **When** it runs the bond assignment path
   - **Then** it verifies: level 1 completes → `BondAssignedDelta` received by host → one simulated `CONTINUE` → level 2 loads → `activeBonds.length === 1` in the next snapshot
   - **And** same pattern verified for levels 2→3 and 3→4

## Tasks / Subtasks

- [x] Task 1: Add `CONTINUE` message type (Protocol Architect scope — contract-change hook applies) (AC: 1, 2)
  - [x] 1.1 In `packages/net-protocol/src/event-names.ts`, add `CONTINUE = 'bond:continue'` to `EventNames` enum
  - [x] 1.2 In `packages/net-protocol/src/messages/mobile-to-server.ts`, add `export interface ContinueMsg { type: 'bond:continue'; }`
  - [x] 1.3 In `packages/net-protocol/src/index.ts`, export `ContinueMsg` from the mobile-to-server imports line
  - [x] 1.4 In `tests/contract/net-protocol.test.ts`, add a `ContinueMsg` round-trip test (serialize → deserialize)

- [x] Task 2: Add bond description/mechanic text to `packages/game-rules/src/balance.ts` (AC: 1)
  - [x] 2.1 Add `BOND_DESCRIPTIONS: Record<BondType, string>` (human-readable description for the mobile card)
  - [x] 2.2 Add `BOND_MECHANICS: Record<BondType, string>` (mechanic summary for the mobile card)
  - [x] 2.3 Export both from `packages/game-rules/src/index.ts`

- [x] Task 3: GameRoom — bond-moment state fields (AC: 1, 2, 3)
  - [x] 3.1 Add `private bondRng!: () => number;` field to the GameRoom class (near line 111 with other private fields)
  - [x] 3.2 Add `private bondMomentNextLevel = -1;` field (-1 = not in bond-moment; ≥0 = next level index to load on CONTINUE)
  - [x] 3.3 In `startDungeon` (line 479), initialize `this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND)` and `this.bondMomentNextLevel = -1`
  - [x] 3.4 In `resetToHub` (around line 599), add `this.bondMomentNextLevel = -1`

- [x] Task 4: Register `CONTINUE` message handler in `onCreate` (AC: 2)
  - [x] 4.1 Add `this.onMessage(EventNames.CONTINUE, (client: Client) => { ... })` block in `onCreate` (after existing `onMessage` registrations, around line 255)
  - [x] 4.2 Guard: only act if `this.bondMomentNextLevel !== -1` (reject spurious CONTINUE messages outside bond-moment)
  - [x] 4.3 Set `this.bondMomentNextLevel = -1`, call `this.loadLevel(nextLevel)`, broadcast snapshot

- [x] Task 5: Modify level completion to call `assignBond` and enter bond-moment (AC: 1, 2, 3, 4)
  - [x] 5.1 Extracted `private enterBondMoment(levelIndex: number)` to avoid duplicating logic across both level-complete branches
  - [x] 5.2 In each branch, replaced `this.loadLevel(levelIndex + 1)` with `this.enterBondMoment(levelIndex)`: levels <4 assign bond and pause; level ≥4 calls loadLevel directly
  - [x] 5.3 Guarded level-complete check with `if (this.bondMomentNextLevel !== -1) return;` in both survive-waves and clear paths
  - [x] 5.4 When `assignBond` returns `{ ok: false }`, logs warning and falls back to immediate `loadLevel` to avoid softlock

- [x] Task 6: Create bond sensor when bond is assigned (AC: 1, 3)
  - [x] 6.1 After successful `assignBond()`, calls `createBondSensor(bodyA, toMeters(BOND_PROXIMITY_RANGE_PX), key, playerB)` and stores in `bondSensorFixtures`
  - [x] 6.2 If playerA's body is missing, logs warning and skips sensor creation (bond effects still apply via game-rules)

- [x] Task 7: Build and populate `BondNotificationMsg` (AC: 1)
  - [x] 7.1 Imported `BondNotificationMsg` from `net-protocol` in GameRoom
  - [x] 7.2 Imported `BOND_DESCRIPTIONS, BOND_MECHANICS` from `game-rules` in GameRoom
  - [x] 7.3 Imported `OFFSET_SPIRIT_BOND` from `shared-types` in GameRoom
  - [x] 7.4 Added `BOND_NOTIFICATION = 'bond:notification'` to EventNames; unicasts via `target.send(EventNames.BOND_NOTIFICATION, bondNotif)`
  - [x] 7.5 BondNotificationMsg sent on its own EventNames.BOND_NOTIFICATION channel (matches the SpiritFormMsg/CooldownUpdateMsg pattern)

- [x] Task 8: Update E2E test (AC: 5)
  - [x] 8.1 Each bond listener registered after previous bondAfterLX resolves but BEFORE CONTINUE (avoids missing bond:assigned which arrives in same WS batch as level:complete)
  - [x] 8.2 After l1 bond-moment CONTINUE, verified `activeBonds.length === 1` in snapshot
  - [x] 8.3 After l2 bond-moment CONTINUE, verified `activeBonds.length === 2` in snapshot
  - [x] 8.4 After l3 bond-moment CONTINUE, verified `activeBonds.length === 3` in snapshot
  - [x] 8.5 l3 CONTINUE resolves to loadLevel(4) (boss level); victory trigger flow verified unchanged

## Dev Notes

### Critical: Level Index Reality vs Epics

The epics document uses 0-based level indexing (0, 1, 2 → bonds; 3 = boss). The actual code uses:

```
startDungeon → loadLevel(1)   // starts at level 1, NOT 0
Level 1: clear
Level 2: survive-waves
Level 3: clear
Level 4: boss placeholder (index >= 4 in loadLevel)
```

**Bond assignment guard: `levelIndex < 4`** (levels 1, 2, 3 get bonds; boss at 4 does not). The `allEnemiesDead` path in the tick only fires for levels 1, 2, 3 — the boss uses a victory trigger contact, which goes directly to `run:complete` and never triggers the `allEnemiesDead` path.

### Critical: Re-fire Prevention

When `level:complete` fires and bond-moment starts (without calling `loadLevel`), the enemies array still contains dead enemy objects (`isAlive === false`). On the NEXT tick, the check:

```typescript
const allEnemiesDead = enemies.length > 0 && enemies.every(e => !e.isAlive);
```

...will be `true` again. **Without a guard, the server will broadcast `level:complete` every tick until CONTINUE arrives.** This is a hard bug.

Fix: add `if (this.bondMomentNextLevel !== -1) return;` (or equivalent early return) **before** the `allEnemiesDead` check in both the survive-waves and clear paths.

### CONTINUE Message Send Pattern

Looking at how existing unicast messages work:
- `CooldownUpdateMsg` is sent via `targetClient.send(EventNames.COOLDOWN_UPDATE, msg)` (line ~1354)
- `SpiritFormMsg` is sent via `client.send(EventNames.SPIRIT_FORM, msg)` (line ~375)

`BondNotificationMsg` uses `type: 'bond:notification'` — it should be sent like:
```typescript
targetClient.send(EventNames.DELTA, bondNotif satisfies BondNotificationMsg);
```
Wait — check the actual pattern used for `SpiritFormMsg` vs delta events. If `SpiritFormMsg` uses its own `EventNames.SPIRIT_FORM`, add `EventNames.BOND_NOTIFICATION = 'bond:notification'` to EventNames. But that adds a line to the Protocol Architect side. **Alternatively**, piggyback on `EventNames.DELTA` if `BondNotificationMsg` is part of the server-to-mobile union in the mobile client. Look at how the mobile client listens for messages and match exactly.

Since `BondNotificationMsg` has `type: 'bond:notification'` (distinct from any `DeltaEventMsg`), and the mobile needs to discriminate it from delta events, the cleanest approach:
- Add `BOND_NOTIFICATION = 'bond:notification'` to `EventNames`  
- Send via `client.send(EventNames.BOND_NOTIFICATION, msg)`
- Mobile listens on `EventNames.BOND_NOTIFICATION`

If you want to avoid touching EventNames (Protocol Architect scope), you can also use `EventNames.DELTA` if the mobile client dispatches on `msg.type`. Either way, flag the decision in the implementation.

### Bond PRNG Stream Initialization

```typescript
// In startDungeon, AFTER setting runSeed (line 481 sets difficulty, line 482 clears runProposal)
this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
```

The stream must be the SAME instance across all 3 bonds — do NOT create a new stream per level. Each call to `assignBond(state, this.bondRng)` advances the same PRNG stream, ensuring deterministic bond sequences across reconnects (as long as the seed is the same). This is why it's a class field, not a local variable in the level-complete handler.

### assignBond Usage

```typescript
import { assignBond, BOND_DESCRIPTIONS, BOND_MECHANICS } from 'game-rules';
// ...
const result = assignBond(this.gameState, this.bondRng);
if (!result.ok) {
  logger.warn({ roomId: this.roomId, error: result.error }, 'assignBond failed — skip bond-moment');
  this.loadLevel(levelIndex + 1);
  return;
}
const { playerA, playerB, bondType, bondColor } = result.value;
const key = bondKey(playerA, playerB); // bondKey is already imported from 'game-rules'
```

### createBondSensor Wiring

```typescript
// After successful assignBond:
const bodyA = this.playerBodies.get(playerA);
if (bodyA) {
  const fixture = createBondSensor(bodyA, toMeters(BOND_PROXIMITY_RANGE_PX), key, playerB);
  this.bondSensorFixtures.set(key, fixture);
} else {
  logger.warn({ roomId: this.roomId, playerA }, 'bond sensor skipped — player body missing');
}
```

`createBondSensor` and `toMeters` are already imported in GameRoom (lines 13–21).

### Bond Notification Text

Add to `packages/game-rules/src/balance.ts`:

```typescript
export const BOND_DESCRIPTIONS: Record<BondType, string> = {
  proximity: 'Your spirits entwine — drawing power from closeness, but paying a toll when you linger.',
  fate:      'Your fates are now bound. What befalls one, befalls the other.',
};

export const BOND_MECHANICS: Record<BondType, string> = {
  proximity: '+20% damage when in range · HP drain after 5 s together',
  fate:      '+20% movement speed always · If one falls, both fall',
};
```

Export from `packages/game-rules/src/index.ts`.

### bond-moment Pause State

Add two fields to GameRoom (insert near line 131, after `returnReadySet`):
```typescript
private bondRng!: () => number;
private bondMomentNextLevel = -1; // -1 = not in bond-moment; ≥0 = next level to load on CONTINUE
```

Initialize in `startDungeon`:
```typescript
this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
this.bondMomentNextLevel = -1;
```

Reset in `resetToHub` (around line 599, after `this.gameState.activeBonds = []`):
```typescript
this.bondMomentNextLevel = -1;
```

### CONTINUE Handler in onCreate

Add after the `RETURN_TO_CAMP` handler (around line 255):

```typescript
this.onMessage(EventNames.CONTINUE, (_client: Client) => {
  if (this.bondMomentNextLevel === -1) return;
  const nextLevel = this.bondMomentNextLevel;
  this.bondMomentNextLevel = -1;
  this.loadLevel(nextLevel);
  this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
  logger.info({ roomId: this.roomId, nextLevel }, 'bond-moment CONTINUE — loading next level');
});
```

### Level Completion Code (full proposed change)

Current clear path (lines 1321–1326):
```typescript
if (allEnemiesDead) {
  const levelIndex = this.gameState.session.levelIndex;
  this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
  this.loadLevel(levelIndex + 1);
  this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
}
```

Proposed change — guard at top of the block (both survive-waves and clear paths need it):
```typescript
// Add this guard BEFORE the allEnemiesDead check in BOTH paths:
if (this.bondMomentNextLevel !== -1) {
  // bond-moment active — don't re-fire level completion
} else if (allEnemiesDead) {
  const levelIndex = this.gameState.session.levelIndex;
  this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
  this.assignBondAndPause(levelIndex);
}
```

Or inline — avoid an extraction function (ponytail: inline is fine for the 2-branch level completion):

```typescript
// survive-waves path (around line 1302):
if (completedWave >= this.totalWaves) {
  const levelIndex = this.gameState.session.levelIndex;
  this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
  if (levelIndex < 4) {
    this.enterBondMoment(levelIndex);
  } else {
    this.loadLevel(levelIndex + 1);
    this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
  }
}

// Re-fire guard at the top of the outer `if (this.levelObjective === 'survive-waves')` block:
// Also guard the waveComplete → allWavesDone branch.
```

Consider extracting `enterBondMoment(levelIndex: number)` as a private method to avoid duplicating the logic in both the survive-waves and clear branches. This is a justified extraction (two callers, same logic).

### E2E Test Update Pattern

The existing test (`full-run.test.ts`) will BREAK as soon as this story is implemented because level 1 completing will no longer auto-advance. The update follows this pattern for each level:

```typescript
// After l1Complete resolves:
const bondAfterL1 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 3_000);
const bondDelta = await bondAfterL1;
expect(bondDelta.playerA).toBeDefined();
p1.send(EventNames.CONTINUE, {});
// Wait for level 2 snapshot
const l2Snap = await raceTimeout(
  new Promise<SnapshotMsg>((resolve) => {
    const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
      if (snap.state.session.levelIndex === 2) { unsub(); resolve(snap); }
    });
  }),
  5_000, 'level 2 snapshot after CONTINUE'
);
expect(l2Snap.state.activeBonds.length).toBe(1);
```

Repeat for l2 (→ activeBonds.length === 2) and l3 (→ activeBonds.length === 3, levelIndex → 4).

Adjust timeouts: each level wait now includes bond-moment delay (add 3–5s buffer).

### Imports Needed in GameRoom

Current imports do NOT include:
- `OFFSET_SPIRIT_BOND` from `'shared-types'` — add to line 19's import
- `BondNotificationMsg` from `'net-protocol'` — add to line 5's type import
- `BOND_DESCRIPTIONS, BOND_MECHANICS` from `'game-rules'` — add to line 15's import
- `assignBond, BondAssignedEvt` from `'game-rules'` — `assignBond` is NOT yet in line 15 import; add it

Current line 15 imports `bondKey, getProximityBuffedPlayers, ...` but NOT `assignBond`. Verify before editing.

### Ownership Scope Note

This story touches three ownership areas:
- **Protocol Architect**: `packages/net-protocol/**` (ContinueMsg, EventNames.CONTINUE)
- **Simulation Engineer**: `packages/game-rules/**`, `apps/simulation-server/**`
- **QA Engineer**: `tests/e2e/**`

This is intentional — story 5.4 is the integration story bridging these areas. The developer agent must implement all three. The contract-change hook applies: add a `ContinueMsg` round-trip test in `tests/contract/net-protocol.test.ts` before committing.

### Project Structure Notes

- All new bond constants go in `packages/game-rules/src/balance.ts` — not `shared-types/constants.ts` (balance.ts is for tunable gameplay values, constants.ts is for cross-package technical constants)
- Naming conventions: `EventNames.CONTINUE` (or `EventNames.BOND_NOTIFICATION`); message type `'bond:continue'`; match `noun:verb` pattern
- No new files needed — all changes are additions to existing files

### Project Context Rules

**Authority model**: GameRoom is the ONLY place that calls `assignBond()`. It must not be called from mobile or host code.

**Simulation safety**: `assignBond()` mutates `state.activeBonds` (pushes a new BondState). This is correct — it runs in the sim server, which owns `GameState` mutation.

**No Math.random()**: `this.bondRng` is a `createRng(seed ^ OFFSET_SPIRIT_BOND)` stream — correct.

**Result<T,E>**: `assignBond` returns `Result<BondAssignedEvt, BondError>`. Never throw; always check `result.ok` first and handle the failure path.

**Tick safety**: `enterBondMoment` (or inlined bond-moment entry) runs in the tick callback after the `allEnemiesDead` check — this is a normal synchronous path in the tick, not async. The loadLevel deferral is just storing `bondMomentNextLevel`; no async code needed.

**planck.js sensor**: `createBondSensor` operates on a planck `Body` and `Fixture` — must only be called from the simulation server (never from host/mobile). Already guaranteed by being inside GameRoom.

**No logger.info inside hot path**: Level completion is NOT a per-tick hot path (fires at most 3 times per run) — `logger.info` is appropriate here.

**Serialization**: Do NOT call `JSON.stringify` directly. Use `client.send()` and `this.broadcast()` which wrap via Colyseus's internal serialization, consistent with all other messages in GameRoom.

### References

- [Source: epics.md — Story 5.4 acceptance criteria]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1289–1328 — level completion paths]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:140–255 — onMessage handler registrations]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:479–491 — startDungeon]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:100–131 — private field declarations]
- [Source: apps/simulation-server/src/physics/sensors.ts:21–33 — createBondSensor signature]
- [Source: packages/game-rules/src/systems/bonds.ts:27–43 — assignBond implementation]
- [Source: packages/game-rules/src/balance.ts:106–118 — BOND_TYPE_COLORS, bond constants]
- [Source: packages/net-protocol/src/messages/server-to-mobile.ts:9–17 — BondNotificationMsg shape]
- [Source: packages/net-protocol/src/messages/server-to-host.ts:63–68 — BondAssignedDelta shape]
- [Source: packages/net-protocol/src/event-names.ts — EventNames enum to extend]
- [Source: tests/e2e/full-run.test.ts:86–113 — current level completion test steps that must be updated]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **bond:assigned WS batch race**: `bond:assigned` and `level:complete` are broadcast in the same synchronous Colyseus tick, so they arrive in the same WebSocket data event on the client. Registering `bondAfterL2` after `await l2Complete` meant the event had already been dispatched before the listener was installed. Fixed by registering each `bondAfterLX` immediately after the previous bond promise resolves (and unsubscribes), before sending CONTINUE.
- **EventNames.BOND_NOTIFICATION**: Added to EventNames enum rather than reusing EventNames.DELTA, following the CooldownUpdateMsg/SpiritFormMsg unicast pattern in GameRoom.

### Completion Notes List

- All 5 ACs satisfied; 311 tests pass (1 unrelated worktree test excluded).
- Contract-change hook: ContinueMsg + BOND_NOTIFICATION added to net-protocol; 3 contract tests added (56 total).
- Simulation-safety hook: GameRoom typecheck passes; bondMomentNextLevel guard prevents tick re-fire.
- Bond PRNG stream is a single `createRng(runSeed ^ OFFSET_SPIRIT_BOND)` instance initialized in `startDungeon` — same stream advances across all 3 bonds ensuring deterministic sequences.
- `assignBond` failure (< 2 players) logs warning and falls back to immediate `loadLevel` to prevent softlock.

### File List

- `packages/net-protocol/src/event-names.ts` — added CONTINUE, BOND_NOTIFICATION
- `packages/net-protocol/src/messages/mobile-to-server.ts` — added ContinueMsg
- `packages/net-protocol/src/index.ts` — exported ContinueMsg
- `packages/game-rules/src/balance.ts` — added BOND_DESCRIPTIONS, BOND_MECHANICS
- `packages/game-rules/src/index.ts` — exported BOND_DESCRIPTIONS, BOND_MECHANICS
- `apps/simulation-server/src/rooms/GameRoom.ts` — bondRng, bondMomentNextLevel, CONTINUE handler, enterBondMoment(), level completion wiring
- `tests/contract/net-protocol.test.ts` — 3 new Story 5.4 contract tests
- `tests/e2e/full-run.test.ts` — bond-moment CONTINUE flow for all 3 levels

### Change Log

| Date | Change |
|------|--------|
| 2026-07-03 | Story 5.4 implemented; all tasks complete; E2E passing |
| 2026-07-03 | Code review run (ultra); 2 patch, 4 deferred, 4 dismissed |

### Review Findings

- [x] [Review][Patch] CONTINUE handler fires in post-run phase — no phase guard; `bondMomentNextLevel` not cleared on run failure [GameRoom.ts:257, GameRoom.ts:1345]
- [x] [Review][Patch] Duplicate `bondKey` overwrites `bondSensorFixtures` when same player-pair is bonded twice in the same run [GameRoom.ts:718]
- [x] [Review][Defer] Bond-moment state invisible to reconnecting clients — out of scope for 5.4; story 5.6 covers mobile bond UX [GameRoom.ts:411]
- [x] [Review][Defer] Bond sensor fixture not cleaned when playerB (non-sensor-owner) leaves — pre-existing 5.3 issue; inert until resetToHub [GameRoom.ts:427]
- [x] [Review][Defer] `selectBondPair` statistical bias at 3 players — pre-existing 5.3 issue in bonds.ts [bonds.ts:19]
- [x] [Review][Defer] `bondRng` reuses same `runSeed` on 2nd run in same room — pre-existing epic-4 RNG design [GameRoom.ts:498]

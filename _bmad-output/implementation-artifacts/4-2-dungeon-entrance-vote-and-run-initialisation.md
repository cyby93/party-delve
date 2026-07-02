---
baseline_commit: 04ebbfa
---

# Story 4.2: Dungeon Entrance Vote & Run Initialisation

Status: done

## CLAUDE.md Required Task Header

```
Phase: 4 — Procedural Dungeon & Full Run Structure (Epic 4)
Context: The hub world is fully operational with three POIs (class-select, training-dummy,
  dungeon-entrance). The dungeon-entrance POI is currently excluded from INTERACTIVE_HUB_POIS
  so it does NOT send proximity events. The HOST_START flow (host button → GameRoom handler)
  is the only way to start a dungeon run. This story adds a proper group vote flow:
  a player approaching the dungeon entrance gets an Interact button, opens a biome+difficulty
  selector, proposes a run, all phones vote accept/decline, and unanimous accept triggers the
  dungeon phase. The HOST_START fallback button is preserved for dev convenience.
Owner agent: Multi-role — Protocol Architect (shared-types/net-protocol changes),
  Simulation Engineer (GameRoom.ts), Host Experience Engineer (HubWorldScreen),
  Mobile Controller Engineer (ControllerScreen, mobile-session)
Goal: Add the dungeon entrance proximity event, the run proposal flow (mobile UI + server
  handler), the vote accept/decline flow, and unanimous-accept dungeon start. Keep HOST_START
  working as a dev shortcut throughout.
Allowed paths:
  - packages/shared-types/src/run-proposal.ts         (NEW — RunProposal interface)
  - packages/shared-types/src/session.ts              (MODIFY — add difficulty field)
  - packages/shared-types/src/game-state.ts           (MODIFY — add runProposal field)
  - packages/shared-types/src/index.ts                (MODIFY — export RunProposal)
  - packages/shared-types/src/poi.ts                  (MODIFY — enable DUNGEON_ENTRANCE in INTERACTIVE_HUB_POIS)
  - packages/net-protocol/src/event-names.ts          (MODIFY — add RUN_PROPOSE, VOTE, RUN_STARTING)
  - packages/net-protocol/src/messages/mobile-to-server.ts  (MODIFY — add RunProposeMsg, VoteMsg)
  - packages/net-protocol/src/messages/server-to-host.ts    (MODIFY — add RunProposedDelta, RunStartingDelta)
  - packages/net-protocol/src/apply-delta.ts          (MODIFY — handle run:proposed, run:starting)
  - packages/net-protocol/src/index.ts                (MODIFY — export new types)
  - apps/simulation-server/src/rooms/GameRoom.ts      (MODIFY — add RUN_PROPOSE/VOTE handlers, startDungeon method)
  - apps/host-client/src/screens/HubWorldScreen.tsx   (MODIFY — vote indicator in top strip)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — dungeon entrance UI, vote popup)
  - apps/mobile-controller/src/session/mobile-session.ts     (MODIFY — add sendRunPropose, sendVote)
  - tests/contract/net-protocol.test.ts               (MODIFY — add runProposal to mockGameState, new delta round-trips)
Blocked paths:
  - packages/game-rules/**           (no generation logic in this story)
  - apps/backend-platform/**         (no backend changes)
  - tests/e2e/**                     (e2e test is Story 4.6)
Inputs:
  - packages/shared-types/src/poi.ts                  (existing INTERACTIVE_HUB_POIS, HUB_POIS)
  - packages/shared-types/src/enemy.ts                (existing DifficultyTier enum)
  - packages/shared-types/src/session.ts              (existing SessionState)
  - packages/shared-types/src/game-state.ts           (existing GameState + possible floorLayout from 4.1)
  - packages/net-protocol/src/event-names.ts          (existing EventNames)
  - apps/simulation-server/src/rooms/GameRoom.ts      (existing onCreate, HOST_START handler, spawnEnemies)
  - apps/host-client/src/screens/HubWorldScreen.tsx   (existing hub top strip + "Start Dungeon" button)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (existing InteractButton + POI handling)
  - apps/mobile-controller/src/session/mobile-session.ts     (existing MobileSession interface)
Non-goals:
  - Floor layout generation (Story 4.1)
  - Multi-level run loop and transitions (Story 4.3)
  - Survive the Waves objective (Story 4.4)
  - Post-run summary screen (Story 4.5)
  - Vote timeout / grace period (not specified in ACs — omit)
  - Showing per-player vote status on host (not specified — only "waiting" indicator)
  - Biome selection beyond Grassland (Epic 9 — only one biome in this epic)
Acceptance criteria:
  AC1: Player approaching dungeon-entrance POI gets the interact-button (proximity event fires).
  AC2: Tapping Interact at dungeon-entrance opens a dungeon entrance UI on the mobile:
       biome selector (Grassland only, visually present but non-editable),
       difficulty selector (Easy / Normal / Hard), and a "Propose Run" CTA.
  AC3: Tapping "Propose Run" sends a run:propose message (biome, difficulty) to the server.
       Server stores the proposal in gameState.runProposal and broadcasts run:proposed delta.
  AC4: All phones display an accept/decline popup when run:proposed delta arrives.
       Host shows "Vote in progress…" indicator in the top strip.
  AC5: Any player tapping Decline cancels the proposal.
       gameState.runProposal clears, popups dismiss, proposer can re-propose.
  AC6: When all active (non-frozen) players have tapped Accept, run:starting delta is broadcast,
       followed immediately by a full snapshot with phase='dungeon'.
       Host transitions to DungeonScreen; mobile transitions to dungeon controller.
  AC7: The HOST_START button on the host still works (dev fallback).
       It now calls the same startDungeon(DifficultyTier.EASY) method as the vote path.
Required hooks:
  - Contract-change hook: shared-types and net-protocol are both touched.
    Required: at least one new/updated contract test; tsc --noEmit must pass in all packages.
  - Simulation-safety hook: GameRoom.ts is touched.
    Required: tsc --noEmit passes; all existing 101 tests still pass.
  - Client-UX hook: HubWorldScreen and ControllerScreen are touched.
    Host checks: vote indicator legible at couch distance.
    Mobile checks: dungeon entrance UI touch targets ≥44px; vote popup touch targets ≥44px.
Required tests:
  - tests/contract/net-protocol.test.ts:
      Update mockGameState() to include runProposal: null and session.difficulty: null
      (or session.difficulty: DifficultyTier if 4.1 not implemented and field is new).
      Add round-trip tests for RunProposedDelta and RunStartingDelta.
  - All 101 existing tests must remain green.
Telemetry impact: None — vote flow is not a tracked KPI for this story.
```

---

## Story

As a group of players,
I want to gather at the dungeon entrance, propose a run, and have everyone accept before we dive in,
so that the whole group is ready and consenting before the run begins.

---

## Acceptance Criteria

**AC1 — Dungeon entrance proximity:**
**Given** a player's character approaches the dungeon entrance POI in the hub
**When** the sim server detects the proximity (planck.js sensor)
**Then** the `interact-button` slides in on that player's phone with label "Interact"

**AC2 — Dungeon entrance UI:**
**Given** the player taps "Interact" at the dungeon entrance
**When** the dungeon entrance UI opens on the phone
**Then** the player sees a biome selector (Grassland only in this epic) and a difficulty selector (Easy / Normal / Hard)
**And** a "Propose Run" CTA is present

**AC3 — Run proposal broadcast:**
**Given** the player taps "Propose Run"
**When** the `run:propose` message is received by the simulation server
**Then** `gameState.runProposal` is set with biome, difficulty, and proposedBy
**And** a `run:proposed` delta is broadcast to all connected clients

**AC4 — Vote UI shown:**
**Given** a `run:proposed` delta is received by all clients
**When** the clients process the delta
**Then** all phones display an accept/decline popup with the proposed biome and difficulty
**And** the host screen shows a "Vote in progress…" indicator

**AC5 — Decline cancels proposal:**
**Given** any player taps Decline
**When** the vote message is received by the server
**Then** the proposal is cancelled; `gameState.runProposal = null`; a snapshot is broadcast
**And** all popups dismiss; the proposing player can re-propose

**AC6 — Unanimous accept starts run:**
**Given** all connected non-frozen players have tapped Accept
**When** the simulation server receives the final accept vote
**Then** a `run:starting` delta is broadcast to all clients
**And** `gameState.session.phase = 'dungeon'`, `gameState.session.difficulty` is set to the voted difficulty
**And** `gameState.runProposal = null`
**And** the host transitions from Hub World screen to Dungeon Run (HUD) screen
**And** all phones transition from hub controller layout to in-run controller layout

**AC7 — HOST_START dev fallback preserved:**
**Given** the host clicks "Start Dungeon" on the hub screen (existing button)
**When** the `HOST_START` message is received by the server
**Then** the dungeon starts via the same `startDungeon(DifficultyTier.EASY)` method (unchanged behavior)
**And** the existing validation (host identity, non-dungeon phase, players have classes) still applies

---

## Tasks / Subtasks

- [ ] T1: shared-types — new `RunProposal` type (AC3, Protocol Architect boundary)
  - [ ] T1.1: Create `packages/shared-types/src/run-proposal.ts` with `RunProposal` interface
  - [ ] T1.2: Add `difficulty: DifficultyTier | null` to `SessionState` in `session.ts` (null until run starts)
  - [ ] T1.3: Add `runProposal: RunProposal | null` to `GameState` in `game-state.ts`
  - [ ] T1.4: Export `RunProposal` from `packages/shared-types/src/index.ts`

- [ ] T2: shared-types — enable dungeon entrance proximity (AC1)
  - [ ] T2.1: In `packages/shared-types/src/poi.ts`, change `INTERACTIVE_HUB_POIS` to include `DUNGEON_ENTRANCE`
    (comment says "excluded until Epic 4" — this IS Epic 4)

- [ ] T3: net-protocol — new event names and message types (AC3, AC6)
  - [ ] T3.1: Add to `EventNames` in `event-names.ts`: `RUN_PROPOSE = 'run:propose'`, `VOTE = 'run:vote'`, `RUN_STARTING = 'run:starting'`
  - [ ] T3.2: Add `RunProposeMsg` and `VoteMsg` to `messages/mobile-to-server.ts`
  - [ ] T3.3: Add `RunProposedDelta` and `RunStartingDelta` to `messages/server-to-host.ts`, add both to `DeltaEventMsg` union
  - [ ] T3.4: Export new message types from `packages/net-protocol/src/index.ts`

- [ ] T4: net-protocol — applyDelta (AC4, AC5, AC6)
  - [ ] T4.1: Add `run:proposed` case: set `state.runProposal = { biome, difficulty, proposedBy }`
  - [ ] T4.2: Add `run:starting` case: set `state.session.phase = 'dungeon'`, `state.session.difficulty = evt.difficulty`, `state.runProposal = null`

- [ ] T5: simulation-server — GameRoom handlers (AC3, AC5, AC6, AC7)
  - [ ] T5.1: Add `private runVotes = new Map<string, 'accept' | 'decline'>();` field
  - [ ] T5.2: Extract `private startDungeon(difficulty: DifficultyTier): void` from existing HOST_START logic
  - [ ] T5.3: Update `HOST_START` handler to call `this.startDungeon(DifficultyTier.EASY)` (same behavior, no regression)
  - [ ] T5.4: Update `spawnEnemies` to accept `difficulty: DifficultyTier` parameter; pass it to spawned enemies
  - [ ] T5.5: Add `onMessage(EventNames.RUN_PROPOSE, ...)` handler
  - [ ] T5.6: Add `onMessage(EventNames.VOTE, ...)` handler (decline → clear + snapshot; all accepted → startDungeon)
  - [ ] T5.7: Update `createEmptyGameState()` to include `runProposal: null`; update `session` init to include `difficulty: null`

- [ ] T6: host-client — vote indicator in HubWorldScreen (AC4)
  - [ ] T6.1: When `gameState?.runProposal !== null`, replace the "Start Dungeon" button area with a vote indicator
    (one short text label "⚔ Vote in progress…" in `accent-spirit` color)
  - [ ] T6.2: When `gameState?.runProposal === null`, show the existing Start Dungeon button (no behavior change)

- [ ] T7: mobile-session — add run proposal and vote methods (AC3, AC5, AC6)
  - [ ] T7.1: Add `sendRunPropose: (msg: RunProposeMsg) => void` and `sendVote: (msg: VoteMsg) => void` to `MobileSession` interface
  - [ ] T7.2: Wire them in `joinSession` and `reconnectToSession`: `room.send(EventNames.RUN_PROPOSE, msg)` and `room.send(EventNames.VOTE, msg)`

- [ ] T8: mobile-controller — dungeon entrance UI and vote popup in ControllerScreen (AC2, AC4, AC5, AC6)
  - [ ] T8.1: Add `dungeonEntranceOpen` state
  - [ ] T8.2: Handle `activePoi === 'dungeon-entrance'` in `InteractButton` tap: `setDungeonEntranceOpen(true)`
  - [ ] T8.3: Clear `dungeonEntranceOpen` when `activePoi !== 'dungeon-entrance'` (useEffect)
  - [ ] T8.4: Add `DungeonEntranceScreen` component: biome label (Grassland, static), difficulty picker (Easy/Normal/Hard tabs), "Propose Run" CTA, Back button
  - [ ] T8.5: Render vote popup when `!inDungeon && gameState?.runProposal !== null && !dungeonEntranceOpen`
    - Show proposed biome and difficulty
    - Accept and Decline buttons calling `session.sendVote({ type: 'run:vote', accept: true/false })`

- [ ] T9: contract tests (Required hook)
  - [ ] T9.1: Update `mockGameState()` in `tests/contract/net-protocol.test.ts` to include `runProposal: null` and `session.difficulty: null`
  - [ ] T9.2: Add round-trip tests for `RunProposedDelta` and `RunStartingDelta`
  - [ ] T9.3: Verify all 101 existing tests still pass

---

## Dev Notes

### The Core Change: Three Layers

This story spans four packages and five files. The change is vertically narrow (one new flow)
but horizontally wide (protocol → sim → host → mobile).

**Layer 1 — Protocol (shared-types + net-protocol):** New types, new EventNames, new delta types.
**Layer 2 — Simulation (GameRoom.ts):** Two new message handlers; extract `startDungeon()`; add `runVotes` map.
**Layer 3 — UI (HubWorldScreen + ControllerScreen):** Minimal host indicator; full mobile UX flow.

### What Already Exists — Do NOT Re-Implement

- `DUNGEON_ENTRANCE` POI is already defined in `HUB_POIS` at `(960, 180)` with `radius: 120`. It is only excluded from `INTERACTIVE_HUB_POIS` by the current filter. Removing the filter is the entire T2 change.
- `DifficultyTier.EASY / .NORMAL / .HARD` — already in `packages/shared-types/src/enemy.ts`. Import from there.
- `PoiType.DUNGEON_ENTRANCE` — already defined in `packages/shared-types/src/poi.ts`. No new enum value needed.
- The `InteractButton` component in `ControllerScreen.tsx` is already wired: it slides in when `activePoi !== null`. You only need to handle the `dungeon-entrance` case in the `onTap` handler (T8.2).
- The existing proximity event pipeline (`poi:entered` / `poi:exited` deltas → `applyDelta` → `nearPoiId` on `PlayerState`) already works for class-select and training-dummy. Once DUNGEON_ENTRANCE is in `INTERACTIVE_HUB_POIS`, the physics sensor is automatically created and the existing contact listener fires — no new physics code needed.
- `applyDelta` already handles `player:poi-entered` and `player:poi-exited`. These will automatically fire for `dungeon-entrance` proximity once the sensor exists.

### Dependency on Story 4.1

Story 4.1 adds `GameState.floorLayout: FloorLayout | null` and `OFFSET_FLOOR_LAYOUT / OFFSET_ROOM_POOL` constants. Story 4.2 does NOT depend on these for the vote flow.

**If Story 4.1 has already been implemented when you start 4.2:**
- `GameState` already has `floorLayout`. The `mockGameState()` already includes `floorLayout: null`. Just add `runProposal: null` and `session.difficulty: null`.
- In `startDungeon()`, include the `generateFloorLayout(...)` call that was added to the HOST_START handler by 4.1 (copy it from there).

**If Story 4.1 has NOT been implemented yet:**
- `GameState` does NOT have `floorLayout`. Add only `runProposal: null` and `session.difficulty: null`.
- Skip `generateFloorLayout` in `startDungeon()`. Story 4.1 will add it later.
- TypeScript strict mode will tell you if `mockGameState()` is incomplete — trust the compiler.

### T2: The One-Line INTERACTIVE_HUB_POIS Fix

In `packages/shared-types/src/poi.ts`, the current code is:

```typescript
// Subset of HUB_POIS that send proximity events. Dungeon entrance is excluded until Epic 4.
export const INTERACTIVE_HUB_POIS: ReadonlyArray<PoiDefinition> = HUB_POIS.filter(
  p => p.type !== PoiType.DUNGEON_ENTRANCE,
);
```

Change to:

```typescript
// All POIs now send proximity events (DUNGEON_ENTRANCE enabled in Epic 4).
export const INTERACTIVE_HUB_POIS: ReadonlyArray<PoiDefinition> = HUB_POIS;
```

That's it. `GameRoom.onCreate` already loops over `INTERACTIVE_HUB_POIS` to call `createPoiSensorBody()`. The physics sensor and contact listener chain are already wired — they just now cover the dungeon entrance too. No other physics changes needed.

### T1: New Types

```typescript
// packages/shared-types/src/run-proposal.ts
import type { DifficultyTier } from './enemy.js';

export interface RunProposal {
  biome: 'grassland';          // only Grassland in Epic 4
  difficulty: DifficultyTier;
  proposedBy: string;          // playerId of the proposer
}
```

In `packages/shared-types/src/session.ts`, add one line:
```typescript
import type { DifficultyTier } from './enemy.js';

export interface SessionState {
  // ...existing fields...
  difficulty: DifficultyTier | null;  // null until run starts
}
```

In `packages/shared-types/src/game-state.ts`, add one field:
```typescript
import type { RunProposal } from './run-proposal.js';

export interface GameState {
  // ...existing fields...
  runProposal: RunProposal | null;  // null when no vote is in progress
}
```

### T3: New Net-Protocol Types

```typescript
// packages/net-protocol/src/messages/mobile-to-server.ts (additions)
import type { DifficultyTier } from 'shared-types';

export interface RunProposeMsg {
  type: 'run:propose';
  biome: 'grassland';
  difficulty: DifficultyTier;
}

export interface VoteMsg {
  type: 'run:vote';
  accept: boolean;
}
```

```typescript
// packages/net-protocol/src/messages/server-to-host.ts (additions)
import type { DifficultyTier } from 'shared-types';

export type RunProposedDelta = {
  type: 'run:proposed';
  biome: 'grassland';
  difficulty: DifficultyTier;
  proposedBy: string;
};

export type RunStartingDelta = {
  type: 'run:starting';
  biome: 'grassland';
  difficulty: DifficultyTier;
};
```

Add both to the `DeltaEventMsg` union at the bottom of `server-to-host.ts`.

```typescript
// packages/net-protocol/src/event-names.ts (additions)
export enum EventNames {
  // ...existing...
  RUN_PROPOSE  = 'run:propose',   // mobile → server
  VOTE         = 'run:vote',      // mobile → server
  RUN_STARTING = 'run:starting',  // server → all (transient signal before snapshot)
}
```

### T4: applyDelta Changes

```typescript
// packages/net-protocol/src/apply-delta.ts

case 'run:proposed': {
  return {
    ...state,
    runProposal: {
      biome: evt.biome,
      difficulty: evt.difficulty,
      proposedBy: evt.proposedBy,
    },
  };
}
case 'run:starting': {
  return {
    ...state,
    runProposal: null,
    session: { ...state.session, phase: 'dungeon', difficulty: evt.difficulty },
  };
}
```

The `run:starting` delta sets `phase = 'dungeon'` optimistically so host/mobile can transition
screens immediately. The snapshot that follows overwrites the state entirely (authoritative).

### T5: GameRoom.ts — The Main Implementation

#### T5.2: Extract `startDungeon` Private Method

The HOST_START handler currently has this logic inline (lines ~111–128):
```typescript
this.gameState.session.phase = 'dungeon';
this.gameState.session.levelIndex = 1;
for (const p of this.gameState.players) p.nearPoiId = null;
this.spawnEnemies();
const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
this.broadcast(EventNames.SNAPSHOT, snapshot);
logger.info({ roomId: this.roomId }, 'dungeon phase started');
```

Extract this into a private method:

```typescript
private startDungeon(difficulty: DifficultyTier): void {
  this.gameState.session.phase = 'dungeon';
  this.gameState.session.levelIndex = 1;
  this.gameState.session.difficulty = difficulty;
  this.gameState.runProposal = null;
  for (const p of this.gameState.players) p.nearPoiId = null;
  // If Story 4.1 is implemented, generateFloorLayout call goes here (copy from HOST_START).
  this.spawnEnemies(difficulty);
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId, difficulty }, 'dungeon phase started');
}
```

Replace the HOST_START handler body with: `this.startDungeon(DifficultyTier.EASY);`
(the existing `if` guards stay — only the body changes).

#### T5.4: Update `spawnEnemies`

Change signature from `private spawnEnemies(): void` to `private spawnEnemies(difficulty: DifficultyTier = DifficultyTier.EASY): void`.

Inside the loop, change `difficultyTier: DifficultyTier.EASY` to `difficultyTier: difficulty`.

This makes existing HOST_START tests unaffected (default parameter preserves behavior) while
allowing the vote path to pass the chosen difficulty.

#### T5.5: `RUN_PROPOSE` Handler

```typescript
this.onMessage(EventNames.RUN_PROPOSE, (client: Client, raw: unknown) => {
  try {
    const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as RunProposeMsg;
    if (this.gameState.session.phase !== 'hub') return;
    if (this.gameState.runProposal !== null) return; // proposal already in flight
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player || player.isFrozen) return;

    this.runVotes.clear();
    this.gameState.runProposal = { biome: msg.biome, difficulty: msg.difficulty, proposedBy: client.sessionId };
    const delta: DeltaEventMsg = { type: 'run:proposed', biome: msg.biome, difficulty: msg.difficulty, proposedBy: client.sessionId };
    this.broadcast(EventNames.DELTA, delta);
    logger.info({ roomId: this.roomId, proposedBy: client.sessionId, difficulty: msg.difficulty }, 'run proposed');
  } catch {
    logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse RUN_PROPOSE — discarded');
  }
});
```

#### T5.6: `VOTE` Handler

```typescript
this.onMessage(EventNames.VOTE, (client: Client, raw: unknown) => {
  try {
    const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as VoteMsg;
    if (this.gameState.session.phase !== 'hub') return;
    if (this.gameState.runProposal === null) return; // no active proposal
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player || player.isFrozen) return;

    if (!msg.accept) {
      // Any decline immediately cancels
      this.gameState.runProposal = null;
      this.runVotes.clear();
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, snapshot);
      logger.info({ roomId: this.roomId, declinedBy: client.sessionId }, 'run proposal declined');
      return;
    }

    this.runVotes.set(client.sessionId, 'accept');

    // Unanimous accept = all active (non-frozen) players have accepted
    const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
    const allAccepted = activePlayers.every(p => this.runVotes.get(p.id) === 'accept');
    if (!allAccepted) return; // still waiting for remaining players

    const proposal = this.gameState.runProposal;
    const startDelta: DeltaEventMsg = { type: 'run:starting', biome: proposal.biome, difficulty: proposal.difficulty };
    this.broadcast(EventNames.DELTA, startDelta);
    this.startDungeon(proposal.difficulty);
    logger.info({ roomId: this.roomId, difficulty: proposal.difficulty }, 'run starting — unanimous accept');
  } catch {
    logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse VOTE — discarded');
  }
});
```

**Key invariant:** The `run:starting` delta is broadcast BEFORE `startDungeon()` calls `this.broadcast(EventNames.SNAPSHOT, ...)`. Clients get the signal first, then the full state. Both fire in the same JavaScript event loop turn, so ordering is guaranteed.

**Frozen player handling:** Only `activePlayers = players.filter(p => !p.isFrozen)` vote. A frozen player disconnecting mid-vote does not deadlock the vote. If the freeze happens before they vote, their absence is excluded from the unanimity check.

#### T5.7: `createEmptyGameState` Update

```typescript
function createEmptyGameState(roomId: string): GameState {
  return {
    session: {
      roomId,
      hostId: '',
      phase: 'lobby',
      playerCount: 0,
      maxPlayers: 8,
      runSeed: 0,
      levelIndex: 0,
      difficulty: null,      // NEW
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
    runProposal: null,       // NEW
    // floorLayout: null,    // Already present if Story 4.1 was implemented
  };
}
```

If TypeScript complains that `floorLayout` is missing: Story 4.1 has not been implemented yet — add `floorLayout: null` here (or Story 4.1 will add it when it runs).

### T6: HubWorldScreen — Minimal Host Indicator

In `apps/host-client/src/screens/HubWorldScreen.tsx`, the "Start Dungeon" button area is currently:

```tsx
<div style={{ marginLeft: 'auto' }}>
  <button onClick={() => session?.sendStartGame()} disabled={!allClassesConfirmed} ...>
    {allClassesConfirmed ? 'Start Dungeon' : 'Waiting for classes…'}
  </button>
</div>
```

Replace this `<div>` with:

```tsx
<div style={{ marginLeft: 'auto' }}>
  {gameState?.runProposal !== null && gameState?.runProposal !== undefined ? (
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--accent-spirit)',
    }}>
      ⚔ Vote in progress…
    </span>
  ) : (
    <button
      onClick={() => session?.sendStartGame()}
      disabled={!allClassesConfirmed}
      style={{
        background: allClassesConfirmed ? 'var(--interactive)' : 'var(--bg-surface)',
        color: allClassesConfirmed ? 'var(--bg-base)' : 'var(--text-secondary)',
        border: allClassesConfirmed ? 'none' : '1px solid var(--border)',
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-sm)',
        borderRadius: 6,
        height: 32,
        padding: '0 12px',
        cursor: allClassesConfirmed ? 'pointer' : 'not-allowed',
      }}
    >
      {allClassesConfirmed ? 'Start Dungeon' : 'Waiting for classes…'}
    </button>
  )}
</div>
```

### T7: mobile-session.ts

Add to `MobileSession` interface:
```typescript
export interface MobileSession {
  // ...existing...
  sendRunPropose: (msg: RunProposeMsg) => void;
  sendVote: (msg: VoteMsg) => void;
}
```

In both `joinSession` and `reconnectToSession`, add to the returned object:
```typescript
sendRunPropose: (msg: RunProposeMsg) => room.send(EventNames.RUN_PROPOSE, msg),
sendVote: (msg: VoteMsg) => room.send(EventNames.VOTE, msg),
```

Import `RunProposeMsg, VoteMsg` from `net-protocol` and `EventNames` is already imported.

### T8: ControllerScreen — Mobile UI Changes

#### State additions

```typescript
const [dungeonEntranceOpen, setDungeonEntranceOpen] = useState(false);
```

#### Clear on POI exit (alongside existing `trainingDummyActive` useEffect)

```typescript
useEffect(() => {
  if (activePoi !== 'dungeon-entrance') {
    setDungeonEntranceOpen(false);
  }
}, [activePoi]);
```

#### InteractButton tap handler (line ~987)

```typescript
<InteractButton
  visible={activePoi !== null}
  onTap={() => {
    if (activePoi === 'class-select') setClassSelectionOpen(true);
    if (activePoi === 'training-dummy' && confirmedClass !== null) setTrainingDummyActive(true);
    if (activePoi === 'dungeon-entrance') setDungeonEntranceOpen(true);  // ADD
  }}
/>
```

#### DungeonEntranceScreen component

Add as a sibling to `ClassSelectionScreen` in the file. This component is a full-screen overlay:

```tsx
interface DungeonEntranceScreenProps {
  session: MobileSession | null;
  onBack: () => void;
}

function DungeonEntranceScreen({ session, onBack }: DungeonEntranceScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyTier>(DifficultyTier.NORMAL);

  const difficulties: Array<{ id: DifficultyTier; label: string }> = [
    { id: DifficultyTier.EASY,   label: 'Easy'   },
    { id: DifficultyTier.NORMAL, label: 'Normal' },
    { id: DifficultyTier.HARD,   label: 'Hard'   },
  ];

  function handlePropose() {
    if (!session) return;
    session.sendRunPropose({ type: 'run:propose', biome: 'grassland', difficulty: selectedDifficulty });
    onBack(); // close the screen; vote popup will appear when server broadcasts
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', zIndex: 50,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
      {/* Biome — static, single option */}
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
          Biome
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', color: 'var(--text-primary)',
          border: '2px solid var(--accent-spirit)', borderRadius: 8, padding: '12px 24px',
          boxShadow: '0 0 12px rgba(110,168,216,0.3)' }}>
          Grassland
        </div>
      </div>

      {/* Difficulty tabs */}
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
          Difficulty
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {difficulties.map(d => (
            <button
              key={d.id}
              onPointerDown={e => { e.preventDefault(); setSelectedDifficulty(d.id); }}
              style={{
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
                minWidth: 80, minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: selectedDifficulty === d.id ? 'var(--interactive)' : 'var(--bg-surface)',
                color: selectedDifficulty === d.id ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onPointerDown={e => { e.preventDefault(); handlePropose(); }}
        style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-md)',
          width: '100%', minHeight: 56, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'var(--interactive)', color: 'var(--bg-base)',
          boxShadow: '0 0 16px rgba(110,168,216,0.4)', touchAction: 'manipulation' }}
      >
        Propose Run
      </button>

      <button
        onPointerDown={e => { e.preventDefault(); onBack(); }}
        style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--text-sm)',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}
      >
        Back
      </button>
    </div>
  );
}
```

**Import `DifficultyTier` from `'shared-types'` at the top of ControllerScreen.tsx** (it's not currently imported).

#### Vote popup

Add a `VotePopup` component and render it in `ControllerScreen`:

```tsx
interface VotePopupProps {
  proposal: RunProposal;
  onAccept: () => void;
  onDecline: () => void;
}

function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const difficultyLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[proposal.difficulty] ?? proposal.difficulty;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,14,16,0.85)', zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
        Run Proposed
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Grassland · {difficultyLabel}
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onPointerDown={e => { e.preventDefault(); onDecline(); }}
          style={{ flex: 1, minHeight: 56, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
            cursor: 'pointer', touchAction: 'manipulation' }}
        >
          Decline
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); onAccept(); }}
          style={{ flex: 1, minHeight: 56, borderRadius: 8, border: 'none',
            background: 'var(--interactive)', color: 'var(--bg-base)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
            cursor: 'pointer', touchAction: 'manipulation', boxShadow: '0 0 16px rgba(110,168,216,0.4)' }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
```

In `ControllerScreen` return JSX, add (near the end, after all other overlays):

```tsx
{/* Vote popup — shown to all players when a run is proposed */}
{!inDungeon && (gameState?.runProposal ?? null) !== null && !dungeonEntranceOpen && (
  <VotePopup
    proposal={gameState!.runProposal!}
    onAccept={() => session?.sendVote({ type: 'run:vote', accept: true })}
    onDecline={() => session?.sendVote({ type: 'run:vote', accept: false })}
  />
)}

{/* Dungeon entrance screen */}
{dungeonEntranceOpen && (
  <DungeonEntranceScreen
    session={session}
    onBack={() => setDungeonEntranceOpen(false)}
  />
)}
```

**Import `RunProposal` from `'shared-types'`** at the top of ControllerScreen.tsx.

### T9: Contract Test Update

In `tests/contract/net-protocol.test.ts`, the `mockGameState()` helper returns a `GameState` object. Add the new fields:

```typescript
function mockGameState(): GameState {
  return {
    // ...existing fields...
    runProposal: null,        // NEW in Story 4.2
    // session.difficulty: null,  add to the session object inside mockGameState
  };
}
```

The `session` object inside `mockGameState()` should now have `difficulty: null`.

Add two new `describe` blocks for round-trip serialization:

```typescript
describe('RunProposedDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const delta: DeltaEventMsg = {
      type: 'run:proposed',
      biome: 'grassland',
      difficulty: DifficultyTier.NORMAL,
      proposedBy: 'player-1',
    };
    expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
  });
});

describe('RunStartingDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const delta: DeltaEventMsg = {
      type: 'run:starting',
      biome: 'grassland',
      difficulty: DifficultyTier.HARD,
    };
    expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
  });
});
```

Import `DifficultyTier` at the top of the test file.

### What Must NOT Break

- `player:poi-entered` and `player:poi-exited` for `class-select` and `training-dummy` must still work. The only change to the physics pipeline is adding a third sensor body for `dungeon-entrance`. The existing contact listener and dispatch code are unchanged.
- The HOST_START flow (host button → instant dungeon start) must remain functional for dev use.
- The reconnect grace period: `onLeave(consented=false)` behavior is unchanged. A frozen player does not participate in the vote unanimity check (excluded via `!p.isFrozen` filter).
- The `run:failed` and `run:complete` delta types already exist — do NOT rename or move them.
- TypeScript strict mode: every new nullable field requires null-guarding at usage sites. The compiler catches these.

---

## Project Structure Notes

```
packages/
  shared-types/
    src/
      run-proposal.ts        (NEW — RunProposal interface)
      session.ts             (MODIFY — difficulty field)
      game-state.ts          (MODIFY — runProposal field)
      poi.ts                 (MODIFY — INTERACTIVE_HUB_POIS)
      index.ts               (MODIFY — export RunProposal)
  net-protocol/
    src/
      event-names.ts         (MODIFY — RUN_PROPOSE, VOTE, RUN_STARTING)
      messages/
        mobile-to-server.ts  (MODIFY — RunProposeMsg, VoteMsg)
        server-to-host.ts    (MODIFY — RunProposedDelta, RunStartingDelta, DeltaEventMsg union)
      apply-delta.ts         (MODIFY — run:proposed, run:starting cases)
      index.ts               (MODIFY — export new types)
apps/
  simulation-server/
    src/
      rooms/
        GameRoom.ts          (MODIFY — runVotes, startDungeon, RUN_PROPOSE/VOTE handlers)
  host-client/
    src/
      screens/
        HubWorldScreen.tsx   (MODIFY — vote indicator in top strip)
  mobile-controller/
    src/
      screens/
        ControllerScreen.tsx (MODIFY — DungeonEntranceScreen, VotePopup, dungeonEntranceOpen state)
      session/
        mobile-session.ts    (MODIFY — sendRunPropose, sendVote)
tests/
  contract/
    net-protocol.test.ts     (MODIFY — mockGameState + new delta round-trips)
```

### Cross-Ownership Note

This story touches 4 ownership areas (Protocol Architect, Simulation Engineer, Host Experience Engineer, Mobile Controller Engineer + QA). All changes are clearly scoped to their respective areas. The shared-types/net-protocol additions are purely additive (new fields, new union members) with no breaking changes to existing types. No cross-context approval needed beyond the standard contract-change hook.

---

## Project Context Rules

- **No `Math.random()` in sim server.** GameRoom.ts already uses `createRng()` for all randomness. The vote flow adds no randomness — no PRNG concern here.
- **Never call `JSON.stringify` / `JSON.parse` directly.** The `RUN_PROPOSE` and `VOTE` handlers in GameRoom.ts use the same `(typeof raw === 'string' ? JSON.parse(raw) : raw)` pattern already used for `CLASS_SELECT` and `INPUT`. This is the correct approach — the outer `try/catch` handles malformed messages.
- **TypeScript strict mode in all packages.** New nullable fields (`runProposal`, `session.difficulty`) require explicit null handling. `gameState?.runProposal ?? null` in React is safe.
- **NFR15 — All WebSocket messages must use net-protocol wrappers.** `room.send(EventNames.RUN_PROPOSE, msg)` is correct — Colyseus handles serialization. `this.broadcast(EventNames.DELTA, delta)` is correct on the server side.
- **NFR16 — No Colyseus @Schema.** The `runProposal` field lives in plain `GameState`, not a Colyseus schema. Correct by construction.
- **Touch targets ≥44px minimum (NFR5, UX-DR20).** All buttons in `DungeonEntranceScreen` and `VotePopup` must have `minHeight: 44px` or greater. The difficulty tabs use `minHeight: 44`.
- **Naming conventions:** new event names use `noun:verb` pattern (`run:propose`, `run:vote`, `run:starting`). New types are PascalCase + Msg/Delta suffix (`RunProposeMsg`, `VoteMsg`, `RunProposedDelta`, `RunStartingDelta`). New interface `RunProposal` (no suffix — it's a domain type, not a wire type).
- **pkg manager: npm.** To typecheck across packages: `npm run typecheck --workspace=packages/shared-types && npm run typecheck --workspace=packages/net-protocol && npm run typecheck --workspace=apps/simulation-server && npm run typecheck --workspace=apps/host-client && npm run typecheck --workspace=apps/mobile-controller`
- **Spirit Chant glow (UX-DR11):** Applied to the `accent-spirit` Grassland label border and the Accept button's `interactive` glow. Not applied to idle/waiting states — only active/selected elements.
- **Context7 MCP:** Not applicable for this story — no third-party library API lookups required.

---

## References

- Epic 4 Story 4.2 spec: `_bmad-output/planning-artifacts/epics.md` (lines 826–858)
- FR10: dungeon entrance vote requirement: `_bmad-output/planning-artifacts/epics.md` (line 31)
- Existing INTERACTIVE_HUB_POIS: `packages/shared-types/src/poi.ts` (DUNGEON_ENTRANCE excluded comment)
- DifficultyTier enum: `packages/shared-types/src/enemy.ts` (lines 14–18)
- CLASS_SELECT interact pattern in ControllerScreen: `apps/mobile-controller/src/screens/ControllerScreen.tsx` (~line 987)
- HOST_START handler: `apps/simulation-server/src/rooms/GameRoom.ts` (lines 111–128)
- spawnEnemies: `apps/simulation-server/src/rooms/GameRoom.ts` (lines 318–343)
- Existing delta handling in host-session: `apps/host-client/src/session/host-session.ts` (lines 37–60)
- applyDelta current cases: `packages/net-protocol/src/apply-delta.ts`
- Contract test structure: `tests/contract/net-protocol.test.ts`
- UX design requirements for touch targets: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` (UX-DR20)

---

## Review Findings

- [x] [Review][Patch] Vote livelock — last holdout freezes after others voted [GameRoom.ts:165] — FIXED
  — Extracted `resolveVoteIfComplete()` private method. Called from `onLeave` both after setting `isFrozen=true` and after grace-period expiry removal. Method checks active (non-frozen) players, class readiness, and vote map before triggering start.

- [x] [Review][Patch] Missing class-selection gate on vote path [GameRoom.ts:163] — FIXED
  — Added `activePlayers.some(p => p.class === null)` guard inside `resolveVoteIfComplete()`, scoped to non-frozen players (frozen players can't select a class and shouldn't block the vote).

- [x] [Review][Patch] VotePopup suppressed when DungeonEntranceScreen is open [ControllerScreen.tsx:1254] — FIXED
  — Added `useEffect` on `gameState?.runProposal` that calls `setDungeonEntranceOpen(false)` when a proposal becomes non-null.

- [x] [Review][Patch] No input validation of biome/difficulty in RUN_PROPOSE [GameRoom.ts:129] — FIXED
  — Added `biome !== 'grassland'` guard and `!Object.values(DifficultyTier).includes(msg.difficulty)` guard before storing the proposal, matching the CLASS_SELECT validation pattern.

- [x] [Review][Defer] HOST_START silently overrides active vote [GameRoom.ts:115] — deferred, pre-existing
  — No `runProposal !== null` guard in HOST_START. However, HubWorldScreen replaces the Start Dungeon button with the vote indicator when a proposal is active, making this unreachable via normal UI. Dev-tool fallback; acceptable for the current phase.

- [x] [Review][Defer] HOST_START accepts post-run phase [GameRoom.ts:117] — deferred, pre-existing
  — HOST_START only guards `phase === 'dungeon'`, not `post-run`. However HubWorldScreen is not rendered in post-run (App.tsx:69), so HOST_START cannot be triggered from normal UI in that phase.

- [x] [Review][Defer] Late joiner added to active voters mid-vote [GameRoom.ts:165] — deferred, pre-existing
  — A player joining after a proposal was broadcast is correctly included in the unanimity check and sees the VotePopup via snapshot. No timeout is in scope per story non-goals.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Fixed pre-existing test helper in `game-room-host-join.test.ts` that was missing `difficulty: null` and `runProposal: null` from the locally-defined `createEmptyGameState` — caught by strict TypeScript after the new fields were added.
- Story 4.1 was already done, so `startDungeon()` includes the `generateFloorLayout` call copied from the existing HOST_START handler.
- `spawnEnemies` default parameter (`difficulty = DifficultyTier.EASY`) preserves backward compatibility with all existing tests.
- All 263 tests pass (0 regressions); 5 new Story 4.2 contract tests added.

### File List

packages/shared-types/src/run-proposal.ts (NEW)
packages/shared-types/src/session.ts (MODIFIED)
packages/shared-types/src/game-state.ts (MODIFIED)
packages/shared-types/src/index.ts (MODIFIED)
packages/shared-types/src/poi.ts (MODIFIED)
packages/net-protocol/src/event-names.ts (MODIFIED)
packages/net-protocol/src/messages/mobile-to-server.ts (MODIFIED)
packages/net-protocol/src/messages/server-to-host.ts (MODIFIED)
packages/net-protocol/src/apply-delta.ts (MODIFIED)
packages/net-protocol/src/index.ts (MODIFIED)
apps/simulation-server/src/rooms/GameRoom.ts (MODIFIED)
apps/simulation-server/tests/game-room-host-join.test.ts (MODIFIED)
apps/host-client/src/screens/HubWorldScreen.tsx (MODIFIED)
apps/mobile-controller/src/session/mobile-session.ts (MODIFIED)
apps/mobile-controller/src/screens/ControllerScreen.tsx (MODIFIED)
tests/contract/net-protocol.test.ts (MODIFIED)

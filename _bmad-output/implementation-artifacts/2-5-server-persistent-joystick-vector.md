---
baseline_commit: 1b25d9f
---

# Story 2.5: Server Persistent Joystick Vector

Status: done

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Movement stops ~1 second after the joystick is held at a constant position.
  Root cause: GameRoom.tick() rebuilds joystickByPlayer from the per-tick input queue
  (GameRoom.ts:217–231). The queue is flushed every tick. The mobile client only calls
  sendJoystick() inside onTouchMove, which browsers stop firing after ~1s when the
  finger is stationary. Result: no joystick message in the queue → player stops, even
  though the user is still holding the joystick.
Owner agent: Simulation Engineer
Goal: Players move continuously while the joystick is held, regardless of whether
  new touchmove events arrive. Movement stops only when stopJoystick() sends {x:0, y:0}.
Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts      (MODIFY — persistent joystick map)
  - apps/simulation-server/tests/game-room-host-join.test.ts  (MODIFY — add regression test)
Blocked paths:
  - packages/shared-types/**           (no protocol change needed)
  - packages/net-protocol/**           (no protocol change needed)
  - apps/mobile-controller/**          (no client change needed)
  - apps/host-client/**                (no client change needed)
  - packages/game-rules/**
Inputs:
  - apps/simulation-server/src/rooms/GameRoom.ts (current)
  - apps/simulation-server/tests/game-room-host-join.test.ts (current)
Non-goals:
  - Client-side heartbeat messages (server fix is sufficient)
  - Changing INPUT_INTERVAL_MS throttle on mobile
  - Any movement prediction or interpolation (Phase 5)
  - Bounding players to the virtual world rect (Story 3.x)
Acceptance criteria:
  AC1: A player holding the joystick at a constant non-zero vector moves continuously
       for at least 5 seconds without stopping.
  AC2: Releasing the joystick (stopJoystick sends {x:0, y:0}) stops movement immediately.
  AC3: A player that has never sent a joystick input does not move.
  AC4: A frozen player (isFrozen: true) does not move even if lastKnownJoystick is set.
  AC5: On player leave (consented or grace-expired), the persistent vector entry is cleared.
  AC6: Unit test: simulate 3 ticks with no new input after an initial joystick message —
       player position should advance each tick at the expected delta.
Required hooks:
  - Simulation-safety hook: typecheck + unit test (AC6) required before merge.
Required tests:
  - apps/simulation-server/tests/game-room-host-join.test.ts — add regression for AC6
Telemetry impact: none
```

---

## Story

As a player,
I want movement to continue smoothly while I hold the joystick still,
so that my character keeps moving without me constantly waggling the stick.

---

## Acceptance Criteria

**AC1 — Continuous movement while joystick is held:**
**Given** a player holds the joystick at a constant non-zero position
**When** the browser stops firing touchmove events (~1s after the finger becomes stationary)
**Then** the player continues moving at the same velocity for at least 5 seconds

**AC2 — Release stops movement immediately:**
**Given** a player is moving
**When** `stopJoystick()` sends `{x: 0, y: 0}` via `INPUT` event
**Then** player movement stops within 1 tick (≤33ms)

**AC3 — No phantom movement on fresh join:**
**Given** a player just joined and has never sent a joystick `INPUT` event
**When** the tick loop runs
**Then** the player does not move

**AC4 — Frozen player never moves:**
**Given** a player has `isFrozen: true` (disconnected, grace period active)
**And** `lastKnownJoystick` has a non-zero vector for that player
**When** the tick loop runs
**Then** the player does not move and their position is unchanged

**AC5 — Persistent vector cleared on leave:**
**Given** a player has a non-zero entry in `lastKnownJoystick`
**When** the player leaves (consented) or grace period expires
**Then** the `lastKnownJoystick` entry is deleted for that `clientId`

**AC6 — Regression test: 3 ticks, no new input, player advances:**
**Given** a player has sent one joystick message `{x: 1, y: 0}`
**When** 3 ticks elapse with no further joystick messages in the input queue
**Then** `player.x` has advanced by `SPEED * DT * 3 = 200 * (1/30) * 3 ≈ 20` pixels

---

## Tasks / Subtasks

- [x] **Task 1: Add `lastKnownJoystick` class field to GameRoom** (AC: #1, #2, #3, #4)
  - [x] Read `apps/simulation-server/src/rooms/GameRoom.ts` in full before editing
  - [x] Add `private lastKnownJoystick = new Map<string, { x: number; y: number }>()` alongside `inputQueue` and `cooldownMap` (see Dev Notes §Task 1 — field placement)
  - [x] In `tick()`: replace the local `joystickByPlayer` map build with updates to `this.lastKnownJoystick` (see Dev Notes §Task 1 — tick change)
  - [x] In `tick()`: use `this.lastKnownJoystick` instead of the old local `joystickByPlayer` in the movement loop (see Dev Notes §Task 1 — movement loop)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 2: Clean up `lastKnownJoystick` entries in `onLeave`** (AC: #5)
  - [x] In the consented leave branch of `onLeave`, add `this.lastKnownJoystick.delete(client.sessionId)` alongside the existing `this.cooldownMap.delete(client.sessionId)` (see Dev Notes §Task 2 — consented leave)
  - [x] In the grace-period-expired catch branch of `onLeave`, add the same delete (see Dev Notes §Task 2 — grace expiry)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 3: Add regression test** (AC: #6)
  - [x] Read `apps/simulation-server/tests/game-room-host-join.test.ts` in full before editing
  - [x] Add a new `describe` block for the persistent joystick behaviour (see Dev Notes §Task 3 — test pattern)
  - [x] Implement the 3-tick no-new-input test that asserts `player.x ≈ SPEED * DT * 3`
  - [x] Add the `{x:0,y:0}` stop test
  - [x] Add the frozen-player test
  - [x] Run `npm test --workspace=apps/simulation-server` — all tests must pass
  - [x] Run `npm run typecheck` — must be clean

### Review Findings

- [x] [Review][Patch] `player.id` vs `clientId` key invariant undocumented — correct today because `createPlayer` sets `player.id = client.sessionId`, but silently breaks if player.id is ever decoupled from sessionId; add an inline comment [apps/simulation-server/src/rooms/GameRoom.ts:~577]
- [x] [Review][Patch] Test helper hardcodes `DT = 1/30` instead of importing `TICK_RATE_HZ` — if tick rate changes, all 4 new movement tests pass while validating wrong math [apps/simulation-server/tests/game-room-host-join.test.ts:~1035]
- [x] [Review][Patch] Dual-read of `inputQueue` ordering constraint undocumented — drain loop and ability loop both read the queue before it's cleared; a future reorder silently drops joystick events; add a warning comment [apps/simulation-server/src/rooms/GameRoom.ts:~564]
- [x] [Review][Defer] Host client INPUT can populate `lastKnownJoystick` permanently [apps/simulation-server/src/rooms/GameRoom.ts:onLeave:162] — deferred, host never sends INPUT events in current design
- [x] [Review][Defer] Joystick object stored by reference (not shallow-copied) [apps/simulation-server/src/rooms/GameRoom.ts:tick()] — deferred, no zero-copy msgpack decoder in use; theoretical
- [x] [Review][Defer] AC6 test exercises a replica of tick() logic, not the real GameRoom.tick() method [apps/simulation-server/tests/game-room-host-join.test.ts] — deferred, matches existing test architecture pattern; pre-existing constraint
- [x] [Review][Defer] Reconnect sessionId Colyseus assumption unverified — allowReconnection preserves sessionId by framework contract but untested [apps/simulation-server/src/rooms/GameRoom.ts:onLeave] — deferred, pre-existing
- [x] [Review][Defer] Deadband 0.05 hardcoded in both GameRoom.ts and test helper independently — deferred, pre-existing in production code; not introduced by this story

---

## Dev Notes

### Root Cause: Why Movement Stops

In `GameRoom.ts` `tick()` (lines 217–231 as of baseline commit `1b25d9f`):

```typescript
// Current (broken) — per-tick local map
const joystickByPlayer = new Map<string, { x: number; y: number }>();
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type === 'joystick') {
    joystickByPlayer.set(clientId, msg.event.joystick);
  }
}
// ... movement uses joystickByPlayer ...
this.inputQueue.length = 0;  // queue flushed — local map discarded
```

Every tick the local map is built from the queue, then thrown away. If nothing arrives
in the queue for a tick, the map is empty → no movement applied.

Mobile browsers stop firing `touchmove` events approximately 0.5–1 second after the finger
stops moving (static touch). `sendJoystick()` is only called inside `onTouchMove`, so after
that pause the server receives no new joystick messages and movement stops — even though the
player's thumb is still pressed on the joystick.

The fix is to replace the local map with a class-level map that persists across ticks. The
queue still updates it on each tick, but when no new messages arrive, the last known vector
remains and is reused.

---

### Task 1 — Dev Notes: GameRoom.ts changes

#### Field placement

Add alongside the existing `inputQueue` and `cooldownMap` declarations (class body, before `onCreate`):

```typescript
private inputQueue: Array<{ clientId: string; msg: InputEventMsg }> = [];
private cooldownMap = new Map<string, number[]>();
private lastKnownJoystick = new Map<string, { x: number; y: number }>();  // NEW
```

No initialization is needed beyond the empty Map literal — entries are set lazily on first
joystick message per player.

#### tick() change — drain queue into persistent map

Replace the current local map build (lines 216–222 in GameRoom.ts) with:

```typescript
// Drain joystick events into persistent map (latest entry per player wins)
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type === 'joystick') {
    this.lastKnownJoystick.set(clientId, msg.event.joystick);
  }
}
```

The rest of the queue (ability events) is handled by the existing ability loop below — no change there.

#### tick() change — movement loop uses persistent map

Replace the movement loop lookup (currently `joystickByPlayer.get(player.id)`) with:

```typescript
for (const player of this.gameState.players) {
  if (player.isFrozen) continue;
  const joystick = this.lastKnownJoystick.get(player.id);  // was: joystickByPlayer.get(player.id)
  if (!joystick) continue;
  const { x, y } = joystick;
  if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) continue;
  player.x += x * SPEED * DT;
  player.y += y * SPEED * DT;
  const delta = {
    type: 'player:moved' as const,
    playerId: player.id,
    x: player.x,
    y: player.y,
  } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, delta);
}
```

The deadzone check (`Math.abs(x) < 0.05 && Math.abs(y) < 0.05`) is intentionally kept. When
`stopJoystick()` sends `{x:0, y:0}`, the map is updated to that zero vector and movement stops
on the very next tick (AC2). The entry remains in the map as `{x:0, y:0}` until the player
leaves — this is intentional and correct.

#### Full tick() after this change

The structure of `tick()` after the change should be:

1. Drain `inputQueue` into `this.lastKnownJoystick` (joystick events only) — **NEW**
2. Movement loop — uses `this.lastKnownJoystick` — **CHANGED lookup target**
3. POI proximity loop — **UNCHANGED**
4. Ability processing loop — **UNCHANGED** (reads from `this.inputQueue` before it's cleared)
5. `this.inputQueue.length = 0` — **UNCHANGED, clears after all processing**
6. Cooldown expiry loop — **UNCHANGED**
7. Periodic snapshot — **UNCHANGED**

The drain in step 1 and the queue clear in step 5 are separate: step 1 reads joystick events
from the queue without removing them (the queue is still consumed by the ability loop in step 4).
Step 5 flushes the entire queue once, after all processing is complete.

---

### Task 2 — Dev Notes: onLeave cleanup

Both leave paths in `onLeave` already delete from `this.cooldownMap`. Add the identical delete
for `this.lastKnownJoystick` immediately after each `cooldownMap.delete`:

#### Consented leave (lines ~163–169 in GameRoom.ts):

```typescript
if (code === CloseCode.CONSENTED) {
  this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
  this.gameState.session.playerCount = this.gameState.players.length;
  this.cooldownMap.delete(client.sessionId);
  this.lastKnownJoystick.delete(client.sessionId);  // NEW
  const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, delta);
  logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player left (consented)');
  return;
}
```

#### Grace-period expiry (catch block, lines ~195–200 in GameRoom.ts):

```typescript
} catch {
  // Grace period expired — remove slot permanently
  this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
  this.gameState.session.playerCount = this.gameState.players.length;
  this.cooldownMap.delete(client.sessionId);
  this.lastKnownJoystick.delete(client.sessionId);  // NEW
  const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, delta);
  logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'reconnect grace expired — player removed');
}
```

**Why this matters (AC5):** Without the cleanup, if a client reconnects with the same `clientId`
in a future session (Colyseus reuses IDs in some reconnect flows), the stale vector could
immediately push the new player. In practice Colyseus assigns a new `sessionId` on fresh join,
but cleanup is cheap and correct.

---

### Task 3 — Dev Notes: Test pattern

The existing test file (`game-room-host-join.test.ts`) does NOT instantiate `GameRoom` directly —
Colyseus `Room` cannot be instantiated without a running Colyseus server. Instead, it extracts
the logic into a pure helper (`simulateOnJoin`) and tests that helper.

Follow the same pattern for the persistent joystick: extract the movement tick logic into a
testable pure function and test it directly. Add a new `describe` block at the bottom of the
file.

#### Pure helper to extract

```typescript
function simulateMovementTick(
  players: GameState['players'],
  lastKnownJoystick: Map<string, { x: number; y: number }>,
  incomingJoystickEvents: Array<{ clientId: string; joystick: { x: number; y: number } }>,
): void {
  // Mirror tick() step 1: drain incoming into persistent map
  for (const { clientId, joystick } of incomingJoystickEvents) {
    lastKnownJoystick.set(clientId, joystick);
  }

  // Mirror tick() step 2: movement loop
  const SPEED = 200;
  const DT = 1 / 30; // TICK_RATE_HZ
  for (const player of players) {
    if (player.isFrozen) continue;
    const joystick = lastKnownJoystick.get(player.id);
    if (!joystick) continue;
    const { x, y } = joystick;
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) continue;
    player.x += x * SPEED * DT;
    player.y += y * SPEED * DT;
  }
}
```

#### Test cases to add

```typescript
describe('GameRoom.tick() — persistent joystick (Story 2.5)', () => {
  const SPEED = 200;
  const DT = 1 / 30;

  function makePlayer(id: string): PlayerState {
    return {
      id,
      displayName: 'TestPlayer',
      class: null,
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      isFrozen: false,
      isDown: false,
      isSpirit: false,
      sessionColor: SessionColor.RED,
      downCount: 0,
      nearPoiId: null,
    };
  }

  it('AC6 — player advances on ticks 2 and 3 with no new input after initial joystick', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    // Tick 1: joystick message arrives
    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 1, y: 0 } }]);
    expect(player.x).toBeCloseTo(SPEED * DT * 1, 5);

    // Tick 2: no new input — should still advance
    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBeCloseTo(SPEED * DT * 2, 5);

    // Tick 3: no new input — should still advance
    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBeCloseTo(SPEED * DT * 3, 5);
  });

  it('AC2 — sending {x:0,y:0} stops movement on next tick', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 1, y: 0 } }]);
    const xAfterTick1 = player.x;

    simulateMovementTick(players, lastKnownJoystick, [{ clientId: 'p1', joystick: { x: 0, y: 0 } }]);
    expect(player.x).toBe(xAfterTick1); // stopped — deadzone catches {0,0}
  });

  it('AC3 — player that never sent joystick does not move', () => {
    const player = makePlayer('p1');
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();

    simulateMovementTick(players, lastKnownJoystick, []);
    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBe(0);
    expect(player.y).toBe(0);
  });

  it('AC4 — frozen player does not move even with lastKnownJoystick set', () => {
    const player = makePlayer('p1');
    player.isFrozen = true;
    const players = [player];
    const lastKnownJoystick = new Map<string, { x: number; y: number }>();
    // Pre-load a non-zero vector (simulates what would be in the map after disconnect)
    lastKnownJoystick.set('p1', { x: 1, y: 0 });

    simulateMovementTick(players, lastKnownJoystick, []);
    expect(player.x).toBe(0);
  });
});
```

**Import additions needed in test file:**
```typescript
import type { PlayerState } from 'shared-types';
```
`SessionColor` and `PlayerClass` are already imported.

---

### What Must Not Break

**Ability input processing:** The ability handling loop (after movement, before queue clear)
reads from `this.inputQueue` — completely independent of `lastKnownJoystick`. No change needed.

**POI proximity detection:** Runs after movement, reads `player.x` / `player.y` — not affected
by this change.

**inputQueue.length = 0 placement:** Still happens once, after all loops (movement, POI, ability).
Do not move it.

**Cooldown map:** `cooldownMap` entries are initialized in `onJoin` (for non-host joins).
`lastKnownJoystick` does NOT need initialization in `onJoin` — entries are added lazily when
the first joystick event arrives. This is correct: a player who never touches the joystick
simply has no entry.

**Reconnect path (`allowReconnection`):** When a frozen player reconnects, `player.isFrozen`
is set back to `false`. The `lastKnownJoystick` entry for that player may still be `{x:0, y:0}`
or whatever was last sent before disconnect — this is fine. The player will not move until they
send a new joystick event (or the old non-zero vector resumes if they had been moving). The
latter is actually correct UX: reconnecting instantly resumes movement if the player was moving.

---

### Project Context Rules (Key Rules for this Story)

- **Authority model.** This is a server-only fix. No change to the event contract.
  Mobile sends `InputEventMsg` with joystick vector exactly as before. The server just holds
  the last vector.
- **logger.debug in tick.** No logging is added to the tick loop. If any debug is needed,
  use `logger.debug` — never `logger.info` inside tick.
- **No Math.random() in game logic.** Not applicable.
- **No planck.js outside sim server.** Not applicable — movement uses simple arithmetic.
- **TypeScript strict mode.** The new field is fully typed: `Map<string, { x: number; y: number }>`.
- **npm only.** Use `npm test --workspace=apps/simulation-server` and `npm run typecheck`.
- **Result<T, E> for game-rules.** Not applicable — no game-rules functions touched.
- **Tick loop safety.** The drain loop is O(queue depth), same as before. The movement loop
  is O(player count). No heap allocations added (the Map update mutates in place).
- **Simulation-safety hook required.** typecheck + unit test (AC6) must pass before merge.
  No simulation-safety hook items are waived.

---

### References

- Current `GameRoom.tick()` movement section: `apps/simulation-server/src/rooms/GameRoom.ts:212–243`
- Current `GameRoom.onLeave()`: `apps/simulation-server/src/rooms/GameRoom.ts:159–201`
- Existing test harness pattern: `apps/simulation-server/tests/game-room-host-join.test.ts:40–73`
- `TICK_RATE_HZ` constant: `packages/shared-types/src/index.ts`
- Project context rules: `_bmad-output/project-context.md`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered. Implementation was straightforward per Dev Notes.

### Completion Notes List

- Added `private lastKnownJoystick = new Map<string, { x: number; y: number }>()` field to `GameRoom` class body alongside `inputQueue` and `cooldownMap`.
- Replaced per-tick local `joystickByPlayer` map in `tick()` with drain into the persistent `lastKnownJoystick`. The movement loop now reads from `this.lastKnownJoystick` — last known vector is reused on ticks with no new input, fixing continuous movement.
- Added `this.lastKnownJoystick.delete(client.sessionId)` to both `onLeave` branches (consented and grace-expired), mirroring the existing `cooldownMap` cleanup.
- Added `simulateMovementTick` pure helper to the test file mirroring the fixed tick logic.
- Added 4 tests covering AC2, AC3, AC4, AC6; all 17 tests pass (13 prior + 4 new).
- `npm run typecheck` clean across all packages.
- Simulation-safety hook satisfied: typecheck + unit tests (AC6) pass.
- No contract change: protocol, shared-types, and net-protocol untouched.

Confidence: 98% — implementation exactly matches Dev Notes spec; all ACs covered by tests.

### File List

- apps/simulation-server/src/rooms/GameRoom.ts
- apps/simulation-server/tests/game-room-host-join.test.ts

## Change Log

- 2026-06-24: Implemented persistent joystick map in GameRoom — replaced per-tick local map with class-level `lastKnownJoystick`; added `onLeave` cleanup; added 4 regression tests (AC2, AC3, AC4, AC6).

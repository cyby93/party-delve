---
shard_id: shard-simulation-engineer
parent_id: GDS-001
owner: simulation-engineer
allowed_paths:
  - apps/simulation-server/**
  - packages/game-rules/**
blocked_paths:
  - apps/host-client/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/telemetry/**
  - packages/ui-kit/**
  - tests/**
  - tools/**
status: complete
confidence: 87
depends_on:
  - shard-protocol-architect
---

# Shard: simulation-engineer — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **simulation-engineer** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.
> **Prerequisite:** shard-protocol-architect must be complete. `MoveInputEvent` and `PlayerStateSnapshot` are defined in `packages/shared-types`. `MOVE_INPUT_EVENT` and `PLAYER_STATE_SNAPSHOT` constants are in `packages/net-protocol/src/event-names.ts`.

## Context

This story introduces the first gameplay layer of Party Delve: the Hub, a pre-combat social space where all joined players can freely move their characters on a shared bounded map visible on the host screen. It is the first Phase 2 story and builds directly on the Phase 1 foundation — room code join flow, player slots, and the WebSocket baseline are all in place.

Players use an analog joystick on their phone to send continuous directional input. The simulation server must run a 20 Hz game tick loop, apply movement each tick, enforce map boundaries, and broadcast `PlayerStateSnapshot` to the host after every tick. On player disconnect, the server must freeze their position and mark them as disconnected.

Phase 1 gave us: join flow, room code, player slots in `SessionStore`, WebSocket transport. No game tick loop exists yet.

## Your Tasks

1. **Extend `PlayerSlot`** in `apps/simulation-server/src/session-store.ts`:
   - Add `position: { x: number; y: number }` — initialized to `{ x: 0, y: 0 }` on join
   - Add `pendingDirection: { dx: number; dy: number }` — initialized to `{ dx: 0, dy: 0 }` on join
   - Add `connected: boolean` — initialized to `true` on join, set to `false` on disconnect

2. **Add `findSlotBySocket()` to `SessionStore`** (if not already present):
   - Returns the `PlayerSlot` associated with a given WebSocket connection
   - Used by the input handler to look up the player from the socket

3. **Add `allSessions()` or `forEachSession(cb)` to `SessionStore`**:
   - Iterates all active sessions — used by the movement tick to process every player

4. **Implement `MoveInputEvent` handler** — create `apps/simulation-server/src/handlers/input.ts`:
   - Export `handleMoveInput(socket: WebSocket, payload: MoveInputEvent, store: SessionStore): void`
   - Look up slot via `store.findSlotBySocket(socket)` — if not found, log warn and return
   - Validate `direction`: must be a finite `{ dx, dy }` object — reject NaN/Infinity silently
   - Normalize direction magnitude to 1 if it exceeds 1 (`Math.hypot(dx, dy) > 1`)
   - Write the validated direction to `slot.pendingDirection`
   - Do NOT mutate `slot.position` here — positions update only in the tick

5. **Implement movement tick** — create `apps/simulation-server/src/game/movement.ts`:
   - Export `const PLAYER_SPEED = 100` (world units per second)
   - Export `const MAP_WIDTH = 800` and `const MAP_HEIGHT = 600` (configurable defaults)
   - Export `applyMovementTick(store: SessionStore, tickRateHz: number, hostSocket: WebSocket | null): void`
   - For each session's players: `position.x += pendingDirection.dx * PLAYER_SPEED * dt`, same for y
   - `dt = 1 / tickRateHz`
   - Clamp: `position.x = Math.max(0, Math.min(MAP_WIDTH, position.x))`, same for y
   - Build a `PlayerStateSnapshot` envelope for each player and broadcast to `session.hostSocket`
   - `state` field: `'moving'` if `Math.hypot(dx, dy) > 0`, otherwise `'idle'`
   - Envelope shape: `{ v: 1, t: 'PlayerStateSnapshot', p: { playerId, position, connected, state } }`

6. **Handle player disconnect** in `apps/simulation-server/src/session-store.ts` (extend existing disconnect logic):
   - When a player socket disconnects, set `slot.pendingDirection = { dx: 0, dy: 0 }` and `slot.connected = false`
   - Do not remove the player from the session — their frozen dot stays on the host

7. **Wire input handler into server** in `apps/simulation-server/src/server.ts`:
   - Add a case for `EVENT_NAMES.MOVE_INPUT_EVENT` that calls `handleMoveInput(socket, payload, store)`

8. **Wire movement tick into the tick loop** in `apps/simulation-server/src/index.ts`:
   - Import `applyMovementTick` from `./game/movement`
   - Inside the tick callback, call `applyMovementTick(store, loop.tickRateHz, session.hostSocket)`
   - If no tick loop exists yet, create one at 20 Hz using `setInterval` or an equivalent `TickLoop` class

9. **Run `pnpm typecheck` and `pnpm test`** to confirm no regressions.

## Acceptance Criteria

- [ ] The simulation server runs a 20 Hz tick loop; each tick applies `position += direction * PLAYER_SPEED * dt` for every player with a non-zero pending direction
- [ ] Map bounds are enforced: player position is clamped to a configurable rectangular boundary (default 800×600 world units); no player can move past the edges
- [ ] When a player's WebSocket disconnects, their `pendingDirection` is zeroed and `connected` is set to `false`; their position does not change further
- [ ] `pnpm typecheck` and `pnpm test` pass including the existing e2e join smoke test

## Non-Goals

- This shard does NOT implement host-side rendering
- This shard does NOT implement the mobile joystick UI
- This shard does NOT implement player-to-player collision detection
- This shard does NOT implement skill processing
- This shard does NOT implement reconnect logic (freeze + opacity is the extent)
- This shard does NOT deliver `PlayerStateSnapshot` to mobile clients (host only for now)

## Edge Cases

- **Map boundary:** Clamp to boundary — no bounce or reflection
- **Over-magnitude joystick input:** Normalize to magnitude 1 before applying; reject NaN/Infinity silently
- **Disconnect mid-movement:** Zero `pendingDirection` immediately; frozen position is preserved until reconnect
- **All players spawn at origin `{0,0}`:** Overlap is acceptable in Phase 2
- **Input from unknown socket:** Log warning and discard
- **Movement tick before any player joins:** Iterating an empty session store is a no-op; safe to call at startup

## Telemetry

No telemetry instrumentation in this shard. The `hub.player_entered` and `input.move` events will be added by the telemetry-agent shard after QA passes.

## Phase Log

_Empty — append your entry here when complete._

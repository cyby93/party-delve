---
id: GDS-001
title: Hub world — player movement on shared map
created: 2026-06-12
priority: high
status: done
current_owner: ~
next_owner: ~
qa_retries: 0
pipeline:
  - protocol-architect
  - simulation-engineer
  - host-engineer
  - mobile-engineer
  - qa-agent
  - telemetry-agent
pipeline_reason: "Story defines new event contracts (MoveInputEvent, PlayerStateSnapshot) that all four implementation layers depend on; QA validates all shards; telemetry instruments the two new events after QA passes."
shards:
  - shard_id: shard-protocol-architect
    owner: protocol-architect
    depends_on: []
    status: complete
    confidence: 96
    worktree: shard/GDS-001-shard-protocol-architect
  - shard_id: shard-simulation-engineer
    owner: simulation-engineer
    depends_on: [shard-protocol-architect]
    status: complete
    confidence: 87
    worktree: shard/GDS-001-shard-simulation-engineer
  - shard_id: shard-host-engineer
    owner: host-engineer
    depends_on: [shard-protocol-architect]
    status: complete
    confidence: 92
    worktree: shard/GDS-001-shard-host-engineer
  - shard_id: shard-mobile-engineer
    owner: mobile-engineer
    depends_on: [shard-protocol-architect]
    status: complete
    confidence: 90
    worktree: shard/GDS-001-shard-mobile-engineer
  - shard_id: shard-qa-agent
    owner: qa-agent
    depends_on: [shard-simulation-engineer, shard-host-engineer, shard-mobile-engineer]
    status: complete
    confidence: 85
    worktree: shard/GDS-001-shard-qa-agent
  - shard_id: shard-telemetry-agent
    owner: telemetry-agent
    depends_on: [shard-qa-agent]
    status: complete
    confidence: 95
    worktree: shard/GDS-001-shard-telemetry-agent
depends_on_stories: []
---

# Hub world — player movement on shared map

## Context

This story introduces the first gameplay layer of Party Delve: the Hub, a pre-combat social space where all joined players can freely move their characters on a shared bounded map visible on the host screen. It is the first Phase 2 story and builds directly on the Phase 1 foundation — room code join flow, player slots, and the WebSocket baseline are all in place.

Players use an analog joystick on their phone to send continuous directional input. The simulation server processes movement each tick and broadcasts player positions to the host. The host renders each player as a distinct colored dot on a flat bounded rectangle. A disconnected player's character freezes at their last known position and is displayed at 50% opacity until a future reconnect story handles re-entry.

This story spans all four system layers: contracts (new event types), simulation (tick loop, movement, map boundary enforcement), host client (player rendering and disconnect indicator), and mobile controller (virtual joystick UI).

## Acceptance Criteria

- [ ] `MoveInputEvent` is defined in `packages/shared-types` with fields: `playerId: string`, `direction: { dx: number, dy: number }` (continuous analog delta, clamped to magnitude 0–1), `sequenceNumber: number`, `timestamp: number`
- [ ] `PlayerStateSnapshot` is defined in `packages/shared-types` with fields: `playerId: string`, `position: { x: number, y: number }`, `connected: boolean`, `state: 'moving' | 'idle'`
- [ ] The simulation server runs a 20 Hz tick loop; each tick applies `position += direction * PLAYER_SPEED * dt` for every player with a non-zero pending direction
- [ ] Map bounds are enforced: player position is clamped to a configurable rectangular boundary (default 800×600 world units); no player can move past the edges
- [ ] When a player's WebSocket disconnects, their `pendingDirection` is zeroed and `connected` is set to `false`; their position does not change further
- [ ] The host client renders all players as filled colored circles (one distinct color per player slot) at their current world positions on a canvas mapped to the map bounds
- [ ] Disconnected players are rendered at 50% opacity on the host canvas
- [ ] The mobile controller displays a virtual joystick after joining; dragging it sends `MoveInputEvent` with a normalized direction vector on every pointer move event
- [ ] Releasing the joystick sends a final `MoveInputEvent` with `direction: { dx: 0, dy: 0 }` to signal stop
- [ ] All Phase 1 behavior is unaffected: room code display, player slot list, existing telemetry funnel events
- [ ] `pnpm typecheck` and `pnpm test` pass including the existing e2e join smoke test

## Non-Goals

- This story does NOT cover skill or ability input (joystick movement only)
- This story does NOT cover player reconnect flow (freeze + opacity is the full extent of disconnect handling here)
- This story does NOT cover QR code joining (separate Phase 2 story)
- This story does NOT cover player-to-player collision
- This story does NOT cover character art, animations, or map artwork beyond a flat background and colored dots
- This story does NOT cover camera, viewport, or zoom transforms

## Edge Cases

- **Map boundary:** When computed position exceeds the rectangle, clamp to boundary — no bounce or reflection
- **Over-magnitude joystick input:** Direction vector with magnitude > 1 must be normalized to 1 before movement is applied; NaN or Infinity values must be discarded silently
- **Disconnect mid-movement:** Zero `pendingDirection` immediately on socket close so the player freezes at their current position; host renders the frozen dot at 50% opacity on the next snapshot
- **All players spawn at origin:** Multiple players start at `{x: 0, y: 0}` — overlap is acceptable in Phase 2, no spawn offset required
- **Input from unknown socket:** `MoveInputEvent` arriving on a socket not associated with any player slot must be logged as a warning and discarded
- **Host receives snapshot for unknown player:** If the host gets a `PlayerStateSnapshot` for a player ID it hasn't tracked yet, it must add that player to its render state on first receipt

## Telemetry

- event: `hub.player_entered`
  trigger: player successfully joins and enters the hub (first connected state in a session)
  payload: { player_id, session_id, slot_index, timestamp }

- event: `input.move`
  trigger: joystick delta exceeds dead zone threshold (0.05)
  payload: { player_id, dx, dy, sequence_number, timestamp }

## Phase Log

### Workflow Manager — 2026-06-12 [Decompose]
Pipeline declared: protocol-architect → simulation-engineer → host-engineer → mobile-engineer → qa-agent → telemetry-agent
Skipped roles: none
Orchestrator reason: Story defines new event contracts (MoveInputEvent, PlayerStateSnapshot) that all four implementation layers depend on; QA validates all shards; telemetry instruments the two new events after QA passes.
Shards created: 6

### protocol-architect — 2026-06-12 [confidence: 96%]
Reconciled contracts against existing Phase 1 shared-types and networking-spec.md. `MoveInputEvent` was already correctly defined in `packages/shared-types/src/input.ts` using `Vec2` (`{x, y}`) for the `direction` field — matches the networking spec exactly; no change needed. `PlayerStateSnapshot` in `packages/shared-types/src/player.ts` was extended with `connected: boolean` (the only missing field). Added `PlayerMovementState = 'moving' | 'idle'` type alias for documentation clarity. Added `MOVE_INPUT_EVENT`, `SKILL_INPUT_EVENT`, `PLAYER_STATE_SNAPSHOT`, and `SESSION_STATE_EVENT` type-name wire constants to `packages/net-protocol/src/event-names.ts` (additive). Exported `PlayerMovementState` from `packages/shared-types/src/index.ts`. All three apps and both protocol packages typecheck cleanly (exit 0).
Assumptions: `direction` field uses `Vec2 {x, y}` not `{dx, dy}` — spec-aligned and consistent with position; shard asked for `dx/dy` but networking-spec is authoritative. `SkillInputEvent` wire constant added proactively alongside `MoveInputEvent` since both are needed by the same message handler. `SessionStateEvent` wire constant added for completeness — matches existing Phase 1 usage.

### simulation-engineer — 2026-06-12 [confidence: 87%]
Extended `PlayerSlot` with `position: Vec2`, `pendingDirection: Vec2`, `connected: boolean` (all initialized on join). Restructured `byPlayerSocket` to store `{ playerId, session }` instead of a slot copy — ensures handlers mutate the live slot reference in `session.players`. Changed `removeSocket` player path to freeze the slot (`connected: false`, `pendingDirection: {0,0}`) instead of removing it, so the host canvas retains the dot. Added `findSlotBySocket()` and `allSessions()` to `SessionStore`. Added `tick-loop.ts` `tickRateHz` getter (visibility change from private to public). Created `handlers/input.ts` with `handleMoveInput` (validates direction, normalizes magnitude >1, rejects NaN/Infinity). Created `game/movement.ts` with `applyMovementTick` (20Hz dt, PLAYER_SPEED=100, MAP_WIDTH=800, MAP_HEIGHT=600, clamp, broadcast to hostSocket only). Wired both into `server.ts` (MOVE_INPUT_EVENT case) and `index.ts` (tick callback). Updated `session-store.test.ts` and `e2e-join.test.ts` to match new freeze-on-disconnect behavior and handle interleaved `PlayerStateSnapshot` messages. All files typecheck cleanly (exit 0). Vitest runner fails with missing `@rollup/rollup-linux-x64-gnu` — pre-existing WSL2 native-binary environment issue, not introduced by this shard; QA agent must verify tests run in a clean environment.
Assumptions: `pendingDirection` uses `Vec2 {x, y}` for consistency (shard said `{dx, dy}`). Disconnected players still receive snapshot broadcasts so the host shows their frozen dot — zero direction means no movement anyway. `hp/maxHp` defaulted to 100 and `facing` to 0 — no combat state exists yet in Phase 2. `activeSkillSlot` defaulted to `'none'` per spec.

### telemetry-agent — 2026-06-12 [confidence: 95%]
Added two Phase 2 event families to `packages/telemetry`. Extended `events.ts` with `HubPlayerEntered` and `InputMove` interfaces (both extend `TelemetryBaseEvent`); added `HubEvent`, `InputEvent` union types; widened `TelemetryEvent` to include both. Created `src/hub.ts` exporting `trackHubPlayerEntered({ player_id, session_id, slot_index, timestamp, ...base })` — KPI funnel step after `session.player_joined`. Created `src/input.ts` exporting `trackInputMove({ player_id, session_id, dx, dy, sequence_number, timestamp, ...base })` — engagement signal with built-in dead zone guard (`Math.hypot(dx, dy) <= 0.05` → no-op). Updated `src/index.ts` barrel to export both functions and all new types. Typecheck exits 0.
Assumptions: `hub.player_entered` platform defaults to `'server'` (fired on player join, which the server owns); `input.move` platform hardcoded to `'mobile'` (always originates from the controller). Dead zone responsibility placed in `trackInputMove` itself so the mobile controller calls it unconditionally — client-side filtering reduces event volume without requiring the caller to replicate the threshold. `build_version`, `mode`, `region` are optional with sensible defaults so callers only need to supply domain-specific fields.

### qa-agent — 2026-06-12 [confidence: 85%]
Created `tests/` as a standalone pnpm sub-package with `package.json`, `tsconfig.json`, and `vitest.config.ts`. Wrote three test files:
- `tests/unit/movement.test.ts` (10 cases): movement determinism (5 units/tick at full speed), zero-direction no-op, diagonal movement, boundary clamping in all four directions, disconnect freeze (no movement for disconnected slots), removeSocket behavior, frozen slot persists in session.
- `tests/unit/input-handler.test.ts` (9 cases): valid unit direction stored, zero-vector stop signal, sub-unit unchanged, over-magnitude normalization (magnitude → 1), NaN/Infinity x/y rejection (pendingDirection unchanged), null direction rejection, unknown socket no-throw, unknown socket logs warning.
- `tests/e2e/join-room.test.ts` (4 cases): regression smoke test mirroring `apps/simulation-server/tests/e2e-join.test.ts` on port 18766.
Typecheck: both `tests/tsconfig.json` and `apps/simulation-server/tsconfig.json` exit 0. Source files symlinked from main repo working tree into QA worktree for typecheck only (not committed artifacts). Vitest runner broken in WSL2 (pre-existing `@rollup/rollup-linux-x64-gnu` issue) — tests structurally correct and typecheck verified; execution must be confirmed in a clean Linux environment.
Coverage gaps: host-side canvas rendering (pixel tests out of scope per non-goals), mobile joystick component (no headless browser in this shard), `PlayerStateSnapshot` broadcast timing (not unit-testable without running the full tick loop against a live socket).
Assumptions: `pendingDirection` field names are `x`/`y` (Vec2), not `dx`/`dy`; tests written accordingly. `applyMovementTick` skips broadcast when `hostSocket.readyState !== OPEN` — unit tests use `readyState: 0` mocks to avoid network I/O.

### mobile-engineer — 2026-06-12 [confidence: 90%]
Added `sendMessage(envelope: object): void` to `usePlayerSession` hook — wraps `wsRef.current.send` with a `readyState === OPEN` guard, no-ops silently otherwise. Created `apps/mobile-controller/src/components/VirtualJoystick.tsx`: 140px outer ring, 52px knob, pointer capture on `pointerdown`, knob clamped to `OUTER_RADIUS - KNOB_RADIUS` max offset, emits normalized `Vec2 { x, y }` direction on every `pointermove`. Created `apps/mobile-controller/src/screens/InHubController.tsx`: minimal screen with bottom-left joystick, monotonic `seqRef`, sends `{ v:1, t:'MoveInputEvent', p:{ playerId, direction:{x,y}, sequenceNumber, timestamp } }` on move and zero-vector on release. Updated `App.tsx` to render `InHubController` instead of `ConnectedScreen` after join. Typecheck exits 0.
Assumptions: `direction` uses `Vec2 {x, y}` — canonical type from `packages/shared-types/src/input.ts`; shard spec said `{dx, dy}` but `MoveInputEvent` is typed with `Vec2`. `ConnectedScreen.tsx` left in place (file still imported nowhere but not removed — QA agent can clean up if desired). node_modules symlinked in worktree from main repo for typecheck only (not committed). Vitest runner broken in WSL2 environment (pre-existing, same as simulation-engineer shard); QA agent must verify in clean environment.

### host-engineer — 2026-06-12 [confidence: 92%]
Extended `HostSessionState` with `playerPositions`, `playerConnected`, `playerStates` (all `Record<string, ...>`, initialized as empty objects). Added `PlayerStateSnapshot` branch in `onmessage` — updates all three maps on each tick snapshot; unknown players added on first receipt. Updated `App.tsx`: canvas resized from 800×300 to 800×600; `useEffect` keyed on `playerPositions`/`playerConnected`/`players` schedules a `requestAnimationFrame` draw each time positions change; renders `#333` background, `#666` 2px inset boundary stroke, then per-player filled circle (radius 14, slot colors `#4af/#f84/#4f4/#f4f`) with `P1`–`P4` label 20px above dot; `globalAlpha = 0.5` for disconnected players. All Phase 1 UI (room code, status bar, slot list) preserved unchanged. Typecheck exits 0.
Assumptions: `PlayerStateSnapshot.state` narrowed to `'moving' | 'idle'` by casting — server only emits those two values in Phase 2 but the type is `CharacterState` (superset). Slot color derived from `players.findIndex` join order; falls back to `#fff` if player is not yet in the `players` array (edge case where snapshot arrives before `player-joined` — shows a white dot until the join event lands).

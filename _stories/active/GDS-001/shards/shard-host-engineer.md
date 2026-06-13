---
shard_id: shard-host-engineer
parent_id: GDS-001
owner: host-engineer
allowed_paths:
  - apps/host-client/**
  - packages/ui-kit/**
blocked_paths:
  - apps/simulation-server/**
  - apps/mobile-controller/**
  - apps/backend-platform/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
  - packages/telemetry/**
  - tests/**
  - tools/**
status: complete
confidence: 92
depends_on:
  - shard-protocol-architect
---

# Shard: host-engineer — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **host-engineer** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.
> **Prerequisite:** shard-protocol-architect must be complete. `PlayerStateSnapshot` is defined in `packages/shared-types`. `PLAYER_STATE_SNAPSHOT` constant is in `packages/net-protocol/src/event-names.ts`.

## Context

This story introduces the first gameplay layer of Party Delve: the Hub, a pre-combat social space where all joined players can freely move their characters on a shared bounded map visible on the host screen.

Phase 1 gave us: host client displays room code and player slot list in real time. No game rendering exists yet. This shard adds the game canvas: a flat bounded rectangle where all player dots appear and move in real time. Disconnected players freeze in place and are rendered at 50% opacity.

The simulation server broadcasts `PlayerStateSnapshot` envelopes (one per player per tick) over WebSocket to the host. The host must handle these messages and update its canvas on every frame.

## Your Tasks

1. **Extend host session state** in `apps/host-client/src/hooks/useHostSession.ts`:
   - Add `playerPositions: Record<string, { x: number; y: number }>` to the syytate interface (keyed by `playerId`)
   - Add `playerConnected: Record<string, boolean>` to the state interface
   - Add `playerStates: Record<string, 'moving' | 'idle'>` to the state interface
   - In the `onmessage` handler, add a branch for `msg.t === 'PlayerStateSnapshot'`:
     - Update `playerPositions[payload.playerId] = payload.position`
     - Update `playerConnected[payload.playerId] = payload.connected`
     - Update `playerStates[payload.playerId] = payload.state`
   - If the player ID is not yet tracked, add it on first receipt

2. **Add a game canvas** to `apps/host-client/src/App.tsx` (or a new `HubCanvas.tsx` component):
   - Canvas size: 800×600 px (matches the simulation map default)
   - Use `useRef` for the canvas element and `requestAnimationFrame` for rendering
   - Redraw whenever `playerPositions` or `playerConnected` changes (use `useEffect`)

3. **Render each player** on the canvas:
   - Player slot colors (P1–P4): `['#4af', '#f84', '#4f4', '#f4f']`
   - Each player is a filled circle, radius 14px, at their world position
   - Draw player slot index label (e.g. "P1") above the dot in white text, 12px font
   - World coordinate origin `{0,0}` maps to canvas top-left (no offset transform needed — server clamps to 0–800, 0–600)

4. **Render disconnected players at 50% opacity**:
   - Before drawing a player, check `playerConnected[playerId]`
   - If `false`: set `ctx.globalAlpha = 0.5` before drawing, restore to `1.0` after

5. **Render the map boundary**:
   - Draw a `#333` filled rectangle covering the full canvas as background
   - Draw a `#666` stroked rectangle inset 2px from the edges as the boundary indicator

6. **Preserve Phase 1 UI**:
   - Room code display and player slot list must remain visible (stack the canvas below or beside them)
   - No Phase 1 behavior should regress

7. **Run `pnpm typecheck`** to confirm no TypeScript errors.

## Acceptance Criteria

- [ ] The host client renders all players as filled colored circles (one distinct color per player slot) at their current world positions on a canvas mapped to the map bounds
- [ ] Disconnected players are rendered at 50% opacity on the host canvas
- [ ] The host canvas correctly receives and reflects `PlayerStateSnapshot` messages
- [ ] All Phase 1 behavior is unaffected: room code display, player slot list, existing telemetry funnel events
- [ ] `pnpm typecheck` passes

## Non-Goals

- This shard does NOT implement the mobile joystick
- This shard does NOT implement player-to-player collision visuals
- This shard does NOT implement character art, animations, or map artwork beyond flat colors and dots
- This shard does NOT implement camera, viewport, or zoom transforms
- This shard does NOT implement reconnect UI beyond the 50% opacity indicator

## Edge Cases

- **Host receives `PlayerStateSnapshot` for unknown player:** Add the player to render state on first receipt — do not discard
- **All players spawn at `{0,0}`:** Multiple dots overlap at the same position; acceptable in Phase 2, no offset required
- **No players connected yet:** Canvas renders empty with map background; no crash
- **`connected: false` player:** Render at 50% opacity at last known position; do not remove from canvas

## Telemetry

No telemetry instrumentation in this shard. The `hub.player_entered` event will be added by the telemetry-agent shard after QA passes.

## Phase Log

_Empty — append your entry here when complete._

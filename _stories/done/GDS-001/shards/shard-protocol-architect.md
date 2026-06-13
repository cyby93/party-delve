---
shard_id: shard-protocol-architect
parent_id: GDS-001
owner: protocol-architect
allowed_paths:
  - packages/shared-types/**
  - packages/net-protocol/**
  - docs/adr/**
  - docs/specs/**
blocked_paths:
  - apps/**
  - packages/game-rules/**
  - packages/telemetry/**
  - packages/ui-kit/**
  - tests/**
  - tools/**
status: pending
confidence: ~
depends_on: []
---

# Shard: protocol-architect — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **protocol-architect** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.

## Context

This story introduces the first gameplay layer of Party Delve: the Hub, a pre-combat social space where all joined players can freely move their characters on a shared bounded map visible on the host screen. It is the first Phase 2 story and builds directly on the Phase 1 foundation — room code join flow, player slots, and the WebSocket baseline are all in place.

Players use an analog joystick on their phone to send continuous directional input. The simulation server processes movement each tick and broadcasts player positions to the host. The host renders each player as a distinct colored dot on a flat bounded rectangle. A disconnected player's character freezes at their last known position and is displayed at 50% opacity until a future reconnect story handles re-entry.

This shard owns the contract definitions that all other shards depend on. It must complete before simulation-engineer, host-engineer, and mobile-engineer begin.

## Your Tasks

1. **Define `MoveInputEvent`** in `packages/shared-types/src/input.ts` (create or extend the file):
   ```typescript
   export interface MoveInputEvent {
     playerId: string;
     direction: { dx: number; dy: number }; // analog delta, magnitude clamped 0–1
     sequenceNumber: number;
     timestamp: number;
   }
   ```

2. **Define `PlayerStateSnapshot`** in `packages/shared-types/src/player.ts` (create or extend the file):
   ```typescript
   export type PlayerMovementState = 'moving' | 'idle';

   export interface PlayerStateSnapshot {
     playerId: string;
     position: { x: number; y: number };
     connected: boolean;
     state: PlayerMovementState;
   }
   ```

3. **Add event name constants** in `packages/net-protocol/src/event-names.ts` (additive only — do not change existing constants):
   ```typescript
   MOVE_INPUT_EVENT: 'MoveInputEvent',
   PLAYER_STATE_SNAPSHOT: 'PlayerStateSnapshot',
   ```
   The `t` field on the wire envelope must match the TypeScript type name exactly (per networking-spec.md).

4. **Export the new types** from `packages/shared-types/src/index.ts` if an index file exists.

5. **Check networking-spec.md** (`docs/specs/networking-spec.md`) for any existing movement event definitions. If `MoveInputEvent` or `PlayerStateSnapshot` are already partially defined, reconcile with the definitions above — do not create duplicates. If a conflict exists, update the spec to reflect the canonical definition you are writing.

6. **Run `pnpm typecheck`** from the repo root to confirm no TypeScript errors are introduced.

## Acceptance Criteria

- [ ] `MoveInputEvent` is defined in `packages/shared-types` with fields: `playerId: string`, `direction: { dx: number, dy: number }` (continuous analog delta, clamped to magnitude 0–1), `sequenceNumber: number`, `timestamp: number`
- [ ] `PlayerStateSnapshot` is defined in `packages/shared-types` with fields: `playerId: string`, `position: { x: number, y: number }`, `connected: boolean`, `state: 'moving' | 'idle'`
- [ ] Event name constants `MOVE_INPUT_EVENT` and `PLAYER_STATE_SNAPSHOT` added to `packages/net-protocol/src/event-names.ts`
- [ ] `pnpm typecheck` passes

## Non-Goals

- This shard does NOT implement movement logic, rendering, or input handling
- This shard does NOT modify any `apps/**` code
- This shard does NOT define skill input events (separate story)
- This shard does NOT add reconnect-specific state fields (separate story)

## Edge Cases

- If `MoveInputEvent` or `PlayerStateSnapshot` are partially defined in networking-spec.md or shared-types already from Phase 1 planning, reconcile rather than duplicate
- If `packages/net-protocol/src/event-names.ts` does not yet have an `EVENT_NAMES` export, add it; otherwise extend it additively

## Telemetry

No new telemetry events required for this shard. Telemetry events are defined in the story and will be instrumented by the telemetry-agent shard after QA passes.

## Phase Log

_Empty — append your entry here when complete._

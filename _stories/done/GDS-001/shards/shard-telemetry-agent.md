---
shard_id: shard-telemetry-agent
parent_id: GDS-001
owner: telemetry-agent
allowed_paths:
  - packages/telemetry/**
blocked_paths:
  - apps/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
  - packages/ui-kit/**
  - tests/**
  - tools/**
status: complete
confidence: 95
depends_on:
  - shard-qa-agent
---

# Shard: telemetry-agent — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **telemetry-agent** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.
> **Prerequisite:** shard-qa-agent must be complete (QA passed).

## Context

This story introduces the Hub, the first Phase 2 gameplay layer. Two new user flows require telemetry instrumentation: a player entering the hub for the first time in a session, and analog movement input being sent from the controller.

The `packages/telemetry` package was scaffolded in Phase 1 with session funnel events (`session.host_started`, `session.player_joined`, etc.). This shard adds two new events following the same schema: `{ event, timestamp, payload }`.

## Your Tasks

1. **Instrument `hub.player_entered`** in `packages/telemetry/src/hub.ts` (create if needed):
   - Event name: `hub.player_entered`
   - Trigger: fires once when a player's `connected` state first becomes `true` in a session (initial join lands in hub)
   - Payload: `{ player_id: string, session_id: string, slot_index: number, timestamp: number }`
   - Export: `trackHubPlayerEntered(payload): void`
   - Follow the existing `track({ event, timestamp, payload })` convention in `packages/telemetry`

2. **Instrument `input.move`** in `packages/telemetry/src/input.ts` (create if needed):
   - Event name: `input.move`
   - Trigger: fires when joystick delta exceeds dead zone threshold (0.05)
   - Payload: `{ player_id: string, dx: number, dy: number, sequence_number: number, timestamp: number }`
   - Export: `trackInputMove(payload): void`
   - Dead zone logic: `Math.hypot(dx, dy) > 0.05` — if below threshold, do not fire
   - Note: the dead zone check lives in the telemetry call site, not in the `track` function itself. Document which layer is responsible (the caller: mobile controller or simulation server, whichever the telemetry-agent wires to).

3. **Export new functions** from `packages/telemetry/src/index.ts`.

4. **Add KPI mapping comment** near each event definition:
   - `hub.player_entered`: funnel step after `session.player_joined`
   - `input.move`: engagement signal — measures active controller usage per session

5. **Run `pnpm typecheck`** to confirm no TypeScript errors.

## Acceptance Criteria

- [ ] `trackHubPlayerEntered` is exported from `packages/telemetry` and follows the `{ event, timestamp, payload }` schema
- [ ] `trackInputMove` is exported from `packages/telemetry` with dead zone threshold 0.05 documented
- [ ] Both functions are exported from `packages/telemetry/src/index.ts`
- [ ] KPI mapping is documented in comments
- [ ] `pnpm typecheck` passes

## Non-Goals

- This shard does NOT wire the telemetry calls into `apps/**` — it only defines the instrumentation functions in `packages/telemetry`
- This shard does NOT modify event schemas for existing Phase 1 events

## Edge Cases

- If `packages/telemetry/src/index.ts` does not yet have an export barrel, create it
- If the dead zone check should live in the mobile controller vs. the simulation server, document the decision in a comment — pick the mobile controller (client-side filtering reduces event volume)

## Telemetry

This shard defines the following events (it does not instrument them elsewhere — it IS the instrumentation):

- event: `hub.player_entered`
  trigger: player enters the hub for the first time in a session
  payload: { player_id, session_id, slot_index, timestamp }

- event: `input.move`
  trigger: joystick delta exceeds dead zone threshold (0.05)
  payload: { player_id, dx, dy, sequence_number, timestamp }

## Phase Log

_Empty — append your entry here when complete._

---
shard_id: shard-qa-agent
parent_id: GDS-001
owner: qa-agent
allowed_paths:
  - tests/**
  - tools/**
blocked_paths:
  - apps/**
  - packages/**
status: complete
confidence: 85
depends_on:
  - shard-simulation-engineer
  - shard-host-engineer
  - shard-mobile-engineer
---

# Shard: qa-agent — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **qa-agent** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.
> **Prerequisite:** shard-simulation-engineer, shard-host-engineer, and shard-mobile-engineer must all be complete.

## Context

This story introduces the first gameplay layer of Party Delve: the Hub. Players move freely on a shared bounded map. The simulation server runs a 20 Hz tick loop, enforces map bounds, handles player disconnect, and broadcasts `PlayerStateSnapshot` to the host. The host renders player dots. The mobile sends analog joystick input.

Your job is to verify that all acceptance criteria are met — writing or updating test files in `tests/` only. You validate correctness against the story's AC without modifying any `apps/**` or `packages/**` code.

## Your Tasks

1. **Unit test: movement tick is deterministic** (`tests/unit/movement.test.ts`):
   - Given one player with `pendingDirection: { dx: 1, dy: 0 }` at 20 Hz, after one tick: `position.x` must equal `5.0` (100 units/sec ÷ 20 ticks/sec), `position.y` must equal `0`
   - Given `pendingDirection: { dx: 0, dy: 0 }`, position must be unchanged after a tick

2. **Unit test: map boundary clamping** (`tests/unit/movement.test.ts`):
   - Given a player at `position: { x: 798, y: 0 }` with `pendingDirection: { dx: 1, dy: 0 }` after 3 ticks, `position.x` must not exceed `800`
   - Given a player at `position: { x: 0, y: 0 }` with `pendingDirection: { dx: -1, dy: 0 }` after any tick, `position.x` must not go below `0`

3. **Unit test: input normalization** (`tests/unit/input-handler.test.ts`):
   - Given direction `{ dx: 3, dy: 4 }` (magnitude 5), after `handleMoveInput`, the stored `pendingDirection` must have magnitude ≤ 1
   - Given direction `{ dx: NaN, dy: 0 }`, the stored `pendingDirection` must be unchanged (discard silently)

4. **Unit test: disconnect handling** (`tests/unit/session-store.test.ts` or `movement.test.ts`):
   - Given a connected player, after simulating disconnect: `slot.connected` is `false` and `slot.pendingDirection` is `{ dx: 0, dy: 0 }`
   - Position must be unchanged after disconnect (no further movement)

5. **Regression: e2e join-room smoke test** (`tests/e2e/join-room.test.ts`):
   - Run the existing e2e test — it must still pass with no modifications
   - If the test needs path or import updates due to changes made by other shards, update those imports only (do not change test logic)

6. **Report** structured output:
   - List each test file created or modified
   - List pass/fail per test case
   - Flag any acceptance criteria not covered by tests
   - Write the report to `_stories/active/GDS-001/story.md` Phase Log under `### QA Agent`

## Acceptance Criteria

- [ ] Movement tick unit test passes: one player moving at full speed for one tick covers 5 world units
- [ ] Boundary clamping test passes: position never exceeds map bounds
- [ ] Input normalization test passes: over-magnitude vectors are clamped, NaN is discarded
- [ ] Disconnect handling test passes: `connected: false`, `pendingDirection` zeroed, position frozen
- [ ] Existing e2e join-room smoke test passes
- [ ] No acceptance criteria from the story are left without test coverage (document any gaps)

## Non-Goals

- This shard does NOT write tests for host-side rendering correctness (canvas pixel tests)
- This shard does NOT write tests for the mobile joystick component directly
- This shard does NOT modify any `apps/**` or `packages/**` code

## Edge Cases

- **Import paths may have changed** due to new files added by simulation-engineer — update imports in test files only
- **No tick loop test harness yet:** If the TickLoop class requires a running timer, mock the interval with `jest.useFakeTimers()` or call `applyMovementTick` directly with explicit `tickRateHz`

## Telemetry

No telemetry instrumentation in this shard.

## Phase Log

_Empty — append your entry here when complete._

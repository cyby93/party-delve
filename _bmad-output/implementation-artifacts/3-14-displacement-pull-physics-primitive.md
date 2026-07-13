---
baseline_commit: f6083d8
---

# Story 3.14: Displacement/Pull Physics Primitive

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 4th of 5 shared-engine-capability stories; independent of 3.12/3.13
  content-wise, but Story 3.19's Void Pulse needs BOTH 3.13's zone chaining
  AND this story's pull force, so this story should land before 3.19)

Context: Pure engine-capability story — no ability applies displacement yet
  after this story lands (3.16 wires Stone Wall, 3.19 wires Void Pulse's zone).

  **CORRECTION TO epics.md — read this before writing any code:** AC1 says
  "apps/simulation-server applies this vector as a one-tick impulse via
  `body.applyLinearImpulse` (not a direct position mutation), preserving
  normal collision resolution." This literally will not work in this
  codebase, and following it produces a feature that silently does nothing.
  Traced the full tick in `apps/simulation-server/src/rooms/GameRoom.ts`:

  - Player position is NOT physics-integration-authoritative. Every tick,
    "Planck phase 1" (line ~1017-1039) calls `body.setLinearVelocity(...)`
    unconditionally from the current joystick input (or `Vec2(0,0)` in the
    deadzone) for every player body, BEFORE the single per-tick
    `physicsWorld.step()` call (line 1043). Any `applyLinearImpulse` from a
    PREVIOUS tick's ability dispatch (which runs later in the tick, around
    line 1330+, i.e. AFTER that tick's own phase 1/2/3) would still be
    sitting on the body's velocity — but next tick's phase 1
    `setLinearVelocity` call REPLACES (not adds to) velocity, wiping it out
    before `step()` ever integrates it. The impulse never has a tick where
    it can move the player.
  - Enemy position is NOT physics-integration-authoritative either — it's
    the opposite direction of sync. `tickChase` (`packages/game-rules/src/
    systems/ai/fsm.ts`) computes `enemy.x`/`enemy.y` via pure position math
    (`enemy.x += (dx/len) * moveAmount`), and GameRoom.ts's "Enemy AI phase"
    (line ~1180-1200) then does `body.setPosition(Vec2(toMeters(enemy.x),
    toMeters(enemy.y)))` — FORCE-SYNCING the physics body to the logical
    position every tick, always overwriting anything the physics engine
    itself computed. Nothing ever reads an enemy body's position back into
    `enemy.x/y` — the body exists purely for collision/contact detection.
    An impulse applied to an enemy body is 100% inert; it's discarded by
    the next `setPosition` call before anything observes it.

  **Actual required implementation:** `applyDisplacement` returns a
  displacement vector/target-position (pure, no planck import, exactly as
  AC1 already specifies for the math itself — only the "how it's applied"
  part of AC1 is wrong). `apps/simulation-server` applies it as a DIRECT
  position mutation, matching the pattern this codebase already uses
  everywhere else for authoritative position changes:
  - For an enemy target: add the displacement to `enemy.x`/`enemy.y`
    directly (same style as `tickChase`'s own position math), which then
    flows through the EXISTING `body.setPosition(...)` sync at line ~1200
    automatically — no new sync code needed, just feed the delta into the
    same value `tickChase` would have produced.
  - For a player target: call `body.setPosition(...)` directly on the
    player's body (matching the existing spawn-teleport pattern at
    GameRoom.ts:743 and :913, which already uses `body.setPosition` for an
    instant authoritative position change) and update `player.x`/`player.y`
    to match, then broadcast an immediate `player:moved` delta so the host
    sees it without waiting for next tick's phase-3 readback (matching how
    other immediate ability effects broadcast synchronously — see
    `ability:fired`/`enemy:damaged` in the ability-dispatch block).
  - This still "preserves normal collision resolution" in the sense that
    matters: the NEXT `physicsWorld.step()` call will resolve collisions
    normally from the new position (a body can't be teleported inside a
    wall it would then get pushed out of, same as today's spawn-teleport
    behavior) — it just doesn't go through the impulse/velocity path, which
    is structurally impossible to use for either entity type here.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Simulation Engineer (all tasks — packages/game-rules/**, apps/simulation-server/**)
  (No shared-types or net-protocol change — displacement is a same-tick,
  same-broadcast-cycle effect using existing `enemy:moved`/`player:moved`
  delta types; no new wire type needed.)

Goal:
  Task 1 — `packages/game-rules/src/systems/displacement.ts` (new):
            `applyDisplacement(targetX, targetY, sourceX, sourceY, strength)`
            → `{ dx: number; dy: number }`, pure.
  Task 2 — Wire it into Stone Wall's hit-scan resolution path (the mechanism
            only — Stone Wall itself isn't dispatched with real damage/pull
            until Story 3.16; this story just makes the function callable
            and tested) and document the zone-tick integration point for
            Story 3.13's chained zones (Void Pulse, wired in 3.19) — per the
            correction above, using direct position mutation, not impulse.

Allowed paths:
  - packages/game-rules/src/systems/displacement.ts (new)
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts (the position-mutation
    application point only — see Context)
  - tests/unit/displacement.test.ts (new)

Blocked paths:
  - Stone Wall's actual damage/inputType/dispatch wiring — Story 3.16
  - Void Pulse's zone `effectType: 'pull'` actual tick-application — Story
    3.19 (this story only needs to make `applyDisplacement` importable and
    documented for 3.19 to call from the zone-tick handler Story 3.13 built)
  - packages/net-protocol/** — no new wire types needed
  - packages/shared-types/** — no new state fields needed

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.14" section
  - apps/simulation-server/src/rooms/GameRoom.ts — full tick-phase read
    (see Context for the exact line-numbered trace); this story requires
    understanding tick ordering more than any other story in this batch —
    do not skim this file
  - packages/game-rules/src/systems/ai/fsm.ts's `tickChase` — the exact
    position-mutation style to match for enemy displacement

Non-goals:
  - Do not implement `body.applyLinearImpulse` anywhere — see Context; it is
    a verified dead end in this architecture, not a style preference.
  - Do not add bounds-clamping for displacement near arena edges — per
    epics.md AC, planck's own collision resolution on the next step handles
    walls; no bespoke clamping (explicit `ponytail:`-tagged deferral in the
    epics text itself — "revisit only if playtesting shows a problem").
  - Do not wire Stone Wall or Void Pulse's actual ability behavior — 3.16/3.19.

Acceptance criteria: [see BDD-format Acceptance Criteria section below —
  AC2's "one-tick impulse via body.applyLinearImpulse" wording is corrected
  per the Context section above; the observable requirement (target moves
  toward source) is unchanged]

Required hooks:
  - Simulation-safety hook: TRIGGERED. Deterministic tick test: displacement
    math must be a pure function of inputs, no wall-clock dependency.
  - Ownership hook: single area (Simulation Engineer only) — no split needed.

Required tests:
  - tests/unit/displacement.test.ts — direction/magnitude math across
    several source/target configurations, including target-equals-source
    (zero-vector guard, no divide-by-zero — return `{dx:0, dy:0}`, not NaN).

Telemetry impact: None.
```

---

## Story

As a simulation engineer,
I want a reusable displacement/pull force,
so that Stone Wall's drag and Void Pulse's vacuum zone use one mechanism instead of two bespoke implementations.

---

## Acceptance Criteria

**AC1 — `applyDisplacement` (pure math):**
**Given** `packages/game-rules/src/systems/displacement.ts` (new)
**When** `applyDisplacement(targetX, targetY, sourceX, sourceY, strength)` is called
**Then** it returns a displacement vector `{ dx, dy }` pointing from the target toward the source, scaled by `strength`, as a pure calculation with no planck.js import
**And** `apps/simulation-server` applies this as a direct position mutation (see Context — NOT `body.applyLinearImpulse`, which is verified inert for both player and enemy bodies in this codebase's current architecture)

**AC2 — Stone Wall's mechanism is callable (behavior wired in Story 3.16):**
**Given** Stone Wall fires (Cone/Line, long reach)
**When** any enemy overlaps the cone's hit zone (`isInHitZone`)
**Then** each hit enemy's displacement is computable via `applyDisplacement`, pulling it toward the caster's position at cast time — this story proves the mechanism works via unit test; Story 3.16 wires it into actual ability dispatch

**AC3 — Zone-tick integration point documented (behavior wired in Story 3.19):**
**Given** Void Pulse's chained zone (Story 3.13)
**When** a unit — ally or enemy — is inside the zone on a tick
**Then** the zone-tick handler (built in Story 3.13) has a clear, tested integration point for calling `applyDisplacement` toward the zone's center — Story 3.19 wires the actual call

**AC4 — No bounds-clamping:**
**Given** displacement is applied near arena bounds or other bodies
**When** the impulse would push a unit into a wall or another body
**Then** planck.js's own collision resolution (on the following `physicsWorld.step()`) handles it — no bespoke bounds-clamping is added

**AC5 — Unit tests:**
**Given** unit tests
**When** `tests/unit/displacement.test.ts` runs
**Then** `applyDisplacement`'s direction/magnitude math is verified across several source/target configurations, including target-equals-source (zero-vector guard, no divide-by-zero)

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #1, #5) — `packages/game-rules/src/systems/displacement.ts`:
  ```ts
  export function applyDisplacement(
    targetX: number, targetY: number,
    sourceX: number, sourceY: number,
    strength: number,
  ): { dx: number; dy: number } {
    const dx = sourceX - targetX;
    const dy = sourceY - targetY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { dx: 0, dy: 0 };
    return { dx: (dx / len) * strength, dy: (dy / len) * strength };
  }
  ```
  (Signature is a suggestion matching AC1's parameter list — dev agent may
  adjust names to match this file's eventual callers' argument order, but
  keep it pure and planck-import-free.) Export from `packages/game-rules/
  src/index.ts`.

- [ ] **Task 2** (AC: #2, #3) — In `GameRoom.ts`, add (but do not yet call
  from any ability dispatch — no ability fires displacement until 3.16/3.19)
  a small private helper method demonstrating/documenting the correct
  application pattern for both entity types, e.g.
  `applyDisplacementToEnemy(enemy: EnemyState, dx, dy): void` (mutates
  `enemy.x += dx; enemy.y += dy` — the existing `body.setPosition` sync at
  the Enemy AI phase picks this up automatically next time it runs) and
  `applyDisplacementToPlayer(playerId: string, dx, dy): void` (looks up
  `playerBodies.get(playerId)`, calls `body.setPosition(Vec2(toMeters(newX),
  toMeters(newY)))`, updates `player.x/y`, broadcasts `player:moved`
  immediately). Leave these as ready-to-call private helpers with a comment
  pointing to which future story (3.16/3.19) will call them — don't fabricate
  a test-only call site.

- [ ] Write `tests/unit/displacement.test.ts` per AC5 — cover: source
  directly right of target, source directly above, diagonal, and
  target-equals-source (must return `{dx:0, dy:0}`, not `NaN`).
- [ ] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

---

## Dev Notes

### This story is almost entirely about the Context correction above

The actual pure-math function (`applyDisplacement`) is trivial — a
normalized vector scaled by strength, identical shape to dozens of similar
calculations already in this codebase (`isInHitZone`, `tickChase`'s chase
direction). The value of this story is entirely in NOT wiring it the way
epics.md's AC1 literally describes. Re-read the Context section's tick trace
before writing any `apps/simulation-server` code. If in doubt, grep
`body.setPosition` and `body.setLinearVelocity` in `GameRoom.ts` and read
every call site — there is no `applyLinearImpulse` call anywhere in the
current codebase, and this story should not be the one to introduce a dead one.

### Project Context Rules

- **planck.js rule** (project-context.md): "Always construct `Vec2` — never
  destructure to `{x, y}` and pass back in." Applies to the
  `applyDisplacementToPlayer` helper's `body.setPosition` call.
- **Result<T, E>**: `applyDisplacement` is a simple math function, not a
  fallible operation (it always succeeds, even for the zero-vector case) —
  a plain return value is correct here, not `Result`, matching
  `isInHitZone`'s existing plain-boolean-return style rather than
  `applyDamage`'s `Result`-return style. Use judgment based on whether the
  function can meaningfully fail (it can't).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.14]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — full tick-phase structure (see Context for exact trace)
- [Source: packages/game-rules/src/systems/ai/fsm.ts] — `tickChase`'s direct position-mutation style to match

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

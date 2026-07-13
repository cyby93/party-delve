---
baseline_commit: f6083d8
---

# Story 3.20: Stormcaller — Storm Eye Rework

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — last story in the batch. Depends on 3.11, 3.13 (zones), and reuses
  3.19's `ABILITY_DELIVERY` table, which this story extends with a 3rd value)

Context: Simplest of the 5 kit-rework stories — one ability, no cross-class
  mechanism reuse beyond zones (no status effects, no displacement, no
  self-cost, no mixed-faction targeting). The two real design gaps epics.md
  leaves open:

  1. **`ABILITY_DELIVERY` (Story 3.19) only has `'hitscan' | 'projectile'`.**
     Storm Eye places a `ZoneState` DIRECTLY (not via a projectile chain
     like Void Pulse) — this story extends the union to `'hitscan' |
     'projectile' | 'zone'` and adds the `'zone'` dispatch branch in
     `GameRoom.ts` (call `createZoneBody` directly from the ability-dispatch
     block, using the ability's aimed direction to place the zone at
     `caster position + direction * ABILITY_HIT_RANGE_PX`, matching how
     every other `RELEASE` ability already resolves an aimed placement
     point via `isInHitZone`'s own directional-offset math).

  2. **`ZoneState` (Story 3.13) has exactly ONE `tickIntervalMs` field, but
     Storm Eye needs TWO independent cadences** — a steady damage tick and a
     separate, longer "bonus lightning strike" interval. Extending the
     shared `ZoneState` wire type for a second timer that only ONE ability
     (out of everything in the full 16-ability spec) ever uses would be
     premature generalization. Track the strike cadence as GameRoom-local
     state instead — `Map<zoneId, { lastStrikeAtMs: number }>` — parallel to
     the zone but not part of its wire-visible shape, the same choice
     already made for Story 3.17's Spirit Nova expanding-radius tracking
     (GameRoom-local, not `GameState`-visible, for a single-consumer
     mechanic).

  **RNG for the random strike target: use `this.prng` (already exists,
  created at `GameRoom.ts:156` via `createRng(this.gameState.session.runSeed)`,
  currently UNUSED anywhere in the codebase — grepped, zero other call
  sites).** This is the pragmatic choice: a dedicated new `OFFSET_*` stream
  (matching the `OFFSET_FLOOR_LAYOUT`/`OFFSET_ENEMY_SPAWN`-style convention
  in `packages/shared-types/src/constants.ts`) would be the "textbook
  correct" per-system-isolated-stream pattern this codebase otherwise uses
  everywhere, but `this.prng` already exists, is unused, and is exactly a
  general-purpose stream with no other claimant — using it costs nothing and
  avoids growing `constants.ts` for a single low-stakes cosmetic-adjacent
  roll (which random target gets hit by a bonus damage tick is not
  determinism-critical for replay/anti-cheat purposes the way floor layout
  or enemy spawns are). If this judgment is wrong for this project's
  determinism requirements, switching to a dedicated offset stream later is
  a small, contained change — flag it as a `ponytail:`-style comment at the
  call site either way, either "reusing the general stream" or the reasoning
  for a future switch.

  **Reuse 3.13's zone-overlap tracking for "who's currently inside the
  zone"** — Story 3.13's Task 3c already built a begin/end-contact-based
  overlap set for the regular tick's "apply effect to everyone overlapping."
  The bonus strike just needs to pick ONE random member of that same set
  instead of applying to all of them — no new overlap-tracking code needed.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Protocol Architect (Task 1 — packages/net-protocol/**, the new
    `zone:strike` delta type)
  Simulation Engineer (Tasks 2, 3 — packages/game-rules/**,
    apps/simulation-server/**)

Goal:
  Task 1 — `zone:strike` delta type (distinct from `zone:tick`).
  Task 2 — Extend `ABILITY_DELIVERY` with `'zone'`; wire Storm Eye's
            placement dispatch branch; populate Storm Eye's `ZoneState`
            config (`effectType: 'damage'`, reusing 3.13's already-built
            `'damage'` tick case — no new zone-tick code needed for the
            steady damage, only for the bonus strike).
  Task 3 — GameRoom-local bonus-strike timer + `this.prng`-based random
            target selection among the zone's current overlap set.

Allowed paths:
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - tests/unit/storm-eye.test.ts (new)

Blocked paths:
  - Lightning Arc, Tempest Hurl, Thunder Clap — explicitly confirmed
    correct as-is by the brainstorming session (epics AC), do not touch
    their `CLASS_DEFINITIONS`/`balance.ts` entries or dispatch path
  - Any other class's abilities

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.20" section
  - _bmad-output/implementation-artifacts/3-13-projectile-physics-and-zone-field-entities.md — `ZoneState`, `createZoneBody`, the zone-tick handler and its `'damage'` case, the begin/end-contact overlap-tracking pattern
  - _bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md — `ABILITY_DELIVERY` table, this story's `'zone'` extension point
  - apps/simulation-server/src/rooms/GameRoom.ts:156 (`this.prng` — confirm
    still unused elsewhere before claiming it for this story; re-grep at
    implementation time in case another story in this batch's actual
    implementation order used it first)
  - packages/shared-types/src/constants.ts (existing `OFFSET_*` pattern —
    read for context on the alternative this story deliberately doesn't take)

Non-goals:
  - Do not touch Lightning Arc, Tempest Hurl, or Thunder Clap.
  - Do not add a second `tickIntervalMs`-equivalent field to the shared
    `ZoneState` wire type — GameRoom-local tracking only (see Context).
  - Do not add a new `OFFSET_STORM_EYE`-style PRNG stream unless `this.prng`
    turns out to already be claimed by another change that landed between
    this story's writing and its implementation (re-verify, don't assume
    the codebase is frozen).

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — new `zone:strike` delta type, round-trip test required.
  - Simulation-safety hook: TRIGGERED. Deterministic tick test: strike
    target selection must use the seeded `this.prng`, never `Math.random()`
    — this is AR8/NFR7-relevant (project-context.md: "All randomness in
    packages/game-rules and apps/simulation-server must use xoshiro128++").
    Verify with a test that seeds two independent `GameRoom`-equivalent
    setups (or the underlying `createRng` stream directly) and confirms
    identical strike-target sequences for identical seeds.
  - Ownership hook: 2 areas — flag to user if narrower split preferred.

Required tests:
  - tests/unit/storm-eye.test.ts — steady-tick damage (via 3.13's existing
    `'damage'` zone-tick case, so this may mostly be a regression
    confirmation rather than new logic) and random-strike selection (with a
    seeded RNG for determinism, per NFR7) are each covered.

Telemetry impact: None.
```

---

## Story

As a Stormcaller,
I want Storm Eye to place a persistent damage zone with periodic lightning strikes,
so that my ultimate creates lasting area pressure instead of doing nothing.

---

## Acceptance Criteria

**AC1 — Storm Eye places a damage zone (`RELEASE` after Story 3.11, placement):**
**Given** Storm Eye fires
**When** it resolves
**Then** a `ZoneState` is placed at the aimed position with a steady damage tick for its configured duration, replacing the current damage=0 no-op

**AC2 — Periodic bonus lightning strike:**
**Given** the Storm Eye zone is active
**When** each periodic strike interval elapses (a separate, longer interval than the steady tick, from a new `balance.ts` constant)
**Then** a bonus lightning-bolt strike deals extra damage to one random target currently inside the zone, selected via the sim's xoshiro128++ RNG instance — no `Math.random()` — broadcast as its own delta distinct from the steady `zone:tick` event

**AC3 — Lightning Arc/Tempest Hurl/Thunder Clap out of scope:**
**Given** Lightning Arc, Tempest Hurl, and Thunder Clap
**When** this story is scoped
**Then** these three abilities are explicitly out of scope — the session confirmed them as already correct, no rework needed

**AC4 — Tests:**
**Given** unit tests
**When** `tests/unit/storm-eye.test.ts` runs
**Then** steady-tick damage and random-strike selection (with a seeded RNG for determinism, per NFR7) are each covered

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #2) — `server-to-host.ts`: add
  `ZoneStrikeDelta { type: 'zone:strike'; zoneId: string; targetId: string; damage: number; }`
  — add to `DeltaEventMsg`. `apply-delta.ts`: add the matching case (likely
  a no-op / visual-only, same style as `ability:fired` — the actual HP
  change is broadcast separately via the existing `enemy:damaged`/
  `player:hp-updated` delta for the struck target; `zone:strike` itself is
  purely "show a lightning-bolt visual from the zone to this target").

- [ ] **Task 2a** (AC: #1) — `balance.ts`: extend `ABILITY_DELIVERY`'s type
  to `'hitscan' | 'projectile' | 'zone'`; set Stormcaller slot 3 (Storm
  Eye) to `'zone'`. Add `STORM_EYE_ZONE_RADIUS_PX`, `STORM_EYE_TICK_MS`,
  `STORM_EYE_DURATION_MS`, `STORM_EYE_STRIKE_INTERVAL_MS`,
  `STORM_EYE_STRIKE_DAMAGE` tunables.

- [ ] **Task 2b** (AC: #1) — `GameRoom.ts`: in the ability-dispatch block's
  delivery branch (extended by this story), add the `'zone'` case: compute
  the placement point (`player.x + dirX * ABILITY_HIT_RANGE_PX[...]`,
  `player.y + dirY * ...` — same directional-offset math `isInHitZone`
  already uses internally, just needs the point itself here rather than a
  hit-test), call `createZoneBody` (Story 3.13) with `effectType: 'damage'`,
  `radius: STORM_EYE_ZONE_RADIUS_PX`, `tickIntervalMs: STORM_EYE_TICK_MS`,
  `expiresAtMs: nowMs + STORM_EYE_DURATION_MS`. The regular steady-tick
  damage application reuses Story 3.13's existing `'damage'` zone-tick case
  verbatim — no new code needed for that half.

- [ ] **Task 3** (AC: #2) — `GameRoom.ts`: add
  `zoneStrikeTimers: Map<string, number> = new Map()` (zoneId →
  lastStrikeAtMs). In the zone-tick phase (Story 3.13's Task 3c), after the
  regular tick-interval check, ALSO check: for zones with a configured
  strike interval (Storm Eye's zones only — gate this on the zone having
  been created with `effectType: 'damage'` AND originating from Storm
  Eye's ability slot, or simpler: track strike-eligibility as a property of
  the zone's creation context rather than re-deriving it — dev agent's
  call on the cleanest way to scope this to Storm Eye specifically without
  hardcoding a class/index check deep in the generic zone-tick loop), if
  `nowMs - (zoneStrikeTimers.get(zoneId) ?? zoneCreatedAtMs) >=
  STORM_EYE_STRIKE_INTERVAL_MS`: look up the zone's current overlap set
  (Story 3.13's begin/end-contact tracking), if non-empty pick one target
  via `this.prng()` (e.g. `overlapArray[Math.floor(this.prng() *
  overlapArray.length)]`), apply `STORM_EYE_STRIKE_DAMAGE` via `applyDamage`
  (enemy target — Storm Eye's zone only affects enemies per its `'damage'`
  effectType, consistent with 3.13's existing damage-case scoping), broadcast
  `enemy:damaged` (existing) + `zone:strike` (new, Task 1), update
  `zoneStrikeTimers.set(zoneId, nowMs)`.

- [ ] Write `tests/unit/storm-eye.test.ts` per AC4 — include a determinism
  test: two independently-seeded `createRng(sameSeed)` streams, feed the
  same overlap-set-size sequence into the same selection logic (extract the
  selection math into a small pure helper if that makes it independently
  testable without a live `GameRoom` — recommended, matches this
  codebase's preference for pure, directly-testable `game-rules` functions
  over asserting behavior only through integration tests).
- [ ] Add a `zone:strike` round-trip contract test.
- [ ] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

---

## Dev Notes

### Extract the random-selection math as a pure function if practical

`apps/simulation-server` is allowed to call `this.prng()` directly (it's not
`packages/game-rules`, which must stay pure per project-context.md's Package
Responsibility Boundaries), but the "pick index `i` from an array of size
`n` given a `[0,1)` random value" math itself is trivially pure and worth
extracting to `packages/game-rules` (e.g. `pickRandomIndex(rngValue:
number, count: number): number`) purely so `tests/unit/storm-eye.test.ts`
can test the selection logic without spinning up a `GameRoom`/planck world —
matches this codebase's strong existing preference (visible in every prior
story's test-location choices) for pure-function unit tests over
integration-only coverage wherever the math can be isolated.

### This is the last story in the 3.11-3.20 batch

After this story, all 7 originally-placeholder/mislabeled abilities
(Iron Skin, Ancestor's Voice, Spirit Nova, Soul Mend, Warding Cry, Dark
Pact, Storm Eye) and Blood Draw's missing lifesteal are resolved, matching
the brainstorming session's full scope. No further engine capability or
kit-rework story is implied by the current epics.md beyond 3.20 — the next
sprint-planning pass should re-derive Epic 3's status (currently reopened to
`in-progress` for this batch) once all of 3.11-3.20 reach `done`.

### Project Context Rules

- **PRNG rule** (project-context.md, Performance Rules): "All randomness in
  `packages/game-rules` and `apps/simulation-server` must use xoshiro128++...
  `Math.random()` is only permitted in non-simulation code." Directly
  applicable — this is the one story in the batch with a real randomness
  requirement; get this right, it's an explicit architecture rule, not a
  style preference.
- Same tick-loop-hygiene, Result<T,E>, and configuration-hierarchy rules as
  every other story in this batch.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.20]
- [Source: _bmad-output/implementation-artifacts/3-13-projectile-physics-and-zone-field-entities.md] — `ZoneState`, zone-tick handler, overlap tracking
- [Source: _bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md] — `ABILITY_DELIVERY` table
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:156] — `this.prng`, unused, claimed by this story
- [Source: packages/shared-types/src/constants.ts] — existing `OFFSET_*` PRNG-stream convention (the alternative this story deliberately doesn't take)

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

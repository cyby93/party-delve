---
baseline_commit: f6083d8
---

# Story 3.13: Projectile Physics & Zone/Field Entities

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 3rd of 5 shared-engine-capability stories; independent of 3.12,
  depends only on 3.11's landed AbilityInputType. Stories 3.19 (Blood Spike,
  Void Pulse) and 3.20 (Storm Eye) consume this story's Projectile/Zone
  entities; 3.14 (Displacement) is designed to compose with this story's
  Zone tick but does not require it to land first.)

Context: Pure engine-capability story — no ability produces a real projectile
  or zone yet after this story lands. It builds the physics bodies, GameState
  entities, contact-resolution plumbing, and delta events; 3.19/3.20 wire
  specific abilities to them.

  Current codebase state (read directly, not inferred from epics.md):
  - `apps/simulation-server/src/physics/world.ts` has the body-factory +
    filter-bit + `PhysicsBodyData` pattern: `CAT_PLAYER=0x0001,
    CAT_ENEMY=0x0002, CAT_POI=0x0004, CAT_ESSENCE=0x0008,
    CAT_BOND_SENSOR=0x0020, CAT_BOSS=0x0040`. Next unused bits: `0x0080`,
    `0x0100`.
  - `apps/simulation-server/src/physics/sensors.ts` has the existing
    sensor-contact pattern (`createBondSensor`/`extractBondSensorContact`) —
    follow this exact shape for the new projectile/zone contact extractors,
    it is the established convention, not `world.ts`'s simpler
    body-vs-body extractors.
  - **Critical filter-bit gotcha, not mentioned in epics.md at all:**
    `createEnemyBody` (`world.ts:62-71`) sets `filterMaskBits: 0` with the
    comment "combat is hit-scan; no contact callbacks needed." **This means
    enemies currently generate ZERO contact events with anything.** A
    projectile body with `filterMaskBits: CAT_ENEMY` will NOT receive a
    contact against an enemy unless `createEnemyBody`'s mask is ALSO updated
    to include the new projectile/zone category — planck's rule is
    `(A.category & B.mask) && (B.category & A.mask)`, both sides must match.
    This is a required edit to an existing shared factory function, not
    optional, or Blood Spike/Void Pulse (Story 3.19) will silently never hit
    anything. Same applies to `createPlayerBody`'s mask (currently
    `CAT_POI | CAT_ESSENCE | CAT_BOND_SENSOR`) if a zone needs to pull/affect
    players (Void Pulse's zone does — Story 3.14/3.19).
  - `apps/simulation-server/src/rooms/GameRoom.ts` has the full established
    pattern to replicate exactly: `physicsWorld.on('begin-contact', ...)`
    (line ~325) pushes into a `pendingXBeginContacts: Array<...> = []`
    instance field; a later tick phase drains it in a `for` loop, mutates
    `GameState`, broadcasts a delta, and clears the array
    (`.length = 0`) — see the essence-collection block at lines 1096-1122 for
    the clearest example (destroys the sensor body via
    `this.physicsWorld.destroyBody(...)`, removes from a tracking `Map`,
    mutates state, broadcasts). Copy this shape for projectile-hit
    resolution.
  - `packages/net-protocol/src/apply-delta.ts` has the hard exhaustiveness
    guard (`const _exhaustive: never = evt`) — new `DeltaEventMsg` variants
    (`projectile:hit`, `projectile:expired`, `zone:tick`, `zone:expired`)
    each need a `case` here or the monorepo fails typecheck.
  - `packages/game-rules/src/systems/combat.ts`'s `applyDamage` is
    enemy-only. `zones.ts`'s tick-reapplication and `projectiles.ts`'s
    hit-resolution both call into it for damage — neither needs a
    player-damage path per epics.md's ACs (Void Pulse's damage-on-impact and
    Storm Eye's tick both target enemies only; the pull *effect* on allies in
    Story 3.14/3.19 is a physics impulse, not damage, so it doesn't go
    through `combat.ts`/`player-health.ts` at all).

Owner agent: Multi-context (explicit cross-context approval — foundational
  engine work spans 3 areas; flag to user if a narrower split is preferred):
  Protocol Architect (Task 1 — packages/shared-types/**, packages/net-protocol/**)
  Simulation Engineer (Task 2, 3 — packages/game-rules/**, apps/simulation-server/**)
  Host Experience Engineer (Task 4 — apps/host-client/**, minimal generic shapes only)

Goal:
  Task 1 — `ProjectileState`/`ZoneState` in shared-types + `GameState`;
            `projectile:hit`/`projectile:expired`/`zone:tick`/`zone:expired`
            delta types + apply-delta cases.
  Task 2 — `createProjectileBody()`/`createZoneBody()` + `CAT_PROJECTILE`/
            `CAT_ZONE` in `physics/world.ts`; REQUIRED mask updates to
            `createEnemyBody`/`createPlayerBody` (see Context); contact
            extractors in a new `physics/projectile-sensors.ts` (or extend
            `sensors.ts` — dev agent's call, match whichever is more
            consistent after reading both files) following `sensors.ts`'s
            pattern.
  Task 3 — `packages/game-rules/src/systems/zones.ts` (pure zone-tick logic)
            and a projectile hit/expire resolution helper (pure); GameRoom.ts
            wiring: begin-contact push → per-tick drain → resolve → broadcast
            → destroy, plus a per-tick lifetime/range check for projectiles
            and a per-tick interval check for zones.
  Task 4 — Minimal generic host rendering: a moving dot/streak for
            projectiles, a translucent circle for zones — reuse the
            `DungeonScreen.tsx` per-entity `Graphics` Map pattern.

Allowed paths:
  - packages/shared-types/src/game-state.ts
  - packages/shared-types/src/projectile.ts (new)
  - packages/shared-types/src/zone.ts (new)
  - packages/shared-types/src/index.ts
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - apps/simulation-server/src/physics/world.ts
  - apps/simulation-server/src/physics/sensors.ts (or new projectile-sensors.ts)
  - packages/game-rules/src/systems/zones.ts (new)
  - packages/game-rules/src/systems/projectiles.ts (new)
  - packages/game-rules/src/balance.ts (PROJECTILE_SPEED_PX_S, PROJECTILE_MAX_RANGE_PX)
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/host-client/src/screens/DungeonScreen.tsx (Task 4 only)
  - tests/unit/zones.test.ts (new), tests/unit/projectiles.test.ts (new)

Blocked paths:
  - Any specific ability's `CLASS_DEFINITIONS`/`dispatchAbility` wiring to
    actually fire a projectile or place a zone — that's Story 3.19 (Blood
    Spike, Void Pulse) and Story 3.20 (Storm Eye)
  - packages/game-rules/src/systems/displacement.ts — Story 3.14, separate
  - apps/mobile-controller/**

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.13" section
  - apps/simulation-server/src/physics/world.ts (read fully)
  - apps/simulation-server/src/physics/sensors.ts (read fully)
  - apps/simulation-server/src/rooms/GameRoom.ts: contact-listener
    registration (~line 320-360), essence-contact processing block
    (~1096-1122), and full tick-loop structure (search for "Planck phase"
    comments — the tick is explicitly phased, add new phases in the same style)
  - packages/net-protocol/src/apply-delta.ts, messages/server-to-host.ts
  - packages/shared-types/src/game-state.ts (GameState shape to extend)

Non-goals:
  - Do not wire any specific ability to spawn a projectile or zone.
  - Do not implement the displacement/pull force itself (Story 3.14) — the
    chaining AC (projectile impact → spawns a zone) only needs the zone to
    exist and tick its *own* declared `effectType`; what `effectType` values
    actually do (beyond damage, which this story implements since it's
    needed for Storm Eye/Void Pulse's damage component) is left as a
    `'pull'` placeholder effectType that Story 3.14 implements the actual
    physics for. Do not build pull physics here.
  - Do not add projectile-vs-boss or zone-vs-boss contact handling — no
    ability in the current spec targets the boss with a projectile/zone.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Ownership hook: 3 areas — flag to user if narrower split preferred.
  - Contract-change hook: TRIGGERED — 4 new DeltaEventMsg variants. Round-trip
    contract tests required for all 4.
  - Simulation-safety hook: TRIGGERED — physics body creation is new hot-path
    surface (a projectile body steps every tick it's alive). Perf sanity:
    projectiles/zones must be destroyed promptly on hit/expiry — no
    unbounded array growth. Deterministic tick test: projectile travel
    distance and zone tick timing must be frame-rate-independent (use
    `DT`/tick-count based checks, matching the existing 30hz-tick
    determinism pattern — no wall-clock `Date.now()` inside game-rules pure
    functions for travel-distance math; `Date.now()` is fine in GameRoom.ts
    itself for `expiresAtMs`/`tickIntervalMs` scheduling, matching existing
    revive-timer style).
  - Client-UX hook: Task 4 — couch readability for the new projectile/zone
    shapes.

Required tests:
  - tests/unit/zones.test.ts — tick reapplication cadence and expiry, pure.
  - tests/unit/projectiles.test.ts — hit/expire resolution, pure; physics
    body creation itself is exercised via a sim-server integration test
    (matching the existing `apps/simulation-server/tests/physics-world.test.ts`
    split — read that file's existing style before adding to it).
  - Contract round-trips for all 4 new delta types.

Telemetry impact: None.
```

---

## Story

As a simulation engineer,
I want projectile bodies that travel and collide, and persistent Zone/Field entities that tick and can be chained from a projectile impact,
so that Blood Spike, Void Pulse, and Storm Eye have the delivery mechanisms their specs require instead of instant hitscan.

---

## Acceptance Criteria

**AC1 — Projectile bodies:**
**Given** `apps/simulation-server/src/physics/world.ts`
**When** a projectile-type ability fires
**Then** `createProjectileBody()` spawns a dynamic planck.js body with `isSensor: true`, velocity along the input direction, and a max travel distance/lifetime from new `balance.ts` constants (`PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`)
**And** the projectile is tracked in `GameState` via a new `ProjectileState[]` array (`id, ownerId, x, y, class, abilityIndex`)

**AC2 — Projectile hit/expire resolution:**
**Given** a projectile's sensor body overlaps an enemy body
**When** the planck.js contact listener fires (same pattern as the existing Spirit Bond proximity sensors)
**Then** the projectile resolves its effect via `combat.ts` exactly once, broadcasts `projectile:hit`, and is removed from `GameState`
**And** a projectile that exceeds its max range/lifetime without a hit is removed with a `projectile:expired` delta and no effect applied

**AC3 — Zone/Field entities:**
**Given** `packages/game-rules/src/systems/zones.ts` (new)
**When** a Zone/Field ability fires — spawned directly (Storm Eye) or chained from a projectile impact (Void Pulse)
**Then** a `ZoneState` entity (`id, ownerId, x, y, radius, effectType, tickIntervalMs, expiresAtMs`) is added to `GameState`, backed by a stationary planck.js sensor body
**And** every `tickIntervalMs`, all bodies overlapping the zone's sensor have the zone's effect reapplied, broadcast as `zone:tick`
**And** when `nowMs >= expiresAtMs`, the zone and its sensor body are removed with `zone:expired`

**AC4 — Declarative projectile→zone chaining:**
**Given** a projectile-impact ability configured to chain into a zone (Void Pulse)
**When** the projectile resolves its hit
**Then** impact damage is applied first, then a `ZoneState` is spawned at the impact position using that ability's zone parameters from `balance.ts` — the chain is declarative per-ability config, not a special-cased branch in the projectile code

**AC5 — Unit tests:**
**Given** unit tests
**When** `tests/unit/zones.test.ts` and `tests/unit/projectiles.test.ts` run
**Then** zone tick reapplication and expiry, and projectile hit/expire resolution, are covered as pure functions; physics body creation itself is exercised via a sim-server integration test, matching the existing `world.ts` test split

---

## Tasks / Subtasks

- [ ] **Task 1a** (AC: #1, #3) — `packages/shared-types/src/projectile.ts` (new):
  `export interface ProjectileState { id: string; ownerId: string; x: number; y: number; class: PlayerClass; abilityIndex: number; }`
  `packages/shared-types/src/zone.ts` (new):
  `export type ZoneEffectType = 'damage' | 'pull'; export interface ZoneState { id: string; ownerId: string; x: number; y: number; radius: number; effectType: ZoneEffectType; tickIntervalMs: number; expiresAtMs: number; }`
  Add both to `index.ts`. Add `projectiles: ProjectileState[]` and `zones: ZoneState[]` to `GameState` (`game-state.ts`).

- [ ] **Task 1b** (AC: #2, #3) — `server-to-host.ts`: add
  `ProjectileHitDelta { type: 'projectile:hit'; projectileId: string; x: number; y: number; }`,
  `ProjectileExpiredDelta { type: 'projectile:expired'; projectileId: string; }`,
  `ZoneTickDelta { type: 'zone:tick'; zoneId: string; }`,
  `ZoneExpiredDelta { type: 'zone:expired'; zoneId: string; }` — add all 4 to `DeltaEventMsg`.
  `apply-delta.ts`: add matching cases removing/no-op'ing per the established
  style (projectiles/zones are removed from their respective `GameState`
  arrays on hit/expiry, mirroring `enemy:killed`'s
  `state.enemies.filter(...)` pattern).

- [ ] **Task 2a** (AC: #1) — `physics/world.ts`: add
  `export const CAT_PROJECTILE = 0x0080;` and `export const CAT_ZONE = 0x0100;`.
  Add `{ type: 'projectile'; projectileId: string }` and
  `{ type: 'zone'; zoneId: string }` to `PhysicsBodyData`.
  `createProjectileBody(world, projectileId, x, y, dirX, dirY, speed)`:
  dynamic body, `isSensor: true`, `filterCategoryBits: CAT_PROJECTILE,
  filterMaskBits: CAT_ENEMY`, initial velocity `Vec2(toMeters(dirX * speed),
  toMeters(dirY * speed))` set via `body.setLinearVelocity`.
  `createZoneBody(world, zoneId, x, y, radiusPx)`: static body, `isSensor:
  true`, `filterCategoryBits: CAT_ZONE, filterMaskBits: CAT_ENEMY |
  CAT_PLAYER` (broadest — Storm Eye only needs `CAT_ENEMY` contacts but Void
  Pulse's pull zone needs both; the zone's `effectType` at the game-rules
  layer decides who's actually affected, not the physics filter).

- [ ] **Task 2b** (AC: #1, REQUIRED, not in epics.md text) — Update
  `createEnemyBody`'s `filterMaskBits: 0` → `filterMaskBits: CAT_PROJECTILE |
  CAT_ZONE` (was 0 — see Context, this is required for any contact to fire
  against enemies at all). Update `createPlayerBody`'s `filterMaskBits:
  CAT_POI | CAT_ESSENCE | CAT_BOND_SENSOR` → add `| CAT_ZONE` (players need
  to be hittable by zones for Void Pulse's pull; players do NOT need
  `CAT_PROJECTILE` — no projectile in the current spec targets players).

- [ ] **Task 2c** (AC: #2, #3) — Contact extractors (in `sensors.ts` or a
  new file, dev agent's call after reading both existing files):
  `extractProjectileEnemyContact(contact): { projectileId, enemyId } | null`
  and a zone-contact extractor following the exact `extractBondSensorContact`
  shape (body-userData lookup, guard on `type`).

- [ ] **Task 3a** (AC: #2) — `packages/game-rules/src/systems/projectiles.ts`
  (new): pure `resolveProjectileHit(projectile, enemy, damage, nowMs)` →
  `Result<{ enemy: EnemyState }, ProjectileError>` (delegates to
  `combat.ts`'s `applyDamage`); pure `isProjectileExpired(projectile,
  spawnX, spawnY, currentX, currentY, maxRangePx)` → boolean (distance check,
  no lifetime-tick approach needed since travel distance is a pure function
  of position — simpler and matches "pure, no I/O" better than a tick
  counter requiring external state).

- [ ] **Task 3b** (AC: #3, #4) — `packages/game-rules/src/systems/zones.ts`
  (new): pure `shouldZoneTick(zone, nowMs, lastTickAtMs)` → boolean; pure
  `isZoneExpired(zone, nowMs)` → boolean. The actual per-tick effect
  reapplication (damage to all overlapping enemies) happens in
  `GameRoom.ts` using the zone's tracked overlapping-bodies set (see Task 3c)
  — `zones.ts` itself doesn't need to know planck.js body positions, only
  timing.

- [ ] **Task 3c** (AC: #1-#4) — `GameRoom.ts` wiring:
  - `pendingProjectileHitContacts: Array<{projectileId, enemyId}> = []` field;
    register in `begin-contact` listener (same style as line ~325-330).
  - New tick phase: for each `ProjectileState`, check `isProjectileExpired`
    (using stored spawn position — add `spawnX`/`spawnY` as GameRoom-local
    tracking, not on the wire `ProjectileState` itself since epics.md's AC1
    doesn't include them in the type) → if expired, destroy body, remove
    from `GameState.projectiles`, broadcast `projectile:expired`.
  - Drain `pendingProjectileHitContacts`: for each, look up the projectile
    and enemy, call `resolveProjectileHit`, apply the returned enemy state,
    broadcast `enemy:damaged`/`enemy:killed` (existing events, reuse them —
    a projectile hit is still a damage event) + `projectile:hit`, destroy
    the projectile body, remove from `GameState.projectiles`. If the
    ability's config declares a chained zone (Task 3d), spawn it here.
  - New tick phase: for each `ZoneState`, check `isZoneExpired` → destroy +
    remove + broadcast `zone:expired`; else check `shouldZoneTick` (track
    `lastTickAtMs` per zone in a GameRoom-local `Map<string, number>`) → if
    due, find all enemy/player bodies currently overlapping the zone's
    sensor (planck's `getFixtureList()`/contact-list, or maintain your own
    `pendingZoneOverlap` set via begin/end-contact like the bond sensor
    pattern — prefer the begin/end-contact set approach since it matches
    this codebase's established pattern instead of querying planck
    directly), apply `effectType === 'damage'` via `combat.ts`, broadcast
    `zone:tick`.

- [ ] **Task 3d** (AC: #4) — Declarative chain config: add an optional
  `chainedZone?: { effectType: ZoneEffectType; radius: number;
  tickIntervalMs: number; durationMs: number }` per-ability entry in
  `balance.ts` (only Void Pulse sets it in Story 3.19; this story just
  builds the mechanism and can leave the config table empty/unused until
  3.19 populates it — do not hardcode "if ability is Void Pulse" as a
  special case in `GameRoom.ts`, read from the declarative table so 3.19
  only needs to add a data entry, not more branching code).

- [ ] **Task 4** (AC: #2, #3) — `DungeonScreen.tsx`: small circle/dot per
  active projectile (from `GameState.projectiles`), translucent circle per
  active zone (from `GameState.zones`) — reuse the existing Map-per-entity
  pattern.

- [ ] Add `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX` to `balance.ts`.
- [ ] Write `tests/unit/projectiles.test.ts`, `tests/unit/zones.test.ts`.
- [ ] Add a sim-server integration test for projectile body creation/travel/
  contact (extend `apps/simulation-server/tests/physics-world.test.ts` or
  add a sibling file matching its existing style).
- [ ] Add contract round-trip tests for all 4 new delta types.
- [ ] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

---

## Dev Notes

### Why the filter-bit fix in Task 2b is not optional

Read `world.ts`'s `createEnemyBody` comment literally: `filterMaskBits: 0,
// combat is hit-scan; no contact callbacks needed`. That was TRUE when
written (Story 3.1) and stayed true through 3.10 — every ability to date is
hit-scan. This story is what makes it false. Skipping this edit produces a
projectile system that compiles, has no runtime errors, and simply never
detects a hit — the worst kind of bug (silent, not a crash) because
`extractProjectileEnemyContact` will just never be called by planck. Verify
this fix by writing the sim-server integration test (Task above) with a
projectile actually crossing an enemy body and asserting the contact fires.

### `ProjectileState`/`ZoneState` deliberately omit some GameRoom-local bookkeeping

Epics.md's AC1 lists `ProjectileState`'s fields exactly as `(id, ownerId, x,
y, class, abilityIndex)` — no `spawnX`/`spawnY`, no `dirX`/`dirY`. Travel-
distance expiry needs a spawn reference point; keep that as GameRoom-local
state (e.g. a parallel `Map<string, {x: number; y: number}>`) rather than
adding fields to the wire-visible `ProjectileState`, since the host doesn't
need spawn position to render a projectile (it renders current `x, y`
verbatim like every other entity). This keeps the wire type exactly matching
the epics spec while still letting the sim track what it needs internally.

### Project Context Rules

- **planck.js rule** (project-context.md): "Always construct `Vec2` — never
  destructure to `{x, y}` and pass back in." Applies directly to
  `createProjectileBody`'s velocity-setting code.
- **Tick loop hygiene**: no `logger.info` in the per-tick projectile/zone
  scan; `logger.debug` only if any logging is added.
- **Result<T, E>**: `resolveProjectileHit` and any other game-rules function
  added here returns `Result`, never throws.
- **Contract-change hook**: real — 4 new delta types, round-trip tests
  required for each.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.13]
- [Source: apps/simulation-server/src/physics/world.ts] — body-factory + filter-bit pattern
- [Source: apps/simulation-server/src/physics/sensors.ts] — sensor-contact extractor pattern
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:320-360, 1096-1122] — contact-listener registration + essence-contact processing (the pattern to replicate)
- [Source: packages/net-protocol/src/apply-delta.ts] — exhaustiveness-guarded switch
- [Source: apps/simulation-server/tests/physics-world.test.ts] — existing sim-server physics test style

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---
baseline_commit: f6083d8
---

# Story 3.13: Projectile Physics & Zone/Field Entities

Status: done

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

- [x] **Task 1a** (AC: #1, #3) — `packages/shared-types/src/projectile.ts` (new):
  `export interface ProjectileState { id: string; ownerId: string; x: number; y: number; class: PlayerClass; abilityIndex: number; }`
  `packages/shared-types/src/zone.ts` (new):
  `export type ZoneEffectType = 'damage' | 'pull'; export interface ZoneState { id: string; ownerId: string; x: number; y: number; radius: number; effectType: ZoneEffectType; tickIntervalMs: number; expiresAtMs: number; }`
  Add both to `index.ts`. Add `projectiles: ProjectileState[]` and `zones: ZoneState[]` to `GameState` (`game-state.ts`).

- [x] **Task 1b** (AC: #2, #3) — `server-to-host.ts`: add
  `ProjectileHitDelta { type: 'projectile:hit'; projectileId: string; x: number; y: number; }`,
  `ProjectileExpiredDelta { type: 'projectile:expired'; projectileId: string; }`,
  `ZoneTickDelta { type: 'zone:tick'; zoneId: string; }`,
  `ZoneExpiredDelta { type: 'zone:expired'; zoneId: string; }` — add all 4 to `DeltaEventMsg`.
  `apply-delta.ts`: add matching cases removing/no-op'ing per the established
  style (projectiles/zones are removed from their respective `GameState`
  arrays on hit/expiry, mirroring `enemy:killed`'s
  `state.enemies.filter(...)` pattern).

- [x] **Task 2a** (AC: #1) — `physics/world.ts`: add
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

- [x] **Task 2b** (AC: #1, REQUIRED, not in epics.md text) — Update
  `createEnemyBody`'s `filterMaskBits: 0` → `filterMaskBits: CAT_PROJECTILE |
  CAT_ZONE` (was 0 — see Context, this is required for any contact to fire
  against enemies at all). Update `createPlayerBody`'s `filterMaskBits:
  CAT_POI | CAT_ESSENCE | CAT_BOND_SENSOR` → add `| CAT_ZONE` (players need
  to be hittable by zones for Void Pulse's pull; players do NOT need
  `CAT_PROJECTILE` — no projectile in the current spec targets players).

- [x] **Task 2c** (AC: #2, #3) — Contact extractors (in `sensors.ts` or a
  new file, dev agent's call after reading both existing files):
  `extractProjectileEnemyContact(contact): { projectileId, enemyId } | null`
  and a zone-contact extractor following the exact `extractBondSensorContact`
  shape (body-userData lookup, guard on `type`).

- [x] **Task 3a** (AC: #2) — `packages/game-rules/src/systems/projectiles.ts`
  (new): pure `resolveProjectileHit(projectile, enemy, damage, nowMs)` →
  `Result<{ enemy: EnemyState }, ProjectileError>` (delegates to
  `combat.ts`'s `applyDamage`); pure `isProjectileExpired(projectile,
  spawnX, spawnY, currentX, currentY, maxRangePx)` → boolean (distance check,
  no lifetime-tick approach needed since travel distance is a pure function
  of position — simpler and matches "pure, no I/O" better than a tick
  counter requiring external state).

- [x] **Task 3b** (AC: #3, #4) — `packages/game-rules/src/systems/zones.ts`
  (new): pure `shouldZoneTick(zone, nowMs, lastTickAtMs)` → boolean; pure
  `isZoneExpired(zone, nowMs)` → boolean. The actual per-tick effect
  reapplication (damage to all overlapping enemies) happens in
  `GameRoom.ts` using the zone's tracked overlapping-bodies set (see Task 3c)
  — `zones.ts` itself doesn't need to know planck.js body positions, only
  timing.

- [x] **Task 3c** (AC: #1-#4) — `GameRoom.ts` wiring:
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

- [x] **Task 3d** (AC: #4) — Declarative chain config: add an optional
  `chainedZone?: { effectType: ZoneEffectType; radius: number;
  tickIntervalMs: number; durationMs: number }` per-ability entry in
  `balance.ts` (only Void Pulse sets it in Story 3.19; this story just
  builds the mechanism and can leave the config table empty/unused until
  3.19 populates it — do not hardcode "if ability is Void Pulse" as a
  special case in `GameRoom.ts`, read from the declarative table so 3.19
  only needs to add a data entry, not more branching code).

- [x] **Task 4** (AC: #2, #3) — `DungeonScreen.tsx`: small circle/dot per
  active projectile (from `GameState.projectiles`), translucent circle per
  active zone (from `GameState.zones`) — reuse the existing Map-per-entity
  pattern.

- [x] Add `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX` to `balance.ts`.
- [x] Write `tests/unit/projectiles.test.ts`, `tests/unit/zones.test.ts`.
- [x] Add a sim-server integration test for projectile body creation/travel/
  contact (extend `apps/simulation-server/tests/physics-world.test.ts` or
  add a sibling file matching its existing style).
- [x] Add contract round-trip tests for all 4 new delta types.
- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

### Review Findings

Reviewed by 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against AC1-AC5. 5 patch findings, all applied; 6 deferred (real but out of scope — see `deferred-work.md`); 9 dismissed as noise/false-positive/matching-spec.

- [x] [Review][Patch] Projectile position was never synced back from the planck body into `GameState.projectiles.x/y` each tick — broke AC2's range-expiry check and would freeze host-rendered position at spawn. Fixed: added a "Planck phase 3b" readback loop in `GameRoom.ts`'s tick(), mirroring the existing player-position readback. [`apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Review][Patch] Enemy's physics body was never destroyed when killed by a projectile hit (unlike the ability hit-scan and zone-tick kill paths in the same diff) — leaked a `CAT_ENEMY` body that would keep generating contacts for the rest of the level. Fixed: destroy + remove from `enemyBodies` in the projectile-hit kill branch. [`apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Review][Patch] Projectile kills never dropped Spirit Essence, inconsistent with every other kill path (ability hit-scan, zone-tick). Fixed: `resolveProjectileHit` now surfaces `essenceDrop` from `applyDamage`'s result (additive to its return shape); `GameRoom.ts`'s kill branch pushes the drop, creates its sensor body, and broadcasts `essence:dropped`. [`packages/game-rules/src/systems/projectiles.ts`, `apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Review][Patch] `spawnChainedZone`'s zone id (`zone-{tick}-{ownerId}`) collided if one owner triggered 2+ chained zones in the same tick, silently orphaning the first zone's physics body. Fixed: added a `nextZoneSeq` monotonic counter to guarantee uniqueness. [`apps/simulation-server/src/rooms/GameRoom.ts`]
- [x] [Review][Patch] `packages/net-protocol/src/index.ts` never re-exported the 4 new delta types (`ProjectileHitDelta`, `ProjectileExpiredDelta`, `ZoneTickDelta`, `ZoneExpiredDelta`) — found via typecheck failure during review verification, not by a review layer. Fixed: added to the package's public type export list. [`packages/net-protocol/src/index.ts`]
- [x] [Review][Defer] Projectile sensor radius (12px) vs. host-rendered dot radius (8px) mismatch [`apps/simulation-server/src/physics/world.ts`, `apps/host-client/src/screens/DungeonScreen.tsx`] — deferred, pre-existing free tuning knob, no AC governs exact radii (see `deferred-work.md` D-3.13-A)
- [x] [Review][Defer] Projectiles pass through level geometry — no wall category in the mask [`apps/simulation-server/src/physics/world.ts`] — deferred, out of AC scope, matches existing player/enemy wall-collision scope (see `deferred-work.md` D-3.13-B)
- [x] [Review][Defer] Zone overlap tracking loses target type (enemy vs. player) at capture [`apps/simulation-server/src/rooms/GameRoom.ts`] — deferred, harmless while only 'damage' (enemies-only) exists; Story 3.14's 'pull' will need a typed key; marked in-code with a `ponytail:` comment (see `deferred-work.md` D-3.13-C)
- [x] [Review][Defer] No validation guards a non-positive `tickIntervalMs` in `ABILITY_CHAINED_ZONE` [`packages/game-rules/src/balance.ts`] — deferred, unreachable while the config table is all-null (see `deferred-work.md` D-3.13-D)
- [x] [Review][Defer] `DungeonScreen.tsx`'s new projectile/zone Graphics refs aren't cleared on unmount [`apps/host-client/src/screens/DungeonScreen.tsx`] — deferred, pre-existing pattern shared by every other Graphics-map ref in this file, not a regression (see `deferred-work.md` D-3.13-E)
- [x] [Review][Defer] Essence-drop id naming inconsistent between the projectile-hit path and the zone-tick-kill path [`packages/game-rules/src/systems/projectiles.ts`, `apps/simulation-server/src/rooms/GameRoom.ts`] — deferred, cosmetic only, both schemes are unique in their own context (see `deferred-work.md` D-3.13-F)

Dismissed as noise/false-positive/matching-spec (9): "no ability spawns a projectile" (by design, Non-goals), no direction-vector normalization in `createProjectileBody` (matches existing caller-normalizes convention), `ProjectileState.class` unused in host rendering (matches literal AC1 field spec), `abilityIndex as 0|1|2|3` unsafe casts (matches existing `dispatchAbility` convention), "accidental executable bit" on new files (false positive — `core.fileMode=false`, confirmed via `git diff --summary` showing no mode change), unconditional `zone:tick` broadcast (matches AC3's literal "every tickIntervalMs... broadcast" wording), "`resetToHub` not modified" (false positive — confirmed by direct read, it was modified), "ghost projectile" on converging-projectile double-kill (correct behavior — it expires via distance check once position sync was restored), unused `zoneDamagePerTick` capture for `'pull'` zones (harmless, not worth extra branching).

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` — 0 errors (both suites: shared-types/net-protocol/game-rules/simulation-server, and host-client/mobile-controller).
- `npx vitest run` — first full run showed 3 e2e suite failures (`tests/e2e/full-run.test.ts`, `tests/e2e/reconnect.test.ts`, a stale worktree's `e2e-join.test.ts`); a second full run passed clean (439 passed, 0 failed, 7 skipped), confirming the failures were parallel-worker port-contention flakiness pre-existing in the e2e harness, not caused by this story's changes (individually run, `full-run.test.ts` also passes/skips cleanly).
- `npm run lint` (repo-wide) — pre-existing ~275 errors across untouched files (`_bmad/wds/scripts/*.js` `no-undef`, and a repo-wide missing Node/browser-globals ESLint env gap causing `no-undef` on `process`/`setTimeout`/`window`/etc. in files never touched by this story). Scoped `eslint` on every file this story touched found one real issue — an unused `createProjectileBody` import in `GameRoom.ts` (imported preemptively, but no ability spawns a projectile in this story per Non-goals) — fixed by removing the import. Re-scoped run confirmed zero new lint errors from this story's edits.

### Completion Notes List

- **Contract-change hook (TRIGGERED per persistent facts)** — 4 new `DeltaEventMsg` variants added (`projectile:hit`, `projectile:expired`, `zone:tick`, `zone:expired`) in `packages/net-protocol/src/messages/server-to-host.ts`, plus new `ProjectileState`/`ZoneState` types and `GameState.projectiles`/`.zones` fields in `packages/shared-types`. Compatibility checklist:
  - ✅ All 4 new delta types have round-trip serialize/deserialize contract tests (`tests/contract/net-protocol.test.ts`, "Story 3.13 projectile/zone delta round-trips").
  - ✅ `apply-delta.ts`'s exhaustiveness guard (`const _exhaustive: never = evt`) forced a `case` for all 4 — verified by `npm run typecheck` passing.
  - ✅ Additive-only: no existing delta type or `GameState` field changed shape; `GameState.projectiles`/`.zones` are new required arrays, so every existing test/mock fixture that constructs a full `GameState` literal was updated (7 sites: `GameRoom.ts`'s `createEmptyGameState`, and 6 test fixtures across `apps/simulation-server/tests/`, `packages/game-rules/tests/unit/`, and `tests/unit|contract/`).
  - ⚠️ **Protocol Architect review required** before merge, per the ownership hook — this story's Task 1 work spans `packages/shared-types/**` and `packages/net-protocol/**`.
  - No ADR/spec update made — this is additive engine-capability plumbing consumed by future stories (3.19/3.20), not a change to an existing contract's meaning.
- **Ownership hook** — this story is explicitly Multi-context per its own header (Protocol Architect: Task 1; Simulation Engineer: Task 2/3; Host Experience Engineer: Task 4). All edits stayed within the `Allowed paths` list; no cross-context approval beyond what the story itself pre-authorized was needed.
- **Simulation-safety hook** — `createProjectileBody`/`createZoneBody` are sensor bodies (`isSensor: true`), so they add no collision-response cost, only contact-event generation; travel-distance/zone-tick timing use `DT`/`tickNowMs` (frame-rate-independent), not tick counters, matching the deterministic-tick pattern. Projectiles/zones are destroyed and removed from their arrays immediately on hit/expiry/zone-expiry — no unbounded growth. All new `GameRoom.ts` tick-phase loops are guarded by `this.gameState.projectiles`/`.zones` being empty arrays in this story (no ability spawns either yet, per Non-goals), so they run as correctly-shaped no-ops until Story 3.19/3.20 wire an ability to populate them.
- **Deviations from the story's literal text** (both are simplifications, not scope changes):
  - `isProjectileExpired`'s signature drops the redundant `currentX`/`currentY` params the story text listed alongside `projectile` — `ProjectileState` already carries `x`/`y` as the current position, so passing both was duplicate data. Implemented as `isProjectileExpired(projectile: Pick<ProjectileState, 'x'|'y'>, spawnX, spawnY, maxRangePx)`.
  - `createProjectileBody`'s fixture radius (12px) and `createZoneBody`'s were not specified numerically by the story (only fixture *behavior* was specified) — chose a reasonable value; not exercised by any exact-value AC or test assertion beyond "does it detect contact," so this is a free tuning knob for 3.19/3.20 to adjust.
  - Zone per-tick damage amount and the chained-zone's damage aren't fields on the wire-visible `ZoneState`/`ChainedZoneConfig` (matching the story's own rationale for why `ProjectileState` omits `spawnX`/`spawnY` — keep it GameRoom-local); tracked via a new GameRoom-local `Map<string, number>` (`zoneDamagePerTick`), populated at zone-creation time from `ABILITY_DAMAGE[ownerClass][abilityIndex]`, the same table used for projectile-hit damage.
- **Non-goals honored**: no ability's `CLASS_DEFINITIONS`/`dispatchAbility` wiring was touched to actually fire a projectile or place a zone; `displacement.ts` (3.14) was not created; no projectile/zone contact handling was added for the boss body. `ABILITY_CHAINED_ZONE` is populated with all-`null` entries for every class/ability — inert until 3.19 sets Void Pulse's entry.
- Confidence: 90% — the physics contact-firing logic (the story's flagged "silent bug" risk area) is directly covered by a dedicated regression test in `physics-world.test.ts` that would fail if the `createEnemyBody` mask fix were reverted. The 10% uncertainty is in two judgment calls with no AC or test to pin them down exactly: the projectile/zone fixture radii (cosmetic/tuning-only), and where "zone damage per tick" should live given `ZoneState`'s literal fields have no damage field (resolved via a GameRoom-local map mirroring the story's own stated rationale for `ProjectileState`'s spawn-position bookkeeping).

### File List

- `packages/shared-types/src/projectile.ts` (new)
- `packages/shared-types/src/zone.ts` (new)
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/game-state.ts`
- `packages/net-protocol/src/messages/server-to-host.ts`
- `packages/net-protocol/src/apply-delta.ts`
- `packages/net-protocol/src/index.ts` (added during review — the 4 new delta types weren't re-exported)
- `apps/simulation-server/src/physics/world.ts`
- `apps/simulation-server/src/physics/sensors.ts`
- `packages/game-rules/src/systems/projectiles.ts` (new)
- `packages/game-rules/src/systems/zones.ts` (new)
- `packages/game-rules/src/balance.ts`
- `packages/game-rules/src/index.ts`
- `apps/simulation-server/src/rooms/GameRoom.ts`
- `apps/host-client/src/screens/DungeonScreen.tsx`
- `tests/unit/projectiles.test.ts` (new)
- `tests/unit/zones.test.ts` (new)
- `apps/simulation-server/tests/physics-world.test.ts`
- `tests/contract/net-protocol.test.ts`
- `apps/simulation-server/tests/game-room-host-join.test.ts` (GameState mock fixture — added `projectiles`/`zones` fields)
- `tests/contract/player-class-updated-delta.test.ts` (GameState mock fixture)
- `packages/game-rules/tests/unit/achievements.test.ts` (GameState mock fixture)
- `packages/game-rules/tests/unit/grassland-boss.test.ts` (GameState mock fixture)
- `tests/unit/bonds.test.ts` (GameState mock fixture)

## Change Log

- 2026-07-13 — Implemented Story 3.13: projectile physics bodies, Zone/Field entities, contact-resolution plumbing, and the 4 new delta events (`projectile:hit`, `projectile:expired`, `zone:tick`, `zone:expired`). Fixed the pre-existing `createEnemyBody`/`createPlayerBody` filter-mask bug that would have silently prevented any projectile/zone contact from ever firing. Added declarative `ABILITY_CHAINED_ZONE` config table (all-null) for Story 3.19's projectile→zone chaining. No ability wired to spawn a projectile or zone (per Non-goals) — pure engine-capability story.
- 2026-07-13 — Code review (3 parallel layers vs. AC1-AC5): fixed 5 real bugs — projectile position never synced back from its physics body into `GameState` (broke AC2's expiry check), enemy physics body leaked on projectile-kill, projectile kills never dropped Spirit Essence, chained-zone id collision on same-tick double-hits, and a missing `packages/net-protocol` re-export of the 4 new delta types (typecheck failure, caught during fix verification). Deferred 6 out-of-scope findings to `deferred-work.md` (D-3.13-A through F). Dismissed 9 as noise, false-positive, or already spec-compliant. Re-ran `npm run typecheck` + `npx vitest run` (441 passed, 0 failed, 7 skipped) + scoped `eslint` after fixes — all clean.

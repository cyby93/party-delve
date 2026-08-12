---
baseline_commit: f5b9748
---

# Story 7.15b: Aim-Preview Resolution

Status: done

## Carried in from Story 7.15a's code review (2026-08-05)

Three findings were raised during 7.15a's review that could not be fixed there (`apps/simulation-server/**` is a Blocked path for a contract story) and were explicitly deferred to this story. They are requirements here, not suggestions:

1. **[High] Add an `InputEvent` exhaustiveness guard.** A repo-wide search for `: never` returns exactly two hits — `apply-delta.ts` (`DeltaEventMsg`) and a `BossEvent` guard in `GameRoom.ts`. Nothing covers `InputEvent`, so every consumer is a negative filter (`=== 'joystick'`, `!== 'ability' → continue`) that silently drops an unhandled variant. The delta half of the aim-preview contract self-reports when a consumer is missed; the input half does not. Add a `default: { const _e: never = msg.event; void _e; }` to the tick drain so the next `InputEvent` variant cannot be added without the sim noticing.
2. **[Medium] Guard non-finite directions.** `serialize`/`deserialize` are bare JSON, and `JSON.stringify({ x: NaN })` produces `{"x":null}` — so a client normalizing a zero-length drag (`0/0`) puts `null` on the wire in a field typed `number`, and `deserialize` is an unchecked cast. Use the NaN-safe idiom the fire path already uses (`!(Math.hypot(dx, dy) > 0)`), never `=== 0`, which both `NaN` and `null` pass. The invariant is now documented on both types in `packages/shared-types/src/input.ts` and `packages/net-protocol/src/messages/server-to-host.ts`, and pinned by a contract test.
3. **[Medium] Decide broadcast-to-all vs. send-to-host-only, and record the reasoning.** ADR-0008 says "Server → all clients (broadcast delta)", but `mobile-session.ts` has no delta-type filter, so at ~33ms cadence with 8 players every phone would receive up to ~240 msg/s of other players' aim streams purely to ignore them. The ADR's Negative section assessed only the host-side cost and missed the phone-side multiplication. Only the host renders this preview.

Also binding, from the same review: **`ability:fired`'s direction is not guaranteed to be a unit vector** — `dispatchAbility` passes the caster's raw vector through and normalization happens per-delivery-branch inside `GameRoom`. AC2's "same math as cast time" therefore requires this story to normalize explicitly; it is load-bearing, not defensive.

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. **Blocked by Story 7.15a**
  (the `InputEvent` variant and the `ability:aim-preview` delta type must exist
  before this story can consume or emit them). No dependency on 7.15c or 7.15d
  — all three are siblings off 7.15a. No relationship to Stories 7.14a/7.14b.

Context: ADR-0008 (Accepted) decided that the sim, not the host, computes the
  preview's destination point, using the *same* geometry/delivery math already
  used at real cast time — never a duplicated formula. That single rule is the
  reason this story exists as sim work rather than host work: ADR-0003's
  motivating drift bug (D-7.2-A) was exactly a host-side re-derivation of
  placement math falling out of sync with the sim's.

  Two input sources feed the broadcast:
  - `RELEASE`-type abilities: the new `input:aim-preview` event from Story
    7.15d, arriving on the existing `EventNames.INPUT` transport at ~33ms.
  - `AUTO`/`AIM_CAST` abilities: their EXISTING continuous-fire `ability` input
    (`ControllerScreen.tsx:696-714` fires every 33ms while held), which already
    carries a live direction. No new client signal is needed for these — the
    sim sources the preview from the stream it already receives. This is
    ADR-0008's "nearly free once the broadcast/render side lands" claim, and it
    is the reason 7.15d touches only `RELEASE`.

  The destination point for all four named abilities is the SAME expression the
  sim already uses at cast time: `caster + normalizedDirection × hitRangePx`.
  It appears today in two places — `isInHitZone`'s directional branch
  (`packages/game-rules/src/systems/combat.ts:53-58`, `cx = playerX + dirX *
  hitRangePx`) and the zone-delivery placement branch (`GameRoom.ts:2499-2500`,
  `zoneX = player.x + normDirX * hitRange`). Extracting one helper and using it
  from both the real cast path and the preview path is what makes drift
  structurally impossible, and is the acceptance bar for "no duplicated formula".

Owner: Simulation Engineer (CLAUDE.md Ownership Rules).

Goal: Compute and broadcast a throttled, non-mutating `ability:aim-preview`
  delta for every aiming player, carrying the live direction and — for the four
  named abilities — the would-be target point, derived from the same math the
  real cast uses.

Allowed paths:
  - apps/simulation-server/**
  - packages/game-rules/**
  - tests/unit/**  (this story's required coverage)

Blocked paths:
  - packages/shared-types/**   (7.15a owns the contract; consume it read-only)
  - packages/net-protocol/**   (same)
  - apps/host-client/**        (that is Story 7.15c)
  - apps/mobile-controller/**  (that is Story 7.15d)
  - apps/backend-platform/**

Inputs:
  - docs/adr/ADR-0008-aim-preview-contract.md (Decision + Consequences)
  - apps/simulation-server/src/rooms/GameRoom.ts:115, :341-353, :920, :1623-1630,
    :2367-2765, :2884-2912 (input queue lifecycle and the two existing drain
    loops; :2912 is where the queue is cleared — read the WARNING at :1624-1625)
  - apps/simulation-server/src/rooms/GameRoom.ts:2492-2520 (the zone-delivery
    placement branch — one of the two existing sites of the placement formula)
  - packages/game-rules/src/systems/combat.ts:42-63 (`isInHitZone` — the other)
  - packages/shared-types/src/ability-geometry.ts:49-74 (`ABILITY_GEOMETRY`:
    Stone Wall 160, Crimson Lash 180, Dark Pact 180, Storm Eye 160)
  - packages/shared-types/src/class-definitions.ts:18-67 (`inputType` per ability)
  - apps/simulation-server/src/rooms/GameRoom.ts:1361-1370 (`handleDarkPact` —
    its `gatherPlayersInHitZone(caster.x, caster.y, normDirX, normDirY, …)`
    call is Dark Pact's real "where does this land" expression)
  - tests/unit/targeting.test.ts, tests/unit/storm-eye.test.ts (existing
    placement/geometry test style to follow)

Non-goals:
  - NO contract change. `packages/shared-types` and `packages/net-protocol` are
    Blocked; consume 7.15a's types read-only.
  - NO rendering (Story 7.15c).
  - NO mobile change (Story 7.15d).
  - NO `GameState` mutation, no PRNG use, no physics body, no tick-order change.
  - NO new balance/geometry value. The preview must read `ABILITY_GEOMETRY`
    live; hand-copying 160/180 into a preview-specific constant is the exact
    failure mode this story exists to prevent.
  - NO cooldown, resource, or validity gating on the preview. A preview is a
    presentation signal, not a promise the cast will succeed — but see the
    "Honesty boundary" Dev Note for the one case where that is arguable, and
    resolve it explicitly rather than silently.

Required hooks:
  - **Simulation-safety hook (TRIGGERED)** — `apps/simulation-server/**` and
    possibly `packages/game-rules/**` are touched. Required before merge:
    `npm run typecheck`, unit tests, deterministic tick test, replay test if
    available, and a basic perf sanity check.
      * The deterministic-tick test's mutation assertions must remain green
        *unchanged* — this delta is explicitly exempt in the sense that it
        mutates nothing, so it should require no test change at all. If the
        deterministic-tick test needs modifying, that is a signal the
        implementation is mutating something it shouldn't. Treat a required
        change there as a bug, not as a test to update.
      * Perf sanity check (state the numbers in Completion Notes): at most one
        additional broadcast per aiming player per tick, bounded by MAX_PLAYERS
        (8, `packages/shared-types/src/constants.ts`) — i.e. ≤8 extra small
        JSON payloads per 33ms tick in the worst case where every player aims
        simultaneously. Compare against the existing per-tick `player:moved`
        broadcast volume, which is already one per moving player per tick.
  - Contract-change hook: NOT triggered (consumes 7.15a's types, adds none).
  - Client-UX hook: NOT triggered (no host/mobile edit).
  - Ownership hook: NOT triggered (single owner).
  - Telemetry hook: no new user flow.

Required tests (tests/unit/):
  - For EACH of Storm Eye, Stone Wall, Dark Pact, Crimson Lash: the preview
    target computed for a given (casterX, casterY, dirX, dirY) equals the point
    the real cast path resolves for the same inputs. Assert against the real
    path's own expression, not a re-typed literal.
  - Non-unit direction input (e.g. `(3, 4)`) normalizes identically in both
    paths — the preview must not skip normalization the cast performs.
  - Zero-aim `(0, 0)`: no target is produced (and, per the SILENT rule the
    whole Epic 7 layer relies on, ideally no preview is broadcast at all —
    decide and document, see Dev Notes).
  - An `AUTO` ability (e.g. Lightning Arc) produces a direction-only preview
    with no `targetX`/`targetY`.
  - Throttle: N `aim-preview` inputs from one player inside one tick produce
    exactly ONE broadcast, carrying the latest direction.

Telemetry impact: None.
```

---

## Story

As a Simulation Engineer,
I want the sim to compute and broadcast each aiming player's live direction and, for the destination-preview abilities, their would-be target point,
so that the host can render an honest preview that can never drift from where the ability will actually land.

---

## Acceptance Criteria

**AC1 — `RELEASE`-type aim previews resolve from the new input:**
**Given** a player sends `input:aim-preview` (7.15a's `InputEvent` variant) for a `RELEASE`-type ability
**When** `GameRoom.ts` drains the input queue that tick
**Then** it broadcasts one `ability:aim-preview` delta for that player, carrying `playerId`, `abilityIndex`, and the normalized `directionX`/`directionY`

**AC2 — destination point uses the real cast-time math, not a copy:**
**Given** the four destination-preview abilities — Storm Eye (`stormcaller[3]`), Stone Wall (`stonehide[0]`), Dark Pact (`souldrinker[2]`), Crimson Lash (`souldrinker[1]`)
**When** their preview is computed
**Then** `targetX`/`targetY` come from a **single shared expression that the real cast path also calls** — `caster + normalizedDirection × ABILITY_GEOMETRY[class][index].hitRangePx`, read live from `ABILITY_GEOMETRY`
**And** the existing cast-time sites are refactored onto that shared expression rather than left as parallel copies: the zone-delivery placement at `GameRoom.ts:2499-2500` and, where practical, `isInHitZone`'s directional centre (`combat.ts:53-58`)
**And** a unit test asserts preview target == real cast placement for identical inputs, per ability

**AC3 — `AUTO`/`AIM_CAST` previews need no new client signal:**
**Given** `AUTO` and `AIM_CAST` abilities already stream a live direction every ~33ms through their existing continuous-fire `ability` input
**When** this story ships
**Then** the sim broadcasts `ability:aim-preview` for those abilities too, sourced from that existing stream — with direction only and no `targetX`/`targetY`, since none of them is a destination-preview ability
**And** no change is made to how those abilities actually fire

**AC4 — presentation-only:**
**Given** this delta is derived and cosmetic
**When** it is computed and broadcast
**Then** it never mutates `GameState`, never calls the PRNG, never creates or touches a planck body, and never alters tick ordering
**And** the deterministic-tick test passes **unmodified**

**AC5 — throttled and bounded:**
**Given** input can arrive faster than the 30hz tick
**When** multiple `aim-preview` events for one player land in the same tick
**Then** exactly one broadcast is emitted for that player that tick, carrying the latest direction — the same "latest entry per player wins" collapse the joystick drain already performs (`GameRoom.ts:1626-1630`)
**And** the perf sanity check in the Required hooks section is performed and its numbers recorded

**AC6 — zero-aim is silent:**
**Given** a zero-magnitude direction, which every cast path in this codebase already rejects (`mag === 0 → continue`, e.g. `:2454`, `:2495`, `handleDarkPact`'s `:1365`)
**When** it arrives as an aim preview
**Then** no `targetX`/`targetY` is produced, and the chosen behaviour for the delta itself (suppress entirely vs. broadcast direction-only) is documented in Completion Notes with its rationale — see the Dev Note; suppressing entirely is the recommendation, matching the SILENT rule

**AC7 — Simulation-safety hook:**
**Given** `apps/simulation-server/**` is touched
**Then** typecheck, unit tests, the deterministic-tick test, a replay test if one exists, and the perf sanity check are all run and recorded in Completion Notes before this story reaches `review`

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #2) — Extract the placement expression into one shared, pure, unit-testable function. Preferred home: `packages/game-rules/` (pure functions, no I/O, no Colyseus, no planck — it qualifies) so both `GameRoom` and any future consumer call the same thing. Signature roughly `resolveAimPoint(casterX, casterY, dirX, dirY, hitRangePx): { x, y } | null` (null on zero magnitude, so the caller cannot forget the guard).
  - [x] Subtask 1.1 — refactor `GameRoom.ts:2494-2500` (zone delivery) onto it.
  - [x] Subtask 1.2 — evaluate refactoring `isInHitZone`'s directional branch (`combat.ts:53-58`) onto it. If the inlining there is load-bearing for hot-path performance, document that decision instead of forcing the change — but say so explicitly rather than leaving the duplication unexplained.
  - [x] Subtask 1.3 — unit-test the shared function directly (normalization, zero-guard, exactness).
- [x] **Task 2** (AC: #1, #5) — `GameRoom.ts`: drain `aim-preview` inputs. Follow the joystick drain's structure (`:1623-1630`): a single pass collapsing to the latest entry per player. **Read the WARNING comment at `:1624-1625` first** — the queue is cleared exactly once at `:2912`, and every drain loop reads it before that; do not add a clear, and do not place the new loop after `:2912`.
- [x] **Task 3** (AC: #1, #2, #6) — `GameRoom.ts`: build and broadcast the delta. Resolve the caster's class from state, look up `ABILITY_GEOMETRY[class][abilityIndex]` and `CLASS_DEFINITIONS[class].abilities[abilityIndex].inputType`, normalize the direction, and attach `targetX`/`targetY` only for the four named abilities. Apply the same eligibility guards the cast path uses for the *player* (`!player || player.class === null || player.isFrozen || player.isDown || player.isSpirit` → skip, `:2373`) — a frozen or downed player is not aiming.
- [x] **Task 4** (AC: #3) — `GameRoom.ts`: source previews for `AUTO`/`AIM_CAST` abilities from the existing `ability` input stream. This is a read of the same queue entries the cast loop already consumes — take care not to double-broadcast when the same tick both previews and fires (decide the ordering and document it: recommendation is that a tick which actually fires does not also emit a preview for that ability, since the fire itself is the more informative signal and `ability:fired` already reaches the host).
- [x] **Task 5** (AC: #2) — `tests/unit/`: per-ability preview-vs-real-placement equality tests for Storm Eye, Stone Wall, Dark Pact, Crimson Lash, plus the normalization and zero-aim cases. Place alongside `targeting.test.ts`/`storm-eye.test.ts`, following their style.
- [x] **Task 6** (AC: #4, #5, #7) — Full Simulation-safety hook run: `npm run typecheck`, `npm test`, deterministic-tick test **unmodified**, replay test if present, perf sanity check with stated numbers. Record all in Completion Notes.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### The one rule that matters most: no second formula

ADR-0008's Consequences section states the reason plainly: "the preview reuses the exact functions that already compute real cast placement, so preview and actual landing spot can never drift apart the way D-7.2-A (ADR-0003's motivating drift bug) did." A preview that computes `caster + dir × 160` in its own new function is *technically* correct today and structurally wrong forever — the next balance change to Storm Eye's range moves the cast and leaves the preview behind, and the bug will look exactly like D-7.2-A did.

The acceptance bar is therefore not "the preview is correct" but "there is only one expression". Task 1 is the story.

### Which four abilities, and why not the other two

Six abilities are `RELEASE`-type. Only four get a destination preview:

| Ability | Class[idx] | `hitRangePx` | `hitShape` | `delivery` | Destination preview? |
|---|---|---|---|---|---|
| Stone Wall | stonehide[0] | 160 | cone (50°) | hitscan | **yes** |
| Crimson Lash | souldrinker[1] | 180 | cone (45°) | hitscan | **yes** |
| Dark Pact | souldrinker[2] | 180 | circle (r 80) | hitscan | **yes** |
| Storm Eye | stormcaller[3] | 160 | circle (r 80) | **zone** | **yes** |
| Void Pulse | souldrinker[3] | 0 | circle | projectile | no — `hitRangePx` is 0; it detonates on projectile contact, so there is no aim-time landing point to preview |
| Tempest Hurl | stormcaller[1] | 200 | circle | projectile | no — a flying body whose real landing point depends on what it hits en route, not on `hitRangePx` |

Do not "helpfully" extend the destination preview to the two projectile abilities. Their landing point is genuinely not knowable at aim time, and a preview that shows one would be the dishonest kind ADR-0003 exists to prevent. Their aim *arrow* still renders (Story 7.15c) — direction is knowable; destination is not.

### Dark Pact is a search, not a placement — resolve this deliberately

Storm Eye/Stone Wall/Crimson Lash all resolve to "a point at `hitRangePx` along the aim". Dark Pact does something different: `handleDarkPact` (`GameRoom.ts:1361-1382`) uses `gatherPlayersInHitZone` centred on that same point (via `isInHitZone`'s directional branch with `hitRadiusPx` 80) and then picks the **nearest candidate ally**. So Dark Pact's true "where does this land" is a *player*, not a point.

Two defensible readings, and this story must pick one and say so:
1. **Preview the search centre** (`caster + dir × 180`). Simple, uses the same shared expression as the others, honest about "this is the region I'm aiming at". Recommended.
2. Preview the actually-selected ally's position. More informative, but requires running the nearest-ally search every preview tick (a real per-tick cost over up to 8 players) and produces a preview that snaps between allies as the aim moves.

Recommendation is (1) — it satisfies AC2's "same math as cast time" (the search centre *is* computed by the shared expression at cast time) at a fraction of the cost. Whichever is chosen, name it in Completion Notes and make the unit test assert against the real cast path's corresponding value.

### Zero-aim: suppress, don't broadcast

Every cast path rejects `mag === 0` before doing anything (`:2454`, `:2495`, `:1365`, and `dispatchAbility` itself). The host's entire Epic 7 layer is built on the matching SILENT rule: when the sim skips, the host renders nothing — not even a flash. A zero-aim preview delta would hand the host a signal for a state in which nothing would happen, and 7.15c would then have to invent its own suppression. Suppress at the source. Document the choice explicitly (AC6) so 7.15c can rely on it.

### Throttling: the tick already is the throttle

Input arrives at ~33ms and the tick runs at 30hz (33.3ms), so in the steady state each aiming player contributes roughly one queued event per tick anyway. The joystick drain already handles the burst case correctly by collapsing to the latest entry per player (`:1626-1630`) — copy that shape rather than adding a timestamp-based throttle. A timestamp throttle would add per-player state to maintain and clean up on leave, for no gain over the tick boundary the sim already has.

### Do not gate the preview on cooldown

Tempting, but wrong for this story: a player dragging a `RELEASE` ability that is still on cooldown is genuinely aiming, and the phone's own UI already refuses to start a drag while on cooldown (`ControllerScreen.tsx:680`, `if (isOnCooldownRef.current) return;` in `onTouchStart`). Adding a server-side cooldown gate would duplicate a client-side rule for a cosmetic signal, and would introduce a second place where a cooldown-epoch mismatch (ADR-0004's whole subject) could produce a visible artefact. Leave it ungated and note it.

### `GameState` untouched — how to prove it, not just claim it

The delta carries derived values only; nothing is stored. The concrete checks worth doing and recording:
- No assignment to `this.gameState.*` in any new code path.
- No `this.physicsWorld`, `createZoneBody`, or `createProjectileBody` call.
- No `createRng` / `Math.random()` call.
- The deterministic-tick test passes with **zero edits**. If it needs an edit, something above is false.

### Testing Standards

- Unit tests for pure functions live in `packages/game-rules/tests/` and `apps/simulation-server/tests/`; this repo's per-ability geometry tests conventionally live in `tests/unit/` (`targeting.test.ts`, `storm-eye.test.ts`, `lightning-arc.test.ts`, `zones.test.ts`). Follow the latter for the per-ability equality tests and the former if the shared helper lands in `packages/game-rules`.
- Game-rules functions must be testable with zero imports from Colyseus or planck.js — a hard requirement if Task 1's helper lands there.
- Never throw from game-rules; return a value (here, `null` on zero magnitude) rather than an exception.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase): `apps/host-client/src/vfx/ability-vfx.test.ts` Stone Wall centering; the intermittent Ancestor's Voice e2e heal assertion in `tests/e2e/ability-dispatch.test.ts`; WSL2 e2e port-binding timeouts.

### Project Structure Notes

- Expected production diff: `apps/simulation-server/src/rooms/GameRoom.ts` plus one new/edited file under `packages/game-rules/src/` for the shared helper. Anything touching `packages/shared-types` or `packages/net-protocol` means 7.15a was incomplete — stop and route it back there rather than editing a Blocked path.
- `ABILITY_GEOMETRY` is already imported by `GameRoom.ts`; no new import boundary is crossed.

### Project Context Rules

- **Tick Loop Hygiene**: forbidden inside the tick — `logger.info`/`warn`/`error` (use `logger.debug`, and sparingly, since this path runs per aiming player per tick), heap allocations in hot paths (pre-allocate/reuse where the delta construction allows), and `JSON.parse`/`JSON.stringify` (serialization happens at the message boundary).
- **PRNG**: no `Math.random()` anywhere in sim code; this story needs no randomness at all.
- **Authority model**: the sim is the sole authority — this story keeps the *computation* of the preview target server-side precisely so the host never re-derives it.
- **Configuration hierarchy**: geometry belongs in `packages/shared-types/src/ability-geometry.ts`; do not add a preview-specific constant anywhere.
- **Result<T, E>**: game-rules functions return `Result`/a value and never throw.
- **planck.js**: not involved; do not construct a `Vec2` or a body for a cosmetic signal.

### References

- [Source: `docs/adr/ADR-0008-aim-preview-contract.md`] — Decision (server→clients delta, the "same math" rule) and Consequences (the D-7.2-A drift argument).
- [Source: `docs/adr/ADR-0003-ability-presentation-contract.md`] — the honesty framing this extends.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:115`, `:341-353`, `:920`, `:1623-1630`, `:2367-2765`, `:2884-2912`] — input queue lifecycle and drain loops; `:1624-1625` is the ordering WARNING, `:2912` the single clear.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2373`] — the player-eligibility guard to mirror.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2492-2520`] — zone-delivery placement (`zoneX = player.x + normDirX * hitRange`).
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1361-1382`] — `handleDarkPact`'s nearest-ally search.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1217-1257`] — `gatherPlayersInHitZone` / `isInAbilityHitZone`.
- [Source: `packages/game-rules/src/systems/combat.ts:42-63`] — `isInHitZone`'s directional centre, the second existing copy of the formula.
- [Source: `packages/shared-types/src/ability-geometry.ts:49-74`, `:110-114`] — `ABILITY_GEOMETRY`, `STORM_EYE_ZONE_RADIUS_PX`, `STORM_EYE_PLACEMENT_RANGE_PX`.
- [Source: `packages/shared-types/src/class-definitions.ts:18-67`] — `inputType` per ability.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:680`, `:696-714`] — the continuous-fire stream AC3 sources from, and the client-side cooldown gate.
- [Source: `_bmad-output/implementation-artifacts/7-15a-aim-preview-contract.md`] — the types this story consumes.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.15b section.
- [Source: `_bmad-output/project-context.md`] — Tick Loop Hygiene, PRNG, Authority Model, Package Responsibility Boundaries, Configuration Hierarchy.
- [Source: `CLAUDE.md`] — Ownership Rules, Simulation-safety hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- No implementation failures. `npm run typecheck` clean on the first run after adding the `resolveAimPoint` value import and the `AimPreviewInput`/`AbilityInput` type imports to `GameRoom.ts`.
- `tests/unit/aim-preview.test.ts`: 19/19 on the first run. `tests/e2e/aim-preview.test.ts`: 6/6 on the first run.
- Full-suite note: adding a fourth e2e file increased port contention in the parallel run, so `tests/e2e/hub-ability-use.test.ts` joined `ability-dispatch` and `full-run` in failing with `simulation-server did not start within 60s`. Re-ran it in isolation: **5/5 pass**. This is the documented WSL2 port-binding issue getting more opportunities to fire, not a regression — but it is a real consequence of this story and worth knowing before someone reads the parallel-run output.

### Completion Notes List

- **Task 1 — one expression, three call sites.** New `packages/game-rules/src/systems/aim-point.ts` exports `resolveAimPoint(casterX, casterY, dirX, dirY, hitRangePx): AimPoint | null`, returning the point *and* the normalized direction actually used. Both pre-existing copies of the formula were refactored onto it:
  - `isInHitZone`'s directional branch (`combat.ts`) — the hit circle's centre.
  - `GameRoom`'s zone-delivery placement branch — where Storm Eye's `ZoneState` is spawned.
  This is the acceptance bar AC2 actually sets: not "the preview is correct today" but "there is only one expression, so it cannot drift". Story 7.15b's Dev Notes were explicit that a preview computing `caster + dir × 160` in its own function is correct today and wrong the first time Storm Eye is retuned.
  - *On Subtask 1.2's escape hatch:* the story allowed documenting a decision NOT to refactor `isInHitZone` if the inlining were load-bearing for hot-path performance. It was refactored. `resolveAimPoint` adds one `Math.hypot` and three `Number.isFinite` calls per directional hit-test; the existing call already ran `Math.hypot`-equivalent work at every call site that produced its arguments, and the whole ability suite (413 tests incl. determinism) is unchanged and green. Taking the escape hatch would have left the exact duplication this story exists to remove.
- **`resolveAimPoint` returns `null`, never throws** — per the game-rules no-throw convention. Null covers three cases callers must treat identically: a true zero vector, `NaN` (from a client normalizing a zero-length drag, `0/0`), and `null` arriving from the wire in a field typed `number`. The guard is `Number.isFinite` plus `!(mag > 0)`, deliberately **not** `mag === 0` — `NaN` fails `=== 0` and would pass straight through. There is a dedicated test asserting exactly that asymmetry, because it is the kind of thing a later "simplification" quietly reintroduces.
- **Task 2 — the drain, and the deferred High finding from 7.15a's review.** The joystick drain's `if` became a `switch` over `msg.event.type` with a `default: { const _exhaustive: never = msg.event; }` arm. That closes the asymmetry the Edge Case Hunter found: the `DeltaEventMsg` half of the aim-preview contract self-reports when a consumer is missed (it is what caught the missing `applyDelta` case during 7.15a), while `InputEvent` had no guard anywhere in the repo. A fifth `InputEvent` variant now fails typecheck here until it is handled or explicitly ignored. The `inputQueue` clear was not moved and no second clear was added — the WARNING comment above the drain still holds.
- **Task 3/4 — `broadcastAimPreviews`.** One broadcast per aiming player per tick, sourced from the aim-preview map for `RELEASE` abilities and from the mirrored ability-input map for `AUTO`/`AIM_CAST` (AC3 — no new client signal for those). Applies the same player-eligibility guard the cast path uses (`class === null || isFrozen || isDown || isSpirit` → skip), and skips `TAP` outright since a self-centred ability has no aim to preview.
- **The target rule is declarative, not a list of ability names.** `inputType === 'RELEASE' && delivery !== 'projectile'` selects exactly Stone Wall, Crimson Lash, Dark Pact and Storm Eye today — verified by a test that walks every class/ability in the repo and asserts the selected set. It excludes Void Pulse and Tempest Hurl (projectile-delivery: they resolve on contact, so no aim-time landing point exists) and every `AUTO` ability — notably Lightning Arc, whose real landing point is a corridor-gathered nearest enemy, not `caster + dir × range`, so a destination preview for it would be a lie. A future `RELEASE` hitscan/zone ability is covered with no code change.
- **Dark Pact: previewing the search centre, per the story's recommended option (1).** Its true landing "point" is the nearest ally `handleDarkPact` finds, not the search centre — but the search centre *is* computed by the shared expression at cast time, so option (1) satisfies AC2's "same math as cast time" while avoiding a nearest-ally scan every preview tick for up to 8 players. Option (2) would also produce a preview that snaps between allies as the aim moves.
- **AC6 — zero and non-finite aims are suppressed entirely**, not broadcast direction-only. Recorded as the story asked: suppression is correct because the sim skips such a cast, and broadcasting a signal for a state in which nothing would happen would force 7.15c to invent its own suppression. `resolveAimPoint`'s null return is the single guard covering zero, NaN, and null-from-JSON.
- **Task 4's ordering recommendation was overridden, deliberately.** The story recommended that a tick which actually fires should not also emit a preview. That was written on the assumption — inherited from ADR-0008 — that `AUTO` abilities stream direction every ~33ms while held. **They do not.** The cooldown-sync fix of 2026-07-25 added `if (isOnCooldownRef.current) return;` to `SkillCell`'s auto-interval (`ControllerScreen.tsx`), so an `AUTO` ability sends only when it is actually off cooldown — roughly once per cooldown period (1000ms for Lightning Arc/Blood Spike/Avalanche, 1500ms for Ancestor's Voice), not 30×/second. Suppressing the preview on fire would therefore have meant `AUTO` abilities never previewing at all. `AIM_CAST` (Soul Mend) is unaffected — it channels and carries no cooldown while held, so it really does stream at 33ms.
  - **This is material for Story 7.15c and is flagged rather than buried:** an `AUTO` ability's aim arrow will refresh at its cooldown cadence, i.e. far slower than any sane staleness window, so it will blink rather than persist. Neither this story nor 7.15c can fix that without changing mobile's cooldown skip, which was itself a deliberate fix for socket flooding. 7.15c should decide whether `AUTO` arrows are worth rendering at all on that cadence, or whether the arrow should be driven off `ability:fired` for those abilities instead. ADR-0008's "nearly free once the broadcast/render side lands" claim about `AUTO` is optimistic for this reason.
- **Deferred finding #3 — broadcast vs. send-to-host.** Kept `this.broadcast(...)`, matching ADR-0008's "Server → all clients" and every other delta in this codebase. Reasoning recorded rather than assumed: the phone-side cost the reviewer projected (~240 msg/s per phone) rested on the same 33ms-per-player assumption the previous note disproves. Real worst case is far lower — `RELEASE` previews only flow while a thumb is mid-drag (a brief, deliberate gesture, not a held state), and `AUTO` contributes at cooldown cadence. Deviating from the ADR's stated transport to solve a cost that does not materialise would be the wrong trade; if a real device ever shows phone-side pressure, the fix is a delta-type filter in `mobile-session.ts`, which is a mobile-side change and cheap. Noted for 7.15d's manual pass to watch for.
- **Required hooks — Simulation-safety hook TRIGGERED and satisfied:**
  - `npm run typecheck`: clean, 10/10 tsconfigs.
  - Unit tests: `tests/unit/aim-preview.test.ts` 19/19 new; the combined sim + game-rules + unit suites 413/413.
  - **Deterministic-tick tests pass completely unmodified** — `tests/unit/generation.test.ts`, `tests/unit/bonds.test.ts`, `packages/game-rules/tests/unit/grassland-boss.test.ts`. Per the story's own instruction this was treated as a signal, not a checkbox: needing to edit them would have meant the implementation was mutating something. No edit was needed.
  - No replay test exists in this repo (searched; the determinism tests above are the closest equivalent).
  - **Perf sanity check.** At most one additional broadcast per aiming player per tick, bounded by `MAX_PLAYERS` = 8 — so ≤8 small JSON payloads per 33ms tick in the worst case where all eight players aim simultaneously. Compare with the existing `player:moved` broadcast, already one per *moving* player per tick at the same bound. The per-player work is one `Map.get`, two table lookups, one `Math.hypot` and three `Number.isFinite` calls — no allocation beyond the delta object itself, no `JSON.stringify` inside the tick (serialization happens at the message boundary), and `logger.debug` was not added to this path. Empirically, the six e2e tests run against a live 30hz server with no timing degradation.
  - Contract-change hook NOT triggered: zero diff under `packages/shared-types/` and `packages/net-protocol/` — those are Blocked paths here and 7.15a's types are consumed read-only.
  - Client-UX hook NOT triggered: no host or mobile file touched.
  - Ownership hook NOT triggered: production changes confined to `apps/simulation-server/**` and `packages/game-rules/**`, both this story's allowed paths.
- **Regression:** `npm test` — 709 passed, 1 failed, 9 skipped across 58 files. The failure is the pre-existing Stone Wall centering assertion in `apps/host-client/src/vfx/ability-vfx.test.ts`. The four "failed" e2e files all failed with the WSL2 port-binding timeout and had their tests skipped; `hub-ability-use.test.ts` was re-run in isolation and passes 5/5. Zero regressions attributable to this story. (This tree also carries 7.14a, 7.14b and 7.15a, so the 709 figure is a combined-branch number; the story-specific evidence is the 19 unit + 6 e2e tests above and the 413-test sim/game-rules run.)
- **Confidence: 90%.** AC1-AC6 each have direct test coverage, the refactor of both pre-existing formula sites is what makes AC2 structural rather than incidental, and the determinism tests passing unmodified is real evidence for AC4 rather than an assertion. The 10% reservation is the `AUTO` cadence finding above: the implementation follows AC3 literally and broadcasts previews for `AUTO` abilities, but I judge that channel to be of limited value on a cooldown-gated cadence, and that judgement is unverified until 7.15c renders it on a real display.

### File List

- `packages/game-rules/src/systems/aim-point.ts` — **new.** `resolveAimPoint` + `AimPoint`, the single shared aim-point expression, with the non-finite/zero guard (Task 1)
- `packages/game-rules/src/index.ts` — export `resolveAimPoint` / `AimPoint` (Task 1)
- `packages/game-rules/src/systems/combat.ts` — `isInHitZone`'s directional branch refactored onto `resolveAimPoint` (Task 1.2)
- `apps/simulation-server/src/rooms/GameRoom.ts` — zone-delivery placement refactored onto `resolveAimPoint` (Task 1.1); joystick drain converted to a `switch` with an `InputEvent` exhaustiveness guard and new `aim-preview` / `ability` collection maps (Task 2, 7.15a review finding #1); new private `broadcastAimPreviews` with the declarative target rule (Tasks 3, 4); call site after the ability dispatch loop; `resolveAimPoint` + `AimPreviewInput`/`AbilityInput` imports
- `tests/unit/aim-preview.test.ts` — **new.** 19 tests: `resolveAimPoint` normalization/zero/NaN/Infinity/null guards, the `=== 0` vs `!(mag > 0)` asymmetry, per-ability preview-vs-real-placement equality for all four destination-preview abilities probed through the production `isInHitZone`, Storm Eye's literal placement, the projectile/AUTO exclusions, and a repo-wide assertion that the declarative rule selects exactly the four named abilities (Task 5)
- `tests/e2e/aim-preview.test.ts` — **new.** 6 tests over the real WebSocket: target present + direction normalized (Storm Eye), target omitted (Tempest Hurl), zero-aim suppressed, null-from-JSON suppressed, per-tick burst collapse keeping the latest direction, and no `GameState` mutation
- `_bmad-output/implementation-artifacts/7-15b-aim-preview-resolution.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates

### Review Findings

Reviewed 2026-08-06 as part of a batched 3-group review of the whole branch (split by ownership: sim+game-rules, host, mobile — the combined diff was ~3.7k lines, past the single-review threshold). This story drew findings from **two** groups, because the sharpest bug in the branch straddled the sim/mobile boundary.

**[High — CONFIRMED, FIXED] A `null` direction crashed the tick and permanently wedged the room.**
`const rawX = preview?.directionX ?? abilityInput!.directionX` — `??` treats `null` as nullish, so a preview whose `directionX` arrived as `null` fell through to `abilityInput!.directionX` when there was no ability input that tick (the normal case for a `RELEASE` drag), throwing a `TypeError`. `null` is precisely the shape Story 7.15a documented as reachable, and the sim's own `EventNames.INPUT` handler validates nothing beyond `if (!msg?.event)`.

The blast radius is what makes this High rather than Medium. `tick()` is `try/catch`ed, but `inputQueue.length = 0` runs **downstream** of the `broadcastAimPreviews` call — so the poisoned event is never drained and re-throws every 33ms forever. Everything after that point in the tick (Spirit Nova sweep, projectile advance/expiry, zone ticks, revive timers, status expiry, periodic snapshots) stops permanently while the queue grows without bound. `resolveAimPoint`'s null guard, which exists for exactly this input, sits *after* the crash. **Fixed** with an explicit ternary, plus a comment recording why `??` is wrong here.

**[Medium — CONFIRMED, FIXED] A preview was broadcast *after* the fire when both landed in one tick.**
Found independently by the mobile reviewer. The phone sends previews every ~33ms and the tick is ~33ms, so the last preview of a drag and the release's `ability` message very often land in the same drain. The guard meant to prevent this was dead: `const abilityInput = preview ? undefined : abilityInputs.get(player.id)` forced `abilityInput` to `undefined` whenever a preview existed, so the `if (abilityInput && inputType !== AUTO/AIM_CAST) continue` never ran in the one case it was written for. Result: `ability:fired` then `ability:aim-preview` in the same tick; the host clears the aim on the fire and immediately re-inserts it, leaving a ghost arrow over the cast VFX for the whole ~150ms staleness window, on roughly every other cast of all six `RELEASE` abilities. **Fixed** by checking the ability input unconditionally and skipping any player who fired a `RELEASE` ability this tick.

**[Medium — CONFIRMED, FIXED] `isInHitZone`'s refactor silently voided Story 3.11's zero-drag contract.**
My comment claimed "every caller here already normalizes before calling". That was false: `GameRoom`'s generic hit-scan deliberately forwards an un-normalized zero vector for `hitRangePx === 0` directional abilities, guarded by `if (isDirectional && mag === 0 && hitRange > 0) continue` — the `hitRange > 0` condition exists precisely to let zero-range abilities through, because they "hit at the player's own position regardless of direction". `resolveAimPoint` rejects a zero direction unconditionally, so routing that case through it turned a documented hit into a miss. The reviewer traced every directional call site and confirmed **no shipping ability reaches it today** (all directional circle-hitscan abilities are intercepted by their own dispatch branches first), so this was latent, not live — but the guard and its comment had become a lie. **Fixed** by handling `hitRangePx === 0` explicitly at the call site, with the contract spelled out. Also corrected `isInHitZone`'s header comment, which still documented the centre as `player + direction * hitRangePx` without mentioning that the function now normalizes the direction itself — a real semantic change to an exported game-rules API.

**[Medium — CONFIRMED, FIXED] The e2e test that claimed to prove the fire/preview ordering was structurally incapable of failing.**
Its 40ms sleeps guaranteed a tick boundary between the last preview and the fire — exactly the case where the bug does *not* occur. My Completion Notes cited it as empirical confirmation; that confirmation was an artifact of the sleep. **Fixed** by adding a no-sleep same-tick release test, and verified the right way: reintroduced the bug and confirmed the new test fails (`expected 'preview' to be 'fired'`), then restored the fix.

**[Medium — CONFIRMED, FIXED] The "null direction" e2e test was testing the wrong thing.**
It sent literal `NaN` through `room.send`, which is Colyseus **msgpack**, not `net-protocol`'s JSON wrappers — so NaN survives as NaN, `NaN ?? x` is not nullish, and the null path was never exercised. Confirmed by round-tripping through the actual msgpack encoder. **Fixed**: the test now sends both `NaN` and an explicit `null`.
Its liveness probe was also wrong, and finding that took instrumenting the running server. Probing "is the room alive?" by sending another valid aim and awaiting a preview **passes even when the tick is wedged**: the per-player `Map` collapse means a later valid input simply overwrites the poisoned one in the rebuilt map, so broadcasts resume while the queue still grows without bound. Replaced with a probe on the periodic full snapshot, which is genuinely downstream of the crash point — and verified it fails with the bug present and passes with it fixed.

**Deferred (real, out of scope for this story):**
- **[Low] The projectile-delivery branch still uses the unsafe `mag === 0` idiom** while its zone-delivery sibling 45 lines away now rejects non-finite directions. `dispatchAbility` rejects `NaN` but **accepts `Infinity`** (`Infinity > 0` is true), so `directionX: Infinity` on Blood Spike / Void Pulse / Tempest Hurl still yields `Infinity/Infinity === NaN`, fed straight into `createProjectileBody` and pushed into `gameState.projectiles`. Pre-existing, not introduced here — but this story proved the fix is one call, and leaving one of two adjacent branches on the unsafe idiom is what the "single expression" bar exists to prevent.
- **[Low] Two `Map` allocations per tick** (`aimPreviewThisTick`, `abilityInputThisTick`) are constructed unconditionally at 30hz whether or not anyone is aiming, and `resolveAimPoint` returns a fresh object so `isInHitZone`'s directional branch — previously pure scalar arithmetic — now heap-allocates once per hit test. Directional hit tests only run on cast, so the real cost is bounded, but project-context.md lists "heap allocations in hot paths" as forbidden inside the tick and this story's Completion Notes claimed "no allocation beyond the delta object itself", which was **not accurate**. Correcting the claim here rather than leaving it.
- **[Low, architectural] Any throw between the input drain and `inputQueue.length = 0` wedges the room permanently.** The specific trigger is fixed, but the amplification mechanism is generic and pre-existing. Worth either draining defensively or moving the clear — a deliberate change, given the WARNING comment that currently forbids moving it.

**Confirmed clean by the reviewer, independently verified rather than taken on trust:** no double-applied self-scope status in any phase (Iron Skin and Dark Pact both traced); `abilityIndex` bounds safe against a malicious client including prototype keys; broadcast volume bounded by `MAX_PLAYERS` with per-tick collapse; the `InputEvent` exhaustiveness guard **genuinely compile-fails** (the reviewer compiled a minimal repro with a fourth variant to check the nested-discriminant narrowing actually works); no `GameState` mutation, PRNG use, or determinism impact from any 7.15b code; the zone-placement `mag === 0 → !aim` swap is strictly an improvement.

**Regression after patches:** `npm run typecheck` clean (10/10). `tests/e2e/aim-preview.test.ts` 8/8. Full suite 731 passed, 1 failed (the documented pre-existing Stone Wall centering assertion), 9 skipped (WSL2 e2e port contention).

### Resolved by Story 7.15e (2026-08-06)

This story's Completion Notes flagged that ADR-0008's "`AUTO` abilities already stream a live direction every ~33ms" premise is false in practice, because the 2026-07-25 cooldown-sync fix suppresses their input while on cooldown — and that the resulting arrow blink was a judgement needing a display. The user confirmed it in play, and Story 7.15e fixes it: the phone now sends `input:aim-preview` during the cooldown gap instead of nothing.

**No change was required in this story's code.** `broadcastAimPreviews` already handled an `AUTO` preview correctly — direction-only, no target, since an `AUTO` ability's real landing point is not knowable while aiming. That was verified by a new e2e test rather than assumed. The `RELEASE`-fired suppression added during this story's review is also correctly scoped: it deliberately does not apply to `AUTO`, where the cast *is* a legitimate aim refresh.

## Change Log

- 2026-08-05 — Story created from `epics.md` "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" and ADR-0008.
- 2026-08-06 — Implemented. Shared `resolveAimPoint` extracted and both pre-existing formula sites refactored onto it; `ability:aim-preview` broadcast added with a declarative target rule; `InputEvent` exhaustiveness guard added (7.15a review finding). 25 new tests. Discovered and flagged that `AUTO` abilities do not stream at 33ms as ADR-0008 assumed — their input is cooldown-gated — which is material for 7.15c. Status → review.

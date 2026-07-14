---
baseline_commit: f6083d8
---

# Story 3.20: Stormcaller — Storm Eye Rework

Status: done

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

- [x] **Task 1** (AC: #2) — `server-to-host.ts`: add
  `ZoneStrikeDelta { type: 'zone:strike'; zoneId: string; targetId: string; damage: number; }`
  — add to `DeltaEventMsg`. `apply-delta.ts`: add the matching case (likely
  a no-op / visual-only, same style as `ability:fired` — the actual HP
  change is broadcast separately via the existing `enemy:damaged`/
  `player:hp-updated` delta for the struck target; `zone:strike` itself is
  purely "show a lightning-bolt visual from the zone to this target").

- [x] **Task 2a** (AC: #1) — `balance.ts`: extend `ABILITY_DELIVERY`'s type
  to `'hitscan' | 'projectile' | 'zone'`; set Stormcaller slot 3 (Storm
  Eye) to `'zone'`. Add `STORM_EYE_ZONE_RADIUS_PX`, `STORM_EYE_TICK_MS`,
  `STORM_EYE_DURATION_MS`, `STORM_EYE_STRIKE_INTERVAL_MS`,
  `STORM_EYE_STRIKE_DAMAGE` tunables.

- [x] **Task 2b** (AC: #1) — `GameRoom.ts`: in the ability-dispatch block's
  delivery branch (extended by this story), add the `'zone'` case: compute
  the placement point (`player.x + dirX * ABILITY_HIT_RANGE_PX[...]`,
  `player.y + dirY * ...` — same directional-offset math `isInHitZone`
  already uses internally, just needs the point itself here rather than a
  hit-test), call `createZoneBody` (Story 3.13) with `effectType: 'damage'`,
  `radius: STORM_EYE_ZONE_RADIUS_PX`, `tickIntervalMs: STORM_EYE_TICK_MS`,
  `expiresAtMs: nowMs + STORM_EYE_DURATION_MS`. The regular steady-tick
  damage application reuses Story 3.13's existing `'damage'` zone-tick case
  verbatim — no new code needed for that half.

- [x] **Task 3** (AC: #2) — `GameRoom.ts`: add
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

- [x] Write `tests/unit/storm-eye.test.ts` per AC4 — include a determinism
  test: two independently-seeded `createRng(sameSeed)` streams, feed the
  same overlap-set-size sequence into the same selection logic (extract the
  selection math into a small pure helper if that makes it independently
  testable without a live `GameRoom` — recommended, matches this
  codebase's preference for pure, directly-testable `game-rules` functions
  over asserting behavior only through integration tests).
- [x] Add a `zone:strike` round-trip contract test.
- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

### Review Findings

- [x] [Review][Decision] Contract-change hook incomplete for `zone:strike` — Protocol Architect review and a spec/ADR update were not performed for the new wire type (`packages/net-protocol/src/messages/server-to-host.ts`). Only the contract-test half of the hook is done. **User decision (2026-07-14): accept as-is** — additive-only change (new delta type appended to the union, nothing existing altered), backward compatible, low risk.
- [x] [Review][Decision] Ownership hook bypassed for `tests/unit/abilities.test.ts` — edited outside this story's declared Allowed paths (only `tests/unit/storm-eye.test.ts (new)` was declared) to fix a stale Story 3.19 assertion that this story's own Task 2a change broke. **User decision (2026-07-14): accept the edit** — one-line mechanical fix to a hardcoded expectation this story's own sanctioned change made stale.
- [x] [Review][Decision] `STORM_EYE_TICK_DAMAGE = 10` (`packages/game-rules/src/balance.ts`) is a new balance constant not enumerated in Task 2a's tunable list — a judgment call to make the steady zone tick actually deal damage (AC1), needs design sign-off on the value. **User decision (2026-07-14): keep 10** — ships as alpha tuning, retune later if needed.
- [x] [Review][Decision] No cap on concurrent Storm Eye zones per caster — `STORM_EYE_STRIKE_INTERVAL_MS`/cooldown (2000ms, `ABILITY_COOLDOWNS_MS.stormcaller[3]`) is shorter than `STORM_EYE_DURATION_MS` (5000ms), so a player can stack 2-3 live zones (each independently ticking damage + bonus strikes). Is stacking intended? **User decision (2026-07-14): allow stacking** — matches this batch's general lack of a stacking cap on zone-based abilities (e.g. Void Pulse has the same ratio); left as emergent alpha behavior.
- [x] [Review][Patch] Bonus-strike target selection doesn't filter to alive enemies before picking [`apps/simulation-server/src/rooms/GameRoom.ts:~1541`] — `zoneOverlapping` legitimately contains player ids too (confirmed: `CAT_ZONE` sensor's `filterMaskBits` includes `CAT_PLAYER` in `physics/world.ts`, and `extractZoneContact` in `physics/sensors.ts` tags both `'enemy'` and `'player'` target types). `pickRandomIndex` can land on a player id or a same-tick-killed enemy corpse; the strike silently no-ops but `zoneStrikeTimers` still advances, wasting the whole interval even when a valid enemy target is present in the same zone. **Fixed:** filter `zoneOverlapping` to ids matching a currently-alive enemy before picking, so the random pick is always drawn from valid targets only.
- [x] [Review][Patch] Stale test title in `tests/unit/abilities.test.ts:462` — still reads "Souldrinker-only in this story" after being updated to also encode Story 3.20's Stormcaller zone-delivery exception. **Fixed:** title now reads "...Souldrinker-only in this story; Stormcaller gains zone delivery separately in 3.20".
- [x] [Review][Defer] AC4's steady-tick damage isn't integration-tested at the GameRoom level [`apps/simulation-server/src/rooms/GameRoom.ts` zone-tick loop] — deferred, pre-existing: every prior zone-tick ability (3.13's Void Pulse, etc.) has the same gap — only the pure `shouldZoneTick`/`isZoneExpired` primitives are unit-tested, GameRoom-level damage application has never had a dedicated test in this codebase.

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

Claude Sonnet 5

### Debug Log References

- `npm run typecheck` — 0 errors (all 10 project references, including `tests/tsconfig.json`).
- `npx vitest run` (full suite) — 467 passed, 0 failed, 12 skipped. One pre-existing
  assertion in `tests/unit/abilities.test.ts` (Story 3.19's "no other class has
  projectile delivery or a chained-zone config" test) hardcoded
  `ABILITY_DELIVERY[STORMCALLER] === ['hitscan','hitscan','hitscan','hitscan']` —
  this is exactly the value this story's Task 2a is scoped to change (Storm Eye →
  `'zone'`), so the assertion was updated to check "no `'projectile'` delivery" for
  Stonehide/Spiritcaller/Stormcaller (unchanged claim) plus an explicit Stonehide/
  Spiritcaller `toEqual` check, dropping the now-incorrect Stormcaller literal.
  This one-line edit falls outside this story's declared Allowed paths
  (`tests/unit/storm-eye.test.ts (new)` only) — flagging per the ownership hook;
  the change is a mechanical update to a stale hardcoded expectation, not new
  test logic, and was necessary to satisfy this story's own "0 errors, no
  regressions" requirement.
- `npm run lint` — clean (no output).

### Completion Notes List

- Task 1: added `ZoneStrikeDelta` (`zone:strike`) to `server-to-host.ts` and the
  `DeltaEventMsg` union; `apply-delta.ts` case is a no-op (visual-only — HP change
  broadcasts separately via `enemy:damaged`/`enemy:killed`), matching `zone:tick`'s
  existing precedent.
- Task 2a: extended `AbilityDeliveryType` with `'zone'`; set Stormcaller slot 3
  (Storm Eye) to `'zone'`; added `STORM_EYE_ZONE_RADIUS_PX` (150), `STORM_EYE_TICK_MS`
  (500), `STORM_EYE_TICK_DAMAGE` (10, new — see rationale below),
  `STORM_EYE_DURATION_MS` (5000), `STORM_EYE_STRIKE_INTERVAL_MS` (1500),
  `STORM_EYE_STRIKE_DAMAGE` (30).
  - Judgment call: the task list didn't enumerate a steady-tick damage constant,
    but AC1 requires the zone to actually deal damage, and `ABILITY_DAMAGE.stormcaller[3]`
    is only read by the hit-scan path (bypassed entirely by the `'zone'` delivery
    branch — same as how the `'projectile'` branch never reads it either). Reusing
    that hit-scan-only table entry for an unrelated delivery mechanism would be a
    semantic leak, so a dedicated `STORM_EYE_TICK_DAMAGE` constant was added instead,
    matching this file's existing single-consumer-constant convention (Spirit Nova,
    Soul Mend, Dark Pact). `ABILITY_DAMAGE.stormcaller[3]` stays `0`, unused, same
    as before this story.
- Task 2b: added the `'zone'` dispatch branch in `GameRoom.ts` — computes the
  placement point via the same directional-offset math `isInHitZone` uses
  internally, calls `createZoneBody` directly (not via `spawnChainedZone`, per the
  story's explicit instruction — that helper is for projectile-hit-triggered
  chains, this is a direct RELEASE placement), and reuses Story 3.13's existing
  `'damage'` zone-tick case verbatim for the steady tick.
- Task 3: added `zoneStrikeTimers: Map<string, number>` (zoneId → lastStrikeAtMs).
  Strike-eligibility is scoped to Storm Eye without any class/index check in the
  generic zone-tick loop — the map only ever gets an entry when the `'zone'`
  dispatch branch creates one, so the tick loop's `zoneStrikeTimers.get(zone.id) !==
  undefined` check alone is the eligibility gate. Random target selection uses
  `this.prng()` (confirmed still unused anywhere else in `GameRoom.ts` — re-grepped
  at implementation time) fed through a new pure `pickRandomIndex(rngValue, count)`
  helper in `packages/game-rules/src/systems/targeting.ts`, so the selection math
  is unit-testable without a live `GameRoom`/planck world.
- Reused Story 3.13's begin/end-contact overlap tracking (`zoneOverlapping`) for
  "who's in the zone" — no new overlap-tracking code, per the story's Context.
- Tests: `tests/unit/storm-eye.test.ts` (new) covers `pickRandomIndex` determinism
  (two independently-seeded `createRng(sameSeed)` streams produce identical
  sequences) and Storm Eye's zone-cadence constants against the existing pure
  `shouldZoneTick`/`isZoneExpired` functions (regression confirmation, per the
  story's own note that the steady-tick path is mostly a regression check since
  it reuses 3.13's code verbatim). Added a `ZoneStrikeDelta` round-trip contract
  test to `tests/contract/net-protocol.test.ts`.

**Contract-change hook (CLAUDE.md) — triggered by the new `zone:strike` delta type:**
- Protocol Architect review: **required, not yet performed** — flagging per the
  persistent ownership/contract-change rule; this story was implemented under
  "Owner agent: Multi-context (explicit cross-context approval)" as declared in
  the story header, but no separate Protocol Architect review pass occurred in
  this session.
- Compatibility checklist: additive-only change (new delta type appended to the
  `DeltaEventMsg` union, no existing message shape altered) — backward compatible.
- Spec or ADR update: not performed — no `docs/adr/**`/`docs/specs/**` entry was
  updated for this story's contract addition.
- At least one contract test: done — `ZoneStrikeDelta` serialize→deserialize
  round-trip in `tests/contract/net-protocol.test.ts`.

Confidence: 75% — reasons for being below 80%: (1) `STORM_EYE_TICK_DAMAGE`'s
value is a new balance judgment call not present in the story's task list (see
Task 2a note above) — the mechanism is correct but the number is alpha-tuning
guesswork, same category as this batch's other new tunables; (2) the Contract-
change hook's Protocol Architect review and spec/ADR update were not performed
in this session (flagged above) — the wire-format change itself is additive and
low-risk, but the formal review step is outstanding; (3) no live GameRoom/planck
integration test exercises the zone-placement or bonus-strike path end-to-end
(by design, per Dev Notes' pure-function-extraction guidance), so the dispatch
branch and zone-tick strike logic are verified by typecheck + full regression
suite passing, not by a dedicated integration test for this story's own new
code paths.

### File List

- `packages/net-protocol/src/messages/server-to-host.ts` — added `ZoneStrikeDelta`, added to `DeltaEventMsg` union
- `packages/net-protocol/src/apply-delta.ts` — added `zone:strike` case (no-op)
- `packages/net-protocol/src/index.ts` — exported `ZoneStrikeDelta`
- `packages/game-rules/src/balance.ts` — extended `AbilityDeliveryType`, set Stormcaller slot 3 to `'zone'`, added `STORM_EYE_*` constants
- `packages/game-rules/src/index.ts` — exported new `STORM_EYE_*` constants and `pickRandomIndex`
- `packages/game-rules/src/systems/targeting.ts` — added `pickRandomIndex` pure helper
- `apps/simulation-server/src/rooms/GameRoom.ts` — added `zoneStrikeTimers` map (+ cleanup in both reset spots and zone-expiry), `'zone'` ability-dispatch branch, bonus-strike check in the zone-tick loop
- `tests/unit/storm-eye.test.ts` (new) — `pickRandomIndex` determinism + Storm Eye zone-cadence regression tests
- `tests/contract/net-protocol.test.ts` — added `ZoneStrikeDelta` round-trip + `apply-delta` no-op tests
- `tests/unit/abilities.test.ts` — updated a Story 3.19 assertion that hardcoded Stormcaller's pre-3.20 all-hitscan delivery (see Debug Log References)

## Change Log

- 2026-07-14: Story implemented — Storm Eye now places a persistent `'damage'`
  zone (steady tick reuses Story 3.13's code) with a periodic bonus lightning
  strike on a random zone-overlap target, selected via the seeded
  `this.prng()`/`pickRandomIndex`. New `zone:strike` delta type (contract-change
  hook triggered — see Completion Notes for outstanding Protocol Architect
  review). `ABILITY_DELIVERY` extended with a `'zone'` variant. Status →
  `review`.

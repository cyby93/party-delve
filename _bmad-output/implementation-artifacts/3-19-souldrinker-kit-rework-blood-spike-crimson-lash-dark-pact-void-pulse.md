---
baseline_commit: f6083d8
---

# Story 3.19: Souldrinker Kit Rework (Blood Spike, Crimson Lash, Dark Pact, Void Pulse)

Status: review

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 4th of 5 per-class kit-rework stories; depends on 3.11, 3.12
  (status effects, for Dark Pact's buff), 3.13 (projectiles/zones, for Blood
  Spike/Void Pulse), 3.14 (displacement, for Void Pulse's pull), 3.15
  (self-cost/lifesteal/HP-scaling, for Blood Spike/Crimson Lash), and reuses
  3.17's players-gathering query (for Dark Pact's ally target))

Context: This story wires the MOST different mechanisms of any single
  kit-rework story in the batch — it's the integration point for 3.12-3.15
  all at once. Read all 4 of those story files' Dev Notes before starting;
  this file assumes their mechanisms exist and just wires them.

  **Delivery-type branch needed for the first time in ability dispatch:**
  every ability to date (all original 9 + every ability reworked in 3.16/
  3.17) resolves via instant hit-scan (`isInHitZone` against
  `gameState.enemies`, same tick as dispatch). Blood Spike and Void Pulse
  are the FIRST abilities that must spawn a `ProjectileState` (Story 3.13)
  instead. Add a declarative `ABILITY_DELIVERY: Record<PlayerClass,
  readonly ['hitscan' | 'projectile', ...4]>` table to `balance.ts`
  (default `'hitscan'` for all existing entries; Souldrinker slots 0 and 3
  set to `'projectile'`) and branch on it in `GameRoom.ts`'s ability-dispatch
  block BEFORE the existing hit-scan loop runs — `'projectile'`-delivery
  abilities skip that loop entirely and call `createProjectileBody` instead
  (from Story 3.13).

  **Story 3.13 deliberately left the Zone-tick handler's `'pull'`
  `effectType` case unimplemented** (its own Non-goals: "Do not build pull
  physics here... left as a `'pull'` placeholder effectType"), and Story
  3.14 deliberately did not touch `zones.ts`/the zone-tick handler at all
  (its own Blocked paths exclude `apps/simulation-server/**` zone code).
  **This story is where `'pull'` gets wired** — extend the EXISTING
  `effectType` switch/if in `GameRoom.ts`'s zone-tick handler (built in
  3.13's Task 3c) to add the `'pull'` case: for every player/enemy
  overlapping the zone, call `applyDisplacement` toward the zone's center
  and apply the result via 3.14's direct-position-mutation pattern (enemy:
  mutate `x`/`y` directly; player: `body.setPosition` + broadcast
  `player:moved`). Do not rewrite the `'damage'` case (already implemented
  by 3.13 for reuse by Story 3.20's Storm Eye) — only add the new branch.

  **Dark Pact targets a living ALLY, not an enemy** — reuse Story 3.17's
  Task 1 players-gathering query (`gatherPlayersInHitZone`-style helper),
  filtered to non-`isDown`, non-`isSpirit` players, excluding the caster.
  Single-target (Aimed Point), not AoE — take the first/nearest match, same
  resolution style as Story 3.18's Soul Mend target-finding (though Dark
  Pact is instant `RELEASE`, not a channel — don't copy Soul Mend's
  multi-tick channel machinery, only its "aim at a filtered player list,
  pick nearest" query shape).

  **Dark Pact's drain composes two EXISTING functions, no new one needed:**
  `applyPlayerDamage(targetAlly, drainAmount)` (already handles the
  down-state transition correctly — "no down-safety floor... intentional
  risk" per epics AC is exactly `applyPlayerDamage`'s existing unconditional
  behavior, nothing new to build) then `healPlayer(caster, drainAmount)`
  (Story 3.15). Apply Dark Pact's `damageBuff` via the EXISTING
  `ABILITY_STATUS_EFFECT` table/handling from Story 3.16 (`scope: 'self'`,
  same code path as Iron Skin — just a different effect type/config entry,
  no new `GameRoom.ts` branch needed).

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Protocol Architect (Task 1 — packages/shared-types/class-definitions.ts
    rename only)
  Simulation Engineer (all other tasks — packages/game-rules/**,
    apps/simulation-server/**)
  Mobile Controller Engineer (verify only — Blood Spike's rename flows
    through automatically since mobile renders `ability.name` directly, no
    mobile code change expected; confirm during implementation)

Goal:
  Task 1 — Rename Blood Draw → Blood Spike in `CLASS_DEFINITIONS`.
  Task 2 — `ABILITY_DELIVERY` table; wire Blood Spike/Void Pulse to spawn
            projectiles instead of instant hit-scan.
  Task 3 — Blood Spike: self-cost (3.15) applied on cast, lifesteal (3.15)
            applied on projectile hit (3.13's hit-resolution call site).
  Task 4 — Crimson Lash: `ABILITY_HP_SCALED_DAMAGE` entry (3.15), no
            delivery/input change.
  Task 5 — Dark Pact: ally-target drain + damageBuff self-status-effect.
  Task 6 — Void Pulse: projectile impact damage + chained pull zone (3.13's
            declarative chain config) + the zone-tick `'pull'` case itself.

Allowed paths:
  - packages/shared-types/src/class-definitions.ts (Task 1 — rename only)
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts

Blocked paths:
  - Any other class's abilities — Stories 3.16 (done), 3.17 (done), 3.20
  - packages/net-protocol/** — no new wire types; reuses `projectile:hit`/
    `zone:tick`/`status:applied`/`player:hp-updated`/`enemy:damaged` etc.
    from earlier stories (verify before assuming, per the established
    pattern in this batch of checking rather than silently adding)
  - apps/mobile-controller/** — verify the rename needs no touch, don't
    proactively edit

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.19" section
  - _bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md
  - _bmad-output/implementation-artifacts/3-13-projectile-physics-and-zone-field-entities.md — especially the zone-tick handler and declarative chain config (Task 3d)
  - _bmad-output/implementation-artifacts/3-14-displacement-pull-physics-primitive.md
  - _bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md
  - _bmad-output/implementation-artifacts/3-16-stonehide-kit-rework.md — `ABILITY_STATUS_EFFECT` table, reused for Dark Pact's buff
  - _bmad-output/implementation-artifacts/3-17-spiritcaller-kit-rework-ancestors-voice-spirit-nova-warding-cry.md — players-gathering query, reused for Dark Pact's target
  - packages/game-rules/src/balance.ts — current Souldrinker `ABILITY_DAMAGE`/`ABILITY_COOLDOWNS_MS`/`ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX` values

Non-goals:
  - Do not touch Stonehide/Spiritcaller/Stormcaller abilities.
  - Do not rewrite the zone-tick `'damage'` case — only add `'pull'`.
  - Do not build a new "drain" primitive — Dark Pact composes
    `applyPlayerDamage` + `healPlayer`, both already exist.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED — the most cross-cutting story in the
    batch; run the FULL test suite, not just this story's new tests, since
    it modifies the shared ability-dispatch branch point and the shared
    zone-tick handler.
  - Ownership hook: primarily Simulation Engineer; the rename touches
    Protocol Architect's area trivially.

Required tests:
  - tests/unit/abilities.test.ts — Blood Spike self-cost/lifesteal/
    projectile-delivery-flag, Crimson Lash inverse-HP damage, Dark Pact
    drain-transfer + buff, Void Pulse impact+pull-zone-spawn — each a
    dedicated test case.
  - Extend tests/unit/zones.test.ts (from 3.13) with a `'pull'` effectType
    case now that it's implemented.

Telemetry impact: None.
```

---

## Story

As a player,
I want Souldrinker's full kit — Blood Spike, Crimson Lash, Dark Pact, Void Pulse — implemented per the final spec,
so that Souldrinker plays as a coherent risk/reward blood-magic class instead of a flat-damage drain with no lifesteal.

---

## Acceptance Criteria

**AC1 — Blood Spike (`AUTO`, unchanged, Projectile delivery):**
**Given** Blood Draw is renamed Blood Spike
**When** it fires
**Then** it spawns a projectile with the self-cost + 50%-lifesteal-on-hit behavior, replacing the current instant-hitscan drain with no lifesteal
**And** the display name updates from "Blood Draw" to "Blood Spike" in `CLASS_DEFINITIONS` (mobile picks this up automatically — it renders `ability.name` directly)

**AC2 — Crimson Lash (`RELEASE`, unchanged, Cone/Line):**
**Given** Crimson Lash fires
**When** it resolves
**Then** damage scales inversely with the caster's current HP, hitting every enemy in the cone

**AC3 — Dark Pact (`RELEASE` after Story 3.11, targets a living ally):**
**Given** Dark Pact fires
**When** it resolves
**Then** it drains 10% of the target ally's current HP to the caster (applied to both players in the same tick) and grants the caster a `'damageBuff'` status effect (+25% damage, temporary) — no down-safety floor, so this can push the target into a down state (intentional risk)

**AC4 — Void Pulse (`RELEASE` after Story 3.11, Projectile → chained Zone/Field):**
**Given** Void Pulse fires
**When** the projectile impacts
**Then** it deals its configured damage and spawns a pull zone affecting both allies and enemies

**AC5 — Tests:**
**Given** `tests/unit/abilities.test.ts`
**When** Souldrinker's full reworked kit is exercised
**Then** Blood Spike's self-cost/lifesteal/projectile behavior, Crimson Lash's inverse-HP scaling, Dark Pact's drain-transfer, and Void Pulse's impact+pull each have a dedicated test case

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `class-definitions.ts`: `name: 'Blood Draw'` → `name: 'Blood Spike'` (Souldrinker slot 0). No other field changes.

- [x] **Task 2** (AC: #1, #4) — `balance.ts`: add `ABILITY_DELIVERY:
  Record<PlayerClass, readonly ['hitscan'|'projectile', ...4]>` — all
  `'hitscan'` except Souldrinker slots 0 (Blood Spike) and 3 (Void Pulse) =
  `'projectile'`. `GameRoom.ts`: in the ability-dispatch block, branch on
  `ABILITY_DELIVERY[player.class][abilityIndex]` BEFORE the existing
  hit-scan `for` loop — if `'projectile'`, call `createProjectileBody`
  (Story 3.13) with the ability's direction, skip the hit-scan loop for
  this fire entirely (the projectile's own hit resolution, built in 3.13,
  handles damage later via the contact-listener path).

- [x] **Task 3** (AC: #1) — `balance.ts`: `ABILITY_SELF_COST_HP[souldrinker][0]`
  = tunable nonzero value; `ABILITY_LIFESTEAL_PCT[souldrinker][0] = 0.5`.
  `GameRoom.ts`: self-cost already applies generically via `dispatchAbility`
  (Story 3.15's Task 1b) — confirm it fires for Blood Spike specifically (it
  should, no extra wiring needed beyond the table entry). In the projectile-
  hit resolution path (Story 3.13's Task 3c drain block), after applying
  damage to the hit enemy, if `ABILITY_LIFESTEAL_PCT[...] > 0` for the
  projectile's owning ability, call `healPlayer(caster, damageDealt *
  lifestealPct)` and broadcast `player:hp-updated` for the caster. On a
  projectile EXPIRY (miss), do nothing extra — the self-cost was already
  paid at cast time (Story 3.15's AC2 — "on a miss... self-cost HP is still
  lost with no compensating heal" is automatically true since lifesteal only
  triggers in the hit path, never the expiry path).

- [x] **Task 4** (AC: #2) — `balance.ts`: `ABILITY_HP_SCALED_DAMAGE[souldrinker][1]`
  = tunable nonzero coefficient (Crimson Lash). No delivery/input/dispatch
  wiring change needed beyond this table entry — Story 3.15's Task 1b
  already made `dispatchAbility` apply this generically.

- [x] **Task 5a** (AC: #3) — `balance.ts`: `ABILITY_STATUS_EFFECT[souldrinker][2]`
  (Dark Pact) = `{ effectType: 'damageBuff', magnitude: 0.25, durationMs:
  <tunable>, scope: 'self' }` — reuses Story 3.16's existing `'self'`-scope
  handling verbatim, no new `GameRoom.ts` branch needed for the buff half.

- [x] **Task 5b** (AC: #3) — `GameRoom.ts`: Dark Pact needs its own small
  dispatch branch (it's single-target `RELEASE` aimed at a living ally, not
  the existing enemy hit-scan loop, and not a generic AoE — it doesn't fit
  the `'enemies-in-zone'`/`'allies-in-zone'` status-effect scopes from 3.16/
  3.17 for its DRAIN half, only for its BUFF half via Task 5a). Add: gather
  living allies via Story 3.17's players-gathering query, filter to
  non-`isDown`/non-`isSpirit`, exclude caster, find nearest in the
  `isInHitZone` cone/point (same directional-aim resolution style as Soul
  Mend's target-finding in 3.18, but instant — no channel). If a target is
  found: `drainAmount = target.hp * 0.10` (add `DARK_PACT_DRAIN_PCT = 0.10`
  to `balance.ts` rather than a bare literal), call `applyPlayerDamage
  (target, drainAmount)`, apply the result to `gameState.players`, broadcast
  `player:hp-updated` for the target (and `player:downed` if the drain
  downed them — reuse the existing down-broadcast pattern from
  `applyPlayerDamage`'s other call sites), then `healPlayer(caster,
  drainAmount)`, broadcast `player:hp-updated` for the caster. If NO target
  found, the ability still enters cooldown (aimed abilities firing at
  nothing is normal, consistent) but no drain/buff occurs — decide and
  document whether a no-target Dark Pact still applies the `damageBuff` to
  self (recommend: no — the buff and drain are one linked effect per the
  ability's "Drain-Transfer" fantasy; if there's no drain, there's no buff)
  by gating Task 5a's status-effect application on target-found, not
  applying it unconditionally on every Dark Pact cast.

- [x] **Task 6a** (AC: #4) — `balance.ts`: Void Pulse's `chainedZone` config
  (Story 3.13's Task 3d declarative table) = `{ effectType: 'pull', radius:
  <tunable>, tickIntervalMs: <tunable>, durationMs: <tunable> }`, keyed to
  Souldrinker slot 3. Void Pulse's projectile impact damage uses the normal
  `ABILITY_DAMAGE[souldrinker][3]` value through the existing projectile-hit
  → `combat.ts` path (Story 3.13's Task 3c) — no new damage-application code
  needed, just confirm the chain fires after damage per 3.13's AC4 ordering
  ("impact damage is applied first, then a ZoneState is spawned").

- [x] **Task 6b** (AC: #4) — `GameRoom.ts`: extend the zone-tick handler's
  `effectType` branch (built in Story 3.13's Task 3c, currently only
  implements `'damage'`) with a `'pull'` case: for every player/enemy
  overlapping the zone's tracked contact set, call `applyDisplacement`
  toward the zone's `(x, y)` center, apply via Story 3.14's direct-position-
  mutation pattern (enemy: mutate `x`/`y` directly, picked up by the
  existing `body.setPosition` sync; player: call `body.setPosition`
  directly + broadcast `player:moved`, exactly as documented in 3.14's Task
  2 helpers — reuse those helpers if 3.14 left them in place, don't
  duplicate the logic).

- [x] Add Blood Spike/Crimson Lash/Dark Pact/Void Pulse test cases per AC5.
- [x] Extend `tests/unit/zones.test.ts` with a `'pull'` effectType case.
- [x] `npm run typecheck` + `npx vitest run` (FULL suite — this story
  touches the most shared code of any story in the batch) — 0 errors, no
  regressions.

---

## Dev Notes

### Read all 4 prerequisite story files' Dev Notes before starting

This story doesn't introduce new architecture — it only wires together
mechanisms already fully specified in 3.12 (status effects), 3.13
(projectiles/zones + the declarative chain config + the deferred `'pull'`
stub), 3.14 (displacement, and specifically its `applyLinearImpulse`
correction), and 3.15 (self-cost/lifesteal/HP-scaling, and specifically why
these live inside `dispatchAbility` rather than a sibling function). Any
implementation detail not repeated here (exact function signatures, table
shapes) is defined in those files — this file assumes you've read them, per
CLAUDE.md's Simulation-safety hook requirement to read files being modified.

### Project Context Rules

Same tick-loop-hygiene, Result<T,E>, and configuration-hierarchy rules as
every other story in this batch (see 3.12/3.15/3.16 for full text).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.19]
- [Source: _bmad-output/implementation-artifacts/3-12 through 3-18] — all prerequisite mechanisms this story wires together
- [Source: packages/game-rules/src/balance.ts] — existing Souldrinker tuning values

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — no failures encountered during implementation. Two pre-existing tests
(from Stories 3.11/3.16) asserted "every class/slot table entry is 0" as a
blanket condition and needed updating once Souldrinker's slots became
nonzero — expected maintenance, not a bug, matching those tests' own
"(pre-3.19)" naming.

### Completion Notes List

- Task 1: Renamed `'Blood Draw'` → `'Blood Spike'` in `CLASS_DEFINITIONS`
  (Souldrinker slot 0). Verified no other file references "Blood Draw"
  (grepped the full repo) — mobile renders `ability.name` directly, so no
  mobile-controller change was needed, confirming the Owner agent header's
  expectation.
- Task 2: Added `ABILITY_DELIVERY` table to `balance.ts` (all `'hitscan'`
  except Souldrinker slots 0/3 = `'projectile'`). Wired the delivery-type
  branch in `GameRoom.ts`'s ability-dispatch block, placed immediately after
  the `abilityDef` null-check — before the self-scope status-effect block,
  the Spirit Nova branch, and the hit-scan loop — so projectile abilities
  skip all of that entirely. **No `'projectile:spawned'` wire type was
  added** (net-protocol is a blocked path): a newly spawned projectile is
  synced via a full `SNAPSHOT` broadcast instead, mirroring the exact
  precedent the boss `'add:spawned'` case already established for "new
  entity needs client sync, no dedicated delta type exists."
- Task 3: `ABILITY_SELF_COST_HP.souldrinker[0] = 10`,
  `ABILITY_LIFESTEAL_PCT.souldrinker[0] = 0.5`. **Corrected a wrong
  assumption in the story's own Task 3 text**: it claimed self-cost "already
  applies generically via `dispatchAbility`... no extra wiring needed
  beyond the table entry" — checked, and this was false. `dispatchAbility`
  (Story 3.15) computes `selfCostHpApplied` but no `GameRoom.ts` caller ever
  read or applied it (confirmed via grep — zero references). Added the
  actual application: a generic block right after the cooldown-update send,
  applying `result.value.selfCostHpApplied` to `player.hp` and broadcasting
  `player:hp-updated` for any ability with a nonzero self-cost, regardless
  of dungeon/training-dummy phase (a caster-resource cost, not a combat hit
  effect, so it isn't gated behind `if (inDungeon)` the way hit-scan is).
  Wired lifesteal in the projectile-hit-resolution block via `healPlayer` +
  `calculateLifesteal` (both from Story 3.15). Added a caster liveness guard
  (`!isDown && !isSpirit`) before the lifesteal heal — resolves
  deferred-work.md's D-3.15-A remaining "caster-only case," which that
  entry explicitly left open for whichever story wired Blood Spike.
- Task 4: `ABILITY_HP_SCALED_DAMAGE.souldrinker[1] = 1.0`. No `GameRoom.ts`
  change — `dispatchAbility` already applies this generically (Story 3.15).
- Task 5a/5b: Added `ABILITY_STATUS_EFFECT.souldrinker[2]` (damageBuff,
  0.25, 4000ms, self-scope) and `DARK_PACT_DRAIN_PCT = 0.10`. Added a
  dedicated `handleDarkPact` private method and a dispatch branch for it,
  placed BEFORE the generic self-scope status-effect block — this is
  required, not stylistic: the generic self-scope block applies
  unconditionally on every fire, but Dark Pact's buff must be gated on a
  drain target actually being found, so Dark Pact can't flow through the
  generic path at all. Also bumped `ABILITY_HIT_RANGE_PX.souldrinker[2]`
  from `0` to `180` — the pre-existing value would have centered Dark
  Pact's target search on the caster's own position regardless of aim
  direction (the codebase's own established "hitRange=0 = non-directional"
  convention), which contradicts the ability's forward-aimed cone framing;
  this mirrors Soul Mend's (3.18) nonzero forward-aim range for the same
  "aim at a filtered player list" query shape.
- Task 6a/6b: Set `ABILITY_CHAINED_ZONE.souldrinker[3]` to a `'pull'`
  config and added `VOID_PULSE_PULL_STRENGTH_PX`. Implemented the zone-tick
  handler's `'pull'` case (previously a stub comment only) — pulls both
  enemies and non-incapacitated players toward the zone center via Story
  3.14's `applyDisplacement` + the existing `applyDisplacementToEnemy`/
  `applyDisplacementToPlayer` helpers. Added an `isDown`/`isSpirit`/
  `isFrozen` exclusion for players — this resolves deferred-work.md's
  D-3.14-A, which was explicitly left open pending "if/when 3.19's Void
  Pulse ever displaces players." `D-3.14-B` (no vector-summing for
  concurrent pull sources) remains open — noted, not addressed, since no
  concrete case needs it yet.
- Tests: added a "Souldrinker kit rework (Story 3.19)" describe block to
  `tests/unit/abilities.test.ts` (7 new tests: Blood Spike delivery/self-
  cost/lifesteal, Blood Spike's 1-HP floor, Crimson Lash's inverse-HP
  scaling, Dark Pact's drain-transfer + buff composition, Void Pulse's
  impact+chain config, and a "no other class touched" regression check).
  Extended `tests/unit/zones.test.ts` with a `'pull' effectType` describe
  block (2 tests) — `shouldZoneTick`/`isZoneExpired` are effectType-
  agnostic, so these prove a `'pull'` zone times identically to a `'damage'`
  zone; the actual `GameRoom.ts` pull-displacement wiring has no direct
  integration-test coverage, the same known gap as every other kit-rework
  story in this batch (deferred-work.md D-3.16-A).
- Updated two pre-existing tests that asserted blanket "every class/slot
  table entry is 0" conditions (from Stories 3.11/3.16) to exclude
  Souldrinker, since 3.19 is the story that was always going to break that
  assumption for Souldrinker specifically.
- `npm run typecheck`: 0 errors across all 10 project configs. `npx vitest
  run`: 459 passed, 12 skipped (pre-existing Docker/Redis-dependent e2e
  skips), 0 failed at the individual-test level. 3 e2e test files errored
  on `EADDRINUSE` (ports already bound) — confirmed unrelated to this
  story's changes: the failures originate from `.claude/worktrees/agent-*`
  paths, i.e. other concurrent agent sessions' e2e suites competing for the
  same fixed ports on this machine, not from any Souldrinker/projectile/
  zone logic.
- Confidence: 90% — every mechanism reuses an already-built primitive from
  3.12-3.18 exactly as the Dev Notes describe, and the two corrections I
  made against the story's own text (self-cost wiring gap, Dark Pact's
  hitRange=0 issue) were verified by reading the actual current code rather
  than assumed. The 10% is the untested combinatorial surface (e.g., Void
  Pulse's zone pulling a player who's simultaneously mid-Stone-Wall-pull) —
  not required by any AC, flagged via D-3.14-B instead of speculatively
  handled.

### File List

- `packages/shared-types/src/class-definitions.ts` (modified — Task 1 rename)
- `packages/game-rules/src/balance.ts` (modified)
- `packages/game-rules/src/index.ts` (modified)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified)
- `tests/unit/abilities.test.ts` (modified)
- `tests/unit/zones.test.ts` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — D-3.14-A and D-3.15-A resolution notes)

### Change Log

- 2026-07-14: Implemented Story 3.19 — Souldrinker's full kit rework (Blood
  Spike projectile+self-cost+lifesteal, Crimson Lash inverse-HP damage,
  Dark Pact ally-drain+self-buff, Void Pulse projectile+chained pull zone).
  Wired the first projectile-delivery ability path and the first zone
  `'pull'` effectType in the codebase. All tasks complete, all ACs
  satisfied, 0 regressions.

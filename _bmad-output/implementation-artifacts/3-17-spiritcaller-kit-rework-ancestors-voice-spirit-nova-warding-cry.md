---
baseline_commit: f6083d8
---

# Story 3.17: Spiritcaller Kit Rework (Ancestor's Voice, Spirit Nova, Warding Cry)

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 2nd of 5 per-class kit-rework stories; depends on 3.11, 3.12
  (status effects), 3.15 (mixed-faction targeting, self-cost not needed here))

Context: This is the FIRST story in the whole batch that needs to gather
  nearby PLAYERS for an ability's hit zone — every ability up to now (all
  original 9 + Story 3.16's Stonehide kit) only ever targets enemies.
  `apps/simulation-server/src/rooms/GameRoom.ts`'s hit-scan loop iterates
  `this.gameState.enemies` only; there is no existing "gather players in hit
  zone" query anywhere in the codebase. This story adds it — Story 3.15's
  `resolveMixedFactionTargets` is a pure SPLIT function, it does not gather
  targets itself (see 3.15's Dev Notes: "the CALLER is responsible for the
  actual gather... query").

  Spirit Nova's "Expanding Radius" delivery is a genuinely novel mechanic —
  no other ability in the full 16-ability spec uses it, and Story 3.13's
  Zone/Field entities don't fit it cleanly (a Zone re-applies its effect to
  everyone inside it on every tick — a repeating DoT/HoT; Spirit Nova is a
  ONE-SHOT sweep where each target should be hit exactly once as the
  growing ring passes over them, not every tick for the cast's duration).
  Do not try to reuse `ZoneState` for this — build it as its own small,
  self-contained GameRoom-local mechanism (see Task 3 below). This is
  new ground; there's no existing pattern in this codebase to point to for
  it, unlike every other mechanic in this batch.

  Warding Cry needs the exact `'allies-in-zone'` status-effect scope that
  Story 3.16 deliberately deferred building (3.16 only needed `'self'` and
  `'enemies-in-zone'`). This story is where `'allies-in-zone'` actually gets
  implemented — it reuses the SAME new players-gathering query this story
  also needs for Ancestor's Voice, so build the query once and use it for both.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Simulation Engineer (all tasks — packages/game-rules/**, apps/simulation-server/**)
  Protocol Architect (verify only — see 3.16's note on checking whether
  existing delta types suffice before assuming a change is needed; likely
  yes for status effects, but Spirit Nova's expanding-radius sweep hitting
  multiple targets per tick may want its own delta for host visual timing —
  verify before adding one)

Goal:
  Task 1 — Add a `gatherPlayersInHitZone`-style query to `GameRoom.ts`
            (mirrors the existing enemy-gathering loop, using `isInHitZone`
            against `this.gameState.players`, excluding the caster).
  Task 2 — Ancestor's Voice: wire `resolveMixedFactionTargets` using the
            combined enemy+player gather, apply heal/damage from new
            `ABILITY_HEAL_AMOUNT` balance table.
  Task 3 — Spirit Nova: new GameRoom-local expanding-radius tracking +
            `resolveExpandingRadius` pure helper in `targeting.ts`.
  Task 4 — Warding Cry: `'allies-in-zone'` status-effect scope (`'shield'`)
            using Task 1's new player-gathering query, extending 3.16's
            `ABILITY_STATUS_EFFECT` table handling in `GameRoom.ts`.

Allowed paths:
  - packages/game-rules/src/systems/targeting.ts
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - packages/net-protocol/src/messages/server-to-host.ts (only if
    verification in Task 3 shows a new delta is genuinely needed for Spirit
    Nova's sweep visualization — don't add one speculatively)
  - packages/net-protocol/src/apply-delta.ts (same condition)
  - tests/unit/abilities.test.ts, tests/unit/targeting.test.ts

Blocked paths:
  - Soul Mend — explicitly Story 3.18, do not touch Spiritcaller slot 2 at
    all in this story (leave its current `RELEASE`... wait, it's
    `AIM_CAST` after Story 3.11 — leave its `CLASS_DEFINITIONS`/`balance.ts`
    entries exactly as 3.11 left them, untouched)
  - Any other class's abilities — Stories 3.16 (done), 3.19, 3.20
  - packages/shared-types/src/status-effect.ts (the `'shield'` effect type
    already exists from Story 3.12's AC1 type union — no shared-types change
    needed for Warding Cry)

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.17" section
  - _bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md — `resolveMixedFactionTargets` signature
  - _bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md, 3-16-stonehide-kit-rework.md — `ABILITY_STATUS_EFFECT` table and its `GameRoom.ts` wiring, to extend with `'allies-in-zone'`
  - apps/simulation-server/src/rooms/GameRoom.ts — the existing enemy hit-scan loop (to mirror for players) and ability-dispatch block

Non-goals:
  - Do not implement Soul Mend — Story 3.18.
  - Do not build a reusable "Expanding Radius" abstraction beyond what
    Spirit Nova itself needs — no other ability in the spec uses this
    delivery type; a generic system for one consumer is premature (YAGNI).
  - Do not add a persistent `GameState`-visible entity for Spirit Nova's
    expanding sweep (unlike Projectile/Zone from 3.13) — it resolves within
    its short duration and produces ordinary `enemy:damaged`/
    `player:hp-updated` deltas per target as they're swept; the host doesn't
    need a distinct persistent entity to render, it needs (at most) one
    ability-cast-position visual cue, which `ability:fired`'s existing
    direction/position-adjacent broadcast likely already covers — verify.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED.
  - Ownership hook: primarily Simulation Engineer; verify net-protocol
    untouched before finalizing the header's ownership scope.

Required tests:
  - tests/unit/abilities.test.ts — Ancestor's Voice mixed-faction split,
    Warding Cry shield application.
  - tests/unit/targeting.test.ts — `resolveExpandingRadius`'s radius-growth-
    over-time math and hit-once-per-target guard, pure, independent of
    Spirit Nova specifically (test the helper directly with synthetic
    target lists).

Telemetry impact: None.
```

---

## Story

As a player,
I want Ancestor's Voice, Spirit Nova, and Warding Cry implemented per the final spec,
so that Spiritcaller's sustain/burst/defend kit works as intended (Soul Mend's revive interaction is covered separately in Story 3.18).

---

## Acceptance Criteria

**AC1 — Ancestor's Voice (`AUTO`, Cone/Line, mid-range):**
**Given** Ancestor's Voice fires
**When** it resolves
**Then** `resolveMixedFactionTargets` splits targets in the cone into allies (healed) and enemies (damaged) from one query, replacing the current heal-only placeholder

**AC2 — Spirit Nova (`TAP`, Expanding Radius):**
**Given** Spirit Nova fires
**When** it resolves
**Then** a new `resolveExpandingRadius` helper in `packages/game-rules/src/systems/targeting.ts` grows a hit-zone radius from 0 to its max over a short duration, ticking on the sim's cadence, applying mixed-faction heal/damage to everyone it sweeps over — fixing the current mislabel (code deals damage only; spec is mixed-faction)

**AC3 — Warding Cry (`TAP`, self-centered Proximity/Radius):**
**Given** Warding Cry fires
**When** it resolves
**Then** all allies within `ABILITY_HIT_RADIUS_PX` of the caster receive a `'shield'` status effect (temporary flat damage absorption), replacing the current damage=0 no-op

**AC4 — Soul Mend out of scope:**
**Given** Soul Mend
**When** this story is scoped
**Then** Soul Mend is explicitly out of scope — it is fully covered by Story 3.18

**AC5 — Tests:**
**Given** `tests/unit/abilities.test.ts` and `tests/unit/targeting.test.ts`
**When** Spiritcaller's reworked kit is exercised
**Then** Ancestor's Voice and Spirit Nova's mixed-faction resolution, and Warding Cry's shield application, are each covered

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #3) — `GameRoom.ts`: add a players-gathering
  helper mirroring the existing enemy hit-scan gather (same `isInHitZone`
  call, iterate `this.gameState.players` instead of `.enemies`, exclude
  `player.id === casterId`, exclude spirits/downed players per the same
  `isSpirit`/`isDown` guards already used elsewhere for "who's a valid
  interaction target" — check the proximity-revive block's guard style at
  ~line 1630 for the established exclusion pattern).

- [x] **Task 2** (AC: #1) — `balance.ts`: add `ABILITY_HEAL_AMOUNT:
  Record<PlayerClass, readonly [number,number,number,number]>` (parallels
  `ABILITY_DAMAGE`); Spiritcaller slot 0 (Ancestor's Voice) gets a tunable
  heal value, slot 1 (Spirit Nova) gets a tunable heal value, slots 2/3
  (Soul Mend, Warding Cry) stay 0 (Soul Mend heals via full revive not this
  table — 3.18; Warding Cry shields not heals). `GameRoom.ts`: for
  Ancestor's Voice, gather enemies (existing loop) + allies (Task 1) within
  the cone, call `resolveMixedFactionTargets(casterId, [...enemies,
  ...allies])`, apply `ABILITY_DAMAGE`-value damage to each returned enemy
  (existing `applyDamage` call, unchanged), apply `ABILITY_HEAL_AMOUNT`-value
  heal to each returned ally via `healPlayer` (Story 3.15), broadcast
  `enemy:damaged`/`player:hp-updated` per target (existing delta types,
  reused).

- [x] **Task 3** (AC: #2) — `targeting.ts`: add
  ```ts
  export function resolveExpandingRadius(
    elapsedMs: number, durationMs: number, maxRadiusPx: number,
  ): number {
    return maxRadiusPx * Math.min(1, Math.max(0, elapsedMs / durationMs));
  }
  ```
  (pure radius-at-time calculation; the sweep/hit-once-per-target bookkeeping
  is stateful and belongs in `GameRoom.ts`, not this pure function — keep
  the pure/impure boundary the same as everywhere else in this codebase).
  `GameRoom.ts`: add `activeSpiritNovas: Array<{ casterId: string; x: number;
  y: number; startedAtMs: number; durationMs: number; maxRadiusPx: number;
  hitIds: Set<string> }> = []` instance field. On Spirit Nova fire, push a
  new entry (don't run it through the normal instant hit-scan path — branch
  before that, similar to how a future channeled-ability check would branch,
  or gate the existing hit-scan block to skip Spirit Nova's slot). Each
  tick, for each active entry: compute `currentRadius =
  resolveExpandingRadius(nowMs - startedAtMs, durationMs, maxRadiusPx)`;
  gather all players (Task 1's query, radius = currentRadius, no cone/
  direction — proximity only) and enemies (radius = currentRadius) NOT
  already in `hitIds`; call `resolveMixedFactionTargets`; apply heal/damage
  to newly-swept targets; add their ids to `hitIds`; if `nowMs >=
  startedAtMs + durationMs`, remove the entry from `activeSpiritNovas`.
  Add `SPIRIT_NOVA_DURATION_MS`, `SPIRIT_NOVA_MAX_RADIUS_PX` tunables to
  `balance.ts` (Spiritcaller-slot-1-specific, not a generic per-class table
  since only one ability in the entire spec uses this delivery type — a
  4-tuple table would be mostly-unused ceremony for a single consumer;
  plain named constants are the right amount of structure here).

- [x] **Task 4** (AC: #3) — Extend Story 3.16's `ABILITY_STATUS_EFFECT`
  table handling in `GameRoom.ts` to support `scope: 'allies-in-zone'`
  (currently only `'self'`/`'enemies-in-zone'` are handled after 3.16):
  when scope is `'allies-in-zone'`, use Task 1's players-gathering query
  (proximity radius, no direction) instead of the enemy loop, apply
  `applyStatusEffect` to each gathered ally, broadcast `status:applied` per
  target. Add Warding Cry's entry to `ABILITY_STATUS_EFFECT` (Spiritcaller
  slot 3): `{ effectType: 'shield', magnitude: <tunable>, durationMs:
  <tunable>, scope: 'allies-in-zone' }`.

- [x] Add Ancestor's Voice, Spirit Nova, Warding Cry test cases per AC5.
- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

### Review Findings

- [x] [Review][Defer] Warding Cry's `'shield'` status effect applies but is never consumed — a shielded player still takes full damage [`packages/game-rules/src/systems/player-health.ts`, `applyPlayerDamage`] — `applyPlayerDamage` only reads `getStatusEffectMagnitude(player, 'damageReduction', ...)`; there is no `'shield'` branch anywhere in the codebase. AC3's literal wording ("temporary flat damage absorption") is not functionally met — the effect is currently cosmetic. **Deferred (user decision):** outside this story's Allowed paths (`player-health.ts`) and the absorption model (subtract-and-decrement vs block-next-N-total-then-expire) isn't picked yet — resolve both in a dedicated follow-up (see `deferred-work.md` D-3.17-A).
- [x] [Review][Patch] Spirit Nova's sweep damage/heal bypasses the Bond proximity-damage-buff multiplier that its sibling Ancestor's Voice (and every other damaging ability) applies [`apps/simulation-server/src/rooms/GameRoom.ts`, "Spirit Nova sweep" tick block] — fixed: `novaDamage` now applies `proximityBuffed.has(nova.casterId) ? Math.round(rawNovaDamage * BOND_DAMAGE_MULT) : rawNovaDamage`, mirroring Ancestor's Voice's pattern exactly. `novaHeal` intentionally left unbuffed, matching Ancestor's Voice's heal side (`BOND_DAMAGE_MULT` is a damage-only buff).
- [x] [Review][Patch] Spirit Nova's sweep tick block has no `session.phase === 'dungeon'` guard, unlike every sibling per-tick combat block (bond drain, revive timers, spirit-ability dispatch) [`apps/simulation-server/src/rooms/GameRoom.ts`, "Spirit Nova sweep" tick block] — fixed: the whole sweep loop is now wrapped in `if (this.gameState.session.phase === 'dungeon') { ... }`, matching the existing pattern.
- [x] [Review][Defer] Zero test coverage of the actual `GameRoom.ts` wiring added by this story (`gatherPlayersInHitZone`, the Ancestor's Voice branch, the Spirit Nova push/sweep) — only the underlying pure `game-rules` helpers are unit-tested [`apps/simulation-server/src/rooms/GameRoom.ts`] — deferred, same batch-wide gap already tracked as D-3.16-A (no story in this batch has GameRoom-level integration tests yet).
- [x] [Review][Defer] The "hit-once-per-target" test in `tests/unit/targeting.test.ts` validates a hand-rolled reimplementation of the sweep bookkeeping, not the actual `hitIds` usage in `GameRoom.ts` — deferred, same root cause as the item above (no integration-test harness exists yet).
- [x] [Review][Defer] `loadLevel()`/`resetToHub()` clear `activeSpiritNovas` mid-sweep with no completion event — a Spirit Nova cast interrupted by a level transition or return-to-camp silently drops any target the ring hasn't yet reached, with no broadcast or log [`apps/simulation-server/src/rooms/GameRoom.ts`] — deferred, minor (600ms window, rare), matches this batch's existing pattern for similar low-impact gaps (e.g. D-3.14-B).
- [x] [Review][Defer] `resolveExpandingRadius` has an unguarded divide-by-zero on `durationMs=0` [`packages/game-rules/src/systems/targeting.ts`] — deferred, unreachable today (`SPIRIT_NOVA_DURATION_MS` is a hardcoded nonzero constant) but the function is exported as a general pure helper with no input validation; matches this codebase's existing precedent (D-3.13-D).

---

## Dev Notes

### `'shield'` magnitude semantics differ from the other 3 effect types

Story 3.12's `StatusEffect.magnitude` is described generically, but
`'damageReduction'`/`'slow'`/`'damageBuff'` are all 0-1 fractions (percentage
multipliers) while `'shield'` is a FLAT HP absorption amount (per 3.12's own
type comment: "flat HP for shield"). When wiring Warding Cry's shield
application AND when 3.12's damage-reduction hook is checked in
`combat.ts`/`player-health.ts`, make sure `'shield'`'s actual absorption
behavior (subtract from incoming damage before HP, decrement the shield's
remaining magnitude, or a simpler "shield blocks the next N total damage
then expires" — pick one, document the choice) is implemented somewhere;
epics.md doesn't fully specify the interaction between a `'shield'` effect
and `player-health.ts`'s `applyPlayerDamage` (which currently only knows
about `'damageReduction'`, wired in Story 3.12). If `'shield'` absorption
requires a `player-health.ts` change beyond what 3.12 already wired, that's
this story's job to add — check 3.12's actual landed implementation before
assuming it's already handled.

### Project Context Rules

- Same tick-loop-hygiene, Result<T,E>, and configuration-hierarchy rules as
  every other story in this batch — see 3.12/3.15/3.16 for the full text,
  not repeated here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.17]
- [Source: _bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md]
- [Source: _bmad-output/implementation-artifacts/3-16-stonehide-kit-rework.md] — `ABILITY_STATUS_EFFECT` table this story extends
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — hit-scan loop to mirror for players

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

None — no failures during implementation; typecheck and full test suite passed on first run.

### Completion Notes List

- Task 1: Added `GameRoom.ts#gatherPlayersInHitZone` (private method), mirroring the existing enemy hit-scan's `isInHitZone` call but iterating `this.gameState.players`. Excludes the caster and, matching the proximity-revive block's guard style (~line 2000: `teammate.isDown || teammate.isSpirit || teammate.isFrozen`), excludes downed/spirit/frozen players — not just isDown/isSpirit as the task prose literally named, since the task explicitly pointed at that guard's "established exclusion pattern" to follow. This single query backs Ancestor's Voice/Spirit Nova's ally gather (Task 2/3) and Warding Cry's `allies-in-zone` scope (Task 4).
- Task 2: Added `ABILITY_HEAL_AMOUNT` table to `balance.ts` (Spiritcaller slot 0/1 tunable, slot 2/3 zero, all other classes zero). Wired Ancestor's Voice (Spiritcaller slot 0) in `GameRoom.ts`'s ability-dispatch block: gathers enemies (existing `isInHitZone` filter, `.isAlive` guard) + allies (Task 1's query) in the cone as one combined list, splits via `resolveMixedFactionTargets`, applies `ABILITY_DAMAGE`-value damage to enemies (existing `applyDamage` call + kill-handling, copied verbatim from the pre-existing per-enemy loop pattern — this codebase's established convention per zone-tick/projectile-hit/ability-hit-scan all having their own copy, not a shared helper) and `ABILITY_HEAL_AMOUNT`-value heal to allies via `healPlayer`, broadcasting `enemy:damaged`/`enemy:killed`/`essence:dropped`/`player:hp-updated` as appropriate. **Balance judgment call (not an explicit task bullet, but required by AC1's literal "enemies... damaged" wording):** `ABILITY_DAMAGE.spiritcaller[0]` was `0` pre-story (the old heal-only placeholder never actually ran — `apps/simulation-server` had zero Spiritcaller-specific code before this story, confirmed by grep; the "current heal-only placeholder" language in the story's Context section describes the pre-3.17 *design intent*, not existing code). Bumped to `15`, in line with other AUTO-tier abilities (Blood Draw AUTO=12, Lightning Arc AUTO=18).
- Task 3: Added `resolveExpandingRadius(elapsedMs, durationMs, maxRadiusPx): number` to `targeting.ts` per the story's exact prescribed formula, exported from `index.ts`. Added `activeSpiritNovas` GameRoom-local instance field (no persistent `GameState` entity, per Non-goals) and `SPIRIT_NOVA_DURATION_MS`/`SPIRIT_NOVA_MAX_RADIUS_PX` plain constants (not a per-class table — only one ability uses this delivery type) to `balance.ts`. Spirit Nova's dispatch branches before the instant hit-scan path (pushes an `activeSpiritNovas` entry, `continue`s past the rest of the ability-dispatch block). A new tick phase ("Spirit Nova sweep", placed right after the ability-dispatch loop, before Spirit ability dispatch) processes each active entry every tick: computes `currentRadius` via `resolveExpandingRadius`, gathers enemies (`.isAlive` + not-yet-hit) and allies (Task 1's query, not-yet-hit) within that radius, splits via `resolveMixedFactionTargets`, applies damage/heal to newly-swept targets only (tracked via each entry's `hitIds: Set<string>`), and retires the entry once `nowMs >= startedAtMs + durationMs`. `activeSpiritNovas` is cleared in both `resetToHub()` and `loadLevel()` alongside the existing projectile/zone clears, so a sweep never survives into a new level/hub context. **Verified per Non-goals/Task 3's "verify before adding a delta" note:** `ability:fired`'s existing shape (`playerId`, `abilityIndex`, `directionX`, `directionY`) plus the ordinary `enemy:damaged`/`player:hp-updated` deltas per swept target already give the host everything needed to render the cast and its effects — no `packages/net-protocol/**` change was needed, so this story's actual footprint is narrower than the header's "Multi-context" caveat allowed for (Simulation Engineer only, no Protocol Architect review triggered).
- Task 4: Added Warding Cry's `ABILITY_STATUS_EFFECT` entry (`{ effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' }`) to Spiritcaller slot 3 in `balance.ts`. Extended `GameRoom.ts`'s existing self-scope status-effect branch with an `else if (statusConfig?.scope === 'allies-in-zone')` arm: proximity-radius-only (no direction/cone, matching AC3's "self-centered Proximity/Radius"), using Task 1's `gatherPlayersInHitZone` with `dirX=dirY=0, hitRange=0, isDirectional=false`, applying the configured status effect to each gathered ally via the existing `applyStatusEffectToTarget` helper.
- **Scope decision, deliberately NOT implemented (flagged per the story's own Dev Notes ambiguity, not silently expanded):** the Dev Notes section raises whether `'shield'`'s actual damage-absorption *consumption* (subtracting from incoming damage in `player-health.ts#applyPlayerDamage`, which today only reads `'damageReduction'`) needs wiring in this story. `packages/game-rules/src/systems/player-health.ts` is **not** in this story's Allowed paths, and Task 4's own instructions stop at "apply `applyStatusEffect` to each gathered ally, broadcast `status:applied`" — they do not ask for a `player-health.ts` change. Per the ownership-enforcement rule (do not write outside Allowed paths without explicit approval), this story applies the `'shield'` status effect (satisfying AC3's literal wording — allies "receive a `'shield'` status effect") but does **not** wire its absorption behavior into damage resolution. Logged as a new deferred-work entry (see below) rather than silently expanding scope into `player-health.ts` or silently shipping a half-working shield that visually applies but never blocks damage.
- Resolved two previously-deferred findings from Story 3.15 (`deferred-work.md` D-3.15-A, D-3.15-B), both flagged in that story as "revisit when 3.17 lands": `healPlayer`'s downed/spirit-state guard and `resolveMixedFactionTargets`'s dead/downed filtering are both resolved **at the call site** — `gatherPlayersInHitZone` never returns a downed/spirit/frozen player, and the enemy gather always applies the existing `.isAlive` filter before either list reaches `resolveMixedFactionTargets` — so neither `healPlayer` nor `resolveMixedFactionTargets` themselves needed any change. Entries updated in `deferred-work.md` to reflect this.
- Tests: added 5 cases to `tests/unit/targeting.test.ts` (`resolveExpandingRadius`'s zero/linear-growth/cap/negative-clamp behavior, plus a synthetic hit-once-per-target sweep simulation combining the pure helper with a `hitIds`-style filter, proving the pattern GameRoom.ts's stateful bookkeeping relies on). Added 5 cases to `tests/unit/abilities.test.ts` (Ancestor's Voice mixed-faction split + damage/heal application via the actual game-rules primitives `GameRoom.ts` calls; Spirit Nova's balance-table sanity check for nonzero damage+heal; Warding Cry's shield status-effect application, including a check that magnitude=30 survives `applyStatusEffect` unclamped since `'shield'` is flat HP not a 0-1 fraction; Soul Mend's untouched-slot check; a no-other-class-has-allies-in-zone sanity check). Updated one pre-existing 3.16 test whose "no other class has a status-effect config yet" assertion was stale after this story populated Spiritcaller's slot 3 — narrowed to the classes still actually untouched (Souldrinker, Stormcaller).
- Full suite: `npm run typecheck` — 0 errors across all 10 project references. `npx vitest run` — 473 passed, 0 failed, 12 skipped (pre-existing skips, environment-dependent e2e tests requiring live Docker/Redis — unrelated to this story). `eslint` on all touched files — 0 issues introduced by this story (16 pre-existing `GameRoom.ts` findings, all at unrelated lines — `no-undef` for Node globals (`process`/`setInterval`/`setTimeout`/`fetch`/`clearInterval`/`clearTimeout`, an eslint-config gap) and pre-existing unused-import/param findings, confirmed by line-number cross-check against this story's diff).
- Confidence: 88% — every AC's literal wording is satisfied and all four tasks were implemented per their exact prescribed structure/signatures. The two points knocking this below 95%: (1) the `ABILITY_DAMAGE.spiritcaller[0]` balance-table bump (0→15) was necessary but not an explicit task bullet — a judgment call, though a well-reasoned and narrow one; (2) the deliberate non-implementation of shield-absorption consumption is a real scope gap the story's own Dev Notes flagged as ambiguous — I resolved it conservatively (Allowed-paths boundary wins, log as deferred work) rather than expanding scope, but a reviewer could reasonably argue AC3's "temporary flat damage absorption" implies the absorption must actually function this story, not just apply the label.

### Code Review (2026-07-14)

Three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) reviewed the diff against this story's ACs. 15 unique findings after dedup: 1 decision, 2 patch, 4 deferred, 8 dismissed.

- **Patched:** Spirit Nova's sweep was missing the Bond proximity-damage buff Ancestor's Voice already applies (`novaDamage` now checks `proximityBuffed.has(nova.casterId)`), and had no `session.phase === 'dungeon'` guard unlike every sibling per-tick combat block (now wrapped, so a sweep in flight when a run ends via boss defeat or run-failure stops dealing damage/healing into the post-run screen). Both confirmed by two independent review layers each; full suite re-run clean after the fix (473 passed, 0 regressions).
- **Deferred (user decision):** the Warding Cry shield-consumption gap flagged in this story's own Dev Notes — user chose to defer to a follow-up rather than expand this story's scope into `player-health.ts`. See `deferred-work.md` D-3.17-A.
- **Deferred (batch-wide, not unique to this story):** no GameRoom-level integration test coverage for the new wiring (D-3.17-B, same gap as D-3.16-A); the hit-once-per-target unit test validates a hand-rolled reimplementation rather than the shipped `hitIds` logic (D-3.17-C); `activeSpiritNovas` is cleared without a completion event on level transition/hub reset, dropping any not-yet-reached target (D-3.17-D, minor/rare); `resolveExpandingRadius` has an unguarded divide-by-zero on `durationMs=0`, unreachable today (D-3.17-E).
- **Dismissed** (false-premise, by-design, or already-verified-fine): Ancestor's Voice's AUTO+directional-cone targeting (verified against the pre-existing Avalanche ability and the mobile controller's touch-drag direction source — not new/untested behavior); casters excluded from their own Warding Cry/Spirit Nova buff (inherited, deliberate `resolveMixedFactionTargets` decision from Story 3.15); the duplicated damage/kill/essence-drop block across 3 call sites (matches this codebase's established convention, and this story's own Non-goals discourage a new shared abstraction); `activeSpiritNovas`'s two reset sites (verified via direct grep to be the only two, matching the `zones`/`projectiles` pattern exactly); the `ABILITY_DAMAGE.spiritcaller[0]` balance bump (independently verified reasonable by the Acceptance Auditor); a duplicated `?? 60` fallback (trivial, pre-existing style); the `isFrozen` exclusion in `gatherPlayersInHitZone` (spec-mandated — Task 1 explicitly said to mirror the proximity-revive guard, which includes `isFrozen`); `deferred-work.md` absent from the reviewed diff (review-process artifact — diff was deliberately scoped to code/test files, matching how prior stories' reviews handled this same doc-only file).

### File List

- `packages/game-rules/src/balance.ts` (modified — `ABILITY_HEAL_AMOUNT`, `SPIRIT_NOVA_DURATION_MS`, `SPIRIT_NOVA_MAX_RADIUS_PX`, Spiritcaller's `ABILITY_DAMAGE[0]` and `ABILITY_STATUS_EFFECT[3]` entries)
- `packages/game-rules/src/systems/targeting.ts` (modified — `resolveExpandingRadius`)
- `packages/game-rules/src/index.ts` (modified — new exports)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — `gatherPlayersInHitZone`, Ancestor's Voice/Spirit Nova/Warding Cry wiring, Spirit Nova sweep tick phase, `activeSpiritNovas` field + level/hub-reset clears)
- `tests/unit/abilities.test.ts` (modified — Spiritcaller kit rework test cases, one stale 3.16 assertion narrowed)
- `tests/unit/targeting.test.ts` (modified — `resolveExpandingRadius` test cases)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — D-3.15-A/B marked resolved; new shield-absorption deferral entry added)

### Change Log

- 2026-07-14: Implemented Story 3.17 — Spiritcaller's Ancestor's Voice (mixed-faction cone), Spirit Nova (expanding-radius mixed-faction sweep), and Warding Cry (allies-in-zone shield status effect). All tasks complete, all ACs satisfied, 0 regressions. Shield's damage-absorption consumption deliberately left unwired (outside Allowed paths — see Completion Notes and new deferred-work.md entry).
- 2026-07-14: Code review — 2 patches fixed (Spirit Nova sweep missing Bond proximity-damage buff; Spirit Nova sweep missing dungeon-phase guard), 1 finding escalated to a decision and deferred per user call (Warding Cry shield-absorption gap — see D-3.17-A), 4 findings deferred as pre-existing/batch-wide/minor (D-3.17-B through D-3.17-E), 8 dismissed as false-premise/by-design/verified-fine. Full suite re-run clean (473 passed, 0 regressions) after patches. Outcome: Approved.

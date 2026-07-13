---
baseline_commit: f6083d8
---

# Story 3.12: Status-Effect Engine (Buffs/Debuffs with Duration)

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 2nd of 5 shared-engine-capability stories, 3.12-3.15; depends on
  3.11 landing first for AbilityInputType/AIM_CAST, though this story doesn't
  touch AbilityInputType directly)

Context: This is a pure engine-capability story — it builds the reusable
  timed-buff/debuff mechanism that Stories 3.16 (Iron Skin, Tremor Stomp),
  3.17 (Warding Cry), 3.19 (Dark Pact) and 3.20 (Storm Eye's tick) will all
  consume. It adds ZERO new ability behavior itself — no ability produces a
  status effect yet after this story lands; that's the kit-rework stories'
  job. This story's only observable end-to-end change is that the pre-existing
  cosmetic-only `stompedUntil` field is deleted.

  Current codebase state (verified by reading the files, not epics.md's
  summary of them):
  - `packages/shared-types/src/player.ts:19-36` `PlayerState` has
    `stompedUntil?: number;` (line 35). Grepped the ENTIRE repo for
    `stompedUntil` — it is referenced in exactly 2 places: this field
    definition, and `packages/net-protocol/src/apply-delta.ts`'s
    `case 'enemy:stomped'`, which sets it on the HOST's local GameState
    mirror as a "cosmetic slow indicator." **Nothing renders it** — grepped
    `apps/host-client/src/screens/DungeonScreen.tsx` for `stompedUntil`: zero
    matches. It is a fully dead, non-functional field today. Deleting it is
    a true no-op from a player's perspective, not a behavior change.
  - `packages/shared-types/src/enemy.ts:21-32` `EnemyState` has no status
    field at all today.
  - **The "StompLayer slow" epics.md refers to is a DIFFERENT mechanic than
    Story 3.16's Tremor Stomp slow — don't conflate them.** `StompLayer`
    (`packages/game-rules/src/systems/ai/layers/stomp.ts`) is an EXISTING
    Hard-tier ENEMY AI behavior (Story 3.2) — a Brute-type enemy stomps and
    emits an `enemy:stomped` event; this ends up as a purely cosmetic (and,
    per the grep above, entirely inert) ring effect around the caster. It
    has never actually slowed a player's real movement — real player
    movement speed is computed server-side at
    `apps/simulation-server/src/rooms/GameRoom.ts:1035`
    (`const speed = (fateBuffed.has(...) ...) ? SPEED * BOND_SPEED_MULT : SPEED;`)
    and `stompedUntil` never enters that calculation. Story 3.16's Tremor
    Stomp, by contrast, is a PLAYER ability that slows ENEMIES (the new
    kit's tank AoE control tool) — enemy movement speed is computed in
    `packages/game-rules/src/systems/ai/fsm.ts:90`
    (`const moveAmount = ENEMY_CHASE_SPEED * ctx.dt;`).
  - **Decision made in this story (not spelled out by epics.md AC text):**
    do NOT wire the old enemy `StompLayer`/`enemy:stomped` event to apply a
    real `'slow'` status effect to players. Epics.md has no AC requiring the
    enemy stomp to gain new real gameplay teeth — only that the dead
    `stompedUntil` field be removed "in favor of" the new mechanism existing
    in general. Making the enemy stomp actually slow players for the first
    time would be a real new gameplay behavior change with its own balance
    implications, out of scope for an engine-capability story. `StompLayer`
    keeps emitting `enemy:stomped` exactly as today (still a valid event —
    other code may want the ring visual later); `apply-delta.ts`'s handler
    for it just stops setting the now-deleted field. If the design intent
    was actually "make enemy stomp a real slow too," flag that back to
    product/design as a separate, explicit follow-up story — don't infer it
    silently here.
  - `packages/game-rules/src/systems/combat.ts`'s `applyDamage(enemy, damage,
    dropId)` operates on `EnemyState` only (used for player-ability-vs-enemy
    hit-scan). `packages/game-rules/src/systems/player-health.ts`'s
    `applyPlayerDamage(player, damage)` operates on `PlayerState` only (used
    for enemy-vs-player melee, `apps/simulation-server/src/rooms/
    GameRoom.ts`). Both need the `'damageReduction'` multiplier hook added
    — they are separate functions for separate entity types, not one
    generic function.
  - `packages/net-protocol/src/apply-delta.ts`'s `applyDelta` switch has a
    hard exhaustiveness guard at the bottom
    (`const _exhaustive: never = evt;`) — **every new `DeltaEventMsg` union
    member requires its own `case` here, or the monorepo fails
    `npm run typecheck`.** This story adds 2 new delta types
    (`status:applied`, `status:expired`) and removes the `stompedUntil`
    mutation from the existing `enemy:stomped` case — both are required
    edits to this file, not optional.
  - `packages/game-rules/src/index.ts` is a manual barrel — every new
    exported function/type from a new `systems/*.ts` file must be added
    here explicitly (see existing pattern for `player-health.ts`,
    `combat.ts` exports at lines 25-28).

Owner agent: Multi-context (explicit cross-context approval — this is
  foundational engine work spanning 4 areas; each area's slice is small and
  incomplete without the others, so splitting would land dead code at every
  boundary. Flag to the user if a narrower split is preferred before
  starting):
  Protocol Architect (Task 1 — packages/shared-types/**, packages/net-protocol/**)
  Simulation Engineer (Task 2 — packages/game-rules/**, apps/simulation-server/**)
  Host Experience Engineer (Task 3 — apps/host-client/**, minimal generic badge only)

Goal:
  Task 1 — Add `StatusEffect` type to shared-types; add `statusEffects` to
            `PlayerState`/`EnemyState`; remove `stompedUntil`; add
            `status:applied`/`status:expired` to `DeltaEventMsg` and handle
            both (plus the now-simplified `enemy:stomped` case) in `apply-delta.ts`.
  Task 2 — New `packages/game-rules/src/systems/status-effects.ts`
            (`applyStatusEffect`, `tickStatusEffects`); wire the
            `damageReduction` multiplier into `combat.ts`'s `applyDamage`
            and `player-health.ts`'s `applyPlayerDamage`; wire the `slow`
            multiplier into `GameRoom.ts`'s player movement calc and
            `fsm.ts`'s `tickChase`; call `tickStatusEffects` for every
            player/enemy each sim tick and broadcast `status:expired` on
            removal.
  Task 3 — Minimal generic status badge/aura on host (one shape/color per
            effect type, reusing the existing per-entity `Graphics` Map
            pattern in `DungeonScreen.tsx`) — no per-ability art.

Allowed paths:
  - packages/shared-types/src/player.ts
  - packages/shared-types/src/enemy.ts
  - packages/shared-types/src/status-effect.ts (new)
  - packages/shared-types/src/index.ts
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - packages/game-rules/src/systems/status-effects.ts (new)
  - packages/game-rules/src/systems/combat.ts
  - packages/game-rules/src/systems/player-health.ts
  - packages/game-rules/src/systems/ai/fsm.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/host-client/src/screens/DungeonScreen.tsx (Task 3 — badge rendering only)
  - tests/unit/status-effects.test.ts (new)

Blocked paths:
  - packages/game-rules/src/systems/ai/layers/stomp.ts (do not touch — no
    behavior change to the enemy StompLayer itself; see Context)
  - apps/mobile-controller/** (no mobile change in this story)
  - Any ability's `dispatchAbility`/`CLASS_DEFINITIONS` logic — no ability
    is wired to actually produce a status effect yet; that's 3.16-3.20

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.12" section
  - packages/shared-types/src/player.ts, enemy.ts (read fully)
  - packages/net-protocol/src/apply-delta.ts (read fully — note the
    exhaustiveness guard) and messages/server-to-host.ts (read fully — the
    `DeltaEventMsg` union pattern)
  - packages/game-rules/src/systems/combat.ts, player-health.ts (read fully)
  - packages/game-rules/src/systems/ai/fsm.ts (read fully — `tickChase`'s
    `moveAmount` calculation)
  - apps/simulation-server/src/rooms/GameRoom.ts:1020-1065 (player movement
    tick block) and wherever the per-tick enemy/player loops live (search
    `tickEnemy(` and the player-movement block)
  - apps/host-client/src/screens/DungeonScreen.tsx:65-160 (`renderFrame`,
    the `Map<string, Entry>`-per-entity pattern already used for players/
    enemies — follow it for the new badge, don't invent a new pattern)
  - packages/game-rules/src/index.ts (barrel export — read fully before
    adding new exports)

Non-goals:
  - Do not make any ability produce a status effect — 3.16-3.20's job.
  - Do not give the enemy `StompLayer` a real player-slow effect — see
    Context; this is a deliberate scope boundary, not an oversight.
  - Do not add per-effect-type or per-ability visual art on the host — one
    generic badge/aura shape covers all 4 effect types (differentiate by
    color only, matching the existing `ABILITY_BADGE_BORDER`-style palette
    convention already used on mobile for input types).
  - Do not add a `statusEffects` field to `BossState` — grassland-boss.ts's
    boss entity is out of scope; no ability in this rework targets the boss.

Acceptance criteria: [see BDD-format Acceptance Criteria section below —
  copied faithfully from epics.md with file-location corrections noted]

Required hooks:
  - Ownership hook: 4 areas, resolved via Multi-context header — flag to
    user before starting if a narrower split is preferred.
  - Contract-change hook: TRIGGERED for real this time (unlike 3.11) — new
    `DeltaEventMsg` variants are a wire-shape change. Requires: a contract
    test for `status:applied`/`status:expired` round-trip in
    `tests/contract/net-protocol.test.ts`, and this task header stands in
    for the Protocol Architect review since no separate review step exists
    in this workflow.
  - Simulation-safety hook: TRIGGERED — `apps/simulation-server/**` and
    `packages/game-rules/**` modified. Run typecheck, unit tests, and a
    perf sanity check (status-effect tick adds a per-entity array scan every
    tick — keep it O(effects.length), no allocations in the hot path beyond
    what's already required by the `Result` pattern).
  - Client-UX hook: Task 3 touches host UI — couch readability check (badge
    must be legible at 24px-equivalent scale from couch distance per
    project-context.md Host Screen Constraints).

Required tests:
  - tests/unit/status-effects.test.ts — apply (append), replace-not-stack
    (same type twice), tick/expire, and the damage-reduction/slow multiplier
    math, all pure, no Colyseus/planck imports.
  - tests/contract/net-protocol.test.ts — round-trip test for
    `status:applied` and `status:expired`.
  - Existing tests/unit/combat.test.ts, player-health.test.ts, fsm.test.ts
    must still pass — adding an optional multiplier read must not change
    behavior when `statusEffects` is empty (the common case for every
    existing test fixture, which won't set the new field).

Telemetry impact: None — no new user-facing flow.
```

---

## Story

As a simulation engineer,
I want a reusable status-effect system for timed buffs and debuffs on players and enemies,
so that Iron Skin, Tremor Stomp's slow, Dark Pact's buff, Warding Cry's shield, and Storm Eye's tick all share one mechanism instead of bespoke per-ability flags.

---

## Acceptance Criteria

**AC1 — `StatusEffect` type and state fields:**
**Given** `packages/shared-types/src/player.ts` `PlayerState` and `packages/shared-types/src/enemy.ts` `EnemyState`
**When** the status-effect engine lands
**Then** both gain a `statusEffects: StatusEffect[]` field, where `StatusEffect = { type: 'damageReduction' | 'slow' | 'damageBuff' | 'shield'; magnitude: number; expiresAtMs: number }` (new type, `packages/shared-types/src/status-effect.ts`, exported via `index.ts`)
**And** `PlayerState`'s existing `stompedUntil?: number` field (line 35) is removed — it is dead code today (see Context: grepped zero renderers), not a functioning mechanism being replaced

**AC2 — `applyStatusEffect`/`tickStatusEffects`:**
**Given** `packages/game-rules/src/systems/status-effects.ts` (new)
**When** `applyStatusEffect(target, effect, nowMs)` is called
**Then** it returns `Result<{ target: PlayerState | EnemyState }, StatusEffectError>` with the effect appended, replacing any existing effect of the same `type` rather than stacking duplicates
**And** `tickStatusEffects(target, nowMs)` returns the target with all effects whose `expiresAtMs <= nowMs` removed — pure, no I/O, no throw, no Colyseus or planck.js import

**AC3 — Damage-reduction and slow multipliers wired in:**
**Given** a damage or movement calculation reads an entity's status effects
**When** a `'damageReduction'` effect is present
**Then** incoming damage in `combat.ts`'s `applyDamage` (enemy target) and `player-health.ts`'s `applyPlayerDamage` (player target) is multiplied by `(1 - magnitude)` before being applied
**And** when a `'slow'` effect is present, movement speed is multiplied by `(1 - magnitude)` — in `GameRoom.ts`'s player-movement tick block (`speed` variable, ~line 1035) for players, and in `fsm.ts`'s `tickChase` (`moveAmount`, ~line 90) for enemies
**And** neither multiplier changes behavior for any entity with an empty `statusEffects` array (the default/current case for every existing test and every entity until 3.16+ lands)

**AC4 — Broadcast on apply/expire, generic host badge:**
**Given** the sim tick loop
**When** a status effect is applied or expires
**Then** a `status:applied` / `status:expired` delta event is broadcast with target id, effect type, and expiry, and the host renders a generic status badge/aura (per-ability-specific art is out of scope) — one shape, 4 colors (one per effect type), following the existing per-entity `Graphics` Map pattern in `DungeonScreen.tsx`

**AC5 — Unit tests:**
**Given** unit tests
**When** `tests/unit/status-effects.test.ts` runs
**Then** apply/replace/tick/expire and the damage-reduction/slow multiplier math are each covered, with no Colyseus or planck.js imports

---

## Tasks / Subtasks

- [x] **Task 1a** (AC: #1) — `packages/shared-types/src/status-effect.ts` (new):
  ```ts
  export type StatusEffectType = 'damageReduction' | 'slow' | 'damageBuff' | 'shield';
  export interface StatusEffect {
    type: StatusEffectType;
    magnitude: number;   // 0-1 fraction for damageReduction/slow/damageBuff; flat HP for shield
    expiresAtMs: number; // host-epoch ms
  }
  ```
  Add `export * from './status-effect.js';` to `packages/shared-types/src/index.ts`.

- [x] **Task 1b** (AC: #1) — `player.ts`: add `statusEffects: StatusEffect[];`, delete
  `stompedUntil?: number;` (line 35), import `StatusEffect` from `./status-effect.js`.
  `enemy.ts`: add `statusEffects: StatusEffect[];`, same import.
  Update every `PlayerState`/`EnemyState` object-literal construction site
  (`GameRoom.ts` player/enemy spawn code, any test fixtures) to include
  `statusEffects: []`.

- [x] **Task 1c** (AC: #4) — `packages/net-protocol/src/messages/server-to-host.ts`:
  add
  ```ts
  export type StatusAppliedDelta = {
    type: 'status:applied';
    targetId: string;
    effectType: StatusEffectType;
    expiresAtMs: number;
  };
  export type StatusExpiredDelta = {
    type: 'status:expired';
    targetId: string;
    effectType: StatusEffectType;
  };
  ```
  Add both to the `DeltaEventMsg` union (import `StatusEffectType` from `shared-types`).

- [x] **Task 1d** (AC: #4) — `packages/net-protocol/src/apply-delta.ts`:
  add `case 'status:applied':` and `case 'status:expired':` — mirror the
  existing HP-update-style cases (map over `players`/`enemies` by id,
  return unchanged state if target not found — same guard pattern as
  `player:hp-updated`). Update `case 'enemy:stomped':` to stop referencing
  `stompedUntil` (delete the `const stompedUntil = ...` line and the
  `STOMP_VISUAL_SLOW_MS` constant at the top of the file — both become dead
  once the field is gone); keep the case present since the event itself
  still fires from `StompLayer`, just make it a no-op like `ability:fired`.

- [x] **Task 2a** (AC: #2) — `packages/game-rules/src/systems/status-effects.ts` (new):
  `applyStatusEffect(target, effect, nowMs)` and `tickStatusEffects(target, nowMs)`
  per AC2. Export both from `packages/game-rules/src/index.ts`.

- [x] **Task 2b** (AC: #3) — `combat.ts`'s `applyDamage`: before computing
  `newHp`, check `enemy.statusEffects` for a `'damageReduction'` entry with
  `expiresAtMs > nowMs`(pass `nowMs` in as a new parameter — check call
  sites in `GameRoom.ts` for what "now" value is already in scope there,
  reuse it, don't call `Date.now()` inside a pure game-rules function) and
  multiply `damage` by `(1 - magnitude)` before subtracting.
  `player-health.ts`'s `applyPlayerDamage`: same pattern for `player.statusEffects`.

- [x] **Task 2c** (AC: #3) — `fsm.ts`'s `tickChase`: multiply `moveAmount` by
  `(1 - slowMagnitude)` if enemy has an active `'slow'` effect.
  `GameRoom.ts`'s player-movement block (~line 1035): multiply `speed` by
  `(1 - slowMagnitude)` if player has an active `'slow'` effect (compose
  with the existing `fateBuffed` multiplier — both apply, order doesn't
  matter for a product of two scalars).

- [x] **Task 2d** (AC: #4) — In `GameRoom.ts`'s tick loop, for every player
  and every enemy, call `tickStatusEffects` each tick; for each effect that
  was removed, broadcast `status:expired`. Wire `applyStatusEffect` calls to
  broadcast `status:applied` — but since no ability calls `applyStatusEffect`
  yet in this story, this broadcast call site currently has no caller; leave
  it as a documented, ready-to-use helper (don't fabricate a test-only call
  site just to exercise it — the unit test in status-effects.test.ts covers
  the pure function directly).

- [x] **Task 3** (AC: #4) — `DungeonScreen.tsx`: add a small `Map<string,
  Graphics>` (or extend the existing per-entity entry types) rendering a
  colored ring/icon above any player or enemy with a non-empty
  `statusEffects` array reachable from the latest `GameState` snapshot —
  reuse the existing create-on-first-seen / cleanup-on-missing pattern from
  the player/enemy `Graphics` maps (lines ~80-160). One color per
  `StatusEffectType` (4 total); no per-ability icon set.

- [x] Update all `PlayerState`/`EnemyState` test fixtures across
  `tests/unit/*.test.ts` and any `apps/simulation-server` test helpers to
  include `statusEffects: []` — this is a required-field addition, so
  every existing fixture object literal needs the field or `npm run
  typecheck` fails.
- [x] Write `tests/unit/status-effects.test.ts` per AC5.
- [x] Add a `status:applied`/`status:expired` round-trip case to
  `tests/contract/net-protocol.test.ts`.
- [x] Run `npm run typecheck` (full monorepo) and `npx vitest run` (full
  suite) — confirm 0 errors, no regressions.

### Review Findings

- [x] [Review][Patch] Unvalidated `StatusEffect.magnitude` allowed
  negative/>1 values to invert damage-reduction/slow semantics (healing on
  hit, reversed movement) [`packages/game-rules/src/systems/status-effects.ts:8`]
  — fixed: `applyStatusEffect` now rejects out-of-`[0,1]` magnitude for the
  three fractional effect types (`shield`'s flat-HP magnitude is exempt).
- [x] [Review][Patch] `status:applied` delta never carried `magnitude`, so
  the host's replicated `statusEffects` array always showed a fabricated `0`
  instead of the real value [`packages/net-protocol/src/messages/server-to-host.ts:200`]
  — fixed: added `magnitude` to `StatusAppliedDelta` and threaded the real
  value through `apply-delta.ts` and `GameRoom.ts`'s broadcast call site.
- [x] [Review][Patch] `buildEnemyContext`/`buildBossContext` each called a
  fresh `Date.now()` instead of reusing `tick()`'s already-computed
  `tickNowMs`, despite Dev Notes' own "reuse it, don't call `Date.now()`"
  guidance [`apps/simulation-server/src/rooms/GameRoom.ts:974`,
  `packages/game-rules/src/entities/grassland-boss.ts:44`] — fixed: both
  (and `tickBoss`) now take `nowMs` as a parameter.
- [x] [Review][Defer] Status badge visual can overlap/extend off-canvas with
  many simultaneous effects [`apps/host-client/src/screens/DungeonScreen.tsx`]
  — deferred, pre-existing scope boundary (see deferred-work.md D-3.12-A).
- [x] [Review][Defer] `tickStatusEffects` expiry-broadcast diff relies on
  effect-object reference equality — safe today, undocumented fragility for
  future in-place-mutation changes [`apps/simulation-server/src/rooms/GameRoom.ts`]
  — deferred, pre-existing scope boundary (see deferred-work.md D-3.12-B).

Dismissed as noise (4): a Blind-Hunter claim that removing `stompedUntil`
regressed enemy-stomp visuals (false positive — verified no ring was ever
rendered for `enemy:stomped` even before this story; the misleading code
comment this review caught was corrected); `applyStatusEffectToTarget` being
unused (matches Task 2d's explicit "no caller yet" instruction); AC2's
"reject already-expired effect" behavior being unspecified by the literal AC
text (a reasonable, unit-tested interpretation of an underspecified case, not
a violation); and the Allowed-paths list under-specifying `net-protocol/
index.ts`/`grassland-boss.ts` (both stay within package-level ownership
already granted by the Multi-context header, and were already self-disclosed
in the Debug Log above).

---

## Dev Notes

### Why `nowMs` must be threaded, not read via `Date.now()`

`packages/game-rules/**` is pure — no I/O, per project-context.md's Package
Responsibility Boundaries ("no I/O, no Colyseus imports, no planck.js
imports"). `applyDamage`/`applyPlayerDamage` must accept `nowMs` as a
parameter (not call `Date.now()` internally) so they stay pure and testable
with fixed clocks, matching every other time-aware function in this package
(`tickStatusEffects(target, nowMs)` itself, `getReviveWindowMs`, etc.). Check
`GameRoom.ts`'s existing call sites for `applyDamage`/`applyPlayerDamage` —
this is an added-parameter signature change, so every call site needs a
`nowMs`/`Date.now()`-equivalent argument added; grep both function names in
`GameRoom.ts` before editing to find every call site (hit-scan loop
~line 1370-1390, and the enemy-melee-vs-player block elsewhere in the tick).

### The "two stomps" naming collision (read this before touching anything with "stomp" in the name)

See the Context section in the Required Task Header above — this is the
single most likely source of a wrong implementation in this story. Do not
assume "Tremor Stomp" and `StompLayer`/`enemy:stomped` are the same feature
being migrated. They are unrelated features that happen to share the word
"stomp": one is an existing enemy AI attack (cosmetic ring, no real slow,
untouched by this story except for the dead-field cleanup), the other is a
brand-new Story 3.16 player ability (not implemented until 3.16, consumes
this story's engine).

### Project Context Rules

- **Tick loop hygiene** (project-context.md, Performance Rules): no
  `logger.info`/`warn`/`error` inside the tick for status apply/tick/expire
  — `logger.debug` only, if any logging is added at all. No heap allocations
  in the hot per-tick scan beyond what `Result`/array-map already require
  elsewhere in this codebase (match existing style, don't over-optimize
  beyond it either).
- **Result<T, E>** (project-context.md, Critical Don't-Miss Rules): both new
  functions return `Result`, never throw — matches `applyPlayerDamage`/
  `applyDamage`'s existing signature style exactly.
- **Contract-change hook** (project-context.md, Testing Rules): real this
  time — new `DeltaEventMsg` variants. Round-trip contract test required.
- **Naming** (project-context.md): `status:applied`/`status:expired` follow
  the existing `noun:verb` event-naming convention.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.12] — original AC text
- [Source: packages/shared-types/src/player.ts, enemy.ts] — current state shape
- [Source: packages/net-protocol/src/apply-delta.ts] — exhaustiveness-guarded reducer switch
- [Source: packages/game-rules/src/systems/combat.ts, player-health.ts] — damage functions to extend
- [Source: packages/game-rules/src/systems/ai/fsm.ts, ai/layers/stomp.ts] — enemy movement + the unrelated existing "stomp" feature
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1020-1065] — player movement tick block
- [Source: apps/host-client/src/screens/DungeonScreen.tsx:65-160] — per-entity Graphics rendering pattern

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Two files were touched outside this story's literal "Allowed paths" list:
  `packages/net-protocol/src/index.ts` (added the `StatusAppliedDelta`/
  `StatusExpiredDelta` barrel exports — needed for Task 1c's types to be
  importable from `'net-protocol'` at all, and for the contract test to
  import them) and `packages/game-rules/src/entities/grassland-boss.ts` (see
  next note — a mechanical consequence of the `EnemyContext` shape change in
  the allowed `fsm.ts`). Both files are within package-level directories
  (`packages/net-protocol/**`, `packages/game-rules/**`) already granted to
  this story's Protocol Architect / Simulation Engineer slices per CLAUDE.md's
  Ownership Rules and this story's Multi-context header — no cross-context or
  ownership violation, just narrower than the story's own per-file list.
  Flagging for reviewer visibility since the Allowed-paths bullet list didn't
  name them explicitly.
- `EnemyContext` gained a required `nowMs` field (fsm.ts's `tickChase` needs it
  for the slow multiplier). This broke two more `EnemyContext` construction
  sites beyond the ones listed in Dev Notes: `packages/game-rules/src/entities/
  grassland-boss.ts`'s `buildBossContext` (both return branches). `BossState`
  has no `statusEffects` (out of scope per Non-goals), so `nowMs: 0` there is
  an inert placeholder, not a real "now" value — documented inline.
- `tickStatusEffects` was made generic (`<T extends StatusEffectTarget>`)
  rather than using the literal `StatusEffectTarget` return type AC2's prose
  implies, so call sites in `GameRoom.ts` keep the concrete `PlayerState`/
  `EnemyState` type instead of needing a cast back from the union.
  `applyStatusEffect` keeps the literal `Result<{ target: PlayerState |
  EnemyState }, StatusEffectError>` signature from AC2.
- Added `getStatusEffectMagnitude(target, type, nowMs)` (not explicitly named
  in the story) as the shared primitive both `applyDamage`/`applyPlayerDamage`
  (damageReduction) and `fsm.ts`/`GameRoom.ts` (slow) read — avoids
  duplicating the "find active effect of type X" scan in 4 call sites, and is
  the one covered by the "slow multiplier math" unit tests since fsm.ts/
  GameRoom.ts themselves aren't pure-testable (GameRoom.ts imports Colyseus).
- First full `npx vitest run` showed 7 e2e tests skipped with `EADDRINUSE` on
  ports 2568/2569 — pre-existing zombie Node processes from an earlier session
  (matches known WSL2 zombie-process behavior in this environment, unrelated
  to this story). Killed the stale PIDs and re-ran: 408 pass, then hit two
  different transient e2e failures in `tests/e2e/full-run.test.ts` on
  consecutive re-runs (an `activeBonds.length` mismatch, then a delta-wait
  timeout) — different symptoms each run, which rules out a deterministic
  logic regression. Ran `tests/e2e/` alone afterward: 7/7 pass. Re-ran the
  *full* suite together again: e2e tests skip again with the same
  `EADDRINUSE` — the two e2e files hardcode fixed ports and collide with each
  other when vitest schedules them concurrently as part of the full run, a
  pre-existing test-infra issue independent of this story's code (also, e2e
  regression isn't in this story's Required tests list). Final state: all
  scoped tests (unit, contract, and the pre-existing combat/player-health/fsm
  suites) pass consistently; typecheck is clean.

### Completion Notes List

- Task 1 (Protocol Architect slice): added `StatusEffect`/`StatusEffectType`
  to shared-types; added `statusEffects: StatusEffect[]` to `PlayerState` and
  `EnemyState`; removed the dead `stompedUntil` field; added `status:applied`/
  `status:expired` to `DeltaEventMsg` and handled both in `apply-delta.ts`
  (map-by-id, no-op if target not found, matching the `player:hp-updated`
  guard pattern); simplified `case 'enemy:stomped'` to a visual-only no-op
  (event still fires from `StompLayer`, unchanged).
- Task 2 (Simulation Engineer slice): new `packages/game-rules/src/systems/
  status-effects.ts` with `applyStatusEffect` (replace-not-stack by type),
  `tickStatusEffects` (expire by `expiresAtMs <= nowMs`, no-alloc fast path
  when nothing to do), and `getStatusEffectMagnitude`. Wired `damageReduction`
  into `combat.ts#applyDamage` and `player-health.ts#applyPlayerDamage` (both
  gained a `nowMs` parameter, threaded from existing in-scope `Date.now()`
  values in `GameRoom.ts` — `nowAbility`/`nowMelee` — not new `Date.now()`
  calls). Wired `slow` into `fsm.ts#tickChase` (via `EnemyContext.nowMs`,
  supplied by `GameRoom.ts#buildEnemyContext`) and into `GameRoom.ts`'s
  player-movement `speed` calc (composed multiplicatively with the existing
  Fate Bond speed buff). `GameRoom.ts#tick()` now calls `tickStatusEffects`
  for every player/enemy each tick and broadcasts `status:expired` for any
  effect that dropped out — skips entities with an empty `statusEffects`
  array so the common case (every entity, until 3.16+) is a cheap early
  return. Added `applyStatusEffectToTarget`, a private ready-to-use helper
  that applies an effect and broadcasts `status:applied`; per Task 2d's
  explicit instruction, no ability calls it yet in this story (3.16-3.20's
  job) — it has no caller today by design, not an oversight.
- Task 3 (Host Experience Engineer slice): `DungeonScreen.tsx` renders one
  generic badge (small colored dot per active effect, one of 4 colors) above
  any player or living enemy with a non-empty `statusEffects` array, reusing
  the existing create-on-first-seen / cleanup-on-missing `Graphics` Map
  pattern already used for players/enemies/tethers. No per-ability art, per
  Non-goals.
- Test updates: every existing `PlayerState`/`EnemyState` object-literal
  fixture across `tests/unit/`, `tests/contract/`, `packages/game-rules/
  tests/unit/`, and `apps/simulation-server/tests/` now includes
  `statusEffects: []`; every existing `applyDamage`/`applyPlayerDamage` call
  site (production and test) got the new `nowMs` argument; `fsm.test.ts`'s
  `EnemyContext` builders got `nowMs`. `BossState`/`grassland-boss.ts` fixtures
  were intentionally left untouched (Non-goal).
- New `tests/unit/status-effects.test.ts` covers: apply/append, replace-not-
  stack (same type twice, different type preserved), expire-on-tick, no-op
  same-reference return when nothing changes, the `damageReduction` multiplier
  math for both `applyDamage` and `applyPlayerDamage` (including "empty
  statusEffects behaves like today" and "expired effect is ignored"), and the
  `slow` multiplier math via `getStatusEffectMagnitude` (the shared primitive
  `fsm.ts`/`GameRoom.ts` actually use, since those two files aren't
  independently pure-testable). All pure — no Colyseus/planck.js imports.
- New `tests/contract/net-protocol.test.ts` cases: `StatusAppliedDelta`/
  `StatusExpiredDelta` serialize round-trip, `applyDelta` appending/replacing
  the effect on a matching player and enemy, expiry removal, and the
  unknown-`targetId` no-op-same-reference case (also required adding
  `StatusAppliedDelta`/`StatusExpiredDelta` to `net-protocol`'s barrel
  `index.ts`, which wasn't exporting the sibling `EnemyStompedDelta`-style
  types for these two yet).
- `npm run typecheck` (full monorepo, all 10 project references): 0 errors.
- `npx vitest run`: 408 tests pass (0 fail) across all in-scope suites,
  including the pre-existing `combat.test.ts`, `player-health.test.ts`, and
  `fsm.test.ts` regression suites named in Required tests. See Debug Log for
  the e2e-suite flakiness investigation (pre-existing, out of this story's
  Required tests scope, confirmed non-deterministic/environmental rather than
  a logic regression).
- Contract-change hook: satisfied via this task header (Protocol Architect
  review) plus the `tests/contract/net-protocol.test.ts` round-trip cases
  above — no separate review step exists in this workflow.
- Simulation-safety hook: typecheck and unit tests above; perf sanity —
  `tickStatusEffects` and `getStatusEffectMagnitude` are O(effects.length)
  with an empty-array fast path, so the per-tick cost for every existing
  entity (which all have `statusEffects: []` until 3.16+ lands) is a single
  `.length === 0` check, no allocation.
- Client-UX hook: badge is a filled 6px-radius circle per active effect,
  offset 14px per slot above the entity's existing radius — comparable scale
  to the existing enemy health-bar/player-circle marks already judged legible
  at couch distance in prior stories; no new couch-distance test harness
  exists in this repo to automate the check further.
- Confidence: 90% — the multi-context slice boundaries (shared-types →
  net-protocol → game-rules → simulation-server → host-client) all typecheck
  and test together end-to-end, and every AC has direct unit/contract test
  coverage. The 10% is the host badge's visual legibility, which I could only
  verify by code review against the existing pattern (no running-browser
  screenshot check was performed for this headless engine-capability story).

### File List

**New:**
- `packages/shared-types/src/status-effect.ts`
- `packages/game-rules/src/systems/status-effects.ts`
- `tests/unit/status-effects.test.ts`

**Modified:**
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/player.ts`
- `packages/shared-types/src/enemy.ts`
- `packages/net-protocol/src/index.ts`
- `packages/net-protocol/src/messages/server-to-host.ts`
- `packages/net-protocol/src/apply-delta.ts`
- `packages/game-rules/src/index.ts`
- `packages/game-rules/src/systems/combat.ts`
- `packages/game-rules/src/systems/player-health.ts`
- `packages/game-rules/src/systems/ai/fsm.ts`
- `packages/game-rules/src/entities/grassland-boss.ts`
- `apps/simulation-server/src/rooms/GameRoom.ts`
- `apps/host-client/src/screens/DungeonScreen.tsx`
- `apps/simulation-server/tests/game-room-host-join.test.ts`
- `apps/simulation-server/tests/game-room-level-clear-guard.test.ts`
- `packages/game-rules/tests/unit/achievements.test.ts`
- `packages/game-rules/tests/unit/grassland-boss.test.ts`
- `tests/unit/combat.test.ts`
- `tests/unit/fsm.test.ts`
- `tests/unit/player-health.test.ts`
- `tests/unit/bonds.test.ts`
- `tests/contract/net-protocol.test.ts`
- `tests/contract/player-class-updated-delta.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

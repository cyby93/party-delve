---
baseline_commit: f6083d8
---

# Story 3.15: Self-Cost Resource & Mixed-Faction Target Resolution

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — last of 5 shared-engine-capability stories; independent of
  3.12/3.13/3.14 content-wise. Story 3.19 (Blood Spike self-cost/lifesteal,
  Crimson Lash HP-scaling, Dark Pact drain) and Story 3.17 (Ancestor's Voice,
  Spirit Nova mixed-faction) consume this story.)

Context: Pure engine-capability story — two unrelated-but-bundled mechanisms
  (self-cost/lifesteal, and mixed-faction target splitting) that epics.md
  groups into one story because both are needed before the Souldrinker and
  Spiritcaller kit reworks (3.17, 3.19) can land. No ability uses either
  mechanism yet after this story — 3.17/3.19 wire them.

  Current codebase state:
  - `packages/game-rules/src/systems/abilities.ts`'s `dispatchAbility` is
    PURE and stateless regarding player HP — `AbilityDispatchContext` has no
    `casterHp` field, `AbilityFiredEvent` has no HP output. Self-cost and
    Crimson Lash's inverse-HP damage scaling both need the caster's CURRENT
    HP as an input to `dispatchAbility` — this requires an additive
    signature change (new optional-in-practice-but-required-by-type fields
    on `AbilityDispatchContext`/`AbilityFiredEvent`), not a new sibling
    function, so that self-cost reduction and HP-scaled damage resolve in
    the same place as every other per-fire ability calculation (matches
    epics.md's AC1 framing: "Given ... dispatchAbility ... When an ability
    has a self-cost ...").
  - `packages/game-rules/src/systems/player-health.ts` has NO heal function
    today — only `applyPlayerDamage` (which explicitly rejects negative
    `damage` with a `NEGATIVE_DAMAGE` error, so it cannot be repurposed for
    healing). Blood Spike's lifesteal (this story's AC2) needs a new
    `healPlayer(player, amount)` — and Story 3.17's Ancestor's
    Voice/Spirit Nova (mixed-faction ally heal) will need the exact same
    function. Add it here since AC2 already requires lifesteal healing;
    don't make 3.17 reinvent it.
  - `apps/simulation-server/src/rooms/GameRoom.ts`'s ability hit-scan loop
    (~line 1370-1390) iterates ONLY `this.gameState.enemies` — there is
    currently no code path that gathers nearby PLAYERS for an ability's hit
    zone at all (every ability to date only ever damages enemies).
    `resolveMixedFactionTargets` (this story) is the pure
    split-already-gathered-targets function; the CALLER (GameRoom.ts,
    wired in Story 3.17) is responsible for the actual "gather nearby
    players AND enemies in the hit zone" query — this story does not add
    that gathering loop itself (no ability needs it yet), only the pure
    splitting function it will call.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Simulation Engineer (all tasks — packages/game-rules/** only; no
  apps/simulation-server change needed since no ability calls any of this
  yet, and no packages/net-protocol change since all effects use existing
  `player:hp-updated`/`enemy:damaged` delta types)

Goal:
  Task 1 — `ABILITY_SELF_COST_HP` and `ABILITY_HP_SCALED_DAMAGE` tables in
            `balance.ts`; extend `AbilityDispatchContext`/`AbilityFiredEvent`
            with caster-HP fields; wire self-cost reduction and inverse-HP
            damage scaling into `dispatchAbility`.
  Task 2 — `healPlayer` in `player-health.ts`; lifesteal helper (pure
            percentage-of-damage-dealt calculation, capped at `maxHp`).
  Task 3 — `packages/game-rules/src/systems/targeting.ts` (new):
            `resolveMixedFactionTargets`.

Allowed paths:
  - packages/game-rules/src/systems/abilities.ts
  - packages/game-rules/src/systems/player-health.ts
  - packages/game-rules/src/systems/targeting.ts (new)
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - tests/unit/self-cost.test.ts (new), tests/unit/targeting.test.ts (new)

Blocked paths:
  - apps/simulation-server/** — no ability calls any of this yet; wiring is
    3.17 (mixed-faction) and 3.19 (self-cost/lifesteal/HP-scaling)
  - packages/shared-types/**, packages/net-protocol/** — no new state
    fields or wire types; all effects flow through existing
    `player:hp-updated`/`enemy:damaged` deltas once wired in 3.17/3.19
  - packages/shared-types/src/class-definitions.ts, CLASS_DEFINITIONS —
    no ability config changes here (that's 3.16-3.20's balance.ts tuning)

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.15" section
  - packages/game-rules/src/systems/abilities.ts (read fully — the exact
    current signature to extend)
  - packages/game-rules/src/systems/player-health.ts, combat.ts (read fully)
  - packages/game-rules/src/balance.ts (read fully — table shape convention:
    `Record<PlayerClass, readonly [number,number,number,number]>`, one entry
    per class's 4 ability slots, matching `ABILITY_DAMAGE`/
    `ABILITY_COOLDOWNS_MS`'s existing style exactly)

Non-goals:
  - Do not wire Blood Spike, Crimson Lash, or Dark Pact's actual ability
    behavior — Story 3.19.
  - Do not wire Ancestor's Voice or Spirit Nova's actual ability behavior —
    Story 3.17.
  - Do not add a "gather nearby players in hit zone" loop to GameRoom.ts —
    that's the calling story's job (3.17), this story only builds the pure
    split function it will call.
  - Do not add a stored `faction` field to `PlayerState`/`EnemyState` — per
    AC1, faction is derived structurally (which array/type the target came
    from), not stored.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED — `packages/game-rules/**` modified,
    including a signature change to the already-tested `dispatchAbility`.
    Run the FULL existing `tests/unit/abilities.test.ts` (from Story 3.11)
    to confirm the additive signature change doesn't break any existing
    call — every existing test constructs `AbilityDispatchContext` via
    object literal/spread (`{ ...baseCtx, ... }`), so a new required field
    will be a compile error in that test file until it's updated too (add
    `casterHp`/`casterMaxHp` to `baseCtx` in that file).
  - Ownership hook: single area — no split needed.

Required tests:
  - tests/unit/self-cost.test.ts — the 1-HP floor edge case (cost caps
    rather than blocks), lifesteal math (capped at maxHp), independent of
    any specific ability.
  - tests/unit/targeting.test.ts — mixed-faction split, independent of any
    specific ability.
  - tests/unit/abilities.test.ts (existing, from Story 3.11) — MUST be
    updated for the new required `AbilityDispatchContext` fields or it will
    fail to compile; add a regression test proving self-cost/HP-scaling are
    inert (no HP change, no damage change) for abilities with
    `ABILITY_SELF_COST_HP`/`ABILITY_HP_SCALED_DAMAGE` = 0, since that's
    every ability until 3.19 lands.

Telemetry impact: None.
```

---

## Story

As a simulation engineer,
I want a self-cost (HP-as-resource) mechanic and a single-query mixed-faction target resolver,
so that Blood Spike, Crimson Lash, and Dark Pact share one cost mechanism, and Ancestor's Voice/Spirit Nova share one targeting query instead of separate ally/enemy code paths.

---

## Acceptance Criteria

**AC1 — Self-cost with 1-HP floor:**
**Given** `packages/game-rules/src/systems/abilities.ts` `dispatchAbility`
**When** an ability has a self-cost defined in a new `ABILITY_SELF_COST_HP` table in `balance.ts` (0 for abilities without a cost)
**Then** the caster's HP is reduced by `min(selfCostHp, casterHp - 1)` before the ability resolves — a 1-HP safety floor that caps the cost rather than blocking the cast
**And** if the caster's HP is already 1, the ability still fires with zero HP actually deducted

**AC2 — Lifesteal:**
**Given** Blood Spike hits an enemy
**When** damage is applied
**Then** the caster is healed for 50% of the damage dealt (lifesteal = Damage+Heal fired together, not a new primitive) — this story provides `healPlayer` and the lifesteal percentage calculation; Story 3.19 wires the actual Blood Spike hit-resolution call
**And** on a miss (projectile expires without a hit), the self-cost HP is still lost with no compensating heal

**AC3 — Mixed-faction target resolution:**
**Given** `packages/game-rules/src/systems/targeting.ts` (new)
**When** a mixed-faction ability's already-gathered hit-zone targets are resolved
**Then** `resolveMixedFactionTargets(casterFaction, targetsInZone)` returns allies (receive the ability's heal value) and enemies (receive the ability's damage value) from one already-gathered target list — no separate ally-query/enemy-query paths
**And** a target's faction is derived from whether it is a `PlayerState` or `EnemyState`, with no new stored "faction" field

**AC4 — Inverse-HP damage scaling:**
**Given** Crimson Lash fires
**When** damage is calculated
**Then** damage scales inversely with the caster's current HP fraction via a new tunable `balance.ts` constant, verified by a test asserting damage increases as caster HP decreases

**AC5 — Unit tests:**
**Given** unit tests
**When** `tests/unit/self-cost.test.ts` and `tests/unit/targeting.test.ts` run
**Then** the 1-HP floor edge case, lifesteal math, and mixed-faction split are each covered independently of any specific ability

---

## Tasks / Subtasks

- [x] **Task 1a** (AC: #1, #4) — `balance.ts`: add
  `ABILITY_SELF_COST_HP: Record<PlayerClass, readonly [number,number,number,number]>`
  (all zeros for now — Story 3.19 sets Blood Spike's slot to a nonzero
  value) and `ABILITY_HP_SCALED_DAMAGE: Record<PlayerClass, readonly
  [number,number,number,number]>` (a scale coefficient, 0 = no scaling; all
  zeros for now — 3.19 sets Crimson Lash's slot). Export both from
  `packages/game-rules/src/index.ts`.

- [x] **Task 1b** (AC: #1, #4) — `abilities.ts`: add `casterHp: number;
  casterMaxHp: number;` to `AbilityDispatchContext`. In `dispatchAbility`,
  after computing base `damage` from `ABILITY_DAMAGE`:
  1. If `ABILITY_HP_SCALED_DAMAGE[class][idx] > 0`: recompute
     `damage = damage * (1 + scaleCoef * (1 - ctx.casterHp / ctx.casterMaxHp))`
     (exact curve is a balance tuning call for Story 3.19 to finalize via
     the coefficient's value — this story just needs the mechanism to
     satisfy AC4's test: damage strictly increases as `casterHp` decreases,
     all else equal).
  2. Compute `selfCostHp = Math.min(ABILITY_SELF_COST_HP[class][idx],
     Math.max(ctx.casterHp - 1, 0))`.
  Add `selfCostHpApplied: number` to `AbilityFiredEvent`, set to the value
  from step 2. Caller (GameRoom.ts, wired in 3.19) is responsible for
  actually subtracting this from `player.hp` and broadcasting
  `player:hp-updated` — `dispatchAbility` stays pure, it only reports the
  cost, it doesn't mutate any player state itself (it never has, for any
  field — this is consistent with its existing purity).

- [x] **Task 2a** (AC: #2) — `player-health.ts`: add
  ```ts
  export function healPlayer(player: PlayerState, amount: number): PlayerState {
    return { ...player, hp: Math.min(player.maxHp, player.hp + Math.max(amount, 0)) };
  }
  ```
  (No `Result` needed — healing can't meaningfully fail, matches
  `isInHitZone`'s plain-return style, not `applyPlayerDamage`'s
  `Result`-return style — healing has no error condition to report.)

- [x] **Task 2b** (AC: #2) — Lifesteal percentage helper — either a small
  pure function `calculateLifesteal(damageDealt: number, pct: number):
  number` in `player-health.ts` (trivial enough it may not need its own
  file — dev agent's call; if it's just `damageDealt * pct` inline at the
  3.19 call site, a dedicated function may be unnecessary ceremony, but a
  named export makes the 50% figure a named, testable constant rather than
  a magic number scattered at the call site — lean toward extracting it) and
  add `ABILITY_LIFESTEAL_PCT: Record<PlayerClass, readonly
  [number,number,number,number]>` to `balance.ts` (0 for all except
  Souldrinker slot 0 = Blood Spike, set to `0.5` — wait, per Non-goals this
  story shouldn't set ability-specific values that belong to 3.19's
  "Souldrinker Kit Rework" scope; set Blood Spike's slot to `0.5` here ONLY
  if you judge the constant belongs in this story's declarative table setup
  rather than 3.19's — recommend leaving all `ABILITY_LIFESTEAL_PCT`
  entries at 0 in this story, matching the "no ability uses this yet"
  pattern of `ABILITY_SELF_COST_HP`/`ABILITY_HP_SCALED_DAMAGE` above, and
  let 3.19 set Blood Spike's actual 50% value alongside its other tuning).

- [x] **Task 3** (AC: #3) — `packages/game-rules/src/systems/targeting.ts`:
  ```ts
  import type { PlayerState, EnemyState } from 'shared-types';

  export interface MixedFactionSplit {
    allies: PlayerState[];
    enemies: EnemyState[];
  }

  export function resolveMixedFactionTargets(
    casterId: string,
    targetsInZone: Array<PlayerState | EnemyState>,
  ): MixedFactionSplit {
    const allies: PlayerState[] = [];
    const enemies: EnemyState[] = [];
    for (const t of targetsInZone) {
      if ('class' in t) {
        if (t.id !== casterId) allies.push(t); // exclude caster from their own AoE
      } else {
        enemies.push(t);
      }
    }
    return { allies, enemies };
  }
  ```
  (`'class' in t` distinguishes `PlayerState` from `EnemyState` structurally
  — `PlayerState` has a `class` field, `EnemyState` doesn't; this is the
  "derived from whether it is a PlayerState or EnemyState" AC1 language
  translated into an actual runtime check, since TypeScript has no runtime
  type tags here. Verify this discriminator is unambiguous by re-reading
  both interfaces before implementing — confirm no `EnemyState` field is
  named `class` and no `PlayerState` field ever contains a value that could
  collide.) Excluding the caster from their own AoE is a judgment call, not
  explicit in epics.md's AC — flag it as such in code comments; if 3.17
  needs self-targeting for some future ability, this is the function to
  revisit, not to work around at the call site. Export from `index.ts`.

- [x] Update `tests/unit/abilities.test.ts`'s `baseCtx` fixture to include
  `casterHp`/`casterMaxHp` (e.g. `casterHp: 100, casterMaxHp: 100`) so the
  existing 8 tests still compile and pass unchanged (all
  `ABILITY_SELF_COST_HP`/`ABILITY_HP_SCALED_DAMAGE` entries are 0, so
  behavior is identical to before this story).
- [x] Write `tests/unit/self-cost.test.ts`, `tests/unit/targeting.test.ts` per AC5.
- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

### Review Findings

- [x] [Review][Patch] Divide-by-zero/NaN risk in `calculateHpScaledDamage` when `casterMaxHp <= 0` [packages/game-rules/src/systems/abilities.ts:34] — fixed, guard added alongside the existing `scaleCoef <= 0` check.
- [x] [Review][Defer] `healPlayer` doesn't guard/reset `isDown`/`isSpirit` state [packages/game-rules/src/systems/player-health.ts:52] — deferred, pre-existing story-scope gap (see deferred-work.md D-3.15-A).
- [x] [Review][Defer] `resolveMixedFactionTargets` doesn't filter dead enemies or downed/spirit allies out of the split [packages/game-rules/src/systems/targeting.ts:14] — deferred, pre-existing story-scope gap (see deferred-work.md D-3.15-B).

---

## Dev Notes

### Why `dispatchAbility` gains fields instead of a new wrapper function

Epics.md's AC1 is explicit that this lives inside `dispatchAbility`, and it's
the right call structurally too: self-cost and HP-scaled damage are both
per-fire, caster-HP-dependent calculations that need to happen exactly once,
in the same place `cooldownMs`/`damage`/`direction` are already resolved —
splitting them into a second function GameRoom.ts must remember to call in
the right order (before/after `dispatchAbility`?) invites a bug where one is
forgotten. One function, one call site, all per-fire math resolved together.

### `casterMaxHp` is required, not derivable

`PlayerState.maxHp` (packages/shared-types/src/player.ts:26) is the only
source for the HP-fraction denominator in AC4's inverse scaling — there is
no fixed "100" constant to assume; different classes/future gear could have
different max HP. Always read it from the actual `PlayerState`, never
hardcode.

### Project Context Rules

- **Result<T, E>**: `dispatchAbility` keeps returning `Result` (unchanged,
  additive fields only). `healPlayer` does NOT need `Result` — it cannot
  fail. Match the existing per-function judgment call already present in
  this codebase (`isInHitZone` returns a plain boolean, `applyDamage`
  returns `Result`) rather than applying `Result` mechanically everywhere.
- **Configuration Hierarchy** (project-context.md): all new tunables go in
  `packages/game-rules/src/balance.ts`, matching `ABILITY_DAMAGE`'s
  existing `Record<PlayerClass, readonly [4-tuple]>` shape exactly — don't
  invent a different table shape for the new constants.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.15]
- [Source: packages/game-rules/src/systems/abilities.ts] — `dispatchAbility`, `AbilityDispatchContext`, `AbilityFiredEvent`
- [Source: packages/game-rules/src/systems/player-health.ts] — `applyPlayerDamage` (existing pattern; note it rejects negative damage, cannot be reused for healing)
- [Source: packages/game-rules/src/balance.ts] — existing `Record<PlayerClass, [4-tuple]>` table convention
- [Source: tests/unit/abilities.test.ts] — existing tests that must be updated for the new required context fields

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — no failures encountered; typecheck and full test suite passed on first run after the GameRoom.ts scope exception (see Completion Notes).

### Completion Notes List

- Task 1a: Added `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, and `ABILITY_LIFESTEAL_PCT` tables to `balance.ts` (all-zero, matching the existing `Record<PlayerClass, [4-tuple]>` convention), exported from `index.ts`.
- Task 1b: Added `casterHp`/`casterMaxHp` to `AbilityDispatchContext` and `selfCostHpApplied` to `AbilityFiredEvent`. Extracted the self-cost and HP-scaling math into two standalone pure functions, `calculateSelfCostHp` and `calculateHpScaledDamage` (exported from `index.ts`), rather than inlining the formulas directly in `dispatchAbility` — this let AC1/AC4/AC5's "independent of any specific ability" requirement be tested directly against the formulas without needing any real balance-table entry to be nonzero (every entry is 0 until Story 3.19). `dispatchAbility` calls both and stays pure — it reports `selfCostHpApplied`, it does not mutate any player state.
- Task 2a/2b: Added `healPlayer` (capped at `maxHp`, no `Result` — matches `isInHitZone`'s plain-return convention since healing can't fail) and `calculateLifesteal` (pure percentage-of-damage helper) to `player-health.ts`.
- Task 3: Created `packages/game-rules/src/systems/targeting.ts` with `resolveMixedFactionTargets`, using the `'class' in t` structural check to distinguish `PlayerState` from `EnemyState` (verified against both interfaces — `PlayerState` has `class`, `EnemyState` does not, no collision risk). Caster is excluded from their own AoE ally list per the story's explicit judgment-call flag.
- **Scope exception (flagged to user, approved):** the additive `AbilityDispatchContext` fields broke an existing `dispatchAbility` call site in `apps/simulation-server/src/rooms/GameRoom.ts` (line ~1640) that predates this story — the story's Blocked-paths note assumed "no ability calls any of this yet," which was true for the self-cost/HP-scaling *mechanism* but not for the base `dispatchAbility` call itself. Asked the user; approved a minimal 2-line addition (`casterHp: player.hp, casterMaxHp: player.maxHp`) to keep the build green. No new behavior wired — `selfCostHpApplied` is still not consumed by any caller (that remains Story 3.19's job).
- Updated `tests/unit/abilities.test.ts`'s `baseCtx` fixture with `casterHp`/`casterMaxHp: 100` and added a regression test proving self-cost/HP-scaling are inert (zero cost, unchanged damage) across every class/slot while all balance tables are zero.
- Wrote `tests/unit/self-cost.test.ts` (1-HP floor edge case, zero-HP-already case, HP-scaled damage monotonicity, `healPlayer` cap, `calculateLifesteal` math) and `tests/unit/targeting.test.ts` (mixed-faction split, caster self-exclusion, empty list, all-enemy list) per AC5.
- Full suite: `npm run typecheck` — 0 errors. `npx vitest run` — 462 passed, 0 failed, 7 skipped (pre-existing skips, unrelated to this story).
- Confidence: 95% — mechanism-level implementation matches the story's explicit formulas and Dev Notes exactly; the only judgment calls (GameRoom.ts touch, extracting pure functions instead of inlining) were either user-approved or directly serve an AC's explicit testability requirement.

### File List

- `packages/game-rules/src/balance.ts` (modified)
- `packages/game-rules/src/systems/abilities.ts` (modified)
- `packages/game-rules/src/systems/player-health.ts` (modified)
- `packages/game-rules/src/systems/targeting.ts` (new)
- `packages/game-rules/src/index.ts` (modified)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — minimal scope exception, see Completion Notes)
- `tests/unit/abilities.test.ts` (modified)
- `tests/unit/self-cost.test.ts` (new)
- `tests/unit/targeting.test.ts` (new)

### Change Log

- 2026-07-13: Implemented Story 3.15 — self-cost HP mechanism, inverse-HP damage scaling, lifesteal helpers, and mixed-faction target resolution. All tasks complete, all ACs satisfied, 0 regressions.

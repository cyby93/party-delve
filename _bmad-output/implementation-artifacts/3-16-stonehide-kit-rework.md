---
baseline_commit: f6083d8
---

# Story 3.16: Stonehide Kit Rework

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 1st of 5 per-class kit-rework stories; depends on 3.11
  (AbilityInputType corrections — already applied to Stone Wall/Tremor Stomp),
  3.12 (status-effect engine), 3.14 (displacement) all landing first)

Context: First story to actually consume the shared engine capabilities
  (3.12, 3.14) built by the earlier stories in this batch — everything up to
  now was plumbing with no visible gameplay change. This story is where that
  changes: Iron Skin and Stone Wall stop being no-ops.

  Current codebase state:
  - `apps/simulation-server/src/rooms/GameRoom.ts`'s ability hit-scan loop
    (~line 1342-1390, inside the `if (inDungeon) { ... }` block after
    `dispatchAbility` succeeds) currently: broadcasts `ability:fired`, then
    for abilities with `damage > 0` only, iterates `this.gameState.enemies`
    and applies `applyDamage` to each enemy inside `isInHitZone`. Abilities
    with `damage === 0` (Iron Skin today) are skipped entirely by the
    `if (rawDamage <= 0) continue;` guard (line ~1359) — this is exactly why
    Iron Skin currently does nothing.
  - **This story introduces a new declarative per-ability status-effect
    config table** (not present before this story) so Iron Skin's self-buff
    doesn't require a hardcoded `if (class === STONEHIDE && index === 2)`
    branch in `GameRoom.ts` — matching the "declarative config, not
    special-cased branch" precedent Story 3.13's AC4 already established
    for projectile→zone chaining. Add to `balance.ts`:
    ```ts
    export type StatusEffectScope = 'self' | 'enemies-in-zone' | 'allies-in-zone';
    export interface AbilityStatusEffectConfig {
      effectType: StatusEffectType; magnitude: number; durationMs: number; scope: StatusEffectScope;
    }
    export const ABILITY_STATUS_EFFECT: Record<PlayerClass, readonly [AbilityStatusEffectConfig | null, ...]> = { ... };
    ```
    This table is introduced HERE (not in Story 3.12) because 3.12 is
    pure engine capability with zero ability-specific data; this table is
    ability-specific tuning data, which belongs with the kit-rework stories
    that actually populate it. Story 3.17 (Warding Cry) and 3.20 (Storm
    Eye's tick, though Storm Eye uses the Zone mechanism instead — check
    epics.md's Story 3.20 text again before assuming) will ADD entries to
    this same table, not invent their own.
  - `'enemies-in-zone'` scope reuses the EXISTING hit-scan loop's enemy
    iteration (no new query needed — Tremor Stomp and Stone Wall both hit
    enemies, which the loop already gathers). `'self'` scope (Iron Skin)
    needs no zone query at all — just look up the caster's own `PlayerState`
    by `clientId` (already in scope in the ability-dispatch block as
    `player`) and call `applyStatusEffect` directly.
    `'allies-in-zone'` scope is NOT needed by anything in this story (no
    Stonehide ability targets allies) — do not build that query here, it's
    Story 3.17's job when Warding Cry needs it.
  - Displacement (Story 3.14): `applyDisplacement` returns `{dx, dy}`; per
    3.14's corrected implementation notes, apply it via DIRECT position
    mutation (`enemy.x += dx; enemy.y += dy`), NOT `body.applyLinearImpulse`
    — the existing `body.setPosition(...)` sync in the Enemy AI phase
    (~line 1200) picks up the new `enemy.x/y` automatically next tick. Do
    not reintroduce an impulse-based approach; re-read Story 3.14's Context
    section if unsure why.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Protocol Architect (Task 1 — packages/shared-types/** only if a new delta
    payload shape is needed; likely NOT needed since `status:applied` from
    3.12 already carries what's needed — verify before assuming a change is
    required here)
  Simulation Engineer (Tasks 2, 3 — packages/game-rules/**, apps/simulation-server/**)

Goal:
  Task 1 — `ABILITY_STATUS_EFFECT` table in `balance.ts`, with Iron Skin's
            (`self`, `damageReduction`) and Tremor Stomp's (`enemies-in-zone`,
            `slow`) entries populated; other slots `null`.
  Task 2 — Wire `GameRoom.ts`'s ability-dispatch block: `self`-scope status
            application (Iron Skin); extend the existing enemy hit-scan loop
            to also apply `enemies-in-zone`-scope status effects (Tremor
            Stomp) alongside existing damage; extend it to also apply
            displacement per-hit-enemy when the firing ability is Stone Wall
            (a new `ABILITY_DISPLACEMENT_STRENGTH` table entry, 0 for
            abilities without displacement, non-zero for Stone Wall only).
  Task 3 — Confirm Avalanche (unchanged) via existing test coverage; no code
            change to Avalanche's dispatch path.

Allowed paths:
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - tests/unit/abilities.test.ts

Blocked paths:
  - packages/shared-types/src/class-definitions.ts (no name/inputType
    changes needed — 3.11 already corrected Stonehide's input types)
  - packages/net-protocol/** (reuse `status:applied` from 3.12 and
    `enemy:damaged`/`enemy:moved` — verify no new field is actually needed
    before touching this; if verification shows a gap, note it explicitly
    rather than silently expanding scope)
  - Any other class's abilities (Spiritcaller, Souldrinker, Stormcaller) —
    Stories 3.17, 3.19, 3.20

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.16" section
  - _bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md — `applyStatusEffect`/`tickStatusEffects` signatures
  - _bmad-output/implementation-artifacts/3-14-displacement-pull-physics-primitive.md — `applyDisplacement` signature and the impulse-vs-position-mutation correction
  - apps/simulation-server/src/rooms/GameRoom.ts:1330-1400 (ability-dispatch + hit-scan block — read fully, current state as of 3.11's baseline; line numbers will have shifted after 3.12/3.13/3.14 land — re-locate by searching for `dispatchAbility(` and `isInHitZone(`)
  - packages/game-rules/src/balance.ts (current `ABILITY_DAMAGE`/`ABILITY_HIT_RADIUS_PX` values for Stonehide, to confirm which slot is which ability)

Non-goals:
  - Do not touch Spiritcaller/Souldrinker/Stormcaller abilities.
  - Do not build the `'allies-in-zone'` scope or its gathering query — not
    needed by any Stonehide ability.
  - Do not add new delta/wire types unless verification proves the existing
    `status:applied`/`enemy:damaged`/`enemy:moved` events are insufficient
    (they should be sufficient — this is a check, not an expected finding).

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED. Run full test suite — this story
    changes shared `GameRoom.ts` dispatch code that every class's abilities
    flow through, so a regression here could silently break other classes'
    (still-placeholder) abilities too.
  - Ownership hook: 1-2 areas depending on whether a shared-types touch
    proves necessary (see Blocked paths note).

Required tests:
  - tests/unit/abilities.test.ts — dedicated test cases for Iron Skin's
    damage reduction (status effect applied to caster), Tremor Stomp's
    damage+slow (both applied to each enemy in radius), and Stone Wall's
    damage+pull (displacement applied toward caster position). Confirm
    Avalanche's existing test coverage still passes unchanged.

Telemetry impact: None.
```

---

## Story

As a player,
I want Stonehide's full kit — Iron Skin, Avalanche, Tremor Stomp, Stone Wall — implemented per the final spec,
so that Stonehide plays as a gather/mitigate/control/sustain tank instead of shipping two placeholder abilities.

---

## Acceptance Criteria

**AC1 — Iron Skin (`TAP`, Self):**
**Given** Iron Skin fires
**When** the ability resolves
**Then** a `'damageReduction'` status effect (magnitude and duration from new `balance.ts` constants) is applied to the caster via `applyStatusEffect`, replacing the current damage=0 no-op

**AC2 — Tremor Stomp (`TAP` after Story 3.11, self-centered Proximity/Radius):**
**Given** Tremor Stomp fires
**When** it resolves
**Then** all enemies within `ABILITY_HIT_RADIUS_PX` of the caster take AoE damage and receive a `'slow'` status effect (magnitude/duration from `balance.ts`)

**AC3 — Stone Wall (`RELEASE` after Story 3.11, Cone/Line, long reach):**
**Given** Stone Wall fires
**When** it resolves
**Then** every enemy in the cone takes Stone Wall's configured damage and is pulled toward the caster via `applyDisplacement`

**AC4 — Avalanche unchanged:**
**Given** Avalanche (basic attack) fires (`AUTO`, Cone/Line)
**When** it resolves
**Then** it deals its existing configured damage unchanged — this story only confirms no regression via existing test coverage

**AC5 — Tests:**
**Given** `tests/unit/abilities.test.ts`
**When** Stonehide's full kit is exercised
**Then** Iron Skin's damage reduction, Tremor Stomp's damage+slow, and Stone Wall's damage+pull each have a dedicated test case

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2, #3) — `balance.ts`: add `ABILITY_STATUS_EFFECT`
  table (see Context for shape). Stonehide entries:
  - slot 0 (Stone Wall): `null` (Stone Wall's effect is displacement, not a
    status effect — handled by a separate table, Task 1b)
  - slot 1 (Tremor Stomp): `{ effectType: 'slow', magnitude: <tunable, e.g. 0.4>, durationMs: <tunable, e.g. 2000>, scope: 'enemies-in-zone' }`
  - slot 2 (Iron Skin): `{ effectType: 'damageReduction', magnitude: <tunable, e.g. 0.3>, durationMs: <tunable, e.g. 3000>, scope: 'self' }`
  - slot 3 (Avalanche): `null`
  Add `ABILITY_DISPLACEMENT_STRENGTH: Record<PlayerClass, readonly
  [number,number,number,number]>` (0 = no displacement); Stonehide slot 0
  (Stone Wall) gets a nonzero tunable value, all other slots (all classes)
  0 for now.

- [x] **Task 2a** (AC: #1) — `GameRoom.ts`, in the ability-dispatch block,
  after a successful `dispatchAbility` result and BEFORE (or independent of)
  the existing damage hit-scan: look up
  `ABILITY_STATUS_EFFECT[player.class][abilityIndex]`; if non-null and
  `scope === 'self'`, call `applyStatusEffect(player, { type: effectType,
  magnitude, expiresAtMs: nowMs + durationMs }, nowMs)`, apply the returned
  target back into `this.gameState.players`, broadcast `status:applied`.

- [x] **Task 2b** (AC: #2) — In the existing enemy hit-scan `for` loop
  (iterates `this.gameState.enemies`, checks `isInHitZone`): after applying
  damage to a hit enemy, if `ABILITY_STATUS_EFFECT[...]?.scope ===
  'enemies-in-zone'`, also call `applyStatusEffect` on that enemy with the
  configured effect, apply the result back into `this.gameState.enemies`,
  broadcast `status:applied`. Note: Tremor Stomp's damage is nonzero (15 in
  current balance table... verify against `ABILITY_DAMAGE`, don't assume),
  so it already passes the `rawDamage <= 0 continue` guard and enters this
  loop today — this task ADDS the status-effect call alongside the existing
  damage call, it doesn't change the loop's entry condition.

- [x] **Task 2c** (AC: #3) — In the same hit-scan loop, if
  `ABILITY_DISPLACEMENT_STRENGTH[player.class][abilityIndex] > 0`
  (Stone Wall), after applying damage to a hit enemy, call
  `applyDisplacement(enemy.x, enemy.y, player.x, player.y, strength)` (using
  the caster's position AT CAST TIME — capture `player.x`/`player.y` once
  before the loop, not re-read per-iteration, in case the caster's own
  position could theoretically change mid-loop, which it can't today but
  don't rely on that) and mutate `enemy.x += dx; enemy.y += dy` directly
  (per 3.14's corrected pattern — the existing Enemy AI phase's
  `body.setPosition` sync picks this up automatically; no explicit
  `body.setPosition` call needed here for enemies, only for players per
  3.14's docs, and Stone Wall never displaces a player).

- [x] **Task 3** — No code change for Avalanche. Confirm its existing
  `tests/unit/abilities.test.ts` coverage (from Stories 3.3/3.11) still
  passes.

- [x] Add Iron Skin/Tremor Stomp/Stone Wall test cases to
  `tests/unit/abilities.test.ts` per AC5, following this file's existing
  per-ability test style (see Story 3.11's rewrite of this file for the
  current baseline structure).
- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

### Review Findings

- [x] [Review][Patch] Displaced enemy position never broadcast to clients, surfacing as a teleport [apps/simulation-server/src/rooms/GameRoom.ts:1107] — fixed, `applyDisplacementToEnemy` now repositions the physics body and broadcasts `enemy:moved` immediately, mirroring `applyDisplacementToPlayer`.
- [x] [Review][Patch] Test hardcoded `durationMs` as `expiresAtMs`, obscuring the real `nowAbility + durationMs` contract [tests/unit/abilities.test.ts:176] — fixed, tests now name an explicit `nowMs` local.
- [x] [Review][Defer] `GameRoom.ts`'s ability-dispatch/hit-scan block has no direct integration test coverage [apps/simulation-server/src/rooms/GameRoom.ts:1675] — deferred, batch-wide gap across all 3.12-3.15 kit-rework stories, not unique to this one (see deferred-work.md D-3.16-A).

---

## Dev Notes

### `ABILITY_STATUS_EFFECT` and `ABILITY_DISPLACEMENT_STRENGTH` are separate tables, not one

Stone Wall needs displacement but not a status effect; Tremor Stomp needs a
status effect but not displacement; a future ability could theoretically
need both. Keeping them as two independent per-slot tables (both defaulting
to "no effect" — `null` / `0`) avoids forcing every ability into one
combined shape that most slots would leave mostly empty, and matches this
codebase's existing convention of one focused table per concern
(`ABILITY_DAMAGE`, `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX` are
already separate tables for the same reason).

### Verify before assuming: does `status:applied`'s existing shape carry enough?

Story 3.12 defined `StatusAppliedDelta { type: 'status:applied'; targetId:
string; effectType: StatusEffectType; expiresAtMs: number; }`. Confirm this
is sufficient for the host to render Iron Skin's badge on the caster and
Tremor Stomp's badge on each hit enemy (it should be — `targetId` covers
both player and enemy ids) before assuming any change to
`packages/net-protocol/**` is needed. If it IS sufficient, this story
touches zero files outside `packages/game-rules` and
`apps/simulation-server` — narrower ownership than the header's
"Multi-context" caveat allows for; update the header if so once confirmed
during implementation.

### Project Context Rules

- **Tick loop hygiene**: no new logging inside the hit-scan loop beyond
  `logger.debug` if needed.
- **Result<T, E>**: `applyStatusEffect`/`applyDisplacement` already return
  the right shapes per their own stories (3.12, 3.14) — this story just
  calls them, no new fallible operations introduced here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.16]
- [Source: _bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md]
- [Source: _bmad-output/implementation-artifacts/3-14-displacement-pull-physics-primitive.md]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — ability-dispatch + hit-scan block (re-locate by symbol search, line numbers will have shifted)
- [Source: packages/game-rules/src/balance.ts] — existing Stonehide `ABILITY_DAMAGE`/`ABILITY_HIT_RADIUS_PX` values

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

None — no failures during implementation; typecheck and full test suite passed on first run.

### Completion Notes List

- Task 1: Added `ABILITY_STATUS_EFFECT` (`AbilityStatusEffectConfig | null` per slot) and `ABILITY_DISPLACEMENT_STRENGTH` (`number` per slot) tables to `balance.ts`, exported from `packages/game-rules/src/index.ts`. Stonehide: slot 0 (Stone Wall) `null`/40 displacement; slot 1 (Tremor Stomp) `{slow, 0.4, 2000ms, enemies-in-zone}`/0; slot 2 (Iron Skin) `{damageReduction, 0.3, 3000ms, self}`/0; slot 3 (Avalanche) `null`/0. All other classes all-null/all-zero (Story 3.17 adds Spiritcaller's Warding Cry entry next).
- Task 2a: Wired self-scope status application in `GameRoom.ts`'s ability-dispatch block, placed BEFORE the `rawDamage <= 0 continue` guard so Iron Skin (damage=0) still applies its buff — this was the exact bug the Context section described. Reuses the pre-existing `applyStatusEffectToTarget` helper (built ready-to-use by 3.12, previously uncalled).
- Task 2b/2c: Extended the existing enemy hit-scan loop to also apply `enemies-in-zone` status effects (Tremor Stomp) and displacement (Stone Wall, via the pre-existing `applyDisplacementToEnemy` helper built ready-to-use by 3.14) alongside the existing damage call. Both gated on `!dmgResult.value.killed` — no point statusing/displacing an enemy about to be destroyed. Displacement direct-mutates `enemy.x/y`. **Post-implementation code review (see below) found the original plan of relying on the Enemy AI phase's own `enemy:moved` emission to sync this was incomplete** — that emission only fires from `tickChase`, not `tickIdle`/`tickAttack`, so a pulled enemy not currently chasing would sit displaced server-side with no client ever told, until it happened to re-enter CHASE (surfacing as a sudden teleport). Fixed: `applyDisplacementToEnemy` now repositions the physics body and broadcasts `enemy:moved` immediately, mirroring `applyDisplacementToPlayer`'s existing pattern.
- Task 3: No Avalanche code change. Its existing dispatch/damage coverage (unchanged codepath) still passes.
- Verified per Dev Notes: `status:applied`'s existing shape (`targetId`, `effectType`, `magnitude`, `expiresAtMs`) already covers both player and enemy targets — confirmed via `packages/net-protocol/src/apply-delta.ts`'s existing `status:applied` case, which already switches on `targetId` matching either a player or an enemy. **No `packages/net-protocol/**` change was needed**, so this story's actual footprint is narrower than the header's "Multi-context" caveat allowed for: Simulation Engineer only (`packages/game-rules/**`, `apps/simulation-server/**`, `tests/unit/abilities.test.ts`) — no Protocol Architect review triggered.
- Tests: added 6 cases to `tests/unit/abilities.test.ts` (Iron Skin self-damageReduction via `applyStatusEffect`+`applyPlayerDamage`; Tremor Stomp AoE damage + slow via `applyDamage`+`applyStatusEffect`; Stone Wall damage + pull-toward-caster via `applyDamage`+`applyDisplacement`; a killed-enemy negative case for the `!killed` status-effect guard added during code review; Avalanche config-absence check; other-classes-still-all-null/zero check), exercising the exact game-rules primitives `GameRoom.ts` calls. Full suite (excluding pre-existing e2e tests that require live Docker/Redis infra unavailable in this environment): 462 passed, 0 failed. `npm run typecheck`: 0 errors across all 10 project references.
- Confidence: 95% (pre-review) — straightforward declarative wiring following an established pattern (3.13's `ABILITY_CHAINED_ZONE`), all consumption sites (`applyDamage`, `applyPlayerDamage`, `fsm.ts`'s chase speed) were already reading `damageReduction`/`slow` from `statusEffects` before this story, so no additional wiring was needed on the read side. The 5% risk materialized exactly where expected — see code review below.

### Senior Developer Review (AI)

**Reviewed:** 2026-07-13 · **Outcome:** Approved (1 finding patched, rest dismissed/deferred)

Three parallel adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) ran against the diff vs `HEAD` (CRLF-normalized), scoped to this story's 4 changed files, with the story's own AC1-AC5 as the Acceptance Auditor's spec.

**Patched:**
- **[High, confirmed] Displaced enemy position never broadcast to clients** (Edge Case Hunter) — `applyDisplacementToEnemy` only mutated `gameState` locally; the physics body and clients only learned of the new position via the enemy's own AI tick, which only emits `enemy:moved` from `tickChase` — not `tickIdle`/`tickAttack`. A Stone Wall pull on an enemy mid-`ATTACK` (its most natural target) would be invisible to players until the enemy later re-entered `CHASE`, then appear as a sudden teleport by the full accumulated pull distance. Re-verified by reading `fsm.ts` directly before fixing (confirmed real, not a Blind-Hunter guess). Fix: `applyDisplacementToEnemy` now repositions the physics body and broadcasts `enemy:moved` immediately, mirroring the existing `applyDisplacementToPlayer` pattern. Added a regression-relevant negative test (killed enemy doesn't get status/displacement) while in the file.
- **[Low] Test hardcoded `durationMs` as `expiresAtMs`** (Blind Hunter) — obscured the real `nowAbility + durationMs` production contract by only working because the test's `nowMs` was `0`. Fixed: tests now name an explicit `nowMs` local and compute `nowMs + durationMs`.

**Dismissed (with reason):**
- "Inconsistent state-mutation pattern" (replace-array-element for status effects vs. direct-mutate for displacement) — Blind Hunter's severity claim rested on `gameState.players`/`enemies` being Colyseus schema arrays; per this project's explicit architecture rule (CLAUDE.md/project-context.md), Colyseus state sync (`@Schema`/`MapSchema`/`ArraySchema`) is forbidden — these are plain arrays. Both patterns were independently established by 3.12 and 3.14, not introduced here.
- "No invariant stops self-scope status stacking on a damaging ability" — speculative future-misuse scenario; no ability in this story's data combines `scope: 'self'` with nonzero damage.
- "Redundant O(n) findIndex per ability dispatch" — `n` is capped at `MAX_PLAYERS = 8`; negligible against the 33ms tick budget, consistent with existing `.find()` usage elsewhere in the same file.
- "Non-null assertions" — consistent with this file's established style throughout.
- "Planning commentary in shipped balance.ts table" — matches existing precedent (`ABILITY_CHAINED_ZONE`, `ABILITY_SELF_COST_HP` already carry similar future-story notes).
- Acceptance Auditor's two observations (the `!killed` guard as an "unstated addition," Dev Notes prose being slightly stale re: `StatusAppliedDelta`'s shape) — both explicitly flagged by the Auditor itself as non-defects; no action needed.
- "GameRoom.ts wiring has zero direct integration test coverage" (Blind Hunter) — real, but not unique to this story: every kit-rework story in this batch (3.12-3.15) only unit-tests the game-rules primitives, not a live Colyseus room, and this story's own Allowed-paths/AC5 scoped tests to `tests/unit/abilities.test.ts`. Deferred — worth a dedicated GameRoom-integration-test story rather than a one-off addition here.

After the patch: full suite re-run, 462 passed / 0 failed (same pre-existing e2e/Docker-dependent tests skipped as before); typecheck clean.

### File List

- `packages/game-rules/src/balance.ts` — added `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH` tables, `StatusEffectScope`/`AbilityStatusEffectConfig` types
- `packages/game-rules/src/index.ts` — exported the two new tables and two new types
- `apps/simulation-server/src/rooms/GameRoom.ts` — wired self-scope status application, enemies-in-zone status application, and Stone Wall displacement into the ability-dispatch/hit-scan block
- `tests/unit/abilities.test.ts` — added Stonehide kit rework test cases (AC5)

### Change Log

- 2026-07-13: Implemented Story 3.16 — Stonehide's full kit (Iron Skin self-damageReduction, Tremor Stomp AoE damage+slow, Stone Wall damage+pull, Avalanche unchanged). All tasks complete, all ACs satisfied, 0 regressions.
- 2026-07-13: Code review (1 patch fixed — Stone Wall's enemy displacement wasn't broadcast to clients, causing a delayed teleport instead of a visible pull; 1 minor test-clarity patch; rest dismissed as false-premise/speculative/pre-existing-style or deferred as a batch-wide test-coverage gap, not unique to this story). Outcome: Approved.

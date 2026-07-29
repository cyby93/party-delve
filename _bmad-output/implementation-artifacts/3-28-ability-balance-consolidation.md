---
baseline_commit: b0d3c9a
---

# Story 3.28: Ability Balance Consolidation — Per-Ability Config Objects

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Correction, third wave —
  resolves D-CC1's remaining half, a deferred item raised during Story 3.25's
  correct-course session, `_bmad-output/implementation-artifacts/deferred-work.md`,
  and documented in ADR-0005's "Negative / trade-offs" section and ADR-0006's
  Context/Decision/Alternatives-considered sections). Not in the original
  epics.md — this is a pure internal refactor split out from Story 3.27, not
  a new gameplay FR.

Context: `packages/game-rules/src/balance.ts` stores ability balance as 9
  parallel "struct-of-arrays" tables, each `Record<PlayerClass, readonly
  [T,T,T,T]>` indexed `[class][abilitySlot 0-3]`: `ABILITY_COOLDOWNS_MS`,
  `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_SELF_COST_HP`,
  `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`,
  `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`. This is D-CC1's
  other half — Story 3.27 (2026-07-29, ADR-0006) already resolved the sibling
  problem in `packages/shared-types/src/ability-geometry.ts` (5 flat tables
  replaced by one `AbilityGeometry` object per ability), and explicitly split
  this `balance.ts` half into "a new, separate, not-yet-created future story
  (3-28)" because its consumers are entirely different: `ABILITY_GEOMETRY` is
  read by 3 ownership areas (shared-types, `GameRoom.ts`, 4 host-client VFX
  files), while every `balance.ts` table here is read ONLY by
  `packages/game-rules/src/systems/abilities.ts` (`dispatchAbility`) and
  `apps/simulation-server/src/rooms/GameRoom.ts` — both entirely within
  Simulation Engineer ownership. Same fix shape as 3.27: replace the 9 flat
  tables with ONE per-ability `AbilityBalance` object, in a new
  `ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance,
  AbilityBalance, AbilityBalance, AbilityBalance]>`. Byte-identical values —
  this is a relocation/restructuring, not a re-tune.

  Per an explicit user decision during this story's creation (ownership-scope
  check): no new ADR is written for this story. `packages/game-rules/**`
  does not trigger CLAUDE.md's Contract-change hook (only
  `packages/shared-types/**`/`packages/net-protocol/**`/session/reconnect/
  room-state/prediction paths do), and writing a new ADR would touch
  `docs/adr/**` — Orchestrator/Protocol Architect ownership — for a story
  designed to stay strictly single-owner. The decision is documented via a
  `deferred-work.md` resolution note (Task 6) and this file's own Dev Notes,
  same as any other internal refactor that doesn't cross a contract boundary.

Owner agent: Simulation Engineer ONLY — single-owner, no cross-boundary
  approval needed (this is the entire reason 3.27 split geometry from
  balance rather than doing both in one story). Every touched path is
  `apps/simulation-server/**` or `packages/game-rules/**`. The only
  exceptions are two administrative bookkeeping files every story touches
  regardless of code ownership (`_bmad-output/implementation-artifacts/
  deferred-work.md` and `sprint-status.yaml`), not a design-decision surface.

Goal:
  Task 1 — `packages/game-rules/src/balance.ts`: define `AbilityBalance`
            interface + `ABILITY_BALANCE` table; remove the 9 old flat
            table exports (hard cutover); keep `ChainedZoneConfig`,
            `AbilityStatusEffectConfig`, `StatusEffectScope` as standalone
            exported types (still referenced directly elsewhere).
  Task 2 — `packages/game-rules/src/index.ts`: update the re-export list
            (remove the 9 old names, add `ABILITY_BALANCE` + the
            `AbilityBalance` type).
  Task 3 — `packages/game-rules/src/systems/abilities.ts`
            (`dispatchAbility`): migrate its 4 lookups (`cooldownMs`,
            `damage`, `hpScaledDamage`, `selfCostHp`) to
            `ABILITY_BALANCE[...][...].field`.
  Task 4 — `apps/simulation-server/src/rooms/GameRoom.ts`: migrate all
            ~12 direct read-site expressions across 7 of the 9 tables
            (`ABILITY_COOLDOWNS_MS`, `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`,
            `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`,
            `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`) to
            `ABILITY_BALANCE[...][...].field`; update the import line.
  Task 5 — Tests: migrate `tests/unit/abilities.test.ts` (the primary
            consumer — many assertions, including 4 whole-tuple
            `.toEqual([...])` rewrites) and
            `tests/contract/ability-vfx-budget.test.ts`
            (`ABILITY_COOLDOWNS_MS` → `ABILITY_BALANCE[...][...].cooldownMs`);
            add a new contract test; confirm
            `packages/game-rules/tests/unit/balance.test.ts` needs no change
            (it only tests `resolveOutgoingDamage`, imports none of these 9
            tables).
  Task 6 — `deferred-work.md`: mark D-CC1 fully resolved (append to the
            existing entry, which already has a "Geometry half RESOLVED by
            3.27" note — do not delete/rewrite it).
  Task 7 — Full verification: typecheck + `npx vitest run`, 0 regressions.

Allowed paths:
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts (re-export list only, lines 6-53, plus the type line at 54)
  - packages/game-rules/src/systems/abilities.ts
  - apps/simulation-server/src/rooms/GameRoom.ts (balance read-sites and
    the import line only — see Dev Notes for the full read-site list)
  - tests/unit/abilities.test.ts
  - tests/contract/ability-vfx-budget.test.ts
  - tests/contract/ability-balance-shape.test.ts (new)
  - packages/game-rules/tests/unit/balance.test.ts (verify only — expected
    to need NO change; do not edit unless a read-site is actually found)
  - _bmad-output/implementation-artifacts/deferred-work.md (append a
    resolution note to the existing D-CC1 entry; do not delete/rewrite it)

Blocked paths:
  - packages/shared-types/src/ability-geometry.ts, `ABILITY_GEOMETRY` and
    any geometry field — Story 3.27's territory, already resolved. This
    story touches balance only.
  - apps/host-client/** — no VFX file reads any of these 9 tables (confirmed
    via repo-wide grep during story creation); if a read site is somehow
    found here during implementation, stop and flag it rather than editing
    host-client, since that would reopen the cross-boundary question 3.27
    deliberately closed.
  - docs/adr/** — no new ADR for this story, per the explicit ownership-scope
    decision made during story creation (see Dev Notes). Do not create one.
  - Any ability's actual numeric tuning values, status-effect config,
    chained-zone config, or displacement strength — byte-identical migration
    only, zero gameplay change.
  - `packages/game-rules/src/systems/combat.ts`, `player-health.ts`,
    `targeting.ts` (`applyDamage`, `healPlayer`, `calculateLifesteal`,
    `calculateSelfCostHp`, `calculateHpScaledDamage`,
    `resolveMixedFactionTargets`, etc.) — pure functions that CONSUME
    balance values as parameters; this story only changes where their
    scalar arguments come from, never their logic.
  - A discriminated union or any type-shape change beyond a flat interface —
    matches 3.27's "plain fields, mechanical migration" precedent.

Inputs:
  - _bmad-output/implementation-artifacts/deferred-work.md — D-CC1 entry
    (already has a "Geometry half RESOLVED by Story 3.27" annotation; this
    story resolves the remaining "AbilityBalance half")
  - docs/adr/ADR-0006-ability-geometry-consolidation.md — Context/Decision/
    Alternatives-considered sections name this story (3-28) and its scope
    boundary explicitly
  - docs/adr/ADR-0003-ability-presentation-contract.md — the package
    boundary this consolidation stays inside (game-rules/host-forbidden
    balance vs. shared-types/host-importable geometry) — unaffected by this
    story, cited for context only
  - packages/game-rules/src/balance.ts (whole file, 309 lines) — the file
    being restructured; only the 9 tables listed above change, everything
    else (revive/enemy/AI/boss/bond/essence/wave constants,
    `resolveOutgoingDamage`, `getEnemyCount`) is untouched
  - packages/game-rules/src/index.ts:6-53 (re-export block), :54 (type line)
  - packages/game-rules/src/systems/abilities.ts (whole file, 92 lines) —
    `dispatchAbility`'s 4 balance lookups
  - apps/simulation-server/src/rooms/GameRoom.ts — read-site list in Dev
    Notes below
  - tests/unit/abilities.test.ts (whole file, 498 lines) — the primary test
    consumer of these tables
  - tests/contract/ability-vfx-budget.test.ts — the existing "live values,
    not hand-copied literals" contract-test pattern to mirror
  - _bmad-output/implementation-artifacts/3-27-ability-geometry-consolidation-per-ability-objects.md
    — the sibling story this one completes; same restructuring pattern,
    same "hard cutover, no backward-compat shim" rationale

Non-goals:
  - Any change to `ABILITY_GEOMETRY` or `packages/shared-types/**` — 3.27's
    territory, already done.
  - Any change to ability behavior, numeric values, status-effect configs,
    chained-zone configs, or displacement strengths — byte-identical
    migration only.
  - A new ADR — explicit decision made during story creation (see Dev
    Notes); the decision is a minimal internal restructuring, not a new
    contract, and documenting it in `deferred-work.md` is sufficient.
  - Any host-client change — confirmed zero consumers there.
  - Backward-compat shims (keeping the 9 old table names as derived
    re-exports) — hard, atomic cutover, matching 3.27's precedent.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: NOT triggered — `packages/game-rules/**` is not a
    trigger path (only `packages/shared-types/**`, `packages/net-protocol/**`,
    session lifecycle, reconnect flow, room state/join flow, or
    prediction/reconciliation/interpolation state are). No protocol schema,
    DTO, or session contract changes here.
  - Simulation-safety hook: TRIGGERED — `apps/simulation-server/GameRoom.ts`
    and `packages/game-rules/**` both touched. Typecheck, unit tests,
    deterministic tick test (no behavior change expected — pure data-shape
    migration; confirm no `Math.random()` or timing change introduced),
    perf sanity note (one extra property-access indirection per lookup —
    negligible, state in Completion Notes).
  - Client-UX hook: NOT triggered — no `apps/host-client/**` or
    `apps/mobile-controller/**` file is touched (confirmed zero consumers of
    these 9 tables outside game-rules/simulation-server during research).
  - Ownership hook: single-owner (Simulation Engineer) — not triggered, no
    split needed. Explicit ownership-scope decision made during story
    creation: no new ADR, keeping `docs/adr/**` (Orchestrator/Protocol
    Architect territory) untouched.

Required tests:
  - tests/contract/ability-balance-shape.test.ts (new) — for every
    `(class, slot)` pair, assert `ABILITY_BALANCE[class][slot]`'s fields
    equal the documented pre-refactor literal values (see the full
    per-class/slot table in Dev Notes) — a byte-identical migration
    regression guard, mirroring 3.27's
    `tests/contract/ability-geometry-shape.test.ts` pattern.
  - tests/unit/abilities.test.ts — rewrite the 4 whole-tuple
    `TABLE[cls].toEqual([...])` / `for (const config of TABLE[cls])`
    assertions (lines ~271, ~273, ~350-352, ~485, ~487 in the pre-migration
    file — see Dev Notes for the exact list) to map the relevant
    `ABILITY_BALANCE[cls][n].field` first, then compare; every other
    reference is a mechanical `OLD_TABLE[cls][n]` →
    `ABILITY_BALANCE[cls][n].field` rename.
  - tests/contract/ability-vfx-budget.test.ts — mechanical rename:
    `ABILITY_COOLDOWNS_MS[cls][i]` → `ABILITY_BALANCE[cls][i].cooldownMs`.
  - packages/game-rules/tests/unit/balance.test.ts — verify only, confirm
    it needs no change (imports only `resolveOutgoingDamage`,
    `BOND_DAMAGE_MULT`, `DEBUG_GOD_MODE_DAMAGE_MULT`, none of the 9 tables).
  - Full suite: `npm run typecheck` + `npx vitest run`, 0 errors, 0
    regressions (2 pre-existing unrelated failures are already
    memory-tracked — `known-failing-stonehide-geometry-test.md` and
    `known-flaky-ancestors-voice-e2e-test.md` — confirm they're still the
    only failures, don't chase them).

Telemetry impact: None — internal data-shape refactor, no new user-facing
  flow, no KPI event.
```

---

## Story

As a developer maintaining this project's ability configuration,
I want the 9 parallel per-field balance tables in `packages/game-rules/src/balance.ts` (`ABILITY_COOLDOWNS_MS`, `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`, `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`) consolidated into one per-ability `AbilityBalance` object per class/slot,
so that adding a future ability balance property is one optional field on an existing object instead of a new top-level table requiring placeholder back-fill for every class/slot that doesn't use it — resolving the rest of D-CC1 that Story 3.27 deliberately split out (its geometry half).

---

## Acceptance Criteria

**AC1 — `AbilityBalance` shape defined:**
**Given** `packages/game-rules/src/balance.ts`
**When** the consolidation lands
**Then** a new `AbilityBalance` interface (`{ readonly cooldownMs: number; readonly damage: number; readonly healAmount: number; readonly selfCostHp: number; readonly hpScaledDamage: number; readonly lifestealPct: number; readonly displacementStrength: number; readonly statusEffect: AbilityStatusEffectConfig | null; readonly chainedZone: ChainedZoneConfig | null }`, all fields `readonly` from the start — 3.27's own review found this omission after the fact for `AbilityGeometry`, don't repeat it) and a new `ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]>` replace the 9 flat tables, with every class/slot's field values byte-identical to today's tables

**AC2 — Hard cutover, no dual tables:**
**Given** the 9 old flat table exports
**When** the story is complete
**Then** they no longer exist as exports from `game-rules` — every read site (`dispatchAbility`'s 4 lookups, `GameRoom.ts`'s ~11 read expressions, both listed test files) reads from `ABILITY_BALANCE` instead, so there is exactly one place these values live

**AC3 — Standalone types preserved:**
**Given** `ChainedZoneConfig`, `AbilityStatusEffectConfig`, and `StatusEffectScope`
**When** the consolidation lands
**Then** they remain standalone exported types (not folded into `AbilityBalance` as inline shapes) since `GameRoom.ts` references `ChainedZoneConfig` directly as a parameter type (`spawnChainedZone`) independent of the table — `AbilityBalance.chainedZone`/`.statusEffect` simply use these existing types as field types

**AC4 — Geometry and every non-ability-balance constant untouched:**
**Given** `ABILITY_GEOMETRY` (3.27's table, re-exported from `shared-types`) and every other constant in `balance.ts` (revive, enemy melee, AI/behavior-layer, boss, bond, essence, wave, debug constants, `SPIRIT_ABILITY_NAMES`, `SPIRIT_ABILITY_COOLDOWN_MS`, `resolveOutgoingDamage`, `getEnemyCount`)
**When** this story is complete
**Then** none of them change shape, name, value, or location — this story touches only the 9 named per-ability balance tables

**AC5 — Tests migrated, byte-identical guard added:**
**Given** the full test suite
**When** migrated
**Then** `tests/unit/abilities.test.ts` and `tests/contract/ability-vfx-budget.test.ts` resolve balance via `ABILITY_BALANCE[class][slot].field`, the 4 whole-tuple assertions in `abilities.test.ts` are rewritten to map the relevant field per slot before comparing, and a new `tests/contract/ability-balance-shape.test.ts` asserts every class/slot's migrated `AbilityBalance` fields equal the documented pre-refactor literal values

**AC6 — No new ADR, D-CC1 closed in deferred-work.md:**
**Given** the explicit ownership-scope decision made during this story's creation (single-owner Simulation Engineer; `docs/adr/**` is Orchestrator/Protocol Architect territory; no CLAUDE.md hook requires an ADR here since `packages/game-rules/**` isn't a Contract-change-hook trigger path)
**When** the story is complete
**Then** no new ADR file is created, and `deferred-work.md`'s existing D-CC1 entry (which already has a 3.27 "Geometry half RESOLVED" note) gets an appended note marking the AbilityBalance half resolved by this story too — D-CC1 is now fully closed

**AC7 — Hooks:**
**Given** the Simulation-safety hook (`apps/simulation-server`, `packages/game-rules`, TRIGGERED) and the Contract-change/Client-UX/Ownership hooks (all NOT triggered, per Dev Notes' explicit reasoning)
**Then** this story requires full simulation-safety verification (typecheck, unit tests, deterministic-tick confirmation, perf sanity note) before merge — no Protocol Architect review, no ADR, no cross-boundary approval needed

**Non-goals:** Any change to `ABILITY_GEOMETRY`/`shared-types` (3.27's territory). Any change to ability behavior, numeric values, status-effect configs, chained-zone configs, or displacement strengths. A new ADR. Any `apps/host-client/**` change.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #3, #4) — `packages/game-rules/src/balance.ts`: define `export interface AbilityBalance { readonly cooldownMs: number; readonly damage: number; readonly healAmount: number; readonly selfCostHp: number; readonly hpScaledDamage: number; readonly lifestealPct: number; readonly displacementStrength: number; readonly statusEffect: AbilityStatusEffectConfig | null; readonly chainedZone: ChainedZoneConfig | null; }`. Build `export const ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]>` by transcribing each class/slot's current values from the 9 tables byte-for-byte — use the exact literal in Dev Notes ("Full `ABILITY_BALANCE` literal to transcribe") as the source of truth, do not re-derive from memory. Remove the 9 old table exports (`ABILITY_COOLDOWNS_MS`, `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`, `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`). Keep `ChainedZoneConfig` (interface), `AbilityStatusEffectConfig` (interface), and `StatusEffectScope` (type) exported standalone exactly as today — `GameRoom.ts:16` imports `ChainedZoneConfig` directly as a parameter type for `spawnChainedZone`, independent of any table. Leave `ABILITY_GEOMETRY` and its re-export block, and every other constant in the file (revive/enemy/AI/behavior-layer/boss/bond/essence/wave/debug sections, `resolveOutgoingDamage`, `getEnemyCount`), completely untouched. Update the file's section comments (`// ── Ability Balance ──` etc.) to describe the new shape instead of the old table list.

- [x] **Task 2** (AC: #2) — `packages/game-rules/src/index.ts:6-53` (the `export { ... } from './balance.js'` block): replace the 9 removed names (`ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE`, `ABILITY_CHAINED_ZONE`, `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`, `ABILITY_HEAL_AMOUNT`) with `ABILITY_BALANCE`. `:54` (`export type { ... }` line): add `AbilityBalance`, keep `ChainedZoneConfig, AbilityStatusEffectConfig, StatusEffectScope, AbilityDeliveryType, AbilityHitShape, AbilityGeometry` unchanged.

- [x] **Task 3** (AC: #2) — `packages/game-rules/src/systems/abilities.ts`: update the import (`import { ABILITY_COOLDOWNS_MS, ABILITY_DAMAGE, ABILITY_SELF_COST_HP, ABILITY_HP_SCALED_DAMAGE } from '../balance.js';` → `import { ABILITY_BALANCE } from '../balance.js';`). In `dispatchAbility` (lines ~56-63), replace: `ABILITY_COOLDOWNS_MS[ctx.playerClass][idx]` → `ABILITY_BALANCE[ctx.playerClass][idx].cooldownMs`; `ABILITY_DAMAGE[ctx.playerClass][idx]` → `ABILITY_BALANCE[ctx.playerClass][idx].damage`; `ABILITY_HP_SCALED_DAMAGE[ctx.playerClass][idx]` → `ABILITY_BALANCE[ctx.playerClass][idx].hpScaledDamage`; `ABILITY_SELF_COST_HP[ctx.playerClass][idx]` → `ABILITY_BALANCE[ctx.playerClass][idx].selfCostHp`. Consider hoisting one `const balance = ABILITY_BALANCE[ctx.playerClass][idx];` local and reusing it for all 4 field reads, since `idx` is already computed once above these lines — purely a local readability choice, not required for correctness. No change to `calculateSelfCostHp`/`calculateHpScaledDamage` themselves (they stay generic, taking scalar parameters).

- [x] **Task 4** (AC: #2) — `apps/simulation-server/src/rooms/GameRoom.ts`: update the import line (currently imports `ABILITY_DAMAGE, ABILITY_CHAINED_ZONE, ABILITY_STATUS_EFFECT, ABILITY_DISPLACEMENT_STRENGTH, ABILITY_HEAL_AMOUNT, ABILITY_COOLDOWNS_MS, ABILITY_LIFESTEAL_PCT` among many other names on one long line — replace just these 7 with `ABILITY_BALANCE`, leave every other imported name, including `ABILITY_GEOMETRY` and `ChainedZoneConfig` type import, untouched). Migrate every read-site — grep the file for the 7 removed names to find them all (do not rely solely on the line numbers below, the file has shifted since this story was written — verify against current content): reconnect cooldown reconstruction (~526), Dark Pact's drain buff-config lookup (~1349), Tempest Hurl-vs-boss impact damage (~1660), projectile-vs-enemy hit resolution damage (~1990), lifesteal check (~2057), declarative chained-zone dispatch (~2078), self/allies-in-zone status-effect dispatch (~2467), the generic hit-scan loop's displacement/heal setup (~2514-2515), Spirit Nova's ring-hit damage/heal (~2719, ~2724), Soul Mend completion's cooldown re-application (~3355). Each becomes `ABILITY_BALANCE[class][slot].fieldName`, preserving the existing `?? 0` fallback pattern where the index isn't a literal (still needed — `Table[class][n]` still resolves to `T | undefined` under `noUncheckedIndexedAccess`, confirmed `true` in `tsconfig.base.json`). This is NOT just a style preference — at the 3 sites where `abilityIndex` is a plain `number` (not a literal-union cast like `as 0 | 1 | 2 | 3`), `ABILITY_BALANCE[class][abilityIndex]` itself resolves to `AbilityBalance | undefined`, so `.fieldName` cannot be appended directly without a typecheck error: **~2467** (`ABILITY_STATUS_EFFECT[player.class][abilityIndex]`, today read with no `??` at all because the very next line safely narrows via `statusConfig?.scope` — the migrated form needs `ABILITY_BALANCE[player.class][abilityIndex]?.statusEffect`, preserving that same optional-chain-then-narrow shape, not a bare `.statusEffect`) and **~2514/2515** (already using `?? 0`, migrate to `?.displacementStrength ?? 0` / `?.healAmount ?? 0`, or use the hoisted-object pattern below). Update the handful of comments that name the old table symbols directly (e.g. "ABILITY_CHAINED_ZONE entry is non-null", "nonzero ABILITY_LIFESTEAL_PCT entry", "ABILITY_SELF_COST_HP entry") to reference `ABILITY_BALANCE`'s field names instead. A single `const balance = ABILITY_BALANCE[player.class][abilityIndex] ?? DEFAULT_BALANCE;` hoisted once per dispatch branch (mirroring the existing `ABILITY_GEOMETRY[...] ?? {...}` fallback-object pattern already at ~2514) is a reasonable simplification where multiple fields from the same slot are read close together — but verify against the actual control flow (there are `continue` statements between some of these reads for Dark Pact/Lightning Arc/Spirit Nova branches) before assuming one hoist point covers all of them; do not force a hoist that changes which branch a read executes in.

- [x] **Task 5a** (AC: #5) — `tests/unit/abilities.test.ts`: update the import (drop the 9 old names, add `ABILITY_BALANCE`; keep `ABILITY_GEOMETRY` unchanged). Migrate every `OLD_TABLE[class][n]` / `OLD_TABLE.classname[n]` read to `ABILITY_BALANCE[class][n].field` (or `.classname[n].field`) throughout the file. Four assertions need more than a mechanical rename — rewrite each to map the field first, then compare: `expect(ABILITY_DISPLACEMENT_STRENGTH[cls]).toEqual([0, 0, 0, 0])` (~271) → `expect(ABILITY_BALANCE[cls].map(a => a.displacementStrength)).toEqual([0, 0, 0, 0])`; `expect(ABILITY_STATUS_EFFECT[PlayerClass.STORMCALLER]).toEqual([null, null, null, null])` (~273) → map `.statusEffect`; `expect(ABILITY_HEAL_AMOUNT[cls]).toEqual([0, 0, 0, 0])` (~350) → map `.healAmount`; `for (const config of ABILITY_STATUS_EFFECT[cls])` (~351) → `for (const config of ABILITY_BALANCE[cls].map(a => a.statusEffect))`; `expect(ABILITY_CHAINED_ZONE[cls]).toEqual([null, null, null, null])` (~485) and `expect(ABILITY_CHAINED_ZONE[PlayerClass.STORMCALLER]).toEqual([null, null, null, null])` (~487) → map `.chainedZone`. Every other reference (e.g. `ABILITY_STATUS_EFFECT[PlayerClass.STONEHIDE][2]`, `ABILITY_DAMAGE.stonehide[1]`, `ABILITY_SELF_COST_HP.souldrinker[0]`) is a single-slot lookup — mechanical rename only.

- [x] **Task 5b** (AC: #5) — `tests/contract/ability-vfx-budget.test.ts`: update the import (`import { ABILITY_COOLDOWNS_MS } from 'game-rules';` → `import { ABILITY_BALANCE } from 'game-rules';`) and both read sites (`ABILITY_COOLDOWNS_MS[cls][i as 0 | 1 | 2 | 3]` → `ABILITY_BALANCE[cls][i as 0 | 1 | 2 | 3].cooldownMs`; `ABILITY_COOLDOWNS_MS[PlayerClass.SPIRITCALLER][1]` → `ABILITY_BALANCE[PlayerClass.SPIRITCALLER][1].cooldownMs`). No other change — this file's own "live values, not hand-copied literals" contract-test purpose (verifying the VFX budget invariant against the real cooldown table) is unaffected by the rename.

- [x] **Task 5c** (AC: #5) — New `tests/contract/ability-balance-shape.test.ts`, following `tests/contract/ability-geometry-shape.test.ts`'s pattern (3.27) — a byte-identical migration guard, typed against a 4-tuple (`Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]>`, not an open array — 3.27's own review flagged an open-array `EXPECTED` type as a gap that wouldn't catch a missing/extra entry). For every `(class, slot)` pair, assert `ABILITY_BALANCE[class][slot]` equals the documented pre-refactor literal values from Dev Notes' full transcription table (`cooldownMs`, `damage`, `healAmount`, `selfCostHp`, `hpScaledDamage`, `lifestealPct`, `displacementStrength`, `statusEffect`, `chainedZone`).

- [x] **Task 5d** (verify only, no AC) — Confirm `packages/game-rules/tests/unit/balance.test.ts` needs no change: it imports only `resolveOutgoingDamage`, `BOND_DAMAGE_MULT`, `DEBUG_GOD_MODE_DAMAGE_MULT` from `../../src/balance.js`, none of the 9 migrated tables. Do not edit it unless this is found to be no longer true.

- [x] **Task 6** (AC: #6) — `_bmad-output/implementation-artifacts/deferred-work.md`: append a resolution note to the existing D-CC1 entry (do not delete or rewrite the original text, or the existing "Geometry half RESOLVED by Story 3.27" note — match the file's existing convention of appending "RESOLVED by X" annotations) stating the `AbilityBalance` half is now resolved by Story 3.28, and D-CC1 is fully closed.

- [x] **Task 7** (AC: #7) — `npm run typecheck` + `npx vitest run` (full suite), 0 errors, 0 regressions beyond the 2 already-memory-tracked pre-existing failures (`known-failing-stonehide-geometry-test.md`, `known-flaky-ancestors-voice-e2e-test.md`). Confirm no `Math.random()` or new non-determinism was introduced (pure data-shape migration) — state explicitly in Completion Notes per the Simulation-safety hook.

### Review Findings

3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), `review_mode: full` against this story's AC1-AC7. 0 decision_needed, 2 patch (both applied), 0 defer, 1 dismissed. Acceptance Auditor independently confirmed zero AC violations across all 7 ACs plus Allowed/Blocked paths compliance.

- [x] [Review][Patch] `?? 0` fallback attached after `.field` instead of before it, so it only guards an already-non-nullable field value — not the tuple lookup itself. An out-of-range `abilityIndex`/`projectile.abilityIndex` (unreachable today, since `dispatchAbility` already validates 0-3 before any of these values are set, but only guaranteed by an unchecked `as 0 | 1 | 2 | 3` cast, not the type system) would now throw `TypeError: Cannot read properties of undefined` instead of silently degrading to 0/null the way the old flat-table lookups did. [`apps/simulation-server/src/rooms/GameRoom.ts:1660,1991,2058,2079`] — confirmed independently by both Blind Hunter and Edge Case Hunter (merged `blind+edge`); downgraded from a would-be-High severity to Medium since not reachable under current invariants. Fixed: moved `?.` before `.damage`/`.lifestealPct`/`.chainedZone` at all 4 sites so the tuple lookup itself is guarded, not just the field.
- [x] [Review][Patch] The generic hit-scan loop's self/allies-in-zone status-effect branch and its later displacement/heal reads independently re-indexed `ABILITY_BALANCE[player.class][abilityIndex]` three separate times, unlike the projectile-hit-resolution path a few hundred lines earlier (which already hoists one `projectileBalance` local). [`apps/simulation-server/src/rooms/GameRoom.ts:2465-2516`] — Blind Hunter finding; low-severity consistency/efficiency nit, not a correctness bug (verified no `continue` between the reads changes which branch executes on any path). Fixed: hoisted one `const abilityBalance = ABILITY_BALANCE[player.class][abilityIndex];`, reused for `statusConfig`, `displacementStrength`, and `healAmount`.
- Dismissed: the new `tests/contract/ability-balance-shape.test.ts`'s `EXPECTED` literal is hand-typed rather than derived from git history, so it can't itself catch a transcription slip made once and copy-pasted into both files (Blind Hunter). By-design — this story's own Dev Notes explicitly instruct mirroring 3.27's `ability-geometry-shape.test.ts` pattern, which has the identical characteristic and was never flagged as a defect in that story's own review. Not a new gap introduced here.

Re-ran `npm run typecheck` (clean, 10/10 tsconfigs) and the full suite after applying both patches: 650 passed / 2 failed / 3 skipped, both failures the same two already-memory-tracked pre-existing issues (Ancestor's Voice e2e heal-assertion flakiness, Stonehide VFX centering) — 0 regressions.

---

## Dev Notes

### Full current content of the 9 tables being consolidated (source of truth)

```ts
export const ABILITY_COOLDOWNS_MS: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [2000, 4000, 6000, 1000],  // Stone Wall, Tremor Stomp, Iron Skin, Avalanche(AUTO)
  spiritcaller: [1500, 5000, 4000, 6000],  // Ancestor's Voice(AUTO), Spirit Nova, Soul Mend, Warding Cry
  souldrinker:  [1000, 3000, 5000, 4000],  // Blood Spike(AUTO), Crimson Lash, Dark Pact, Void Pulse
  stormcaller:  [1000, 3000, 5000, 2000],  // Lightning Arc(AUTO), Tempest Hurl, Thunder Clap, Storm Eye(AUTO)
};

export const ABILITY_DAMAGE: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [15, 35,  0, 50],
  spiritcaller: [15, 40,  0,  0],
  souldrinker:  [12, 30,  0, 25],
  stormcaller:  [18, 40, 45,  0],
};

export const ABILITY_HEAL_AMOUNT: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [10, 30, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_SELF_COST_HP: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [10, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_HP_SCALED_DAMAGE: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 1.0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_LIFESTEAL_PCT: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [0, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0.5, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_DISPLACEMENT_STRENGTH: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [40, 0, 0, 0],
  spiritcaller: [0, 0, 0, 0],
  souldrinker:  [0, 0, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export const ABILITY_STATUS_EFFECT: Record<PlayerClass, readonly [AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null, AbilityStatusEffectConfig | null]> = {
  stonehide: [
    null,
    { effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' },
    { effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' },
    null,
  ],
  spiritcaller: [
    null,
    null,
    null,
    { effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' },
  ],
  souldrinker: [
    null,
    null,
    { effectType: 'damageBuff', magnitude: 0.25, durationMs: 4000, scope: 'self' },
    null,
  ],
  stormcaller:  [null, null, null, null],
};

export const ABILITY_CHAINED_ZONE: Record<PlayerClass, readonly [ChainedZoneConfig | null, ChainedZoneConfig | null, ChainedZoneConfig | null, ChainedZoneConfig | null]> = {
  stonehide:    [null, null, null, null],
  spiritcaller: [null, null, null, null],
  souldrinker:  [null, null, null, { effectType: 'pull', radius: VOID_PULSE_ZONE_RADIUS_PX, tickIntervalMs: 500, durationMs: 2000 }],
  stormcaller:  [null, null, null, null],
};
```

### Full `ABILITY_BALANCE` literal to transcribe (Task 1 — do not re-derive, zip the tables above column-by-column)

```ts
export const ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance, AbilityBalance, AbilityBalance, AbilityBalance]> = {
  stonehide: [
    { cooldownMs: 2000, damage: 15, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 40, statusEffect: null, chainedZone: null }, // Stone Wall
    { cooldownMs: 4000, damage: 35, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' }, chainedZone: null }, // Tremor Stomp
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' }, chainedZone: null }, // Iron Skin
    { cooldownMs: 1000, damage: 50, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Avalanche
  ],
  spiritcaller: [
    { cooldownMs: 1500, damage: 15, healAmount: 10, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Ancestor's Voice
    { cooldownMs: 5000, damage: 40, healAmount: 30, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Spirit Nova
    { cooldownMs: 4000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Soul Mend
    { cooldownMs: 6000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' }, chainedZone: null }, // Warding Cry
  ],
  souldrinker: [
    { cooldownMs: 1000, damage: 12, healAmount: 0, selfCostHp: 10, hpScaledDamage: 0, lifestealPct: 0.5, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Blood Spike
    { cooldownMs: 3000, damage: 30, healAmount: 0, selfCostHp: 0, hpScaledDamage: 1.0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Crimson Lash
    { cooldownMs: 5000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: { effectType: 'damageBuff', magnitude: 0.25, durationMs: 4000, scope: 'self' }, chainedZone: null }, // Dark Pact
    { cooldownMs: 4000, damage: 25, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: { effectType: 'pull', radius: VOID_PULSE_ZONE_RADIUS_PX, tickIntervalMs: 500, durationMs: 2000 } }, // Void Pulse
  ],
  stormcaller: [
    { cooldownMs: 1000, damage: 18, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Lightning Arc
    { cooldownMs: 3000, damage: 40, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Tempest Hurl
    { cooldownMs: 5000, damage: 45, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Thunder Clap
    { cooldownMs: 2000, damage: 0, healAmount: 0, selfCostHp: 0, hpScaledDamage: 0, lifestealPct: 0, displacementStrength: 0, statusEffect: null, chainedZone: null }, // Storm Eye
  ],
};
```

Note `VOID_PULSE_ZONE_RADIUS_PX` is imported from `shared-types` at the top of `balance.ts` already (`import { VOID_PULSE_ZONE_RADIUS_PX } from 'shared-types';`) — no new import needed, it's the same constant Void Pulse's `chainedZone.radius` already used pre-migration.

### `dispatchAbility`'s AbilityFiredEvent already absorbs most of GameRoom.ts's balance needs

`dispatchAbility` (`packages/game-rules/src/systems/abilities.ts`) computes `cooldownMs`, `damage` (HP-scaled), and `selfCostHpApplied` from the balance tables and returns them in its `AbilityFiredEvent` result — `GameRoom.ts` mostly consumes these already-computed values (`result.value.damage`, `result.value.cooldownMs`, `result.value.selfCostHpApplied`), not the raw tables, at the primary dispatch call site (~line 2340-2360). The direct `ABILITY_BALANCE[...]` reads in `GameRoom.ts` are for cases `dispatchAbility` doesn't cover: reconnect cooldown reconstruction (no live dispatch happening), projectile-hit-time damage/lifesteal/chain lookups (resolved later than cast time, keyed off the projectile's stored `class`/`abilityIndex`), Spirit Nova's per-ring damage/heal (its own tracked-object dispatch path, bypasses `dispatchAbility`), Dark Pact's status-effect buff, the generic hit-scan loop's displacement/heal/status setup, and Soul Mend's channel-completion cooldown re-application. Don't assume every `ABILITY_BALANCE` field needs a `GameRoom.ts` read site — `selfCostHp` and `hpScaledDamage` are consumed ONLY inside `dispatchAbility`, never read directly by `GameRoom.ts`.

### Why a hard cutover, not a backward-compat shim

Same rationale as 3.27 (see that story's Dev Notes) — keeping the 9 old table names alive as derived re-exports would let old and new access patterns coexist indefinitely, defeating D-CC1's actual goal (one place these values live, not two, now for balance too). This story completes the atomic migration D-CC1's own text called for.

### Why no new ADR (explicit decision, not an oversight)

Made during story creation via `AskUserQuestion`, per the ownership-scope-check requirement: `docs/adr/**` is CLAUDE.md-owned by Orchestrator + Protocol Architect, not Simulation Engineer, and `packages/game-rules/**` does not trigger the Contract-change hook (unlike `packages/shared-types/**`, which is why 3.27 got ADR-0006 and Protocol Architect review). Writing a new ADR here would be a self-inflicted cross-boundary touch for a story explicitly designed to stay single-owner — the opposite of what splitting geometry from balance was for. The decision itself is recorded in the `deferred-work.md` D-CC1 resolution note (Task 6) and in this file. If a future story needs to reference why `AbilityBalance` has this shape, point here and at ADR-0006's Context section (which already previews this story's scope).

### Project Context Rules

- **Package Responsibility Boundaries (ADR-0003)**: `AbilityBalance` must stay physically inside `packages/game-rules` — do not move it to `shared-types` or merge it with `ABILITY_GEOMETRY`. This is the exact boundary ADR-0003 established (host-forbidden balance data vs. host-importable geometry data) and this story preserves it unchanged.
- **Naming Conventions**: `ABILITY_BALANCE` (SCREAMING_SNAKE_CASE for the table constant, matching `ABILITY_GEOMETRY`'s convention from 3.27); `AbilityBalance` (PascalCase for the interface, matching `AbilityGeometry`/`ChainedZoneConfig`/`AbilityStatusEffectConfig`'s existing convention).
- **TypeScript strict mode**: no `any`; all `AbilityBalance` fields `readonly` (see AC1 — bake this in from the start, don't wait for a review finding like 3.27 did); `statusEffect`/`chainedZone` use `| null` (matching the tuple-slot convention these fields already had pre-migration), not `?:` (these are always-present-but-nullable fields, not optional-and-absent fields — different from `AbilityGeometry.coneAngleDeg?:`, which is genuinely absent on non-cone entries).
- **Simulation-safety hook**: this is a pure data-shape migration — no new `Math.random()`, no new tick-order dependency, no new async/timing behavior. State this explicitly in Completion Notes rather than assuming it's obvious.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — D-CC1 entry, already annotated with 3.27's "Geometry half RESOLVED" note; this story appends the closing note
- [Source: docs/adr/ADR-0006-ability-geometry-consolidation.md] — Context/Decision/Alternatives-considered sections name this exact story (3-28) and its single-owner scope boundary
- [Source: docs/adr/ADR-0003-ability-presentation-contract.md] — the package-split rationale this consolidation must stay inside
- [Source: packages/game-rules/src/balance.ts] — whole file (309 lines), the 9 tables transcribed above are the only part that changes
- [Source: packages/game-rules/src/index.ts:6-53 (re-export block), :54 (type line)] — re-export block to update
- [Source: packages/game-rules/src/systems/abilities.ts] — whole file (92 lines), `dispatchAbility`'s 4 balance lookups
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — ~12 read-site expressions across 7 of the 9 tables, listed in Task 4
- [Source: tests/unit/abilities.test.ts] — whole file (498 lines), the primary test consumer; 4 whole-tuple assertions need a logic rewrite, not just a rename
- [Source: tests/contract/ability-vfx-budget.test.ts] — the existing cross-package "live values, not hand-copied literals" contract-test pattern
- [Source: _bmad-output/implementation-artifacts/3-27-ability-geometry-consolidation-per-ability-objects.md] — the sibling story this one completes; same restructuring pattern, same review lesson (readonly fields from the start, tuple-typed contract-test EXPECTED) applied proactively here

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` — clean, 0 errors across all 10 monorepo tsconfig projects (shared-types, net-protocol, game-rules, telemetry, ui-kit, simulation-server, host-client, mobile-controller, backend-platform, tests).
- `npx vitest run` — 651 passed / 1 failed / 3 skipped (655 total), 6 suite-level failures. All failures pre-existing and memory-tracked, none introduced by this story:
  - `apps/host-client/src/vfx/ability-vfx.test.ts` — Stone Wall centering assertion (`known-failing-stonehide-geometry-test.md`), untouched by this story's Allowed paths.
  - `tests/e2e/ability-dispatch.test.ts`, `tests/e2e/hub-ability-use.test.ts` — `EADDRINUSE :::2568`, simulation-server port-binding conflict in this sandbox (documented pre-existing environmental failure across many prior stories' Debug Logs, e.g. 3.26/3.19/dev-4).

### Completion Notes List

- Task 1: Replaced the 9 flat `Record<PlayerClass, [T,T,T,T]>` tables in `packages/game-rules/src/balance.ts` (`ABILITY_COOLDOWNS_MS`, `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_CHAINED_ZONE`, `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`) with one `AbilityBalance` interface (all fields `readonly` from the start, per AC1's explicit callout of 3.27's own review finding) and one `ABILITY_BALANCE: Record<PlayerClass, readonly [AbilityBalance,AbilityBalance,AbilityBalance,AbilityBalance]>` table, transcribed byte-for-byte from the story's Dev Notes literal (not re-derived). `ChainedZoneConfig`, `AbilityStatusEffectConfig`, `StatusEffectScope` kept as standalone exported types exactly where they were (`GameRoom.ts:16` still imports `ChainedZoneConfig` directly as a parameter type) — `AbilityBalance` forward-references them from its earlier position in the file, which TypeScript resolves fine for interface-only type references regardless of declaration order. `ABILITY_GEOMETRY` and every other constant/function in the file (revive, enemy melee, AI/behavior-layer, boss, bond, essence, wave, debug, `resolveOutgoingDamage`, `getEnemyCount`) untouched.
- Task 2: `packages/game-rules/src/index.ts` re-export block updated — 9 old names removed, `ABILITY_BALANCE` added to the value export list, `AbilityBalance` added to the type export list alongside the unchanged `ChainedZoneConfig, AbilityStatusEffectConfig, StatusEffectScope, AbilityDeliveryType, AbilityHitShape, AbilityGeometry`.
- Task 3: `dispatchAbility` (`packages/game-rules/src/systems/abilities.ts`) now imports only `ABILITY_BALANCE` and hoists one `const balance = ABILITY_BALANCE[ctx.playerClass][idx];` local, reused for all 4 field reads (`cooldownMs`, `damage`, `hpScaledDamage`, `selfCostHp`) — the readability simplification the story suggested as optional. `calculateSelfCostHp`/`calculateHpScaledDamage` unchanged.
- Task 4: `GameRoom.ts`'s import line updated (7 old names → `ABILITY_BALANCE`, `ABILITY_GEOMETRY` and `ChainedZoneConfig` type import untouched). Migrated all ~12 read sites: reconnect cooldown reconstruction (literal-union cast, direct `.cooldownMs`), Dark Pact's buff-config lookup (local `const abilityIndex = 2` — TypeScript narrows this to the literal type `2` for an unannotated numeric `const`, confirmed by the pre-existing unguarded use of this same pattern one line above at `ABILITY_GEOMETRY[...][abilityIndex]` as a required, non-optional parameter — so `.statusEffect` chains directly, no `?.` needed), Tempest Hurl-vs-boss impact damage and the projectile-hit-resolution block (both cast-index sites, hoisted a single `const projectileBalance = ABILITY_BALANCE[projectile.class][projectile.abilityIndex as 0|1|2|3]` reused across the damage/lifesteal/chain reads three lines apart — verified no `continue` sits between the hoist point and any of its three uses, so this doesn't skip a read the original per-read table lookups would have performed), Spirit Nova's ring-hit damage/heal (literal index `1`, hoisted similarly), Soul Mend completion's cooldown re-application (cast-index site). The generic hit-scan loop's `abilityIndex` (from `msg.event.ability`, a genuine plain `number`) needed the optional-chain form the story flagged explicitly: `ABILITY_BALANCE[player.class][abilityIndex]?.statusEffect` (preserving the existing `statusConfig?.scope` narrowing one line below, unchanged) and `?.displacementStrength ?? 0` / `?.healAmount ?? 0`. Updated 5 stale in-code comments that named the old table symbols directly.
- Task 5a-5c: `tests/unit/abilities.test.ts` migrated in full — every single-slot lookup mechanically renamed, and the 4 whole-tuple assertions (`ABILITY_DISPLACEMENT_STRENGTH[cls]`, `ABILITY_STATUS_EFFECT[STORMCALLER]`, `ABILITY_HEAL_AMOUNT[cls]`, the `for (const config of ABILITY_STATUS_EFFECT[cls])` loop, plus the 2 `ABILITY_CHAINED_ZONE` whole-tuple checks in the "no other class" test) rewritten as `ABILITY_BALANCE[cls].map(a => a.field)` before comparing. `tests/contract/ability-vfx-budget.test.ts` — mechanical import/read-site rename to `ABILITY_BALANCE[cls][i].cooldownMs`, doc comment updated. New `tests/contract/ability-balance-shape.test.ts` mirrors 3.27's `ability-geometry-shape.test.ts` pattern exactly: a tuple-typed (not open-array) `EXPECTED` constant, one `it` per class/slot pair asserting `ABILITY_BALANCE[cls][slot]` equals the documented pre-refactor literal.
- Task 5d: Confirmed `packages/game-rules/tests/unit/balance.test.ts` needed no change — it imports only `resolveOutgoingDamage`, `BOND_DAMAGE_MULT`, `DEBUG_GOD_MODE_DAMAGE_MULT`, none of the 9 migrated tables.
- Task 6: Appended an "AbilityBalance half RESOLVED by Story 3.28" note to `deferred-work.md`'s existing D-CC1 entry (original text and the 3.27 "Geometry half RESOLVED" note both left intact) stating D-CC1 is now fully closed.
- Task 7: Typecheck clean, full suite green apart from the two pre-existing/memory-tracked failures above — 0 regressions. Simulation-safety hook: this is a pure data-shape migration — no `Math.random()`, no new tick-order dependency, no new async/timing behavior introduced anywhere in this diff. Perf: one extra property-access indirection per balance lookup (`ABILITY_BALANCE[class][slot].field` vs. the old `TABLE[class][slot]`) — negligible, well within the 33ms/tick budget, confirmed no new allocation in any hot-path branch (all `ABILITY_BALANCE` reads are property accesses on the existing module-level const, not new object construction per tick).
- Out-of-scope observation (not fixed, matches Allowed/Blocked paths exactly): 3 files outside this story's Allowed paths carry now-stale comments naming the old table symbols in prose only (`packages/shared-types/src/ability-geometry.ts:91`, `apps/host-client/src/vfx/ability-vfx.test.ts:17`, `tests/e2e/ability-dispatch.test.ts:209`) — none affect compilation or test behavior, left untouched per the story's Blocked paths (host-client) and Allowed-paths scope (the other two files aren't listed), same precedent as 3.27/7.7b's "story specs name superseded files" pattern.
- Confidence: 95% — every read site was grepped and cross-checked against the story's own enumerated list before and after migration, the byte-identical contract test passes, and both typecheck and the full suite are clean apart from two independently-verified pre-existing failures.

### File List

- `packages/game-rules/src/balance.ts` (modified)
- `packages/game-rules/src/index.ts` (modified)
- `packages/game-rules/src/systems/abilities.ts` (modified)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified)
- `tests/unit/abilities.test.ts` (modified)
- `tests/contract/ability-vfx-budget.test.ts` (modified)
- `tests/contract/ability-balance-shape.test.ts` (new)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-07-29: create-story — wrote 3-28-ability-balance-consolidation, resolving D-CC1's remaining `AbilityBalance` half (deferred-work.md; Story 3.27/ADR-0006 already resolved the `AbilityGeometry` half and explicitly split this half out as single-owner Simulation Engineer). Not in epics.md — pure internal refactor. Ownership-scope check confirmed single-owner (`apps/simulation-server/**` + `packages/game-rules/**` only, zero host-client consumers verified via repo-wide grep). Via `AskUserQuestion`, user chose to skip writing a new ADR (`docs/adr/**` is Orchestrator/Protocol Architect territory; no CLAUDE.md hook requires one here since `packages/game-rules` isn't a Contract-change-hook trigger path) — documented instead via a `deferred-work.md` resolution note and this story's own Dev Notes. Exhaustive research: full current `balance.ts` content (9 tables), every read site in `GameRoom.ts` (~11 expressions) and `packages/game-rules/src/systems/abilities.ts`'s `dispatchAbility` (4 lookups), both real test-file consumers (`tests/unit/abilities.test.ts` — including 4 whole-tuple assertions needing a logic rewrite, not just a rename — and `tests/contract/ability-vfx-budget.test.ts`), confirmed `packages/game-rules/tests/unit/balance.test.ts` needs no change. Applied 3.27's own review lessons proactively (readonly fields from the start, tuple-typed contract-test EXPECTED type) rather than waiting to rediscover them. Set to ready-for-dev.
- 2026-07-29: dev-story — implemented 3-28-ability-balance-consolidation. Replaced `balance.ts`'s 9 flat per-field tables with one `AbilityBalance` object per ability (`ABILITY_BALANCE`), hard cutover — resolves D-CC1's remaining half (3.27/ADR-0006 already resolved the `AbilityGeometry` half). Migrated every read site: `dispatchAbility`'s 4 lookups (hoisted to a single `const balance` local), `GameRoom.ts`'s ~12 expressions across reconnect-cooldown reconstruction, Dark Pact, Tempest Hurl-vs-boss, projectile-hit resolution (hoisted a single `projectileBalance` local reused for damage/lifesteal/chain), the generic hit-scan loop's self/allies status-effect + displacement/heal setup (needed `?.` optional-chaining since that loop's `abilityIndex` is a genuine plain `number`, per the story's own explicit callout), Spirit Nova's ring-hit, and Soul Mend's completion cooldown re-application. Migrated both real test consumers (`tests/unit/abilities.test.ts`'s 4 whole-tuple assertions rewritten as `.map(a => a.field)`; `tests/contract/ability-vfx-budget.test.ts` mechanical rename) and added `tests/contract/ability-balance-shape.test.ts` (tuple-typed byte-identical migration guard, mirroring 3.27's `ability-geometry-shape.test.ts`). Confirmed `packages/game-rules/tests/unit/balance.test.ts` needed no change. Appended the closing D-CC1 resolution note to `deferred-work.md` — both halves now resolved. No new ADR (explicit story-creation decision, `packages/game-rules/**` isn't a Contract-change-hook trigger path). Typecheck clean (10/10 tsconfigs). Full suite: 651/655 passed, 0 regressions — the only failures (`ability-vfx.test.ts` Stone Wall centering, `ability-dispatch.test.ts`/`hub-ability-use.test.ts` simulation-server `EADDRINUSE` port-binding) are both pre-existing and already memory-tracked. Status → review.
- 2026-07-29: code review of 3-28-ability-balance-consolidation (review → done) — 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full spec mode against AC1-AC7. Acceptance Auditor: zero AC violations, full AC1-AC7 + Allowed/Blocked-paths compliance confirmed independently (including re-verifying the two riskiest spots the story's own Dev Notes flagged: the hoisted `projectileBalance` reused across a `continue`, and the `abilityIndex = 2`-literal Dark Pact lookup). 2 patch (both applied, both about the `?.`/`??` fallback placement inherited from the old flat-table era not correctly re-targeting the new object-tuple lookup): (1) Blind Hunter + Edge Case Hunter independently converged on the same real issue — `ABILITY_BALANCE[...][...].field ?? 0` guards the already-non-nullable field, not the tuple lookup itself, so an out-of-range index would now throw instead of degrading to 0/null; fixed at all 4 affected `GameRoom.ts` sites (1660, 1991, 2058, 2079) by moving `?.` before the field access — downgraded from a would-be-High to Medium since unreachable under today's invariants (`dispatchAbility` already validates 0-3 upstream); (2) Blind Hunter's low-severity consistency nit — the hit-scan loop's status/displacement/heal reads re-indexed `ABILITY_BALANCE` three times instead of hoisting once like the projectile-hit path already does; fixed via one hoisted `abilityBalance` local. 1 dismissed (Blind Hunter's claim that the new byte-identical contract test's hand-typed `EXPECTED` literal can't catch its own transcription slip — by-design, matches 3.27's own `ability-geometry-shape.test.ts` pattern exactly, not a new gap). Re-ran typecheck (clean) + full suite (650/655, 0 regressions, same 2 pre-existing failures) after applying patches. Status → done.

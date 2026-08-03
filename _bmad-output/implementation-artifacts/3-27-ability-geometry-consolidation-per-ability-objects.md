---
baseline_commit: d1b009a
---

# Story 3.27: Ability Geometry Consolidation — Per-Ability Config Objects

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Correction, second wave —
  resolves D-CC1, a deferred item raised during Story 3.25's correct-course
  session, `_bmad-output/implementation-artifacts/deferred-work.md`, and
  documented in ADR-0005's "Negative / trade-offs" and "Alternatives
  considered" sections). Not in the original epics.md — this is a pure
  internal refactor requested via correct-course, not a new gameplay FR.

Context: `packages/shared-types/src/ability-geometry.ts` stores ability
  geometry as 5 parallel "struct-of-arrays" tables, each
  `Record<PlayerClass, readonly [T,T,T,T]>` indexed `[class][abilitySlot 0-3]`:
  `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`,
  `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`. Every new spatial property
  (this consolidation's own trigger was Story 3.25 adding 2 more such tables
  on top of ~15 already in `balance.ts` + this file) means adding a new
  top-level table and back-filling placeholder values for every class/slot
  that doesn't use it. D-CC1's recommended fix (already pre-approved in
  ADR-0005's "Alternatives considered," which literally names the target
  shape): replace the 5 flat tables with ONE per-ability `AbilityGeometry`
  object, in a new `ABILITY_GEOMETRY: Record<PlayerClass, readonly
  [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]>`.
  Byte-identical values — this is a relocation/restructuring, not a re-tune.

  D-CC1 also covers `packages/game-rules/src/balance.ts`'s ~15 balance
  tables (`AbilityBalance` object). That half is EXPLICITLY OUT OF SCOPE
  here — split out during this story's creation because the two halves
  have different consumers: `ABILITY_GEOMETRY`'s consumers span 3 ownership
  areas (shared-types itself, `GameRoom.ts` in simulation-server, and 4 VFX
  files in host-client), while `balance.ts`'s tables are read ONLY by
  `GameRoom.ts` — entirely within Simulation Engineer ownership, no
  cross-boundary approval needed. Doing them separately keeps the balance
  half single-owner. The balance half is tracked as a future story
  (3-28-ability-balance-consolidation, not yet created).

Owner agent: Multi-context, PRE-APPROVED cross-boundary (explicit user
  decision during story creation — do not re-litigate):
  Protocol Architect (`packages/shared-types/**` — primary: defines the new
    `AbilityGeometry` shape, owns the ADR)
  + pre-approved mechanical-only consumer migration in:
    Simulation Engineer (`apps/simulation-server/src/rooms/GameRoom.ts`,
      `packages/game-rules/**` re-export lists only)
    Host Experience Engineer (`apps/host-client/src/vfx/*.ts` — 4 files,
      property-access rename only)
  Every consumer-side edit in this story is a mechanical field-access
  migration (`OLD_TABLE[class][slot]` → `ABILITY_GEOMETRY[class][slot].field`)
  with NO logic change — that is what makes the cross-boundary scope
  acceptable without a full task-split. If any edit in
  `apps/simulation-server` or `apps/host-client` needs to be more than a
  property rename, stop and flag it rather than improvising new logic there.

Goal:
  Task 1 — New ADR-0006: documents the `AbilityGeometry` consolidation,
            resolves D-CC1 (geometry half), references ADR-0003/ADR-0005.
  Task 2 — `packages/shared-types/src/ability-geometry.ts`: define
            `AbilityGeometry` interface + `ABILITY_GEOMETRY` table;
            remove the 5 old flat table exports (hard cutover).
  Task 3 — `packages/game-rules/src/balance.ts` + `index.ts`: update
            re-export lists (remove the 5 old names, add `ABILITY_GEOMETRY`
            + the `AbilityGeometry` type).
  Task 4 — `apps/simulation-server/src/rooms/GameRoom.ts`: migrate all
            read-sites; migrate `gatherPlayersInHitZone` and
            `isInAbilityHitZone` to accept a single geometry parameter.
  Task 5 — `apps/host-client/src/vfx/{ability,souldrinker,spiritcaller,
            stormcaller}-vfx.ts`: migrate the per-class range/radius
            destructuring idiom to read off `ABILITY_GEOMETRY`.
  Task 6 — Tests: migrate every listed test file's read expressions; fix
            the whole-tuple `ABILITY_DELIVERY` assertions in
            `tests/unit/abilities.test.ts`; add a new contract test.
  Task 7 — `deferred-work.md`: mark D-CC1's geometry half resolved by this
            story; note the balance half as a new, separate future story.
  Task 8 — Full verification: typecheck + `npx vitest run`, 0 regressions.

Allowed paths:
  - packages/shared-types/src/ability-geometry.ts
  - packages/game-rules/src/balance.ts (re-export list only, lines 10-27)
  - packages/game-rules/src/index.ts (re-export list only, lines 6-56)
  - apps/simulation-server/src/rooms/GameRoom.ts (geometry read-sites and
    the two helper methods only — see Dev Notes for the full read-site list)
  - apps/host-client/src/vfx/ability-vfx.ts
  - apps/host-client/src/vfx/souldrinker-vfx.ts
  - apps/host-client/src/vfx/spiritcaller-vfx.ts
  - apps/host-client/src/vfx/stormcaller-vfx.ts
  - apps/host-client/src/vfx/ability-vfx.test.ts
  - apps/host-client/src/vfx/souldrinker-vfx.test.ts
  - apps/host-client/src/vfx/spiritcaller-vfx.test.ts
  - tests/unit/abilities.test.ts
  - tests/unit/projectiles.test.ts
  - tests/unit/lightning-arc.test.ts
  - tests/unit/soul-mend.test.ts
  - tests/unit/combat.test.ts (verify only — expected to need NO change,
    see Dev Notes; do not edit unless a read-site is actually found there)
  - apps/simulation-server/tests/game-room-soul-mend-channel.test.ts
  - tests/e2e/full-run.test.ts
  - tests/e2e/ability-dispatch.test.ts
  - tests/contract/ability-geometry-shape.test.ts (new)
  - docs/adr/ADR-0006-ability-geometry-consolidation.md (new)
  - _bmad-output/implementation-artifacts/deferred-work.md (append a
    resolution note to the existing D-CC1 entry; do not delete/rewrite it)

Blocked paths:
  - packages/game-rules/src/balance.ts's actual balance tables
    (`ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_COOLDOWNS_MS`,
    `ABILITY_SELF_COST_HP`, `ABILITY_HP_SCALED_DAMAGE`, `ABILITY_LIFESTEAL_PCT`,
    `ABILITY_STATUS_EFFECT`, `ABILITY_DISPLACEMENT_STRENGTH`,
    `ABILITY_CHAINED_ZONE`, `ChainedZoneConfig`) — the `AbilityBalance` half
    of D-CC1, deferred to future Story 3-28. Do not touch these tables or
    their shape in this story.
  - `packages/game-rules/src/systems/combat.ts` (`isInHitZone`,
    `isInConeZone`) — pure geometry-test functions, unchanged; this story
    only changes where their scalar arguments come from, not their logic.
  - Any ability's actual numeric tuning values, hit shape, cone angle, or
    delivery type — byte-identical migration only, zero gameplay change.
  - VFX visual output / rendering behavior — the 4 host-client files change
    only how they read the same numbers, never what they render.
  - A discriminated union on `AbilityGeometry.hitShape` (e.g. requiring
    `coneAngleDeg` only when `hitShape: 'cone'` at the type level) —
    considered, rejected as disproportionate for this migration; use a
    plain optional field (see Dev Notes).

Inputs:
  - _bmad-output/implementation-artifacts/deferred-work.md — D-CC1 entry
    (correct-course review of ability hit-geometry rework, 2026-07-28)
  - docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md —
    "Alternatives considered" section names the exact target shape
    (`AbilityGeometry` in shared-types, `AbilityBalance` in game-rules)
  - docs/adr/ADR-0003-ability-presentation-contract.md — the package
    boundary this consolidation must stay inside (shared-types/host-
    importable geometry vs. game-rules/host-forbidden balance)
  - packages/shared-types/src/ability-geometry.ts (whole file, 116 lines) —
    the file being restructured
  - packages/game-rules/src/balance.ts:1-27 — the re-export block
  - packages/game-rules/src/index.ts:6-56 — the re-export block
  - apps/simulation-server/src/rooms/GameRoom.ts:1144-1190
    (`gatherPlayersInHitZone`, `isInAbilityHitZone`) and the read-site list
    in Dev Notes below
  - apps/host-client/src/vfx/{ability,souldrinker,spiritcaller,stormcaller}-vfx.ts
  - _bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md
    — introduced `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG`/`isInAbilityHitZone`,
    the pattern this story restructures
  - _bmad-output/implementation-artifacts/3-26-stormcaller-rework-ii-lightning-arc-chain-and-tempest-hurl-projectile.md
    — most recent story to touch `ability-geometry.ts`, format/pattern reference

Non-goals:
  - `AbilityBalance` consolidation (`packages/game-rules/src/balance.ts`) —
    future Story 3-28, single-owner Simulation Engineer.
  - Any change to ability behavior, numeric values, hit shapes, cone angles,
    delivery types, or VFX visuals — byte-identical migration only.
  - A new `ability-config` package spanning both packages — already
    rejected by ADR-0003's "Alternatives considered"; still applies here.
  - A discriminated-union type for `AbilityGeometry` — see Blocked paths.
  - Backward-compat shims (keeping the 5 old table names as derived
    re-exports) — this is a deliberate hard, atomic cutover; every read
    site is migrated in this same story, not soft-deprecated.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — `packages/shared-types/ability-geometry.ts`
    is touched, and unlike Stories 3.25/3.26 this is NOT additive: the 5
    existing exported table constants are removed, not extended. Protocol
    Architect review required. Compatibility note: BREAKING — mitigated by
    migrating every known read site (GameRoom.ts, 4 host-client VFX files,
    10 test files) atomically within this one story, so no caller is ever
    left importing a removed symbol. New ADR-0006 required (Task 1). New
    contract test required (Task 6 / `tests/contract/ability-geometry-shape.test.ts`).
  - Simulation-safety hook: TRIGGERED — `apps/simulation-server/GameRoom.ts`
    and `packages/game-rules` both touched (re-export lists +
    `GameRoom.ts` read-sites/helpers). Typecheck, unit tests, deterministic
    tick test (no behavior change expected — this is a pure data-shape
    migration, confirm no `Math.random()` or timing change is introduced),
    perf sanity note (one extra property-access indirection per lookup —
    negligible, note this in Completion Notes rather than assuming).
  - Client-UX hook: technically triggered (4 files under
    `apps/host-client/src/vfx/**` are touched), but this is a zero-visual-
    diff internal refactor (same numbers, same rendering, only the property
    read-path changes) — a full human couch-readability pass is not
    warranted. Instead: run the existing VFX test suite (`ability-vfx.test.ts`,
    `souldrinker-vfx.test.ts`, `spiritcaller-vfx.test.ts`,
    `stormcaller-vfx.test.ts` — all 4 files have a sibling test file) plus
    the new contract test, and state this substitution explicitly in
    Completion Notes rather than silently skipping the hook.
  - Ownership hook: 3 areas, PRE-APPROVED as a single cross-boundary story
    (see "Owner agent" above) — do not re-flag or re-split; the split
    decision (geometry now / balance later) was already made during story
    creation specifically to keep this story's remaining cross-boundary
    surface to mechanical-only edits.

Required tests:
  - tests/contract/ability-geometry-shape.test.ts (new) — for every
    `(class, slot)` pair, assert `ABILITY_GEOMETRY[class][slot]`'s fields
    equal the documented pre-refactor literal values (see the full
    per-class/slot table in Dev Notes) — a byte-identical migration
    regression guard, mirroring `tests/contract/ability-vfx-budget.test.ts`'s
    "live values, not hand-copied literals" pattern.
  - tests/unit/abilities.test.ts — rewrite the 3 whole-tuple
    `ABILITY_DELIVERY[...].toEqual([...])` assertions (stonehide,
    spiritcaller, stormcaller) and the `.not.toContain('projectile')` check
    to extract `.delivery` from each `ABILITY_GEOMETRY[class][slot]` entry
    first, then compare — these are the only assertions needing a logic
    change, not just an import rename.
  - Every other listed test file (in Allowed paths) — mechanical import +
    access-path rename only (`OLD_TABLE[class][n]` →
    `ABILITY_GEOMETRY[class][n].field`); confirm each still passes
    unchanged in intent.
  - Full suite: `npm run typecheck` + `npx vitest run`, 0 errors, 0
    regressions.

Telemetry impact: None — internal data-shape refactor, no new user-facing
  flow, no KPI event.
```

---

## Story

As a developer maintaining this project's ability configuration,
I want the 5 parallel per-field geometry tables in `packages/shared-types/src/ability-geometry.ts` (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`) consolidated into one per-ability `AbilityGeometry` object per class/slot,
so that adding a future ability property is one optional field on an existing object instead of a new top-level table requiring placeholder back-fill for every class/slot that doesn't use it — resolving D-CC1 before any further ability-property additions land on top of the current flat-table shape.

---

## Acceptance Criteria

**AC1 — `AbilityGeometry` shape defined:**
**Given** `packages/shared-types/src/ability-geometry.ts`
**When** the consolidation lands
**Then** a new `AbilityGeometry` interface (`{ hitRangePx: number; hitRadiusPx: number; hitShape: AbilityHitShape; coneAngleDeg?: number; delivery: AbilityDeliveryType }`) and a new `ABILITY_GEOMETRY: Record<PlayerClass, readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]>` replace the 5 flat tables, with every class/slot's field values byte-identical to today's tables (`coneAngleDeg` present only where `hitShape === 'cone'` today has a non-zero angle; omitted elsewhere)

**AC2 — Hard cutover, no dual tables:**
**Given** the 5 old flat table exports (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`)
**When** the story is complete
**Then** they no longer exist as exports from `shared-types` or `game-rules` — every read site (GameRoom.ts's ~15 read expressions, the 4 host-client VFX files, all listed test files) reads from `ABILITY_GEOMETRY` instead, so there is exactly one place these values live

**AC3 — `GameRoom.ts` helpers accept the object:**
**Given** `gatherPlayersInHitZone` and `isInAbilityHitZone` (`GameRoom.ts:1144-1190`)
**When** migrated
**Then** each accepts the relevant ability's `AbilityGeometry` object (or its destructured fields) instead of 3-5 separate scalar parameters pulled from 2-3 different tables at each call site, with identical resolved behavior for every existing call site (Dark Pact, Ancestor's Voice, Warding Cry, Soul Mend, Spirit Nova, the generic hit-scan loop)

**AC4 — Scalars untouched:**
**Given** the non-table constants in `ability-geometry.ts` (`PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`, `TEMPEST_HURL_*`, `VOID_PULSE_ZONE_RADIUS_PX`, `SPIRIT_NOVA_*`, `STORM_EYE_ZONE_RADIUS_PX`, `STORM_EYE_PLACEMENT_RANGE_PX`)
**When** the consolidation lands
**Then** they remain standalone named constants exactly as today, per D-CC1's own scope (single-consumer constants are not part of the flat-table sprawl it targets) — `STORM_EYE_PLACEMENT_RANGE_PX` still derives from the same value, now via `ABILITY_GEOMETRY.stormcaller[3].hitRangePx` instead of `ABILITY_HIT_RANGE_PX.stormcaller[3]`

**AC5 — Balance stays untouched:**
**Given** `packages/game-rules/src/balance.ts`'s damage/heal/cooldown/status/displacement/lifesteal/self-cost tables
**When** this story is complete
**Then** none of them change shape, name, or location — the `AbilityBalance` half of D-CC1 is explicitly out of scope, tracked as a separate future story (3-28)

**AC6 — Tests migrated, byte-identical guard added:**
**Given** the full test suite
**When** migrated
**Then** every listed test file resolves geometry via `ABILITY_GEOMETRY[class][slot].field`, `tests/unit/abilities.test.ts`'s 3 whole-tuple `ABILITY_DELIVERY` assertions are rewritten to extract `.delivery` per slot before comparing, and a new `tests/contract/ability-geometry-shape.test.ts` asserts every class/slot's migrated `AbilityGeometry` fields equal the documented pre-refactor literal values (a regression guard against silent value drift during the migration itself)

**AC7 — ADR-0006:**
**Given** this is a breaking, restructuring change (unlike Stories 3.25/3.26's additive-only pattern)
**When** the story is complete
**Then** a new `docs/adr/ADR-0006-ability-geometry-consolidation.md` documents the decision, resolves D-CC1's geometry half, references ADR-0003 and ADR-0005, and explicitly states the compatibility posture (breaking, mitigated by an atomic same-story migration of every read site rather than a soft deprecation)

**AC8 — Hooks:**
**Given** the Contract-change hook (`packages/shared-types`, breaking), Simulation-safety hook (`apps/simulation-server`, `packages/game-rules`), Client-UX hook (host-client VFX files, substituted per Dev Notes), and Ownership hook (3-way, pre-approved)
**Then** this story requires Protocol Architect review, ADR-0006, a new contract test, full simulation-safety verification, and the stated Client-UX substitution — all before merge

**Non-goals:** `AbilityBalance` consolidation (future Story 3-28). Any change to ability behavior, numeric values, hit shapes, cone angles, delivery types, or VFX visuals. A new cross-package `ability-config` package (rejected by ADR-0003). A discriminated union on `hitShape`.

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #7) — Write `docs/adr/ADR-0006-ability-geometry-consolidation.md` following the existing ADR format (see ADR-0005 for structure: Status/Context/Decision/Consequences/Alternatives considered/References). Context: cite D-CC1, ADR-0005's "Alternatives considered" section (which already names `AbilityGeometry`/`AbilityBalance` as the target shape). Decision: the `AbilityGeometry` interface + `ABILITY_GEOMETRY` table, hard cutover, scalars/balance untouched. Consequences: negative section must state this breaks the "additive-only" precedent ADR-0005 set, and how the atomic same-story migration mitigates it. Alternatives considered: discriminated union (rejected, see Dev Notes), keeping old tables as derived re-exports (rejected — hard cutover chosen instead). References: ADR-0003, ADR-0005, D-CC1 in `deferred-work.md`, this story.

- [x] **Task 2** (AC: #1, #4) — `packages/shared-types/src/ability-geometry.ts`: define `export interface AbilityGeometry { hitRangePx: number; hitRadiusPx: number; hitShape: AbilityHitShape; coneAngleDeg?: number; delivery: AbilityDeliveryType; }`. Build `export const ABILITY_GEOMETRY: Record<PlayerClass, readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]>` by transcribing each class/slot's current values from the 5 tables byte-for-byte (use the full current file content in Dev Notes as the source of truth — do not re-derive from memory). Set `coneAngleDeg` only on entries where `ABILITY_HIT_SHAPE` is today `'cone'` (stonehide[0], stonehide[3], spiritcaller[0], souldrinker[1]); omit it (leave `undefined`) on every `'circle'` entry — do not carry over the old table's "0 for circle, unread" placeholder discipline, that was specifically for the old flat-table shape. Remove the 5 old table exports entirely. Keep `AbilityHitShape`/`AbilityDeliveryType` type exports (still used standalone, e.g. `GameRoom.ts`'s `isInAbilityHitZone(shape: AbilityHitShape, ...)`). Update `STORM_EYE_PLACEMENT_RANGE_PX` to `ABILITY_GEOMETRY.stormcaller[3].hitRangePx`. Leave every other constant (PROJECTILE_*, TEMPEST_HURL_*, VOID_PULSE_ZONE_RADIUS_PX, SPIRIT_NOVA_*, STORM_EYE_ZONE_RADIUS_PX) untouched. Update the file's top JSDoc comment block to describe the new shape instead of the old table list.

- [x] **Task 3** (AC: #2) — `packages/game-rules/src/balance.ts:10-27`: replace the 5 removed names in the `export { ... } from 'shared-types'` block with `ABILITY_GEOMETRY`; add `AbilityGeometry` to the `export type { ... } from 'shared-types'` line (keep `AbilityDeliveryType`/`AbilityHitShape`). `packages/game-rules/src/index.ts:6-55` (the `export { ... } from './balance.js'` block) and `:56` (the `export type { ... }` line): same substitution.

- [x] **Task 4a** (AC: #2, #3) — `apps/simulation-server/src/rooms/GameRoom.ts`: update the import at the top of the file (currently imports the 5 old names from `'game-rules'`) to import `ABILITY_GEOMETRY` (and keep `AbilityHitShape` as a type import if still referenced standalone). Migrate every read-site — grep the file for `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY` to find them all (do not rely solely on the line numbers below, the file has shifted since this story was written — verify against current content): Dark Pact's hit-range/radius lookup (~1295), Lightning Arc's corridor range (~1464), the projectile/zone delivery-dispatch branches (~2381, ~2421), zone placement distance (~2426), Warding Cry's ally hit-radius (~2486), the generic hit-scan loop's range/radius setup (~2515), Ancestor's Voice's shape/cone-angle lookup (~2539), the generic loop's per-enemy shape dispatch (~2616), Soul Mend's channel-cancel and channel-start range/radius checks (~3091, ~3289). Each becomes `ABILITY_GEOMETRY[class][slot].fieldName`, preserving the existing `?? 0` / `?? 60` / `?? 'circle'` fallback pattern where the index isn't a literal (still needed — `Table[class][n]` still resolves to `T | undefined` under `noUncheckedIndexedAccess` regardless of table shape).

- [x] **Task 4b** (AC: #3) — `GameRoom.ts:1144-1166` (`gatherPlayersInHitZone`) and `:1172-1190` (`isInAbilityHitZone`): change their signatures to accept a single `geometry: AbilityGeometry` parameter (or the specific fields they need destructured from one) instead of separate `hitRadiusPx`/`hitRangePx`/`coneAngleDeg` parameters. Update all call sites (Dark Pact, Warding Cry, Ancestor's Voice's two call sites, the generic loop's two call sites, Spirit Nova) to pass `ABILITY_GEOMETRY[class][slot]` directly instead of pre-destructuring scalars before the call.

- [x] **Task 5** (AC: #2) — `apps/host-client/src/vfx/ability-vfx.ts`, `souldrinker-vfx.ts`, `spiritcaller-vfx.ts`, `stormcaller-vfx.ts`: update each file's import (drop `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`, add `ABILITY_GEOMETRY` from `'shared-types'`). Replace each file's `const CLASS_RANGE = ABILITY_HIT_RANGE_PX[PlayerClass.X]` / `const CLASS_RADIUS = ABILITY_HIT_RADIUS_PX[PlayerClass.X]` pair with `const CLASS_GEOMETRY = ABILITY_GEOMETRY[PlayerClass.X];`, then update every downstream positional index (`CLASS_RANGE[n]` → `CLASS_GEOMETRY[n].hitRangePx`, `CLASS_RADIUS[n]` → `CLASS_GEOMETRY[n].hitRadiusPx`) throughout each file, including `spiritcaller-vfx.ts`'s exported derived constants (`ANCESTORS_VOICE_RANGE_PX`, `ANCESTORS_VOICE_RADIUS_PX`, `WARDING_CRY_RADIUS_PX`).

- [x] **Task 6a** (AC: #6) — Migrate every listed test file's read expressions from `OLD_TABLE[class][n]` (or `.classname[n]`) to `ABILITY_GEOMETRY[class][n].field`: `apps/host-client/src/vfx/ability-vfx.test.ts`, `souldrinker-vfx.test.ts`, `spiritcaller-vfx.test.ts`, `tests/unit/abilities.test.ts`, `tests/unit/projectiles.test.ts`, `tests/unit/lightning-arc.test.ts`, `tests/unit/soul-mend.test.ts`, `apps/simulation-server/tests/game-room-soul-mend-channel.test.ts`, `tests/e2e/full-run.test.ts`, `tests/e2e/ability-dispatch.test.ts`. For `tests/unit/abilities.test.ts` specifically: rewrite the 3 `expect(ABILITY_DELIVERY[...]).toEqual([...])` whole-tuple assertions and the `.not.toContain('projectile')` check to first map each slot's `ABILITY_GEOMETRY[class][n].delivery`, then compare — these need a logic edit, not just an import rename. Verify `tests/unit/combat.test.ts` needs no change (it hardcodes real ability literals directly, imports none of the 5 tables — confirm this is still true before skipping it).

- [x] **Task 6b** (AC: #6) — New `tests/contract/ability-geometry-shape.test.ts`, following `tests/contract/ability-vfx-budget.test.ts`'s pattern (live imports, not hand-copied literals — except here the "live" values ARE the literals being asserted, since this is the migration's own correctness guard). For every `(class, slot)` pair, assert `ABILITY_GEOMETRY[class][slot]` equals the documented pre-refactor values from the current file (see Dev Notes for the full source table) — `hitRangePx`, `hitRadiusPx`, `hitShape`, `coneAngleDeg` (only where applicable), `delivery`.

- [x] **Task 7** (AC: #7) — `_bmad-output/implementation-artifacts/deferred-work.md`: append a resolution note to the existing D-CC1 entry (do not delete or rewrite the original text — match this file's existing convention of appending "RESOLVED by X" annotations, e.g. see D-3.23-A's entry) stating the geometry half is resolved by Story 3.27, and the balance half is split out as a new, separate, not-yet-created future story.

- [x] **Task 8** (AC: #8) — `npm run typecheck` + `npx vitest run` (full suite), 0 errors, 0 regressions. Confirm no `Math.random()` or new non-determinism was introduced (this task is a pure data-shape migration — the deterministic-tick expectation is trivially met, but state it explicitly in Completion Notes per the Simulation-safety hook rather than assuming).

### Review Findings

Three-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) run against the uncommitted diff (`git diff HEAD`, 23 files), using this story's own Acceptance Criteria as the Acceptance Auditor's spec. Acceptance Auditor found zero violations — full AC1-AC8 compliance confirmed independently. 8 findings from Blind Hunter, 3 from Edge Case Hunter. 0 decision_needed, 5 patch, 3 defer, 3 dismissed (2 of the dismissed were re-verified via a confirmation pass: `npm run typecheck` proves them type-safe, and existing codebase precedent at the Dark Pact call site shows the "removed" fallback was never load-bearing there).

- [x] [Review][Patch] `AbilityGeometry` interface fields aren't `readonly`, unlike the tuple-slot-level `readonly` the old flat tables had — a stray mutation anywhere would corrupt the shared singleton for every consumer (GameRoom.ts, 4 VFX planners, ~10 tests). [packages/shared-types/src/ability-geometry.ts] — fixed: all 5 fields marked `readonly`.
- [x] [Review][Patch] Zone-delivery dispatch branch reads the same `ABILITY_GEOMETRY[player.class][abilityIndex]` slot twice with inconsistent access style (direct `.delivery` access, then `?.hitRangePx ?? 0` on a re-lookup) — harmless (the second access can't actually be undefined if the first succeeded) but misleading. [apps/simulation-server/src/rooms/GameRoom.ts, zone-delivery branch] — fixed: hoisted a single `zoneGeometry` lookup, both `.delivery` and `.hitRangePx` now read off it.
- [x] [Review][Patch] Dark Pact's `ability-geometry.ts` entry comment ("aims a forward cone for its ally-target search") sits directly next to `hitShape: 'circle'`, reading as contradictory without knowing "forward cone" is colloquial for its directional aim, not the technical cone/circle enum. [packages/shared-types/src/ability-geometry.ts, souldrinker[2]] — fixed: reworded to "directional single-ally search... hitShape stays 'circle', not a real cone hit-test".
- [x] [Review][Patch] `spiritcaller-vfx.ts`'s `ANCESTORS_VOICE_RANGE_PX`/`RADIUS_PX` comments say "real hit range 180" / "real hit radius 50" — stale, pre-existing drift (the byte-identical value is 100/120) on lines this diff already touches for the identifier rename. [apps/host-client/src/vfx/spiritcaller-vfx.ts] — fixed: comments corrected to 100/120.
- [x] [Review][Patch] New contract test's `EXPECTED` type is `Record<PlayerClass, readonly AbilityGeometry[]>` (open array) instead of a 4-tuple — a missing/extra entry per class wouldn't be caught by the type checker, only by the loop's hardcoded `slot < 4` bound. [tests/contract/ability-geometry-shape.test.ts] — fixed: type tightened to `readonly [AbilityGeometry, AbilityGeometry, AbilityGeometry, AbilityGeometry]`.
- [x] [Review][Defer] `gatherPlayersInHitZone` discriminates cone-vs-circle via `coneAngleDeg !== undefined` while `isInAbilityHitZone` discriminates via `hitShape === 'cone'` — two different signals for the same fact, unenforced by the type system (a discriminated union was explicitly rejected in this story's Blocked paths). Pre-existing shape of these two helpers, not introduced by this diff — now backed by the new contract test's invariant that `coneAngleDeg` presence and `hitShape === 'cone'` always agree. — deferred, pre-existing
- [x] [Review][Defer] Three call sites (Warding Cry, Spirit Nova sweep, the generic-loop fallback) hand-roll an identical-shaped inline `{ hitRangePx: 0, hitRadiusPx: ..., hitShape: 'circle', delivery: 'hitscan' }` literal instead of sharing one small factory — minor duplication, avoided extracting an abstraction per this story's own minimal-churn mandate. — deferred, low value
- [x] [Review][Defer] `coneAngleDeg?: number` can't distinguish "unset" from a legitimate future 0°-cone ability — harmless today (no such ability exists) since it's a deliberate, documented design choice (plain optional field over a discriminated union, per Dev Notes). — deferred, revisit only if a real 0°-cone ability is ever added
- [x] [Review][Dismissed] Story's own Task 2 text says `isInAbilityHitZone` keeps a standalone `shape: AbilityHitShape` parameter, but the shipped signature takes the whole `AbilityGeometry` object — flagged by the context-free Blind Hunter layer; the Acceptance Auditor (full story context) confirmed this is Task 4b/AC3's explicit, documented simplification, already described accurately in Completion Notes. Not a defect.
- [x] [Review][Dismissed] Soul Mend channel-cancel geometry lookup (`channelGeometry.hitRangePx`/`.hitRadiusPx`) dropped the old code's `?? 0` fallback — confirmed false positive: `channel.abilityIndex as 0 | 1 | 2 | 3` is a literal-union tuple index, which TypeScript resolves to a definite `AbilityGeometry` (not `| undefined`) — proven by a clean `npm run typecheck` (accessing a property on a possibly-undefined value would be a compile error under this repo's strict config). The old `?? 0` was already dead defensive code; the codebase's own Dark Pact call site (`abilityIndex = 2`, a literal) never used such a fallback either, even pre-refactor.
- [x] [Review][Dismissed] Soul Mend fire-attempt geometry lookup — same false positive, same reasoning as the channel-cancel site above.

---

## Dev Notes

### Full current content of the file being restructured (source of truth for Task 2's transcription)

```ts
import type { PlayerClass } from './player.js';

// ── Ability hit zones (alpha tuning values) ───────────────────────────────────
export const ABILITY_HIT_RANGE_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [160, 0,   0, 75],
  spiritcaller: [100,   0, 200,   0],
  souldrinker:  [150, 180, 180,   0],
  stormcaller:  [160, 200,   0, 160],
};

export const ABILITY_HIT_RADIUS_PX: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [160, 300, 200,  50],
  spiritcaller: [ 120, 90,  60,  90],
  souldrinker:  [ 50, 65,  80,  80],
  stormcaller:  [ 60, 70, 110,  80],
};

export type AbilityHitShape = 'circle' | 'cone';

export const ABILITY_HIT_SHAPE: Record<PlayerClass, readonly [AbilityHitShape, AbilityHitShape, AbilityHitShape, AbilityHitShape]> = {
  stonehide:    ['cone', 'circle', 'circle', 'cone'],
  spiritcaller: ['cone', 'circle', 'circle', 'circle'],
  souldrinker:  ['circle', 'cone', 'circle', 'circle'],
  stormcaller:  ['circle', 'circle', 'circle', 'circle'],
};

export const ABILITY_CONE_ANGLE_DEG: Record<PlayerClass, readonly [number, number, number, number]> = {
  stonehide:    [50, 0, 0, 40],
  spiritcaller: [70, 0, 0, 0],
  souldrinker:  [0, 45, 0, 0],
  stormcaller:  [0, 0, 0, 0],
};

export type AbilityDeliveryType = 'hitscan' | 'projectile' | 'zone';

export const ABILITY_DELIVERY: Record<PlayerClass, readonly [AbilityDeliveryType, AbilityDeliveryType, AbilityDeliveryType, AbilityDeliveryType]> = {
  stonehide:    ['hitscan', 'hitscan', 'hitscan', 'hitscan'],
  spiritcaller: ['hitscan', 'hitscan', 'hitscan', 'hitscan'],
  souldrinker:  ['projectile', 'hitscan', 'hitscan', 'projectile'],
  stormcaller:  ['hitscan', 'projectile', 'hitscan', 'zone'],
};

// ── Projectiles ───────────────────────────────────────────────────────────────
export const PROJECTILE_SPEED_PX_S = 600;
export const PROJECTILE_MAX_RANGE_PX = 800;
export const TEMPEST_HURL_PROJECTILE_RADIUS_PX = 28;
export const TEMPEST_HURL_SPEED_PX_S = 300;
export const TEMPEST_HURL_BLAST_RADIUS_PX = TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2;
export const VOID_PULSE_ZONE_RADIUS_PX = 150;
export const SPIRIT_NOVA_DURATION_MS = 600;
export const SPIRIT_NOVA_MAX_RADIUS_PX = 220;
export const STORM_EYE_ZONE_RADIUS_PX = 150;
export const STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3];
```

Resulting per-class/slot values to transcribe into `ABILITY_GEOMETRY` (derive by zipping the tables above column-by-column — do not hand-recompute, just combine the values already shown):

- `stonehide`: [0]=`{hitRangePx:160, hitRadiusPx:160, hitShape:'cone', coneAngleDeg:50, delivery:'hitscan'}` (Stone Wall), [1]=`{0,300,'circle',—,'hitscan'}`, [2]=`{0,200,'circle',—,'hitscan'}`, [3]=`{75,50,'cone',40,'hitscan'}` (Avalanche)
- `spiritcaller`: [0]=`{100,120,'cone',70,'hitscan'}` (Ancestor's Voice), [1]=`{0,90,'circle',—,'hitscan'}`, [2]=`{200,60,'circle',—,'hitscan'}` (Soul Mend), [3]=`{0,90,'circle',—,'hitscan'}` (Warding Cry)
- `souldrinker`: [0]=`{150,50,'circle',—,'projectile'}` (Blood Spike), [1]=`{180,65,'cone',45,'hitscan'}` (Crimson Lash), [2]=`{180,80,'circle',—,'hitscan'}` (Dark Pact), [3]=`{0,80,'circle',—,'projectile'}` (Void Pulse)
- `stormcaller`: [0]=`{160,60,'circle',—,'hitscan'}` (Lightning Arc), [1]=`{200,70,'circle',—,'projectile'}` (Tempest Hurl), [2]=`{0,110,'circle',—,'hitscan'}` (Thunder Clap), [3]=`{160,80,'circle',—,'zone'}` (Storm Eye)

("—" = omit `coneAngleDeg` entirely for that entry, per AC1/Task 2.)

### Why a hard cutover, not a backward-compat shim

D-CC1's own recommended-fix text ("touches every read site... 20+ call sites... needs its own story") frames this as an atomic migration, not a soft deprecation. Keeping the 5 old table names alive as derived re-exports (`export const ABILITY_HIT_RANGE_PX = mapGeometryToRange(ABILITY_GEOMETRY)`) would let old and new access patterns coexist indefinitely and defeats the entire point of D-CC1 (one place these values live, not two). This story deliberately breaks ADR-0005's "additive-only" precedent — say so explicitly in ADR-0006 and in Completion Notes, don't let it read as an oversight.

### `coneAngleDeg` is a plain optional field, not a discriminated union

A stricter type (`AbilityGeometry = { hitShape: 'circle'; ... } | { hitShape: 'cone'; coneAngleDeg: number; ... }`) would be "more correct" but forces every read-site to narrow on `hitShape` before accessing other fields, and the existing `isInAbilityHitZone`/generic-hit-scan-loop call sites already read `hitRangePx`/`hitRadiusPx` unconditionally regardless of shape (only `coneAngleDeg` is shape-gated). A plain optional field matches this story's own "mechanical migration, minimal churn" mandate — don't introduce the discriminated union, even though it's the "textbook correct" choice; ADR-0006 should note this as a considered-and-rejected alternative, same convention as ADR-0005's own "Alternatives considered."

### `gatherPlayersInHitZone` / `isInAbilityHitZone` are natural single-object call sites

Both helpers (`GameRoom.ts:1144-1190`) already group `hitRadiusPx`/`hitRangePx`/`coneAngleDeg`/`isDirectional` as separate parameters pulled from 2-3 different tables at each call site — this is exactly the "grouping several fields that are always looked up together" signal AC1/D-CC1 target. Migrating their signatures to take the `AbilityGeometry` object directly is in-scope (contained entirely within `GameRoom.ts`, single-owner Simulation Engineer) and is the cleanest demonstration that the consolidation actually reduces call-site complexity, not just renames imports.

### `STORM_EYE_PLACEMENT_RANGE_PX`'s derivation must still work

It's computed at module-eval time from `ABILITY_HIT_RANGE_PX.stormcaller[3]` today — after Task 2, it must derive from `ABILITY_GEOMETRY.stormcaller[3].hitRangePx` instead, evaluated after `ABILITY_GEOMETRY` is fully defined (same ordering constraint as today, just a different source expression).

### Client-UX hook substitution

`apps/host-client/src/vfx/*.ts` files are touched, technically triggering the Client-UX hook's host checks (join flow smoke test, host HUD readability, reconnect state visibility, couch readability). None of those apply here — this changes only which internal constant a VFX config reads its range/radius from, never a rendered value, layout, or interaction. State in Completion Notes that the substitute verification (existing VFX unit tests + the new contract test) was used instead of a human couch-distance pass, and why, rather than silently omitting the hook.

### `AbilityBalance` (D-CC1's other half) is out of scope

Do not touch `packages/game-rules/src/balance.ts`'s damage/heal/cooldown/status/displacement/lifesteal/self-cost tables or `ABILITY_CHAINED_ZONE`/`ChainedZoneConfig`. That consolidation is single-owner (Simulation Engineer only, since only `GameRoom.ts` reads those tables) and was deliberately split into a separate future story during this story's creation — mention it exists but do not start it.

### Project Context Rules

- **Package Responsibility Boundaries (ADR-0003)**: `AbilityGeometry` must stay physically inside `packages/shared-types` — do not move it to a new package or merge it with `balance.ts`'s tables. This is the exact boundary ADR-0003 established and D-CC1/ADR-0005 both explicitly preserve.
- **Naming Conventions**: `ABILITY_GEOMETRY` (SCREAMING_SNAKE_CASE for the table constant, matching every existing table in this file); `AbilityGeometry` (PascalCase for the interface, matching `AbilityHitShape`/`AbilityDeliveryType`/`ChainedZoneConfig`'s existing convention).
- **TypeScript strict mode**: no `any`; `coneAngleDeg?: number` (optional, not `number | null`, matching this codebase's existing optional-field convention, e.g. `ChainedZoneConfig | null` in the balance-side tuple tables uses `| null` for tuple slots but a genuinely optional object field should use `?:` — confirm against `AbilityStatusEffectConfig`'s own field style in `balance.ts` if unsure).
- **Contract-Change Hook**: this is the first NON-additive change to `ability-geometry.ts` since ADR-0003 — every prior story (7.9, 3.25, 3.26) explicitly framed its change as additive. State the breaking-change compatibility posture explicitly in both ADR-0006 and Completion Notes; do not reuse the "additive-only" language from those stories' hook sections.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — D-CC1 entry ("Deferred from: correct-course review of ability hit-geometry rework, 2026-07-28")
- [Source: docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md] — "Alternatives considered" section names `AbilityGeometry`/`AbilityBalance` as the target shape; "Negative / trade-offs" section documents D-CC1 as deliberately deferred
- [Source: docs/adr/ADR-0003-ability-presentation-contract.md] — the package-split rationale this consolidation must stay inside
- [Source: packages/shared-types/src/ability-geometry.ts] — whole file, transcribed above
- [Source: packages/game-rules/src/balance.ts:1-27] — re-export block to update
- [Source: packages/game-rules/src/index.ts:6-56] — re-export block to update
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1144-1190] — `gatherPlayersInHitZone`/`isInAbilityHitZone`, the natural single-object call sites
- [Source: apps/host-client/src/vfx/ability-vfx.ts, souldrinker-vfx.ts, spiritcaller-vfx.ts, stormcaller-vfx.ts] — the shared per-class range/radius destructuring idiom to migrate
- [Source: tests/contract/ability-vfx-budget.test.ts] — the existing cross-package "live values, not hand-copied literals" contract-test pattern to mirror for Task 6b
- [Source: _bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md] — introduced `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG`/`isInAbilityHitZone`
- [Source: _bmad-output/implementation-artifacts/3-26-stormcaller-rework-ii-lightning-arc-chain-and-tempest-hurl-projectile.md] — most recent story touching this file; format/pattern reference for this story's own structure

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Typecheck first pass caught 1 error: `GameRoom.ts:2703` (Spirit Nova sweep's `gatherPlayersInHitZone` call, in the tick-phase sweep loop — separate from the dispatch-loop call sites already migrated) still called the helper with the old 8-scalar-argument signature. Fixed by building an inline `{ hitRangePx: 0, hitRadiusPx: currentRadius, hitShape: 'circle', delivery: 'hitscan' }` geometry object (mirrors the Warding Cry call site's pattern, since the ring's radius is computed per-tick and can't come from a static `ABILITY_GEOMETRY` entry). Second typecheck pass: clean, 0 errors across all 10 tsconfigs.
- Full `vitest run` (file-parallel, default): `PASS (635) FAIL (1) skipped (3)`. The 1 failure is the pre-existing `ability-vfx.test.ts` Stone Wall geometry test (memory: `known-failing-stonehide-geometry-test.md`), unrelated to this story. `numFailedTestSuites: 6` in the JSON summary looked alarming but turned out to be `EADDRINUSE :::2568` port-collision noise from e2e suites sharing a fixed `TEST_PORT` under file-parallelism, not real failures.
- Re-ran the affected e2e suites with `--no-file-parallelism` to isolate the real signal: `hub-ability-use.test.ts` passes cleanly (its earlier "failure" was pure port collision). `ability-dispatch.test.ts`'s "Ancestor's Voice ... (AC1)" test fails deterministically (`heal.hp` below the ally's starting 100 HP, exact value varies run-to-run: 65, 40, 25 observed) — confirmed via `git stash` / `git stash pop` that this fails identically on the clean pre-story baseline, so it predates this story's migration entirely. This is the same intermittent failure Story 3.26's own session already flagged (its sprint-status.yaml history entry: "confirmed via git stash to fail identically on the pre-story baseline"). New memory saved: `known-flaky-ancestors-voice-e2e-test.md`.

### Completion Notes List

- **Scope delivered:** D-CC1's `shared-types` half only (per this story's Non-goals) — the 5 flat per-class geometry tables in `packages/shared-types/src/ability-geometry.ts` are replaced by one `AbilityGeometry` interface + `ABILITY_GEOMETRY` table. Hard cutover: the 5 old exports (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_HIT_SHAPE`, `ABILITY_CONE_ANGLE_DEG`, `ABILITY_DELIVERY`) no longer exist anywhere in the codebase (verified by a repo-wide grep leaving only 3 historical-reference comments, which intentionally still name the old symbols to document what was replaced). Every value is byte-identical to its pre-refactor table entry (see the new contract test, Task 6b) — no gameplay/behavior change.
- **`gatherPlayersInHitZone`/`isInAbilityHitZone` signature simplification (AC3):** both `GameRoom.ts` helpers now take a single `AbilityGeometry` parameter instead of 3-5 separate scalar parameters pulled from up to 3 different tables per call site. This collapsed several call sites nicely — e.g. Ancestor's Voice's branch no longer needs its own `voiceShape`/`voiceConeAngleDeg` locals at all, since the outer `geometry` local (computed once per `player.class`/`abilityIndex` at the top of the generic dispatch path) already equals the same lookup.
- **One read-site the story's own line-number estimates didn't catch:** the Spirit Nova expanding-ring sweep's `gatherPlayersInHitZone` call lives in the tick-phase loop (~line 2703), not the ability-dispatch loop the story's Task 4a list was built from — caught immediately by the first typecheck pass (see Debug Log), fixed with an inline geometry object since the sweep's radius is a per-tick computed value, not a static table entry.
- **`coneAngleDeg` is a plain optional field** (present only on the 4 cone-shaped entries: stonehide[0]/[3], spiritcaller[0], souldrinker[1]), not a discriminated union — per the story's explicit Blocked-paths instruction. `isInAbilityHitZone` reads `geometry.coneAngleDeg ?? 0` defensively for the cone branch even though it's always defined when `hitShape === 'cone'` in practice.
- **`AbilityBalance` (D-CC1's other half) untouched** — confirmed no edits to `packages/game-rules/src/balance.ts`'s actual balance tables (only its `ability-geometry.ts` re-export list changed, Task 3). Tracked as future Story 3-28 per this story's Non-goals.
- **Contract-change hook (TRIGGERED, non-additive/breaking):** `packages/shared-types/src/ability-geometry.ts` had 5 exported table constants removed, not extended — the first non-additive change to this file since ADR-0003. Compatibility posture: **breaking**, mitigated by migrating every known read site (GameRoom.ts's ~17 expressions including the 2 helper signatures and the Spirit Nova sweep site found during typecheck; 4 host-client VFX files; 10 test files) atomically within this single story — confirmed via a full-repo grep (0 remaining references outside 3 intentional historical comments) and a clean `npm run typecheck` across all 10 tsconfigs. **Protocol Architect review required** before merge, per CLAUDE.md's Contract-change hook. Spec/ADR update: new `docs/adr/ADR-0006-ability-geometry-consolidation.md` (Task 1), referencing ADR-0003 and ADR-0005. Contract test: new `tests/contract/ability-geometry-shape.test.ts` (Task 6b), asserting every class/slot's migrated values against the documented pre-refactor literals — all pass.
- **Simulation-safety hook:** `npm run typecheck` clean (10/10 tsconfigs); `npx vitest run` shows 0 new failures (see Debug Log for the 2 pre-existing, confirmed-unrelated failures). This is a pure data-shape migration — no `Math.random()` or new timing/ordering was introduced anywhere in the touched `GameRoom.ts` code; every migrated read-site is a mechanical field-access rewrite of an existing lookup.
- **Client-UX hook substitution:** all 4 touched `apps/host-client/src/vfx/*.ts` files changed only their internal constant-destructuring source (same numeric values, same rendering) — no couch-readability human pass was run; the existing VFX test suites (`ability-vfx.test.ts`, `souldrinker-vfx.test.ts`, `spiritcaller-vfx.test.ts` — `stormcaller-vfx.test.ts` doesn't read the migrated tables directly and needed no change) plus the new contract test stand in for it, per the story's own Dev Notes justification.
- **Ownership hook:** 3-way cross-boundary (Protocol Architect + Simulation Engineer + Host Experience Engineer), pre-approved during story creation — every non-`shared-types` edit was a mechanical property-access rename, no new logic introduced in `GameRoom.ts` or the VFX files beyond the 2 helper-signature simplifications (which stay within `GameRoom.ts`, Simulation Engineer's own file).
- **Post-implementation code review** (3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor; full detail in "### Review Findings" above): Acceptance Auditor found zero AC violations. 5 patch findings applied (readonly `AbilityGeometry` fields, a hoisted single-lookup fix in the zone-delivery branch, two misleading/stale comments corrected, the contract test's `EXPECTED` type tightened to a 4-tuple). 3 deferred to `deferred-work.md` (D-3.27-A/B/C — all pre-existing helper-design characteristics or deliberate, documented choices, not defects). 2 Edge Case Hunter findings dismissed after a confirmation pass proved them false positives (a clean `npm run typecheck` demonstrates the "dropped fallback" sites are type-safe by construction). Re-ran `npm run typecheck` (clean, 10/10) and `npx vitest run --no-file-parallelism` (637 passed, 2 pre-existing unrelated failures, same as before the patches) after applying all 5 patches — 0 regressions introduced by the review fixes.
- **Confidence: 90%** — typecheck is clean, the new byte-identical contract test passes for all 16 class/slot entries, and the full test suite's only failures are two independently pre-existing issues (both confirmed via `git stash` against the clean baseline, one already documented in memory from a prior story). The 10% reservation is for the two-pre-existing-failures judgment call itself — a human reviewer may want to re-verify the `git stash` comparison independently before merge, given this story does touch code adjacent to both (Ancestor's Voice's own branch, and the Stonehide-adjacent `ability-vfx.ts`).

### File List

- `docs/adr/ADR-0006-ability-geometry-consolidation.md` — new ADR (Task 1)
- `packages/shared-types/src/ability-geometry.ts` — `AbilityGeometry` interface + `ABILITY_GEOMETRY` table replace the 5 flat tables (Task 2)
- `packages/game-rules/src/balance.ts` — re-export list updated to `ABILITY_GEOMETRY`/`AbilityGeometry` (Task 3)
- `packages/game-rules/src/index.ts` — re-export list updated to `ABILITY_GEOMETRY`/`AbilityGeometry` (Task 3)
- `apps/simulation-server/src/rooms/GameRoom.ts` — all geometry read-sites migrated; `gatherPlayersInHitZone`/`isInAbilityHitZone` take an `AbilityGeometry` parameter; import list updated (Task 4a/4b)
- `apps/host-client/src/vfx/ability-vfx.ts` — Stonehide range/radius destructuring migrated to `ABILITY_GEOMETRY` (Task 5)
- `apps/host-client/src/vfx/souldrinker-vfx.ts` — same, Souldrinker (Task 5)
- `apps/host-client/src/vfx/spiritcaller-vfx.ts` — same, Spiritcaller (Task 5)
- `apps/host-client/src/vfx/stormcaller-vfx.ts` — same, Stormcaller (Task 5)
- `apps/host-client/src/vfx/ability-vfx.test.ts` — import/access-path migrated (Task 6a)
- `apps/host-client/src/vfx/souldrinker-vfx.test.ts` — same (Task 6a)
- `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` — same (Task 6a)
- `apps/simulation-server/tests/game-room-soul-mend-channel.test.ts` — same (Task 6a)
- `tests/unit/abilities.test.ts` — import/access-path migrated; 3 whole-tuple `ABILITY_DELIVERY.toEqual([...])` assertions + 1 `.not.toContain` rewritten to map `.delivery` first (Task 6a)
- `tests/unit/projectiles.test.ts` — same (Task 6a)
- `tests/unit/lightning-arc.test.ts` — same (Task 6a)
- `tests/unit/soul-mend.test.ts` — same (Task 6a)
- `tests/e2e/full-run.test.ts` — same (Task 6a)
- `tests/e2e/ability-dispatch.test.ts` — same (Task 6a)
- `tests/contract/ability-geometry-shape.test.ts` — new byte-identical migration guard contract test (Task 6b)
- `_bmad-output/implementation-artifacts/deferred-work.md` — D-CC1 entry annotated with a "Geometry half RESOLVED by Story 3.27" note (Task 7)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates (create-story, dev-story start/in-progress)

## Change Log

- 2026-07-29: code-review — 3-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decision_needed, 5 patch (all applied: readonly AbilityGeometry fields, hoisted single-lookup in zone-delivery branch, 2 comment fixes, contract test EXPECTED type tightened to a 4-tuple), 3 defer (D-3.27-A/B/C, appended to deferred-work.md), 3 dismissed (2 confirmed false positives via typecheck + codebase precedent, 1 resolved by fuller story context than the context-free layer had). Acceptance Auditor: zero AC violations. Re-verified typecheck (clean) and full test suite (637 passed, 2 pre-existing unrelated failures) after patches. Status → done.
- 2026-07-29: dev-story — implemented Story 3.27. Consolidated `packages/shared-types/src/ability-geometry.ts`'s 5 flat per-class geometry tables into one `AbilityGeometry` object per ability (`ABILITY_GEOMETRY`), hard cutover (resolves D-CC1's geometry half, ADR-0006). Migrated every read site: `GameRoom.ts` (~17 expressions plus its 2 shared helper signatures), 4 `apps/host-client/src/vfx/*.ts` files, and 10 test files. Added `tests/contract/ability-geometry-shape.test.ts` as a byte-identical migration guard. Typecheck clean (10/10 tsconfigs) after fixing one missed read-site (Spirit Nova sweep) caught by the first pass. Full test suite: 0 regressions — 2 pre-existing failures confirmed via `git stash` to exist identically on the clean baseline (Stonehide VFX geometry test, already tracked in memory; an intermittent Ancestor's Voice e2e heal assertion, also previously flagged by Story 3.26's own session — new memory note added). Status → review.

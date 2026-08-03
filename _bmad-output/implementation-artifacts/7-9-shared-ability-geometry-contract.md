---
baseline_commit: 6113cbda39af55999ae9194c16e9457b3a5cd54f
---

# Story 7.9: Shared Ability-Geometry Contract — VFX Tracks Balance Dynamically

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a designer tuning abilities,
I want each ability's on-screen effect to be driven by the same hit-geometry values the simulation uses,
so that when I change an ability's range or radius the VFX moves with it automatically, making the visuals a trustworthy validation tool instead of a hand-copied snapshot that silently drifts.

## Context & Motivation

Epic 7's VFX (Stories 7.2–7.8) deliberately **transcribe** the sim's hit geometry into local host constants, because the project rule forbids `apps/host-client` from importing `packages/game-rules` (host is a pure renderer; game-rules is protected simulation core). That was the correct call *for a prototype*, but it means the numbers are a copy: change `ABILITY_HIT_RANGE_PX.stonehide[0]` in `balance.ts` and the sim hits farther while the VFX keeps drawing at the old range — a visual that now lies about reach. This drift was flagged during the 7.2 code review as **`D-7.2-A`**.

The user has decided (2026-07-23) to make the VFX **dynamically track balance** (the "Option B" from that review): move the ability *spatial/presentation geometry* out of `balance.ts` into a shared, host-importable location so the sim and the renderer read the **same** values. Changing a range then updates both with a single edit.

This is viable with no dependency cycle: `packages/game-rules` already imports `packages/shared-types` (one-way), `shared-types` never imports `game-rules`, and the host already imports timing constants (e.g. `PURIFICATION_PULSE_DURATION_MS`) from `shared-types`. So `shared-types` is the correct shared home.

## Acceptance Criteria

1. **The ability presentation contract lives in `shared-types` and is the single source of truth.** A new module `packages/shared-types/src/ability-geometry.ts` (re-exported from `shared-types`'s barrel) holds the ability **spatial + delivery** constants that both the simulation and the host renderer must agree on: `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY`, `STORM_EYE_ZONE_RADIUS_PX`, `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS`, and the Void Pulse chained-zone radius, plus `PROJECTILE_SPEED_PX_S` / `PROJECTILE_MAX_RANGE_PX`. Every value is **byte-identical** to its current `balance.ts` definition (this is a relocation, not a re-tune).

2. **The simulation reads the moved constants from the shared contract, with byte-identical behaviour.** `packages/game-rules` no longer *defines* the moved constants; it re-exports them from `shared-types` (so `import { ABILITY_HIT_RANGE_PX } from 'game-rules'` still resolves and no `apps/simulation-server` import churns). The deterministic tick and any replay/hit-detection tests produce **identical** results before and after — verified, not assumed.

3. **The host VFX derives its geometry from the shared contract, and the hand-transcribed geometry literals are deleted.** `apps/host-client/src/vfx/ability-vfx.ts` and `spiritcaller-vfx.ts` **import** the real hit-range/radius (and nova/zone radii) from `shared-types` and compute their placement/sizing from them — the local `hitRangePx` / `ANCESTORS_VOICE_RANGE_PX` / etc. transcriptions of *sim geometry* are removed. Purely-cosmetic constants (colors, stroke widths, cosmetic fade durations that do not correspond to a real sim value) stay local.

4. **Changing a single balance value moves both the sim hit and the VFX.** Demonstrated by the test suite: with the contract as the only definition, a test that reads the contract value proves the host placement math uses it (e.g. Avalanche's rendered hit centre is `caster + normDir × ABILITY_HIT_RANGE_PX.stonehide[3]`, read live, not a literal `200`). No host file contains a numeric copy of a moved value.

5. **A cross-package contract test backstops anything that stays transcribed.** For the values that remain balance-only (cooldowns, damage, heal, status magnitudes) but that a VFX invariant depends on — specifically the 7.2 **AC5 budget invariant** (every effect's `durationMs` is strictly shorter than that ability's cooldown) — a test under `tests/contract/**` (the one place allowed to import *both* `game-rules` and the host visual constants) asserts the invariant against the live `ABILITY_COOLDOWNS_MS`, replacing the current hardcoded-cooldown test literals in `ability-vfx.test.ts`.

6. **The architecture decision is recorded.** A new `docs/adr/ADR-0003-ability-presentation-contract.md` documents: what the "ability presentation contract" is (the spatial/delivery/sweep subset), *why* it may live in `shared-types` and be host-imported while pure balance (damage/cooldown/heal/status magnitude) stays in `game-rules` and remains host-forbidden, and the refined rule — **the host never imports `game-rules` logic; it may import the shared spatial contract from `shared-types`.** `D-7.2-A` is marked resolved by this story in `deferred-work.md`.

7. **The not-yet-implemented sibling VFX stories are updated to consume the contract, not transcribe.** Stories 7.4, 7.5, 7.6, 7.8 (`ready-for-dev`, unimplemented) have their Dev Notes guidance changed from "transcribe from `balance.ts`" to "import the spatial geometry from `shared-types`", so they are authored against the contract from the start and this story does not create future rework. (7.2 and 7.3 are retrofitted by AC3; no other already-`done` story is touched.)

8. **No regression and no re-tune.** The full suite is green; typecheck passes across all 10 tsconfigs; the sim's gameplay is behaviourally identical (same hits, same zones, same determinism); and no ability's *balance* (damage, cooldown, heal, status magnitude, displacement, lifesteal, self-cost) is changed by this story.

## Tasks / Subtasks

- [x] **Task 1 — Define the shared ability-geometry contract (AC: 1)**
  - [x] 1.1: Created `packages/shared-types/src/ability-geometry.ts` with byte-identical `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY` (+ `AbilityDeliveryType`), `STORM_EYE_ZONE_RADIUS_PX`, `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS`, `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`. Void Pulse chained-zone radius extracted to a named `VOID_PULSE_ZONE_RADIUS_PX` (the table's game-logic fields — effectType/tickIntervalMs/durationMs — stay in `balance.ts` and reference it; rationale in ADR). `Record<PlayerClass, readonly [...]>` typing kept; `PlayerClass` imported from `./player.js`.
  - [x] 1.2: Re-exported from the barrel (`export * from './ability-geometry.js';`).
  - [x] 1.3: Recorded in ADR: cooldowns/damage/heal/status-magnitude/displacement/lifesteal/self-cost stay in `balance.ts`, host-forbidden.

- [x] **Task 2 — Rewire `game-rules` to re-export, sim behaviour unchanged (AC: 2)**
  - [x] 2.1: `balance.ts` deletes the moved definitions and re-exports them (+ the `AbilityDeliveryType` type) from `shared-types`. `packages/game-rules/src/index.ts` re-exports the same names from `./balance.js` untouched — public surface unchanged.
  - [x] 2.2: `GameRoom.ts` and `combat.ts` compile **untouched** — zero sim import churn (they import from `game-rules`, which still re-exports). No sim file needed a path change.
  - [x] 2.3: Simulation-safety gate green — `apps/simulation-server` 81 tests pass (incl. deterministic tick), `packages/game-rules` 62 pass. Byte-identical relocation ⇒ identical hits.

- [x] **Task 3 — Host VFX imports the contract; delete transcriptions (AC: 3, 4)**
  - [x] 3.1: `ability-vfx.ts` imports `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX` from `shared-types`; Stonehide `hitRangePx` + ring/beam radii read `STONEHIDE_RANGE[i]`/`STONEHIDE_RADIUS[i]`. Tremor Stomp's `hitRangePx` stays a hard `0` (TAP delivery ignores its 160 range — a delivery semantic, not geometry; commented). Header comment updated: imported, not transcribed.
  - [x] 3.2: `spiritcaller-vfx.ts` derives `ANCESTORS_VOICE_RANGE_PX`/`_RADIUS_PX`, `SPIRIT_NOVA_MAX_RADIUS_VFX_PX`, `SPIRIT_NOVA_DURATION_VFX_MS`, `SOUL_MEND_RANGE_PX`, `WARDING_CRY_RADIUS_PX` from the contract. Cosmetic overshoots re-expressed relative to the contract (nova halo `SPIRIT_NOVA_MAX_RADIUS_VFX_PX - 30`; warding-cry start `WARDING_CRY_RADIUS_PX + 60`) with comments; `SOUL_MEND_CHANNEL_VFX_MS` kept local as a documented cosmetic fallback.
  - [x] 3.3: Grepped both vfx files for `180|200|220|160|150`; every remaining hit is a cosmetic duration (ms) or a comment. The lone `120` (Soul Mend progress-ring start) is cosmetic, not Soul Mend's sim geometry (range 200 / radius 60).
  - [x] 3.4: `ability-vfx.test.ts` Avalanche placement now reads `ABILITY_HIT_RANGE_PX.stonehide[3]` (not literal 200); `spiritcaller-vfx.test.ts` gains an assertion that `ANCESTORS_VOICE_RANGE_PX === ABILITY_HIT_RANGE_PX.spiritcaller[0]` — both prove the live link (AC4).

- [x] **Task 4 — Cross-package contract test for the budget invariant (AC: 5)**
  - [x] 4.1: Added `tests/contract/ability-vfx-budget.test.ts` — imports `ABILITY_COOLDOWNS_MS` from `game-rules` and `getAbilityVfxConfig` from the host (PixiJS-free), iterates every class/index, and asserts each bespoke config's longest effect duration < its live cooldown. A guard test fails if the config set is silently empty. (Coverage grows as 7.4/7.5 add their config tables; Stonehide's four abilities are covered now.)
  - [x] 4.2: Removed the hardcoded `STONEHIDE_COOLDOWNS_MS` literal (and the now-orphaned `durationsOf` helper + budget `it`) from `ability-vfx.test.ts`; the pure planner/placement tests stay.
  - [x] 4.3: Confirmed `tests/contract/**` imports both packages — precedent `boss-arena-6-3.test.ts` imports `../../apps/simulation-server/...`; `tests/tsconfig.json` includes `contract/**`, deps include `game-rules`.

- [x] **Task 5 — Update the unimplemented sibling story specs (AC: 7)**
  - [x] 5.1: Re-pointed the Dev Notes guidance in `7-4`, `7-5` (bullet + Task 2.2), `7-6`, `7-8` from "transcribe / never import game-rules" to "import the spatial geometry from `shared-types`; never import `game-rules` *logic*", with a one-line Change Log entry in each. Task/AC status untouched.
  - [x] 5.2: No `done` story and no 7.7a/7.7b protocol scope touched.

- [x] **Task 6 — ADR + deferred-work bookkeeping (AC: 6)**
  - [x] 6.1: Wrote `docs/adr/ADR-0003-ability-presentation-contract.md` (Status/Context/Decision/refined boundary rule + table/Consequences/Alternatives) in the ADR-0001/0002 format.
  - [x] 6.2: Annotated `D-7.2-A` in `deferred-work.md` as **RESOLVED by Story 7.9** (entry preserved, not deleted).

- [x] **Task 7 — Full validation (AC: 8)**
  - [x] 7.1: `npm run typecheck` — all 10 tsconfigs clean.
  - [x] 7.2: Ran the suites this story touches — game-rules 62, simulation-server 81 (deterministic), all `tests/contract` 115 — green. Did **not** run the WSL2-flaky e2e boot (explicitly out of scope per Dev Notes); no deterministic sim test regressed.
  - [x] 7.3: `npx vitest run` in `apps/host-client` — 43 pass, 0 fail.
  - [x] 7.4: Final grep confirms no host file numerically duplicates a moved constant (see 3.3).

### Review Findings

_Code review 2026-07-23 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor: no AC violations. 4 patch findings, 6 dismissed as noise/false-positive, 0 decision-needed. The Blind Hunter's sole "High" (new module/ADR/contract-test "absent from the diff") was a diff-generation artifact — `git diff <baseline>` omits untracked new files; the files exist, typecheck passes 10/10, and both file-access reviewers confirmed byte-identity — so it is dismissed, not a code defect._

- [x] [Review][Patch] Strengthen the tautological Spiritcaller live-link test — now asserts `planSpiritcallerCast(...).focusX === caster + ABILITY_HIT_RANGE_PX.spiritcaller[0]` (the planner's placement math), not `export === export` [apps/host-client/src/vfx/spiritcaller-vfx.test.ts] — **fixed**
- [x] [Review][Patch] Make Stonehide VFX slots consistent by delivery type [apps/host-client/src/vfx/ability-vfx.ts] — **fixed, then corrected**. The review patch initially hard-`0`'d slots 0 AND 2 (following the Blind Hunter's project-blind claim that Stone Wall and Iron Skin were "the same self-centred case"). **That was wrong for Stone Wall:** Stone Wall is `RELEASE` → `isDirectional` in the sim (`GameRoom.ts:2185`), so its hit is `caster + aim × range`; hard-`0` VFX would drift from the sim if its range were re-tuned non-zero (surfaced by manual testing). Corrected to the sim's own rule: **directional (RELEASE/AUTO) slots 0 & 3 read `STONEHIDE_RANGE[i]`; TAP slots 1 & 2 use hard `0`** (the sim ignores a TAP's range). Radii always track. Re-verified: typecheck clean, host 43.
- [x] [Review][Patch] Correct the `spiritcaller-vfx.ts` header over-claim — reworded to "the spatial hit geometry is imported; cosmetic accent radii / fallback durations stay local", matching `ability-vfx.ts` [apps/host-client/src/vfx/spiritcaller-vfx.ts:5] — **fixed**
- [x] [Review][Patch] Extend the budget contract test — added a Spirit Nova sweep assertion via the importable `SPIRIT_NOVA_DURATION_MS`, and hardened the guard to fail on an empty *assertion* set (contract test now 6 green) [tests/contract/ability-vfx-budget.test.ts] — **fixed**

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 enabler. Motivated entirely by making the 7.2–7.8 VFX honesty *dynamic* rather than transcribed. Numbered 7.9 to sit with its motivating epic; note that Epic 7's "no protocol/schema changes" non-goal has one sanctioned exception already (7.7a), and this is a **second, explicitly-approved** exception (user decision 2026-07-23) — a constant-relocation contract change, not a new wire message.
- **Context:** See *Context & Motivation* above. This resolves `D-7.2-A`.
- **Goal:** One source of truth for ability spatial geometry, shared by sim and renderer, so tuning a range/radius updates both.
- **Allowed paths:**
  - `packages/shared-types/src/ability-geometry.ts` (NEW), `packages/shared-types/src/index.ts` (barrel)
  - `packages/game-rules/src/balance.ts` (delete defs + re-export), `packages/game-rules/src/index.ts` (verify surface)
  - `apps/host-client/src/vfx/ability-vfx.ts`, `apps/host-client/src/vfx/spiritcaller-vfx.ts`, and their `.test.ts`
  - `tests/contract/**` (new budget contract test)
  - `docs/adr/ADR-0003-ability-presentation-contract.md` (NEW)
  - `_bmad-output/implementation-artifacts/7-4-*.md`, `7-5-*.md`, `7-6-*.md`, `7-8-*.md` (Dev Notes guidance note only), `deferred-work.md`, this story file, `sprint-status.yaml`
- **Blocked paths:** `apps/simulation-server/**` (should not need edits — the re-export keeps sim imports resolving; if one genuinely must change, that is a flag, not a silent edit), `apps/mobile-controller/**`, `packages/net-protocol/**`, `packages/ui-kit/**`, `apps/host-client/src/vfx/{types,primitives,engine}.ts`, any `done` story file, 7.7a/7.7b.
- **Ownership check — MULTI-AREA (the important one).** This story crosses three ownership areas: `packages/shared-types/**` (Protocol Architect), `packages/game-rules/**` (Simulation Engineer), `apps/host-client/**` (Host Experience Engineer). CLAUDE.md says split unless there is a strong reason not to. **The strong reason:** moving a constant is atomic — the definition, every consumer, and the type must move in one commit or nothing typechecks. Splitting would leave the tree non-compiling between stories. So it stays one story, but requires **cross-context approval** and the reviews below.
- **Hook verdicts:**
  - **Contract-change hook — TRIGGERED.** Touches `packages/shared-types/**` and relocates a contract. Requires: **Protocol Architect review**, a compatibility checklist (the re-export preserves every existing import path — that is the checklist's core), an **ADR** (Task 6, AC6), and **at least one contract test** (Task 4). No wire message, schema field, session-lifecycle, reconnect, room-state, join-flow, or prediction/reconciliation surface changes — the change is a compile-time constant relocation, behaviourally inert.
  - **Simulation-safety hook — TRIGGERED.** Touches `packages/game-rules/**`. Requires typecheck, unit tests, **deterministic tick test**, replay test if available, and a perf sanity check. Because this is a pure relocation with byte-identical values, "deterministic behaviour is unchanged" is the specific thing to prove (AC2/AC8).
  - **Client-UX hook — NOT triggered for behaviour, but a light visual sanity check is wise:** after 7.2/7.3 retrofit, the four Stonehide + four Spiritcaller effects should render **exactly as before** (same positions/sizes), since the imported values equal the old transcriptions. If 7.2/7.3's Client-UX manual pass has not yet run, it can be folded together with this verification.
  - **Telemetry hook — N/A.**
  - **Merge gate:** Protocol Architect review + Simulation Engineer sign-off (deterministic test green) + ADR written + contract test green + full suite green + no host numeric duplicate of a moved value.

### Why `shared-types` is safe (no cycle)

`packages/game-rules/package.json` declares `"shared-types": "*"` and `balance.ts:1` already does `import type { PlayerClass, ... } from 'shared-types'`. The dependency is strictly `game-rules → shared-types`. `shared-types` imports nothing from `game-rules` (verified: only a *comment* in `session.ts` mentions it). Adding geometry constants to `shared-types` and having `game-rules` re-export them keeps the arrow one-way. The host already imports `PlayerClass`, `StatusEffect`, and `PURIFICATION_PULSE_DURATION_MS` from `shared-types`, so importing geometry from there introduces no new package edge.

### The boundary principle (for the ADR)

Split by the question: **does the host need this value at runtime to render honestly?**

| Constant | Host renders it as geometry? | Home after this story |
|---|---|---|
| `ABILITY_HIT_RANGE_PX` | Yes — where the effect lands | `shared-types` (contract) |
| `ABILITY_HIT_RADIUS_PX` | Yes — how big | `shared-types` |
| `ABILITY_DELIVERY` | Yes — beam vs projectile vs zone | `shared-types` |
| `SPIRIT_NOVA_MAX_RADIUS_PX` / `SPIRIT_NOVA_DURATION_MS` | Yes — the visible sweep must match the real sweep | `shared-types` |
| `STORM_EYE_ZONE_RADIUS_PX`, Void Pulse zone radius | Yes — zone size | `shared-types` |
| `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX` | Yes — trail placement (7.8) | `shared-types` |
| `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, `ABILITY_STATUS_EFFECT` magnitude, `ABILITY_DISPLACEMENT_STRENGTH`, `ABILITY_LIFESTEAL_PCT`, `ABILITY_SELF_COST_HP` | No — pure balance, never a shape | `game-rules` (host-forbidden) |
| `ABILITY_COOLDOWNS_MS` | No at runtime — only a design-time budget bound | `game-rules`; the budget invariant is enforced by the Task 4 contract test |

The refined rule the ADR states: *the host never imports `game-rules` logic; the shared ability spatial/presentation contract lives in `shared-types` and is host-importable.* This narrows, not abandons, the original boundary — its real intent was "the renderer must not execute or depend on authoritative simulation *logic*," which pure spatial data was never part of.

### Sequencing note

Land this **before** implementing 7.4/7.5/7.8 so they consume the contract from the start (Task 5 updates their specs so they will). 7.2 and 7.3 are already implemented and are retrofitted here (Task 3). If 7.4+ are somehow implemented first, they inherit `D-7.2-A`'s drift and would need the same retrofit — hence the ordering.

### Testing Standards

- `tests/contract/**` is the integration tier and may import both `game-rules` and host code — that is exactly why the budget invariant moves there (a host unit test cannot import `game-rules`).
- Determinism is the load-bearing sim check: the relocation must not change a single hit. Prefer an existing deterministic tick/replay test; if none asserts hit geometry directly, add one that fires each ability and checks the resolved hit set is identical to a recorded baseline.
- Known WSL2 e2e flake (simulation-server 60 s boot timeout; a heal assertion in `tests/e2e/ability-dispatch.test.ts`) is unrelated; do not chase it — but a *deterministic* sim-unit regression is real and blocks.

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — `D-7.2-A` (the drift this story resolves)
- [Source: `packages/game-rules/src/balance.ts:32,101-131,145-170,172,188`] — the constants being relocated / kept
- [Source: `packages/game-rules/package.json:14`, `packages/game-rules/src/balance.ts:1`] — the existing one-way `game-rules → shared-types` dependency
- [Source: `packages/shared-types/src/index.ts`] — barrel to extend; `constants.ts` for the `as const` style; `PURIFICATION_PULSE_DURATION_MS` precedent for host-imported timing
- [Source: `apps/host-client/src/vfx/ability-vfx.ts`] — Stonehide transcriptions to replace (Story 7.2)
- [Source: `apps/host-client/src/vfx/spiritcaller-vfx.ts`] — Spiritcaller transcriptions to replace (Story 7.3)
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts`, `packages/game-rules/src/systems/combat.ts`] — sim consumers that must keep resolving via re-export
- [Source: `docs/adr/ADR-0001-hybrid-authority.md`, `ADR-0002-body-spirit-position-split.md`] — ADR format to follow
- [Source: `CLAUDE.md`] — ownership rules, contract-change + simulation-safety hooks, merge gate
- [Source: `_bmad-output/project-context.md`] — the "host never imports game-rules" rule this story refines via ADR-0003

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (gds-dev-story workflow)

### Debug Log References

- `npm run typecheck` — all 10 tsconfigs clean.
- `npx vitest run --root apps/host-client` — 43 pass / 0 fail.
- `npx vitest run --root packages/game-rules` — 62 pass / 0 fail.
- `npx vitest run --root apps/simulation-server` — 81 pass / 0 fail (deterministic tick incl.).
- `npx vitest run --root tests contract/` — 115 pass / 0 fail (incl. new `ability-vfx-budget`, 5).

### Completion Notes List

- **Contract-change hook — TRIGGERED (compile-time constant relocation, behaviourally inert). `Protocol Architect review required`.** No wire message, schema field, session-lifecycle, reconnect, room-state, join-flow, or prediction/reconciliation surface changed. Compatibility checklist:
  - Every existing `import { … } from 'game-rules'` still resolves — `balance.ts` re-exports the moved names (and the `AbilityDeliveryType` type) from `shared-types`; `packages/game-rules/src/index.ts` is untouched, so the public surface is byte-for-byte identical.
  - `apps/simulation-server` compiled and ran with **zero** import churn (its 81 tests, incl. deterministic tick, pass).
  - New ADR written (ADR-0003, AC6) and a cross-package contract test added (`tests/contract/ability-vfx-budget.test.ts`, AC5) — both hook requirements met.
- **Simulation-safety hook — TRIGGERED.** Byte-identical relocation ⇒ identical hits/zones/determinism. Proven by game-rules (62) + simulation-server (81, deterministic) green, not assumed. No perf-relevant code path changed (compile-time re-export only).
- **Values relocated byte-identical:** `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY` (+`AbilityDeliveryType`), `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`, `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS`, `STORM_EYE_ZONE_RADIUS_PX`, and a new named `VOID_PULSE_ZONE_RADIUS_PX` (= the former inline `radius: 150` in `ABILITY_CHAINED_ZONE`). No ability balance (damage/cooldown/heal/status magnitude/displacement/lifesteal/self-cost) changed (AC8).
- **One deliberate non-import kept:** Tremor Stomp's VFX `hitRangePx` is a hard `0`, not `ABILITY_HIT_RANGE_PX.stonehide[1]` (=160). A TAP ability hits a circle on the caster and the sim ignores its `hitRange` entirely, so 160 is dead data — reading it would *mis-place* the effect. This is a delivery semantic, not a transcription; commented in-code.
- **Contract test scope:** the budget test covers abilities whose durations are exposed via `getAbilityVfxConfig` (Stonehide today; PixiJS-free). Spiritcaller's durations live inside an imperative composer that imports PixiJS, so they are not pulled into the node-env contract test; a guard test prevents a silently-empty pass, and coverage grows automatically as 7.4/7.5 ship config tables in the `getAbilityVfxConfig` shape.
- **Confidence: 92%** — relocation is mechanical and every touched suite is green including the deterministic sim gate; the ~8% is the WSL2-flaky e2e boot I did not run (explicitly out of scope; it exercises no code this story changed beyond the sim, which stays deterministic).

### File List

- `packages/shared-types/src/ability-geometry.ts` (NEW)
- `packages/shared-types/src/index.ts` (barrel export added)
- `packages/game-rules/src/balance.ts` (moved defs deleted → re-exported from `shared-types`; Void Pulse radius → `VOID_PULSE_ZONE_RADIUS_PX`)
- `apps/host-client/src/vfx/ability-vfx.ts` (imports contract; Stonehide geometry read live)
- `apps/host-client/src/vfx/ability-vfx.test.ts` (Avalanche placement reads contract; cooldown literal + budget test removed)
- `apps/host-client/src/vfx/spiritcaller-vfx.ts` (imports contract; geometry derived, cosmetics tied to contract)
- `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` (live-link assertion added)
- `tests/contract/ability-vfx-budget.test.ts` (NEW — cross-package budget invariant)
- `docs/adr/ADR-0003-ability-presentation-contract.md` (NEW)
- `_bmad-output/implementation-artifacts/deferred-work.md` (`D-7.2-A` marked resolved)
- `_bmad-output/implementation-artifacts/7-4-souldrinker-ability-vfx.md`, `7-5-stormcaller-ability-vfx.md`, `7-6-status-effect-vfx.md`, `7-8-environmental-and-bond-vfx-polish.md` (Dev Notes guidance re-pointed + Change Log)
- `_bmad-output/implementation-artifacts/7-9-shared-ability-geometry-contract.md` (this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status → in-progress → review)

## Change Log

| Date | Change |
|---|---|
| 2026-07-23 | Story drafted — move ability spatial/presentation geometry (`ABILITY_HIT_RANGE_PX`/`RADIUS_PX`/`DELIVERY`, nova + zone + projectile radii) from `game-rules/balance.ts` into `shared-types` as a host-importable contract, so VFX tracks balance dynamically (resolves `D-7.2-A`, user "Option B" decision). Sim reads via re-export (byte-identical, deterministic); host imports and deletes its transcriptions; budget invariant moves to a `tests/contract` test; ADR-0003 records the boundary; unimplemented siblings 7.4/7.5/7.6/7.8 re-pointed at the contract. |
| 2026-07-23 | Post-review correction (surfaced by manual testing): the code-review patch had hard-`0`'d Stone Wall's VFX `hitRangePx` alongside Iron Skin, but Stone Wall is `RELEASE` (directional in the sim, hit = `caster + aim × range`) — only Iron Skin/Tremor are `TAP` (range ignored). Stone Wall now reads `STONEHIDE_RANGE[0]` like Avalanche, so its VFX tracks a range re-tune. Rule in `ability-vfx.ts` rewritten to mirror the sim's `isDirectional = inputType !== 'TAP'`. Typecheck clean, host 43 green. |
| 2026-07-23 | Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor: 0 AC violations. Blind Hunter's "High" (files absent from diff) dismissed as a `git diff` untracked-file artifact. 4 patch findings applied: tautological live-link test strengthened to assert planner placement; self-centred Stonehide slots 0/2 made consistent (hard-0, only directional slot 3 reads the range); `spiritcaller-vfx.ts` header over-claim corrected; budget contract test extended (Spirit Nova sweep + hardened empty-assertion guard, now 6 green). 6 findings dismissed. Re-validated: typecheck clean, host 43, contract budget 6. Status → done. |
| 2026-07-23 | Implemented. Created `shared-types/ability-geometry.ts` (byte-identical relocation, Void Pulse radius → named `VOID_PULSE_ZONE_RADIUS_PX`); `balance.ts` re-exports it (zero sim churn — GameRoom/combat untouched). Host `ability-vfx.ts`/`spiritcaller-vfx.ts` import the contract; Stonehide/Spiritcaller geometry read live; cosmetic overshoots tied to contract values; Tremor Stomp keeps a hard-0 `hitRangePx` (TAP ignores range — commented). Tests read the contract (Avalanche + Ancestor's Voice live-link, AC4); cooldown-budget invariant moved to `tests/contract/ability-vfx-budget.test.ts` against live `ABILITY_COOLDOWNS_MS`. ADR-0003 written; `D-7.2-A` resolved. Validation green: typecheck 10/10, host 43, game-rules 62, sim 81 (deterministic), contract 115. Status → review. Contract-change + Simulation-safety hooks TRIGGERED — Protocol Architect review required. |

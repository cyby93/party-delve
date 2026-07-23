---
baseline_commit: 6113cbda39af55999ae9194c16e9457b3a5cd54f
---

# Story 7.9: Shared Ability-Geometry Contract — VFX Tracks Balance Dynamically

Status: ready-for-dev

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

- [ ] **Task 1 — Define the shared ability-geometry contract (AC: 1)**
  - [ ] 1.1: Create `packages/shared-types/src/ability-geometry.ts`. Move the definitions of `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY` (and its `AbilityDeliveryType` union), `STORM_EYE_ZONE_RADIUS_PX`, `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS`, `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`, and the Void Pulse chained-zone **radius** (extract the radius field out of `ABILITY_CHAINED_ZONE` into a named constant, or move the whole table if it carries no game-logic-only fields — decide in the ADR) from `balance.ts` into this module, **values byte-identical**. Keep the `Record<PlayerClass, readonly [...]>` typing; `PlayerClass` is already in `shared-types`.
  - [ ] 1.2: Re-export the new module from `packages/shared-types/src/index.ts` (`export * from './ability-geometry.js';`).
  - [ ] 1.3: **Decision to record in the ADR (Task 6), not code:** cooldowns/damage/heal/status-magnitude/displacement/lifesteal/self-cost **stay in `balance.ts`** — they are pure balance the host never renders as geometry. The contract is the *spatial + delivery + spatial-sweep-timing* subset only.

- [ ] **Task 2 — Rewire `game-rules` to re-export, sim behaviour unchanged (AC: 2)**
  - [ ] 2.1: In `balance.ts`, delete the moved definitions and re-export them from `shared-types` so existing `from 'game-rules'` imports keep resolving: `export { ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, ABILITY_DELIVERY, ... } from 'shared-types';` (and re-export the `AbilityDeliveryType` type). Confirm `packages/game-rules/src/index.ts`'s public surface is unchanged.
  - [ ] 2.2: `apps/simulation-server/src/rooms/GameRoom.ts` and `packages/game-rules/src/systems/combat.ts` should compile **untouched** (they import from `game-rules`, which still re-exports). If any sim file imported a moved constant by a path that no longer resolves, update that import to `shared-types` and note it — but prefer the re-export so sim churn is zero.
  - [ ] 2.3: Run the deterministic tick test + any hit-detection/replay tests and confirm byte-identical results (AC2, AC8). This is the simulation-safety gate.

- [ ] **Task 3 — Host VFX imports the contract; delete transcriptions (AC: 3, 4)**
  - [ ] 3.1: `ability-vfx.ts`: replace the transcribed `hitRangePx` literals in the Stonehide config table with values read from the imported `ABILITY_HIT_RANGE_PX.stonehide[i]` (and hit radii where the ring sizes currently hardcode them). Keep colors, stroke widths, alphas, and cosmetic durations local. Update the file header comment: the geometry is now imported, not transcribed.
  - [ ] 3.2: `spiritcaller-vfx.ts`: replace `ANCESTORS_VOICE_RANGE_PX`, `SPIRIT_NOVA_MAX_RADIUS_VFX_PX`, `SPIRIT_NOVA_DURATION_VFX_MS`, `SOUL_MEND_RANGE_PX`, `WARDING_CRY_RADIUS_PX` with values derived from the shared contract (`ABILITY_HIT_RANGE_PX.spiritcaller[i]`, `ABILITY_HIT_RADIUS_PX.spiritcaller[i]`, `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS`). Where a VFX value must intentionally differ from the sim value, keep it local **with a comment stating why** (e.g. a purely cosmetic overshoot); default is to use the contract.
  - [ ] 3.3: Grep the host for any remaining numeric copy of a moved value (`grep -n "180\|200\|220\|150" apps/host-client/src/vfx/*.ts` and review each hit) — any that is a sim-geometry duplicate must become an import.
  - [ ] 3.4: Update `ability-vfx.test.ts` / `spiritcaller-vfx.test.ts` so the placement assertions read the contract constant rather than a literal (proving the live link — AC4), e.g. assert Avalanche's hit centre equals `caster + normDir × ABILITY_HIT_RANGE_PX.stonehide[3]`.

- [ ] **Task 4 — Cross-package contract test for the budget invariant (AC: 5)**
  - [ ] 4.1: Add `tests/contract/ability-vfx-budget.test.ts` (or extend an existing contract test) that imports `ABILITY_COOLDOWNS_MS` from `game-rules` **and** the host's per-ability effect durations, and asserts every effect's longest `durationMs` is strictly less than that ability's cooldown (the 7.2 AC5 invariant), for all four classes.
  - [ ] 4.2: Remove the now-redundant hardcoded `STONEHIDE_COOLDOWNS_MS` literal from `ability-vfx.test.ts` (the contract test owns that invariant now). Leave the pure planner/placement unit tests in place.
  - [ ] 4.3: Confirm `tests/contract/**` is permitted to import both packages (it is the integration-test tier; verify against `tests/tsconfig.json` / `tests/vitest.config.ts`).

- [ ] **Task 5 — Update the unimplemented sibling story specs (AC: 7)**
  - [ ] 5.1: In `7-4`, `7-5`, `7-6`, `7-8` (all `ready-for-dev`, unimplemented), change the Dev Notes "transcribe from `balance.ts` / never import `game-rules`" guidance to "import the spatial geometry from `shared-types` (the ability presentation contract, Story 7.9); never import `game-rules` *logic*." Do **not** touch their Tasks/Subtasks status or ACs beyond this guidance note. Add a one-line Change Log entry to each.
  - [ ] 5.2: Do **not** modify any `done` story or 7.7a/7.7b's protocol scope.

- [ ] **Task 6 — ADR + deferred-work bookkeeping (AC: 6)**
  - [ ] 6.1: Write `docs/adr/ADR-0003-ability-presentation-contract.md` following the ADR-0001/0002 format: Context (the transcription-drift problem, `D-7.2-A`), Decision (the spatial/delivery/sweep subset lives in `shared-types`; the refined host-import rule), Consequences (VFX tracks balance; the host/game-rules boundary is now "no logic import" rather than "no import"; pure balance stays host-forbidden), and Alternatives considered (a contract test alone — rejected as it only *detects* drift; a new `game-config` package — rejected as `shared-types` is the existing importable home).
  - [ ] 6.2: In `deferred-work.md`, mark `D-7.2-A` **resolved by Story 7.9** (do not delete the entry; annotate it).

- [ ] **Task 7 — Full validation (AC: 8)**
  - [ ] 7.1: `npm run typecheck` at the repo root (all 10 tsconfigs).
  - [ ] 7.2: `npm test` at the repo root — full suite green (note the known WSL2 e2e flake if seen; it touches no code this story changes except the sim, which must stay deterministic — so if a *deterministic* sim test regresses, that is real and blocks).
  - [ ] 7.3: `npx vitest run` in `apps/host-client` — the VFX unit tests green.
  - [ ] 7.4: Confirm no host file numerically duplicates a moved constant (final grep).

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-23 | Story drafted — move ability spatial/presentation geometry (`ABILITY_HIT_RANGE_PX`/`RADIUS_PX`/`DELIVERY`, nova + zone + projectile radii) from `game-rules/balance.ts` into `shared-types` as a host-importable contract, so VFX tracks balance dynamically (resolves `D-7.2-A`, user "Option B" decision). Sim reads via re-export (byte-identical, deterministic); host imports and deletes its transcriptions; budget invariant moves to a `tests/contract` test; ADR-0003 records the boundary; unimplemented siblings 7.4/7.5/7.6/7.8 re-pointed at the contract. |

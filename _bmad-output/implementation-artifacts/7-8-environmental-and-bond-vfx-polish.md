---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.8: Environmental & Bond VFX Polish

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want projectiles and zones to actually show the per-ability visuals built in 7.2–7.5, and want the existing purification pulse and bond tethers to feel consistent with the new visual language,
so that the ability-specific work isn't silently overridden by a shared fallback shape.

## Acceptance Criteria

> **⚠️ Epic correction (read before AC2).** `epics.md:2054` says zone rendering should be driven by "each `ProjectileState`/`ZoneState` entity's existing `class`/`abilityIndex` fields (added in Story 3.13)". That is true for `ProjectileState` and **false for `ZoneState`**. Verified at `packages/shared-types/src/zone.ts:1-12`: `ZoneState` is `{ id, ownerId, x, y, radius, effectType, tickIntervalMs, expiresAtMs }` — there is **no `class` and no `abilityIndex`**. Adding them would edit `packages/shared-types/**`, which fires the **Contract-change hook** and violates the epic's own non-goal "no protocol/schema changes" (`epics.md:2060`). AC2 below is therefore reworded to derive zone identity from data that already exists: `ownerId → gameState.players.find(...).class`, combined with `effectType`. This satisfies the epic's actual intent ("no new state fields or delta events are introduced — this consumes data that already exists", `epics.md:2055`) without touching a contract.

1. **Per-ability projectile rendering (replaces the shared white dot).**
   **Given** `DungeonScreen.tsx:299-309` draws every projectile as the same hardcoded `g.circle(0, 0, 8).fill({ color: 0xffffff })`,
   **when** this story ships,
   **then** each projectile's body is drawn from a visual config selected by that projectile's own `class` + `abilityIndex` fields (`packages/shared-types/src/projectile.ts:3-10`),
   **and** the selection is performed by a pure, exported, unit-testable function — not an inline `if` chain in `renderFrame`,
   **and** any `(class, abilityIndex)` pair with no entry (a future projectile ability, or a corrupt/unknown value) resolves to a safe default that renders visibly and never throws.

2. **Per-ability zone rendering (replaces the shared purple disc) — identity derived, not schema'd.**
   **Given** `DungeonScreen.tsx:320-330` draws every zone as the same hardcoded `g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })`, and **given** `ZoneState` carries **no** `class`/`abilityIndex` (see the epic correction above),
   **when** this story ships,
   **then** each zone's visual is selected from `(ownerClass, effectType)` where `ownerClass = state.players.find(p => p.id === zone.ownerId)?.class` and `effectType` is the existing `ZoneEffectType` field,
   **and** when the owner cannot be found (owner disconnected, left, or was removed while the zone is still alive) the lookup falls back to an `effectType`-only visual and then to a global default — it must not throw, must not render nothing, and must not log per frame,
   **and** **no** field is added to `ZoneState`, `ProjectileState`, or any delta payload.

3. **Shared config module + cross-story seam.**
   **Given** Stories 7.4 (Souldrinker) and 7.5 (Stormcaller) own the *appearance* of Blood Spike, Void Pulse and Storm Eye, while this story owns the *plumbing* that renders projectiles and zones,
   **when** this story ships,
   **then** the `(class, abilityIndex) → projectile visual` and `(class, effectType) → zone visual` tables live in one shared module, `apps/host-client/src/vfx/ability-visuals.ts`, exported from `apps/host-client/src/vfx/index.ts`,
   **and** that module is the single place 7.4/7.5 write their per-ability values into and this story reads from,
   **and** if 7.4/7.5 have **not** shipped yet, the table's seeded values (specified in Dev Notes) are used; if they **have** shipped and already own an entry, their entry is kept, not overwritten.

4. **Motion trail per live projectile, bounded.**
   **Given** `createTrail` from the Story 7.1 primitive library (`apps/host-client/src/vfx/primitives.ts:113-184`),
   **when** a projectile appears in `GameState.projectiles`,
   **then** exactly **one** persistent `TrailHandle` is created for it, registered with the `VfxEngine`, and fed with `moveTo(x, y, now)` **once per frame using the same `now` the engine is updated with** (`Date.now()`),
   **and** `handle.disposed` is checked before every `moveTo`,
   **and** when the projectile disappears from state the trail is released so it fades out and self-reaps within its `durationMs` — **never** a new effect allocated per frame, and no trail left pushing into a destroyed `Graphics`.

5. **Impact feedback on `projectile:hit`.**
   **Given** the `projectile:hit` delta already exists with `{ projectileId, x, y }` but is **not** in the host's transient-delta whitelist (`apps/host-client/src/session/host-session.ts:44-63`),
   **when** this story ships,
   **then** `projectile:hit` is added to that whitelist and drives a short, per-ability impact effect at `(x, y)` composed from the 7.1 primitives,
   **and** the impact effect degrades to the default visual when the projectile's entry is already gone,
   **and** the story explicitly accepts that impacts are **best-effort** because `latestTransientDelta` is a single React state value, not a queue (see Dev Notes → "The `latestTransientDelta` batching limitation") — no AC depends on seeing every hit of a burst.

6. **Consistency pass — purification pulse, reward particles, bond tethers (no mechanic or timing change).**
   **Given** the purification pulse (Story 6.4, `DungeonScreen.tsx:462-479` + `602-622`), the reward-reveal particle burst (`481-498` + `704-728`), and the bond particle tethers (Story 5.5, `DungeonScreen.tsx:234-256`),
   **when** this story ships,
   **then** the purification pulse is rendered by `createRingShockwave` and the reward burst by `createParticleBurst` — a like-for-like port onto the primitives those two blocks were literally generalized *from* (`primitives.ts:17`, `primitives.ts:187`),
   **and** the pulse still radiates from the boss's last known position per UX-DR16 and still runs for exactly `PURIFICATION_PULSE_DURATION_MS` (2500, `packages/shared-types/src/constants.ts:15`), with the reward-reveal handoff (`rewardRevealActiveRef` / `setRewardRevealVisible(true)` / `setVoiceVisible(true)`) still firing exactly once at pulse completion,
   **and** both blocks stop using `performance.now()` and run on `Date.now()` — the same clock as `renderFrame` (`DungeonScreen.tsx:99`) and `VfxEngine.update()`,
   **and** bond tethers keep their existing semantics (one per active bond, colored from `bond.color`, drawn below all sprites via `addChildAt(g, 0)`, updated every frame, persisting for the whole run per FR16) while receiving a readability/consistency restyle,
   **and** no timing constant, no duration, and no game-state behavior changes anywhere in this story.

7. **No regressions.**
   **Given** the behaviors listed in Dev Notes → "Must-not-regress inventory",
   **when** this story ships,
   **then** all of them still work: ability cast flash, spirit-form glow, the `isDown`/`isSpirit` body sprite at `bodyX/bodyY`, the frozen-player `0.3` alpha disconnect cue, enemy kill fade, damage numbers, status badges, essence flashes, boss sprite/phase visuals, the background swap to `0x90d8f0` on defeat, and the revive-timer overlay.

## Tasks / Subtasks

> **Dev deviation note (read before the checkboxes below).** By this story's baseline, 7.4/7.5/7.7b had already built the real "7.8 seam" as `apps/host-client/src/vfx/ability-vfx-config.ts` — not the `ability-visuals.ts` path this story's text assumed (matches this project's established pattern of story specs naming files later superseded by real architecture, e.g. 7.6/7.7b). `VfxEngine` wiring (Task 1) and the `projectile:hit` whitelist (Task 5.1) were also already shipped. Every checkbox below reflects what was verified against current source and actually implemented, with the real file/symbol names noted where they differ from the story text.

- [x] **Task 1 — One-time `VfxEngine` wiring in `DungeonScreen.tsx` (guarded: "if not already present")** (AC: 4, 5, 6)
  - [x] 1.1: Verified already landed (7.2/7.3) — `DungeonScreen.tsx` already imports from `../vfx` and holds `vfxEngineRef`. Not duplicated; skipped straight to Task 2 per this subtask's own instruction.
  - [x] 1.2: N/A — already imported by prior stories; this story added `createTrail` and `resolveProjectileAppearance` to the existing import list instead.
  - [x] 1.3: Already present.
  - [x] 1.4: Already present (constructed in `initPixi` before `app.ticker.add`).
  - [x] 1.5: Already present; this story additionally hoisted `const now = Date.now()` to the very top of the ticker callback (previously computed inline at the `update()` call site) so every per-frame `now` in the callback — including the new purification-pulse deadline check (Task 6.3) — reads the same timestamp.
  - [x] 1.6: Already present (`vfxEngineRef.current?.clear()` before `app.destroy`).

- [x] **Task 2 — New shared module** (AC: 1, 2, 3) — real module: `apps/host-client/src/vfx/ability-vfx-config.ts` (existing, extended — not a new `ability-visuals.ts`).
  - [x] 2.1: `ProjectileAppearance`/`ZoneVisual` interfaces already existed (7.4/7.5); extended `ProjectileAppearance.halo` to optional and added `ZoneVisual.spawnRing` (7.8's own addition).
  - [x] 2.2: Added `DEFAULT_PROJECTILE_APPEARANCE` (byte-identical to today's white circle: `bodyRadius 8`, `0xffffff`, `alpha 1`, flat trail). `DEFAULT_ZONE_VISUAL` already existed (7.5) — extended with a `spawnRing`.
  - [x] 2.3: Souldrinker Blood Spike (idx 0)/Void Pulse (idx 3) entries already existed in `PROJECTILE_APPEARANCE` (7.4) — left untouched, only consumed via the new `resolveProjectileAppearance`.
  - [x] 2.4: `ZONE_APPEARANCE.pull` already existed (7.4, unconsumed until now); added `VOID_PULSE_ZONE_VISUAL` (built from those values) and `EFFECT_TYPE_ZONE_VISUAL` (owner-unknown fallback tier, `pull`+`damage`) plus a `ZONE_VISUALS` exact-identity map (`${class}:${effectType}`) — this is the real AC2 fix: the pre-existing `isStormEyeZone`-gated `resolveZoneVisual` fell straight to the global default on owner-not-found, skipping the effectType tier entirely.
  - [x] 2.5: Added `resolveProjectileAppearance(cls, abilityIndex)`; rewrote `resolveZoneVisual(zone, players)` as the three-tier ladder. Both total, no throw, no log, no clock, no `pixi.js` import — verified by the new test suite.
  - [x] 2.6: Re-exported `resolveProjectileAppearance`, `DEFAULT_PROJECTILE_APPEARANCE`, `VOID_PULSE_ZONE_VISUAL` from `apps/host-client/src/vfx/index.ts` (appended, existing order preserved).
  - [x] 2.7: N/A under the real file (`ability-vfx-config.ts` already carries its own file-header cross-story-ownership comment from 7.4); added inline doc comments instead attributing the new pieces to 7.8.

- [x] **Task 3 — Per-ability projectile rendering + trail in `renderFrame`** (AC: 1, 4)
  - [x] 3.1: `projectileGraphics` changed `Map<string, Graphics>` → `Map<string, ProjectileEntry>` (`{ g: Graphics; trail: TrailHandle | null }` — no `visual` field; appearance is recomputed per frame from `projectile.class`/`abilityIndex`, both already on `ProjectileState`, instead of cached, since it's a cheap object-literal lookup).
  - [x] 3.2: `renderFrame` already had a `vfxRefs: VfxContext` object param (from 7.3) carrying `engine: VfxEngine | null` plus other Epic 7 fields — reused it rather than adding a second `vfx` param, matching this story's own "future stories add fields to this object" intent.
  - [x] 3.3: On first-seen: resolves `resolveProjectileAppearance`, creates `Graphics`, creates the `TrailHandle` via `createTrail`, `vfx.engine?.add(trail)`, stores `{ g, trail }`.
  - [x] 3.4: Every frame: position + clear + draw core, optional halo, then `moveTo` the trail if live, all off `renderFrame`'s existing `now`. No re-creation, no per-frame allocation.
  - [x] 3.5: Cleanup-on-missing destroys the body `Graphics` and deletes the map entry; the trail is never `engine.remove()`d — it is simply no longer fed, so it fades and self-reaps (comment in code explains this is deliberate).
  - [x] 3.6: No owner lookup added for projectiles — `projectile.class`/`abilityIndex` read directly.

- [x] **Task 4 — Per-ability zone rendering in `renderFrame`** (AC: 2)
  - [x] 4.1: `ownerClass` resolved once per zone per frame inside `resolveZoneVisual` itself (moved the `find` into the shared lookup rather than duplicating it at the call site) — `undefined` is the expected path, no `!`, no throw, no `console.warn`.
  - [x] 4.2: `resolveZoneVisual(zone, state.players)` (already the established call shape from 7.5; unchanged at the call site).
  - [x] 4.3: Two-pass draw (fill + optional rim) already existed (7.5) — unchanged; now receives Void Pulse's own visual too, not just Storm Eye's. `addChildAt(g, 0)` preserved.
  - [x] 4.4: Added a one-shot `createRingShockwave` on first-seen zone only, scaled via `zone.radius * spawnRing.{start,max}RadiusFactor`, sourced from the resolved `ZoneVisual.spawnRing` (implode for `pull`, expand for `damage`/default).
  - [x] 4.5: Zone bodies remain a per-frame `Graphics.clear()` + redraw — unchanged, rationale recorded in Dev Notes (already present in this file, "Deliberate deviation from 7.1 AC3").

- [x] **Task 5 — `projectile:hit` impact effect** (AC: 5)
  - [x] 5.1: Already whitelisted in `host-session.ts` by Story 7.4 (comment there already explains the "delivery filtering, not a contract change" rationale) — verified present, not re-added. `projectile:expired` confirmed still absent, matching the story's own instruction.
  - [x] 5.2-5.4: Story 7.4 already implemented this AC's actual intent with **richer, ability-specific** impact effects (`planBloodSpikeImpact`/`planBloodSpikeSplash`/`planVoidPulseImpact` in `souldrinker-vfx.ts`, gated on `projectileMetaRef` cache + owner liveness) rather than a single generic `DEFAULT_PROJECTILE_APPEARANCE`-shaped `impact` field. Since Souldrinker's two projectile abilities are the only ones that exist today (`ABILITY_DELIVERY`, `shared-types`), this fully satisfies AC5 without new code; adding a speculative generic `impact` field to `ProjectileAppearance` for zero current callers would be premature abstraction. No changes made here.

- [x] **Task 6 — Purification pulse → `createRingShockwave` (clock unification)** (AC: 6, 7)
  - [x] 6.1: `bossDefeatedRef`/`isPurifiedRef`/`setIsPurified(true)`/`essenceDisplayRef`/background swap all unchanged.
  - [x] 6.2: Replaced the hand-rolled `Graphics` + `PurificationPulse` ref with `vfxEngineRef.current?.add(createRingShockwave({...}))`, `startedAt: Date.now()` stamped explicitly (BACKGROUNDED-TICKER rule — this fires from the delta `useEffect`, not the ticker). Added `PURIFICATION_PULSE_MAX_RADIUS_PX = 1400` to the constants block.
  - [x] 6.3: Added `purificationPulseEndsAtRef`; set to `triggeredAt + PURIFICATION_PULSE_DURATION_MS` where the pulse is added; ticker checks `now >= deadline`, nulls first, then fires the reward-reveal handoff — exactly once, off the ticker's own `now`.
  - [x] 6.4: Deleted `PurificationPulse` interface, `purificationPulseRef`, the old ticker animation block, and its cleanup line; replaced with `purificationPulseEndsAtRef.current = null` in cleanup.
  - [x] 6.5: `PURIFICATION_PULSE_DURATION_MS`/`REWARD_REVEAL_DURATION_MS` untouched in `shared-types`.

- [x] **Task 7 — Reward-reveal particles → `createParticleBurst` (clock unification)** (AC: 6, 7)
  - [x] 7.1: Replaced the manual spawn loop with one `createParticleBurst` call; kept `count = 8 + Math.floor(Math.random() * 5)` and the `[0x6ea8d8, 0xf0c070]` palette (passed as the primitive's cycling `color` array) exactly, plus `spread: 0.5`/`speed: 0.175`/`particleRadius: 8` per the like-for-like mapping table.
  - [x] 7.2: Deleted `PurificationParticle` interface, `purificationParticlesRef`, the ticker loop, the local `PARTICLE_DURATION_MS`, and its cleanup line. Added `REWARD_PARTICLE_DURATION_MS = 1000` to the constants block.
  - [x] 7.3: Voice-line `setTimeout`/cleanup left exactly as-is.
  - [x] 7.4: Confirmed the burst still originates at `VIRTUAL_W / 2, VIRTUAL_H / 2`.

- [x] **Task 8 — Bond tether consistency pass** (AC: 6, 7)
  - [x] 8.1: Extracted `parseCssHexColor(css, fallback)` (module-scope), guards `NaN`, fallback `0x6ea8d8`.
  - [x] 8.2: Two-pass stroke (glow underlay `alpha 0.16` + core `coreAlpha`) with `BOND_TETHER_GLOW_WIDTH = 8`/`BOND_TETHER_CORE_WIDTH = 3`.
  - [x] 8.3: Breathing `coreAlpha` via `Math.sin`, `BOND_TETHER_BREATH_PERIOD_MS = 1800`, range 0.48-0.76, off `renderFrame`'s existing `now`.
  - [x] 8.4: Everything else (one tether per bond, keying, create/cleanup, `addChildAt(g, 0)`, persistence) left unchanged; no conversion to a time-limited primitive.

- [x] **Task 9 — Unit test for the pure mapping functions** (AC: 1, 2, 3) — real file: `apps/host-client/src/vfx/ability-vfx-config.test.ts` (extending the existing module rather than a new `ability-visuals.ts`).
  - [x] 9.1: New file, no `pixi.js` import — runs in ~6ms.
  - [x] 9.2: All cases covered (a)-(f), including the owner-present-but-wrong-class case AC2 explicitly calls out. Also required fixing two now-stale assertions in the pre-existing `stormcaller-vfx.test.ts` (`resolveZoneVisual` suite, 7.5) that had encoded the *old*, AC2-incorrect fallback behavior ("owner not found → global default") as "byte-identical to today" — that comment explicitly anticipated 7.8 adding real cases here (Dev Notes "the regression guard for AC5/AC7 ... until Story 7.8 adds its own cases").
  - [x] 9.3: Matches `vfx.test.ts`'s shape; one table-driven loop for (f), not a test per row.

- [x] **Task 10 — Self-check** (AC: 1-7)
  - [x] 10.1: `npm run typecheck` at repo root — clean, 10/10 tsconfigs.
  - [x] 10.2: `npx vitest run src/vfx/ability-vfx-config.test.ts` (9 tests) and `src/vfx/vfx.test.ts` (24 tests) — both green; also re-ran `stormcaller-vfx.test.ts` (14 tests, 2 updated) after the AC2 fix. Full repo suite: 571 passed / 3 skipped / 3 failed — all 3 pre-existing and unrelated (confirmed against Dev Notes' own "Known-flaky" callout + project memory): `ability-vfx.test.ts` Stone Wall centering (documented pre-existing failure, unrelated file), and `ability-dispatch.test.ts`/`hub-ability-use.test.ts` (simulation-server port-binding timeout under WSL2, host-only story never touches simulation-server).
  - [x] 10.3: Both greps return zero hits (had to reword two pre-existing/new comments that mentioned "performance.now" as prose, since the check is literal).
  - [ ] 10.4: **Not performed** — no display in this sandbox. Matches this project's established precedent (7.5, 7.6, 7.7b, 3.23, dev-3); needs a human pass before this story can be marked done.
  - [x] 10.5: `git status --short` confirms every touched file is under `apps/host-client/**` (Host Experience Engineer's single ownership area) plus the sprint-status workflow file — no Allowed-paths violation, despite two file names (`ability-vfx-config.ts` vs `ability-visuals.ts`, and the pre-existing `stormcaller-vfx.test.ts` fix) differing from the story's literal list for the reasons noted above.

### Review Findings

Code review (2026-07-27): 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), `review_mode: full` against this story's own AC section. Blind Hunter's first run and both other layers' first runs were lost to a subagent-session API limit; each was retried once and completed successfully on retry (noted per-finding below where relevant). 0 `decision_needed`, 6 `patch` (all applied and verified — typecheck clean, 56/56 relevant vitest tests green), 1 `defer`, 12 dismissed as noise/false-positive/by-design after verification against real source.

**Patches applied:**
- [x] [Review][Patch] `ProjectileAppearance.trail` silently dropped an `alpha` field, so every projectile trail rendered at `createTrail`'s hardcoded default alpha instead of the per-ability value the spec table calls for [`ability-vfx-config.ts`] — fixed: added `trail.alpha`, threaded through both Souldrinker entries (0.85, 0.7), `DEFAULT_PROJECTILE_APPEARANCE` (0.6), and the `createTrail(...)` call site in `DungeonScreen.tsx`. (source: blind)
- [x] [Review][Patch] Duplicate/dead assertion in the new "table sanity" zone test — two identical `resolveZoneVisual({ effectType: 'damage', ownerId: 'nobody' })` calls, leaving the `DEFAULT_ZONE_VISUAL` unknown-effectType fallback tier completely untested despite being named in the surrounding doc comment [`ability-vfx-config.test.ts`] — fixed: the duplicate now exercises the fallback tier via a deliberate cast (`ZoneEffectType` is exactly `'pull'|'damage'`, so this tier is otherwise unreachable through the typed API). (source: blind)
- [x] [Review][Patch] Inconsistent null-guard style within the same diff — `if (trail) vfxRefs.engine!.add(trail)` (truthiness check + non-null assertion) next to `vfxEngineRef.current?.add(...)` (optional chaining) elsewhere in the same file for the identical "engine might be null" guard [`DungeonScreen.tsx`] — fixed: restructured to capture `const engine = vfxRefs.engine` and narrow with a plain `if (engine)`, no assertion. (source: blind)
- [x] [Review][Patch] A duplicate `boss:defeated` transient delta would re-enter the whole branch, adding a second overlapping purification-pulse ring and pushing `purificationPulseEndsAtRef` to a later deadline instead of being ignored [`DungeonScreen.tsx`, `boss:defeated` handler] — pre-existing gap (the pre-7.8 code had the same missing guard), hardened while already touching this branch: added `&& !bossDefeatedRef.current` to the condition. (source: edge, retry run)
- [x] [Review][Patch] The new "table sanity" test loop never validated `ProjectileAppearance.trail.alpha` bounds despite the loop's own stated purpose ("the guard against a sibling story pasting ... an out-of-range alpha into the table") [`ability-vfx-config.test.ts`] — fixed: added `trail.alpha` 0..1 bounds check. (source: edge, retry run)
- [x] [Review][Patch] The new "table sanity" test loop never exercised `ZoneVisual.spawnRing` at all — this story's own new field shipped with zero regression coverage [`ability-vfx-config.test.ts`] — fixed: added a `spawnRing` block validating finite color, 0..1 alpha, positive `lineWidth`/`durationMs`. (source: edge, retry run)

**Deferred:**
- [x] [Review][Defer] Task 10.4's manual Client-UX pass is still outstanding [`DungeonScreen.tsx`, whole file — visual/couch-readability verification] — deferred, pre-existing (already disclosed in this story's own Completion Notes and Task 10.4 checkbox; no display in this sandbox, needs a human with a screen). (source: auditor)

**Dismissed as noise (12), after verification against real source:**
- "`P` is undefined in `VOID_PULSE_ZONE_VISUAL`" — false positive from zero-context blind review; `const P = SOULDRINKER_PALETTE` is pre-existing at `ability-vfx-config.ts:78`, outside this diff's changed lines. Verified by direct read.
- "`TrailHandle` type used but never imported in `DungeonScreen.tsx`" — false positive; `type TrailHandle` was already imported (Story 7.6, for status auras) at line 57, outside this diff's changed import lines. Verified by direct read.
- "Clock unification only partial — `renderFrame` and the ticker each call `Date.now()` separately" — by design, matches this story's own Dev Notes instruction verbatim ("renderFrame already recomputes its own — leave that alone, they agree"); both calls are synchronous within the same tick.
- "AC5 checked off complete with zero code/tests in this diff, unverifiable from the diff alone" — independently re-verified by the Acceptance Auditor (with full repo access) via `ABILITY_DELIVERY` in `shared-types` and by reading `souldrinker-vfx.ts`'s real, non-stub impact planners; correctly scoped, not an omission.
- "Owner-unknown zone-visual fallback tier's `spawnRing` is byte-identical to the exact-identity tier, only `rimAlpha` differs" — a design choice (the one-shot spawn animation doesn't need to be dimmed the same way a persistent rim does), not a functional defect.
- "`parseCssHexColor` only guards the full-`NaN` case, not a malformed short hex like `'#f'`" — matches the story's literal instruction; independently confirmed by the Edge Case Hunter that `BondState.color` is only ever populated server-side from a fixed, well-formed palette table, so the malformed-input path is unreachable in practice.
- "`EFFECT_TYPE_ZONE_VISUAL: Record<ZoneEffectType, ZoneVisual>` assumes exactly 2 effect types and could silently fall through" — factually incorrect concern (a TS `Record<K,V>` enforces all keys of `K` at compile time; a runtime value outside the union correctly falls through to `DEFAULT_ZONE_VISUAL`, confirmed by the Edge Case Hunter and by this story's own test coverage of that exact path).
- "Zone-visual resolution runs every frame per zone, including a `players.find()` linear scan" — pre-existing pattern (the prior `isStormEyeZone` gate already did the identical scan every frame); immaterial at the documented effect-volume bounds (≤8 players, zones "rare" per Dev Notes → "Effect volume (D-7.1-D)").
- "Self-reported confidence/QA claims sit awkwardly next to two likely compile defects" — moot; both underlying "compile defects" were false positives (see above).
- "Test fixture `zone()`/`player()` helpers use `as ZoneState`/`as PlayerState` casts, bypassing structural typechecking" — matches the established convention already used by the sibling `stormcaller-vfx.test.ts` fixtures (7.5).
- "Heavy duplication of the same narrative across 4 artifacts (story file, Change Log, sprint-status.yaml, task annotations)" — documentation style; matches this project's own long-established sprint-status.yaml convention (see its history).
- "Reward-burst particle speed distribution narrowed slightly vs. the original hand-rolled jitter (`createParticleBurst`'s internal `speed·(0.7+rand·0.6)` formula vs. the original inline `0.1+rand·0.15`)" — cosmetic only (duration/count/palette/origin all preserved exactly); the Acceptance Auditor's own conclusion was this is not a real AC6 violation, and the exact parameter (`speed: 0.175`) matches the story's own documented like-for-like mapping table.

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

**Phase:** Epic 7 — Ability & Environmental VFX Prototyping (Story 7.8, the consumer story). Post Phase-4 vertical slice, prototype-quality visuals only.

**Context:** Story 7.1 shipped `apps/host-client/src/vfx/` — a `VfxEngine` plus five parameterized primitives — and deliberately wired **none** of it into `DungeonScreen.tsx` (7.1 AC3). Stories 7.2–7.8 all depend on 7.1 and on nothing else. Today every projectile is one white dot and every zone one purple disc, so per-ability work done in 7.2–7.5 has no rendering path to reach the screen for projectile/zone abilities. Separately, three existing environmental effects (purification pulse, reward burst, bond tethers) predate the primitive library and run on a different clock.

**Goal:** Make projectile and zone rendering data-driven per ability via a shared config module, give projectiles a motion trail and impact effect, and port the three existing environmental effects onto the 7.1 primitives + the `Date.now()` clock — with zero mechanic, timing, schema or protocol change.

**Allowed paths:**
- `apps/host-client/src/vfx/ability-visuals.ts` (new)
- `apps/host-client/src/vfx/ability-visuals.test.ts` (new)
- `apps/host-client/src/vfx/index.ts` (modify — barrel export append only)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modify)
- `apps/host-client/src/session/host-session.ts` (modify — **one** whitelist line, `projectile:hit`)
- `_bmad-output/implementation-artifacts/7-8-environmental-and-bond-vfx-polish.md` (this file — task checkboxes + Dev Agent Record)

**Blocked paths:**
- `packages/shared-types/**` — including `zone.ts`, `projectile.ts` and `constants.ts`. **No new schema fields.** This is the epic's own non-goal and the Contract-change hook trigger.
- `packages/net-protocol/**` — no new/changed delta types. Whitelisting an existing delta in the host is *delivery filtering*, not a contract change.
- `packages/game-rules/**` and `apps/simulation-server/**` — never imported by the host; the balance numbers in this story are for choosing visual parameters at authoring time only.
- `apps/mobile-controller/**`, `apps/backend-platform/**`, `packages/ui-kit/**`, `packages/telemetry/**`, `tests/**`, `tools/**`.
- `apps/host-client/src/vfx/primitives.ts`, `engine.ts`, `types.ts` — the 7.1 library is complete for this story's needs. If you believe a sixth primitive is required, **stop and say so** rather than editing them silently (see "Deliberate deviation from 7.1 AC3" below for the one case where this was considered and rejected).

**Inputs:** `epics.md:2044-2061` (Story 7.8 + Epic 7 non-goals); `apps/host-client/src/vfx/{index,primitives,engine,types}.ts`; `apps/host-client/src/screens/DungeonScreen.tsx` (whole file); `apps/host-client/src/session/host-session.ts:44-63`; `packages/shared-types/src/{projectile,zone,constants}.ts`; stories `7-1-vfx-engine-foundations.md`, `3-13-projectile-physics-and-zone-field-entities.md`, `5-5-host-bond-visualization-assignment-overlay-and-particle-tethers.md`, `6-4-boss-defeat-sequence-purification-pulse-and-reward-reveal.md`; `DESIGN.md:105-227` (color tokens).

**Non-goals:**
- No final pixel-art sprites — the PixelLab art pass is untouched.
- No new abilities or mechanics; no change to damage, radius, duration, cooldown or tick timing.
- No protocol or schema changes (7.7a is Epic 7's one deliberate exception and is not this story).
- No rewrite of the `App.tsx` transient-delta plumbing (`latestTransientDelta`) — flag, don't fix.
- No zone/projectile *gameplay* reads on the host: no collision, no cooldown tracking, no `GameState` mutation.
- Not owning the *appearance* of Souldrinker or Stormcaller abilities — 7.4 and 7.5 do. This story owns the tables' shape, the defaults and the fallback ladder.

**Ownership check:** every allowed path is under `apps/host-client/**` = **Host Experience Engineer**. Single ownership area → no task split, no cross-context approval needed.

**Hook verdicts (all five, per CLAUDE.md):**

| Hook | Verdict | Why |
|---|---|---|
| **Client-UX hook** | **TRIGGERED** | Host UI change that actually renders. Checks below are real, not N/A. |
| **Contract-change hook** | **NOT triggered** | No `packages/shared-types/**`, no `packages/net-protocol/**`, no session-lifecycle, reconnect-flow, room-state, join-flow or prediction/reconciliation/interpolation surface touched. The `host-session.ts` whitelist edit forwards an **already-defined, already-`applyDelta`-handled** delta to a host component — host-local delivery filtering, not a wire contract. This is also precisely why AC2 was reworded away from adding `class`/`abilityIndex` to `ZoneState`. |
| **Simulation-safety hook** | **NOT triggered** | No `apps/simulation-server/**`, no `packages/game-rules/**`. Host is a pure renderer here. |
| **Telemetry hook** | **N/A** | No new user flow — visual treatment of existing flows. No new event, trigger, payload or KPI. |
| **Ownership hook** | **Clean** | Single area (see above). |

**Client-UX hook checks (host):**
- *Join-flow smoke test:* start host → phone joins → enter dungeon; the new engine is constructed inside `initPixi` and must not break app init or the QR/lobby path.
- *Host HUD readability:* zones keep `addChildAt(g, 0)` (below sprites); trails are thin and short-lived; the tether glow underlay is `alpha 0.16` — none of these may obscure player/enemy bodies, enemy health bars, status badges (`:258-288`), damage numbers, the boss HP bar or the revive-timer overlay.
- *Reconnect-state visibility:* the frozen-player `0.3` alpha cue (`:144`) and the down/spirit body sprite at `bodyX/bodyY` (`:151-174`) must survive untouched — this story does not go near the player block.
- *Couch readability at 2–4 m:* every color below is from the DESIGN.md token set; no effect is thinner than 3px at the core; the tether breath stays in `0.48–0.76` alpha so it never disappears at distance.
- *Reconnect/owner-loss:* disconnect the owner of a live Storm Eye zone and confirm the zone keeps rendering (effectType-tier fallback) instead of vanishing or throwing.

### Ground truth: what the entities actually carry

```ts
// packages/shared-types/src/projectile.ts:3-10  — HAS class + abilityIndex
interface ProjectileState { id; ownerId; x; y; class: PlayerClass; abilityIndex: number }

// packages/shared-types/src/zone.ts:1-12  — has NEITHER
type ZoneEffectType = 'damage' | 'pull';
interface ZoneState { id; ownerId; x; y; radius; effectType: ZoneEffectType; tickIntervalMs; expiresAtMs }
```

Which abilities actually reach these code paths today (`ABILITY_DELIVERY`, `packages/game-rules/src/balance.ts:124` — read for authoring, **never imported by the host**):

| Ability | Class | Idx | Delivery | Entity produced |
|---|---|---|---|---|
| Blood Spike | Souldrinker | 0 | `projectile` | `ProjectileState` (`class: Souldrinker, abilityIndex: 0`) |
| Void Pulse | Souldrinker | 3 | `projectile` | `ProjectileState` (idx 3) → on hit, chains a `pull` zone (radius 150, tick 500 ms, 2000 ms life) |
| Storm Eye | Stormcaller | 3 | `zone` | `ZoneState` (`effectType: 'damage'`, radius 150, tick 500 ms, 5000 ms life) |

Everything else in the 16-ability set is same-tick `hitscan` and never produces a projectile or zone. So today: `effectType === 'pull'` ⇒ Void Pulse's chained zone; `effectType === 'damage'` ⇒ Storm Eye. That mapping is a *current fact*, not a guarantee — which is exactly why the lookup is `(class, effectType)` first and `effectType` only as the fallback tier.

### Visual config module: shape

`apps/host-client/src/vfx/ability-visuals.ts`

```ts
import { PlayerClass } from 'shared-types';
import type { ZoneEffectType } from 'shared-types';

export interface ProjectileVisual {
  /** Outer body disc. */
  bodyColor: number;      // 0xrrggbb
  bodyRadius: number;     // px, virtual 1920x1080 space
  bodyAlpha: number;      // 0..1
  /** Optional inner core disc drawn on top of the body. */
  coreColor?: number;
  coreRadius?: number;
  /** Motion trail (createTrail). */
  trailColor: number;
  trailWidth: number;
  trailAlpha: number;
  trailDurationMs: number;
  trailPointCount: number;
  /** Impact on projectile:hit. */
  impact:
    | { kind: 'burst'; color: readonly number[]; count: number; speed: number; spread: number; particleRadius: number; durationMs: number }
    | { kind: 'ring'; color: number; maxRadius: number; lineWidth: number; durationMs: number; alpha: number };
}

export interface ZoneVisual {
  fillColor: number;
  fillAlpha: number;
  ringColor: number;
  ringWidth: number;
  ringAlpha: number;
  /** One-shot ring played once when the zone first appears. */
  spawnRing: { color: number; startRadiusFactor: number; maxRadiusFactor: number; lineWidth: number; durationMs: number; alpha: number };
}
```

`startRadiusFactor`/`maxRadiusFactor` are multiplied by the zone's own `radius` at call time, so the spawn ring always matches the zone's real footprint — a visual that lies about reach is worse than a flat circle.

Lookup ladder (both functions must be total):

```
getProjectileVisual(cls, idx):
  PROJECTILE_VISUALS[`${cls}:${idx}`]  →  DEFAULT_PROJECTILE_VISUAL

getZoneVisual(cls, effectType):
  ZONE_VISUALS[`${cls}:${effectType}`]           // full identity
  →  EFFECT_TYPE_ZONE_VISUALS[effectType]        // owner unknown / owner class has no entry
  →  DEFAULT_ZONE_VISUAL                          // unknown effectType (future-proofing)
```

Guard `idx` with `Number.isInteger(idx)` before building the key, so `NaN`/`undefined` land on the default instead of producing the key `"souldrinker:NaN"`.

### Projectile visual spec table

Colors from DESIGN.md (`DESIGN.md:105-227`). Souldrinker's palette is `corruption-blood 0xc0392b` + `accent-corruption 0x7d2dff`; it must not appropriate `accent-purify 0x90d8f0` (boss defeat only) or the reserved bond usage of `accent-spirit 0x6ea8d8`.

| Key | Ability | Body | Core | Trail | Impact |
|---|---|---|---|---|---|
| `souldrinker:0` | Blood Spike (AUTO, 1 s CD, range 150, hit radius 50) | `bodyColor 0xc0392b`, `bodyRadius 7`, `bodyAlpha 1` | `coreColor 0xe8705f`, `coreRadius 3` | `trailColor 0xc0392b`, `trailWidth 7`, `trailAlpha 0.85`, `trailDurationMs 220`, `trailPointCount 12` | `{ kind: 'burst', color: [0xc0392b, 0x7a1d16], count: 6, speed: 0.12, spread: 0.9, particleRadius: 3, durationMs: 260 }` |
| `souldrinker:3` | Void Pulse (RELEASE, 4 s CD, hit radius 80, chains a pull zone) | `bodyColor 0x7d2dff`, `bodyRadius 11`, `bodyAlpha 0.9` | `coreColor 0x1a0526`, `coreRadius 5` (a void hole, not a highlight) | `trailColor 0x7d2dff`, `trailWidth 10`, `trailAlpha 0.7`, `trailDurationMs 320`, `trailPointCount 16` | `{ kind: 'ring', color: 0x7d2dff, maxRadius: 80, lineWidth: 4, durationMs: 260, alpha: 0.8 }` — 80 px is Void Pulse's real hit radius |
| **default** | any unmapped projectile | `bodyColor 0xffffff`, `bodyRadius 8`, `bodyAlpha 1` — **byte-identical to today's `:308`**, so an unmapped future ability is never worse than the status quo | none | `trailColor 0xffffff`, `trailWidth 6`, `trailAlpha 0.6`, `trailDurationMs 200`, `trailPointCount 12` | `{ kind: 'burst', color: [0xffffff], count: 6, speed: 0.12, spread: 0.9, particleRadius: 3, durationMs: 220 }` |

Body draw, per frame, per projectile (one `Graphics`, `clear()` + redraw — the established pattern at `:306-308`):

```ts
g.position.set(p.x, p.y);
g.clear();
g.circle(0, 0, v.bodyRadius).fill({ color: v.bodyColor, alpha: v.bodyAlpha });
if (v.coreColor !== undefined && v.coreRadius !== undefined) {
  g.circle(0, 0, v.coreRadius).fill({ color: v.coreColor });
}
```

Trail creation, once, on first-seen:

```ts
const trail = createTrail({
  x: p.x, y: p.y,
  color: v.trailColor, width: v.trailWidth, alpha: v.trailAlpha,
  durationMs: v.trailDurationMs, pointCount: v.trailPointCount,
});
vfx.engine?.add(trail);
```

Impact, in the `projectile:hit` branch:

```ts
const v = projectileGraphicsRef.current.get(d.projectileId)?.visual ?? DEFAULT_PROJECTILE_VISUAL;
const e = v.impact.kind === 'burst'
  ? createParticleBurst({ x: d.x, y: d.y, color: v.impact.color, count: v.impact.count,
      speed: v.impact.speed, spread: v.impact.spread, particleRadius: v.impact.particleRadius,
      durationMs: v.impact.durationMs })
  : createRingShockwave({ x: d.x, y: d.y, color: v.impact.color, maxRadius: v.impact.maxRadius,
      lineWidth: v.impact.lineWidth, durationMs: v.impact.durationMs, alpha: v.impact.alpha });
vfxEngineRef.current?.add(e);
```

### Zone visual spec table

| Key | Ability | Fill | Edge ring | Spawn ring (one-shot) |
|---|---|---|---|---|
| `souldrinker:pull` | Void Pulse's chained pull zone (radius 150, 2 s, pulls 50 px/tick toward centre) | `fillColor 0x7d2dff`, `fillAlpha 0.18` | `ringColor 0x7d2dff`, `ringWidth 3`, `ringAlpha 0.55` | `{ color: 0x7d2dff, startRadiusFactor: 1.0, maxRadiusFactor: 0.15, lineWidth: 5, durationMs: 420, alpha: 0.9 }` — an **implode**, reading as suction; safe, radius is clamped ≥ 0 (`primitives.ts:219`) |
| `stormcaller:damage` | Storm Eye (radius 150, 5 s, 10 dmg / 500 ms + a 30-dmg strike / 1500 ms) | `fillColor 0x2f6f9e`, `fillAlpha 0.16` | `ringColor 0x9fd8ff`, `ringWidth 3`, `ringAlpha 0.6` | `{ color: 0x9fd8ff, startRadiusFactor: 0.15, maxRadiusFactor: 1.0, lineWidth: 5, durationMs: 380, alpha: 0.9 }` — an expand, reading as the storm settling in |
| **effectType `pull`** (owner unknown) | — | `0x7d2dff`, `0.18` | `0x7d2dff`, `3`, `0.45` | same as `souldrinker:pull` |
| **effectType `damage`** (owner unknown) | — | `0x2f6f9e`, `0.16` | `0x9fd8ff`, `3`, `0.5` | same as `stormcaller:damage` |
| **default** | unknown effectType | `0x9b59b6`, `0.25` — today's exact `:329` values | `0x9b59b6`, `2`, `0.4` | `{ color: 0x9b59b6, startRadiusFactor: 0.15, maxRadiusFactor: 1.0, lineWidth: 3, durationMs: 300, alpha: 0.6 }` |

Zone body draw, per frame:

```ts
const ownerClass = state.players.find(p => p.id === zone.ownerId)?.class; // undefined is expected, not an error
const v = getZoneVisual(ownerClass, zone.effectType);
g.position.set(zone.x, zone.y);
g.clear();
g.circle(0, 0, zone.radius).fill({ color: v.fillColor, alpha: v.fillAlpha });
g.circle(0, 0, zone.radius).stroke({ color: v.ringColor, width: v.ringWidth, alpha: v.ringAlpha });
```

The owner-not-found path is a **real, reachable state**, not defensive paranoia: a Void Pulse pull zone lives 2000 ms and a Storm Eye 5000 ms — a player can disconnect, be removed from `state.players`, or leave the room inside that window while the server keeps ticking the zone. It must render at the `effectType` tier and log nothing (a `console.warn` here fires 60×/s).

**Cross-story note for 7.4/7.5:** the fill alphas are deliberately low (0.16–0.18, *below* today's 0.25) because a zone sits under every sprite and a stronger fill fights the couch-readability check. If 7.4/7.5 want a stronger read, they should raise the *edge ring*, not the fill.

### Deliberate deviation from 7.1 AC3 (zone bodies stay `Graphics`)

7.1 AC3 says 7.2–7.8 "add no new bespoke `Graphics`-drawing code for basic shapes". Zone bodies and projectile bodies remain per-frame `Graphics.clear()` + redraw, because:
- A zone body and a projectile body are **persistent entity renders driven by `GameState`**, not time-limited effects. None of the five primitives models "a shape that tracks an entity for an unbounded lifetime" — feeding a fading primitive every frame for the life of a 5-second zone is per-frame effect churn, the exact thing D-7.1-D warns about.
- The drawing is now **fully parameterized by the config module** — which is what AC3 was protecting against (per-ability inline shape code), not `Graphics` usage as such.
- All the *time-limited* parts of this story (trail, impact, spawn ring, purification pulse, reward burst) **do** go through the primitives.

Do not add a sixth primitive for this. If you disagree, raise it rather than editing `primitives.ts` under this story's Blocked paths.

### The clock unification — the one thing that must not get wrong

This is the highest-risk step in the story because it fails **silently**.

- `renderFrame` computes `const now = Date.now()` (`DungeonScreen.tsx:99`).
- The purification-pulse block (`:465`), the reward-particle block (`:486`), the pulse creation (`:617`) and the particle spawn (`:720`) all use `performance.now()` — a completely different epoch (milliseconds since page load vs milliseconds since 1970).
- The 7.1 primitives read **no clock at all**: `startedAt` is captured from the first `update(now)` the engine hands them (`primitives.ts:8-11`, `types.ts:29-33`). Whatever clock you feed `VfxEngine.update()` becomes every effect's clock.
- `TrailHandle.moveTo(x, y, now)` takes a timestamp that **must be in that same clock** (`primitives.ts:100-104`).

Therefore: **`Date.now()` everywhere in this file, exclusively.** The ticker computes one `const now = Date.now();` and passes it to `renderFrame` (which already recomputes its own — leave that alone, they agree) and to `vfxEngineRef.current.update(now)`; `renderFrame` passes its own `now` to `trail.moveTo(...)`. Mixing the two makes effects either vanish on frame 1 (a `performance.now()` `startedAt` is ~1.7 trillion ms in the past relative to `Date.now()` → `progress()` returns 1 immediately) or leak forever — with no exception, no console output, and no visible symptom other than "the effect doesn't work". Task 10.3's `rg 'performance\.now'` check exists specifically to catch a missed occurrence.

### Reward burst: prior art → primitive parameter mapping (like-for-like)

`DungeonScreen.tsx:704-728` vs `createParticleBurst` (`primitives.ts:38-86`):

| Prior art | Primitive param | Note |
|---|---|---|
| `count = 8 + Math.floor(Math.random() * 5)` | `count` | keep the randomization at the call site |
| `PARTICLE_COLORS = [0x6ea8d8, 0xf0c070]`, picked `i % 2` | `color: [0x6ea8d8, 0xf0c070]` | `pickColor` cycles a palette by index identically (`primitives.ts:13-14`) |
| `angle = (2π·i)/count + (rand−0.5)·0.5` | `spread: 0.5` | identical formula (`primitives.ts:58`) |
| `speed = 0.1 + rand·0.15` (0.10–0.25, mean 0.175) | `speed: 0.175` | primitive computes `speed·(0.7 + rand·0.6)` → 0.1225–0.28, mean 0.175 (`primitives.ts:59`) |
| `g.circle(0, 0, 8 + rand·8)` | `particleRadius: 8` | primitive draws `particleRadius + rand·particleRadius` → 8–16 (`primitives.ts:62`) |
| `PARTICLE_DURATION_MS = 1000` | `durationMs: REWARD_PARTICLE_DURATION_MS = 1000` | |
| `alpha = 1 − t` per particle | container `alpha = alpha·(1 − t)` | visually equivalent |
| position `VIRTUAL_W/2 + vx·elapsed` (absolute) | `x: VIRTUAL_W/2, y: VIRTUAL_H/2`, children positioned locally | same on-screen result; the primitive additionally **clamps** `elapsed` so a stalled ticker can't fling particles off-origin (`primitives.ts:73-75`) — a small improvement, not a change of intent |
| `performance.now()` | *(none — engine clock)* | **the fix** |

The purification pulse maps just as cleanly: radius `0 → 1400`, alpha `0.6 → 0`, `filled: true`, `color: 0x90d8f0`, `durationMs: PURIFICATION_PULSE_DURATION_MS` — `createRingShockwave` was generalized from this exact block (`primitives.ts:187`).

### Effect volume (D-7.1-D)

7.1 deferred any cap/pooling/back-pressure on concurrent effects with the note *"revisit when 7.2–7.8 reveal real effect volumes"*. This story's arithmetic:

| Source | Effects alive concurrently | Bound |
|---|---|---|
| Projectile trails | 1 per live projectile + up to 1 fading per recently-despawned projectile | Blood Spike is a 1 s cooldown AUTO ability and Void Pulse 4 s; with 4 players all on Souldrinker that is ≤ ~8 live + ≤ ~8 fading (trails expire in ≤ 320 ms). **Order of ten.** |
| Zone spawn rings | 1 per zone spawn, ≤ 420 ms | Zones are rare (one Storm Eye or one chained pull zone at a time per caster). |
| `projectile:hit` impacts | 1 per delivered delta, ≤ 260 ms | Further throttled *down* by the `latestTransientDelta` collapse below. |
| Purification pulse / reward burst | 1 each, once per run | |

Conclusion: **re-defer D-7.1-D.** Peak concurrency is in the low tens, well inside what a `Map<number, EffectHandle>` iterated once per frame handles. Do **not** add pooling in this story. The non-negotiable that keeps this true is Task 3.4/3.5: **one persistent trail per live projectile, created on first-seen and never re-created per frame** — the failure mode to avoid is calling `createTrail` + `engine.add` inside the per-frame loop, which would add 60 effects/second/projectile and is the one way this story could tank frame rate.

### The `latestTransientDelta` batching limitation

`App.tsx:20,42-48` stores the most recent delta in a single React state value and clears it after 400 ms. React 18 auto-batches, so **two deltas arriving in the same task collapse — only the last reaches `DungeonScreen`'s effect** (`DungeonScreen.tsx:537`). This is pre-existing (it is why `boss:stomped` visuals are unreliable) and this story inherits it for `projectile:hit` only.

Consequences you must design around, not fix:
- Impact effects are **best-effort**. If two projectiles land in the same tick, one impact is drawn. AC5 is written to accept this.
- Everything continuous in this story — projectile bodies, trails, zone bodies, tethers — is driven from the **`GameState` snapshot** in `renderFrame`, which is reconciled and cannot be dropped. That is deliberate: prefer snapshot-driven visuals over delta-driven ones wherever a choice exists.
- **Do not** rewrite the App-level plumbing inside a VFX story. If you conclude it blocks an AC, flag it for a follow-up instead.

### Whitelist edit rationale (`host-session.ts`)

`apps/host-client/src/session/host-session.ts:44-63` forwards 17 delta types to `onTransientDelta`; everything else is dropped before reaching `DungeonScreen`. `projectile:hit` and `projectile:expired` both exist on the wire and are both already handled by `applyDelta` (which runs unconditionally at `host-session.ts:66`, outside the whitelist), so adding a type to the whitelist changes **delivery to the UI only** — it cannot change mirror-state behavior. Add `projectile:hit` (it carries `x`/`y`, so there is something to draw). Skip `projectile:expired` (no position; the fading trail already reads as expiry). Keep the existing formatting and ordering style of the condition — insert the new line adjacent to the other entity deltas.

### Must-not-regress inventory

Read these before editing and confirm each after (AC7):

| Behavior | Location |
|---|---|
| Ability cast flash cosine (`flashUntil`) | `DungeonScreen.tsx:131-133`, `142-144`, set at `:551-556` |
| Spirit-form glow ring + inner circle | `:129-135` |
| `isDown`/`isSpirit` body sprite at `bodyX/bodyY` (Story 3.21c) | `:151-174` |
| Frozen-player `0.3` alpha disconnect cue | `:144`, `:167-168` |
| Enemy kill fade over `KILL_FADE_MS` | `:194-209`, `:557-559` |
| Enemy health bars | `:226-231` |
| Status effect badges | `:258-288` |
| Essence flash pulse | `:332-345`, `:578-584` |
| Damage numbers rise + fade | `:347-359`, `:560-577` |
| Boss sprite, phase-2 glow ring, phase-3 eye | `:436-460` |
| Background swap to `0x90d8f0` on defeat | `:610` |
| Reward overlay text + voice line + `essenceDisplayRef` | `:606`, `:704-728`, `:911-946` |
| Revive timer overlay | `:947-988` |
| Bond overlay text (React, separate from tethers) | `:541-548`, `:887-910` |

`renderFrame`'s parameter list is already 10 positional arguments (`:84-96`) and the call site at `:421-433` must be updated in lockstep with the definition — TypeScript will catch a mismatch, but a *reordered* argument of the same type will not be caught. Append the new `vfx` parameter **last** and change nothing else about the order.

### Previous Story Intelligence

From **7.1** (`7-1-vfx-engine-foundations.md`) — hard-won, all of it applies here:
- The clock contract was redesigned *because of* a review finding that clock mixing is a silent total failure. Respect it (see "The clock unification" above).
- `VfxEngine.update()` isolates a throwing effect (reaps + logs it) rather than aborting the loop (`engine.ts:33-43`) — so a bug in one effect will show up as "that effect vanished", not as a crash. If an effect mysteriously disappears, check the console for `[vfx] effect update failed`.
- `createTintPulse` restores the target's **captured** pre-trigger alpha/tint on dispose — relevant if a sibling story is also pulsing player circles; do not assume alpha is 1.
- `pixi.js` **does** import cleanly under a plain node-environment `vitest run` (the earlier "can't import pixi" claim was retracted); it is just slow to transform on WSL2 (~35 s first collect). Your `ability-visuals.test.ts` avoids the import entirely and so runs instantly.
- Deferred items D-7.1-A (engine reentrancy), D-7.1-B (same handle added twice), D-7.1-C (externally destroyed views), D-7.1-D (no effect cap) are all still open. Two matter here: **B** — never `engine.add()` the same `TrailHandle` twice (Task 3.3 adds it exactly once, on first-seen); **A** — do not call `engine.add`/`remove` or `setState` from inside an effect's `update`; the purification handoff (Task 6.3) runs in the ticker *after* `engine.update()` specifically to avoid this.

From **3.13** (`3-13-projectile-physics-and-zone-field-entities.md`): `ProjectileState`'s field list was fixed to exactly `(id, ownerId, x, y, class, abilityIndex)` — no direction, no spawn origin. There is no velocity vector on the host, which is why the trail must be built from observed positions (`moveTo` per frame) rather than extrapolated.

From **5.5** (`5-5-...-particle-tethers.md`): `BondState.color` is a **CSS hex string** like `'#6ea8d8'` and must be parsed to a PixiJS number; `addChildAt(g, 0)` puts tethers at the bottom of the render stack; the tether persists for the rest of the run and does not fade. All preserved.

From **6.4** (`6-4-boss-defeat-...md`): the pulse radiates from the boss's **last known** position (`bossLastPositionRef`, seeded from snapshots at `:653-657`, defaulting to arena centre `960,540`) — keep using that ref, do not read `state.boss` in the defeat branch (the boss may already be gone). `PURIFICATION_PULSE_DURATION_MS` also gates the server's `run:complete` timing, so it is a shared constant, not a host tuning knob.

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`. Run suites from inside `apps/host-client`.
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. Pure mapping logic goes in a plain exported function that can be tested without a canvas; rendering itself is verified manually via the Client-UX hook. `ability-visuals.ts` is that function pair; `DungeonScreen.tsx` rendering is not unit-tested.
- Commands: `npm run typecheck` (root, covers all 10 tsconfigs); `npx vitest run src/vfx/ability-visuals.test.ts` and `npx vitest run src/vfx/vfx.test.ts` from `apps/host-client`.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 (simulation-server 60 s boot timeout; a heal assertion in `tests/e2e/ability-dispatch.test.ts:227`). Note it if you see it; do not chase it.
- Never claim a test passed without running it.

### Project Context Rules (from project-context.md)

- **Ownership:** `apps/host-client/**` = Host Experience Engineer. Blocked: simulation server, game-rules, mobile, shared-types, net-protocol.
- **Never import `packages/game-rules` in `apps/host-client`.** The balance numbers in this story (radii, cooldowns, durations) are for *choosing visual parameters at authoring time*. Any value that must exist in host code becomes a local named constant in the host file. `shared-types` **is** importable and already used (`CLASS_DEFINITIONS`, `PlayerClass`, `BossPhase`, `SessionColor`, `PURIFICATION_PULSE_DURATION_MS`, `REWARD_REVEAL_DURATION_MS` — see `DungeonScreen.tsx:3-4`).
  - **Update — Story 7.9 / ADR-0003 (import the ability spatial geometry):** ability *spatial* geometry now lives in the shared **ability presentation contract** in `shared-types`. For this story's environmental/projectile/zone work, **import** `ABILITY_DELIVERY`, `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`, `VOID_PULSE_ZONE_RADIUS_PX`, and `STORM_EYE_ZONE_RADIUS_PX` from `shared-types` rather than transcribing them (e.g. a projectile trail's max range is `PROJECTILE_MAX_RANGE_PX`, a chained-zone visual is `VOID_PULSE_ZONE_RADIUS_PX` — not a local `800`/`150`). The rule is refined to *never import `game-rules` **logic***; pure balance (damage/cooldown/heal/status/bond magnitudes) stays host-forbidden.
- Host is a pure client: no `GameState` mutation, no game-rule checks, no physics reads. Rendering only inside PixiJS display objects — no game logic, no cooldown tracking, no collision.
- `Math.random()` **is** permitted here — "host UI animations, cosmetic effects" is the one allowed place.
- TypeScript strict; no `any` without an explicit suppression comment.
- Colors in canvas code are PixiJS `number` literals (`0xrrggbb`), **never** CSS strings. The one CSS string in play is `BondState.color`, which is why it is parsed (Task 8.1).
- Tunable visual values go in named constants at the top of the file or in the config module — not as inline magic numbers scattered through the delta handler.
- Files kebab-case; events `noun:verb`; wire types `PascalCase + Msg`.

### Project Structure Notes

- `apps/host-client/src/vfx/` gains one file (`ability-visuals.ts`) and one test (`ability-visuals.test.ts`), matching the existing kebab-case module layout (`types.ts`, `primitives.ts`, `engine.ts`, `index.ts`, `vfx.test.ts`).
- `ability-visuals.ts` imports only from `shared-types` — **no `pixi.js` import**, deliberately, so the module and its test stay canvas-free and instant to run. Keep it that way; if you find yourself needing `Graphics` in there, the logic belongs in `DungeonScreen.tsx` instead.
- Adding data to `apps/host-client/src/vfx/` rather than a new top-level directory keeps the "one shared VFX toolkit" shape 7.1 established and gives 7.4/7.5 an obvious, conflict-minimal place to write their rows.
- No new dependency, no build-config change, no new package.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:2044-2061`] — Story 7.8 statement, both AC pairs, and the Epic 7 non-goals ("no final pixel-art sprites; no new abilities or mechanics; no protocol/schema changes beyond the one-line `boss:charged` whitelist fix in Story 7.7").
- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 framing, and the confirmation that "every projectile renders as the same hardcoded white circle (`DungeonScreen.tsx:308`), every zone as the same hardcoded purple circle (`:329`)".
- [Source: `packages/shared-types/src/zone.ts:1-12`] — `ZoneState` field list; **no `class`, no `abilityIndex`** (the epic correction).
- [Source: `packages/shared-types/src/projectile.ts:3-10`] — `ProjectileState` **does** carry `class` and `abilityIndex`.
- [Source: `packages/shared-types/src/constants.ts:15-16`] — `PURIFICATION_PULSE_DURATION_MS = 2500`, `REWARD_REVEAL_DURATION_MS = 3000`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:84-96`] — `renderFrame` signature (10 positional params; append the new one last).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:99`] — `const now = Date.now()`, the clock `renderFrame` and therefore the trail must use.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:234-256`] — bond tethers: per-bond `Graphics`, `addChildAt(g, 0)`, `parseInt(bond.color.slice(1), 16)`, `stroke({ color, width: 2, alpha: 0.7 })`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:290-309`] — projectile section: create-on-first-seen/cleanup-on-missing, and the hardcoded `g.circle(0, 0, 8).fill({ color: 0xffffff })` at `:308`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:311-330`] — zone section, `addChildAt(g, 0)` at `:324`, hardcoded `g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })` at `:329`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:404-417`] — `initPixi`, `app.init`, `pixiAppRef.current = app` — where the `VfxEngine` is constructed.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:418-499`] — the ticker callback: `renderFrame` call site (`:421-433`), boss sprite (`:436-460`), purification pulse on `performance.now()` (`:462-479`), reward particles on `performance.now()` (`:481-498`).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:502-525`] — unmount cleanup; where `vfxEngineRef.current?.clear()` goes and where the dead purification refs are removed.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:537-623`] — transient-delta `if/else-if` chain; the `projectile:hit` branch joins it; `boss:defeated` at `:602-622` creates the pulse on `performance.now()` at `:617`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:653-657`] — `bossLastPositionRef`, the pulse origin (UX-DR16), defaulting to `960,540`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:704-728`] — reward-reveal particle spawn: `[0x6ea8d8, 0xf0c070]`, `8 + rand·5` count, `8 + rand·8` radius, `0.1 + rand·0.15` speed, `spread 0.5`, `performance.now()`.
- [Source: `apps/host-client/src/session/host-session.ts:44-63`] — the 17-type transient-delta whitelist; `projectile:hit`/`projectile:expired` absent. `applyDelta` runs unconditionally at `:66`.
- [Source: `apps/host-client/src/vfx/index.ts:1-19`] — the barrel to extend.
- [Source: `apps/host-client/src/vfx/engine.ts:14-63`] — `VfxEngine` API: `add` → id, `update(now)` per frame, throwing-effect isolation (`:33-43`), `remove(id)`, `clear()`.
- [Source: `apps/host-client/src/vfx/types.ts:29-33`] — the CLOCK CONTRACT comment.
- [Source: `apps/host-client/src/vfx/types.ts:52-55`] — `progress()`, clamped and NaN-safe.
- [Source: `apps/host-client/src/vfx/primitives.ts:13-14`] — `pickColor` palette cycling (matches the reward burst's `i % 2`).
- [Source: `apps/host-client/src/vfx/primitives.ts:17`, `:38-86`] — `createParticleBurst`, explicitly "Generalized from the reward-reveal burst in DungeonScreen.tsx"; `spread` at `:58`, `speed` jitter at `:59`, radius at `:62`, clamped elapsed at `:73-75`.
- [Source: `apps/host-client/src/vfx/primitives.ts:97-105`, `:113-184`] — `TrailHandle` (`disposed`, `moveTo(x, y, now)`) and `createTrail`; ring buffer, `pointCount` clamped to ≥ 2 at `:121`.
- [Source: `apps/host-client/src/vfx/primitives.ts:187`, `:200-233`] — `createRingShockwave`, explicitly "Generalized from the purification pulse and the `boss:stomped` ring"; radius clamped ≥ 0 at `:219` (implode is safe).
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`] — post-review notes: lazy `startedAt` clock redesign, `TrailHandle.disposed`, throwing-effect isolation, and deferred items D-7.1-A…D including "no cap/pooling/back-pressure — revisit when 7.2–7.8 reveal real effect volumes".
- [Source: `_bmad-output/implementation-artifacts/3-13-projectile-physics-and-zone-field-entities.md:219-221`, `:362-363`] — the exact `ProjectileState`/`ZoneState` field lists as shipped; no direction/spawn fields on the projectile.
- [Source: `_bmad-output/implementation-artifacts/5-5-host-bond-visualization-assignment-overlay-and-particle-tethers.md:35-38`, `:115-130`] — CSS-hex parse requirement, `addChildAt(g, 0)` layering, tether persists for the run, multiple simultaneous tethers.
- [Source: `_bmad-output/implementation-artifacts/6-4-boss-defeat-sequence-purification-pulse-and-reward-reveal.md:102-110`, `:207-214`] — pulse radius `0 → ~1400`, alpha `0.6 → 0`, color `0x90d8f0`, boss-last-known origin, and the reward-reveal handoff at pulse completion.
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:105-227`] — color tokens: `accent-corruption 0x7d2dff`, `accent-purify 0x90d8f0` (boss defeat only), `accent-spirit 0x6ea8d8` (bonds/spirit form), `corruption-blood 0xc0392b`, `accent-warm 0xc07d35`; the Raw Earth / Spirit Chant two-layer rule.
- [Source: `_bmad-output/project-context.md`] — host ownership boundary, the "never import game-rules in host-client" rule, `Math.random()` allowance for cosmetic host effects, PixiJS numeric-color rule, naming conventions.
- [Source: `CLAUDE.md`] — Pre-task / Ownership / Contract-change / Simulation-safety / Client-UX / Telemetry hook definitions and the Merge Gate.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (Claude Code)

### Debug Log References

None from the initial implementation pass — no test/typecheck failure required a diagnose-fix-retry cycle beyond the one described in Completion Notes (two stale `stormcaller-vfx.test.ts` assertions, fixed on first pass after root-causing them as encoding pre-AC2 behavior). The post-implementation code review's Blind Hunter layer (zero project context) raised two claimed compile-time defects (`P` undefined, `TrailHandle` unimported); both were independently checked against the live file with `rg`/`Read` before acting — both were pre-existing symbols outside this diff's changed lines, confirmed false positives, and dismissed rather than "fixed" (there was nothing to fix). See Review Findings for the full triage.

### Completion Notes List

- Re-verified the story's literal spec against current source before implementing (per this project's established pattern): the real "7.8 seam" is `apps/host-client/src/vfx/ability-vfx-config.ts` (built by 7.4/7.5/7.7b), not the `ability-visuals.ts` path the story text names. `VfxEngine` wiring (Task 1) and the `projectile:hit` host-session whitelist (Task 5.1) were already shipped. Implemented the real remaining gap against the existing module rather than forking a second config file — see the Tasks/Subtasks deviation note above for the full per-task mapping.
- **AC1 (projectiles):** Added `resolveProjectileAppearance(cls, abilityIndex)` + `DEFAULT_PROJECTILE_APPEARANCE` (byte-identical to today's white circle) to `ability-vfx-config.ts`; wired per-ability body (core + optional halo) and a persistent `TrailHandle` per live projectile into `renderFrame`'s existing Projectiles block, replacing the hardcoded `g.circle(0, 0, 8).fill({ color: 0xffffff })`.
- **AC2 (zones) — the real fix.** The pre-existing `resolveZoneVisual` (7.5) fell straight to the global purple default whenever the owner wasn't found or wasn't the exact expected class, skipping an effectType-only tier entirely — this is precisely the gap AC2 asks this story to close. Rebuilt it as a proper three-tier ladder (`${ownerClass}:${effectType}` exact → `EFFECT_TYPE_ZONE_VISUAL[effectType]` fallback → `DEFAULT_ZONE_VISUAL`), added `VOID_PULSE_ZONE_VISUAL` (built from 7.4's already-authored `ZONE_APPEARANCE.pull`, not overwritten) so Void Pulse's chained zone finally gets its own body instead of the flat purple disc, and added a one-shot `createRingShockwave` spawn ring on first-seen zone (Task 4.4 — previously entirely missing).
- **AC3 (shared config + seam):** Extended the existing module rather than introducing a parallel one; kept every 7.4/7.5-authored value untouched (`SOULDRINKER_PROJECTILES`, `ZONE_APPEARANCE.pull`, `STORM_EYE_ZONE_VISUAL`'s fill/rim colors) and added only new fields/functions on top, per AC3's "kept, not overwritten" rule.
- **AC4 (trails):** One `TrailHandle` created on first-seen projectile, fed via `moveTo` once per frame off `renderFrame`'s own `now`, never re-created; cleanup-on-missing stops feeding it (does not `engine.remove()`) so it fades and self-reaps within its own `trailDurationMs`.
- **AC5 (impact effects):** Confirmed already fully implemented by Story 7.4 (`planBloodSpikeImpact`/`planBloodSpikeSplash`/`planVoidPulseImpact`, gated on the `projectileMetaRef` cache) — richer and more ability-specific than a generic fallback visual would be, and covers every projectile ability that exists today. No new code; adding a speculative generic `impact` field to `ProjectileAppearance` with zero real callers would have been premature abstraction.
- **AC6/AC7 (clock unification + no regressions):** Ported the purification pulse to `createRingShockwave` with a `purificationPulseEndsAtRef` deadline (VfxEngine has no completion callback, so the reward-reveal handoff needed an explicit deadline check, nulled first so it fires exactly once) and the reward burst to `createParticleBurst`, both now exclusively on `Date.now()`. Restyled bond tethers (glow + breathing core, `parseCssHexColor` NaN guard) without touching their persistence/keying/layering semantics. Hoisted a single `const now = Date.now()` to the top of the ticker callback, reused for `vfxEngineRef.current.update()` and the new deadline check (`renderFrame` keeps recomputing its own, per Dev Notes, since they already agree).
- One real, unplanned side effect: fixing AC2 correctly required updating two now-stale assertions in the pre-existing `stormcaller-vfx.test.ts` `resolveZoneVisual` suite (7.5), which had encoded the *old*, AC2-incorrect fallback ("owner not found → global default") as the expected "byte-identical to today" behavior. That suite's own comment explicitly anticipated this ("until Story 7.8 adds its own cases (e.g. Void Pulse 'pull')"), so this was in-scope, not scope creep.
- Typecheck clean across all 10 monorepo tsconfigs. New/updated test files: `ability-vfx-config.test.ts` (9 tests, new), `stormcaller-vfx.test.ts` (14 tests, 2 updated), `vfx.test.ts` (24 tests, unchanged, 0 regressions). Full repo suite: 571 passed / 3 skipped / 3 failed — all 3 pre-existing and unrelated: `ability-vfx.test.ts` Stone Wall centering (documented pre-existing failure per project memory, unrelated file untouched by this story) and `ability-dispatch.test.ts`/`hub-ability-use.test.ts` (simulation-server port-binding timeout under WSL2 — this story never touches `apps/simulation-server`).
- Task 10.4 (manual Client-UX pass) was **not** performed — no display in this sandbox, matching this project's established precedent (7.5, 7.6, 7.7b, 3.23, dev-3). Status is set to `review`, not `done`, pending that human pass.
- Confidence: 85% (up from the pre-review 78% — code review found and fixed 6 real gaps, including a genuine AC2-adjacent trail-alpha regression and two holes in this story's own new test coverage, and independently confirmed 0 AC violations). Reasoning: every AC is satisfied by code that typechecks and is unit-tested (56/56 relevant tests green), the real architecture gap (AC2's fallback ladder) was found by reading current source rather than trusting the story text, and an independent Acceptance Auditor pass with full repo access confirmed no AC violations — but the actual on-canvas look (trail feel, zone spawn-ring timing, bond-tether breathing rate, couch-distance readability) has still not been visually verified in this sandbox, and that is exactly what Task 10.4's still-outstanding manual pass exists to catch.

### File List

- `apps/host-client/src/vfx/ability-vfx-config.ts` (modified — projectile appearance lookup + zone visual fallback ladder + spawn ring config; real file behind the story's `ability-visuals.ts` reference)
- `apps/host-client/src/vfx/ability-vfx-config.test.ts` (new — unit tests for the two lookups; real file behind the story's `ability-visuals.test.ts` reference)
- `apps/host-client/src/vfx/index.ts` (modified — barrel export append: `resolveProjectileAppearance`, `DEFAULT_PROJECTILE_APPEARANCE`, `VOID_PULSE_ZONE_VISUAL`)
- `apps/host-client/src/vfx/stormcaller-vfx.test.ts` (modified — 2 assertions updated in the pre-existing `resolveZoneVisual` suite to match the corrected AC2 fallback-tier behavior)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified — projectile body+trail rendering, zone spawn ring, purification pulse + reward burst clock unification, bond tether restyle)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking: `ready-for-dev` → `in-progress` → `review`)
- `_bmad-output/implementation-artifacts/7-8-environmental-and-bond-vfx-polish.md` (this file — task checkboxes, Dev Agent Record, File List, Change Log, Status)

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story drafted from `epics.md:2044-2061` against baseline `884dacb`. Corrected the epic's AC2: `ZoneState` has no `class`/`abilityIndex` fields (`packages/shared-types/src/zone.ts:1-12`), so zone identity is derived from `ownerId → player.class` + `effectType` rather than by adding schema fields, which would fire the Contract-change hook and break the epic's own "no protocol/schema changes" non-goal. |
| 2026-07-23 | Story 7.9 re-point: ability spatial geometry moved into a shared **ability presentation contract** in `shared-types` (ADR-0003). Dev Notes guidance updated — **import** `ABILITY_DELIVERY`/`PROJECTILE_SPEED_PX_S`/`PROJECTILE_MAX_RANGE_PX`/`VOID_PULSE_ZONE_RADIUS_PX`/`STORM_EYE_ZONE_RADIUS_PX` from `shared-types` for projectile/zone visuals instead of transcribing; refined rule is "never import `game-rules` *logic*". No AC/Task-status change. |
| 2026-07-26 | Implemented against the real codebase architecture (`ability-vfx-config.ts`, not `ability-visuals.ts`) — see Dev Agent Record for the full per-task mapping. Real AC2 fix: `resolveZoneVisual` rebuilt as a three-tier fallback ladder (was missing the effectType-only tier entirely). Added `resolveProjectileAppearance` + projectile body/trail rendering, zone spawn rings, purification-pulse/reward-burst clock unification (`createRingShockwave`/`createParticleBurst`, `Date.now()` only), and a bond-tether restyle. Fixed 2 stale `stormcaller-vfx.test.ts` assertions that encoded pre-AC2 fallback behavior. Typecheck clean (10/10 tsconfigs); full suite 571 passed, 3 pre-existing/unrelated failures. Status: `ready-for-dev` → `review`. Task 10.4's manual Client-UX pass still outstanding (no display in this sandbox, matching established project precedent). |

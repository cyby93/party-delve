---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.5: Stormcaller Ability VFX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want Lightning Arc, Tempest Hurl, Thunder Clap, and Storm Eye to each look and feel distinct,
so that Stormcaller's ranged/control kit reads clearly in combat.

## Acceptance Criteria

1. **Given** the Story 7.1 primitive library exists (`apps/host-client/src/vfx/`, `index.ts:1-19`) and is not yet consumed by any screen, **when** a Stormcaller fires ability index 0 (Lightning Arc), 1 (Tempest Hurl), 2 (Thunder Clap) or 3 (Storm Eye) in the dungeon, **then** each renders a visually distinct effect on the host canvas — a distinct combination of shape, color and motion, not shared with any of the other three — built **only** from the five 7.1 primitives (`createBeam`, `createTrail`, `createRingShockwave`, `createParticleBurst`, `createTintPulse`), with no new bespoke `Graphics` code for basic shapes (7.1 AC3).

2. **Given** each Stormcaller ability has a real hit geometry in the simulation (`ABILITY_HIT_RANGE_PX.stormcaller = [160, 200, 0, 160]`, `ABILITY_HIT_RADIUS_PX.stormcaller = [60, 70, 110, 80]`, `balance.ts:101-113`), **when** an ability's visual is drawn, **then** its dominant on-screen extent matches that geometry — Lightning Arc reaches 160 px along the aim direction and cracks at radius 60; Tempest Hurl travels to 200 px and bursts at radius 70; Thunder Clap's bright ring reaches exactly 110 px around the caster; Storm Eye's cast lands on the zone at `caster + dir * 160` with the zone's real 150 px radius — **and** no visual overstates its reach in a way that would mislead a player about where the ability actually hits.

3. **Given** Storm Eye is the game's only `'zone'`-delivery ability (`balance.ts:124` `ABILITY_DELIVERY`, `GameRoom.ts:2103-2129`), placing a `ZoneState` that ticks every `tickIntervalMs` (500 ms) for 5000 ms, **when** that zone is alive on the host canvas, **then** a periodic pulse plays at the zone's real cadence, visibly distinct from a static circle, so its "still active, still ticking" state reads with no HUD element — **and** the pulse cadence is derived **per frame from the snapshot** (`ZoneState.expiresAtMs` + `ZoneState.tickIntervalMs`), not from transient deltas, so it survives host reconnect/late-join and is immune to the `latestTransientDelta` single-value batching limitation.

4. **Given** the pulse can fire twice per second per zone and Lightning Arc is an AUTO ability on a 1000 ms cooldown, **when** up to four Stormcallers are in a session, **then** the concurrent live effect count stays bounded by an explicit, stated invariant — **at most one live pulse handle per zone id at any time** (a newly triggered pulse cancels its predecessor via `VfxEngine.remove`) — and the worst-case concurrent handle count is documented in the Completion Notes so D-7.1-D can be closed or re-deferred with evidence rather than a guess.

5. **Given** `DungeonScreen.tsx` today draws every zone with one hardcoded shape (`:329`, `g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })`) and Story 7.8 owns replacing that with per-ability zone rendering, **when** this story ships, **then** Storm Eye's zone appearance is expressed as a **shared exported config** (`STORM_EYE_ZONE_VISUAL`) plus a single seam helper (`resolveZoneVisual`) whose default branch reproduces today's exact purple-at-0.25 output for every non-Storm-Eye zone — so 7.8's work is adding cases to that helper, not rewriting this story's code, **and** no `ZoneState` schema field is added (identity is derived from `ownerId → player.class` + `effectType`).

6. **Given** `DungeonScreen.tsx` has never consumed the VFX engine (7.1 AC3 deliberately left it unwired), **when** this story ships, **then** it performs the one-time `VfxEngine` setup — construct in `initPixi`, `update(Date.now())` once per ticker frame after `renderFrame`, `clear()` on unmount — each step **guarded by "if not already present"** so that landing after any other 7.2–7.8 story neither duplicates the engine nor double-updates it.

7. **Given** the existing host behaviors listed in Dev Notes → "Must Not Regress", **when** this story ships, **then** all of them still work: frozen-player 0.3 alpha disconnect cue, down/spirit body sprite at `bodyX/bodyY`, spirit-form glow, enemy kill fade, floating damage numbers, bond tethers, purification pulse + background swap + reward reveal, revive timer overlay, boss HP bar and phase visuals, and the generic `ABILITY_FLASH_MS` cast flash for **non-Stormcaller** classes.

8. **Given** the project convention that non-trivial logic gets one runnable check, **when** this story ships, **then** the pure delta→visual-plan mapping and the pure tick-cadence math are exported as plain functions with no PixiJS dependency and covered by one test file (`apps/host-client/src/vfx/ability-visuals.test.ts`), and `npm run typecheck` at repo root passes.

## Tasks / Subtasks

- [x] **Task 1: One-time `VfxEngine` wiring in `DungeonScreen.tsx` (AC: 6)** — ALREADY PRESENT (a prior 7.x story wired it); guarded and reused, not duplicated.
  - [x] 1.1: **Guard every step.** `vfxEngineRef` and `from '../vfx'` already exist (wired by 7.2/7.3/7.4). Reused the existing ref; skipped 1.2–1.6.
  - [x] 1.2: Import block already present (`DungeonScreen.tsx:7-43`). Appended only the Stormcaller symbols to it.
  - [x] 1.3: `vfxEngineRef` already declared (`:638`).
  - [x] 1.4: Engine already constructed in `initPixi` (`:691`, `new VfxEngine(app.stage)`).
  - [x] 1.5: `vfxEngineRef.current?.update(Date.now())` already in the ticker after `renderFrame` (`:726`). CLOCK CONTRACT honored: every Stormcaller timestamp uses `Date.now()`.
  - [x] 1.6: `vfxEngineRef.current?.clear()` already in cleanup (`:801`). Added `stormEyePulseRef.current.clear()` + `hurlFlightsRef.current = []` alongside the other Task 3/4 refs.
  - [x] 1.7: **Did not extend `renderFrame`'s parameter list.** New per-frame work (Storm Eye pulse, Hurl flight advance) rides in the existing `VfxContext` object (the same seam 7.3/7.4 used), not a 10th positional param.

- [x] **Task 2: pure, PixiJS-free mapping layer (AC: 1, 2, 3, 5, 8)** — see ARCHITECTURE NOTE in Completion Notes: implemented as `stormcaller-vfx.ts` (cast + cadence) and `ability-vfx-config.ts` (zone seam), matching the real 7.2–7.4 architecture, not the story's imagined `ability-visuals.ts`.
  - [x] 2.1: Storm palette as named constants — `STORMCALLER_PALETTE` in `ability-vfx-config.ts`, re-exported as `STORM_CORE/BOLT/CHARGE/SLATE` from `stormcaller-vfx.ts`. No inline magic hex.
  - [x] 2.2: **Update — Story 7.9 / ADR-0003:** the hit geometry now lives in the shared **ability presentation contract** in `shared-types`. **Import** `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY`, and `STORM_EYE_ZONE_RADIUS_PX` from `shared-types` and derive the Stormcaller slices (`ABILITY_HIT_RANGE_PX.stormcaller` = `[160, 200, 0, 160]`, `ABILITY_HIT_RADIUS_PX.stormcaller` = `[60, 70, 110, 80]`, `STORM_EYE_ZONE_RADIUS_PX` = 150) from it — **do not** re-declare them as local literals (that is the transcription drift 7.9 removed). Only genuinely cosmetic constants stay local. (The original "declare locally, never import game-rules" instruction is superseded: the host still never imports `game-rules` *logic*, but the shared spatial contract in `shared-types` is importable.) — DONE: `STORMCALLER_RANGE`/`STORMCALLER_RADIUS` derived from `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`, `STORM_EYE_ZONE_RADIUS_PX` imported.
  - [x] 2.3: `export function resolveStormcallerCast(abilityIndex: number, x: number, y: number, dirX: number, dirY: number): StormcallerCastPlan | null` — the testable pure mapping function. Returns a plain data description (arrays of beam/ring/burst/flight specs, see Dev Notes table). Rules:
        - `abilityIndex` outside 0..3 → `null`.
        - Normalize the direction: `mag = Math.hypot(dirX, dirY)`. For indices **0, 1, 3** (directional), `mag === 0` → `null`, matching the sim's own `if (mag === 0) continue` (`GameRoom.ts:2104-2105`).
        - Index **2** (Thunder Clap, `HIT_RANGE = 0`, self-centred) must **tolerate** a zero direction and still return a plan.
        - Endpoint math: `endX = x + (dirX/mag) * STORMCALLER_RANGE_PX[abilityIndex]`, same for `endY`.
  - [x] 2.4: `export function stormEyeTickCadence(now: number, expiresAtMs: number, tickIntervalMs: number): { ticksRemaining: number; phase: number } | null` — the snapshot-derived cadence (AC3). Rules:
        - `tickIntervalMs <= 0`, non-finite inputs, or `now >= expiresAtMs` → `null`.
        - `remaining = expiresAtMs - now`; `ticksRemaining = Math.ceil(remaining / tickIntervalMs)` (monotonically **decreasing** while the zone lives — its decrement is the pulse trigger); `phase = 1 - ((remaining % tickIntervalMs) / tickIntervalMs)` (0 just after a tick → 1 at the next tick).
        - Counting **backwards from expiry** deliberately avoids needing a duration constant and stays correct if the sim's 5000 ms duration ever changes. See Dev Notes → "Why backwards from expiry". — DONE. `phase` implemented as `ceil(q) - q` (= the spec's `1 - (r%t)/t` off-boundary, resolving the exact boundary to 0 so it stays half-open `[0,1)` — see Completion Notes).
  - [x] 2.5: `export const STORM_EYE_ZONE_VISUAL` — in `ability-vfx-config.ts` (the PixiJS-free 7.8-seam module, alongside the existing `ZONE_APPEARANCE`). Fill/rim/pulse as suggested.
  - [x] 2.6: `export function resolveZoneVisual(zone, players): ZoneVisual` — Storm Eye case requires both `effectType === 'damage'` AND owner class `STORMCALLER`; default reproduces `{ fillColor: 0x9b59b6, fillAlpha: 0.25 }` (no rim); owner-not-found → default, no throw.
  - [x] 2.7: `export function isStormEyeZone(zone, players): boolean` — the single identity-derivation point. No `ZoneState` schema field added.

- [x] **Task 3: `apps/host-client/src/vfx/stormcaller-vfx.ts` — thin primitive binders (AC: 1, 2, 3, 4)**
  - [x] 3.1: `export function spawnStormcallerCast(engine: VfxEngine, plan: StormcallerCastPlan, now: number): HurlFlight | null` — walks the plan and calls the corresponding 7.1 factory for each entry, **passing `now` as each factory's `startedAt`** (not omitting it — see the BACKGROUNDED-TICKER note in Task 4.1). Layer order matters: push the wide dim glow beam **before** the narrow bright core beam so the core draws on top (`VfxEngine.add` appends to the stage in call order, `engine.ts`).
  - [x] 3.2: Tempest Hurl flight: `spawnStormcallerCast` returns a `HurlFlight` record (the `TrailHandle` + flight params) for the caller to register; `advanceHurlFlights` drives moveTo + landing from the ticker's `Date.now()`. **No `setTimeout`.**
  - [x] 3.3: `export function spawnStormEyePulse(engine, zone, now): number` — one `createRingShockwave` sized to `zone.radius`; returns the effect id for the one-live-pulse invariant.
  - [x] 3.4: `export function spawnStormEyeStrike(engine, x, y, now): void` — the `zone:strike` accent; `now` (Date.now() at trigger) threaded as `startedAt`.
  - [x] 3.5: Exported from `apps/host-client/src/vfx/index.ts` (appended; existing exports untouched).

- [x] **Task 4: `DungeonScreen.tsx` cast + flight wiring (AC: 1, 2, 6, 7)**
  - [x] 4.1: In the transient-delta effect, extended the `ability:fired` branch with a `caster.class === STORMCALLER` case (mirrors the SPIRITCALLER/SOULDRINKER branches). Null plan → SILENT (no VFX, no flash); player-not-found → falls through to the generic flash. See:
        ```
        const player = gameState?.players.find(p => p.id === latestTransientDelta.playerId);
        if (player?.class === PlayerClass.STORMCALLER && vfxEngineRef.current) {
          const triggeredAt = Date.now();
          const plan = resolveStormcallerCast(latestTransientDelta.abilityIndex, player.x, player.y,
                                              latestTransientDelta.directionX, latestTransientDelta.directionY);
          if (plan) { /* spawnStormcallerCast(vfxEngineRef.current, plan, triggeredAt); register any flight */ }
        } else {
          const entry = playerGraphicsRef.current.get(latestTransientDelta.playerId);
          if (entry) entry.flashUntil = Date.now() + ABILITY_FLASH_MS;
        }
        ```
        - **Player-not-found is normal** (late join / reconnect race) — fall through to the existing generic flash, never throw.
        - **Suppress the generic `ABILITY_FLASH_MS` flash for Stormcaller only.** The epic's intent (7.2 AC: "none of the four fall back to the shared flat-flash treatment from `ABILITY_FLASH_MS`") applies here too; scoping the suppression to one class keeps 7.2/7.3/7.4's classes byte-identical. If `plan` is `null` (zero aim direction on a directional ability — Lightning Arc / Tempest Hurl / Storm Eye), the sim skipped the hit (`GameRoom.ts:2203`), so render **nothing — no effect and no flash** (SILENT rule, user decision 2026-07-23; matches Story 7.2's Avalanche). Do **not** fall back to the generic flash. Thunder Clap (idx 2, self-centred, `hitRange 0`) always returns a plan, so it is never silent. **Player-not-found** (a different absence — late join / reconnect race, not a skipped cast) still falls through to the existing generic flash, never throws.
        - `spirit-ability:fired` (`:554-556`) is a **different** delta and stays untouched.
        - **BACKGROUNDED-TICKER rule (from Story 7.2's code review, 2026-07-22).** This branch runs in the transient-delta `useEffect`, which is **not** `requestAnimationFrame`-gated, while `VfxEngine.update()` runs in the ticker, which the browser stops for a hidden/minimised host tab. Capture `triggeredAt = Date.now()` **at trigger** and pass it as `spawnStormcallerCast`'s `now` (which threads it into each factory's `startedAt`, Task 3.1), so a cast added while the tab is backgrounded self-expires on resume instead of piling up un-started with every other queued cast and firing them all in one frame. The same applies to `spawnStormEyeStrike` (Task 6.3, a `zone:strike` delta). Effects driven from *inside* the ticker — the Tempest Hurl trail (`moveTo`, Task 4.3) and the Storm Eye pulse (Task 5) — are already ticker-gated and correctly use the ticker's own `now`.
  - [x] 4.2: `PlayerClass` already imported (`:4`); caster resolved via `gameState.players.find` since `ability:fired` carries no class.
  - [x] 4.3: `hurlFlightsRef` added. The advance runs inside `renderFrame` (via `advanceHurlFlights(vfxEngine, vfxRefs.hurlFlights, now)`) rather than literally in the ticker body — the same `vfxRefs`-threaded per-frame seam 7.3/7.4 use — computing clamped `t`, guarding `trail.disposed`, and splicing on landing. Behaviorally identical to the ticker placement (renderFrame IS the ticker callback's per-frame body).
  - [x] 4.4: `hurlFlightsRef.current = []` cleared in unmount cleanup.

- [x] **Task 5: Storm Eye zone pulse — the AC-satisfying tick indicator (AC: 3, 4, 5)**
  - [x] 5.1: `stormEyePulseRef` added; threaded into `VfxContext` as `stormEyePulse`.
  - [x] 5.2: Implemented inside `renderFrame` (in the engine-guarded block, iterating `state.zones` — same per-frame seam as the Spiritcaller soul-mend/shield indicators, which are the direct analogues). First-sighting records without pulsing; each `ticksRemaining` decrement does `remove`-before-`add` (AC4's one-live-pulse-per-zone invariant); missing zone ids are pruned (removing the live pulse first). Details:
        - Skip zones where `resolveZoneVisual(...)`/`isStormEyeZone(...)` says it isn't Storm Eye.
        - `const cadence = stormEyeTickCadence(now, zone.expiresAtMs, zone.tickIntervalMs); if (!cadence) continue;`
        - First sighting of a zone id → record `ticksRemaining` with `effectId: -1` and **do not** pulse (avoids a spurious pulse on reconnect the instant the zone appears mid-life).
        - When `cadence.ticksRemaining < prev.ticksRemaining` → a tick boundary was crossed: `if (prev.effectId >= 0) engine.remove(prev.effectId);` then `prev.effectId = spawnStormEyePulse(engine, zone, now);` — **this `remove`-before-`add` is AC4's concrete invariant: at most one live pulse handle per zone id.**
        - Prune map entries whose zone id is no longer in `state.zones` (`engine.remove` the live pulse first) — same create-on-first-seen / cleanup-on-missing shape as every other Map in this file. — DONE.
  - [x] 5.3: Wire the zone *appearance* through the seam helper. **Preferred (seam-safe):** replace `DungeonScreen.tsx:329`'s literal with `const v = resolveZoneVisual(zone, state.players); g.circle(0, 0, zone.radius).fill({ color: v.fillColor, alpha: v.fillAlpha }); if (v.rimColor !== undefined) g.circle(0, 0, zone.radius).stroke({ color: v.rimColor, width: v.rimWidth, alpha: v.rimAlpha });`
        - This requires passing `state.players` into that block — it is already in scope inside `renderFrame` as `state.players` (`:102`). **No new `renderFrame` parameter.**
        - **If `resolveZoneVisual` already exists** because 7.8 landed first: add/confirm the Storm Eye case inside it and leave the call site alone.
        - The pulse itself (5.2) is a `VfxEngine` effect layered above and does **not** touch line 329, so even the minimal variant (leave `:329` untouched, ship only the pulse) satisfies AC3. Prefer the seam-safe variant; fall back to the minimal one only if the call site turns out to conflict with in-flight work. — Shipped the **seam-safe** variant: the zone-body draw now calls `resolveZoneVisual(zone, state.players)` (already in scope in `renderFrame`), no new `renderFrame` parameter.
  - [x] 5.4: Cast-moment visual for Storm Eye (index 3) comes from Task 4.1's normal `ability:fired` path — the plan places its implode ring and sky-bolt at `caster + dir * 160`, which is exactly where the sim places the zone (`GameRoom.ts:2108-2110`).

- [x] **Task 6: Optional `zone:strike` accent + the whitelist edit (AC: 3, 4)** — implemented (decorative; AC3 is fully met without it by Task 5's pulse).
  - [x] 6.1: `host-session.ts` whitelist — added `delta.type === 'zone:strike'` only. `zone:tick` deliberately NOT added.
  - [x] 6.2: Host-local delivery filtering, **not** a contract change — `applyDelta` already handles `zone:strike` (`apply-delta.ts:258`), so mirror state is unchanged and no schema/message shape changes. Contract-change hook NOT triggered (see Completion Notes).
  - [x] 6.3: New `zone:strike` branch in the transient-delta effect resolves `targetId` against `gameState.enemies` first, then `gameState.boss?.id` (boss uses `boss.position`), and calls `spawnStormEyeStrike(engine, target.x, target.y, Date.now())`. Target-not-found → silently skipped.
  - [x] 6.4: **This accent is not the AC3 path** and must not be the only tick indicator. It is decorative: `latestTransientDelta` is a single React state value cleared after 400 ms (`App.tsx:20,42-48`), React 18 auto-batches, so two strikes in one task collapse and only the last survives; and a host that reconnects mid-zone sees nothing until the next strike. Task 5's snapshot-derived pulse is what satisfies AC3. If wiring 6.1–6.3 turns out to be noisy in playtest, dropping this task entirely still leaves AC3 met — record that decision if taken.

- [x] **Task 7: Test the pure mapping + cadence functions (AC: 8)**
  - [x] 7.1: New `apps/host-client/src/vfx/stormcaller-vfx.test.ts` (named for the module, per the real `<class>-vfx.test.ts` convention; the story's `ability-visuals.test.ts` name was superseded — see ARCHITECTURE NOTE). 14 tests, all pass; the tested functions import no PixiJS.
  - [x] 7.2: `resolveStormcallerCast` cases: (a) each of indices 0–3 returns a plan whose primitive-kind/color signature differs from the other three (the AC1 "distinct" assertion, made mechanical); (b) index 0 with `dir = (1, 0)` from `(100, 100)` puts the beam endpoint at `(260, 100)` and the impact ring at `maxRadius: 60`; (c) index 1's flight range is 200 and its impact ring is 70; (d) index 2 returns a plan with `dir = (0, 0)` and its bright ring is `maxRadius: 110`; (e) index 3 with `dir = (0, 1)` places its implode ring at `(x, y + 160)` with `maxRadius: 150`; (f) indices 0/1/3 with `dir = (0, 0)` return `null`; (g) index `-1` and `4` return `null`; (h) a non-normalized direction like `(3, 4)` produces the same endpoint as `(0.6, 0.8)`.
  - [x] 7.3: `stormEyeTickCadence` cases — decreases by exactly 1 across a 500 ms step; monotonically non-increasing across the 5000 ms/100 ms sweep with **9** observed decrements (the 10th tick lands at expiry, where cadence returns `null` — documented in-test, honest correction of the story's "10"); `phase` stays in `[0, 1)`; `tickIntervalMs = 0`/negative, `NaN` inputs, and `now >= expiresAtMs` all return `null`.
  - [x] 7.4: `resolveZoneVisual` cases — `'damage'`/Stormcaller → `STORM_EYE_ZONE_VISUAL`; `'pull'`/Souldrinker → default; `'damage'`/owner-absent → default (no throw); default `fillColor`/`fillAlpha` exactly `0x9b59b6`/`0.25`.

- [x] **Task 8: Self-check (non-negotiable per project convention)**
  - [x] 8.1: `npm run typecheck` at repo root — exit 0 (all 10 tsconfigs clean).
  - [x] 8.2: `cd apps/host-client && npx vitest run src/vfx/` — new 14 + 7.1's 24 + Spiritcaller/Souldrinker all pass. **One PRE-EXISTING failure unrelated to this story:** `ability-vfx.test.ts` "centres Stone Wall … on the caster" — reproduces byte-identically on the clean baseline with this story stashed (geometry drift: `ABILITY_HIT_RANGE_PX.stonehide[0]` is now 160, not the 0 that 7.2's test expects). Not this story's code, not fixed (blocked path `shared-types` + 7.2's territory). See Completion Notes.
  - [ ] 8.3: **Client-UX hook checks — NOT RUN.** These require a running host + live gameplay; this environment is non-interactive with no host process. Honestly deferred to the reviewer/human playtest (this is exactly what "review" status is for). The automated distinctness/geometry assertions (Task 7) cover AC1/AC2's machine-checkable core; the must-not-regress paths (AC7) are preserved structurally (only an additive `else if` branch + a seam-safe zone default that reproduces today's output).
  - [x] 8.4: Worst-case concurrent effect count documented in Completion Notes (D-7.1-D re-deferred with the analytical bound). **Live `engine.size` measurement not taken** (no running host) — the bound is the Dev Notes derivation (~25 concurrent handles), which AC4 accepts as evidence "rather than a guess"; the one-live-pulse-per-zone invariant hard-caps the only per-tick trigger.

### Review Findings

Adversarial code review 2026-07-24 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 10 raised → 1 patch, 1 defer, 8 dismissed. No High/Medium survived confirmation.

- [x] [Review][Patch] Storm Eye pulse could latch and stop firing on a backward host-clock step [`apps/host-client/src/screens/DungeonScreen.tsx`] — `prev.ticksRemaining` was re-baselined only inside the decrement branch, so an increase in observed `ticksRemaining` (NTP/host clock correction; `Date.now()` is not monotonic) left the baseline stale-high and suppressed pulses for several ticks until it decremented back. Fixed: pulse still fires only on a genuine decrease, but the baseline is now re-set every frame so it cannot latch. (APPLIED)
- [x] [Review][Defer] `isStormEyeZone` matches any Stormcaller `'damage'` zone, not specifically Storm Eye [`apps/host-client/src/vfx/ability-vfx-config.ts`] — deferred: full disambiguation needs a `ZoneState` schema field (blocked path `shared-types`, and Epic 7 non-goals forbid protocol/schema changes). Today `'damage'` is only ever Storm Eye; the class+effectType guard is correct for the shipped game and the code comment is the disambiguator of record.

Dismissed as noise/confirmed-safe (8): `engine.remove(staleId)` is a guarded no-op (`nextId` monotonic, never reused); no clock mismatch (`renderFrame` and every trigger use `Date.now()`); the Tempest Hurl trail is fed every frame so there is no pre-impact gap; `createRingShockwave` clamps radius so the implode rings are supported; `zone:strike` enemy/boss position shapes are correct (no NaN); the expiry-coincident tick is intentionally un-pulsed (documented 9-pulse cadence); `advanceHurlFlights` being state-gated yields at worst one rare cosmetic late-impact with no leak; AC8's pure math shares a PixiJS-importing module by the same shipped 7.3/7.4 convention (functions are genuinely pure, one test file, typecheck green).

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping (inserted by `sprint-change-proposal-2026-07-21.md`; epic body `epics.md:1904-1908`, this story `epics.md:1990-2001`, epic non-goals `epics.md:2061`).
- **Context:** Every Stormcaller ability currently produces the same output: a 300 ms cosine alpha flash on the caster's circle (`DungeonScreen.tsx:551-553` → `:131-133,142-144`). Storm Eye additionally leaves a flat purple circle (`:329`) that gives no sign it is still ticking. This story gives all four a distinct identity and gives the zone a heartbeat.
- **Goal:** Four distinct, primitive-composed cast visuals for Stormcaller, plus a snapshot-derived per-tick pulse for the Storm Eye zone, plus the one-time `VfxEngine` wiring into `DungeonScreen.tsx` if this story lands first.
- **Allowed paths:**
  - `apps/host-client/src/vfx/**` (new: `ability-visuals.ts`, `stormcaller-vfx.ts`, `ability-visuals.test.ts`; modified: `index.ts`)
  - `apps/host-client/src/screens/DungeonScreen.tsx`
  - `apps/host-client/src/session/host-session.ts` (**one whitelist line only**, Task 6.1)
  - `_bmad-output/implementation-artifacts/7-5-stormcaller-ability-vfx.md` (this file's Dev Agent Record)
  - `_bmad-output/implementation-artifacts/deferred-work.md` (only if D-7.1-D's disposition changes)
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**` (including *importing* it — see Project Context Rules), `packages/shared-types/**`, `packages/net-protocol/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`, `packages/telemetry/**`, `tests/**`, `apps/host-client/src/vfx/{types,primitives,engine}.ts` (7.1's shipped API — consume it; only extend it if a needed shape genuinely cannot be expressed, and say so loudly), `_bmad-output/implementation-artifacts/sprint-status.yaml` (owned by the sprint workflow, not this story).
- **Inputs:** `epics.md:1990-2001`; `apps/host-client/src/vfx/{index,types,primitives,engine}.ts`; `apps/host-client/src/screens/DungeonScreen.tsx`; `apps/host-client/src/session/host-session.ts`; `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`; `3-20-stormcaller-storm-eye-rework.md`; `3-13-projectile-physics-and-zone-field-entities.md`; `DESIGN.md` color tokens; `_bmad-output/project-context.md`.
- **Non-goals (Epic 7, `epics.md:2061`):** no final pixel-art sprites (the PixelLab pass stays untouched); no new abilities or mechanics; no protocol/schema changes. Additionally for this story: no changes to the other three classes' visuals (7.2/7.3/7.4), no boss VFX (7.7), no status-effect VFX (7.6), no projectile rendering change (7.8 — and Stormcaller spawns **no projectiles anyway**, see "Hitscan despite the name"), no rewrite of `App.tsx`'s `latestTransientDelta` plumbing.
- **Ownership check:** Single area — `apps/host-client/**`, Host Experience Engineer. `host-session.ts` is inside that area. **No task splitting required.**
- **Hook verdicts:**
  - **Client-UX hook — TRIGGERED.** This story actually renders (unlike 7.1). Full checks in Task 8.3. Host checks apply; mobile checks are N/A (no `apps/mobile-controller/**` change).
  - **Contract-change hook — NOT triggered.** No `packages/shared-types/**` or `packages/net-protocol/**` change; no session-lifecycle, reconnect-flow, room-state, join-flow, prediction/reconciliation/interpolation surface touched. **The `host-session.ts` whitelist edit is explicitly not a contract change:** it is host-local *delivery filtering* over deltas the wire protocol already defines (`server-to-host.ts:259-266`) and the shared reducer already handles (`apply-delta.ts:258`). No message shape, no field, no compatibility rule changes; a host that does not forward `zone:strike` and one that does interpret the identical byte stream identically. Same precedent as the `dev-5-boss-transient-delta-whitelist-fix` change, which was likewise treated as host-local.
  - **Simulation-safety hook — NOT triggered.** No `apps/simulation-server/**` or `packages/game-rules/**` change.
  - **Telemetry hook — N/A.** No new user flow; this is a visual treatment of an existing flow (ability cast → hit resolution), with no new event, trigger or KPI.

### Storm Palette

Stormcaller's kit is storm-blue and white-hot, staying inside the Raw Earth / Spirit Chant system (`DESIGN.md:11-23,146-227`) and deliberately **not** appropriating two reserved tokens: `accent-purify` `0x90d8f0` (exclusively the purification pulse / boss defeat, `DESIGN.md:200`) and `accent-spirit` `0x6ea8d8` in its bond/spirit-form role (`DESIGN.md:17,182`). Declare these in `ability-visuals.ts`; use nowhere else as literals.

| Constant | Hex | Role |
|---|---|---|
| `STORM_CORE` | `0xeaf2ff` | White-hot filament — the bright inner line of every bolt, the leading edge of the clap |
| `STORM_BOLT` | `0x8fb8ff` | Electric blue — bolt glow, arc impact, Storm Eye tick pulse |
| `STORM_CHARGE` | `0xb9a3ff` | Violet charge — the heavier, slower cooldown abilities (Tempest Hurl impact, Thunder Clap halo, Storm Eye implode). Distinct from `accent-corruption` `0x7d2dff` (the boss fill) and from today's zone purple `0x9b59b6` |
| `STORM_SLATE` | `0x3d4a6b` | Dark storm slate — the Storm Eye zone's body fill, so the zone reads as a weather cell rather than a generic purple disc |

**Colors are PixiJS `number` literals (`0xrrggbb`)** in canvas code, never CSS strings — CSS hex only appears in the React/HTML overlay parts of `DungeonScreen.tsx` (e.g. `:928`).

### Per-Ability Visual Spec

All coordinates are in the 1920×1080 virtual space (`VIRTUAL_W/H`, `:27-28`; `app.stage.scale` is set each frame at `:97`). `(px, py)` = caster position; `(nx, ny)` = normalized aim direction; `end = (px + nx*R, py + ny*R)` with `R` the ability's real `ABILITY_HIT_RANGE_PX`.

#### Index 0 — Lightning Arc (AUTO, 1000 ms CD, 18 dmg, hitscan, range 160, radius 60)

Instantaneous, thin, bright, cheap. Three handles.

| # | Primitive | Parameters |
|---|---|---|
| 1 | `createBeam` (glow, added **first** so it sits under the core) | `{ x: px, y: py, toX: end.x, toY: end.y, color: STORM_BOLT, width: 9, alpha: 0.45, durationMs: 200 }` |
| 2 | `createBeam` (core) | `{ x: px, y: py, toX: end.x, toY: end.y, color: STORM_CORE, width: 3, alpha: 1, durationMs: 140 }` |
| 3 | `createRingShockwave` (crack at the hit circle) | `{ x: end.x, y: end.y, color: STORM_BOLT, maxRadius: 60, startRadius: 12, lineWidth: 3, alpha: 0.9, durationMs: 220 }` |

- `createBeam`'s **local-space semantics**: it sets `view.position = (x, y)` and draws `moveTo(0,0).lineTo(toX - x, toY - y)` once at construction, animating only `alpha` (`primitives.ts:246-273`). Passing world coordinates for **both** endpoints is therefore correct and is the intended usage — the primitive does the world→local subtraction itself. Do **not** pre-subtract; that would double the offset (the exact bug 7.1's review fixed).
- The beam is a straight two-point line — there is no jagged/forked-bolt primitive and **you must not hand-roll one** (7.1 AC3). The fork read comes from the two-layer glow+core stack, not from geometry. If a forked bolt is later judged necessary, extend `vfx/primitives.ts` with a *parameterized* polyline primitive rather than inlining a one-off — and say so explicitly in the Completion Notes.
- `maxRadius: 60` is the ability's real `ABILITY_HIT_RADIUS_PX.stormcaller[0]` — AC2's honesty requirement.

#### Index 1 — Tempest Hurl (RELEASE, 3000 ms CD, 40 dmg, hitscan, range 200, radius 70)

Must read as **thrown** even though the sim resolves it in the same tick and **no `ProjectileState` exists** for it (`ABILITY_DELIVERY`, `balance.ts:124` — only Blood Spike and Void Pulse are `'projectile'`). The travel is a pure host-side flourish over an already-resolved hit; keep it short so the visual does not lag the damage numbers.

| Phase | Primitive | Parameters |
|---|---|---|
| Launch (t=0) | `createParticleBurst` | `{ x: px, y: py, color: [STORM_CHARGE, STORM_BOLT], count: 7, particleRadius: 4, speed: 0.10, spread: 0.9, durationMs: 200 }` |
| Flight (0 → `TEMPEST_HURL_FLIGHT_MS = 170`) | `createTrail` + per-frame `moveTo` | `{ x: px, y: py, color: STORM_BOLT, width: 11, pointCount: 10, alpha: 0.9, durationMs: 160 }` |
| Impact (t=1) | `createRingShockwave` | `{ x: end.x, y: end.y, color: STORM_CHARGE, maxRadius: 70, startRadius: 18, lineWidth: 5, alpha: 0.95, durationMs: 300 }` |
| Impact (t=1) | `createParticleBurst` | `{ x: end.x, y: end.y, color: [STORM_CORE, STORM_CHARGE], count: 12, particleRadius: 6, speed: 0.18, spread: 0.6, durationMs: 320 }` |

- **`createTrail` keep-alive contract:** the trail expires point-by-point unless `moveTo(x, y, now)` keeps being called, and completes when its last point ages out (`primitives.ts:113-184`). Call `moveTo` every ticker frame for the flight window, then stop — the tail then fades on its own over the remaining `durationMs`. **Check `trail.disposed` before every `moveTo`** (`primitives.ts:98-99`); pushing into a reaped trail is a silent write into a destroyed `Graphics`.
- `moveTo`'s `now` **must be the same `Date.now()`** the ticker passes to `engine.update` (CLOCK CONTRACT).
- `createParticleBurst` distributes particles over the **full 2π** (`primitives.ts:58`) — it is not directional. That is why the launch burst is small and slow (it reads as a release puff at the caster) and the directional read comes from the trail, not the burst.
- Distinct silhouette vs Lightning Arc: Arc is an instant static line; Hurl is a *moving* stroke that resolves into a fat violet ring at nearly 3× the impact area.

#### Index 2 — Thunder Clap (TAP, 5000 ms CD, 45 dmg, self-centred, radius 110 — the largest AoE in the game)

Self-centred at `(px, py)`; direction is irrelevant and may be `(0, 0)`.

| # | Primitive | Parameters |
|---|---|---|
| 1 | `createRingShockwave` (implode — the air collapsing in) | `{ x: px, y: py, color: STORM_BOLT, maxRadius: 24, startRadius: 150, lineWidth: 4, alpha: 0.7, durationMs: 180 }` |
| 2 | `createRingShockwave` (**the honest ring**) | `{ x: px, y: py, color: STORM_CORE, maxRadius: 110, startRadius: 0, lineWidth: 8, alpha: 0.95, durationMs: 260 }` |
| 3 | `createRingShockwave` (halo, atmosphere only) | `{ x: px, y: py, color: STORM_CHARGE, maxRadius: 132, startRadius: 30, lineWidth: 3, alpha: 0.5, durationMs: 420 }` |
| 4 | `createParticleBurst` | `{ x: px, y: py, color: [STORM_CORE, STORM_BOLT, STORM_CHARGE], count: 14, particleRadius: 4, speed: 0.40, spread: 0.9, durationMs: 275 }` |

- The implode is safe: `createRingShockwave` clamps radius at 0, so `maxRadius < startRadius` is a supported implode (`primitives.ts:218-219`, and 7.1's review explicitly fixed the negative-radius case). It runs **concurrently** with ring 2 — TAP has no windup delta to hang a pre-cast on, and the crossing rings read as "collapse then crack", which is the intended distinct signature.
- **AC2 honesty:** the *bright* ring (#2) is exactly 110 px. The halo (#3) overshoots to 132 px at half alpha and is deliberately dim/thin so the eye reads the bright edge as the boundary. Do not brighten #3.
- `speed: 0.40 px/ms × durationMs: 275` ≈ 110 px, matching the hit radius. Note `createParticleBurst` randomizes each particle's speed to 0.7–1.3× (`primitives.ts:59`), so the actual spread is ~77–143 px — intentional fuzz, not a bug.
- **Couch readability:** all three rings are *strokes*, not fills. A filled 110 px disc would hide up to four player circles (`PLAYER_RADIUS = 24`) plus their status badges at `-(radius + 14)` (`:283`). Do not use `filled: true` here.

#### Index 3 — Storm Eye (RELEASE, `zone` delivery, zone radius 150 at `caster + dir*160`, tick 500 ms / 10 dmg, duration 5000 ms, bonus strike every 1500 ms / 30 dmg)

Two separate concerns: the **cast moment** (one-shot, from `ability:fired`) and the **ongoing tick indicator** (per-frame, from the snapshot — the AC3 path).

**Cast moment** — fires at the placement point `end = caster + n * 160`, which is exactly where the sim puts the zone (`GameRoom.ts:2106-2110`):

| # | Primitive | Parameters |
|---|---|---|
| 1 | `createRingShockwave` (implode onto the zone's real footprint) | `{ x: end.x, y: end.y, color: STORM_CHARGE, maxRadius: 150, startRadius: 230, lineWidth: 6, alpha: 0.85, durationMs: 400 }` |
| 2 | `createBeam` (sky-bolt striking down into the zone) | `{ x: end.x, y: end.y - 260, toX: end.x, toY: end.y, color: STORM_CORE, width: 6, alpha: 1, durationMs: 200 }` |
| 3 | `createParticleBurst` (ground impact) | `{ x: end.x, y: end.y, color: [STORM_BOLT, STORM_CORE], count: 10, particleRadius: 5, speed: 0.16, spread: 0.7, durationMs: 300 }` |

The vertical sky-bolt is Storm Eye's motif; the optional `zone:strike` accent (Task 6) reuses the same shape at the struck target, so the two read as the same weather system.

**Ongoing tick indicator (AC3) — snapshot-derived, PRIMARY, this is the AC-satisfying path:**

Per ticker frame, per live Storm Eye zone, `stormEyeTickCadence(now, zone.expiresAtMs, zone.tickIntervalMs)` yields a monotonically decreasing `ticksRemaining`. Each decrement is a tick boundary; on each boundary trigger:

```
createRingShockwave({ x: zone.x, y: zone.y, color: STORM_BOLT,
                      maxRadius: zone.radius, startRadius: zone.radius * 0.35,
                      lineWidth: 4, alpha: 0.7, durationMs: 380 })
```

- **Why this satisfies AC3 and the delta path does not:**
  1. **Immune to the `latestTransientDelta` batching limitation.** `App.tsx:20,42-48` holds *one* delta in React state and clears it after 400 ms; React 18 auto-batches, so two deltas arriving in the same task collapse and only the last is ever seen by `DungeonScreen`'s effect. It is the known reason `boss:stomped` visuals are unreliable. A visual that must fire on *every* 500 ms tick cannot be built on that. Snapshot-derived cadence has no such dependency.
  2. **Survives reconnect and late-join.** A host that reconnects mid-zone receives the zone in the next snapshot with a live `expiresAtMs`, and starts pulsing on the next boundary with zero missed-delta bookkeeping.
  3. **Zero new deltas.** No whitelist entry is required for AC3 at all, keeping the delta channel quiet (see "Why not `zone:tick`").
  4. **Bounded by construction.** `durationMs: 380 < tickIntervalMs: 500`, and the one-live-pulse-per-zone invariant (Task 5.2) makes the bound hard rather than incidental.
- **Why counting backwards from expiry:** `ticksRemaining = Math.ceil((expiresAtMs - now) / tickIntervalMs)` needs no duration constant, so no host-side mirror of `STORM_EYE_DURATION_MS` can drift from balance. Because the sim sets `expiresAtMs = spawnTime + 5000` and `tickIntervalMs = 500` (`GameRoom.ts:2118-2119`, `balance.ts:189-191`) and `5000 % 500 === 0`, the derived boundaries land on the sim's real tick boundaries. If that ratio ever stops being integral, the cadence stays correct-period and only picks up a constant phase offset — a cosmetic shift, not a break. Note this assumption in a code comment.
- **Clock skew:** `expiresAtMs` is server-epoch (`Date.now()` on the sim, `GameRoom.ts:2119`) compared against host `Date.now()`. This file already does exactly this for `player.reviveTimerExpiresAt` (`:674`) and it is the established pattern; in Local Party Mode host and sim are the same machine. Any residual skew shifts the pulse phase, never its period.
- **Secondary/optional accent (`zone:strike`, Task 6):** a bonus strike lands every 1500 ms for 30 damage and emits `zone:strike { zoneId, targetId, damage }` (`GameRoom.ts:1636-1641,1655-1660`). Reusing the sky-bolt (`createBeam` from `target.y - 300` down to the target, `STORM_CORE`, `width: 5`, `durationMs: 220`) plus a small `createRingShockwave` (`maxRadius: 46`, `STORM_BOLT`, `durationMs: 240`) at the target makes the zone's *bonus* beat legible. **Optional, decorative, and not the AC3 path** for the reasons in Task 6.4.
- **Why not `zone:tick`:** it is emitted unconditionally every zone tick for every zone (`GameRoom.ts:1693`) — 2/s per live zone. Because `latestTransientDelta` is a **single value**, forwarding a high-frequency delta actively *displaces* other deltas in the same batch (a `zone:tick` can be the "last one wins" that eats an `enemy:damaged` damage number). `zone:strike` at 1 per 1.5 s is low enough churn to be acceptable; `zone:tick` is not, and it buys nothing that the snapshot cadence does not already provide. **Do not whitelist `zone:tick`.**

### Seam with Story 7.8 — read this before touching zone rendering

7.8 owns replacing `DungeonScreen.tsx:329`'s single hardcoded zone shape with per-ability rendering. This story must not pre-empt or collide with that.

- **The epic's premise for 7.8 is factually wrong.** `epics.md:2054` says zone rendering should be "driven by each `ProjectileState`/`ZoneState` entity's existing `class`/`abilityIndex` fields (added in Story 3.13)". `ProjectileState` does have `class` + `abilityIndex`. **`ZoneState` does not** — it is `{ id, ownerId, x, y, radius, effectType: 'damage' | 'pull', tickIntervalMs, expiresAtMs }`.
- **Do not add schema fields to fix this.** `ZoneState` lives in `packages/shared-types/**` (blocked path, Protocol Architect ownership) and adding a field would trigger the Contract-change hook for a rendering-only story — and Epic 7's non-goals forbid protocol/schema changes (`epics.md:2061`).
- **Derive identity instead:** `ownerId → players.find(p => p.id === zone.ownerId)?.class`, combined with `effectType`. Today the mapping is unambiguous — `'damage'` is only ever Storm Eye (`GameRoom.ts:2117`) and `'pull'` is only ever Souldrinker's Void Pulse chained zone (`GameRoom.ts:1516`). Require **both** signals (class *and* `effectType`) so the helper stays correct if a future class gains a `'damage'` zone.
- **The contract this story hands to 7.8:**
  - `STORM_EYE_ZONE_VISUAL` — the exported appearance config (suggested: `{ fillColor: STORM_SLATE, fillAlpha: 0.22, rimColor: STORM_BOLT, rimWidth: 2, rimAlpha: 0.55, pulseColor: STORM_BOLT, pulseAlpha: 0.7 }`).
  - `resolveZoneVisual(zone, players): ZoneVisual` — one exported function, one Storm Eye case, and a **default branch that reproduces today's exact `0x9b59b6 @ 0.25`** so every other zone is byte-identical to current behavior. 7.8's job becomes *adding a Void Pulse case* to this function, not rewriting the call site.
  - 7.5 owns the Storm Eye case and the default; 7.8 owns adding further cases and the projectile equivalent. **Neither story should restructure the other's half.**
  - **If `resolveZoneVisual` already exists** when this story is implemented (7.8 landed first), add/confirm the Storm Eye case inside it and leave the call site untouched. Guard, don't duplicate — same "if not already present" discipline as the engine wiring.
- The **pulse** (Task 5.2) is a `VfxEngine` effect drawn above the zone and touches no part of line 329, so it is collision-free with 7.8 regardless of ordering.

### Hitscan despite the name

Lightning Arc and Tempest Hurl are **hitscan**, not projectiles — `ABILITY_DELIVERY.stormcaller = ['hitscan', 'hitscan', 'hitscan', 'zone']` (`balance.ts:124`; only Blood Spike and Void Pulse are `'projectile'`). Consequences:

- **No `ProjectileState` ever exists for a Stormcaller ability.** `state.projectiles` will never contain one; the projectile block at `:290-309` is irrelevant to this story and must not be edited here (it is 7.8's).
- The "thrown" read for Tempest Hurl is therefore a **pure host-side flourish**, not a rendering of a simulated body. Keep `TEMPEST_HURL_FLIGHT_MS` short (170 ms) — the damage has already resolved server-side by the time the trail starts, and a long flight would visibly desync the trail from its damage number.
- The epic's own text calls Lightning Arc a "projectile" (`epics.md:1999`) — that is wrong; do not spawn or expect a projectile entity.

### Effect volume — D-7.1-D

`deferred-work.md` D-7.1-D: the `VfxEngine` has **no cap, pooling or back-pressure** on concurrent effects, deferred with "revisit when 7.2–7.8 reveal real effect volumes." This story is one of the two that reveal them. Concrete worst case, four Stormcallers, all abilities on cooldown-perfect rotation:

| Source | Rate | Effect lifetime | Steady-state concurrent |
|---|---|---|---|
| Lightning Arc (3 handles, AUTO 1000 ms CD) | 3/s per player → 12/s | ≤ 220 ms | ≈ 2.6 |
| Tempest Hurl (4 handles + 1 trail, 3000 ms CD) | 1.7/s | ≤ 320 ms | ≈ 0.6 (+ ≤4 live trails) |
| Thunder Clap (4 handles, 5000 ms CD) | 3.2/s | ≤ 420 ms | ≈ 1.4 |
| Storm Eye cast (3 handles, 2000 ms CD) | 6/s | ≤ 400 ms | ≈ 2.4 |
| **Storm Eye tick pulse** | 2/s per live zone | 380 ms | **≤ 1 per zone, hard-capped** |
| Storm Eye zones alive at once (5000 ms life ÷ 2000 ms CD × 4 players) | — | — | ≤ 12 zones ⇒ ≤ 12 pulses |
| `zone:strike` accent (optional, 2 handles) | ≤ 1 per 1.5 s per zone, **further throttled to ≤1 delta per 400 ms by `latestTransientDelta`** | ≤ 240 ms | ≈ 1 |

**Worst-case total ≈ 25 concurrent handles**, each a single `Graphics` or a `Container` with ≤ 14 child `Graphics`. For scale, `renderFrame` already keeps a comparable count of persistent `Graphics` for players, enemies, health bars, badges, tethers, projectiles and zones every frame.

**Concrete bound this story ships (AC4):** the one-live-pulse-per-zone invariant — before triggering a new pulse for a zone id, `engine.remove()` its previous pulse id (Task 5.2). This is the only per-frame/per-tick trigger in the story, and it is the one that could otherwise grow unbounded (a stalled ticker or a low frame rate cannot make it emit more than one live handle per zone).

**Disposition:** with that invariant in place, all remaining triggers are cooldown-gated one-shots with a hard upper bound of ~25 concurrent handles. **Re-defer D-7.1-D** with this measured bound recorded in the Completion Notes — do not build a pooling/back-pressure system in a rendering story. If the manual Client-UX check (Task 8.3) shows frame-time degradation at four Stormcallers, stop and record it as a new deferred item rather than growing this story's scope.

### VFX Engine API — exact usage

From `apps/host-client/src/vfx/index.ts:1-19` (7.1, shipped and tested with 24 passing tests):

- `new VfxEngine(stage)` where `VfxStage = { addChild, removeChild }` — `app.stage` satisfies it structurally (`types.ts:20-24`).
- `engine.add(handle): number` → effect id (adds `handle.view` to the stage when non-null). `engine.update(now): void` once per ticker frame. `engine.remove(id)` for early cancel. `engine.clear()` on teardown. `engine.size` for the concurrent-count measurement in Task 8.4.
- Factories: `createParticleBurst`, `createTrail` (→ `TrailHandle` with `moveTo(x, y, now)` + `disposed`), `createRingShockwave`, `createBeam`, `createTintPulse`.
- **Contracts that must not be violated** (7.1's review closed each of these as a silent-failure mode):
  1. **CLOCK CONTRACT** — no primitive reads a clock. Pass `Date.now()` everywhere in this story, including `TrailHandle.moveTo` (`types.ts:26-34`). 7.1's default captures `startedAt` lazily from the first `update(now)`, but **delta-triggered effects here (the cast in Task 4.1, the strike in Task 6.3) must stamp `startedAt = Date.now()` at trigger** — their `useEffect` is not `requestAnimationFrame`-gated, so a backgrounded tab would otherwise let them pile up un-started (Story 7.2 code review, 2026-07-22; see the BACKGROUNDED-TICKER note in Task 4.1). Ticker-driven effects (Hurl trail, Storm Eye pulse) keep the lazy capture.
  2. **Never allocate a display object per frame** — handles are mutated in place. The Storm Eye pulse must be one handle per tick boundary, **not** one per frame.
  3. **No bespoke `Graphics` for basic shapes** (7.1 AC3). The one sanctioned exception in this story is the existing per-frame zone *body* redraw at `:329` — that is a pre-existing entity redraw in `renderFrame`, not a new effect, and time-boxed `EffectHandle` primitives cannot express a persistent entity shape. Everything transient goes through a primitive.
  4. **Rendering only** — no cooldown tracking, no collision, no game-rule evaluation inside the host (project-context.md, "PixiJS Host Renderer"). The host reads what the sim already decided; the hit-geometry numbers here are *authoring-time visual sizing*, not gameplay logic.
- Other known 7.1 deferrals to stay clear of: **D-7.1-A** engine reentrancy (never call `add`/`remove`/`clear` from inside an effect's own `update` — this story never does; all triggers are in the ticker/delta handler); **D-7.1-B** adding the same handle twice yields two ids and a double dispose (create a fresh handle per trigger — never cache and re-add one); **D-7.1-C** no detection of an externally destroyed `view`/`target`.

### `DungeonScreen.tsx` — structure and behaviors that must not regress

Read the whole file (1056 lines) before editing. Relevant structure:

- `renderFrame(state, app, …9 Maps)` at `:84-360` — per-frame redraw. `const now = Date.now()` at `:99`. Sections: Players `:101-175`, Enemies `:177-232`, Bond tethers `:234-256`, Status badges `:258-288`, Projectiles `:290-309`, **Zones `:311-330`**, Essence flashes `:332-345`, Damage numbers `:347-359`. Every section uses create-on-first-seen / cleanup-on-missing over a `Map`. **Do not add a 10th positional parameter** (Task 1.7).
- Ticker callback `:418-499` — `renderFrame`, then the boss sprite `:436-460`, purification pulse `:462-479` (`performance.now()`), reward particles `:481-498` (`performance.now()`). New VFX per-frame work goes here, on `Date.now()`.
- Transient-delta effect `:537-623` — `useEffect` on `[latestTransientDelta]` with an if/else-if chain. Existing branches: `bond:assigned`, `level:complete`, `ability:fired`, `spirit-ability:fired`, `enemy:killed`, `enemy:damaged`, `essence:dropped`, `boss:phaseChanged`, `boss:damaged`, `boss:stomped`, `boss:defeated`.
- Cleanup `:502-525` — clear every new engine/Map/array here.
- `addChildAt(g, 0)` is the "draw below sprites" idiom (bond tethers `:246`, zones `:324`). `VfxEngine` uses plain `addChild`, so effects draw **above** entity sprites — correct for bolts and rings, and the reason all Thunder Clap rings are strokes (Couch readability).
- Constants `:25-44`: `PLAYER_RADIUS=24`, `ENEMY_RADIUS=20`, `VIRTUAL_W=1920`, `VIRTUAL_H=1080`, `ABILITY_FLASH_MS=300`, `SPIRIT_ABILITY_FLASH_MS=200`, `KILL_FADE_MS=300`, `ESSENCE_FLASH_MS=400`, `STATUS_BADGE_RADIUS=6`.

**Must not regress (AC7):** ability cast flash for non-Stormcaller classes (`:131-133,142-144,551-553`); spirit-form glow (`:129-135`); the `isDown`/`isSpirit` body sprite at `bodyX/bodyY` (Story 3.21c, `:148-174`); frozen-player 0.3 alpha disconnect cue (`:144`) and its 0.15/0.4 down+frozen variant (`:167-168`); enemy kill fade (`:194-209`); floating damage numbers (`:347-359,560-577`); bond tethers (`:234-256`); status badges (`:258-288`); purification pulse + background swap + reward reveal (`:462-498,602-621`); revive timer overlay (`:947-988`); boss HP bar and phase visuals (`:436-460,834-856`).

### Data Sources

- **`ability:fired`** = `{ type, playerId, abilityIndex, directionX, directionY }` (`packages/net-protocol/src/messages/server-to-host.ts`). **It does not carry the caster's class** — look it up via `gameState.players.find(p => p.id === delta.playerId)?.class`. Handle not-found without throwing.
- **`ability:fired` is only broadcast when `inDungeon`** (`GameRoom.ts:2054-2062`) — hub and training-dummy ability use never produces this delta. Do not promise hub VFX; do not add a hub code path.
- **`directionX/Y` may be un-normalized.** The sim normalizes with `Math.hypot` before use (`GameRoom.ts:2104-2107`); the host must do the same, and must treat `mag === 0` as "no placement" for directional abilities (matching `continue` in the sim).
- **`zone:strike`** = `{ type, zoneId, targetId, damage }` (`server-to-host.ts:259-266`). `targetId` may be an enemy id **or the boss id** (`GameRoom.ts:1631-1641`). It carries no `x`/`y` — resolve the position from the snapshot.
- **`ZoneState`** (per-frame, snapshot-reconciled) = `{ id, ownerId, x, y, radius, effectType: 'damage' | 'pull', tickIntervalMs, expiresAtMs }`. No `class`, no `abilityIndex`.
- **Host transient-delta whitelist** at `apps/host-client/src/session/host-session.ts:46-64` currently forwards 17 delta types; everything else (including `zone:tick`, `zone:strike`, `zone:expired`, `status:*`, `cast:*`, `projectile:*`) is dropped before it reaches `DungeonScreen`. `applyDelta` already handles all of them (`apply-delta.ts:253-259`), so forwarding one is safe and changes no mirror-state behavior.
- **`latestTransientDelta` is a single React state value, not a queue** (`App.tsx:20,42-48`) — set per delta, cleared after 400 ms; React 18 auto-batching collapses same-task deltas so only the last is seen. Pre-existing (it is why `boss:stomped` visuals are unreliable). **Acknowledged limitation; do not rewrite `App.tsx` in this story** — flag a follow-up if it ever blocks an AC. AC3 is deliberately designed around it.

### Previous Story Intelligence

- **From 7.1 (`7-1-vfx-engine-foundations.md`):** the clock contract was the single worst failure mode found in review — mixing `Date.now()` and `performance.now()` made effects vanish on frame 1 or leak forever with no exception thrown. That is the top risk for this story, because `DungeonScreen.tsx`'s ticker already contains **both** clocks (`renderFrame` on `Date.now()`, purification/reward blocks on `performance.now()`). Add the `engine.update(Date.now())` call next to `renderFrame`, not next to the `performance.now()` blocks, and resist the pull to match the neighbouring code's clock.
- **From 7.1:** `import { Graphics } from 'pixi.js'` **works** under a plain node-environment `vitest run` — no jsdom needed. The earlier "pixi can't be imported" claim in 7.1's debug log was retracted; do not repeat it. It is merely slow to transform on WSL2 (~35 s first collect). `ability-visuals.ts` imports no PixiJS at all, so its test file is fast.
- **From 7.1:** `createTintPulse` captures and restores the target's *pre-trigger* alpha/tint. Not used by this story (Stormcaller's identity is projected geometry, not caster tinting) — noting it so it is not reached for by reflex; using it on a player circle would fight `renderFrame`'s per-frame `circle.alpha` assignment (`:131-145`), which runs after and would overwrite it. **Do not use `createTintPulse` on any object `renderFrame` writes `alpha` to each frame.**
- **From 3.20 (`3-20-stormcaller-storm-eye-rework.md`):** Storm Eye is the only `'zone'`-delivery ability; `ABILITY_DELIVERY` was extended to a 3-value union for it, and the zone is placed **directly** from the ability-dispatch block at `caster + direction * ABILITY_HIT_RANGE_PX` — not chained off a projectile like Void Pulse. `STORM_EYE_TICK_DAMAGE` is intentionally separate from `ABILITY_DAMAGE.stormcaller[3] = 0` because the hitscan path is never reached for this ability.
- **From 3.13 (`3-13-projectile-physics-and-zone-field-entities.md`):** the "small circle for projectiles, translucent circle for zones" rendering was always explicitly a placeholder awaiting a proper visual pass — this story (and 7.8) is that pass.

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`. Run from the package dir: `cd apps/host-client && npx vitest run src/vfx/`.
- Existing sibling to follow: `apps/host-client/src/vfx/vfx.test.ts` (24 tests). Do not modify it; it must still pass.
- **Project convention (ponytail):** one runnable check for non-trivial logic, not a suite per function. Pure selection/mapping logic belongs in a plain exported function testable without a canvas — hence `ability-visuals.ts` carrying all the math with zero PixiJS imports. **Rendering correctness is verified manually via the Client-UX hook**, not asserted in a test.
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 (simulation-server 60 s boot timeout, and a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`). Two runs have produced two different failures. Note it if seen; do not chase it, and do not claim it as this story's regression — this story touches no simulation code.
- **Never claim a test or a visual check passed that was not run.**

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Ownership:** `apps/host-client/**` is Host Experience Engineer's area. Blocked: simulation server, game-rules, mobile, shared-types, net-protocol.
- **Never import `packages/game-rules` from `apps/host-client`.** The balance numbers in this story are for *choosing visual parameters at authoring time*; where a value must exist in host code, declare a local visual constant with a `balance.ts:<line>` comment. `shared-types` **is** importable and already used (`PlayerClass`, `CLASS_DEFINITIONS`, `SessionColor`, `BossPhase`, constants — `DungeonScreen.tsx:3-4`).
  - **Update — Story 7.9 / ADR-0003:** ability *spatial geometry* (`ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DELIVERY`, `STORM_EYE_ZONE_RADIUS_PX`) is now the shared **ability presentation contract** in `shared-types` — **import it** (see Task 2.2) rather than declaring local mirrors. Only pure balance (damage/cooldown/tick-damage/status magnitude) stays host-forbidden in `game-rules`.
- **Host is a pure client:** no `GameState` mutation, no game-rule checks, no physics reads.
- **`Math.random()` is permitted here** — "host UI animations, cosmetic effects" is the one allowed place (it is forbidden in `packages/game-rules` / `apps/simulation-server`). `createParticleBurst` already uses it internally.
- **TypeScript strict**, no `any` without an explicit suppression comment.
- **Constants:** tunable visual values go in named constants in `ability-visuals.ts`, not as inline magic numbers scattered through the delta handler.
- **Naming:** files kebab-case; events `noun:verb`; wire types `PascalCase + Msg`.

### Project Structure Notes

- New: `apps/host-client/src/vfx/ability-visuals.ts` (pure, no PixiJS import), `apps/host-client/src/vfx/stormcaller-vfx.ts` (primitive binders), `apps/host-client/src/vfx/ability-visuals.test.ts`.
- Modified: `apps/host-client/src/vfx/index.ts` (append exports), `apps/host-client/src/screens/DungeonScreen.tsx`, `apps/host-client/src/session/host-session.ts` (one line, optional Task 6).
- `ability-visuals.ts` is deliberately named for the *whole* epic, not for Stormcaller — 7.2/7.3/7.4 will add their own classes' resolvers and 7.8 will add zone/projectile cases to the same module. Keep the Stormcaller-specific bits clearly sectioned so those stories append rather than restructure.
- No `packages/ui-kit` involvement (host-only, no mobile use case). No `vite.config.ts` alias changes (internal relative imports).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 framing; "every zone as the same hardcoded purple circle (`:329`)".
- [Source: `_bmad-output/planning-artifacts/epics.md:1990-2001`] — Story 7.5 statement and both ACs, including the Storm Eye ongoing-tick-indicator requirement.
- [Source: `_bmad-output/planning-artifacts/epics.md:2044-2059`] — Story 7.8 scope (the seam this story must not collide with).
- [Source: `_bmad-output/planning-artifacts/epics.md:2054`] — the incorrect claim that `ZoneState` has `class`/`abilityIndex` fields.
- [Source: `_bmad-output/planning-artifacts/epics.md:2061`] — Epic 7 non-goals.
- [Source: `apps/host-client/src/vfx/index.ts:1-19`] — public VFX API surface.
- [Source: `apps/host-client/src/vfx/types.ts:10-18`] — `EffectHandle`; [`:20-24`] `VfxStage`; [`:26-34`] CLOCK CONTRACT; [`:52-55`] `progress()`.
- [Source: `apps/host-client/src/vfx/primitives.ts:38-86`] — `createParticleBurst` (full-2π distribution at `:58`, 0.7–1.3× speed jitter at `:59`).
- [Source: `apps/host-client/src/vfx/primitives.ts:97-105`] — `TrailHandle.disposed` / `moveTo(x, y, now)` keep-alive contract; [`:113-184`] implementation.
- [Source: `apps/host-client/src/vfx/primitives.ts:200-233`] — `createRingShockwave`; radius clamp making implode safe at `:218-219`.
- [Source: `apps/host-client/src/vfx/primitives.ts:246-273`] — `createBeam`; local-space geometry at `:256-258` (`view.position = (x,y)`, line drawn as `toX - x, toY - y`).
- [Source: `apps/host-client/src/vfx/primitives.ts:294-320`] — `createTintPulse` (borrowed target, `view: null`, restores captured alpha/tint).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:84-96`] — `renderFrame`'s 9-Map signature; [`:99`] `Date.now()`; [`:311-330`] zone section; [`:329`] the hardcoded `0x9b59b6 @ 0.25`; [`:418-499`] ticker callback; [`:435`] the "keep renderFrame signature stable" precedent; [`:502-525`] cleanup; [`:537-623`] transient-delta effect; [`:551-553`] `ability:fired` branch; [`:598-601`] the `setTimeout`-based `boss:stomped` ring not to copy; [`:674`] server-epoch timestamp compared to host `Date.now()` precedent.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:25-44`] — existing constants; [`:129-174`] spirit/down/frozen rendering that must not regress.
- [Source: `apps/host-client/src/session/host-session.ts:46-64`] — the transient-delta whitelist to extend.
- [Source: `packages/net-protocol/src/apply-delta.ts:253,258`] — `zone:tick` / `zone:strike` already handled by the shared reducer.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:249-266`] — `ZoneTickDelta`, `ZoneExpiredDelta`, `ZoneStrikeDelta` shapes.
- [Source: `packages/game-rules/src/balance.ts:101-106`] — `ABILITY_HIT_RANGE_PX.stormcaller = [160, 200, 0, 160]`.
- [Source: `packages/game-rules/src/balance.ts:108-113`] — `ABILITY_HIT_RADIUS_PX.stormcaller = [60, 70, 110, 80]`.
- [Source: `packages/game-rules/src/balance.ts:124`] — `ABILITY_DELIVERY`: Stormcaller is `hitscan, hitscan, hitscan, zone`.
- [Source: `packages/game-rules/src/balance.ts:185-193`] — `STORM_EYE_ZONE_RADIUS_PX=150`, `STORM_EYE_TICK_MS=500`, `STORM_EYE_TICK_DAMAGE=10`, `STORM_EYE_DURATION_MS=5000`, `STORM_EYE_STRIKE_INTERVAL_MS=1500`, `STORM_EYE_STRIKE_DAMAGE=30`.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2103-2129`] — the `'zone'` dispatch branch: direction normalize + `mag === 0` guard, zone placed at `player + normDir * hitRange`, `effectType: 'damage'`, `expiresAtMs = nowAbility + STORM_EYE_DURATION_MS`.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1608-1660`] — bonus-strike cadence and the `zone:strike` broadcast, including the boss-target branch.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1693`] — unconditional per-tick `zone:tick` broadcast.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1516,1540`] — `'pull'` (Void Pulse) vs `'damage'` (Storm Eye) zone tick branches, the basis for identity derivation.
- [Source: `packages/shared-types/src/class-definitions.ts:57-66`] — Stormcaller ability names and input types.
- [Source: `packages/shared-types/src/player.ts:3-8`] — `PlayerClass` enum.
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:11-23,146-227`] — color tokens; `accent-purify` `#90d8f0` reserved for purification/boss defeat (`:200`), `accent-spirit` `#6ea8d8` reserved for selections/spirit glow (`:17,182`).
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`] — 7.1 API, review outcomes, clock-contract redesign, `pixi.js`-imports-under-vitest correction, D-7.1-A…D.
- [Source: `_bmad-output/implementation-artifacts/3-20-stormcaller-storm-eye-rework.md`] — Storm Eye's `'zone'` delivery and direct placement rationale.
- [Source: `_bmad-output/implementation-artifacts/3-13-projectile-physics-and-zone-field-entities.md`] — placeholder projectile/zone rendering, always intended to be replaced.
- [Source: `_bmad-output/project-context.md`] — ownership, no-game-rules-import rule, PixiJS host renderer rules, `Math.random()` allowance, naming/constants conventions.
- [Source: `CLAUDE.md`] — Pre-Task / Ownership / Contract-change / Simulation-safety / Client-UX / Telemetry hooks and the merge gate.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (gds-dev-story workflow)

### Debug Log References

- `npm run typecheck` (repo root) — exit 0, all 10 tsconfigs clean.
- `cd apps/host-client && npx vitest run src/vfx/` — 65 pass / 1 fail; the single fail is the pre-existing `ability-vfx.test.ts` Stone Wall geometry-drift test (confirmed by `git stash` on the clean baseline → identical `660 vs 500`). New `stormcaller-vfx.test.ts` = 14/14 pass; 7.1 `vfx.test.ts` = 24/24 pass.

### Completion Notes List

**ARCHITECTURE NOTE (important for the reviewer).** This story's text (written 2026-07-22) predates the architecture that actually emerged from 7.2–7.4. It names files that were never created (`ability-visuals.ts`, `ability-visuals.test.ts`) and a `StormcallerCastResult` type. The real, shipped architecture is: a config-driven `ability-vfx.ts` (Stonehide/7.2) **plus** dedicated per-class modules `spiritcaller-vfx.ts` (7.3) and `souldrinker-vfx.ts` (7.4), each a pure `plan…`/`spawn…` pair over a `VfxSpec` union, with the PixiJS-free `ability-vfx-config.ts` holding the palettes + the 7.8 zone/projectile seam. I followed that real pattern rather than the story's superseded names:

- **`stormcaller-vfx.ts`** (new) — the pure `resolveStormcallerCast` + `stormEyeTickCadence`, the `StormcallerVfxSpec` model, and the executors `spawnStormcallerCast` / `advanceHurlFlights` / `spawnStormEyePulse` / `spawnStormEyeStrike`. Directly mirrors `souldrinker-vfx.ts`.
- **`ability-vfx-config.ts`** (modified) — added `STORMCALLER_PALETTE` and the zone seam (`ZoneVisual`, `STORM_EYE_ZONE_VISUAL`, `isStormEyeZone`, `resolveZoneVisual`) next to the existing `SOULDRINKER_PALETTE`/`ZONE_APPEARANCE`, so all 7.8-seam material lives in the one PixiJS-free module 7.8 imports.
- **`stormcaller-vfx.test.ts`** (new) — named for the module per the real `<class>-vfx.test.ts` convention.

The ACs are satisfied by substance; only the imagined filenames changed. Every AC's required *export* exists with the specified name and semantics.

**Task 1 was already done.** A prior 7.x story wired the `VfxEngine` (`vfxEngineRef` `:638`, construct `:691`, `update(Date.now())` `:726`, `clear()` `:801`). Per the "guard, don't duplicate" instruction I reused it and only added the two new Stormcaller refs to the existing cleanup + the existing `VfxContext` seam. AC6's "guarded by if-not-already-present" is met by construction.

**Per-frame placement.** The Storm Eye pulse and the Tempest Hurl flight advance run **inside `renderFrame` via the `VfxContext`/`vfxRefs` seam**, not literally in the ticker body as Task 5.2/4.3 wrote. That is the established convention: the Spiritcaller soul-mend channel and Warding-Cry shield aura (the direct analogues of a snapshot-driven per-frame VFX) live in exactly that place. `renderFrame` *is* the ticker callback's per-frame body, so behavior is identical, and it keeps `renderFrame`'s positional signature stable (Task 1.7) by riding the same `vfxRefs` object 7.3/7.4 already thread.

**`phase` formula (Task 2.4).** Implemented as `ceil(remaining/tick) - remaining/tick`. This equals the story's literal `1 - (remaining % tick)/tick` at every non-boundary instant and resolves the exact tick boundary to `0` (a new cell just began) instead of `1`, which keeps `phase` in the half-open `[0, 1)` the Task 7.3 assertion requires. `ticksRemaining` (the actual pulse trigger) is unaffected. `phase` is cosmetic/unused by the render path today; the AC is met via the `ticksRemaining` decrement.

**Tick count (Task 7.3 "10").** Honest correction: over a live 5000 ms / 500 ms zone sampled every 100 ms, exactly **9** decrement events are observable — `ticksRemaining` runs 10→1 and the 10th tick coincides with expiry, where `stormEyeTickCadence` returns `null` (the zone is gone). The test asserts 9 with an explaining comment. Visually this is 9 heartbeat pulses over the zone's life — a "still ticking" indicator, not a 1:1 damage-tick counter (AC3 only asks for a periodic pulse at the real cadence).

**Contract-change hook — NOT triggered.** No `shared-types`/`net-protocol` change. The one `host-session.ts` edit adds `zone:strike` to the host-local transient-delta whitelist; `applyDelta` already handles it (`apply-delta.ts:258`), so mirror-state behavior and every message shape are unchanged — identical precedent to 7.3's `cast:*` and 7.4's `projectile:hit` whitelist additions and the `dev-5-boss-transient-delta-whitelist-fix`. Simulation-safety and Telemetry hooks — not triggered. Client-UX hook — triggered (Task 8.3, see below).

**Ownership.** All writes are inside `apps/host-client/**` (Host Experience Engineer), including the `host-session.ts` whitelist line. No blocked path was written. The pre-existing Stonehide test failure lives in `shared-types` geometry (blocked) + 7.2's test — correctly left untouched.

**D-7.1-D (AC4) — re-deferred with the analytical bound.** Worst case (four Stormcallers, cooldown-perfect rotation) ≈ **25 concurrent handles**, per the Dev Notes derivation table; the one-live-pulse-per-zone invariant (`remove` before `add` on each tick boundary) hard-caps the only per-tick/per-frame trigger to ≤1 live handle per zone (≤12 zones ⇒ ≤12 pulses), so no trigger can grow unbounded. This is documentation-with-evidence, which AC4 accepts "rather than a guess." **A live `engine.size` reading was not taken** — the environment has no running host; if a human playtest at four Stormcallers shows frame-time degradation, record it as a *new* deferred item rather than growing this story. Re-defer D-7.1-D as-is.

**Client-UX hook (Task 8.3) — NOT run.** No interactive host in this environment; the visual pass (four-ability distinctness, no-occlusion, frozen 0.3 alpha, down/spirit body sprite, 5 s pulse then stop) is honestly left for the reviewer/human. I did not and will not claim a visual check I didn't run.

**Confidence: 88%.** Code compiles clean, pure logic is unit-tested, and the wiring precisely mirrors three shipped sibling classes. The 12% gap is entirely the un-run manual Client-UX visual pass (Task 8.3) and the un-measured live effect count (Task 8.4) — both require a running host and belong to review.

### File List

- `apps/host-client/src/vfx/stormcaller-vfx.ts` (new) — pure cast planner + tick cadence + primitive-binding executors.
- `apps/host-client/src/vfx/stormcaller-vfx.test.ts` (new) — 14 tests for the pure functions + the zone seam.
- `apps/host-client/src/vfx/ability-vfx-config.ts` (modified) — added `STORMCALLER_PALETTE` and the zone-body seam (`ZoneVisual`, `STORM_EYE_ZONE_VISUAL`, `isStormEyeZone`, `resolveZoneVisual`).
- `apps/host-client/src/vfx/index.ts` (modified) — appended the new Stormcaller + zone-seam exports.
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified) — STORMCALLER `ability:fired` branch, `zone:strike` accent branch, Storm Eye pulse + Tempest Hurl flight advance in `renderFrame`, zone-body seam via `resolveZoneVisual`, two new refs + cleanup + `VfxContext` fields.
- `apps/host-client/src/session/host-session.ts` (modified) — one line: `zone:strike` added to the transient-delta whitelist.

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story 7.5 created — Stormcaller ability VFX: per-ability visual spec sized to real hit geometry, snapshot-derived Storm Eye tick pulse as the AC-satisfying ongoing-tick indicator, `zone:strike` accent + whitelist edit as optional, `resolveZoneVisual` seam contract for Story 7.8, guarded one-time `VfxEngine` wiring, D-7.1-D volume bound with the one-live-pulse-per-zone invariant. |
| 2026-07-23 | Propagated Story 7.2 code-review fix: `spawnStormcallerCast`/`spawnStormEyeStrike` now pass their `now` arg as each factory's `startedAt`, and the delta-triggered cast/strike capture `Date.now()` at trigger (BACKGROUNDED-TICKER note added to Task 4.1, CLOCK CONTRACT pitfall updated). Ticker-driven Hurl trail and Storm Eye pulse keep lazy capture. |
| 2026-07-23 | Applied SILENT rule (user decision): reversed the earlier "fall back to generic flash" on a null plan — a zero-aim directional Stormcaller cast now renders nothing AND no flash (Task 4.1). Thunder Clap (self-centred) still always plans; player-not-found still falls through to the legacy flash. |
| 2026-07-23 | Story 7.9 re-point: hit geometry moved into a shared **ability presentation contract** in `shared-types` (ADR-0003). Task 2.2 + Dev Notes updated — **import** `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`/`ABILITY_DELIVERY`/`STORM_EYE_ZONE_RADIUS_PX` from `shared-types` and derive the Stormcaller slices, rather than declaring local mirrors (the transcription 7.9 removes). No AC/Task-status change. |
| 2026-07-24 | Implemented Story 7.5. New `stormcaller-vfx.ts` (pure `resolveStormcallerCast` + `stormEyeTickCadence` + primitive-binding executors) and `stormcaller-vfx.test.ts` (14 tests, all pass); zone-body 7.8 seam (`ZoneVisual`/`STORM_EYE_ZONE_VISUAL`/`isStormEyeZone`/`resolveZoneVisual` + `STORMCALLER_PALETTE`) added to `ability-vfx-config.ts`; `DungeonScreen.tsx` gains a STORMCALLER `ability:fired` branch (suppress-and-replace + SILENT on zero-aim), the snapshot-derived Storm Eye tick pulse with the one-live-pulse-per-zone invariant, the Tempest Hurl thrown-flight flourish, the `resolveZoneVisual` zone-body seam, and the optional `zone:strike` accent; `host-session.ts` whitelists `zone:strike`. Engine wiring was already present (7.2–7.4) and reused, not duplicated. Typecheck exit 0. Followed the real per-class `*-vfx.ts` architecture over the story's superseded `ability-visuals.ts` names. Task 8.3 (manual Client-UX) + live effect-count left for review — no running host in this environment. Status → review. |

---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.8: Environmental & Bond VFX Polish

Status: ready-for-dev

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

- [ ] **Task 1 — One-time `VfxEngine` wiring in `DungeonScreen.tsx` (guarded: "if not already present")** (AC: 4, 5, 6)
  - [ ] 1.1: Check first whether a sibling Epic 7 story already landed this. If `DungeonScreen.tsx` already imports from `../vfx` and holds a `vfxEngineRef`, **do not duplicate it** — reuse it and skip to Task 2.
  - [ ] 1.2: `import { VfxEngine, createTrail, createRingShockwave, createParticleBurst, getProjectileVisual, getZoneVisual, DEFAULT_PROJECTILE_VISUAL } from '../vfx';` (plus `type TrailHandle`).
  - [ ] 1.3: `const vfxEngineRef = useRef<VfxEngine | null>(null);` alongside the other refs (near `DungeonScreen.tsx:369-392`).
  - [ ] 1.4: Construct it inside `initPixi` immediately after `pixiAppRef.current = app;` (`DungeonScreen.tsx:417`) and **before** `app.ticker.add(...)`: `vfxEngineRef.current = new VfxEngine(app.stage);`
  - [ ] 1.5: In the existing ticker callback (`DungeonScreen.tsx:418-499`), call `vfxEngineRef.current?.update(now)` **once**, after `renderFrame(...)` returns and after the boss-sprite block. Compute `const now = Date.now();` at the top of the ticker callback and use that single value for everything in the callback. **`Date.now()`, never `performance.now()`.**
  - [ ] 1.6: In the unmount cleanup (`DungeonScreen.tsx:502-525`), add `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;` **before** `app.destroy(true, { children: true })` — the engine removes its views from a stage that still exists, then Pixi tears the rest down.

- [ ] **Task 2 — New shared module `apps/host-client/src/vfx/ability-visuals.ts`** (AC: 1, 2, 3)
  - [ ] 2.1: Define and export `ProjectileVisual` and `ZoneVisual` interfaces exactly as specified in Dev Notes → "Visual config module: shape".
  - [ ] 2.2: Export `DEFAULT_PROJECTILE_VISUAL` and `DEFAULT_ZONE_VISUAL` (values in the spec tables).
  - [ ] 2.3: Seed `PROJECTILE_VISUALS` keyed `` `${class}:${abilityIndex}` `` with the Souldrinker Blood Spike (idx 0) and Void Pulse (idx 3) entries from the spec table — **unless** Story 7.4 already wrote them, in which case leave 7.4's values alone.
  - [ ] 2.4: Seed `ZONE_VISUALS` keyed `` `${class}:${effectType}` `` with the Souldrinker `pull` and Stormcaller `damage` entries, plus `EFFECT_TYPE_ZONE_VISUALS` keyed on `effectType` alone (the owner-not-found fallback tier) — same "don't overwrite a shipped 7.4/7.5 entry" rule.
  - [ ] 2.5: Export the two pure lookups: `getProjectileVisual(cls: PlayerClass | undefined, abilityIndex: number | undefined): ProjectileVisual` and `getZoneVisual(cls: PlayerClass | undefined, effectType: ZoneEffectType): ZoneVisual`. Both must be **total** — every input, including `undefined`, `NaN`, negative and out-of-range indices, returns a valid object. Neither throws, neither logs, neither reads a clock, neither imports `pixi.js`.
  - [ ] 2.6: Re-export both functions, both defaults and both types from `apps/host-client/src/vfx/index.ts` (append to the existing barrel — do not reorder it).
  - [ ] 2.7: Add a file-header comment stating the cross-story ownership rule: *"7.4 owns the Souldrinker rows, 7.5 owns the Stormcaller rows, 7.8 owns the shape of the tables, the defaults and the fallback ladder."*

- [ ] **Task 3 — Per-ability projectile rendering + trail in `renderFrame`** (AC: 1, 4)
  - [ ] 3.1: Change `projectileGraphics` from `Map<string, Graphics>` to `Map<string, ProjectileEntry>` where `interface ProjectileEntry { g: Graphics; trail: TrailHandle | null; visual: ProjectileVisual }`. Update `projectileGraphicsRef`'s type at `DungeonScreen.tsx:376`.
  - [ ] 3.2: Add **one** new parameter to `renderFrame`, appended last: `vfx: VfxRenderContext` where `interface VfxRenderContext { engine: VfxEngine | null }`. Do **not** add a 12th positional `Map` — future Epic 7 stories add fields to this object instead. Add a short comment saying so.
  - [ ] 3.3: On first-seen projectile: resolve `const visual = getProjectileVisual(projectile.class, projectile.abilityIndex)`, create the `Graphics`, create the trail via `createTrail({ x: projectile.x, y: projectile.y, color: visual.trailColor, width: visual.trailWidth, durationMs: visual.trailDurationMs, pointCount: visual.trailPointCount, alpha: visual.trailAlpha })`, `vfx.engine?.add(trail)`, and store all three in the entry. If `vfx.engine` is null, store `trail: null` and render the body only (defensive; the engine is constructed before the ticker so this should not happen).
  - [ ] 3.4: Every frame, per live projectile: `g.position.set(p.x, p.y)`, `g.clear()`, then draw the body per the spec table (`bodyColor`/`bodyRadius`, plus the optional `coreColor`/`coreRadius` inner disc), then `if (entry.trail && !entry.trail.disposed) entry.trail.moveTo(p.x, p.y, now);` using `renderFrame`'s existing `const now = Date.now()` (`DungeonScreen.tsx:99`). **Do not** re-create the trail, do not allocate a `Graphics`, do not call `engine.add` here.
  - [ ] 3.5: On cleanup-on-missing: remove+destroy the body `Graphics` and `delete` the map entry, but **do not** call `engine.remove(trailId)` — simply stop feeding the trail so it fades point-by-point and the engine reaps it within `trailDurationMs`. Add a comment explaining this is deliberate (the fade-out *is* the despawn read) and that it is bounded — see Dev Notes → "Effect volume (D-7.1-D)".
  - [ ] 3.6: Because `ProjectileState` carries `class` directly (`packages/shared-types/src/projectile.ts:7-9`), **no owner lookup is needed for projectiles** — do not add one.

- [ ] **Task 4 — Per-ability zone rendering in `renderFrame`** (AC: 2)
  - [ ] 4.1: For each zone, resolve the owner class once per zone per frame: `const ownerClass = state.players.find(p => p.id === zone.ownerId)?.class;` — `find` returning `undefined` is the expected owner-disconnected path, not an error. **No `!`, no throw, no `console.warn` (it would fire 60×/s).**
  - [ ] 4.2: `const visual = getZoneVisual(ownerClass, zone.effectType);`
  - [ ] 4.3: Replace the single hardcoded fill at `DungeonScreen.tsx:329` with the two-pass draw from the spec table: a filled disc at `zone.radius` using `fillColor`/`fillAlpha`, plus an edge ring `stroke({ color: ringColor, width: ringWidth, alpha: ringAlpha })` at `zone.radius`. Keep `addChildAt(g, 0)` (`:324`) so zones stay below all sprites — a Client-UX requirement, not cosmetic.
  - [ ] 4.4: On first-seen zone only, trigger **one** spawn ring via `createRingShockwave` with the per-visual `spawnRing` params (expand for `damage`, implode for `pull` — implode is safe, radius is clamped at 0 per `primitives.ts:219`). One effect per zone spawn, never per tick, never per frame.
  - [ ] 4.5: Zone bodies stay a per-frame `Graphics.clear()` + redraw, **not** a VFX primitive. Record the rationale in Dev Notes: a zone body is a persistent, entity-tracked field with no lifetime curve, and none of the five 7.1 primitives models that. This is the one deliberate deviation from 7.1 AC3, and the drawing is fully parameterized by the config module rather than hardcoded — which is what AC3 was protecting against.

- [ ] **Task 5 — `projectile:hit` impact effect** (AC: 5)
  - [ ] 5.1: Add `delta.type === 'projectile:hit' ||` to the whitelist in `apps/host-client/src/session/host-session.ts:44-63`. **Add only this one.** Do **not** add `projectile:expired` — it carries no `x`/`y` (`packages/net-protocol/src/messages/server-to-host.ts`), so there is nothing to render at a position, and the fading trail from Task 3.5 already communicates expiry. Say so in a comment.
  - [ ] 5.2: Add a branch to the transient-delta `if/else-if` chain (`DungeonScreen.tsx:537-623`): resolve `const visual = projectileGraphicsRef.current.get(delta.projectileId)?.visual ?? DEFAULT_PROJECTILE_VISUAL;` then `vfxEngineRef.current?.add(...)` the impact effect from the spec table at `(delta.x, delta.y)`.
  - [ ] 5.3: Note in a comment that the entry may already be gone (snapshot reconciliation can drop the projectile before the delta effect runs) — the `?? DEFAULT_PROJECTILE_VISUAL` fallback is the intended behavior, not a bug to fix.
  - [ ] 5.4: Guard the whole branch on `vfxEngineRef.current` being non-null, matching the existing `&& app` guards at `:560`, `:578`, `:593`, `:602`.

- [ ] **Task 6 — Purification pulse → `createRingShockwave` (clock unification)** (AC: 6, 7)
  - [ ] 6.1: In the `boss:defeated` branch (`DungeonScreen.tsx:602-622`), keep everything except the pulse graphic: `bossDefeatedRef`, `isPurifiedRef`, `setIsPurified(true)`, `essenceDisplayRef`, and the background swap `app.renderer.background.color = 0x90d8f0` are all unchanged.
  - [ ] 6.2: Replace the hand-rolled `Graphics` + `PurificationPulse` ref with:
        `vfxEngineRef.current?.add(createRingShockwave({ x: bossPos.x, y: bossPos.y, color: 0x90d8f0, alpha: 0.6, filled: true, startRadius: 0, maxRadius: PURIFICATION_PULSE_MAX_RADIUS_PX, durationMs: PURIFICATION_PULSE_DURATION_MS }))`.
        Add `const PURIFICATION_PULSE_MAX_RADIUS_PX = 1400;` to the constants block at the top (`DungeonScreen.tsx:25-36`) — it is the magic `1400` currently inline at `:467`.
  - [ ] 6.3: **The completion handoff is the one thing that must not break.** `VfxEngine` reaps silently — it has no completion callback. Replace the `if (t >= 1) {...}` block at `:471-478` with a deadline ref: set `purificationPulseEndsAtRef.current = Date.now() + PURIFICATION_PULSE_DURATION_MS` when the pulse is added, and in the ticker check `if (purificationPulseEndsAtRef.current !== null && now >= purificationPulseEndsAtRef.current) { purificationPulseEndsAtRef.current = null; rewardRevealActiveRef.current = true; setRewardRevealVisible(true); setVoiceVisible(true); }`. Null-out **first** so it fires exactly once. Use the ticker's `Date.now()` — the same `now` the deadline was computed from.
  - [ ] 6.4: Delete the now-dead `PurificationPulse` interface (`:69-75`), `purificationPulseRef` (`:388`), the ticker block (`:462-479`), and the `purificationPulseRef.current = null;` line in cleanup (`:514`). Add `purificationPulseEndsAtRef.current = null;` to cleanup in its place.
  - [ ] 6.5: **Do not** change `PURIFICATION_PULSE_DURATION_MS` (2500) or `REWARD_REVEAL_DURATION_MS` (3000) in `packages/shared-types/src/constants.ts:15-16` — they are also read by the server's `run:complete` timing. Blocked path; the host only consumes them.

- [ ] **Task 7 — Reward-reveal particles → `createParticleBurst` (clock unification)** (AC: 6, 7)
  - [ ] 7.1: Replace the spawn loop (`DungeonScreen.tsx:704-728`) with one `createParticleBurst` call using the like-for-like parameters in Dev Notes → "Reward burst: prior art → primitive parameter mapping". Keep the randomized `count = 8 + Math.floor(Math.random() * 5)` and the `[0x6ea8d8, 0xf0c070]` palette exactly.
  - [ ] 7.2: Delete the `PurificationParticle` interface (`:77-82`), `purificationParticlesRef` (`:392`), the ticker loop (`:481-498`), the local `PARTICLE_DURATION_MS` (`:482`), and the `purificationParticlesRef.current = [];` cleanup line (`:515`). Add `const REWARD_PARTICLE_DURATION_MS = 1000;` to the constants block.
  - [ ] 7.3: Keep the `setTimeout(() => setVoiceVisible(false), 2000)` voice-line timer and its cleanup return (`:726-727`) exactly as-is — it is unrelated to the particles.
  - [ ] 7.4: Verify by reading that the burst still originates at `VIRTUAL_W / 2, VIRTUAL_H / 2` (arena centre, as today) — this story does **not** move it to the boss position.

- [ ] **Task 8 — Bond tether consistency pass** (AC: 6, 7)
  - [ ] 8.1: Extract the CSS-hex parse at `DungeonScreen.tsx:253` into a small module-scope helper `parseCssHexColor(css: string, fallback: number): number` that guards the `NaN` case (`parseInt('zz', 16)` is `NaN`, and a `NaN` color reaches PixiJS today). Fallback `0x6ea8d8` (`accent-spirit` — the established bond color).
  - [ ] 8.2: Restyle the stroke from one 2px line to a two-pass draw on the same `Graphics`: a soft underlay `stroke({ color, width: BOND_TETHER_GLOW_WIDTH, alpha: 0.16 })` then the core `stroke({ color, width: BOND_TETHER_CORE_WIDTH, alpha: coreAlpha })`. Constants: `BOND_TETHER_GLOW_WIDTH = 8`, `BOND_TETHER_CORE_WIDTH = 3`.
  - [ ] 8.3: `coreAlpha` breathes slowly so the tether reads as living spirit energy rather than a debug line: `const coreAlpha = 0.62 + 0.14 * Math.sin((now / BOND_TETHER_BREATH_PERIOD_MS) * Math.PI * 2);` with `BOND_TETHER_BREATH_PERIOD_MS = 1800`, using `renderFrame`'s existing `now`. Range 0.48–0.76, never invisible, never opaque enough to compete with sprites.
  - [ ] 8.4: **Unchanged:** one tether per `state.activeBonds` entry, keyed `` `${b.playerA}+${b.playerB}` ``, created on first-seen and destroyed on cleanup-on-missing, `addChildAt(g, 0)` layering, `g.clear()` then nothing drawn when either player is missing, and persistence for the whole run (FR16). **Do not** convert tethers to a `createTrail` or any other time-limited primitive — a tether has no lifetime curve; feeding a fading primitive every frame for a whole run is exactly the per-frame-effect churn D-7.1-D warns about.

- [ ] **Task 9 — Unit test for the pure mapping functions** (AC: 1, 2, 3)
  - [ ] 9.1: New `apps/host-client/src/vfx/ability-visuals.test.ts`. It must **not** import `pixi.js` — the module under test is pure data + lookups, so the suite runs in milliseconds.
  - [ ] 9.2: Cases: (a) Souldrinker idx 0 and idx 3 each return their own distinct entry; (b) an unmapped `(class, abilityIndex)` returns `DEFAULT_PROJECTILE_VISUAL`; (c) `undefined` class, `undefined`/`NaN`/`-1`/`99` index each return the default without throwing; (d) `getZoneVisual(Souldrinker, 'pull')` and `getZoneVisual(Stormcaller, 'damage')` return distinct entries; (e) `getZoneVisual(undefined, 'pull')` — the owner-disconnected path — returns the `effectType`-tier visual, not the global default, and is distinct from `getZoneVisual(undefined, 'damage')`; (f) every returned object has finite numeric colors in `0x000000..0xffffff` and alphas in `0..1` (a table-driven loop over all entries — this is the guard against a sibling story pasting a CSS string or an out-of-range alpha into the table).
  - [ ] 9.3: Follow the shape of `apps/host-client/src/vfx/vfx.test.ts`. One runnable check for non-trivial logic per project convention — do not write a test per table row beyond the loop in (f).

- [ ] **Task 10 — Self-check** (AC: 1–7)
  - [ ] 10.1: `npm run typecheck` at repo root — green, including the changed `projectileGraphicsRef` map value type and the new `renderFrame` parameter at both the definition (`:84`) and the call site (`:421-433`).
  - [ ] 10.2: From `apps/host-client`: `npx vitest run src/vfx/ability-visuals.test.ts` and `npx vitest run src/vfx/vfx.test.ts` — both green (the 24 existing 7.1 tests must not regress).
  - [ ] 10.3: Grep the file for leftovers: `rg 'performance\.now' apps/host-client/src/screens/DungeonScreen.tsx` must return **zero** hits when this story is done. Also `rg 'purificationParticlesRef|purificationPulseRef|PurificationParticle|PurificationPulse' apps/host-client/src/screens/DungeonScreen.tsx` → zero hits.
  - [ ] 10.4: Manual Client-UX pass on the host canvas (see Dev Notes → "Client-UX hook checks") — cast a Blood Spike and a Void Pulse, watch the Storm Eye zone, disconnect a zone owner mid-zone, kill the boss and watch the purification pulse → reward reveal handoff, and confirm bond tethers still draw below sprites.
  - [ ] 10.5: Confirm no file outside the Allowed paths was modified: `git status --short`.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story drafted from `epics.md:2044-2061` against baseline `884dacb`. Corrected the epic's AC2: `ZoneState` has no `class`/`abilityIndex` fields (`packages/shared-types/src/zone.ts:1-12`), so zone identity is derived from `ownerId → player.class` + `effectType` rather than by adding schema fields, which would fire the Contract-change hook and break the epic's own "no protocol/schema changes" non-goal. |

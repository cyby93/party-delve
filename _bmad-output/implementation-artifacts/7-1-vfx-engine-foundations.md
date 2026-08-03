---
baseline_commit: 599ae94d08039c93e5fac1c61090313c6dbe2b56
---

# Story 7.1: VFX Engine Foundations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Host Experience Engineer,
I want a small library of reusable, parameterized PixiJS effect primitives,
so that every ability/status/boss-attack VFX story that follows composes from one shared toolkit instead of writing bespoke `Graphics` code per ability.

## Acceptance Criteria

1. **Given** `apps/host-client/src/screens/DungeonScreen.tsx` currently hand-rolls every effect as inline `Graphics` calls, **when** the VFX engine lands (new module `apps/host-client/src/vfx/`), **then** it exposes at minimum: a particle burst, a trail, a ring/shockwave, a beam, and a tint-pulse primitive — each parameterized by color, size/scale, and duration, with no per-ability logic baked in — **and** each primitive manages its own PixiJS `Graphics`/`ParticleContainer` lifecycle (create-on-trigger, destroy-on-complete), following the existing create-on-first-seen/cleanup-on-missing pattern already used for players/enemies/tethers in `DungeonScreen.tsx`.
2. **Given** the tick-driven render loop in `DungeonScreen.tsx` (the `app.ticker.add()` callback), **when** a primitive is triggered, **then** it advances and cleans itself up frame-to-frame without allocating on every frame (reuses the existing per-entity Map-and-mutate pattern, not a new object per tick).
3. **Given** this story ships, **when** Stories 7.2–7.8 are implemented, **then** none of them add new bespoke `Graphics`-drawing code for basic shapes — they call into this library with per-ability parameters.

## Tasks / Subtasks

- [x] Task 1: Scaffold `apps/host-client/src/vfx/` module (AC: 1)
  - [x] 1.1: `types.ts` — shared `VfxTriggerParams` base (color, scale/size, durationMs) and an `EffectHandle` interface (`graphic`/`container`, `update(now): boolean` returning `false` when complete, `dispose()`)
  - [x] 1.2: `index.ts` — public barrel export for the 5 primitive factories + engine
- [x] Task 2: Implement Particle Burst primitive (AC: 1, 2)
  - [x] 2.1: Generalize the existing ad-hoc reward-reveal burst math (`DungeonScreen.tsx:704-728`: N radial particles, `angle`/`speed`-driven position, linear alpha fade) into a reusable `createParticleBurst(params)` — no hardcoded particle count/colors
- [x] Task 3: Implement Trail primitive (AC: 1, 2)
  - [x] 3.1: Fading point-history trail — no direct prior-art in this file; keep the same create-on-trigger/advance/destroy-on-complete shape as the other 4 primitives
- [x] Task 4: Implement Ring/Shockwave primitive (AC: 1, 2)
  - [x] 4.1: Generalize the existing purification pulse (`DungeonScreen.tsx:462-479`) and `boss:stomped` ring (`DungeonScreen.tsx:593-601`) math — expanding radius + fading alpha over `durationMs` — into `createRingShockwave(params)`
- [x] Task 5: Implement Beam primitive (AC: 1, 2)
  - [x] 5.1: Origin→target (or origin+angle+length) line/rect that fades over `durationMs`
- [x] Task 6: Implement Tint-Pulse primitive (AC: 1, 2)
  - [x] 6.1: Generalize the existing ability-cast cosine pulse (`DungeonScreen.tsx:131-133,142-144`: `0.2 + 0.8 * |cos(π·remaining/duration)|`) into `createTintPulse(params)`
- [x] Task 7: Lifecycle engine wiring (AC: 2)
  - [x] 7.1: One `Map<id, EffectHandle>` per primitive type (or a single engine object composing all 5 maps) — `trigger*(params)` inserts, a single `update(now)` call per ticker frame mutates each handle in place and deletes+destroys on completion; no new object allocated per frame for an already-active effect
- [x] Task 8: Self-check (non-negotiable per project convention — see Dev Notes testing gap)
  - [x] 8.1: One test file exercising lifecycle only (no real canvas/WebGL needed): trigger an effect, advance the fake clock past `durationMs` in steps, assert it reports complete and its handle count returns to the map's pre-trigger size
- [x] Task 9: Confirm no integration needed yet (AC: 3)
  - [x] 9.1: Do **not** wire any primitive into `DungeonScreen.tsx`'s `renderFrame`/ticker/transient-delta handling — that's Stories 7.2–7.8's job, each consuming this library with per-ability parameters. This story only needs `tsc --noEmit -p apps/host-client/tsconfig.json` to pass with the new module compiling cleanly and being importable.

### Review Findings

_From adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-07-21._

- [x] [Review][Decision] **Tint-pulse is not parameterized by color or size, and owns no PixiJS lifecycle** — AC1 says every primitive is "parameterized by color, size/scale, and duration" and "manages its own PixiJS `Graphics`/`ParticleContainer` lifecycle". `createTintPulse` takes only `target`/`durationMs`/`min|maxAlpha`, modulates alpha only (never tints), and returns `view: null` because it animates a borrowed `Container`. Options: (a) add an optional `color` that drives `target.tint` during the pulse and restores on dispose, (b) accept the deviation deliberately and amend AC1's wording for this one primitive. Needs your call — both are defensible. [`apps/host-client/src/vfx/primitives.ts:259-279`]

- [x] [Review][Patch] Real primitives have zero test coverage, and the Debug Log's justification for it is false — `pixi.js` does import under vitest, it is only slow to transform on WSL2 [`apps/host-client/src/vfx/vfx.test.ts:5-7`]
- [x] [Review][Patch] Clock-mixing is a silent total-failure mode: primitives default `startedAt` to `performance.now()` while `DungeonScreen.tsx` ticks on `Date.now()` — effects either vanish on frame 1 or never complete and leak forever. Fix by lazily setting `startedAt` on the first `update(now)` instead of at construction [`apps/host-client/src/vfx/types.ts:37`, `primitives.ts:39,106,129,180,224,264`]
- [x] [Review][Patch] `createTintPulse` divides by raw `durationMs`, bypassing `progress()`'s guard → `target.alpha = NaN` when `durationMs <= 0` [`apps/host-client/src/vfx/primitives.ts:272-274`]
- [x] [Review][Patch] `createTrail` computes `fade` from raw `durationMs`, not `progress()` → `NaN` stroke width and alpha handed to PixiJS when `durationMs === 0` [`apps/host-client/src/vfx/primitives.ts:146`]
- [x] [Review][Patch] `progress()` passes `NaN` through — only `durationMs <= 0` is guarded, not `Number.isFinite` [`apps/host-client/src/vfx/types.ts:41-43`]
- [x] [Review][Patch] Particle burst advances position with unclamped `elapsed` while alpha uses clamped `t` — a future `startedAt` sends particles inward, a stalled ticker sends them thousands of px off-origin [`apps/host-client/src/vfx/primitives.ts:66,71`]
- [x] [Review][Patch] `createTintPulse.dispose()` writes `maxAlpha` instead of restoring the target's pre-trigger alpha — a frozen (0.3) or spirit-form player snaps to fully opaque when its cast flash ends [`apps/host-client/src/vfx/primitives.ts:277-279`]
- [x] [Review][Patch] `pointCount: 0` crashes on the first `moveTo` (`% 0` → `NaN` index through a non-null assertion); `pointCount: 1` draws nothing forever while reporting alive [`apps/host-client/src/vfx/primitives.ts:114-121,137-138`]
- [x] [Review][Patch] Ring radius is unclamped — `maxRadius < startRadius` (an implode effect the param names invite) passes a negative radius to `view.circle()` [`apps/host-client/src/vfx/primitives.ts:193-197`]
- [x] [Review][Patch] `createBeam` ignores its `alpha` param until the first `update()`, so it renders fully opaque for the frame it is added [`apps/host-client/src/vfx/primitives.ts:229-236`]
- [x] [Review][Patch] `createBeam` bakes world coordinates into its geometry while burst/ring draw in local space around `view.position` — repositioning or reparenting an effect applies the offset twice for the beam [`apps/host-client/src/vfx/primitives.ts:230`]
- [x] [Review][Patch] Particle burst rebuilds all N circles' geometry and allocates a fill-style literal per particle per frame — AC2's letter is met (no `new Graphics()` per tick) but not its intent; the prior art allocates N `Graphics` once and mutates only `position`/`alpha` [`apps/host-client/src/vfx/primitives.ts:71`]
- [x] [Review][Patch] Burst default particle radius drifted from the prior art it generalizes (4.8-11.2px vs the reward-reveal's 8-16px) — a 7.2 consumer using defaults gets visibly smaller particles [`apps/host-client/src/vfx/primitives.ts:167`]
- [x] [Review][Patch] A reaped `TrailHandle` is an undetectable zombie — the caller keeps calling `moveTo()` into a destroyed `Graphics` with no `disposed` flag to check [`apps/host-client/src/vfx/primitives.ts:132-154`]
- [x] [Review][Patch] One throwing effect aborts the whole `for…of` in `VfxEngine.update()` — every effect after it in insertion order is never updated or reaped again, and the throw repeats at 60fps [`apps/host-client/src/vfx/engine.ts:29-32`]

- [x] [Review][Defer] Same `EffectHandle` added twice gets two ids → double `dispose()` / `update()` on a destroyed view [`apps/host-client/src/vfx/engine.ts:22-27`] — deferred, caller-contract issue, no consumer exists yet
- [x] [Review][Defer] `add()`/`remove()`/`clear()` called from inside an effect's own `update()` are unguarded against reentrancy; `add()` during iteration is visited in the same pass, so a self-respawning effect loops forever [`apps/host-client/src/vfx/engine.ts:24-25,30,45-46`] — deferred, no consumer exists yet
- [x] [Review][Defer] Neither the engine nor any primitive detects an externally destroyed `view`/`target` [`apps/host-client/src/vfx/engine.ts:40-41`, `primitives.ts:273`] — deferred, same failure class as the pre-existing D-2.6-A/D-2.9-A renderer-robustness items
- [x] [Review][Defer] No cap, pooling, or load-shedding on concurrent effects — a per-frame trigger adds one effect per frame with no back-pressure [`apps/host-client/src/vfx/engine.ts:22-27`] — deferred, revisit when 7.2-7.8 reveal real effect volumes

_Dismissed as noise (6): `pickColor` empty-palette → white (trivial caller error, identical outcome either way); `count: 0` / zero-length beam / never-moved trail producing a harmless empty effect; the trail's `prev = null` reset being unreachable under monotonic timestamps; `EffectHandle.view` naming vs the spec's `graphic`/`container` (spec text is stale, `view` is the better name); `moveTo` overflow beyond `pointCount` in one frame (documented ring-buffer behavior); non-monotonic `moveTo` timestamps (subsumed by the clock fix above)._

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 (VFX Prototyping), inserted via `sprint-change-proposal-2026-07-21.md`. Precedes Epics 8-11 (renumbered from old 7-10).
- **Context:** Every ability/projectile/zone/status/boss-attack in the shipped game renders as an undifferentiated flat-color circle. This story builds the shared toolkit; it does not itself change what appears on screen.
- **Goal:** A new `apps/host-client/src/vfx/` module exposing 5 parameterized, self-managing PixiJS effect primitives that Stories 7.2-7.8 will consume.
- **Allowed paths:** `apps/host-client/src/vfx/**` (new). Test file(s) alongside per the module's own convention (host-client has no existing test directory — see Testing Standards below).
- **Blocked paths:** `apps/host-client/src/screens/DungeonScreen.tsx` (read for patterns, but **do not edit** — no integration in this story per AC3), `apps/simulation-server/**`, `packages/game-rules/**`, `packages/shared-types/**`, `packages/net-protocol/**`, `apps/host-client/src/session/host-session.ts` (that whitelist fix is Story 7.7's scope, not 7.1's).
- **Inputs:** `DungeonScreen.tsx` (existing Graphics patterns to generalize from — see task references above), `project-context.md` (PixiJS/perf rules below).
- **Non-goals:** No final pixel art (separate PixelLab pass, untouched). No new abilities/mechanics. No protocol/schema changes. No wiring into `DungeonScreen.tsx` — this is a standalone, unconsumed-until-7.2 library.
- **Ownership check:** Single ownership area — `apps/host-client/**` only, owned by Host Experience Engineer. No split needed.
- **Client-UX hook:** Triggered (host UI change), but every check (join flow, HUD readability, reconnect visibility, couch readability) is **N/A for this story** — nothing renders on screen yet since nothing calls the library. Re-evaluate these checks starting with Story 7.2, the first story that actually triggers a primitive from live gameplay.

### Existing Patterns to Reuse (from `DungeonScreen.tsx`)

- **Create-on-first-seen / cleanup-on-missing:** every existing entity type (`playerGraphics`, `enemyGraphics`, `tetherGraphics`, `statusBadgeGraphics`, `projectileGraphics`, `zoneGraphics`) is a `Map<id, Graphics>` populated lazily and pruned by diffing against the current state each frame (see `renderFrame`, lines 101-330). This story's primitives use the same shape, but keyed by a story-generated effect id instead of a state entity id, and self-prune by elapsed time instead of by "still in state."
- **Mutate-not-allocate per tick:** `Graphics.clear()` + redraw on the *same* object every frame, never `new Graphics()` per frame (see any block in `renderFrame`). Primitives must follow this.
- **Cosine pulse** (`ABILITY_FLASH_MS`, lines 131-133 & 142-144): `alpha = 0.2 + 0.8 * Math.abs(Math.cos(Math.PI * remaining / duration))` — direct source for the tint-pulse primitive.
- **Expanding-ring fade** (purification pulse, lines 462-479; `boss:stomped` ring, lines 593-601): `t = elapsed/duration`, `radius = t * maxRadius`, `alpha = base * (1 - t)` — direct source for the ring/shockwave primitive.
- **Radial particle burst** (reward reveal, lines 704-728): per-particle `angle`/`speed`, position advanced by `vx * elapsed`/`vy * elapsed` from spawn, `alpha = 1 - t` — direct source for the particle-burst primitive.
- The ticker callback (`app.ticker.add(...)`, line 418) runs once per animation frame — this is the "tick-driven render loop" AC2 refers to, distinct from the simulation server's 30Hz authoritative tick.

### Testing Standards — Gap to Work Around

`apps/host-client` currently has **zero test files and no `vitest.config.ts`** of its own (confirmed by search — only `tests/vitest.config.ts` exists, and it's scoped to `tests/contract|e2e|unit/**`, not this package). Its `package.json` has a bare `"test": "vitest run"` script that has never been exercised.

- Do not assume a browser/jsdom/WebGL environment is available. Keep the lifecycle/timing math (progress 0→1, alpha/radius interpolation, "am I done") in plain TypeScript functions/classes that take a `now` timestamp and don't touch `pixi.js` — test those directly in Node. Bind the tested math to actual `Graphics` calls in a thin wrapper that isn't part of the unit test's assertions.
- If a real `pixi.js` import inside a test file turns out to need a DOM (verify quickly — don't assume), add `environment: 'jsdom'` to a new `apps/host-client/vitest.config.ts` and `jsdom` to devDependencies rather than skipping the test.
- One test file is enough per project convention (ponytail: non-trivial logic needs one runnable check, not a suite per function). Cover the lifecycle contract shared by all 5 primitives (trigger → advance → auto-complete → map shrinks back down), not each primitive's individual visual math.

### Project Context Rules (from `project-context.md`)

- **PixiJS Host Renderer:** no game logic, cooldown tracking, or collision checks inside any PixiJS display object — this module is rendering-only, parameterized entirely by its caller.
- **`Math.random()`** is explicitly permitted here — "host UI animations, cosmetic effects" is the one place it's allowed (forbidden only in `packages/game-rules`/`apps/simulation-server`). The particle burst's angle jitter is a legitimate use, same as the existing reward-reveal burst it's generalized from.
- **TypeScript strict mode** required, no `any` without an explicit suppression comment.
- **Ownership:** `apps/host-client/**` is Host Experience Engineer's area — this story stays entirely inside it.
- **Colors:** pass as `number` (e.g. `0xffffff`), matching every existing color usage in `DungeonScreen.tsx` — not CSS hex strings (those only appear in the React/HTML overlay parts of the file, not the PixiJS parts).

### Project Structure Notes

- New directory: `apps/host-client/src/vfx/` (sibling to existing `screens/`, `session/`, `components/`).
- No changes to `apps/host-client/vite.config.ts` aliases needed — internal-only module, imported via relative path from wherever Stories 7.2+ consume it.
- No `packages/ui-kit` involvement — the sprint-change-proposal considered `packages/ui-kit` as an alternative location but the epic itself specifies `apps/host-client/src/vfx/`; this keeps it host-only (ui-kit is shared between host and mobile, and this has no mobile use case).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1: VFX Engine Foundations] (lines 1910-1930)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7: Ability & Environmental VFX Prototyping] (lines 1904-1908, 2061)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-21.md#4. Detailed Change Proposals] (Story 7.1 breakdown, lines 113-115)
- [Source: apps/host-client/src/screens/DungeonScreen.tsx] — all primitive prior-art line references above point here
- [Source: _bmad-output/project-context.md#PixiJS Host Renderer, #Performance Rules, #Code Organization Rules]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, gds-dev-story workflow)

### Debug Log References

- `npx vitest run src/vfx/vfx.test.ts` (in `apps/host-client`) — 4/4 passed.
- `npm run typecheck` (repo-wide, all 10 tsconfigs) — exit 0.
- `npm test` (repo root) — 472 passed / 3 skipped, **2 e2e files failed** with `simulation-server did not start within 60s` (`tests/helpers/server.ts:37`). Those suites spawn a real simulation-server, which is slow/unreliable to boot inside this WSL2 sandbox.
- Re-ran `tests/e2e` in isolation (two-strike rule): **again 2 files failed, but with a different failure set** — 7 passed / 2 skipped / 1 failed, the failure being `expect(heal.hp).toBeGreaterThanOrEqual(allyStart.hp)` in `tests/e2e/ability-dispatch.test.ts:227`, not the previous boot timeout. Two runs, two different failures ⇒ timing-sensitive/flaky under WSL2 load (208s of test time for 10 e2e tests), not a deterministic break. **Not attributable to this story:** the only non-doc files added are under `apps/host-client/src/vfx/**`, nothing outside that directory was modified, and nothing imports the new module yet (AC3) — it cannot affect the simulation server. Flagged for review rather than silently passed.
- ~~`pixi.js` cannot be imported in a plain Node/vitest run (the import hangs)~~ — **this claim was wrong.** My first probe was killed by a 2-minute command timeout and I read that as a hang. The Acceptance Auditor review layer disproved it, and I re-verified: `import { Graphics } from 'pixi.js'` works under a plain `vitest run` (node environment, no jsdom) — it is merely slow to transform on WSL2 (~35s first collect). The test file now imports and exercises the real primitives. No `jsdom` dependency was needed.

### Completion Notes List

**What was built** — `apps/host-client/src/vfx/`, a standalone, not-yet-consumed library:

- `types.ts` — `EffectHandle` (`view` / `update(now): boolean` / `dispose()`), `VfxTriggerParams` (x, y, numeric color, durationMs, alpha, startedAt), `VfxStage` (minimal structural stage so the engine is testable without a renderer), and `progress(now, startedAt, durationMs)` — the clamped 0→1 lifetime fraction every primitive shares.
- `primitives.ts` — the 5 primitives, each parameterized by color/size/duration with no per-ability logic:
  - `createParticleBurst` — generalized from the reward-reveal burst (`DungeonScreen.tsx:704-728`); particle count, speed, spread, radius and a single-color-or-palette all parameterized. Particle array allocated once at trigger.
  - `createTrail` — fixed-size ring buffer of points; `moveTo(x, y, now)` keeps it alive, points expire individually after `durationMs`, effect completes when the last point expires. No prior art; follows the same handle shape as the rest.
  - `createRingShockwave` — generalized from the purification pulse (`:462-479`) and `boss:stomped` ring (`:593-601`); `startRadius`/`maxRadius`, stroke or filled.
  - `createBeam` — origin→target line, geometry drawn once and only `alpha` mutated per frame.
  - `createTintPulse` — generalized cosine flash (`:131-133,142-144`); animates a **borrowed** `Container`, so `view` is `null` (engine never adds/removes it) and `dispose()` restores alpha instead of destroying the target.
- `engine.ts` — `VfxEngine`: one `Map<number, EffectHandle>`, `add()` → id, `update(now)` per ticker frame, auto remove-from-stage + `dispose()` on completion, plus `remove(id)` for early cancel and `clear()` for app teardown.
- `index.ts` — barrel export of the engine, the 5 factories and all param types.

**AC coverage:** AC1 — 5 primitives, each owning its own `Graphics` lifecycle (create-on-trigger / destroy-on-complete), mirroring the create-on-first-seen / cleanup-on-missing pattern. AC2 — no per-frame allocation for an active effect: handles are mutated in place, `Graphics.clear()` + redraw on the same object, particle/point buffers allocated once at trigger. AC3 — `DungeonScreen.tsx` untouched (blocked path respected); the library compiles and is importable but is deliberately unconsumed until 7.2.

**Hooks triggered:** Pre-task hook — recorded in Dev Notes, respected (only `apps/host-client/src/vfx/**` written). Ownership hook — single area (Host Experience Engineer), no violation, no split needed. Client-UX hook — triggered but every check is N/A (nothing renders yet); re-evaluate at 7.2. Contract-change hook — **not** triggered: no `shared-types`/`net-protocol`/session-lifecycle/reconnect/room-state/prediction surface touched. Telemetry hook — N/A, no new user flow.

**Deliberate simplifications:** the test covers the lifecycle contract shared by all 5 primitives rather than each primitive's visual math (one runnable check per project convention); `createBeam` takes an explicit endpoint rather than angle+length (callers compute it) — add the overload if 7.2-7.8 keep converting.

**Unresolved:** the 2 flaky/environment-blocked e2e suites above (pre-existing, outside this story's scope — worth a separate look at `tests/e2e/ability-dispatch.test.ts` heal assertion under load); visual correctness of each primitive is unverifiable until Story 7.2 puts one on screen.

**Post-review changes (2026-07-21, all 15 patch findings + the decision item applied):**

- **Clock contract redesigned.** No primitive reads a clock any more: `startedAt` is captured from the first `update(now)`, so whatever clock the ticker uses automatically becomes the effect's clock. This removes the review's worst finding — mixing `Date.now()` (what `DungeonScreen.tsx` uses) with `performance.now()` (the old default) made effects either vanish on frame 1 or never complete and leak forever, silently, with no exception. `TrailHandle.moveTo(x, y, now)` now requires the timestamp for the same reason.
- **NaN guards.** `progress()` rejects non-finite inputs and non-positive durations; trail and tint-pulse now route through it instead of dividing by raw `durationMs`. Ring radius is clamped at 0 so an implode (`maxRadius < startRadius`) cannot pass a negative radius to PixiJS. `pointCount` is clamped to a drawable minimum of 2 (0 previously crashed with a `% 0` NaN index laundered through a non-null assertion).
- **Particle burst rewritten to a `Container` + N child `Graphics`**, matching the prior art: geometry is drawn once and only `position`/`alpha` are mutated per frame. The previous version re-tessellated every circle and allocated a fill-style literal per particle per frame — AC2's letter but not its intent. Particle radius default restored to the prior art's 8-16px.
- **Tint-pulse** takes an optional `color` that drives `target.tint` for the pulse (AC1's color parameterization; the borrowed-`Container` design and `view: null` are kept deliberately), and `dispose()` now restores the target's *captured* pre-trigger alpha/tint instead of writing `maxAlpha` — a frozen player at 0.3 alpha no longer snaps to fully opaque when its cast flash ends.
- **Beam** draws in local space around `view.position` like the other primitives, and applies its `alpha` at construction so it is not fully opaque on the frame it is added.
- **`TrailHandle.disposed`** lets a caller detect a reaped trail instead of silently pushing points into a destroyed `Graphics`.
- **`VfxEngine.update()` isolates a throwing effect** (reaps it, logs it) rather than aborting the whole loop — previously one bad effect froze every effect behind it permanently and re-threw at 60fps.
- **Tests rewritten against the real primitives** — 24 tests covering the shared lifecycle contract on a `Date.now()`-scale clock, zero-duration/backwards-clock/stalled-ticker edges, the burst's allocate-once behavior, trail expiry and `pointCount` clamping, ring implode, beam alpha and local-space position, tint-pulse alpha/tint restore, and engine reaping including the throwing-effect case. Two of these tests failed on first run — both were my test bugs (a "zero duration" case that passed 100ms, and a comparison across two bursts with independently randomized speeds), fixed and re-run green.

4 findings deferred to `deferred-work.md` as D-7.1-A…D (engine reentrancy, double-add, externally destroyed views, no effect cap) — all caller-contract or volume issues with no consumer until 7.2. 6 dismissed as noise.

Confidence: 92% — typecheck green, 24/24 primitive tests green, and the review's silent-failure modes are closed. Still unrendered by a real PixiJS renderer by design (AC3), so visual tuning may follow in 7.2.

### File List

- `apps/host-client/src/vfx/types.ts` (new)
- `apps/host-client/src/vfx/primitives.ts` (new)
- `apps/host-client/src/vfx/engine.ts` (new)
- `apps/host-client/src/vfx/index.ts` (new)
- `apps/host-client/src/vfx/vfx.test.ts` (new)
- `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md` (modified — status, tasks, review findings, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — D-7.1-A…D from code review)

## Change Log

| Date | Change |
|---|---|
| 2026-07-21 | Implemented Story 7.1 — new `apps/host-client/src/vfx/` module: `VfxEngine` lifecycle owner + 5 parameterized PixiJS primitives (particle burst, trail, ring/shockwave, beam, tint pulse) + lifecycle test. No integration into `DungeonScreen.tsx` (AC3). |
| 2026-07-21 | Addressed code review findings — 16 items resolved (1 decision + 15 patches): clock contract redesigned to lazy `startedAt`, NaN/negative-radius/`pointCount` guards, particle burst rewritten to allocate-once child Graphics, tint-pulse gains optional `color`→`tint` and restores captured pre-trigger state, beam local-space + immediate alpha, `TrailHandle.disposed`, engine isolates throwing effects. Tests rewritten against the real primitives (24 tests). 4 deferred (D-7.1-A…D), 6 dismissed. |

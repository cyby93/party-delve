---
baseline_commit: f5b9748
---

# Story 7.15c: Render Aim Arrow & Destination Preview

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. **Blocked by Story 7.15a**
  (contract). Functionally depends on Story 7.15b for anything to render at
  all; 7.15d is what makes `RELEASE`-type abilities produce a stream, so with
  7.15b but not 7.15d only `AUTO`/`AIM_CAST` arrows will appear. No dependency
  on 7.15c ↔ 7.15d ordering. No relationship to Stories 7.14a/7.14b.

Context: ADR-0008 (Accepted) assigns the host exactly one job here — render
  what the `ability:aim-preview` delta already resolved, and never re-derive
  placement. Everything spatial in the delta (direction, and `targetX`/`targetY`
  for the four destination-preview abilities) is computed server-side by Story
  7.15b precisely so the host cannot drift from it.

  **The contract has no "stopped aiming" event, and this story must handle
  that.** 7.15a's contract is a single delta type, `ability:aim-preview`. The
  phone simply *stops sending* on release, fire, or touch-cancel (7.15d) —
  there is no cancel message and no `aiming: false` flag. So "the arrow clears
  when the player stops aiming" is not something the host is told; it is
  something the host must **infer from absence**. Designing that inference —
  a per-player staleness timeout plus an explicit clear on `ability:fired` — is
  the substantive engineering in this story, not the drawing.

  Second structural point: every VFX the host renders today is either a
  self-expiring `VfxEngine` effect (fires once, fades, is reaped) or a
  per-frame `Graphics` redrawn from snapshot state (bond tethers,
  `DungeonScreen.tsx:400-428`; status auras, `:430-528`). An aim preview is the
  second kind — it persists for an unbounded duration and must follow a moving
  caster every frame. Do **not** model it as a fire-and-forget `VfxEngine`
  primitive with a `durationMs`; that fights the engine's whole lifecycle.

Owner: Host Experience Engineer (CLAUDE.md Ownership Rules).

Goal: Render a translucent aim-direction arrow for any aiming player, plus a
  ghosted destination/zone preview for the four destination-preview abilities,
  and clear both promptly and correctly.

Allowed paths:
  - apps/host-client/**
  - packages/ui-kit/**  (host-side only; not expected to be needed)

Blocked paths:
  - apps/simulation-server/**    (Story 7.15b)
  - apps/mobile-controller/**    (Story 7.15d)
  - packages/shared-types/**     (Story 7.15a)
  - packages/net-protocol/**     (Story 7.15a)
  - packages/game-rules/**       (never importable from host)
  - apps/backend-platform/**

Inputs:
  - docs/adr/ADR-0008-aim-preview-contract.md (Decision, "Host:" paragraph)
  - apps/host-client/src/session/host-session.ts:42-97 (the `onTransientDelta`
    whitelist — `ability:aim-preview` must be added, exactly as 7.13 added
    `ability:chain-hit` at `:85-90`)
  - apps/host-client/src/screens/DungeonScreen.tsx:400-428 (bond tethers — the
    per-frame persistent-`Graphics` pattern to follow)
  - apps/host-client/src/screens/DungeonScreen.tsx:430-528 (status auras — the
    add/reposition/remove-on-absence lifecycle to follow)
  - apps/host-client/src/screens/DungeonScreen.tsx:1013-1360 (the delta
    dispatch effect the new branch joins)
  - apps/host-client/src/vfx/primitives.ts:240-338 (`createConeWedge` — the
    sector geometry, including the hard-won arc-start-angle fix from 7.13's
    manual pass; reuse the math, see Dev Notes)
  - apps/host-client/src/vfx/primitives.ts:189-233 (`createRingShockwave`)
  - packages/shared-types/src/ability-geometry.ts (`ABILITY_GEOMETRY`,
    `STORM_EYE_ZONE_RADIUS_PX` = 150 — read live, never hand-copied)
  - _bmad-output/implementation-artifacts/7-15b-aim-preview-resolution.md
    (its zero-aim-suppression decision and its Dark Pact preview choice are
    binding on what this story will actually receive)

Non-goals:
  - NO protocol or sim changes. This story only consumes 7.15a/7.15b's delta.
  - NO re-derivation of `targetX`/`targetY`. If the delta omits them, render no
    destination preview — do not compute one host-side from `ABILITY_GEOMETRY`.
    (`ABILITY_GEOMETRY` is still read for *shape* — cone angle, zone radius —
    which the delta does not carry. Reading geometry is fine; recomputing the
    aim point is the forbidden thing.)
  - NO destination preview for Void Pulse or Tempest Hurl. They are `RELEASE`
    abilities and get an arrow, but their landing point is genuinely unknowable
    at aim time (see 7.15b's table) and the sim will send no target for them.
  - NO new aim-cancel message. If the staleness inference proves inadequate in
    the manual pass, that is a finding to raise for a future contract story,
    not something to add here (`packages/net-protocol/**` is Blocked).
  - NO hub-specific work. If Story 7.14b has landed, the shared VFX module may
    make hub support fall out for free — that is welcome but not an AC here,
    and 7.14a does not broadcast aim previews' prerequisites in hub anyway.

Required hooks:
  - **Client-UX hook (TRIGGERED)** — host rendering code changed.
    Host checks: join flow smoke test, host HUD readability, reconnect state
    visibility, **couch readability** (the important one here — see Dev Notes
    on legibility with up to 8 simultaneous aim arrows on a shared screen).
    No display in this implementation sandbox — disclose the manual pass as
    outstanding in Completion Notes rather than claiming it was performed,
    matching 7.5/7.6/7.7b/7.13/3.23/dev-3's precedent.
  - Contract-change hook: NOT triggered (no shared-types/net-protocol edit).
  - Simulation-safety hook: NOT triggered (no sim/game-rules edit).
  - Ownership hook: NOT triggered (single owner).
  - Telemetry hook: no new user flow — aiming is an existing input gesture
    gaining a visualization. No new KPI event.

Required tests:
  - Pure-function coverage for whatever geometry helper the previews use
    (the codebase convention: `plan*`/`resolve*` are unit-tested with no
    PixiJS; `spawn*`/`trigger*` executors are thin and typically not).
  - The staleness/clear logic must be a pure, testable function of
    (lastSeenAtMs, nowMs) — not logic buried in a render loop. Test: a preview
    older than the timeout is dropped; one inside it is kept; an
    `ability:fired` for that player clears immediately regardless of age.
  - Existing `apps/host-client/src/vfx/` suite stays green.
  - `npm run typecheck` (10 tsconfigs) + `npm test` at repo root.
  - Manual Client-UX pass (see hook note — disclose, do not fake).

Telemetry impact: None — cosmetic-only.
```

---

## Story

As a player,
I want to see where my aimed ability is currently pointing, and where a zone-targeted ability will land if I release now,
so that I can adjust my aim before committing to the cast.

---

## Acceptance Criteria

**AC1 — the delta reaches the host:**
**Given** `host-session.ts:42-97`'s `onTransientDelta` whitelist, which forwards deltas by type
**When** this story ships
**Then** `ability:aim-preview` is added to it, with a comment in the established style noting this is host-local delivery filtering only (`applyDelta` runs unconditionally below and already treats it as a state no-op per 7.15a)

**AC2 — aim-direction arrow:**
**Given** any player is aiming an ability
**When** an `ability:aim-preview` delta for them is live
**Then** a translucent aim-direction arrow renders from that player's current position along the delta's direction — for `AUTO`/`AIM_CAST` abilities driven by the live fire-direction stream, for `RELEASE`-type abilities by the new preview stream
**And** the arrow follows the caster's position every frame (the caster can move while aiming), rather than being frozen at the position held when the delta arrived

**AC3 — destination/zone preview for the four named abilities:**
**Given** Storm Eye, Stone Wall, Dark Pact, and Crimson Lash specifically
**When** their `targetX`/`targetY` is present in the delta
**Then** a ghosted preview renders at that point: a **circle** for Storm Eye sized to `STORM_EYE_ZONE_RADIUS_PX` (150); a **cone** for Stone Wall and Crimson Lash, apex at the caster, oriented along the aim, spanning `ABILITY_GEOMETRY[class][idx].coneAngleDeg` (50° / 45°) out to `hitRangePx` (160 / 180), reusing 7.13's cone-wedge geometry; and Dark Pact's existing hit-shape — a circle of `hitRadiusPx` (80) at the target point
**And** every one of those shape values is read live from `ABILITY_GEOMETRY`, never hand-copied

**AC4 — clears on fire:**
**Given** an ability fires
**When** the corresponding `ability:fired` delta arrives for that player
**Then** that player's arrow and any destination preview clear immediately, in the same dispatch pass — before the cast's own VFX renders, so the two never overlap for a frame

**AC5 — clears when aiming stops, with no cancel message to rely on:**
**Given** the contract carries no aim-cancel event — the phone simply stops sending on release, fire, or touch-cancel
**When** no `ability:aim-preview` has arrived for a player within a defined staleness window
**Then** their arrow and destination preview clear
**And** the window is a named constant, justified in Completion Notes against the ~33ms send cadence and the 30hz tick (a value too small flickers on a single dropped packet; too large leaves a ghost arrow after release), and the staleness decision is implemented as a pure, unit-tested function rather than inline render-loop logic

**AC6 — multi-player couch readability:**
**Given** up to `MAX_PLAYERS` (8) players may aim simultaneously on one shared screen
**When** several previews are live at once
**Then** each is attributable to its caster (per-player session colour, consistent with every other player-owned visual on the host) and translucent enough not to obscure gameplay entities beneath it
**And** the previews render **below** player/enemy sprites in the display list, matching how bond tethers and status auras already insert at index 0

**AC7 — no re-derivation:**
**Given** ADR-0008's core rule
**When** the destination preview is drawn
**Then** its position comes solely from the delta's `targetX`/`targetY`; the host computes no aim point of its own, and a delta with no target renders an arrow only

**AC8 — hooks:**
**Given** the Client-UX hook (host rendering changed; no Contract-change or Simulation-safety trigger)
**Then** the manual Client-UX pass is required before merge, performed by a human — disclose it as outstanding rather than claiming it was done

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `host-session.ts`: add `delta.type === 'ability:aim-preview' ||` to the `onTransientDelta` whitelist, with a comment matching the `ability:chain-hit` entry's style (`:85-90`).
- [x] **Task 2** (AC: #5) — Write the aim-preview *state* layer before any drawing: a per-player record of `{ abilityIndex, directionX, directionY, targetX?, targetY?, lastSeenAtMs }`, updated on each delta, cleared on `ability:fired` and on staleness. Put the staleness predicate in a pure function in `apps/host-client/src/vfx/` and unit-test it. Define `AIM_PREVIEW_STALE_MS` as a named constant with its justification in a source comment.
- [x] **Task 3** (AC: #2, #6) — Render the arrow as a per-frame persistent `Graphics`, following the bond-tether pattern (`DungeonScreen.tsx:400-428`): one `Graphics` per aiming player, created on first sighting, repositioned/redrawn every frame from the caster's *current* snapshot position, destroyed on clear. Insert at stage index 0 so it sits below sprites. Colour from `SESSION_COLOR_HEX[player.sessionColor]`.
- [x] **Task 4** (AC: #3, #7) — Render the destination previews into the same per-frame `Graphics` (or a sibling one), branching on the ability's `hitShape`/`delivery` read from `ABILITY_GEOMETRY`:
  - [x] Subtask 4.1 — Storm Eye: circle at `(targetX, targetY)`, radius `STORM_EYE_ZONE_RADIUS_PX`.
  - [x] Subtask 4.2 — Stone Wall / Crimson Lash: cone sector, apex at caster, along the delta direction, `coneAngleDeg` wide, `hitRangePx` long — reusing 7.13's sector geometry, not a fresh derivation (see Dev Notes).
  - [x] Subtask 4.3 — Dark Pact: circle at `(targetX, targetY)`, radius `hitRadiusPx` (80).
  - [x] Subtask 4.4 — any delta without `targetX`/`targetY`: arrow only, no shape. Verify this covers Void Pulse and Tempest Hurl.
- [x] **Task 5** (AC: #4) — Add the `ability:fired` clear. Place it so the clear happens before the cast VFX is spawned in the same dispatch pass.
- [x] **Task 6** (AC: #6, #8) — Legibility pass parameters: alpha, arrow length/width, and cone fill vs. outline. Pick defaults, document them as tunable-in-one-place constants, and flag them as the primary thing the manual pass should judge.
- [x] **Task 7** — Full regression: `npm run typecheck` (10 tsconfigs), `npm test`. Do **not** chase the documented pre-existing failures (Stone Wall centering in `ability-vfx.test.ts`, the intermittent Ancestor's Voice e2e heal assertion, WSL2 e2e port-binding timeouts).
- [x] **Task 8** (AC: #8) — Manual Client-UX pass per Required hooks. No display in this sandbox — disclose as outstanding in Completion Notes.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### The missing cancel event is the real design problem

Worth restating because it is easy to miss while reading the epic's AC ("the player stops aiming ... the arrow and any destination/zone preview clear immediately"). Nothing tells the host that. 7.15d's phone stops sending; 7.15b's sim stops broadcasting; the host observes silence. Silence is indistinguishable from a dropped packet or a stalled connection, which is exactly why the window must be a deliberate, justified value rather than "one tick".

Sizing input: the phone sends at ~33ms (`INPUT_INTERVAL_MS`, `ControllerScreen.tsx:22`, and the `SkillCell` auto-interval at `:713`), the sim ticks at 30hz, and the host receives over the same WebSocket that already carries `player:moved` at the same cadence. A window of roughly 3-5 send intervals (~100-165ms) is the sane starting range: long enough to ride out a dropped frame, short enough that a released aim clears within a fifth of a second. Pick a value, name it, justify it, and let the manual pass adjust it.

Note the asymmetry that makes this tolerable: AC4's `ability:fired` clear handles the overwhelmingly common case (release → fire), which is immediate and exact. The staleness window only has to cover the *uncommon* exits — touch-cancel, connection stall, a `RELEASE` drag abandoned on cooldown. Getting it slightly wrong degrades to a briefly-lingering ghost arrow, not a wrong gameplay signal.

### Persistent `Graphics`, not a `VfxEngine` effect

`VfxEngine` effects are self-expiring: `update(now)` returns false and the engine reaps them. An aim preview has no duration — it lives until an external event ends it, and it must track a moving caster. Modelling it as an effect would mean either re-adding it every frame (allocation churn the engine explicitly avoids, `engine.ts:5-8`) or giving it an artificial duration that has to be refreshed.

Follow the bond-tether pattern instead (`DungeonScreen.tsx:400-428`): a `Map<playerId, Graphics>`, entries created on first sighting, `clear()`-and-redraw every frame from live positions, `removeChild` + `destroy()` + `delete` on removal. Status auras (`:430-528`) show the same add/reposition/remove-on-absence lifecycle against a snapshot-derived active set — the aim-preview state map plays the role the aura's `activeAuraIds` set plays there.

Consequence for Story 7.14b: if that story has already extracted the per-frame render blocks into a shared module, add the aim-preview render there so the hub inherits it; if not, add it to `DungeonScreen.tsx` alongside the tethers. Either way this story does not create a *second* frame-loop mechanism.

### Reuse 7.13's cone geometry — do not re-derive the sector

`createConeWedge` (`primitives.ts:240-338`) already encodes the sector construction, including a fix that cost a full manual-QA round to find: PixiJS's `GraphicsContext.arc()` does not insert an implicit connecting segment from the current path point to the arc's start (unlike Canvas2D), so the initial `lineTo` must target the arc's own start-angle tip. Getting that wrong produced a shape filling ~12% of the intended area — a sliver near the rim, easily mistaken for "nothing rendered". The regression test for it (`vfx.test.ts`) reads the real filled polygon via Pixi's `shapePath` getter and checks the shoelace area against the closed-form `0.5 · r² · angleRad`.

If the ghost cone is drawn by re-deriving the sector path inline, that bug comes straight back and the existing test will not catch it (it tests the primitive, not the new code). Extract the path construction from `createConeWedge` into a shared helper used by both, or draw the preview *through* a static-alpha variant of the primitive. Whichever route is taken, add an area-based assertion for the preview shape too — a bounds-only test provably does not catch this class of bug.

### Which shape for which ability — read it, don't type it

| Ability | Class[idx] | Preview shape | Source values |
|---|---|---|---|
| Storm Eye | stormcaller[3] | circle at target | `STORM_EYE_ZONE_RADIUS_PX` (150) |
| Stone Wall | stonehide[0] | cone from caster | `coneAngleDeg` 50, `hitRangePx` 160 |
| Crimson Lash | souldrinker[1] | cone from caster | `coneAngleDeg` 45, `hitRangePx` 180 |
| Dark Pact | souldrinker[2] | circle at target | `hitRadiusPx` 80 |
| Void Pulse | souldrinker[3] | arrow only | — (no target sent) |
| Tempest Hurl | stormcaller[1] | arrow only | — (no target sent) |
| Every `AUTO`/`AIM_CAST` ability | — | arrow only | — (no target sent) |

Every number in that table must come from `ABILITY_GEOMETRY` at runtime. Reading geometry for *shape* is permitted and necessary — the delta carries a point, not a radius. Recomputing the *point* is what AC7 forbids.

Note the two cones anchor at the **caster**, not at the target point, and must therefore re-orient every frame as the caster moves — the same live-position requirement as the arrow.

### Couch readability is the acceptance risk here

The host screen is designed for 2-4m viewing (project-context.md). Eight translucent arrows plus up to four ghost cones/circles over a combat scene is a real clutter risk, and it is the kind of thing that only a human on an actual display can judge. Make the alpha/width/length values single-source constants at the top of the module so the manual pass can be a tuning pass rather than a refactor. 7.13's history is instructive: its cone VFX needed four rounds of manual tuning (colour contrast, composition, then a 2× pacing change) after passing every automated check.

### Testing Standards

- Established Epic 7 convention: pure planners (`plan*`/`resolve*`) are unit-tested with no PixiJS/canvas; executors touching `VfxEngine`/`Graphics` are thin and typically not separately tested. Push as much of this story's logic as possible to the first side — the staleness predicate and the shape-selection lookup are both naturally pure.
- No `DungeonScreen.tsx` component test file exists or should be introduced (7.11/7.13 precedent).
- Geometry assertions on filled shapes must check **area**, not just `getLocalBounds()` — see the cone note above.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase, do not claim fixed): `ability-vfx.test.ts` Stone Wall centering; the intermittent Ancestor's Voice e2e heal assertion; WSL2 e2e port-binding timeouts.

### Project Structure Notes

- New code belongs under `apps/host-client/src/vfx/` in kebab-case (e.g. `aim-preview.ts`), exported through the existing `vfx/index.ts` barrel like every sibling module.
- The render call belongs wherever the per-frame snapshot rendering lives at the time this story runs — `DungeonScreen.tsx`'s `renderFrame` if 7.14b has not landed, the shared module if it has.
- Not `packages/ui-kit/**`: the vfx tree imports PixiJS, host-only per project-context.md's surface table.

### Project Context Rules

- **PixiJS Host Renderer rule**: "No game logic, cooldown tracking, or collision checks inside any PixiJS display object." The preview is rendering-only, reading already-resolved deltas and snapshot positions.
- **`renderFrame(mirrorState)` once per tick with a snapshot reference** — do not read `mirrorState` properties inside individual display-object updates.
- **Monorepo Ownership**: `apps/host-client/**` = Host Experience Engineer. Never import `packages/game-rules` or `planck.js`.
- **Host may never mutate `GameState`** — the aim-preview state map is host-local presentation state, held in a `useRef`, never written back into `mirrorState`.
- **Colors** are PixiJS numeric literals (`0xrrggbb`), never CSS strings — use the existing `SESSION_COLOR_HEX` table.
- **`Math.random()`** is permitted only for cosmetic host-side effects; this story needs none.

### References

- [Source: `docs/adr/ADR-0008-aim-preview-contract.md`] — Decision, "Host:" paragraph (arrow + per-ability shapes + clear-on-fire).
- [Source: `apps/host-client/src/session/host-session.ts:42-97`] — the whitelist; `:85-90` is the comment style to mirror.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:69-78`] — `SESSION_COLOR_HEX`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:400-428`] — bond tethers, the persistent-`Graphics` pattern.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:430-528`] — status auras, the add/reposition/remove-on-absence lifecycle.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:1013-1360`] — the delta dispatch effect; `:1030-1186` is the `ability:fired` branch AC4 hooks into.
- [Source: `apps/host-client/src/vfx/primitives.ts:240-338`] — `createConeWedge` and its arc-start-angle fix.
- [Source: `apps/host-client/src/vfx/vfx.test.ts`] — the shoelace-area cone test; the assertion style AC3's shape needs.
- [Source: `apps/host-client/src/vfx/engine.ts:5-8`] — the no-per-frame-allocation contract that argues against modelling the preview as an effect.
- [Source: `packages/shared-types/src/ability-geometry.ts:49-74`, `:110`] — `ABILITY_GEOMETRY`, `STORM_EYE_ZONE_RADIUS_PX`.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:22`, `:713`] — the ~33ms send cadence AC5's window is sized against.
- [Source: `_bmad-output/implementation-artifacts/7-15a-aim-preview-contract.md`] — the delta shape consumed.
- [Source: `_bmad-output/implementation-artifacts/7-15b-aim-preview-resolution.md`] — zero-aim suppression and the Dark Pact preview choice, both binding on what arrives here.
- [Source: `_bmad-output/implementation-artifacts/7-13-cone-wedge-chain-lightning-and-tempest-hurl-vfx.md`] — the manual-pass history behind the cone-geometry warning.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.15c section.
- [Source: `_bmad-output/project-context.md`] — PixiJS Host Renderer rules, Host Screen Constraints, Monorepo Ownership.
- [Source: `CLAUDE.md`] — Ownership Rules, Client-UX hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- One typecheck failure, fixed immediately: `exactOptionalPropertyTypes: true` is on repo-wide, so `{ targetX: delta.targetX }` where `targetX` is `number | undefined` is rejected — an absent optional must be an **absent key**, not a present key holding `undefined`. Switched to a conditional spread. This is not a lint nicety here: the renderer branches on whether the key exists to decide if a destination ghost should draw at all, so the distinction is load-bearing.
- One signature-propagation pass: adding `aimPreviewGraphics`/`colorForPlayer` to `SnapshotVfxParams` surfaced the `HubWorldScreen` call site immediately (typecheck named it), which is the extraction from Story 7.14b paying off — the hub got aim previews for free rather than needing its own copy.
- `npm run typecheck` clean (10/10). New unit suite 20/20 on the first run.

### Completion Notes List

- **Task 1 / AC1 — whitelist.** `ability:aim-preview` added to `host-session.ts`'s `onTransientDelta` chain, with the established host-local-delivery-filtering comment. Also recorded *why* this one earns its volume where `zone:tick` was deliberately excluded: the sim caps it at one per aiming player per tick (Story 7.15b), and it is the only signal the aim visuals have.
- **Task 2 / AC5 — the state layer was built before any drawing, as the story required, because it is the actual engineering here.** New `vfx/aim-preview.ts` owns `AimPreviewState`, the pure `isAimPreviewStale(lastSeenAtMs, nowMs)` predicate, and `pruneStaleAimPreviews`. Keeping the predicate pure (rather than inline in the render loop) is what makes AC5 testable at all.
- **`AIM_PREVIEW_STALE_MS = 150`, justified rather than picked.** The phone sends at `INPUT_INTERVAL_MS` (33ms) and the sim broadcasts at most once per 30hz tick, so 150ms is ~4-5 refresh intervals: long enough to ride out a dropped frame without the arrow strobing, short enough that an abandoned aim clears within a sixth of a second. There is a test asserting the value stays in whole refresh intervals, specifically to stop a later "tighten this up" change reducing it to one tick.
- **The staleness window is the *sole* mechanism for every non-fire exit — including the path the 7.15a review surfaced.** `ability:fired` handles the common exit (release → cast) exactly and immediately. But a drag that ends while the ability is on cooldown produces **no `ability:fired` either**, because `dispatchAbility` rejects the cast and `GameRoom` `continue`s before broadcasting. Touch-cancel and a backgrounded phone are the same shape. All of these are named explicitly in the source comment, per the binding note carried in from 7.15a's decision record.
- **Two deliberate degradation properties, both pinned by tests:** a non-finite `lastSeenAtMs` is treated as **stale**, not as infinitely fresh — the latter would pin an arrow on screen permanently with no way to clear it. And a backward `Date.now()` step (NTP correction; `Date.now()` is not monotonic) makes a preview look *fresher*, so it lingers for at most the size of the step rather than clearing early. That is the safe direction to fail, and the test says so rather than leaving it accidental.
- **Task 3 / AC2, AC6 — persistent `Graphics`, not a `VfxEngine` effect.** Modelled on the bond-tether/status-aura lifecycle: created on first sighting, `clear()`-and-redrawn every frame from the caster's *current* snapshot position, destroyed and removed when the entry goes. This matters beyond style — the caster can walk while aiming, and both the arrow and a cone ghost are apex-anchored to them, so neither may be frozen at the position held when the delta arrived. Inserted with `addChildAt(g, 0)` so previews sit below sprites, and coloured from `SESSION_COLOR_HEX[player.sessionColor]` so each is attributable with up to 8 live at once.
- **Players who stop being able to aim are dropped, not just skipped.** A caster who leaves, goes down, becomes a spirit, or disconnects has their entry deleted rather than merely not drawn — otherwise it would sit in the map and resurrect the instant they came back.
- **Task 4 / AC3, AC7 — shapes read live, points never re-derived.** `resolveAimPreviewShape` is a pure, table-driven function over `ABILITY_GEOMETRY`: Storm Eye → circle at `STORM_EYE_ZONE_RADIUS_PX` (150, deliberately **not** its `hitRadiusPx` of 80 — the ghost must match the zone that actually gets placed), Stone Wall/Crimson Lash → cone at their live `coneAngleDeg`/`hitRangePx`, Dark Pact → circle at `hitRadiusPx`. Reading geometry for *shape* is necessary because the delta carries a point, not a radius or an angle; recomputing the *point* is what ADR-0008 forbids, and nothing here does — every draw uses the delta's own `targetX`/`targetY`.
- **`Number.isFinite` rather than `!== undefined` on the target check.** Directly from the 7.15a review: JSON turns a non-finite number into `null`, which passes an undefined check and then coerces to `0` — drawing the destination ghost at the world origin. This is the exact trap the contract comment now documents, and the renderer guards it.
- **The cone sector geometry is extracted, not re-derived — this was the single highest-risk part of the story.** `coneSectorPoints` builds the polygon apex-first, mirroring `createConeWedge`'s construction. Story 7.13's manual pass proved why: PixiJS's `GraphicsContext.arc()` does not insert an implicit connecting segment from the current path point to the arc's start (unlike Canvas2D), and getting the initial `lineTo` wrong produced a shape filling **~12% of the intended area** — a sliver near the rim, indistinguishable from "nothing rendered". A hand-rolled second sector here would have reintroduced exactly that, and 7.13's regression test guards the *primitive*, not this code. The new tests therefore assert **shoelace area against the closed-form sector area** (`0.5·r²·θ`) across 5 directions × 4 angles, because a `getLocalBounds()` check passes for both the correct pie slice and the broken sliver.
- **Task 6 — legibility constants are single-source and tunable in one place** (`AIM_ARROW_LENGTH_PX`, `_WIDTH`, `_ALPHA`, `_HEAD_PX`, `_ORIGIN_OFFSET_PX`, `AIM_ZONE_FILL_ALPHA`, `AIM_ZONE_RIM_ALPHA`, `AIM_ZONE_RIM_WIDTH`), exported from the barrel. Chosen so the manual pass is a *tuning* pass rather than a refactor — 7.13's cone VFX needed four rounds of manual adjustment after passing every automated check, and this story has the same shape of risk. The arrow's tail is offset 26px from the caster's centre so it does not appear to grow out of the body, and the head is two swept-back barbs so direction reads at couch distance even when the shaft is faint.
- **Hub support fell out for free** from Story 7.14b's extraction — both screens call the same `renderSnapshotVfx`, so `HubWorldScreen` renders aim previews with no hub-specific code. Not an AC here (the story's Non-goals say so), and note it will show nothing in the hub in practice today: Story 7.14a leaves the ability resolution that produces these previews dungeon-gated. Wiring it now costs nothing and avoids a second integration later.
- **Carried-forward finding from Story 7.15b that this story does NOT fix, and that the manual pass must judge:** `AUTO` abilities do not stream direction at 33ms as ADR-0008 assumed. The 2026-07-25 cooldown-sync fix added a cooldown skip to `SkillCell`'s auto-interval, so an `AUTO` ability sends only when off cooldown — roughly once per 1000-1500ms. That is far longer than `AIM_PREVIEW_STALE_MS`, so **an `AUTO` ability's aim arrow will blink rather than persist**: appear on each cast, expire 150ms later, reappear on the next. `AIM_CAST` (Soul Mend) is unaffected — it channels with no cooldown and really does stream at 33ms; `RELEASE` abilities are unaffected because Story 7.15d streams them properly. Three options if the manual pass judges the blink unacceptable: raise the window for `AUTO` only, drop `AUTO` arrows entirely, or change mobile's cooldown skip (which was itself a deliberate anti-flooding fix, so that is the expensive option). Deliberately not chosen here — it is a judgement that needs a display.
- **Required hooks:**
  - **Client-UX hook TRIGGERED — the manual pass was NOT performed.** No display in this sandbox; same disclosed limitation as 7.5/7.6/7.7b/7.13/3.23/dev-3/7.14b. A human must verify: (1) the arrow tracks the drag for all six `RELEASE` abilities and clears on release; (2) the four destination ghosts land where the ability lands — Storm Eye's circle over the real zone, Stone Wall/Crimson Lash's cones matching their real sweep, Dark Pact's circle at its search centre; (3) **the cone ghosts actually render as full pie slices, not slivers** — the specific 7.13 failure this code's geometry is designed to avoid; (4) couch readability with several players aiming at once over a combat scene; (5) the `AUTO` blink described above; (6) that a preview clears when a drag is abandoned on cooldown, which is the one path with no `ability:fired` backstop.
  - Contract-change hook NOT triggered — zero diff under `packages/shared-types/` and `packages/net-protocol/`.
  - Simulation-safety hook NOT triggered — no sim or game-rules file touched.
  - Ownership hook NOT triggered — production changes confined to `apps/host-client/**`.
- **Regression:** `npm run typecheck` clean (10/10 tsconfigs). `apps/host-client/src/vfx/` suite: 136 passed, 1 failed — the pre-existing Stone Wall centering assertion, unchanged. `npm test`: 728 passed, 1 failed, 11 skipped across 59 files; the four "failed" e2e files all hit the WSL2 port-binding timeout with tests skipped, and `tests/e2e/aim-preview.test.ts` passes 7/7 in isolation. Zero regressions attributable to this story.
- **Confidence: 80%.** The staleness logic, the shape resolution, and the cone geometry each have direct unit coverage, and the geometry test is specifically the area-based kind that would catch the one bug this code is most at risk of. The 20% reservation is entirely visual and unverifiable without a display: no automated test renders a single pixel, the legibility constants are reasoned rather than seen, and the `AUTO` blink is a known behaviour whose acceptability is a judgement call I cannot make from here.

### File List

- `apps/host-client/src/vfx/aim-preview.ts` — **new.** `AimPreviewState`, `AIM_PREVIEW_STALE_MS` with its justification, pure `isAimPreviewStale`/`pruneStaleAimPreviews`, `resolveAimPreviewShape` (table-driven off `ABILITY_GEOMETRY`), `coneSectorPoints` (the extracted sector geometry), `drawAimPreview`, and the single-source legibility constants (Tasks 2, 3, 4, 6)
- `apps/host-client/src/vfx/aim-preview.test.ts` — **new.** 20 tests: staleness boundary/non-finite/backward-clock/window-sizing, prune behaviour, per-ability shape resolution incl. Storm Eye's zone-vs-hit radius distinction, and shoelace-area cone geometry across 5 directions × 4 angles plus the degenerate cases
- `apps/host-client/src/session/host-session.ts` — `ability:aim-preview` added to the `onTransientDelta` whitelist (Task 1)
- `apps/host-client/src/vfx/vfx-runtime-refs.ts` — `aimPreviews` map added to `VfxRuntimeRefs`, its factory, and `clear()` (Task 2)
- `apps/host-client/src/vfx/ability-vfx-dispatch.ts` — new `ability:aim-preview` case recording the preview (conditional spread for `exactOptionalPropertyTypes`); `ability:fired` now clears the caster's preview first, before spawning cast VFX (Tasks 2, 5)
- `apps/host-client/src/vfx/snapshot-vfx.ts` — new aim-preview render pass (prune-then-draw, persistent `Graphics`, `addChildAt(g, 0)`), plus `aimPreviewGraphics`/`colorForPlayer` params (Task 3)
- `apps/host-client/src/vfx/index.ts` — barrel exports for the aim-preview module (Task 2)
- `apps/host-client/src/screens/DungeonScreen.tsx` — `aimPreviewGraphicsRef`, threaded through `renderFrame`'s signature into `renderSnapshotVfx`, cleared on teardown (Task 3)
- `apps/host-client/src/screens/HubWorldScreen.tsx` — same wiring, so the hub inherits aim previews from the shared module (Task 3)
- `_bmad-output/implementation-artifacts/7-15c-render-aim-arrow-and-destination-preview.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates

### Review Findings

Reviewed 2026-08-06 in a batched branch review (host group). No High findings against this story; one Medium worth carrying to the manual pass, and three small fixes applied.

**[Low — CONFIRMED, FIXED] An aim-preview `Graphics` lingered one extra frame when its entry was dropped inside the draw loop.**
The destroy sweep runs before the draw loop, but the draw loop itself deletes entries for players who go down, become spirits, disconnect, or leave. Their `Graphics` was not removed until the next frame and was not re-cleared, so a player downed mid-aim showed a stale arrow at their old position for ~16ms — directly contradicting the header comment's claim that pruning happens first precisely to avoid a one-frame lag. **Fixed** by destroying the orphan in that branch too.

**[Low — CONFIRMED, FIXED] The barrel did not export two constants the Completion Notes claimed were exported.** `AIM_ZONE_RIM_WIDTH` and `AIM_ARROW_HEAD_SPREAD_RAD` were defined but not re-exported. Functionally harmless, but the note was inaccurate and the point of those constants is that a manual-pass tuning session can reach them. **Fixed.**

**[Low — CONFIRMED, documented rather than changed] Cone ghosts are gated on a `targetX`/`targetY` they never read.**
A circle ghost is positioned by the delta's target and genuinely needs it; a cone ghost is apex-anchored at the caster and derives its extent from `ABILITY_GEOMETRY`, so it does not read the target at all. It is gated on one only because the sim's `showsTarget` rule (`RELEASE && !projectile`) happens to select the cone abilities too — an implicit coupling that no test pins, so if Story 7.15b ever stopped sending a target for Stone Wall or Crimson Lash their cones would silently vanish. **Deliberately left gated**, with the reasoning now in the source: gating both kinds on "the sim resolved an aim point" is the honest reading of ADR-0008, and drawing a cone the sim did not confirm would be exactly the unilateral host-side inference the ADR forbids. The comment is the fix — the coupling is now stated rather than accidental.

**[Medium — CONFIRMED, deferred to the manual pass] Forwarding `ability:aim-preview` through the transient-delta queue turns a sustained 30Hz stream into full React re-renders of the host tree.**
`onTransientDelta` does `setTransientDeltaQueue(prev => [...prev, delta])` per delta, and `App`'s effect immediately clears it — two renders of `App` + the active screen per delta. The sim emits one preview per aiming player per tick, so eight players aiming is ~480 renders/s of the host's largest component. React 18's auto-batching does not help here: each delta arrives in its own WebSocket message, i.e. its own task.

Note what this is and is not. The whitelist comment justified the addition purely on **wire** volume ("capped at one per aiming player per tick") in the same block that records `zone:tick` being excluded — the render amplification was not considered, and that was a gap in my reasoning. But the amplification mechanism is pre-existing and shared by every whitelisted delta (`player:hp-updated`, `projectile:hit` and others already flow at high rates in combat); what is new is that aim previews are *sustained* rather than bursty. `applyDelta` correctly returns the same `state` reference for this type, so `setGameState` bails out — the queue is the sole amplifier.

Deliberately **not** fixed here: the honest fix is architectural (route presentation-only, ref-backed deltas around React entirely, or coalesce the queue), which is a larger change than this story should make late and one that touches every consumer. **Flagged as the top measured item for the Client-UX manual pass** — if the host drops frames with several players aiming, this is the cause, and the fix is a follow-up story rather than a tweak.

**Confirmed clean by the reviewer:** the shape mapping was cross-checked against both `ABILITY_GEOMETRY` and the sim's `showsTarget` rule and matches the AC (Storm Eye → `STORM_EYE_ZONE_RADIUS_PX` 150, deliberately not its `hitRadiusPx` 80); no authority violation — zero assignments into mirror state, destination previews use the delta's target exclusively, `ABILITY_GEOMETRY` read only for shape as ADR-0008 permits; no PixiJS resource leak (preview `Graphics` are stage children reclaimed by `app.destroy`, and `VfxEngine.clear()` runs before it).

**Regression after patches:** `npm run typecheck` clean (10/10). `apps/host-client/src/vfx/`: 136 passed, 1 failed (pre-existing Stone Wall centering). Full suite 731 passed, 1 failed, 9 skipped.

### Resolved by Story 7.15e (2026-08-06)

The `AUTO` blink flagged above as a carried-forward limitation — "an `AUTO` ability's aim arrow will blink rather than persist: appear on each cast, expire 150ms later, reappear on the next" — was confirmed in play by the user and is now **fixed** by Story 7.15e. Of the three options this story listed, neither of the two it expected was taken: the fix was to send the low-stakes `input:aim-preview` during the cooldown gap in place of the suppressed cast, so the anti-flood guarantee of the 2026-07-25 cooldown-sync fix is preserved untouched and the message rate is unchanged.

**AC4 of this story is amended by that work.** "An ability fires → the preview clears immediately" now holds only for `RELEASE` and `TAP` abilities. For held abilities (`AUTO`/`AIM_CAST`) the preview deliberately survives the cast, because the player is still aiming the next shot; the staleness window remains their sole terminator. See `7-15e-auto-ability-continuous-aim-arrow.md`.

### Manual Client-UX Pass (2026-08-07) — performed by the user

The user ran the real game across a host screen and a phone and confirmed the feature set works, reporting "almost perfect" on the initial six stories and "works like a charm" after Story 7.15e's `AUTO` continuous-arrow fix. That closes the **Client-UX hook** gate this story disclosed as outstanding — it was the one gate no automated layer in this sandbox could satisfy, and it is now genuinely satisfied rather than waived.

One finding came out of the pass and was fixed rather than deferred: the `AUTO` aim arrow blinked at the cooldown cadence instead of tracking the thumb. See `7-15e-auto-ability-continuous-aim-arrow.md`. No other visual defects were reported — notably no report of the cone ghosts rendering as slivers (the Story 7.13 failure mode this branch's geometry was specifically written to avoid), and no report of host frame-rate trouble with aim previews live, which was the top item flagged for measurement in Story 7.15c.

## Change Log

- 2026-08-05 — Story created from `epics.md` "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" and ADR-0008.
- 2026-08-06 — Implemented. Aim arrow + destination ghost rendered from the sim's resolved delta, as persistent per-frame `Graphics` following the caster. Staleness inference (150ms, justified) plus an `ability:fired` clear covers the contract's missing terminator, per the 2026-08-05 decision to keep ADR-0008 as written. Cone geometry extracted rather than re-derived, with area-based tests. 20 new unit tests. Status → review.

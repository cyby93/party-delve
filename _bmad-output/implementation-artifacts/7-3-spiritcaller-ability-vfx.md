---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.3: Spiritcaller Ability VFX

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want Ancestor's Voice, Spirit Nova, Soul Mend, and Warding Cry to each look and feel distinct,
so that Spiritcaller's sustain/burst/defend/revive kit reads clearly in combat.

## Acceptance Criteria

1. **Given** the Story 7.1 primitive library exists (`apps/host-client/src/vfx/`), **when** Ancestor's Voice (idx 0, AUTO, mixed-faction cone), Spirit Nova (idx 1, TAP, expanding radius, mixed-faction), and Warding Cry (idx 3, TAP, self-centred ally shield) fire in the dungeon, **then** each renders a visually distinct effect — a distinct shape + motion + palette combination not shared with any other Spiritcaller ability — composed **only** from `createParticleBurst` / `createTrail` / `createRingShockwave` / `createBeam` / `createTintPulse`, with no new bespoke `Graphics` drawing code for basic shapes (7.1 AC3), **and** none of the three falls back to the shared `ABILITY_FLASH_MS` flat-flash treatment (`DungeonScreen.tsx:551-553`).

2. **Given** Soul Mend (idx 2, AIM_CAST, 2500 ms channel, ranged spirit-targeting revive at range 200), **when** a Spiritcaller channels it, **then** a **ranged channel indicator** renders that is visually distinct from the other three abilities (a persistent caster→target link plus a convergence indicator, neither of which any of the other three uses) **and** shows progress toward the 2500 ms completion, **and** channel completion and channel cancellation resolve to visibly different terminal effects.

3. **Given** Ancestor's Voice and Spirit Nova each heal allies and damage enemies **within one cast**, **when** either fires, **then** the effect itself is rendered in a **two-palette form** — a heal register (`accent-warm` `0xc07d35`) and a damage register (`corruption-blood` `0xc0392b`) present simultaneously in the same effect — so the mixed-faction identity reads without any per-target information, **and** additionally, per-target accents are spawned best-effort at entities whose HP is observed to change inside the cast's correlation window and geometry.
   **Honesty clause (do not over-promise in the implementation):** `ability:fired` carries **no target list** (`server-to-host.ts:AbilityFiredDelta`), and `latestTransientDelta` is a single React state value that collapses same-task deltas (`App.tsx:20,42-48`), so a *guaranteed* per-target render is **not achievable without a protocol change, which is an Epic 7 non-goal** (`epics.md:2061`). The effect-level two-palette treatment is the AC's load-bearing, always-correct part; the per-target accents are a best-effort refinement derived from per-frame `GameState` HP diffing (see Dev Notes §5) and are explicitly allowed to under- or over-attribute at the edges. Accents are capped per cast.

4. **Given** Warding Cry's `shield` status effect is active on an ally, **when** that ally is rendered, **then** a shield visual persists for the effect's duration (not just at cast moment), driven from `PlayerState.statusEffects` in the per-frame loop, **and** it composes with Story 7.6 (which owns the generic four-type status treatment) under a single-owner rule: **exactly one persistent shield treatment exists in the codebase after both stories ship** (see Dev Notes §7 for the concrete "whoever ships second must not double-render" procedure).

5. **Given** `cast:started` / `cast:cancelled` / `cast:completed` deltas exist on the wire but are dropped by the host's transient-delta whitelist (`host-session.ts:46-64`), **when** this story ships, **then** all three are added to that whitelist, **and** the story records that `applyDelta` already handles all three (`apply-delta.ts:260-287`) so forwarding them changes no mirror-state behavior, **and** `cast:started.startedAt` (a **server-epoch** timestamp, `server-to-host.ts:273`) is never fed into the VFX clock — the indicator uses `durationMs` with a locally captured `Date.now()` start.

6. **Given** the existing dungeon canvas behaviors, **when** this story ships, **then** none of them regress: ability cast flash for **non-Spiritcaller** classes, spirit-form glow, the `isDown`/`isSpirit` body sprite at `bodyX/bodyY`, the frozen-player `0.3` alpha disconnect cue, enemy kill fade, damage numbers, bond tethers, status badges, purification pulse + background swap + reward reveal, revive timer overlay, boss HP bar and phase visuals.

7. **Given** the project's testing convention, **when** this story ships, **then** the delta→effect selection and cast-geometry math live in a **pure, canvas-free exported function** covered by one runnable test file, and rendering correctness itself is verified manually via the Client-UX hook.

## Tasks / Subtasks

- [x] **Task 1 — One-time `VfxEngine` wiring in `DungeonScreen.tsx` (AC: 1, 2, 4)**
  *First-story-wins: 7.1 deliberately wired nothing (7.1 AC3). 7.2/7.4–7.8 describe the identical four steps. Do each one **only if not already present**, and if it is present, do not restructure it.*
  - [x] 1.1: If `import { VfxEngine, createParticleBurst, createRingShockwave, createBeam, createTintPulse } from '../vfx';` is absent, add it.
  - [x] 1.2: If no `vfxEngineRef` exists, add `const vfxEngineRef = useRef<VfxEngine | null>(null);` and construct it inside `initPixi` immediately after `pixiAppRef.current = app;` (`DungeonScreen.tsx:417`): `vfxEngineRef.current = new VfxEngine(app.stage);`.
  - [x] 1.3: If the ticker does not already call it, add `vfxEngineRef.current?.update(Date.now());` inside the existing `app.ticker.add` callback (`:418-499`) — **after** `renderFrame(...)` returns and after the boss/purification/reward blocks. `Date.now()`, matching `renderFrame`'s `const now = Date.now()` (`:99`). Never `performance.now()`.
  - [x] 1.4: If absent, add `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;` to the unmount cleanup (`:502-525`), **before** `app.destroy(...)` at `:507`.
  - [x] 1.5: Verify the ordering invariant and leave a comment on it: `renderFrame` writes `circle.alpha` every frame (`:131-145`), so `VfxEngine.update()` must run **after** it or every `createTintPulse` is silently overwritten within the same frame.

- [x] **Task 2 — Host transient-delta whitelist: forward the three cast deltas (AC: 2, 5)**
  - [x] 2.1: In `apps/host-client/src/session/host-session.ts:46-64`, add `delta.type === 'cast:started' || delta.type === 'cast:cancelled' || delta.type === 'cast:completed' ||` to the `onTransientDelta` guard. Nothing else in that file changes.
  - [x] 2.2: Add a one-line comment recording *why this is safe*: `applyDelta` runs unconditionally at `host-session.ts:67`, outside the whitelist, and already has cases for all three (`apply-delta.ts:260,271,280`) — the whitelist only gates the host's *visual* callback, so widening it cannot change mirror state. This is host-local delivery filtering, **not** a contract change (see Pre-Task Hook).

- [x] **Task 3 — New pure module `apps/host-client/src/vfx/spiritcaller-vfx.ts` (AC: 1, 3, 7)**
  - [x] 3.1: Export the visual constants block (colors, durations, radii) named per Dev Notes §4 — no inline magic numbers in the delta handler (`project-context.md` configuration rule).
  - [x] 3.2: Export the pure planner:
    ```ts
    export type SpiritcallerAbility = 'ancestors-voice' | 'spirit-nova' | 'warding-cry';
    export interface SpiritcallerCastPlan {
      ability: SpiritcallerAbility;
      originX: number; originY: number;   // caster position at cast time
      focusX: number; focusY: number;     // hit-zone centre (== origin for TAP abilities)
      accentRadiusPx: number;             // gating radius for per-target accents
      accentWindowMs: number;             // correlation window for per-target accents
    }
    export function planSpiritcallerCast(
      caster: { class: PlayerClass; x: number; y: number },
      abilityIndex: number,
      directionX: number,
      directionY: number,
    ): SpiritcallerCastPlan | null;
    ```
    Returns `null` for a non-Spiritcaller caster, for `abilityIndex === 2` (Soul Mend is **not** delta-driven — see Dev Notes §6), and for any out-of-range index. Normalizes `(directionX, directionY)`. **Zero-direction rule (mirror the sim, or render a lie):** Ancestor's Voice (idx 0) is directional at range 180, so a zero-length direction makes the sim **skip the hit entirely** (`GameRoom.ts:2203`, `isDirectional && mag === 0 && hitRange > 0`) — `planSpiritcallerCast` must return **`null`** for idx 0 in that case so nothing renders and no flash fires, exactly as Story 7.2 resolved for Avalanche (code review 2026-07-22, Decision 2: *if the sim skips the hit, the host renders nothing — no effect, no fallback flash*). Spirit Nova (idx 1) and Warding Cry (idx 3) are self-centred (`hitRange === 0`), which the sim fires regardless of direction, so for those a zero direction correctly yields `focus = origin` rather than `NaN`.
  - [x] 3.3: Export the pure faction classifier: `export function factionAccentFor(hpBefore: number, hpAfter: number): 'heal' | 'damage' | null;` — `heal` when `hpAfter > hpBefore`, `damage` when `hpAfter < hpBefore`, else `null`.
  - [x] 3.4: Export the composer `triggerSpiritcallerCast(engine: VfxEngine, plan: SpiritcallerCastPlan, startedAt: number): void` — builds only primitive handles per the Dev Notes §4 table and `engine.add()`s them, **passing `startedAt` to every factory** (see the BACKGROUNDED-TICKER rule in Task 4.2 and §Pitfalls). No `new Graphics()` anywhere in this file.
  - [x] 3.5: Export `triggerFactionAccent(engine: VfxEngine, kind: 'heal' | 'damage', x: number, y: number): void` — the small per-target burst.

- [x] **Task 4 — Wire Ancestor's Voice / Spirit Nova / Warding Cry to `ability:fired` (AC: 1, 3, 6)**
  - [x] 4.1: In the `ability:fired` branch of the transient-delta effect (`DungeonScreen.tsx:551-553`), look up the caster: `const caster = gameState?.players.find(p => p.id === latestTransientDelta.playerId);`. Handle `undefined` (late join / reconnect race) by falling through to the existing generic-flash behavior — never throw.
  - [x] 4.2: Split ownership from placement, exactly like Story 7.2's `ability:fired` branch — there are **two** distinct reasons a plan can be absent, and they resolve oppositely:
    - **Owned Spiritcaller delta-cast** = `caster.class === PlayerClass.SPIRITCALLER && d.abilityIndex !== 2` (indices 0/1/3; idx 2 Soul Mend is channel-driven in `renderFrame`, not here). For an owned cast, capture `const triggeredAt = Date.now();` and call `planSpiritcallerCast(...)`:
      - **plan non-null** → `triggerSpiritcallerCast(engine, plan, triggeredAt)`, register in the active-cast map with that same `startedAt`, and **do not** set `entry.flashUntil` (AC1's no-fallback-flash).
      - **plan null** → this is a zero-aim Ancestor's Voice (idx 0, directional): the sim skipped the hit (`GameRoom.ts:2203`), so render **nothing** — **no effect and no flash** (SILENT rule, user decision 2026-07-23; matches Story 7.2's Avalanche and 7.5's Stormcaller casts). Do **not** fall back to `flashUntil` here.
    - **Not an owned Spiritcaller delta-cast** (another class, or idx 2, or `caster` undefined on a late-join/reconnect race) → leave the existing `entry.flashUntil = Date.now() + ABILITY_FLASH_MS` untouched — that flash belongs to another class's story (7.2/7.4/7.5), not this one.
    - **BACKGROUNDED-TICKER rule (from Story 7.2's code review, 2026-07-22).** This branch runs in the transient-delta `useEffect`, which is **not** `requestAnimationFrame`-gated — but `VfxEngine.update()` runs in the ticker, which browsers stop for a hidden/minimised host tab. If you omit `startedAt`, a cast added while the ticker is stopped never gets its first `update(now)`, so it never starts and never completes; the socket keeps delivering casts, they pile up on the stage, and they all fire in one frame on resume. Stamping `startedAt = Date.now()` at trigger gives each an absolute deadline that self-expires on the first frame after resume — the same property the legacy `flashUntil` path and the damage numbers already rely on. This **overrides 7.1's "omit `startedAt`" design intent for delta-triggered effects only**; effects created from *inside* the ticker/`renderFrame` (Soul Mend's convergence ring, Task 6.2) are already ticker-gated and may keep the lazy capture.
  - [x] 4.3: Anchor Spirit Nova's rings at the **cast position**, not at the caster's live position — the sim captures `x`/`y` at cast time and the sweep never follows the caster (`GameRoom.ts:2174-2182`). Using the live position would make a moving Spiritcaller's ring lie about where the sweep actually is.

- [x] **Task 5 — Per-frame HP diffing for best-effort mixed-faction accents (AC: 3)**
  - [x] 5.1: Add a single cohesive `VfxContext` object rather than more positional `Map` parameters (`renderFrame` already takes 9 — `:84-96`):
    ```ts
    interface ActiveCast extends SpiritcallerCastPlan { startedAt: number; accentsSpawned: number; }
    interface VfxContext {
      engine: VfxEngine;
      hpMemory: Map<string, number>;          // entityId -> last observed hp
      activeCasts: Map<string, ActiveCast>;   // casterId -> cast in its accent window
      soulMend: Map<string, SoulMendVisual>;  // casterId -> channel visual state (Task 6)
    }
    ```
    Pass it as a **single** new `vfx: VfxContext | null` parameter to `renderFrame`. If a prior Epic 7 story already added a `vfx` context parameter, **extend that object** — do not add a second one.
  - [x] 5.2: In `renderFrame`, after the Players and Enemies sections, walk `state.players` and `state.enemies`: for each entity, compare `hp` against `hpMemory`. Entities not yet in `hpMemory` are **seeded silently** (no accent) — this is what prevents a burst on every newly-spawned enemy and on reconnect. Then write the current hp back.
  - [x] 5.3: Spawn an accent only when **all** hold: (a) some entry in `activeCasts` is still inside `accentWindowMs` of `now`; (b) the entity is within `accentRadiusPx` of that cast's `focus` (for Spirit Nova use the *current* swept radius, `SPIRIT_NOVA_MAX_RADIUS_PX * progress(now, startedAt, SPIRIT_NOVA_DURATION_MS_VFX)`, so accents track the visible ring edge instead of popping at max radius immediately); (c) `factionAccentFor(before, after)` is non-null; (d) `accentsSpawned < MAX_FACTION_ACCENTS_PER_CAST`. Increment `accentsSpawned`.
  - [x] 5.4: Prune `activeCasts` entries whose window has elapsed. Clear `hpMemory` and `activeCasts` in the unmount cleanup alongside the other Maps (`:519-524`).
  - [x] 5.5: Comment the honesty caveat inline: this is a **cosmetic correlation heuristic**, never a rule check — it can attribute another player's damage to a Spiritcaller cast that happens to overlap in time and space, and it can miss a target whose HP change lands outside the window. It must not read or write any game state beyond `hp`.

- [x] **Task 6 — Soul Mend channel indicator (AC: 2, 5, 6)**
  - [x] 6.1: State shape: `interface SoulMendVisual { targetPlayerId: string; localStartedAt: number; durationMs: number; nextBeamAt: number; lastTargetX: number; lastTargetY: number; }` stored in `vfx.soulMend` keyed by caster id.
  - [x] 6.2: **Start** — driven from `GameState`, not from the delta: in `renderFrame`, for each `player.channelingAbility !== null` with no `soulMend` entry, create one with `localStartedAt: now` (the ticker's `Date.now()`) and `durationMs: player.channelingAbility.durationMs`. **Never** use `player.channelingAbility.startedAt` or `cast:started.startedAt` — both are the sim server's `Date.now()` (`server-to-host.ts:273`, `player.ts:43`), a different machine's epoch, and feeding it to a primitive violates the VFX clock contract (`vfx/types.ts:26-34`). Trigger the convergence ring here with `startedAt` **omitted** so the engine captures it from the first `update(now)`. This is safe *because this trigger lives inside the ticker/`renderFrame`* — it can only run on a frame the ticker is running, so there is no backgrounded-tab pile-up window. (Contrast the delta-triggered casts in Task 4.2, which must stamp `startedAt` explicitly — see the BACKGROUNDED-TICKER rule there.)
  - [x] 6.3: **Progress** — the convergence ring's imploding radius over `durationMs` *is* the progress indicator; it reaches the target's own radius exactly at completion. No countdown text, no bespoke arc geometry.
  - [x] 6.4: **Link** — re-trigger a short `createBeam` every `SOUL_MEND_BEAM_INTERVAL_MS` from the caster's live position to the target's `bodyX ?? x` / `bodyY ?? y` (the down/spirit body anchor, `:156-158`). Each pulse is a fresh geometry snapshot, so the link follows a moving caster without any primitive re-parenting. Bounded at ≤ 2 concurrent beams per channel.
  - [x] 6.5: **Termination** — a `soulMend` entry is removed when `player.channelingAbility` becomes `null` (or the caster/target leaves state). Choose the terminal effect in this priority order:
    1. If a `cast:completed` delta for this caster arrived since the channel started → success burst.
    2. Else if a `cast:cancelled` delta arrived → fizzle.
    3. Else **infer**: if the target player is now `!isDown` → success burst; otherwise → fizzle.
    Path 3 is expected to be the load-bearing one: completion also broadcasts `player:revived` + `player:hp-updated` in the same task, so `cast:completed` is very likely to be collapsed by `latestTransientDelta`'s single-value batching (`App.tsx:42-48`). Implement all three; do not rely on the deltas alone.
  - [x] 6.6: Late-observation caveat, comment it: a host that first sees an already-running channel (reconnect, late render mount) starts a full-length ring for a partly-elapsed channel. The ring is discarded the moment `channelingAbility` clears, so the failure mode is a ring that vanishes early — acceptable, and unavoidable without a server-clock offset estimate (out of scope, no protocol change).
  - [x] 6.7: Clear `vfx.soulMend` in the unmount cleanup.

- [x] **Task 7 — Warding Cry shield persistence (AC: 4, 6)**
  - [x] 7.1: **Before writing anything**, grep for an existing persistent shield treatment (`grep -rn "shield" apps/host-client/src`). If Story 7.6 has already shipped one, **do not add a second** — implement only Warding Cry's cast-moment effect and record in the Dev Agent Record that persistence was delegated to 7.6's existing renderer.
  - [x] 7.2: If none exists, add it as a single named function so 7.6 can adopt it verbatim: `renderShieldAura(vfx, entityId, x, y, now)`, called from `renderFrame` for every `state.players` entry with a `statusEffects` item of `type === 'shield'`. Re-trigger one contracting halo per shielded entity every `SHIELD_PULSE_INTERVAL_MS` — **at most one live pulse per entity** (track `nextShieldPulseAt` per entity id), which is the concrete answer to deferred item D-7.1-D for this story.
  - [x] 7.3: Do **not** delete or modify the generic status badge block (`:258-288`). Replacing it is Story 7.6's AC. The aura is additive; a shielded ally briefly shows both, which is acceptable and is not the "double-render" AC4 forbids (that refers to two competing *persistent shield treatments*).
  - [x] 7.4: Do **not** derive a countdown from `StatusEffect.expiresAtMs` — it is the sim's `Date.now() + durationMs` (`GameRoom.ts:2160-2167`), i.e. server epoch, same hazard as `cast:started.startedAt`. Render presence, on a host-clock pulse cadence.

- [x] **Task 8 — Self-check (AC: 7)**
  - [x] 8.1: Write `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` — one runnable check per project convention, not a suite per function. Cover: `planSpiritcallerCast` returns `null` for a non-Spiritcaller class, `null` for `abilityIndex === 2`, `null` for an out-of-range index; the cone focus for index 0 lands at exactly `ANCESTORS_VOICE_RANGE_PX` from the origin along a normalized direction; an un-normalized direction (e.g. `(3, 4)`) produces the same focus distance as `(0.6, 0.8)`; **a zero direction on index 0 (Ancestor's Voice, directional) returns `null`** — the sim skips that hit, so the host must render nothing (mirrors Story 7.2's Avalanche resolution); **a zero direction on the self-centred TAP abilities (1, 3) still returns a plan with `focus === origin` and no `NaN`**, since the sim fires those regardless of direction; `factionAccentFor` returns `heal`/`damage`/`null` for the three cases including equal HP. Optionally assert `triggerSpiritcallerCast(engine, plan, Date.now())` grows `engine.size` by the documented effect count for each ability (a `VfxStage` stub is enough — see `vfx.test.ts` for the pattern).
  - [x] 8.2: Run `npx vitest run src/vfx/spiritcaller-vfx.test.ts` from `apps/host-client` (first collect is ~35 s on WSL2 — that is transform time, not a hang).
  - [x] 8.3: Run `npm run typecheck` at the repo root (covers all 10 tsconfigs).
  - [ ] 8.4: **NOT DONE — requires a live host+phone session (recorded PENDING in Dev Agent Record).** Client-UX hook manual pass — see Dev Notes §9 for the exact checklist. Record the outcome in the Dev Agent Record; do not claim a visual check that was not performed.

### Review Findings (code review 2026-07-23 — Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] **CONFIRMED (High): `VfxEngine.update()` runs before `renderFrame`, so the Spirit Nova / Warding Cry caster tint pulses are clobbered every frame and never visibly render.** `renderFrame` unconditionally writes `circle.alpha` for an alive caster (`DungeonScreen.tsx:197`), and the ticker calls `update()` at `:665` *above* the null guard and *before* `renderFrame(:669)` — a 7.2 review decision (reap effects on null frames) that directly conflicts with this story's Task 1.5. `createTintPulse`'s per-frame alpha write is overwritten by the later `renderFrame`, so only the near-white bone tint survives. Rings/bursts still render (AC1 distinctness holds), but the tint-pulse component is dead. Fix: call `update()` **after** `renderFrame` while still running it on null-state frames (so 7.2's reap concern is preserved). All three reviewers or the auditor confirmed against source. [`DungeonScreen.tsx`:665]
- [x] [Review][Patch] **CONFIRMED (High): `soulMendTerminal` markers leak and invert a later channel's terminal effect.** `cast:completed`/`cast:cancelled` set the marker keyed by `casterId` in the delta handler, but it is only deleted inside the `renderFrame` termination loop gated on a live `soulMend` visual. When a terminal delta arrives with no live visual — the common case, since the comment itself notes `cast:completed` usually lands *after* the `isDown` inference already terminated the visual — the marker is never cleared (cleanup is unmount-only). It then (a) grows unbounded across a session and (b) is read on that caster's **next** Soul Mend termination, so a later fizzle renders the success bloom (or vice-versa) — the exact mis-cue the inference backstop exists to prevent. Flagged by all three layers. Fix: prune any `soulMendTerminal` entry with no matching live `soulMend` visual each frame. [`DungeonScreen.tsx`:447-457, 918-920]
- [x] [Review][Patch] **Med: Spirit Nova accent window (420 ms) is shorter than its visual duration (600 ms), so the outer ~154–220 px band never accents — contradicting the "track the ring edge" comment.** `activeCasts` is pruned at `accentWindowMs` = `FACTION_ACCENT_WINDOW_MS` (420) for every ability, but the nova gate scales to `SPIRIT_NOVA_DURATION_VFX_MS` (600); the cast is deleted at ~0.7 progress, so the effective gate never exceeds ~154 px. Cosmetic (within §5's "can miss" allowance) but the comment overstates it. Fix: give the Spirit Nova plan `accentWindowMs = SPIRIT_NOVA_DURATION_VFX_MS`. [`spiritcaller-vfx.ts` planner, `DungeonScreen.tsx` accent gate]
- [x] [Review][Patch] **Med: Task 7.2's reusable `renderShieldAura(...)` named function was not created — the shield cadence logic is inlined in `renderFrame`, weakening the 7.6 composition contract (AC4/§7).** AC4 substance (persistent, `statusEffects`-driven, one pulse/entity, single owner) is met, but §7's mechanism ("a single named function so 7.6 can adopt it verbatim") is not delivered; only the `triggerShieldPulse` primitive composer is exposed. Fix: extract the per-entity cadence gate into a named `renderShieldAura` function 7.6 can adopt. [`DungeonScreen.tsx` shield block]
- [x] [Review][Defer] **Low: back-to-back Soul Mend that retargets across an unobserved null frame renders the second channel at the first target.** Requires dropped/backgrounded frames during an A→null→B retarget so the Start loop never sees the null; the old visual (target A) is never terminated and the new channel renders at A's position/target. Narrow (needs frame drops *and* immediate retarget); shares its root with the batching limitation. Deferred as `D-7.3-A` rather than adding retarget-detection complexity to a prototype visual. [`DungeonScreen.tsx`:412] — deferred, requires dropped frames
- [x] [Review][Defer] **Low: a killing blow produces no `SPIRIT_HARM` damage accent** because the accent loop filters `enemies.filter(e => e.isAlive)`, dropping an enemy that hit 0 HP this frame. Explicitly within §5's "best-effort … can miss" allowance and avoids a phantom accent on a corpse; a literal deviation from Task 5.2's "walk state.enemies". [`DungeonScreen.tsx` accent block] — deferred, within the documented best-effort envelope

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping (inserted via `sprint-change-proposal-2026-07-21.md`). Depends only on 7.1 (done). No dependency on 7.2 / 7.4–7.8.
- **Context:** All four Spiritcaller abilities currently render as the same undifferentiated `ABILITY_FLASH_MS` cosine flash on the caster's circle — and Soul Mend renders **nothing at all**, because it never emits `ability:fired` (see §6). The mechanics already exist and are correct (Stories 3.17, 3.18); this story is rendering only.
- **Goal:** Distinct, primitive-composed visuals for Ancestor's Voice, Spirit Nova, Warding Cry (delta-driven) and Soul Mend (state-driven channel indicator), plus a persistent shield treatment and best-effort mixed-faction differentiation.
- **Allowed paths:**
  - `apps/host-client/src/vfx/spiritcaller-vfx.ts` (new)
  - `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` (new)
  - `apps/host-client/src/vfx/index.ts` (re-export the new module)
  - `apps/host-client/src/screens/DungeonScreen.tsx`
  - `apps/host-client/src/session/host-session.ts` (whitelist line only)
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**`, `packages/shared-types/**`, `packages/net-protocol/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`, `apps/host-client/src/vfx/{types,primitives,engine}.ts` (7.1's shipped surface — if a primitive genuinely cannot express a needed shape, **stop and say so** rather than inlining a one-off `Graphics` in `DungeonScreen.tsx`; extending `primitives.ts` with a new *parameterized* primitive is the fallback and needs an explicit note), `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Inputs:** `epics.md:1952-1969` (this story's ACs), `epics.md:1904-1908,2061` (epic frame + non-goals), `7-1-vfx-engine-foundations.md` (the toolkit + its 4 deferred items), `3-17-…md` / `3-18-…md` (the mechanics being visualized), `DESIGN.md:9-24,105-227` (color tokens), `DungeonScreen.tsx`, `host-session.ts`, `apply-delta.ts:260-287`.
- **Non-goals (Epic 7-wide, `epics.md:2061`):** no final pixel-art sprites (the PixelLab pass is untouched); no new abilities or mechanics; **no protocol/schema changes** — 7.7a is the one approved exception and this is not it. Also: do not rewrite `App.tsx`'s `latestTransientDelta` plumbing (§3); do not touch any other class's abilities; do not implement 7.6's generic four-type status treatment.
- **Ownership check:** single area — `apps/host-client/**`, Host Experience Engineer. No split required. `host-session.ts` is inside that area.
- **Hook verdicts:**
  - **Client-UX hook — TRIGGERED.** Real this time (7.1 rendered nothing). Full checklist in §9.
  - **Contract-change hook — NOT triggered.** No file under `packages/shared-types/**` or `packages/net-protocol/**` is touched; no session-lifecycle, reconnect, room-state, join-flow, prediction/reconciliation/interpolation surface changes. **Specifically on the whitelist edit:** `host-session.ts:46-64` is a *host-local delivery filter* deciding which already-received, already-applied deltas are surfaced to a React callback. `applyDelta` runs unconditionally one line later (`:67`) for every delta regardless of the filter, and already handles `cast:started`/`cast:cancelled`/`cast:completed` (`apply-delta.ts:260,271,280`), so mirror state is byte-identical before and after this change. No wire type, no schema, no message, no lifecycle is modified. This is the same category of edit the epic itself pre-authorized for `boss:charged` in 7.7 (`epics.md:2032-2034`).
  - **Simulation-safety hook — NOT triggered.** Nothing under `apps/simulation-server/**` or `packages/game-rules/**`.
  - **Telemetry hook — N/A.** No new user flow; this is a visual treatment of existing flows.
  - **Merge gate reminder:** typecheck + the new test green, Client-UX manual pass recorded, no contract drift.

### 1. The VFX toolkit you compose from (7.1, shipped)

`apps/host-client/src/vfx/index.ts` exports `VfxEngine` (`add(handle) -> id`, `update(now)`, `remove(id)`, `clear()`, `size`), `progress(now, startedAt, durationMs)`, and five factories:

| Factory | Signature highlights | Notes for this story |
|---|---|---|
| `createParticleBurst` | `{x, y, color: number \| readonly number[], durationMs, alpha?, count=10, speed=0.15 px/ms, spread=0.5 rad, particleRadius=8}` | Palette form is how a single burst carries both faction colors. Allocates its N `Graphics` once (`primitives.ts:52-66`). |
| `createRingShockwave` | `{x, y, color, durationMs, maxRadius, startRadius=0, lineWidth=3, filled=false, alpha?}` | `maxRadius < startRadius` is a **supported implode** — radius is clamped at 0 (`primitives.ts:219`). This story leans on implodes heavily. |
| `createBeam` | `{x, y, toX, toY, color, durationMs, width=4, alpha?}` | Geometry drawn once in **local space** around `view.position=(x,y)` (`primitives.ts:256-258`); only alpha animates. A moving link = re-trigger, not mutate. |
| `createTintPulse` | `{target: TintTarget, durationMs, color?, minAlpha=0.2, maxAlpha=1}` | Borrows a display object; `view` is `null`. Captures and **restores** the target's pre-trigger alpha/tint on dispose (`primitives.ts:298-318`) — this is what keeps the frozen-player `0.3` cue and spirit-form alpha intact. |
| `createTrail` | `{x, y, color, durationMs, width=6, pointCount=16}` + `moveTo(x, y, now)`, `.disposed` | **Not used by this story.** Listed so you don't reach for it: Soul Mend's link is a two-point connection between two live entities, which is a re-triggered beam, not a motion history. |

**Non-negotiables (violating these is the #1 failure mode):**
1. **Clock contract.** No primitive reads a clock; `startedAt` is captured from the first `update(now)` (`types.ts:26-34`). The ticker must pass `Date.now()` — the same clock `renderFrame` uses (`:99`). The purification/reward blocks in the same ticker use `performance.now()` (`:465,487`); **do not** copy that. Mixing clocks makes effects vanish on frame 1 or leak forever, silently, with no exception.
2. **Never allocate a display object per frame.** Compose primitives; don't hand-roll.
3. **No bespoke `Graphics` for basic shapes** (7.1 AC3).
4. **Rendering only** — no game logic, cooldowns, or collision inside display objects (`project-context.md`, "PixiJS Host Renderer").

**7.1's deferred items and this story's answer:**
- **D-7.1-A** (engine reentrancy) — not exercised: no effect here adds/removes effects from inside its own `update`.
- **D-7.1-B** (same handle added twice) — not exercised: every handle is freshly constructed at trigger.
- **D-7.1-C** (externally destroyed `view`/`target`) — **partially exercised** by `createTintPulse` borrowing a player's `circle`, which `renderFrame` destroys when the player leaves state (`:105-111`). Mitigation: tint pulses in this story are ≤ 300 ms and only ever borrow the *caster's own* circle, so the window is small. Re-deferred with that rationale; do not attempt a fix inside `primitives.ts` (blocked path).
- **D-7.1-D** (no cap/back-pressure) — **directly exercised.** Answered concretely: `MAX_FACTION_ACCENTS_PER_CAST` bounds accents; at most one live shield pulse per entity; at most ~2 concurrent Soul Mend beams per channel; Ancestor's Voice adds exactly 4 effects per cast on a 1500 ms cooldown. Worst realistic case (4 Spiritcallers, all abilities live) is well under 60 concurrent effects. No engine-level cap is added.

### 2. `DungeonScreen.tsx` map — what you edit and what you must not break

`apps/host-client/src/screens/DungeonScreen.tsx` (1056 lines). **Read it fully first.**

- `renderFrame(state, app, …9 Maps)` — `:84-360`. `const now = Date.now()` at `:99`. Sections: Players `:101-175`, Enemies `:177-232`, Bond tethers `:234-256`, Status badges `:258-288`, Projectiles `:290-309`, Zones `:311-330`, Essence flashes `:332-345`, Damage numbers `:347-359`. Every section is create-on-first-seen / cleanup-on-missing over a `Map` — your HP-memory and shield-pulse bookkeeping follow the same shape.
- Ticker callback — `:418-499`. `renderFrame` first, then boss sprite `:436-460`, purification pulse `:462-479`, reward particles `:481-498`. `vfxEngineRef.current?.update(Date.now())` goes at the **end**.
- Transient-delta effect — `:537-623`, a `useEffect` on `[latestTransientDelta]` with an if/else-if chain. `ability:fired` is `:551-553`. Your Spiritcaller branch goes here.
- Cleanup — `:502-525`. Every new engine/Map clears here.
- Constants — `:25-44`. `PLAYER_RADIUS=24`, `ENEMY_RADIUS=20`, `VIRTUAL_W/H = 1920/1080`, `ABILITY_FLASH_MS=300`, `STATUS_EFFECT_COLORS` `:39-44`.
- Coordinates are **1920×1080 virtual space**; `app.stage.scale` is set per frame (`:97`). All VFX params are in virtual px. `addChildAt(g, 0)` is the "draw below sprites" idiom (`:154,246,324`) — note `VfxEngine.add()` uses plain `addChild`, so all effects render **above** the below-sprite layer; that is correct for punctuation effects and is why every effect here is a stroke/particle rather than a large opaque fill (couch readability, §9).

**Must not regress (AC6):** cast flash cosine `:131-133,142-144` for other classes; spirit-form glow `:129-135`; body sprite at `bodyX/bodyY` `:148-174`; frozen `0.3` alpha `:144`; enemy kill fade `:194-209`; damage numbers `:347-359`; bond tethers `:234-256`; status badges `:258-288`; purification pulse/background swap/reward reveal `:462-498,602-621`; revive overlay `:947-988`; boss HP bar and phase visuals `:436-460,834-856`.

### 3. Data available, and its two hard limits

**Deltas** (`packages/net-protocol/src/messages/server-to-host.ts`):
- `AbilityFiredDelta = { type, playerId, abilityIndex, directionX, directionY }` — **no caster class, no target list.** Look the class up via `gameState.players.find(p => p.id === delta.playerId)?.class`; handle `undefined`.
- `CastStartedDelta = { type, casterId, targetPlayerId, abilityIndex, startedAt /* server epoch */, durationMs }` (`:268-275`), `CastCancelledDelta` (`:277-280`), `CastCompletedDelta` (`:282-285`).

**Snapshot state** (`GameState`, reconciled and updated by `applyDelta` for **every** delta at `host-session.ts:67`):
- `PlayerState`: `id, x, y, hp, maxHp, class, sessionColor, isDown, isSpirit, isFrozen, bodyX?, bodyY?, statusEffects, displayName, reviveTimerExpiresAt`, **and `channelingAbility: { abilityIndex, targetPlayerId, startedAt, durationMs } | null`** (`packages/shared-types/src/player.ts:43`).
- `StatusEffect = { type: 'damageReduction'|'slow'|'damageBuff'|'shield'; magnitude; expiresAtMs }` — `magnitude` is flat HP for `shield` (30), a 0–1 fraction otherwise.

**Limit A — `ability:fired` is dungeon-only.** It is broadcast inside `if (inDungeon)` (`GameRoom.ts:2053-2062`). Hub and training-dummy ability use never produces it, so these visuals will not appear there. Do not promise hub VFX.

**Limit B — `latestTransientDelta` is a single React state value, not a queue.** `App.tsx:20,42-48`: it is `set` per delta and cleared after 400 ms. React 18 auto-batches, so **two deltas arriving in the same task collapse and only the last is ever seen** by `DungeonScreen`'s effect. This is pre-existing (it is why `boss:stomped` visuals are unreliable) and **must not be rewritten in a VFX story**. Consequences you must design around, not against:
- A per-target visual driven by `enemy:damaged` / `player:hp-updated` will miss most targets of a multi-target cast. **Therefore this story does not drive per-target accents from those deltas.**
- `cast:completed` is almost certainly collapsed (completion also broadcasts `player:revived` and `player:hp-updated`). **Therefore Task 6.5 infers the terminal state from `GameState` as its primary path.**
- **The reliable channel:** `applyDelta` accumulates onto `currentState` for *every* delta before `onStateUpdate` fires, so even when intermediate React renders collapse, the surviving `gameState` contains **all** accumulated HP changes. Per-frame HP diffing against `gameState` therefore sees every net HP change, which is exactly why §5's accent mechanism uses it.

### 4. Per-ability visual spec — concrete primitive calls

**Palette (all values are PixiJS `number` literals; never CSS strings in canvas code):**

| Constant | Value | Token | Why |
|---|---|---|---|
| `SPIRIT_HEAL` | `0xc07d35` | `accent-warm` | DESIGN.md: "firelight, warmth, safety, earned reward… **never use for danger**" (`DESIGN.md:188-192`). It is already the revive-timer and HP-pip color (`DungeonScreen.tsx:964,1040`), so warm→restoration is an established read on this canvas. |
| `SPIRIT_HARM` | `0xc0392b` | `corruption-blood` | DESIGN.md: "injury and danger" (`DESIGN.md:226`). Darker and less orange than the enemy fill `0xe74c3c` (`:224`), so it reads as *applied harm* on top of an enemy, not as the enemy. |
| `ANCESTOR_BONE` | `0xd8d0e8` | `text-primary` | The Raw Earth layer's readable pale value. Used here as Spiritcaller's structural/"ancestral breath" stroke. Deliberately **not** a Spirit Chant accent, which is the point — see below. |
| `FIZZLE_ASH` | `0xa89ec0` | `text-secondary` | Dim, non-alarming — a failed channel must read as "nothing happened", not as damage. |

**Why not `accent-spirit` (`0x6ea8d8`), despite this being the *Spiritcaller*:** DESIGN.md reserves it for "active selections… the ambient bond assignment text overlay on the host canvas… and spirit form glow on the host screen" and calls it "the color of the bond" (`DESIGN.md:182-186`). On this exact canvas it is already spent three ways: bond tethers (`:253-254`, from `bond.color`), spirit-form glow (`:134-135`, session color, blue-adjacent), and the reward-reveal palette (`:708`). A blue caster→target line for Soul Mend would be **indistinguishable from a bond tether** at 3 m — the single worst confusion available in this story. The whole `accent-spirit` register is therefore off-limits here, and Spiritcaller's identity is carried by **bone-white structure + warm/blood faction accents** instead. This also keeps the Spirit Chant layer "earned" rather than wallpapered across a 1500 ms-cooldown basic attack (`DESIGN.md:113`).

**Geometry constants** (local host constants — **never** `import` from `packages/game-rules`; these values are transcribed at authoring time from `balance.ts` so the visuals match the real hit zones):

```ts
const ANCESTORS_VOICE_RANGE_PX  = 180;  const ANCESTORS_VOICE_RADIUS_PX = 50;
const SPIRIT_NOVA_MAX_RADIUS_VFX_PX = 220;  const SPIRIT_NOVA_DURATION_VFX_MS = 600;
const SOUL_MEND_RANGE_PX = 200;  const SOUL_MEND_CHANNEL_VFX_MS = 2500; // fallback only — prefer delta/state durationMs
const WARDING_CRY_RADIUS_PX = 90;
const MAX_FACTION_ACCENTS_PER_CAST = 8;
const SOUL_MEND_BEAM_INTERVAL_MS = 120;  const SOUL_MEND_BEAM_FADE_MS = 240;
const SHIELD_PULSE_INTERVAL_MS = 900;    const SHIELD_PULSE_FADE_MS = 700;
```

#### 4.1 Ancestor's Voice — idx 0, AUTO, 1500 ms CD, range 180 / radius 50, 15 dmg + 10 heal

Identity: **a spoken line that carries to a point, then splits into two counter-moving rings.** Cheapest of the four (it fires ~every 1.5 s).
`focus = (origin.x + nx*180, origin.y + ny*180)` from the normalized delta direction.

```ts
createBeam({ x: originX, y: originY, toX: focusX, toY: focusY,
             color: ANCESTOR_BONE, width: 3, alpha: 0.55, durationMs: 220 })
createRingShockwave({ x: focusX, y: focusY, color: SPIRIT_HEAL,
                      startRadius: 50, maxRadius: 18, lineWidth: 3, durationMs: 260, alpha: 0.9 })   // implode = gather/mend
createRingShockwave({ x: focusX, y: focusY, color: SPIRIT_HARM,
                      startRadius: 0,  maxRadius: 50, lineWidth: 2, durationMs: 260, alpha: 0.8 })   // expand = strike, ends ON the real hit radius
createParticleBurst({ x: focusX, y: focusY, color: [SPIRIT_HEAL, ANCESTOR_BONE],
                      count: 6, speed: 0.09, spread: 0.9, particleRadius: 3, durationMs: 300 })
```
Two rings crossing in opposite directions at the same point **is** the mixed-faction signature (AC3, effect level). 4 effects/cast. No caster tint pulse — at a 1500 ms cadence it would strobe.

#### 4.2 Spirit Nova — idx 1, TAP, 5000 ms CD, 0→220 px over 600 ms, 40 dmg + 30 heal

Identity: **a dual-register wave that expands at the true sweep rate.** Anchored at the **cast position** (`plan.origin`), matching `GameRoom.ts:2174-2182`.

```ts
createRingShockwave({ x: originX, y: originY, color: SPIRIT_HARM,
                      startRadius: 0, maxRadius: 220, lineWidth: 5, durationMs: 600, alpha: 0.85 })  // leading edge == real swept radius
createRingShockwave({ x: originX, y: originY, color: SPIRIT_HEAL,
                      startRadius: 0, maxRadius: 190, lineWidth: 8, durationMs: 600, alpha: 0.5 })   // warm halo trailing inside the edge
createParticleBurst({ x: originX, y: originY, color: [SPIRIT_HEAL, SPIRIT_HARM, ANCESTOR_BONE],
                      count: 16, speed: 0.28, spread: 0.7, particleRadius: 5, durationMs: 600 })
createTintPulse({ target: casterEntry.circle, color: ANCESTOR_BONE,
                  durationMs: 300, minAlpha: 0.45, maxAlpha: 1 })                                     // replaces the generic flash
```
`durationMs: 600` and `maxRadius: 220` are matched to `SPIRIT_NOVA_DURATION_MS` / `SPIRIT_NOVA_MAX_RADIUS_PX` so the visible edge is where the sweep actually is at every instant — a visual that lies about reach is worse than a flat circle. Distinct from Ancestor's Voice by scale (220 vs 50), anchoring (self vs projected focus), and ring direction (both expand vs counter-moving). 4 effects/cast, 5000 ms CD.

#### 4.3 Soul Mend — idx 2, AIM_CAST, 2500 ms channel, range 200

Identity: **the only persistent, two-entity, multi-second effect in the kit.** Nothing else here connects two characters or lasts longer than 600 ms.

- **Channel start** (once, at `localStartedAt`), at the target's body anchor:
  ```ts
  createRingShockwave({ x: tx, y: ty, color: SPIRIT_HEAL,
                        startRadius: 120, maxRadius: PLAYER_RADIUS /* 24 */,
                        lineWidth: 4, durationMs: channelDurationMs, alpha: 0.9 })  // radius == progress
  createRingShockwave({ x: casterX, y: casterY, color: ANCESTOR_BONE,
                        startRadius: 30, maxRadius: 52, lineWidth: 2, durationMs: 300, alpha: 0.7 })
  ```
- **Chant link** (re-triggered every `SOUL_MEND_BEAM_INTERVAL_MS = 120`, each fading over `SOUL_MEND_BEAM_FADE_MS = 240`):
  ```ts
  createBeam({ x: casterX, y: casterY, toX: tx, toY: ty,
               color: SPIRIT_HEAL, width: 3, alpha: 0.7, durationMs: 240 })
  ```
  Warm, pulsing, thicker than the 2 px bond tether — deliberately not blue, not static.
- **Completion:**
  ```ts
  createParticleBurst({ x: tx, y: ty, color: [SPIRIT_HEAL, ANCESTOR_BONE],
                        count: 14, speed: 0.16, particleRadius: 6, durationMs: 520 })
  createRingShockwave({ x: tx, y: ty, color: SPIRIT_HEAL,
                        startRadius: 24, maxRadius: 140, lineWidth: 4, durationMs: 520, alpha: 0.9 })
  ```
- **Cancellation:**
  ```ts
  createParticleBurst({ x: tx, y: ty, color: FIZZLE_ASH,
                        count: 8, speed: 0.05, spread: 1.2, particleRadius: 4, durationMs: 300 })
  ```
  Dim, slow, no ring — reads as "it didn't land", never as damage.

#### 4.4 Warding Cry — idx 3, TAP, 6000 ms CD, self-centred radius 90, shield 30 HP / 4000 ms

Identity: **a closing dome that settles on the exact protected radius** — mechanically and visually the inverse of Spirit Nova's expansion.

```ts
createRingShockwave({ x: casterX, y: casterY, color: SPIRIT_HEAL,
                      startRadius: 150, maxRadius: 90, lineWidth: 6, durationMs: 420, alpha: 0.9 })
createRingShockwave({ x: casterX, y: casterY, color: ANCESTOR_BONE,
                      startRadius: 90, maxRadius: 96, lineWidth: 2, durationMs: 420, alpha: 0.6 })
createTintPulse({ target: casterEntry.circle, color: ANCESTOR_BONE,
                  durationMs: 260, minAlpha: 0.5, maxAlpha: 1 })
```
Persistent per-ally halo, re-triggered every `SHIELD_PULSE_INTERVAL_MS = 900` while a `shield` effect is present:
```ts
createRingShockwave({ x: p.x, y: p.y, color: SPIRIT_HEAL,
                      startRadius: PLAYER_RADIUS + 8, maxRadius: PLAYER_RADIUS + 2,
                      lineWidth: 2, durationMs: 700, alpha: 0.5 })
```
A gentle contracting halo hugging the sprite — "held", not "blasting". Sits inside the status-badge ring at `-(radius + 14)` (`:283`) so it does not occlude badges or the health bar at `-32` (`:231`).

#### 4.5 Distinctness matrix (AC1/AC2 evidence)

| | Anchor | Geometry | Motion | Duration | Palette |
|---|---|---|---|---|---|
| Ancestor's Voice | projected focus @180 | beam + 2 counter rings + micro-burst | out **and** in, simultaneously | 220–300 ms | bone + warm + blood |
| Spirit Nova | cast position | 2 co-expanding rings + 16-particle burst | outward, 220 px | 600 ms | warm + blood |
| Soul Mend | caster **and** target | pulsing beam + imploding progress ring | inward, continuous | 2500 ms | warm |
| Warding Cry | caster | imploding ring + settled boundary ring | inward, settles at 90 | 420 ms + 4 s halo | warm + bone |

### 5. Mixed-faction differentiation — what is actually achievable (AC3)

Three candidate data sources, evaluated:

1. **Per-target `enemy:damaged` deltas** — carry `enemyId` + `damage`, but a Spirit Nova sweeping 5 enemies emits 5 in one task and `latestTransientDelta` surfaces **one** (§3, Limit B). Rejected as a per-target driver. (It already drives the floating damage numbers at `:560-577`, which have the same known gap — Story 6.8.)
2. **`player:hp-updated` deltas** — same collapse problem for a multi-ally heal. Rejected as a per-target driver.
3. **Per-frame `GameState` HP diffing** — `applyDelta` accumulates every delta into `currentState` before the (batched) React update, so the *net* HP change of every entity is always visible to the frame loop even when the intermediate renders collapse. **Selected.**

**Design (degrades gracefully):**
- **Layer 1 — effect level, always correct, no target information required.** Both Ancestor's Voice and Spirit Nova render a warm register and a blood register in the same effect (§4.1, §4.2). This alone satisfies "these abilities heal and harm at once" at a glance and never lies, because it makes no per-target claim.
- **Layer 2 — per-target accents, best-effort.** For each entity whose HP is observed to change during a cast's `accentWindowMs` and inside the cast's geometry, add one small burst: heal → `createParticleBurst({ color: SPIRIT_HEAL, count: 5, speed: 0.06, particleRadius: 4, durationMs: 260 })` above the entity; damage → the same shape in `SPIRIT_HARM`. Capped at `MAX_FACTION_ACCENTS_PER_CAST`.

**What Layer 2 explicitly does *not* guarantee** — state this in the code comment and in the Dev Agent Record, do not quietly promise otherwise:
- It can **mis-attribute**: another player's damage landing on an enemy inside the cone during the window paints a Spiritcaller-colored accent.
- It can **miss**: a target whose HP change nets to zero within the window (damaged and healed) shows nothing.
- It is **net**, not per-hit: two hits in one frame produce one accent.
- A `player:revived` full-heal inside the window can spawn a heal accent that Soul Mend, not the cast, earned.

All four are acceptable for a prototype-quality visual layer and are only removable by adding a target list to `ability:fired` — a protocol change, an Epic 7 non-goal (`epics.md:2061`). If playtesting says Layer 2 is more confusing than helpful, **shipping Layer 1 alone still satisfies AC3's load-bearing clause**; record that decision rather than inventing a protocol workaround.

### 6. Soul Mend specifics — the three facts that will bite you

1. **Soul Mend never emits `ability:fired`.** The AIM_CAST branch `continue`s at `GameRoom.ts:2010-2013`, *before* the `ability:fired` broadcast at `:2053-2062`. Any implementation that hangs Soul Mend's visual off `ability:fired` renders nothing, ever. Its signal is `PlayerState.channelingAbility` (every frame) plus the three cast deltas (once whitelisted).
2. **`cast:started.startedAt` and `channelingAbility.startedAt` are server-epoch** (`server-to-host.ts:273` — the field's own comment says "clients must not substitute their own clock"; it exists so a *server-authoritative* value survives, not so clients can subtract it from their own `Date.now()`). The sim runs in a different process, potentially a different machine. Feeding it to a primitive as `startedAt` mixes clocks with the ticker's `Date.now()` and produces the exact silent failure 7.1's review was built to prevent (effect vanishes on frame 1, or leaks forever). **Use `durationMs` with a locally captured `Date.now()` start**, and let the primitive capture `startedAt` itself from its first `update(now)`.
3. **`cast:completed` will usually be collapsed.** Completion broadcasts `player:revived` and `player:hp-updated` in the same tick as `cast:completed`. Hence Task 6.5's three-tier terminal resolution with the `GameState` inference as the reliable path.

Related, from Story 3.18: the channel cancels on early release (~150 ms liveness), target revived by someone else, caster out of range, or caster incapacitated. All of those surface identically to the host as `channelingAbility → null`, which is why the terminal-effect choice is inference-based rather than cause-based. The host must not attempt to reconstruct *why* a channel ended beyond success/failure.

### 7. Warding Cry × Story 7.6 — the composition contract (AC4)

Both stories touch the persistent `shield` visual. They are independent (`epics.md:1908`: 7.2–7.8 have no dependency on each other), so either can ship first.

- **7.3 owns:** Warding Cry's **cast-moment** effect (the imploding dome), unconditionally. 7.6 must never render a cast-moment ability effect.
- **7.6 owns:** the **generic four-type** status treatment (`damageReduction`, `slow`, `damageBuff`, `shield`) replacing the single badge at `:258-288`, including multi-effect layout (`epics.md:2011-2020`).
- **Shared surface:** the persistent `shield` aura. **Rule: exactly one implementation exists after both ship.**
  - **If 7.3 ships first:** it adds `renderShieldAura(...)` as a single named function (Task 7.2). 7.6 must **adopt it as its `shield` case** — moving/renaming it is fine, adding a second shield overlay is not.
  - **If 7.6 ships first:** 7.3 must **not** add `renderShieldAura` at all (Task 7.1's grep gate). Warding Cry then contributes only its cast-moment effect, and AC4 is satisfied by 7.6's treatment. Record this in the Dev Agent Record.
- The generic badge block stays untouched by 7.3 either way (Task 7.3) — deleting it would regress readability for the other three effect types, which is 7.6's scope, not this story's.

### 8. Testing standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`.
- `import { Graphics } from 'pixi.js'` **works** under a plain node-environment `vitest run` — no jsdom needed. It is merely slow to transform on WSL2 (~35 s first collect). 7.1's earlier "pixi can't be imported" claim was retracted; do not repeat it.
- Pattern to follow: `apps/host-client/src/vfx/vfx.test.ts` (24 tests, uses a minimal `VfxStage` stub). Run with `npx vitest run src/vfx/spiritcaller-vfx.test.ts` from `apps/host-client`.
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. Pure selection/mapping logic goes in an exported function testable without a canvas; rendering is verified manually.
- `npm run typecheck` at the repo root covers all 10 tsconfigs.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 (simulation-server 60 s boot timeout; a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`). Two runs have produced two different failures. Note it if seen; do not chase it. This story touches no server code.

### 9. Client-UX hook checklist (TRIGGERED — perform and record)

- **Join-flow smoke test:** host lobby → QR join → dungeon still reaches a rendering canvas with no console errors from the new module.
- **HUD readability:** the player chip strip (`:745-832`), boss HP bar (`:834-856`), revive overlay (`:947-988`) and damage numbers stay legible; no effect is drawn over them opaquely. All effects here are strokes/particles, none is a large filled disc (`filled: false` everywhere — do not "improve" a ring into a fill).
- **Reconnect-state visibility:** with a Spiritcaller frozen (`isFrozen`), confirm the `0.3` alpha disconnect cue survives a tint pulse — `createTintPulse` captures and restores the pre-trigger alpha (`primitives.ts:298-318`), so this must hold; verify rather than assume. Also confirm the down/spirit body sprite at `bodyX/bodyY` is still visible under a Soul Mend beam terminating on it.
- **Couch readability at 2–4 m:** each of the four abilities is identifiable without reading text; warm-vs-blood is distinguishable at distance; the Soul Mend link is not mistaken for a bond tether; the shield halo does not occlude health bars or status badges.
- **Effect volume:** with 4 players spamming abilities, no visible frame-rate drop and no unbounded growth in `vfxEngineRef.current.size` (log it once if unsure).

### 10. Previous Story Intelligence (7.1)

- The **clock contract** is the single most expensive mistake available here — 7.1's review found it and redesigned the whole library around lazy `startedAt` to make it non-silent. Pass `Date.now()` to `update()`, and never touch `performance.now()` even though two blocks in the same ticker use it. **On `startedAt`, follow the split Story 7.2's code review established (2026-07-22):** effects added from the transient-delta `useEffect` (the Ancestor's Voice / Spirit Nova / Warding Cry casts, Task 4.2) **must** pass `startedAt = Date.now()` captured at trigger, because that `useEffect` is not `requestAnimationFrame`-gated and a backgrounded host tab stops the ticker while casts keep arriving — omitting `startedAt` there makes them pile up un-started and all fire on resume. Effects created from *inside* the ticker/`renderFrame` (Soul Mend's convergence ring, Task 6.2) keep the lazy capture, since they cannot be triggered on a frame the ticker is not running.
- `createTintPulse` **restores** captured alpha/tint on dispose (a fix from 7.1's review specifically so frozen/spirit players don't snap to opaque). Do not set `target.alpha` yourself around a pulse.
- `createBeam` draws in **local space** and applies its `alpha` at construction — a beam is a fire-and-forget snapshot, which is why the Soul Mend link is re-triggered rather than mutated.
- Ring **implode is supported and clamped** (`maxRadius < startRadius`) — three of this story's effects depend on it.
- `VfxEngine.update()` isolates a throwing effect rather than aborting the loop, so a single bad trigger won't freeze the others — but it will spam at 60 fps, so watch the console during the manual pass.
- 7.1 wired **nothing** into `DungeonScreen.tsx` (its AC3). If this is the first Epic 7 story to land, Task 1 is genuinely new work; if not, it is a verification pass.

### Project Context Rules (from `project-context.md`)

- **Ownership:** `apps/host-client/**` = Host Experience Engineer. Blocked: simulation server, game-rules, mobile, shared-types, net-protocol.
- **Never import `packages/game-rules` in `apps/host-client`.** The balance numbers in §4 are transcribed at authoring time into local host constants. `shared-types` **is** importable and already used (`DungeonScreen.tsx:3-4` — `CLASS_DEFINITIONS`, `PlayerClass`, `BossPhase`, `SessionColor`).
- Host is a **pure client**: no `GameState` mutation, no game-rule checks, no physics reads. §5's geometry gate is a cosmetic correlation heuristic and must be commented as such.
- `Math.random()` **is** permitted here — "host UI animations, cosmetic effects" is the one allowed place (`createParticleBurst` already uses it).
- TypeScript strict; no `any` without an explicit suppression comment.
- Tunable visual values go in **named constants** at the top of the vfx module, not inline in the delta handler.
- Files kebab-case; events `noun:verb`; colors as `0xrrggbb` numbers in canvas code, never CSS strings.

### Project Structure Notes

- New files live beside 7.1's module: `apps/host-client/src/vfx/spiritcaller-vfx.ts`, `apps/host-client/src/vfx/spiritcaller-vfx.test.ts`. Re-export from `apps/host-client/src/vfx/index.ts`.
- Naming precedent for 7.2/7.4/7.5: `<class>-vfx.ts`. If 7.2 already created `stonehide-vfx.ts` with shared helpers (e.g. a common accent burst), **reuse them** rather than duplicating.
- No `vite.config.ts` alias changes needed — internal relative imports only.
- No `packages/ui-kit` involvement (host-only, no mobile use case).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:1952-1969`] — Story 7.3 ACs (distinct effects; heal-vs-damage split; Soul Mend ranged-targeting indicator; Warding Cry shield persistence "reuses Story 7.6's status-effect visual work where applicable")
- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 frame; "7.2–7.8 have no dependency on each other"
- [Source: `_bmad-output/planning-artifacts/epics.md:2005-2020`] — Story 7.6's scope (the four-type status treatment this story composes with)
- [Source: `_bmad-output/planning-artifacts/epics.md:2032-2034`] — the precedent for a whitelist edit inside a rendering story (`boss:charged`, 7.7)
- [Source: `_bmad-output/planning-artifacts/epics.md:2061`] — Epic 7 non-goals (no pixel art, no new mechanics, no protocol/schema changes)
- [Source: `apps/host-client/src/vfx/index.ts:1-19`] — public API surface
- [Source: `apps/host-client/src/vfx/types.ts:10-18`] — `EffectHandle`; [`:20-24`] `VfxStage`; [`:26-45`] the **clock contract**; [`:52-55`] `progress()`
- [Source: `apps/host-client/src/vfx/primitives.ts:38-86`] — `createParticleBurst` (palette form, allocate-once)
- [Source: `apps/host-client/src/vfx/primitives.ts:200-233`] — `createRingShockwave` (implode clamped at `:219`)
- [Source: `apps/host-client/src/vfx/primitives.ts:246-273`] — `createBeam` (local-space geometry at `:256-258`)
- [Source: `apps/host-client/src/vfx/primitives.ts:294-320`] — `createTintPulse` (captures/restores alpha+tint at `:298-302,315-318`)
- [Source: `apps/host-client/src/vfx/primitives.ts:113-184`] — `createTrail` (deliberately unused here)
- [Source: `apps/host-client/src/vfx/vfx.test.ts`] — test pattern to follow
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:25-44`] — constants; [`:84-96`] `renderFrame` signature (9 Maps); [`:97-99`] virtual-space scaling + `Date.now()`
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:101-175`] — Players section (flash cosine `:131-133,142-144`, frozen `0.3` `:144`, body sprite `:148-174`)
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:234-256`] — bond tethers (2 px line — the visual Soul Mend must not resemble)
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:258-288`] — generic status badge block (7.6's to replace, not this story's)
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:404-417`] — `initPixi` (engine construction point); [`:418-499`] ticker (`update()` call site; note `performance.now()` at `:465,487`); [`:502-525`] cleanup
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:537-623`] — transient-delta effect; [`:551-553`] the `ability:fired` branch this story extends
- [Source: `apps/host-client/src/session/host-session.ts:46-64`] — the whitelist to extend; [`:67`] `applyDelta` running unconditionally outside it
- [Source: `packages/net-protocol/src/apply-delta.ts:260-287`] — existing `cast:started` / `cast:cancelled` / `cast:completed` handling (proof the whitelist edit is behavior-neutral)
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:268-285`] — cast delta payloads; `startedAt` is server-epoch (`:273`)
- [Source: `packages/shared-types/src/player.ts:43`] — `PlayerState.channelingAbility`, the frame-loop signal for Soul Mend
- [Source: `apps/host-client/src/App.tsx:20,42-48`] — `latestTransientDelta` single-value batching + 400 ms clear
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2010-2013`] — AIM_CAST branch `continue`s **before** the `ability:fired` broadcast
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2053-2062`] — `ability:fired` broadcast, gated on `inDungeon`
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2160-2182`] — Warding Cry status application (server-epoch `expiresAtMs`) and Spirit Nova's cast-position anchor
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`] — toolkit rationale, post-review changes, D-7.1-A…D
- [Source: `_bmad-output/implementation-artifacts/3-17-spiritcaller-kit-rework-ancestors-voice-spirit-nova-warding-cry.md`] — Ancestor's Voice mixed-faction resolution, Spirit Nova expanding sweep (`SPIRIT_NOVA_DURATION_MS`/`SPIRIT_NOVA_MAX_RADIUS_PX`), Warding Cry `allies-in-zone` shield (magnitude 30 / 4000 ms)
- [Source: `_bmad-output/implementation-artifacts/3-18-soul-mend-ranged-spirit-targeting-revive.md`] — channel lifecycle, cancellation causes, `cast:completed` addition, server-authoritative `startedAt` rationale
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:9-24`] — color token table; [`:105-115`] the Raw Earth / Spirit Chant two-layer thesis; [`:176-227`] per-token reservations (`accent-spirit` = bonds/spirit form, `accent-warm` = firelight/reward/revive, `corruption-blood` = injury, `accent-purify` = purification only)
- [Source: `_bmad-output/project-context.md`] — ownership, PixiJS host-renderer rules, `Math.random()` allowance, no `game-rules` import in host, constants convention

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, `gds-dev-story`)

### Debug Log References

- `npx vitest run src/vfx/spiritcaller-vfx.test.ts` (in `apps/host-client`) — RED first ("Failed to load url ./spiritcaller-vfx"), then GREEN: **8 passed**.
- `npx vitest run` (in `apps/host-client`) — **43 passed** (7.1's 24 + 7.2's 11 + this story's 8), no regressions.
- `npm run typecheck` (repo root, all 10 tsconfigs) — green, twice (after the initial wiring and after the Soul-Mend ring-cancel fix).
- `npm test` (repo root) — **510 passed, 3 skipped**, run twice. Both runs failed only in `tests/e2e` and *differently* (run 1: two delta-wait timeouts incl. Storm Eye zone-tick; run 2: `simulation-server did not start within 60s`, 0 individual test failures). This is the documented WSL2 e2e flake (Testing Standards §8: "Two runs have produced two different failures … this story touches no server code"). Verified not caused by this story: `grep -rn "host-client" tests/` returns **0** hits, so nothing under `tests/**` exercises any file this story changed.

### Completion Notes List

**What shipped (rendering only — the Spiritcaller mechanics already existed, Stories 3.17/3.18)**

- **New pure module `apps/host-client/src/vfx/spiritcaller-vfx.ts`** — palette + geometry constants, `planSpiritcallerCast` (canvas-free, unit-tested), `factionAccentFor`, and thin primitive composers (`triggerSpiritcallerCast`, `triggerFactionAccent`, `triggerSoulMend{Start,Link,Terminal}`, `triggerShieldPulse`). No `new Graphics()`; everything is composed from 7.1's five primitives.
- **Task 1 was a verification pass, not new work** — 7.2 already landed the first-story-wins `VfxEngine` wiring (construct, `update(Date.now())`, teardown). Reused verbatim; added nothing. `createTintPulse` is imported inside the new module (where the tint pulses live), so `DungeonScreen`'s primitive imports were unchanged.
- **Task 2 — whitelist** forwards `cast:started`/`cast:cancelled`/`cast:completed` to the host visual callback. Behaviour-neutral: `applyDelta` runs unconditionally one line later and already handled all three, so mirror state is byte-identical (documented at the call site).
- **Tasks 4 — delta path.** Extended the existing `ability:fired` branch: a Spiritcaller owned cast (idx 0/1/3) takes the planner path and **never** sets `flashUntil` (AC1). A zero-aim Ancestor's Voice → `plan === null` → SILENT, no flash (matches the 7.2 review decision). Every other class falls through to 7.2's config-table logic unchanged. The caster's own `circle` is passed as the tint-pulse target (or `null` on a late-join race). Delta-triggered casts stamp `startedAt = Date.now()` (BACKGROUNDED-TICKER rule).
- **Task 5 — mixed-faction accents.** Two-layer per AC3: Layer 1 (always-correct) is the two-palette effect itself; Layer 2 is best-effort per-target accents from per-frame `GameState` HP diffing (the only source immune to `latestTransientDelta` batching), gated by an active cast's window + geometry, capped at `MAX_FACTION_ACCENTS_PER_CAST`, seeded silently on first sight, and pruned on entity removal. Commented in code as a cosmetic correlation heuristic that may mis-attribute or miss — never a rule check.
- **Task 6 — Soul Mend channel indicator**, driven entirely from `PlayerState.channelingAbility` (Soul Mend never emits `ability:fired`). Start ring's imploding radius *is* the progress bar; a warm link beam re-triggers every `SOUL_MEND_BEAM_INTERVAL_MS` following both live positions; terminal effect chosen by the three-tier rule (observed `cast:completed`/`cast:cancelled` delta → else infer from target `!isDown`). **Never** feeds the server-epoch `channel.startedAt` to a primitive (clock contract). **Correctness fix beyond the spec:** the progress ring's effect id is retained and `engine.remove()`d on termination, so an early cancel doesn't leave a 2500 ms ring imploding after the fizzle (safe no-op on normal completion).
- **Task 7 — Warding Cry shield aura.** Grep gate (7.1) found no existing persistent shield treatment (only the generic badge color, which is 7.6's surface), so this story adds `triggerShieldPulse` as the single named implementation 7.6 must adopt. One contracting halo per shielded entity on a slow cadence, at most one live pulse per entity (D-7.1-D answer), gated off `!isDown`/`!spirit`. The generic status-badge block is untouched (7.6's to replace).

**Architecture note (why two patterns coexist).** 7.2 built a declarative config-table (`getAbilityVfxConfig` + `resolveAbilityVfxPlacement`); this story uses the imperative `planSpiritcallerCast` + composer pattern the 7.3 spec mandated. They coexist cleanly in the `ability:fired` branch: Spiritcaller is handled first, everything else falls through to 7.2's table. No 7.2 behaviour changed.

**renderFrame context.** Extended 7.2's 10th `vfxRefs` param (was `{ ironSkinGraphics }`) into a typed `VfxContext` carrying the engine + the four new correlation maps, rather than adding an 11th positional param (per Task 5.1). All new maps are cleared in the unmount cleanup alongside the existing ones.

**Deferred items status:** D-7.1-A/B not exercised (no reentrancy; every handle freshly built). D-7.1-C partially exercised by the Warding Cry / Spirit Nova tint pulse borrowing the caster's circle — bounded to ≤300 ms on the caster's own circle, re-deferred as the spec directs. D-7.1-D directly answered by the per-cast accent cap + one-pulse-per-entity shield + ≤2 Soul Mend beams.

**Hooks:** Client-UX — TRIGGERED, **manual pass NOT run** (needs live host+phone, Spiritcaller, in a dungeon — cannot be driven here). All §9 checklist lines are PENDING; recorded honestly, Task 8.4 left unchecked. Contract-change — not triggered (whitelist edit is behaviour-neutral host-local delivery filtering; no `shared-types`/`net-protocol`/lifecycle change). Simulation-safety — not triggered (no server/game-rules change). Telemetry — N/A.

**Client-UX §9 checklist — all PENDING (require a live session):** join-flow smoke test; HUD readability / no opaque occlusion; reconnect-state (frozen 0.3 alpha survives tint pulse; body sprite visible under Soul Mend beam); couch readability incl. Soul-Mend-link-not-a-bond-tether; effect volume with 4 players. Mechanically guaranteed and test-covered where possible: the no-fallback-flash contract and zero-aim SILENT behaviour (`spiritcaller-vfx.test.ts`), and the volume caps (constructed bounds).

**Post-review addendum (2026-07-23).** Three adversarial layers ran (Blind Hunter / Edge Case Hunter / Acceptance Auditor); see *Review Findings* above. **4 patches applied:** (1) the ticker was calling `VfxEngine.update()` *before* `renderFrame`, which clobbered the Spirit Nova / Warding Cry tint pulses every frame — moved it *after* `renderFrame` while still running it on null-state frames, so 7.2's reap concern and 7.3's Task 1.5 both hold; (2) `soulMendTerminal` markers leaked and could invert a later channel's terminal effect — now pruned each frame when no live `soulMend` visual matches; (3) Spirit Nova's accent window was 420 ms while its sweep is 600 ms, so the outer band never accented — the nova plan now carries a 600 ms window; (4) extracted the Task 7.2 `renderShieldAura(...)` named function (was inlined) so 7.6 can adopt it verbatim. Typecheck green, 43/43 host-client tests pass after the fixes. 2 low findings deferred as `D-7.3-A/B`. The `all three layers agreed` finding was #2 (terminal leak); #1 (tint clobber) was the Auditor's confirmed catch of a 7.2/7.3 ordering conflict I checked off Task 1.5 without honouring.

**Confidence: 80%** — pure logic is covered by 8 passing tests and the repo typechecks; the whole visual surface (four ability looks, the Soul Mend channel/terminal feel, accent attribution quality, shield-vs-badge layering) is unverified until the Client-UX manual pass runs. That pass is the single open item.

### File List

- `apps/host-client/src/vfx/spiritcaller-vfx.ts` (new)
- `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` (new)
- `apps/host-client/src/vfx/index.ts` (modified — re-export the new module)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified — Spiritcaller delta branch, Soul Mend/shield/accent renderFrame blocks, VfxContext, refs, cleanup)
- `apps/host-client/src/session/host-session.ts` (modified — whitelist the three cast deltas)
- `_bmad-output/implementation-artifacts/7-3-spiritcaller-ability-vfx.md` (modified — bookkeeping)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking)

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story 7.3 drafted — Spiritcaller ability VFX (Ancestor's Voice, Spirit Nova, Soul Mend, Warding Cry), including the first-story-wins `VfxEngine` wiring, the `cast:*` transient-delta whitelist extension, and the effect-level + best-effort per-target mixed-faction design. |
| 2026-07-23 | Zero-direction rule tightened after Story 7.2 code review (Decision 2). `planSpiritcallerCast` now returns `null` for a zero-direction Ancestor's Voice (idx 0, directional at range 180) — the sim skips that hit, so the host renders nothing and no flash fires; the self-centred TAP abilities (Spirit Nova idx 1, Warding Cry idx 3) still yield `focus === origin`. Task 8.1 test expectation updated to match. |
| 2026-07-23 | Propagated Story 7.2 code-review fix: delta-triggered casts now stamp `startedAt = Date.now()` at trigger (`triggerSpiritcallerCast` gains a `startedAt` param; Task 4.2/§Pitfalls updated), so a backgrounded host tab cannot pile up un-started effects. Soul Mend's ticker-driven convergence ring keeps lazy capture (documented why). |
| 2026-07-23 | Applied SILENT rule (user decision): a zero-aim Ancestor's Voice (idx 0, directional) renders nothing AND no flash — Task 4.2 rewritten to split ownership from placement (owned-but-skipped → silent; not-our-class → legacy flash), mirroring Story 7.2. |
| 2026-07-23 | Implemented — new `spiritcaller-vfx.ts` (planner + composers), cast-delta whitelist, Spiritcaller `ability:fired` branch (SILENT on zero-aim, no fallback flash), per-frame HP-diff mixed-faction accents, state-driven Soul Mend channel/terminal indicator (progress ring cancelled on early end), Warding Cry shield aura. 8 new tests; typecheck green; Client-UX manual pass pending. |
| 2026-07-23 | Code review (3 adversarial layers) — 4 patches applied (tint-pulse ticker ordering, soulMendTerminal leak/prune, Spirit Nova accent window 600ms, renderShieldAura extraction for 7.6), 2 low findings deferred as D-7.3-A/B. Client-UX manual pass (8.4) still outstanding → in-progress. |

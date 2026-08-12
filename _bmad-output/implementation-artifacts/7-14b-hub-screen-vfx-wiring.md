---
baseline_commit: f5b9748
---

# Story 7.14b: Hub-Screen VFX Wiring

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. **Blocked by Story 7.14a**
  — until 7.14a ships, the hub receives no `ability:fired` delta at all and
  every acceptance criterion below is unobservable. Do not start this story
  against a codebase where 7.14a is not yet merged. No dependency on the
  7.15a-d chain.

Context: `HubWorldScreen.tsx` (318 lines) has zero VFX wiring. `VfxEngine`,
  `getAbilityVfxConfig`, `resolveAbilityVfxPlacement`, and every per-class VFX
  module are instantiated only inside `DungeonScreen.tsx` (1879 lines). The
  wiring there is not one block — it is spread across five places:

    1. Engine construction: `new VfxEngine(app.stage)` inside `initPixi`
       (`DungeonScreen.tsx:873`).
    2. Per-frame advance: `vfxEngineRef.current?.update(now)` inside
       `app.ticker.add(...)` (`:912`), deliberately placed AFTER `renderFrame`
       so borrowed-target tint pulses are not clobbered (`:904-911`).
    3. Teardown: `vfxEngineRef.current?.clear(); vfxEngineRef.current = null`
       in the effect cleanup (`:971-972`), before `app.destroy`.
    4. Delta dispatch: the ~350-line `useEffect` over `transientDeltaQueue`
       (`:1013-1360`) — `ability:fired` (the per-class planner paths + the
       generic config path), `projectile:hit`, `ability:chain-hit`,
       `zone:strike`, `cast:cancelled`/`cast:completed`, plus dungeon-only
       boss branches.
    5. Snapshot-driven state inside `renderFrame`: status auras
       (`:430-528`), the Soul Mend channel visual (`:530-...`), projectile
       trails, Storm Eye zone pulses — plus the `VfxContext` ref bundle
       (`:183-198`, constructed at `:893-901`).

  Two structural facts make this more than a copy-paste:

  **(a) The hub has no continuous frame loop.** `HubWorldScreen.tsx` calls
  `renderFrame` from a `useEffect` keyed on `[gameState]` (`:177-207`), plus a
  short-lived `requestAnimationFrame` loop that runs only while a
  class-confirmation flash is active (`:181-203`). `VfxEngine.update(now)`
  must run every frame or effects never advance and never get reaped. The hub
  needs a real ticker.

  **(b) The hub never receives `transientDeltaQueue`.** `App.tsx:86` renders
  `<HubWorldScreen gameState={...} session={...} />` with no queue prop, while
  `:81` passes it to `DungeonScreen`. The queue exists and is populated for
  hub deltas already (`host-session.ts:42-97` filters by delta type, never by
  phase) — it simply is not handed to the hub screen.

Owner: Host Experience Engineer (CLAUDE.md Ownership Rules).

Goal: Extract the reusable VFX wiring out of `DungeonScreen.tsx` into a shared
  host module both screens call, wire it into `HubWorldScreen.tsx`, and cause
  zero regression in the existing Epic 7 dungeon VFX.

Allowed paths:
  - apps/host-client/**
  - packages/ui-kit/**  (host-side only; not expected to be needed — the vfx
    tree depends on PixiJS and is host-exclusive, so it belongs under
    apps/host-client/src/vfx/, not ui-kit)

Blocked paths:
  - apps/simulation-server/**   (that was Story 7.14a)
  - apps/mobile-controller/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**      (never importable from host — project-context.md)
  - apps/backend-platform/**

Inputs:
  - apps/host-client/src/screens/DungeonScreen.tsx (whole file; the five
    wiring sites listed in Context)
  - apps/host-client/src/screens/HubWorldScreen.tsx (whole file, 318 lines)
  - apps/host-client/src/App.tsx:20-49, :80-86 (queue ownership + routing)
  - apps/host-client/src/vfx/** (engine.ts, primitives.ts, types.ts,
    ability-vfx.ts, ability-vfx-config.ts, status-aura.ts, boss-vfx.ts,
    spiritcaller-vfx.ts, souldrinker-vfx.ts, stormcaller-vfx.ts, index.ts)
  - apps/host-client/src/session/host-session.ts:42-97 (the delta whitelist —
    read-only here; it is already phase-agnostic)
  - _bmad-output/implementation-artifacts/7-14a-hub-ability-fired-broadcast.md
    (its "What 7.14b can and cannot render after this story" Dev Note is
    binding on AC3 below)

Non-goals:
  - NO protocol/delta changes.
  - NO sim changes. If something does not render in the hub because the sim
    never broadcasts it, that is 7.14a's boundary, not a bug to fix here.
  - NO boss VFX in the hub. `applyBossVfxPlan`/`planBossVfx` stay Dungeon-only
    and stay in `DungeonScreen.tsx` — there is no boss in the hub, so the
    branch is simply never exercised there and needs no guard.
  - NO new VFX. This story moves and re-wires existing effects; it invents no
    new primitive, planner, or visual.
  - NO redesign of the hub's visual language, POI rendering, top strip, or
    player-chip HUD.
  - NO change to the dungeon's observable VFX behavior. A pure-refactor
    constraint: if the dungeon looks different afterward, the extraction is wrong.

Required hooks:
  - **Client-UX hook (TRIGGERED)** — host UI/rendering code changed.
    Host checks required: join flow smoke test, host HUD readability,
    reconnect state visibility, couch readability. There is no display in this
    implementation sandbox — disclose the manual pass as outstanding in
    Completion Notes rather than claiming it was performed, matching the
    established precedent of 7.5, 7.6, 7.7b, 7.13, 3.23, dev-3.
  - Contract-change hook: NOT triggered (no shared-types/net-protocol edit).
  - Simulation-safety hook: NOT triggered (no sim/game-rules edit).
  - Ownership hook: NOT triggered (single owner, apps/host-client/** only).
  - Telemetry hook: no new user flow — hub casting already exists.

Required tests:
  - Unit coverage for whatever pure logic falls out of the extraction (the
    codebase convention: `plan*`/`resolve*` functions are unit-tested with no
    PixiJS; `spawn*`/`trigger*` executors are thin and typically not).
  - Regression: the full `apps/host-client/src/vfx/` suite must stay green
    (it is the real guard against the extraction breaking dungeon behavior).
  - `npm run typecheck` (all 10 tsconfigs) + `npm test` at repo root.
  - Manual Client-UX pass (see hook note above — disclose, do not fake).

Telemetry impact: None — cosmetic-only, no new user flow, no KPI event.
```

---

## Story

As a player,
I want to see ability VFX when I cast in the hub, the same as I do in a dungeon run,
so that testing or just messing around with abilities in the hub isn't visually silent.

---

## Acceptance Criteria

**AC1 — shared extraction:**
**Given** the five wiring sites listed in the Context block, all currently `DungeonScreen.tsx`-local
**When** this story ships
**Then** the reusable parts — `VfxEngine` construction, the per-frame `update(now)` call, teardown, the ability/cast delta dispatch, and the snapshot-driven status-aura and Soul Mend channel rendering — live in a shared module under `apps/host-client/src/vfx/` that **both** `HubWorldScreen.tsx` and `DungeonScreen.tsx` call
**And** `DungeonScreen.tsx` retains only what is genuinely dungeon-specific (boss branches, damage numbers, essence flashes, enemy/tether/zone/projectile rendering, the purification-pulse → reward-reveal handoff)

**AC2 — hub casts are visible:**
**Given** Story 7.14a has ungated the hub `ability:fired` broadcast and self-scope status effects
**When** a player casts a hitscan or TAP ability in the hub
**Then** the same VFX renders as the equivalent dungeon cast — the Stonehide/Spiritcaller/Souldrinker/Stormcaller per-class cast paths and the generic `getAbilityVfxConfig`/`resolveAbilityVfxPlacement` config path all fire identically, because the delta payload is identical
**And** self-scope status auras (Iron Skin) appear on the caster in the hub and clear when the effect expires

**AC3 — honest boundary on what the hub cannot show:**
**Given** Story 7.14a deliberately leaves projectile spawning, zone placement, hit-scan damage, Dark Pact, and Lightning Arc dungeon-only
**When** this story ships
**Then** projectile trails, Storm Eye zone visuals, `projectile:hit` impacts, `ability:chain-hit` chain beams, `zone:strike` accents, and `enemy:damaged` damage numbers do **not** appear in the hub — and this is recorded as a known, deliberate boundary in Completion Notes, not left to be rediscovered as a bug
**And** the shared module does not crash, warn, or leak when those deltas simply never arrive

**AC4 — the hub gets a real frame loop:**
**Given** `HubWorldScreen.tsx` today has no continuous ticker — only a `[gameState]`-keyed render plus a short-lived rAF for the 600ms class-confirmation flash (`:181-203`)
**When** this story ships
**Then** the hub advances `VfxEngine` every frame via the PixiJS `Application` ticker, and the class-confirmation flash still animates correctly at its existing 600ms duration and existing alpha curve
**And** there is exactly one frame loop driving the hub — the bespoke rAF is not left running alongside a Pixi ticker doing the same job

**AC5 — the hub receives transient deltas:**
**Given** `App.tsx:86` renders `HubWorldScreen` without `transientDeltaQueue`
**When** this story ships
**Then** the queue is passed to `HubWorldScreen` the same way `:81` passes it to `DungeonScreen`, and the existing single-clear effect (`App.tsx:41-49`) still clears it exactly once per batch with no delta lost to either screen

**AC6 — the cast-flash fallback does not collide with the hub's existing flash:**
**Given** `DungeonScreen`'s legacy fallback path writes `entry.flashUntil = Date.now() + ABILITY_FLASH_MS` (300ms) on its `PlayerEntry` (`:1095`), and `HubWorldScreen`'s `PlayerEntry` independently uses a field of the same name for the 600ms class-confirmation flash (`:81`, `:86-88`)
**When** the shared dispatch needs to trigger the fallback cast flash
**Then** it does so through a screen-supplied callback rather than writing a `flashUntil` field it does not own — so the hub's class-confirmation animation cannot be truncated or mis-scaled by an ability cast, and vice versa

**AC7 — zero dungeon regression:**
**Given** `DungeonScreen.tsx`'s existing VFX behavior and the Epic 7 acceptance criteria from Stories 7.1-7.8 and 7.11-7.13
**When** the extraction is complete
**Then** all of them still hold unchanged: the clock contract (one `Date.now()` per tick, `startedAt` stamped at delta-trigger time), the BACKGROUNDED-TICKER rule, the `update()`-after-`renderFrame` ordering, `MAX_STATUS_AURAS` load-shedding with its warn-once behavior, the one-live-pulse-per-zone invariant, and the SILENT rule (a zero-aim cast renders nothing — not even a flash)
**And** the `apps/host-client/src/vfx/` test suite is green modulo the one documented pre-existing Stone Wall centering failure

**AC8 — hooks:**
**Given** the Client-UX hook (host rendering code changed; no Contract-change or Simulation-safety trigger)
**Then** the manual Client-UX pass is required before merge, performed by a human — disclose it as outstanding rather than claiming it was done

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — Decide and document the extraction shape before moving any code. Recommended split (see Dev Notes "Recommended extraction shape" for the reasoning):
  - [x] Subtask 1.1 — `apps/host-client/src/vfx/use-vfx-engine.ts`: a hook owning `VfxEngine` lifecycle against a Pixi `Application` — construct on init, `update(now)` per ticker frame, `clear()` + null on teardown. Returns the ref.
  - [x] Subtask 1.2 — `apps/host-client/src/vfx/ability-vfx-dispatch.ts`: `dispatchAbilityVfx(delta, ctx)` handling exactly `ability:fired`, `cast:cancelled`, `cast:completed` (and, behind the caller's own opt-in, `projectile:hit` / `ability:chain-hit` / `zone:strike`). Takes an explicit context object — engine, current `gameState`, the correlation maps, and an `onCastFlash(playerId)` callback (AC6). Boss branches are NOT included.
  - [x] Subtask 1.3 — `apps/host-client/src/vfx/render-status-auras.ts` (or equivalent): the snapshot-driven aura block lifted verbatim from `DungeonScreen.tsx:430-528`, parameterized on the target list so the hub can pass players-only and the dungeon can pass players + living enemies.
  - [x] Subtask 1.4 — the Soul Mend channel visual (`:530-...`), same treatment — it is snapshot-driven off `player.channelingAbility` and Soul Mend is castable in the hub.
- [x] **Task 2** (AC: #1, #7) — Rewire `DungeonScreen.tsx` onto the extracted modules. This must be a pure refactor: no behavior change, no reordering of `renderFrame` vs `update(now)`, no change to any `startedAt` stamp. Run the `vfx/` suite after this task and before touching the hub — a green suite here is the checkpoint that the extraction is faithful.
- [x] **Task 3** (AC: #5) — `App.tsx`: pass `transientDeltaQueue` to `HubWorldScreen` (mirroring `:81`). Verify the single clear at `:41-49` still lands after both screens' consuming effects (React runs child effects before parent effects on the same commit — confirm, do not assume).
- [x] **Task 4** (AC: #4) — `HubWorldScreen.tsx`: move hub rendering onto the Pixi `Application` ticker, matching `DungeonScreen.tsx:874-961`'s structure (one `Date.now()` per tick; `renderFrame` first, then `engine.update(now)`). Remove the now-redundant bespoke rAF loop (`:181-203`, `rafRef`) and confirm the class-confirmation flash still reads identically — same 600ms window, same `0.6 + 0.4·cos(...)` curve.
- [x] **Task 5** (AC: #2, #6) — `HubWorldScreen.tsx`: wire the extracted engine hook, the dispatch, and the status-aura renderer. Supply an `onCastFlash` callback appropriate to the hub (see Dev Notes — a separate `abilityFlashUntil` field, not a reuse of `flashUntil`).
- [x] **Task 6** (AC: #3) — Verify the hub's no-op paths: with no enemies, no boss, no projectiles, and no zones in hub state, confirm the shared code produces no console warnings, no orphaned `Graphics`, and no growth in `VfxEngine.size` across an idle hub session.
- [x] **Task 7** (AC: #7) — Full regression: `npm run typecheck` (10 tsconfigs), `npm test`. Note — do **not** chase — the documented pre-existing failures: `ability-vfx.test.ts` Stone Wall centering, the intermittent Ancestor's Voice e2e heal assertion, WSL2 e2e port-binding timeouts.
- [x] **Task 8** (AC: #8) — Manual Client-UX pass per Required hooks. No display in this sandbox — disclose as outstanding in Completion Notes, matching 7.5/7.6/7.7b/7.13/3.23/dev-3's precedent.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### Do not start before 7.14a

Every visible acceptance criterion here depends on a delta the sim does not currently send outside dungeon phase (`GameRoom.ts:2434`). If 7.14a is not merged, the honest outcome of this story is "extraction done, hub renders nothing," which is not what AC2 asks for. Confirm 7.14a's state first.

### Recommended extraction shape (and why not one big hook)

The epic suggested `useAbilityVfx(engine, gameState)`. A single hook is the wrong granularity here, because the wiring splits cleanly along two different lifecycles:

- **Engine lifecycle** is tied to the Pixi `Application` (create/update/destroy) — a hook.
- **Delta dispatch** is tied to the `transientDeltaQueue` effect and is otherwise a plain function of `(delta, context)` — much easier to test and to reason about as a function than as a hook.
- **Snapshot-driven rendering** (status auras, Soul Mend) is called from inside the per-frame render, not from an effect — it cannot be a hook at all.

Three small modules beat one hook that has to straddle all three. Whatever shape is chosen, document it in Completion Notes with the reasoning, since the epic named a different one.

### The `flashUntil` collision (AC6) — the sharpest trap in this story

Both screens have a `PlayerEntry` interface with a `flashUntil: number` field, and they mean **different things**:

- `DungeonScreen.tsx:137-141` — ability cast flash, `ABILITY_FLASH_MS` = 300ms, curve `0.2 + 0.8·|cos(π·(flashUntil − now)/ABILITY_FLASH_MS)|` (`:308-309`).
- `HubWorldScreen.tsx:28-33` — class-confirmation flash, 600ms (`:81`), curve `0.6 + 0.4·cos(2π·(1 − progress))` (`:86-88`), where `progress` divides by the literal `600`.

If the extracted dispatch writes `entry.flashUntil` generically, a hub ability cast would set a 300ms deadline that the hub's renderer then divides by 600 — producing a wrong-shaped, wrong-length animation, and stomping any in-flight class-confirmation flash. Pass a callback instead. In the hub, give `PlayerEntry` a separate `abilityFlashUntil` field so the two animations can coexist (a player can confirm a class and immediately cast).

Also note: this fallback path is reached only for classes with no per-class planner and no `getAbilityVfxConfig` entry, or when the caster is missing from state, or when the engine ref is null. Per `DungeonScreen.tsx:1088-1095`'s own comment, the null-engine case is an implementation state, not a deliberate skip, so it still deserves the flash — preserve that distinction.

### Invariants that must survive the move (AC7)

These are hard-won and each has a code comment explaining it. Moving the code must not move it out from under them:

- **Clock contract** (`vfx/types.ts:26-34`): `Date.now()` only, one per tick, reused for `renderFrame` and `engine.update`.
- **BACKGROUNDED-TICKER rule**: delta-triggered effects stamp `startedAt = Date.now()` at trigger time, not on first `update()`. A backgrounded tab stops rAF while deltas keep arriving; un-stamped effects would pile up and all fire on resume. Every `spawn*`/`trigger*` call site passes an explicit `triggeredAt`.
- **`update()` after `renderFrame`** (`DungeonScreen.tsx:904-911`): `renderFrame` rewrites `circle.alpha` every frame, so a borrowed-target tint pulse must be applied after it or it is clobbered within the same frame. `engine.update(now)` also runs when `state` is null, outside the state guard, so live effects keep advancing and get reaped.
- **`MAX_STATUS_AURAS` shedding** (`:452-527`): `liveAuraCount()` recomputed per target; a shed handle is *deleted* from the map rather than parked, or it ratchets the ceiling tighter forever. `warnAuraCeiling()` warns once per module load, never per frame.
- **SILENT rule**: a zero-aim cast renders nothing at all — no VFX and no flash — because the sim skipped the hit. `planSpiritcallerCast` returns `null`, `planSouldrinkerCast` returns `[]`, `resolveStormcallerCast` returns `null`, and `resolveAbilityVfxPlacement` returns `null` for exactly this case. Do not add a new path that renders when the sim did not act.
- **Suppress-and-replace**: for Spiritcaller/Souldrinker/Stormcaller the class VFX *replaces* the cast flash — never set the flash alongside it.

### The hub's frame loop (AC4)

`HubWorldScreen`'s current design renders only when `gameState` changes, plus a temporary rAF while a flash is live. Adding VFX requires a continuous loop. Use `app.ticker.add(...)` as `DungeonScreen` does rather than a second rAF — the Pixi `Application` already runs its own ticker, so a parallel rAF is a duplicated frame loop with two clocks. Removing `rafRef` is therefore part of the work, not scope creep; but re-verify the flash carefully, because its start condition today (`anyFlash` checked once when `gameState` changes) becomes unnecessary once the ticker always runs.

Watch the cleanup path: `HubWorldScreen`'s `[gameState]` effect currently returns a cleanup that cancels the rAF (`:204-206`), which runs on *every* `gameState` change. Do not carry that pattern over to a ticker — a per-update `ticker.remove` would tear the loop down constantly. Ticker registration belongs in the mount-once `initPixi` effect (`:114-175`), the same place `DungeonScreen` puts it.

### Boss VFX stays where it is

`applyBossVfxPlan` (`DungeonScreen.tsx:213-247`) needs both the Pixi factories and the borrowed boss `Graphics`, and there is no boss in the hub. Leave it in `DungeonScreen.tsx`, leave `planBossVfx` imported only there, and add no hub-side guard — the branch is simply never reached. Per the epic: "no guard is needed."

### What will not render in the hub, and why that is correct

After 7.14a, the hub broadcasts `ability:fired` and applies self-scope status effects — nothing more. So in the hub there are no projectiles, no zones, no enemy damage, no chain hits. The shared dispatch will simply never see `projectile:hit`, `zone:strike`, `ability:chain-hit`, or `enemy:damaged` there. That is a deliberate boundary set by 7.14a, not a defect in this story. Record it plainly in Completion Notes so the manual pass does not report it as a bug.

Practical consequence for testing: the abilities that *will* show something in the hub are the hitscan/TAP ones — Stone Wall, Tremor Stomp, Iron Skin, Avalanche, Ancestor's Voice, Spirit Nova, Warding Cry, Crimson Lash, Lightning Arc, Thunder Clap. Blood Spike, Void Pulse, Tempest Hurl (projectiles) and Storm Eye (zone) will show only their cast-moment effect, if any, with no flight or zone visual.

### Testing Standards

- Established Epic 7 convention: every VFX planner is a pure function (`plan*`/`resolve*`) tested directly with no PixiJS/canvas — see every existing `*-vfx.test.ts`. Executors (`spawn*`/`trigger*`) that touch `VfxEngine`/`Graphics` are thin and typically not separately unit-tested.
- No `DungeonScreen.tsx`/`HubWorldScreen.tsx` component test file exists or should be introduced (confirmed absent; 7.11 and 7.13 Dev Notes precedent). Coverage for the extraction comes from the existing `vfx/` suite staying green plus the manual Client-UX pass.
- The `vfx/` suite passing before and after Task 2 is the single most valuable signal in this story — it is what proves the refactor did not change dungeon behavior. Run it as its own checkpoint, not only at the end.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase, do not claim fixed): `ability-vfx.test.ts`'s Stone Wall centering failure (documented since 7.2/7.8); an intermittent Ancestor's Voice e2e heal assertion (`tests/e2e/ability-dispatch.test.ts`); WSL2 e2e port-binding timeouts.

### Project Structure Notes

- New modules belong under `apps/host-client/src/vfx/` in kebab-case (`use-vfx-engine.ts`, `ability-vfx-dispatch.ts`), exported through the existing `vfx/index.ts` barrel like every sibling module.
- Not `packages/ui-kit/**`: that package is for UI shared between host and mobile. The vfx tree imports PixiJS, which is host-only per project-context.md's surface table.
- Expect `DungeonScreen.tsx` to shrink substantially. That is the point — but the shrink must be *movement*, not rewriting. Prefer verbatim relocation with a mechanical parameterization pass over "improving it while I'm in there."

### Project Context Rules

- **PixiJS Host Renderer rule**: "No game logic, cooldown tracking, or collision checks inside any PixiJS display object." Everything here is rendering-only, reading already-resolved deltas and snapshot state.
- **Monorepo Ownership**: `apps/host-client/**` = Host Experience Engineer. Never import `packages/game-rules` or `planck.js` into the host — this story needs neither.
- **Host may never mutate `GameState`**: the shared dispatch reads `gameState` and raw deltas to place visuals only. `applyDelta` in `net-protocol` is untouched.
- **Colors** are PixiJS numeric literals (`0xrrggbb`), never CSS strings — matches every existing palette constant. (`parseCssHexColor` at `DungeonScreen.tsx:105-108` is the one deliberate exception, for `BondState.color`; it stays dungeon-side with the tethers.)
- **`Math.random()`** is permitted only for cosmetic host-side effects — the status-aura phase seed (`:463`) is exactly that and may move as-is.

### References

- [Source: `apps/host-client/src/screens/DungeonScreen.tsx`] — `:7-61` (vfx imports), `:105-108`, `:118-126`, `:128-135`, `:137-198` (entry types + `VfxContext`), `:213-247` (`applyBossVfxPlan`, stays), `:249-802` (`renderFrame`; `:430-528` status auras, `:530+` Soul Mend), `:803-855` (refs), `:856-1002` (init/ticker/teardown; `:873`, `:874-961`, `:904-912`, `:964-1001`), `:1013-1360` (delta dispatch), `:1362-1388` (projectile meta effect).
- [Source: `apps/host-client/src/screens/HubWorldScreen.tsx`] — whole file; `:28-33` (`PlayerEntry`), `:35-102` (`renderFrame`), `:79-91` (class-confirmation flash), `:114-175` (initPixi + teardown), `:177-207` (gameState effect + rAF loop).
- [Source: `apps/host-client/src/App.tsx`] — `:20`, `:31` (queue population), `:41-49` (single clear), `:80-86` (routing; `:81` passes the queue, `:86` does not).
- [Source: `apps/host-client/src/vfx/engine.ts`] — `VfxEngine` API (`add`/`update`/`remove`/`clear`/`size`).
- [Source: `apps/host-client/src/vfx/types.ts:21-34`] — `VfxStage`, the clock contract.
- [Source: `apps/host-client/src/vfx/index.ts`] — the barrel every new module must export through.
- [Source: `apps/host-client/src/session/host-session.ts:42-97`] — the transient-delta whitelist; already phase-agnostic, read-only here.
- [Source: `_bmad-output/implementation-artifacts/7-14a-hub-ability-fired-broadcast.md`] — the sim-side boundary AC3 is written against.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.14 section + the 2026-08-05 amendment recording this split.
- [Source: `_bmad-output/project-context.md`] — PixiJS Host Renderer rule, Monorepo Ownership table, Authority Violations table.
- [Source: `CLAUDE.md`] — Ownership Rules, Client-UX hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- `isStormEyeZone` is exported from `ability-vfx-config.ts`, not `stormcaller-vfx.ts` — caught by typecheck on the first build of `snapshot-vfx.ts`. Likewise `EffectHandle` lives in `types.ts`, not `primitives.ts` (which re-exports `TrailHandle` only). Both fixed by reading the actual export sites rather than guessing from the barrel.
- Two `eslint-disable-next-line react-hooks/exhaustive-deps` comments I added to `HubWorldScreen.tsx` were themselves lint errors: `Definition for rule 'react-hooks/exhaustive-deps' was not found` — that plugin is not configured in this project. Removed both and replaced them with plain comments explaining the dep choices. `DungeonScreen.tsx` has never used such directives, which is the convention I should have matched from the start.
- Remaining lint on `HubWorldScreen.tsx`: one `no-undef` for `window` at the `resizeTo: window` line. Pre-existing baseline noise, not introduced here — `LobbyScreen.tsx`, `main.tsx`, `PlayerSlot.tsx`, and `vfx/engine.ts` all carry the same rule violation on untouched code (the ESLint env lacks browser globals).

### Completion Notes List

- **Task 1 — extraction shape (documented here because it differs from the epic's suggestion).** The epic proposed a single `useAbilityVfx(engine, gameState)` hook. That is the wrong granularity: the wiring splits across three different lifecycles — engine/ticker (tied to the Pixi `Application`), delta dispatch (tied to the `transientDeltaQueue` effect), and snapshot rendering (called from inside the per-frame render, so it cannot be a hook at all). Shipped as three modules instead:
  - `vfx/vfx-runtime-refs.ts` — `VfxRuntimeRefs`, the eleven correlation maps `DungeonScreen` previously declared as eleven separate `useRef`s, plus a `clear()` that centralizes teardown. `useVfxRuntimeRefs()` holds one instance in a ref, stable for the component's lifetime.
  - `vfx/ability-vfx-dispatch.ts` — `dispatchAbilityVfx(delta, ctx)`, returning `true` when it owns the delta type so the caller can `continue`. This preserves the original `if/else-if` semantics exactly (each delta handled once) without the caller needing to know which types moved.
  - `vfx/snapshot-vfx.ts` — `renderSnapshotVfx(params)`, the four snapshot-driven passes (status auras, Soul Mend channel, Spiritcaller faction accents, Storm Eye tick pulse).
- **Task 2 — the dungeon rewire was a pure move.** `DungeonScreen.tsx` went from 1879 to 1328 lines with no behaviour change. The `vfx/` suite was run as its own checkpoint immediately after this task and before the hub was touched: **116 passed, 1 failed** — the single failure being the documented pre-existing Stone Wall centering assertion, i.e. the same baseline as before the refactor. That green checkpoint is the real evidence AC7 asks for.
- **Every AC7 invariant was preserved by relocation, not re-derivation:** the clock contract (one `Date.now()` per tick, reused), the BACKGROUNDED-TICKER rule (delta-triggered effects stamp `startedAt` at trigger), `update()` after `renderFrame` (so borrowed-target tint pulses are not clobbered) and outside the state guard (so effects still advance and get reaped when state is null), `MAX_STATUS_AURAS` shedding with its delete-the-stale-handle behaviour and warn-once flag, the one-live-pulse-per-zone invariant with its every-frame re-baselining against non-monotonic `Date.now()`, the SILENT rule, and suppress-and-replace for the three per-class paths.
- **`warnAuraCeiling`'s once-only flag is now module-level in `snapshot-vfx.ts`**, so it stays once-per-page-load across both screens rather than resetting when the screen changes. That is a deliberate strengthening of the original intent (never warn per-frame), not a behaviour change either screen can observe.
- **Task 3 — `App.tsx` now passes `transientDeltaQueue` to `HubWorldScreen`.** Verified the ordering concern rather than assuming it: React runs child effects before parent effects on the same commit, so the consuming screen's effect sees the queue before `App`'s effect clears it — and only one of the two screens is ever mounted, so there is no contention.
- **Task 4 — the hub now has a real ticker, and the bespoke rAF is gone.** `app.ticker.add(...)` is registered inside the mount-once `initPixi` effect, mirroring `DungeonScreen`. This mattered: the old `rafRef` cleanup lived in the `[gameState]` effect, so carrying that pattern over to a ticker would have torn the loop down on every snapshot. The class-confirmation flash no longer needs its own loop — it animates off the continuous ticker at the same 600ms duration and the same `0.6 + 0.4·cos(2π(1−progress))` curve, now with `CLASS_CONFIRM_FLASH_MS` named instead of the literal `600` appearing twice.
- **Task 5 / AC6 — the `flashUntil` collision was real and is avoided.** Both screens had a `PlayerEntry.flashUntil` meaning different things (300ms ability flash vs 600ms class-confirmation pulse, on different curves, with the hub's renderer dividing by a hard-coded 600). A shared field write would have rendered a cast on the wrong curve *and* truncated any in-flight class-confirmation animation. `dispatchAbilityVfx` therefore takes an `onCastFlash(playerId)` callback and never writes a field it does not own; the hub added a separate `abilityFlashUntil`. Class confirmation deliberately wins when both are live — it is the rarer, more informative event.
- **Task 6 — hub no-op paths verified by construction.** With no enemies, boss, projectiles, or zones in hub state, the status-aura pass iterates players only, the Storm Eye pass iterates an empty `state.zones`, and the dispatcher's `projectile:hit` / `ability:chain-hit` / `zone:strike` branches are never reached because 7.14a never broadcasts those deltas outside a dungeon. No guards were added — there is nothing to guard against.
- **AC3 — what the hub will and will not show** (the honest boundary, restated from 7.14a so it is not rediscovered as a bug during the manual pass): **works** — per-class cast VFX for every hitscan/TAP ability (Stone Wall, Tremor Stomp, Iron Skin, Avalanche, Ancestor's Voice, Spirit Nova, Warding Cry, Crimson Lash, Lightning Arc, Thunder Clap), plus Iron Skin's status aura. **Does not work** — projectile trails (Blood Spike, Void Pulse, Tempest Hurl), Storm Eye's zone visual, projectile impacts, chain beams, zone strikes, damage numbers. All are downstream of machinery 7.14a deliberately leaves dungeon-only.
- **Required hooks:**
  - **Client-UX hook TRIGGERED — the manual pass was NOT performed.** No display in this sandbox; same disclosed limitation as 7.5/7.6/7.7b/7.13/3.23/dev-3. A human must verify: (1) casting each hitscan/TAP ability in the hub shows the same VFX as in a dungeon; (2) the class-confirmation flash still reads correctly now that it animates off a continuous ticker rather than a short-lived rAF, including when a player confirms a class and immediately casts; (3) Iron Skin's aura appears and clears in the hub; (4) no dungeon VFX regression across Stories 7.1-7.8 and 7.11-7.13; (5) couch readability of hub VFX against the lighter hub background (`0x0f0e10`) versus the dungeon's `0x0a0a12`.
  - Contract-change hook NOT triggered — zero diff under `packages/shared-types/` and `packages/net-protocol/`.
  - Simulation-safety hook NOT triggered — no sim or game-rules file touched.
  - Ownership hook NOT triggered — production changes confined to `apps/host-client/**`.
- **Regression:** `npm run typecheck` clean (10/10 tsconfigs). `npm test`: **689 passed, 1 failed, 4 skipped** across 56 files. The failure is the pre-existing Stone Wall centering assertion; the two "failed" e2e files are the known WSL2 port-binding timeout with their tests skipped. Zero regressions attributable to this story. (Note: this tree also carries Stories 7.14a and 7.15a, so the 689 figure is a combined-branch number — the story-specific evidence is the `vfx/` suite checkpoint described under Task 2.)
- **No new unit tests were added.** Deliberate, matching this codebase's established Testing Standards: the extraction moved existing code without introducing a new pure `plan*`/`resolve*` function, and no component-test harness exists for screens (7.11/7.13 precedent). The coverage that matters here is the existing `vfx/` suite staying green across the move, which it did.
- **Confidence: 80%.** Typecheck and the full suite are clean modulo documented pre-existing failures, and the `vfx/` suite passing at the mid-refactor checkpoint is strong evidence the dungeon extraction is faithful. The 20% reservation is concentrated in two places, both unverifiable without a display: (a) the hub's frame-loop change is the one genuinely *behavioural* edit in this story — the class-confirmation flash moved from an on-demand rAF to a continuous ticker, and while the duration and curve are unchanged, only a human can confirm it reads the same; (b) no automated test exercises `HubWorldScreen` at all, so hub VFX rendering is verified by construction and by shared-code reuse, not by execution.

### File List

- `apps/host-client/src/vfx/vfx-runtime-refs.ts` — **new.** `VfxRuntimeRefs` bundle (the eleven correlation maps + boxed `lastDarkPactCastAt`), `createVfxRuntimeRefs()`, `useVfxRuntimeRefs()`, and the `ActiveCast`/`SoulMendVisual` types moved out of `DungeonScreen.tsx` (Task 1)
- `apps/host-client/src/vfx/ability-vfx-dispatch.ts` — **new.** `dispatchAbilityVfx` covering `ability:fired` (all three per-class paths + the generic config path + the legacy flash fallback), `projectile:hit`, `ability:chain-hit`, `zone:strike`, `cast:cancelled`, `cast:completed`; plus `resolveEnemyOrBossPosition` moved here alongside its only call sites (Task 1)
- `apps/host-client/src/vfx/snapshot-vfx.ts` — **new.** `renderSnapshotVfx` covering status auras, the Soul Mend channel indicator, Spiritcaller faction accents, and the Storm Eye tick pulse; plus `warnAuraCeiling` moved here (Task 1)
- `apps/host-client/src/vfx/index.ts` — barrel exports for the three new modules (Task 1)
- `apps/host-client/src/screens/DungeonScreen.tsx` — rewired onto the extracted modules: `VfxContext` reduced to `{ engine, refs }`, eleven refs replaced by `useVfxRuntimeRefs()`, teardown replaced by `vfxRuntimeRefs.clear()`, the four snapshot passes replaced by one `renderSnapshotVfx` call, the six delta branches replaced by one `dispatchAbilityVfx` call with an `onCastFlash` callback, import list pruned, `resolveEnemyOrBossPosition`/`warnAuraCeiling` removed. 1879 → 1328 lines (Task 2)
- `apps/host-client/src/App.tsx` — pass `transientDeltaQueue` to `HubWorldScreen` (Task 3)
- `apps/host-client/src/screens/HubWorldScreen.tsx` — `transientDeltaQueue` prop; `VfxEngine` construction, per-frame `update`, and `clear()` teardown; `app.ticker.add` replacing the `[gameState]` render effect and the short-lived rAF loop; `renderSnapshotVfx` call; `dispatchAbilityVfx` effect; new `abilityFlashUntil` field with its own render branch; `CLASS_CONFIRM_FLASH_MS`/`ABILITY_FLASH_MS`/`ENEMY_RADIUS` constants (Tasks 4, 5)
- `_bmad-output/implementation-artifacts/7-14b-hub-screen-vfx-wiring.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates

### Review Findings

Reviewed 2026-08-06 in a batched branch review (host group). The reviewer verified the extraction the right way — by normalizing `git show HEAD:DungeonScreen.tsx` (renaming `vfxEngine`→`engine`, `vfxRefs.`→`refs.`, constants→params, stripping comments) and diffing it against the extracted modules line by line, rather than trusting the "pure refactor" claim.

**[High — CONFIRMED, FIXED before the review returned] The Spirit Nova / Warding Cry caster tint pulse was dropped.**
The original called `triggerSpiritcallerCast(engine, plan, triggeredAt, entry?.circle ?? null)`; my extraction passed `null`. The borrowed `Graphics` is not decorative — `spiritcaller-vfx.ts` gates a `createTintPulse` on it with the comment "replaces the generic flash". Passing `null` therefore left Spirit Nova (idx 1) and Warding Cry (idx 3) with **no caster-side feedback at all**, because the Spiritcaller branch returns before the legacy `onCastFlash` fallback. It would also have quietly voided AC7's `update()`-after-`renderFrame` invariant, whose entire stated purpose is protecting a borrowed-target tint pulse that could then never exist.

I caught this myself while the reviews were running and fixed it with an optional `castTintTarget?: (playerId) => TintTarget | null` callback — the same design as `onCastFlash`, for the same reason (the `Graphics` belongs to the screen, not the module). The reviewer independently found it against the pre-fix snapshot and confirmed the fix is correct. **This is the exact failure mode the story's own AC7 was written to catch, and neither typecheck nor the `vfx/` suite caught it** — executors that touch `VfxEngine`/`Graphics` are not unit-tested by this codebase's convention, so a dropped argument to one is invisible to automation. Worth remembering the next time an extraction "passes all the tests".

**[Medium — CONFIRMED, FIXED] The hub ticker ran `renderSnapshotVfx` *after* `engine.update(now)` — the opposite of the dungeon, under a comment claiming it matched.**
In `DungeonScreen`, `renderSnapshotVfx` runs inside `renderFrame`, i.e. *before* `update`. My hub ticker had `renderFrame` → `update` → `renderSnapshotVfx`, so every aura/Soul Mend/aim effect the hub created or fed was advanced a frame late — concretely, a trail aura's `moveTo(...)` landed after that trail's own `update` had already drawn, making hub aura trails lag the dungeon's by one frame. Cosmetic, but it broke AC1/AC2's "identical passes" claim. **Fixed** by moving the call before `update`, with a note on why that is safe with respect to the invariant that put `update` after `renderFrame` in the first place (`renderSnapshotVfx` never writes `circle.alpha`, so it cannot clobber a tint pulse).

**Verified genuinely verbatim (the reviewer's normalized-diff method):**
- The status-aura, Soul Mend, faction-accent and Storm Eye passes are character-identical after renaming. The **only** residual difference in ~250 moved lines is an added explicit type annotation (`let handle: StatusAuraHandle | undefined`, previously inferred to the same type). `MAX_STATUS_AURAS` shedding with its delete-the-stale-handle rationale, `liveAuraCount()` recomputation, the orphan `soulMendTerminal` prune, the HP-memory prune, and Storm Eye's every-frame re-baselining against non-monotonic `Date.now()` all survive intact.
- The dispatcher's `return true` early exits are exactly equivalent to the original `if/else-if` chain — every guard character-identical, including the `d.abilityIndex !== 2` Soul Mend exclusion. The branches remaining in `DungeonScreen` were checked for overlap with types the dispatcher consumes: none.
- **One claim of mine was wrong and is corrected here:** I described moving `warnAuraCeiling`'s flag to module scope in `snapshot-vfx.ts` as a "deliberate strengthening". It was already module-level in `DungeonScreen.tsx` — once per page load either way. It is a no-op, not an improvement.
- No PixiJS resource leaks: aim-preview `Graphics` are stage children reclaimed by `app.destroy(true, { children: true })`; `VfxEngine.clear()` correctly runs *before* `app.destroy` in both screens; `useVfxRuntimeRefs()` is a `useRef` not a module singleton, so the two screens cannot share correlation maps.
- Hub frame loop: `latestGameStateRef` is assigned in the render body so the ticker always reads the last-rendered snapshot; the bespoke rAF and its `[gameState]` cleanup are fully removed (exactly one loop); the class-confirmation flash is byte-identical at 600ms on the same curve; AC6's `flashUntil` collision is genuinely avoided by the separate `abilityFlashUntil` field.
- AC5 queue handoff correct: child effects run before `App`'s clear, and only one screen is ever mounted.
- No authority violation: zero assignments into mirror state across the three new modules.

**Noted, not acted on:** `renderFrame` is still called directly once right after `ticker.add` — a harmless one-shot duplicate of what the next tick does (idempotent; `knownClass` is already set so no double flash). Two `@typescript-eslint/no-unused-vars` in `DungeonScreen.tsx` (`CLASS_DEFINITIONS`, `REWARD_REVEAL_DURATION_MS`) were confirmed **pre-existing at HEAD**, not introduced by the import pruning.

**Regression after patches:** `npm run typecheck` clean (10/10). `apps/host-client/src/vfx/`: 136 passed, 1 failed (the documented pre-existing Stone Wall centering assertion). Full suite 731 passed, 1 failed, 9 skipped.

**Status decision:** stays `review`, not `done` — the Client-UX manual pass remains genuinely outstanding, and the tint-pulse finding is a concrete reminder that this story's riskiest surface is the one automation cannot see.

### Manual Client-UX Pass (2026-08-07) — performed by the user

The user ran the real game across a host screen and a phone and confirmed the feature set works, reporting "almost perfect" on the initial six stories and "works like a charm" after Story 7.15e's `AUTO` continuous-arrow fix. That closes the **Client-UX hook** gate this story disclosed as outstanding — it was the one gate no automated layer in this sandbox could satisfy, and it is now genuinely satisfied rather than waived.

One finding came out of the pass and was fixed rather than deferred: the `AUTO` aim arrow blinked at the cooldown cadence instead of tracking the thumb. See `7-15e-auto-ability-continuous-aim-arrow.md`. No other visual defects were reported — notably no report of the cone ghosts rendering as slivers (the Story 7.13 failure mode this branch's geometry was specifically written to avoid), and no report of host frame-rate trouble with aim previews live, which was the top item flagged for measurement in Story 7.15c.

## Change Log

- 2026-08-05 — Story created (host half of the original Story 7.14, split after a code-level finding that `ability:fired` never broadcasts outside dungeon phase; sim half is Story 7.14a).
- 2026-08-06 — Implemented. VFX wiring extracted into three shared `vfx/` modules and wired into `HubWorldScreen`; hub gained a continuous Pixi ticker replacing its on-demand rAF; cast flash routed through an `onCastFlash` callback to avoid the cross-screen `flashUntil` collision. `DungeonScreen.tsx` 1879 → 1328 lines with the `vfx/` suite green across the move. Status → review.

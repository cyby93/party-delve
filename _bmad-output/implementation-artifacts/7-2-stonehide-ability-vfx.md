---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.2: Stonehide Ability VFX

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want Stone Wall, Tremor Stomp, Iron Skin, and Avalanche to each look and feel distinct when I use them,
so that I can tell my abilities apart at a glance instead of seeing the same flash/circle for all four.

## Acceptance Criteria

1. **Given** the Story 7.1 primitive library exists (`apps/host-client/src/vfx/`), **when** any of Stonehide's four abilities fires in the dungeon, **then** each renders a visually distinct effect — a *shape + color + motion* combination shared with no other Stonehide ability — composed exclusively from the 7.1 primitives (`createRingShockwave`, `createBeam`, `createParticleBurst`), with **no new bespoke `Graphics` code for basic shapes** (7.1 AC3).

2. **Given** each ability's real hit geometry in `packages/game-rules/src/balance.ts`, **when** its effect is placed and sized, **then** the effect's radius and centre match the zone the server actually tests (`isInHitZone`, `combat.ts:42-63`): Stone Wall = radius **100 at the caster**, Tremor Stomp = radius **60 at the caster** (TAP ⇒ `hitRange` is ignored by the sim), Iron Skin = radius **120 at the caster**, Avalanche = radius **50 at `caster + normalizedDirection × 200`**. A visual that lies about reach is worse than the flat circle it replaces.

3. **Given** the current shared cast flash (`entry.flashUntil = Date.now() + ABILITY_FLASH_MS`, `DungeonScreen.tsx:551-553`), **when** the casting player's class is `PlayerClass.STONEHIDE`, **then** none of the four abilities falls back to that flat flash — `flashUntil` is **not** set for Stonehide casts. **And** every other class's existing `ability:fired` behaviour is byte-for-byte unchanged (7.3–7.5 replace those later).

4. **Given** Iron Skin's `damageReduction` status effect is active on the caster, **when** the caster is rendered, **then** a persistent self-buff shell is drawn every frame for the whole effect duration — driven from `player.statusEffects` in the per-frame `GameState`, **not** from the one-shot `ability:fired` delta — so it survives reconnect, late join, and `latestTransientDelta` batching loss, and disappears when the effect leaves `statusEffects`.

5. **Given** Avalanche is an AUTO ability on a 1000 ms cooldown (`balance.ts:33`), **when** up to four Stonehide players hold it down continuously, **then** the per-cast effect budget is bounded by construction: every Stonehide effect's `durationMs` is strictly shorter than that ability's cooldown, so at most one instance per ability per player is ever live, and Avalanche in particular spawns **no particle burst** (its two handles are a static-geometry beam and one stroked ring).

6. **Given** the existing dungeon render, **when** this story ships, **then** nothing regresses: the frozen-player `0.3` alpha disconnect cue, the `isDown`/`isSpirit` body sprite at `bodyX/bodyY`, spirit-form glow, status badges, enemy kill fade, damage numbers, bond tethers, purification pulse and revive overlay all behave exactly as before, and the VFX engine is torn down with the Pixi app.

## Tasks / Subtasks

- [ ] **Task 1: One-time `VfxEngine` wiring in `DungeonScreen.tsx` — guarded "if not already present"** (AC: 1, 6)
  - [ ] 1.1: Nothing consumes `apps/host-client/src/vfx/` yet (7.1 AC3 deliberately skipped integration). **Before writing anything, grep `DungeonScreen.tsx` for `VfxEngine`.** If a sibling story (7.3–7.8) already landed the wiring, reuse it verbatim and skip to Task 2. Do **not** create a second engine instance.
  - [ ] 1.2: If absent: `import { VfxEngine, createRingShockwave, createBeam, createParticleBurst } from '../vfx';` alongside the existing pixi imports (`DungeonScreen.tsx:1-6`).
  - [ ] 1.3: Add `const vfxEngineRef = useRef<VfxEngine | null>(null);` next to the other refs (`:369-392`).
  - [ ] 1.4: In `initPixi`, after `pixiAppRef.current = app;` (`:417`) and before `app.ticker.add(...)`: `vfxEngineRef.current = new VfxEngine(app.stage);` — `app.stage` structurally satisfies `VfxStage` (`vfx/types.ts:21-24`).
  - [ ] 1.5: In the ticker callback, **after** the `renderFrame(...)` call (`:421-433`) and before the boss-sprite block: `vfxEngineRef.current?.update(Date.now());` — exactly one call per frame. **`Date.now()`, not `performance.now()`** (see CLOCK CONTRACT pitfall in Dev Notes).
  - [ ] 1.6: In the unmount cleanup (`:502-525`), **before** `app.destroy(...)`: `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;`. Ordering matters — `clear()` calls `stage.removeChild` on a live stage.
  - [ ] 1.7: Note the ticker's early return `if (!state) return;` (`:419-420`). The engine update sits after `renderFrame`, so on a null state no effect advances. Acceptable: no effect can have been triggered without a state either. Do not restructure the guard.

- [ ] **Task 2: Add the pure ability→visual-config mapping module** (AC: 1, 2, 3, 5)
  - [ ] 2.1: New file `apps/host-client/src/vfx/ability-vfx.ts` (kebab-case, inside the existing vfx module — keeps `DungeonScreen.tsx`'s delta handler thin and the mapping unit-testable without a canvas).
  - [ ] 2.2: Export the Stonehide palette constants (`STONEHIDE_OCHRE`, `STONEHIDE_DUST`, `STONEHIDE_SLATE`) and the per-ability config table exactly as specified in **Per-Ability Visual Spec** below. No magic numbers in the delta handler.
  - [ ] 2.3: Export `getAbilityVfxConfig(playerClass: PlayerClass, abilityIndex: number): AbilityVfxConfig | null` — returns `null` for every class/index that has no bespoke VFX yet. `null` is the single source of truth for "fall back to `ABILITY_FLASH_MS`", which is what keeps AC3's other-classes-unchanged promise mechanical rather than hand-maintained.
  - [ ] 2.4: Export `resolveAbilityVfxPlacement(config, casterX, casterY, directionX, directionY): { casterX, casterY, hitX, hitY } | null` — normalizes the direction the same way the sim does (`GameRoom.ts:2108-2110` uses `normDirX/normDirY`), computes `hit = caster + normDir × config.hitRangePx`, and returns **`null`** when `magnitude === 0 && hitRangePx > 0` (the sim skips the hit in exactly that case — `GameRoom.ts:2203` — while still having broadcast the delta at `:2054-2062`, so a zero-direction Avalanche must render nothing rather than fire a zero-length beam at the caster's feet).
  - [ ] 2.5: Guard `abilityIndex` against out-of-range values from a malformed delta — return `null`, never throw. The delta handler runs inside a `useEffect`; an exception there breaks every later branch.

- [ ] **Task 3: Trigger the four one-shot cast effects from the `ability:fired` delta branch** (AC: 1, 2, 3, 5)
  - [ ] 3.1: In the transient-delta `useEffect` (`DungeonScreen.tsx:537-623`), extend the existing `else if (latestTransientDelta.type === 'ability:fired')` branch (`:551-553`). Do not add a second branch for the same type — the chain is `if/else if`, a duplicate would be dead code.
  - [ ] 3.2: Resolve the caster from state, not from the delta: `const caster = gameState?.players.find(p => p.id === latestTransientDelta.playerId);`. `AbilityFiredDelta` carries only `{ playerId, abilityIndex, directionX, directionY }` — **no class**. Handle `caster === undefined` (late join / reconnect race) by falling through to the existing `flashUntil` path.
  - [ ] 3.3: `const cfg = caster ? getAbilityVfxConfig(caster.class, latestTransientDelta.abilityIndex) : null;` — if `cfg` is `null`, run the **existing** `entry.flashUntil = Date.now() + ABILITY_FLASH_MS` line unchanged. If `cfg` is non-null, **skip** `flashUntil` entirely (AC3) and trigger the configured handles.
  - [ ] 3.4: `const place = resolveAbilityVfxPlacement(cfg, caster.x, caster.y, delta.directionX, delta.directionY);` — bail (render nothing, no flash) when it returns `null`.
  - [ ] 3.5: Compose handles in the order `ring → beam → burst` and hand each to `vfxEngineRef.current?.add(...)`. Do **not** pass `startedAt` — let each handle capture its clock from the first `update(now)` (7.1's clock contract, `vfx/types.ts:26-34`).
  - [ ] 3.6: Use `caster.x/caster.y` from the `gameState` snapshot, not a stale ref. The effect's dependency array is `[latestTransientDelta]` (`:623`) and `gameState` is captured from the closure — this is the same pattern the existing `enemy:damaged` branch already relies on (`:560-577`), so it is consistent, but note the caster may be ~1 frame stale. Acceptable for a 140–420 ms effect; do not add `gameState` to the dependency array (it would re-fire every delta on every state tick).

- [ ] **Task 4: Persistent Iron Skin shell, driven from `GameState`** (AC: 4, 6)
  - [ ] 4.1: Add `const ironSkinGraphicsRef = useRef<Map<string, Graphics>>(new Map());` beside the other graphics maps (`:371-378`).
  - [ ] 4.2: Extend `renderFrame`'s signature with **one** new trailing parameter — an object, not a 10th positional `Map`: `vfxRefs: { ironSkinGraphics: Map<string, Graphics> }`. `renderFrame` has exactly one call site (`:421`), so this is a two-line change. The `VfxEngine` itself is **not** passed into `renderFrame` — one-shot effects are triggered from the delta handler and advanced from the ticker; `renderFrame` stays a pure state→screen redraw.
  - [ ] 4.3: New `renderFrame` section, placed **after** the status-badge section (`:258-288`) so the shell layers below the badges in draw order: for each player, find `player.statusEffects.find(e => e.type === 'damageReduction')`. Render the shell only when the player's class is `PlayerClass.STONEHIDE` **and** that effect exists **and** `!player.isDown` **and** `!(player.isSpirit && !isPurified)` (a defensive buff on a corpse or a spirit is a lie; `isPurified` is already a `renderFrame` parameter).
  - [ ] 4.4: Create-on-first-seen / cleanup-on-missing over `vfxRefs.ironSkinGraphics`, identical in shape to `statusBadgeGraphics` (`:266-288`): prune ids no longer qualifying (`app.stage.removeChild(g); g.destroy(); map.delete(id)`), then create + draw for the qualifying ones with `app.stage.addChild(g)`.
  - [ ] 4.5: Per-frame draw (mutate in place — `g.clear()` then redraw on the *same* object, never `new Graphics()` per frame):
    ```ts
    const remaining = effect.expiresAtMs - now;              // now = the renderFrame-local Date.now() at :99
    const fade = Math.max(0, Math.min(1, remaining / IRON_SKIN_FADE_MS));   // 400
    const breathe = 0.55 + 0.25 * Math.abs(Math.cos(now / IRON_SKIN_BREATHE_MS)); // 260
    const dim = player.isFrozen ? 0.3 : 1;                   // preserve the disconnect cue
    g.position.set(player.x, player.y);
    g.clear();
    g.circle(0, 0, IRON_SKIN_SHELL_RADIUS).stroke({ color: STONEHIDE_SLATE, width: 4, alpha: breathe * fade * dim });
    g.circle(0, 0, IRON_SKIN_SHELL_RADIUS + 5).stroke({ color: STONEHIDE_SLATE, width: 1, alpha: 0.25 * fade * dim });
    ```
  - [ ] 4.6: `IRON_SKIN_SHELL_RADIUS = 30`. Derivation, do not change casually: `PLAYER_RADIUS` is 24 (`:25`) and the status badge row sits at `y = -(PLAYER_RADIUS + 14) = -38` with `STATUS_BADGE_RADIUS = 6` (`:33, :283`), i.e. its lowest pixel is at `-32`. A shell at 30 leaves a 2 px gap under the badges and never occludes them (Client-UX readability check).
  - [ ] 4.7: `expiresAtMs` is host-epoch ms (`packages/shared-types/src/status-effect.ts:6`) but is stamped by the server clock — clamp `fade` to `[0, 1]` as above so host/server skew can only mis-time the fade, never produce a negative alpha or a `NaN`. Do not remove the shell on `remaining <= 0`; removal is the sim's job (the effect leaves `statusEffects` and 4.4's prune handles it).
  - [ ] 4.8: Clear the map in the unmount cleanup (`:519-524`) alongside the other `*.clear()` calls.

- [ ] **Task 5: Composition contract with Story 7.6 (`damageReduction` aura)** (AC: 4)
  - [ ] 5.1: This shell is deliberately **class-gated** (`player.class === PlayerClass.STONEHIDE`). Export the gate as a named predicate from `ability-vfx.ts` — `export const ownsIronSkinShell = (p: { class: PlayerClass; statusEffects: StatusEffect[] }) => boolean` — so 7.6 can negate it in one place instead of re-deriving the condition.
  - [ ] 5.2: Add a comment at the shell's render block stating the contract verbatim: *7.2 owns Stonehide's Iron Skin cast-and-persist visual; 7.6 owns the generic four-type status treatment. If 7.6 ships second, its `damageReduction` aura must exclude players for which `ownsIronSkinShell()` is true, or replace this shell outright and delete this block — never render both.*
  - [ ] 5.3: Do **not** touch the existing `STATUS_EFFECT_COLORS` badge rendering (`:38-44, :258-288`). It is 7.6's surface; the shell sits below it and coexists.
  - [ ] 5.4: Do **not** render anything on *enemies* for Tremor Stomp's `slow` (0.4 / 2000 ms, `balance.ts:204-208`). Enemy-side status visuals are 7.6's scope; this story's stomp conveys the slow through the weight of its own effect only.
  - [ ] 5.5: Story 7.8 owns projectile and zone rendering. Stonehide has **neither** — all four abilities are `'hitscan'` (`balance.ts:130`) and none chains a zone. There is no overlap to negotiate; do not touch the projectile (`:290-309`) or zone (`:311-330`) blocks.

- [ ] **Task 6: Self-check** (AC: 1, 2, 3, 5)
  - [ ] 6.1: New test file `apps/host-client/src/vfx/ability-vfx.test.ts` (leave 7.1's 24 tests in `vfx.test.ts` untouched). Run with `npx vitest run src/vfx/ability-vfx.test.ts` from `apps/host-client`. Node environment, no jsdom — `pixi.js` imports fine under plain vitest (7.1 proved this; the first collect is ~35 s on WSL2).
  - [ ] 6.2: Cover, in one file: (a) all four Stonehide indices return a non-null config and no two configs are shape+color+motion identical; (b) every other class/index returns `null` (the AC3 fallback contract); (c) an out-of-range `abilityIndex` returns `null` instead of throwing; (d) `resolveAbilityVfxPlacement` puts Stone Wall / Tremor Stomp / Iron Skin at the caster and Avalanche at exactly `caster + normDir × 200` for a non-unit input direction (prove the normalization); (e) it returns `null` for a zero direction on Avalanche but a valid placement for a zero direction on Tremor Stomp; (f) every config's longest `durationMs` is strictly less than that ability's cooldown (the AC5 budget invariant — hardcode the four cooldowns as local test literals, **do not import `packages/game-rules`**).
  - [ ] 6.3: `npm run typecheck` at repo root (covers all 10 tsconfigs).
  - [ ] 6.4: Client-UX hook manual pass — see the checklist in Dev Notes. Record the result in the Dev Agent Record; do not claim a check passed that was not actually run.
  - [ ] 6.5: If the Avalanche effect volume or the batching collapse turns out to be visibly wrong in the manual pass, log it to `deferred-work.md` as a new `D-7.2-*` item rather than expanding this story into App-level plumbing.

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping (inserted by `sprint-change-proposal-2026-07-21.md`). Depends only on Story 7.1 (done); no dependency on 7.3–7.8.
- **Context:** Every Stonehide ability today produces the identical 300 ms cosine alpha flash on the caster's circle (`DungeonScreen.tsx:551-553` → `:131-133,142-144`). Story 7.1 shipped `apps/host-client/src/vfx/` — five parameterized primitives plus a `VfxEngine` — and deliberately wired **nothing** into `DungeonScreen.tsx` (its AC3). This story is the first consumer, so it may also be the story that does the one-time engine wiring.
- **Goal:** Four mechanically-honest, mutually distinct Stonehide cast visuals composed from 7.1's primitives, plus a persistent, snapshot-driven Iron Skin buff shell. Rendering only.
- **Allowed paths:**
  - `apps/host-client/src/screens/DungeonScreen.tsx` (MODIFY — engine wiring, `ability:fired` branch, Iron Skin shell in `renderFrame`, cleanup)
  - `apps/host-client/src/vfx/ability-vfx.ts` (NEW — palette, config table, two pure functions)
  - `apps/host-client/src/vfx/ability-vfx.test.ts` (NEW)
  - `apps/host-client/src/vfx/index.ts` (MODIFY — re-export the new module, optional but preferred for a single import site)
  - `_bmad-output/implementation-artifacts/7-2-stonehide-ability-vfx.md`, `deferred-work.md` (story bookkeeping)
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**`, `packages/shared-types/**`, `packages/net-protocol/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`, `apps/host-client/src/App.tsx` (the `latestTransientDelta` batching fix is explicitly out of scope — see below), `apps/host-client/src/session/host-session.ts` (**not needed**: `ability:fired` is already on the transient-delta whitelist, `host-session.ts:46`), `apps/host-client/src/vfx/{types,primitives,engine}.ts` (7.1's surface — consume it, do not modify it; if a primitive genuinely cannot express a needed shape, stop and flag it rather than inlining bespoke `Graphics`).
- **Inputs:** `apps/host-client/src/vfx/{index,types,primitives,engine}.ts` (the toolkit); `apps/host-client/src/screens/DungeonScreen.tsx` (read in full — 1056 lines); `packages/game-rules/src/balance.ts` (read for authoring values **only**, never imported); `packages/game-rules/src/systems/combat.ts:42-63` (`isInHitZone` — the ground truth for AC2); `apps/simulation-server/src/rooms/GameRoom.ts:2054-2062, 2186-2213` (broadcast site + `isDirectional` derivation); `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` (color tokens); `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md` (previous-story intelligence); `_bmad-output/project-context.md`.
- **Non-goals (Epic 7 non-goals, `epics.md:2061`, plus story-local):** no final pixel-art sprites (the PixelLab pass is untouched); no new abilities or mechanics; no protocol/schema changes; no balance changes; no spirit-ability (`spirit-ability:fired`) visuals — Earthen Vigil is not in scope; no enemy-side `slow` visual (7.6); no generic status-effect rework (7.6); no projectile/zone work (7.8, and Stonehide has neither); no rewrite of `App.tsx`'s `latestTransientDelta` plumbing; no hub-world VFX (`ability:fired` is only broadcast when `inDungeon` — `GameRoom.ts:2054`, so hub and training-dummy casts never reach this code and must not be promised).
- **Ownership check:** Single ownership area — `apps/host-client/**`, Host Experience Engineer. No split needed, no cross-context approval required.
- **Hook verdicts:**
  - **Client-UX hook — TRIGGERED.** Host UI change that actually renders (unlike 7.1). Real checks required, see *Client-UX Manual Checklist* below.
  - **Contract-change hook — NOT triggered.** No `packages/shared-types/**`, no `packages/net-protocol/**`, no session-lifecycle, reconnect-flow, room-state, join-flow, prediction/reconciliation/interpolation surface is touched. The `host-session.ts` whitelist is not even edited (`ability:fired` is already forwarded).
  - **Simulation-safety hook — NOT triggered.** No `apps/simulation-server/**`, no `packages/game-rules/**` change. Balance values are read at authoring time and re-declared as local host visual constants.
  - **Telemetry hook — N/A.** No new user flow; this is a visual treatment of an existing flow (`ability:fired`), with no new event, trigger or KPI.
  - **Merge gate:** typecheck green, `ability-vfx.test.ts` green, Client-UX manual pass recorded, no contract drift.

### The mechanical truth each visual must respect (verified, and it contradicts the epic text)

`GameRoom.ts:2186` derives directionality purely from input type: `const isDirectional = abilityDef.inputType !== 'TAP';`, and `isInHitZone` (`packages/game-rules/src/systems/combat.ts:42-63`) then tests a circle at `player + dir × hitRange` when directional, or a circle **at the player, ignoring `hitRange` entirely**, when not.

| Idx | Ability | Input | `isDirectional` | `hitRange` (`balance.ts:102`) | `hitRadius` (`balance.ts:109`) | Where the hit circle actually is |
|---|---|---|---|---|---|---|
| 0 | Stone Wall | RELEASE | true | **0** | 100 | at the caster (range 0) |
| 1 | Tremor Stomp | TAP | **false** | 160 — **dead data** | 60 | at the caster |
| 2 | Iron Skin | TAP | **false** | 0 | 120 | at the caster |
| 3 | Avalanche | AUTO | true | 200 | 50 | at `caster + normDir × 200` |

Two traps this closes:

1. **The epic calls Stone Wall a "Cone/Line" ability (`epics.md:1943`). It is not.** `hitRange` is 0, so its hit circle is centred on the caster with radius 100. Aim direction is still transmitted and still meaningful to the player (it is a RELEASE ability, and `GameRoom.ts:2203` only skips zero-direction casts when `hitRange > 0`, so Stone Wall fires even with no aim), but a forward cone would misstate its reach by 100 px in every direction. The "pull" is expressed by *inward motion*, not by a cone.
2. **Tremor Stomp's `hitRange: 160` is never read** because it is TAP. Any effect placed 160 px forward would point players at empty ground. Centre it on the caster at radius 60.

Other ability facts that drive the spec (`balance.ts`): cooldowns `[2000, 4000, 6000, 1000]` ms (`:33`); damage `[15, 35, 0, 50]` (`:41`); Stone Wall displacement **pull 40 px toward the caster** (`ABILITY_DISPLACEMENT_STRENGTH.stonehide = [40,0,0,0]`, `:227-228`); Tremor Stomp applies `slow` 0.4 / 2000 ms scoped `enemies-in-zone`, Iron Skin applies `damageReduction` 0.3 / 3000 ms scoped **`self`** (`:203-208`); all four are `'hitscan'` (`:130`).

### Palette — Stonehide's earth register

Colors are PixiJS numeric literals (`0xrrggbb`), never CSS strings, in all canvas code. Declared once in `ability-vfx.ts`.

| Constant | Value | Derivation / reserved-token discipline |
|---|---|---|
| `STONEHIDE_OCHRE` | `0xc07d35` | Exactly the `accent-warm` token (`DESIGN.md`, "`accent-warm` — `#c07d35`") — firelight/ochre, the Raw Earth register. Stonehide's impact color. |
| `STONEHIDE_DUST` | `0x8a6f4a` | Darkened, desaturated `accent-warm` — same hue family, no new hue introduced. Kicked-up earth and debris. |
| `STONEHIDE_SLATE` | `0x8f8aa0` | The `border` token `#36334a` lightened for couch legibility at 2–4 m, staying in the Raw Earth cool-grey family. Iron Skin's mineral/armor read: cool against the two warm tones, so "I am defended" is separable from "I hit something" at a glance. |

**Not used, deliberately:** `accent-purify` `0x90d8f0` (reserved exclusively for the purification pulse / boss defeat), `accent-spirit` `0x6ea8d8` (reserved for bonds, spirit form, selections — "spirit energy as punctuation, not wallpaper"), `accent-corruption` `0x7d2dff` (the boss's own fill, `DungeonScreen.tsx:448-451`). Also avoided by construction: enemy red `0xe74c3c` (`:224`), zone purple `0x9b59b6` (`:329`), essence gold `0xf1c40f` (`:582`), projectile white `0xffffff` (`:308`).

### Per-Ability Visual Spec

All four are composed **only** from `createRingShockwave`, `createBeam` and `createParticleBurst` (`apps/host-client/src/vfx/primitives.ts`). No `startedAt` is passed anywhere — the clock is captured on first `update(now)`.

#### 0 — Stone Wall (RELEASE, 2000 ms CD, 15 dmg, pull 40 px inward)

| # | Primitive | Parameters | Placement |
|---|---|---|---|
| 1 | `createRingShockwave` | `{ startRadius: 100, maxRadius: 26, lineWidth: 6, color: 0x8a6f4a, alpha: 0.95, durationMs: 320 }` | caster |
| 2 | `createBeam` | `{ toX: casterX, toY: casterY, width: 5, color: 0x8a6f4a, alpha: 0.8, durationMs: 260 }` with `x/y = caster + normDir × 100` | rim → caster |
| 3 | `createParticleBurst` | `{ color: [0x8a6f4a, 0xc07d35], count: 8, speed: 0.04, spread: 1.2, particleRadius: 5, alpha: 0.9, durationMs: 320 }` | caster |

**Why this reads as a pull.** It is the only **imploding** effect in the kit: the ring starts at exactly the 100 px hit radius and collapses to the caster's body over 320 ms, so the eye is dragged inward along the same vector the 40 px displacement drags enemies. `createRingShockwave` clamps radius at ≥ 0, which is what makes `maxRadius < startRadius` a supported implode rather than a negative-radius crash (7.1 review finding, `primitives.ts:218-219`). The beam is drawn from the rim *back to* the caster — a visible pull vector along the aimed direction, honest because its origin sits exactly on the hit-circle edge rather than promising extra reach. The dust burst is deliberately near-static (`speed: 0.04` px/ms ⇒ ~13 px of travel) so it reads as ground breaking underfoot, not as an outward blast that would contradict the implode.

#### 1 — Tremor Stomp (TAP, 4000 ms CD, 35 dmg, `slow` 0.4 / 2000 ms)

| # | Primitive | Parameters | Placement |
|---|---|---|---|
| 1 | `createRingShockwave` | `{ startRadius: 0, maxRadius: 60, lineWidth: 7, color: 0xc07d35, alpha: 1, durationMs: 380 }` | caster |
| 2 | `createRingShockwave` | `{ startRadius: 0, maxRadius: 60, filled: true, color: 0x8a6f4a, alpha: 0.35, durationMs: 260 }` | caster |
| 3 | `createParticleBurst` | `{ color: [0xc07d35, 0x8a6f4a], count: 14, speed: 0.16, spread: 0.9, particleRadius: 6, alpha: 1, durationMs: 420 }` | caster |

**Why this reads as a self-centred shockwave.** Pure outward motion from the body — the exact opposite vector of Stone Wall, at 60 px instead of 100, in ochre instead of dust, so shape, color *and* motion all differ (AC1). The filled under-disc gives the stomp weight and mass (35 damage, the kit's heaviest melee hit) where Stone Wall's single thin implode reads light and grasping. The debris burst is the only fast, wide particle spray in the kit — the impact signature. The `slow` it applies is *not* drawn on enemies here (7.6's scope, Task 5.4); the effect's heaviness is the cue.

#### 2 — Iron Skin (TAP, 6000 ms CD, 0 dmg, `damageReduction` 0.3 / 3000 ms, self)

**Cast moment** (one-shot, via `VfxEngine`):

| # | Primitive | Parameters | Placement |
|---|---|---|---|
| 1 | `createRingShockwave` | `{ startRadius: 120, maxRadius: 30, lineWidth: 5, color: 0x8f8aa0, alpha: 0.9, durationMs: 300 }` | caster |

**Persistent buff** (per-frame, state-driven — see Task 4): a stroked slate double-ring at radius 30 / 35 on the caster, alpha breathing at `0.55 + 0.25·|cos(now / 260)|`, fading out over the final 400 ms of `expiresAtMs`, dimmed to ×0.3 while `isFrozen`.

**Why this reads as a self-buff.** The cast ring converges from 120 px (Iron Skin's real hit radius) onto the body: armour snapping shut, not force going out. The slate hue separates "defended" from Stonehide's two warm offensive tones instantly. Then the persistent shell simply *stays* — a static, slowly-breathing outline that never moves, never expands and never occludes, which is the visual grammar of a state rather than an event. It is the only Stonehide visual with a lifetime longer than half a second.

**Two hard constraints on the persistent part:**
- It must come from `player.statusEffects` in the per-frame `GameState`, **not** from `ability:fired` (AC4). `GameState` is snapshot-reconciled, so the shell is correct after a reconnect, on a late join, and when a batched delta is dropped. A `flashUntil`-style deadline written from the delta would be wrong in all three cases.
- It must **not** be built with `createTintPulse` on the player's circle. See the pitfall below — `renderFrame` overwrites `circle.alpha` every single frame (`:131-133, :142-144`), so a borrowed-target tint pulse on `entry.circle` is silently erased ~60×/s and produces nothing.

#### 3 — Avalanche (AUTO, 1000 ms CD, 50 dmg, directional at range 200)

| # | Primitive | Parameters | Placement |
|---|---|---|---|
| 1 | `createBeam` | `{ toX: hitX, toY: hitY, width: 6, color: 0xc07d35, alpha: 0.75, durationMs: 140 }` | caster → hit centre |
| 2 | `createRingShockwave` | `{ startRadius: 0, maxRadius: 50, lineWidth: 4, color: 0xc07d35, alpha: 0.85, durationMs: 180 }` | hit centre (`caster + normDir × 200`) |

**Why this reads as a directional basic attack, and why it is cheap.** It is the only Stonehide effect that leaves the caster's body: a short strike line landing on a small impact ring exactly where the 50 px hit circle is. Motion is *translational* (out along an axis) versus Stone Wall's inward collapse and Tremor Stomp's radial expansion. It is also the only one with **no particle burst** — the deliberate answer to firing once per second forever (AC5, and D-7.1-D below). `createBeam` draws its geometry once and animates only `alpha` (`primitives.ts:255-268`); `createRingShockwave` is one `clear()` + one `circle()` per frame. Two of the cheapest possible handles, both expiring in under 200 ms.

**Distinctness matrix (AC1) — no two share a row triple:**

| Ability | Motion | Shape | Color | Peak duration |
|---|---|---|---|---|
| Stone Wall | inward collapse + inward drag line | thin ring 100→26 + beam + slow dust | dust `0x8a6f4a` | 320 ms |
| Tremor Stomp | outward radial | thick ring 0→60 + filled disc + fast spray | ochre `0xc07d35` | 420 ms |
| Iron Skin | inward-then-static | ring 120→30, then a fixed breathing shell | slate `0x8f8aa0` | 300 ms + 3000 ms |
| Avalanche | translational | beam + small ring at 200 px | ochre `0xc07d35` | 180 ms |

Iron Skin and Stone Wall both converge, but differ in color, radius (120 vs 100), stroke weight, the absence/presence of a drag beam and dust, and above all in what happens *after* — one leaves a persistent shell, the other leaves nothing.

### Wiring `DungeonScreen.tsx` — exact instructions

**First-story-wins engine wiring.** 7.1 shipped the module unconsumed (`7-1-vfx-engine-foundations.md`, AC3 / Task 9). Stories 7.2–7.8 are mutually independent, so any of them may land first and each describes this same wiring guarded by *"if not already present"*. Grep for `VfxEngine` in `DungeonScreen.tsx` before adding anything; if it is there, reuse it and change nothing about it. If this story is first, it must not regress anything listed in AC6.

The four wiring points (Task 1) with their anchors:

| Step | Anchor in `DungeonScreen.tsx` | Code |
|---|---|---|
| import | `:1-6` | `import { VfxEngine, createRingShockwave, createBeam, createParticleBurst } from '../vfx';` |
| ref | beside `:369-392` | `const vfxEngineRef = useRef<VfxEngine | null>(null);` |
| construct | after `pixiAppRef.current = app;` at `:417` | `vfxEngineRef.current = new VfxEngine(app.stage);` |
| advance | in `app.ticker.add`, right after the `renderFrame(...)` call at `:421-433` | `vfxEngineRef.current?.update(Date.now());` |
| teardown | in the cleanup at `:502-525`, before `app.destroy(...)` | `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;` |

**Delta branch.** The transient-delta `useEffect` (`:537-623`) is one `if / else if` chain keyed on `latestTransientDelta.type`. Extend the existing `ability:fired` branch at `:551-553`; adding a second `else if` for the same type would be unreachable.

```ts
} else if (latestTransientDelta.type === 'ability:fired') {
  const d = latestTransientDelta;
  const entry = playerGraphicsRef.current.get(d.playerId);
  const caster = gameState?.players.find(p => p.id === d.playerId);
  const cfg = caster ? getAbilityVfxConfig(caster.class, d.abilityIndex) : null;
  if (!cfg || !caster) {
    // Unchanged legacy path for every class 7.3-7.5 has not reached yet,
    // and for the late-join/reconnect race where the caster is not in state.
    if (entry) entry.flashUntil = Date.now() + ABILITY_FLASH_MS;
  } else {
    const place = resolveAbilityVfxPlacement(cfg, caster.x, caster.y, d.directionX, d.directionY);
    // place === null: the sim skipped this cast's hit too (zero direction on a
    // ranged ability, GameRoom.ts:2203) — render nothing rather than lie.
    if (place && vfxEngineRef.current) { /* add ring, beam, burst per cfg */ }
  }
}
```

**Class resolution.** `AbilityFiredDelta` is `{ type, playerId, abilityIndex, directionX, directionY }` (`packages/net-protocol/src/messages/server-to-host.ts`) — **it does not carry the caster's class.** Resolve it from `gameState.players`, and never index `CLASS_DEFINITIONS[...]` with an unchecked value.

**Direction → placement.** The sim normalizes before use (`GameRoom.ts:2108-2110`), so the host must too:

```ts
const mag = Math.hypot(directionX, directionY);
if (mag === 0) return cfg.hitRangePx > 0 ? null : { casterX, casterY, hitX: casterX, hitY: casterY };
const hitX = casterX + (directionX / mag) * cfg.hitRangePx;
const hitY = casterY + (directionY / mag) * cfg.hitRangePx;
```

`hitRangePx` is `0` for Stone Wall, Tremor Stomp and Iron Skin, so `hit === caster` for all three and the same code path serves every ability.

### Pitfalls — read before writing code

1. **CLOCK CONTRACT.** No primitive reads a clock; `startedAt` is captured from the first `update(now)` (`vfx/types.ts:26-34`). `renderFrame` uses `Date.now()` (`:99`); the purification-pulse and reward-particle blocks in the same ticker use `performance.now()` (`:465, :486`). Pass **`Date.now()`** to `VfxEngine.update()`. Mixing clocks makes every effect either vanish on frame 1 or leak forever — silently, with no exception. This was 7.1's worst review finding; do not reintroduce it.
2. **`createTintPulse` cannot be used on a player circle.** `renderFrame` assigns `circle.alpha = ...` unconditionally every frame (`:131-133, :142-144`) and calls `circle.clear()` (`:128`). A borrowed-target tint pulse would be overwritten ~60×/s. This is why Iron Skin's persistence is a dedicated `Graphics` in `renderFrame` rather than a fifth primitive call.
3. **Never allocate a display object per frame.** Mutate in place; `g.clear()` + redraw on the same object. This is 7.1 AC2 and the established pattern in every `renderFrame` block.
4. **No bespoke `Graphics` for basic shapes** (7.1 AC3). The one deliberate exception in this story is the Iron Skin *persistent shell*, and it is not an effect: it is a state-driven entity visual that reuses `statusBadgeGraphics`'s create-on-first-seen / cleanup-on-missing pattern verbatim (`:258-288`). The primitives are all fixed-duration one-shots; expressing a 3000 ms state as a primitive would require re-triggering per frame, which is exactly the per-frame-allocation anti-pattern. Record this as a conscious, justified deviation in the Completion Notes.
5. **Rendering only.** No cooldown tracking, no hit resolution, no `GameState` mutation inside display objects (`project-context.md`, "PixiJS Host Renderer"). The host reads `statusEffects`; it never computes them.
6. **Never import `packages/game-rules` in `apps/host-client`.** Every number in this spec is an authoring-time transcription; declare them as local constants in `ability-vfx.ts`. `shared-types` **is** importable and already used (`DungeonScreen.tsx:3-4`) — `PlayerClass`, `StatusEffect` come from there.
7. `Math.random()` is permitted here (`project-context.md`: "host UI animations, cosmetic effects"), and `createParticleBurst` already uses it internally for angle jitter.
8. **Virtual coordinate space.** All canvas coordinates are in the 1920×1080 virtual space; `app.stage.scale` is set per frame at `:97`. Player/enemy `x/y` from `GameState` are already in that space — no conversion.
9. **Draw order.** `app.stage.addChild` puts an effect above existing sprites; `addChildAt(g, 0)` is the "below sprites" idiom used by tethers (`:246`) and zones (`:324`). `VfxEngine.add()` uses plain `addChild` (`engine.ts:22-27`) — one-shot effects sit above, which is correct for short-lived impact cues and is why they are all stroke/particle rather than opaque fills (couch readability: never hide a player, enemy, health bar or badge).

### The two known systemic limitations, and what this story does about them

**(a) `latestTransientDelta` is a single React state value, not a queue.** `App.tsx:20, 42-48` calls `setLatestTransientDelta` per delta and clears it 400 ms later; React 18 auto-batching means two deltas arriving in the same task collapse and only the last reaches `DungeonScreen`'s effect. This is pre-existing (it is why `boss:stomped` visuals are unreliable) and this story inherits it: if two Stonehides fire in the same batched tick, one cast visual is lost.

*Mitigation, concrete:*
- The AC-mandated design already immunizes the highest-value visual: **Iron Skin's persistent shell is driven from `GameState`, never from the delta**, so the buff — the thing a player actually needs to keep track of — can never be lost to batching. Prefer state-driven over delta-driven wherever a choice exists; for one-shot cast flourishes there is no choice.
- Do not design any Stonehide visual that requires seeing *every* delta of a burst. Each of the four effects is idempotent and self-contained; a dropped one costs a single 140–420 ms flourish, never a state error.
- **Re-deferred, not fixed:** do **not** rewrite `App.tsx`'s plumbing inside a VFX story. If the manual pass shows visibly missing casts with 2+ Stonehides, log a new `D-7.2-*` item in `deferred-work.md` proposing a small delta *queue* at the `App.tsx` level, and let the orchestrator schedule it.

**(b) D-7.1-D — no cap, pooling, or back-pressure on concurrent effects** (`deferred-work.md:1271`; 7.1 flagged it as "revisit when 7.2–7.8 reveal real effect volumes"). Avalanche is AUTO on a **1000 ms** cooldown, so it fires continuously for the whole run.

*Mitigation, concrete — bounded by construction rather than by a cap:*
- Every Stonehide effect's `durationMs` is strictly less than that ability's cooldown: Stone Wall 320 < 2000, Tremor Stomp 420 < 4000, Iron Skin 300 < 6000, Avalanche 180 < 1000. **At most one instance of any ability can therefore be live per player at any moment.** Task 6.2(f) asserts this invariant in the test file so a later re-tune cannot silently break it.
- Worst case with the game's maximum 4 players all Stonehide, all spamming: ≤ 4 players × (3 + 3 + 1 + 2) handles = 36 live handles for a few hundred ms, and the realistic steady state is Avalanche only — 4 players × 2 handles = **8 concurrent handles**, of which none is a particle burst.
- Avalanche specifically carries **no `createParticleBurst`** (the only multi-`Graphics` primitive: a `Container` + N children, `primitives.ts:52-66`). Its two handles are a static-geometry beam (alpha-only per frame) and one stroked ring. This is the single most important volume decision in the story — do not "improve" Avalanche by adding sparks.
- **Explicitly re-deferred:** no cap/pool/load-shedding code is added to `VfxEngine`. D-7.1-D stays open for whichever story first produces a genuinely unbounded source (7.6's per-entity status auras and 7.8's zone ticks are the likely candidates). Record in the Completion Notes that 7.2's measured volume is bounded and therefore did not force the issue.

### Previous Story Intelligence (Story 7.1)

From `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`:

- **The whole module is unconsumed.** 7.1's AC3 forbade touching `DungeonScreen.tsx`. Expect zero existing integration and budget for the wiring.
- **`pixi.js` imports fine under a plain `vitest run`** — node environment, no jsdom needed. 7.1's original "pixi can't be imported" claim was **retracted and disproved**; it is merely slow to transform on WSL2 (~35 s first collect). Do not repeat the retracted claim, and do not add jsdom.
- **The clock contract exists because clock-mixing was the near-fatal bug** found in review. Honour it (pitfall 1).
- **`createTintPulse` restores the target's *captured* pre-trigger alpha/tint on dispose** — added specifically so a frozen player at 0.3 alpha does not snap opaque. Irrelevant here only because pitfall 2 rules the primitive out for player circles; the same care applies to anything else that borrows a display object.
- **`createRingShockwave` supports implode** (`maxRadius < startRadius`) because radius is clamped at ≥ 0 — that clamp is what Stone Wall and Iron Skin's cast ring depend on.
- **`createParticleBurst` allocates its `Container` + N `Graphics` once at trigger** and mutates only `position`/`alpha` per frame; default `particleRadius` 8 lands each particle in 8–16 px. The spec above overrides it to 5–6 px so Stonehide's dust does not read as the reward-reveal confetti it was generalized from.
- **`VfxEngine.update()` isolates a throwing effect** (reaps + logs it) rather than aborting the frame — so a bad param degrades one effect, not the whole screen. Do not rely on this as error handling.
- **Open deferrals D-7.1-A/B/C** (double-add ⇒ double dispose, engine reentrancy, no detection of an externally destroyed view) are all caller-contract issues. Avoid them trivially: add each freshly-created handle exactly once, never call `add`/`remove` from inside an effect's `update`, and never hand the engine a `Graphics` that `renderFrame` also owns.
- 7.1's e2e flakiness note still applies (see Testing Standards).

### Client-UX Manual Checklist (hook is TRIGGERED)

Run in a real session — host + at least one phone, class Stonehide, into the dungeon (`ability:fired` is dungeon-only, `GameRoom.ts:2054`). Record pass/fail per line in the Dev Agent Record.

- **Join-flow smoke test:** create session → QR join → class select → start run reaches the dungeon with no console errors from the new module.
- **Couch readability at 2–4 m:** all four abilities are distinguishable *without* looking at the phone. Effects do not obscure player circles, enemy circles, enemy health bars (`:231`), status badges (`:284-287`), the revive overlay or the boss HP bar.
- **Reconnect-state visibility:** kill the phone's connection mid-Iron-Skin. The frozen player keeps the `0.3` alpha cue (`:144`), and the Iron Skin shell dims with it (Task 4.5's `dim` factor) instead of drawing at full strength over a frozen body. On reconnect, the shell is still correct because it comes from the snapshot.
- **Down/spirit states:** a downed or spirit Stonehide shows no Iron Skin shell; the body sprite at `bodyX/bodyY` (`:151-174`) is unaffected.
- **Other classes unchanged:** a Spiritcaller / Souldrinker / Stormcaller cast still produces exactly the old `ABILITY_FLASH_MS` flash.
- **Volume check:** hold Avalanche for ~30 s with the frame counter visible; no frame-rate drop, no accumulating effects (add a temporary `vfxEngineRef.current.size` log if needed and remove it before commit).
- **Teardown:** leave the dungeon / unmount — no PixiJS "destroyed object" warnings.

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`. Run this story's test from inside `apps/host-client`: `npx vitest run src/vfx/ability-vfx.test.ts`.
- Existing precedent to match: `apps/host-client/src/vfx/vfx.test.ts` (24 tests, 7.1). Leave it untouched.
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. The non-trivial logic here is the pure class+index→config mapping and the placement math — both live outside `DungeonScreen.tsx` precisely so they are testable without a canvas. Rendering correctness is verified by the Client-UX manual pass, not by a test.
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 — a 60 s simulation-server boot timeout, and a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`. Two runs produced two different failures during 7.1. Note it if seen; do not chase it, and do not attribute it to a host-only rendering change.

### Project Context Rules (from `project-context.md`)

- **Ownership:** `apps/host-client/**` is Host Experience Engineer's area. This story stays entirely inside it.
- **Never import `packages/game-rules` in `apps/host-client`.** Balance numbers are transcribed at authoring time into local host visual constants.
- **Host is a pure client:** no `GameState` mutation, no game-rule checks, no physics reads.
- **`Math.random()` is permitted** for host UI animations and cosmetic effects only.
- **TypeScript strict**, no `any` without an explicit suppression comment.
- **Constants:** tunable visual values go in named constants in `ability-vfx.ts` (or at the top of `DungeonScreen.tsx` for the two Iron Skin shell values that `renderFrame` reads), never as inline magic numbers in the delta handler.
- **Naming:** files kebab-case; events `noun:verb`; wire types `PascalCase + Msg`.
- **Colors** are PixiJS `number` literals in canvas code; CSS strings appear only in the React/HTML overlay portion of `DungeonScreen.tsx`.

### Project Structure Notes

- New files live in the existing `apps/host-client/src/vfx/` module created by 7.1 (sibling to `screens/`, `session/`, `components/`) — not in `packages/ui-kit` (host-only, no mobile use case) and not in a new directory.
- `ability-vfx.ts` sits *beside* the primitives rather than inside `screens/` so that 7.3–7.5 can extend the same table with their own classes: each later story adds its four entries and its palette constants, and the `null`-means-legacy-flash contract keeps the delta handler unchanged forever after this story.
- Re-export from `apps/host-client/src/vfx/index.ts` so `DungeonScreen.tsx` keeps a single `from '../vfx'` import.
- No `vite.config.ts` alias changes — internal relative import.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:1933-1950`] — Story 7.2 statement and both AC blocks
- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908, 2061`] — Epic 7 frame and Epic-wide non-goals
- [Source: `_bmad-output/planning-artifacts/epics.md:2005-2022`] — Story 7.6 scope (generic four-type status treatment), the boundary Task 5 negotiates
- [Source: `_bmad-output/planning-artifacts/epics.md:2044`] — Story 7.8 scope (projectile/zone/environmental), not overlapping Stonehide
- [Source: `apps/host-client/src/vfx/primitives.ts:38-86`] — `createParticleBurst` params + allocate-once behaviour
- [Source: `apps/host-client/src/vfx/primitives.ts:200-233`] — `createRingShockwave` params; radius clamp at `:218-219` enables implode
- [Source: `apps/host-client/src/vfx/primitives.ts:246-273`] — `createBeam`; local-space geometry drawn once, alpha-only per frame at `:255-268`
- [Source: `apps/host-client/src/vfx/primitives.ts:294-320`] — `createTintPulse`; borrowed target, `view: null`, restores captured alpha/tint
- [Source: `apps/host-client/src/vfx/types.ts:10-24`] — `EffectHandle`, `VfxStage`
- [Source: `apps/host-client/src/vfx/types.ts:26-34`] — CLOCK CONTRACT
- [Source: `apps/host-client/src/vfx/engine.ts:10-60`] — `VfxEngine.add/update/remove/clear`; `addChild` on add at `:22-27`; throwing-effect isolation at `:29-42`
- [Source: `apps/host-client/src/vfx/index.ts`] — public barrel
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:25-44`] — `PLAYER_RADIUS`, `ABILITY_FLASH_MS`, `STATUS_BADGE_RADIUS`, `STATUS_EFFECT_COLORS`
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:84-99`] — `renderFrame` signature and its `Date.now()` clock
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:115-175`] — player rendering; per-frame `circle.alpha` writes at `:131-133, :142-144` (pitfall 2), frozen `0.3` cue at `:144`, body sprite at `:151-174`
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:258-288`] — status-badge create-on-first-seen / cleanup-on-missing pattern the Iron Skin shell copies
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:402-526`] — `initPixi`, the ticker callback (`:418-499`) and the unmount cleanup (`:502-525`) — the four wiring points
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:537-623`] — transient-delta `useEffect`; `ability:fired` branch at `:551-553`
- [Source: `apps/host-client/src/session/host-session.ts:44-63`] — transient-delta whitelist; `ability:fired` already present at `:46`, so no edit is needed
- [Source: `apps/host-client/src/App.tsx:20, 42-48`] — `latestTransientDelta` single-value state + 400 ms clear (the batching limitation)
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2054-2062`] — `ability:fired` broadcast, dungeon-only, payload shape
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2186-2213`] — `isDirectional = inputType !== 'TAP'`; zero-direction skip at `:2203`
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2108-2110`] — direction normalization before range projection
- [Source: `packages/game-rules/src/systems/combat.ts:42-63`] — `isInHitZone`, the ground truth for AC2
- [Source: `packages/game-rules/src/balance.ts:32-45`] — Stonehide cooldowns `[2000,4000,6000,1000]` and damage `[15,35,0,50]`
- [Source: `packages/game-rules/src/balance.ts:98-116`] — `ABILITY_HIT_RANGE_PX` / `ABILITY_HIT_RADIUS_PX` and the directional-vs-TAP comment
- [Source: `packages/game-rules/src/balance.ts:124-131`] — `ABILITY_DELIVERY`: all four Stonehide abilities are `'hitscan'`
- [Source: `packages/game-rules/src/balance.ts:203-208`] — Tremor Stomp `slow` 0.4/2000 ms, Iron Skin `damageReduction` 0.3/3000 ms scope `self`
- [Source: `packages/game-rules/src/balance.ts:226-228`] — `ABILITY_DISPLACEMENT_STRENGTH.stonehide = [40,0,0,0]` (Stone Wall's pull)
- [Source: `packages/shared-types/src/player.ts:3-8, 42`] — `PlayerClass` enum, `PlayerState.statusEffects`
- [Source: `packages/shared-types/src/status-effect.ts:3-7`] — `StatusEffect { type, magnitude, expiresAtMs }`, `expiresAtMs` in host-epoch ms
- [Source: `packages/shared-types/src/class-definitions.ts:21-30`] — Stonehide ability names and input types
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` §1-2] — two-layer Raw Earth / Spirit Chant system and the `accent-warm` / `border` / `accent-spirit` / `accent-purify` token definitions
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`] — previous-story intelligence, review outcomes, retracted pixi/vitest claim
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md:1262-1272`] — D-7.1-A…D
- [Source: `_bmad-output/project-context.md`] — ownership, PixiJS renderer rules, `Math.random()` allowance, no `game-rules` import in host

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story created — Stonehide ability VFX spec (4 abilities), first-consumer `VfxEngine` wiring, state-driven Iron Skin shell, D-7.1-D volume analysis and batching-limitation mitigation. |

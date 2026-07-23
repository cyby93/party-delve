---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.4: Souldrinker Ability VFX

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want Blood Spike, Crimson Lash, Dark Pact, and Void Pulse to each look and feel distinct,
so that Souldrinker's lifesteal/melee/self-cost kit reads clearly in combat.

## Acceptance Criteria

1. **AC1 — Four distinct ability visuals.**
   **Given** the Story 7.1 primitive library (`apps/host-client/src/vfx/`) exists and nothing consumes it yet,
   **when** Blood Spike (`AUTO`, projectile w/ lifesteal), Crimson Lash (`RELEASE`, melee), Dark Pact (`RELEASE`, self-cost buff) and Void Pulse (`RELEASE`, projectile → chained pull zone) fire in the dungeon,
   **then** each renders a visually distinct effect — a shape/color/motion combination not shared with any of the other three — composed **only** from `createParticleBurst` / `createTrail` / `createRingShockwave` / `createBeam` / `createTintPulse`,
   **and** the shared flat `ABILITY_FLASH_MS` alpha-flash is **suppressed** for every Souldrinker cast and **replaced** by the per-ability VFX (matching 7.2/7.3/7.5's suppress-and-replace model — user decision 2026-07-23); it is not merely supplemented, and a Souldrinker cast never sets `entry.flashUntil`,
   **and** each effect's size matches the ability's real hit geometry per the spec table in Dev Notes (Crimson Lash's impact ring = radius 65 at range 180; Void Pulse's impact implode starts at radius 150 = the chained zone radius; Dark Pact's cone reach = 180).

2. **AC2 — Blood Spike's lifesteal reads on the caster.**
   **Given** Blood Spike is a projectile that pays 10 HP on cast and returns 50% of the damage it deals as healing **only when the projectile hits**,
   **when** a Blood Spike projectile hits,
   **then** a dedicated *health-return* indicator plays on the caster — an inward-collapsing blood ring plus a return beam from the impact point to the caster — visually distinct from the generic cast flash and from every existing outward ring in the game (purification pulse, `boss:stomped`),
   **and** it is triggered from the hit moment, not guessed from an HP number (`projectile:hit` is added to the host transient-delta whitelist for this — see AC5),
   **and** an HP-*gain* on a Souldrinker is never rendered with the same cue as an HP-*loss* (see AC3's classifier).

3. **AC3 — Dark Pact's cost is acknowledged, distinctly from the buff, and the no-target case degrades gracefully.**
   **Given** Dark Pact drains 10% of a *living ally's* current HP via a forward cone search (range 180 / radius 80) and grants the caster `damageBuff` 0.25 for 4000 ms **only if a drain target was found** (`GameRoom.ts:1273,1292`),
   **when** Dark Pact fires,
   **then** the cast cone always renders, whether or not a target was found — the host cannot tell at cast time and must not stall waiting,
   **and** the **cost** cue (dark, outward-scattering droplets on the player whose HP fell) is visually distinct in color, direction and shape from the **buff-gained** cue (bright void-purple, inward-collapsing ring on the caster),
   **and** the buff-gained cue is driven off the `damageBuff` entry appearing in `player.statusEffects` in the per-frame snapshot — so when no drain target was found, no buff cue plays and nothing is left half-drawn,
   **and** the loss/gain direction is decided by a **pure, unit-tested classifier** comparing the previous and current HP of each player in the snapshot (`hp` went down ⇒ loss, up ⇒ gain), with no import from `packages/game-rules`.

4. **AC4 — Projectile bodies and zone bodies are specified, not implemented (7.8 seam).**
   **Given** Story 7.8 owns replacing the hardcoded white projectile circle (`DungeonScreen.tsx:308`) and the hardcoded purple zone disc (`:329`),
   **when** this story ships,
   **then** it exports a per-`class`/`abilityIndex` **appearance config** (`apps/host-client/src/vfx/ability-vfx-config.ts`) describing Blood Spike's and Void Pulse's projectile body + trail, and Void Pulse's pull-zone body, with concrete colors/radii/durations,
   **and** this story does **not** edit the Projectiles (`:290-309`) or Zones (`:311-330`) blocks of `renderFrame` — those two blocks stay byte-identical, so 7.4 and 7.8 cannot collide or double-implement,
   **and** the config documents that `ZoneState` has **no** `class`/`abilityIndex` field, so 7.8 must derive Void Pulse's zone identity from `ownerId → player.class === 'souldrinker'` **plus** `effectType === 'pull'` — no schema field is added.

5. **AC5 — Host delivery plumbing, no contract change.**
   **Given** `apps/host-client/src/session/host-session.ts:46-64` currently drops `projectile:hit` before it reaches `DungeonScreen`,
   **when** this story ships,
   **then** `projectile:hit` is added to that whitelist (host-local delivery filtering only — `applyDelta` already handles the type at `packages/net-protocol/src/apply-delta.ts:247-249`, so forwarding it changes no mirror-state behavior),
   **and** no `packages/net-protocol` / `packages/shared-types` / simulation-server file is modified.

6. **AC6 — No regressions.**
   **Given** the shipped host visuals,
   **when** this story ships,
   **then** the ability cast flash (`flashUntil` cosine, `:131-133,142-144`) **for non-Souldrinker classes** — Souldrinker's own flash is suppressed and replaced per AC1 — plus spirit-form glow, the `isDown`/`isSpirit` body sprite at `bodyX/bodyY`, the frozen-player `0.3` alpha disconnect cue, enemy kill fade, floating damage numbers, bond tethers, status badges, the purification pulse + background swap + reward reveal, the revive-timer overlay and the boss HP bar/phase visuals all behave exactly as before,
   **and** the new effects never obscure a player/enemy body, its health bar, its status badges or the revive overlay at a 2–4 m couch viewing distance.

## Tasks / Subtasks

- [ ] **Task 1 — One-time `VfxEngine` wiring in `DungeonScreen.tsx` (AC: 1, 6) — GUARDED: "if not already present".**
  7.2–7.8 are mutually independent; whichever lands first does this. **Before writing, check whether `vfxEngineRef` already exists in the file — if it does, skip this task entirely and reuse it. Do not create a second engine.**
  - [ ] 1.1: `import { VfxEngine, createParticleBurst, createRingShockwave, createBeam } from '../vfx';` (a plain relative import — no vite alias needed, per 7.1's Project Structure Notes).
  - [ ] 1.2: `const vfxEngineRef = useRef<VfxEngine | null>(null);` alongside the other refs (`DungeonScreen.tsx:369-392`).
  - [ ] 1.3: In `initPixi`, after `pixiAppRef.current = app;` (`:417`) and before `app.ticker.add(...)`: `vfxEngineRef.current = new VfxEngine(app.stage);`.
  - [ ] 1.4: Inside the existing ticker callback, **after** the `renderFrame(...)` call (`:421-433`) and before the boss-sprite block: `vfxEngineRef.current?.update(Date.now());` — **exactly one call per frame, using `Date.now()`** to match `renderFrame`'s `const now = Date.now()` (`:99`). See the CLOCK CONTRACT pitfall in Dev Notes; do **not** use `performance.now()` even though the purification-pulse and reward-particle blocks below it do.
  - [ ] 1.5: In the unmount cleanup (`:502-525`), before `app.destroy(...)`: `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;`. Also clear the new refs added in Task 2.

- [ ] **Task 2 — New host-side VFX modules (AC: 1, 2, 3, 4).**
  - [ ] 2.1: `apps/host-client/src/vfx/ability-vfx-config.ts` — the **7.8 seam**. Exports `SOULDRINKER_PALETTE`, `PROJECTILE_APPEARANCE` (keyed `class → [4 entries]`, Souldrinker slots 0/3 populated, everything else `null`) and `ZONE_APPEARANCE` (keyed by `effectType` + owner class). Values from the spec table in Dev Notes. Header comment states: *consumed by Story 7.8, which owns the actual `renderFrame` Projectile/Zone blocks; 7.4 only authors the spec.* No PixiJS import in this file — plain data.
  - [ ] 2.2: `apps/host-client/src/vfx/souldrinker-vfx.ts` — the **pure planner** (Task 3) plus a thin `spawnSouldrinkerVfx(engine, specs, startedAt)` executor that translates each spec into the matching `create*` factory call and `engine.add(...)`, **passing `startedAt` into every factory**. Keep the planner free of any `pixi.js` import so it unit-tests instantly.
    - **BACKGROUNDED-TICKER rule (from Story 7.2's code review, 2026-07-22) — every Souldrinker trigger is subject to it.** All of this story's effects are spawned from the transient-delta `useEffect` (`ability:fired` for Blood Spike's launch/self-cost and the Dark Pact cone; `projectile:hit` for the Blood Spike return and Void Pulse implode; the `damageBuff`-onset diff for the buff cue). That `useEffect` is **not** `requestAnimationFrame`-gated, but `VfxEngine.update()` runs in the ticker, which the browser stops for a hidden/minimised host tab. An effect added with **no** `startedAt` while the ticker is stopped never starts and never completes — casts pile up on the stage and all fire in one frame on resume. So every call site captures `const triggeredAt = Date.now();` and threads it through `spawnSouldrinkerVfx(engine, specs, triggeredAt)`. This **overrides 7.1's "omit `startedAt`" intent** for these delta-triggered effects; it does not conflict with the future-`startedAt` pitfall below, because `triggeredAt` is always "now", never a future time.

- [ ] **Task 3 — Pure, testable mapping functions (AC: 1, 2, 3).** All in `souldrinker-vfx.ts`, all synchronous, no clock reads, no PixiJS, no `packages/game-rules` import.
  - [ ] 3.1: `planSouldrinkerCast(input: CastInput): VfxSpec[]` where `CastInput = { abilityIndex: number; casterX: number; casterY: number; dirX: number; dirY: number; hpFraction: number }` and `VfxSpec` is a discriminated union `{ kind: 'ring' | 'beam' | 'burst'; ...params }`. Returns `[]` for an unknown `abilityIndex`, for a zero-length direction vector, and for a non-finite input — never throws. **The zero-direction `[]` is correct for every Souldrinker index and must render nothing (no fallback flash):** all four abilities are AUTO/RELEASE/projectile with a non-zero hit range or projectile launch (none is a self-centred TAP), so the sim skips each on a zero direction (`GameRoom.ts:2074` projectile guard, `:2203` hitscan guard, `handleDarkPact` early-returns) — the host must not draw an effect the sim did not resolve. This mirrors Story 7.2's Avalanche resolution (code review 2026-07-22, Decision 2: *if the sim skips the hit, the host renders nothing*). Unlike Spiritcaller (7.3) and Stonehide (7.2), Souldrinker has no ability that needs the `focus === origin` exception.
  - [ ] 3.2: `planBloodSpikeImpact(input: { hitX; hitY; casterX; casterY }): VfxSpec[]` — the lifesteal return beam + caster implode ring.
  - [ ] 3.3: `planVoidPulseImpact(input: { hitX; hitY }): VfxSpec[]` — the void implode ring.
  - [ ] 3.4: `planDamageBuffOnset(input: { x; y }): VfxSpec[]` — the buff-gained implode + void burst.
  - [ ] 3.5: `classifyHpChanges(prev: ReadonlyMap<string, number>, next: readonly { id: string; hp: number }[]): { playerId: string; direction: 'gain' | 'loss'; amount: number }[]` — the AC3 classifier. Players absent from `prev` (join/reconnect) yield **no** change. Equal HP yields no change. This is the *only* HP-direction logic in the story; it decides loss-vs-gain purely from the sign, importing nothing.
  - [ ] 3.6: `planHpLossCue(input: { x; y })` / `planHpGainCue(input: { x; y })` — the two opposed caster cues (dark outward droplets vs bright inward ring), used by both Blood Spike's self-cost and Dark Pact's drained ally.

- [ ] **Task 4 — Blood Spike (AC: 1, 2).**
  - [ ] 4.1: In the transient-delta `useEffect` (`:537-623`), extend the `ability:fired` branch. Look up the caster via `gameState?.players.find(p => p.id === delta.playerId)`.
    - **Not an owned Souldrinker cast** — caster not found (late join / reconnect race) **or** `player.class !== PlayerClass.SOULDRINKER` → keep the existing `entry.flashUntil = Date.now() + ABILITY_FLASH_MS` behaviour unchanged and fall through. That flash belongs to another class's story (AC6).
    - **Owned Souldrinker cast → suppress-and-replace (AC1, user decision 2026-07-23): never set `entry.flashUntil`.** Instead compute `planSouldrinkerCast(...)` and render its VFX. This makes the two remaining outcomes fall out for free:
      - **successful cast** → the per-ability VFX renders, no flash (matches 7.2/7.3/7.5 replacing the flash for their class).
      - **zero-aim skip** → every Souldrinker ability is directional/projectile (no self-centred TAP), so the sim skips a zero-aim cast (`GameRoom.ts:2073-2074, 2203`) and `planSouldrinkerCast(...)` returns `[]`; rendering `[]` draws nothing. Result: **no VFX and no flash** (SILENT rule — matches Story 7.2's Avalanche and 7.5's Stormcaller casts).
    - Because the flash is suppressed for *all* owned Souldrinker casts, there is no longer any need to resolve the aim `mag` *before* flashing — just never flash for this class.
  - [ ] 4.2: `abilityIndex === 0` → capture `const triggeredAt = Date.now();` then `spawnSouldrinkerVfx(engine, planSouldrinkerCast({ abilityIndex: 0, ... }), triggeredAt)`: the forward launch beam **plus** the self-cost droplet burst. (Every `spawnSouldrinkerVfx` / `plan*Impact` / buff-onset call site in this story threads its own trigger-time `Date.now()` — see the BACKGROUNDED-TICKER rule in Task 2.2.) Trigger the self-cost cue from `ability:fired` directly — Blood Spike *always* pays 10 HP on cast (`balance.ts:64`), so no HP-delta inference is needed here, which also makes it immune to the batching limitation below.
  - [ ] 4.3: Add `projectile:hit` to `host-session.ts`'s whitelist (AC5). Add nothing else.
  - [ ] 4.4: Add a `projectileMetaRef = useRef<Map<string, { class: PlayerClass; abilityIndex: number; ownerId: string }>>(new Map())`. Populate it in `renderFrame`'s Projectiles block **at the create-on-first-seen point only** (`:300-305`) — one `Map.set` next to the existing `projectileGraphics.set`; delete the entry in the same cleanup loop that deletes the Graphics (`:292-298`). **This is the only edit permitted inside the Projectiles block; do not touch line 308's circle.** Rationale: `applyDelta` removes the projectile from `GameState` on `projectile:hit` (`apply-delta.ts:247-249`), and React batches `setLatestTransientDelta`/`setGameState` together, so by the time the delta effect runs the projectile is already gone from `gameState` — the cache is what survives.
  - [ ] 4.5: New branch in the delta effect: `projectile:hit` → look up `projectileMetaRef.current.get(delta.projectileId)`; if it is Souldrinker slot 0, resolve the owner's current position from `gameState` and spawn `planBloodSpikeImpact({ hitX: delta.x, hitY: delta.y, casterX, casterY })`. If the owner is missing, `isDown` or `isSpirit`, spawn **only** the impact splash and skip the return beam/implode — the sim skips the heal in exactly those cases (`GameRoom.ts:1774`), so the visual must not promise a heal that did not happen.
  - [ ] 4.6: Bound the lifesteal implode to **one live effect per player**: keep `lifestealEffectIdRef = useRef<Map<string, number>>(new Map())`, and on re-trigger call `vfxEngineRef.current.remove(previousId)` before adding the new one. This is the concrete D-7.1-D mitigation (see Dev Notes) for Blood Spike's 1000 ms cooldown.

- [ ] **Task 5 — Crimson Lash (AC: 1).**
  - [ ] 5.1: `abilityIndex === 1` → three fanned `createBeam` strokes from the caster toward the hit-circle centre, plus a `createRingShockwave` outline at the hit circle (centre `caster + dir * 180`, `maxRadius: 65`) so the visual tells the truth about reach and area. Exact parameters in the spec table.
  - [ ] 5.2: Scale the lash's intensity by `hpFraction = clamp(player.hp / player.maxHp, 0, 1)` read from the snapshot — `lowHp = 1 - hpFraction` drives beam width, alpha and the impact burst's particle count per the table. This is a **rendering read of already-broadcast state**, not a damage calculation; do not import or re-derive `ABILITY_HP_SCALED_DAMAGE`. Guard `maxHp <= 0` → treat `hpFraction` as 1.

- [ ] **Task 6 — Dark Pact (AC: 1, 3).**
  - [ ] 6.1: `abilityIndex === 2` → always spawn the cast cone (wide dark beam to `caster + dir * 180` + a faint outline ring of radius 80 at the cone end). This fires on `ability:fired` regardless of whether a drain target existed — the delta carries no target information and `GameRoom` returns early on no-candidates *after* `ability:fired` is already broadcast (`GameRoom.ts:1273` vs `:2054-2062`).
  - [ ] 6.2: **Buff-gained cue, snapshot-driven.** New `useEffect` on `[gameState]` holding `buffedPlayersRef = useRef<Set<string>>(new Set())`. Each run, compute the set of player ids whose `statusEffects` contain `type === 'damageBuff'`. For each id newly present (in the new set, absent from the ref) spawn `planDamageBuffOnset({ x: player.x, y: player.y })`. Then overwrite the ref. Remove ids on expiry so a second Dark Pact re-triggers. Use the snapshot rather than `status:applied` — the latter is not whitelisted and adding it is *not* in this story's scope; `player.statusEffects` is in every snapshot and is reconciled across reconnects (shared context §5).
    - `damageBuff` is applied by exactly one ability in the shipped game — Dark Pact (`balance.ts:216-219`; the other three `ABILITY_STATUS_EFFECT` entries are `slow`, `damageReduction`, `shield`). Note in a code comment that Story 7.6 owns the *persistent* per-status aura; 7.4 only owns the one-shot **onset** pulse, so the two do not double-draw.
  - [ ] 6.3: **Cost cue, classifier-driven.** New `useEffect` on `[gameState]` holding `prevPlayerHpRef = useRef<Map<string, number>>(new Map())`. Each run, call `classifyHpChanges(prevPlayerHpRef.current, gameState.players)`; for each result whose player `class === PlayerClass.SOULDRINKER` **or** who lost HP while a Souldrinker's Dark Pact cone was recently fired, spawn the loss cue at that player's position; then overwrite the ref. **Scope guard:** to keep out of 7.2/7.3/7.6's lane, apply the *gain* cue only to Souldrinkers (Spiritcaller heal visuals are 7.3's) and the *loss* cue only within `DARK_PACT_COST_CUE_WINDOW_MS = 400` of a Souldrinker `ability:fired` with `abilityIndex === 2` (tracked in a ref set by Task 6.1). Every other HP drop — bond drain, enemy melee, Blood Spike's own self-cost, which is already covered by Task 4.2 — is deliberately left untouched by this story.

- [ ] **Task 7 — Void Pulse (AC: 1, 4).**
  - [ ] 7.1: `abilityIndex === 3` → cast visual at the caster: an outward void ring sized to the ability's own hit radius (80) plus a slow inward-reading void particle burst.
  - [ ] 7.2: In the `projectile:hit` branch from Task 4.5, Souldrinker slot 3 → `planVoidPulseImpact({ hitX, hitY })`: a void ring **imploding from radius 150 to 20** — 150 is exactly the chained pull zone's radius (`balance.ts:148`), so the impact visually announces the pull field that is about to appear.
  - [ ] 7.3: Write the pull-zone appearance into `ability-vfx-config.ts` (Task 2.1) **as spec only**. Do not render it — the Zones block of `renderFrame` is 7.8's.

- [ ] **Task 8 — Self-check (non-negotiable per project convention).**
  - [ ] 8.1: One test file, `apps/host-client/src/vfx/souldrinker-vfx.test.ts`, run with `npx vitest run src/vfx/souldrinker-vfx.test.ts` from `apps/host-client`. Cover: (a) each of the four `abilityIndex` values produces a **non-empty and mutually distinct** spec list from `planSouldrinkerCast` (assert distinctness by comparing serialized specs pairwise — this is AC1's machine-checkable core); (b) zero-length direction and non-finite inputs return `[]` without throwing; (c) Crimson Lash's ring centre equals `caster + dir * 180` and its radius is 65, and its beam width increases monotonically as `hpFraction` falls; (d) Void Pulse's impact ring has `startRadius: 150 > maxRadius`, i.e. it implodes; (e) `classifyHpChanges` returns `'loss'` on a decrease, `'gain'` on an increase, nothing on equality, and nothing for a player absent from `prev`.
  - [ ] 8.2: `npm run typecheck` at repo root (covers all 10 tsconfigs).
  - [ ] 8.3: Client-UX hook manual pass — see the checklist in Dev Notes. Record what was observed, per ability, in the Dev Agent Record. **Never claim a check passed that was not actually run.**

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 (Ability & Environmental VFX Prototyping), inserted via `sprint-change-proposal-2026-07-21.md`. 7.1 is **done**; 7.2–7.8 are mutually independent and each depend only on 7.1.
- **Context:** Every Souldrinker ability today renders as the same flat alpha-flash on the caster's circle plus (for the two projectile abilities) the same hardcoded white circle. The kit's identity — pay HP, take HP back — is completely invisible.
- **Goal:** Four distinct, primitive-composed visuals for Blood Spike / Crimson Lash / Dark Pact / Void Pulse; a legible lifesteal-return cue and a legible cost-vs-buff pair; and a written appearance spec that Story 7.8 consumes for the projectile and zone bodies.
- **Allowed paths:**
  - `apps/host-client/src/vfx/**` (new files `ability-vfx-config.ts`, `souldrinker-vfx.ts`, `souldrinker-vfx.test.ts`)
  - `apps/host-client/src/screens/DungeonScreen.tsx` (engine wiring, the transient-delta effect, two new snapshot effects, and the one `Map.set`/`Map.delete` pair in the Projectiles block)
  - `apps/host-client/src/session/host-session.ts` (**one line**: add `projectile:hit` to the whitelist)
  - `_bmad-output/implementation-artifacts/7-4-souldrinker-ability-vfx.md` (this file — Dev Agent Record)
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**`, `packages/shared-types/**`, `packages/net-protocol/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`, `apps/host-client/src/vfx/{types,primitives,engine,index}.ts` (7.1's shipped API — **compose from it, do not modify it**; if you genuinely need a shape the five primitives cannot express, stop and say so rather than inlining bespoke `Graphics` code, per 7.1 AC3), and `_bmad-output/implementation-artifacts/sprint-status.yaml`.
  - Also blocked *within* `DungeonScreen.tsx`: the Projectiles rendering line `:308` and the whole Zones block `:311-330` — **Story 7.8's scope** (AC4).
- **Inputs:** `apps/host-client/src/vfx/{index,primitives,types,engine}.ts`; `DungeonScreen.tsx` (read fully first — 1056 lines); `host-session.ts:44-64`; `packages/net-protocol/src/messages/server-to-host.ts` (delta payload shapes); this file's spec tables; `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`; `3-19-souldrinker-kit-rework-*.md`; `3-15-self-cost-resource-and-mixed-faction-target-resolution.md`.
- **Non-goals (Epic 7-wide):** no final pixel-art sprites (the separate PixelLab pass is untouched); no new abilities or mechanics; no protocol/schema changes (7.7a is the epic's one deliberate exception, not this story). Story-specific: no projectile-body or zone-body rendering (7.8); no persistent status auras (7.6); no other class's abilities (7.2/7.3/7.5); no rewrite of `App.tsx`'s transient-delta plumbing.
- **Ownership check:** single area — `apps/host-client/**`, Host Experience Engineer. No split needed, no cross-context approval required.
- **Hook verdicts (all five, per CLAUDE.md):**
  - **Client-UX hook — TRIGGERED.** Host UI change that actually renders. Real checks required, see *Client-UX Checklist* below.
  - **Contract-change hook — NOT triggered.** No `packages/shared-types/**` or `packages/net-protocol/**` file is touched; no session-lifecycle, reconnect, room-state, join-flow, prediction/reconciliation/interpolation surface is touched. The `host-session.ts` whitelist edit is **host-local delivery filtering**, not a contract: `projectile:hit` is already a defined wire type (`server-to-host.ts:236-240`) already handled by `applyDelta` (`apply-delta.ts:247-249`), and the host already receives it on the wire — the whitelist only decides whether it is forwarded to React state.
  - **Simulation-safety hook — NOT triggered.** Nothing under `apps/simulation-server/**` or `packages/game-rules/**` is modified.
  - **Telemetry hook — N/A.** No new user flow; these are visual treatments of existing flows with existing events.
  - **Ownership hook — clean.** No file outside `apps/host-client/**` (plus this story doc) is written.

### The VFX toolkit you must compose from (`apps/host-client/src/vfx/`)

```ts
class VfxEngine {
  constructor(stage: VfxStage)      // app.stage satisfies VfxStage
  add(handle: EffectHandle): number // returns id; adds handle.view to the stage if non-null
  update(now: number): void         // ONCE per ticker frame; reaps completed effects
  remove(id: number): void          // early cancel — used by the Task 4.6 per-player bound
  clear(): void                     // teardown
}
createParticleBurst({ x, y, color /* number | readonly number[] */, durationMs, alpha?, count=10, speed=0.15 /*px per ms*/, spread=0.5 /*rad*/, particleRadius=8 /*each particle lands in 1x–2x*/ })
createTrail({ x, y, color, durationMs, alpha?, width=6, pointCount=16 }) -> TrailHandle { moveTo(x,y,now), disposed }
createRingShockwave({ x, y, color, durationMs, alpha?, maxRadius /*required*/, startRadius=0, lineWidth=3, filled=false })
createBeam({ x, y, toX, toY, color, durationMs, alpha?, width=4 })
createTintPulse({ target, durationMs, color?, minAlpha=0.2, maxAlpha=1 })   // no x/y; borrows a display object
```

Four hard contracts (violating them is the #1 failure mode, all four established by 7.1's code review):

1. **CLOCK CONTRACT.** No primitive reads a clock. Whatever you pass to `VfxEngine.update(now)` becomes every effect's clock. `renderFrame` uses `Date.now()` (`:99`); the purification-pulse and reward-particle blocks in the same ticker use `performance.now()` (`:465,486`). **Pass `Date.now()`** and never mix. A mixed clock makes effects vanish on frame 1 or leak forever, silently, with no exception. [`vfx/types.ts:26-34`] **On `startedAt` specifically:** 7.1's default is to capture it lazily from the first `update(now)`, but every trigger in *this* story fires from a React `useEffect` that is not `requestAnimationFrame`-gated, so it must instead **stamp `startedAt = Date.now()` at trigger** — see the BACKGROUNDED-TICKER rule in Task 2.2. The `Date.now()` you stamp and the `Date.now()` `update()` runs on are the same clock, so the contract holds.
2. **Never allocate a display object per frame.** Only mutate handles in place. [`vfx/primitives.ts:4-6`]
3. **No bespoke `Graphics` code for basic shapes** (7.1 AC3). Everything in this story's spec table is expressible with the five primitives — verify before reaching for `new Graphics()`.
4. **Rendering only.** No cooldown tracking, collision, or game-rule evaluation in host code.

Two useful capabilities you will rely on:

- `createRingShockwave` supports **implode** (`maxRadius < startRadius`); the radius is clamped at 0 so it is safe. This is what makes the lifesteal / buff-onset cues instantly distinguishable from every existing outward ring in the shipped game. [`primitives.ts:218-219`]
- `createBeam` draws its geometry **once in local space** around `view.position = (x, y)`; only alpha animates. Compute the endpoint at the call site. [`primitives.ts:254-258`]

**`startedAt` pitfall:** do not pass a *future* `startedAt` to stagger effects. `progress()` clamps to 0, so the effect renders at full opacity and holds until its start time arrives — it looks like a stuck artifact, not a delay. If you want a stagger, either skip it or drive it from separate `Date.now()`-stamped triggers. [`vfx/types.ts:52-55`]

### Souldrinker palette

Derived from `DESIGN.md`'s two-layer system (Raw Earth structural / Spirit Chant *earned* accent — "spirit energy as punctuation, not wallpaper"). Souldrinker gets the **blood** family, with `accent-corruption` reserved inside this story for Void Pulse only. Colors are PixiJS `number` literals in canvas code, never CSS strings.

| Constant | Value | Source | Used for |
|---|---|---|---|
| `BLOOD` | `0xc0392b` | UX token `corruption-blood` [`DESIGN.md:24,226`] | Blood Spike, Crimson Lash, lifesteal return |
| `BLOOD_DARK` | `0x7a2019` | shade of `corruption-blood` (not a new hue) | HP-cost droplets, Dark Pact's drain cone |
| `VOID` | `0x7d2dff` | UX token `accent-corruption` [`DESIGN.md:19,224`] | Void Pulse, Dark Pact's buff-gained pulse |
| `VOID_DIM` | `0x4a1a99` | shade of `accent-corruption` | pull-zone fill (spec for 7.8) |

**Do not** use `accent-purify` `0x90d8f0` (reserved exclusively for the purification pulse / boss defeat) or spend `accent-spirit` `0x6ea8d8` (reserved for bonds, spirit form, selections). Note that `accent-corruption` `0x7d2dff` is also the boss's fill and phase-2 glow (`DungeonScreen.tsx:448,451`) — Void Pulse's use is a brief, moving, imploding ring against a static 48 px disc, which reads as a different object; verify this specifically during the boss-level Client-UX pass.

### Per-ability visual spec

Hit geometry is authoritative — a visual that lies about reach is worse than a flat circle. `PLAYER_RADIUS = 24` (`DungeonScreen.tsx:25`). All coordinates are 1920×1080 virtual space. `dx`/`dy` below = the **normalized** `directionX`/`directionY` from the delta (normalize at the call site; the sim broadcasts the raw joystick vector).

| Ability (idx) | Mechanics (authoring reference — do NOT import) | Primitive calls (concrete) |
|---|---|---|
| **Blood Spike** (0) — AUTO, 1000 ms CD, projectile, 12 dmg, self-cost 10 HP, lifesteal 50% on hit | range 150 / radius 50; `ABILITY_SELF_COST_HP.souldrinker[0] = 10`; `ABILITY_LIFESTEAL_PCT.souldrinker[0] = 0.5` | **Cast (launch):** `createBeam({ x: px + dx*PLAYER_RADIUS, y: py + dy*PLAYER_RADIUS, toX: px + dx*90, toY: py + dy*90, color: BLOOD, width: 3, durationMs: 140, alpha: 0.95 })`<br>**Cast (self-cost):** `createParticleBurst({ x: px, y: py, color: BLOOD_DARK, count: 6, speed: 0.07, spread: 1.4, particleRadius: 3, durationMs: 280, alpha: 0.85 })` — small dark droplets scattering **outward** = HP leaving<br>**Impact (lifesteal return):** `createBeam({ x: hitX, y: hitY, toX: px, toY: py, color: BLOOD, width: 3, durationMs: 260, alpha: 0.9 })` **+** `createRingShockwave({ x: px, y: py, color: BLOOD, startRadius: 64, maxRadius: 18, lineWidth: 5, durationMs: 240, alpha: 0.9 })` — ring **implodes into** the caster = HP returning |
| **Crimson Lash** (1) — RELEASE, 3000 ms CD, melee, 30 dmg base, HP-scaled | range 180 / radius 65; `ABILITY_HP_SCALED_DAMAGE.souldrinker[1] = 1.0` | Let `lowHp = 1 - clamp(hp/maxHp, 0, 1)`, `cx = px + dx*180`, `cy = py + dy*180`.<br>**Three fanned strokes**, `k ∈ {-1, 0, +1}`, each rotating `(dx,dy)` by `k * 0.30 rad` to `(rx, ry)`: `createBeam({ x: px, y: py, toX: px + rx*(k === 0 ? 205 : 185), toY: py + ry*(k === 0 ? 205 : 185), color: BLOOD, width: (k === 0 ? 5 : 3) + 4*lowHp, durationMs: 220, alpha: 0.55 + 0.45*lowHp })`<br>**Impact ring at the true hit circle:** `createRingShockwave({ x: cx, y: cy, color: BLOOD, startRadius: 10, maxRadius: 65, lineWidth: 3, durationMs: 260, alpha: 0.5 + 0.4*lowHp })`<br>**Impact spray:** `createParticleBurst({ x: cx, y: cy, color: BLOOD, count: 6 + Math.round(6*lowHp), speed: 0.12, spread: 0.9, particleRadius: 4, durationMs: 300 })` — bloodier the closer to death, matching the mechanic |
| **Dark Pact** (2) — RELEASE, 5000 ms CD, drains ally, self `damageBuff` 0.25 / 4000 ms | cone range 180 / radius 80; `DARK_PACT_DRAIN_PCT = 0.10`; buff **gated on a target being found** | **Cast cone (always, target or not):** `createBeam({ x: px, y: py, toX: px + dx*180, toY: py + dy*180, color: BLOOD_DARK, width: 9, durationMs: 340, alpha: 0.5 })` **+** `createRingShockwave({ x: px + dx*180, y: py + dy*180, color: BLOOD_DARK, startRadius: 80, maxRadius: 80, lineWidth: 2, durationMs: 340, alpha: 0.35 })` (equal start/max = a static outline that just fades — legal, `t` still advances)<br>**Cost on the drained ally** (classifier-driven): the shared loss cue — `createParticleBurst({ x, y, color: BLOOD_DARK, count: 8, speed: 0.09, spread: 1.6, particleRadius: 3, durationMs: 320, alpha: 0.9 })`<br>**Buff gained on the caster** (snapshot-driven, only when it actually landed): `createRingShockwave({ x: px, y: py, color: VOID, startRadius: 76, maxRadius: 26, lineWidth: 4, durationMs: 300, alpha: 0.95 })` **+** `createParticleBurst({ x: px, y: py, color: VOID, count: 8, speed: 0.05, spread: 0.8, particleRadius: 3, durationMs: 300, alpha: 0.8 })`<br>**Distinctness contract:** cost = **dark red, outward, particles**; buff = **void purple, inward, ring**. Opposed on color, direction and shape — readable at 3 m without reading either as the other. |
| **Void Pulse** (3) — RELEASE, 4000 ms CD, projectile → chained pull zone | self radius 80; chained zone radius 150, tick 500 ms, 2000 ms, pull 50 px | **Cast:** `createRingShockwave({ x: px, y: py, color: VOID, startRadius: 8, maxRadius: 80, lineWidth: 3, durationMs: 260, alpha: 0.8 })` **+** `createParticleBurst({ x: px, y: py, color: VOID, count: 8, speed: 0.05, spread: 1.0, particleRadius: 4, durationMs: 300, alpha: 0.7 })` — slow, heavy, non-explosive (contrast with Crimson Lash's fast spray)<br>**Impact:** `createRingShockwave({ x: hitX, y: hitY, color: VOID, startRadius: 150, maxRadius: 20, lineWidth: 5, durationMs: 320, alpha: 0.9 })` — **implodes from exactly the chained zone's 150 px radius**, announcing the pull field about to appear |

Distinctness at a glance (AC1's intent): Blood Spike = thin red streak + tiny droplets; Crimson Lash = three red claw strokes + a big red circle at reach; Dark Pact = one wide dark cone, then either purple-inward (worked) or nothing extra (missed); Void Pulse = purple outward ring at the caster, purple **inward** ring at the impact. No two share a shape+color+direction triple.

### The 7.8 seam — spec, don't implement (AC4)

`DungeonScreen.tsx:308` (`g.circle(0, 0, 8).fill({ color: 0xffffff })`) and `:329` (`g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })`) are **7.8's** to replace. This story ships the data 7.8 will read, in `ability-vfx-config.ts`:

| Entity | Identity key | Appearance spec |
|---|---|---|
| Blood Spike projectile | `ProjectileState.class === 'souldrinker' && abilityIndex === 0` (both fields exist on `ProjectileState`) | core `circle(r=6)` `BLOOD` alpha 1; halo `circle(r=11)` `BLOOD_DARK` alpha 0.4; trail `createTrail({ color: BLOOD, width: 5, durationMs: 220, pointCount: 12 })` |
| Void Pulse projectile | `class === 'souldrinker' && abilityIndex === 3` | core `circle(r=9)` `VOID` alpha 1; halo `circle(r=17)` `VOID_DIM` alpha 0.35; trail `createTrail({ color: VOID, width: 7, durationMs: 300, pointCount: 14 })` |
| Void Pulse pull zone | **`ZoneState` has NO `class`/`abilityIndex`.** Derive: `effectType === 'pull'` **and** `players.find(p => p.id === zone.ownerId)?.class === 'souldrinker'`. Today `'pull'` is only Void Pulse and `'damage'` is only Storm Eye — a comment must say so, since a future pull ability would need a real disambiguator. **Add no schema field** (that would trigger the Contract-change hook for a rendering story). | fill `VOID_DIM` alpha 0.18; stroke `VOID` alpha 0.5 width 2 at `zone.radius`; per-tick inward pulse `createRingShockwave({ startRadius: zone.radius, maxRadius: zone.radius * 0.35, color: VOID, lineWidth: 2, durationMs: 400, alpha: 0.5 })` on the 500 ms cadence — **7.8's to implement, including whether it drives that from `zone:tick` (not currently whitelisted) or from a local 500 ms timer seeded off `zone.expiresAtMs`** |

If 7.8 has already landed when this story is picked up, reuse its config module instead of creating a second one, and add only the missing Souldrinker entries.

### Data sources and how to read them (verified)

Delta payloads (`packages/net-protocol/src/messages/server-to-host.ts`):

```ts
AbilityFiredDelta   = { type:'ability:fired'; playerId; abilityIndex; directionX; directionY }   // NO class field
ProjectileHitDelta  = { type:'projectile:hit'; projectileId; x; y }                              // NO class/ability field
PlayerHpUpdatedDelta= { type:'player:hp-updated'; playerId; hp }
StatusAppliedDelta  = { type:'status:applied'; targetId; effectType; magnitude; expiresAtMs }    // NOT whitelisted; do not add
```

- **`ability:fired` does not carry the class.** Look it up: `gameState.players.find(p => p.id === delta.playerId)?.class`, compare against `PlayerClass.SOULDRINKER` from `shared-types` (already imported at `DungeonScreen.tsx:4`). Handle player-not-found without throwing.
- **`ability:fired` is only broadcast when `inDungeon`** (`GameRoom.ts:2054-2062`). Hub and training-dummy ability use never reaches this delta — do not promise hub VFX.
- **`projectile:hit` does not carry class/abilityIndex** → the `projectileMetaRef` cache from Task 4.4 is mandatory. `ProjectileState` *does* carry `class` and `abilityIndex`, which is why caching at first-seen works.
- **Snapshot state available every frame:** `PlayerState { id, x, y, hp, maxHp, class, sessionColor, isDown, isSpirit, isFrozen, bodyX?, bodyY?, statusEffects, displayName, ... }`; `StatusEffect { type: 'damageReduction'|'slow'|'damageBuff'|'shield'; magnitude; expiresAtMs }`.

**Why `player:hp-updated` alone cannot identify a lifesteal.** It is whitelisted (`host-session.ts:55`) but it is emitted for *five different reasons* that all look identical on the wire:

| Emitter | Site | Direction |
|---|---|---|
| Blood Spike self-cost on cast | `GameRoom.ts:2045-2051` — broadcast **before** `ability:fired` for the same cast | down |
| Blood Spike lifesteal on projectile hit | `GameRoom.ts:1772-1783` | up |
| Dark Pact drain (ally) | `GameRoom.ts:1294-1299` | down |
| Dark Pact transfer (caster) | `GameRoom.ts:1318-1323` | up |
| Enemy melee / bond drain / zone damage | elsewhere | down |

So the story's rule is: **direction, not identity.** `classifyHpChanges` (Task 3.5) compares last frame's HP map against this frame's snapshot and returns `'gain'`/`'loss'` per player from the sign alone — no game rule, no import, no ability inference. Ability-*specific* meaning comes from the ability-specific trigger instead: Blood Spike's self-cost from `ability:fired` (it always costs 10 HP), the lifesteal from `projectile:hit`, the buff from `statusEffects`. The classifier is only load-bearing for **Dark Pact's drained ally**, which no delta identifies.

Note also that the self-cost `player:hp-updated` is broadcast **before** `ability:fired` for the same Blood Spike cast — another reason not to build the cost cue on HP inference.

### Cross-story flash consistency — RESOLVED (suppress-and-replace, 2026-07-23)

All four Epic 7 ability-VFX stories now treat the shared `ABILITY_FLASH_MS` cast flash the same way: **suppress it for the owning class and replace it with the per-ability VFX.** 7.4 was briefly drafted as additive (flash *plus* VFX on a successful Souldrinker cast); Cyby's decision (2026-07-23) aligned it with 7.2/7.3/7.5, so a Souldrinker cast never sets `entry.flashUntil` — see AC1 and Task 4.1.

Consequences, all now consistent across the kit:
- **Successful owned cast** → per-ability VFX only, no flash.
- **Zero-aim skip** (directional cast the sim ignores) → nothing at all: no VFX, no flash (SILENT rule).
- **Non-owned cast** (another class, or caster not in state) → the legacy flash is untouched; that is another story's concern (AC6 covers non-Souldrinker classes).

### Known limitation: `latestTransientDelta` is a single value, not a queue

`App.tsx:20,42-48` — `setLatestTransientDelta` is called per delta and cleared after 400 ms. React 18 auto-batches, so **two deltas arriving in the same task collapse; only the last reaches `DungeonScreen`'s effect.** This is pre-existing (it is why `boss:stomped` visuals are unreliable) and this story inherits it. Consequences and the required posture:

- Do **not** design a visual that requires seeing *every* delta of a burst. Every effect here is a self-contained one-shot; a dropped one loses one flourish, never leaves a stuck artifact.
- A Blood Spike cast broadcasts `player:hp-updated` then `ability:fired` in the same tick; the hp delta will frequently be swallowed. This is precisely why Task 4.2 drives the self-cost cue off `ability:fired` and Task 6.3 drives the drain cue off the **snapshot** (which is reconciled and cannot be swallowed) rather than off `player:hp-updated`.
- `projectile:hit` may likewise be swallowed if it lands in the same batch as another whitelisted delta — the lifesteal cue is then skipped for that shot. Accepted for a prototyping story; the shot's damage number still renders.
- **Do not rewrite the App-level plumbing here.** If a reviewer judges the drop rate to break AC2, raise it as a follow-up (a delta *queue* in `App.tsx`) rather than expanding this story's scope.

### D-7.1-D (no effect cap / pooling / back-pressure) — mitigation, not a re-defer

7.1 deferred effect-volume management with "revisit when 7.2–7.8 reveal real effect volumes" (`deferred-work.md`, D-7.1-D). Blood Spike is the highest-frequency trigger in the whole epic: `AUTO` input at a **1000 ms** cooldown, so a 4-Souldrinker party fires ~4 casts/s, each cast producing 2 effects (beam + 6-particle burst) and each hit producing 2 more.

Worst-case concurrency, computed from this story's own durations: per cast, effect lifetimes are ≤ 340 ms, so at 1 cast/s a single player never has more than ~2–3 concurrent Souldrinker effects; 4 players ⇒ ~12 concurrent handles, each a `Graphics` or a ≤ 8-child `Container`. That is comfortably inside what the existing per-frame `Graphics.clear()`+redraw of every player/enemy/tether already costs.

**Required mitigations (do not skip):**
1. Keep every duration in this story ≤ 340 ms (the table already does). Do not add a persistent/looping effect — those belong to 7.6 (auras) and 7.8 (zones).
2. Bound the lifesteal implode to **one live effect per player** via `lifestealEffectIdRef` + `engine.remove(previousId)` (Task 4.6). This is the only trigger that can fire faster than its own duration.
3. Put every tunable in named constants at the top of `souldrinker-vfx.ts` / `ability-vfx-config.ts` — no magic numbers scattered through the delta handler.

D-7.1-D itself stays deferred as an *engine* feature (a global cap belongs in `vfx/engine.ts`, a blocked path here). Record the measured/observed volumes in the Dev Agent Record so 7.6/7.8 — which do own per-frame and per-tick effects — inherit real numbers instead of a guess.

### Previous Story Intelligence (from 7.1)

- 7.1 deliberately did **not** touch `DungeonScreen.tsx` (its AC3), so nothing consumes the engine yet. **Assume you may be the first consumer** and do the Task 1 wiring, but guard every step with "if not already present" — 7.2/7.3/7.5/7.7/7.8 may have landed first.
- The single worst bug 7.1's review caught was **clock mixing**; it now cannot happen inside a primitive, but it *can* still happen at the call site if you pass `performance.now()` to `VfxEngine.update`. Re-read contract #1.
- `createTintPulse` captures and restores the target's pre-trigger `alpha`/`tint` — this is what keeps the frozen-player `0.3` alpha and spirit-form dimming from snapping to opaque. **This story does not use `createTintPulse`** (the existing `flashUntil` cosine stays, per AC6) — do not "upgrade" the cast flash to a tint pulse here; that would risk the frozen/spirit alpha interaction for zero AC benefit.
- `import { Graphics } from 'pixi.js'` **works** under a plain node-environment `vitest run` (no jsdom). 7.1's earlier claim to the contrary was retracted. It is merely slow to transform on WSL2 (~35 s first collect). Keep the *planner* pixi-free anyway so the test stays fast.
- 7.1's deferred D-7.1-B (same handle added twice → double dispose) means: never `engine.add(handle)` the same handle object twice. Each factory call produces a fresh handle; call the factory per trigger.

### Existing `DungeonScreen.tsx` structure you must fit into

- `renderFrame(state, app, ...9 Maps)` (`:84-360`) — already at 9 positional Map parameters and ugly. **Do not add a 10th.** `projectileMetaRef` should be reached as a module-scoped/ref-captured value or, preferably, kept in the ticker/effect layer; if you must pass it, bundle it into a single context object rather than extending the positional list, and say which you chose in the Completion Notes.
- Ticker callback `:418-499` — `renderFrame`, then boss sprite, then purification pulse, then reward particles. `vfxEngineRef.current?.update(Date.now())` goes right after `renderFrame`.
- Transient-delta effect `:537-623` — an if/else-if chain on `latestTransientDelta.type`. Extend the existing `ability:fired` branch (`:551-553`); add one new `projectile:hit` branch. Keep the chain's existing shape.
- Cleanup `:502-525` — every new engine/Map/ref must be cleared here.
- `addChildAt(g, 0)` is the established "draw below sprites" idiom (`:246,324`). The `VfxEngine` uses plain `addChild`, i.e. **above** sprites — acceptable and intentional for one-shot flourishes, but verify during the Client-UX pass that nothing hides a health bar or a status badge. If an effect does obscure a read, shorten it or reduce alpha rather than reordering the stage (reordering would fight the engine's own add/remove).
- Constants at `:25-44` (`PLAYER_RADIUS = 24`, `ABILITY_FLASH_MS = 300`, `VIRTUAL_W/H`). Put **new** Souldrinker constants in the new vfx modules, not here.

### Client-UX Checklist (hook is TRIGGERED — run these for real)

Host checks:
- **Join-flow smoke test** — start a local session, join a phone, pick Souldrinker, enter the dungeon. No console errors, no dropped frames on cast.
- **HUD readability** — the player chip strip (`:745-832`), boss HP bar (`:834-856`), floating damage numbers and status badges stay legible while all four abilities fire.
- **Reconnect-state visibility** — freeze a player (background the phone): the `0.3` alpha disconnect cue and the `isDown`/`isSpirit` body sprite at `bodyX/bodyY` must remain identifiable *while* a Souldrinker effect plays over them.
- **Couch readability at 2–4 m** — each of the four abilities is identifiable from across the room without squinting; the cost cue and the buff cue are not confusable; nothing obscures a body, health bar, badge or the revive overlay.
- **Boss level** — confirm Void Pulse's `VOID` `0x7d2dff` still reads as distinct against the boss's own `0x7d2dff` disc and phase-2 glow.
- Mobile checks: **N/A** — no `apps/mobile-controller/**` change.

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts`** of its own; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`. Run this story's test from inside `apps/host-client`: `npx vitest run src/vfx/souldrinker-vfx.test.ts`.
- Follow `apps/host-client/src/vfx/vfx.test.ts` (24 tests) for shape and tone.
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. Pure selection/mapping logic goes in an exported function testable without a canvas; rendering correctness is verified manually via the Client-UX hook. Task 8.1 is that check.
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 — simulation-server 60 s boot timeout, and a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`. Two runs have produced two different failures. Note it; do not chase it. This story touches no server code, so it cannot be the cause.
- **Never claim a test or a manual check passed that was not actually run.**

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Ownership:** `apps/host-client/**` = Host Experience Engineer. Blocked: simulation-server, game-rules, mobile, shared-types, net-protocol.
- **Never import `packages/game-rules` in `apps/host-client`.** Every balance number in this file (10 HP cost, 50% lifesteal, 180/65, 150, 0.25/4000 ms) is an *authoring-time* reference for picking visual parameters. Where a value must exist in host code it becomes a **local visual constant** in the new vfx module. `shared-types` **is** importable and already used (`PlayerClass`, `CLASS_DEFINITIONS`, `BossPhase`, `SessionColor` at `DungeonScreen.tsx:3-4`).
- Host is a pure client: no `GameState` mutation, no game-rule checks, no physics reads.
- `Math.random()` **is** permitted here — "host UI animations, cosmetic effects" is the one allowed place (the particle burst already uses it internally).
- TypeScript strict, no `any` without an explicit suppression comment.
- Constants: named, at the top of the module — not inline magic numbers in the delta handler.
- Files kebab-case; events `noun:verb`; wire types `PascalCase + Msg`. Canvas colors are `number` (`0xrrggbb`), never CSS strings (CSS strings appear only in the React/HTML overlay part of `DungeonScreen.tsx`).

### Project Structure Notes

- New files live in the existing `apps/host-client/src/vfx/` directory created by 7.1 (sibling to `screens/`, `session/`, `components/`). No `vite.config.ts` alias change needed — internal module, relative import.
- No `packages/ui-kit` involvement: `ui-kit` is shared between host and mobile and this has no mobile use case (same rationale 7.1 recorded).
- `ability-vfx-config.ts` is deliberately **class-generic in shape** (a `Record<PlayerClass, [4 entries]>`) with only Souldrinker populated, so 7.2/7.3/7.5/7.8 extend it rather than forking it.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 frame: undifferentiated flat-color circles; 7.1 first, 7.2–7.8 independent.
- [Source: `_bmad-output/planning-artifacts/epics.md:1971-1987`] — Story 7.4 statement and both ACs (distinct visuals; lifesteal on the caster; Dark Pact self-cost distinct from the buff).
- [Source: `_bmad-output/planning-artifacts/epics.md:2061`] — Epic 7 non-goals (no pixel art, no new mechanics, no protocol changes beyond 7.7's whitelist line).
- [Source: `_bmad-output/planning-artifacts/epics.md:2044-2058`, esp. `:2052`] — Story 7.8 scope: `DungeonScreen.tsx:308` projectile circle and `:329` zone disc are 7.8's, driven by `class`/`abilityIndex`.
- [Source: `apps/host-client/src/vfx/index.ts:1-19`] — public barrel: `VfxEngine`, `progress`, the five factories and their param types.
- [Source: `apps/host-client/src/vfx/engine.ts:22-27,29-43,46-56,59-61`] — `add` returns an id; `update(now)` reaps completed effects and isolates a throwing one; `remove(id)`; `clear()`.
- [Source: `apps/host-client/src/vfx/types.ts:26-34`] — CLOCK CONTRACT.
- [Source: `apps/host-client/src/vfx/types.ts:52-55`] — `progress()` clamps to 0..1 and is NaN-safe (the future-`startedAt` pitfall).
- [Source: `apps/host-client/src/vfx/primitives.ts:19-30`] — `createParticleBurst` params/defaults.
- [Source: `apps/host-client/src/vfx/primitives.ts:189-198,218-219`] — `createRingShockwave` params; radius clamped ≥ 0, so implode is safe.
- [Source: `apps/host-client/src/vfx/primitives.ts:237-258`] — `createBeam` params; geometry drawn once in local space around `view.position`.
- [Source: `apps/host-client/src/vfx/primitives.ts:294-320`] — `createTintPulse` borrows a target and restores its captured alpha/tint (why the cast flash is left alone).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:25-44`] — `PLAYER_RADIUS`, `ABILITY_FLASH_MS`, `VIRTUAL_W/H`, `STATUS_EFFECT_COLORS`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:84-99`] — `renderFrame`'s 9-Map signature and `const now = Date.now()`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:131-133,142-144`] — the cast-flash cosine that must not regress.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:151-174`] — the `isDown`/`isSpirit` body sprite and the frozen-alpha interaction.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:290-309`] — Projectiles block: create-on-first-seen point for `projectileMetaRef`; line 308 is 7.8's.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:311-330`] — Zones block, untouched by this story.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:417-433,462-498`] — ticker: where `vfxEngine.update(Date.now())` goes; the `performance.now()` blocks that must not infect it.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:502-525`] — unmount cleanup.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:537-623`] — transient-delta effect; `ability:fired` branch at `:551-553`.
- [Source: `apps/host-client/src/session/host-session.ts:46-64`] — the transient-delta whitelist; `projectile:hit` is absent today.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:236-240`] — `ProjectileHitDelta { projectileId; x; y }`.
- [Source: `packages/net-protocol/src/apply-delta.ts:247-249`] — `projectile:hit` already handled: it removes the projectile from state (why the meta cache is required).
- [Source: `packages/game-rules/src/balance.ts:61-66`] — `ABILITY_SELF_COST_HP.souldrinker = [10, 0, 0, 0]`.
- [Source: `packages/game-rules/src/balance.ts:75-80`] — `ABILITY_LIFESTEAL_PCT.souldrinker = [0.5, 0, 0, 0]`.
- [Source: `packages/game-rules/src/balance.ts:68-73`] — `ABILITY_HP_SCALED_DAMAGE.souldrinker = [0, 1.0, 0, 0]`.
- [Source: `packages/game-rules/src/balance.ts:124-131`] — `ABILITY_DELIVERY`: only Blood Spike and Void Pulse are `'projectile'`.
- [Source: `packages/game-rules/src/balance.ts:145-150,155`] — Void Pulse's chained zone `{ effectType:'pull', radius:150, tickIntervalMs:500, durationMs:2000 }`; `VOID_PULSE_PULL_STRENGTH_PX = 50`.
- [Source: `packages/game-rules/src/balance.ts:159`] — `DARK_PACT_DRAIN_PCT = 0.10`.
- [Source: `packages/game-rules/src/balance.ts:214-220`] — `ABILITY_STATUS_EFFECT.souldrinker[2] = damageBuff 0.25 / 4000 ms, scope 'self'`; the only `damageBuff` source in the game.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1256-1273`] — Dark Pact cone search; `candidates.length === 0` returns early ⇒ no drain, no buff.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1290-1330`] — Dark Pact drain: ally `player:hp-updated` (down), caster `player:hp-updated` (up), then the buff — buff gated on the drain succeeding.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1765-1790`] — lifesteal on projectile hit, skipped when the caster is `isDown`/`isSpirit`; then `projectile:hit` is broadcast; then the chained zone spawns.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2041-2062`] — self-cost `player:hp-updated` broadcast **before** `ability:fired`; `ability:fired` only broadcast when `inDungeon`.
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:17-24,111-113,182-226`] — token palette, the Raw Earth / Spirit Chant two-layer rule, and the reserved uses of `accent-spirit` / `accent-purify`.
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md:163-176`] — post-review changes: clock contract, NaN guards, allocate-once burst, implode support, `TrailHandle.disposed`, throwing-effect isolation.
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md:67-70`] — D-7.1-A…D deferrals, including D-7.1-D "revisit when 7.2–7.8 reveal real effect volumes".
- [Source: `_bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md:156-176`] — AC1–AC4: projectile delivery, self-cost + 50% lifesteal on hit, inverse-HP scaling, ally drain + buff, projectile→pull-zone chain.
- [Source: `_bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md`] — the self-cost / lifesteal / HP-scaling primitives Story 3.19 composes.
- [Source: `_bmad-output/project-context.md`] — ownership, PixiJS host-renderer rules, `Math.random()` allowance, no `game-rules` import in the host, TypeScript strict, constants convention.
- [Source: `CLAUDE.md`] — pre-task hook fields, ownership hook, contract-change hook, simulation-safety hook, client-UX hook, telemetry hook, merge gate.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story 7.4 created — Souldrinker ability VFX (Blood Spike / Crimson Lash / Dark Pact / Void Pulse): per-ability primitive spec table, lifesteal-return and cost-vs-buff cue design, pure `planSouldrinkerCast`/`classifyHpChanges` mapping functions, guarded one-time `VfxEngine` wiring, `projectile:hit` whitelist addition, and the 7.8 projectile/zone appearance-config seam. |
| 2026-07-23 | Zero-direction `[]` behaviour in `planSouldrinkerCast` documented as intentional after Story 7.2 code review (Decision 2). No behaviour change — verified correct for all four indices (none is a self-centred TAP, so the sim skips every one on a zero direction); added the rationale so a reviewer does not re-litigate it. |
| 2026-07-23 | Propagated Story 7.2 code-review fix: `spawnSouldrinkerVfx` gains a `startedAt` param and every delta-triggered call site (`ability:fired`, `projectile:hit`, `damageBuff`-onset) stamps `Date.now()` at trigger, preventing the backgrounded-tab pile-up. CLOCK CONTRACT pitfall updated to state the delta-vs-ticker split. |
| 2026-07-23 | Applied SILENT rule (user decision): zero-aim skipped Souldrinker casts render nothing AND no flash (Task 4.1 reordered to check the skip before flashing). Logged the open cross-story question of whether Souldrinker should also suppress-and-replace the flash on *successful* casts like 7.2/7.3/7.5 (Dev Notes → Cross-story flash consistency). |
| 2026-07-23 | Resolved cross-story flash consistency (user decision): Souldrinker now suppresses-and-replaces the `ABILITY_FLASH_MS` cast flash like 7.2/7.3/7.5 (was additive). AC1/AC6 and Task 4.1 updated — an owned Souldrinker cast never sets `flashUntil`; successful → VFX only, zero-aim skip → nothing. |

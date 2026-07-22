---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.7b: Grassland Boss Attack VFX & Charge Visual

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the boss's charge attack to leave a visible mark on the screen, and its existing attack reactions to feel visually consistent with the rest of combat,
so that a currently-invisible attack becomes readable and the boss doesn't look visually disconnected from the ability VFX shipped in 7.2–7.5.

## Scope Split Notice (read first)

Epic 7's Story 7.7 (`epics.md:2024-2041`) assumed `boss:charged` only needed a one-line host whitelist entry. **That is false.** Verified at this baseline:

- There is **no `BossChargedDelta`** in `packages/net-protocol/src/messages/server-to-host.ts` — the only boss members of `DeltaEventMsg` are `boss:moved` (:183), `boss:stomped` (:190), `boss:damaged` (:219), `boss:phaseChanged` (:225), `boss:defeated` (:231).
- `apps/simulation-server/src/rooms/GameRoom.ts:1925-1927` explicitly **swallows** the event: `case 'boss:charged': // ponytail: charge is a movement event handled by tickBoss — no client delta needed; break;`

Making the event reach the host therefore spans Protocol Architect + Simulation Engineer + Host Experience Engineer. On 2026-07-22 the user approved splitting 7.7:

| Story | Owner(s) | Scope |
|---|---|---|
| **7.7a** (`7-7a-boss-charged-delta-contract-and-broadcast.md`) | Protocol Architect + Simulation Engineer | Add `BossChargedDelta = { type:'boss:charged'; bossId; x; y }` to the `DeltaEventMsg` union, an `applyDelta` no-op case, the `GameRoom` broadcast, one contract test. **Contract-change + Simulation-safety hooks TRIGGERED.** |
| **7.7b — THIS STORY** | Host Experience Engineer | Host-only rendering. `apps/host-client/**` only. |

**This story depends on 7.7a for AC1 (the charge half) only.** AC2–AC4 (the three reskins) are fully independent and must ship regardless. See "Dependency on 7.7a — and what to do if it hasn't shipped" in Dev Notes for the exact, typecheck-safe degraded path.

## Acceptance Criteria

1. **Given** 7.7a has landed and the simulation broadcasts `boss:charged`, **when** the boss charges, **then** `boss:charged` is present in the host's transient-delta whitelist (`apps/host-client/src/session/host-session.ts:46-64`) and reaches `DungeonScreen`'s transient-delta effect, **and** a **post-hoc dash visual** — a directional motion streak plus an impact flare, composed only from Story 7.1 primitives — plays on the host canvas at the boss's post-charge position, oriented along the charge direction.
   **Honesty clause (binding):** `tryCharge` moves the boss in a *single tick* and only *then* goes on a 150-tick (5 s) cooldown (`packages/game-rules/src/entities/grassland-boss.ts:78-91`), so the event necessarily describes a charge that has **already happened**. This AC makes a currently-invisible attack **visible after the fact**. It does **not** pre-warn the player, and no task, comment, or completion note may describe it as a telegraph, windup, or warning. No simulation-side windup is added.

2. **Given** the existing `boss:stomped` reaction at `DungeonScreen.tsx:593-601` — a raw `new Graphics()` ring destroyed by `setTimeout(…, 66)` — **when** this story ships, **then** it is replaced by `createRingShockwave` + `createParticleBurst` from the 7.1 library, sized from the delta's **real `radius` field** (which is `BOSS_STOMP_RADIUS = 280`, but must be read from the delta, not hardcoded), with a duration that is actually readable at couch distance (66 ms is ~4 frames at 60 fps — see the visual spec table for the replacement value), **and** no raw `Graphics` or `setTimeout`-based effect lifetime remains in that branch.

3. **Given** the existing `boss:phaseChanged` reaction at `DungeonScreen.tsx:585-586`, which today *only* mutates `bossPhaseRef.current` and produces **no on-screen effect whatsoever**, **when** this story ships, **then** the phase transition gets a distinct visual moment built from 7.1 primitives, colored per phase, **and** `bossPhaseRef.current = newPhase` still happens (the phase-2 glow ring at `DungeonScreen.tsx:447-449` and the phase-3 eye at `:453-455` are driven by that ref and must keep working).

4. **Given** the existing `boss:damaged` reaction at `DungeonScreen.tsx:587-592`, which today produces only a DOM damage number in the HUD (`:858-875`), **when** this story ships, **then** a bounded on-canvas impact reaction plays at the boss's position, **and** the existing HUD damage number, `lastBossHpRef` bookkeeping, and its 800 ms clear timer are unchanged.

5. **Given** all of the above, **when** this story ships, **then** **no behavior change occurs to the boss FSM, phase transitions, or damage resolution — rendering only.** Specifically preserved and verified: the phase-2 glow ring (r=56) and phase-3 red eye (r=12) in the boss sprite block, the boss HP bar (`:834-856`), the purification pulse sequence + background swap (`:602-621`, `:462-479`), the reward reveal (`:704-728`, `:912-946`), and `bossDefeatedRef`/`isPurifiedRef` gating.

6. **Given** the `accent-purify` token `0x90d8f0` is reserved **exclusively** for the purification / boss-defeat moment (`DESIGN.md:105-227`), **when** this story ships, **then** no boss-attack effect uses it — the self-check test asserts this.

7. **Given** the boss visual selection logic, **when** this story ships, **then** the delta→effect-parameter mapping lives in a **pure, PixiJS-free, exported function** with one runnable test file, per project convention.

## Tasks / Subtasks

- [ ] **Task 1: Verify 7.7a's status and pick the branch** (AC: 1)
  - [ ] 1.1: `git grep -n "boss:charged" packages/net-protocol/src apps/simulation-server/src` from the repo root.
  - [ ] 1.2: If `BossChargedDelta` **exists** in `packages/net-protocol/src/messages/server-to-host.ts` **and** `GameRoom.ts`'s `case 'boss:charged'` broadcasts it → 7.7a has shipped. Do every task below.
  - [ ] 1.3: If it does **not** exist → 7.7a has not shipped. Do Tasks 2, 4, 5, 6, 7, 8 in full; **skip Tasks 3.2 and 3.3** (the whitelist entry and the `DungeonScreen` charge branch); still do Task 3.1 (the pure charge planner, which has no net-protocol dependency and is unit-tested standalone). Record in Completion Notes that AC1's wiring is blocked on 7.7a and mark AC1 partial. **Do not** add a `(delta.type as string) === 'boss:charged'` cast or any other typecheck escape hatch to force it in.

- [ ] **Task 2: Create the pure boss-VFX planner** (AC: 1, 2, 3, 4, 6, 7)
  - [ ] 2.1: New file `apps/host-client/src/vfx/boss-vfx.ts`. It imports **only** `BossPhase` from `shared-types`. **It must not import `pixi.js`, `net-protocol`, or `packages/game-rules`.**
  - [ ] 2.2: Define its own **structural** input type so the module compiles whether or not 7.7a has landed:
        ```ts
        export type BossVfxInput =
          | { type: 'boss:charged';      x: number; y: number }
          | { type: 'boss:stomped';      x: number; y: number; radius: number }
          | { type: 'boss:phaseChanged'; newPhase: BossPhase }
          | { type: 'boss:damaged' };
        export interface BossVfxContext { bossX: number; bossY: number; prevX: number; prevY: number }
        ```
  - [ ] 2.3: Define the PixiJS-free descriptor union (`ring` / `beam` / `burst` / `tint`) exactly as specified in Dev Notes → "Descriptor union".
  - [ ] 2.4: Export `planBossVfx(input: BossVfxInput, ctx: BossVfxContext): VfxDescriptor[]`, implementing the per-reaction visual spec table verbatim.
  - [ ] 2.5: Put every tunable value in a named exported constant at the top of this file (see "Constants" in Dev Notes). No inline magic numbers in the planner body.
  - [ ] 2.6: Export `BOSS_DAMAGE_VFX_MIN_INTERVAL_MS` for the call-site throttle.
  - [ ] 2.7: Export from `apps/host-client/src/vfx/index.ts` (`planBossVfx`, the descriptor types, the constants).

- [ ] **Task 3: Charge visual — whitelist + wiring** (AC: 1)
  - [ ] 3.1: Implement the `'boss:charged'` case in `planBossVfx` (degenerate-displacement fallback included — see spec table).
  - [ ] 3.2: *(7.7a only)* Add `delta.type === 'boss:charged' ||` to the OR-chain in `apps/host-client/src/session/host-session.ts`, immediately after the `boss:stomped` line (currently `:62`). Do not reorder or remove any existing entry.
  - [ ] 3.3: *(7.7a only)* Add the `else if (latestTransientDelta.type === 'boss:charged' && app)` branch to `DungeonScreen.tsx`'s transient-delta effect, placed after the `boss:stomped` branch and before `boss:defeated`.

- [ ] **Task 4: One-time `VfxEngine` wiring in `DungeonScreen.tsx` — guarded "if not already present"** (AC: 1, 2, 3, 4)
  - [ ] 4.1: **First check whether one of Stories 7.2–7.8 already did this.** If `vfxEngineRef` already exists in the file, reuse it and skip 4.2–4.5 entirely — do not create a second engine.
  - [ ] 4.2: `import { VfxEngine, createBeam, createParticleBurst, createRingShockwave, createTintPulse, planBossVfx } from '../vfx';`
  - [ ] 4.3: `const vfxEngineRef = useRef<VfxEngine | null>(null);` alongside the other refs (near `:383-392`).
  - [ ] 4.4: Construct inside `initPixi` after `app.init()` and after the `cancelled` guard (`:412-417`), before `app.ticker.add`: `vfxEngineRef.current = new VfxEngine(app.stage);`
  - [ ] 4.5: `vfxEngineRef.current?.update(Date.now());` as the **last statement inside the existing `app.ticker.add` callback** (after the reward-particle loop, `:498`). **`Date.now()`, not `performance.now()`** — see CLOCK CONTRACT in Dev Notes.
  - [ ] 4.6: In the unmount cleanup (`:502-525`), add `vfxEngineRef.current?.clear(); vfxEngineRef.current = null;` **before** the `app.destroy(true, { children: true })` call at `:507` — destroying the app first leaves the engine holding handles whose views are already dead.

- [ ] **Task 5: Reskin `boss:stomped`** (AC: 2, 5)
  - [ ] 5.1: Delete the raw `new Graphics()` ring, the `app.stage.addChild(ring)`, and the `setTimeout(…, 66)` at `DungeonScreen.tsx:593-601`.
  - [ ] 5.2: Replace with `planBossVfx({ type:'boss:stomped', x, y, radius: latestTransientDelta.radius }, ctx)` → `applyBossVfxPlan(...)`. `radius` **must** come from the delta.

- [ ] **Task 6: Reskin `boss:phaseChanged` and `boss:damaged`** (AC: 3, 4, 5)
  - [ ] 6.1: `boss:phaseChanged` — keep `bossPhaseRef.current = latestTransientDelta.newPhase;` as the first statement, then plan+apply.
  - [ ] 6.2: Store the returned tint-effect id in `bossTintEffectIdRef = useRef<number | null>(null)`.
  - [ ] 6.3: Cancel that tint effect (`vfxEngineRef.current?.remove(id)`, then null the ref) in **both** places the boss `Graphics` can be destroyed under it: the `else if (bossGraphicsRef.current)` branch of the ticker (`:456-460`) and the unmount cleanup (`:510-513`). See "Pitfall: tint-pulse on a destroyed target" in Dev Notes.
  - [ ] 6.4: `boss:damaged` — keep `lastBossHpRef` update, `setBossDamageFlash`, and the 800 ms `setTimeout` exactly as they are; add the impact burst *after* them.
  - [ ] 6.5: Add the throttle: `const bossDamageVfxAtRef = useRef(0);` — skip the burst when `Date.now() - bossDamageVfxAtRef.current < BOSS_DAMAGE_VFX_MIN_INTERVAL_MS`, otherwise set the ref and emit. This is the D-7.1-D response for the one unbounded trigger in this story.

- [ ] **Task 7: `applyBossVfxPlan` bridge** (AC: 1, 2, 3, 4)
  - [ ] 7.1: A module-level helper in `DungeonScreen.tsx` (it needs the pixi factories and the borrowed boss `Graphics`, so it does **not** belong in the pure module):
        `function applyBossVfxPlan(engine: VfxEngine, plan: VfxDescriptor[], bossTarget: Graphics | null): number | null` — switches on `kind`, calls the matching 7.1 factory, `engine.add(...)`s each, and returns the effect id of the `tint` descriptor if one was created (else `null`).
  - [ ] 7.2: A `tint` descriptor with `bossTarget === null` is silently skipped (boss already despawned/defeated) — no throw.
  - [ ] 7.3: No `new Graphics()` anywhere in the new code. If a shape the five primitives can't express seems necessary, stop and flag it rather than inlining a one-off (7.1 AC3).

- [ ] **Task 8: Self-check** (AC: 6, 7)
  - [ ] 8.1: New test file `apps/host-client/src/vfx/boss-vfx.test.ts`, run with `npx vitest run src/vfx/boss-vfx.test.ts` from `apps/host-client`. Pure module, no canvas needed.
  - [ ] 8.2: Assertions (one runnable check for the load-bearing logic — not a suite per function):
        - **Charge direction & fixed streak:** with `ctx.prevX/prevY` 11.7 px behind `input.x/y`, the emitted `beam` descriptor ends exactly at `(input.x, input.y)`, its start→end length equals `BOSS_CHARGE_STREAK_PX` (±0.001), and its unit direction matches the prev→new displacement.
        - **Degenerate displacement:** `prev === (x, y)` emits **no** `beam`, still emits the `burst`, and every numeric field in every descriptor is finite (no `NaN`).
        - **Stomp radius comes from the delta:** `radius: 199` → `ring.maxRadius === 199` (proves it isn't hardcoded to 280).
        - **Phase color:** `Phase3` → `0xff2222`; `Phase2` → `0x7d2dff`.
        - **Reserved token:** across every input case, no descriptor's `color` equals `0x90d8f0`.
  - [ ] 8.3: `npm run typecheck` at the repo root (covers all 10 tsconfigs) — must be exit 0.
  - [ ] 8.4: Manual Client-UX pass per the checklist in Dev Notes. **The charge visual can only be observed on Normal or Hard difficulty in Phase 2+** — see "Charge is rarer than you think".

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping, inserted by `sprint-change-proposal-2026-07-21.md`. Depends only on 7.1 (done) plus 7.7a for the charge half.
- **Context:** The Grassland boss's charge attack is invisible on the host screen — the sim never sends the event. Its three other reactions exist but are visually inconsistent with the 7.2–7.5 ability VFX: the stomp is a raw 66 ms `Graphics` ring, the phase change renders nothing at all, and boss damage only appears as a DOM number in the HUD.
- **Goal:** Host-only rendering. Make the charge visible after the fact, and rebuild the three existing reactions on the 7.1 primitive library, with zero gameplay behavior change.
- **Allowed paths:**
  - `apps/host-client/src/vfx/boss-vfx.ts` (NEW)
  - `apps/host-client/src/vfx/boss-vfx.test.ts` (NEW)
  - `apps/host-client/src/vfx/index.ts` (MODIFY — barrel export only)
  - `apps/host-client/src/screens/DungeonScreen.tsx` (MODIFY)
  - `apps/host-client/src/session/host-session.ts` (MODIFY — one whitelist entry, and only if 7.7a has shipped)
- **Blocked paths:**
  - `packages/net-protocol/**` — **7.7a's scope.** Do not add `BossChargedDelta` here yourself.
  - `apps/simulation-server/**` — **7.7a's scope.** Do not touch `GameRoom.ts:1925-1927`.
  - `packages/game-rules/**`, `packages/shared-types/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`.
  - `apps/host-client/src/vfx/primitives.ts`, `types.ts`, `engine.ts` — 7.1 shipped these; this story composes from them and adds no sixth primitive.
  - `_bmad-output/planning-artifacts/sprint-status.yaml` — do not edit.
- **Inputs:** `apps/host-client/src/vfx/{index,primitives,types,engine}.ts`; `DungeonScreen.tsx` (read in full); `host-session.ts:44-70`; `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`; `dev-5-boss-transient-delta-whitelist-fix.md`; `6-2-…-boss-fsm-…md`; `6-3-boss-arena-…md`; `DESIGN.md:105-227`.
- **Non-goals:** No final pixel-art sprites (the separate PixelLab pass is untouched). No new abilities or mechanics. No protocol or schema changes (7.7a owns the one deliberate exception). No simulation-side charge windup. No pre-attack telegraph. No rewrite of `App.tsx`'s `latestTransientDelta` plumbing. No new `VfxEngine` primitive.
- **Ownership check:** Single area — `apps/host-client/**`, Host Experience Engineer. No split needed. The cross-area part was already split out as 7.7a.

**Hook verdicts (CLAUDE.md):**

| Hook | Verdict | Rationale |
|---|---|---|
| **Client-UX hook** | **TRIGGERED** | Host UI change that actually renders. Real checks — see the manual checklist below. |
| **Contract-change hook** | **NOT triggered** | Nothing in `packages/shared-types/**` or `packages/net-protocol/**` changes; session lifecycle, reconnect flow, room state, join flow, and prediction/reconciliation/interpolation state are all untouched. The `host-session.ts` whitelist edit is **host-local delivery filtering**, not a contract: `applyDelta(currentState, delta)` at `host-session.ts:67` runs **unconditionally on every delta regardless of the whitelist**, so mirror-state behavior is identical with or without the entry. The whitelist only decides which deltas additionally reach the `onTransientDelta` React callback. This is the same reasoning `dev-5` used when it added the four existing boss types to this list. |
| **Simulation-safety hook** | **NOT triggered** | No file under `apps/simulation-server/**` or `packages/game-rules/**` is touched. (7.7a triggers both this and Contract-change.) |
| **Telemetry hook** | **N/A** | No new user flow — this is a visual treatment of existing flows. |

### Dependency on 7.7a — and what to do if it hasn't shipped

`boss:charged` is currently produced by `packages/game-rules/src/entities/grassland-boss.ts:90` as a `BossChargedEvent` and then **dropped** by `GameRoom.ts:1925-1927`. It never becomes a wire delta. Consequences:

- Adding `delta.type === 'boss:charged'` to `host-session.ts` **will not compile** before 7.7a — `DeltaEventMsg` has no such member, and TypeScript rejects the comparison as having no overlap. That is a *feature*: it is the compiler telling you the dependency is unmet.
- Adding the `DungeonScreen` branch likewise won't narrow.

**The typecheck-safe design:** `apps/host-client/src/vfx/boss-vfx.ts` declares its **own structural** `BossVfxInput` union and never imports `net-protocol`. So the charge planner, its constants, and its tests compile and pass in *both* worlds. Only two call sites (`host-session.ts`'s OR-chain and `DungeonScreen.tsx`'s `else if`) actually need the wire type, and both are omitted wholesale in the degraded path.

**Degraded path (7.7a not shipped) = graceful no-op:** the charge visual is simply never triggered, because the event never arrives. Nothing crashes, nothing is dead-code-eliminated incorrectly, typecheck stays green, and picking up AC1 later is a two-line diff. **Never** force it with `as string` / `as any` / `@ts-expect-error`.

**If 7.7a *has* shipped:** confirm the field names on `BossChargedDelta` are `{ type, bossId, x, y }` before wiring — the planner only consumes `x`/`y`.

### The charge is post-hoc — and much smaller than it sounds

Read `tryCharge` (`packages/game-rules/src/entities/grassland-boss.ts:78-91`) before writing any visual:

```ts
boss.chargeCooldownTicks = BOSS_CHARGE_COOLDOWN_TICKS;         // 150 ticks = 5 s
const dist = Math.min(len, BOSS_CHARGE_SPEED * ctx.dt);        // 350 * (1/30) = 11.667 px
boss.position.x += (dx / len) * dist;
boss.position.y += (dy / len) * dist;
return [{ type: 'boss:charged', bossId: boss.id, x: boss.position.x, y: boss.position.y }];
```

Facts that decide the visual design:

1. **The event fires *after* the move, in the same tick.** There is no windup state, no anticipation frame, nothing to hang a warning on. Any "telegraph" language is a lie. AC1's honesty clause is binding.
2. **The actual displacement is ~11.67 px.** `ctx.dt` is hardcoded `1/30` (`grassland-boss.ts:57,64`) and `BOSS_CHARGE_SPEED = 350` (`packages/game-rules/src/balance.ts:297`). The boss is drawn at radius **48** — the "charge" moves it a quarter of its own radius. For comparison, a normal chase step is `BOSS_CHASE_SPEED (60) / 30 = 2 px`.
3. **Therefore: do not draw the literal path.** A `createTrail` following the boss's real motion, or a beam from `prev` to `(x, y)`, would render a ~12 px smudge under a 96 px-wide sprite — invisible at 2–4 m. It would also require pumping `moveTo` every frame with no natural end condition.
   **What we do instead:** take only the *direction* from the real displacement, and draw a **fixed-length motion streak of `BOSS_CHARGE_STREAK_PX = 160`** trailing *behind* the boss's new position, plus an impact flare at the new position. The visual is truthful about **direction** and **that a lunge happened**; it deliberately makes **no claim about distance**. Say exactly this in the code comment — a future reader must not "fix" the streak to match the displacement and thereby delete the effect.
4. **Which position to diff against:** `bossLastPositionRef.current` (`DungeonScreen.tsx:390`, updated by the effect at `:653-657`). This is correct and safe *specifically* because:
   - The `bossLastPositionRef` effect is keyed on `[gameState?.boss?.position.x, gameState?.boss?.position.y]`, and boss position is advanced by the `boss:moved` case in `packages/net-protocol/src/apply-delta.ts:181-183`.
   - 7.7a's `applyDelta` case for `boss:charged` is a **no-op** (it does not move the boss), so the `gameState` position on the charge commit is still the last `boss:moved` position — i.e. the pre-charge position.
   - `tryCharge` **returns early** from `tickBoss` (`grassland-boss.ts:185-188`), so **no `boss:moved` is emitted on the charge tick at all**. The pre-charge position is not overwritten in the same frame.
   - Effects run in declaration order within a commit: the transient-delta effect at `:537` runs **before** the boss-position effect at `:653`, so the ref still holds the older value when the charge branch reads it.
   - Net: the diff is a genuine pre→post charge vector, just a very short one. Normalize it; use its direction only.
5. **Degenerate case:** if `hypot(x - prevX, y - prevY) < 1`, emit **no beam** — only the impact burst at `(x, y)`. This covers reconnect/late-join, a snapshot landing between the two, and the `len === 0` guard's neighbourhood. Never divide by a zero length.

### Charge is rarer than you think (manual-verification trap)

`tickBoss` only calls `tryCharge` under **both** of these (`grassland-boss.ts:185-186`):

```ts
if (boss.phase !== BossPhase.Phase1 && difficulty !== DifficultyTier.EASY) { ... }
```

- **Easy difficulty: the boss never charges.** Ever.
- **Phase 1: never charges** — Phase 2 starts at `BOSS_PHASE2_HP_RATIO` of 2000 max HP.
- Cooldown is 150 ticks = **5 s** between charges, and the activation band is `nearestPlayerDistance ∈ [200, 600]` px (`BOSS_CHARGE_ACTIVATION_MIN/MAX`, `balance.ts:295-296`).

To see the effect: Normal or Hard, damage the boss into Phase 2, then stand 200–600 px away. The "Kill Boss" debug button (`DungeonScreen.tsx:789-806`) skips straight to defeat and is useless here; use "Kill All" plus normal combat.

### Per-reaction visual spec table

All colors are PixiJS `number` literals from the `DESIGN.md:105-227` token set. Boss geometry for scale: main circle **r=48**, phase-2 glow ring **r=56**, phase-3 eye **r=12** (`DungeonScreen.tsx:447-455`).

| Delta | Primitive calls (exact) | Why |
|---|---|---|
| **`boss:charged`**<br>(AC1) | `createBeam({ x: originX, y: originY, toX: delta.x, toY: delta.y, color: 0x7d2dff, width: 14, durationMs: 320, alpha: 0.75 })`<br>where `ux,uy` = unit(prev→new) and `originX = delta.x - ux*160`, `originY = delta.y - uy*160`<br>**+** `createParticleBurst({ x: delta.x, y: delta.y, color: [0x7d2dff, 0xc0392b], count: 10, speed: 0.22, spread: 0.9, particleRadius: 5, durationMs: 380, alpha: 0.9 })` | A 160 px streak reads clearly behind a 96 px-wide sprite at 2–4 m. `width: 14` keeps it a lunge smear, not a laser. `accent-corruption 0x7d2dff` is the boss's own color (`DungeonScreen.tsx:448,451`), so the streak reads as "the boss did this", with `corruption-blood 0xc0392b` cycled into the flare for aggression. 320/380 ms ≈ 20/23 frames — long enough to register, gone before the next 5 s charge. |
| **degenerate charge**<br>(displacement `< 1 px`) | burst only, params as above | No direction to draw. Non-crashing, no `NaN`, no zero-length beam. |
| **`boss:stomped`**<br>(AC2) | `createRingShockwave({ x: delta.x, y: delta.y, color: 0xc0392b, startRadius: 48, maxRadius: delta.radius, lineWidth: 8, durationMs: 420, alpha: 0.9, filled: false })`<br>**+** `createParticleBurst({ x: delta.x, y: delta.y, color: [0xc0392b, 0xc07d35], count: 12, speed: 0.30, spread: 0.6, particleRadius: 6, durationMs: 500, alpha: 0.85 })` | **The current 66 ms lifetime is ~4 frames at 60 fps** — it flashes and is gone before the eye at couch distance can resolve it, which is the real reason the stomp "doesn't seem to do anything". 420 ms lets the ring travel 48→280 px legibly. `startRadius: 48` makes it emanate from the boss's edge instead of popping out of its centre. `maxRadius` **must** be `delta.radius` (the real damage radius, `BOSS_STOMP_RADIUS = 280`) — a visual that lies about reach is worse than no visual. `corruption-blood` replaces the ad-hoc `0xff4444`, aligning to the token set. `accent-warm 0xc07d35` in the burst reads as kicked-up ground. |
| **`boss:phaseChanged`**<br>(AC3) | `createRingShockwave({ x: bossX, y: bossY, color: phaseColor, startRadius: 320, maxRadius: 56, lineWidth: 6, durationMs: 700, alpha: 0.85 })` — an **implode** (`maxRadius < startRadius` is explicitly safe, `primitives.ts:218-219`)<br>**+** `createTintPulse({ target: bossGraphicsRef.current, durationMs: 600, color: phaseColor, minAlpha: 0.45, maxAlpha: 1 })`<br>`phaseColor = newPhase === BossPhase.Phase3 ? 0xff2222 : 0x7d2dff` | Today this delta renders **nothing**. An inward-collapsing ring that terminates exactly on the phase-2 glow ring radius (56) reads as "power gathering into the boss" and hands off visually to the persistent glow the ref switches on. `0xff2222` for Phase 3 matches the existing phase-3 eye (`:454`) so the two agree. `minAlpha: 0.45` (not the 0.2 default) keeps the boss readable mid-pulse — it is still a live threat. Happens at most twice per run. |
| **`boss:damaged`**<br>(AC4) | `createParticleBurst({ x: bossX, y: bossY, color: 0xc0392b, count: 6, speed: 0.14, spread: 0.8, particleRadius: 4, durationMs: 260, alpha: 0.9 })`<br>**throttled** to one per `BOSS_DAMAGE_VFX_MIN_INTERVAL_MS = 120` | Small and cheap because it is the **only** high-frequency trigger in this story. Small radius (4 px, so 4–8 px actual) and 260 ms keep it from obscuring the boss or the HP bar. Does not replace the HUD damage number — it locates the hit on the canvas, which the HUD number cannot. |

**`x`/`y` sources:** `boss:charged` and `boss:stomped` carry their own `x`/`y` — use them. `boss:phaseChanged` and `boss:damaged` do not — use `bossLastPositionRef.current` (`DungeonScreen.tsx:390`), which is snapshot-reconciled every commit and already falls back to arena centre `{x: 960, y: 540}`.

### Descriptor union (`boss-vfx.ts`)

Keeps the planner pure and testable while the pixi factories stay at the call site:

```ts
export type VfxDescriptor =
  | { kind: 'ring';  x: number; y: number; color: number; startRadius: number; maxRadius: number; lineWidth: number; durationMs: number; alpha: number }
  | { kind: 'beam';  x: number; y: number; toX: number; toY: number; color: number; width: number; durationMs: number; alpha: number }
  | { kind: 'burst'; x: number; y: number; color: readonly number[]; count: number; speed: number; spread: number; particleRadius: number; durationMs: number; alpha: number }
  | { kind: 'tint';  target: 'boss'; color: number; durationMs: number; minAlpha: number; maxAlpha: number };
```

`tint` names its target **symbolically** (`'boss'`) so the pure module never touches a `Container`. `applyBossVfxPlan` resolves it to `bossGraphicsRef.current`.

### Constants (top of `boss-vfx.ts`, all exported)

```ts
export const BOSS_RADIUS_PX                  = 48;     // mirrors DungeonScreen.tsx:451
export const BOSS_PHASE2_GLOW_RADIUS_PX      = 56;     // mirrors DungeonScreen.tsx:448
export const BOSS_CHARGE_STREAK_PX           = 160;    // legibility length, NOT the ~11.7px real displacement
export const BOSS_CHARGE_MIN_DISPLACEMENT_PX = 1;
export const BOSS_CHARGE_BEAM_MS             = 320;
export const BOSS_CHARGE_BURST_MS            = 380;
export const BOSS_STOMP_RING_MS              = 420;    // was 66ms — ~4 frames, unreadable at 2-4m
export const BOSS_STOMP_BURST_MS             = 500;
export const BOSS_PHASE_IMPLODE_START_PX     = 320;
export const BOSS_PHASE_IMPLODE_MS           = 700;
export const BOSS_PHASE_TINT_MS              = 600;
export const BOSS_DAMAGE_BURST_MS            = 260;
export const BOSS_DAMAGE_VFX_MIN_INTERVAL_MS = 120;

export const VFX_CORRUPTION = 0x7d2dff;  // accent-corruption — the boss's own color
export const VFX_BLOOD      = 0xc0392b;  // corruption-blood — injury / danger
export const VFX_WARM       = 0xc07d35;  // accent-warm — kicked-up ground
export const VFX_PHASE3     = 0xff2222;  // matches the existing phase-3 eye, DungeonScreen.tsx:454
```

**Do not import `packages/game-rules`** to get `BOSS_STOMP_RADIUS` etc. (project-context.md ownership rule — host must never import game-rules). The stomp radius arrives on the delta; every other number above is a *visual* constant that happens to have been chosen with the balance values in view.

### Reserved token: `accent-purify` `0x90d8f0`

`0x90d8f0` belongs to the purification moment alone — the boss-defeat pulse (`DungeonScreen.tsx:470`), the background swap (`:610`), and the `DESIGN.md` "Spirit Chant" earned-accent layer (`DESIGN.md:105-227`). Spending it on a boss *attack* would make the boss's aggression read as the purification payoff and flatten the single biggest emotional beat in the run. AC6 makes this testable: the self-check asserts no descriptor emits it.

Likewise leave `accent-spirit 0x6ea8d8` alone — it is bonds/spirit-form/selection.

### `latestTransientDelta` is a single value, not a queue

`App.tsx:20,42-48` — `setLatestTransientDelta` is called per delta and cleared 400 ms later. React 18 auto-batches, so **two deltas arriving in the same task collapse; only the last is ever seen** by `DungeonScreen`'s effect. This is pre-existing (it is exactly why the current stomp ring is unreliable) and this story inherits it.

Verified specifics for boss deltas:

- **`boss:moved` is NOT in the whitelist** (`host-session.ts:46-64` — confirmed: the list is `ability:fired`, `spirit-ability:fired`, `enemy:killed`, `enemy:damaged`, `essence:dropped`, `player:downed`, `player:revived`, `player:spirit`, `player:hp-updated`, `run:failed`, `level:complete`, `run:complete`, `bond:assigned`, `boss:phaseChanged`, `boss:damaged`, `boss:stomped`, `boss:defeated`). It therefore **never calls `setLatestTransientDelta`**, and cannot clobber a boss reaction despite arriving every tick. It *does* still call `onStateUpdate` every tick via `applyDelta`, but `DungeonScreen`'s transient effect is keyed on `[latestTransientDelta]` only, so a `gameState` change alone does not re-run it. **Do not add `boss:moved` to the whitelist** — it would clobber every other boss reaction 30×/s and destroy this story's ACs.
- **Real collapse risk that remains:** `tickBoss` returns `[...phaseEvents, ...chargeEvents]` (`grassland-boss.ts:187`) and `[...phaseEvents, ...stompEvents]` (`:192`), broadcast as separate `DELTA` messages in the same tick loop. So `boss:phaseChanged` can be immediately followed by `boss:charged` or `boss:stomped` and **lose its visual**.
  - **State never desyncs:** `applyDelta` handles `boss:phaseChanged` unconditionally (`packages/net-protocol/src/apply-delta.ts:173-175`), and the effect at `DungeonScreen.tsx:660-666` re-seeds `bossPhaseRef` from `gameState.boss.phase`. So the phase-2 glow ring / phase-3 eye still appear correctly; only the one-shot transition flourish can be dropped, at most twice per run.
  - **Accept and document.** Do **not** rewrite `App.tsx`'s plumbing inside a VFX story. If a future story wants guaranteed delivery, that is a separate change (a queue in `App.tsx`), flagged here as a follow-up.
- Design implication honored above: nothing in this story requires seeing *every* delta of a burst. The damage burst is already throttled; the stomp/charge/phase visuals are each self-contained one-shots.

### Effect volume — D-7.1-D (`deferred-work.md`)

7.1 deferred "no cap/pooling/back-pressure on concurrent effects", asking each of 7.2–7.8 to bound its own volume or re-defer with a rationale. This story's budget:

| Trigger | Rate ceiling | Effects each | Lifetime | Peak concurrent |
|---|---|---|---|---|
| `boss:charged` | 1 / 5 s (`BOSS_CHARGE_COOLDOWN_TICKS = 150`) | 2 | ≤380 ms | 2 |
| `boss:stomped` | 1 / 8 s phase 1, 1 / 4 s phase 2+ (`BOSS_PHASE2_STOMP_COOLDOWN_TICKS = 120`) | 2 | ≤500 ms | 2 |
| `boss:phaseChanged` | ≤2 per run | 2 | ≤700 ms | 2 |
| `boss:damaged` | **unbounded in principle** → throttled to 1 / 120 ms | 1 | 260 ms | ≤3 |

Worst-case ≈ **9 concurrent boss effects**, each a `Container` of ≤12 tiny `Graphics` allocated once at trigger. That is well inside what the existing reward-reveal burst (8–12 particles, `:709`) already does. **Re-defer D-7.1-D globally**; the local `BOSS_DAMAGE_VFX_MIN_INTERVAL_MS` throttle is this story's contribution, and it is a *cosmetic* throttle — it never gates state, HP bookkeeping, or the HUD damage number.

### VFX engine API — the parts you need (`apps/host-client/src/vfx/`)

```ts
new VfxEngine(app.stage)            // VfxStage = { addChild, removeChild }
engine.add(handle): number          // id; adds handle.view to the stage if non-null
engine.update(now): void            // once per ticker frame; reaps completed effects; try/catch per effect
engine.remove(id): void             // early cancel — needed for the tint pulse (see pitfall below)
engine.clear(): void                // teardown
```

Signatures you will call (`primitives.ts`): `createBeam({x,y,toX,toY,color,durationMs,alpha?,width?})`, `createParticleBurst({x,y,color: number|readonly number[],durationMs,alpha?,count?,speed?,spread?,particleRadius?})`, `createRingShockwave({x,y,color,durationMs,maxRadius,alpha?,startRadius?,lineWidth?,filled?})`, `createTintPulse({target,durationMs,color?,minAlpha?,maxAlpha?})`.

**CLOCK CONTRACT (7.1's #1 failure mode, `types.ts:23-38`):** no primitive reads a clock; `startedAt` is captured from the **first `update(now)`**. `renderFrame` uses `Date.now()` (`DungeonScreen.tsx:99`); the purification-pulse and reward-particle blocks in the same ticker use `performance.now()` (`:465,486`). **Pass `Date.now()` to `VfxEngine.update()`** and never pass an explicit `startedAt` from the other clock. Mixing them makes effects vanish on frame 1 or leak forever, silently.

### Pitfall: tint-pulse on a destroyed target (D-7.1-C)

`createTintPulse` animates a **borrowed** display object (`view: null`, `primitives.ts:294-320`) and restores the captured `alpha`/`tint` on `dispose()`. Neither the engine nor the primitive detects an **externally destroyed** target — that is deferred item D-7.1-C.

The boss `Graphics` **is** externally destroyed, in two places: `DungeonScreen.tsx:456-460` (when `state.boss` disappears or `bossDefeatedRef` flips) and the unmount cleanup at `:510-513`. A 600 ms phase tint outliving that would write `.alpha` into a destroyed object.

**Required mitigation:** hold the tint effect id in `bossTintEffectIdRef` and call `vfxEngineRef.current?.remove(id)` (then null the ref) at **both** destruction sites, before `.destroy()`. A phase change immediately followed by `boss:defeated` is a realistic sequence — the boss enters Phase 3 at low HP and dies seconds later.

Also note `Graphics.clear()` (called on the boss every frame at `:443`) clears **geometry only** — `alpha` and `tint` are `Container` properties and survive, so the tint pulse works over the redrawn sprite without interference. The boss block never assigns `g.alpha`, so there is no fight over the property.

### Pitfall: `VfxEngine.add` puts views on TOP of the stage

`engine.add` calls `stage.addChild(handle.view)` (`engine.ts:23`) — effects render **above** players, enemies, and the boss. The existing "draw below sprites" idiom (`addChildAt(g, 0)`, used by bond tethers `:246` and zones `:324`) is not available through the engine.

Consequences for this story, all already reflected in the spec table:
- **Never use `filled: true`** for a boss-sized ring. A filled 280 px disc would hide every player standing in the stomp zone — a direct Client-UX / couch-readability failure.
- Keep particle radii small (4–6 px base, so 4–12 px actual) and durations short.
- The 160 px charge streak passes *behind* the boss (it trails the new position), and at `alpha: 0.75` over 320 ms it does not occlude the HP bar (a DOM element at `top: 54`, above the canvas anyway).

A dedicated below-sprites VFX layer would be a `VfxEngine` change and is **out of scope** — flag it as a follow-up if a later story needs ground decals.

### Exact `DungeonScreen.tsx` wiring

**1. Imports (top, after the existing pixi import at `:2`):**
```ts
import { VfxEngine, createBeam, createParticleBurst, createRingShockwave, createTintPulse, planBossVfx } from '../vfx';
import type { VfxDescriptor } from '../vfx';
```

**2. Refs (with the boss refs at `:383-392`):**
```ts
const vfxEngineRef = useRef<VfxEngine | null>(null);          // skip if a prior 7.x story added it
const bossTintEffectIdRef = useRef<number | null>(null);
const bossDamageVfxAtRef = useRef(0);
```

**3. Engine construction — inside `initPixi`, between `pixiAppRef.current = app;` (`:417`) and `app.ticker.add(...)` (`:418`):**
```ts
if (!vfxEngineRef.current) vfxEngineRef.current = new VfxEngine(app.stage);
```

**4. Per-frame update — last statement inside the `app.ticker.add` callback, after the reward-particle loop ends at `:498`:**
```ts
vfxEngineRef.current?.update(Date.now());
```

**5. Cancel the tint when the boss sprite is destroyed — inside the `else if (bossGraphicsRef.current)` branch at `:456-460`, before `.destroy()`:**
```ts
if (bossTintEffectIdRef.current !== null) {
  vfxEngineRef.current?.remove(bossTintEffectIdRef.current);
  bossTintEffectIdRef.current = null;
}
```

**6. Cleanup (`:502-525`) — before `app.destroy(true, { children: true })` at `:507`:**
```ts
bossTintEffectIdRef.current = null;
vfxEngineRef.current?.clear();
vfxEngineRef.current = null;
```

**7. Transient-delta branches (`:585-601`) — replace in place. `boss:phaseChanged`:**
```ts
} else if (latestTransientDelta.type === 'boss:phaseChanged') {
  bossPhaseRef.current = latestTransientDelta.newPhase;        // UNCHANGED — drives the glow ring + eye
  const engine = vfxEngineRef.current;
  if (engine) {
    const pos = bossLastPositionRef.current;
    const plan = planBossVfx(
      { type: 'boss:phaseChanged', newPhase: latestTransientDelta.newPhase },
      { bossX: pos.x, bossY: pos.y, prevX: pos.x, prevY: pos.y },
    );
    if (bossTintEffectIdRef.current !== null) engine.remove(bossTintEffectIdRef.current);
    bossTintEffectIdRef.current = applyBossVfxPlan(engine, plan, bossGraphicsRef.current);
  }
}
```

**`boss:damaged`** — keep all four existing statements (`lastBossHpRef`, `setBossDamageFlash`, the 800 ms `setTimeout`), then append:
```ts
  const engine = vfxEngineRef.current;
  const nowMs = Date.now();
  if (engine && nowMs - bossDamageVfxAtRef.current >= BOSS_DAMAGE_VFX_MIN_INTERVAL_MS) {
    bossDamageVfxAtRef.current = nowMs;
    const pos = bossLastPositionRef.current;
    applyBossVfxPlan(engine, planBossVfx({ type: 'boss:damaged' }, { bossX: pos.x, bossY: pos.y, prevX: pos.x, prevY: pos.y }), bossGraphicsRef.current);
  }
```

**`boss:stomped`** — delete `:594-601` entirely (the `new Graphics()`, the `addChild`, and the `setTimeout`), replace with:
```ts
} else if (latestTransientDelta.type === 'boss:stomped') {
  const engine = vfxEngineRef.current;
  if (engine) {
    const { x, y, radius } = latestTransientDelta;
    applyBossVfxPlan(engine, planBossVfx({ type: 'boss:stomped', x, y, radius }, { bossX: x, bossY: y, prevX: x, prevY: y }), bossGraphicsRef.current);
  }
}
```
Note the branch no longer needs the `&& app` guard — the engine ref replaces it.

**`boss:charged`** *(7.7a only)* — new branch after `boss:stomped`:
```ts
} else if (latestTransientDelta.type === 'boss:charged') {
  const engine = vfxEngineRef.current;
  if (engine) {
    const prev = bossLastPositionRef.current;
    const { x, y } = latestTransientDelta;
    applyBossVfxPlan(engine, planBossVfx({ type: 'boss:charged', x, y }, { bossX: x, bossY: y, prevX: prev.x, prevY: prev.y }), bossGraphicsRef.current);
  }
}
```

**8. `host-session.ts`** *(7.7a only)* — one line inserted after `delta.type === 'boss:stomped' ||` (currently `:62`):
```ts
        delta.type === 'boss:charged' ||
```

### Existing behaviors that MUST NOT regress (AC5)

Verify each after the change:

- Boss sprite block `:436-460`: phase-2 glow ring (`r=56`, `0x7d2dff`, alpha 0.3) and phase-3 red eye (`r=12`, `0xff2222`) still appear, driven by `bossPhaseRef`.
- `bossPhaseRef` seeding from snapshot on reconnect/late-join (`:660-666`).
- Boss HP bar DOM element `:834-856` and its 80 ms width transition.
- Boss damage number DOM element `:858-875` and the `bossDamageFlash` 800 ms lifecycle.
- `boss:defeated` sequence `:602-621`: `bossDefeatedRef`, `isPurifiedRef`, `essenceDisplayRef`, background swap to `0x90d8f0`, the purification pulse (`:462-479`), reward reveal + particles (`:704-728`, `:912-946`), voice line.
- `bossLastPositionRef` tracking (`:653-657`) — the charge visual **reads** it; do not change what writes it.
- Everything unrelated to the boss: ability cast flash, spirit-form glow, the down/spirit body sprite, the frozen-player 0.3 alpha disconnect cue, enemy kill fade, enemy damage numbers, bond tethers, zones, projectiles, revive overlay.
- **Zero changes to boss FSM, phase thresholds, cooldowns, or damage resolution** — none of those files are even in the allowed paths.

### Previous Story Intelligence

**From 7.1 (`7-1-vfx-engine-foundations.md`, done):**
- 7.1 deliberately did **not** touch `DungeonScreen.tsx` (its AC3). Whichever of 7.2–7.8 lands first does the one-time engine wiring — hence Task 4's "if not already present" guard.
- Its review round fixed a batch of latent bugs you now benefit from and must not re-introduce by hand-rolling: lazy `startedAt` on first `update` (the clock fix), `progress()` `NaN` guards, clamped particle `elapsed`, clamped ring radius (implode is safe — this story relies on that for the phase ring), `createTintPulse` restoring the *captured* alpha rather than `maxAlpha`, `createBeam` drawing in **local space** around `view.position`, and per-effect `try/catch` in `VfxEngine.update`.
- Deferred and still open: **D-7.1-A** engine reentrancy, **D-7.1-B** double-add → double dispose (so never `engine.add(handle)` twice with the same handle), **D-7.1-C** no detection of an externally destroyed view/target (drives the tint-pulse mitigation above), **D-7.1-D** no effect cap (addressed above).
- Retracted claim to not repeat: `pixi.js` **does** import fine under a plain node-environment `vitest run`; no jsdom needed. It is merely slow to transform on WSL2 (~35 s first collect).

**From `dev-5-boss-transient-delta-whitelist-fix.md` (done):** established that `host-session.ts`'s OR-chain is *only* a delivery filter for the `onTransientDelta` React callback, while `applyDelta` at `:67` runs unconditionally — `GameState` is always correct regardless of the whitelist. That is the precedent for this story's Contract-change "NOT triggered" verdict, and for treating a whitelist addition as a host-local change.

**From `6-2-grassland-boss-fsm-phase-system-and-difficulty-tiered-behaviors.md` (done):** the boss FSM, `tryCharge`/`tryStomp` cooldown bookkeeping, the one-phase-transition-per-tick cap, and the difficulty gating (`Easy` never charges; Phase 3 + adds are Hard-only) all live in `packages/game-rules` — **blocked** for this story.

**From `6-3-boss-arena-handcrafted-level-physics-geometry-and-host-rendering.md` (done):** shipped the boss sprite block, HP bar, phase visuals, and the "stomp warning" ring that this story replaces. The boss `Graphics` is managed in the ticker rather than in `renderFrame` specifically to keep `renderFrame`'s signature stable — keep it that way; do not add a 10th positional `Map` parameter to `renderFrame` for this story (a module-level engine ref is the chosen alternative, per 7.1's guidance).

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`.
- Run this story's test from `apps/host-client`: `npx vitest run src/vfx/boss-vfx.test.ts`. Existing sibling to match in style: `apps/host-client/src/vfx/vfx.test.ts` (24 tests).
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. The pure `planBossVfx` mapping is exactly the kind of logic that belongs in a test; the rendering itself is verified manually via the Client-UX hook.
- `npm run typecheck` at repo root covers all 10 tsconfigs — required, exit 0.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 (a 60 s simulation-server boot timeout, and a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`). Two runs produce two different failures. Note it in the Debug Log; do not chase it. Nothing in this story's allowed paths can affect the simulation server.

**Manual Client-UX checklist (hook is TRIGGERED):**
- [ ] Join-flow smoke test: create session → phone joins → start → reach the boss arena (level 4). No console errors, no crash on the boss branches.
- [ ] Couch readability at 2–4 m: the stomp ring reads as a threat radius; the charge streak reads as a direction; neither obscures player circles, enemy health bars, status badges, or the revive overlay.
- [ ] Charge visual verified on **Normal or Hard, Phase 2+**, standing 200–600 px from the boss (see "Charge is rarer than you think"). Confirm the streak points the way the boss lunged.
- [ ] Reconnect-state visibility: freeze a player (disconnect the phone) during a stomp — the 0.3-alpha frozen cue and the down/spirit body sprite survive the effects layer.
- [ ] Boss defeat immediately after a phase change: no console error, tint restored, purification pulse and reward reveal unaffected.
- [ ] Sustained damage on the boss (all 4 players attacking): the throttled impact bursts stay legible and do not smother the boss sprite or HP bar.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Ownership:** `apps/host-client/**` = Host Experience Engineer. Blocked: simulation server, game-rules, mobile, shared-types, net-protocol.
- **Never import `packages/game-rules` in `apps/host-client`.** Balance numbers quoted in this story are for *choosing visual parameters at authoring time*; anything needed at runtime is either a local visual constant or a field on the delta. `shared-types` **is** importable and already used (`CLASS_DEFINITIONS`, `PlayerClass`, `BossPhase`, `SessionColor`, `PURIFICATION_PULSE_DURATION_MS`) — `BossPhase` is the only import `boss-vfx.ts` needs.
- **Host is a pure client:** no `GameState` mutation, no game-rule checks, no physics reads. The damage-VFX throttle is a cosmetic render throttle, not a cooldown.
- **PixiJS host renderer:** no game logic, cooldown tracking, or collision inside display objects.
- **`Math.random()` is permitted here** — "host UI animations, cosmetic effects" is the one allowed place. The particle burst's angle jitter uses it internally (`primitives.ts:58-62`); that is fine.
- **TypeScript strict**, no `any` without an explicit suppression comment.
- **Constants:** tunable visual values as named constants (in `boss-vfx.ts`), not inline magic numbers in the delta handler.
- **Colors are PixiJS `number` literals** (`0xrrggbb`) in canvas code — never CSS strings. (CSS strings appear only in the React/DOM overlay parts of `DungeonScreen.tsx`.)
- Files kebab-case; events `noun:verb`; wire types `PascalCase + Msg`.

### Project Structure Notes

- `apps/host-client/src/vfx/boss-vfx.ts` sits beside `primitives.ts` / `engine.ts` / `types.ts` — the consumer-facing "which effect for which boss event" layer, kept separate from the 7.1 primitives so 7.1's module stays generic and per-ability logic never leaks into it.
- `apps/host-client/src/vfx/index.ts` is the single barrel — export the new symbols there and import from `'../vfx'` in `DungeonScreen.tsx` (matching how 7.1 intended consumption).
- No `vite.config.ts` alias changes needed — internal relative module.
- No `packages/ui-kit` involvement: this is host-only, no mobile use case.
- `applyBossVfxPlan` lives in `DungeonScreen.tsx` (module scope, beside `renderFrame`), not in the vfx module, because it needs both the pixi factories and the borrowed boss `Graphics` — keeping the vfx module free of `DungeonScreen` coupling.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7: Ability & Environmental VFX Prototyping] — epic frame and the `boss:charged` observation (lines 1904-1908); Epic 7 non-goals (line 2061)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.7: Grassland Boss Attack VFX & Charge Telegraph] (lines 2024-2041) — original AC text, superseded on the telegraph claim per this story's AC1 honesty clause
- [Source: apps/host-client/src/screens/DungeonScreen.tsx] — boss sprite block incl. phase-2 glow r=56 and phase-3 eye r=12 (`:436-460`); ticker callback (`:418-499`); cleanup (`:502-525`); transient-delta effect (`:537-623`); `boss:phaseChanged` (`:585-586`); `boss:damaged` (`:587-592`); `boss:stomped` raw ring + 66 ms `setTimeout` (`:593-601`); `boss:defeated` + purification (`:602-621`); boss refs (`:383-392`, esp. `bossLastPositionRef` `:390`); boss-tracking effects (`:644-666`); purification pulse animation (`:462-479`); reward particles (`:481-498`, `:704-728`); boss HP bar (`:834-856`); boss damage number (`:858-875`); `addChildAt(g,0)` below-sprites idiom (`:246`, `:324`); `renderFrame`'s `Date.now()` (`:99`)
- [Source: apps/host-client/src/session/host-session.ts] — transient-delta whitelist OR-chain (`:46-64`), unconditional `applyDelta` (`:67`)
- [Source: apps/host-client/src/App.tsx] — `latestTransientDelta` single state value (`:20`), 400 ms clear (`:42-48`)
- [Source: apps/host-client/src/vfx/types.ts] — `EffectHandle`/`VfxStage`/`VfxTriggerParams`, CLOCK CONTRACT (`:23-38`), `progress()` guards (`:41-48`)
- [Source: apps/host-client/src/vfx/primitives.ts] — `createParticleBurst` (`:38-86`), `createTrail`/`TrailHandle` (`:97-184`), `createRingShockwave` incl. clamped implode (`:200-233`, guard at `:218-219`), `createBeam` local-space geometry (`:246-273`), `createTintPulse` borrowed target + captured alpha/tint (`:294-320`), permitted `Math.random()` (`:58-62`)
- [Source: apps/host-client/src/vfx/engine.ts] — `add` → `stage.addChild` (`:22-27`), per-effect try/catch in `update` (`:29-42`), `remove` (`:45-56`), `clear` (`:58-60`)
- [Source: apps/host-client/src/vfx/index.ts] — public barrel
- [Source: packages/game-rules/src/entities/grassland-boss.ts] — `BossChargedEvent` type (`:16`), `tryCharge` post-hoc single-tick move + 150-tick cooldown (`:78-91`), `tryStomp` (`:94-99`), `dt = 1/30` (`:57`, `:64`), chase step (`:120-128`), charge gating `phase !== Phase1 && difficulty !== EASY` (`:185-186`), early return ordering (`:185-192`)
- [Source: packages/game-rules/src/balance.ts#Grassland Boss] (`:287-303`) — `BOSS_STOMP_RADIUS=280`, `BOSS_CHASE_SPEED=60`, `BOSS_CHARGE_SPEED=350`, `BOSS_CHARGE_ACTIVATION_MIN/MAX=200/600`, `BOSS_CHARGE_COOLDOWN_TICKS=150`, `BOSS_PHASE2_STOMP_COOLDOWN_TICKS=120`, `BOSS_GRASSLAND_MAX_HP=2000`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — `case 'boss:charged'` swallowed, no client delta (`:1925-1927`); `boss:stomped`/`boss:phaseChanged` broadcasts (`:1912-1923`)
- [Source: packages/net-protocol/src/messages/server-to-host.ts] — boss delta members `boss:moved` (`:183`), `boss:stomped` (`:190`), `boss:damaged` (`:219`), `boss:phaseChanged` (`:225`), `boss:defeated` (`:231`); **no `boss:charged`** at this baseline
- [Source: packages/net-protocol/src/apply-delta.ts] — `boss:damaged` (`:169-171`), `boss:phaseChanged` (`:173-175`), `boss:defeated` (`:177-179`), `boss:moved` (`:181-183`), `boss:stomped` no-op (`:185`)
- [Source: _bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md] — engine contract, review fixes, deferred D-7.1-A…D, retracted pixi/vitest claim
- [Source: _bmad-output/implementation-artifacts/dev-5-boss-transient-delta-whitelist-fix.md] — whitelist is delivery filtering only; `applyDelta` is unconditional
- [Source: _bmad-output/implementation-artifacts/6-2-grassland-boss-fsm-phase-system-and-difficulty-tiered-behaviors.md] — boss FSM/phase/difficulty behavior (blocked area)
- [Source: _bmad-output/implementation-artifacts/6-3-boss-arena-handcrafted-level-physics-geometry-and-host-rendering.md] — boss sprite/HP bar/phase visuals prior art, and why the boss is drawn in the ticker
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md] (`:105-227`) — Raw Earth / Spirit Chant token system; `accent-corruption 0x7d2dff`, `corruption-blood 0xc0392b`, `accent-warm 0xc07d35`, reserved `accent-purify 0x90d8f0`, reserved `accent-spirit 0x6ea8d8`
- [Source: _bmad-output/project-context.md] — ownership, host-is-a-pure-client, no game-rules import, PixiJS renderer rules, `Math.random()` allowance, strict TS, constants/naming conventions
- [Source: CLAUDE.md#Hook Policy] — Pre-Task, Ownership, Contract-change, Simulation-safety, Client-UX, Telemetry hook definitions

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story created. Split out of Epic 7 Story 7.7 (`epics.md:2024-2041`) after verifying `boss:charged` has no `DeltaEventMsg` member and is swallowed by `GameRoom.ts:1925-1927`; protocol + simulation half became Story 7.7a. AC1 reframed from "charge telegraph" to post-hoc dash visual per the user's 2026-07-22 decision (no simulation windup). |

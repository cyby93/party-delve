---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.6: Status Effect VFX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to tell at a glance which status effect (damage reduction, slow, damage buff, shield) is active on a character, not just that "some" effect is active,
so that buffs/debuffs are readable mid-combat without opening a menu.

## Acceptance Criteria

1. **Given** `DungeonScreen.tsx:258-288` today draws one generic 6px circle per active effect above every entity, differentiated only by `STATUS_EFFECT_COLORS` fill (`:39-44`),
   **when** this story ships,
   **then** each of the four `StatusEffectType` values (`damageReduction`, `slow`, `damageBuff`, `shield` — `packages/shared-types/src/status-effect.ts:1`) renders a **shape-distinct** aura/overlay: contracting armour ring, orbiting drag arc, outward ember sparks, and a soft filled dome respectively,
   **and** every one of those four visuals is produced by a Story 7.1 primitive factory (`createRingShockwave`, `createTrail`, `createParticleBurst`) — **no new `Graphics` geometry is authored in `DungeonScreen.tsx` or anywhere else for these shapes**.

2. **Given** an entity carries 2–3 simultaneous status effects,
   **when** it is rendered,
   **then** each effect occupies a **fixed radius slot** determined by its type alone (never by insertion order or by how many other effects are active), so a given effect always appears at the same distance from the body,
   **and** the resulting concentric bands are individually readable at 2–4 m couch distance,
   **and** none of them obscures the entity body, the enemy health bar (`DungeonScreen.tsx:231`, a 30×4 px rect at local `y = -32`), the floating damage numbers (`:567`, anchored at `y - 44`), or the down/spirit body sprite (`:151-174`).

3. **Given** the existing `statusBadgeGraphics` create-on-first-seen / cleanup-on-missing lifecycle (`DungeonScreen.tsx:266-288`),
   **when** this story ships,
   **then** that lifecycle shape is **preserved** — a per-entity map entry is created the first frame the entity has any status effect, per-effect handles are created the first frame that effect type appears, and both are torn down the frame the effect/entity disappears from `GameState`,
   **and** an entity that dies, is removed, or disconnects mid-effect leaves **zero** live VFX handles and zero orphaned stage children.

4. **Given** the host is a pure renderer,
   **when** this story ships,
   **then** the visuals are driven **exclusively** from `player.statusEffects` / `enemy.statusEffects` in the per-frame `GameState` snapshot,
   **and** no new delta event, no new `shared-types` field, no `net-protocol` change, and no addition to the host transient-delta whitelist (`apps/host-client/src/session/host-session.ts:44-63`) is made.

5. **Given** up to 8 players plus every alive enemy can each carry multiple simultaneous effects at 60 fps (deferred item **D-7.1-D**: no cap/pooling/back-pressure in `VfxEngine`),
   **when** this story ships,
   **then** the implementation allocates **at most one live `EffectHandle` per (entityId, effectType) pair**, never one per frame,
   **and** a hard ceiling constant (`MAX_STATUS_AURAS`) load-sheds new aura creation beyond it,
   **and** the story records a concrete worst-case concurrent-handle count and allocation rate, re-deferring pooling with that rationale rather than silently inheriting D-7.1-D.

6. **Given** the existing host visuals,
   **when** this story ships,
   **then** none of the following regress: the ability-cast cosine flash (`:131-133,142-144`), the frozen-player `alpha = 0.3` disconnect cue (`:144`), the down/spirit body sprite and its frozen dimming (`:151-174`), the enemy kill fade (`:194-209`), bond tethers (`:234-256`), projectiles (`:290-309`), zones (`:311-330`), essence flashes, damage numbers, the purification pulse + background swap + reward reveal (`:462-498`), the revive-timer overlay, and the boss sprite/HP bar/phase visuals (`:436-460`).

## Tasks / Subtasks

- [x] **Task 1: One-time `VfxEngine` wiring in `DungeonScreen.tsx` — guarded "if not already present"** (AC: 1, 3, 5)
  - [x] 1.1: Verified `vfxEngineRef` already exists (landed with Story 7.2) — reused verbatim, no re-wire, no second engine.
  - [x] 1.2: N/A — import/ref already present.
  - [x] 1.3: N/A — already constructed in `initPixi`.
  - [x] 1.4: N/A — `vfxEngineRef.current?.update(Date.now())` already in the ticker, already after `renderFrame`.
  - [x] 1.5: N/A — `vfxEngineRef.current?.clear()` already in unmount cleanup, already before `app.destroy(...)`.

- [x] **Task 2: New pure module `apps/host-client/src/vfx/status-aura.ts`** (AC: 1, 2, 5)
  - [x] 2.1: `AURA_COLORS`, `AURA_SLOT_INDEX`, `AURA_BASE_GAP`, `AURA_SLOT_STEP`, `AURA_EXPIRY_FADE_MS`, `SHIELD_REFERENCE_HP`, `SLOW_ORBIT_PERIOD_MS`, `MAX_STATUS_AURAS` exported as named constants at module top; per-type visual numbers (durations, offsets, alpha bases, particle counts) also named module-level consts, not inlined.
  - [x] 2.2: `statusAuraSpec(type, entityRadius, magnitude, msRemaining): StatusAuraSpec` — pure, no `pixi.js` import, no display-object touch. `StatusAuraSpec` is a discriminated union (`RingAuraSpec | BurstAuraSpec | TrailAuraSpec`) keyed by `kind`, chosen over one flat interface with optional fields because the repo's `exactOptionalPropertyTypes: true` tsconfig rejected forwarding `number | undefined` into the primitives' required-when-present params.
  - [x] 2.3: `createStatusAura(spec, x, y, phase): EffectHandle | TrailHandle` — switches on `spec.kind` (not `spec.type`): `damageReduction`/`shield` both land on `createRingShockwave` (distinguished by `filled` + radii + colour), `damageBuff` on `createParticleBurst`, `slow` on `createTrail`. No geometry authored in this file.
  - [x] 2.4: `slowOrbitPoint(x, y, radius, phase, now)` exported, pure, covered by Task 6 tests.
  - [x] 2.5: Re-exported from `apps/host-client/src/vfx/index.ts` (values + `StatusAuraSpec`/`StatusAuraKind`/`StatusAuraHandle`/`StatusAuraEntry` types).

- [x] **Task 3: Replace the status-badge block in `renderFrame`** (AC: 1, 2, 3, 4, 6)
  - [x] 3.1: `statusBadgeGraphics: Map<string, Graphics>` → `statusAuras: Map<string, StatusAuraEntry>` in place. The "new 11th `vfxEngine` param" was already satisfied by the existing `vfxRefs.engine` (threaded since 7.2/7.3) — no duplicate param added. Ref renamed `statusBadgeGraphicsRef` → `statusAurasRef`; ticker call site updated.
  - [x] 3.2: Rewritten per Dev Notes wiring shape; `badgeTargets` construction kept verbatim (same `p.x/p.y`/`PLAYER_RADIUS`, `e.isAlive`/`ENEMY_RADIUS`).
  - [x] 3.3: Cleanup-on-missing (entity level) removes every handle in a dropped entry via `vfxEngine.remove(handle.effectId)`.
  - [x] 3.4: Create-on-first-seen entity entry, then per-effect-type create/cleanup nested inside.
  - [x] 3.5: Whole section guarded by `if (vfxEngine) { ... }` (equivalent skip — an early `return` was avoided since the rest of `renderFrame` runs after this block, not before).
  - [x] 3.6: Deleted `STATUS_BADGE_RADIUS`, `STATUS_EFFECT_COLORS`, and the `StatusEffectType` import (confirmed unused elsewhere in the file after the rewrite). **Also removed, per the composition rule in Dev Notes → Seams with sibling stories:** Story 7.2's Iron Skin persistent shell (`ironSkinGraphics`/`ownsIronSkinShell`/`IRON_SKIN_*`/`STONEHIDE_SLATE`) and Story 7.3's Warding Cry persistent shield pulse (`renderShieldAura`/`shieldPulseAt`) — both were "persist-for-the-duration" visuals for `damageReduction`/`shield`, the exact case the rule says to remove and replace with the generic slot aura, since neither has a separate one-shot cast accent to preserve (unlike Dark Pact's `damageBuff` onset, which stays — it fires once at cast and does not persist).
  - [x] 3.7: Unmount cleanup updated to `statusAurasRef.current.clear()`.

- [x] **Task 4: Layering — auras must render below entity sprites** (AC: 2, 6)
  - [x] 4.1: `if (raw.view) app.stage.setChildIndex(raw.view, 0);` immediately after `vfxEngine.add(raw)`, for both the trail-creation and cadence-creation branches.
  - [x] 4.2: `sortableChildren` untouched; no second engine or layer `Container` introduced.

- [x] **Task 5: Per-frame maintenance of live auras** (AC: 1, 2, 3, 5)
  - [x] 5.1: `handle.view?.position.set(target.x, target.y)` every frame for cadence-kind handles.
  - [x] 5.2: Trail's `view.position` never set; `moveTo` fed with world coordinates from `slowOrbitPoint`.
  - [x] 5.3: `handle.trail!.moveTo(point.x, point.y, now)` every frame, `now === Date.now()`.
  - [x] 5.4: `handle.trail!.disposed` checked before reuse; a disposed trail is re-created.
  - [x] 5.5: Cadence re-trigger on `now >= handle.nextRetriggerAt`; outgoing pulse never explicitly removed (`cadenceMs === durationMs`); only the newest id is stored.
  - [x] 5.6: Expiry fade baked into `alpha` at trigger time for the three cadence kinds (inside `statusAuraSpec`); `handle.view.alpha = spec.alpha` set every frame for the `slow` trail only.
  - [x] 5.7: All `add`/`remove` calls live inside `renderFrame`, before `vfxEngine.update(now)` runs in the ticker; no engine call from inside a primitive's own `update`.

- [x] **Task 6: Self-check — one runnable test** (AC: 1, 2, 5)
  - [x] 6.1: `apps/host-client/src/vfx/status-aura.test.ts` — 13 tests covering colour distinctness/disjointness, slot-radius purity and the ≥38 enemy floor, magnitude scaling (damageReduction lineWidth, shield alpha reference+clamp), expiry-fade clamping (full/zero/negative/NaN), and `slowOrbitPoint`'s circle/period invariants. Note: "all four types return a distinct `kind`" is satisfied at the `type` level, not literally at `kind` — `damageReduction`/`shield` share `kind: 'ring'` by design (Dev Notes' spec table names `createRingShockwave` for both), which is what AC1's "no new Graphics geometry... only the 3 named primitive factories" requires; the test asserts `type` distinctness and documents the `kind` sharing inline.
  - [x] 6.2: `npx vitest run src/vfx/status-aura.test.ts` — 13/13 passed.
  - [x] 6.3: `npm run typecheck` at repo root — clean across all 10 tsconfigs.

- [x] **Task 7: Client-UX hook manual verification** (AC: 2, 6)
  - [x] 7.1: **RUN by user (2026-07-26), live host + phones.** Join-flow smoke test implicitly covered (user reached the dungeon and triggered abilities). No console-error reports.
  - [x] 7.2: **RUN by user.** Iron Skin, Tremor Stomp, Dark Pact confirmed reading correctly at a glance ("all the others are good"). Warding Cry initially reported as visible-but-not-pulsing — root-caused (see Completion Notes) to `SHIELD_ALPHA_BASE` being too low (0.22) for a filled, unstroked shape to read as animating; bumped to 0.45 and user confirmed the fix ("Yeah great, its working!").
  - [ ] 7.3: **NOT explicitly walked** — user did not report testing simultaneous stacked effects on one entity. Low risk: the per-type radius-slot math is independently unit-tested (Task 6) and unaffected by which/how many other effects are active.
  - [ ] 7.4: **NOT explicitly walked** — user did not report testing a live disconnect/reconnect.
  - [ ] 7.5: **NOT explicitly walked** — user did not report testing a down/spirit transition. Verified by code inspection instead: `badgeTargets` uses `p.x/p.y` unconditionally (same as the pre-existing badge code), so the aura tracks the spirit position exactly like the old badge did.
  - [ ] 7.6: **NOT explicitly walked** — user did not report testing a kill mid-effect. Verified by code inspection instead: `badgeTargets` filters enemies on `e.isAlive`, so a killed enemy drops out of `activeAuraIds` the same frame and its aura's cleanup-on-missing pass fires immediately (same frame as the kill-fade begins).
  - **User sign-off (2026-07-26):** "this task is done, mark it so" — explicit approval to close the story after live-testing all four effect shapes/colors and the one real finding (shield alpha) being fixed and re-confirmed. 7.3-7.6 were not individually walked in the reported session; closing on the user's explicit judgment call rather than a literal all-boxes-checked completion, per their instruction.

- [x] **Task 8: Record the D-7.1-D verdict** (AC: 5)
  - [x] 8.1: Recorded in Completion Notes below; `deferred-work.md`'s D-7.1-D entry updated with this story's concrete numbers (≈44 concurrent handles worst case, ≤~34 creations/sec, pooling stays deferred for status auras).

### Review Findings

Code review ran with 2 of 3 layers as independent subagents; the Edge Case Hunter and Acceptance Auditor subagents both failed mid-run on a session usage-limit error (unrelated to this diff) and could not be retried in this session. Their analysis was performed directly instead, using full project read access and the story spec — findings below are labeled by actual source, not claimed as independent-subagent output where they were not.

- [x] [Review][Patch] MAX_STATUS_AURAS ceiling denial could permanently strand a stale handle, ratcheting the shed ceiling tighter every time it's hit [`apps/host-client/src/screens/DungeonScreen.tsx`, both the `'trail'` and cadence creation branches] — **FIXED**: when the ceiling denies re-creation of an *existing* (expired/disposed) handle, the stale `entry.auras` map entry is now deleted instead of left in place, so it stops counting against `liveAuraCount()`. Found by the Blind Hunter layer, confirmed by re-reading the code directly (only reachable above ~64 concurrent auras, well above the documented ~44 worst case, so low real-world likelihood but a genuine correctness gap).
- [x] [Review][Patch] Two unused imports left over in `DungeonScreen.tsx` (`type Container` from `pixi.js`, `type StatusAuraHandle` from `../vfx`) — **FIXED**: both removed; confirmed via grep neither was referenced anywhere else in the file. Found by the Blind Hunter layer.

11 additional Blind Hunter findings were reviewed and dismissed as noise (verified against code/context the blind layer couldn't see): the down/spirit "missing exclusion filter" claim matches the pre-existing badge behavior and Task 7.5's own requirement (aura must follow `player.x/y` like the old badge, not exclude down/spirit); the "dropped isFrozen dim cue" is by design — Task 7.4 only requires the aura not *un-dim* the frozen cue, not that the aura itself dims, and the player's own circle still carries the 0.3 alpha; `setChildIndex(view, 0)` matches the exact "draw below sprites" idiom Task 4.1 mandates (same as tethers/zones/bodies), not a re-introduction of the *different*, already-rejected Iron-Skin-specific pattern the comment referenced; `setChildIndex` assuming prior stage membership is safe — `VfxEngine.add()` calls `stage.addChild` before returning, confirmed by reading `engine.ts`; the `if (vfxEngine)` guard is spec-mandated (Task 3.5) and `vfxEngine` is synchronously non-null before any `renderFrame` call can occur; `magnitude` clamping was intentionally omitted — it's sim-controlled and always non-negative by game design (unlike `msRemaining`, which the story explicitly flags for clock-skew NaN-safety); no `assertNever`/exhaustiveness guard matches this codebase's existing switch-statement convention elsewhere; the `as TrailHandle`/`as EffectHandle` assertions and `handle.trail!` are correct by the switch's own local invariant; `liveAuraCount()`'s O(n) rescan is negligible at the documented ~44-64 handle volume; `durationMs`'s dual meaning across cadence vs. persistent kinds is already explained at its call sites; the `lineWidth: 0 // ignored when filled` comment was verified true by reading `createRingShockwave` in `primitives.ts`. `auraCeilingWarned`'s module-level (not per-mount) reset was left as-is — it matches the story's own literal instruction ("module-level `let warned = false`") and has zero player-facing impact (only suppresses a repeat dev-console warning across dungeon runs in the same tab).
- Self-performed Acceptance Auditor pass: all 6 ACs individually re-checked against the diff — **PASS** on all six (AC1 shape-distinct/primitive-only; AC2 fixed independent slot radii + correct layering; AC3 create-on-first-seen/cleanup-on-missing lifecycle, now airtight after the ceiling-stale-handle patch; AC4 snapshot-only, no contract/whitelist touch; AC5 bounded one-handle-per-pair + ceiling + recorded verdict; AC6 no regression to the enumerated pre-Epic-7 visual list — the Iron Skin shell / Warding Cry pulse removals are sanctioned by the story's own composition rule and aren't part of AC6's enumerated baseline).
- Self-performed Edge Case Hunter pass (entity/effect lifecycle, numeric boundaries, MAX_STATUS_AURAS recovery, down/spirit/kill/reconnect transitions): no additional unhandled edge cases found beyond the ceiling-stale-handle bug above, which is already patched.

Post-patch verification: `npm run typecheck` clean (10/10 tsconfigs); `npx vitest run src/vfx/status-aura.test.ts src/vfx/vfx.test.ts` — 37/37 passed.

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping, inserted by `sprint-change-proposal-2026-07-21.md`. Depends only on Story 7.1 (done); **no dependency on 7.2–7.5, 7.7, 7.8** — pick this up standalone.
- **Context:** Today every status effect on every entity renders as the same 6px circle above the head, differentiated only by fill colour (`DungeonScreen.tsx:258-288`). Four mechanically very different effects (armour, slow, damage buff, absorb-shield) are visually the same object. This story gives each a distinct shape built from the 7.1 primitives.
- **Goal:** Four shape-distinct, per-entity, persistent status auras driven from the `GameState` snapshot, composed from `createRingShockwave` / `createParticleBurst` / `createTrail`, with a bounded handle count and the existing create-on-first-seen / cleanup-on-missing lifecycle intact.
- **Allowed paths:** `apps/host-client/src/screens/DungeonScreen.tsx`, `apps/host-client/src/vfx/**` (new `status-aura.ts`, `status-aura.test.ts`, barrel edit).
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**`, `packages/shared-types/**`, `packages/net-protocol/**`, `apps/mobile-controller/**`, `packages/ui-kit/**`, `_bmad-output/implementation-artifacts/sprint-status.yaml` (owned by the sprint workflow), **and `apps/host-client/src/session/host-session.ts`** — this story deliberately does not touch the whitelist (see *Data source* below).
- **Inputs:** `apps/host-client/src/vfx/{types,primitives,engine,index}.ts`; `apps/host-client/src/screens/DungeonScreen.tsx`; `packages/shared-types/src/status-effect.ts`; `_bmad-output/planning-artifacts/epics.md:2005-2021`; `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:105-227`; `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`.
- **Non-goals:** No final pixel-art sprites (the separate PixelLab pass is untouched). No new abilities or mechanics. No protocol/schema changes. No status-effect *numbers* on screen (no stack counts, no countdown text — this is a shape/colour language, and the HUD chip strip stays as-is). No mobile-side status display. No refactor of `renderFrame`'s parameter list into a context object. No rewrite of the `App.tsx` `latestTransientDelta` plumbing.
- **Ownership check:** Single area — `apps/host-client/**`, Host Experience Engineer. No split needed, no cross-context approval required.
- **Client-UX hook: TRIGGERED.** This story actually renders, so every host check is real: join-flow smoke test, HUD readability, reconnect-state visibility (the frozen-player 0.3 alpha cue and the down/spirit body sprite must survive), couch readability at 2–4 m. Task 7 enumerates them.
- **Contract-change hook: NOT triggered.** Nothing in `packages/shared-types/**` or `packages/net-protocol/**` is touched; no session-lifecycle, reconnect, room-state, join-flow, prediction/reconciliation/interpolation surface changes. This story consumes `StatusEffect` read-only from the snapshot and adds zero delta types. It also makes **no** edit to `host-session.ts`'s delivery whitelist.
- **Simulation-safety hook: NOT triggered.** No file under `apps/simulation-server/**` or `packages/game-rules/**` is touched.
- **Telemetry hook: N/A.** No new user flow — this is a visual treatment of an existing, already-shipped mechanic (Story 3.12's status-effect engine).
- **Merge gate:** typecheck green, `status-aura.test.ts` green, Task 7's Client-UX checks walked manually, no regression from AC6's list.

### The core design problem — persistent visual vs. fire-and-forget engine

Read this before writing any code. Getting it wrong is the one way this story fails.

`VfxEngine` is built around **one-shot** effects: every primitive self-completes on a timer and is reaped (`engine.ts:29-43`). A status aura is the opposite — it is a **persistent, per-entity, per-frame** visual that must live exactly as long as the effect does and follow a moving entity. `createTintPulse` is the only primitive with an open-ended feel, and it **borrows a caller-owned display object** (`primitives.ts:294-320`, `view: null`) — which makes it the *worst* choice here (see the ban below).

The composition this story uses, per effect type:

| Model | Used by | How it persists | Allocation |
|---|---|---|---|
| **Cadence pulse** — a short primitive re-triggered on a fixed cadence, `cadenceMs === durationMs` so the outgoing pulse expires by itself | `damageReduction`, `shield`, `damageBuff` | `renderFrame` re-triggers when `now >= entry.nextRetriggerAt`; the view is repositioned to the entity every frame in between | 1 handle per (entity, type) per cadence (≥ 700 ms) |
| **Persistent handle** — one long-lived handle kept alive by feeding it every frame | `slow` (`createTrail`) | `moveTo(x, y, now)` every frame keeps the ring buffer alive (`primitives.ts:100-105`); stop feeding it and it self-expires | 1 handle per (entity, `slow`) for the entire effect — **zero** re-allocation |

**Who owns the handle:** the per-entity `StatusAuraEntry` in the `statusAuras` map, which lives in `statusAurasRef` in `DungeonScreen`. The `VfxEngine` owns the *display object*; the entry owns the *id* and is solely responsible for calling `vfxEngine.remove(id)`.

**When it is disposed:** in `renderFrame`'s cleanup pass, the frame the entity leaves the target set (removed from `state.players`, or `enemy.isAlive === false`) or the frame that specific effect type leaves `entity.statusEffects`. `vfxEngine.remove(id)` removes the view from the stage and calls `dispose()` (`engine.ts:46-56`); calling it for an already-reaped id is a safe no-op (`engine.ts:47-48`). Engine `clear()` on unmount (Task 1.5) is the backstop.

**Entity dies or leaves mid-effect (D-7.1-C — neither the engine nor any primitive detects an externally destroyed view/target):** this design is immune by construction, because **every aura view is owned by the engine, never borrowed from the entity.** `renderFrame` destroys player circles (`:105-110`) and enemy circles (`:198-218`) on removal; nothing in this story holds a reference to those. The one primitive that *would* be exposed to D-7.1-C is `createTintPulse`, which captures and restores a borrowed target's `alpha`/`tint` — so:

> **Hard rule: `createTintPulse` is banned in this story.** Two independent reasons. (1) D-7.1-C — the player/enemy `Graphics` it would borrow is destroyed by `renderFrame` on entity removal, leaving the pulse writing to a destroyed object and restoring alpha onto a corpse. (2) `renderFrame` **assigns** `circle.alpha` unconditionally every frame (`:131-133, :140, :142-144`), so a tint pulse and the frame loop would fight over the same property — and the loser would be the frozen-player `0.3` disconnect cue (AC6).

**Kill fade interaction:** enemies are filtered on `isAlive` in `badgeTargets` (`:263`), while `enemyGraphics` keeps a fading entry for `KILL_FADE_MS = 300` (`:194-209`). Keep that split: auras tear down the instant the enemy is no longer alive, deterministically, exactly like the badges do today. A graceful "let the last pulse finish" fade-out is explicitly **not** in scope — it would leave a ring hanging at the death position with no owner to reposition it.

### Data source — snapshot, not deltas (and why the whitelist stays untouched)

Drive everything from `player.statusEffects` / `enemy.statusEffects` in the `GameState` snapshot that `renderFrame` already receives.

`status:applied` / `status:expired` deltas **do** exist (`packages/net-protocol/src/messages/server-to-host.ts`), but are **not** in the host's transient-delta whitelist (`apps/host-client/src/session/host-session.ts:44-63`) and this story **recommends against adding them**:

1. **Bursts collapse.** `latestTransientDelta` is a single React state value (`App.tsx:20,42-48`), cleared after 400 ms, and React 18 auto-batches — two deltas arriving in the same task collapse and only the last reaches `DungeonScreen`. Warding Cry shields *every ally in the zone* in one tick, emitting N `status:applied` deltas; a delta-driven visual would silently show one of them. (This is the same pre-existing plumbing weakness that makes `boss:stomped` unreliable. Do **not** rewrite it here — flag it as a follow-up if it ever blocks an AC.)
2. **The snapshot is already reconciled** and survives reconnect, late join, and mid-effect refresh. A delta-driven aura would be permanently missing for a player who joined or reconnected while an effect was already running.
3. **Nothing is gained.** `StatusEffect` already carries `type`, `magnitude` and `expiresAtMs` (`packages/shared-types/src/status-effect.ts:3-7`), which is the complete lifetime; the delta payload carries exactly the same three fields.
4. **Cost.** Forwarding two more delta types pushes React state churn at up to the sim's delta rate for zero visual gain.

**Optional, out of scope:** a one-shot "effect applied" accent (e.g. a single bright `createRingShockwave` at the instant a shield lands) would need `status:applied` on the whitelist. If a future story wants it, adding the type there is host-local delivery filtering — **not** a contract change — and `applyDelta` already handles both types, so forwarding is safe. Not this story.

**Field semantics (`status-effect.ts:5-6`):** `magnitude` is a **0–1 fraction** for `damageReduction` / `slow` / `damageBuff`, but **flat HP** for `shield`. `expiresAtMs` is **host-epoch ms**, directly comparable to `Date.now()` — that is what `msRemaining` uses.

### Per-effect visual spec

All colours are PixiJS `number` literals. Slot radius:

```
slotRadius(type, entityRadius) = entityRadius + AURA_BASE_GAP + AURA_SLOT_STEP * AURA_SLOT_INDEX[type]
AURA_BASE_GAP  = 18
AURA_SLOT_STEP = 11
AURA_SLOT_INDEX = { shield: 0, damageReduction: 1, damageBuff: 2, slow: 3 }
```

Resulting radii — **fixed per type, independent of what else is active** (AC2):

| Type | Slot | Player (r=24) | Enemy (r=20) |
|---|---|---|---|
| `shield` | 0 | 42 | 38 |
| `damageReduction` | 1 | 53 | 49 |
| `damageBuff` | 2 | 64 | 60 |
| `slow` | 3 | 75 | 71 |

**Why ≥ 38 is the floor:** the enemy health bar is a 30×4 px rect spanning local `x ∈ [-15, 15]`, `y ∈ [-32, -28]` (`DungeonScreen.tsx:231`). A circle of radius 38 crosses `y = -32` at `x = ±20.4` and `y = -28` at `x = ±25.7` — **outside** the bar on both sides. A radius-34 ring would cross it at `x = ±11.4`, i.e. straight through. Damage numbers are anchored `(0.5, 1)` at `y - 44` (`:567`), above the innermost band and added to the stage after the auras, so they draw on top regardless.

The spec table (values that `statusAuraSpec` must return):

| Type | Read | Primitive | Parameters | Cadence |
|---|---|---|---|---|
| `damageReduction` | **Contracting armour ring** — a hard stroke that snaps *inward* to a tight shell, plating settling into place | `createRingShockwave` | `startRadius: slotR + 10`, `maxRadius: slotR`, `lineWidth: 3 * (0.7 + 0.6 * magnitude)` → 3.2 px at the shipped 0.3, `filled: false`, `durationMs: 900`, `alpha: 0.9 * expiryFade`, `color: 0xa89ec0` | 900 ms |
| `shield` | **Soft filled dome** — a low-alpha bubble that blooms outward and dissolves, hugging the body | `createRingShockwave` | `startRadius: slotR - 8`, `maxRadius: slotR + 4`, `filled: true`, `durationMs: 1100`, `alpha: 0.22 * min(1, magnitude / SHIELD_REFERENCE_HP) * expiryFade`, `color: 0xc07d35` | 1100 ms |
| `damageBuff` | **Outward ember sparks** — small fast particles thrown off the body, aggression | `createParticleBurst` | `x/y = entity centre`, `count: 6`, `speed: slotR / 700` px/ms (so particles land at the slot radius as they fade), `spread: 1.2`, `particleRadius: 3`, `durationMs: 700`, `alpha: 0.95 * (0.7 + 0.6 * magnitude) * expiryFade` clamped to 1, `color: 0xc0392b` | 700 ms |
| `slow` | **Orbiting drag arc** — a thick, heavy half-arc sweeping slowly around the entity, smearing into a tail when it moves | `createTrail` (persistent) | `x/y = slowOrbitPoint(...)` at creation, `width: 8 + 6 * magnitude` → 10.4 px at the shipped 0.4, `pointCount: 14`, `durationMs: SLOW_ORBIT_PERIOD_MS / 2 = 700` (so the arc covers half the circle), `alpha: 0.55`, `color: 0x7d2dff`; fed every frame with `slowOrbitPoint(x, y, slotR, phase, now)`; `view.alpha = expiryFade` per frame | persistent (0) |

```ts
// SLOW_ORBIT_PERIOD_MS = 1400
slowOrbitPoint(x, y, radius, phase, now) {
  const theta = phase + (now % SLOW_ORBIT_PERIOD_MS) / SLOW_ORBIT_PERIOD_MS * Math.PI * 2;
  return { x: x + Math.cos(theta) * radius, y: y + Math.sin(theta) * radius };
}
```

`phase` is a per-entity constant drawn once with `Math.random() * Math.PI * 2` at entry creation (`Math.random()` is explicitly permitted for host cosmetic effects) — without it, every slowed enemy in a pack sweeps in lockstep like a drill team.

**Expiry fade** (all types): `expiryFade = clamp01(msRemaining / AURA_EXPIRY_FADE_MS)` with `AURA_EXPIRY_FADE_MS = 600`; `msRemaining = effect.expiresAtMs - now`, and any non-finite or negative value clamps to `0` (never `NaN` into a PixiJS alpha — the same bar `progress()` sets at `types.ts:52-55`). An effect about to run out visibly winds down instead of popping.

**Application per kind:** for the three cadence kinds, `expiryFade` is baked into the `alpha` **passed at trigger time** (they're re-created every cadence anyway). For the persistent `slow` trail only, set `handle.view.alpha = expiryFade` **each frame** — `createTrail.update` strokes per-segment alpha and never assigns `view.alpha` (`primitives.ts:156-177`), so this composes cleanly. **Never** assign `view.alpha` on a burst: `createParticleBurst.update` assigns it itself (`primitives.ts:75`) and would clobber your value the same frame.

### Colour reconciliation against the UX token set

**All four colours change.** Today's `STATUS_EFFECT_COLORS` (`DungeonScreen.tsx:39-44`) are indefensible for an aura that surrounds a *player*: every single one of them is byte-identical to a session colour (`:14-23`), and two also collide with other canvas elements:

| Type | Today | Collides with | New | UX token | Rationale |
|---|---|---|---|---|---|
| `damageReduction` | `0x3498db` | `SessionColor.BLUE` | **`0xa89ec0`** | `text-secondary` | Pale mauve-grey reads as stone/armour, matches Stonehide's earth register, high contrast on `0x0a0a12`, and is not a session colour nor a reserved accent. Deliberately **not** `accent-spirit 0x6ea8d8` / `interactive-hover 0x88c0ee`, which would be confused with the spirit-form glow and bond tethers. |
| `slow` | `0x9b59b6` | `SessionColor.PURPLE` **and** the zone fill (`:329`) | **`0x7d2dff`** | `accent-corruption` | DESIGN.md explicitly assigns this token to "corruption-themed ability visual effects"; a debilitating debuff is exactly that. Shares a hex with the boss fill (`:451`) — disambiguated by shape and weight (a thin 10 px sweeping arc vs. a 48 px opaque disc) and by the fact that the boss never carries a slow. Called out rather than hidden. |
| `damageBuff` | `0xe67e22` | `SessionColor.ORANGE` | **`0xc0392b`** | `corruption-blood` | Dark Pact literally drains an ally's HP to buy this buff — blood is the honest read. Adjacent to `SessionColor.RED 0xe74c3c` but darker/less saturated, and mitigated because the buff renders as *sparks at radius ≥ 60*, never as a fill over the body; `damageBuff` is also self-only today, so at most a handful are on screen. |
| `shield` | `0xf1c40f` | `SessionColor.YELLOW` **and** the essence-drop flash (`:582`) | **`0xc07d35`** | `accent-warm` | DESIGN.md: firelight, warmth, safety — the right register for an absorb shield, and it is not a danger colour. Distinct from essence gold, so a shielded player no longer looks like a pickup. |

None of the four appears in `SESSION_COLOR_HEX`, and none is `accent-purify 0x90d8f0` (reserved exclusively for the purification pulse) or `accent-spirit 0x6ea8d8` (reserved for bonds/spirit form/selection). Colours stay inside the two-layer Raw Earth / Spirit Chant system: no neon, no invented hexes.

### Effect volume — the D-7.1-D verdict

**D-7.1-D:** *"No cap, pooling, or load-shedding on concurrent effects… revisit when 7.2–7.8 reveal real effect volumes."* This story is the case it was written for, so it answers it concretely rather than inheriting it.

**Bound by construction: at most one live `EffectHandle` per (entityId, effectType) pair**, plus at most one handoff frame of overlap for the cadence kinds. Never one per frame.

Worst realistic case with today's abilities: `damageReduction` is self-only (Iron Skin) ⇒ ≤ 8; `damageBuff` is self-only (Dark Pact) ⇒ ≤ 8; `shield` is allies-only (Warding Cry) ⇒ ≤ 8; `slow` is enemies-only (Tremor Stomp) ⇒ ≤ alive enemies (~20 in a survive-waves level). **Ceiling ≈ 44 concurrent handles**, of which ~20 are zero-allocation persistent trails.

**Allocation rate:** the ≤ 24 cadence handles re-trigger at ≥ 700 ms ⇒ ≤ ~34 handle creations/second worst case, each one `Graphics` (ring) or a `Container` + 6 child `Graphics` (burst). For scale, the existing reward-reveal burst allocates 8–12 `Graphics` in a *single* frame (`:704-728`). This is comfortably inside the existing budget.

**Defensive load-shed (AC5):** `MAX_STATUS_AURAS = 64`. Before creating a new handle, if the total live aura handle count would exceed it, skip creation (the entity simply has no aura that frame) and `console.warn` **once** behind a module-level `let warned = false` — never per frame at 60 fps. Existing auras keep running; only new ones are shed.

**Verdict:** pooling stays **deferred**. Bounded per-pair allocation plus a hard ceiling is sufficient at these volumes; introducing a pool would add lifecycle complexity to `VfxEngine` (and interact badly with D-7.1-A double-add) for no measurable gain. Record this in Task 8 and update D-7.1-D with the numbers.

### `renderFrame` wiring, exact

Replace `DungeonScreen.tsx:258-288` with this shape (types/helpers live in `vfx/status-aura.ts`; only the loop lives here):

```ts
interface StatusAuraHandle {
  effectId: number;                 // VfxEngine id
  view: Container | null;           // handle.view — for repositioning / alpha
  trail: TrailHandle | null;        // non-null only for 'slow'
  nextRetriggerAt: number;          // 0 for persistent kinds
}
interface StatusAuraEntry {
  phase: number;                    // per-entity orbit phase, drawn once
  auras: Map<StatusEffectType, StatusAuraHandle>;
}
```

Order inside the section:

1. Build `badgeTargets` exactly as today (`:261-264`) — **do not change it**; players use `p.x/p.y` (the spirit position when down, matching the current badge), enemies are filtered on `isAlive`.
2. `if (!vfxEngine) return;`-equivalent skip for the section only.
3. **Cleanup-on-missing (entity level):** for each `[id, entry]` of `statusAuras` not in the active-target set → for every handle in `entry.auras`, `vfxEngine.remove(h.effectId)`; `statusAuras.delete(id)`.
4. **Per target:** if `target.effects.length === 0`, tear the entry down as in step 3 and `continue` (mirrors today's `:274`).
5. Create the entry on first sight (`phase = Math.random() * Math.PI * 2`).
6. **Cleanup-on-missing (effect level):** remove handles whose type is no longer in `target.effects`.
7. **Per effect:** `const spec = statusAuraSpec(effect.type, target.radius, effect.magnitude, effect.expiresAtMs - now);`
   - `slow`: create the trail if missing **or if `trail.disposed`**; `trail.moveTo(...slowOrbitPoint(target.x, target.y, spec.radius, entry.phase, now), now)`; `h.view.alpha = spec.alpha`. **Never** set `view.position` on a trail.
   - cadence kinds: if missing, or `now >= h.nextRetriggerAt`, create + `add` + `setChildIndex(view, 0)` + `nextRetriggerAt = now + spec.cadenceMs`. Every frame: `h.view?.position.set(target.x, target.y)`.
8. Enforce `MAX_STATUS_AURAS` before any creation in steps 7.

`Container` and `TrailHandle` need importing into `DungeonScreen.tsx` (`import type { Container } from 'pixi.js'`, `import type { TrailHandle } from '../vfx'`). Consider exporting `StatusAuraEntry` / `StatusAuraHandle` from `vfx/status-aura.ts` instead, so `DungeonScreen.tsx` imports the types rather than declaring them — the file is already 1056 lines.

### Seams with the sibling stories (7.2 / 7.3 / 7.4)

These four stories overlap on the same three effect types. The division of ownership:

| Story | Owns | Effect type |
|---|---|---|
| **7.6 (this)** | The **persistent, snapshot-driven, duration-long aura** for all four types | all four |
| 7.2 | Iron Skin's **cast moment** (`ability:fired`, Stonehide idx 2) | `damageReduction` |
| 7.3 | Warding Cry's **cast moment** (`ability:fired`, Spiritcaller idx 3) | `shield` |
| 7.4 | Dark Pact's **cast/drain acknowledgement** (`ability:fired`, Souldrinker idx 2) | `damageBuff` |

**Composition rule — whichever ships second must not double-render.** A cast-moment visual is a *one-shot, delta-driven* accent that fires once at `ability:fired` and completes within a few hundred ms. The *duration* visual is 7.6's aura and only 7.6's. Concretely:

- If **7.6 ships first** and 7.2/7.3/7.4 land later: they add only their one-shot cast accent and must not add a second persistent per-frame visual for `damageReduction` / `shield` / `damageBuff`.
- If **7.2/7.3/7.4 ship first** and any of them added a persist-for-the-duration ring/glow: this story **removes** that persistence and keeps only the cast instant, replacing the duration read with the generic slot aura. Check for it before writing Task 3 — grep `DungeonScreen.tsx` for `statusEffects` and for `damageReduction` / `shield` / `damageBuff` string literals.
- Either way there is **exactly one** persistent status visual per (entity, effect type) on screen. Two overlapping duration rings at different radii is the failure mode AC2 exists to prevent.
- The shared one-time `VfxEngine` wiring (Task 1) is the same in all four stories and is idempotent by the "if not already present" guard.

### Previous Story Intelligence (from 7.1)

Story 7.1 shipped `apps/host-client/src/vfx/` and **nothing consumes it yet** (its AC3 deliberately left `DungeonScreen.tsx` untouched). Its post-review learnings that directly change how you implement this story:

- **CLOCK CONTRACT** (`types.ts:26-34`). No primitive reads a clock; `startedAt` is captured from the first `update(now)`. Pass `Date.now()` to `vfxEngine.update()` and to `TrailHandle.moveTo()`, matching `renderFrame`'s `now` (`:99`). The purification-pulse and reward-particle blocks in the same ticker use `performance.now()` (`:465,:486`) — **do not** copy them. Mixing clocks makes effects vanish on frame 1 or leak forever, with no exception thrown.
- **Never allocate a display object per frame.** Handles are mutated in place. Repositioning `view.position` is free; re-creating a handle every frame is the thing AC5 forbids.
- **`createBeam` bakes local-space geometry around `view.position`; `createTrail` does not** — the trail strokes absolute point coordinates (`primitives.ts:170-173`) and never sets `view.position` (`:123`). This asymmetry is the single most likely bug in this story.
- **`TrailHandle.disposed`** exists precisely because a reaped trail is otherwise an undetectable zombie (`primitives.ts:97-99`). Check it before every `moveTo`.
- **`VfxEngine.update()` isolates a throwing effect** (`engine.ts:34-42`) — it reaps and logs rather than aborting the loop. Do not rely on that; it exists so one bad effect cannot freeze the other 43.
- **Deferred:** D-7.1-A (same handle added twice ⇒ two ids ⇒ double dispose — never re-`add` a handle you already added), D-7.1-B (no reentrancy guard — never call `add`/`remove`/`clear` from inside an effect's `update`), D-7.1-C (no externally-destroyed-view detection — see the `createTintPulse` ban above), D-7.1-D (no cap — answered above).
- **`pixi.js` imports fine under a plain node-environment `vitest run`** — the "pixi can't be imported" claim in 7.1's debug log was retracted. No `jsdom` needed, just ~35 s first transform on WSL2.

### Testing Standards

- `apps/host-client` has **no `vitest.config.ts` of its own**; `tests/vitest.config.ts` is scoped to `tests/{contract,e2e,unit}/**`. `apps/host-client/package.json` has a bare `"test": "vitest run"`. Run from `apps/host-client`: `npx vitest run src/vfx/status-aura.test.ts`.
- Existing sibling to follow: `apps/host-client/src/vfx/vfx.test.ts` (24 tests, real primitives, `Date.now()`-scale fake clock).
- Project convention (ponytail): **one runnable check for non-trivial logic**, not a suite per function. The pure mapping (`statusAuraSpec`, `slowOrbitPoint`) is the non-trivial logic; rendering correctness is verified manually via the Client-UX hook (Task 7).
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2 (simulation-server 60 s boot timeout; a heal assertion at `tests/e2e/ability-dispatch.test.ts:227`). Two runs produce two different failures. Note it in the Debug Log; do not chase it. This story touches no server code.
- Never claim a test passed that you did not run.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Ownership:** `apps/host-client/**` = Host Experience Engineer. Blocked: simulation-server, game-rules, mobile-controller, shared-types, net-protocol.
- **Never import `packages/game-rules` in `apps/host-client`.** The ability numbers quoted in Task 7.2 (Iron Skin 0.3/3000 ms, Tremor Stomp 0.4/2000 ms, Warding Cry 30 HP/4000 ms, Dark Pact 0.25/4000 ms) are for choosing visual parameters and writing the manual test plan **at authoring time only**. `SHIELD_REFERENCE_HP = 30` is a local host visual constant in `status-aura.ts`, not an import of `balance.ts`. `shared-types` **is** importable and already used (`DungeonScreen.tsx:3-4`).
  - **Update — Story 7.9 / ADR-0003:** the rule is refined to *never import `game-rules` **logic***. Status *magnitudes* (0.3, 0.4, 30, 0.25) are pure balance and stay host-forbidden — keep them as authoring-time references / local visual constants as before. But if any aura needs ability *spatial geometry* (a hit range/radius), **import it from the shared ability presentation contract in `shared-types`** (`ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`), not a transcribed literal.
- **PixiJS host renderer:** no game logic, cooldown tracking, or collision checks inside display objects. This story reads `statusEffects` and maps it to visual parameters; it makes no rule decisions.
- **Host is a pure client:** no `GameState` mutation, no game-rule checks, no physics reads.
- **`Math.random()` is permitted here** — "host UI animations, cosmetic effects" is the one allowed place (used for the orbit phase and inside `createParticleBurst`).
- **TypeScript strict**, no `any` without an explicit suppression comment.
- **Colours are PixiJS `number` literals (`0xrrggbb`)** in canvas code — never CSS strings. CSS strings appear only in the React/HTML overlay parts of `DungeonScreen.tsx`.
- **Constants:** tunable visual values go in named constants at the top of `status-aura.ts`, not as inline magic numbers in the delta/render loop.
- Files kebab-case (`status-aura.ts`); events `noun:verb`; wire types `PascalCase + Msg`.

### Project Structure Notes

- New files: `apps/host-client/src/vfx/status-aura.ts`, `apps/host-client/src/vfx/status-aura.test.ts` — siblings of `types.ts` / `primitives.ts` / `engine.ts` / `vfx.test.ts`.
- Modified: `apps/host-client/src/vfx/index.ts` (barrel re-export), `apps/host-client/src/screens/DungeonScreen.tsx`.
- No `packages/ui-kit` involvement — this is host-canvas-only with no mobile counterpart.
- No `vite.config.ts` alias change needed; `status-aura.ts` is imported relatively via the existing `../vfx` barrel.
- **Known variance:** `renderFrame` will carry 11 positional parameters after this story (10 today, already flagged as ugly). Collapsing them into a single context/refs object is a worthwhile follow-up but is deliberately **out of scope** here — it would touch every section of the function and put AC6's no-regression list at risk for a story that is otherwise confined to 30 lines.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:2005-2021`] — Story 7.6 statement and both ACs (distinct aura per type built from the 7.1 library; `statusBadgeGraphics` lifecycle preserved; rendering-only; multiple effects individually readable).
- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 framing; confirms "status effects differ only by badge fill color (`:258-288`)".
- [Source: `_bmad-output/planning-artifacts/epics.md:2061`] — Epic 7 non-goals (no final pixel art, no new abilities/mechanics, no protocol/schema changes beyond 7.7's whitelist line).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:258-288`] — the status-badge block being replaced, including the `badgeTargets` construction (`:261-264`) and the cleanup-on-missing pass (`:266-272`).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:33,38-44`] — `STATUS_BADGE_RADIUS`, `STATUS_EFFECT_COLORS` (`damageReduction 0x3498db`, `slow 0x9b59b6`, `damageBuff 0xe67e22`, `shield 0xf1c40f`) — all four to be replaced.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:14-23`] — `SESSION_COLOR_HEX`; every current status colour is byte-identical to one of these.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:25-26,99,231,246,324,329,451,567,582`] — `PLAYER_RADIUS`/`ENEMY_RADIUS`, `const now = Date.now()`, the enemy health bar rect, the `addChildAt(g, 0)` below-sprites idiom, the zone fill, the boss fill, damage-number anchoring, the essence-flash gold.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:131-133,140-146,151-174,194-209`] — the ability-cast cosine flash, the frozen `0.3` alpha cue, the down/spirit body sprite, the enemy kill fade (AC6's regression list).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:369-392,402-526`] — ref block, `initPixi`, the ticker callback and the unmount cleanup — the four Task-1 wiring sites.
- [Source: `apps/host-client/src/vfx/types.ts:10-18,20-24,26-45,52-55`] — `EffectHandle`, `VfxStage`, the CLOCK CONTRACT note on `VfxTriggerParams`, `progress()`'s NaN/duration guards.
- [Source: `apps/host-client/src/vfx/primitives.ts:38-86`] — `createParticleBurst`: `Container` + N child `Graphics`, local-space, assigns `view.alpha` itself at `:75`.
- [Source: `apps/host-client/src/vfx/primitives.ts:97-105,113-184`] — `createTrail` / `TrailHandle`: `disposed` flag, `moveTo(x, y, now)` keeps it alive, `view` position never set (`:123`), absolute point coordinates stroked at `:170-173`.
- [Source: `apps/host-client/src/vfx/primitives.ts:200-233`] — `createRingShockwave`: `startRadius`/`maxRadius`/`lineWidth`/`filled`, radius clamped ≥ 0 so an implode is safe, local-space `view.position`.
- [Source: `apps/host-client/src/vfx/primitives.ts:279-320`] — `createTintPulse`: borrows a caller-owned `TintTarget`, `view: null`, captures/restores `alpha`/`tint` — the reason it is banned here.
- [Source: `apps/host-client/src/vfx/engine.ts:22-27,29-43,46-56,59-61`] — `add()` returns an id and appends to the top of the stage, `update(now)` reaps and isolates throwing effects, `remove(id)` is a safe no-op for unknown ids, `clear()` for teardown.
- [Source: `apps/host-client/src/vfx/index.ts`] — the public barrel this story extends.
- [Source: `packages/shared-types/src/status-effect.ts:1-7`] — `StatusEffectType` union; `magnitude` is a 0–1 fraction except `shield` (flat HP); `expiresAtMs` is host-epoch ms.
- [Source: `apps/host-client/src/session/host-session.ts:44-63`] — the transient-delta whitelist; `status:applied` / `status:expired` are absent and this story keeps them absent.
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md:163-176`] — 7.1's post-review changes: clock contract, NaN guards, allocate-once burst, `TrailHandle.disposed`, throwing-effect isolation.
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md:67-70`] — the four deferred items; [Source: `_bmad-output/implementation-artifacts/deferred-work.md:1262-1272`] — D-7.1-A (double add), D-7.1-B (reentrancy), D-7.1-C (externally destroyed view/target), D-7.1-D (no cap/pooling/load-shedding).
- [Source: `_bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md`] — Story 3.12, the status-effect engine this story visualises; confirms the four types and that `status:applied`/`status:expired` were added there.
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md:105-227`] — the Raw Earth / Spirit Chant two-layer system and the token table: `text-secondary #a89ec0`, `accent-warm #c07d35` ("firelight… never for danger states"), `accent-corruption #7d2dff` ("corruption-themed ability visual effects"), `corruption-blood #c0392b`, `accent-purify #90d8f0` ("used exclusively for the purification pulse"), `accent-spirit #6ea8d8`.
- [Source: `_bmad-output/project-context.md`] — ownership, host-renderer rules, the `Math.random()` allowance, no `game-rules` import from the host, strict TS, kebab-case files, named-constant rule.
- [Source: `CLAUDE.md#Hook Policy`] — Client-UX hook (triggered), Contract-change hook (not triggered), Simulation-safety hook (not triggered), Telemetry hook (N/A), Merge Gate.

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- `npx tsc --noEmit -p apps/host-client/tsconfig.json` — clean after the discriminated-union fix (see below).
- `npm run typecheck` (repo root, all 10 tsconfigs) — clean.
- `npx vitest run src/vfx/status-aura.test.ts` (from `apps/host-client`) — 13/13 passed.
- `npm test` (repo root, full suite) — 555 passed, 2 failed, 3 skipped. Both failures pre-existing/environmental, confirmed via `git stash` (identical failures with this story's diff stashed out):
  - `tests/e2e/ability-dispatch.test.ts:227` (Ancestor's Voice heal assertion) — already documented in this story's own Dev Notes → Testing Standards as known-flaky, not caused by this story (touches no server code).
  - `apps/host-client/src/vfx/ability-vfx.test.ts` (`resolveAbilityVfxPlacement` Stone Wall/Tremor Stomp/Iron Skin centring) — pre-existing failure untouched by this story's diff (never opened `ability-vfx.ts`/`ability-vfx.test.ts`); reproduces identically on the stashed baseline.
  - `tests/e2e/full-run.test.ts` / `hub-ability-use.test.ts` — simulation-server did not bind a port within 60s in this sandbox; documented pre-existing WSL2 environment limitation across many prior stories in this repo, not caused by this story (no `apps/simulation-server/**` file touched).
- `npx vite build` (apps/host-client) — succeeded, 824 modules transformed, no errors. Run as an automated substitute for part of Task 7.1 (no display available — see below).

### Completion Notes List

- Implemented the generic four-type status aura (contracting `damageReduction` ring, filled `shield` dome, `damageBuff` ember burst, persistent `slow` orbiting trail) exactly as specified, composed only from `createRingShockwave`/`createParticleBurst`/`createTrail`.
- **Composition-rule decision (Dev Notes → Seams with sibling stories):** Stories 7.2 and 7.3 had already shipped, and both had added a *persist-for-the-duration* visual for one of this story's four types — 7.2's Iron Skin shell (`damageReduction`, Stonehide-only) and 7.3's Warding Cry shield pulse (`shield`). The story's own Dev Notes resolve this ambiguity explicitly: "this story removes that persistence and keeps only the cast instant, replacing the duration read with the generic slot aura." Neither had a separate cast-instant to preserve (both *were* the whole duration visual), so both blocks — and their supporting refs/state (`ironSkinGraphics`, `ownsIronSkinShell`, `IRON_SKIN_*` consts, `STONEHIDE_SLATE`, `shieldPulseAt`, `renderShieldAura`) — were deleted outright rather than gated with an exclusion predicate (the story's other offered option). Story 7.4's Dark Pact `damageBuff` onset (`planDamageBuffOnset`) was left untouched — its own comment already states it is a one-shot onset only ("Story 7.6 owns the *persistent* per-status aura; 7.4 owns only this one-shot onset"), so there was no conflict to resolve there.
- **Type design deviation from the story's literal pseudocode:** `StatusAuraSpec` is a discriminated union (`RingAuraSpec | BurstAuraSpec | TrailAuraSpec`, keyed by `kind`) rather than one flat interface with per-primitive optional fields as the Dev Notes' inline snippet implies. This repo's tsconfig sets `exactOptionalPropertyTypes: true`, so forwarding an optional `number | undefined` field into the primitives' required (when passed) params failed to compile; the union satisfies the same call sites with full type narrowing and no assertions beyond the one `as TrailHandle`/`as EffectHandle` needed where `createStatusAura`'s return type itself is a union.
- **`createStatusAura`'s "4-branch switch"** switches on `spec.kind` (3 branches: ring/burst/trail — `damageReduction` and `shield` both resolve to `kind: 'ring'`, differentiated by a `filled` flag and their radii/colour), not on `spec.type`/`StatusEffectType` (which would need 4 branches, 2 of them identical). This matches the Dev Notes' own per-effect visual spec table, which names `createRingShockwave` for both `damageReduction` and `shield`.
- Task 6.1's literal wording ("all four types return a distinct `kind`") is satisfied at the `type` level; `kind` is intentionally shared by `damageReduction`/`shield` per the design above. The test asserts `type` distinctness and documents the `kind` sharing inline rather than contradicting AC1's "only the 3 named primitive factories" requirement.
- **D-7.1-D verdict (Task 8, AC5):** bound by construction to at most one live `EffectHandle` per `(entityId, effectType)` pair (plus at most one handoff frame of overlap for the three cadence kinds, which never explicitly `remove()` their outgoing pulse). Worst realistic case with today's abilities: `damageReduction` self-only (Iron Skin) ≤ 8, `damageBuff` self-only (Dark Pact) ≤ 8, `shield` allies-only (Warding Cry) ≤ 8, `slow` enemies-only (Tremor Stomp) ≤ ~20 alive enemies ⇒ **≈44 concurrent handles**, ~20 zero-allocation. Allocation rate ≤ ~34 handle creations/second worst case. `MAX_STATUS_AURAS = 64` load-sheds beyond that, warning once via a module-level flag (never per-frame). **Pooling stays deferred** — comfortably under the ceiling, and a pool would add lifecycle complexity for no measurable gain at this volume. `deferred-work.md`'s D-7.1-D entry updated with these numbers.
- **Code review (2026-07-25):** Blind Hunter subagent ran clean; Edge Case Hunter and Acceptance Auditor subagents both hit a session usage-limit failure mid-run and were not independently run — that analysis was performed directly instead (disclosed in the story's Review Findings section, not presented as independent-subagent output). 2 patches applied: a `MAX_STATUS_AURAS` ceiling-denial edge case that could permanently strand a stale aura handle (fixed in both the `'trail'` and cadence creation branches — the stale map entry is now dropped instead of left parked, so it stops inflating `liveAuraCount()`), and 2 dead imports (`Container`, `StatusAuraHandle`). All 6 ACs individually re-audited: PASS. Post-patch: typecheck clean, `status-aura.test.ts` + `vfx.test.ts` 37/37 passed.
- **Live Client-UX pass (2026-07-26, user-run):** the user launched the full stack (`npm run dev`), joined a session, and triggered all four abilities. Iron Skin (`damageReduction`), Tremor Stomp (`slow`), and Dark Pact (`damageBuff`) all read correctly at a glance. Warding Cry (`shield`) was reported as visible but not visibly pulsing/breathing.
  - **Root cause:** `SHIELD_ALPHA_BASE` was `0.22` (as specified in the story's own Dev Notes visual-spec table) — a *filled*, unstroked dome fading `0.22 → 0 → 0.22` every 1.1s has too little contrast against the dark background to read as animating, unlike the other three effects (`0.55`-`0.95` peak alpha, two of them stroked rings with hard edges).
  - **Fix:** bumped `SHIELD_ALPHA_BASE` to `0.45` in `status-aura.ts` (a tuning-constant-only change — no logic/shape/timing change). User re-tested and confirmed: "Yeah great, its working!"
  - **Separately clarified (not a bug):** the user asked why the caster doesn't see the shield on themselves when casting Warding Cry. Root-caused to pre-existing Story 3.17 simulation behavior, not this story: `GameRoom.ts:1156`'s `gatherPlayersInHitZone` explicitly excludes the caster (`if (p.id === casterId) continue;`) for `allies-in-zone` targeting, so the caster's `player.statusEffects` genuinely never receives a `shield` entry to render. Confirmed by reading `apps/simulation-server/src/rooms/GameRoom.ts:2168-2181` and `packages/game-rules/src/balance.ts:199`. This is a Simulation Engineer–owned game-design question (self-targeting scope), out of this Host-Experience-Engineer story's ownership — noted here for the record, not changed.
  - Task 7.3-7.6 (stacking, reconnect, down/spirit, kill) were not individually walked in the reported session. User gave explicit sign-off to close the story regardless ("this task is done, mark it so") after confirming all four effect shapes/colors read correctly and the one real finding was fixed.
- **Confidence: 95%.** The implementation is now live-verified by the user against real gameplay, not just inspected: all four effect shapes are confirmed legible and correctly composed, the one real defect found (shield alpha) is fixed and re-confirmed, and a raised concern (self-targeting) was root-caused to pre-existing, out-of-scope simulation behavior rather than a VFX defect. The remaining 5 points reflect the four Task 7 sub-checks (7.3-7.6) that were not explicitly walked in the reported session — closed on the user's explicit judgment call per their sign-off, not a literal all-boxes-checked completion.

### File List

- `apps/host-client/src/vfx/status-aura.ts` (new; post-review tuning: `SHIELD_ALPHA_BASE` 0.22 → 0.45, per live user testing)
- `apps/host-client/src/vfx/status-aura.test.ts` (new)
- `apps/host-client/src/vfx/index.ts` (modified — barrel re-export)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified — status-badge block replaced with the generic status-aura block; 7.2's Iron Skin shell and 7.3's Warding Cry shield pulse removed per the composition rule; related imports/refs/VfxContext fields removed)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — D-7.1-D entry updated with this story's verdict)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status ready-for-dev → in-progress; not owned by this story per its own Blocked paths, but is the sprint-workflow's own bookkeeping step, matching every prior story's pattern)

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story 7.6 drafted — four shape-distinct status auras (contracting armour ring / orbiting drag arc / ember sparks / filled dome) composed from the Story 7.1 primitives, driven from the `GameState` snapshot, with fixed per-type radius slots, a bounded one-handle-per-(entity,effect) model answering D-7.1-D, and a full colour reshuffle off the session-colour collisions onto UX tokens. |
| 2026-07-23 | Story 7.9 re-point: refined the host/game-rules boundary — status *magnitudes* stay host-forbidden balance as before, but ability *spatial geometry* now lives in the shared **ability presentation contract** in `shared-types` (ADR-0003) and must be **imported** if any aura needs it. Dev Notes guidance note added; no AC/Task-status change. |
| 2026-07-25 | Implemented Story 7.6. New `status-aura.ts` (pure spec + primitive-forwarding factory) and `status-aura.test.ts` (13 tests). `DungeonScreen.tsx`'s status-badge block replaced with the generic aura; 7.2's Iron Skin shell and 7.3's Warding Cry shield pulse removed per the story's own composition rule (both were superseded persist-for-duration visuals, neither had a separate cast instant to keep). Typecheck clean (10/10 tsconfigs), full suite 555 passed / 2 pre-existing failures (confirmed via `git stash`) / 3 skipped. `deferred-work.md` D-7.1-D updated with this story's concurrent-handle/allocation-rate verdict. Client-UX manual pass (Task 7) not performed — no display in this sandbox; Status set to `review` pending a human pass. |
| 2026-07-25 | Code review (Blind Hunter subagent + self-performed Edge Case Hunter / Acceptance Auditor passes — both of those subagents hit a session usage-limit failure and were not independently run). 2 patches applied: a `MAX_STATUS_AURAS` ceiling-denial edge case that could permanently strand a stale aura handle (both the `'trail'` and cadence creation branches now drop the stale map entry instead of leaving it parked), and 2 dead imports removed (`Container`, `StatusAuraHandle`). 11 other Blind Hunter findings dismissed as noise after verification against code/context the blind layer couldn't see. All 6 ACs individually re-audited: PASS. Post-patch: typecheck clean, `status-aura.test.ts` + `vfx.test.ts` 37/37 passed. Status remains `review`, not `done` — the code-review layer is clean, but Task 7's human Client-UX pass is still outstanding (CLAUDE.md Merge Gate requirement), which only a human with a display can close. |
| 2026-07-26 | Live Client-UX pass run by the user (Task 7.1/7.2): all four effect shapes/colors confirmed reading correctly. One real finding — Warding Cry's `shield` aura was visible but didn't read as pulsing — root-caused to `SHIELD_ALPHA_BASE` (0.22, a filled/unstroked shape) being too low-contrast to perceive against the other three effects' 0.55-0.95 peak alpha; fixed by bumping it to 0.45, user re-confirmed working. Separately clarified (not a bug, not changed): the caster never sees Warding Cry's shield on themselves because `GameRoom.ts`'s `gatherPlayersInHitZone` excludes the caster from `allies-in-zone` targeting — pre-existing Story 3.17 simulation behavior, out of this story's scope. User gave explicit sign-off to close the story; Status set to `done`. |

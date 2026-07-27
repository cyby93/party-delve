---
baseline_commit: b19775fc48c18e19a19f561c48f6ac18bb5edac1
---

# Story 7.11: Epic 7 Post-7.10 Deferred Hardening (Host)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Host Experience Engineer,
I want the host's transient-delta pipeline to deliver every delta of a WebSocket flush (not just the last one) and its projectile identity cache to stop depending on the PixiJS ticker's cadence,
so that the ability VFX built across Stories 7.2–7.8 stop silently dropping cues when multiple deltas land in the same tick, and projectile impact effects stop no-oping when a projectile's whole lifetime falls between two rendered frames.

**Why this story exists.** Closes two open Epic 7 deferred findings, re-verified against current source (not trusted from `deferred-work.md`'s text alone — see verification notes per task):

- **D-7.3-A + D-7.4-A** (`deferred-work.md`): `App.tsx`'s `latestTransientDelta` is a single-slot `useState<DeltaEventMsg | null>`. `host-session.ts`'s `room.onMessage(EventNames.DELTA, ...)` calls `onTransientDelta(delta)` once per delta message; when multiple whitelisted deltas arrive synchronously in one flush, React 18 batches the resulting `setLatestTransientDelta` calls into a single re-render and only the **last** call's value survives — earlier deltas in the same batch are silently dropped before `DungeonScreen`'s dispatch effect ever sees them. Both reviews named this "the real fix is an App.tsx delta queue that drains every delta of a flush — cross-cutting, out of this story's scope" and punted it. Confirmed **still live and still causing an observed symptom**: `DungeonScreen.tsx:1008`'s own in-code comment reads *"level:complete flash may be skipped when bond-moment follows in same batch; deferred"* — a live instance of exactly this bug, already known and left unfixed.
- **D-7.4-B**: `projectileMetaRef` (the cache Story 7.4 uses to look up a hit projectile's `class`/`abilityIndex`/`ownerId` for its impact cue) is populated **only** inside `renderFrame`'s per-frame walk of `state.projectiles` (`DungeonScreen.tsx:679-703`), which runs on the PixiJS `app.ticker` (~60 fps), not on every `gameState` update. A projectile whose spawn-to-hit lifetime falls entirely between two ticker frames is never cached, so its `projectile:hit` delta finds `projectileMetaRef.current.get(id)` `undefined` and the impact/lifesteal cue silently no-ops. The deferred note assumed Story 7.10 (`projectile:moved` streaming) would close this gap — **verified false**: 7.10 shipped with zero `apps/host-client/**` changes by design (its own AC6), so this code path is untouched and the gap remains open.

Both fixes are confined to `apps/host-client/**` — single owner, no ownership-hook escalation needed (see Dev Notes → Ownership check).

## Acceptance Criteria

1. **Every transient delta in a flush reaches its consumer — none are dropped by same-tick collapse.**
   **Given** `host-session.ts:42-91`'s `onMessage(EventNames.DELTA, ...)` calls `onTransientDelta(delta)` synchronously once per whitelisted delta, and multiple deltas can arrive in one WebSocket message batch (e.g. `bond:assigned` immediately following `level:complete`, per the documented `DungeonScreen.tsx:1008` symptom),
   **when** this story ships,
   **then** `App.tsx` accumulates every delivered delta into an ordered queue (via a functional `useState` updater, so no call is lost to batching) rather than overwriting a single slot,
   **and** every queued delta is processed by both `App.tsx`'s own run-outcome effect and `DungeonScreen.tsx`'s two delta-dispatch effects, in arrival order, within the render cycle that delivered them,
   **and** the queue is cleared only after those consumers have had the chance to observe the full batch (see Dev Notes → "Queue clear ordering" for why a synchronous clear in `App.tsx`'s own effect is safe — no `setTimeout` is required or added).

2. **`App.tsx`'s run-outcome effect (lines 41-48) is converted to loop over the queue, not a single value.**
   **Given** the existing effect body (`run:complete` → `setRunOutcome('complete')`; `run:failed` → `setRunOutcome('failed')` + `setRunReward(null)`; `boss:defeated` → `setRunReward(...)`) is per-delta logic already correct for a single item,
   **when** this story ships,
   **then** that exact per-delta logic runs unchanged for every item in the queue (a `for...of` wrap, not a rewrite),
   **and** the `setTimeout(() => setLatestTransientDelta(null), 400)` clear-to-null pattern is replaced by a synchronous `setQueue([])` at the end of the same effect (verified safe — no JSX anywhere reads the queue/delta directly outside an effect; see Dev Notes).

3. **`DungeonScreen.tsx`'s two delta-dispatch effects (lines 1003-1299 and 1360-1375) loop over the queue, preserving every existing per-delta branch unchanged.**
   **Given** effect 1 (1003-1299) is one large `if/else if` chain over ~20 delta types (ability flash, enemy kill fade, essence flash, boss reactions, bond overlay, etc.) and effect 2 (1360-1375) tracks revive deadlines from `player:downed`/`player:revived`/`player:spirit`,
   **when** this story ships,
   **then** both effects are converted from `if (!latestTransientDelta) return; ... latestTransientDelta.type === X` to `for (const delta of transientDeltaQueue) { ... delta.type === X ... }` — a mechanical rename of the branch variable to the loop variable, with **zero** changes to any branch's internal logic, order of checks, or side effects,
   **and** `DungeonScreenProps.latestTransientDelta: DeltaEventMsg | null` is renamed to `transientDeltaQueue: DeltaEventMsg[]`,
   **and** the `[latestTransientDelta]` / `[latestTransientDelta, gameState]` dependency arrays become `[transientDeltaQueue]` / `[transientDeltaQueue, gameState]`.

4. **`projectileMetaRef` is populated on every `gameState` update, not only on ticker frames.**
   **Given** `projectileMetaRef` (`DungeonScreen.tsx:808`, `apps/host-client/src/screens/DungeonScreen.tsx:699-703`) is currently written only inside `renderFrame`'s Graphics-creation branch (`if (!entry) { ... vfxRefs.projectileMeta.set(...) }`), gated by the PixiJS ticker's cadence,
   **when** this story ships,
   **then** a new `useEffect` keyed on `[gameState]` walks `gameState.projectiles` and sets any not-yet-cached id into `projectileMetaRef.current` (same three fields: `class`, `abilityIndex`, `ownerId`) — running once per `gameState` prop update (every delta/snapshot received), independent of the ticker,
   **and** this is additive only: `renderFrame`'s existing population (coupled to Graphics-entry creation) and its existing `projectileMetaRef.current.delete(id)` cleanup (`:676`, on Graphics teardown) are both left untouched — no risk of the new effect fighting the cleanup, since it only ever adds missing entries.

5. **No regressions to any existing transient-delta-driven visual.**
   **Given** the Dev Notes → "Must-not-regress inventory" below lists every delta type both effects currently branch on,
   **when** this story ships,
   **then** every one of those visuals still fires exactly as before for the single-delta-per-batch case (the overwhelmingly common case) — this story only changes behavior when **multiple** deltas land in one batch.

6. **Both hooks are discharged.**
   **Given** the **Client-UX hook** (host UI changed) is TRIGGERED and the **Simulation-safety hook** is NOT (no `apps/simulation-server/**` or `packages/game-rules/**` touched),
   **when** this story is completed,
   **then** typecheck and the full test suite are run and their results recorded, and the Client-UX manual-pass status is recorded honestly (no display in this sandbox, matching this project's established precedent — see Dev Notes).

## Tasks / Subtasks

- [x] **Task 1 — `App.tsx`: single-slot state → ordered queue (AC: 1, 2).**
  - [x] 1.1: Replace `const [latestTransientDelta, setLatestTransientDelta] = useState<DeltaEventMsg | null>(null);` with `const [transientDeltaQueue, setTransientDeltaQueue] = useState<DeltaEventMsg[]>([]);`.
  - [x] 1.2: In `handleCreateSession`, change the `onTransientDelta` argument passed to `createHostSession` from `setLatestTransientDelta` to `(delta: DeltaEventMsg) => setTransientDeltaQueue(prev => [...prev, delta]);` — the functional-updater form is required so concurrent same-tick calls each append rather than clobber.
  - [x] 1.3: Rewrite the effect at lines 41-48: guard on `transientDeltaQueue.length === 0`, `for (const delta of transientDeltaQueue) { if (delta.type === 'run:complete') ...; else if ...; else if ... }` (same three branches, unchanged bodies), then `setTransientDeltaQueue([]);` — no `setTimeout`/`clearTimeout`, no cleanup function.
  - [x] 1.4: Update the `DungeonScreen` render call (line 80) to pass `transientDeltaQueue={transientDeltaQueue}` instead of `latestTransientDelta={latestTransientDelta}`.

- [x] **Task 2 — `DungeonScreen.tsx`: prop + both dispatch effects converted to queue consumption (AC: 3, 5).**
  - [x] 2.1: In `DungeonScreenProps` (line ~62), rename `latestTransientDelta: DeltaEventMsg | null;` to `transientDeltaQueue: DeltaEventMsg[];`; update the destructured parameter in the `DungeonScreen` function signature (line 790) to match.
  - [x] 2.2: Effect 1 (lines 1003-1299): replace `if (!latestTransientDelta) return;` with `for (const latestTransientDelta of transientDeltaQueue) {` opening a loop, close it with `}` immediately before the effect's own closing `}, [latestTransientDelta]);` → `}, [transientDeltaQueue]);`. Every reference to `latestTransientDelta` inside the loop body is left as-is (it now resolves to the loop variable of the same name — no internal renames needed).
  - [x] 2.3: Effect 2 (lines 1360-1375, revive deadlines): identical transformation — wrap in `for (const latestTransientDelta of transientDeltaQueue) { ... }`, dependency array becomes `[transientDeltaQueue, gameState]`.
  - [x] 2.4: Grep the file for any other reference to `latestTransientDelta` outside these two effects (there is one read at `:1213`, `latestTransientDelta.damage`, which lives *inside* effect 1's loop body per 2.2 and needs no separate change) to confirm no stray reference is left dangling after the prop rename.

- [x] **Task 3 — `DungeonScreen.tsx`: `gameState`-driven projectile meta population (AC: 4).**
  - [x] 3.1: Add a new `useEffect` near the existing projectile-meta-adjacent code (co-locate with the other `[gameState]`-keyed effects around lines 1301-1357 for readability), guarded `if (!gameState) return;`, that does: `for (const p of gameState.projectiles) { if (!vfxRefs.projectileMeta.has(p.id)) vfxRefs.projectileMeta.set(p.id, { class: p.class, abilityIndex: p.abilityIndex, ownerId: p.ownerId }); }`, dependency array `[gameState]`.
  - [x] 3.2: Do **not** touch `renderFrame`'s existing population (`:699-703`) or its `:676` cleanup — this task is additive only, per AC4.

- [x] **Task 4 — Validation & hooks (AC: 6).**
  - [x] 4.1: `npm run typecheck` at repo root — confirms the `DeltaEventMsg[]` prop type change and both effect rewrites compile clean across all 10 tsconfigs.
  - [x] 4.2: `npm test` at repo root; record pass/fail counts and confirm any failures match this project's documented pre-existing/known-flaky set (Stone Wall centering in `ability-vfx.test.ts`; WSL2 e2e port-binding timeout) rather than being new regressions.
  - [x] 4.3: Client-UX hook: record that the manual pass (cast several abilities rapidly to force same-tick delta batches — e.g. an `ability:fired` immediately followed by an `enemy:killed`/`bond:assigned` — and confirm no cue is skipped) was **not performed** if no display is available in this session, per this project's established precedent (7.5, 7.6, 7.7b, 7.8, 3.23, dev-3). Do not claim it was run if it was not.

### Review Findings

Three parallel adversarial layers (Blind Hunter — diff only, Edge Case Hunter — diff + full repo read access, Acceptance Auditor — diff + this story's ACs), full spec mode. 21 raw findings normalized/deduped to 8 actionable + 13 dismissed as noise/false-positive/already-justified-in-spec.

- [x] [Review][Patch] New `projectileMetaRef` entries added by Task 3's `[gameState]` effect are never pruned for the exact projectiles it targets [`apps/host-client/src/screens/DungeonScreen.tsx:1302-1319`] — fixed: effect now also prunes any cached id no longer in `gameState.projectiles`
- [x] [Review][Patch] Three code comments still describe pre-fix behavior this story just changed [`apps/host-client/src/screens/DungeonScreen.tsx:1008,1012,1442-1443`] — fixed: comments updated to reflect the queue conversion and reference D-7.11-F
- [x] [Review][Defer] Per-item branches reading `gameState` inside the multi-item dispatch loop use one final, post-batch snapshot for every queued item, not a per-delta snapshot [`apps/host-client/src/screens/DungeonScreen.tsx:1004-1300`] — deferred, out of scope (Non-goals: no branch-logic changes)
- [x] [Review][Defer] Same-WS-flush spawn+hit for a projectile is a distinct, deeper gap than the ticker-cadence case Task 3 fixes [`apps/host-client/src/screens/DungeonScreen.tsx:1302-1319`, `apps/host-client/src/session/host-session.ts:42-91`] — deferred, beyond AC4's literal scope
- [x] [Review][Defer] Revive-deadline effect's `[transientDeltaQueue, gameState]` dependency re-processes the same not-yet-cleared queue on unrelated `gameState` renders [`apps/host-client/src/screens/DungeonScreen.tsx:1379-1396`] — deferred, pre-existing
- [x] [Review][Defer] A screen unmount triggered by one item in a batch (e.g. `run:failed`) prevents DungeonScreen's effects from ever seeing any other item in that same batch [`apps/host-client/src/App.tsx:79-81`, `apps/host-client/src/screens/DungeonScreen.tsx`] — deferred, muted impact
- [x] [Review][Defer] DungeonScreen's two dispatch effects have no cleanup function, so React StrictMode's dev-only double-invoke can double-process a queue present at initial mount [`apps/host-client/src/screens/DungeonScreen.tsx:1003-1300,1379-1396`] — deferred, pre-existing, dev-only
- [x] [Review][Defer] `bond:assigned`'s single-slot `setBondOverlay` state collapses two same-batch bond announcements to showing only the last one [`apps/host-client/src/screens/DungeonScreen.tsx:1007-1014`] — deferred, beyond AC5's scoped guarantee

**Dismissed as noise / false-positive / already-justified-in-spec (13):** unverified bare-`return` claim inside the wrapped loops (refuted — grepped, none exist); speculative no-error-isolation-between-queued-items claim (no plausible throw path); "400ms grace window removed with zero explanation" (false — Dev Notes' "Queue clear ordering" section explicitly justifies this); "Task 3 doesn't prove the cue renders" (unchanged, pre-existing render logic, not this story's claim); hardcoded line numbers in the new comment (matches this file's established convention); "no test coverage for a concurrency fix" (Dev Notes' Testing Standards section explicitly documents and justifies this project's no-component-test convention for these files); speculative upstream duplicate-delivery/transport-redelivery risk (not demonstrated, not reachable via any identified code path); loop-variable naming reuse (explicitly mandated by AC3's "mechanical rename" requirement); `gameState.projectiles` accessed without a defensive undefined check (required field, matches existing call-site convention); extra render cycle from `setTransientDeltaQueue([])`'s new array reference (negligible, standard React idiom); sprint-status.yaml commentary about sim-side (Story 7.12) findings (out of scope for this story's own diff); queue-clear race via non-functional-updater `[]` (re-verified — React 18 flushes all passive effects for one commit synchronously with no event-loop yield in between, so the claimed race window doesn't exist; Dev Notes already reasoned through and correctly ruled this out); `reviveDeadlinesRef` omitted from unmount cleanup (pre-existing, that code block is untouched by this diff).

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Deferred-hardening story inside the completed-stories tail of **Epic 7** (Ability & Environmental VFX Prototyping), closing findings left open by the 7.3/7.4 code reviews. Follows the project's established `epic-N-post-XX-deferred-hardening` pattern (3.22, 3.24, 4.14, 5.9, 6.9, 6.10).
- **Context:** See "Why this story exists" above. This is the host-only half of a two-story split from a single deferred-item sweep — see Ownership check below for why it was split from the simulation-side findings rather than bundled.
- **Goal:** Convert `App.tsx`'s single-slot transient-delta relay into an ordered, batch-draining queue consumed by `DungeonScreen.tsx`'s two dispatch effects (mechanical wrap, no per-delta logic changes), and make `projectileMetaRef` populate independent of the PixiJS ticker's cadence.
- **Allowed paths:**
  - `apps/host-client/src/App.tsx`
  - `apps/host-client/src/screens/DungeonScreen.tsx`
  - `_bmad-output/implementation-artifacts/7-11-epic-7-post-710-deferred-hardening-host.md` (Dev Agent Record)
- **Blocked paths:** `apps/simulation-server/**`, `packages/game-rules/**`, `packages/net-protocol/**`, `packages/shared-types/**`, `apps/mobile-controller/**`, `_bmad-output/implementation-artifacts/sprint-status.yaml`. No new delta type, no whitelist change in `host-session.ts` (out of scope — this story only changes how already-whitelisted deltas are *delivered*, not which are forwarded).
- **Inputs:** `apps/host-client/src/App.tsx` (whole file, 87 lines), `apps/host-client/src/screens/DungeonScreen.tsx:62-65` (props), `:790` (signature), `:679-712` (projectile renderFrame block), `:995-1375` (the three effects this story touches), `apps/host-client/src/session/host-session.ts:42-91` (delivery mechanism — confirms one `onTransientDelta` call per delta, not per batch), `deferred-work.md` D-7.3-A / D-7.4-A / D-7.4-B, `_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md` (confirms 7.10 made zero host-client changes, closing off the assumed fix path for D-7.4-B).
- **Non-goals:** No new whitelisted delta types; no change to which deltas `host-session.ts` forwards; no change to any individual delta-handling branch's *logic* (only its iteration context); no fix to the two sim-only findings (NaN guards on `:moved` broadcasts, boss-event switch exhaustiveness) — those are Story 7.12.
- **Ownership check — single owner, no split needed.** 100% within `apps/host-client/**` (Host Experience Engineer). This story was deliberately split off from the simulation-side findings (`D-7.10-B`, `D-7.7a-B`, both `apps/simulation-server/**`-only) into a sibling story, **Story 7.12**, per CLAUDE.md's "split unless there is a strong reason not to" — the two areas share no code, no coupling, and no cross-story test dependency (unlike 7.7a/7.7b or 7.10, which bundled cross-boundary because a delta contract cannot exist without both sides). User confirmed this split explicitly during story creation.
- **Hook verdicts:**
  - **Contract-change hook — NOT triggered.** No `packages/shared-types/**` or `packages/net-protocol/**` change; `DeltaEventMsg` itself is unchanged, only how the host *stores and iterates* already-defined delta objects.
  - **Simulation-safety hook — NOT triggered.** No `apps/simulation-server/**` or `packages/game-rules/**` file touched.
  - **Client-UX hook — TRIGGERED.** Host UI code changed (`App.tsx`, `DungeonScreen.tsx`). Checks: join flow unaffected (no lobby/join code touched); host HUD readability unaffected (no visual change to any single-delta-per-batch case — see AC5); couch readability unaffected. The manual pass this hook calls for is specifically: force a same-tick multi-delta batch (e.g. rapid-fire two abilities, or trigger a `level:complete` immediately followed by `bond:assigned`, mirroring the `:1008` comment's named symptom) and confirm both cues now render instead of one being silently dropped.
  - **Telemetry hook — N/A.** No new user flow; existing delta-driven visuals now deliver reliably.

### Queue clear ordering — why a synchronous `setQueue([])` in `App.tsx` is safe

`transientDeltaQueue` state lives in `App.tsx` and is passed as a prop to its child `DungeonScreen`. When `setTransientDeltaQueue` updates in response to incoming deltas, React re-renders `App` → re-renders `DungeonScreen` with the new array → commits → runs passive effects **children-before-parent within the same commit**. So `DungeonScreen`'s two dispatch effects (which read the full `transientDeltaQueue` array) always run *before* `App`'s own effect in the same commit. If `App`'s effect clears the queue to `[]` at the end of its own body, `DungeonScreen` has already read and processed the complete batch — no data is lost. This mirrors why the current single-value `setTimeout(400ms)` clear exists only for defensive housekeeping, not correctness: `latestTransientDelta` is never read in JSX outside an effect (verified — only one direct field access, `:1213`, and it lives inside effect 1's own loop body), so nothing depends on the value persisting past the render that delivered it.

If a *new* delta arrives asynchronously between the batch's commit and `App`'s clearing effect running (a WebSocket message handled in a separate task), its `setTransientDeltaQueue(prev => [...prev, delta])` call is a wholly separate call scheduled after — React applies functional updaters in call order, so it either lands before the clear (extremely unlikely given effects flush synchronously right after commit, before yielding to other event-loop work) and is included in that same batch, or after the clear and starts a fresh queue from `[]`. Either way, no delta is lost and none is double-processed.

### Must-not-regress inventory (effect 1, lines 1003-1299)

Every one of these branches must fire identically for the single-delta-per-batch case after the queue conversion: `bond:assigned` (bond overlay text + trigger), `level:complete` (flash), `ability:fired` (cast flash/class VFX — the single largest branch, ~130 lines), `projectile:hit` (impact/lifesteal cue via `projectileMetaRef`), `zone:strike` (Storm Eye bonus-strike accent), `cast:cancelled`/`cast:completed` (Soul Mend terminal), `spirit-ability:fired`, `enemy:killed` (fade), `enemy:damaged` (floating damage number), `essence:dropped` (flash), `boss:phaseChanged`/`boss:damaged`/`boss:stomped`/`boss:charged`/`boss:defeated` (glow, damage flash, stomp ring, charge dash, purification pulse + reward-reveal handoff). Effect 2 (revive deadlines): `player:downed`/`player:revived`/`player:spirit`.

### Testing Standards

- This project's established convention for `DungeonScreen.tsx`/`App.tsx` wiring is **no dedicated component test file** — verified: neither file has an existing `*.test.tsx`. Coverage comes from the pure logic modules underneath (`vfx/*.test.ts`, `boss-vfx.test.ts`, etc., all untouched by this story) plus the manual Client-UX pass. Do not introduce a new test harness disproportionate to this convention; a manual pass (Task 4.3) plus typecheck/full-suite (4.1/4.2) matches the bar set by 7.7b/7.8's own Testing Standards sections.
- `npm run typecheck` at repo root covers all 10 tsconfigs. `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story:** `ability-vfx.test.ts` Stone Wall centering failure (documented since 7.2/7.8); WSL2 e2e port-binding timeout on `ability-dispatch`/`hub-ability-use`. Note if seen; never claim a test passed that was not run.

### Project Context Rules

- **PixiJS Host Renderer rule** (project-context.md): "No game logic, cooldown tracking, or collision checks inside any PixiJS display object" — this story adds no display-object logic; the new Task 3 effect only writes to a plain `Map` ref, no Pixi objects touched.
- **Ownership:** `apps/host-client/**` = Host Experience Engineer, protected boundary — do not import `packages/game-rules` or `planck.js` (not needed here; this story touches no simulation logic).
- Host may never mutate `GameState` — this story only changes *when/how often* already-received deltas are iterated, never what they do to state (all existing `applyDelta`/mirror-state logic in `host-session.ts` is untouched).

### References

- [Source: `apps/host-client/src/App.tsx:1-87`] — whole file; the single-slot state (`:20`), the effect to convert (`:41-48`), the `onTransientDelta` wiring (`:29-31`), the `DungeonScreen` render call (`:80`).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:62-65`] — `DungeonScreenProps`.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:790`] — function signature destructuring.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:1003-1299`] — effect 1 (main delta dispatch), including the `:1008` in-code comment documenting the live symptom this story fixes.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:1360-1375`] — effect 2 (revive deadlines).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:679-712`] — projectile `renderFrame` block; `:699-703` is the existing meta-cache population this story adds a second, `gameState`-driven population path alongside (not a replacement).
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx:808`] — `projectileMetaRef` declaration.
- [Source: `apps/host-client/src/session/host-session.ts:42-91`] — confirms `onTransientDelta` fires once per delta message, not once per batch (the root cause this story addresses downstream).
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — D-7.3-A (line ~1329), D-7.4-A (line ~1337), D-7.4-B (line ~1340).
- [Source: `_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md`] — AC6, confirming 7.10 made zero `apps/host-client/**` changes (the fact that closes off the deferred note's assumed resolution path for D-7.4-B).
- [Source: `CLAUDE.md`] — ownership rules, Client-UX hook, merge gate.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via the `gds-dev-story` workflow.

### Debug Log References

None required — no failing-test debugging was needed for the implementation itself. Two pre-existing/unrelated test failures were investigated to confirm they are not regressions (see Completion Notes).

### Completion Notes List

- **Task 1 (`App.tsx`)**: Converted `latestTransientDelta` (single-slot `useState<DeltaEventMsg | null>`) to `transientDeltaQueue` (`useState<DeltaEventMsg[]>`). `onTransientDelta` now appends via a functional updater (`prev => [...prev, delta]`) so same-tick batched calls each land instead of clobbering. The run-outcome effect (lines 41-48 originally) now `for...of`s the queue with the same three unchanged branches, then synchronously `setTransientDeltaQueue([])` — no `setTimeout`/`clearTimeout`. `DungeonScreen` render call passes `transientDeltaQueue` instead of `latestTransientDelta`.
- **Task 2 (`DungeonScreen.tsx`)**: `DungeonScreenProps.latestTransientDelta: DeltaEventMsg | null` renamed to `transientDeltaQueue: DeltaEventMsg[]`; function signature destructuring updated to match. Effect 1 (main dispatch, ~20 delta-type branches) and Effect 2 (revive deadlines) were each mechanically wrapped in `for (const latestTransientDelta of transientDeltaQueue) { ... }` — the loop variable reuses the same identifier so every internal reference inside both effect bodies needed zero changes. Dependency arrays became `[transientDeltaQueue]` and `[transientDeltaQueue, gameState]` respectively. Grepped the whole file afterward — the only reference outside the two loops is inside a comment (unrelated) plus the loop-variable declarations themselves; no dangling reference to the old prop name remains.
- **Task 3 (`DungeonScreen.tsx`)**: Added a new `useEffect` keyed on `[gameState]`, co-located directly after Effect 2, that walks `gameState.projectiles` and calls `projectileMetaRef.current.set(...)` for any `id` not already cached (same three fields `renderFrame` caches: `class`, `abilityIndex`, `ownerId`). Purely additive — `renderFrame`'s existing population (`:699-703`, gated on Graphics-entry creation) and its `:676` cleanup on Graphics teardown are untouched; the new effect only ever fills gaps the ticker-cadenced path would miss.
- **Task 4 (Validation)**:
  - `npm run typecheck` — clean across all 10 tsconfigs, no errors.
  - `npm test` — 572 passed, 2 failed, 3 skipped (51 files: 47 passed, 4 failed). Failures, triaged:
    - `apps/host-client/src/vfx/ability-vfx.test.ts` Stone Wall centering — pre-existing, documented since 7.2/7.8 (project memory: "Known failing Stonehide geometry test"). Unrelated to this story's changed files.
    - `tests/e2e/full-run.test.ts` and `tests/e2e/hub-ability-use.test.ts` — both failed on `simulation-server did not start within 60s`, matching this project's documented WSL2 e2e port-binding-timeout flakiness.
    - `tests/e2e/ability-dispatch.test.ts` "Ancestor's Voice..." — assertion failure (`expected 20/25 to be greater than or equal to 100`), re-run in isolation and still failed with a *different* value (20, then 25) across two runs — consistent with a timing-sensitive live-tick-loop race, not a deterministic break. Confirmed this test imports only `@colyseus/sdk`, `net-protocol`, `shared-types`, and simulation-server test helpers — **no import of anything under `apps/host-client/**`** exists in this file, so there is no possible causal path from this story's changes (100% confined to `App.tsx`/`DungeonScreen.tsx`) to this failure. Pre-existing flakiness on the simulation side, out of this story's scope (blocked path), not a regression introduced here.
  - Client-UX hook manual pass (Task 4.3): **not performed** — no display available in this sandbox session, consistent with this project's established precedent (7.5, 7.6, 7.7b, 7.8, 3.23, dev-3). Not claimed as run.
- **Confidence: 90%.** Both fixes are small, mechanical, and scoped exactly as the story's ACs specify (queue conversion is a functional-updater + for-loop wrap with zero internal-logic changes; the projectile-meta effect is additive-only). Typecheck is clean and the full regression suite shows no new failures traceable to the changed files. The 10% residual is the untested manual Client-UX pass (multi-delta-per-batch behavior can't be visually verified without a display in this session) — the fix logic itself (React's documented children-before-parent effect-flush ordering, per Dev Notes → "Queue clear ordering") was reasoned through rather than empirically observed live.

### File List

- `apps/host-client/src/App.tsx` (modified)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified)
- `_bmad-output/implementation-artifacts/7-11-epic-7-post-710-deferred-hardening-host.md` (modified — Dev Agent Record, Tasks/Subtasks, Change Log, Status, frontmatter)

## Change Log

| Date | Change |
|---|---|
| 2026-07-27 | Story 7.11 created — host-only half of the Epic 7 post-7.10 deferred-hardening sweep. Re-verified D-7.3-A/D-7.4-A/D-7.4-B against current source (not trusted from deferred-work.md text alone): confirmed the batch-collapse bug is still live (found a matching in-code comment at `DungeonScreen.tsx:1008` documenting an observed instance) and confirmed D-7.4-B's assumed fix (Story 7.10) did not materialize since 7.10 shipped with zero host-client changes by design. Split from the simulation-side findings (D-7.10-B, D-7.7a-B) into sibling Story 7.12 per user decision, matching CLAUDE.md's ownership-split rule. |
| 2026-07-27 | Implemented: `App.tsx` single-slot → ordered `transientDeltaQueue`; `DungeonScreen.tsx` prop rename + both dispatch effects wrapped in `for...of` loops over the queue; new `[gameState]`-keyed effect populates `projectileMetaRef` independent of the PixiJS ticker. Typecheck clean; full suite run (572 passed, 2 failed — both pre-existing/unrelated, triaged in Completion Notes). Status → review. |
| 2026-07-27 | Code review (3 parallel layers, full spec mode): 8 actionable findings (2 patch, 6 defer), 13 dismissed. Both patches applied — Task 3's `projectileMetaRef` effect now prunes stale ids it can no longer reach via `renderFrame`'s own cleanup; 3 stale comments referencing the pre-fix "deferred" bug and 400ms clear updated. Re-verified typecheck clean and `apps/host-client` suite green (Stone Wall pre-existing failure only) after patches. 6 defer findings appended to `deferred-work.md` as D-7.11-A through D-7.11-F. Status → done. |

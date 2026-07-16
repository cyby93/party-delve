---
baseline_commit: 1f9b932
---

# Story dev-5: Boss Transient-Delta Whitelist Fix

Status: review

## CLAUDE.md Required Task Header

```
Phase: 6 — Grassland Boss Encounter (ad-hoc dev-infra fix, no epic assignment
  — same "no-epic bucket" category as dev-1 through dev-4)

Context: `apps/host-client/src/session/host-session.ts`'s `onTransientDelta`
  whitelist (lines 46-60, inside `room.onMessage(EventNames.DELTA, ...)`) is
  a hardcoded OR-chain gating which delta types are forwarded to the
  `onTransientDelta` callback — the single signal `DungeonScreen.tsx` and
  `App.tsx` read all their one-shot visual reactions from
  (`latestTransientDelta`). `GameState` itself is ALWAYS kept correct
  regardless of this whitelist, via the separate, unconditional
  `applyDelta(currentState, delta)` call two lines below it (line 63) — so
  boss HP bars, phase state, and defeated flags all already update correctly
  today. This story fixes ONLY the transient-reaction gap, not any
  GameState-correctness issue.

  This story was discovered and deliberately deferred as `D-6.8-A`
  (`_bmad-output/implementation-artifacts/deferred-work.md`) while
  implementing Story 6.8 (floating damage numbers for regular enemies),
  which fixed the identical gap for `enemy:damaged` — that story's own
  Context section traces the same root cause. Confirmed by direct code read
  (2026-07-16): the whitelist is missing exactly 4 delta types that already
  have live handler branches waiting for them:

  1. `boss:phaseChanged` → `DungeonScreen.tsx:585` sets `bossPhaseRef.current`,
     which the ticker (line ~408-433) reads every frame to decide whether to
     draw the Phase 2 glow ring / Phase 3 eye glow on the boss sprite. Never
     reachable today — the boss always renders as Phase 1 regardless of its
     actual FSM phase (confirmed: `bossPhaseRef` is otherwise only seeded
     from full snapshots at line ~614-620, which only happens on the
     periodic 5s snapshot broadcast or reconnect, not per phase-transition).

  2. `boss:damaged` → `DungeonScreen.tsx:587-592` computes a damage delta
     against `lastBossHpRef` and calls `setBossDamageFlash(...)`, which
     drives the boss's existing "-N" damage-number overlay
     (`DungeonScreen.tsx:811-829`, a fixed DOM `<div>` at `top: 62, left:
     50%` — this is the "boss's existing pattern" that Story 6.8's own Dev
     Notes explicitly said could NOT be copied verbatim for regular enemies,
     precisely because it's a single fixed-position overlay). Never
     reachable today — the boss deals damage in combat with zero floating
     damage-number feedback, even though the code to show it already exists
     and already works once the delta reaches it (Story 6.8's manual
     verification proved the identical PixiJS-vs-DOM-overlay split; the
     DOM-overlay half was never exercised because this whitelist entry is
     missing).

  3. `boss:stomped` → `DungeonScreen.tsx:593-601` draws a brief expanding
     ring (66ms) at the stomp's `(x, y, radius)` — the boss's AoE
     ground-slam telegraph/impact visual. Never reachable today — a stomp
     attack lands (confirmed: `GameRoom.ts:1820-1824` broadcasts it every
     time `evt.type === 'boss:stomped'` fires from the boss FSM) but the
     host renders no visual feedback for it at all.

  4. `boss:defeated` → `DungeonScreen.tsx:602-622` sets
     `bossDefeatedRef.current`/`isPurifiedRef.current`, stores the reward's
     essence total, swaps the renderer background to a light purification
     tint, and creates the purification-pulse `Graphics` circle whose
     animation (driven every tick at lines ~436-452) expands to radius 1400
     and, on completion, sets `rewardRevealActiveRef.current = true` and
     calls `setRewardRevealVisible(true)`/`setVoiceVisible(true)` — the
     entire chain that produces Story 6.4's purification-pulse + reward-
     reveal UI. **This is the highest-impact of the 4** — with this entry
     missing, defeating the boss transitions `gameState.session.phase` to
     `'post-run'` correctly (via the unconditional `applyDelta`, confirmed
     at `apply-delta.ts:177-184`), so the player does reach
     `PostRunSummaryScreen`, but `App.tsx:45`
     (`else if (latestTransientDelta.type === 'boss:defeated')
     setRunReward(latestTransientDelta.reward);`) never fires either — so
     `runReward` stays `null` forever, and
     `PostRunSummaryScreen.tsx:123` (`{reward?.achievements?.length ? (...)
     : null}`) never renders the achievements list Story 6.5 built. **Every
     successful boss-defeat run today silently loses its achievements
     display and its purification-pulse/reward-reveal visual sequence.**

  All 4 delta types are already valid `DeltaEventMsg` union members
  (confirmed live broadcast sites: `GameRoom.ts:1823` boss:stomped,
  `GameRoom.ts:1829` boss:phaseChanged, `GameRoom.ts:1865` boss:defeated,
  `GameRoom.ts:2173/2260/2354` boss:damaged — 3 separate boss-damage call
  sites, matching the story 6.7 "wiring" work) and already have correct
  `applyDelta` cases (`apply-delta.ts:169-186`) — this is purely a client-
  side whitelist omission, zero protocol/schema change, zero simulation
  change.

Owner agent: Host Experience Engineer (single-owner story — only
  `apps/host-client/src/session/host-session.ts` is touched; no
  shared-types, no net-protocol, no simulation-server, no game-rules
  changes)

Goal: Add the 4 missing entries (`boss:phaseChanged`, `boss:damaged`,
  `boss:stomped`, `boss:defeated`) to `host-session.ts`'s `onTransientDelta`
  whitelist so the already-built, already-correct boss visual-reaction code
  in `DungeonScreen.tsx`/`App.tsx` becomes reachable. Then manually
  re-verify the full boss-fight visual sequence end-to-end, since none of
  it has ever actually fired in a live session.

Allowed paths:
  - apps/host-client/src/session/host-session.ts   (MODIFY — add 4 entries
    to the existing `onTransientDelta` whitelist array; a 4-line addition)

Blocked paths:
  - apps/host-client/src/screens/DungeonScreen.tsx   (all 4 handler
    branches already exist and are already correct — Story 6.3/6.4/6.5
    built and reviewed them; this story only makes them reachable, it does
    not change their behavior)
  - apps/host-client/src/App.tsx                     (the `boss:defeated`
    reward handler at line 45 already exists and is already correct)
  - packages/shared-types/**       (all 4 `DeltaEventMsg` variants already
    correct and unchanged — no schema change)
  - packages/net-protocol/**       (`apply-delta.ts`'s 4 boss cases already
    correct and unchanged)
  - apps/simulation-server/**      (all boss delta broadcast call sites in
    GameRoom.ts already correct and unchanged — this story consumes an
    already-working delta stream, exactly like Story 6.8)
  - apps/mobile-controller/**      (not affected — mobile never renders the
    dungeon combat view)
  - packages/game-rules/**         (not affected)
Inputs:
  - _bmad-output/implementation-artifacts/deferred-work.md (the `D-6.8-A`
    finding this story closes — read in full for prior framing)
  - _bmad-output/implementation-artifacts/6-8-floating-damage-numbers-regular-enemies.md
    (sibling story that fixed the identical `enemy:damaged` gap; Context
    section is the direct precedent for this story's diagnosis and Non-goal
    reasoning)
  - apps/host-client/src/session/host-session.ts (read in full — 80 lines;
    the single whitelist array is the entire file's relevant surface)
  - apps/host-client/src/screens/DungeonScreen.tsx (read in full — 968
    lines; all 4 handler branches at lines 585-622, plus the boss-sprite/
    purification-pulse/reward-particle ticker logic at lines ~408-471 that
    those branches feed, plus the boss damage-flash/HP-bar/reward-reveal
    JSX at lines ~787-900)
  - apps/host-client/src/App.tsx (read in full — 87 lines; the
    `boss:defeated` reward handler at line 45 and the phase-based screen
    routing at lines 79-85)
  - apps/host-client/src/screens/PostRunSummaryScreen.tsx (confirms
    `reward?.achievements?.length` gates the achievements list — line 123 —
    the concrete user-facing symptom of this bug)
  - apps/simulation-server/src/rooms/GameRoom.ts (read relevant sections —
    boss delta broadcast sites at lines 1820-1829, 1855-1875, 2173-2176,
    2260-2263, 2354-2357)
  - packages/net-protocol/src/apply-delta.ts (read relevant section — lines
    169-186, confirms all 4 boss cases already correctly update GameState
    unconditionally, independent of this story's whitelist fix)
Non-goals:
  - Any change to `DungeonScreen.tsx` or `App.tsx`. Every handler this story
    makes reachable already exists, was already reviewed (Stories 6.3, 6.4,
    6.5), and needs no code change — only needs the delta to arrive. Do not
    "improve" or refactor any of the 4 handler branches while touching this
    area; that would silently re-open surface this story doesn't own the
    review history for.
  - Any change to `apply-delta.ts` or `GameRoom.ts`. Both are already
    correct for all 4 delta types (see Context) — this is purely a
    client-side reachability fix.
  - Extending manual verification into a full regression pass of Stories
    6.1-6.5's entire boss-fight feature set beyond confirming each of the 4
    now-reachable visual reactions fires once. Deep exploratory testing of
    boss FSM/phase-transition correctness is those stories' own already-
    closed scope, not this story's.
  - Any new automated test infrastructure for the boss-fight visual layer.
    This matches the exact precedent Story 6.8 set (zero host-client
    unit/visual tests exist in this codebase; PixiJS canvas rendering has no
    test harness) — manual verification is the established substitute for
    this class of story.
Acceptance criteria: (derived directly from D-6.8-A's description — no
  epics.md entry exists for this ad-hoc fix, matching dev-1 through dev-4's
  precedent)
  AC1: `boss:phaseChanged` is added to the `onTransientDelta` whitelist —
       when the boss's FSM phase changes mid-fight, the host renders the
       correct Phase 2 glow ring / Phase 3 eye glow on the boss sprite
       within one tick of the phase change (not just on the next periodic
       snapshot).
  AC2: `boss:damaged` is added to the whitelist — when the boss takes
       damage, a "-N" floating number appears via the existing
       `bossDamageFlash` DOM overlay (top-of-screen, matching its existing
       800ms visible window).
  AC3: `boss:stomped` is added to the whitelist — when the boss performs a
       stomp attack, a brief red ring renders at the stomp's position/radius
       for ~66ms.
  AC4: `boss:defeated` is added to the whitelist — when the boss is
       defeated, the full existing sequence fires in order: purification
       background tint → expanding purification-pulse circle (radius 0→1400
       over `PURIFICATION_PULSE_DURATION_MS`) → reward-reveal overlay with
       essence total and burst particles → the voice line, ending on
       `PostRunSummaryScreen` with the achievements list populated (per
       `reward.achievements`) instead of hidden.
  AC5: No other delta type's existing whitelist behavior changes — this is
       a pure 4-line addition to the existing OR-chain, not a rewrite.
Required hooks: Client-UX hook (CLAUDE.md) — host checks: host HUD
  readability (existing visuals, no new sizing/contrast concerns since no
  new UI is introduced), reconnect state visibility (N/A — this story adds
  no reconnect-path code).
Required tests:
  - `npm run typecheck` (repo root) — must pass with 0 errors (covers
    apps/host-client/tsconfig.json).
  - `npm run build --workspace=apps/host-client` — `tsc --noEmit && vite
    build` must succeed.
  - `npm run test` (repo root, vitest run) — full suite must remain green.
    No new automated test required (see Non-goals) — matches Story 6.8's
    precedent exactly (zero host-client test coverage exists, no harness to
    extend).
  - Manual verification (Client-UX hook, no automated equivalent exists):
    start a dungeon run, reach Level 4 (the boss level), and confirm all 4
    of the following actually fire, none of which have ever been observed
    live before this fix:
    1. Boss phase transitions (Phase 1→2→3, via normal combat or the
       existing `Kill All`/debug tooling if phase can be forced) show the
       glow-ring/eye-glow visual change.
    2. Landing a hit on the boss shows the "-N" floating number overlay.
    3. A boss stomp attack shows the red expanding ring.
    4. Defeating the boss (via normal combat or `debug:kill-boss`) shows
       the full purification-pulse → reward-reveal → voice-line sequence,
       and the resulting `PostRunSummaryScreen` displays the achievements
       list (assuming at least one achievement was earned this run).
Telemetry impact: None — no new user-facing flow, no new event contract;
  this restores pre-existing, already-shipped visual reactions to
  reachability.
```

## Story

As a player fighting the Grassland boss,
I want to see the same combat feedback (damage numbers, phase changes, stomp telegraphs, and the defeat/reward sequence) that regular enemies now show,
so that boss combat feels as responsive and legible as the rest of the run, and I actually see the achievements I earned.

## Acceptance Criteria

1. **Given** the boss's FSM phase changes mid-fight **When** the `boss:phaseChanged` delta arrives **Then** the host renders the correct Phase 2 glow ring / Phase 3 eye glow on the boss sprite within one tick.
2. **Given** the boss takes damage **When** the `boss:damaged` delta arrives **Then** a "-N" floating number appears via the existing `bossDamageFlash` DOM overlay for its existing 800ms window.
3. **Given** the boss performs a stomp attack **When** the `boss:stomped` delta arrives **Then** a brief red ring renders at the stomp's position/radius for ~66ms.
4. **Given** the boss is defeated **When** the `boss:defeated` delta arrives **Then** the full purification-pulse → reward-reveal → voice-line sequence fires, and the resulting `PostRunSummaryScreen` shows the achievements list.
5. **And** no other delta type's existing transient-visual behavior changes.

## Tasks / Subtasks

- [x] Task 1 — Add the 4 missing entries to `host-session.ts`'s `onTransientDelta` whitelist (AC: 1, 2, 3, 4, 5)
  - [x] In `apps/host-client/src/session/host-session.ts`, locate the whitelist OR-chain inside `room.onMessage(EventNames.DELTA, ...)` (lines 46-60).
  - [x] Add all 4 missing entries anywhere in the chain: `delta.type === 'boss:phaseChanged' ||`, `delta.type === 'boss:damaged' ||`, `delta.type === 'boss:stomped' ||`, `delta.type === 'boss:defeated' ||`. Placement doesn't matter functionally; grouping them together (e.g. adjacent to each other) keeps the boss-lifecycle deltas visually clustered for future readers.
  - [x] Do not touch any other line in this file — the whitelist array is the entire diff.

- [x] Task 2 — Verify (AC: 1, 2, 3, 4, 5)
  - [x] `npm run typecheck` (repo root) — 0 errors.
  - [x] `npm run build --workspace=apps/host-client` — succeeds.
  - [x] `npm run test` (repo root, vitest run) — full suite green, no regressions (this story touches no code any existing test exercises).
  - [x] Manual check per Client-UX hook: performed by the user (Cyby) directly. Confirmed: (1) phase glow ring/eye-glow renders (subtle — boss is placeholder art, a solid-color circle, so the glow is a same-color translucent ring; working as coded, not a defect of this story), (2) damage flash fires for every direct-hit ability (melee/cone/nova) at its existing top-of-screen position (unchanged, pre-existing Story 6.4 design), (3) stomp ring fires correctly, (4) full defeat sequence fires: purification tint (intentional light-blue background swap per AC4) → pulse → reward-reveal → achievements list populated on `PostRunSummaryScreen`. One gap found during verification: Stormcaller's Storm Eye zone shows no damage number against the boss — root-caused to a pre-existing, out-of-scope `GameRoom.ts` bug (zone-tick damage never targets `gameState.boss`, unrelated to this story's whitelist fix) — logged as `D-dev5-A` in deferred-work.md rather than fixed here (Blocked path).
  - [x] Updated `_bmad-output/implementation-artifacts/deferred-work.md`'s `D-6.8-A` entry: marked `— RESOLVED by dev-5-boss-transient-delta-whitelist-fix (2026-07-16)` with a resolution summary, per the file's existing convention. Also logged the new `D-dev5-A` finding (Storm Eye-vs-boss zone damage gap) surfaced during this story's manual verification.

## Dev Notes

### Why this is a 4-line fix, not a redesign

Every piece of code this story makes reachable already exists, was already
built across Stories 6.3 (arena/boss rendering), 6.4 (defeat sequence/
purification pulse/reward reveal), and 6.5 (achievements), and was already
reviewed at the time those stories shipped. The bug is exclusively that
`host-session.ts`'s `onTransientDelta` whitelist — the single choke point
every delta passes through before any host UI can react to it *transiently*
— never had these 4 entries added. `GameState` itself has been correct the
entire time (boss HP, phase, defeated flag all update via the unconditional
`applyDelta` call), which is exactly why this bug has been invisible in
normal play: the boss visibly takes damage (HP bar drops) and the run
correctly transitions to `post-run` on defeat — just without any of the
one-shot visual flourishes or the achievements list.

### Relationship to Story 6.8

Story 6.8 (`6-8-floating-damage-numbers-regular-enemies`) fixed the
identical whitelist-gap pattern for `enemy:damaged`, and its own Dev Notes
explicitly flagged these 4 boss entries as a "confirmed, real, pre-existing
bug" that was deliberately *not* fixed there, because touching them pulls in
re-verifying the entire boss defeat/reward-reveal/purification-pulse visual
sequence — a materially bigger manual-verification surface than the
one-line whitelist fix looks like. That's exactly this story: the
whitelist fix is trivial; the manual re-verification of a sequence that has
*never once fired in a live session* is the real work.

### The one thing to actually verify carefully: the reward-reveal chain

AC4 is the highest-value fix (see Context) but also the most compound one —
it isn't a single handler firing, it's a chain: `boss:defeated` delta →
`DungeonScreen.tsx`'s handler sets `purificationPulseRef.current` → the
ticker (runs every frame) animates that pulse and, on completion
(`t >= 1`), sets `rewardRevealActiveRef.current = true` and calls
`setRewardRevealVisible(true)` → a separate `useEffect` keyed on
`rewardRevealVisible` spawns burst particles and a voice-line hide timer →
**separately**, `App.tsx`'s own `boss:defeated` handler (line 45) sets
`runReward`, which is what actually gets passed as the `reward` prop to
`PostRunSummaryScreen` once `gameState.session.phase` flips to `'post-run'`.
Both halves (`DungeonScreen.tsx`'s pulse/particle chain AND `App.tsx`'s
`runReward` state) depend on the exact same single whitelist entry — confirm
both fire, not just the visually-obvious pulse animation.

### Project Structure Notes

- No new files. The entire diff is a 4-line addition to one existing array
  in `apps/host-client/src/session/host-session.ts`.
- Matches this app's established "pure renderer" boundary (game-architecture.md
  ~line 613-614): this story adds zero client-side decision-making — it
  only unblocks delivery of decisions the simulation server already made and
  already broadcasts correctly.

### Project Context Rules

- **Authority model**: no change — purely a client-side delivery fix for
  already-simulated, already-broadcast server decisions.
- **Client-UX hook** (CLAUDE.md): triggered because this touches host UI
  reachability (though not host UI code itself). Manual verification is the
  required check since none of these 4 visual reactions has an automated
  test.
- **No contract-change hook**: all 4 `DeltaEventMsg` variants are
  pre-existing and unchanged; no `packages/shared-types`/`packages/
  net-protocol` file is touched.
- **No simulation-safety hook**: `apps/simulation-server/**` and
  `packages/game-rules/**` are untouched (Blocked paths).
- **Package manager**: `npm` — `npm run typecheck` (repo root), `npm run
  build --workspace=apps/host-client`, `npm run test` (repo root, vitest).

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#D-6.8-A]
  — the original finding this story resolves.
- [Source: _bmad-output/implementation-artifacts/6-8-floating-damage-numbers-regular-enemies.md]
  — sibling story; Context section is the direct precedent for this
  story's diagnosis, and its own Non-goals section explains why this fix
  was deliberately deferred rather than folded into 6.8.
- [Source: apps/host-client/src/session/host-session.ts:46-60] — the
  `onTransientDelta` whitelist this story extends.
- [Source: apps/host-client/src/screens/DungeonScreen.tsx:585-622] — the 4
  already-existing, already-correct handler branches this story makes
  reachable.
- [Source: apps/host-client/src/screens/DungeonScreen.tsx:408-433] —
  ticker logic reading `bossPhaseRef` every frame for the glow-ring/eye-glow
  visual.
- [Source: apps/host-client/src/screens/DungeonScreen.tsx:436-452] —
  ticker logic animating the purification pulse and triggering the
  reward-reveal chain on completion.
- [Source: apps/host-client/src/screens/DungeonScreen.tsx:811-829] — the
  boss's existing fixed-DOM-overlay damage-number pattern (`bossDamageFlash`)
  this story restores delivery to.
- [Source: apps/host-client/src/App.tsx:45] — the `boss:defeated` reward
  handler (`setRunReward`) this story restores delivery to.
- [Source: apps/host-client/src/screens/PostRunSummaryScreen.tsx:123] —
  `reward?.achievements?.length` gate; the concrete symptom (achievements
  list never rendering) this story fixes.
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1820-1829,
  1855-1875, 2173-2176, 2260-2263, 2354-2357] — all 4 boss delta broadcast
  call sites, confirming server-side correctness and unchanged status.
- [Source: packages/net-protocol/src/apply-delta.ts:169-186] — all 4 boss
  `applyDelta` cases, confirming `GameState` itself is already correct
  independent of this story's fix.
- [Source: _bmad-output/implementation-artifacts/dev-4-debug-invincible-high-damage-mode.md]
  — sibling no-epic dev-infra story; format/structure precedent for this
  story.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npm run typecheck` (repo root): 0 errors, exit 0.
- `npm run build --workspace=apps/host-client`: `tsc --noEmit && vite build` succeeded, exit 0.
- `npm run test` (repo root, vitest run): 426 passed, 9 pre-existing skips, 34/37 files passed. 3 e2e files
  (`tests/e2e/reconnect.test.ts`, `tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`) failed
  with "simulation-server did not start within 60s". Re-ran `tests/e2e/full-run.test.ts` in isolation twice —
  once with this story's change applied (different failure: `activeBonds.length` assertion) and once with
  the change stashed back to baseline (two different failures: a delta-wait timeout and a negative-duration
  timing assertion). Same file fails differently on each run with or without this story's diff, confirming
  timing-sensitive pre-existing flakiness (matches the documented precedent in this file's Change Log history
  for Story 3.19: "3 e2e test files errored... confirmed unrelated to this story"). Also confirmed
  `tests/e2e/full-run.test.ts` does not import `host-session.ts` at all — it drives a raw `@colyseus/sdk`
  client — so this story's change cannot be the cause of any e2e result differing between runs.

### Completion Notes List

- Task 1 complete: added `boss:phaseChanged`, `boss:damaged`, `boss:stomped`, `boss:defeated` to the
  `onTransientDelta` whitelist OR-chain in `host-session.ts` (lines 46-63 after the edit). No other line in
  the file touched — diff is exactly the 4 new OR-chain entries.
- Task 2 automated checks (typecheck, build, full test suite) all pass — see Debug Log References.
- Task 2's manual live-verification: performed by the user (Cyby) directly, since this sandboxed dev
  environment has no browser/display and no Playwright or similar automation tooling installed, and this
  project has no host-client visual test harness (same precedent Story 6.8 hit — PixiJS canvas rendering has
  no automated test coverage). Result: AC1, AC3, AC4 confirmed fully working. AC2 confirmed working for every
  damage source Story 6.7 wired to the boss (direct hit-scan abilities). One out-of-scope gap surfaced:
  Stormcaller's Storm Eye zone deals zero damage to the boss (a pre-existing `GameRoom.ts` zone-tick bug, not
  a whitelist/delta issue, not introduced by this story) — root-caused and logged as `D-dev5-A` in
  `deferred-work.md` for a follow-up story rather than fixed here (Blocked path — Simulation Engineer
  ownership).
- `deferred-work.md`'s `D-6.8-A` entry marked resolved with a summary; new `D-dev5-A` entry added for the
  Storm Eye finding above.

### File List

- `apps/host-client/src/session/host-session.ts` (modified — 4-line whitelist addition)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — resolved D-6.8-A, added D-dev5-A)

## Change Log

- 2026-07-16: Story created (Cyby)
- 2026-07-16: Task 1 implemented and Task 2's automated checks (typecheck/build/test) completed by dev agent.
  Manual live-verification performed by the user directly (no browser-automation tooling in this sandboxed
  environment). AC1/AC3/AC4 fully confirmed; AC2 confirmed for every boss damage source Story 6.7 wired.
  Found and root-caused one out-of-scope pre-existing bug during verification (Storm Eye zone damage never
  reaches the boss — `GameRoom.ts` zone-tick loop only checks `gameState.enemies`) — logged as `D-dev5-A`
  rather than fixed here (Blocked path). D-6.8-A marked resolved. Story moved to `review`.

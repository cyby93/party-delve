---
baseline_commit: a4886fdefea0a1c124ec71f7f3aa50787cc10ba7
---

# Story 4.15b: Abandon-Run Resolution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want my party's unanimous decision to leave a run to actually return everyone to the hub,
so that we aren't stuck in a run nobody wants to keep playing.

**Depends on Story 4.15a** (contract). Before starting, verify these exist — if any is missing,
stop and finish 4.15a first:
- `EventNames.RUN_ABANDON_PROPOSE` / `EventNames.RUN_ABANDON_VOTE` (`packages/net-protocol/src/event-names.ts`)
- `AbandonProposeMsg` / `AbandonVoteMsg` (`packages/net-protocol/src/messages/mobile-to-server.ts`)
- `RunAbandonedDelta` in the `DeltaEventMsg` union + its `applyDelta` case
- `GameState.abandonProposal: AbandonProposal | null` (`packages/shared-types`)

No dependency on Story 4.15c — 4.15b is testable end-to-end from the e2e harness without any
mobile UI. Ship them in either order.

## Acceptance Criteria

1. **Given** any player in `session.phase === 'dungeon'` sends `run:abandon-propose`,
   **when** `GameRoom.ts` receives it,
   **then** it sets `gameState.abandonProposal = { proposedBy: client.sessionId }` (mirroring the
   set-on-receipt pattern at `GameRoom.ts:225-229`) and broadcasts a **snapshot** so every client
   sees the pending proposal,
   **and** there is **no** phase-beyond-`'dungeon'`, boss, `levelIndex`, or bond-moment guard —
   an abandon may be proposed at any point in the run, including mid-boss-fight (ADR-0007, explicit
   user direction; see Dev Notes → "No boss gate — deliberate").

2. **Given** an `abandonProposal` is already pending, or the sender is not in the roster, or the
   sender is frozen, or `session.phase !== 'dungeon'`,
   **when** `run:abandon-propose` arrives,
   **then** it is ignored (early `return`), mirroring the guard stack at `GameRoom.ts:212-215`.

3. **Given** an `abandonProposal` is pending,
   **when** every non-frozen player has sent `run:abandon-vote` with `accept: true`,
   **then** the sim broadcasts the `run:abandoned` delta, transitions `session.phase` to `'hub'`
   **directly** (no `'post-run'`, no reward screen, no `RunVictoryMsg`, no `return:to-camp`
   handshake), clears dungeon state, and resets player positions to hub spawn — by reusing the
   existing `resetToHub()` (`GameRoom.ts:768-895`), **not** by writing a parallel teardown.

4. **Given** an `abandonProposal` is pending,
   **when** any player sends `run:abandon-vote` with `accept: false`, **or** any player
   disconnects / drops / leaves,
   **then** `abandonProposal` clears immediately, the accumulated abandon votes are discarded, a
   snapshot is broadcast so every phone dismisses its prompt, and **no** phase transition occurs.
   A fresh proposal is required to try again.

5. **Given** `resetToHub()` is now reachable with a live, undefeated boss as a routine outcome,
   **when** an abandon resolves,
   **then** `resetToHub()` also clears `gameState.boss` and `pendingBossStompEvents` (mirroring
   `loadLevel`'s block at `GameRoom.ts:1008-1016`), and clears `gameState.abandonProposal` plus the
   abandon-vote map, so no dungeon-or-vote state leaks into the hub snapshot.

6. **Given** `tests/e2e`,
   **when** this story ships,
   **then** four scenarios are covered — unanimous-accept resolves to hub; a single decline
   cancels; a mid-vote disconnect cancels; a proposal during the boss level is accepted by the
   handler (no gate) — see Dev Notes → "Testing requirements".

7. **Given** the Simulation-safety hook (`apps/simulation-server/**` touched),
   **when** this story ships,
   **then** `npm run typecheck` is clean, `npm test` is green apart from the two known baseline
   failures, the deterministic-tick check in Dev Notes passes, and the perf sanity note is
   recorded in Completion Notes.

## Tasks / Subtasks

- [x] **Task 1 — Vote-tracking field (AC: 1, 3)**
  - [x] Add `private abandonVotes = new Map<string, 'accept'>();` immediately after `private runVotes` (`GameRoom.ts:132`). Value type is `'accept'` only — unlike `runVotes`, a decline never gets recorded because it cancels the whole proposal (AC4).
  - [x] Extend the `net-protocol` type import at `GameRoom.ts:5` with `AbandonProposeMsg, AbandonVoteMsg`.

- [x] **Task 2 — `run:abandon-propose` handler (AC: 1, 2)**
  - [x] Register `this.onMessage(EventNames.RUN_ABANDON_PROPOSE, ...)` directly after the existing `EventNames.VOTE` handler (`GameRoom.ts:235-258`). Copy its `try/catch` + `typeof raw === 'string' ? JSON.parse(raw) : raw` shape even though the payload is empty — every handler in this file is defensive the same way.
  - [x] Guards, in this order: `if (this.gameState.session.phase !== 'dungeon') return;` → `if (this.gameState.abandonProposal !== null) return;` → `const player = ...find(p => p.id === client.sessionId); if (!player || player.isFrozen) return;`
  - [x] `this.abandonVotes.clear();` then `this.gameState.abandonProposal = { proposedBy: client.sessionId };`
  - [x] Broadcast `EventNames.SNAPSHOT` (see Dev Notes → "Why a snapshot, not a delta, on propose").
  - [x] `logger.info({ roomId, proposedBy }, 'abandon proposed')`.

- [x] **Task 3 — `run:abandon-vote` handler (AC: 3, 4)**
  - [x] Register `this.onMessage(EventNames.RUN_ABANDON_VOTE, ...)` after Task 2's handler.
  - [x] Guards: `phase !== 'dungeon'` → `abandonProposal === null` → unknown/frozen player.
  - [x] `if (!msg.accept) { this.cancelAbandonProposal('declined', client.sessionId); return; }`
  - [x] Otherwise `this.abandonVotes.set(client.sessionId, 'accept');` then `this.resolveAbandonVoteIfComplete();`

- [x] **Task 4 — Resolution + cancellation helpers (AC: 3, 4)**
  - [x] Add `private resolveAbandonVoteIfComplete()` and `private cancelAbandonProposal(reason, byPlayerId?)` and `private abandonRun()` immediately after `resolveVoteIfComplete()` (`GameRoom.ts:632`). Exact bodies in Dev Notes → "Helper bodies".

- [x] **Task 5 — Cancel on every leave path (AC: 4)**
  - [x] `onLeave`, consented branch (`GameRoom.ts:464-490`): call `this.cancelAbandonProposal('player-left', client.sessionId);` just before the `return` at `:490`, after the `player:left` broadcast.
  - [x] `onLeave`, network-drop branch: call it right beside the existing `this.resolveVoteIfComplete(); this.checkReturnReady();` pair (`:502-503`).
  - [x] `onLeave`, grace-expiry branch: same, beside `:568-569`.
  - [x] **Do not** call `resolveAbandonVoteIfComplete()` from any of these — see Dev Notes → "Disconnect cancels (divergence from the run-start vote)".

- [x] **Task 6 — `resetToHub()` additions (AC: 5)**
  - [x] After the boss-body / arena-wall destruction block (`GameRoom.ts:788-793`), add `this.gameState.boss = null;` and `this.pendingBossStompEvents.length = 0;`.
  - [x] Beside `this.runVotes.clear();` (`:859`), add `this.gameState.abandonProposal = null;` and `this.abandonVotes.clear();`.
  - [x] Do **not** change anything else in `resetToHub()` — in particular leave `player.isFrozen = false` (`:821`) alone; see Dev Notes → "Pre-existing quirks: do not fix here".

- [x] **Task 7 — e2e tests (AC: 6)**
  - [x] Create `tests/e2e/abandon-run.test.ts` with the four scenarios in Dev Notes → "Testing requirements".

- [x] **Task 8 — Simulation-safety hook (AC: 7)**
  - [x] `npm run typecheck` (root) — clean.
  - [x] `npm test` (root) — green apart from the two known baseline failures.
  - [x] Deterministic-tick + perf sanity checks per Dev Notes; record both in Completion Notes.

### Review Findings

- [x] [Review][Decision] Dungeon→post-run phase transitions inside `tick()` don't cancel a pending `abandonProposal` — **Resolved: patch it now (user decision).** Two pre-existing code paths inside `tick()` (`case 'boss:defeated'` at `GameRoom.ts:2319-2347`, and the all-spirit run-failure check at `GameRoom.ts:3185-3197`) flipped `session.phase` from `'dungeon'` to `'post-run'` without calling `cancelAbandonProposal`, which would have left a pending proposal permanently unreachable and stuck in every snapshot until the next `resetToHub()`. Fixed: added `this.cancelAbandonProposal('boss-defeated')` / `this.cancelAbandonProposal('run-failed')` immediately before each phase flip. Re-checked the earlier "forbidden `logger.info` inside `tick()`" concern against actual practice: `logger.info` is already used pervasively at comparable rarity elsewhere in `tick()` (player-downed, run-failed, level-complete, wave-cleared), so reusing `cancelAbandonProposal` unmodified is consistent with established convention, not a new violation. Added a dedicated e2e regression test (`tests/e2e/abandon-run.test.ts` → "boss defeat cancels a pending abandon proposal") using the existing `reachBossLevel` + `debug:kill-boss` helpers. The run-failed (all-spirit) site shares the identical one-line fix pattern, verified by code inspection and `npm run typecheck`, but was not given its own dedicated e2e test — driving every player into spirit form is disproportionately complex to set up for a mechanically-identical fix. Full test suite (unit + contract + reconnect + abandon-run, and `full-run.test.ts`/`ability-dispatch.test.ts` re-run standalone) green apart from the two documented baseline failures. Found by the Edge Case Hunter layer (its cited "guard_snippet" quotes for both sites did not match the actual file and were disregarded — the underlying gap was independently verified directly against `GameRoom.ts`).
- [x] [Review][Patch] `tests/e2e/abandon-run.test.ts` "single decline cancels" trailing assertion depended on periodic-snapshot cadence rather than asserting the no-op directly [tests/e2e/abandon-run.test.ts:188-193] — Applied: replaced the `waitForSnapshotWhere(host, () => true, 8_000)` catch-all (racing an arbitrary next snapshot against the 5s `SNAPSHOT_INTERVAL_S` cadence) with a direct assertion that a stale post-cancel vote does not fire a `run:abandoned` delta within 1.5s. Faster (test dropped from ~5.1s to ~2.6s) and no longer coupled to broadcast timing.
- [x] [Review][Defer] Missing/falsy `accept` field in `run:abandon-vote` is silently treated as an explicit decline [apps/simulation-server/src/rooms/GameRoom.ts:74-77] — deferred, pre-existing pattern. `if (!msg.accept) { cancelAbandonProposal(...); return; }` can't distinguish "player declined" from "malformed/partial payload" — but this mirrors the existing `run:vote` handler's identical `if (!msg.accept)` design (`GameRoom.ts:244`), which this story's Dev Notes explicitly directed reusing. Not a regression introduced by this diff.
- [x] [Review][Defer] `bond:continue` (CONTINUE handler) doesn't check for a pending `abandonProposal` before loading the next level [apps/simulation-server/src/rooms/GameRoom.ts:361-374] — deferred, pre-existing, no correctness impact. Per AC1 there is deliberately no bond-moment gate on proposing an abandon, so a proposal can be pending when `bond:continue` fires; the handler will still load the next level. Benign: `resetToHub()` unconditionally tears down whatever level state exists regardless of when it was loaded, so an immediately-following unanimous accept still resolves cleanly to hub. No AC requires guarding this interaction.
- [x] [Review][Defer] Guard branches added by this story have no direct test coverage beyond AC6's four named scenarios [tests/e2e/abandon-run.test.ts] — deferred, matches story's stated test scope. Untested: propose/vote from a frozen player, propose outside `'dungeon'` phase, the voluntary consented-leave cancellation path, and a malformed/missing-field vote payload. AC6 named exactly four scenarios and all four are covered; broader guard coverage was not requested by any AC.
- [x] [Review][Defer] All abandon-handler guard failures are silent bare `return`s with no NACK/feedback to the triggering client [apps/simulation-server/src/rooms/GameRoom.ts:262-292] — deferred, pre-existing codebase-wide convention. Every existing `onMessage` handler in this file (RUN_PROPOSE, VOTE, CLASS_SELECT, etc.) follows the same silent-discard-on-invalid-guard pattern; no NACK protocol exists anywhere in `GameRoom.ts` today. Out of this story's scope.

## Dev Notes

### Helper bodies

```ts
private resolveAbandonVoteIfComplete(): void {
  if (this.gameState.abandonProposal === null) return;
  if (this.gameState.session.phase !== 'dungeon') return;
  const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
  if (activePlayers.length === 0) return;
  if (!activePlayers.every(p => this.abandonVotes.get(p.id) === 'accept')) return;
  this.abandonRun();
}

private cancelAbandonProposal(reason: string, byPlayerId?: string): void {
  if (this.gameState.abandonProposal === null) return;   // idempotent — safe to call anywhere
  this.gameState.abandonProposal = null;
  this.abandonVotes.clear();
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId, reason, byPlayerId }, 'abandon proposal cancelled');
}

private abandonRun(): void {
  this.gameState.abandonProposal = null;
  this.abandonVotes.clear();
  this.broadcast(EventNames.DELTA, { type: 'run:abandoned' } satisfies DeltaEventMsg);
  this.resetToHub();   // mutates state to hub + broadcasts the authoritative snapshot
  logger.info({ roomId: this.roomId }, 'run abandoned — unanimous accept');
}
```

**Do not copy `resolveVoteIfComplete`'s `activePlayers.some(p => p.class === null)` guard**
(`:627`). It exists because a run cannot *start* with an unclassed player; mid-run every player
already has a class (Story 4.8 forces selection at join), so the guard would only ever be a
confusing no-op here.

**Broadcast order in `abandonRun()` matters.** Delta first, snapshot second (via `resetToHub`).
The delta is what Story 4.15c keys its bond-card / bond-moment cleanup off of; the snapshot then
lands immediately and makes the mirror authoritative. This mirrors `startDungeon`'s
`run:starting` delta → snapshot ordering (`:662-667`).

### Why a snapshot, not a delta, on propose

The 4.15a contract defines exactly one broadcast delta — `run:abandoned`. There is deliberately
**no** `run:abandon-proposed` delta, so the pending proposal reaches clients through a snapshot.
That is the same mechanism the existing run-vote decline path already uses
(`GameRoom.ts:246-247` broadcasts a snapshot rather than inventing a `run:declined` delta).

Do **not** add a new delta type here. That would be a contract change outside this story's
ownership and would require Protocol Architect review + an ADR update.

Cost is fine: proposals are rare, human-triggered events (at most one snapshot per proposal and
one per resolution), not per-tick traffic.

### Disconnect cancels (divergence from the run-start vote)

This is the single most likely place to get it wrong. The two votes behave **differently** on
disconnect, on purpose:

| | run-start vote (`runProposal`) | abandon vote (`abandonProposal`) |
|---|---|---|
| Player drops mid-vote | `onLeave` calls `resolveVoteIfComplete()` (`:502`) — the frozen player is filtered out, so the drop can **unblock** and *complete* the vote | Proposal is **cancelled** (ADR-0007 "Decision"; epics AC3) |
| Grace expires | same — can complete the vote (`:568`) | **cancelled** |
| Consented leave | no vote call at all today | **cancelled** |

Rationale: silently ending a run for everyone because one phone's battery died is the worst
possible failure mode for an irreversible bail-out. Requiring a fresh proposal costs one tap.

Consequence to keep straight: `resolveAbandonVoteIfComplete` still filters `!p.isFrozen` when
computing unanimity. That filter only ever matters for a player who was **already** frozen when
the proposal was made — any player who becomes frozen *while* a proposal is pending cancels it
before the filter can apply. Both rules are needed; neither is redundant.

The consented-leave call site is a superset of the epic's literal wording ("or disconnects while
the vote is pending"). Include it: a player voluntarily leaving mid-vote is the same hazard, and
`cancelAbandonProposal` is idempotent, so the extra call is free when nothing is pending.

### No boss gate — deliberate

`epics.md` and ADR-0007 both record the user's explicit choice: the abandon vote is allowed at
**any** point in `'dungeon'` phase, including an active boss encounter, with no phase-gating. Do
not add `if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX) return;` or a
`gameState.boss !== null` guard, and do not add a "you'll lose your progress" server-side
confirmation step. The unanimous vote *is* the confirmation.

### `resetToHub()` — what it already handles, and the two gaps you must close

Already correct, do not duplicate: enemy bodies + `gameState.enemies` (`:770-796`), essence
sensors and drops, boss body + arena walls (`:788-793`), bond sensors/fixtures/timers
(`:801-810`), player position/hp/down/spirit/frozen/essence reset to `SPAWN_POSITIONS`
(`:813-831`), full session reset incl. `levelIndex = 0` and a fresh `runSeed` (`:834-845`),
`returnReadySet`/`inputQueue`/cooldowns/joystick/projectiles/zones/spirit-novas/soul-mend and
mid-channel `channelingAbility` clearing (`:848-890`), and the closing snapshot broadcast.

**Gap 1 — `gameState.boss` is never nulled.** `loadLevel` nulls it (`:1015-1016`) but
`resetToHub` does not. Today that leaks only briefly (a defeated boss lingers in hub snapshots
until the next `loadLevel(1)`). Abandon makes it reachable with a **live, undefeated** boss as a
routine outcome. There is no runtime damage — the boss tick is gated on
`levelIndex === BOSS_LEVEL_INDEX` (`:2179`), which `resetToHub` zeroes, and `HubWorldScreen.tsx`
renders no boss at all — but leaving a live `BossState` in every hub snapshot is state rot that
a future hub renderer would surface as a ghost boss. Close it (AC5).

**Gap 2 — `abandonProposal` / `abandonVotes` must be cleared** so a proposal can never survive
the transition it caused.

### Pre-existing quirks: do not fix here

- `resetToHub` sets `player.isFrozen = false` for **every** player (`:821`), including one still
  inside its `allowReconnection` grace window. Pre-existing and already reachable today via
  `return:to-camp`; out of scope for this story. Note it in Completion Notes, do not change it.
- The purification `setTimeout` (`:2270-2274`) self-guards with
  `if (this.gameState.session.phase !== 'post-run') return;`, so an abandon during the
  purification window cannot emit a stray `run:complete`. No change needed — do not add a
  `clearTimeout` to `resetToHub`.
- `resetToHub` never clears `gameState.runProposal`. Unreachable in practice (a run-start
  proposal cannot be pending in `'dungeon'` phase — `:212`). Leave it.

### Testing requirements (AC 6)

New file `tests/e2e/abandon-run.test.ts`. Copy the setup block from
`tests/e2e/full-run.test.ts:118-175` verbatim in shape (host `create` + three `joinById`
players, `CLASS_SELECT` for all three, drive p1 north into `dungeon-entrance`, `RUN_PROPOSE`,
three `VOTE` accepts, await the `phase === 'dungeon'` snapshot). Use
`startTestServer`/`stopTestServer` (`tests/helpers/server.js`), `waitForDelta` and `waitUntil`
(`tests/helpers/messages.js`), and `raceTimeout` — same imports as `full-run.test.ts:1-10`.

1. **Unanimous accept → hub.** All three send `{ type: 'run:abandon-vote', accept: true }` via
   `EventNames.RUN_ABANDON_VOTE` after p1 sends `EventNames.RUN_ABANDON_PROPOSE`. Assert: the
   host receives a `run:abandoned` delta, and the following snapshot has
   `session.phase === 'hub'`, `session.levelIndex === 0`, `enemies.length === 0`,
   `activeBonds.length === 0`, `boss === null`, `abandonProposal === null`, and every player at
   full hp with `isDown === false`.
2. **Single decline cancels.** p1 proposes, p2 accepts, p3 sends `accept: false`. Assert the
   next snapshot has `abandonProposal === null` **and** `session.phase === 'dungeon'`. Then
   assert a stale `accept: true` from p2 does **not** resolve anything (proposal already gone).
3. **Disconnect during vote cancels.** p1 proposes, p2 accepts, then `p3.connection.close()`
   (the drop idiom used throughout `tests/e2e/reconnect.test.ts:48,81,102,131`). Await the
   `player:disconnected` delta, then assert `abandonProposal === null` and
   `session.phase === 'dungeon'` — i.e. the drop **cancelled** rather than unblocked the vote.
   This is the regression guard for the divergence table above.
4. **No boss gate.** Reach level 4 the way `full-run.test.ts` does (`host.send('debug:kill-all')`
   per level plus the bond-moment `bond:continue` steps), confirm `boss !== null` in the
   snapshot, then propose + unanimously accept and assert the same hub outcome as scenario 1
   with `boss === null` afterwards. Give this one a generous timeout; it is the slowest test in
   the file. If the level-4 walk proves flaky, keep the test but reuse `full-run.test.ts`'s
   existing boss-reaching sequence rather than inventing a shortcut.

Register `waitForDelta` listeners **before** sending the message that triggers them — the
existing e2e tests all do this and the comment at `full-run.test.ts:178-180` explains why.

### Deterministic-tick + perf sanity (AC 7)

- **Deterministic tick:** this story adds **zero** code inside `tick()` — every new code path is
  message-driven (`onMessage`) or leave-driven (`onLeave`). Verify by confirming no edit lands
  between `GameRoom.ts:1534` (`private tick()`) and the end of the tick loop, then run the
  existing seeded run tests (`tests/e2e/full-run.test.ts`, `tests/unit/**`) unchanged and green.
  Also confirm `resetToHub` still re-randomizes `session.runSeed` (`:844`) so a post-abandon run
  gets a fresh layout rather than replaying the abandoned one.
- **Perf sanity:** the propose and vote handlers are O(players) (≤8) with no allocation in the
  tick path. Broadcast cost is one snapshot per proposal, one per cancellation, and one delta +
  one snapshot per resolution — all human-triggered, none per-tick.

### Known-failing baseline tests (do not chase)

Pre-existing at `a4886fd`, unrelated: `ability-vfx.test.ts` Stone Wall geometry assertion, and
the flaky Ancestor's Voice heal assertion in `tests/e2e/ability-dispatch.test.ts`.

### Hooks triggered

- **Simulation-safety hook** — `apps/simulation-server/**`. Requires typecheck, unit/e2e tests,
  deterministic-tick check, perf sanity (all specified above).
- Contract-change hook does **not** fire: this story consumes 4.15a's contract and adds nothing
  to `packages/shared-types/**` or `packages/net-protocol/**`. If you find yourself wanting a
  new message or delta, stop — that is a 4.15a amendment, not this story.
- Client-UX hook does **not** fire: no host or mobile file is touched.

### Non-goals (do not implement here)

- Mobile button, `VotePopup`, or `mobile-session.ts` send methods → **Story 4.15c**.
- Host-screen banner or any `apps/host-client/**` change — explicitly excluded by 4.15c's
  Non-goals; the phase transition alone is sufficient host signal.
- Partial-essence payout, penalty, or any reward for an abandoned run — a bail-out yields
  nothing; `resetToHub` already zeroes `essenceTotal` (`:824`) and `lastRunReward` (`:890`).
- Generalizing `runProposal` + `abandonProposal` into a shared proposal framework (ADR-0007
  "Consequences" explicitly defers this).

### Project Structure Notes

All changes are inside the single file `apps/simulation-server/src/rooms/GameRoom.ts` plus one
new e2e test file. Match the file's existing conventions: `satisfies DeltaEventMsg` on broadcast
literals, `logger.info({ roomId: this.roomId, ... }, 'lowercase message')`, defensive
`try/catch` + dual object/JSON-string parsing in every `onMessage`, and `ponytail:` comments for
non-obvious decisions.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — "Epic 4 Correction: Abandon-Run Vote" → Story 4.15b]
- [Source: `docs/adr/ADR-0007-abandon-run-vote-contract.md` — Decision (disconnect cancels; no phase guard), Consequences]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md` — Simulation-safety hook note]
- [Source: `CLAUDE.md` — Ownership Rules, Simulation-safety hook]
- Existing patterns to mirror: `GameRoom.ts:208-258` (propose/vote handlers), `:623-632`
  (`resolveVoteIfComplete`), `:760-895` (`checkReturnReady`/`resetToHub`), `:1008-1016`
  (`loadLevel`'s boss teardown), `:460-571` (`onLeave`'s three exits)
- Test patterns to mirror: `tests/e2e/full-run.test.ts:118-175`, `tests/e2e/reconnect.test.ts:38-105`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — implementation followed the story's prescribed guards/helper bodies verbatim; no debugging detours were required.

### Completion Notes List

- Implemented exactly as specified: `abandonVotes` vote-tracking map, `run:abandon-propose`/`run:abandon-vote` handlers, `resolveAbandonVoteIfComplete`/`cancelAbandonProposal`/`abandonRun` helpers (bodies copied verbatim from Dev Notes → "Helper bodies"), cancellation calls on all three `onLeave` exit paths, and the two `resetToHub()` gaps (boss/`pendingBossStompEvents` nulling, `abandonProposal`/`abandonVotes` clearing).
- Deliberately did **not** copy `resolveVoteIfComplete`'s `activePlayers.some(p => p.class === null)` guard into `resolveAbandonVoteIfComplete` — every mid-run player already has a class, so it would be a no-op (per Dev Notes).
- No boss-level gate was added to either handler — an abandon proposal/vote is accepted at any point in `'dungeon'` phase, including mid-boss-fight, per ADR-0007 and AC1.
- `resetToHub` left untouched otherwise: `player.isFrozen = false` still resets unconditionally for every player (pre-existing quirk, out of scope), the purification `setTimeout` self-guard was not touched, and `gameState.runProposal` is still never cleared in `resetToHub` (unreachable in practice).
- `tests/e2e/abandon-run.test.ts` (new, port 2570 to run in parallel with other e2e suites) covers all four AC6 scenarios: unanimous accept → hub, single decline cancels (plus a stale post-cancel vote proving it's a no-op, asserted directly via a bounded `run:abandoned`-does-not-fire check rather than racing the periodic snapshot cadence), mid-vote disconnect cancels, and no-boss-gate (proposal accepted while `boss !== null`, resolves to `boss === null` hub). Each vote-sending step waits for a snapshot confirming the proposal was already registered server-side before firing votes from other connections, to avoid a race against the propose message (which — deliberately, per Dev Notes — has no delta of its own to await). A fifth test, "boss defeat cancels a pending abandon proposal", was added during code review (see Review Findings) as a regression guard for the `boss:defeated`/`abandonProposal` interaction fix.
- **Deterministic-tick check (updated after code review):** the original implementation added zero code inside `tick()`. During code review the Edge Case Hunter found that two *pre-existing* `tick()` code paths (`case 'boss:defeated'`, and the all-spirit run-failure check) transition phase out of `'dungeon'` without cancelling a pending `abandonProposal`, leaving it stuck. Per user decision this was patched in-story: one `this.cancelAbandonProposal(...)` call added immediately before each phase flip. This *does* now add two lines inside `tick()`, but only on rare, human/event-triggered paths (once per boss kill, once per total-party-wipe), not per-tick-loop-iteration work — consistent with the existing precedent of `logger.info` calls already present at the same two sites for the same rarity class. `tests/e2e/full-run.test.ts` (both scenarios, including the boss-defeat path) and all `tests/unit/**` re-verified green after this change, run in isolation. `resetToHub` still re-randomizes `session.runSeed`, confirmed unchanged.
- **Perf sanity:** the propose/vote handlers are O(players) (≤8), no allocations beyond the map entries themselves. The two `tick()`-embedded cancellation calls added during review are also O(players), fire at most once per boss-kill or once per total-party-wipe (never per tick), and reuse the same snapshot-broadcast-on-cancel cost already accounted for elsewhere. Broadcast cost per the design is one snapshot per proposal, one per cancellation, one delta + one snapshot per resolution — all human-triggered, never per-tick.
- `npm run typecheck` (root, all 10 project references) — clean, both before and after the code-review patch.
- `npm test` (root) — full parallel run showed extra failures beyond the two documented baseline failures (`full-run.test.ts`'s main scenario timing out, `ability-dispatch.test.ts`/`hub-ability-use.test.ts` failing to boot their sim-server child process within 60s); re-running the affected suites in isolation confirmed these were resource contention from too many concurrent `tsx` server spawns during the full parallel run, not regressions — `full-run.test.ts` (both tests), `ability-dispatch.test.ts`'s Storm Eye test, `hub-ability-use.test.ts`, and a combined `unit + contract + reconnect.test.ts + abandon-run.test.ts` run (411 tests, post-patch) all pass cleanly standalone. The two genuine baseline failures reproduced exactly as documented: `ability-vfx.test.ts` Stone Wall geometry assertion, and the flaky Ancestor's Voice heal assertion in `ability-dispatch.test.ts` (`expected 25 to be greater than or equal to 100` on the post-patch re-run; the exact number is timing-sensitive but the assertion is the same known-flaky one).
- **Code review:** ran gds-code-review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor found zero AC violations — all 7 ACs matched spec verbatim. 1 `decision_needed` (the tick()/abandonProposal gap above — user chose "patch it now"), 1 `patch` (test flakiness fix, applied), 4 `defer` (logged to `deferred-work.md` as D-4.15b-A through D-4.15b-D), 3 dismissed as noise (findings that were actually explicit spec requirements or prescribed-by-Dev-Notes design choices, not bugs).
- Confidence: 95% — implementation and tests match the story's prescribed code and guard ordering exactly, and the one real gap surfaced by review was patched and regression-tested; the only residual uncertainty is environment-level test-runner parallelism (documented above), unrelated to this story's code changes.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` (modified)
- `tests/e2e/abandon-run.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking)

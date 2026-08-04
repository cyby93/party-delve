---
baseline_commit: a4886fdefea0a1c124ec71f7f3aa50787cc10ba7
---

# Story 4.15a: Abandon-Run Vote Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Protocol Architect,
I want a typed contract for proposing and voting to abandon the current run,
so that the sim and both clients agree on the shape of an abandon request before any implementation begins.

**Why this story exists (epic correction — approved by the user 2026-08-03):**
There is no voluntary mid-run exit today. Verified at baseline `a4886fd`:
`session.phase` (`packages/shared-types/src/session.ts:9`) only leaves `'dungeon'` via
`run:complete` (victory) or `run:failed` (full-party defeat), both of which route through
`'post-run'` (`apply-delta.ts:157-162`). A party that wants to stop playing has no path back
to the hub. See `docs/adr/ADR-0007-abandon-run-vote-contract.md` (already written — do **not**
recreate it; see Task 5).

Split by ownership per `CLAUDE.md`: **4.15a** (this story) is the contract only —
`packages/shared-types` + `packages/net-protocol`. **4.15b** (Simulation Engineer) implements
vote resolution in `GameRoom.ts`. **4.15c** (Mobile Controller Engineer) builds the button and
vote UI. 4.15a must land first; 4.15b and 4.15c have no dependency on each other.

**4.15a alone is safely shippable and inert.** After this story the types and the `applyDelta`
case exist, but no client sends `run:abandon-propose` and no server broadcasts `run:abandoned`.
That is intentional (same inert-contract pattern as Story 7.7a and Story 5.1) and must be
stated in the completion notes.

## Acceptance Criteria

1. **Given** `packages/net-protocol/src/messages/mobile-to-server.ts` defines the existing
   `RunProposeMsg`/`VoteMsg` pair (`:18-27`),
   **when** this story ships,
   **then** two new mobile→server message interfaces exist in the same file, following that
   naming and shape convention exactly:
   `AbandonProposeMsg = { type: 'run:abandon-propose' }` (no payload) and
   `AbandonVoteMsg = { type: 'run:abandon-vote'; accept: boolean }`,
   **and** both are re-exported from `packages/net-protocol/src/index.ts:7` alongside
   `RunProposeMsg, VoteMsg`.

2. **Given** `packages/net-protocol/src/event-names.ts` carries the routing keys used by
   `room.send(...)` / `this.onMessage(...)` (`RUN_PROPOSE`, `VOTE` — `:11-12`),
   **when** this story ships,
   **then** `EventNames` gains exactly two entries —
   `RUN_ABANDON_PROPOSE = 'run:abandon-propose'` and `RUN_ABANDON_VOTE = 'run:abandon-vote'`,
   **and** **no** `RUN_ABANDONED` entry is added, because `run:abandoned` is a broadcast delta
   that travels inside the `EventNames.DELTA` envelope, not its own Colyseus channel
   (the existing `RUN_STARTING = 'run:starting'` entry at `:13` is vestigial — it is broadcast
   as a delta at `GameRoom.ts:663-664` and its `EventNames` key is referenced nowhere; do not
   copy that mistake).

3. **Given** `packages/net-protocol/src/messages/server-to-host.ts` defines every broadcast
   delta and `DeltaEventMsg` unions them (`:319-366`),
   **when** this story ships,
   **then** `RunAbandonedDelta = { type: 'run:abandoned' }` exists with **no payload fields**,
   is added to the `DeltaEventMsg` union, and is re-exported from
   `packages/net-protocol/src/index.ts:5` alongside `RunCompleteDelta`/`RunStartingDelta`,
   **and** its zero-field shape is justified in a `ponytail:` comment: the proposer id is
   already in `abandonProposal` on every client's mirror, and Story 4.15c's Non-goals rule out
   a host banner, so there is nothing for a payload to carry.

4. **Given** `applyDelta`'s `switch` is exhaustive over `DeltaEventMsg` via the
   `const _exhaustive: never = evt` guard (`apply-delta.ts:305-310`), so adding a union member
   without a case is a **compile error**,
   **when** `RunAbandonedDelta` is added,
   **then** `apply-delta.ts` gains
   `case 'run:abandoned': return { ...state, abandonProposal: null, session: { ...state.session, phase: 'hub' } };`
   — clearing the proposal **and** setting the phase in one step, mirroring how
   `case 'run:starting'` (`:165-166`) clears `runProposal` and sets `phase: 'dungeon'`,
   **and** the original `state` object is not mutated (spread-only, like every neighbouring case).

5. **Given** `GameState` has exactly one proposal slot today (`runProposal: RunProposal | null`
   — `packages/shared-types/src/game-state.ts:26`),
   **when** this story ships,
   **then** a new `AbandonProposal` interface `{ proposedBy: string }` exists in
   `packages/shared-types/src/abandon-proposal.ts` (a new file, mirroring `run-proposal.ts`),
   is exported from `packages/shared-types/src/index.ts`, and `GameState` gains a second,
   **independent** required slot `abandonProposal: AbandonProposal | null`,
   **and** `AbandonProposal` deliberately carries **no** `biome`/`difficulty` (meaningless for a
   bail-out — ADR-0007 "Decision") and no proposer display name (clients resolve it from
   `players.find(p => p.id === proposedBy)`).

6. **Given** `abandonProposal` is a **required** field, every existing `GameState` object
   literal fails `npm run typecheck` until initialized,
   **when** this story ships,
   **then** all seven construction sites carry `abandonProposal: null` and the full typecheck
   passes — see the exhaustive list in Dev Notes → "GameState literal fix list". Touching
   `GameRoom.ts:72` and the test fixtures from a Protocol Architect story is expected and
   precedented (Story 5.1 added `activeBonds` the same way); these are one-line initializers,
   **not** logic changes.

7. **Given** the Contract-change hook fires (both `packages/shared-types/**` and
   `packages/net-protocol/**` are touched),
   **when** this story ships,
   **then** `tests/contract/net-protocol.test.ts` gains the three tests named in Dev Notes →
   "Testing requirements", `docs/adr/ADR-0007-abandon-run-vote-contract.md` is verified against
   the shipped shape (Task 5), and the compatibility note is recorded in the completion notes:
   **purely additive** — no existing message shape, delta, or `EventNames` value changes, so an
   older client that never sends `run:abandon-propose` behaves exactly as before.

## Tasks / Subtasks

- [x] **Task 1 — `AbandonProposal` type + `GameState` slot (AC: 5)**
  - [x] Create `packages/shared-types/src/abandon-proposal.ts` with `export interface AbandonProposal { proposedBy: string; }` — copy the file shape of `run-proposal.ts` (no `DifficultyTier` import needed).
  - [x] Add `export * from './abandon-proposal.js';` to `packages/shared-types/src/index.ts` (place it directly after the `run-proposal.js` line to keep the proposal types adjacent).
  - [x] In `packages/shared-types/src/game-state.ts`: add the `import type { AbandonProposal } from './abandon-proposal.js';` and the field `abandonProposal: AbandonProposal | null;` immediately after `runProposal` (`:26`).

- [x] **Task 2 — Wire messages + event names (AC: 1, 2)**
  - [x] `packages/net-protocol/src/messages/mobile-to-server.ts`: add `AbandonProposeMsg` and `AbandonVoteMsg` after `VoteMsg` (`:27`).
  - [x] `packages/net-protocol/src/event-names.ts`: add `RUN_ABANDON_PROPOSE` and `RUN_ABANDON_VOTE` after `VOTE` (`:12`). Do **not** add `RUN_ABANDONED`.
  - [x] `packages/net-protocol/src/index.ts:7`: extend the `mobile-to-server.js` type re-export with both new names.

- [x] **Task 3 — `run:abandoned` delta (AC: 3, 4)**
  - [x] `packages/net-protocol/src/messages/server-to-host.ts`: add `RunAbandonedDelta` next to `RunCompleteDelta` (`:167-170`) with the `ponytail:` justification comment; add it to the `DeltaEventMsg` union after `RunStartingDelta` (`:346`).
  - [x] `packages/net-protocol/src/index.ts:5`: re-export `RunAbandonedDelta`.
  - [x] `packages/net-protocol/src/apply-delta.ts`: add the `case 'run:abandoned'` directly after `case 'run:starting'` (`:165-166`).

- [x] **Task 4 — Compile-fix every `GameState` literal (AC: 6)**
  - [x] Add `abandonProposal: null,` at each of the seven sites in Dev Notes → "GameState literal fix list".
  - [x] Run `npm run typecheck` (all ten projects) — it must be clean. A missed site shows up here, not at runtime.

- [x] **Task 5 — ADR + compatibility verification (AC: 7)**
  - [x] Read `docs/adr/ADR-0007-abandon-run-vote-contract.md`. It already exists and is `Accepted`. **Do not rewrite it.** Verify the shipped shape matches its "Decision" section; if anything diverges (e.g. the `AbandonProposal` field set), append a short clarification rather than restructuring the document.
  - [x] Record the additive-only compatibility note in Completion Notes.

- [x] **Task 6 — Contract tests (AC: 7)**
  - [x] Add the three tests to `tests/contract/net-protocol.test.ts` per Dev Notes → "Testing requirements", placed beside the existing `run:proposed`/`run:starting` block (`:613-655`).
  - [x] Run `npm test` (root, vitest). Two pre-existing unrelated failures are expected — see Dev Notes → "Known-failing baseline tests".

### Review Findings

- [x] [Review][Patch] `event-names.ts` new entries break the file's local `=`-alignment style around `RUN_PROPOSE`/`VOTE`/`RUN_STARTING` [packages/net-protocol/src/event-names.ts:13-14] — fixed, realigned all five entries.
- [x] [Review][Defer] `AbandonProposal` has no id/nonce, so a stale/delayed `AbandonVoteMsg` could theoretically be misapplied against a newer proposal that superseded the one it was cast for [packages/shared-types/src/abandon-proposal.ts] — deferred, pre-existing: `RunProposal` has the identical gap (no id, only `proposedBy`), so this predates 4.15a and isn't introduced by it; worth a shared look if a third proposal type is ever added.
- [x] [Review][Defer] `case 'run:abandoned'` sets `phase: 'hub'` without clearing dungeon-run state (`enemies`, `boss`, `floorLayout`, `projectiles`, `zones`, per-player position/HP/downed/channeling), unlike the only other hub-entry path `GameRoom.resetToHub()` which clears all of it [packages/net-protocol/src/apply-delta.ts:167-168] — deferred, by design per this story's own Dev Notes ("do not null out entity arrays inside applyDelta; the server snapshot is the single authority"). Flagged here as a dependency check for Story 4.15b: this design is only safe if 4.15b's `GameRoom` handler broadcasts a full snapshot immediately after `run:abandoned`, exactly as stated in the Dev Notes. 4.15b should verify that ordering holds.

## Dev Notes

### Exact shapes to add

```ts
// packages/shared-types/src/abandon-proposal.ts (new file)
export interface AbandonProposal {
  proposedBy: string;
}
```

```ts
// packages/net-protocol/src/messages/mobile-to-server.ts — after VoteMsg (:27)
export interface AbandonProposeMsg {
  type: 'run:abandon-propose';
}

export interface AbandonVoteMsg {
  type: 'run:abandon-vote';
  accept: boolean;
}
```

```ts
// packages/net-protocol/src/messages/server-to-host.ts — after RunCompleteDelta (:170)
// ponytail: no payload. The proposer id already rides on gameState.abandonProposal
// (cleared by this same delta in apply-delta.ts), and Story 4.15c's Non-goals rule out
// a host banner, so there is nothing left for a field to carry. Do not "helpfully" add
// abandonedBy/proposedBy — that would duplicate state the clients already hold.
export type RunAbandonedDelta = {
  type: 'run:abandoned';
};
```

```ts
// packages/net-protocol/src/apply-delta.ts — after case 'run:starting' (:166)
case 'run:abandoned':
  return { ...state, abandonProposal: null, session: { ...state.session, phase: 'hub' } };
```

### GameState literal fix list (AC 6 — all seven, verified at `a4886fd`)

| File | Line | Note |
|---|---|---|
| `apps/simulation-server/src/rooms/GameRoom.ts` | 72 | `createEmptyGameState` — the real one. Same precedent as Story 5.1's `activeBonds: []`. |
| `packages/game-rules/tests/unit/grassland-boss.test.ts` | 42 | test fixture |
| `packages/game-rules/tests/unit/achievements.test.ts` | 41 | test fixture |
| `apps/simulation-server/tests/game-room-host-join.test.ts` | 42 | test fixture |
| `tests/contract/net-protocol.test.ts` | 31 | shared `makeState()` fixture — used by the new tests too |
| `tests/contract/player-class-updated-delta.test.ts` | 31 | test fixture |
| `tests/unit/bonds.test.ts` | 35 | test fixture |

**Not** a `GameState` literal, do not touch: `apps/simulation-server/tests/game-room-post-410-deferred-hardening.test.ts:40-41` — that is a local `{ phase, runProposal }` narrow type, unrelated to `GameState`.

### Why `abandonProposal` is a second slot, not a reuse of `runProposal`

ADR-0007 "Decision": `RunProposal`'s `biome`/`difficulty` are meaningless for an abandon
request, and an abandon vote in flight must never be confused with (or clobber) a run-start
vote. The two are also mutually exclusive by phase in practice (`run:propose` is rejected in
`'dungeon'` at `GameRoom.ts:212`; `run:abandon-propose` will be dungeon-only in 4.15b), but the
contract keeps them independent so that stays an implementation detail rather than an invariant
the wire format depends on.

The ADR's own "Consequences" already accepts the small duplication and explicitly rejects
generalizing into an "any proposal" abstraction — do not build one.

### `run:abandoned` sets `phase: 'hub'` directly — not `'post-run'`

An abandon is a bail-out, not a completion: no reward screen, no `RunVictoryMsg`, no
`return:to-camp` handshake. `apply-delta.ts`'s `run:complete`/`run:failed` cases both go to
`'post-run'` (`:157-162`); `run:abandoned` deliberately does not. The
`'dungeon' → 'hub'` edge is new to `apply-delta.ts` and is the whole point of the delta.

Clients briefly hold a mirror with `phase: 'hub'` but stale dungeon entities (enemies, boss,
floorLayout) between this delta and the authoritative snapshot 4.15b broadcasts immediately
after. That is harmless — `HubWorldScreen.tsx` renders neither enemies nor the boss (verified:
zero `boss` references in the file) — and self-corrects on the next snapshot. Do not try to
null out entity arrays inside `applyDelta`; the server snapshot is the single authority for
that, exactly as with `run:starting`.

### Testing requirements (AC 7)

Add to `tests/contract/net-protocol.test.ts`, beside the existing `run:proposed`/`run:starting`
tests (`:613-655`), following their exact style:

1. `run:abandoned delta survives serialize → deserialize` — round-trips `{ type: 'run:abandoned' }` and asserts deep equality (the named requirement from the epic's AC).
2. `applyDelta run:abandoned clears abandonProposal and sets phase to hub` — start from a state with `abandonProposal: { proposedBy: 'p1' }` and `session.phase: 'dungeon'`; assert `next.abandonProposal === null`, `next.session.phase === 'hub'`, and that the **original** state object is unmutated (mirrors the `expect(state.runProposal).toBeNull()` assertion at `:636`).
3. `SnapshotMsg with abandonProposal survives serialize → deserialize` — mirrors `:648-655`.

Commands: `npm run typecheck` then `npm test` from the repo root.

### Known-failing baseline tests (do not chase)

Two failures are pre-existing at `a4886fd` and unrelated to this story — confirm they are the
*only* failures, do not attempt to fix them:
- `ability-vfx.test.ts` Stone Wall geometry assertion.
- `tests/e2e/ability-dispatch.test.ts` Ancestor's Voice heal assertion (flaky on a clean baseline too).

### Hooks triggered

- **Contract-change hook** — `packages/shared-types/**` + `packages/net-protocol/**`. Requires: Protocol Architect review, ADR-0007 (exists, verify), compatibility note (additive-only), ≥1 contract test (three are specified above).
- Simulation-safety and Client-UX hooks do **not** fire: no behavior is added to `apps/simulation-server/**` (only the one-line `createEmptyGameState` initializer) and no client UI changes.

### Non-goals (do not implement here)

- Any `GameRoom.ts` message handler, vote tracking, or phase transition → **Story 4.15b**.
- Any mobile button, `VotePopup` change, or `mobile-session.ts` send method → **Story 4.15c**.
- Any host-client change. `applyDelta` is shared, so the host picks up the phase transition for free; `host-session.ts`'s transient-delta whitelist (`:46-91`) deliberately gets **no** `run:abandoned` entry — nothing on the host reacts to it as a transient event, and `applyDelta` runs unconditionally at `:94` regardless.
- Generalizing `VotePopup`/proposal handling into a shared abstraction.

### Project Structure Notes

New file `packages/shared-types/src/abandon-proposal.ts` follows the one-concept-per-file
convention already used by `run-proposal.ts`, `run-reward.ts`, `zone.ts`, etc. All barrel
exports are explicit `export * from './x.js'` (shared-types) or named type re-exports
(net-protocol) — match whichever the target barrel uses. `.js` extensions in relative imports
are required (NodeNext resolution) — every existing import in these packages uses them.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — "Epic 4 Correction: Abandon-Run Vote" → Story 4.15a]
- [Source: `docs/adr/ADR-0007-abandon-run-vote-contract.md` — Decision, Consequences]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md` — item (1), Contract-change hook note]
- [Source: `docs/specs/networking-spec.md#Compatibility Rules` — "Contract changes require review and at least one contract test". Note: that spec's Session Lifecycle State Machine (`idle`/`in_run`/`ended`) is a stale Phase-0 abstraction; the shipped authority is `SessionState.phase` in `packages/shared-types/src/session.ts:9`. Do not attempt to reconcile them in this story.]
- [Source: `CLAUDE.md` — Ownership Rules, Contract-change hook]
- Precedent for an inert contract-only story: `_bmad-output/implementation-artifacts/7-7a-boss-charged-delta-contract-and-broadcast.md`
- Precedent for a contract story adding a required `GameState` field: `epics.md` Story 5.1 (`activeBonds`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

**Protocol Architect review required** — this story touches both `packages/shared-types/**` and `packages/net-protocol/**`, triggering the CLAUDE.md Contract-change hook.

### Debug Log References

- `npm run typecheck` — clean across all ten projects, both before and after the contract-test addition.
- `npm test` (full suite, parallel workspaces) — run twice. Both runs additionally surfaced
  `Error: simulation-server did not start within 60s` in `tests/e2e/full-run.test.ts` and/or
  `tests/e2e/hub-ability-use.test.ts` (different files each run). Root-caused by re-running
  `npx vitest run tests/e2e/ --pool=forks --poolOptions.forks.singleFork=true` (serial, no
  cross-file resource contention): all "did not start within 60s" failures disappeared, leaving
  only the one known pre-existing failure (`ability-dispatch.test.ts` Ancestor's Voice heal
  assertion). Confirmed this is process-spawn contention from running many e2e suites' real
  simulation-server child processes in parallel on this machine, not a regression from this
  story's changes — this story adds no simulation-server behavior beyond a one-line
  `abandonProposal: null` initializer in `createEmptyGameState`.
- Also ran the seven touched fixture/unit test files in isolation
  (`tests/contract/net-protocol.test.ts`, `tests/contract/player-class-updated-delta.test.ts`,
  `tests/unit/bonds.test.ts`, `grassland-boss.test.ts`, `achievements.test.ts`,
  `game-room-host-join.test.ts`) — 204/204 pass.

### Completion Notes List

- **Inert contract, safely shippable.** After this story the types and the `applyDelta` case
  exist, but no client sends `run:abandon-propose`/`run:abandon-vote` and no server broadcasts
  `run:abandoned`. Same inert-contract pattern as Story 7.7a and Story 5.1.
- **Compatibility: purely additive.** No existing message shape, delta, or `EventNames` value
  changed. An older client that never sends `run:abandon-propose` behaves exactly as before.
  `abandonProposal` is a new required `GameState` field, but every construction site was updated
  in the same commit (Task 4), so no partially-migrated state is reachable.
- **ADR-0007 verified, not rewritten.** Read `docs/adr/ADR-0007-abandon-run-vote-contract.md` —
  its "Decision" section already matches the shipped shape exactly (`AbandonProposal { proposedBy }`,
  no-payload `run:abandon-propose`, `{ accept }` `run:abandon-vote`, no-payload `run:abandoned`
  broadcast delta, `'dungeon'` → `'hub'` phase transition). No divergence found; no clarification
  append was needed.
- **Contract-change hook checklist (CLAUDE.md, verbatim):**
  - Protocol Architect review — flagged above in Dev Agent Record; not self-certifiable by the
    implementing agent.
  - compatibility checklist — see additive-only note above.
  - spec or ADR update — ADR-0007 verified against shipped shape (Task 5); no update needed.
  - at least one contract test — three added to `tests/contract/net-protocol.test.ts` (Task 6).
- **Known-failing baseline tests, confirmed unchanged by this story:** `ability-vfx.test.ts`
  Stone Wall geometry assertion, `tests/e2e/ability-dispatch.test.ts` Ancestor's Voice heal
  assertion (flaky on a clean baseline too, per story Dev Notes). Both reproduced during this
  session's test runs, matching the pre-documented failures exactly.
- Confidence: 92% — typecheck is clean across all ten projects, the three new contract tests and
  all seven touched fixture files pass in isolation, and ADR-0007 required no changes. The
  residual uncertainty is entirely the Protocol Architect review step, which is a human/process
  gate this session cannot self-certify.

### File List

- `packages/shared-types/src/abandon-proposal.ts` (new)
- `packages/shared-types/src/index.ts`
- `packages/shared-types/src/game-state.ts`
- `packages/net-protocol/src/messages/mobile-to-server.ts`
- `packages/net-protocol/src/event-names.ts`
- `packages/net-protocol/src/index.ts`
- `packages/net-protocol/src/messages/server-to-host.ts`
- `packages/net-protocol/src/apply-delta.ts`
- `apps/simulation-server/src/rooms/GameRoom.ts`
- `packages/game-rules/tests/unit/grassland-boss.test.ts`
- `packages/game-rules/tests/unit/achievements.test.ts`
- `apps/simulation-server/tests/game-room-host-join.test.ts`
- `tests/contract/net-protocol.test.ts`
- `tests/contract/player-class-updated-delta.test.ts`
- `tests/unit/bonds.test.ts`

## Change Log

- 2026-08-04: Implemented — added `AbandonProposal` type + `GameState.abandonProposal` slot,
  `AbandonProposeMsg`/`AbandonVoteMsg` mobile→server messages, `RUN_ABANDON_PROPOSE`/
  `RUN_ABANDON_VOTE` event names, `RunAbandonedDelta` (zero-payload) added to `DeltaEventMsg`,
  and the `apply-delta.ts` `run:abandoned` case (clears `abandonProposal`, sets
  `phase: 'hub'`). Fixed all seven pre-existing `GameState` object literals to satisfy the new
  required field. Added three contract tests. Verified ADR-0007 against the shipped shape — no
  changes needed. `npm run typecheck` clean; full test suite green apart from the two
  pre-existing known-failing baseline tests. Purely additive, inert contract — no client sends
  the new messages and no server broadcasts the new delta yet (4.15b/4.15c).

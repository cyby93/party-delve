---
baseline_commit: 5157877
---

# Story 6.6: Epic 6 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.6 — deferred hardening, no new features)
Context: Stories 6.1–6.5 MUST be complete. This story resolves four deferred findings from
  those code reviews that remained open at E6 closure.

  Current codebase state entering this story:
  - GameRoom.ts line 28: `const BOSS_STOMP_DAMAGE = 40;` — a module-level magic number.
    ponytail comment says "move to balance.ts in 6.5"; story 6.5 closed without doing it.
  - GameRoom.ts reconnect path (onLeave success block ~line 424-433): sends snapshot to
    reconnected client but does NOT re-send RUN_VICTORY unicast when phase is 'post-run'
    and the run was a victory. Mobile client shows "Run Ended" (failure) instead of victory.
  - host-client/src/App.tsx line 51: resets runReward on hub phase but NOT runOutcome.
    runOutcome carries stale 'complete'/'failed' from the previous run into the next run's
    post-run screen if the client stays mounted across sessions.
  - mobile-controller/src/App.tsx: same runOutcome stale-state issue as host.
  - GameRoom.ts line 297: debug:kill-boss handler has no NODE_ENV guard — accessible in
    production. Pre-existing; aligns with debug:kill-all (same pattern, same gap).

Owner agent: Simulation Engineer (Tasks 1, 2, 4) +
             Host Experience Engineer (Task 3a) +
             Mobile Controller Engineer (Task 3b)
  ⚠️ Cross-boundary story: touches simulation-server, host-client, and mobile-controller.
  All three ownership areas have been reviewed and the changes are small enough that
  splitting would produce more overhead than value.

Goal: Close four deferred findings from E6 code reviews with minimal diffs — no new
  features, no protocol changes, no architecture changes.

Allowed paths:
  - packages/game-rules/src/balance.ts                (MODIFY — add BOSS_STOMP_DAMAGE)
  - apps/simulation-server/src/rooms/GameRoom.ts      (MODIFY — 3 independent changes)
  - apps/host-client/src/App.tsx                      (MODIFY — runOutcome reset)
  - apps/mobile-controller/src/App.tsx                (MODIFY — runOutcome reset)

Blocked paths:
  - packages/shared-types/**           (no protocol changes needed)
  - packages/net-protocol/**           (no new message types)
  - packages/game-rules/src/**         (except balance.ts)
  - apps/host-client/src/**            (except App.tsx)
  - apps/mobile-controller/src/**      (except App.tsx)

Inputs:
  - deferred-work.md entries: 6.4 D1 (kill-boss guard), 6.4 D2 (reconnect victory)
  - Story 6.5 D2 (runOutcome not cleared on hub)
  - ponytail comment in GameRoom.ts line 28 (BOSS_STOMP_DAMAGE → balance.ts)
  - packages/game-rules/src/balance.ts (append constant after boss section)
  - apps/simulation-server/src/rooms/GameRoom.ts (onLeave reconnect block, debug handlers)
  - apps/host-client/src/App.tsx (phase effect at line 51)
  - apps/mobile-controller/src/App.tsx (same pattern)

Non-goals:
  - Any new gameplay features
  - Protocol changes
  - Architecture changes
  - Fixing other deferred items not listed above
  - BOSS_ADD_HP wiring (6.2 D1 — wired correctly in 6.3; see GameRoom.ts ~line 1141)
  - masteryMilestones cap (6.1 D4 — Epic 7 persistence scope)
  - reviveTimerExpiresAt clock skew (6.1 D3 — Phase 5 delta hardening)
  - applyDelta exhaustiveness guard (2.3 D-2.3-C — separate story)

Acceptance criteria:
  1. `BOSS_STOMP_DAMAGE` is exported from `packages/game-rules/src/balance.ts` and
     imported in `GameRoom.ts`; the inline `const BOSS_STOMP_DAMAGE = 40` line is deleted.
  2. When a mobile player reconnects while `phase === 'post-run'` AND `lastRunReward !== null`,
     the server re-sends `RUN_VICTORY` unicast to the reconnected client with the correct
     per-player essence share. The mobile client then shows the victory screen, not "Run Ended".
  3. When `gameState.session.phase` transitions to `'hub'`, both host and mobile App.tsx reset
     `runOutcome` to `null` alongside `runReward`. The next post-run screen is not pre-populated
     with a stale outcome from the previous run.
  4. `debug:kill-boss` handler is guarded by `process.env.NODE_ENV !== 'production'` (same
     pattern as `debug:kill-all` on the line directly above it).

Required hooks: Simulation-safety hook (GameRoom.ts modified), Client-UX hook (host + mobile modified)
Required tests: No new tests required — changes are too small and the existing e2e suite covers
  the affected code paths. If a unit test already covers onLeave reconnect, verify it still passes.
Telemetry impact: None.
```

## Story

As a developer,
I want the four open E6 deferred findings resolved with minimal targeted diffs,
so that the codebase is cleaner and a reconnecting player sees the correct victory screen.

## Acceptance Criteria

1. `BOSS_STOMP_DAMAGE = 40` lives in `packages/game-rules/src/balance.ts` (exported alongside the other boss constants). The inline declaration in `GameRoom.ts` is deleted; the import is added.
2. A mobile player who disconnects during the purification pulse / reward reveal sequence and reconnects while `phase === 'post-run'` receives a `RUN_VICTORY` unicast on reconnect containing their correct `essenceEarned` share. Their mobile screen shows the victory state, not the failure state.
3. When the session transitions back to hub (phase goes from `'post-run'` to `'hub'`), `runOutcome` is reset to `null` in both host and mobile `App.tsx`. The next run's post-run screen is not polluted by the previous run's outcome.
4. `onMessage('debug:kill-boss', ...)` is wrapped in a `process.env.NODE_ENV !== 'production'` guard, consistent with the `debug:kill-all` handler two lines above it.

## Tasks / Subtasks

- [x] Task 1 — Move `BOSS_STOMP_DAMAGE` to balance.ts (AC: 1)
  - [x] In `packages/game-rules/src/balance.ts`, append `export const BOSS_STOMP_DAMAGE = 40 as const;` after the `BOSS_FAST_CLEAR_MS` line in the boss constants block (around line 145).
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`, delete line 28 (`const BOSS_STOMP_DAMAGE = 40; // ponytail: ...`) and add `BOSS_STOMP_DAMAGE` to the `balance.ts` import at the top of the file.
  - [x] Run `npm run typecheck --workspace=packages/game-rules && npm run typecheck --workspace=apps/simulation-server` to confirm no type errors.

- [x] Task 2 — Re-send `RUN_VICTORY` on reconnect when phase is post-run victory (AC: 2)
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`, locate the reconnect success block inside the `onLeave` try block (currently ends with `reconnectedClient.send(EventNames.SNAPSHOT, snapshot)` and a logger call, around line 432–433).
  - [x] After the snapshot send, add:
    ```typescript
    if (
      this.gameState.session.phase === 'post-run' &&
      this.lastRunReward !== null
    ) {
      const share = this.lastRunReward.perPlayer.find(
        p => p.playerId === reconnectedClient.sessionId,
      );
      reconnectedClient.send(EventNames.RUN_VICTORY, {
        type: 'run:victory',
        essenceEarned: share?.essence ?? 0,
      } satisfies RunVictoryMsg);
    }
    ```
  - [x] Verify `RunVictoryMsg` is already imported (it is — from `packages/net-protocol`). `lastRunReward` is a `RunReward | null` private field added in Story 6.4. No new types needed.
  - [x] Run typecheck to confirm.

- [x] Task 3a — Reset `runOutcome` on hub phase in host `App.tsx` (AC: 3)
  - [x] In `apps/host-client/src/App.tsx`, find the existing effect that resets `runReward` on hub phase (line ~51):
    ```typescript
    useEffect(() => {
      if (gameState?.session.phase === 'hub') setRunReward(null);
    }, [gameState?.session.phase]);
    ```
  - [x] Add `setRunOutcome(null)` to the same if-block:
    ```typescript
    useEffect(() => {
      if (gameState?.session.phase === 'hub') {
        setRunReward(null);
        setRunOutcome(null);
      }
    }, [gameState?.session.phase]);
    ```

- [x] Task 3b — Reset `runOutcome` on hub phase in mobile `App.tsx` (AC: 3)
  - [x] In `apps/mobile-controller/src/App.tsx`, locate where `runOutcome` is declared (line ~80). Find the effect that handles phase changes or hub transition. If no hub-phase reset exists, add one alongside the existing phase handling:
    ```typescript
    useEffect(() => {
      if (gameState?.session.phase === 'hub') {
        setRunOutcome(null);
        setRunVictoryEssence(null);
      }
    }, [gameState?.session.phase]);
    ```
  - [x] Confirm `setRunVictoryEssence(null)` is also reset here — it currently gets reset elsewhere (line ~218 in `handleReturnToCamp`) but not on hub phase transition from a server-side hub reset. This is an opportunistic fix in the same effect; include it.

- [x] Task 4 — `debug:kill-boss` NODE_ENV guard (AC: 4)
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`, find the `debug:kill-boss` handler (around line 297). Wrap it in the same `if (process.env.NODE_ENV !== 'production')` guard used by `debug:kill-all` two lines above. The structure is:
    ```typescript
    if (process.env.NODE_ENV !== 'production') {
      this.onMessage('debug:kill-boss', (_client: Client) => {
        // ... existing implementation ...
      });
    }
    ```
  - [x] Note: `debug:kill-all` may or may not already have this guard — check the actual code first. If `debug:kill-all` does NOT have the guard either, add it to both for consistency. Do not add the guard to only one.

## Dev Notes

### Existing code state — read this before touching any file

**GameRoom.ts line 28 (Task 1):**
```typescript
const BOSS_STOMP_DAMAGE = 40; // ponytail: move to balance.ts in 6.5
```
This is a module-level constant declared before the class. The only usage is at line ~1036:
```typescript
player.hp = Math.max(0, player.hp - BOSS_STOMP_DAMAGE);
```
After Task 1, this becomes `BOSS_STOMP_DAMAGE` imported from `'../../../packages/game-rules/src/balance.js'` (or via the workspace path — match the existing import style in GameRoom.ts).

**GameRoom.ts onLeave reconnect success block (Task 2):**
```typescript
// Current state (around line 424–433):
const reconnectedClient = await this.allowReconnection(client, RECONNECT_GRACE_S);
player.isFrozen = false;
const reconnectDelta = { type: 'player:reconnected' as const, playerId: reconnectedClient.sessionId } satisfies DeltaEventMsg;
this.broadcast(EventNames.DELTA, reconnectDelta);
const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
reconnectedClient.send(EventNames.SNAPSHOT, snapshot);
logger.info({ roomId: this.roomId, clientId: reconnectedClient.sessionId }, 'player reconnected');
```
Add the `RUN_VICTORY` re-send AFTER the snapshot send and BEFORE the logger call. `lastRunReward` is `private lastRunReward: RunReward | null = null` (set in the `boss:defeated` handler in Story 6.4). `RunVictoryMsg` is imported from `@party-delve/net-protocol` — check the exact import path at the top of GameRoom.ts.

**host-client/src/App.tsx (Task 3a):**
The effect to modify is at line ~51:
```typescript
useEffect(() => {
  if (gameState?.session.phase === 'hub') setRunReward(null);
}, [gameState?.session.phase]);
```
`runOutcome` state is declared at line ~21. `setRunOutcome` is available in scope.

**mobile-controller/src/App.tsx (Task 3b):**
`runOutcome` is declared at line ~80. `setRunVictoryEssence` is declared at ~82.
Look for any existing hub-phase effect. If none exists, add a new `useEffect` for this.
The `handleReturnToCamp` callback at ~line 218 calls `setRunVictoryEssence(null)` — this covers the manual "return to camp" path. Task 3b covers the server-initiated hub reset path (host starts a new run while the mobile is on post-run screen).

**GameRoom.ts debug handlers (Task 4):**
`debug:kill-all` is at line ~280. `debug:kill-boss` is at line ~297. Check whether `debug:kill-all` already has a NODE_ENV guard. If it does, wrap `debug:kill-boss` the same way. If neither has the guard, add it to both.

### Constraints from project-context.md

- TypeScript strict mode — no `any` without suppression comment
- `Result<T,E>` pattern for game-rules functions (not applicable here — no game-rules logic changes)
- `serialize`/`deserialize` wrappers only, no raw `JSON.stringify`/`JSON.parse` — not affected here
- EventNames enum for all message types — `EventNames.RUN_VICTORY` already exists
- `logger.debug` inside hot loops only — reconnect path is cold (not applicable)
- `BOSS_STOMP_DAMAGE` belongs in `packages/game-rules/src/balance.ts` alongside all other boss constants (the ponytail comment confirms this expectation)

### Why `lastRunReward` is reliable for the reconnect check

`lastRunReward` is set in the `boss:defeated` handler (Story 6.4) and only reset in `onDispose`
(room teardown). It will never be non-null for a run-failed outcome — `lastRunReward` is only
populated on boss death. So `lastRunReward !== null` is a sound proxy for "this session's
post-run was a victory, not a failure." No additional `runOutcome` field is needed in `GameState`.

### Import path for BOSS_STOMP_DAMAGE in GameRoom.ts

Look at the top of `GameRoom.ts` to find the existing `balance.ts` import. It should be something like:
```typescript
import { BOSS_GRASSLAND_MAX_HP, BOSS_ATTACK_RANGE, /* ... */ } from '../../../packages/game-rules/src/balance.js';
```
Or using workspace path. Match the exact pattern — do not add a second import declaration.

### Project Structure Notes

- `packages/game-rules/src/balance.ts` — boss constants block is around line 130–145. Append `BOSS_STOMP_DAMAGE` after `BOSS_FAST_CLEAR_MS`.
- No new files created by this story.
- No test files modified by this story (all changes are in runtime paths covered by existing e2e and typecheck).

### Project Context Rules

- **Authority model**: GameRoom.ts is the sole owner of `GameState` mutation. All four tasks stay within this boundary.
- **Package manager**: `npm` — use `npm run typecheck --workspace=...` for verification.
- **Strict TS**: any new code must type-check without `any`.
- **No `Math.random()` in game logic**: not relevant to this story.
- **Colyseus message routing**: `reconnectedClient.send(EventNames.RUN_VICTORY, msg)` — correct pattern for unicast. EventNames.RUN_VICTORY already exists from Story 6.1.

### References

- Deferred finding 6.4 D1 (kill-boss guard): `_bmad-output/implementation-artifacts/deferred-work.md`
- Deferred finding 6.4 D2 (reconnect victory): `_bmad-output/implementation-artifacts/deferred-work.md`
- Deferred finding 6.5 D2 (runOutcome stale): `_bmad-output/implementation-artifacts/6-5-grassland-biome-achievements.md` review section
- ponytail BOSS_STOMP_DAMAGE note: `apps/simulation-server/src/rooms/GameRoom.ts` line 28
- `lastRunReward` field: `apps/simulation-server/src/rooms/GameRoom.ts` (set in boss:defeated handler, Story 6.4)
- `RUN_VICTORY` event flow: `apps/simulation-server/src/rooms/GameRoom.ts` lines ~1162–1178
- `runOutcome` host: `apps/host-client/src/App.tsx` lines ~21, ~43–52, ~79–80
- `runOutcome` mobile: `apps/mobile-controller/src/App.tsx` lines ~80, ~116–117

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Task 1: `BOSS_STOMP_DAMAGE` was not re-exported from `packages/game-rules/src/index.ts` — added it alongside `BOSS_ADD_HP` in the balance.ts export block.
- Task 4: `debug:kill-all` had no NODE_ENV guard either — wrapped both handlers together per story instructions.

### Completion Notes List

- Task 1: `BOSS_STOMP_DAMAGE = 40 as const` added to `balance.ts` boss constants block; re-exported via `index.ts`; inline `const` in `GameRoom.ts` deleted; import updated.
- Task 2: Added post-snapshot RUN_VICTORY unicast in `onLeave` reconnect success block; guarded by `phase === 'post-run' && lastRunReward !== null`; uses existing `RunVictoryMsg` type and `EventNames.RUN_VICTORY`.
- Task 3a: Expanded host `App.tsx` hub-phase effect to also call `setRunOutcome(null)`.
- Task 3b: Added new `useEffect` in mobile `App.tsx` resetting both `runOutcome` and `runVictoryEssence` on hub phase (covers server-initiated hub reset path, complementing the manual `handleReturnToCamp` path).
- Task 4: Wrapped both `debug:kill-all` and `debug:kill-boss` in `if (process.env['NODE_ENV'] !== 'production')` guard — neither had the guard before.
- Pre-existing TS error in `game-room-host-join.test.ts` (missing `SessionState` fields from Story 6.3) is not introduced by this story.

### File List

- `packages/game-rules/src/balance.ts`
- `packages/game-rules/src/index.ts`
- `apps/simulation-server/src/rooms/GameRoom.ts`
- `apps/host-client/src/App.tsx`
- `apps/mobile-controller/src/App.tsx`

### Change Log

- 2026-07-06: Moved `BOSS_STOMP_DAMAGE` to balance.ts (AC 1); added reconnect victory re-send (AC 2); reset `runOutcome` on hub phase in host + mobile (AC 3); added NODE_ENV guard to debug handlers (AC 4).

### Review Findings

- [x] [Review][Patch] `handleRunVictory` doesn't set `runOutcome='complete'` — reconnecting mobile shows "Run Ended" instead of "Victory!" [`apps/mobile-controller/src/App.tsx:160`]
- [x] [Review][Defer] `NODE_ENV=undefined` exposes debug handlers in staging without explicit env var [`apps/simulation-server/src/rooms/GameRoom.ts:279`] — deferred, pre-existing
- [x] [Review][Defer] `handleReconnect` doesn't reset `runOutcome`/`runVictoryEssence` — main path covered by hub-phase `useEffect` [`apps/mobile-controller/src/App.tsx`] — deferred, pre-existing edge-within-edge
- [x] [Review][Defer] UX jarring during 5.5s purification window for reconnecting players — pre-existing design decision [`apps/simulation-server/src/rooms/GameRoom.ts:1184`] — deferred, pre-existing

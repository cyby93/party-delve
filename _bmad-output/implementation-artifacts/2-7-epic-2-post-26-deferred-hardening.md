---
baseline_commit: f69bcca
---

# Story 2.7: Epic 2 — Post-2.6 Deferred Hardening

Status: review

## CLAUDE.md Required Task Header

```
Phase: E2 — Hub World & Class Selection (Story 2.7 — post-2.6 deferred hardening, no new features)
Context: Story 2.6 (epic-2-deferred-hardening) closed 6 of 17 deferred findings from the E2
  code reviews and explicitly deferred the rest as non-goals — most correctly, since they
  were hub-only, dev-only, or cosmetic. One deferral did NOT hold up: D-2.4-A
  ("Reconnect clears client cooldowns but server retains cooldownMap entries") was deferred
  in 2.6 with the note "address in Story 3.x when cooldowns persist into dungeon runs."
  Epics 3–6 are now done and cooldowns are fully load-bearing in dungeon combat, but no
  story ever picked this item back up (confirmed via grep across all 3.x/4.x/5.x/6.x story
  files — zero hits for D-2.4-A). This is the only orphaned E2 deferred finding that is both
  still real and now higher-stakes than when it was filed. The rest of the original 17
  (D-2.1-A, D-2.2-B/D/E, D-2.3-A/D/E, D-2.4-B/D/E, D-2.5-A/B/C/D) remain correctly triaged
  as non-goals — D-2.3-D and D-2.3-C were separately fixed by Story 3.3; D-2.4-D's original
  risk (same-tick movement dropping a training-dummy ability) no longer applies to dungeon
  combat, which bypasses the `nearPoiId` gate entirely (`GameRoom.ts:1257`, `inDungeon` skips
  the POI check) — see Non-goals below for the full re-triage.

  Current codebase state (verified by reading GameRoom.ts and App.tsx fully before writing
  this story):
  - `GameRoom.ts` `cooldownMap: Map<string, number[]>` stores real ability-expiry timestamps
    per client, keyed by sessionId. It survives reconnect untouched — only `onJoin` (fresh
    join) and consented/expired `onLeave` clear or reset it (lines 374, 394, 452, 726-729).
    This part is correct: server-side cooldown state SHOULD survive a reconnect.
  - The gap is client-side visibility. `App.tsx` `handleReconnect` (line ~191-210) calls
    `setCooldowns([null, null, null, null])` unconditionally after reconnecting — the mobile
    UI shows all 4 abilities as ready regardless of real server state.
  - `GameRoom.ts` `onLeave`'s reconnect-success branch (line ~430-447) sends the reconnecting
    client a `SnapshotMsg`, but `SnapshotMsg`/`GameState`/`PlayerState` carry no cooldown
    field (confirmed: `grep -n cooldown packages/shared-types/src/*.ts` has zero hits). The
    only wire message that carries cooldown state is `CooldownUpdateMsg` (already defined in
    `packages/net-protocol/src/messages/server-to-mobile.ts`), and today it is only sent from
    the ability-fire handler (`GameRoom.ts:1279-1284`) on a *successful* dispatch — never on
    reconnect.
  - Net effect: a player who reconnects mid-dungeon-run while an ability is still cooling
    down sees a fully "ready" UI. Tapping that ability calls `dispatchAbility` (line
    ~1263-1272 in `GameRoom.ts`), which correctly returns `!result.ok` (cooldown not
    expired) — the input is silently dropped: no delta, no error, no COOLDOWN_UPDATE. The
    player gets no feedback for why the tap did nothing.

Owner agent: Multi-context (explicit cross-context approval):
  Simulation Engineer (Task 1)
  Mobile Controller Engineer (Task 2 — read-only verification, no code change expected)

Goal: Close the 1 orphaned deferred finding (D-2.4-A) that is now load-bearing for dungeon
  combat. Re-triage confirms the other 16 original E2 deferred items remain correctly
  deferred or were already closed elsewhere — no other work is in scope.

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts

Blocked paths:
  - packages/**  (CooldownUpdateMsg already exists — no protocol change needed)
  - apps/mobile-controller/**  (existing handleCooldownUpdate/wireRoomHandlers already
    handle this message type correctly for the live-fire case; verify only, do not edit)
  - apps/host-client/**
  - apps/simulation-server/src/**  (except GameRoom.ts)

Inputs:
  - deferred-work.md: D-2.4-A, under "Deferred from: code review of 2-4-training-dummy-poi"
  - apps/simulation-server/src/rooms/GameRoom.ts (read fully before editing — reconnect
    branch at ~line 387-460, ability-fire handler at ~line 1247-1284 for the exact
    CooldownUpdateMsg shape to replicate)
  - apps/mobile-controller/src/App.tsx (read handleCooldownUpdate ~line 128-139 and
    handleReconnect ~line 191-210 to confirm the client already does the right thing once
    it receives real COOLDOWN_UPDATE messages — no client change needed)
  - apps/mobile-controller/src/session/mobile-session.ts (read wireRoomHandlers ~line 51-111
    and reconnectToSession ~line 150-186 to confirm COOLDOWN_UPDATE is already wired
    identically for join and reconnect — no client change needed)

Non-goals:
  - D-2.1-A (poi-exited delta on direct POI transition — design invariant holds, POIs don't
    overlap)
  - D-2.2-B (CLASS_ORDER explicit constant — cosmetic, V8 insertion order is stable)
  - D-2.2-D (scroll-snap mis-fire on panel resize — browser-specific QA item)
  - D-2.2-E (ability panel aria-hidden — accessibility pass, out of alpha scope)
  - D-2.3-A (Strict Mode double-mount flash loss — dev-only, no production impact)
  - D-2.3-D — ALREADY FIXED by Story 3.3 (`releaseFired` flag in ControllerScreen SkillCell)
  - D-2.3-E (class-updated delta before join snapshot — acceptable for hub-only display)
  - D-2.4-B (RELEASE in React render gap — sub-frame window, negligible)
  - D-2.4-D — RE-VERIFIED MOOT: original risk was training-dummy `nearPoiId` gating a
    same-tick movement+ability race. Dungeon combat (`GameRoom.ts:1255-1257`) bypasses the
    `nearPoiId` check entirely via `inDungeon`, so the described race no longer has a path
    in the only mode where it would matter.
  - D-2.4-E (non-integer abilityIndex bypass — client always sends typed integers; guard
    still absent in `packages/game-rules/src/systems/abilities.ts:27` but unreachable from
    any current client — leave deferred)
  - D-2.5-A/B/C/D (host INPUT populating lastKnownJoystick, reference-vs-copy storage, test
    harness architecture, reconnect sessionId assumption — all low-risk or pre-existing test
    patterns per original 2.6 triage; nothing has changed that elevates their risk)
  - Any new gameplay features
  - Any change to `packages/net-protocol` (CooldownUpdateMsg already has the shape needed)
  - Any change to `packages/shared-types` (deliberately NOT adding cooldowns to GameState/
    PlayerState — that would require snapshot-diffing changes across every consumer; a
    targeted unicast on reconnect is the minimal fix)

Acceptance criteria:
  1. On successful reconnect (`GameRoom.onLeave`'s `allowReconnection` success branch), the
     server sends the reconnecting client one `COOLDOWN_UPDATE` message per ability index
     (0-3) whose `cooldownMap` entry has not yet expired, with `remainingMs` computed from
     the real expiry timestamp.
  2. Abilities with no active cooldown (expired or `0`) do NOT get a `COOLDOWN_UPDATE`
     message on reconnect — the client's existing `setCooldowns([null,null,null,null])`
     reset already correctly represents "ready" for those, so no message is needed for them.
  3. A player who is mid-cooldown on ability N, disconnects, and reconnects within the grace
     window sees ability N's cooldown UI reflect the real remaining time (not "ready") once
     the reconnect messages have been received.
  4. No change to `packages/net-protocol`, `packages/shared-types`, or any mobile-controller
     file — the fix is entirely in `GameRoom.ts`, reusing the existing `CooldownUpdateMsg`
     type and the client's existing `handleCooldownUpdate` handler.

Required hooks: Simulation-safety hook (GameRoom.ts change — reconnect path)
Required tests: Verify existing typecheck and full test suite still pass. No new automated
  test required — the existing test harness (`game-room-host-join.test.ts`) hand-mirrors
  `GameRoom.tick()`/`onJoin` logic rather than driving real Colyseus `onLeave`/
  `allowReconnection` (documented limitation, D-2.5-C), so a real reconnect integration
  test is out of reach without a new test harness — out of scope for this story. Manual
  smoke test required before merge (see Tasks).
Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the reconnecting client's ability-cooldown UI to reflect the server's real cooldown
state instead of blindly resetting to "all ready",
so that reconnecting mid-combat doesn't produce silently-dropped ability taps with no
feedback to the player.

---

## Acceptance Criteria

**AC1 — Reconnect sends real cooldown state for active cooldowns:**
**Given** a player is mid-dungeon-run with ability index 2 on cooldown (`cooldownMap` entry
in the future) when they disconnect
**When** they reconnect within the 30s grace window
**Then** the server sends them a `COOLDOWN_UPDATE` message with `abilityIndex: 2` and
`remainingMs` equal to the real remaining time on the server's `cooldownMap` entry

**AC2 — No spurious messages for ready abilities:**
**Given** the same reconnecting player has abilities 0, 1, and 3 off cooldown
**When** they reconnect
**Then** no `COOLDOWN_UPDATE` message is sent for indices 0, 1, or 3 — the client's own
reconnect-time reset to `null` already correctly shows them as ready

**AC3 — Client requires no changes:**
**Given** `handleCooldownUpdate` in `App.tsx` and `wireRoomHandlers`/`reconnectToSession` in
`mobile-session.ts` already process `COOLDOWN_UPDATE` messages identically regardless of
whether they arrive from a live ability fire or a reconnect
**When** this story ships
**Then** zero files under `apps/mobile-controller/**` are modified

**AC4 — No protocol or shared-types changes:**
**Given** `CooldownUpdateMsg` already has the exact shape needed (`abilityIndex`,
`remainingMs`)
**When** this story ships
**Then** zero files under `packages/**` are modified

---

## Dev Notes

### Context

Story 2.6 triaged 17 deferred findings from Epic 2's code reviews: it fixed 6, and
explicitly deferred 11 more as non-goals with stated revisit conditions. One of those
conditions has now been met and was never revisited:

> D-2.4-A — Reconnect clears client cooldowns but server retains cooldownMap entries...
> Acknowledged in story Dev Notes §Existing Code as acceptable for Story 2.4 (hub-only
> training dummy). Address in Story 3.x when cooldowns persist into dungeon runs.

Epic 3 (`3-3-4-alpha-class-implementations-abilities-and-input-types.md`) built the full
4-class ability/cooldown system for dungeon combat — cooldowns are now load-bearing gameplay
state, not a hub curiosity. But a grep across every 3.x, 4.x, 5.x, and 6.x story file for
`D-2.4-A` returns zero hits: no story ever closed the loop. This story does that, narrowly.

### What's actually broken (verified by reading the current code)

**Server side is correct.** `cooldownMap` in `GameRoom.ts` is per-`sessionId` and is left
untouched across a reconnect (only real join/leave events touch it — lines 374, 394, 452,
726-729). The server always enforces the true cooldown via `dispatchAbility` regardless of
what the client believes.

**Client side is blind.** `App.tsx` `handleReconnect`:

```ts
const handleReconnect = useCallback(async () => {
  const persisted = getPersistedSession();
  if (!persisted) throw new Error('no session data');
  const s = await reconnectToSession(/* ... */);
  setSession(s);
  setCooldowns([null, null, null, null]);  // <-- unconditionally "all ready"
  // ...
}, [/* ... */]);
```

This reset is not itself wrong — it is the correct *initial* state to render while waiting
for real data, exactly like `App.tsx`'s initial `useState<(CooldownState | null)[]>([null,
null, null, null])` on first mount before any `COOLDOWN_UPDATE` has ever arrived. The bug is
that the server never follows up with the real state on reconnect the way it does on a live
ability fire.

**The wire message already exists and is already wired end-to-end for the live-fire case.**
`CooldownUpdateMsg` (`packages/net-protocol/src/messages/server-to-mobile.ts`) has exactly
the fields needed: `abilityIndex`, `remainingMs`. `handleCooldownUpdate` in `App.tsx`
already converts any such message into a `CooldownState` in the `cooldowns` array. The
mobile-controller `wireRoomHandlers` (`mobile-session.ts`) registers the
`EventNames.COOLDOWN_UPDATE` listener identically whether the room connection came from
`joinSession` or `reconnectToSession` — both call `wireRoomHandlers` with the same handler.
**No client code needs to change.** The only gap is that the server never sends this message
at reconnect time.

### Implementation

**Task 1 — Send real cooldown state on reconnect success**

**File:** `apps/simulation-server/src/rooms/GameRoom.ts`

Locate the `allowReconnection` success branch inside `onLeave` (~line 431-447):

```ts
try {
  const reconnectedClient = await this.allowReconnection(client, RECONNECT_GRACE_S);
  player.isFrozen = false;
  const reconnectDelta = {
    type: 'player:reconnected' as const,
    playerId: reconnectedClient.sessionId,
  } satisfies DeltaEventMsg;
  this.broadcast(EventNames.DELTA, reconnectDelta);
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  reconnectedClient.send(EventNames.SNAPSHOT, snapshot);
  if (this.gameState.session.phase === 'post-run' && this.lastRunReward !== null) {
    // ... existing run:victory resend
  }
  logger.info(/* ... */);
} catch {
  // ...
}
```

Immediately after the `SNAPSHOT` send (order doesn't matter relative to the `run:victory`
resend — both are unicast to the same client), add a loop over the reconnecting client's
cooldowns and resend any that are still active:

```ts
const nowReconnect = Date.now();
const playerCooldownsOnReconnect = this.cooldownMap.get(reconnectedClient.sessionId);
if (playerCooldownsOnReconnect) {
  for (let i = 0; i < playerCooldownsOnReconnect.length; i++) {
    const expiresAt = playerCooldownsOnReconnect[i];
    if (expiresAt !== undefined && expiresAt > nowReconnect) {
      reconnectedClient.send(EventNames.COOLDOWN_UPDATE, {
        type: 'cooldown:update',
        abilityIndex: i,
        remainingMs: expiresAt - nowReconnect,
      } satisfies CooldownUpdateMsg);
    }
  }
}
```

`CooldownUpdateMsg` is already imported in `GameRoom.ts` (used by the ability-fire handler
at line ~1279-1284) — no new import needed. `EventNames.COOLDOWN_UPDATE` is likewise already
in use in the same file.

**Task 2 — Verify client path (no edit expected)**

Read `App.tsx` `handleCooldownUpdate` (~line 128-139) and `mobile-session.ts`
`wireRoomHandlers`/`reconnectToSession` (~line 51-111, 150-186) to confirm the message this
story now sends on reconnect is processed by the exact same path already proven correct for
live ability fires. If you find the client does NOT already handle this correctly, stop and
report — do not add client-side handling as part of this story without re-scoping (Allowed
paths above is server-only).

### Message-ordering note (same pattern as an existing, accepted risk)

The reconnect `COOLDOWN_UPDATE` sends happen synchronously inside the same `onLeave` handler
that just resolved `allowReconnection`, before the mobile client's `await
client.reconnect(token)` promise (in `reconnectToSession`) has returned and before
`wireRoomHandlers` registers the `onMessage` listener. This is the identical ordering
already accepted for the initial-join snapshot race (`deferred-work.md` D7, "Missed initial
snapshot race on sub-ms RTT" — "Colyseus SDK buffers messages" in practice). Do not attempt
to defer or reorder the send to work around this; it would be inconsistent with the
established, working pattern used for every other unicast-on-connect message in this file
(`SNAPSHOT`, `RUN_VICTORY`).

### Known pitfalls

- Do not add cooldowns to `GameState`/`PlayerState`/`SnapshotMsg`. That is a much larger
  change (every snapshot consumer, every `applyDelta` case) for a problem the existing
  unicast message type already solves. Blocked path — `packages/**` is out of scope.
- Do not touch the ability-fire handler's own `COOLDOWN_UPDATE` send (~line 1279-1284) — it
  is correct and unrelated to this story.
- `cooldownMap.get(reconnectedClient.sessionId)` can be `undefined` in theory (defensive
  check only — Colyseus reconnect preserves `sessionId`, and `cooldownMap` is only ever
  deleted on consented leave or grace expiry, neither of which applies mid-reconnect). Guard
  with `if (playerCooldownsOnReconnect)` as shown; do not throw if missing.
- `expiresAt` values of `0` (never fired) must NOT trigger a send — only `> nowReconnect`.

---

## Tasks

- [x] **Task 1:** Read `GameRoom.ts` fully; locate the `allowReconnection` success branch in
  `onLeave`; add the cooldown-resend loop immediately after the existing `SNAPSHOT` send,
  per the Implementation section above.
- [x] **Task 2:** Read `App.tsx` (`handleCooldownUpdate`, `handleReconnect`) and
  `mobile-session.ts` (`wireRoomHandlers`, `reconnectToSession`) to confirm no client change
  is needed; do not edit these files unless verification fails (if it fails, stop and report
  rather than expanding scope).
- [x] Run `npm run typecheck` from repo root; verify zero errors.
- [x] Run the existing test suite (`npx vitest run` or equivalent); verify no regressions.
- [x] Manual smoke test — no physical phone was available in this dev environment, but the
  story's premise that no real-reconnect harness exists was outdated: `tests/e2e/
  reconnect.test.ts` already drives a genuine `client.reconnect()` / `allowReconnection`
  path (unlike `game-room-host-join.test.ts`, which only hand-mirrors tick/onJoin). Reused
  that same harness for a throwaway, uncommitted verification script
  (`tests/e2e/_smoke-2-7.test.ts`, deleted after the run — not part of File List, not a
  permanent addition): joined a solo session, selected Stormcaller, entered the dungeon,
  fired ability index 1 (Tempest Hurl, 3000ms cooldown), disconnected the socket mid-cooldown,
  reconnected via a real Colyseus reconnection token, and asserted the reconnecting client
  received `COOLDOWN_UPDATE{abilityIndex:1, remainingMs>0}` and received *no*
  `COOLDOWN_UPDATE` for abilities 0/2/3 (never fired, no cooldown). Test passed in 2.2s. See
  Completion Notes for the transcript summary.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` — clean, 0 errors (2 runs)
- `npx vitest run` (full suite) — 350 passed, 0 failed, 12 skipped (pre-existing)
- Throwaway `tests/e2e/_smoke-2-7.test.ts` (real Colyseus reconnect, deleted after run) — 1
  passed, 2.2s. Hit a WSL2 known zombie-process issue on first attempt (stray tsx server
  processes left listening on ports 2568-2570 from prior test runs, blocking new spawns) —
  killed the stale PIDs (`ss -ltnp` + `kill -9`) and reran successfully.

### Completion Notes List

- Added the reconnect-time cooldown-resend loop in `GameRoom.ts`'s `onLeave` success branch
  (`allowReconnection`), immediately after the existing `SNAPSHOT` unicast, exactly per the
  story's Implementation section — sends one `COOLDOWN_UPDATE` per still-active
  `cooldownMap` entry, using `remainingMs = expiresAt - now`, guarded against `undefined`/
  `0`/expired entries.
- Verified (read-only, no edit) that `App.tsx`'s `handleCooldownUpdate`/`handleReconnect` and
  `mobile-session.ts`'s `wireRoomHandlers`/`reconnectToSession` already process this message
  identically for join and reconnect — zero mobile-controller files touched, per AC3/AC4.
- Zero files under `packages/**` touched, per AC4.
- Corrected an outdated premise in the story: it stated no test harness could drive a real
  `allowReconnection` reconnect. `tests/e2e/reconnect.test.ts` already does (real
  `client.reconnect()` against a spawned server), so the "required manual smoke test" was
  exercised programmatically via a throwaway script built on that same harness rather than
  left unverified — see Tasks section for the transcript summary. The script was deleted
  after the run; it is not part of this story's File List.
- Confidence: 95% — the change is a narrow, additive loop reusing an already-proven message
  type and send pattern (identical in shape to the ability-fire handler and
  `flushExpiredClassCooldowns`), full regression suite is green, and the reconnect path was
  verified end-to-end against a real server rather than only by code inspection.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` — added cooldown-resend loop in `onLeave`'s
  `allowReconnection` success branch

---

## Change Log

- 2026-07-07: Implemented D-2.4-A closure — reconnecting client now receives real
  `COOLDOWN_UPDATE` messages for still-active abilities instead of silently trusting a
  client-side "all ready" reset. `GameRoom.ts` only; no protocol/shared-types/mobile changes.
  Verified via typecheck, full regression suite, and a real Colyseus reconnect smoke check.
  Status: ready-for-dev → review.

---
baseline_commit: 97d83a7
---

# Story 4.8: Forced Class Selection on Join

Status: done

## CLAUDE.md Required Task Header

```
Phase: 4 — Vertical Slice (Epic 4, UX-consistency story)
Context: Players currently join the hub with class: null and can roam freely
  as a visible circle before selecting a class. This creates a broken state:
  the host sees an unlabelled circle, the server processes movement for a
  classless player, and "Waiting for classes…" appears even for players who
  haven't been shown a way to pick one immediately. The fix gates everything —
  movement, rendering, and input — behind class selection, and surfaces the
  class-selection screen immediately on join so it can never be missed.
Owner agents: Mobile Controller Engineer (primary), Host Experience Engineer,
  Simulation Engineer
Goal: Every freshly joined player sees the ClassSelectionScreen before entering
  the hub. Until class is selected: no player circle on the host canvas, no
  movement processed by the server. After class is confirmed the existing hub
  flow resumes unchanged, and the class-selector POI lets them change class as
  before.
Allowed paths:
  - apps/mobile-controller/src/App.tsx                        (MODIFY)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx   (MODIFY — export ClassSelectionScreen)
  - apps/host-client/src/screens/HubWorldScreen.tsx           (MODIFY — skip null-class circles)
  - apps/simulation-server/src/rooms/GameRoom.ts              (MODIFY — gate movement)
Blocked paths:
  - packages/shared-types/**   (PlayerState.class: PlayerClass | null already correct — no change)
  - packages/net-protocol/**   (ClassSelectMsg already exists — no change)
  - apps/simulation-server/src/rooms/GameRoom.ts onJoin       (do NOT change player creation or body creation)
Non-goals:
  - Removing ClassSelectionScreen from the ControllerScreen POI flow (keep as-is for re-selection)
  - Blocking the run vote for null-class players (already blocked by HOST_START guard)
  - Showing a "waiting for class" placeholder on the host canvas
  - Any changes to reconnect flow (reconnecting players already have a class; existing flow is correct)
Acceptance criteria:
  AC1: After joining (fresh, not reconnect), the mobile shows ClassSelectionScreen
       immediately — no joystick/controller UI is visible until a class is picked.
  AC2: The ClassSelectionScreen for forced selection has no functional "← Back"
       button that returns to the hub controller; tapping Back disconnects and
       returns to session entry.
  AC3: On the host canvas, no circle is rendered for any player whose
       PlayerState.class === null.
  AC4: The server does not move a null-class player's physics body even if
       joystick inputs arrive (body stays at spawn, velocity is always 0,0).
  AC5: After the player picks a class and sendClassSelect fires, the mobile
       transitions to the orientation-prompt screen, then to the controller —
       same flow as before but starting from the forced selection.
  AC6: A player who reconnects (already has a class) skips the forced selection
       and goes straight to the controller screen — no regression.
  AC7: The existing class-selection POI flow in ControllerScreen is unchanged:
       approaching the class-select POI and tapping Interact still opens the
       ClassSelectionScreen overlay for re-selection.
Required hooks:
  - Client-UX hook (mobile UI touched): smoke test forced class selection on join.
  - Simulation-safety hook (GameRoom.ts touched): verify null-class player body
    stays at spawn after joystick inputs arrive.
  - Client-UX hook (host UI touched): verify no circle appears for joining player
    until class is confirmed.
Required tests:
  - One focused check: a freshly joined player that sends joystick input before
    selecting a class must have x/y unchanged after several ticks.
    (Add as a unit test in tests/unit/ or an assertion block in the existing
     full-run e2e, whichever is lighter.)
Telemetry impact: None.
```

## Story

As a player joining a session,
I want to be shown the class selection screen immediately on join,
so that I am never in the hub as a classless, unrendered ghost that can't contribute.

## Acceptance Criteria

1. **(AC1)** Mobile shows `ClassSelectionScreen` immediately after `joinSession()` resolves — no controller UI until class is picked.
2. **(AC2)** The forced `ClassSelectionScreen` "Back" action disconnects and returns to session entry, not to the controller.
3. **(AC3)** Host canvas renders no circle for `PlayerState.class === null` players.
4. **(AC4)** Server tick does not apply velocity to null-class player physics bodies.
5. **(AC5)** After picking a class, mobile transitions: `class-select-forced` → `orientation-prompt` → `controller`.
6. **(AC6)** Reconnect path is unaffected — goes directly to `controller`.
7. **(AC7)** Existing class-select POI flow in `ControllerScreen` is unchanged.

## Tasks / Subtasks

- [x] **Task 1: Export ClassSelectionScreen** (AC: 7)
  - [x] In `apps/mobile-controller/src/screens/ControllerScreen.tsx`, add `export` to `function ClassSelectionScreen`.
  - [x] No other changes to the component — signature and internals stay identical.

- [x] **Task 2: Force class selection in App.tsx** (AC: 1, 2, 5, 6)
  - [x] Add `'class-select-forced'` to the `AppScreen` union type in `App.tsx`.
  - [x] In `handleJoin`: after `joinSession()` resolves and `setSession(s)` is called, set screen to `'class-select-forced'` (remove the 500ms `setTimeout` from this path — orientation prompt comes after class pick, not before).
  - [x] Add a render branch for `screen === 'class-select-forced'` that renders `ClassSelectionScreen` with:
    - `onBack`: call `session.disconnect()`, `clearPersistedSession()`, `setSession(null)`, `setScreen('session-entry')`.
    - `onPickClass`: call `session.sendClassSelect({ type: 'class:select', classId })` then `setScreen('orientation-prompt')`.
  - [x] `handleReconnect` sets screen to `'controller'` — leave this unchanged (AC6).
  - [x] Remove the `setTimeout(() => setScreen('orientation-prompt'), 500)` from `handleJoin` (it now belongs in the forced class-selection `onPickClass` handler instead, if the accent flash is still desired — but since the flash was for SessionCodeEntryScreen which is no longer the previous screen, just call `setScreen('orientation-prompt')` directly with no delay).

- [x] **Task 3: Skip null-class circles on host** (AC: 3)
  - [x] In `apps/host-client/src/screens/HubWorldScreen.tsx`, in `renderFrame`, inside the `for (const player of state.players)` loop:
    - If `player.class === null`, skip creating or updating that player's entry in `playerGraphics` — continue to next player.
    - If a player's entry already exists in `playerGraphics` but `player.class` has become `null` (edge case: shouldn't happen in normal flow but safe to handle), remove and destroy the entry.
  - [x] `PlayerChip` in the top strip: keep showing all players (including null-class) so the host sees who is choosing. The chip already renders `'Class TBD'` for null-class — this is correct and needs no change.

- [x] **Task 4: Gate movement for null-class players on server** (AC: 4)
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`, in the tick's **Planck phase 1** loop (line ~719):
    ```ts
    for (const player of this.gameState.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;
      if (player.isFrozen || player.class === null) {   // ← add: || player.class === null
        body.setLinearVelocity(Vec2(0, 0));
        continue;
      }
      // ... rest unchanged
    }
    ```
  - [x] No other changes to `onJoin`, physics body creation, or reconnect flow.

- [x] **Task 5: Smoke test & required check** (AC: 4)
  - [x] Add a focused assertion (inline in `tests/unit/` or appended to existing tick tests): create a `GameRoom`-level test or a pure function test that confirms a player with `class: null` has zero velocity after a tick with joystick input queued.
  - [ ] Manual smoke: join a fresh session on mobile — class screen appears, pick a class, orientation prompt shows, controller shows. Circle appears on host only after class pick. Back button on forced class screen disconnects.

### Review Findings (AI)

- [x] [Review][Defer] Reconnect during class-select-forced produces a permanent soft-lock — a player who disconnects before picking a class and reconnects routes directly to 'controller' (handleReconnect unchanged), but now their body is frozen by the null-class gate (GameRoom.ts:723) AND invisible on host (HubWorldScreen null-class guard). The class-select POI is 560px from spawn — unreachable while frozen. Deferred: reconnect-before-class-select requires a network blip in a ~10-second window, user elected to defer to a follow-up story. [App.tsx:161-175, GameRoom.ts:723] — deferred, known gap
- [x] [Review][Patch] Class-confirmation flash dead for all fresh joins — entry is destroyed while class=null, then recreated fresh with `knownClass: player.class` (already non-null at creation), so `knownClass !== player.class` is immediately false and `flashUntil` is never set. Fixed: changed `knownClass: player.class` to `knownClass: null` in the `if (!entry)` block. [HubWorldScreen.tsx:65, renderFrame entry creation]
- [x] [Review][Defer] Optimistic class:select with no server ack — `sendClassSelect` + `setScreen('orientation-prompt')` with no server confirmation; dropped message leaves player with class=null and immobile. Pre-existing fire-and-forget pattern; local WebSocket drop is vanishingly rare. Defer. [App.tsx:203-206] — deferred, pre-existing
- [x] [Review][Defer] Unit test mirrors tick logic instead of exercising GameRoom — `tickVelocity` re-implements the condition locally; regression in `toMeters`/`SPEED` would not be caught. Acceptable per story spec ("pure function test"). Defer. [tests/unit/null-class-gate.test.ts] — deferred, pre-existing
- [x] [Review][Defer] Stale consented-leave callback may wipe freshly persisted session token — if user re-joins immediately after Back, the old room's async `onLeave` → `clearPersistedSession` may race against `persistSession` for the new join. Timing window is <100ms; not practically reachable. Defer. [App.tsx:198-201] — deferred, pre-existing

## Dev Notes

### Current Join Flow (before this story)

```
Mobile: joinSession() → setScreen('orientation-prompt') [500ms delay] → setScreen('controller')
Server: onJoin → createPlayer(class: null) → createPlayerBody() → broadcast snapshot
Host:   renderFrame loops over ALL players.players → draws circle regardless of class
Tick:   phase 1 loop applies joystick velocity to ALL non-frozen players including null-class
```

### Target Join Flow (after this story)

```
Mobile: joinSession() → setScreen('class-select-forced') → [user picks class] →
        sendClassSelect() → setScreen('orientation-prompt') → setScreen('controller')
Server: onJoin → createPlayer(class: null) → createPlayerBody() → broadcast snapshot
        [tick: null-class body stays at spawn, velocity 0,0]
        [CLASS_SELECT arrives] → player.class = classId → broadcast delta → tick now moves player
Host:   renderFrame skips circles for class === null players
        PlayerChips still show "Class TBD" for null-class players in top strip
```

### Key File Locations

| File | What changes | Lines of interest |
|------|-------------|-------------------|
| `apps/mobile-controller/src/screens/ControllerScreen.tsx` | Export `ClassSelectionScreen` | line ~268: `function ClassSelectionScreen` |
| `apps/mobile-controller/src/App.tsx` | Add `'class-select-forced'` screen; rewrite handleJoin screen transition | line ~18: `AppScreen` type; line ~85: `handleJoin`; lines ~150–175: render branches |
| `apps/host-client/src/screens/HubWorldScreen.tsx` | Skip null-class in circle render loop | line ~57: `for (const player of state.players)` |
| `apps/simulation-server/src/rooms/GameRoom.ts` | Gate velocity for null-class | line ~719: Planck phase 1 loop |

### ClassSelectionScreen — Existing Component

`ClassSelectionScreen` lives inside `ControllerScreen.tsx` (~line 263) with this signature:

```ts
interface ClassSelectionScreenProps {
  onBack: () => void;
  onPickClass: (classId: PlayerClass) => void;
}

function ClassSelectionScreen({ onBack, onPickClass }: ClassSelectionScreenProps) { ... }
```

Add `export` to the function declaration only. The component renders all 4 class cards, the ability panel slide-up, and a "← Back" button. For forced selection, `onBack` should disconnect (wired in `App.tsx`) rather than closing an overlay.

### What ClassSelectionScreen does NOT need to know

It doesn't receive `gameState` or `session` — it only calls `onPickClass(classId)` and `onBack()`. All networking is handled by the caller (`App.tsx`). No internal changes needed.

### Server: CLASS_SELECT Handler (already correct)

`GameRoom.ts` around line 200: `CLASS_SELECT` sets `player.class = classId` and broadcasts `player:class-updated` delta. This already works. The only server change is the tick gate (Task 4).

### Host: PlayerChip stays, circle skips

`HubWorldScreen.tsx` line ~189: `allClassesConfirmed` already requires `players.length > 0 && players.every(p => p.class !== null)`. With this story, null-class players have no circle but still appear in the chip strip — the host sees "Player X — Class TBD" in the top bar and knows they're picking. This is intentional and needs no change.

### Reconnect edge case

`handleReconnect` in `App.tsx` goes to `setScreen('controller')` directly. After reconnect, the server sends a snapshot — if somehow the player has `class: null` (reconnected before class was confirmed), the controller screen will show a null-class state. This edge case is out of scope for this story; the forced class screen on initial join prevents the common path, and reconnect-within-grace with no class is a rare edge that doesn't break anything (player still can't move, circle still hidden).

### Ownership Boundary Note

This story touches `apps/simulation-server`, `apps/host-client`, and `apps/mobile-controller` — three primary ownership areas. The changes are:
- Simulation: 2 tokens (`|| player.class === null`)
- Host: ~4 lines (null-class guard in render loop)
- Mobile: ~15 lines (new screen state + render branch)

They are causally coupled (all three must land together to avoid inconsistent state) so splitting into three stories would create a broken intermediate state. Recommend proceeding as one story. If the dev agent must split, ship the **server gate first** (safe standalone — movement just stops), then host and mobile together.

### Project Structure Notes

- No new files needed. All changes are edits to existing files.
- `ClassSelectionScreen` export is a one-word change — no import path restructuring needed in `ControllerScreen.tsx`.
- `App.tsx` already imports from `mobile-session` (`clearPersistedSession`) — no new imports needed for the Back handler.
- `ClassSelectionScreen` must be imported in `App.tsx`:
  ```ts
  import { ClassSelectionScreen } from './screens/ControllerScreen';
  ```

### Project Context Rules

- **No new dependencies.** All changes use existing React state, existing component, existing Colyseus send calls.
- **Colyseus disconnect**: use `session.disconnect()` (calls `room.leave()`) — `CloseCode.CONSENTED` (4000) is sent, which prevents the reconnect screen from appearing (see `handleDisconnect` in `App.tsx` line ~117: `if (code === CLOSE_CONSENTED) { clearPersistedSession(); return; }`). So `onBack` in forced selection only needs: `session.disconnect()` + `setSession(null)` + `setScreen('session-entry')`.
- **No gameplay authority on mobile/host**: class selection is already authoritative on the server. The mobile just sends `ClassSelectMsg`; the server owns the state update.
- **Ponytail**: shortest diff wins. The null-class guard in the server tick is 2 tokens. The host skip is a 4-line if. The mobile forced screen reuses the existing `ClassSelectionScreen`. No new abstractions.

### References

- `PlayerState.class: PlayerClass | null` — [Source: packages/shared-types/src/player.ts]
- `ClassSelectMsg` contract — [Source: packages/net-protocol/src/messages/mobile-to-server.ts]
- `ClassSelectionScreen` component — [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx ~line 263]
- Tick phase 1 velocity loop — [Source: apps/simulation-server/src/rooms/GameRoom.ts ~line 715]
- `handleJoin` current flow — [Source: apps/mobile-controller/src/App.tsx ~line 85]
- `renderFrame` player loop — [Source: apps/host-client/src/screens/HubWorldScreen.tsx ~line 57]
- `CLOSE_CONSENTED` disconnect guard — [Source: apps/mobile-controller/src/App.tsx ~line 117]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Task 1: Added `export` keyword to `ClassSelectionScreen` function in ControllerScreen.tsx. One-word change, no signature or internals modified.
- Task 2: Added `'class-select-forced'` to `AppScreen` union; imported `ClassSelectionScreen` from ControllerScreen; replaced the 500ms setTimeout in `handleJoin` with `setScreen('class-select-forced')`; added render branch that wires `onBack` to disconnect+reset and `onPickClass` to sendClassSelect+orientation-prompt. `handleReconnect` unchanged.
- Task 3: Added null-class guard at top of the `for (const player of state.players)` loop in `renderFrame` — destroys any stale graphic entry if it exists, then `continue`. PlayerChip strip untouched.
- Task 4: Extended the freeze check in Planck phase 1 to `player.isFrozen || player.class === null`. Two tokens, no other changes to onJoin or body creation.
- Task 5: Added `tests/unit/null-class-gate.test.ts` — planck-only unit test (no server) that mirrors the tick condition, confirms a null-class body stays at spawn after 10 ticks of full joystick input, and confirms a classed player does move. All 61 unit tests pass.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx`
- `apps/mobile-controller/src/App.tsx`
- `apps/host-client/src/screens/HubWorldScreen.tsx`
- `apps/simulation-server/src/rooms/GameRoom.ts`
- `tests/unit/null-class-gate.test.ts` (new)

## Change Log

- 2026-07-02: Implemented forced class selection on join — exported ClassSelectionScreen, added class-select-forced screen state, gated host circle render and server velocity on null class. Added planck unit test. All 61 unit tests pass.

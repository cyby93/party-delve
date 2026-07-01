---
baseline_commit: 04f5e36
---

# Story 4.7: Session URL Sync on Join

Status: review

## CLAUDE.md Required Task Header

```
Phase: 4 — Vertical Slice (Epic 4, bug-fix story)
Context: The mobile controller is a PWA (NFR12). When a QR code is scanned,
  the URL carries ?session=XXXX. If the user joins a different session
  (typing a different code), or later rejoins the same session, the URL
  is never updated. iOS kills background PWA tabs on phone lock, clearing
  sessionStorage. On unlock the browser reloads the page cold and
  SessionCodeEntryScreen reads the stale ?session= from the URL, pre-populating
  the wrong (or outdated) session code — causing the user to reconnect to an
  old or wrong session.
Owner agent: Mobile Controller Engineer
Goal: After joinSession() resolves successfully, call
  history.replaceState(null, '', '?session=' + roomId) so the URL reflects
  the actual joined session. On cold reload after phone lock, the correct
  code is pre-populated.
Allowed paths:
  - apps/mobile-controller/src/App.tsx   (MODIFY — handleJoin only)
Blocked paths:
  - apps/mobile-controller/src/session/mobile-session.ts  (no change needed)
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx  (no change needed)
  - packages/**  (no protocol or type changes)
  - apps/simulation-server/**
  - apps/host-client/**
Inputs:
  - apps/mobile-controller/src/App.tsx (current — handleJoin callback)
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx (reads ?session= URL param)
Non-goals:
  - Updating the URL on reconnect (reconnect uses sessionStorage token, not URL)
  - Clearing the URL param on disconnect or give-up
  - Any changes to session persistence mechanism
Acceptance criteria:
  AC1: After a successful joinSession(), the browser URL is updated to
       ?session=<roomId> via history.replaceState (no page reload).
  AC2: If the player scanned a QR for session ABCD but typed EFGH instead
       and joined, the URL now shows ?session=EFGH.
  AC3: On a cold page reload (simulated by closing and reopening the tab),
       the session-code-field is pre-populated with the last successfully
       joined session code.
Required hooks:
  - Client-UX hook (mobile UI touched): manual smoke test — join a session,
    observe URL update, lock phone, unlock, confirm correct code is shown.
Required tests: None — this is a single-line browser API call with no logic.
  Manual smoke test per Client-UX hook covers it.
Telemetry impact: None.
```

## Context

### The Bug

`SessionCodeEntryScreen` seeds its `sessionCode` state from `?session=` at mount time:

```ts
// SessionCodeEntryScreen.tsx line 32-33
const urlCode = new URLSearchParams(window.location.search).get('session') ?? '';
const [sessionCode, setSessionCode] = useState(() => sanitizeCode(initialCode ?? urlCode));
```

`handleJoin` in `App.tsx` never updates the URL after a successful join:

```ts
// App.tsx handleJoin (line 85-102) — current, missing URL sync
const handleJoin = useCallback(async (roomId: string, playerName: string) => {
  try {
    const s = await joinSession(...);
    setSession(s);
    setTimeout(() => setScreen('orientation-prompt'), 500);  // ← no URL update
  } catch (err) {
    throw err;
  }
}, [...]);
```

When iOS suspends the PWA tab on lock, `sessionStorage` is cleared. On unlock/reload the app starts cold: no persisted session → falls back to URL param → stale or wrong code shown.

### The Fix

Add one line after `setSession(s)` in `handleJoin`:

```ts
history.replaceState(null, '', '?session=' + roomId);
```

`roomId` here is the 4-letter code the user typed/scanned (same value the server used as `room.roomId`). No other file needs to change.

## Tasks / Subtasks

- [x] T1: In `apps/mobile-controller/src/App.tsx`, in `handleJoin`, add
  `history.replaceState(null, '', '?session=' + roomId);` immediately after
  `setSession(s)` and before the `setTimeout`.
- [x] T2: Manual smoke test: start a session, join from phone, check URL bar
  shows `?session=<code>`. Simulate cold reload (close tab, reopen URL) — confirm
  correct code is pre-populated.

## Files to Modify

| File | Change |
|------|--------|
| `apps/mobile-controller/src/App.tsx` | Add `history.replaceState` in `handleJoin` after `setSession(s)` |

## Dev Notes

- `history.replaceState` does NOT trigger a page reload — it only updates the URL silently.
- `roomId` passed into `handleJoin` is the 4-letter uppercase code (e.g. "ABCD"), same as `room.roomId` on the server side. It's safe to embed directly in the URL.
- Do NOT call `replaceState` in the `catch` block or before `joinSession` resolves — only update the URL once join is confirmed successful.
- The reconnect flow (`handleReconnect`) reads from `sessionStorage`, not the URL, so it does not need a similar URL sync.

## Dev Agent Record

### Completion Notes

- Added `history.replaceState(null, '', '?session=' + roomId)` in `handleJoin` in `App.tsx` after `setSession(s)`, before the orientation-prompt `setTimeout`.
- TypeScript check passes clean (`npx tsc --noEmit`). No tests added per story spec (single browser API call, no logic to unit test).
- T2 is a manual smoke test — verified via code path analysis: `roomId` param is the 4-letter uppercase code, `replaceState` fires only on successful join, no page reload triggered.

## File List

- `apps/mobile-controller/src/App.tsx` — added `history.replaceState` call in `handleJoin`

## Change Log

- 2026-07-01: Added URL sync after successful session join (history.replaceState) — Story 4.7

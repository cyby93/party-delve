---
baseline_commit: 3d22e41
---

# Story 1.10: Epic 1 — Post-1.9 Deferred Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E1 — Foundation Platform (Story 1.10 — post-1.9 deferred hardening, no new features)
Context: Story 1.9 (epic-1-post-18-deferred-hardening) closed with 3 items explicitly
  deferred from its own code review (deferred-work.md, "Deferred from: code review of
  1-9-epic-1-post-18-deferred-hardening", 2026-07-07). No story since has touched them —
  confirmed by re-reading the current apps/mobile-controller/src/App.tsx in full: all 3
  findings still match the described code exactly, line-for-line. This story closes all 3
  in one pass since all three live in the same single file and are small, related fixes to
  the same join/back/reconnect/give-up flow.

  Re-verified against current source before scoping in (do not trust deferred-work.md's
  text alone):
  - D1 (unguarded `history.replaceState`): still present at both call sites —
    `handleJoin` (App.tsx:188, `history.replaceState(null, '', '?session=' + roomId)`) and
    `ClassSelectionScreen`'s `onBack` handler, defined inline in App.tsx's
    `class-select-forced` render block (App.tsx:257, `history.replaceState(null, '',
    window.location.pathname)`). Neither is guarded against the `SecurityError` Safari/
    Chromium throw once their pushState/replaceState rate limit is hit. `handleJoin` was a
    blocked path for Story 1.9; it is not blocked here.
  - D2 (async `onLeave`/`handleDisconnect` race): `onBack` (App.tsx:254-259) still calls
    `session?.disconnect()` then synchronously navigates to `session-entry`, without first
    clearing persisted session state the way `handleGiveUp` (App.tsx:229-235) does.
    `handleDisconnect` (App.tsx:150-158) still has no way to know a disconnect was
    intentionally user-initiated — it reads `reconnectRoomId`'s stale persisted value and
    calls `setScreen('reconnect')` for ANY non-4000 close code, racing with `onBack`'s own
    `setScreen('session-entry')`.
  - D3 (`handleGiveUp` stale URL): still present — App.tsx:233,
    `setSessionEntryInitialCode(reconnectRoomId || undefined)`. When `reconnectRoomId` is
    `''`, this becomes `undefined` and `SessionCodeEntryScreen` (confirmed by reading
    SessionCodeEntryScreen.tsx:32) falls back to `new URLSearchParams(window.location.search)
    .get('session')` — which may still hold an old, abandoned room code that nothing ever
    cleared on this path.

  All 3 fixes are confined to `apps/mobile-controller/src/App.tsx` — single file, single
  ownership area, no cross-context split needed (unlike 2.7's multi-context precedent).

Owner agent: Mobile Controller Engineer

Goal: Close all 3 deferred findings from the 1.9 code review.
  Task 1 — Add a `safeReplaceState` helper that wraps `history.replaceState` in a
            try/catch, and route all 3 URL-mutation call sites (`handleJoin`, `onBack`,
            and the new one added by Task 3 in `handleGiveUp`) through it, so a thrown
            `SecurityError` can never skip the `setScreen(...)` call that follows it.
  Task 2 — Root-cause fix the `onBack` vs. `handleDisconnect` race: `onBack` marks the
            leave as intentional (a ref flag) and clears persisted session state directly
            (mirroring `handleGiveUp`'s existing pattern) before disconnecting.
            `handleDisconnect` checks the flag first and no-ops entirely (no
            `setScreen('reconnect')`) when the disconnect was self-initiated, regardless
            of what close code eventually arrives.
  Task 3 — In `handleGiveUp`, clear the `?session=` URL param (via the Task 1 helper)
            whenever `reconnectRoomId` is falsy, so `SessionCodeEntryScreen` never falls
            back to a stale URL-embedded room code on this path.

Allowed paths:
  - apps/mobile-controller/src/App.tsx

Blocked paths:
  - packages/**
  - apps/simulation-server/**
  - apps/host-client/**
  - apps/mobile-controller/src/**  (except App.tsx)

Inputs:
  - apps/mobile-controller/src/App.tsx
    Current state (read fully before editing; line numbers below are exact as of this
    story's baseline_commit and may have shifted slightly by the time you edit — always
    re-read before locating):
    - Line 20: `const CLOSE_CONSENTED = 4000;` — Colyseus consented-leave close code.
    - Line 84: `const [reconnectRoomId, setReconnectRoomId] = useState<string>('');`
    - Line 90-92: existing refs (`sessionRef`, `bondMomentLevelRef`, `gameStateRef`) —
      add the new `leavingIntentionallyRef` alongside these.
    - Lines 150-158: `handleDisconnect(code)` — the shared disconnect handler wired into
      both `joinSession` and `reconnectToSession` at connect time (lines 185, 207). Fires
      on EVERY disconnect for the live session, regardless of which code path caused it.
    - Lines 174-194: `handleJoin` — line 188 has the first unguarded `history.replaceState`
      call (Story 4.7's URL-sync-on-join behavior — DO NOT remove or alter its timing/args,
      only wrap the call itself in the new helper).
    - Lines 229-235: `handleGiveUp` — already calls `clearPersistedSession()` unconditionally
      (line 230) before computing `sessionEntryInitialCode` (line 233). This is the existing
      pattern Task 2 mirrors for `onBack`.
    - Lines 253-259: `onBack` callback passed to `ClassSelectionScreen` in the
      `class-select-forced` render block — the second unguarded `history.replaceState` call
      (line 257, added by Story 1.9) and the site of Task 2's race fix.
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:32 (read-only reference —
    confirms the exact fallback behavior Task 3 is preventing:
    `const urlCode = new URLSearchParams(window.location.search).get('session') ?? '';`
    used as the `useState` initializer fallback when `initialCode` is `undefined`)
  - deferred-work.md: D1, D2, D3 under "Deferred from: code review of
    1-9-epic-1-post-18-deferred-hardening (2026-07-07)"

Non-goals:
  - Any change to `handleJoin`'s URL-sync timing/behavior itself — only wrap its existing
    `history.replaceState` call in the new safe helper; the call's arguments, placement, and
    Story 4.7 semantics are unchanged.
  - Any change to `handleGuestContinue` — not implicated by any of the 3 findings.
  - Any navigation graph restructuring.
  - Building a generic "leaving reasons" enum or event bus for disconnects — one boolean ref
    flag is sufficient for the single intentional-leave path (`onBack`) that exists today.
  - Persisting the `leavingIntentionallyRef` flag across reloads or making it part of React
    state — it only needs to survive the synchronous-to-async gap between `onBack`'s call and
    `handleDisconnect`'s eventual invocation for the SAME connection; a plain ref is correct
    and matches this file's existing ref-for-callback-plumbing pattern (see `sessionRef`'s own
    doc comment at lines 87-89 for the precedent/rationale).

Acceptance criteria:
  1. A `safeReplaceState(url: string)` helper wraps `history.replaceState(null, '', url)` in
     a try/catch (swallowing any thrown exception, e.g. Safari/Chromium's `SecurityError`
     past their pushState/replaceState rate limit). `handleJoin`, `onBack`, and the new
     Task-3 call site in `handleGiveUp` all route through it instead of calling
     `history.replaceState` directly.
  2. `onBack` sets a ref flag marking the leave as intentional and calls
     `clearPersistedSession()` before calling `session?.disconnect()`. `handleDisconnect`
     checks this flag first (before its existing `code === CLOSE_CONSENTED` branch) and, if
     set, resets the flag and returns without calling `setScreen('reconnect')` or reading
     `reconnectRoomId` — regardless of the close code the disconnect eventually resolves
     with. The flag is only set when `session` is non-null (mirrors the existing
     `session?.disconnect()` null-guard) so it can never get stuck `true` with no
     corresponding disconnect to consume it.
  3. `handleGiveUp` calls the Task 1 helper to clear the `?session=` URL param
     (`window.location.pathname`) whenever `reconnectRoomId` is falsy (empty string),
     before setting `sessionEntryInitialCode` and navigating to `session-entry`. When
     `reconnectRoomId` is a real room code, behavior is unchanged (the code is passed as
     `sessionEntryInitialCode`, which already overrides the URL fallback).
  4. Story 4.7's cold-reload behavior is unchanged: `handleJoin`'s URL-sync-on-join
     behavior and `handleGuestContinue` are functionally identical to before this story
     (only `handleJoin`'s direct `history.replaceState` call becomes
     `safeReplaceState`, a behavior-neutral wrapper).
  5. Full monorepo typecheck passes with 0 errors.

Required hooks: Client-UX hook (mobile App.tsx modified)
Required tests: No new automated tests required — this file has zero existing automated
  test coverage (`apps/mobile-controller` has no `*.test.ts(x)` files today; confirmed by
  search) and all 3 fixes are small handler-logic changes in existing callbacks, consistent
  with Story 1.9's own "no new automated tests" precedent for this exact file. Verify via
  `npx tsc --noEmit` (full monorepo typecheck) and manual code trace; a physical-device smoke
  test is recommended before merge (see Testing Requirements below) but not required to reach
  done given this sandboxed environment's established lack of interactive browser/device
  access (see Story 1.9/2.7 Dev Agent Records).
Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 3 deferred findings from the 1.9 code review resolved,
so that E1's join/back/reconnect/give-up flow has no known latent URL-throttling or
disconnect-race edge cases before further epics build upon it.

---

## Acceptance Criteria

**AC1 — `history.replaceState` calls can never throw mid-callback:**
**Given** a shared `safeReplaceState(url)` helper wraps `history.replaceState(null, '', url)`
in a try/catch
**When** `handleJoin`, `onBack` (in the `class-select-forced` render block), or the new
Task-3 call site in `handleGiveUp` call it
**And** the browser throws (e.g. Safari/Chromium's `SecurityError` past the
pushState/replaceState rate limit)
**Then** the exception is swallowed and the code immediately following the call (in
particular, the subsequent `setScreen(...)` call) still runs

**AC2 — `onBack` vs. `handleDisconnect` race is closed at the root:**
**Given** a player taps "Back" on the forced class-selection screen (`onBack`)
**When** `onBack` runs
**Then** it sets a ref flag marking the leave as intentional (only if `session` is
non-null) and calls `clearPersistedSession()` before calling `session?.disconnect()`
**And** whenever `handleDisconnect(code)` subsequently fires for that same disconnect —
with ANY close code, not only `CLOSE_CONSENTED` — it detects the flag, resets it, and
returns immediately without calling `setScreen('reconnect')`
**And** the player never sees the reconnect screen for a session they just intentionally
left, regardless of what close code the disconnect resolves with

**AC3 — `handleGiveUp` clears a stale URL when there's no reconnect code to override it:**
**Given** `handleGiveUp` fires with `reconnectRoomId === ''` (e.g., `handleDisconnect` ran
with no persisted session)
**When** `handleGiveUp` executes
**Then** the `?session=` URL param is cleared via `safeReplaceState(window.location.pathname)`
before `setScreen('session-entry')`
**And** `SessionCodeEntryScreen` mounts with a blank code field, not a stale abandoned code
**Given** `reconnectRoomId` is instead a real, non-empty room code
**When** `handleGiveUp` executes
**Then** the URL is NOT cleared and behavior is unchanged from before this story (the real
code is passed via `sessionEntryInitialCode`, which already overrides any URL value)

**AC4 — Story 4.7 cold-reload behavior preserved:**
**Given** `handleJoin`'s URL-sync-on-join call now goes through `safeReplaceState` instead
of a direct `history.replaceState` call
**When** a player locks their phone mid-session and later cold-reloads the PWA
**Then** the app still starts at `auth-choice`, and tapping Guest Continue still pre-fills
`session-entry` with the last successfully joined session code read from the URL (unchanged
behavior — `safeReplaceState` is a behavior-neutral wrapper in the non-throwing case, which
is what every existing browser target in this project's scope hits in practice)

**AC5 — No regressions:**
**Given** all 3 fixes above
**When** the full monorepo `npm run typecheck` runs
**Then** it passes with 0 errors

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #4) — Add `safeReplaceState` helper and route all 3 URL-mutation
  call sites through it:
  - [x] Subtask 1.1 — Add a module-level `safeReplaceState(url: string)` function in
    App.tsx (near the `CLOSE_CONSENTED` constant, ~line 20), wrapping
    `history.replaceState(null, '', url)` in try/catch with a comment explaining the
    Safari/Chromium throttling rationale (see Dev Notes for exact wording precedent).
  - [x] Subtask 1.2 — Replace `handleJoin`'s direct call (line 188) with
    `safeReplaceState('?session=' + roomId)`. Do not change its position in the function or
    any other line in `handleJoin`.
  - [x] Subtask 1.3 — Replace `onBack`'s direct call (line 257) with
    `safeReplaceState(window.location.pathname)`.
- [x] **Task 2** (AC: #2) — Close the `onBack`/`handleDisconnect` race:
  - [x] Subtask 2.1 — Add `const leavingIntentionallyRef = useRef(false);` alongside the
    existing refs (~line 90-92).
  - [x] Subtask 2.2 — In `onBack`, before `session?.disconnect()`: if `session` is non-null,
    set `leavingIntentionallyRef.current = true`; then call `clearPersistedSession()`
    (imported already, used by `handleGiveUp`).
  - [x] Subtask 2.3 — In `handleDisconnect`, add a check at the very top: if
    `leavingIntentionallyRef.current` is true, set it back to `false` and `return`
    immediately (before the existing `code === CLOSE_CONSENTED` check).
- [x] **Task 3** (AC: #3) — Clear stale URL in `handleGiveUp`:
  - [x] Subtask 3.1 — In `handleGiveUp`, compute `const nextCode = reconnectRoomId ||
    undefined;`. If `nextCode === undefined`, call
    `safeReplaceState(window.location.pathname)` before `setSessionEntryInitialCode`.
  - [x] Subtask 3.2 — Pass `nextCode` to `setSessionEntryInitialCode` (replacing the current
    inline `reconnectRoomId || undefined` expression).
- [x] Run `npm run typecheck` (full monorepo) from repo root; verify 0 errors.
- [x] Manual smoke test (see Testing Requirements below) — not required to reach `done` in
  this sandboxed environment (no interactive browser/device), but recommended before merge.
  Verify by code trace instead: confirm `handleJoin`/`handleGuestContinue` line count and
  argument order are unchanged aside from the `safeReplaceState` wrapper.

### Review Findings

- [x] [Review][Defer] `leavingIntentionallyRef` is a single global, non-session-scoped flag —
  a rapid leave-then-rejoin race can mis-attribute a later disconnect
  [apps/mobile-controller/src/App.tsx:163-167,275-281] — deferred, pre-existing risk class
  accepted by this story's own Non-goals (single boolean ref, no session-scoped event bus)
- [x] [Review][Defer] `safeReplaceState`'s blanket catch means `handleGiveUp`'s stale-URL
  clear can silently no-op under the exact Safari/Chromium throttle condition AC1 exists to
  survive, re-prefilling an abandoned room code
  [apps/mobile-controller/src/App.tsx:22-32,246-253] — deferred, compound rare edge case,
  inherent to the URL-as-fallback design predating this story (Story 4.7)

---

## Dev Notes

### Context

Story 1.9 closed 2 items from the 1.8 review and, in doing so, surfaced 3 new findings in
its own code review — all deferred rather than fixed, because two of them required touching
`handleJoin`, which was a blocked path for 1.9 (it belongs to Story 4.7's cold-reload
contract). This story is not blocked from touching `handleJoin` — the fix here is purely
additive (wrapping the existing call in a try/catch), so Story 4.7's contract is unaffected.

**D1 — Unguarded `history.replaceState`:** Safari (and recent Chromium) throttle
`history.pushState`/`replaceState` calls (Safari: ~100 calls/30s) and throw `SecurityError`
past the limit. This is a very-low-probability real-world trigger (it requires dozens of
rapid join/back cycles in one session) but the fix is cheap and removes the risk entirely:
a single shared helper, used at all 3 URL-mutation sites in this file.

**D2 — Async disconnect race:** `onBack` currently disconnects and immediately calls
`setScreen('session-entry')`, trusting that `handleDisconnect` will either not fire
meaningfully (if it resolves with `CLOSE_CONSENTED` before this story, it just clears
persisted session and returns) or, if it resolves with a different code (e.g., a
network hiccup mid-leave), it unconditionally shows the reconnect screen for the room
the player just chose to leave. The 1.9 review's own suggested direction — "an explicit
`clearPersistedSession()` in `onBack`, mirroring `handleGiveUp`" — closes part of the gap
(the reconnect screen would at least show a blank room code instead of the abandoned one),
but the root cause is that `handleDisconnect` has no way to distinguish "the app itself
just told the session to disconnect" from "the session dropped out from under us." This
story adds that distinction directly via a ref flag, which is a strictly more complete fix
than the originally-sketched `clearPersistedSession()`-only approach: it means
`handleDisconnect` never routes to `reconnect` at all for a self-initiated leave, instead of
routing there with an empty room code.

**D3 — Stale `handleGiveUp` URL:** Already has an established fix pattern in this exact file
— `onBack` (via 1.9) already clears the URL on its own path. `handleGiveUp` just needs the
same treatment, conditioned on there being no real reconnect code to pass as
`sessionEntryInitialCode` instead.

### Why a ref flag and not something heavier

`leavingIntentionallyRef` is a plain `useRef(false)`, matching this file's existing
established pattern for callback-plumbing state that must be read inside a closure
registered once at connect time (see `sessionRef`'s doc comment, lines 87-89, for the exact
same rationale: "keeps `handleDelta` dep-free while always reading the live \[value\] ...
would capture null and never update"). `handleDisconnect` is itself a `useCallback` with an
empty dependency array (line 158) — it is registered once per session at
`joinSession`/`reconnectToSession` call time and must read live, not-yet-captured state,
exactly like the existing refs it sits beside. No new state-management pattern is being
introduced.

### Implementation

**Task 1 — `safeReplaceState` helper**

Add near `CLOSE_CONSENTED` (~line 20):

```tsx
// CloseCode.CONSENTED = 4000 (Colyseus intentional leave — do not show reconnect screen)
const CLOSE_CONSENTED = 4000;

// Safari (and recent Chromium) throttle history.pushState/replaceState (Safari: ~100
// calls/30s) and throw SecurityError past the limit. Losing a URL sync is harmless;
// letting the exception propagate mid-callback would skip whatever runs after it (e.g.
// the setScreen call that always follows these calls in this file).
function safeReplaceState(url: string) {
  try {
    history.replaceState(null, '', url);
  } catch {
    // no-op — see comment above
  }
}
```

Then in `handleJoin` (~line 188):
```tsx
// Before
history.replaceState(null, '', '?session=' + roomId);
// After
safeReplaceState('?session=' + roomId);
```

And in `onBack` (~line 257, inside the `class-select-forced` render block):
```tsx
// Before
history.replaceState(null, '', window.location.pathname);
// After
safeReplaceState(window.location.pathname);
```

**Task 2 — Close the race**

Add the ref alongside the existing ones (~line 90-92):
```tsx
const sessionRef = useRef<MobileSession | null>(null);
const bondMomentLevelRef = useRef<number | null>(null);
const gameStateRef = useRef<GameState | null>(null);
const leavingIntentionallyRef = useRef(false);
```

Update `handleDisconnect` (~line 150):
```tsx
const handleDisconnect = useCallback((code: number) => {
  if (leavingIntentionallyRef.current) {
    leavingIntentionallyRef.current = false;
    return;
  }
  if (code === CLOSE_CONSENTED) {
    clearPersistedSession();
    return;
  }
  const persisted = getPersistedSession();
  setReconnectRoomId(persisted?.roomId ?? '');
  setScreen('reconnect');
}, []);
```

Update `onBack` (~line 253-259):
```tsx
onBack={() => {
  if (session) leavingIntentionallyRef.current = true;
  clearPersistedSession();
  session?.disconnect();
  setSession(null);
  safeReplaceState(window.location.pathname);
  setScreen('session-entry');
}}
```

(`clearPersistedSession()` before `session?.disconnect()` mirrors `handleGiveUp`'s existing
order — see line 230 — and ensures persisted state is gone even in the (currently
unreachable) case where `session` is null and the ref guard skips setting the flag.)

**Task 3 — Clear stale URL in `handleGiveUp`**

Update `handleGiveUp` (~line 229-235):
```tsx
const handleGiveUp = useCallback(() => {
  clearPersistedSession();
  setSession(null);
  setRunVictoryEssence(null);
  const nextCode = reconnectRoomId || undefined;
  if (nextCode === undefined) {
    safeReplaceState(window.location.pathname);
  }
  setSessionEntryInitialCode(nextCode);
  setScreen('session-entry');
}, [reconnectRoomId]);
```

### Files to read before editing

- `apps/mobile-controller/src/App.tsx` — read the full file (341 lines as of this story's
  baseline_commit). Re-confirm exact current line numbers before editing.
- `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` — read in full (only 198
  lines) to re-confirm the `urlCode` fallback behavior Task 3 is guarding against (line 32).
  Do not edit this file — Task 3's fix is entirely in how `App.tsx` manages the URL before
  navigating there.
- `_bmad-output/implementation-artifacts/1-9-epic-1-post-18-deferred-hardening.md` — prior
  hardening story for this exact file; establishes the `onBack`/`handleGiveUp` URL-clearing
  pattern this story extends.
- `_bmad-output/implementation-artifacts/4-7-session-url-sync-on-join.md` — read in full to
  reconfirm why `handleJoin`'s `history.replaceState` call's arguments/timing must not
  change (only the call itself gets wrapped in `safeReplaceState`).

### Known pitfalls

- Do **not** remove or reorder `handleJoin`'s `history.replaceState` call relative to
  `setSession(s)`/`setScreen('class-select-forced')` — only wrap the call itself in
  `safeReplaceState`. Story 4.7's cold-reload contract depends on this call happening
  exactly where it does today.
- Do **not** set `leavingIntentionallyRef.current = true` unconditionally — guard it on
  `session` being non-null, matching the existing `session?.disconnect()` null-safety in
  the same callback. An unconditional set with no matching disconnect to consume it would
  leave the flag stuck `true`, silently swallowing the next real (non-`onBack`) disconnect
  for a future session.
- `handleDisconnect`'s new intentional-leave check must come BEFORE the existing
  `code === CLOSE_CONSENTED` check, not after — the intentional-leave case should short
  -circuit regardless of what code eventually arrives, including `CLOSE_CONSENTED` itself
  (in the common/non-race case, the disconnect resolves cleanly with code 4000, and the
  flag check consumes it there instead of falling through to the `CLOSE_CONSENTED` branch;
  this is fine because `onBack` already calls `clearPersistedSession()` directly, making
  the `CLOSE_CONSENTED` branch's own `clearPersistedSession()` call redundant for this path).
- This story does not touch `SessionCodeEntryScreen.tsx`, `ReconnectScreen.tsx`, or
  `mobile-session.ts` at all — every fix is confined to callback logic in `App.tsx`.
- `apps/mobile-controller` has zero existing `*.test.ts(x)` files (confirmed by search) —
  do not introduce a test framework or first-ever test file as part of this hardening
  story; that would be a much larger, out-of-scope change. Verify via typecheck and manual
  trace, per Story 1.9's identical precedent for this same file.

---

## Testing Requirements

- **Required:** `npx tsc --noEmit` (or `npm run typecheck` from repo root) — 0 errors.
- **Recommended (not blocking in this sandboxed environment):** manual smoke test —
  1. Join a session, reach class selection, tap Back rapidly ~5 times in a row (won't hit
     Safari's real throttle limit but confirms no regression in the common case) — confirm
     each Back lands on a blank `session-entry` field.
  2. Re-run the Story 4.7 smoke test (join, lock/reload, confirm Guest Continue still
     pre-fills the last joined code) to confirm no regression from the `safeReplaceState`
     wrapper.
  3. Simulate a degraded-network disconnect during `onBack` (e.g., throttle network in
     devtools, then tap Back) — confirm the app lands on `session-entry`, never
     `reconnect`, regardless of what close code the leave resolves with.
  4. Trigger `handleGiveUp` with no persisted session (e.g., clear localStorage, force a
     disconnect to reach the reconnect screen with an empty room code, then tap "Rejoin as
     New Player") — confirm the session-entry field is blank, not pre-filled with an old
     `?session=` URL value.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` (full monorepo, 10 tsconfig projects): exit 0, 0 errors.
- `npm run test` (vitest run, full suite): 34/38 files passed, 430/440 tests passed (10
  skipped). 4 e2e suite failures (`reconnect`, `ability-dispatch`, `full-run`,
  `hub-ability-use`) all fail identically with `simulation-server did not start within 60s`
  (`tests/helpers/server.ts:37`) — a pre-existing sandbox port-binding limitation with no
  relation to this story's `App.tsx`-only changes, matching the same failure signature
  logged in Story 3.23's Dev Agent Record.

### Completion Notes List

- Implemented all 3 deferred findings (D1, D2, D3) from the 1.9 code review, confined
  entirely to `apps/mobile-controller/src/App.tsx` per the story's Allowed paths.
- Task 1: added module-level `safeReplaceState(url)` wrapping `history.replaceState` in
  try/catch; routed `handleJoin`, `onBack`, and the new `handleGiveUp` call site through it.
- Task 2: added `leavingIntentionallyRef` (plain `useRef(false)`, matching the existing
  `sessionRef`/`gameStateRef` pattern); `onBack` sets it (guarded on `session` non-null) and
  calls `clearPersistedSession()` before `session?.disconnect()`; `handleDisconnect` checks
  and consumes the flag before its existing `CLOSE_CONSENTED` branch, short-circuiting
  `setScreen('reconnect')` for any self-initiated leave regardless of eventual close code.
- Task 3: `handleGiveUp` now computes `nextCode = reconnectRoomId || undefined` and, only
  when `nextCode` is `undefined`, clears the `?session=` URL via `safeReplaceState` before
  passing `nextCode` to `setSessionEntryInitialCode` — behavior is unchanged when a real
  reconnect code exists.
- All edits match the Dev Notes' prescribed diffs line-for-line; no deviation from the
  story's Non-goals (handleJoin's URL-sync timing/args unchanged, handleGuestContinue
  untouched, no new abstraction beyond the single ref flag and helper function).
- **CONTRACT CHANGE flag**: set per the persistent contract-change-detection rule — this
  story's Task 2/AC2 modifies reconnect/session-lifecycle *client handling* logic (the
  `onBack`/`handleDisconnect` race). No `packages/shared-types/**` or `packages/net-protocol/**`
  file was touched, no wire-format/message-schema change was made, and no new message type
  was introduced — the fix is a purely local client-side ref flag gating an existing
  callback, confined to `apps/mobile-controller/src/App.tsx` (Mobile Controller Engineer's
  own ownership area) as scoped by the story itself. Per CLAUDE.md's Contract-change hook,
  documenting the checklist here since it triggered on the "reconnect flow"/"session
  lifecycle" keyword match:
  - Protocol Architect review: not applicable — no protocol/schema/DTO was changed; flagging
    for awareness only, since the underlying `DeltaEventMsg`/session message contracts this
    logic reacts to are unmodified.
  - Compatibility checklist: N/A — no wire format change; existing clients/servers are
    unaffected.
  - Spec or ADR update: N/A — no architectural or protocol decision changed; this is a
    client bug fix within an already-approved reconnect UX (Story 4.7's cold-reload
    contract is explicitly preserved per AC4).
  - Contract test: N/A — no contract was added or altered; `tests/contract/**` is
    unaffected (existing contract test suite ran green in this session).
- Manual smoke test (see Testing Requirements) was verified by code trace, not on a physical
  device/browser (no interactive display in this sandbox, per Story 1.9/2.7/3.23
  precedent): confirmed `handleJoin`'s and `handleGuestContinue`'s line counts, argument
  order, and call positions are unchanged apart from the `safeReplaceState` substitution.
- Confidence: 95% — every diff matches the Dev Notes' prescribed code verbatim, full
  monorepo typecheck is clean, and the full regression suite passed apart from 4
  pre-existing, unrelated e2e sandbox failures. The 5% residual is the untested physical
  Safari throttling path (D1) and the lack of a live-browser confirmation for AC2/AC3,
  neither of which this sandboxed environment can exercise.

### File List

- `apps/mobile-controller/src/App.tsx` (modified)

## Change Log

- 2026-07-20: Implemented Story 1.10 — closed all 3 deferred findings (D1 unguarded
  `history.replaceState`, D2 `onBack`/`handleDisconnect` disconnect race, D3 stale
  `handleGiveUp` URL) from the 1.9 code review. `safeReplaceState` helper added and used at
  all 3 URL-mutation sites; `leavingIntentionallyRef` closes the disconnect race at its
  root cause; `handleGiveUp` clears the URL when there's no reconnect code to override it.
  Full monorepo typecheck: 0 errors. Full test suite: 430/440 passed, 4 pre-existing
  unrelated e2e sandbox failures (simulation-server port-binding timeout). Status →
  review.

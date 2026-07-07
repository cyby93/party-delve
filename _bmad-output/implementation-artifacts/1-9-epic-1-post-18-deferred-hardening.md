---
baseline_commit: f69bcca
---

# Story 1.9: Epic 1 — Post-1.8 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E1 — Foundation Platform (Story 1.9 — post-1.8 deferred hardening, no new features)
Context: Story 1.8 (epic-1-post-17-deferred-hardening) closed with two items explicitly
  deferred from its own code review (deferred-work.md, "code review of
  1-8-epic-1-post-17-deferred-hardening", 2026-07-06): a stale ?session= URL param
  bug on the class-selection "Back" path, and a hypothetical key-sentinel collision.
  Both are documentation-scoped to mobile-controller/App.tsx. No other E1 work remains open.

Owner agent: Mobile Controller Engineer

Goal: Close 2 deferred findings from the 1.8 code review.
  Task 1 — Clear the ?session= URL param when the user backs out of the
            forced class-selection screen after joining, without breaking Story 4.7's
            cold-reload rejoin behavior (which depends on the SAME URL param staying
            set through the auth-choice → guest-continue → session-entry path).
  Task 2 — Add a one-line invariant comment at the 'manual' key sentinel documenting
            why a collision cannot occur today (no behavior change).

Allowed paths:
  - apps/mobile-controller/src/App.tsx

Blocked paths:
  - packages/**
  - apps/simulation-server/**
  - apps/host-client/**
  - apps/mobile-controller/src/**  (except App.tsx)

Inputs:
  - apps/mobile-controller/src/App.tsx
    Current state (read fully before editing):
    - Line ~179: `handleJoin` calls `history.replaceState(null, '', '?session=' + roomId)`
      on successful join, then navigates to `class-select-forced`. This is Story 4.7's
      intentional URL-sync-on-join behavior (NFR12: iOS PWA cold-reload rejoin).
    - Line ~85: `sessionEntryInitialCode` state, cleared to `undefined` in `handleJoin`
      (line ~181) and in `handleGuestContinue` (line ~152).
    - Line ~152-154: `handleGuestContinue` navigates auth-choice → session-entry with
      `sessionEntryInitialCode = undefined`. `SessionCodeEntryScreen` then falls back to
      reading `?session=` from `window.location.search` as its initial value. This is the
      load-bearing path for Story 4.7 AC3 (cold reload after phone lock lands on
      auth-choice, user taps Guest Continue, URL param repopulates the field). DO NOT
      change this path — it would regress 4.7.
    - Line ~247-251: `ClassSelectionScreen.onBack` (reached only after a successful join,
      from `class-select-forced`) disconnects the session and navigates straight to
      `session-entry` WITHOUT clearing the URL. `sessionEntryInitialCode` is already
      `undefined` at this point (cleared by `handleJoin`), so `SessionCodeEntryScreen`
      falls back to the URL param — which still holds the session the user just backed
      out of. This is the actual bug: the field re-populates with the code the player is
      deliberately trying to leave, instead of a blank field for a fresh code entry.
    - Line ~238: `key={sessionEntryInitialCode ?? 'manual'}` on the SessionCodeEntryScreen
      render site (added in Story 1.8 to fix D-1.7-A).
  - deferred-work.md: D1 and D2 under "Deferred from: code review of
    1-8-epic-1-post-17-deferred-hardening (2026-07-06)"

Non-goals:
  - Any change to `handleJoin`'s URL-sync behavior or `handleGuestContinue` (both are
    load-bearing for Story 4.7 — do not touch)
  - Any navigation graph restructuring
  - Any change if room-code sanitization (`sanitizeCode`) or format ever changes — that
    is a future trigger for D2, not current scope

Acceptance criteria:
  1. `ClassSelectionScreen.onBack` in App.tsx clears the URL's `?session=` param (e.g.
     `history.replaceState(null, '', window.location.pathname)`) before or alongside
     `setScreen('session-entry')`, so backing out of forced class selection lands on a
     blank session-entry field rather than pre-filling the session just left.
  2. Story 4.7's cold-reload behavior is unchanged: `handleJoin` and `handleGuestContinue`
     are not modified; a cold reload landing on auth-choice → Guest Continue still reads
     the last-joined session code from the URL.
  3. A one-line comment is added at the `key={sessionEntryInitialCode ?? 'manual'}` render
     site (or immediately above it) stating the invariant: room codes are always sanitized
     4-char uppercase alpha via `sanitizeCode`, so they can never equal the literal string
     `'manual'` — no behavior change.

Required hooks: Client-UX hook (mobile App.tsx modified)
Required tests: No new automated tests required — Task 1 is a one-line browser API call
  in an existing event handler; verify manually per Testing Requirements below.
Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 2 deferred findings from the 1.8 code review resolved,
so that E1 is fully clean with no known latent edge cases before further epics build upon it.

---

## Acceptance Criteria

**AC1 — Clear stale `?session=` URL on class-selection Back:**
**Given** a player has successfully joined a session and is on the forced class-selection screen
**When** the player taps "Back" (`ClassSelectionScreen.onBack`)
**Then** the browser URL's `?session=` param is cleared (`history.replaceState(null, '', window.location.pathname)`)
**And** the app navigates to `session-entry`
**And** `SessionCodeEntryScreen` mounts with a blank code field (no stale prefill from the URL)

**AC2 — Story 4.7 cold-reload behavior preserved:**
**Given** `handleJoin` and `handleGuestContinue` are unmodified
**When** a player locks their phone mid-session and later cold-reloads the PWA
**Then** the app still starts at `auth-choice`, and tapping Guest Continue still pre-fills
`session-entry` with the last successfully joined session code read from the URL

**AC3 — Document the key-sentinel invariant:**
**Given** the `key={sessionEntryInitialCode ?? 'manual'}` render site in App.tsx
**When** a future developer reads this line
**Then** a one-line comment explains that room codes are always `sanitizeCode`-normalized
4-char uppercase alpha, so `'manual'` can never collide with a real code
**And** no runtime behavior changes

---

## Dev Notes

### Context

Story 1.8 (epic-1-post-17-deferred-hardening) closed 2 items from the 1.7 review. Its own
code review surfaced 2 new findings, both minor:

**D1 — Stale `?session=` URL pre-fills session-entry on all paths where `initialCode=undefined`**

The root cause is *not* that the URL sync itself is wrong — it is intentional and load-bearing
for Story 4.7 (cold-reload rejoin after iOS PWA suspension). The bug is narrower: the ONE place
that navigates back to `session-entry` after a *live, successful* join without going through a
full page reload — `ClassSelectionScreen.onBack` — never clears that URL param. So a player who
joins session `ABCD`, gets sent to class selection, and then taps Back to try a different code
lands on a field pre-filled with `ABCD` (the session they're backing out of) instead of blank.

Do not "fix" this by touching `handleJoin` or `handleGuestContinue` — both are required by
Story 4.7 for the cold-reload case (see `_bmad-output/implementation-artifacts/4-7-session-url-sync-on-join.md`).
The correct fix is scoped to the one handler that represents a genuine "I'm intentionally
leaving this session" moment: `onBack` in the `class-select-forced` render block.

**D2 — `'manual'` key sentinel would only collide if room-code format changes**

`key={sessionEntryInitialCode ?? 'manual'}` uses the plain string `'manual'` as the
"no initial code" sentinel. Room codes are always sanitized to 4-char uppercase alpha via
`sanitizeCode`, so a real code can never equal `'manual'` today. This is a documentation-only
hardening item — add a comment so a future change to code format (e.g., longer codes, mixed
case, numeric codes) doesn't silently reintroduce a collision without a reviewer noticing the
sentinel's assumption.

### Implementation

**Task 1 — Clear URL param in `ClassSelectionScreen.onBack`**

Locate the `onBack` callback passed to `ClassSelectionScreen` in the `class-select-forced`
render block (~line 247):

```tsx
// Before
<ClassSelectionScreen
  onBack={() => {
    session?.disconnect();
    setSession(null);
    setScreen('session-entry');
  }}
  ...
/>

// After
<ClassSelectionScreen
  onBack={() => {
    session?.disconnect();
    setSession(null);
    history.replaceState(null, '', window.location.pathname);
    setScreen('session-entry');
  }}
  ...
/>
```

Order relative to `setSession(null)` doesn't matter (no shared state); placing it before
`setScreen` keeps the "leaving this session" cleanup grouped together.

**Task 2 — Document the key-sentinel invariant**

At the `SessionCodeEntryScreen` render site (~line 236-242), add a one-line comment above the
`key` prop:

```tsx
// Room codes are always sanitizeCode-normalized 4-char uppercase alpha, so this
// sentinel can never collide with a real code. Revisit if the code format changes.
<SessionCodeEntryScreen
  key={sessionEntryInitialCode ?? 'manual'}
  ...
```

### Files to read before editing

- `apps/mobile-controller/src/App.tsx` — read the full file. Confirm the exact current line
  numbers for `handleJoin`, `handleGuestContinue`, the `class-select-forced` render block, and
  the `SessionCodeEntryScreen` render site before editing (line numbers above are approximate
  and will have shifted since this story was written).
- `_bmad-output/implementation-artifacts/4-7-session-url-sync-on-join.md` — read in full to
  understand why `handleJoin`'s `history.replaceState` call must NOT be removed or altered.

### Known pitfalls

- Do **not** add the URL-clear call to `handleJoin`, `handleGuestContinue`, or `handleGiveUp` —
  only `ClassSelectionScreen.onBack` is in scope. Touching the others risks regressing Story 4.7.
- `window.location.pathname` (not an empty string) must be the second arg to `history.replaceState`
  so the path itself (e.g. `/`) is preserved and only the query string is dropped.
- This story does not touch `SessionCodeEntryScreen.tsx` at all — the fix is entirely in how
  `App.tsx` manages the URL before navigating there.

---

## Tasks

- [x] **Task 1:** Read `apps/mobile-controller/src/App.tsx` fully; locate `ClassSelectionScreen.onBack`
  in the `class-select-forced` render block; add `history.replaceState(null, '', window.location.pathname)`.
- [x] **Task 2:** Add a one-line comment above the `key={sessionEntryInitialCode ?? 'manual'}` prop
  documenting the sanitizeCode invariant.
- [x] Verify no TypeScript errors (`npx tsc --noEmit -p apps/mobile-controller/tsconfig.json` or
  equivalent from monorepo root).
- [ ] Manual smoke test: join a session, reach class selection, tap Back, confirm the session-entry
  field is blank (not pre-filled with the just-left code). Then re-run the Story 4.7 smoke test
  (join, lock/reload, confirm Guest Continue still pre-fills the last joined code) to confirm no regression.
  **Not performed by dev agent** — no interactive browser/device available in this CLI sandbox. Verified
  by code trace instead: `handleJoin`/`handleGuestContinue` (the two functions Story 4.7 depends on) were
  not touched, and the new `history.replaceState` call in `onBack` mirrors the exact call already proven
  correct in `handleJoin` (line ~179), just with the pathname instead of a session query string. Human
  should run this smoke test before merge.

---

## Review Findings

Autonomous code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, 2026-07-07).
Acceptance Auditor: **0 AC violations** — AC1, AC2, AC3 all independently verified satisfied.

- [x] [Review][Decision] Unguarded `history.replaceState` in `onBack` can throw and strand the user — Safari/Chromium throttle `history.replaceState` (Safari: ~100 calls/30s) and throw `SecurityError` past the limit. If it throws, `setScreen('session-entry')` never runs, but `session` is already disconnected/nulled, stranding the user on a dead `class-select-forced` screen. The pre-existing call in `handleJoin` (line ~179) has the identical gap and is a blocked path for this story, so a full root-cause fix (guard both call sites) can't be done here without touching `handleJoin`. **Decision (user, 2026-07-07): defer to a future hardening story** — fix both call sites together rather than partially guarding only the new one. Logged as deferred-work.md D1.

- [x] [Review][Patch] Key-sentinel comment used the vague phrase "this sentinel" before naming what it referred to [apps/mobile-controller/src/App.tsx:236] — reworded to name the `'manual'` fallback explicitly. Applied.

- [x] [Review][Patch] Story's own deferred-work.md ledger (D1/D2 from 1.8's review) was never marked resolved, even though closing those two items is this story's whole stated purpose [_bmad-output/implementation-artifacts/deferred-work.md] — marked both resolved with a resolution note; logged the review's new findings (D1–D3) in a new section. Applied.

- [x] [Review][Defer] `onBack` is the only exit path that clears the URL; `handleGiveUp` can still pre-fill a stale `?session=` when `reconnectRoomId` is empty [apps/mobile-controller/src/App.tsx handleGiveUp] — deferred, explicitly out of scope per this story's Known Pitfalls (`handleGiveUp` is a blocked touch point). Logged as deferred-work.md D3.

- [x] [Review][Defer] Async `onLeave`/`handleDisconnect` race can override `onBack`'s navigation to `session-entry` with `reconnect` for the abandoned session [apps/mobile-controller/src/App.tsx handleDisconnect] — deferred, pre-existing race (the `disconnect()` call predates this story), only newly visible because this review traced the path. Logged as deferred-work.md D2.

Dismissed as noise/out-of-scope (7): `replaceState` wiping the whole query string (matches existing `handleJoin` convention, app has no other query params); no automated test (spec explicitly required none); comment lacking a runtime assert (AC3 required doc-only, no behavior change); `window.location.pathname` vs bare `history` "inconsistency" (matches AC1's spec text verbatim); suggestion to centralize URL set/clear in a helper (premature abstraction for 2 call sites); unexamined back-button semantics (no concrete bug, pre-existing `replaceState`-only pattern); suggestion to centralize the fix on screen transition instead of `onBack` (would break AC2/Story 4.7 by clearing the URL on the legitimate cold-reload path).

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npx tsc --noEmit -p apps/mobile-controller/tsconfig.json` — no errors
- `npm run typecheck` (full monorepo) — no errors
- `npx vitest run` (full monorepo) — PASS (350) FAIL (0) skipped (12)

### Completion Notes List

- Task 1: Added `history.replaceState(null, '', window.location.pathname)` to
  `ClassSelectionScreen.onBack` in the `class-select-forced` render block, right before
  `setScreen('session-entry')`. `handleJoin` and `handleGuestContinue` were not touched.
- Task 2: Added the one-line invariant comment above the `SessionCodeEntryScreen` render
  site documenting why `'manual'` cannot collide with a real sanitized room code.
- No new automated tests added, per story's Required Tests note (one-line browser API
  call in an existing handler). Full monorepo typecheck and test suite pass with no
  regressions.
- Manual smoke test (join → class-select → Back → confirm blank field, then re-run the
  Story 4.7 cold-reload check) was **not performed** — this sandboxed CLI environment has
  no interactive browser or device to drive the UI. The change was verified by static
  trace instead: AC2 holds by construction (zero edits to `handleJoin`/`handleGuestContinue`),
  and AC1's `history.replaceState` call is the same browser API already exercised
  successfully by `handleJoin` at line 179, applied to the pathname instead of a session
  query string. Recommend the user run the manual smoke test in Tasks before merging.
- Confidence: 85% — the change is a 2-line, fully-scoped diff with clean typecheck and a
  green full-suite run; the only gap is the unexecuted manual browser smoke test noted above.

### File List

- `apps/mobile-controller/src/App.tsx` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — marked 1.8's D1/D2
  resolved by this story; logged 2 new deferred findings from this story's own code review)

## Change Log

- 2026-07-07: Implemented Story 1.9 — cleared stale `?session=` URL param in
  `ClassSelectionScreen.onBack`, documented the `'manual'` key-sentinel invariant. No
  new dependencies, no shared-types/net-protocol changes. Status → review.
- 2026-07-07: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, autonomous
  triage). Acceptance Auditor found 0 AC violations. Applied 1 wording fix (key-sentinel
  comment named the `'manual'` fallback explicitly instead of the vague "this sentinel").
  Closed the loop on `deferred-work.md`'s D1/D2 (marked resolved). Logged 2 new deferred
  findings surfaced by the review (unguarded `history.replaceState` exception risk shared
  with pre-existing `handleJoin` code; a pre-existing async `onLeave` race that can reroute
  `onBack` to the reconnect screen) — both are pre-existing patterns or blocked-path issues,
  out of scope for 1.9, tracked in `deferred-work.md` under "Deferred from: code review of
  1-9-epic-1-post-18-deferred-hardening". Full monorepo typecheck re-verified clean after
  the comment edit.
- 2026-07-07: User resolved the one `decision_needed` review finding (unguarded
  `history.replaceState` in `onBack`) — deferred to a future hardening story rather than
  partially guarding only the new call site, since `handleJoin`'s identical call is a
  blocked path for 1.9. All review findings now resolved (2 patches applied, 1 decision
  deferred, 2 pre-existing items deferred, 7 dismissed as noise/out-of-scope). Status → done.

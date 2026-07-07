---
baseline_commit: f69bcca
---

# Story 1.8: Epic 1 — Post-1.7 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: E1 — Foundation Platform (Story 1.8 — post-1.7 deferred hardening, no new features)
Context: Story 1.7 (epic-1-deferred-hardening) closed with two items explicitly deferred from
  its own code review: the initialCode useState seeding edge case and a stale
  sessionEntryInitialCode leak path. Both touch mobile-controller/App.tsx only.
  No other E1 work remains open.

Owner agent: Mobile Controller Engineer

Goal: Close 2 deferred findings from the 1.7 code review.
  Task 1 — Force-remount SessionCodeEntryScreen when initialCode prop changes by adding
            a key prop to the rendered component in App.tsx.
  Task 2 — Clear sessionEntryInitialCode after a successful join so stale room codes
            never pre-fill a future session-entry screen.

Allowed paths:
  - apps/mobile-controller/src/App.tsx

Blocked paths:
  - packages/**
  - apps/simulation-server/**
  - apps/host-client/**
  - apps/mobile-controller/src/**  (except App.tsx)

Inputs:
  - apps/mobile-controller/src/App.tsx
    Current state: SessionCodeEntryScreen rendered without a key prop; sessionEntryInitialCode
    is only cleared in handleGuestContinue, not in handleJoin (success path).
  - deferred-work.md: D-1.7-A and D-1.7-B

Non-goals:
  - Any navigation graph changes
  - iOS BFCache thaw handling (D15 from 1.4 R2)
  - Slot recycling map (D27 — Phase 2 combat)
  - Any new features

Acceptance criteria:
  1. The SessionCodeEntryScreen render site in App.tsx has a key prop derived from
     sessionEntryInitialCode (e.g. key={sessionEntryInitialCode ?? 'manual'}) so that
     changing the pre-fill value forces a clean remount of the screen.
  2. handleJoin calls a setter that clears sessionEntryInitialCode to null on
     successful join (after setSession / setScreen), preventing the stale code from
     pre-filling a subsequent session-entry navigation.

Required hooks: Client-UX hook (mobile App.tsx modified)
Required tests: No new tests required — changes are cosmetic/latent guard only.
Telemetry impact: None.
```

---

## Story

As a developer on the project,
I want the 2 deferred findings from the 1.7 code review resolved,
so that E1 is fully clean with no known latent edge cases before E2 work is built upon it.

---

## Acceptance Criteria

**AC1 — SessionCodeEntryScreen key prop:**
**Given** a screen navigation in App.tsx that renders `SessionCodeEntryScreen`
**When** `sessionEntryInitialCode` changes between navigations (e.g. from reconnect flow to manual entry)
**Then** the `key` prop on the rendered `SessionCodeEntryScreen` forces a full remount
**And** the new initial value is correctly reflected in the component's input field

**AC2 — Clear sessionEntryInitialCode on successful join:**
**Given** a user successfully completes a join flow via `handleJoin`
**When** `joinSession` resolves and `setSession` / `setScreen('controller')` is called
**Then** `sessionEntryInitialCode` is reset to `null` (or equivalent cleared state)
**And** a subsequent navigation back to session-entry (from a different path) does not pre-fill the stale room code

---

## Dev Notes

### Context

Story 1.7 (epic-1-deferred-hardening) addressed 5 deferred items. Its own code review
surfaced 2 new latent issues:

**D-1.7-A — initialCode useState seeding is mount-time only**
`useState(initialCode ?? urlCode)` in `SessionCodeEntryScreen.tsx:28` reads the prop only
on first mount. If the screen stays mounted while `initialCode` changes, the field won't update.
Current nav graph forces remounts on transitions, so it is latent — but the recommended fix
is to add `key={sessionEntryInitialCode ?? 'manual'}` at the render site in `App.tsx` to
guarantee a remount whenever the pre-fill value changes.

**D-1.7-B — sessionEntryInitialCode could leak to future renders**
`sessionEntryInitialCode` is only cleared in `handleGuestContinue` (auth-choice → session-entry).
A future nav path that re-renders session-entry without going through `handleGuestContinue`
would silently pre-fill the field with a dead room id from the previous reconnect attempt.
Fix: clear `sessionEntryInitialCode` in `handleJoin` on success.

### Implementation

**Task 1 — Add `key` prop to SessionCodeEntryScreen render site**

Find the place in `App.tsx` where `SessionCodeEntryScreen` is rendered (within the screen
switch/conditional). Add `key={sessionEntryInitialCode ?? 'manual'}` to it.

This is a one-line change. Example:
```tsx
// Before
<SessionCodeEntryScreen initialCode={sessionEntryInitialCode} ... />

// After
<SessionCodeEntryScreen key={sessionEntryInitialCode ?? 'manual'} initialCode={sessionEntryInitialCode} ... />
```

**Task 2 — Clear sessionEntryInitialCode in handleJoin on success**

In `handleJoin` (or the equivalent success callback after `joinSession` resolves),
after calling `setSession(s)` and `setScreen('controller')`, add:
```ts
setSessionEntryInitialCode(null);
```

Verify: `setSessionEntryInitialCode` is already in scope (it's the setter from the
`useState` that holds `sessionEntryInitialCode`). If the state setter has a different name
in the current codebase, adapt accordingly — read App.tsx carefully before editing.

### Files to read before editing

- `apps/mobile-controller/src/App.tsx` — read the full file; identify the screen render
  switch, the `sessionEntryInitialCode` state declaration, and both `handleGuestContinue`
  and `handleJoin` functions.

### Known pitfalls

- Do **not** clear `sessionEntryInitialCode` inside `SessionCodeEntryScreen` itself —
  the prop flow goes only one way. The clear must happen in the parent (`App.tsx`).
- Verify that the `key` change doesn't break any existing test that asserts on the
  SessionCodeEntryScreen's rendered state (unlikely — the key only affects mount identity).

---

## Tasks

- [x] **Task 1:** Read `apps/mobile-controller/src/App.tsx` fully; locate the
  `SessionCodeEntryScreen` render site; add `key={sessionEntryInitialCode ?? 'manual'}` prop.
- [x] **Task 2:** In `handleJoin` success path of App.tsx, after `setScreen('controller')`,
  call the state setter to clear `sessionEntryInitialCode` to `null`.
- [x] Verify no TypeScript errors (`npm run typecheck` or equivalent from monorepo root).

### Review Findings

- [x] [Review][Defer] Stale `?session=` URL param pre-fills session-entry on all paths where `initialCode=undefined` [apps/mobile-controller/src/App.tsx:179] — deferred, pre-existing; root cause is history.replaceState never being cleared; fixing requires navigation change (non-goal for this story)
- [x] [Review][Defer] `'manual'` key sentinel would suppress remount if sessionEntryInitialCode equals the literal string "manual" [apps/mobile-controller/src/App.tsx:238] — deferred, pre-existing; room codes are 4-char uppercase alpha so collision is structurally impossible today

---

## Dev Agent Record

### Completion Notes

- Task 1: Added `key={sessionEntryInitialCode ?? 'manual'}` to `SessionCodeEntryScreen` render in App.tsx (line 236). Forces remount whenever the pre-fill value changes — closes D-1.7-A.
- Task 2: Added `setSessionEntryInitialCode(undefined)` after `setScreen('class-select-forced')` in `handleJoin` success path — closes D-1.7-B. Used `undefined` (not `null`) to match the existing `useState<string | undefined>` type and be consistent with `handleGuestContinue`.
- `npx tsc --noEmit -p apps/mobile-controller/tsconfig.json` — no errors. Pre-existing TS error in `apps/simulation-server/tests/game-room-host-join.test.ts` is outside this story's allowed scope.
- Client-UX hook triggered (mobile App.tsx modified). Changes are latent guards — no visible UX regression paths, no new tests required per story spec.

Confidence: 98% — two one-line changes exactly matching the spec; both verified clean.

---

## File List

- apps/mobile-controller/src/App.tsx

---

## Change Log

- 2026-07-06: Closed D-1.7-A (key prop on SessionCodeEntryScreen) and D-1.7-B (clear sessionEntryInitialCode on join success) in App.tsx.

---
baseline_commit: 1f9b932
---

# Story dev-2: Controller Rotation Lock Enforcement

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 3 — (ad-hoc dev-infra fix, no epic assignment)
Context: A landscape-orientation prompt already exists
  (apps/mobile-controller/src/screens/OrientationPromptScreen.tsx) but it is
  wired into App.tsx as a ONE-SHOT transitional screen state
  ('orientation-prompt'), shown exactly once between class selection and the
  first entry into the controller UI. Once dismissed, App.tsx permanently
  moves on: there is no re-check if the player rotates back to portrait mid-
  session, and the reconnect flow (handleReconnect) sets screen straight to
  'controller' without ever routing through the prompt at all — a session
  that reconnects after a drop skips the gate entirely. Additionally,
  apps/mobile-controller/vite.config.ts's VitePWA manifest declares
  `orientation: 'portrait'`, which actively fights the intended landscape
  lock for any player who installs/launches the controller as a standalone
  PWA (the `orientation` manifest field is honored by browsers on fullscreen/
  installed launch). AC1904-1917 (epics.md) requires the block to hold for
  the whole post-join lifetime, not just the first transition — the root
  cause is that orientation is modeled as a step in a screen sequence
  instead of a persistent condition of the controller UI itself.
Owner agent: Mobile Controller Engineer
Goal: Replace the one-shot 'orientation-prompt' screen-sequence state with a
  persistent portrait/landscape guard that gates the controller UI itself
  (wherever it renders — first entry AND post-reconnect AND after any mid-
  session rotation), reusing the existing OrientationPromptScreen component
  and its window.matchMedia('(orientation: landscape)') listener pattern
  (already correct, just scoped too narrowly). Also correct the conflicting
  PWA manifest orientation lock.
Allowed paths:
  - apps/mobile-controller/src/App.tsx                       (MODIFY)
  - apps/mobile-controller/src/screens/OrientationPromptScreen.tsx (MODIFY, if needed)
  - apps/mobile-controller/vite.config.ts                    (MODIFY — manifest.orientation only)
Blocked paths:
  - apps/host-client/**        (host is a shared TV screen, not phone — no rotation concern)
  - apps/simulation-server/**  (no game-state or protocol involvement)
  - packages/**                (no shared-types or net-protocol changes — this is client-local UI state)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (unless a prop needs adding for the guard — prefer keeping the guard entirely in App.tsx's render branch, no ControllerScreen changes needed)
  - tests/**
Inputs:
  - apps/mobile-controller/src/App.tsx                       (current)
  - apps/mobile-controller/src/screens/OrientationPromptScreen.tsx (current)
  - apps/mobile-controller/vite.config.ts                    (current)
Non-goals:
  - Screen Orientation API hard lock (`screen.orientation.lock('landscape')`)
    — that API only works inside an active Fullscreen API session; fullscreen
    is dev-3's scope (Controller Fullscreen Toggle), not this story's. This
    story stays with the existing soft CSS-media-query + full-screen-prompt
    pattern already in the codebase.
  - Gating auth-choice / session-entry / class-select-forced screens — the AC
    only requires the block "after I join a session" for "the controller
    layout"; those pre-controller screens are simple forms that already work
    fine in portrait and are out of scope.
  - Gating ReconnectScreen, PostRunMobileScreen, or the victory placeholder
    screen in App.tsx — these are simple centered-column layouts (no
    joystick/ability-grid), not the space-constrained "controller UI" the AC
    is about. Do not add the guard to them.
  - Any change to ControllerScreen.tsx's own layout/CSS.
Acceptance criteria:
  AC1: A player who is in portrait when they first reach the controller UI
       (i.e., right after picking a class) sees the rotate-device prompt
       instead of the joystick/ability grid, exactly as today.
  AC2: A player already inside the controller UI in landscape who rotates
       their phone to portrait mid-session immediately sees the rotate-device
       prompt cover the controller UI (regression fix — does not happen
       today).
  AC3: A player who reconnects after a disconnect (handleReconnect path)
       lands on the same guard — if their phone is in portrait at that
       moment, they see the prompt before the controller UI, not after
       (regression fix — today reconnect skips the check entirely).
  AC4: In all three cases above, rotating to landscape automatically and
       immediately dismisses the prompt and reveals the controller UI, with
       no extra tap required (existing auto-dismiss behavior, preserved).
  AC5: `vite.config.ts`'s VitePWA `manifest.orientation` is `'landscape'`,
       not `'portrait'`.
  AC6: No other screen (auth-choice, session-entry, class-select-forced,
       reconnect, post-run, victory placeholder) is gated by the orientation
       check — they render normally in portrait, unchanged from today.
Required hooks:
  - Client-UX hook (mobile UI touched):
    - joystick/ability-grid mapping: unaffected, verify no regression
    - reconnect UX: manually reconnect a session while phone is in portrait
      and confirm the prompt appears (AC3), then rotate and confirm normal
      resume (AC4)
    - sleep/background recovery: n/a (no change to session/reconnect logic
      itself, only to which screen renders)
    - minimal-attention check: prompt design unchanged (reused component)
Required tests: None — this app has no existing component-test
  infrastructure (no *.test.* files under apps/mobile-controller, no
  @testing-library dependency, project-context.md's Testing Rules table
  scopes "Unit" tests to packages/game-rules and apps/simulation-server
  only). Introducing a new test harness for one hook would be scope creep
  for a dev-infra bucket item — same precedent as dev-1. AC1-AC6 are
  manual/visual acceptance tests (use browser devtools responsive-mode
  orientation toggle or a real phone).
Telemetry impact: None.
```

## Story

As a player on my phone,
I want the game to require landscape orientation after I join a session,
so that the controller layout has the space it needs and I'm not playing in a cramped portrait view.

## Acceptance Criteria

1. **Given** a player has joined a session, **when** their phone is in portrait orientation, **then** the controller UI is blocked by a rotate-device prompt until the phone is turned to landscape.
2. **And** once landscape is detected, the normal controller UI resumes automatically.
3. The block must hold for the entire post-join session — not only at the first transition into the controller UI (see Dev Notes: current code only checks once).
4. The block must also apply on the reconnect path, not only on first join (see Dev Notes: current code skips the check on reconnect).
5. The VitePWA manifest's `orientation` field must say `'landscape'`, not `'portrait'` (see Dev Notes: currently contradicts the lock).

## Tasks / Subtasks

- [ ] T1: `apps/mobile-controller/src/App.tsx` — add a persistent portrait/landscape guard
  - [ ] T1.1: Add an `isPortrait` state, initialized from `!window.matchMedia('(orientation: landscape)').matches`, with a `useEffect` (mounted once, empty deps) that subscribes an `mq.addEventListener('change', ...)` listener for the lifetime of the app and cleans up on unmount. This lives at the top of `App()`, alongside the other top-level state.
  - [ ] T1.2: At the single call site that renders `<ControllerScreen .../>` (the final fallback `return` in `App()`, currently ~line 334), branch: if `isPortrait`, render `<OrientationPromptScreen onDismiss={() => {}} />` instead (the guard's own listener will flip `isPortrait` and re-render — `onDismiss` can be a no-op since dismissal is now driven by the media query, not a screen transition).
  - [ ] T1.3: Remove `'orientation-prompt'` from the `AppScreen` union type and delete its dedicated `if (screen === 'orientation-prompt')` branch (~line 262-264).
  - [ ] T1.4: In the `class-select-forced` screen's `onPickClass` handler (~line 255-259), change `setScreen('orientation-prompt')` to `setScreen('controller')` directly — the guard added in T1.2 now handles showing the prompt if needed at that point, so the intermediate state is redundant.
  - [ ] T1.5: Remove the now-unused `handleOrientationDismiss` callback (~line 187-189) — no longer referenced after T1.3/T1.4.
- [ ] T2: `apps/mobile-controller/vite.config.ts` — change `manifest.orientation` from `'portrait'` to `'landscape'` (line 17).

### Review Findings

_(populated by code-review after implementation)_

## Dev Notes

### Root cause (read the actual current code — do not assume from the story title)

`apps/mobile-controller/src/App.tsx` models orientation as a **step in a screen
sequence**, not a **persistent property of the controller UI**:

```
class-select-forced --(pick class)--> orientation-prompt --(auto-dismiss on landscape)--> controller
```

`OrientationPromptScreen.tsx` itself is already correct — its
`window.matchMedia('(orientation: landscape)')` + `change` listener pattern is
exactly right and should be reused as-is, not rewritten. The bug is entirely
in how `App.tsx` wires it in:

1. **Reconnect bypasses it completely.** `handleReconnect` (~line 191-210)
   calls `setScreen('controller')` directly — it never goes through
   `'orientation-prompt'`. A player who disconnects while rotated to
   portrait (e.g., phone auto-locked to portrait while backgrounded) and
   reconnects lands straight on the controller UI with no gate at all.
2. **Mid-session rotation is never re-checked.** Once `'orientation-prompt'`
   auto-dismisses to `'controller'`, nothing in the render tree watches
   orientation again. A player who rotates back to portrait mid-run keeps
   seeing (a presumably broken/cramped) `ControllerScreen`, which is exactly
   the UX problem AC1904-1917 exists to prevent.

Both are the same root cause and the same fix: the check needs to live at
the render call site of `ControllerScreen`, evaluated every render, not in a
one-time screen-sequence transition. This is a smaller, more correct diff
than patching reconnect and rotation as two separate cases.

### The fix in one place

`App()`'s final fallback (bottom of the function, after all the earlier
`if (screen === ...)` returns) currently unconditionally does:

```tsx
return <ControllerScreen session={session} gameState={gameState} cooldowns={cooldowns} bondNotification={bondNotification} inBondMoment={inBondMoment} onContinue={handleContinue} />;
```

This is the one and only place `ControllerScreen` is rendered in the whole
component (confirmed by search — no other reference). Gating here
automatically covers first-join, reconnect, and mid-session rotation with a
single check, because every path that wants to show the controller UI
(first entry via `class-select-forced` → `'controller'`, and
`handleReconnect` → `'controller'`) already funnels through this one return.

### Why removing the `'orientation-prompt'` screen state (not just adding a check) is the lazy-correct move

Keeping the old one-shot state *and* adding the new persistent guard would
mean two independent orientation checks with overlapping purpose — the kind
of redundant-flexibility that's easy to get out of sync again later (exactly
what happened with reconnect). Deleting the transitional state and having
`onPickClass` go straight to `'controller'` collapses this to one guard, one
place, no duplication. `OrientationPromptScreen`'s component itself is
unchanged and fully reused — only the state-machine wiring around it
changes.

### `vite-plugin-pwa` manifest conflict

`apps/mobile-controller/vite.config.ts` (lines 9-19) configures `VitePWA`
with `manifest.orientation: 'portrait'`. Per the Web App Manifest spec, the
`orientation` field is applied by the browser when the app is launched in
`fullscreen` or `standalone` display mode (this manifest already sets
`display: 'fullscreen'`) — i.e., exactly the launch mode dev-3 (Controller
Fullscreen Toggle) will make common. Left as `'portrait'`, an installed/
fullscreen launch would have the OS actively fight the in-app landscape
prompt this story adds. One-line fix: `'landscape'`. This has no effect on
a normal (non-installed, non-fullscreen) mobile browser tab — those ignore
the manifest's `orientation` field, which is why the in-app
`OrientationPromptScreen` guard (this story's real fix) is still required
regardless.

### What NOT to touch

- `ControllerScreen.tsx`'s own layout/CSS — unrelated, no changes needed.
- `apps/host-client/**` — the host is a shared TV/monitor screen with no
  rotation concept; CLAUDE.md's mobile-only ownership rule applies here.
- `ReconnectScreen`, `PostRunMobileScreen`, and the inline victory-placeholder
  block in `App.tsx` — all simple centered-column layouts that already read
  fine in portrait; the AC is about "the controller layout" (joystick +
  2×2 ability grid) specifically, per project-context.md's Mobile Controller
  Constraints section ("left half = movement joystick, right half = 2×2
  ability grid").
- No Screen Orientation API (`screen.orientation.lock`) — requires an active
  Fullscreen API session to work in most browsers; that's dev-3's territory,
  not this story's. This story's "lock" is the existing soft prompt-based
  pattern, not an OS-level lock.

### Project Context Rules

- Mobile Controller Engineer owns `apps/mobile-controller/**` exclusively —
  this story's Allowed paths stay entirely inside it (project-context.md,
  Monorepo Ownership table).
- Touch targets minimum 44×44px — `OrientationPromptScreen`'s existing
  dismiss button already meets this (`minHeight: 44`); no change needed.
- The phone is a controller, not a game screen — unaffected by this story.
- No new `.env` vars, no protocol/shared-types changes — this is 100%
  client-local render-state wiring, no contract-change hook triggered.

### References

- [Source: apps/mobile-controller/src/App.tsx] — screen state machine, the single `ControllerScreen` render call site, `handleReconnect`, `onPickClass`
- [Source: apps/mobile-controller/src/screens/OrientationPromptScreen.tsx] — existing matchMedia guard component, reused unchanged
- [Source: apps/mobile-controller/vite.config.ts#L9-19] — VitePWA manifest, `orientation: 'portrait'` conflict
- [Source: _bmad-output/planning-artifacts/epics.md#Story dev-2] — AC source
- [Source: _bmad-output/project-context.md#Mobile Controller Constraints] — joystick/ability-grid landscape layout rationale
- [Source: _bmad-output/implementation-artifacts/dev-1-mobile-controller-network-binding.md] — sibling dev-infra story, format/precedent for this bucket (no automated test required for a client-local wiring fix)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-15: Story created (Cyby)

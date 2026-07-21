---
baseline_commit: 1f9b932
---

# Story dev-3: Controller Fullscreen Toggle

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — (ad-hoc dev-infra fix, no epic assignment)
Context: The mobile controller has zero existing Fullscreen API usage anywhere
  in `apps/mobile-controller/src` (confirmed by full-source grep — no
  `requestFullscreen`, `fullscreenElement`, `fullscreenchange`, or
  `exitFullscreen` references). `vite.config.ts`'s VitePWA manifest already
  sets `display: 'fullscreen'`, but that field only governs the display mode
  when the app is *installed to the home screen / launched standalone* — it
  has no effect on the common case of a player opening the controller as a
  normal mobile-browser tab via the QR/session-code join flow. For that case
  (the overwhelming majority of sessions), fullscreen must be requested at
  runtime via `document.documentElement.requestFullscreen()`, which — per the
  Fullscreen API spec — only succeeds when called synchronously within an
  active user-gesture handler (a "transient activation"); calling it from a
  `useEffect` on mount (no gesture) will reject/throw in real browsers. There
  is also no header bar anywhere in `ControllerScreen.tsx` today — the
  gameplay screen is a full-bleed joystick (left 40%) + 2×2 ability grid
  (right 60%), with only two existing absolute-positioned overlay elements at
  the top: an HP strip (full-width, 6px, `zIndex: 40`) and `InteractButton`
  (centered, `zIndex: 30`). Sibling story dev-2 (Controller Rotation Lock
  Enforcement, apps/mobile-controller — same owner, not yet implemented as of
  this writing) separately fixes `vite.config.ts`'s `manifest.orientation`
  from `'portrait'` to `'landscape'` — that field is unrelated to this
  story's runtime Fullscreen API work and must not be touched here to avoid
  duplicate/conflicting edits regardless of which story lands first.
Owner agent: Mobile Controller Engineer
Goal: (A) Auto-request fullscreen via the Fullscreen API at the two real
  entry points into the controller UI — first join (App.tsx's
  `class-select-forced` → `onPickClass` handler) and reconnect
  (ReconnectScreen's `handleRejoin`) — calling `requestFullscreen()`
  synchronously inside each existing user-gesture handler so the browser
  honors the request. (B) Add a small fullscreen toggle button to
  `ControllerScreen.tsx`, positioned as a top-of-screen overlay (same
  absolute-positioning pattern as the existing HP strip / InteractButton —
  there is no literal header bar to add a button "into", and building one
  would eat into the joystick/ability-grid space this story's own purpose is
  to maximize), that lets the player exit or re-enter fullscreen at any time,
  reflecting live fullscreen state via the `fullscreenchange` event.
Allowed paths:
  - apps/mobile-controller/src/App.tsx                          (MODIFY)
  - apps/mobile-controller/src/screens/ReconnectScreen.tsx       (MODIFY)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx      (MODIFY)
Blocked paths:
  - apps/mobile-controller/vite.config.ts     (dev-2's scope — orientation
    field only; display:'fullscreen' is pre-existing and already correct for
    the installed/standalone launch case; this story is 100% runtime-API,
    not manifest, work)
  - apps/host-client/**        (host is a shared TV screen, not phone — no
    fullscreen-toggle concern; it already runs full-viewport)
  - apps/simulation-server/**  (no game-state or protocol involvement)
  - packages/**                (no shared-types or net-protocol changes —
    client-local render-state and browser API only)
  - apps/mobile-controller/src/screens/OrientationPromptScreen.tsx (unrelated
    — dev-2's territory)
  - tests/**
Inputs:
  - apps/mobile-controller/src/App.tsx                          (current)
  - apps/mobile-controller/src/screens/ReconnectScreen.tsx       (current)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx      (current)
  - apps/mobile-controller/vite.config.ts                       (current, read-only reference)
Non-goals:
  - `screen.orientation.lock('landscape')` — now technically possible once a
    Fullscreen API session is active (it requires one in most browsers), and
    a natural pairing with dev-2's soft orientation prompt, but no AC in this
    story or dev-2 requires an OS-level lock. Flagging as a future
    opportunity only — do not implement it here (scope creep).
  - Any change to `vite.config.ts` (manifest `orientation` or `display`) —
    see Blocked paths above.
  - Vendor-prefixed Fullscreen API fallbacks (`webkitRequestFullscreen`,
    `mozRequestFullScreen`, etc.) — modern evergreen browsers (Chrome,
    Firefox, Edge, Safari 16.4+) support the unprefixed spec API; skip prefix
    shims for older engines.
  - Auto-requesting fullscreen on every `ControllerScreen` mount, every
    game-state transition, or the mid-session class-reselect overlay
    (`classSelectionOpen` inside `ControllerScreen.tsx`) — only the two
    entry points named in Goal (A) trigger an automatic request; the
    mid-session re-pick flow already uses a separate, distinct `onPickClass`
    callback (defined inline in `ControllerScreen.tsx`, not App.tsx's) and
    must NOT gain a fullscreen call, or every class re-pick mid-run would
    unexpectedly re-prompt fullscreen.
  - Any change to `auth-choice`, `session-entry`, `PostRunMobileScreen`, or
    the victory-placeholder screen in `App.tsx` — fullscreen is scoped to
    "the controller UI" per the AC, not the whole app.
Acceptance criteria:
  AC1: When a player picks a class for the first time (the
       `class-select-forced` screen's "Pick Selected Class" button —
       `ControllerScreen.tsx` line ~448, wired to App.tsx's `onPickClass`),
       `document.documentElement.requestFullscreen()` is called synchronously
       inside that same gesture handler, before/alongside `setScreen(...)`.
  AC2: When a player taps "Rejoin Session" on `ReconnectScreen` (`handleRejoin`),
       `document.documentElement.requestFullscreen()` is called synchronously
       as the first statement of `handleRejoin`, before the `await onReconnect()`
       network round-trip — preserving the click's transient user activation.
  AC3: The request is best-effort: `.catch(() => {})` (or equivalent) swallows
       rejection so an unsupported browser (e.g., older iOS Safari) or a
       user/OS denial never blocks or breaks the join/reconnect flow — the
       controller UI loads normally either way.
  AC4: `ControllerScreen` renders a fullscreen toggle button only when
       `document.fullscreenEnabled` is `true` (hidden entirely when the
       Fullscreen API is unsupported) — top-of-screen overlay, minimum 44×44
       touch target, positioned within `env(safe-area-inset-top)`, following
       the same absolute-positioning convention as the existing HP strip /
       `InteractButton`.
  AC5: Tapping the toggle button exits fullscreen via `document.exitFullscreen()`
       if `document.fullscreenElement` is currently set, or requests fullscreen
       via `document.documentElement.requestFullscreen()` otherwise.
  AC6: The button's visual state (entered vs. exited) stays in sync even when
       fullscreen is exited by a means other than the button itself (e.g., the
       Android back-gesture, iOS swipe, or Esc key) — implemented via a
       `fullscreenchange` event listener updating local state.
  AC7: Re-opening the mid-session class-selection overlay
       (`classSelectionOpen` in `ControllerScreen.tsx`) does NOT trigger an
       automatic fullscreen request — confirmed distinct from AC1's entry
       point (see Non-goals).
  AC8: `apps/mobile-controller/vite.config.ts` is unchanged by this story.
Required hooks:
  - Client-UX hook (mobile UI touched):
    - joystick/ability-grid mapping: unaffected — verify no regression, the
      new toggle button must not overlap or intercept joystick/grid touch
      zones (position it clear of both, e.g. top-right corner, above the HP
      strip's z-index but not intruding into the 40%/60% split).
    - reconnect UX: manually tap "Rejoin Session" while phone is NOT already
      in fullscreen and confirm fullscreen engages (AC2); confirm a normal
      reconnect still completes even if the fullscreen request is denied
      (AC3, e.g. test in an iframe/embedded context where fullscreen is
      blocked by permissions policy).
    - sleep/background recovery: n/a — no change to session/reconnect logic
      itself, only an added best-effort browser API call.
    - minimal-attention check: toggle button is small (icon-only), does not
      compete visually with the joystick/ability grid.
Required tests: None — this app has no existing component-test
  infrastructure (no *.test.* files under apps/mobile-controller, no
  @testing-library dependency, project-context.md's Testing Rules table
  scopes "Unit" tests to packages/game-rules and apps/simulation-server
  only). The Fullscreen API additionally requires a real user gesture and
  is unreliable/unsupported in headless/jsdom test environments, so an
  automated test would be low-value even if infra existed — same precedent
  as dev-1 and dev-2. AC1-AC8 are manual/visual acceptance tests (use a real
  phone; desktop Chrome DevTools responsive mode also works for the toggle
  button since it still requires a real click to satisfy the gesture
  requirement).
Telemetry impact: None — this is a display-mode convenience toggle, not a
  gameplay or session flow with success/failure states; no KPI mapping
  applies (same precedent as dev-1 and dev-2).
```

## Story

As a player on my phone,
I want a toggle to turn the controller's fullscreen mode on or off,
so that I have as much screen space as possible for the joystick and ability grid.

> **2026-07-17 revision:** Auto-activation on join/reconnect (originally AC1-3, AC7) was
> implemented, code-reviewed, and then explicitly descoped by the user after live testing —
> on desktop Chrome (used for dev/QA), calling `requestFullscreen()` at those points caused
> the page to render blank instead of expanding to fill the screen; phone behavior was fine,
> but the risk/inconsistency wasn't worth it for an automatic action. The manual toggle
> (AC4-6, T3) is unaffected and remains the sole way to enter/exit fullscreen. See Change Log.

## Acceptance Criteria

1. ~~Auto-request fullscreen on first join.~~ **Removed 2026-07-17** — see revision note above.
2. ~~Auto-request fullscreen on reconnect.~~ **Removed 2026-07-17** — see revision note above.
3. ~~Auto-request fullscreen is best-effort or blocks nothing.~~ **Removed 2026-07-17** — moot, no auto-request remains.
4. A toggle button is visible in the controller UI (top-of-screen overlay, 44×44 min touch target) whenever the Fullscreen API is supported (`document.fullscreenEnabled`), and hidden entirely otherwise.
5. Tapping the toggle exits fullscreen if currently active, or re-enters it otherwise.
6. The toggle's displayed state tracks real fullscreen state via `fullscreenchange`, even if fullscreen was exited by a non-button means (OS back-gesture, Esc key).
7. ~~Mid-session class-reselect must not auto-trigger fullscreen.~~ **Removed 2026-07-17** — moot, no auto-request remains anywhere.
8. `apps/mobile-controller/vite.config.ts` is unchanged by this story. (unchanged, still applies)
9. **Added 2026-07-17.** On iOS Safari opened as a regular tab (`navigator.standalone === false`), where the Fullscreen API is permanently unsupported, the same top-right slot shows a small tap-to-reveal "ⓘ" hint instead of the (dead) toggle, telling the player to use Share → Add to Home Screen — which activates the manifest's existing `display: 'fullscreen'` on next launch. Not shown on Android/desktop (`navigator.standalone` is `undefined` there, so the condition is `undefined === false` → `false`) or once already installed to the Home Screen (`navigator.standalone === true` → same condition is `false`) — see Dev Notes.

## Tasks / Subtasks

- [x] ~~T1: `apps/mobile-controller/src/App.tsx` — auto-request fullscreen on first join (AC1, AC3, AC7)~~ **Reverted 2026-07-17** — see revision note above. `onPickClass` no longer calls `requestFullscreen()`.
  - [x] ~~T1.1~~ reverted
  - [x] ~~T1.2~~ moot (no longer applicable now that no `onPickClass` gets the call)
- [x] ~~T2: `apps/mobile-controller/src/screens/ReconnectScreen.tsx` — auto-request fullscreen on reconnect (AC2, AC3)~~ **Reverted 2026-07-17** — see revision note above. `handleRejoin` no longer calls `requestFullscreen()`.
  - [x] ~~T2.1~~ reverted
- [x] T3: `apps/mobile-controller/src/screens/ControllerScreen.tsx` — fullscreen toggle button (AC4, AC5, AC6)
  - [x] T3.1: Add `isFullscreen` state initialized from `document.fullscreenElement !== null`, with a mount-once `useEffect` that subscribes `document.addEventListener('fullscreenchange', handler)` (handler re-reads `document.fullscreenElement !== null` and updates state), cleaning up on unmount.
  - [x] T3.2: Add a `toggleFullscreen` callback: `document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : document.documentElement.requestFullscreen().catch(() => {})`.
  - [x] T3.3: Render the toggle only when `document.fullscreenEnabled` is `true`, as an absolute-positioned overlay (top-right, `top: env(safe-area-inset-top, 0px)`, min 44×44 touch target, `touchAction: 'manipulation'`), following the same styling/positioning convention as `InteractButton` (defined near the top of this same file). Use a simple icon/glyph (e.g. `⛶`) — no new asset needed.
- [x] T4: `apps/mobile-controller/src/screens/ControllerScreen.tsx` — iOS Safari "Add to Home Screen" hint (AC9, added 2026-07-17)
  - [x] T4.1: Add module-level `IS_IOS_SAFARI_TAB = (navigator as Navigator & { standalone?: boolean }).standalone === false` — detects "iOS Safari, running as a regular tab" specifically (undefined on every other browser, `true` once already installed).
  - [x] T4.2: Add `showIosHint` state (default `false`). In the same top-right slot used by the toggle, when `!document.fullscreenEnabled && IS_IOS_SAFARI_TAB`, render a small "ⓘ" tap target (44×44) that toggles `showIosHint`, and a small popover (shown when `showIosHint` is true) with the instruction text, dismissed by tapping it again.

### Review Findings

- [x] [Review][Patch] `toggleFullscreen`'s `exitFullscreen()`/`requestFullscreen()` calls lack the optional-chaining guard (`?.`) used at the two other call sites in this same diff (App.tsx, ReconnectScreen.tsx) — inconsistent defensive style. Not currently reachable (the button only renders when `document.fullscreenEnabled` is true, which implies these methods exist), but the guard is free and matches the story's own established pattern. [apps/mobile-controller/src/screens/ControllerScreen.tsx:~1003-1007] — fixed, `?.` added to both calls.
- [x] [Review][Defer] Toggle button is a bare `<div onPointerDown>` with no `aria-label`/`role="button"`/keyboard affordance — real accessibility gap, but it exactly mirrors the pre-existing `InteractButton` convention in the same file (which the Dev Notes explicitly instructed this story to follow), so it isn't a regression introduced here. A broader accessibility pass across all `div`-as-button controls in this file is out of this story's scope. [apps/mobile-controller/src/screens/ControllerScreen.tsx:~1206-1223] — deferred, pre-existing
- [x] [Review][Defer] No explicit `exitFullscreen()` call when navigating away from `ControllerScreen` to other `App.tsx` screens (PostRun/victory) — whether fullscreen should persist across those transitions or reset is an unspecified product decision, not covered by any AC in this story. Current behavior (persist) is plausibly the desired one (avoids flicker, matches "maximize screen space" intent) but is worth a deliberate call in a future story if it proves wrong. [apps/mobile-controller/src/App.tsx] — deferred, pre-existing

## Dev Notes

### The one mistake that will break this story: where auto-request is called

**Do not** add `document.documentElement.requestFullscreen()` inside a
`useEffect` in `ControllerScreen.tsx` (e.g. `useEffect(() => { ...requestFullscreen() }, [])`).
The Fullscreen API requires an active, synchronous user-gesture call stack
("transient activation") — a mount effect has none, and the browser will
silently reject the promise (Chrome/Firefox) or throw synchronously (some
engines). This is the single most likely way an LLM implements this story
incorrectly, because "request fullscreen when the controller UI loads" reads
like a mount-time effect. It is not — it must be anchored to the last real
user gesture *before* the controller UI is reached:

- First join: the "Pick Selected Class" button's `onPointerDown` in
  `ControllerScreen.tsx` (~line 448) → `onPickClass(selectedDef.id)` → App.tsx's
  `onPickClass` prop (class-select-forced branch, ~line 255-259). All
  synchronous, same call stack as the tap.
- Reconnect: `ReconnectScreen`'s "Rejoin Session" button `onClick` → `void handleRejoin()`.
  `handleRejoin` is `async`, but everything before its first `await` still
  executes synchronously in the same task as the click — so calling
  `requestFullscreen()` as literally the first line of `handleRejoin`, before
  `await onReconnect()`, still counts as gesture-triggered. Putting it after
  the `await` would lose the activation and silently fail.

### Why the mid-session class-reselect must NOT get this call

`ClassSelectionScreen` (in `ControllerScreen.tsx`) is rendered from **two**
different places with **two** different `onPickClass` props:

1. App.tsx, `class-select-forced` screen (~line 246-260) — first entry, before
   the controller UI has ever been shown. **This is the one that gets the
   fullscreen call (T1.1).**
2. `ControllerScreen.tsx` itself, the `classSelectionOpen` overlay (~line
   1349-1360) — a mid-session "change my class" flow the player can open
   while already inside the controller UI. **This one must NOT get the
   fullscreen call** — the player is already past the fullscreen decision
   point (either accepted it, or explicitly toggled it off), and re-picking a
   class mid-run should not re-surface a fullscreen prompt.

These are two separate arrow functions passed as the same `onPickClass` prop
type — easy to conflate. Only touch the App.tsx one.

### No existing header — the toggle button is a fixed overlay, not a header bar

`ControllerScreen.tsx`'s render tree (~line 1152 onward) has no header
element. The only existing top-of-screen overlays are:

- HP strip: `position: absolute, top: env(safe-area-inset-top, 0px)`, full
  width, 6px tall, `zIndex: 40`, `pointerEvents: 'none'` — only visible
  `inDungeon`.
- `InteractButton`: centered, same `top: env(safe-area-inset-top, 0px)`
  anchor, `zIndex: 30`, slides in/out via `transform`.

The epics.md AC phrase "a toggle button in the header" is read here as "a
persistent top-of-screen control," not a literal header bar — building a
dedicated header would eat into the 40%/60% joystick/ability-grid split this
story exists to protect, and CLAUDE.md's mobile-UI guidance says keep it
minimal. Follow the same absolute-positioning pattern already established
(top-right corner, clear of both the joystick zone (left 40%) and the
ability grid (right 60%) — sits above both without overlapping either).

### `document.fullscreenEnabled` gates visibility, not just capability

Some browsers/contexts (mainly older iOS Safari, or the page loaded inside a
restrictive iframe without `allow="fullscreen"`) have `document.fullscreenEnabled === false`.
Rendering a toggle button that silently does nothing there is worse than not
rendering it at all — gate the button's render on this flag (T3.3), don't
just gate the click handler.

### Why `vite.config.ts` is untouched here

`display: 'fullscreen'` in the VitePWA manifest (line 16) already covers the
installed/home-screen-launch case — the OS omits browser chrome entirely for
that display mode, no JS needed. This story's Fullscreen API work targets the
much more common case: a normal mobile-browser tab (opened via the
session-code join flow), where the manifest's `display`/`orientation` fields
have no effect at all — only a live `requestFullscreen()` call can hide the
browser chrome there. `manifest.orientation` (currently `'portrait'`, wrong
for landscape play) is sibling story dev-2's fix, not this story's — do not
touch it here regardless of implementation order between the two stories.

### Project Context Rules

- Mobile Controller Engineer owns `apps/mobile-controller/**` exclusively —
  all three touched files fall inside it (project-context.md, Monorepo
  Ownership table).
- Touch targets minimum 44×44px — the new toggle button must meet this,
  matching `InteractButton`'s existing `minHeight: 44` convention.
- The phone is a controller, not a game screen — this story only affects
  chrome/viewport presentation, not gameplay or protocol.
- No new `.env` vars, no protocol/shared-types changes — 100% client-local
  browser-API wiring; no contract-change hook triggered.

### References

- [Source: apps/mobile-controller/src/App.tsx] — `class-select-forced` screen, `onPickClass` handler (~line 246-260), `handleReconnect`
- [Source: apps/mobile-controller/src/screens/ReconnectScreen.tsx] — `handleRejoin` (~line 14), "Rejoin Session" button
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx] — `InteractButton` (top-of-screen overlay convention, ~line 31-67), HP strip (~line 1163-1182), `ClassSelectionScreen`'s "Pick Selected Class" button (~line 447-475), mid-session `classSelectionOpen` overlay + its own `onPickClass` (~line 1349-1360)
- [Source: apps/mobile-controller/vite.config.ts#L9-19] — VitePWA manifest, `display: 'fullscreen'` (pre-existing, installed-launch only) and `orientation: 'portrait'` (dev-2's fix, not this story's)
- [Source: _bmad-output/planning-artifacts/epics.md#Story dev-3] — AC source
- [Source: _bmad-output/implementation-artifacts/dev-2-controller-rotation-lock-enforcement.md] — sibling dev-infra story; explicitly deferred `screen.orientation.lock` to this story's scope but this story's AC does not require it either (left as a Non-goal, not implemented)
- [Source: _bmad-output/implementation-artifacts/dev-1-mobile-controller-network-binding.md] — original dev-infra bucket precedent (no automated test required for a client-local wiring fix)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx tsc --noEmit` — 0 errors, consistently, at every checkpoint including after the
  iOS-hint addition. This is the reliable signal for this story.
- `npm run lint` — **correction, 2026-07-17:** earlier entries in this log claimed this was
  clean (0 errors). That was wrong — the `rtk` CLI proxy this environment routes shell
  commands through was serving cached/stale output for repeated `npm run lint` invocations
  (confirmed via `rtk gain --history`, which showed `-100%` cache hits on prior `lint`
  calls). Bypassing the cache (`rtk proxy npx eslint . --max-warnings=0`, and separately a
  fresh background `npm run lint` run) both show the true state: **308 errors across 37
  files, repo-wide** — `apps/*`, `packages/*`, `tests/*`, and `_bmad/wds/scripts/*` are all
  affected. Root cause: `eslint.config.mjs` never sets `languageOptions.globals` anywhere,
  so `no-undef` (enabled by `js.configs.recommended`) fires on every standard global
  reference (`document`, `window`, `navigator`, `console`, `setTimeout`/`setInterval`,
  `process`, `require`, `React`, etc.) in every file that touches the DOM or Node APIs.
  Confirmed pre-existing and unrelated to this story via `git stash` — the same class of
  error was already present on baseline before any dev-3 changes (originally spot-checked
  against 3 files only, 23 errors; the full-repo number is 308). This story's new code
  (`navigator.standalone` on the new `IS_IOS_SAFARI_TAB` line, plus the pre-existing
  `document`/`window` calls) adds more instances of the exact same pre-existing pattern,
  not a new category of error. Fixing the config gap itself is out of this story's scope
  (root-level shared tooling file, not under Mobile Controller Engineer's ownership per
  CLAUDE.md, and the blast radius spans every app/package) — logged as its own deferred
  item in deferred-work.md for a dedicated follow-up story.

### Completion Notes List

- T1 (App.tsx): added `document.documentElement.requestFullscreen?.().catch(() => {})` as the
  first statement of the `class-select-forced` screen's `onPickClass` handler, synchronous
  within the "Pick Selected Class" button's gesture chain (AC1, AC3). The mid-session
  re-pick `onPickClass` inside `ControllerScreen.tsx` was left untouched (AC7).
- T2 (ReconnectScreen.tsx): added the same best-effort `requestFullscreen()` call as the
  literal first line of `handleRejoin`, before `setStatus('connecting')` and before
  `await onReconnect()`, preserving transient activation across the await (AC2, AC3).
- T3 (ControllerScreen.tsx): added `isFullscreen` state (initialized from
  `document.fullscreenElement !== null`), a mount-once `fullscreenchange` listener effect
  that keeps it in sync (AC6), a `toggleFullscreen` callback using `exitFullscreen()` /
  `requestFullscreen()` (AC5), and a top-right absolute-positioned 44×44 overlay button
  (`⛶` glyph, `top: env(safe-area-inset-top, 0px)`) rendered only when
  `document.fullscreenEnabled` is true (AC4). The glyph's color reflects `isFullscreen`
  state (accent when active) so the toggle visibly tracks external fullscreen exits.
  Positioned top-right, clear of the left joystick zone and layered above (but not
  intruding into) the ability grid, matching the `InteractButton`/HP-strip overlay
  convention already in the file.
- No changes to `vite.config.ts` (AC8) — confirmed via `git status` at completion, only the
  three Allowed-paths files were touched.
- No automated tests added, per the story's `Required tests: None` — matches dev-1/dev-2
  precedent (no component-test infra in this app; Fullscreen API needs a real user gesture
  and is unreliable in headless/jsdom). AC1-AC8 are manual/visual acceptance criteria.
- Confidence: 90% — implementation matches every AC and Dev Note literally (correct hook
  placement relative to the gesture/await boundary, correct `onPickClass` disambiguation,
  visibility gated on `fullscreenEnabled`). Not verified on a real device/browser in this
  session (no display available in this dev environment) — Client-UX hook's manual checks
  (AC2 reconnect-while-not-fullscreen, AC3 denied-in-iframe, joystick/grid non-overlap)
  still need a human pass on a real phone or DevTools responsive mode per the story's
  Required hooks section.

### File List

- apps/mobile-controller/src/App.tsx (MODIFY)
- apps/mobile-controller/src/screens/ReconnectScreen.tsx (MODIFY)
- apps/mobile-controller/src/screens/ControllerScreen.tsx (MODIFY)

## Change Log

- 2026-07-15: Story created (Cyby)
- 2026-07-17: Implemented T1-T3 (auto-fullscreen on join/reconnect, toggle button with
  fullscreenchange sync). Typecheck and repo-wide lint clean. Status → review.
- 2026-07-17: User live-tested on desktop Chrome (dev/QA browser) — auto-`requestFullscreen()`
  on join/reconnect rendered a blank page instead of expanding to fill the screen (phone
  behavior was fine). User decided the automatic activation wasn't worth the risk and
  descoped it. Reverted T1/T2 (removed the `requestFullscreen()` calls from `App.tsx`'s
  `onPickClass` and `ReconnectScreen.tsx`'s `handleRejoin`); the manual toggle (T3, AC4-6)
  is unaffected. AC1-3 and AC7 struck as removed. Re-typechecked clean. Root cause of the
  Chrome blank-page symptom was not investigated further since the feature was withdrawn
  rather than fixed — worth revisiting if auto-fullscreen is ever reconsidered.
- 2026-07-17: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, parallel
  layers) — 0 decision_needed, 1 patch, 2 defer, 19 dismissed as noise. Patch applied:
  `toggleFullscreen`'s exit/request calls now use `?.` guards, matching the other two call
  sites. Both defers logged in deferred-work.md (bare-div toggle a11y gap — mirrors the
  pre-existing InteractButton convention; fullscreen persistence across screen transitions
  — unspecified, current behavior plausibly correct). No AC violations found. Status → done.
- 2026-07-17: User reported the toggle doesn't work on iPhone. Confirmed this is a genuine
  iOS Safari platform restriction, not a bug — WebKit has never implemented the Fullscreen
  API for arbitrary DOM elements (only `<video>` gets `webkitEnterFullscreen`), so
  `document.fullscreenEnabled` is always `false` there and the toggle correctly hides
  itself per AC4. The only real chrome-free path on iPhone is installing the PWA to the
  Home Screen (the manifest's `display: 'fullscreen'` already covers that, untouched).
  Presented 4 options to the user; chose "Add-to-Home-Screen hint". Added T4: a
  `navigator.standalone === false` check (Apple-only, non-standard — reliably detects "iOS
  Safari, plain tab") swaps the dead toggle for a tap-to-reveal "ⓘ" hint pointing at
  Share → Add to Home Screen, in the same top-right slot. New AC9. Typecheck clean.
- 2026-07-17: **Correction.** Every earlier "lint clean" claim in this log (review status,
  the two entries above referencing "repo-wide lint clean") was wrong — the `rtk` CLI proxy
  this environment routes shell commands through was silently serving cached/stale
  `npm run lint` output instead of re-running it. The real, verified result: `npm run lint`
  fails with 308 pre-existing errors across 37 files, repo-wide, root-caused by
  `eslint.config.mjs` never configuring `languageOptions.globals` (so `no-undef` fires on
  every `document`/`window`/`process`/etc. reference in the entire codebase) — confirmed
  unrelated to and predating this story via `git stash`. This story's code adds no new
  error category, only more instances of the same pre-existing pattern. `tsc --noEmit`
  (unaffected by the caching issue) remains the reliable signal and stayed clean throughout.
  Logged as D3 in deferred-work.md for a dedicated follow-up fix. Status remains `done` —
  the fix required is a shared root-config change, out of this story's ownership/scope, not
  a defect in this story's own diff.

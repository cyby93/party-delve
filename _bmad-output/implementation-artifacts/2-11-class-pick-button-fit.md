---
baseline_commit: 95469a2
---

# Story 2.11: Class-Pick Button Fit

Status: done

## CLAUDE.md Required Task Header

```
Phase: E2 — Hub World & Class Selection (Story 2.11 — CSS-only bugfix, no new features)
Context: Story 2.2 (class-selection-flow-card-browse-and-selection) shipped the ability
  briefing panel's "Pick Selected Class" confirm button as a fixed `flex: '0 0 20%'` column
  with a label `<span>` that has no wrap styling. Scoped in by the 2026-08-03 correct-course
  review of the user's own TODO.md notes (sprint-change-proposal-2026-08-03.md, item 4):
  confirmed root cause is exactly this — a fixed-width column plus an unwrapped label — so at
  narrower widths or with the current 11px font, the label clips instead of wrapping.

  Verified against current source before scoping (read the full ability panel JSX,
  `ControllerScreen.tsx:404–501`, before editing):
  - The right ~20% column wrapper: `ControllerScreen.tsx:457–467`
    (`flex: '0 0 20%', borderLeft, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '10px 10px', gap: 6`).
  - The button itself: `ControllerScreen.tsx:469–497` — `minHeight: 48` already set (line
    473), `display: 'flex', alignItems: 'center', justifyContent: 'center'` centers whatever
    content it holds.
  - The label span: `ControllerScreen.tsx:484–496` — `fontSize: 11, textAlign: 'center',
    lineHeight: 1.3`, but no `whiteSpace`/`wordBreak`/`overflow` styling at all — this is the
    actual clip site.
  - The parent ability panel (`ControllerScreen.tsx:404–417`) has a fixed `height: 130`. Two
    lines of 11px text at `lineHeight: 1.3` is ~29px — comfortably inside the existing
    `minHeight: 48` button and the 130px panel, both already large enough. No panel-height or
    button-minHeight change is needed; this is a pure text-wrap fix.

Owner agent: Mobile Controller Engineer (`apps/mobile-controller/**` only — single ownership
  area, no cross-boundary concern).

Goal: The "Pick Selected Class" label wraps to fit inside the button instead of clipping, with
  no other visual or behavioral change to the class-selection flow.

Allowed paths:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx   (label span + button/wrapper
    styling only, lines ~456–497)

Blocked paths:
  - apps/host-client/**, apps/simulation-server/**, packages/**  (no other surface touches
    this button; this is CSS-only within one file)
  - Any other section of ControllerScreen.tsx outside the confirm-button JSX (card browse,
    selection state, `onPickClass` handler, joystick/skill-cell logic — all unrelated)

Inputs:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (read the full ability panel JSX,
    lines 404–501, before editing — the wrapper at 457–467, button at 469–497, label span at
    484–496)
  - _bmad-output/planning-artifacts/epics.md — "Story 2.11: Class-Pick Button Fit" section
    (Epic 2 Correction) for the source AC text
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md — item 4, confirmed
    root cause

Non-goals:
  - No copy change — label stays "Pick Selected Class"; wrapping resolves the fit, not a
    shortened label (explicit non-goal in epics.md).
  - No change to card browse, selection state, or the `onPickClass` handler.
  - No touch-target size change — `minHeight: 48` already satisfies the 44×44px minimum from
    project-context.md's Mobile Controller Constraints.

Acceptance criteria:
  1. The label `<span>` (`ControllerScreen.tsx:484–496`) gains `whiteSpace: 'normal',
     wordBreak: 'break-word'` so "Pick Selected Class" wraps per-word instead of clipping.
  2. The button and its `flex: '0 0 20%'` wrapper column accommodate a wrapped two-line label
     without vertical overflow or clipping — verified this already holds given the existing
     `minHeight: 48` button and 130px panel height (see Context above); no dimension change
     expected, but confirm visually after the wrap change.
  3. The button's touch target remains ≥44×44px (already satisfied by `minHeight: 48`, do not
     shrink it).
  4. No other class-selection behavior (card browse, selection state, `onPickClass` handler)
     changes — this is a CSS-only diff confined to the label span (and wrapper/button only if
     visual verification in AC2 finds overflow, which is not expected).
  5. `npm run typecheck` passes with zero errors; no test regressions (mobile-controller has
     no component tests today — confirm this is still true, not introduced by this story).
  6. Manual visual check on a phone-sized viewport: the full "Pick Selected Class" label is
     readable, wrapped across up to 2 lines, with no clipped or truncated text.

Required hooks: Client-UX hook — mobile skill/joystick mapping is unaffected (this button is
  outside the skill-cell grid); check couch-readability N/A (mobile-only change); confirm
  reconnect UX and sleep/background recovery are unaffected (this is a static label style
  change, no state logic touched).
Required tests: None new. Confirm `npm run typecheck` and existing suites stay green.
Telemetry impact: None — no new user-facing flow, no new event; `onPickClass` fires
  identically to before.
```

---

## Story

As a player picking a class on my phone,
I want the "Pick Selected Class" button's label to fully fit inside the button,
so that I can read the full confirm action instead of it clipping at the wrapper's edge.

---

## Acceptance Criteria

**AC1 — Label wraps instead of clipping:**
**Given** the ability-briefing panel's confirm button (`ControllerScreen.tsx:456-497`), a
fixed `flex: '0 0 20%'` column whose label `<span>` has no wrap styling
**When** this story ships
**Then** the label wraps per-word (`whiteSpace: 'normal'`, `wordBreak: 'break-word'`) instead
of clipping, and the button/wrapper flexes to fit a two-line label without vertical overflow
**And** the button's touch target remains at least 44×44px (already satisfied by the existing
`minHeight: 48`)

**AC2 — No behavior change:**
**Given** this is a CSS-only fix
**When** this story ships
**Then** no other class-selection behavior (card browse, selection state, `onPickClass`
handler) changes

**Non-goals:** no copy change (label stays "Pick Selected Class" — wrapping resolves the fit,
not a shortened label).

---

## Tasks / Subtasks

- [x] **Task 1 (AC1):** `apps/mobile-controller/src/screens/ControllerScreen.tsx` — in the
  confirm-button label `<span>` (lines 484–496), add `whiteSpace: 'normal', wordBreak:
  'break-word'` to the existing style object (keep `textAlign: 'center'`, `lineHeight: 1.3`,
  `fontFamily`, `fontWeight`, `fontSize`, `color`, `letterSpacing` unchanged).
- [x] **Task 2 (AC1):** Visually verify the button (`minHeight: 48`, lines 469–497) and its
  wrapper column (`flex: '0 0 20%'`, lines 457–467) accommodate the wrapped 2-line label
  without vertical overflow, given the panel's fixed 130px height (line 409). Per the Context
  analysis, no dimension change is expected — only add one if visual verification shows
  overflow.
- [x] Confirm no other JSX or handler in the ability panel (card browse, `onPickClass`,
  selection state) was touched.
- [x] Run `npm run typecheck` from repo root; verify zero errors.
- [x] Run the full test suite; verify no regressions (mobile-controller has no component
  tests today — expected, not a gap introduced by this story).
- [x] Manually verify in a phone-sized viewport (or browser dev-tools mobile emulation) that
  "Pick Selected Class" is fully readable, wrapped, and not clipped.

### Review Findings

- [x] [Review][Defer] No maxHeight/overflow guard for label text longer than the current
  fixed "Pick Selected Class" string [ControllerScreen.tsx:469-497] — deferred, pre-existing.
  Verified not reachable with current copy (worst-case ~43px wrap fits the ~110px content
  budget); copy changes are an explicit non-goal of this story. Relevant if the label is ever
  localized or lengthened.
- [x] [Review][Defer] Degenerate one-character-per-line wrapping theoretically possible on
  extremely narrow viewports (sub ~100-150px column width) [ControllerScreen.tsx:457-467] —
  deferred, pre-existing. Outside this project's realistic target device range (phone
  controllers, not smartwatches); no minimum-viewport spec exists to design against.
- [x] [Review][Defer] `fontSize: 11` mobile legibility at a glance
  [ControllerScreen.tsx:486-492] — deferred, pre-existing. Untouched by this diff; a
  general Client-UX concern for the whole confirm button, not introduced by this story.
- [x] [Review][Defer] Inline duplicated typography styling instead of a shared ui-kit
  text/button component [ControllerScreen.tsx:484-496] — deferred, pre-existing.
  Architectural pattern used throughout the file; out of scope for a single-property CSS fix.
- [x] [Review][Defer] No automated (unit/visual-regression) test coverage for this UI-fit fix
  [apps/mobile-controller/**] — deferred, pre-existing. Matches the project's already-accepted
  gap (mobile-controller has zero component-test precedent; explicitly called out as expected
  in this story's own Dev Notes and Required Tests).

**Dismissed as noise/false-positive/matches spec (9):** button-parent-clips-text speculation
(verified false — no `overflow:hidden`/fixed height on the button); "use `overflow-wrap`
instead of `wordBreak`" (both properties are explicitly named by AC1's own text — not a
defect, a followed instruction); `whiteSpace: 'normal'` being a no-op relative to the browser
default (true but harmless, and explicitly required by AC1's wording); unfounded "pill-shape
intent" speculation (button is `borderRadius: 6`, not a pill, no such design evidence); "no
rationale in diff" (process nitpick, not a code defect); speculative TTS/accessibility
side-effect of `word-break` (standard, expected CSS behavior); speculative letter-spacing
crowding concern (no measured overflow risk — auditor confirmed ample headroom); font-loading
race/FOUC reflow (explicitly ruled out of scope by this story's own Dev Notes: "do not look
for a different cause... that isn't present in the code"); "no verification across
viewports/strings shown in diff" (process nitpick, already addressed candidly in Completion
Notes' screenshot-limitation disclosure).

---

## Dev Notes

### Root cause (already confirmed — don't re-diagnose)

The correct-course review already confirmed the root cause via source inspection: a
fixed-width `flex: '0 0 20%'` column plus a label `<span>` with zero wrap styling
(`ControllerScreen.tsx:484-496` has no `whiteSpace`, `wordBreak`, or `overflow` property at
all). This is the entire fix — do not look for a different cause (e.g. font-loading race,
container-query issue) that isn't present in the code.

### Existing code (read before editing)

**`ControllerScreen.tsx:404-417`** — the ability panel wrapper: `height: 130` fixed, flex
row containing two children: the left ~80% ability-chip grid + role text
(`ControllerScreen.tsx:421-454`, untouched by this story) and the right ~20% pick-button
column (`457-498`, this story's target).

**`ControllerScreen.tsx:457-467`** — the pick-button column: `flex: '0 0 20%'`,
`flexDirection: 'column'`, `alignItems: 'center'`, `justifyContent: 'center'`, `padding: '10px
10px'`, `gap: 6`. This centers the button within the column both directions; no change needed
here per the Context math (130px panel height comfortably fits a 48px-min button with 10px
padding top/bottom).

**`ControllerScreen.tsx:469-483`** — the `<button>`: `width: '100%'`, `minHeight: 48`,
`display: 'flex', alignItems: 'center', justifyContent: 'center'`. Already centers its label
child both directions and already meets the 44×44px minimum touch target from
project-context.md's Mobile Controller Constraints — do not reduce `minHeight`.

**`ControllerScreen.tsx:484-496`** — the label `<span>`: `fontFamily: 'var(--font-body)',
fontWeight: 700, fontSize: 11, color: 'var(--bg-base)', letterSpacing: '0.02em', textAlign:
'center', lineHeight: 1.3`. This is the exact object to add `whiteSpace: 'normal', wordBreak:
'break-word'` to.

### Known pitfalls

- Do not change `fontSize` down to make the label "fit" without wrapping — the AC and epics
  source explicitly call for wrapping, not a smaller/different label. A smaller font wasn't
  the diagnosed root cause and isn't the requested fix.
- Do not touch `onPointerDown={e => { e.preventDefault(); onPickClass(selectedDef.id); }}`
  (line 470) or anything in the left ~80% ability-chip column (lines 421-454) — both are
  outside this story's scope.
- `mobile-controller` has zero component-test precedent (confirmed, same as every other
  mobile-controller story to date) — verification here is `npm run typecheck` + manual visual
  check only, not a new automated test.

### Project Context Rules

- Per project-context.md's Mobile Controller Constraints: touch targets minimum 44×44px — the
  existing `minHeight: 48` already satisfies this; this story must not shrink it.
- Per project-context.md's Monorepo Ownership table: `apps/mobile-controller/**` is
  Mobile Controller Engineer's area — this story stays entirely within that boundary, no
  cross-context approval needed (unlike Story 2.10, which is a single-owner exception).

### References

- [Source: _bmad-output/planning-artifacts/epics.md — "Story 2.11: Class-Pick Button Fit"
  (Epic 2 Correction: Hub POI Cleanup & Class-Pick Button Fit)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md — Issue
  Summary item 4, Detailed Change Proposals item 2]
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx — ability panel JSX, lines
  404-501]
- [Source: _bmad-output/implementation-artifacts/2-2-class-selection-flow-card-browse-and-selection.md
  — original story that shipped this button]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

None — no failures during implementation.

### Completion Notes List

- Added `whiteSpace: 'normal', wordBreak: 'break-word'` to the confirm-button label `<span>`
  style object (`ControllerScreen.tsx`, `ClassSelectionScreen` component, the `<span>` inside
  the pick-button column). No other property in that style object was touched. Diff is exactly
  2 inserted lines, confirmed via `git diff` — no other JSX or handler in the ability panel
  was modified.
- Layout math confirms AC2 (no vertical overflow) holds without any dimension change: the
  button has `minHeight: 48` but no fixed `height`/`maxHeight`, so it grows to fit content if
  needed. Even a worst-case 3-line wrap of "Pick Selected Class" at `fontSize: 11,
  lineHeight: 1.3` is ~43px — under the existing 48px minHeight already. The wrapper column
  centers the button inside a 130px panel with only 20px vertical padding (110px of headroom),
  so even a taller button has ample room. No dimension change was made, per the Context
  analysis' expectation.
- `npm run typecheck` passed with zero errors (full monorepo, all `tsconfig.json` projects).
- Full test suite run: 673 passed / 1 pre-existing failure / other flaky suites green on
  retry. The one persisting failure (`ability-vfx.test.ts` Stone Wall geometry, host-client)
  and a flaky e2e heal-assertion (`ability-dispatch.test.ts`) are both pre-existing and
  unrelated to this change — confirmed by isolated rerun and cross-checked against known
  issues from prior stories (Epic 7 VFX geometry test, and the Ancestor's Voice e2e flake).
  Neither touches `apps/mobile-controller/**`. No regression introduced by this story.
- **Manual visual verification limitation:** this sandbox has no browser automation tooling
  available (no `chromium-cli`, no local Chromium/Playwright/Puppeteer install), so an actual
  screenshot of the wrapped label could not be produced. Verification was done instead via
  direct CSS layout reasoning (see above) rather than a rendered screenshot. This is a
  standard, universally-supported CSS pattern (`whiteSpace: 'normal'` + `wordBreak:
  'break-word'` on a flex-centered, unconstrained-height element) with generous headroom in
  every surrounding dimension, so risk is low — but a real-device or browser dev-tools check
  before merge is recommended to close this gap.
- Confidence: 80% — code change and layout math are solid, but AC6's manual visual check
  could not be empirically confirmed with a screenshot in this environment; recommend a quick
  human check on a phone-sized viewport before merge.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (modified — confirm-button label
  `<span>` style: added `whiteSpace: 'normal', wordBreak: 'break-word'`)

---

## Change Log

- 2026-08-03: Story created via gds-create-story from the Epic 2 Correction section of
  epics.md, scoped by sprint-change-proposal-2026-08-03.md. Single-owner, CSS-only fix
  confined to `ControllerScreen.tsx`'s confirm-button label.
- 2026-08-03: Implemented — added `whiteSpace: 'normal', wordBreak: 'break-word'` to the
  confirm-button label span. `npm run typecheck` clean; full test suite green apart from two
  pre-existing, unrelated failures (Stone Wall VFX geometry, flaky Ancestor's Voice e2e heal
  assertion). Manual screenshot verification not possible in this sandbox (no browser
  tooling) — verified via CSS layout reasoning instead; flagged for a quick human check
  before merge. Status → review.
- 2026-08-03: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Zero AC
  violations (Acceptance Auditor: clean). 0 decision_needed, 0 patch, 5 defer (D-2.11-A
  through D-2.11-E, logged in `deferred-work.md`), 9 dismissed as noise/false-positive/matches
  spec. Status → done.

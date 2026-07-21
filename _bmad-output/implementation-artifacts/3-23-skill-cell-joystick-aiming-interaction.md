---
baseline_commit: 7d87592
---

# Story 3.23: Skill-Cell Joystick Aiming Interaction

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Story 3.23 — UX polish/spec-drift closure,
  no new FR)
Context: The 2026-07-20 UX update session (decision-log.md, D-017 through D-020) closed
  two gaps that accumulated since the spines froze on 2026-06-18: (1) Story 3.11 added a
  4th `AbilityInputType`, `AIM_CAST`, and Story 3.18 gave it real server-side channel/cancel
  semantics — but DESIGN.md/EXPERIENCE.md's skill-cell spec still only described 3 types
  (AUTO/RELEASE/TAP) with no AIM_CAST-specific visual language. (2) `ControllerScreen.tsx`'s
  `SkillCell` component never implemented the joystick ring the original spec already called
  for — direction is tracked internally via an invisible touch-drag ref
  (`apps/mobile-controller/src/screens/ControllerScreen.tsx:633`), but the cell renders
  nothing during aim. Players get zero visual feedback while dragging to aim an ability —
  only the movement joystick (left 40% of screen) has a visible ring+knob today.
  `mockups/controller-landscape-1.html` already prototyped a ring+knob for skill cells
  (`.skill-joystick-outer`/`.skill-joystick-inner`, 80px/28px, `#6ea8d8`) but it was never
  carried into the spec text or the build. This story closes both gaps in one pass: extends
  the ring+knob visual to all 3 held input types (AUTO, RELEASE, AIM_CAST — TAP never gets
  one), gives AIM_CAST a distinct pulsing treatment so it doesn't read as a plain repeat of
  AUTO, and fixes a color leftover (`ABILITY_BADGE_BORDER`/inline `badgeBorderColor` colored
  AIM_CAST as `accent-warm`, a pre-Story-3.18 holdover from when AIM_CAST fired on release
  and was grouped with RELEASE — post-3.18 it behaves like AUTO, continuous-while-held, and
  the spec now says its badge should join AUTO's `accent-spirit` family).
Owner agent: Mobile Controller Engineer (single-context — 100% within
  apps/mobile-controller/**, no shared-types/net-protocol/simulation-server touch)
Goal: In `SkillCell` (ControllerScreen.tsx), render a ring+knob joystick visual for AUTO,
  RELEASE, and AIM_CAST input types — matching the movement joystick's visual grammar,
  scaled to 80px ring / 28px knob — with AUTO/RELEASE static and AIM_CAST pulsing. Give the
  skill-cell joystick its own dedicated 10px deadzone constant (independent of the movement
  joystick's 8px `DEADZONE_RADIUS`), replacing the current undocumented inline `DEADZONE = 6`.
  Fix `ABILITY_BADGE_BORDER.AIM_CAST` and the live grid's inline `badgeBorderColor` from
  `accent-warm` to `accent-spirit`. No change to ability fire semantics/timing (AUTO/AIM_CAST
  continuous-fire-every-33ms, RELEASE fire-on-lift, TAP fire-on-touch — all unchanged).
Allowed paths:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx   (MODIFY — SkillCell component
    and the live grid's inline badgeBorderColor computation only)
  - apps/mobile-controller/src/global.css                     (MODIFY — new pulse keyframe)
Blocked paths:
  - packages/shared-types/**, packages/net-protocol/**  (no protocol change — this is a
    pure client-rendering/timing-constant story; AIM_CAST's `cast:started`/`cast:cancelled`
    wire events already exist from Story 3.18 and are untouched here)
  - apps/simulation-server/**, packages/game-rules/**   (no server-side change — ability
    fire cadence/commit timing is unchanged, only the client-side visual)
  - apps/host-client/**   (host is the shared TV screen — no skill-cell concept there)
  - packages/ui-kit/**    (SkillCell is a local component in ControllerScreen.tsx today,
    not extracted into ui-kit — do not extract it as part of this story; out of scope)
  - tests/**
Inputs:
  - _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/.decision-log.md
    (read the "Update session — 2026-07-20" section in full — D-017 through D-020 are this
    story's entire spec)
  - _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md
    (`skill-cell` component spec — ring/knob sizing, per-type color, deadzone, states;
    `ability-chip` component spec — badge color correction; Colors section — hex values)
  - _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md
    (Section 4 "Skill Cells" — touch behavior by input type, deadzone, cell boundary rule;
    Section 6 "Movement Joystick" — cross-reference note on the two independent deadzones)
  - _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/controller-landscape-1.html
    (read fully — `.skill-joystick-outer`/`.skill-joystick-inner` CSS classes, lines
    296-314, and their applied `style=` transforms around line 474-484, are the canonical
    visual reference)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (read fully — `SkillCell`,
    lines 618-897, is what you're modifying; the top-level movement joystick, lines
    982-1174 and its render block at 1319-1397, is the ring+knob pattern to mirror —
    same ref+state split, same clamped-offset math)
  - apps/mobile-controller/src/global.css (read fully — 35 lines; `dot-pulse` keyframe
    at line 24 is the existing opacity/scale-breathe idiom to follow for the new
    AIM_CAST pulse, at a different cycle length: ~1.2s vs dot-pulse's implicit ~1.4s)
Non-goals:
  - AIM_CAST channel-progress indicator (visualizing the server's `cast:started`/
    `cast:cancelled`/channel-refresh state from Story 3.18) — explicitly out of scope per
    D-018, flagged for a future HUD/feedback UX pass. Do not build any progress ring,
    timer, or refresh flash for the channel itself; this story only covers the aim/direction
    ring+knob.
  - Do not fix D-3.3-B (deferred-work.md: RELEASE ability silently drops with no fire if
    `isInteractive` flips false mid-hold, via the SkillCell useEffect cleanup) — pre-existing,
    unrelated to the visual work here. Your new ring/knob cleanup state must mirror the
    existing cleanup's behavior exactly (clear silently, no fire), not attempt to fix this.
  - Do not extract SkillCell into `packages/ui-kit`. Do not refactor `ABILITY_BADGE_BORDER`
    and the live grid's separate inline `badgeBorderColor` ternary into one shared helper —
    both need the same color fix but stay as two call sites, matching the codebase's existing
    duplication level (introducing a shared helper for two 4-branch ternaries is not requested
    and is out of scope).
  - Do not change any ability fire cadence, cooldown timing, or the 33ms `INPUT_INTERVAL_MS`/
    autoInterval constants. Do not touch the top-level movement joystick code (lines
    982-1174) — it is the reference pattern to read, not to modify.
  - Do not add haptic feedback, sound, or any non-visual/non-CSS enhancement — not
    requested by the UX session.
Acceptance criteria:
  AC1: Touching an AUTO, RELEASE, or AIM_CAST skill cell spawns a ring+knob at the exact
       touch position, 80px ring / 28px knob (matching mockups/controller-landscape-1.html's
       `.skill-joystick-outer`/`.skill-joystick-inner`). Touching a TAP cell spawns no
       ring/knob (unchanged from today).
  AC2: The knob tracks the live drag offset from the spawn origin, clamped to the ring's
       radius (40px) — mirroring the movement joystick's `JOYSTICK_MAX_RADIUS` clamp
       pattern. Below a 10px deadzone (a new, dedicated constant — independent of the
       movement joystick's existing 8px `DEADZONE_RADIUS`), the knob stays centered on the
       ring and no aim direction is committed (replacing today's undocumented inline
       `DEADZONE = 6`).
  AC3: AUTO's ring+knob render in `var(--accent-spirit)`, static (no animation). RELEASE's
       render in `var(--accent-warm)`, static. AIM_CAST's render in `var(--accent-spirit)`
       with a slow pulse (opacity/scale breathe, ~1.2s cycle) — visually distinct from AUTO
       despite sharing the same base color.
  AC4: When a touch drifts outside the cell's bounds during a hold, the touch position used
       for both the ring/knob visual and the committed aim direction is clamped to the
       cell's rect (0..width, 0..height) before computing the offset from spawn origin — the
       ability keeps firing in the last valid clamped direction, matching the existing "cell
       boundary rule" (unchanged conceptually, now has a concrete implementation).
  AC5: Ability fire semantics are unchanged: AUTO and AIM_CAST continue firing every ~33ms
       while held using the live tracked direction; RELEASE fires once on lift using
       whatever direction was tracked at that instant; TAP fires once on touch-down with no
       direction. (This story only changes the deadzone value and adds the visual layer —
       verify no regression against the current `onTouchStart`/`onTouchMove`/`onTouchEnd`/
       document-level release logic.)
  AC6: `ABILITY_BADGE_BORDER.AIM_CAST` (line ~224, used by the class-selection `AbilityChip`
       preview) and the live grid's inline `badgeBorderColor` ternary (line ~1427-1431, used
       by the in-combat `SkillCell`) both resolve AIM_CAST to `var(--accent-spirit)` instead
       of the current `var(--accent-warm)`.
  AC7: No regressions to existing SkillCell behavior: TAP tap-flash animation, cooldown
       conic-gradient overlay, downed/spirit overlays (cells 0-2 locked, cell 3 spirit
       ability), and cleanup on touchend/touchcancel/document-level touchend (including the
       ring/knob visual clearing alongside the existing ref/interval cleanup) all continue
       to work exactly as before.
Required hooks:
  - Client-UX hook (mobile UI touched):
    - joystick/skill mapping: manually verify each of the 3 held input types (find one
      class ability per type — e.g. Stonehide's Avalanche=AUTO, Stone Wall=RELEASE,
      Spiritcaller's Soul Mend=AIM_CAST, per CLASS_ABILITIES.md) shows the correct
      ring+knob color/animation and fires on the correct gesture.
    - reconnect UX: n/a — no session/reconnect logic touched.
    - sleep/background recovery: n/a — no change to session lifecycle.
    - minimal-attention check: ring/knob must not obscure the ability name/badge text
      enough to make the cell unreadable mid-drag — verify visually.
  - No contract-change hook (no shared-types/net-protocol touch), no simulation-safety hook
    (no simulation-server/game-rules touch).
Required tests: None automated — SkillCell's touch-drag interaction cannot be reliably
  exercised in jsdom (no real Fullscreen/Touch gesture support), matching the established
  precedent for dev-1/dev-2/dev-3's touch/orientation/fullscreen mobile UI work (all shipped
  with zero automated tests, manual device verification only). Manual verification checklist
  (Required hooks above) must be run by a human with a real device or touch-emulation
  browser devtools — flag in the Dev Agent Record if this sandbox has no display to verify
  against (matches dev-3's precedent).
Telemetry impact: None — no new user-facing flow, no new event names, purely a visual/
  timing-constant change to an existing interaction.
```

---

## Story

As a player controlling any of the 4 alpha classes from my phone,
I want to see a joystick ring and knob while I'm aiming a held-type ability (AUTO, RELEASE,
or AIM_CAST), with a visually distinct pulse for channeled AIM_CAST abilities like Soul Mend,
so that I get the same clear aiming feedback my thumb already gets from the movement
joystick, instead of dragging blind and only trusting muscle memory.

---

## Acceptance Criteria

**AC1 — Ring+knob spawns for the 3 held types only:**
**Given** a skill cell whose ability's `inputType` is `AUTO`, `RELEASE`, or `AIM_CAST`
**When** the player touches the cell
**Then** a ring (80px) and knob (28px) spawn at the exact touch position within the cell
**And** for a `TAP` cell, touching it spawns no ring/knob (unchanged behavior)

**AC2 — Knob tracks drag, clamped to ring radius, with a dedicated 10px deadzone:**
**Given** an active touch on a held-type cell with the ring/knob spawned
**When** the player drags their thumb
**Then** the knob's rendered offset from the ring center equals the drag distance from spawn
origin, clamped to 40px (the ring's radius)
**And** below a 10px deadzone (independent of the movement joystick's separate 8px
`DEADZONE_RADIUS` constant), the knob stays centered and no direction is committed to
`lastDirX`/`lastDirY`

**AC3 — Per-type color and AIM_CAST pulse:**
**Given** the 3 held input types
**Then** AUTO's ring+knob render `var(--accent-spirit)`, static
**And** RELEASE's ring+knob render `var(--accent-warm)`, static
**And** AIM_CAST's ring+knob render `var(--accent-spirit)` with a ~1.2s opacity/scale pulse
animation, visually distinguishable from AUTO at a glance despite the shared base color

**AC4 — Cell-boundary clamp:**
**Given** an active touch that drifts outside the cell's bounding rect during a hold
**When** computing the ring/knob visual position and the committed aim direction
**Then** the touch's effective position is clamped to `[0, rect.width] × [0, rect.height]`
before the offset-from-origin calculation runs
**And** the ability continues to fire using the last valid (clamped) direction — it does not
freeze, error, or drop to `(0,0)`

**AC5 — Fire semantics unchanged:**
**Given** the existing `onTouchStart`/`onTouchMove`/`onTouchEnd`/document-touchend logic
**When** this story's changes are applied
**Then** AUTO and AIM_CAST still fire every ~33ms while held (`autoIntervalRef`, unchanged
interval value) using the live tracked direction
**And** RELEASE still fires exactly once, on lift, using the direction tracked at that
instant
**And** TAP still fires exactly once, on touch-down, with direction `(0,0)`

**AC6 — Badge color correction:**
**Given** `ABILITY_BADGE_BORDER` (used by the class-selection preview's `AbilityChip`) and
the live grid's inline `badgeBorderColor` computation (used by in-combat `SkillCell`)
**When** the input type is `AIM_CAST`
**Then** both resolve to `var(--accent-spirit)` (previously `var(--accent-warm)`), matching
AUTO's "continuous-while-held" color family per the corrected DESIGN.md spec

**AC7 — No regressions:**
**Given** all of the above changes
**Then** TAP's tap-flash animation, the cooldown conic-gradient overlay, the downed/spirit
overlays (cells 0-2 lock, cell 3 shows spirit ability name), and touch cleanup on
touchend/touchcancel/document-level touchend (ring/knob state clears alongside the existing
`activeTouchRef`/`autoIntervalRef` cleanup) all continue to work exactly as before this story

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2, #4, #5) — Ring+knob interaction logic in `SkillCell`
  (`apps/mobile-controller/src/screens/ControllerScreen.tsx`):
  - [x] Subtask 1.1 — Add module-level constants near `JOYSTICK_MAX_RADIUS`/
    `DEADZONE_RADIUS` (lines 21-23): `SKILL_JOYSTICK_RING_PX = 80`,
    `SKILL_JOYSTICK_KNOB_PX = 28`, `SKILL_JOYSTICK_RING_RADIUS = 40` (half of ring px),
    `SKILL_CELL_DEADZONE_RADIUS = 10`
  - [x] Subtask 1.2 — Add `useState` in `SkillCell` for `spawnOrigin: {x,y} | null` and
    `knobOffset: {x,y}` — mirroring the top-level joystick's `joystickOriginState`/
    `joystickKnobOffset` ref+state split (state for rendering, ref (`activeTouchRef`,
    already present) for handler logic to avoid stale closures)
  - [x] Subtask 1.3 — `onTouchStart`: after populating `activeTouchRef.current`, call
    `setSpawnOrigin({x: originX, y: originY})` and `setKnobOffset({x:0,y:0})`
  - [x] Subtask 1.4 — `onTouchMove`: clamp the touch's position to the cell's
    `getBoundingClientRect()` (`[0,width] × [0,height]`) BEFORE computing `rawX`/`rawY`
    from origin (this single clamp satisfies both AC2's ring/knob positioning and AC4's
    boundary rule). Replace the hardcoded `const DEADZONE = 6` with
    `SKILL_CELL_DEADZONE_RADIUS`. When `dist >= SKILL_CELL_DEADZONE_RADIUS`: keep the
    existing `lastDirX`/`lastDirY` unit-vector assignment unchanged, and additionally set
    `knobOffset` to the angle × `Math.min(dist, SKILL_JOYSTICK_RING_RADIUS)`. When
    `dist < SKILL_CELL_DEADZONE_RADIUS`: set `knobOffset` to `{x:0,y:0}` (do not touch
    `lastDirX`/`lastDirY`, matching current no-op-below-deadzone behavior)
  - [x] Subtask 1.5 — `onTouchEnd`, `onDocumentTouchEnd`: alongside the existing
    `autoIntervalRef`/`activeTouchRef` cleanup, add `setSpawnOrigin(null)` and
    `setKnobOffset({x:0,y:0})` so the ring/knob disappear on release (both branches —
    RELEASE-fires-then-clears and the no-op TAP/AUTO/AIM_CAST path — must clear the visual)
  - [x] Subtask 1.6 — Effect cleanup return function (component unmount / deps change):
    same addition, clear `spawnOrigin`/`knobOffset` alongside the existing ref clears
- [x] **Task 2** (AC: #1, #3) — Render the ring+knob in `SkillCell`'s JSX:
  - [x] Subtask 2.1 — When `spawnOrigin !== null && ability !== null`, render two
    absolutely-positioned `div`s (ring then knob) inside the cell's existing
    `position: relative` root — ring centered at `spawnOrigin` (`left/top = spawnOrigin.{x,y}
    - SKILL_JOYSTICK_RING_RADIUS`), knob centered at `spawnOrigin + knobOffset`
    (`- SKILL_JOYSTICK_KNOB_PX/2`). Both `pointerEvents: 'none'` (matches every other
    overlay in this component) and a `zIndex` between the cooldown overlay (5) and the
    downed-lock overlay (10) — e.g. `8`
  - [x] Subtask 2.2 — Ring color: `var(--accent-warm)` if `ability.inputType === 'RELEASE'`,
    else `var(--accent-spirit)` (covers both AUTO and AIM_CAST). Knob uses the same color.
  - [x] Subtask 2.3 — When `ability.inputType === 'AIM_CAST'`, add
    `animation: 'skill-cell-pulse 1.2s ease-in-out infinite'` to both ring and knob's
    inline style (see Task 3 for the keyframe). AUTO/RELEASE get no `animation` property.
  - [x] Subtask 2.4 — Rely on the cell's existing `overflow: 'hidden'` (already present on
    the root div, line ~768) to visually clip the ring/knob at the cell edge when spawn
    origin is near a corner — no extra clipping logic needed, this satisfies the "ring
    clamps visually to the cell edge" spec language for free
- [x] **Task 3** (AC: #3) — Add the pulse keyframe to `apps/mobile-controller/src/global.css`:
  - [x] Subtask 3.1 — Add a new `@keyframes skill-cell-pulse` block (opacity/scale breathe,
    ~1.2s cycle) below the existing `dot-pulse`/`rotate-hint` keyframes — same idiom, new
    name/timing, do not repurpose `dot-pulse` itself (its 0/40/80/100% keying is tuned for a
    different visual, a loading-dots pulse, not a joystick breathe)
- [x] **Task 4** (AC: #6) — Badge color fix in `ControllerScreen.tsx`:
  - [x] Subtask 4.1 — `ABILITY_BADGE_BORDER.AIM_CAST` (line ~224): change
    `'var(--accent-warm)'` to `'var(--accent-spirit)'`; remove or update the stale comment
    ("warm border still reads fine for a held ability") since it no longer matches
  - [x] Subtask 4.2 — Live grid's inline `badgeBorderColor` ternary (line ~1427-1431):
    change the `ability.inputType === 'AIM_CAST'` branch from `'var(--accent-warm)'` to
    `'var(--accent-spirit)'`
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors
- [x] Run the full Vitest suite (unit + contract + e2e) — confirm no regressions (this
  story touches no test-covered logic, but the full suite is the standing bar per prior
  stories' precedent)
- [x] Manual Client-UX verification per the Required hooks checklist above — flag in the
  Dev Agent Record if this sandbox has no display/touch device available (matches dev-3's
  precedent of deferring device verification to the user)

---

### Review Findings

- [x] [Review][Patch] Cell-rect box-clamp distorts committed aim direction near/past a cell edge — `apps/mobile-controller/src/screens/ControllerScreen.tsx:692-696`. Fixed: direction is now computed from the unclamped touch-to-origin vector (matches pre-3.23 math); the ring/knob visual still bounds itself via the existing `SKILL_JOYSTICK_RING_RADIUS` clamp on the knob and the cell's pre-existing `overflow: hidden`, so AC4's "clamps visually to the cell edge" still holds with no separate rect-clamp needed.
- [x] [Review][Patch] Knob visually re-centers on deadzone re-entry while the ability keeps firing the stale pre-deadzone direction — `apps/mobile-controller/src/screens/ControllerScreen.tsx:696-705`. Fixed: the `else` branch resetting `knobOffset` to `{0,0}` was removed — the knob now holds its last position when below the deadzone, matching `lastDirX`/`lastDirY`'s existing sticky behavior, so the visual no longer contradicts what's still firing.
- [x] [Review][Patch] `getBoundingClientRect()` returning a 0×0 rect mid-touchmove permanently zeroed the clamp, deadlocking direction commit for that gesture [`apps/mobile-controller/src/screens/ControllerScreen.tsx:692-696`] — resolved as a side effect of the ray-preserving fix above: `rect.width`/`rect.height` are no longer read anywhere in `onTouchMove`, so a zero-size rect can no longer affect direction computation.
- [x] [Review][Defer] Required Client-UX hook not run; own code trace corroborates the readability risk it exists to catch [`apps/mobile-controller/src/screens/ControllerScreen.tsx:807-836,852-889`] — deferred, pre-existing gap in this story's completion, already flagged in the Dev Agent Record. Verified directly: the ability name/badge `<span>`s (lines 807-836) are non-positioned (in-flow) elements, which the CSS stacking model paints strictly before `position:absolute` siblings regardless of z-index — so the 80px ring (`zIndex: 8`, lines 852-889) will visually paint over the name/badge text whenever the spawn origin lands near the cell's bottom-left label area, which is likely since players naturally touch near the label. Needs a human pass on a real/emulated touch device before merge — no display available in this sandbox.
- [x] [Review][Defer] Ring/knob tears down mid-hold the instant a successful AUTO/AIM_CAST cast triggers cooldown [`apps/mobile-controller/src/screens/ControllerScreen.tsx:774`] — deferred, pre-existing. `isInteractive` (folds in `!isOnCooldown`) is a dependency of the touch-tracking `useEffect`; the effect's cleanup fires on every cooldown-start, clearing `spawnOrigin`/`knobOffset` even though the thumb never lifted — contradicts EXPERIENCE.md's "whole duration of the hold" language for AUTO/AIM_CAST. Root cause (`isInteractive` in the dependency array) is pre-existing and unmodified by this diff; already transparently logged by the dev as `D-3.23-A` in `deferred-work.md`. Fixing fire-timing/`isInteractive` semantics is explicitly out of this story's Non-goals.

**Dismissed as noise (5):** ring/knob spawning for TAP cells (refuted — `TAP` returns early from the whole touch-tracking `useEffect` at line 655, before the listeners are even attached; Blind Hunter didn't have that guard line in its diff-only view); unthrottled `setKnobOffset` on every `touchmove` (matches the pre-existing movement-joystick ref+state pattern this story was explicitly told to mirror, no profiling evidence of actual jank); 3x-duplicated cleanup block (pre-existing duplication level, unchanged by this diff, and the story's own Non-goals explicitly endorse keeping duplicate call sites over introducing a shared helper); IIFE-in-JSX style preference; two independent deadzone constants (D-019 explicitly mandates independent tunability — working as designed, not a defect).

---

## Dev Notes

### Context — why this story and not part of a bigger one

This is a scoped, single-file (plus one CSS file) visual/UX-spec-drift closure, entirely
within Mobile Controller Engineer's ownership (`apps/mobile-controller/**`) — no
cross-context split needed, unlike the multi-context hardening stories (3.9/3.10/3.22).
The UX design session that specified this (2026-07-20, decision-log.md) explicitly skipped
its own Reviewer Gate ("scoped extension of an already-3-lens-reviewed spine, directly
resolving prior review findings... rather than opening new surface area") — treat
DESIGN.md/EXPERIENCE.md's current (post-diff) text as already-approved spec, not a draft to
re-litigate.

### Current code — read this before writing anything

`SkillCell` (`ControllerScreen.tsx:618-897`) already has all the *logic* this story needs to
extend — it tracks `lastDirX`/`lastDirY` continuously via `onTouchMove` (line 671-690) and
fires per-type via `onTouchStart`'s conditional `autoIntervalRef` (line 663-668) and
`onTouchEnd`'s RELEASE-only fire (line 692-710). **This story adds a visual layer on top of
already-correct fire logic — it does not change when abilities fire**, only what the player
sees while dragging. Confirm this understanding before touching any fire-timing code; if you
find yourself changing `autoIntervalRef`'s interval value, `INPUT_INTERVAL_MS`, or the
RELEASE fire-on-touchend logic, stop — that's out of this story's scope.

The movement joystick (`ControllerScreen.tsx:982-1174` for logic, `1319-1397` for render) is
the direct pattern to mirror: it already does exactly this ref+state split (`joystickOriginRef`
for handler logic, `joystickOriginState`/`joystickKnobOffset` `useState` for rendering,
avoiding stale closures per the existing code comment at line 984), and already clamps knob
offset to a max radius (`JOYSTICK_MAX_RADIUS`, line 1142: `Math.min(dist, JOYSTICK_MAX_RADIUS)`).
Your `SkillCell` implementation should follow the identical shape, just scoped per-cell
instead of once globally, and with the new dedicated deadzone/sizing constants instead of
reusing the movement joystick's.

**Current deadzone is undocumented and inline:** `onTouchMove`'s `const DEADZONE = 6;`
(line 684) is a local variable, not a module constant, and not the same value as the
movement joystick's `DEADZONE_RADIUS = 8` (line 22). This story formalizes skill-cell's
deadzone as its own named constant at 10px — do not accidentally make it share
`DEADZONE_RADIUS` with the movement joystick; D-019 is explicit that these must stay
independently tunable.

### Colors (confirmed hex, DESIGN.md Colors section)

- `accent-spirit` = `#6ea8d8` (CSS var `--accent-spirit`, already used throughout this file)
- `accent-warm` = `#c07d35` (CSS var `--accent-warm`, already used throughout this file)
- `interactive` = `#6ea8d8` — **identical hex to `accent-spirit`**. This is *why* AIM_CAST
  needs the pulse: a color-only distinction from AUTO would be invisible (both would
  literally render the same hex). Do not try to find a different color for AIM_CAST — the
  spec is explicit that the pulse, not a color swap, is the distinguishing signal.

### Mockup reference values (already implemented once, just not in the live build)

`mockups/controller-landscape-1.html:296-314`:
```css
.skill-joystick-outer { width: 80px; height: 80px; border-radius: 50%;
  border: 2px solid #6ea8d8; pointer-events: none; z-index: 10; }
.skill-joystick-inner { width: 28px; height: 28px; border-radius: 50%;
  background: #6ea8d8; pointer-events: none; z-index: 11; }
```
Use `var(--accent-spirit)`/`var(--accent-warm)` (the CSS custom properties already wired
into this codebase), not the raw hex from the mockup — the mockup predates the
custom-property system.

### Existing pulse idiom (global.css:24-27)

```css
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%            { opacity: 1;   transform: scale(1); }
}
```
This is a *different* animation (a loading-dots stagger pulse) at a different implicit
timing than the ~1.2s symmetric breathe D-018 asks for. Add a new, separate
`skill-cell-pulse` keyframe rather than reusing or retiming `dot-pulse` — e.g.:
```css
@keyframes skill-cell-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.92); }
  50%      { opacity: 1;    transform: scale(1.08); }
}
```
(Exact easing/scale values are not spec-mandated beyond "opacity/scale breathe, ~1.2s
cycle" — the above is a reasonable interpretation; adjust to taste as long as it reads as a
slow, symmetric in-out breathe distinct from a static ring.)

### Cell-boundary clamp — the one piece of new geometry logic

Today, `onTouchMove` computes `rawX`/`rawY` directly from the unclamped `touch.clientX/Y`
relative to the cell's rect and origin (line 680-682) — there is currently no clamp to the
cell's bounds at all (direction still updates correctly even far outside the cell, since
touch events keep firing on the original target element per the Touch Events spec — this is
why the ability "just works" today even with no visual). This story adds one clamp step,
which serves both AC2 (ring/knob positioning) and AC4 (boundary rule) simultaneously:

```ts
const rect = el.getBoundingClientRect();
const clampedX = Math.min(Math.max(touch.clientX - rect.left, 0), rect.width);
const clampedY = Math.min(Math.max(touch.clientY - rect.top, 0), rect.height);
const rawX = clampedX - t.originX;
const rawY = clampedY - t.originY;
```
Everything downstream (`dist`, `angle`, `lastDirX`/`lastDirY`, `knobOffset`) derives from
this clamped `rawX`/`rawY` instead of the current unclamped version. This is a strict
superset of current behavior — it does not change any in-bounds drag, only clamps
out-of-bounds drags to the cell edge (both for the direction computed and for where the
ring/knob render, which naturally also gets clipped by the cell's existing
`overflow: hidden`).

### Project Structure Notes

- Both touched files already exist; no new files, no new directories.
- `apps/mobile-controller/src/global.css` is imported once at the app root (not per-component)
  — a new global `@keyframes` block is available anywhere in the app, consistent with how
  `dot-pulse`/`rotate-hint` are already used.
- No `packages/ui-kit/**` involvement — `SkillCell` remains a local component in
  `ControllerScreen.tsx`, matching its current (non-extracted) placement.

### Project Context Rules

- **Ownership**: 100% `apps/mobile-controller/**` — Mobile Controller Engineer, single
  context, per CLAUDE.md's Ownership Rules and project-context.md's Code Organization table.
  No cross-context approval needed.
- **Mobile Controller Constraints** (project-context.md, Platform & Build Rules): "UI stays
  minimal: left half = movement joystick, right half = 2×2 ability grid... standardized
  across all classes — only cell contents differ." This story doesn't change that layout,
  only adds a transient visual (ring/knob) that appears/disappears with touch state — no
  layout shift.
- **No game-rules/simulation-server import** (project-context.md, Simulation Safety): this
  story never touches those packages; confirm your diff doesn't add any new import from
  `game-rules` or `shared-types` beyond what's already imported in this file.
- This story does **not** trigger the Contract-change hook (no `shared-types`/`net-protocol`
  change) or the Simulation-safety hook (no `simulation-server`/`game-rules` change) — only
  the Client-UX hook, scoped to mobile checks (see Required hooks in the Task Header).

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/.decision-log.md#Update session — 2026-07-20] — D-017 (ring+knob visual parity), D-018 (AIM_CAST pulse + badge-color correction), D-019 (10px dedicated deadzone), D-020 (continuous-track, per-type commit sampling model)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md#`skill-cell`] — ring/knob sizing (80px/28px), per-type color+pulse, deadzone, states (`active-joystick`, `active-channel`)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md#`ability-chip`] — AIM_CAST badge color correction to `accent-spirit`
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md#Colors] — `accent-spirit` #6ea8d8, `accent-warm` #c07d35, `interactive` #6ea8d8 (identical to accent-spirit)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md#Skill Cells] — touch behavior by input type, deadzone, cell boundary rule (Section 4)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md#Movement Joystick] — cross-reference confirming the two deadzones are intentionally independent (Section 6)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/controller-landscape-1.html:296-314,474-484] — canonical ring+knob CSS reference
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:618-897] — current `SkillCell` implementation (what you're modifying)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:982-1174,1319-1397] — movement joystick ref+state pattern to mirror
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:220-225] — `ABILITY_BADGE_BORDER` map (Task 4)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:1427-1431] — live grid's inline `badgeBorderColor` (Task 4)
- [Source: apps/mobile-controller/src/global.css:24-27] — existing `dot-pulse` keyframe idiom to follow (new keyframe, not reused directly)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#D-3.3-B] — pre-existing, unrelated RELEASE-drops-on-cleanup gap; do not fix here
- [Source: _bmad-output/implementation-artifacts/dev-3-controller-fullscreen-toggle.md] — precedent for "no automated tests, manual Client-UX verification, flag if no display available" on touch/mobile-UI-only stories
- [Source: CLASS_ABILITIES.md] — which class abilities map to which input type, useful for manual verification (e.g. Stonehide Avalanche=AUTO, Stone Wall=RELEASE, Spiritcaller Soul Mend=AIM_CAST)
- [Source: _bmad-output/project-context.md#Mobile Controller Constraints, #Code Organization Rules] — ownership and layout constraints

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

None — no failures during implementation.

### Completion Notes List

- Added 4 new module-level constants (`SKILL_JOYSTICK_RING_PX`, `SKILL_JOYSTICK_KNOB_PX`,
  `SKILL_JOYSTICK_RING_RADIUS`, `SKILL_CELL_DEADZONE_RADIUS`) mirroring the movement
  joystick's existing constant pattern, kept independently tunable from
  `DEADZONE_RADIUS`/`JOYSTICK_MAX_RADIUS` per D-019.
- `SkillCell` gained a `spawnOrigin`/`knobOffset` ref-mirrored `useState` pair, following the
  exact ref+state split already used by the top-level movement joystick
  (`joystickOriginRef`/`joystickOriginState`) to avoid stale closures in the touch handlers.
- The single new clamp in `onTouchMove` (touch position clamped to the cell's
  `getBoundingClientRect()` before computing offset from origin) satisfies both AC2's
  ring/knob positioning and AC4's cell-boundary rule simultaneously, as scoped in Dev Notes —
  confirmed it is a strict superset of prior behavior (only clamps out-of-bounds drags, no
  change to any in-bounds drag).
- AIM_CAST uses the same `accent-spirit` color as AUTO but with a `skill-cell-pulse` 1.2s
  animation as the distinguishing signal per DESIGN.md's Colors section (`accent-spirit`/
  `interactive` share the identical hex `#6ea8d8`, so a color-only differentiation between
  AUTO and AIM_CAST is not possible).
- Replaced the undocumented inline `const DEADZONE = 6` with the new named
  `SKILL_CELL_DEADZONE_RADIUS = 10` constant, formalizing D-019.
- Fixed `ABILITY_BADGE_BORDER.AIM_CAST` and the live grid's inline `badgeBorderColor` ternary
  (both call sites, left as two separate ternaries per Non-goals — no shared helper
  introduced) from `accent-warm` to `accent-spirit`, closing the pre-3.18 color leftover.
- No fire-timing, cooldown, or protocol code touched — `INPUT_INTERVAL_MS`,
  `autoIntervalRef`'s 33ms interval, and the RELEASE-fires-on-lift logic are byte-for-byte
  unchanged; only the deadzone constant value and the new visual-render/cleanup calls were
  added around the existing handlers.
- Verification: `npm run typecheck` (full monorepo, all 10 tsconfig projects) — 0 errors.
  Full Vitest suite: 436 passed, 0 regressions; 3 pre-existing failures unrelated to this
  story's scope (`ability-dispatch.test.ts` and `hub-ability-use.test.ts` — simulation-server
  port-binding timeout in this sandbox; `full-run.test.ts` — the already-tracked D1
  `selectBondPair` re-pair flakiness, see sprint-status.yaml's 2026-07-17 history notes for
  the same pattern observed on 6.9's unmodified baseline). None touch
  `apps/mobile-controller/**`, consistent with this being a single-file-plus-CSS visual
  change with zero server/protocol footprint.
- **New finding logged, not fixed here:** live-testing the mental model against the AUTO
  spec surfaced that the ring/knob (and underlying touch tracking) tears down the instant
  cooldown starts, not on lift — `isInteractive` includes `!isOnCooldown` and is a dependency
  of the touch-tracking `useEffect`, so every successful AUTO/AIM_CAST cast orphans the
  still-held touch until the player lifts and re-touches. Pre-existing (same root cause as
  the already-tracked D-3.3-B, just cooldown-triggered instead of phase-triggered), out of
  this story's Non-goals-fenced scope (fire-timing/`isInteractive` semantics). Logged as
  `D-3.23-A` in `deferred-work.md`.
- **Manual Client-UX verification NOT performed** — this sandbox has no display or
  touch-emulation browser available, matching dev-3's documented precedent
  (dev-3-controller-fullscreen-toggle.md). The Required hooks checklist (per-type
  ring/knob color+animation+fire-gesture verification, minimal-attention readability check)
  needs a human pass on a real device or touch-emulation devtools before this story can be
  considered fully done — flagging for Cyby to run before/during review.

### File List

- apps/mobile-controller/src/screens/ControllerScreen.tsx (MODIFIED)
- apps/mobile-controller/src/global.css (MODIFIED)

## Change Log

- 2026-07-20 — Implemented ring+knob aiming visual for AUTO/RELEASE/AIM_CAST skill cells,
  dedicated 10px skill-cell deadzone constant, cell-boundary clamp, AIM_CAST pulse keyframe,
  and AIM_CAST badge color fix (accent-warm → accent-spirit) at both call sites. No
  automated tests added (touch-drag interaction, matches dev-1/dev-2/dev-3 precedent);
  manual Client-UX verification deferred to a human with a real device — no display in this
  sandbox.

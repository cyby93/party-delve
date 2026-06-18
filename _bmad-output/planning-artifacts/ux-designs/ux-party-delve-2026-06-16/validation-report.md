# Party Delve UX Design — Consolidated Validation Report

**Source reviews:** Spine Rubric · HUD Legibility · Mobile Touch Input
**Date:** 2026-06-18

---

## Overall Verdict

The Party Delve UX design is structurally well-formed — all required spine sections are present, token naming is consistent, and the key flows tell coherent stories with named protagonists. However, three independent lenses converge on the same core weakness: the design leaves its highest-stakes gameplay states underdefined, specifically the downed/spirit-form phone surface, the reconnect state, and the revive timer's visual treatment, all of which are explicitly flagged as assumptions rather than resolved decisions. Resolving the seven critical and high findings below is required before architecture starts; the remaining medium and low findings are safe to defer to implementation without blocking the build.

---

## Findings by Severity

---

### CRITICAL

---

#### C-1 — Zero wireframes linked from either spine document

**Severity:** Critical
**Source:** Spine Rubric (§5)

**Description.** All 16 files in `.working/` — including `host-hud-wireframe-1.html`, `join-flow-wireframe-1.html`, `controller-landscape-1.html`, `controller-layouts-1.html`, four class-selection iterations, `bond-assignment-wireframe-1.html`, `post-run-summary-wireframe-1.html`, `color-themes-1.html`, `typography-specimen-1.html`, and four direction explorations — are completely orphaned from both DESIGN.md and EXPERIENCE.md. Zero links exist in either document. A developer implementing from the spec has no path to any visual reference without prior knowledge that `.working/` exists.

Additionally, four class-selection wireframe iterations exist (`-1.html` through `-4.html`) with no indication in the decision log which iteration is the resolved design.

**Recommended fix.** Add a `## Visual References` section to DESIGN.md (or a sidebar/frontmatter block) that links every wireframe to its relevant component and section. At minimum: link `host-hud-wireframe-1.html` → DESIGN.md §7 and EXPERIENCE.md §8; `join-flow-wireframe-1.html` → EXPERIENCE.md Flow 1 and `session-code-field`/`join-button` specs; `controller-landscape-1.html` and `controller-layouts-1.html` → EXPERIENCE.md §9; `bond-assignment-wireframe-1.html` → Flow 4 and `bond-card`; `post-run-summary-wireframe-1.html` → `post-run-card` and Flow 6. Mark the resolved class-selection iteration in the decision log (D-004/D-005 chose Spirit Ground / Raw Earth + Spirit Chant but does not name the wireframe file).

---

#### C-2 — Revive timer: wireframe contradicts spec on size and urgency colour

**Severity:** Critical
**Source:** HUD Legibility

**Description.** `host-hud-wireframe-1.html` renders the revive timer at `font-size: 15px` for both the countdown value and the player name. EXPERIENCE.md (Flow 5) and DESIGN.md (§7 `revive-timer` anatomy) both specify "Lora 700, `xl` size (40px)." The wireframe directly contradicts the spec. At 15px on a 1920×1080 canvas viewed from 3 metres, the timer is invisible to most of the room.

Beyond size, the wireframe uses `accent-corruption` (purple, `#7d2dff`) as the border and countdown colour. The spec assigns `critical` state to `corruption-blood` (red, `#c0392b`). Purple at low opacity does not read as an emergency signal from sofa distance. The amber escalation halo is absent from the wireframe entirely.

**Recommended fix.** Implement the timer value at `xl` (40px) and player name at `md` (20px) minimum, matching the spec. Switch border and text colour to `accent-warm` in urgent state and `corruption-blood` at ≤10s. Add the amber `box-shadow` halo that intensifies toward zero. Set minimum container width to 280px. Annotate the wireframe to indicate these corrections are required.

---

#### C-3 — Player chip names and health pips are too small for 8-player layouts

**Severity:** Critical
**Source:** HUD Legibility

**Description.** The wireframe renders `.chip-name` at 13px; DESIGN.md specifies "Lora 700, `base` size (16px)." Health pips are 9×9px in the top strip and 7×7px in-canvas. At 3 metres from a 1080p screen, a 9px pip subtends below the threshold for distinguishing filled from empty without leaning forward. With 8 players (the maximum), per-chip width drops to approximately 200px, forcing name truncation to 4–5 characters at the current padding and pip layout. The in-canvas character tag name (`char-tag-name`) is also 13px.

**Recommended fix.** Raise chip name to `base` (16px) as specified. Scale top-strip health pips to 12×12px minimum; raise in-canvas pips to 10×10px minimum. For 8-player layouts, evaluate a two-row strip or a condensed arc/segmented-bar health glyph rather than 5 discrete pips. Consider replacing the class-indicator label with a single icon to reclaim horizontal space.

---

#### C-4 — Post-run summary player card text is illegible at couch distance

**Severity:** Critical
**Source:** HUD Legibility

**Description.** `post-run-summary-wireframe-1.html` is rendered at 960×540px (0.5× scale). At face-value pixel sizes in the wireframe: `.player-name` is 13px, `.player-class` and `.stat-label`/`.stat-value` are 11px, and the "Tap 'Return to Camp' on your phone" instruction is 10px. If implemented at literal wireframe px values on a 1920×1080 TV at 3 metres, all text is unreadable. Even at the implied 2× scaling (26px name, 22px class/stats), the class name and stat values are marginal from the back of the room. The wireframe contains no annotation stating it is at 0.5× scale.

**Recommended fix.** Specify post-run card sizes explicitly for the 1920×1080 host canvas: player name Lora 700 `lg` (28px) preferred, `md` (20px) minimum; class name Lora 400 `base` (16px); downed count Lora 700 `base` (16px). Raise the bottom instruction to `sm` (13px) at full resolution or move it off the host screen entirely (the phone already controls this transition). Annotate the wireframe: "960×540 at 0.5× scale — all px values render at 2× on the 1920×1080 host canvas."

---

#### C-5 — Floating joystick cell-boundary escape rule is unspecified

**Severity:** Critical
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §6 states the skill-cell joystick ring is "constrained to the cell boundaries" but does not define what happens when the thumb drifts outside the cell during a Joystick-AutoFire or Joystick-Release hold — a common occurrence when aiming down-left from the top-left cell. Three radically different behaviors are possible: (a) ring clamps at cell edge, direction locks to last valid vector; (b) touch re-captured by the adjacent cell, active skill cancels; (c) ring clips outside the cell visually but input continues relative to the origin cell. Behavior (b) is a fatal input conflict during combat. The spec is silent.

**Recommended fix.** Add an "Out-of-cell drag" rule to the skill-cell component pattern in EXPERIENCE.md §6. Recommended behavior: ring clamps at the cell boundary; input direction is the clamped vector; the touch continues to belong to the originating cell until lift. Adjacent cell touches from a different finger remain independent.

---

#### C-6 — Multi-touch requirements are absent from the spec

**Severity:** Critical
**Source:** Mobile Touch Input

**Description.** A player routinely holds left-thumb on the movement joystick (left zone) while right-thumb holds a Joystick-AutoFire skill (right zone) — two concurrent touch points. On Joystick-Release skills, a second right-hand finger may tap a TAP skill — three concurrent touch points. The spec specifies none of this. An implementation that listens to a single touch point per zone will silently drop inputs during combined movement + skill use. iOS Safari and Android Chrome both support multi-touch but it must be explicitly implemented, tracking `event.touches` by identifier, not `event.targetTouches[0]`.

**Recommended fix.** Add a Multi-touch Requirements section to EXPERIENCE.md §6 or §9. Specify: minimum 2 simultaneous touch points (left zone + one skill cell); 3 recommended (movement + AutoFire + TAP); implementation must track each touch by `Touch.identifier`. Flag the iOS Safari `touchmove` cancellation issue with `passive: false` listeners.

---

#### C-7 — Cooldown overlay: wireframe contradicts spec on visual paradigm

**Severity:** Critical
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §4, §10 and DESIGN.md §7 all specify the cooldown overlay as "a conic-gradient covering the majority of the cell face." The wireframe (`controller-landscape-1.html`) implements a 56px circular ring centered in the cell with a dark full-bleed overlay behind it — approximately 29% of the cell height, a traditional circular timer, not a cell-filling sweep. These are two completely different visual paradigms. The spec must resolve the conflict; both documents and the wireframe cannot be correct simultaneously.

**Recommended fix.** Decide which model is authoritative and align all artifacts. If cell-filling conic: rebuild the wireframe to match; document the sweep direction (clockwise from top is convention) and transition percentage-per-second. If ring: update spec text in EXPERIENCE.md §4, §10 and DESIGN.md §7 to match, and validate that the 14px countdown number remains readable at arm's length.

---

### HIGH

---

#### H-1 — `session-code-field` has no behavioral spec in EXPERIENCE.md §4

**Severity:** High
**Source:** Spine Rubric (§3)

**Description.** The component has three visual states defined in DESIGN.md (empty, prefilled, error) and appears in Flow 1, but EXPERIENCE.md §4 has no entry for it. Missing: error trigger conditions, error message copy, pre-fill behavior when URL params are absent versus present, and behavior when the field is submitted empty.

**Recommended fix.** Add a `session-code-field` behavioral pattern entry to EXPERIENCE.md §4 covering all three states: empty (default placeholder), prefilled (URL param present, field populated automatically), error (wrong/expired code, lobby full, server error — each distinct message). Specify that submitting empty triggers the error state inline, not navigation.

---

#### H-2 — `join-button` has no behavioral spec in EXPERIENCE.md §4

**Severity:** High
**Source:** Spine Rubric (§3)

**Description.** The component has loading and success states defined visually in DESIGN.md and appears in Flow 1, but EXPERIENCE.md §4 has no entry for it. Missing: what triggers the loading state, what constitutes success versus failure, how the error is surfaced (to `session-code-field`? inline below the button?), and the success navigation sequence.

**Recommended fix.** Add a `join-button` behavioral pattern entry to EXPERIENCE.md §4. Specify: tap triggers loading state immediately (optimistic); success navigates to Hub Controller; error surfaces to `session-code-field` error state and resets button to default; network timeout shows an inline error and resets the button.

---

#### H-3 — Downed player's phone state is explicitly undesigned (ASSUMPTION flagged)

**Severity:** High
**Source:** Spine Rubric (§4) · Mobile Touch Input (merged)

**Description.** EXPERIENCE.md §5 explicitly marks this as an open ASSUMPTION: "Downed player's phone: [ASSUMPTION: what the downed player sees on their phone while in spirit form is not defined in this session]." The Mobile Touch Input review independently identifies the same gap: a downed player holds a phone with an active combat controller for a skill set they cannot use, and the spec gives no guidance on controller state, whether inputs are blocked, whether any interaction is available, or when the controller reactivates. This is a primary gameplay state in every session once a player goes down.

Both review lenses flag this as a design decision that cannot be deferred past architecture.

**Recommended fix.** Define the spirit-form phone state in EXPERIENCE.md §5. Choose one of: (a) dimmed controller — skill cells fully disabled, joystick disabled, visual treatment indicating spirit form; (b) spectator/observer view; (c) minimal revive-prompt UI. Document the trigger event (server `player_downed` event) and the reactivation trigger (server `player_revived` or `player_respawned`).

---

#### H-4 — Spirit-form phone state during Near-Wipe Vigil is also undesigned

**Severity:** High
**Source:** Spine Rubric (§4)

**Description.** EXPERIENCE.md §5 marks a second related ASSUMPTION: "spirit-form phone state not designed in this session." The Near-Wipe Vigil is the highest-drama state in the game — all players are downed, the clock is running. The phone state for every downed player is undefined at the highest-stakes moment.

**Recommended fix.** Include the Near-Wipe Vigil state in the spirit-form phone resolution from H-3. Specify whether the vigil state produces a distinct phone treatment (e.g., all phones dim to a consistent "holding on" visual distinct from solo-downed spirit form).

---

#### H-5 — Revive timer corner labels: wrong font weight and insufficient text shadow

**Severity:** High
**Source:** HUD Legibility

**Description.** The wireframe renders `#level-label` and `#objective-label` at Lora 400 (not 700 as specified) in `text-secondary` (`#a89ec0`). The specified text-shadow (`0 1px 6px rgba(0,0,0,0.9)`) is insufficient over mid-tone tile edges, particle effects, or corruption glow regions. The labels float directly over the dungeon canvas with no scrim, and the objective label ("CLEAR · 4 enemies remain") is active gameplay guidance — losing it in visual noise during the boss fight is the worst possible failure point.

**Recommended fix.** Use `text-primary` (`#d8d0e8`) rather than `text-secondary`. Confirm Lora 700 weight. Extend the text-shadow to at minimum: `0 1px 4px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.6)`. If playtesting reveals continued legibility issues, add a 40px gradient scrim from `rgba(15,14,16,0.6)` to transparent immediately below the top strip.

---

#### H-6 — Bond overlay text (28px) is too small for a shared-room narrative reveal

**Severity:** High
**Source:** HUD Legibility

**Description.** EXPERIENCE.md and DESIGN.md specify the bond overlay text as "Uncial Antiqua `lg`" (28px). At 28px on a 1920×1080 screen viewed from 3 metres on a 40-inch TV, the bond pair names are approximately 2.8cm tall — readable but not commanding for a moment described as the narrative centrepiece the whole room shares. Additionally, no host-canvas wireframe exists for the bond overlay; the only reference file (`bond-assignment-wireframe-1.html`) is a phone wireframe.

**Recommended fix.** Raise bond pair names to `xl` (40px) minimum; consider `xxl` (56px) for the names and `lg` (28px) for the bond type label as a secondary line. Add a host-canvas wireframe for the bond overlay state to `.working/` and link it from DESIGN.md §7 and EXPERIENCE.md Flow 4.

---

#### H-7 — No dead-zone specification for skill-cell joystick

**Severity:** High
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §6 specifies a dead-zone for the movement joystick but not for the skill-cell joystick. For Joystick-Release skills, a player touching the cell briefly and lifting without dragging (accidental or exploratory touch) will fire the ability in the direction of a 0,0 vector, causing undefined directional behavior. No explicit dead-zone prevents accidental firing and directional locking.

**Recommended fix.** Add a dead-zone specification to the skill-cell joystick in EXPERIENCE.md §6. Recommended: 8–12px radius around the spawn origin. Within that radius: Joystick-Release does not fire on lift; Joystick-AutoFire does not begin. This matches standard mobile game controller practice.

---

#### H-8 — Orientation transition trigger point is undefined

**Severity:** High
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §11 describes the portrait-to-landscape transition as handled by OS rotation but does not define when landscape mode engages. If it triggers after class selection confirmation, the player rotates mid-flow during the most socially visible moment (first join with the whole party watching). The "soft nudge" is flagged as recommended but not designed — no component name, no dismiss behavior.

**Recommended fix.** Define the exact landscape enforcement trigger: recommended lock to portrait during Auth Choice and Session Code Entry; allow OS rotation once the player is on the Hub Controller screen. Add a soft-nudge banner component spec (name, trigger, dismiss — auto-dismiss after 3s). Add this to EXPERIENCE.md §11 orientation table.

---

#### H-9 — Reconnect state is flagged but undesigned

**Severity:** High
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md defines no reconnect state. The bond-card full-screen takeover blocks all controller input — a player reconnecting during a bond moment has no specified re-entry state. The interact-button's disappear trigger ("character moves out of interaction range — no linger") could leave a reconnecting player without a button if the connection dropped mid-POI-interaction.

**Recommended fix.** Add a Reconnect state to EXPERIENCE.md §5 (State Patterns). Minimum: what the phone shows during reconnection (spinner, last known controller state); which server event triggers controller re-activation; whether bond-card state is replayed or skipped on reconnect; whether a reconnected player can re-join a mid-POI interaction.

---

#### H-10 — Interact-button height of 44px is marginal for a thumb-reach gesture in landscape

**Severity:** High
**Source:** Mobile Touch Input

**Description.** The interact-button slides in at top-center while the player holds the phone in landscape with thumbs on left and right zones. At 44px tall and top-center, the button is at maximum reach distance from both thumb zones — a thumb-reach gesture from a landscape landscape grip has limited arc. This is structurally harder than the spec assumes, particularly while the left thumb is actively on the movement joystick.

**Recommended fix.** Increase interact-button minimum height to 52px. Add an explicit note that this target must be validated on device with one-handed landscape grip. Specify whether the intended model requires the player to stop moving to tap Interact, or whether simultaneous movement + interact is designed. Consider an invisible extended hit area below the visible button.

---

### MEDIUM

---

#### M-1 — `ability-chip` has no behavioral spec in EXPERIENCE.md §4

**Severity:** Medium
**Source:** Spine Rubric (§3)

**Description.** The component appears in the ability briefing panel and is visually specced in DESIGN.md, but no §4 entry in EXPERIENCE.md describes its interaction behavior, its role in the briefing panel open/close cycle, or its scan behavior. It is likely read-only but this is unconfirmed.

**Recommended fix.** Add a minimal `ability-chip` behavioral entry to EXPERIENCE.md §4: confirm read-only status, specify whether it is tappable in any state, and note its appearance within the briefing panel open/close lifecycle.

---

#### M-2 — Session Code Entry error states have no behavioral coverage

**Severity:** Medium
**Source:** Spine Rubric (§4) · merged with H-1 context

**Description.** Three distinct error conditions (wrong/expired code, lobby full, server error) are visually hinted in the `session-code-field` `error` state but none are specified behaviorally: what triggers each, what error message text appears, and whether the join-button resets to default. This overlaps with H-1 and H-2 but covers the specific error-message content and per-condition routing.

**Recommended fix.** As part of the H-1/H-2 fixes, specify per-condition error messages: wrong/expired code → "That code isn't valid. Check with your host."; lobby full → "This session is full."; server error → "Can't reach the session. Try again." These can live in the `session-code-field` behavioral entry or in a dedicated Error States section in EXPERIENCE.md §5.

---

#### M-3 — Lobby host screen has no loading, error, or full-lobby state

**Severity:** Medium
**Source:** Spine Rubric (§4)

**Description.** Flow 2 covers the happy path only. The host lobby has no defined state for: session creation loading (main menu), server unreachable error, lobby full (all 4 slots taken — is the QR still shown?), or a kicked-player flash.

**Recommended fix.** Add lobby edge states to EXPERIENCE.md §5 or §8 (HUD & Diegetic UI). Minimum: loading state (session create in progress — spinner or progress on main menu); server unreachable error (inline error with retry CTA); lobby full (QR dims or hides, "Game full" label appears); kicked-player flash (slot briefly shows red before returning to empty).

---

#### M-4 — Auth Choice phone screen: Sign In and Sign Up paths are unspecified

**Severity:** Medium
**Source:** Spine Rubric (§4)

**Description.** Decision log entry D-011 names Sign In and Sign Up as distinct paths but neither has flow steps, failure states (wrong password, OAuth failure), nor a success landing defined anywhere in either spine.

**Recommended fix.** Add a flow or state-pattern entry for the Sign In and Sign Up paths. Minimum: success landing (same as guest path — Hub Controller); OAuth redirect handling (browser opens, callback returns to app); error states (wrong credentials → inline message; OAuth failure → fallback prompt to try guest or retry).

---

#### M-5 — `{colors.interactive}` token is never referenced in EXPERIENCE.md

**Severity:** Medium
**Source:** Spine Rubric (§2)

**Description.** The `interactive` token governs all CTA buttons (`join-button`, "Pick Selected Class," "Return to Camp"). EXPERIENCE.md describes button behavior extensively but never references the token, leaving it unanchored in the behavioral spine.

**Recommended fix.** Reference `{colors.interactive}` in the `join-button` and any other CTA button behavioral entries added to EXPERIENCE.md §4 (as part of H-2). Alternatively, add a brief note in EXPERIENCE.md §4 preamble: "All interactive CTA elements use `{colors.interactive}` for their default state and `{colors.interactive-hover}` for focus/pressed state."

---

#### M-6 — Spirit-form chip uses `opacity: 0.42` on the whole container — indistinguishable from disconnected

**Severity:** Medium
**Source:** HUD Legibility

**Description.** The wireframe applies `opacity: 0.42` to the entire chip in spirit-form state. EXPERIENCE.md specifies dimming only the name text, not the container. At 42% opacity against a `#181620` strip background, a spirit-form chip is visually very close to a disconnected or loading slot. The room cannot tell "Dani is in spirit form (still in the run)" from "Dani dropped."

**Recommended fix.** Dim only the name text to `text-secondary`; empty the pips. Keep the chip container at full opacity with a distinct visual treatment: corruption-purple border at full opacity, ghost icon at full opacity with a brighter `accent-spirit` glow, explicit rim glow on the chip container. Reserve opacity fade for disconnected/inactive states to preserve the semantic distinction.

---

#### M-7 — In-canvas floating name tags: no minimum size or overlap-handling rule for 8 players

**Severity:** Medium
**Source:** HUD Legibility

**Description.** In-canvas `char-tag` names are 13px and pips are 7×7px. With 8 players in a corridor fight or boss arena, character positions compress, name tags stack, and no overlap-handling rule is specified. During combat, coordinating revives by name ("Rexx is down, can anyone reach them?") requires on-screen names to be legible even when clustered.

**Recommended fix.** Set a 16px minimum for in-canvas name text in EXPERIENCE.md §8 or a forthcoming in-canvas rendering spec. Define an overlap rule: when two characters are within N canvas units, apply a vertical-offset cascade to their name tags. Set pip minimum at 10×10px in-canvas. Both constraints belong in EXPERIENCE.md §8 before implementation.

---

#### M-8 — No haptic or audio feedback spec for cooldown completion

**Severity:** Medium
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §7 and §10 describe the cooldown overlay as "large" and "felt, not just noticed," but no haptic or audio spec exists for the cooldown-complete event. A player watching the host screen has no peripheral vision on the phone controller. Without a vibration pulse or audio cue on cooldown completion, the player must glance at the phone to check readiness, breaking the eyes-on-TV design principle.

**Recommended fix.** Add a Haptic and Audio Feedback spec to EXPERIENCE.md §6 or §10. Minimum: a 10–20ms vibration pulse via `navigator.vibrate()` on cooldown complete; note that iOS Safari does not support `vibrate()` and an audio cue fallback is required. Specify: trigger event, vibration pattern, audio event name, volume guidance, iOS Safari limitation.

---

#### M-9 — Spirit-form phone state is completely undefined (touch input perspective)

**Severity:** Medium
**Source:** Mobile Touch Input · merged with H-3

**Note.** This finding is the Mobile Touch Input review's perspective on the same gap as H-3 and H-4. It is listed here at medium from a touch-input standpoint (the inputs are blocked, but the visual treatment during blocking is unspecified) to preserve the cross-lens context. Resolution of H-3 fully resolves this finding.

---

#### M-10 — Guest name session-storage behavior underspecified

**Severity:** Medium
**Source:** Mobile Touch Input

**Description.** EXPERIENCE.md §12 (Flow 1) implies the guest name is entered once and used for the session but does not specify the storage mechanism or its failure modes. Three cases are unaddressed: (1) player opens a second tab — name unavailable; (2) player closes and reopens the tab during a session — session storage cleared, must rejoin; (3) private browsing — clears on window close. Case (2) is the reconnect scenario and must align with the reconnect state (H-9).

**Recommended fix.** Add a Guest Session Persistence note to EXPERIENCE.md §11 or §12 Flow 1. Specify: storage mechanism (session storage); cross-tab behavior (isolated, must re-enter); tab-close behavior (session lost, must rejoin via QR); private-mode behavior (same as tab-close). Note that `localStorage` survives tab-close but persists across sessions — this is a product decision. Align with H-9 reconnect design.

---

#### M-11 — Shadow table embeds raw rgba colour value rather than token reference

**Severity:** Medium
**Source:** Spine Rubric (§6 and §7)

**Description.** DESIGN.md §5 (Elevation & Depth) specifies the spirit glow shadow as `0 0 8px rgba(110,168,216,0.35)`. This embeds the `accent-spirit` hex value (`#6ea8d8`) as raw colour components in the CSS spec rather than deriving it from the token. A developer could implement an incorrect shadow if `accent-spirit` changes.

**Recommended fix.** Replace the raw rgba with a token-aware expression: `0 0 8px color-mix(in srgb, var(--accent-spirit) 35%, transparent)` or equivalent. Add an implementation note in DESIGN.md §5 flagging this pattern as required for all token-derived shadow values.

---

#### M-12 — Raw hex values in EXPERIENCE.md §7 (Contrast Targets)

**Severity:** Medium
**Source:** Spine Rubric (§7)

**Description.** EXPERIENCE.md line 404 contains `#7a7490` and `#a89ec0` as bare hex values in an explanatory aside about the `text-secondary` contrast decision. These violate the "no raw hex in EXPERIENCE.md" rule, even in explanatory prose.

**Recommended fix.** Replace with token reference: "the decision to bump `text-secondary` from its previous value was driven by this concern" — the actual hex values live in DESIGN.md and do not need to be repeated in EXPERIENCE.md.

---

#### M-13 — Badge font-size discrepancy: 9px in wireframe versus 11px in spec

**Severity:** Medium
**Source:** Mobile Touch Input

**Description.** DESIGN.md §3 defines `xs` scale as 11px for input badges (AUTO / RELEASE / TAP). The wireframe renders badges at 9px. At 9px, text is below most platforms' minimum legible text size and below the WCAG advisory minimum. Badges must be readable during class selection and the ability briefing panel.

**Recommended fix.** Align wireframe to the spec value of 11px. If 11px feels cramped, use Lora 700 weight to compensate rather than reducing size. Do not implement below 11px.

---

### LOW

---

#### L-1 — Main Menu has no dedicated flow, no failure path

**Severity:** Low
**Source:** Spine Rubric (§1)

**Description.** Main Menu appears only as step 1 of Flow 2. No climax beat and no failure path (session create fails, server unreachable) are defined for it. A simple screen but the server-unreachable error at session create has no specified behavior.

**Recommended fix.** Add a one-paragraph state note to EXPERIENCE.md §5 covering: idle state, session-create loading state, and server-unreachable error with retry CTA.

---

#### L-2 — Auth Choice phone screen: guest path only, Sign In/Sign Up uncovered by flows

**Severity:** Low
**Source:** Spine Rubric (§1)

**Description.** Auth Choice appears in Flow 1 only via the guest path. Sign In and Sign Up have no flow steps. (See M-4 for the missing state coverage; this is a flow-narrative completeness gap distinct from missing state specs.)

**Recommended fix.** As part of the M-4 fix, add brief flow steps or a conditional branch to Flow 1 for Sign In and Sign Up paths.

---

#### L-3 — Post-Run phone screen has no numbered flow steps from the phone perspective

**Severity:** Low
**Source:** Spine Rubric (§1)

**Description.** The post-run phone screen appears only implicitly at the tail of Flow 6 with no numbered steps covering what the player sees or does on their phone after the run.

**Recommended fix.** Add 2–3 numbered steps to Flow 6 from the phone perspective: button state, tap, transition animation, arrival at Hub Controller.

---

#### L-4 — Run failure (wipe) has no dedicated Key Flow

**Severity:** Low
**Source:** Spine Rubric (§1)

**Description.** Run failure is covered as a State Pattern in EXPERIENCE.md §5 but has no Key Flow. The failure path — from the moment of wipe through the phone "Return to Camp" — is absent as a flow narrative.

**Recommended fix.** Add a brief Key Flow (4–6 steps) for the run-failure path, or extend Flow 6 with a failure branch labeled clearly.

---

#### L-5 — `{colors.interactive-hover}` and `{colors.accent-corruption}` / `{colors.corruption-acid}` are never referenced in EXPERIENCE.md

**Severity:** Low
**Source:** Spine Rubric (§2)

**Description.** These three tokens are defined in DESIGN.md but have no behavioral reference in EXPERIENCE.md. `interactive-hover` should appear in button focus/pressed behavioral descriptions; `accent-corruption` and `corruption-acid` are in-canvas VFX tokens — their absence in EXPERIENCE.md is acceptable given the explicit in-canvas designation, but is noted.

**Recommended fix.** Reference `{colors.interactive-hover}` in the button behavioral entries (as part of M-5 fix). No action required for `accent-corruption` or `corruption-acid` unless a behavioral state uses them.

---

#### L-6 — Hub Controller with no class selected: skill cell behavior undefined

**Severity:** Low
**Source:** Spine Rubric (§4)

**Description.** Flow 1 step 7 references "4 empty or placeholder skill cells" when no class is selected, but no state spec covers what the right zone shows, whether skills can be triggered, or whether there is a nudge to select a class.

**Recommended fix.** Add a brief "no-class" state note for the Hub Controller in EXPERIENCE.md §5: skill cells show placeholder icons (not tappable); a soft nudge badge or disabled-state treatment indicates class selection is available at the campfire.

---

#### L-7 — Boss health bar placement is flagged as an ASSUMPTION

**Severity:** Low
**Source:** Spine Rubric (§4)

**Description.** EXPERIENCE.md §5 flags the boss health bar placement as an ASSUMPTION ("boss health bar UI not defined in this session — common placement is top-center"). This is a persistent host HUD element during the most critical host-screen moment, and its placement is unresolved.

**Recommended fix.** Make a placement decision and remove the ASSUMPTION flag. Recommended: top-center, below the player chip strip, in a dedicated bar element with `corruption-blood` fill and Lora 700 boss name label. Add to EXPERIENCE.md §8 (HUD & Diegetic UI).

---

#### L-8 — HP strip at 6px communicates presence only — no numerical information; should be documented as intentional

**Severity:** Low
**Source:** Mobile Touch Input

**Description.** The 6px HP strip is deliberately minimal and this is a principled decision. However, without explicit documentation of the decision rationale, a developer may add a numeric HP value to "fix" the missing information, creating scope creep.

**Recommended fix.** Add a design intent note to EXPERIENCE.md §7 or DESIGN.md §8: "The HP strip communicates health presence, not precision. Players read precision health from in-canvas pips on the host screen. No numeric HP value is shown on the phone during combat. This is intentional."

---

#### L-9 — Class selection orientation transition: missing component name and spec

**Severity:** Low
**Source:** Mobile Touch Input

**Description.** The transition from portrait class selection back to landscape Hub Controller ("phone transitions back to landscape — Hub Controller view," Flow 3 step 7) is described only in a flow narrative. No component name, orientation lock trigger, animation/snap behavior, or loading state is specified.

**Recommended fix.** Add one line to EXPERIENCE.md §11 (Phone App orientation table): trigger = class confirmed; behavior = OS auto-rotate enabled, no explicit prompt; duration = device rotation speed, no artificial delay. Name the transition (e.g., `class-selection-to-hub-controller-rotate`) so it is implementable.

---

#### L-10 — DESIGN.md aesthetic narrative prose belongs in GDD, not design rationale

**Severity:** Low
**Source:** Spine Rubric (§6)

**Description.** DESIGN.md §1 middle paragraph ("The world is earthy, inhabited, old. Nature and animal spirits are sacred, not ornamental. The setting is a frontier outpost...") describes the game world rather than making visual design decisions. The surrounding Is/Is-Not lists are genuine design decisions; this paragraph is flavor text.

**Recommended fix.** Move the flavor prose to the GDD or narrative doc, or compress it to a single sentence that makes a visual decision ("The aesthetic is lived-in and earthy — not high-fantasy ornament").

---

#### L-11 — `###` heading level reused for both color token entries and component anatomies

**Severity:** Low
**Source:** Spine Rubric (§8)

**Description.** DESIGN.md §2 uses `### token-name — #hex` as sub-headers for each color token. DESIGN.md §7 uses `###` for component anatomies. The structural sections (`##`) clearly delineate sections, so no navigation conflict exists, but the heading semantics are inconsistent.

**Recommended fix.** Consider using `####` for color token entries within §2 or a definition-list format, reserving `###` for component anatomy entries in §7. Low-priority cosmetic fix.

---

## Phase-Blockers

The following critical and high findings must be resolved before architecture starts.

| ID | Title | Severity |
|---|---|---|
| C-1 | Zero wireframes linked from either spine document | Critical |
| C-2 | Revive timer: wireframe contradicts spec on size and urgency colour | Critical |
| C-3 | Player chip names and health pips too small for 8-player layouts | Critical |
| C-4 | Post-run summary player card text illegible at couch distance | Critical |
| C-5 | Floating joystick cell-boundary escape rule is unspecified | Critical |
| C-6 | Multi-touch requirements are absent from the spec | Critical |
| C-7 | Cooldown overlay: wireframe contradicts spec on visual paradigm | Critical |
| H-1 | `session-code-field` has no behavioral spec | High |
| H-2 | `join-button` has no behavioral spec | High |
| H-3 | Downed player's phone state is undesigned | High |
| H-4 | Spirit-form phone state during Near-Wipe Vigil is undesigned | High |
| H-5 | Corner labels: wrong font weight and insufficient text shadow | High |
| H-6 | Bond overlay text too small for a shared-room narrative reveal | High |
| H-7 | No dead-zone specification for skill-cell joystick | High |
| H-8 | Orientation transition trigger point is undefined | High |
| H-9 | Reconnect state is flagged but undesigned | High |
| H-10 | Interact-button height marginal for thumb-reach in landscape | High |

---

## Defer to Implementation

The following medium and low findings do not block architecture but should be resolved before or during engineering handoff.

**Medium (resolve before handoff):**

| ID | Title |
|---|---|
| M-1 | `ability-chip` has no behavioral spec |
| M-2 | Session Code Entry error state message copy unspecified |
| M-3 | Lobby host screen: no loading, error, or full-lobby state |
| M-4 | Auth Choice: Sign In and Sign Up paths unspecified |
| M-5 | `{colors.interactive}` token never referenced in EXPERIENCE.md |
| M-6 | Spirit-form chip uses full-container opacity — indistinguishable from disconnected |
| M-7 | In-canvas floating name tags: no minimum size or overlap rule |
| M-8 | No haptic or audio feedback spec for cooldown completion |
| M-9 | Spirit-form phone state (touch input perspective) — resolved by H-3 |
| M-10 | Guest name session-storage behavior underspecified |
| M-11 | Shadow table embeds raw rgba rather than token reference |
| M-12 | Raw hex values in EXPERIENCE.md §7 |
| M-13 | Badge font-size discrepancy: 9px wireframe vs. 11px spec |

**Low (resolve at implementation):**

| ID | Title |
|---|---|
| L-1 | Main Menu: no dedicated flow, no failure path |
| L-2 | Auth Choice: Sign In/Sign Up uncovered by flows |
| L-3 | Post-Run phone screen: no numbered flow steps |
| L-4 | Run failure (wipe): no dedicated Key Flow |
| L-5 | `interactive-hover` / corruption tokens never referenced in EXPERIENCE.md |
| L-6 | Hub Controller with no class selected: skill cell behavior undefined |
| L-7 | Boss health bar placement flagged as ASSUMPTION |
| L-8 | HP strip minimal-by-design: document intent to prevent scope creep |
| L-9 | Class selection orientation transition: no component name or spec |
| L-10 | DESIGN.md §1 flavor prose belongs in GDD |
| L-11 | `###` heading level reused for color tokens and component anatomies |

---

## Finding Count Summary

| Severity | Count |
|---|---|
| Critical | 7 |
| High | 10 |
| Medium | 13 |
| Low | 11 |
| **Total** | **41** |

*Note: M-9 is a cross-lens duplicate of H-3; it is counted once here but listed under Medium to preserve the cross-lens source attribution. The raw pre-merge count across all three reviews was approximately 44 individual findings.*

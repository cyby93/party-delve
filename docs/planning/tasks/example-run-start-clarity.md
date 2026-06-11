# Example Workflow Run: Run Start Clarity

**Workflow version:** issue-to-spec-workflow.md v1  
**Purpose:** Training example showing the full translation chain from a business issue to implementable tasks. Every step of the runbook is applied in sequence. This example should be realistic enough to use as a calibration reference when onboarding agents to the workflow.

---

## Source issue

| Field | Content |
|---|---|
| Business goal | Make run start feel clearer and less confusing. |
| Player value | Players understand when the selection is still editable and when it is locked. |
| Current pain | Players sometimes misread the transition and try to change choices too late. |
| Desired outcome | The host and controller both show clear pending, locked, and countdown states. |
| Constraints | Must fit the existing HUB/RUN state model. |
| Success criteria | Players can consistently tell whether the run is still editable. |
| Non-goals | No combat changes, no progression changes. |
| Reference docs | (none cited; default routing applies) |

---

## Step 1 — Check Definition of Ready

Evaluating each DoR item against the source issue:

- [x] **Business goal present:** "Make run start feel clearer and less confusing." — clear and scoped.
- [x] **Desired outcome present:** "The host and controller both show clear pending, locked, and countdown states." — observable behavior described.
- [x] **At least one success criterion:** "Players can consistently tell whether the run is still editable." — verifiable from a player perspective.
- [x] **Named domain can be inferred:** The desired outcome mentions both host and controller display states, which map to Host UX, Controller UX, and Session lifecycle.
- [x] **Reference doc or default routing rule:** No docs cited, but the HUB/RUN state model is referenced by name. Default routing applies: search `docs/specs/gameplay-design/hub_and_run_flow_spec.md` and `docs/specs/host-ux-spec.md`.
- [x] **No contradictions:** The issue does not ask for conflicting behaviors.

**DoR result: PASS. Proceed to Step 2.**

---

## Step 2 — Extract intent

> The business goal is to eliminate ambiguity at the moment a run transitions from being editable to locked. The player outcome is that every participant — on both the shared host screen and their individual controller — always knows with certainty whether the run selection can still be changed.

---

## Step 3 — Map to domain(s)

**Primary domain: Host UX**

Rationale: The most significant failure mode is on the shared screen. Players misread the transition, meaning the host display is not making the state change visually clear. The host screen is the authoritative shared surface for session state communication.

**Secondary domains:**

- **Controller UX** — the desired outcome explicitly requires the controller to also show pending, locked, and countdown states. The controller must reflect the same session state in its minimal HUD.
- **Session lifecycle** — the states involved (RUN_SELECTION_PENDING, RUN_LOCKED) are defined in the session state machine. This issue does not change those states, but the implementation must reference and correctly respond to them.

**Out of scope domains:** Networking (no protocol changes needed), Gameplay rules (non-goal: no combat changes), Progression (non-goal: no progression changes), Telemetry (no new user flows being added at this stage), Content pipeline (no asset pipeline work).

---

## Step 4 — Spec lookup

**Specs reviewed:**

### `docs/specs/gameplay-design/hub_and_run_flow_spec.md`

Relevant sections:

- **State Model:** Defines `RUN_SELECTION_PENDING` and `RUN_LOCKED` as distinct core session states. This is the canonical state model the issue refers to.
- **Run selection pending:** "The team reviews the proposed run. The proposal is not yet locked. Players can still adjust class or cosmetic choices if allowed by design." — this confirms the pending state exists and has a specific behavioral meaning.
- **Run locked:** "The run choice is finalized. The host shows a locked state and typically a countdown or start confirmation. No further run selection changes are allowed." — the spec already defines that a locked visual state should be shown, but does not prescribe how.
- **UI Layering Rules:** "Use overlays for readiness, selection pending, countdown, and join/leave feedback." — confirms that overlays are the correct implementation pattern.
- **Open Questions (in spec):** "Should run selection voting be time-limited?" and "Can players change class after run selection but before lock?" — both of these directly relate to this issue.

### `docs/specs/host-ux-spec.md`

Relevant sections:

- **Required Screens:** Lists "character selection" but does not explicitly list a "run selection pending" screen. The pending and locked overlays are implied by the general overlay pattern but not specified.
- **Design Constraints:** "use strong hierarchy for critical combat information" — applies here for the locked state banner.
- **Usability Checks:** Requires "join-flow clarity" — the run start transition is part of this.

### `docs/specs/controller-ux-spec.md`

Relevant sections:

- **Required Screens:** Lists "controller ready screen" and "in-run controller screen" but does not list a "run locked" or "countdown" screen explicitly.
- **Minimal HUD — Allowed:** Lists "reconnect status" and "role or character marker" but does not mention run state indicators.

---

## Step 5 — Gap analysis

### Gap A: Host pending and locked overlays are unspecified

The hub_and_run_flow_spec.md defines `RUN_SELECTION_PENDING` and `RUN_LOCKED` as session states, and states that a locked visual should be shown, but does not specify what visual elements the host overlay must contain, what text or iconography, or what distinguishes pending from locked visually.

**Classification: Spec gap (partial — states exist, visual contract missing)**

No open question needed: The principle is established (overlays, not full-screen transitions; strong hierarchy). The visual design is implementation detail for the Host Experience Engineer. The agent can generate a task without a blocking design decision.

### Gap B: Controller run state display is unspecified

The controller-ux-spec.md does not include a run selection state in its required screens or allowed HUD elements. The desired outcome explicitly requires the controller to show pending, locked, and countdown states. This is a missing spec element.

**Classification: Spec gap (controller UX spec needs an extension)**

No new design decision is required: the behavior is implied by the host spec (show state clearly, keep it minimal) and the controller spec principles (input surface first, minimal HUD). The agent can generate a task to extend the controller spec and implement the view.

### Gap C: Whether selection can change after pending is an open question

The hub_and_run_flow_spec.md asks: "Can players change class after run selection but before lock?" This directly affects what the pending state UI communicates. If class changes are allowed during pending, the UI must show this. If they are not allowed, the UI must block and communicate that.

**Classification: Open question — blocking for visual design of pending state indicator**

This must be routed to the Orchestrator before the pending state UI task can be fully implemented.

### Gap D: Whether countdown is time-bound or manual is an open question

The hub_and_run_flow_spec.md asks: "Should run selection voting be time-limited?" The desired outcome includes a "countdown state." If the countdown is a fixed timer, it must be displayed numerically. If it is a host-triggered confirmation with no countdown, the "countdown" in the desired outcome is a misnomer and the UI must reflect that.

**Classification: Open question — blocking for countdown UI design**

This must be routed to the Orchestrator.

---

## Step 6 — Implementation brief

The run start clarity change adds explicit visual states to both the host shared screen and the controller minimal HUD for the `RUN_SELECTION_PENDING` and `RUN_LOCKED` session states, plus a transition indicator (countdown or confirmation) before the run begins. Both the host and controller implementations are presentation-only: they read the session state emitted by the simulation server and render the appropriate overlay or HUD element. No changes to the session state machine, simulation authority, or networking protocol are required. The Host Experience Engineer owns the host overlay work; the Mobile Controller Engineer owns the controller HUD extension. The Controller UX spec must be updated to include the new screen/HUD states before implementation begins. Two open questions about whether class changes are allowed during pending and whether the countdown is time-bound must be resolved by the Orchestrator before the pending state UI can be finalized.

---

## Step 7 — Task breakdown

---

### Task RUN-CLARITY-01: Extend Controller UX Spec with Run Selection States

```
Phase: Phase 2 (Local Party MVP prep)
Context: The controller-ux-spec.md does not include run selection state screens. Before
  implementing the controller-side UI for run start clarity, the spec must be extended
  to define the required screens and allowed HUD elements for pending, locked, and
  countdown states.
Owner agent: Protocol Architect (spec extension) with review from Mobile Controller Engineer
Goal: Add "run selection pending", "run locked", and "run countdown" as named states to
  the controller UX spec, with minimal HUD requirements for each.
Allowed paths:
  - docs/specs/controller-ux-spec.md
Blocked paths:
  - apps/mobile-controller/**
  - packages/**
  - apps/simulation-server/**
Inputs:
  - docs/specs/controller-ux-spec.md (current version)
  - docs/specs/gameplay-design/hub_and_run_flow_spec.md (State Model and Controller Flow sections)
  - Resolution of open questions C and D (class-change-during-pending, countdown type)
Non-goals:
  - Do not implement any UI code.
  - Do not change the session state machine.
  - Do not add progression or combat content.
Acceptance criteria:
  - controller-ux-spec.md lists "run selection pending", "run locked", and "run countdown"
    as named states in the Required Screens or a new Run Selection States section.
  - Each state includes: what the player sees, what inputs are available, and what the
    HUD is allowed to show.
  - The spec is consistent with hub_and_run_flow_spec.md state naming.
Required hooks:
  - Pre-task (fill this header)
  - Ownership (only docs/specs/controller-ux-spec.md touched)
  - Contract-change (session lifecycle is referenced; Protocol Architect review required)
Required tests:
  - Human review of spec consistency with hub_and_run_flow_spec.md.
  - No code tests (spec-only task).
Telemetry impact:
  - None.
```

---

### Task RUN-CLARITY-02: Implement Host Pending and Locked State Overlays

```
Phase: Phase 2 (Local Party MVP prep)
Context: The host client does not yet show distinct visual states for RUN_SELECTION_PENDING
  and RUN_LOCKED. Players misread the transition because no explicit visual distinction is
  rendered. The host must use the overlay pattern (defined in hub_and_run_flow_spec.md)
  to communicate these states.
Owner agent: Host Experience Engineer
Goal: Add overlay components to the host client that render when the session state is
  RUN_SELECTION_PENDING or RUN_LOCKED, providing visually distinct, couch-readable
  feedback for each state.
Allowed paths:
  - apps/host-client/**
  - packages/ui-kit/** (host-related overlay components only)
Blocked paths:
  - apps/simulation-server/**
  - apps/mobile-controller/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
Inputs:
  - docs/specs/host-ux-spec.md
  - docs/specs/gameplay-design/hub_and_run_flow_spec.md (State Model, UI Layering Rules)
  - Session state events from the simulation server (RUN_SELECTION_PENDING, RUN_LOCKED)
  - Resolution of open question C (class-change-during-pending) to determine whether
    the pending overlay communicates "still editable" or "finalizing"
Non-goals:
  - Do not change the session state machine or simulation logic.
  - Do not add combat, progression, or enemy content.
  - Do not add full-screen transitions; overlays only.
  - Do not modify controller-side rendering.
Acceptance criteria:
  - The host screen shows a visually distinct overlay when the session is in
    RUN_SELECTION_PENDING. The overlay communicates that the run choice is not yet locked.
  - The host screen shows a visually distinct overlay when the session is in RUN_LOCKED.
    The overlay communicates that the choice is finalized.
  - Both overlays are readable at couch distance (couch readability usability check passes).
  - Overlays do not block critical HUB world rendering (they sit on top, not replace).
  - The host correctly removes the overlay when the session transitions out of these states.
Required hooks:
  - Pre-task (fill this header)
  - Ownership (all changes within apps/host-client/** and packages/ui-kit/**)
  - Client-UX (host UI is changing; run host UX checklist: join-flow clarity,
    couch readability, spectator clarity)
Required tests:
  - Smoke test: start a session, propose a run, verify pending overlay appears.
  - Smoke test: lock the run, verify locked overlay appears and pending overlay disappears.
  - Couch readability manual check: verify both overlays are legible from 2–3 metres.
Telemetry impact:
  - None for this task. If a new "run_start_initiated" event is added in a future task,
    it should map to the Session Funnel KPI.
```

---

### Task RUN-CLARITY-03: Implement Controller Run Selection State HUD

```
Phase: Phase 2 (Local Party MVP prep)
Context: The controller does not currently show which run selection state the session is in.
  Players on their phones have no indication of pending vs locked vs countdown. The
  updated controller-ux-spec.md (produced in RUN-CLARITY-01) defines the required states.
Owner agent: Mobile Controller Engineer
Goal: Implement the controller HUD states for RUN_SELECTION_PENDING, RUN_LOCKED, and
  the countdown/confirmation transition, as specified in the updated controller-ux-spec.md.
Allowed paths:
  - apps/mobile-controller/**
  - packages/ui-kit/** (mobile-related components only)
Blocked paths:
  - apps/host-client/**
  - apps/simulation-server/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
Inputs:
  - docs/specs/controller-ux-spec.md (updated version from RUN-CLARITY-01)
  - docs/specs/gameplay-design/hub_and_run_flow_spec.md (Controller Flow section)
  - Session state events from the simulation server
Non-goals:
  - Do not change the session state machine or simulation logic.
  - Do not add new input controls for run selection (selection is host-initiated).
  - Do not add combat, progression, or enemy content.
  - Do not replicate host-screen information on the controller.
Acceptance criteria:
  - The controller shows a minimal but clear indicator when the session is in
    RUN_SELECTION_PENDING. The indicator communicates that a run is being considered.
  - The controller shows a locked indicator when the session is in RUN_LOCKED.
  - If the countdown is time-bound (per open question D resolution), the controller shows
    the remaining time or a progress indicator.
  - All indicators meet the minimal-attention check: a player looking at the host screen
    can glance at their phone and immediately understand the state.
  - Portrait-first layout is preserved; no new full-screen transitions introduced.
Required hooks:
  - Pre-task (fill this header)
  - Ownership (all changes within apps/mobile-controller/** and packages/ui-kit/**)
  - Client-UX (mobile UI is changing; run mobile UX checklist: joystick mapping unaffected,
    skill mapping unaffected, minimal-attention check, sleep/background recovery unaffected)
Required tests:
  - Smoke test: join session, observe pending overlay matches host state.
  - Smoke test: run locks, observe locked indicator appears on controller.
  - Minimal-attention manual check: can a player identify the state with a 1-second glance?
Telemetry impact:
  - None for this task.
```

---

## Step 8 — Validation plan

### Consolidated acceptance criteria

- [ ] The host screen shows a visually distinct overlay in RUN_SELECTION_PENDING.
- [ ] The host screen shows a visually distinct overlay in RUN_LOCKED.
- [ ] Both host overlays are readable at couch distance.
- [ ] Host overlays do not replace the HUB world rendering.
- [ ] The controller shows a clear state indicator for pending, locked, and countdown.
- [ ] Controller indicators pass the minimal-attention check (state identifiable in 1 second).
- [ ] The controller-ux-spec.md documents run selection states.
- [ ] Both host and controller implementations consume session state events only; no new simulation logic.

### Testing checklist

| Task | Tests |
|---|---|
| RUN-CLARITY-01 | Human spec review against hub_and_run_flow_spec.md. No code tests. |
| RUN-CLARITY-02 | Smoke: pending overlay appears on RUN_SELECTION_PENDING. Smoke: locked overlay appears on RUN_LOCKED. Manual: couch readability at 2–3 metres. |
| RUN-CLARITY-03 | Smoke: controller pending indicator matches host state. Smoke: controller locked indicator appears on RUN_LOCKED. Manual: minimal-attention check (1-second glance test). |

---

## Open questions requiring Orchestrator resolution

### Open question C: Can players change class during RUN_SELECTION_PENDING?

**Question:** After a run is proposed but before it is locked, are players allowed to change their class or cosmetic choice on the controller?

**Options:**

- A. Changes allowed during pending — the pending overlay must communicate "run proposed, still choosing" and input remains active on the controller. Affects: Host UX overlay text and iconography, Controller UX allowed inputs during pending state, hub_and_run_flow_spec.md Ready Cancel section.
- B. Changes blocked during pending — the pending overlay communicates "confirm or cancel only" and class/cosmetic input is locked. Affects: Controller UX input availability, simulation lock logic for class selection, hub_and_run_flow_spec.md.
- C. Changes allowed during pending but blocked on RUN_LOCKED — current spec language leans toward this ("Players can still adjust class or cosmetic choices if allowed by design"). Affects: Host UX pending overlay, controller state transition between pending and locked.

**Recommended default:** Option C. It matches the current hub_and_run_flow_spec.md wording and gives players a natural window for last-minute adjustments.

**Blocked tasks:** RUN-CLARITY-02 (pending overlay copy and iconography), RUN-CLARITY-03 (controller input availability during pending).

---

### Open question D: Is the countdown before run start time-limited or host-confirmed?

**Question:** After RUN_LOCKED, does the session wait for a timed countdown (e.g., 5 seconds) or does it wait for host confirmation before transitioning to LOADING?

**Options:**

- A. Timed countdown — the host and controller both display a numeric countdown. Affects: Host UX countdown overlay (timer component), Controller UX countdown indicator, session state machine (timer trigger for LOADING transition), simulation server (timer authority).
- B. Host confirmation — the host triggers the start manually after the locked state is acknowledged. No countdown timer. Affects: Host UX (confirmation button or gesture), controller UX (waiting indicator, not a timer), session state machine (manual trigger event).
- C. Automatic with short delay — the system automatically transitions after a fixed short delay (e.g., 2 seconds) with no countdown display. Affects: Session state machine (delay authority), host and controller overlay duration only.

**Recommended default:** Option A. A visible countdown is the most explicit signal to players and matches the "countdown state" language in the business issue's desired outcome.

**Blocked tasks:** RUN-CLARITY-02 (countdown overlay component type), RUN-CLARITY-03 (controller countdown indicator).

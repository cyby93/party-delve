# Step 02 — Story Amplification + Approval

## Purpose

Using the original story description, clarifying answers, and project-brief context, generate a fully structured story body and present it to the user for approval before writing any file.

---

## Instructions

### 1. Generate the Amplified Story Body

Produce the story body with exactly these sections in order. Use the quality bar from `_bmad-output/implementation-artifacts/2-1-controller-movement-input.md` as a reference for what "well-amplified" means.

---

**## Context**

2–4 sentences covering:
- What this story is about and what it changes or introduces
- Why it matters — the player/user impact
- What phase and system context applies (reference project-brief sections)
- Any key constraints or integration points from the clarifying answers

---

**## Acceptance Criteria**

Bulleted checklist of verifiable conditions. Rules:
- Each criterion must be specific enough for a QA agent to write a test against it
- Phrase as: "Given X, when Y, then Z" or "The system must [observable outcome]"
- Include at least one criterion per system area named in the scope answer
- If contracts are involved, include a criterion about the new/changed event type
- Include at least one failure/edge case criterion based on answer to question 4
- Minimum 4 criteria; no hard maximum

---

**## Non-Goals**

Explicit list of what this story does NOT cover. Rules:
- At least 2 items always — even if the story seems self-contained
- Phrase as: "This story does NOT cover X"
- Common non-goals to consider: UI polish, backend cloud mode, perf optimization, test coverage for adjacent features, cross-platform QA

---

**## Edge Cases**

Known failure modes, boundary conditions, and race conditions. Derive from:
- The user's answer to question 4 (failure modes)
- Phase of the project (Phase 2 = local party mode; reconnect is a common edge case)
- The domain (simulation = determinism; networking = packet loss; mobile = sleep/background)

List each as a bullet. At least 2 items. If the user said "none known", still include the most likely structural edge cases for the domain.

---

**## Telemetry**

List events this story requires. Format each as:

```
- event: `domain.action_name`
  trigger: [when this fires]
  payload: { field1, field2, ... }
```

If no new telemetry events are required, write exactly:
```
No new telemetry events required.
```

Reference `docs/specs/autonomous-cascade-story-format.md` § Telemetry for naming convention (`domain.action` snake_case).

---

**## Phase Log**

Always initialize as:
```
_Empty — story not yet started._
```

---

### 2. Present for Approval

Display the full amplified story to the user with this framing:

```
Here is your amplified story. Review it carefully — this is what the agents will implement.

---

[full story body from above]

---

[A] Approve — save to backlog and get your story ID
[R] Reject — revise with notes
```

HALT — wait for user selection.

---

### 3. Handle Response

**If user selects [A] (or writes "approve" or similar affirmative):**
- Store the approved story body as `approved_story_body`
- If the user edited the displayed text before approving → use their edited version as `approved_story_body`
- If the user approved with comments → store the comments in a variable `approval_comments`; add them as a note in the Phase Log section: `_Approval note: {approval_comments} — not yet started._`
- Proceed to: `./step-03-save.md`

**If user selects [R] (or requests changes):**
- Ask: "What should be revised? Please describe the changes you want."
- HALT — wait for rejection notes
- Store the rejection notes as `rejection_notes`
- Return to: `./step-01-clarify.md` — carry `rejection_notes` into the next clarifying round (step-01 will prepend them to `clarifying_answers`)

**If user makes partial changes (edits specific sections without full rejection):**
- Treat the edited version as the approved body
- Proceed to: `./step-03-save.md`

# Step 01 — Clarifying Dialog

## Purpose

Load project context silently, then ask 3–5 targeted clarifying questions before amplifying the story.

---

## Instructions

### 1. Silent Context Load

Before saying anything to the user:

1. Read `project-brief.md` in full (already loaded in workflow init — use that).
2. Extract the sections most relevant to `{story_description}`:
   - If the description mentions simulation, combat, movement, AI, or game rules → extract `## Game Rules / Simulation` section.
   - If it mentions contracts, events, shared types, or net-protocol → extract `## Contracts / Event Protocol` section.
   - If it mentions host UI, lobby, QR, camera, or HUD → extract `## Host Client` section.
   - If it mentions mobile, controller, joystick, or phone → extract `## Mobile Controller` section.
   - If it mentions telemetry, events, tracking, or KPIs → extract `## Telemetry` section.
   - If it mentions tests, CI, or QA → extract `## Tests / QA` section.
   - When in doubt, extract all sections.
3. Note which parts of the system are already implemented vs. not yet started — this shapes the questions.

Do NOT display the brief to the user. Use it only to make your questions sharper.

---

### 2. Clarifying Questions

Greet the user briefly (1 sentence), then ask 3–5 clarifying questions. Always include the first 4; the 5th is conditional.

**Standard questions — adapt wording based on what you learned from project-brief.md:**

1. **System scope:** "Which parts of the system does this touch? (simulation server, host client, mobile controller, contracts/shared types, or a combination)"

2. **Contract impact:** "Does this require new event types or changes to existing contracts in `packages/shared-types` or `packages/net-protocol`? Or does it work with existing event types?"

3. **Done criteria:** "What does 'done' look like from a player or user perspective? Describe the end state in one or two sentences."

4. **Edge cases / failure modes:** "Are there known edge cases or failure modes to handle? For example: what happens if a player disconnects mid-flow, or if the action is triggered at an unexpected time?"

5. **(Conditional — only ask if the story description implies building on something incomplete):** "Does this story depend on another story completing first? If yes, which one?"

**Targeting rules:**
- If project-brief shows the relevant domain is already implemented → make question 3 more specific to the existing implementation.
- If the story mentions "protocol" or "event" → always ask question 2, even if it seems obvious.
- If the story is clearly isolated (e.g. "add a UI label") → you may drop question 5 entirely.
- If a domain section in the brief is empty/not yet implemented → ask question 4 more directly about what should happen when dependencies are missing.

---

### 3. Wait

HALT — wait for the user to answer all questions before proceeding.

---

### 4. Store and Route

Once the user has answered:

1. Store the original `story_description` as `original_description`.
2. Store the user's answers as `clarifying_answers`.
3. Store the extracted project-brief sections as `brief_context`.
4. If the user's answers include rejection notes from a prior loop, prepend them to `clarifying_answers` as:
   ```
   [REVISION REQUEST] {rejection_notes}
   ```
5. Proceed to: `./step-02-amplify.md`

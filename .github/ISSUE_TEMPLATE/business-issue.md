---
name: Business Issue
about: Describe a player or product problem in business terms. Agents and engineers will translate this into specs and tasks.
labels: "workflow: business-issue"
---

<!--
Fill in every required field before submitting. Required fields are marked with *.
The agent will reject issues that are missing a business goal, desired outcome, or success criterion.
Do not write implementation details here — describe the problem and the desired player experience.
-->

## Business goal *

<!--
One or two sentences. What outcome do we want for the product or players?
Focus on the why, not the how.
Example: "Make run start feel clearer and less confusing."
-->


## Player value *

<!--
Why does this matter to players? What improves in their experience?
Example: "Players understand when the selection is still editable and when it is locked."
-->


## Current pain *

<!--
What is currently broken, missing, or confusing?
Be specific about the friction point. What do players encounter today?
Example: "Players sometimes misread the transition and try to change choices too late."
-->


## Desired outcome *

<!--
What must the system be able to do after this change is shipped?
Describe observable behavior, not code changes.
Example: "The host and controller both show clear pending, locked, and countdown states."
-->


## Constraints *

<!--
Technical, UX, or design constraints that must not be violated.
Example: "Must fit the existing HUB/RUN state model." or "No new server round trips during run start."
-->


## Success criteria *

<!--
How do we know this is done? Write at least one verifiable, behavior-based criterion.
Example: "Players can consistently tell whether the run is still editable."
-->


## Non-goals

<!--
Optional. What should NOT be solved in this ticket? Helps prevent scope creep.
Example: "No combat changes, no progression changes."
-->


## Reference docs

<!--
Optional but strongly recommended. Which existing specs, ADRs, or design documents are relevant?
Example:
- docs/specs/host-ux-spec.md
- docs/specs/gameplay-design/hub_and_run_flow_spec.md
- docs/adr/ADR-0001-hybrid-authority.md
-->

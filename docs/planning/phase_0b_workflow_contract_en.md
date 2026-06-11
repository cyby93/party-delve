# Phase 0b – Workflow Contract and Issue-to-Spec Translation

## Purpose

This section defines how a short, business-oriented GitHub issue is transformed first into an internal design intent, then into an implementable development specification. The goal is to make the development entry point a clear product- or player-experience-level requirement, not a code-level or task-level instruction.

This workflow is especially important when agents will process tasks, because the agent should not guess. Instead, it should follow a formal translation chain: business intent → domain mapping → spec gap check → implementation brief → task list.

## Scope

This section covers:

- GitHub issue format for business-first input.
- Domain routing of business requirements.
- Translation of business language into design and implementation language.
- Handling of open questions.
- Rules for generating specs and tasks.
- Definition of Ready for agent-processable issues.

This section does not describe the concrete gameplay systems, combat tuning, or full UI solutions; those remain in the relevant design/spec documents.

## Core principles

- The primary purpose of an issue is to capture intent, not prescribe a solution.
- The agent’s job is to translate intent into an implementable form.
- Every issue must belong to at least one domain.
- Every implementation proposal must be traceable to an existing or newly created spec element.
- If there is a gap between the business intent and the existing spec, that gap must be handled as a separate decision point.

## Input format

GitHub issues should use the following fields:

- **Business goal:** What we want to achieve.
- **Player value:** Why this improves the experience.
- **Current pain:** What is currently broken or confusing.
- **Desired outcome:** What the system must be able to do after the change.
- **Constraints:** Technical, UX, or design constraints.
- **Success criteria:** How we know it is done.
- **Non-goals:** What should not be solved in this ticket.
- **Reference docs:** Which existing specs this must align with.

## Domain mapping

The agent must classify each issue into one or more of the following domains:

- Session lifecycle.
- Host UX.
- Controller UX.
- Networking.
- Gameplay rules.
- Progression.
- Telemetry.
- Content pipeline.

If an issue touches multiple domains, the agent must identify a primary domain and one or more secondary domains. This is important so that tasks do not mix host presentation responsibilities with simulation authority decisions.

## Translation workflow

The agent should process issues using the following steps:

1. **Intent extraction.** Extract the business goal and the player-experience goal.
2. **Domain routing.** Assign the issue to the correct domain.
3. **Spec lookup.** Find the relevant design/spec documents.
4. **Gap analysis.** Check whether the requested behavior fits the existing rules or requires a new decision.
5. **Implementation brief generation.** Produce a concise internal specification for development.
6. **Task breakdown.** Split the work into small, executable engineering tasks.
7. **Validation plan.** Define the required tests, smoke checks, and acceptance criteria.

## Output format

For every business-first issue, the agent must produce:

- A short interpretation of what the request means.
- The affected domain(s).
- Relevant spec references.
- Any missing decisions or open questions.
- An implementation brief.
- A task list.
- Acceptance criteria.
- A testing checklist.
- If needed, an explicit design decision request.

## Definition of Ready

An issue is considered processable by the agent only if the most important of the following are present:

- A clear business goal.
- A defined desired outcome.
- At least one success criterion.
- A named domain.
- At least one relevant reference doc or a default routing rule.
- No contradictory expectations.

If any of these are missing, the agent must generate a clarification request first, not implementation tasks.

## Handling open questions

If an issue touches behavior whose details are not yet finalized, the agent should do the following:

- Do not invent a rule silently.
- Mark the item as an open question.
- Provide suggested decision options.
- Indicate which system areas would be affected by the choice.

For example, whether run selection should be time-limited or whether reward resolution should be immediate is not an implementation detail; it is a design decision.

## Acceptance criteria policy

Acceptance criteria should always describe behavior and verifiable outcomes, not technology choices. Examples:

- The player can see when the run becomes locked.
- The host clearly distinguishes pending and locked states.
- Late join places the controller into a waiting state.
- On disconnect, the session does not collapse and reconnect restores the correct state.

## Phase 0 deliverable

One of the official outputs of Phase 0 should be:

- a business-first GitHub issue template,
- an issue-to-spec translation rule set,
- an agent output schema,
- a Definition of Ready,
- an open question routing policy,
- an initial testable example task for the workflow.

## Claude agent instruction block

**Agent instructions:**

- Read the issue as a business requirement first.
- Do not start from implementation.
- Identify the primary player or product outcome.
- Map the request to one or more domains.
- Check relevant spec files before proposing changes.
- If the spec is incomplete or ambiguous, surface the ambiguity.
- Produce an implementation brief before tasking.
- Break work into small tasks with clear acceptance criteria.
- Keep host, controller, and simulation responsibilities separate.
- Prefer state-machine and overlay-based solutions where applicable.
- Do not invent new game rules when an open design question exists.

## Example issue shape

**Business goal:** Make run start feel clearer and less confusing.

**Player value:** Players understand when the selection is still editable and when it is locked.

**Current pain:** Players sometimes misread the transition and try to change choices too late.

**Desired outcome:** The host and controller both show clear pending, locked, and countdown states.

**Constraints:** Must fit the existing HUB/RUN state model.

**Success criteria:** Players can consistently tell whether the run is still editable.

**Non-goals:** No combat changes, no progression changes.

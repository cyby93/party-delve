# Issue-to-Spec Workflow Runbook

## Purpose

This runbook describes the full translation chain from a business-first GitHub issue to a set of implementable, bounded-context tasks. It is the operational reference for agents and human reviewers. Follow every step in order. Do not skip steps; each one provides a guard against scope drift and silent design invention.

---

## Step 1 — Check Definition of Ready

Before doing any work, verify that the issue satisfies the Definition of Ready (DoR).

**DoR checklist:**

- [ ] A clear business goal is present (one or two sentences describing what we want to achieve).
- [ ] A defined desired outcome is present (what the system must be able to do after the change).
- [ ] At least one success criterion is present and verifiable from a player or product perspective.
- [ ] A named domain can be inferred (see domain list in Step 3), or a reference doc is provided that implies a domain.
- [ ] At least one relevant reference doc is cited, or a default routing rule applies.
- [ ] No contradictory expectations exist within the issue (e.g., "players should lock selections" and "players can change anything at any time" cannot both be true).

**If any DoR item is missing:**

Stop. Generate a clarification request that lists exactly which items are missing and what information is needed to complete them. Do not proceed to implementation tasks.

Clarification request format:

```
Clarification needed before this issue can be processed:

Missing items:
- [list each missing DoR item]

Questions:
- [specific question for each missing item]
```

---

## Step 2 — Extract intent

Write one or two sentences that capture the essence of the issue in non-technical terms:

- Sentence 1: What is the business goal?
- Sentence 2: What is the intended player outcome?

This is the anchor for all subsequent steps. If any later step produces something that does not serve this intent, it is out of scope.

Example:

> The business goal is to make run start feel unambiguous. The player outcome is that every participant clearly understands whether the session is still editable or already locked, at all times.

---

## Step 3 — Map to domain(s)

Classify the issue into one or more of the following domains:

| Domain | Description |
|---|---|
| Session lifecycle | Session creation, player slot binding, run start, run end, reconnect, and return to HUB |
| Host UX | Shared screen rendering, overlays, HUD elements, couch readability |
| Controller UX | Phone join flow, input mapping, minimal HUD, reconnect UX, sleep recovery |
| Networking | Transport layer, event contracts, message delivery guarantees, latency |
| Gameplay rules | Simulation tick, movement, collision, combat, AI, revive, loot |
| Progression | Account XP, team unlocks, class upgrades, cosmetics |
| Telemetry | Event instrumentation, KPI measurement, latency baseline |
| Content pipeline | Assets, level data, enemy configurations, localization |

Identify:
- **Primary domain:** The domain that owns the decision and the majority of the change.
- **Secondary domains:** Domains that are touched but do not own the decision.

If an issue spans multiple primary domains, split it into separate issues before proceeding.

---

## Step 4 — Spec lookup

For each identified domain, find the relevant specification files:

| Domain | Spec files to check |
|---|---|
| Session lifecycle | `docs/specs/networking-spec.md`, `docs/specs/gameplay-design/hub_and_run_flow_spec.md` |
| Host UX | `docs/specs/host-ux-spec.md`, `docs/specs/gameplay-design/hub_and_run_flow_spec.md` |
| Controller UX | `docs/specs/controller-ux-spec.md`, `docs/specs/gameplay-design/hub_and_run_flow_spec.md` |
| Networking | `docs/specs/networking-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md` |
| Gameplay rules | `docs/specs/gameplay-spec.md`, `docs/specs/gameplay-design/core_combat_loop_v0_1.md`, `docs/specs/gameplay-design/hub_and_run_flow_spec.md` |
| Progression | `docs/specs/content-pipeline-spec.md` |
| Telemetry | `docs/specs/telemetry-spec.md` |
| Content pipeline | `docs/specs/content-pipeline-spec.md` |

Read every spec file in the lookup list. Note the relevant sections. If a spec file does not exist yet, treat that as a gap (see Step 5).

---

## Step 5 — Gap analysis

For each spec file reviewed, determine:

- **Fits existing rules:** The requested behavior is already implied or described. No new design decision is needed. Proceed to Step 6.
- **Partial coverage:** The spec covers adjacent behavior but does not address this exact case. A minor extension or clarification is needed. Document what the extension is.
- **Spec gap:** The behavior is not covered at all, or a conflicting rule exists. A design decision is required before implementation can begin.

For each gap found, create an open question entry. Follow the Open Question Routing Policy (see section at the end of this runbook). Do not proceed to implementation tasks until all blocking open questions are resolved.

---

## Step 6 — Implementation brief

Write a one-paragraph implementation brief that describes:

- What must be built.
- Which system boundaries it touches.
- Which agents are involved.
- What must not be changed (from the non-goals of the original issue).

The brief must be traceable to the intent extracted in Step 2. Every sentence in the brief must be justified by either an existing spec rule or a resolved design decision.

Template:

```
[What must be built, in one to two sentences.]
[Which system layers are involved: session authority, host presentation, controller UX, networking protocol, none of the above.]
[Which agent roles will work on this: Protocol Architect, Simulation Engineer, Host Experience Engineer, Mobile Controller Engineer, QA + Telemetry Engineer.]
[What is explicitly out of scope.]
```

---

## Step 7 — Task breakdown

Produce one or more implementation tasks using the standard task header from `CLAUDE.md`.

Every task must include the following header:

```md
Phase:
Context:
Owner agent:
Goal:
Allowed paths:
Blocked paths:
Inputs:
Non-goals:
Acceptance criteria:
Required hooks:
Required tests:
Telemetry impact:
```

Rules for task splitting:
- One task per agent ownership area. Do not mix host and controller changes in one task.
- If a task requires a shared-types or net-protocol change, that change must be a separate task owned by Protocol Architect.
- If a task requires a simulation change, it must be a separate task owned by Simulation Engineer.
- Keep tasks small enough to be reviewable within a single session.

---

## Step 8 — Validation plan

For each task, define:

- Required tests (unit, integration, contract, e2e).
- Smoke checks that can be run manually.
- Acceptance criteria phrased as observable player or system behaviors.

Tests must be defined before the task is assigned, not after implementation. If no test can be written for an acceptance criterion, the criterion needs to be reworded until it is verifiable.

---

## Agent output schema

When an agent processes a business-first issue, its output must contain exactly these sections in order:

### 1. Interpretation
One to two sentences restating what the issue is asking for in internal product terms.

### 2. Affected domains
Primary domain + list of secondary domains with brief justification for each.

### 3. Spec references
List of spec files reviewed. For each: the relevant section and what it currently says about this issue.

### 4. Open questions (if any)
List of unresolved design questions. Each entry must include: the question, two or three decision options, and the system areas affected by each option. If there are none, write "None."

### 5. Implementation brief
The paragraph produced in Step 6.

### 6. Task list
All tasks produced in Step 7, each with the full CLAUDE.md task header.

### 7. Acceptance criteria
A consolidated list of verifiable acceptance criteria across all tasks.

### 8. Testing checklist
For each task: required tests and smoke checks.

### 9. Design decision requests (if any)
For each open question: a formal request to the Orchestrator with the question, the options, and a recommended default. If there are none, omit this section.

---

## Open question routing policy

Use this policy any time Step 5 reveals a gap or a decision that is not yet finalized.

**Rules:**

1. Do not invent a rule silently. If the behavior is ambiguous or unspecified, do not assume the simplest or most convenient answer.
2. Mark the item as an open question in the agent output.
3. Provide two or three decision options. For each option, describe the player-facing behavior and the system-level implication.
4. Indicate which system areas would be affected by each option (e.g., session state machine, host overlay, controller UX, networking protocol, simulation).
5. Route to the Orchestrator for resolution before task generation. Do not generate implementation tasks for components whose behavior depends on an unresolved question.

**Open question entry format:**

```
Open question: [question title]

Question: [the specific design question]

Options:
  A. [description of option A] — affects: [system areas]
  B. [description of option B] — affects: [system areas]
  C. [description of option C, if needed] — affects: [system areas]

Recommended default: [A, B, or C, with brief rationale]

Blocked tasks: [list of tasks that cannot be generated until this is resolved]
```

**When the Orchestrator resolves an open question:**
- Record the decision in the relevant spec file or as an amendment to an existing ADR.
- Return the issue to the agent with the resolution noted.
- The agent may then generate the blocked tasks.

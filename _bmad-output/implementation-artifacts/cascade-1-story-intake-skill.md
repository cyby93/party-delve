# Story CASCADE-1: `/story` Intake Skill

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — Story Authoring System
Context: Phase 1 is complete (session join flow, shared types, e2e smoke test, telemetry
  scaffold). The autonomous cascade system is fully designed in the brainstorming session
  (_bmad-output/brainstorming/brainstorming-session-2026-06-12-092023.md) and documented in
  two specs (docs/specs/autonomous-cascade-story-format.md,
  docs/specs/workflow-manager-spec.md). The _stories/ folder structure exists. project-brief.md
  is at the repo root. This story builds the /story command — the single entry point that
  authors a new cascade story via interactive dialog.
Owner agent: QA + Telemetry Engineer (owns tools/**, infrastructure)
Goal: Build a Claude Code skill at .claude/skills/story-intake/ that (1) loads relevant
  project-brief.md sections as context, (2) runs a targeted clarifying dialog with the user,
  (3) invokes gds-create-story to produce the amplified story body, (4) presents the result
  for user approval, and (5) on approval writes a properly formatted story file to
  _stories/backlog/ with status: ready.
Allowed paths:
  - .claude/skills/story-intake/**
  - _stories/backlog/**
Blocked paths:
  - apps/**
  - packages/**
  - docs/specs/** (read-only reference)
  - project-brief.md (read-only at runtime — never written by this skill)
  - .claude/skills/gds-create-story/** (read-only — called, never modified)
  - .claude/skills/bmad-create-story/** (read-only — called, never modified)
Inputs:
  - docs/specs/autonomous-cascade-story-format.md — defines the output file format (REQUIRED)
  - docs/specs/workflow-manager-spec.md — defines how /run consumes the output (REQUIRED)
  - project-brief.md — loaded at runtime by the skill for context (read-only)
  - .claude/skills/gds-create-story/SKILL.md — called internally (read-only)
Non-goals:
  - /run execution — that is CASCADE-2 (workflow-manager skill)
  - Automatic dependency detection — handled by /run pre-flight, not /story
  - Cross-story dependency declaration by the user — user can edit frontmatter manually
  - Priority editing after story creation — user edits _stories/backlog/<id>.md directly
  - Multiple story creation in one /story invocation — one call = one story
  - Story validation beyond user approval — /run handles structural validation
Acceptance criteria: see AC section below
Required hooks: none — this is tooling infrastructure, no game code touched
Required tests: manual smoke test (run /story "add combat system", verify output format)
Telemetry impact: none
```

---

## Story

As a developer working on party-delve,
I want to type `/story "brief description"` and have an interactive dialog produce a properly
formatted story file in the backlog,
so that the autonomous cascade system has a complete, machine-readable work order ready to
execute with `/run`.

---

## Acceptance Criteria

1. Running `/story "add combat system"` launches the intake skill and loads the relevant sections of `project-brief.md` as silent context before asking any questions.
2. The skill asks 3–5 targeted clarifying questions about the story — scoped to: which agents are likely involved, whether new contracts are needed, what the acceptance boundary is, and any known edge cases.
3. After the clarifying dialog, the skill invokes `gds-create-story` internals to produce an amplified story body: context section, acceptance criteria list, non-goals, edge cases, and telemetry requirements.
4. The amplified story is displayed to the user for review and approval before any file is written.
5. On user approval, a story file is written to `_stories/backlog/<story-id>.md` with valid frontmatter matching the schema in `docs/specs/autonomous-cascade-story-format.md`. Status must be `ready`, `qa_retries` must be `0`, `pipeline` and `shards` must be empty lists (set later by Orchestrator during `/run`).
6. On user rejection, the skill loops back to the clarifying dialog, carrying the rejection notes as additional context.
7. The story ID is auto-generated as `GDS-NNN` where NNN is the next available number (scan `_stories/` across all subfolders to find the highest existing ID).
8. The output file passes a structural check: all required frontmatter fields present, status is `ready`, markdown body has `## Context`, `## Acceptance Criteria`, `## Non-Goals`, `## Edge Cases`, `## Telemetry`, and `## Phase Log` sections.

---

## Tasks / Subtasks

- [x] **T1 — Scaffold the skill directory** (AC: all)
  - [x] Create `.claude/skills/story-intake/` directory
  - [x] Create `workflow.md` as the skill entry point (loaded by the Claude Code Skill tool)
  - [x] Create `steps/` subdirectory for step files

- [x] **T2 — Write `workflow.md`** (AC: 1, 2)
  - [x] Define skill name, description (matches the trigger: "story intake", "/story")
  - [x] Load config: resolve `project-root`, `output_folder` from `_bmad/core/config.yaml`
  - [x] Define path constant: `story_output_path = _stories/backlog/`
  - [x] Define initialization: check `_stories/backlog/` exists (create if not)
  - [x] Load `project-brief.md` silently — extract sections relevant to the story description from the skill arguments
  - [x] Route to `./steps/step-01-clarify.md`

- [x] **T3 — Write `steps/step-01-clarify.md`** (AC: 1, 2)
  - [x] Silently load `project-brief.md` domain sections relevant to the story topic
  - [x] Ask exactly 3–5 clarifying questions. Standard question set:
    1. "Which parts of the system does this touch? (simulation server, host client, mobile controller, contracts, or combination)"
    2. "Does this require new event types or changes to existing contracts in `packages/shared-types` or `packages/net-protocol`?"
    3. "What is the acceptance boundary — what does 'done' look like from a player/user perspective?"
    4. "Are there known edge cases or failure modes to handle? (e.g. what happens if a player disconnects mid-flow)"
    5. (conditional) "Does this story depend on another story completing first?"
  - [x] Wait for user answers
  - [x] Store answers as context, route to `step-02-amplify.md`

- [x] **T4 — Write `steps/step-02-amplify.md`** (AC: 3, 4)
  - [x] Using the original story description + clarifying answers + project-brief context, generate the amplified story body with these sections:
    - `## Context` — 2–4 sentences: what this story is about, why it matters, what phase and system context applies
    - `## Acceptance Criteria` — bulleted checklist of verifiable conditions. Must be specific enough for the QA agent to write tests against.
    - `## Non-Goals` — explicit list of what this story does NOT cover. At least 2 items always.
    - `## Edge Cases` — known failure modes, boundary conditions, race conditions
    - `## Telemetry` — list of events this story requires. Format per `docs/specs/autonomous-cascade-story-format.md`. If no new events needed, write "No new telemetry events required."
    - `## Phase Log` — always initialized as: `_Empty — story not yet started._`
  - [x] Display the full amplified story to user with:
    ```
    Here is your amplified story. Review it carefully — this is what the agents will
    implement.

    [story body]

    [A] Approve — save to backlog
    [R] Reject — revise with notes
    ```
  - [x] HALT — wait for user selection

- [x] **T5 — Write `steps/step-03-save.md`** (AC: 5, 6, 7, 8)
  - [x] If user approves (A):
    - [x] Scan `_stories/` recursively for all existing `id:` fields in frontmatter
    - [x] Find the highest GDS-NNN number, increment by 1 for the new ID
    - [x] If no existing stories, start at GDS-001
    - [x] Generate the full frontmatter block per the schema in `docs/specs/autonomous-cascade-story-format.md`:
      ```yaml
      ---
      id: GDS-NNN
      title: [story title derived from original description]
      created: [today's date ISO format]
      priority: medium
      status: ready
      current_owner: workflow-manager
      next_owner: ~
      qa_retries: 0
      pipeline: []
      shards: []
      depends_on_stories: []
      ---
      ```
    - [x] Write final file to `_stories/backlog/GDS-NNN-<slug>.md` where slug is kebab-case from the title
    - [x] Confirm to user: "Story GDS-NNN saved to `_stories/backlog/GDS-NNN-<slug>.md`. Run `/run` to start execution."
  - [x] If user rejects (R):
    - [x] Ask: "What should be revised?" — collect rejection notes
    - [x] Return to `step-01-clarify.md` carrying rejection notes as context prefix for the next round

- [x] **T6 — Validate output format** (AC: 8)
  - [x] After writing the file, re-read it and verify:
    - All 9 required frontmatter fields are present (`id`, `title`, `created`, `priority`, `status`, `current_owner`, `next_owner`, `qa_retries`, `pipeline`, `shards`, `depends_on_stories`)
    - Status is exactly `ready`
    - Markdown body contains all 6 required sections as H2 headings
  - [x] If validation fails, fix the file before confirming to the user

---

## Dev Notes

### Skill File Architecture

This skill follows the BMAD micro-file architecture pattern. Study `.claude/skills/bmad-brainstorming/` as the reference implementation — it uses the same `workflow.md` + `steps/` pattern and shows how to load config, manage session state, and route between steps.

```
.claude/skills/story-intake/
  workflow.md              ← Skill entry point, loaded by Skill tool
  steps/
    step-01-clarify.md     ← Context load + clarifying dialog
    step-02-amplify.md     ← Story generation + approval loop
    step-03-save.md        ← File write + ID assignment + validation
```

### The Skill Is Markdown, Not TypeScript

This skill is entirely markdown files with embedded instructions. There is no TypeScript, no compiled code, no package.json. The Claude Code Skill tool reads the workflow.md and executes it as instructions. Do not create any code files.

### Config Loading Pattern

Load from `_bmad/core/config.yaml` to resolve `project-root`, `output_folder`, `user_name`, `communication_language`. This is the same config loaded by all BMAD skills. See `.claude/skills/bmad-brainstorming/workflow.md` lines 35–47 for the exact pattern.

### project-brief.md Loading Strategy

At step-01, read `project-brief.md` completely and silently. Do not display it to the user. Extract domain sections relevant to the story topic from the skill arguments — e.g. if the story is "add combat system", extract `## Game Rules / Simulation` and `## Contracts / Event Protocol`. Use these sections to make the clarifying questions more targeted (e.g. if the brief shows combat isn't implemented yet, question 3 about acceptance boundary becomes more specific to "what is the first playable combat interaction").

The skill MUST NOT write to `project-brief.md`. It is read-only at authoring time. Only the Workflow Manager writes to it on story completion.

### gds-create-story Integration

`gds-create-story` is an existing BMAD skill that produces structured story files. For the amplification step (T4), you are NOT calling `gds-create-story` as a subprocess — instead you are following its document structure pattern to produce an equivalent amplified body inline. The output format of `step-02-amplify.md` must match the story body sections that `gds-create-story` would produce, so the Workflow Manager (and dev agents) can work with them interchangeably.

Specifically: the amplified story produced by this skill must be structurally compatible with existing stories in `_bmad-output/implementation-artifacts/` — study `2-1-controller-movement-input.md` as the quality bar for what "amplified" means.

### Story ID Assignment

The ID scan must be exhaustive: check `_stories/backlog/`, `_stories/active/` (and subdirectories), `_stories/done/`, `_stories/blocked/`. Parse each `.md` file's frontmatter for `id:` field. Extract the NNN number and find the max. This prevents ID collisions across all lifecycle states.

Pattern to extract ID number: `id: GDS-(\d+)` → take the integer, find max, add 1.

If the scan finds no existing stories at all, start at GDS-001.

### Output File Naming

Filename: `GDS-NNN-<slug>.md` where:
- NNN is zero-padded to 3 digits (001, 002, ... 099, 100)
- slug is the story title converted to lowercase kebab-case, max 5 words
- Example: `GDS-003-add-combat-system.md`

### Frontmatter Field Notes

Per `docs/specs/autonomous-cascade-story-format.md`:
- `pipeline: []` — empty at authoring time. Orchestrator populates during `/run`.
- `shards: []` — empty at authoring time. Workflow Manager populates during decomposition.
- `current_owner: workflow-manager` — the Workflow Manager owns all `status: ready` stories.
- `next_owner: ~` — unknown at authoring time. Set by Orchestrator.
- `priority: medium` — default. User can edit manually if needed.

### Clarifying Questions — Targeting Logic

The 5 standard questions are a starting point. The skill should adapt them based on:
- **project-brief.md content**: if a domain is already well-established, fewer questions needed about it
- **Story description keywords**: "combat" → ask about combat state machine; "UI" → ask about which screen; "protocol" → always ask about contract changes
- **Question 5 (dependency)** is conditional: only ask if the story description implies building on something not yet in the brief

### Approval Loop Edge Cases

- User may edit the displayed story text before approving (treat edited text as the approved version)
- User may request specific sections to be changed without full rejection (treat as partial rejection — revise only the named sections)
- User may approve with comments ("approve but rename this event") — treat as approved, note comments in the Phase Log `## Context` section

### References

- [Source: docs/specs/autonomous-cascade-story-format.md — full frontmatter schema and required sections]
- [Source: docs/specs/workflow-manager-spec.md — how /run reads and processes story files]
- [Source: project-brief.md — current project state loaded as context]
- [Source: .claude/skills/bmad-brainstorming/workflow.md — reference skill architecture pattern]
- [Source: _bmad-output/implementation-artifacts/2-1-controller-movement-input.md — quality bar for amplified story output]
- [Source: _bmad/core/config.yaml — config loading pattern]

### Project Structure Notes

```
.claude/skills/story-intake/   ← CREATE (new skill directory)
  workflow.md                  ← CREATE (T2)
  steps/
    step-01-clarify.md         ← CREATE (T3)
    step-02-amplify.md         ← CREATE (T4)
    step-03-save.md            ← CREATE (T5)

_stories/backlog/              ← EXISTS (created in Priority 3 setup)
  GDS-NNN-<slug>.md            ← WRITTEN by skill at runtime (T5)
```

No changes to any other directory. No TypeScript. No package.json. No tests directory.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 4 skill files written as pure markdown per BMAD micro-file architecture pattern.
- T6 validation passed: all 11 required frontmatter fields specified in step-03-save.md; all 6 required body sections present in step-02-amplify.md.
- step-01-clarify.md includes targeting logic that adapts standard questions based on project-brief.md domain content.
- step-02-amplify.md implements the full approval loop with approve/reject/partial-edit/approve-with-comments branching.
- step-03-save.md implements exhaustive ID scan across backlog/active/done/blocked, zero-padded to 3 digits, with post-write validation check.
- No TypeScript, no package.json, no code files created.

### File List

- `.claude/skills/story-intake/workflow.md` — CREATED
- `.claude/skills/story-intake/steps/step-01-clarify.md` — CREATED
- `.claude/skills/story-intake/steps/step-02-amplify.md` — CREATED
- `.claude/skills/story-intake/steps/step-03-save.md` — CREATED

# Story CASCADE-4: `gds-agent-game-dev` Role Config Injection + Confidence Scoring

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — Agent Adaptation
Context: The Workflow Manager (CASCADE-2) dispatches developer shards by invoking
  gds-agent-game-dev with a role config (role name + allowed_paths + blocked_paths)
  injected as context. The current gds-agent-game-dev skill activates as "Link Freeman"
  with a fixed identity and no awareness of role configs or the Phase Log protocol.
  This story adds a CASCADE SHARD MODE that the Workflow Manager activates by passing
  a shard file as input, which causes the agent to operate within its assigned role
  boundaries and emit a structured Phase Log entry with confidence score on completion.
Owner agent: QA + Telemetry Engineer (owns tools/**, infrastructure)
Goal: Add a cascade-shard-mode.md activation path to gds-agent-game-dev that (1) reads
  the injected role config (role, allowed_paths, blocked_paths), (2) reads the shard file
  as its work input, (3) implements only tasks within its allowed_paths, (4) appends a
  structured Phase Log entry with confidence score and assumptions to the PARENT story
  file on completion.
Allowed paths:
  - .claude/skills/gds-agent-game-dev/** (add cascade-shard-mode.md only)
Blocked paths:
  - apps/**
  - packages/**
  - .claude/skills/gds-agent-game-dev/SKILL.md (read-only — understand but don't change)
  - any other existing gds-agent-game-dev files (add, never modify existing behaviour)
Inputs:
  - docs/specs/autonomous-cascade-story-format.md § Confidence Score Protocol (REQUIRED)
  - docs/specs/workflow-manager-spec.md § Dispatching a shard (REQUIRED)
  - .claude/skills/gds-agent-game-dev/SKILL.md — existing agent behaviour (read-only)
Non-goals:
  - Changing Link Freeman's default conversational behaviour
  - Changing how gds-agent-game-dev works when invoked normally by the user
  - Parallel task execution within a shard
  - Code review — that is gds-code-review
  - Test generation — that is handled by bmad-qa-generate-e2e-tests
Acceptance criteria: see AC section below
Required hooks:
  - Simulation-safety hook applies when this agent modifies apps/simulation-server/**
  - Client-UX hook applies when this agent modifies apps/host-client/** or apps/mobile-controller/**
Required tests: none (agent behaviour tested via CASCADE-2 integration)
Telemetry impact: none
```

---

## Story

As the Workflow Manager dispatching a developer shard,
I want to invoke `gds-agent-game-dev` with a shard file and role config and have it
implement only the tasks within its allowed_paths and write a Phase Log entry on
completion,
so that the cascade can dispatch the same agent skill to multiple roles without separate
skill files per role.

---

## Acceptance Criteria

1. When invoked with a shard file path and role config (role, allowed_paths, blocked_paths), the agent reads the shard file as its primary work input and adopts the specified role label in all its output.
2. The agent only reads and modifies files within `allowed_paths`. If it encounters a task that requires touching a file in `blocked_paths`, it flags this in its Phase Log entry as a blocker and does NOT modify the blocked file.
3. On completion, the agent appends a Phase Log entry to the PARENT story file (path derived from shard frontmatter's `parent_id`). Format:
   ```
   ### <role-label> — <ISO datetime> [confidence: N%]
   <2–4 sentences summarising what was implemented>
   Assumptions: <comma-separated list, or "none">
   ```
4. Confidence score reflects the agent's genuine self-assessment: 80–100% means it implemented exactly what the shard specified with no gaps; 60–79% means it made assumptions or had minor ambiguities; below 60% means significant gaps, unknown behaviour, or blocked tasks.
5. If the agent is blocked on a cross-agent dependency (e.g. needs a schema that Protocol Architect hasn't defined yet), it appends a blocker entry INSTEAD of a completion entry:
   ```
   ⚠ <role-label> — <ISO datetime> blocked: <description>. Escalating to <target-role>.
   ```
   and sets the shard `status: failed` in the parent story frontmatter.
6. The agent updates its own shard file's frontmatter: `status: complete`, `confidence: <value>` on success; `status: failed` on blocker.
7. The agent's Phase Log entry is appended to `## Phase Log` in the PARENT story file (not the shard file).

---

## Tasks / Subtasks

- [x] **T1 — Create `cascade-shard-mode.md`** (AC: 1–7)
  - [ ] Create `.claude/skills/gds-agent-game-dev/cascade-shard-mode.md`
  - [ ] Define mode activation: this file is invoked when the Workflow Manager calls `gds-agent-game-dev` with a `--shard <shard-file-path>` argument
  - [ ] Define execution sequence:
    1. Read shard file frontmatter: extract `parent_id`, `owner`, `allowed_paths`, `blocked_paths`
    2. Locate parent story file: `_stories/active/<parent_id>/story.md`
    3. Read shard file body: understand tasks, ACs, context
    4. Adopt role identity: "You are the <owner> agent. Work only within: <allowed_paths>"
    5. For each task in the shard:
       - Check if task's target files are within `allowed_paths`
       - If yes → implement
       - If no → flag as out-of-scope (not a blocker unless the task is explicitly marked as required for this shard)
    6. After all implementable tasks are complete, self-assess confidence (see Confidence Scoring Rules)
    7. Check for unresolved blockers (tasks that could not be completed due to missing dependencies from other agents)
    8. If blockers exist → write blocker Phase Log entry, set shard `status: failed`, STOP
    9. If no blockers → write completion Phase Log entry, update shard frontmatter
  - [ ] Define Phase Log write procedure:
    - Read parent story file
    - Locate `## Phase Log` section
    - Append new entry (do not overwrite existing entries)
    - Write file back
  - [ ] Define shard frontmatter update procedure:
    - Read shard file
    - Update `status` and `confidence` fields
    - Write shard file back

- [x] **T2 — Document cascade mode in SKILL.md header comment** (AC: 1)
  - [x] Add a single comment block at the top of the existing SKILL.md (do not modify any existing content):
    ```
    ## Cascade Shard Mode
    When invoked by the Workflow Manager with --shard <path>, load cascade-shard-mode.md
    instead of the standard activation sequence.
    ```
  - [x] This is a documentation addition only — 4 lines maximum

---

## Dev Notes

### Confidence Scoring Rules

The agent must score honestly. Guidance:

| Score range | When to use |
|---|---|
| 90–100% | Every task implemented exactly as specified, no ambiguities, all files within allowed_paths |
| 80–89% | All tasks done, minor assumptions made (e.g. defaulted a config value not specified) |
| 70–79% | Most tasks done, one or two tasks had ambiguous requirements that were resolved by assumption |
| 60–69% | Some tasks done, significant assumptions made, or one task was out-of-scope and skipped |
| Below 60% | Key tasks blocked, important assumptions with low confidence, or the shard was significantly unclear |

The Workflow Manager will auto-escalate to the user if confidence < 60%.

### Allowed Path Enforcement

The agent must NOT modify files outside `allowed_paths` even if the task description implies it. If a task requires a change in `blocked_paths`:
1. Note it in the Phase Log: "Task X requires changes in `packages/shared-types/` (blocked path). Skipping — Protocol Architect must handle this."
2. Include it in the assumptions/gaps list
3. If the change is REQUIRED (without it the implementation is broken), treat as a blocker

### Phase Log Append — Critical

The Phase Log is append-only. Never overwrite, reorder, or modify existing entries. Always read the current `## Phase Log` section first, then append below the last existing entry. If the Phase Log section says `_Empty — story not yet started._`, replace that placeholder line with the first real entry.

### Path to Parent Story

The parent story path is always: `_stories/active/<parent_id>/story.md`

Where `parent_id` comes from the shard file's frontmatter `parent_id` field (e.g. `GDS-003`).

### No Changes to Default Link Freeman Behaviour

The existing SKILL.md and all existing gds-agent-game-dev files are untouched. cascade-shard-mode.md is a new file that activates only when the Workflow Manager passes `--shard`. A user running `/gds-agent-game-dev` normally still gets Link Freeman with the standard activation sequence.

### References

- [Source: docs/specs/autonomous-cascade-story-format.md § Confidence Score Protocol]
- [Source: docs/specs/workflow-manager-spec.md § Dispatching a shard]
- [Source: docs/specs/workflow-manager-spec.md § Confidence threshold handling]
- [Source: .claude/skills/gds-agent-game-dev/SKILL.md — existing agent (read-only)]

### Project Structure Notes

```
.claude/skills/gds-agent-game-dev/
  SKILL.md                     ← MINOR UPDATE (T2 — 4-line comment addition only)
  cascade-shard-mode.md        ← CREATE (T1)
  [all other existing files]   ← NO CHANGES
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- cascade-shard-mode.md written as pure markdown; no changes to Link Freeman's default behaviour.
- SKILL.md has a 4-line cascade mode comment prepended before the `# Link Freeman` heading.
- Confidence scoring table included with honest 5-tier assessment criteria.
- Append-only Phase Log write protocol fully specified (replace placeholder on first write; append below last entry otherwise).
- Blocker detection and escalation format fully specified per the spec.

### File List

- `.claude/skills/gds-agent-game-dev/cascade-shard-mode.md` — CREATED
- `.claude/skills/gds-agent-game-dev/SKILL.md` — MINOR UPDATE (4-line cascade mode comment prepended)

# Story CASCADE-3: Story Decompose Helper

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — Story Decomposition
Context: CASCADE-2 (workflow-manager skill) references a story decomposition step that
  "calls bmad-shard-doc". The existing bmad-shard-doc skill uses a CLI tool
  (npx @kayvan/markdown-tree-parser) to split markdown by H2 headings — a mechanical
  split that cannot produce agent-aware focused shard files. This story replaces that
  reference by adding a helpers/story-decompose.md to the workflow-manager skill that
  uses LLM-powered decomposition to generate agent-specific shard files.
Owner agent: QA + Telemetry Engineer (owns tools/**, infrastructure)
Goal: Create helpers/story-decompose.md inside .claude/skills/workflow-manager/ that
  takes an amplified story + pipeline (ordered role list) + role config map and produces
  N focused child shard files written to _stories/active/<id>/shards/, one per pipeline
  role, each containing the full story context plus only the tasks and ACs relevant to
  that agent's allowed_paths.
Allowed paths:
  - .claude/skills/workflow-manager/helpers/** (add helpers/story-decompose.md)
  - .claude/skills/workflow-manager/steps/step-02-decompose.md (minor update: replace
    "call bmad-shard-doc" reference with "call helpers/story-decompose.md")
Blocked paths:
  - apps/**
  - packages/**
  - .claude/skills/bmad-shard-doc/** (do not modify — not used in this story)
  - _stories/active/** (written at runtime by the helper, not at build time)
Inputs:
  - docs/specs/autonomous-cascade-story-format.md — shard file structure (REQUIRED)
  - docs/specs/workflow-manager-spec.md § Decomposition — decompose step spec (REQUIRED)
  - .claude/skills/workflow-manager/steps/step-02-decompose.md — the caller (read-only)
Non-goals:
  - Modifying bmad-shard-doc CLI skill
  - Parallel shard generation (sequential, same as CASCADE-2 first implementation)
  - Dynamic acceptance criteria splitting (ACs are inherited in full by all shards)
  - Shard dependency graph declaration (done by step-02-decompose.md, not this helper)
Acceptance criteria: see AC section below
Required hooks: none
Required tests: manual — run decompose against a sample story, verify N shard files produced
Telemetry impact: none
```

---

## Story

As the Workflow Manager's step-02-decompose step,
I want to call `helpers/story-decompose.md` with an amplified story + pipeline + role
config map and receive N focused shard files written to `_stories/active/<id>/shards/`,
so that each specialist agent receives only the context and tasks relevant to its ownership
area.

---

## Acceptance Criteria

1. Given an amplified story and a pipeline of `[protocol-architect, simulation-engineer, host-engineer]`, the helper produces exactly 3 shard files: `shard-protocol-architect.md`, `shard-simulation-engineer.md`, `shard-host-engineer.md`.
2. Each shard file contains: (a) full Context section from parent story, (b) role-specific tasks filtered to the agent's allowed_paths, (c) all Acceptance Criteria from the parent (inherited in full — let the agent determine relevance), (d) Non-Goals from the parent, (e) Edge Cases from the parent, (f) Telemetry requirements from the parent, (g) an empty Phase Log section.
3. Each shard file has a YAML frontmatter block with: `shard_id`, `parent_id`, `owner`, `allowed_paths`, `blocked_paths`, `status: pending`, `confidence: ~`.
4. Shard files are written to `_stories/active/<parent-id>/shards/shard-<role>.md`.
5. If the Orchestrator declared `action: none` for a role (e.g. `protocol-architect`), that role's shard file is still created but marked `status: complete` and `confidence: 100` with a Phase Log entry: `No action required for this role.`
6. The helper returns the list of created shard file paths for step-02-decompose.md to write into the parent story frontmatter.

---

## Tasks / Subtasks

- [x] **T1 — Create `helpers/story-decompose.md`** (AC: 1–6)
  - [ ] Define inputs:
    - `parent_story`: the full amplified story content (path to the active story file)
    - `pipeline`: ordered list of role names
    - `role_config_map`: map of role → {allowed_paths, blocked_paths, skill}
    - `orchestrator_decisions`: map of role → {action: none | implement}
    - `parent_id`: story ID (e.g. GDS-003)
    - `output_dir`: `_stories/active/<parent-id>/shards/`
  - [ ] For each role in `pipeline`:
    - [ ] Read parent story body sections
    - [ ] Generate role-specific task list: scan the parent story's `## Tasks / Subtasks` section and include only tasks that touch files within the role's `allowed_paths`; if no tasks are clearly scoped, include all tasks with a note: "Filter tasks to your allowed paths: [list]"
    - [ ] Build shard file content:
      ```markdown
      ---
      shard_id: shard-<role>
      parent_id: <parent_id>
      owner: <role>
      allowed_paths: [<list from role_config_map>]
      blocked_paths: [<list from role_config_map>]
      status: pending
      confidence: ~
      ---

      # Shard: <role> — <parent story title>

      > This is an agent-specific shard of story <parent_id>.
      > You are the <role>. Work only within your allowed_paths.
      > When complete, append a Phase Log entry to <path-to-parent-story>.

      ## Context
      [Full context section from parent story]

      ## Your Tasks
      [Role-filtered task list]

      ## Acceptance Criteria
      [Full AC list from parent — all criteria inherited]

      ## Non-Goals
      [Full non-goals from parent]

      ## Edge Cases
      [Full edge cases from parent]

      ## Telemetry
      [Full telemetry section from parent]

      ## Phase Log
      _Empty — append your entry here when complete._
      ```
    - [ ] If `orchestrator_decisions[role].action == none`:
      - Write shard with `status: complete`, `confidence: 100`
      - Phase Log section: `### <role> — <datetime> [confidence: 100%]\nNo action required for this role.\nAssumptions: none`
    - [ ] Write shard file to `output_dir/shard-<role>.md`
  - [ ] Return list of created shard file paths

- [x] **T2 — Update `steps/step-02-decompose.md`** (AC: 6)
  - [x] Replace the line "Invoke `bmad-shard-doc` with..." with "Call `helpers/story-decompose.md` with..."
  - [x] Update the parameter list to match the helper's actual inputs (T1 above)
  - [x] Everything else in step-02-decompose.md remains unchanged

---

## Dev Notes

### Why Not bmad-shard-doc

`bmad-shard-doc` runs `npx @kayvan/markdown-tree-parser explode` — a CLI tool that splits
a markdown file by H2 headings into separate files. This produces dumb splits at heading
boundaries, with no understanding of agent roles, allowed_paths, or task ownership. It
cannot filter tasks by path, inject role config into shard headers, or mark no-op shards.
Do not use it for story decomposition.

### Task Filtering Heuristic

When filtering the parent story's `## Tasks / Subtasks` for a specific role, use this logic:

1. Look for tasks that mention file paths explicitly (e.g. `apps/simulation-server/src/...`)
2. Check if the mentioned path falls within the role's `allowed_paths`
3. If a task mentions multiple paths spanning multiple roles → include the task in all relevant role shards with a note indicating which subtasks belong to this role
4. If a task has no explicit path reference → include it in all shards with a note: "Determine if this task is in your allowed_paths before proceeding"
5. If zero tasks match a role but the Orchestrator included it in the pipeline → include all tasks with the full "work only within your allowed_paths" instruction

### Shard File Naming

```
shard-<role>.md
e.g.
  shard-protocol-architect.md
  shard-simulation-engineer.md
  shard-host-engineer.md
  shard-mobile-engineer.md
  shard-fix-simulation-engineer-1.md  (fix shard, retry 1)
```

### References

- [Source: docs/specs/workflow-manager-spec.md § Decomposition]
- [Source: docs/specs/autonomous-cascade-story-format.md § Shard Fields]
- [Source: .claude/skills/workflow-manager/steps/step-02-decompose.md — the caller]

### Project Structure Notes

```
.claude/skills/workflow-manager/
  helpers/
    parse-ownership.md   ← EXISTS (CASCADE-2)
    phase-log.md         ← EXISTS (CASCADE-2)
    story-decompose.md   ← CREATE (T1)
  steps/
    step-02-decompose.md ← MINOR UPDATE (T2 — one line change)
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- helpers/story-decompose.md written with full LLM-powered task-filtering logic (path matching, multi-role tasks, fallback to full task list).
- step-02-decompose.md was already authored in CASCADE-2 to call `helpers/story-decompose.md` — no change needed (both bmad-shard-doc CLI references avoided from the start).
- `action: none` shards get `status: complete`, `confidence: 100` and a pre-filled Phase Log entry so they don't block dispatch.

### File List

- `.claude/skills/workflow-manager/helpers/story-decompose.md` — CREATED

# Helper: Story Decompose — LLM-Powered Shard Generation

## Purpose

Given an amplified story, a pipeline of agent roles, and a role config map, produce N focused child shard files — one per pipeline role — written to `_stories/active/<parent-id>/shards/`.

**This replaces the bmad-shard-doc CLI (`npx @kayvan/markdown-tree-parser explode`), which performs mechanical H2-based splits incompatible with agent-aware decomposition.**

---

## Inputs

| Input | Description |
|---|---|
| `parent_story` | Path to the full amplified story file (`_stories/active/{id}/story.md`) |
| `pipeline` | Ordered list of role keys (e.g. `[protocol-architect, simulation-engineer, host-engineer]`) |
| `role_config_map` | Map of role → `{allowed_paths, blocked_paths, skill}` |
| `orchestrator_decisions` | Full Orchestrator response: `{pipeline, skip, pipeline_reason, skip_reason}` |
| `parent_id` | Story ID string (e.g. `GDS-003`) |
| `output_dir` | Target directory: `_stories/active/{id}/shards/` |

---

## Instructions

### 1. Read Parent Story

Read the full content of `parent_story`. Extract these sections:
- `## Context` → `story_context`
- `## Acceptance Criteria` → `story_acs`
- `## Non-Goals` → `story_non_goals`
- `## Edge Cases` → `story_edge_cases`
- `## Telemetry` → `story_telemetry`
- `## Tasks / Subtasks` → `story_tasks`
- Story title from the frontmatter `title` field → `story_title`

### 2. For Each Role in the Pipeline

Process roles in the order they appear in `pipeline`. For each role:

#### 2a. Determine action

Check `orchestrator_decisions.skip`. If the current role is in the `skip` list:
- `action = none`
Else:
- `action = implement`

#### 2b. Filter tasks for this role

Scan `story_tasks` and identify which tasks belong to this role by checking:

1. Tasks that explicitly mention file paths: check if any mentioned path falls within `role_config_map[role].allowed_paths`
2. Tasks with no explicit path: include them all with a note: `"Note: Filter to your allowed paths: {allowed_paths}"`
3. Tasks that span multiple roles: include in all relevant role shards, noting which subtasks apply

If no tasks clearly map to this role but the role is in the pipeline → include all tasks with the full "work only within your allowed_paths" instruction.

Store as `role_tasks`.

#### 2c. Build shard file content

```markdown
---
shard_id: shard-{role}
parent_id: {parent_id}
owner: {role}
allowed_paths: {role_config_map[role].allowed_paths}
blocked_paths: {role_config_map[role].blocked_paths}
status: pending
confidence: ~
depends_on: []
---

# Shard: {role} — {story_title}

> This is an agent-specific shard of story {parent_id}.
> You are the **{role}** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/{parent_id}/story.md`.

## Context
{story_context}

## Your Tasks
{role_tasks}

## Acceptance Criteria
{story_acs}

## Non-Goals
{story_non_goals}

## Edge Cases
{story_edge_cases}

## Telemetry
{story_telemetry}

## Phase Log
_Empty — append your entry here when complete._
```

#### 2d. Handle `action: none`

If `action = none`:
- Set frontmatter: `status: complete`, `confidence: 100`
- Replace `## Phase Log` section with:
  ```
  ### {role} — {datetime} [confidence: 100%]
  No action required for this role.
  Assumptions: none
  ```

#### 2e. Write the shard file

Write to: `{output_dir}/shard-{role}.md`

### 3. Return Shard Paths

Return the list of all created shard file paths. This list is used by `step-02-decompose.md` to:
- Update the parent story frontmatter `shards` list
- Build the dependency graph

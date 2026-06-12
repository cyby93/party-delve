# Step 02 — Story Decomposition

## Purpose

Parse CLAUDE.md ownership rules, invoke the Orchestrator to declare the pipeline, then call `helpers/story-decompose.md` to generate agent-specific shard files.

---

## Instructions

### 1. Load Role Config Map

Call `helpers/parse-ownership.md` to read CLAUDE.md and build the role config map. Store result as `role_config_map`.

### 2. Load Project Brief Context

Read `project-brief.md`. Extract sections relevant to the active story's domains (same domain-matching logic as step-01: match section names to story context keywords).

Store extracted sections as `brief_context`.

### 3. Invoke Orchestrator (Programmatic Mode)

Invoke the `bmad-agent-pm` skill in programmatic mode with this context package:

```
Role: Orchestrator (pipeline declaration only)
Task: Analyze this story and declare the execution pipeline.

Story: {active story full body}

Available roles:
{role_config_map — list of role names + their allowed_paths}

Project brief context:
{brief_context}

Required output format (YAML only — no other text):
pipeline: [ordered list of role keys]
pipeline_reason: "one sentence explanation"
skip: [list of role keys not needed]
skip_reason: "one sentence explanation"
```

Wait for Orchestrator response. Parse the YAML block. Store:
- `pipeline` — ordered list of role keys (e.g. `[protocol-architect, simulation-engineer, host-engineer]`)
- `skip` — roles not needed for this story

If Orchestrator response cannot be parsed as valid YAML or is missing required fields → default pipeline to all developer roles + qa-agent + telemetry-agent, and note this in the Phase Log.

### 4. Call Story Decompose Helper

Call `helpers/story-decompose.md` with:
- `parent_story` — path to `_stories/active/{story-id}/story.md`
- `pipeline` — ordered list of role keys from Orchestrator
- `role_config_map` — from step 1
- `orchestrator_decisions` — the full Orchestrator response (pipeline + skip + reasons)
- `parent_id` — story ID (e.g. `GDS-003`)
- `output_dir` — `_stories/active/{story-id}/shards/`

This helper writes N shard files to `output_dir` and returns the list of created shard file paths.

Store the result as `shard_paths`.

### 5. Build Dependency Graph

Apply default dependency rules to the pipeline (per `docs/specs/workflow-manager-spec.md`):

```
Default rules:
- protocol-architect shard: depends_on: []  (runs first, no dependencies)
- simulation-engineer shard: depends_on: [shard-protocol-architect]
- host-engineer shard: depends_on: [shard-protocol-architect]
- mobile-engineer shard: depends_on: [shard-protocol-architect]
- qa-agent shard: depends_on: [all developer shards in pipeline]
- telemetry-agent shard: depends_on: [shard-qa-agent]

Exception:
- If protocol-architect is in `skip` list: all developer shards have depends_on: []
```

For each shard file in `shard_paths`:
- Read its frontmatter
- Set `depends_on` field per the rules above
- Write the updated frontmatter back to the shard file

### 6. Update Parent Story Frontmatter

Read `_stories/active/{story-id}/story.md`, update:
```yaml
pipeline: [list of role keys in pipeline]
shards:
  - shard_id: shard-{role}
    owner: {role}
    depends_on: [list]
    status: pending
    confidence: ~
    worktree: ~
```

Write updated frontmatter back to the story file. Preserve the markdown body exactly.

### 7. Phase Log Entry

Append to `## Phase Log` in the parent story:
```
### Workflow Manager — {datetime} [Decompose]
Pipeline declared: {pipeline list}
Skipped roles: {skip list, or "none"}
Orchestrator reason: {pipeline_reason}
Shards created: {N}
```

### 8. Route

Proceed to: `./step-03-dispatch.md`

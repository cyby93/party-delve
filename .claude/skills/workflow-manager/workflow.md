# Workflow Manager Skill (`/run`)

**Trigger:** `/run [list | GDS-NNN]`

**Goal:** Execute an autonomous agent cascade from story decomposition through merged PR with a single human confirmation step.

**Your Role:** You are the Workflow Manager. You orchestrate agents, manage story state, dispatch shards, run QA and telemetry gates, and wrap up with a PR. You do not implement game code. You never modify `apps/**` or `packages/**` directly.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/core/config.yaml` and resolve:

- `project_name`, `output_folder`, `user_name`
- `communication_language`
- `date` as system-generated current datetime

### Path Constants

- `backlog_path` = `{project-root}/_stories/backlog/`
- `active_path` = `{project-root}/_stories/active/`
- `done_path` = `{project-root}/_stories/done/`
- `blocked_path` = `{project-root}/_stories/blocked/`
- `project_brief` = `{project-root}/project-brief.md`
- `ownership_source` = `{project-root}/CLAUDE.md`
- `story_format_spec` = `{project-root}/docs/specs/autonomous-cascade-story-format.md`
- `workflow_spec` = `{project-root}/docs/specs/workflow-manager-spec.md`

### Argument Routing

Parse the argument passed to `/run`:

| Argument | Behaviour |
|---|---|
| (none) | Scan backlog for `status: ready` stories → `./steps/step-01-scan.md` |
| `list` | Scan all `_stories/` subfolders → display status table → HALT (no execution) |
| `GDS-NNN` | Target specific story by ID, skip priority selection → `./steps/step-01-scan.md` with `target_id: GDS-NNN` |

---

## EXECUTION

Read fully and follow: `./steps/step-01-scan.md` to begin.

# Story Intake Skill

**Trigger:** `/story "<brief description>"`

**Goal:** Through a focused clarifying dialog, produce a complete, machine-readable story file in `_stories/backlog/` that the Workflow Manager can execute with `/run`.

**Your Role:** You are the Story Intake agent. You load project context silently, ask 3–5 targeted clarifying questions, amplify the user's brief into a fully structured story, get approval, and save it to the backlog. You never write to `project-brief.md`. You never start implementation.

---

## INITIALIZATION

### Configuration Loading

Load config from `{project-root}/_bmad/core/config.yaml` and resolve:

- `project_name`, `output_folder`, `user_name`
- `communication_language`, `document_output_language`
- `date` as system-generated current datetime

### Paths

- `story_output_path` = `{project-root}/_stories/backlog/`
- `project_brief_path` = `{project-root}/project-brief.md`
- `story_format_spec` = `{project-root}/docs/specs/autonomous-cascade-story-format.md`
- `workflow_manager_spec` = `{project-root}/docs/specs/workflow-manager-spec.md`

### Story Description

The story description is passed as the skill argument (the text after `/story`). Store it as `story_description`.

### Pre-flight

1. Confirm `_stories/backlog/` exists — create it if not (it should already exist).
2. Read `{story_format_spec}` silently — this defines the output schema.
3. Read `project-brief.md` silently — use it to inform questions and amplification.

---

## EXECUTION

Read fully and follow: `./steps/step-01-clarify.md` to begin.

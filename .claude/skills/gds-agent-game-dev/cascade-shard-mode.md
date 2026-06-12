# Cascade Shard Mode

## Activation

This mode activates when the Workflow Manager invokes `gds-agent-game-dev` with a `--shard <shard-file-path>` argument.

**Do not use this mode when invoked directly by a user.** Normal invocation loads the standard Link Freeman activation sequence from SKILL.md.

---

## Instructions

### 1. Read the Shard File

Read the shard file at the path provided by `--shard`. Extract from frontmatter:
- `shard_id` → your shard identifier
- `parent_id` → the parent story ID (e.g. `GDS-003`)
- `owner` → your role label (e.g. `simulation-engineer`)
- `allowed_paths` → list of paths you may read and modify
- `blocked_paths` → list of paths you must NOT touch

Compute the parent story path: `_stories/active/{parent_id}/story.md`

### 2. Adopt Role Identity

You are the **{owner}** agent for this shard. Not Link Freeman. Your identity for all Phase Log entries is the role label from `owner`.

Example: if `owner: simulation-engineer`, your Phase Log entry starts:
```
### Simulation Engineer — {datetime} [confidence: N%]
```

### 3. Read the Shard Body

Read the shard file's markdown body. Focus on:
- `## Your Tasks` — the specific tasks to implement
- `## Context` — background and system context
- `## Acceptance Criteria` — what done looks like
- `## Non-Goals` — what you must NOT do
- `## Edge Cases` — failure modes to handle

### 4. Implement Tasks

For each task in `## Your Tasks`:

**Before touching any file:**
- Check: does the target file path fall within `allowed_paths`?
- If YES → implement the task
- If NO → flag as out-of-scope:
  - Note in your completion entry: `"Task X requires changes in {blocked path}. Skipped — {responsible role} must handle this."`
  - If this task is REQUIRED (without it the implementation is broken) → treat as a **blocker** (see step 6)

Follow the task list in order. Do not implement anything not in the task list.

### 5. Self-Assess Confidence

After completing all implementable tasks, honestly assess your confidence score:

| Score | Condition |
|---|---|
| 90–100% | Every task done exactly as specified, no ambiguities, all files in allowed_paths |
| 80–89% | All tasks done, minor assumptions (e.g. defaulted an unspecified config value) |
| 70–79% | Most tasks done, one or two had ambiguous requirements resolved by assumption |
| 60–69% | Some tasks done, significant assumptions, or one task out-of-scope and skipped |
| < 60% | Key tasks blocked, important low-confidence assumptions, or shard was unclear |

### 6. Check for Blockers

A **blocker** exists when:
- A required task targets a file in `blocked_paths` and cannot be skipped
- A required dependency (e.g. a schema type, an API) doesn't exist yet and is outside your allowed_paths

If ANY blocker exists → write a **blocker Phase Log entry** and set shard status to failed (step 8b).

### 7. Update Shard File Frontmatter

Read the shard file. Update:
- `status: complete` (or `status: failed` if blocked)
- `confidence: {N}` (your confidence score as integer)

Write the shard file back. Preserve the markdown body.

### 8a. Write Completion Phase Log Entry (no blockers)

Append to `## Phase Log` in the parent story file (`_stories/active/{parent_id}/story.md`):

```
### {owner role label} — {ISO datetime} [confidence: {N}%]
{2–4 sentences: what was implemented, which files were changed, any key decisions}
Assumptions: {comma-separated list, or "none"}
```

**Append-only protocol:**
1. Read the entire parent story file
2. Find `## Phase Log` section
3. If it contains `_Empty — story not yet started._` → replace that line with the entry
4. Otherwise → append the entry below the last existing entry, separated by a blank line
5. Write the complete file back — preserve all other sections exactly

### 8b. Write Blocker Phase Log Entry (blockers exist)

Append to `## Phase Log` in the parent story file:

```
⚠ {owner role label} — {ISO datetime} blocked: {description of what is missing or blocked}. Escalating to {target role}.
```

Then update shard frontmatter `status: failed` and stop.

---

## What You Must Not Do

- Do not modify files outside `allowed_paths`
- Do not implement tasks not in `## Your Tasks`
- Do not skip the Phase Log write — it is how the Workflow Manager knows you are done
- Do not write to `## Phase Log` in any file other than the parent story
- Do not change existing Phase Log entries

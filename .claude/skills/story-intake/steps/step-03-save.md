# Step 03 — ID Assignment, File Write, and Validation

## Purpose

Assign a unique story ID, write the final story file to `_stories/backlog/`, validate the output, and confirm to the user.

---

## Instructions

### 1. Assign Story ID

Scan all story files across the full lifecycle tree to find the highest existing ID:

**Directories to scan:**
- `_stories/backlog/`
- `_stories/active/` (and all subdirectories)
- `_stories/done/`
- `_stories/blocked/`

**For each `.md` file found:**
- Read the file's YAML frontmatter
- Look for a line matching: `id: GDS-(\d+)`
- Extract the integer from the match

**Find the maximum integer across all files.** If no story files exist (only `.gitkeep`), start at 0.

**New ID = max + 1**, zero-padded to 3 digits.

Examples:
- No existing stories → new ID: `GDS-001`
- Highest found is `GDS-003` → new ID: `GDS-004`
- Highest found is `GDS-099` → new ID: `GDS-100`

---

### 2. Generate Filename Slug

Convert the story title to a kebab-case slug:
- Lowercase all characters
- Replace spaces and special characters with hyphens
- Take the first 5 words only
- Remove trailing hyphens

The story title is derived from `story_description` (use it as the title, cleaned up).

**Examples:**
- "Add combat system" → `add-combat-system`
- "Player reconnect flow for host lobby" → `player-reconnect-flow-for-host`

Final filename: `GDS-NNN-<slug>.md`

---

### 3. Build the Complete Story File

Assemble the frontmatter + approved body. Use exactly this structure:

```markdown
---
id: GDS-NNN
title: {story title — cleaned up version of story_description}
created: {today's date in ISO format YYYY-MM-DD}
priority: medium
status: ready
current_owner: workflow-manager
next_owner: ~
qa_retries: 0
pipeline: []
shards: []
depends_on_stories: []
---

# {story title}

## Context

{context section from approved_story_body}

## Acceptance Criteria

{acceptance criteria section from approved_story_body}

## Non-Goals

{non-goals section from approved_story_body}

## Edge Cases

{edge cases section from approved_story_body}

## Telemetry

{telemetry section from approved_story_body}

## Phase Log

{phase log section from approved_story_body}
```

---

### 4. Write the File

Write the assembled content to:
```
_stories/backlog/GDS-NNN-<slug>.md
```

---

### 5. Validate the Output

Re-read the written file and verify:

**Frontmatter checks:**
- [ ] All 11 required fields present: `id`, `title`, `created`, `priority`, `status`, `current_owner`, `next_owner`, `qa_retries`, `pipeline`, `shards`, `depends_on_stories`
- [ ] `status` is exactly `ready`
- [ ] `qa_retries` is `0`
- [ ] `pipeline` is `[]`
- [ ] `shards` is `[]`

**Body checks:**
- [ ] `## Context` section present
- [ ] `## Acceptance Criteria` section present
- [ ] `## Non-Goals` section present
- [ ] `## Edge Cases` section present
- [ ] `## Telemetry` section present
- [ ] `## Phase Log` section present

**If any check fails:** Fix the file before confirming to the user. Do not report success until all checks pass.

---

### 6. Confirm to User

Once validation passes, output:

```
Story GDS-NNN saved to `_stories/backlog/GDS-NNN-<slug>.md`.

Run `/run` to start execution.
```

Done — this skill's job is complete.

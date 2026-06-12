# Step 01 — Pre-Flight Scan + User Confirmation

## Purpose

Scan story state, run dependency analysis, present the proposed execution order to the user, and get a single confirmation before the cascade begins.

---

## Instructions

### A. LIST MODE (if `list_only: true`)

If invoked with `/run list`:

1. Scan all `.md` files in:
   - `_stories/backlog/`
   - `_stories/active/` (including subdirectories)
   - `_stories/done/`
   - `_stories/blocked/`
2. For each story file, read frontmatter and extract: `id`, `title`, `status`, `priority`, `shards` list.
3. Display a formatted table:
   ```
   Story Backlog & Status
   ──────────────────────────────────────────────────────────────
   ID        Status    Priority  Title
   ──────────────────────────────────────────────────────────────
   GDS-001   ready     high      Add combat system
   GDS-002   active    medium    Player reconnect flow (2/3 shards done)
   GDS-003   done      medium    Mobile joystick input
   ──────────────────────────────────────────────────────────────
   ```
   Include shard progress in the title column for active stories (N of M shards complete).
4. HALT — no execution starts in list mode.

---

### B. STORY SELECTION

**If `target_id` is set (e.g. `/run GDS-003`):**
- Find the story file matching `id: GDS-003` in `_stories/backlog/`
- If not found in backlog, check `_stories/active/` (resume an in-progress story)
- If not found anywhere, output: `Story GDS-NNN not found. Run /run list to see all stories.` and HALT
- Set `selected_story` to this story

**If no target_id (default scan):**
- Scan `_stories/backlog/` for all `.md` files with `status: ready` in frontmatter
- If no ready stories found:
  ```
  No ready stories in backlog. Run /story "<description>" to create one.
  ```
  HALT
- If exactly one ready story: auto-select it (no priority menu needed)
- If multiple: sort by `priority` (high → medium → low), present numbered list, ask user to select

---

### C. PRE-FLIGHT DEPENDENCY ANALYSIS

After selecting a story, run the pre-flight check:

**Step 1 — Cross-story conflict check:**
- Scan `_stories/active/` for any stories currently in progress
- For each active story: read its `pipeline` field (list of roles with paths)
- Compare path coverage: if the selected story's likely domains overlap with an active story's pipeline paths → flag as potential conflict
- Domain inference: scan the selected story's `## Context` and `## Acceptance Criteria` for system area keywords (simulation, host-client, mobile-controller, net-protocol, shared-types, telemetry)

**Step 2 — Cross-story dependency check:**
- Read the selected story's `depends_on_stories` frontmatter field
- If non-empty: verify each listed story is `status: done`
- If any dependency is NOT done → output:
  ```
  ⚠ Story GDS-NNN depends on GDS-MMM which is not yet complete.
  Run /run GDS-MMM first, or /run list to see current state.
  ```
  HALT

**Step 3 — Build pre-flight summary:**
```
Pre-flight Analysis: GDS-NNN — {story title}
──────────────────────────────────────────────
Story domains: {inferred domains from story context}
Active story conflicts: {none | list with explanation}
Dependency check: {all clear | blocked items}
Estimated pipeline: {preliminary role list based on domains}
```

---

### D. USER CONFIRMATION

Present the pre-flight summary and a confirmation prompt:

```
Ready to execute GDS-NNN: {story title}

{pre-flight summary block}

[Y] Confirm and start cascade
[E] Edit execution order
[S] Start anyway (skip conflict warnings)
[X] Cancel
```

HALT — wait for user input. This is the **only human touchpoint** in the cascade.

**On [Y] or [S]:**
1. Create directory `_stories/active/{story-id}/`
2. Create directory `_stories/active/{story-id}/shards/`
3. Move story file from `_stories/backlog/{filename}.md` to `_stories/active/{story-id}/story.md`
4. Update story frontmatter: `status: active`
5. Route to: `./step-02-decompose.md`

**On [E]:**
- Display numbered list of pipeline roles derived from domain inference
- Accept reorder input from user (e.g. "swap 1 and 2")
- Re-display updated order, re-confirm with [Y] or [X]

**On [X]:**
- Output: `Execution cancelled. Story remains in backlog.`
- HALT

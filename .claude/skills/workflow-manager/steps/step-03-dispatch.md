# Step 03 — Shard Dispatch Loop

## Purpose

Execute developer shards in dependency order — each in its own git worktree. After all shards complete, proceed to merge.

**Implementation note:** First version dispatches shards sequentially. Parallel dispatch (using Agent background mode) is a future enhancement.

---

## Instructions

### Dispatch Plan

Before starting the loop, print this block once. After printing it, produce no further output until the loop finishes — except for HALT conditions (blocker, deadlock, sub-60% confidence, missing confidence tag), which are always permitted:

```
Dispatch Plan: {story-id} — {story title}
──────────────────────────────────────────
Developer shards (dependency order) — qa-agent and telemetry-agent run in later steps:
  {n}. {shard_id}  owner: {owner}  depends_on: {depends_on list or "—"}
──────────────────────────────────────────
Running autonomously. Next output: final summary or a HALT if an error condition triggers.
```

---

### Dispatch Loop

> **SILENT LOOP — autonomous mode active.**
> Once this loop starts, produce **no user-facing text output** between shard completions.
> All state is tracked via story file and Phase Log updates only.
> The only permitted user-facing output inside the loop is a HALT for a blocker, deadlock, sub-60% confidence, or missing confidence tag.
> Do not end your turn between loop iterations. Use tool calls only (file reads/writes, EnterWorktree, ExitWorktree, Agent).

Repeat until all shards in the pipeline (excluding qa-agent and telemetry-agent) have `status: complete` or `status: failed`:

#### 1. Find the next ready shard

Read the parent story's `shards` list from frontmatter. A shard is **ready** when:
- Its `status` is `pending`
- All shards listed in its `depends_on` have `status: complete`

If no ready shard exists AND some shards are still `status: pending` → a dependency deadlock has occurred. Output:
```
⚠ Dispatch deadlock: no ready shards but pending shards remain.
Pending shards: {list}
Blocked on: {their depends_on values}
```
HALT and await user input.

#### 2. Enter worktree

Use `EnterWorktree` to create a new worktree on branch:
```
shard/{story-id}-{shard-id}
```
e.g. `shard/GDS-003-shard-simulation-engineer`

Store the worktree path.

#### 3. Record Phase Log baseline

Before invoking the agent, count the current number of Phase Log entries in the parent story and store it as `pre_count`. After the agent completes, a valid new entry exists when the entry count is exactly `pre_count + 1` AND the newest entry is authored by `{shard.owner}`.

#### 4. Invoke the agent

Invoke the shard's assigned skill (from `role_config_map[shard.owner].skill`) with:
- The shard file as primary input
- Role config injected as context prefix:
  ```
  === CASCADE SHARD MODE ===
  Role: {shard.owner}
  Allowed paths: {allowed_paths list}
  Blocked paths: {blocked_paths list}
  Parent story: _stories/active/{story-id}/story.md
  Shard file: {shard file path}
  Phase Log: Append your completion entry to ## Phase Log in the parent story.
  ===
  ```
- Load `cascade-shard-mode.md` from the skill directory if it exists

Wait for the agent to complete. The agent writes its Phase Log entry to the parent story file directly.

#### 5. Exit worktree

Use `ExitWorktree` to exit the shard's worktree.

#### 6. Read Phase Log and assess confidence

Using the `pre_count` baseline from step 3, verify a new entry exists (count = `pre_count + 1`, newest entry authored by `{shard.owner}`). Then check the entry type:

- **Completion entry** format: `### {role} — {datetime} [confidence: N%]`
- **Blocker entry** format: `⚠ {role} — {datetime} blocked: ...`

**If blocker found:**
- Extract the escalation target role and the blocker description
- If target role IS in the pipeline → create a micro-shard (see Inter-Agent Escalation below)
- If target role is NOT in the pipeline → escalate to user:
  ```
  ⚠ Agent {role} is blocked and requires work outside the current pipeline.
  Blocker: {description}
  
  [A] Add the required role to the pipeline and continue
  [M] Handle manually and continue
  [X] Abort and move story to blocked
  ```
  HALT until user responds

**If no entry or missing confidence tag:**
- If the Phase Log has no new entry at all, or has an entry but no `[confidence: N%]` tag:
  ```
  ⚠ Agent {role} Phase Log entry is missing or has no confidence tag.
  
  [R] Retry this shard
  [D] Default to 0% confidence — immediately triggers the sub-60% review menu below
  [X] Abort
  ```
  HALT until user responds. On [D]: treat as confidence 0% and apply the `< 60%` threshold below.

**If completion entry found — apply confidence threshold:**
- Extract confidence percentage from `[confidence: N%]`
- `>= 80%` → update shard `status: complete`, `confidence: N`, continue silently
- `60–79%` → update shard `status: complete`, `confidence: N`, mark Phase Log entry with `⚠ low-confidence`, continue
- `< 60%` → pause:
  ```
  ⚠ Agent {role} completed with low confidence ({N}%).
  
  Assumptions made:
  {assumptions from Phase Log entry}
  
  [C] Continue anyway
  [R] Retry this shard
  [X] Abort
  ```
  HALT until user responds. On [C]: set shard `status: complete` and `confidence: N` with the actual value, then continue.

#### 7. Update shard status in parent story frontmatter

After completing the confidence check:
- Read parent story frontmatter
- Find the shard entry by `shard_id`
- Update `status` and `confidence`
- Write frontmatter back (preserve body)

#### 8. Loop

Return to step 1 of the dispatch loop.

---

### Inter-Agent Escalation (Micro-Shard)

When a blocker targets a role already in the pipeline:

1. Create a micro-shard file at `_stories/active/{story-id}/shards/shard-micro-{role}-{n}.md`:
   ```yaml
   ---
   shard_id: shard-micro-{role}-{n}
   parent_id: {story-id}
   owner: {target-role}
   allowed_paths: {role_config_map[target-role].allowed_paths}
   blocked_paths: {role_config_map[target-role].blocked_paths}
   status: pending
   confidence: ~
   ---
   
   # Micro-Shard: {target-role} — Escalation Response
   
   > Inter-agent escalation from {source-role}.
   > Answer the specific question below and append your Phase Log entry.
   
   ## Question
   {blocker description from source agent's Phase Log entry}
   
   ## Context
   {relevant sections from parent story body}
   
   ## Phase Log
   _Empty — append your response here._
   ```

2. Dispatch the micro-shard immediately (same EnterWorktree → invoke → ExitWorktree pattern).
3. After micro-shard completes, the original blocked shard continues (the answer is now in the Phase Log — the next agent invocation will see it in context).

---

### After All Developer Shards Complete

When all pipeline shards (excluding qa-agent and telemetry-agent) are `status: complete`:

**This is the first and only permitted output after the SILENT LOOP.** Print the following summary:

```
✓ All developer shards complete — {story-id}
──────────────────────────────────────────
{For each developer shard in dependency order:}
  {shard_id}  owner: {owner}  confidence: {N}%{  ⚠ continued silently (60–79%)}
──────────────────────────────────────────
Overall min confidence: {lowest N}%  (completed shards only; failed shards excluded)
```

Proceed to: `./step-04-merge.md`

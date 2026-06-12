# Step 03 — Shard Dispatch Loop

## Purpose

Execute developer shards in dependency order — each in its own git worktree. After all shards complete, proceed to merge.

**Implementation note:** First version dispatches shards sequentially. Parallel dispatch (using Agent background mode) is a future enhancement.

---

## Instructions

### Dispatch Loop

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

#### 3. Invoke the agent

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

#### 4. Exit worktree

Use `ExitWorktree` to exit the shard's worktree.

#### 5. Read Phase Log and assess confidence

Read the latest Phase Log entry from the parent story (the one just appended by the agent).

Check for:
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
  HALT until user responds

#### 6. Update shard status in parent story frontmatter

After completing the confidence check:
- Read parent story frontmatter
- Find the shard entry by `shard_id`
- Update `status` and `confidence`
- Write frontmatter back (preserve body)

#### 7. Loop

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

```
All developer shards complete.
Pipeline: {roles}
Confidence scores: {role: N% for each}
```

Proceed to: `./step-04-merge.md`

# Step 05 — QA Gate

## Purpose

Invoke the QA agent on the merged feature branch, parse structured results, and handle the two-strike recovery loop before proceeding to the telemetry gate.

---

## Instructions

### 1. Invoke QA Agent in Cascade Mode

Invoke `bmad-qa-generate-e2e-tests` with:
- Current branch: `feature/{story-id}`
- Argument: `--cascade _stories/active/{story-id}/story.md`
- This activates `cascade-qa-mode.md` inside the QA skill

The QA agent will:
1. Read the story's `## Acceptance Criteria`
2. Run `pnpm test` and `pnpm typecheck`
3. Check each AC for test coverage
4. Emit a structured YAML block into the Phase Log

### 2. Parse QA Result

After the QA agent appends its Phase Log entry, read the entry and parse:

```yaml
status: pass | fail
passed: N
failed: N
failures:
  - test: "<test name or AC text>"
    reason: "<failure reason>"
    responsible_shard: "<shard-id>"
    responsible_role: "<role>"
```

Look for the `status:` line in the most recent Phase Log entry under `### QA Agent`.

---

### ON PASS

If `status: pass`:

```
QA PASS — {N}/{N} tests green.
Proceeding to telemetry gate.
```

Proceed to: `./step-06-telemetry-gate.md`

---

### ON FAIL

If `status: fail`:

#### Check qa_retries count

Read `qa_retries` from parent story frontmatter.

**If `qa_retries < 2` (retry available):**

1. Increment `qa_retries` in parent story frontmatter and write it back.

2. Append QA failure summary to Phase Log:
   ```
   ### QA Recovery — {datetime} [Attempt {qa_retries}]
   Invoking Orchestrator to generate fix shards.
   Failures: {failure list from QA result}
   ```

3. Invoke Orchestrator (programmatic mode) with:
   ```
   Role: Orchestrator (fix shard generation)
   QA failures:
   {failures list from QA result — including responsible_shard and responsible_role}
   
   Merged branch: feature/{story-id}
   Parent story: {full story body}
   
   Required output (YAML only):
   fix_shards:
     - role: {responsible_role}
       shard_id: shard-fix-{role}-{qa_retries}
       tasks: ["description of what to fix"]
       target_files: ["file paths involved in failures"]
   ```

4. For each fix shard declared by Orchestrator:
   - Write fix shard file to `_stories/active/{story-id}/shards/shard-fix-{role}-{qa_retries}.md`
   - Add to parent story frontmatter `shards` list with `status: pending`, `depends_on: []`

5. Dispatch fix shards via the dispatch loop pattern from `step-03-dispatch.md`:
   - `EnterWorktree` on `shard/{story-id}-shard-fix-{role}-{qa_retries}`
   - Invoke agent with fix shard + cascade shard mode
   - `ExitWorktree`
   - Merge fix shard into `feature/{story-id}` (step-04-merge.md pattern)

6. Re-enter `step-05-qa-gate.md` (re-invoke QA on updated feature branch).

---

**If `qa_retries >= 2` (max retries reached — user escalation):**

1. Update parent story frontmatter: `status: blocked`
2. Move story file from `_stories/active/{story-id}/story.md` to `_stories/blocked/{story-id}.md`

3. Surface to user:
   ```
   ⚠ CASCADE BLOCKED — GDS-{NNN}: {story title}
   
   QA failed after 2 recovery attempts.
   
   ── Phase Log ──────────────────────────────────────────
   {full Phase Log content}
   ───────────────────────────────────────────────────────
   
   ── QA Failure Reports ─────────────────────────────────
   {all QA failure entries from Phase Log}
   ───────────────────────────────────────────────────────
   
   What is blocking this story? Describe the root cause and how it should be fixed.
   (Your answer will be used to generate a targeted fix shard.)
   ```
   HALT — wait for user answer.

4. On user answer:
   - Generate a fix shard using the user's answer as the constraint
   - Move story back to `_stories/active/{story-id}/story.md`, update `status: active`
   - Reset `qa_retries: 0` in frontmatter
   - Dispatch the fix shard
   - Re-merge
   - Re-enter `step-05-qa-gate.md`

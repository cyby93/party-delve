# Deferred Work

Items surfaced during reviews that are real findings but pre-exist the triggering change or are out of scope for the current story. Each entry records the source story, the finding, and why it was deferred.

---

## From INFRA-001 — cascade auto-advance (2026-06-13)

**D1 — All-failed terminal state not handled in dispatch loop**
The loop exits when all shards are `status: complete OR failed`, but the "After All Developer Shards Complete" block only handles the all-complete case. A mixed or all-failed outcome routes to `step-04-merge.md` with no meaningful content. Pre-existing gap in the loop termination condition.

**D2 — EnterWorktree failure leaves shard in `pending`, loop may spin**
If `EnterWorktree` fails, the shard is never updated out of `pending`. On the next iteration the same shard is selected again, creating an infinite dispatch attempt. No error branch after step 2. Pre-existing.

**D3 — Retry ([R]) produces duplicate Phase Log entries**
When a user retries a shard, the agent appends a second Phase Log entry for the same role. "Latest entry" heuristic is sufficient in the happy path but accumulates noise across multiple retries. Needs Phase Log entry anchoring or shard-scoped markers. Pre-existing Phase Log design issue.

**D4 — Micro-shard confidence not included in final summary**
Micro-shards are created dynamically and are not in the original pipeline order list. The summary is undefined for them — include, exclude, or fold into parent shard's confidence? Needs a micro-shard tracking strategy.

**D5 — ExitWorktree failure after agent completion causes re-dispatch**
If `ExitWorktree` fails, the worktree stays open. The shard's status hasn't been written yet (step 7 runs after step 5). Next loop iteration selects the same shard and attempts `EnterWorktree` on an already-open branch. Pre-existing.

**D6 — No timeout or max-retry count on HALT responses**
If a session is closed mid-HALT and resumed, the workflow manager has no persisted "paused at HALT" state in the story file. It re-enters the loop and potentially re-dispatches completed shards. Needs a `dispatch_state: paused` field in story frontmatter or similar.

**D7 — Confidence tag format tolerance**
The `[confidence: N%]` tag is matched literally. Minor format variations (`[Confidence: 85%]`, `[confidence: 85 %]`) cause a false missing-tag HALT. A normalization step or regex tolerance note would prevent unnecessary interruptions. Pre-existing.

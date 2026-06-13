---
title: 'INFRA-001 — Cascade shard dispatch auto-advance'
type: 'bugfix'
created: '2026-06-13'
status: 'done'
baseline_commit: 'a81ff1fac2c6b931b4235703245dfd1d65e786e1'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After each shard completes, the workflow manager produces a user-facing message and ends its turn instead of immediately dispatching the next shard. This forces the user to manually prompt ("Okey, next?") between every shard, breaking the single-confirmation cascade model described in `workflow.md` and `step-01-scan.md`.

**Approach:** Add an upfront dispatch plan printout before the loop starts, then enforce a silent autonomous mode for the loop body — no user-facing output between shard completions unless a HALT condition (blocker, deadlock, low-confidence) triggers.

## Boundaries & Constraints

**Always:**
- Existing HALT conditions (deadlock, agent blocker, confidence < 60%) remain; only the happy-path silence changes.
- The dispatch plan printed before the loop starts must list shard IDs, owners, and dependency order so the user knows what will run.
- Shard status and confidence updates to the story file continue after every shard (unchanged behaviour).

**Ask First:**
- If the Phase Log entry format written by a shard agent is missing or malformed (no `[confidence: N%]` tag found), HALT and ask the user whether to retry or continue with a default confidence of 0%.

**Never:**
- Do not remove the HALT conditions for blockers, deadlocks, or sub-60% confidence.
- Do not change step-01, step-02, step-04, step-05, step-06, or step-07.
- Do not change shard file formats or Phase Log format.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Happy path — all shards ≥ 80% | N shards, all complete with ≥ 80% confidence | Dispatch plan printed once; loop runs silently; final summary printed after all complete | N/A |
| Low-confidence shard (60–79%) | Shard returns 70% confidence | Mark Phase Log `⚠ low-confidence`, continue silently | No HALT |
| Sub-60% confidence | Shard returns 55% confidence | HALT immediately, present options [C] [R] [X] | Wait for user |
| Agent blocker | Shard writes blocker entry to Phase Log | HALT or create micro-shard per existing spec | Per existing logic |
| Dependency deadlock | Pending shards remain but none are ready | HALT with deadlock summary | Wait for user |
| Missing confidence tag | Phase Log entry has no `[confidence: N%]` | HALT and ask: retry or default to 0%? | Wait for user |

</frozen-after-approval>

## Code Map

- `.claude/skills/workflow-manager/steps/step-03-dispatch.md` — the dispatch loop; only file that changes

## Tasks & Acceptance

**Execution:**
- [x] `.claude/skills/workflow-manager/steps/step-03-dispatch.md` — add dispatch plan block before the loop and a SILENT LOOP section header with explicit "no user output between iterations" rule; add final summary block after the loop; add missing-confidence-tag edge case to Phase Log assessment.

**Acceptance Criteria:**
- Given a story with 3 shards in the pipeline, when the cascade runs in the happy path (all ≥ 80% confidence), then the workflow manager dispatches all 3 shards sequentially without pausing for user input between them.
- Given a shard that returns sub-60% confidence, when the Phase Log is assessed, then the workflow manager HALTs and presents [C] [R] [X] before dispatching the next shard.
- Given a shard whose Phase Log entry contains no `[confidence: N%]` tag, when the workflow manager reads it, then it HALTs and asks whether to retry or default to 0%.
- Given the loop starts, when the dispatch plan is printed, then it lists each shard by ID, owner, and dependency order before any shard is dispatched.

## Design Notes

The key invariant: the dispatch loop is a **single LLM turn** (from user confirmation in step-01 through to the final summary). No user-facing text output between shard completions — only file I/O (story file updates, Phase Log appends). This prevents Claude from ending its turn mid-loop.

The dispatch plan serves as the "commit point" — once printed the user knows what will happen, and the loop executes without further check-ins. Add the plan immediately after the loop header, before iteration 1.

Confidence missing-tag edge case: currently not handled. If a shard agent omits the `[confidence: N%]` tag (e.g. bug in the agent skill or worktree context loss), the manager has no data and must HALT rather than silently assume 100%.

## Verification

**Manual checks:**
- Read the updated `step-03-dispatch.md` and confirm: (1) a dispatch plan block appears before the loop, (2) a SILENT LOOP rule block appears at the top of the loop, (3) a final summary block appears after all shards complete, (4) the missing-confidence-tag case is listed under Phase Log assessment.

## Spec Change Log

### Review patch-pass — 2026-06-13

7 patch findings applied to `step-03-dispatch.md` post-review (no loopback required):
- Dispatch Plan preamble now explicitly lists HALT carve-out and excludes qa-agent/telemetry-agent from the plan list.
- Added step 3 "Record Phase Log baseline" (`pre_count`) before agent invocation so "no new entry" detection is unambiguous.
- Renumbered original steps 4–7 to 5–8 accordingly.
- `[D]` option label clarified to make the immediate sub-60% HALT explicit.
- `[C]` after sub-60% now explicitly sets `status: complete` with actual confidence.
- Final summary uses "dependency order" consistently (was "pipeline order").
- Summary min confidence excludes failed shards (`~` values) from calculation; 60–79% annotation changed to "continued silently."

7 defer findings recorded in `deferred-work.md` (D1–D7). 1 finding rejected (unenforceable LLM turn instruction is standard skill design).

## Suggested Review Order

**Autonomous loop control — the core behavioral change**

- Entry point: Dispatch Plan block establishes user scope and explicit HALT carve-out in one place
  [`step-03-dispatch.md:13`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L13)

- SILENT LOOP invariant — prohibits turn-ending between iterations; enumerates all permitted exceptions
  [`step-03-dispatch.md:30`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L30)

**Phase Log detection — reliable "new entry" check**

- Step 3: records `pre_count` before agent invocation so there is a baseline to compare against
  [`step-03-dispatch.md:62`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L62)

- Step 6: uses `pre_count` + author check to validate new entry before assessing confidence
  [`step-03-dispatch.md:91`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L91)

**Error handling — HALT paths and post-HALT behavior**

- Missing confidence tag: new [R]/[D]/[X] HALT with explicit wiring of [D] → sub-60% path
  [`step-03-dispatch.md:110`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L110)

- [C] continue on sub-60%: now explicitly sets `status: complete` + actual confidence value
  [`step-03-dispatch.md:136`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L136)

**Final summary — post-loop output**

- Only permitted output after SILENT LOOP; dependency order; null confidence excluded from min
  [`step-03-dispatch.md:188`](../../.claude/skills/workflow-manager/steps/step-03-dispatch.md#L188)

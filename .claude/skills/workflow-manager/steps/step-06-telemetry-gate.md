# Step 06 — Telemetry Gate

## Purpose

Invoke the telemetry agent to instrument events declared in the story's `## Telemetry` section. Only ever runs after a QA pass.

---

## GUARD

**Before doing anything else, verify QA passed:**

Read the `## Phase Log` section of `_stories/active/{story-id}/story.md`. Find the most recent `### QA Agent` entry. Check that it contains `PASS` (not `FAIL`).

If the most recent QA entry is `FAIL` or no QA entry exists → this step was reached incorrectly. Do NOT proceed.
Route back to: `./step-05-qa-gate.md`

---

## Instructions

### 1. Check Telemetry Requirements

Read the story's `## Telemetry` section.

If it reads exactly `No new telemetry events required.`:
- Append to Phase Log:
  ```
  ### Telemetry Gate — {datetime}
  No new telemetry events required. Gate passed (skipped).
  ```
- Proceed directly to: `./step-07-wrap-up.md`

### 2. Invoke Telemetry Agent

Invoke the `telemetry-agent` skill with:
- Argument: `--cascade _stories/active/{story-id}/story.md`
- Current branch: `feature/{story-id}`

The telemetry agent will:
1. Read the story's `## Telemetry` section
2. Check/update/create event types in `packages/telemetry/src/`
3. Run `pnpm typecheck --filter packages/telemetry`
4. Append a Phase Log entry with confidence score

### 3. Parse Telemetry Agent Result

Read the most recent Phase Log entry from `### Telemetry Agent`. Check:
- Events instrumented: {list}
- Confidence: {N%}

If confidence `< 60%`:
```
⚠ Telemetry agent completed with low confidence ({N}%).

Assumptions:
{assumptions from Phase Log}

[C] Continue anyway
[R] Retry telemetry instrumentation
```
HALT until user responds.

### 4. Route

Proceed to: `./step-07-wrap-up.md`

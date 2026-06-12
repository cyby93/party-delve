# Step 02 — Phase Log Entry

## Purpose

Self-assess confidence, build the Phase Log entry, and append it to the parent story file.

---

## Instructions

### 1. Self-Assess Confidence

Score honestly using these criteria:

| Score | Condition |
|---|---|
| 90–100% | All events instrumented exactly as declared, typecheck passes, no ambiguities, no `unknown` fields |
| 80–89% | All events instrumented, minor payload field type assumptions made |
| 70–79% | All events instrumented, one or more fields typed as `unknown`, or one event name was normalised |
| 60–69% | Some events instrumented, significant ambiguity, or typecheck required workarounds |
| < 60% | Key events could not be instrumented, typecheck did not pass cleanly, or shard was unclear |

**Deduct 10% per `unknown` type field (multiple fields compound).**
**Deduct 15% per event name that was ambiguous and required significant inference.**

### 2. Build Phase Log Entry

```
### Telemetry Agent — {ISO datetime} [confidence: {N}%]
Events instrumented: {comma-separated event names, or "none"}
Events already existed (skipped): {comma-separated names, or "none"}
Events updated (schema change): {comma-separated names, or "none"}
Assumptions: {comma-separated list, or "none"}
```

If any events were not mapped to KPIs, append after Assumptions:
```
KPI mapping gaps: {event names} — update docs/specs/telemetry-spec.md required.
```

### 3. Append to Parent Story Phase Log

1. Read the entire parent story file at `{parent_story_path}`
2. Locate `## Phase Log`
3. If the section contains `_Empty — story not yet started._` → replace that line with the entry
4. Otherwise → append the entry below the last existing entry, separated by a blank line
5. Write the complete file back — preserve all other sections exactly

Done. The telemetry gate is complete.

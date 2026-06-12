# Helper: Phase Log Write Protocol

## Purpose

Define the standard formats for Phase Log entries and the append-only write procedure. All agents and steps in the cascade must follow these formats.

---

## Entry Formats

### Agent Completion Entry
```
### {Role Name} — {ISO datetime} [confidence: N%]
{2–4 sentences summarising what was implemented}
Assumptions: {comma-separated list, or "none"}
```

Example:
```
### Simulation Engineer — 2026-06-15T14:22:00Z [confidence: 87%]
Implemented tick-based movement system in apps/simulation-server/src/systems/movement.ts.
Added direction normalisation and max-speed clamping. Movement state exposed via SimulationState.
Assumptions: diagonal speed matches cardinal speed (no normalisation penalty applied)
```

---

### Agent Blocker Entry
```
⚠ {Role Name} — {ISO datetime} blocked: {description}. Escalating to {target-role}.
```

Example:
```
⚠ Simulation Engineer — 2026-06-15T14:35:00Z blocked: MoveInputEvent schema not yet defined in packages/shared-types. Escalating to protocol-architect.
```

---

### QA Pass Entry
```
### QA Agent — {ISO datetime}
PASS. {N}/{N} tests green.
```

---

### QA Fail Entry
```
### QA Agent — {ISO datetime}
FAIL — {N}/{M} tests failed.
Failing: {comma-separated test names or AC descriptions}
Responsible shard: {shard-id} ({role})
```

---

### QA Recovery Entry
```
### QA Recovery — {ISO datetime} [Attempt {N}]
Invoking Orchestrator to generate fix shards.
Failures: {failure descriptions}
```

---

### Telemetry Agent Entry
```
### Telemetry Agent — {ISO datetime} [confidence: N%]
Events instrumented: {comma-separated event names}
Events already existed (skipped): {list or "none"}
Events updated (schema change): {list or "none"}
Assumptions: {list or "none"}
```

---

### Workflow Manager System Entries
```
### Workflow Manager — {datetime} [Decompose]
Pipeline declared: {pipeline list}
Skipped roles: {skip list, or "none"}
Shards created: {N}

### Workflow Manager — {datetime} [Merge]
Merged shards: {list}
Conflicts: {none | file list with resolution}

### Workflow Manager — {datetime} [Complete]
PR: {url}
Status: done
```

---

## Append-Only Write Procedure

**All agents and steps MUST follow this procedure when writing to the Phase Log:**

1. Read the entire parent story file (`_stories/active/{story-id}/story.md` or `_stories/done/{story-id}.md`)
2. Locate the `## Phase Log` section
3. Find the last existing entry in the section
4. If the section contains only `_Empty — story not yet started._` → replace that placeholder line with the new entry
5. Otherwise → append the new entry **below** the last existing entry, separated by a blank line
6. Write the complete file back

**Never:**
- Overwrite or reorder existing Phase Log entries
- Delete any Phase Log content
- Append anywhere except at the bottom of the `## Phase Log` section
- Modify other sections while writing the Phase Log

**The Phase Log is the audit trail of the cascade. Its integrity is critical for QA recovery and debugging.**

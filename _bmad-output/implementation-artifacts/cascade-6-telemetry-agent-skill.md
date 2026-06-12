# Story CASCADE-6: Telemetry Agent Skill (New)

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — New Skill
Context: The Workflow Manager (CASCADE-2 step-06-telemetry-gate.md) invokes a
  telemetry-agent skill after QA passes. No such skill exists. This story builds it
  from scratch. The agent instruments events defined in a story's ## Telemetry section
  into packages/telemetry, verifies KPI mappings, and appends a Phase Log entry to
  the parent story. It only ever runs on QA-verified code.
Owner agent: QA + Telemetry Engineer (owns packages/telemetry/**, tools/**)
Goal: Build .claude/skills/telemetry-agent/ — a new skill that (1) reads the story's
  ## Telemetry section, (2) instruments each required event in packages/telemetry/,
  (3) verifies existing telemetry events are not broken, (4) appends a structured
  Phase Log entry with confidence score to the parent story.
Allowed paths:
  - .claude/skills/telemetry-agent/**
  - packages/telemetry/**
Blocked paths:
  - apps/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
  - packages/ui-kit/**
  - docs/specs/** (read-only)
Inputs:
  - docs/specs/telemetry-spec.md — event schema and KPI mapping rules (REQUIRED)
  - docs/specs/autonomous-cascade-story-format.md § Telemetry section format (REQUIRED)
  - docs/specs/workflow-manager-spec.md § Telemetry Gate (REQUIRED)
  - packages/telemetry/src/ — existing telemetry implementation (read before writing)
Non-goals:
  - Changing story acceptance criteria based on telemetry gaps
  - Adding telemetry to apps/ directly (events are defined in packages/telemetry, apps call track())
  - Running or testing the full application
  - Retroactive telemetry for previous stories
  - Dashboard or sink configuration (fire-and-forget events only)
Acceptance criteria: see AC section below
Required hooks: none (packages/telemetry is QA + Telemetry Engineer's owned path)
Required tests:
  - Unit test: new event type is exported from packages/telemetry
  - Unit test: event payload matches story's declared schema
Telemetry impact: this story DEFINES telemetry — it is the telemetry impact
```

---

## Story

As the Workflow Manager's telemetry gate step,
I want to invoke the `telemetry-agent` skill with a parent story path and have it
instrument all events declared in the story's `## Telemetry` section into
`packages/telemetry`, so that every shipped feature has its events properly instrumented
and verified before the PR is opened.

---

## Acceptance Criteria

1. The skill reads the parent story's `## Telemetry` section and extracts each event declaration (event name, trigger, payload fields).
2. For each declared event, the skill checks if it already exists in `packages/telemetry/src/`. If it exists and matches the declared payload → skip. If it exists but mismatches → update. If it doesn't exist → create.
3. New events are added as typed exports in `packages/telemetry/src/events.ts` (or equivalent existing event registry file) following the existing pattern in that file.
4. Each new event type has a TypeScript interface or type alias with fields matching the story's declared payload. Field types are inferred from field names (e.g. `player_id: string`, `timestamp: number`, `damage: number`).
5. The skill runs `pnpm typecheck` on `packages/telemetry` after making changes. If typecheck fails, it fixes the errors before completing.
6. The skill verifies existing telemetry events are not broken: runs `pnpm test --filter packages/telemetry` if tests exist.
7. On completion, appends a Phase Log entry to the parent story:
   ```
   ### Telemetry Agent — <datetime> [confidence: N%]
   Events instrumented: <comma-separated event names>
   Events already existed (skipped): <list or "none">
   Events updated (schema change): <list or "none">
   Assumptions: <list or "none">
   ```

---

## Tasks / Subtasks

- [x] **T1 — Scaffold skill directory** (AC: all)
  - [x] Create `.claude/skills/telemetry-agent/` directory
  - [x] Create `workflow.md` as the skill entry point
  - [x] Create `steps/` subdirectory

- [x] **T2 — Write `workflow.md`** (AC: 1)
  - [x] Define skill name: `telemetry-agent`
  - [x] Define description: "QA-gated telemetry instrumentation agent. Instruments events declared in a story's Telemetry section into packages/telemetry."
  - [x] Define activation: this skill is invoked by the Workflow Manager with `--cascade <parent-story-path>`
  - [x] Load config from `_bmad/core/config.yaml`
  - [x] Load `docs/specs/telemetry-spec.md` as context
  - [x] Read parent story's `## Telemetry` section
  - [x] Route to `./steps/step-01-instrument.md`

- [x] **T3 — Write `steps/step-01-instrument.md`** (AC: 2–6)
  - [ ] Read existing `packages/telemetry/src/` — understand current event registry structure
  - [ ] Read `docs/specs/telemetry-spec.md` — understand event schema conventions
  - [ ] For each event in the story's `## Telemetry` section:
    - [ ] Parse event name, trigger, payload fields from the declaration format:
      ```
      - event: `combat.hit`
        trigger: player lands a hit
        payload: { player_id, target_id, damage, ability_id }
      ```
    - [ ] Check if event exists in `packages/telemetry/src/events.ts` (or equivalent)
    - [ ] If exists and payload matches → log "skipped (already instrumented)", continue
    - [ ] If exists but payload differs → update the type definition, log "updated"
    - [ ] If not exists → add new typed export following existing file patterns
  - [ ] Write changes to `packages/telemetry/src/`
  - [ ] Run `pnpm typecheck --filter packages/telemetry` — fix any errors
  - [ ] Run `pnpm test --filter packages/telemetry` if tests exist — fix any failures
  - [ ] Route to `./steps/step-02-phase-log.md`

- [x] **T4 — Write `steps/step-02-phase-log.md`** (AC: 7)
  - [ ] Self-assess confidence:
    - 90–100%: all events instrumented exactly as declared, no ambiguities
    - 70–89%: minor payload field type assumptions made
    - 60–69%: one or more event names were ambiguous, used best judgement
    - Below 60%: significant gaps or typecheck couldn't be made to pass
  - [ ] Build Phase Log entry (structured format per AC 7)
  - [ ] Append to `## Phase Log` in parent story file (append-only, same protocol as CASCADE-4)
  - [ ] Update parent story shard metadata if applicable

---

## Dev Notes

### Existing Telemetry Package Structure

Before writing anything, read `packages/telemetry/src/` completely to understand:
- How events are currently defined (type aliases? interfaces? enum keys?)
- How `track()` is called from apps
- Whether there is a central event registry or per-feature event files
- Current naming convention for event names (`session.host_started` style, `camelCase`, etc.)

From the Phase 1 telemetry work: session funnel events (`session.host_started`, `session.player_joined`, `session.player_left`, `session.ended`) were instrumented. Use these as the canonical style reference.

[Source: project-brief.md § Telemetry — Phase 1 entry]

### Payload Field Type Inference

When the story declares `payload: { player_id, target_id, damage, ability_id }` without explicit types, infer as follows:

| Field name pattern | Inferred type |
|---|---|
| `*_id`, `id` | `string` |
| `timestamp`, `*_at` | `number` |
| `damage`, `heal`, `amount`, `count`, `hp`, `*_count`, `*_ms` | `number` |
| `position`, `direction` | `{ x: number; y: number }` |
| `mode`, `state`, `phase`, `status` | `string` |
| `*_enabled`, `is_*` | `boolean` |
| anything else | `unknown` (flag in Phase Log) |

### Event Name Convention

Follow the existing convention from the Phase 1 telemetry events: `domain.action` format in snake_case. Examples: `session.player_joined`, `combat.hit`, `input.move`. If the story uses a different format, normalise to this convention and note the normalisation in the Phase Log.

### Telemetry Spec Reference

`docs/specs/telemetry-spec.md` defines KPI mappings — which events map to which KPIs (funnel drop-off, latency, engagement). After instrumenting events, verify each new event is referenced in the telemetry spec's KPI section. If it isn't, append a note in the Phase Log: "Event `X` not yet mapped to a KPI — update telemetry-spec.md required." Do NOT modify telemetry-spec.md yourself (that is Protocol Architect's owned path via docs/specs/**).

### No Direct calls to track() in apps/

The telemetry-agent only defines event types in `packages/telemetry/`. The actual `track()` calls in apps (e.g. `InRunController.tsx`) are added by the developer agent (gds-agent-game-dev) as part of the story's tasks. The telemetry-agent's job is to ensure the event types exist and are correct — not to add track() calls.

### Quality Gate — Confidence Score

If `pnpm typecheck` passes and all declared events are instrumented: minimum confidence 85%. If any payload fields were ambiguous (type `unknown`): deduct 10% per field. If any events were skipped due to naming ambiguity: deduct 15%.

### References

- [Source: docs/specs/telemetry-spec.md — event schema and KPI mapping]
- [Source: docs/specs/workflow-manager-spec.md § Telemetry Gate]
- [Source: docs/specs/autonomous-cascade-story-format.md § Story Body — Telemetry section]
- [Source: packages/telemetry/src/ — existing implementation (read before writing)]
- [Source: project-brief.md § Telemetry — Phase 1 baseline events]

### Project Structure Notes

```
.claude/skills/telemetry-agent/    ← CREATE (new skill directory)
  workflow.md                      ← CREATE (T2)
  steps/
    step-01-instrument.md          ← CREATE (T3)
    step-02-phase-log.md           ← CREATE (T4)

packages/telemetry/src/
  events.ts (or equivalent)        ← EXTEND at runtime (new event types added per story)
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 3 skill files written: workflow.md + step-01-instrument.md + step-02-phase-log.md — all pure markdown.
- step-01-instrument.md includes full payload type inference table, KPI mapping gap detection, and normalises event names to `domain.action` snake_case.
- Existing registry file pattern preserved (does not impose a style — reads existing code first).
- `No new telemetry events required.` short-circuit: exits step-01 immediately without touching packages/telemetry.
- KPI mapping gaps noted in Phase Log but telemetry-spec.md not modified (read-only for this agent).

### File List

- `.claude/skills/telemetry-agent/workflow.md` — CREATED
- `.claude/skills/telemetry-agent/steps/step-01-instrument.md` — CREATED
- `.claude/skills/telemetry-agent/steps/step-02-phase-log.md` — CREATED

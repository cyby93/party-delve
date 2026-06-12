# Workflow Manager Specification

## Purpose

The Workflow Manager is the autonomous execution engine of the cascade system. It is the only persistent actor in the pipeline — all specialist agents (Protocol Architect, dev agents, QA, Telemetry) are stateless and invoked on demand.

The Workflow Manager is implemented as `bmad-agent-pm` running in programmatic mode: it reads from story files instead of human input, writes structured YAML and Phase Log entries instead of prose, and runs as a scan-and-dispatch loop instead of a single conversation.

**It owns two commands:**
- `/run` — execute stories from the backlog
- `/run list` — inspect backlog and active stories

---

## Responsibilities

- Pre-flight dependency analysis across the backlog
- Story decomposition via `bmad-shard-doc`
- CLAUDE.md ownership parsing → role config generation
- Shard dispatch with dependency-aware parallelism
- Worktree lifecycle management (EnterWorktree / ExitWorktree)
- Phase Log writes on every state transition
- Worktree merge on shard completion
- QA gate invocation and result parsing
- QA recovery loop (two-strike protocol)
- Telemetry gate invocation
- PR creation and project-brief auto-update
- Escalation to user when autonomy ceiling is reached

---

## Entry Points

### `/run`

Starts the highest-priority `status: ready` story in `_stories/backlog/`.

**Flow:**
1. Scan backlog
2. Run pre-flight on all ready stories
3. Surface dependency map + proposed execution order to user
4. User confirms → begin cascade on top-priority story
5. User overrides order → respect override, begin cascade

### `/run <story-id>`

Starts a specific story regardless of priority order.

**Flow:** same as `/run` but skips priority selection — pre-flight still runs.

### `/run list`

Read-only. Displays all stories across all status states.

**Output format:**
```
BACKLOG
  [high]  GDS-002  Add player movement input binding      (ready)
  [med]   GDS-003  Add combat system                      (ready)
  [low]   GDS-004  Add host HUD health display            (ready — blocked by GDS-003)

ACTIVE
  GDS-001  Add session join flow                           (active)
    ✓ shard-schema   protocol-architect    complete  [94%]
    ⟳ shard-sim      simulation-engineer   active
    ◌ shard-host     host-engineer         pending

DONE
  GDS-000  Scaffold monorepo structure                     (done — PR #12)
```

---

## Pre-Flight Check

Runs automatically before any story is started. Never skipped.

### What it checks

1. **Cross-story file overlap** — do any two ready stories modify the same files? If yes, flag as dependency candidate.
2. **Contract dependency** — does any story add or modify `packages/shared-types/**` or `packages/net-protocol/**` that another story reads? If yes, flag as hard dependency.
3. **In-progress conflicts** — does a ready story overlap with any currently active story's `allowed_paths`? If yes, block until active story completes.

### Output

Workflow Manager surfaces a dependency map with proposed resolution:

```
Pre-flight results for 3 ready stories:

  GDS-003 (combat system) modifies packages/shared-types/**
  GDS-004 (host HUD) reads packages/shared-types/**
  → Suggested: GDS-004 depends on GDS-003

  No conflicts with active stories.

Proposed execution order:
  1. GDS-002 (movement input)  — no dependencies
  2. GDS-003 (combat system)   — no dependencies
  3. GDS-004 (host HUD)        — after GDS-003

Confirm? [Y] Accept  [E] Edit order  [S] Start anyway
```

User confirmation is the **only required human touchpoint in `/run`**.

---

## CLAUDE.md Ownership Parsing

Before any story is decomposed, the Workflow Manager reads the `## Ownership Rules` section of CLAUDE.md and builds a role config map:

```
Role: simulation-engineer
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/simulation-server/**
    - packages/game-rules/**

Role: host-engineer
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/host-client/**

Role: mobile-engineer
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/mobile-controller/**

Role: protocol-architect
  skill: bmad-agent-architect
  allowed_paths:
    - packages/shared-types/**
    - packages/net-protocol/**
    - docs/adr/**
    - docs/specs/**

Role: qa-agent
  skill: bmad-qa-generate-e2e-tests
  allowed_paths:
    - tests/**
    - tools/**

Role: telemetry-agent
  skill: telemetry-agent
  allowed_paths:
    - packages/telemetry/**
```

This map is rebuilt from CLAUDE.md on every `/run` invocation — it is never cached. Changes to CLAUDE.md ownership rules take effect immediately.

---

## Decomposition

After pre-flight and user confirmation, the Workflow Manager decomposes the story into shards.

### Step 1 — Orchestrator evaluation

Invoke `bmad-agent-pm` (orchestrator mode) with:
- The full amplified story body
- The role config map from CLAUDE.md
- The `project-brief.md` relevant sections

Orchestrator returns:
```yaml
pipeline:
  - protocol-architect
  - simulation-engineer
  - host-engineer
pipeline_reason: "combat touches server tick and host HUD only"
skip:
  - mobile-engineer
skip_reason: "no mobile input changes required"
```

If Orchestrator declares `action: none` for itself, it still returns the pipeline — it just does no file writes.

### Step 2 — Story decomposition via bmad-shard-doc

Invoke `bmad-shard-doc` with:
- The amplified story body
- The pipeline from Orchestrator
- The role config map (each role's `allowed_paths` defines shard scope)

`bmad-shard-doc` returns N focused child shard files, one per pipeline role. Each shard contains:
- Full story context
- Role-specific tasks only (filtered by `allowed_paths`)
- Inherited acceptance criteria relevant to that role
- Inherited telemetry requirements

### Step 3 — Dependency graph declaration

Workflow Manager declares `depends_on` edges between shards:

**Rule:** `protocol-architect` shard has no dependencies. All developer shards depend on `protocol-architect` shard. QA depends on all developer shards. Telemetry depends on QA.

**Exception:** if Orchestrator declares `action: none` for `protocol-architect`, developer shards have no dependencies and may launch immediately.

### Step 4 — Write shard files and update story frontmatter

Shard files written to `_stories/active/<story-id>/shards/`.
Parent story frontmatter updated with `pipeline`, `shards`, `status: active`.

---

## Shard Execution

### Readiness check

Before each dispatch cycle, Workflow Manager checks every `status: pending` shard:
- All shards in `depends_on` list must be `status: complete`
- If yes → shard is ready, dispatch immediately
- If no → shard remains pending

Multiple shards may become ready simultaneously → dispatch in parallel.

### Dispatching a shard

1. Call `EnterWorktree` → creates branch `shard/<story-id>-<shard-id>`
2. Inject role config into agent invocation:
   ```
   skill: gds-agent-game-dev
   role: simulation-engineer
   allowed_paths: [apps/simulation-server/**, packages/game-rules/**]
   blocked_paths: [everything else]
   context: shard file + relevant project-brief sections
   ```
3. Agent executes
4. Agent writes Phase Log entry to parent story with confidence score + assumptions
5. Agent calls `ExitWorktree`
6. Workflow Manager updates shard `status: complete`, `confidence: <value>`

### Confidence threshold handling

After each shard completes, Workflow Manager checks confidence:

| Score | Action |
|---|---|
| `>= 80%` | Continue silently |
| `60–79%` | Continue, mark Phase Log entry as `⚠ low confidence` |
| `< 60%` | Pause cascade, surface shard's assumption list to user with: "Agent confidence low. Review assumptions and confirm to continue." |

Threshold values are configurable. Defaults above.

### Inter-agent escalation

If a shard agent identifies a blocker resolvable within its dependency chain (e.g. schema ambiguity → Protocol Architect can resolve), it:
1. Appends blocker to Phase Log: `⚠ blocked: [description]. Escalating to protocol-architect.`
2. Workflow Manager creates a micro-shard targeting the blocking agent with the specific question
3. Micro-shard resolves → original shard resumes
4. No user involvement

If the blocker requires new surface area (new view, new contract not in current pipeline, change affecting multiple agents), Workflow Manager escalates to user.

---

## Merge

When all developer shards in the pipeline are `status: complete`:

1. Workflow Manager identifies merge order (respects `depends_on` edges — merge leaves first)
2. For each merge: `git merge shard/<story-id>-<shard-id>` into `feature/<story-id>`
3. If merge conflict is auto-resolvable (non-overlapping files) → resolve and continue
4. If merge conflict requires judgment → escalate to user with diff context

---

## QA Gate

After successful merge:

1. Invoke `bmad-qa-generate-e2e-tests` (adapted) with:
   - Merged `feature/<story-id>` branch
   - Story acceptance criteria
   - Story's contract change declarations (from Protocol Architect shard)

2. QA agent runs tests and returns structured result:
   ```yaml
   status: fail
   passed: 10
   failed: 2
   failures:
     - test: CombatHitEvent contract
       reason: missing required field `ability_id`
       responsible_shard: shard-sim
       responsible_role: simulation-engineer
   ```

3. Workflow Manager reads `status` field:
   - `pass` → proceed to Telemetry Gate
   - `fail` → invoke QA Recovery Protocol

### QA Recovery Protocol

```
qa_retries < 2:
  1. Increment story qa_retries
  2. Invoke Orchestrator with: merged branch + QA failure report
  3. Orchestrator generates targeted fix shard(s) for responsible role(s)
  4. Fix shard(s) execute in new worktrees (same pattern as original shards)
  5. Re-merge → re-run QA gate

qa_retries >= 2:
  1. Set story status: blocked
  2. Move story file to _stories/blocked/
  3. Surface to user:
     - Full Phase Log
     - All QA failure reports across retries
     - Single focused question: "QA has failed twice on [description].
       How should the agent resolve [specific ambiguity]?"
  4. User answers → Workflow Manager generates fix shard with user answer as constraint
  5. Reset qa_retries to 0, resume cascade
```

---

## Telemetry Gate

Runs only after QA `status: pass`. Never runs on unverified code.

1. Invoke `telemetry-agent` with:
   - Merged `feature/<story-id>` branch
   - Story's `## Telemetry` section (event names, triggers, payloads)

2. Telemetry agent instruments events, verifies KPI mappings, appends Phase Log entry.

3. On completion → proceed to Wrap-Up.

---

## Wrap-Up

1. **Merge to main feature branch:** `git merge feature/<story-id>` into current sprint branch
2. **Open PR:** one clean PR covering the full story (all shards, all fixes)
   - PR title: story title
   - PR body: Phase Log summary + acceptance criteria checklist
3. **Update project-brief.md:** append 2–3 sentence domain summary to relevant section(s)
4. **Move story file:** `_stories/active/` → `_stories/done/`
5. **Update story status:** `done`
6. **Surface to user:** PR link only. No other noise.

### project-brief.md Domain Mapping

| Pipeline roles used | Brief section updated |
|---|---|
| `simulation-engineer` | `## Game Rules / Simulation` |
| `host-engineer` | `## Host Client / Rendering` |
| `mobile-engineer` | `## Mobile Controller` |
| `protocol-architect` | `## Contracts / Event Protocol` |
| Any combination | All relevant sections updated |

---

## Escalation Summary

The Workflow Manager escalates to the user in exactly these scenarios:

| Trigger | What is surfaced |
|---|---|
| Pre-flight dependency conflict | Dependency map + proposed order (normal flow, not an error) |
| Shard confidence < 60% | Assumption list + confirmation request |
| Cross-agent blocker requiring new surface area | Blocker description + focused question |
| Merge conflict requiring judgment | Conflicting diff + resolution options |
| QA failure × 2 | Full Phase Log + all QA reports + single focused question |

No other scenarios trigger user escalation. Everything else resolves autonomously.

---

## Programmatic Mode vs Conversational Mode

`bmad-agent-pm` operates differently when invoked as Workflow Manager:

| Dimension | Conversational mode | Programmatic mode |
|---|---|---|
| Input source | Human messages | Story file frontmatter + body |
| Output destination | Chat response | Story file Phase Log + frontmatter writes |
| Session lifecycle | Ends when conversation ends | Runs until backlog is empty or story is blocked |
| Clarification behaviour | Asks questions freely | Escalates only on defined triggers (see above) |
| Activation | Default | Triggered by `/run` command context |

---

## State Diagram

```
/run invoked
    │
    ▼
Pre-flight ──────────────────────────────────► User confirms
    │
    ▼
Orchestrator eval ── action: none ──► skip
    │
    ▼
bmad-shard-doc ──► N shard files
    │
    ▼
Dispatch ready shards (parallel where deps allow)
    │
    ├── shard completes [confidence >= 80%] ──► continue
    ├── shard completes [confidence 60-79%] ──► log warning, continue
    ├── shard completes [confidence < 60%]  ──► escalate to user
    └── shard blocked (inter-agent)         ──► micro-shard, resume
    │
    ▼
All shards complete ──► Merge worktrees
    │
    ▼
QA Gate
    ├── pass ──────────────────────────────► Telemetry Gate
    └── fail
          ├── retries < 2 ──► Orchestrator fix shard ──► re-merge ──► QA Gate
          └── retries = 2 ──► status: blocked ──► escalate to user
                                                        │
                                                        ▼
                                               User answers ──► fix shard ──► re-merge ──► QA Gate
    │
    ▼
Telemetry Gate ──► complete
    │
    ▼
Wrap-up: merge, PR, project-brief update, status: done
    │
    ▼
Surface PR link to user ✓
```

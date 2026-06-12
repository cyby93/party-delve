# Autonomous Cascade Story Format

## Purpose

This spec defines the story file format used by the autonomous agent cascade system. Story files are the single source of truth for work definition, routing, execution state, and audit history. They are simultaneously:

- The work ticket (what to build)
- The routing config (who builds it)
- The pipeline declaration (in what order)
- The execution state machine (where it is now)
- The audit trail (what happened)

## Folder Conventions

```
_stories/
  backlog/          # status: ready — awaiting /run
  active/
    <story-id>/     # status: active — cascade in progress
      story.md      # parent story file
      shards/       # child shard files, one per agent
        shard-<role>.md
  done/             # status: done — cascade complete, PR open
  blocked/          # status: blocked — escalated to user
```

## Story File Structure

Every story file is a markdown document with a YAML frontmatter header followed by a rich prose body.

### Frontmatter Fields

```yaml
---
# Identity
id: GDS-001                          # unique story identifier
title: Add combat system             # short human-readable title
created: 2026-06-12                  # date /story was run
priority: medium                     # low | medium | high | critical

# Lifecycle
status: ready                        # see Status Transitions below
current_owner: workflow-manager      # agent currently responsible
next_owner: simulation-engineer      # agent to invoke after current completes
qa_retries: 0                        # QA failure counter, ceiling: 2

# Pipeline (set by Orchestrator during decomposition)
pipeline:                            # ordered list of agents to invoke
  - protocol-architect
  - simulation-engineer
  - host-engineer
pipeline_reason: "combat touches server tick and host HUD only"

# Shards (set by Orchestrator, one entry per child shard)
shards:
  - id: shard-schema
    owner: protocol-architect
    status: complete
    confidence: 94
    worktree: shard/GDS-001-schema
  - id: shard-sim
    owner: simulation-engineer
    depends_on: [shard-schema]
    status: active
    confidence: ~
    worktree: shard/GDS-001-sim
  - id: shard-host
    owner: host-engineer
    depends_on: [shard-schema]
    status: pending
    confidence: ~
    worktree: shard/GDS-001-host

# Cross-story dependencies (optional)
depends_on_stories: []               # list of story IDs that must be done first
---
```

### Field Reference

| Field | Type | Set by | Description |
|---|---|---|---|
| `id` | string | `/story` | Unique identifier, format `GDS-NNN` |
| `title` | string | `/story` | Short title from intake dialog |
| `created` | date | `/story` | ISO date when story was authored |
| `priority` | enum | `/story` or user edit | `low` \| `medium` \| `high` \| `critical` |
| `status` | enum | Workflow Manager | See Status Transitions |
| `current_owner` | string | Workflow Manager | Agent role currently responsible |
| `next_owner` | string | Workflow Manager | Agent role to invoke next |
| `qa_retries` | int | Workflow Manager | Incremented on each QA failure, max 2 |
| `pipeline` | list | Orchestrator | Ordered agent roles for this story |
| `pipeline_reason` | string | Orchestrator | Human-readable rationale for pipeline |
| `shards` | list | Orchestrator | Child shard definitions (see Shard Fields) |
| `depends_on_stories` | list | `/story` or user | Cross-story dependency IDs |

### Shard Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique shard identifier within the story |
| `owner` | string | Agent role responsible for this shard |
| `depends_on` | list | Other shard IDs that must complete first |
| `status` | enum | `pending` \| `active` \| `complete` \| `failed` |
| `confidence` | int or `~` | Agent self-assessed confidence 0–100, `~` if not yet run |
| `worktree` | string | Git worktree branch name for this shard |

---

## Status Transitions

```
draft ──► ready ──► active ──► qa-review ──► telemetry ──► done
                      │                          │
                      │         ┌────────────────┘ (QA fail, retries < 2)
                      │         ▼
                      │    Orchestrator analyzes ──► fix shard ──► active (retry)
                      │
                      └──► blocked  (escalated to user: QA fail retry = 2,
                                     or cross-agent blocker requiring user input)
```

| Status | Meaning | Set by |
|---|---|---|
| `draft` | Story authored but not yet approved by user | `/story` |
| `ready` | User approved, in backlog awaiting `/run` | `/story` on approval |
| `active` | Cascade running | Workflow Manager on `/run` |
| `qa-review` | All shards complete, QA agent running | Workflow Manager |
| `telemetry` | QA passed, Telemetry agent running | Workflow Manager |
| `done` | Cascade complete, PR open, project-brief updated | Workflow Manager |
| `blocked` | Escalated to user — requires human input | Workflow Manager |

---

## Story Body Structure

The markdown body below the frontmatter follows this structure. Fields marked `[intake]` are populated during `/story`. Fields marked `[cascade]` are appended during execution.

```markdown
## Context

[intake] Medium-length description of what this story is about and why it matters.
Reference to relevant project-brief.md sections if applicable.

## Acceptance Criteria

[intake] Bulleted list of verifiable conditions that define done.
- [ ] criterion 1
- [ ] criterion 2

## Non-Goals

[intake] Explicit list of what this story does NOT cover.

## Edge Cases

[intake] Known edge cases the implementing agent must handle.

## Telemetry

[intake] Events this story requires instrumented.
- event: `combat.hit`
  trigger: player lands a hit
  payload: { player_id, target_id, damage, ability_id }

## Phase Log

[cascade] Append-only. Each completing agent adds one entry.

### Protocol Architect — 2026-06-12 09:45 [confidence: 94%]
Defined `CombatHitEvent` and `ReviveEvent` in shared-types.
Assumptions: simultaneous hit+revive resolved as hit-first.
No contract changes to existing events required.

### Simulation Engineer — 2026-06-12 10:12 [confidence: 81%]
Implemented combat tick in `apps/simulation-server/src/combat.ts`.
Assumptions: cooldown defaulted to 1200ms — no spec found, flagged.

### QA Agent — 2026-06-12 10:31
PASS. 12/12 contract tests green. 3/3 e2e scenarios passing.
```

---

## Agent Routing Rules

The Workflow Manager reads the following fields to determine routing:

1. **Which agents run:** `pipeline` list, in order
2. **Which shard to launch next:** first shard in `shards` where `status: pending` and all `depends_on` shards are `status: complete`
3. **Whether to escalate:** `qa_retries >= 2` or any shard with unresolvable cross-agent blocker
4. **Whether to skip an agent:** Orchestrator or Protocol Architect may set `action: none` in their shard, causing Workflow Manager to mark it complete and continue

### Role-to-Skill Mapping

| Role | BMAD/GDS Skill | Invocation |
|---|---|---|
| `orchestrator` | `bmad-agent-pm` (programmatic mode) | Always evaluated |
| `protocol-architect` | `bmad-agent-architect` (eval mode) | Always evaluated, may no-op |
| `simulation-engineer` | `gds-agent-game-dev` + role config | Conditional |
| `host-engineer` | `gds-agent-game-dev` + role config | Conditional |
| `mobile-engineer` | `gds-agent-game-dev` + role config | Conditional |
| `qa-agent` | `bmad-qa-generate-e2e-tests` (adapted) | Always, after all shards merge |
| `telemetry-agent` | `telemetry-agent` (new) | Only after QA pass |

### Role Config Injection

When invoking `gds-agent-game-dev`, the Workflow Manager injects:

```yaml
role: simulation-engineer
allowed_paths:
  - apps/simulation-server/**
  - packages/game-rules/**
blocked_paths:
  - apps/host-client/**
  - apps/mobile-controller/**
  - packages/shared-types/**
  - packages/net-protocol/**
```

Paths are sourced directly from CLAUDE.md ownership section at invocation time.

---

## Confidence Score Protocol

Every completing agent MUST append a confidence score to its Phase Log entry.

**Format:**
```
[confidence: 94%]
Assumptions: <comma-separated list of assumptions made>
```

**Thresholds (configurable in Workflow Manager):**
- `>= 80%` — continue silently
- `60–79%` — continue, highlight in Phase Log
- `< 60%` — auto-escalate to user before proceeding

---

## QA Recovery Protocol

When QA fails:

1. QA agent writes structured failure output to its Phase Log entry:
   ```
   FAIL — 2/12 contract tests failed.
   Failing: CombatHitEvent missing `ability_id` field.
   Responsible shard: shard-sim (simulation-engineer).
   ```
2. Workflow Manager increments `qa_retries`
3. If `qa_retries < 2`: Orchestrator generates a targeted fix shard, sets `depends_on` the failing shard, re-enters pipeline from that shard
4. If `qa_retries >= 2`: story moves to `status: blocked`, full Phase Log surfaced to user with a single focused question

---

## project-brief.md Auto-Update

On story `status: done`, Workflow Manager appends to the relevant domain section of `project-brief.md`:

```markdown
### [Story Title] — [date]
[2–3 sentences summarising what was built, key design decisions, and any assumptions that became permanent.]
```

The domain section is determined by the `pipeline` agents used: stories using `simulation-engineer` append to `## Game Rules / Simulation`, stories using `host-engineer` append to `## Host Client / Rendering`, etc.

---

## Example: Minimal Story (backlog state)

```markdown
---
id: GDS-002
title: Add player movement input binding
created: 2026-06-12
priority: high
status: ready
current_owner: workflow-manager
next_owner: ~
qa_retries: 0
pipeline: []
shards: []
depends_on_stories: []
---

## Context

Players need to send movement input from the mobile controller to the simulation server.
This story covers the input binding on mobile and the server-side handler.
Reference: project-brief.md > Networking > Input Protocol.

## Acceptance Criteria

- [ ] Mobile joystick sends `MoveInputEvent` on every frame tick
- [ ] Simulation server applies movement to player entity on receipt
- [ ] Dead zone threshold configurable in shared-types

## Non-Goals

- Prediction or interpolation (Phase 5)
- Host-side movement visualisation (separate story)

## Edge Cases

- Input received after player is dead: discard silently
- Input burst during reconnect: queue up to 100ms, then discard

## Telemetry

- event: `input.move`
  trigger: joystick delta > dead zone
  payload: { player_id, dx, dy, timestamp }

## Phase Log

_Empty — story not yet started._
```

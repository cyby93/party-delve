# Helper: Parse CLAUDE.md Ownership Rules → Role Config Map

## Purpose

Read `CLAUDE.md`'s `## Ownership Rules` section and build a structured role config map that the Workflow Manager uses to assign shards, inject role context into agents, and validate path boundaries.

**This helper is called fresh on every `/run` invocation. Never use a cached result.**

---

## Instructions

### 1. Read CLAUDE.md

Read `{project-root}/CLAUDE.md` in full. Locate the section `## Ownership Rules`.

The ownership rules follow this pattern:
```
- `packages/shared-types/**` and `packages/net-protocol/**` are owned by Protocol Architect.
- `apps/simulation-server/**` and `packages/game-rules/**` are owned by Simulation Engineer.
- `apps/host-client/**` is owned by Host Experience Engineer.
- `apps/mobile-controller/**` is owned by Mobile Controller Engineer.
- `packages/telemetry/**`, `tests/**`, and `tools/**` are owned by QA + Telemetry Engineer.
- `docs/adr/**` and `docs/specs/**` are shared by Orchestrator and Protocol Architect.
```

### 2. Build Role Config Map

Parse the ownership declarations and build the following map. Use these canonical role keys:

| CLAUDE.md Label | Role Key | Skill to invoke |
|---|---|---|
| Protocol Architect | `protocol-architect` | `bmad-agent-architect` |
| Simulation Engineer | `simulation-engineer` | `gds-agent-game-dev` |
| Host Experience Engineer | `host-engineer` | `gds-agent-game-dev` |
| Mobile Controller Engineer | `mobile-engineer` | `gds-agent-game-dev` |
| QA + Telemetry Engineer (QA role) | `qa-agent` | `bmad-qa-generate-e2e-tests` |
| QA + Telemetry Engineer (Telemetry role) | `telemetry-agent` | `telemetry-agent` |

**Output structure (role config map):**

```yaml
protocol-architect:
  skill: bmad-agent-architect
  allowed_paths:
    - packages/shared-types/**
    - packages/net-protocol/**
    - docs/adr/**
    - docs/specs/**
  blocked_paths:
    - apps/**
    - packages/game-rules/**
    - packages/telemetry/**
    - packages/ui-kit/**
    - tests/**
    - tools/**

simulation-engineer:
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/simulation-server/**
    - packages/game-rules/**
  blocked_paths:
    - apps/host-client/**
    - apps/mobile-controller/**
    - apps/backend-platform/**
    - packages/shared-types/**
    - packages/net-protocol/**
    - packages/telemetry/**
    - packages/ui-kit/**
    - tests/**
    - tools/**

host-engineer:
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/host-client/**
    - packages/ui-kit/**
  blocked_paths:
    - apps/simulation-server/**
    - apps/mobile-controller/**
    - apps/backend-platform/**
    - packages/shared-types/**
    - packages/net-protocol/**
    - packages/game-rules/**
    - packages/telemetry/**
    - tests/**
    - tools/**

mobile-engineer:
  skill: gds-agent-game-dev
  allowed_paths:
    - apps/mobile-controller/**
    - packages/ui-kit/**
  blocked_paths:
    - apps/simulation-server/**
    - apps/host-client/**
    - apps/backend-platform/**
    - packages/shared-types/**
    - packages/net-protocol/**
    - packages/game-rules/**
    - packages/telemetry/**
    - tests/**
    - tools/**

qa-agent:
  skill: bmad-qa-generate-e2e-tests
  allowed_paths:
    - tests/**
    - tools/**
  blocked_paths:
    - apps/**
    - packages/**

telemetry-agent:
  skill: telemetry-agent
  allowed_paths:
    - packages/telemetry/**
  blocked_paths:
    - apps/**
    - packages/shared-types/**
    - packages/net-protocol/**
    - packages/game-rules/**
    - packages/ui-kit/**
    - tests/**
    - tools/**
```

### 3. Drift Detection

After building the map, check for drift:
- If CLAUDE.md's `## Ownership Rules` contains a path pattern NOT in the map above → log a warning: `⚠ Ownership drift detected: {new path} — role config map may be stale. Update helpers/parse-ownership.md.`
- Do not block execution for drift — warn and continue.

### 4. Return

Return the role config map to the calling step for use in shard generation and agent dispatch.

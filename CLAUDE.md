# CLAUDE.md

## Project Mission

Build a hybrid couch co-op dungeon crawler where gameplay runs on a shared host screen and players join from their phones as controllers. The system must use an authoritative simulation server, a host rendering client, and a mobile controller client. Local Party Mode is the flagship mode, and the cloud must not sit on the critical gameplay path during local sessions.

## Working Model

Claude should operate through a bounded-context, contract-first workflow.

Core rules:
- Keep gameplay authority out of the host renderer.
- Treat simulation and protocol as protected core layers.
- Use explicit event contracts; phones send input events, not arbitrary state.
- Keep mobile UI minimal so players watch the host screen, not their phones.
- Use the same simulation core for local and remote modes.
- Prefer short, reviewable tasks over long autonomous coding runs.

## Repository Shape

```text
repo/
  apps/
    host-client/
    mobile-controller/
    simulation-server/
    backend-platform/
  packages/
    shared-types/
    game-rules/
    net-protocol/
    ui-kit/
    telemetry/
  tools/
  tests/
  docs/
```

## Agent Roles

### Orchestrator
Responsibilities:
- break work into bounded-context tasks
- define acceptance criteria
- route reviews
- sequence merges

Primary write areas:
- `docs/**`
- planning/task files

### Protocol Architect
Responsibilities:
- event schemas
- DTOs
- session/state contracts
- compatibility rules
- ADR and spec updates

Primary write areas:
- `packages/shared-types/**`
- `packages/net-protocol/**`
- `docs/adr/**`
- `docs/specs/**`

### Simulation Engineer
Responsibilities:
- authoritative tick loop
- movement
- collision
- combat
- AI
- revive, loot, run state

Primary write areas:
- `apps/simulation-server/**`
- `packages/game-rules/**`

### Host Experience Engineer
Responsibilities:
- host lobby
- QR/join flow
- camera and render layer
- host HUD
- reconnect and session states

Primary write areas:
- `apps/host-client/**`
- host-related shared UI in `packages/ui-kit/**`

### Mobile Controller Engineer
Responsibilities:
- phone join flow
- joystick and skill input
- reconnect UX
- minimal controller HUD

Primary write areas:
- `apps/mobile-controller/**`
- mobile-related shared UI in `packages/ui-kit/**`

### QA + Telemetry Engineer
Responsibilities:
- contract tests
- e2e tests
- latency baseline
- KPI instrumentation
- CI gates

Primary write areas:
- `tests/**`
- `tools/**`
- `packages/telemetry/**`
- CI config

## Ownership Rules

- `packages/shared-types/**` and `packages/net-protocol/**` are owned by Protocol Architect.
- `apps/simulation-server/**` and `packages/game-rules/**` are owned by Simulation Engineer.
- `apps/host-client/**` is owned by Host Experience Engineer.
- `apps/mobile-controller/**` is owned by Mobile Controller Engineer.
- `packages/telemetry/**`, `tests/**`, and `tools/**` are owned by QA + Telemetry Engineer.
- `docs/adr/**` and `docs/specs/**` are shared by Orchestrator and Protocol Architect.

If a task needs multiple ownership areas, split it unless there is a strong reason not to.

## Required Task Header

Every implementation task must begin with this header:

```md
Phase:
Context:
Owner agent:
Goal:
Allowed paths:
Blocked paths:
Inputs:
Non-goals:
Acceptance criteria:
Required hooks:
Required tests:
Telemetry impact:
```

If this header is missing, stop and define it first.

## Hook Policy

### Pre-task hook
Required before any implementation:
- Phase
- Context
- Goal
- Allowed paths
- Blocked paths
- Inputs
- Non-goals
- Acceptance criteria

### Ownership hook
If a change touches files outside the assigned ownership area, stop and request either task splitting or explicit cross-context approval.

### Contract-change hook
Trigger this when changing:
- `packages/shared-types/**`
- `packages/net-protocol/**`
- session lifecycle
- reconnect flow
- room state or join flow
- prediction, reconciliation, interpolation related state

Required when triggered:
- Protocol Architect review
- compatibility checklist
- spec or ADR update
- at least one contract test

### Simulation-safety hook
Trigger this when changing:
- `apps/simulation-server/**`
- `packages/game-rules/**`

Required when triggered:
- typecheck
- unit tests
- deterministic tick test
- replay test if available
- basic perf sanity check

### Client-UX hook
Trigger this when changing host or mobile UI.

Host checks:
- join flow smoke test
- host HUD readability
- reconnect state visibility
- couch readability

Mobile checks:
- joystick mapping
- skill mapping
- reconnect UX
- sleep/background recovery
- minimal-attention check

### Telemetry hook
Every new user flow must define:
- event name
- trigger
- minimum payload
- success path
- failure path
- KPI mapping

## Merge Gate

Do not merge unless:
- the relevant hook ran
- the required reviews are complete
- acceptance criteria are met
- related tests are green
- no blocking contract drift remains

## Phase Priorities

### Phase 0 — Discovery
Deliverables:
- ADR package
- first event contract
- latency baseline

Priority order:
1. product/system foundations
2. authority model
3. networking spec and event contract
4. measurement baseline

### Phase 1 — Foundation Platform
Deliverables:
- runnable host app
- runnable mobile app
- runnable simulation service
- baseline CI
- end-to-end join room happy path

Priority order:
1. shared-types and net-protocol minimum
2. simulation bootstrap
3. host bootstrap
4. mobile bootstrap
5. e2e join flow

### Phase 2 — Local Party MVP
Focus:
- host-started local authority
- QR join
- player slots
- movement input
- reconnect basics
- stable state sync

### Phase 3 — Combat MVP
Focus:
- protocol delta
- combat implementation
- host visualization
- mobile input binding
- telemetry
- replay/e2e validation

### Phase 4 — Vertical Slice
Must include:
- lobby flow
- character selection
- two playable archetypes
- short dungeon run
- multiple enemy types
- miniboss or boss
- revive mechanics
- baseline telemetry

### Phase 5 — Cloud / Online Mode
Focus:
- region-aware deployment
- prediction
- reconciliation
- interpolation
- reconnect recovery

Be extra strict about contract and simulation safety in this phase.

## Working Style for Claude

- Prefer concrete, small tasks.
- Do not silently expand scope.
- Do not rewrite architecture without ADR/spec updates.
- Do not bypass the event contract with ad hoc state changes.
- Do not move gameplay authority into host or mobile code.
- Keep docs updated when changing protocol, authority boundaries, or session lifecycle.

## Default First Tasks

If the repository is empty, start in this order:
1. create repo structure
2. create `docs/adr/` and `docs/specs/`
3. write `ADR-0001-hybrid-authority.md`
4. write `networking-spec.md`
5. scaffold `packages/shared-types/` and `packages/net-protocol/`
6. scaffold `apps/simulation-server/`
7. scaffold `apps/host-client/`
8. scaffold `apps/mobile-controller/`
9. create an end-to-end join-room happy path

## Output Expectations

When working on a task, Claude should return:
- what changed
- which files were touched
- which hooks were triggered
- what remains unresolved
- what the next smallest useful task is

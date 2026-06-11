# Agentic Workflow v1 for the Hybrid Couch Co-op Dungeon Crawler

## Purpose

This document defines the first operational version of the Claude Code agentic workflow for the Hybrid Couch Co-op Dungeon Crawler project. The goal is to establish an AI agent team and a hook policy that can reliably support the project from discovery through the local party MVP and vertical slice, and later into the online mode.

The workflow is built around the project’s architecture: authoritative simulation, host client, mobile controller client, shared protocol, backend/platform, and telemetry. The project plan explicitly states that gameplay authority should not live in the host renderer, the mobile client should focus on input and minimal HUD, and the local party mode should be the primary experience, so the agent model and rules must follow the same structure.

## Core Principles

- Gameplay decision logic must be authoritative and tick-based, not decided in the host client.
- The host client is responsible for presentation, lobby, camera, and session UX.
- The mobile client should only handle input, minimal player-specific feedback, and reconnect UX.
- The cloud should not be on the critical gameplay path in local couch sessions.
- The online and local modes should use the same core simulation module, differing only in deployment and transport.
- The phone must send explicit input events, not arbitrary state mutations.

These principles shape not only the architecture but also the agent ownership model. The most important implication is that the protocol and simulation layers must be treated as high-protection areas, and the client-side agents must only work through the shared contract.

## Monorepo and Ownership Model

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
  docs/

This structure helps ensure that the same game definitions, event contracts, and state types run in both local and cloud environments, so the agents’ writing rights should mirror this separation.

## Agent Roster v1

| Agent | Primary goal | Primary write scope | Should not primarily modify |
|---|---|---|---|
| Orchestrator | Task breakdown, prioritization, handoffs, merge sequencing | docs/, task specs, workflow docs | Core gameplay, host render, mobile input logic |
| Protocol Architect | Event schema, DTOs, state contracts, compatibility | packages/shared-types/, packages/net-protocol/, docs/adr/, docs/specs/ | Host render, combat implementation, mobile UI details |
| Simulation Engineer | Authoritative tick loop, movement, collision, combat, AI, run state | apps/simulation-server/, packages/game-rules/ | Mobile UI, host visual code, meta backend |
| Host Experience Engineer | Lobby, QR/join flow, render, camera, host HUD | apps/host-client/, parts of packages/ui-kit/ | Hit/collision/AI authority logic |
| Mobile Controller Engineer | Join flow, joystick, skill input, reconnect UX, minimal HUD | apps/mobile-controller/, parts of packages/ui-kit/ | Authoritative state mutation, combat authority |
| QA + Telemetry Engineer | Test harness, e2e flows, contract tests, latency baseline, KPI mapping | tests/, tools/, packages/telemetry/, CI config, docs/runbooks/ | Host gameplay implementation |

## Responsibilities

### Orchestrator

The Orchestrator is responsible for workflow control, not core implementation. This agent breaks work into bounded contexts, defines acceptance criteria, decides review routing, and ensures that work follows the project’s milestone order.

This is especially important in the early phases, because the project plan is milestone-driven: first ADR and event contract, then monorepo and join-room happy path, followed by local session, combat, and vertical slice.

### Protocol Architect

The Protocol Architect owns the shared language. This agent is responsible for shared types, event categories, DTOs, session state separation, and compatibility concerns.

The project plan explicitly says that in-game communication should be built around explicit events and that the phone should not send arbitrary state but declarative input events, so this role is a critical stability point.

### Simulation Engineer

The Simulation Engineer owns the authoritative gameplay layer. This includes tick loop, movement, collision, combat, cooldowns, AI, aggro, loot, revive, and run state handling.

This is the only agent that should primarily write authoritative gameplay logic. That is because the project plan states that collision, hit resolution, and enemy AI should not live in the host client, but in a separate authoritative game server.

### Host Experience Engineer

The Host Experience Engineer owns the shared display experience. This includes the main menu, lobby, QR or join code display, character selection, world rendering, camera, visual layer, pause, and reconnect states.

Since the host screen is meant to keep shared attention focused, this agent has both technical and couch UX responsibility. Everything on the host side should be readable and support the team’s decisions.

### Mobile Controller Engineer

The Mobile Controller Engineer owns the phone client. Their responsibilities include room join, player identification, analog movement joystick, skill inputs, minimal HUD, and reconnect/sleep recovery UX.

The project plan emphasizes that the phone must not distract from the host screen, so this agent should build a minimal controller-first interface rather than a mini-game UI.

### QA + Telemetry Engineer

The QA + Telemetry Engineer is responsible for system reliability and measurement. This agent writes contract tests, e2e happy paths, latency baseline tooling, and ensures that every new flow has telemetry events and KPI mapping.

This directly aligns with the project plan, which recommends measuring session start success rate, QR join success rate, time-to-join, p50/p95 input RTT, reconnect success rate, and run completion rate from the beginning.

## Cooperation Model

This project should not rely on long autonomous coding runs. Instead, use short, well-defined work cycles where each agent owns a narrow, clear deliverable.

Recommended rules:

- One task should belong to one primary bounded context whenever possible.
- Cross-context tasks require Orchestrator approval.
- The Protocol Architect must review contract-related changes before implementation moves on.
- The Simulation Engineer should only work against approved contracts.
- Host and Mobile agents should only use published event contracts.
- The QA + Telemetry Engineer should verify measurability at the end of every feature.

## Hook Policy v1

The hook policy is intended to prevent the most expensive failures: contract drift, state divergence, reconnect breakage, weak ownership boundaries, and unmeasured user flows. The project’s technical risks include cloud latency, mobile sleep/background issues, Wi-Fi instability, host overload, and prediction-authority mismatch, so the hooks must defend against those risks.

### 1. Pre-task hook

Every task must begin with a structured task header. Without it, the agent may not start implementation.

Required fields:
- Phase
- Context
- Goal
- Allowed paths
- Blocked paths
- Inputs
- Non-goals
- Acceptance criteria

Suggested example:

```md
Phase: Phase 1 – Foundation platform
Context: mobile-controller
Goal: first version of the join-room happy path
Allowed paths:
- apps/mobile-controller/**
- packages/ui-kit/**
Blocked paths:
- apps/simulation-server/**
- packages/net-protocol/**
Inputs:
- docs/specs/networking-spec.md
- docs/adr/ADR-0001-hybrid-authority.md
Non-goals:
- combat
- progression
- auth
Acceptance:
- 1 host session can accept 1–4 controllers
- reconnect state is visible
- e2e smoke test passes
```

### 2. Ownership hook

A core part of the policy is path-level ownership. The monorepo structure makes this natural, so it should already be enforced in version 1.

Recommended ownership rules:

- `packages/shared-types/**` and `packages/net-protocol/**` are primarily owned by the Protocol Architect.
- `apps/simulation-server/**` and `packages/game-rules/**` are primarily owned by the Simulation Engineer.
- `apps/host-client/**` is primarily owned by the Host Experience Engineer.
- `apps/mobile-controller/**` is primarily owned by the Mobile Controller Engineer.
- `packages/telemetry/**`, `tests/**`, and `tools/**` are primarily owned by the QA + Telemetry Engineer.
- `docs/adr/**` and `docs/specs/**` are jointly owned by the Orchestrator and Protocol Architect.

### 3. Contract-change hook

If any shared contract or event schema changes, the task must automatically become architecture-sensitive. This is important because the same simulation module must be used in both local and remote environments, so any contract change affects the whole system.

Trigger examples:

- `packages/shared-types/**` changes
- `packages/net-protocol/**` changes
- session lifecycle changes
- reconnect tokens or reconnect flow changes
- room join flow or room state changes
- prediction, reconciliation, or interpolation related state changes

Required consequences:

- Protocol Architect review
- compatibility checklist
- spec or ADR update
- at least one contract test

### 4. Simulation-safety hook

Every simulation change must trigger automatic safety checks. The simulation is the most sensitive part of the system, because this is where movement, collision, combat, and AI behavior are decided.

Required checks:

- typecheck
- unit tests
- deterministic tick test
- input replay or event replay test, if available
- baseline perf sanity check for tick budget

This is especially important because the project plan explicitly identifies host overload and state divergence as risks.

### 5. Client-UX hook

Any host or mobile change must run UX-specific checks in addition to the usual typecheck and smoke tests.

Host-side checks:

- join flow smoke test
- host HUD readability check
- reconnect status display check
- couch readability checklist

Mobile-side checks:

- joystick input mapping check
- skill input mapping check
- reconnect state UX check
- sleep/background recovery check
- minimal-attention checklist

These checks matter because the host screen must remain the shared focus, while the phone’s job is only fast, reliable input and minimal feedback.

### 6. Telemetry hook

Every new user flow must include a short telemetry appendix. From the very beginning, the project must be measurable for usability and stability.

For every new flow, record:

- event name
- trigger
- minimum payload
- success path
- failure path
- related KPI

Recommended KPIs:

- session start success rate
- QR join success rate
- time-to-join
- p50 / p95 input RTT
- reconnect success rate
- average session length
- run completion rate
- quality difference between local and remote mode

These KPIs appear explicitly in the project plan, so it makes sense to make them mandatory as part of the workflow.

## Hook Trigger Matrix

| Trigger | Required hook | Required review |
|---|---|---|
| `packages/shared-types/**` changes | Contract-change | Protocol Architect |
| `packages/net-protocol/**` changes | Contract-change | Protocol Architect |
| `apps/simulation-server/**` changes | Simulation-safety | Simulation Engineer + QA |
| `packages/game-rules/**` changes | Simulation-safety | Simulation Engineer + QA |
| `apps/host-client/**` changes | Client-UX | Host Experience Engineer |
| `apps/mobile-controller/**` changes | Client-UX | Mobile Controller Engineer |
| telemetry changes | Telemetry | QA + Telemetry Engineer |
| ADR or spec changes | Contract-change | Orchestrator + Protocol Architect |

## Merge Gate

A merge is only allowed if:

- the relevant hook ran,
- the required reviews were completed,
- the task acceptance criteria were met,
- the related tests are green,
- there is no blocking contract drift.

## Critical Rule

Simulation and shared protocol must always be treated more conservatively than client UI. Core contract stability takes precedence over fast frontend iteration.

## Workflow by Phase

### Phase 0 – Discovery and technical foundations

Goal: validate technical decisions, create the first architecture package, and establish a contract-first base.

Recommended agent order:

1. Orchestrator: task breakdown and scope definition
2. Protocol Architect: event schema v1 and state boundary draft
3. Simulation Engineer: authority and tick model validation
4. QA + Telemetry Engineer: latency baseline and measurement plan
5. Orchestrator + Protocol Architect: finalize ADR package

Main deliverables:

- architecture decision record package
- first event contract
- latency measurement baseline

### Phase 1 – Foundation platform

Goal: build the monorepo and the runnable foundation of the three main apps, plus basic CI and join-room happy path.

Recommended agent order:

1. Protocol Architect: minimal shared-types and net-protocol package
2. Simulation Engineer: simulation service bootstrap
3. Host Experience Engineer: host app bootstrap
4. Mobile Controller Engineer: mobile app bootstrap
5. QA + Telemetry Engineer: e2e happy path and CI gate
6. Orchestrator: integration and merge sequencing

Main deliverables:

- three separately runnable apps
- baseline CI pipeline
- end-to-end join room happy path

### Phase 2 – Local Party MVP

Goal: a working local couch session with stable session lifecycle, 1–4 connected phones, and low input latency.

Recommended focus:

- local host authority startup
- QR join flow
- player slot handling
- joystick input
- initial stable state sync
- reconnect basics
- latency measurement

### Phase 3 – Combat MVP

Goal: build the actual action loop on top of the authoritative simulation.

Recommended order:

1. Protocol delta
2. Simulation combat implementation
3. Host visualization
4. Mobile input binding
5. Telemetry events
6. Combat e2e or replay test

### Phase 4 – Vertical Slice

Goal: a playable, reliable, and externally testable slice suitable for playtesting.

The vertical slice should include at least one lobby flow, character selection, two playable archetypes, a short dungeon run, multiple enemy types, one miniboss or boss, revive mechanics, and baseline telemetry.

### Phase 5 – Cloud / Online Mode

Goal: introduce a remote mode on the same core engine with prediction, reconciliation, and interpolation.

In this phase, the Contract-change hook and Simulation-safety hook should be especially strict, because state divergence and cloud latency are called out as key risks in the project plan.

## Concrete Task Template for Claude Code

```md
# Task

## Meta
- Phase:
- Context:
- Owner agent:
- Reviewers:
- Priority:

## Goal

## Inputs
- ADRs:
- Specs:
- Related packages:
- Relevant prior tasks:

## Scope

### Allowed paths
- 

### Blocked paths
- 

### Non-goals
- 

## Deliverable
- 

## Acceptance criteria
- [ ]
- [ ]
- [ ]

## Required hooks
- Pre-task
- Ownership
- Contract-change
- Simulation-safety
- Client-UX
- Telemetry

## Required tests
- 

## Telemetry impact
- New events:
- KPI mapping:
- Dashboard / log target:

## Notes
- If the task touches multiple bounded contexts, the Orchestrator must split it first.
- If shared contracts change, Protocol Architect review is mandatory.
- If simulation changes, deterministic tests are mandatory.
- If host or mobile UX changes, the UX checklist is mandatory.
```

## Documents to create first in the repo

To actually operate this workflow, it is worth creating a few foundational documents immediately, because the project plan also recommends breaking out dedicated planning docs.

Recommended starter set:

- `docs/agents/AGENTS.md`
- `docs/agents/HOOKS.md`
- `docs/agents/TASK_TEMPLATE.md`
- `docs/adr/ADR-0001-hybrid-authority.md`
- `docs/specs/networking-spec.md`
- `docs/specs/telemetry-spec.md`
- `docs/specs/controller-ux-spec.md`
- `docs/specs/host-ux-spec.md`

## Minimum viable policy

If the team wants to start fast, this minimum policy is already strong enough for the first sprint:

- 6-agent roster
- path-level ownership
- mandatory Pre-task hook
- mandatory Contract-change hook
- mandatory Simulation-safety hook
- telemetry appendix for every user flow
- every task starts from a template

This minimum policy is already sufficient to keep the project controlled through discovery and foundation, without slowing development down too much.

## Recommended next steps

The most logical follow-up is:

1. Create the repo-ready version of `AGENTS.md`.
2. Write the operational `HOOKS.md`.
3. Finalize `TASK_TEMPLATE.md` for daily Claude Code use.
4. Break Phase 0 and Phase 1 into concrete agent tasks.

This order also matches the breakdown logic suggested by the project plan: first define product and system foundations, then networking and contracts, and only then detail the implementation backlog.

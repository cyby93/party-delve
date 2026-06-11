---
name: Task
about: Structured bounded-context implementation task
---

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

Check each trigger condition. Mark only the hooks that apply to this task.

- [ ] **Pre-task** (always — fill this header before writing any code)
- [ ] **Ownership** (always — all changed paths must be within Allowed paths above)
- [ ] **Contract-change** (if touching `packages/shared-types/**`, `packages/net-protocol/**`, session lifecycle, reconnect flow, or room state)
- [ ] **Simulation-safety** (if touching `apps/simulation-server/**` or `packages/game-rules/**`)
- [ ] **Client-UX** (if touching `apps/host-client/**`, `apps/mobile-controller/**`, or `packages/ui-kit/**`)
- [ ] **Telemetry** (if adding any new user flow or interaction)

See `docs/runbooks/HOOKS_CHECKLIST.md` for the steps and commands required by each hook.

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

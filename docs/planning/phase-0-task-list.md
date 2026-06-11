# Phase 0 Task List

## Goal

Validate core technical decisions and establish the contract-first foundation before any app code is written.

---

## Tasks

### P0-1 — Create repository structure
**Owner:** Orchestrator
**Status:** Done
**Deliverable:** Monorepo folder skeleton matching `CLAUDE.md` shape
**Acceptance:**
- [x] `apps/`, `packages/`, `docs/`, `tests/`, `tools/` directories exist
- [x] `docs/adr/` and `docs/specs/` directories exist

---

### P0-2 — Add CLAUDE.md and starter docs
**Owner:** Orchestrator
**Status:** Done
**Deliverable:** Operational rules, workflow doc, agent prompts
**Acceptance:**
- [ ] `CLAUDE.md` defines agent roster, ownership rules, hook policy, and phase priorities
- [ ] `agentic_workflow_roster_hook_policy_v1_en.md` exists as detailed operational reference
- [ ] Agent role prompts exist in `docs/prompts/`

---

### P0-3 — Write ADR-0001 hybrid authority
**Owner:** Orchestrator + Protocol Architect
**Status:** Done
**Deliverable:** `docs/adr/ADR-0001-hybrid-authority.md`
**Acceptance:**
- [ ] Decision recorded: simulation is authoritative, host renders only
- [ ] Rationale explains local-first + optional cloud model
- [ ] Consequences section covers both local and remote mode
- [ ] ~~Authority boundary examples added~~ → see P0-10

---

### P0-4 — Write networking specification
**Owner:** Protocol Architect
**Status:** Done — expanded by P0-4b (session state machine, serialization format, reconnect token lifecycle, network quality thresholds added)
**Deliverable:** `docs/specs/networking-spec.md`
**Acceptance:**
- [ ] Event categories defined (input, state, session, error)
- [ ] Transport layer described (WebSocket)
- [ ] ~~Session state machine diagram~~ → not yet present
- [ ] ~~Serialization format~~ → not yet specified
- [ ] ~~Reconnect token lifecycle~~ → not yet defined
- [ ] ~~RTT threshold for prediction activation~~ → not yet defined

**Remaining work:** These items block Phase 1 join-room implementation — assign to Protocol Architect as P0-4b.

---

### P0-5 — Write telemetry specification
**Owner:** QA + Telemetry Engineer
**Status:** Done (draft) — event payload schemas pending
**Deliverable:** `docs/specs/telemetry-spec.md`
**Acceptance:**
- [ ] Core KPIs listed
- [ ] Recommended initial events listed
- [ ] Common payload fields defined
- [ ] ~~Event payload schemas~~ → not yet present → see P0-11

---

### P0-6 — Define first event categories and state domains
**Owner:** Protocol Architect
**Status:** Done
**Deliverable:** First event contract document or section in `docs/specs/networking-spec.md`
**Inputs:** `docs/specs/networking-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md`
**Acceptance:**
- [x] At minimum: `MoveInputEvent`, `SkillInputEvent`, `PlayerStateSnapshot`, `SessionStateEvent` are named and described
- [x] Each event has: name, direction (phone→server, server→host), trigger, and key fields
- [x] Protocol Architect has reviewed
- [x] At least one contract test stub exists or is planned

**Note:** Contract test stub: "contract: MoveInputEvent schema validates required fields" — to be created in Phase 1 (P1-1 dependency).

---

### P0-7 — Decide first shared package boundaries
**Owner:** Orchestrator + Protocol Architect
**Status:** Done (ownership rules in CLAUDE.md define boundaries)
**Deliverable:** Confirmed package split: `shared-types`, `net-protocol`, `game-rules`, `ui-kit`, `telemetry`
**Acceptance:**
- [ ] Each package's public API surface is described in one sentence
- [ ] Cross-package dependency direction is documented (no circular deps allowed)

---

### P0-8 — Define latency baseline measurement approach
**Owner:** QA + Telemetry Engineer
**Status:** Done
**Inputs:** `docs/specs/telemetry-spec.md`, `docs/specs/networking-spec.md`
**Deliverable:** `docs/specs/latency-baseline.md`
**Acceptance:**
- [x] Defines what is measured: input-sent → state-reflected round trip (MoveInputEvent → PlayerStateSnapshot matching by sequenceNumber)
- [x] Defines the measurement tool or approach (three approaches: built-in timestamp logging, manual probe script, test harness)
- [x] Defines p50 and p95 targets for local mode (p50 < 16ms, p95 < 50ms, p99 < 100ms)
- [x] Defines how baseline is captured in CI or during manual test runs

**Note:** CI gate test stub: "latency: p95 RTT < 50ms on loopback" — to be implemented in Phase 1 (P1-6/P1-7 dependency).

---

### P0-9 — Prepare task template workflow
**Owner:** Orchestrator
**Status:** Done (updated in this session)
**Deliverable:** `TASK_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/task.md`, `docs/runbooks/HOOKS_CHECKLIST.md`
**Acceptance:**
- [ ] `TASK_TEMPLATE.md` contains all required header fields from `CLAUDE.md`
- [ ] Required hooks section uses checkboxes with trigger guidance
- [ ] `docs/runbooks/HOOKS_CHECKLIST.md` exists with commands for each hook
- [ ] GitHub issue template matches the task template

---

### P0-10 — Add authority boundary examples to ADR-0001
**Owner:** Protocol Architect
**Status:** Done
**Inputs:** `docs/adr/ADR-0001-hybrid-authority.md`
**Deliverable:** New "Boundary Examples" section in ADR-0001
**Acceptance:**
- [x] Lists at least 3 things the host CAN do (e.g., render interpolated positions, play sounds on state events, show reconnect UI)
- [x] Lists at least 3 things the host CANNOT do (e.g., resolve collision, decide hit outcomes, mutate player HP directly)
- [x] Answers: can the host apply animation-layer smoothing? Can it reorder events for rendering?
- [x] Protocol Architect + Orchestrator have reviewed

---

### P0-11 — Add event payload schemas to telemetry spec
**Owner:** QA + Telemetry Engineer
**Status:** Done (completed in this session)
**Deliverable:** TypeScript interface definitions for each recommended initial event in `docs/specs/telemetry-spec.md`
**Acceptance:**
- [ ] Each event group (Session Funnel, Network Quality, Gameplay, Stability) has payload schemas
- [ ] Common fields (`session_id`, `player_id`, `mode`, `build_version`, `timestamp`) are in a shared base type
- [ ] Event-specific fields are documented for each event

---

## Deliverables

- ADR package (`docs/adr/ADR-0001-hybrid-authority.md` complete with boundary examples)
- First event contract (in `docs/specs/networking-spec.md` or standalone)
- Telemetry baseline definition (KPIs + payload schemas in `docs/specs/telemetry-spec.md`)
- Latency baseline plan (`docs/specs/telemetry-spec.md` or `docs/specs/latency-baseline.md`)
- Complete task template + hooks runbook

## Phase 0 → Phase 1 Gate

Phase 1 may not start until:
- [x] P0-6 first event contract is reviewed and merged
- [x] P0-8 latency baseline approach is defined
- [x] P0-10 ADR-0001 boundary examples are merged
- [x] P0-11 telemetry payload schemas are merged
- [x] P0-9 task template and hooks runbook are in place

**Gate status: OPEN — Phase 1 may begin.**

---

## Phase 0b — Workflow Contract

**Status:** Done

**Deliverables produced:**
- `.github/ISSUE_TEMPLATE/business-issue.md` — business-first issue template
- `docs/runbooks/issue-to-spec-workflow.md` — translation rule set, agent output schema, DoR, open question routing
- `docs/planning/tasks/example-run-start-clarity.md` — initial testable example task

**Phase 0b → Phase 1 Gate:**
- [x] Business-first GitHub issue template created
- [x] Issue-to-spec translation rule set documented
- [x] Agent output schema defined
- [x] Definition of Ready defined
- [x] Open question routing policy defined
- [x] Initial testable example produced

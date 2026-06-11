# Task P0-4b — Expand Networking Spec

## Meta
- Phase: Phase 0 — Discovery
- Context: Protocol foundations — `docs/specs/networking-spec.md` exists as a draft but lacks implementation-level detail needed to start Phase 1
- Owner agent: Protocol Architect
- Reviewers: Orchestrator
- Priority: High — blocks Phase 0 → Phase 1 gate

## Goal

Expand `docs/specs/networking-spec.md` with four missing sections so that Phase 1 implementers have no ambiguity about the wire format, session lifecycle, reconnect flow, or when prediction activates.

## Inputs
- ADRs: `docs/adr/ADR-0001-hybrid-authority.md`
- Specs: `docs/specs/networking-spec.md` (current draft — read it first)
- Related packages: none yet (Phase 0 is docs only)
- Relevant prior tasks: P0-3 (ADR-0001), P0-4 (networking spec draft)

## Scope

### Allowed paths
- `docs/specs/networking-spec.md`
- `docs/adr/**` (if a new ADR is warranted for a significant decision)

### Blocked paths
- `packages/**` — no code yet, Phase 0 is docs only
- `apps/**`

### Non-goals
- Implementing any code
- Defining gameplay event schemas (that is P0-6)
- Defining telemetry payloads (already done in P0-11)

## Deliverable

Four new sections added to `docs/specs/networking-spec.md`:

1. **Session lifecycle state machine** — states (idle → creating → waiting\_for\_players → in\_run → ended), transitions, and which party triggers each transition
2. **Serialization format** — wire format for messages (JSON vs binary, envelope structure, versioning strategy)
3. **Reconnect token lifecycle** — how tokens are issued, how long they are valid, how mobile uses them to resume a session
4. **Network quality thresholds** — what RTT values define "good", "degraded", "poor"; at what RTT does prediction activate (Phase 5 planning note)

## Acceptance criteria
- [ ] Session state machine section is present with at least 4 named states and labeled transitions
- [ ] Serialization format section specifies: wire encoding (JSON or binary), message envelope shape, and how the event type field is named
- [ ] Reconnect token section specifies: who issues the token, token TTL, how a mobile client uses it to resume
- [ ] Network quality section specifies: RTT thresholds for good/degraded/poor, and notes the RTT value at which Phase 5 prediction should activate
- [ ] Orchestrator has reviewed before merge

## Required hooks
- [x] **Pre-task** (this header)
- [x] **Ownership** (`docs/specs/**` is within Protocol Architect allowed paths)
- [ ] **Contract-change** (spec changes require Orchestrator review before merge)

## Required tests
- None for Phase 0 doc tasks. Contract tests will be written in Phase 1 against the spec.

## Telemetry impact
- New events: none
- KPI mapping: none
- Dashboard / log target: none

## Notes
- The serialization format decision is load-bearing for Phase 1. If you choose binary (e.g. MessagePack), note the tradeoff vs JSON for debuggability.
- Do not invent a prediction/reconciliation system here. Phase 5 owns that. Just document the RTT threshold at which it becomes necessary.
- If you find that a significant architectural decision is being made (e.g. choosing binary protocol), consider whether a new ADR is warranted.

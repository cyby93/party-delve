# Hooks Checklist

Operational runbook for the hook policy defined in `CLAUDE.md` and `agentic_workflow_roster_hook_policy_v1_en.md`.

Commands use `pnpm` workspace syntax. Update the package filter flags once the monorepo is scaffolded — replace placeholders like `pnpm -F simulation-server` with the actual package name from `package.json`.

---

## Pre-task Hook

**Always required.** Must be satisfied before writing any code.

- [ ] Task header has all required fields: Phase, Context, Owner agent, Goal, Allowed paths, Blocked paths, Inputs, Non-goals, Acceptance criteria, Required hooks, Required tests, Telemetry impact
- [ ] Acceptance criteria are measurable — not "it works" but "smoke test passes" or "type X is exported"
- [ ] Blocked paths include all out-of-scope package areas
- [ ] Inputs list the specs and ADRs this task depends on (see `docs/specs/` and `docs/adr/`)

---

## Ownership Hook

**Always required.** Before opening a PR, verify no out-of-scope files were touched.

```bash
git diff --name-only main | sort
```

Cross-reference the output with the **Allowed paths** in the task header. If any changed file falls outside Allowed paths, stop and either:
- Revert the out-of-scope change, or
- Request Orchestrator approval for cross-context work and split the task if needed

**Ownership reference** (from `CLAUDE.md`):

| Path | Owner |
|---|---|
| `packages/shared-types/**`, `packages/net-protocol/**` | Protocol Architect |
| `apps/simulation-server/**`, `packages/game-rules/**` | Simulation Engineer |
| `apps/host-client/**` | Host Experience Engineer |
| `apps/mobile-controller/**` | Mobile Controller Engineer |
| `packages/telemetry/**`, `tests/**`, `tools/**` | QA + Telemetry Engineer |
| `docs/adr/**`, `docs/specs/**` | Orchestrator + Protocol Architect |

---

## Contract-change Hook

**Triggered when any of these change:**
- `packages/shared-types/**`
- `packages/net-protocol/**`
- Session lifecycle (join → ready → in-run → end state machine)
- Reconnect token format or flow
- Room join flow or room state
- Prediction, reconciliation, or interpolation-related state
- `docs/adr/**` or `docs/specs/**`

**Required steps:**
- [ ] Protocol Architect reviews the diff before merge
- [ ] Compatibility checklist: is this a breaking change? If yes, version the type or event name
- [ ] Update the relevant spec or ADR section to reflect the change
- [ ] At least one contract test covers the changed schema

**Commands** (update filter names after scaffold):
```bash
pnpm -F shared-types typecheck
pnpm -F net-protocol typecheck
pnpm -F tests run --grep contract
```

---

## Simulation-safety Hook

**Triggered when any of these change:**
- `apps/simulation-server/**`
- `packages/game-rules/**`

**Required steps:**
- [ ] Typecheck passes with no errors
- [ ] Unit tests pass
- [ ] Deterministic tick test: same seed + same input sequence → same output state
- [ ] Input replay test passes (skip if replay corpus does not exist yet)
- [ ] Tick budget sanity: a single tick completes under 4ms on reference hardware

**Commands** (update filter names after scaffold):
```bash
pnpm -F simulation-server typecheck
pnpm -F simulation-server test
pnpm -F simulation-server test:deterministic
pnpm -F simulation-server test:replay        # only when replay corpus exists
pnpm -F simulation-server bench:tick         # only when bench target exists
```

---

## Client-UX Hook

**Triggered when any of these change:**
- `apps/host-client/**`
- `apps/mobile-controller/**`
- `packages/ui-kit/**`

### Host-side checklist
- [ ] Join flow: host can create a session and display QR code or room code
- [ ] Host HUD readability: all critical player state is visible from 3 metres
- [ ] Reconnect state: visually distinct indicator when a player is disconnected
- [ ] Couch readability: no critical information requires reading small text

### Mobile-side checklist
- [ ] Joystick input: analog movement maps correctly to `MoveInputEvent`
- [ ] Skill input: each button fires the correct `SkillInputEvent`
- [ ] Reconnect UX: reconnect screen appears correctly after sleep or background
- [ ] Sleep/background recovery: app reconnects within 5s after 10s background
- [ ] Minimal-attention: a glance at the phone communicates full player state

**Commands** (update filter names after scaffold):
```bash
pnpm -F host-client typecheck
pnpm -F host-client test
pnpm -F mobile-controller typecheck
pnpm -F mobile-controller test
```

---

## Telemetry Hook

**Triggered when:**
- A new user-facing flow is added
- A new session lifecycle event is added
- A new error condition is added to an existing flow

**Required steps:**
- [ ] Event name defined (format: `snake_case`, past tense, e.g. `session_create_succeeded`)
- [ ] Trigger point documented — what user action or system event fires it
- [ ] Minimum payload fields defined — include the common fields from `docs/specs/telemetry-spec.md`
- [ ] Both success and failure paths have events
- [ ] Event is mapped to at least one KPI from `docs/specs/telemetry-spec.md`

**Template for documenting a new event:**
```
Event:   <event_name>
Trigger: <what causes this event to fire>
Payload: { session_id, player_id, mode, build_version, timestamp, <event-specific fields> }
Success: <which event follows on the success path>
Failure: <which event follows on the failure path>
KPI:     <which Core KPI this feeds into>
```

---

## Merge Gate

Do not merge a PR unless all of the following are true:
- [ ] All triggered hooks ran and passed
- [ ] Required reviews are complete (Protocol Architect for contract changes, Simulation Engineer + QA for sim changes)
- [ ] All acceptance criteria from the task header are met
- [ ] Related tests are green in CI
- [ ] No blocking contract drift remains unresolved

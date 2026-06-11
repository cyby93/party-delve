# Phase 1 Task List

## Goal

Build the runnable foundation for the three main apps and the first end-to-end join-room path.

## Prerequisites (Phase 0 gate)

All Phase 0 gate items must be complete before starting Phase 1:
- First event contract reviewed and merged
- Latency baseline approach defined
- ADR-0001 boundary examples merged
- Telemetry payload schemas in place
- Task template and hooks runbook in place

---

## Tasks

Tasks are listed in dependency order. Do not start a task until its dependencies are complete.

---

### P1-1 — Scaffold `packages/shared-types/`
**Owner:** Protocol Architect
**Hooks:** Pre-task, Ownership, Contract-change
**Depends on:** Phase 0 complete; first event contract (P0-6)
**Inputs:** `docs/specs/networking-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md`
**Allowed paths:** `packages/shared-types/**`
**Deliverable:** TypeScript package that compiles and exports core domain types
**Status:** Done
**Acceptance:**
- [x] Package builds with `pnpm -F shared-types typecheck`
- [x] Exports at minimum: `PlayerState`, `InputEvent` (union of `MoveInputEvent` | `SkillInputEvent`), `RoomState`, `SessionState`
- [x] Has `index.ts` barrel export
- [x] No runtime dependencies — types only
- [x] `README.md` describes the package purpose in one paragraph

**Note:** Root `pnpm-workspace.yaml` and `package.json` created as minimal scope addition (3 lines each) required to make `pnpm -F` discoverable. P1-6 owns expanding these.

---

### P1-2 — Scaffold `packages/net-protocol/`
**Owner:** Protocol Architect
**Hooks:** Pre-task, Ownership, Contract-change
**Depends on:** P1-1 (shared-types)
**Inputs:** `docs/specs/networking-spec.md`, `packages/shared-types/`
**Allowed paths:** `packages/net-protocol/**`
**Deliverable:** TypeScript package that defines message envelope types and event name constants
**Status:** Done
**Acceptance:**
- [x] Package builds with `pnpm -F net-protocol typecheck`
- [x] Exports: `MessageEnvelope`, event name string constants (`EVENT_NAMES`), message type guards
- [x] Depends on `shared-types` (not the other way around)
- [x] `README.md` describes the package purpose in one paragraph

---

### P1-3 — Scaffold `apps/simulation-server/`
**Owner:** Simulation Engineer
**Hooks:** Pre-task, Ownership, Simulation-safety
**Depends on:** P1-1, P1-2
**Inputs:** `docs/specs/networking-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md`, `packages/shared-types/`, `packages/net-protocol/`
**Allowed paths:** `apps/simulation-server/**`, `packages/game-rules/**`
**Deliverable:** Runnable Node.js server with empty tick loop and WebSocket listener
**Status:** Done
**Acceptance:**
- [x] `pnpm -F simulation-server start` starts without errors
- [x] WebSocket server binds to a configurable port (default 8081)
- [x] Tick loop runs at 20Hz and logs tick count (can be a no-op loop)
- [x] Imports and uses types from `shared-types`
- [x] `pnpm -F simulation-server typecheck` passes
- [x] At least one unit test exists (even a trivial sanity test)

---

### P1-4 — Scaffold `apps/host-client/`
**Owner:** Host Experience Engineer
**Hooks:** Pre-task, Ownership, Client-UX
**Depends on:** P1-1
**Inputs:** `docs/specs/host-ux-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md`, `packages/shared-types/`
**Allowed paths:** `apps/host-client/**`, `packages/ui-kit/**` (host parts only)
**Deliverable:** Runnable browser app that renders a blank canvas and connects to simulation-server
**Status:** Done
**Acceptance:**
- [x] `pnpm -F host-client dev` starts and serves at `localhost:3000`
- [x] Blank canvas or placeholder screen renders without errors
- [x] Imports types from `shared-types`
- [x] Attempts WebSocket connection to simulation-server (connection failure is handled gracefully — shows "offline" state)
- [x] `pnpm -F host-client typecheck` passes

---

### P1-5 — Scaffold `apps/mobile-controller/`
**Owner:** Mobile Controller Engineer
**Hooks:** Pre-task, Ownership, Client-UX
**Depends on:** P1-1
**Inputs:** `docs/specs/controller-ux-spec.md`, `docs/adr/ADR-0001-hybrid-authority.md`, `packages/shared-types/`
**Allowed paths:** `apps/mobile-controller/**`, `packages/ui-kit/**` (mobile parts only)
**Deliverable:** Runnable mobile-optimized browser app
**Status:** Done
**Acceptance:**
- [x] `pnpm -F mobile-controller dev` starts and serves at `localhost:3001`
- [x] Page renders correctly on a 390px-wide viewport (iPhone SE)
- [x] Imports types from `shared-types`
- [x] Attempts WebSocket connection to simulation-server (connection failure is handled gracefully)
- [x] `pnpm -F mobile-controller typecheck` passes

---

### P1-6 — Add baseline lint, typecheck, and test tooling
**Owner:** QA + Telemetry Engineer
**Hooks:** Pre-task, Ownership
**Depends on:** P1-1, P1-2, P1-3, P1-4, P1-5
**Allowed paths:** `tools/**`, `package.json` (root), all `package.json` files, `tsconfig*.json` files, `.eslintrc*`
**Deliverable:** Root-level scripts that run lint, typecheck, and tests across all packages
**Status:** Done
**Acceptance:**
- [x] `pnpm typecheck` runs `tsc --noEmit` across all packages — no errors
- [x] `pnpm lint` runs ESLint across all packages — no errors on scaffolded code
- [x] `pnpm test` runs all test suites — no failures (passing with zero tests is acceptable at this stage)
- [x] All three commands exit 0 on a clean checkout

---

### P1-7 — Add minimal CI
**Owner:** QA + Telemetry Engineer
**Hooks:** Pre-task, Ownership
**Depends on:** P1-6
**Allowed paths:** `.github/workflows/**`
**Deliverable:** GitHub Actions workflow that runs on every PR
**Status:** Done
**Acceptance:**
- [x] Workflow triggers on `pull_request` to `main`
- [x] Runs `pnpm typecheck`, `pnpm lint`, `pnpm test` in sequence
- [x] Fails the PR check if any command exits non-zero
- [x] Completes in under 5 minutes on a cold runner

---

### P1-8 — Implement join-room happy path
**Owner:** All agents — Orchestrator coordinates; each agent owns their layer
**Hooks:** Pre-task, Ownership, Contract-change, Client-UX, Telemetry
**Depends on:** P1-3, P1-4, P1-5, P1-6, P1-7
**Inputs:** `docs/specs/networking-spec.md`, `packages/net-protocol/`, first event contract (P0-6)
**Allowed paths:** `apps/**`, `packages/net-protocol/**` (additive only), `packages/shared-types/**` (additive only)
**Non-goals:** Movement, combat, character selection, authentication
**Deliverable:** End-to-end flow: host creates session → mobile joins → mobile appears as connected player on host
**Status:** Done
**Acceptance:**
- [x] Host app creates a session and displays a room code or QR code
- [x] Mobile app can enter the room code and join
- [x] Host app shows the joined player as connected (slot filled)
- [x] Joining a second mobile device fills a second slot (up to 4 players)
- [x] Disconnecting a mobile device shows the slot as disconnected on host
- [x] E2e smoke test (script or Playwright test) validates this flow and passes in CI

---

### P1-9 — Add initial telemetry for session creation and join flow
**Owner:** QA + Telemetry Engineer
**Hooks:** Pre-task, Ownership, Telemetry
**Depends on:** P1-8
**Inputs:** `docs/specs/telemetry-spec.md` (including payload schemas from P0-11)
**Allowed paths:** `packages/telemetry/**`, `apps/simulation-server/**` (telemetry calls only), `apps/host-client/**` (telemetry calls only), `apps/mobile-controller/**` (telemetry calls only)
**Deliverable:** Session funnel events firing with correct payloads
**Status:** Done
**Acceptance:**
- [x] `session_create_started` and `session_create_succeeded` fire when host creates a session
- [x] `join_attempt_started`, `join_attempt_succeeded`, and `join_attempt_failed` fire on mobile join
- [ ] Each event payload includes all required common fields: `session_id`, `mode`, `build_version`, `timestamp`
- [ ] Events are logged to console in local mode (no external service required yet)
- [ ] A contract test asserts that each event payload matches its schema from `telemetry-spec.md`

---

## Deliverables

- Three runnable apps (`simulation-server`, `host-client`, `mobile-controller`)
- Two runnable packages (`shared-types`, `net-protocol`)
- Baseline CI pipeline (typecheck + lint + test on every PR)
- End-to-end join-room happy path with e2e smoke test
- Session funnel telemetry events wired up

## Phase 1 → Phase 2 Gate

Phase 2 (Local Party MVP) may not start until:
- [ ] P1-8 e2e smoke test passes in CI
- [ ] P1-9 session funnel events fire with correct payloads
- [ ] All three apps start cleanly from a cold checkout
- [ ] P1-7 CI is green on `main`

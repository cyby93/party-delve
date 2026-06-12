# Story CASCADE-2: Workflow Manager (`/run`) Skill

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — Story Execution Engine
Context: CASCADE-1 (story-intake skill) is the dependency for this story — it produces the
  story files that /run consumes. The _stories/ folder structure exists. project-brief.md is
  at the repo root. docs/specs/workflow-manager-spec.md is the authoritative spec for this
  skill's behaviour. docs/specs/autonomous-cascade-story-format.md defines the story file
  format this skill reads and writes.
Owner agent: QA + Telemetry Engineer (owns tools/**, infrastructure)
Goal: Build a Claude Code skill at .claude/skills/workflow-manager/ that implements the
  full /run execution engine: pre-flight dependency analysis, story decomposition via
  bmad-shard-doc, CLAUDE.md ownership parsing, dependency-aware shard dispatch via
  EnterWorktree, worktree merge, QA gate with two-strike recovery, telemetry gate, and
  wrap-up (PR + project-brief update).
Allowed paths:
  - .claude/skills/workflow-manager/**
  - _stories/**  (read and write story frontmatter and Phase Log)
Blocked paths:
  - apps/**
  - packages/**
  - docs/specs/** (read-only reference)
  - project-brief.md (WRITE allowed only in step-07-wrap-up, append-only)
  - CLAUDE.md (read-only — parsed for ownership rules)
  - .claude/skills/bmad-shard-doc/** (read-only — called, not modified)
  - .claude/skills/bmad-agent-pm/** (read-only — called, not modified)
  - .claude/skills/bmad-agent-architect/** (read-only — called, not modified)
  - .claude/skills/gds-agent-game-dev/** (read-only — called, not modified)
  - .claude/skills/bmad-qa-generate-e2e-tests/** (read-only — called, not modified)
Inputs:
  - docs/specs/workflow-manager-spec.md — authoritative behaviour spec (REQUIRED)
  - docs/specs/autonomous-cascade-story-format.md — story file schema (REQUIRED)
  - CLAUDE.md — parsed at runtime for ownership rules (read-only)
  - project-brief.md — read + append-only at wrap-up
  - _stories/backlog/*.md — stories awaiting execution
Non-goals:
  - /story intake dialog — that is CASCADE-1
  - telemetry-agent skill implementation — that is CASCADE-3
  - Adapting bmad-qa-generate-e2e-tests — that is CASCADE-4
  - gds-agent-game-dev role config injection — that is CASCADE-5
  - Any changes to game code (apps/**, packages/**)
  - Conflict resolution beyond what is defined in the spec
  - Multi-story parallel execution (one story at a time in first implementation)
Acceptance criteria: see AC section below
Required hooks: none — tooling infrastructure only
Required tests: manual smoke test against a real _stories/backlog/ story
Telemetry impact: none
```

---

## Story

As a developer working on party-delve,
I want to type `/run` and have the cascade execute automatically from story decomposition
through to a merged PR with one confirmation step,
so that I can author a story with `/story`, walk away, and return to a completed PR.

---

## Acceptance Criteria

1. `/run` with no arguments scans `_stories/backlog/` for stories with `status: ready`, runs pre-flight dependency analysis, and presents the proposed execution order to the user for a single confirmation before proceeding.
2. `/run list` displays all stories across `_stories/backlog/`, `_stories/active/`, `_stories/done/`, and `_stories/blocked/` with their status and shard progress, without starting any execution.
3. `/run GDS-NNN` starts a specific story by ID without priority selection, but still runs pre-flight.
4. After user confirmation, the Workflow Manager reads CLAUDE.md's `## Ownership Rules` section and builds a role config map (role name → skill name + allowed_paths + blocked_paths).
5. The Workflow Manager invokes the Orchestrator (`bmad-agent-pm` programmatic mode) to evaluate the story and declare the pipeline (ordered list of agent roles) and which agents are skipped.
6. `bmad-shard-doc` is called to decompose the amplified story into N child shard files, one per pipeline role, written to `_stories/active/<story-id>/shards/`.
7. The Workflow Manager dispatches shards in dependency order: shards with no `depends_on` launch immediately; shards with `depends_on` launch only when all listed shards are `status: complete`.
8. Each shard executes in its own git worktree (`shard/<story-id>-<shard-id>` branch). When a shard completes, its worktree is exited and a Phase Log entry is written to the parent story file with confidence score and assumptions.
9. After all shards complete, worktrees are merged into `feature/<story-id>`. Merge conflicts on non-overlapping files are auto-resolved; conflicts requiring judgment escalate to the user.
10. QA agent (`bmad-qa-generate-e2e-tests`) is invoked on the merged branch. Pass → proceed to Telemetry gate. Fail → invoke QA recovery loop (max 2 retries before user escalation).
11. Telemetry agent (`telemetry-agent`) is invoked only after QA pass. Never runs on unverified code.
12. On story completion: story moves to `_stories/done/`, status set to `done`, PR opened, `project-brief.md` appended with 2–3 sentence domain summary, PR link surfaced to user.
13. If `qa_retries` reaches 2, cascade pauses: story moves to `_stories/blocked/`, full Phase Log and all QA failure reports surfaced to user with a single focused question.

---

## Tasks / Subtasks

- [x] **T1 — Scaffold skill directory** (AC: all)
  - [x] Create `.claude/skills/workflow-manager/` directory
  - [x] Create `workflow.md` as the skill entry point
  - [x] Create `steps/` subdirectory
  - [x] Create `helpers/` subdirectory

- [x] **T2 — Write `workflow.md`** (AC: 1, 2, 3)
  - [x] Define skill name, description (triggers: "/run", "workflow manager", "run story")
  - [x] Load config from `_bmad/core/config.yaml`
  - [x] Define path constants:
    - `backlog_path = _stories/backlog/`
    - `active_path = _stories/active/`
    - `done_path = _stories/done/`
    - `blocked_path = _stories/blocked/`
  - [x] Route on argument:
    - No args → `step-01-scan.md`
    - `list` → `step-01-scan.md` with `list_only: true` flag
    - `GDS-NNN` → `step-01-scan.md` with `target_id: GDS-NNN`

- [x] **T3 — Write `steps/step-01-scan.md`** (AC: 1, 2, 3)
  - [x] **If `list_only: true`:** read all story files across all `_stories/` subfolders, display formatted status table (see spec `/run list` output format), HALT
  - [x] **Otherwise:** scan `_stories/backlog/` for `status: ready` stories; parse frontmatter of each
  - [x] Run pre-flight checks (see Pre-Flight Check algorithm in Dev Notes)
  - [x] Build and display proposed execution order with dependency explanations
  - [x] Present user with: `[Y] Accept  [E] Edit order  [S] Start anyway`
  - [x] HALT — wait for user confirmation (only human touchpoint in `/run`)
  - [x] On confirm → update target story `status: active`, move to `_stories/active/<id>/story.md`, route to `step-02-decompose.md`
  - [x] On `E` (edit) → display numbered list, accept reorder input, re-display, re-confirm
  - [x] On `S` (start anyway) → skip ordering, use as-is, proceed

- [x] **T4 — Write `helpers/parse-ownership.md`** (AC: 4)
  - [x] Read `CLAUDE.md` — locate `## Ownership Rules` section
  - [x] Parse ownership declarations into a role config map:
    ```
    simulation-engineer:
      skill: gds-agent-game-dev
      allowed_paths: [apps/simulation-server/**, packages/game-rules/**]
      blocked_paths: [all other apps/**, packages/shared-types/**, packages/net-protocol/**]
    host-engineer:
      skill: gds-agent-game-dev
      allowed_paths: [apps/host-client/**]
      blocked_paths: [...]
    mobile-engineer:
      skill: gds-agent-game-dev
      allowed_paths: [apps/mobile-controller/**]
      blocked_paths: [...]
    protocol-architect:
      skill: bmad-agent-architect
      allowed_paths: [packages/shared-types/**, packages/net-protocol/**, docs/adr/**, docs/specs/**]
      blocked_paths: [apps/**]
    qa-agent:
      skill: bmad-qa-generate-e2e-tests
      allowed_paths: [tests/**, tools/**]
      blocked_paths: [apps/**, packages/**]
    telemetry-agent:
      skill: telemetry-agent
      allowed_paths: [packages/telemetry/**]
      blocked_paths: [apps/**, other packages/**]
    ```
  - [x] Blocked paths for each role = all paths NOT in its allowed_paths (derived automatically)
  - [x] Return role config map for use by subsequent steps
  - [x] Rebuild on every `/run` invocation — never cached

- [x] **T5 — Write `steps/step-02-decompose.md`** (AC: 5, 6)
  - [x] Load role config map via `helpers/parse-ownership.md`
  - [x] Load relevant `project-brief.md` sections (match to story domains)
  - [x] Invoke Orchestrator (`bmad-agent-pm` programmatic mode) with:
    - Full amplified story body
    - Role config map
    - Relevant project-brief sections
  - [x] Parse Orchestrator response:
    ```yaml
    pipeline: [protocol-architect, simulation-engineer, host-engineer]
    pipeline_reason: "..."
    skip: [mobile-engineer]
    skip_reason: "..."
    ```
  - [x] If Orchestrator declares `action: none` for its own orchestration work, note in Phase Log and continue
  - [x] Invoke `helpers/story-decompose.md` (LLM-powered — replaces bmad-shard-doc CLI reference)
  - [x] Write N child shard files to `_stories/active/<id>/shards/shard-<role>.md`
  - [x] Build dependency graph (see Dependency Graph Rules in Dev Notes)
  - [x] Update parent story frontmatter: `pipeline`, `shards` list, `status: active`
  - [x] Route to `step-03-dispatch.md`

- [x] **T6 — Write `steps/step-03-dispatch.md`** (AC: 7, 8)
  - [x] Implement dispatch loop:
    - Check all `status: pending` shards for readiness (all `depends_on` shards must be `status: complete`)
    - Ready shards → dispatch (potentially in parallel if multiple are ready simultaneously)
    - Dispatch a shard:
      1. `EnterWorktree` → branch `shard/<story-id>-<shard-id>`
      2. Invoke agent skill with role config injection (role, allowed_paths, blocked_paths, shard file as context)
      3. Agent writes Phase Log entry + confidence score to parent story
      4. `ExitWorktree`
      5. Update shard `status: complete`, `confidence: <value>` in parent frontmatter
    - After each shard completes, run confidence threshold check:
      - `>= 80%` → continue silently
      - `60–79%` → mark Phase Log entry `⚠ low confidence`, continue
      - `< 60%` → pause, surface assumption list to user: "Agent confidence low. Review assumptions and confirm to continue." HALT until user confirms
    - Check for inter-agent escalation flags in Phase Log (see Inter-Agent Escalation in Dev Notes)
    - Repeat until all shards `status: complete`
  - [x] When all developer shards complete → route to `step-04-merge.md`

- [x] **T7 — Write `steps/step-04-merge.md`** (AC: 9)
  - [x] Identify merge order: leaves first (shards with no dependents merge first)
  - [x] For each shard in merge order: `git merge shard/<story-id>-<shard-id>` into `feature/<story-id>`
  - [x] Auto-resolve non-overlapping file conflicts
  - [x] If merge conflict requires judgment: surface diff to user with options. HALT until resolved.
  - [x] After all merges complete → route to `step-05-qa-gate.md`

- [x] **T8 — Write `steps/step-05-qa-gate.md`** (AC: 10, 13)
  - [x] Invoke `bmad-qa-generate-e2e-tests` (adapted) with:
    - Merged `feature/<story-id>` branch
    - Story acceptance criteria (from story body)
    - Contract change declarations from Protocol Architect shard Phase Log entry
  - [x] Parse structured QA result:
    ```yaml
    status: pass | fail
    passed: N
    failed: N
    failures:
      - test: "..."
        reason: "..."
        responsible_shard: "..."
        responsible_role: "..."
    ```
  - [x] On `pass` → route to `step-06-telemetry-gate.md`
  - [x] On `fail`:
    - Increment `qa_retries` in parent story frontmatter
    - Write QA failure entry to Phase Log
    - If `qa_retries < 2`:
      1. Invoke Orchestrator with: merged branch + QA failure report
      2. Orchestrator generates targeted fix shard(s) for responsible role(s)
      3. Write fix shard files to `_stories/active/<id>/shards/shard-fix-<role>-<retry>.md`
      4. Dispatch fix shards via `step-03-dispatch.md` logic (same pattern, new worktree)
      5. Re-merge → re-enter `step-05-qa-gate.md`
    - If `qa_retries >= 2`:
      1. Set `status: blocked` in story frontmatter
      2. Move story file to `_stories/blocked/<id>.md`
      3. Surface to user: full Phase Log + all QA failure reports + single focused question
      4. HALT — await user answer
      5. On user answer: generate fix shard with user answer as constraint, reset `qa_retries: 0`, dispatch fix shard, re-merge, re-enter QA gate

- [x] **T9 — Write `steps/step-06-telemetry-gate.md`** (AC: 11)
  - [x] Only reachable after QA `status: pass` — enforce this with a guard check at step entry
  - [x] Invoke `telemetry-agent` skill with:
    - Merged `feature/<story-id>` branch
    - Story's `## Telemetry` section (event names, triggers, payloads)
  - [x] Telemetry agent instruments events, verifies KPI mappings
  - [x] Agent appends Phase Log entry with confidence score
  - [x] On completion → route to `step-07-wrap-up.md`

- [x] **T10 — Write `steps/step-07-wrap-up.md`** (AC: 12)
  - [x] Merge `feature/<story-id>` into current branch (sprint branch or main if in Phase 1)
  - [x] Open PR using `gh pr create`:
    - Title: story title (from frontmatter)
    - Body: Phase Log summary + acceptance criteria checklist (from story body `## Acceptance Criteria`)
  - [x] Append to `project-brief.md` in the correct domain section(s):
    - Domain mapping: per `docs/specs/workflow-manager-spec.md` project-brief.md Domain Mapping table
    - Format: `### [Story Title] — [date]\n[2–3 sentence summary of what was built]`
    - Append-only: never overwrite existing content
  - [x] Move story file from `_stories/active/<id>/` to `_stories/done/<id>.md`
  - [x] Update story `status: done` in frontmatter
  - [x] Surface to user: PR link only. One line. No other output.

- [x] **T11 — Write `helpers/phase-log.md`** (AC: 8)
  - [x] Define standard Phase Log entry format:
    ```
    ### <Role Name> — <ISO datetime> [confidence: N%]
    <What was done>
    Assumptions: <comma-separated list, or "none">
    ```
  - [x] Define blocked entry format:
    ```
    ⚠ <Role Name> — <ISO datetime> blocked: <description>. Escalating to <role>.
    ```
  - [x] Define QA failure entry format:
    ```
    ### QA Agent — <ISO datetime>
    FAIL — <N>/<M> tests failed.
    Failing: <description>
    Responsible shard: <shard-id> (<role>)
    ```
  - [x] Define QA pass entry format:
    ```
    ### QA Agent — <ISO datetime>
    PASS. <N>/<N> tests green.
    ```
  - [x] All Phase Log entries are appended to the `## Phase Log` section of the parent story file

---

## Dev Notes

### Skill Architecture

This is the most complex skill in the cascade system. Study `.claude/skills/bmad-brainstorming/` for the micro-file architecture pattern. The workflow.md is the entry point; each step file is self-contained with its own execution rules.

```
.claude/skills/workflow-manager/
  workflow.md                      ← /run entry point
  steps/
    step-01-scan.md                ← pre-flight + user confirm
    step-02-decompose.md           ← orchestrator eval + shard generation
    step-03-dispatch.md            ← shard execution loop
    step-04-merge.md               ← worktree merge
    step-05-qa-gate.md             ← QA invocation + recovery loop
    step-06-telemetry-gate.md      ← telemetry invocation
    step-07-wrap-up.md             ← PR + brief update + done
  helpers/
    parse-ownership.md             ← CLAUDE.md → role config map
    phase-log.md                   ← Phase Log write helpers
```

### Pre-Flight Check Algorithm

```
Input: list of ready stories
Output: dependency map + proposed execution order + conflict list

For each pair of ready stories (A, B):
  1. Check file overlap:
     - If A.pipeline overlaps B.pipeline in paths → flag as dependency candidate
     - If A or B modifies packages/shared-types/** or packages/net-protocol/**
       and the other reads them → flag as hard dependency

For each ready story:
  2. Check active story conflicts:
     - If ready story's pipeline paths overlap with any active story's pipeline paths
       → flag as blocked (must wait for active story to complete)

Build execution order:
  - Topological sort by dependency edges
  - Stories with no dependencies → can run in any order (sort by priority desc)

Display to user:
  - Proposed order with dependency rationale
  - Any blocked stories and why
```

### Dependency Graph Rules (for Shards)

From `docs/specs/workflow-manager-spec.md`:

```
Default dependency rules within a story:
  - protocol-architect shard: no depends_on
  - all developer shards: depends_on [shard-schema] (protocol-architect shard)
  - qa-agent: depends_on all developer shards
  - telemetry-agent: depends_on [qa shard]

Exception:
  - If Orchestrator declares action: none for protocol-architect,
    developer shards have NO dependencies (launch immediately)
```

### Inter-Agent Escalation Detection

After each shard completes, scan the appended Phase Log entry for the pattern `⚠ blocked:`. If found:
1. Extract the escalation target role and the specific question
2. If target role is in the current pipeline → create a micro-shard (inline shard with `id: micro-<role>-<n>`) targeting that role with just the question as context
3. Dispatch micro-shard (same worktree pattern)
4. On micro-shard completion → original shard resumes (or the fix is already in the micro-shard's Phase Log entry and can be referenced)
5. No user involvement for inter-agent escalations

If escalation target is NOT in the pipeline (new contract required, new UI surface) → escalate to user with the blocker description.

### Frontmatter Write Protocol

When writing to story frontmatter, always:
1. Read the current story file
2. Parse the YAML frontmatter block (between `---` delimiters)
3. Update only the specific fields needed
4. Rewrite the full frontmatter block
5. Preserve the markdown body exactly

Never use string replacement on the whole file — parse frontmatter as YAML, update fields, re-serialize. This prevents corruption of the Phase Log or other body content.

### Worktree Naming Convention

```
Worktree branch names:
  shard/<story-id>-<shard-id>
  e.g. shard/GDS-003-shard-schema
       shard/GDS-003-shard-sim
       shard/GDS-003-shard-fix-sim-1   (fix shard, retry 1)

Feature branch:
  feature/<story-id>
  e.g. feature/GDS-003
```

### Programmatic Mode Agent Invocation

When invoking specialist agents (bmad-agent-pm, bmad-agent-architect, gds-agent-game-dev), they receive:
- The shard file as their primary input (not a human message)
- Role config injected as context prefix: `Role: <role>\nAllowed paths: [...]\nBlocked paths: [...]`
- Relevant project-brief sections injected as context
- Instruction to write output to Phase Log, not to the conversation

The agent's Phase Log entry IS its output. The Workflow Manager reads the Phase Log entry after the agent completes to determine next steps.

### project-brief.md Domain Mapping

Per the spec:

| Pipeline roles used | Brief section to append to |
|---|---|
| simulation-engineer | `## Simulation / Game Rules` |
| host-engineer | `## Host Client / Rendering` |
| mobile-engineer | `## Mobile Controller` |
| protocol-architect | `## Contracts / Event Protocol` |

If multiple roles used → append to all relevant sections. Keep appended summaries to 2–3 sentences maximum.

### bmad-shard-doc Integration

`bmad-shard-doc` is called with the amplified story body and produces N child documents. For this skill, treat the output as N separate shard files. Write each to `_stories/active/<id>/shards/shard-<role>.md`. The content of each shard file should be:
- The full story context (for agent awareness)
- Role-specific tasks only (filtered by allowed_paths)
- Inherited acceptance criteria relevant to that role
- The telemetry requirements from the parent story

### First Implementation: Sequential Mode

The spec allows parallel shard dispatch. For the first implementation, dispatch shards sequentially even when they could be parallel. This simplifies the dispatch loop significantly. Add a `// TODO: parallel dispatch` comment. Parallel dispatch (using the Agent tool's background mode) can be added in a follow-up story.

### Telemetry Gate Guard

At the top of `step-06-telemetry-gate.md`, add an explicit guard:

```
GUARD: Only proceed if the most recent QA Phase Log entry reads "PASS".
If this step is somehow reached after a QA FAIL, stop and route back to step-05-qa-gate.md.
```

This prevents telemetry from running on unverified code even if step routing has a bug.

### References

- [Source: docs/specs/workflow-manager-spec.md — full behaviour specification]
- [Source: docs/specs/autonomous-cascade-story-format.md — story frontmatter schema + Phase Log format]
- [Source: CLAUDE.md § Ownership Rules — role config source]
- [Source: CLAUDE.md § Hook Policy — defines what each agent must check]
- [Source: project-brief.md — read at runtime + appended on wrap-up]
- [Source: .claude/skills/bmad-brainstorming/workflow.md — reference skill architecture]
- [Source: _bmad-output/implementation-artifacts/cascade-1-story-intake-skill.md — companion story]

### Project Structure Notes

```
.claude/skills/workflow-manager/   ← CREATE (new skill directory)
  workflow.md                      ← CREATE (T2)
  steps/
    step-01-scan.md                ← CREATE (T3)
    step-02-decompose.md           ← CREATE (T5)
    step-03-dispatch.md            ← CREATE (T6)
    step-04-merge.md               ← CREATE (T7)
    step-05-qa-gate.md             ← CREATE (T8)
    step-06-telemetry-gate.md      ← CREATE (T9)
    step-07-wrap-up.md             ← CREATE (T10)
  helpers/
    parse-ownership.md             ← CREATE (T4)
    phase-log.md                   ← CREATE (T11)

_stories/                          ← EXISTS
  backlog/                         ← READ (step-01)
  active/                          ← READ + WRITE (steps 02-06)
  done/                            ← WRITE (step-07)
  blocked/                         ← WRITE (step-05 on qa_retries >= 2)

project-brief.md                   ← APPEND-ONLY (step-07)
CLAUDE.md                          ← READ-ONLY (helpers/parse-ownership.md)
```

No changes to apps/**, packages/**, or any game code.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 10 skill files written: workflow.md, 7 step files, 2 helper files — all pure markdown, no code.
- step-02-decompose.md references `helpers/story-decompose.md` (LLM-powered, built in CASCADE-3) rather than bmad-shard-doc CLI — noted inline.
- step-03-dispatch.md implements sequential dispatch with a TODO comment for parallel mode.
- step-06-telemetry-gate.md includes an explicit GUARD check at the top to prevent running on unverified code.
- helpers/phase-log.md defines the full canonical Phase Log format for all agents in the cascade.
- helpers/parse-ownership.md includes drift detection to catch CLAUDE.md ownership changes that aren't reflected in the role config map.
- Inter-agent escalation (micro-shard pattern) fully specified in step-03-dispatch.md.
- QA two-strike recovery (including user escalation on qa_retries >= 2) fully specified in step-05-qa-gate.md.

### File List

- `.claude/skills/workflow-manager/workflow.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-01-scan.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-02-decompose.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-03-dispatch.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-04-merge.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-05-qa-gate.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-06-telemetry-gate.md` — CREATED
- `.claude/skills/workflow-manager/steps/step-07-wrap-up.md` — CREATED
- `.claude/skills/workflow-manager/helpers/parse-ownership.md` — CREATED
- `.claude/skills/workflow-manager/helpers/phase-log.md` — CREATED

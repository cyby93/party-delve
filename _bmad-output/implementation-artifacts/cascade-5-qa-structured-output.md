# Story CASCADE-5: `bmad-qa-generate-e2e-tests` Structured Output Adaptation

Status: done
baseline_commit: 218d65e16f6adcfab1853c897af8d9f919b4096b

---

## CLAUDE.md Required Task Header

```
Phase: Cascade Infrastructure — Agent Adaptation
Context: The Workflow Manager (CASCADE-2 step-05-qa-gate.md) invokes
  bmad-qa-generate-e2e-tests and parses its result as a structured YAML block
  (status: pass|fail, passed: N, failed: N, failures: [...]).
  The current bmad-qa-generate-e2e-tests skill generates test files interactively
  with no structured pass/fail output. This story adds a CASCADE QA MODE that the
  Workflow Manager activates, which runs existing tests (rather than generating new
  ones), parses results, and emits the structured YAML the Workflow Manager expects.
Owner agent: QA + Telemetry Engineer (owns tests/**, tools/**)
Goal: Add a cascade-qa-mode.md to bmad-qa-generate-e2e-tests that (1) runs the existing
  test suite against the merged feature branch, (2) checks acceptance criteria coverage,
  (3) emits a structured YAML result block the Workflow Manager can parse, and (4) appends
  a Phase Log entry to the parent story.
Allowed paths:
  - .claude/skills/bmad-qa-generate-e2e-tests/** (add cascade-qa-mode.md only)
  - tests/** (may generate missing contract tests if ACs require them)
Blocked paths:
  - apps/**
  - packages/** (read-only — tests reference but don't modify)
  - .claude/skills/bmad-qa-generate-e2e-tests/SKILL.md (read-only)
Inputs:
  - docs/specs/workflow-manager-spec.md § QA Gate — structured result format (REQUIRED)
  - docs/specs/autonomous-cascade-story-format.md § QA Recovery Protocol (REQUIRED)
  - .claude/skills/bmad-qa-generate-e2e-tests/SKILL.md — existing skill (read-only)
Non-goals:
  - Changing bmad-qa-generate-e2e-tests default interactive behaviour
  - Running performance tests or load tests
  - Generating a full new test suite from scratch (only fills gaps for uncovered ACs)
  - Visual regression testing
Acceptance criteria: see AC section below
Required hooks: none
Required tests: manual smoke test against story GDS-002 or equivalent
Telemetry impact: none
```

---

## Story

As the Workflow Manager's QA gate step,
I want to invoke `bmad-qa-generate-e2e-tests` in cascade mode with a merged branch and
story acceptance criteria, and receive a structured YAML result I can parse to determine
pass/fail and route the recovery loop,
so that QA failures are automatically triaged and routed without manual intervention.

---

## Acceptance Criteria

1. When invoked with `--cascade <parent-story-path>` argument, the skill runs in cascade QA mode (not interactive mode).
2. In cascade QA mode, the skill: (a) reads the parent story's `## Acceptance Criteria` section, (b) runs `pnpm test` and `pnpm typecheck` on the merged feature branch, (c) checks that each AC has at least one test covering it (via keyword match or explicit test label).
3. The skill emits a structured YAML result block to the Phase Log:
   ```yaml
   ### QA Agent — <datetime>
   status: pass | fail
   passed: N
   failed: N
   failures:
     - test: "<test name or AC text>"
       reason: "<failure reason>"
       responsible_shard: "<shard-id>"
       responsible_role: "<role>"
   ```
4. On pass: `status: pass`, `failures: []`, Phase Log entry written, Workflow Manager continues.
5. On fail: `status: fail`, each failure entry includes `responsible_shard` and `responsible_role` determined by which shard's `allowed_paths` contains the failing code.
6. If an AC has no test coverage, the skill generates a minimal contract test for it in `tests/` before running — it does not fail the story for missing coverage, it fills the gap.
7. The Phase Log entry is appended to `## Phase Log` in the parent story file (same append-only protocol as CASCADE-4).

---

## Tasks / Subtasks

- [x] **T1 — Create `cascade-qa-mode.md`** (AC: 1–7)
  - [ ] Define mode activation: invoked when Workflow Manager passes `--cascade <parent-story-path>`
  - [ ] Define execution sequence:
    1. Read parent story file: extract `## Acceptance Criteria`, shard list from frontmatter
    2. Build AC coverage map: for each AC, search `tests/` for matching test (keyword match on AC text)
    3. For uncovered ACs: generate a minimal contract test in `tests/cascade/` — do not fail on coverage gaps, fill them
    4. Run `pnpm typecheck` — capture output
    5. Run `pnpm test` — capture output (pass/fail counts, failing test names)
    6. Parse results:
       - Extract failing test names from test runner output
       - For each failure, determine responsible shard by matching failing file path against shard `allowed_paths` in parent story frontmatter
       - If no shard match found, responsible_shard = "unknown", responsible_role = "unknown"
    7. Build structured result YAML
    8. Append Phase Log entry to parent story
  - [ ] Define responsible shard determination:
    - Read parent story frontmatter `shards` list
    - For each failure, get the file path from the test runner output
    - Match file path against each shard's `allowed_paths`
    - First match = responsible shard
  - [ ] Define Phase Log write: append-only, same protocol as CASCADE-4

- [x] **T2 — Add cascade mode comment to SKILL.md** (AC: 1)
  - [x] Add 4-line comment block at top of SKILL.md:
    ```
    ## Cascade QA Mode
    When invoked by the Workflow Manager with --cascade <path>, load cascade-qa-mode.md
    instead of the standard activation sequence.
    ```

---

## Dev Notes

### Test Runner Output Parsing

The project uses `pnpm test` (Vitest or Jest). Capture output and look for:
- `PASS` / `FAIL` lines per test file
- Individual failing test names in the format `✗ <test name>` or `× <test name>`
- File paths associated with failures (usually shown in the stack trace line)

Parse conservatively — if output format is ambiguous, mark as `status: fail` with `reason: "test runner output could not be parsed"` rather than falsely reporting pass.

### AC-to-Test Keyword Matching

For each AC like "Mobile joystick sends `MoveInputEvent` on every frame tick", search for:
- The event/type name: `MoveInputEvent`
- Key action verbs: `sends`, `joystick`
- In test files: `tests/**/*.test.ts` and `tests/**/*.spec.ts`

A match is found if any test file contains both the type name and at least one action keyword from the AC. This is a heuristic — good enough to catch obviously uncovered ACs.

### Minimal Contract Test Generation

When generating a contract test for an uncovered AC, write to `tests/cascade/<story-id>-ac-<N>.test.ts`. Keep it minimal — a smoke test that the relevant event type exists and has the right shape is sufficient. Do not write complex e2e tests here.

Example for AC "MoveInputEvent has sequenceNumber field":
```typescript
import { MoveInputEvent } from '@party-delve/shared-types';
test('MoveInputEvent has sequenceNumber', () => {
  const event: MoveInputEvent = { playerId: 'p1', sequenceNumber: 1, direction: { x: 0, y: 0 }, timestamp: 0 };
  expect(event.sequenceNumber).toBeDefined();
});
```

### Phase Log Append Protocol

Same as CASCADE-4 — read `## Phase Log`, append below last entry, never overwrite. The QA entry uses YAML-like format inline in the markdown (not a fenced code block) so the Workflow Manager can regex-parse `status:` directly from the Phase Log section.

### References

- [Source: docs/specs/workflow-manager-spec.md § QA Gate]
- [Source: docs/specs/workflow-manager-spec.md § QA Recovery Protocol]
- [Source: docs/specs/autonomous-cascade-story-format.md § Story Body Structure — Phase Log format]
- [Source: .claude/skills/bmad-qa-generate-e2e-tests/SKILL.md — existing skill (read-only)]

### Project Structure Notes

```
.claude/skills/bmad-qa-generate-e2e-tests/
  SKILL.md                 ← MINOR UPDATE (T2 — 4-line comment only)
  cascade-qa-mode.md       ← CREATE (T1)
  [all existing files]     ← NO CHANGES

tests/
  cascade/                 ← MAY CREATE (generated contract tests for uncovered ACs)
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- cascade-qa-mode.md written as pure markdown; no changes to default interactive behaviour.
- AC coverage uses keyword matching (type name + action verb) — conservative heuristic per the spec.
- Coverage gap tests written to `tests/cascade/{story_id}-ac-{N}.test.ts` before running the suite.
- Structured YAML result written inline in Phase Log (not fenced) so Workflow Manager can regex-parse `status:`.
- Responsible shard determined by matching failing file paths against shard `allowed_paths`.

### File List

- `.claude/skills/bmad-qa-generate-e2e-tests/cascade-qa-mode.md` — CREATED
- `.claude/skills/bmad-qa-generate-e2e-tests/SKILL.md` — MINOR UPDATE (4-line cascade mode comment prepended)

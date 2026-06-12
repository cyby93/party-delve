# Cascade QA Mode

## Activation

This mode activates when the Workflow Manager invokes `bmad-qa-generate-e2e-tests` with a `--cascade <parent-story-path>` argument.

**Do not use this mode when invoked directly by a user.** Normal invocation uses the standard interactive activation sequence from SKILL.md.

---

## Instructions

### 1. Read Parent Story

Read the story file at `<parent-story-path>`. Extract:
- `## Acceptance Criteria` → `story_acs` (list of verifiable conditions)
- Frontmatter `shards` list → `story_shards` (for responsible shard mapping)
- Frontmatter `id` → `story_id`

### 2. Build AC Coverage Map

For each acceptance criterion in `story_acs`:

Extract the key keywords:
- Type/class names mentioned (e.g. `MoveInputEvent`, `SimulationState`)
- Action verbs (e.g. `sends`, `dispatches`, `validates`, `returns`)
- Domain terms (e.g. `joystick`, `reconnect`, `combat`)

Search `tests/**/*.test.ts`, `tests/**/*.spec.ts`, and `tests/**/*.test.tsx` for files containing:
- The type/class name AND at least one action keyword from the AC

**If match found:** AC is covered.
**If no match found:** AC is uncovered — generate a minimal contract test (see step 3).

### 3. Fill Coverage Gaps

For each uncovered AC, generate a minimal contract test in `tests/cascade/`:

**Filename:** `tests/cascade/{story_id}-ac-{N}.test.ts` (N = AC index, 1-based)

**Content:** A minimal smoke test that the relevant type/event/state exists and has the right shape. Do not write complex behaviour tests here.

Example for AC "MoveInputEvent has a sequenceNumber field":
```typescript
import { MoveInputEvent } from '@party-delve/shared-types';

test('{story_id} AC-{N}: MoveInputEvent has sequenceNumber', () => {
  const event: MoveInputEvent = {
    playerId: 'p1',
    sequenceNumber: 1,
    direction: { x: 0, y: 0 },
    timestamp: 0,
  };
  expect(event.sequenceNumber).toBeDefined();
});
```

Write the generated test files before running the test suite.

### 4. Run Tests

Run in sequence:
1. `pnpm typecheck` — capture full output
2. `pnpm test` — capture full output (pass/fail counts, failing test names)

Parse test runner output conservatively:
- Look for `PASS` / `FAIL` per file
- Look for failing test names in format `✗ <name>`, `× <name>`, or `● <name>`
- Look for file paths in stack traces to identify which file the failure comes from

**If output cannot be parsed reliably:** treat as `status: fail` with `reason: "test runner output could not be parsed"`.

### 5. Determine Responsible Shard

For each failing test:
1. Extract the file path from the test runner output (from the stack trace or file header)
2. For each shard in `story_shards`: check if the failing file path falls within the shard's `allowed_paths`
3. First match → `responsible_shard: {shard_id}`, `responsible_role: {owner}`
4. No match → `responsible_shard: "unknown"`, `responsible_role: "unknown"`

### 6. Build Structured Result

Assemble the structured result:

```yaml
status: pass | fail
passed: N
failed: N
failures:
  - test: "<test name or AC description>"
    reason: "<failure reason from test output>"
    responsible_shard: "<shard-id or 'unknown'>"
    responsible_role: "<role or 'unknown'>"
```

**If `failed == 0`:** `status: pass`, `failures: []`
**If `failed > 0`:** `status: fail`, populate `failures` list

### 7. Append Phase Log Entry

Append to `## Phase Log` in the parent story file.

**On pass:**
```
### QA Agent — {ISO datetime}
PASS. {N}/{N} tests green.
```

**On fail:**
```
### QA Agent — {ISO datetime}
FAIL — {failed}/{total} tests failed.
Failing: {comma-separated test names}

status: fail
passed: {N}
failed: {N}
failures:
  - test: "{test name}"
    reason: "{reason}"
    responsible_shard: "{shard-id}"
    responsible_role: "{role}"
```

**Append-only protocol:** same as all other cascade agents — read the file, find `## Phase Log`, append below last entry (or replace placeholder), write file back.

Note: the structured YAML is written inline in the Phase Log (not in a fenced code block) so the Workflow Manager can regex-parse `status:` directly.

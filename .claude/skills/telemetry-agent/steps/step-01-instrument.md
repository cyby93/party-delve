# Step 01 — Event Instrumentation

## Purpose

Read the story's declared telemetry events, check what already exists in `packages/telemetry/src/`, create or update event types as needed, and verify typecheck passes.

---

## Instructions

### 1. Read Story Telemetry Section

Read `{parent_story_path}`. Extract the `## Telemetry` section.

**If the section reads exactly `No new telemetry events required.`:**
- Route directly to: `./step-02-phase-log.md` with `events_instrumented: []`, `events_skipped: []`, `events_updated: []`

**Otherwise:** parse each event declaration. Expected format:
```
- event: `domain.action_name`
  trigger: [description of when this fires]
  payload: { field1, field2, field3 }
```

Store as `declared_events` list.

### 2. Read Existing Telemetry Implementation

Read `packages/telemetry/src/` in full. Understand:
- How events are currently defined (interfaces, type aliases, enum keys, or a registry object)
- The main event registry file (likely `events.ts`, `telemetry.ts`, or similar)
- Current naming convention (`session.player_joined` style — `domain.action` snake_case)
- Current payload patterns

Store the registry file path as `registry_file`.

### 3. Process Each Declared Event

For each event in `declared_events`:

#### 3a. Normalise event name

If the declared name doesn't follow `domain.action` snake_case format, normalise it:
- `combatHit` → `combat.hit`
- `PlayerJoined` → `session.player_joined`

Note any normalisations for the Phase Log.

#### 3b. Infer payload field types

For each field in the payload, infer its TypeScript type:

| Field name pattern | TypeScript type |
|---|---|
| `*_id`, `id` | `string` |
| `timestamp`, `*_at` | `number` |
| `damage`, `heal`, `amount`, `count`, `hp`, `*_count`, `*_ms` | `number` |
| `position`, `direction` | `{ x: number; y: number }` |
| `mode`, `state`, `phase`, `status` | `string` |
| `*_enabled`, `is_*` | `boolean` |
| anything else | `unknown` (flag in Phase Log) |

#### 3c. Check if event already exists

Search `registry_file` for the normalised event name:

**If exists and payload matches:** → skip (no change). Add to `events_skipped`.

**If exists but payload differs:** → update the type definition. Add to `events_updated`.

**If does not exist:** → add new typed export. Add to `events_instrumented`.

#### 3d. Create / update the event type

Follow the existing pattern in `registry_file` exactly. Examples based on likely existing patterns:

```typescript
// Interface pattern:
export interface CombatHitEvent {
  player_id: string;
  target_id: string;
  damage: number;
  ability_id: string;
}

// Type alias pattern:
export type CombatHitEvent = {
  player_id: string;
  target_id: string;
  damage: number;
  ability_id: string;
};
```

Use whatever pattern the existing file already uses. Do not mix styles.

### 4. Write Changes to Registry File

Write all new/updated event types to `{registry_file}`. Preserve all existing content — only add or modify the specific types.

### 5. Run Typecheck

Run: `pnpm typecheck --filter packages/telemetry`

**If typecheck fails:** fix the errors before proceeding. Do not route to step-02 until typecheck passes.

### 6. Run Tests (if they exist)

Check if `packages/telemetry` has a test script: look for `"test"` in `packages/telemetry/package.json` scripts.

**If tests exist:** run `pnpm test --filter packages/telemetry`. Fix any failures before proceeding.

**If no tests exist:** skip this step.

### 7. Check KPI Mapping

Read `docs/specs/telemetry-spec.md` KPI section. For each newly instrumented event, check if it appears in the KPI mapping.

**If an event is NOT mapped to a KPI:** note in Phase Log:
```
Event `{event_name}` not yet mapped to a KPI — update docs/specs/telemetry-spec.md required.
```
Do NOT modify `docs/specs/telemetry-spec.md` (read-only for this agent).

### 8. Route

Proceed to: `./step-02-phase-log.md`

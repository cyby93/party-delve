---
baseline_commit: f6b5db7
---

# Story 3.21a: Body/Spirit Position Schema & Protocol Contract

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / Epic 3 Correction (Downed Player Body/Spirit Entity
  Split — first of a 3.21a → 3.21b → 3.21c sequence, same shared-capability
  sequencing pattern as 3.11→3.16. Scoped from the 2026-07-14 correct-course
  review of TODO.md, not new PRD/GDD FRs.)

Context: Today `PlayerState` tracks a single `x`/`y`. While `isDown`, that
  position is frozen (Story 3.6). Once `isSpirit` becomes true (timer
  expiry), the SAME `x`/`y` starts moving under the player's own input —
  there is no separate "where the body fell" position once the spirit
  wanders off, so a teammate walking toward "the downed player" is actually
  walking toward the moving spirit, not the revive target. This story adds
  the missing field (schema only) so 3.21b can fix the actual movement/
  revive-targeting logic and 3.21c can render the two entities separately.

  This is a schema-and-contract-only story — no simulation behavior changes.
  `apps/simulation-server/**` and `packages/game-rules/**` are explicitly
  blocked paths; 3.21b owns making the sim actually populate/consume these
  fields. That constraint has one direct consequence worth calling out
  before writing any code:

  **`bodyX`/`bodyY` must be OPTIONAL fields, not required, on both
  `PlayerState` and `PlayerDownedDelta`.** `PlayerState` is constructed as a
  single object literal in `apps/simulation-server/src/rooms/GameRoom.ts`'s
  `createPlayer()` factory (~line 79), and `PlayerDownedDelta` is
  constructed inline as a literal at 4 separate call sites in the same file
  (melee damage, boss stomp, ability/Dark Pact drain, Fate Bond wipe
  cascade) — none of which this story is allowed to touch. If either field
  were added as a required (non-optional) property, TypeScript would fail
  the monorepo-wide `npm run typecheck` at all 5 of those object-literal
  sites the moment this story's schema change lands, blocking this story
  from ever reaching a green `typecheck` on its own — which would force
  scope creep into `apps/simulation-server/**` (blocked) just to keep the
  build green. Making the fields optional (`bodyX?: number; bodyY?:
  number;`) sidesteps this entirely: TypeScript does not require optional
  properties to be present in an object literal, so none of those 5
  existing call sites need to change. 3.21b will actually populate real
  values at all 4 down-transition call sites plus the `createPlayer`
  factory; it may choose to tighten the fields to required once it does,
  but that tightening is 3.21b's call, not mandated here.

  This is the same contract-first, additive-extension pattern this whole
  batch already uses repeatedly (e.g. Story 3.19/3.20 extending
  `ABILITY_DELIVERY`'s union rather than rewriting existing entries) —
  ship the contract as a strict superset first, let the next story consume
  it, no simultaneous multi-package rewrite.

Owner agent: Protocol Architect (single ownership area — no cross-context
  approval needed)

Goal:
  Task 1 — Extend `PlayerState` with optional `bodyX`/`bodyY`.
  Task 2 — Extend `PlayerDownedDelta`'s payload with optional `bodyX`/
            `bodyY`; update `apply-delta.ts`'s `'player:downed'` case to
            propagate them onto the mirrored host state (falling back to
            the player's current `x`/`y` if the delta doesn't carry them
            yet, so mixed pre-3.21b/post-3.21a traffic degrades gracefully
            instead of leaving the mirror's `bodyX`/`bodyY` undefined).
  Task 3 — Add round-trip contract test(s) for the extended
            `PlayerDownedDelta` shape and an `apply-delta` test for the
            new field propagation (including the no-bodyX-in-delta
            fallback case).
  Task 4 — Write `docs/adr/ADR-0002-body-spirit-position-split.md`
            recording the body/spirit split decision (Status/Context/
            Decision/Rationale/Consequences, same format as
            `ADR-0001-hybrid-authority.md`).

Allowed paths:
  - packages/shared-types/src/player.ts
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - tests/contract/net-protocol.test.ts
  - docs/adr/ADR-0002-body-spirit-position-split.md (new)

Blocked paths:
  - apps/simulation-server/** (Simulation Engineer's 3.21b — actually
    setting/consuming bodyX/bodyY at down-time and in revive proximity)
  - apps/host-client/** (Host Experience Engineer's 3.21c — rendering the
    two entities)
  - packages/game-rules/** (3.21b)
  - Any other class/ability/system not part of this schema change

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.21a" section
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-14.md,
    "New Story 3.21" section
  - packages/shared-types/src/player.ts (current `PlayerState`)
  - packages/net-protocol/src/messages/server-to-host.ts (current
    `PlayerDownedDelta`, `PlayerReviveDelta`)
  - packages/net-protocol/src/apply-delta.ts (current `'player:downed'`,
    `'player:revived'`, `'player:spirit'` cases)
  - apps/simulation-server/src/rooms/GameRoom.ts:79 (`createPlayer` — read
    for context only, confirms why the new fields must be optional; do not
    modify)
  - docs/adr/ADR-0001-hybrid-authority.md (format to follow for the new ADR)

Non-goals:
  - Do not modify `apps/simulation-server/**` or `apps/host-client/**` —
    the fields exist in the schema/wire contract only after this story;
    nothing populates real (non-fallback) values until 3.21b.
  - Do not add `bodyX`/`bodyY` to `PlayerReviveDelta` or `PlayerMovedDelta`
    — the revive delta doesn't need a body position (the player is no
    longer down), and moved-delta is spirit/alive movement, unrelated to
    the frozen body position.
  - Do not change `PlayerState.x`/`y` semantics — they remain the single
    source of truth for the player's controllable position, exactly as
    epics.md's AC1 states.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — `packages/shared-types/**` and
    `packages/net-protocol/**` both change. Requires: Protocol Architect
    review (this story's own owner role), compatibility checklist (see
    Dev Notes — additive/optional-only, backward compatible), ADR update
    (Task 4), at least one contract test (Task 3).
  - Ownership hook: single ownership area (Protocol Architect only) — no
    split/cross-context approval needed.
  - Simulation-safety hook: NOT triggered — no `apps/simulation-server/**`
    or `packages/game-rules/**` changes in this story.

Required tests:
  - tests/contract/net-protocol.test.ts — `PlayerDownedDelta` round-trip
    with `bodyX`/`bodyY` present; `apply-delta`'s `'player:downed'` case
    sets `bodyX`/`bodyY` on the mirrored player when the delta carries
    them, and falls back to the player's current `x`/`y` when it doesn't
    (simulating a not-yet-updated sim server).

Telemetry impact: None.
```

---

## Story

As a Protocol Architect,
I want `PlayerState` and its wire deltas to carry a fixed body position alongside the existing (now spirit-only) position,
so that downstream simulation and rendering work has a stable contract to build on.

---

## Acceptance Criteria

**AC1 — `PlayerState` schema extension:**
**Given** `packages/shared-types/src/player.ts` `PlayerState`
**When** the schema is extended
**Then** it gains `bodyX?: number` and `bodyY?: number` (optional — see Context for why not required), intended to be set once when `isDown` first becomes `true` and left unchanged until the player is revived
**And** the existing `x`/`y` fields remain the single source of truth for the player's controllable position (body while down-and-not-yet-spirit, spirit once `isSpirit` is true)

**AC2 — Delta contract extension:**
**Given** `packages/net-protocol` delta messages for `player:downed` and `player:revived`
**When** the schema change lands
**Then** `player:downed` (`PlayerDownedDelta`) includes optional `bodyX`/`bodyY` in its payload, `apply-delta.ts`'s `'player:downed'` case propagates them onto the mirrored player state (falling back to the player's current `x`/`y` if absent), and both `player:downed` and `player:revived` have a serialize→deserialize round-trip contract test in `tests/contract/net-protocol.test.ts`

**AC3 — Contract-change hook satisfied:**
**Given** this is a contract-change per CLAUDE.md
**When** the change is proposed
**Then** it is reviewed by the Protocol Architect and `docs/adr/ADR-0002-body-spirit-position-split.md` is written to record the body/spirit split decision

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `packages/shared-types/src/player.ts`: add
  `bodyX?: number;` and `bodyY?: number;` to the `PlayerState` interface,
  placed next to the existing `x`/`y` fields. Add a one-line comment
  explaining the optional-not-required rationale (cross-story compile
  compatibility with `apps/simulation-server`'s existing object literals —
  see this story's Context) so a future reader doesn't "fix" it to
  required without knowing why.

- [x] **Task 2a** (AC: #2) — `packages/net-protocol/src/messages/
  server-to-host.ts`: add `bodyX?: number;` and `bodyY?: number;` to
  `PlayerDownedDelta`'s payload.

- [x] **Task 2b** (AC: #2) — `packages/net-protocol/src/apply-delta.ts`:
  in the `'player:downed'` case, extend the returned player object to
  include `bodyX: evt.bodyX ?? p.x, bodyY: evt.bodyY ?? p.y` alongside the
  existing `isDown`/`downCount`/`reviveTimerExpiresAt` fields.

- [x] Write contract round-trip tests in `tests/contract/net-protocol.test.ts`
  per AC2: `PlayerDownedDelta` with `bodyX`/`bodyY` present survives
  serialize→deserialize; `apply-delta`'s `'player:downed'` case sets
  `bodyX`/`bodyY` on the mirrored player from the delta when present, and
  falls back to the player's current `x`/`y` when the delta omits them
  (simulating pre-3.21b sim-server traffic).

- [x] **Task 4** (AC: #3) — Write `docs/adr/ADR-0002-body-spirit-position-split.md`
  following `ADR-0001-hybrid-authority.md`'s format (Status/Context/
  Decision/Rationale/Consequences). Record: the problem (single `x`/`y`
  can't represent both a frozen body and a moving spirit), the decision
  (add optional `bodyX`/`bodyY`, sequenced across 3.21a/b/c), and the
  optional-vs-required rationale from this story's Context.

- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.
  (Confirms the optional-field choice actually keeps `apps/simulation-server`
  green without this story touching it.)

### Review Findings

- [x] [Review][Patch] `apply-delta.ts`'s `bodyX`/`bodyY` fallback isn't
  atomic — a delta carrying only one of the two axes (e.g. `bodyX` present,
  `bodyY` omitted) mixes a fresh coordinate with a stale one instead of
  falling back on both together. **Fixed:** both fields now fall back
  together, gated on `evt.bodyX !== undefined && evt.bodyY !== undefined`
  checked inline per-field (hoisting the check into a shared boolean broke
  TypeScript's `exactOptionalPropertyTypes` narrowing — fixed during
  typecheck verification).
- [x] [Review][Patch] AC2 requires a `player:revived` serialize→deserialize
  round-trip contract test in `tests/contract/net-protocol.test.ts` — only
  `player:downed`'s was added; `player:revived`'s is missing. **Fixed:**
  added.
- [x] [Review][Patch] Test coverage is happy-path only: missing a test that
  a `player:downed` delta for one player leaves a *different* player's
  `bodyX`/`bodyY` untouched, and missing a test that `bodyX`/`bodyY` are
  `undefined` by default for a never-downed player. **Fixed:** both added,
  plus a test for the atomic-fallback fix above.
- [x] [Review][Patch] `docs/adr/ADR-0002-body-spirit-position-split.md` was
  created with the executable bit set (mode `100755`) — a markdown file
  has no reason to be executable. **Fixed:** re-staged with `git
  update-index --chmod=-x` (plain `chmod` has no effect on this repo's
  `/mnt/c/...` WSL/NTFS mount — confirmed every file, including
  pre-existing ones like `player.ts`, reports `777` via `ls -l`
  regardless of actual intent; the git index is the only place the mode
  is meaningfully recorded).
- [x] [Review][Defer] Stale/duplicate `player:downed` delta re-application
  isn't guarded against overwriting an already-set `bodyX`/`bodyY` —
  deferred, confirmed not reachable from the current sim-server emit site
  (`GameRoom.ts` only fires `player:downed` once per down-transition;
  damage is skipped entirely for already-`isDown` players) and out of
  scope for this schema-only story regardless (`apps/simulation-server`
  is a blocked path here). Revisit if a future story adds retry/duplicate
  delta delivery.
- [x] [Review][Defer] Version-skew window between sim-server and
  host-client deployments (a host running before 3.21b vs a sim already
  running it, or vice versa) is disclosed in the ADR's Consequences but
  not mitigated with a capability flag — deferred: this project's current
  deployment model is a single local host+sim process pair (Local Party
  Mode), not a fleet with independent rolling upgrades, so the skew window
  in practice is "one dev's local session," not a production concern.
  Revisit if Phase 5's cloud/online mode introduces independently
  deployable host/sim versions.

---

## Dev Notes

### Why optional, not required — read before changing this

See the Required Task Header's Context section in full. Short version:
`PlayerState` and `PlayerDownedDelta` are each constructed as raw object
literals at multiple call sites inside `apps/simulation-server/src/rooms/
GameRoom.ts` — a file this story is not allowed to touch. A required new
field would fail `npm run typecheck` on those literals immediately, forcing
either scope creep into a blocked path or a broken build. Optional fields
avoid both. Do not "clean this up" to required without also updating
`GameRoom.ts`'s `createPlayer()` factory and all 4 `player:downed`-emitting
call sites — that update is explicitly 3.21b's job, not this story's.

### Compatibility checklist (Contract-change hook)

- Additive only: new optional fields on two existing types, no existing
  field removed, renamed, or changed type.
- Backward compatible: any client/server built before this change ignores
  the new fields; any built after tolerates their absence (`?? p.x`
  fallback in `apply-delta.ts`).
- No changes to `player:revived`, `player:spirit`, or any other delta type.

### `apply-delta.ts`'s existing `'player:downed'` case (read before editing)

```ts
case 'player:downed': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId
        ? { ...p, isDown: true, downCount: evt.downCount, reviveTimerExpiresAt: Date.now() + evt.reviveWindowMs }
        : p
    ),
  };
}
```

Extend the returned object with `bodyX: evt.bodyX ?? p.x, bodyY: evt.bodyY
?? p.y` — nothing else in this case changes.

### `createPlayer()` in `GameRoom.ts` (read-only reference, do not modify)

```ts
function createPlayer(id: string, displayName: string, slotIndex: number): PlayerState {
  const spawn = SPAWN_POSITIONS[slotIndex] ?? { x: 960, y: 540 };
  return {
    id, displayName, class: null,
    x: spawn.x, y: spawn.y,
    hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SESSION_COLORS[slotIndex % SESSION_COLORS.length] ?? SessionColor.RED,
    downCount: 0, nearPoiId: null, essenceTotal: 0,
    reviveTimerExpiresAt: 0, statusEffects: [], channelingAbility: null,
  };
}
```

This object literal has no `bodyX`/`bodyY` — confirms why the fields must
stay optional for this story to typecheck cleanly on its own. 3.21b will
decide whether/how to initialize them here.

### Project Context Rules

- Package Responsibility Boundaries (project-context.md): `packages/
  shared-types` is TypeScript interfaces/enums/constants only, no runtime
  logic — Task 1 is purely a type change, matches this rule exactly.
- `packages/net-protocol` — serialize/deserialize wrappers, `applyDelta`
  reducer, message type guards; no game rules. Task 2b's `apply-delta.ts`
  change is a pure state-shape propagation, no game-rule decisions.
- Contract-Change Hook (both project-context.md and CLAUDE.md): any change
  to `packages/shared-types/**` or `packages/net-protocol/**` requires
  Protocol Architect review, at least one new/updated contract test, and a
  spec/ADR update if additive. All three satisfied by Tasks 3 and 4.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.21a]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-14.md#New Story 3.21]
- [Source: packages/shared-types/src/player.ts] — current `PlayerState`
- [Source: packages/net-protocol/src/messages/server-to-host.ts] — current `PlayerDownedDelta`
- [Source: packages/net-protocol/src/apply-delta.ts] — current `'player:downed'` case
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:79] — `createPlayer`, read-only reference
- [Source: docs/adr/ADR-0001-hybrid-authority.md] — ADR format to follow

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npm run typecheck` — 0 errors across all 10 project references, including
  `apps/simulation-server/tsconfig.json` — confirms the optional-field choice
  keeps `apps/simulation-server` green without this story touching it, per
  this story's own stated purpose for the final validation task.
- `npx vitest run` (full suite) — 475 passed, 0 failed, 7 skipped (472 passed
  pre-story + 3 new tests added by this story).
- `npm run lint` — clean (no output).

### Completion Notes List

- Task 1: added `bodyX?: number` / `bodyY?: number` to `PlayerState`
  (`packages/shared-types/src/player.ts`), next to `x`/`y`, with a comment
  explaining the optional-not-required rationale.
- Task 2a: added the same two optional fields to `PlayerDownedDelta`
  (`packages/net-protocol/src/messages/server-to-host.ts`).
- Task 2b: `apply-delta.ts`'s `'player:downed'` case now sets `bodyX: evt.bodyX
  ?? p.x, bodyY: evt.bodyY ?? p.y` on the mirrored player — falls back to the
  player's current `x`/`y` when the delta omits the new fields (pre-3.21b
  sim-server traffic degrades gracefully instead of leaving the mirror's
  `bodyX`/`bodyY` `undefined`).
- Tests: added a `Story 3.21a` describe block to
  `tests/contract/net-protocol.test.ts` with its own local `mockPlayer`
  helper (matching this file's existing per-describe-block convention — the
  file has multiple sibling describe blocks, each with an independent
  `mockPlayer`, not a shared one). Three tests: `PlayerDownedDelta` with
  `bodyX`/`bodyY` round-trips; `apply-delta` sets `bodyX`/`bodyY` from the
  delta when present; `apply-delta` falls back to the player's current `x`/`y`
  when the delta omits them.
- Task 4: wrote `docs/adr/ADR-0002-body-spirit-position-split.md` following
  `ADR-0001-hybrid-authority.md`'s Status/Context/Decision/Rationale/
  Consequences format — records the problem, the 3.21a/b/c sequencing
  decision, and the optional-vs-required rationale.
- Verified before finishing: `apps/simulation-server/src/rooms/
  GameRoom.ts`'s `createPlayer()` factory and all `player:downed`-emitting
  object literals still typecheck untouched, confirming the optional-field
  design choice this story's Context section commits to.

**Contract-change hook (CLAUDE.md) — triggered by the `PlayerState`/
`PlayerDownedDelta` schema extension:**
- Protocol Architect review: this story's own owner role; self-reviewed
  during implementation (single-ownership story, no cross-context
  approval required per the story header).
- Compatibility checklist: additive-only (two new optional fields on two
  existing types, nothing removed/renamed/retyped) — backward compatible,
  documented in Dev Notes.
- Spec or ADR update: done — `docs/adr/ADR-0002-body-spirit-position-split.md`.
- At least one contract test: done — 3 tests added (see above).

Confidence: 90% — this is a schema-only story with a narrow, well-verified
scope (confirmed via direct code reads that `createPlayer` and all 4
`player:downed` broadcast sites remain untouched and still typecheck).
The only residual uncertainty is downstream: 3.21b must actually populate
real `bodyX`/`bodyY` values for this schema to have any gameplay effect —
that dependency is documented in this story's References and in 3.21b's
own story file.

### File List

- `packages/shared-types/src/player.ts` — added `bodyX?`/`bodyY?` to `PlayerState`
- `packages/net-protocol/src/messages/server-to-host.ts` — added `bodyX?`/`bodyY?` to `PlayerDownedDelta`
- `packages/net-protocol/src/apply-delta.ts` — `'player:downed'` case propagates `bodyX`/`bodyY` atomically (both-or-neither fallback to `p.x`/`p.y`)
- `tests/contract/net-protocol.test.ts` — added `Story 3.21a` describe block (7 tests: round-trip, delta-present, delta-absent-fallback, partial-delta-atomic-fallback, other-player-untouched, never-downed-undefined, `player:revived` round-trip)
- `docs/adr/ADR-0002-body-spirit-position-split.md` (new; re-staged with `git update-index --chmod=-x` to fix the recorded file mode)

## Change Log

- 2026-07-14: Story implemented — `PlayerState`/`PlayerDownedDelta` gain
  optional `bodyX`/`bodyY`; `apply-delta.ts` propagates them with a
  current-position fallback; ADR-0002 records the decision. Status →
  `review`.
- 2026-07-14: Code review — 4 patches applied (atomic bodyX/bodyY fallback,
  missing `player:revived` round-trip test, two missing edge-case tests,
  ADR file mode). 2 items deferred (stale-delta re-application guard,
  version-skew capability flag — both logged in `deferred-work.md`). 0
  decision_needed. Status → `done`.

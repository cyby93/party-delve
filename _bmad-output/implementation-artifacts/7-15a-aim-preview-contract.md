---
baseline_commit: f5b9748
---

# Story 7.15a: Aim-Preview Contract

Status: review

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. **First in the 7.15
  chain** — 7.15b (sim resolution), 7.15c (host rendering) and 7.15d (mobile
  sending) are each blocked by this story and have no dependency on each other.
  No relationship to Stories 7.14a/7.14b.

Context: Scoped from the 2026-08-03 correct-course review of the user's own
  TODO.md; ADR-0008 (Accepted) is the authoritative decision record and this
  story is its contract half.

  The gap is a genuine *contract* gap, not a rendering gap. `handleAbilityFire`
  (`apps/mobile-controller/src/screens/ControllerScreen.tsx:1151-1174`) sends
  the `ability` input event — carrying `directionX`/`directionY` — only at the
  moment of fire. For `AUTO`/`AIM_CAST` abilities that moment repeats every
  ~33ms while the input is held (`SkillCell`'s `autoIntervalRef`,
  `ControllerScreen.tsx:696-714`), so a live direction stream already exists as
  a side effect of firing. For `RELEASE`-type abilities nothing is sent until
  the thumb lifts (`:742-762`, `:764-783`, `:792-797`). There is currently no
  typed event meaning "aiming, not yet firing", so the host has no honest input
  to render an aim indicator from.

  The six `RELEASE`-type abilities today (`class-definitions.ts`): Stone Wall
  (stonehide[0]), Crimson Lash (souldrinker[1]), Dark Pact (souldrinker[2]),
  Void Pulse (souldrinker[3]), Tempest Hurl (stormcaller[1]), Storm Eye
  (stormcaller[3]). Note this is SIX, not the four the downstream rendering
  story names — the four named abilities are the subset that gets a
  *destination* preview; all six get an aim *direction*.

Owner: Protocol Architect (CLAUDE.md Ownership Rules).

Goal: Add the typed input event and the typed broadcast delta for an
  in-progress aim, additively, with a round-trip contract test — and nothing else.

Allowed paths:
  - packages/shared-types/**
  - packages/net-protocol/**
  - docs/adr/**
  - docs/specs/**
  - tests/contract/**  (the contract test this story's own hook requires)

Blocked paths:
  - apps/simulation-server/**    (that is Story 7.15b)
  - apps/host-client/**          (that is Story 7.15c)
  - apps/mobile-controller/**    (that is Story 7.15d)
  - packages/game-rules/**
  - apps/backend-platform/**

Inputs:
  - docs/adr/ADR-0008-aim-preview-contract.md (Accepted — the Decision section
    fixes both message shapes verbatim; do not deviate from it)
  - packages/shared-types/src/input.ts:1-14 (the `InputEvent` union to extend)
  - packages/net-protocol/src/messages/server-to-host.ts:126-145
    (`AbilityChainHitDelta` — the closest existing sibling: a presentation-only,
    non-mutating delta added by a prior story; mirror its shape and comment style)
  - packages/net-protocol/src/messages/server-to-host.ts (tail) — the
    `DeltaEventMsg` union that must gain the new member
  - packages/net-protocol/src/apply-delta.ts (tail) — the `default:` case has a
    `const _exhaustive: never = evt` guard, so a new union member WITHOUT a
    matching case is a compile error, not a silent fallthrough
  - packages/net-protocol/src/index.ts:5 (the type re-export line)
  - tests/contract/net-protocol.test.ts:1040-1085 (the `ability:chain-hit`
    round-trip + applyDelta-no-op test pair — the exact pattern to copy)
  - docs/adr/ADR-0003-ability-presentation-contract.md (the contract ADR-0008
    extends)

Non-goals:
  - NO server-side computation of `targetX`/`targetY` (Story 7.15b).
  - NO rendering (Story 7.15c).
  - NO mobile-side sending (Story 7.15d).
  - NO new `EventNames` entry. The input rides the existing `EventNames.INPUT`
    envelope as a new `InputEvent` variant; the delta rides the existing
    `EventNames.DELTA` envelope as a new `DeltaEventMsg` member. Adding a
    top-level event name would be a second, redundant transport.
  - NO change to any existing message shape. Additive only.
  - NO `GameState` field. This delta is presentation-only and must never be
    written to persistent state — that is the whole point of the ADR.

Required hooks:
  - **Contract-change hook (TRIGGERED)** — both `packages/shared-types/**` and
    `packages/net-protocol/**` are touched. Required before merge:
      * Protocol Architect review
      * compatibility checklist (see the "Compatibility checklist" Dev Note —
        fill it in verbatim in Completion Notes, do not summarize it)
      * spec or ADR update — ADR-0008 already exists and is Accepted; verify it
        still matches the shipped shapes exactly and record that verification.
        Only amend the ADR if the implementation had to deviate, and say why.
      * at least one contract test (this story ships two — round-trip and
        applyDelta-no-op)
  - Simulation-safety hook: NOT triggered (no sim/game-rules edit).
  - Client-UX hook: NOT triggered (no host/mobile edit).
  - Ownership hook: NOT triggered (single owner).
  - Telemetry hook: no user-facing flow ships in this story; the flow's
    telemetry belongs with 7.15c/7.15d if any is added at all (none planned —
    cosmetic feature, no KPI).

Required tests (tests/contract/net-protocol.test.ts):
  - `ability:aim-preview` round-trips through serialize → deserialize WITH
    `targetX`/`targetY` present.
  - `ability:aim-preview` round-trips WITHOUT `targetX`/`targetY` (they are
    optional — this is the case that catches an accidental required field).
  - `applyDelta` on `ability:aim-preview` returns state unchanged — assert
    referential or deep equality against the pre-delta state, matching the
    `ability:chain-hit` no-op test's own style.
  - `InputEvent`'s `'aim-preview'` variant round-trips inside an `InputEventMsg`
    envelope (the mobile→server direction has no `applyDelta` equivalent; the
    envelope round-trip is its contract test).

Telemetry impact: None.
```

---

## Story

As a Protocol Architect,
I want a typed contract for a player's in-progress aim before a `RELEASE`-type ability fires,
so that the host can render an aiming indicator without guessing at un-broadcast client state.

---

## Acceptance Criteria

**AC1 — `InputEvent` gains an `'aim-preview'` variant:**
**Given** `packages/shared-types/src/input.ts:12-14`, which today has only `'joystick'` and `'ability'` variants
**When** this story ships
**Then** a third variant exists — `{ type: 'aim-preview'; abilityIndex: number; directionX: number; directionY: number }` — matching ADR-0008's Decision section exactly
**And** the existing `JoystickInput` and `AbilityInput` interfaces and the two existing variants are untouched

**AC2 — `ability:aim-preview` broadcast delta exists:**
**Given** `packages/net-protocol/src/messages/server-to-host.ts`
**When** this story ships
**Then** a new exported type `AbilityAimPreviewDelta` exists — `{ type: 'ability:aim-preview'; playerId: string; abilityIndex: number; directionX: number; directionY: number; targetX?: number; targetY?: number }` — added to the `DeltaEventMsg` union and re-exported from `packages/net-protocol/src/index.ts`
**And** `targetX`/`targetY` are genuinely optional, because they are meaningful only for the destination-preview subset (Story 7.15b computes them; every other aiming ability omits them)

**AC3 — presentation-only, never state:**
**Given** `apply-delta.ts`'s exhaustiveness guard (`default:` → `const _exhaustive: never = evt`), which makes a missing case a compile error
**When** the new union member lands
**Then** `applyDelta` gains `case 'ability:aim-preview': return state;` with a comment matching the established sibling style (`ability:fired`, `ability:chain-hit`), and it is proven by test to leave state unchanged
**And** no field is added to `GameState`, `PlayerState`, or any other persistent shape

**AC4 — additive-only compatibility:**
**Given** the compatibility rules for this contract
**When** this story ships
**Then** no existing message type, field, or enum value is renamed, removed, retyped, or reordered — an older client that has never heard of `'aim-preview'` continues to work unchanged, because it simply never sends the input and ignores an unknown delta type
**And** the "Compatibility checklist" Dev Note below is reproduced and answered in Completion Notes

**AC5 — contract tests:**
**Given** the Contract-change hook's "at least one contract test" requirement
**When** this story ships
**Then** `tests/contract/net-protocol.test.ts` covers all four cases listed in Required tests, following the existing `ability:chain-hit` test pair's structure and naming style

**AC6 — ADR alignment:**
**Given** ADR-0008 is already Accepted and states both message shapes
**When** this story ships
**Then** the shipped types match the ADR's Decision section field-for-field, and Completion Notes records that verification explicitly — or, if a deviation was unavoidable, amends ADR-0008 and states the reason

**AC7 — Protocol Architect review:**
**Given** the Contract-change hook
**Then** this story does not reach `review` status until the checklist, the ADR verification, and the contract tests are all recorded in the Dev Agent Record

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `packages/shared-types/src/input.ts`: add the `'aim-preview'` variant to the `InputEvent` union. Consider whether to introduce an `AimPreviewInput` interface alongside `JoystickInput`/`AbilityInput` for symmetry — note that ADR-0008 specifies the fields inline on the variant, and `'ability'` nests its payload under an `ability` key while ADR-0008's `'aim-preview'` does not. Follow the ADR; document the asymmetry in a source comment so it is not "tidied up" later into a shape the mobile and sim code no longer match.
- [x] **Task 2** (AC: #2) — `packages/net-protocol/src/messages/server-to-host.ts`: add `AbilityAimPreviewDelta` next to `AbilityChainHitDelta`, with a comment stating it is presentation-only, throttled, never written to `GameState`, and citing ADR-0008. Add it to the `DeltaEventMsg` union.
- [x] **Task 3** (AC: #2) — `packages/net-protocol/src/index.ts:5`: add `AbilityAimPreviewDelta` to the type re-export list.
- [x] **Task 4** (AC: #3) — `packages/net-protocol/src/apply-delta.ts`: add the no-op case. Verify by running typecheck *before* adding the case that the exhaustiveness guard actually fires (a 30-second check that proves the guard works and that the union edit landed).
- [x] **Task 5** (AC: #5) — `tests/contract/net-protocol.test.ts`: add the four tests from Required tests, placed adjacent to the existing `ability:chain-hit` block.
- [x] **Task 6** (AC: #4, #6, #7) — Fill in the compatibility checklist and the ADR-0008 verification in Completion Notes. Run `npm run typecheck` and `npm test`.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### Compatibility checklist (reproduce and answer verbatim in Completion Notes)

1. Does any existing message type change shape (field added/removed/renamed/retyped)? → expected: **no**.
2. Does any existing enum or union member change value or ordering? → expected: **no**.
3. Can a client built before this change still connect, send, and receive correctly? → expected: **yes** — it never sends `'aim-preview'`, and an unknown delta type reaching `applyDelta` on an old client returns state unchanged via its own `default:` branch.
4. Can a server built before this change handle a client that *does* send `'aim-preview'`? → expected: **yes, defensively** — `GameRoom`'s `EventNames.INPUT` handler (`GameRoom.ts:341-353`) pushes any well-formed `InputEventMsg` onto the input queue, and both drain loops filter by `msg.event.type` (`:1627`, `:2369`, `:2885`), so an unrecognized variant is inertly ignored rather than crashing. State this as a *verified read of the existing code*, not an assumption.
5. Is the new delta written to persistent state anywhere? → must be **no**.
6. Does the change require a coordinated deploy of two surfaces? → expected: **no** — each of 7.15b/c/d degrades to "no preview" independently.
7. Is a serialization-format change involved (Phase 5 MessagePack swap)? → **no**; both new shapes are plain JSON-safe objects with number/string fields only.

### Why no new `EventNames` entry

`EventNames` (`packages/net-protocol/src/event-names.ts`) names *transports*, not payloads. Every input variant already rides `EventNames.INPUT` and every delta already rides `EventNames.DELTA`. Adding `AIM_PREVIEW = 'ability:aim-preview'` would create a second, parallel channel for a payload the existing envelopes already carry, and would force 7.15b/c/d to subscribe to a new message name for no benefit. Do not add one.

### Why `targetX`/`targetY` are optional, not `| null`

The codebase uses both idioms, so pick deliberately: `AbilityGeometry.coneAngleDeg` is `?:` optional for "not applicable to this entry" (`ability-geometry.ts:45`), while `GameState.boss` is `| null` for "applicable but currently absent". `targetX`/`targetY` are the first kind — most aiming abilities have no destination point at all — so `?:` is correct and matches the ADR's own notation (`targetX?`, `targetY?`). Under JSON serialization an absent optional simply does not appear in the payload, which is why the "round-trips WITHOUT targetX/targetY" test matters: a `toEqual` against an object that gained `undefined` keys would fail, and that is exactly the bug that test catches.

### Naming

`ability:aim-preview` follows the project's `noun:verb` event convention (project-context.md: `player:moved`, `enemy:killed`) and matches its closest sibling `ability:chain-hit`. The input variant is `'aim-preview'` — bare, no namespace — matching `'joystick'`/`'ability'`, which are also bare. ADR-0008 refers to the input as `input:aim-preview` in prose; that is the *transport + variant* read (`EventNames.INPUT` carrying variant `'aim-preview'`), not a literal string to hard-code. Do not create a type whose `type` field is the literal `'input:aim-preview'`.

### The exhaustiveness guard is your friend here

`apply-delta.ts`'s `default:` branch assigns `evt` to `const _exhaustive: never`. Adding a member to `DeltaEventMsg` without a matching `case` therefore fails `tsc` with a clear error. Use it: add the union member first, run `npm run typecheck`, confirm the error appears and names the new type, then add the case. If the error does *not* appear, the union edit did not land where you thought it did.

### Testing Standards

- Contract tests live in `tests/contract/` (project-context.md's three-category table). `tests/contract/net-protocol.test.ts` is the file — it already holds every other delta's round-trip.
- Every wire message type in `packages/net-protocol` must have a serialize → deserialize round-trip test. That is a standing project rule, not just this story's AC.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase): `apps/host-client/src/vfx/ability-vfx.test.ts` Stone Wall centering; the intermittent Ancestor's Voice e2e heal assertion; WSL2 e2e port-binding timeouts.

### Project Structure Notes

- `packages/shared-types` holds interfaces/enums/constants with **no runtime logic** — the `InputEvent` addition is a pure type edit.
- `packages/net-protocol` holds serialize/deserialize wrappers, the `applyDelta` reducer, and message types — **no game rules**. Computing `targetX`/`targetY` here would be a boundary violation; that is 7.15b's job inside the sim.
- Expected diff: four production files (`input.ts`, `server-to-host.ts`, `index.ts`, `apply-delta.ts`) plus one test file. Anything more means scope has leaked.

### Project Context Rules

- **Event Contract Discipline**: phones send typed input events only; the sim broadcasts typed delta events; the host applies `applyDelta` then renders. This story adds exactly one of each and nothing else.
- **Serialization**: use the existing `serialize`/`deserialize` wrappers — never `JSON.stringify`/`JSON.parse` in app code. Both new shapes must survive the Phase 5 MessagePack swap unchanged, which they do (plain numbers and strings).
- **Naming conventions**: events `noun:verb`; files kebab-case; wire message types PascalCase + `Msg` suffix (note: *deltas* in this codebase use the `…Delta` suffix, not `…Msg` — follow the sibling deltas, not the generic rule).
- **Contract-Change Hook** (project-context.md restates it): Protocol Architect review + at least one new contract test + spec/ADR update.

### References

- [Source: `docs/adr/ADR-0008-aim-preview-contract.md`] — Decision section: both message shapes, authoritative.
- [Source: `docs/adr/ADR-0003-ability-presentation-contract.md`] — the contract ADR-0008 extends.
- [Source: `packages/shared-types/src/input.ts:1-14`] — the `InputEvent` union.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:126-145`] — `AbilityChainHitDelta`, the shape and comment style to mirror.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts` (tail)] — the `DeltaEventMsg` union.
- [Source: `packages/net-protocol/src/apply-delta.ts:151-154`] — `ability:fired`/`ability:chain-hit` no-op cases; (tail) — the exhaustiveness guard.
- [Source: `packages/net-protocol/src/index.ts:5`] — the delta type re-export line.
- [Source: `packages/net-protocol/src/event-names.ts`] — why no new entry is needed.
- [Source: `tests/contract/net-protocol.test.ts:1040-1085`] — the test pattern to copy.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:341-353`, `:1627`, `:2369`, `:2885`] — evidence for compatibility checklist item 4.
- [Source: `packages/shared-types/src/class-definitions.ts:18-67`] — the six `RELEASE`-type abilities.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.15a section.
- [Source: `_bmad-output/project-context.md`] — Event Contract Discipline, Serialization, Contract-Change Hook, Naming Conventions.
- [Source: `CLAUDE.md`] — Ownership Rules, Contract-change hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- **Exhaustiveness-guard check performed as Task 4 specified, and it behaved exactly as predicted.** Added `AbilityAimPreviewDelta` to the `DeltaEventMsg` union *first*, then ran `npx tsc --noEmit -p packages/net-protocol/tsconfig.json` before adding the `applyDelta` case. It failed with `apply-delta.ts(309,13): error TS2322: Type 'AbilityAimPreviewDelta' is not assignable to type 'never'` — naming the new type, which confirms both that the guard works and that the union edit landed where intended. Added the case; typecheck then clean across all 10 tsconfigs on the first run.
- No other failures. `npm test`: 688 passed (up 4 from the 684 baseline after Story 7.14a), 1 failed, 4 skipped — all three failure categories pre-existing and documented (see Completion Notes).

### Completion Notes List

- **Task 1 — `InputEvent` variant.** Added an exported `AimPreviewInput` interface (`{ abilityIndex, directionX, directionY }`) and composed the variant as `({ type: 'aim-preview' } & AimPreviewInput)`. **Judgment call:** the ADR specifies the fields *inline* on the variant, not nested under a key the way `'ability'` nests under `ability`. Writing them inline literally would have left 7.15b and 7.15d with no named type to import for their own function signatures. The intersection gives the identical structural/wire shape ADR-0008 specifies while still exposing a reusable name — verified by the contract test, which constructs the object with inline fields and round-trips it. A source comment records the asymmetry with `'ability'` and warns against "tidying" it into a nested payload without updating the sender and reader together.
- **Task 2/3 — `AbilityAimPreviewDelta`.** Placed next to `AbilityChainHitDelta`, mirroring its comment style. The comment documents why `targetX`/`targetY` are optional and — importantly for 7.15c — names Void Pulse and Tempest Hurl explicitly as the two `RELEASE` abilities that will never carry a target, so a future reader does not treat their absence as a bug. Re-exported from `packages/net-protocol/src/index.ts`.
- **Task 4 — `applyDelta` no-op**, with a comment that also states where the state *does* live: the host holds the aim as its own transient presentation state and expires it on staleness or fire. That forward reference matters because 7.15c's staleness inference is the only thing that ever "clears" this delta, and nothing in the protocol says so.
- **Task 5 — four contract tests**, exactly as the Required tests list specified. The WITHOUT-target test additionally asserts `hasOwnProperty` is false for both keys, not just deep equality — deep equality alone would pass even if serialization had introduced explicit `undefined` keys, which is the specific failure mode that test exists to catch.
- **No `EventNames` entry added**, per the Non-goals. Both new shapes ride the existing `INPUT`/`DELTA` envelopes.

**Compatibility checklist (reproduced verbatim from Dev Notes and answered):**

1. *Does any existing message type change shape (field added/removed/renamed/retyped)?* — **No.** `git diff` on `packages/shared-types/src/input.ts` and `packages/net-protocol/src/messages/server-to-host.ts` shows additions only; `JoystickInput`, `AbilityInput`, and the two pre-existing `InputEvent` variants are byte-identical, as is every existing delta type.
2. *Does any existing enum or union member change value or ordering?* — **No.** `AbilityAimPreviewDelta` was appended to the `DeltaEventMsg` union after `AbilityChainHitDelta`; no existing member moved. `EventNames` is untouched.
3. *Can a client built before this change still connect, send, and receive correctly?* — **Yes.** It never sends `'aim-preview'`. If it receives the new delta, its own `applyDelta` `default:` branch returns state unchanged (the `never` guard is a compile-time construct; at runtime the default arm simply returns `state`). Host clients additionally filter transient deltas by an explicit type whitelist (`host-session.ts:42-97`), so an unwhitelisted type is dropped before reaching any renderer.
4. *Can a server built before this change handle a client that does send `'aim-preview'`?* — **Yes, verified by reading the code rather than assumed.** `GameRoom.ts`'s `EventNames.INPUT` handler (the `onMessage` registration around `:341-353`; the `if (!msg?.event)` check is at `:344-348` in the current working tree) pushes any message with a truthy `.event` onto `inputQueue` without inspecting the variant. All three drain loops filter by variant — the joystick drain (`=== 'joystick'`) and the two ability loops (`!== 'ability'` → `continue`) — so an unrecognized variant is inertly ignored and then cleared with the rest of the queue. No crash, no log spam, no state change. *Correction applied after code review:* the line numbers originally cited here (`:1627`, `:2369`, `:2885`) were copied from the story's own Dev Notes, which were written against the pre-7.14a tree; the current numbers are `:1642`, `:2384`, `:2931`. The substance was independently re-confirmed by the review's Edge Case Hunter layer; only the citations were stale. Line numbers are deliberately not restated above, since this file will drift again.
5. *Is the new delta written to persistent state anywhere?* — **No.** `applyDelta` returns `state` by reference (asserted with `toBe`, not `toEqual`), and no field was added to `GameState`, `PlayerState`, or any other persistent shape.
6. *Does the change require a coordinated deploy of two surfaces?* — **No.** Each of 7.15b/c/d degrades independently to "no preview": without 7.15d the phone sends nothing; without 7.15b the sim broadcasts nothing; without 7.15c the host ignores the delta.
7. *Is a serialization-format change involved (Phase 5 MessagePack swap)?* — **No.** Both shapes are plain JSON-safe objects of `number` and `string` fields with two optional numbers. No `Date`, `Map`, `Set`, `undefined`-as-value, or class instance.

**ADR-0008 alignment verification (AC6) — field-for-field against the Decision section, no deviation:**

| ADR-0008 says | Shipped | Match |
|---|---|---|
| Mobile→server `input:aim-preview`, `{ abilityIndex, directionX, directionY }` | `InputEvent` variant `'aim-preview'` on the `EventNames.INPUT` envelope, fields `abilityIndex`/`directionX`/`directionY` | ✅ |
| Server→clients `ability:aim-preview`, `{ playerId, abilityIndex, directionX, directionY, targetX?, targetY? }` | `AbilityAimPreviewDelta` with exactly those six fields, last two optional | ✅ |
| "never written to persistent `GameState`" | `applyDelta` no-op returning `state` by reference, asserted with `toBe` | ✅ |

No amendment to ADR-0008 was needed. Note that the ADR writes the mobile message as `input:aim-preview` in prose; that is transport + variant (`EventNames.INPUT` carrying variant `'aim-preview'`), not a literal type string, and no type whose `type` field is `'input:aim-preview'` was created — as the Dev Notes explicitly warned.

- **Required hooks:**
  - **Contract-change hook TRIGGERED and satisfied on three of its four items:** compatibility checklist ✅ (above), ADR verification ✅ (above), contract tests ✅ (four new, all passing). **Protocol Architect review is the one outstanding item** — this story stays at `review`, not `done`, until that review happens, and it is the reason the story's own AC7 gates on it.
  - Simulation-safety hook NOT triggered — no `apps/simulation-server/**` or `packages/game-rules/**` file touched.
  - Client-UX hook NOT triggered — no host or mobile file touched.
  - Ownership hook NOT triggered — all four production files are within the Protocol Architect's allowed paths (`packages/shared-types/**`, `packages/net-protocol/**`), plus the story's own `tests/contract/**` coverage.
- **Regression:** `npm run typecheck` clean (10/10 tsconfigs). `npm test`: 688 passed, 1 failed, 4 skipped across 56 files. The single failure is `apps/host-client/src/vfx/ability-vfx.test.ts`'s Stone Wall centering assertion, pre-existing and tracked since 7.2/7.8. The two other "failed" files (`tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`) failed with `simulation-server did not start within 60s` — the known WSL2 e2e port-binding timeout, their 4 tests skipped rather than executed. **Caveat, raised by the review's Acceptance Auditor layer and accepted:** that full-suite run was taken on a working tree that also carried Story 7.14a's uncommitted changes, so the 688 figure is entangled with 7.14a and the phrase "zero regressions attributable to this story" is not something the full-suite number alone can establish. The 7.15a-specific evidence is unaffected and was re-verified in isolation: `tests/contract/net-protocol.test.ts` passes 112/112 (up from 111 after the review patches), and `npm run typecheck` is clean across all 10 tsconfigs. Nothing outside `packages/shared-types/**`, `packages/net-protocol/**`, and `tests/contract/**` is touched by this story's diff.
- **Note carried forward for 7.15b/7.15c:** `ability:fired`'s `directionX`/`directionY` are **not** guaranteed to be a unit vector — `dispatchAbility` passes the caster's raw vector through (`abilities.ts:78-79`) and normalization happens per-delivery-branch inside `GameRoom`. The same will be true of `input:aim-preview` unless 7.15b normalizes, which it must (its AC2 requires the preview target to match real cast placement, and the real cast normalizes before applying `hitRangePx`). This was discovered during Story 7.14a's implementation and is recorded here because 7.15a is the contract these stories read.
- **Confidence: 95%.** The change is small, purely additive, and every claim above is backed by either a passing test or a direct read of the code path named. The 5% reservation is solely the outstanding Protocol Architect review, which is a process gate this session cannot satisfy on its own — not a technical uncertainty.

### File List

- `packages/shared-types/src/input.ts` — new exported `AimPreviewInput` interface and the `'aim-preview'` `InputEvent` variant, with the shape-asymmetry comment (Task 1)
- `packages/net-protocol/src/messages/server-to-host.ts` — new exported `AbilityAimPreviewDelta` type with its presentation-only/optional-target comment; added to the `DeltaEventMsg` union (Task 2)
- `packages/net-protocol/src/index.ts` — `AbilityAimPreviewDelta` added to the delta type re-export list (Task 3)
- `packages/net-protocol/src/apply-delta.ts` — `case 'ability:aim-preview': return state;` no-op with rationale comment (Task 4)
- `tests/contract/net-protocol.test.ts` — `AbilityAimPreviewDelta` import; new `aim-preview` `InputEventMsg` envelope round-trip; new `describe('AbilityAimPreviewDelta round-trip')` block with with-target, without-target, and applyDelta-no-op tests (Task 5)
- `_bmad-output/implementation-artifacts/7-15a-aim-preview-contract.md` — this story file (frontmatter `baseline_commit`, Tasks, Dev Agent Record, File List, Status, Change Log)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates (ready-for-dev → in-progress → review)

### Review Findings

Reviewed 2026-08-05 via 3 parallel layers (Blind Hunter — diff only, no project context; Edge Case Hunter — diff + full repo read access; Acceptance Auditor — diff + this story's AC1-AC7/Dev Notes as spec). The Acceptance Auditor found **no AC violations and no Blocked-path violations**. 2 High findings (both confirmed on re-read), 4 patches applied, 4 items deferred to downstream stories, 1 decision surfaced to the user, 7 dismissed as false-positive or by-design after verification.

**Confirmation pass on High findings (per the workflow's own rule):**

- **[High — CONFIRMED] `InputEvent` has no exhaustiveness guard anywhere in the repo.** Re-verified: a repo-wide search for `: never` returns exactly two hits — `apply-delta.ts`'s `DeltaEventMsg` guard and a `BossEvent` guard in `GameRoom.ts`. Neither covers `InputEvent`. Consequence: the `DeltaEventMsg` half of this change self-reports if a consumer is missed (it is what caught the missing `applyDelta` case during implementation), while the `InputEvent` half is silently dropped by every consumer — all three sim drain loops are negative filters (`=== 'joystick'`, `!== 'ability' → continue`). **Not fixable in this story:** every consumer lives in `apps/simulation-server/**`, a Blocked path here. **Deferred to Story 7.15b** as an explicit task (add a `default: { const _e: never = msg.event; }` to the tick drain).
- **[High — CONFIRMED] Non-finite coordinates become `null` on the wire, with no guard and no note.** Found independently by two layers, which is why it was treated as the highest-value finding. Re-verified: `serialize` is bare `JSON.stringify`, `deserialize` an unchecked `JSON.parse(...) as T`, and `JSON.stringify({ x: NaN })` yields `{"x":null}`. This is not hypothetical — normalizing a zero-length drag vector is `0/0 = NaN`, and a zero-length drag is the state every drag starts in. The existing fire path already guards it with the NaN-safe `!(Math.hypot(dx, dy) > 0)` (`game-rules/src/systems/abilities.ts`); the new channel had no equivalent and nothing telling 7.15b/7.15c to replicate it. **Patched** (see below) — documenting a wire invariant is squarely within a contract story's scope.

**Patches applied:**

- [x] **[Review][Patch]** Added a "DIRECTION INVARIANT" block to `AimPreviewInput`'s doc comment stating that `directionX`/`directionY` are neither normalized nor guaranteed finite, with the reason for each and the NaN-safe guard idiom to use. This also closes the Acceptance Auditor's separate Medium finding that the normalization warning existed only in Completion Notes — i.e. only where downstream authors would not look. [`packages/shared-types/src/input.ts`]
- [x] **[Review][Patch]** Added a "WIRE INVARIANTS" block to `AbilityAimPreviewDelta` covering the `null` coercion and the specific trap it creates: `null` passes an `!== undefined` optional check and then coerces to `0`, so a naive target check would render a destination preview at the world origin. Recommends `Number.isFinite`. Also documented, in the same comment, that the contract has **no terminator** and what that leaves the host to infer — including the path all three layers converged on: when a drag ends but `dispatchAbility` rejects the cast (e.g. on cooldown), no `ability:fired` is broadcast either, so the staleness window is the *only* thing that clears the preview. [`packages/net-protocol/src/messages/server-to-host.ts`]
- [x] **[Review][Patch]** New contract test pinning the `null`-on-the-wire behaviour, asserting the coercion, that `null !== undefined`, that it coerces to `0`, and that the NaN-safe hypot guard rejects it while `=== 0` would not. Turns an invisible hazard into an executable specification for 7.15b/7.15c. [`tests/contract/net-protocol.test.ts`]
- [x] **[Review][Patch]** Corrected two factually wrong test comments I had written. (1) The without-target test claimed a `toEqual` would catch explicit-`undefined` keys — it does not; vitest's `toEqual` treats `{a:1,b:undefined}` as equal to `{a:1}` (that is `toStrictEqual`'s job), so the `hasOwnProperty` assertions are what carry the test. (2) The `applyDelta` no-op test's title claimed to prove the delta is never persisted; the Edge Case Hunter empirically disproved that by deleting the `case` and re-running — it still passed, because the `default:` arm also returns `state` by reference. Retitled to what it actually pins (referential identity, which `host-session.ts` depends on for React bail-out under a ~30Hz stream) and documented that the case's *existence* is enforced by `npm run typecheck`, a separate script from `npm test`. [`tests/contract/net-protocol.test.ts`]
- [x] **[Review][Patch]** Corrected stale line-number citations in compatibility-checklist item 4, which claimed to be "verified by reading the code" while citing pre-7.14a line numbers, and disclosed that the full-suite "zero regressions" figure was measured on a tree also carrying 7.14a's uncommitted work. Both are accuracy defects in a document whose whole purpose is auditable evidence. [this story file]

**Deferred (real findings, out of scope for a contract-only story):**

- **[Defer → 7.15b]** No `InputEvent` exhaustiveness guard (the High finding above). Requires editing `apps/simulation-server/**`.
- **[Defer → 7.15b]** Inbound `aim-preview` is specified as validation-free, so an unmodified client could drive unbounded broadcasts (no cooldown/liveness/`abilityIndex`-range gating). Sim-side gating is 7.15b's job; noted there.
- **[Defer → 7.15b]** ADR-0008 specifies "Server → **all clients**", and `mobile-session.ts` has no delta-type filter, so at ~33ms cadence with 8 players every phone would receive up to ~240 msg/s of other players' aim streams purely to ignore them. The ADR's Negative section assessed only the host-side cost and missed the phone-side multiplication. 7.15b should decide broadcast-to-all vs. send-to-host-only and record the reasoning.
- **[Defer]** `docs/specs/networking-spec.md` was not updated. The Contract-change hook is satisfied via ADR-0008 (the spec explicitly allowed ADR-only), but that file already lists an `aim` input event and gained `boss:charged` from Story 7.7a, while Story 7.13's `ability:chain-hit` was never added. The enumeration is drifting either way and deserves a deliberate decision rather than inherited ambiguity.

**Dismissed (verified false-positive or by-design):** the new event not being registered in `EventNames` (`EventNames` names *transports*, not payloads — no delta type is in it, including `ability:fired`, `ability:chain-hit`, `zone:strike`, and every `boss:*`; adding one would create a second redundant channel, which this story's Non-goals explicitly forbid); `AimPreviewInput` not added to a shared-types export list (that package uses `export * from './input.js'`, so it is already public — independently confirmed by the Acceptance Auditor); the `InputEvent` intersection form being a deviation from the ADR (the Acceptance Auditor compiled both forms under `--strict` and proved bidirectional assignability, correct `switch` narrowing, and `never`-guard compatibility — structurally and on-the-wire identical); the ability-name table in the delta comment being rot-prone (matches this codebase's established comment style, e.g. Story 7.13's own); the `InputEvent` shape asymmetry being "defended rather than fixed" (mandated by Accepted ADR-0008, which this story's Inputs section forbids deviating from); the host `onTransientDelta` allowlist not forwarding the new delta (`apps/host-client/**` is a Blocked path here — Story 7.15c adds it, and its AC1 says so); the File List naming `_bmad-output/**` files outside the story's Allowed paths (workflow-inherent — the same Task 6 that requires Completion Notes requires writing this file; a gap in the story template's path list, matching every prior story in this sprint).

**Decision taken (user, 2026-08-05):** all three review layers independently flagged that the contract has no aim-terminator — no cancel delta, no timestamp, no TTL. Surfaced rather than patched unilaterally, since it is inherited from Accepted ADR-0008 and this story's Inputs section forbade deviating from it. **Resolved: keep ADR-0008 as written.** The host infers cessation from message absence via a staleness window plus the `ability:fired` clear, and Story 7.15c owns defining and justifying that window. Rationale for accepting the residual risk: the common exit (release → fire) is exact and immediate via `ability:fired`; the staleness window only has to cover the uncommon exits (touch-cancel, backgrounded phone, and the reviewers' cooldown-rejected-cast path where no `ability:fired` is broadcast either), and getting it slightly wrong degrades to a briefly-lingering ghost arrow — cosmetic, never a wrong gameplay signal. No ADR amendment, no new wire type, no extra traffic. **Binding on 7.15c:** its AC5 window is now the sole mechanism for every non-fire exit, so it must be a named constant with its value justified in Completion Notes, and the cooldown-rejected-cast path must be named explicitly as one of the cases it covers.

**Regression after patches:** `npm run typecheck` clean across shared-types, net-protocol, and tests projects; `tests/contract/net-protocol.test.ts` 112 passed, 0 failed.

**Status decision:** stays `review`, not `done` — the Contract-change hook's **Protocol Architect review** remains genuinely outstanding (AC7 gates on it), and no automated layer can satisfy that gate.

## Change Log

- 2026-08-05 — Story created from `epics.md` "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" and ADR-0008.
- 2026-08-05 — Implemented. `'aim-preview'` `InputEvent` variant and `AbilityAimPreviewDelta` added additively, with an `applyDelta` no-op and four contract tests. Compatibility checklist and ADR-0008 field-for-field verification recorded; Protocol Architect review outstanding. Status → review.
- 2026-08-05 — Code review (3 parallel layers). 2 High findings confirmed, 5 patches applied (wire/direction invariants documented on both types, a new non-finite-coercion contract test, two corrected test comments, two corrected accuracy claims in this file), 4 items deferred to 7.15b/spec upkeep, 1 contract decision surfaced to the user. 112 contract tests green.

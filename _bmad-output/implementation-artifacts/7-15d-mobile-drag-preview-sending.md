---
baseline_commit: f5b9748
---

# Story 7.15d: Mobile Drag-Preview Sending

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. **Blocked by Story 7.15a**
  (the `InputEvent` `'aim-preview'` variant must exist before the phone can
  send it). No dependency on 7.15b or 7.15c — all three are siblings off 7.15a
  — though nothing is observable end-to-end until 7.15b and 7.15c also land.
  No relationship to Stories 7.14a/7.14b.

Context: ADR-0008 (Accepted) identified this as the one genuinely new client
  path in the 7.15 chain: "`RELEASE`-type abilities need a genuinely new
  mobile-side sending path (Story 7.15d) — this is not purely a host/VFX-layer
  addition, despite originating from a VFX ask."

  Today, `SkillCell` (`apps/mobile-controller/src/screens/ControllerScreen.tsx:655-812`)
  already tracks everything needed. `onTouchStart` (`:677-715`) records an
  `activeTouchRef` with `lastDirX`/`lastDirY`; `onTouchMove` (`:717-740`)
  updates that direction whenever the drag is past `SKILL_CELL_DEADZONE_RADIUS`.
  For `AUTO`/`AIM_CAST` abilities an interval at 33ms (`:696-714`) already
  streams that direction to the server as real `ability` fires. For `RELEASE`
  abilities the same direction is tracked, is already live in the ref, and is
  simply **never sent** until the thumb lifts (`:748-751`, `:769-772`, `:794-797`).

  So this story is not "track the drag" — that already works. It is "start
  emitting the direction that is already being tracked, on a separate,
  lower-stakes message."

  The six `RELEASE`-type abilities (`class-definitions.ts`): Stone Wall
  (stonehide[0]), Crimson Lash (souldrinker[1]), Dark Pact (souldrinker[2]),
  Void Pulse (souldrinker[3]), Tempest Hurl (stormcaller[1]), Storm Eye
  (stormcaller[3]). Gate on `ability.inputType === 'RELEASE'`, never on a
  hard-coded class/index list, so a future `RELEASE` ability is covered
  automatically — the epic's AC says exactly this.

Owner: Mobile Controller Engineer (CLAUDE.md Ownership Rules).

Goal: While a `RELEASE`-type ability is mid-drag, send a throttled
  `input:aim-preview` carrying the current drag direction; stop immediately on
  release, fire, or touch-cancel. Change nothing about how abilities actually fire.

Allowed paths:
  - apps/mobile-controller/**
  - packages/ui-kit/**  (mobile-side only; not expected to be needed)

Blocked paths:
  - apps/simulation-server/**    (Story 7.15b)
  - apps/host-client/**          (Story 7.15c)
  - packages/shared-types/**     (Story 7.15a)
  - packages/net-protocol/**     (Story 7.15a)
  - packages/game-rules/**
  - apps/backend-platform/**

Inputs:
  - docs/adr/ADR-0008-aim-preview-contract.md (Decision, "Mobile → server:"
    paragraph — throttle cadence and the three stop conditions)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx:22
    (`INPUT_INTERVAL_MS = 33`)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx:641-812 (the whole
    `SkillCell` component: props, `activeTouchRef`, `autoIntervalRef`, all four
    teardown paths)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx:1151-1174
    (`handleAbilityFire` — the sibling callback the new one mirrors)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx:1176-1200
    (`sendJoystick` and its `lastSendTimeRef` throttle — read, then see the
    Dev Note on why NOT to copy this pattern here)
  - apps/mobile-controller/src/session/mobile-session.ts:18, :144, :185
    (`sendInput`)
  - packages/shared-types/src/class-definitions.ts:18-67 (`inputType` per ability)

Non-goals:
  - NO change to the existing `ability` input message, to `handleAbilityFire`,
    or to when/whether an ability actually fires. This adds a new, separate,
    lower-stakes input alongside the existing one.
  - NO mobile change for `AUTO`/`AIM_CAST` abilities. Their existing
    continuous-fire input already carries live direction, and Story 7.15b
    sources the broadcast from that existing stream. Touching them here would
    duplicate a stream the server already has.
  - NO new on-phone visual. The player watches the host screen; the phone is a
    controller (project-context.md, Mobile Controller Constraints). The
    existing aiming ring + knob (`:890-895`) is the only phone-side aim
    feedback and stays as-is.
  - NO contract change. `packages/shared-types` and `packages/net-protocol` are
    Blocked; consume 7.15a's `InputEvent` variant read-only.
  - NO component-test harness. See the Testing Standards note.

Required hooks:
  - **Client-UX hook (TRIGGERED)** — mobile UI/input code changed.
    Mobile checks required: joystick mapping, skill mapping, reconnect UX,
    **sleep/background recovery**, minimal-attention check. The
    sleep/background item is the substantive one here — see Dev Notes. No
    device available in this implementation sandbox — disclose the manual pass
    as outstanding in Completion Notes rather than claiming it was performed,
    matching 4.15c/7.13/7.5/dev-3's precedent.
  - Contract-change hook: NOT triggered (consumes 7.15a's types, adds none).
  - Simulation-safety hook: NOT triggered (no sim/game-rules edit).
  - Ownership hook: NOT triggered (single owner).
  - Telemetry hook: no new user flow — aiming a `RELEASE` ability is an
    existing gesture that now emits a message. No new KPI event.

Required tests:
  - `tests/e2e/` — a live-room test that a `RELEASE`-type mid-drag produces
    `input:aim-preview` messages the server accepts, and that they stop on
    release. This is the only automated layer available for mobile code in this
    repo (see Testing Standards) and it exercises the real WebSocket path.
  - `npm run typecheck` (10 tsconfigs) + `npm test` at repo root.
  - Manual Client-UX pass on a real phone (see hook note — disclose, do not fake).

Telemetry impact: None.
```

---

## Story

As a Mobile Controller Engineer,
I want the phone to report the in-progress drag direction for `RELEASE`-type abilities before the player releases,
so that the host has something to render an aim preview from.

---

## Acceptance Criteria

**AC1 — mid-drag sending for `RELEASE` abilities:**
**Given** a player is mid-drag on a `RELEASE`-type ability's skill cell (Stone Wall, Crimson Lash, Dark Pact, Void Pulse, Tempest Hurl, Storm Eye, and any future `RELEASE`-type ability)
**When** the drag is in progress
**Then** the phone sends a throttled `input:aim-preview` event at the same ~33ms cadence as the existing joystick input (`INPUT_INTERVAL_MS`), carrying `abilityIndex` and the current drag direction
**And** the gate is `ability.inputType === 'RELEASE'`, never a hard-coded class/index list

**AC2 — sending is time-driven, not move-driven:**
**Given** a player who drags to a direction and then holds their thumb perfectly still
**When** they continue holding
**Then** `input:aim-preview` keeps being sent at the throttle cadence — because the host infers "stopped aiming" from the *absence* of these messages (Story 7.15c has no cancel event to rely on), so a still thumb must not read as a released one
**And** this is therefore implemented on an interval, not as a throttle inside `onTouchMove`

**AC3 — stops on every exit path:**
**Given** the drag ends by release, by fire, or by touch-cancel
**When** any of those occurs
**Then** sending stops immediately, with no trailing message after the `ability` fire message
**And** all four existing teardown paths are covered — `onTouchEnd` (`:742-762`), `onDocumentTouchEnd` (`:764-783`), the `touchcancel` listener (bound to `onTouchEnd`, `:788`), and the effect cleanup (`:792-811`)

**AC4 — no change for `AUTO`/`AIM_CAST`:**
**Given** `AUTO` and `AIM_CAST` abilities
**When** this story ships
**Then** no mobile-side change is made for them — their existing continuous-fire input already carries live direction, and Story 7.15b sources the broadcast from that existing stream
**And** the `autoIntervalRef` behaviour at `:696-714`, including its cooldown skip and its zero-aim `AUTO` skip, is byte-for-byte unchanged in effect

**AC5 — zero-aim is not sent:**
**Given** a touch that has started but never passed `SKILL_CELL_DEADZONE_RADIUS`, so `lastDirX`/`lastDirY` are still `(0, 0)`
**When** the interval fires
**Then** nothing is sent — mirroring the existing `AUTO` zero-aim skip at `:711` and matching Story 7.15b's server-side zero-aim suppression, so neither side has to defend against a signal the other should not have produced

**AC6 — fire behaviour untouched:**
**Given** the existing `ability` input message and `handleAbilityFire` (`:1151-1174`)
**When** this story ships
**Then** neither is modified, and a `RELEASE` ability fires on release exactly as before — same message, same direction, same `tapFlash` behaviour
**And** the new send path uses its own callback, not an overload of `onAbilityFire`

**AC7 — hooks:**
**Given** the Client-UX hook (mobile input code changed; no Contract-change or Simulation-safety trigger)
**Then** the manual Client-UX pass — joystick mapping, skill mapping, reconnect UX, sleep/background recovery, minimal-attention — is required before merge, performed by a human on a real device; disclose it as outstanding rather than claiming it was done

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #6) — `ControllerScreen.tsx`: add a `handleAimPreview(abilityIndex, dirX, dirY)` callback next to `handleAbilityFire` (`:1151-1174`), sending `{ type: 'input', event: { type: 'aim-preview', abilityIndex, directionX, directionY } }` via `sessionRef.current.sendInput`. No `tapFlash`, no side effects — this is a strictly lower-stakes sibling.
- [x] **Task 2** (AC: #1, #6) — Thread it into `SkillCell` as a new `onAimPreview` prop alongside `onAbilityFire` in `SkillCellProps` (`:641-653`), and pass it at the call site. Do not overload `onAbilityFire` with a mode flag.
- [x] **Task 3** (AC: #1, #2, #3, #5) — `SkillCell.onTouchStart` (`:677-715`): add a `RELEASE` branch that starts an interval at `INPUT_INTERVAL_MS`, sending the current `t.lastDirX`/`t.lastDirY` each tick and skipping when both are 0.
  - [x] Subtask 3.1 — **Reuse `autoIntervalRef`** rather than adding a second ref. An `AUTO`/`AIM_CAST` cell and a `RELEASE` cell are mutually exclusive (one `ability.inputType` per cell), so the ref is never contended — and all four existing teardown paths already clear it (`:752-755`, `:773-776`, `:804-807`), which means AC3 is satisfied with zero new teardown code and zero chance of forgetting a path. Add a comment stating this explicitly so the two uses are not later "separated for clarity" into a ref whose cleanup someone forgets.
  - [x] Subtask 3.2 — Confirm by reading each of the four paths that the clear is unconditional, not gated on `inputType`.
- [x] **Task 4** (AC: #3) — Verify ordering on release: `onTouchEnd` fires the ability (`:748-751`) and *then* clears the interval (`:752-755`). Confirm no preview message can be emitted after the fire message on the same gesture; if the current ordering allows a race, clear the interval before firing.
- [x] **Task 5** (AC: #4) — Regression-read the `AUTO`/`AIM_CAST` branch: confirm the new `RELEASE` branch cannot alter its cooldown skip (`:710`) or zero-aim skip (`:711`), and that a class switch between abilities of different `inputType` re-runs the effect cleanly (the effect's dep array is `[canHoldThroughCooldown, ability, index, onAbilityFire]` at `:812` — adding `onAimPreview` to it is required, and `handleAimPreview` must therefore be `useCallback`-stable or the effect will re-subscribe every render).
- [x] **Task 6** — `tests/e2e/`: a live-room test that mid-drag `input:aim-preview` messages are accepted by the server and stop on release. Follow `tests/e2e/hub-ability-use.test.ts`'s harness style (real room, real client, `EventNames.INPUT`).
- [x] **Task 7** — Full regression: `npm run typecheck` (10 tsconfigs), `npm test`. Do **not** chase the documented pre-existing failures (Stone Wall centering in `ability-vfx.test.ts`, the intermittent Ancestor's Voice e2e heal assertion, WSL2 e2e port-binding timeouts).
- [x] **Task 8** (AC: #7) — Manual Client-UX pass per Required hooks, on a real phone. No device in this sandbox — disclose as outstanding in Completion Notes.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### Why an interval, not a throttle inside `onTouchMove` (AC2)

This is the single most important design decision in the story, and the obvious-looking approach is wrong.

`sendJoystick` (`:1176-1186`) throttles on send: it is called from a move handler and drops calls inside `INPUT_INTERVAL_MS`. Copying that shape here — throttle inside `onTouchMove` — looks natural and produces a subtle bug: **`touchmove` stops firing when the thumb stops moving.** A player who drags to their intended direction and then holds still to line up the shot would send nothing for as long as they hold. Story 7.15c's host has no aim-cancel event and must infer "stopped aiming" from silence, so it would clear the arrow precisely when the player is aiming most deliberately.

The `AUTO`/`AIM_CAST` path already got this right for the same underlying reason (`:696-714` uses `setInterval`, reading `t.lastDirX`/`t.lastDirY` out of the ref each tick rather than sending from the move handler). Mirror it.

The joystick can throttle-on-move safely because the sim holds the last known joystick vector persistently (`lastKnownJoystick`, `GameRoom.ts:1626-1630`, Story 2.5) — silence there means "keep going", not "stopped". The aim preview has the opposite semantics. Do not generalize from one to the other.

### Reuse `autoIntervalRef` — the teardown argument

`SkillCell` has four places that end a gesture, and each already clears `autoIntervalRef`:

| Path | Line | Trigger |
|---|---|---|
| `onTouchEnd` | `:742-762` | finger lifts on the cell; also bound to `touchcancel` (`:788`) |
| `onDocumentTouchEnd` | `:764-783` | finger lifts anywhere (drag left the cell) |
| effect cleanup | `:792-811` | ability/class change, unmount, cooldown-mode change |

Adding a second ref means adding a clear to all three (plus keeping them in sync forever). Since a cell's `ability.inputType` is fixed for the life of the effect, an `AUTO`/`AIM_CAST` cell never sets a `RELEASE` interval and vice versa — the ref is uncontended by construction. Reusing it makes AC3 true for free. Comment the reuse loudly; it is the kind of thing a later "cleanup" refactor splits apart and breaks.

Note the effect-cleanup path also *fires* a pending `RELEASE` ability (`:794-797`) before clearing — so a class change mid-drag both casts and stops previewing, which is correct and needs no new handling.

### Sleep / background recovery (Client-UX hook)

Mobile browsers throttle or suspend `setInterval` in a backgrounded tab. If the phone sleeps mid-drag, preview sending stops — and Story 7.15c's staleness window then clears the arrow on the host. That is the correct outcome and requires no explicit handling here; state it in Completion Notes rather than adding a `visibilitychange` handler for it.

The case that *does* deserve a look during the manual pass: waking the phone with a finger still down. The touch identifier may or may not survive; if `activeTouchRef` is stale, the interval may resume sending a direction for a gesture the user no longer considers active. The existing `AUTO` path has the same exposure and has not been reported as a problem, so treat this as an observation for the manual pass, not a speculative fix to build.

### `useCallback` stability matters here (AC4 regression risk)

`SkillCell`'s touch effect deps are `[canHoldThroughCooldown, ability, index, onAbilityFire]` (`:812`). `onAbilityFire` is `useCallback(..., [])` (`:1174`) — stable, so the effect subscribes once. `onAimPreview` must be added to the deps and must be equally stable. An unstable callback would re-run the effect on every parent render, tearing down and re-adding all six touch listeners mid-gesture and losing `activeTouchRef` — which would break firing, not just previewing. Give `handleAimPreview` an empty dep array like its sibling.

### Message shape: follow 7.15a, not the prose

ADR-0008 writes the mobile→server message as `input:aim-preview`. That is transport + variant, not a literal type string: it rides the existing `EventNames.INPUT` envelope as an `InputEventMsg` whose `event.type` is `'aim-preview'`. Check 7.15a's shipped `InputEvent` variant before writing the object literal — in particular whether the payload fields sit inline on the variant (as ADR-0008 specifies) or nested under a key the way `'ability'` nests under `ability`. Match what 7.15a actually shipped; do not infer from the `'ability'` sibling.

### Testing Standards

- `apps/mobile-controller` has `vitest` in devDependencies but **zero test files**, no `jsdom`, and no `@testing-library/react`. Do **not** add those dependencies for this story — introducing a component-test harness is its own piece of work and is explicitly out of scope (the same decision Story 4.15c made and documented).
- The available automated layer is `tests/e2e/`, which drives a real simulation-server over a real WebSocket. That is where AC1/AC3's coverage goes.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase, do not claim fixed): `apps/host-client/src/vfx/ability-vfx.test.ts` Stone Wall centering; the intermittent Ancestor's Voice e2e heal assertion in `tests/e2e/ability-dispatch.test.ts`; WSL2 e2e port-binding timeouts.

### Project Structure Notes

- Expected production diff: `apps/mobile-controller/src/screens/ControllerScreen.tsx` only — one new callback, one new prop, one new branch in an existing effect. Anything beyond that file means scope has leaked.
- No new module and no new constant beyond reusing `INPUT_INTERVAL_MS` (`:22`), which already exists and already means exactly "~30hz throttle to match sim tick rate".

### Project Context Rules

- **Mobile sends input events, not state** (Authority Violations table): the aim preview carries a direction the player is expressing, never a position or any derived game state. Do not include the player's coordinates — the sim knows where the player is.
- **Mobile Controller Constraints**: touch targets ≥44×44px (unchanged here); UI stays minimal — left half joystick, right half 2×2 ability grid. This story adds no phone-side UI.
- **The phone is a controller, not a game screen** — players watch the host screen. The preview this story enables is rendered there (7.15c), not here.
- **No audio dependency on mobile** — not relevant, but do not add any cue.
- **PC / keyboard input is permanently out of scope** — do not add a keyboard path even as a dev shortcut for testing this.
- **Never import `packages/game-rules`** into mobile.

### References

- [Source: `docs/adr/ADR-0008-aim-preview-contract.md`] — Decision, "Mobile → server:" paragraph; Consequences ("a genuinely new mobile-side sending path").
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:22`] — `INPUT_INTERVAL_MS`.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:641-653`] — `SkillCellProps`.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:655-676`] — `SkillCell` refs, including `activeTouchRef` and `autoIntervalRef`.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:677-715`] — `onTouchStart` and the `AUTO`/`AIM_CAST` interval (the pattern to mirror), including the cooldown skip (`:710`) and zero-aim skip (`:711`).
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:717-740`] — `onTouchMove`, where `lastDirX`/`lastDirY` are maintained.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:742-812`] — all four teardown paths and the effect dep array.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:1151-1174`] — `handleAbilityFire`, the sibling callback.
- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx:1176-1200`] — `sendJoystick`'s throttle; read as the *counter*-example (see Dev Notes).
- [Source: `apps/mobile-controller/src/session/mobile-session.ts:18`, `:144`, `:185`] — `sendInput`.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1626-1630`] — `lastKnownJoystick` persistence, why the joystick can throttle-on-move and this cannot.
- [Source: `packages/shared-types/src/class-definitions.ts:18-67`] — `inputType` per ability; the six `RELEASE` abilities.
- [Source: `_bmad-output/implementation-artifacts/7-15a-aim-preview-contract.md`] — the `InputEvent` variant this story sends.
- [Source: `_bmad-output/implementation-artifacts/7-15c-render-aim-arrow-and-destination-preview.md`] — the staleness-inference design that makes AC2 load-bearing.
- [Source: `_bmad-output/implementation-artifacts/4-15c-leave-run-button-and-vote-ui.md`] — the mobile testing-scope precedent this story follows.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.15d section.
- [Source: `_bmad-output/project-context.md`] — Authority Violations table, Mobile Controller Constraints, Platform & Build Rules.
- [Source: `CLAUDE.md`] — Ownership Rules, Client-UX hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- No implementation failures. `npm run typecheck` clean on the first run (10/10 tsconfigs); the new e2e gesture test passed on the first run.
- Lint on `ControllerScreen.tsx`: 28 errors, of which 27 are pre-existing `no-undef` for browser globals (`document`, `setInterval`, `clearInterval`, `setTimeout`) — the same baseline noise every file in this app carries, because the ESLint env lacks browser globals. The 28th is a genuine, **pre-existing** `no-restricted-imports` violation at line 9: `import { SPIRIT_ABILITY_NAMES } from 'game-rules'`, which the project's own rule flags as "game-rules must not be imported in client apps — authority violation". Verified byte-identical in the baseline commit (`git show HEAD:...`), so it is not introduced here and is out of this story's scope — but it is a real authority-boundary violation that project-context.md forbids explicitly, and worth a follow-up.

### Completion Notes List

- **Task 1/2 — a separate callback, not an overload.** `handleAimPreview(abilityIndex, dirX, dirY)` sits next to `handleAbilityFire`, sends `{ type: 'input', event: { type: 'aim-preview', … } }` via `sessionRef.current.sendInput`, and does nothing else — no `tapFlash`, no cast, no cooldown. Threaded into `SkillCell` as a new `onAimPreview` prop rather than an `onAbilityFire` mode flag, per AC6.
- **No local throttle in `handleAimPreview`, and `sendJoystick`'s `lastSendTimeRef` is deliberately not reused.** The caller is already an interval at `INPUT_INTERVAL_MS`. Sharing the joystick's throttle ref would make movement and aiming suppress each other — and they are simultaneous by design (left thumb moves, right thumb aims), so that would have been a real input bug rather than a tidy reuse.
- **Task 3 / AC2 — an interval, not a throttle inside `onTouchMove`.** This was the story's flagged trap and it is a real one: `touchmove` stops firing when the thumb stops moving, so a player who drags to a direction and then holds still to line up the shot would go silent. Since the host infers "stopped aiming" from silence (ADR-0008 has no cancel event), it would clear the arrow at exactly the moment the player is aiming most deliberately. The `AUTO`/`AIM_CAST` branch already uses `setInterval` for the same underlying reason. `sendJoystick` can throttle-on-move safely only because the sim persists the last joystick vector, where silence means "keep going" — the opposite semantics.
- **Task 3.1 — `autoIntervalRef` is reused rather than a second ref added.** A cell's `ability.inputType` is fixed for the effect's lifetime, so an `AUTO`/`AIM_CAST` cell never sets a `RELEASE` interval and vice versa; the ref is uncontended by construction. This makes AC3 true for free: all four teardown paths (`onTouchEnd`, `onDocumentTouchEnd`, the `touchcancel` listener bound to `onTouchEnd`, and the effect cleanup) already clear it unconditionally, verified by reading each one — none is gated on `inputType`. A second ref would have meant three new clears to add and keep in sync forever. The source comment says this loudly, because it is exactly the kind of thing a later "separate these for clarity" refactor breaks.
- **Task 4 — the release ordering has no race, verified rather than assumed.** `onTouchEnd` calls `onAbilityFire` and then `clearInterval` as two statements in one synchronous block; JavaScript is single-threaded, so a timer callback cannot be scheduled between them. No trailing preview can follow the fire message. The ordering was therefore left as-is rather than reordered — the story permitted clearing before firing if a race existed, and none does. Confirmed empirically by the new e2e gesture test, which asserts every preview precedes the fire.
- **Also verified in the same read:** the effect cleanup path *fires* a pending `RELEASE` ability before clearing, so a class change mid-drag both casts and stops previewing. Correct as-is; no new handling needed.
- **Task 5 / AC4 — `AUTO`/`AIM_CAST` untouched.** The new branch is an `else if (ability.inputType === 'RELEASE')` on the existing `if (AUTO || AIM_CAST)`, so the two are mutually exclusive and the existing branch's cooldown skip and zero-aim skip are unreachable from the new code. One incidental cleanup inside that branch: the hard-coded `33` in `setInterval(..., 33)` now reads `INPUT_INTERVAL_MS`, which is the same value from the same file (`:22`) and is what the new branch uses — leaving one literal and one constant side by side for the same cadence would have been actively misleading.
- **AC5 — zero-aim is not sent**, mirroring the existing `AUTO` guard. `lastDirX`/`lastDirY` stay at `(0, 0)` until the drag passes `SKILL_CELL_DEADZONE_RADIUS`, so a touch that has started but not moved sends nothing. Story 7.15b suppresses zero-aim server-side too, so neither side depends on the other having got it right.
- **`useCallback` stability (the AC4 regression risk).** `onAimPreview` was added to the touch effect's dep array, and `handleAimPreview` has an empty dep array like its sibling `handleAbilityFire`. This matters more than it looks: an unstable callback would re-run the effect on every parent render, tearing down and re-adding all six touch listeners mid-gesture and losing `activeTouchRef` — which would break *firing*, not just previewing. Noted in a source comment at the dep array.
- **Sleep / background recovery.** No `visibilitychange` handler was added, deliberately. Mobile browsers throttle or suspend `setInterval` in a backgrounded tab, so a sleeping phone simply stops sending and the host's staleness window clears the arrow — which is the correct outcome and needs no code. The case genuinely worth watching in the manual pass is waking the phone with a finger still down: if `activeTouchRef` is stale, the interval may resume sending for a gesture the user no longer considers active. The existing `AUTO` path has had identical exposure since Story 2.x with no reported problem, so this is logged as an observation for the manual pass rather than a speculative fix.
- **Message shape checked against what 7.15a actually shipped, not inferred.** ADR-0008 writes the message as `input:aim-preview` in prose; that is transport + variant. The shipped `InputEvent` variant is bare `'aim-preview'` with its fields **inline** (not nested under a key the way `'ability'` nests under `ability`), so the object literal here matches that and not the `'ability'` sibling's shape. No type with a `type` field of `'input:aim-preview'` exists anywhere.
- **Required hooks:**
  - **Client-UX hook TRIGGERED — the manual pass was NOT performed.** No device in this sandbox; same disclosed limitation as 4.15c/7.13/7.5/dev-3. A human must verify on a real phone: (1) dragging each of the six `RELEASE` abilities produces a host-side aim preview that tracks the thumb; (2) it persists while the thumb is held still — the specific bug AC2 exists to prevent; (3) it stops immediately on release, on dragging off the cell (document-level touchend), and on touch-cancel; (4) firing still works identically for all six; (5) joystick movement and aiming simultaneously do not interfere; (6) waking the phone mid-drag behaves sanely.
  - Contract-change hook NOT triggered — zero diff under `packages/shared-types/` and `packages/net-protocol/`; 7.15a's `InputEvent` variant is consumed read-only.
  - Simulation-safety hook NOT triggered — no sim or game-rules file touched.
  - Ownership hook NOT triggered — the only production file changed is `apps/mobile-controller/src/screens/ControllerScreen.tsx`, exactly as the story's Project Structure Notes predicted.
- **Testing.** No component-test harness was added, per the story's explicit Non-goal and Story 4.15c's precedent (`apps/mobile-controller` has `vitest` but zero test files, no `jsdom`, no `@testing-library/react`). Coverage is one new e2e test in `tests/e2e/aim-preview.test.ts` asserting the gesture this story produces over a real WebSocket — previews during the drag, then the fire, with every preview ordered before the fire. **Stated plainly rather than overclaimed:** that test verifies the wire contract the mobile code implements, not the mobile code itself. The touch-handling path is verified by code inspection plus the manual pass, and nothing else.
- **Regression:** `npm run typecheck` clean (10/10 tsconfigs). `npm test`: 710 passed, 1 failed, 9 skipped across 58 files. The failure is the pre-existing Stone Wall centering assertion; the four "failed" e2e files all hit the WSL2 port-binding timeout with their tests skipped (`hub-ability-use.test.ts` passes 5/5 in isolation). Zero regressions attributable to this story.
- **Confidence: 78%.** The wire contract, the interval-vs-throttle decision, the teardown coverage, and the release ordering are each verified — the first by a passing e2e test, the rest by direct reads of all four teardown paths and of JavaScript's single-threaded execution guarantee. The 22% reservation is that **no automated test exercises a single line of the code this story actually adds**: `apps/mobile-controller` has no test harness by deliberate project decision, so the touch-interval wiring is inspection-verified only. That is the honest state, and it is why the manual Client-UX pass is a real gate here rather than a formality.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — new `onAimPreview` prop on `SkillCellProps` and its destructure (Task 2); new `RELEASE` branch in `onTouchStart` starting an interval on the reused `autoIntervalRef`, with the zero-aim skip (Tasks 3, 3.1); `onAimPreview` added to the touch effect's dep array with the stability note (Task 5); new `handleAimPreview` `useCallback` beside `handleAbilityFire` (Task 1); `onAimPreview={handleAimPreview}` at the `SkillCell` call site (Task 2); the `AUTO`/`AIM_CAST` interval's hard-coded `33` replaced with the existing `INPUT_INTERVAL_MS` constant
- `tests/e2e/aim-preview.test.ts` — new "a RELEASE drag streams previews and then fires, in that order" test covering Story 7.15d's gesture (Task 6)
- `_bmad-output/implementation-artifacts/7-15d-mobile-drag-preview-sending.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates

### Review Findings

Reviewed 2026-08-06 in a batched branch review (mobile group). The reviewer read the full `SkillCell` and traced the message end-to-end through the sim and host, which is how it found the branch's sharpest bug — one that this story's own code did not cause but that its gesture triggers.

**[High — CONFIRMED, FIXED in Story 7.15b] A preview reached the host *after* the cast, leaving a ghost aim arrow over the cast VFX.**
AC3's "no trailing message after the fire" holds **on the phone** — verified below — but not **on the wire**. The phone sends previews every ~33ms and the tick is ~33ms, so the last preview of a drag and the release's `ability` message very often land in the same server-side input drain. The sim then broadcast `ability:fired` from its dispatch loop and `ability:aim-preview` afterwards in the same tick; the host applies deltas in receive order, so it cleared the aim on the fire and immediately re-inserted it — a ghost arrow persisting for the full ~150ms staleness window, on roughly every other cast of all six `RELEASE` abilities.

The mobile side could not have fixed this (its send order is already correct); the fix belongs in `GameRoom.broadcastAimPreviews` and is recorded in Story 7.15b's own Review Findings. Noted here because it is the end-to-end consequence of this story's gesture, and because it is a good example of a bug that is invisible from either side alone.

**[Medium — CONFIRMED, FIXED] The e2e test cited as proof of AC3's ordering was structurally incapable of failing.** Its 40ms sleeps guaranteed a tick boundary between the last preview and the fire — exactly the case where the bug does not occur — so the Completion Notes' claim of empirical confirmation was an artifact of the sleep. A no-sleep same-tick test was added (in `tests/e2e/aim-preview.test.ts`) and verified by reintroducing the bug and confirming it fails.

**Confirmed clean, and for stronger reasons than my own notes gave:**
- **`autoIntervalRef` contention: clean.** My comment argued "one `inputType` per effect lifetime". True per-run, but the reviewer identified the actually load-bearing fact — `ability` is in the dep array, so on any class switch or spirit transition React runs the *old* cleanup first, which unconditionally clears the interval and nulls `activeTouchRef` using the old closure. An AUTO interval therefore cannot survive into a RELEASE effect run or vice versa. Verified in both directions and for the `canHoldThroughCooldown → false` and `ability → null` transitions. The correct reasoning is now on record.
- **All four exit paths covered, none gated on `inputType`.** The reviewer enumerated every write to `activeTouchRef.current` in the component and confirmed each null is immediately preceded by the interval clear — so there is no path that nulls the touch while leaving an orphan interval running that a new `setInterval` could overwrite.
- **Phone-side ordering: clean.** `onAbilityFire(...)` then `clearInterval(...)` are consecutive synchronous statements in all three sites; a timer callback cannot interleave.
- **No interval leak.** Both effect early-returns occur before any listener is registered or interval created, and the previous run's cleanup has already fired.
- **AUTO/AIM_CAST unchanged.** `INPUT_INTERVAL_MS` is byte-identical to the replaced literal `33`; the new branch is an `else if`, so the cooldown and zero-aim skips are unreachable from it.
- **`handleAimPreview` is genuinely stable** (`useCallback(..., [])`, reading `sessionRef.current` rather than closing over `session`) — no effect churn for the cells that actually register listeners.
- **No authority violation.** The message carries only expressed intent (`abilityIndex`, direction), never position or derived state, and the direction always originates from `Math.cos/sin` so it is finite.

**Deferred (real, low severity):**
- **[Low, latent] `ability` prop identity is NOT stable for the spirit cell.** It is rebuilt as `{ ...baseAbility, inputType: 'TAP' }` on every parent render, so my dep-array comment's premise is wrong for that one cell. It is harmless *today* only because the effect's first statement is `if (ability.inputType === 'TAP') return;` — no listeners, no interval, nothing to thrash. If the spirit cell ever becomes non-TAP, this effect would tear down and re-add all six listeners ~30×/s and null `activeTouchRef` mid-gesture: precisely the failure my comment warned about. Worth memoizing the override, or at least correcting the comment to state the real reason it is safe.
- **[Low] Previews stream while the player is frozen.** `canHoldThroughCooldown` for non-spirit cells omits an `isFrozen` check that the spirit cell one line above has. A frozen player can start a RELEASE drag and stream ~30 msg/s. No visual consequence — the sim discards frozen players in `broadcastAimPreviews` — so this is wasted uplink only, and the gap is pre-existing for the fire path. Noted because this story multiplies the traffic on it.
- **[Low, process] `tests/e2e/` is outside this story's Allowed paths, yet Task 6 mandates a change there.** CLAUDE.md assigns `tests/**` to QA + Telemetry Engineer. My Completion Notes dismissed the Ownership hook on the grounds that "the only production file changed is `ControllerScreen.tsx`" — but the hook's text is "files outside the assigned ownership area", not "production files". The story is internally inconsistent (Allowed paths vs Task 6), and the same inconsistency exists in several sibling stories in this sprint. Worth resolving in the story template rather than per-story in a note.

**Regression after patches:** `npm run typecheck` clean (10/10); `tests/e2e/aim-preview.test.ts` 8/8; full suite 731 passed, 1 failed (pre-existing Stone Wall centering), 9 skipped (WSL2 e2e port contention).

### Manual Client-UX Pass (2026-08-07) — performed by the user

The user ran the real game across a host screen and a phone and confirmed the feature set works, reporting "almost perfect" on the initial six stories and "works like a charm" after Story 7.15e's `AUTO` continuous-arrow fix. That closes the **Client-UX hook** gate this story disclosed as outstanding — it was the one gate no automated layer in this sandbox could satisfy, and it is now genuinely satisfied rather than waived.

One finding came out of the pass and was fixed rather than deferred: the `AUTO` aim arrow blinked at the cooldown cadence instead of tracking the thumb. See `7-15e-auto-ability-continuous-aim-arrow.md`. No other visual defects were reported — notably no report of the cone ghosts rendering as slivers (the Story 7.13 failure mode this branch's geometry was specifically written to avoid), and no report of host frame-rate trouble with aim previews live, which was the top item flagged for measurement in Story 7.15c.

## Change Log

- 2026-08-05 — Story created from `epics.md` "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" and ADR-0008.
- 2026-08-06 — Implemented. `RELEASE`-type drags now stream `input:aim-preview` on an interval (not a move-throttle, which would go silent on a held thumb), reusing `autoIntervalRef` so all four existing teardown paths cover the stop condition with no new code. Fire behaviour untouched. Status → review.

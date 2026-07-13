---
baseline_commit: f6083d8
---

# Story 3.18: Soul Mend — Ranged Spirit-Targeting Revive

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — most novel/highest-risk story in the batch per the brainstorming
  session's own assessment ("largest, most novel lift"). Depends on 3.11
  (AIM_CAST type + mobile fire-on-release bridge, which THIS story replaces
  with real hold-to-channel behavior).

Context: This is where Story 3.11's mobile `AIM_CAST` bridge gets replaced.
  3.11 made `AIM_CAST` fire-once-on-touch-release (same as `RELEASE`) purely
  so the build wouldn't break and Soul Mend wouldn't become uncastable before
  this story landed. That bridge is now WRONG for Soul Mend's real behavior
  (a multi-second hold-to-channel with early-release cancellation) and must
  be replaced, not left in place alongside new server logic.

  **No wire protocol exists today for "hold" vs "release" as distinct
  signals** — `packages/net-protocol/src/messages/mobile-to-server.ts`'s
  `InputEventMsg` carries a single discrete `{abilityIndex, directionX,
  directionY}` per message; there's no `start`/`stop`/`cancel` message type.
  The EXISTING way "held" input already works for `AUTO` abilities (Lightning
  Arc, etc.): `ControllerScreen.tsx` runs a client-side `setInterval(33ms)`
  while the touch is held, resending the same ability-fire input repeatedly;
  the server has no special "holding" state for AUTO — it just receives
  frequent fire attempts and lets its own cooldown gate the effective rate.

  **Design decision for this story (not spelled out by epics.md, which only
  specifies the observable server behavior, not the wire mechanism):** reuse
  this exact pattern for `AIM_CAST` instead of inventing a new message type.
  Mobile sends Soul Mend fire-attempts every 33ms while the touch is held
  (extend `ControllerScreen.tsx`'s existing `ability.inputType === 'AUTO'`
  interval branch to also cover `'AIM_CAST'`). Server-side: the FIRST
  fire-attempt for a not-yet-channeling player starts the channel; SUBSEQUENT
  fire-attempts while already channeling the SAME ability just refresh a
  GameRoom-local "last input seen" timestamp (not re-validating/restarting
  the channel each message). Each tick, if a channeling player's last input
  timestamp is older than a short liveness threshold (recommend ~150ms — a
  few missed 33ms beats, tolerant of normal jitter but responsive to a real
  release), treat it as "caster released early" and cancel — this is how
  "the caster releases input early" (epics AC) is detected without a new
  wire message. This mirrors AUTO's existing "no explicit stop signal, just
  stop sending" design exactly, so it needs no `packages/net-protocol`
  wire-shape change for the hold/release signal itself — only the 2 new
  delta types (`cast:started`, `cast:cancelled`) and the `channelingAbility`
  state field are new wire/state surface.

  Existing revive pattern to replicate on channel completion (do NOT build a
  new revive code path — copy this one): `GameRoom.ts`'s proximity-revive
  block (~line 1639-1658) does `isDown: false, isSpirit: false, hp:
  REVIVE_HP, reviveTimerExpiresAt: 0`, broadcasts `player:revived` then
  `player:hp-updated`, and sends a `SPIRIT_FORM` message with `isActive:
  false` to the revived client. Soul Mend's completion does the exact same
  4 things, just triggered by channel-completion instead of proximity-contact.

  Target resolution: Soul Mend already has `ABILITY_HIT_RANGE_PX`/
  `ABILITY_HIT_RADIUS_PX` entries in `balance.ts` (Spiritcaller slot 2 —
  verify current values, likely non-zero already from Story 3.4's original
  hit-zone table). Reuse `isInHitZone` against all currently-down players'
  positions to find the aimed target — same directional-cone-check every
  other ability already uses, just querying `PlayerState.isDown` targets
  instead of `EnemyState`.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Protocol Architect (Task 1 — packages/shared-types/**, packages/net-protocol/**)
  Simulation Engineer (Task 2 — packages/game-rules/**, apps/simulation-server/**)
  Mobile Controller Engineer (Task 3 — apps/mobile-controller/**, replaces
    3.11's temporary bridge)

Goal:
  Task 1 — `channelingAbility` field on `PlayerState`; `cast:started`/
            `cast:cancelled` delta types + apply-delta handling.
  Task 2 — Channel start/refresh/cancel/complete logic in `GameRoom.ts`
            (target validation as a pure `game-rules` helper); reuse the
            existing revive-state-transition pattern on completion.
  Task 3 — `ControllerScreen.tsx`: `AIM_CAST` gets AUTO-style continuous-send
            while held; remove the 3.11 bridge's touchend-fire-on-release
            behavior for `AIM_CAST` specifically (leave `RELEASE`'s own
            touchend behavior untouched).

Allowed paths:
  - packages/shared-types/src/player.ts
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - packages/game-rules/src/systems/soul-mend.ts (new — target validation,
    pure)
  - packages/game-rules/src/balance.ts (SOUL_MEND_CHANNEL_DURATION_MS)
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - apps/mobile-controller/src/screens/ControllerScreen.tsx
  - tests/unit/soul-mend.test.ts (new)
  - apps/simulation-server/tests/ (new integration test file, or extend an
    existing one — match this directory's existing naming style)

Blocked paths:
  - Any other Spiritcaller ability (Ancestor's Voice, Spirit Nova, Warding
    Cry) — Story 3.17, do not touch
  - The proximity-based walk-to-body revive flow itself — reuse its output
    shape, do not modify its trigger logic (Soul Mend bypasses it entirely
    for the target it channels on, per epics AC; the proximity flow still
    exists unchanged for every other down/revive scenario)

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.18" section
  - _bmad-output/implementation-artifacts/3-11-ability-input-taxonomy-expansion-and-type-corrections.md — the bridge this story replaces
  - apps/simulation-server/src/rooms/GameRoom.ts:1600-1660 (existing revive
    block — read fully, copy its state-transition + broadcast shape exactly)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx:600-732 (touch
    handling — read fully; identify the exact AUTO-interval code to extend
    and the exact 3.11-added AIM_CAST touchend clause to remove)
  - packages/game-rules/src/balance.ts — confirm current Soul Mend
    `ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX` values before assuming
    they need to change (they may already be tuned from Story 3.4)

Non-goals:
  - Do not build a generic "channeled ability" framework for future
    abilities — Soul Mend is the only `AIM_CAST` ability in the full 16-
    ability spec; a reusable channel system for one consumer is premature.
  - Do not add a new wire message type for hold/start/cancel signals — reuse
    the existing repeated-input-message pattern (see Context).
  - Do not change the walk-to-body proximity revive flow's own trigger logic.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — new `PlayerState.channelingAbility`
    field (session/state shape) and 2 new delta types. Round-trip contract
    tests required.
  - Simulation-safety hook: TRIGGERED — new per-tick liveness/timeout logic;
    deterministic tick test should confirm channel completion timing is
    tick-count/elapsed-ms based, not wall-clock-fragile in tests (use a
    fixed `nowMs` progression in unit tests, matching this codebase's
    existing time-mocking style — check `tests/unit/player-health.test.ts`
    or similar for the established pattern).
  - Client-UX hook: Task 3 (mobile) — reconnect UX check: if a player
    disconnects mid-channel, does the liveness-timeout naturally cancel the
    channel (yes, it should — no input arrives, liveness threshold trips)?
    Verify this is true rather than assumed; add a test for it.
  - Ownership hook: 3 areas — flag to user if narrower split preferred.

Required tests:
  - tests/unit/soul-mend.test.ts — channel-start target validation
    (rejects non-`isDown` targets, respects range), cancel-on-each-cause
    (explicit unit tests for: no-input-timeout, target-no-longer-down,
    caster-out-of-range — as pure `game-rules` logic, not requiring a live
    sim server), completion-revive state transition.
  - A sim-server integration test verifying the channel timer ticks
    correctly across multiple ticks (real multi-tick progression, not just
    a single pure-function call) — add to
    `apps/simulation-server/tests/` matching its existing file-naming
    convention.

Telemetry impact: None — no new user-facing flow beyond what epics.md's ACs
  already describe as gameplay, not analytics.
```

---

## Story

As a Spiritcaller,
I want to channel Soul Mend at a downed ally's spirit from range to revive them directly,
so that I can save a teammate without walking to their body, at the cost of a longer, interruptible cast.

---

## Acceptance Criteria

**AC1 — Channel starts:**
**Given** a player triggers Soul Mend (`AIM_CAST`)
**When** they hold the input aimed at a downed ally's spirit-form position
**Then** the sim server starts a 2–3s channel (duration from a new `balance.ts` constant), tracked per-player in `GameState` via `channelingAbility: { abilityIndex, targetPlayerId, startedAt, durationMs } | null`, and a `cast:started` delta is broadcast

**AC2 — Channel cancels on interruption:**
**Given** a channel is in progress
**When** the caster releases input early, moves out of range, or the target dies or is revived by someone else before completion
**Then** the channel is cancelled server-side, `channelingAbility` is cleared, and `cast:cancelled` is broadcast — no ability effect is applied and Soul Mend does not enter cooldown on a cancelled cast

**AC3 — Target must be a downed ally's spirit:**
**Given** the target must be a downed ally's spirit specifically
**When** the sim validates the Soul Mend target
**Then** it rejects targets not currently in `isDown` state (reuses `PlayerState.isDown`; no new spirit-targeting field), using the same range-limit rule as every other ability (no map-wide exception)

**AC4 — Completion revives:**
**Given** the channel completes without interruption
**When** `nowMs >= startedAt + durationMs`
**Then** the target is revived directly — same state transition as the existing proximity-based revive (`isDown: false`, `reviveTimerExpiresAt: 0`, HP set to `REVIVE_HP`) — bypassing the normal walk-to-body proximity-sensor revive flow entirely, and Soul Mend enters its normal cooldown

**AC5 — Tests:**
**Given** unit and integration tests
**When** `tests/unit/soul-mend.test.ts` runs
**Then** channel-start, cancel-on-each-interrupt-cause, target validation, and completion-revive are covered as pure `game-rules` logic, with a sim-server integration test verifying the channel timer ticks correctly across multiple ticks

---

## Tasks / Subtasks

- [ ] **Task 1a** (AC: #1) — `player.ts`: add
  `channelingAbility: { abilityIndex: number; targetPlayerId: string; startedAt: number; durationMs: number } | null;`
  to `PlayerState`. Update every `PlayerState` construction site to
  `channelingAbility: null`.

- [ ] **Task 1b** (AC: #1, #2) — `server-to-host.ts`: add
  `CastStartedDelta { type: 'cast:started'; casterId: string; targetPlayerId: string; abilityIndex: number; durationMs: number; }`
  and `CastCancelledDelta { type: 'cast:cancelled'; casterId: string; }` —
  add both to `DeltaEventMsg`. `apply-delta.ts`: add matching cases
  updating `state.players`' `channelingAbility` field (set on
  `cast:started`, clear to `null` on `cast:cancelled`; the completion path
  reuses existing `player:revived`/`player:hp-updated` deltas, which
  already clear... actually those don't clear `channelingAbility` today
  since it's a new field — add that clearing to the SAME cases, or add it
  to a `cast:started`-paired completion delta; simplest: just also clear
  `channelingAbility: null` inside `apply-delta.ts`'s existing
  `case 'player:revived':` unconditionally — it's a no-op for
  proximity-revived players who never had it set).

- [ ] **Task 2a** (AC: #3) — `packages/game-rules/src/systems/soul-mend.ts`
  (new): pure `findSoulMendTarget(casterX, casterY, dirX, dirY, downedPlayers:
  PlayerState[], hitRangePx, hitRadiusPx): PlayerState | null` — reuses
  `isInHitZone` (directional, since `AIM_CAST` is aimed) against each
  downed player's position, returns the first/nearest match or `null`.

- [ ] **Task 2b** (AC: #1, #2) — `GameRoom.ts`: add
  `lastSoulMendInputAt: Map<string, number>` (keyed by caster player id,
  GameRoom-local, not on the wire). On receiving a Soul Mend `AIM_CAST`
  input for a player with `channelingAbility === null`: call
  `findSoulMendTarget`; if a valid target is found AND not on cooldown,
  set `channelingAbility = { abilityIndex, targetPlayerId, startedAt: nowMs,
  durationMs: SOUL_MEND_CHANNEL_DURATION_MS }`, broadcast `cast:started`,
  record `lastSoulMendInputAt.set(casterId, nowMs)`. On receiving a Soul
  Mend input for a player ALREADY channeling that ability: just update
  `lastSoulMendInputAt.set(casterId, nowMs)` — do not restart or re-broadcast.
  Do NOT run Soul Mend through the normal instant-resolve ability-dispatch/
  hit-scan path used by every other ability — branch before that (Soul Mend
  is identified by `player.class === SPIRITCALLER && abilityIndex === 2`,
  or more robustly by checking `CLASS_DEFINITIONS[...].abilities[...].inputType
  === 'AIM_CAST'` so the branch generalizes if a future class ever adds
  another `AIM_CAST` ability — prefer the inputType check for that reason).

- [ ] **Task 2c** (AC: #2, #4) — New tick phase in `GameRoom.ts`: for every
  player with `channelingAbility !== null`: (1) if `nowMs -
  lastSoulMendInputAt.get(playerId) > SOUL_MEND_LIVENESS_MS` (recommend
  ~150ms — tune during implementation/playtesting), cancel — clear
  `channelingAbility`, broadcast `cast:cancelled`, delete the liveness map
  entry, continue; (2) look up the target player by `targetPlayerId` — if
  not found, no longer `isDown`, or (per AC2) already revived by someone
  else, cancel the same way; (3) re-check caster is still in range of the
  target (distance check, same range value used at channel-start) — if not,
  cancel the same way; (4) if `nowMs >= channelingAbility.startedAt +
  channelingAbility.durationMs`, complete: apply the EXACT revive-state
  transition from the existing proximity-revive block (~line 1639-1658 —
  copy its 4 actions: state mutation, `player:revived` broadcast,
  `player:hp-updated` broadcast, `SPIRIT_FORM` message to the revived
  client), clear `channelingAbility`, delete the liveness map entry, and
  set Soul Mend's cooldown via the SAME `playerCooldowns` mechanism every
  other ability uses (do not apply cooldown on a cancelled cast — AC2 is
  explicit about this).

- [ ] **Task 3** (AC: #1, #2) — `ControllerScreen.tsx`: extend the
  `if (ability.inputType === 'AUTO')` interval-setup branch (in
  `onTouchStart`, ~line 644) to also cover `'AIM_CAST'` — same
  `setInterval(..., 33)` continuous-fire pattern. Remove the 3.11-added
  `ability.inputType === 'AIM_CAST'` clause from the `onTouchEnd`/
  `onDocumentTouchEnd` fire-on-release condition (both occurrences, ~line
  679 and ~698) — restore those to checking only `'RELEASE'`, since
  `AIM_CAST` no longer fires on release (it fires continuously while held;
  releasing just stops the interval, which is already handled by the
  existing `clearInterval(autoIntervalRef.current)` cleanup shared with
  `AUTO`). Confirm `ABILITY_BADGE_BORDER`'s `AIM_CAST` entry (added in 3.11)
  is still appropriate — no change needed there, just verify.

- [ ] Write `tests/unit/soul-mend.test.ts` per AC5.
- [ ] Add a sim-server integration test for multi-tick channel progression.
- [ ] Add contract round-trip tests for `cast:started`/`cast:cancelled`.
- [ ] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

---

## Dev Notes

### Why liveness-timeout instead of an explicit "stop" message

See the Context section — this deliberately mirrors how `AUTO` abilities
already work in this codebase (no explicit stop signal; the server just
stops receiving fire attempts). Introducing a NEW wire message type for
"cancel" here would be inconsistent with the existing pattern for the only
other "held" input type, and would touch `packages/net-protocol/**`'s
`InputEvent` union (a genuinely bigger, riskier change) for something the
existing repeated-message pattern already solves. If playtesting later shows
the liveness threshold feels laggy, tune `SOUL_MEND_LIVENESS_MS` down — that
requires no protocol change, just a constant tweak.

### Reconnect interaction

If the caster disconnects mid-channel, `GameRoom.ts`'s existing
`onLeave(consented=false)` grace-period freeze logic sets `isFrozen: true`
on the disconnected player — no input messages will arrive from them during
the freeze, so the liveness-timeout naturally cancels the channel within
`SOUL_MEND_LIVENESS_MS`. Verify this actually happens (write the test called
for in the Required hooks section) rather than assuming — the freeze flag
and the channel-cancel logic are two independently-written pieces of code
that happen to compose correctly only if the liveness check doesn't
special-case anything about the caster's frozen state (it shouldn't; the
absence of input is enough).

### Project Context Rules

- **Result<T, E>**: `findSoulMendTarget` returns `PlayerState | null`, not
  `Result` — matches `isInHitZone`'s plain-return style (a "no target found"
  outcome isn't an error condition, it's a normal query result).
- **Disconnected Player Handling** (CLAUDE.md, Critical Don't-Miss Rules):
  do not put a channel-cancelled caster into spirit form or any other
  disconnect-adjacent state — a cancelled channel just clears
  `channelingAbility`, nothing else about the caster's own state changes.
- **Contract-change hook**: real — new `PlayerState` field and 2 new delta
  types. Round-trip tests required for both new deltas; also confirm
  `SnapshotMsg`'s full-state round-trip (existing contract test) still
  passes with the new `channelingAbility` field present.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.18]
- [Source: _bmad-output/implementation-artifacts/3-11-ability-input-taxonomy-expansion-and-type-corrections.md] — the mobile bridge this story replaces
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1600-1660] — existing revive state-transition pattern to copy exactly
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:600-732] — touch handling to extend/un-bridge
- [Source: packages/game-rules/src/systems/combat.ts] — `isInHitZone`, reused for target-aim resolution

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

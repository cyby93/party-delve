---
baseline_commit: 1f9b932
---

# Story dev-4: Debug Invincible/High-Damage Mode

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — (ad-hoc dev-infra fix, no epic assignment)
Context: `GameRoom.ts` already has a NODE_ENV-gated debug block (onCreate,
  lines 334-357):
    if (process.env['NODE_ENV'] !== 'production') {
      this.onMessage('debug:kill-all', (_client: Client) => { ... });
      this.onMessage('debug:kill-boss', (_client: Client) => { ... });
    }
  Both are raw string message types, not part of the `EventNames` enum
  (packages/net-protocol/src/event-names.ts has no `DEBUG_*` entries) or any
  typed message union — fully outside the typed-message convention used
  everywhere else (`EventNames.HOST_START`, `ClassSelectMsg`, etc.), and
  neither touches a specific player: `debug:kill-all` kills every enemy,
  `debug:kill-boss` zeroes `gameState.boss.hp`. This story's toggle is the
  first debug command that must target one specific player, which changes
  the security shape: the existing two commands have no per-client identity
  check at all (gating is 100% env-based — `_client` is unused, prefixed
  `_`), but the established pattern elsewhere in this file for
  "resolve the calling client's own player" is
  `this.gameState.players.find(p => p.id === client.sessionId)`
  (used for CLASS_SELECT line 270, RUN_PROPOSE line 212, VOTE line 238 —
  `client.sessionId` is a Colyseus-assigned, server-trusted identity, never
  client-supplied data). `debug:toggle-god-mode` MUST resolve its target the
  same way — the sending client's own player — never a client-supplied
  target playerId, which would let any connected client toggle god mode for
  someone else.
  Incoming player damage today has THREE independent code paths, only one of
  which goes through the shared pure function:
    - `applyPlayerDamage()` (packages/game-rules/src/systems/player-health.ts,
      lines 14-60) — a pure function already guarding `isDown`/`isSpirit`/
      `isFrozen`. Called from GameRoom.ts at line 1241 (Dark Pact ally HP
      drain), line 2393 (enemy melee attack), and line 2445 (Fate Bond wipe
      cascade, `applyPlayerDamage(partner, partner.hp, ...)` — a full
      self-wipe).
    - Boss stomp — GameRoom.ts lines 1722-1741 — mutates `player.hp` directly
      (`player.hp = Math.max(0, player.hp - BOSS_STOMP_DAMAGE)` at line 1730),
      bypassing `applyPlayerDamage` and its shield/damageReduction pipeline
      entirely. Only guarded by `isDown/isSpirit/isFrozen` at line 1726.
    - Bond proximity drain — GameRoom.ts line 2496 — also mutates `player.hp`
      directly (`Math.max(1, player.hp - BOND_DRAIN_HP_PER_TICK)`), guarded
      by the same three flags at line 2495.
  Because two of these three paths never call `applyPlayerDamage`, gating
  invincibility *inside* that pure function would miss the boss-stomp and
  bond-drain paths. The correct, minimal fix is a guard at each of the five
  read sites in GameRoom.ts (the three `applyPlayerDamage` call sites plus
  the two direct-mutation blocks) — not a signature change to the pure
  function, and not a new field on `PlayerState`.
  Outgoing player-dealt damage has an existing final-multiplier precedent to
  copy: `BOND_DAMAGE_MULT = 1.2` (packages/game-rules/src/balance.ts:283) is
  applied at exactly two sites — GameRoom.ts lines 2102-2104 (`damage`,
  shared by the default hit-scan path at line 2185 and the mixed-faction path
  at line 2129) and lines 2265-2267 (`novaDamage`, Spirit Nova's separate
  expanding-radius sweep). Neither `damage` nor `novaDamage` reaches
  projectile-delivered abilities (Blood Spike, Void Pulse) — those compute
  their own value straight from `ABILITY_DAMAGE` at line 1628
  (`const damage = ABILITY_DAMAGE[projectile.class][...]`) and are NOT run
  through `BOND_DAMAGE_MULT` today. This is a pre-existing gap in the bond
  buff, not something this story introduces or is asked to fix — the debug
  multiplier will have the same footprint (hit-scan + mixed-faction + Spirit
  Nova, not projectiles), flagged as a known limitation below.
  CRITICAL — the boss has no live damage-intake path yet: `grep`-ing every
  `this.gameState.boss.` write site in GameRoom.ts turns up exactly the
  `debug:kill-boss` hp=0 write (line 355) and two position writes (lines
  1810-1811); there is NO site where a player ability's damage is applied to
  `gameState.boss.hp`. This matches sprint-status.yaml's note for story 6-7
  ("Boss Combat Resolution Wiring", currently `ready-for-dev`, not yet
  implemented): "every hit-resolution loop in GameRoom.ts only checked
  gameState.enemies, never gameState.boss." So today, a high-damage multiplier
  has real effect against regular enemies but ZERO effect against the boss —
  there is nothing to multiply until 6-7 wires boss hit resolution. Do not
  attempt to fix that here (out of this story's scope — it's 6-7's job); just
  don't be surprised when manual testing shows god-mode damage doing nothing
  to the boss.
  `PlayerState` (packages/shared-types/src/player.ts) already has the exact
  boolean-flag precedent this story could extend (`isFrozen`, `isDown`,
  `isSpirit`) — but adding a `godMode` field there is a `packages/shared-types`
  change, which per CLAUDE.md's Contract-Change Hook requires Protocol
  Architect review + a contract test + spec/ADR update. That's disproportionate
  ceremony for a debug-only toggle with no wire-visible effect on other
  clients. GameRoom.ts already has multiple precedents for exactly this kind
  of non-replicated, room-local per-player state living outside `GameState`
  entirely — `private bondsInRange = new Set<string>()` (line 137),
  `private returnReadySet = new Set<string>()` (line 145) — so god mode is
  tracked the same way: `private godModePlayerIds = new Set<string>()`,
  keyed by `player.id` (== `client.sessionId`). This keeps the change 100%
  inside Simulation Engineer's ownership (no shared-types/net-protocol touch,
  no contract-change hook triggered).
Owner agent: Simulation Engineer
Goal: Add a third NODE_ENV-gated debug message, `debug:toggle-god-mode`,
  registered in the same `if (process.env['NODE_ENV'] !== 'production')`
  block as `debug:kill-all`/`debug:kill-boss` (GameRoom.ts lines 334-357).
  On receipt, resolve the target player via `client.sessionId` (never a
  client-supplied id) and toggle their id in/out of a new
  `private godModePlayerIds = new Set<string>()` room-local field. While a
  player's id is in that set: (A) every incoming-damage path that can reduce
  their HP is short-circuited to a no-op (the three `applyPlayerDamage` call
  sites plus the boss-stomp and bond-drain direct-mutation blocks), and
  (B) their outgoing damage through the two existing `BOND_DAMAGE_MULT`
  multiplier sites is additionally multiplied by a new
  `DEBUG_GOD_MODE_DAMAGE_MULT` constant in balance.ts.
Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts   (MODIFY)
  - packages/game-rules/src/balance.ts             (MODIFY — new constant only)
  - packages/game-rules/src/index.ts               (MODIFY — export the new constant)
Blocked paths:
  - packages/shared-types/**   (no new PlayerState/GameState field — see
    Context; god mode is GameRoom-local Set<string> state, not schema)
  - packages/net-protocol/**   (no new EventNames entry, no new typed message,
    no new DeltaEventMsg variant — follow debug:kill-all/debug:kill-boss's
    exact untyped string-literal precedent; no wire-visible broadcast of
    god-mode state to other clients)
  - packages/game-rules/src/systems/player-health.ts  (do not change
    `applyPlayerDamage`'s signature or add a godMode param to it — gate at
    the GameRoom.ts call sites instead, since 2 of the 3 incoming-damage
    paths bypass this function entirely anyway — see Context)
  - packages/game-rules/src/systems/combat.ts   (same — `applyDamage` stays
    untouched; the multiplier is applied to the `damage`/`novaDamage` value
    in GameRoom.ts before it's passed in, same as BOND_DAMAGE_MULT already is)
  - apps/host-client/**       (no host UI button — see Non-goals)
  - apps/mobile-controller/**  (no mobile UI button — see Non-goals)
  - tests/**                   (QA + Telemetry Engineer ownership)
Inputs:
  - apps/simulation-server/src/rooms/GameRoom.ts            (current)
  - packages/game-rules/src/balance.ts                       (current)
  - packages/game-rules/src/index.ts                         (current)
  - packages/game-rules/src/systems/player-health.ts        (current, read-only reference)
  - packages/game-rules/src/systems/combat.ts               (current, read-only reference)
Non-goals:
  - Any client UI trigger (host or mobile) for this message. Kill All/Kill
    Boss have host-client buttons (DungeonScreen.tsx lines 727-760,
    host-session.ts lines 75-76) invoked from the HOST's own Colyseus
    connection — but the host connects with `{isHost: true}` and its
    `room.sessionId` is NOT a player id (the host is a display-only
    spectator client per project architecture, never in `gameState.players`).
    Because `debug:toggle-god-mode` must target the CALLER's own player via
    `client.sessionId`, it can only be meaningfully invoked from a MOBILE
    controller connection (mobile-session.ts confirms `playerId: room.sessionId`
    — the mobile client's sessionId IS its player id). A host-client button
    would silently no-op (host isn't in `gameState.players`). Building a
    mobile-controller trigger is Mobile Controller Engineer territory (a
    second ownership area) and — per CLAUDE.md's mobile minimal-UI rule — is
    its own small decision (button vs. gesture vs. debug-only route) that
    deserves its own tightly-scoped follow-up story rather than silently
    expanding this one across two owners. Flagged as an open question below.
  - Fixing the boss's missing damage-intake path (story 6-7's job — see
    Context). This story's outgoing-damage multiplier is fully wired and
    correct; it simply has no effect on the boss until 6-7 lands, same as
    every other player ability today.
  - Extending the multiplier to projectile-delivered abilities (Blood Spike,
    Void Pulse) — matches `BOND_DAMAGE_MULT`'s existing footprint exactly
    (see Context); fixing that pre-existing gap for both multipliers at once
    is out of scope here.
  - Any wire broadcast/visual indicator telling other players or the host
    that a player has god mode on — server-side effect + a log line only.
  - A per-difficulty or per-class god-mode damage table — one flat global
    `DEBUG_GOD_MODE_DAMAGE_MULT` constant, matching `BOND_DAMAGE_MULT`'s own
    "one flat constant" shape.
Acceptance criteria:
  AC1: `debug:toggle-god-mode` is registered inside the existing
       `if (process.env['NODE_ENV'] !== 'production')` block (GameRoom.ts
       lines 334-357) — in a production deployment (`NODE_ENV=production`)
       the handler is never registered and the message has no effect,
       identical to `debug:kill-all`/`debug:kill-boss`.
  AC2: On receipt, the handler resolves the target exclusively via
       `this.gameState.players.find(p => p.id === client.sessionId)` (the
       sending client's own player) — there is no code path where one
       client's message can toggle god mode for a different player's id.
  AC3: If no player is found for `client.sessionId` (e.g. a host connection,
       or a mobile client that hasn't picked a class yet), the handler is a
       no-op — no throw, no state change.
  AC4: Sending the message toggles membership: first send adds the player's
       id to `godModePlayerIds` (on), a second send from the same player
       removes it (off).
  AC5: While a player's id is in `godModePlayerIds`, they take zero damage
       and are never downed via: enemy melee attack (GameRoom.ts ~line 2393),
       Dark Pact ally HP drain (~line 1241), Fate Bond wipe cascade
       (~line 2445), boss stomp (~line 1730), and bond proximity drain
       (~line 2496) — all five existing incoming-damage sites.
  AC6: While a player's id is in `godModePlayerIds`, their outgoing damage
       through the hit-scan/mixed-faction path (~lines 2100-2104) and the
       Spirit Nova sweep (~lines 2265-2267) is multiplied by
       `DEBUG_GOD_MODE_DAMAGE_MULT` (new constant, `packages/game-rules/src/balance.ts`),
       stacking multiplicatively with the existing `BOND_DAMAGE_MULT` if both
       apply.
  AC7: When a player leaves permanently (`onLeave`, `CloseCode.CONSENTED`),
       their id is removed from `godModePlayerIds` — no stale entry survives
       past the session (matches the existing cleanup pattern for
       `cooldownMap`/`spiritCooldownMap`/etc. at GameRoom.ts lines 451-455).
  AC8: Each toggle logs `logger.info({ roomId, clientId, godMode }, 'debug:toggle-god-mode')`
       — unlike `debug:kill-boss` (which has no logging at all today), this
       command's invocations are auditable.
Required hooks:
  - Simulation-safety hook (apps/simulation-server/**, packages/game-rules/**
    touched):
    - typecheck: `npm run typecheck` (or workspace equivalent) — 0 errors.
    - unit tests: run the full existing suite
      (`packages/game-rules/tests/**`, `tests/unit/**`,
      `apps/simulation-server/tests/**`) — must stay green; no regressions.
      No new automated test is required for this story specifically (see
      Required tests below), but existing coverage for `applyPlayerDamage`,
      `applyDamage`, boss stomp, bond drain, and the ability hit-scan path
      must not break, since all five gates and both multiplier sites sit
      directly in code those tests already exercise.
    - deterministic tick test: N/A — no PRNG/seed logic touched.
    - replay test: none exists for this feature area; skip.
    - perf sanity: negligible — each guard adds one `Set.has()` (O(1)) read
      per existing loop iteration; no new allocation in the tick loop.
Required tests: None new. `debug:kill-all`/`debug:kill-boss` have zero
  existing test coverage (confirmed — no test file references either
  string), and every `apps/simulation-server/tests/game-room-*.test.ts` file
  tests GameRoom logic by re-implementing it in a standalone function rather
  than instantiating a live `Room`/calling `onMessage` handlers directly (see
  e.g. `game-room-host-join.test.ts`'s own doc comment) — there is no
  lightweight harness to unit-test an `onMessage` registration without
  building new test infrastructure, which is QA + Telemetry Engineer's
  domain (`tests/**`), not this story's. Manual verification (below)
  substitutes, matching dev-1/dev-2/dev-3's precedent for dev-infra fixes.
  Manual test procedure (no client UI exists yet — see Non-goals): connect a
  Colyseus client directly (e.g. `@colyseus/sdk`'s `Client`, the same library
  `apps/mobile-controller`/`apps/host-client` already use) as a joined,
  class-selected player, then call `room.send('debug:toggle-god-mode', '')`
  twice to confirm the on/off toggle, verify HP stays fixed under
  enemy/Dark-Pact/bond-drain damage while toggled on, and verify enemy HP
  drops by the multiplied amount on the next ability hit.
Telemetry impact: None — this is a debug-only dev tool with `logger.info`
  auditability (AC8), not a player-facing flow; no KPI mapping applies (same
  precedent as dev-1/dev-2/dev-3).
```

## Story

As a developer testing combat balance solo or with 1-2 players,
I want a debug toggle that makes my character invincible and deal much more damage,
so that I can test enemy and boss encounters without dying to a full-party-tuned difficulty curve.

## Acceptance Criteria

1. **Given** the existing `NODE_ENV`-gated debug block (`debug:kill-all`, `debug:kill-boss`), **when** a new `debug:toggle-god-mode` message is registered, **then** it lives inside the same `if (process.env['NODE_ENV'] !== 'production')` guard and is never registered (never reachable) in a production deployment.
2. **Given** a connected client sends `debug:toggle-god-mode`, **when** the handler resolves the target player, **then** it always uses `this.gameState.players.find(p => p.id === client.sessionId)` — the sender's own player, never a client-supplied target id — so no client can toggle god mode for another player.
3. **Given** the sending client has no matching player (e.g. host connection, or not yet class-selected), **when** the message is handled, **then** it is a silent no-op.
4. **Given** a player is not currently in god mode, **when** they send the message, **then** their id is added to the room-local god-mode set (on); sending it again removes it (off).
5. **Given** a player is in god mode, **when** any of the five existing incoming-damage paths would apply to them (enemy melee, Dark Pact ally drain, Fate Bond wipe, boss stomp, bond proximity drain), **then** no HP is deducted and they are never downed by any of those paths.
6. **Given** a player is in god mode, **when** they deal damage through the hit-scan/mixed-faction path or the Spirit Nova sweep, **then** the damage is multiplied by a new `DEBUG_GOD_MODE_DAMAGE_MULT` constant defined in `balance.ts`, stacking with the existing Proximity Bond `BOND_DAMAGE_MULT` if both are active.
7. **Given** a player leaves the session permanently, **when** `onLeave` runs its consented-leave cleanup, **then** their id is removed from the god-mode set.
8. **Given** the toggle fires, **when** it changes state, **then** a `logger.info` line records the room, client, and new god-mode state.

## Tasks / Subtasks

- [x] T1: `packages/game-rules/src/balance.ts` — add the debug damage multiplier constant (AC6)
  - [x] T1.1: Add a new `// ── Debug / Dev Tools ─────...` section (after the `BOSS_STOMP_DAMAGE` line, end of file) with `export const DEBUG_GOD_MODE_DAMAGE_MULT = 10;  // Debug-only: multiplies outgoing damage while god mode is toggled on`.
- [x] T2: `packages/game-rules/src/index.ts` — export the new constant (AC6)
  - [x] T2.1: Add `DEBUG_GOD_MODE_DAMAGE_MULT` to the existing `export { BOND_TYPE_COLORS, BOND_PROXIMITY_RANGE_PX, ... } from './balance.js';` line (~line 62), or a new adjacent `export { ... } from './balance.js';` line — either is fine, just make it importable from `'game-rules'`.
- [x] T3: `apps/simulation-server/src/rooms/GameRoom.ts` — room-local state + message handler (AC1-4, AC7, AC8)
  - [x] T3.1: Add `private godModePlayerIds = new Set<string>();` near the other room-local `Set<string>` fields (e.g. next to `bondsInRange`/`returnReadySet`, ~lines 137-145).
  - [x] T3.2: Inside the `if (process.env['NODE_ENV'] !== 'production') { ... }` block (lines 334-357), add a third `this.onMessage('debug:toggle-god-mode', (client: Client) => { ... })` handler: resolve `player = this.gameState.players.find(p => p.id === client.sessionId)`, return early if not found (AC3), otherwise toggle `client.sessionId` in `godModePlayerIds` and log via `logger.info({ roomId: this.roomId, clientId: client.sessionId, godMode: <new state> }, 'debug:toggle-god-mode')` (AC1, AC2, AC4, AC8).
  - [x] T3.3: In `onLeave`'s `CloseCode.CONSENTED` branch (~lines 448-455, alongside the other `.delete(client.sessionId)` cleanup calls), add `this.godModePlayerIds.delete(client.sessionId);` (AC7).
  - [x] T3.4: Import `DEBUG_GOD_MODE_DAMAGE_MULT` into GameRoom.ts's existing big `import { ... } from 'game-rules';` line (line 15).
- [x] T4: `apps/simulation-server/src/rooms/GameRoom.ts` — gate the five incoming-damage sites (AC5)
  - [x] T4.1: Dark Pact ally drain (~line 1241) — before computing `drainAmount`/calling `applyPlayerDamage`, skip if `this.godModePlayerIds.has(this.gameState.players[targetIdx]!.id)`.
  - [x] T4.2: Enemy melee attack target selection (~line 2382) — extend the existing guard `if (player.isDown || player.isSpirit || player.isFrozen) continue;` to also exclude `|| this.godModePlayerIds.has(player.id)`, so a god-mode player is never even selected as a melee target.
  - [x] T4.3: Fate Bond wipe cascade (~line 2444, right after `if (!partner) continue;`) — add `if (this.godModePlayerIds.has(partner.id)) continue;` before `applyPlayerDamage(partner, partner.hp, ...)` is called.
  - [x] T4.4: Boss stomp (~line 1726) — extend the existing guard `if (player.isDown || player.isSpirit || player.isFrozen) continue;` to also exclude `|| this.godModePlayerIds.has(player.id)`.
  - [x] T4.5: Bond proximity drain (~line 2495) — extend the existing guard `if (!player || player.isDown || player.isSpirit || player.isFrozen) continue;` to also exclude `|| this.godModePlayerIds.has(player.id)`.
- [x] T5: `apps/simulation-server/src/rooms/GameRoom.ts` — apply the outgoing damage multiplier (AC6)
  - [x] T5.1: Hit-scan/mixed-faction shared `damage` value (~lines 2102-2104) — after the existing `BOND_DAMAGE_MULT` ternary, additionally multiply by `DEBUG_GOD_MODE_DAMAGE_MULT` when `this.godModePlayerIds.has(clientId)` (combine both multipliers into one computed factor so they stack correctly, e.g. `const mult = (proximityBuffed.has(clientId) ? BOND_DAMAGE_MULT : 1) * (this.godModePlayerIds.has(clientId) ? DEBUG_GOD_MODE_DAMAGE_MULT : 1); const damage = mult !== 1 ? Math.round(rawDamage * mult) : rawDamage;`).
  - [x] T5.2: Spirit Nova sweep `novaDamage` (~lines 2265-2267) — same pattern, keyed on `nova.casterId` instead of `clientId`.

### Review Findings

Reviewed by 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the
uncommitted diff (`GameRoom.ts`, `balance.ts`, `index.ts`). Acceptance Auditor: 0 violations, all
8 ACs verified against live source. 0 decision_needed, 1 patch, 1 defer, 13 dismissed as noise
(false positives or already-scoped-out by this story's own Non-goals — see Change Log for the
full breakdown).

- [x] [Review][Patch] `onLeave`'s grace-period-expiry branch never deletes `godModePlayerIds` — every sibling field (`cooldownMap`, `spiritCooldownMap`, `lastKnownJoystick`, `classSelectLastAccepted`, `lastSoulMendInputAt`) is cleaned up in *both* the `CONSENTED` branch and the grace-period `catch` block, but `godModePlayerIds` only got the `CONSENTED` one — a stale entry survives for the room's lifetime whenever a disconnected player's grace period expires without reconnecting [apps/simulation-server/src/rooms/GameRoom.ts:~539-543] — **fixed**: added `this.godModePlayerIds.delete(client.sessionId);` to the catch block, mirroring the 5 sibling cleanup calls
- [x] [Review][Defer] No guard against a stray `debug:toggle-god-mode` message reaching a production server — the message type is unregistered outside dev (`WITH_ERROR`/4002 disconnect on receipt), a risk already shared by the pre-existing `debug:kill-all`/`debug:kill-boss` handlers and not introduced or worsened by this story [apps/simulation-server/src/rooms/GameRoom.ts:334-372] — deferred, pre-existing

## Dev Notes

### Why this story stays inside `apps/simulation-server` + `packages/game-rules` only

Two tempting expansions were deliberately cut, both explained above in
Non-goals:

1. **No `PlayerState.godMode` field.** `packages/shared-types` is Protocol
   Architect territory, and CLAUDE.md's Contract-Change Hook would require a
   Protocol Architect review, a compatibility checklist, and a new contract
   test for a debug-only toggle with zero wire-visible effect on other
   clients. GameRoom.ts already has the right pattern for this: room-local
   `Set<string>` state that never touches `GameState` (`bondsInRange`,
   `returnReadySet`). Use that, not a schema field.
2. **No client UI button.** This was the harder call — Kill All/Kill Boss
   *do* have host-client buttons (`DungeonScreen.tsx` lines 727-760), so it's
   tempting to mirror that. But those two commands are global (no target
   player needed), so it doesn't matter that the host's own Colyseus
   connection isn't a player. `debug:toggle-god-mode` is inherently
   per-player and MUST resolve via the *sending* client's own
   `client.sessionId` (AC2) — and the host client's `room.sessionId` is not
   in `gameState.players` at all (host joins with `{isHost: true}` as a
   display-only spectator). A host button would silently no-op. The only
   client whose `sessionId` *is* a player id is the mobile controller
   (`mobile-session.ts`: `playerId: room.sessionId`) — so a UI trigger, if
   built, belongs on the phone, not the host screen, and that's a Mobile
   Controller Engineer decision (minimal-UI constraint, tap-target design)
   deserving its own follow-up story rather than folding a second owner into
   this one.

### The one mistake that will break this story: gating in the wrong place

Do **not** add a `godMode` check inside `applyPlayerDamage()`
(`packages/game-rules/src/systems/player-health.ts`) and call it done. Two of
the three incoming-damage paths — boss stomp (GameRoom.ts line 1730) and
bond proximity drain (line 2496) — mutate `player.hp` directly and never
call `applyPlayerDamage` at all. A god-mode player would still take stomp and
bond-drain damage if the only guard lives inside that pure function. All five
sites listed in T4 must be patched independently in GameRoom.ts.

### Boss damage multiplier will appear to do nothing — that's expected, not a bug

`gameState.boss.hp` is currently only ever written by `debug:kill-boss` (hp=0)
and two position-sync lines — no player ability applies damage to it yet.
Story 6-7 (`boss-combat-resolution-wiring`, sprint-status.yaml: `ready-for-dev`)
is the fix for that gap. Verify AC6 against regular enemies during manual
testing; do not treat "boss HP doesn't move" as a dev-4 regression — it's a
pre-existing, already-tracked gap.

### `BOND_DAMAGE_MULT`'s existing gap is not this story's to fix

Projectile-delivered abilities (Blood Spike, Void Pulse) compute damage
straight from `ABILITY_DAMAGE` at the projectile-hit-resolution site
(GameRoom.ts line 1628) and never pass through `BOND_DAMAGE_MULT` or
`proximityBuffed` at all. `DEBUG_GOD_MODE_DAMAGE_MULT` inherits the same gap
by design (T5 only touches the two sites `BOND_DAMAGE_MULT` already touches)
— don't scope-creep into fixing projectile damage scaling for either
multiplier here.

### Security framing (why this is safe to ship)

Three independent layers keep this unreachable/unabusable in a real session:

1. **Env gate (existing precedent):** registered only when
   `NODE_ENV !== 'production'`, exactly like `debug:kill-all`/`debug:kill-boss`
   — no new gating mechanism invented.
2. **Self-targeting only (new, and stricter than the existing two commands):**
   the handler *always* resolves the target via the caller's own
   `client.sessionId`, which Colyseus assigns and the client cannot spoof.
   There is no client-supplied `targetPlayerId` parameter anywhere in this
   message's payload — one client toggling another player's god mode is not
   a code path that exists, not something merely blocked at runtime.
3. **Auditability (new, stricter than `debug:kill-boss`, which logs
   nothing):** every toggle logs `roomId`/`clientId`/new-state via
   `logger.info` (AC8), so any non-prod environment where this fires leaves a
   trace.

One residual, pre-existing risk this story does not change: nothing in the
repo (`package.json`'s `start` script is a bare `node dist/index.js`, no
`Dockerfile`/CI config sets `NODE_ENV`) *enforces* that a real deployment
actually sets `NODE_ENV=production`. That's a pre-existing gap shared by
`debug:kill-all`/`debug:kill-boss` today, not introduced or worsened by this
story — flagged as an open question below rather than silently expanded into
this story's scope (deploy/CI config is outside `apps/simulation-server`/
`packages/game-rules`).

### Project Context Rules

- Simulation Engineer owns both touched paths exclusively
  (`apps/simulation-server/**`, `packages/game-rules/**`) — no cross-context
  approval needed for this story's actual diff.
- `packages/game-rules` functions must stay pure (no I/O, no Colyseus/planck
  imports) — this story does not add any new function there, only a constant
  and its export; all stateful gating lives in GameRoom.ts as planned.
- Configuration Hierarchy (project-context.md): the new multiplier belongs in
  `packages/game-rules/balance.ts` (tier 2, tunable gameplay values) — not a
  `.env` var, not a shared-types constant. Matches `BOND_DAMAGE_MULT`'s tier.
- No `Math.random()` — this feature adds no randomness.
- No `@Schema`/`MapSchema`/`this.state.*` — god mode stays a plain
  `Set<string>` field on the Room instance, consistent with Colyseus-usage-
  boundary rules and the existing `bondsInRange`/`returnReadySet` precedent.

### References

- [Source: apps/simulation-server/src/rooms/GameRoom.ts:334-357] — existing `debug:kill-all`/`debug:kill-boss` NODE_ENV gate (registration pattern to extend)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:212, 238, 270] — `client.sessionId` self-resolution precedent (CLASS_SELECT, RUN_PROPOSE, VOTE)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:194-195] — `HOST_START`'s identity-check precedent (`client.sessionId !== this.gameState.session.hostId`) — the only existing privileged-action identity gate in the file
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1241, 2393, 2445] — the three `applyPlayerDamage` call sites (Dark Pact drain, enemy melee, Fate Bond wipe)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1722-1741] — boss stomp direct `player.hp` mutation (bypasses `applyPlayerDamage`)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:2479-2499] — bond proximity drain direct `player.hp` mutation (bypasses `applyPlayerDamage`)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:2100-2104, 2185, 2129] — shared hit-scan/mixed-faction `damage` value and its two `applyDamage` consumers
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:2259-2275] — Spirit Nova's separate `novaDamage` multiplier site
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1618-1629] — projectile hit resolution computing damage straight from `ABILITY_DAMAGE`, bypassing both `BOND_DAMAGE_MULT` and (by design) this story's multiplier
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:444-473] — `onLeave` CONSENTED cleanup pattern (`cooldownMap.delete`, etc.) to extend
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:118-185] — existing room-local `Set<string>`/`Map<string,...>` fields precedent (`bondsInRange`, `returnReadySet`, etc.)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:352-356, 5] — boss has no live damage-intake path (`gameState.boss.` write sites are only debug:kill-boss + position sync)
- [Source: packages/game-rules/src/systems/player-health.ts:14-60] — `applyPlayerDamage` (do not modify signature)
- [Source: packages/game-rules/src/systems/combat.ts:15-37] — `applyDamage` (do not modify signature)
- [Source: packages/game-rules/src/balance.ts:283, 303] — `BOND_DAMAGE_MULT`/`BOSS_STOMP_DAMAGE` naming/section-banner convention to follow for the new constant
- [Source: packages/game-rules/src/index.ts:62] — barrel-export line to extend
- [Source: packages/shared-types/src/player.ts:21-44] — `PlayerState`'s existing boolean-flag pattern (`isFrozen`/`isDown`/`isSpirit`) — referenced, not extended (see Non-goals)
- [Source: packages/net-protocol/src/event-names.ts] — confirms no `DEBUG_*` entries exist (untyped precedent to keep following)
- [Source: apps/host-client/src/session/host-session.ts:75-76] and [apps/host-client/src/screens/DungeonScreen.tsx:727-760] — Kill All/Kill Boss host button precedent (why it does NOT transfer to this story — host isn't a player)
- [Source: apps/mobile-controller/src/session/mobile-session.ts:134, 174] — confirms mobile client's `room.sessionId` IS its player id (why a future UI trigger belongs on mobile, not host)
- [Source: apps/simulation-server/tests/game-room-host-join.test.ts:1-7] — doc comment confirming GameRoom test files re-implement logic in standalone functions rather than instantiating a live Room (why no new automated test is required here)
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — story 6-7 (`boss-combat-resolution-wiring`, `ready-for-dev`) confirms the boss-damage-intake gap is already tracked, not this story's to fix
- [Source: _bmad-output/planning-artifacts/epics.md#Story dev-4] — AC source
- [Source: _bmad-output/implementation-artifacts/dev-3-controller-fullscreen-toggle.md] — sibling dev-infra story; format/structure precedent

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (gds-dev-story workflow)

### Debug Log References

- `npm run typecheck` — 0 errors, all 10 workspace tsconfigs.
- `npm run test` (vitest run) — 33 files / 425 tests passed, 10 pre-existing skips, 0 regressions.
  4 e2e files (`reconnect`, `full-run`, `ability-dispatch`, `hub-ability-use`) failed with
  "simulation-server did not start within 60s". Root-caused via `tsx src/index.ts` /
  `node dist/index.js` run directly: the Colyseus server never binds its port in this sandbox
  (no log output, no listening socket, even after 20s — not a port conflict, not a Docker/Redis
  dependency since `REDIS_HOST` is unset so `LocalPresence` is used). Confirmed unrelated to this
  story's diff by `git stash` / `stash pop` — same 4 files fail identically against the pre-change
  baseline. Matches the sandbox limitation already logged by every prior dev-infra story
  (dev-3/dev-5: "no display/browser in the dev environment"). Two-strike QA: root-caused, one
  extra manual re-run performed (not a second `npm test` retry, since the failure is
  environmental/infrastructural, not flaky) — no third attempt made.

### Completion Notes List

- Implemented exactly per the story's Task list (T1–T5) with no deviation — every touched line
  number in the header's Context section matched the current source after accounting for line
  drift from earlier stories.
- T1/T2: `DEBUG_GOD_MODE_DAMAGE_MULT = 10` added to `balance.ts` under a new `// ── Debug / Dev
  Tools ──` banner, barrel-exported from `index.ts` alongside the other `balance.js` re-exports.
- T3: `godModePlayerIds` room-local `Set<string>` added next to `returnReadySet`; `debug:toggle-
  god-mode` registered as a third handler inside the existing `NODE_ENV !== 'production'` block,
  resolving the target exclusively via `client.sessionId` (AC2/AC3), toggling membership (AC4),
  and logging `{ roomId, clientId, godMode }` on every fire (AC8). Cleanup added to `onLeave`'s
  `CloseCode.CONSENTED` branch only (AC7's literal scope) — the grace-period-expiry branch
  (a separate `catch` block further down performing the same slot-removal cleanup) was
  deliberately left untouched since AC7/T3.3 scope this to the CONSENTED path specifically;
  flagged as an open question below since a player who never reconnects after disconnecting
  would otherwise leave a stale entry.
- T4: all five incoming-damage sites gated — Dark Pact ally drain (early-return before
  `applyPlayerDamage`), enemy melee target selection, Fate Bond wipe cascade, boss stomp, and
  bond proximity drain (the last three via extending existing `isDown || isSpirit || isFrozen`
  guards, matching the story's specified pattern exactly).
- T5: outgoing damage multiplier applied at both `BOND_DAMAGE_MULT` sites (hit-scan/mixed-faction
  `damage` and Spirit Nova's `novaDamage`), computed as one combined factor so god mode and the
  Proximity Bond buff stack multiplicatively (AC6), matching the story's suggested pattern.
- No new automated test added, per the story's own "Required tests: None new" — `debug:kill-all`/
  `debug:kill-boss` have zero prior coverage and no GameRoom test file instantiates a live Room to
  call `onMessage` handlers directly (confirmed, matches the story's stated reasoning).
- **Manual verification not performed this session** — no live Colyseus client is available in
  this sandbox (the server itself couldn't be brought up here either, see Debug Log). The story's
  manual test procedure (connect a client, toggle twice, verify HP-fixed-under-damage and
  multiplied enemy damage) still needs a human pass, same precedent as dev-3/dev-5.
- Resolved by code review (see Review Findings): `godModePlayerIds` is now also cleaned up in
  `onLeave`'s grace-period-expiry `catch` block, matching the 5 sibling fields that were already
  cleaned up in both branches. The open question flagged above (AC7 only literally named
  CONSENTED) was decided in favor of consistency with the existing codebase pattern rather than
  the AC's narrower literal wording — a 1-line hygiene fix, not a new feature.
- Confidence: 75% — code changes match the story's Context/Task section exactly (every line
  number and pattern verified against current source before editing) and the full unit/contract
  suite (425 tests) is green with zero regressions, but the story's own required manual
  verification procedure could not be run in this sandbox (no live server, no Colyseus client),
  so AC1–AC8 are verified by code inspection and existing-test-suite non-regression only, not by
  an actual `debug:toggle-god-mode` round trip against a running room.

### File List

- `packages/game-rules/src/balance.ts` (modified — new `DEBUG_GOD_MODE_DAMAGE_MULT` constant)
- `packages/game-rules/src/index.ts` (modified — barrel-export the new constant)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — `godModePlayerIds` field,
  `debug:toggle-god-mode` handler, `onLeave` cleanup, five incoming-damage guards, two outgoing-
  damage multiplier sites)
- `apps/mobile-controller/src/session/mobile-session.ts` (modified — added
  `sendDebugToggleGodMode` to `MobileSession`; post-review addendum, see Change Log)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (modified — added a dev-build-only
  (`import.meta.env.DEV`-gated) button that calls it; post-review addendum, see Change Log)

## Change Log

- 2026-07-15: Story created (Cyby)
- 2026-07-17: Implemented T1–T5 (dev agent). Full unit/contract suite green (425 passed, 0
  regressions); typecheck clean. 4 pre-existing e2e test files fail in this sandbox due to an
  environmental limitation (simulation-server cannot bind a port here) confirmed unrelated to
  this diff. Manual live-verification deferred to the user (no live client/server available in
  this session). Status → review.
- 2026-07-17: Code review (3 parallel layers: Blind Hunter, Edge Case Hunter, Acceptance
  Auditor) — 0 decision_needed, 1 patch, 1 defer, 13 dismissed as noise. Acceptance Auditor: 0
  AC violations, all 8 ACs verified clean against live source. Patch applied: `onLeave`'s
  grace-period-expiry branch now also deletes `godModePlayerIds` (was only cleaned up in the
  `CONSENTED` branch, unlike every sibling field). 1 finding deferred (D-dev4-A,
  deferred-work.md: no guard against a stray `debug:toggle-god-mode` message reaching a
  production server — pre-existing risk shared by `debug:kill-all`/`debug:kill-boss`). Full
  non-e2e suite re-verified green after the patch (425 passed, typecheck clean). Manual
  live-verification (the story's own test procedure) still needs a human pass — no live
  client/server available in this sandbox. Status → done.
- 2026-07-17: Post-review addendum (user-requested, same session) — the mobile UI trigger this
  story's own Non-goals explicitly deferred to "its own tightly-scoped follow-up story" was
  never actually turned into a follow-up story, so the feature had shipped with no way to
  invoke it from a running app at all. Added a minimal fix: `MobileSession.
  sendDebugToggleGodMode()` (mobile-session.ts) and a small `import.meta.env.DEV`-gated button
  in `ControllerScreen.tsx` (client-side mirror of the server's `NODE_ENV` gate — absent from
  production builds). No visual confirmation of god-mode state is shown (matches the server's
  own no-ack-broadcast design). Typecheck clean; not covered by the automated suite (same
  no-test precedent as the rest of this story — UI-only debug tooling). Not run through a
  separate code review pass; small enough and reviewed inline against the same constraints as
  the rest of this story.
- 2026-07-17: User live-tested the mobile god-mode button and found Storm Eye (Stormcaller)
  damage isn't multiplied. Root-caused: damage is computed independently per ability-delivery
  type across 5 separate `GameRoom.ts` sites, and only 2 (hitscan/mixed-faction, Spirit Nova)
  ever apply a multiplier — `BOND_DAMAGE_MULT` already had this exact gap (Storm Eye + both
  projectile abilities never got the Bond buff either), and `DEBUG_GOD_MODE_DAMAGE_MULT`
  inherited it by design. Logged as **D-dev4-B** in `deferred-work.md`, flagged high-priority/
  foundational per the user's explicit request (affects every future multiplicative system, not
  just this debug tool) — not fixed in this session, deferred to a dedicated follow-up story.

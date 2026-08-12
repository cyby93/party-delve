---
baseline_commit: f5b9748
---

# Story 7.14a: Hub `ability:fired` Broadcast

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. Sequenced FIRST in the
  7.14 pair; 7.14b (host-side VFX wiring) is blocked by this story and is
  unimplementable without it. No dependency on the 7.15a-d chain.

Context: The 2026-08-03 correct-course review scoped a single Story 7.14
  ("Hub-Screen VFX Wiring") on the stated premise that the hub "already
  receives and ignores" ability deltas today, and gave that story an explicit
  Non-goal of "no protocol/delta changes." **That premise is factually wrong,
  and the story was split into 7.14a (this one) + 7.14b because of it.**

  Verified against the code, not the epic text: `ability:fired` is broadcast
  from exactly ONE site in the entire simulation server —
  `apps/simulation-server/src/rooms/GameRoom.ts:2435-2442` — and that site sits
  inside `if (inDungeon) {` (`:2434`, where `inDungeon` is
  `this.gameState.session.phase === 'dungeon'`, `:2375`). Confirmed by grep:
  `type: 'ability:fired'` has exactly 2 hits repo-wide, one in
  `packages/net-protocol` (the type definition) and one at `GameRoom.ts:2436`.
  There is no `else` branch and no second emitter.

  Consequence: casting an ability in the hub today produces a cooldown entry, a
  `COOLDOWN_UPDATE` to the caster, and self-cost HP — and nothing else. No
  delta reaches the host. Wiring `VfxEngine` into `HubWorldScreen.tsx` with no
  sim change (the original 7.14's whole plan) would render **exactly zero**
  VFX in the hub while every extraction task passed.

  Story 2.8 is the reason this is easy to misread. 2.8 removed the
  `player.nearPoiId === 'training-dummy'` guard so hub casts are *accepted*,
  and its e2e test (`tests/e2e/hub-ability-use.test.ts`) asserts a real
  `COOLDOWN_UPDATE` arrives. It asserts nothing about deltas, because none are
  sent. 2.8 unblocked the input path only, not the broadcast path.

  This story opens the narrowest sim-side gap that makes hub casts *visible*,
  and deliberately does NOT turn the hub into a combat surface. See the
  "Ungating scope — what stays dungeon-only, and why" Dev Note: the tick-phase
  audit behind that boundary is the single most important thing to read before
  writing any code here.

Owner: Simulation Engineer (CLAUDE.md Ownership Rules).

Goal: Broadcast `ability:fired` for hub casts, and apply self-scope status
  effects in the hub, so the host has something honest to render — without
  spawning projectiles, placing zones, resolving damage, or displacing anyone
  outside a dungeon.

Allowed paths:
  - apps/simulation-server/**
  - packages/game-rules/**  (not expected to be needed — see Non-goals)
  - tests/**  (this story's own new coverage; QA-owned tree, edited here under
    the same standing precedent every prior sim story in this repo used —
    see Dev Notes "Test placement")

Blocked paths:
  - apps/host-client/**        (that is Story 7.14b)
  - apps/mobile-controller/**
  - packages/shared-types/**   (no contract change — see Non-goals)
  - packages/net-protocol/**   (no contract change — see Non-goals)
  - apps/backend-platform/**

Inputs:
  - apps/simulation-server/src/rooms/GameRoom.ts:2367-2765 (the whole ability
    dispatch loop; :2434 is the gate this story moves)
  - apps/simulation-server/src/rooms/GameRoom.ts:2778, :2882, :2915, :3066,
    :3162, :3186, :3204 (the dungeon-gated tick phases that make ungating
    projectiles/zones the WRONG call — read these before deciding scope)
  - apps/simulation-server/src/rooms/GameRoom.ts:3277-3310 (status-effect
    tick/expiry — already phase-agnostic; this is what makes ungating
    self-scope status effects safe)
  - tests/e2e/hub-ability-use.test.ts (Story 2.8's existing hub-cast test —
    extend, do not replace)
  - packages/net-protocol/src/messages/server-to-host.ts:136-145
    (`AbilityFiredDelta` — read-only, unchanged)
  - _bmad-output/planning-artifacts/epics.md (Story 7.14 section + the
    2026-08-05 amendment recording this split)

Non-goals:
  - NO change to `AbilityFiredDelta`'s shape, `packages/shared-types`, or
    `packages/net-protocol`. The Contract-change hook is deliberately NOT
    triggered: this story changes *when* an existing delta is broadcast, not
    what it contains.
  - NO hub combat. Hit-scan damage, projectile spawning, zone placement, Dark
    Pact's ally drain, Lightning Arc's chain, displacement, heals, and boss
    damage all stay dungeon-only.
  - NO 'allies-in-zone' status scope in the hub (Warding Cry) — it is a
    positional AoE query, i.e. combat-shaped. Self-scope only.
  - NO spirit-ability dispatch change (`:2882`) — spirits do not exist in hub.
  - NO host-side rendering work. That is Story 7.14b in full.

Required hooks:
  - **Simulation-safety hook (TRIGGERED)** — `apps/simulation-server/**` is
    touched. Required before merge: `npm run typecheck`, unit tests,
    deterministic-tick test, replay test if available, and a basic perf sanity
    check. The perf argument here is short but must be stated explicitly in
    Completion Notes: this adds at most one broadcast per accepted hub cast,
    rate-limited by each ability's own cooldown, bounded by MAX_PLAYERS (8) —
    strictly less traffic than the same players casting in a dungeon.
  - Contract-change hook: NOT triggered (see Non-goals — justify this
    explicitly in Completion Notes rather than leaving it unstated).
  - Ownership hook: NOT triggered (single owner).
  - Client-UX hook: NOT triggered by this story (7.14b carries it).
  - Telemetry hook: no new user flow — hub casting is an existing flow (2.8)
    gaining a broadcast. No new KPI event.

Required tests:
  - `tests/e2e/hub-ability-use.test.ts` — extend with an assertion that a hub
    cast now produces a real `ability:fired` delta on the host connection,
    carrying the caster's id, ability index, and the sent direction.
  - `tests/e2e/hub-ability-use.test.ts` — a negative assertion that the same
    hub cast produces NO `projectile:*` / `zone:*` / `enemy:damaged` delta and
    leaves `gameState.projectiles` / `gameState.zones` empty (this is the test
    that keeps a future refactor from quietly widening the gate).
  - Self-scope status effect in hub: assert a hub Iron Skin cast (stonehide
    idx 2, TAP) puts a `damageReduction` effect on the caster's
    `statusEffects` in the next snapshot, and that it expires on its own.
  - Deterministic-tick test: unchanged behavior — this story must not touch
    the PRNG or tick ordering. Re-run it, do not modify it.

Telemetry impact: None — no new user flow, no KPI event.
```

---

## Story

As a player,
I want the game to actually tell the host screen when I cast something in the hub,
so that hub casting stops being a silent cooldown spinner and Story 7.14b has real deltas to render.

---

## Acceptance Criteria

**AC1 — `ability:fired` broadcasts in the hub:**
**Given** the single `ability:fired` broadcast site at `GameRoom.ts:2435-2442`, currently inside `if (inDungeon)` (`:2434`)
**When** a player with a confirmed class fires any non-spirit ability outside a dungeon (session phase `lobby` or `hub`) and `dispatchAbility` returns `ok`
**Then** the same `AbilityFiredDelta` (`{ type, playerId, abilityIndex, directionX, directionY }`, unchanged shape) is broadcast, carrying the post-`dispatchAbility` normalized `dirX`/`dirY` exactly as the dungeon path does
**And** the existing cooldown update and self-cost HP behavior are byte-for-byte unchanged (they already run outside the gate, `:2413-2432` — do not move them)

**AC2 — zero-aim casts still broadcast nothing extra:**
**Given** a zero-aim directional cast, which `dispatchAbility` already rejects before reaching the broadcast
**When** it is attempted in the hub
**Then** no `ability:fired` is broadcast — identical to the dungeon path's behavior, preserving the SILENT rule the entire Epic 7 host layer is built on (a delta the host cannot honestly render is worse than no delta)

**AC3 — self-scope status effects apply in the hub:**
**Given** the `statusConfig?.scope === 'self'` branch (`GameRoom.ts:2550-2559`), today dungeon-only
**When** a self-buff ability (Iron Skin) is cast in the hub
**Then** the effect is applied to the caster and `status:applied` is broadcast, and it expires normally via the already-phase-agnostic status tick (`:3277-3310`) with a `status:expired` broadcast
**And** the `'allies-in-zone'` scope branch (`:2559+`) remains dungeon-only — it is a positional AoE query, which is combat, not a self-buff

**AC4 — the hub does not become a combat surface:**
**Given** the rest of the `if (inDungeon)` block — hit-scan damage, the `delivery === 'projectile'` branch (`:2452-2485`), the `delivery === 'zone'` branch (`:2493-2520`), Dark Pact (`:2526-2529`), Lightning Arc (`:2535-2539`), displacement, heals, boss damage
**When** any ability is cast in the hub
**Then** none of them run: `gameState.projectiles` and `gameState.zones` stay empty, no `enemy:damaged`/`projectile:*`/`zone:*` delta is broadcast, and no player's HP changes except by the already-ungated self-cost
**And** this is asserted by a negative test, not merely by inspection — the tick phases that would advance a hub-spawned projectile or zone (`:2778`, `:3066`, `:3162`, `:3186`, `:3204`) are all independently dungeon-gated, so a projectile spawned in the hub would freeze in place forever rather than fly

**AC5 — Simulation-safety hook:**
**Given** `apps/simulation-server/**` is touched
**Then** `npm run typecheck`, the unit suite, the deterministic-tick test, and a stated perf sanity argument all pass and are recorded in Completion Notes before this story reaches `review`

**AC6 — no contract drift:**
**Given** `packages/shared-types/**` and `packages/net-protocol/**` are Blocked paths here
**Then** neither is modified, `AbilityFiredDelta`'s shape is untouched, and Completion Notes states explicitly why the Contract-change hook was not triggered (broadcast *timing* changed, not message *shape*)

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2) — `GameRoom.ts`: hoist the `ability:fired` broadcast (`:2435-2442`) out of the `if (inDungeon)` block so it runs for every accepted cast. Keep it *after* the cooldown update and self-cost application, preserving today's ordering. Leave the `abilityDef` lookup and everything below it inside the gate.
  - [x] Subtask 1.1 — re-verify by grep that `:2436` is still the only `type: 'ability:fired'` emitter after the edit (no accidental duplicate).
  - [x] Subtask 1.2 — confirm the broadcast uses `dirX`/`dirY` from `result.value` (the normalized pair), not the raw `directionX`/`directionY` off the input message. **Finding: the AC's word "normalized" is wrong — see Completion Notes.**
- [x] **Task 2** (AC: #3) — `GameRoom.ts`: hoist ONLY the `statusConfig?.scope === 'self'` branch out of the gate. The `else if (statusConfig?.scope === 'allies-in-zone')` branch stays inside. Note in a source comment why the two scopes split here, so the next reader does not "helpfully" reunite them. **Implemented as an `else` branch + shared helper rather than a literal hoist — see Completion Notes for why a hoist would have been a Dark Pact regression.**
  - [x] Subtask 2.1 — verify the status tick/expiry loop (`:3277-3310`) is genuinely outside every `phase === 'dungeon'` guard (it is, at 4-space indent in the tick body) so a hub buff cannot become permanent.
- [x] **Task 3** (AC: #4) — Audit and document, in a source comment at the gate, exactly what remains dungeon-only and why (projectile/zone tick phases are separately gated, so spawning them in the hub would strand them). This comment is the guardrail against a future widening of the gate.
- [x] **Task 4** (AC: #1, #3, #4) — `tests/e2e/hub-ability-use.test.ts`: extend Story 2.8's existing test file (do not replace it).
  - [x] Subtask 4.1 — positive: a hub cast produces `ability:fired` on the host connection with the expected `playerId`/`abilityIndex`/direction.
  - [x] Subtask 4.2 — negative: the same cast leaves `projectiles`/`zones` empty and emits no `projectile:*`/`zone:*`/`enemy:damaged` delta.
  - [x] Subtask 4.3 — self-scope status: a hub Iron Skin cast lands a `damageReduction` effect on the caster and later expires.
- [x] **Task 5** (AC: #5) — Full Simulation-safety hook run: `npm run typecheck`, `npm test`, the deterministic-tick test, and a written perf sanity argument. Record all four in Completion Notes.
- [x] **Task 6** (AC: #6) — Confirm zero diff under `packages/shared-types/` and `packages/net-protocol/`; state the Contract-change-hook-not-triggered justification in Completion Notes.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### Ungating scope — what stays dungeon-only, and why

This is the load-bearing decision of the story. The temptation is to delete `if (inDungeon)` wholesale so "everything just works in the hub." Do not. The dispatch block is only half the machinery; the other half is a set of **independently dungeon-gated tick phases**:

| Tick phase | Line | Guard |
|---|---|---|
| Projectile advance / expiry / hit resolution | `:2778` | `phase === 'dungeon'` |
| Spirit ability dispatch | `:2882` | `phase === 'dungeon'` |
| Zone tick / strike / expiry | `:3066`, `:3162`, `:3186`, `:3204` | `phase === 'dungeon'` |
| Bond drain | `:3028` | `phase === 'dungeon'` |

A projectile spawned by an ungated dispatch would be pushed into `gameState.projectiles` with a live planck body and then **never advanced, never expired, never collided** — a frozen ball parked on the hub floor for the rest of the session, re-broadcast in every snapshot. A Storm Eye zone would be placed and then never tick and never expire. Both are strictly worse than the current silence.

Ungating those phases too is a real, defensible feature ("abilities fully work in the hub"), but it is a *different, much larger* story with genuine design questions (friendly fire? zones in a social space? do hub projectiles collide with anything, given `extractProjectileEnemyContact` only matches projectile↔enemy pairs and there are no enemies in the hub?). It is explicitly out of scope here. If the manual pass makes the absence of projectile/zone visuals in the hub feel wrong, that is a new story, not a widening of this one.

### What 7.14b can and cannot render after this story

State this plainly in Completion Notes so 7.14b is not written against a false expectation:

- **Will work in hub:** per-class cast VFX for every hitscan/TAP ability (the Spiritcaller/Souldrinker/Stormcaller planner paths and the generic `getAbilityVfxConfig` config path), plus status auras for self-scope buffs.
- **Will NOT work in hub:** projectile trails (Blood Spike, Void Pulse, Tempest Hurl), Storm Eye's zone visual, `projectile:hit` impact effects, `ability:chain-hit` chain beams, `zone:strike` accents, `enemy:damaged` damage numbers. All of these are downstream of machinery this story deliberately leaves dungeon-only.

Story 7.14b's own ACs are written against this boundary. The epic's original phrasing ("status auras, trails, and per-class cast VFX all apply identically") is superseded by it — trails do not, and cannot, without a larger sim change.

### Do not "fix" this by broadcasting a synthetic delta

There is no need for a new `hub:ability-fired` type or a phase field on `AbilityFiredDelta`. The existing delta already carries everything the host needs (`playerId`, `abilityIndex`, `directionX`, `directionY`), and the host already knows the session phase from its own mirror state. Inventing a wire type here would trigger the Contract-change hook for zero benefit and would violate this story's Blocked paths.

### Ordering inside the dispatch loop

Today's order for an accepted cast is: cooldown map write → `sendCooldownUpdate` → self-cost HP + `player:hp-updated` → `if (inDungeon)` { `ability:fired` → everything else }. After this story it becomes: cooldown map write → `sendCooldownUpdate` → self-cost HP + `player:hp-updated` → `ability:fired` → self-scope status → `if (inDungeon)` { everything else }. Keep `ability:fired` after the HP delta, matching today's relative ordering — the host's Souldrinker Dark Pact cost/gain classifier (`DungeonScreen.tsx`, `lastDarkPactCastAtRef`) correlates HP changes against the cast timestamp, and flipping the order would change what it observes in the dungeon path too.

### Test placement

`tests/**` is QA + Telemetry Engineer's tree per CLAUDE.md, but every prior simulation story in this repo has added its own coverage there directly (3.25, 3.26, 3.20, 2.8 itself all did). Follow that precedent — extend `tests/e2e/hub-ability-use.test.ts` rather than creating a parallel file under `apps/simulation-server/tests/`, since the assertion needs a real room and a real host connection, which is exactly what that file already sets up.

Known pre-existing environment issue, do **not** chase: WSL2 e2e port-binding timeouts cause `tests/e2e/*` suites to occasionally skip with "simulation-server did not start within 60s". If that happens, re-run; do not rewrite the harness. Also pre-existing and unrelated: the intermittent Ancestor's Voice heal assertion in `tests/e2e/ability-dispatch.test.ts`, and the Stone Wall centering failure in `apps/host-client/src/vfx/ability-vfx.test.ts`.

### Project Structure Notes

- Single file of production change expected: `apps/simulation-server/src/rooms/GameRoom.ts`. If the diff grows beyond that plus test files, stop and re-read the Non-goals — it means the gate is being widened past this story's scope.
- No new module, no new export, no new constant. This is a control-flow change, not an architecture change.

### Project Context Rules

- **Tick loop hygiene** (project-context.md): the broadcast added here sits in the ability-dispatch phase of the tick. Do not add `logger.info`/`warn`/`error` around it — the existing `logger.debug({...}, 'ability fired')` at `:2767` is the correct level and already exists. No new heap allocation in a hot path: the delta object is already constructed per accepted cast today, just inside a narrower branch.
- **PRNG**: this story must not touch `Math.random()` or any `createRng` call. Determinism is unaffected — verify with the deterministic-tick test rather than asserting it.
- **Authority model**: the sim remains the sole authority. This story broadcasts more of what the sim already decided; it moves no decision to a client.
- **Event contract discipline**: broadcasting via `this.broadcast(EventNames.DELTA, {...} satisfies DeltaEventMsg)` — the existing pattern at the call site. Never `JSON.stringify` directly.
- **Result<T, E>**: no new game-rules function here, so no new `Result` surface; do not introduce a `throw` anywhere in the dispatch loop.

### References

- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2367-2765`] — the ability dispatch loop; `:2375` (`inDungeon`), `:2413-2432` (already-ungated cooldown + self-cost), `:2434` (the gate), `:2435-2442` (the broadcast to hoist), `:2452-2485` (projectile branch, stays), `:2492-2520` (zone branch, stays), `:2550-2559` (self-scope status, hoist), `:2559+` (allies-in-zone, stays).
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2778`, `:2882`, `:3028`, `:3066`, `:3162`, `:3186`, `:3204`] — the independently dungeon-gated tick phases behind the AC4 boundary.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:3277-3310`] — phase-agnostic status tick/expiry; the reason AC3 is safe.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:136-145`] — `AbilityFiredDelta`, unchanged.
- [Source: `packages/net-protocol/src/apply-delta.ts:151-152`] — `ability:fired` is a state no-op; the host reads the raw delta.
- [Source: `tests/e2e/hub-ability-use.test.ts`] — Story 2.8's existing hub-cast test; the file this story extends.
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Story 7.14 section + the 2026-08-05 amendment recording this split.
- [Source: `_bmad-output/project-context.md`] — Tick Loop Hygiene, PRNG, Authority Model, Event Contract Discipline.
- [Source: `CLAUDE.md`] — Ownership Rules, Simulation-safety hook, Contract-change hook, Merge Gate.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- **Test-authoring error, not an implementation bug (round 1):** the new AC1 e2e test asserted the broadcast direction was a unit vector (`hypot === 1` for an input of `(3, 4)`); it received `5`. Root cause found by reading `packages/game-rules/src/systems/abilities.ts:74-91`: `dispatchAbility` does **not** normalize — it only zeroes the direction for `TAP` (`:78-79`) and otherwise passes the caster's vector through verbatim. Normalization happens later and per-delivery-branch inside `GameRoom` (`const mag = Math.hypot(dirX, dirY)` in the projectile branch, the zone branch, `handleDarkPact`, `handleLightningArc`). The implementation was correct on the first pass; the test's expectation was wrong. Rewrote the assertion to pin the real contract ("the direction the player expressed", not "a unit vector") with a comment recording why.
- **Test-authoring error, not an implementation bug (round 2):** the AC3 test's trailing `waitUntil` polled for the expired `damageReduction` to disappear from a snapshot, and timed out after 3s. Root cause: no `SNAPSHOT` is broadcast on status expiry — snapshots go out on entity-shape changes (projectile/zone spawn, level load, join), while status expiry broadcasts only the `status:expired` delta and clients converge by applying it. The `status:applied` and `status:expired` assertions had both already passed. Removed the snapshot poll; it was asserting on a broadcast the server never makes.
- `npm run typecheck` (10 tsconfigs): clean on the first run after adding the `AbilityStatusEffectConfig` type import to `GameRoom.ts:16`.

### Completion Notes List

- **Task 1 — `ability:fired` is now phase-agnostic.** The delta construction and `this.broadcast` moved out of `if (inDungeon)` to sit immediately before it, after the cooldown update and the self-cost `player:hp-updated` broadcast. That placement is deliberate and documented in-source: the host's Souldrinker Dark Pact cost/gain classifier (`DungeonScreen.tsx`'s `lastDarkPactCastAtRef`) correlates HP changes against the cast timestamp, so the HP-delta-before-cast-delta ordering had to be preserved for the dungeon path too. Verified by grep that `type: 'ability:fired'` still has exactly two hits repo-wide — the type definition in `packages/net-protocol` and this one emitter.
- **AC1's wording contains an error I did not "fix" silently.** AC1 says the delta carries "the post-`dispatchAbility` normalized `dirX`/`dirY`". `dispatchAbility` does not normalize (see Debug Log). The AC's operative clause — "exactly as the dungeon path does" — holds exactly, since the hub and dungeon paths now share one emitter. The word "normalized" is a factual error in the story spec I authored, left in place rather than edited (Tasks/ACs are outside the dev-agent's permitted edit surface) and corrected here instead. **This matters downstream:** Story 7.15b/7.15c must not assume `ability:fired`'s direction is a unit vector. In practice the phone always sends one (`ControllerScreen.tsx` uses `cos`/`sin` of the drag angle), but nothing on the wire enforces it, and 7.15b's own normalization step is therefore load-bearing, not defensive.
- **Task 2 — implemented as an `else` branch, not the literal hoist the task described.** A straight hoist of the `statusConfig?.scope === 'self'` block above `if (inDungeon)` would have been a **real dungeon regression**: Dark Pact (`souldrinker[2]`) also declares `scope: 'self'` (`balance.ts:87`, `damageBuff` 0.25/4000ms), but in a dungeon it `continue`s into `handleDarkPact` *before* the generic self-scope branch is ever reached, and `handleDarkPact` applies that buff only when a drain target is actually found. Hoisting would have granted the buff unconditionally, in both phases. Implemented instead as an `else` branch on the existing gate, with an explicit Dark Pact exclusion and a comment explaining the reachability argument. Iron Skin (`stonehide[2]`) is the only ability that reaches the new branch today; the `allies-in-zone` scope (Warding Cry) deliberately stays dungeon-only as a positional AoE query over other players.
- **New shared helper `applySelfScopeStatus(casterId, config, nowMs)`** (`GameRoom.ts`, beside `applyStatusEffectToTarget`) — extracted rather than duplicated so the dungeon and hub paths cannot drift. Required adding `AbilityStatusEffectConfig` to the existing `game-rules` type import.
- **Task 3 — the gate is now self-documenting.** The `else` branch carries the full rationale for what stays dungeon-only, including the non-obvious half: the tick phases that advance projectiles and zones are each *independently* dungeon-gated, so an entity spawned in the hub would be stranded — never advanced, never expired, re-broadcast in every snapshot forever. Widening the gate therefore means ungating those phases too, which is a separate story with real design questions (friendly fire? zones in a social space?). The comment references the guard by grep pattern rather than by line number, so it does not rot.
- **Task 4 — four new e2e tests** in `tests/e2e/hub-ability-use.test.ts` (Story 2.8's file, extended not replaced), plus a shared `joinClassedPlayer` helper. The AC4 negative test is the important one: it asserts a hub Blood Spike produces `ability:fired` **and** produces no `projectile:*` / `zone:*` / `enemy:damaged` / `ability:chain-hit` delta and leaves `projectiles`/`zones` empty. That is what stops a future refactor from quietly widening `if (inDungeon)`.
- **Required hooks:**
  - **Simulation-safety hook TRIGGERED and satisfied.** `npm run typecheck` clean (10/10 tsconfigs). `npm test`: 684 passed, 1 failed, 4 skipped across 56 files — the single failure is `apps/host-client/src/vfx/ability-vfx.test.ts`'s Stone Wall centering assertion, a documented pre-existing failure tracked since 7.2/7.8 and untouched by this story (no file in this story's scope is in `apps/host-client`). The two other "failed" files (`tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`) both failed with `simulation-server did not start within 60s` — the known WSL2 e2e port-binding timeout, with all 4 of their tests skipped, not executed and failed. **Zero regressions attributable to this story.** Determinism: `tests/unit/generation.test.ts`, `tests/unit/bonds.test.ts`, and `packages/game-rules/tests/unit/grassland-boss.test.ts` all pass **unmodified** (64/64) — no test needed changing, which is itself the evidence that nothing here mutates state or touches the PRNG.
  - **Perf sanity check.** This adds at most one broadcast per *accepted* cast outside a dungeon. Accepted casts are rate-limited by each ability's own cooldown (1000-6000ms, `balance.ts:73-94`), and player count is bounded by `MAX_PLAYERS` = 8. Worst realistic case — 8 players all spamming their 1000ms-cooldown ability in the hub — is ~8 extra small JSON payloads per second, against a tick loop that already broadcasts one `player:moved` per moving player per 33ms tick (~240/s at the same player count). Strictly less traffic than the same 8 players casting in a dungeon, where this broadcast already happened alongside hit-scan, damage, and status deltas. No new allocation was introduced in the tick: the delta object was already constructed per accepted cast, just inside a narrower branch.
  - **Contract-change hook NOT triggered**, and this was verified rather than assumed: `git diff --stat` shows four changed files, none under `packages/shared-types/` or `packages/net-protocol/`. `AbilityFiredDelta`'s shape is untouched. What changed is *when* an existing delta is broadcast, not what it contains — no wire shape, no field, no enum value, no union member moved. An older host that has always ignored hub-phase deltas continues to work; it simply now receives one more type it already knows how to handle (`apply-delta.ts` treats `ability:fired` as a state no-op).
  - **Ownership hook NOT triggered** — single owner. Production changes are confined to `apps/simulation-server/src/rooms/GameRoom.ts`; the only other edits are this story's own test file, the story file, `sprint-status.yaml`, and the `epics.md` split amendment (all workflow/planning artifacts, matching every prior story's own File List in this sprint).
  - **Client-UX hook NOT triggered** by this story — no host or mobile file touched. It is Story 7.14b that carries it, and 7.14b is where the hub VFX actually becomes visible.
- **What 7.14b can and cannot render after this story** (binding on 7.14b's AC3, restated here as the implementation's actual boundary):
  - **Works in hub:** per-class cast VFX for every hitscan/TAP ability (the Spiritcaller/Souldrinker/Stormcaller planner paths and the generic `getAbilityVfxConfig` config path), plus status auras for self-scope buffs (Iron Skin only).
  - **Does NOT work in hub:** projectile trails (Blood Spike, Void Pulse, Tempest Hurl), Storm Eye's zone visual, `projectile:hit` impacts, `ability:chain-hit` chain beams, `zone:strike` accents, `enemy:damaged` damage numbers, Warding Cry's ally shield aura, and Dark Pact's damageBuff aura. All are downstream of machinery deliberately left dungeon-only.
- **Confidence: 92%.** Typecheck and the full suite are clean modulo three explicitly pre-documented failure categories; all five hub e2e tests pass both standalone and in the full parallel run; the determinism tests pass unmodified; and the one genuine regression risk in this change (the Dark Pact self-scope collision) was caught during implementation and is covered by an explicit exclusion plus an in-source explanation. The 8% reservation: the AC4 negative test proves no combat delta is *broadcast*, but it does not prove no physics body is created — I verified that by reading the dispatch branches rather than by instrumenting planck, so a future ability that spawns a body outside the two branches I read would not be caught by this test.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` — `ability:fired` broadcast hoisted out of the `if (inDungeon)` gate (Task 1); new `else` branch applying self-scope status in hub, with the Dark Pact exclusion and the dungeon-only boundary rationale (Tasks 2, 3); new private `applySelfScopeStatus` helper, with the existing dungeon-path self-scope branch refactored onto it (Task 2); `AbilityStatusEffectConfig` added to the `game-rules` type import (`:16`)
- `tests/e2e/hub-ability-use.test.ts` — new `joinClassedPlayer` helper and four new tests: `ability:fired` broadcast + direction contract (AC1), zero-aim silence (AC2), no-combat negative assertion (AC4), self-scope status apply + expire (AC3) (Task 4)
- `_bmad-output/implementation-artifacts/7-14a-hub-ability-fired-broadcast.md` — this story file (frontmatter `baseline_commit`, Tasks, Dev Agent Record, File List, Status, Change Log)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates (create-story → ready-for-dev, dev-story → in-progress → review)
- `_bmad-output/planning-artifacts/epics.md` — 2026-08-05 amendment recording the 7.14 → 7.14a/7.14b split and the code-level evidence for it (added during create-story, before implementation)

### Review Findings

Reviewed 2026-08-06 in a batched branch review (sim + game-rules group). **No High or Medium findings against this story.** The reviewer traced the two things most likely to have gone wrong and confirmed both are correct.

**Confirmed clean, independently verified:**
- **No double-applied self-scope status in any phase.** Only Iron Skin (`stonehide[2]`) and Dark Pact (`souldrinker[2]`) declare `scope: 'self'`. The dungeon and hub branches are the two arms of one `if (inDungeon)/else`, so they are mutually exclusive. Dark Pact's exclusion from the hub branch is correct — in a dungeon it `continue`s into `handleDarkPact` before the generic self-scope branch is reachable, and that handler gates the buff on actually finding a drain target. `allies-in-zone` (Warding Cry) and `enemies-in-zone` (Tremor Stomp) correctly stay dungeon-only.
- **Ordering is byte-identical on the dungeon path** for `ability:fired` relative to `cooldown:update`, `player:hp-updated`, and `status:applied` — the constraint the Dev Notes called out for the host's Dark Pact cost/gain classifier. Grep confirms exactly one `ability:fired` emitter remains.
- **Status expiry is genuinely phase-agnostic**, so hub buffs expire on their own as AC3 requires — verified by indentation position in `tick()`, outside every `phase === 'dungeon'` guard, not assumed.

**Deferred (real, low severity, out of this story's scope):**
- **[Low] The `else` branch also fires in `post-run`.** `SessionState.phase` is `'lobby' | 'hub' | 'dungeon' | 'post-run'`, and `else` on `if (inDungeon)` catches all three non-dungeon values, whereas AC1 scoped this to "lobby or hub". Post-run players are not frozen, so during the reward-reveal screen a player can cast and the host now receives `ability:fired` + `status:applied` deltas it did not receive before — which Story 7.14b will render over the post-run UI. Not a correctness bug, but an unstated widening that the AC4 negative test does not cover. A one-line phase check would close it if the manual pass finds it visually wrong.
- **[Low] Player `statusEffects` are never reset on run start.** They are initialized at join and otherwise only expire on their own timer, so a hub Iron Skin buff (3s) can carry into a dungeon. Almost certainly unexploitable against the vote→level-load transition, but the invariant "players enter a run with no status effects" is no longer guaranteed by construction now that self-buffs are castable outside a dungeon. Pre-existing mechanism, newly reachable.

**Regression after review:** unchanged from implementation — `npm run typecheck` clean (10/10); `tests/e2e/hub-ability-use.test.ts` 5/5 in isolation; full suite 731 passed, 1 failed (pre-existing Stone Wall centering), 9 skipped (WSL2 e2e port contention).

## Change Log

- 2026-08-05 — Story created (split out of the original single Story 7.14 after a code-level finding that `ability:fired` never broadcasts outside dungeon phase).
- 2026-08-05 — Implemented. `ability:fired` ungated for hub/lobby casts; self-scope status effects applied outside dungeon via a new shared `applySelfScopeStatus` helper, with Dark Pact explicitly excluded to avoid granting a buff the dungeon path withholds. Four new e2e tests pin both halves of the boundary. Status → review.

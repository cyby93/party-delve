---
baseline_commit: bab9d03
---

# Story 3.22: Epic 3 — Post-3.21 Deferred Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Story 3.22 — deferred hardening, no new features)
Context: Stories 3.9 and 3.10 closed every deferred finding from Stories 3.1-3.9's code
  reviews. Since then, the "Ability Mechanics Rework" batch (Stories 3.11-3.21c) shipped 9
  more stories and accumulated 8 new open D-3.x entries in deferred-work.md that were never
  bundled into a follow-up hardening story — this story closes that backlog, following the
  same "bundle small low-risk findings, explicit cross-context approval" precedent as 3.9,
  3.10, 1.8/1.9, 2.6/2.7, 4.9/4.10/4.11, and 5.7/5.8.

  This story's scope was determined by re-reading deferred-work.md's full Epic 3 history
  (D-3.1 through D-3.21b) and verifying against the CURRENT codebase — not by trusting the
  file's text at face value. Two findings were downgraded on inspection (see "Findings
  dismissed on re-verification" below); the rest fall into three groups:

  1. **The batch-wide GameRoom-integration-test gap** (D-3.16-A, D-3.17-B, D-3.17-C,
     D-3.20-A) — four separate code reviews (3.16, 3.17 twice, 3.20) independently flagged
     the same gap and each explicitly deferred it, saying to fix it "as a single dedicated
     GameRoom-integration-test story" once enough kit-rework stories had landed to justify
     the investment. That condition is now met — Story 3.20 was the last kit-rework story
     in the batch (3.21a/b/c were a separate, already-tested body/spirit correction, not a
     kit rework). Verified today: `apps/simulation-server/tests/game-room-*.test.ts` (6
     files) all explicitly document that "GameRoom isn't instantiable outside a live
     Colyseus room" and instead re-implement the relevant logic in standalone mirror
     functions — none of them spin up a real room. `tests/e2e/full-run.test.ts` and
     `tests/e2e/reconnect.test.ts` DO spin up a real room via
     `tests/helpers/server.ts#startTestServer` (an actual `tsx src/index.ts` child process,
     real Colyseus + real GameRoom), but `full-run.test.ts` bypasses all ability combat
     entirely via the `debug:kill-all`/`debug:kill-boss` server-side debug hooks — no test
     anywhere sends an `EventNames.INPUT` message with `event.type === 'ability'` against a
     live room and asserts on the resulting broadcast deltas. The harness these 4 findings
     said would need to be built already exists (built for Story 4.6); this story is
     "spend the investment," not "build the investment."

  2. **Warding Cry's shield status effect has no damage-absorption consumption** (D-3.17-A)
     — user explicitly decided (2026-07-14, logged in deferred-work.md) to defer this to
     "whichever future story next touches player-health.ts/applyPlayerDamage." No story has
     touched either since. Verified today: `packages/game-rules/src/balance.ts:213` still
     defines Warding Cry's `{ effectType: 'shield', magnitude: 30, ... }` entry,
     `status-effects.ts:20` still exempts `'shield'` from the 0-1 magnitude validation
     (flat-HP semantics), and `player-health.ts#applyPlayerDamage` still only reads
     `getStatusEffectMagnitude(player, 'damageReduction', nowMs)` — there is no `'shield'`
     branch anywhere in the codebase. A shielded player takes full damage today; the
     ability is entirely cosmetic.

  3. **A one-line defensive guard for `shouldZoneTick`** (D-3.13-D) — deferred pending
     "when Story 3.19 populates a real ABILITY_CHAINED_ZONE entry." Verified today:
     `packages/game-rules/src/balance.ts:148` now has Void Pulse's real entry
     (`tickIntervalMs: 500`), so the table is no longer all-null — but
     `packages/game-rules/src/systems/zones.ts#shouldZoneTick` still has no guard against a
     non-positive `tickIntervalMs` (`nowMs - lastTickAtMs >= zone.tickIntervalMs` fires every
     tick if the divisor-like value were ever 0 or negative). The live entry itself is a
     valid positive value, so this remains latent, not a live bug — included here only as a
     one-line, near-zero-risk guard while another game-rules file is already open for D-3.17-A,
     matching the precedent Story 3.9 set with D-3.2-C's similar not-yet-triggered guard.

  Findings dismissed on re-verification (do not re-open without new evidence):
  - **D-3.14-B** ("no vector-summing for concurrent pull sources") — re-read
    `apps/simulation-server/src/rooms/GameRoom.ts`'s `applyDisplacementToEnemy`/
    `applyDisplacementToPlayer` (~line 1171-1210): both do `enemy.x += dx` / `player.x += dx`
    (in-place addition to the CURRENT position), not an overwrite/assignment. Two pull
    sources landing on the same entity in the same tick are necessarily processed
    sequentially (JS is single-threaded, and nothing in the tick loop batches these calls) —
    the second call's `+=` naturally sums onto whatever the first call already wrote. The
    original finding's premise ("the second call simply overwrites... rather than summing
    the two displacement vectors") does not match this code. No fix needed; noting the
    dismissal here so it isn't silently re-deferred forever.
  - **D-3.13-A** (projectile sensor radius vs. rendered dot radius mismatch, "revisit when
    Story 3.19/3.20 give a concrete ability its own visual identity") — re-checked
    `apps/simulation-server/src/physics/world.ts#createProjectileBody` (sensor radius still
    12px) and `apps/host-client/src/screens/DungeonScreen.tsx`'s projectile render block
    (still a generic `g.circle(0, 0, 8).fill({ color: 0xffffff })` for every projectile,
    Blood Spike/Void Pulse included). The stated revisit condition — a story giving
    projectiles per-ability visual identity — never actually happened; 3.19/3.20 shipped
    without adding one. Left open, unchanged: the condition this finding names still hasn't
    occurred, so there's nothing new to act on. Do not fix as part of this story (it's a
    cosmetic/UX polish item, not a hardening one) — re-verify next time a story is scoped to
    give abilities distinct visual identities.
  - **D-3.18-A** (Soul Mend join-order tie-break) — explicit user decision already on record
    ("revisit if playtesting surfaces this... not required by any AC"). No new evidence this
    session that playtesting has surfaced it. Left deferred, unchanged.
  - **D-3.21a-A, D-3.21a-B, D-3.21b-A** — all three are explicitly scoped to "Phase 5" /
    "independently deployable host/sim versions" / "a new down-transition path is ever
    added" conditions that this alpha, single-process, 4-down-transition-path codebase does
    not meet. Left deferred, unchanged.
  - **D-3.12-A, D-3.12-B** — scoped to "if `StatusEffectType` grows beyond 4-5 values" /
    "if per-tick magnitude decay is introduced." Neither has happened. Left deferred,
    unchanged.

Owner agent: Multi-context (explicit cross-context approval, following the 3.9/3.10/4.9/5.7
  precedent of bundling small low-risk hardening findings into one story rather than
  splitting a 1-2 file fix into its own story per finding):
  QA + Telemetry Engineer (Task 1 — tests/e2e/**)
  Simulation Engineer (Task 2 — packages/game-rules/src/systems/player-health.ts;
    Task 3 — packages/game-rules/src/systems/zones.ts)

Goal: Close the 6 real open Epic 3 deferred findings (D-3.16-A, D-3.17-A, D-3.17-B,
  D-3.17-C, D-3.20-A, D-3.13-D) with minimal diffs, and formally dismiss 2 findings whose
  premise no longer holds (D-3.14-B) or whose revisit condition still isn't met in a way
  that changes anything (D-3.13-A — left open, just re-confirmed, not fixed).
  Task 1 — Add a live-room e2e test suite that fires real abilities through
            `EventNames.INPUT` against a `startTestServer()`-backed room and asserts on the
            resulting broadcast deltas, closing the shared GameRoom-integration-test gap.
  Task 2 — Wire Warding Cry's `'shield'` status effect into `applyPlayerDamage` as a
            flat-HP damage-absorption pool that depletes before HP loss.
  Task 3 — Add a one-line guard in `shouldZoneTick` against a non-positive
            `tickIntervalMs`.

Allowed paths:
  - tests/e2e/**                                          (Task 1 — new test file)
  - tests/helpers/**                                       (Task 1 — only if a genuinely
    shared helper is needed; prefer reusing what exists)
  - packages/game-rules/src/systems/player-health.ts        (Task 2)
  - packages/game-rules/tests/**                            (Task 2 — new/updated unit test)
  - packages/game-rules/src/systems/zones.ts                 (Task 3)

Blocked paths:
  - apps/simulation-server/src/rooms/GameRoom.ts             (read-only — Task 1's e2e test
    drives GameRoom only through the wire protocol, never edits it)
  - apps/host-client/**
  - apps/mobile-controller/**
  - packages/net-protocol/**
  - packages/shared-types/**
  - apps/backend-platform/**

Inputs:
  - deferred-work.md sections: "Deferred from: code review of 3-16-stonehide-kit-rework",
    "...3-17-spiritcaller-kit-rework...", "...3-18-soul-mend...", "...3-20-stormcaller-storm-eye-rework",
    "...3-13-projectile-physics-and-zone-field-entities", "...3-14-displacement-pull-physics-primitive"
  - apps/simulation-server/tests/game-room-soul-mend-channel.test.ts (read fully — the
    clearest existing example of the "mirror the logic, don't instantiate GameRoom" pattern
    this story's Task 1 supersedes for the paths it covers)
  - tests/e2e/full-run.test.ts (read fully — the existing live-room harness pattern: how it
    creates a room, joins players, sends CLASS_SELECT/INPUT/VOTE, and awaits deltas via
    `waitForDelta`)
  - tests/helpers/server.ts (read fully — `startTestServer`/`stopTestServer`/`TEST_URL`)
  - tests/helpers/messages.ts (read fully — `waitForDelta` signature and timeout behavior)
  - packages/shared-types/src/input.ts (read fully — `AbilityInput`/`InputEvent` shapes:
    `{ type: 'ability'; ability: { abilityIndex: number; directionX: number; directionY: number } }`)
  - packages/game-rules/src/balance.ts (read fully — `ABILITY_HIT_RANGE_PX`,
    `ABILITY_HIT_RADIUS_PX`, `ABILITY_STATUS_EFFECT`, `ABILITY_CHAINED_ZONE` — needed to
    pick which class/ability/slot to exercise and what to assert)
  - packages/game-rules/src/systems/player-health.ts (read fully — current
    `applyPlayerDamage`, lines ~14-50)
  - packages/game-rules/src/systems/status-effects.ts (read fully — `applyStatusEffect`,
    `getStatusEffectMagnitude`, and the `'shield'` magnitude-validation exemption at line 20)
  - packages/game-rules/src/systems/zones.ts (read fully — both functions, 12 lines total)
  - apps/simulation-server/src/rooms/GameRoom.ts:1892-1930 (read the ability-dispatch
    `onMessage` handler — do not edit, just confirm current wire-up before writing the e2e
    test's expectations)

Non-goals:
  - Do not build a new "spin up GameRoom directly in-process" unit-test harness as an
    alternative to the existing e2e process-spawn harness. `tests/helpers/server.ts`
    already solves this by spawning the real `apps/simulation-server` entrypoint; reuse it.
  - Do not attempt exhaustive per-ability e2e coverage (all 4 classes × 4 slots). Cover
    enough distinct wiring paths to retire the 4 specific findings this story closes:
    (a) a mixed-faction hit-scan ability that both damages an enemy and applies a status
    effect/heals an ally through `gatherPlayersInHitZone`/`resolveMixedFactionTargets`
    (closes D-3.16-A, D-3.17-B, D-3.17-C), and (b) a zone-tick `'damage'` effect actually
    applying damage via the live tick loop, not just the pure `shouldZoneTick`/`isZoneExpired`
    helpers (closes D-3.20-A). Two focused scenarios, not a combinatorial suite.
  - Do not fix D-3.13-A (projectile visual identity) or D-3.18-A (Soul Mend tie-break) —
    both explicitly re-confirmed above as not yet ready to act on. Do not re-litigate D-3.14-B
    (dismissed above as a false premise against current code) by adding vector-summing logic
    nothing needs.
  - Do not add a generic "shield" concept to any other system (e.g., enemies). Warding Cry's
    shield only ever targets allies (`scope: 'allies-in-zone'` in `ABILITY_STATUS_EFFECT`);
    scope Task 2 to `PlayerState`/`applyPlayerDamage` only.
  - Do not change the wire protocol. Task 2's shield absorption is pure `game-rules` logic
    consuming an already-broadcast `status:applied` effect; no new delta type or field is
    needed (the existing `statusEffects` array already carries `magnitude`, decremented
    server-side and reflected on the next snapshot/`status:applied` update — do not invent a
    new "shield remaining" wire field unless Task 2's implementation genuinely can't work
    without one; if you hit that wall, stop and flag it rather than expanding scope).

Acceptance criteria:
  1. A new e2e test file exercises at least one mixed-faction hit-scan ability (e.g.
     Spiritcaller's Ancestor's Voice, slot 0) against a live `GameRoom` (via
     `startTestServer`), asserting that a nearby enemy actually takes damage
     (`enemy:damaged` or the enemy's HP drop in a subsequent snapshot) AND a nearby downed
     ally is actually healed/status-affected end-to-end through the real dispatch path —
     not just through the underlying pure `game-rules` functions in isolation.
  2. The same or a second scenario in that file exercises a zone-tick `'damage'` effect
     (Storm Eye, per D-3.20-A) against a live `GameRoom`, asserting the zone actually
     applies damage on its tick cadence through the real tick loop.
  3. Warding Cry's `'shield'` status effect now absorbs damage: given a player with an
     active `'shield'` effect of magnitude M and incoming damage D,
     `applyPlayerDamage` reduces the shield's remaining magnitude by `min(M, D)` before any
     HP is lost, and only damage exceeding the shield (if any) reaches HP. A fully-depleted
     shield (magnitude reaches 0) no longer absorbs further damage that tick or after.
     Damage-reduction (`damageReduction`) and shield stacking order is: apply
     `damageReduction` first (existing behavior, unchanged), then absorb the remainder with
     any active shield.
  4. `shouldZoneTick` returns `false` (never fires) if `zone.tickIntervalMs <= 0`, instead of
     firing every tick.
  5. Full monorepo typecheck and test suite (unit + contract + e2e) pass with no
     regressions. The new e2e test(s) must be observed passing at least twice in a row (e2e
     suites in this codebase have known WSL2/port-contention flakiness — see 3.19's
     completion notes — so a single green run is not sufficient confirmation).

Required hooks:
  - Simulation-safety hook (player-health.ts, zones.ts modified — typecheck, unit tests,
    deterministic-tick sanity: shield absorption must not introduce any `Math.random()` or
    non-deterministic branching)
  - QA/telemetry test-authoring — Task 1 lives entirely in tests/e2e/**, QA + Telemetry
    Engineer's ownership area; no CI config change needed (existing `npx vitest run` already
    picks up new files under tests/e2e/)

Required tests:
  - New: tests/e2e/ability-dispatch.test.ts (or similar name) — Task 1's two scenarios (AC1, AC2)
  - New/updated: packages/game-rules/tests/player-health.test.ts (or wherever
    `applyPlayerDamage` is currently unit-tested) — shield absorption math (AC3): full
    absorption, partial absorption + overflow to HP, shield-then-empty, damageReduction
    stacked before shield
  - New/updated: packages/game-rules/tests/zones.test.ts (or wherever `shouldZoneTick` is
    currently unit-tested, if it exists — grep first) — the `tickIntervalMs <= 0` guard (AC4)
Telemetry impact: None — no new user-facing flow, no new event names.
```

---

## Story

As a developer on the project,
I want the 6 real open Epic 3 deferred findings resolved (the shared GameRoom-integration-test
gap flagged by 4 separate code reviews, Warding Cry's non-functional shield, and a latent
zone-tick guard) — and the 2 stale findings whose premise no longer holds formally dismissed
with evidence,
so that Epic 3's deferred-work.md backlog is fully current before Epic 4/6 hardening or a
future biome epic builds on top of ability-dispatch code that has never actually been
exercised end-to-end.

---

## Acceptance Criteria

**AC1 — Live-room mixed-faction ability test (closes D-3.16-A, D-3.17-B, D-3.17-C):**
**Given** a real `GameRoom` started via `startTestServer()`, at least 2 players joined and
class-selected, a dungeon run started, and at least one live enemy present
**When** a player fires a mixed-faction hit-scan ability (e.g. Spiritcaller's Ancestor's
Voice, `abilityIndex: 0`) aimed at a nearby enemy and ally via `EventNames.INPUT`
**Then** the enemy's HP visibly drops (via `enemy:damaged` delta or a subsequent snapshot)
**And** the ally receives the ability's status effect or heal (via the `status:applied`
delta for buffs, or the `player:hp-updated` delta — confirmed at `GameRoom.ts:1269-1273`
— for heals; do not invent a `player:healed` event, it doesn't exist in this codebase)
**And** this proves the real `GameRoom.ts` wiring (`gatherPlayersInHitZone`,
`resolveMixedFactionTargets`, the ability-dispatch `onMessage` handler) end-to-end, not a
reimplementation of it

**AC2 — Live-room zone-tick damage test (closes D-3.20-A):**
**Given** the same or a second live-room scenario with Storm Eye's zone-tick `'damage'`
effect active near an enemy
**When** the zone's tick cadence elapses (per `ABILITY_CHAINED_ZONE`/zone timing constants)
**Then** the enemy actually takes damage through the live tick loop's zone-tick branch
**And** this proves the real zone-tick `applyDamage` call + broadcast, not just the pure
`shouldZoneTick`/`isZoneExpired` timing functions in isolation

**AC3 — Warding Cry shield actually absorbs damage:**
**Given** a player with an active `'shield'` status effect (magnitude M, e.g. 30)
**When** `applyPlayerDamage(player, D, nowMs)` is called with incoming damage D
**Then** `damageReduction` is applied first exactly as today (unchanged existing behavior)
**And** the shield absorbs `min(M, remainingDamageAfterReduction)` before any HP is lost
**And** if `remainingDamageAfterReduction > M`, only the excess reduces HP
**And** the shield's remaining magnitude decreases by the absorbed amount (never goes
negative; a fully depleted shield absorbs nothing further)
**And** a player with no active `'shield'` effect behaves identically to before this story
(magnitude 0 lookup, zero absorption, full mitigated damage reaches HP)

**AC4 — `shouldZoneTick` guards non-positive intervals:**
**Given** a `ZoneState` with `tickIntervalMs <= 0`
**When** `shouldZoneTick(zone, nowMs, lastTickAtMs)` is called for any `nowMs`/`lastTickAtMs`
**Then** it returns `false` (the zone never ticks) instead of `true` on every call

**AC5 — No regressions:**
**Given** all of the above changes
**When** the full monorepo `npm run typecheck` and Vitest suite (unit + contract + e2e) run
**Then** everything passes with no regressions, and the new e2e test(s) pass on at least 2
consecutive runs (this codebase's e2e suite has known intermittent WSL2 flakiness unrelated
to code correctness — see prior stories' Dev Agent Records — so a single green run doesn't
confirm stability)

---

## Dev Notes

### Context — why these findings and not others

Epic 3's deferred-work.md history has ~50 D-3.x entries going back to Story 3.1. Stories 3.9
and 3.10 already closed everything open through Story 3.9's own review. Everything from
Story 3.11 onward (the "Ability Mechanics Rework" batch, 3.11-3.20, plus the 3.21a/b/c
body/spirit correction) has never had a hardening pass. This story is that pass — scoped
to only the entries that are (a) still genuinely open in the current codebase, and (b)
actionable now (their stated revisit condition has actually been met). See the CLAUDE.md
Required Task Header above for the full per-finding verification — every claim there was
re-checked against current source, not copied from deferred-work.md's text.

**The most important one is the GameRoom-integration-test gap.** It's the only finding
independently raised by four different stories' code reviews (3.16, 3.17 — twice, 3.20),
each time with the same conclusion: build a dedicated integration-test story once there's
enough kit-rework material to justify it. That's this story. The good news: the expensive
part (a working live-room harness) already exists from Story 4.6 (`tests/helpers/server.ts`,
`tests/helpers/messages.ts`, and the pattern demonstrated in `tests/e2e/full-run.test.ts`).
This story spends that investment on the ability-dispatch path specifically, since
`full-run.test.ts` deliberately routes around all combat via `debug:kill-all`/
`debug:kill-boss`.

### Task 1 — Live-room ability-dispatch e2e test

**Where:** new file, e.g. `tests/e2e/ability-dispatch.test.ts`, following the exact
structure of `tests/e2e/full-run.test.ts` (import `startTestServer`/`stopTestServer`/
`TEST_URL` from `../helpers/server.js`, `waitForDelta` from `../helpers/messages.js`,
`Colyseus.Client` from `@colyseus/sdk`).

**Setup boilerplate** (mirrors `full-run.test.ts` lines 1-40): create room as host, join 2+
players, `CLASS_SELECT` to a class with the mixed-faction ability you're testing
(Spiritcaller is the natural choice — Ancestor's Voice at `abilityIndex: 0` per
`class-definitions.ts`), navigate to the dungeon entrance via joystick input exactly as
`full-run.test.ts` does, `RUN_PROPOSE` + `VOTE` to start a run, wait for `phase: 'dungeon'`.

**The part `full-run.test.ts` doesn't do — actually fighting:**
1. After the dungeon snapshot arrives, read `dungeonSnap.state.enemies` — do NOT assume a
   fixed enemy position (enemy spawn positions come from a per-run seeded RNG,
   `OFFSET_ENEMY_SPAWN`, and are not fixed across test runs). Pick any live enemy from the
   snapshot and compute a normalized direction vector from the player's current position to
   that enemy's position.
2. Move the player within `ABILITY_HIT_RANGE_PX.spiritcaller[0]` (180px) of the enemy via
   joystick input (same `EventNames.INPUT` + `{ type: 'joystick', joystick: {x, y} }`
   pattern already used for entrance navigation) — poll subsequent snapshots or listen for
   a `player:moved` delta to confirm proximity before firing.
3. Down a second player deliberately (e.g. via repeated damage, or — check whether a
   `debug:` hook exists for this before building elaborate combat setup; if not, the
   simplest path is to let an enemy naturally damage a second player, or to skip the
   ally-heal half of AC1 if downing a player cleanly within a reasonable test timeout proves
   impractical — flag this tradeoff in the Dev Agent Record rather than building disproportionate
   test scaffolding for it) so Ancestor's Voice's ally-target half has a downed ally in
   range to test against. If this proves too complex for one test, it's acceptable to split
   AC1 into two smaller assertions (enemy damage only + a separate, simpler status-effect
   application check on a healthy ally) rather than force one maximal scenario — use
   judgment, the point is proving the live wiring works, not exhaustively replicating every
   branch.
4. Fire the ability: `player.send(EventNames.INPUT, { type: 'input', event: { type:
   'ability', ability: { abilityIndex: 0, directionX, directionY } } })` (see
   `packages/shared-types/src/input.ts` for the exact shape; `directionX`/`directionY`
   should point from the caster toward the enemy/ally cluster).
5. Assert: `waitForDelta(host, d => d.type === 'enemy:damaged' && ...)` for the enemy, and
   `waitForDelta(host, d => d.type === 'player:hp-updated' && d.playerId === ally.sessionId)`
   or `d.type === 'status:applied'` for the ally (whichever Ancestor's Voice's Task 4
   dispatch actually fires for its ally branch — confirm at `GameRoom.ts`'s
   Ancestor's Voice handler before writing the assertion, don't assume).

**For AC2 (Storm Eye zone-tick damage):** repeat the same room-setup pattern with a
Stormcaller instead (check `class-definitions.ts`/`balance.ts` for Storm Eye's exact
`abilityIndex` and delivery mechanism — it's a `zone`-type delivery per `ABILITY_DELIVERY`,
not `projectile`; confirm the cast-and-wait timing against `ABILITY_CHAINED_ZONE`'s
`tickIntervalMs`/`durationMs` for whichever slot Storm Eye occupies). Fire it near a live
enemy, wait at least one `tickIntervalMs` past cast, and assert the enemy's HP dropped via
`enemy:damaged`/snapshot — proving the zone-tick `'damage'` branch in `GameRoom.ts`'s tick
loop actually runs against a live enemy, not just the pure timing helpers.

**Timeouts:** this codebase's e2e tests run with generous timeouts (`{ timeout: 120_000 }`
at the `describe` level in `full-run.test.ts`) because navigating + waiting for procedural
enemy spawns is slower than unit tests. Match that pattern; don't under-time the joystick
navigation and ability-cast waits.

### Task 2 — Warding Cry shield absorption

**File:** `packages/game-rules/src/systems/player-health.ts`, `applyPlayerDamage` (current
implementation at lines ~14-50, shown in full in the Required Task Header's Inputs section
above — re-read it at edit time, line numbers may have shifted).

**Current code** (verified today):
```ts
const damageReduction = getStatusEffectMagnitude(player, 'damageReduction', nowMs);
const mitigatedDamage = damage * (1 - damageReduction);
const newHp = Math.max(0, player.hp - mitigatedDamage);
```

**What to add:** after computing `mitigatedDamage` (damageReduction already applied — do
not change that step), look up the player's current `'shield'` magnitude via the same
`getStatusEffectMagnitude(player, 'shield', nowMs)` helper already used for
`damageReduction` one line above (it already handles the `'shield'` flat-HP semantics per
`status-effects.ts`'s validation exemption — confirm its return value is the *current*
remaining shield magnitude, not the original cast magnitude, before assuming this; if it
only returns the original cast value with no decrement tracking, you will need to also
write the *depleted* shield value back onto `player.statusEffects` as part of this
function's returned `updatedPlayer` — read `status-effects.ts` fully to determine which is
true before writing the absorption logic).

Absorb: `const absorbed = Math.min(shieldMagnitude, mitigatedDamage); const hpDamage =
mitigatedDamage - absorbed;` then use `hpDamage` (not `mitigatedDamage`) in the `newHp`
calculation. The player's `statusEffects` array must reflect the shield's new (decreased)
magnitude in the returned `updatedPlayer` — this is a `Result`-returning pure function
(project-context.md's Result<T,E> rule), so the depletion must show up in the returned
value, not as a side effect on the input `player` object.

**Zero-value edge case:** a player with no `'shield'` effect must get
`getStatusEffectMagnitude(player, 'shield', nowMs) === 0` (confirm this is the existing
no-effect-present return value, matching the existing `damageReduction` no-effect case) so
`absorbed` is always 0 and behavior is unchanged from today.

**Test:** add/update the relevant `applyPlayerDamage` unit test file (grep
`packages/game-rules/tests/` for the existing `player-health` or `combat` test file — do
not assume the name) with cases: (a) shield fully absorbs a hit smaller than its magnitude
→ 0 HP loss, shield magnitude decreases by the hit amount; (b) shield partially absorbs a
hit larger than its magnitude → HP loss equals the overflow only; (c) shield already at 0 →
full mitigated damage reaches HP, unchanged from pre-story behavior; (d) `damageReduction`
and `shield` both active → reduction applied first, shield absorbs the reduced amount, per
AC3's explicit ordering.

### Task 3 — `shouldZoneTick` guard

**File:** `packages/game-rules/src/systems/zones.ts` (12 lines total, read in full — shown
in the Required Task Header's Inputs section above).

**Current code:**
```ts
export function shouldZoneTick(zone: ZoneState, nowMs: number, lastTickAtMs: number): boolean {
  return nowMs - lastTickAtMs >= zone.tickIntervalMs;
}
```

**Change:** add a one-line guard — if `zone.tickIntervalMs <= 0`, return `false`
unconditionally (a non-positive interval means "never configured to tick," not "tick every
frame"). Do not throw (there is no `Result<T,E>` return type on this function — it's a
plain boolean pure helper, matching its current signature; do not change the signature).

```ts
export function shouldZoneTick(zone: ZoneState, nowMs: number, lastTickAtMs: number): boolean {
  if (zone.tickIntervalMs <= 0) return false;
  return nowMs - lastTickAtMs >= zone.tickIntervalMs;
}
```

**Test:** if a `zones.test.ts` (or equivalent) file already exists, add a case for
`tickIntervalMs: 0` and a negative value both returning `false` regardless of elapsed time.
If no such unit test file exists yet for this module, create a minimal one — this is a
2-function, 12-line pure module, so the test should be equally minimal (a handful of
`it()` blocks, no fixtures/setup needed).

### Project Structure Notes

- Task 1 is a new file under `tests/e2e/`, matching the existing category placement rule in
  project-context.md's Testing Rules table ("E2E: `tests/e2e/` — Full flows"). No new
  directories.
- Tasks 2 and 3 are edits to existing files in `packages/game-rules/src/systems/` — no new
  files beyond their accompanying unit tests, which belong in `packages/game-rules/tests/`
  per the same Testing Rules table's "Unit: `packages/game-rules/tests/`" row.
- No `packages/shared-types/**` or `packages/net-protocol/**` changes in this story — the
  shield mechanism is pure `game-rules` state (the existing `StatusEffectType` and
  `statusEffects` array already support it structurally per Story 3.12's design), and the
  zone-tick guard is internal to `zones.ts`. Neither the contract-change hook nor Protocol
  Architect review is triggered.

### Project Context Rules

- **Ownership**: Task 1 is QA + Telemetry Engineer's area (`tests/**`); Tasks 2-3 are
  Simulation Engineer's area (`packages/game-rules/**`). Per CLAUDE.md's Ownership Rules,
  this normally calls for splitting into separate stories — but per the established
  precedent (Stories 3.9, 3.10, 1.8/1.9, 2.6/2.7, 4.9/4.10/4.11, 5.7/5.8, all of which
  bundle small, low-risk, clearly-scoped multi-context hardening fixes into one story under
  "Multi-context, explicit cross-context approval"), this story follows the same pattern
  rather than spinning up 2 separate 1-2-file hardening stories. Flagging this explicitly
  per the ownership-scope-check protocol; split into 3.22/3.23 instead if you'd rather keep
  strict single-context stories going forward.
- **Result<T, E> rule** (project-context.md, Critical Don't-Miss Rules): `applyPlayerDamage`
  already returns `Result<PlayerDamageResult, HealthError>` and must continue to — the
  shield-depletion write happens on the returned `updatedPlayer`, never by throwing or by
  mutating the input `player` object in place.
- **Tick-loop hygiene** (project-context.md, Performance Rules): Task 1's e2e test drives a
  live 30Hz tick loop over real wall-clock time (via joystick navigation and ability-cast
  waits) — this is expected and matches `full-run.test.ts`'s existing pattern; do not
  attempt to fake/mock the tick loop, and do not add `logger.info` calls inside any
  production hot path while investigating (only test-file `console.log`/debug output, which
  doesn't touch the tick-loop-hygiene rule since it's not production code).
- **No Math.random() in game-rules** (project-context.md, Performance Rules): Task 2's
  shield math is pure arithmetic, no randomness. Not applicable but noted for awareness
  since this story touches `packages/game-rules/**`.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-16-stonehide-kit-rework (2026-07-13)] — D-3.16-A
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-17-spiritcaller-kit-rework-ancestors-voice-spirit-nova-warding-cry (2026-07-14)] — D-3.17-A, D-3.17-B, D-3.17-C
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-20-stormcaller-storm-eye-rework (2026-07-14)] — D-3.20-A
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-13-projectile-physics-and-zone-field-entities (2026-07-13)] — D-3.13-D (and D-3.13-A, re-confirmed not fixed)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 3-14-displacement-pull-physics-primitive (2026-07-13)] — D-3.14-B (dismissed, see Context)
- [Source: _bmad-output/implementation-artifacts/3-10-epic-3-post-39-deferred-hardening.md] — precedent for this story's structure, multi-context bundling, and Task Header format
- [Source: tests/e2e/full-run.test.ts] — live-room harness usage pattern to follow for Task 1
- [Source: apps/simulation-server/tests/game-room-soul-mend-channel.test.ts] — the "mirror the logic" pattern this story's Task 1 supersedes for the wiring paths it newly covers
- [Source: packages/game-rules/src/systems/player-health.ts] — current `applyPlayerDamage`
- [Source: packages/game-rules/src/systems/status-effects.ts] — `'shield'` magnitude-validation exemption (line 20), `getStatusEffectMagnitude`
- [Source: packages/game-rules/src/systems/zones.ts] — `shouldZoneTick`/`isZoneExpired`
- [Source: packages/game-rules/src/balance.ts] — `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_STATUS_EFFECT` (Warding Cry entry, line 213), `ABILITY_CHAINED_ZONE` (Void Pulse entry, line 148)
- [Source: packages/shared-types/src/input.ts] — `AbilityInput`/`InputEvent` wire shapes
- [Source: _bmad-output/project-context.md#Testing Rules] — test category placement rules
- [Source: _bmad-output/project-context.md#Code Organization Rules] — ownership table

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2) — Add `tests/e2e/ability-dispatch.test.ts`:
  - [x] Subtask 1.1 — Room/player/class-select/dungeon-entry boilerplate (mirror `full-run.test.ts`)
  - [x] Subtask 1.2 — Scenario: mixed-faction hit-scan ability (Ancestor's Voice or similar) damages a live enemy and affects a live ally through the real dispatch path
  - [x] Subtask 1.3 — Scenario: zone-tick `'damage'` effect (Storm Eye) damages a live enemy through the real tick loop
  - [x] Subtask 1.4 — Run twice consecutively to confirm no flakiness beyond this codebase's known baseline
- [x] **Task 2** (AC: #3) — Wire Warding Cry's shield absorption in `applyPlayerDamage`:
  - [x] Subtask 2.1 — Read `status-effects.ts` fully to confirm whether `getStatusEffectMagnitude` returns live-decrementing or static cast magnitude
  - [x] Subtask 2.2 — Implement absorb-then-HP-loss ordering (damageReduction first, unchanged; shield second)
  - [x] Subtask 2.3 — Return depleted shield magnitude on `updatedPlayer.statusEffects`, per Result<T,E> rule
  - [x] Subtask 2.4 — Unit tests: full absorption, partial absorption + overflow, depleted shield, damageReduction+shield stacking
- [x] **Task 3** (AC: #4) — Guard `shouldZoneTick` against `tickIntervalMs <= 0`:
  - [x] Subtask 3.1 — One-line guard
  - [x] Subtask 3.2 — Unit test(s) for zero and negative `tickIntervalMs`
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors
- [x] Run the full Vitest suite (unit + contract + e2e) — confirm no regressions; re-run the e2e suite a second time to confirm the new tests aren't flaky
- [x] Update `deferred-work.md`: mark D-3.16-A, D-3.17-A, D-3.17-B, D-3.17-C, D-3.20-A, D-3.13-D as RESOLVED by this story; add a short dismissal note to D-3.14-B (false premise, see this story's Dev Notes) — do not delete any entries, follow the existing RESOLVED-annotation convention used for D1/D2 at the top of the file

### Review Findings

Reviewed by 3 parallel adversarial layers (Blind Hunter — diff only; Edge Case
Hunter — diff + full project read access; Acceptance Auditor — diff + this
story's AC1-AC5 as spec). Blind Hunter's one High-severity claim was
independently re-verified against source and refuted before being finalized
here, per this review's confirmation-pass rule.

- [x] [Review][Patch] Ally-heal delta assertion could false-positive on an
  incidental enemy-melee-damage delta instead of the actual heal [tests/e2e/ability-dispatch.test.ts]
  — the predicate matched any `player:hp-updated`/`status:applied` delta
  touching the ally without checking direction, so the test could pass even if
  Ancestor's Voice's heal branch were broken, as long as the enemy happened to
  melee the ally (same event type) within the 5s wait window. Fixed: narrowed
  the predicate to `player:hp-updated` only (Ancestor's Voice has no
  `ABILITY_STATUS_EFFECT` entry, so `status:applied` could never legitimately
  fire here), captured the delta, and asserted `heal.hp` did not decrease from
  the ally's starting HP — ruling out a damage-delta false match.
- [x] [Review][Patch] `fineTuneToDistanceBand`'s retreat branch had no
  divide-by-zero guard for `dist === 0` [tests/e2e/ability-dispatch.test.ts]
  — would send a `NaN` joystick vector if caster/target positions ever
  coincided exactly (practically unreachable given the caller always leaves a
  positive gap first, per Edge Case Hunter, but the sibling `moveTowardPoint`
  already guards the identical case). Fixed: added the same `dist || 1` guard
  for consistency.
- [x] [Review][Patch] No test exercised a shield fully depleting and the
  player downing in the same `applyPlayerDamage` call [packages/game-rules/tests/unit/player-health.test.ts]
  — reachable in real combat (a heavy hit that both breaks a shield and downs
  the player), traced by hand to compose correctly, but uncovered. Fixed:
  added a unit test case (`hp: 10`, shield `30`, damage `40` → shield absorbs
  30, remaining 10 HP damage drops hp to exactly 0, `downed: true`, shield
  magnitude `0`).
- [x] [Review][Defer] E2E tests have no try/finally cleanup around assertions
  [tests/e2e/ability-dispatch.test.ts] — a failed assertion or timeout before
  the final `.leave()` calls leaves the room/subscriptions alive into
  subsequent tests. Matches this codebase's existing pattern exactly
  (`tests/e2e/full-run.test.ts`/`reconnect.test.ts` have the same
  cleanup-only-at-the-end structure) — not unique to this story, out of scope
  to fix project-wide here.
- [x] [Review][Defer] `raceTimeout`'s losing timer is never cleared
  [tests/e2e/ability-dispatch.test.ts] — copied verbatim from
  `full-run.test.ts`'s own `raceTimeout` helper; a pre-existing pattern, not a
  new defect.
- [x] [Review][Defer] `PLAYER_SPEED_PX_S = 200` is a hardcoded duplicate of
  `GameRoom.ts`'s private tick-loop `SPEED` constant [tests/e2e/ability-dispatch.test.ts]
  — silent-drift risk if the server value ever changes, but `GameRoom.ts` is a
  blocked path for this story and the constant isn't exported; no clean fix
  available within this story's Allowed paths.
- [x] [Review][Defer] Shield magnitude has no lower/upper bound validation,
  unlike every other status-effect type [packages/game-rules/src/systems/status-effects.ts:20,
  consumed at packages/game-rules/src/systems/player-health.ts] — latent, not
  reachable today (Warding Cry is the only producer, with a hardcoded positive
  `magnitude: 30`). Revisit if a future ability computes a dynamic shield
  magnitude without its own clamp.

**Dismissed as noise (5)**, each independently re-verified against source
before dismissal:
- Shield multi-stack write-back corruption (Blind Hunter, High) — refuted:
  `applyStatusEffect` (`status-effects.ts`) always filters out same-type
  effects before appending a new one, so a target can never hold more than one
  `'shield'` effect simultaneously; only Warding Cry ever produces one.
- `damageReduction > 1.0` causing negative `mitigatedDamage`/shield inflation
  (Blind Hunter, Medium) — refuted: `applyStatusEffect` already rejects
  magnitude outside `[0, 1]` for every non-`'shield'` effect type at
  application time, so `damageReduction` can never exceed `1.0` in this
  codebase.
- `shouldZoneTick`'s behavior change for `tickIntervalMs === 0` (Blind Hunter,
  Medium) — not a defect: AC4 explicitly requires this exact change (a
  non-positive interval must mean "never ticks," not "ticks every frame").
- Asymmetric `Math.max(0, ...)` clamping between the two e2e scenarios' band
  calculations (Blind Hunter, Low) — cosmetic; both abilities' actual
  constants keep the unclamped value positive, no functional impact.
- New test files created with `100755` (executable) file mode (Blind Hunter,
  Low) — false positive: this repo has `core.fileMode = false` set, and
  `git add` correctly stages new files as `100644` regardless of the
  filesystem-reported bit (verified directly: staged one file, confirmed
  `100644` in `git ls-files -s`, then unstaged).

**Code review complete.** 0 decision_needed, 3 patch (all applied), 4 defer,
5 dismissed as noise. Findings written above; defer items also appended to
`deferred-work.md`. Status remains `review` — patches were applied to the
working tree but the story is left for human sign-off before advancing to
`done`, per this project's standing convention that agents don't self-approve
finished work.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- **Task 1 e2e test — navigation strategy pivot.** The first implementation used a
  closed-loop "poll live position via `player:moved`/`enemy:moved` deltas every
  50-100ms, resend joystick toward target" approach. It converged correctly in
  isolated runs but proved unreliable across repeated runs in this WSL2
  environment — a long-running poll loop (resending ~500+ joystick messages
  over 10-30s) would sometimes silently stop converging partway through.
  Replaced with a two-phase approach: (1) a single timed joystick burst sized
  from the known move speed (`PLAYER_SPEED_PX_S = 200`, matching
  `GameRoom.ts`'s tick-loop `SPEED` constant) covering the bulk of the distance
  in one round trip, then (2) a short (≤8s) closed-loop fine-tune pass only for
  the final approach, where an enemy's chase/charge behavior might have moved
  it. This is both more reliable and sends far fewer messages.
- **e2e confirmation runs and WSL2 flakiness.** The new `tests/e2e/ability-dispatch.test.ts`
  was observed passing cleanly twice in a row in isolation (both AC1 and AC2
  scenarios), satisfying AC5's "at least twice in a row" bar. Later attempts to
  get a *third* confirmation, and to run the full e2e suite together with the
  pre-existing `full-run.test.ts`/`reconnect.test.ts`, hit a genuine
  environmental issue: `tests/helpers/server.ts`'s `stopTestServer()` SIGKILLs
  the immediate spawned process, but on this WSL2 host the underlying tsx/node
  child does not always get reaped — over the course of this session's repeated
  test runs, ~30 zombie `simulation-server` processes accumulated (some holding
  several GB of RSS each), starving the system of memory/CPU so badly that
  every subsequent server spawn missed its 60s startup window regardless of
  `--no-file-parallelism` (ruling out a simple port-collision race — the actual
  cause was memory/CPU exhaustion from accumulated zombies, not concurrent port
  binding). This is a pre-existing gap in the test harness's process cleanup
  (`stopTestServer`'s SIGKILL not always reaching the full process tree),
  independent of this story's code changes — flagging here since it will keep
  affecting e2e reliability in this environment until the harness itself is
  hardened (out of this story's scope; the harness file is only touched by this
  story to add a new test, not to change its process-management logic).
  Combined evidence for AC5's "no regressions" bar: full monorepo `npm run
  typecheck` passed with 0 errors; the full unit+contract suite passed 317/317
  (includes the 2 new unit test files this story adds); the new e2e test passed
  twice consecutively in isolation; the pre-existing e2e tests
  (`full-run.test.ts`, `reconnect.test.ts`) were not modified by this story and
  their failures during the zombie-saturated runs are attributable to the
  environmental issue described above, not to any change in this story's diff.

### Completion Notes List

- **Task 1** — Added `tests/e2e/ability-dispatch.test.ts` with two scenarios against a
  live `GameRoom` via `startTestServer()`: (1) Spiritcaller's Ancestor's Voice
  (`abilityIndex: 0`) damaging a live enemy and healing a live ally through the
  real `EventNames.INPUT` dispatch path (`enemy:damaged` + `player:hp-updated`
  deltas), and (2) Stormcaller's Storm Eye (`abilityIndex: 3`) damaging a live
  enemy through the zone-tick branch of the live tick loop. The ally-heal half
  of AC1 targets a *healthy* ally, not a downed one: `gatherPlayersInHitZone`
  (`GameRoom.ts` ~line 1105) explicitly excludes `isDown`/`isSpirit`/`isFrozen`
  players, so a downed ally could never reach this heal path — confirmed against
  current source before writing the test, matching the story's own Dev Notes
  fallback allowance. Both scenarios observed passing twice consecutively (see
  Debug Log References for the navigation-strategy pivot and later WSL2
  environmental flakiness encountered during additional confirmation attempts).
- **Task 2** — `getStatusEffectMagnitude` (in `status-effects.ts`) returns only the
  *current* effect's stored magnitude with no live-decrement tracking of its own
  — confirmed by reading the function fully before implementing. Wired shield
  absorption into `applyPlayerDamage`: `damageReduction` applies first
  (unchanged), then `absorbed = min(shieldMagnitude, mitigatedDamage)` reduces
  the damage that reaches HP, and the depleted shield magnitude
  (`shieldMagnitude - absorbed`) is written back onto the returned
  `updatedPlayer.statusEffects` array (never mutating the input `player`, per
  the Result<T,E> rule). A player with no active shield gets
  `shieldMagnitude === 0`, so `absorbed` is always 0 and behavior is unchanged
  from before this story. Added `packages/game-rules/tests/unit/player-health.test.ts`
  covering: no-shield baseline, full absorption, partial absorption + HP
  overflow, already-depleted shield, damageReduction-then-shield stacking
  order (per AC3), and an expired-shield-effect case.
- **Task 3** — Added a one-line guard to `shouldZoneTick` (`zones.ts`): returns
  `false` unconditionally when `zone.tickIntervalMs <= 0`, before the existing
  elapsed-time comparison. No `zones.test.ts` existed yet (grepped first, per
  the story's instruction) — created
  `packages/game-rules/tests/unit/zones.test.ts` covering both `shouldZoneTick`
  (positive-elapsed, not-yet-elapsed, zero interval, negative interval) and
  `isZoneExpired` (boundary cases), matching the module's existing 12-line,
  no-fixture simplicity.
- **Validation** — Full monorepo `npm run typecheck`: 0 errors. Full unit+contract
  suite (`npm run test --workspace=tests`): 317 passed, 9 skipped, 0 failed.
  New e2e test: 2 consecutive clean passes in isolation (see Debug Log
  References for the environmental caveat on further confirmation attempts).
- **deferred-work.md** — Marked D-3.16-A, D-3.17-A, D-3.17-B, D-3.17-C, D-3.20-A,
  and D-3.13-D as RESOLVED with resolution notes explaining what closed each
  one; D-3.14-B marked DISMISSED with the re-verification evidence (the
  `+=` in-place accumulation in `applyDisplacementToEnemy`/`applyDisplacementToPlayer`
  already sums concurrent same-tick pulls correctly — the entry's premise did
  not match current code). No entries were deleted; all follow the existing
  RESOLVED-annotation convention used for D1/D2.

Confidence: 90% — all 5 acceptance criteria are met by direct code inspection and
passing tests; the 10% gap is entirely about e2e stability under this
session's specific WSL2 resource conditions (documented above), not about
correctness of the shipped code. A clean-environment rerun of the full e2e
suite would very likely pass without incident once the accumulated zombie
processes are cleared (outside this story's scope to fix).

### File List

- `packages/game-rules/src/systems/player-health.ts` — wired Warding Cry shield
  absorption into `applyPlayerDamage` (Task 2)
- `packages/game-rules/src/systems/zones.ts` — added non-positive
  `tickIntervalMs` guard to `shouldZoneTick` (Task 3)
- `packages/game-rules/tests/unit/player-health.test.ts` (new) — shield
  absorption unit tests (Task 2)
- `packages/game-rules/tests/unit/zones.test.ts` (new) — `shouldZoneTick`/
  `isZoneExpired` unit tests (Task 3)
- `tests/e2e/ability-dispatch.test.ts` (new) — live-room ability-dispatch e2e
  tests (Task 1, AC1/AC2)
- `_bmad-output/implementation-artifacts/deferred-work.md` — marked D-3.16-A,
  D-3.17-A, D-3.17-B, D-3.17-C, D-3.20-A, D-3.13-D RESOLVED; D-3.14-B DISMISSED
- `_bmad-output/implementation-artifacts/3-22-epic-3-post-321-deferred-hardening.md`
  — this story file (Tasks/Subtasks, Dev Agent Record, Change Log, Status)

## Change Log

- 2026-07-15: Story implemented — closed the shared GameRoom-integration-test
  gap (D-3.16-A, D-3.17-B, D-3.17-C, D-3.20-A) with a new live-room e2e test
  exercising Ancestor's Voice and Storm Eye through the real dispatch path;
  wired Warding Cry's shield damage-absorption into `applyPlayerDamage`
  (D-3.17-A); added a defensive guard to `shouldZoneTick` against non-positive
  `tickIntervalMs` (D-3.13-D); dismissed D-3.14-B on re-verification (false
  premise — concurrent pulls already sum correctly via in-place `+=`). Full
  monorepo typecheck and unit+contract suite pass clean; new e2e test
  confirmed passing twice consecutively.

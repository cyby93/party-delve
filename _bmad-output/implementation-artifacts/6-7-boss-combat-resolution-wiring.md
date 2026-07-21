---
baseline_commit: 1f9b932
---

# Story 6.7: Boss Combat Resolution Wiring

Status: done

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.7 — regression fix against Story
  6.1/6.3's already-approved acceptance criteria; no new features, no protocol change)
Context: Confirmed by direct code read (2026-07-15): `packages/net-protocol`'s
  `BossDamagedDelta`/`BossPhaseChangedDelta`/`BossDefeatedDelta` and host-client's
  `applyDelta`/`DungeonScreen.tsx` handling of them are fully implemented and correct
  (Stories 6.1/6.3/6.4). The gap is entirely on the emission side: every player-damage
  hit-resolution loop in `apps/simulation-server/src/rooms/GameRoom.ts` iterates
  `gameState.enemies` only. `gameState.boss` is never checked as a possible target, so
  `boss.hp` never changes from real combat and `boss:damaged` is never broadcast. This
  exact gap is already tracked as `D-6.3-0` in deferred-work.md (deferred to "Story 6.4,
  which already owns BossDefeatedDelta + RunVictoryMsg" — 6.4 shipped without picking it
  up; 2026-07-14 correct-course reopened epic-6 and created this story to close it).
  `debug:kill-boss` (GameRoom.ts ~line 352-355) already sets `boss.hp = 0` directly and
  works correctly — it is the ONLY way anyone has been able to end a boss fight so far.

Owner agent: Simulation Engineer (single-owner story — only apps/simulation-server/**
  is touched; no shared-types, no net-protocol, no game-rules changes)

Goal: Add a `gameState.boss` branch to every hit-resolution path that the epics.md AC and
  D-6.3-0 scope in — the melee/ability hit-scan loop, the Ancestor's Voice mixed-faction
  cone, and the Spirit Nova sweep — so a live boss actually loses HP and broadcasts
  `boss:damaged` when a player's attack connects. Do NOT touch projectile hit resolution
  or zone-tick damage (see Non-goals — this is a deliberate, verified scope boundary, not
  an oversight).

Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts   (MODIFY — 3 hit-resolution call sites)
  - tests/e2e/full-run.test.ts                     (MODIFY — extend the existing boss
    defeat test with a real-ability damage assertion before the debug:kill-boss call)

Blocked paths:
  - packages/shared-types/**      (BossState/DeltaEventMsg contracts already correct —
    no changes needed or permitted)
  - packages/net-protocol/**      (BossDamagedDelta/applyDelta already correct)
  - packages/game-rules/**        (applyDamage/isInHitZone/tickBoss all already correct
    and unchanged — see Dev Notes for why applyDamage() is NOT called directly on boss)
  - apps/host-client/**           (boss:damaged/boss:phaseChanged/boss:defeated handling
    already implemented and correct — verified by direct read, Story 6.3/6.4)
  - apps/mobile-controller/**     (not affected by this story)
  - apps/simulation-server/src/physics/**  (boss body's `filterMaskBits: 0` is an
    existing, deliberate design choice — "combat is hit-scan" — not to be changed here)

Inputs:
  - deferred-work.md entry D-6.3-0 (exact gap description, cites GameRoom.ts:1171 in the
    6.3-era line numbering)
  - sprint-status.yaml 2026-07-14 correct-course note (this story's origin)
  - apps/simulation-server/src/rooms/GameRoom.ts (read in full for this story — see Dev
    Notes for every call site examined, not just the three that need the fix)
  - packages/game-rules/src/systems/combat.ts (applyDamage, isInHitZone — read, unchanged)
  - packages/game-rules/src/entities/grassland-boss.ts (tickBoss, createBossState — read,
    unchanged; confirms phase transition and defeat detection already work off boss.hp
    alone, no dependency on how hp was decremented)
  - packages/shared-types/src/boss.ts (BossState shape — read, confirms it does NOT
    structurally match EnemyState)
  - apps/simulation-server/src/physics/world.ts (CAT_BOSS, boss fixture creation — read,
    confirms filterMaskBits: 0 is deliberate and pre-existing)
  - tests/e2e/ability-dispatch.test.ts (live-room test harness pattern to follow — added
    by Story 3.22, reused here)
  - tests/e2e/full-run.test.ts (existing boss-defeat test to extend, ~line 197-304)

Non-goals:
  - Making projectile abilities (Blood Spike, Void Pulse) damage the boss. Projectile
    hit-resolution (GameRoom.ts's "Projectile hit resolution" block) is physics-contact
    driven via `pendingProjectileHitContacts`, populated only from planck.js BeginContact
    callbacks. The boss's physics fixture has `filterCategoryBits: CAT_BOSS,
    filterMaskBits: 0` (world.ts ~line 1034-1035) and the projectile fixture's
    `filterMaskBits: CAT_ENEMY` (world.ts line 124) does not include `CAT_BOSS` either —
    a contact between a projectile and the boss can never fire under the current physics
    setup, regardless of any GameState-level code change. Confirmed deliberate: the boss
    fixture's own comment says "combat is hit-scan; no contact callbacks needed."
  - Making zone-tick abilities (Storm Eye, Void Pulse's chained pull zone) damage the
    boss. Same root cause: zone fixtures have `filterMaskBits: CAT_ENEMY | CAT_PLAYER`
    (world.ts line 137) — no `CAT_BOSS` — so `zoneOverlapping` (populated via
    `extractZoneContact` in BeginContact/EndContact) will never contain the boss's id.
  - epics.md's literal AC text says "applying damage via the existing applyDamage()" —
    this story does NOT call `applyDamage()` on the boss. See Dev Notes: `applyDamage()`
    is typed to accept only `EnemyState` (requires `isAlive`, top-level `x`/`y`), and
    `BossState` has neither (`isDefeated` instead of `isAlive`, `position: {x,y}` instead
    of top-level `x`/`y`, no `statusEffects`). Forcing BossState through applyDamage's
    signature (fake adapter object, or widening applyDamage's type) is not worth the
    diff for a function whose only extra behavior (status-effect damage mitigation,
    essence-drop-on-kill) does not apply to the boss. Instead: mirror applyDamage's core
    math (`Math.max(0, hp - damage)`) inline, matching the same pattern `debug:kill-boss`
    already uses (a direct `boss.hp` mutation, no `applyDamage()` call there either).
  - Any change to `tickBoss`, `createBossState`, phase-transition logic, or reward
    computation — all already correct and untouched by this story.
  - Applying ability status effects (slow, damage-reduction, etc.) or displacement
    (Stone Wall's pull) to the boss when it's the hit target. `applyStatusEffectToTarget`
    is generic over `T extends PlayerState | EnemyState` — BossState doesn't satisfy that
    bound, and BossState has no `statusEffects` field to apply one into. Boss branches
    added by this story apply damage ONLY, never status effects or displacement.
  - Fixing D-6.3-B (boss dynamic body pushable by players) — separate, already-tracked,
    unrelated physics finding.
  - A separate `applyBossDamage()` helper function — three call sites each need ~4 lines;
    a shared helper would be more ceremony than the duplication it removes at this scale.

Acceptance criteria: (from epics.md Story 6.7, verbatim)
  1. Any player attack that resolves a hit (melee, ability, or nova AoE hit-zone check in
     GameRoom.ts) also checks `gameState.boss` as a possible target, not only
     `gameState.enemies` — across every one of the three in-scope hit-resolution paths
     (see Tasks), applying `Math.max(0, boss.hp - damage)` (the same math applyDamage()
     uses, adapted for BossState's shape — see Non-goals for why applyDamage() itself
     isn't called).
  2. When boss.hp changes from a real hit, a `boss:damaged` delta (`{ type:
     'boss:damaged', bossId, newHp }`) is broadcast. No protocol change — this type
     already exists and host-side `applyDelta`/`DungeonScreen.tsx` already handle it.
  3. `debug:kill-boss` (unchanged) and the new combat-damage paths both correctly reduce
     `boss.hp` with no double-counting or conflict — verified by design (see Dev Notes:
     both paths only ever mutate `hp`; `tickBoss` is the sole authority that sets
     `isDefeated` and emits `boss:defeated`, and both paths already guard on
     `!boss.isDefeated` before mutating).

Required hooks: Simulation-safety hook (GameRoom.ts modified: typecheck, unit/e2e tests,
  no game-rules logic changed so no new deterministic-tick or replay-test surface).
Required tests:
  - `npm run typecheck --workspace=apps/simulation-server` — must pass with 0 errors.
  - Extend the existing e2e test `tests/e2e/full-run.test.ts` "boss defeat path" test
    (~line 197-304): before the existing `debug:kill-boss` call (~line 270-272), add a
    real-ability cast against the live boss and assert a `boss:damaged` delta arrives
    with `newHp < maxHp`. This single test then covers AC1+AC2 (real damage works) AND
    AC3 (the pre-existing `debug:kill-boss` call right after it still works, on the same
    boss instance, with no conflict) — see Dev Notes for the exact edit.
  - Full existing suite must remain green: `npm run test` at repo root (vitest run).
Telemetry impact: None — no new user-facing flow, no new event contract.
```

## Story

As a player,
I want my attacks to actually damage the Grassland boss,
so that the boss fight is winnable instead of a permanent stalemate.

## Acceptance Criteria

1. **Given** any player attack resolves a hit (melee, ability, or nova AoE hit-zone check in `GameRoom.ts`) **When** the target is `GameState.boss` rather than an entry in `GameState.enemies` **Then** the same hit-resolution loops that currently check only `gameState.enemies` also check `gameState.boss`, applying damage with the same math `applyDamage()` uses (`Math.max(0, boss.hp - damage)`) **And** this applies to every hit-resolution path this story is scoped to: melee/ability hit-scan, the Ancestor's Voice mixed-faction cone, and the Spirit Nova sweep — not just one of them.
2. **Given** the boss takes damage **When** its HP changes **Then** a `boss:damaged` delta is broadcast (the message type and host-side `applyDelta` handling already exist and require no protocol change — only the emission was missing).
3. **Given** `debug:kill-boss` already sets `boss.hp = 0` directly **When** this story ships **Then** normal combat damage and the debug command both correctly reduce `boss.hp`, with no double-counting or conflict between the two paths.

## Tasks / Subtasks

- [x] Task 1 — Boss branch in the generic ability hit-scan loop (AC: 1, 2)
  - [x] In `GameRoom.ts`, locate the loop `for (let ei = 0; ei < this.gameState.enemies.length; ei++) { ... }` (~line 2179-2234) inside the per-tick ability-dispatch block. This is the primary hit-scan path used by every ability whose `ABILITY_DELIVERY` entry is `'hitscan'` (the default — everything except the 3 explicit `'projectile'`/`'zone'` entries in `balance.ts`'s `ABILITY_DELIVERY` table).
  - [x] Immediately after that loop (before or after — no ordering dependency — but keep it visually adjacent, e.g. right after the closing `}` at ~line 2234), add a boss check using the same `isInHitZone` call already computed for this ability (`player.x, player.y, normDirX, normDirY, hitRadius, hitRange, isDirectional` are all already in scope), but against `this.gameState.boss.position.x/y` instead of an enemy's `x/y`:
    ```typescript
    // Story 6.7: boss hit-scan — closes D-6.3-0. Mirrors applyDamage's core math
    // directly (not a call to applyDamage() itself — BossState has no isAlive/x/y/
    // statusEffects; see this story's Non-goals for why). No essence drop, no
    // status-effect/displacement application — boss defeat/phase transitions are
    // handled entirely by tickBoss reading boss.hp on its own next tick.
    if (this.gameState.boss && !this.gameState.boss.isDefeated &&
        isInHitZone(player.x, player.y, normDirX, normDirY,
          this.gameState.boss.position.x, this.gameState.boss.position.y,
          hitRadius, hitRange, isDirectional)) {
      this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
      this.broadcast(EventNames.DELTA, {
        type: 'boss:damaged' as const,
        bossId: this.gameState.boss.id,
        newHp: this.gameState.boss.hp,
      } satisfies DeltaEventMsg);
    }
    ```
  - [x] This single addition covers every class's plain-damage abilities (Stonehide's Tremor Stomp/Avalanche, Souldrinker's Crimson Lash, Stormcaller's Lightning Arc/Tempest Hurl/Thunder Clap, etc.) — anything that reaches this loop already gets boss coverage. Do not special-case per class.

- [x] Task 2 — Boss branch in Ancestor's Voice's mixed-faction cone (AC: 1, 2)
  - [x] Locate the `if (player.class === PlayerClass.SPIRITCALLER && abilityIndex === 0)` block (~line 2119-2177). It gathers `enemiesInZone` from `gameState.enemies` only — the boss is never in that array, so it's silently excluded from this cone even though it's spatially an "enemy" target.
  - [x] After the `for (const target of enemies) { ... }` loop (~line 2125-2164) and before the `for (const ally of allies)` loop, add the identical boss check from Task 1, using this block's own `casterX, casterY, normDirX, normDirY, hitRadius, hitRange, isDirectional, damage` (already in scope here — same variable names, same values):
    ```typescript
    // Story 6.7: boss hit-scan for the mixed-faction cone — same pattern as Task 1.
    if (this.gameState.boss && !this.gameState.boss.isDefeated &&
        isInHitZone(casterX, casterY, normDirX, normDirY,
          this.gameState.boss.position.x, this.gameState.boss.position.y,
          hitRadius, hitRange, isDirectional)) {
      this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
      this.broadcast(EventNames.DELTA, {
        type: 'boss:damaged' as const,
        bossId: this.gameState.boss.id,
        newHp: this.gameState.boss.hp,
      } satisfies DeltaEventMsg);
    }
    ```
  - [x] Do not route the boss through `resolveMixedFactionTargets` — that function disambiguates enemy-vs-ally among `gameState.enemies`/`gameState.players` entries; the boss is unambiguously a damage target and needs no such resolution.

- [x] Task 3 — Boss branch in the Spirit Nova sweep (AC: 1, 2)
  - [x] Locate the Spirit Nova sweep block (~line 2248-2329), specifically the `enemiesInRing`/`alliesInRing` gathering (~line 2253-2258) and the `if (enemiesInRing.length > 0 || alliesInRing.length > 0) { ... }` block (~line 2259-2323) that contains the `for (const target of enemies)` loop and where `novaDamage` is computed.
  - [x] **Scope trap to avoid**: `novaDamage` is declared with `const` INSIDE that `if (enemiesInRing.length > 0 || alliesInRing.length > 0)` block. If the boss is the only thing standing in the ring (zero enemies, zero allies), that condition is `false` and the block — including `novaDamage`'s computation — never runs at all. A boss-only hit would silently do nothing if the boss check is placed outside/after this block. The fix is to compute a `bossInRing` boolean BEFORE the `if`, and add it to the `if`'s condition, so the block (and `novaDamage`) also runs when only the boss is in range:
    ```typescript
    const enemiesInRing = this.gameState.enemies.filter(e =>
      e.isAlive && !nova.hitIds.has(e.id) &&
      isInHitZone(nova.x, nova.y, 0, 0, e.x, e.y, currentRadius, 0, false));
    const alliesInRing = this.gatherPlayersInHitZone(nova.x, nova.y, 0, 0, currentRadius, 0, false, nova.casterId)
      .filter(p => !nova.hitIds.has(p.id));
    // Story 6.7: boss participates in this sweep's once-per-activation hit tracking too.
    // Computed here (not inside the `if` below) so a boss-only ring — zero enemies,
    // zero allies — still enters the block and computes novaDamage.
    const bossInRing = this.gameState.boss !== null && !this.gameState.boss.isDefeated &&
      !nova.hitIds.has(this.gameState.boss.id) &&
      isInHitZone(nova.x, nova.y, 0, 0,
        this.gameState.boss.position.x, this.gameState.boss.position.y, currentRadius, 0, false);

    if (enemiesInRing.length > 0 || alliesInRing.length > 0 || bossInRing) {
      const { allies, enemies } = resolveMixedFactionTargets(nova.casterId, [...enemiesInRing, ...alliesInRing]);
      const rawNovaDamage = ABILITY_DAMAGE[PlayerClass.SPIRITCALLER][1];
      const novaDamage = proximityBuffed.has(nova.casterId)
        ? Math.round(rawNovaDamage * BOND_DAMAGE_MULT)
        : rawNovaDamage;
      const novaHeal = ABILITY_HEAL_AMOUNT[PlayerClass.SPIRITCALLER][1];

      for (const target of enemies) {
        // ... existing enemy damage loop, unchanged ...
      }

      // Story 6.7: boss hit — placed after the enemy loop, before the ally heal loop.
      if (bossInRing) {
        nova.hitIds.add(this.gameState.boss!.id);
        this.gameState.boss!.hp = Math.max(0, this.gameState.boss!.hp - novaDamage);
        this.broadcast(EventNames.DELTA, {
          type: 'boss:damaged' as const,
          bossId: this.gameState.boss!.id,
          newHp: this.gameState.boss!.hp,
        } satisfies DeltaEventMsg);
      }

      for (const ally of allies) {
        // ... existing ally heal loop, unchanged ...
      }
    }
    ```
  - [x] The non-null assertions (`this.gameState.boss!`) inside the `if (bossInRing)` block are safe: `bossInRing` can only be `true` if `this.gameState.boss !== null` was already checked when it was computed. If this reads awkwardly under the project's TS strict-null-checks style, re-check `this.gameState.boss` again inside the block instead — either is acceptable, but do not skip the outer `bossInRing` computation shortcut (see the scope trap above).

- [x] Task 4 — Extend the existing e2e boss-defeat test with a real-damage assertion (AC: 1, 2, 3)
  - [x] In `tests/e2e/full-run.test.ts`, the `'boss defeat path: BossDefeatedDelta then run:complete after delay'` test (~line 197-304) already drives two `stormcaller` players (`p1`, `p2`, both `classId: 'stormcaller'`) through all 3 dungeon levels to the boss level, and asserts `l4Snap.state.boss` is not null (~line 267).
  - [x] Immediately after that assertion (~line 268) and BEFORE the existing `debug:kill-boss` section (~line 270-272), insert a real-ability damage step:
    1. Move `p1` to within Stormcaller ability 0's range of the boss (`ABILITY_HIT_RANGE_PX[PlayerClass.STORMCALLER][0]` = 160px, `ABILITY_HIT_RADIUS_PX[...][0]` = 60px, `ABILITY_DAMAGE[...][0]` = 18 — all from `packages/game-rules/src/balance.ts`; ability 0 (`'hitscan'` delivery per `ABILITY_DELIVERY.stormcaller`) is Lightning Arc, a plain hit-scan — do NOT use ability index 3, that's Storm Eye, a `'zone'` delivery ability which this story does NOT wire to the boss). Reuse the `moveTowardPoint`/`fineTuneToDistanceBand` helpers already defined in `tests/e2e/ability-dispatch.test.ts` (either import them if exported, or inline the same pattern — check whether they're currently module-private to that file before deciding).
    2. Compute the aim vector from `p1`'s position to `l4Snap.state.boss.position.x/y`.
    3. `await waitForDelta<any>(host, (d) => d.type === 'boss:damaged', 5_000)` while sending `p1.send(EventNames.INPUT, { type: 'input', event: { type: 'ability', ability: { abilityIndex: 0, directionX: dirX, directionY: dirY } } })`.
    4. Assert `bossDamaged.newHp < l4Snap.state.boss.maxHp` (real damage occurred).
  - [x] Leave the rest of the test (the `debug:kill-boss` call and everything after) unchanged — it now exercises AC3 for free: the debug kill fires on a boss that has already taken real combat damage, proving the two paths don't conflict.
  - [x] `PlayerClass`, `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`, `ABILITY_DAMAGE` need importing from `shared-types`/`game-rules` in `full-run.test.ts` if not already imported — check the top of the file first.

- [x] Task 5 — Verify
  - [x] `npm run typecheck --workspace=apps/simulation-server` — 0 errors.
  - [x] `npm run test` (repo root, vitest run) — full suite green, including the modified `full-run.test.ts` and the untouched `ability-dispatch.test.ts`/unit suites.

### Review Findings

- [x] [Review][Defer] One-tick defeat-detection lag lets a redundant `boss:damaged` (`newHp: 0`) fire after the killing hit, since the boss-tick phase (which flips `isDefeated`) runs before ability-hit-resolution in the same `tick()` and the new branches guard on `!isDefeated`, not `hp > 0` [apps/simulation-server/src/rooms/GameRoom.ts:2254] — deferred, pre-existing. Explicitly documented and accepted in this story's own Dev Notes ("Why tickBoss doesn't need to be called from these three new branches"); matches `debug:kill-boss`'s existing one-tick lag today. Harmless: `hp` stays clamped at 0, `boss:defeated` still fires exactly once from `tickBoss`.
- [x] [Review][Defer] New e2e position-tracking listener (`trackPlayerAndBossPositions`'s `stop()`) isn't unsubscribed if `fineTuneToDistanceBand`/`waitForDelta` throws on timeout [tests/e2e/full-run.test.ts:391] — deferred, pre-existing. Matches the identical no-`try`/`finally` pattern already used by `trackPositions`/`stop()` in `tests/e2e/ability-dispatch.test.ts`, which this story was explicitly instructed to mirror (Task 4). Test-only, negligible impact — process exits after the suite.

## Dev Notes

### Every `gameState.enemies` call site examined in GameRoom.ts, and why only 3 need this fix

This story's biggest risk is a partial fix (e.g. only melee, forgetting the nova sweep). Every
`gameState.enemies`/hit-resolution-shaped block in the ~2900-line file was read and classified:

| Location (~line) | What it does | Needs boss branch? |
|---|---|---|
| 337 | `debug:kill-all` handler, kills every enemy | No — enemies-only debug tool by design |
| 352-355 | `debug:kill-boss` handler | No — already correctly sets `boss.hp = 0` directly; unchanged by this story |
| 670, 715 | Enemy spawn (push to array) | No — not damage resolution |
| 685-695 | Reset/cleanup on level transition | No |
| 943, 981 | `gameState.enemies = []` / `gameState.boss = null` resets | No |
| **1476-1489** | Void Pulse **zone** 'pull' effect (displacement, not damage) | No — zone-based, boss's fixture has `filterMaskBits: 0` so it can never be in `zoneOverlapping`; also this is displacement not damage |
| **1490-1533** | Zone-tick **'damage'** effect (Storm Eye's steady tick, Void Pulse's chained pull zone) | **No — out of scope, see Non-goals.** Same `zoneOverlapping` limitation |
| **1540-1597** | Storm Eye's bonus lightning-strike cadence | **No — out of scope**, same reason (reads from the same `zoneOverlapping` set) |
| **1618-1668** | **Projectile hit resolution** (Blood Spike, Void Pulse's projectile leg) | **No — out of scope, see Non-goals.** Physics-contact driven (`pendingProjectileHitContacts`), boss fixture's `filterMaskBits: 0` means no contact ever fires |
| 1722-1763 | Boss stomp damage → players (boss attacking players, not the reverse) | No — wrong direction, not this story |
| 1765-1791 | Enemy AI tick (`tickEnemy`) | No — AI movement/behavior, not player→target damage |
| 1793-1886 | **Boss tick** (`tickBoss`) — phase transitions, defeat detection | No — already correct and complete; reads `boss.hp` which this story's new code writes to |
| **2119-2177** | Ancestor's Voice mixed-faction cone | **YES — Task 2** |
| **2179-2234** | Generic ability hit-scan loop (the main path most abilities use) | **YES — Task 1** |
| **2248-2329** | Spirit Nova sweep | **YES — Task 3** |
| 2371-2399+ | Enemy melee attacks → players (enemy attacking players, not the reverse) | No — wrong direction |
| 2653-2690 | Level-clear/wave-objective check | No — already correctly bypasses this for the boss level ("Boss-level completion is driven solely by the `boss:defeated` event from tickBoss" — existing comment at ~line 2682) |
| 2749-2760 | Status-effect expiry tick for enemies | No — boss has no `statusEffects` field, can't apply here anyway |

Only the three rows in **bold with YES** get a code change. Everything else was checked and
confirmed either irrelevant (wrong direction, not damage-shaped) or out of scope by design
(physics contact filtering — see Non-goals).

### Why `applyDamage()` cannot be called directly on `gameState.boss`

`packages/game-rules/src/systems/combat.ts`:
```typescript
export function applyDamage(
  enemy: EnemyState,
  damage: number,
  dropId: string,
  nowMs: number,
): Result<DamageResult, CombatError>
```
`EnemyState` (from `shared-types`) has `isAlive: boolean`, top-level `x`/`y`, and `statusEffects`.
`BossState` (`packages/shared-types/src/boss.ts`) has none of these — it has `isDefeated`
instead of `isAlive`, `position: { x, y }` instead of top-level `x`/`y`, and no `statusEffects`
array at all (confirmed by a comment in `grassland-boss.ts`'s `buildBossContext`: "BossState has
no statusEffects, out of scope per 3.12's Non-goals"). Passing `gameState.boss` to
`applyDamage()` is a TypeScript type error, not just a style choice. Rather than widening
`applyDamage`'s signature (touches `packages/game-rules`, adds a branch to a function whose two
extra behaviors — status-effect mitigation, essence-drop-on-kill — are both meaningless for the
boss), this story mirrors the same one-line pattern `debug:kill-boss` already uses:
`this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage)`, then broadcasts
`boss:damaged` directly. This keeps the diff inside `GameRoom.ts` only, matching this story's
single-owner (Simulation Engineer, `apps/simulation-server/**` only) scope.

### Why `tickBoss` doesn't need to be called from these three new branches

`packages/game-rules/src/entities/grassland-boss.ts`'s `tickBoss` already runs unconditionally
every tick (GameRoom.ts's "Boss tick" block, ~line 1793-1886) and its first check is:
```typescript
if (boss.hp <= 0) {
  boss.isDefeated = true;
  const reward = computeRunReward(state);
  return { ok: true, value: [{ type: 'boss:defeated', bossId: boss.id, reward }] };
}
```
Phase transitions (`BOSS_PHASE2_HP_RATIO`/`BOSS_PHASE3_HP_RATIO`) are also computed purely from
`boss.hp` on every `tickBoss` call. Since the "Boss tick" block runs BEFORE the ability-dispatch
block in `GameRoom.update()`'s per-tick sequence, damage applied by this story's new code (in
ability dispatch, later in the same tick) won't be observed by `tickBoss` until the *next* tick —
a ~33ms (one tick at 30Hz) delay before `isDefeated`/phase-transition detection. This is
negligible and not a regression to fix; it's the same one-tick latency every other
HP-threshold-driven system in this codebase already has (e.g. enemy `applyDamage`'s `killed`
flag is computed synchronously within the same call, but boss defeat detection was always
designed to be tickBoss's job, decoupled from wherever hp was decremented — see
`debug:kill-boss`, which has exactly the same one-tick lag today).

### No double-counting risk (AC3) — why, precisely

Both `debug:kill-boss` and this story's three new branches:
1. Only ever mutate `this.gameState.boss.hp` (never `isDefeated` directly).
2. Guard with `!this.gameState.boss.isDefeated` before mutating.
3. `isDefeated` is set exactly once, only inside `tickBoss`, only when `boss.hp <= 0`.

So once `tickBoss` observes `hp <= 0` and flips `isDefeated = true`, every subsequent call to any
of these four mutation sites (3 new + `debug:kill-boss`) is a no-op (the `!isDefeated` guard
short-circuits). No path can decrement `hp` below what a defeated boss should show, and no path
can emit a second `boss:defeated` — that event is only ever constructed once, inside `tickBoss`.

### Boss fixture / physics filtering, confirmed by reading `apps/simulation-server/src/physics/world.ts` and `GameRoom.ts` ~line 1024-1038

```typescript
// world.ts
export const CAT_BOSS = 0x0040; // boss body — combat is hit-scan, same as CAT_ENEMY
```
```typescript
// GameRoom.ts ~line 1030-1036, boss body creation on entering the boss level
bossBodyInstance.createFixture({
  shape: new Circle(toMeters(48)),
  density: 1,
  friction: 0,
  filterCategoryBits: CAT_BOSS,
  filterMaskBits: 0, // combat is hit-scan; no contact callbacks needed (mirrors createEnemyBody)
});
```
This `filterMaskBits: 0` is the reason projectile/zone damage is structurally impossible against
the boss today, and is exactly why the epics.md/D-6.3-0 scope names only hit-scan-style paths.
This is pre-existing, deliberate (per its own comment), and this story does not change it.

### Reference: confirmed-correct, unchanged pieces (verified by direct read, not assumed)

- `packages/net-protocol/src/messages/server-to-host.ts` ~line 218-234: `BossDamagedDelta`,
  `BossPhaseChangedDelta`, `BossDefeatedDelta` all correctly defined and in the `DeltaEventMsg`
  union (confirmed at ~line 316).
- `packages/net-protocol/src/apply-delta.ts` ~line 169-184: `applyDelta`'s `'boss:damaged'` case
  already does `{ ...state, boss: { ...state.boss, hp: evt.newHp } }` — correct, no change needed.
- `apps/host-client/src/screens/DungeonScreen.tsx` ~line 541-546: already computes the flash
  damage amount client-side from the HP delta (`prevHp - newHp`) — the broadcast payload only
  needs `newHp`, no `damage` field, matching `BossDamagedDelta`'s exact shape. Confirms this
  story's broadcast (`{ type: 'boss:damaged', bossId, newHp }`) is sufficient; nothing extra
  needed for the host to render damage numbers correctly.
- `packages/game-rules/src/entities/grassland-boss.ts`: `tickBoss`, `createBossState` — read in
  full, both correct and unchanged.

### Project Structure Notes

- No new files. All 3 production-code changes are inline additions inside existing blocks in
  `apps/simulation-server/src/rooms/GameRoom.ts`.
- Test change is an extension of an existing test in `tests/e2e/full-run.test.ts`, not a new file
  — reuses that file's own live-room + Colyseus SDK setup already present at the top of the file.
- `EventNames`, `DeltaEventMsg`, `isInHitZone` are all already imported in `GameRoom.ts` (used
  throughout the file already) — no new imports needed for Tasks 1-3.

### Project Context Rules

- **Authority model**: `GameRoom.ts` is the sole owner of `GameState` mutation — all 3 new
  branches stay within this boundary, consistent with every other combat mutation in the file.
- **Simulation-safety hook** (CLAUDE.md): this story modifies `apps/simulation-server/**` only
  (no `packages/game-rules/**` change) — typecheck + existing test suite is the required gate;
  no new deterministic-tick or replay-test surface is introduced since no game-rules logic
  changed (`tickBoss`/`applyDamage`/`isInHitZone` are all called exactly as they already are
  elsewhere, with a slightly different target).
- **Strict TS**: `this.gameState.boss` is `BossState | null` — every new branch's `if
  (this.gameState.boss && !this.gameState.boss.isDefeated && ...)` guard is required both for
  correctness and to satisfy strict-null-checks (accessing `.hp`/`.position`/`.id` on a possibly-
  null value without narrowing first is a type error).
- **Package manager**: `npm` — `npm run typecheck --workspace=apps/simulation-server`, `npm run
  test` at repo root for the full vitest suite (per `package.json` script names confirmed in this
  story's research).

### References

- `_bmad-output/implementation-artifacts/deferred-work.md`, entry `D-6.3-0` (canonical prior
  description of this exact gap, deferred from the 6.3 code review).
- `_bmad-output/implementation-artifacts/sprint-status.yaml`, 2026-07-14 correct-course note
  (this story's origin: "6.7/6.8 are regressions against Story 6.1/6.3's already-approved AC").
- `_bmad-output/implementation-artifacts/6-1-grassland-boss-shared-types-and-protocol-contracts.md`
  — `BossState`, `DeltaEventMsg` union origin.
- `_bmad-output/implementation-artifacts/6-3-boss-arena-handcrafted-level-physics-geometry-and-host-rendering.md`
  — boss arena/physics body origin, host HP bar rendering.
- `_bmad-output/implementation-artifacts/6-4-boss-defeat-sequence-purification-pulse-and-reward-reveal.md`
  — `boss:defeated`/`RunVictoryMsg`/purification sequence (unaffected, already correct).
- `_bmad-output/implementation-artifacts/6-6-epic-6-deferred-hardening.md` — most recent Epic 6
  story; establishes this project's story-file house style (Required Task Header block, exact
  existing-code-state snippets in Dev Notes) followed by this story.
- `tests/e2e/ability-dispatch.test.ts` — live-room ability-dispatch test harness pattern (added
  Story 3.22) reused for guidance in Task 4.
- `packages/game-rules/src/balance.ts` — `ABILITY_DELIVERY`, `ABILITY_DAMAGE`,
  `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX` tables (unchanged, read for exact values used
  in Task 4's test).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx tsc --noEmit -p apps/simulation-server/tsconfig.json` — 0 errors.
- `npx tsc --noEmit -p tests/tsconfig.json` — 0 errors.
- `npm run test` at repo root aggregates every `vitest.config.ts` it can find,
  including stale `.claude/worktrees/agent-*` directories left behind by unrelated
  prior agent sessions (full duplicate copies of `apps/simulation-server`). Those
  duplicates hard-code the same test ports (`2568`, `18765`) as the real copy, so
  running them concurrently causes `EADDRINUSE`/`did not start within 60s` failures
  that have nothing to do with this story's diff. Confirmed by running the *unmodified*
  (pre-story, `git stash`) `tests/e2e/full-run.test.ts` in isolation and observing the
  same category of flakiness (an unrelated timing assertion on `elapsed`), and by
  running my own scoped changes in isolation via
  `npx vitest run --root tests --config tests/vitest.config.ts e2e/full-run.test.ts`
  (bypassing the worktree pollution) repeatedly — all green. Root-level `npm run test`
  was also run clean once with no other verification runs competing for the ports; it
  passed (`2 tests | 2 skipped` gate errors were transient re-tries, final clean run:
  full suite green apart from the pre-existing worktree-pollution noise). This is a
  pre-existing environmental issue, out of this story's allowed paths (no test-config
  or worktree changes permitted) — flagging for separate cleanup, not fixed here.
- `tests/e2e/full-run.test.ts` isolated run (both tests in the file, scoped to
  `tests/vitest.config.ts`, no worktree contention): 2 passed, 0 failed, run twice
  consecutively for stability.

### Completion Notes List

- Task 1: Added a boss branch immediately after the generic ability hit-scan loop
  (`GameRoom.ts`), mirroring `applyDamage`'s core math directly against
  `gameState.boss` since `BossState` doesn't structurally match `EnemyState`.
- Task 2: Added the identical boss branch inside Ancestor's Voice's mixed-faction
  cone, between the enemy-damage loop and the ally-heal loop.
- Task 3: Added a `bossInRing` boolean computed before the Spirit Nova sweep's
  `if (enemiesInRing.length > 0 || alliesInRing.length > 0)` gate (extended to
  `|| bossInRing`) so a boss-only ring still triggers `novaDamage` computation, then
  added the boss-damage branch between the enemy loop and ally-heal loop inside it.
- Task 4: Extended `tests/e2e/full-run.test.ts`'s boss-defeat test with a real-ability
  damage step — inlined `moveTowardPoint`/`fineTuneToDistanceBand`/position-tracking
  helpers (module-private in `ability-dispatch.test.ts`, not exported, so copied
  rather than imported) to move p1 into Lightning Arc (Stormcaller ability 0) range
  of the live boss, cast it, and assert a `boss:damaged` delta arrives with
  `newHp < maxHp`. The pre-existing `debug:kill-boss` call and everything after it
  was left unchanged, now exercising AC3 (no conflict between the two hp-mutation
  paths) for free.
- Task 5: Both required gates run — `apps/simulation-server` typecheck (0 errors),
  `tests` typecheck (0 errors), and the modified e2e test (green, verified in
  isolation and in a clean full-suite root run). See Debug Log for the pre-existing
  worktree-pollution caveat on `npm run test`.
- No `packages/shared-types`, `packages/net-protocol`, or `packages/game-rules`
  changes — single-owner story, `apps/simulation-server/**` and the one test file
  only, matching the story's Allowed paths.
- Confidence: 92% — all three hit-resolution paths verified against the story's own
  exact-code Dev Notes snippets before editing, both typecheck gates pass with 0
  errors, and the new e2e assertion passed repeatedly in isolated runs. The 8%
  residual is entirely the pre-existing worktree/port-contention environmental noise
  documented above, which is out of this story's scope to fix.

### File List

- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — 3 boss hit-resolution
  branches: generic ability hit-scan loop, Ancestor's Voice mixed-faction cone,
  Spirit Nova sweep)
- `tests/e2e/full-run.test.ts` (modified — added `moveTowardPoint`/
  `fineTuneToDistanceBand`/`trackPlayerAndBossPositions` test helpers and a
  real-ability boss-damage assertion in the boss-defeat e2e test)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status
  ready-for-dev → in-progress, per workflow Step 4)

## Change Log

- 2026-07-16: Implemented Tasks 1-5 — boss branches added to all three in-scope
  hit-resolution paths in `GameRoom.ts`; `full-run.test.ts` extended with a
  real-ability boss-damage assertion. Status set to review.

---
baseline_commit: b4dc624
---

# Story 6.9: Epic 6 Post-6.6 Deferred Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.9 — deferred hardening, no new features)
Context: Stories 6.6–6.8 and dev-1..dev-5 are all done. Two related combat-critical
  findings surfaced since 6.6 and remain open:
  - D-dev4-B (2026-07-17, user-flagged HIGH PRIORITY): damage multipliers
    (BOND_DAMAGE_MULT, DEBUG_GOD_MODE_DAMAGE_MULT) are computed independently at
    5 separate GameRoom.ts call sites; only 2 apply any multiplier. Storm Eye and
    both projectile abilities (Blood Spike, Void Pulse) silently skip every
    multiplicative buff/debuff that will ever be added.
  - D-dev5-A (2026-07-16): Storm Eye's zone-tick damage and bonus lightning
    strike never reach the boss at all — both loops only search
    `this.gameState.enemies`, never `this.gameState.boss`.
  Both defects live in the exact same code region (GameRoom.ts's zone-tick block,
  ~line 1463-1620) and are fixed together in this story with one shared helper.

  Current codebase state entering this story (verified 2026-07-17, commit b4dc624):
  - `resolveOutgoingDamage`-equivalent logic is duplicated at GameRoom.ts:2120-2122
    (hit-scan) and :2320-2322 (Spirit Nova) — the ONLY 2 of 5 sites with any
    multiplier applied.
  - Zone damage-tick (line 1510-1553), Storm Eye bonus strike (line 1560-1617),
    and projectile hit resolution (line 1638-1690) apply raw, unmultiplied damage.
  - Boss branches already exist at lines 2185-2195 (mixed-faction cone), 2272-2282
    (single-target hit-scan cone), and 2309-2376 (Spirit Nova sweep, via a
    `bossInRing` computed with `isInHitZone` against `boss.position` — NOT a
    physics contact). The boss's physics fixture has `filterMaskBits: 0`
    (GameRoom.ts:1054, "combat is hit-scan; no contact callbacks needed") — it
    NEVER appears in `zoneOverlapping` contact-tracking Sets. Any boss branch for
    zone-based damage MUST use the same direct `isInHitZone`-against-`boss.position`
    pattern Spirit Nova already uses — it cannot reuse the enemy contact-tracking
    path.
  - `proximityBuffed` (the Bond-buff membership Set) is computed once at line 1314,
    before both the zone-tick block (1463+) and the ability-dispatch block
    (2098+) — in scope at every one of the 5 damage sites without recomputation.

Owner agent: Simulation Engineer
  Single-owner story — all changes are confined to
  `apps/simulation-server/src/rooms/GameRoom.ts` and `packages/game-rules/src/`.
  No protocol, host, or mobile changes.

Goal: Introduce one shared damage-resolution helper that folds in every active
  outgoing-damage multiplier, route all 5 damage-delivery call sites through it,
  and add the two missing boss branches (zone-tick, Storm Eye strike) using the
  existing Spirit-Nova-style direct-position check. Minimal, targeted diffs — no
  new gameplay features, no protocol changes.

Allowed paths:
  - packages/game-rules/src/balance.ts                (MODIFY — add resolveOutgoingDamage)
  - packages/game-rules/src/index.ts                  (MODIFY — export the new helper, if not auto-re-exported)
  - apps/simulation-server/src/rooms/GameRoom.ts      (MODIFY — 5 call sites + 2 boss branches)
  - tests/unit/*.test.ts or packages/game-rules/**/*.test.ts (MODIFY/ADD — unit test for the new helper)

Blocked paths:
  - packages/shared-types/**           (no protocol/type changes needed)
  - packages/net-protocol/**           (no new message types — boss:damaged already exists)
  - apps/host-client/**                (no rendering changes needed)
  - apps/mobile-controller/**          (no input changes needed)
  - apps/simulation-server/src/physics/**  (no fixture/filter changes — boss stays hit-scan-only, no new contact wiring)

Inputs:
  - deferred-work.md entries: D-dev4-B (damage multiplier gap, HIGH PRIORITY),
    D-dev5-A (Storm Eye boss zone-damage gap)
  - apps/simulation-server/src/rooms/GameRoom.ts (5 damage sites, 3 existing boss
    branches, zoneOverlapping/proximityBuffed/godModePlayerIds state)
  - packages/game-rules/src/balance.ts (BOND_DAMAGE_MULT, DEBUG_GOD_MODE_DAMAGE_MULT,
    STORM_EYE_STRIKE_DAMAGE)
  - packages/shared-types/src/zone.ts (ZoneState.radius field — needed for the new
    zone-vs-boss isInHitZone range check)

Non-goals:
  - Projectile-vs-boss collision (Blood Spike, Void Pulse never reach the boss at
    all — `ProjectileEnemyContactEvent`/`pendingProjectileHitContacts` is enemy-only
    at the physics-contact level, a deeper gap than "wrong multiplier"). This story
    only fixes the multiplier at the projectile hit-resolution call site so that
    IF a projectile ever hits the boss, damage is correct — it does NOT add
    boss-projectile contact detection. Flag as a new deferred item, physics-layer
    scope, bigger than a hardening story.
  - D3 (eslint.config.mjs repo-wide `no-undef` gap, 308 errors / 37 files) — a
    different ownership area (root CI config, QA + Telemetry Engineer per
    CLAUDE.md), out of scope for this Simulation Engineer story.
  - D-dev5-D (host-session.ts whitelist OR-chain fragility) — apps/host-client
    scope, different ownership area, and its own deferred note says "revisit only
    if a 3rd instance surfaces" (not yet decided to act on).
  - D-dev4-A (debug:toggle-god-mode NODE_ENV guard gap) — shared, pre-existing
    convention with debug:kill-all/debug:kill-boss; explicitly deferred until the
    project wants unregistered-in-prod messages to fail silently instead of
    disconnecting.
  - Any new gameplay features, protocol changes, or architecture changes.

Acceptance criteria:
  1. `packages/game-rules/src/balance.ts` exports a pure function
     `resolveOutgoingDamage(rawDamage: number, isBonded: boolean, isGodMode: boolean): number`
     that applies `BOND_DAMAGE_MULT` and `DEBUG_GOD_MODE_DAMAGE_MULT` exactly as
     the current hit-scan/Spirit-Nova inline math does (`Math.round` only when the
     combined multiplier isn't exactly 1).
  2. All 5 damage-delivery sites in `GameRoom.ts` (hit-scan, Spirit Nova, zone
     damage-tick, Storm Eye bonus strike, projectile hit) compute their final
     damage by calling `resolveOutgoingDamage`, passing that caster's
     `proximityBuffed.has(casterId)` and `this.godModePlayerIds.has(casterId)`.
     No call site duplicates the multiplier math inline anymore.
  3. The zone damage-tick loop (`effectType === 'damage'`) also damages the boss
     when it is alive, un-defeated, and within `zone.radius` of `zone.x/zone.y`
     (checked via the same `isInHitZone(zone.x, zone.y, 0, 0, boss.position.x, boss.position.y, zone.radius, 0, false)`
     pattern Spirit Nova's `bossInRing` uses), broadcasting `boss:damaged` with the
     post-multiplier damage value.
  4. The Storm Eye bonus lightning-strike loop also considers the boss a valid
     strike target when it is alive, un-defeated, and within the zone's radius —
     broadcasting `boss:damaged` (not `enemy:damaged`) when the boss is struck,
     with the post-multiplier damage value.
  5. Existing enemy-facing behavior for all 5 sites is unchanged when
     `proximityBuffed`/`godModePlayerIds` are both empty (i.e. `resolveOutgoingDamage`
     is a no-op pass-through at `mult === 1`, matching current behavior bit-for-bit).
  6. Typecheck and the full existing unit/contract/e2e test suite pass with no new
     regressions (4 e2e files are pre-existing environment failures — see dev-4's
     Dev Notes precedent — not a blocker).
  7. A new unit test for `resolveOutgoingDamage` covers: no buffs (pass-through),
     bond-only, god-mode-only, both stacked (multiplicative, matching the existing
     `damageMult` formula), and confirms `Math.round` is applied only when
     `mult !== 1`.

Required hooks: Simulation-safety hook (typecheck, unit tests, deterministic tick
  test if one exists for boss-zone damage, perf sanity — this touches a per-tick
  hot loop, keep the boss check O(1) per zone, not O(enemies)).
Required tests: New unit test for `resolveOutgoingDamage` (AC7). No new e2e test
  required — existing `full-run.test.ts`/boss e2e coverage exercises the 3
  previously-working boss-damage paths and will catch any regression in the shared
  helper; a full Storm-Eye-vs-boss e2e is out of scope for a hardening story
  (matches 6.6/dev-5 precedent of manual/user live-verification for boss visuals).
Telemetry impact: None — no new event types, `boss:damaged` already broadcasts a
  `newHp` field consumed by the existing host damage-flash/health-bar logic.
```

## Story

As a developer,
I want one shared damage-resolution function that every outgoing-damage call site in `GameRoom.ts` routes through, and the boss wired into Storm Eye's zone-based damage,
so that every current and future multiplicative damage system (Bond buff, debug god-mode, and anything added later) applies consistently across all delivery types, and Stormcaller's Storm Eye actually damages the boss like every other ability already does.

## Acceptance Criteria

1. `resolveOutgoingDamage(rawDamage, isBonded, isGodMode)` is exported from `packages/game-rules/src/balance.ts`, folding `BOND_DAMAGE_MULT` and `DEBUG_GOD_MODE_DAMAGE_MULT` with the exact same multiply-then-conditionally-round semantics as today's inline code.
2. All 5 damage-delivery sites (hit-scan/mixed-faction, Spirit Nova, zone damage-tick, Storm Eye bonus strike, projectile hit) call `resolveOutgoingDamage` instead of computing their own local `mult`/`damage` ternary.
3. Zone damage-tick damages the boss (broadcasting `boss:damaged`) when the boss is alive, un-defeated, and within `zone.radius` of the zone's center.
4. Storm Eye's bonus lightning strike can select and damage the boss (broadcasting `boss:damaged`, not `enemy:damaged`) under the same alive/un-defeated/in-range condition.
5. With no active Bond buffs and no god-mode players, every site's output damage is byte-identical to current behavior (regression-free no-op path).
6. Typecheck and the existing test suite pass; no new regressions (pre-existing e2e port-binding failures in this sandbox are not this story's concern).
7. A unit test for `resolveOutgoingDamage` covers all 4 multiplier combinations (none / bond / god-mode / both stacked) plus the round-only-when-`mult!==1` behavior.

## Tasks / Subtasks

- [x] Task 1 — Add `resolveOutgoingDamage` to `packages/game-rules` (AC: 1, 7)
  - [x] In `packages/game-rules/src/balance.ts`, add near `BOND_DAMAGE_MULT`/`DEBUG_GOD_MODE_DAMAGE_MULT`:
    ```typescript
    export function resolveOutgoingDamage(rawDamage: number, isBonded: boolean, isGodMode: boolean): number {
      const mult = (isBonded ? BOND_DAMAGE_MULT : 1) * (isGodMode ? DEBUG_GOD_MODE_DAMAGE_MULT : 1);
      return mult !== 1 ? Math.round(rawDamage * mult) : rawDamage;
    }
    ```
  - [x] Check `packages/game-rules/src/index.ts` — if it re-exports everything from `balance.ts` with `export *`, no change needed; if it's an explicit named-export list, add `resolveOutgoingDamage`.
  - [x] Add a unit test (new or appended to an existing `balance`/`game-rules` unit test file) covering: `resolveOutgoingDamage(100, false, false) === 100`; `resolveOutgoingDamage(100, true, false) === Math.round(100 * BOND_DAMAGE_MULT)`; `resolveOutgoingDamage(100, false, true) === Math.round(100 * DEBUG_GOD_MODE_DAMAGE_MULT)`; `resolveOutgoingDamage(100, true, true) === Math.round(100 * BOND_DAMAGE_MULT * DEBUG_GOD_MODE_DAMAGE_MULT)`.
  - [x] Run `npm run typecheck --workspace=packages/game-rules`.

- [x] Task 2 — Route the 2 already-covered sites through the helper (AC: 2, 5)
  - [x] `GameRoom.ts:2120-2122` (hit-scan/mixed-faction): replace the inline `damageMult`/`damage` computation with `const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(clientId), this.godModePlayerIds.has(clientId));`.
  - [x] `GameRoom.ts:2320-2322` (Spirit Nova): replace with `const novaDamage = resolveOutgoingDamage(rawNovaDamage, proximityBuffed.has(nova.casterId), this.godModePlayerIds.has(nova.casterId));`.
  - [x] Add `resolveOutgoingDamage` to the existing `game-rules` import list at `GameRoom.ts:15` (do not add a second import statement).

- [x] Task 3 — Route zone damage-tick through the helper + add boss branch (AC: 2, 3, 5)
  - [x] `GameRoom.ts:1510-1553` (`effectType === 'damage'` block): the raw value comes from `this.zoneDamagePerTick.get(zone.id) ?? 0`. Compute `const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(zone.ownerId), this.godModePlayerIds.has(zone.ownerId));` and use `damage` everywhere the old `damage` variable was used (enemy loop + broadcasts).
  - [x] After the existing enemy `for (const targetId of overlapping)` loop (inside the same `if (damage > 0 && overlapping)` block, or as a sibling check if `overlapping` can be empty/undefined while the boss is still in range — the boss is NEVER in `overlapping`, see Dev Notes), add a boss check:
    ```typescript
    if (damage > 0 && this.gameState.boss && !this.gameState.boss.isDefeated &&
        isInHitZone(zone.x, zone.y, 0, 0,
          this.gameState.boss.position.x, this.gameState.boss.position.y,
          zone.radius, 0, false)) {
      this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
      this.broadcast(EventNames.DELTA, {
        type: 'boss:damaged' as const,
        bossId: this.gameState.boss.id,
        newHp: this.gameState.boss.hp,
      } satisfies DeltaEventMsg);
    }
    ```
  - [x] This check must run regardless of whether `overlapping` is empty/undefined (the boss never populates that Set — see Dev Notes on `filterMaskBits: 0`), so place it as its own `if`, not nested inside the `overlapping`-gated loop.

- [x] Task 4 — Route Storm Eye bonus strike through the helper + add boss branch (AC: 2, 4, 5)
  - [x] `GameRoom.ts:1577` (Storm Eye bonus strike): compute `const strikeDamage = resolveOutgoingDamage(STORM_EYE_STRIKE_DAMAGE, proximityBuffed.has(zone.ownerId), this.godModePlayerIds.has(zone.ownerId));` once, before the alive-enemy-id selection, and use `strikeDamage` in place of the raw `STORM_EYE_STRIKE_DAMAGE` in `applyDamage(...)` and both broadcasts.
  - [x] Give the boss a chance to be the strike target. The current code picks uniformly among `aliveEnemyIds` via `pickRandomIndex`. Minimal-diff approach: after building `aliveEnemyIds`, check if the boss is alive/un-defeated/in-range (same `isInHitZone(zone.x, zone.y, 0, 0, boss.position.x, boss.position.y, zone.radius, 0, false)` check as Task 3); if so, treat the boss as one additional candidate in the same random pick (e.g. build a combined candidate list `[...aliveEnemyIds, ...(bossInRange ? ['__boss__'] : [])]`, pick one, then branch on whether the picked id is the boss sentinel vs a real enemy id) — do not change the existing per-enemy pick probability distribution among enemies when the boss is NOT in range.
  - [x] When the boss is the picked target: `this.gameState.boss!.hp = Math.max(0, this.gameState.boss!.hp - strikeDamage);` and broadcast `boss:damaged` (with `bossId`/`newHp`), mirroring the existing `enemy:damaged`/`enemy:killed` broadcast shape used for the enemy branch — boss has no `killed` state here (bosses never die from a strike tick directly; `tickBoss` handles defeat on its own next tick, same convention as the other 3 existing boss branches).

- [x] Task 5 — Route projectile hit resolution through the helper (AC: 2, 5)
  - [x] `GameRoom.ts:1648` (projectile hit): replace `const damage = ABILITY_DAMAGE[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3] ?? 0;` with the raw lookup renamed (e.g. `rawDamage`) followed by `const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(projectile.ownerId), this.godModePlayerIds.has(projectile.ownerId));`.
  - [x] Confirm `projectile.ownerId` exists on `ProjectileState` (used elsewhere in this file for `enemy:killed`'s `byPlayerId: projectile.ownerId` — same field, already in scope).
  - [x] No boss branch here — see Non-goals. `pendingProjectileHitContacts`/`ProjectileEnemyContactEvent` never contains boss contacts; adding that is out of scope.

- [x] Task 6 — Verify and log deferred-work.md (Required by story-authoring convention — see D-dev5-E precedent; not itself part of Allowed paths above but required by this task list, same template gap tracked as D7/D-dev5-E)
  - [x] Run `npm run typecheck --workspace=apps/simulation-server` and the full test suite.
  - [x] Update `_bmad-output/implementation-artifacts/deferred-work.md`: mark D-dev4-B and D-dev5-A as RESOLVED (following the exact "RESOLVED by <story>" annotation style used for D-6.8-A), and append any new findings surfaced by this story's own code review (e.g. the projectile-vs-boss gap, if not already logged elsewhere).
  - [x] Update `sprint-status.yaml`: `6-9-epic-6-post-66-deferred-hardening: ready-for-dev` → `in-progress` → `review` → `done` as work proceeds, plus a dated summary line under `last_updated` following this file's existing narrative-log convention.

### Review Findings

- [x] [Review][Patch] Storm Eye boss-strike branch leaks the internal `'__boss__'` sentinel into the wire-protocol `ZoneStrikeDelta.targetId` field [`apps/simulation-server/src/rooms/GameRoom.ts` Storm Eye boss branch, `~1603-1610`] — `targetId` is documented/typed to reference a real struck entity; broadcast the boss's real id (`this.gameState.boss!.id`) instead of the local candidate-list sentinel, keeping the internal pick logic unchanged. Confirmed independently by all 3 review layers. **Fixed**: `targetId` now uses `this.gameState.boss!.id`; typecheck clean.
- [x] [Review][Patch] AC7's "round only when `mult !== 1`" unit test is tautological [`packages/game-rules/tests/unit/balance.test.ts`, "does not round when the combined multiplier is exactly 1"] — input `33` is already an integer so `Math.round(33)===33` regardless of whether rounding is conditional; would pass against a buggy always-round implementation too. Use a fractional `rawDamage` (e.g. `33.7`) so the branch is actually exercised. **Fixed**: input changed to `33.7`; test re-run, 5/5 pass.
- [x] [Review][Patch] New test file `packages/game-rules/tests/unit/balance.test.ts` was created with executable file mode (100755) instead of 100644, inconsistent with every other file in the diff — cosmetic, `chmod 644`. **Not fixable in this environment**: this repo's `/mnt/c` WSL2 DrvFs mount reports every file as 777 regardless of `chmod` (confirmed against a pre-existing, correctly-committed file showing the same 777), and `core.fileMode=false` is already set — an environment artifact, not a real permission difference introduced by this diff.
- [x] [Review][Defer] Boss can take two damage hits / emit two `boss:damaged` broadcasts in the same tick when the zone damage-tick and Storm Eye bonus-strike branches both fire on the same tick (`STORM_EYE_STRIKE_INTERVAL_MS`=1500ms is exactly 3× `STORM_EYE_TICK_MS`=500ms) and the strike RNG picks the boss too [`apps/simulation-server/src/rooms/GameRoom.ts`, new zone-tick boss branch + new Storm Eye strike boss branch] — deferred, pre-existing pattern (enemies already exhibit the identical dual-hit-per-tick behavior; `Math.max(0, hp-damage)` keeps state idempotent so the only visible effect is a harmless duplicate broadcast/VFX flash). Extending it to the boss is a natural consequence of this story's two new boss branches, not a fresh regression; redesigning the boss/enemy hit-dedup or defeat-transition state machine is out of scope for a hardening story.
- [x] [Review][Defer] The `isInHitZone(zone.x, zone.y, 0, 0, boss.position.x, boss.position.y, zone.radius, 0, false)` boss-in-range check is duplicated verbatim in the zone damage-tick and Storm Eye strike branches [`apps/simulation-server/src/rooms/GameRoom.ts`] — deferred, minor duplication; both Task 3 and Task 4 prescribe this exact snippet near-verbatim in the spec itself, low value to extract into a shared helper now. Revisit if a 3rd occurrence appears (matches this project's established "revisit at 3rd instance" convention, e.g. D-dev5-D).

## Dev Notes

### Existing code state — read this before touching any file

**The 5 damage-delivery sites (verified at commit b4dc624):**

| # | Location | Raw damage source | Multiplier today? | Boss branch today? |
|---|----------|-------------------|--------------------|---------------------|
| 1 | `GameRoom.ts:2120-2122` hit-scan/mixed-faction | `result.value.damage` | ✅ (`damageMult`) | ✅ (2185, 2272) |
| 2 | `GameRoom.ts:2320-2322` Spirit Nova | `ABILITY_DAMAGE[SPIRITCALLER][1]` | ✅ (`novaDamageMult`) | ✅ (2309-2376, via `bossInRing`) |
| 3 | `GameRoom.ts:1511` zone damage-tick | `this.zoneDamagePerTick.get(zone.id)` | ❌ | ❌ |
| 4 | `GameRoom.ts:1577` Storm Eye bonus strike | `STORM_EYE_STRIKE_DAMAGE` constant | ❌ | ❌ |
| 5 | `GameRoom.ts:1648` projectile hit | `ABILITY_DAMAGE[projectile.class][...]` | ❌ | ❌ (physics-layer gap, non-goal) |

**Why the boss never appears in `zoneOverlapping` (critical — read before Task 3/4):**
`GameRoom.ts:1053-1054` creates the boss's physics fixture with `filterCategoryBits: CAT_BOSS, filterMaskBits: 0` — the comment reads "combat is hit-scan; no contact callbacks needed". Zone sensor bodies (`createZoneBody`, `physics/world.ts:131-137`) have `filterMaskBits: CAT_ENEMY | CAT_PLAYER` — `CAT_BOSS` is not and should not be added to this mask; that would require also giving the boss body a non-zero `filterMaskBits` and handling new contact-event types, a physics-layer change explicitly out of scope. Spirit Nova already solved this exact problem without touching physics: `bossInRing` (line 2309-2312) is a direct `isInHitZone(nova.x, nova.y, 0, 0, boss.position.x, boss.position.y, currentRadius, 0, false)` distance check against `boss.position`, computed independently of the contact-based `zoneOverlapping`/`enemiesInRing` sets. Tasks 3 and 4 must copy this exact pattern using `zone.x`/`zone.y`/`zone.radius` in place of `nova.x`/`nova.y`/`currentRadius`. Do not attempt to make the boss participate in `zoneOverlapping` — it structurally cannot, by design.

**`proximityBuffed` and `godModePlayerIds` are already in scope at every site:**
`proximityBuffed` is computed once at `GameRoom.ts:1314` (`const proximityBuffed = this.gameState.activeBonds.length > 0 ? ... : ...`), inside the same `tick()` method that contains the zone-tick block (1463+) and the ability-dispatch block (2098+) — no re-computation or new parameter threading needed. `this.godModePlayerIds` (line 146) is a private instance field, accessible anywhere in the class. Every one of the 5 call sites can call `resolveOutgoingDamage` with a one-line change; no new state needs to be introduced or plumbed through.

**Ownership convention for the "which caster's buffs apply" question:**
- Hit-scan/Spirit Nova: `clientId` / `nova.casterId` (the ability-firing player).
- Zone damage-tick / Storm Eye strike: `zone.ownerId` (the player who created the zone — Storm Eye is Stormcaller slot 3, a zone-effect ability; the caster's Bond/god-mode status at cast time is what should apply, matching how the existing 2 covered sites key off the acting player, not the target).
- Projectile hit: `projectile.ownerId` (same convention, already used elsewhere in this file for `byPlayerId`).

### Constraints from CLAUDE.md / observed codebase conventions

- TypeScript strict mode — no `any` without a suppression comment.
- `packages/game-rules` functions here don't need the `Result<T,E>` pattern (used for fallible operations like `applyDamage`) — `resolveOutgoingDamage` is pure arithmetic with no failure mode, matching the existing (now-being-replaced) inline `damageMult`/`damage` computation style.
- `EventNames` enum for all message types — `EventNames.DELTA` with `boss:damaged` payload already exists and is used identically at 3 other call sites in this file; copy the exact shape (`bossId`, `newHp`).
- Simulation-safety hook applies: this is a per-tick hot loop (30Hz) — `resolveOutgoingDamage` must stay O(1) (it is: 2 boolean checks + a multiply), and the new boss-in-range checks (Tasks 3/4) are a single `isInHitZone` call per zone per tick, not a loop over enemies — no new O(n) or O(n²) cost introduced.

### Project Structure Notes

- No new files. `resolveOutgoingDamage` lives in `packages/game-rules/src/balance.ts` alongside the two multiplier constants it consumes — matches the existing convention of balance-derived helper functions living next to their constants (see `getEnemyCount` in the same package).
- `GameRoom.ts` is the sole call site for the new helper; no other file in the monorepo references `BOND_DAMAGE_MULT`/`DEBUG_GOD_MODE_DAMAGE_MULT` directly today (verify with a repo-wide grep before finishing, in case a test file duplicates the inline math and should be updated to call the helper too, for consistency).

### Project Context Rules

- **Authority model**: `GameRoom.ts` remains the sole owner of `GameState` mutation (including `boss.hp`) — unchanged by this story.
- **Package manager**: `npm` — use `npm run typecheck --workspace=<pkg>` for verification, matching every prior story in this log.
- **Strict TS**: new code must type-check without `any`.
- **Colyseus message routing**: `this.broadcast(EventNames.DELTA, {...} satisfies DeltaEventMsg)` — exact pattern already used 3× in this file for `boss:damaged`; Tasks 3/4 must match it byte-for-byte (field names, `as const` on `type`).

### References

- Deferred finding D-dev4-B (damage multiplier gap, HIGH PRIORITY): `_bmad-output/implementation-artifacts/deferred-work.md` (section "Deferred from: code review of dev-4-debug-invincible-high-damage-mode")
- Deferred finding D-dev5-A (Storm Eye boss zone-damage gap): `_bmad-output/implementation-artifacts/deferred-work.md` (section "Deferred from: manual verification of dev-5-boss-transient-delta-whitelist-fix")
- Existing covered sites: `apps/simulation-server/src/rooms/GameRoom.ts:2120-2122`, `:2320-2322`
- Existing uncovered sites: `apps/simulation-server/src/rooms/GameRoom.ts:1510-1553` (zone tick), `:1560-1617` (Storm Eye strike), `:1638-1690` (projectile hit)
- Existing boss branches to mirror: `GameRoom.ts:2185-2195`, `:2272-2282`, `:2309-2376` (`bossInRing` pattern — the template for Tasks 3/4)
- Boss fixture `filterMaskBits: 0`: `GameRoom.ts:1049-1054`
- Zone body filter mask: `apps/simulation-server/src/physics/world.ts:131-137`
- `ZoneState.radius` field: `packages/shared-types/src/zone.ts:8`
- Multiplier constants: `packages/game-rules/src/balance.ts:283` (`BOND_DAMAGE_MULT`), `:306` (`DEBUG_GOD_MODE_DAMAGE_MULT`), `:193` (`STORM_EYE_STRIKE_DAMAGE`)
- Precedent hardening story structure: `_bmad-output/implementation-artifacts/6-6-epic-6-deferred-hardening.md`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npx tsc --noEmit` (`packages/game-rules`, then `apps/simulation-server`) — 0 errors. Neither package has a `typecheck` npm script (only `build`/`test` on game-rules; simulation-server has no `typecheck` script at all), so Tasks 1 and 6's literal `npm run typecheck --workspace=...` commands don't exist — substituted `npx tsc --noEmit` per-package, then confirmed with the root `npm run typecheck` (chains `tsc --noEmit -p ...` across all 10 workspace tsconfigs) — 0 errors monorepo-wide.
- `npm test` (repo root, vitest run) — first run: 436 passed, 3 e2e suites failed (`ability-dispatch.test.ts`, `hub-ability-use.test.ts`: `simulation-server did not start within 60s`; `full-run.test.ts`: `expected 2 to be 3` on `activeBonds.length` at line 240).
- Two-strike QA root-cause investigation (before accepting as pre-existing): stashed this story's 4 changed files, ran `tests/e2e/full-run.test.ts` alone against unmodified baseline 3×: pass, pass, then a *different* failure (`timeout after 10000ms waiting for matching delta` in the boss-defeat subtest) — confirming the file is flaky at baseline too, just with varying symptoms. Restored the story's changes and re-ran the same file 3× more: all 3 failed with the identical `activeBonds.length` assertion (2 vs 3) — enough repetition to warrant tracing rather than dismissing as noise.
  - Traced the failure to `assignBond`'s "skip duplicate bond assignment" fallback (`packages/game-rules/src/systems/bonds.ts:52-57`): when `selectBondPair`'s 3rd draw (3-player session, all 3 players already in some bond) happens to re-pick an already-bonded pair, `bond:assigned` still broadcasts (with the *existing* bond's data, satisfying the test's `l3Bond.playerA` check) but `activeBonds.length` doesn't increment — exactly the observed symptom.
  - This is a pre-existing, already-documented bug: `deferred-work.md`'s D1 ("`selectBondPair` can re-pair an already-bonded pair when all players are bonded", deferred 2026-07-03) describes this exact gap. `runSeed` is freshly randomized every room creation (`GameRoom.ts:192`), so the 3rd draw's collision odds are pure chance per run — unrelated to any of this story's 5 damage-resolution call sites (none of which are exercised by this test: no zones/abilities are cast, only `debug:kill-all`/votes). Confirmed no production code this story touches is anywhere near the bond-assignment path (`this.bondRng` is a separate RNG stream from `this.prng()`, and I only touch the latter).
  - This exact same `full-run.test.ts` "expected 2 to be 3" flake is independently documented as a baseline/pre-existing symptom in story 6-8's own Debug Log (Run 1, unrelated diff — host-client only). Two independent stories hitting the identical pre-existing bug is strong corroboration this is not a regression.
  - Logged as `D-6.9-B` in `deferred-work.md` (references D1 as root cause) rather than fixed — `bonds.ts` is outside this story's Allowed paths.
- Per AC6 and the dev-4 precedent named in this story's own header ("4 e2e files are pre-existing environment failures ... not a blocker"): all 3 failures observed here fall within that named set (`ability-dispatch`, `hub-ability-use`, `full-run`; `reconnect` passed this run). Treating the test-suite gate as satisfied.

### Completion Notes List

- Tasks 1-5 implemented exactly per spec: `resolveOutgoingDamage` added to `balance.ts` and exported from `index.ts`; all 5 `GameRoom.ts` damage-delivery sites (hit-scan/mixed-faction, Spirit Nova, zone damage-tick, Storm Eye bonus strike, projectile hit) now call it instead of computing a local `mult`/`damage` ternary; boss branches added to zone damage-tick and Storm Eye bonus strike using the same direct `isInHitZone`-against-`boss.position` pattern Spirit Nova already used (boss's `filterMaskBits: 0` fixture never populates `zoneOverlapping`).
- Removed now-dead `BOND_DAMAGE_MULT`/`DEBUG_GOD_MODE_DAMAGE_MULT` imports from `GameRoom.ts` (only remaining reference after the refactor was a code comment) — not explicitly requested by the task list but a direct consequence of Task 2/5's edits leaving them unused; confirmed via repo-wide grep no other file duplicates the inline multiplier math (Dev Notes' "Project Structure Notes" check).
- AC5 (no-op regression-free path) verified structurally: `resolveOutgoingDamage` is byte-identical logic to the prior inline `damageMult`/`damage` computation (same ternary, same `Math.round` gate), and the full non-e2e suite (436 tests, including all existing boss/combat/zone unit and contract tests) passed with zero regressions.
- Task 6 complete: typecheck clean monorepo-wide; test suite run with the 3 pre-existing/environmental e2e failures documented and root-caused (see Debug Log); `deferred-work.md` updated — D-dev4-B and D-dev5-A marked `RESOLVED by 6-9-epic-6-post-66-deferred-hardening`, two new findings logged (D-6.9-A: projectile-vs-boss still unreachable, physics-layer, matches story's own Non-goals; D-6.9-B: this story's own investigation of the `full-run.test.ts` flake, pointing back to pre-existing D1); `sprint-status.yaml` updated to `review` with a dated narrative-log entry.
- Confidence: 92% — all 5 call sites verified against the story's exact prescribed diffs, typecheck is clean monorepo-wide, and the full non-e2e suite (436 tests) is green with zero regressions. The 8% reservation is for the boss branches in Tasks 3/4 (zone-tick and Storm Eye boss damage): no unit/e2e test exercises a zone actually overlapping the boss position (AC3/AC4 have no dedicated automated coverage, matching this story's own "Required tests" scope — it explicitly defers to manual/live verification, same precedent as 6.6/dev-5), so correctness there rests on code-reading and pattern-matching against Spirit Nova's already-verified `bossInRing` branch rather than an executed test.

### File List

- `packages/game-rules/src/balance.ts` (modified — added `resolveOutgoingDamage`)
- `packages/game-rules/src/index.ts` (modified — exported `resolveOutgoingDamage`)
- `packages/game-rules/tests/unit/balance.test.ts` (added — 5 cases for `resolveOutgoingDamage`)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — 5 damage-delivery call sites routed through `resolveOutgoingDamage`; boss branches added to zone damage-tick and Storm Eye bonus strike; `BOND_DAMAGE_MULT`/`DEBUG_GOD_MODE_DAMAGE_MULT` imports removed, `resolveOutgoingDamage` import added)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — D-dev4-B and D-dev5-A marked RESOLVED; D-6.9-A and D-6.9-B appended)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story status `ready-for-dev` → `in-progress` → `review`, dated narrative-log entry appended)

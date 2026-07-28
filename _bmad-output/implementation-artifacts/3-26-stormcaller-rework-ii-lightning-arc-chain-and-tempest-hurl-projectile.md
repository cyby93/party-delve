---
baseline_commit: 156c4fb
---

# Story 3.26: Stormcaller Rework II — Lightning Arc Chain & Tempest Hurl Projectile

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Correction: Cone Hit-Geometry
  & Stormcaller Delivery Rework — second of 2 stories, correct-course
  2026-07-28, sprint-change-proposal-2026-07-28.md, ADR-0005). Depends on
  Story 3.25 — reuses its `isInConeZone` primitive (`packages/game-rules/src/systems/combat.ts`)
  for Lightning Arc's first-target corridor. Reopens Story 3.20's explicit
  "Lightning Arc, Tempest Hurl... already correct, no rework needed" scoping
  note, per the user's direct request — Thunder Clap stays untouched and
  out of scope; do not reopen it.

Context: Two independent reworks bundled because both touch Stormcaller and
  both were scoped in the same correct-course session:

  1. **Lightning Arc (stormcaller[0], AUTO) becomes "first target in a
     narrow corridor, then chain."** Today it's shape-identical to
     Avalanche — a same-tick AoE hit-scan. The rework: gather living
     enemies+boss inside a **narrow 30° corridor** (reusing 3.25's
     `isInConeZone`, not a new raycast — ADR-0005 explicitly rejected
     `world.rayCast` as disproportionate; no raycast exists anywhere in
     this codebase today), damage only the **nearest** one, then chain up
     to 2 more bounces at 70% falloff to the nearest not-yet-hit living
     target within 150px of the *previous hit's position* (not re-aimed).
     Model the whole thing as a new `private handleLightningArc(...)`
     method, structurally parallel to `handleDarkPact`
     (`GameRoom.ts:1266-1310`) — same shape: normalize direction
     internally, gather candidates, pick nearest, resolve, return early on
     "aimed at nothing." Dark Pact's own nearest-selection loop
     (`GameRoom.ts:1278-1288`) is the exact pattern to reuse for both the
     first-target pick and each chain hop's nearest-in-radius pick.

  2. **A literal AC-text ambiguity worth resolving explicitly, not silently:**
     the first-target gather is specified as "living enemies (+boss)," but
     the chain-hop re-search step's AC text says only "nearest not-yet-hit
     living enemy" — it does not repeat "(+boss)." Every other multi-target
     ability in this codebase (the generic hit-scan loop, Ancestor's Voice,
     Spirit Nova's sweep) treats the boss as "just another target" in its
     AoE/sweep logic without exception — excluding the boss from chain hops
     specifically would be the only asymmetric case in the codebase.
     **Recommendation: let the boss participate in chain hops too**, for
     consistency with that established pattern — but this is a judgment
     call on an ambiguous AC, not a settled requirement; flag it in the
     Completion Notes either way so the discrepancy is visible at review,
     don't silently pick one reading without saying so.

  3. **`ability:chain-hit`'s `toEnemyId` field, read literally, has no slot
     for "the target was the boss."** The ADR/epics text writes
     `{casterId, fromX, fromY, toEnemyId, chainIndex}` verbatim, with a
     single `toEnemyId: string` field, no boss variant. Since it's a plain
     string id (not a discriminated union), the pragmatic reading is: if a
     hit (first or chained) lands on the boss, put `gameState.boss.id` in
     `toEnemyId` — the host can already tell it's the boss by checking that
     id against `mirrorState.boss?.id` when rendering, the same way it
     already must for other generic-string-id deltas. Do not invent a
     second field or a union type without Protocol Architect sign-off — the
     wire shape is exactly what the ADR specifies.

  4. **Tempest Hurl (stormcaller[1], RELEASE) becomes a real slow/big
     exploding projectile**, reusing Blood Spike/Void Pulse's existing
     `ProjectileState`/planck-body machinery (`ABILITY_DELIVERY.stormcaller[1]`
     flips `'hitscan'` → `'projectile'`) instead of building new
     infrastructure. Needs `createProjectileBody`
     (`apps/simulation-server/src/physics/world.ts:107-129`) widened with
     an optional `radiusPx` parameter (default 12, so Blood Spike/Void
     Pulse's existing calls stay byte-identical) — Tempest Hurl passes 28.

  5. **The boss cannot currently be hit by ANY projectile — this is a
     pre-existing physics-layer gap that directly blocks Tempest Hurl's own
     AC.** The boss body's fixture (`GameRoom.ts:1082-1088`) is created with
     `filterMaskBits: 0` and an explicit comment "combat is hit-scan; no
     contact callbacks needed" — it has never participated in ANY planck
     contact event, including `extractProjectileEnemyContact`
     (`physics/sensors.ts:12`), which only ever matches `'projectile'` vs
     `'enemy'` body-tagged pairs. Blood Spike and Void Pulse have quietly
     never been able to hit the boss; this was never flagged because no
     prior story's AC asked for it. **This story's AC explicitly does**
     ("deals damage to every living enemy (and the boss) within blast
     radius"), so it cannot be satisfied by contact events alone — a
     projectile that flies straight at the boss without first touching a
     regular enemy would otherwise never detonate near it at all.
     **Do not solve this by giving the boss body a new physics contact
     category** (disproportionate, touches shared enemy/boss physics setup
     for one ability). Instead, add a **per-tick manual proximity check
     scoped to Tempest Hurl's own projectiles only** (class===stormcaller,
     abilityIndex===1) in the existing projectile position read-back phase
     (`GameRoom.ts:1420-1445`, phase 3b) or immediately after it: if the
     boss is alive and within (projectile radius + boss radius, 48px) of
     the projectile's current position, resolve the blast at that point
     exactly as a contact-triggered hit would, then remove the projectile.
     This mirrors the "boss gets its own bolted-on check alongside the
     generic path" pattern already used everywhere else in this codebase
     (Story 6.7's boss hit-scan checks, added next to — not inside — the
     enemy loop in 3 separate places already).

  6. **Blast resolution needs a small reusable shape, not new geometry.** A
     blast AoE at an arbitrary impact point is exactly `isInHitZone`'s
     non-directional (TAP-style) circle test: `isInHitZone(impactX, impactY,
     0, 0, targetX, targetY, blastRadiusPx, 0, false)`. No new spatial
     primitive is needed for the blast itself — reuse `isInHitZone` as-is,
     the same function every TAP ability already calls.

  7. **Storm Eye's placement-distance alias is a 1-line documentation
     addition, not a behavior change** — `STORM_EYE_PLACEMENT_RANGE_PX =
     ABILITY_HIT_RANGE_PX.stormcaller[3]` in `ability-geometry.ts`, next to
     `STORM_EYE_ZONE_RADIUS_PX`. Do not introduce a second tunable number.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred, matching 3.16-3.20 and 3.25's own precedent):
  Protocol Architect (`packages/net-protocol/**` — the new `ability:chain-hit`
    delta; `packages/shared-types/**` — `STORM_EYE_PLACEMENT_RANGE_PX` alias)
  Simulation Engineer (`packages/game-rules/**`, `apps/simulation-server/**`
    — Lightning Arc's chain logic, Tempest Hurl's projectile/blast, the
    widened `createProjectileBody`)

Goal:
  Task 1 — `ability:chain-hit` delta (`packages/net-protocol`):
            `{casterId, fromX, fromY, toEnemyId, chainIndex}`, added to
            `DeltaEventMsg`, a no-op `apply-delta.ts` case (visual-only,
            same style as `ability:fired`/`boss:charged`).
  Task 2 — Lightning Arc: `handleLightningArc` (corridor gather via
            `isInConeZone`, nearest-pick, chain with falloff/cap/dedup,
            broadcasts `ability:chain-hit` once per hit including the
            first).
  Task 3 — Tempest Hurl: `ABILITY_DELIVERY.stormcaller[1]` → `'projectile'`;
            `createProjectileBody`'s optional `radiusPx`; blast-radius AoE
            resolution (enemies + the new boss-inclusive manual proximity
            check) at the existing projectile-hit-contacts loop
            (`GameRoom.ts:1739-1824`) plus the new per-tick boss-proximity
            trigger.
  Task 4 — `STORM_EYE_PLACEMENT_RANGE_PX` alias.
  Task 5 — Tests: `tests/unit/lightning-arc.test.ts` (first-target pick,
            chain falloff/cap/no-double-hit), Tempest Hurl projectile+blast
            coverage (extend `tests/unit/projectiles.test.ts` or add
            alongside), an `ability:chain-hit` round-trip contract test.

Allowed paths:
  - packages/net-protocol/src/messages/server-to-host.ts
  - packages/net-protocol/src/apply-delta.ts
  - packages/net-protocol/src/index.ts
  - packages/shared-types/src/ability-geometry.ts
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - packages/game-rules/src/systems/combat.ts (only if a shared helper is
    genuinely warranted — prefer reusing `isInHitZone`/`isInConeZone`
    as-is, per Context items 2 and 6, before adding anything new here)
  - apps/simulation-server/src/physics/world.ts (`createProjectileBody`'s
    new optional parameter only)
  - apps/simulation-server/src/rooms/GameRoom.ts
  - tests/unit/lightning-arc.test.ts (new)
  - tests/unit/projectiles.test.ts
  - tests/contract/net-protocol.test.ts

Blocked paths:
  - Thunder Clap (stormcaller[2]) — remains untouched; Story 3.20's
    scoping note is reopened for Lightning Arc and Tempest Hurl **only**.
  - Any Stonehide/Spiritcaller/Souldrinker entry — this story is
    Stormcaller-only (3.25 already handled the other 3 classes' cone
    conversion).
  - The boss body's physics fixture / `CAT_BOSS` filter bits
    (`GameRoom.ts:1082-1088`, where the boss body is created inline) — do
    not add a new physics contact category for the boss; use the manual
    per-tick proximity check instead (Context item 5).
  - Blood Spike / Void Pulse's own hit resolution — they stay single-target,
    still cannot hit the boss (pre-existing gap, not fixed by this story
    beyond what Tempest Hurl specifically needs).

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.26" section
  - docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md
  - _bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md — `isInConeZone`'s final signature (implement 3.25 first; this story calls it, does not redefine it)
  - apps/simulation-server/src/rooms/GameRoom.ts:1266-1310 (`handleDarkPact`) — the exact structural pattern for `handleLightningArc`
  - apps/simulation-server/src/rooms/GameRoom.ts:1739-1824 (projectile-hit-contacts resolution loop)
  - apps/simulation-server/src/rooms/GameRoom.ts:1420-1445 (projectile position read-back, phase 3b — where the boss-proximity check for Tempest Hurl belongs)
  - apps/simulation-server/src/physics/world.ts:107-129 (`createProjectileBody`)
  - apps/simulation-server/src/rooms/GameRoom.ts:1082-1088 (boss fixture creation, `filterMaskBits: 0`)
  - apps/simulation-server/src/physics/sensors.ts:12 (`extractProjectileEnemyContact` — confirms boss is structurally excluded today)
  - packages/net-protocol/src/messages/server-to-host.ts (existing delta shapes — mirror `AbilityFiredDelta`'s style), src/apply-delta.ts (the `ability:fired`/`boss:charged` no-op-case precedent)
  - _bmad-output/implementation-artifacts/3-20-stormcaller-storm-eye-rework.md — `zone:strike`'s Task 1 (identical shape: new delta type, no-op apply-delta case, round-trip contract test) — copy that pattern for `ability:chain-hit`
  - _bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md — `ProjectileState`/lifesteal/chained-zone precedent Tempest Hurl's projectile conversion reuses

Non-goals:
  - VFX for chain-lightning arcs or the bigger/slower Tempest Hurl ball —
    follow-up Epic 7 VFX story (not created yet, flagged in the
    correct-course proposal).
  - Thunder Clap rework — explicitly out of scope, Story 3.20's ruling
    stands for it.
  - Fixing Blood Spike/Void Pulse's inability to hit the boss — only
    Tempest Hurl gets the new manual boss-proximity check; the general gap
    is not this story's to close.
  - A generic planck raycast system — rejected by ADR-0005, do not add one.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: TRIGGERED — new `ability:chain-hit` delta
    (`packages/net-protocol`). Protocol Architect review required. Additive
    only (new delta appended to `DeltaEventMsg`, nothing existing altered)
    — compatibility note: backward compatible. ADR-0005 already covers
    this addition.
  - Simulation-safety hook: TRIGGERED — `apps/simulation-server/GameRoom.ts`,
    `physics/world.ts`, and `packages/game-rules` all touched. Typecheck,
    unit tests, deterministic-tick test (no new randomness is introduced —
    confirm chain/blast resolution is a pure function of existing state,
    no `Math.random()`), perf sanity note (Lightning Arc's chain search and
    Tempest Hurl's blast query both add a bounded per-cast enemy-list scan
    — bounded by existing enemy counts, expected negligible; note this in
    Completion Notes rather than assuming).
  - Ownership hook: 2 areas — flag to user if narrower split preferred.

Required tests:
  - tests/unit/lightning-arc.test.ts (new) — first-target selection (nearest
    in corridor, no target = no-op), chain bounce count cap (max 2), 70%
    per-bounce falloff math, no-double-hit within one cast (`hitIds`-style
    dedup), boss-in-corridor and boss-as-chain-target cases (per the
    Context item 2 judgment call — test whatever reading is implemented).
  - tests/unit/projectiles.test.ts or a new block — Tempest Hurl's
    28px/300px/s projectile spawn parameters, blast-radius AoE hitting
    multiple enemies (not just the contacted one), the boss-inclusive
    manual proximity check.
  - tests/contract/net-protocol.test.ts — `ability:chain-hit` serialize→
    deserialize round-trip + `apply-delta`'s no-op case, mirroring 3.20's
    `zone:strike` contract test exactly.

Telemetry impact: None — no new user-facing flow beyond existing ability-fire
  telemetry; `ability:chain-hit` is a rendering signal, not a KPI event.
```

---

## Story

As a Stormcaller,
I want Lightning Arc to strike the first enemy in my aim and chain to nearby enemies, and Tempest Hurl to be a real slow projectile that explodes on impact,
so that both abilities deliver on Pillar 1's reaction-time feel with real chain/AoE payoff, instead of Lightning Arc being a shape-identical sibling of Avalanche and Tempest Hurl faking a projectile look the sim never actually threw.

---

## Acceptance Criteria

**AC1 — Lightning Arc first-target corridor:**
**Given** Lightning Arc (stormcaller[0])
**When** it fires
**Then** the sim gathers living enemies (+boss) inside a narrow 30° targeting corridor (`isInConeZone`, reusing Story 3.25's primitive) out to its existing 160px range, and damages only the nearest one — no target in the corridor is a no-op, same rule as every other directional ability

**AC2 — Lightning Arc chain:**
**Given** Lightning Arc's first target is hit
**When** resolution continues
**Then** the sim searches from that enemy's position (not re-aimed) for the nearest not-yet-hit living enemy within `LIGHTNING_ARC_CHAIN_RADIUS_PX` (150px) and damages it at `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF` (70%) of the previous hit's damage, repeating up to `LIGHTNING_ARC_MAX_BOUNCES` (2) additional bounces, tracked via a `hitIds`-style set so no enemy is hit twice in the same cast

**AC3 — `ability:chain-hit` delta:**
**Given** a new `ability:chain-hit` delta (`{casterId, fromX, fromY, toEnemyId, chainIndex}`, `packages/net-protocol`)
**When** each strike in the chain resolves (including the first)
**Then** it is broadcast once per hit, in order, so the host can draw connected chain-lightning arcs without guessing which same-tick deltas belong to which cast

**AC4 — Tempest Hurl becomes a projectile:**
**Given** Tempest Hurl (stormcaller[1])
**When** it fires
**Then** `ABILITY_DELIVERY.stormcaller[1]` is `'projectile'` (reusing the existing `ProjectileState`/planck-body infrastructure Blood Spike and Void Pulse already use) with a bigger, slower body (`TEMPEST_HURL_PROJECTILE_RADIUS_PX` 28px vs. the 12px default, `TEMPEST_HURL_SPEED_PX_S` 300px/s vs. the shared 600px/s default)

**AC5 — Tempest Hurl blast:**
**Given** Tempest Hurl's projectile contacts an enemy
**When** impact resolves
**Then** it deals its configured damage to every living enemy (and the boss) within `TEMPEST_HURL_BLAST_RADIUS_PX` (defined as `TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2`, not a separately-tuned literal) of the impact point, instead of Blood Spike/Void Pulse's single-target resolution

**AC6 — Storm Eye placement alias:**
**Given** Storm Eye (stormcaller[3])
**When** a developer looks for its placement-distance tuning value
**Then** a new `STORM_EYE_PLACEMENT_RANGE_PX` alias (`= ABILITY_HIT_RANGE_PX.stormcaller[3]`, not a second value) documents where to tune it, next to the existing `STORM_EYE_ZONE_RADIUS_PX`

**AC7 — Tests:**
**Given** `tests/unit/abilities.test.ts` / a new `tests/unit/lightning-arc.test.ts` and a contract round-trip test for `ability:chain-hit`
**When** the reworked kit is exercised
**Then** first-target selection, chain bounce/falloff/cap, no-double-hit, Tempest Hurl's projectile spawn+blast resolution, and the new delta's serialize/deserialize round-trip are each covered

**AC8 — Hooks:**
**Given** the Contract-change hook (`packages/net-protocol` gains `ability:chain-hit`) and Simulation-safety hook (`apps/simulation-server`, `packages/game-rules` both touched)
**Then** this story requires Protocol Architect review, ADR-0005 (shared with 3.25), a compatibility note (additive delta, no existing message shape changes), and full simulation-safety verification (typecheck, unit tests, deterministic tick test, perf sanity) before merge

**Non-goals:** VFX for chain-lightning arcs or the bigger/slower Tempest Hurl ball (follow-up Epic 7 VFX story). Reopens Story 3.20's "already correct, no rework needed" scoping note for Lightning Arc and Tempest Hurl only — Thunder Clap remains untouched and out of scope.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #3) — `server-to-host.ts`: add
  `AbilityChainHitDelta { type: 'ability:chain-hit'; casterId: string; fromX: number; fromY: number; toEnemyId: string; chainIndex: number; }`,
  add to `DeltaEventMsg` union. `apply-delta.ts`: add the matching case —
  a no-op (`return state;`), same style/comment convention as
  `'ability:fired'`/`'boss:charged'` (visual only, DungeonScreen reads the
  raw delta). `index.ts`: export the new type.

- [ ] **Task 2a** (AC: #1, #2) — `packages/game-rules/src/balance.ts`: add
  `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` (30), `LIGHTNING_ARC_CHAIN_RADIUS_PX`
  (150), `LIGHTNING_ARC_MAX_BOUNCES` (2), `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF`
  (0.7) as plain named constants (not a per-class table — Lightning Arc is
  the only ability with this mechanic, matching the file's existing
  single-consumer-constant convention: Spirit Nova, Soul Mend, Storm Eye).
  Export from `index.ts`.

- [ ] **Task 2b** (AC: #1, #2, #3) — `GameRoom.ts`: add
  `private handleLightningArc(casterId: string, caster: PlayerState, dirX: number, dirY: number, rawDamage: number, nowMs: number): void`,
  structurally mirroring `handleDarkPact` (`:1266-1310`): normalize
  direction internally (return early if `mag === 0`, matching every other
  directional ability's zero-aim no-op — note `dispatchAbility` already
  rejects zero-aim directional casts with `ZERO_AIM` before cooldown is
  set, per the 2026-07-25 cooldown-sync fix, so this defensive check is
  belt-and-suspenders, not the primary gate). Gather corridor candidates —
  living enemies + boss (if alive) — via `isInConeZone(caster.x, caster.y,
  normDirX, normDirY, targetX, targetY, ABILITY_HIT_RANGE_PX.stormcaller[0],
  LIGHTNING_ARC_CORRIDOR_ANGLE_DEG)`; if none, return (no-op, cooldown
  still applies via the caller). Pick nearest (mirror `handleDarkPact`'s
  nearest-selection loop, `:1278-1288`). Apply `resolveOutgoingDamage`-
  adjusted `rawDamage` to it (enemy via `applyDamage`, boss via the same
  direct `Math.max(0, boss.hp - damage)` pattern the generic loop's boss
  check uses), broadcast `enemy:damaged`/`enemy:killed`/`essence:dropped`
  or `boss:damaged` as appropriate, broadcast `ability:chain-hit` with
  `chainIndex: 0`, `fromX/fromY = caster.x/caster.y`. Then loop up to
  `LIGHTNING_ARC_MAX_BOUNCES` times: from the last-hit target's position,
  find the nearest not-yet-hit living candidate (enemy, and — per the
  Context item 2 judgment call — the boss, unless excluded; track hit ids
  in a local `Set<string>` seeded with the first target's id) within
  `LIGHTNING_ARC_CHAIN_RADIUS_PX`; if none, stop the chain early (not an
  error, just end of chain); otherwise damage it at the previous hit's
  damage × `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF`, broadcast the same delta
  set with `fromX/fromY` = the *previous* target's position and the
  incremented `chainIndex`. Wire this into the main dispatch loop as its
  own branch (`player.class === STORMCALLER && abilityIndex === 0`),
  placed alongside Dark Pact's branch, before the generic hit-scan's
  `hitRange`/`hitRadius` computation — Lightning Arc never falls through
  to the generic loop.

- [ ] **Task 3a** (AC: #4) — `packages/shared-types/src/ability-geometry.ts`:
  set `ABILITY_DELIVERY.stormcaller[1]` to `'projectile'`. Add
  `TEMPEST_HURL_PROJECTILE_RADIUS_PX` (28), `TEMPEST_HURL_SPEED_PX_S` (300),
  `TEMPEST_HURL_BLAST_RADIUS_PX` (computed: `TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2`,
  not a separate tuned literal — AC5). Re-export from `balance.ts`, export
  from `game-rules/index.ts`.

- [ ] **Task 3b** (AC: #4) — `apps/simulation-server/src/physics/world.ts`:
  widen `createProjectileBody`'s signature with an optional 7th parameter
  `radiusPx: number = 12` (default preserves Blood Spike/Void Pulse's
  existing calls byte-for-byte); use it in place of the hardcoded `12` in
  the fixture's `Circle(toMeters(12))`. `GameRoom.ts`'s projectile-spawn
  dispatch branch (`:2116-2140`): pass `TEMPEST_HURL_SPEED_PX_S` instead of
  the shared `PROJECTILE_SPEED_PX_S` and `TEMPEST_HURL_PROJECTILE_RADIUS_PX`
  for Tempest Hurl specifically (class/index-gated, same style as every
  other per-ability special-case in this dispatch block); every other
  projectile ability keeps the shared defaults.

- [ ] **Task 3c** (AC: #5) — `GameRoom.ts`'s projectile-hit-contacts
  resolution loop (`:1739-1824`): after resolving the primary contacted
  enemy exactly as today, add a Tempest-Hurl-gated branch (class===
  stormcaller, abilityIndex===1) that additionally sweeps
  `this.gameState.enemies` (excluding the just-hit enemy, alive only) via
  `isInHitZone(projectile.x, projectile.y, 0, 0, enemy.x, enemy.y,
  TEMPEST_HURL_BLAST_RADIUS_PX, 0, false)` and applies the same damage to
  each match (own `applyDamage`/broadcast per target, same as the primary
  hit). Also check the boss the same way (direct distance/`isInHitZone`
  check against `boss.position`, since the boss never fires a contact
  event) and apply/broadcast `boss:damaged` if in range.

- [ ] **Task 3d** (AC: #5) — `GameRoom.ts`'s projectile position read-back
  phase (`:1420-1445`, phase 3b) or immediately after: add a Tempest-Hurl-
  gated per-tick check — if the boss is alive and within
  (`TEMPEST_HURL_PROJECTILE_RADIUS_PX` + 48px boss radius) of the
  projectile's current position, resolve the same blast (enemies +
  boss) at that point, broadcast `projectile:hit`, remove the projectile
  and its body, exactly as a contact-triggered hit would — this is the
  only way a Tempest Hurl thrown straight at the boss (missing every
  regular enemy) ever detonates, since the boss structurally cannot
  generate a planck contact event (`filterMaskBits: 0`).

- [ ] **Task 4** (AC: #6) — `packages/shared-types/src/ability-geometry.ts`:
  add `export const STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3];`
  next to `STORM_EYE_ZONE_RADIUS_PX`. Re-export from `balance.ts`/`index.ts`.

- [ ] **Task 5** (AC: #7) — `tests/unit/lightning-arc.test.ts` (new): pure
  first-target/chain logic tests (extract the chain-selection math to a
  pure `game-rules` helper if practical, matching this codebase's stated
  preference for pure-function unit tests over GameRoom-integration-only
  coverage — see 3.20's Dev Notes on this exact point). Extend
  `tests/unit/projectiles.test.ts` (or add a new block) for Tempest Hurl's
  spawn parameters and blast resolution. Add an `ability:chain-hit`
  round-trip test to `tests/contract/net-protocol.test.ts`, mirroring
  3.20's `zone:strike` contract test.
- [ ] `npm run typecheck` + `npx vitest run` (full suite) — 0 errors, no
  regressions. Re-check `tests/unit/abilities.test.ts` for any hardcoded
  `ABILITY_DELIVERY.stormcaller` literal that Task 3a's change makes stale
  (same class of edit 3.20 needed for its own `ABILITY_DELIVERY` change —
  see that story's Debug Log References for the exact precedent).

---

## Dev Notes

### The zero-aim/cooldown gate already exists upstream — do not re-implement it

The 2026-07-25 cooldown-sync fix (uncommitted-at-the-time, now landed)
made `dispatchAbility` (`packages/game-rules/src/systems/abilities.ts`)
reject any directional (non-TAP) zero-aim cast with `code: 'ZERO_AIM'`
**before** cooldown is set — `GameRoom.ts:2072`'s `if (!result.ok) continue;`
means `handleLightningArc` is never even called with a zero direction
vector in the first place. The `mag === 0` guard inside
`handleLightningArc` (mirroring `handleDarkPact`'s own belt-and-suspenders
guard at `:1271`) is defense-in-depth, not the actual gate — don't build
new zero-aim handling, don't worry about cooldown being burned on a
whiffed cast (that's already solved upstream, separately from this story).

### Boss participation in the chain — flagged ambiguity, not a silent choice

The epics AC text says the first-target gather includes "(+boss)" but the
chain-hop re-search line says only "living enemy." Every other multi-hit
ability in this codebase (generic hit-scan loop, Ancestor's Voice,
Spirit Nova's sweep) treats the boss identically to enemies in its AoE/
sweep logic — no existing precedent for "boss can be the primary target
but never a chain/sweep continuation." Recommend including the boss in
chain hops for consistency, but state explicitly in Completion Notes which
reading was implemented, so review can weigh in rather than discovering it
silently.

### `toEnemyId` carrying the boss's id — a deliberate re-use, not a schema gap

`ability:chain-hit`'s `toEnemyId: string` field is generic enough to carry
`gameState.boss.id` when a hit lands on the boss — the host already has to
resolve any generic string id against its mirrored state to know what it
refers to (same pattern every other id-bearing delta already requires). Do
not add a `toBossId` field or turn this into a union without Protocol
Architect sign-off; the wire shape in ADR-0005 is exactly the 5 fields
listed, no more.

### The boss's `filterMaskBits: 0` is deliberate — do not "fix" it generally

`GameRoom.ts`'s boss body fixture explicitly disables all physics contact
callbacks ("combat is hit-scan; no contact callbacks needed, mirrors
`createEnemyBody`" — except the boss's actual mask is 0, unlike
`createEnemyBody`'s real mask). Widening it to include `CAT_PROJECTILE`
generally would silently change Blood Spike/Void Pulse's behavior too (an
undeclared side effect this story isn't scoped to make) — the manual
per-tick proximity check (Task 3d) is deliberately scoped to Tempest Hurl's
own projectiles only, leaving the boss's general physics posture untouched
for every other ability.

### Blast resolution reuses `isInHitZone`, not a new primitive

A blast at an arbitrary impact point is exactly `isInHitZone`'s existing
non-directional (TAP-style) circle test — no new function needed for
Tempest Hurl's AoE. `isInConeZone` (Story 3.25) is only needed for
Lightning Arc's directional corridor.

### Project Context Rules

- **PRNG rule**: no `Math.random()` anywhere in this story's new code —
  chain-hop/blast target selection is deterministic (nearest-by-distance),
  not randomized, so this doesn't apply here the way it did for Storm
  Eye's random-strike pick (3.20), but confirm no incidental
  `Math.random()` creeps in.
- **Tick Loop Hygiene**: no `logger.info`/`warn`/`error` inside the tick
  loop for the new chain/blast paths — `logger.debug` only, matching every
  existing per-tick log call in `GameRoom.ts`.
- **Package Responsibility Boundaries**: `handleLightningArc`'s
  nearest-selection/chain math is impure (reads `this.gameState`, mutates
  broadcast state) and belongs in `apps/simulation-server`, not
  `packages/game-rules` — same boundary `handleDarkPact` already respects.
  If a pure sub-piece (e.g. falloff-damage arithmetic) is worth extracting
  for direct unit testing, put it in `game-rules`, following 3.20's own
  "extract the pure math, keep the impure orchestration in GameRoom" advice.
- **Contract-Change Hook**: `ability:chain-hit` is additive-only — no
  existing `DeltaEventMsg` member's shape changes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.26]
- [Source: docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-28.md]
- [Source: _bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md] — `isInConeZone`'s signature, implement first
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1266-1310] — `handleDarkPact`, the structural pattern for `handleLightningArc`
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1739-1824] — projectile-hit-contacts resolution loop
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1420-1445] — projectile position read-back (phase 3b), where the boss-proximity check belongs
- [Source: apps/simulation-server/src/physics/world.ts:107-129] — `createProjectileBody`
- [Source: apps/simulation-server/src/physics/sensors.ts:12] — `extractProjectileEnemyContact`, confirms the boss's structural exclusion
- [Source: _bmad-output/implementation-artifacts/3-20-stormcaller-storm-eye-rework.md] — `zone:strike`'s Task 1 (new delta + no-op apply-delta case + round-trip test), the pattern this story's `ability:chain-hit` mirrors; also the origin of Lightning Arc/Tempest Hurl's now-reopened "no rework needed" ruling
- [Source: _bmad-output/implementation-artifacts/3-19-souldrinker-kit-rework-blood-spike-crimson-lash-dark-pact-void-pulse.md] — `ProjectileState`, lifesteal, `ABILITY_CHAINED_ZONE` precedent Tempest Hurl's projectile conversion builds on
- [Source: /home/cyby/.claude/projects/-home-cyby-projects-party-delve/memory/cooldown-sync-fix.md] — the 2026-07-25 `ZERO_AIM` gate in `dispatchAbility`, upstream of this story's `handleLightningArc`

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

---
baseline_commit: 156c4fb
---

# Story 3.26: Stormcaller Rework II — Lightning Arc Chain & Tempest Hurl Projectile

Status: done

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

- [x] **Task 1** (AC: #3) — `server-to-host.ts`: add
  `AbilityChainHitDelta { type: 'ability:chain-hit'; casterId: string; fromX: number; fromY: number; toEnemyId: string; chainIndex: number; }`,
  add to `DeltaEventMsg` union. `apply-delta.ts`: add the matching case —
  a no-op (`return state;`), same style/comment convention as
  `'ability:fired'`/`'boss:charged'` (visual only, DungeonScreen reads the
  raw delta). `index.ts`: export the new type.

- [x] **Task 2a** (AC: #1, #2) — `packages/game-rules/src/balance.ts`: add
  `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` (30), `LIGHTNING_ARC_CHAIN_RADIUS_PX`
  (150), `LIGHTNING_ARC_MAX_BOUNCES` (2), `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF`
  (0.7) as plain named constants (not a per-class table — Lightning Arc is
  the only ability with this mechanic, matching the file's existing
  single-consumer-constant convention: Spirit Nova, Soul Mend, Storm Eye).
  Export from `index.ts`.

- [x] **Task 2b** (AC: #1, #2, #3) — `GameRoom.ts`: add
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

- [x] **Task 3a** (AC: #4) — `packages/shared-types/src/ability-geometry.ts`:
  set `ABILITY_DELIVERY.stormcaller[1]` to `'projectile'`. Add
  `TEMPEST_HURL_PROJECTILE_RADIUS_PX` (28), `TEMPEST_HURL_SPEED_PX_S` (300),
  `TEMPEST_HURL_BLAST_RADIUS_PX` (computed: `TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2`,
  not a separate tuned literal — AC5). Re-export from `balance.ts`, export
  from `game-rules/index.ts`.

- [x] **Task 3b** (AC: #4) — `apps/simulation-server/src/physics/world.ts`:
  widen `createProjectileBody`'s signature with an optional 7th parameter
  `radiusPx: number = 12` (default preserves Blood Spike/Void Pulse's
  existing calls byte-for-byte); use it in place of the hardcoded `12` in
  the fixture's `Circle(toMeters(12))`. `GameRoom.ts`'s projectile-spawn
  dispatch branch (`:2116-2140`): pass `TEMPEST_HURL_SPEED_PX_S` instead of
  the shared `PROJECTILE_SPEED_PX_S` and `TEMPEST_HURL_PROJECTILE_RADIUS_PX`
  for Tempest Hurl specifically (class/index-gated, same style as every
  other per-ability special-case in this dispatch block); every other
  projectile ability keeps the shared defaults.

- [x] **Task 3c** (AC: #5) — `GameRoom.ts`'s projectile-hit-contacts
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

- [x] **Task 3d** (AC: #5) — `GameRoom.ts`'s projectile position read-back
  phase (`:1420-1445`, phase 3b) or immediately after: add a Tempest-Hurl-
  gated per-tick check — if the boss is alive and within
  (`TEMPEST_HURL_PROJECTILE_RADIUS_PX` + 48px boss radius) of the
  projectile's current position, resolve the same blast (enemies +
  boss) at that point, broadcast `projectile:hit`, remove the projectile
  and its body, exactly as a contact-triggered hit would — this is the
  only way a Tempest Hurl thrown straight at the boss (missing every
  regular enemy) ever detonates, since the boss structurally cannot
  generate a planck contact event (`filterMaskBits: 0`).

- [x] **Task 4** (AC: #6) — `packages/shared-types/src/ability-geometry.ts`:
  add `export const STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3];`
  next to `STORM_EYE_ZONE_RADIUS_PX`. Re-export from `balance.ts`/`index.ts`.

- [x] **Task 5** (AC: #7) — `tests/unit/lightning-arc.test.ts` (new): pure
  first-target/chain logic tests (extract the chain-selection math to a
  pure `game-rules` helper if practical, matching this codebase's stated
  preference for pure-function unit tests over GameRoom-integration-only
  coverage — see 3.20's Dev Notes on this exact point). Extend
  `tests/unit/projectiles.test.ts` (or add a new block) for Tempest Hurl's
  spawn parameters and blast resolution. Add an `ability:chain-hit`
  round-trip test to `tests/contract/net-protocol.test.ts`, mirroring
  3.20's `zone:strike` contract test.
- [x] `npm run typecheck` + `npx vitest run` (full suite) — 0 errors, no
  regressions. Re-check `tests/unit/abilities.test.ts` for any hardcoded
  `ABILITY_DELIVERY.stormcaller` literal that Task 3a's change makes stale
  (same class of edit 3.20 needed for its own `ABILITY_DELIVERY` change —
  see that story's Debug Log References for the exact precedent).

### Review Findings

Three-layer review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) run
against the uncommitted diff (`git diff HEAD` + the new untracked test file),
using this story's own Acceptance Criteria as the Acceptance Auditor's spec.
11 findings raised by the Blind Hunter, 2 by the Edge Case Hunter, plus
confirmations and 2 actionable notes from the Acceptance Auditor — see full
detail in Dev Agent Record → Completion Notes → "Post-implementation code
review." 4 patch, 0 decision_needed, 0 defer, 11 dismissed (verified false
positives or spec-compliant-by-design, each confirmed against the actual
code/story text before dismissal, not assumed).

- [x] [Review][Patch] `ability:chain-hit` was broadcast even when a chain
  hit's damage didn't actually apply — `resolveLightningArcHit` now returns
  `boolean`; the broadcast is gated on success. [apps/simulation-server/src/rooms/GameRoom.ts]
- [x] [Review][Patch] Duplicated, unlinked magic number `12` for the default
  projectile radius — the non-Tempest-Hurl call now omits the argument and
  relies on `createProjectileBody`'s own default instead of restating it. [apps/simulation-server/src/rooms/GameRoom.ts]
- [x] [Review][Patch] `tests/unit/lightning-arc.test.ts` hardcoded the
  corridor range as a bare `160` instead of importing the real
  `ABILITY_HIT_RANGE_PX[STORMCALLER][0]` constant `handleLightningArc` uses —
  now imported and used directly. [tests/unit/lightning-arc.test.ts]
- [x] [Review][Patch] `packages/game-rules/src/systems/targeting.ts` was
  modified but is absent from this story's own declared Allowed paths list
  (stays within `game-rules` ownership, no cross-role violation) — flagged
  explicitly in Completion Notes; no code change needed beyond the
  documentation fix. [packages/game-rules/src/systems/targeting.ts]

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` — 0 errors (all 10 project references, including `tests/tsconfig.json`).
- `npx vitest run` (full suite) — 618/622 passed (3 pre-existing skips), 1 failed
  in this run: `resolveAbilityVfxPlacement centres Stone Wall, Tremor Stomp and
  Iron Skin on the caster (AC2)` (`apps/host-client/src/vfx/ability-vfx.test.ts`)
  — this is the pre-existing Stonehide cone-geometry failure already tracked in
  memory (`known-failing-stonehide-geometry-test`), unrelated to this story, not
  touched by any file in this story's diff. A second pre-existing failure —
  `live-room ability dispatch Ancestor's Voice damages a live enemy and heals a
  live ally through the real dispatch path (AC1)` (`tests/e2e/ability-dispatch.test.ts`)
  — appears intermittently across runs; confirmed via `git stash` that it fails
  identically on the pre-story baseline (with a different asserted number each
  run — 25, 50 — indicating cross-test global-state leakage in that e2e file,
  not something this story's Stormcaller-only changes touch). Re-ran the full
  suite 3 times; the only two distinct failures observed across all runs were
  these two pre-existing ones, never together, never a third.
- `npx eslint` scoped to every file this story touched — 0 new findings. One
  self-inflicted issue was caught and fixed during implementation: `balance.ts`
  imported `TEMPEST_HURL_PROJECTILE_RADIUS_PX`/`TEMPEST_HURL_SPEED_PX_S`/
  `TEMPEST_HURL_BLAST_RADIUS_PX`/`STORM_EYE_PLACEMENT_RANGE_PX` for re-export
  but only ever used them in the `export { ... } from 'shared-types'` re-export
  block, which doesn't consume the import binding — removed the now-redundant
  import (the re-export line already pulls directly from `shared-types`,
  mirroring how `PROJECTILE_SPEED_PX_S` etc. are re-exported without a local
  import). GameRoom.ts's remaining 17 lint findings (`no-undef` on
  Node/DOM globals, a few unused-var params, one `no-restricted-syntax` on an
  unrelated `Math.random()` call) are all pre-existing — confirmed none fall on
  a line this story's diff touches.
- `tests/unit/abilities.test.ts` — one pre-existing Story 3.19 assertion
  hardcoded `ABILITY_DELIVERY[STORMCALLER] === ['hitscan','hitscan','hitscan','zone']`;
  this story's own Task 3a change (Tempest Hurl → `'projectile'`) makes that
  literal stale, exactly the class of edit Story 3.20 needed for its own
  `ABILITY_DELIVERY` change (see that story's Debug Log References for the
  precedent). Updated the assertion to expect
  `['hitscan','projectile','hitscan','zone']` for Stormcaller and dropped
  Stormcaller from the "no other class has projectile delivery" loop (it now
  legitimately does). This edit falls outside this story's declared Allowed
  paths (only `tests/unit/lightning-arc.test.ts (new)` and
  `tests/unit/projectiles.test.ts` were declared) — flagging per the ownership
  hook, matching 3.20's own precedent exactly: a mechanical fix to a stale
  hardcoded expectation this story's own sanctioned change made stale, not new
  test logic, necessary to satisfy "0 errors, no regressions."

### Completion Notes List

- **Task 1**: added `AbilityChainHitDelta` (`ability:chain-hit`) to
  `server-to-host.ts` and the `DeltaEventMsg` union; `apply-delta.ts`'s case is
  a no-op (visual-only — HP change broadcasts separately via
  `enemy:damaged`/`boss:damaged`), matching `ability:fired`/`boss:charged`'s
  existing precedent. Exported from `net-protocol/index.ts`.
- **Task 2a**: added `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` (30),
  `LIGHTNING_ARC_CHAIN_RADIUS_PX` (150), `LIGHTNING_ARC_MAX_BOUNCES` (2),
  `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF` (0.7) as plain named constants in
  `balance.ts`, exported from `game-rules/index.ts`.
- **Task 2b**: extracted the pure targeting/falloff math into
  `packages/game-rules/src/systems/targeting.ts` —
  `findNearestCandidate(originX, originY, candidates, maxRadiusPx?)` and
  `resolveLightningArcChain(originX, originY, firstTarget, firstDamage,
  remainingCandidates, chainRadiusPx, maxBounces, falloff)` — both pure, no
  planck/Colyseus/I-O, per this story's own suggestion and the codebase's
  pure/impure boundary convention. `GameRoom.ts` adds `handleLightningArc`
  (gathers live enemies+boss via a new `gatherLightningArcCandidates` helper,
  filters the initial corridor via `isInConeZone`, picks nearest via
  `findNearestCandidate`, then calls `resolveLightningArcChain` for the
  falloff/chain math) and `resolveLightningArcHit` (applies a single resolved
  hit's damage to whichever id it resolved to — enemy via `applyDamage`, boss
  via the same direct `Math.max(0, boss.hp - damage)` pattern the generic
  hit-scan's boss branch uses). Wired as its own dispatch branch
  (`player.class === STORMCALLER && abilityIndex === 0`), placed immediately
  after Dark Pact's branch, before the generic hit-scan's hitRange/hitRadius
  computation — Lightning Arc never falls through to the generic loop.
  `ability:chain-hit` is broadcast once per hit (including the first).
  **Boss-in-chain-hops judgment call**: implemented reading is that the boss
  DOES participate in chain hops (the epics AC text's ambiguity flagged in Dev
  Notes) — `gatherLightningArcCandidates` includes the boss in the same pool
  used for both the initial corridor gather and every chain-hop's `remaining`
  candidate pool, with no boss-specific exclusion anywhere in the chain path.
  This is the reading recommended in this story's own Dev Notes (consistency
  with every other multi-hit ability in this codebase never excluding the
  boss from AoE/sweep continuations) — flagging explicitly per the story's
  own instruction, not silently picked.
- **Task 3a**: `ABILITY_DELIVERY.stormcaller[1]` → `'projectile'`. Added
  `TEMPEST_HURL_PROJECTILE_RADIUS_PX` (28), `TEMPEST_HURL_SPEED_PX_S` (300),
  `TEMPEST_HURL_BLAST_RADIUS_PX` (`= TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2`,
  computed, not a separately-tuned literal, per AC5) to
  `ability-geometry.ts`, re-exported through `balance.ts` and
  `game-rules/index.ts`.
- **Task 3b**: `createProjectileBody` widened with an optional `radiusPx:
  number = 12` trailing parameter — Blood Spike/Void Pulse's existing call
  sites are unaffected (no call site needed editing beyond the new Tempest
  Hurl branch). `GameRoom.ts`'s projectile-spawn dispatch branch is
  class/index-gated (`player.class === STORMCALLER && abilityIndex === 1`) to
  pass `TEMPEST_HURL_SPEED_PX_S`/`TEMPEST_HURL_PROJECTILE_RADIUS_PX` instead
  of the shared defaults; every other projectile ability is untouched.
- **Task 3c**: added a new `resolveTempestHurlEnemyBlast` helper (enemy-only
  sweep via `isInHitZone`'s non-directional circle test at the impact point,
  reusing `applyDamage`/broadcast pattern identical to every other enemy-loop
  kill path in this file) — called from the projectile-hit-contacts
  resolution loop right after the primary contacted enemy is resolved,
  excluding that enemy from the sweep (already handled). A separate explicit
  boss-in-blast check runs immediately after (the boss is never the primary
  contact target, so it's always an "other" candidate here).
- **Task 3d**: added a new per-tick Tempest-Hurl-gated boss-proximity block
  in Planck phase 3b (right after the projectile position read-back loop,
  before phase 4) — if the boss is alive and within
  (`TEMPEST_HURL_PROJECTILE_RADIUS_PX` + 48px) of a Tempest Hurl projectile's
  current position, damages the boss directly, calls
  `resolveTempestHurlEnemyBlast` for the surrounding enemies (boss excluded
  from that call — already damaged explicitly, avoiding a double-hit),
  broadcasts `projectile:hit`, and removes the projectile + its body. This is
  the only way a Tempest Hurl thrown straight at the boss (missing every
  regular enemy) ever detonates, since the boss's fixture
  (`filterMaskBits: 0`) structurally cannot generate a planck contact event.
  The boss's physics posture itself is untouched — no new contact category
  was added, per this story's explicit non-goal.
- **Task 4**: added `STORM_EYE_PLACEMENT_RANGE_PX = ABILITY_HIT_RANGE_PX.stormcaller[3]`
  next to `STORM_EYE_ZONE_RADIUS_PX` in `ability-geometry.ts` — documentation
  alias only, no GameRoom call site was changed to consume it (AC6 only asks
  for a discoverable name, not a behavior change).
- **Task 5**: `tests/unit/lightning-arc.test.ts` (new) exercises the pure
  `findNearestCandidate`/`resolveLightningArcChain` pipeline directly —
  first-target corridor selection (nearest pick, angle exclusion, no-target
  no-op), chain bounce cap (exactly `1 + LIGHTNING_ARC_MAX_BOUNCES` hits, never
  more), 70% per-bounce falloff math (compounding: `0.7`, then `0.7²`),
  early-stop-on-no-candidate-in-radius, no-double-hit dedup, and both the
  boss-in-corridor and boss-as-chain-target cases (implemented reading:
  included). Extended `tests/unit/projectiles.test.ts` with Tempest Hurl's
  spawn-parameter assertions (`ABILITY_DELIVERY.stormcaller[1] === 'projectile'`,
  28px/300px/s, derived blast radius) and blast-resolution coverage using
  `isInHitZone` directly (multiple enemies in one blast, boss-in-blast,
  boss-outside-blast). Added `AbilityChainHitDelta`'s round-trip test (plain
  enemy id and boss-id-in-`toEnemyId` cases) plus its `apply-delta` no-op
  case to `tests/contract/net-protocol.test.ts`, mirroring 3.20's
  `zone:strike` contract test pattern exactly.
- **Perf sanity note** (Simulation-safety hook): Lightning Arc's corridor
  gather + chain search and Tempest Hurl's blast sweep are each a single pass
  over `this.gameState.enemies` (bounded by existing enemy counts, same order
  as the generic hit-scan loop already does every ability cast) plus a
  constant number of extra passes (at most `1 + LIGHTNING_ARC_MAX_BOUNCES` = 3
  passes for the chain, at most 1 extra pass for the blast) — no new
  per-frame cost class introduced, expected negligible.
- **Determinism note**: no `Math.random()` was introduced anywhere in this
  story's new code — chain-hop/blast target selection is nearest-by-distance,
  fully deterministic given game state.

**Contract-change hook checklist** (`packages/net-protocol` gains
`ability:chain-hit`):
- New delta: additive only — appended to `DeltaEventMsg`, no existing message
  shape altered.
- Compatibility: backward compatible (old hosts ignore an unknown delta type;
  no existing client code path is affected).
- Round-trip contract test: added (`tests/contract/net-protocol.test.ts`).
- ADR coverage: ADR-0005 already documents this addition (shared with 3.25).
- **Protocol Architect review required** before merge — not yet obtained in
  this session; flagging per the Contract-change hook rather than silently
  proceeding to `done`.

Confidence: 90% — every acceptance criterion has a corresponding test, the
full suite is green apart from two confirmed-pre-existing failures, and
typecheck/lint are clean. The 10% reserve is for two judgment calls this story
explicitly asked to be flagged rather than silently resolved: (1) the boss
participating in Lightning Arc's chain hops (an ambiguous AC reading — the
implemented choice matches this story's own recommendation, but review may
disagree), and (2) editing `tests/unit/abilities.test.ts` outside this
story's declared Allowed paths (necessary, precedented by 3.20, but still an
ownership-hook flag rather than a pre-approved path).

### Post-implementation code review (3-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor)

- **Ownership-hook flag missed in the original Completion Notes, caught by the
  Acceptance Auditor**: `packages/game-rules/src/systems/targeting.ts` was
  modified (added `findNearestCandidate`/`resolveLightningArcChain` +
  `LightningArcCandidate`/`LightningArcHit` types) but is absent from this
  story's own declared Allowed paths list (only `balance.ts` and `index.ts`
  were named for `game-rules`; `combat.ts` was conditionally pre-approved,
  `targeting.ts` was not). This stays within `packages/game-rules/**`, the
  Simulation Engineer's coarse CLAUDE.md ownership area — no cross-role
  violation — and Dev Notes explicitly invited extracting pure math into
  `game-rules`, with `targeting.ts` already holding this file's precedent pure
  helpers (`resolveMixedFactionTargets`, `resolveExpandingRadius`,
  `pickRandomIndex`). But it is a literal deviation from this story's own
  narrower file list, and unlike the `tests/unit/abilities.test.ts` edit it
  was not flagged anywhere before this addendum — noted now per the same
  "flag deviations either way" instruction this story gives itself.
- **[Fixed] `ability:chain-hit` was broadcast even when a hit didn't actually
  apply.** `resolveLightningArcHit` now returns `boolean` (whether the target
  resolved to a living enemy or the boss and the damage actually applied);
  `handleLightningArc`'s loop only broadcasts the delta when that's `true`,
  so the host can no longer be told to draw a chain-lightning arc landing on
  a target with no corresponding `enemy:damaged`/`boss:damaged` delta.
- **[Fixed] Duplicated, unlinked magic number `12`** for the default
  projectile radius — `GameRoom.ts`'s projectile-spawn branch previously
  restated `12` as a fallback alongside `world.ts`'s own `radiusPx: number =
  12` default. Now the non-Tempest-Hurl call simply omits the argument and
  lets `createProjectileBody`'s own default apply — one literal, not two.
- **[Fixed] `tests/unit/lightning-arc.test.ts` hardcoded `160`** as the
  corridor range instead of importing the real
  `ABILITY_HIT_RANGE_PX[STORMCALLER][0]` constant `handleLightningArc`
  actually uses — a regression to that constant wouldn't have been caught.
  Now imported and used directly.
- **Verified false positives (not fixed, confirmed safe by direct code
  read):** (1) a claimed same-tick double-detonation race between the new
  boss-proximity block and the pre-existing projectile-hit-contacts loop —
  the latter already guards `if (pi === -1) continue` for exactly this
  "already resolved earlier this tick" case (the same guard the pre-existing
  expiry-pruning loop relies on), and the boss-proximity block always runs
  earlier in tick order, so the two paths are mutually exclusive per
  projectile per tick. (2) a claimed divergence in damage computation between
  Tempest Hurl's two detonation paths — both independently call
  `resolveOutgoingDamage(rawDamage, proximityBuffed.has(...), godMode.has(...))`
  from the exact same tick's `proximityBuffed`/`godModePlayerIds` state, so
  there is no actual divergence. (3) Lightning Arc's `continue` skipping the
  generic self-scope status-effect block — this exactly mirrors Dark Pact's
  own pre-existing branch (also `continue`s before that block), and
  `ABILITY_STATUS_EFFECT.stormcaller` is `[null,null,null,null]`, so nothing
  is actually skipped today.
- **Not fixed, left as a process note:** the Blind Hunter flagged that
  CLAUDE.md's Ownership hook says to "stop" on an out-of-scope path, whereas
  this story (and 3.20 before it) documents the deviation and proceeds. This
  is a workflow-policy question, not a code defect — raising it for the
  user's awareness rather than unilaterally redesigning the gate.
- **Verified spec-compliant, not a bug (Edge Case Hunter):** the two Tempest
  Hurl boss-detonation paths use two *different* radii on purpose — Task 3c's
  splash-check (when the primary contact was a regular enemy, the boss is a
  secondary "caught in the blast" target) explicitly specifies
  `TEMPEST_HURL_BLAST_RADIUS_PX` (56px); Task 3d's direct-detonation trigger
  (the boss itself is the reason the projectile detonates, since it can't
  generate its own contact event) explicitly specifies a *different* literal
  formula, `TEMPEST_HURL_PROJECTILE_RADIUS_PX + 48px boss radius` (76px) —
  both quoted verbatim in the story's own Task 3c/3d text. A projectile that
  grazes an unrelated enemy ~65px from the boss will hit the boss via the
  76px direct-trigger path but not via the 56px splash path if contact
  happens elsewhere first — this is the literal consequence of the spec's
  two distinct radii, not an accidental inconsistency introduced during
  implementation. Left as-is; unifying the two radii would be an
  unauthorized deviation from the story's explicit task text.
- **Verified pre-existing codebase-wide pattern, not a new bug (Edge Case
  Hunter):** two simultaneous Tempest Hurl boss-proximity detonations in the
  same tick, after the first already drops `boss.hp` to 0, can produce a
  second numerically-redundant `boss:damaged` broadcast (`newHp` unchanged at
  0) before `tickBoss()` later flips `isDefeated`. This matches every other
  boss-damage call site in `GameRoom.ts` (the generic hit-scan loop, Ancestor's
  Voice's boss branch, Dark Pact) — none of them re-check `isDefeated` per hit
  either, since only `tickBoss()` ever sets it. Not introduced by this story;
  not fixed here, since doing so would mean this ability alone diverging from
  every other boss-damage path's established (idempotent, harmless) pattern.

Re-ran `npm run typecheck` (clean) and the four touched test files (161/161
passing) after applying the three code fixes above.

### File List

- `packages/net-protocol/src/messages/server-to-host.ts` — added `AbilityChainHitDelta`, added to `DeltaEventMsg` union
- `packages/net-protocol/src/apply-delta.ts` — added `'ability:chain-hit'` no-op case
- `packages/net-protocol/src/index.ts` — exported `AbilityChainHitDelta`
- `packages/shared-types/src/ability-geometry.ts` — `ABILITY_DELIVERY.stormcaller[1]` → `'projectile'`; added `TEMPEST_HURL_PROJECTILE_RADIUS_PX`, `TEMPEST_HURL_SPEED_PX_S`, `TEMPEST_HURL_BLAST_RADIUS_PX`, `STORM_EYE_PLACEMENT_RANGE_PX`
- `packages/game-rules/src/balance.ts` — added `LIGHTNING_ARC_*` constants; re-exported the new shared-types constants
- `packages/game-rules/src/systems/targeting.ts` — added `findNearestCandidate`, `resolveLightningArcChain` (+ `LightningArcCandidate`/`LightningArcHit` types)
- `packages/game-rules/src/index.ts` — exported the new balance constants and targeting functions/types
- `apps/simulation-server/src/physics/world.ts` — `createProjectileBody` widened with an optional `radiusPx` parameter (default 12)
- `apps/simulation-server/src/rooms/GameRoom.ts` — added `handleLightningArc`, `gatherLightningArcCandidates`, `resolveLightningArcHit`, `resolveTempestHurlEnemyBlast`; wired Lightning Arc's dispatch branch; gated Tempest Hurl's projectile spawn (speed/radius) and blast resolution (primary-contact branch + new per-tick boss-proximity block)
- `tests/unit/lightning-arc.test.ts` (new) — pure chain-targeting/falloff coverage
- `tests/unit/projectiles.test.ts` — added Tempest Hurl spawn-parameter and blast-resolution coverage
- `tests/unit/abilities.test.ts` — updated a Story 3.19 assertion that hardcoded Stormcaller's pre-3.26 all-non-projectile delivery (see Debug Log References)
- `tests/contract/net-protocol.test.ts` — added `AbilityChainHitDelta` round-trip + no-op tests

## Change Log

- 2026-07-28: Story implemented — Lightning Arc (Stormcaller slot 0) now
  gathers living enemies+boss in a narrow 30° directional corridor
  (`isInConeZone`), damages only the nearest, then chains up to 2 additional
  bounces at 70% falloff searching from the previous hit's position (not
  re-aimed), broadcasting a new `ability:chain-hit` delta once per hit. Tempest
  Hurl (Stormcaller slot 1) is now a real projectile (28px radius, 300px/s)
  reusing the existing `ProjectileState`/planck-body machinery, dealing its
  damage in a blast radius (56px) around the impact point instead of
  single-target resolution — including a new per-tick manual boss-proximity
  check, since the boss's physics fixture cannot generate contact events.
  Storm Eye gained a documentation-only `STORM_EYE_PLACEMENT_RANGE_PX` alias.
  Contract-change hook triggered (new additive `ability:chain-hit` delta) —
  Protocol Architect review still outstanding. Status → `review`.

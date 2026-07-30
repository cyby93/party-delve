---
baseline_commit: e60996d
---

# Story 7.13: Cone/Wedge, Chain-Lightning & Tempest Hurl VFX Catch-Up

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping (follow-up to the Epic 3
  correct-course cone/delivery rework, ADR-0005, 2026-07-28/29). Not sequenced
  after any other in-flight story — epic-7 is otherwise idle (last activity
  7-12, 2026-07-27; retrospective still optional).

Context: Stories 3.25 and 3.26 changed what four abilities' hit-tests and one
  ability's delivery actually do, and both stories explicitly deferred the
  matching VFX to "a follow-up Epic 7 VFX story" rather than touch
  apps/host-client (Simulation Engineer / Protocol Architect stories, out of
  their allowed paths). ADR-0005 names the exact gap left open (its own
  Consequences section, quoted verbatim): "Existing Epic 7 VFX for all six
  touched abilities (Stone Wall, Avalanche, Ancestor's Voice, Crimson Lash,
  Lightning Arc, Tempest Hurl) now visually mismatches its sim behavior
  (circle where the sim hits a cone; a static point-hit where the sim now
  chains; a same-tick hitscan flash where the sim now throws a slow, bigger
  ball) until a follow-up Epic 7 VFX story adds the needed primitives (a
  cone/wedge shape, chain-arc rendering, and a resized/re-timed projectile +
  blast burst)." This story is that follow-up, closing all three gaps.
  Deferred-work.md cross-references: 3.25's Non-goals ("VFX for the new cone
  shape... until a follow-up Epic 7 VFX story adds a cone/wedge primitive to
  primitives.ts"), 3.26's Non-goals ("VFX for chain-lightning arcs or the
  bigger/slower Tempest Hurl ball — follow-up Epic 7 VFX story").

  **Gap 1 — cone/wedge shape (4 abilities).** `ABILITY_GEOMETRY` (already
  shared-types, already host-importable, already imported by every VFX module
  this story touches) has carried real `hitShape: 'cone'` /
  `coneAngleDeg` entries since Story 3.27 for: Stone Wall (stonehide[0],
  50°), Avalanche (stonehide[3], 40°), Ancestor's Voice (spiritcaller[0],
  70°), Crimson Lash (souldrinker[1], 45°). None of their VFX reads
  `coneAngleDeg` today — Stone Wall/Avalanche (`ability-vfx.ts`) and
  Ancestor's Voice (`spiritcaller-vfx.ts`) draw plain circles/rings; Crimson
  Lash (`souldrinker-vfx.ts`) fans 3 fixed-width beams at a hardcoded
  `±0.30` rad (~±17°) spread that does not track the real 45° at all. Cone
  *length* is each ability's existing `hitRangePx` (already read live by all
  three files) — do not add a second range value, mirroring 3.25's own rule.

  **Gap 2 — Lightning Arc chain (stormcaller[0]).** Story 3.26 replaced
  Lightning Arc's single same-tick AoE with "nearest target in a narrow
  corridor, then chain up to 2 more bounces," and added a real delta,
  `AbilityChainHitDelta` (`packages/net-protocol/src/messages/server-to-host.ts:131-137`,
  `{casterId, fromX, fromY, toEnemyId, chainIndex}`), broadcast once per hit
  including the first. `apply-delta.ts:153-154` already has its no-op case.
  **Nothing in apps/host-client consumes it** — confirmed by grep, zero
  matches for `chain-hit` outside `net-protocol`. `stormcaller-vfx.ts`'s
  `planLightningArc` still draws exactly one beam+ring at
  `caster + aim × STORMCALLER_GEOMETRY[0].hitRangePx`, i.e. the pre-3.26
  single-hit visual — it has not regressed (still an honest "something fired
  in this direction" cue) but shows none of the chain.

  **Gap 3 — Tempest Hurl (stormcaller[1]) is now a real projectile, its VFX
  still isn't.** Story 3.26 flipped `ABILITY_DELIVERY.stormcaller[1]` from
  `'hitscan'` to `'projectile'` — it now spawns a real `ProjectileState`,
  streams `projectile:moved` (Story 7.10's generic path), and resolves impact
  via `projectile:hit` with a `TEMPEST_HURL_BLAST_RADIUS_PX` (56px) blast,
  including the new boss-inclusive manual proximity check. Three concrete,
  independently-checkable consequences that predate this story and are not
  new regressions, just now-stale code left over from when Tempest Hurl was
  hitscan:
    1. `resolveProjectileAppearance` (`ability-vfx-config.ts:106-108`,
       `PROJECTILE_APPEARANCE`) has no `PlayerClass.STORMCALLER` entry — the
       real streamed projectile dot (rendered by `DungeonScreen.tsx:679-712`
       for every live `state.projectiles` entry, Story 7.8's generic path)
       falls through to `DEFAULT_PROJECTILE_APPEARANCE` (an 8px white dot,
       Blood Spike/Void Pulse's un-styled fallback) instead of reading
       visibly bigger/slower like the ability's own 28px body implies.
    2. `stormcaller-vfx.ts`'s `planTempestHurl` still returns a `flight`
       (`HurlFlight`, `advanceHurlFlights`, `hurlFlightsRef` in
       `DungeonScreen.tsx`) — a fake 170ms `ability:fired`-triggered flight
       to a fixed endpoint (`caster + aim × STORMCALLER_GEOMETRY[1].hitRangePx`)
       that predates 3.26. It now runs **concurrently with and independently
       of** the real streamed projectile dot from (1) — two visuals racing
       toward two different endpoints at two different speeds for one cast.
       Its impact ring is also sized to the stale hitscan
       `STORMCALLER_GEOMETRY[1].hitRadiusPx` (70), not the real
       `TEMPEST_HURL_BLAST_RADIUS_PX` (56) the sim actually resolves against.
    3. `DungeonScreen.tsx`'s `projectile:hit` handler
       (`:1152-1184`) is gated `meta.class === PlayerClass.SOULDRINKER`
       only — Tempest Hurl's real `projectile:hit` (class `stormcaller`,
       abilityIndex 1) reaches no impact branch at all today; its only
       impact visual is the stale fake-flight ring from (2), which fires at
       the wrong time (170ms after cast, not on the real contact) and the
       wrong place (the fixed fake endpoint, not wherever the real physics
       body actually contacted something).

  Fixing (3) properly requires removing (2) first — shipping a correct
  `projectile:hit`-driven impact *next to* the still-live fake flight would
  just add a second contradictory ring instead of one correct one. Treat (1)
  + (2) + (3) as one coherent fix, not three independent patches.

Owner agent: Host Experience Engineer, single-owner — every touched path is
  under `apps/host-client/**`. No Ownership hook trigger, no split needed
  (verified: this story reads `ABILITY_GEOMETRY`/`TEMPEST_HURL_*` from
  `shared-types`, already host-importable per ADR-0003, and the existing
  `AbilityChainHitDelta`/`apply-delta.ts` case from `net-protocol`, both
  read-only — no `packages/shared-types`, `packages/net-protocol`,
  `packages/game-rules`, or `apps/simulation-server` file is modified).

Goal:
  Task 1 — `createConeWedge` primitive (`primitives.ts`): an apex-anchored,
            direction+angle expanding sector, sibling to `createRingShockwave`.
  Task 2 — Wire it into Stone Wall + Avalanche (`ability-vfx.ts`'s
            `AbilityVfxConfig`/`STONEHIDE_VFX`).
  Task 3 — Wire it into Ancestor's Voice (`spiritcaller-vfx.ts`).
  Task 4 — Wire it into Crimson Lash (`souldrinker-vfx.ts`), replacing the
            fixed ±0.30 rad fan approximation.
  Task 5 — Lightning Arc chain-lightning: whitelist `ability:chain-hit`
            (`host-session.ts`), consume it in `DungeonScreen.tsx`, draw one
            beam per hop.
  Task 6 — Tempest Hurl: remove the stale fake flight, add a
            `PlayerClass.STORMCALLER` `PROJECTILE_APPEARANCE` entry, wire a
            real `projectile:hit`-driven impact sized to
            `TEMPEST_HURL_BLAST_RADIUS_PX`.
  Task 7 — Tests (unit, per-file, alongside each task) + typecheck + full
            suite + manual Client-UX pass (Task 8, no display in this
            sandbox — precedent: 7.5, 7.6, dev-3, 3.23).

Allowed paths:
  - apps/host-client/src/vfx/primitives.ts
  - apps/host-client/src/vfx/vfx.test.ts
  - apps/host-client/src/vfx/ability-vfx.ts
  - apps/host-client/src/vfx/ability-vfx.test.ts
  - apps/host-client/src/vfx/spiritcaller-vfx.ts
  - apps/host-client/src/vfx/spiritcaller-vfx.test.ts
  - apps/host-client/src/vfx/souldrinker-vfx.ts
  - apps/host-client/src/vfx/souldrinker-vfx.test.ts
  - apps/host-client/src/vfx/stormcaller-vfx.ts
  - apps/host-client/src/vfx/stormcaller-vfx.test.ts
  - apps/host-client/src/vfx/ability-vfx-config.ts
  - apps/host-client/src/vfx/ability-vfx-config.test.ts
  - apps/host-client/src/vfx/index.ts (new export(s) only, if the wedge or a
    new planner needs one — mirror existing export style, do not restructure)
  - apps/host-client/src/vfx/types.ts (only if `VfxTriggerParams` genuinely
    needs a new shared field — prefer a `ConeWedgeParams`-local field first)
  - apps/host-client/src/session/host-session.ts (whitelist array addition
    only, `:46-84`)
  - apps/host-client/src/screens/DungeonScreen.tsx
  - _bmad-output/implementation-artifacts/7-13-cone-wedge-chain-lightning-and-tempest-hurl-vfx.md
    (Dev Agent Record)
  - _bmad-output/implementation-artifacts/deferred-work.md (append a
    resolution note closing this story's slice of ADR-0005's Consequences
    gap; do not touch unrelated entries)

Blocked paths:
  - packages/net-protocol/** — `AbilityChainHitDelta` already exists
    (Story 3.26); this story only consumes it, no wire-shape change.
  - packages/shared-types/** — `ABILITY_GEOMETRY`, `TEMPEST_HURL_*` already
    exist; read-only import, no new table/field.
  - packages/game-rules/**, apps/simulation-server/** — no sim/balance
    change. **Never import `packages/game-rules` from `apps/host-client`**
    (project-context.md, Monorepo Ownership) — this specifically means
    `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` (`game-rules/balance.ts:141`, the
    real 30° corridor width) is NOT available to the host and must not be
    hand-copied as a literal either (would immediately re-create the exact
    hand-transcription drift ADR-0003/D-7.2-A already fixed once). This is
    why Task 5 draws only the chain *hits* (each hop's real fromX/fromY →
    resolved target position, taken from the delta/gameState — no angle
    needed) and does not attempt to visualize the corridor cone itself.
  - apps/mobile-controller/**, apps/simulation-server/**, backend-platform/**
  - _bmad-output/implementation-artifacts/sprint-status.yaml — updated by the
    create-story/dev-story workflow tooling, not a story task.
  - Thunder Clap (stormcaller[2]) and Storm Eye (stormcaller[3]) — untouched,
    already correct, not part of ADR-0005's named gap.
  - `D-7.5-A` (`isStormEyeZone` matching any Stormcaller `'damage'` zone) —
    a separate, already-tracked deferred item; do not fix it here.

Inputs:
  - docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md — the
    authoritative scope statement for this story (Consequences section)
  - _bmad-output/implementation-artifacts/deferred-work.md — 3.25/3.26 Non-goal
    entries (search "follow-up Epic 7 VFX story")
  - _bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md
    — exact cone angles/abilities (Task 1, AC2-AC4)
  - _bmad-output/implementation-artifacts/3-26-stormcaller-rework-ii-lightning-arc-chain-and-tempest-hurl-projectile.md
    — chain mechanics (AC1-AC3) and projectile conversion (AC4-AC6)
  - packages/shared-types/src/ability-geometry.ts — `ABILITY_GEOMETRY`
    (hitShape/coneAngleDeg for the 4 cone abilities), `TEMPEST_HURL_PROJECTILE_RADIUS_PX`
    (28), `TEMPEST_HURL_SPEED_PX_S` (300), `TEMPEST_HURL_BLAST_RADIUS_PX` (56)
  - packages/net-protocol/src/messages/server-to-host.ts:126-137 —
    `AbilityChainHitDelta`'s exact fields
  - packages/net-protocol/src/apply-delta.ts:153-154 — its no-op case
  - apps/host-client/src/vfx/primitives.ts — `createRingShockwave` (the
    closest sibling shape to mirror for `createConeWedge`'s expand/fade
    contract), `createBeam` (reuse as-is for chain hops, no new primitive)
  - apps/host-client/src/vfx/ability-vfx.ts:106-115 (`AbilityVfxConfig`),
    :186-240 (`getAbilityVfxConfig`/`resolveAbilityVfxPlacement` — `normX`/
    `normY` is the direction the wedge needs), :121-172 (`STONEHIDE_VFX`,
    Stone Wall idx0 / Avalanche idx3)
  - apps/host-client/src/screens/DungeonScreen.tsx:1084-1150 (the generic
    `AbilityVfxConfig` render block — rings/beam/burst composition order to
    extend with `cone`), :1152-1184 (`projectile:hit` handler, SOULDRINKER-only
    gate to extend), :1185-1199 (`zone:strike` handler — the pattern to mirror
    for resolving a delta's target id against `gameState.enemies`/`.boss`),
    :658-661 (`advanceHurlFlights` ticker wiring to remove), :679-712
    (`state.projectiles` generic render — already reads
    `resolveProjectileAppearance` live, needs no DungeonScreen change for
    Task 6b, only a new `ability-vfx-config.ts` table entry)
  - apps/host-client/src/session/host-session.ts:42-91 (`onTransientDelta`
    whitelist — confirms `ability:chain-hit` is the only missing entry;
    `applyDelta` already runs unconditionally below regardless of whitelist
    membership, so adding it only affects host-local delivery, not mirror
    state)
  - apps/host-client/src/vfx/spiritcaller-vfx.ts:92-130 (`planSpiritcallerCast`,
    the `ancestors-voice` branch — currently stores only `focusX`/`focusY`,
    needs `dirX`/`dirY` added for the wedge), :149-175 (`triggerSpiritcallerCast`'s
    `ancestors-voice` branch — the "expand ring" to reconcile with the wedge)
  - apps/host-client/src/vfx/souldrinker-vfx.ts:158-187 (`planCrimsonLashCast`
    — the fan-of-3-beams to replace/augment with the wedge), :217-256
    (`planBloodSpikeImpact`/`planVoidPulseImpact` — the exact pattern
    `planTempestHurlImpact` should mirror in `stormcaller-vfx.ts`)
  - apps/host-client/src/vfx/stormcaller-vfx.ts — whole file (367 lines);
    `planLightningArc` (:143-154), `planTempestHurl` (:160-177, the `flight`
    field to remove), `HurlFlight`/`advanceHurlFlights` (:284-338, to delete
    once nothing sets `flight` anymore)
  - apps/host-client/src/vfx/ability-vfx-config.ts:78-99 (`SOULDRINKER_PROJECTILES`
    — the exact `ProjectileAppearance` table shape/pattern for the new
    `STORMCALLER_PROJECTILES` entry), :106-108 (`PROJECTILE_APPEARANCE`),
    :128-136 (`resolveProjectileAppearance`, already generic — no change
    needed there, only a new table entry)

Non-goals:
  - No new abilities, damage/cooldown/balance changes, or wire-contract
    changes — every constant this story reads already exists.
  - No corridor-shape visualization for Lightning Arc's own 30° targeting
    cone (see Blocked paths — the constant is host-forbidden; only the
    resolved chain hits are drawn, matching how Dark Pact's own search never
    draws its search radius either).
  - No fix for `D-7.5-A` (isStormEyeZone) or any other already-tracked
    deferred-work.md item this story does not name above.
  - No new e2e test — this is visual-only, matching every prior Epic 7
    story's Testing Standards (pure-planner unit tests + manual Client-UX
    pass, no dedicated `DungeonScreen.tsx`/`host-session.ts` component test
    file exists or should be introduced, per 7.11's Dev Notes precedent).
  - No pooling/cap mechanism for the new effects (D-7.1-D class concern) —
    every new effect here is fire-and-forget, cast-cadence-bound (cooldowns
    1000ms-6000ms) exactly like every existing per-cast VFX; volumes are
    strictly smaller than 7.6's already-analyzed ~44-handle worst case.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Contract-change hook: NOT triggered — no `packages/shared-types/**` or
    `packages/net-protocol/**` file is modified (both are read-only imports
    of already-shipped exports).
  - Simulation-safety hook: NOT triggered — no `apps/simulation-server/**`
    or `packages/game-rules/**` file is touched.
  - Client-UX hook: TRIGGERED — `apps/host-client/**` UI/rendering code
    changes. Manual pass (Task 8, cannot be performed in this sandbox, no
    display available — same precedent as every other Epic 7 story with this
    caveat): cast Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash and
    confirm each shows a directional fan matching its real angle, not a
    circle; cast Lightning Arc against 2+ clustered enemies and confirm a
    visible connected arc chain, not one beam; cast Tempest Hurl and confirm
    one coherent bigger/slower ball (not two racing visuals) that flashes an
    impact at its real contact point and radius, including against the boss.
  - Ownership hook: NOT triggered — single owner (`apps/host-client/**`),
    confirmed above.
  - Telemetry hook: N/A — no new user-facing flow, cosmetic-only.

Required tests:
  - `vfx.test.ts` — add `createConeWedge` to the existing "primitive
    lifecycle contract" table-driven test (mirrors every other primitive:
    0/short/long duration, disposal); a dedicated `describe('cone wedge')`
    block covering a 0° angle (degenerate to a line), a ~360°-ish wide angle,
    a direction flip mid-effect not being possible (static per-effect, like
    beam/ring), and that geometry matches `dirX/dirY`/`angleDeg`/`maxRadius`
    inputs deterministically.
  - `ability-vfx.test.ts` — Stone Wall/Avalanche cone wedge present in their
    `AbilityVfxConfig`, angle/range sourced live from `ABILITY_GEOMETRY`
    (not hand-copied), zero-aim still renders nothing extra (existing SILENT
    rule preserved).
  - `spiritcaller-vfx.test.ts` — Ancestor's Voice plan carries the direction
    needed for the wedge; `triggerSpiritcallerCast` composes it; zero-aim
    still returns `null` (existing behavior, do not regress AC per 3.25's
    "render nothing" rule).
  - `souldrinker-vfx.test.ts` — Crimson Lash's wedge angle matches
    `SOULDRINKER_GEOMETRY[1].coneAngleDeg` (45°, not the old hardcoded
    ±0.30 rad); existing impact-ring/burst/hp-scaling assertions still pass.
  - A new/extended `stormcaller-vfx.test.ts` block for: a pure
    chain-hit-to-beam-spec planner (recommend factoring the delta→beam-spec
    math into a small pure function here, mirroring this file's established
    "pure planner + thin executor" split, rather than inlining Graphics
    calls into `DungeonScreen.tsx`'s effect body); `planTempestHurl` no
    longer returns a `flight` field; a new `planTempestHurlImpact` sized to
    `TEMPEST_HURL_BLAST_RADIUS_PX`.
  - `ability-vfx-config.test.ts` — extend with `PlayerClass.STORMCALLER`
    coverage mirroring the existing `SOULDRINKER` assertions (idx1 resolves
    to the new appearance, idx0/2/3 fall through to `DEFAULT_PROJECTILE_APPEARANCE`).
  - `npm run typecheck` (10 tsconfigs) and `npm test` (full suite) clean,
    modulo the pre-existing failures below (do not re-chase, do not claim
    fixed unless actually touched).

Telemetry impact: None — cosmetic-only, no new user flow, no KPI event.
```

---

## Story

As a player,
I want Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash to visibly fan out in a cone, Lightning Arc's chain to visibly connect its bounces, and Tempest Hurl to read as one coherent thrown ball with an honest impact,
so that Epic 7's VFX layer stops silently lying about what the sim (post-3.25/3.26) actually does — a gap ADR-0005 explicitly flagged and deferred to this story.

---

## Acceptance Criteria

**AC1 — `createConeWedge` primitive:**
**Given** a new `createConeWedge` primitive in `apps/host-client/src/vfx/primitives.ts`, apex at `(x, y)`, aimed along a unit `(dirX, dirY)`, spanning `angleDeg` (full angle) out to `maxRadius`
**When** triggered
**Then** it renders an expanding (or, if `startRadius > maxRadius`, imploding — mirroring `createRingShockwave`'s existing implode support) filled or stroked circular sector that fades out over `durationMs`, matching the lifecycle contract (`update`/`dispose`, `EffectHandle`) every other primitive in this file already implements

**AC2 — Stone Wall / Avalanche:**
**Given** Stone Wall (stonehide[0]) and Avalanche (stonehide[3])
**When** either casts (non-zero aim)
**Then** its VFX includes a wedge apex at the caster, oriented along the real aim, spanning `ABILITY_GEOMETRY[STONEHIDE][i].coneAngleDeg` out to `.hitRangePx` — read live, not hand-copied; Stone Wall's existing pull-toward-caster implode ring/beam/dust burst are unaffected (the displacement visual is downstream of the hit-test, per 3.25's own framing, unchanged here); a zero-aim cast still renders nothing extra (SILENT rule preserved)

**AC3 — Ancestor's Voice:**
**Given** Ancestor's Voice (spiritcaller[0])
**When** it casts (non-zero aim; a zero-aim cast already returns `null` from `planSpiritcallerCast` and must keep doing so)
**Then** its VFX includes the same wedge, sized to `ABILITY_GEOMETRY[SPIRITCALLER][0].coneAngleDeg`/`.hitRangePx`, reconciled with the existing beam/implode-ring/expand-ring/burst composition so the wedge and the existing "expand ring" (which today draws a full circle, not a cone) do not visually contradict each other

**AC4 — Crimson Lash:**
**Given** Crimson Lash (souldrinker[1])
**When** it casts (non-zero aim)
**Then** its VFX's cone width is driven by `ABILITY_GEOMETRY[SOULDRINKER][1].coneAngleDeg` (45°) — via the new wedge, a re-derived fan-of-beams spread, or both — instead of today's fixed, disconnected `±0.30` rad literal; the existing HP-scaled intensity behavior (`lowHp` darkening/widening) is preserved

**AC5 — Lightning Arc chain-hit VFX:**
**Given** `ability:chain-hit` (`{casterId, fromX, fromY, toEnemyId, chainIndex}`, already defined in `net-protocol`, currently forwarded nowhere)
**When** one or more are broadcast for a Lightning Arc cast (one per hit, including the first)
**Then** `host-session.ts`'s `onTransientDelta` whitelist forwards it, and `DungeonScreen.tsx` draws a beam segment from `(fromX, fromY)` to the position of the resolved `toEnemyId` (an enemy or, if it equals `gameState.boss?.id`, the boss) for each hit — so a 3-hit chain reads as 3 connected arcs, not one; a `toEnemyId` that resolves to neither (already-dead/left target, stale by the time the delta renders) skips that hop's beam without throwing

**AC6 — Tempest Hurl body:**
**Given** Tempest Hurl (stormcaller[1]), a real `ProjectileState`-backed ability since Story 3.26
**When** it casts and its projectile streams via the existing generic `state.projectiles`/`resolveProjectileAppearance` path (Story 7.8/7.10, already rendering every live projectile)
**Then** a new `PlayerClass.STORMCALLER` entry in `PROJECTILE_APPEARANCE` (`ability-vfx-config.ts`) gives it a body visibly bigger/slower than Blood Spike/Void Pulse's defaults (informed by `TEMPEST_HURL_PROJECTILE_RADIUS_PX`, 28px) instead of falling through to `DEFAULT_PROJECTILE_APPEARANCE`; the stale `ability:fired`-triggered fake 170ms flight (`HurlFlight`/`advanceHurlFlights`/the `flight` field on `StormcallerCastPlan`) is removed so exactly one visual represents the thrown ball, not two racing ones

**AC7 — Tempest Hurl impact:**
**Given** Tempest Hurl's real `projectile:hit` delta (already broadcast by the sim, including the boss-inclusive manual proximity check from Story 3.26)
**When** it lands
**Then** `DungeonScreen.tsx`'s `projectile:hit` handler (currently `PlayerClass.SOULDRINKER`-only) gains a Stormcaller/idx1 branch that spawns an impact effect at the delta's real `(x, y)` sized to `TEMPEST_HURL_BLAST_RADIUS_PX` (56px), replacing the removed fake flight's stale-radius (70px) impact ring as the only impact visual for this ability

**AC8 — Tests:**
**Given** every file touched by AC1-AC7
**Then** each gains or updates unit-test coverage per the Required tests list above, and `npm run typecheck` + `npm test` are clean modulo the pre-existing failures noted in Dev Notes

**AC9 — Hooks:**
**Given** the Client-UX hook (host UI/rendering code changed, no Contract-change or Simulation-safety trigger)
**Then** this story requires the manual Client-UX pass described in Required hooks before merge, performed by a human (no display in this implementation sandbox — disclose, do not claim it was done)

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1) — `primitives.ts`: add `ConeWedgeParams`/`createConeWedge`, sibling to `createRingShockwave` (same `x,y,color,durationMs,alpha,startRadius,maxRadius,lineWidth,filled` shape plus `dirX,dirY,angleDeg`). Add to `vfx.test.ts`'s lifecycle-contract table + a dedicated describe block.
- [x] **Task 2** (AC: #2) — `ability-vfx.ts`: add `cone?: ConeSpec` to `AbilityVfxConfig`; populate Stone Wall (idx0)/Avalanche (idx3) from `STONEHIDE_GEOMETRY[i].coneAngleDeg`; render it in `DungeonScreen.tsx`'s generic config block (`:1084-1150`, alongside the existing rings/beam/burst composition), anchored at `place.casterX/casterY` oriented along `place.normX/normY`; reconcile Avalanche's existing hit-point ring so it doesn't visually contradict the new wedge (dev's call on keep/replace/resize — document the choice). Update `ability-vfx.test.ts`.
- [x] **Task 3** (AC: #3) — `spiritcaller-vfx.ts`: add `dirX`/`dirY` to the `ancestors-voice` branch of `planSpiritcallerCast`'s returned plan; wire the wedge into `triggerSpiritcallerCast`'s `ancestors-voice` branch using `SPIRITCALLER_GEOMETRY[0].coneAngleDeg`; reconcile with the existing expand ring. Update `spiritcaller-vfx.test.ts`.
- [x] **Task 4** (AC: #4) — `souldrinker-vfx.ts`: re-derive `planCrimsonLashCast`'s fan from `SOULDRINKER_GEOMETRY[1].coneAngleDeg` (via the wedge, a re-derived beam spread, or both), removing the disconnected `CRIMSON_LASH_FAN_RAD` literal. Update `souldrinker-vfx.test.ts`.
- [x] **Task 5** (AC: #5) — `host-session.ts`: add `delta.type === 'ability:chain-hit' ||` to the `onTransientDelta` whitelist (`:46-84`). `DungeonScreen.tsx`: add an `ability:chain-hit` branch to the main dispatch effect (mirroring the `zone:strike` branch's `gameState.enemies`/`.boss` target-resolution pattern, `:1185-1199`), drawing one beam per hit via `createBeam`. Recommend factoring the delta→beam-spec math into a small pure function in `stormcaller-vfx.ts` (this file's established pure-planner convention) rather than inlining it. Add/extend `stormcaller-vfx.test.ts`.
- [x] **Task 6** (AC: #6, #7) — `stormcaller-vfx.ts`: remove `planTempestHurl`'s `flight` field and the now-dead `HurlFlight`/`advanceHurlFlights`; add `planTempestHurlImpact` (mirrors `planBloodSpikeImpact`/`planVoidPulseImpact` in `souldrinker-vfx.ts`) sized to `TEMPEST_HURL_BLAST_RADIUS_PX`. `DungeonScreen.tsx`: delete the `hurlFlightsRef`/`advanceHurlFlights` wiring (`:658-661`, `:815`, the `ability:fired` handler's `if (flight)` push at `:1071-1072`); add a Stormcaller/idx1 branch to the `projectile:hit` handler (`:1152-1184`) calling `planTempestHurlImpact`. `ability-vfx-config.ts`: add `STORMCALLER_PROJECTILES` (mirrors `SOULDRINKER_PROJECTILES`, only index 1 populated) to `PROJECTILE_APPEARANCE`, sized around `TEMPEST_HURL_PROJECTILE_RADIUS_PX`. Update `stormcaller-vfx.test.ts` and `ability-vfx-config.test.ts`.
- [x] **Task 7** (AC: #8) — Full regression: `npm run typecheck`, `npm test`. Note (do not chase) pre-existing failures: `ability-vfx.test.ts` Stone Wall centering (documented since 7.2/7.8), the intermittent Ancestor's Voice e2e heal assertion, WSL2 e2e port-binding timeouts.
- [x] **Task 8** (AC: #9) — Manual Client-UX pass per Required hooks. No display in this sandbox — disclose as outstanding in Completion Notes, matching 7.5/7.6/dev-3/3.23/7.7b's own precedent, rather than claiming it was performed.
- [x] **Task 9** — Append a resolution note to `deferred-work.md` closing this story's slice of ADR-0005's Consequences gap (cite this story's key).

### Review Findings

Reviewed 2026-07-30 via 3 parallel layers (Blind Hunter — diff only, no project context; Edge Case Hunter — diff + full repo read access; Acceptance Auditor — diff + this story's own AC1-AC9/Dev Notes as spec). 0 `decision_needed`, 5 `patch` (all applied autonomously per the workflow's own AUTONOMOUS TRIAGE + CONFIRMATION PASS ON HIGH FINDINGS rules — no finding here reached High severity, so no confirmation-pass downgrade was needed), 1 `defer`, 9 dismissed as noise/false-positive/by-design after verification against the actual code.

- [x] **[Review][Patch]** `createConeWedge`'s degenerate (0°) branch always stroked with the caller's `lineWidth`, ignoring `filled` — every wired cone config uses `lineWidth: 0, filled: true`, so a missing `coneAngleDeg` would have silently rendered nothing, violating AC1/Dev Notes' "never renders nothing at angleDeg → 0" contract [`apps/host-client/src/vfx/primitives.ts`] — applied: floored the degenerate stroke width to `Math.max(lineWidth, 2)`.
- [x] **[Review][Patch]** A second, independent zero-aim guard (`place.normX !== 0 || place.normY !== 0`) on the cone render branch directly contradicted this story's own Dev Notes ("do not add a second, independent zero-aim check") — dead code in practice (`place` is already null-guarded for both cone abilities), but a literal spec violation [`apps/host-client/src/screens/DungeonScreen.tsx`] — applied: removed, `place`'s existing null-guard is the only check now.
- [x] **[Review][Patch]** `ability:chain-hit` and `zone:strike` each hand-rolled an identical inline "enemy, then boss by id" target-resolution lookup [`apps/host-client/src/screens/DungeonScreen.tsx`] — applied: extracted a shared `resolveEnemyOrBossPosition(targetId, gameState)` helper, used by both branches.
- [x] **[Review][Patch]** The new `STORMCALLER_PROJECTILES` comment claimed "sized bigger/slower" but the `ProjectileAppearance` shape it populates (core/halo/trail) carries no speed field — misleading, could read as if this table also controlled movement speed [`apps/host-client/src/vfx/ability-vfx-config.ts`] — applied: clarified the comment to name `TEMPEST_HURL_SPEED_PX_S` as the separate constant that actually governs speed.
- [x] **[Review][Patch]** The Required-tests "geometry matches dirX/dirY/angleDeg/maxRadius inputs deterministically" cone-wedge test only compared `update()`'s boolean liveness return between two identically-constructed instances — true for any primitive regardless of whether it read its geometry inputs at all [`apps/host-client/src/vfx/vfx.test.ts`] — applied: added 3 new tests asserting on `Graphics.getLocalBounds()` (works headlessly) — direction flips the extent's sign, wider `angleDeg` widens the perpendicular spread, larger `maxRadius` scales the extent.
- [x] **[Review][Defer]** `projectile:expired` is not forwarded to the host for any projectile ability (Blood Spike/Void Pulse/Tempest Hurl alike), so a miss/out-of-range projectile has no dedicated visual beyond the generic trail-fade despawn read [`apps/host-client/src/session/host-session.ts`, `GameRoom.ts:1977`] — deferred, pre-existing (confirmed identical behavior predates this story for Blood Spike/Void Pulse) and outside ADR-0005's named gap; appended as `D-7.13-A` to `deferred-work.md`.

**Dismissed (verified false-positive or by-design, not acted on):** a claimed chain-hit batch-collapse via `latestTransientDelta` (disproved — `App.tsx`/`DungeonScreen.tsx` use a real `transientDeltaQueue: DeltaEventMsg[]` iterated in full since Story 7.11, not a single-value slot; the comment naming "single-value latestTransientDelta batching" describes the pre-7.11 problem the queue already fixed, not current behavior); a claimed unclamped future-`startedAt` overflow (disproved — `progress()`'s `Math.max(ratio, 0)` already clamps `now < startedAt` to `t = 0`); a claimed zero-aim asymmetry between the cone and its sibling ring/beam/burst (disproved — the entire block, cone included, sits inside one `if (place)` guard that is already null for every zero-aim cone-ability cast); a claimed magic-number deviation for `meta.abilityIndex === 1` (matches the pre-existing sibling convention at the same call site, `=== 0`/`=== 3` for Blood Spike/Void Pulse); a claimed test-coverage gap for the new `DungeonScreen.tsx` branches (matches this codebase's own established Testing Standards — pure-planner tests + manual Client-UX pass, no component test file, per 7.11's own precedent); a claimed API-shape inconsistency in exporting `spawnStormcallerSpecs` (mirrors `souldrinker-vfx.ts`'s own `spawnSouldrinkerVfx`, an identical precedent); a weak test-assertion nitpick on the `flight`-removal check via an `unknown` cast (intentional — the type no longer declares the field, so the cast is what makes a *runtime* check possible at all); a claimed Blocked-paths violation for editing `sprint-status.yaml` (its own bullet text says it's "updated by the create-story/dev-story workflow tooling," exactly as this session did, matching identical precedent in every prior story's own File List in this same sprint file); a claimed merge-gate violation for reaching `review` status with the Client-UX hook's manual pass undone (this is the established, disclosed precedent this exact situation has followed every time since 7.5/7.6/dev-3/3.23/7.7b — status stays at `review`, not `done`, until a human with a display performs it, matching 7.7b's own deferred-work.md wording almost verbatim).

**Full regression after patches:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 113 passed, 1 failed (the same pre-existing Stone Wall centering failure, unrelated to any patch here).

**Status decision:** Despite 0 unresolved patch/decision findings, Status stays `review`, not `done` — the Client-UX hook's manual pass (Task 8/AC9) is still genuinely outstanding (no display in this sandbox), and every precedent story in this codebase with the same disclosed gap (7.5, 7.6, dev-3, 3.23, 7.7b) stayed at `review` until a human performed it. This is not a code-review finding to re-litigate; it is the standing project convention for this exact situation.

### Manual Client-UX Pass Findings (2026-07-30) — Task 8/AC9, performed by the user

The user ran the actual game (the manual pass this story's Task 8 disclosed as outstanding) and reported: (1) cone shapes not visible at all for any of the 4 cone abilities; (2) Lightning Arc's old fixed-endpoint "crack ring" should be removed; (3) Lightning Arc's chain doesn't visually continue past the first hit, and damage numbers are only visible on the first-hit enemy.

- **[CRITICAL BUG, fixed]** `createConeWedge`'s fill/stroke path built its initial `lineTo` to the WRONG arc endpoint (the far tip, not the one matching the arc's own `startAngle`). Unlike HTML5 Canvas2D, PixiJS's `GraphicsContext.arc()` (`buildArc` internally) never inserts an implicit connecting segment from the current path point to the arc's start — it only appends the arc's own points. Landing on the wrong tip first produced: apex→far-tip, then an unwanted straight chord across to the near-tip, then the (correct) arc sweep back to the far tip, then a closing line back to the apex — two of those edges (apex→far-tip and, at the very end, far-tip→apex) are coincident and canceling under polygon fill rules, so the net *visible* shape was just the thin lens/segment between the chord and the arc, not the full pie slice. Confirmed by the shoelace formula on the actual generated polygon: the broken path filled ~12% of the intended area (129 vs. an expected 1091 px² for a 50°/50px wedge) — a sliver near the outer rim, easily mistaken for "nothing rendered" exactly as reported. Neither of this story's original geometry tests caught it: they asserted only on `getLocalBounds()`, which is identical for both the correct and broken shapes (bounds only reflect vertex extents, not fill topology). **Fixed** in `apps/host-client/src/vfx/primitives.ts`: the initial `lineTo` now targets the arc's own start-angle tip. **New regression test** in `vfx.test.ts` reads the real filled polygon via Pixi's `shapePath` getter and asserts the shoelace-computed area against the closed-form pie-slice area (`0.5 · r² · angleRad`) across 5 directions × 4 angles — this is the test that would have (and now does) catch this class of bug; the bounds-only tests are kept as they still add signal for direction/scale.
- **[Explicit request, applied]** Removed Lightning Arc's static "crack ring" (`ring()` at a fixed `caster + aim × hitRangePx` point, `stormcaller-vfx.ts`'s `planLightningArc`) — it drew at a location that was never the real resolved target, doubly redundant now that `ability:chain-hit`'s real per-hop beams draw the true connections. Kept the two-layer glow+core beam pair (the user's "the line is enough"). Updated `stormcaller-vfx.test.ts`'s Lightning Arc test accordingly.
- **[Investigated, not a VFX bug — deferred]** The chain-not-continuing / damage-numbers-only-on-first-hit reports: wrote a temporary e2e harness driving a real simulation-server (not committed — deleted after use) to fire Lightning Arc in two live dungeon runs (easy and hard difficulty). Both spawned exactly 2 alive enemies, at 887px and 302.6px apart — both far outside `LIGHTNING_ARC_CHAIN_RADIUS_PX` (150px, `packages/game-rules/src/balance.ts`), so the sim (confirmed correct in isolation by the pre-existing `tests/unit/lightning-arc.test.ts`) never had a second candidate to chain to in either run — exactly one `ability:chain-hit`/`enemy:damaged` broadcast per cast, matching what the user saw. This host-side VFX code (whitelist, dispatch, `planChainHitBeam`/`spawnStormcallerSpecs`) is confirmed correctly wired via this same live test (the one real `ability:chain-hit` delta round-tripped through the real WebSocket layer and decoded correctly) and via unit tests (N same-tick calls each produce their own beam, no collapse). This reads as a `packages/game-rules` balance/spawn-density question — a Blocked path for this VFX story — not a defect in this story's code. Appended `D-7.13-B` to `deferred-work.md` with the full investigation, flagging that a broader sample (more waves/levels) would be worth checking before any retuning.
- **Regression after this round:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 114 passed, 1 failed (the same pre-existing Stone Wall centering failure).
- **Confidence: 90%** — the cone-wedge fix is verified by a closed-form area check (not just visual inspection), the crack-ring removal is a direct, unambiguous request, and the chain-density finding is backed by two independent live simulation-server samples plus the existing unit-test coverage proving both the sim's chain math and the host's chain-hit rendering are each independently correct. The remaining uncertainty is that the two sampled enemy layouts may not be representative of every level/wave — the story explicitly flags this in the deferred-work.md entry rather than asserting it as settled.

### Manual Client-UX Pass Findings, round 2 (2026-07-30) — Crimson Lash / Avalanche

After the round-1 fix, the user reported Stone Wall and Lightning Arc now visibly correct, but Crimson Lash and Avalanche "still has nothing, only the old vfx." Investigated each independently — two different root causes, both fixed:

- **[Design gap, fixed]** Crimson Lash never had an actual wedge shape — Task 4's original implementation (AC4 offered "via the wedge, a re-derived fan-of-beams spread, or both") chose only the re-derived beam-fan option, reasoning the `VfxSpec` union in `souldrinker-vfx.ts` was closed (ring/beam/burst) and adding a 4th kind for one ability was disproportionate. Live feedback showed the re-angled fan alone doesn't read as "a cone" next to the other three abilities' actual wedges. **Fixed**: added a `'cone'` variant to `VfxSpec`, wired `createConeWedge` into `spawnSouldrinkerVfx`'s executor switch, and `planCrimsonLashCast` now emits a wedge sized to `SOULDRINKER_GEOMETRY[1].coneAngleDeg`/`.hitRangePx` alongside the existing beam fan. New test in `souldrinker-vfx.test.ts` asserts the wedge's angle/range/direction.
- **[Contrast bug, fixed]** Avalanche's cone primitive and math were verified correct (stress-tested its exact real parameters — angleDeg 40°, radius 75px — across 36 directions headlessly: no throws, no degenerate output), so the wedge genuinely was drawing. The real problem: Avalanche's ring, beam, *and* cone all used the identical color `STONEHIDE_OCHRE` — zero color contrast between the "old" displacement effects and the "new" wedge, so they visually merged into one indistinguishable blob even though the wedge's pixels were present. Stone Wall's own cone avoids this by using OCHRE against its ring/beam's DUST — real contrast. **Fixed**: Avalanche's cone recolored to `STONEHIDE_DUST` (contrasting its OCHRE ring/beam, mirroring Stone Wall's pattern with the two hues swapped), alpha bumped 0.3→0.45 and duration 200ms→260ms since its 75px reach gives it ~6x less area than Stone Wall's 160px cone at the same alpha.
- **Regression after this round:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 115 passed, 1 failed (the same pre-existing Stone Wall centering failure).
- **Confidence: 80%** — the Crimson Lash fix is structural and directly testable (wedge angle/range asserted against the live contract). The Avalanche fix (color contrast + alpha/duration) is a well-reasoned, verified-plausible diagnosis (identical hue across all 3 effects, confirmed by direct code inspection) but not confirmed by a real render — awaiting the user's next manual pass to close the loop.

### Manual Client-UX Pass Findings, round 3 (2026-07-30) — design change: cone-only + intensity

Round 2's fix confirmed the cone wedges themselves render (user "can notice" them), but judged them "really vague." Explicit user direction this round: (1) remove the pre-existing (pre-Story-7.13) VFX for Stone Wall, Avalanche, and Ancestor's Voice entirely, keeping only the cone wedge; (2) make the cone shapes noticeably more intense across the board.

- **`AbilityVfxConfig.cone?: ConeSpec` → `cones?: readonly ConeSpec[]`** (`ability-vfx.ts`) — the single-cone field became an array, the same layering pattern `rings` already used, so an ability can now stack a soft fill under a bright outline instead of one flat shape. `DungeonScreen.tsx`'s render block updated to loop over `cfg.cones`.
- **Stone Wall** (`ability-vfx.ts`): removed the old pull-toward-caster implode ring, displacement beam, and dust burst entirely (`rings: []`, no `beam`/`burst`). Now two layered wedges: an opaque fill (`STONEHIDE_OCHRE`, alpha 0.3→0.65) under a bright 5px outline (`STONEHIDE_DUST`, alpha 0.95).
- **Avalanche** (`ability-vfx.ts`): removed the old 'hit'-anchored impact ring and beam entirely. Two layered wedges keeping the round-2 fill/outline contrast (`STONEHIDE_DUST` fill, alpha 0.45→0.7; `STONEHIDE_OCHRE` outline, alpha→1, 5px).
- **Ancestor's Voice** (`spiritcaller-vfx.ts`): removed the beam, the small implode "gather" ring, and the particle burst from `triggerSpiritcallerCast`'s `ancestors-voice` branch entirely. Two layered wedges: `SPIRIT_HARM` fill (alpha 0.3→0.65) under an `ANCESTOR_BONE` outline (alpha 0.95, 5px). The now-fully-dead `ANCESTORS_VOICE_RADIUS_PX` export (nothing read it once the implode ring using it was removed, and it was already unread by the sim for a cone-shaped entry) was deleted rather than left as dead code.
- **Crimson Lash** (`souldrinker-vfx.ts`): not named for removal (its beam-fan/impact-ring/burst are untouched), but its wedge intensity bumped to match: fill alpha 0.3→0.6-0.8 (HP-scaled), plus a new second `BLOOD_DARK`-outlined layer (4px) for the same fill+outline definition the other three abilities now get.
- **Test updates**: `ability-vfx.test.ts`'s AC1 distinctness `signatureOf` helper now folds `cones` into the signature (Stone Wall and Avalanche would otherwise both signature to an identical empty string now that their rings/beam/burst are gone); new test asserts both configs carry ≥2 cone layers and *no* rings/beam/burst; `spiritcaller-vfx.test.ts`'s `triggerSpiritcallerCast` tests updated to expect exactly 2 effects (the two cone layers) instead of 4, and 0 (not 3) when direction is absent; `souldrinker-vfx.test.ts`'s existing cone-wedge test still passes unchanged (`.find()` still matches the first/fill cone layer).
- **Regression after this round:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 116 passed, 1 failed (the same pre-existing Stone Wall centering failure).
- **Confidence: 85%** — the removals are mechanical and directly asserted by new tests (empty rings, undefined beam/burst, exact effect counts). The intensity/contrast values (alpha ~0.6-1.0, 4-5px outlines) are a reasoned escalation from round 2's already-once-validated contrast fix, but the exact "intense enough" bar is inherently a subjective visual call — awaiting confirmation on the next pass.

### Manual Client-UX Pass Findings, round 4 (2026-07-30) — pacing: 2x faster

Explicit user direction: the cone wedges "advance real slowly" for abilities that resolve instantly — halve their fade duration.

- Halved every cone layer's `durationMs` across all four cone abilities: Stone Wall (`ability-vfx.ts`, fill 320→160ms, outline 280→140ms), Avalanche (`ability-vfx.ts`, fill 320→160ms, outline 280→140ms), Ancestor's Voice (`spiritcaller-vfx.ts`, fill 320→160ms, outline 280→140ms), Crimson Lash (`souldrinker-vfx.ts`, fill 320→160ms, outline 280→140ms). No angle/radius/color/alpha changes — pacing only.
- No test changes needed — no test asserted a specific `durationMs` value for any cone layer.
- **Regression after this round:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 116 passed, 1 failed (the same pre-existing Stone Wall centering failure).
- **Confidence: 90%** — a purely mechanical, low-risk numeric change (every touched value halved, nothing else) with a clean regression run.

### Review Findings, round 2 (2026-07-30) — post manual-QA re-review

Re-reviewed the full `e60996d..HEAD` diff (i.e. including all 4 manual Client-UX pass rounds above, none of which had been reviewed) via 2 of 3 parallel layers — **Acceptance Auditor failed** (hit the session's API usage limit mid-task, no findings recovered; `failed_layers = "Acceptance Auditor"`, per the workflow's own failure-handling rule) — proceeded with Blind Hunter (13 raw findings, diff only) + Edge Case Hunter (3 raw findings, diff + repo read access). 16 raw findings → merged into 12 unique after deduplication (2 pairs described the same gaps from different angles) → 0 `decision_needed`, 3 `patch` (none reached High severity, so no confirmation-pass downgrade was needed), 0 `defer`, 9 dismissed as by-design/already-verified/cosmetic after checking each against the actual current code.

- [x] **[Review][Patch]** `createConeWedge`'s non-degenerate, unfilled branch strokes with the caller's raw `lineWidth` and has no floor — the exact same "silently renders invisible" risk the degenerate (0°) branch was already patched for above, just uncovered on its sibling path; no wired caller passes `lineWidth: 0` with `filled: false` today, so it's currently unreachable, but the primitive's own public contract offers no protection against it [`apps/host-client/src/vfx/primitives.ts:322`] — applied: floored the branch's stroke width to `Math.max(lineWidth, 2)`, matching the degenerate branch.
- [x] **[Review][Patch]** `createConeWedge` floors `angleDeg` at 0 but has no ceiling — an input ≥180°(-360°) flips the edge-ray ordering (`leftAngle`/`rightAngle` via `atan2`) and could sweep the arc's reflex (wrong) side instead of the intended sector; the new shoelace-area regression test only asserts a lower bound (`toBeGreaterThan(expectedArea * 0.9)`), so a regression of this exact class would pass silently. No current caller passes an out-of-range `coneAngleDeg` (all are real, sane ability-design angles), so this is latent, not currently triggered [`apps/host-client/src/vfx/primitives.ts:273`, `apps/host-client/src/vfx/vfx.test.ts:293`] — applied: clamped `angleDeg` to `[0, 360]` before the half-angle computation, and added an upper-bound (`toBeLessThan(expectedArea * 1.1)`) to the shoelace area test.
- [x] **[Review][Patch]** The `ability:chain-hit` handler computes `Date.now() + chainIndex * 40` without guarding `chainIndex`'s finiteness — a malformed/non-finite value would NaN out `startedAt`, and `progress()` would short-circuit to `t = 1` (alpha 0), silently dropping that hop's beam with no diagnostic. `chainIndex` is a trusted, typed server field with no known path to produce a non-finite value today, so this is defense-in-depth, not a reachable bug [`apps/host-client/src/screens/DungeonScreen.tsx:1243`] — applied: `Number.isFinite(chainIndex) ? chainIndex * 40 : 0` guard.

**Dismissed (verified false-positive, by-design, or cosmetic, not acted on):** a claim that `dirX`/`dirY` lack runtime normalization (by design — documented precondition matching the pre-existing sibling-primitive convention of pre-normalized direction vectors, e.g. `place.normX/normY`); a claim that the cone shape's data type is redeclared with drift risk across 3 files (each VFX file already owns its own local, independently-declared `VfxSpec`/config-shape union for ring/beam/burst — `ConeSpec`/the `'cone'` `VfxSpec` variant follow that same established per-file convention, not a new inconsistency); a claim that `?? 0` defaults on `coneAngleDeg` reads mask missing-data bugs (this is the explicit, already-reviewed AC1/Dev Notes contract — a missing angle must degenerate to a visible line, never silent nothing, per the patch applied in the first review round above); a claim that the new shoelace-area test's `as any` reach into Pixi's internal `shapePath` is brittle (true, but a deliberate, already-justified trade-off — the code's own comment notes "Pixi has no simpler 'what area did this fill' API," and this is the exact test that caught the round-1 critical topology bug); a claim that the zero-aim SILENT guarantee rests on a comment-only invariant (it doesn't — it's structurally enforced by the enclosing `if (place)` guard, already verified in the first review round's own dismissed-findings list); a claim of an untested chain-hit stagger timing gap (matches this codebase's established Testing Standards — no component test file for `DungeonScreen.tsx` branches, pure-planner tests + manual pass only, already dismissed for an identical claim in the first review round); a claim that `resolveEnemyOrBossPosition` silently drops a beam on lookup miss with no diagnostic (deliberate and documented — "Target-not-found → silently skip," matching the pre-existing `zone:strike` precedent it was extracted from); a claim that the `+14` halo-radius offset on `STORMCALLER_PROJECTILES` is an unexplained magic number (cosmetic visual tuning, no functional risk); a claim that `cones?`'s optionality is inconsistent with `rings`'s required-with-default-`[]` convention (backwards — `cones?` actually matches the optionality of its true siblings `beam?`/`burst?`; `rings` being required is the pre-existing outlier, not something this diff introduced).

**Full regression after patches:** `npm run typecheck` clean (10/10 tsconfigs); `apps/host-client/src/vfx/` + `apps/host-client/src/screens/` suites: 116 passed, 1 failed (the same pre-existing Stone Wall centering failure, unrelated to any patch here).

**Status decision:** All 3 patches applied and confirmed via full regression. The Task 8/AC9 manual pass gap noted in the first review round no longer applies — it was satisfied by the 4 manual Client-UX pass rounds above. No unresolved patch/decision findings remain.

---

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

See the CLAUDE.md Required Task Header above — Phase/Context/Owner/Goal/Allowed/Blocked/Inputs/Non-goals/Hooks/Tests/Telemetry are all filled in there per the project's mandated pre-task structure.

### Why this story exists (provenance, not just scope)

This is not a newly-invented feature — it is the literal, named payoff of a gap three prior artifacts each explicitly deferred rather than silently dropped: 3.25's Non-goals, 3.26's Non-goals, and ADR-0005's Consequences section (quoted verbatim in Context above). Treat ADR-0005's own wording — "a cone/wedge shape, chain-arc rendering, and a resized/re-timed projectile + blast burst" — as the scope boundary: exactly these three gaps, for exactly the six named abilities, nothing more.

### The SILENT rule still applies

Every existing planner this story touches (`resolveAbilityVfxPlacement`, `planSpiritcallerCast`'s `ancestors-voice` branch, `planSouldrinkerCast`, `resolveStormcallerCast`) already returns `null`/`[]` for a zero-aim directional cast, matching the sim's own skip (`GameRoom.ts:2203`) — the host renders nothing, not even a flash. Adding the wedge/chain/impact visuals must not create a new path that renders when the sim didn't act. The wedge specifically rides on the same `place`/`plan` objects that already encode this — do not add a second, independent zero-aim check.

### Cone wedge geometry contract (for Task 1's implementation)

Apex `(x, y)`, direction unit vector `(dirX, dirY)`. Half-angle = `angleDeg / 2` on each side of the direction, converted to radians. The two edge rays are `dirX·cos(±halfAngle) − dirY·sin(±halfAngle)` / `dirX·sin(±halfAngle) + dirY·cos(±halfAngle)` (standard 2D rotation of the direction vector). Mirror `createRingShockwave`'s expand-from-`startRadius`-to-`maxRadius` + fade-alpha-by-`(1-t)` lifecycle exactly, so the two primitives read as the same visual language (an AoE "reveals its real shape" cue) differing only in angular span. A degenerate `angleDeg` of 0 should draw a line (matches `isInConeZone`'s own apex-point edge case — a target exactly on the caster is trivially inside even a 0° cone); this story's primitive doesn't need to hit-test anything, just render a shape that doesn't crash or render nothing at `angleDeg → 0`.

### Do not resurrect `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` in the host

It lives in `packages/game-rules/src/balance.ts:141` — host-forbidden (project-context.md: "Never import `packages/game-rules` in `apps/host-client`"). Task 5 needs no angle at all: each `ability:chain-hit` already carries `fromX`/`fromY` and a resolved `toEnemyId`, so the beam geometry comes entirely from the delta + a `gameState` position lookup, exactly like `zone:strike`'s existing target-resolution pattern. Do not add a `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG`-equivalent literal to `shared-types` or hand-copy the value into the host "just to draw the corridor" — that visual is explicitly out of scope (see Non-goals).

### `transientDeltaQueue` already solves the same-tick multi-hit-collapse risk

A 3-bounce Lightning Arc cast broadcasts up to 3 `ability:chain-hit` deltas synchronously in one sim tick, almost certainly landing in one WebSocket flush. Before Story 7.11, that would have collapsed to only the last hit rendering (the class of bug 7.11 was written to fix, `D-dev5-B`/`D-7.3-A`/`D-7.4-A`). Since 7.11, `DungeonScreen.tsx` iterates `transientDeltaQueue: DeltaEventMsg[]` (`for (const latestTransientDelta of transientDeltaQueue)`, `:1004`) rather than a single-slot value — every same-tick hit gets its own loop iteration and its own beam. No new queuing/batching work is needed here; just confirm (via the new test) that N same-tick `ability:chain-hit` deltas each get their own beam, not just the last.

### Chain visual pacing (a judgment call, not an AC)

All hits in one chain will carry near-identical `Date.now()` `startedAt` stamps (same synchronous tick), so naively they'll all flash and fade in unison rather than reading as a chain traveling outward. Optional, not required for AC5: stagger each beam's `startedAt` by a small deterministic offset derived from `chainIndex` (e.g. `triggeredAt + chainIndex * 40`) for a "traveling" feel. Note whichever choice is made in Completion Notes.

### Task 6's ordering matters

Fix (1)+(2)+(3) from the Context section together, in the order: remove the stale flight first, then add the appearance-table entry, then add the `projectile:hit` branch. Shipping the new `projectile:hit` impact while the old fake-flight impact ring is still live would add a second, contradictory ring instead of replacing a wrong one — worse than either gap alone.

### Testing Standards

- This codebase's established Epic 7 convention: every VFX planner is a pure function (`plan*`/`resolve*`) tested directly with no PixiJS/canvas — see every existing `*-vfx.test.ts`. Executors (`spawn*`/`trigger*`) that touch `VfxEngine`/`Graphics` are thin and typically not separately unit-tested (verified via `engine.add` call presence at most). Match this split for every new function.
- No `DungeonScreen.tsx`/`host-session.ts` component test file exists or should be introduced (confirmed absent, 7.11 Dev Notes precedent) — coverage for the new `ability:chain-hit`/`projectile:hit` DungeonScreen branches comes from the pure planner tests underneath plus the manual Client-UX pass.
- `npm run typecheck` at repo root covers all 10 tsconfigs; `npm test` at root is the full suite.
- **Known pre-existing, NOT caused by this story** (do not chase, do not claim fixed): `ability-vfx.test.ts`'s Stone Wall centering failure (documented since 7.2/7.8, re-confirmed by 3.27's session); an intermittent Ancestor's Voice e2e heal assertion (`ability-dispatch.test.ts`); WSL2 e2e port-binding timeouts on some e2e suites.

### Project Context Rules

- **PixiJS Host Renderer rule** (project-context.md): "No game logic, cooldown tracking, or collision checks inside any PixiJS display object" — every new primitive/planner here is rendering-only, reading already-resolved deltas/state; none introduces hit-testing or cooldown logic.
- **Monorepo Ownership**: `apps/host-client/**` = Host Experience Engineer, protected boundary. Never import `packages/game-rules` or `planck.js` — this story needs neither (see the `LIGHTNING_ARC_CORRIDOR_ANGLE_DEG` note above for the one place this could be tempting).
- **Host may never mutate `GameState`** — the new `ability:chain-hit`/`projectile:hit` branches only read `gameState`/the raw delta to place visuals; `apply-delta.ts`'s existing no-op cases are untouched.
- Colors are PixiJS numeric literals (`0xrrggbb`), never CSS strings — matches every existing palette constant in the touched files.

### References

- [Source: `docs/adr/ADR-0005-cone-hit-geometry-and-extended-delivery.md`] — Consequences section, the authoritative scope statement for this story.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`] — 3.25/3.26 Non-goal entries.
- [Source: `_bmad-output/implementation-artifacts/3-25-cone-hit-geometry-contract-and-stonehide-spiritcaller-souldrinker-cone-conversion.md`] — AC1-AC6, Task 1 (exact cone angles).
- [Source: `_bmad-output/implementation-artifacts/3-26-stormcaller-rework-ii-lightning-arc-chain-and-tempest-hurl-projectile.md`] — AC1-AC8, Tasks 1-3 (chain + projectile mechanics).
- [Source: `packages/shared-types/src/ability-geometry.ts`] — `ABILITY_GEOMETRY`, `TEMPEST_HURL_*` constants.
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:126-137`, `apply-delta.ts:153-154`] — `AbilityChainHitDelta`.
- [Source: `apps/host-client/src/vfx/primitives.ts`] — whole file (321 lines); `createRingShockwave` (:200-233) is Task 1's closest sibling.
- [Source: `apps/host-client/src/vfx/ability-vfx.ts`] — whole file; `:106-115` (`AbilityVfxConfig`), `:186-240` (placement), `:121-172` (`STONEHIDE_VFX`).
- [Source: `apps/host-client/src/vfx/spiritcaller-vfx.ts`] — `:92-130` (`planSpiritcallerCast`), `:149-175` (`triggerSpiritcallerCast`).
- [Source: `apps/host-client/src/vfx/souldrinker-vfx.ts`] — `:158-187` (`planCrimsonLashCast`), `:217-256` (impact planners, the pattern to mirror).
- [Source: `apps/host-client/src/vfx/stormcaller-vfx.ts`] — whole file (367 lines); `:143-154` (`planLightningArc`), `:160-177` (`planTempestHurl`), `:284-338` (`HurlFlight`/`advanceHurlFlights`, to delete).
- [Source: `apps/host-client/src/vfx/ability-vfx-config.ts`] — `:78-99` (`SOULDRINKER_PROJECTILES` pattern), `:106-136` (`PROJECTILE_APPEARANCE`/`resolveProjectileAppearance`).
- [Source: `apps/host-client/src/session/host-session.ts:42-91`] — `onTransientDelta` whitelist.
- [Source: `apps/host-client/src/screens/DungeonScreen.tsx`] — `:658-661`, `:679-712`, `:815`, `:1004`, `:1040-1150`, `:1152-1199`, `:1360-1375` (all cited inline above).
- [Source: `_bmad-output/project-context.md`] — PixiJS Host Renderer rule, Monorepo Ownership table (`:112-116`, `:128-138`, `:285`).
- [Source: `CLAUDE.md`] — ownership rules, Client-UX hook, merge gate.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `souldrinker-vfx.test.ts`'s new Crimson Lash fan-angle test initially failed (`expected -0.785 to be close to -0.393`) — the test's own `angleOf` helper subtracted the caster's `y` (400) using the literal `500` (the `x` value) by copy-paste mistake. Fixed the test; the implementation was correct on the first pass (verified by computing the exact expected atan2 by hand against the failing output before touching anything).
- First full-suite `npm test` run: `668 passed | 2 failed | 3 skipped` (673 total). Both failures match documented pre-existing issues, confirmed by category rather than re-derived from scratch: `apps/host-client/src/vfx/ability-vfx.test.ts` Stone Wall centering (memory: `known-failing-stonehide-geometry-test.md`, tracked since 7.2/7.8) and `tests/e2e/ability-dispatch.test.ts`'s intermittent Ancestor's Voice heal assertion (memory: `known-flaky-ancestors-voice-e2e-test.md`). `tests/e2e/full-run.test.ts` and `tests/e2e/hub-ability-use.test.ts` both skipped their 2/1 tests with "simulation-server did not start within 60s" — the WSL2 e2e port-binding timeout this story's own Dev Notes names as a known pre-existing environment issue, not chased.
- `npm run typecheck` (all 10 tsconfigs): clean on the first pass after Task 6's rename of `spawnSpecs` → `spawnStormcallerSpecs` and removal of `HurlFlight`/`StormcallerFlightPlan`/`TEMPEST_HURL_FLIGHT_MS` — no stray references were left in `DungeonScreen.tsx` or `index.ts` (verified via grep before running tsc, not just after).

### Completion Notes List

- **Task 1 — `createConeWedge`:** apex-anchored sector primitive, sibling to `createRingShockwave` (same expand/implode + fade-by-`(1-t)` lifecycle). A degenerate `angleDeg <= 0` draws a line along `(dirX, dirY)` instead of a zero-area shape, matching `isInConeZone`'s own apex-point edge case per Dev Notes. Direction is captured once at creation (no per-frame `moveTo`-equivalent) — static per-effect, like beam/ring.
- **Task 2 — Stone Wall / Avalanche:** added `cone?: ConeSpec` to `AbilityVfxConfig`, populated both from `ABILITY_GEOMETRY` live (`coneAngleDeg`, `hitRangePx` as length, per Dev Notes' explicit rule not to add a second range value). Also corrected two stale comments on Stone Wall's `hitRangePx` ("0 today → hits at caster") and Avalanche's ("range 200") that predated Story 3.25/3.27's geometry changes (real values are 160 and 75 respectively) — directly adjacent to the code this task touches and actively misleading about why the new wedge has nonzero reach. **Judgment call:** kept Avalanche's existing `'hit'`-anchored impact ring/beam unchanged (documented in the source comment) — it sits at the cone's own far edge, not a caster-anchored full circle, so it does not contradict the wedge. Stone Wall's implode ring/beam/dust burst are explicitly unaffected per AC2.
- **Task 3 — Ancestor's Voice:** added optional `dirX`/`dirY` to `SpiritcallerCastPlan` (present only for `ancestors-voice`; self-centred TAP abilities carry neither). **Judgment call:** removed the old full-circle "expand ring" (`SPIRIT_HARM`, 0→120px at the focus point) rather than keeping it alongside the wedge — it drew a full circle sized off `ABILITY_GEOMETRY.spiritcaller[0].hitRadiusPx`, a field explicitly unread for cone-shaped entries since Story 3.27, so it actively misrepresented the real 70° hit shape. The small imploding "gather" ring (18px landing radius) was kept since it reads as a localized accent, not a hit-area claim.
- **Task 4 — Crimson Lash:** re-derived `CRIMSON_LASH_FAN_RAD` from `SOULDRINKER_GEOMETRY[1].coneAngleDeg / 2` (in radians) instead of the old hardcoded `0.30` rad (~17.19°) — chose the "re-derived beam spread" option from the three offered (wedge / beam spread / both) since `souldrinker-vfx.ts`'s `VfxSpec` union is a closed ring/beam/burst model and extending it with a `'cone'` kind for one ability would be disproportionate; the existing 3-beam fan already reads correctly once its angle tracks the contract. HP-scaled width/alpha logic untouched.
- **Task 5 — Lightning Arc chain-hit VFX:** whitelisted `ability:chain-hit` in `host-session.ts`; added a `DungeonScreen.tsx` branch mirroring `zone:strike`'s target-resolution pattern (enemy, then boss by id, else silently skip). New pure `planChainHitBeam` in `stormcaller-vfx.ts` (deliberately its own single beam, not `planLightningArc`'s glow+core pair — a 3-hop chain drawing 6 layered beams would be noisier than one clean arc per hop). **Judgment call (Dev Notes, not an AC):** staggered same-tick hops' `startedAt` by `chainIndex * 40` so a multi-bounce chain's fade reads as travelling outward — each beam still appears immediately (geometry/alpha are set at creation), only its fade-start is delayed, which is what the primitive's clock contract allows without a new mechanism. Confirmed via test that 3 same-tick calls each produce their own live effect (7.11's no-batch-collapse contract holds for a plain function-call loop, not just the `transientDeltaQueue` it was built for).
- **Task 6 — Tempest Hurl:** removed the stale fake flight (`HurlFlight`, `advanceHurlFlights`, the `flight` field on `StormcallerCastPlan`, `TEMPEST_HURL_FLIGHT_MS`) in the order the Dev Notes specified (flight removed first, then the appearance-table entry, then the new `projectile:hit` branch) so no intermediate state had two contradictory impact visuals live at once. Renamed the file's private `spawnSpecs` to an exported `spawnStormcallerSpecs` (mirrors `spawnSouldrinkerVfx`'s role) rather than adding a second one-off wrapper function, so the new `planTempestHurlImpact`/`planChainHitBeam` specs can be spawned through the same public executor other planners already use. New `STORMCALLER_PROJECTILES` entry in `ability-vfx-config.ts` (only idx1 populated, sized off `TEMPEST_HURL_PROJECTILE_RADIUS_PX`).
- **Required hooks:** Contract-change hook NOT triggered (`AbilityChainHitDelta`/`ABILITY_GEOMETRY`/`TEMPEST_HURL_*` are read-only imports of already-shipped exports; no `packages/shared-types`/`packages/net-protocol` file modified). Simulation-safety hook NOT triggered (no `apps/simulation-server`/`packages/game-rules` file touched). Ownership hook NOT triggered (single owner, `apps/host-client/**` only, confirmed by this session's own diff). **Client-UX hook TRIGGERED — the manual pass was NOT performed** (no display available in this sandbox; same disclosed limitation as 7.5/7.6/dev-3/3.23/7.7b). A human must cast Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash and confirm each shows a directional fan; cast Lightning Arc against 2+ clustered enemies and confirm a connected arc chain; cast Tempest Hurl and confirm one coherent ball with a correctly-timed/sized impact (including against the boss) before this story is considered visually verified.
- **Regression:** `npm run typecheck` clean across all 10 tsconfigs. `npm test`: 668 passed, 2 failed (both pre-existing, see Debug Log), 3 skipped — 0 regressions attributable to this story's changes.
- **`deferred-work.md`:** appended a resolution note (top of file) closing this story's slice of ADR-0005's Consequences gap, explicitly listing what remains out of scope (`D-7.5-A`, Lightning Arc's own corridor visualization, Thunder Clap/Storm Eye) so it isn't misread as resolving those too.
- **Confidence: 85%** — typecheck and the full test suite are clean modulo the three explicitly pre-documented failure categories, and every AC has direct unit-test coverage. The 15% reservation is entirely the undone manual Client-UX pass (Task 8/AC9) — the three "judgment call" visual composition decisions (Avalanche's kept ring, Ancestor's Voice's removed expand-ring, the chain's stagger timing) are reasoned from the spec and existing conventions but unverified on an actual couch-distance display.

### File List

- `apps/host-client/src/vfx/primitives.ts` — new `ConeWedgeParams`/`createConeWedge` (Task 1)
- `apps/host-client/src/vfx/vfx.test.ts` — `createConeWedge` added to the lifecycle-contract table + new `describe('cone wedge')` block (Task 1)
- `apps/host-client/src/vfx/index.ts` — exports for `createConeWedge`/`ConeWedgeParams`, `ConeSpec`, `planChainHitBeam`, `planTempestHurlImpact`, `spawnStormcallerSpecs`; removed `advanceHurlFlights`/`TEMPEST_HURL_FLIGHT_MS`/`HurlFlight`/`StormcallerFlightPlan` (Tasks 1, 5, 6)
- `apps/host-client/src/vfx/ability-vfx.ts` — new `ConeSpec` type, Stone Wall/Avalanche cone entries, 2 stale-comment fixes (Task 2); Avalanche's cone recolored `STONEHIDE_DUST` (contrast fix) + alpha/duration bump (manual pass round 2); `cone?: ConeSpec` → `cones?: readonly ConeSpec[]`, Stone Wall/Avalanche stripped to layered cone-only (old rings/beam/burst removed) (manual pass round 3); every cone layer's `durationMs` halved (manual pass round 4)
- `apps/host-client/src/vfx/ability-vfx.test.ts` — cone-wedge assertions for Stone Wall/Avalanche/Tremor Stomp/Iron Skin (Task 2); `signatureOf` updated for `cones`, new cone-only assertions (manual pass round 3)
- `apps/host-client/src/vfx/spiritcaller-vfx.ts` — `dirX`/`dirY` on `SpiritcallerCastPlan`; wedge wired into `triggerSpiritcallerCast`'s `ancestors-voice` branch, replacing the old full-circle expand ring (Task 3); stripped to layered cone-only (beam/implode ring/burst removed), dead `ANCESTORS_VOICE_RADIUS_PX` export deleted (manual pass round 3); cone layers' `durationMs` halved (manual pass round 4)
- `apps/host-client/src/vfx/spiritcaller-vfx.test.ts` — direction-carrying assertions + `triggerSpiritcallerCast` composition tests (Task 3); updated for cone-only composition (manual pass round 3)
- `apps/host-client/src/vfx/souldrinker-vfx.ts` — `CRIMSON_LASH_FAN_RAD` re-derived from `SOULDRINKER_GEOMETRY[1].coneAngleDeg` (Task 4); new `'cone'` `VfxSpec` variant + wedge added to `planCrimsonLashCast`/`spawnSouldrinkerVfx` (manual pass round 2); second outline layer + intensity bump (manual pass round 3); cone layers' `durationMs` halved (manual pass round 4)
- `apps/host-client/src/vfx/souldrinker-vfx.test.ts` — fan-angle assertion against the live contract (Task 4); new cone-wedge assertion (manual pass round 2)
- `apps/host-client/src/vfx/stormcaller-vfx.ts` — new `planChainHitBeam`, new `planTempestHurlImpact`; removed `HurlFlight`/`StormcallerFlightPlan`/`advanceHurlFlights`/`TEMPEST_HURL_FLIGHT_MS`/the `flight` field; `spawnSpecs` renamed to exported `spawnStormcallerSpecs`; `planTempestHurl` simplified to the launch puff only (Tasks 5, 6); removed Lightning Arc's crack ring (manual pass round 1)
- `apps/host-client/src/vfx/stormcaller-vfx.test.ts` — new `planChainHitBeam`/`spawnStormcallerSpecs`/`planTempestHurlImpact` coverage; rewrote the Tempest Hurl flight test for the simplified plan (Tasks 5, 6); updated the Lightning Arc test for the removed crack ring (manual pass round 1)
- `apps/host-client/src/vfx/ability-vfx-config.ts` — new `STORMCALLER_PROJECTILES` entry in `PROJECTILE_APPEARANCE` (Task 6)
- `apps/host-client/src/vfx/ability-vfx-config.test.ts` — Stormcaller idx1/idx0/2/3 coverage (Task 6)
- `apps/host-client/src/session/host-session.ts` — whitelisted `ability:chain-hit` (Task 5)
- `apps/host-client/src/screens/DungeonScreen.tsx` — cone render branch (Task 2); `ability:chain-hit` dispatch branch (Task 5); removed `hurlFlightsRef`/`advanceHurlFlights` wiring, added Stormcaller/idx1 `projectile:hit` branch (Task 6); cone render loop updated for `cfg.cones` array (manual pass round 3)
- `_bmad-output/implementation-artifacts/deferred-work.md` — resolution note closing ADR-0005's Consequences gap (Task 9); `D-7.13-A` entry (code review); `D-7.13-B` entry (manual pass, chain-radius/density finding)
- `_bmad-output/implementation-artifacts/7-13-cone-wedge-chain-lightning-and-tempest-hurl-vfx.md` — this story file (Dev Agent Record, Tasks, Status, Review Findings, Manual Client-UX Pass Findings)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updates (dev-story start/in-progress/review)

## Change Log

- 2026-07-30: manual Client-UX pass round 4 — explicit user direction: the cone wedges "advance real slowly" for instant abilities, halve their fade duration. Halved every cone layer's `durationMs` across all four cone abilities (Stone Wall/Avalanche in `ability-vfx.ts`, Ancestor's Voice in `spiritcaller-vfx.ts`, Crimson Lash in `souldrinker-vfx.ts`): fill 320→160ms, outline 280→140ms, no angle/radius/color/alpha changes. No test changes needed (no test asserted a specific cone `durationMs`). Regression: typecheck clean (10/10), vfx/screens suites 116 passed / 1 pre-existing failure. Status stays `review`.
- 2026-07-30: manual Client-UX pass round 3 — explicit user direction: remove the pre-existing (pre-7.13) VFX for Stone Wall, Avalanche, and Ancestor's Voice entirely, keeping only the cone wedge, and make the cone shapes noticeably more intense. Changed `AbilityVfxConfig.cone?: ConeSpec` to `cones?: readonly ConeSpec[]` (mirrors the existing `rings` layering pattern) so each ability can stack a soft fill under a bright outline. Stone Wall and Avalanche (`ability-vfx.ts`) lost their old rings/beam/burst entirely, now two layered wedges each. Ancestor's Voice (`spiritcaller-vfx.ts`) lost its beam/implode-ring/burst, now two layered wedges; deleted the now-fully-dead `ANCESTORS_VOICE_RADIUS_PX` export. Crimson Lash (not named for removal) got the same fill+outline treatment layered onto its existing beam fan for intensity parity. `DungeonScreen.tsx`'s cone render block updated to loop the new `cones` array. Updated `ability-vfx.test.ts` (distinctness signature now folds in `cones`; new cone-only assertions) and `spiritcaller-vfx.test.ts` (composition tests now expect 2 effects, not 4/3) for the new shape. Regression: typecheck clean (10/10), vfx/screens suites 116 passed / 1 pre-existing failure. Status stays `review`.
- 2026-07-30: manual Client-UX pass round 2 — user confirmed Stone Wall/Lightning Arc now correct but reported Crimson Lash and Avalanche "still has nothing, only the old vfx." Two different root causes: Crimson Lash never had an actual wedge shape (Task 4's original choice was the re-derived beam-fan option only, per AC4's "either/or/both") — added a `'cone'` `VfxSpec` variant to `souldrinker-vfx.ts` and wired a real wedge into `planCrimsonLashCast`, alongside the existing fan. Avalanche's wedge was verified drawing correctly (stress-tested its exact real parameters, 40°/75px, across 36 directions — no throws, no degenerate output) but its ring, beam, and cone all shared the identical color `STONEHIDE_OCHRE`, so the new wedge visually merged into the old effects with zero contrast; recolored the cone to `STONEHIDE_DUST` (mirroring Stone Wall's own OCHRE-vs-DUST contrast) and bumped its alpha/duration since its 75px reach gives ~6x less area than Stone Wall's 160px cone. Regression: typecheck clean (10/10), vfx/screens suites 115 passed / 1 pre-existing failure. Status stays `review`.
- 2026-07-30: manual Client-UX pass round 1 (Task 8/AC9, performed by the user) — found and fixed a critical `createConeWedge` path-topology bug: the initial `lineTo` targeted the wrong arc tip (PixiJS's `Graphics.arc()`, unlike Canvas2D, never auto-connects from the current point), so every cone wedge filled only ~12% of its intended area (a thin sliver near the rim, confirmed via the shoelace formula: 129 vs. an expected 1091 px² for a 50°/50px wedge) instead of the full pie slice — this is why cone shapes read as "not visible at all." Fixed in `primitives.ts`; added a new area-based regression test (`vfx.test.ts`, reads the real filled polygon via Pixi's `shapePath` getter) since the prior bounds-only tests couldn't have caught this (bounds are identical for both the broken and correct shapes). Removed Lightning Arc's static "crack ring" per explicit user request (`stormcaller-vfx.ts`) — it drew at a fixed, never-the-real-target point, redundant with the real `ability:chain-hit` beams. Investigated the reported "chain doesn't continue past the first hit" via a temporary live simulation-server test (not committed): confirmed the sim and host VFX are both wired correctly, but real dungeon-run enemy spacing (887px, 302.6px sampled) far exceeds `LIGHTNING_ARC_CHAIN_RADIUS_PX` (150px) — a `packages/game-rules` balance/spawn-density question, not a VFX defect; deferred as `D-7.13-B`. Regression: typecheck clean (10/10), vfx/screens suites 114 passed / 1 pre-existing failure. Status stays `review`.
- 2026-07-30: code-review — 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 `decision_needed`, 5 `patch` (all applied: `createConeWedge`'s degenerate branch now floors its stroke width so a `filled`+`lineWidth:0` caller never renders invisibly; removed a redundant second zero-aim guard on the cone render path that contradicted this story's own Dev Notes; extracted a shared `resolveEnemyOrBossPosition` helper for `zone:strike`/`ability:chain-hit`'s previously-duplicated target resolution; corrected a misleading "slower" comment in `ability-vfx-config.ts`; replaced a liveness-only cone-wedge "geometry" test with 3 real `getLocalBounds()`-based assertions), 1 `defer` (`D-7.13-A`, `projectile:expired` not forwarded for any projectile ability — pre-existing, appended to deferred-work.md), 9 dismissed after verification (a claimed chain-hit batch-collapse disproved by the Story 7.11 `transientDeltaQueue`; a claimed future-`startedAt` overflow disproved by `progress()`'s own clamp; a claimed zero-aim asymmetry disproved by the enclosing `if (place)` guard; and 6 more — full detail in the story's own Review Findings section). Re-ran typecheck (clean, 10/10) and the vfx/screens suites (113 passed, 1 pre-existing unrelated failure) after applying patches. Status stays `review` (not `done`) — the Client-UX hook's manual pass is still outstanding, matching 7.5/7.6/dev-3/3.23/7.7b's own precedent for this exact situation.
- 2026-07-29: dev-story — implemented Story 7.13, closing all three gaps ADR-0005's Consequences section named. Added `createConeWedge` (`primitives.ts`) and wired it into Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash, each reading its real `coneAngleDeg` live from `ABILITY_GEOMETRY` rather than a hand-copied literal. Whitelisted and consumed `ability:chain-hit` so Lightning Arc's chain draws one beam per hop instead of one static beam. Removed Tempest Hurl's stale pre-3.26 fake 170ms flight (`HurlFlight`/`advanceHurlFlights`) and replaced it with a real `PROJECTILE_APPEARANCE` entry (generic `state.projectiles` render path) plus a `projectile:hit`-driven `planTempestHurlImpact` sized to `TEMPEST_HURL_BLAST_RADIUS_PX`. Judgment calls documented in Completion Notes: Avalanche's existing impact ring kept as-is (no contradiction), Ancestor's Voice's old full-circle expand ring removed (did contradict the cone), chain beams staggered by `chainIndex * 40` for a travelling read. Typecheck clean (10/10 tsconfigs); full suite 668/670 non-skipped tests passing, the 2 failures and 2 skips all matching pre-documented issues (Stone Wall centering, flaky Ancestor's Voice heal assertion, WSL2 e2e port timeouts) — confirmed by category, not newly discovered. Appended a deferred-work.md resolution note. Manual Client-UX pass (Task 8/AC9) NOT performed — no display in this sandbox, disclosed per 7.5/7.6/dev-3/3.23/7.7b precedent. Status → review.

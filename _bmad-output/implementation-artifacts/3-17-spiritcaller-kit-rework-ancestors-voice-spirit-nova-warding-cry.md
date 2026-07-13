---
baseline_commit: f6083d8
---

# Story 3.17: Spiritcaller Kit Rework (Ancestor's Voice, Spirit Nova, Warding Cry)

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / 4 Alpha Classes (Epic 3 Extension: Ability Mechanics
  Rework — 2nd of 5 per-class kit-rework stories; depends on 3.11, 3.12
  (status effects), 3.15 (mixed-faction targeting, self-cost not needed here))

Context: This is the FIRST story in the whole batch that needs to gather
  nearby PLAYERS for an ability's hit zone — every ability up to now (all
  original 9 + Story 3.16's Stonehide kit) only ever targets enemies.
  `apps/simulation-server/src/rooms/GameRoom.ts`'s hit-scan loop iterates
  `this.gameState.enemies` only; there is no existing "gather players in hit
  zone" query anywhere in the codebase. This story adds it — Story 3.15's
  `resolveMixedFactionTargets` is a pure SPLIT function, it does not gather
  targets itself (see 3.15's Dev Notes: "the CALLER is responsible for the
  actual gather... query").

  Spirit Nova's "Expanding Radius" delivery is a genuinely novel mechanic —
  no other ability in the full 16-ability spec uses it, and Story 3.13's
  Zone/Field entities don't fit it cleanly (a Zone re-applies its effect to
  everyone inside it on every tick — a repeating DoT/HoT; Spirit Nova is a
  ONE-SHOT sweep where each target should be hit exactly once as the
  growing ring passes over them, not every tick for the cast's duration).
  Do not try to reuse `ZoneState` for this — build it as its own small,
  self-contained GameRoom-local mechanism (see Task 3 below). This is
  new ground; there's no existing pattern in this codebase to point to for
  it, unlike every other mechanic in this batch.

  Warding Cry needs the exact `'allies-in-zone'` status-effect scope that
  Story 3.16 deliberately deferred building (3.16 only needed `'self'` and
  `'enemies-in-zone'`). This story is where `'allies-in-zone'` actually gets
  implemented — it reuses the SAME new players-gathering query this story
  also needs for Ancestor's Voice, so build the query once and use it for both.

Owner agent: Multi-context (explicit cross-context approval — flag to user
  if narrower split preferred):
  Simulation Engineer (all tasks — packages/game-rules/**, apps/simulation-server/**)
  Protocol Architect (verify only — see 3.16's note on checking whether
  existing delta types suffice before assuming a change is needed; likely
  yes for status effects, but Spirit Nova's expanding-radius sweep hitting
  multiple targets per tick may want its own delta for host visual timing —
  verify before adding one)

Goal:
  Task 1 — Add a `gatherPlayersInHitZone`-style query to `GameRoom.ts`
            (mirrors the existing enemy-gathering loop, using `isInHitZone`
            against `this.gameState.players`, excluding the caster).
  Task 2 — Ancestor's Voice: wire `resolveMixedFactionTargets` using the
            combined enemy+player gather, apply heal/damage from new
            `ABILITY_HEAL_AMOUNT` balance table.
  Task 3 — Spirit Nova: new GameRoom-local expanding-radius tracking +
            `resolveExpandingRadius` pure helper in `targeting.ts`.
  Task 4 — Warding Cry: `'allies-in-zone'` status-effect scope (`'shield'`)
            using Task 1's new player-gathering query, extending 3.16's
            `ABILITY_STATUS_EFFECT` table handling in `GameRoom.ts`.

Allowed paths:
  - packages/game-rules/src/systems/targeting.ts
  - packages/game-rules/src/balance.ts
  - packages/game-rules/src/index.ts
  - apps/simulation-server/src/rooms/GameRoom.ts
  - packages/net-protocol/src/messages/server-to-host.ts (only if
    verification in Task 3 shows a new delta is genuinely needed for Spirit
    Nova's sweep visualization — don't add one speculatively)
  - packages/net-protocol/src/apply-delta.ts (same condition)
  - tests/unit/abilities.test.ts, tests/unit/targeting.test.ts

Blocked paths:
  - Soul Mend — explicitly Story 3.18, do not touch Spiritcaller slot 2 at
    all in this story (leave its current `RELEASE`... wait, it's
    `AIM_CAST` after Story 3.11 — leave its `CLASS_DEFINITIONS`/`balance.ts`
    entries exactly as 3.11 left them, untouched)
  - Any other class's abilities — Stories 3.16 (done), 3.19, 3.20
  - packages/shared-types/src/status-effect.ts (the `'shield'` effect type
    already exists from Story 3.12's AC1 type union — no shared-types change
    needed for Warding Cry)

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.17" section
  - _bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md — `resolveMixedFactionTargets` signature
  - _bmad-output/implementation-artifacts/3-12-status-effect-engine-buffs-debuffs-with-duration.md, 3-16-stonehide-kit-rework.md — `ABILITY_STATUS_EFFECT` table and its `GameRoom.ts` wiring, to extend with `'allies-in-zone'`
  - apps/simulation-server/src/rooms/GameRoom.ts — the existing enemy hit-scan loop (to mirror for players) and ability-dispatch block

Non-goals:
  - Do not implement Soul Mend — Story 3.18.
  - Do not build a reusable "Expanding Radius" abstraction beyond what
    Spirit Nova itself needs — no other ability in the spec uses this
    delivery type; a generic system for one consumer is premature (YAGNI).
  - Do not add a persistent `GameState`-visible entity for Spirit Nova's
    expanding sweep (unlike Projectile/Zone from 3.13) — it resolves within
    its short duration and produces ordinary `enemy:damaged`/
    `player:hp-updated` deltas per target as they're swept; the host doesn't
    need a distinct persistent entity to render, it needs (at most) one
    ability-cast-position visual cue, which `ability:fired`'s existing
    direction/position-adjacent broadcast likely already covers — verify.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Simulation-safety hook: TRIGGERED.
  - Ownership hook: primarily Simulation Engineer; verify net-protocol
    untouched before finalizing the header's ownership scope.

Required tests:
  - tests/unit/abilities.test.ts — Ancestor's Voice mixed-faction split,
    Warding Cry shield application.
  - tests/unit/targeting.test.ts — `resolveExpandingRadius`'s radius-growth-
    over-time math and hit-once-per-target guard, pure, independent of
    Spirit Nova specifically (test the helper directly with synthetic
    target lists).

Telemetry impact: None.
```

---

## Story

As a player,
I want Ancestor's Voice, Spirit Nova, and Warding Cry implemented per the final spec,
so that Spiritcaller's sustain/burst/defend kit works as intended (Soul Mend's revive interaction is covered separately in Story 3.18).

---

## Acceptance Criteria

**AC1 — Ancestor's Voice (`AUTO`, Cone/Line, mid-range):**
**Given** Ancestor's Voice fires
**When** it resolves
**Then** `resolveMixedFactionTargets` splits targets in the cone into allies (healed) and enemies (damaged) from one query, replacing the current heal-only placeholder

**AC2 — Spirit Nova (`TAP`, Expanding Radius):**
**Given** Spirit Nova fires
**When** it resolves
**Then** a new `resolveExpandingRadius` helper in `packages/game-rules/src/systems/targeting.ts` grows a hit-zone radius from 0 to its max over a short duration, ticking on the sim's cadence, applying mixed-faction heal/damage to everyone it sweeps over — fixing the current mislabel (code deals damage only; spec is mixed-faction)

**AC3 — Warding Cry (`TAP`, self-centered Proximity/Radius):**
**Given** Warding Cry fires
**When** it resolves
**Then** all allies within `ABILITY_HIT_RADIUS_PX` of the caster receive a `'shield'` status effect (temporary flat damage absorption), replacing the current damage=0 no-op

**AC4 — Soul Mend out of scope:**
**Given** Soul Mend
**When** this story is scoped
**Then** Soul Mend is explicitly out of scope — it is fully covered by Story 3.18

**AC5 — Tests:**
**Given** `tests/unit/abilities.test.ts` and `tests/unit/targeting.test.ts`
**When** Spiritcaller's reworked kit is exercised
**Then** Ancestor's Voice and Spirit Nova's mixed-faction resolution, and Warding Cry's shield application, are each covered

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: #1, #3) — `GameRoom.ts`: add a players-gathering
  helper mirroring the existing enemy hit-scan gather (same `isInHitZone`
  call, iterate `this.gameState.players` instead of `.enemies`, exclude
  `player.id === casterId`, exclude spirits/downed players per the same
  `isSpirit`/`isDown` guards already used elsewhere for "who's a valid
  interaction target" — check the proximity-revive block's guard style at
  ~line 1630 for the established exclusion pattern).

- [ ] **Task 2** (AC: #1) — `balance.ts`: add `ABILITY_HEAL_AMOUNT:
  Record<PlayerClass, readonly [number,number,number,number]>` (parallels
  `ABILITY_DAMAGE`); Spiritcaller slot 0 (Ancestor's Voice) gets a tunable
  heal value, slot 1 (Spirit Nova) gets a tunable heal value, slots 2/3
  (Soul Mend, Warding Cry) stay 0 (Soul Mend heals via full revive not this
  table — 3.18; Warding Cry shields not heals). `GameRoom.ts`: for
  Ancestor's Voice, gather enemies (existing loop) + allies (Task 1) within
  the cone, call `resolveMixedFactionTargets(casterId, [...enemies,
  ...allies])`, apply `ABILITY_DAMAGE`-value damage to each returned enemy
  (existing `applyDamage` call, unchanged), apply `ABILITY_HEAL_AMOUNT`-value
  heal to each returned ally via `healPlayer` (Story 3.15), broadcast
  `enemy:damaged`/`player:hp-updated` per target (existing delta types,
  reused).

- [ ] **Task 3** (AC: #2) — `targeting.ts`: add
  ```ts
  export function resolveExpandingRadius(
    elapsedMs: number, durationMs: number, maxRadiusPx: number,
  ): number {
    return maxRadiusPx * Math.min(1, Math.max(0, elapsedMs / durationMs));
  }
  ```
  (pure radius-at-time calculation; the sweep/hit-once-per-target bookkeeping
  is stateful and belongs in `GameRoom.ts`, not this pure function — keep
  the pure/impure boundary the same as everywhere else in this codebase).
  `GameRoom.ts`: add `activeSpiritNovas: Array<{ casterId: string; x: number;
  y: number; startedAtMs: number; durationMs: number; maxRadiusPx: number;
  hitIds: Set<string> }> = []` instance field. On Spirit Nova fire, push a
  new entry (don't run it through the normal instant hit-scan path — branch
  before that, similar to how a future channeled-ability check would branch,
  or gate the existing hit-scan block to skip Spirit Nova's slot). Each
  tick, for each active entry: compute `currentRadius =
  resolveExpandingRadius(nowMs - startedAtMs, durationMs, maxRadiusPx)`;
  gather all players (Task 1's query, radius = currentRadius, no cone/
  direction — proximity only) and enemies (radius = currentRadius) NOT
  already in `hitIds`; call `resolveMixedFactionTargets`; apply heal/damage
  to newly-swept targets; add their ids to `hitIds`; if `nowMs >=
  startedAtMs + durationMs`, remove the entry from `activeSpiritNovas`.
  Add `SPIRIT_NOVA_DURATION_MS`, `SPIRIT_NOVA_MAX_RADIUS_PX` tunables to
  `balance.ts` (Spiritcaller-slot-1-specific, not a generic per-class table
  since only one ability in the entire spec uses this delivery type — a
  4-tuple table would be mostly-unused ceremony for a single consumer;
  plain named constants are the right amount of structure here).

- [ ] **Task 4** (AC: #3) — Extend Story 3.16's `ABILITY_STATUS_EFFECT`
  table handling in `GameRoom.ts` to support `scope: 'allies-in-zone'`
  (currently only `'self'`/`'enemies-in-zone'` are handled after 3.16):
  when scope is `'allies-in-zone'`, use Task 1's players-gathering query
  (proximity radius, no direction) instead of the enemy loop, apply
  `applyStatusEffect` to each gathered ally, broadcast `status:applied` per
  target. Add Warding Cry's entry to `ABILITY_STATUS_EFFECT` (Spiritcaller
  slot 3): `{ effectType: 'shield', magnitude: <tunable>, durationMs:
  <tunable>, scope: 'allies-in-zone' }`.

- [ ] Add Ancestor's Voice, Spirit Nova, Warding Cry test cases per AC5.
- [ ] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions.

---

## Dev Notes

### `'shield'` magnitude semantics differ from the other 3 effect types

Story 3.12's `StatusEffect.magnitude` is described generically, but
`'damageReduction'`/`'slow'`/`'damageBuff'` are all 0-1 fractions (percentage
multipliers) while `'shield'` is a FLAT HP absorption amount (per 3.12's own
type comment: "flat HP for shield"). When wiring Warding Cry's shield
application AND when 3.12's damage-reduction hook is checked in
`combat.ts`/`player-health.ts`, make sure `'shield'`'s actual absorption
behavior (subtract from incoming damage before HP, decrement the shield's
remaining magnitude, or a simpler "shield blocks the next N total damage
then expires" — pick one, document the choice) is implemented somewhere;
epics.md doesn't fully specify the interaction between a `'shield'` effect
and `player-health.ts`'s `applyPlayerDamage` (which currently only knows
about `'damageReduction'`, wired in Story 3.12). If `'shield'` absorption
requires a `player-health.ts` change beyond what 3.12 already wired, that's
this story's job to add — check 3.12's actual landed implementation before
assuming it's already handled.

### Project Context Rules

- Same tick-loop-hygiene, Result<T,E>, and configuration-hierarchy rules as
  every other story in this batch — see 3.12/3.15/3.16 for the full text,
  not repeated here.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.17]
- [Source: _bmad-output/implementation-artifacts/3-15-self-cost-resource-and-mixed-faction-target-resolution.md]
- [Source: _bmad-output/implementation-artifacts/3-16-stonehide-kit-rework.md] — `ABILITY_STATUS_EFFECT` table this story extends
- [Source: apps/simulation-server/src/rooms/GameRoom.ts] — hit-scan loop to mirror for players

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

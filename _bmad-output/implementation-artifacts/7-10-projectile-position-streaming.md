---
baseline_commit: e007dfbb16bc806a1d84071171d69431fbab5d29
---

# Story 7.10: Projectile Position Streaming (`projectile:moved` delta)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Protocol Architect + Simulation Engineer,
I want in-flight projectiles to stream their position to clients every tick via a real `projectile:moved` delta,
so that the host renders a projectile that actually flies across the arena instead of freezing on the caster and teleporting along the aim line.

**Why this story exists (defect found during Story 7.4 playtest, 2026-07-23):**
Projectiles are the only moving entity in the game whose position is **never streamed**. Verified at baseline `e007dfb`:

- The sim moves projectiles every tick and reads the physics body back into `gameState`
  (`apps/simulation-server/src/rooms/GameRoom.ts:1412-1420`, "Planck phase 3b") — but **broadcasts nothing**.
- Every *other* moving entity has a per-tick movement delta: `player:moved`
  (`GameRoom.ts:1403,1249,2723`), `enemy:moved` (`:1230`), `boss:moved` (`:1909`).
- The only projectile deltas that exist are `projectile:hit` and `projectile:expired`
  (`server-to-host.ts:236-246`), **both of which remove** the projectile; `applyDelta` has
  no case that *moves* one (`apply-delta.ts:247-252`).
- So on the host, a projectile's position only refreshes on a **full snapshot**: the periodic
  one every `SNAPSHOT_INTERVAL_S = 5 s` (`GameRoom.ts:2904`, `constants.ts:1,3` — `TICK_RATE_HZ = 30`),
  or an ad-hoc one. Spawn already force-broadcasts a snapshot as a workaround, documented at
  `GameRoom.ts:2090-2094`: *"No dedicated projectile:spawned delta type exists (net-protocol is
  a blocked path this story)."*

Result: the dot appears on the caster (spawn snapshot), sits frozen there, then jumps to the
projectile's current position (or is gone) when the next snapshot lands. This gap was deferred at
**Story 3.19** (Souldrinker kit / projectile delivery) because net-protocol was blocked for that
story; it surfaced only when Story 7.4 first scrutinised the projectile visually. It blocks the
Story 7.8 projectile-body visuals just as hard as the current white circle.

**This story is host-agnostic.** No `apps/host-client/**` change is needed: `applyDelta` runs
unconditionally on every received delta (`host-session.ts:74`) and `renderFrame` reads
`state.projectiles` every frame (`DungeonScreen.tsx` Projectiles block), so a `projectile:moved`
delta smoothly moves the existing dot the moment it lands — exactly as `player:moved` already
drives player circles without a whitelist entry.

## Acceptance Criteria

1. **`ProjectileMovedDelta` exists and is wired into the contract.**
   **Given** `packages/net-protocol/src/messages/server-to-host.ts` has no `projectile:moved`
   member in `DeltaEventMsg` (`:287-325`),
   **when** this story ships,
   **then** a `ProjectileMovedDelta = { type: 'projectile:moved'; projectileId: string; x: number; y: number }`
   type exists, is added to the `DeltaEventMsg` union, and is re-exported from the barrel
   `packages/net-protocol/src/index.ts:5` **alongside `ProjectileHitDelta`/`ProjectileExpiredDelta`**
   (both are already re-exported there),
   **and** its field set **mirrors `ProjectileHitDelta` exactly minus the removal semantics**
   (`projectileId`, `x`, `y`) and matches the `player:moved`/`enemy:moved`/`boss:moved` movement-delta
   shape — no new fields invented.

2. **`applyDelta` moves the projectile in the host mirror.**
   **Given** `applyDelta`'s `switch` is exhaustive over `DeltaEventMsg` via a
   `const _exhaustive: never = evt` guard (`apply-delta.ts:289-292`), so adding a union member
   without a case is a **compile error**,
   **when** `ProjectileMovedDelta` is added,
   **then** `apply-delta.ts` gains a `case 'projectile:moved'` that **updates the matching
   projectile's `x`/`y`**, structurally mirroring `case 'player:moved'` (`:6-12`) /
   `case 'enemy:moved'` (`:133-…`): a `some(...)` presence guard that returns `state` unchanged
   when the projectile is not in the mirror (a `projectile:moved` that races ahead of the spawn
   snapshot is a safe no-op), else a `map` that replaces `x`/`y` on the matched projectile only,
   **and** it is a **real writer** of projectile position (unlike 7.7a's `boss:charged` no-op) —
   today nothing else in `applyDelta` moves a projectile, so this case is the sole delta writer.

3. **The sim broadcasts it from phase 3b, threshold-gated like `player:moved`.**
   **Given** `GameRoom.ts:1412-1420` currently reads the physics body back into
   `projectile.x/y` unconditionally and broadcasts nothing,
   **when** this story ships,
   **then** that loop is changed to mirror the `player:moved` read-back exactly
   (`GameRoom.ts:1399-1411`): compute `newX/newY` from `toPixels(body.getPosition())`, and only
   when `Math.abs(newX - projectile.x) > 0.5 || Math.abs(newY - projectile.y) > 0.5` **both**
   write `projectile.x/y = newX/newY` **and**
   `this.broadcast(EventNames.DELTA, { type: 'projectile:moved', projectileId: projectile.id, x: projectile.x, y: projectile.y } satisfies DeltaEventMsg)`,
   **and** **no other line of `tick`, the spawn path (`:2077-2095`), the hit/expired paths
   (`:1698-1706`), physics stepping, or cooldowns changes** — this story adds one broadcast and
   the same `>0.5 px` write-gate players already use. (The gate is a no-op in practice: a
   projectile travels `PROJECTILE_SPEED_PX_S / TICK_RATE_HZ = 600 / 30 = 20 px` per tick, always
   over the threshold, so it moves and broadcasts every tick until hit/expired.)

4. **Spawn and removal are unchanged.**
   **Given** projectile spawn force-broadcasts a full snapshot (`:2094`) and `projectile:hit`
   (`:1698-…`)/`projectile:expired` remove the projectile,
   **when** this story ships,
   **then** those paths are **left exactly as they are** — this story adds only in-flight motion.
   The spawn snapshot still seeds the projectile into every client mirror, so the first
   `projectile:moved` always lands on a projectile that already exists there. (Introducing a
   dedicated `projectile:spawned` delta to replace the spawn snapshot is explicitly **out of
   scope** — a separate optimisation.)

5. **Backward/forward compatibility is verified, not assumed.**
   **Given** an older client build that predates this delta,
   **when** it receives a `projectile:moved` message,
   **then** it degrades safely: `applyDelta`'s `default:` returns `state` unchanged with no throw
   (`apply-delta.ts:289-292`); the host transient-delta whitelist is a positive OR-chain
   (`host-session.ts:46-71`) so an unrecognised/movement delta is simply not forwarded to
   `onTransientDelta` (correct — `projectile:moved` is mirror state, **not** a transient visual,
   exactly like `player:moved`); the decode path is wrapped in `try { … } catch {}`. **The only
   compile-time consumers that could break are exhaustive switches — verified to be exactly one
   (`apply-delta.ts`), which AC2 fixes.** Every `satisfies DeltaEventMsg` site widens with a new
   member and cannot break.

6. **No host-client change is required, and none is made.**
   **Given** the host already creates a projectile `Graphics` on first-seen and repositions it
   from `state.projectiles` every frame (`DungeonScreen.tsx` Projectiles block) and Story 7.4's
   `projectileMeta` cache keys off the same projectiles,
   **when** this story ships,
   **then** **no file under `apps/host-client/**` is modified** — the moving dot follows the new
   deltas for free. (Confirm by inspection that the Projectiles block already reads
   `projectile.x/y`; it does.)

7. **A contract test covers the round-trip and the mirror update.**
   **Given** the project convention requires a serialize→deserialize round-trip test for every
   wire message type (see `tests/contract/net-protocol.test.ts`),
   **when** this story ships,
   **then** at least one contract test covers `ProjectileMovedDelta` round-trip **and**
   `applyDelta` behaviour: it updates `x`/`y` of the matching projectile and returns `state`
   unchanged (same reference) when the projectile id is absent — placed in the existing
   net-protocol contract suite, matching its established shape.

8. **Both hooks are discharged.**
   **Given** the **Contract-change hook** (net-protocol / DeltaEventMsg) and the
   **Simulation-safety hook** (`apps/simulation-server/**`) are TRIGGERED (CLAUDE.md),
   **when** this story is completed,
   **then** every requirement of both is recorded in the Dev Agent Record: Protocol Architect
   review, compatibility checklist, spec note, ≥1 contract test; typecheck, unit tests,
   deterministic-tick sanity, replay test (or an explicit "none exists" finding), and a per-tick
   perf sanity note.

## Tasks / Subtasks

- [x] **Task 1 — Protocol: define and export `ProjectileMovedDelta` (AC: 1). [Protocol Architect]**
  - [x] 1.1: In `packages/net-protocol/src/messages/server-to-host.ts`, add
    `export type ProjectileMovedDelta = { type: 'projectile:moved'; projectileId: string; x: number; y: number };`
    directly beside `ProjectileHitDelta` (`:236`), and add `| ProjectileMovedDelta` to the
    `DeltaEventMsg` union (`:287-325`), next to `ProjectileHitDelta`/`ProjectileExpiredDelta`.
  - [x] 1.2: Re-export `ProjectileMovedDelta` from `packages/net-protocol/src/index.ts:5`,
    alongside the already-re-exported `ProjectileHitDelta`/`ProjectileExpiredDelta`.

- [x] **Task 2 — Protocol: `applyDelta` case (AC: 2). [Protocol Architect]**
  - [x] 2.1: In `packages/net-protocol/src/apply-delta.ts`, add
    `case 'projectile:moved'` mirroring `case 'player:moved'` (`:6-12`): presence-guard with
    `state.projectiles.some(p => p.id === evt.projectileId)` → return `state` unchanged if absent;
    else `const projectiles = state.projectiles.map(p => p.id === evt.projectileId ? { ...p, x: evt.x, y: evt.y } : p); return { ...state, projectiles };`.
    The exhaustive-`never` guard will fail to compile until this case exists — that is the check.

- [x] **Task 3 — Simulation: broadcast from phase 3b (AC: 3, 4). [Simulation Engineer]**
  - [x] 3.1: In `apps/simulation-server/src/rooms/GameRoom.ts` "Planck phase 3b"
    (`:1412-1420`), replace the unconditional read-back with the `player:moved` pattern from
    `:1399-1411`: compute `newX/newY`, and inside a `> 0.5 px` move-gate both assign
    `projectile.x/y` and `this.broadcast(EventNames.DELTA, { type: 'projectile:moved', projectileId: projectile.id, x: projectile.x, y: projectile.y } satisfies DeltaEventMsg);`.
  - [x] 3.2: Confirm (and note in the Dev Agent Record) that **nothing else changes**: spawn
    snapshot (`:2094`), hit/expired removal (`:1698-1706`), the periodic snapshot (`:2904`), and
    the physics step are untouched.

- [x] **Task 4 — Contract test (AC: 7). [QA + Telemetry / Protocol Architect]**
  - [x] 4.1: In `tests/contract/net-protocol.test.ts`, add a `ProjectileMovedDelta` round-trip
    (encode→decode preserves `type/projectileId/x/y`) and two `applyDelta` assertions: (a) a
    projectile present in `state.projectiles` gets its `x/y` updated (others untouched); (b) a
    `projectile:moved` for an absent id returns the **same `state` reference**.

- [x] **Task 5 — Validation & hooks (AC: 5, 6, 8). [all]**
  - [x] 5.1: `npm run typecheck` at repo root (the exhaustive-`never` guard is the compile-time
    proof AC2 is complete).
  - [x] 5.2: `npm test` at repo root (contract + unit + sim); note the known-flaky WSL2 e2e
    behaviour if it appears (pre-existing — this story touches no e2e path).
  - [x] 5.3: Simulation-safety: deterministic-tick sanity (the broadcast is a pure side effect;
    projectile `x/y` was already written each tick — confirm no state-shape or ordering change),
    replay test (run if one exists, else record "none exists"), and a one-line per-tick perf note
    (≤ ~40 small `projectile:moved` broadcasts over a projectile's ≤ `800/600 ≈ 1.3 s` life;
    payload ~4 fields; one object literal per tick, matching `player:moved`).
  - [x] 5.4: Confirm AC6 by inspection — **no `apps/host-client/**` file touched** — and record it.

### Review Findings

_Code review 2026-07-24 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor: all 8 ACs SATISFIED. 0 decision-needed, 0 patch, 4 deferred, 5 dismissed as noise. No High confirmed; the two Medium findings were dismissed (B1: 0.5px gate is the mandated sibling pattern and moot at 20px/tick) or downgraded/deferred (B2: fan-out is the shipped delta model)._

- [x] [Review][Defer] Per-projectile per-tick broadcast fan-out — no coalescing [apps/simulation-server/src/rooms/GameRoom.ts:1413] — deferred, architectural: matches the shipped `player:moved`/`enemy:moved`/`boss:moved` delta model; codebase-wide delta batching is out of this story's scope. Perf note in AC8 already accounts for it.
- [x] [Review][Defer] No non-finite (NaN/Infinity) guard on physics read-back [apps/simulation-server/src/rooms/GameRoom.ts:1417] — deferred, pattern-wide: the sibling `:moved` loops share the identical gap; a NaN position would fail the `>0.5` gate, freeze the host dot and leak the body via `isProjectileExpired`. Speculative for these kinematic projectiles; fixing only here would break the "mirror exactly" mandate.
- [x] [Review][Defer] Phase-3b move-gate/broadcast has no direct sim unit test [apps/simulation-server/src/rooms/GameRoom.ts:1419] — deferred, low-value: the gate is a byte-for-byte mirror of the e2e-exercised `player:moved` gate; AC7 scoped coverage to the contract test (which is green).
- [x] [Review][Defer] Contract-change hook's Protocol Architect review is self-attested [_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md] — deferred, merge-gate: AC8 only requires the review be *recorded* (it is); an independent human Protocol Architect sign-off is still owed before merge per CLAUDE.md.

_Dismissed (noise/false-positive/by-design): B1 gate-staleness (mandated sibling pattern, moot at 20px/tick); B5 missing `DeltaEventMsg` import (false positive — typecheck clean, same file's `player:moved` broadcast already imports it); B6 two-pass `some`+`map` in applyDelta (by-design — preserves the referential-equality short-circuit the test asserts, mirrors the whole reducer); E3 same-tick move+expiry one-frame flicker (cosmetic, harmless, entity-agnostic); A1 `sprint-status.yaml` in Blocked paths (workflow-mandated status bookkeeping, not a code-scope violation)._

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Support/defect story inside the active **Epic 7** (Ability & Environmental VFX
  Prototyping). It unblocks the projectile visuals in Stories 7.4 (shipped, `review`) and 7.8
  (`ready-for-dev`): both render `state.projectiles`, which is only correct once positions stream.
- **Context:** Projectiles simulate correctly server-side but their motion is never sent to
  clients (no `projectile:moved`/`projectile:spawned` delta). See "Why this story exists" above.
- **Goal:** One new movement delta (`projectile:moved`), its `applyDelta` writer, and its per-tick
  broadcast — mirroring the existing `player:moved`/`enemy:moved`/`boss:moved` machinery exactly.
- **Allowed paths:**
  - `packages/net-protocol/src/messages/server-to-host.ts` (delta type + union member)
  - `packages/net-protocol/src/index.ts` (barrel re-export)
  - `packages/net-protocol/src/apply-delta.ts` (the new case)
  - `apps/simulation-server/src/rooms/GameRoom.ts` (**phase-3b block only** — one broadcast + the write-gate)
  - `tests/contract/net-protocol.test.ts` (the contract test)
  - `_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md` (Dev Agent Record)
- **Blocked paths:** `apps/host-client/**` (AC6 — no host change), `apps/mobile-controller/**`,
  `packages/game-rules/**`, `packages/shared-types/**` (**`ProjectileState` already carries `x`/`y`
  — no schema change**; if you find yourself editing it, stop), `packages/ui-kit/**`,
  `_bmad-output/implementation-artifacts/sprint-status.yaml`. Do **not** add a
  `projectile:spawned` delta or touch the spawn snapshot / hit / expired paths (AC4).
- **Inputs:** `server-to-host.ts` (delta shapes + union), `apply-delta.ts` (`player:moved` /
  `enemy:moved` cases + the exhaustive-`never` guard), `GameRoom.ts:1390-1420` (phases 3/3b),
  `GameRoom.ts:2077-2095` (spawn), `constants.ts` (`TICK_RATE_HZ`, `SNAPSHOT_INTERVAL_S`),
  `tests/contract/net-protocol.test.ts`, Story 7.7a (the sibling protocol+sim new-delta story).
- **Non-goals:** no `projectile:spawned` (AC4); no host or mobile change (AC6); no projectile-body
  visual (Story 7.8); no change to snapshot cadence, physics, or projectile lifetime; no new
  balance/geometry values.
- **Ownership check — CROSS-BOUNDARY (deliberate).** Touches `packages/net-protocol/**` (Protocol
  Architect), `apps/simulation-server/**` (Simulation Engineer) and `tests/**` (QA + Telemetry).
  A new wire delta is inherently a Protocol+Simulation collaboration and is **not sensibly
  splittable** — the broadcast cannot exist without the type, and the contract test validates
  both. This matches the shipped precedent **Story 7.7a** (`boss:charged` "delta-contract-and-
  broadcast"), which bundles the identical three areas into one story. Kept as one story with both
  hooks run; the CLAUDE.md "split unless strong reason" test is met by that strong reason.
- **Hook verdicts (all five):**
  - **Contract-change hook — TRIGGERED.** New `DeltaEventMsg` member in `packages/net-protocol`.
    Requires: Protocol Architect review, compatibility checklist (AC5), spec note, ≥1 contract
    test (AC7). No session-lifecycle / reconnect / room-state / join-flow / prediction surface
    is touched — it is a pure additive movement delta, backward-compatible by construction (AC5).
  - **Simulation-safety hook — TRIGGERED.** `apps/simulation-server/**` changes. Requires:
    typecheck, unit tests, deterministic-tick sanity, replay (or "none exists"), perf sanity
    (Task 5.3). The change adds a broadcast; `projectile.x/y` was already written each tick, so no
    new state or ordering is introduced.
  - **Client-UX hook — NOT triggered.** No host or mobile UI file changes (AC6). The visible
    effect (a smoothly flying dot) should still be eyeballed once during Story 7.4's outstanding
    manual pass, but no UI code is authored here.
  - **Telemetry hook — N/A.** No new user flow; existing projectile flow, now correctly synced.
  - **Ownership hook — cross-boundary, see the ownership check above.** Proceed as a single joint
    story per the 7.7a precedent.

### The pattern to mirror (verified at baseline `e007dfb`)

`player:moved` is the exact template — copy its shape, swap the entity:

```ts
// server-to-host.ts (delta type + union)          apply-delta.ts (the writer)
export type PlayerMovedDelta = {                    case 'player:moved': {
  type: 'player:moved';                               if (!state.players.some(p => p.id === evt.playerId)) return state;
  playerId: string; x: number; y: number;            const players = state.players.map(p =>
};                                                      p.id === evt.playerId ? { ...p, x: evt.x, y: evt.y } : p);
                                                       return { ...state, players };
                                                     }
```

```ts
// GameRoom.ts phase 3 (players) — the broadcast pattern to copy into phase 3b (projectiles)
const newX = toPixels(pos.x); const newY = toPixels(pos.y);
if (Math.abs(newX - player.x) > 0.5 || Math.abs(newY - player.y) > 0.5) {
  player.x = newX; player.y = newY;
  this.broadcast(EventNames.DELTA, { type: 'player:moved', playerId: player.id, x: player.x, y: player.y } satisfies DeltaEventMsg);
}
```

Phase 3b (projectiles) today omits both the gate and the broadcast:

```ts
for (const projectile of this.gameState.projectiles) {
  const body = this.projectileBodies.get(projectile.id);
  if (!body) continue;
  const pos = body.getPosition();
  projectile.x = toPixels(pos.x);   // ← unconditional write, no broadcast
  projectile.y = toPixels(pos.y);
}
```

### Why no host change (AC6)

The host mirror is delta-driven via `applyDelta` (`host-session.ts:74`), and `renderFrame` reads
`state.projectiles` every frame to reposition the dot. A `projectile:moved` handled by `applyDelta`
updates the mirror, and the next frame moves the dot — identically to how `player:moved` moves
player circles. `projectile:moved` is **mirror state, not a transient visual**, so it must **not**
be added to the `host-session.ts` transient-delta whitelist (that list is only for one-shot visual
deltas forwarded to React; `player:moved`/`enemy:moved` are correctly absent from it).

### Testing Standards

- Contract tests live in `tests/contract/`; `net-protocol.test.ts` is the round-trip suite. Follow
  its established encode/decode + `applyDelta` assertion shape (see the existing `player:moved` /
  `projectile:hit` coverage there if present).
- `npm run typecheck` at repo root covers all 10 tsconfigs and is the compile-time proof the
  exhaustive-`never` case is satisfied. `npm test` at root is the full suite.
- **Known-flaky, NOT caused by this story:** `tests/e2e` intermittently fails under WSL2
  (simulation-server boot timeout; a heal assertion). Note it if seen; this story touches no e2e
  path. Never claim a test passed that was not actually run.

### Project Context Rules

- **Ownership:** `packages/net-protocol/**` = Protocol Architect; `apps/simulation-server/**` =
  Simulation Engineer; `tests/**` = QA + Telemetry. Protected core layers — be extra strict.
- Events are named `noun:verb`; wire delta types are `PascalCase + Delta`; the union
  `DeltaEventMsg` is exhaustive with a `never` guard. Keep additive changes backward-compatible.
- Host may not import `game-rules`; not relevant here (no host change).
- Do not move gameplay authority: the sim remains the sole writer of projectile position; clients
  only mirror it.

### References

- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1390-1420`] — Planck phase 3 (`player:moved`
  broadcast to copy) and phase 3b (projectile read-back to change).
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2077-2095`] — projectile spawn +
  force-snapshot workaround, with the `:2090` comment naming this exact deferral.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:2903-2907`] — periodic 5 s snapshot.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1698-1706`] — projectile hit/expired removal (leave untouched).
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:5-13,53-60,182-188,236-246,287-325`]
  — `PlayerMovedDelta`/`EnemyMovedDelta`/`BossMovedDelta`/`ProjectileHitDelta`/`ProjectileExpiredDelta`
  and the `DeltaEventMsg` union.
- [Source: `packages/net-protocol/src/index.ts:5`] — barrel re-export list (add `ProjectileMovedDelta`).
- [Source: `packages/net-protocol/src/apply-delta.ts:6-12,133-…,247-252,289-292`] — `player:moved` /
  `enemy:moved` / `projectile:hit|expired` cases and the exhaustive-`never` guard.
- [Source: `packages/shared-types/src/projectile.ts:3-10`] — `ProjectileState` already has `x`/`y`
  (no schema change).
- [Source: `packages/shared-types/src/constants.ts:1,3`] — `TICK_RATE_HZ = 30`, `SNAPSHOT_INTERVAL_S = 5`.
- [Source: `apps/host-client/src/session/host-session.ts:46-74`] — transient-delta whitelist (OR-chain;
  `projectile:moved` deliberately NOT added) and the unconditional `applyDelta` call.
- [Source: `_bmad-output/implementation-artifacts/7-7a-boss-charged-delta-contract-and-broadcast.md`]
  — the sibling protocol+sim new-delta story this one mirrors in structure and hook handling.
- [Source: `_bmad-output/implementation-artifacts/7-4-souldrinker-ability-vfx.md`] — the playtest that
  surfaced this defect (Blood Spike / Void Pulse dots frozen/teleporting).
- [Source: `CLAUDE.md`] — ownership rules, contract-change hook, simulation-safety hook, merge gate.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (gds-dev-story workflow)

### Debug Log References

- `npm run typecheck` — clean across all 10 tsconfigs (the exhaustive-`never` guard in `apply-delta.ts` compiled, proving AC2's `case 'projectile:moved'` exists).
- `npx vitest run tests/contract/net-protocol.test.ts` — PASS (98), including the three new Story 7.10 assertions.
- `npm test` (full suite) — 525 passed, 3 skipped, 3 failed. All 3 failures verified **pre-existing / known-flaky**, none touch this story's paths:
  - `apps/host-client/src/vfx/ability-vfx.test.ts` "centres Stone Wall… on the caster (AC2)" — reproduced **identically with this story's changes `git stash`ed** (baseline `e007dfb` state), so it is a pre-existing epic-7 host-VFX failure, not a 7.10 regression. Story 7.10 modifies no `apps/host-client/**` file.
  - `tests/e2e/ability-dispatch.test.ts` × 2 (Ancestor's Voice heal assertion; Storm Eye zone-tick timeout, preceded by a "simulation-server did not start within 60s" boot timeout) — the documented WSL2 e2e flake (boot timeout + heal assertion) called out in Dev Notes → Testing Standards. This story touches no e2e path.

### Completion Notes List

- **AC1 — done.** `ProjectileMovedDelta = { type: 'projectile:moved'; projectileId: string; x: number; y: number }` added to `server-to-host.ts` beside `ProjectileHitDelta`, appended to the `DeltaEventMsg` union, and re-exported from the `index.ts:5` barrel alongside `ProjectileHitDelta`/`ProjectileExpiredDelta`. Field set mirrors `ProjectileHitDelta` minus removal semantics and matches the `player:moved`/`enemy:moved`/`boss:moved` movement shape — no new fields.
- **AC2 — done.** `case 'projectile:moved'` in `apply-delta.ts` structurally mirrors `case 'player:moved'`: `some(...)` presence guard returns `state` unchanged when the projectile is absent (safe no-op when a move races ahead of the spawn snapshot), else a `map` replacing `x`/`y` on the matched projectile only. It is the sole `applyDelta` writer of projectile position (a real writer, not a 7.7a-style no-op).
- **AC3 — done.** GameRoom phase 3b now mirrors the phase-3 `player:moved` read-back exactly: compute `newX/newY` from `toPixels(body.getPosition())`, and only when `Math.abs(newX - projectile.x) > 0.5 || Math.abs(newY - projectile.y) > 0.5` both write `projectile.x/y` and `this.broadcast(EventNames.DELTA, { type: 'projectile:moved', … } satisfies DeltaEventMsg)`.
- **AC4 — done (Task 3.2 confirmation).** Nothing else changed. The spawn path + force-snapshot (`:2094`), the hit/expired removal paths, the periodic 5 s snapshot, physics stepping, and cooldowns are all untouched — the edit is confined to the phase-3b loop body. No `projectile:spawned` delta introduced. The spawn snapshot still seeds the projectile into every mirror, so the first `projectile:moved` always lands on an existing projectile (and if not, AC2's presence guard makes it a no-op).
- **AC5 — verified (compatibility checklist below).** Purely additive movement delta; backward-compatible by construction.
- **AC6 — done (Task 5.4).** No `apps/host-client/**` file modified — confirmed by the File List and by the `git stash` reproduction of the unrelated host VFX failure. The host mirror is delta-driven (`host-session.ts:74` calls `applyDelta` unconditionally) and `renderFrame` reads `state.projectiles` every frame, so the dot follows the new deltas for free. `projectile:moved` is mirror state, **not** a transient visual, so it was deliberately **not** added to the `host-session.ts` transient-delta whitelist (correct — `player:moved`/`enemy:moved` are absent from it too).
- **AC7 — done.** `tests/contract/net-protocol.test.ts` gains: (a) `ProjectileMovedDelta` serialize→deserialize round-trip; (b) `applyDelta` updates `x/y` of the matched projectile only (sibling `proj-2` untouched, original state not mutated); (c) `applyDelta` returns the **same `state` reference** for an absent projectile id (`toBe(state)`).

#### AC8 — Hook discharge

**Contract-change hook (TRIGGERED — new `DeltaEventMsg` member in `packages/net-protocol`):**
- Protocol Architect review — **required** (flagged below; cross-boundary story, mirrors Story 7.7a precedent).
- Compatibility checklist (AC5):
  - Additive-only: one new union member, no existing member altered. ✅
  - Older client receiving `projectile:moved`: `applyDelta` `default:` returns `state` unchanged, no throw (`apply-delta.ts` exhaustive guard). ✅
  - Host transient whitelist is a positive OR-chain (`host-session.ts:46-71`) — an unrecognised/movement delta is simply not forwarded to `onTransientDelta`; correct, since `projectile:moved` is mirror state, not a transient visual. ✅
  - Decode path wrapped in `try { … } catch {}`. ✅
  - Only compile-time consumers that could break are exhaustive switches — verified to be exactly one (`apply-delta.ts`), fixed by AC2; every `satisfies DeltaEventMsg` site widens with the new member and cannot break. ✅
  - Typecheck clean across all 10 tsconfigs. ✅
- Spec note: additive movement delta mirroring `player:moved`/`enemy:moved`/`boss:moved`; no session-lifecycle / reconnect / room-state / join-flow / prediction surface touched.
- ≥1 contract test: AC7 (round-trip + two `applyDelta` assertions). ✅

**Simulation-safety hook (TRIGGERED — `apps/simulation-server/**` change):**
- Typecheck — clean. ✅
- Unit tests — full suite run; contract suite green (98). ✅
- Deterministic-tick sanity: the change adds a `broadcast` side effect only; `projectile.x/y` was already written every tick, so no new `GameState` field, no read/write ordering change, no new allocation in the hot path beyond the same per-move object literal `player:moved` already emits. Determinism of the sim state is unaffected (broadcast does not feed back into state). ✅
- Replay test: **none exists** in the repo for this path (no projectile replay harness) — recorded as "none exists" per Task 5.3.
- Per-tick perf note: a projectile lives ≤ `800/600 ≈ 1.3 s` (≈ ≤40 ticks) and moves `PROJECTILE_SPEED_PX_S / TICK_RATE_HZ = 600/30 = 20 px` per tick — always over the `0.5 px` gate, so it broadcasts once per tick until hit/expired. One 4-field object literal + one `broadcast` per in-flight projectile per tick, identical in cost to the existing `player:moved` path. Negligible against the 33 ms budget for the handful of concurrent projectiles a party produces. ✅

**Client-UX hook — NOT triggered** (no host/mobile UI file changed; AC6). **Telemetry hook — N/A** (no new user flow). **Ownership hook — cross-boundary, deliberate**, per the Story 7.7a precedent (see Dev Notes → Ownership check): net-protocol + simulation-server + tests bundled because a new wire delta is inherently a Protocol+Simulation collaboration that is not sensibly splittable.

**Confidence: 96%** — mechanical mirror of a proven, well-covered pattern (`player:moved`); typecheck + contract tests green; the only test failures are reproduced pre-existing/known-flaky and outside this story's paths. The −4% is the one thing tests cannot prove headlessly: the end-to-end visual (a smoothly flying dot) still wants a one-time eyeball during Story 7.4's outstanding manual pass.

### File List

- `packages/net-protocol/src/messages/server-to-host.ts` (modified — `ProjectileMovedDelta` type + union member)
- `packages/net-protocol/src/index.ts` (modified — barrel re-export)
- `packages/net-protocol/src/apply-delta.ts` (modified — `case 'projectile:moved'`)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — phase-3b broadcast + write-gate)
- `tests/contract/net-protocol.test.ts` (modified — round-trip + 2 `applyDelta` assertions)
- `_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md` (this file — Dev Agent Record)

## Change Log

| Date | Change |
|---|---|
| 2026-07-24 | Story 7.10 implemented — added `ProjectileMovedDelta` to net-protocol (type + `DeltaEventMsg` union + barrel re-export), the `applyDelta` `case 'projectile:moved'` writer, the per-tick `>0.5 px`-gated broadcast in GameRoom phase 3b, and contract tests (round-trip + present/absent `applyDelta` assertions). Typecheck clean; contract suite green; 3 remaining full-suite failures verified pre-existing/known-flaky and outside this story's paths (host VFX test reproduced with changes stashed; WSL2 e2e flake). Contract-change + Simulation-safety hooks discharged; Protocol Architect review flagged. No host-client change (AC6). Confidence 96%. |
| 2026-07-23 | Story 7.10 created — stream in-flight projectile positions via a new `projectile:moved` delta (contract + `applyDelta` writer + per-tick sim broadcast), fixing the frozen/teleporting projectile dot found in the Story 7.4 playtest. Mirrors the `player:moved` machinery and the Story 7.7a protocol+sim new-delta precedent; no host-client change. Contract-change + Simulation-safety hooks triggered. |

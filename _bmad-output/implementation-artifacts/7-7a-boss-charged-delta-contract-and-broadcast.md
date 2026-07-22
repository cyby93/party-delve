---
baseline_commit: 884dacbd8b7793465697ca9163ee299bfc02dce8
---

# Story 7.7a: `boss:charged` Delta Contract & Broadcast

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Protocol Architect + Simulation Engineer,
I want the Grassland boss's charge attack to exist as a real wire delta (`boss:charged`) that the simulation server actually broadcasts,
so that Story 7.7b can render a charge visual on the host without any further protocol or simulation work.

**Why this story exists (epic correction — approved by the user 2026-07-22):**
`epics.md:2024-2041` (Story 7.7) claims `boss:charged` merely needs adding to the host's
transient-delta whitelist. **That is false.** Verified at baseline `884dacb`:

- `BossChargedEvent` exists only as an *internal simulation* event type
  (`packages/game-rules/src/entities/grassland-boss.ts:15`, emitted by `tryCharge` at `:90`).
- The simulation server **explicitly swallows it**:
  `apps/simulation-server/src/rooms/GameRoom.ts:1926-1928` —
  `case 'boss:charged': // ponytail: charge is a movement event handled by tickBoss — no client delta needed; break;`
- There is **no `BossChargedDelta`** anywhere in `packages/net-protocol` — not in the
  `DeltaEventMsg` union (`server-to-host.ts:287-331`), not in the barrel export
  (`index.ts:5`), and no `applyDelta` case (`apply-delta.ts:5-295`).

So a whitelist entry alone would forward a delta that is never sent. Making the charge
visible requires work in three ownership areas, so the work was split: **7.7a** (this story)
is the protocol + simulation half; **7.7b** is the host-rendering half
(`apps/host-client/**`: whitelist + the VFX built on Story 7.1's primitives).

**7.7a alone is safely shippable.** After this story the delta is broadcast but nothing
consumes it — exactly the same inert state Story 7.1 shipped in (its AC3: library built,
deliberately unwired). That is intentional, not an oversight, and must be stated in the
completion notes.

## Acceptance Criteria

1. **Given** `packages/net-protocol/src/messages/server-to-host.ts` has no `boss:charged`
   member in `DeltaEventMsg` (`:287-331`),
   **when** this story ships,
   **then** a `BossChargedDelta = { type: 'boss:charged'; bossId: string; x: number; y: number }`
   type exists, is added to the `DeltaEventMsg` union, and is re-exported from
   `packages/net-protocol/src/index.ts:5` alongside `BossStompedDelta`,
   **and** its field set **mirrors the internal `BossChargedEvent` exactly**
   (`grassland-boss.ts:15` — `bossId`, `x`, `y`; **no `radius`**, unlike `BossStompedDelta`,
   because the sim event carries none and inventing one would be a fabricated contract).

2. **Given** `applyDelta`'s `switch` is exhaustive over `DeltaEventMsg` via a
   `const _exhaustive: never = evt` guard (`apply-delta.ts:289-294`), so adding a union member
   without a case is a **compile error**,
   **when** `BossChargedDelta` is added,
   **then** `apply-delta.ts` gains an explicit `case 'boss:charged': return state;` **no-op**
   with a `ponytail:` comment in the house style used by the neighbouring
   `case 'boss:stomped'` (`:185-186`) and `case 'enemy:stomped'` (`:131-132`),
   **and** that comment states *why* it is a no-op so a later reader does not "fix" it into a
   second writer of `boss.position` (see AC3).

3. **Given** `BossMovedDelta` is today the only `applyDelta` writer of `state.boss.position`
   (`apply-delta.ts:181-184`) and `tryCharge` **returns early** from `tickBoss`
   (`grassland-boss.ts:186-189`) so **no `boss:moved` is emitted on the charge tick itself**,
   **when** the no-op is implemented,
   **then** the story records the verified convergence behaviour rather than asserting a
   simplification: the host mirror's `boss.position` is stale by at most
   `min(len, BOSS_CHARGE_SPEED × dt) = min(len, 350 ÷ 30) ≈ 11.7 px` (boss render radius is
   48 px) for at most one 33 ms tick, and converges via the **next** tick's `boss:moved`
   (`grassland-boss.ts:127`) or, unconditionally, via the periodic snapshot broadcast,
   **and** single-writer ownership of `boss.position` is preserved deliberately.

4. **Given** `GameRoom.ts:1926-1928` swallows the event,
   **when** this story ships,
   **then** that `break;`-only case is replaced by a
   `this.broadcast(EventNames.DELTA, { type: 'boss:charged', bossId: evt.bossId, x: evt.x, y: evt.y } satisfies DeltaEventMsg);`
   that structurally matches the neighbouring `case 'boss:stomped'` (`:1913-1918`) and
   `case 'boss:moved'` (`:1904-1911`) blocks,
   **and** **no other line of `tickBoss`, the boss FSM, `tryCharge`, cooldowns, phase
   transitions, damage resolution, or physics-body handling changes** — this story adds one
   broadcast, nothing else.

5. **Given** the user's explicit decision (2026-07-22),
   **when** this story ships,
   **then** **no sim-side windup/telegraph FSM state is added.** `tryCharge`
   (`grassland-boss.ts:78-91`) fires once, moves the boss in a single tick and enters a
   150-tick cooldown — the event is inherently **post-hoc**. `boss:charged` therefore
   describes a charge that has *already happened*; 7.7b renders a post-hoc dash/impact
   visual, **not** a pre-attack telegraph. A pre-attack windup would be a boss behaviour
   change and an Epic 7 non-goal.

6. **Given** an older host build that predates this delta,
   **when** it receives a `boss:charged` message,
   **then** it degrades safely and this is verified, not assumed:
   `applyDelta`'s `default:` branch returns `state` unchanged with no throw
   (`apply-delta.ts:289-294`); `host-session.ts:44-63`'s whitelist is a positive OR-chain, so
   an unknown type is simply not forwarded to `onTransientDelta`; `mobile-session.ts:73-78`
   hands the delta to an `if`/`else if` chain in `App.tsx:136-146` with no exhaustive switch;
   and the decode path is wrapped in `try { … } catch { /* ignore malformed delta */ }`.
   **And** the only compile-time consumers of the union that could break are exhaustive
   switches — verified to be exactly one (`apply-delta.ts`), which AC2 fixes. Every
   `satisfies DeltaEventMsg` site (`GameRoom.ts` broadcast literals,
   `tests/contract/net-protocol.test.ts`) **widens** with a new member and cannot break.

7. **Given** the 30 Hz tick-loop hygiene rules (`project-context.md:81-88`),
   **when** the broadcast is added,
   **then** the added per-tick cost is bounded and quantified: `tryCharge` fires at most once
   per `BOSS_CHARGE_COOLDOWN_TICKS = 150` ticks (**1 broadcast per 5 s**), only while
   `boss.phase !== Phase1 && difficulty !== EASY` (`grassland-boss.ts:186`) and only when the
   nearest player is 200–600 px away (`:81`) — i.e. ≤ 12 broadcasts in a 60 s boss fight,
   of a ~4-field payload,
   **and** the added code introduces **no `logger.info`/`warn`/`error`**, no `JSON` work, and
   allocates exactly one object literal per charge (matching what `boss:stomped` and
   `boss:moved` already do on their own paths).

8. **Given** `project-context.md:194-205` requires a serialize → deserialize round-trip test
   for every wire message type,
   **when** this story ships,
   **then** at least one contract test covers `BossChargedDelta` round-trip **and** the
   `applyDelta` no-op (same-reference return), placed in the existing boss-delta contract
   suite and matching its established shape.

9. **Given** both the **Contract-change hook** and the **Simulation-safety hook** are
   TRIGGERED (CLAUDE.md),
   **when** this story is completed,
   **then** every requirement of both hooks is discharged and recorded in the Dev Agent
   Record: Protocol Architect review, compatibility checklist, spec update, ≥1 contract test;
   typecheck, unit tests, deterministic tick check, replay test (or an explicit
   "none exists" finding), and a perf sanity note.

## Tasks / Subtasks

- [ ] **Task 1: Read before writing — confirm the baseline claims** (AC: 1, 2, 3, 4, 6)
  - [ ] 1.1: `packages/net-protocol/src/messages/server-to-host.ts` — read the whole union;
        `BossStompedDelta` (`:189-195`) is the closest template (same neighbourhood, same
        `bossId/x/y` prefix). Confirm no `boss:charged` member exists.
  - [ ] 1.2: `packages/net-protocol/src/apply-delta.ts` — read `case 'boss:stomped'` (`:185-186`),
        `case 'enemy:stomped'` (`:131-132`), `case 'boss:moved'` (`:181-184`) and the
        `default:` exhaustiveness guard (`:289-294`).
  - [ ] 1.3: `packages/game-rules/src/entities/grassland-boss.ts` — `BossChargedEvent` (`:15`),
        `tryCharge` (`:78-91`), the charge gate (`:186-189`). **Read-only: do not edit this file.**
  - [ ] 1.4: `apps/simulation-server/src/rooms/GameRoom.ts:1888-1960` — the boss-event switch.
  - [ ] 1.5: Verify nothing else must change:
        `rtk grep -rn "boss:charged" --include=*.ts .` (expect exactly 3 hits at baseline:
        `grassland-boss.ts:15`, `grassland-boss.ts:90`, `GameRoom.ts:1926`).

- [ ] **Task 2: Add `BossChargedDelta` to the protocol** (AC: 1)
  - [ ] 2.1: In `server-to-host.ts`, add immediately after `BossStompedDelta` (`:189-195`):
        ```ts
        // The Grassland boss's charge lunge (Story 7.7a). Post-hoc: tryCharge moves the boss
        // and fires this in the same tick — there is no windup/telegraph state on the sim side.
        // x/y are the boss's POST-charge position. No radius (unlike boss:stomped) — the sim
        // event carries none; charge damage is resolved by contact, not an AoE radius.
        export type BossChargedDelta = {
          type: 'boss:charged';
          bossId: string;
          x: number;
          y: number;
        };
        ```
  - [ ] 2.2: Add `| BossChargedDelta` to the `DeltaEventMsg` union, positioned next to
        `BossStompedDelta` (`:320`) to keep the boss members grouped.
  - [ ] 2.3: Add `BossChargedDelta` to the `export type { … }` list in
        `packages/net-protocol/src/index.ts:5`, next to `BossStompedDelta`. **Do not skip this** —
        the contract test imports the named type, and every other delta type is exported there.

- [ ] **Task 3: Add the explicit `applyDelta` no-op** (AC: 2, 3)
  - [ ] 3.1: In `apply-delta.ts`, directly under `case 'boss:stomped'` (`:185-186`), add:
        ```ts
        case 'boss:charged':
          return state;  // ponytail: visual only; DungeonScreen reads raw delta. Deliberately does NOT
                         // write boss.position — boss:moved is the single writer (line 181). tryCharge
                         // returns early so no boss:moved fires on the charge tick, leaving the mirror
                         // ≤11.7px stale (350px/s ÷ 30hz, vs a 48px boss) for ≤1 tick before the next
                         // boss:moved or the periodic snapshot corrects it. Not a bug — do not "fix"
                         // this into a second position writer.
        ```
  - [ ] 3.2: Confirm the `default:` `never` guard now compiles (it will fail loudly if 3.1 was skipped).

- [ ] **Task 4: Replace the swallow with a broadcast in `GameRoom`** (AC: 4, 5, 7)
  - [ ] 4.1: Replace `GameRoom.ts:1926-1928` with:
        ```ts
        case 'boss:charged':
          // Story 7.7a: post-hoc charge notification for host VFX. tickBoss has already
          // applied the movement to this.gameState.boss.position (same object reference),
          // so this broadcast is purely additive — no state write here.
          this.broadcast(EventNames.DELTA, {
            type: 'boss:charged', bossId: evt.bossId, x: evt.x, y: evt.y,
          } satisfies DeltaEventMsg);
          break;
        ```
  - [ ] 4.2: Do **not** add a `this.gameState.boss.position` write (unlike `case 'boss:moved'`
        at `:1905-1906`, which is redundant anyway since `tickBoss` mutates the same object).
        Do **not** add a `this.bossBody.setPosition(...)` call — see Dev Notes
        "Adjacent issue found, deliberately out of scope".
  - [ ] 4.3: Confirm no `logger.*` call was added inside the tick path (AC7).

- [ ] **Task 5: Contract test** (AC: 8)
  - [ ] 5.1: Extend `tests/contract/net-protocol.test.ts`'s
        `describe('Story 6.1 boss delta round-trips')` block (`:738-770`) — this is where every
        other boss delta round-trip lives. Add `BossChargedDelta` to the `net-protocol` type
        import on `:3`. Match the block's existing shape exactly:
        ```ts
        it('BossChargedDelta round-trip (Story 7.7a)', () => {
          const delta: BossChargedDelta = { type: 'boss:charged', bossId: 'boss-1', x: 512.5, y: 384.25 };
          const encoded = serialize(delta);
          const decoded = deserialize(encoded) as BossChargedDelta;
          expect(decoded).toEqual(delta);
        });
        ```
  - [ ] 5.2: Add the `applyDelta` no-op assertion in the same block (use the file's existing
        `mockGameState()` helper, `:10-37`, and give it a non-null `boss` so the assertion is
        meaningful rather than vacuous):
        ```ts
        it('applyDelta boss:charged is a no-op and does not move the mirrored boss', () => {
          const state = /* mockGameState() with a boss at a known (x, y) */;
          const next = applyDelta(state, { type: 'boss:charged', bossId: 'boss-1', x: 999, y: 999 });
          expect(next).toBe(state);                       // same reference — no new object
          expect(next.boss?.position).toEqual({ x: /* original */, y: /* original */ });
        });
        ```
  - [ ] 5.3: Also assert the delta round-trips through the generic union
        (`satisfies DeltaEventMsg`), the pattern used at `:91-100` — this is what proves the
        union member itself is wired, not just the standalone type.
  - [ ] 5.4: Run: `cd /home/cyby/projects/party-delve/tests && npx vitest run contract/net-protocol.test.ts`

- [ ] **Task 6: Contract-change hook discharge** (AC: 9) — *triggered: `packages/net-protocol/**` changed*
  - [ ] 6.1: **Protocol Architect review** — request explicit review of the diff to
        `server-to-host.ts`, `index.ts`, `apply-delta.ts` before merge. Record the outcome in
        the Dev Agent Record.
  - [ ] 6.2: **Compatibility checklist** — walk and record each item of the checklist in
        Dev Notes → "Backward Compatibility Checklist". Do not tick items you did not verify.
  - [ ] 6.3: **Spec update** — `docs/specs/networking-spec.md` does not enumerate
        `DeltaEventMsg` members (verified: `rtk grep -n "boss:" docs/specs/networking-spec.md`
        returns nothing), so the minimal honest update is a one-line entry under
        **Simulation Events** (`networking-spec.md:49-57`) reading
        ``- `boss:charged` — post-hoc notification that the Grassland boss's charge lunge
        resolved; visual-only, carries the boss's post-charge `(x, y)`; no state mutation on
        the client (Story 7.7a)``. `docs/specs/**` is co-owned by Orchestrator + Protocol
        Architect (CLAUDE.md § Ownership Rules) — this is the only file outside the two code
        ownership areas this story may touch. **No new ADR** — this adds a union member
        to an existing contract; it changes no authority boundary, session lifecycle, or
        reconnect flow, which is what ADR-0001/0002 cover.
  - [ ] 6.4: **≥1 contract test** — satisfied by Task 5.

- [ ] **Task 7: Simulation-safety hook discharge** (AC: 9) — *triggered: `apps/simulation-server/**` changed*
  - [ ] 7.1: **Typecheck (all 10 tsconfigs):** `cd /home/cyby/projects/party-delve && npm run typecheck`
        — must exit 0. This is also the AC2/AC6 exhaustiveness proof.
  - [ ] 7.2: **Unit tests:** `cd /home/cyby/projects/party-delve/tests && npx vitest run unit`
        — the pure-logic suites. No behaviour change is expected; any failure means Task 4
        touched more than the broadcast.
  - [ ] 7.3: **Simulation-server suites:**
        `cd /home/cyby/projects/party-delve/apps/simulation-server && npx vitest run`
        — 9 `game-room-*` / `physics-world` suites.
  - [ ] 7.4: **Deterministic tick test:** there is **no dedicated boss-tick determinism suite**
        (verified: `find apps/simulation-server/tests -name "*boss*"` → 0 results). Discharge
        this by *reasoning recorded in the Dev Agent Record*: this story adds zero reads or
        writes of `boss` state, zero PRNG consumption, and zero branch conditions — `tickBoss`'s
        output sequence for a given seed is byte-identical before and after. If you touched
        anything inside `packages/game-rules/**`, this reasoning is void and a real
        determinism test is required instead.
  - [ ] 7.5: **Replay test:** none exists in this repo (verified:
        `rtk grep -rn "replay" tests/ apps/simulation-server/` → 0 hits). Record
        "no replay harness exists — N/A" rather than silently omitting it.
  - [ ] 7.6: **Perf sanity:** record the AC7 quantification (≤1 broadcast per 150 ticks / 5 s,
        phase 2–3 + non-EASY only, ≤12 per 60 s fight, one small object literal per charge, no
        logging). No profiling run is warranted for a bounded, cooldown-gated single broadcast;
        say so explicitly rather than claiming a profile was done.

- [ ] **Task 8: Full-suite regression + honest flake accounting** (AC: 4, 9)
  - [ ] 8.1: `cd /home/cyby/projects/party-delve && npm test` (root, full suite).
  - [ ] 8.2: `tests/e2e` is **known-flaky under WSL2** and not caused by this story — a 60 s
        simulation-server boot timeout (`tests/helpers/server.ts:37`) and a heal assertion at
        `tests/e2e/ability-dispatch.test.ts:227`, documented in Story 7.1's Debug Log. Apply the
        two-strike rule: re-run `tests/e2e` in isolation; if the failure set *changes* between
        runs it is the known flake — record both runs, do not chase it, do not claim it passed.

- [ ] **Task 9: Self-check before marking done** (AC: 1-9)
  - [ ] 9.1: `cd /home/cyby/projects/party-delve && rtk git diff --stat` — the changed-file set
        must be **exactly**: `packages/net-protocol/src/messages/server-to-host.ts`,
        `packages/net-protocol/src/index.ts`, `packages/net-protocol/src/apply-delta.ts`,
        `apps/simulation-server/src/rooms/GameRoom.ts`, `tests/contract/net-protocol.test.ts`,
        `docs/specs/networking-spec.md`, and this story file. **Any `apps/host-client/**` or
        `packages/game-rules/**` entry is a blocked-path violation — revert it.**
  - [ ] 9.2: Confirm `GameRoom.ts`'s diff is the single `case 'boss:charged'` block and nothing else.
  - [ ] 9.3: Confirm the completion notes state that **the delta is deliberately unconsumed**
        after this story (7.7b wires the host) and that **no windup/telegraph state was added**.
  - [ ] 9.4: Confirm `_bmad-output/implementation-artifacts/sprint-status.yaml` was **not** edited
        by the story-creation step (the dev-story workflow updates it at its own point).

## Dev Notes

### Pre-Task Hook (CLAUDE.md)

- **Phase:** Epic 7 — Ability & Environmental VFX Prototyping (inserted via
  `sprint-change-proposal-2026-07-21.md`). This story is the protocol/simulation half of a
  user-approved split of epic Story 7.7.
- **Context:** `epics.md:2024-2041` mis-states the work as a one-line host whitelist fix. The
  delta type does not exist and the sim event is swallowed at `GameRoom.ts:1926-1928`. See
  "Why this story exists" above for the full verified evidence.
- **Goal:** `boss:charged` becomes a first-class `DeltaEventMsg` member with an explicit
  no-op `applyDelta` case, and the simulation server broadcasts it. Nothing renders yet.
- **Allowed paths:**
  - `packages/net-protocol/src/messages/server-to-host.ts` (MODIFY — add type + union member)
  - `packages/net-protocol/src/index.ts` (MODIFY — one export-list entry)
  - `packages/net-protocol/src/apply-delta.ts` (MODIFY — one no-op case)
  - `apps/simulation-server/src/rooms/GameRoom.ts` (MODIFY — replace the swallow at `:1926-1928`
    with a broadcast; **this one case block only**)
  - `tests/contract/net-protocol.test.ts` (MODIFY — extend the boss round-trip block)
  - `docs/specs/networking-spec.md` (MODIFY — one Simulation Events line; Contract-change hook)
- **Blocked paths:**
  - `apps/host-client/**` — **the whitelist entry and the visual are Story 7.7b's scope.**
    Adding the whitelist entry here would forward a delta into a `DungeonScreen.tsx`
    if/else chain that has no branch for it: harmless, but it is 7.7b's AC and duplicating it
    creates a merge conflict for no gain.
  - `packages/game-rules/**` — **read-only.** `BossChargedEvent` and `tryCharge` are already
    correct; the delta mirrors them. Touching this triggers a *different* review path and
    voids the determinism reasoning in Task 7.4.
  - `packages/shared-types/**` — no new shared type is needed; `BossChargedDelta` is a wire
    type and belongs in `net-protocol` like every other delta.
  - `apps/mobile-controller/**`, `packages/ui-kit/**`, `packages/telemetry/**` — untouched.
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` — not edited by this story file.
- **Inputs:** `grassland-boss.ts:13-26,78-91,186-189` (event shape + firing conditions);
  `server-to-host.ts:189-195` (`BossStompedDelta` template); `apply-delta.ts:131-132,181-186,289-294`;
  `GameRoom.ts:1888-1960`; `tests/contract/net-protocol.test.ts:738-770`;
  `project-context.md:81-88,194-205,289-297`; `dev-5-boss-transient-delta-whitelist-fix.md`
  (closest prior art in this exact area).
- **Non-goals:**
  - **No sim-side windup/telegraph FSM state** (user decision, 2026-07-22). The event is post-hoc
    by construction — see AC5.
  - No change to boss behaviour, cooldowns, phases, damage, movement or physics.
  - No host rendering, no whitelist entry, no VFX (7.7b).
  - Epic 7 non-goals still apply: no final pixel-art sprites, no new abilities or mechanics
    (`epics.md:2061`). Epic 7's "no protocol/schema changes" clause names this story as
    its one deliberate, user-approved exception.
- **Ownership check — cross-context, EXPLICITLY APPROVED:** this story spans
  **Protocol Architect** (`packages/net-protocol/**`, `docs/specs/**`) and
  **Simulation Engineer** (`apps/simulation-server/**`), and *reads* Simulation Engineer's
  `packages/game-rules/**`. CLAUDE.md's Ownership hook says to split or obtain explicit
  cross-context approval. **The user approved this split on 2026-07-22** precisely to confine
  all cross-boundary work to one small, reviewable story instead of scattering it. Splitting
  further would be worse: a union member without a broadcast is dead code, and a broadcast
  without a union member does not compile. Record this approval in the PR/commit body.
- **Contract-change hook: TRIGGERED** (`packages/net-protocol/**` changed). Requirements →
  Task 6: Protocol Architect review, compatibility checklist, spec update, ≥1 contract test.
- **Simulation-safety hook: TRIGGERED** (`apps/simulation-server/**` changed). Requirements →
  Task 7: typecheck, unit tests, deterministic tick check, replay test if available, perf sanity.
- **Client-UX hook: NOT triggered.** No host or mobile UI file is touched. It becomes
  triggered for 7.7b, which owns the couch-readability and HUD-occlusion checks.
- **Telemetry hook: N/A.** No new user flow — this is an existing boss behaviour becoming
  observable on the wire, not a new flow.
- **Merge gate:** both triggered hooks discharged, Protocol Architect review complete, ACs met,
  contract + unit + sim suites green, no contract drift left open.

### What `tryCharge` actually does (read this before writing the delta)

`packages/game-rules/src/entities/grassland-boss.ts:78-91`:

```ts
function tryCharge(boss: BossState, ctx: EnemyContext): BossEvent[] | null {
  if (boss.chargeCooldownTicks > 0) { boss.chargeCooldownTicks--; return null; }
  if (!ctx.nearestPlayerPos) return null;
  if (ctx.nearestPlayerDistance < BOSS_CHARGE_ACTIVATION_MIN || ctx.nearestPlayerDistance > BOSS_CHARGE_ACTIVATION_MAX) return null;
  …
  boss.chargeCooldownTicks = BOSS_CHARGE_COOLDOWN_TICKS;
  const dist = Math.min(len, BOSS_CHARGE_SPEED * ctx.dt);
  boss.position.x += (dx / len) * dist;
  boss.position.y += (dy / len) * dist;
  return [{ type: 'boss:charged', bossId: boss.id, x: boss.position.x, y: boss.position.y }];
}
```

Facts that shape the contract:

- **Post-hoc, single-tick.** Movement is applied *before* the event is returned. `x`/`y` are the
  **post-charge** position. There is no "about to charge" moment anywhere in the sim.
- **Distance moved is small:** `min(len, BOSS_CHARGE_SPEED × dt)` with `BOSS_CHARGE_SPEED = 350`
  px/s and `dt = 1/30` → **≤ 11.67 px**, against a boss drawn at radius 48
  (`DungeonScreen.tsx:436-460`). The name "charge" oversells it; 7.7b should size its dash
  visual against the *direction* of travel, not expect a long lunge. Flag this to 7.7b.
- **Gated:** only fires when `boss.phase !== Phase1 && difficulty !== DifficultyTier.EASY`
  (`:186`) and the nearest non-down, non-spirit player is 200–600 px away
  (`BOSS_CHARGE_ACTIVATION_MIN/MAX`, `:81`).
- **Early return:** `tickBoss` returns `[...phaseEvents, ...chargeEvents]` immediately
  (`:186-189`), so on the charge tick there is **no `boss:moved`**, and `tryStomp`/the base FSM
  do not run.
- **`Result<T, E>` / never-throw** (`project-context.md:289-297`): `tickBoss` returns
  `Result<BossEvent[], GameError>` and `GameRoom.ts:1901` already guards `if (bossResult.ok)`.
  Your broadcast lives inside that guard. **Do not add a `throw` anywhere on this path** — it
  would crash the 30 Hz tick loop.

### Why the `applyDelta` case is a no-op (and must stay one)

The honest version, because a future reader will question it:

- `boss:charged`'s `x`/`y` **are** the authoritative post-charge position, so writing them into
  the mirror would not be *wrong*.
- It is still a no-op on purpose: `boss:moved` (`apply-delta.ts:181-184`) is the **single writer**
  of `state.boss.position`, and `boss:stomped` (`:185-186`) / `enemy:stomped` (`:131-132`) already
  establish "boss event that carries coordinates but mutates nothing" as the house pattern.
- Convergence, verified rather than assumed: because `tryCharge` returns early there is **no
  `boss:moved` on the charge tick**, so the mirror lags by ≤ 11.7 px for ≤ 1 tick (33 ms) — then
  the next tick's `boss:moved` (`grassland-boss.ts:127`, emitted whenever the boss is in CHASE and
  the player is beyond `BOSS_ATTACK_RANGE`) or the periodic snapshot broadcast corrects it. Against
  a 48 px boss on a 1920×1080 virtual canvas that is sub-pixel-perceptible.
- 7.7b must read `x`/`y` **off the raw delta**, not off mirrored `GameState` — the same thing
  `boss:stomped`'s ring already does (`DungeonScreen.tsx:593-601`).
- If a future story decides the one-tick lag matters, changing this must be a **deliberate,
  reviewed decision**, not a drive-by "fix". That is what the `ponytail:` comment is for.

### Backward Compatibility Checklist (Contract-change hook)

Verify each at implementation time; record the result. Baseline findings are given so you are
checking, not discovering:

| # | Item | Baseline finding (verify) |
|---|---|---|
| 1 | Old host receives unknown delta type | `applyDelta` `default:` returns `state` unchanged, no throw (`apply-delta.ts:289-294`) |
| 2 | Old host's transient forwarding | `host-session.ts:44-63` is a positive OR-chain — unknown types are silently not forwarded; `applyDelta` is still called unconditionally at `:66` |
| 3 | Old mobile client | `mobile-session.ts:73-78` decodes and forwards to `App.tsx:136-146`, an `if`/`else if` chain with **no** exhaustive switch → unknown type ignored |
| 4 | Decode failure safety | both session files wrap decode in `try { … } catch { /* ignore malformed delta */ }` |
| 5 | Exhaustive switches over `DeltaEventMsg` | exactly **one** in the repo (`apply-delta.ts:289-294`); AC2 adds its case |
| 6 | `satisfies DeltaEventMsg` sites | `GameRoom.ts` broadcast literals + `tests/contract/net-protocol.test.ts`; adding a union member **widens** the target type — cannot break an existing `satisfies` |
| 7 | Serialization | no schema registry / no versioned envelope — `serialize`/`deserialize` are structural, so a new member needs no migration (`project-context.md:71-77`) |
| 8 | New server + old host | old host ignores the delta; `GameState` correctness is unaffected because the delta mutates nothing |
| 9 | Old server + new host | new host simply never receives `boss:charged`; its 7.7b handler stays idle. No crash, no stuck state |
| 10 | Snapshot compatibility | `GameState`/`BossState` unchanged — no snapshot shape change at all |

### Tick-loop hygiene (30 Hz, 33 ms budget — `project-context.md:81-88`)

- **No `logger.info`/`warn`/`error`** anywhere on this path. The existing boss switch uses none;
  keep it that way. (`logger.debug` exists at `:1870` for the enemy-AI error path only.)
- **No `JSON.parse`/`stringify`** — serialization happens at the message boundary
  (`this.broadcast` handles it), same as every neighbouring case.
- **Allocation:** one object literal per charge, identical to `boss:stomped` (`:1915-1917`) and
  `boss:moved` (`:1908-1910`). Not a per-tick allocation — the cooldown gates it.
- **Volume, quantified:** `BOSS_CHARGE_COOLDOWN_TICKS = 150` ticks = **5 s** →
  ≤ 12 broadcasts per 60 s of boss fight, and **zero** in Phase 1 or on EASY. For scale,
  `boss:moved` broadcasts up to **30/s** on the same path today. The added wire volume is
  ≤ 0.7 % of what the boss already emits.

### Adjacent issue found, deliberately out of scope

`case 'boss:moved'` repositions the physics body
(`GameRoom.ts:1907`: `if (this.bossBody) this.bossBody.setPosition(Vec2(toMeters(evt.x), toMeters(evt.y)))`).
The charge path does **not** — so after a charge, `this.gameState.boss.position` and
`this.bossBody` disagree by up to ~11.7 px until the next `boss:moved` tick re-syncs them.

**Do not fix this in this story.** Repositioning a physics body changes collision resolution =
a boss behaviour change = an Epic 7 non-goal, and it belongs to the Simulation Engineer with a
full Simulation-safety review of its own. Instead, log it in
`_bmad-output/implementation-artifacts/deferred-work.md` as a new `D-7.7a-A` entry
("boss charge does not re-sync the planck body; ≤11.7px sim/physics divergence for ≤1 tick"),
following the format of the existing `D-7.1-A…D` entries.

### Handoff contract to Story 7.7b

State these in the completion notes so 7.7b is unblocked without re-deriving anything:

1. `BossChargedDelta = { type: 'boss:charged'; bossId: string; x: number; y: number }`, exported
   from `net-protocol`. **No `radius`** — unlike `BossStompedDelta`.
2. `x`/`y` are the **post-charge** boss position; the visual is a **post-hoc dash/impact**, not a
   telegraph. There is no windup state to render and none will be added.
3. Travel distance is ≤ ~11.7 px per charge — 7.7b should convey *direction and impact*, not a
   long lunge. The charge direction is not on the wire; if 7.7b needs it, derive it host-side by
   diffing against the previously known boss position (a host-local ref) — **do not** ask for a
   protocol change to carry it.
4. 7.7b must add `delta.type === 'boss:charged'` to the whitelist at `host-session.ts:44-63`,
   which is host-local delivery filtering, **not** a contract change — so the Contract-change
   hook stays untriggered for 7.7b.
5. Frequency: ≤ 1 per 5 s, phase 2–3 only, non-EASY only. That is comfortably inside the
   D-7.1-D "no effect cap" deferral — one charge effect at a time, no back-pressure needed.
6. Known pre-existing limitation 7.7b inherits: `latestTransientDelta` is a single React state
   value cleared after 400 ms (`App.tsx:20,42-48`), so co-arriving deltas collapse and only the
   last is seen. At ≤ 1 charge per 5 s the collision risk is low, but a charge landing in the
   same task as a `boss:damaged` can be dropped. Acknowledge, do not rewrite App-level plumbing.

### Previous Story Intelligence

- **`dev-5-boss-transient-delta-whitelist-fix.md`** — closest prior art, same surface. Its key
  lesson: `GameState` correctness and *transient visual reachability* are two independent
  pipelines. `applyDelta` runs unconditionally (`host-session.ts:66`); the whitelist only gates
  `onTransientDelta`. That is exactly why 7.7a (broadcast + state contract) and 7.7b (whitelist
  + visual) split cleanly along a real seam. It also shows the failure mode this story is
  guarding against: **code that exists but is never reached.** After 7.7a, `boss:charged` is
  broadcast but unreached — by design, and only until 7.7b lands.
- **Story 7.1** — shipped a deliberately unconsumed artifact (its AC3) and it was accepted.
  Same pattern here; say so explicitly in the completion notes so a reviewer does not read
  "nothing renders" as incomplete work.
- **Story 6.1** — established the boss-delta contract-test block
  (`tests/contract/net-protocol.test.ts:738-770`). Extend it; do not start a new file.
  (A separate file per delta exists — `tests/contract/player-class-updated-delta.test.ts` —
  but for a boss delta the 6.1 block is the established home.)
- **Story 7.1's Debug Log** — the `tests/e2e` WSL2 flake is pre-existing and documented; the
  two-strike rule (re-run in isolation, compare failure sets) is the established handling.

### Testing Standards

- **Placement (`project-context.md:169-205`, three strict categories):**
  round-trip serialization tests are **contract** tests → `tests/contract/`. This story adds no
  new pure game-rules function, so no `tests/unit/` addition is warranted. No e2e addition —
  an inert delta has no observable end-to-end behaviour to assert.
- **File to modify:** `tests/contract/net-protocol.test.ts` — the
  `describe('Story 6.1 boss delta round-trips')` block at `:738-770`. Add `BossChargedDelta` to
  the type import on `:3`. Reuse the file's `mockGameState()` helper (`:10-37`).
- **Shape to match:** `serialize` → `deserialize` → `expect(decoded).toEqual(delta)` for the
  named type (`:739-745`), plus the `satisfies DeltaEventMsg` union form used at `:91-100`, plus
  a same-reference `expect(next).toBe(state)` no-op assertion (the pattern at `:189-193`).
- **Commands (run from the repo root unless stated):**
  | Purpose | Command |
  |---|---|
  | Contract tests | `cd tests && npx vitest run contract/net-protocol.test.ts` |
  | All contract tests | `cd tests && npx vitest run contract` |
  | Unit tests | `cd tests && npx vitest run unit` |
  | Simulation-server suites | `cd apps/simulation-server && npx vitest run` |
  | Typecheck (all 10 tsconfigs) | `npm run typecheck` |
  | Lint | `npm run lint` |
  | Full suite | `npm test` |
- **Never claim a test passed that you did not run.** Paste the real counts into the Debug Log.
- `tests/vitest.config.ts` includes only `contract|e2e|unit/**` — a test placed anywhere else
  under `tests/` will not run.

### Project Context Rules (from `_bmad-output/project-context.md`)

- **Event Contract Discipline (`:62-69`)** — phones send input events, servers send deltas;
  never bypass the contract with ad-hoc state. This story is the contract-respecting way to
  make a sim event visible.
- **Tick Loop Hygiene (`:81-88`)** — no `logger.info`/`warn`/`error`, no hot-path allocation,
  no `JSON` in the tick. See the hygiene section above.
- **Serialization (`:71-77`)** — structural, no versioned envelope; new union members need no
  migration.
- **PRNG (`:90`)** — `Math.random()` is forbidden in `packages/game-rules` and
  `apps/simulation-server`. Nothing in this story needs randomness.
- **`Result<T, E>` — never throw from game rules (`:289-297`)** — `tickBoss` already returns
  `Result<BossEvent[], GameError>`; `GameRoom.ts:1901` guards on `.ok`. Add no throws.
- **Contract tests (`:194-205`)** — every wire message type needs a round-trip test. AC8.
- **Naming (`:151-157`)** — events are `noun:verb` (`boss:charged` ✓); wire types are
  `PascalCase` (`BossChargedDelta` ✓); files kebab-case.
- **TypeScript strict, no `any`** without an explicit suppression comment.
- **Ownership (`:128-138`)** — see the cross-context approval note in the Pre-Task Hook.

### Project Structure Notes

- No new files. Five existing files modified plus one spec line.
- `BossChargedDelta` belongs in `packages/net-protocol/src/messages/server-to-host.ts`, grouped
  with the other `Boss*Delta` types (`:182-234`) — **not** in `packages/shared-types`, which
  holds domain state (`BossState`, `BossPhase`), not wire messages.
- `packages/net-protocol/src/index.ts:5` is a single long `export type { … }` line — append to
  it, do not restructure it.
- The internal `BossChargedEvent` (`game-rules`) and the wire `BossChargedDelta` (`net-protocol`)
  stay as **two structurally identical declarations**. That duplication is the established
  pattern: `packages/game-rules/src/systems/ai/fsm.ts:12-13` documents it —
  *"Local event types — structurally identical to `DeltaEventMsg` variants in net-protocol.
  The sim server assigns `EnemyAIEvent` to `DeltaEventMsg` via structural typing — no cast
  needed."* **Do not** make `game-rules` import from `net-protocol` to deduplicate; that
  inverts the dependency direction.

### References

- [Source: `packages/game-rules/src/entities/grassland-boss.ts:15`] — `BossChargedEvent` type (fields `bossId`, `x`, `y`)
- [Source: `packages/game-rules/src/entities/grassland-boss.ts:78-91`] — `tryCharge`: post-hoc, single-tick, `min(len, BOSS_CHARGE_SPEED*dt)`, 150-tick cooldown
- [Source: `packages/game-rules/src/entities/grassland-boss.ts:81`] — activation window `BOSS_CHARGE_ACTIVATION_MIN/MAX`
- [Source: `packages/game-rules/src/entities/grassland-boss.ts:127`] — `boss:moved` emitted from `tickBossChase`
- [Source: `packages/game-rules/src/entities/grassland-boss.ts:148-194`] — `tickBoss` returns `Result<BossEvent[], GameError>`; charge gate at `:186-189` returns early
- [Source: `packages/game-rules/src/systems/ai/fsm.ts:12-13`] — structural-typing convention between local sim events and `DeltaEventMsg`
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:189-195`] — `BossStompedDelta`, the template
- [Source: `packages/net-protocol/src/messages/server-to-host.ts:287-331`] — `DeltaEventMsg` union (no `boss:charged` at baseline)
- [Source: `packages/net-protocol/src/index.ts:5`] — the per-type export list `BossChargedDelta` must join
- [Source: `packages/net-protocol/src/apply-delta.ts:131-132,150,185-186,258-259`] — `ponytail:` no-op comment house style
- [Source: `packages/net-protocol/src/apply-delta.ts:181-184`] — `boss:moved`, the single writer of `boss.position`
- [Source: `packages/net-protocol/src/apply-delta.ts:289-294`] — `default:` + `const _exhaustive: never` guard (compile-time exhaustiveness; runtime returns `state`)
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1888-1902`] — boss tick + `bossResult.ok` guard
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1904-1918`] — `boss:moved` / `boss:stomped` broadcast blocks to mirror
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1926-1928`] — the swallow this story replaces
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts:1907`] — `bossBody.setPosition` on `boss:moved` (adjacent, out-of-scope issue)
- [Source: `apps/host-client/src/session/host-session.ts:44-66`] — whitelist OR-chain (7.7b's scope) + unconditional `applyDelta`
- [Source: `apps/mobile-controller/src/session/mobile-session.ts:73-78`, `apps/mobile-controller/src/App.tsx:136-146`] — mobile delta handling has no exhaustive switch
- [Source: `tests/contract/net-protocol.test.ts:3,10-37,91-100,189-193,738-770`] — imports, `mockGameState()`, union round-trip pattern, same-reference pattern, boss round-trip block
- [Source: `tests/vitest.config.ts`] — include globs `contract|e2e|unit/**`
- [Source: `docs/specs/networking-spec.md:49-57`] — Simulation Events list (spec-update target)
- [Source: `docs/specs/networking-spec.md:100-104`] — Compatibility Rules: contract changes require review and ≥1 contract test
- [Source: `_bmad-output/project-context.md:62-77,81-88,90,128-138,151-157,169-205,289-297`] — event discipline, serialization, tick hygiene, PRNG, ownership, naming, testing, `Result<T,E>`
- [Source: `_bmad-output/planning-artifacts/epics.md:1904-1908`] — Epic 7 framing (and its incorrect "isn't even in the whitelist" claim)
- [Source: `_bmad-output/planning-artifacts/epics.md:2024-2041`] — Story 7.7 as written (the ACs this story corrects and splits)
- [Source: `_bmad-output/planning-artifacts/epics.md:2061`] — Epic 7 non-goals; 7.7a is the one approved protocol exception
- [Source: `_bmad-output/implementation-artifacts/dev-5-boss-transient-delta-whitelist-fix.md`] — prior art: `applyDelta` vs whitelist are independent pipelines
- [Source: `_bmad-output/implementation-artifacts/7-1-vfx-engine-foundations.md`] — precedent for shipping a deliberately unconsumed artifact; WSL2 e2e flake + two-strike rule
- [Source: `CLAUDE.md` § Hook Policy, § Ownership Rules, § Merge Gate] — Contract-change and Simulation-safety hook requirements; `docs/specs/**` co-ownership

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|---|---|
| 2026-07-22 | Story created. Splits epic Story 7.7 into 7.7a (protocol + simulation: `boss:charged` delta contract, `applyDelta` no-op, `GameRoom` broadcast, contract test) and 7.7b (host whitelist + VFX), correcting the epic's false "one-line whitelist fix" premise. Cross-context ownership (Protocol Architect + Simulation Engineer) approved by the user on 2026-07-22. No sim-side windup/telegraph state — the charge event is post-hoc by construction. |

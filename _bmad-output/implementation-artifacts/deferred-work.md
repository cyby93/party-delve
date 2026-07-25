# Deferred Work

Items surfaced during reviews that are real findings but pre-exist the triggering change or are out of scope for the current story. Each entry records the source story, the finding, and why it was deferred.

---

## Deferred from: code review of 7-10-projectile-position-streaming (2026-07-24)

**D-7.10-A — Per-projectile per-tick `projectile:moved` broadcast fan-out (no coalescing)** [`apps/simulation-server/src/rooms/GameRoom.ts:1413`]
Phase 3b emits one `broadcast(DELTA, projectile:moved)` per moving projectile per tick. This matches the shipped `player:moved`/`enemy:moved`/`boss:moved` delta model exactly — the codebase has no delta batching/coalescing anywhere — so it is the established architecture, not a regression introduced here. Deferred as an architecture-wide concern; revisit only if a bullet-heavy scenario shows a measured per-tick network/CPU problem (the AC8 perf note estimates a handful of concurrent projectiles at ~4 fields each).

**D-7.10-B — No non-finite (NaN/Infinity) guard on the physics read-back** [`apps/simulation-server/src/rooms/GameRoom.ts:1417`]
If `body.getPosition()` ever returned NaN/Infinity, `Math.abs(newX - projectile.x) > 0.5` is `false`, so the coord is never refreshed and never broadcast — the host dot freezes and, because `isProjectileExpired` reads the frozen finite coord, the entry+body can leak for the run. The sibling `:moved` loops (player/enemy/boss) share the identical missing guard, and these projectiles are simple kinematic bodies unlikely to produce non-finite positions. Deferred pattern-wide: a fix belongs at all four `:moved` sites together, not only here (the story mandated mirroring `player:moved` exactly).

**D-7.10-C — Phase-3b move-gate/broadcast has no direct sim unit test** [`apps/simulation-server/src/rooms/GameRoom.ts:1419`]
The new contract tests cover `applyDelta` + round-trip (AC7), but the sim-side `>0.5px` gate and conditional write are not directly unit-tested. The gate is a byte-for-byte mirror of the `player:moved` gate already exercised by e2e, and AC7 deliberately scoped coverage to the contract suite. Deferred as a low-value coverage addition.

**D-7.10-D — Contract-change hook's Protocol Architect review is self-attested** [`_bmad-output/implementation-artifacts/7-10-projectile-position-streaming.md`]
AC8 requires the Protocol Architect review be *recorded* (it is, in the Dev Agent Record), but the same agent authored and reviewed the change. An independent human Protocol Architect sign-off on the new `DeltaEventMsg` member is still owed before merge per the CLAUDE.md Contract-change hook / Merge Gate. Deferred to the human merge step.

---

## Deferred from: code review of 6-10-epic-6-post-69-deferred-hardening (2026-07-21)

**D-6.10-A — `selectBondPair` assumes unique `PlayerState.id` values across the roster** [`packages/game-rules/src/systems/bonds.ts:43-62`]
The new id-based filters (`bondedPartnersOf`, `hasAvailablePartner`, and every `p.id !== chosen.id` / `!chosenPartners.has(p.id)` predicate) implicitly assume no two players in the roster share an `id`. A duplicate id can make the final fallback pool come up empty (crash on `finalPoolB[idxB]!.id`) or silently re-select an already-bonded pair (the id-based exclusion can't distinguish the duplicate from `chosen`). Pre-existing assumption — the pre-fix code relied on the same implicit uniqueness via `Set`-based membership checks — not introduced or worsened by this story's diff, and no caller in the codebase currently allows duplicate ids to reach this function. Revisit only if a real path to duplicate `PlayerState.id`s is ever found (e.g. a room-join race).

**D-6.10-B — `selectBondPair` still throws for 0 or 1 player rosters** [`packages/game-rules/src/systems/bonds.ts:60-62`]
With `players.length` 0 or 1, every fallback pool (`unbondedWithPartner`, `anyWithPartner`, `preferredPoolB`, `poolB`, `finalPoolB`) collapses to empty, and `finalPoolB[idxB]!.id` dereferences `undefined`, throwing a TypeError. Identical crash existed in the pre-fix implementation at the same input sizes — not introduced by this story's diff — and it's unreachable in production: `assignBond` (the only caller) guards `state.players.length < 2` before ever calling `selectBondPair`. Revisit only if `selectBondPair` gains a caller that doesn't enforce that guard.

---

## Deferred from: code review of 3-24-epic-3-post-323-deferred-hardening (2026-07-20)

**D-3.24-A — `afterEach`'s per-room `leave()` unconditionally races against a 3s cap** [`tests/e2e/reconnect.test.ts`, `tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`]
This story's `afterEach` force-leave (fixing D-3.22-A) caps every tracked room's `leave()` at 3s via the shared `raceTimeout` helper, needed because `reconnect.test.ts`'s manually-closed-socket rooms never resolve `leave()` on their own. For those specific rooms, every such `afterEach` now silently burns the full 3s every time — bounded and well under the 10s hook-timeout budget it protects, but a permanent per-test tax rather than a smarter fix (e.g. skip `leave()` when the room's connection is already known closed). No such state-check API is used elsewhere in this codebase's e2e helpers, and designing one is a judgment call outside this story's cleanup/timer-mechanics scope. Revisit if e2e suite runtime is ever observed to matter enough to justify it.

---

## Deferred from: dev implementation of 3-23-skill-cell-joystick-aiming-interaction (2026-07-20)

**D-3.23-A — AUTO/AIM_CAST ring+knob (and the underlying touch tracking) tears down the instant cooldown starts, not on lift — contradicts the spec and orphans an actively-held touch** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`apps/mobile-controller/src/screens/ControllerScreen.tsx`, `SkillCell`'s `useEffect` (~line 650-780) and its `isInteractive` dependency, fed by the live grid's `isInteractive` computation (~line 1424-1426)]

**⚠️ Flagged by the user during this story's dev-story session, live-testing their mental model against the spec, not caught by the automated verification (no automated test exercises this — matches this story's own "no automated tests, touch-drag can't be exercised in jsdom" precedent).**

EXPERIENCE.md §4 is explicit for AUTO: "Ability fires every ~33ms tick using the live tracked direction, *for as long as the touch is held*. **On lift**, firing stops and the ring/knob disappear." (AIM_CAST shares the same commit-timing model.) Disappearance is spec'd to be tied to lift, not to cooldown state.

Root cause: `isInteractive` (`ControllerScreen.tsx:1424-1426`) is computed as `!isOnCooldown && ...`, and `SkillCell`'s single `useEffect` — which owns both the touch event listeners *and* (as of this story) the `spawnOrigin`/`knobOffset` ring/knob state — has `isInteractive` in its dependency array. The moment an AUTO/AIM_CAST ability fires successfully and its cooldown starts, `isInteractive` flips `true → false`, React runs the effect's cleanup (removes all touch listeners, clears `activeTouchRef`, `autoIntervalRef`, and now `spawnOrigin`/`knobOffset` too), and the re-run of the effect body exits early (`if (!el || !isInteractive || ability === null) return;`) without re-attaching anything. When cooldown expires and `isInteractive` flips back to `true`, nothing resumes automatically — the original touch's listeners are gone, so the still-down finger is orphaned until the player physically lifts and re-touches the cell. Since AUTO/AIM_CAST cooldowns are short (1000–2000ms per `ABILITY_COOLDOWNS_MS`, `packages/game-rules/src/balance.ts:32-37`) and refire every cycle by design, this fires on *every single successful cast* of every AUTO/AIM_CAST ability, not as an edge case.

This is a pre-existing pattern, not introduced by this story — the `isInteractive`-in-deps teardown already existed before the ring/knob was added; it was simply invisible with no visual layer to watch disappear. It is the same root shape as the already-tracked **D-3.3-B** (RELEASE silently drops its fire if `isInteractive` flips false mid-hold via this same cleanup), just triggered by cooldown instead of a downed/phase transition, and with much higher real-world frequency (every AUTO/AIM_CAST cast vs. D-3.3-B's rarer phase-transition trigger).

Out of this story's scope: 3.23's own Non-goals explicitly ruled out touching fire-timing/`isInteractive` semantics ("Do not fix D-3.3-B... your new ring/knob cleanup state must mirror the existing cleanup's behavior exactly"), and this finding is the same class of change. Server-side cooldown gating (`dispatchAbility`, `packages/game-rules/src/systems/abilities.ts:45-47`) already correctly no-ops an on-cooldown fire attempt, so there's no correctness/exploit risk — only a client-side UX regression (ability stops auto-repeating and its visual vanishes mid-hold).

**Recommended fix (not applied here — deferred):** stop tearing down an already-active hold when cooldown starts. `isOnCooldown`/`isInteractive` should gate *new* touchdowns only (e.g. checked inside `onTouchStart` itself, or via a ref read instead of an effect dependency), not force the touch-tracking `useEffect` to unmount mid-hold. The `autoIntervalRef` firing attempts during cooldown are already harmless no-ops server-side, so simply letting the interval keep running (and the ring/knob keep rendering) through a cooldown window would make AUTO/AIM_CAST naturally resume firing — and stay visually consistent — the instant cooldown clears, matching the spec's "for as long as the touch is held" language exactly. This is a `SkillCell` touch-lifecycle change (splitting "gate new touch" from "interrupt active hold"), worth fixing together with D-3.3-B in one pass since both share the same root cause. Revisit as a dedicated follow-up story — flagged as user-visible and worth prioritizing given it affects the primary combat-input gesture for 3 of 4 input types.
Resolution: exactly the recommended fix. The parent grid's `isInteractive` computation was split into `canHoldThroughCooldown` (real interrupts only) and `isInteractive` (`canHoldThroughCooldown && !isOnCooldown`, unchanged value/behavior for render/TAP gating). `SkillCell`'s touch-tracking `useEffect` now depends on `canHoldThroughCooldown` instead of `isInteractive`, so a cooldown-only flip no longer tears it down — listeners, `activeTouchRef`, and the 33ms `autoIntervalRef` interval all persist through the cooldown window, and firing/visuals resume automatically the instant cooldown clears. New touchdowns are still gated: a render-synced `isOnCooldownRef` is checked inside `onTouchStart`, rejecting a fresh touch on an on-cooldown cell exactly as before.

---

## Deferred from: code review of 6-9-epic-6-post-66-deferred-hardening (2026-07-17)

**D-6.9-C — Boss can take two damage hits / emit two `boss:damaged` broadcasts in the same tick** [`apps/simulation-server/src/rooms/GameRoom.ts`, new zone-tick boss branch + new Storm Eye strike boss branch]
`STORM_EYE_STRIKE_INTERVAL_MS` (1500ms) is exactly 3× `STORM_EYE_TICK_MS` (500ms), so on every 3rd zone tick the strike-timer condition is also true for the same zone in the same iteration. If the boss is in range and the strike RNG happens to pick it too, both the steady zone-tick boss branch and the Storm Eye strike boss branch fire in one tick, producing two `boss:damaged` broadcasts. Pre-existing pattern: enemies already exhibit the identical dual-hit-per-tick behavior (both branches can independently hit the same enemy in one tick); this story's two new boss branches simply extend that existing, accepted behavior to the boss for the first time. `Math.max(0, hp - damage)` keeps state idempotent, so the only visible effect is a harmless duplicate broadcast (at worst a double VFX flash on the host). Redesigning the boss/enemy hit-dedup-per-tick or defeat-transition state machine is out of scope for a hardening story. Revisit only if this is ever observed to cause a real gameplay/VFX problem.

**D-6.9-D — Boss-in-zone-range `isInHitZone` check duplicated verbatim in two places** [`apps/simulation-server/src/rooms/GameRoom.ts`, zone damage-tick boss branch and Storm Eye strike boss branch]
Both branches call `isInHitZone(zone.x, zone.y, 0, 0, boss.position.x, boss.position.y, zone.radius, 0, false)` with identical arguments. This story's own spec (Tasks 3 and 4) prescribed this exact snippet near-verbatim in both places, so the duplication was deliberate/spec-driven rather than an oversight. Low value to extract into a shared helper now — revisit if a 3rd occurrence of this exact check appears (matches this project's established "revisit at 3rd instance" convention, e.g. D-dev5-D).

---

## Deferred from: code review of dev-2-controller-rotation-lock-enforcement (2026-07-16)

**D-dev2-A — `window.matchMedia` called unguarded in a `useState` initializer at the top of `App()`** [`apps/mobile-controller/src/App.tsx:86`]
Deferred, pre-existing convention: `matchMedia` was already used unguarded inside `OrientationPromptScreen.tsx`'s `useEffect`. This story widens the same unguarded call from screen-local (only reachable when that one screen mounted) to app-wide (runs on every mount, every screen). No guard added given universal `matchMedia` support across this project's actual mobile-browser targets (project-context.md scopes the mobile controller to "mobile web browser (phone)" — no SSR, no legacy-browser target). Revisit only if a target platform without `matchMedia` support is ever added.

**D-dev2-B — No fallback to the legacy `mq.addListener`/`removeListener` API for older Safari** [`apps/mobile-controller/src/App.tsx:104-109`]
Deferred, pre-existing convention already used unguarded in `OrientationPromptScreen.tsx`; this story's new App-level effect mirrors that same existing pattern rather than introducing a new one. Revisit only if analytics ever show a meaningful fraction of players on Safari versions old enough to lack `addEventListener` on `MediaQueryList`.

---

## Deferred from: code review of dev-5-boss-transient-delta-whitelist-fix (2026-07-16)

**D-dev5-B — Single-slot `latestTransientDelta` state can silently drop a delta** [`apps/host-client/src/session/host-session.ts:46-66`, feeding `App.tsx`/`DungeonScreen.tsx` effects keyed on `latestTransientDelta`]
If two whitelisted deltas land within the same render cycle (e.g. `boss:damaged` immediately followed by `boss:defeated`), React's single-slot derived state only surfaces the last one — the earlier delta's UI reaction never fires. Pre-existing pattern shared by all 13 previously-whitelisted delta types (e.g. `enemy:killed`+`essence:dropped` already broadcast back-to-back synchronously today, same risk); this story's 4-line whitelist addition just routes 4 more types through the same existing choke point, it doesn't introduce the pattern. Revisit if this ever causes an observed missed reaction — likely fix is a small per-tick queue instead of a single ref/state slot.

**D-dev5-C — No runtime validation of delta payload fields before use** [`apps/host-client/src/session/host-session.ts:19-21` `decode<T>()`, feeding `DungeonScreen.tsx:589` (`boss:damaged.newHp`) and `App.tsx:45`/`DungeonScreen.tsx:606` (`boss:defeated.reward`)]
Malformed or missing fields on a `boss:damaged`/`boss:defeated` payload would flow through unvalidated (`NaN` damage flash, or a throwing unguarded `.reward.essenceTotal` access outside `host-session.ts`'s own try/catch). Matches this codebase's existing trust-boundary convention everywhere else in this whitelist — the server broadcasts payloads typed via `satisfies DeltaEventMsg` at each call site, and the client never runtime-validates any of them. Not unique to this story's addition. Revisit only if the trust boundary between simulation-server and host-client is ever tightened project-wide.

**D-dev5-D — Hardcoded `||`-chain whitelist is structurally fragile** [`apps/host-client/src/session/host-session.ts:46-66`]
This is the 2nd "missing whitelist entries" bug found in this exact OR-chain (D-6.8-A was the 1st, for the same 4 boss deltas plus `enemy:damaged`). No structural safeguard was added to prevent a 3rd occurrence — e.g. deriving the forwarded-type set from the `DeltaEventMsg` union with an exhaustiveness check, rather than a manually maintained list that silently drops unlisted types. Out of scope for a 4-line dev-infra fix. Revisit as a dedicated hardening story if a 3rd instance of this bug class ever surfaces.

**D-dev5-E — Commit touches files outside the story's declared "Allowed paths"** [`_bmad-output/implementation-artifacts/deferred-work.md`, `sprint-status.yaml`, the story file itself]
The story's CLAUDE.md task header lists only `apps/host-client/src/session/host-session.ts` as an Allowed path, but the commit also modifies `deferred-work.md`, `sprint-status.yaml`, and the story file itself — required by the story's own Task 2 and by the standard dev-story completion workflow, but not reflected in the header. This reproduces the exact contradiction already tracked as `D7` (from Story 6.8's own code review: "story's Allowed paths never lists `deferred-work.md`, but Tasks mandate editing it... flag for the Orchestrator/Protocol Architect to tighten future story templates"). The template fix D7 called for was never applied, so every subsequent story (including this one) keeps reproducing it. Orchestrator-owned meta-work, out of scope for individual dev stories to self-correct. Revisit by fixing the story-header template itself, not by patching individual stories.

---

## Deferred from: code review of dev-4-debug-invincible-high-damage-mode (2026-07-17)

**D-dev4-A — No guard against a stray `debug:toggle-god-mode` message reaching a production server** [`apps/simulation-server/src/rooms/GameRoom.ts:334-372`]
The handler is registered only inside `if (process.env['NODE_ENV'] !== 'production')`, so in production the message type is completely unregistered — per this project's documented Colyseus behavior, any client (a stale dev-mode mobile build, a manually replayed message) that still sends it would trigger a `WITH_ERROR` (4002) disconnect rather than a silent no-op. Shared by the pre-existing `debug:kill-all`/`debug:kill-boss` handlers registered in the exact same block; this story extends the same unguarded pattern to a third message type without introducing or worsening the risk. Revisit only if the project ever wants unregistered-in-prod debug messages to fail silently instead of disconnecting the client — likely fix is a generic top-level "unknown message" catch-all rather than a per-handler change.

---

**D-dev4-B — Damage multipliers are computed independently per ability-delivery type instead of through one shared resolver — `DEBUG_GOD_MODE_DAMAGE_MULT` (and the pre-existing `BOND_DAMAGE_MULT`) silently skip Storm Eye and both projectile abilities** — RESOLVED by 6-9-epic-6-post-66-deferred-hardening (2026-07-17) [`apps/simulation-server/src/rooms/GameRoom.ts` — 5 separate damage-application sites: `~2119` (hitscan/mixed-faction), `~2319` (Spirit Nova, a hand-duplicated copy of the hitscan math), `~1648` (projectile hit — Blood Spike, Void Pulse), `~1511` (Storm Eye zone-tick damage), `~1577` (Storm Eye zone-strike bonus damage)]

**⚠️ Flagged by the user as high-priority/foundational — surfaced via live manual testing of dev-4's god-mode toggle (Stormcaller's Storm Eye took no extra damage while toggled on), but the actual defect predates this story.**

There is no single "resolve final damage for this caster+ability" function. Each of the 3 ability-delivery types (`hitscan`, `projectile`, `zone` — see `ABILITY_DELIVERY` in `balance.ts`) computes its damage value independently at its own call site in `GameRoom.ts`, and only 2 of the resulting 5 sites (hitscan/mixed-faction, and Spirit Nova's separately-duplicated copy of the same math) ever apply a multiplier. `BOND_DAMAGE_MULT` (Proximity Bond's +20% damage buff, existing since Story 5.3) already had this gap — no player has ever gotten the bond bonus on Blood Spike, Void Pulse, or Storm Eye. `DEBUG_GOD_MODE_DAMAGE_MULT` (this story) inherited the identical gap by design, since T5 deliberately mirrored `BOND_DAMAGE_MULT`'s existing footprint rather than fixing it (documented in this story's own Dev Notes as explicitly out of scope).

**Why this is more than a debug-tool quirk:** every future multiplicative system (damage buffs, debuffs, elemental weaknesses, crit, gear bonuses, etc.) that gets bolted onto one of the 2 "covered" sites will silently and permanently exclude Storm Eye and both projectile abilities unless it's separately, manually added to all 5 sites — the same omission will keep reproducing itself indefinitely as the ability roster grows, exactly as it already has twice (Bond buff, then god-mode).

**Recommended fix (not applied here, by user's explicit choice — deferred, not implemented):** introduce one shared damage-resolution function (e.g. `resolveOutgoingDamage(caster, rawDamage): number`) that folds in every active multiplier (`BOND_DAMAGE_MULT`, `DEBUG_GOD_MODE_DAMAGE_MULT`, and any future ones) in one place, and have all 5 delivery-site call sites call through it instead of each computing its own local `mult` ternary. This is a Simulation Engineer change touching combat-critical code (`apps/simulation-server/src/rooms/GameRoom.ts`, possibly a new pure helper in `packages/game-rules`) — warrants its own properly-scoped story with the full Simulation-safety hook (typecheck, unit tests, deterministic tick test, perf sanity), not a quick patch. Revisit **soon** — the user has explicitly asked this be picked up promptly, not left indefinitely like the "revisit if X happens" items above.
Resolution: `resolveOutgoingDamage(rawDamage, isBonded, isGodMode)` added to `packages/game-rules/src/balance.ts`; all 5 sites now call through it. Unit-tested (5 cases: no-buff pass-through, bond-only, god-mode-only, both stacked, round-only-when-mult≠1). Surfaced one new, separate, out-of-scope finding — see D-6.9-A below.

---

## Deferred from: manual verification of dev-5-boss-transient-delta-whitelist-fix (2026-07-16)

**D-dev5-A — Storm Eye's zone-tick damage never reaches the boss** — RESOLVED by 6-9-epic-6-post-66-deferred-hardening (2026-07-17) [`apps/simulation-server/src/rooms/GameRoom.ts`, zone `damage`-effectType tick loop (~line 1492) and the Storm Eye bonus-strike loop (~line 1543)]
Found during this story's user-performed live boss-fight verification: landing direct-hit abilities on the boss shows the "-N" floating number as expected, but Stormcaller's Storm Eye zone shows nothing. Traced to the root cause — both the steady zone damage-tick loop and Storm Eye's bonus lightning-strike loop only search `this.gameState.enemies` (`this.gameState.enemies.findIndex(...)` / `this.gameState.enemies.some(...)`) and never check `this.gameState.boss`. This isn't a missing `boss:damaged` broadcast (this story's whitelist fix has nothing to do with it) — the zone tick applies **zero damage to the boss at all**, so no delta is ever generated to broadcast. Story 6.7 ("boss combat resolution wiring") wired the boss into every direct hit-scan resolution path (melee cone, mixed-faction cone, Spirit Nova sweep — all confirmed broadcasting `boss:damaged` correctly, see `GameRoom.ts:2166-2176`, `2248-2263`, `2352-2358`) but never extended that wiring to the zone-tick resolution path Storm Eye uses. Out of scope for dev-5 (`apps/simulation-server/**` is a Blocked path for that story; this is Simulation Engineer ownership, not Host Experience Engineer). Revisit as a dedicated follow-up story: add a boss branch (mirroring the existing hit-scan boss branches' `Math.max(0, hp - damage)` + `boss:damaged` broadcast pattern) to both the steady zone damage-tick loop and the Storm Eye bonus-strike loop.
Resolution: both loops now check the boss directly via the same `isInHitZone`-against-`boss.position` pattern Spirit Nova already used (the boss never appears in `zoneOverlapping` — its physics fixture has `filterMaskBits: 0`, so it structurally can't). Zone-tick and Storm Eye's bonus strike both now broadcast `boss:damaged` when the boss is alive, un-defeated, and in range.

---

## Deferred from: dev implementation of 6-9-epic-6-post-66-deferred-hardening (2026-07-17)

**D-6.9-A — Projectile abilities (Blood Spike, Void Pulse) still cannot hit the boss at all** [`apps/simulation-server/src/rooms/GameRoom.ts`, `pendingProjectileHitContacts`/`ProjectileEnemyContactEvent`, physics contact wiring]
This story fixed the *multiplier* at the projectile hit-resolution call site (`~1648`) so that damage is now correctly buffed IF a projectile ever hits the boss — but projectiles structurally never can. `pendingProjectileHitContacts` is populated only from enemy-vs-projectile physics contacts (`ProjectileEnemyContactEvent`); there is no boss-vs-projectile contact type or fixture wiring at all, unlike the boss's existing hit-scan branches which use a direct `isInHitZone`-against-`boss.position` check instead of physics contacts. Fixing this requires either giving the boss body a non-zero `filterMaskBits` (and handling the new contact-event type it would generate) or adding a parallel direct-position check for projectile-vs-boss each tick — a physics-layer change, bigger than a hardening story and explicitly out of this story's Non-goals. Revisit as a dedicated follow-up story if Blood Spike/Void Pulse-vs-boss becomes a reported gameplay gap.

**D-6.9-B — `tests/e2e/full-run.test.ts`'s 3-player bond-count assertion is flaky due to the pre-existing `selectBondPair` re-pair bug (D1, 2026-07-03)** [`packages/game-rules/src/systems/bonds.ts:19-31`, exercised via `tests/e2e/full-run.test.ts:240`]
Observed while verifying this story's test suite: `full-run.test.ts`'s 3-player happy-path test asserts `activeBonds.length === 3` after the 3rd bond-moment, but `assignBond`'s "skip duplicate bond assignment" fallback (`bonds.ts:52-57`) fires whenever `selectBondPair`'s 3rd draw happens to re-pick an already-bonded pair — the already-documented D1 bug ("`selectBondPair` can re-pair an already-bonded pair when all players are bonded", deferred 2026-07-03). When that fires, `bond:assigned` still broadcasts (with the *existing* bond's info) but `activeBonds.length` doesn't increment, failing the assertion. Confirmed pre-existing and unrelated to this story: `runSeed` is freshly randomized every room creation (`GameRoom.ts:192`), so the 3rd draw's collision odds are pure chance every run, independent of any production code path this story touches (verified via 4 repeated runs against this story's changes and 3 against unmodified `main`, both showing the same intermittent pattern). Not fixed here — `bonds.ts` is outside this story's Allowed paths and D1 already tracks the root cause. Revisit by fixing D1 (`selectBondPair` should filter `poolB` to exclude players already bonded to `chosen`, not just fall back to the full player pool).
Resolution: `selectBondPair` now filters the first pick to players who still have at least one available (not-already-bonded-to-them) partner, and filters the second pick to exclude players already bonded to the first pick — falling back to the full roster only in the genuinely-saturated case, where `assignBond`'s existing duplicate-dedup fallback continues to absorb it unchanged. Preserves the existing "prefer unbonded players" bias and the exact 2-`rng()`-call contract. New unit coverage in `packages/game-rules/tests/unit/bonds.test.ts` proves the 3-player D-6.9-B/D1 repro now deterministically resolves to the one remaining unbonded pair. Surfaced during implementation: the story's own suggested `poolB` formula (drop the "prefer unbonded" bias for the 2nd pick entirely) regressed an existing test in `tests/unit/bonds.test.ts` ("prioritizes unbonded players") that the story context didn't know existed — fixed by keeping an unbonded-preferred `poolB` step ahead of the not-already-bonded-to-chosen filter, verified against the full suite (467 passing, 0 regressions).

---

## Deferred from: dev implementation of 6-8-floating-damage-numbers-regular-enemies (2026-07-16)

**D-6.8-A — `host-session.ts`'s `onTransientDelta` whitelist is also missing `boss:damaged`/`boss:phaseChanged`/`boss:stomped`/`boss:defeated`** — RESOLVED by dev-5-boss-transient-delta-whitelist-fix (2026-07-16) [`apps/host-client/src/session/host-session.ts`, `onTransientDelta` whitelist inside `room.onMessage(EventNames.DELTA, ...)`]
While fixing this story's own whitelist gap (`enemy:damaged` was missing, added by this story), a direct read of the file confirmed the same class of gap exists for 4 boss-lifecycle delta types: `boss:damaged`, `boss:phaseChanged`, `boss:stomped`, `boss:defeated`. `DungeonScreen.tsx`/`App.tsx` already have handler branches for all 4 (from Stories 6.3/6.4), but none of them are reachable — the deltas update `GameState` correctly via `applyDelta`, but never reach `latestTransientDelta`, so the boss damage-flash, phase-change reaction, stomp ring, and defeat/purification-pulse/reward-reveal sequence are all currently dead code paths. Confirmed pre-existing (predates this story) and not introduced by it. Deferred rather than fixed here because it is out of this story's title scope ("regular enemies") and touching those 4 entries pulls in re-verifying the entire boss defeat/reward-reveal/purification-pulse visual sequence (Story 6.4's scope) — a materially bigger surface than the one-line whitelist fix looks like. Revisit as a dedicated follow-up story: add all 4 entries to the whitelist and manually re-verify the full boss defeat/reward-reveal sequence end-to-end.
Resolution: all 4 entries added to the whitelist OR-chain (4-line diff, no other change). User-performed live verification confirmed the phase glow, damage flash, stomp ring, and defeat/purification-pulse/reward-reveal/achievements sequence all now fire. Surfaced a new, separate, out-of-scope finding during that verification — see D-dev5-A below.

---

## Deferred from: code review of 6-8-floating-damage-numbers-regular-enemies (2026-07-16)

**D1 — No sanitization of the `damage` value before display** [`apps/host-client/src/screens/DungeonScreen.tsx:566`]
`` `-${latestTransientDelta.damage}` `` is rendered as-is. A `0`-damage event (e.g. a fully absorbed/blocked hit) would show a nonsensical "-0"; a non-integer damage value would show an unrounded float. No evidence today's combat paths can ever emit `0` or fractional damage — every existing `enemy:damaged` broadcast site computes a positive integer. Revisit if a future ability introduces variable/fractional/zero damage.

**D2 — `DAMAGE_NUMBER_Y_OFFSET` coupled to the health bar's `-32` offset only by a comment, no shared constant** [`apps/host-client/src/screens/DungeonScreen.tsx:34-36`]
`DAMAGE_NUMBER_Y_OFFSET = ENEMY_RADIUS + 24` clears the health bar (rendered at `-32`) but the two values aren't tied by any shared constant — only a comment. Matches this file's existing convention of standalone magic-number layout constants (e.g. the status-badge `-(radius+14)` offset). Revisit only if a shared layout-constant system is ever introduced.

**D3 — Damage number text has no stroke/outline for contrast** [`apps/host-client/src/screens/DungeonScreen.tsx:568-570`]
Flat white fill with no outline/shadow could become hard to read against light backgrounds. Matches the boss's existing `bossDamageFlash` convention (also flat-color, no outline) — not a regression, just an existing convention. Revisit in a future visual-polish pass.

**D4 — No guard against a duplicate damage-number spawn on effect re-invocation** [`apps/host-client/src/screens/DungeonScreen.tsx:560-576`]
If the transient-delta effect re-runs for the same delta object (e.g. React StrictMode double-invoke in dev), a duplicate number would spawn. Pre-existing class of risk shared by every other branch in this same effect (`ability:fired`, `essence:dropped`, etc.) — not unique to this story's addition.

**D5 — `enemy:damaged` arriving before Pixi's async `app.init()` resolves is silently dropped** [`apps/host-client/src/screens/DungeonScreen.tsx:560`]
The `&& app` guard short-circuits with no queue/retry if the delta arrives before `pixiAppRef.current` is set. Narrow race with no practical reachability today — combat cannot start before Pixi init resolves, since class-select/hub-navigation/level-load all take longer than the async init promise.

**D6 — Damage number can clip above the visible viewport for enemies hit near the top edge** [`apps/host-client/src/screens/DungeonScreen.tsx:36`]
An enemy at `y < 44` (virtual-canvas space) would spawn/rise a number above `y=0`. Cosmetic edge case; level layouts keep enemy spawn margins from the canvas edge in practice.

**D7 — Spec-authoring inconsistency: story's "Allowed paths" never lists `deferred-work.md`, but Tasks 1/6 mandate editing it**
Story 6.8's header "Allowed paths" section enumerates only the two host-client source files, yet Task 1 and Task 6 both require appending a finding to `deferred-work.md`. Internal contradiction in the story spec itself (not a code defect) — flag for the Orchestrator/Protocol Architect to tighten future story templates so Allowed-paths always includes any file a Task mandates editing.

---

## Deferred from: code review of 6-7-boss-combat-resolution-wiring (2026-07-16)

**D1 — One-tick defeat-detection lag lets a redundant `boss:damaged` (`newHp: 0`) fire after the killing hit**
The boss-tick phase (which flips `isDefeated` when `hp <= 0`) runs before ability-hit-resolution in `GameRoom.ts`'s per-tick sequence, and the three new boss-damage branches (Story 6.7) guard on `!isDefeated`, not `hp > 0`. So a hit landing in the same tick that already zeroed `hp` (or a stray extra hit before the next boss-tick) can still fire `boss.hp = Math.max(0, hp - damage)` and rebroadcast `boss:damaged` with `newHp: 0`. Harmless (hp stays clamped, `boss:defeated` still fires exactly once from `tickBoss`), and explicitly accepted as a deliberate tradeoff in 6.7's own Dev Notes — matches `debug:kill-boss`'s pre-existing one-tick lag. Revisit only if a future story needs the boss-defeat and last-damage broadcasts to be atomic within one tick.

**D2 — New e2e position-tracking listener isn't unsubscribed on the timeout path**
`tests/e2e/full-run.test.ts`'s `trackPlayerAndBossPositions` helper (added by Story 6.7) returns `stop()` to unsubscribe its `player:moved`/`boss:moved` listener, but `stop()` is only reached on the happy path — if `fineTuneToDistanceBand` or `waitForDelta` throws on timeout, the subscription leaks for the rest of that `host`'s lifetime. Mirrors the identical pattern already in `tests/e2e/ability-dispatch.test.ts`'s `trackPositions`/`stop()` (pre-existing, not introduced by 6.7). Test-only, negligible impact. Fix (if ever prioritized): wrap the movement/assertion steps in `try/finally` in both files.

---

## Deferred from: code review of 1-8-epic-1-post-17-deferred-hardening (2026-07-06)

**D1 — Stale `?session=` URL param pre-fills session-entry on all paths where `initialCode=undefined`** — RESOLVED by 1-9-epic-1-post-18-deferred-hardening (2026-07-07)
`handleJoin` calls `history.replaceState(null, '', '?session=' + roomId)` but never clears the URL on successful join or later navigation away. `SessionCodeEntryScreen` reads `urlCode` from `window.location.search` as the `useState` initializer fallback, so any mount where `initialCode` is `undefined` (all paths except `handleGiveUp` with a non-empty reconnect room) pre-fills with the stale room code. Fix: clear the URL (`history.replaceState(null, '', window.location.pathname)`) after join or during the Back navigation. Blocked by story 1.8 non-goal "no navigation graph changes."
Resolution: `ClassSelectionScreen.onBack` now clears `?session=` via `history.replaceState(null, '', window.location.pathname)` before navigating to `session-entry`. Scoped deliberately to `onBack` only — `handleGiveUp` (the other `initialCode=undefined`-adjacent path) was explicitly left untouched per 1.9's Known Pitfalls, since it already sets its own `sessionEntryInitialCode` when a reconnect room is known. See new D3 below for the one gap this leaves open.

**D2 — `'manual'` key sentinel would suppress remount if `sessionEntryInitialCode` is assigned the string `"manual"`** — RESOLVED by 1-9-epic-1-post-18-deferred-hardening (2026-07-07)
`key={sessionEntryInitialCode ?? 'manual'}` uses a plain string as the cleared-state sentinel. Room codes are currently sanitized to 4-char uppercase alpha, making collision impossible. Flag if room-ID format or key assignment ever bypasses `sanitizeCode`.
Resolution: documentation-only — added a one-line comment above the `key` prop stating the invariant and the revisit condition. No runtime change (per AC3, this was a doc-only hardening item).

---

## Deferred from: code review of 1-9-epic-1-post-18-deferred-hardening (2026-07-07)

**D1 — New `history.replaceState` call in `ClassSelectionScreen.onBack` is unguarded against exceptions**
Safari (and recent Chromium) throttle `history.pushState`/`replaceState` (Safari: ~100 calls/30s) and throw `SecurityError` past the limit. If it throws, `setScreen('session-entry')` (sequenced right after) never runs, but `session` has already been disconnected and nulled — stranding the user on `class-select-forced` against a dead session. The pre-existing call in `handleJoin` (line ~179) has the same gap and predates this story. Root-cause fix (wrap all `history.replaceState` call sites, or add a shared guarded helper) touches `handleJoin`, which is a blocked path for 1.9 (Story 4.7 dependency) — needs a dedicated story to address both call sites together, or an explicit decision that the risk is acceptable (very low real-world likelihood — requires dozens of rapid join/back cycles).

**D2 — Async `onLeave`/`handleDisconnect` race can override `onBack`'s navigation to `session-entry` with `reconnect` for the just-abandoned session**
`onBack` relies on `session?.disconnect()` eventually firing `room.onLeave` → `handleDisconnect` with the consented close code (4000) to clear persisted session state. If the leave doesn't resolve with that code (e.g., degraded network when Back is tapped), `handleDisconnect` runs with the stale `reconnectRoomId` still set and calls `setScreen('reconnect')` asynchronously, competing with `onBack`'s own `setScreen('session-entry')`. The URL-clear fix itself is unaffected (URL still ends up blank), but the user can land on a "Reconnect to `<abandoned-room>`?" screen for a session they explicitly left. Pre-existing race (the `disconnect()` call already existed before 1.9) — not introduced by this story, but newly visible because 1.9's own review traced this path. Fix would need `handleGiveUp`-style explicit `clearPersistedSession()` in `onBack` before disconnecting; out of scope for 1.9 (Blocked/Non-goals limit this story to the URL param only).

**D3 — `handleGiveUp` still pre-fills a stale `?session=` URL when `reconnectRoomId` is empty**
`handleGiveUp` sets `sessionEntryInitialCode = reconnectRoomId || undefined`. When `reconnectRoomId` is a real room code, this correctly overrides any stale URL. But if `reconnectRoomId` is `''` (e.g., `handleDisconnect` fired with no persisted session), `sessionEntryInitialCode` becomes `undefined` and `SessionCodeEntryScreen` falls back to reading `?session=` from the URL — which may still hold an old, abandoned room code. 1.9's Known Pitfalls explicitly excluded `handleGiveUp` from this story's scope, so this narrower case was intentionally left open. Fix (if ever prioritized): also clear the URL in `handleGiveUp` when `reconnectRoomId` is falsy.

---

## Deferred from: code review of 5-5-host-bond-visualization-assignment-overlay-and-particle-tethers (2026-07-03)

**D1 — Stale ticker rAF callback on unmount**
`app.destroy(true, {children:true})` stops the PixiJS ticker, but a pending `requestAnimationFrame` callback might fire once more post-destroy calling `renderFrame` on a destroyed stage. Pre-existing pattern shared by all player/enemy renderFrame code; not introduced by 5.5.

**D2 — `onTransientDelta` fires before `applyDelta` in host-session.ts**
`onTransientDelta(delta)` is called at line 59 before `applyDelta` at line 61. No practical bug for `bond:assigned` (players don't change on this delta; React 18 batching keeps gameState current in the effect). Fixing it would require swapping the call order across all delta types — broader refactor.

**D3 — Missing `gameState` in `latestTransientDelta` useEffect dependency array**
React hooks/exhaustive-deps lint warning. No runtime bug: display names are stable during a run and React 18 batching ensures gameState is post-delta when the effect runs. Would require adding `gameState` to the dep array (safe) or extracting the lookup into the delta handler separately.

---

## Deferred from: code review of bond-overlay-and-pair-priority-bugfixes (2026-07-03)

**D1 — `selectBondPair` can re-pair an already-bonded pair when all players are bonded**
When `unbonded.length === 0`, the fallback picks any pair from all players, including pairs that already share a bond. The function receives `bonds` but doesn't filter `poolB` to exclude players already bonded to `chosen`. Pre-existing gap (old code had the same behaviour); more conspicuous now that `bonds` is a param. Fix when duplicate-bond gameplay issues are reported.

---

## Deferred from: code review of 5-4-bond-assignment-integration-at-level-completion (2026-07-03)

**D1 — Bond-moment state not visible to reconnecting client**
When a player disconnects and reconnects during bond-moment, the snapshot on reconnect contains `phase: 'dungeon'` with no enemies and the new bond, but no signal that the server is paused awaiting CONTINUE. The mobile client can't show the bond UI or prompt the player. Out of scope for 5.4 — story 5.6 covers mobile bond card UX.

**D2 — Bond sensor fixture not cleaned when non-owner (playerB) leaves**
Bond sensor is attached to playerA's body. When playerB leaves, the `onLeave` cleanup loop checks `fixture.getBody() === expireBody` (playerB's body), which never matches. The stale fixture lives on playerA's body until `resetToHub`. Inert in practice (no contacts with the departed body), but wastes broadphase slots. Pre-existing 5.3 issue.

**D3 — `selectBondPair` is statistically biased at 3 players**
With 3 players, the slot-shift mechanic produces pair (A,C) with 2× the probability of (A,B) and (B,C). All three pairs have an equal 1-in-3 chance intuitively but the implementation is skewed. Pre-existing 5.3 issue in `bonds.ts:19`.

**D4 — `bondRng` reuses the same `runSeed` on a 2nd run in the same room**
`runSeed` is set once at room creation and never re-randomized on subsequent runs. `startDungeon` always creates `bondRng = createRng(runSeed ^ OFFSET_SPIRIT_BOND)`, so every run in the same room produces an identical bond sequence. Pre-existing design from epic 4's RNG system.

---

## From INFRA-001 — cascade auto-advance (2026-06-13)

**D1 — All-failed terminal state not handled in dispatch loop**
The loop exits when all shards are `status: complete OR failed`, but the "After All Developer Shards Complete" block only handles the all-complete case. A mixed or all-failed outcome routes to `step-04-merge.md` with no meaningful content. Pre-existing gap in the loop termination condition.

**D2 — EnterWorktree failure leaves shard in `pending`, loop may spin**
If `EnterWorktree` fails, the shard is never updated out of `pending`. On the next iteration the same shard is selected again, creating an infinite dispatch attempt. No error branch after step 2. Pre-existing.

**D3 — Retry ([R]) produces duplicate Phase Log entries**
When a user retries a shard, the agent appends a second Phase Log entry for the same role. "Latest entry" heuristic is sufficient in the happy path but accumulates noise across multiple retries. Needs Phase Log entry anchoring or shard-scoped markers. Pre-existing Phase Log design issue.

**D4 — Micro-shard confidence not included in final summary**
Micro-shards are created dynamically and are not in the original pipeline order list. The summary is undefined for them — include, exclude, or fold into parent shard's confidence? Needs a micro-shard tracking strategy.

**D5 — ExitWorktree failure after agent completion causes re-dispatch**
If `ExitWorktree` fails, the worktree stays open. The shard's status hasn't been written yet (step 7 runs after step 5). Next loop iteration selects the same shard and attempts `EnterWorktree` on an already-open branch. Pre-existing.

---

## Deferred from: code review of 6-2-grassland-boss-fsm-phase-system-and-difficulty-tiered-behaviors (2026-07-05)

**D1 — `BOSS_ADD_HP` not in `add:spawned` event payload**
`balance.ts` defines `BOSS_ADD_HP = 200` but `grassland-boss.ts` never references it, and the `add:spawned` event carries no `hp` field. Story 6.3 creates the add enemy entity in GameRoom — at that point the HP value must be available. Deferred to Story 6.3 which owns GameRoom integration.

**D2 — `dt` hardcoded to `1/30` in `buildBossContext`**
`buildBossContext` always returns `dt: 1/30` regardless of the actual elapsed time. Acceptable for the fixed 30 Hz tick loop; becomes wrong if tick rate ever changes. Deferred until a variable tick rate is introduced.

**D3 — Boss stuck when `attackCooldownTicks = 0` while `fsmState = ATTACK`**
`tickBossAttack` guards `if (attackCooldownTicks > 0)` so if ticks reach 0 externally (serialization round-trip, debug mutation) the FSM never exits ATTACK. Identical pattern exists in the base enemy FSM. Pre-existing design; only triggered by external state mutation.

**D4 — Reward floor division silently discards remainder essence**
`Math.floor(essenceTotal / players.length)` is spec-mandated. The sum of per-player shares can be 1–(N-1) less than `essenceTotal` when the total isn't evenly divisible. The `essenceTotal` field on the reward is therefore misleading. Acceptable for alpha; fix when essence accounting becomes financially meaningful (persistence, shop).

**D6 — No timeout or max-retry count on HALT responses**
If a session is closed mid-HALT and resumed, the workflow manager has no persisted "paused at HALT" state in the story file. It re-enters the loop and potentially re-dispatches completed shards. Needs a `dispatch_state: paused` field in story frontmatter or similar.

**D7 — Confidence tag format tolerance**
The `[confidence: N%]` tag is matched literally. Minor format variations (`[Confidence: 85%]`, `[confidence: 85 %]`) cause a false missing-tag HALT. A normalization step or regex tolerance note would prevent unnecessary interruptions. Pre-existing.

---

## From root-dev-script — add dev script to root package.json (2026-06-22)

**D15 — No startup ordering guarantee**
When packages evolve to ship compiled output rather than raw TypeScript source, `host-client` and `mobile-controller` may boot before workspace packages are ready. The `dev` script encodes no ordering guarantee. Pre-existing structural concern; not triggered by current scaffold.

**D16 — `backend-platform` always started in `npm run dev`**
Phase 2 (Local Party MVP) keeps cloud off the critical path, but `backend-platform` is included in the root `dev` command. Developers who only want local gameplay must have Redis available. Consider splitting into `dev:local` (sim + host + mobile) and `dev:full` in a later story.

**D17 — No `engines.npm` field**
The `-w` workspace flag requires npm ≥ 7. The project has no `engines.npm` constraint, so a developer on an older npm gets a confusing failure. Pre-existing.

---

## Deferred from: code review of 1-1-monorepo-architecture-clean-slate-and-package-scaffold (2026-06-22)

**D8 — `deserialize<T>` unsafe cast** (`packages/net-protocol/src/serialize.ts`)
`JSON.parse` returns `unknown`; casting directly to `T` is a false type-safety guarantee — a malformed payload silently passes the type checker. Acceptable for Phase 1. Add schema validation (e.g. Zod) in Phase 5 when the wire protocol is finalized.

**D9 — `deserialize` error leaks raw input** (`packages/net-protocol/src/serialize.ts`)
The thrown `SyntaxError` includes the first 80 characters of the raw input, which could leak network payload content into logs. Game input is not sensitive in Phase 1; revisit if PII or auth tokens ever flow through this path.

**D10 — `simulation-server` missing `start` script** (`apps/simulation-server/package.json`)
No `"start": "node dist/index.js"` script defined. Needed for production deployment gate. Deferred to Story 1.2, which defines the actual server implementation and entrypoint.

**D11 — `DeltaEventMsg` missing `tick` field** (`packages/net-protocol/src/messages/server-to-host.ts`)
All delta event variants lack a `tick: number` field, so clients cannot order or deduplicate out-of-order events. Not needed until Phase 5 (prediction/reconciliation). Ticket for Story 5.x.

**D12 — `@colyseus/ws-transport` not a declared dependency** (`apps/simulation-server/package.json`)
Colyseus 0.17 requires an explicit transport to be registered at server construction; without it, the server throws at startup. No runtime exists in Story 1.1 (scaffold only). Deferred to Story 1.2.

**D13 — `runSeed: number` wrong type for xoshiro128++** (`packages/shared-types/src/session.ts`)
xoshiro128++ needs 4×32-bit unsigned integer state; a plain `number` (IEEE 754 double) loses precision above 2^53, silently corrupting deterministic replay for large seeds. Deferred to Story 3.1 when the PRNG is implemented — change type to `Uint32Array` or encode as four separate fields.

**D14 — `@colyseus/redis-presence` in production `dependencies`** (`apps/simulation-server/package.json`)
This package attempts a Redis connection on import. In Phase 1 local mode, no Redis is available. Should be optional (environment-gated) or moved to `devDependencies`. Deferred to Story 1.2.

---

## Deferred from: code review of dev-1-mobile-controller-network-binding (2026-06-30)

**D18 — Hostname fallback wrong for multi-machine setups** (`apps/mobile-controller/src/session/mobile-session.ts`)
`window.location.hostname` is the correct fallback when Vite and the sim server share the same dev machine. If they run on different machines, the fallback silently points to the wrong host. By design — `VITE_SIM_URL` is the override for non-standard topologies. Not a regression from the old behavior.

**D19 — `LobbyScreen.tsx` has its own `SIM_URL` constant** (`apps/host-client/src/screens/LobbyScreen.tsx`)
Separate `const SIM_URL` in the host client used for the `/local-ip` HTTP fetch. Intentional — host client always runs on the same machine as the sim server, so `localhost` is correct there. Undocumented duplication; a future rename could miss it.

**D20 — `SIM_URL` module-level constant goes stale if phone roams mid-session** (`apps/mobile-controller/src/session/mobile-session.ts`)
Evaluated once at import time. If a phone changes network mid-session the stored URL becomes unreachable. Inherent limitation; the reconnect token is also invalidated at that point, so the failure mode is not worse than the existing reconnect path.

---

## Deferred from: code review of 1-2-simulation-server-session-lifecycle-and-30hz-tick-loop (2026-06-22)

**D18 — onLeave re-entrant during 30s grace window** (`GameRoom.ts:onLeave`)
Two concurrent `allowReconnection` coroutines can run for the same player if they disconnect, partially reconnect, and drop again during the grace window. Second coroutine's broadcast and player-removal race with the first. Needs a `pendingReconnect: Set<string>` guard. Story 1.6 reconnect hardening.

**D19 — onDispose fires while allowReconnection promise is suspended** (`GameRoom.ts:onDispose`)
`onDispose` clears the timer but does not cancel in-flight `allowReconnection` promises. When grace expires, the catch block calls `this.broadcast()` and mutates `this.gameState` on a disposed room — no-op at best, throws at worst. Add a `disposed` flag checked before any broadcast/state write in the catch. Story 1.6.

**D20 — onJoin broadcasts full snapshot to all clients** (`GameRoom.ts:onJoin`)
Spec-compliant per AC2 ("broadcast to all clients") but asymmetric with the reconnect path (unicast). At 8 players, the 7th and 8th joins each broadcast a full state snapshot to all peers — quadratic cost during lobby fill. Revisit in Story 1.5 when the lobby join flow is built out.

**D21 — Math.random() for runSeed produces signed int32 range** (`GameRoom.ts:onCreate`)
`(Math.random() * 0xFFFF_FFFF) | 0` coerces to signed int32 — range is [-2^31, 2^31-1], not [0, 2^32-1]. If xoshiro128++ downstream code ANDs with `0xFFFF_FFFF` it will disagree for negative values. Story 3.1 replaces this with a proper `crypto.getRandomValues` seed.

**D22 — Redis presence failure is silent at startup** (`apps/simulation-server/src/index.ts`)
`RedisPresence` connects lazily; the server starts successfully even if Redis is unreachable. First room operation that uses presence will fail silently. Add a startup health check (e.g., `ping`) or at minimum a warning log. Operational hardening out of Phase 1 scope.

**D23 — Snapshot passes live mutable gameState reference to serialize()** (`GameRoom.ts:tick`)
`{ type: 'snapshot', state: this.gameState }` passes the live reference. `serialize` is `JSON.stringify` (synchronous) so no race exists today. If `broadcast` ever becomes async or buffered, the next tick mutates `gameState` before serialization completes. Shallow-copy the snapshot before passing to `serialize`. Phase 5 concern.

**D24 — All players default to SessionColor.RED and PlayerClass.STONEHIDE** (`GameRoom.ts:createPlayer`)
All players in a session get identical color and class defaults. Host HUD will show duplicate RED STONEHIDE slots. Color and class should be assigned from a pool (indexed SessionColor values) and taken from the join request. Epic 2 class selection story.

**D25 — setInterval at 33.33ms (non-integer) — tick drift** (`GameRoom.ts:onCreate`)
`1000 / TICK_RATE_HZ = 33.333...` ms; Node.js coerces to 33ms, losing ~0.333ms per tick. Over 30 seconds that is ~10ms cumulative drift from wall clock. Use `process.hrtime.bigint()` self-correcting loop for Phase 5 reconciliation accuracy.

**D26 — hostId never set in SessionState** (`GameRoom.ts:createEmptyGameState`)
`hostId` is initialized to empty string and never updated. The first joiner should be recorded as host. Currently no client can identify the host for kick/transfer logic. Story 1.3 (host client bootstrap) is the natural place to set this.

**D27 — No InputEventMsg round-trip contract test** (`tests/contract/net-protocol.test.ts`)
The mobile→server wire contract (InputEventMsg) has no round-trip test. AC9 minimum is met (SnapshotMsg tested). Add in Story 1.5 when input processing is wired.

**D28 — inputQueue has no per-client depth cap** (`GameRoom.ts:onMessage`)
A flooding client can push thousands of InputEventMsg entries between 33ms ticks. Currently the queue is drained immediately each tick (no processing), so the risk is heap exhaustion in the 33ms window. Add a per-client drop policy (e.g., last-write-wins, depth=1) when input processing is wired in Story 1.5.

**D29 — EventNames routing not covered by contract tests** (`tests/contract/net-protocol.test.ts`)
Contract tests verify serialize/deserialize codec but not EventNames dispatch keys. A rename of `EventNames.INPUT` or `EventNames.SNAPSHOT` would silently break `onMessage` registration and broadcast calls without failing any test. Add routing tests when net-protocol contract coverage is expanded.

**D30 — Source files created with executable bit 100755** (`logger.ts`, `GameRoom.ts`)
Both new TypeScript source files have the executable bit set (WSL filesystem umask behavior). No runtime impact. Should be 100644. Fix with `chmod 644` if it causes CI issues.

---

## Deferred from: code review of 1-3-host-app-main-menu-and-lobby-screen (2026-06-22)

**D31 — Host `onLeave` not tracked; hostId not cleared on disconnect** (`apps/simulation-server/src/rooms/GameRoom.ts`)
`onLeave` checks `if (!player) return` — the host is never in `gameState.players`, so host disconnects are silently ignored. A second client can claim `hostId` mid-session. Story 1.6 reconnect scope.

**D32 — `applyDelta` stub drops `player:left` deltas — ghost slots persist up to 5s** (`packages/net-protocol`)
Server sends `player:left` delta on consented leave; host client applies the stub no-op, player remains in UI until next periodic snapshot (SNAPSHOT_INTERVAL_S = 5s). Documented known limitation per story Dev Notes; real applyDelta in Phase 2 delta story.

**D33 — Double-serialization risk: Colyseus may re-encode string payload** (`apps/host-client/src/session/host-session.ts`)
Server calls `serialize(snapshot)` then `client.send(event, serializedString)`. If Colyseus treats the second arg as an arbitrary value and JSON-encodes it again, client receives a JSON-string-of-a-JSON-string. Confirmed working in smoke test; revisit if serialization breaks after Colyseus version bumps.

**D34 — Snapshot broadcast storm on rapid multi-player joins** (`apps/simulation-server/src/rooms/GameRoom.ts`)
N concurrent joins each trigger a full broadcast to all N clients (O(N²) snapshot messages). Pre-existing from Story 1.2 (D20). Optimize when lobby is fully built in Story 1.5.

**D35 — `onError` after lobby transition has no visible error surface in lobby UI** (`apps/host-client/src/App.tsx`)
`setError` only renders in `MainMenuScreen`. If server drops after screen transitions to lobby, host has no visual indicator. Story 1.6 reconnect/error recovery scope.

**D36 — App unmount doesn't call `session.disconnect()`** (`apps/host-client/src/App.tsx`)
No cleanup effect on `session`. In practice App never unmounts (SPA); StrictMode double-mount in dev could create an orphaned room. Low risk; add cleanup if StrictMode double-invoke causes issues during development.

**D37 — `PlayerSlot` renders truncated session ID instead of display name** (`apps/host-client/src/components/PlayerSlot.tsx`)
AC 3 says "display name" but `PlayerState` has no `displayName` field. Current impl uses `player.id.slice(0, 8)`. Deferred until Protocol Architect adds `displayName: string` to `PlayerState` (Story 1.4 or dedicated Protocol story).

**D38 — `sendStartGame` uses raw string `'host:start'` instead of `EventNames` enum** (`apps/host-client/src/session/host-session.ts`)
Project rule requires `EventNames` for all message types, but `EventNames` has no `HOST_START` entry. Adding it requires Protocol Architect approval (`packages/net-protocol/**`). Deferred to Protocol Architect; companion ticket for Story 1.4 or net-protocol cleanup story.

## Deferred from: code review of 1-4-mobile-app-guest-join-flow (2026-06-23)

**D1 — isHost flag unauthenticated / host slot overwriteable** [GameRoom.ts:onJoin]
Any client can send `{isHost:true}` to claim host privileges; a second such client silently overwrites `hostId`. Pre-existing Story 1.3 gap — address in security hardening pass before Phase 2.

**D2 — No onLeave handling for host client** [GameRoom.ts:onLeave]
When the host disconnects, `hostId` remains stale and the room becomes unrecoverable. Pre-existing Story 1.3 gap — address in Story 1.6 reconnect flow.

**D3 — Serialization errors silently discarded in mobile-session.ts** [mobile-session.ts]
Malformed SNAPSHOT or DELTA messages are caught and ignored with no telemetry or error callback. Wire to telemetry/error surface in QA telemetry story.

**D4 — room.leave() does not remove onMessage/onError listeners** [mobile-session.ts]
Stale message handlers from a disconnected session persist in memory; will cause state contamination when reconnect flow (Story 1.6) is implemented.

**D5 — window.location.search re-evaluated on every render** [SessionCodeEntryScreen.tsx]
`urlCode` is computed at top of function body rather than in a useMemo/useRef. Harmless in practice since `useState(urlCode)` only uses the initial value; refactor opportunity.

**D6 — isSuccess dead state if parent never transitions** [SessionCodeEntryScreen.tsx]
If the parent's navigation call after `joinSession` is ever removed or deferred, the user is permanently stuck on a green Join button with no retry path. Latent refactor risk.

**D7 — Missed initial snapshot race on sub-ms RTT** [mobile-session.ts]
Server broadcasts snapshot synchronously in `onJoin`; client registers `onMessage` handlers after `await joinById` resolves. In practice Colyseus SDK buffers messages, but verify under local loopback conditions before Phase 2.

**D8 — StrictMode double-invocation on OrientationPromptScreen** [OrientationPromptScreen.tsx]
`onDismiss` fires twice in dev when device is already in landscape (StrictMode remounts the effect). Currently idempotent (`setScreen` called twice is fine); address if side effects are added to dismiss path.

**D9 — displayName XSS surface at server boundary** [GameRoom.ts:onJoin / PlayerSlot.tsx]
`playerName` is stored raw in GameState and broadcast. Safe in React JSX text nodes, but adding sanitization (length cap + strip control chars) at the server boundary before any non-React rendering is used.

**D10 — displayName field added without schema migration note** [shared-types/src/player.ts]
`displayName: string` is required with no optional marker. No persisted/replayed state exists in Phase 1 so this is safe now; document migration strategy before Phase 3 replay work.

**D11 — @colyseus/sdk patch range ^0.17.43 couples error behavior to patch releases** [mobile-controller/package.json]
`joinById` rejection vs. `onError` semantics can differ across 0.17.x patches. Pin the version when planning 0.18 migration.

**D12 — simulateOnJoin duplicates production onJoin logic** [game-room-host-join.test.ts]
Tests re-implement rather than call the real `GameRoom.onJoin`, so production divergence won't break them. Pre-existing Story 1.3 test architecture — refactor when integration test harness is available.

**D13 — NFR2 (10-second lobby appearance) has no timeout detection** [AC5]
No mechanism detects or recovers when a player slot doesn't appear within 10 seconds. Address in QA/telemetry story with latency measurement.

---

## Story 1.4 — Round 2 Review Deferred Findings

**D14 — Host role unauthenticated; any client can overwrite hostId** [GameRoom.ts:onJoin]
No guard on `this.gameState.session.hostId !== ''` before assigning a new hostId. A malicious or mis-configured client sending `{ isHost: true }` after the host joins overwrites the privileged seat. Address in server auth hardening (Phase 5 scope).

**D15 — iOS Safari BFCache thaw leaves join screen permanently loading** [SessionCodeEntryScreen.tsx]
When the page is frozen to BFCache mid-`joinById()` and later thawed, the promise is dead but `isSubmittingRef.current` stays `true`. No `pageshow`/`pagehide` handler resets the state. Address in connectivity/reconnect story or iOS-specific platform testing pass.

**D16 — App unmounts during in-flight joinSession leaves orphaned WebSocket** [App.tsx]
If `App` unmounts while `joinSession()` is awaiting, the cleanup effect captures `session=null` (noop), then the resolved session is `setSession(s)`-called on the dead component. `s.disconnect()` is never called. Player slot lingers until server 30s grace expires. Address with a `mountedRef` guard in Story 1.6 or platform hardening.

**D17 — No `room.onLeave` handler; server-initiated disconnects are invisible to UI** [mobile-session.ts]
After join, if the server forces a disconnect (`client.leave()`, room disposal, game end), `room.onLeave` fires but no callback is wired. User is stranded on ControllerScreen with a dead session. Address in Story 1.6 disconnect/reconnect flow.

**D18 — StrictMode fires `onDismiss()` twice when phone already in landscape on mount** [OrientationPromptScreen.tsx]
Dev-only. React 18 StrictMode re-runs effects after cleanup; the immediate-dismiss guard `if (mq.matches) { onDismiss(); return; }` doesn't prevent the second call. `setScreen('controller')` is idempotent so no user-visible impact. Document or add a ref guard if double-invocation causes issues in future animation work.

**D19 — `room.leave()` callable multiple times; Colyseus SDK accumulates dead handlers** [mobile-session.ts]
`room.leave()` pushes a new `onLeave` handler to the EventEmitter array each call. Not deduplicated or cleared. Becomes a concern in Phase 5 reconnect teardown where `leave()` may be called as part of reconnect handshake. Wrap with a called-once guard when reconnect is implemented.

**D20 — Short sessionId (< 6 chars) would not behave as documented in displayName fallback** [GameRoom.ts]
`client.sessionId.slice(-6)` on a string shorter than 6 chars returns the full string (no error). Colyseus currently always generates 9-char IDs via nanoid. Guard is not needed now but should be verified when Phase 5 auth providers are wired in.

---

## Deferred from: code review of 1-5-hub-world-bootstrap-and-player-presence (2026-06-23)

**D21 — slotIndex collision after player disconnects — color/spawn reuse** [apps/simulation-server/src/rooms/GameRoom.ts:100]
`slotIndex = this.gameState.players.length` is computed after every disconnect shrinks the array. A new joiner inherits a slot index already used by an existing player, colliding on `SESSION_COLORS` and `SPAWN_POSITIONS`. Story 1.6 must use a slot-reservation map instead of array length.

**D22 — isDown/isSpirit flags not checked before applying movement** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
Only `isFrozen` is tested in the movement loop. `isDown` and `isSpirit` players should also be immobile. Not meaningful in Story 1.5 scope (no combat); address in Story 3.x with the full player FSM.

**D23 — sendInput closure captures stale room reference post-reconnect** [apps/mobile-controller/src/session/mobile-session.ts:sendInput]
`sendInput: (msg) => room.send(...)` closes over the `room` object at join time. After reconnect, a new `room` object exists but `sendInput` still references the old one. Needs the same `sessionRef` pattern used in `ControllerScreen`. Address in Story 1.6 reconnect flow.

**D24 — Stop event silently dropped when session is null on touchend** [apps/mobile-controller/src/screens/ControllerScreen.tsx:stopJoystick]
If `sessionRef.current` is null when touch ends, the zero-vector stop message is never sent. The character keeps moving at last known velocity on the server until the next snapshot overwrites state. Story 1.6 reconnect scope.

**D25 — applyDelta creates new state object for unknown playerId** [packages/net-protocol/src/apply-delta.ts]
`player:moved` with an unrecognized `playerId` returns a new `{ ...state, players }` even though nothing changed. Any equality-based memoization sees a new reference and triggers a re-render. Add an early-return guard `if (!state.players.some(p => p.id === evt.playerId)) return state`. Low priority optimization.

**D26 — useEffect touch listener re-registration if sendJoystick/stopJoystick identity changes** [apps/mobile-controller/src/screens/ControllerScreen.tsx:133]
Both callbacks are stable (`useCallback` with `[]` deps) today, so the effect runs once. If a future developer adds a dep to either callback, listeners are torn down and re-added mid-touch. Currently safe; add a comment warning against adding deps.

---

## Deferred from: code review of 1-6-disconnect-grace-period-and-reconnect-flow (2026-06-24)

**D27 — `nextSlotIndex` unbounded — spawn falls back to center after slot 7** [apps/simulation-server/src/rooms/GameRoom.ts:110]
`nextSlotIndex` increments monotonically and is never reclaimed after grace expiry. `SESSION_COLORS` wraps via `%` (correct), but `SPAWN_POSITIONS` uses `?? fallback` to center-stage for indices ≥ 8. In a revolving-door session (joins, grace expires, new joins), cumulative joiners beyond slot 7 all spawn at the center. Bounded by room lifetime and `MAX_PLAYERS` concurrent constraint. Revisit with a free-slot recycling map when Phase 2 combat introduces meaningful spawn positioning.

**D28 — Mobile client applies `player:disconnected` delta to its own `gameState`, freezing itself** [packages/net-protocol/src/apply-delta.ts]
Server broadcasts `player:disconnected` to all clients including the disconnecting player's new connection. Mobile `handleDelta` → `applyDelta` sets `isFrozen: true` on the local state for the player's own ID. No UX impact in Phase 1 (controller screen doesn't render `isFrozen`), but will cause incorrect controller state in Phase 2 when the controller reflects player status. Filter out self-targeted disconnect/reconnect deltas at the mobile layer, or document the invariant clearly.

**D29 — "Rejoin as New Player" navigates to session-entry without pre-filling the room code** [apps/mobile-controller/src/App.tsx:79]
AC4 specifies "navigate to session-entry with room code pre-filled" as the primary behavior. The implementation takes the minimum fallback (bare navigation). `reconnectRoomId` is already in `App` state and can be passed to `SessionCodeEntryScreen` as an initial value. Defer to UX polish pass.

**D30 — Network indicator dot same color for `idle` and `connecting` states** [apps/mobile-controller/src/screens/ReconnectScreen.tsx:57]
Both idle ("Connection lost") and connecting ("Reconnecting…") show `var(--accent-warm)`. Only error gets `var(--corruption-blood)`. A pulsing animation or distinct color (e.g., `var(--accent-cool)`) for the connecting state would give clearer feedback. Defer to UX polish pass.

## Deferred from: code review of 1-7-epic-1-deferred-hardening (2026-06-24)

**D-1.7-A — initialCode useState seeding is mount-time only** [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:28]
`useState(initialCode ?? urlCode)` reads the prop only on first mount. If SessionCodeEntryScreen ever stays mounted while `initialCode` changes (e.g., an in-place error-retry-with-prefill flow), the field won't update. Current nav graph forces remounts on screen transitions so this is latent. Recommended hardening: add `key={sessionEntryInitialCode ?? 'manual'}` to force remount, or sync via `useEffect([initialCode])`.

**D-1.7-B — sessionEntryInitialCode could leak to future session-entry renders** [apps/mobile-controller/src/App.tsx:22]
`sessionEntryInitialCode` is only cleared in `handleGuestContinue` (auth-choice → session-entry). If a future story adds a back-to-menu or logout path reachable after first navigation, the stale reconnectRoomId-derived code silently pre-fills the field with a dead room id. Recommended hardening: clear `sessionEntryInitialCode` in `handleJoin` on success.

---

## Deferred from: code review of 2-1-hub-world-poi-layout-and-interact-button (2026-06-24)

**D-2.1-A — Missing poi-exited delta when player transitions directly between overlapping POIs** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
When `player.nearPoiId` transitions from POI-A to POI-B in the same tick (i.e., both are non-null and different), only a `poi-entered` delta for POI-B is broadcast — no `poi-exited` for POI-A. On the client, `applyDelta` overwrites `nearPoiId` with the new POI, which is correct end-state, but a strict delta stream would include the exit first. Not triggered today because `INTERACTIVE_HUB_POIS` has 2 entries placed far apart ("POIs don't overlap" is a stated design invariant). Revisit if overlapping POI zones are ever introduced in later epics.

---

## Deferred from: code review of 2-2-class-selection-flow-card-browse-and-selection (2026-06-24)

**D-2.2-A — stopJoystick not called on ControllerScreen unmount** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The joystick `useEffect` cleanup removes touch listeners but does not call `stopJoystick()` to send a zero-vector stop message. If the screen unmounts while joystick is held (e.g., during disconnect), the sim server holds the last non-zero input vector until its own timeout. Pre-existing gap from Story 1.5; address in Story 1.6 follow-up or when ControllerScreen lifetime management is revisited.

**D-2.2-B — Object.values(CLASS_DEFINITIONS) display order is implicit insertion-order** [packages/shared-types/src/class-definitions.ts]
Card row order depends on V8 object insertion order (STONEHIDE → SPIRITCALLER → SOULDRINKER → STORMCALLER). V8 guarantees this for string keys, but the ordering is a hidden invariant. Consider an explicit `const CLASS_ORDER: PlayerClass[]` in a future polish pass to make ordering intentional and reviewable.

**D-2.2-C — WebkitOverflowScrolling:'touch' deprecated** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
`-webkit-overflow-scrolling: touch` is a no-op on iOS 13+. Harmless; verify scroll momentum behavior on minimum supported iOS version before removing.

**D-2.2-D — scrollSnapType + alignItems:center may misfire on panel-open resize** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
When the ability panel opens and the card area height changes mid-drag, `scrollSnapType: 'x mandatory'` may snap to an incorrect center point. Browser-specific; verify on target device range during QA.

**D-2.2-E — Ability panel missing aria-hidden/inert when translated off-screen** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The panel div is always in the DOM (translated 100% off-screen when closed); assistive technology may reach the panel container when it is not visible. A11y out of scope for Phase 2; address in accessibility pass before launch.

## Deferred from: code review of 2-4-training-dummy-poi (2026-06-24)

**D-2.4-A — Reconnect clears client cooldowns but server retains cooldownMap entries** [apps/mobile-controller/src/App.tsx:116]
On reconnect, `setCooldowns([null,null,null,null])` resets all client-side cooldowns, but the server's `cooldownMap` retains live expiry timestamps. If a player reconnects mid-cooldown the client shows all abilities as ready; the server silently drops fire attempts until expiry. Acknowledged in story Dev Notes §Existing Code as acceptable for Story 2.4 (hub-only training dummy). Address in Story 3.x when cooldowns persist into dungeon runs.

**D-2.4-B — RELEASE ability can fire in React render gap after trainingDummyActive cleared** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
When the player leaves the training dummy, `setTrainingDummyActive(false)` dispatches but effect cleanup runs after the next render. An in-flight RELEASE thumb-lift occurring in that window fires `onAbilityFire`. Sub-frame window (~0–16ms); server validates nearPoiId and may accept or reject depending on tick timing. No user-visible corruption.

**D-2.4-C — flashUntil alpha animation only progresses on gameState updates** [apps/host-client/src/screens/HubWorldScreen.tsx:~77]
The class-confirmation flash (600ms alpha pulse) is driven by `renderFrame`, which only runs when `gameState` changes. With no player movement the flash freezes between renders. Story 2.3 scope visible in this diff; fix in a dedicated host animation pass (add `requestAnimationFrame` loop or polling effect).

**D-2.4-D — Same-tick movement+ability can silently drop ability input** [apps/simulation-server/src/rooms/GameRoom.ts:~216]
If a player is at the edge of the training dummy's proximity radius, a joystick input in the same tick as an ability input can move them outside the radius before the ability handler's `nearPoiId` check, silently dropping the ability. Negligible in casual couch gameplay; address when POI interaction precision matters (Story 3.x dungeon combat).

**D-2.4-E — Non-integer abilityIndex bypasses bounds check** [apps/simulation-server/src/rooms/GameRoom.ts:~290]
The `abilityIndex < 0 || abilityIndex > 3` check allows floats like `1.5`. `playerCooldowns[1.5]` writes a non-integer property that the expiry loop never iterates, leaking the entry. Typed mobile client prevents this in practice; add `Number.isInteger(abilityIndex)` guard in Story 3.x when ability inputs are expanded.

## Deferred from: code review of 2-5-server-persistent-joystick-vector (2026-06-24)

**D-2.5-A — Host client INPUT can populate `lastKnownJoystick` permanently** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave:162]
The `onLeave` early-return guards on `gameState.players` membership, so the host's entry is never deleted. In practice the host client never sends INPUT events; becomes a correctness issue if that constraint is ever relaxed.

**D-2.5-B — Joystick object stored by reference, not shallow-copied** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
`this.lastKnownJoystick.set(clientId, msg.event.joystick)` stores the original reference. Safe with the current JSON-string deserialization path; theoretical concern with zero-copy msgpack decoders.

**D-2.5-C — AC6 test exercises a replica of tick() logic, not real GameRoom.tick()** [apps/simulation-server/tests/game-room-host-join.test.ts]
`simulateMovementTick` is a hand-rolled mirror of the tick logic — production changes to `GameRoom.ts` won't break the test unless the helper is also updated. Matches the pre-existing `simulateOnJoin` test architecture. Revisit if a proper integration test harness becomes available.

**D-2.5-D — Reconnect sessionId Colyseus assumption unverified** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave]
`allowReconnection` is assumed to preserve the same `sessionId` (Colyseus contract), but this is never tested in the suite. An edge case where Colyseus assigns a new sessionId on reconnect would leave a stale `lastKnownJoystick` entry.

**D-2.5-E — Deadband threshold 0.05 hardcoded in both GameRoom.ts and test helper** [apps/simulation-server/src/rooms/GameRoom.ts:tick(), tests/game-room-host-join.test.ts]
Pre-existing magic number with no named constant. Changing it in one place without updating the other causes test/production divergence. Extract to a named constant when the movement system is moved to game-rules in Story 3.x.

---

## Deferred from: code review of 2-3-class-confirmation-and-hub-controller-transition (2026-06-24)

**D-2.3-A — React Strict Mode double-mount permanently loses class-confirmation flash** [apps/host-client/src/screens/HubWorldScreen.tsx:117-181]
In dev builds, Strict Mode mounts, unmounts, and remounts HubWorldScreen. If a `player:class-updated` delta arrives during the async PixiJS second-init window (while `pixiAppRef.current` is null), `renderFrame` is skipped. The new `PlayerEntry` is then created with `knownClass: player.class` (the confirmed class), so the flash is permanently lost for that delta. Dev-only; production does not use double-mount. Address before the first QA session that uses StrictMode-enabled host builds.

**D-2.3-B — No rate-limiting on CLASS_SELECT messages** [apps/simulation-server/src/rooms/GameRoom.ts:80-105]
Every valid `CLASS_SELECT` message triggers a `this.broadcast(EventNames.DELTA, delta)` to all clients. A malicious or buggy mobile client can spam the message, causing all connected clients to re-render `PlayerChip` and trigger flash animations repeatedly. Add a per-client rate limit (e.g., max 1 per second) in a future hardening story.

**D-2.3-C — applyDelta missing exhaustiveness guard** [packages/net-protocol/src/apply-delta.ts:59]
The `default: return state` in `applyDelta` silently no-ops for any delta type not explicitly handled (e.g., `player:downed`, `player:revived`, `enemy:moved`). TypeScript does not enforce switch exhaustiveness here — a `never` assertion on the default branch would catch missing cases at compile time. Add the guard when implementing Story 3.x delta types.

**D-2.3-D — RELEASE ability fires twice when lift occurs inside cell bounds** [apps/mobile-controller/src/screens/ControllerScreen.tsx:548-583]
For RELEASE-type abilities, both the element-level `onTouchEnd` handler and the document-level `onDocumentTouchEnd` handler fire when the lift occurs inside the cell's bounding rect. Both call `onAbilityFire`, resulting in two `sendInput` calls to the server for a single lift. The server processes both in the same tick; since the cooldown is written on the first and the second reads the same pre-write expiry, the ability fires twice with one cooldown entry. Occurs in interactive skill cell mode (training dummy). Address in Story 3.x when ability hit registration accuracy matters in dungeon combat.

**D-2.3-E — player:class-updated delta silently dropped if received before join snapshot** [packages/net-protocol/src/apply-delta.ts:53]
If a `player:class-updated` delta arrives at a client before the join-triggered snapshot has been processed (network reordering or rapid message delivery), `applyDelta` returns the unchanged state because the player does not yet exist in `state.players`. The class change is lost until the next periodic snapshot (every `SNAPSHOT_INTERVAL_S` seconds) restores the correct state. Acceptable for hub-mode class display; revisit if class state is load-bearing in Story 3.x combat.

---

## Deferred from: code review of 3-1-xoshiro128-prng-and-planckjs-physics-world (2026-06-25)

**D-3.1-A — `onLeave` catch block runs after room disposal** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave]
Pre-existing architecture from Stories 1.2 and 1.6 (logged as D19). The `destroyBody` call in Story 3.1 follows the same cleanup pattern as existing mutations. Planck world is never destroyed in `onDispose` so the call is safe. Full fix requires a `disposed` flag; address in Phase 5 server hardening.

**D-3.1-B — O(n) player scan in POI contact flush loops** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
`gameState.players.find(p => p.id === playerId)` runs linearly inside the POI begin/end contact flush loops. Acceptable for ≤8 players with at most 2 active POI sensors. Replace with a `Map<string, PlayerState>` lookup if player cap grows.

**D-3.1-C — No boundary walls; `linearDamping:0` with zero gravity** [apps/simulation-server/src/physics/world.ts]
Dynamic bodies receive no clamping to the virtual world rect. A planck impulse from a player-player or player-enemy collision can send players off-map with no recovery. Bounds clamping is explicitly non-goal for Story 3.1 (deferred to 3.x per non-goals section).

**D-3.1-D — Player-player contact callbacks fire without filter bits** [apps/simulation-server/src/physics/world.ts]
Player and enemy fixtures have no `filterCategory`/`filterMask`, so planck fires `begin-contact`/`end-contact` for every player-player and player-enemy pair. `extractPoiBeginContact` returns null for these correctly, keeping pending arrays clean. O(n²) contact overhead will compound when enemies are added. Set filterCategory/filterMask on player and POI fixtures in Story 3.x.

**D-3.1-E — `nextSlotIndex` never recycled — overflow spawn at center** [apps/simulation-server/src/rooms/GameRoom.ts]
Pre-existing (already logged as D27 from Story 1.6 code review). Monotonically increasing slot index; SPAWN_POSITIONS falls back to center for indices ≥ 8. Bounded by MAX_PLAYERS concurrent limit within a session; revisit with a free-slot recycling map in Phase 2 spawn positioning work.

**D-3.1-F — `planck` dependency in `packages/game-rules/package.json`** [packages/game-rules/package.json:15]
`"planck": "1.5.0"` is present as a runtime dependency in game-rules even though no game-rules source imports it (ESLint restriction enforces this). Pre-planned entry from project setup; story Dev Notes explicitly defer removal to a cleanup task. Remove in a separate dependency hygiene story.

---

## Deferred from: code review of 3-2-enemy-ai-base-fsm-and-layered-difficulty-behaviors (2026-06-25)

**D-3.2-A — Layer ordering is implicit with no validation** [packages/game-rules/src/systems/ai/fsm.ts]
The [ChargeLayer, StompLayer] ordering for Hard difficulty is established by convention but not enforced. A caller passing [StompLayer, ChargeLayer] would produce different behavior at 80-100px range. Resolve in Story 3.3 when enemy spawn assigns layers — add a constant or factory function for each difficulty tier.

**D-3.2-B — enemy:stomped apply-delta is a no-op; no host state updated** [packages/net-protocol/src/apply-delta.ts]
`case 'enemy:stomped': return state` — the AoE slow effect on players is deferred to Story 3.4 combat system. The event round-trips correctly but clients apply no state change. Resolve when combat system is implemented.

**D-3.2-C — getEnemyCount has no guard for negative or zero playerCount** [packages/game-rules/src/balance.ts]
`Math.ceil(-1 * 1.5) = -2`. Currently only called from Story 3.3+ spawn code where playerCount >= 1. Add a guard (or assert) at the Story 3.3 call site.

**D-3.2-D — ChargeLayer "charge" is fast-walking for one tick, not a committed dash** [packages/game-rules/src/systems/ai/layers/charge.ts]
CHARGE_SPEED=400px/s at 30hz ≈ 13.3px per tick (vs CHASE_SPEED=80px/s ≈ 2.7px). The charge behavior is ~5× faster movement for a single tick with no windup or commitment. Review and tune in Story 3.4 playtesting.

**D-3.2-E — BehaviorLayer cooldowns are ephemeral instance state, not serialized** [packages/game-rules/src/systems/ai/fsm.ts + apps/simulation-server/src/rooms/GameRoom.ts]
`currentCooldown` lives on the ChargeLayer/StompLayer class instance in `enemyLayers` Map. Server restart resets all layer cooldowns to 0 (immediate charge/stomp). Resolve in Phase 5 (reconnect/persistence) by adding cooldown state to EnemyState.

**D-3.2-F — StompLayer firing while fsmState=ATTACK pauses attackCooldownTicks** [packages/game-rules/src/systems/ai/fsm.ts]
When StompLayer fires, tickAttack is skipped that tick, so attackCooldownTicks doesn't decrement. The two timers (attack cooldown, stomp cooldown) are independent. This is architecturally intentional but may produce surprising attack-cooldown freezes mid-stomp in playtesting. Review in Story 3.3 when enemies are actually spawned.

---

## Deferred from: code review of 3-3-4-alpha-class-implementations-abilities-and-input-types (2026-06-28)

**D-3.3-A — AUTO ability fires with direction (0,0) when no prior drag** [packages/game-rules/src/systems/abilities.ts / apps/mobile-controller/src/screens/ControllerScreen.tsx]
AUTO abilities pass through `ctx.directionX/Y` unchanged. On the mobile client, `lastDirX/lastDirY` initialize to `0,0` and only update once a touch moves past the 6px deadzone. If the player taps an AUTO cell without dragging, the direction sent is `(0,0)`, which `dispatchAbility` accepts and broadcasts as `AbilityFiredDelta(dirX=0, dirY=0)`. No crash or user-visible issue in Story 3.3 (no damage yet), but in Story 3.4 when directional AoE is applied, the ability will always fire "nowhere" on an untouched cell. Design decision needed: AUTO cells should likely default to the player's last movement direction. Address before Story 3.4 combat resolution.

**D-3.3-B — RELEASE ability silently drops if `isInteractive` flips false while cell is held** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The `SkillCell` `useEffect` cleanup (which runs when `isInteractive` changes) clears `activeTouchRef.current` without firing RELEASE. If a player holds a RELEASE cell while the session phase transitions (e.g., dungeon ends, AC6/run-complete), the ability is silently discarded. Pre-existing pattern (D-2.4-B covered the training-dummy variant). New manifestation: dungeon-phase `inDungeon` flag can change server-side during an active hold. Low frequency in current story scope; address in Story 3.7 (clear objective / level completion) when phase transitions from dungeon are intentional.
Resolution: fixed together with D-3.23-A (same root cause). The touch-tracking effect's cleanup now fires a pending RELEASE (mirroring the existing `onTouchEnd`/`onDocumentTouchEnd` fire-once logic) before clearing state, for any teardown reason other than cooldown — real interrupts like a downed transition or dungeon-phase-end now fire the last-tracked-direction RELEASE once instead of silently dropping it, while a routine cooldown start (no longer in the effect's dependency array) never reaches this cleanup path at all.

**D-3.3-C — DungeonScreen PixiJS canvas orphan on mid-init exception** [apps/host-client/src/screens/DungeonScreen.tsx]
If `app.canvas` is appended to the DOM but `pixiAppRef.current = app` is not yet reached when a synchronous exception fires (e.g., `resizeTo`, ticker setup), the cleanup function finds `pixiAppRef.current === null` and cannot destroy the app or remove the canvas. Very low probability in production WebGL environments. Address if test environments report phantom canvas elements, or before Phase 5 stress testing.

---

## Deferred from: code review of 3-8-login-flow-update (2026-06-29)

**D-3.8-A — useEffect `/local-ip` fetch has no retry or user-visible failure feedback** [apps/host-client/src/screens/LobbyScreen.tsx:17]
`.catch(() => {})` silently swallows errors; `mobileHost` stays `null` and the QR encodes `localhost` for the session with no indication to the user. Extremely low probability in practice (WS connection on same port 2567 guarantees the HTTP server is up when LobbyScreen renders), so not blocking for Phase 3. Add a visible warning or retry if fetch failure rate becomes observable.

**D-3.8-B — `SIM_HTTP` regex silently fails for bare-hostname `VITE_SIM_URL`** [apps/host-client/src/screens/LobbyScreen.tsx:5]
`SIM_URL.replace(/^ws(s?):\/\//, 'http$1://')` is a no-op if `VITE_SIM_URL` is set to a hostname without a `ws://` prefix — the fetch URL becomes malformed. Misconfiguration case only; the default `ws://localhost:2567` transforms correctly. Add validation or a comment when the env var documentation is formalized.

**D-3.8-C — `getLocalIp()` returns `'localhost'` silently on IPv6-only or dual-stack hosts** [apps/simulation-server/src/index.ts:12]
Hard-filters `iface.family === 'IPv4'`; on an IPv6-only LAN the fallback kicks in with no log. Rare for Phase 3 local couch play. Add a `logger.warn` in the fallback path and revisit in Phase 5 cloud deployment where network topology is more varied.

---

## Deferred from: code review of 3-4-combat-resolution-hitboxes-damage-and-spirit-essence-collection (2026-06-29)

**D-3.4-A — Direction vector not normalized before `isInHitZone`** [apps/simulation-server/src/rooms/GameRoom.ts]
`isInHitZone` uses `dirX * hitRangePx` to project the hit circle center. If the player's joystick direction has sub-unit magnitude (e.g., a light touch), the effective range is proportionally shorter. Currently masked by alpha balance values being rough placeholders. Normalize the direction before calling `isInHitZone`, or normalize inside the function, when balance tuning begins in earnest.

**D-3.4-B — React state batching may swallow `enemy:killed` transient delta** [apps/host-client/src/App.tsx, apps/host-client/src/session/host-session.ts]
If `enemy:killed` and `essence:dropped` are delivered in the same WebSocket event loop task and `setLatestTransientDelta` is called twice synchronously, React 18 batches the updates and only the last value (essence:dropped) survives. The kill-fade effect on `DungeonScreen` is silently dropped. In practice, separate WebSocket frames arrive as separate event queue tasks, making this very unlikely. Fix with a callback-per-event-type or a delta queue if kill fades become visually important.

**D-3.4-C — Kill fade raceable against periodic snapshot reconciliation** [apps/host-client/src/screens/DungeonScreen.tsx]
A periodic snapshot `applyDelta` removes the enemy from `state.enemies`; `renderFrame` then hits the `!enemy` branch and destroys the Graphics immediately, bypassing the kill fade. The kill delta is broadcast in the same tick as the snapshot but may be ordered after it on the client. In practice the snapshot interval is 2 seconds and the kill delta fires in real time, making the race window extremely narrow. Add a `isRemovedServer` flag or check `deadUntil` before hard-removing in the snapshot reconciliation path if fade fidelity matters.

**D-3.4-D — Health bar has no backing track** [apps/host-client/src/screens/DungeonScreen.tsx]
At low hp, the health bar renders a tiny red sliver with no visual reference for the bar's full extent. Add a dark-grey backing rect (`rect(-15, -32, 30, 4)`) beneath the red fill for readability on the couch screen. Visual polish — defer to the UX polish pass.

**D-3.4-E — Missing zero-damage boundary test for `applyDamage`** [tests/unit/combat.test.ts]
`applyDamage(enemy, 0, dropId)` returns `ok: true` with hp unchanged (guard is `damage < 0`, not `<= 0`). The AC7 criterion "clamps hp to 0" is covered by the overkill test, but the exact-zero-input case is unspecified and untested. Add a test if the spec ever clarifies whether `damage === 0` should be a validation error.

---

## Deferred from: code review of 3-5-player-health-revive-timer-and-downed-state (2026-06-29)

**D-3.5-A — Same-tick chain-revive is order-dependent** [apps/simulation-server/src/rooms/GameRoom.ts:683]
In the proximity revive loop, players are mutated in-place. A player revived earlier in the iteration can act as reviver for subsequent downed players in the same tick. Behavior depends on array order. Deferred: need to see the revive feature fuller in order to decide — accept as designed or disallow via a `revivedThisTick` set.

**D-3.5-B — `reviveTimerExpiresAt = 0` sentinel meaning undocumented** [packages/shared-types/src/player.ts]
The field uses `0` as a sentinel for "not downed / not active". This is safe in practice (JS `Date.now()` always returns a positive value), but nothing on the field definition documents this invariant. Any future code that compares `=== 0` vs `> 0` inconsistently could introduce a subtle bug. Add a comment `// 0 = not downed` to the field definition in a cleanup pass.

---

## Deferred from code review of 3-6-spirit-form-downed-player-contribution-and-run-failure (2026-06-29)

**D-3.6-A — `--text-muted` CSS token undefined; sub-note using `--text-secondary`** [packages/ui-kit/src/tokens.css]
AC7 specified `var(--text-muted)` for the post-run overlay sub-note but the token doesn't exist in tokens.css. Implementation uses `--text-secondary` as the nearest alternative. Deferred: not sure about --text-muted use case, might be useful later. Define `--text-muted` as a distinct dimmer text color when the design system needs it.

**D-3.6-B — Spirit ability fires on same tick as run failure** [apps/simulation-server/src/rooms/GameRoom.ts:621]
Spirit dispatch runs before the run-failure check in `tick()`. An existing-spirit player with a queued input can fire their spirit ability in the same tick that the last player transitions from downed to spirit and triggers the run-failure broadcast. The spirit ability flash is immediately covered by the post-run overlay. Cosmetically harmless tick-ordering artifact — reordering adds complexity for zero gameplay impact.

**D-3.6-B — `partialEssence` field in `RunFailedDelta` unused in `apply-delta.ts`** [packages/net-protocol/src/apply-delta.ts]
`apply-delta` sets `phase='post-run'` for `run:failed` but ignores `partialEssence`. The host overlay recomputes essence independently from `gameState.players`, which is consistent. Field is an architectural placeholder for the Epic 4 post-run summary screen where per-player breakdowns will need this value.

**D-3.6-C — Slots 0–2 spurious `COOLDOWN_UPDATE { remainingMs: 0 }` for spirit players** [apps/simulation-server/src/rooms/GameRoom.ts]
When a spirit player's class ability cooldown expires, the regular expiry loop sends `COOLDOWN_UPDATE` for slots 0–2 to the mobile. Spirit players cannot use those slots, so the messages clear irrelevant UI state. Harmless but slightly wasteful. Can be eliminated by skipping the expiry notification when `player.isSpirit` in the cooldown expiry loop.

---

## Deferred from: code review of 4-1-deterministic-seed-system-and-floor-layout-generator (2026-06-30)

**D-4.1-A — Second HOST_START from `post-run` accumulates stale enemies** [apps/simulation-server/src/rooms/GameRoom.ts:114]
Phase guard only blocks re-entry when phase is `dungeon`; firing from `post-run` pushes new enemies onto the existing (non-cleared) array. Floor layout regenerates correctly (same deterministic overwrite). The enemy accumulation bug pre-dates Story 4.1. Fix: add `|| phase === 'post-run'` to the guard, or clear `gameState.enemies` / reset `floorLayout` before re-spawning. Address in Story 4.2 (dungeon entrance vote) which owns the run restart flow.

**D-4.1-B — `floorLayout` not reset to null on phase transition to `post-run`** [apps/simulation-server/src/rooms/GameRoom.ts:792]
AC5 specifies `floorLayout === null` in lobby/hub phases. Satisfied by `createEmptyGameState`, but no reset happens on dungeon→post-run transition. No return-to-hub path exists yet so this is latent. Story 4.2 should reset `floorLayout` to null when transitioning back to hub or initializing a new run.

**D-4.1-C — `BOSS_FLOOR_LAYOUT` has `isExit: false` on its only room** [packages/game-rules/src/generation/room-pool.ts]
If Story 4.3 uses `room.isExit` to detect advancement, the boss room will never satisfy the predicate. Either set `isExit: true` on the boss room, or the advancement trigger must be "boss dead" rather than "exit room". Intentional placeholder — Story 4.3 decides.

**D-4.1-D — `Corridor` directionality not documented (directed vs. undirected)** [packages/shared-types/src/floor-layout.ts]
Generator always produces a linear chain with `{ fromRoomId, toRoomId }` pairs. No contract says whether traversal is bidirectional. Story 4.3 host render work must document or encode the assumption.

**D-4.1-E — Room y-position has no clamp to virtual 1080px space** [packages/game-rules/src/generation/floor-layout.ts]
`y` range is [440, 640) with current constants. Safe with max heightPx=350. If a future template has `heightPx > 880`, top/bottom edges clip outside the 1080px virtual space. Add a clamp when template pool is expanded.

---

## Deferred from: code review of 3-7-clear-objective-and-level-completion (2026-06-29)

**D-3.7-A — `runOutcome` never resets between sessions** [apps/host-client/src/App.tsx, apps/mobile-controller/src/App.tsx]
`runOutcome` is set on `run:complete` or `run:failed` delta receipt but never cleared. If the app stays mounted across a session transition (e.g. E4 return-to-hub), `runOutcome` will carry stale state from the previous run. Fix: reset `runOutcome` to `null` on `phase` transitioning back to `hub` or `lobby`. Deferred to E4 when return-to-hub is implemented.

**D-3.7-B — Consecutive `level:complete`→`run:complete` delta overwrites `latestTransientDelta`** [apps/host-client/src/session/host-session.ts]
Both deltas are routed to `latestTransientDelta` in `App.tsx`. React 18 should process them as separate renders (separate WS message handlers), but if they arrive in the same microtask batch the second overwrites the first and the canvas flash might be skipped. Colyseus delivers room messages in order; revisit if E4 introduces higher-frequency delta bursts where batching becomes visible.

**D-3.7-C — Server keeps dead enemies (`isAlive=false`), client removes them via `filter`** [packages/net-protocol/src/apply-delta.ts line 106]
`applyDelta('enemy:killed')` uses `.filter()`, so killed enemies are absent from `state.enemies` on the client. The server's `gameState.enemies` retains them with `isAlive=false`. Any future client-side level-clear predicate using `enemies.every(e => !e.isAlive)` would fail (vacuously passes if all killed, fails the `length > 0` guard). Document and address in E4 if client-side clear logic is needed.

**D-3.7-D — Revive timer display stale during post-run transition** [apps/host-client/src/screens/DungeonScreen.tsx]
On level clear with a downed player, `reviveTimerExpiresAt` is reset server-side before `run:complete` is broadcast, but the client's timer display reads from snapshot state which may lag by up to `SNAPSHOT_INTERVAL_S`. Cosmetic: the post-run overlay covers the HUD immediately. Address in E4 when per-level timer resets get explicit `player:downed` re-broadcasts.

**D-3.7-E — `enemies.length > 0` guard silently blocks clear on empty level** [apps/simulation-server/src/rooms/GameRoom.ts]
The level-clear predicate guards on `enemies.length > 0` to avoid a vacuous clear on dungeon start. If a future `getEnemyCount` configuration returns 0 (e.g. a boss-only room with no grunt spawns), the clear condition can never fire. Add a fallback or log warning if `enemies.length === 0` and phase is still `dungeon` after N ticks.

---

## Deferred from: code review of 4-2-dungeon-entrance-vote-and-run-initialisation (2026-07-01)

**D-4.2-A — HOST_START silently cancels active vote and overrides difficulty to EASY** [apps/simulation-server/src/rooms/GameRoom.ts:115]
No `runProposal !== null` guard in HOST_START. In practice HubWorldScreen replaces the Start Dungeon button with the vote indicator, making this unreachable via normal UI. Dev-tool fallback; acceptable for current phase.

**D-4.2-B — HOST_START accepts post-run phase** [apps/simulation-server/src/rooms/GameRoom.ts:117]
HOST_START only guards `phase === 'dungeon'`, not `post-run`. HubWorldScreen is not rendered in post-run (App.tsx:69), so unreachable via normal UI. Noted in D-4.1-A from Story 4.1 review.

**D-4.2-C — Late joiner added to active voters mid-vote with no timeout** [apps/simulation-server/src/rooms/GameRoom.ts:165]
A player joining after a proposal is raised is correctly added to `activePlayers` and sees the VotePopup via snapshot. No vote timeout is in scope per story non-goals. Address in a UX polish story if the open-ended wait becomes a problem in practice.

---

## Deferred from: code review of 4-3-3-level-run-structure-and-level-transitions (2026-07-01)

**D-4.3-A — HOST_START re-entry from post-run skips hub/class-selection flow** [apps/simulation-server/src/rooms/GameRoom.ts:~115]
Guard only blocks re-entry when `phase === 'dungeon'`. From `post-run`, `startDungeon()` fires, `loadLevel(1)` correctly clears enemies and positions players, but host and mobile clients are never signalled to return to hub — they transition directly from the post-run overlay into a new dungeon snapshot with stale class selections. Pre-existing gap; `loadLevel`'s enemy-clearing fix (Story 4.3) removes the accumulation risk noted in D-4.1-A, but the client flow issue remains. Address in the return-to-hub story (post-E4).

**D-4.3-B — Boss victory check `=== 4` narrower than `loadLevel` guard `>= 4`** [apps/simulation-server/src/rooms/GameRoom.ts:969]
`loadLevel` branches on `index >= 4` to create the victory trigger; the tick-level run:complete check guards on `levelIndex === 4`. If `loadLevel(5+)` were ever called (currently unreachable: level 4 has no enemies so level-clear never fires there), the victory trigger body would exist but the `=== 4` check would never fire, permanently stalling the run. No impact today; align to `>= 4` in a future cleanup pass.

**D-4.3-C — O(n²) indexOf in player spawn loop** [apps/simulation-server/src/rooms/GameRoom.ts:482]
`this.gameState.players.indexOf(player)` inside a `for...of` over the same array. MAX_PLAYERS=8 so 64 comparisons max — negligible. Replace with an index-based `for` loop if the player cap grows.

---

## Deferred from: code review of 4-4-survive-the-waves-objective (2026-07-01)

**D-4.4-A — Broadcast storm if loadLevel throws mid-tick** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
Wave completion tick calls `loadLevel(nextIndex)` without a try/catch. If `loadLevel` throws (e.g., invalid index, planck error), the tick exits mid-broadcast, leaving room state inconsistent. Pre-existing pattern from Clear objective — the same unguarded call was there before Story 4.4.

**D-4.4-B — Run-failure races wave-complete in same tick** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
If the last alive player dies in the same tick that the last wave enemy dies, both the run-failure block and the wave-complete block can fire (order: run-fail → wave-complete, due to tick ordering). Intentional per AC5 ("run failure takes precedence"); the wave-complete branch is guarded by `allEnemiesDead && wavePauseUntil===0 && waveIndex>0` which doesn't check if run already failed. No user-visible issue; document in tick ordering comment if clarity is needed.

**D-4.4-C — Tick block evaluation order is an undocumented load-bearing invariant** [apps/simulation-server/src/rooms/GameRoom.ts:~1040]
`allEnemiesDead` is computed once before the survive-waves block but after the run-failure block. Block ordering determines correctness (run-fail before wave-clear). Not obvious from reading the code in isolation. Add a short ordering comment if a future story adds a third tick block in this region.

**D-4.4-D — Wave timing non-deterministic under replay** [apps/simulation-server/src/rooms/GameRoom.ts:wavePauseUntil]
`wavePauseUntil` uses `Date.now()` (wall clock), not tick count. Replay scenarios will produce different wave-pause durations depending on replay playback speed. Same systemic pre-existing issue as other Date.now() tick comparisons in the codebase. Address in Phase 5 deterministic replay work.

**D-4.4-E — RNG seed fragile for waveNum ≥ 16 or future OFFSET_ENEMY_SPAWN bit changes** [apps/simulation-server/src/rooms/GameRoom.ts:478]
Seed packing `OFFSET_ENEMY_SPAWN | (levelIndex << 8) | (waveNum << 4)` assumes `waveNum` fits in 4 bits (≤15). With `totalWaves=3` this is safe. If WAVE_COUNTS is raised above 15 or OFFSET_ENEMY_SPAWN grows into bits 4-5, seeds collide silently. Not a current concern; document the constraint in balance.ts if WAVE_COUNTS grows.

---

## Deferred from: code review of 4-5-post-run-summary-screen (2026-07-01)

**D-4.5-A — runSeed not reset in resetToHub — same floor layout every run per session** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`runSeed` is only randomized in `onCreate`. Repeating runs in the same room replay identical floor layouts. Not a 4.5 concern (seed management is pre-existing design). Randomize `runSeed` in `resetToHub` when dungeon variety becomes important.

**D-4.5-B — runOutcome ?? 'complete' fallback shows victory on null outcome (host reconnect)** [apps/host-client/src/App.tsx]
If the host reconnects mid-post-run, `runOutcome` is `null` (snapshot doesn't carry it) and defaults to `'complete'`. Visual only — hub transition still correct. Intentional per Dev Notes; `GameState.session` would need a `runOutcome` field to fix cleanly. Address in Phase 5 session state hardening.

**D-4.5-C — Stale dungeon fields in hub snapshot: levelObjective, waveIndex, totalWaves, difficulty** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`session.levelObjective/waveIndex/totalWaves/difficulty` are not cleared in `resetToHub`. Hub snapshot carries last-run values. HubWorldScreen doesn't render these so no visible regression now. Clear them in `resetToHub` before hub screens start reading session objective fields.

**D-4.5-D — Player physics bodies retain linear velocity after hub teleport** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`body.setPosition(hubSpawn)` without `body.setLinearVelocity(Vec2(0,0))`. Sub-tick drift before next state broadcast. Add velocity reset alongside position reset.

---

## Deferred from: code review of 4-6-end-to-end-run-e2e-test-and-latency-baseline (2026-07-02)

**W1 — measure.ts uses raw string literals instead of EventNames**
`tools/latency-baseline/measure.ts:24,32` — `player.send('class:select', ...)` and `player.onMessage('delta', ...)` use hardcoded strings. Standalone tool by design (no monorepo dep); if event names change in net-protocol the tool silently stops collecting valid latency samples.

**W2 — L1/L3 enemy counts (5 and 8) not asserted**
`tests/e2e/full-run.test.ts:88,101` — AC1 says "5 enemies die" (L1) and "8 enemies die" (L3) but the test only checks `levelIndex` on completion. Requires reading `gameState.enemies.length` from a snapshot at enemy spawn time.

---

## Deferred from code review of 4-8-forced-class-selection-on-join (2026-07-02)

**W3 — Reconnect during class-select-forced → permanent soft-lock (deferred by user)**
`App.tsx:161-175, GameRoom.ts:723` — A player who disconnects before picking a class reconnects via `handleReconnect` straight to `'controller'`. The null-class velocity gate (Task 4) freezes their body; the null-class circle guard (Task 3) hides them on host. The class-select POI is 560px from spawn and unreachable while frozen. No UI recovery path. Story spec explicitly deferred the reconnect edge case; user chose to keep it deferred. Fix: check `player.class === null` in reconnect path and route to `'class-select-forced'` instead of `'controller'`.

**W4 — Optimistic class:select with no server ack**
`App.tsx:203-206` — `sendClassSelect` + `setScreen('orientation-prompt')` fires without waiting for server confirmation. A dropped message leaves `player.class === null` while the mobile believes class is set. Combined with the null-class velocity gate (GameRoom.ts:723), this would produce a soft-lock. Local WebSocket message loss is vanishingly rare; pre-existing fire-and-forget pattern throughout the codebase. Needs a `class:confirmed` delta and a loading state if reliability requirements increase.

**W4 — Unit test mirrors tick logic instead of exercising GameRoom**
`tests/unit/null-class-gate.test.ts` — `tickVelocity` re-implements the null-class condition locally rather than calling the actual GameRoom tick path. Regressions in `toMeters`/`SPEED`/`TICK_RATE_HZ` would not be caught by this test. Accepted approach per story spec ("pure function test"). Consider a lightweight GameRoom integration test if tick regressions become a pattern.

**W5 — Stale consented-leave callback race on immediate re-join**
`App.tsx:198-201` — After tapping Back (consented disconnect), if the user immediately re-joins a new room, `persistSession` for the new room can run before `handleDisconnect(4000)` fires `clearPersistedSession` for the old room. The old callback would then erase the new token. Practical window is <100ms — not reachable by human interaction. Pre-existing pattern.

---

## Deferred from: code review of 5-1-spirit-bond-shared-types-and-protocol-contracts (2026-07-02)

**D-5.1-A — `bondColor` (wire) vs `color` (state) naming split** [`packages/net-protocol/src/apply-delta.ts:135`]
`BondAssignedDelta.bondColor` maps to `BondState.color`; `apply-delta.ts` manually bridges them. TypeScript catches any accidental mismatch. The asymmetry is consistent with how `bondType→type` works in the same delta-to-state mapping — prefixed wire fields, unprefixed state fields. Intentional convention; revisit if the pattern causes confusion in story 5.4 broadcast construction.

**D-5.1-B — `bondDescription`/`bondMechanic` unconstrained `string` in `BondNotificationMsg`** [`packages/net-protocol/src/messages/server-to-mobile.ts`]
No union type, schema validation, or lookup table constrains these fields. Valid values per bond type will be defined in story 5.4 (level-completion integration). Add a per-BondType lookup or narrow union when story 5.4 populates these strings, or define them in `game-rules` so they are derivable from `BondType`.

**D-5.1-C — `BondAssignedDelta` not individually exported from net-protocol index** [`packages/net-protocol/src/index.ts`]
Only `DeltaEventMsg` (the union) is exported. Switch-narrowing in host-client code works without a named import, and `satisfies DeltaEventMsg` in tests enforces the correct shape. Pre-existing pattern — no other delta types are individually exported either. If consumers frequently need to annotate explicit `BondAssignedDelta` variables, add it to the index alongside `DeltaEventMsg` in a net-protocol cleanup pass.

**D-5.1-D — Mobile lacks `bondDescription`/`bondMechanic` after reconnect** [`packages/net-protocol/src/messages/server-to-mobile.ts`, story 5.6]
Snapshot carries `activeBonds: BondState[]` (playerA, playerB, type, color only). The unicast `BondNotificationMsg` is not re-sent on reconnect. A reconnecting mobile client can display who they're bonded with and the color, but not the human-readable description or mechanic. Story 5.6 (mobile bond card) should re-derive description/mechanic from `bondType` on the client (lookup table in `game-rules` or `shared-types`), or the server should re-unicast `BondNotificationMsg` on reconnect.

**D-5.1-E — `SimEvents['bond:assigned']` missing `bondColor` — story 5.4 handoff hazard** [`packages/shared-types/src/session.ts:25`]
The internal sim-server event bus type `SimEvents['bond:assigned']` has `{ playerA, playerB, bondType }` — no `bondColor`. When story 5.4 wires up bond-assigned broadcasting in `GameRoom.ts`, it cannot forward the `SimEvents` payload directly to `BondAssignedDelta` — it must independently compute and append `bondColor`. This is by design (color is a rendering concern added at broadcast time), but story 5.4 must be aware of this gap to avoid a silent `undefined` for `bondColor` on the wire.

---

## Deferred from: code review of 5-2-bond-assignment-logic-and-deterministic-pair-selection (2026-07-03)

**D-5.2-A — `selectBondPair` has no internal guard for 1-player input** [`bonds.ts:19-24`]
Function is exported for tests but has no guard on `players.length >= 2`. The `!` non-null assertion suppresses TypeScript's check; a 1-player call would throw at runtime on `players[adjustedB]!.id`. Pre-existing by design: all call sites route through `assignBond` which guards length. Consider a JSDoc precondition comment if the export surface grows.

**D-5.2-B — Same pair can bond multiple times in `activeBonds`** [`bonds.ts:39`]
With 2 players and 3 `assignBond` calls, all 3 entries share the same pair. No dedup guard exists. This is intentional per story non-goals ("Bond cooldown / dedup across runs"). Story 5.3 (per-tick bond effects) must account for this when applying buffs/drains to avoid stacking.

**D-5.2-C — `selectBondPair` index math fragile if `rng()` ever returns ≥ 1.0** [`bonds.ts:20-21`]
`Math.floor(rng() * N)` is safe only while `rng()` is strictly `[0,1)`. The xoshiro128 implementation satisfies this but there's no runtime assertion. If the RNG is ever swapped for one that can return `1.0`, `players[N]!.id` would throw. Pre-existing RNG contract assumption.

**D-5.2-D — N=8 max players and `rng()=0.0` boundary not tested** [`bonds.test.ts`]
Tests cover N=2 and N=3. N=8 (session maxPlayers) exercises `adjustedB` reaching index 7. `rng()=0.0` pins the exact `idxA=0, idxB=0 → adjustedB=1` path. Both are nice-to-have regression guards against future shift-up refactors.

---

## Deferred from: code review of 5-3-per-tick-bond-effects-proximity-and-fate-bond-types (2026-07-03)

**D-5.3-A — No server-side duplicate-bond guard in `assignBond`** [`game-rules/src/systems/bonds.ts:39`]
`assignBond` pushes unconditionally; calling it twice for the same pair results in two identical entries in `activeBonds`, causing double drain and double buff. The client-side `applyDelta` dedup prevents this showing in the mirror state, but the server runs the drain loop twice per tick. Story 5.4, which is the only caller of `assignBond`, must guard against re-assigning an already-bonded pair — or add a server-side dedup check in `assignBond` itself before pushing.

**D-5.3-B — Downed/spirit players receive physics movement and Fate speed buff** [`GameRoom.ts:770`]
The movement loop only guards on `isFrozen` and `class === null`, not `isDown` or `isSpirit`. Downed players can still move their physics body, triggering bond sensor enter/exit contacts and resetting the proximity drain timer for their pair. Pre-existing issue (logged in D-1.5 scope as D22); new consequence with story 5.3 bond drain. Fix: add `|| player.isDown || player.isSpirit` to the movement freeze guard.

**D-5.3-C — `getFateBondWipeTargets` does not filter `isFrozen` partners** [`game-rules/src/systems/bonds.ts:99`]
The cascade correctly skips `isDown` and `isSpirit` partners, but not `isFrozen` (disconnected-and-in-grace) partners. `applyPlayerDamage` currently rejects frozen players (`ok: false`), which prevents the cascade from including them — but this guard is implicit. If `applyPlayerDamage` is ever relaxed or the function is called from a different context, the frozen check would be missing. Document the invariant or add an explicit `isFrozen` filter to `getFateBondWipeTargets`.

---

## Deferred from: code review of 5-6-mobile-bond-card-and-continue-ux (2026-07-03)

**D-5.6-A — `room.reconnection.enabled = false` is a silent no-op** [`apps/mobile-controller/src/session/mobile-session.ts:99`]
Colyseus JS SDK `Room` class has no `reconnection` property. The assignment silently does nothing. The intent was to disable SDK auto-reconnect so `onLeave` fires immediately on network drop. Verify the actual Colyseus 0.17 API for disabling auto-reconnect; may need `room.connection.isOpen` polling or another approach. Pre-existing code, not introduced by 5.6.

**D-5.6-B — `reconnectToSession` silently skips token refresh if sessionStorage was cleared** [`apps/mobile-controller/src/session/mobile-session.ts:153`]
`persistSession` is only called inside the `if (existing)` guard. If `clearPersistedSession` was called from another tab or path between disconnect and reconnect, the fresh `reconnectionToken` is never saved. A subsequent disconnect has no token and cannot reconnect. Pre-existing.

**D-5.6-C — Own player `isFrozen`/`isReconnected` flags never applied locally** [`apps/mobile-controller/src/App.tsx:105`]
`handleDelta` early-returns for self-targeted `player:disconnected` / `player:reconnected` deltas without calling `setGameState`. The local player's `isFrozen` remains `false` even when the server has it as `true`. Pre-existing from Story 1.6.

**D-5.6-D — `handleJoin` re-throws with no caller error boundary** [`apps/mobile-controller/src/App.tsx:152`]
`try/catch { throw err }` re-throws to `SessionCodeEntryScreen` which handles it for reset. However any unhandled rejection in the async chain leaves the user stuck with no feedback. Pre-existing pattern.

**D-5.6-E — `sessionRef` is null during window between `wireRoomHandlers` and `setSession`** [`apps/mobile-controller/src/session/mobile-session.ts:119`]
Message handlers are registered before the session is passed to `setSession`. A `player:disconnected` delta arriving in that window compares against `sessionRef.current?.playerId === null` and misses the early-return guard. Pre-existing.

---

## Deferred from: code review of 6-1-grassland-boss-shared-types-and-protocol-contracts (2026-07-05)

**D-6.1-A — `boss:defeated` carries `RunReward` not persisted to `GameState`** [`packages/net-protocol/src/apply-delta.ts`]
`BossDefeatedDelta.reward` is a fully populated `RunReward` but `applyDelta` only sets `boss.isDefeated = true` (per spec AC10). No `runReward` field exists on `GameState`. Host must read the reward from the raw delta event, meaning it is ephemeral and lost after the event fires. Story 6.4 must decide: raw-event caching pattern vs. adding `runReward: RunReward | null` to `GameState` (would make the reward available in snapshots and survive reconnect during post-boss sequence).

**D-6.1-B — Out-of-range `BossPhase` value passes deserialization silently** [`packages/net-protocol/src/serialize.ts`]
`BossPhase` is a numeric enum (1/2/3). `deserialize<T>` is a bare `JSON.parse(...) as T` cast with no schema check. A value of `0`, `4`, or `null` arriving on the wire is silently accepted and stored as an invalid phase. No runtime validation anywhere in the protocol stack. Pre-existing cross-cutting concern (see D8 from story 1-1 review). Address in Phase 5 schema hardening (Zod or equivalent at protocol boundary).

**D-6.1-C — `reviveTimerExpiresAt: Date.now() + reviveWindowMs` evaluated on client** [`packages/net-protocol/src/apply-delta.ts:65`]
Pre-existing bug. `applyDelta` runs on the host client; `Date.now()` differs from server clock by one-way latency (typically 20–200ms on LAN). The revive countdown display will be systematically wrong by at least that offset. Fix: server should send the absolute expiry timestamp (`reviveTimerExpiresAt: number`) in `PlayerDownedDelta` instead of a window duration, or `applyDelta` should accept a reference clock argument.

**D-6.1-D — `masteryMilestones: string[]` unbounded, no max-length cap** [`packages/shared-types/src/run-reward.ts:4`]
`RunReward.perPlayer[n].masteryMilestones` is an uncapped string array. A large milestones list inside a `boss:defeated` delta could exceed WebSocket frame limits or Colyseus message buffers with no size guard. No `MAX_MASTERY_MILESTONES` constant defined. Out of scope for types-only story 6.1. Define cap and add a constant in story 6.5 (grassland achievements) when milestone generation is implemented.

---

## Deferred from: code review of 6-3-boss-arena-handcrafted-level-physics-geometry-and-host-rendering (2026-07-05)

**D-6.3-0 — Player abilities never target the boss; `boss:damaged` never broadcast** [`apps/simulation-server/src/rooms/GameRoom.ts:1171`]
The ability hit-scan loop only iterates `gameState.enemies`. No boss hit-scan path exists. Boss HP can never decrease from player input; the HP bar is static. Deferred to Story 6.4, which already owns BossDefeatedDelta + RunVictoryMsg — wiring the damage path there keeps all boss-defeat logic in one story.

**D-6.3-A — GrasslandAdd enemies get empty behavior layers** [`apps/simulation-server/src/rooms/GameRoom.ts:~1088`]
`add:spawned` handler pushes the new `EnemyState` and body but never calls `this.enemyLayers.set(...)`. The enemy AI tick uses `this.enemyLayers.get(id) ?? []`, so adds run with base FSM only and no special behaviors (no charge, no stomp). Likely intentional — GRASSLAND_ADD is a basic melee add. Revisit when GRASSLAND_ADD AI spec is written (story 6.5 or combat tuning pass).

**D-6.3-B — Boss dynamic body is pushable by players** [`apps/simulation-server/src/rooms/GameRoom.ts:799`]
Boss body created as `dynamic` with `density: 1`; player bodies collide with it and apply impulses. Boss is displaced by players pressing against it. Out of scope per story spec ("Collision between boss body and walls for PLAYERS is out of scope"). Fix by making boss body kinematic or using a mass-override when player→boss collision handling is scoped.

## Deferred from: code review of 6-4-boss-defeat-sequence-purification-pulse-and-reward-reveal (2026-07-06)

**D-6.4-A — `debug:kill-boss` accessible to any connected client** [`apps/simulation-server/src/rooms/GameRoom.ts:291`]
No `NODE_ENV` or role guard on the `debug:kill-boss` message handler — any mobile client can send it to instantly kill the boss. Pre-existing pattern (identical to `debug:kill-all`). Add a `process.env.NODE_ENV !== 'production'` guard to both debug handlers before deploying to cloud/production.

**D-6.4-B — Reconnecting player sees "Run Ended" instead of "Victory!" after boss defeat** [`apps/simulation-server/src/rooms/GameRoom.ts:1134`]
`RUN_VICTORY` is unicast at the moment of `boss:defeated` processing. A player who disconnects during the fight and reconnects during `post-run` never receives the `RUN_VICTORY` message; `runVictoryEssence` stays null; `PostRunMobileScreen` shows `isVictory=false`. Fix requires re-sending `RUN_VICTORY` (or including essence in the `post-run` snapshot) during reconnect state restoration. Address in post-run reconnect polish pass.

## Deferred from: code review of 6-5-grassland-biome-achievements (2026-07-06)

**D-6.5-A — `bossLevelStartedAt=0` sentinel: FastBoss trivially true if epoch-zero clock** [`packages/game-rules/src/systems/achievements.ts:20`]
`bossDefeatedAt - 0 <= 120_000` is trivially true if either timestamp is near epoch (test environments with mocked time, or before boss level is ever loaded). Safe in production and in the current test suite (NOW=1_000_000), but the `0` sentinel is semantically ambiguous. Add an explicit guard (`bossLevelStartedAt === 0 → FastBoss: false`) or initialize to a sentinel that cannot be confused with a valid timestamp.

**D-6.5-B — `runOutcome` not cleared on hub phase — asymmetric with `runReward`** [`apps/host-client/src/App.tsx`]
`runReward` is cleared when `gameState.session.phase === 'hub'` but `runOutcome` is not. If a run transitions to `post-run` then back to `hub` without a `run:failed` delta (e.g., rapid state transition edge case), the stale `runOutcome` value is still set for the next post-run screen. Clear both in the same hub-phase useEffect.

**D-6.5-C — React one-frame flicker: `boss:defeated` and phase change arrive in same tick** [`apps/host-client/src/App.tsx`]
`setRunReward` (set from `boss:defeated` delta) and `setGameState` (phase → `post-run`) are separate React state updates. A render cycle exists where `gameState.session.phase === 'post-run'` is true but `runReward` is still null, causing PostRunSummaryScreen to render once without achievements before re-rendering with them. Batch both state updates in the same event handler, or guard `PostRunSummaryScreen` render until `runReward` is non-null.

**D-6.5-D — `ACHIEVEMENT_NAMES[achievement]` renders `undefined` on version skew** [`apps/host-client/src/screens/PostRunSummaryScreen.tsx`]
If the server adds a new `GrasslandAchievement` value before the host client is redeployed, `ACHIEVEMENT_NAMES[achievement]` returns `undefined` and renders as an empty string with no fallback. Add a nullish coalesce: `ACHIEVEMENT_NAMES[achievement] ?? achievement` (falls back to the raw enum key).

## Deferred from: quick-dev session (2026-07-06)

## Deferred from: code review of 6-6-epic-6-deferred-hardening (2026-07-06)

**D-6.6-A — `NODE_ENV=undefined` exposes debug handlers in staging** [`apps/simulation-server/src/rooms/GameRoom.ts:279`]
`process.env['NODE_ENV'] !== 'production'` is `true` when `NODE_ENV` is unset (default in many CI/staging environments). The debug kill handlers will be registered in any deployment that omits `NODE_ENV=production`. The guard is strictly better than no guard (pre-existing state), but explicit staging environments should set `NODE_ENV=production` or use a separate `ENABLE_DEBUG_COMMANDS` env var for finer control.

**D-6.6-B — `handleReconnect` doesn't reset `runOutcome`/`runVictoryEssence`** [`apps/mobile-controller/src/App.tsx`]
`handleReconnect` resets cooldowns, bond state, and connection state but not `runOutcome` or `runVictoryEssence`. The new hub-phase `useEffect` covers the normal path (server sends hub snapshot → effect fires → state cleared). Edge case: player reconnects into a still-`post-run` room where `lastRunReward` has been cleared on the server (e.g., host crashed and room restarted), leaving `runVictoryEssence` stale from the previous run. Low probability; fix when stale post-run state is reported.

## Deferred from: code review of 2-8-hub-ability-use-outside-training-dummy-poi (2026-07-15)

**D-2.8-A — `isInteractive`'s `!inDungeon` short-circuit bypasses `isDown`/`isSpirit` outside a dungeon** — RESOLVED by 2-9-epic-2-post-28-deferred-hardening (2026-07-20) [`apps/mobile-controller/src/screens/ControllerScreen.tsx:1291`]
`(!inDungeon || (!isDown && !isSpirit))` never evaluates the `isDown`/`isSpirit` clause when `inDungeon` is false. Currently unreachable in practice: `App.tsx` routes the `post-run` phase away from `ControllerScreen` to `PostRunMobileScreen`, and `resetToHub` unconditionally zeroes `isDown`/`isSpirit` before `hub`/`lobby` ever render `ControllerScreen` again. But the client has no independent gate of its own — if that routing ever changes, a downed/spirit player could see an incorrectly-interactive skill cell. Server-side is unaffected (GameRoom.ts's own `isDown`/`isSpirit` guard at line 1896 still blocks the actual ability dispatch).
Resolution: dropped the `!inDungeon ||` bypass — the non-spirit-cell branch now gates on `(!isDown && !isSpirit)` unconditionally, matching the spirit-cell branch's own unconditional `!isFrozen` gate.

**D-2.8-B — No automated test coverage for the `ControllerScreen.tsx` interactivity-gate rewrite** [`apps/mobile-controller/src/screens/ControllerScreen.tsx`]
The riskier of this story's two diff hunks (a boolean-expression rewrite gating real touch input) ships with zero test coverage. Consistent with this repo's pre-existing lack of any `apps/mobile-controller` test precedent (confirmed: no `.test.*` files exist under that app), so this is not a regression introduced by 2.8, but the gap remains real.

**D-2.8-C — No regression test for the surviving ability-input guards** — RESOLVED by 2-9-epic-2-post-28-deferred-hardening (2026-07-20) [`apps/simulation-server/src/rooms/GameRoom.ts:1896`]
`isFrozen`/`isDown`/`isSpirit`/`player.class === null` still gate ability processing (unchanged by this story) but no test asserts any of them still reject input post-change. Pre-existing gap, not introduced by 2.8 and outside its Required Tests scope.
Resolution: added `apps/simulation-server/tests/game-room-ability-guard.test.ts`, mirroring the guard at `GameRoom.ts:1961` and asserting each of the 4 rejection conditions independently blocks dispatch, plus one all-clear passing case.

**D-2.8-D — `raceTimeout` test helper duplicated instead of centralized** — RESOLVED by 2-9-epic-2-post-28-deferred-hardening (2026-07-20) [`tests/e2e/hub-ability-use.test.ts`]
The `raceTimeout` generic (wraps `Promise.race` + `setTimeout`) is copy-pasted verbatim from `ability-dispatch.test.ts` rather than extracted into `tests/helpers/`. Low risk, but the next e2e test file will likely copy it a third time. Out of this story's Allowed Paths (adding/editing a shared helper file wasn't in scope).
Resolution: extracted to `tests/helpers/race-timeout.ts`; `ability-dispatch.test.ts`, `hub-ability-use.test.ts`, and `full-run.test.ts` (which had since acquired its own 3rd copy) now import it instead of defining a local copy.

**D-6.6-C — Reconnecting player during the 5.5s purification window lands on ControllerScreen then abruptly jumps to PostRunMobileScreen** — NOTE (2026-07-20): mis-filed under this section's header; ID prefix and content (`GameRoom.ts:1184`, boss purification, PostRunMobileScreen) are Epic 6 subject matter, not Epic 2. Left open/unresolved here — an Epic 6 hardening story is the correct owner. [`apps/simulation-server/src/rooms/GameRoom.ts:1184`]
While online players see the purification animation on the host screen, the mobile client's phase is still `'dungeon'` (only changed via `run:complete` delta or snapshot). A player who reconnects during this 5.5-second window gets a snapshot with `phase='post-run'` immediately from the server but their mobile then shows the controller screen briefly before `run:complete` arrives. No data loss; UX is jarring. Pre-existing design; fix when post-run mobile UX is polished.

## Deferred from: code review of 2-6-epic-2-deferred-hardening (2026-07-06)

**D-2.6-A — rAF stale `rafRef` if `renderFrame` throws** — RESOLVED by 2-9-epic-2-post-28-deferred-hardening (2026-07-20) [`apps/host-client/src/screens/HubWorldScreen.tsx:201`]
Inside the flash `tick` closure, if `renderFrame` throws, `rafRef.current` is left holding the ID of the already-executed (now invalid) frame. The `if (rafRef.current === null)` guard in the `[gameState]` effect then treats the loop as still running, permanently blocking future flash animation restarts. `renderFrame` is stable PixiJS rendering with no throw paths in the current codebase. Address if WebGL context loss or PixiJS upgrade ever introduces error paths in `renderFrame`.
Resolution: wrapped the `renderFrame` call inside `tick` in try/catch — on catch, logs the error, sets `rafRef.current = null`, and stops the loop (no reschedule) instead of leaving a stale non-null id.

**D-2.6-B — `stopJoystick` sends zero-velocity unconditionally on effect cleanup** — RESOLVED by 2-9-epic-2-post-28-deferred-hardening (2026-07-20) [`apps/mobile-controller/src/screens/ControllerScreen.tsx:1138`]
The joystick `useEffect` cleanup calls `stopJoystick()` regardless of whether a touch is currently active (`activeTouchIdRef.current !== null`). When the component unmounts with no active joystick touch, a spurious `{ joystick: { x: 0, y: 0 } }` message is sent. The server discards duplicate zero-vector inputs without side effects. Address if spurious messages ever appear in input telemetry noise analysis.
Resolution: cleanup now only calls `stopJoystick()` when `activeTouchIdRef.current !== null`; the 4 `removeEventListener` calls remain unconditional.

**QD-6-A — Player abilities never damage the boss** — NOTE (2026-07-20): resolved by Story 6.7 (boss combat resolution wiring) and extended by 6.9. Confirmed via `GameRoom.ts`: boss hit-scan branches broadcasting `boss:damaged` now exist at multiple sites (hit-scan/mixed-faction ~2229-2236, zone-tick ~1560, Storm Eye strike ~1595), all clamping `hp` via `Math.max(0, hp - damage)`. No action needed.
The ability hit-scan loop in `GameRoom.ts` (~line 1251) only iterates `gameState.enemies`. The boss is never checked. Fix: after the enemy loop, add a boss hit-scan — check `isInHitZone` against `gameState.boss.position`, reduce `boss.hp` by damage, broadcast `BossDamagedDelta` (`{ type: 'boss:damaged'; bossId; newHp }`), clamp hp ≥ 0. The boss defeat event is already emitted by `tickBoss` when hp ≤ 0 on the next tick. This is a gameplay-critical fix needed for any real boss playtest.

---

## Deferred from: code review of 3-9-epic-3-deferred-hardening (2026-07-07)

**D-3.9-A — apply-delta enemy:stomped uses client-side Date.now() for stompedUntil expiry** [`packages/net-protocol/src/apply-delta.ts`]
`stompedUntil = Date.now() + 3000` is computed at delta arrival on the host client, not derived from a server-provided timestamp. EnemyStompedEvent carries no expiry field. On a stable LAN this causes <100ms variation between clients (acceptable for a visual slow). Acknowledged design choice in dev completion notes ("short enough to expire before next 5s snapshot"). Address if stomp duration ever becomes balance-critical or multi-client state drift is observed.

**D-3.9-B — Boss body inline creation bypasses physics filter bit system** [`apps/simulation-server/src/rooms/GameRoom.ts:861`]
The boss body is created inline in GameRoom.ts with no `filterCategoryBits`/`filterMaskBits`, giving it planck defaults (category=0x0001, mask=0xFFFF). After story 3.9's player mask restriction (mask=0x002C), player-boss planck contacts no longer fire — but no contact listener uses them (boss detection is hit-scan). Boss body generates spurious contacts with POI/essence/bond sensors but all extractors guard on userData.type and return null. Pre-existing inline pattern; Task 1's allowed paths excluded GameRoom.ts. Fix if boss needs collision-based detection or wall-bounce physics later.

---

## Deferred from: code review of 4-9-epic-4-deferred-hardening (2026-07-07)

**D-4.9-A — AC2's fix is a no-op; the real `loadLevel(5+)` reachability risk is now live** [`apps/simulation-server/src/rooms/GameRoom.ts:749, 1132, 1605-1607, 1640`]
`enterBondMoment`'s guard was already `>= 4` before story 4.9 (confirmed via `git show HEAD`); the diff only renamed the literal to `BOSS_LEVEL_INDEX`, it did not fix an `===`/`>=` asymmetry. Deferred-work's own D-4.3-B called `loadLevel(5+)` "currently unreachable: level 4 has no enemies so level-clear never fires there" — that premise is now false. Epic 6 added boss "adds" pushed into `gameState.enemies` at the Phase1→Phase2 HP threshold (`packages/game-rules/src/entities/grassland-boss.ts:170-173`). Nothing removes dead adds from that array outside `spawnWave` (only used for the survive-waves objective, never for the boss level), so once all currently-spawned adds die while the boss itself survives — a normal event in any Hard-tier fight — `tick()`'s generic "Level clear" check (`GameRoom.ts:1605-1607`, gated only on `phase === 'dungeon'`, no boss-level exclusion) sees `allEnemiesDead === true` and fires `enterBondMoment(4)` → `4 >= BOSS_LEVEL_INDEX` → `loadLevel(5)`, prematurely ending the boss encounter into a level that doesn't exist. Fix: exclude `BOSS_LEVEL_INDEX` from the generic level-clear check (boss-level completion should be driven solely by the `boss:defeated` event from `tickBoss`), or clear dead adds from `gameState.enemies` outside of `spawnWave` too.

**D-4.9-B — Inconsistent try/catch hardening around `loadLevel`** [`apps/simulation-server/src/rooms/GameRoom.ts:278, 551`]
Story 4.9 wrapped the two `enterBondMoment(levelIndex)` call sites inside `tick()` in try/catch, but `loadLevel` is also called unwrapped from the `CONTINUE` message handler (line 278) and the initial dungeon-start path (line 551). Same underlying risk (an exception mid-`loadLevel` leaving room state inconsistent), not addressed at these two sites. Explicitly out of AC3's literal scope ("the wave-complete/level-clear tick block").

**D-4.9-C — Required manual verification and Simulation-safety hook checklist undocumented**
The story's "Required tests" section calls for manually verifying that a second run in the same room produces a different floor layout; the Dev Agent Record doesn't document this was performed — only "Typecheck: 0 errors, test suite: 347 pass" is reported. CLAUDE.md's Simulation-safety hook (deterministic tick test, replay test, perf sanity check) is likewise not individually confirmed. Not blocking; close the loop before future stories rely on this one being fully verified.

---

## Deferred from: code review of 5-8-epic-5-post-57-deferred-hardening (2026-07-07)

**D-5.8-A — `allBondsAtBossStart`'s player-count-aware formula reads a live, mutable roster instead of the roster that was actually present when bonds were assigned** [`apps/simulation-server/src/rooms/GameRoom.ts`, `loadLevel`'s boss branch (`maxAchievableBonds`), `onJoin` (no phase guard), `onLeave` (`CONSENTED` removes the slot immediately)]
Story 5.8's Task 3 fix computes `maxAchievableBonds` from `this.gameState.players.length` read live at boss-start time. `onJoin` has no phase guard (a client can join mid-dungeon) and `onLeave(CloseCode.CONSENTED)` removes the player slot immediately regardless of phase — so if the roster size changes between when bonds were being assigned (levels 1-3) and boss-level start, `maxAchievableBonds` is computed against a roster that doesn't match the one `activeBonds` was actually built against. E.g., a 2-player session's 1 bond is assigned, then a 3rd player joins before boss start: `maxAchievableBonds` becomes `min(3, 3)=3` but only 1 bond exists, so `allBondsAtBossStart` stays `false` even though the 2 original players did everything the achievable-bonds design intended for their session size. Explicitly out of Task 3's scope per its own Non-goals ("do not add new session-size validation... a 2-vs-3+-player branch is sufficient... the only player count that currently breaks the literal-3 assumption"), and the achievement is cosmetic (no gameplay-blocking impact). Fix if this is ever observed in practice: snapshot the player count at first-bond-assignment time (or derive `maxAchievableBonds` from the distinct player IDs that have actually appeared in `activeBonds` plus current unbonded-but-present players) rather than reading `this.gameState.players.length` live at boss-start.
Resolution: Story 5.9 added a new private `bondEligiblePlayerCount` field (`-1` sentinel, same pattern as `bondMomentNextLevel`), snapshotted once in `enterBondMoment` on the first bond-assignment attempt of a run, reset in `startDungeon`. `loadLevel`'s boss branch now sources `playerCount` from this snapshot (falling back to the live roster only if no snapshot was ever captured). `onJoin`/`onLeave` were left untouched, matching the entry's own recommended fix.

---

## Deferred from: code review of 5-7-epic-5-deferred-hardening (2026-07-07)

**D-5.7-A — Bond sensor fixture leaks when a duplicate-pair `assignBond` call returns a flipped player order** [`apps/simulation-server/src/rooms/GameRoom.ts:764-797`]
`enterBondMoment` computes `key = bondKey(playerA, playerB)` from `assignBond`'s returned pair order, then looks up `this.bondSensorFixtures.get(key)` to destroy the previous fixture before creating a new one. `selectBondPair` (unchanged by 5.7) has no ordering guarantee across calls for the same 2 players — with both already bonded, `poolA = players`, and `idxA = floor(rng() * 2)` is an independent ~50/50 draw each time. When a repeat call for the same pair returns the pair in flipped order, the lookup key differs from the one used originally, so the old fixture is never destroyed (leaked, attached to the original body forever) and a second, functionally-inert fixture is created under the new key — `getProximityBuffedPlayers`/`getProximityDrainTargets` key off `state.activeBonds`' stored (unchanged) order, so gameplay is unaffected, but the fixture accumulates unbounded over a long session. This bug pre-dates story 5.7 (it exists independent of the duplicate-bond-count fix) and is not one of 5.7's five scoped ACs; `enterBondMoment`'s sensor-management code is outside Task 2's specific line (the movement-freeze guard). Fix: derive the sensor lookup/creation key from a canonical (sorted) pair order instead of call-order, or destroy any fixture matching either order before creating a new one.

**D-5.7-B — Freezing `isSpirit` player movement (AC2) contradicts story 3.6's explicit design intent** [`apps/simulation-server/src/rooms/GameRoom.ts:969`]
Story 3.6's user story reads verbatim: "As a downed player in spirit form, I want to keep moving and use my spirit ability to support my teammates, so that entering spirit form feels like a reduced state, not elimination." Story 5.7's AC2 explicitly requires "their physics body does not receive a new linear velocity from joystick input" for `isSpirit` players (to prevent Fate-bond speed buffs and bond-sensor contacts) — implemented exactly as specified. This makes spirit-form players fully immobile, a direct reversal of 3.6's shipped intent. The mobile `ControllerScreen.tsx` joystick is not gated on `isSpirit` and keeps sending joystick input during spirit form, which the server now silently discards; host-side spirit rendering will freeze in place instead of drifting. This was implemented per 5.7's literal, written AC — not a coding oversight — but the AC itself may not have accounted for 3.6's prior intent. **Needs a product/design decision**: either accept immobile spirits as the new intended behavior (bonds override spirit mobility), or narrow the fix to only suppress the Fate-bond speed buff and sensor contacts for spirit players while still allowing joystick-driven movement (e.g. exclude spirits from `fateBuffed`/sensor eligibility without zeroing velocity). Flagging for Product/Game Design rather than resolving unilaterally, since it changes established player-facing behavior.
**Resolution at time of 5.7 review:** No response within the decision window during code review, so shipped as literally specified (immobile spirits) rather than unilaterally narrowing the fix — narrowing would mean unrequested scope expansion into bond/movement interaction code with no interactive way to verify it. This entry stays open as a flag for Product/Game Design to revisit; if they want spirits mobile again, the narrow-fix approach described above is the recommended path.

**D-5.7-C — `AllBondsActive` achievement becomes unreachable in 2-player sessions as a side effect of fixing AC1's duplicate-bond bug** [`packages/game-rules/src/systems/achievements.ts:22-23`, `apps/simulation-server/src/rooms/GameRoom.ts:883`]
`allBondsAtBossStart` is set `true` only when `activeBonds.length === BOSS_LEVEL_INDEX - 1` (3), assuming 3 distinct bonds accumulate across 3 dungeon levels. In a 2-player session there is only ever one possible pair, so `selectBondPair` re-selects it on every subsequent bond-moment. Before 5.7, this duplication bug meant repeated `assignBond` calls kept incorrectly pushing new (duplicate) entries for the same pair, incidentally growing `activeBonds` to length 3 by boss start and satisfying the achievement condition. Story 5.7's AC1 fix (the intended, correct behavior) caps `activeBonds` at length 1 for a 2-player run, so `allBondsAtBossStart` can never become `true` and `AllBondsActive` is now permanently unreachable for 2-player sessions. `achievements.ts` is an explicitly Blocked path for story 5.7 (`packages/game-rules/src/**` except `bonds.ts`), so this is out of scope to fix here. Needs a follow-up story to make the achievement condition player-count-aware (e.g. compare against the number of *unique* pairs possible/achieved rather than a fixed literal `3`).

---

## Deferred from: code review of 4-10-epic-4-post-49-deferred-hardening (2026-07-07)

**D-4.10-A — `CONTINUE` handler leaves the client permanently stuck on a failed `loadLevel`** [`apps/simulation-server/src/rooms/GameRoom.ts:276-286`]
`this.bondMomentNextLevel = -1` is committed before the new try/catch. If `loadLevel(nextLevel)` throws, no snapshot broadcasts, no failure delta is sent, and a repeated `CONTINUE` message immediately early-returns (`bondMomentNextLevel === -1`) with no retry path — the client is left on the bond-moment screen indefinitely. This is the explicit, accepted trade-off of 4.10's Non-goals ("do not implement transactional rollback... match `tryEnterBondMoment`'s existing precedent exactly: log the error and stop, no deeper state-recovery logic") — strictly safer than the pre-4.10 behavior (an uncaught throw here would previously propagate out of the Colyseus message handler). Fix if load failures are ever observed in practice: broadcast an explicit `level:load-failed`-style delta so clients get feedback, and/or restore `bondMomentNextLevel` to allow retry.

**D-4.10-B — `startDungeon` leaves `session.phase` stuck at `'dungeon'` with `runProposal` already nulled on `loadLevel(1)` failure** [`apps/simulation-server/src/rooms/GameRoom.ts:562-580`]
`session.phase = 'dungeon'`, `difficulty`, and `runProposal = null` are committed before the new try/catch around `loadLevel(1)`. On failure, phase stays `'dungeon'` server-side but is never broadcast (clients still show lobby/hub UI), and `resolveVoteIfComplete`'s `runProposal === null` guard blocks any future vote-driven retry — the room is stuck. Explicitly acknowledged and accepted in this story's own Dev Notes ("Per Non-goals, do not add phase-reversion or other recovery — this matches `tryEnterBondMoment`'s existing precedent exactly"). Fix if dungeon-start failures are ever observed: revert `session.phase`/`runProposal` on catch, or broadcast a `run:failed`-style delta.

**D-4.10-C — `generateFloorLayout`/`createRng` calls in `startDungeon` sit outside the new try/catch; a throw there surfaces as a misleading VOTE-parse-failure log** [`apps/simulation-server/src/rooms/GameRoom.ts:567-569`]
Only `loadLevel(1)` is wrapped per AC2's literal scope. If `generateFloorLayout` or `createRng` throw first (e.g. an empty room pool), the exception propagates up through `resolveVoteIfComplete` to the `VOTE` message handler's outer `catch` (line 217-219), which logs `'failed to parse VOTE — discarded'` — an accurate catch-all but a misleading diagnostic for what is actually a level-generation failure. Pre-existing gap, not introduced by 4.10 (these lines were never wrapped before or after this story). Fix by widening the try to cover the RNG/floor-layout construction too, if this path is ever suspected of throwing in practice.

**D-4.10-D — `loadLevel`'s boss branch sets `session.levelIndex = BOSS_LEVEL_INDEX` before boss body/state creation; combined with AC1's new guard, a mid-setup throw is unrecoverable** [`apps/simulation-server/src/rooms/GameRoom.ts:902` vs `910-927`]
`loadLevel` sets `this.gameState.session.levelIndex = index` (line 902) before creating the boss arena walls, physics body, and `gameState.boss` (lines 910-927, only reached if nothing above throws). If `loadBossArena`/`createBody`/`createFixture`/`createBossState` throws, `levelIndex` is already `BOSS_LEVEL_INDEX` but `gameState.boss` stays `null` forever. `tickBoss` requires `gameState.boss !== null` to run (line 1185), and — as of 4.10's AC1 — the generic level-clear check now permanently excludes `levelIndex === BOSS_LEVEL_INDEX`, so neither completion path can ever fire: a true deadlock. This is a pre-existing latent ordering issue in `loadLevel` (not modified by 4.10, and out of 4.10's explicit Non-goals scope — no `loadLevel` internals were touched). Note it does not regress this diff's behavior: pre-4.10, the same failure left `gameState.enemies` permanently empty (adds only spawn via `tickBoss`'s Phase3 handling, which requires a non-null boss), so `allEnemiesDead` was already always `false` in that state and the old generic check could never have fired either — the room was already unrecoverable in this scenario before 4.10. Fix: in `loadLevel`'s boss branch, assign `session.levelIndex` only after boss body/state creation succeeds (or wrap the whole boss-setup block so a failure reverts `levelIndex`).

**D-4.10-E — No test coverage for the two new try/catch paths (`CONTINUE`, `startDungeon`)** [`apps/simulation-server/src/rooms/GameRoom.ts:276-286, 562-580`]
The new unit test (`game-room-level-clear-guard.test.ts`) covers only AC1's boss-level guard boolean, per AC4's literal scope ("New unit test... mirroring the level-clear guard logic"). AC2's try/catch additions ship with no runnable check — nothing verifies `logger.error` is called or that broadcast is skipped on failure. Explicitly out of this story's Required Tests scope ("No changes expected to existing e2e/unit/contract tests"). Fix with a small mock-based test (stub `loadLevel` to throw, assert `logger.error` called and no broadcast) if these paths become a concern.

---

## Deferred from: code review of 4-11-epic-4-post-410-deferred-hardening (2026-07-07)

**D-4.11-A — `loadLevel`'s level-2 (survive-waves) and default (clear) branches commit `levelIndex`/`levelObjective`/wave-count fields before their own risky calls** [`apps/simulation-server/src/rooms/GameRoom.ts`, `loadLevel`'s level-2 and default branches] — RESOLVED by 4-14-epic-4-post-413-deferred-hardening (2026-07-20)
4.11's AC4 fix deferred `session.levelIndex`'s commit in the boss branch until after boss arena/body/state construction succeeds, closing D-4.10-D. The level-2 branch still assigns `levelIndex`/`levelObjective`/`totalWaves`/`waveIndex`/`session.totalWaves` immediately, then calls `this.spawnWave(1, 'mid', index)` (which creates physics bodies and can throw); the default branch has the same pattern before `this.spawnEnemies(tier, index)`. Same class of ordering risk D-4.10-D named for the boss branch, left unhardened here. Explicitly out of 4.11's scope: AC4 states "only the boss branch has this ordering risk, per D-4.10-D," and 4.11's Non-goals state "do not go looking for other partial-mutation risks in `loadLevel` beyond that one." Fix if `spawnWave`/`spawnEnemies` failures are ever observed in practice: apply the same defer-the-commit pattern to these two branches.
Resolution: `this.gameState.session.levelIndex = index` moved to the last statement in both the level-2 and default branches, mirroring 4.11's boss-branch fix exactly — `levelObjective`/wave-count fields stay in their original position (cheap, non-externally-visible bookkeeping, not gated by any guard). Covered by new unit tests in `apps/simulation-server/tests/game-room-post-413-deferred-hardening.test.ts`.

**D-4.11-B — `resetToHub()` never destroys `this.bossBody`/`this.arenaWallBodies`** [`apps/simulation-server/src/rooms/GameRoom.ts`, `resetToHub`] — RESOLVED by 4-14-epic-4-post-413-deferred-hardening (2026-07-20)
Only `loadLevel` (on the next level load) and the boss-defeat handler destroy these physics bodies — `resetToHub()` does not. A boss-branch construction failure would leave any partially-created bodies alive until the next `loadLevel` call runs (not cleaned up by an intervening `resetToHub()`). Pre-existing gap, unrelated to 4.11's diff, and arguably less reachable post-4.11 than pre-4.11 (pre-fix, a failed boss build permanently deadlocked the room in `'dungeon'` phase before `resetToHub` could ever be reached in that state). Fix if this path is ever suspected of leaking bodies in practice: have `resetToHub()` also destroy `bossBody`/`arenaWallBodies` if set.
Resolution: `resetToHub()` now destroys `this.bossBody` (if non-null, via `this.physicsWorld.destroyBody`, then sets it to `null`) and every body in `this.arenaWallBodies` (then clears the array), mirroring `loadLevel`'s existing equivalent cleanup block. Covered by new unit tests in `apps/simulation-server/tests/game-room-post-413-deferred-hardening.test.ts`.

---

## Deferred from: code review of 3-12-status-effect-engine-buffs-debuffs-with-duration (2026-07-13)

**D-3.12-A — Status badge visual can overlap/extend off-canvas with many simultaneous effects** [`apps/host-client/src/screens/DungeonScreen.tsx`, badge rendering block]
`offsetX = (i - (n-1)/2) * 14` spaces badges evenly with no width cap. With today's 4 possible `StatusEffectType` values and replace-not-stack semantics (max one effect per type per entity), an entity can show at most 4 badges spanning ~42px — not a real overlap today, but nothing bounds this if a future story adds more effect types. Deliberately minimal per this story's Non-goals ("one generic badge/aura... no per-ability art"). Revisit with a max-badge-count cap or compact layout if `StatusEffectType` grows beyond 4-5 values.

**D-3.12-B — `tickStatusEffects` expiry-broadcast diff relies on effect-object reference equality, undocumented fragility for future changes** [`apps/simulation-server/src/rooms/GameRoom.ts`, tick loop's "Tick status effects" block]
The loop detects which effects expired via `ticked.statusEffects.includes(effect)` (identity comparison against the pre-tick array). This is correct today because `tickStatusEffects` only filters (never clones/mutates individual effect objects) and `applyStatusEffect` replaces-by-reference rather than mutating in place. If a future change makes either function transform individual effect objects in place (e.g., decaying `magnitude` over time), `includes` would break silently and misreport every effect as expired every tick. No test guards this invariant. Revisit when/if per-tick magnitude decay or in-place effect mutation is introduced (e.g., a "stacks that decay" mechanic).

---

## Deferred from: code review of 3-13-projectile-physics-and-zone-field-entities (2026-07-13)

**D-3.13-A — Projectile sensor radius (12px) vs. host-rendered dot radius (8px) mismatch** [`apps/simulation-server/src/physics/world.ts` `createProjectileBody`; `apps/host-client/src/screens/DungeonScreen.tsx` projectile render block]
Neither value was specified by the story (only fixture *behavior* was) — both are free-choice tuning knobs. A mismatch means enemies can take damage slightly before the drawn dot visually reaches them. Cosmetic only; no AC governs exact radii. Revisit when Story 3.19/3.20 give a concrete ability its own visual identity for its projectile.

**D-3.13-B — Projectiles pass through level geometry (walls)** [`apps/simulation-server/src/physics/world.ts` `createProjectileBody`, `filterMaskBits: CAT_ENEMY`]
The projectile fixture is a sensor with no wall/obstacle category in its mask (sensors never produce collision response regardless of mask anyway). The only stopping mechanism is `isProjectileExpired`'s max-range check. No AC requires wall collision, and player/enemy bodies aren't wall-blocked either in the current codebase — consistent with existing scope, not a regression. Revisit if a future story adds level geometry that should block projectiles.

**D-3.13-C — Zone overlap tracking loses target type (enemy vs. player) at the point of capture** [`apps/simulation-server/src/rooms/GameRoom.ts`, `zoneOverlapping: Map<string, Set<string>>`]
`pendingZoneContactBegin`/`End` destructure only `targetId` (dropping `targetType`) into one untyped `Set<string>` shared by both enemy and player ids. Harmless today because the only implemented `effectType` is `'damage'`, which only looks targets up in `gameState.enemies` (silently ignoring any player id that lands in the same set). Story 3.14's `'pull'` effect on players will need a typed key (or a second map) to tell the two apart. Marked in-code with a `ponytail:` comment at the field declaration naming this ceiling.

**D-3.13-D — No validation guards a non-positive `tickIntervalMs` in `ABILITY_CHAINED_ZONE`** [`packages/game-rules/src/balance.ts`, `ABILITY_CHAINED_ZONE`] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
`shouldZoneTick` would fire every tick if `tickIntervalMs` were ever `0` or negative. Unreachable today since every `ABILITY_CHAINED_ZONE` entry is `null` (this story's own AC4 scope: "can leave the config table empty/unused until 3.19 populates it"). Add a guard (or just author correct values) when Story 3.19 populates a real entry.
Resolution: Story 3.19 populated Void Pulse's `ABILITY_CHAINED_ZONE` entry (`tickIntervalMs: 500`), meeting this entry's stated revisit condition. `shouldZoneTick` (`packages/game-rules/src/systems/zones.ts`) now returns `false` unconditionally when `zone.tickIntervalMs <= 0`, instead of firing every tick. Covered by new unit tests in `packages/game-rules/tests/unit/zones.test.ts` (zero and negative `tickIntervalMs` cases).

**D-3.13-E — `DungeonScreen.tsx`'s new `projectileGraphicsRef`/`zoneGraphicsRef` Maps aren't cleared on component unmount** [`apps/host-client/src/screens/DungeonScreen.tsx`]
Pre-existing pattern shared by every other per-entity Graphics ref in this file (`playerGraphicsRef`, `enemyGraphicsRef`, `essenceFlashesRef`, etc. — none of them clear on unmount either); the two new refs added by this story just follow the same established convention. Not a regression introduced by this story. Revisit if React StrictMode double-invoke or route-based remounting of `DungeonScreen` is ever observed to cause stale-Graphics errors in practice — likely a single shared fix across all these refs at once, not per-ref.

**D-3.13-F — Essence-drop id naming is inconsistent between the projectile-hit path and the zone-tick-kill path** [`packages/game-rules/src/systems/projectiles.ts` `resolveProjectileHit`, `apps/simulation-server/src/rooms/GameRoom.ts` zone-tick kill branch]
`resolveProjectileHit` builds its drop id as `` `drop-${projectile.id}` ``; the zone-tick-kill branch (and the pre-existing ability hit-scan flow) both use `` `drop-${this.tickCount}-${enemyId}` ``. Both schemes produce unique ids in their own context (no bug), just two different naming conventions for the same concept. Cosmetic; unify if a shared drop-id helper is ever introduced.

---

## Deferred from: code review of 3-14-displacement-pull-physics-primitive (2026-07-13)

**D-3.14-A — Neither displacement helper checks target liveness/downed/spirit-form state** [`apps/simulation-server/src/rooms/GameRoom.ts` `applyDisplacementToEnemy`/`applyDisplacementToPlayer`] — RESOLVED by 3-19-souldrinker-kit-rework (2026-07-14)
Both helpers had no caller yet — Stone Wall's dispatch (3.16) and Void Pulse's zone-tick wiring (3.19) are the intended callers. Whether a downed/spirit-form player, or a dead enemy, should be immune to a pull/vacuum effect is a game-design decision, not something this pure mechanism story could resolve. Story 3.16's Stone Wall call site now gates on `!dmgResult.value.killed`, so a dead enemy never reaches `applyDisplacementToEnemy` — enemies have no downed/spirit-form state, so the rest of the original concern doesn't apply to them. **The player side is now resolved too**: Story 3.19's Void Pulse zone-tick `'pull'` case excludes `isDown`/`isSpirit`/`isFrozen` players from `applyDisplacementToPlayer`, mirroring `gatherPlayersInHitZone`'s exact same three-flag exclusion — a downed/spirit ally lying in a Void Pulse zone is no longer draggable.

**D-3.14-B — No accumulation for concurrent pull sources targeting the same entity in one tick** [`apps/simulation-server/src/rooms/GameRoom.ts` `applyDisplacementToEnemy`/`applyDisplacementToPlayer`] — DISMISSED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15): false premise
Each call directly mutates `x`/`y` — if two pull sources (e.g. two simultaneous Stone Wall casts, or a Stone Wall cast inside a Void Pulse zone) both target the same entity in the same tick, the second call's displacement simply overwrites the position the first call set, silently dropping the first pull's effect rather than summing the two displacement vectors. Story 3.19 wires Void Pulse's zone-tick pull (the second real caller, alongside Stone Wall's 3.16 hit-scan pull) but does not vector-sum concurrent sources — still open. Revisit if simultaneous multi-source pulls (e.g. a Stone Wall cast landing on an enemy already inside a Void Pulse zone, same tick) turn out to matter in practice.
Dismissal: re-read `applyDisplacementToEnemy`/`applyDisplacementToPlayer` (`apps/simulation-server/src/rooms/GameRoom.ts` ~line 1171-1210) — both do `enemy.x += dx` / `player.x += dx` (in-place addition onto the *current* position), not an overwrite/assignment. Two pull sources landing on the same entity in the same tick are necessarily processed sequentially (JS is single-threaded, nothing in the tick loop batches these calls), so the second call's `+=` naturally sums onto whatever the first call already wrote. This entry's premise ("the second call simply overwrites... rather than summing the two displacement vectors") does not match the current code. No fix needed.

---

## Deferred from: code review of 3-15-self-cost-resource-and-mixed-faction-target-resolution (2026-07-13)

**D-3.15-A — `healPlayer` doesn't guard or reset `isDown`/`isSpirit` state** [`packages/game-rules/src/systems/player-health.ts`, `healPlayer`] — RESOLVED by 3-17-spiritcaller-kit-rework (2026-07-14)
`healPlayer` only touches `hp`/`maxHp`, matching the story's explicit prescribed implementation verbatim (AC2 doesn't mention downed-state interaction). Healing a downed player (`isDown: true`) would produce `hp > 0` with `isDown` still `true` — an internally inconsistent `PlayerState` — but no caller exists yet (Story 3.17's Ancestor's Voice/Spirit Nova ally heal, Story 3.19's Blood Spike lifesteal). Whether downed/spirit players should be heal-immune (or whether the call site should simply exclude them from the target list before calling `healPlayer`) is a game-design decision for whichever story wires the first actual heal call. **Resolved at the call site, per the second option this entry named**: Story 3.17's new `GameRoom.ts#gatherPlayersInHitZone` (used by both Ancestor's Voice and Spirit Nova's ally gather) excludes `isDown`/`isSpirit`/`isFrozen` players before any candidate ever reaches `resolveMixedFactionTargets` or `healPlayer` — `healPlayer` itself is unchanged. **Story 3.19 closes the remaining caster-only case**: Blood Spike's lifesteal call site (`GameRoom.ts`'s projectile-hit resolution) now skips the `healPlayer` call if the caster went down or entered spirit form during the projectile's flight time, same two-flag check as the ally-heal case above.

**D-3.15-B — `resolveMixedFactionTargets` doesn't filter dead enemies or downed/spirit allies out of the split** [`packages/game-rules/src/systems/targeting.ts`, `resolveMixedFactionTargets`] — RESOLVED by 3-17-spiritcaller-kit-rework (2026-07-14)
The function only distinguishes ally vs. enemy by structural type (`'class' in t`) and excludes the caster — it does not filter `EnemyState.isAlive === false` or ally `isDown`/`isSpirit` flags. This matches the story's explicit Non-goals ("this story does not add that gathering loop itself... only the pure splitting function") — filtering is presumed to happen either in the future gathering-loop caller (Story 3.17) or as an additional check inside this function once a real caller exists. **Resolved at the call site**: Story 3.17's Ancestor's Voice/Spirit Nova gather only ever passes `enemy.isAlive`-filtered enemies (mirroring the pre-existing enemy hit-scan loop's own guard) and `gatherPlayersInHitZone`'s already-`isDown`/`isSpirit`/`isFrozen`-filtered allies into `resolveMixedFactionTargets` — `resolveMixedFactionTargets` itself is unchanged, still a pure structural split with no liveness awareness. Revisit only if a future caller can't guarantee pre-filtering the way 3.17's does.

---

## Deferred from: code review of 3-16-stonehide-kit-rework (2026-07-13)

**D-3.16-A — `GameRoom.ts`'s ability-dispatch/hit-scan block has no direct integration test coverage** [`apps/simulation-server/src/rooms/GameRoom.ts`] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
`tests/unit/abilities.test.ts` exercises the `game-rules` primitives (`applyStatusEffect`, `applyDamage`, `applyDisplacement`) that `GameRoom.ts` calls, but nothing spins up an actual Colyseus room to exercise the wiring itself (caster-index lookup, the `!dmgResult.value.killed` gate, array-element replacement). Not unique to this story — every kit-rework story in this batch (3.12-3.15) follows the same pattern, and this story's own Allowed-paths/AC5 scoped tests to `tests/unit/abilities.test.ts` only. Revisit as a dedicated GameRoom-integration-test story (spin up a room, dispatch real ability inputs, assert on broadcast deltas) once enough kit-rework stories have landed to justify the harness investment, rather than growing it piecemeal per-story.
Resolution: `tests/e2e/ability-dispatch.test.ts` now spins up a real `GameRoom` via `startTestServer()` and fires an actual `EventNames.INPUT` ability event (Spiritcaller's Ancestor's Voice), asserting on the resulting `enemy:damaged`/`player:hp-updated` broadcast deltas — proving the real dispatch wiring end-to-end, not a reimplementation. Closes the systemic "no GameRoom-integration-test harness exists" gap this entry (and D-3.17-B/D-3.17-C/D-3.20-A) all independently flagged; see those entries for the same resolution.

---

## Deferred from: code review of 3-17-spiritcaller-kit-rework-ancestors-voice-spirit-nova-warding-cry (2026-07-14)

**D-3.17-A — Warding Cry's `'shield'` status effect applies but has no damage-absorption consumption wired** [`packages/game-rules/src/systems/player-health.ts`, `applyPlayerDamage`] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
Story 3.12 defined the `'shield'` `StatusEffectType` as "flat HP for shield" (as opposed to the other three effect types' 0-1 fraction), and `applyStatusEffect` already exempts it from the 0-1 magnitude validation — but nothing in the codebase has ever consumed it: `applyPlayerDamage` (`player-health.ts`) only reads `getStatusEffectMagnitude(player, 'damageReduction', nowMs)`, wired by Story 3.12; it has no equivalent shield-absorption branch. This story's own Dev Notes section explicitly flagged this ambiguity ("epics.md doesn't fully specify the interaction between a `'shield'` effect and `player-health.ts`'s `applyPlayerDamage`... If `'shield'` absorption requires a `player-health.ts` change beyond what 3.12 already wired, that's this story's job to add") — but `player-health.ts` is **not** in this story's Allowed paths, and Task 4's own instructions stop at applying/broadcasting the status effect, not consuming it. Resolved conservatively: the status effect applies and is visible (`status:applied` broadcast, satisfies AC3's literal wording), but a shielded player currently takes full damage — the shield is cosmetic until a follow-up wires the absorption. Whether absorption should be "subtract from incoming damage before HP, decrement the shield's remaining magnitude" or "block the next N total damage then expire" (both floated as options in this story's Dev Notes, neither picked) is a game-design decision. Revisit in a dedicated follow-up or whichever future story next touches `player-health.ts`/`applyPlayerDamage`. **Independently confirmed by this story's code review** (Acceptance Auditor + Blind Hunter both flagged it) and escalated to a `[Review][Decision]` item in the story file's Review Findings. **User decision (2026-07-14): defer to a follow-up** — outside this story's Allowed paths and the absorption model isn't picked yet; resolve both together whenever a follow-up next touches `player-health.ts`.
Resolution: `applyPlayerDamage` now applies `damageReduction` first (unchanged), then absorbs the remainder with any active `'shield'` magnitude (`min(shieldMagnitude, mitigatedDamage)`) before HP loss; the depleted shield magnitude is written back onto the returned `updatedPlayer.statusEffects`, per the Result<T,E> rule (no mutation of the input `player`). Picks the "subtract from incoming damage before HP, decrement the shield's remaining magnitude" model this entry's Dev Notes floated. Covered by new unit tests in `packages/game-rules/tests/unit/player-health.test.ts` (full absorption, partial absorption + overflow, depleted shield, damageReduction-then-shield stacking order per AC3).

**D-3.17-B — Zero test coverage of the `GameRoom.ts` wiring this story adds** [`apps/simulation-server/src/rooms/GameRoom.ts`] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
`gatherPlayersInHitZone`, the Ancestor's Voice mixed-faction branch, and the Spirit Nova push/sweep are all exercised only indirectly, via unit tests against the underlying pure `game-rules` helpers (`resolveMixedFactionTargets`, `applyDamage`, `healPlayer`, `applyStatusEffect`) — nothing spins up an actual `GameRoom`/Colyseus room to exercise the wiring itself. Not unique to this story — every kit-rework story in this batch (3.12-3.16) has the same gap, already tracked as D-3.16-A. Revisit together with D-3.16-A as a single dedicated GameRoom-integration-test story.
Resolution: see D-3.16-A — `tests/e2e/ability-dispatch.test.ts` exercises `gatherPlayersInHitZone` and the Ancestor's Voice mixed-faction branch through a live `GameRoom`, closing this gap for that wiring path. Spirit Nova's push/sweep specifically is not directly exercised by the new e2e test (the story scoped to 2 focused scenarios, not a combinatorial suite per its Non-goals) — the underlying "no harness exists" complaint this entry shares with D-3.16-A/D-3.17-C/D-3.20-A is what's resolved; a future story can extend the now-existing harness to Spirit Nova specifically if that becomes a priority.

**D-3.17-C — The "hit-once-per-target" test validates a hand-rolled reimplementation, not the shipped sweep logic** [`tests/unit/targeting.test.ts`, `resolveExpandingRadius` describe block] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
The test defines its own local `sweepTick` function reimplementing the `hitIds`/radius logic from scratch against synthetic `{id, distance}` targets — it proves the test's own copy of the algorithm is self-consistent, but says nothing about whether `GameRoom.ts`'s actual sweep loop correctly threads `nova.hitIds`, filters `enemiesInRing`/`alliesInRing`, or splices expired entries during reverse iteration. Same root cause as D-3.17-B (no integration-test harness yet) — a bug in the real `hitIds` usage would pass this test while being broken in production.
Resolution: this entry's own text names its root cause as "same as D-3.17-B (no integration-test harness yet)" — that harness now exists (`tests/e2e/ability-dispatch.test.ts`, see D-3.16-A). The specific Spirit Nova `hitIds`/reverse-iteration wiring this entry names is not directly exercised (the new e2e test covers Ancestor's Voice and Storm Eye, not Spirit Nova specifically — 2 focused scenarios per this story's Non-goals, not exhaustive per-ability coverage), but the systemic gap ("nothing proves any GameRoom wiring end-to-end") this entry is scoped under is closed. Revisit with a Spirit-Nova-specific live-room scenario if this class of bug is ever suspected in practice.

**D-3.17-D — `loadLevel()`/`resetToHub()` clear `activeSpiritNovas` mid-sweep with no completion event** [`apps/simulation-server/src/rooms/GameRoom.ts`, `resetToHub`/`loadLevel`]
Both do `this.activeSpiritNovas.length = 0;` unconditionally, with no flush of in-flight entries. If a Spirit Nova's last enemy dies early in its 600ms expansion (radius still small) and the level transitions or the player returns to camp before the ring reaches a further-out ally, that ally silently never receives the pending heal — no broadcast, log, or client-visible signal that the cast was truncated. Minor (short window, rare timing), matches this batch's existing pattern for similar low-impact "revisit if it turns out to matter" deferrals (e.g. D-3.14-B). Revisit by resolving remaining `activeSpiritNovas` targets at max radius before clearing, if this is ever observed to matter in practice.

**D-3.17-E — `resolveExpandingRadius` has an unguarded divide-by-zero on `durationMs=0`** [`packages/game-rules/src/systems/targeting.ts`, `resolveExpandingRadius`]
`elapsedMs / durationMs` propagates `NaN` if `durationMs` is ever `0` (`Math.max(0, NaN)` is `NaN`, not clamped). Unreachable today — `SPIRIT_NOVA_DURATION_MS` is a hardcoded nonzero constant, the function's only caller — but it's exported as a general-purpose pure helper from `index.ts` with no input validation. Matches this codebase's existing precedent for similar not-yet-reachable gaps (D-3.13-D's unguarded `tickIntervalMs`). Revisit if a future ability reuses this helper with a configurable duration.

---

## Deferred from: code review of 3-18-soul-mend-ranged-spirit-targeting-revive (2026-07-14)

**D-3.18-A — No mutual exclusion when two casters target the same downed ally with Soul Mend** [`packages/game-rules/src/systems/soul-mend.ts`, `findSoulMendTarget`; `apps/simulation-server/src/rooms/GameRoom.ts`, `handleSoulMendFireAttempt`]
`findSoulMendTarget` and the channel-start handler never check whether another caster's `channelingAbility.targetPlayerId` already equals the candidate target, so two Spiritcallers can simultaneously lock onto and start channeling the same downed ally. This self-corrects at completion time — the per-tick progression loop re-fetches the target and re-checks `isDown` per caster, so whichever caster's completion check runs first in that tick's `for (const caster of this.gameState.players)` iteration flips `isDown: false`, and the other caster's `shouldCancelSoulMendChannel` call (evaluated later in the same loop) correctly cancels rather than double-reviving. No invalid state or double-revive is possible. The gap is a UX/fairness one: the "winner" is whichever caster happens to sit earlier in `gameState.players` (join order) when both channels reach completion in the same tick, not whichever caster actually started channeling first — a caster who has been visibly "winning" the cast on their own screen can lose the revive to someone who started later, purely due to join order, and receives an unexplained `cast:cancelled` with no distinguishing reason code. Deferred per user decision (2026-07-14) — not required by any of Story 3.18's ACs, and the correct policy (first-to-start wins vs. any other tie-break) is a game-design decision, not an unambiguous bug fix. Revisit if playtesting surfaces this as a real point of confusion; the fix would be to compare `channelingAbility.startedAt` across all casters targeting the same player at completion time and only let the earliest-started one complete, cancelling the rest immediately rather than waiting for their own next liveness/range check.

---

## Deferred from: code review of 3-20-stormcaller-storm-eye-rework (2026-07-14)

**D-3.20-A — AC4's "steady-tick damage" isn't integration-tested at the GameRoom level** [`apps/simulation-server/src/rooms/GameRoom.ts`, zone-tick loop `'damage'` effectType case] — RESOLVED by 3-22-epic-3-post-321-deferred-hardening (2026-07-15)
Story 3.20's `tests/unit/storm-eye.test.ts` only exercises the pure `shouldZoneTick`/`isZoneExpired` timing primitives against Storm Eye's specific constants (a regression confirmation, since the steady tick reuses Story 3.13's `'damage'` zone-tick case verbatim) and the new `pickRandomIndex` helper — nothing spins up a live `GameRoom` to confirm the actual `applyDamage` call + `enemy:damaged`/`enemy:killed` broadcast wiring for zone-tick damage. Not unique to this story: every prior zone-tick ability (3.13's Void Pulse pull zone, and now Storm Eye's damage zone) has the same gap — GameRoom-level zone-tick damage application has never had a dedicated integration test in this codebase, only the pure cadence/expiry functions are unit-tested. Matches the same class of gap as D-3.16-A/D-3.17-B (GameRoom-integration-test coverage generally). Revisit together with those as part of a single dedicated GameRoom-integration-test story.
Resolution: `tests/e2e/ability-dispatch.test.ts` places a live Storm Eye zone via a real `GameRoom` and asserts the enemy actually takes damage on the zone's tick cadence through the live tick loop's zone-tick `'damage'` branch (`enemy:damaged` delta), not just the pure timing helpers — proving the real `applyDamage` call + broadcast wiring end-to-end.

---

## Deferred from: code review of 3-21a-body-spirit-position-schema-and-protocol-contract (2026-07-14)

**D-3.21a-A — No guard against a stale/duplicate `player:downed` delta overwriting an already-set `bodyX`/`bodyY`** [`packages/net-protocol/src/apply-delta.ts`, `'player:downed'` case]
The `apply-delta.ts` reducer applies `bodyX: evt.bodyX ?? p.x, bodyY: evt.bodyY ?? p.y` unconditionally whenever a `player:downed` delta arrives, with no check for whether the player is already `isDown`. Confirmed not currently reachable: the only sim-server emit site (`apps/simulation-server/src/rooms/GameRoom.ts` ~line 1743, and the other 3 down-transition sites) only fires `player:downed` once per down-transition — damage/down logic is skipped entirely for a player already `isDown`. Out of scope for 3.21a regardless (a schema-only story, `apps/simulation-server` is a blocked path). Revisit if a future story introduces delta retry/at-least-once delivery semantics that could cause a duplicate `player:downed` to reach an already-down player.

**D-3.21a-B — Version-skew window between sim-server and host-client isn't mitigated with a capability flag** [`packages/net-protocol/src/apply-delta.ts`, `packages/shared-types/src/player.ts`]
`bodyX`/`bodyY` are optional specifically to tolerate a sim-server that hasn't yet been upgraded to populate them (pre-3.21b), with `apply-delta.ts` falling back to the player's current `x`/`y`. This is disclosed in `ADR-0002-body-spirit-position-split.md`'s Consequences section but not mitigated with any protocol version tag or capability negotiation. Deferred: this project's current deployment model is a single local host+sim process pair (Local Party Mode) with no independent rolling upgrades between them, so in practice the skew window is bounded to "one developer's local session between merging 3.21a and 3.21b," not a production concern. Revisit if Phase 5's cloud/online mode introduces independently deployable host/sim versions where real version skew becomes possible.

---

## Deferred from: code review of 3-21b-body-spirit-movement-and-revive-targeting-logic (2026-07-14)

**D-3.21b-A — `?? player.x`/`?? target.x` fallbacks silently mask a future omission of `bodyX`/`bodyY`, rather than failing loudly** [`apps/simulation-server/src/rooms/GameRoom.ts` proximity-revive block; `packages/game-rules/src/systems/soul-mend.ts`, `reviveBySoulMend`]
Both revive paths fall back to the player's current `x`/`y` if `bodyX`/`bodyY` are absent. Today this never fires — all 4 down-transition paths (`applyPlayerDamage`'s 3 callers plus the boss-stomp inline path) set `bodyX`/`bodyY` unconditionally on down, and this is now covered by `apps/simulation-server/tests/game-room-revive-proximity.test.ts` and `tests/unit/player-health.test.ts`. But if a future change adds a 5th down-transition path, or a refactor of one of the existing 4 accidentally drops the `bodyX`/`bodyY` assignment, the fallback would silently resolve to the spirit's current (possibly-wandered) position instead of erroring — reintroducing the exact bug Story 3.21 was written to fix, with no log or assertion to flag it. Same class of accepted tradeoff as `D-3.21a-A`/`D-3.21a-B` (defensive fallback for graceful degradation, not a loud failure). Revisit if a new down-transition path is ever added — consider an assertion or dev-only warning log if `bodyX`/`bodyY` are unexpectedly absent on an `isDown`/`isSpirit` player at revive time.

---

## Deferred from: code review of 3-22-epic-3-post-321-deferred-hardening (2026-07-15)

**D-3.22-A — E2E tests have no try/finally cleanup around assertions** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`tests/e2e/ability-dispatch.test.ts`]
A failed assertion or a `waitForDelta` timeout thrown before the final `host.leave()`/`*.leave()` calls at the end of each `it()` block leaves the room and its message subscriptions alive into subsequent tests (same server instance, `beforeAll`/`afterAll` are suite-scoped). Not unique to this story — `tests/e2e/full-run.test.ts` and `tests/e2e/reconnect.test.ts` have the exact same cleanup-only-at-the-happy-path-end structure; this story's new file just follows the established pattern. Revisit if this class of bug (test pollution cascading into a later test in the same file) is ever actually observed — likely a single shared fix (a `try/finally` wrapper or a `afterEach` that force-leaves any still-connected rooms) across all three e2e files at once, not per-file.
Resolution: exactly the shared fix this entry named, applied to all 3 files at once. Each file now has a describe-scoped `liveRooms: Room[]` array, populated immediately after every `client.create`/`client.joinById`/`client.reconnect` resolves (including inside `ability-dispatch.test.ts`'s shared `setupDungeonRun` helper), with a single `afterEach` that force-leaves everything still tracked via `Promise.allSettled`, capping each `leave()` at 3s (a room whose connection was already manually closed — this project's disconnect-scenario tests — could otherwise leave its `leave()` promise unsettled forever). The now-redundant end-of-test explicit `.leave()` calls were removed.

**D-3.22-B — `raceTimeout`'s losing timer is never cleared** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`]
`Promise.race([p, new Promise((_, reject) => setTimeout(...))])` — when `p` wins the race, the `setTimeout` handle is never cleared and keeps a timer alive for the full `ms` duration (up to 10s in this codebase's usage). This story's `ability-dispatch.test.ts` copies the helper verbatim from `full-run.test.ts`, where it already existed — not a new defect, just an inherited one. Revisit only if accumulated timer handles are ever observed to measurably pad e2e suite teardown time.
Resolution: the already-shared `tests/helpers/race-timeout.ts` (extracted by D-2.8-D) now clears the losing timer via `.finally(() => clearTimeout(handle))` as soon as the wrapped promise settles either way. All 3 e2e files (plus this story's own new `afterEach` room-cleanup calls) route through this one fixed implementation — no separate per-file fix needed since the duplication D-2.8-D already closed left only one copy to patch.

**D-3.22-C — `PLAYER_SPEED_PX_S = 200` is a hardcoded duplicate of `GameRoom.ts`'s private tick-loop `SPEED` constant** [`tests/e2e/ability-dispatch.test.ts`; `apps/simulation-server/src/rooms/GameRoom.ts`]
The e2e test's movement-timing math depends on matching the server's actual per-tick movement speed, but that constant (`const SPEED = 200;`) is declared locally inside `GameRoom.ts`'s tick-loop function, not exported. If the server value ever changes, this test's timed joystick bursts would silently mis-time (landing short of or past the intended distance) rather than failing with a clear "stale constant" diagnostic — it would just look like ordinary e2e flakiness. `apps/simulation-server/src/rooms/GameRoom.ts` is a blocked path for this story, so no export was added. Revisit by exporting the constant (or a `packages/shared-types/constants.ts` entry per the project's Configuration Hierarchy convention) whenever `GameRoom.ts` is next open for an unrelated change.
Re-deferred by 3-24-epic-3-post-323-deferred-hardening (2026-07-20): re-verified still valid and unfixed — `GameRoom.ts`'s `SPEED` constant is still private/unexported, and `PLAYER_SPEED_PX_S` (now duplicated a 3rd time, in `full-run.test.ts`) is still a hardcoded, silently-driftable copy. Still not fixed: the proper remedy (promoting the constant into `packages/shared-types/constants.ts` per the Configuration Hierarchy) crosses into Protocol Architect ownership and would trigger the Contract-change hook for a test-timing accuracy safeguard with zero live correctness impact today — disproportionate to this hardening pass, which stayed a 3-context (Mobile/QA/Simulation) bundle with no `shared-types`/`net-protocol` touch. Revisit per this entry's own original trigger: whenever `GameRoom.ts` or `packages/shared-types/constants.ts` is next open for an unrelated change.

**D-3.22-D — Shield magnitude has no lower/upper bound validation, unlike every other status-effect type** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`packages/game-rules/src/systems/status-effects.ts` line 20, consumed at `packages/game-rules/src/systems/player-health.ts`]
`applyStatusEffect` exempts `'shield'` from its `0 ≤ magnitude ≤ 1` guard (correctly, since shield magnitude is flat HP, not a fraction) — but this means a negative or unbounded shield magnitude would reach `applyPlayerDamage`'s absorption arithmetic with no clamp at all. Not reachable today: the only producer of `'shield'` effects in the entire codebase is Warding Cry, with a hardcoded `magnitude: 30` (`packages/game-rules/src/balance.ts:213`). Revisit if a future ability computes a dynamic shield magnitude (e.g. scaled by caster stat or level) without its own clamp — a negative magnitude would make `absorbed` negative, inflating `hpDamage` above the pre-shield mitigated damage while simultaneously growing the shield's stored magnitude each hit.
Resolution: one-line guard change — `applyStatusEffect` now rejects `effect.magnitude < 0` unconditionally (before the shield-exemption check), while still exempting `'shield'` from the upper (`> 1`) bound. Covered by new `packages/game-rules/tests/unit/status-effects.test.ts` (negative shield rejected, positive shield including >1 still accepted, non-shield type still rejects both bounds as before). Warding Cry's existing hardcoded `magnitude: 30` is unaffected.

---

## Deferred from: code review of 4-12-full-hp-restore-on-level-transition (2026-07-15)

**D1 — `isFrozen` is never cleared in `loadLevel()`'s reset loop** [`apps/simulation-server/src/rooms/GameRoom.ts:990-1002`] — RESOLVED by 4-14-epic-4-post-413-deferred-hardening (2026-07-20)
A disconnected/frozen player passing through a level transition keeps `isFrozen === true` (and, after this story's fix, also gets healed to `maxHp` and repositioned like every other player), unlike `resetToHub()` which explicitly clears `isFrozen`. This predates Story 4.12 — `loadLevel()`'s reset loop never touched `isFrozen`, before or after this diff — and is out of this story's HP-only scope. Revisit if frozen/disconnected-player state during level transitions is ever reported as a real player-facing issue.
Resolution: `loadLevel`'s per-player reset loop now sets `player.isFrozen = false` unconditionally for every player, alongside the existing unconditional `player.hp = player.maxHp` line, matching `resetToHub()`'s existing precedent. Covered by new unit tests in `apps/simulation-server/tests/game-room-post-413-deferred-hardening.test.ts`.

---

## Deferred from: code review of 4-13-vote-accept-button-submitted-state (2026-07-15)

**D1 — Optimistic pending state has no recovery path if the server silently fails to honor the vote** [`apps/simulation-server/src/rooms/GameRoom.ts:613-639` `startDungeon` catch block; `apps/mobile-controller/src/screens/ControllerScreen.tsx` `VotePopup`] — RESOLVED by 4-14-epic-4-post-413-deferred-hardening (2026-07-20)
If `startDungeon`'s unanimous-accept path throws (e.g. `loadLevel(1)` fails), the `catch` block reverts `runProposal`/`phase`/`difficulty` to their prior values and clears `runVotes` — but never calls `broadcast(...)`, unlike every other resolution path in this file. Since the client's `gameState.runProposal` value is unchanged, `VotePopup` never unmounts, so the new `hasAccepted` pending state (added by 4.13) never resets — the tapping player's Accept button is stuck on "Waiting..." (`pointerEvents: 'none'`) with no recovery beyond a reconnect. Before 4.13's UI change this was invisible (a repeat tap on an un-dimmed button was at least possible, and harmless either way); the new pending UI makes the pre-existing gap visibly worse. Same class of gap covers `session` being null/undefined at tap time (`onAccept={() => session?.sendVote(...)}` silently no-ops via optional chaining, but `hasAccepted` is set regardless). Root cause is in `apps/simulation-server/**`, a Blocked path for story 4.13, and 4.13's own Non-goals explicitly rule out a network round-trip acknowledgement (optimistic client-side UI only, by design). Revisit as a follow-up story: add a `broadcast` on the `startDungeon` catch-path failure so `VotePopup` unmounts naturally, and/or add a client-side pending timeout as a last-resort UI recovery.
Resolution: a server-side broadcast fix was confirmed a dead end (the reverted `runProposal` is the SAME non-null object by design, so `VotePopup`'s `!== null` render gate would never flip regardless). Instead, `VotePopup` now starts a bounded 6s recovery timeout (`VOTE_ACCEPT_STUCK_TIMEOUT_MS`) when `hasAccepted` becomes `true`; if still mounted when it elapses, `hasAccepted` resets to `false`, re-enabling Accept. The timer is cleared on unmount or when `hasAccepted` is `false`. Entirely client-side — no protocol/shared-types change. Verified by code trace per the Client-UX hook (no automated test — `apps/mobile-controller` has no test harness).

---

## Deferred from: code review of dev-3-controller-fullscreen-toggle (2026-07-17)

**D1 — Fullscreen toggle button has no `aria-label`/`role`/keyboard affordance** [`apps/mobile-controller/src/screens/ControllerScreen.tsx:~1206-1223`]
The new toggle is a bare `<div onPointerDown>` with a glyph-only ("⛶") label — invisible to screen readers and unusable without touch/pointer input. This exactly mirrors the pre-existing `InteractButton` component in the same file (also a bare `<div onPointerDown>`), which the story's own Dev Notes explicitly instructed the toggle to match — so it is not a regression introduced by this story, it's an existing file-wide convention. Revisit as a broader accessibility pass across all `div`-as-button controls in `ControllerScreen.tsx` if mobile accessibility is ever prioritized.

**D2 — No explicit `exitFullscreen()` when navigating away from `ControllerScreen` to other `App.tsx` screens** [`apps/mobile-controller/src/App.tsx`]
Whether fullscreen should persist across a transition to `PostRunMobileScreen`/the victory screen, or be explicitly exited, is unspecified — no AC in dev-3 covers it. Current behavior (persist, since fullscreen is a document/browser-level state not scoped to the `ControllerScreen` component) is plausibly correct — it avoids UI flicker and matches the story's "maximize screen space" intent — but it's an implicit choice, not a deliberate one. Revisit if players report unwanted fullscreen persistence (or unwanted exits) across those transitions.

**D3 — `eslint.config.mjs` never configures `languageOptions.globals`, so `no-undef` fires repo-wide on every standard DOM/Node global** [`eslint.config.mjs`; affects `apps/*`, `packages/*`, `tests/*`, `_bmad/wds/scripts/*`]
Discovered while re-verifying this story's lint status: `npm run lint` (`eslint .`) actually fails with 308 errors across 37 files — `document`, `window`, `navigator`, `console`, `setTimeout`/`setInterval`, `process`, `require`, `React`, etc. are all flagged as undefined, because `js.configs.recommended` enables `no-undef` and the config never adds `globals.browser`/`globals.node` for the relevant file globs. Confirmed pre-existing (via `git stash`, the same error class was already present on baseline before dev-3's changes) and confirmed repo-wide, not scoped to any one story. It had been silently masked in recent sessions because the `rtk` CLI proxy this environment routes shell commands through was serving cached/stale `npm run lint` results (`-100%` cache hits per `rtk gain --history`) instead of re-running the real command — multiple prior stories in this log likely recorded false "lint clean" claims on that same stale-cache basis. Root fix: add the `globals` package (or hand-rolled equivalents) to `eslint.config.mjs`, splitting `browser` globals onto `apps/host-client/**`/`apps/mobile-controller/**` and `node` globals onto server/tooling globs. Out of scope for any single story to fix incidentally — it's a shared root-level config file, high blast radius, needs its own dedicated pass (likely QA + Telemetry Engineer ownership per CLAUDE.md's CI-config bucket) with the whole repo re-linted and reviewed in one go.

---

## Deferred from: code review of 4-14-epic-4-post-413-deferred-hardening (2026-07-20)

**D1 — `loadLevel`'s unconditional `player.isFrozen = false` can un-freeze a player who is genuinely still mid-disconnect-grace** [`apps/simulation-server/src/rooms/GameRoom.ts:1030-1032` (new `loadLevel` clear), `:493-506` (`onLeave`'s freeze/reconnect-await)]
`isFrozen` is set `true` in exactly one place — `onLeave`, on a real network drop, immediately before `await this.allowReconnection(client, RECONNECT_GRACE_MS)`. That `await` yields the event loop, so other message handlers and the tick loop keep running for up to the grace window while the player's slot stays held. `activePlayers = players.filter(p => !p.isFrozen)` (used to gate vote/return-ready resolution) is specifically designed so the remaining active players can progress — including triggering a level transition — without the frozen player's input. Story 4.14's Task 3 makes `loadLevel`'s per-player reset loop clear `isFrozen` unconditionally for every player, mirroring `resetToHub()`'s pre-existing identical pattern (line 816). If `loadLevel` runs while a player is still genuinely mid-`onLeave`-await (not yet reconnected, not yet grace-expired), their `isFrozen` flag is prematurely cleared — `activePlayers` then incorrectly includes them for future vote/return-ready gates, which can never resolve until they either reconnect (which independently re-clears `isFrozen` anyway) or the grace timer expires and `onLeave` removes their slot. Bounded by the grace period (`RECONNECT_GRACE_MS`), not indefinite, but undermines the flag's purpose for that window. This is not a regression introduced by this diff's design — the identical unconditional-clear pattern already existed in `resetToHub()` pre-story, and AC3 explicitly directs `loadLevel` to match that precedent. Revisit if this is ever suspected of causing a real stuck-vote/stuck-return report; the fix would need a distinct "genuinely mid-disconnect" flag separate from `isFrozen`, or gating both `resetToHub()`'s and `loadLevel()`'s clears on it — out of scope for a minimal hardening diff.

**D2 — `spawnWave`/`spawnEnemies` partial-failure leaves already-spawned enemies un-rolled-back; `tick()` doesn't gate enemy processing on `session.levelIndex`** [`apps/simulation-server/src/rooms/GameRoom.ts`, `spawnWave`/`spawnEnemies` internals; `tick()`'s enemy-processing block]
If `spawnWave`/`spawnEnemies` throws partway through their per-enemy spawn loop (e.g. `createEnemyBody` fails on a later iteration), any enemies already pushed into `gameState.enemies` and registered in `enemyBodies` before the throw are never rolled back. Since `tick()` iterates `gameState.enemies` unconditionally every tick (no gate on `session.levelIndex`), these orphaned enemies keep moving and attacking players even though this story's AC1 fix now correctly reports the level transition as not-yet-committed (`levelIndex` unchanged). Pre-existing behavior of `spawnWave`/`spawnEnemies`'s internals — this story's diff only reorders the `levelIndex` commit relative to these calls (per AC1's literal scope: "only the ordering relative to the throwing call changes"), it does not touch either function's body. Revisit if partial-spawn failures are ever observed in practice; likely needs a "roll back enemies spawned this call" cleanup in each function's own catch path.

**D3 — `VotePopup`'s 6s recovery timer starts per-tap, not per overall vote resolution — can fire while genuinely still waiting on a slower teammate** [`apps/mobile-controller/src/screens/ControllerScreen.tsx:590-594`]
The timer arms as soon as *this* player taps Accept, independent of how many other players still need to accept. In a session with more than 2 players, waiting on an AFK or slow teammate can easily exceed 6s even though this player's own vote succeeded — the button silently reverts to "Accept" with no message distinguishing "something failed, please retry" from "your vote is fine, still waiting on others." This is the literal behavior AC4 specifies ("When 6 seconds elapse with the component still mounted... hasAccepted resets to false") — not a deviation from spec, but a UX rough edge baked into the AC's own bounded-timeout design (the story's Non-goals explicitly rule out a network round-trip acknowledgement or new server signal). Revisit as a UX polish follow-up if reported in real multi-player sessions — e.g. a distinct "still waiting on others" vs. "retry" message, or scoping the timeout to overall vote completion rather than this player's own tap.

---

## Deferred from: code review of 3-23-skill-cell-joystick-aiming-interaction (2026-07-20)

**D1 — Required Client-UX hook not run; readability risk corroborated by code trace** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`apps/mobile-controller/src/screens/ControllerScreen.tsx:807-836,852-889`]
The story's own Dev Agent Record flags that manual Client-UX verification (per-type ring/knob color/animation/fire-gesture check, minimal-attention readability) was not performed — no display/touch device available in the dev sandbox. Independently verified via a direct code trace during review: the ability name/badge `<span>`s (lines 807-836) are non-positioned (in-flow) elements, which the CSS stacking model paints strictly before `position:absolute` siblings regardless of z-index value — so the new 80px ring (`zIndex: 8`, lines 852-889) will visually paint over the name/badge text whenever the spawn origin lands near the cell's bottom-left label area, which is likely given players naturally touch near the label they're reading. Revisit: needs a human pass on a real device or touch-emulation devtools before this story is considered done; if occlusion is confirmed, likely fixes are raising the text's z-index/stacking context or reducing ring opacity near the label.
Resolution: the ability name/badge `<span>`s are now wrapped in a `position: relative, zIndex: 9` container (one above the ring/knob's `zIndex: 8`), giving the text its own stacking context above the overlay — a structural, code-verifiable CSS-stacking guarantee (deterministic per spec, not a rendering heuristic) that closes the occlusion risk regardless of where the ring/knob's spawn origin lands. Still worth a human device pass on overall feel, but no longer a blocking gate for this specific risk.

**D2 — Ring/knob visual tears down mid-hold on cooldown start, not on lift** — RESOLVED by 3-24-epic-3-post-323-deferred-hardening (2026-07-20) [`apps/mobile-controller/src/screens/ControllerScreen.tsx:774`] (tracked as `D-3.23-A`)
`isInteractive` (folds in `!isOnCooldown`) is a dependency of the SkillCell touch-tracking `useEffect`; a successful AUTO/AIM_CAST cast flips `isOnCooldown` mid-hold, re-running the effect and firing its cleanup (`setSpawnOrigin(null)`/`setKnobOffset({0,0})`) even though the player's thumb never lifted — contradicting EXPERIENCE.md D-020's "whole duration of the hold" language for AUTO/AIM_CAST tracking. The root cause (`isInteractive` in the dependency array) is pre-existing and unmodified by this diff; this story's changes only made the consequence visible by adding a visual that gets cleared. Same underlying mechanism as the already-tracked `D-3.3-B` (RELEASE silently drops on cleanup), but much higher frequency since it fires on every successful AUTO/AIM_CAST cast rather than only on a phase transition. Fixing `isInteractive`/fire-timing semantics is out of this story's Non-goals. Revisit as a dedicated fix to the touch-tracking effect's cleanup/dependency structure — likely needs to split "visual cleanup" (should NOT fire on cooldown-start, only on lift) from "interval/ref cleanup" (should still respect `isInteractive` for other cases like the player going downed) into separate effects or a narrower dependency array.
Resolution: see D-3.23-A's own entry above — exactly the split this entry recommended. `canHoldThroughCooldown` now drives the effect's dependency array/guard (visual + interval + listeners all persist through a cooldown-only flip); `isOnCooldownRef` gates new touchdowns separately inside `onTouchStart`.

---

## Deferred from: code review of 1-10-epic-1-post-19-deferred-hardening (2026-07-20)

**D1 — `leavingIntentionallyRef` is a single global, non-session-scoped flag; a rapid leave-then-rejoin race can mis-attribute a later disconnect** [`apps/mobile-controller/src/App.tsx:163-167` (`handleDisconnect`'s flag check), `:275-281` (`onBack`'s flag set)]
The new flag is set in `onBack` and consumed in `handleDisconnect`, but nothing resets it when a *new* session starts (`handleJoin`/`handleReconnect` never touch it) and `room.leave()` is async (`mobile-session.ts`'s `onLeave.once` callback can fire well after the click that triggered it). Trigger: user taps Back on room A (flag set true, A's leave in flight), quickly re-enters a code and joins room B before A's `onLeave` fires; if B then drops unexpectedly before A's stale `onLeave` arrives, `handleDisconnect` for B sees the leftover `true` and silently swallows B's genuine disconnect (no reconnect screen shown, player stuck). A milder variant: if the OS backgrounds/suspends the tab so A's `onLeave` never fires at all, the very next real disconnect on any future session is swallowed exactly once. Root-causing this fully would require session-scoped disconnect handling (each `handleDisconnect` registration checking it's still the active session) rather than a single boolean ref — explicitly out of this story's Non-goals ("one boolean ref flag is sufficient... not a generic leaving-reasons enum or event bus"). Net effect is still a strict improvement over pre-story behavior (previously *every* self-initiated leave racing a disconnect showed the reconnect screen; now only this narrow rapid-rejoin window is affected). Revisit if session-hopping-then-dropping is ever reported as a real player-facing issue, or as part of a broader session-identity-aware reconnect handler.

**D2 — `safeReplaceState`'s blanket catch means `handleGiveUp`'s stale-URL clear can silently no-op under the exact throttle condition it exists to survive** [`apps/mobile-controller/src/App.tsx:22-32` (`safeReplaceState`), `:246-253` (`handleGiveUp`'s clear-on-empty-code branch)]
`safeReplaceState`'s "losing a URL sync is harmless" rationale holds for `handleJoin` and `onBack` (both are purely a sync of already-known state), but not for `handleGiveUp`'s Task-3 call site, whose entire purpose is to strip a stale `?session=<oldRoomId>` before `SessionCodeEntryScreen` mounts without an `initialCode` prop (`SessionCodeEntryScreen.tsx:32-33` falls back to reading `?session=` from the URL when `initialCode` is absent). If `history.replaceState` throws here (Safari's ~100-calls/30s throttle — the exact case the helper was built to survive), the exception is swallowed, the stale code stays in the URL, and the give-up flow silently re-prefills the abandoned room instead of showing a blank field, undermining AC3's stated intent in the one case AC1 is designed to handle. Requires two independently rare conditions to compound (the browser throttle AND being on the give-up path with no reconnect code), matching this story's own D1 framing of "very-low-probability real-world trigger." Fixing it without contradicting AC1's uniform swallow-everything design would need a URL-independent source of truth for "no code to prefill" (e.g., an explicit `hasStaleUrl` flag or switching `SessionCodeEntryScreen`'s fallback away from reading the URL directly) — a small but real redesign of the Story 4.7-established URL-as-fallback pattern, out of this story's scope. Revisit if stale-code re-prefill on give-up is ever reported.

## Deferred from: code review of 2-9-epic-2-post-28-deferred-hardening (2026-07-20)

**D-2.9-A — Sibling unguarded `renderFrame` call in the `[gameState]` effect body has the same throw-vulnerability class as D-2.6-A** [`apps/host-client/src/screens/HubWorldScreen.tsx:196`]
Story 2.9 wrapped the flash-animation `tick` closure's `renderFrame` call in try/catch (D-2.6-A), but the direct `renderFrame` call at the top of the same `[gameState]` effect (before the `tick` closure is ever entered) remains unguarded. A throw there is unhandled — same failure class, different call site, out of D-2.6-A's/AC1's originally-scoped location. Found by the Edge Case Hunter review layer during Story 2.9's code review, verified against source; not caused by this story's diff, pre-existing. Revisit alongside any future rendering-robustness pass, or if `renderFrame` ever gains a real throw path (WebGL context loss, PixiJS upgrade).

**D-2.9-B — Sibling unguarded `renderFrame` call inside the async PixiJS init effect** [`apps/host-client/src/screens/HubWorldScreen.tsx:176`]
Same throw-vulnerability class as D-2.9-A / D-2.6-A: the catch-up `renderFrame` call inside the PixiJS init effect (fires when `gameState` arrived before `pixiAppRef` finished initializing) has no try/catch. Found by the Edge Case Hunter review layer during Story 2.9's code review; pre-existing, untouched by this story. Revisit together with D-2.9-A.

## Deferred from: code review of 7-1-vfx-engine-foundations (2026-07-21)

**D-7.1-A — Same `EffectHandle` can be added to `VfxEngine` twice, guaranteeing a double `dispose()`** [`apps/host-client/src/vfx/engine.ts:22-27`]
`add()` allocates a fresh id per call with no identity check, so one handle can occupy two map entries. The first completion runs `removeChild` + `dispose()` → `view.destroy()`; the second entry then calls `update()` → `view.clear()` on a destroyed Graphics and disposes it again. `EffectHandle.dispose`'s doc comment promises "called by the engine exactly once" — nothing enforces it. Caller-contract issue with no consumer yet (AC3 keeps the library unwired until Story 7.2). Revisit if a 7.2+ consumer caches and re-adds handles, which `TrailHandle` invites since it is explicitly designed to be held.

**D-7.1-B — `VfxEngine` has no reentrancy guard for `add()`/`remove()`/`clear()` called from inside an effect's `update()`** [`apps/host-client/src/vfx/engine.ts:24-25,30,45-46`]
JS `Map` iteration visits entries inserted during iteration, so an effect that spawns a follow-up in its own `update()` gets that follow-up ticked at the same `now` and can spawn again — an unbounded loop that hangs the frame rather than deferring to the next tick. Symmetrically, `remove(id)`/`clear()` called from inside an effect's `update()` destroys the view while that `update()` body is still executing. No consumer does either yet. Revisit when chained/self-spawning effects (spark emitters, multi-stage boss attacks) first appear in 7.2-7.8; the fix is an add/remove queue drained after the update pass.

**D-7.1-C — Neither the engine nor any primitive detects an externally destroyed `view` or borrowed `target`** [`apps/host-client/src/vfx/engine.ts:40-41`, `apps/host-client/src/vfx/primitives.ts:273`]
If a caller (or a parent Container teardown, as `DungeonScreen` does when an entity leaves state) destroys an effect's display object mid-flight, the engine keeps calling `update()` → `clear()`/`circle()` on a destroyed object, then `removeChild` on a non-child plus a second `destroy()`. `createTintPulse` is the sharper case: it animates a borrowed Container with `view: null`, so the engine holds no reference to validate, and an enemy killed on the same tick its cast flash starts keeps receiving `.alpha` writes for the rest of the pulse. Same failure class as the pre-existing D-2.6-A / D-2.9-A renderer-robustness items — worth handling together in one pass with a `destroyed` check.

**D-7.1-D — No cap, pooling, or load-shedding on concurrent VFX** [`apps/host-client/src/vfx/engine.ts:22-27`]
`add()` is unconditional. An ability spammed at input rate, or a trigger driven by a state field that stays true, adds one effect per frame; at 60fps with a 500ms duration that is 30 concurrent effects steady-state, each redrawing every frame, with no mechanism to shed load. Deliberately unbounded for now — real effect volumes are unknown until Stories 7.2-7.8 wire actual abilities in. Revisit with a measured frame budget rather than a guessed cap.

## Deferred from: code review of 7-2-stonehide-ability-vfx (2026-07-22)

**D-7.2-A — Balance constants are hand-transcribed into the host with no drift detection** [`apps/host-client/src/vfx/ability-vfx.ts:95-144`, `apps/host-client/src/vfx/ability-vfx.test.ts:13-15`] — **RESOLVED by Story 7.9** (`7-9-shared-ability-geometry-contract`, landed 2026-07-23, user "Option B" decision): the ability spatial geometry (`ABILITY_HIT_RANGE_PX`/`ABILITY_HIT_RADIUS_PX`/`ABILITY_DELIVERY`, `SPIRIT_NOVA_*`, `STORM_EYE_ZONE_RADIUS_PX`, `VOID_PULSE_ZONE_RADIUS_PX`, `PROJECTILE_*`) now lives in `packages/shared-types/src/ability-geometry.ts` (the ability presentation contract, ADR-0003); the sim reads it via a `game-rules` re-export (byte-identical, deterministic) and the host imports it directly, so the VFX reads the live values with no transcription to drift. The cooldown-budget invariant — the one coupling that stays balance-only — is now backstopped by `tests/contract/ability-vfx-budget.test.ts` against the live `ABILITY_COOLDOWNS_MS`, and the hand-copied cooldown literal was removed from `ability-vfx.test.ts`. The refined host boundary ("never import `game-rules` *logic*; the shared spatial contract in `shared-types` is host-importable") is recorded in `docs/adr/ADR-0003-ability-presentation-contract.md`.
The AC5 budget invariant ("every effect's `durationMs` is strictly shorter than that ability's cooldown, so at most one instance per ability per player is ever live") is asserted against a *local copy* of the Stonehide cooldowns `[2000,4000,6000,1000]`, not against `packages/game-rules/src/balance.ts`. If balance drops Avalanche's cooldown below 180 ms the test still passes while the invariant silently breaks. The same applies to the hit radii (100/60/120/50) baked into the ring sizes, which AC2 requires to match the zone the server actually tests. This is spec-mandated for now — `apps/host-client` must never import `packages/game-rules` — so the fix is not an import but a cross-package assertion, e.g. a test under `tests/contract/**` (which may import both) pinning the host's visual constants to the balance table. Grows with every class 7.3-7.5 adds. Found by the Blind Hunter layer.

**D-7.2-B — AC1 distinctness of the Stone Wall / Iron Skin pair rests entirely on colour** [`apps/host-client/src/vfx/ability-vfx.test.ts:28-36`]
Both are caster-anchored converging rings of near-identical duration (100→26 over 320 ms vs 120→30 over 300 ms), differing in stroke weight, the presence of a drag beam and dust, and hue — dust-brown `0x8a6f4a` vs slate-grey `0x8f8aa0`. The distinctness test's `signatureOf` includes colour, so it passes by construction and cannot fail for geometric similarity. Whether the two read as different abilities at 2-4 m on a couch is exactly what the Client-UX manual pass must answer; if it does not, the fix is a shape or motion change to one of them, not a test change. Found by the Blind Hunter layer. Revisit when the Story 7.2 manual pass runs.

**D-7.2-C — VFX handles are never cancelled when their caster vanishes mid-effect** [`apps/host-client/src/screens/DungeonScreen.tsx:642, 661, 674`]
`VfxEngine.add()` returns an id specifically so callers can cancel early — its doc says "e.g. its source entity vanished" (`engine.ts:45`) — but all three call sites discard the return value and no id is retained. Every other entity visual in `renderFrame` prunes against the live state set (players, tethers, badges, the Iron Skin shell); VFX handles have no such prune. A Stonehide who is downed, killed, disconnects (`isFrozen`) or leaves the room in the 140-420 ms after a cast leaves a full-alpha ochre shockwave expanding from a body that is already gone or greyed to 0.3. Cosmetic and sub-half-second, so deferred rather than patched; the fix is a `Map<playerId, number[]>` of live ids plus a cancel pass, which is the same bookkeeping D-7.1-C would need. Found by the Edge Case Hunter layer. Revisit alongside D-7.1-C, or when 7.6/7.8 introduce effects with lifetimes long enough for the orphan to be noticed.

**D-7.2-D — AC2's own geometry table is wrong for Iron Skin: its 120 px hit radius is dead data** [`_bmad-output/implementation-artifacts/7-2-stonehide-ability-vfx.md` AC2, `apps/simulation-server/src/rooms/GameRoom.ts:2194`]
`GameRoom.ts:2194` is `if (rawDamage <= 0 && healAmount <= 0) continue;` and executes *before* the `isInHitZone` loop. Iron Skin has `ABILITY_DAMAGE.stonehide[2] === 0`, no heal, and a `self`-scoped `damageReduction`, so hit-scan is skipped outright and `ABILITY_HIT_RADIUS_PX.stonehide[2] = 120` is never read — structurally identical to the Tremor Stomp `hitRange: 160` trap the story correctly identified one row earlier in the same table. AC2's line "Iron Skin = radius 120 at the caster" therefore asserts a zone the simulation does not test, and the shipped cast ring (`startRadius: 120` converging to 30) echoes that number. Visual impact is mild — a converging slate ring reads as armour closing rather than as reach — so this was deferred rather than patched during the 2026-07-22 code review; the code faithfully implements the spec, and it is the spec that is wrong. Fix is either a spec correction (document 120 as decorative) or a retune of the ring's `startRadius` to a number that echoes no balance value. Found by the Acceptance Auditor layer. Revisit when Story 7.6 touches Iron Skin's status treatment, or during the Epic 7 retrospective.

## Design note: zero-aim target intent is geometry-derived, not modelled (2026-07-23)

**D-DESIGN-1 — The ability architecture has no "beneficial ability + zero aim = self-target" branch; zero-aim behaviour is derived purely from geometry (inputType + hitRange + status scope).** [`packages/shared-types/src/class-definitions.ts:5-8`, `apps/simulation-server/src/rooms/GameRoom.ts:2203`, `packages/game-rules/src/systems/combat.ts:42-63`]

Raised during Epic 7 VFX work while deciding how the host should render a zero-aim cast. Investigated against the shipped sim; findings:

- `ClassAbilityDef` is `{ name, inputType }` only — there is **no** `targetsAllies` / `friendly` / `selfCast` / target-intent field anywhere in the schema.
- The sim's single zero-aim guard is `if (isDirectional && mag === 0 && hitRange > 0) continue;` (`GameRoom.ts:2203`), where `isDirectional = inputType !== 'TAP'`. It keys on **geometry**, never on whether the ability helps or harms.
- "Beneficial" behaviour is expressed indirectly through three unrelated mechanisms: `inputType: 'TAP'` (self-centred, e.g. Spirit Nova), a hardcoded `(0,0)` direction at the call site (`allies-in-zone`, e.g. Warding Cry), and `ABILITY_STATUS_EFFECT[...].scope === 'self'` applied before the damage guard (e.g. Iron Skin, Dark Pact's buff).
- **Consequence today:** self-inclusive beneficial abilities (TAP / allies-in-zone / self-scope) already fire on zero aim; directional beneficial abilities (Ancestor's Voice cone, Soul Mend AIM_CAST, Dark Pact drain) are **skipped** on zero aim exactly like offensive ones. There is no path where a zero-aim directional cast self-targets.
- **Why it doesn't bite in the current kit:** every self/ally-beneficial effect in the shipped roster is already delivered self-inclusively, and the three directional beneficial abilities are ones where self-targeting is nonsensical (Dark Pact would drain the caster) or impossible by design (Soul Mend needs a *downed* target; you cannot cast while downed).

**When to revisit:** if a *directional single-target ally heal/buff* (or any ability where "flick with no aim = cast on myself" is the intended UX) is ever added. That would be a **simulation-server + game-rules change** — a new target-intent field on the ability definition plus a dispatch branch — which trips the simulation-safety hook and is an explicit Epic 7 non-goal ("no new abilities or mechanics"). The host VFX would then follow the sim (render the self-target), per the standing "render what the sim does" rule. Until then, Epic 7 keeps the geometry-derived rule: **zero-aim directional cast → sim does nothing → host renders nothing (no effect, no flash).**

## Deferred from: code review of 7-3-spiritcaller-ability-vfx (2026-07-23)

**D-7.3-A — Back-to-back Soul Mend that retargets across an unobserved null/dropped frame renders the second channel at the first target** [`apps/host-client/src/screens/DungeonScreen.tsx` Soul Mend start loop]
The channel-start loop skips a caster that already has a `soulMend` visual (`if (!channel || soulMend.has(player.id)) continue`). If a caster's `channelingAbility` transitions A → null → B (completes/cancels on ally A and immediately re-channels ally B) without any rendered frame observing the intermediate `null` — a backgrounded tab (rAF paused, React transient effect still runs) or `gameState === null` spanning the transition — the old visual for A is never terminated, so the link beam, imploding progress ring, and terminal bloom all render at A's frozen position/target for the entire second channel. Found by the Edge Case Hunter layer. Narrow: needs dropped frames AND an immediate retarget, and Soul Mend's ~2500 ms channel makes an unobserved full A→null→B rare. A fix would detect a target mismatch (`visual.targetPlayerId !== channel.targetPlayerId`) in the start loop and re-create the visual; deferred rather than adding that to a prototype-quality visual. Revisit if playtesting shows mis-placed Soul Mend visuals, or alongside any `latestTransientDelta`-queue work.

**D-7.3-B — A killing-blow enemy receives no damage-faction accent** [`apps/host-client/src/screens/DungeonScreen.tsx` mixed-faction accent loop]
The per-frame HP-diff accent loop builds its entity set from `state.enemies.filter(e => e.isAlive)`. An enemy taken to 0 HP by a Spiritcaller cast flips `isAlive` false on the same frame its `hp` reaches 0, so it is excluded from the diff and its `hpMemory` entry is pruned — the final lethal hit shows no `SPIRIT_HARM` accent (heal accents on survivors still render). This is explicitly within Story 7.3 §5's "best-effort … can miss" allowance and deliberately avoids a phantom accent on a corpse, so it was deferred rather than patched; it is a literal deviation from Task 5.2's "walk state.enemies". Found by the Edge Case Hunter and Acceptance Auditor layers. Revisit only if the missing kill-accent is judged confusing in the Client-UX pass; the fix (diff against last-alive hp before pruning) adds corpse-tracking state disproportionate to a cosmetic accent.

## Deferred from: code review of 7-4-souldrinker-ability-vfx (2026-07-23)

**D-7.4-A — Transient-delta batch-collapse drops simultaneous `projectile:hit` / `ability:fired`** [`apps/host-client/src/screens/DungeonScreen.tsx:1083`, `apps/host-client/src/App.tsx:20`]
The host delivers transient deltas through a single-slot `latestTransientDelta` useState set once per delta. When multiple whitelisted deltas arrive in one synchronous WebSocket flush, React keeps only the last, so the `[latestTransientDelta]` effect fires once — two Blood Spike / Void Pulse impacts (or two casts) in the same batch render only one VFX, and unlike `cast:cancelled` there is no `renderFrame` backstop for `projectile:hit`. Pre-existing single-slot channel limitation, already disclosed in the story's Dev Notes; newly relied upon by 7.4 for the lifesteal/impact cues. Found by the Edge Case Hunter (corroborated by Blind Hunter). The real fix is an App.tsx delta queue that drains every delta of a flush — cross-cutting, affects all consumers, out of this story's scope. Revisit if the manual Client-UX pass shows dropped lifesteal cues breaking AC2, or alongside any `latestTransientDelta`-queue work (see D-7.3-A).

**D-7.4-B — `projectileMeta` miss for a projectile never observed in a delivered snapshot** [`apps/host-client/src/screens/DungeonScreen.tsx:979`]
The projectile identity cache (`projectileMetaRef`) is populated only in `renderFrame` (rAF) from `state.projectiles`. A Souldrinker projectile that spawns and hits between two client-delivered snapshots is never cached, so when its `projectile:hit` arrives `projectileMetaRef.get(id)` is undefined and the impact splash/implode silently no-ops — no fallback impact is drawn even though the delta itself proves a projectile existed. Found by Blind Hunter + Edge Case Hunter. Rooted in snapshot cadence, not this story's wiring — Story 7.10 (`projectile:moved` position streaming) is the real fix and directly targets this class of gap. Revisit with 7.10.

**D-7.4-C — Buffed-player reconnect re-triggers the Dark Pact buff-onset pulse** [`apps/host-client/src/screens/DungeonScreen.tsx:1082`]
`buffedPlayersRef` is rebuilt from currently-present players each snapshot, so a player who disconnects while carrying `damageBuff` drops from the set; on reconnect (statusEffects reconciled per snapshot) they read as newly-buffed and re-emit one `planDamageBuffOnset` pulse. Found by the Edge Case Hunter. Harmless single cosmetic double-pulse on an already-rare reconnect-mid-buff window; deferred rather than adding roster-diff pruning disproportionate to the effect. Revisit only if the manual pass flags it.

## Deferred from: code review of 7-5-stormcaller-ability-vfx (2026-07-24)

**D-7.5-A — `isStormEyeZone` matches any Stormcaller `'damage'` zone, not specifically Storm Eye** [`apps/host-client/src/vfx/ability-vfx-config.ts`]
Zone identity is derived from `effectType === 'damage'` AND owner class `STORMCALLER`, with no per-ability/zone-source discriminator. If a future Stormcaller mechanic ever emits a second concurrent `'damage'` zone, it too would get the Storm Eye slate body, rim and 2/s pulse. Found by the Blind Hunter. Not actionable now: full disambiguation requires a `ZoneState` schema field, which is a blocked path (`packages/shared-types/**`, Protocol Architect) and forbidden by Epic 7's non-goals (no protocol/schema changes). Today `'damage'` is only ever Storm Eye and `'pull'` only Void Pulse, so the guard is correct for the shipped game; the code comment is the disambiguator of record. Revisit if/when a class gains a second damage-zone ability.

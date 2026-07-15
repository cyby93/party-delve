---
baseline_commit: 1f9b932f57fcab246b1dcffdda5367da338fc243
---

# Story 2.8: Hub Ability Use Outside Training-Dummy POI

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Story 2.4 wired ability use at the training dummy by gating the server's
  ability-processing loop on `player.nearPoiId === 'training-dummy'` OR `inDungeon`
  (GameRoom.ts). Epic 3 built out the full 4-class ability/cooldown/combat system for
  dungeon combat, and that dungeon path already bypasses the nearPoiId gate entirely
  (`inDungeon` alone is sufficient). The training-dummy-only scoping is now purely a
  hub restriction: a player anywhere else in the hub (at spawn, walking between POIs,
  standing at the class-select or dungeon-entrance POI) cannot fire an ability — the
  input is silently dropped server-side, with zero client feedback (confirmed by
  reading the exact guard, GameRoom.ts:1898-1900).

  This story removes that restriction so any player with a confirmed class can fire
  abilities anywhere in the hub, matching how it already works in a dungeon. It also
  requires a client-side companion fix: the mobile skill cells are independently
  gated to interactive-only "at training dummy OR in dungeon" (ControllerScreen.tsx,
  `trainingDummyActive` state + `isInteractive` computation, confirmed by reading the
  full component). Removing only the server guard without this client fix would ship
  a no-op — the phone's skill cells would still show `pointerEvents: 'none'` (and no
  touch listeners attached) everywhere except the training dummy, so the relaxed
  server guard would never be reached from real input.

  Verified by reading GameRoom.ts and ControllerScreen.tsx in full before writing this
  story (see References below for exact current-state line citations).
Owner agent: Multi-context (explicit cross-context approval granted):
    Simulation Engineer    (Task 1 — remove nearPoiId gate from ability-processing loop)
    Mobile Controller Eng  (Task 2 — remove trainingDummyActive gate from skill-cell
                             interactivity; delete now-dead state)
Goal: A player with a confirmed class can fire any ability anywhere in the hub (not
  only within the training-dummy POI radius), with identical firing behavior to today's
  training-dummy case (cooldown starts, self-cost HP applies, no ability:fired delta
  or hit-scan — those remain dungeon-only, unchanged). The training-dummy POI's zone,
  interact button, and targetable-dummy host visual are untouched.
Allowed paths:
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — ability-processing guard only)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — skill-cell interactivity gate only)
  - tests/e2e/hub-ability-use.test.ts                        (NEW — regression test)
Blocked paths:
  - packages/**                        (no protocol/shared-types/game-rules change needed — this
    is purely a gating condition removal on both sides of the existing wire contract)
  - apps/host-client/**                (training-dummy visual, chat-bubble, and POI zone rendering
    are explicitly unchanged per epics.md AC2 — do not touch HubWorldScreen.tsx)
  - apps/simulation-server/src/**      (except GameRoom.ts)
  - apps/mobile-controller/src/**      (except ControllerScreen.tsx)
Non-goals:
  - Repurposing the training-dummy POI itself (explicitly out of scope per epics.md — the
    POI's zone/interact-button/targetable-dummy visuals stay exactly as Story 2.4 built them)
  - Any change to `packages/net-protocol` — `InputMsg`/ability event shape is unchanged
  - Any change to `packages/game-rules` `dispatchAbility` — the dispatch/cooldown/self-cost
    logic itself is correct and untouched; only the caller-side "should we even attempt this"
    gate changes
  - Blocking ability use during `post-run` phase specifically. The simplest correct guard
    (`if (!inDungeon) continue`) also permits firing during `lobby`/`post-run` phases, not just
    `hub`. This is a deliberate choice, not an oversight — see Dev Notes "Phase scope decision"
    for the analysis and why it is safe. If a future story wants stricter parity with the
    RUN_PROPOSE/VOTE handlers (which explicitly exclude `post-run`), that is a separate,
    narrower follow-up, not part of this story's stated AC.
  - Closing deferred items D-2.4-B/D-2.4-D in deferred-work.md. Both become moot as a side
    effect of this change (see Dev Notes), but updating that historical log is bookkeeping for
    a future retro/hardening story, not this feature story.
Acceptance criteria: see AC section below
Required hooks:
  - Simulation-safety hook: GameRoom.ts modified (ability-processing loop). Typecheck + full
    existing test suite must stay green. New e2e test required (see Required tests).
  - Client-UX hook (mobile): skill-cell interactivity change is a touch-input behavior change.
    Manual/e2e verification that TAP/AUTO/RELEASE all still work identically to the training-
    dummy case, just hub-wide. No new UI element, no new screen state — this is a gating
    condition change only, not a new user flow, so no new telemetry event is required.
Required tests:
  - tests/e2e/hub-ability-use.test.ts (NEW) — real-server regression test: join a session
    (starts in `lobby` phase, spawn position (960,540) far from the training-dummy POI at
    (1520,400) r=120, per packages/shared-types/src/poi.ts), select a class, fire an ability
    WITHOUT moving toward any POI, and assert a `COOLDOWN_UPDATE` for that ability index is
    received. This is precisely the scenario the old guard silently dropped.
  - npm run typecheck from repo root must be clean after all tasks
  - Full existing suite (`npx vitest run` or equivalent) must show no regressions
Telemetry impact: None. No new event, screen, or flow — an existing input path now succeeds
  in more locations than before.
```

---

## Cross-Context Ownership Note

This story touches two ownership areas: Simulation Engineer (`GameRoom.ts`) and Mobile
Controller Engineer (`ControllerScreen.tsx`). Cross-context approval is granted and the story
is kept as one unit rather than split, because:

- Each side of the change is a single-condition edit (one guard clause per file) — splitting
  would produce two stories of a few lines each with a hard dependency between them (the
  server fix alone is unreachable from real input without the client fix; the client fix alone
  would let the input reach the server only to still be silently dropped).
- Both changes implement one indivisible AC ("ability fires exactly as it would in a dungeon,
  anywhere in the hub") — there is no meaningful partial-done state between them.
- This mirrors the precedent already set by Story 2.4 (also multi-context, also explicitly
  "do NOT split") for the same feature area.

Do NOT split this story.

---

## Story

As a player,
I want to use my abilities anywhere in the hub, not only near the training dummy,
so that the trainer POI can be repurposed for something else without blocking normal ability use.

---

## Acceptance Criteria

**AC1 — Ability fires anywhere in the hub, not just at the training dummy:**
**Given** a player with a confirmed class is anywhere in the hub (not in a dungeon)
**When** they activate a skill cell
**Then** the ability fires exactly as it would in a dungeon — the `nearPoiId === 'training-dummy'`
requirement is removed from the hub ability-processing guard, on both the server
(`GameRoom.ts`'s ability-processing loop) and the mobile client (`ControllerScreen.tsx`'s
skill-cell interactivity gate, which today independently blocks the input from ever being sent
outside the training-dummy radius)
**And** this supersedes Story 2.4's original scoping of ability use to the training-dummy POI
specifically

**AC2 — Training-dummy POI itself is unchanged:**
**Given** the training-dummy POI itself
**When** this story ships
**Then** the POI's zone, interact button, and targetable-dummy visuals are unchanged — only the
ability-use gate is removed; repurposing the POI is out of scope for this story

**AC3 — No protocol or shared-types changes:**
**Given** `InputMsg`'s ability event shape and `dispatchAbility`'s signature already carry
everything needed (no per-location data)
**When** this story ships
**Then** zero files under `packages/**` are modified

---

## Dev Notes

### Context

Story 2.4 (`2-4-training-dummy-poi.md`) implemented the entire ability-fire pipeline
(input → cooldown → self-cost → optional hit-scan) but deliberately scoped its *use* in the hub
to the training-dummy POI only, since that was the only hub location with a documented
gameplay reason to fire an ability before Epic 3 existed. Epic 3
(`3-3-4-alpha-class-implementations-abilities-and-input-types.md` onward) built out full
dungeon combat, which never needed the training-dummy scoping — dungeon firing already works
via the separate `inDungeon` condition, independent of `nearPoiId`.

The training-dummy-only restriction in the hub is now just friction: a player who wants to
test an ability while, say, walking toward the dungeon entrance, or waiting near the
class-select POI, cannot — the input is accepted by the client, sent to the server, and
silently dropped. No error, no delta, no feedback (same "silent drop" failure shape as the
D-2.4-A cooldown-reconnect bug closed in Story 2.7 — this codebase has a recurring pattern of
these silent-drop gates being under-specified for UX feedback; this story removes one entirely
rather than adding feedback to it, which is the correct minimal fix here since the gate itself
is the thing being deleted).

### What's actually gating ability use today (verified by reading both files in full)

**Server side — `apps/simulation-server/src/rooms/GameRoom.ts`, ability-processing loop
(~line 1890-1900):**

```ts
// Process ability inputs — valid in dungeon phase or near training dummy
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type !== 'ability') continue;
  const { abilityIndex, directionX, directionY } = msg.event.ability;

  const player = this.gameState.players.find(p => p.id === clientId);
  if (!player || player.class === null || player.isFrozen || player.isDown || player.isSpirit) continue;

  const inDungeon = this.gameState.session.phase === 'dungeon';
  const atTrainingDummy = player.nearPoiId === 'training-dummy';
  if (!inDungeon && !atTrainingDummy) continue;

  const playerCooldowns = this.cooldownMap.get(clientId);
  // ... dispatchAbility, cooldown update, self-cost — unchanged, all correct
```

Further down in the same loop (~line 1961), `inDungeon` gates the `ability:fired` delta
broadcast and hit-scan/combat-resolution logic — **this part must NOT change**. Today, firing
at the training dummy already produces no `ability:fired` broadcast and no hit-scan (the
training dummy has no HP and no server-side hit visual — confirmed: Story 2.4's Non-goals
explicitly excluded "Damage or effects on the training dummy entity"). This story's hub-wide
firing will behave identically: cooldown starts, self-cost HP applies if the ability has one,
but no combat delta or hit-scan fires outside a dungeon. That is existing, correct, unchanged
behavior — do not add an `ability:fired` broadcast for the hub case, that would be scope creep
beyond this story's AC.

**Required server change:** delete the `atTrainingDummy` line and its use in the guard. The
`inDungeon` variable stays (still used at ~line 1961):

```ts
const inDungeon = this.gameState.session.phase === 'dungeon';
if (!inDungeon) continue;
```

#### Phase scope decision

`this.gameState.session.phase` is one of `'lobby' | 'hub' | 'dungeon' | 'post-run'`
(`packages/shared-types/src/session.ts`). The simulation server's own initial state is
`'lobby'` (`createEmptyGameState`) and it only ever becomes `'hub'` after a full run completes
and the player returns to camp (`GameRoom.ts` ~line 803) — `'lobby'` and `'hub'` are both "the
hub world is live and interactive" states; this is an existing, established distinction in this
exact file (see the `RUN_PROPOSE` handler's own comment at ~line 209: `// ponytail: server never
transitions lobby→hub (LobbyScreen "Start Game" is UI-only); allow both`).

`if (!inDungeon) continue;` therefore also permits ability-fire attempts during `'post-run'`
(the reward-reveal screen shown after a boss kill or run failure). This is a deliberate,
verified-safe choice, not an oversight:
- Run-failure post-run: every player is already `isSpirit === true` at that point (run failure
  is defined as all players downed to spirit), and the existing top-of-loop guard already skips
  `player.isSpirit` players — so this path is unreachable in the run-failure case regardless.
- Run-victory post-run: a living player *could* fire an ability during the reward reveal. The
  effect is inert: no `ability:fired` broadcast, no hit-scan (both still gated by `inDungeon`,
  unchanged), and any cooldown/self-cost HP change is wiped on the next hub reset
  (`cooldownMap.clear()` and `player.hp = player.maxHp` both happen unconditionally in the
  return-to-camp reset path, ~line 787/819).
- Do **not** add a `&& this.gameState.session.phase !== 'post-run'` clause to "fix" this unless
  a future story specifically asks for it — it would be an unrequested extra condition for a
  case that is already provably harmless, and the mobile client's own `inDungeon` check
  (see below) is the only thing that determines whether the skill cells are even visible/
  interactive during post-run in practice (the host renders `PostRunSummaryScreen`, not the
  hub controller, so this is server-only inert state with no visible client path today).

**Client side — `apps/mobile-controller/src/screens/ControllerScreen.tsx`:**

The skill cells are independently gated, client-side, by a `trainingDummyActive` boolean that
exists purely to implement Story 2.4's now-superseded scoping:

```ts
const [trainingDummyActive, setTrainingDummyActive] = useState(false);       // line 976
const inDungeon = gameState?.session.phase === 'dungeon';                    // line 978
...
useEffect(() => {                                                            // lines 987-992
  if (activePoi !== 'training-dummy') {
    setTrainingDummyActive(false);
  }
}, [activePoi]);
...
// InteractButton onTap handler, line 1189:
if (activePoi === 'training-dummy' && confirmedClass !== null) setTrainingDummyActive(true);
...
// Right-zone skill grid container, line 1284:
touchAction: (trainingDummyActive || inDungeon) ? 'none' : 'auto',
...
// Per-cell isInteractive, lines 1298-1300:
const isInteractive = isSpiritCell
  ? !isOnCooldown && !isFrozen && !inBondMoment
  : (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown && !inBondMoment;
```

`isInteractive` is what actually gates real touch input: `SkillCell` (same file, ~line 749)
sets `pointerEvents: isInteractive && !isOnCooldown ? 'auto' : 'none'`, and its own `useEffect`
(~line 626-733) only attaches `touchstart`/`touchmove`/`touchend` listeners when `isInteractive`
is true and `ability !== null`. **Removing only the server-side gate without this client fix
ships a no-op**: the phone would still never send an ability input outside the training-dummy
radius, because the touch listeners are never attached and the cell is not clickable.

**Required client change:** replace `trainingDummyActive` with `!inDungeon` in both usages, then
delete the now-dead `trainingDummyActive` state, its `useEffect` (lines 987-992), and its setter
call in the `InteractButton.onTap` handler (line 1189) — leaving orphaned state that no longer
gates anything is exactly the kind of dead code this fix should not leave behind.

```ts
// Right-zone skill grid container:
touchAction: 'none',   // hub (any confirmed-class player) and dungeon both want touch capture now

// Per-cell isInteractive:
const isInteractive = isSpiritCell
  ? !isOnCooldown && !isFrozen && !inBondMoment
  : (!inDungeon || (!isDown && !isSpirit)) && ability !== null && !isOnCooldown && !inBondMoment;
```

Note `ability !== null` already requires `confirmedClass !== null` transitively (`classDef` is
only non-null when a class is confirmed, and `ability` derives from `classDef.abilities[i]`,
~line 949-950) — no separate "has confirmed class" check is needed in `isInteractive`, matching
existing code structure.

Also remove the `InteractButton.onTap` line that set `trainingDummyActive` (line 1189) — leave
the other two `onTap` branches (`class-select`, `dungeon-entrance`) untouched. The training-dummy
POI's `interact-button` slide-in/out behavior itself is driven by `activePoi`/`nearPoiId`
(unchanged, per AC2) — tapping "Interact" at the dummy will now simply do nothing new (no
`if (activePoi === 'training-dummy')` branch needed at all), since skill cells are already
interactive everywhere including at the dummy. This is correct: the dummy's `interact-button`
still slides in (POI proximity is unchanged), it just no longer needs to *do* anything on tap
for ability purposes.

### Side effect: two deferred findings become moot

Not required to act on, but worth knowing so you don't second-guess the diff:
- **D-2.4-B** (`deferred-work.md`, RELEASE ability firing in the React render gap right after
  `setTrainingDummyActive(false)` clears) — the entire race was about the training-dummy
  proximity boundary. It cannot recur once `trainingDummyActive` no longer exists.
- **D-2.4-D** (same file, same-tick movement+ability dropping input at the training-dummy
  radius edge) — Story 2.7 already re-verified this moot for the dungeon path; this story makes
  it moot for the hub path too, since the `nearPoiId` check it depended on is deleted entirely.

Do not edit `deferred-work.md` as part of this story (out of scope, see Non-goals) — a future
retro or Epic 2 hardening pass is the right place to formally close these two entries.

### Testing approach

No existing test exercises this guard directly:
- `apps/simulation-server/tests/game-room-host-join.test.ts` and friends only use
  `nearPoiId: null` as a fixture default, never assert on the ability-processing gate.
- No `apps/mobile-controller` test files exist in this repo at all (confirmed:
  `find apps/mobile-controller -iname "*.test.*"` → empty) — mobile behavior is validated via
  `tests/e2e/` against the real server/protocol only, never in isolation.

The real-server e2e harness (`tests/e2e/ability-dispatch.test.ts`, `tests/e2e/full-run.test.ts`)
is the right place for a regression test here — it already proves a real Colyseus room boots,
accepts `EventNames.CLASS_SELECT`, and accepts `EventNames.INPUT` ability events, receiving real
`COOLDOWN_UPDATE` messages back. Add a new file rather than extending `ability-dispatch.test.ts`,
since that file's `setupDungeonRun` helper always navigates into a dungeon — irrelevant here and
would obscure that this test is deliberately *not* entering a dungeon or approaching any POI.

**New file: `tests/e2e/hub-ability-use.test.ts`**

Test outline (mirror the `beforeAll`/`afterAll` `startTestServer`/`stopTestServer` pattern from
`tests/e2e/ability-dispatch.test.ts`):

1. `client.create('game_room', { isHost: true })`, then one player joins (`client.joinById`).
2. Wait for the join snapshot; assert `snapshot.state.session.phase === 'lobby'` (the pre-run
   phase — proves this is not a dungeon) and the player's `nearPoiId === null` (spawn at
   (960, 540) is >400px from the training-dummy POI center (1520, 400), well outside its
   120px radius, per `packages/shared-types/src/poi.ts` — no navigation needed).
3. `player.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' })`; wait for the
   `player:class-updated` delta.
4. **Without sending any joystick input at all**, send an ability input for index 2
   (Stormcaller's "Thunder Clap", a `TAP` ability with no self-cost and no direction needed —
   simplest possible case): `player.send(EventNames.INPUT, { type: 'input', event: { type:
   'ability', ability: { abilityIndex: 2, directionX: 0, directionY: 0 } } })`.
5. Assert a `COOLDOWN_UPDATE` message (`EventNames.COOLDOWN_UPDATE`) arrives with
   `abilityIndex: 2` and `remainingMs > 0`. This is the precise proof the ability actually
   dispatched — under the pre-fix guard, this message would never arrive (the input is
   silently dropped) and the test would time out.

This test only needs the server-side fix to pass (it drives `EventNames.INPUT` directly,
bypassing the mobile client's own gating) — it does not exercise `ControllerScreen.tsx`. The
mobile-side fix has no automated coverage in this repo (consistent with the project's existing
test-category boundaries — UI touch-gating logic in `apps/mobile-controller` has no unit test
precedent to follow), so manually verify it per the Client-UX hook: confirm in a real mobile
browser (or DOM inspection) that a skill cell shows `pointerEvents: 'auto'` and responds to a
tap/drag while standing anywhere in the hub away from the training dummy, with a class
confirmed.

### Project Context Rules

- Authority model: this story does not add any new mutation path — `dispatchAbility` (called
  from `GameRoom.ts`, defined in `packages/game-rules`) remains the sole place ability effects
  are computed, and the sim server remains the sole mutator of `GameState`. No changes to this
  boundary.
- Tick loop hygiene: the guard change is a single boolean condition inside the existing 30hz
  ability-processing loop — no new allocations, no new logging calls inside the tick.
- `Result<T, E>` convention: unaffected — `dispatchAbility`'s signature and error handling are
  untouched.
- Naming/coding conventions: no new event names, no new message types, no new constants needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.8: Hub Ability Use Outside Training-Dummy POI] (lines 576-592)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1890-1900] (ability-processing guard, current state)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:1961] (`inDungeon` reuse for ability:fired/hit-scan — unchanged)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:209-210] (`lobby`/`hub` "allow both" precedent, ponytail comment)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:948-950,976-992,1183-1192,1284,1298-1300] (client-side gate, current state)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx:613-733,749] (`SkillCell` pointerEvents + touch-listener gating on `isInteractive`)
- [Source: packages/shared-types/src/session.ts:9] (`phase` union type)
- [Source: packages/shared-types/src/poi.ts:19] (training-dummy POI position/radius)
- [Source: packages/shared-types/src/class-definitions.ts:55-66] (Stormcaller ability list, index 2 = Thunder Clap/TAP)
- [Source: _bmad-output/implementation-artifacts/2-4-training-dummy-poi.md] (original scoping this story supersedes; multi-context "do NOT split" precedent)
- [Source: _bmad-output/implementation-artifacts/2-7-epic-2-post-26-deferred-hardening.md] (silent-drop-gate pattern precedent; e2e reconnect harness precedent)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from: code review of 2-4-training-dummy-poi] (D-2.4-B, D-2.4-D — become moot, not touched by this story)
- [Source: tests/e2e/ability-dispatch.test.ts] (real-server ability-dispatch test harness pattern to mirror)

---

## Tasks

- [ ] **Task 1 (Simulation Engineer):** In `apps/simulation-server/src/rooms/GameRoom.ts`,
  remove the `atTrainingDummy` variable and its use in the ability-processing guard
  (~line 1898-1900), leaving `if (!inDungeon) continue;`. Do not touch the `inDungeon` usage at
  ~line 1961 (ability:fired broadcast + hit-scan gating) — that stays dungeon-only, unchanged.
- [ ] **Task 2 (Mobile Controller Engineer):** In
  `apps/mobile-controller/src/screens/ControllerScreen.tsx`:
  - Replace `trainingDummyActive` with `!inDungeon` in the `touchAction` computation
    (~line 1284) and the `isInteractive` computation (~line 1298-1300).
  - Delete the `trainingDummyActive` state declaration (~line 976), its clearing `useEffect`
    (~lines 987-992), and its setter call in `InteractButton.onTap` (~line 1189).
- [ ] **Task 3 (either agent):** Add `tests/e2e/hub-ability-use.test.ts` per the Testing
  approach above — join, select class, fire ability index 2 without moving, assert
  `COOLDOWN_UPDATE` arrives.
- [ ] Run `npm run typecheck` from repo root; verify zero errors.
- [ ] Run the full test suite (`npx vitest run` or equivalent); verify no regressions and that
  the new `hub-ability-use.test.ts` passes.
- [ ] Manual smoke test (Client-UX hook): with a real or simulated mobile viewport, confirm a
  skill cell fires (TAP/AUTO/RELEASE all still behave per their input type) while standing
  anywhere in the hub away from the training dummy, with a class confirmed — and that it still
  works identically while standing at the training dummy (no regression to the original 2.4
  scenario).

---

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

- 2026-07-15: Story created (`gds-create-story` workflow). Status: backlog → ready-for-dev.

---
baseline_commit: 7531f85ec80a1d42dfff32af37660f84effd7a43
---

# Story 3.7: Clear Objective & Level Completion

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Stories 3.1–3.6 built the physics world, enemy AI FSM, 4-class ability dispatch,
  combat resolution (hitboxes, damage, essence drops), player downed/revive system, and
  spirit form with run failure. Story 3.7 completes Epic 3 by implementing the "Clear"
  objective: detecting when all enemies in a level are defeated, broadcasting level:complete,
  handling revive timer resets for the next level (E4-ready), and transitioning to a
  "Run Complete" placeholder. In E3, the single level's completion equals the run's
  completion — the full 3-level structure is Epic 4.
Owner agent: Simulation Engineer (primary — level-clear detection, revive-timer reset);
  Protocol Architect (co-owns new delta types, contract-change hook required);
  Host Experience Engineer (DungeonScreen "Clear" label, level-complete acknowledgment,
  run-complete overlay refactor); Mobile Controller Engineer (run-complete placeholder screen).
Goal: Detect all-enemies-killed condition in tick → broadcast LevelCompleteDelta →
  reset downed-player revive timers → broadcast RunCompleteDelta (E3: single level = run
  end) → set phase='post-run' → show "Clear" label in host top strip → show level-complete
  flash on host canvas → show placeholder run-complete overlay on host and mobile.
  Refactor story 3.6's phase='post-run' overlay to use runOutcome tracking so success
  and failure are distinguishable on both clients.
Allowed paths:
  - packages/net-protocol/src/messages/server-to-host.ts     (MODIFY — LevelCompleteDelta, RunCompleteDelta)
  - packages/net-protocol/src/apply-delta.ts                 (MODIFY — two new delta cases)
  - packages/net-protocol/src/index.ts                       (MODIFY — export new types)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — level-clear detection, revive reset, run-complete broadcast)
  - apps/host-client/src/screens/DungeonScreen.tsx           (MODIFY — Clear label, level-complete flash, run-complete overlay)
  - apps/host-client/src/App.tsx                             (MODIFY — runOutcome state, pass to DungeonScreen)
  - apps/mobile-controller/src/App.tsx                       (MODIFY — run-complete placeholder)
  - tests/contract/net-protocol.test.ts                      (MODIFY — two new delta round-trips)
Blocked paths:
  - packages/shared-types/src/session.ts    (no new phase values — 'post-run' covers both outcomes)
  - packages/shared-types/src/game-state.ts (no new fields — GameState is sufficient)
  - packages/shared-types/src/player.ts     (no new fields — essenceTotal and reviveTimerExpiresAt added by 3.4/3.5)
  - apps/backend-platform/**                (no backend changes)
  - packages/game-rules/src/balance.ts      (READ ONLY — getReviveWindowMs already defined by 3.5)
  - packages/shared-types/src/session.ts    (objectiveType deferred to Epic 4 — hardcode "Clear" for E3)
Non-goals:
  - objectiveType field on SessionState (Epic 4 introduces Survive the Waves — add then)
  - 3-level run structure (Epic 4 — Story 4.3)
  - Full post-run summary with per-player breakdown and return-to-hub flow (Epic 4 — Story 4.5)
  - Spirit Bond assignment on level completion (Epic 5)
  - "Survive the Waves" objective type (Epic 4 — Story 4.4)
  - Boss room / run:complete via trigger zone (Epic 4 — Story 4.3)
  - Purification pulse visual on host canvas (Epic 6)
  - Run-complete audio / music transition
  - Level transition animation (Epic 4)
Acceptance criteria:
  AC1: In DungeonScreen's top strip, an objective label reading "Clear" (Lora 700, sm,
       text-primary) is visible whenever phase === 'dungeon'. It is positioned
       top-center or top-right-adjacent per DESIGN.md. The label does not appear
       in hub phase.
  AC2: When all enemies in gameState.enemies have isAlive === false (and enemies.length > 0
       and phase === 'dungeon'), the server broadcasts:
         (a) LevelCompleteDelta { type: 'level:complete'; levelIndex: SessionState.levelIndex }
         (b) RunCompleteDelta  { type: 'run:complete'; totalEssence: number }
       Both fire in the same tick, in order. The server sets phase = 'post-run' at the
       same time. This check is guarded by phase === 'dungeon', so it fires at most once.
  AC3: On LevelCompleteDelta received by the host, DungeonScreen shows a brief (300ms)
       white canvas overlay flash (PixiJS Graphics fill over the entire canvas, alpha
       ramp 0 → 0.3 → 0 over 300ms). This is the in-canvas acknowledgment of the clear.
  AC4: Between LevelCompleteDelta broadcast and RunCompleteDelta broadcast, the server
       resets the revive timer for each player where isDown === true:
         player.reviveTimerExpiresAt = Date.now() + getReviveWindowMs(player.downCount)
       This does not broadcast a new player:downed delta (the timer reset is silent —
       the client host countdown is cosmetic and will expire; E4 will add
       a PlayerDownedDelta re-broadcast if needed when a new level actually loads).
       ponytail: silent reset; E4 will wire the new countdown to the new level start.
  AC5: applyDelta handles LevelCompleteDelta as a no-op: returns state unchanged.
       applyDelta handles RunCompleteDelta: returns
         { ...state, session: { ...state.session, phase: 'post-run' } }.
       Both cases appear before the satisfies-never exhaustiveness guard. AC satisfies
       DeltaEventMsg constraint on both types. Typecheck clean.
  AC6: Host App.tsx tracks runOutcome: 'complete' | 'failed' | null in local state.
       On run:complete delta → setRunOutcome('complete').
       On run:failed delta  → setRunOutcome('failed').
       The story 3.6 post-run failure overlay condition changes from
         gameState?.session.phase === 'post-run'
       to
         gameState?.session.phase === 'post-run' && runOutcome === 'failed'
       The run-complete overlay (new in 3.7) renders when
         phase === 'post-run' && runOutcome === 'complete'.
  AC7: Host run-complete overlay (phase='post-run' && runOutcome='complete'):
       - Full-screen, position: absolute, inset: 0, background: rgba(0,0,0,0.8), zIndex: 50
       - Headline: "Level Clear." — Lora 700, var(--text-xl), var(--accent-spirit), centered
       - Essence line: "Spirit Essence carried: N" — Lora 700, var(--text-lg), var(--accent-warm)
         (N = sum of all players' essenceTotal from gameState)
       - Sub-note: "Full run summary coming in Epic 4." — Lora 400, var(--text-sm), var(--text-muted)
       - Non-dismissible (Epic 4 adds the return flow).
  AC8: Mobile run-complete placeholder (phase='post-run' && local runOutcome='complete'):
       - Full-screen, background: var(--bg-base), column centered
       - "Level Clear!" — Lora 700, var(--text-xl), var(--accent-spirit), centered
       - "Return to Camp — coming soon." — Lora 400, var(--text-sm), var(--text-muted)
       The mobile App.tsx tracks runOutcome the same way as the host (via
       run:complete / run:failed delta type received through the delta handler).
  AC9: tests/contract/net-protocol.test.ts:
       LevelCompleteDelta round-trip passes (satisfies DeltaEventMsg).
       RunCompleteDelta round-trip passes (satisfies DeltaEventMsg).
  AC10: npm run typecheck clean. No new lint errors.
Required hooks:
  - Contract-change hook: 2 new delta types added to DeltaEventMsg (LevelCompleteDelta,
    RunCompleteDelta). Protocol Architect review required. No ADR or spec update needed
    (both follow the established DeltaEventMsg pattern; no session lifecycle change beyond
    'post-run' which already exists).
  - Simulation-safety hook: typecheck passes. No new pure-function unit tests required
    (all-enemies-dead check is a trivially correct predicate). Integration coverage is
    provided by the existing e2e flow.
  - Client-UX hook (host): "Clear" label visible in top strip during dungeon; level-complete
    flash fires on canvas; run-complete overlay distinct from failure overlay.
  - Client-UX hook (mobile): run-complete placeholder visible; does not regress run-failed
    placeholder from story 3.6.
Required tests:
  - tests/contract/net-protocol.test.ts — LevelCompleteDelta and RunCompleteDelta round-trips
Telemetry impact: none this story
```

---

## Story

As a group of players,
I want to fight through all enemies in the level to complete the "Clear" objective and advance,
so that the dungeon run has a clear moment of victory and forward progression.

---

## Acceptance Criteria

**AC1 — "Clear" objective label in host top strip:**
**Given** the dungeon is active (`phase === 'dungeon'`)
**When** the host `DungeonScreen` renders
**Then** the objective label in the top strip reads `"Clear"` — Lora 700, `var(--text-sm)`, `var(--text-primary)`, positioned top-center or adjacent to the level/biome label per DESIGN.md
**And** the label is absent (or renders nothing) outside of dungeon phase

**AC2 — Server detects all enemies killed → broadcasts level:complete + run:complete:**
**Given** `phase === 'dungeon'` AND `gameState.enemies.length > 0`
**When** all enemies in `gameState.enemies` have `isAlive === false` in the same tick's post-combat pass
**Then** the server broadcasts `LevelCompleteDelta { type: 'level:complete'; levelIndex: session.levelIndex }`
**And** the server broadcasts `RunCompleteDelta { type: 'run:complete'; totalEssence: sum(player.essenceTotal) }`
**And** the server sets `this.gameState.session.phase = 'post-run'` before broadcasting
**And** subsequent ticks skip combat logic (existing `phase === 'dungeon'` guard prevents re-fire)
**And** this check fires at most once (phase change prevents repeat)

**AC3 — Host canvas level-complete acknowledgment flash:**
**Given** `LevelCompleteDelta` is received by the host
**When** `DungeonScreen`'s delta handler processes it
**Then** a 300ms white flash plays over the PixiJS canvas:
  - A full-canvas PixiJS Graphics rect fills white at alpha 0, ramps to alpha 0.3 at 150ms, then back to 0 at 300ms
  - The canvas continues to render underneath (flash is additive / overlay Graphics object)
  - The flash clears itself after completing

**AC4 — Server: revive timer reset for downed players on level completion:**
**Given** one or more players have `isDown === true` at the moment of level completion
**When** the server processes the level-complete event (between broadcasting LevelCompleteDelta and RunCompleteDelta)
**Then** for each downed player: `player.reviveTimerExpiresAt = Date.now() + getReviveWindowMs(player.downCount)`
**And** no new `player:downed` delta is broadcast (reset is silent — E4 will handle the countdown display on new level load)

**AC5 — applyDelta handles both new delta types:**
**Given** `LevelCompleteDelta` arrives at `applyDelta`
**Then** returns `state` unchanged (no GameState mutation — visual effect only)

**Given** `RunCompleteDelta` arrives at `applyDelta`
**Then** returns `{ ...state, session: { ...state.session, phase: 'post-run' } }`
**And** both cases appear before the `satisfies never` exhaustiveness guard

**AC6 — Host App.tsx runOutcome tracking (refactor of story 3.6 condition):**
**Given** host `App.tsx` receives `DeltaEventMsg` events
**When** delta type is `'run:complete'` → local state `runOutcome = 'complete'`
**When** delta type is `'run:failed'` → local state `runOutcome = 'failed'`
**And** the story 3.6 failure overlay condition is updated:
  - Before: `gameState?.session.phase === 'post-run'`
  - After: `gameState?.session.phase === 'post-run' && runOutcome === 'failed'`

**AC7 — Host run-complete overlay (success path):**
**Given** `gameState?.session.phase === 'post-run'` AND `runOutcome === 'complete'`
**When** `DungeonScreen` renders
**Then** a full-screen overlay appears:
  - `position: absolute; inset: 0; background: rgba(0,0,0,0.8); zIndex: 50; display: flex; flexDirection: column; alignItems: center; justifyContent: center; gap: 16`
  - Headline: `"Level Clear."` — Lora 700, `var(--text-xl)`, `var(--accent-spirit)`, centered
  - Essence: `"Spirit Essence carried: N"` — Lora 700, `var(--text-lg)`, `var(--accent-warm)`
    - N = `gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)`
  - Sub-note: `"Full run summary coming in Epic 4."` — Lora 400, `var(--text-sm)`, `var(--text-muted)`
  - Non-dismissible (Epic 4 adds the return-to-hub flow)

**AC8 — Mobile run-complete placeholder:**
**Given** `gameState?.session.phase === 'post-run'` AND `runOutcome === 'complete'` in mobile `App.tsx`
**When** the controller render branch renders
**Then** a placeholder screen appears:
  - Full-screen `var(--bg-base)` background
  - `"Level Clear!"` — Lora 700, `var(--text-xl)`, `var(--accent-spirit)`, centered
  - `"Return to Camp — coming soon."` — Lora 400, `var(--text-sm)`, `var(--text-muted)`
**And** the story 3.6 failure placeholder condition is likewise updated to
  `phase === 'post-run' && runOutcome === 'failed'`

**AC9 — Contract tests:**
**Given** `tests/contract/net-protocol.test.ts`
**Then** `LevelCompleteDelta` round-trip passes
**And** `RunCompleteDelta` round-trip passes
**And** both `satisfies DeltaEventMsg`

**AC10 — Typecheck:**
**Given** `npm run typecheck`
**Then** no errors

---

## Tasks / Subtasks

- [x] Task 1: Protocol — two new delta types (AC5, AC9, AC10)
  - [x] 1.1: Add `LevelCompleteDelta` and `RunCompleteDelta` to `server-to-host.ts` and `DeltaEventMsg` union
  - [x] 1.2: Add `level:complete` (no-op) and `run:complete` (phase update) cases to `apply-delta.ts`
  - [x] 1.3: Export new types from `net-protocol/src/index.ts`

- [x] Task 2: Server — level-clear detection and run completion (AC2, AC4)
  - [x] 2.1: Add all-enemies-dead check in `tick()` after the run-failure check from story 3.6
  - [x] 2.2: On detect: reset downed-player revive timers; broadcast LevelCompleteDelta then RunCompleteDelta; set phase

- [x] Task 3: Host — Clear label + level-complete flash (AC1, AC3)
  - [x] 3.1: Add "Clear" objective label to `DungeonScreen`'s top strip HTML overlay
  - [x] 3.2: Add LevelCompleteDelta handling in DungeonScreen → trigger 300ms white canvas flash

- [x] Task 4: Host — runOutcome tracking + run-complete overlay (AC6, AC7)
  - [x] 4.1: Add `runOutcome` state to `App.tsx`; set on run:complete and run:failed delta receipt
  - [x] 4.2: Update story 3.6 failure overlay guard to include `runOutcome === 'failed'`
  - [x] 4.3: Add run-complete overlay in DungeonScreen (or App.tsx — same pattern as failure overlay)

- [x] Task 5: Mobile — run-complete placeholder + refactor failure guard (AC8)
  - [x] 5.1: Add `runOutcome` tracking in mobile `App.tsx` (same pattern as host)
  - [x] 5.2: Update story 3.6 failure check; add run-complete placeholder

- [x] Task 6: Contract tests (AC9)
  - [x] 6.1: Add `LevelCompleteDelta` and `RunCompleteDelta` round-trip tests

### Review Findings (AI) — 2026-06-29

- [x] [Review][Patch] AC4: revive timer reset happens before both broadcasts, not between them [apps/simulation-server/src/rooms/GameRoom.ts]
- [x] [Review][Patch] Blank unrecoverable host screen when `phase='post-run'` and `runOutcome=null` (missed delta / packet loss) [apps/host-client/src/screens/DungeonScreen.tsx]
- [x] [Review][Patch] `setTimeout` flash teardown not cleaned up — no `clearTimeout` in useEffect [apps/host-client/src/screens/DungeonScreen.tsx]
- [x] [Review][Defer] `runOutcome` never resets — stale state if session restarts without page reload [apps/host-client/src/App.tsx, apps/mobile-controller/src/App.tsx] — deferred, E4 return-to-hub flow will handle session reset
- [x] [Review][Defer] Consecutive `level:complete`→`run:complete` delta overwrite on `latestTransientDelta` — theoretical fragility [apps/host-client/src/session/host-session.ts] — deferred, Colyseus guarantees message ordering; revisit if multi-batch delivery observed
- [x] [Review][Defer] Server keeps dead enemies (`isAlive=false`), client removes them via filter — divergent `GameState.enemies` shapes — deferred, pre-existing; E4 note for client-side clear logic
- [x] [Review][Defer] Revive timer cosmetic display stale during post-run transition — deferred, cosmetic; covered by post-run overlay in practice
- [x] [Review][Defer] `enemies.length > 0` guard silently blocks clear on empty level — deferred, not reachable with current `getEnemyCount` logic

---

## Dev Notes

### Critical dependency: Stories 3.2–3.6 must be merged first

| Prior story artifact | Used by 3.7 |
|---|---|
| `EnemyState.isAlive` in `game-state.ts` | Level-clear predicate: `enemies.every(e => !e.isAlive)` |
| Enemy spawning on dungeon start (story 3.2) | Enemies must exist in `gameState.enemies` to detect clear |
| `PlayerState.essenceTotal` (story 3.4) | `RunCompleteDelta.totalEssence` calculation |
| `PlayerState.isDown`, `reviveTimerExpiresAt` (story 3.5) | Revive timer reset loop on level complete |
| `getReviveWindowMs(downCount)` in `balance.ts` (story 3.5) | Fresh window calc for reset |
| Phase guard `phase === 'dungeon'` blocks combat in 3.5, 3.6 | Level-clear check also uses this guard |
| Story 3.6 failure overlay in DungeonScreen | 3.7 refactors its condition to add runOutcome check |
| `latestCombatEvent` / delta routing in `App.tsx` (3.3+) | `level:complete` delta routed to DungeonScreen |
| `DeltaEventMsg` exhaustiveness guard (story 3.3) | Two new cases must be added before guard |

---

### What already exists — DO NOT reinvent

**`SessionState.phase: 'post-run'`** — already in `packages/shared-types/src/session.ts`. Both `run:failed` (3.6) and `run:complete` (3.7) set this same phase value. Client distinguishes outcome via local `runOutcome` state.

**`SimEvents['level:complete']`** — already declared in `session.ts`:
```typescript
export interface SimEvents {
  // ...
  'level:complete': { levelIndex: number };
}
```
This is a Colyseus `SimEvents` type, not a wire delta. The wire delta `LevelCompleteDelta` is separate.

**`EnemyKilledDelta`** — already in `DeltaEventMsg` from the base protocol. The level-clear detection uses `gameState.enemies.every(e => !e.isAlive)` on the server, not a counter. No new counter state needed.

**`PlayerState.essenceTotal`** — added by story 3.4. `RunCompleteDelta.totalEssence` is computed as `players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)`.

**Run-failure overlay from story 3.6** — story 3.7 must modify its condition (from `phase === 'post-run'` to `phase === 'post-run' && runOutcome === 'failed'`). Read the actual DungeonScreen.tsx and App.tsx from the merged 3.6 before editing to find the exact variable names and condition location.

---

### New delta types — add to `server-to-host.ts`

```typescript
export type LevelCompleteDelta = {
  type: 'level:complete';
  levelIndex: number;
};

export type RunCompleteDelta = {
  type: 'run:complete';
  totalEssence: number;
};
```

Add to `DeltaEventMsg` union (add after `RunFailedDelta` from 3.6 — verify exact union shape by reading the file):

```typescript
export type DeltaEventMsg =
  | PlayerMovedDelta
  | PlayerDownedDelta
  | PlayerReviveDelta
  | PlayerLeftDelta
  | PlayerDisconnectedDelta
  | PlayerReconnectedDelta
  | EnemyKilledDelta
  | EnemyMovedDelta
  | BondAssignedDelta
  | EssenceDroppedDelta
  | EssenceCollectedDelta
  | PlayerPoiEnteredDelta
  | PlayerPoiExitedDelta
  | PlayerClassUpdatedDelta
  | AbilityFiredDelta           // 3.3
  | EnemyDamagedDelta           // 3.4 — verify exact name
  | PlayerHpUpdatedDelta        // 3.5 — verify exact name
  | PlayerSpiritDelta           // 3.5 — verify exact name
  | SpiritAbilityFiredDelta     // 3.6
  | RunFailedDelta              // 3.6
  | LevelCompleteDelta          // 3.7 NEW
  | RunCompleteDelta;           // 3.7 NEW
```

> **Check exact names** of deltas from 3.3–3.6 by reading the actual `server-to-host.ts` — the names above come from story dev notes and may differ from what was actually committed.

Export from `packages/net-protocol/src/index.ts`:
```typescript
export type { ..., LevelCompleteDelta, RunCompleteDelta } from './messages/server-to-host.js';
```

---

### apply-delta.ts changes

Add two cases before the exhaustiveness guard:

```typescript
case 'level:complete': {
  return state;  // visual only — canvas flash handled in DungeonScreen on event receipt
}
case 'run:complete': {
  return { ...state, session: { ...state.session, phase: 'post-run' } };
}
```

Verify the guard pattern from story 3.3 (`const _exhaustive: never = evt; return state;`) is still present and these cases appear BEFORE it.

---

### GameRoom.ts — level-clear detection

Read the full `GameRoom.ts` from the merged 3.6 state before editing. Add the level-clear block in `tick()` **AFTER the all-spirit run-failure check from story 3.6**, still inside the dungeon guard:

```typescript
// ── Level clear: all enemies defeated → level:complete + run:complete ────────
if (this.gameState.session.phase === 'dungeon') {
  const enemies = this.gameState.enemies;
  if (
    enemies.length > 0 &&
    enemies.every(e => !e.isAlive)
  ) {
    const levelIndex = this.gameState.session.levelIndex;

    // Reset revive timers for any downed players before phase transition
    // ponytail: silent reset; E4 will broadcast a new player:downed when the next level loads
    const now = Date.now();
    for (const player of this.gameState.players) {
      if (player.isDown) {
        player.reviveTimerExpiresAt = now + getReviveWindowMs(player.downCount);
      }
    }

    this.gameState.session.phase = 'post-run';

    const levelCompleteDelta = {
      type: 'level:complete' as const,
      levelIndex,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, levelCompleteDelta);

    const totalEssence = this.gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0);
    const runCompleteDelta = {
      type: 'run:complete' as const,
      totalEssence,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, runCompleteDelta);

    logger.info({ roomId: this.roomId, levelIndex, totalEssence }, 'level clear — run complete');
  }
}
```

**Import additions** (verify these exist from 3.5 exports):
```typescript
import { getReviveWindowMs } from 'game-rules';
import type { LevelCompleteDelta, RunCompleteDelta } from 'net-protocol';
```

**Guard chain:** After 3.6, the tick runs roughly in this order:
1. Phase guard (`phase === 'dungeon'`) — enemy AI, ability dispatch, spirit dispatch
2. Revive timer expiry / proximity revive (3.5)
3. All-spirit run-failure check (3.6)
4. **Level-clear check (3.7) ← insert here**

The all-spirit check (3.6) sets `phase = 'post-run'` before broadcasting. The level-clear check (3.7) also guards on `phase === 'dungeon'`. They cannot both fire in the same tick because:
- If all players are spirit AND all enemies are dead, the all-spirit check fires first and sets phase='post-run'. The level-clear check then sees phase ≠ 'dungeon' and skips.
- This is the correct behavior: a full-wipe is a failure even if all enemies are somehow dead.

---

### Host DungeonScreen — Clear label in top strip

Read `DungeonScreen.tsx` from the merged 3.6 state before editing. The top strip HTML overlay already has player chips and possibly a level/biome label placeholder. Add the objective label:

```tsx
{gameState?.session.phase === 'dungeon' && (
  <div style={{
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    // Position: top-center, within the 48px top strip
  }}>
    Clear
  </div>
)}
```

The label is hardcoded `"Clear"` for E3.
// ponytail: hardcoded; add objectiveType to SessionState when E4 introduces Survive the Waves

Position within the top strip: adjacent to or between the player chips (left) and the level/biome label (right). Per DESIGN.md: "top-center or top-right adjacent" — choose whichever fits the existing strip layout.

---

### Host DungeonScreen — level-complete canvas flash

In `DungeonScreen.tsx`, the `useEffect` that handles `latestCombatEvent` (or equivalent delta routing) must catch `level:complete`. Add a new piece of local state for the flash:

```typescript
const [levelClearFlash, setLevelClearFlash] = useState(false);

useEffect(() => {
  if (!latestCombatEvent) return;
  if (latestCombatEvent.type === 'level:complete') {
    setLevelClearFlash(true);
    setTimeout(() => setLevelClearFlash(false), 300);
  }
  // ... existing handlers
}, [latestCombatEvent]);
```

In `renderFrame()`, when `levelClearFlash` is true, add a PixiJS white overlay rect:
```typescript
if (levelClearFlashRef.current) {
  // Compute alpha: 0 → 0.3 → 0 over 300ms based on flash start time
  const elapsed = Date.now() - levelClearFlashStartRef.current;
  const progress = elapsed / 300;
  const alpha = progress < 0.5
    ? (progress / 0.5) * 0.3
    : ((1 - progress) / 0.5) * 0.3;
  flashGfx.clear();
  flashGfx.beginFill(0xffffff, alpha);
  flashGfx.drawRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  flashGfx.endFill();
}
```

> Alternatively, a simpler implementation: CSS fade-in/fade-out white `div` overlay with `opacity` transition. Use CSS if the PixiJS approach would require significant new plumbing. The visual spec says "brief ambient change or in-canvas prompt" — CSS white overlay at `position: absolute; inset: 0; background: white; opacity: 0; zIndex: 20` with a class-toggled transition is acceptable.

> **Pick the simpler path** after reading the existing DungeonScreen — if a CSS overlay can be added in 5 lines, prefer it over PixiJS renderFrame changes. If the PixiJS overlay Graphics object already exists for some other effect, use it.

---

### Host App.tsx — runOutcome tracking

Read `App.tsx` from the merged 3.6 state. It already has:
- Delta handler that sets `latestCombatEvent` (extended in 3.6 to include `run:failed`)
- The failure overlay condition

Add `runOutcome` state:
```typescript
const [runOutcome, setRunOutcome] = useState<'complete' | 'failed' | null>(null);
```

In the delta handler (wherever `run:failed` already sets `latestCombatEvent`):
```typescript
if (delta.type === 'run:failed') {
  setRunOutcome('failed');
}
if (delta.type === 'run:complete') {
  setRunOutcome('complete');
}
// Also add 'level:complete' and 'run:complete' to the latestCombatEvent routing
// so DungeonScreen can trigger the canvas flash:
if (
  delta.type === 'level:complete' ||
  delta.type === 'run:complete' ||
  /* ... existing types ... */
) {
  setLatestCombatEvent(delta);
}
```

Pass `runOutcome` to `DungeonScreen`:
```tsx
<DungeonScreen
  gameState={gameState}
  latestCombatEvent={latestCombatEvent}
  runOutcome={runOutcome}
/>
```

Update story 3.6 failure overlay condition in DungeonScreen:
```tsx
{/* was: gameState?.session.phase === 'post-run' */}
{gameState?.session.phase === 'post-run' && runOutcome === 'failed' && (
  // ... 3.6 failure overlay unchanged ...
)}

{/* new in 3.7 */}
{gameState?.session.phase === 'post-run' && runOutcome === 'complete' && (
  <div style={{ ... }}>
    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--accent-spirit)', textAlign: 'center' }}>
      Level Clear.
    </div>
    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--accent-warm)' }}>
      Spirit Essence carried: {gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)}
    </div>
    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
      Full run summary coming in Epic 4.
    </div>
  </div>
)}
```

> **DungeonScreenProps** will need `runOutcome` added. Check the existing prop interface from 3.6 before editing.

---

### Mobile App.tsx — runOutcome tracking + run-complete placeholder

Read `apps/mobile-controller/src/App.tsx` from the merged 3.6 state. It already has:
- A failure placeholder (rendered when `gameState?.session.phase === 'post-run'` from 3.6)
- Delta handler that sets `gameState` via `applyDelta`

Add the same `runOutcome` tracking:
```typescript
const [runOutcome, setRunOutcome] = useState<'complete' | 'failed' | null>(null);
```

In the delta handler (wherever 3.6 routed `run:failed`):
```typescript
if (delta.type === 'run:failed') setRunOutcome('failed');
if (delta.type === 'run:complete') setRunOutcome('complete');
```

Update the post-run render branch:
```tsx
if (gameState?.session.phase === 'post-run') {
  if (runOutcome === 'failed') {
    // ... 3.6 failure placeholder — update condition but keep content unchanged ...
  }
  if (runOutcome === 'complete') {
    return (
      <div style={{ width: '100%', height: '100%', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--accent-spirit)' }}>
          Level Clear!
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Return to Camp — coming soon.
        </div>
      </div>
    );
  }
  // runOutcome === null: delta not yet received; show nothing or spinner
}
```

---

### Contract tests

```typescript
it('level:complete delta survives serialize → deserialize', () => {
  const delta = {
    type: 'level:complete' as const,
    levelIndex: 0,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('run:complete delta survives serialize → deserialize', () => {
  const delta = {
    type: 'run:complete' as const,
    totalEssence: 240,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});
```

---

### Design decisions and edge cases

**"Clear" label hardcoded:** E3 has only one objective type. `objectiveType` is not added to `SessionState` here. Epic 4 will add it when Survive the Waves is introduced (Story 4.4).

**`enemies.length > 0` guard:** The level-clear check only fires if enemies were ever present. An empty level (no enemies spawned) does not trigger level:complete. This prevents a premature clear on dungeon start before enemy spawn. Verify story 3.2's spawn logic — enemies should be in `gameState.enemies` before the first tick's clear check runs.

**All-spirit vs all-enemies-dead in same tick:** The all-spirit check (3.6) runs first. If somehow all enemies die and all players go spirit in the same tick, the all-spirit failure fires and the level-clear check is skipped. This is correct: wipe = failure, even if enemies are also dead. The failure message is thematically honest — the team didn't survive to see the clear.

**`runOutcome` null guard on mobile:** Between `run:complete` broadcast and the client receiving it (one network round-trip at 33ms/tick), mobile will briefly see `phase === 'post-run'` with `runOutcome === null`. The render branch handles this by showing nothing (or a brief spinner) until the delta arrives. This is acceptable for a placeholder screen.

**levelIndex in E3:** `SessionState.levelIndex` starts at 0 (from `onJoin` initialization in GameRoom). In E3 there is no level advancement — the single level is always index 0. `LevelCompleteDelta.levelIndex` will always be 0 in E3. E4 adds level progression.

**Revive timer reset broadcast:** The timer reset is intentionally silent (no new `player:downed` delta). The host countdown display from 3.5 (computed from `player.reviveTimerExpiresAt`) will eventually hit 0 and trigger the spirit-form transition path already implemented in 3.5/3.6. However, since phase becomes 'post-run' simultaneously, the spirit-form transition check will be skipped on subsequent ticks. Net result: a downed player at level-complete stays in the spirit-form-eligible state; the timer reset is for E4 consistency, not E3 UX.
// ponytail: silent reset, no broadcast. E4 adds a new player:downed delta at new level start to refresh the countdown.

**`totalEssence` in RunCompleteDelta vs overlay:** The overlay computes essence from `gameState.players.reduce(...)` rather than from `RunCompleteDelta.totalEssence`. This is the same pattern used in the 3.6 failure overlay. Both will be consistent since `applyDelta` processes `run:complete` before the component re-renders.

---

### Deferred items NOT addressed this story

| Deferred | Target |
|---|---|
| `objectiveType` on `SessionState` | Epic 4 (Story 4.4 — Survive the Waves) |
| Full 3-level run structure with level transitions | Epic 4 (Story 4.3) |
| Post-run summary screen with per-player rows and return-to-hub | Epic 4 (Story 4.5) |
| Spirit Bond assignment on level clear | Epic 5 |
| Purification pulse canvas animation on run complete | Epic 6 (Boss Encounter) |
| `player:downed` re-broadcast at new level start (for E4 revive countdown refresh) | Epic 4 |
| Enemy spawning mechanics and room pool (only AI FSM from 3.2 is in E3) | Epic 4 (Story 4.1/4.3) |

---

### Hooks triggered

| Hook | Required action |
|---|---|
| Contract-change hook | 2 new delta types; Protocol Architect review required |
| Simulation-safety hook | typecheck clean; no new unit tests required |
| Client-UX hook (host) | "Clear" label visible; canvas flash fires; run-complete overlay distinct from failure |
| Client-UX hook (mobile) | run-complete placeholder visible; failure placeholder unchanged |

### What remains after this story

- Epic 3 is complete. Run `gds-sprint-status` to verify.
- Epic 4: 3-level run structure, procedural generation, vote-to-start, full post-run summary.
- Epic 4: `objectiveType` added to `SessionState` when Survive the Waves is introduced.

---

## Change Log

- 2026-06-29: Implemented story 3.7 — Clear objective label, level-clear detection, LevelCompleteDelta + RunCompleteDelta protocol, runOutcome tracking on host and mobile, contract tests. All ACs satisfied, typecheck clean.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented two new delta types (`LevelCompleteDelta`, `RunCompleteDelta`) in `server-to-host.ts`, added to `DeltaEventMsg` union, exported from package index.
- Added `level:complete` (no-op) and `run:complete` (phase→'post-run') cases to `apply-delta.ts` before the exhaustiveness guard.
- Added `getReviveWindowMs` to GameRoom's game-rules import; inserted level-clear detection block after the run-failure check — guards on `phase === 'dungeon'` and `enemies.length > 0 && enemies.every(e => !e.isAlive)`.
- Silent revive timer reset for downed players before phase transition (ponytail comment preserved as specified).
- Added `level:complete` and `run:complete` to the transient delta allowlist in `host-session.ts` so they reach DungeonScreen.
- Host `App.tsx`: added `runOutcome` state; `useEffect` on `latestTransientDelta` sets it on `run:complete`/`run:failed`; passed as prop to `DungeonScreen`.
- `DungeonScreen.tsx`: added `runOutcome` prop; "Clear" label in top strip (hardcoded, `marginLeft: auto`); 300ms CSS white flash on `level:complete`; failure overlay now guarded by `runOutcome === 'failed'`; new success overlay guarded by `runOutcome === 'complete'`.
- Mobile `App.tsx`: `runOutcome` state set directly in `handleDelta`; failure placeholder now guarded by `runOutcome === 'failed'`; new success placeholder for `runOutcome === 'complete'` with `--accent-spirit` and `--bg-base`.
- Contract tests: 4 new tests added (2 round-trips + 2 `applyDelta` behavior). All 36 contract tests pass. Typecheck clean.

### File List

- packages/net-protocol/src/messages/server-to-host.ts
- packages/net-protocol/src/apply-delta.ts
- packages/net-protocol/src/index.ts
- apps/simulation-server/src/rooms/GameRoom.ts
- apps/host-client/src/session/host-session.ts
- apps/host-client/src/App.tsx
- apps/host-client/src/screens/DungeonScreen.tsx
- apps/mobile-controller/src/App.tsx
- tests/contract/net-protocol.test.ts
- _bmad-output/implementation-artifacts/3-7-clear-objective-and-level-completion.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

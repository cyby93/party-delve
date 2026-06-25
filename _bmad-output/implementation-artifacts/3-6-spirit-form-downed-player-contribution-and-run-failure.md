---
baseline_commit: SET_TO_HEAD_AFTER_STORY_3_5_MERGE
---

# Story 3.6: Spirit Form — Downed Player Contribution & Run Failure

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Stories 3.1–3.5 built the physics world, enemy AI, class ability dispatch,
  combat resolution (abilities hit enemies, essence drops), and the player downed/revive
  system. Story 3.5 specifically built: player hp → 0 → player:downed delta with
  reviveTimerExpiresAt; timer expiry → player:spirit delta + SpiritFormMsg{isActive:true}
  to mobile; mobile cell 3 shows spirit ability name (locked preview) when isDown;
  host player chip pips, host revive-timer overlay. Story 3.6 activates the spirit form
  state: cell 3 becomes interactive for spirit players, spirit abilities dispatch to
  server, spirit-form characters render as luminous figures on the host canvas, and
  when all players are in spirit form simultaneously the server broadcasts run:failed
  → session.phase transitions to 'post-run' → placeholder failure state on both clients.
Owner agent: Simulation Engineer (primary — spirit ability dispatch, run failure tick
  logic); Mobile Controller Engineer (ControllerScreen cell 3 interactive unlock);
  Host Experience Engineer (DungeonScreen spirit form rendering + post-run routing);
  Protocol Architect co-owns all new/changed delta types (contract-change hook required).
Goal: Unlock mobile cell 3 when isSpirit; dispatch spirit ability input from server
  with per-player spirit cooldown; broadcast SpiritAbilityFiredDelta for in-canvas
  visual; render spirit-form players as luminous session-colored circles in PixiJS;
  detect all-spirit condition in tick → broadcast RunFailedDelta → set phase='post-run'
  → show placeholder failure state on host and mobile.
Allowed paths:
  - packages/game-rules/src/balance.ts                       (MODIFY — add SPIRIT_ABILITY_COOLDOWN_MS)
  - packages/net-protocol/src/messages/server-to-host.ts     (MODIFY — SpiritAbilityFiredDelta, RunFailedDelta)
  - packages/net-protocol/src/apply-delta.ts                 (MODIFY — new delta cases)
  - packages/net-protocol/src/index.ts                       (MODIFY — export new types)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — spiritCooldownMap, spirit dispatch, run failure)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — cell 3 interactive when isSpirit)
  - apps/host-client/src/screens/DungeonScreen.tsx           (MODIFY — spirit form rendering, post-run overlay)
  - apps/host-client/src/App.tsx                             (MODIFY — post-run routing)
  - apps/mobile-controller/src/App.tsx                       (MODIFY — post-run routing)
  - tests/contract/net-protocol.test.ts                      (MODIFY — new delta round-trips)
Blocked paths:
  - apps/backend-platform/**                         (no backend changes)
  - packages/shared-types/src/player.ts              (isSpirit already added in 3.5; no new player fields)
  - packages/shared-types/src/session.ts             (phase: 'post-run' already exists in SessionState)
  - packages/game-rules/src/systems/player-health.ts (owned by 3.5; do not touch)
  - apps/simulation-server/src/rooms/GameRoom.ts     (READ full file from 3.5 before editing)
Non-goals:
  - Per-class spirit ability effects (visual placeholder only — actual mechanics deferred to Epic 4+)
  - Full post-run summary screen with per-player breakdown (Epic 4)
  - Return to hub flow from post-run (Epic 4)
  - Spirit form audio/SFX
  - Near-wipe "last warrior standing" special host visual (Epic 4 polish)
  - Enemy attacks on spirit-form players (spirits are invulnerable)
  - Spirit form movement speed modifier (same speed as alive — no separate constant)
  - Essence collection by spirit-form players
  - Bond system interactions (Epic 5)
Acceptance criteria:
  AC1: When myPlayer.isSpirit === true in the mobile controller, skill cell 3 is
       interactive: the player can tap it to fire the spirit ability. The spirit
       ability has its own cooldown (SPIRIT_ABILITY_COOLDOWN_MS from balance.ts),
       displayed on cell 3 via the existing cooldown:update channel (abilityIndex=3).
       Cells 0–2 remain locked (non-interactive) in spirit form (unchanged from 3.5).
  AC2: When a spirit-form player fires cell 3, the server validates isSpirit, checks
       the spiritCooldownMap, and broadcasts SpiritAbilityFiredDelta
       { type: 'spirit-ability:fired', playerId, class } to all clients. The server
       sends COOLDOWN_UPDATE { abilityIndex: 3, remainingMs: SPIRIT_ABILITY_COOLDOWN_MS }
       to that player's mobile. The spirit cooldown expires and COOLDOWN_UPDATE
       { remainingMs: 0 } is sent when the expiry time passes.
  AC3: When all players in GameState.players have isSpirit === true (and playerCount > 0),
       the server broadcasts RunFailedDelta { type: 'run:failed', partialEssence: N }
       where partialEssence = sum of all players' essenceTotal. The server sets
       this.gameState.session.phase = 'post-run' at the same time. This check runs
       once per tick; once 'post-run' is set, combat tick blocks (enemy melee, revive
       check, ability dispatch) are skipped.
  AC4: applyDelta handles RunFailedDelta by returning { ...state, session:
       { ...state.session, phase: 'post-run' } }. applyDelta handles
       SpiritAbilityFiredDelta as a no-op on GameState (visual only). Both cases
       satisfy the exhaustiveness guard from Story 3.3.
  AC5: Host DungeonScreen renders spirit-form players as luminous, session-colored
       glowing circles in the PixiJS canvas: outer glow ring (radius 28px,
       session color, alpha 0.35) + inner circle (radius 14px, session color,
       alpha 0.85). Spirit players do NOT have a health bar above them. Alive player
       rendering is unchanged. The spirit visual uses player.x/player.y from gameState.
  AC6: On SpiritAbilityFiredDelta received in DungeonScreen, a brief visual flash
       (200ms) appears at the spirit player's position (same flash mechanism as
       ability:fired from Story 3.3 — extend latestCombatEvent / latestVisualEvent).
  AC7: When gameState.session.phase === 'post-run' on the host, a full-screen
       overlay appears over the dungeon canvas: dark bg (rgba 0,0,0,0.85),
       centered failure headline ("The run ends here." in Lora 700 xl, text-secondary),
       partial essence display (accent-warm Lora 700 lg: "Spirit Essence carried: N"),
       and a sub-note in text-muted sm: "Full run summary coming in Epic 4.".
       The overlay is non-dismissible (Epic 4 adds the return flow).
  AC8: When gameState.session.phase === 'post-run' on mobile, App.tsx renders a
       placeholder screen: corruption-blood background, "Run Failed" in Lora 700 xl
       (text-primary), partial essence from gameState.session (if available via a
       separate field) or omitted, and a sub-note "Return to Camp — coming soon."
       The mobile uses the same phase detection as the host: gameState?.session.phase.
  AC9: tests/contract/net-protocol.test.ts: SpiritAbilityFiredDelta round-trip passes;
       RunFailedDelta round-trip passes; both satisfies DeltaEventMsg.
  AC10: npm run typecheck clean.
Required hooks:
  - Contract-change hook: 2 new delta types added to DeltaEventMsg.
    Protocol Architect review required. Spec update not required (deltas follow
    established pattern; no new session lifecycle change — 'post-run' already existed).
  - Simulation-safety hook: typecheck passes; no new unit tests required (run
    failure logic is trivially correct — all-spirit check — but verify in integration).
  - Client-UX hook (mobile): cell 3 interactive in spirit form; cooldown displays;
    cells 0–2 still locked; post-run placeholder shows.
  - Client-UX hook (host): spirit form visual distinct from alive players; spirit
    ability flash fires; post-run overlay appears on run failure.
Required tests:
  - tests/contract/net-protocol.test.ts — 2 new delta round-trips
Telemetry impact: none this story
```

---

## Story

As a downed player in spirit form,
I want to keep moving and use my spirit ability to support my teammates,
So that entering spirit form feels like a reduced state, not elimination.

---

## Acceptance Criteria

**AC1 — Mobile cell 3 interactive in spirit form:**
**Given** `myPlayer.isSpirit === true` in the mobile controller
**When** the skill grid renders
**Then** cell 3 is interactive: the player can tap it; `InputEventMsg` with `abilityIndex: 3` fires
**And** cells 0–2 remain locked (non-interactive, 80% bg-base overlay) — unchanged from Story 3.5
**And** the spirit ability cooldown is displayed on cell 3 via existing `CooldownState` from `cooldowns[3]`

**AC2 — Server dispatches spirit ability and sends cooldown:**
**Given** a spirit-form player sends `InputEventMsg { event.type: 'ability', abilityIndex: 3 }`
**When** the server processes the tick
**Then** the server checks `player.isSpirit`, validates `spiritCooldownMap` not active, and broadcasts
  `{ type: 'spirit-ability:fired', playerId, class: player.class } satisfies DeltaEventMsg`
**And** sends `CooldownUpdateMsg { abilityIndex: 3, remainingMs: SPIRIT_ABILITY_COOLDOWN_MS }` to the mobile
**And** when the spirit cooldown expires in a future tick, sends `CooldownUpdateMsg { abilityIndex: 3, remainingMs: 0 }`

**AC3 — Run failure: all players in spirit form → run:failed:**
**Given** all entries in `gameState.players` have `isSpirit === true` (and `players.length > 0`)
**When** the server tick runs the post-combat checks
**Then** `RunFailedDelta { type: 'run:failed', partialEssence: sum(player.essenceTotal) }` is broadcast
**And** `this.gameState.session.phase = 'post-run'` is set on the server before broadcast
**And** subsequent ticks skip all combat logic (`phase !== 'dungeon'` guard catches this)
**And** this check fires at most once (phase change from 'dungeon' to 'post-run' prevents re-firing)

**AC4 — applyDelta handles both new delta types:**
**Given** `RunFailedDelta` is received by applyDelta
**Then** returns `{ ...state, session: { ...state.session, phase: 'post-run' } }`

**Given** `SpiritAbilityFiredDelta` is received by applyDelta
**Then** returns `state` unchanged (visual only — no state mutation)
**And** the `satisfies never` exhaustiveness guard compiles clean (add both cases before guard)

**AC5 — Host canvas: spirit-form players rendered as luminous glowing figures:**
**Given** one or more players have `isSpirit === true` in `gameState`
**When** the host `DungeonScreen` `renderFrame()` runs
**Then** each spirit player is drawn at `(player.x, player.y)` as:
  - Outer glow ring: radius 28px, `session-color` fill, alpha 0.35
  - Inner circle: radius 14px, `session-color` fill, alpha 0.85
  - No health bar above spirit players
  - Alive players continue to render with their existing visual (no change)

**AC6 — Host canvas: spirit ability flash on SpiritAbilityFiredDelta:**
**Given** `SpiritAbilityFiredDelta` arrives at the host
**When** `DungeonScreen` processes it via `latestCombatEvent` / `latestVisualEvent`
**Then** a 200ms visual flash appears at the spirit player's position (same mechanism used for `ability:fired` in Story 3.3)

**AC7 — Host shows placeholder post-run overlay when phase === 'post-run':**
**Given** `gameState.session.phase === 'post-run'`
**When** host renders (inside DungeonScreen or App.tsx routing)
**Then** a full-screen overlay appears:
  - `background: rgba(0,0,0,0.85)`, `position: absolute`, `inset: 0`, `zIndex: 50`
  - Headline: `"The run ends here."` — Lora 700, `var(--text-xl)`, `var(--text-secondary)`, centered
  - Essence line: `"Spirit Essence carried: N"` — Lora 700 lg, `var(--accent-warm)`
  - Sub-note: `"Full run summary coming in Epic 4."` — Lora 400 sm, `var(--text-muted)`

**AC8 — Mobile shows placeholder post-run screen when phase === 'post-run':**
**Given** `gameState?.session.phase === 'post-run'`
**When** mobile App.tsx renders (same phase-check as host routing, derived from gameState)
**Then** a simple placeholder screen renders:
  - Full-screen `var(--corruption-blood)` or dark background
  - `"Run Failed"` — Lora 700 xl, `var(--text-primary)`, centered
  - Sub-note: `"Return to Camp — coming soon."` — Lora 400 sm

**AC9 — Contract tests pass:**
**Given** `tests/contract/net-protocol.test.ts`
**Then** `SpiritAbilityFiredDelta` round-trip passes
**And** `RunFailedDelta` round-trip passes

**AC10 — Typecheck clean:**
**Given** `npm run typecheck`
**Then** no errors; both new deltas `satisfies DeltaEventMsg`

---

## Tasks / Subtasks

- [ ] Task 1: Protocol changes — new delta types (AC4, AC9, AC10)
  - [ ] 1.1: Add `SpiritAbilityFiredDelta` and `RunFailedDelta` to `server-to-host.ts` + `DeltaEventMsg` union
  - [ ] 1.2: Add `spirit-ability:fired` (no-op) and `run:failed` (phase update) cases to `apply-delta.ts`
  - [ ] 1.3: Export new types from `net-protocol/src/index.ts`
  - [ ] 1.4: Add `SPIRIT_ABILITY_COOLDOWN_MS` to `balance.ts`

- [ ] Task 2: Server — spirit ability dispatch + run failure (AC2, AC3)
  - [ ] 2.1: Add `spiritCooldownMap = new Map<string, number>()` private field; init in onJoin; cleanup in onLeave
  - [ ] 2.2: In tick(), add spirit ability input processing block (after class ability block, check isSpirit + abilityIndex===3)
  - [ ] 2.3: In tick(), add spirit cooldown expiry check (after existing cooldownMap expiry loop)
  - [ ] 2.4: In tick(), add all-spirit run-failure check (after revive block; guard with phase === 'dungeon')

- [ ] Task 3: Mobile — unlock cell 3 in spirit form (AC1)
  - [ ] 3.1: Change cell 3 `isInteractive` condition: when `isSpirit`, cell 3 = `!isOnCooldown`; when `isDown`, cell 3 = `false`
  - [ ] 3.2: Verify cells 0–2 locked overlay persists in spirit form (unchanged from 3.5)

- [ ] Task 4: Host DungeonScreen — spirit rendering + post-run overlay (AC5, AC6, AC7)
  - [ ] 4.1: In `renderFrame()`, render spirit-form players as luminous glow circles (separate from alive render path)
  - [ ] 4.2: Extend `latestCombatEvent` / `latestVisualEvent` to accept `spirit-ability:fired` for flash trigger
  - [ ] 4.3: Add `phase === 'post-run'` overlay inside DungeonScreen (or in App.tsx routing — see Dev Notes)

- [ ] Task 5: App.tsx (host + mobile) — post-run routing (AC7, AC8)
  - [ ] 5.1: Host App.tsx: inside the dungeon/hub-world branch, check `phase === 'post-run'` → show overlay or separate placeholder
  - [ ] 5.2: Mobile App.tsx: check `gameState?.session.phase === 'post-run'` → show placeholder

- [ ] Task 6: Contract tests (AC9)
  - [ ] 6.1: Add `SpiritAbilityFiredDelta` and `RunFailedDelta` round-trip tests

---

## Dev Notes

### Critical dependency: Stories 3.3 + 3.4 + 3.5 must be merged first

| Prior story artifact | Used by 3.6 |
|---|---|
| `PlayerState.isSpirit` (added 3.5) | Spirit form gate on server + mobile + host |
| `player:spirit` delta + `SpiritFormMsg{isActive:true}` (3.5) | Already handled; 3.6 adds next step |
| Mobile cell 3 locked preview when `isDown` (3.5) | 3.6 unlocks it when `isSpirit` |
| Host player chip spirit state (3.5) | Already rendered; no changes in 3.6 |
| `SPIRIT_ABILITY_NAMES` in balance.ts (3.5) | Used by mobile cell 3 label; already there |
| `latestCombatEvent` in App.tsx / DungeonScreen (3.3/3.4) | 3.6 extends to cover new delta types |
| `DeltaEventMsg` exhaustiveness guard (3.3) | Add `spirit-ability:fired` and `run:failed` cases |
| `PlayerState.essenceTotal` (3.4) | Used to compute `partialEssence` in RunFailedDelta |
| `SessionState.phase: 'post-run'` already in type | No type change needed |
| `PlayerState.class` non-null guaranteed in dungeon | Spirit ability can use `player.class!` |
| Enemy melee / revive checks guarded by `phase === 'dungeon'` (3.5) | RunFailed sets phase='post-run'; guards stop combat |

---

### What already exists — DO NOT reinvent

**`SpiritFormMsg`** in `server-to-mobile.ts` (pre-existing):
```typescript
export interface SpiritFormMsg {
  type: 'spirit:form';
  isActive: boolean;
}
```
3.6 does NOT add new messages to mobile — mobile derives spirit state from `gameState.session.phase` and `player.isSpirit` in `gameState`. `SpiritFormMsg` was supplementary in 3.5; mobile does not need a new message for spirit ability or run failure.

**`SPIRIT_ABILITY_NAMES`** in `packages/game-rules/src/balance.ts` (added by 3.5):
```typescript
export const SPIRIT_ABILITY_NAMES: Record<PlayerClass, string> = {
  stonehide:    'Earthen Vigil',
  spiritcaller: 'Soul Tether',
  souldrinker:  'Void Drain',
  stormcaller:  'Storm Echo',
};
```
Mobile cell 3 already uses this to display the spirit ability name. 3.6 adds the interactive behavior only.

**`SessionState.phase`** includes `'post-run'` — already defined in `packages/shared-types/src/session.ts`:
```typescript
phase: 'lobby' | 'hub' | 'dungeon' | 'post-run';
```
No type change needed. `applyDelta` just sets it.

**Cooldown channel** — spirit ability uses the same `EventNames.COOLDOWN_UPDATE` / `CooldownUpdateMsg` path as class abilities, with `abilityIndex: 3`. No new message type.

**`latestCombatEvent`** / **`latestAbilityFired`** state in host `App.tsx` / `DungeonScreen` (from 3.3/3.4) — extend the existing state to include `spirit-ability:fired` delta type. Do NOT create a new parallel state variable.

**`PlayerState.isSpirit`** — set to `true` in story 3.5 (timer expiry path). 3.6 reads it; does not re-set it.

---

### New delta types — add to `packages/net-protocol/src/messages/server-to-host.ts`

```typescript
import type { PlayerClass } from 'shared-types';

export type SpiritAbilityFiredDelta = {
  type: 'spirit-ability:fired';
  playerId: string;
  class: PlayerClass;  // for host visual differentiation per class (future)
};

export type RunFailedDelta = {
  type: 'run:failed';
  partialEssence: number;  // sum of all players' essenceTotal at failure moment
};
```

Add both to `DeltaEventMsg` union:
```typescript
export type DeltaEventMsg =
  | PlayerMovedDelta
  | PlayerDownedDelta        // reviveWindowMs added in 3.5
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
  | AbilityFiredDelta         // added 3.3
  | EnemyDamagedDelta         // added 3.4 — include or skip based on actual 3.4 type name
  | PlayerHpUpdatedDelta      // added 3.5
  | PlayerSpiritDelta         // added 3.5
  | SpiritAbilityFiredDelta   // NEW 3.6
  | RunFailedDelta;            // NEW 3.6
```

> **Note:** Verify the exact delta type names added by stories 3.3, 3.4, 3.5 by reading the actual `server-to-host.ts` file after those stories merge. The list above uses the names from their story dev notes; do not assume they match exactly.

Export from `packages/net-protocol/src/index.ts`:
```typescript
export type { ..., SpiritAbilityFiredDelta, RunFailedDelta } from './messages/server-to-host.js';
```

---

### balance.ts addition (extend what 3.5 created)

Add to `packages/game-rules/src/balance.ts`:
```typescript
// ── Spirit ability ─────────────────────────────────────────────────────────
// Single cooldown for all classes in alpha. Per-class differentiation in Epic 4+.
export const SPIRIT_ABILITY_COOLDOWN_MS = 5000;
// ponytail: uniform spirit cooldown; per-class values when spirit abilities are fully designed
```

---

### apply-delta.ts changes

Add to the switch in `packages/net-protocol/src/apply-delta.ts` **before** the exhaustiveness guard:

```typescript
case 'spirit-ability:fired': {
  return state;  // visual only — no GameState mutation
}
case 'run:failed': {
  return { ...state, session: { ...state.session, phase: 'post-run' } };
}
```

> **Verify the guard pattern:** Story 3.3 added `const _exhaustive: never = evt; return state;` as the default. These two cases must appear before that line, not after.

---

### GameRoom.ts — spirit ability dispatch and run failure

Read the full `GameRoom.ts` as modified by Story 3.5 before editing. Changes are surgical additions.

**1. New private field:**
```typescript
private spiritCooldownMap = new Map<string, number>(); // playerId → spirit ability expiry epoch (0 = ready)
```

**2. `onJoin` additions:**
```typescript
this.spiritCooldownMap.set(client.sessionId, 0);
```
(add alongside `this.cooldownMap.set(...)`)

**3. `onLeave` cleanup** — in BOTH the consented-leave and grace-expired paths:
```typescript
this.spiritCooldownMap.delete(client.sessionId);
```

**4. Spirit ability dispatch block in `tick()`** — add AFTER the existing class ability dispatch block, BEFORE `this.inputQueue.length = 0`:

```typescript
// ── Spirit ability dispatch ───────────────────────────────────────────────
if (this.gameState.session.phase === 'dungeon') {
  const nowSpirit = Date.now();
  for (const { clientId, msg } of this.inputQueue) {
    if (msg.event.type !== 'ability') continue;
    if (msg.event.ability.abilityIndex !== 3) continue;

    const player = this.gameState.players.find(p => p.id === clientId);
    if (!player || !player.isSpirit) continue;
    if (player.class === null) continue;

    const spiritExpiry = this.spiritCooldownMap.get(clientId) ?? 0;
    if (spiritExpiry > nowSpirit) continue;  // still on spirit cooldown

    this.spiritCooldownMap.set(clientId, nowSpirit + SPIRIT_ABILITY_COOLDOWN_MS);

    const spiritDelta = {
      type: 'spirit-ability:fired' as const,
      playerId: clientId,
      class: player.class,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, spiritDelta);

    const targetClient = this.clients.find(c => c.sessionId === clientId);
    if (targetClient) {
      targetClient.send(EventNames.COOLDOWN_UPDATE, {
        type: 'cooldown:update',
        abilityIndex: 3,
        remainingMs: SPIRIT_ABILITY_COOLDOWN_MS,
      } satisfies CooldownUpdateMsg);
    }

    logger.debug({ roomId: this.roomId, clientId, class: player.class }, 'spirit ability fired');
  }
}
```

**5. Spirit cooldown expiry** — add AFTER the existing `cooldownMap` expiry loop:

```typescript
// Check spirit ability cooldown expiries
const nowSpiritExpiry = Date.now();
for (const [clientId, expiry] of this.spiritCooldownMap) {
  if (expiry > 0 && nowSpiritExpiry >= expiry) {
    this.spiritCooldownMap.set(clientId, 0);
    const targetClient = this.clients.find(c => c.sessionId === clientId);
    if (targetClient) {
      targetClient.send(EventNames.COOLDOWN_UPDATE, {
        type: 'cooldown:update',
        abilityIndex: 3,
        remainingMs: 0,
      } satisfies CooldownUpdateMsg);
    }
  }
}
```

**6. Run failure check** — add AFTER the revive timer expiry / proximity revive block (from 3.5), still inside `tick()`:

```typescript
// ── Run failure: all players in spirit form → phase 'post-run' ───────────
if (this.gameState.session.phase === 'dungeon') {
  const players = this.gameState.players;
  if (
    players.length > 0 &&
    players.every(p => p.isSpirit)
  ) {
    const partialEssence = players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0);
    this.gameState.session.phase = 'post-run';

    const runFailedDelta = {
      type: 'run:failed' as const,
      partialEssence,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, runFailedDelta);

    logger.info({ roomId: this.roomId, partialEssence }, 'run failed — all players in spirit form');
  }
}
```

**7. Import additions** (verify these come from actual 3.5/3.4 exports):
```typescript
import { SPIRIT_ABILITY_COOLDOWN_MS } from 'game-rules';
import type { SpiritAbilityFiredDelta, RunFailedDelta } from 'net-protocol';
```

> **Guard coverage:** The all-spirit check is guarded by `phase === 'dungeon'`. Once `phase` becomes `'post-run'`, the enemy melee block (3.5), revive block (3.5), ability dispatch block (3.3), and spirit ability block above are all skipped because they each have `phase === 'dungeon'` guards. Confirm these guards exist in the merged 3.5 code; add them if any block is missing.

---

### Mobile controller — unlock cell 3 when isSpirit

Read `ControllerScreen.tsx` in full before editing. Story 3.5 modified the cell `isInteractive` condition for the downed/spirit case; 3.6 extends that.

**After 3.5, the cell logic looks roughly like this (verify exact code):**
```typescript
const isDown = myPlayer?.isDown ?? false;
const isSpirit = myPlayer?.isSpirit ?? false;

// isInteractive for the SkillCell mapping:
const isInteractive = (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown;
```

**For story 3.6, change cell 3's `isInteractive` logic in the skill grid mapping:**
```tsx
// In the [0,1,2,3].map(i => ...) for skill cells:
const isSpiritCell = (isDown || isSpirit) && i === 3;
const isInteractiveFinal = isSpiritCell
  ? isSpirit && !isOnCooldown   // spirit cell: interactive only when isSpirit (not merely isDown)
  : (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown;
```

> The key distinction: cell 3 when `isDown` = locked preview (shown but not interactive). Cell 3 when `isSpirit` = interactive. This is exactly the "preview in downed, active in spirit" design from UX spec.

**Cell 3 ability definition override when spirit:** Story 3.5 already renders cell 3 with the spirit ability name (from `SPIRIT_ABILITY_NAMES[confirmedClass]`) when `isDown || isSpirit`. No change needed for the cell content — only `isInteractiveFinal` changes.

**Spirit ability input type is TAP** — verify that SkillCell handles `inputType: 'TAP'` for cell 3 when spirit. Since spirit cell 3 fires on pointer-down (same as any TAP ability), no special input handling is needed; the existing TAP path in SkillCell works.

**Cooldown display for spirit ability:** when the server sends `COOLDOWN_UPDATE { abilityIndex: 3, remainingMs: SPIRIT_ABILITY_COOLDOWN_MS }`, `App.tsx` stores it in `cooldowns[3]`. Cell 3 renders it via `cooldownState: cooldowns[3]`. No change to App.tsx cooldown handling required.

---

### Host DungeonScreen — spirit form rendering and post-run overlay

Read `DungeonScreen.tsx` as modified by Story 3.4 (and then any changes from 3.5) before editing.

**1. Spirit-form player rendering in `renderFrame()`:**

The existing render loop draws alive players as circles. After that loop (or as a separate branch within it), add spirit player rendering:

```typescript
// In renderFrame(), in the player rendering section:
for (const player of gameState.players) {
  if (player.isSpirit) {
    // Draw spirit player: luminous glowing figure
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;

    // Outer glow ring
    playerGfx.beginFill(color, 0.35);
    playerGfx.drawCircle(player.x, player.y, 28);
    playerGfx.endFill();

    // Inner circle
    playerGfx.beginFill(color, 0.85);
    playerGfx.drawCircle(player.x, player.y, 14);
    playerGfx.endFill();
  } else if (!player.isDown) {
    // Existing alive player rendering (unchanged)
    // ...
  }
  // isDown players: invisible on canvas (they are downed, not spirit — no canvas change)
}
```

`SESSION_COLOR_HEX` is a mapping from `SessionColor` enum to PixiJS hex number — this should already exist in DungeonScreen.tsx from story 3.3/3.4 for player color rendering. If it doesn't, add:
```typescript
const SESSION_COLOR_HEX: Record<SessionColor, number> = {
  [SessionColor.RED]:    0xe74c3c,
  [SessionColor.BLUE]:   0x3498db,
  [SessionColor.GREEN]:  0x2ecc71,
  [SessionColor.YELLOW]: 0xf1c40f,
  [SessionColor.PURPLE]: 0x9b59b6,
  [SessionColor.ORANGE]: 0xe67e22,
  [SessionColor.PINK]:   0xff69b4,
  [SessionColor.TEAL]:   0x1abc9c,
};
```

> **Do NOT render a health bar above spirit players.** The `isSpirit` check must exclude them from the health bar rendering path (which runs for alive players with `!player.isSpirit`).

**2. Spirit ability flash — extend latestCombatEvent:**

In `DungeonScreen.tsx`, the `useEffect` on `latestCombatEvent` already handles `ability:fired` and `enemy:killed` (from 3.3/3.4). Extend it to handle `spirit-ability:fired`:

```typescript
useEffect(() => {
  if (!latestCombatEvent) return;
  if (
    latestCombatEvent.type === 'ability:fired' ||
    latestCombatEvent.type === 'spirit-ability:fired'
  ) {
    // Flash at player position — same as existing ability:fired handling
    const player = gameState?.players.find(p => p.id === latestCombatEvent.playerId);
    if (player) {
      abilityFlashesRef.current.set(latestCombatEvent.playerId, Date.now() + 200);
    }
  }
  // ... existing enemy:killed, essence:dropped, player:downed, player:revived, player:spirit handling
}, [latestCombatEvent]);
```

In host `App.tsx`, extend the delta type check that sets `latestCombatEvent`:
```typescript
// Extend the existing check:
if (
  delta.type === 'enemy:killed' || delta.type === 'essence:dropped' ||
  delta.type === 'player:downed' || delta.type === 'player:revived' ||
  delta.type === 'player:spirit' ||  // from 3.5
  delta.type === 'spirit-ability:fired' ||  // NEW 3.6
  delta.type === 'run:failed'  // NEW 3.6 — not visual but DungeonScreen can ignore it
) {
  setLatestCombatEvent(delta);
}
```

> **Name of state variable:** Story 3.4 Dev Notes used `latestCombatEvent`. Story 3.5 Dev Notes used both names (it was a transitional story). Read actual `App.tsx` after 3.5 is merged to confirm the actual variable name before referencing it.

**3. Post-run overlay in DungeonScreen:**

When `gameState?.session.phase === 'post-run'` inside DungeonScreen, render an overlay:

```tsx
{gameState?.session.phase === 'post-run' && (
  <div style={{
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 50,
  }}>
    <div style={{
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 'var(--text-xl)',
      color: 'var(--text-secondary)',
      textAlign: 'center',
    }}>
      The run ends here.
    </div>
    <div style={{
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 'var(--text-lg)',
      color: 'var(--accent-warm)',
    }}>
      Spirit Essence carried: {
        gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)
      }
    </div>
    <div style={{
      fontFamily: 'var(--font-body)',
      fontWeight: 400,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
    }}>
      Full run summary coming in Epic 4.
    </div>
  </div>
)}
```

> The overlay reads essence from `gameState.players` (already updated by `applyDelta` for `run:failed`) rather than from the `RunFailedDelta.partialEssence`. This avoids needing to store the delta's value in separate state. Both will be consistent since `applyDelta` sets `phase='post-run'` using the same tick's gameState.

---

### Mobile App.tsx — post-run placeholder

Read `apps/mobile-controller/src/App.tsx` before editing (modified by 3.5 to add spirit form callbacks). The App.tsx `AppScreen` type will include at least `'controller'` and `'reconnect'`. Story 3.3 may not have added a `'dungeon'` state to mobile (mobile derives dungeon from `gameState.session.phase`).

The cleanest approach: in the controller render branch, check `gameState?.session.phase === 'post-run'` before rendering `ControllerScreen`. If post-run, render the placeholder inline or as a separate screen state.

```tsx
// In the controller render path:
if (gameState?.session.phase === 'post-run') {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    }}>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-xl)',
        color: 'var(--corruption-blood)',
      }}>
        Run Failed
      </div>
      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
      }}>
        Return to Camp — coming soon.
      </div>
    </div>
  );
}
```

> Place this check ABOVE the `<ControllerScreen>` render. The phase is already reflected in `gameState` (updated by `applyDelta` on `run:failed` delta received via the mobile session delta handler).

---

### tests/contract/net-protocol.test.ts additions

```typescript
it('spirit-ability:fired delta survives serialize → deserialize', () => {
  const delta = {
    type: 'spirit-ability:fired' as const,
    playerId: 'p1',
    class: PlayerClass.STORMCALLER,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('run:failed delta survives serialize → deserialize', () => {
  const delta = {
    type: 'run:failed' as const,
    partialEssence: 120,
  } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});
```

---

### Design decisions and clarifications

**Spirit form movement:** Spirit-form players move freely using the same joystick system as alive players. No movement speed modifier. The server movement loop only blocks `isFrozen` (and possibly `isDown` from story 3.5 — verify in merged code). `isSpirit` players are NOT blocked. No change needed to movement code for spirit form.

**isDown vs isSpirit in tick:** `isDown` = timer still running (can still be revived). `isSpirit` = timer expired, fully in spirit form. These are mutually exclusive (`player:spirit` delta in 3.5 sets `isDown: false, isSpirit: true`). The run-failure check uses only `isSpirit`.

**Spirit ability on server vs training dummy:** The existing ability dispatch in GameRoom is guarded by `nearPoiId === 'training-dummy'` (story 2.4 placeholder). Story 3.3 replaces this with full dungeon ability dispatch for class abilities. The spirit ability block (3.6) is a SEPARATE block from the class ability block — check `player.isSpirit` to route to spirit ability, check `!player.isSpirit && !player.isDown` to route to class ability. Do NOT mix the two paths.

**partialEssence calculation:** Computed at failure time as `players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0)`. The `essenceTotal` field was added in story 3.4. Use `?? 0` defensively in case 3.4 hasn't run yet in tests.

**No new EventNames needed:** `spirit-ability:fired` and `run:failed` go through `EventNames.DELTA` (same as all other `DeltaEventMsg` variants). No new EventNames entry.

**Placeholder essenceTotal on SessionState:** The post-run overlay computes essence from `gameState.players` directly. If `SessionState` ever gets a `totalEssence` field (Epic 4 scope), update this then. Don't add it now.

**Run failure fires once:** Because `phase = 'post-run'` is set before broadcast, and all combat blocks check `phase === 'dungeon'`, the all-spirit check can never re-fire. The tick continues (snapshot still broadcasts, POI contacts still process), but combat logic is inert.

---

### Deferred items NOT addressed this story

| Deferred | Reason |
|---|---|
| Per-class spirit ability effects | Effects TBD in Epic 4; visual placeholder is sufficient for alpha |
| Full post-run summary screen (per-player rows, return-to-hub button) | Epic 4 |
| Victory path: `run:succeeded` / `level:complete` chains | Story 3.7 (Clear objective) |
| Enemy targeting of spirit-form players | Spirits are implicitly invulnerable (enemies target non-downed, non-spirit players from 3.5 melee code) |
| Spirit form position reset on revive | N/A — spirit form is irreversible in alpha (no revive from spirit) |

---

### Hooks triggered

| Hook | Required action |
|---|---|
| Contract-change hook | 2 new delta types in DeltaEventMsg; Protocol Architect review required |
| Simulation-safety hook | typecheck clean; no new pure-function unit tests (run failure is a trivial all-spirit check) |
| Client-UX hook (mobile) | cell 3 interactive in spirit; cooldown works; cells 0–2 still locked; post-run placeholder visible |
| Client-UX hook (host) | spirit circle renders distinctly; ability flash fires; post-run overlay appears and covers canvas |

### What remains after this story

- Story 3.7: Clear objective (all enemies killed → `level:complete`)
- Epic 4: Full run structure, procedural levels, post-run summary, return-to-hub flow
- Epic 4: Full per-class spirit ability mechanics

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

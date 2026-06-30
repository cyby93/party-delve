---
baseline_commit: 04ebbfa
---

# Story 4.5: Post-Run Summary Screen

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 4 — Procedural Dungeon & Full Run Structure (Epic 4)
Context: Stories 4.1–4.4 set up the full 3-level run. When Level 3 clears (or
  placeholder boss is reached), GameRoom.ts broadcasts run:complete and sets
  session.phase = 'post-run'. When all players enter spirit form,
  run:failed fires instead. Both already exist; the session.phase flip is
  in the delta handler (applyDelta). The host currently shows a "Full run
  summary coming in Epic 4." overlay inside DungeonScreen.tsx and the mobile
  shows "Return to Camp — coming soon." placeholders in App.tsx. This story
  replaces both placeholders with a functional summary + return flow.
Owner agent: Protocol Architect (mobile-to-server msg + EventNames)
             Simulation Engineer (GameRoom.ts return handler)
             Host Experience Engineer (PostRunSummaryScreen + App.tsx routing)
             Mobile Controller Engineer (App.tsx return-to-camp screen)
Goal: Replace the post-run "coming soon" placeholders with: (a) a proper host
  summary screen showing outcome headline, team Spirit Essence, and per-player
  cards; (b) a mobile screen with a "Return to Camp" button that sends a message
  to the server; (c) server logic that waits for all active (non-frozen) players
  to confirm, then resets state to hub and broadcasts a snapshot.
Allowed paths:
  - packages/net-protocol/src/event-names.ts                (MODIFY — add RETURN_TO_CAMP)
  - packages/net-protocol/src/messages/mobile-to-server.ts  (MODIFY — add ReturnToCampMsg)
  - packages/net-protocol/src/index.ts                      (MODIFY — export ReturnToCampMsg)
  - apps/mobile-controller/src/session/mobile-session.ts    (MODIFY — add sendReturnToCamp)
  - apps/simulation-server/src/rooms/GameRoom.ts            (MODIFY — add handler + reset)
  - apps/host-client/src/App.tsx                            (MODIFY — route post-run to new screen)
  - apps/host-client/src/screens/DungeonScreen.tsx          (MODIFY — remove post-run overlays)
  - apps/host-client/src/screens/PostRunSummaryScreen.tsx   (NEW)
  - apps/mobile-controller/src/App.tsx                      (MODIFY — replace post-run placeholders)
  - tests/contract/return-to-camp-msg.test.ts               (NEW — contract test)
Blocked paths:
  - packages/shared-types/**     (no new types needed — PlayerState already has essenceTotal/downCount)
  - packages/game-rules/**       (no balance changes)
  - apps/host-client/src/screens/DungeonScreen.tsx — do NOT remove anything from the dungeon
    canvas, HUD, or revive timer logic; only remove the three post-run overlays
Inputs:
  - apps/host-client/src/screens/DungeonScreen.tsx          (three post-run overlays to remove, lines ~359–453)
  - apps/host-client/src/App.tsx                            (current routing, line 69–73)
  - apps/mobile-controller/src/App.tsx                      (post-run placeholders, lines ~154–217)
  - packages/net-protocol/src/event-names.ts                (EventNames enum to extend)
  - packages/net-protocol/src/messages/mobile-to-server.ts  (mobile-to-server types)
  - apps/simulation-server/src/rooms/GameRoom.ts            (GameRoom private fields + onCreate)
Non-goals:
  - Per-player "waiting for others" indicator on the mobile screen (keep simple)
  - Animated transition effects (not in UX spec for this story)
  - Spirit Essence persistence to database (Epic 7)
  - Mastery progress tracking (Epic 7)
  - Biome/boss defeat reveal animation (FR24 boss animation — Epic 6)
  - Story 4.6 e2e coverage (separate story)
Acceptance criteria:
  AC1: When run:complete fires, the host transitions from DungeonScreen to
       PostRunSummaryScreen. The headline reads a victory tone (e.g.,
       "Purified. The campfire noticed.") in Uncial Antiqua at xl (40px).
       The team total Spirit Essence is shown in Lora 700, accent-warm.
  AC2: When run:failed fires, the host transitions to PostRunSummaryScreen
       with a failure tone headline (e.g., "Tonight, the forest held its
       ground.") in the same layout. Player name and class dim to text-secondary.
  AC3: Per-player rows show: name (Lora 700, base, text-primary), class name
       (Lora 400, sm, text-secondary), "Downed ×N" (downCount), and Spirit
       Essence earned (Lora 700, base, accent-warm). Failure rows dim name
       and class to text-secondary.
  AC4: The host summary screen persists indefinitely — it does NOT auto-transition.
  AC5: The mobile post-run screen shows an outcome label ("Victory!" or
       "Run Ended") and a "Return to Camp" button (≥44px height). On tap the
       button is disabled and sends return:to-camp to the server. It must NOT
       re-enable or resend.
  AC6: When ALL non-frozen players have sent return:to-camp, the server resets
       game state to hub (phase = 'hub', players hp/down/spirit reset, enemies
       cleared) and broadcasts a snapshot. Host transitions to HubWorldScreen;
       mobile transitions to ControllerScreen.
  AC7: A frozen (disconnected) player does NOT block the hub transition. The
       server counts only non-frozen players in the readiness check.
  AC8: contract test: ReturnToCampMsg round-trip (serialize → deserialize) passes
       in tests/contract/return-to-camp-msg.test.ts.
  AC9: All 101+ existing tests pass (tsc --noEmit clean on all packages,
       npm test --workspace=tests green).
Required hooks:
  - Contract-change hook: net-protocol (event-names.ts, mobile-to-server.ts, index.ts)
    is modified. Required: at least one contract test (AC8).
  - Client-UX hook: DungeonScreen.tsx (overlay removal) and PostRunSummaryScreen.tsx
    (new screen) are touched.
    Host checks: summary headline legible at couch distance (Uncial Antiqua xl,
    text-primary/accent-spirit); per-player rows readable (Lora 700 base).
    Mobile checks: "Return to Camp" button ≥44px touch target.
Required tests:
  - tests/contract/return-to-camp-msg.test.ts: serialize → deserialize round-trip
    for ReturnToCampMsg (AC8).
  - All 101+ existing tests must remain green.
Telemetry impact: None for alpha.
```

---

## Story

As a player,
I want to see a clear summary of our run's outcome on the host screen with each player's performance,
so that we can celebrate victory or reflect on defeat before deciding whether to run again.

---

## Acceptance Criteria

**AC1 — Victory headline on host:**
**Given** `run:complete` is received by the host client
**When** the Post-Run Summary screen renders
**Then** a victory tone headline (e.g., "Purified. The campfire noticed.") renders in Uncial Antiqua at xl (40px), color text-primary
**And** the team total Spirit Essence renders below it in Lora 700, accent-warm

**AC2 — Failure headline on host:**
**Given** `run:failed` is received by the host client
**When** the Post-Run Summary screen renders
**Then** a failure tone headline (e.g., "Tonight, the forest held its ground.") renders in the same layout
**And** the overall visual tone is dimmer (team Essence shown as partial, rows dimmed)

**AC3 — Per-player rows:**
**Given** the summary is showing
**When** per-player rows render
**Then** one row appears per player: player name (Lora 700, base, text-primary), class name (Lora 400, sm, text-secondary), "Downed ×N" count (Lora 400, sm, text-secondary), Spirit Essence earned (Lora 700, base, accent-warm)
**And** failure state: player name and class dim to text-secondary (opacity 0.6 or token swap)

**AC4 — Summary persists:**
**Given** the host summary screen is showing
**When** no explicit return signal has arrived from all players
**Then** the screen stays — it does not auto-transition or time out

**AC5 — Mobile Return to Camp button:**
**Given** `run:complete` or `run:failed` has been received on mobile
**When** the mobile post-run screen renders
**Then** an outcome label ("Victory!" or "Run Ended") is visible
**And** a "Return to Camp" button (≥44px height, var(--interactive) background) is shown
**When** the player taps "Return to Camp"
**Then** the button is immediately disabled (pointer-events: none, opacity reduced) and `return:to-camp` is sent to the server exactly once

**AC6 — All confirmed → hub transition:**
**Given** all non-frozen players have sent `return:to-camp`
**When** the last confirmation is received
**Then** the server resets state: session.phase = 'hub', all players have hp=maxHp, isDown=false, isSpirit=false, essenceTotal=0, downCount=0, reviveTimerExpiresAt=0, nearPoiId=null, x/y=hub spawn
**And** enemies array is cleared, essenceDrops array is cleared
**And** the server broadcasts a snapshot; host shows HubWorldScreen; mobile shows ControllerScreen

**AC7 — Frozen players do not block transition:**
**Given** one player is frozen (disconnected, isFrozen=true) during post-run
**When** all non-frozen players send `return:to-camp`
**Then** the server proceeds with the hub transition without waiting for the frozen player

**AC8 — Contract test:**
**Given** `ReturnToCampMsg` is defined in mobile-to-server.ts
**When** `tests/contract/return-to-camp-msg.test.ts` runs
**Then** serialize → deserialize round-trip passes

---

## Tasks / Subtasks

- [ ] T1: net-protocol — add RETURN_TO_CAMP event name and ReturnToCampMsg type
  - [ ] T1.1: In `packages/net-protocol/src/event-names.ts`, add:
    `RETURN_TO_CAMP = 'return:to-camp'` to the EventNames enum
  - [ ] T1.2: In `packages/net-protocol/src/messages/mobile-to-server.ts`, add:
    `export interface ReturnToCampMsg { type: 'return:to-camp'; }`
  - [ ] T1.3: In `packages/net-protocol/src/index.ts`, add `ReturnToCampMsg` to the
    mobile-to-server export line

- [ ] T2: mobile-session — add sendReturnToCamp method
  - [ ] T2.1: In `apps/mobile-controller/src/session/mobile-session.ts`, add
    `sendReturnToCamp: () => void` to the `MobileSession` interface
  - [ ] T2.2: In both `joinSession` and `reconnectToSession` return objects, add:
    `sendReturnToCamp: () => room.send(EventNames.RETURN_TO_CAMP, { type: 'return:to-camp' })`

- [ ] T3: GameRoom.ts — return-to-camp handler + hub reset
  - [ ] T3.1: Add private field: `private returnReadySet = new Set<string>()`
  - [ ] T3.2: Register handler in onCreate:
    `this.onMessage(EventNames.RETURN_TO_CAMP, (client: Client) => { ... })`
  - [ ] T3.3: In the handler: add `client.sessionId` to `returnReadySet`; check if all
    non-frozen players have confirmed (see Dev Notes for exact check)
  - [ ] T3.4: When confirmed: destroy all enemy physics bodies, clear enemies array,
    clear essenceDrops, destroy essence sensor bodies, clear cooldownMap,
    spiritCooldownMap, lastKnownJoystick, enemyAttackCooldowns, inputQueue;
    reset each player to hub state; set session.phase = 'hub', session.levelIndex = 0;
    clear returnReadySet; broadcast snapshot (see Dev Notes for full reset sequence)

- [ ] T4: PostRunSummaryScreen.tsx — new host screen (AC1, AC2, AC3, AC4)
  - [ ] T4.1: Create `apps/host-client/src/screens/PostRunSummaryScreen.tsx`
  - [ ] T4.2: Props: `{ gameState: GameState; runOutcome: 'complete' | 'failed' }`
  - [ ] T4.3: Headline: Uncial Antiqua (var(--font-display)), xl (40px), text-primary
    - Victory: "Purified. The campfire noticed."
    - Failure: "Tonight, the forest held its ground."
  - [ ] T4.4: Team essence total: computed from `gameState.players.reduce((s, p) => s + p.essenceTotal, 0)`
    Label: "Spirit Essence" — Lora 700, accent-warm
  - [ ] T4.5: Per-player rows — see Dev Notes for row layout
  - [ ] T4.6: No "Return to Camp" button on host — screen persists until snapshot arrives

- [ ] T5: DungeonScreen.tsx — remove post-run overlays (AC1, AC2)
  - [ ] T5.1: Remove the three post-run overlay divs:
    - `phase === 'post-run' && runOutcome === 'failed'` block (~lines 359–397)
    - `phase === 'post-run' && runOutcome === 'complete'` block (~lines 399–437)
    - `phase === 'post-run' && runOutcome === null` block (~lines 439–453)
  - [ ] T5.2: Remove `runOutcome` from DungeonScreenProps (it's no longer used in DungeonScreen)
  - [ ] T5.3: Verify: DungeonScreen only renders during phase === 'dungeon' after App.tsx routing change

- [ ] T6: App.tsx (host) — route post-run to PostRunSummaryScreen (AC1, AC2, AC4)
  - [ ] T6.1: Import `PostRunSummaryScreen` from `./screens/PostRunSummaryScreen`
  - [ ] T6.2: Split the current combined check: phase 'dungeon' → DungeonScreen; phase 'post-run' → PostRunSummaryScreen
    (see Dev Notes for exact diff)
  - [ ] T6.3: Remove `runOutcome` prop from `<DungeonScreen>` call (it's removed from DungeonScreenProps)
  - [ ] T6.4: Pass `runOutcome` (non-null coercion safe since we only render when outcome arrived)
    and `gameState` to PostRunSummaryScreen

- [ ] T7: App.tsx (mobile) — replace post-run placeholders with Return to Camp screen (AC5)
  - [ ] T7.1: Replace the two separate `phase === 'post-run'` blocks (failed/complete) with a
    single `PostRunMobileScreen` inline component or just inline JSX
  - [ ] T7.2: The screen shows outcome label + "Return to Camp" button
  - [ ] T7.3: On button tap: call `session.sendReturnToCamp()`, then disable the button
    (local state: `const [returned, setReturned] = useState(false)`)
  - [ ] T7.4: After tap, show "Waiting for others..." in place of the button

- [ ] T8: Contract test (AC8)
  - [ ] T8.1: Create `tests/contract/return-to-camp-msg.test.ts`:
    serialize → deserialize round-trip for `ReturnToCampMsg`

- [ ] T9: Verify and finalize
  - [ ] T9.1: Run `npm run typecheck --workspace=packages/net-protocol`
  - [ ] T9.2: Run `npm run typecheck --workspace=apps/simulation-server`
  - [ ] T9.3: Run `npm run typecheck --workspace=apps/host-client`
  - [ ] T9.4: Run `npm run typecheck --workspace=apps/mobile-controller`
  - [ ] T9.5: Run `npm test --workspace=tests` (101+ tests must pass)

---

## Dev Notes

### Current State of post-run in the Codebase

**Host App.tsx (line 69–72):**
```tsx
if (gameState?.session.phase === 'dungeon' || gameState?.session.phase === 'post-run') {
  return <DungeonScreen gameState={gameState} session={session} latestTransientDelta={latestTransientDelta} runOutcome={runOutcome} />;
}
```

**DungeonScreen.tsx** has three post-run overlay divs (all with `zIndex: 50`, full-inset, over the canvas):
- `phase === 'post-run' && runOutcome === 'failed'` (~line 359–397): "The run ends here." with partial essence
- `phase === 'post-run' && runOutcome === 'complete'` (~line 399–437): "Level Clear." with total essence
- `phase === 'post-run' && runOutcome === null` (~line 439–453): "Run ended." fallback

**Mobile App.tsx** has two blocks (~lines 154–217):
- `phase === 'post-run' && runOutcome === 'failed'`: corruption-blood background, "Return to Camp — coming soon."
- `phase === 'post-run' && runOutcome === 'complete'`: bg-base background, "Return to Camp — coming soon."

Both need to be replaced. The `runOutcome` state already exists and is set correctly in both App.tsx files from the delta handlers. No new state needed.

### T1: EventNames + Message Type

In `packages/net-protocol/src/event-names.ts`:
```typescript
export enum EventNames {
  SNAPSHOT = 'snapshot',
  DELTA = 'delta',
  INPUT = 'input',
  JOIN_REQUEST = 'join_request',
  JOIN_RESPONSE = 'join_response',
  HOST_START = 'host:start',
  CLASS_SELECT = 'class:select',
  COOLDOWN_UPDATE = 'cooldown:update',
  SPIRIT_FORM = 'spirit:form',
  RETURN_TO_CAMP = 'return:to-camp',  // Story 4.5 addition
}
```

In `packages/net-protocol/src/messages/mobile-to-server.ts`, append:
```typescript
export interface ReturnToCampMsg {
  type: 'return:to-camp';
}
```

In `packages/net-protocol/src/index.ts`, update the mobile-to-server export line:
```typescript
export type { InputEventMsg, JoinRequestMsg, ClassSelectMsg, ReturnToCampMsg } from './messages/mobile-to-server.js';
```

### T2: MobileSession Interface

In `apps/mobile-controller/src/session/mobile-session.ts`, the `MobileSession` interface (~line 18–20) currently has:
```typescript
export interface MobileSession {
  playerId: string;
  roomId: string;
  sendInput: (msg: InputEventMsg) => void;
  sendClassSelect: (msg: ClassSelectMsg) => void;
  disconnect: () => void;
}
```

Add one line:
```typescript
  sendReturnToCamp: () => void;
```

Both `joinSession` (~line 113) and `reconnectToSession` (~line 145) return objects. In each, add:
```typescript
sendReturnToCamp: () => room.send(EventNames.RETURN_TO_CAMP, { type: 'return:to-camp' } satisfies ReturnToCampMsg),
```

Import `ReturnToCampMsg` at the top: `import type { ..., ReturnToCampMsg } from 'net-protocol';`

### T3: GameRoom.ts — Return Handler + Hub Reset

**Private field** (add near other private fields, ~line 102):
```typescript
private returnReadySet = new Set<string>();
```

**Handler** (add inside `onCreate` after the existing `onMessage(EventNames.INPUT, ...)` block):
```typescript
this.onMessage(EventNames.RETURN_TO_CAMP, (client: Client) => {
  if (this.gameState.session.phase !== 'post-run') return;  // guard: only valid post-run
  this.returnReadySet.add(client.sessionId);

  const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
  const allConfirmed = activePlayers.length > 0 &&
    activePlayers.every(p => this.returnReadySet.has(p.id));

  if (allConfirmed) {
    this.resetToHub();
  }
});
```

**resetToHub private method** (add after onCreate):
```typescript
private resetToHub(): void {
  // Destroy enemy physics bodies
  for (const [id, body] of this.enemyBodies) {
    this.physicsWorld.destroyBody(body);
    this.enemyBodies.delete(id);
  }
  // Destroy victory trigger body if Story 4.3 added one
  // (check: if (this.victoryTriggerBody) { this.physicsWorld.destroyBody(this.victoryTriggerBody); this.victoryTriggerBody = null; })
  // Destroy essence sensor bodies
  for (const [, body] of this.essenceSensorBodies) {
    this.physicsWorld.destroyBody(body);
  }
  this.essenceSensorBodies.clear();

  // Clear game state arrays
  this.gameState.enemies = [];
  this.gameState.essenceDrops = [];
  this.gameState.bonds = [];

  // Reset each player to hub state
  for (let i = 0; i < this.gameState.players.length; i++) {
    const player = this.gameState.players[i]!;
    const spawn = SPAWN_POSITIONS[i] ?? { x: 960, y: 540 };
    player.x = spawn.x;
    player.y = spawn.y;
    player.hp = player.maxHp;
    player.isDown = false;
    player.isSpirit = false;
    player.isFrozen = false;     // thaw frozen players so they can play next run
    player.nearPoiId = null;
    player.reviveTimerExpiresAt = 0;
    player.essenceTotal = 0;
    player.downCount = 0;
    // Move player physics body to hub spawn
    const body = this.playerBodies.get(player.id);
    if (body) body.setPosition({ x: spawn.x, y: spawn.y });
  }

  // Reset session
  this.gameState.session.phase = 'hub';
  this.gameState.session.levelIndex = 0;

  // Clear server-local dungeon state
  this.returnReadySet.clear();
  this.inputQueue = [];
  this.cooldownMap.clear();
  this.spiritCooldownMap.clear();
  this.lastKnownJoystick.clear();
  this.enemyAttackCooldowns.clear();
  this.pendingPoiBeginContacts = [];
  this.pendingPoiEndContacts = [];
  this.pendingEssenceBeginContacts = [];

  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, snapshot);
  logger.info({ roomId: this.roomId }, 'all players returned to camp — hub reset');
}
```

**Victory trigger body**: Story 4.3 adds `createVictoryTriggerBody` inside `loadLevel()`. Check if there's a `private victoryTriggerBody: Body | null = null` field in GameRoom.ts. If yes, destroy and null it in resetToHub. If it was added as a local variable inside loadLevel without a class field, it's already gone (no cleanup needed). Read the actual 4.3 implementation before assuming.

**Player ID vs session ID**: `player.id === client.sessionId` — this is established in GameRoom.ts's `onJoin` where `createPlayer(client.sessionId, ...)`. The `returnReadySet` uses `client.sessionId` and the readiness check uses `p.id`. These are the same value. No mapping needed.

### T4: PostRunSummaryScreen.tsx

Full component:
```tsx
import type { GameState } from 'shared-types';
import { CLASS_DEFINITIONS } from 'shared-types';

interface PostRunSummaryScreenProps {
  gameState: GameState;
  runOutcome: 'complete' | 'failed';
}

export function PostRunSummaryScreen({ gameState, runOutcome }: PostRunSummaryScreenProps) {
  const isVictory = runOutcome === 'complete';
  const totalEssence = gameState.players.reduce((s, p) => s + p.essenceTotal, 0);
  const headline = isVictory
    ? 'Purified. The campfire noticed.'
    : 'Tonight, the forest held its ground.';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: '0 32px',
      boxSizing: 'border-box',
    }}>
      {/* Headline */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 40,  // xl
        color: isVictory ? 'var(--accent-spirit)' : 'var(--text-secondary)',
        textAlign: 'center',
        maxWidth: 800,
      }}>
        {headline}
      </div>

      {/* Team Spirit Essence */}
      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-lg)',
        color: 'var(--accent-warm)',
      }}>
        Spirit Essence earned: {totalEssence}
      </div>

      {/* Per-player cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 640,
      }}>
        {gameState.players.map(player => {
          const className = player.class
            ? (CLASS_DEFINITIONS[player.class]?.displayName ?? player.class)
            : '—';
          const dimmed = !isVictory;
          return (
            <div key={player.id} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              {/* Name */}
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-base)',
                color: dimmed ? 'var(--text-secondary)' : 'var(--text-primary)',
                minWidth: 100,
              }}>
                {player.displayName}
              </span>
              {/* Class */}
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                flex: 1,
              }}>
                {className}
              </span>
              {/* Downed count */}
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                minWidth: 80,
                textAlign: 'center',
              }}>
                Downed ×{player.downCount}
              </span>
              {/* Essence */}
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-base)',
                color: 'var(--accent-warm)',
                minWidth: 60,
                textAlign: 'right',
              }}>
                {player.essenceTotal}
              </span>
            </div>
          );
        })}
      </div>

      {/* Waiting hint — screen persists until server sends hub snapshot */}
      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Return to Camp on your phone to continue
      </div>
    </div>
  );
}
```

**Note on `var(--text-muted)`**: Check if this token exists in the design system. If not, use `var(--text-secondary)`.

### T6: App.tsx (host) Routing Change

Current code (~lines 69–71):
```tsx
if (gameState?.session.phase === 'dungeon' || gameState?.session.phase === 'post-run') {
  return <DungeonScreen gameState={gameState} session={session} latestTransientDelta={latestTransientDelta} runOutcome={runOutcome} />;
}
```

Replace with:
```tsx
if (gameState?.session.phase === 'dungeon') {
  return <DungeonScreen gameState={gameState} session={session} latestTransientDelta={latestTransientDelta} />;
}
if (gameState?.session.phase === 'post-run') {
  // runOutcome can briefly be null if the host reconnects mid-post-run; fall back to 'complete'
  return <PostRunSummaryScreen gameState={gameState} runOutcome={runOutcome ?? 'complete'} />;
}
```

Add import: `import { PostRunSummaryScreen } from './screens/PostRunSummaryScreen';`

### T7: App.tsx (mobile) — Return to Camp Screen

Replace the two separate blocks (~lines 154–217) with one unified check:
```tsx
if (gameState?.session.phase === 'post-run') {
  const isVictory = runOutcome === 'complete';
  return <PostRunMobileScreen
    isVictory={isVictory}
    onReturnToCamp={() => session?.sendReturnToCamp()}
  />;
}
```

`PostRunMobileScreen` can be a small inline function component at the top of App.tsx (or in the same file):
```tsx
function PostRunMobileScreen({ isVictory, onReturnToCamp }: { isVictory: boolean; onReturnToCamp: () => void }) {
  const [returned, setReturned] = useState(false);
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: isVictory ? 'var(--bg-base)' : 'var(--bg-surface)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: '0 32px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        color: isVictory ? 'var(--accent-spirit)' : 'var(--text-secondary)',
        textAlign: 'center',
      }}>
        {isVictory ? 'Victory!' : 'Run Ended'}
      </div>
      <button
        disabled={returned}
        onPointerDown={e => {
          if (returned) return;
          e.preventDefault();
          setReturned(true);
          onReturnToCamp();
        }}
        style={{
          minHeight: 56,
          minWidth: 200,
          background: returned ? 'var(--bg-surface)' : 'var(--interactive)',
          border: 'none',
          borderRadius: 8,
          cursor: returned ? 'default' : 'pointer',
          opacity: returned ? 0.5 : 1,
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-md)',
          color: returned ? 'var(--text-secondary)' : 'var(--bg-base)',
          touchAction: 'manipulation',
        }}
      >
        {returned ? 'Waiting for others…' : 'Return to Camp'}
      </button>
    </div>
  );
}
```

Since this is an inline component, add `useState` import if it's not already destructured. Mobile App.tsx already imports `useState`.

### T8: Contract Test

`tests/contract/return-to-camp-msg.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { ReturnToCampMsg } from 'net-protocol';

describe('ReturnToCampMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: ReturnToCampMsg = { type: 'return:to-camp' };
    expect(deserialize<ReturnToCampMsg>(serialize(msg))).toEqual(msg);
  });
});
```

### What NOT to Redo

- The `runOutcome` state in both App.tsx files — already correct; set from delta handlers
- `applyDelta` — `run:complete` and `run:failed` already flip `session.phase = 'post-run'`; no changes
- `latestTransientDelta` clearing (setTimeout 400ms) in host App.tsx — keep as-is
- DungeonScreen canvas, PixiJS, revive timers, HUD strip — touch NOTHING except removing the three post-run overlays
- The host App.tsx `runOutcome` reset — it never resets `runOutcome` back to null; that is intentional (summary always shows the outcome)

### Key Invariant: gameState Snapshot Timing

When the server sends the hub-reset snapshot, the host's `gameState` state changes from the post-run state (with essence totals, downCounts, etc.) to the hub state (reset). The PostRunSummaryScreen is unmounted at this point (App.tsx switches back to HubWorldScreen). This means the summary reads correct values during the entire post-run phase, and the data is gone once the hub snapshot arrives — which is correct behavior.

### victory trigger body from 4.3/4.4

Story 4.3 adds `createVictoryTriggerBody`. Check GameRoom.ts for a `private victoryTriggerBody: Body | null` field (or similar). If it exists, add to `resetToHub()`:
```typescript
if (this.victoryTriggerBody) {
  this.physicsWorld.destroyBody(this.victoryTriggerBody);
  this.victoryTriggerBody = null;
}
```

If it's not a class field (created as a local and immediately set in a sensor contact handler), search for how the body is referenced and destroy it appropriately. This is the most likely code to need inspection before implementing T3.

### Ownership Scope Note

This story legitimately crosses all four ownership areas:
- Protocol Architect (T1): net-protocol EventNames + message type
- Simulation Engineer (T3): GameRoom.ts handler + hub reset
- Host Experience Engineer (T4, T5, T6): PostRunSummaryScreen + App routing
- Mobile Controller Engineer (T7): mobile post-run screen + return flow

This is expected for a story that closes the full run loop. Cross-context approval is implicit in the epic plan.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

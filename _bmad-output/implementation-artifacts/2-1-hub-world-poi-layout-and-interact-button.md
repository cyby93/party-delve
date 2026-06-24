---
baseline_commit: 9360dc7
---

# Story 2.1: Hub World — POI Layout & Interact Button

Status: done

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Epic 1 is complete. Players can join, appear in the hub, and move around. This story
  adds static POI zones to the hub, proximity detection in the sim server, and a contextual
  interact button on mobile that slides in when a player approaches a POI. The host canvas
  renders POI icons and a chat-bubble indicator above the nearby player's character.
Owner agent: Multi-context (explicit cross-context approval — all four layers are required
  simultaneously for the interact button to function end-to-end):
    Protocol Architect (Tasks 1–2), Simulation Engineer (Task 3),
    Host Experience Engineer (Task 4), Mobile Controller Engineer (Task 5)
Goal: Render 3 POI zones in the hub world; detect player proximity via Euclidean distance in
  the tick loop; broadcast poi-entered / poi-exited deltas so the host shows a chat-bubble and
  mobile shows a sliding interact button.
Allowed paths:
  - packages/shared-types/**
  - packages/net-protocol/**
  - apps/simulation-server/**
  - apps/host-client/src/screens/HubWorldScreen.tsx
  - apps/mobile-controller/src/screens/ControllerScreen.tsx
  - apps/mobile-controller/src/App.tsx
  - tests/contract/net-protocol.test.ts
Blocked paths:
  - packages/game-rules/**             (planck.js physics world is Story 3.1)
  - apps/backend-platform/**
  - apps/host-client/** except HubWorldScreen.tsx
  - apps/mobile-controller/** except ControllerScreen.tsx and App.tsx
Inputs:
  - packages/shared-types/src/player.ts      (no nearPoiId yet)
  - packages/net-protocol/src/apply-delta.ts (no poi delta handlers yet)
  - packages/net-protocol/src/event-names.ts (no POI event names yet)
  - apps/simulation-server/src/rooms/GameRoom.ts (no poi proximity in tick)
  - apps/host-client/src/screens/HubWorldScreen.tsx (no POI icons or chat bubbles)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (no interact button)
Non-goals:
  - planck.js sensor bodies for POI detection (deferred to Story 3.1)
  - Class selection flow UI (Story 2.2)
  - Training dummy interactability (Story 2.4)
  - Dungeon entrance interaction (Story 4.2)
  - Any class-specific or combat logic
  - Actual POI UI screens (just the proximity detection and button)
Acceptance criteria: see AC section below
Required hooks:
  - Contract-change hook (packages/shared-types and packages/net-protocol changes in Tasks 1–2)
  - Simulation-safety hook (apps/simulation-server changes in Task 3)
  - Client-UX hook (host and mobile changes in Tasks 4–5)
Required tests:
  - Contract test: PlayerPoiEnteredDelta serialize → deserialize round-trip
  - Contract test: PlayerPoiExitedDelta serialize → deserialize round-trip
  - Contract test: applyDelta sets nearPoiId on player:poi-entered
  - Contract test: applyDelta clears nearPoiId on player:poi-exited
  - Contract test: applyDelta returns same reference for unknown playerId on poi events
Telemetry impact: none (no new user flows requiring telemetry in this story)
```

---

## Cross-Context Ownership Note

This story spans Protocol Architect, Simulation Engineer, Host Experience Engineer, and
Mobile Controller Engineer. All four layers are tightly coupled: the interact button cannot
appear on mobile until the sim detects proximity, which requires the new delta types, which
requires shared-types changes. Splitting into four sequential stories would require blocking
dependencies between each split. Explicit cross-context approval is granted for this story.

---

## Story

As a player,
I want to walk my character around the hub village and see a contextual "Interact" button
appear when I approach a point of interest,
so that I know where the meaningful locations are and can engage with them.

---

## Acceptance Criteria

**AC1 — POI icons on host canvas:**
**Given** a player is in the hub world
**When** the hub canvas renders
**Then** at least three POI zones are visible on the host canvas: class selection, training dummy,
and dungeon entrance
**And** each POI has an in-canvas visual marker (PixiJS Graphics — colored shape + label text) that
distinguishes it from the flat background
**And** the dungeon entrance POI is rendered as visually locked/greyed (dimmed opacity) — it is
non-interactive until Epic 4

---

**AC2 — Chat-bubble on host canvas when near a POI:**
**Given** a player's character moves near a class selection or training dummy POI
**When** the sim server detects the character is within interaction range (Euclidean distance
< poi.radius in virtual 1920×1080 space)
**Then** a `player:poi-entered` delta event is broadcast to all clients
**And** a chat-bubble icon (in-canvas PixiJS render — NOT an HTML overlay) appears above the
character's head on the host canvas
**And** the chat bubble disappears when the player moves out of range

---

**AC3 — Interact button slides in on mobile:**
**Given** the mobile client receives the `player:poi-entered` delta for the player's own slot
**When** the delta is applied to local gameState (nearPoiId is set on the player's state)
**And** the ControllerScreen detects the player's own nearPoiId is non-null
**Then** the `interact-button` slides in from the top edge of the phone screen
(`translateY(-100%)` → `translateY(0)`, ~200ms ease-out)
**And** the button label reads "Interact" in Lora 700 at md size (var(--text-md))
**And** the button has an `accent-spirit` border (2px), spirit glow shadow, `bg-surface`
background, and minimum 44px height
**And** the button is full-width or close to it (≥80% of screen width, centered)

---

**AC4 — Interact button slides out on mobile:**
**Given** the player's character moves out of POI range
**When** the sim server sends a `player:poi-exited` delta
**And** nearPoiId is cleared to null in gameState
**Then** the interact button slides back off the top edge using the same ~200ms ease-out motion
**And** the chat-bubble disappears from the host canvas simultaneously

---

**AC5 — Dungeon entrance: non-interactive:**
**Given** a player's character approaches the dungeon entrance POI
**When** the character enters its visual area
**Then** NO `player:poi-entered` delta is broadcast for the dungeon entrance
**And** the interact button does NOT appear on mobile for the dungeon entrance
**And** the dungeon entrance icon on the host canvas remains at reduced opacity (greyed state)

---

**AC6 — nearPoiId in snapshots:**
**Given** a player is inside a POI zone when a reconnect occurs
**When** the sim sends a full SnapshotMsg to the reconnecting client
**Then** the snapshot's player state includes `nearPoiId` set to the current POI id
**And** the mobile client correctly shows the interact button immediately after reconnect

---

### Review Findings

- [x] [Review][Patch] Double traversal to retrieve poi after proximity match [`apps/simulation-server/src/rooms/GameRoom.ts` tick()] — fixed: capture `matchedPoi` reference in inner loop; removed second `.find()` and non-null assertion
- [x] [Review][Defer] Missing poi-exited delta when player transitions directly between overlapping POIs [`apps/simulation-server/src/rooms/GameRoom.ts` tick()] — deferred, pre-existing design constraint (current POI layout has no overlaps; "POIs don't overlap" is a stated invariant)

---

## Tasks / Subtasks

- [x] **Task 1: Add POI types to shared-types** (AC: #1, #2, #3, #4, #5) — Protocol Architect
  - [x] Create `packages/shared-types/src/poi.ts` — PoiType enum, PoiDefinition interface, HUB_POIS constant (see Dev Notes §Task 1)
  - [x] Edit `packages/shared-types/src/player.ts` — add `nearPoiId: string | null` to PlayerState
  - [x] Edit `packages/shared-types/src/index.ts` — add `export * from './poi.js'`
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 2: Add POI delta types and applyDelta handlers** (AC: #2, #3, #4) — Protocol Architect
  - [x] Edit `packages/net-protocol/src/messages/server-to-host.ts` — add PlayerPoiEnteredDelta, PlayerPoiExitedDelta types and add to DeltaEventMsg union (see Dev Notes §Task 2)
  - [x] Edit `packages/net-protocol/src/apply-delta.ts` — add `player:poi-entered` and `player:poi-exited` cases (see Dev Notes §Task 2)
  - [x] Edit `packages/net-protocol/src/event-names.ts` — no new EventName needed; poi events flow through the existing `EventNames.DELTA` channel (see Dev Notes §Task 2)
  - [x] Edit `tests/contract/net-protocol.test.ts` — add 5 new contract tests (see Dev Notes §Task 2)
  - [x] Run `npm run typecheck` from repo root — must be clean
  - [x] Run `npm test --workspace=tests/contract` — all tests must pass

- [x] **Task 3: POI proximity detection in sim server tick** (AC: #2, #4, #5, #6) — Simulation Engineer
  - [x] Edit `apps/simulation-server/src/rooms/GameRoom.ts` — `createPlayer()` initializes `nearPoiId: null` (see Dev Notes §Task 3)
  - [x] Add POI proximity check to the `tick()` method (see Dev Notes §Task 3)
  - [x] Emit `player:poi-entered` delta (broadcast) when player crosses into range of an interactive POI
  - [x] Emit `player:poi-exited` delta (broadcast) when player leaves range
  - [x] Only `class-select` and `training-dummy` trigger deltas; `dungeon-entrance` is skipped
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 4: POI icons and chat bubble on host canvas** (AC: #1, #2, #4, #5) — Host Experience Engineer
  - [x] Edit `apps/host-client/src/screens/HubWorldScreen.tsx` — render static POI graphics in `renderFrame()` (see Dev Notes §Task 4)
  - [x] Render chat-bubble Text above a player's circle when `player.nearPoiId !== null`
  - [x] Dungeon entrance rendered at reduced opacity (0.35) compared to interactive POIs (1.0)
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 5: Interact button on mobile controller** (AC: #3, #4) — Mobile Controller Engineer
  - [x] Edit `apps/mobile-controller/src/screens/ControllerScreen.tsx` — derive `activePoi` from gameState + session, add InteractButton component (see Dev Notes §Task 5)
  - [x] Implement slide animation via CSS transition on `translateY` (see Dev Notes §Task 5)
  - [x] InteractButton: label "Interact" in Lora 700 md, accent-spirit 2px border, spirit glow shadow, bg-surface background, min 44px height, 8px border-radius
  - [x] Run `npm run typecheck` from repo root — must be clean

---

## Dev Notes

### Proximity Detection Strategy: Euclidean Distance, NOT planck.js

Story 3.1 ("xoshiro128++ PRNG & planck.js Physics World") formally introduces the planck.js
physics world and steps it inside the tick loop. That story specifically creates
`packages/game-rules/src/physics/world.ts`.

Story 2.1 intentionally uses **simple Euclidean distance checks** inside `GameRoom.tick()`.
This is correct architecture for this phase:
- No planck.js import in `apps/simulation-server` yet (clean slate, Story 3.1 adds it)
- The distance check is cheap: 3 POIs × up to 8 players = 24 comparisons per tick maximum
- Story 3.1 or a future hardening pass can migrate to planck sensors if desired

Do NOT introduce planck.js in this story. `packages/game-rules` must remain untouched.

---

### Task 1 — Dev Notes: shared-types/src/poi.ts

Create this new file at `packages/shared-types/src/poi.ts`:

```typescript
export enum PoiType {
  CLASS_SELECT    = 'class-select',
  TRAINING_DUMMY  = 'training-dummy',
  DUNGEON_ENTRANCE = 'dungeon-entrance',
}

export interface PoiDefinition {
  id: string;
  x: number;      // virtual 1920×1080 coordinate space
  y: number;
  radius: number; // interaction radius in virtual pixels
  type: PoiType;
}

// Static hub world POI layout — positions are in the virtual 1920×1080 space.
// Players spawn near (960, 540) center. Campfire is at center.
// Dungeon entrance is top-center (leading "out" of the village).
export const HUB_POIS: ReadonlyArray<PoiDefinition> = [
  { id: 'class-select',     x: 400,  y: 540, radius: 120, type: PoiType.CLASS_SELECT },
  { id: 'training-dummy',   x: 1520, y: 400, radius: 120, type: PoiType.TRAINING_DUMMY },
  { id: 'dungeon-entrance', x: 960,  y: 180, radius: 120, type: PoiType.DUNGEON_ENTRANCE },
];

// Subset of HUB_POIS that send proximity events. Dungeon entrance is excluded until Epic 4.
export const INTERACTIVE_HUB_POIS: ReadonlyArray<PoiDefinition> = HUB_POIS.filter(
  p => p.type !== PoiType.DUNGEON_ENTRANCE,
);
```

**`packages/shared-types/src/player.ts`** — add one field to `PlayerState`:
```typescript
// Before:
export interface PlayerState {
  id: string;
  displayName: string;
  class: PlayerClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  isFrozen: boolean;
  isDown: boolean;
  isSpirit: boolean;
  sessionColor: SessionColor;
  downCount: number;
}

// After — append nearPoiId:
export interface PlayerState {
  id: string;
  displayName: string;
  class: PlayerClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  isFrozen: boolean;
  isDown: boolean;
  isSpirit: boolean;
  sessionColor: SessionColor;
  downCount: number;
  nearPoiId: string | null;  // null = not near any interactive POI
}
```

**`packages/shared-types/src/index.ts`** — append:
```typescript
export * from './poi.js';
```

**After adding `nearPoiId` to `PlayerState`**, the `createPlayer()` function in
`apps/simulation-server/src/rooms/GameRoom.ts` will fail typecheck until Task 3 adds
`nearPoiId: null` to the returned object. Run typecheck only after both tasks are done together,
or fix `GameRoom.ts` in the same PR.

---

### Task 2 — Dev Notes: net-protocol POI delta types and applyDelta

**`packages/net-protocol/src/messages/server-to-host.ts`** — add two new delta types and
extend the union. Insert after `EssenceCollectedDelta`:

```typescript
export type PlayerPoiEnteredDelta = {
  type: 'player:poi-entered';
  playerId: string;
  poiId: string;
  poiType: string;  // PoiType value — use string to avoid circular import between packages
};

export type PlayerPoiExitedDelta = {
  type: 'player:poi-exited';
  playerId: string;
};
```

Update `DeltaEventMsg` union (append to the end before `;`):
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
  | PlayerPoiEnteredDelta    // NEW
  | PlayerPoiExitedDelta;    // NEW
```

**`packages/net-protocol/src/apply-delta.ts`** — add two new cases before the `default` return.
Note: `applyDelta` operates on `GameState` which now has `nearPoiId` on players:

```typescript
case 'player:poi-entered': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, nearPoiId: evt.poiId } : p
    ),
  };
}
case 'player:poi-exited': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, nearPoiId: null } : p
    ),
  };
}
```

**No new EventName needed.** Both new delta types flow through the existing `EventNames.DELTA`
channel, exactly as `player:moved`, `player:disconnected` etc. do. The `DeltaEventMsg` union
discriminates on `type`. No new constant in event-names.ts.

**`tests/contract/net-protocol.test.ts`** — add 5 new tests. First add the new types to the
existing `net-protocol` import at the top of the file:
```typescript
import type { SnapshotMsg, DeltaEventMsg, PlayerPoiEnteredDelta, PlayerPoiExitedDelta } from 'net-protocol';
```

Then append inside the test file (use the existing `describe` blocks as a guide):
```typescript
describe('PlayerPoiEnteredDelta round-trip', () => {
  it('serializes and deserializes', () => {
    const msg: DeltaEventMsg = {
      type: 'player:poi-entered',
      playerId: 'p1',
      poiId: 'class-select',
      poiType: 'class-select',
    };
    expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
  });
});

describe('PlayerPoiExitedDelta round-trip', () => {
  it('serializes and deserializes', () => {
    const msg: DeltaEventMsg = { type: 'player:poi-exited', playerId: 'p1' };
    expect(deserialize<DeltaEventMsg>(serialize(msg))).toEqual(msg);
  });
});

describe('applyDelta POI cases', () => {
  it('player:poi-entered sets nearPoiId', () => {
    const state = mockGameStateWithPlayer('p1');  // use existing mock helper or inline one
    const next = applyDelta(state, { type: 'player:poi-entered', playerId: 'p1', poiId: 'class-select', poiType: 'class-select' });
    expect(next.players[0]!.nearPoiId).toBe('class-select');
  });

  it('player:poi-exited clears nearPoiId', () => {
    const base = mockGameStateWithPlayer('p1');
    const withPoi = applyDelta(base, { type: 'player:poi-entered', playerId: 'p1', poiId: 'class-select', poiType: 'class-select' });
    const cleared = applyDelta(withPoi, { type: 'player:poi-exited', playerId: 'p1' });
    expect(cleared.players[0]!.nearPoiId).toBeNull();
  });

  it('player:poi-entered returns same reference for unknown playerId', () => {
    const state = mockGameStateWithPlayer('p1');
    const next = applyDelta(state, { type: 'player:poi-entered', playerId: 'ghost', poiId: 'class-select', poiType: 'class-select' });
    expect(next).toBe(state);
  });

  it('player:poi-exited returns same reference for unknown playerId', () => {
    const state = mockGameStateWithPlayer('p1');
    const next = applyDelta(state, { type: 'player:poi-exited', playerId: 'ghost' });
    expect(next).toBe(state);
  });
});
```

Look at the existing `mockGameState()` helper in the test file and adapt accordingly. If it
already populates `players[]`, add `nearPoiId: null` to the mock player shape.

---

### Task 3 — Dev Notes: GameRoom proximity detection

**Current state of `GameRoom.createPlayer()`** (line ~39 in `GameRoom.ts`):
```typescript
function createPlayer(id: string, displayName: string, slotIndex: number): PlayerState {
  const spawn = SPAWN_POSITIONS[slotIndex] ?? { x: 960, y: 540 };
  return {
    id,
    displayName,
    class: PlayerClass.STONEHIDE,
    x: spawn.x,
    y: spawn.y,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SESSION_COLORS[slotIndex % SESSION_COLORS.length] ?? SessionColor.RED,
    downCount: 0,
    // NEW — add this:
    nearPoiId: null,
  };
}
```

**Proximity check in `tick()`.** Add this block near the end of the `tick()` method, after
the movement loop. Import `INTERACTIVE_HUB_POIS` from `shared-types`:

```typescript
// At the top of GameRoom.ts, add to existing shared-types import:
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor, INTERACTIVE_HUB_POIS } from 'shared-types';
```

Inside `tick()`, after the movement loop:
```typescript
// POI proximity — Euclidean distance check (planck.js sensor migration deferred to Story 3.1)
for (const player of this.gameState.players) {
  if (player.isFrozen) continue;

  let newPoiId: string | null = null;
  for (const poi of INTERACTIVE_HUB_POIS) {
    const dx = player.x - poi.x;
    const dy = player.y - poi.y;
    if (dx * dx + dy * dy < poi.radius * poi.radius) {
      newPoiId = poi.id;
      break; // POIs don't overlap — first match wins
    }
  }

  if (player.nearPoiId !== newPoiId) {
    player.nearPoiId = newPoiId;
    if (newPoiId !== null) {
      const poi = INTERACTIVE_HUB_POIS.find(p => p.id === newPoiId)!;
      const enteredDelta = {
        type: 'player:poi-entered' as const,
        playerId: player.id,
        poiId: poi.id,
        poiType: poi.type,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, enteredDelta);
    } else {
      const exitedDelta = {
        type: 'player:poi-exited' as const,
        playerId: player.id,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, exitedDelta);
    }
  }
}
```

**No new `onMessage` handler needed** — the mobile client does not send any message in
response to the interact button appearing. The mobile sends an `interact` input only when the
player taps the button (Story 2.2+). Do NOT pre-register a handler; adding an unhandled
message type in a future story would not cause a 4002 disconnect.

**Performance note:** This proximity check is 8 × 2 = 16 multiplications and comparisons per
tick in the worst case. Well within the 33ms tick budget. No pre-allocation needed.

**Logging note:** Do NOT add `logger.info` or `logger.warn` inside the proximity check loop —
it runs every tick. Per project rules, only `logger.debug` is permitted inside hot loops (and
debug is disabled in prod).

---

### Task 4 — Dev Notes: Host canvas POI icons and chat bubble

**Current state of `HubWorldScreen.tsx`**: The `renderFrame()` function iterates over
`state.players` and draws colored circles. The PixiJS stage uses a virtual 1920×1080 coordinate
space scaled to the actual screen. The app init sets `background: 0x0f0e10` (--bg-base).

**Design: keep renderFrame() as a single function, not split into layers yet.** The layered
renderer architecture (`pixi/layers/`) is planned for later epics when the PixiJS scene
becomes complex enough to justify it. For Story 2.1, add POI rendering directly in
`HubWorldScreen.tsx` following the existing pattern.

**POI rendering approach:**

Import `HUB_POIS` and `PoiType` from `shared-types`. Create one `Graphics` object per POI
(reuse across renders, same as `playerGraphics` map). Add a `poiGraphics` ref.

```typescript
// Add to imports
import { HUB_POIS, PoiType } from 'shared-types';

// Add ref alongside playerGraphicsRef
const poiGraphicsRef = useRef<Map<string, { body: Graphics; label: Text }>>(new Map());
```

In `initPixi()`, after app init, draw the static POI graphics once (they never change):
```typescript
// Draw static POI icons into the stage once
import { Text, TextStyle } from 'pixi.js';

for (const poi of HUB_POIS) {
  const isDungeon = poi.type === PoiType.DUNGEON_ENTRANCE;
  const g = new Graphics();
  // Draw a colored hexagon/diamond shape at poi.x, poi.y
  // Colors: class-select → 0x6ea8d8 (accent-spirit), training-dummy → 0xc07d35 (accent-warm),
  //         dungeon-entrance → 0x36334a (border) at reduced opacity
  const color = poi.type === PoiType.CLASS_SELECT ? 0x6ea8d8
    : poi.type === PoiType.TRAINING_DUMMY ? 0xc07d35
    : 0x36334a;
  g.roundRect(-24, -24, 48, 48, 6).fill({ color });
  g.position.set(poi.x, poi.y);
  g.alpha = isDungeon ? 0.35 : 1.0;
  app.stage.addChild(g);

  const label = new Text({
    text: poi.type === PoiType.CLASS_SELECT ? 'CLASS'
      : poi.type === PoiType.TRAINING_DUMMY ? 'TRAIN'
      : 'GATE',
    style: new TextStyle({
      fontFamily: 'Lora, serif',
      fontSize: 14,
      fill: isDungeon ? 0x6b6480 : 0xd8d0e8,
    }),
  });
  label.anchor.set(0.5, 0);
  label.position.set(poi.x, poi.y + 28);
  label.alpha = isDungeon ? 0.35 : 1.0;
  app.stage.addChild(label);

  poiGraphicsRef.current.set(poi.id, { body: g, label });
}
```

**Chat bubble in `renderFrame()`**: Add a chat bubble Text above each player's circle when
`player.nearPoiId !== null`. Extend the `playerGraphics` map value to include an optional
`chatBubble` Text:

```typescript
// Change playerGraphics map value type to include chatBubble
const playerGraphicsRef = useRef<Map<string, { circle: Graphics; chatBubble: Text | null }>>(new Map());
```

In `renderFrame()`, after setting the circle position:
```typescript
let entry = playerGraphicsRef.current.get(player.id);
if (!entry) {
  const circle = new Graphics();
  const chatBubble = new Text({ text: '💬', style: new TextStyle({ fontSize: 20 }) });
  chatBubble.anchor.set(0.5, 1);
  app.stage.addChild(circle);
  app.stage.addChild(chatBubble);
  entry = { circle, chatBubble };
  playerGraphicsRef.current.set(player.id, entry);
}
const { circle, chatBubble } = entry;
circle.alpha = player.isFrozen ? 0.3 : 1;
circle.position.set(player.x, player.y);
circle.clear();
const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
circle.circle(0, 0, PLAYER_RADIUS).fill({ color });

// Chat bubble: appears PLAYER_RADIUS + 8 above the circle center
chatBubble.visible = player.nearPoiId !== null;
chatBubble.position.set(player.x, player.y - PLAYER_RADIUS - 8);
```

**Important: destroy both circle AND chatBubble when removing a player** (update the cleanup
loop):
```typescript
for (const [id, entry] of playerGraphicsRef.current) {
  if (!currentIds.has(id)) {
    app.stage.removeChild(entry.circle);
    entry.circle.destroy();
    app.stage.removeChild(entry.chatBubble);
    entry.chatBubble.destroy();
    playerGraphicsRef.current.delete(id);
  }
}
```

**Cleanup on unmount**: In the `useEffect` return function, iterate `poiGraphicsRef.current`
and destroy all POI graphics objects when the component unmounts.

**PixiJS v8 API notes** (use Context7 MCP for live docs — `npx -y @upstash/context7-mcp`):
- `new Text({ text, style: new TextStyle({...}) })` — v8 API (not `new PIXI.Text()`)
- `new Graphics()` then `.roundRect().fill()` — v8 fluent API
- `app.stage.addChild()` / `app.stage.removeChild()` — unchanged from v7
- Do NOT use `app.renderer.plugins` — that was removed in v8

---

### Task 5 — Dev Notes: Mobile interact button

**Current `ControllerScreen.tsx` state**: Renders a landscape layout with a floating joystick
on the left (40% width) and a 2×2 skill grid on the right (60% width). No interact button.
The component receives `session: MobileSession | null` and `gameState: GameState | null`.

**Derive activePoi inside ControllerScreen:**
```typescript
// Add to the component, near the top, after the existing refs:
const myPlayer = gameState?.players.find(p => p.id === session?.playerId);
const activePoi = myPlayer?.nearPoiId ?? null;
```

**InteractButton component** — add as a local component in the same file:
```typescript
interface InteractButtonProps {
  visible: boolean;
  onTap: () => void;
}

function InteractButton({ visible, onTap }: InteractButtonProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'env(safe-area-inset-top, 0px)',
        left: '10%',
        right: '10%',
        transform: visible ? 'translateY(0)' : 'translateY(-150%)',
        transition: 'transform 200ms ease-out',
        background: 'var(--bg-surface)',
        border: '2px solid var(--accent-spirit)',
        borderRadius: 8,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
        boxShadow: '0 0 12px rgba(110,168,216,0.4)',
        pointerEvents: visible ? 'auto' : 'none',
        touchAction: 'manipulation',
      }}
      onPointerDown={e => { e.preventDefault(); onTap(); }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
        }}
      >
        Interact
      </span>
    </div>
  );
}
```

**Add InteractButton to ControllerScreen's render tree**, inside the outermost container
`<div>` before the left/right zones (so it overlays both):
```typescript
return (
  <div style={{ position: 'relative', height: '100%', display: 'flex', ... }}>
    <InteractButton
      visible={activePoi !== null}
      onTap={() => { /* TODO Story 2.2 — open POI UI */ }}
    />
    {/* Left zone — floating joystick ... */}
    {/* Right zone — skill grid ... */}
  </div>
);
```

**Animation note:** Using CSS `transform: translateY(...)` + `transition` is the correct
approach — it avoids layout reflow and is GPU-composited. The `visible=false` state uses
`translateY(-150%)` (more than 100% to account for any safe-area offset).

**Safe area:** The button's `top: env(safe-area-inset-top, 0px)` ensures it sits below the
iOS/Android status bar. The `position: absolute` within the `position: relative` container
places it over the controller zones, not above in DOM flow.

**`pointerEvents: 'none'` when not visible** — prevents the invisible button from capturing
touches meant for the joystick zone when slid off-screen.

**Do not handle tapping yet in this story.** The `onTap` handler is a no-op TODO for Story 2.2
(class selection) and Story 2.4 (training dummy). The button must appear and disappear
correctly — that is this story's scope.

**Touch target:** The button is `left: 10%; right: 10%` = 80% of screen width, minHeight 44px.
On a typical landscape phone (e.g., 844px wide) that's ~675px × 44px — well above the 44×44px
minimum.

**Style notes:**
- `var(--text-md)` is `16px` at md scale per the design system
- `var(--bg-surface)` = `#181620` per design tokens
- `var(--accent-spirit)` = `#6ea8d8` — the spirit glow border color (same as `--interactive`)
- `var(--text-primary)` = `#d8d0e8`
- Spirit Chant glow rule (UX-DR11): spirit glow appears on interact button while visible — correct

---

### Project Structure Notes

- `packages/shared-types/src/poi.ts` is a **new file** — no existing file to read first
- `packages/net-protocol/src/messages/server-to-host.ts` — read current state before editing
  (already done in this analysis: lines 70–81 define `DeltaEventMsg`)
- `apps/simulation-server/src/rooms/GameRoom.ts` — update the existing import line (line 3) to
  also import `INTERACTIVE_HUB_POIS` from `shared-types`
- `apps/host-client/src/screens/HubWorldScreen.tsx` — existing file with working PixiJS setup;
  extend carefully, preserving the existing `useEffect` lifecycle (init, render, cleanup)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — existing working joystick; add
  InteractButton as a sibling, not a child of the joystick zone
- The `playerGraphicsRef` type in `HubWorldScreen.tsx` currently holds `Map<string, Graphics>`;
  it will change to `Map<string, { circle: Graphics; chatBubble: Text }>` — verify there are no
  other callers of this ref before changing the type

### Project Context Rules

- **No planck.js in this story.** Planck.js physics world is Story 3.1. Use Euclidean distance
  in the sim tick. Do not import `planck` anywhere.
- **No game-rules imports.** `apps/simulation-server` and `apps/host-client` must not import
  from `packages/game-rules`. The proximity check goes directly in `GameRoom.ts`.
- **No Math.random() in game logic.** The proximity check uses arithmetic only — no randomness
  involved, so this rule is not triggered.
- **Serialization discipline.** All messages flow through `EventNames.DELTA` channel using the
  existing `serialize`/`deserialize` wrappers. No raw `JSON.stringify` in app code.
- **No Colyseus @Schema.** POI state is in `PlayerState` (plain TypeScript), not Colyseus schema.
- **No logger calls inside tick.** The proximity check loop must use `logger.debug` at most
  (and only if logging is needed at all). No `logger.info`/`warn`/`error` inside `tick()`.
- **`satisfies DeltaEventMsg` pattern.** New delta objects in GameRoom follow the existing
  pattern: `{ type: 'player:poi-entered' as const, ... } satisfies DeltaEventMsg`.
- **TypeScript strict mode.** All files have strict mode. The `Text` import from `pixi.js` in
  HubWorldScreen needs `TextStyle` too — import both explicitly.
- **CSS design tokens only.** No raw hex values in inline styles in mobile or host HTML/JSX.
  Use `var(--accent-spirit)`, `var(--bg-surface)`, etc. (Exception: PixiJS Graphics uses
  hex number literals directly — that is correct and expected.)
- **touch-action: none.** The controller's root div already has `touchAction: 'none'`. The
  InteractButton uses `touchAction: 'manipulation'` (allows tap, prevents double-tap zoom).
- **Context7 MCP for PixiJS v8 docs.** Run `npx -y @upstash/context7-mcp` before writing any
  PixiJS code to confirm the v8 API. The Text constructor and Graphics API changed significantly
  from v7.
- **npm only.** Do not use pnpm. Cross-workspace: `npm run typecheck --workspace=packages/net-protocol`.
- **8px grid.** All spacing in CSS/inline styles must be multiples of 8px (or 4px half-unit for
  fine internal padding in compact elements).

### References

- Epic 2 Story 2.1 acceptance criteria: `_bmad-output/planning-artifacts/epics.md` lines 447–473
- UX interact-button spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` (interact-button section)
- UX hub world experience flow: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` (§Hub Idle, §Near-POI)
- UX Spirit Chant glow rule: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` (UX-DR11)
- GDD hub world description: `_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/gdd.md` line 315
- UX safe area rule: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` (UX-DR19)
- Project context rules: `_bmad-output/project-context.md`
- Authority model: `CLAUDE.md` §Working Model
- Current PlayerState: `packages/shared-types/src/player.ts`
- Current DeltaEventMsg: `packages/net-protocol/src/messages/server-to-host.ts`
- Current applyDelta: `packages/net-protocol/src/apply-delta.ts`
- Current GameRoom tick: `apps/simulation-server/src/rooms/GameRoom.ts` lines 172–211
- Current HubWorldScreen: `apps/host-client/src/screens/HubWorldScreen.tsx`
- Current ControllerScreen: `apps/mobile-controller/src/screens/ControllerScreen.tsx`
- Current mobile-session.ts: `apps/mobile-controller/src/session/mobile-session.ts`
- Contract tests: `tests/contract/net-protocol.test.ts`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Found and fixed: `apps/simulation-server/tests/game-room-host-join.test.ts` had an inline `PlayerState` object missing `nearPoiId` — added `nearPoiId: null` to satisfy the updated type. Also added `PlayerPoiEnteredDelta` and `PlayerPoiExitedDelta` to `packages/net-protocol/src/index.ts` exports (they were defined in `server-to-host.ts` but not re-exported from the package root).

### Completion Notes List

All 5 tasks completed. CONTRACT CHANGE flag was set — this story modifies `packages/shared-types` (new `poi.ts`, `nearPoiId` on `PlayerState`) and `packages/net-protocol` (two new delta types + applyDelta cases). Protocol Architect review required.

CONTRACT CHANGE HOOK CHECKLIST (CLAUDE.md):
- [x] Protocol Architect review required — documented here
- [x] Compatibility checklist: new `nearPoiId: string | null` field is additive to `PlayerState`; new delta types extend `DeltaEventMsg` union additively; no breaking changes to existing wire format
- [x] Contract tests added: 5 new tests in `tests/contract/net-protocol.test.ts` covering round-trip serialization and applyDelta behavior for both POI delta types
- [x] No ADR/spec update required — this is a targeted additive extension, not an authority model change

SIMULATION-SAFETY HOOK:
- Typecheck: clean
- Unit tests: 13/13 sim server tests pass
- Deterministic tick: proximity check uses Euclidean distance arithmetic only, no randomness, no planck.js
- No logger calls inside tick loop

CLIENT-UX HOOK (Host):
- POI icons rendered as PixiJS Graphics in virtual 1920×1080 space; scale applies automatically
- Dungeon entrance at 0.35 opacity; interactive POIs at 1.0
- Chat bubble (💬 Text) appears above player circle when `nearPoiId !== null`
- Couch readability: large enough labels (14px Lora), distinct colors per POI type

CLIENT-UX HOOK (Mobile):
- InteractButton slides in from top (`translateY(-150%)` → `translateY(0)`, 200ms ease-out)
- `pointerEvents: none` when hidden — no joystick capture interference
- 80% screen width, minHeight 44px — meets touch target spec
- `accent-spirit` border, spirit glow shadow, `bg-surface` background — matches UX-DR11

Confidence: 92% — full typecheck clean, all tests pass, no planck.js introduced, design tokens used correctly throughout.

### File List

- `packages/shared-types/src/poi.ts` — NEW: PoiType enum, PoiDefinition interface, HUB_POIS, INTERACTIVE_HUB_POIS
- `packages/shared-types/src/player.ts` — added `nearPoiId: string | null` to PlayerState
- `packages/shared-types/src/index.ts` — added `export * from './poi.js'`
- `packages/net-protocol/src/messages/server-to-host.ts` — added PlayerPoiEnteredDelta, PlayerPoiExitedDelta, extended DeltaEventMsg union
- `packages/net-protocol/src/apply-delta.ts` — added `player:poi-entered` and `player:poi-exited` cases
- `packages/net-protocol/src/index.ts` — exported PlayerPoiEnteredDelta, PlayerPoiExitedDelta
- `tests/contract/net-protocol.test.ts` — added nearPoiId to mockPlayer and inline player objects; added 5 POI contract tests
- `apps/simulation-server/src/rooms/GameRoom.ts` — added INTERACTIVE_HUB_POIS import, nearPoiId: null in createPlayer, Euclidean proximity check in tick()
- `apps/simulation-server/tests/game-room-host-join.test.ts` — added nearPoiId: null to inline PlayerState object
- `apps/host-client/src/screens/HubWorldScreen.tsx` — added Text/TextStyle/HUB_POIS/PoiType imports, poiGraphicsRef, POI initialization in initPixi, chat bubble in renderFrame
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — added InteractButton component, activePoi derivation, position: relative on outer div

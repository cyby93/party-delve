# Story 1.5: Hub World Bootstrap & Player Presence

Status: ready-for-dev

## Story

As a player,
I want to see my character appear in the hub world on the shared host screen after the host starts the game,
so that everyone in the room knows the session is live and we are all connected.

## Acceptance Criteria

1. **Hub World canvas renders** — When the host-client receives a `SnapshotMsg` after the host clicks "Start Game," the PixiJS canvas fills the host screen edge-to-edge (`#0f0e10` background, no letterboxing) and a 48px top strip overlays the canvas top edge (flush, zero border-radius at screen edges) containing one `player-chip` per connected player. Each chip shows the player's display name in Lora 700 at base (16px) and "Class TBD" in Lora 400 at sm (13px), on a `bg-surface` chip with 6px border-radius.

2. **Joystick input → character movement** — When a player moves the left joystick on their phone, the `InputEventMsg` (joystick vector, normalized -1.0→1.0 per axis) arrives at the simulation server; the character's `x/y` updates in `GameState` on the next tick; a `player:moved` delta is serialized and broadcast to the host; the host applies the delta via `applyDelta(mirrorState, evt)` and updates the player's canvas position; the character moves visibly on the host canvas within 100ms of the input (NFR1).

3. **Snapshot overwrites mirror state** — When a full `SnapshotMsg` arrives from the server (periodic or on-join), `mirrorState` is fully replaced by the snapshot state (not merged), preventing any drift accumulation.

4. **ESLint game-rules import guard** — Any import of `packages/game-rules` in `apps/host-client` or `apps/mobile-controller` is reported as an ESLint error and the CI pipeline fails (AR7 enforcement — already configured from Story 1.1; confirm no violations introduced).

5. **Couch-distance readability** — Player names in the top strip are readable at 2–4 meters couch distance: `text-primary` (`#d8d0e8`) on `bg-surface` (`#181620`) achieves >7:1 contrast ratio; font is Lora 700 at 16px minimum.

## Tasks / Subtasks

- [ ] Task 1: Implement `applyDelta` for `player:moved` and `player:left` (AC: #2, #3) — **Protocol Architect companion**
  - [ ] Edit `packages/net-protocol/src/apply-delta.ts` — replace stub with discriminated switch:
    - `'player:moved'`: return `{ ...state, players: state.players.map(p => p.id === evt.playerId ? { ...p, x: evt.x, y: evt.y } : p) }`
    - `'player:left'`: return `{ ...state, players: state.players.filter(p => p.id !== evt.playerId) }`
    - All other cases: return `state` unchanged
  - [ ] Add `InputEventMsg` round-trip contract test to `tests/contract/net-protocol.test.ts` (see Dev Notes for exact test)
  - [ ] Run `npm test --workspace=tests/contract` — must pass

- [ ] Task 2: Wire input processing in GameRoom tick (AC: #2) — **Simulation Engineer companion**
  - [ ] Edit `apps/simulation-server/src/rooms/GameRoom.ts`:
    - In `tick()`: drain `inputQueue`, collect latest joystick vector per player ID, update `player.x/y` (see Dev Notes for exact movement formula), broadcast `player:moved` delta for each moved player
    - In `createPlayer()`: set spawn position from `SPAWN_POSITIONS[slotIndex]` array (see Dev Notes for values)
    - Track `slotIndex` on join: count players before push → use as index
  - [ ] Run `npm run typecheck` from repo root — must be clean
  - [ ] Run `npm test --workspace=apps/simulation-server` — must pass (existing 9 tests + any new ones)

- [ ] Task 3: Build real HubWorldScreen with PixiJS canvas (AC: #1, #2, #3, #5) — **Host Experience Engineer**
  - [ ] Edit `apps/host-client/src/App.tsx` — pass `gameState` and `session` to `HubWorldScreen` (see Dev Notes)
  - [ ] Rewrite `apps/host-client/src/screens/HubWorldScreen.tsx` — PixiJS `Application` + 48px top strip (see Dev Notes for full implementation)
  - [ ] Implement player chip rendering in HTML strip (one chip per `gameState.players[i]`)
  - [ ] Implement player entity rendering on PixiJS canvas: colored circle per player, position from `player.x/y`, color from `SESSION_COLOR_HEX[player.sessionColor]`
  - [ ] Call `renderFrame(gameState, pixiAppRef.current)` in a `useEffect([gameState])` when PixiJS is ready
  - [ ] Run `npm run typecheck` from repo root — must be clean

- [ ] Task 4: Implement hub controller in ControllerScreen (AC: #2) — **Mobile Controller Engineer**
  - [ ] Edit `apps/mobile-controller/src/session/mobile-session.ts` — add `sendInput(msg: InputEventMsg): void` to `MobileSession` interface and implementation (see Dev Notes)
  - [ ] Rewrite `apps/mobile-controller/src/screens/ControllerScreen.tsx` — landscape layout with floating joystick zone (left 40%) and 2×2 skill stub grid (right 60%) (see Dev Notes for full implementation)
  - [ ] Touch tracking uses `Touch.identifier` — not `event.targetTouches[0]`
  - [ ] Input throttled at 30hz (send no more than once per 33ms) to match sim tick rate
  - [ ] Apply `touch-action: none` and `user-select: none` on joystick zone div (not globally in CSS)
  - [ ] Apply `{ passive: false }` on `touchmove` listener (required to call `preventDefault()` and block scroll)
  - [ ] Skill cells: 2×2 grid, `bg-subtle` background, Lora 400 italic at base, class name "—" (no class selected yet), non-interactive in hub (opacity 0.6, `pointer-events: none`)
  - [ ] Run `npm run typecheck` from repo root — must be clean

- [ ] Task 5: Integration smoke test (AC: all)
  - [ ] Run `npm run dev --workspace=apps/simulation-server`
  - [ ] Run `npm run dev --workspace=apps/host-client`
  - [ ] Run `npm run dev --workspace=apps/mobile-controller`
  - [ ] Host: create session → lobby shows QR and session code
  - [ ] Mobile: scan QR / enter code → guest join → orientation prompt → hub controller appears (landscape, joystick zone visible)
  - [ ] Host: click "Start Game" → PixiJS canvas appears (dark background), top strip shows player chip with name
  - [ ] Mobile: move left joystick → verify character circle moves on host canvas within ~100ms
  - [ ] Second player joins and moves — both circles visible, both move independently
  - [ ] Wait ~5 seconds → periodic snapshot arrives → no position jump (snapshot overwrites correctly)
  - [ ] Verify ESLint: `npm run lint --workspace=apps/host-client` shows no `no-restricted-imports` errors

## Dev Notes

### Critical: Files to Create or Modify

| Action | File | Owner Role |
|---|---|---|
| MODIFY | `packages/net-protocol/src/apply-delta.ts` | Protocol Architect |
| MODIFY | `tests/contract/net-protocol.test.ts` | QA companion |
| MODIFY | `apps/simulation-server/src/rooms/GameRoom.ts` | Simulation Engineer |
| MODIFY | `apps/host-client/src/App.tsx` | Host Experience Engineer |
| REWRITE | `apps/host-client/src/screens/HubWorldScreen.tsx` | Host Experience Engineer |
| MODIFY | `apps/mobile-controller/src/session/mobile-session.ts` | Mobile Controller Engineer |
| REWRITE | `apps/mobile-controller/src/screens/ControllerScreen.tsx` | Mobile Controller Engineer |

Do NOT touch: `packages/shared-types/**` (no new types needed), `packages/net-protocol/src/event-names.ts` (EventNames.INPUT already exists), `apps/host-client/src/session/host-session.ts` (already correctly handles SNAPSHOT + DELTA via applyDelta), `packages/ui-kit/**`, `apps/backend-platform/**`.

---

### Task 1 Detail: apply-delta.ts

Current stub (`packages/net-protocol/src/apply-delta.ts`) returns state unchanged. Replace entirely:

```typescript
import type { GameState } from 'shared-types';
import type { DeltaEventMsg } from './messages/server-to-host.js';

export function applyDelta(state: GameState, evt: DeltaEventMsg): GameState {
  switch (evt.type) {
    case 'player:moved': {
      const players = state.players.map(p =>
        p.id === evt.playerId ? { ...p, x: evt.x, y: evt.y } : p
      );
      return { ...state, players };
    }
    case 'player:left': {
      return { ...state, players: state.players.filter(p => p.id !== evt.playerId) };
    }
    default:
      return state;
  }
}
```

This returns new state objects (immutable pattern) — the host-session.ts stores the result as `currentState` and calls `onStateUpdate`. No mutation of the passed-in `state`.

**Contract test to add** (append to `tests/contract/net-protocol.test.ts`):

```typescript
describe('InputEventMsg round-trip', () => {
  it('joystick input survives serialize → deserialize', () => {
    const msg: InputEventMsg = {
      type: 'input',
      event: { type: 'joystick', joystick: { x: 0.5, y: -0.75 } },
    };
    expect(deserialize<InputEventMsg>(serialize(msg))).toEqual(msg);
  });
});
```

Add `import type { InputEventMsg } from 'net-protocol';` to the existing imports at the top.

The `player:moved` contract test already exists in the file — do NOT duplicate it.

---

### Task 2 Detail: GameRoom.ts Input Processing

The current `tick()` drains the queue to empty without processing. Replace the drain with real movement logic:

```typescript
// Movement speed constant — INLINE ONLY for Story 1.5
// Move to game-rules/balance.ts in Story 3.x when the game-rules package is fleshed out
const PLAYER_SPEED_PX_PER_S = 200;
const DT = 1 / TICK_RATE_HZ; // seconds per tick (≈0.0333s at 30hz)
```

Replace `// Drain input queue — no processing yet; wired in Story 1.5` in the `tick()` method:

```typescript
private tick(): void {
  this.tickCount++;
  this.gameState.tick = this.tickCount;

  // Collect last joystick input per player (latest input in queue wins)
  const joystickByPlayer = new Map<string, { x: number; y: number }>();
  for (const { clientId, msg } of this.inputQueue) {
    if (msg.event.type === 'joystick') {
      joystickByPlayer.set(clientId, msg.event.joystick);
    }
  }
  this.inputQueue.length = 0;

  // Apply movement and collect moved players for delta broadcast
  const SPEED = 200; // px/s — move to balance.ts in Story 3.x
  const DT = 1 / TICK_RATE_HZ;

  for (const player of this.gameState.players) {
    if (player.isFrozen) continue;
    const joystick = joystickByPlayer.get(player.id);
    if (!joystick) continue;
    const { x, y } = joystick;
    // Ignore below deadzone threshold
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) continue;
    player.x += x * SPEED * DT;
    player.y += y * SPEED * DT;
    const delta = {
      type: 'player:moved' as const,
      playerId: player.id,
      x: player.x,
      y: player.y,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, serialize(delta));
  }

  // Periodic full snapshot every SNAPSHOT_INTERVAL_S seconds
  if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));
  }
}
```

**Spawn positions** — update `createPlayer` signature and `onJoin` to pass a slot index:

```typescript
// Predefined hub spawn positions (pixel coords, 1920×1080 virtual space)
const SPAWN_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 880, y: 540 }, { x: 960, y: 540 }, { x: 1040, y: 540 }, { x: 920, y: 480 },
  { x: 1000, y: 480 }, { x: 880, y: 600 }, { x: 960, y: 600 }, { x: 1040, y: 600 },
];

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
  };
}
```

Add a session color assignment array after imports:

```typescript
const SESSION_COLORS: ReadonlyArray<SessionColor> = [
  SessionColor.RED, SessionColor.BLUE, SessionColor.GREEN, SessionColor.YELLOW,
  SessionColor.PURPLE, SessionColor.ORANGE, SessionColor.PINK, SessionColor.TEAL,
];
```

Update `onJoin` to pass slot index:

```typescript
// In onJoin, replace the createPlayer call:
const slotIndex = this.gameState.players.length; // capture before push
const player = createPlayer(client.sessionId, displayName, slotIndex);
this.gameState.players.push(player);
```

**Existing test coverage**: The 9 existing tests in `apps/simulation-server/tests/game-room-host-join.test.ts` use mock `PlayerState` objects directly — they do not call `createPlayer()`, so the slotIndex signature change does not break them. Run `npm test --workspace=apps/simulation-server` to confirm.

---

### Task 3 Detail: HubWorldScreen (PixiJS v8)

**PixiJS v8 Critical API Notes:**
- `Application.init()` is **async** — must `await app.init({ ... })` inside an async `useEffect`
- `app.canvas` returns the `HTMLCanvasElement` (not `app.view` — that was v7)
- `app.destroy(true)` cleans up WebGL context; pass `{ children: true }` to also destroy stage children
- Graphics API in v8: `new Graphics()`, then call shape methods then `.fill(color)` or `.stroke(options)`
- Text: `new Text({ text: 'string', style: new TextStyle({ ... }) })`
- Use Context7 MCP to verify exact PixiJS v8.18 Graphics and Text constructor signatures before implementing

**App.tsx changes** — add `gameState` and `session` props to HubWorldScreen:

```tsx
// Line ~58 in App.tsx — currently: return <HubWorldScreen />;
// Change to:
return <HubWorldScreen gameState={gameState} session={session} />;
```

**HubWorldScreen.tsx — full implementation pattern:**

```tsx
import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GameState } from 'shared-types';
import { SessionColor } from 'shared-types';
import type { HostSession } from '../session/host-session';

interface HubWorldScreenProps {
  gameState: GameState | null;
  session: HostSession | null;
}

// Map SessionColor enum values to PixiJS hex colors
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

const PLAYER_RADIUS = 24;

export function HubWorldScreen({ gameState, session: _session }: HubWorldScreenProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const playerContainersRef = useRef<Map<string, Graphics>>(new Map());
  const isReadyRef = useRef(false);

  // Initialize PixiJS once on mount
  useEffect(() => {
    let cancelled = false;
    async function initPixi() {
      if (!canvasContainerRef.current) return;
      const app = new Application();
      await app.init({
        background: 0x0f0e10,
        resizeTo: canvasContainerRef.current,
        antialias: true,
      });
      if (cancelled) {
        app.destroy(true, { children: true });
        return;
      }
      canvasContainerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;
      isReadyRef.current = true;
    }
    void initPixi();
    return () => {
      cancelled = true;
      isReadyRef.current = false;
      pixiAppRef.current?.destroy(true, { children: true });
      pixiAppRef.current = null;
      playerContainersRef.current.clear();
    };
  }, []);

  // Re-render player entities whenever gameState changes
  useEffect(() => {
    if (!isReadyRef.current || !pixiAppRef.current || !gameState) return;
    renderFrame(gameState, pixiAppRef.current, playerContainersRef.current);
  }, [gameState]);

  const players = gameState?.players ?? [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* PixiJS canvas container — fills everything */}
      <div
        ref={canvasContainerRef}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* 48px top strip — HTML overlay above canvas */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          zIndex: 10,
          // No border-radius — flush to screen edges per UX-DR6
        }}
      >
        {players.map(player => (
          <PlayerChip key={player.id} name={player.displayName} />
        ))}
      </div>
    </div>
  );
}

function PlayerChip({ name }: { name: string }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0 8px',
        height: 36,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
        minWidth: 80,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        Class TBD
      </span>
    </div>
  );
}

function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, Graphics>,
): void {
  const currentIds = new Set(state.players.map(p => p.id));

  // Remove graphics for players who left
  for (const [id, g] of playerGraphics) {
    if (!currentIds.has(id)) {
      app.stage.removeChild(g);
      g.destroy();
      playerGraphics.delete(id);
    }
  }

  // Add or update player circles
  for (const player of state.players) {
    let g = playerGraphics.get(player.id);
    if (!g) {
      g = new Graphics();
      app.stage.addChild(g);
      playerGraphics.set(player.id, g);
    }
    const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
    // Redraw circle at new position
    // PixiJS v8: call .clear() then shape + fill
    // Use Context7 MCP to verify exact v8 Graphics API before coding:
    // npx -y @upstash/context7-mcp → query "pixi.js" v8 Graphics clear + circle + fill
    g.clear();
    g.circle(player.x, player.y, PLAYER_RADIUS);
    g.fill(color);
  }
}
```

**IMPORTANT: PixiJS v8 Graphics API may differ slightly from the above.** Before writing the final code, use Context7 MCP to confirm:
- `g.clear()` method signature in v8
- `g.circle(x, y, r)` → `g.fill(color)` sequence
- Whether `fill()` takes a `number` directly or requires `{ color: number }`

---

### Task 4 Detail: Hub Controller (ControllerScreen)

**MobileSession.sendInput addition:**

```typescript
// In mobile-session.ts — add to MobileSession interface:
export interface MobileSession {
  playerId: string;
  roomId: string;
  sendInput: (msg: InputEventMsg) => void;
  disconnect: () => void;
}

// In joinSession return:
return {
  playerId: room.sessionId,
  roomId: room.roomId,
  sendInput: (msg: InputEventMsg) => room.send(EventNames.INPUT, serialize(msg)),
  disconnect: () => room.leave(),
};
```

Import `InputEventMsg` from `'net-protocol'` — it's already exported from `packages/net-protocol/src/index.ts`.

**ControllerScreen — hub controller layout:**

```
┌──────────────────────────────────────────────────────┐  ← landscape phone
│  ████████████████████│░░░░░░░░│░░░░░░░░│             │
│  ███ JOYSTICK  ███████│  SK1   │  SK2   │             │
│  ███ ZONE ████████████│ ────── │ ─────  │             │
│  █████████████████████├────────┼────────┤             │
│  █████████████████████│  SK3   │  SK4   │             │
│  █████████████████████│        │        │             │
└──────────────────────────────────────────────────────┘
    left 40%              right 60% (2×2 skill grid)
```

```tsx
import { useRef, useState, useCallback, useEffect } from 'react';
import { serialize, EventNames } from 'net-protocol';
import type { InputEventMsg } from 'net-protocol';
import type { MobileSession } from '../session/mobile-session';
import type { GameState } from 'shared-types';

interface ControllerScreenProps {
  session: MobileSession | null;
  gameState: GameState | null;
}

const JOYSTICK_MAX_RADIUS = 60; // px — visual ring max offset from origin
const DEADZONE_RADIUS = 8;      // px — sub-threshold treated as zero
const INPUT_INTERVAL_MS = 33;   // ~30hz throttle to match sim tick rate

export function ControllerScreen({ session, gameState: _gameState }: ControllerScreenProps) {
  const joystickZoneRef = useRef<HTMLDivElement>(null);
  const [joystickVisible, setJoystickVisible] = useState(false);
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 0, y: 0 });
  const [joystickKnobOffset, setJoystickKnobOffset] = useState({ x: 0, y: 0 });
  const activeTouchIdRef = useRef<number | null>(null);
  const lastSendTimeRef = useRef(0);

  const sendJoystick = useCallback((nx: number, ny: number) => {
    const now = Date.now();
    if (now - lastSendTimeRef.current < INPUT_INTERVAL_MS) return;
    lastSendTimeRef.current = now;
    if (!session) return;
    const msg: InputEventMsg = {
      type: 'input',
      event: { type: 'joystick', joystick: { x: nx, y: ny } },
    };
    session.sendInput(msg);
  }, [session]);

  // Stop movement when touch ends
  const stopJoystick = useCallback(() => {
    activeTouchIdRef.current = null;
    setJoystickVisible(false);
    setJoystickKnobOffset({ x: 0, y: 0 });
    // Send zero vector to halt movement
    if (session) {
      const msg: InputEventMsg = {
        type: 'input',
        event: { type: 'joystick', joystick: { x: 0, y: 0 } },
      };
      session.sendInput(msg);
    }
  }, [session]);

  useEffect(() => {
    const el = joystickZoneRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (activeTouchIdRef.current !== null) return; // already tracking one touch
      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      activeTouchIdRef.current = touch.identifier;
      setJoystickOrigin({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
      setJoystickKnobOffset({ x: 0, y: 0 });
      setJoystickVisible(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (activeTouchIdRef.current === null) return;
      let activeTouch: Touch | undefined;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i]!.identifier === activeTouchIdRef.current) {
          activeTouch = e.touches[i];
          break;
        }
      }
      if (!activeTouch) return;

      const rect = el.getBoundingClientRect();
      const originX = joystickOrigin.x;
      const originY = joystickOrigin.y;
      const dx = activeTouch.clientX - rect.left - originX;
      const dy = activeTouch.clientY - rect.top - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clamp knob position to max radius for visual
      const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
      const angle = Math.atan2(dy, dx);
      setJoystickKnobOffset({
        x: Math.cos(angle) * clampedDist,
        y: Math.sin(angle) * clampedDist,
      });

      // Normalize vector for input (0.0 → 1.0 per axis, with deadzone)
      if (dist < DEADZONE_RADIUS) {
        sendJoystick(0, 0);
      } else {
        const norm = Math.min(dist, JOYSTICK_MAX_RADIUS) / JOYSTICK_MAX_RADIUS;
        sendJoystick(Math.cos(angle) * norm, Math.sin(angle) * norm);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i]!.identifier === activeTouchIdRef.current) {
          stopJoystick();
          break;
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [joystickOrigin, sendJoystick, stopJoystick]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        background: 'var(--bg-base)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Left zone — joystick (40% width) */}
      <div
        ref={joystickZoneRef}
        style={{
          width: '40%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {joystickVisible && (
          <>
            {/* Joystick ring at origin */}
            <div
              style={{
                position: 'absolute',
                left: joystickOrigin.x - JOYSTICK_MAX_RADIUS,
                top: joystickOrigin.y - JOYSTICK_MAX_RADIUS,
                width: JOYSTICK_MAX_RADIUS * 2,
                height: JOYSTICK_MAX_RADIUS * 2,
                borderRadius: '50%',
                border: '2px solid var(--interactive)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
            {/* Joystick knob */}
            <div
              style={{
                position: 'absolute',
                left: joystickOrigin.x + joystickKnobOffset.x - 20,
                top: joystickOrigin.y + joystickKnobOffset.y - 20,
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--interactive)',
                boxShadow: '0 0 12px rgba(110,168,216,0.6)',
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        {!joystickVisible && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              opacity: 0.4,
              pointerEvents: 'none',
            }}
          >
            Move
          </div>
        )}
      </div>

      {/* Right zone — 2×2 skill grid (60% width) */}
      <div
        style={{
          width: '60%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 4,
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border)',
              opacity: 0.6,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                fontSize: 'var(--text-base)',
                color: 'var(--text-secondary)',
              }}
            >
              —
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Critical multi-touch note**: The loop `for (let i = 0; i < e.touches.length; i++)` uses `e.touches[i]!.identifier` — this is NFR6 compliance. Never use `event.targetTouches[0]` or assume there is only one touch.

**joystickOrigin closure capture bug**: The `onTouchMove` handler captures `joystickOrigin` from the outer component scope. Because this is in a `useEffect`, the closure may be stale. To avoid stale closure issues, use a `useRef` for joystickOrigin instead of `useState` when reading inside the event handler:

```tsx
// Use ref for reading in event handlers, state for visual rendering
const joystickOriginRef = useRef({ x: 0, y: 0 });
const [joystickOriginState, setJoystickOriginState] = useState({ x: 0, y: 0 });

// On touchstart:
joystickOriginRef.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
setJoystickOriginState(joystickOriginRef.current);

// On touchmove: use joystickOriginRef.current (not state)
```

This pattern is required for correct joystick behavior. The `joystickOriginState` is used only for positioning the ring visually; `joystickOriginRef.current` is read inside `onTouchMove` to compute the vector.

---

### Hook Triggers

- **Contract-change hook**: `packages/net-protocol/src/apply-delta.ts` modified — requires: typecheck pass, contract test (`InputEventMsg` round-trip) pass, existing `player:moved` and `player:left` round-trips still pass
- **Simulation-safety hook**: `apps/simulation-server/src/rooms/GameRoom.ts` modified — requires: typecheck pass, 9+ unit tests pass, verify delta broadcast doesn't mutate state outside tick
- **Client-UX hook (host)**: Host checks — join flow smoke test (host sees player chip immediately when player joins lobby), hub world renders edge-to-edge, player names readable at couch distance (7:1+ contrast), no layout overflow on 1080p
- **Client-UX hook (mobile)**: Mobile checks — joystick touch target fills full left zone, skill cells minimum 44×44px each, hub controller renders correctly in landscape, no accidental scroll in joystick zone

---

### Session Color → Hex Map (Cross-Reference)

`SessionColor` enum values from `packages/shared-types/src/player.ts`:
- `RED = 'red'`, `BLUE = 'blue'`, `GREEN = 'green'`, `YELLOW = 'yellow'`
- `PURPLE = 'purple'`, `ORANGE = 'orange'`, `PINK = 'pink'`, `TEAL = 'teal'`

The mapping in `HubWorldScreen.tsx` maps all 8 values to distinct visible hex colors. The same mapping needs to be consistent if used in both PixiJS canvas (hex numbers) and CSS (use `color: rgba(...)` or CSS var where appropriate — for the top strip chips, we don't currently show session color there, only in-canvas circles).

---

### What This Story Does NOT Do

- **No actual hub world background art** — canvas stays solid `#0f0e10`; environment sprites are E2+ scope
- **No physics (planck.js)** — movement is simple position += velocity * dt directly in GameRoom; planck.js integration is Story 3.1
- **No class selection UI** — skill cells stay as "—" stubs; class selection is Stories 2.1–2.3
- **No session color assignment in host:start flow** — colors assigned at join time (`SESSION_COLORS[slotIndex]`); no separate handshake for color
- **No ability input processing** — only `type: 'joystick'` events are processed; `type: 'ability'` events are queued and discarded in this story
- **No reconnect screen** — deferred to Story 1.6; `ControllerScreen` has no reconnect-state branch
- **No audio** — Howler.js is host-only; mobile controller has no audio
- **No `host:start` server handling** — the `room.send('host:start', '')` from `host-session.ts` is silently discarded by the server; the host transitions locally. Wiring this as a real EventName is deferred (see deferred-work.md D38)
- **No hub world bounds clamping** — players can move off the visible canvas area; bounds enforcement is E2+ when the hub map is real
- **No PixiJS ticker loop** — rendering is data-driven (`useEffect([gameState])`); no `app.ticker.add()`

---

### From Story 1.4 Learnings (Directly Applicable)

- **npm only** — `npm run typecheck` from root, never pnpm
- **Google Fonts already in `index.html`** — do NOT add a second `<link>` tag in either app
- **`@ui-kit/tokens.css` already imported** — CSS variables are global; don't re-import in components
- **`room.roomId` not `room.id`** — confirmed in Stories 1.3 and 1.4; applies if any new SDK usage is added
- **`exactOptionalPropertyTypes: true`** — use `options?.field ?? fallback`, never `||`
- **Vite alias resolution** — `shared-types` → `packages/shared-types/src`, `net-protocol` → `packages/net-protocol/src`; no `.js` extension in imports (Bundler mode)
- **`@colyseus/sdk` namespace import** — `import * as Colyseus from '@colyseus/sdk'`; there is no default export
- **`{ passive: false }` on touchmove** — required for `preventDefault()` to work; Story 1.4 called this out explicitly as Story 1.5's responsibility. Do NOT add `touch-action: none` to `global.css`; add it only on the controller container and joystick zone divs

---

### Project Context Rules

**Authority model (mandatory):**
- `ControllerScreen` sends only `InputEventMsg` (joystick vector) — never sends position or state
- `HubWorldScreen` reads only from `mirrorState` built by `host-session.ts` via `applyDelta` — never computes positions
- Game logic (movement math) lives in `GameRoom.tick()` only — not in React components

**Colyseus boundary (mandatory):**
- `session.sendInput(msg)` calls `room.send(EventNames.INPUT, serialize(msg))` — always use `EventNames.INPUT`, never raw string `'input'`
- Always use `serialize()`/`deserialize()` from `net-protocol` — never `JSON.stringify`/`JSON.parse` directly in app code

**PixiJS boundary (mandatory):**
- `pixi.js` is in `host-client/package.json` only — confirmed. Never import `pixi.js` in `apps/mobile-controller`
- No game logic inside PixiJS display objects — `renderFrame()` is a pure renderer; it reads `mirrorState`, never writes it

**Design system (mandatory):**
- 48px strip: no border-radius at screen edges per UX-DR6 — do NOT add `borderRadius` to the strip div
- Joystick ring: `accent-spirit` border + spirit glow shadow only when joystick is **active** (UX-DR11) — the idle hint text is fine without glow
- Skill cells in hub: idle state = `bg-subtle` background, no glow, no `accent-spirit` border (glow only in active joystick-type skill cells, which are E3+ scope)
- All CSS colors: `var(--*)` only — no raw hex in component CSS (PixiJS canvas uses `0xhex` numbers internally — that's OK, it's not CSS)

**Multi-touch (mandatory for NFR6):**
- Always track by `Touch.identifier` — not `event.targetTouches[0]`
- The skill grid (right zone) may need to support simultaneous touch with the joystick zone in E3 — design the touch tracking to not conflict now

**No `Math.random()` in game logic** — the movement calculation in `tick()` uses only deterministic math; `Math.random()` is used once in `createEmptyGameState` for `runSeed` (pre-existing placeholder, acceptable until Story 3.1)

**Context7 MCP**: Use `npx -y @upstash/context7-mcp` for live PixiJS v8 documentation lookup — specifically for `Graphics` API (clear, circle, fill method signatures changed in v8 vs v7), and for `Application.init()` async pattern.

---

### References

- Epics Story 1.5 ACs: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.5
- UX host HUD wireframe: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/host-hud-wireframe-1.html`
- UX controller layout: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/controller-landscape-1.html`
- UX design components: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` — §5 (`player-chip` component spec), §6 (`skill-cell` component spec)
- UX experience: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` — §3 Host Screen Inventory, §6 Multi-touch Requirement (NFR6), §9 Joystick Input Model (UX-DR9, UX-DR10), §13 Screen Layout Zones
- Design tokens CSS: `packages/ui-kit/src/tokens.css` — canonical CSS variable names and values
- apply-delta (to modify): `packages/net-protocol/src/apply-delta.ts`
- event-names: `packages/net-protocol/src/event-names.ts` — `EventNames.INPUT = 'input'` already defined
- mobile-to-server messages: `packages/net-protocol/src/messages/mobile-to-server.ts` — `InputEventMsg` shape
- server-to-host messages: `packages/net-protocol/src/messages/server-to-host.ts` — `PlayerMovedDelta` shape
- GameRoom (to modify): `apps/simulation-server/src/rooms/GameRoom.ts` — tick() input drain at line ~143
- HubWorldScreen (to rewrite): `apps/host-client/src/screens/HubWorldScreen.tsx` — currently 19-line stub
- App.tsx host (to modify): `apps/host-client/src/App.tsx` — line ~58, add `gameState` + `session` props to HubWorldScreen
- ControllerScreen (to rewrite): `apps/mobile-controller/src/screens/ControllerScreen.tsx` — currently stub
- mobile-session.ts (to modify): `apps/mobile-controller/src/session/mobile-session.ts` — add `sendInput` to interface + return
- contract tests: `tests/contract/net-protocol.test.ts` — add `InputEventMsg` round-trip
- Previous story patterns: `_bmad-output/implementation-artifacts/1-4-mobile-app-guest-join-flow.md` — especially touch handling notes, Colyseus SDK notes, safe-area notes
- Project context rules: `_bmad-output/project-context.md`
- Shared types: `packages/shared-types/src/player.ts` (SessionColor enum), `packages/shared-types/src/input.ts` (InputEvent union), `packages/shared-types/src/game-state.ts`

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

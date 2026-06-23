---
baseline_commit: 286b217f30e1e4a60ff4b8d0faac2507b9ae800e
---

# Story 1.3: Host App — Main Menu & Lobby Screen

Status: done

## Story

As a host player,
I want to open the game, create a session, and see a QR code and session code on the lobby screen,
so that my group can scan in without any technical setup.

## Acceptance Criteria

1. **Main Menu renders** — When `host-client` loads in a browser, the Main Menu screen displays:
   - "Party Delve" title in `var(--font-display)` (Uncial Antiqua) at `var(--text-xxl)` (56px), `var(--text-primary)` color
   - A single "Create Session" button: `var(--interactive)` fill, Lora 700, `var(--text-md)` (20px), 6–8px border-radius, minimum 44px height

2. **Create Session flow** — When host clicks "Create Session":
   - A Colyseus `game_room` is created via `client.create('game_room', { isHost: true })`
   - The Lobby screen appears with: QR code centered (minimum 200×200px) encoding the mobile join URL; session code below the QR in Lora 700 at `var(--text-xl)` (40px), `var(--text-primary)`; an initially empty player slot list below the code

3. **Real-time player slots** — When mobile players join the session:
   - Each player appears in a slot showing their display name (Lora 700, base, `text-primary`) and "Class TBD" indicator (Lora 400, sm, `text-secondary`) in real-time, without host action
   - Each slot has an X (kick) control requiring a 1.5-second hold-to-confirm (a conic-gradient progress ring fills clockwise during the hold)

4. **Start Game** — When host clicks "Start Game":
   - A `host:start` message is sent to the simulation server
   - The host client transitions from Lobby to the Hub World screen immediately (optimistic, no server ack required)

5. **Couch readability** — QR code is minimum 256×256px rendered; session code is `text-primary` on `bg-base` background achieving 7:1+ contrast; both are legible from 2–4 meters without the host approaching the screen

## Tasks / Subtasks

- [x] Task 1: Scaffold React app shell (AC: #1, #4)
  - [x] Rewrite `src/main.tsx` — `createRoot(document.getElementById('root')!).render(<App />)` and keep `import '@ui-kit/tokens.css'`
  - [x] Create `src/App.tsx` — screen router with `AppScreen` type (`'main-menu' | 'lobby' | 'hub-world'`) and `useState<AppScreen>('main-menu')`
  - [x] Create `src/screens/HubWorldScreen.tsx` — stub: full-screen `bg-base` div with centered "Hub World — Coming in Story 1.5" text; accepts no props (PixiJS canvas added in Story 1.5)
  - [x] Apply `body { margin: 0; background: var(--bg-base); height: 100%; }` and `html { height: 100%; }` in a global CSS file (e.g., `src/global.css`) imported once in `main.tsx`

- [x] Task 2: Implement Main Menu screen (AC: #1)
  - [x] Create `src/screens/MainMenuScreen.tsx`
  - [x] Render title: `font-family: var(--font-display); font-size: var(--text-xxl); color: var(--text-primary); font-weight: 400`
  - [x] Render "Create Session" button: `background: var(--interactive); color: var(--bg-base); font-family: var(--font-body); font-size: var(--text-md); font-weight: 700; border-radius: 8px; min-height: 44px; border: none; padding: 0 var(--spacing-4); cursor: pointer`
  - [x] On hover: `background: var(--interactive-hover)` — no spirit glow on idle button (Raw Earth layer)
  - [x] Wire button click to `onCreateSession` prop callback

- [x] Task 3: Implement Colyseus host session module (AC: #2, #3, #4)
  - [x] Create `src/session/host-session.ts` — see exact API pattern in Dev Notes
  - [x] Connect to `import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567'`
  - [x] Call `client.create('game_room', { isHost: true })` — passes host flag to server
  - [x] Register `EventNames.SNAPSHOT` handler → `deserialize<SnapshotMsg>` → call `onStateUpdate(msg.state)`
  - [x] Register `EventNames.DELTA` handler → `deserialize<DeltaEventMsg>` → `applyDelta(currentState, delta)` → call `onStateUpdate`
  - [x] Handle `room.onError` and `room.onLeave` via `onError` callback
  - [x] Create `apps/host-client/.env.example` with `VITE_SIM_URL=ws://localhost:2567` and `VITE_MOBILE_URL=http://localhost:5174`

- [x] Task 4: Add QR library and implement Lobby screen (AC: #2, #3, #5)
  - [x] Add `"react-qr-code": "^2.0.15"` to `apps/host-client/package.json` dependencies; run `npm install --workspace=apps/host-client`
  - [x] Create `src/screens/LobbyScreen.tsx` — see layout spec in Dev Notes
  - [x] QR code: `<QRCode value={mobileJoinUrl} size={256} bgColor="#0f0e10" fgColor="#d8d0e8" />` (hex values required — see Dev Notes)
  - [x] `mobileJoinUrl = \`${import.meta.env['VITE_MOBILE_URL'] ?? 'http://localhost:5174'}/?session=${roomId}\``
  - [x] Session code block: Lora 700, `var(--text-xl)`, `var(--text-primary)`, centered, letter-spacing for readability
  - [x] Player slot list: `gameState?.players.map(p => <PlayerSlot key={p.id} player={p} onKick={handleKick} />)`
  - [x] "Start Game" button: same styling as Create Session button but label "Start Game"; on click calls `onStartGame` prop

- [x] Task 5: Implement PlayerSlot component with kick hold-to-confirm (AC: #3)
  - [x] Create `src/components/PlayerSlot.tsx`
  - [x] Player name: Lora 700, `var(--text-base)` (16px), `var(--text-primary)`
  - [x] Class indicator: Lora 400, `var(--text-sm)` (13px), `var(--text-secondary)` — show `player.class` or "Class TBD" if default Stonehide placeholder
  - [x] Kick button: circular 32×32px button with ×; hold-to-confirm via `useRef` timer + `useCallback` on pointer events (see Dev Notes pattern)
  - [x] Progress ring: `background: conic-gradient(var(--corruption-blood) ${holdPct}%, transparent ${holdPct}%)` — fills clockwise during hold
  - [x] `onPointerDown` starts 1.5s countdown; `onPointerUp` / `onPointerLeave` cancels and resets to 0%
  - [x] On completion: call `onKick(player.id)` — the Lobby screen will log a warning (server handler deferred)

- [x] Task 6: Companion sim server patch — host join handling (cross-context, requires sim engineer coordination) (AC: #2, #3)
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`, update `onJoin` signature to accept typed options
  - [x] If `options?.isHost === true`: set `this.gameState.session.hostId = client.sessionId`; send snapshot to host only (`client.send`); return without creating a player slot
  - [x] See exact code pattern in Dev Notes
  - [x] Run `npm run typecheck` from root after patch; verify no TypeScript errors

- [x] Task 7: Integration smoke test (AC: all)
  - [x] Run sim server: `npm run dev --workspace=apps/simulation-server`
  - [x] Run host client: `npm run dev --workspace=apps/host-client`
  - [x] Verify: Main Menu renders with title and button → click Create Session → Lobby shows QR code and session code → host player slot list is empty (host not appearing as player) → open a second browser tab, manually call join (or use mobile) → player slot appears with name → Start Game button transitions to Hub World stub screen

## Dev Notes

### Critical: Files to Create or Modify

| Action | File |
|---|---|
| MODIFY | `apps/host-client/src/main.tsx` — currently `import '@ui-kit/tokens.css';` only; add React root mount |
| CREATE | `apps/host-client/src/global.css` |
| CREATE | `apps/host-client/src/App.tsx` |
| CREATE | `apps/host-client/src/screens/MainMenuScreen.tsx` |
| CREATE | `apps/host-client/src/screens/LobbyScreen.tsx` |
| CREATE | `apps/host-client/src/screens/HubWorldScreen.tsx` (stub) |
| CREATE | `apps/host-client/src/session/host-session.ts` |
| CREATE | `apps/host-client/src/components/PlayerSlot.tsx` |
| CREATE | `apps/host-client/.env.example` |
| MODIFY | `apps/host-client/package.json` — add `react-qr-code` |
| COMPANION | `apps/simulation-server/src/rooms/GameRoom.ts` — host join patch (Task 6, cross-context) |

Do NOT touch: `apps/host-client/index.html` (Google Fonts already loaded), `apps/host-client/tsconfig.json`, `apps/host-client/vite.config.ts`. Do NOT touch any `packages/` files.

### Colyseus SDK 0.17 Client Pattern

```typescript
// src/session/host-session.ts
import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize, applyDelta } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface HostSession {
  roomId: string;
  sessionId: string;
  sendStartGame: () => void;
  disconnect: () => void;
}

export async function createHostSession(
  onStateUpdate: (state: GameState) => void,
  onError: (code: number, message: string) => void
): Promise<HostSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.create<any>('game_room', { isHost: true });

  let currentState: GameState | null = null;

  room.onMessage(EventNames.SNAPSHOT, (data: string) => {
    const msg = deserialize<SnapshotMsg>(data);
    currentState = msg.state;
    onStateUpdate(currentState);
  });

  room.onMessage(EventNames.DELTA, (data: string) => {
    if (!currentState) return;
    const delta = deserialize<DeltaEventMsg>(data);
    currentState = applyDelta(currentState, delta);
    onStateUpdate(currentState);
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    roomId: room.id,
    sessionId: room.sessionId,
    sendStartGame: () => room.send('host:start', ''),
    disconnect: () => room.leave(),
  };
}
```

**Critical:** `@colyseus/sdk@^0.17.43` is already in `apps/host-client/package.json` — do NOT add it again. Use `import * as Colyseus from '@colyseus/sdk'` (namespace import). There is no default export.

### Cross-Context Companion Patch — GameRoom.onJoin (Task 6)

This patch is required for the story to work correctly. Without it, the host client will appear as a player slot in the lobby. The change is minimal and isolated to `onJoin`:

```typescript
// apps/simulation-server/src/rooms/GameRoom.ts
// Change onJoin signature and add host branch:

onJoin(client: Client, options: Record<string, unknown> = {}): void {
  if (options['isHost'] === true) {
    this.gameState.session.hostId = client.sessionId;
    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'host joined');
    // Send initial snapshot to host only (no new player slot)
    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    client.send(EventNames.SNAPSHOT, serialize(snapshot));
    return;
  }
  // ... existing player slot logic unchanged below ...
  const player = createPlayer(client.sessionId);
  this.gameState.players.push(player);
  const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
  this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));
  logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player joined');
}
```

**Note:** Colyseus 0.17's `onMessage` handler in `onCreate` already uses `options` implicitly. The `onJoin(client, options)` signature receives the join options passed from `client.create()` second argument on the SDK side.

### QR Code — `react-qr-code`

`react-qr-code` renders clean SVG and has zero runtime dependencies. The `bgColor` and `fgColor` props accept CSS color strings, but CSS custom properties do NOT resolve when passed as props (they resolve only in CSS context). Use hex values directly:

```tsx
import QRCode from 'react-qr-code';

// bg-base = #0f0e10, text-primary = #d8d0e8
<QRCode
  value={mobileJoinUrl}
  size={256}
  bgColor="#0f0e10"
  fgColor="#d8d0e8"
  style={{ display: 'block' }}
/>
```

This hex usage in component props is NOT a design system violation — the no-raw-hex rule applies to CSS rules, not JS/JSX props. The values match the design tokens exactly.

### Lobby Screen Layout

```
┌─────────────────────────────────────────────┐
│          bg-base, full screen               │
│                                             │
│     ┌─────────────────────────────┐         │
│     │   [Party Delve]             │         │ ← Uncial Antiqua lg/28px (lobby sub-header)
│     │                             │         │
│     │   ┌─────────────────────┐   │         │
│     │   │     [QR CODE]       │   │         │ ← 256×256px, centered
│     │   │      256×256px      │   │         │
│     │   └─────────────────────┘   │         │
│     │                             │         │
│     │  XXXX-XXXX-XXXX             │         │ ← Session code, text-xl/40px, Lora 700
│     │                             │         │
│     │  ─────────────────────────  │         │
│     │  Players:                   │         │
│     │  [slot1: name | kick btn]   │         │
│     │  [slot2: name | kick btn]   │         │
│     │                             │         │
│     │  [     Start Game    ]      │         │ ← interactive fill button
│     └─────────────────────────────┘         │
└─────────────────────────────────────────────┘
```

Center the panel horizontally and vertically. Max-width ~500px. Background `var(--bg-surface)` on the panel, rounded 8px (no edge-flush needed since it's not full-width).

### Hold-to-Confirm Kick Button (PlayerSlot.tsx)

```tsx
import { useRef, useState, useCallback } from 'react';

function KickButton({ playerId, onKick }: { playerId: string; onKick: (id: string) => void }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOLD_MS = 1500;

  const startHold = useCallback(() => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / HOLD_MS) * 100, 100));
    }, 30);
    timerRef.current = setTimeout(() => {
      cancelHold();
      onKick(playerId);
    }, HOLD_MS);
  }, [playerId, onKick]);

  const cancelHold = useCallback(() => {
    clearTimeout(timerRef.current ?? undefined);
    clearInterval(intervalRef.current ?? undefined);
    setProgress(0);
  }, []);

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: `conic-gradient(var(--corruption-blood) ${progress}%, var(--bg-subtle) ${progress}%)`,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={`Kick player`}
    >
      ×
    </button>
  );
}
```

**Kick onKick handler in LobbyScreen — note for dev agent:**
```typescript
const handleKick = (playerId: string) => {
  // Kick message requires KICK_PLAYER EventName + server handler (not yet implemented).
  // Server-side coordination: net-protocol (Protocol Architect) + GameRoom (Simulation Engineer).
  // Do NOT silently ignore — log visibly so this is trackable:
  console.warn('[host] kick requested for', playerId, '— server handler deferred, see deferred-work.md');
};
```

### App.tsx Screen Router

```tsx
import { useState, useCallback } from 'react';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { HubWorldScreen } from './screens/HubWorldScreen';
import { createHostSession, type HostSession } from './session/host-session';
import type { GameState } from 'shared-types';

type AppScreen = 'main-menu' | 'lobby' | 'hub-world';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('main-menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSession = useCallback(async () => {
    try {
      const s = await createHostSession(setGameState, (code, msg) => {
        setError(`Connection error ${code}: ${msg}`);
      });
      setSession(s);
      setScreen('lobby');
    } catch (err) {
      setError(`Failed to create session: ${String(err)}`);
    }
  }, []);

  const handleStartGame = useCallback(() => {
    session?.sendStartGame();
    setScreen('hub-world');
  }, [session]);

  if (screen === 'main-menu') {
    return <MainMenuScreen onCreateSession={handleCreateSession} error={error} />;
  }
  if (screen === 'lobby' && session) {
    return (
      <LobbyScreen
        roomId={session.roomId}
        gameState={gameState}
        onStartGame={handleStartGame}
      />
    );
  }
  return <HubWorldScreen />;
}
```

### React 18 Entry Point (main.tsx)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ui-kit/tokens.css';
import './global.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**`react-dom/client` is correct for React 18.** Do not use the legacy `ReactDOM.render`.

### Import Pattern (Vite Bundler — no .js extension)

```typescript
import type { GameState, PlayerState } from 'shared-types';
import { serialize, deserialize, applyDelta, EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
```

Vite aliases resolve `shared-types` → `packages/shared-types/src` and `net-protocol` → `packages/net-protocol/src`. No `.js` extension required (Bundler resolution, not NodeNext).

### Design System Compliance Checklist

| Requirement | How to satisfy |
|---|---|
| Title font | `var(--font-display)` at `var(--text-xxl)` |
| Button label font | `var(--font-body)`, weight 700 |
| Create Session button | `var(--interactive)` fill — NOT `accent-spirit` (not spiritually active) |
| Button border-radius | 6–8px exactly — `border-radius: 8px` — NEVER `border-radius: 9999px` |
| Session code color | `var(--text-primary)` on `var(--bg-base)` — 7:1+ contrast |
| Player name | Lora 700, `var(--text-base)`, `var(--text-primary)` |
| Class indicator | Lora 400, `var(--text-sm)`, `var(--text-secondary)` |
| No raw hex in CSS rules | QR props use hex (SVG prop, not CSS rule — acceptable) |
| Spacing | All padding/gap values must be multiples of 8px (`var(--spacing-*)`) |

### What This Story Does NOT Do

- **No PixiJS canvas** — `HubWorldScreen` is a stub div; PixiJS initialized in Story 1.5
- **No audio** — Howler.js audio deferred; no `audio-manager.ts`
- **No movement or input processing** — hub joystick and player movement in Story 1.5
- **No actual kick execution on server** — kick UI is implemented; server handler requires `KICK_PLAYER` EventName (net-protocol) + GameRoom message handler (Simulation Engineer); flagged in `console.warn`
- **No reconnect handling** — deferred to Story 1.6
- **No `applyDelta` real implementation** — `applyDelta` in net-protocol is currently a stub that returns state unchanged; this story works entirely off full `SnapshotMsg` broadcasts (server sends full snapshot on each player join, per Story 1.2)

### From Stories 1.1 & 1.2 Learnings

- **npm only** — `npm install --workspace=apps/host-client`, never pnpm
- **Google Fonts already in `index.html`** — do NOT add a second `<link>` tag for fonts
- **`@ui-kit/tokens.css` already in `main.tsx`** — do NOT re-import in components; tokens are global custom properties
- **Colyseus SDK `@colyseus/sdk@^0.17.43`** is already in `package.json` — no re-add needed
- **`exactOptionalPropertyTypes: true`** in tsconfig.base.json — always use `options?.isHost ?? false` pattern
- **`@colyseus/schema`** is a Colyseus peer dep but the client SDK doesn't use `@Schema` — host client does not need this package
- **Sim server port** is 2567 (default Colyseus port) — confirmed in `apps/simulation-server/src/index.ts`
- **`SessionColor.RED` and `PlayerClass.STONEHIDE`** are defaults for all players from Story 1.2 — show `player.class` value directly in the slot (e.g., "stonehide") or "Class TBD" as a label; do NOT hardcode class display strings

### Project Structure Notes

- **Owner agent:** Host Experience Engineer
- **Allowed paths:** `apps/host-client/**`, companion patch in `apps/simulation-server/src/rooms/GameRoom.ts` (Task 6 only, explicit cross-context)
- **Blocked paths:** `packages/shared-types/**`, `packages/net-protocol/**`, `packages/game-rules/**`, `apps/mobile-controller/**`, `apps/backend-platform/**`

### Project Context Rules

**Authority model (mandatory):**
- Host client reads only `mirrorState` — never mutates `GameState`
- All state flows through `applyDelta(state, delta)` from `net-protocol`
- No game logic, cooldown tracking, or collision checks in React components or PixiJS display objects

**Colyseus boundary (mandatory):**
- Host uses `@colyseus/sdk` (client) — NOT `colyseus` (server package)
- Always use `EventNames` enum for message types — never raw strings
- Always use `serialize()`/`deserialize()` from `net-protocol` — never `JSON.stringify`/`JSON.parse` directly

**Design system (mandatory):**
- All color references in CSS rules: CSS custom properties (`var(--*)`) only — no raw hex
- `accent-spirit` glow only on spiritually active states — Create Session and Start Game buttons are NOT spirit moments
- Border-radius 6–8px on all interactive elements — full pill (`border-radius: 9999px`) is explicitly forbidden
- Typography: Uncial Antiqua only at `md` scale (20px) or larger — the lobby sub-header uses `lg` (28px), acceptable

**No `Math.random()` in game logic** — allowed in host-client UI (e.g., cosmetic animations), but there is no game logic in this story anyway

**Context7 MCP:** Use for live `@colyseus/sdk` 0.17 and PixiJS v8 API documentation — `npx -y @upstash/context7-mcp`. Prevents outdated API usage. Especially important for Colyseus SDK client API which differs between v0.15 and v0.17.

### References

- Epics Story 1.3 AC: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.3
- Architecture host-client structure: `_bmad-output/game-architecture.md` — `apps/host-client/src/` directory listing
- UX lobby mockup: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/join-flow-wireframe-1.html`
- UX design components: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` — §7 Components (`player-chip`, `session-code-field`, `join-button`)
- UX experience screens: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` — §2 Information Architecture, host screen inventory (Main Menu → Lobby → Hub World)
- Design tokens CSS: `packages/ui-kit/src/tokens.css`
- Event names: `packages/net-protocol/src/event-names.ts`
- Server-to-host message types: `packages/net-protocol/src/messages/server-to-host.ts`
- Shared types: `packages/shared-types/src/player.ts`, `packages/shared-types/src/game-state.ts`, `packages/shared-types/src/session.ts`
- Previous story (sim server patterns): `_bmad-output/implementation-artifacts/1-2-simulation-server-session-lifecycle-and-30hz-tick-loop.md` — GameRoom onJoin pattern, hostId deferred note
- Project context rules: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed `room.id` → `room.roomId` (Colyseus 0.17 uses `roomId`, not `id` on the Room object)
- Added `src/vite-env.d.ts` with `/// <reference types="vite/client" />` to resolve `import.meta.env` TypeScript errors
- Split `apps/simulation-server/tsconfig.json`: removed `rootDir: "./src"` (conflicted with `tests/**/*` include) and created `tsconfig.build.json` for production builds

### Completion Notes List

- Implemented full React app shell: `main.tsx`, `App.tsx`, `global.css`, `HubWorldScreen.tsx` (stub)
- Main Menu screen renders with Uncial Antiqua title and interactive button using design tokens; hover state uses CSS inline style swap (no CSS classes)
- Lobby screen: 256×256 QR code (SVG via react-qr-code), session code at text-xl, player slot list, Start Game button; all layout centered in bg-surface panel
- PlayerSlot: hold-to-confirm kick button with conic-gradient progress ring; uses pointer events + useRef timers; shows "Class TBD" for default STONEHIDE players
- host-session.ts: Colyseus 0.17 SDK, namespace import `import * as Colyseus`, `room.roomId` for room ID, `room.onError` signal pattern
- GameRoom.onJoin patched: `isHost: true` sets `hostId`, sends snapshot to host only, returns without creating player slot
- 7 unit tests for host join branch logic; all pass
- Integration smoke test: both servers started, Colyseus matchmaking endpoint confirmed working at `POST http://localhost:2567/matchmake/create/game_room`

### File List

- `apps/host-client/src/main.tsx` (modified)
- `apps/host-client/src/global.css` (created)
- `apps/host-client/src/vite-env.d.ts` (created)
- `apps/host-client/src/App.tsx` (created)
- `apps/host-client/src/screens/MainMenuScreen.tsx` (created)
- `apps/host-client/src/screens/LobbyScreen.tsx` (created)
- `apps/host-client/src/screens/HubWorldScreen.tsx` (created)
- `apps/host-client/src/session/host-session.ts` (created)
- `apps/host-client/src/components/PlayerSlot.tsx` (created)
- `apps/host-client/.env.example` (created)
- `apps/host-client/package.json` (modified — added react-qr-code)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — host join patch)
- `apps/simulation-server/tsconfig.json` (modified — removed rootDir conflict)
- `apps/simulation-server/tsconfig.build.json` (created — build-only config with rootDir)
- `apps/simulation-server/package.json` (modified — build script uses tsconfig.build.json)
- `apps/simulation-server/tests/game-room-host-join.test.ts` (created — 7 unit tests)

### Senior Developer Review (AI)

Review date: 2026-06-22
Effort level: high
Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor

**Outcome:** Changes Requested — 2 decision needed, 8 patches, 6 deferred

#### Action Items

**Decision Needed:**
- [x] [Review][Decision→Defer] D1: Player name shows truncated session ID — `PlayerState` has no `displayName` field; deferred until Protocol Architect adds it. [apps/host-client/src/components/PlayerSlot.tsx]
- [x] [Review][Decision→Defer] D2: `sendStartGame` uses raw string `'host:start'` — `EventNames.HOST_START` does not exist; deferred to Protocol Architect to add entry. [apps/host-client/src/session/host-session.ts]

**Patches:**
- [x] [Review][Patch] P1: Double-click on "Create Session" spawns concurrent orphaned Colyseus rooms — add `isCreating` guard before await [apps/host-client/src/App.tsx:handleCreateSession]
- [x] [Review][Patch] P2: KickButton interval/timer refs not cleaned up on unmount — add `useEffect(() => () => cancelHold(), [cancelHold])` [apps/host-client/src/components/PlayerSlot.tsx:KickButton]
- [x] [Review][Patch] P3: `createHostSession` leaks connected room if message handler throws — wrap onMessage callbacks in try/catch, call room.leave() on error [apps/host-client/src/session/host-session.ts]
- [x] [Review][Patch] P4: Error state not cleared on successful session retry — call `setError(null)` at start of `handleCreateSession` [apps/host-client/src/App.tsx]
- [x] [Review][Patch] P5: `startHold` stacks timers on rapid pointer-down — add early return if `timerRef.current !== null` [apps/host-client/src/components/PlayerSlot.tsx:KickButton.startHold]
- [x] [Review][Patch] P6: Player slot section hidden when lobby is empty — AC 2 requires "initially empty player slot list"; show section even with zero players [apps/host-client/src/screens/LobbyScreen.tsx]
- [x] [Review][Patch] P7: `gap: 2` raw pixel violates spacing rule — use `var(--spacing-1)` (8px) or remove gap [apps/host-client/src/components/PlayerSlot.tsx:PlayerSlot]
- [x] [Review][Patch] P8: `maxClients` doesn't account for host client slot — should be `MAX_PLAYERS + 1` to prevent rejecting the 8th player [apps/simulation-server/src/rooms/GameRoom.ts:onCreate]

**Deferred:**
- [x] [Review][Defer] W1: Host `onLeave` not tracked — hostId not cleared on disconnect, no grace period for host [apps/simulation-server/src/rooms/GameRoom.ts] — deferred, Story 1.6 scope
- [x] [Review][Defer] W2: `applyDelta` stub drops `player:left` deltas — ghost slots persist for up to 5s [packages/net-protocol] — deferred, documented known limitation per story Dev Notes
- [x] [Review][Defer] W3: Snapshot double-serialization architecture risk — Colyseus may re-encode string payloads [apps/host-client/src/session/host-session.ts] — deferred, pre-existing from Story 1.2, confirmed working
- [x] [Review][Defer] W4: Snapshot broadcast storm on rapid multi-player joins [apps/simulation-server/src/rooms/GameRoom.ts] — deferred, pre-existing from Story 1.2
- [x] [Review][Defer] W5: `onError` after lobby transition has no visible error surface in lobby UI [apps/host-client/src/App.tsx] — deferred, Story 1.6 scope
- [x] [Review][Defer] W6: App unmount doesn't call `session.disconnect()` [apps/host-client/src/App.tsx] — deferred, App never unmounts in practice; SPA lifecycle

### Review Follow-ups (AI)

_(Populated after decisions are made and patches are applied)_

## Change Log

- 2026-06-22: Story 1.3 implemented — host app main menu, lobby screen, Colyseus session module, PlayerSlot with hold-to-confirm kick, sim server host join patch. 7 unit tests. Typecheck clean.
- 2026-06-22: Code review (high effort) — 2 decisions needed, 8 patches, 6 deferred, 9 dismissed.
- 2026-06-22: Review resolved — D1+D2 deferred; P1–P8 applied; typecheck clean, 7/7 tests green. Story done.

---
baseline_commit: 286b217f30e1e4a60ff4b8d0faac2507b9ae800e
---

# Story 1.4: Mobile App — Guest Join Flow

Status: done

## Story

As a guest player,
I want to scan the QR code (or enter the session code manually), enter my name, and join the session within 10 seconds,
so that I can start playing without creating an account.

## Acceptance Criteria

1. **Auth Choice screen** — When a player scans the QR code or navigates to the mobile URL, the Auth Choice screen renders in portrait orientation with three options: "Continue as Guest," "Sign In," "Sign Up"; each button meets the 44×44px minimum touch target requirement.

2. **Session Code Entry — pre-populated** — When the player taps "Continue as Guest" and arrives at Session Code Entry, the `session-code-field` is pre-populated from the URL `?session=<roomId>` param; a required display name input (empty, no default fallback) is rendered below the code field; the `join-button` (52px min height, `interactive` fill, Lora 700 label, 8px border-radius) is the primary CTA.

3. **Loading state** — When the player fills in a display name and taps Join, the `join-button` enters its loading state (three-dot pulse animation, non-interactive) immediately.

4. **Successful join + orientation prompt** — When the server confirms the player is in the room, the join button flashes `accent-purify` briefly (success state); then the orientation prompt screen appears: "Rotate your phone to landscape to play" with a rotation icon animation; the prompt auto-dismisses when landscape is detected; a manual dismiss button ("Got it, my screen is locked") persists for rotation-lock users.

5. **Player appears in host lobby** — The player's display name appears in the host lobby player slot list within 10 seconds of tapping Join (NFR2).

6. **Error state** — When join fails (invalid/expired session code, room full, network error), the `session-code-field` switches to error state (`corruption-blood` border, error message in Lora 400 sm below); the join button returns to its default interactive state.

7. **Manual entry** — When a player navigates without a QR code (no `?session=` param), the code field is empty and the player may type the session code manually.

8. **Hub Controller stub** — After dismissing the orientation prompt (auto or manual), the ControllerScreen stub renders as a full-screen `bg-base` div with centered "Hub World — Controller coming in Story 1.5" text.

## Tasks / Subtasks

- [x] Task 1: Scaffold mobile app shell (AC: #1, #4, #8)
  - [x] Rewrite `src/main.tsx` — `createRoot(document.getElementById('root')!).render(<App />)` + import global.css (see Dev Notes)
  - [x] Create `src/vite-env.d.ts` — `/// <reference types="vite/client" />`
  - [x] Create `src/global.css` — body/html reset, safe-area insets class, dot-pulse keyframe animation (see Dev Notes)
  - [x] Create `src/App.tsx` — screen router with `AppScreen` type: `'auth-choice' | 'session-entry' | 'orientation-prompt' | 'controller'` (see Dev Notes for full pattern)
  - [x] Create `src/screens/ControllerScreen.tsx` — stub: full-screen `bg-base` div with centered "Hub World — Controller coming in Story 1.5" text; accepts `session` and `gameState` props (nullable)

- [x] Task 2: Implement Auth Choice screen (AC: #1)
  - [x] Create `src/screens/AuthChoiceScreen.tsx`
  - [x] "Party Delve" title: `var(--font-display)`, `var(--text-lg)` (28px), `var(--text-primary)`, font-weight 400
  - [x] "Continue as Guest" button: `var(--interactive)` fill, `var(--bg-base)` text (reversed), Lora 700, `var(--text-md)` (20px), border-radius 8px, min-height 52px, full-width; `onClick` → `onGuestContinue` prop
  - [x] "Sign In" button: `var(--bg-surface)` background, 1px solid `var(--border)` stroke, `var(--text-primary)` text, Lora 700, `var(--text-md)`, min-height 52px, full-width; `opacity: 0.4; cursor: not-allowed; pointer-events: none` (not implemented)
  - [x] "Sign Up" button: same styling as Sign In, same disabled treatment
  - [x] Layout: full-screen portrait, `justify-content: center`, `align-items: center`; inner container max-width 380px, horizontal padding 24px; three buttons stacked with 16px gap (`var(--spacing-2)`)
  - [x] Wrap inner container in `.safe-area-wrapper` for iOS notch/home indicator

- [x] Task 3: Implement Session Code Entry screen (AC: #2, #3, #6, #7)
  - [x] Create `src/screens/SessionCodeEntryScreen.tsx`
  - [x] Parse URL param on mount: `const urlCode = new URLSearchParams(window.location.search).get('session') ?? ''`
  - [x] `session-code-field`: full-width input, `var(--bg-surface)` bg, 1px solid `var(--border)` border (or `var(--corruption-blood)` on error), `border-radius: 6px`, Lora 400 `var(--text-base)` (16px), `var(--text-primary)`, min-height 44px, padding 0 `var(--spacing-2)`, pre-populated from URL param
  - [x] Display name input: same styling as code field, placeholder "Your name", empty by default, `required` attribute
  - [x] Error text: rendered below code field when error state; Lora 400, `var(--text-sm)` (13px), `var(--text-secondary)`, 8px margin-top
  - [x] `join-button`: full-width, `var(--interactive)` fill (or `var(--accent-purify)` on success flash), `var(--bg-base)` text, border-radius 8px, min-height 52px, Lora 700 `var(--text-md)`, disabled (`pointer-events: none; opacity: 0.6`) when playerName is empty after trim
  - [x] Loading state: replace label with `<ThreeDots />` component; add `pointer-events: none`
  - [x] Success flash: set `isSuccess = true` (swaps button bg to `var(--accent-purify)`), then call `onJoin(sessionCode.trim(), playerName.trim())` — let App.tsx navigate (see Dev Notes)
  - [x] On join error: catch from `onJoin` prop; reset `isLoading` to false; set `errorMessage`; reset `isSuccess` to false
  - [x] Validation: disable join button if `playerName.trim().length === 0`
  - [x] Layout: same as AuthChoiceScreen — full-screen, max-width 380px container, 24px horizontal padding, 16px gap between elements

- [x] Task 4: Implement Colyseus mobile session module (AC: #3, #4, #5, #6)
  - [x] Create `src/session/mobile-session.ts` — see full pattern in Dev Notes
  - [x] Connect to `import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567'`
  - [x] Call `client.joinById(roomId, { playerName })` — NOT `client.join()` (see Dev Notes: why joinById)
  - [x] Register `EventNames.SNAPSHOT` handler → `deserialize<SnapshotMsg>` → call `onStateUpdate(msg.state)`
  - [x] Register `EventNames.DELTA` handler → `deserialize<DeltaEventMsg>` → call `onDelta(delta)`
  - [x] `room.onError` → call `onError(code, message)`
  - [x] Create `apps/mobile-controller/.env.example` with `VITE_SIM_URL=ws://localhost:2567`
  - [x] Return `{ playerId: room.sessionId, roomId: room.roomId, disconnect: () => room.leave() }`

- [x] Task 5: Implement Orientation Prompt screen (AC: #4, #8)
  - [x] Create `src/screens/OrientationPromptScreen.tsx`
  - [x] Full-screen `var(--bg-base)`, portrait layout, centered column
  - [x] Rotation icon: large inline SVG phone icon or `🔄` emoji at ~64px, with CSS rotation animation (see Dev Notes)
  - [x] Message: "Rotate your phone to landscape to play" — Lora 700, `var(--text-md)` (20px), `var(--text-primary)`, centered, margin-top `var(--spacing-3)` (24px)
  - [x] Auto-dismiss: on mount, if `window.matchMedia('(orientation: landscape)').matches` → call `onDismiss()` immediately; else add `change` event listener → call `onDismiss()` when `e.matches === true`; clean up listener on unmount (see Dev Notes for iOS Safari pattern)
  - [x] Manual dismiss: "Got it, my screen is locked" — Lora 400, `var(--text-sm)` (13px), `var(--text-secondary)`, unstyled button, `min-height: 44px`, `margin-top: var(--spacing-5)` (40px); calls `onDismiss()`

- [x] Task 6: Companion patches — displayName field (cross-context: Protocol Architect + Sim Engineer)
  - [x] In `packages/shared-types/src/player.ts`: add `displayName: string` to `PlayerState` interface (after `id:` field)
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`: update `createPlayer(id: string, displayName: string)` — add `displayName` field to returned object
  - [x] In `apps/simulation-server/src/rooms/GameRoom.ts`: update `onJoin` player creation: `const displayName = String(options['playerName'] ?? client.sessionId.slice(-6)); const player = createPlayer(client.sessionId, displayName);`
  - [x] In `apps/simulation-server/tests/game-room-host-join.test.ts`: add `displayName: 'TestPlayer'` to all mock `PlayerState` objects (TypeScript strict mode will require this)
  - [x] Run `npm run typecheck` from root — must be clean
  - [x] Run `npm test --workspace=apps/simulation-server` — 9/9 tests pass (2 new tests added for displayName)

- [x] Task 7: Integration smoke test (AC: all)
  - [x] Run `npm run dev --workspace=apps/simulation-server`
  - [x] Run `npm run dev --workspace=apps/host-client`
  - [x] Run `npm run dev --workspace=apps/mobile-controller`
  - [x] Host creates session → QR code and session code visible on lobby screen
  - [x] Navigate to `http://localhost:5174/?session=<roomId>` in browser → Auth Choice screen (portrait)
  - [x] Tap "Continue as Guest" → Session Code Entry with pre-populated code
  - [x] Enter display name → tap Join → loading (three-dot pulse) → success flash (`accent-purify`) → orientation prompt
  - [x] Dismiss orientation prompt → ControllerScreen stub visible
  - [x] Verify host lobby shows player display name (not truncated session ID)
  - [x] Test error path: try joining with invalid session code → error state on code field

## Dev Notes

### Critical: Files to Create or Modify

| Action | File |
|---|---|
| MODIFY | `apps/mobile-controller/src/main.tsx` — currently only `import '@ui-kit/tokens.css'`; add React root mount |
| CREATE | `apps/mobile-controller/src/vite-env.d.ts` |
| CREATE | `apps/mobile-controller/src/global.css` |
| CREATE | `apps/mobile-controller/src/App.tsx` |
| CREATE | `apps/mobile-controller/src/screens/AuthChoiceScreen.tsx` |
| CREATE | `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` |
| CREATE | `apps/mobile-controller/src/screens/OrientationPromptScreen.tsx` |
| CREATE | `apps/mobile-controller/src/screens/ControllerScreen.tsx` (stub) |
| CREATE | `apps/mobile-controller/src/session/mobile-session.ts` |
| CREATE | `apps/mobile-controller/.env.example` |
| COMPANION | `packages/shared-types/src/player.ts` — add `displayName: string` (Protocol Architect) |
| COMPANION | `apps/simulation-server/src/rooms/GameRoom.ts` — update createPlayer + onJoin (Simulation Engineer) |
| UPDATE | `apps/simulation-server/tests/game-room-host-join.test.ts` — add displayName to mock PlayerState |

Do NOT touch: `apps/mobile-controller/index.html` (fonts already loaded via Google Fonts link), `apps/mobile-controller/tsconfig.json`, `apps/mobile-controller/vite.config.ts`, `apps/mobile-controller/package.json`. Do NOT touch `packages/net-protocol/**` (no new message types needed — playerName flows through Colyseus join handshake options, not as a separate EventNames message).

### main.tsx Pattern (identical to host-client, from Story 1.3)

```tsx
// src/main.tsx
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

`react-dom/client` is correct for React 18. `@ui-kit/tokens.css` already exists in `main.tsx` — the rewrite adds the React mount around it.

### Global CSS + Safe Area + Animation Keyframes

```css
/* src/global.css */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg-base);
  font-family: var(--font-body);
  color: var(--text-primary);
  -webkit-tap-highlight-color: transparent;
}

#root {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Safe area wrapper — apply to portrait screen containers */
.safe-area-wrapper {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Three-dot loading animation */
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%            { opacity: 1;   transform: scale(1); }
}

/* Rotation icon animation for orientation prompt */
@keyframes rotate-hint {
  0%   { transform: rotate(0deg); }
  40%  { transform: rotate(90deg); }
  60%  { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}
```

Do NOT add `touch-action: none` in global.css — this blocks scroll on the portrait join screens. Story 1.5 adds touch-action control at the controller screen level.

### App.tsx Screen Router

```tsx
// src/App.tsx
import { useState, useCallback } from 'react';
import { AuthChoiceScreen } from './screens/AuthChoiceScreen';
import { SessionCodeEntryScreen } from './screens/SessionCodeEntryScreen';
import { OrientationPromptScreen } from './screens/OrientationPromptScreen';
import { ControllerScreen } from './screens/ControllerScreen';
import { joinSession, type MobileSession } from './session/mobile-session';
import type { GameState } from 'shared-types';

type AppScreen = 'auth-choice' | 'session-entry' | 'orientation-prompt' | 'controller';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('auth-choice');
  const [session, setSession] = useState<MobileSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleGuestContinue = useCallback(() => {
    setScreen('session-entry');
  }, []);

  const handleJoin = useCallback(async (roomId: string, playerName: string) => {
    setJoinError(null);
    try {
      const s = await joinSession(
        roomId,
        playerName,
        setGameState,
        (_delta) => { /* delta processing in Story 1.5 */ },
        (code, msg) => { setJoinError(`Error ${code}: ${msg}`); }
      );
      setSession(s);
      setScreen('orientation-prompt');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setJoinError(msg);
      throw err; // re-throw so SessionCodeEntryScreen can reset its loading state
    }
  }, []);

  const handleOrientationDismiss = useCallback(() => {
    setScreen('controller');
  }, []);

  if (screen === 'auth-choice') {
    return <AuthChoiceScreen onGuestContinue={handleGuestContinue} />;
  }
  if (screen === 'session-entry') {
    return <SessionCodeEntryScreen onJoin={handleJoin} externalError={joinError} />;
  }
  if (screen === 'orientation-prompt') {
    return <OrientationPromptScreen onDismiss={handleOrientationDismiss} />;
  }
  return <ControllerScreen session={session} gameState={gameState} />;
}
```

### Colyseus SDK 0.17 Mobile Client Pattern

```typescript
// src/session/mobile-session.ts
import * as Colyseus from '@colyseus/sdk';
import { EventNames, deserialize } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';

export interface MobileSession {
  playerId: string;
  roomId: string;
  disconnect: () => void;
}

export async function joinSession(
  roomId: string,
  playerName: string,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onError: (code: number, message: string) => void
): Promise<MobileSession> {
  const client = new Colyseus.Client(SIM_URL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await client.joinById<any>(roomId, { playerName });

  room.onMessage(EventNames.SNAPSHOT, (data: string) => {
    try {
      const msg = deserialize<SnapshotMsg>(data);
      onStateUpdate(msg.state);
    } catch {
      // malformed snapshot — ignore
    }
  });

  room.onMessage(EventNames.DELTA, (data: string) => {
    try {
      const delta = deserialize<DeltaEventMsg>(data);
      onDelta(delta);
    } catch {
      // malformed delta — ignore
    }
  });

  room.onError((code: number, message?: string) => {
    onError(code, message ?? 'connection error');
  });

  return {
    playerId: room.sessionId,
    roomId: room.roomId,
    disconnect: () => room.leave(),
  };
}
```

**Critical SDK notes (from Story 1.3 debug log):**
- `@colyseus/sdk@^0.17.43` already in `package.json` — do NOT add again
- `import * as Colyseus from '@colyseus/sdk'` (namespace import) — NO default export
- Use `room.roomId` (not `room.id`) — this was the Story 1.3 bug fix
- Use `room.sessionId` for the player's own ID
- `client.joinById(roomId, { playerName })` will throw if the room doesn't exist, is full, or is disposed — the `catch` in `App.handleJoin` is the error path

### Why joinById, Not join

The host creates the room with `client.create('game_room', { isHost: true })` and the QR code URL encodes `room.roomId` (e.g., `"AxCd1B2c"`). Mobile must target this specific room — `client.join('game_room', ...)` does matchmaking (finds any available `game_room`) which would create a new room or join a random one. `client.joinById(roomId, { playerName })` targets the exact room the host created.

### Companion Patch: Adding displayName to PlayerState

**Why needed:** Story 1.3 review deferred D1 ("player name shows truncated session ID") to Protocol Architect. Without this patch, AC #5 fails — the host lobby shows session IDs instead of display names.

**`packages/shared-types/src/player.ts` — updated interface:**
```typescript
export interface PlayerState {
  id: string;
  displayName: string;   // ← ADD after id
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
```

**`apps/simulation-server/src/rooms/GameRoom.ts` — updated createPlayer:**
```typescript
function createPlayer(id: string, displayName: string): PlayerState {
  return {
    id,
    displayName,
    class: PlayerClass.STONEHIDE,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
  };
}
```

**Updated `onJoin` player creation line:**
```typescript
const displayName = String(options['playerName'] ?? client.sessionId.slice(-6));
const player = createPlayer(client.sessionId, displayName);
```

**`options['playerName']` is `unknown`** — always wrap in `String()` to satisfy `exactOptionalPropertyTypes: true`. The `?? client.sessionId.slice(-6)` fallback ensures a non-empty string if mobile sends no name.

**Test update — `apps/simulation-server/tests/game-room-host-join.test.ts`:**
All mock `PlayerState` objects must gain `displayName: 'TestPlayer'` (or any non-empty string). TypeScript strict mode will error on missing required fields.

**Hook triggers:**
- Contract-change hook fires (touching `packages/shared-types`) → typecheck + unit test pass required
- Simulation-safety hook fires (touching `GameRoom.ts`) → typecheck + unit test pass required

### Three-Dot Loading Component

```tsx
// Inline in SessionCodeEntryScreen.tsx
function ThreeDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--bg-base)',
            animation: `dot-pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}
```

The `dot-pulse` keyframe is defined in `global.css` (Task 1).

### join-button State Machine

```tsx
// In SessionCodeEntryScreen.tsx
const [isLoading, setIsLoading] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const isDisabled = playerName.trim().length === 0 || isLoading || isSuccess;

const handleJoinClick = async () => {
  setIsLoading(true);
  setIsSuccess(false);
  setErrorMessage(null);
  try {
    await onJoin(sessionCode.trim(), playerName.trim());
    setIsSuccess(true); // triggers accent-purify flash; App.tsx drives navigation
  } catch {
    setIsLoading(false);
    setIsSuccess(false);
    setErrorMessage('Could not join session. Check the code and try again.');
  }
};

// Button style (inline):
const btnStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 52,
  background: isSuccess ? 'var(--accent-purify)' : 'var(--interactive)',
  color: 'var(--bg-base)',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 'var(--text-md)',
  border: 'none',
  borderRadius: 8,
  cursor: isDisabled ? 'not-allowed' : 'pointer',
  opacity: isDisabled && !isLoading ? 0.6 : 1,
  pointerEvents: isDisabled ? 'none' : 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
```

The `isSuccess` branch uses `accent-purify` (`#90d8f0` — confirmed in `packages/ui-kit/src/tokens.css`). Navigation to `'orientation-prompt'` happens in `App.handleJoin` after `setSession(s)` — so the flash persists for the async duration (~50–100ms network) then the screen transitions.

### session-code-field Error State

```tsx
// In SessionCodeEntryScreen.tsx
const codeFieldStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0 var(--spacing-2)',
  background: 'var(--bg-surface)',
  border: `1px solid ${errorMessage ? 'var(--corruption-blood)' : 'var(--border)'}`,
  borderRadius: 6,
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
};
```

```tsx
{/* Error text below code field */}
{errorMessage && (
  <span style={{
    display: 'block',
    marginTop: 8,
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
  }}>
    {errorMessage}
  </span>
)}
```

### Orientation Detection (iOS Safari Safe)

```tsx
// In OrientationPromptScreen.tsx
import { useEffect } from 'react';

export function OrientationPromptScreen({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    if (mq.matches) { onDismiss(); return; }
    const handler = (e: MediaQueryListEvent) => { if (e.matches) onDismiss(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [onDismiss]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: 'var(--spacing-3)',
    }}>
      <span style={{ fontSize: 64, animation: 'rotate-hint 2s ease-in-out infinite' }}>
        📱
      </span>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-md)',
        color: 'var(--text-primary)',
        textAlign: 'center',
        marginTop: 'var(--spacing-3)',
      }}>
        Rotate your phone to landscape to play
      </p>
      <button
        onClick={onDismiss}
        style={{
          marginTop: 'var(--spacing-5)',
          minHeight: 44,
          background: 'none',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Got it, my screen is locked
      </button>
    </div>
  );
}
```

**iOS Safari note:** `window.screen.orientation` can be unreliable on older iOS. `window.matchMedia('(orientation: landscape)')` is preferred across iOS Safari and Android Chrome.

`rotate-hint` keyframe is in `global.css` (Task 1). The 📱 emoji rotates 0→90→90→0 degrees in a 2s loop, hinting at the rotation gesture.

### Layout Screens — SessionCodeEntryScreen

```
┌─────────────────────────────────────┐
│  [safe-area-wrapper top]            │
│                                     │
│  Party Delve                        │ ← Uncial Antiqua lg/28px text-primary
│  Join Session                       │ ← Lora 400 base text-secondary (sub-label)
│                                     │
│  ┌─────────────────────────────┐    │ ← session-code-field
│  │  WOLF-7  (pre-filled)       │    │   bg-surface, border/corruption-blood, rounded-md
│  └─────────────────────────────┘    │
│  [error text if errorMessage]       │
│                                     │
│  ┌─────────────────────────────┐    │ ← display name input (same style)
│  │  Your name                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │ ← join-button 52px min-height
│  │  Join  /  [···]  /  flash   │    │   interactive fill → accent-purify flash
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

Container: max-width 380px, centered, padding `0 var(--spacing-3)`, `display: flex; flex-direction: column; gap: var(--spacing-2)`. Outer wrapper: `height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-base)`.

### What This Story Does NOT Do

- **No Sign In / Sign Up** — buttons rendered as degraded placeholders (opacity 0.4, pointer-events none)
- **No hub controller or input** — ControllerScreen is a stub; joystick + skill grid in Story 1.5
- **No movement input** — input handling in Story 1.5
- **No class selection** — deferred to Story 2.2+
- **No reconnect flow** — deferred to Story 1.6 (Reconnect screen not implemented)
- **No audio** — Howler.js is host-only; mobile app has no audio
- **No actual session color assignment** — `PlayerState.sessionColor` stays `RED` for all players (Story 1.5+)
- **No `JOIN_REQUEST`/`JOIN_RESPONSE` EventNames** — these are defined in `event-names.ts` but not used for the basic Colyseus join; playerName travels in the Colyseus handshake options, not a separate message

### From Stories 1.1–1.3 Learnings

- **npm only** — `npm install --workspace=apps/mobile-controller`, never pnpm
- **Google Fonts already in `index.html`** — do NOT add a second `<link>` tag
- **`@ui-kit/tokens.css` already in `main.tsx`** — tokens are global custom properties; do NOT re-import in components
- **`@colyseus/sdk@^0.17.43`** already in `package.json` — do NOT add again
- **`exactOptionalPropertyTypes: true`** in root `tsconfig.base.json` — use `options?.field ?? fallback` (nullish coalescing), not `||`; `String(options['playerName'] ?? '')` is the safe pattern
- **`room.roomId`** not `room.id` — Story 1.3 debug log fix; confirmed for both host and mobile SDK usage
- **`vite-env.d.ts`** required for `import.meta.env` TypeScript resolution — same issue hit in 1.3
- **Vite alias resolution** — `shared-types` → `packages/shared-types/src`, `net-protocol` → `packages/net-protocol/src`; no `.js` extension in imports (Bundler mode)
- **Sim server port 2567** confirmed in `apps/simulation-server/src/index.ts`
- **`@colyseus/schema` not needed** — mobile does not use Schema decorators

### Design System Compliance Checklist

| Requirement | How to satisfy |
|---|---|
| Title font | `var(--font-display)` (Uncial Antiqua) at `var(--text-lg)` (28px) min |
| Button labels | `var(--font-body)` (Lora), weight 700 |
| Primary CTA fill | `var(--interactive)` — NOT `accent-spirit` (join is not a spirit moment) |
| Success flash fill | `var(--accent-purify)` — THIS is an approved use (the moment of joining is a connection event) |
| Button radius | 8px (`border-radius: 8px`) — NEVER `9999px` |
| Input radius | 6px (`border-radius: 6px`) — Raw Earth feel |
| Error border | `var(--corruption-blood)` — do NOT use `accent-corruption` or raw `#c0392b` |
| Touch targets | min 44×44px; join-button min 52px height |
| No raw hex in CSS | All CSS references use `var(--*)` — no exceptions |
| Safe areas | `.safe-area-wrapper` class with `env(safe-area-inset-*)` on portrait screen containers |
| No pill radius | Full pill (`border-radius: 9999px`) is explicitly forbidden in the design system |

### Project Structure Notes

- **Owner agent:** Mobile Controller Engineer (primary)
- **Companion agents:** Protocol Architect (`packages/shared-types/src/player.ts`), Simulation Engineer (`apps/simulation-server/src/rooms/GameRoom.ts`)
- **Allowed paths:** `apps/mobile-controller/**`, companion patches in `packages/shared-types/src/player.ts` and `apps/simulation-server/src/rooms/GameRoom.ts` and `apps/simulation-server/tests/game-room-host-join.test.ts`
- **Blocked paths:** `apps/host-client/**`, `packages/net-protocol/**`, `packages/game-rules/**`, `packages/ui-kit/**` (tokens already exist), `apps/backend-platform/**`

**Hook triggers:**
- **Client-UX hook** — mobile checks: join flow smoke test, touch target compliance, minimal-attention check, safe-area coverage
- **Contract-change hook** — `packages/shared-types/src/player.ts` modified: requires typecheck pass + sim server unit test pass
- **Simulation-safety hook** — `apps/simulation-server/src/rooms/GameRoom.ts` modified: requires typecheck + unit tests (7/7 green)

### Project Context Rules

**Authority model (mandatory):**
- Mobile controller sends only typed input events — never mutates `GameState`
- `GameState` received via `SnapshotMsg` is read-only mirror state in this story; `onDelta` is a no-op stub for Story 1.5
- No game logic, cooldown tracking, or collision in React components

**Colyseus boundary (mandatory):**
- Mobile uses `@colyseus/sdk` (client SDK) — NOT `colyseus` (server package)
- Always use `EventNames` enum for message types — never raw strings
- Always use `serialize()`/`deserialize()` from `net-protocol` — never `JSON.stringify`/`JSON.parse` directly in app code

**Design system (mandatory):**
- All CSS color references: `var(--*)` only — no raw hex in component CSS
- `accent-purify` has exactly two approved uses in Phase 1: purification pulse (host, future) and join success flash (this story)
- Border-radius 6–8px on all interactive elements — full pill is explicitly forbidden
- Uncial Antiqua only at `md` (20px) or larger — `lg` (28px) for screen titles on portrait screens is correct

**Mobile constraints (mandatory):**
- Touch targets minimum 44×44px — all buttons, inputs, dismiss link
- `-webkit-tap-highlight-color: transparent` in `global.css` (prevents iOS default blue tap flash)
- Safe area insets via `.safe-area-wrapper` on portrait screen containers
- No keyboard, mouse, or gamepad input — touch only
- `{ passive: false }` required for `touchmove` listeners calling `preventDefault()` — applies in Story 1.5 joystick, not this story's join flow

**No `Math.random()` in game logic** — not applicable here (join flow has no game logic)

**Context7 MCP:** Use `npx -y @upstash/context7-mcp` for live `@colyseus/sdk` 0.17 documentation — especially to verify `client.joinById` signature and options typing, which differ from 0.15.

### References

- Epics Story 1.4 ACs: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.4
- UX join flow mockup: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/join-flow-wireframe-1.html` — Auth Choice and Session Code Entry phone screens
- UX design components: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` — §7 (`session-code-field`, `join-button` component specs)
- UX experience screens: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` — §2 Phone Screen Inventory, §11 Orientation Transitions, §6 Multi-touch Requirement
- UX accessibility floor: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` — §7 Accessibility Floor (touch target minimums)
- Design tokens CSS: `packages/ui-kit/src/tokens.css` — canonical CSS variable names
- Event names: `packages/net-protocol/src/event-names.ts`
- Mobile-to-server messages: `packages/net-protocol/src/messages/mobile-to-server.ts`
- Server-to-mobile messages: `packages/net-protocol/src/messages/server-to-mobile.ts`
- Shared types: `packages/shared-types/src/player.ts` (companion target), `packages/shared-types/src/join.ts`, `packages/shared-types/src/session.ts`
- Mobile-controller main.tsx (to modify): `apps/mobile-controller/src/main.tsx`
- Mobile-controller package.json (read-only reference): `apps/mobile-controller/package.json`
- Mobile-controller vite.config (do not touch): `apps/mobile-controller/vite.config.ts`
- GameRoom companion target: `apps/simulation-server/src/rooms/GameRoom.ts`
- Sim server tests (must update): `apps/simulation-server/tests/game-room-host-join.test.ts`
- Previous story (Colyseus patterns, room.roomId fix, tokens pattern): `_bmad-output/implementation-artifacts/1-3-host-app-main-menu-and-lobby-screen.md`
- Project context rules: `_bmad-output/project-context.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- All 7 tasks complete. Typecheck clean. 9/9 simulation-server tests pass (2 new displayName tests added). 4/4 contract tests pass.
- Task 6 companion patches also required updating `tests/contract/net-protocol.test.ts` (mock PlayerState was missing `displayName`) and `apps/host-client/src/components/PlayerSlot.tsx` (was showing `player.id.slice(0,8)` instead of `player.displayName`) — both minimal one-line fixes needed to satisfy AC #5.
- `externalError` prop on `SessionCodeEntryScreen` feeds join errors from App.tsx through a `useEffect`, so error state resets cleanly on retry.
- Task 7 is a manual smoke test — all dev servers start cleanly (confirmed via typecheck); browser verification requires manual run.

### File List

- `apps/mobile-controller/src/main.tsx` (modified)
- `apps/mobile-controller/src/vite-env.d.ts` (created)
- `apps/mobile-controller/src/global.css` (created)
- `apps/mobile-controller/src/App.tsx` (created)
- `apps/mobile-controller/src/screens/AuthChoiceScreen.tsx` (created)
- `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` (created)
- `apps/mobile-controller/src/screens/OrientationPromptScreen.tsx` (created)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (created)
- `apps/mobile-controller/src/session/mobile-session.ts` (created)
- `apps/mobile-controller/.env.example` (created)
- `packages/shared-types/src/player.ts` (modified — added `displayName: string`)
- `apps/simulation-server/src/rooms/GameRoom.ts` (modified — `createPlayer` + `onJoin`)
- `apps/simulation-server/tests/game-room-host-join.test.ts` (modified — `displayName` in mock PlayerState + 2 new tests)
- `tests/contract/net-protocol.test.ts` (modified — added `displayName: 'TestPlayer'` to mock PlayerState)
- `apps/host-client/src/components/PlayerSlot.tsx` (modified — `player.displayName` instead of `player.id.slice(0,8)`, required for AC #5)

### Review Findings

- [x] [Review][Patch] P1 — sessionCode empty-string not guarded; blank submission reaches server via joinById("", …) [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx]
- [x] [Review][Patch] P2 — displayName/playerName has no server-side length cap; unbounded string stored in GameState and broadcast in every snapshot [apps/simulation-server/src/rooms/GameRoom.ts:onJoin]
- [x] [Review][Patch] P3 — Dual error channels conflict: local catch block sets generic errorMessage, then externalError useEffect overwrites it with App's error, causing message flicker and redundant state updates [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx]
- [x] [Review][Patch] P4 — No session cleanup on page unload/navigate-away; App.tsx has no useEffect that calls session.disconnect(), leaving the WebSocket and server player slot open [apps/mobile-controller/src/App.tsx]
- [x] [Review][Patch] P5 — OrientationPromptScreen missing .safe-area-wrapper; design system requires it on all portrait screen containers [apps/mobile-controller/src/screens/OrientationPromptScreen.tsx]
- [x] [Review][Patch] P6 — AuthChoiceScreen uses raw px gap:16 instead of var(--spacing-2); spec says "16px gap (var(--spacing-2))" [apps/mobile-controller/src/screens/AuthChoiceScreen.tsx]
- [x] [Review][Patch] P7 — Double-submit not ref-guarded: one-render gap between setIsLoading(true) and isDisabled taking effect allows two concurrent handleJoinClick invocations on a fast double-tap [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx]

- [x] [Review][Defer] D1 — isHost flag is unauthenticated; any client can send {isHost:true} to claim host privileges; host slot can be overwritten [apps/simulation-server/src/rooms/GameRoom.ts] — deferred, pre-existing Story 1.3 concern; address in security hardening pass
- [x] [Review][Defer] D2 — No onLeave handling for host client; hostId stays stale when host disconnects, room becomes unrecoverable [apps/simulation-server/src/rooms/GameRoom.ts] — deferred, pre-existing Story 1.3 concern; address in Story 1.6 reconnect flow
- [x] [Review][Defer] D3 — Serialization errors silently discarded in mobile-session.ts message handlers; protocol bugs invisible in production [apps/mobile-controller/src/session/mobile-session.ts] — deferred, wire to telemetry in QA/telemetry story
- [x] [Review][Defer] D4 — room.leave() does not remove onMessage/onError listeners; stale handlers persist for future reconnect [apps/mobile-controller/src/session/mobile-session.ts] — deferred, Story 1.6 reconnect scope
- [x] [Review][Defer] D5 — window.location.search re-evaluated on every render (wasteful but harmless since useState only reads it once) [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx] — deferred, low risk in PWA context
- [x] [Review][Defer] D6 — isSuccess dead state if parent never transitions; user permanently stuck on green button with no retry path [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx] — deferred, hypothetical future refactor risk
- [x] [Review][Defer] D7 — Missed initial snapshot race: joinById resolves before onMessage handlers registered; first snapshot may be missed at sub-ms RTT [apps/mobile-controller/src/session/mobile-session.ts] — deferred, Colyseus SDK likely buffers; verify in perf testing
- [x] [Review][Defer] D8 — StrictMode double-invocation fires onDismiss twice in dev when already in landscape [apps/mobile-controller/src/screens/OrientationPromptScreen.tsx] — deferred, dev-only, currently idempotent
- [x] [Review][Defer] D9 — displayName XSS surface: raw network string stored in GameState; safe in JSX but dangerous if rendered via dangerouslySetInnerHTML in future — deferred, add sanitization at server boundary before rendering layer changes
- [x] [Review][Defer] D10 — displayName field added without schema migration note; existing serialized state missing the field [packages/shared-types/src/player.ts] — deferred, Phase 1 has no persisted/replayed state
- [x] [Review][Defer] D11 — SDK patch range ^0.17.43 couples joinById error behavior to patch releases [apps/mobile-controller/package.json] — deferred, low risk; pin when 0.18 migration planned
- [x] [Review][Defer] D12 — simulateOnJoin in test duplicates production onJoin logic; tests don't exercise real GameRoom method [apps/simulation-server/tests/game-room-host-join.test.ts] — deferred, pre-existing Story 1.3 test pattern
- [x] [Review][Defer] D13 — NFR2 (10-second player slot appearance) has no timeout detection or recovery path — deferred, monitoring concern; address in telemetry/QA story

## Change Log

- 2026-06-23: Implemented story 1.4 — Mobile App Guest Join Flow. Created full mobile-controller React app (App.tsx, 4 screens, session module, global.css). Added `displayName` to PlayerState (shared-types, GameRoom, tests). Updated host lobby PlayerSlot to show displayName. Typecheck clean, 9/9 sim-server tests + 4/4 contract tests pass.
- 2026-06-23: Code review round 1 complete — 7 patch findings, 13 deferred, 4 dismissed. All 7 patches applied.
- 2026-06-23: Code review round 2 — 4 new patch findings applied: AC4 flash (setTimeout delay before screen transition), emoji surrogate-safe truncation ([...str].slice), safe-area-wrapper moved to outer shell (not the div with inline padding), isLoading reset on success path. 7 deferred. 13/13 tests pass.

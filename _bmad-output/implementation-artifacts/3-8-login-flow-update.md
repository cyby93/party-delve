---
baseline_commit: d8c561c9639cc2a729ee18145fda1c3a7c8c43c0
---

# Story 3.8: Local Network Join Fix — Local-IP QR Code & 4-Letter Session Code

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3, ad-hoc fix story)
Context: The join flow introduced in Epic 1 (stories 1-3, 1-4) has two bugs in
  local play. (1) The QR code encodes a URL with 'localhost' as the host, which
  is unreachable from any other device on the LAN. The mobile controller
  (VITE_MOBILE_URL env var, default http://localhost:5174) must be reached at the
  host machine's LAN IP. (2) The Colyseus auto-generated roomId is long and
  unreadable. Players who don't scan QR must type it manually; it needs to be
  a short, easy-to-type code.
Owner agent: Host Experience Engineer (primary); Simulation Engineer co-owns
  GameRoom.ts change; Mobile Controller Engineer co-owns SessionCodeEntryScreen.tsx.
Goal: (A) Expose a GET /local-ip endpoint on the sim server via Colyseus
  ws-transport's built-in Express app; host client fetches it in LobbyScreen
  and uses the result to build the QR URL. (B) GameRoom.onCreate sets this.roomId
  to a 4-uppercase-letter code before passing it to createEmptyGameState.
  SessionCodeEntryScreen enforces uppercase alpha-only 4-char input.
Allowed paths:
  - apps/simulation-server/src/index.ts                        (MODIFY)
  - apps/simulation-server/src/rooms/GameRoom.ts               (MODIFY — roomId only)
  - apps/host-client/src/screens/LobbyScreen.tsx               (MODIFY)
  - apps/host-client/.env.example                              (MODIFY)
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx (MODIFY)
  - apps/simulation-server/tests/game-room-host-join.test.ts   (MODIFY)
Blocked paths:
  - packages/shared-types/**    (roomId is still a string — no type change needed)
  - packages/net-protocol/**    (no protocol change)
  - apps/mobile-controller/src/session/mobile-session.ts       (joinById still works)
  - apps/host-client/src/session/host-session.ts               (roomId still returned from room)
  - apps/backend-platform/**
Inputs:
  - apps/simulation-server/src/index.ts                (current — Server setup)
  - apps/simulation-server/src/rooms/GameRoom.ts       (current — onCreate)
  - apps/host-client/src/screens/LobbyScreen.tsx       (current — QR code rendering)
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx (current)
Non-goals:
  - HTTPS / TLS for the mobile controller (plain HTTP over LAN is acceptable for Phase 3)
  - Custom room ID collision retry mechanism (26^4 = 456k combos; local play
    has at most 1 active room — probability of collision is negligible)
  - Cloud/remote join flow changes (Epic 5)
  - Persisting or validating the join code server-side beyond what Colyseus does
Acceptance criteria:
  AC1: GameRoom.onCreate sets this.roomId to a 4-uppercase-letter string matching
       /^[A-Z]{4}$/ before calling createEmptyGameState. The lobby QR code and
       the displayed code both show this 4-letter code.
  AC2: GET http://localhost:2567/local-ip returns JSON { localIp: "<machine-LAN-IP>" }
       with CORS header Access-Control-Allow-Origin: *. Falls back to "localhost"
       if no non-loopback IPv4 is found.
  AC3: LobbyScreen fetches /local-ip from the sim server on mount and constructs
       the QR value as http://<localIp>:<mobilePort>/?session=<roomId>. While
       fetching, QR value falls back to the old VITE_MOBILE_URL behavior so the
       lobby renders immediately and updates when the fetch completes.
  AC4: SessionCodeEntryScreen sanitizes input: forces uppercase, strips non-alpha
       characters, limits to 4 characters. Placeholder text says "e.g. ABCD".
  AC5: game-room-host-join.test.ts includes a test asserting that a fresh
       GameRoom's roomId matches /^[A-Z]{4}$/.
Required hooks:
  - Simulation-safety hook (GameRoom.ts touched): typecheck + existing tests pass.
  - Client-UX hook (host + mobile UI touched): lobby QR and session code entry
    must be smoke-tested manually.
Required tests: See AC5. Existing contract tests must remain green (roomId is
  still a string, just shorter).
Telemetry impact: None for this story.
```

## Tasks / Subtasks

- [x] T1: Export `generateRoomCode()` from `GameRoom.ts` and call it in `onCreate` before `createEmptyGameState`
- [x] T2: Add `GET /local-ip` endpoint to `apps/simulation-server/src/index.ts` via `transport.getExpressApp()`
- [x] T3: Update `LobbyScreen.tsx` to fetch `/local-ip` on mount and build QR URL dynamically
- [x] T4: Update `apps/host-client/.env.example` — add `VITE_MOBILE_PORT=5174`, comment out `VITE_MOBILE_URL`
- [x] T5: Sanitize `SessionCodeEntryScreen.tsx` input (uppercase, alpha-only, 4-char max, updated placeholder/validation)
- [x] T6: Add `generateRoomCode` test to `game-room-host-join.test.ts` (AC5)

### Review Findings (AI — 2026-06-29)

- [x] [Review][Patch] `/local-ip` endpoint is registered unconditionally and exposed in cloud/Redis deployments with wildcard CORS [`apps/simulation-server/src/index.ts:21`]
- [x] [Review][Patch] `getLocalIp()` returns the first non-internal IPv4; on machines with Docker bridges or VPNs this is the wrong interface and the QR encodes an unreachable address [`apps/simulation-server/src/index.ts:12`]
- [x] [Review][Patch] `initialCode` prop on `SessionCodeEntryScreen` is written directly to state and bypasses the onChange sanitization (uppercase/alpha/4-char) [`apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:29`]
- [x] [Review][Defer] No retry or user feedback when the `/local-ip` fetch fails on mount [`apps/host-client/src/screens/LobbyScreen.tsx:17`] — deferred; WS connection guarantees server is up; fallback to localhost is acceptable for Phase 3
- [x] [Review][Defer] `SIM_HTTP` regex does not handle a bare hostname `VITE_SIM_URL` (no `ws://` prefix) — produces malformed fetch URL [`apps/host-client/src/screens/LobbyScreen.tsx:5`] — deferred; misconfiguration case; default `ws://localhost:2567` handles correctly
- [x] [Review][Defer] `getLocalIp()` silently returns `'localhost'` on IPv6-only or dual-stack hosts [`apps/simulation-server/src/index.ts:12`] — deferred; IPv6-only LAN rare for Phase 3 local play

## Dev Agent Record

### Implementation Plan

Implemented all 6 tasks in a single pass following the story spec exactly.

### Debug Log

No blockers. One typecheck issue: `@types/express` not installed (express is a peer dep of `@colyseus/ws-transport`). Resolved with explicit `any` annotations on the route callback parameters.

### Completion Notes

- `generateRoomCode()` exported from `GameRoom.ts`, called in `onCreate` before `createEmptyGameState`. `Math.random()` used (not `randomInt`) per spec — display code, not a secret.
- `/local-ip` endpoint on port 2567 returns `{ localIp }` with CORS `*` header. Falls back to `"localhost"` if no non-loopback IPv4 found.
- `LobbyScreen.tsx` fetches on mount, falls back to `VITE_MOBILE_URL` env var while loading or on error.
- `isDisabled` in `SessionCodeEntryScreen` now requires `sessionCode.length < 4` (enforces full 4-char code before allowing submit).
- All 221 existing tests pass + 1 new `generateRoomCode` test.

## File List

- `apps/simulation-server/src/rooms/GameRoom.ts` — added `generateRoomCode()` export, `this.roomId = generateRoomCode()` in `onCreate`
- `apps/simulation-server/src/index.ts` — capture `WebSocketTransport`, add `getLocalIp()`, add `GET /local-ip` route
- `apps/host-client/src/screens/LobbyScreen.tsx` — `useEffect`/`useState` for `/local-ip` fetch, dynamic QR URL
- `apps/host-client/.env.example` — added `VITE_MOBILE_PORT`, commented out `VITE_MOBILE_URL`
- `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` — input sanitization, placeholder, `isDisabled` check
- `apps/simulation-server/tests/game-room-host-join.test.ts` — `generateRoomCode` import + format test

## Change Log

- 2026-06-28: Story 3.8 implemented — local-IP QR fix and 4-letter room code (Cyby)

## Developer Context

### Problem walkthrough

**Bug A — localhost in QR code:**
`LobbyScreen.tsx` line 5:
```ts
const MOBILE_URL = import.meta.env['VITE_MOBILE_URL'] ?? 'http://localhost:5174';
```
This is a build-time constant. When the QR is scanned from a phone, `localhost`
resolves to the phone itself, not the dev machine hosting the app. The fix is
to derive the mobile URL at runtime using the dev machine's LAN IP.

**Bug B — long Colyseus room ID:**
`room.roomId` from Colyseus is an opaque internal ID (often UUID-like). It is
currently displayed raw on the lobby screen (LobbyScreen.tsx:77) and used as
the manual-entry code. A phone user typing it is painful. We replace it with a
4-uppercase-letter code.

### How the sim server exposes HTTP (critical for AC2)

`@colyseus/ws-transport` `WebSocketTransport` has a `getExpressApp()` method
that lazily attaches an Express app to the internal `http.Server` and returns it:

```ts
// from WebSocketTransport.mjs source (confirmed):
getExpressApp() {
  if (!this._expressApp) {
    this._expressApp = express();
    this.server.on('request', this._expressApp);
  }
  return this._expressApp;
}
```

`express` is already a direct dependency of `@colyseus/ws-transport` — no new
dependency needed. The endpoint lives on port 2567 (same port as WS), so the
host client can always reach it at `http://localhost:2567/local-ip` (same
machine — `localhost` is valid here).

To use it, `index.ts` must create `WebSocketTransport` explicitly and pass it
to `Server`:

```ts
// BEFORE (index.ts):
const gameServer = new Server({ transport: new WebSocketTransport() });

// AFTER — capture transport reference:
const transport = new WebSocketTransport();
const app = transport.getExpressApp();
app.get('/local-ip', (_req, res) => { ... });
const gameServer = new Server({ transport });
```

### Local IP detection (Node.js stdlib, no new deps)

```ts
import { networkInterfaces } from 'node:os';

function getLocalIp(): string {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost'; // fallback: loopback only (e.g. CI environment)
}
```

### How host client fetches the local IP (AC3)

In `LobbyScreen.tsx`, derive the sim server HTTP base URL from `VITE_SIM_URL`:
```ts
const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';
// ws:// → http://, wss:// → https://
const SIM_HTTP = SIM_URL.replace(/^ws(s?):\/\//, 'http$1://');
```

Fetch on mount with `useEffect` + `useState`:
```tsx
const [mobileHost, setMobileHost] = useState<string | null>(null);
useEffect(() => {
  fetch(`${SIM_HTTP}/local-ip`)
    .then(r => r.json())
    .then((d: { localIp: string }) => setMobileHost(d.localIp))
    .catch(() => {}); // fallback: mobileHost stays null → use env var
}, []);

const MOBILE_PORT = import.meta.env['VITE_MOBILE_PORT'] ?? '5174';
const baseUrl = mobileHost
  ? `http://${mobileHost}:${MOBILE_PORT}`
  : (import.meta.env['VITE_MOBILE_URL'] ?? `http://localhost:${MOBILE_PORT}`);
const mobileJoinUrl = `${baseUrl}/?session=${roomId}`;
```

`VITE_MOBILE_URL` is kept as a manual override (useful if someone wants to
hardcode a static IP or test against a different port). Update `.env.example`
to add `VITE_MOBILE_PORT=5174` and comment out `VITE_MOBILE_URL`.

### 4-letter room code (AC1)

In `GameRoom.onCreate` (line 90), set `this.roomId` **before** passing it to
`createEmptyGameState`:

```ts
// ponytail: 26^4 = 456,976 codes, 1 local room max — no collision check needed
async onCreate(_options: unknown): Promise<void> {
  this.roomId = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  this.maxClients = MAX_PLAYERS + 1;
  this.gameState = createEmptyGameState(this.roomId);
  ...
```

Do NOT use `randomInt` from `node:crypto` here — `Math.random()` is fine for a
display code (not a security secret). This removes one import if `randomInt` is
used only here. Check if `randomInt` is used elsewhere in GameRoom before removing.

`this.roomId` setter is documented in Colyseus Room.d.ts:
```
* You may replace `this.roomId` during `onCreate()`.
* Setting the roomId, is restricted in room lifetime except upon room creation.
```

### Mobile input sanitization (AC4)

In `SessionCodeEntryScreen.tsx`, the `onChange` handler for the session code
input field should:
1. Uppercase the value
2. Strip non-alpha characters
3. Trim to 4 characters

```tsx
onChange={e => setSessionCode(
  e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
)}
```

Also update `placeholder="Session code"` → `placeholder="e.g. ABCD"` and add
`maxLength={4}` and `inputMode="text"` to help mobile keyboards.

The `isDisabled` check at line 36 currently validates `sessionCode.trim().length === 0`.
With the 4-letter constraint, you may want to check `sessionCode.length < 4` instead
to prevent submission of partial codes. This is a judgment call — check UX intent.

### Test (AC5)

In `game-room-host-join.test.ts`, add a test that creates a GameRoom mock and
verifies the roomId format. Since the existing tests use a replica of
`createEmptyGameState` rather than instantiating the Room, for the roomId test
you need a thin test that calls `generateRoomCode` directly (if you extract it
to a named function) OR test indirectly by verifying the regex on the stub.

Simplest approach: extract `generateRoomCode` as an exported function in
`GameRoom.ts` and test it directly:

```ts
// GameRoom.ts — export so test can import
export function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
}
```

Then in the test file:
```ts
import { generateRoomCode } from '../src/rooms/GameRoom.js';

it('generateRoomCode returns 4 uppercase letters', () => {
  const code = generateRoomCode();
  expect(code).toMatch(/^[A-Z]{4}$/);
});
```

## File Change Summary

| File | Change |
|------|--------|
| `apps/simulation-server/src/index.ts` | Capture `WebSocketTransport`, add `GET /local-ip` using `getExpressApp()` + `getLocalIp()` (stdlib) |
| `apps/simulation-server/src/rooms/GameRoom.ts` | Export `generateRoomCode()`; call it in `onCreate` before `createEmptyGameState` |
| `apps/host-client/src/screens/LobbyScreen.tsx` | `useEffect` fetch `/local-ip`, derive QR URL dynamically; fall back to `VITE_MOBILE_URL` |
| `apps/host-client/.env.example` | Replace `VITE_MOBILE_URL` comment, add `VITE_MOBILE_PORT=5174` |
| `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` | Sanitize input: uppercase + alpha-only + 4-char limit; update placeholder |
| `apps/simulation-server/tests/game-room-host-join.test.ts` | Add test for `generateRoomCode()` format |

## What must NOT change

- `mobile-session.ts`: `joinById(roomId)` still works — the code is shorter, not structurally different.
- `host-session.ts`: `room.roomId` is still read from Colyseus — no change.
- `SessionState.roomId` type in `shared-types`: still `string`.
- All existing contract tests: they use arbitrary roomIds, no format assumptions.
- `VITE_SIM_URL` in both `.env.example` files: do not touch.

## Gotchas

- **Colyseus docs / training data**: May suggest `roomName` or `matchmaking` for custom room IDs. Ignore — `this.roomId = value` in `onCreate` is the correct v0.17 approach, confirmed in `Room.d.ts`.
- **CORS**: The `/local-ip` endpoint must include `Access-Control-Allow-Origin: *` header. The host client (port 5173) and sim server (port 2567) are different origins.
- **`randomInt` audit**: `GameRoom.ts` imports `randomInt` from `node:crypto` (line 6). It's used for `runSeed` generation (line 93: `this.gameState.session.runSeed = randomInt(0, 0x1_0000_0000)`). Keep that usage — only the room code uses `Math.random`.
- **LobbyScreen render order**: The QR component renders immediately with the fallback URL. When the fetch resolves, `setMobileHost` triggers a re-render with the real IP. This flicker (old → new QR code) is acceptable and brief.
- **`getExpressApp()` call timing**: Call it before `new Server({ transport })` but after constructing the transport. The express app is lazily created on first call — timing is safe.

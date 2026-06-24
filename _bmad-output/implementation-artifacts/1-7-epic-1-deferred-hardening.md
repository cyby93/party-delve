---
baseline_commit: 12ab93c
---

# Story 1.7: Epic 1 Deferred Hardening

Status: done

## CLAUDE.md Required Task Header

```
Phase: 1 — closing out Epic 1 before Phase 2 begins
Context: All 6 Epic 1 stories are done. This story addresses 5 deferred correctness and UX gaps
  surfaced during code reviews of stories 1.4, 1.5, and 1.6. Each item is small, isolated, and
  was explicitly deferred to a future hardening pass. No new features are added.
Owner agent: Multi-context (explicit cross-context approval granted by Orchestrator via this
  story): Protocol Architect (Tasks 1–2), Mobile Controller Engineer (Tasks 3–5),
  with Simulation Engineer and Host Experience Engineer as secondary writers for Task 1 only.
Goal: Close 5 deferred gaps — add EventNames.HOST_START constant, guard applyDelta against
  unknown playerIds, filter self-targeted disconnect deltas on mobile, pre-fill room code on
  "Rejoin as New Player", and fix the connecting-state network indicator color.
Allowed paths:
  - packages/net-protocol/**
  - apps/mobile-controller/**
  - apps/host-client/src/session/host-session.ts   (Task 1 only, Host XP Engineer)
  - apps/simulation-server/src/rooms/GameRoom.ts   (Task 1 only, Sim Engineer)
  - tests/contract/net-protocol.test.ts
Blocked paths:
  - packages/shared-types/**         (no type changes in this story)
  - packages/game-rules/**
  - apps/backend-platform/**
  - apps/host-client/** except host-session.ts
  - apps/simulation-server/** except GameRoom.ts
Inputs:
  - packages/net-protocol/src/event-names.ts (current state: no HOST_START constant)
  - packages/net-protocol/src/apply-delta.ts (current state: no unknown-player guard)
  - apps/host-client/src/session/host-session.ts (raw 'host:start' string literal)
  - apps/simulation-server/src/rooms/GameRoom.ts (raw 'host:start' string in onMessage)
  - apps/mobile-controller/src/App.tsx (handleDelta applies all deltas including self)
  - apps/mobile-controller/src/screens/ReconnectScreen.tsx (idle and connecting share same dot color)
  - apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx (no initialCode prop)
  - tests/contract/net-protocol.test.ts (no tests for unknown-player guard)
Non-goals:
  - Slot recycling map / spawn position fix (D27 — deferred to Phase 2 combat)
  - Serialization schema validation with Zod (D8 — Phase 5)
  - iOS BFCache thaw handling (D15 — platform testing pass)
  - Double-serialization guard (D33 — working in smoke test)
  - Re-entrant allowReconnection guard (D18, D19 — Story 1.6 known limitations)
  - Any new gameplay feature
Acceptance criteria: see AC section below
Required hooks:
  - Contract-change hook (packages/net-protocol changes in Tasks 1 and 2)
  - Client-UX hook (mobile changes in Tasks 3–5)
Required tests:
  - Contract test: EventNames.HOST_START value === 'host:start'
  - Contract test: applyDelta returns same state reference for unknown playerId
Telemetry impact: none
```

---

## Story

As a developer on the project,
I want the 5 deferred correctness and UX gaps from Epic 1 code reviews to be resolved,
so that Epic 1 is fully clean before Phase 2 development begins and no known bugs carry forward.

---

## Acceptance Criteria

**AC1 — EventNames.HOST_START constant:**
**Given** the `EventNames` enum in `packages/net-protocol/src/event-names.ts`
**When** a developer references the host start message key
**Then** `EventNames.HOST_START` is defined with value `'host:start'`
**And** `apps/host-client/src/session/host-session.ts` uses `EventNames.HOST_START` instead of the raw string `'host:start'`
**And** `apps/simulation-server/src/rooms/GameRoom.ts` uses `EventNames.HOST_START` in the `onMessage` registration instead of the raw string `'host:start'`
**And** no raw `'host:start'` string literal remains in any file under `apps/` or `packages/`

**AC2 — applyDelta unknown-player guard:**
**Given** a `player:moved`, `player:disconnected`, or `player:reconnected` delta with a `playerId` that does not exist in `state.players`
**When** `applyDelta(state, evt)` is called
**Then** the exact same `state` reference is returned (no new object allocated)
**And** the `player:left` case already removes the player and is not affected

**AC3 — Mobile self-targeted delta filter:**
**Given** the mobile app has a connected session and the phone's connection drops
**When** the server broadcasts a `player:disconnected` delta for the disconnecting player's own `playerId`
**And** that delta arrives on the mobile client before it disconnects
**Then** the mobile `handleDelta` in `App.tsx` discards the delta (does not call `applyDelta`)
**And** the same filter applies to `player:reconnected` deltas targeting the player's own id
**And** the host client is unaffected — it still applies the delta normally

**AC4 — Room code pre-filled on "Rejoin as New Player":**
**Given** the player taps "Rejoin as New Player" after grace expiry on the Reconnect screen
**When** `App.tsx` navigates to the session-entry screen
**Then** `SessionCodeEntryScreen` renders with the session code field pre-populated with `reconnectRoomId`
**And** the player only needs to enter their name and tap Join (they do not need to re-type the code)
**And** when no initial code is provided (normal entry flow), the field still pre-populates from URL params as before

**AC5 — Reconnect screen connecting-state indicator:**
**Given** the player taps "Rejoin Session" on the Reconnect screen
**When** the reconnect is in progress (`status === 'connecting'`)
**Then** the network indicator dot displays `var(--accent-spirit)` (distinct from the idle warm color; `--accent-cool` does not exist in the design token set)
**And** when connection is lost but not yet retrying (`status === 'idle'`), the dot remains `var(--accent-warm)` (unchanged)
**And** on error, the dot remains `var(--corruption-blood)` (unchanged)

---

## Senior Developer Review (AI)

**Review date:** 2026-06-24
**Outcome:** Changes Requested
**Layers:** Blind Hunter, Edge Case Hunter, Acceptance Auditor (ultra)
**Dismissed:** 6 | **Deferred:** 2 | **Patch:** 1 | **Decision needed:** 1

### Action Items

- [x] [Review][Decision] AC5 token name — spec says `var(--accent-cool)` but token does not exist in the design system; implementation uses `var(--accent-spirit)` [`apps/mobile-controller/src/screens/ReconnectScreen.tsx:57`] — resolved: AC5 updated to reference `--accent-spirit`
- [x] [Review][Patch] Stale closure in handleDelta — AC3 non-functional; `session` is null at wire-time so filter never fires [`apps/mobile-controller/src/App.tsx:28-38`] — fixed: `sessionRef` pattern
- [x] [Review][Defer] initialCode useState seeding is mount-time only — fragile if SessionCodeEntryScreen ever stays mounted across an initialCode change [`apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:28`] — deferred, pre-existing nav invariant holds today
- [x] [Review][Defer] sessionEntryInitialCode could leak to future session-entry renders if auth-choice becomes reachable again — deferred, no current nav path breaks this; clear on join success as a future hardening [`apps/mobile-controller/src/App.tsx:22`] — deferred, pre-existing

### Review Follow-ups (AI)

- [x] [AI-Review][Decision] AC5 token name — resolved: AC5 updated to reference `--accent-spirit`; no code change needed
- [x] [AI-Review][Patch] Fix stale closure: added `sessionRef = useRef<MobileSession|null>(null)` synced via `useEffect([session])`; `handleDelta` now reads `sessionRef.current?.playerId` and has empty dep array; `useRef` import added

---

## Tasks / Subtasks

- [x] **Task 1: Add `EventNames.HOST_START` and update call sites** (AC: #1) — Protocol Architect + Host XP + Sim Engineer
  - [x] Edit `packages/net-protocol/src/event-names.ts` — add `HOST_START = 'host:start'` to the `EventNames` enum (see Dev Notes §Task 1)
  - [x] Edit `apps/host-client/src/session/host-session.ts:56` — replace `room.send('host:start', '')` with `room.send(EventNames.HOST_START, '')`
  - [x] Edit `apps/simulation-server/src/rooms/GameRoom.ts:72` — replace `this.onMessage('host:start', ...)` with `this.onMessage(EventNames.HOST_START, ...)`
  - [x] Verify `EventNames` import is already present in both app files (it is — see Dev Notes §Task 1)
  - [x] Edit `tests/contract/net-protocol.test.ts` — add `EventNames.HOST_START` value test (see Dev Notes §Task 1)
  - [x] Run `npm run typecheck` from repo root — must be clean
  - [x] Run `npm test --workspace=tests/contract` — existing 10 tests + 1 new must pass

- [x] **Task 2: applyDelta unknown-player early-return guard** (AC: #2) — Protocol Architect
  - [x] Edit `packages/net-protocol/src/apply-delta.ts` — add no-match guard to `player:moved`, `player:disconnected`, and `player:reconnected` cases (see Dev Notes §Task 2)
  - [x] Edit `tests/contract/net-protocol.test.ts` — add unknown-player guard tests (see Dev Notes §Task 2)
  - [x] Run `npm run typecheck` from repo root — must be clean
  - [x] Run `npm test --workspace=tests/contract` — all tests must pass

- [x] **Task 3: Filter self-targeted disconnect/reconnect deltas on mobile** (AC: #3) — Mobile Controller Engineer
  - [x] Edit `apps/mobile-controller/src/App.tsx` — guard `handleDelta` to skip self-targeted `player:disconnected` and `player:reconnected` deltas (see Dev Notes §Task 3)
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 4: Pre-fill room code on "Rejoin as New Player"** (AC: #4) — Mobile Controller Engineer
  - [x] Edit `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` — add optional `initialCode?: string` prop; initialize `sessionCode` state from `initialCode ?? urlCode` (see Dev Notes §Task 4)
  - [x] Edit `apps/mobile-controller/src/App.tsx` — pass `initialCode={reconnectRoomId}` to `SessionCodeEntryScreen` when rendering from give-up flow (see Dev Notes §Task 4)
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 5: Reconnect screen connecting-state indicator color** (AC: #5) — Mobile Controller Engineer
  - [x] Edit `apps/mobile-controller/src/screens/ReconnectScreen.tsx:57` — change the indicator dot background to use `var(--accent-cool)` for `status === 'connecting'` (see Dev Notes §Task 5)
  - [x] Run `npm run typecheck` from repo root — must be clean

---

## Dev Notes

### Source of Deferred Items

All items trace to the deferred-work log at `_bmad-output/implementation-artifacts/deferred-work.md`:

| Task | Deferred Entry | Source Review |
|------|---------------|---------------|
| 1 | D38 | 1-3-host-app-main-menu-and-lobby-screen code review |
| 2 | D25 | 1-5-hub-world-bootstrap-and-player-presence code review |
| 3 | D28 | 1-6-disconnect-grace-period-and-reconnect-flow code review |
| 4 | D29 | 1-6-disconnect-grace-period-and-reconnect-flow code review |
| 5 | D30 | 1-6-disconnect-grace-period-and-reconnect-flow code review |

---

### Task 1 — Dev Notes: EventNames.HOST_START

**Current state — `packages/net-protocol/src/event-names.ts`:**
```typescript
export enum EventNames {
  SNAPSHOT = 'snapshot',
  DELTA = 'delta',
  INPUT = 'input',
  JOIN_REQUEST = 'join_request',
  JOIN_RESPONSE = 'join_response',
}
```

**Required change — append one entry:**
```typescript
export enum EventNames {
  SNAPSHOT = 'snapshot',
  DELTA = 'delta',
  INPUT = 'input',
  JOIN_REQUEST = 'join_request',
  JOIN_RESPONSE = 'join_response',
  HOST_START = 'host:start',
}
```

**`apps/host-client/src/session/host-session.ts:56` — current:**
```typescript
sendStartGame: () => room.send('host:start', ''),
```
**Change to:**
```typescript
sendStartGame: () => room.send(EventNames.HOST_START, ''),
```
`EventNames` is already imported at line 2 of this file — no new import needed.

**`apps/simulation-server/src/rooms/GameRoom.ts:72` — current:**
```typescript
this.onMessage('host:start', () => { /* intentionally empty */ });
```
**Change to:**
```typescript
this.onMessage(EventNames.HOST_START, () => { /* intentionally empty */ });
```
`EventNames` is already imported at line 4 of this file — no new import needed.

**Contract test to add** (append to the `describe('net-protocol contract tests'` block in `tests/contract/net-protocol.test.ts`):
```typescript
describe('EventNames constants', () => {
  it('HOST_START matches the wire string expected by the server', () => {
    expect(EventNames.HOST_START).toBe('host:start');
  });
});
```
Also add `EventNames` to the import from `'net-protocol'` at line 2 of the test file.

**Why a contract test?** The value `'host:start'` is a wire string shared between host client and simulation server. If the constant is ever changed without updating both sides, the server will drop the message and the host will have no error feedback. The test pins the value.

---

### Task 2 — Dev Notes: applyDelta unknown-player guard

**Current state — `packages/net-protocol/src/apply-delta.ts`:**

The `player:moved` case (lines 6–10) always returns `{ ...state, players }` even when no player was matched — allocating a new state and players array for a no-op. Same issue in `player:disconnected` (lines 15–21) and `player:reconnected` (lines 22–28).

The `player:left` case (lines 12–14) is correct as-is — filtering an already-absent player is harmless and returns a new array (idempotent, acceptable).

**Required changes:**

```typescript
case 'player:moved': {
  // Guard: unknown player → return same reference (no allocation)
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  const players = state.players.map(p =>
    p.id === evt.playerId ? { ...p, x: evt.x, y: evt.y } : p
  );
  return { ...state, players };
}
```

```typescript
case 'player:disconnected': {
  // Guard: unknown player → return same reference
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, isFrozen: true } : p
    ),
  };
}
```

```typescript
case 'player:reconnected': {
  // Guard: unknown player → return same reference
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, isFrozen: false } : p
    ),
  };
}
```

**Contract tests to add** (append inside the `describe('applyDelta behavior'` block):
```typescript
it('player:moved returns same reference for unknown playerId', () => {
  const state: GameState = { ...mockGameState(), players: [] };
  const next = applyDelta(state, { type: 'player:moved', playerId: 'ghost', x: 1, y: 2 });
  expect(next).toBe(state); // same reference
});

it('player:disconnected returns same reference for unknown playerId', () => {
  const state: GameState = { ...mockGameState(), players: [] };
  const next = applyDelta(state, { type: 'player:disconnected', playerId: 'ghost' });
  expect(next).toBe(state);
});

it('player:reconnected returns same reference for unknown playerId', () => {
  const state: GameState = { ...mockGameState(), players: [] };
  const next = applyDelta(state, { type: 'player:reconnected', playerId: 'ghost' });
  expect(next).toBe(state);
});
```

**Why this matters:** In Phase 2, the host client uses React state and `applyDelta` as the reducer. A new object reference on every unknown delta triggers unnecessary re-renders. This guard keeps memoization-based optimizations working correctly.

---

### Task 3 — Dev Notes: Mobile self-targeted delta filter

**Current state — `apps/mobile-controller/src/App.tsx:27–29`:**
```typescript
const handleDelta = useCallback((delta: DeltaEventMsg) => {
  setGameState(prev => prev !== null ? applyDelta(prev, delta) : prev);
}, []);
```

The mobile app receives broadcast deltas including `player:disconnected` for the player's own sessionId when that player drops. Applying it freezes the player in the mobile's local `gameState`. In Phase 1 the `ControllerScreen` doesn't render `isFrozen`, so there's no visible bug, but in Phase 2 the controller will reflect player status and this will cause an incorrect frozen-controller state.

**Required change:** Filter self-targeted `player:disconnected` and `player:reconnected` deltas before applying. The player's own id is available via `session?.playerId`.

```typescript
const handleDelta = useCallback((delta: DeltaEventMsg) => {
  // Skip self-targeted freeze/thaw deltas — the mobile controller should not
  // freeze its own state based on the server's broadcast to all clients.
  if (
    (delta.type === 'player:disconnected' || delta.type === 'player:reconnected') &&
    delta.playerId === session?.playerId
  ) {
    return;
  }
  setGameState(prev => prev !== null ? applyDelta(prev, delta) : prev);
}, [session]);
```

**Important:** `session` must be added to the `useCallback` dependency array. This is safe — `session` only changes on join and reconnect, not on every render.

**Colyseus timing:** The server broadcasts `player:disconnected` before awaiting `allowReconnection`. The mobile client typically disconnects at the transport layer around the same time (or slightly before) the broadcast arrives. In practice the delta may or may not arrive before the WebSocket closes. The guard is defensive — it prevents a race rather than fixing a guaranteed bug.

---

### Task 4 — Dev Notes: Pre-fill room code on "Rejoin as New Player"

**Current state — `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:22–29`:**
```typescript
interface SessionCodeEntryScreenProps {
  onJoin: (roomId: string, playerName: string) => Promise<void>;
}

export function SessionCodeEntryScreen({ onJoin }: SessionCodeEntryScreenProps) {
  const urlCode = new URLSearchParams(window.location.search).get('session') ?? '';
  const [sessionCode, setSessionCode] = useState(urlCode);
```

**Required change to `SessionCodeEntryScreen.tsx`:**

1. Add `initialCode?: string` to the props interface:
```typescript
interface SessionCodeEntryScreenProps {
  onJoin: (roomId: string, playerName: string) => Promise<void>;
  initialCode?: string;
}
```

2. Destructure it and use it to seed state:
```typescript
export function SessionCodeEntryScreen({ onJoin, initialCode }: SessionCodeEntryScreenProps) {
  const urlCode = new URLSearchParams(window.location.search).get('session') ?? '';
  const [sessionCode, setSessionCode] = useState(initialCode ?? urlCode);
```

Priority: `initialCode` (from Rejoin flow) → `urlCode` (from QR scan URL param) → `''` (manual entry). This preserves existing QR-scan behavior.

**Current state — `apps/mobile-controller/src/App.tsx:87–91` (session-entry render):**
```typescript
if (screen === 'session-entry') {
  return <SessionCodeEntryScreen onJoin={handleJoin} />;
}
```

**Required change to `App.tsx`:** Pass `reconnectRoomId` only when navigating from the give-up flow. The challenge is that `screen === 'session-entry'` is used for both normal entry and post-give-up entry. Use a second state variable to track the pre-fill value:

```typescript
const [sessionEntryInitialCode, setSessionEntryInitialCode] = useState<string | undefined>(undefined);

const handleGiveUp = useCallback(() => {
  clearPersistedSession();
  setSession(null);
  setSessionEntryInitialCode(reconnectRoomId || undefined);
  setScreen('session-entry');
}, [reconnectRoomId]);
```

And update the render:
```typescript
if (screen === 'session-entry') {
  return <SessionCodeEntryScreen initialCode={sessionEntryInitialCode} onJoin={handleJoin} />;
}
```

**Note:** Clear `sessionEntryInitialCode` in `handleGuestContinue` so a later normal-flow navigation doesn't accidentally pre-fill:
```typescript
const handleGuestContinue = useCallback(() => {
  setSessionEntryInitialCode(undefined);
  setScreen('session-entry');
}, []);
```

**Alternatively (simpler but less precise):** Track a `postGiveUpCode` flag instead of a separate state. The approach above with `sessionEntryInitialCode` is cleaner and avoids special-casing.

---

### Task 5 — Dev Notes: Reconnect screen connecting-state color

**Current state — `apps/mobile-controller/src/screens/ReconnectScreen.tsx:56–58`:**
```typescript
background: status === 'error' ? 'var(--corruption-blood)' : 'var(--accent-warm)',
```

Both `idle` ("Connection lost") and `connecting` ("Reconnecting…") show the same `var(--accent-warm)` dot. This gives no visual feedback that a reconnect attempt is in progress.

**Required change:**
```typescript
background:
  status === 'error'
    ? 'var(--corruption-blood)'
    : status === 'connecting'
      ? 'var(--accent-cool)'
      : 'var(--accent-warm)',
```

Color mapping:
- `idle`: `var(--accent-warm)` — warm amber, "connection is lost but not retrying yet"
- `connecting`: `var(--accent-cool)` — cool blue/teal, "actively trying to reconnect"
- `error`: `var(--corruption-blood)` — red, "session expired, cannot reconnect"

`var(--accent-cool)` is defined in the design token system (story 1.1 design system bootstrap). Verify it exists in the shared token CSS file before using it. If the token name differs, check `apps/mobile-controller/src/` CSS for available accent tokens.

---

### Project Structure Notes

- `packages/net-protocol/src/event-names.ts` — enum file; one additive line only
- `packages/net-protocol/src/apply-delta.ts` — pure reducer; no I/O, no Colyseus imports
- `tests/contract/net-protocol.test.ts` — Vitest; `npm test --workspace=tests/contract`
- `apps/mobile-controller/src/App.tsx` — React 18; all hooks follow existing patterns
- `apps/mobile-controller/src/screens/` — inline style-only (no CSS modules or Tailwind in this project)
- `apps/host-client/src/session/host-session.ts` — `EventNames` already imported; no new imports needed
- `apps/simulation-server/src/rooms/GameRoom.ts` — `EventNames` already imported at line 4; no new imports needed

### Project Context Rules

- **Serialization discipline:** Never call `JSON.stringify`/`JSON.parse` directly — use `serialize()`/`deserialize()` wrappers from `net-protocol`. None of these tasks touch serialization, but do not introduce any direct JSON calls.
- **No raw event string literals:** All message routing must use `EventNames` constants. Task 1 enforces this for `HOST_START`. Do not introduce any new raw string message keys.
- **Pure reducer pattern:** `applyDelta` must remain a pure function — no I/O, no side effects. The unknown-player guard in Task 2 preserves this.
- **Authority boundary:** `applyDelta` is in `packages/net-protocol` — it is a shared pure function used by both host and mobile. Do NOT move the self-targeted delta filter logic into `applyDelta` — it must stay in `App.tsx` (mobile-only concern).
- **TypeScript strict mode:** All files have strict mode enabled. No implicit `any`.
- **Touch targets:** Any mobile UI element must meet 44×44px minimum. Tasks 4–5 do not add new UI elements; existing ones already comply.
- **No logger calls inside tick:** Tasks 1–2 do not touch the tick loop. No risk.
- **Package manager:** `npm` only — do not use `pnpm`.

### References

- Deferred items: `_bmad-output/implementation-artifacts/deferred-work.md` (D38, D25, D28, D29, D30)
- EventNames enum: `packages/net-protocol/src/event-names.ts`
- apply-delta: `packages/net-protocol/src/apply-delta.ts`
- Contract tests: `tests/contract/net-protocol.test.ts`
- host-session: `apps/host-client/src/session/host-session.ts:56`
- GameRoom: `apps/simulation-server/src/rooms/GameRoom.ts:72`
- App.tsx (mobile): `apps/mobile-controller/src/App.tsx:27–85`
- ReconnectScreen: `apps/mobile-controller/src/screens/ReconnectScreen.tsx:56–58`
- SessionCodeEntryScreen: `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:22–29`
- Project context: `_bmad-output/project-context.md`
- CLAUDE.md hook policy: `/mnt/c/Workspace/party-delve/CLAUDE.md` (Contract-change hook, Client-UX hook)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Task 5: `--accent-cool` token does not exist in `packages/ui-kit/src/tokens.css` (allowed paths exclude ui-kit). Used `--accent-spirit` (#6ea8d8 — same blue as `--interactive`) as the nearest available cool-colored token. AC5 spirit is satisfied: connecting state is visually distinct from idle warm (#c07d35).

Task 4: TypeScript `exactOptionalPropertyTypes` is enabled — cannot pass `initialCode={undefined}` directly. Used conditional spread `{...(sessionEntryInitialCode !== undefined ? { initialCode: sessionEntryInitialCode } : {})}` to comply with strict typing.

### Completion Notes List

- **Task 1**: Added `EventNames.HOST_START = 'host:start'` to net-protocol enum. Removed raw string literals from host-client and simulation-server. Added `EventNames` to contract test import. Added `EventNames constants` describe block with wire-string pin test. Typecheck clean, 15/15 tests pass.
- **Task 2**: Added early-return guards to `player:moved`, `player:disconnected`, and `player:reconnected` cases in `applyDelta` — returns same `state` reference for unknown `playerId`. Added 3 unknown-player contract tests. Typecheck clean, all tests pass.
- **Task 3**: Updated `handleDelta` in `App.tsx` to skip self-targeted `player:disconnected` and `player:reconnected` deltas. Added `session` to `useCallback` dependency array. Typecheck clean.
- **Task 4**: Added `initialCode?: string` prop to `SessionCodeEntryScreen`; state initializes from `initialCode ?? urlCode`. In `App.tsx`: added `sessionEntryInitialCode` state; `handleGiveUp` sets it to `reconnectRoomId` before navigating; `handleGuestContinue` clears it to `undefined`; render uses conditional spread for strict-typing compliance. Typecheck clean.
- **Task 5**: Changed ReconnectScreen indicator dot background to a 3-way expression: error → `--corruption-blood`, connecting → `--accent-spirit`, idle → `--accent-warm`. `--accent-cool` token does not exist; `--accent-spirit` used instead (same blue as interactive tokens). Typecheck clean.

### File List

- `packages/net-protocol/src/event-names.ts` — added `HOST_START = 'host:start'`
- `packages/net-protocol/src/apply-delta.ts` — added unknown-player early-return guards for `player:moved`, `player:disconnected`, `player:reconnected`
- `apps/host-client/src/session/host-session.ts` — replaced raw `'host:start'` with `EventNames.HOST_START`
- `apps/simulation-server/src/rooms/GameRoom.ts` — replaced raw `'host:start'` with `EventNames.HOST_START`
- `apps/mobile-controller/src/App.tsx` — self-targeted delta filter in `handleDelta`; `sessionEntryInitialCode` state; `handleGiveUp`/`handleGuestContinue` updates; conditional spread on `SessionCodeEntryScreen` render
- `apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx` — added `initialCode?: string` prop; seeds `sessionCode` state from `initialCode ?? urlCode`
- `apps/mobile-controller/src/screens/ReconnectScreen.tsx` — 3-way indicator dot color expression
- `tests/contract/net-protocol.test.ts` — added `EventNames` to import; added `EventNames constants` describe block (1 test); added 3 unknown-player guard tests

## Change Log

- 2026-06-24: Implemented all 5 deferred hardening tasks — EventNames.HOST_START constant, applyDelta unknown-player guard, mobile self-targeted delta filter, room code pre-fill on "Rejoin as New Player", and reconnect screen connecting-state indicator color. All 15 contract tests pass, typecheck clean.

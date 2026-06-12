# Story 2.1: Controller Movement Input

Status: ready-for-dev

---

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP
Context: Phase 1 complete. MoveInputEvent type is fully defined in shared-types. The tick
  loop runs at 20Hz. The mobile controller has a working join flow but the ConnectedScreen
  is a placeholder. The simulation server handles only join events. The host canvas is
  blank. This story wires the first end-to-end gameplay data flow: joystick → server →
  host screen.
Owner agent: Mobile Controller Engineer (primary), Simulation Engineer (server movement),
  Host Experience Engineer (canvas rendering)
Goal: Virtual joystick on mobile sends MoveInputEvent; server moves the player each tick;
  host canvas shows player dots at their positions.
Allowed paths:
  - apps/mobile-controller/**
  - apps/simulation-server/**
  - apps/host-client/**
  - packages/net-protocol/src/event-names.ts (additive constant only)
Blocked paths:
  - packages/shared-types/** (MoveInputEvent and SkillInputEvent are already defined; do not change)
  - packages/net-protocol/src/envelope.ts (no envelope changes needed)
Inputs:
  - packages/shared-types/src/input.ts — MoveInputEvent, SkillInputEvent, Vec2 (read-only)
  - packages/shared-types/src/player.ts — PlayerStateSnapshot (read-only)
  - apps/simulation-server/src/session-store.ts — PlayerSlot, Session (extend)
  - apps/simulation-server/src/tick-loop.ts — TickLoop 20Hz (read-only)
  - apps/simulation-server/src/index.ts — tick callback wiring (extend)
  - apps/mobile-controller/src/hooks/usePlayerSession.ts — join flow + wsRef (extend)
Non-goals:
  - Formal in_run session state gating (joystick appears immediately after join)
  - Skill action processing in the simulation (SkillInputEvent forwarded but sim ignores payload)
  - Player-to-player collision detection
  - Camera or viewport transform (world coords map 1:1 to canvas pixels with fixed offset)
  - Controller HUD (HP bar, cooldown indicators) — FR18 is a separate Phase 2 story
  - Reconnect flow — separate Phase 2 story
  - Network quality classification — separate Phase 2 story
Acceptance criteria: see AC section below
Required hooks: simulation-safety hook, client-UX hook
Required tests: unit test for movement processing (deterministic); joystick vector test
Telemetry impact: new flow "in_run_controller_displayed" must be defined and fired
```

---

## Story

As a player who has joined a session on my phone,
I want to see a virtual joystick and skill buttons on my screen,
so that I can move my character on the host display and see that my input has an effect.

---

## Acceptance Criteria

1. After joining a session the mobile controller shows a virtual joystick and two skill buttons (primary, secondary); the previous "Watch the host screen" placeholder is replaced.
2. Dragging the joystick sends `MoveInputEvent` over the existing WebSocket with a normalised direction vector, a monotonically increasing `sequenceNumber`, and the current client timestamp.
3. Releasing the joystick sends one final `MoveInputEvent` with `direction: { x: 0, y: 0 }` to signal stop.
4. The simulation server receives `MoveInputEvent`, looks up the player slot by the socket that sent it, and records the latest direction vector for that player.
5. Every tick the server applies `position += direction * PLAYER_SPEED * dt` for each player whose direction is non-zero, then emits a `PlayerStateSnapshot` envelope for every player in the session to the host socket.
6. The host client receives `PlayerStateSnapshot` messages and renders a coloured circle for each player at their world position on the canvas. Positions change visibly when a joystick is active.
7. All Phase 1 behaviour is unaffected: room code display, player slot join/leave indicators, telemetry events.
8. `pnpm typecheck` and `pnpm test` pass (including the existing e2e join smoke test).

---

## Tasks / Subtasks

- [ ] **T1 — Extend `PlayerSlot` with position and pending direction** (AC: 4, 5)
  - [ ] In `apps/simulation-server/src/session-store.ts`, add `position: Vec2` and `pendingDirection: Vec2` to the `PlayerSlot` interface
  - [ ] Initialise both to `{ x: 0, y: 0 }` in `addPlayer()`
  - [ ] Import `Vec2` from `shared-types` (already a workspace dep)

- [ ] **T2 — Add `MoveInputEvent` wire-name constant to net-protocol** (AC: 2, 4)
  - [ ] In `packages/net-protocol/src/event-names.ts`, add `MOVE_INPUT_EVENT: 'MoveInputEvent'` and `SKILL_INPUT_EVENT: 'SkillInputEvent'` to `EVENT_NAMES`
  - [ ] These are additive; no existing constant is changed
  - [ ] The `t` field on the wire MUST be the TypeScript type name (see Dev Notes — Wire Format)

- [ ] **T3 — Simulation server: input handler** (AC: 4)
  - [ ] Create `apps/simulation-server/src/handlers/input.ts`
  - [ ] Export `handleMoveInput(socket, payload, store): void`
    - Look up the slot via `store.findSlotBySocket(socket)` (add this lookup to `SessionStore`)
    - If not found: log warn and return
    - Validate `direction` is a finite Vec2 with `x` and `y`; clamp magnitude to 1 (normalise if > 1)
    - Write the validated direction to `slot.pendingDirection`
  - [ ] Do NOT mutate position here — positions are updated only in the tick callback

- [ ] **T4 — Simulation server: movement tick + snapshot broadcast** (AC: 5)
  - [ ] Create `apps/simulation-server/src/game/movement.ts`
  - [ ] Export `applyMovementTick(store: SessionStore, tick: number, tickRateHz: number, broadcast: BroadcastFn): void`
    - `dt = 1 / tickRateHz`
    - `PLAYER_SPEED = 100` (world-units/sec — export as const for tests)
    - For each session in the store, for each player slot:
      - `slot.position.x += slot.pendingDirection.x * PLAYER_SPEED * dt`
      - `slot.position.y += slot.pendingDirection.y * PLAYER_SPEED * dt`
      - Build a `PlayerStateSnapshot` envelope and send it to the session's `hostSocket`
  - [ ] `PlayerStateSnapshot` envelope shape: `{ v: 1, t: 'PlayerStateSnapshot', p: { playerId, tick, position, facing: 0, hp: 100, maxHp: 100, state: 'moving' | 'idle', activeSkillSlot: 'none' } }`
  - [ ] `state` is `'moving'` when direction magnitude > 0, otherwise `'idle'`

- [ ] **T5 — Wire input handler and movement tick into server** (AC: 4, 5)
  - [ ] In `apps/simulation-server/src/server.ts`, add a case for `EVENT_NAMES.MOVE_INPUT_EVENT` (`'MoveInputEvent'`) that calls `handleMoveInput`
  - [ ] In `apps/simulation-server/src/index.ts`, import `applyMovementTick` and call it inside the tick callback, passing `store`, `tick`, `loop.tickRateHz` (expose this getter on `TickLoop`), and a broadcast helper

- [ ] **T6 — Add `SessionStore.findSlotBySocket()`** (AC: 4)
  - [ ] Extend `SessionStore` with a private reverse map `byPlayerSocket` is already there — use `byPlayerSocket.get(socket)` to get `PlayerSlot & { session }`. This is already in the store (see `removeSocket` implementation). Expose a `findSlotBySocket(socket): (PlayerSlot & { session: Session }) | undefined` public method.

- [ ] **T7 — Mobile controller: expose `sendMessage` on `usePlayerSession`** (AC: 2, 3)
  - [ ] In `apps/mobile-controller/src/hooks/usePlayerSession.ts`, add `sendMessage(envelope: object): void` to the return value
  - [ ] Implementation: if `wsRef.current?.readyState === WebSocket.OPEN`, call `ws.send(JSON.stringify(envelope))`
  - [ ] Update the `PlayerSessionState` interface to include `sendMessage`

- [ ] **T8 — Mobile controller: virtual joystick component** (AC: 1, 2, 3)
  - [ ] Create `apps/mobile-controller/src/components/VirtualJoystick.tsx`
  - [ ] Props: `onDirectionChange: (dir: Vec2) => void`, `onRelease: () => void`
  - [ ] Use pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`)
  - [ ] Visual: outer circle 120px diameter (fixed position bottom-left), inner knob 48px, clamped to outer radius
  - [ ] Direction calculation: `{ x: (knobX - centerX) / radius, y: (knobY - centerY) / radius }`, clamp to unit length
  - [ ] Fire `onDirectionChange` on every `pointermove` when active; fire `onRelease` on `pointerup`/`pointercancel`
  - [ ] Call `pointer.setPointerCapture(e.pointerId)` on `pointerdown` for reliable tracking outside the element

- [ ] **T9 — Mobile controller: skill button component** (AC: 1)
  - [ ] Create `apps/mobile-controller/src/components/SkillButton.tsx`
  - [ ] Props: `label: string`, `slot: SkillSlot`, `onPress: (slot: SkillSlot) => void`, `onRelease: (slot: SkillSlot) => void`
  - [ ] Use `onPointerDown` / `onPointerUp`; large touch target (80px × 80px minimum)
  - [ ] High-contrast styling; no tooltip or text during gameplay (icon/letter only)

- [ ] **T10 — Mobile controller: InRunController screen** (AC: 1, 2, 3)
  - [ ] Create `apps/mobile-controller/src/screens/InRunController.tsx`
  - [ ] Props: `playerId: string`, `sessionId: string`, `sendMessage: (e: object) => void`
  - [ ] Maintain `seqRef = useRef(0)` — increment before each send
  - [ ] On joystick direction change: send `{ v: 1, t: 'MoveInputEvent', p: { playerId, sequenceNumber: ++seqRef.current, direction: dir, timestamp: Date.now() } }`
  - [ ] On joystick release: send zero-vector stop event
  - [ ] On skill press/release: send `{ v: 1, t: 'SkillInputEvent', p: { playerId, sequenceNumber: ++seqRef.current, skillSlot, phase: 'start'|'release', timestamp: Date.now() } }`
  - [ ] Layout: VirtualJoystick bottom-left, SkillButton (primary) bottom-right, SkillButton (secondary) above primary; portrait layout
  - [ ] Small status bar at top: player ID short (8 chars) and session ID short — carry over from ConnectedScreen

- [ ] **T11 — Mobile controller: route to InRunController** (AC: 1)
  - [ ] In `apps/mobile-controller/src/App.tsx`, replace `<ConnectedScreen ...>` with `<InRunController playerId={...} sessionId={...} sendMessage={session.sendMessage} />`
  - [ ] `ConnectedScreen.tsx` can be deleted (it is replaced entirely)

- [ ] **T12 — Host client: track player positions from PlayerStateSnapshot** (AC: 6)
  - [ ] In `apps/host-client/src/hooks/useHostSession.ts`, add a `playerPositions: Record<string, Vec2>` field to `HostSessionState`
  - [ ] In the `onmessage` handler, add a branch for `msg.t === 'PlayerStateSnapshot'`: update `playerPositions[payload.playerId] = payload.position`
  - [ ] Import `PlayerStateSnapshot` from `shared-types`

- [ ] **T13 — Host client: render player dots on canvas** (AC: 6)
  - [ ] In `apps/host-client/src/App.tsx`, use `useEffect` / `requestAnimationFrame` to redraw the canvas whenever `playerPositions` changes
  - [ ] Coordinate transform: world origin maps to canvas center (400, 150); scale 1:1
  - [ ] Draw each player as a filled circle (radius 12px) with a player-slot colour (`['#4af', '#f84', '#4f4', '#f4f']` for P1–P4)
  - [ ] Draw player ID label (first 4 chars) above each dot
  - [ ] Clear the canvas with `#111` fill before each frame

- [ ] **T14 — Telemetry: define and fire in_run_controller_displayed event** (AC: none — CLAUDE.md telemetry hook)
  - [ ] In `InRunController.tsx`, fire `track({ event: 'in_run_controller_displayed', ... })` in a `useEffect` with empty deps (fires once on mount)
  - [ ] Fields: `event`, `timestamp`, `session_id`, `build_version: '0.1.0'`, `mode: 'local'`, `region: null`, `platform: 'mobile'`, `player_id`

- [ ] **T15 — Tests** (AC: 8)
  - [ ] Unit test `applyMovementTick`: given one player with direction `{x: 1, y: 0}`, after one tick at 20Hz, position must be `{x: 5, y: 0}` (100 units/sec ÷ 20 ticks/sec = 5 units/tick)
  - [ ] Unit test `applyMovementTick`: direction `{x: 0, y: 0}` → position unchanged
  - [ ] Unit test normalisation in `handleMoveInput`: direction `{x: 3, y: 4}` → stored direction has magnitude ≤ 1
  - [ ] Ensure existing `tests/e2e-join.test.ts` still passes

---

## Dev Notes

### Wire Format — Critical

The networking-spec mandates that the `t` field in every envelope matches the **TypeScript type name**, not the lowercase event category name. Input events must be sent as:

```json
{ "v": 1, "t": "MoveInputEvent", "p": { "playerId": "...", "sequenceNumber": 1, "direction": { "x": 0.7, "y": 0.7 }, "timestamp": 1749600000000 } }
{ "v": 1, "t": "SkillInputEvent", "p": { "playerId": "...", "sequenceNumber": 2, "skillSlot": "primary", "phase": "start", "timestamp": 1749600000001 } }
```

`EVENT_NAMES.MOVE = 'move'` is the **category name** from the spec — do **NOT** use it as the wire `t` value. Use the new constants `EVENT_NAMES.MOVE_INPUT_EVENT = 'MoveInputEvent'` (T2). The server switch statement must match on `'MoveInputEvent'`.

[Source: docs/specs/networking-spec.md § Message envelope]

### Existing WebSocket in usePlayerSession

`usePlayerSession` already manages the WebSocket, stores it in `wsRef`, and handles `onmessage` for session events. Do not create a second WebSocket. Expose a `sendMessage` method on the return object that writes to `wsRef.current` (T7). The joystick in `InRunController` calls this method.

[Source: apps/mobile-controller/src/hooks/usePlayerSession.ts]

### SessionStore — byPlayerSocket already exists

`SessionStore` already has a private `byPlayerSocket: Map<WebSocket, PlayerSlot & { session: Session }>`. The `removeSocket` method reads from it. T6 simply adds a public `findSlotBySocket` getter that wraps the same map. Do not create a parallel data structure.

[Source: apps/simulation-server/src/session-store.ts:20, :63]

### Tick loop runs at startup, not gated on in_run

The 20Hz `TickLoop` starts on server boot (not when the session transitions to `in_run`). `applyMovementTick` is safe to call before any players join because iterating an empty session store is a no-op. Session state gating (only move during `in_run`) is explicitly a non-goal of this story.

[Source: apps/simulation-server/src/index.ts:11]

### PlayerStateSnapshot broadcast: host only for now

The spec says `PlayerStateSnapshot` goes to host (full broadcast) and to the mobile controller's own self-state. For this story, only broadcast to `session.hostSocket` (simplifies the tick loop and avoids self-state delivery logic). Self-state delivery to mobile is a Phase 2 follow-up (FR18 controller HUD).

[Source: docs/specs/networking-spec.md § PlayerStateSnapshot]

### Do not import from session-store in movement.ts via circular reference

`applyMovementTick` takes `store: SessionStore` as a parameter — it does not import `SessionStore` for construction. It also needs to enumerate all sessions. Add a `allSessions(): Session[]` or `forEachSession(cb)` method to `SessionStore` (iterate `byRoomCode.values()`).

### Canvas coordinate transform

The host canvas is `800 × 300`. World origin `{0, 0}` maps to canvas centre `(400, 150)`. Players spawn at `{0, 0}` so they start at centre. Scale is 1:1 (1 world unit = 1 px). At `PLAYER_SPEED = 100`, a player moving at full joystick travels 100 px/sec — visually clear. If players drift off the canvas edge, wrap or clamp coordinates in a follow-up story.

### Pointer events over touch events

Use the Pointer Events API (`onPointerDown`, `onPointerMove`, `onPointerUp`) with `setPointerCapture` for the joystick. This works for both mouse (dev testing in browser) and touch (phone). Do not use `ontouchstart` / `ontouchmove` — those are not cancelable in the same way and have passive listener limitations in React.

### sequenceNumber is per-player, shared between Move and Skill events

The spec says Move and Skill inputs share the same sequence space per player. Use a single `seqRef` in `InRunController` incremented before every send (both move and skill).

[Source: docs/specs/networking-spec.md § SkillInputEvent — sequenceNumber description]

### ConnectedScreen deletion

`ConnectedScreen.tsx` is replaced entirely by `InRunController.tsx`. No other file imports `ConnectedScreen`. Confirm with `grep -r ConnectedScreen apps/` before deleting.

### Project Structure Notes

```
apps/simulation-server/src/
  handlers/
    join.ts        ← existing
    input.ts       ← NEW (T3)
  game/
    movement.ts    ← NEW (T4)
  session-store.ts ← EXTEND (T1, T6)
  server.ts        ← EXTEND (T5)
  index.ts         ← EXTEND (T5)

apps/mobile-controller/src/
  components/
    VirtualJoystick.tsx  ← NEW (T8)
    SkillButton.tsx      ← NEW (T9)
  screens/
    InRunController.tsx  ← NEW (T10)
    ConnectedScreen.tsx  ← DELETE (T11)
    JoinScreen.tsx       ← no change
  hooks/
    usePlayerSession.ts  ← EXTEND (T7)
  App.tsx                ← EXTEND (T11)

apps/host-client/src/
  hooks/
    useHostSession.ts    ← EXTEND (T12)
  App.tsx                ← EXTEND (T13)

packages/net-protocol/src/
  event-names.ts         ← EXTEND additive (T2)
```

### Hooks triggered by this story

**Simulation-safety hook** (touches `apps/simulation-server/**`):
- Typecheck must pass
- Unit tests for `applyMovementTick` must pass (deterministic tick test — T15)
- No replay test required in Phase 2

**Client-UX hook** (touches host and mobile UI):
- Joystick direction vector correctly normalised
- Skill button touch targets ≥ 80px × 80px
- Portrait layout confirmed
- Reconnect UX not yet built — not a regression (out of scope)

**Telemetry hook** (new user flow):
- Event: `in_run_controller_displayed`
- Trigger: `InRunController` mounts
- Payload: `{ session_id, player_id, timestamp, mode, build_version, platform, region }`
- Success path: event fires once per in-run controller mount
- Failure path: (none — fire-and-forget)
- KPI mapping: funnel step after `join_attempt_succeeded`

### References

- [Source: docs/specs/networking-spec.md § First Event Contract — MoveInputEvent]
- [Source: docs/specs/networking-spec.md § First Event Contract — SkillInputEvent]
- [Source: docs/specs/networking-spec.md § First Event Contract — PlayerStateSnapshot]
- [Source: docs/specs/networking-spec.md § Message envelope]
- [Source: docs/specs/controller-ux-spec.md § Required Inputs]
- [Source: docs/specs/controller-ux-spec.md § Accessibility Goals]
- [Source: packages/shared-types/src/input.ts — MoveInputEvent, SkillInputEvent, Vec2]
- [Source: packages/shared-types/src/player.ts — PlayerStateSnapshot, PlayerState, CharacterState]
- [Source: apps/simulation-server/src/session-store.ts — PlayerSlot, SessionStore, byPlayerSocket]
- [Source: apps/simulation-server/src/tick-loop.ts — TickLoop at 20Hz]
- [Source: apps/simulation-server/src/index.ts — tick callback wiring]
- [Source: apps/mobile-controller/src/hooks/usePlayerSession.ts — wsRef, sendJoin]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-06-11.md § FR17]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

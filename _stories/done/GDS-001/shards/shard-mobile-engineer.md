---
shard_id: shard-mobile-engineer
parent_id: GDS-001
owner: mobile-engineer
allowed_paths:
  - apps/mobile-controller/**
  - packages/ui-kit/**
blocked_paths:
  - apps/simulation-server/**
  - apps/host-client/**
  - apps/backend-platform/**
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**
  - packages/telemetry/**
  - tests/**
  - tools/**
status: complete
confidence: 90
depends_on:
  - shard-protocol-architect
---

# Shard: mobile-engineer — Hub world — player movement on shared map

> This is an agent-specific shard of story GDS-001.
> You are the **mobile-engineer** agent. Work only within your allowed paths.
> When complete, append a Phase Log entry to `_stories/active/GDS-001/story.md`.
> **Prerequisite:** shard-protocol-architect must be complete. `MoveInputEvent` is defined in `packages/shared-types`. `MOVE_INPUT_EVENT` constant is in `packages/net-protocol/src/event-names.ts`.

## Context

This story introduces the first gameplay layer of Party Delve: the Hub. Players use an analog joystick on their phone to control their character on the shared host screen.

Phase 1 gave us: mobile controller shows a join form and transitions to a connected screen on successful join. No input controls exist yet. The `usePlayerSession` hook manages the WebSocket and join flow.

This shard adds a virtual joystick to the connected screen and wires it to send `MoveInputEvent` messages over the existing WebSocket. The mobile UI must stay minimal — players watch the host screen, not their phones. Joystick only — no skill buttons in this story.

## Your Tasks

1. **Expose `sendMessage` on `usePlayerSession`** in `apps/mobile-controller/src/hooks/usePlayerSession.ts`:
   - Add `sendMessage(envelope: object): void` to the hook's return value
   - Implementation: if `wsRef.current?.readyState === WebSocket.OPEN`, call `ws.send(JSON.stringify(envelope))`
   - Do NOT create a second WebSocket — reuse the existing `wsRef`

2. **Create `VirtualJoystick` component** — `apps/mobile-controller/src/components/VirtualJoystick.tsx`:
   - Props: `onDirectionChange: (dir: { dx: number; dy: number }) => void`, `onRelease: () => void`
   - Use Pointer Events API: `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`
   - Call `e.currentTarget.setPointerCapture(e.pointerId)` on `pointerdown` for reliable off-element tracking
   - Visual: outer circle 140px diameter (fixed position, bottom-left of screen), inner knob 52px, knob clamped to outer radius
   - Direction calculation: `{ dx: (knobX - centerX) / radius, dy: (knobY - centerY) / radius }`, clamp to unit length (magnitude ≤ 1)
   - Fire `onDirectionChange` on every `pointermove` when active
   - Fire `onRelease` on `pointerup` and `pointercancel` (reset knob to center)

3. **Create `InHubController` screen** — `apps/mobile-controller/src/screens/InHubController.tsx`:
   - Props: `playerId: string`, `sessionId: string`, `sendMessage: (e: object) => void`
   - Maintain `seqRef = useRef(0)` — increment before each send (monotonically increasing across all sends)
   - On joystick direction change: send `{ v: 1, t: 'MoveInputEvent', p: { playerId, direction: { dx, dy }, sequenceNumber: ++seqRef.current, timestamp: Date.now() } }`
   - On joystick release: send zero-vector stop event `{ v: 1, t: 'MoveInputEvent', p: { playerId, direction: { dx: 0, dy: 0 }, sequenceNumber: ++seqRef.current, timestamp: Date.now() } }`
   - Layout: `VirtualJoystick` bottom-left, rest of screen minimal/empty — players watch the host
   - Small status bar at top showing session ID (first 8 chars) and player ID (first 8 chars)

4. **Route to `InHubController` after join** in `apps/mobile-controller/src/App.tsx`:
   - After a successful join, render `<InHubController playerId={...} sessionId={...} sendMessage={session.sendMessage} />` instead of the current connected screen
   - The existing `ConnectedScreen.tsx` placeholder can remain or be replaced — confirm with `grep -r ConnectedScreen apps/mobile-controller/` before removing

5. **Run `pnpm typecheck`** to confirm no TypeScript errors.

## Acceptance Criteria

- [ ] The mobile controller displays a virtual joystick after joining; dragging it sends `MoveInputEvent` with a normalized direction vector on every pointer move event
- [ ] Releasing the joystick sends a final `MoveInputEvent` with `direction: { dx: 0, dy: 0 }` to signal stop
- [ ] All Phase 1 behavior is unaffected: join flow, room code entry, existing telemetry funnel events
- [ ] `pnpm typecheck` passes

## Non-Goals

- This shard does NOT implement skill buttons (separate story)
- This shard does NOT implement reconnect UX
- This shard does NOT implement a controller HUD (HP bar, cooldowns)
- This shard does NOT implement QR code scanning (separate Phase 2 story)

## Edge Cases

- **Joystick over-magnitude:** Clamp direction magnitude to 1 in the component — never send a vector with magnitude > 1
- **Rapid pointer events:** Send on every `pointermove` while active; the simulation server normalizes and clamps at its end too
- **WebSocket not open:** `sendMessage` must no-op silently if the socket is not in OPEN state — do not throw
- **pointercancel (e.g. phone sleep / notification):** Treat as joystick release — send zero-vector stop event and reset knob to center

## Telemetry

No telemetry instrumentation in this shard. The `input.move` event will be added by the telemetry-agent shard after QA passes.

## Phase Log

_Empty — append your entry here when complete._

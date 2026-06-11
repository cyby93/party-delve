# Networking Specification

## Purpose

Define the networking model, event contract direction, tick model, reconnect expectations, and local vs remote behavior for the project.

## Core Model

- The simulation is authoritative.
- Clients submit input events, not world-state mutations.
- The same simulation core must run in both local and remote modes.
- Deployment and transport may differ by mode; gameplay rules may not.

## Modes

### Local Party Mode

- Authority runs on the host machine.
- Phones connect over local network.
- Cloud is optional for metadata, accounts, telemetry, and end-of-run sync.
- Target priority: minimal perceived input latency and easy couch setup.

### Online / Remote Mode

- Authority runs in a cloud region.
- Clients connect over the internet.
- Client-side prediction is used for player-owned movement.
- Reconciliation corrects authoritative divergence.
- Interpolation is used for remote entities.

## Event Categories

### Session Events
- `join`
- `leave`
- `reconnect`
- `ready`
- `session-start`
- `session-end`

### Input Events
- `move`
- `aim`
- `cast-start`
- `cast-release`
- `interact`
- `pause-request`

### Simulation Events
- `spawned`
- `damaged`
- `healed`
- `died`
- `revived`
- `loot-dropped`
- `cooldown-started`
- `cooldown-ended`

### UI Events
- `menu-opened`
- `selection-locked`
- `countdown-started`
- `reconnect-state-changed`

### Meta Events
- `run-complete`
- `stats-upload`
- `unlock-granted`

## State Domains

Track these state domains separately:
- session state
- player state
- character combat state
- world state
- run progression state
- network quality state

## Tick Model

Initial goals:
- fixed simulation tick
- deterministic or mostly deterministic game rules where practical
- sequence-numbered input processing
- timestamped input queueing

The exact tick rate may be refined after latency benchmarking.

## Reconnect Model

Reconnect must preserve session usability in both local and remote modes.

Requirements:
- reconnect token support
- player slot persistence during short disconnects
- clear reconnect state on host and mobile UI
- safe resume after mobile browser sleep/background

## Compatibility Rules

- Input payloads must be versioned or explicitly change-managed.
- Shared event contracts live in `packages/shared-types/` and `packages/net-protocol/`.
- Contract changes require review and at least one contract test.

## First Event Contract

These are the four minimum required events for Phase 0. Each entry specifies the canonical event name, traffic direction (consistent with ADR-0001 authority rules), the condition that triggers it, and all key fields.

---

### MoveInputEvent

| Field     | Value                                         |
|-----------|-----------------------------------------------|
| Name      | `MoveInputEvent`                              |
| Direction | mobile-controller → simulation-server         |
| Trigger   | Player moves the virtual joystick on their phone; fired each tick a non-zero movement vector is active, and once when the vector returns to zero |

**Key Fields**

| Field          | Type            | Required | Description |
|----------------|-----------------|----------|-------------|
| playerId       | string          | yes      | Stable identifier for the player within this session |
| sequenceNumber | number (uint32) | yes      | Monotonically increasing counter per player; used for input ordering and reconciliation |
| direction      | `{ x: number, y: number }` | yes | Normalised 2-D movement vector; `{x:0, y:0}` signals stop |
| timestamp      | number (ms)     | yes      | Client-local millisecond timestamp at the moment of input capture |

---

### SkillInputEvent

| Field     | Value                                         |
|-----------|-----------------------------------------------|
| Name      | `SkillInputEvent`                             |
| Direction | mobile-controller → simulation-server         |
| Trigger   | Player presses or releases a skill button (primary, secondary, or ultimate) on their phone |

**Key Fields**

| Field          | Type                                          | Required | Description |
|----------------|-----------------------------------------------|----------|-------------|
| playerId       | string                                        | yes      | Stable identifier for the player within this session |
| sequenceNumber | number (uint32)                               | yes      | Monotonically increasing counter per player; same sequence space as MoveInputEvent |
| skillSlot      | enum: `primary` \| `secondary` \| `ultimate`  | yes      | Which skill slot was activated |
| phase          | enum: `start` \| `release`                    | yes      | `start` on button-down; `release` on button-up (supports hold-cast skills) |
| timestamp      | number (ms)                                   | yes      | Client-local millisecond timestamp at the moment of input capture |

---

### PlayerStateSnapshot

| Field     | Value                                                               |
|-----------|---------------------------------------------------------------------|
| Name      | `PlayerStateSnapshot`                                               |
| Direction | simulation-server → host-client (full broadcast); simulation-server → mobile-controller (self-state only) |
| Trigger   | Emitted by the simulation server each authoritative tick for every player whose state changed during that tick |

**Key Fields**

| Field      | Type                                                                       | Required | Description |
|------------|----------------------------------------------------------------------------|----------|-------------|
| playerId   | string                                                                     | yes      | Stable identifier for the player being described |
| tick       | number (uint64)                                                            | yes      | Authoritative simulation tick number this snapshot was produced on |
| position   | `{ x: number, y: number }`                                                 | yes      | World-space position of the player at the end of this tick |
| facing     | number (radians)                                                           | yes      | Heading direction in radians, measured from the positive X axis |
| hp         | number (int)                                                               | yes      | Current hit points |
| maxHp      | number (int)                                                               | yes      | Maximum hit points (may change due to buffs/debuffs) |
| state      | enum: `idle` \| `moving` \| `casting` \| `dead` \| `reviving`              | yes      | High-level character state used for animation and input gating |
| activeSkillSlot | enum: `primary` \| `secondary` \| `ultimate` \| `none`              | no       | Skill currently being cast; present only when `state` is `casting` |

---

### SessionStateEvent

| Field     | Value                                                                                   |
|-----------|-----------------------------------------------------------------------------------------|
| Name      | `SessionStateEvent`                                                                     |
| Direction | simulation-server → all connected clients (host-client and all mobile-controllers)      |
| Trigger   | Any change to session lifecycle: a session starts or ends, or a player joins, leaves, or reconnects |

**Key Fields**

| Field            | Type                                                                                              | Required | Description |
|------------------|---------------------------------------------------------------------------------------------------|----------|-------------|
| sessionId        | string                                                                                            | yes      | Globally unique identifier for this session |
| event            | enum: `session-start` \| `session-end` \| `player-joined` \| `player-left` \| `player-reconnected` | yes    | The specific lifecycle transition that occurred |
| tick             | number (uint64)                                                                                   | yes      | Authoritative simulation tick at the moment the transition was recorded |
| affectedPlayerId | string                                                                                            | no       | Present when `event` is `player-joined`, `player-left`, or `player-reconnected`; identifies the player involved |

---

> These schemas are the normative source of truth until TypeScript interfaces are added to `packages/shared-types/` (Phase 1, task P1-1).
>
> Contract-change hook: any modification to these schemas requires Protocol Architect review, a compatibility note, and at least one contract test update.

## Session Lifecycle State Machine

The simulation server owns session state. State transitions are triggered by explicit events from clients; the server never auto-advances state on a timer except for the reconnect grace window.

### States

| State | Description |
|---|---|
| `idle` | No session exists. Server is ready to accept a host connection. |
| `creating` | Host has sent a join request with `role: host`. Server is allocating a session ID and slot map. |
| `waiting_for_players` | Session is live. Host screen shows the room code / QR code. Waiting for mobile controllers to join. Run has not started. |
| `in_run` | All required players are ready and the countdown has completed. The dungeon run is active; the tick loop is processing input. |
| `ended` | Run is over (win, loss, or abandon) or the host disconnected without recovery. Post-run stats are available. Session will be torn down. |

### Transitions

```
idle
  │  host sends join { role: "host" }
  ▼
creating
  │  server confirms session created
  │  emits SessionStateEvent { event: "session-start" }
  ▼
waiting_for_players  ◄──────────────────────────────────────────────────────────────────┐
  │  mobile sends join { role: "player", roomCode }                                     │
  │  server emits SessionStateEvent { event: "player-joined", affectedPlayerId }        │
  │  (repeats for each player; up to 4 slots)                                           │
  │                                                                                     │
  │  host sends ready signal (all players ready, countdown complete)                    │
  ▼                                                                                     │
in_run                                                                                  │
  │  player disconnects (short window)                                                  │
  │  server emits SessionStateEvent { event: "player-left" }                            │
  │  player reconnects within grace window                                              │
  │  server emits SessionStateEvent { event: "player-reconnected" }          ───────────┘ (stays in_run)
  │
  │  run-complete condition OR host disconnects without recovery
  ▼
ended
  │  server tears down session after post-run window
  ▼
(session destroyed — server returns to idle for the slot)
```

### Notes

- The host client cannot move the session from `waiting_for_players` to `in_run` until at least one mobile controller is in the `player-joined` state.
- If the host disconnects in `waiting_for_players`, the session moves directly to `ended` with no grace window.
- If the host disconnects in `in_run`, the session pauses for the reconnect grace window (see Reconnect Token Lifecycle). If the host does not reconnect, the session moves to `ended`.
- `ended` is terminal. To start a new run, a new session must be created from `idle`.

---

## Serialization Format

### Wire encoding

**Phase 1: JSON over WebSocket text frames.**

JSON is chosen for Phase 1 because it is human-readable, requires no build tooling, and is sufficient for loopback and LAN latency targets. Binary encoding (MessagePack or a length-prefixed schema like protobuf) may be adopted in Phase 5 if profiling shows serialization overhead is a meaningful contributor to RTT. Any such change is a contract-change and requires a new ADR.

### Message envelope

Every WebSocket message — in both directions — is a JSON object with this top-level shape:

```json
{
  "v": 1,
  "t": "MoveInputEvent",
  "p": { }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `v` | integer | yes | Protocol version. Starts at `1`. Increment only on breaking changes to the envelope structure itself (not payload changes). |
| `t` | string | yes | Event type name. Must match the TypeScript type name exported from `packages/shared-types` (e.g. `"MoveInputEvent"`, `"SessionStateEvent"`). |
| `p` | object | yes | Payload. Shape is defined by the event type named in `t`. See First Event Contract section. |

### Versioning strategy

- Payload fields may be added (additive) without incrementing `v`.
- Removing or renaming a field is a breaking change and requires a contract-change review.
- Receivers must ignore unknown fields in `p` to allow forward compatibility.
- If `v` is not recognised by the receiver, the connection must be closed with a `4000 protocol-version-mismatch` WebSocket close code.

### Transport

WebSocket over `ws://` for Phase 1 (localhost and LAN). `wss://` (TLS) is required for Phase 5 (Online Mode). The server must listen on a configurable port (default `8080`).

---

## Reconnect Token Lifecycle

### Purpose

A reconnect token allows a mobile controller to re-attach to its player slot after a WebSocket disconnect without losing session state (position, HP, skill cooldowns). This covers the common case of a phone locking its screen or the browser being backgrounded briefly.

### Issuance

- The simulation server issues a reconnect token when a mobile controller successfully completes the join handshake.
- The token is a cryptographically random opaque string (UUID v4 is acceptable for Phase 1; a signed token may be used in Phase 5 for cloud sessions).
- The token is delivered to the mobile client in the `p` payload of the `SessionStateEvent { event: "player-joined" }` message addressed to that player:

```json
{
  "v": 1,
  "t": "SessionStateEvent",
  "p": {
    "sessionId": "...",
    "event": "player-joined",
    "tick": 0,
    "affectedPlayerId": "...",
    "reconnectToken": "..."
  }
}
```

`reconnectToken` is only present on the `player-joined` event directed at the joining player. It is never broadcast to other clients.

### Token validity

| Parameter | Value | Notes |
|---|---|---|
| TTL | 30 seconds | Covers typical mobile browser background/sleep. Chosen to balance UX against orphaned slot risk. |
| Scope | Single player slot in a single session | A token issued for player slot 2 in session A cannot be used to rejoin session B or slot 3. |
| Single-use | No | The same token may be used to reconnect multiple times within its TTL (e.g. rapid disconnect/reconnect cycles). |

### Client responsibilities

- The mobile controller must store the token in memory (not `localStorage`) for the duration of the session.
- On WebSocket disconnect, the mobile controller must attempt reconnect immediately and present the token.
- The mobile controller must not attempt reconnect after the token TTL has elapsed; instead it must show a "session expired" UI and offer to return to the join screen.

### Reconnect flow

```
mobile: WebSocket closes (any reason)
mobile: waits 500ms back-off, opens new WebSocket to server
mobile: sends { "v":1, "t":"reconnect", "p": { "sessionId":"...", "reconnectToken":"..." } }
server: validates token (exists, not expired, session still in_run or waiting_for_players)
  → valid:   server re-attaches socket to player slot
             server emits SessionStateEvent { event: "player-reconnected", affectedPlayerId }
             server sends current PlayerStateSnapshot for the player
  → invalid: server closes connection with close code 4001 reconnect-token-invalid
             mobile shows "session expired" UI
```

### Server responsibilities

- Tokens must be stored in memory keyed by `(sessionId, playerId)`.
- When a session moves to `ended`, all tokens for that session must be invalidated immediately.
- The server must not allow two simultaneous active connections for the same player slot. If a reconnect arrives while the original socket is still open, close the original socket first.

---

## Network Quality Thresholds

These thresholds define how network quality state is classified and what actions the system takes at each level. They apply to **local mode** in Phase 1. Remote/online mode may require different thresholds and is out of scope until Phase 5.

### Classification

The quality classification is based on the rolling p95 RTT computed over the last 20 `input_rtt_sampled` measurements (approximately the last 20 seconds at normal joystick activity). See `docs/specs/latency-baseline.md` for how RTT is measured.

| Quality level | p95 RTT | Action |
|---|---|---|
| `good` | < 50 ms | No action. Normal operation. |
| `degraded` | 50–150 ms | Host HUD may show a per-player latency indicator. No gameplay change. |
| `poor` | > 150 ms | Host HUD shows a visible warning for the affected player. If sustained for 5 consecutive seconds, the simulation server emits `SessionStateEvent` with a `networkQuality` field (Phase 2+). |

### State change rules

- Classification must be computed on the **simulation server** using RTT samples reported by mobile controllers via `input_rtt_sampled` telemetry.
- A transition to a worse quality level is immediate (single sample exceeds threshold).
- A transition back to a better quality level requires 5 consecutive samples below the threshold (hysteresis prevents flapping).
- Quality state is part of the `network quality state` domain tracked in the State Domains section.

### Prediction activation threshold (Phase 5 planning note)

Client-side prediction is not implemented in Phase 1 or Phase 2. When Phase 5 (Online Mode) is scoped, prediction should be considered when the **sustained** p95 RTT exceeds **100 ms** for 3 or more consecutive seconds. Below that threshold on a local network, the added complexity of prediction and reconciliation is not justified. This value is a planning anchor, not a committed gate; Phase 5 will define the final activation policy.

---

## Out of Scope

This spec does not lock down final binary serialization, transport library, or final hosting vendor. Those may evolve as long as the authority and contract rules stay intact.

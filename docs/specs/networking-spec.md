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

## Out of Scope

This spec does not lock down final binary serialization, transport library, or final hosting vendor. Those may evolve as long as the authority and contract rules stay intact.

# HUB and Run Flow Spec

## Purpose

This document defines the gameplay flow between the HUB and RUN states for the couch co-op dungeon crawler. It is intended to guide implementation, prototyping, and future design iterations. The spec focuses on session lifecycle, player interactions, UI layering, and state ownership. The HUB and run flow is a core design item in the gameplay todo, and it also connects to onboarding, session start, and UI clarity requirements [file:1][file:2].

## Scope

This spec covers:
- Host-side session flow.
- Controller-side access and readiness flow.
- HUB preparation flow.
- Run selection, locking, loading, and active run flow.
- Reward and return-to-HUB flow.
- Blocking error states and late-join behavior.

This spec does not define combat details, enemy behaviors, or progression tuning in depth. Those belong to other design docs in the gameplay todo and project plan [file:1][file:2].

## Core Principles

- The HUB is a playable lobby space, not just a menu.
- The RUN is a separate session/state with minimal dependency on the HUB.
- State changes may be represented by overlays rather than full screen transitions.
- The host screen is the shared focus point; controller clients provide input and minimal personal feedback.
- Controller clients should avoid showing unnecessary world information so players keep attention on the host display [file:2].

## Terminology

- **Host client**: The shared display client shown on the TV/monitor.
- **Controller client**: The mobile client used by a player as input and minimal personal HUD.
- **Session authority**: The authoritative gameplay instance that controls state changes.
- **HUB**: The preparation and social space where players join, customize, and ready up.
- **RUN**: The gameplay session started from the HUB, spanning one or more levels until victory or defeat.
- **Overlay state**: A UI layer that sits on top of an existing core state without replacing the world.
- **Blocking state**: A state that prevents normal interaction until resolved.

## State Model

The flow should be implemented with two layers:

1. **Core session state**.
2. **UI overlay state**.

Core session states:
- `HOST_MAIN_MENU`
- `SESSION_STARTING`
- `HUB_SESSION_ACTIVE`
- `RUN_SELECTION_PENDING`
- `RUN_LOCKED`
- `LOADING`
- `RUN_ACTIVE`
- `REWARD_SCREEN`
- `HOST_CONNECTION_LOST_OVERLAY`

UI overlay states:
- Ready indicator.
- Join/leave notifications.
- Run vote / pending selection prompt.
- Countdown before run start.
- Player status panels.
- Full-screen connection lost error.

This split is important because some states change gameplay rules, while others only change presentation. The project plan already distinguishes session state, player state, world state, run progression state, and network quality state [file:2].

## Host Flow

### Host main menu
The host starts here. The available actions are:
- Start local session.
- Start remote session.
- Return to account/login flow if needed.
- Quit.

### Session starting
After session creation, the system generates or fetches:
- Session ID.
- Join code and/or QR code.
- Session metadata.

The host then transitions into the HUB session.

### HUB session active
The host renders the shared world and overlay systems. In this state:
- Players can join.
- Players can move freely in the HUB.
- Players can use prep tools such as class selection, skin changes, training dummy, and shop systems.
- Team-level and player-level progression can be shown.
- Ready status and join/leave changes are visible through overlays [file:2].

### Run selection pending
A player proposes a run or level choice. The host displays this as a pending overlay. During this state:
- The team reviews the proposed run.
- The proposal is not yet locked.
- Players can still adjust class or cosmetic choices if allowed by design.

### Run locked
The run choice is finalized. The host shows a locked state and typically a countdown or start confirmation. During this state:
- No further run selection changes are allowed.
- Late changes should be limited to cancel/leave rules if the design allows them.
- The system prepares the transition to loading.

### Loading
The host shows a loading transition if required. During this state:
- Required assets load.
- Run session setup is finalized.
- The host waits until all required players are ready.

### Run active
The run begins and stays active across multiple levels until:
- All players are defeated, or
- The boss is defeated / run is successfully completed.

Within the run:
- Temporary buffs stay within the run.
- Temporary weapons/items stay within the run.
- Temporary debuffs stay within the run.
- The HUB should not be treated as part of the run state.

### Reward screen
When the run ends, the host shows the reward screen. This state:
- Displays completion results.
- Grants or previews rewards.
- Confirms defeat or victory.

### Return to HUB
After rewards are resolved, the system returns everyone to the HUB session.

### Connection lost overlay
If the host loses connection to the server, all gameplay must stop. The host shows a full-screen blocking overlay. This is not a normal HUB state; it is an error state that sits on top of the current flow.

## Controller Flow

### Authentication gate
The controller client begins with:
- Register/login.
- Guest login if allowed.
- Account selection or auth confirmation.

### Join session
The player joins by:
- QR code scan, or
- Entering the provided URL/code.

The controller then enters the session and binds the player to a slot.

### HUB controller view
In the HUB, the controller should support:
- Class selection.
- Skin selection.
- Account progression visibility.
- Party progression visibility.
- Ready/unready toggle if allowed.
- Minimal interaction with shops or prep tools if design allows it.

### Run controller view
When the run begins, the controller switches to run input mode. In this mode:
- Movement and skill input are available.
- Only essential personal HUD is shown.
- The player should not need to read the phone constantly.

### Waiting for run end
If a player joins late while the party is already in a run, the controller should show a waiting view:
- “Waiting for run to end.”
- No active gameplay control until the party returns to the HUB.

### Results sync
After reward resolution, the controller returns to HUB mode automatically.

## Player-Initiated Actions

Allowed initiations:
- Any player may propose a run or map.
- All players must accept for the run to start.
- Character selection happens on each player’s own controller.
- Pause, rematch, and leave can be initiated from controllers.
- Reconnect should be automatic.
- If reconnect happens, control may temporarily be handled by a simple bot until the player returns.

## HUB Responsibilities

The HUB is a preparation and social layer with gameplay relevance. It should support:
- Free movement in the base.
- Class selection.
- Skin changes.
- Training dummy interaction.
- Shops and progression displays.
- Team-level bonus unlocks.
- Individual account progression visibility.

The HUB is intentionally not a separate “non-gameplay” menu. It is a playable pre-run space that carries meaningful prep actions [file:1][file:2].

## Run Responsibilities

The RUN is a separate gameplay session. It should support:
- Distinct run selection from HUB.
- One run spanning multiple levels.
- Temporary run-only items, buffs, and debuffs.
- Completion by victory or total party defeat.
- Reward resolution.
- Return to HUB after completion.

The HUB and RUN should have minimal coupling beyond:
- Run type selection.
- Character choice.
- Character level/appearance state relevant at run start.

## State Ownership

| State/Data | Player | Party | Session |
|---|---|---|---|
| Account progression | Yes | No | No |
| Selected character | Yes | Partial | Yes |
| Character stats/level | Yes | Partial | Yes |
| Ready flag | Yes | Yes | Yes |
| Run seed | No | Yes | Yes |
| Difficulty | No | Yes | Yes |
| Objective progression | No | Yes | Yes |
| Revive count | No | Yes | Yes |
| Party statistics | No | Yes | Yes |

This ownership split keeps personal progression, party flow, and authoritative simulation separate, which matches the project’s broader session/state separation [file:2].

## UI Layering Rules

- Use overlays for readiness, selection pending, countdown, and join/leave feedback.
- Use full screen transitions only for loading, reward, and blocking error states.
- Keep the HUB world visible when the state is still “in HUB.”
- Do not turn minor updates into full screen mode switches.
- Connection lost must block gameplay and be visually unmistakable.

## Edge Cases

### Disconnect
If a player disconnects:
- The character is temporarily controlled by a simple bot.
- The player can reconnect automatically.
- The controller should recover into the correct state if the session is still valid.

### Late join
If a player joins while the party is in a run:
- The controller shows a waiting view.
- The player cannot interfere with the active run.
- The player returns to normal HUB view after the run ends.

### Host leaves
If the host quits or loses the session:
- Players are kicked back to the controller main menu.
- An error message is shown.
- The session is considered ended.

### Ready cancel
If a player un-readies:
- The host view updates the ready indicator.
- No additional special handling is required unless the run was already locked.

## MVP Cut

For the first playable scope, the HUB and RUN flow should support:
- Account login.
- Session start.
- Joining as a player.
- 2–3 class choices.
- Free movement and ability use in the HUB.
- Starting a run from the HUB.
- One run type only.
- A run made of 2 levels.
- A reward screen with only a “Victory” message.
- Return to HUB after victory or defeat.

This MVP scope is consistent with the project’s vertical slice direction and foundation milestones [file:2].

## Implementation Notes

- The HUB and RUN flow should be modeled as a state machine, not as a loose sequence of screens.
- UI overlays should be reusable across HUB and RUN states.
- The host client is responsible for presentation and visibility.
- The simulation/server layer is responsible for authoritative transitions.
- The controller client should remain input-first and minimal in presentation [file:2].

## Open Questions

- Should run selection voting be time-limited?
- Can players change class after run selection but before lock?
- Should the HUB support interaction interruption during overlay states?
- Should late join players be allowed to spectate the HUB during an active run?
- Should reward resolution happen instantly or after a short results sequence?

## Related Design Documents

- Gameplay Design Todo: HUB and run flow, onboarding, UI clarity, prototype scope [file:1].
- Hybrid Couch Co-op Dungeon Crawler Project Plan: session architecture, host/client responsibilities, state separation, vertical slice scope [file:2].
# Hybrid Couch Co-op Dungeon Crawler Project Plan

## Overview

The goal of the project is to create a real-time, fully cooperative dungeon crawler in which the game runs on a shared host screen while players connect from their own phones and use them as controllers. The core system pattern is a server-authoritative model in which clients send input, the simulation layer computes the world state, and the host client renders that state [cite:75][cite:77].

For a publishable product, a hybrid architecture is the right foundation: in Local Party Mode, the host machine runs the session authority for minimal latency, while in Online/Remote Mode, a cloud authority runs the session with client-side prediction, reconciliation, and interpolation to support acceptable networked play [cite:64][cite:68][cite:79].

## Product Vision

The intended experience is a shared-screen couch co-op action game where the large display is the primary visual space and phones act as personal controllers. The mobile client should not behave like a full secondary screen, but as an input surface with minimal HUD so players keep watching the shared host screen [cite:58][cite:78].

The product should support two primary operating modes:

- **Local Party Mode:** the host machine runs the authoritative session, phones connect over the local network, and the critical input loop remains local [cite:78][cite:81].
- **Online/Remote Mode:** the session runs in the cloud, players connect over the internet, and latency is mitigated through prediction and reconciliation [cite:36][cite:80].

## Principles

The project should be built around the following technical and product principles:

- The truth of gameplay should live in a separate simulation authority layer, not in the host UI [cite:75][cite:77].
- The host client should render, manage the camera, and present the lobby and shared UI, but final hit detection and enemy AI should not happen there [cite:77].
- The mobile controller should focus only on input, reconnect UX, and minimal personal state feedback [cite:58].
- In local party mode, the cloud should not be part of the critical input round trip [cite:64].
- In online mode, local player input should receive immediate local feedback while the server remains authoritative [cite:68][cite:79].

## Recommended Technology Stack

| Layer | Recommended technology | Rationale |
|---|---|---|
| Host client | TypeScript + Phaser 3 | Stable 2D rendering, scene management, strong fit for a shared-screen game |
| Mobile controller | React + Vite + TypeScript + PWA | Fast mobile UI iteration and easy join flow |
| Simulation authority | Node.js + Colyseus or custom WebSocket loop | Session-oriented authoritative state handling [cite:75] |
| Shared packages | TypeScript monorepo packages | Shared event schema, state types, and game rules |
| Platform backend | PostgreSQL + API layer | Profiles, progression, room metadata, telemetry |
| Deployment | Docker + EU regional infrastructure | Important for online latency and session placement [cite:64] |

The key technology decision is not which websocket library gets chosen, but that the simulation remains tick-based and authoritative. Session-based multiplayer backend models are built around the same separation of responsibilities [cite:64][cite:75].

## High-Level Architecture

### 1. Cloud platform layer

This layer should manage the following:

- account and authentication
- player profile
- progression and unlocks
- run statistics
- telemetry and crash data
- public and private room metadata
- content configuration versioning

In local party mode, this layer should not participate in the real-time gameplay loop; it should function only as a platform service around the session [cite:64][cite:82].

### 2. Session authority layer

The game should use the same simulation engine in two runtime modes:

| Mode | Where authority runs | Main advantage |
|---|---|---|
| Local Party Mode | On the host machine | Minimal input latency |
| Online/Remote Mode | In a cloud region | Remote sessions and public online support |

In both cases, the same game simulation module should run. The difference should be in deployment and transport, not in gameplay logic [cite:64][cite:82].

### 3. Host client

The host is responsible for:

- displaying the main menu and lobby
- showing the QR/join code
- visual handling of character selection
- rendering the full game world
- managing the camera and visual layer
- starting sessions, pause, and game over screens
- reconnect and player status indicators

The host should not decide final collision, hit, or AI outcomes; those should be computed by the authority [cite:77].

### 4. Mobile controller client

The mobile client is responsible for:

- room join through QR or code
- player identification within the session
- analog movement joystick
- active skill buttons or gestures
- minimal HUD such as cooldown, HP, or charge state
- reconnect and connection-state UX

The purpose of the mobile UI is to minimize distraction and maximize fast, accurate input [cite:58][cite:81].

## Networking Strategy

### Local Party Mode

This should be the flagship mode. The host machine starts the authoritative session, phones connect over the same local network, and the cloud provides only optional meta-level services. That keeps the critical input round trip local [cite:78][cite:81].

Recommended local session flow:

1. The host creates or starts a local session.
2. The host starts the local simulation authority.
3. The host displays a QR code and join code.
4. Phones connect directly to the local authority.
5. Lobby, character selection, and ready state.
6. The full run plays through local state synchronization.
7. Optional cloud sync happens at the end of the run.

### Online/Remote Mode

In this mode, the cloud authority owns the session. Playability depends on the combination of client-side prediction, server reconciliation, and entity interpolation [cite:36][cite:68][cite:80].

Minimum netcode elements:

- client-side prediction for local movement [cite:68][cite:80]
- authoritative server correction through reconciliation [cite:36]
- snapshot/entity interpolation for other players and enemies [cite:68]
- sequence-number-based input queue [cite:79]
- regional placement for online sessions [cite:64]

## Domain Model and Service Split

### Session / Room context

Responsibilities:

- room creation
- join code generation
- player join and leave
- session states
- reconnect tokens
- ready state and lobby lifecycle

### Gameplay / Simulation context

Responsibilities:

- tick loop
- movement
- collision
- combat
- cooldowns
- AI
- aggro
- loot
- revive and team state
- run progression

### Player Profile context

Responsibilities:

- account
- profile
- character unlocks
- cosmetics
- statistics
- progression

### Telemetry / Operations context

Responsibilities:

- average session duration
- p95 input RTT
- reconnect rate
- room join funnel
- crash logs
- run completion rate

### Content context

Responsibilities:

- ability configs
- enemy stats
- dungeon room definitions
- character archetypes
- encounter parameters

## Core Gameplay Vertical Slice

The first major milestone should not be the full game, but a vertical slice that validates the couch co-op input model, the combat loop, and the hybrid authority architecture. This slice should already be suitable for internal and external playtesting [cite:64][cite:79].

Recommended vertical slice content:

- 1 lobby flow
- 1 character selection screen
- 2 playable character archetypes
- 1 short dungeon run
- 3 enemy types
- 1 miniboss or boss
- revive mechanic
- 3 to 4 abilities per character
- local session authority
- basic telemetry

## Development Phases

### Phase 0 – Discovery and technical foundations

Goal: learn from the existing prototype, but restart the new project with a clean architecture.

Tasks:

- technical audit of the current prototype
- identify reusable parts
- measure latency baselines in local and remote environments
- finalize the authority model
- draft the first product brief
- draft the first event schema
- design the monorepo structure

Deliverables:

- architecture decision record package
- first version of the event contract
- latency baseline document

### Phase 1 – Foundation platform

Goal: establish the new foundations and bootstrap the main applications.

Tasks:

- monorepo setup
- create shared packages
- bootstrap host app
- bootstrap mobile app
- bootstrap simulation service
- environment configuration
- basic linting, testing, and CI

Deliverables:

- three separately runnable applications
- shared type packages
- basic session join happy path

### Phase 2 – Local Party MVP

Goal: create a working local couch session.

Tasks:

- local authority startup on host
- phone connection via QR
- player slot management
- analog joystick input pipeline
- host render sync
- reconnect handling
- session lifecycle state machine

Success criteria:

- 2 to 4 players can move stably inside a local session with minimal latency [cite:78][cite:81]

### Phase 3 – Combat MVP

Goal: build the actual action core of the game.

Tasks:

- damage system
- enemy AI
- hitbox and collision model
- basic attack
- dash or mobility skill
- cooldown handling
- death/downed/revive flow
- combat event visualization on the host

Success criteria:

- one full combat encounter is playable on the authoritative model [cite:77][cite:79]

### Phase 4 – Vertical Slice

Goal: produce a presentable and testable slice of the game.

Tasks:

- dungeon room pipeline
- reward and progression stub
- boss encounter
- host and mobile UI polish
- tutorialized onboarding
- couch usability refinement
- telemetry dashboard basics

Success criteria:

- external playtests show the session is reliable, understandable, and enjoyable

### Phase 5 – Cloud / Online Mode

Goal: run the same core engine under cloud authority.

Tasks:

- region-aware deployment
- session placement logic
- client-side prediction [cite:68][cite:80]
- reconciliation [cite:36]
- interpolation [cite:68]
- reconnect and session recovery
- online/private room UX

Success criteria:

- acceptable-quality remote sessions for EU players in a nearby region [cite:64]

### Phase 6 – Productization

Goal: turn the vertical slice into a distributable product.

Tasks:

- finalize the account system
- progression and meta layer
- content authoring pipeline
- admin and ops tools
- crash reporting
- rate limiting and basic abuse protection
- onboarding and launch flow
- release strategy

## Suggested Monorepo Structure

```text
repo/
  apps/
    host-client/
    mobile-controller/
    simulation-server/
    backend-platform/
  packages/
    shared-types/
    net-protocol/
    game-rules/
    content-definitions/
    telemetry/
    ui-kit/
  docs/
    product/
    architecture/
    networking/
    gameplay/
```

This structure helps ensure that the same event contracts, game rules, and state types run in both local and cloud environments [cite:36][cite:79].

## Event and State Design Principles

Phone clients should not write state directly; they should send declared input events. This model is more testable, more reconnect-friendly, and gives more stable compatibility than direct state manipulation [cite:77][cite:79].

Examples of main event categories:

- session events: join, leave, reconnect, ready
- input events: move, aim, castStart, castRelease, interact
- simulation events: spawn, damage, heal, death, revive
- UI events: menuSelect, lockIn, pauseVote
- meta events: runComplete, statsUpload, unlockGranted

State should be separated into:

- session state
- network/connection state
- player state
- character combat state
- ability state
- world/entity state
- run progression state

## UX Guidelines

### Host screen

The host screen should keep shared attention focused. It should present all team-level and combat-level information that matters: character positions, enemies, objectives, revive markers, loot, and boss telegraphs [cite:58].

### Mobile controller

The mobile controller should show only the elements required for personal input. A too-detailed mobile UI hurts the couch experience because players start watching their phones instead of the shared display [cite:58][cite:81].

Recommended mobile UI elements:

- movement joystick
- 2 to 4 skill buttons
- one aiming or special input area
- personal HP/resource mini HUD
- cooldown feedback
- reconnect/network status

## Technical Risks and Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| Cloud input latency | RTT is too high when authority is remote | Hybrid mode, region selection, prediction [cite:64][cite:68] |
| Mobile browser sleep/background | The controller may lose the session | Reconnect flow, resume UX |
| Wi-Fi instability | Packet loss can happen even in local sessions | Tolerant input pipeline, reconnect |
| State divergence | Prediction and authority drift apart | Reconciliation and snapshot handling [cite:36][cite:80] |
| Host overload | Rendering and authority together may be heavy | Profiling, separate process or worker |
| UX overload on phone | Players focus on the phone | Minimal controller-first design |

## Metrics and Quality Targets

From the beginning, the project should measure usability and network quality. Recommended KPIs:

- session start success rate
- QR join success rate
- time to join
- p50 / p95 input RTT
- reconnect success rate
- average session length
- run completion rate
- quality difference between local and remote mode

## First 6 Weeks

### Weeks 1–2

- current prototype audit
- write the product brief
- set up the monorepo
- bootstrap host/mobile/server
- first version of shared types

### Weeks 3–4

- room lifecycle
- local host authority startup
- QR join flow
- mobile joystick input
- host render foundations
- first state sync version

### Week 5

- basic combat slice
- damage and cooldown basics
- 1 enemy type
- revive stub
- telemetry base events

### Week 6

- 4-player local playtest
- latency measurement and issue log
- UX iteration on mobile controllers
- finalize vertical slice scope

## Next Documents To Expand

The following documents should be created next from this plan:

1. Product Brief
2. Hybrid Architecture + Session Lifecycle Spec
3. Networking Spec
4. Local Party MVP backlog
5. Controller UX Spec
6. Vertical Slice Gameplay Spec

This order is strong because it first locks the product goal, then the system behavior, and only after that breaks the work into implementation backlog items [cite:64][cite:79].

---
title: 'Game Architecture'
project: 'party-delve'
date: '2026-06-18'
author: 'Cyby'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'

# Source Documents
gdd: '_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/gdd.md'
epics: '_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/epics.md'
brief: null
narrative: '_bmad-output/narrative-design.md'
---

# Game Architecture

## Executive Summary

**Party Delve** is a hybrid couch co-op dungeon crawler running on a shared host screen with phone controllers, built on a **custom WebSocket stack with Colyseus v0.17 as room lifecycle framework** targeting Web (host) + Mobile Web (controllers).

**Key Architectural Decisions:**

- **Split-surface authority** — simulation server is the sole game authority; host and mobile are pure clients that render and send input only
- **Hybrid delta + snapshot sync** — delta events every tick (30hz), full snapshots every 5s and on join/reconnect; JSON now, MessagePack at Phase 5
- **Colyseus without `@Schema`** — room lifecycle and message routing only; all state flows through explicit typed event contracts in `net-protocol`
- **planck.js v1.5.0** — deterministic Box2D physics for collision, sensor zones (Spirit Bond proximity), and convex polygon shapes
- **xoshiro128++** PRNG seeded per run, one factory per generation system (`createRng(seed ^ offset)`)
- **Layered FSM** for enemies — base behavior + stackable difficulty behavior layers, no stat inflation
- **Hybrid persistence** — Redis for live session cache + Colyseus presence adapter; PostgreSQL for durable player data
- **PixiJS v8.18+ host-only** — no game logic; progressive asset loading via `Assets.backgroundLoad()` during hub
- **Hono v4.12.26** for backend-platform HTTP; pino v10.3.1 for structured logging across all Node.js apps
- **Clean slate policy** — all ad-hoc scaffold files deleted before Phase 2 implementation begins

**Project Structure:** Monorepo with `apps/` + `packages/` separation; 5 apps, 5 shared packages; 12 core systems mapped.

**Implementation Patterns:** 7 patterns defined (4 novel, 3 standard) ensuring AI agent consistency across 5 development roles.

**Ready for:** Epic implementation — Phase 2 (Local Party MVP)

---

## Document Status

**Steps Completed:** 9 of 9 — Complete

---

## Project Context

### Game Overview

**Party Delve** — Couch co-op action roguelike for 3–8 players. Players join a shared host screen by scanning a QR code on their phones. Each player controls one of 10 radically asymmetric classes through procedurally generated dungeon levels, fighting toward a boss encounter. The phone is the only controller. The TV is the only screen that matters.

### Technical Scope

**Platform:** PC/laptop (host screen) + iOS + Android (mobile controllers)
**Genre:** Co-op action roguelike
**Project Level:** High complexity — novel split-surface authority model, strict latency contract, up to 8 simultaneous mobile clients

### Core Systems

| System | Complexity | GDD Reference |
|---|---|---|
| Authoritative simulation server (tick loop) | High | §Technical Specs, CLAUDE.md |
| Real-time networking (sim↔host↔mobile) | High | §Technical Specs |
| Mobile controller client (touch/joystick input) | High | §Controls and Input |
| Host rendering client (isometric pixel art, shared screen) | Medium-High | §Art Direction |
| QR code session bootstrap | Medium | §Platform-Specific Details |
| Session management (guest/registered, reconnect) | Medium-High | §Progression |
| Procedural level generation (seed-deterministic) | Medium | §Procedural Generation |
| Spirit Bond system (state, visual tethers, proximity checks) | Medium | §Spirit Bond System |
| Combat engine (movement, collision, abilities, AI) | High | §Core Combat, E3 |
| Persistence / progression (mastery counters, accounts) | Medium | §Player Progression |
| Telemetry instrumentation | Low-Medium | §Success Metrics |

### Technical Requirements

**Performance:**
- Input latency: ≤100ms p95 — mobile input event → visible response on host screen
- Session join time: ≤10s — QR scan to player visible in hub
- Host frame rate: 60 FPS stable — measured during 8-player combat on target hardware

**Networking:**
- Architecture: hybrid local authority — authoritative simulation server + pure rendering host client + pure input mobile clients
- 3–8 simultaneous real-time connections on local network
- Deterministic seeded simulation required for procedural sync across all clients
- Cloud must not sit on the critical gameplay path during local sessions

### Complexity Drivers

1. **Split-surface authority model** — simulation server is the sole authority; host and mobile are pure clients with no gameplay logic. This is the single biggest architectural constraint and must be enforced at every layer.
2. **Sub-100ms round-trip on local network** — mobile touch → sim server → host render, all on LAN. Not trivial at 8 players + effects.
3. **Simulation determinism** — all procedural outcomes (floor layout, room pool, enemy spawns, Spirit Bond assignment) must derive from one shared seed. Determinism must survive 8 concurrent async input streams.
4. **Spirit Bond proximity checks** — cross-player physics queries at tick rate. Architectural concern for the simulation loop design.
5. **Isometric pixel art at 60fps** — 8 players + N enemies + ability effects + bond tethers + corruption particles. Rendering budget needs an architectural ceiling.

### Technical Risks

1. Mobile browser WebSocket reliability — iOS Safari background/sleep behavior, reconnect handling edge cases
2. LAN latency variance — a measured baseline is needed before committing to the 100ms contract
3. Simulation determinism under 8 async input streams — any non-deterministic shortcut breaks replay and sync
4. PixelLab MCP asset pipeline — external toolchain dependency for all art production; no fallback defined

---

## Engine & Framework

### Stack Overview

Party Delve is a multi-app monorepo. There is no single game engine — each app has its own appropriate runtime:

| App | Runtime | Rendering | Notes |
|---|---|---|---|
| `simulation-server` | Node.js 22 + TypeScript | None (headless) | Authoritative tick loop; Colyseus for room/WS management |
| `host-client` | React 18 + Vite + TypeScript | PixiJS v8 (WebGL) | Pure renderer; no game logic |
| `mobile-controller` | React 18 + Vite + TypeScript | None (DOM/CSS) | Pure input client; touch UI |
| `backend-platform` | Node.js + TypeScript | None | Auth, persistence, accounts |

### Host Rendering Library

**PixiJS v8.18+**

Rationale: The host client is a pure renderer — it draws what the simulation server sends, nothing more. PixiJS is a WebGL renderer, not a game framework, which structurally enforces the "no gameplay authority in the host" constraint from CLAUDE.md. Phaser 4 was evaluated and rejected: it ships scene management, physics, and input handling that would invite authority leakage into the host renderer.

### Simulation Server Framework

**Colyseus v0.17 + custom tick loop**

Colyseus provides room lifecycle (`onCreate`, `onJoin`, `onLeave`, `onMessage`), WebSocket connection management, horizontal scaling via the Redis presence adapter, and reconnect with grace period. These are the exact capabilities required for Phase 5 (region-aware deployment, reconnect recovery).

**Critical constraint — `@Schema` state sync is explicitly NOT used.** All game state lives in the `game-rules` package. All messages use types from `net-protocol`. Colyseus is the infrastructure harness and scaling layer; `game-rules` is the authority. Colyseus rooms are message routers, not state owners.

Rationale for choosing now: the simulation server is a minimal scaffold (`ws` + `tsx`, no tick loop implemented). Migration cost is low (1–2 story points). The same migration after Epics E3–E5 would be significantly more expensive.

### Mobile Controller

**React 18 + Vite + PWA (vite-plugin-pwa)**

No game renderer required. The controller is a touch input surface: analog joystick (left zone) and 4-ability 2×2 grid (right zone) implemented in DOM/CSS with touch event handlers. The Vite PWA plugin enables offline load, fast re-join after browser sleep, and avoids App Store distribution friction (Pillar 4).

### AI Development Tooling

**Context7** (`upstash/context7`) — live PixiJS v8 and Colyseus documentation lookup. Prevents outdated API usage, especially important for PixiJS v8 which introduced a new rendering architecture (v8 API differs significantly from v7).

```
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

### Remaining Architectural Decisions

The following are not resolved by the stack and must be decided explicitly in Step 4:

- Simulation tick rate and timing model
- WebSocket message framing and serialization format
- Deterministic PRNG selection for seeded simulation
- PixiJS scene graph structure for isometric rendering
- Colyseus room lifecycle mapping to game session states
- State reconciliation strategy (host receives authoritative snapshots vs. delta events)
- Reconnect grace period and state recovery protocol
- Local vs. cloud authority boundary (Phase 1–4 vs. Phase 5)

---

## Architectural Decisions

### Decision Summary

| # | Category | Decision | Key Detail |
|---|---|---|---|
| 1 | Simulation timing | 30 ticks/s | Configurable via `TICK_RATE_HZ` in `shared-types` |
| 2 | Message serialization | JSON | Abstracted behind `serialize()`/`deserialize()` in `net-protocol`; swap to MessagePack in Phase 5 |
| 3 | State synchronization | Hybrid | Delta events every tick; full snapshot on join/reconnect and every 5s |
| 4 | Session lifecycle | One Colyseus room = one session | Disconnect → idle/frozen; spirit form only on grace period expiry |
| 5 | Physics | planck.js v1.5.0 | Deterministic Box2D — collision, sensors, polygon shapes, raycasting, joints |
| 6 | Enemy AI | Layered FSM | Base FSM (Idle/Chase/Attack) + behavior layers stacked per difficulty tier |
| 7 | PRNG | xoshiro128++ | `createRng(seed)` factory in `game-rules`; independent stream per generation system |
| 8 | Persistence | PostgreSQL + Redis | Postgres for durable player data; Redis for active session cache + Colyseus presence adapter |
| 9 | Asset loading | Progressive | Core bundle at startup; biome bundles background-loaded during hub via `Assets.backgroundLoad()` |
| 10 | Audio | Howler.js (host only) | Pre-authored music and SFX; mobile controller has no audio dependency |

### Simulation Timing

**30 ticks/s** — tick interval ~33ms, giving 3 ticks inside the 100ms latency budget.
Defined as `TICK_RATE_HZ = 30` in `shared-types`. All cooldown math, physics steps, and
network frames derive from this single constant. Tunable without refactor.

### Message Serialization

**JSON** for Phase 1–4. All WebSocket messages pass through `serialize()` / `deserialize()`
in `net-protocol` — call sites are insulated from the format. Swap to MessagePack for
Phase 5 (remote play) by changing the implementation of those two functions only.

### State Synchronization

**Hybrid — delta events + periodic snapshot.**

- Sim broadcasts typed delta events (move, damage, state change, bond assignment) every tick.
- Host reconstructs world state by applying events to its local mirror.
- Full authoritative snapshot sent on player join, reconnect, and every 5 seconds as a
  consistency backstop. No ack protocol required — drift is bounded by the snapshot interval.

### Session Lifecycle (Colyseus)

One `GameRoom extends Room` = one game session.

| Hook | Trigger | Action |
|---|---|---|
| `onCreate` | Host starts session | Init `GameState`, seed xoshiro128++ PRNG, start 30hz tick loop |
| `onJoin` | Player joins via QR/code | Add player slot, broadcast snapshot to all clients |
| `onLeave(consented=false)` | Network drop | Hold slot, freeze character in place, start 30s grace timer |
| `onLeave(consented=true)` | Intentional leave/kick | Remove player slot immediately |
| `onMessage` | Mobile input event | Route typed message to sim input queue for next tick |
| `onDispose` | Session ends | Flush Redis session cache to PostgreSQL, release room |

`@Schema` state sync is **not used**. All state lives in `game-rules`; all messages use
`net-protocol` types.

### Physics

**planck.js v1.5.0** runs headless inside `simulation-server`.

Usage:
- Rectangle + circle colliders for players and enemies
- Polygon shapes for room geometry (angled walls, boss arenas)
- Sensor bodies for Spirit Bond proximity, aggro radius, ability activation zones
- Raycasting for enemy line-of-sight
- Revolving joints for trap mechanics (spinning blades, etc.)
- Distance joints for Spirit Bond physical constraint (proximity bond type)

Physics world steps once per simulation tick, synchronized with the 30hz loop.

### Enemy AI

**Layered FSM** in `game-rules`.

- Base FSM: `Idle → Chase → Attack → Idle` — every enemy at every difficulty
- Behavior layers: independent modules that intercept the base FSM on a per-tick basis
- Easy: base FSM only
- Normal: base FSM + one behavior layer (e.g. `ChargeLayer`)
- Hard: base FSM + two behavior layers (e.g. `ChargeLayer` + `StompLayer`)

Each layer is independently testable. Adding a Hard-tier behavior never modifies
the base FSM or lower-tier layers.

### Deterministic PRNG

**xoshiro128++** implemented in `game-rules`.

`createRng(seed: number): () => number` — factory that returns a stateful RNG function.
Each generation system receives its own independent stream derived from the shared run seed:

- Floor layout generator → `createRng(seed ^ 0x01)`
- Room pool selector → `createRng(seed ^ 0x02)`
- Enemy spawn placer → `createRng(seed ^ 0x03)`
- Spirit Bond pair assigner → `createRng(seed ^ 0x04)`

Seed is generated by the simulation server at session start and broadcast to all
clients in the opening snapshot.

### Persistence

**PostgreSQL (durable) + Redis (session cache).**

- Redis is the Colyseus presence adapter — already required for horizontal scaling.
  The active session cache (Spirit Essence earned mid-run, mastery ticks) is a
  second use of the same Redis instance.
- On run end (`onDispose`): Redis session data flushes to PostgreSQL atomically.
- Guest players: in-memory only, no DB writes.
- Registered players: PostgreSQL owns Spirit Essence balance, mastery counters,
  unlocked skins/enhancements, achievement progress.

### Asset Loading

**Progressive loading** in `host-client`.

- **Core bundle** (UI chrome, player sprites for all 10 classes, hub assets):
  loaded at startup before the host lobby is shown.
- **Biome bundles** (tilemap, enemy sprites, boss, room props per biome):
  background-loaded via PixiJS `Assets.backgroundLoad()` during hub free-roam,
  triggered when biome selection is known.
- Bundle manifests defined in a single `asset-manifest.ts` in `host-client`.
- No mid-combat asset hitches: biome assets are guaranteed ready before the
  dungeon entrance vote can complete.

### Audio

**Howler.js** on `host-client` only.

- Ambient layers (nature baseline, tribal percussion) loop and crossfade
  between hub, dungeon, and boss states.
- SFX triggered by simulation events received from the server.
- Boss encounter audio: distinct per-boss track, fully composed.
- `mobile-controller`: no audio dependency. Optional haptic feedback via
  `navigator.vibrate()` on ability fire (single short pulse, user-dismissible).

### Deferred Decisions

| Item | Proposed default | When to revisit |
|---|---|---|
| Reconnect grace period | 30 seconds (config constant) | After first playtesting session |
| Telemetry platform | Custom event pipeline on Node.js | E10 (Polish & Metrics) |

---

## Cross-cutting Concerns

These patterns apply to **all systems** and are mandatory for every agent implementation. Deviating from these patterns without an explicit ADR is a merge-gate violation.

### Error Handling

**Strategy: Result type for domain errors + try-catch boundary at the tick loop.**

- `game-rules` functions return `Result<T, GameError>` (discriminated union) — no throwing inside the simulation. Callers handle all error branches explicitly.
- The 30hz tick loop wraps each tick in a try-catch. On catch: log at `error` level, skip that tick, continue. The session survives individual tick failures.
- Inbound WebSocket messages that are malformed or of unknown type are logged and discarded — never rethrown into the tick loop.
- Fatal errors (DB unreachable at startup, port bind failure) throw normally and crash-exit. No session exists yet; fast-fail is correct.

```typescript
// Domain error pattern — game-rules functions
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Tick loop boundary — simulation-server
setInterval(() => {
  try {
    room.tick();
  } catch (err) {
    logger.error({ err, sessionId: room.roomId }, 'tick error — skipping frame');
  }
}, 1000 / TICK_RATE_HZ);
```

### Logging

**`pino`** on Node.js apps (`simulation-server`, `backend-platform`). Structured `console` objects on browser clients (`host-client`, `mobile-controller`).

**Log levels:**

| Level | When to use |
|---|---|
| `error` | Unrecoverable within the current operation; always investigated |
| `warn` | Unexpected but handled; investigate if frequent |
| `info` | Session lifecycle milestones (join, run start, run end, disconnect) |
| `debug` | Diagnostic detail — stripped in production |

**Every log entry includes:** `{ timestamp, level, app, sessionId?, playerId?, message, ...context }`

**Performance rule:** No logging inside the tick loop at `info` or above. `debug`-level tick logging is opt-in via `DEBUG_TICK=true` env var and never enabled in production.

```typescript
// pino setup — simulation-server
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

### Configuration

**Three-tier config — no magic strings, no scattered hardcoding.**

| Tier | Contents | Location |
|---|---|---|
| Shared constants | `TICK_RATE_HZ`, `MAX_PLAYERS`, `SNAPSHOT_INTERVAL_S`, `RECONNECT_GRACE_S` | `packages/shared-types/src/constants.ts` |
| Balance values | Cooldowns, damage, Spirit Bond durations, revive timer windows | `packages/game-rules/src/balance.ts` |
| Infrastructure | DB URLs, Redis address, ports, secrets | `.env` files — never committed |

No remote config in Phase 1–4. Balance values are code-level constants — edited, reviewed, and deployed like any other change. Remote config deferred to Phase 5 if live tuning is required.

### Event System

**Typed EventEmitter per `GameRoom` instance** for internal simulation communication.

- Node.js `EventEmitter` extended with TypeScript overloads for type-safe event names and payloads.
- Internal only — events never cross the WebSocket boundary. All wire messages use `net-protocol` types.
- **Synchronous dispatch.** The tick loop processes all events synchronously each tick — no deferred callbacks or `process.nextTick` inside the simulation.
- **Naming convention:** `noun:verb` (e.g. `player:downed`, `bond:assigned`, `enemy:killed`, `level:complete`).

```typescript
// Typed event map — shared-types
interface SimEvents {
  'player:downed': { playerId: string; downCount: number };
  'bond:assigned': { playerA: string; playerB: string; bondType: BondType };
  'enemy:killed':  { enemyId: string; byPlayerId: string };
  'level:complete': { levelIndex: number };
}

// Usage — any game-rules system
sim.emit('player:downed', { playerId, downCount });
```

### Debug Tools

All debug tooling is gated behind `process.env.DEBUG === 'true'` (server) or `import.meta.env.DEV` (Vite clients). Zero debug code runs in production builds.

| Tool | App | What it provides |
|---|---|---|
| Tick rate monitor | `host-client` overlay | Actual ticks/s received, frame drift indicator |
| Physics debug overlay | `host-client` overlay | planck.js body outlines, sensor zones, Spirit Bond radius rings |
| Simulation state inspector | `simulation-server` | Full `GameState` JSON dump on `SIGUSR1` signal |
| Message log | `simulation-server` | All inbound/outbound WebSocket messages with timestamps |
| Cheat panel | `host-client` | `!godmode`, `!skip_level`, `!assign_bond` — opened via `Ctrl+Shift+D` |

Cheat commands are processed server-side and only accepted when the room was created with `{ debug: true }` in `onCreate` options.

---

## Project Structure

### Organization Pattern

**Domain-Driven within apps, By Type at the package level.** Each app organizes by game system (physics, AI, rendering, audio); packages organize by concern (types, rules, protocol). Standard for TypeScript monorepos with clear bounded contexts.

### Clean Slate Policy

The existing `src/` files across all apps and packages were created ad-hoc without architectural planning and do not reflect this document. **Before any implementation begins, all ad-hoc source files must be deleted and recreated per this structure.** Config files (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`) are retained — they remain valid. Planning artifacts, docs, and `CLAUDE.md` are never touched.

**Delete:** all `apps/*/src/` contents, all `packages/*/src/` contents, all `tests/e2e/` and `tests/unit/` contents, all `apps/simulation-server/tests/` contents, all `packages/*/.gitkeep` stubs.

**Keep:** all `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `docs/`, `_bmad-output/`, `CLAUDE.md`, `.gitignore`, workspace root files.

### Directory Structure

```
party-delve/
│
├── apps/
│   │
│   ├── simulation-server/src/
│   │   ├── rooms/
│   │   │   └── GameRoom.ts              # Colyseus Room — full session lifecycle
│   │   ├── logger.ts                    # pino instance
│   │   └── index.ts                     # Colyseus Server bootstrap + Redis presence adapter
│   │
│   ├── host-client/src/
│   │   ├── pixi/
│   │   │   ├── app.ts                   # PixiJS Application setup (canvas, resolution, scale)
│   │   │   ├── renderer.ts              # consumes delta events, updates stage each frame
│   │   │   ├── layers/
│   │   │   │   ├── ground.ts            # isometric tilemap / floor layer
│   │   │   │   ├── entities.ts          # player + enemy sprite management
│   │   │   │   ├── effects.ts           # ability FX, bond tether particles
│   │   │   │   └── hud.ts               # non-diegetic HUD (player chips, objective, bond indicators)
│   │   │   └── assets/
│   │   │       └── asset-manifest.ts    # core bundle + per-biome bundle definitions
│   │   ├── audio/
│   │   │   └── audio-manager.ts         # Howler.js: ambient layers, crossfade, SFX dispatch
│   │   ├── session/
│   │   │   └── host-session.ts          # Colyseus client — connect, create room, receive events
│   │   ├── screens/
│   │   │   ├── LobbyScreen.tsx          # pre-run lobby: QR code display, player slot list
│   │   │   └── GameScreen.tsx           # in-game: PixiJS canvas mount + HUD overlay
│   │   ├── debug/                       # DEV only — stripped in production builds
│   │   │   ├── tick-monitor.ts          # tick rate overlay
│   │   │   ├── physics-overlay.ts       # planck body wireframes
│   │   │   └── CheatPanel.tsx           # Ctrl+Shift+D dev panel
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── mobile-controller/src/
│   │   ├── screens/
│   │   │   ├── AuthScreen.tsx           # guest / sign-in choice (portrait)
│   │   │   ├── JoinScreen.tsx           # QR scan + session code entry (portrait)
│   │   │   ├── OrientationScreen.tsx    # rotate-your-phone prompt
│   │   │   ├── ClassSelectScreen.tsx    # class card scroll (landscape)
│   │   │   ├── HubController.tsx        # hub free-roam: joystick active, abilities inactive
│   │   │   ├── GameController.tsx       # in-combat: joystick + 2×2 ability grid
│   │   │   ├── SpiritFormController.tsx # spirit form: joystick + 1 spirit ability cell
│   │   │   └── ReconnectScreen.tsx      # lost connection: session code + rejoin CTA
│   │   ├── components/
│   │   │   ├── VirtualJoystick.tsx      # analog joystick, touch event driven
│   │   │   ├── AbilityGrid.tsx          # fixed 2×2 grid container
│   │   │   ├── AbilityCell.tsx          # individual cell: tap / joystick-hold / auto-fire variants
│   │   │   ├── CooldownRing.tsx         # SVG ring cooldown visualizer
│   │   │   └── PlayerStatusChip.tsx     # health pips + bond color indicator
│   │   ├── hooks/
│   │   │   ├── useControllerSession.ts  # Colyseus client — join room, receive state
│   │   │   └── useHaptic.ts             # navigator.vibrate() wrapper, user-dismissible
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   │
│   └── backend-platform/src/
│       ├── db/
│       │   ├── postgres.ts              # PostgreSQL connection pool
│       │   └── redis.ts                 # Redis client — session cache + Colyseus presence
│       ├── routes/
│       │   ├── auth.ts                  # POST /auth/guest, /auth/login, /auth/register
│       │   └── player.ts                # GET/PATCH /player/:id — mastery, Spirit Essence, achievements
│       ├── middleware/
│       │   └── auth.ts                  # JWT verification
│       └── index.ts                     # HTTP server bootstrap
│
├── packages/
│   │
│   ├── shared-types/src/
│   │   ├── constants.ts                 # TICK_RATE_HZ, MAX_PLAYERS, SNAPSHOT_INTERVAL_S, RECONNECT_GRACE_S
│   │   ├── player.ts                    # PlayerState, PlayerClass, SessionColor
│   │   ├── enemy.ts                     # EnemyType, EnemyState, DifficultyTier
│   │   ├── bond.ts                      # BondType, BondState
│   │   ├── session.ts                   # SessionState, RoomOptions
│   │   ├── input.ts                     # InputEvent, JoystickInput, AbilityInput
│   │   ├── join.ts                      # JoinRequest, JoinResponse
│   │   ├── game-state.ts                # GameState — authoritative snapshot shape
│   │   └── index.ts
│   │
│   ├── game-rules/src/
│   │   ├── state/
│   │   │   ├── game-state.ts            # GameState factory and mutation functions
│   │   │   └── result.ts                # Result<T, GameError> discriminated union
│   │   ├── physics/
│   │   │   ├── world.ts                 # planck.js World factory + step function
│   │   │   ├── bodies.ts                # createPlayerBody(), createEnemyBody()
│   │   │   └── sensors.ts               # createBondSensor(), createAggroSensor()
│   │   ├── prng/
│   │   │   └── xoshiro128.ts            # createRng(seed: number): () => number
│   │   ├── generation/
│   │   │   ├── seed.ts                  # seed stream derivation (seed ^ offset per system)
│   │   │   ├── floor.ts                 # procedural floor layout generator
│   │   │   └── rooms.ts                 # handcrafted room pool selector
│   │   ├── entities/
│   │   │   ├── player.ts                # player entity: create, update, ability dispatch
│   │   │   ├── enemy.ts                 # enemy entity: create, AI tick
│   │   │   └── bond.ts                  # Spirit Bond: create, apply buff/price per tick
│   │   ├── systems/
│   │   │   ├── movement.ts              # InputEvent → player position update
│   │   │   ├── combat.ts                # hitbox resolution, damage application
│   │   │   ├── bonds.ts                 # bond assignment at level end + per-tick bond effects
│   │   │   ├── revive.ts                # revive timer countdown, spirit form transition
│   │   │   └── ai/
│   │   │       ├── fsm.ts               # EnemyFSM: Idle / Chase / Attack + transitions
│   │   │       └── layers/
│   │   │           ├── charge.ts        # Normal-tier: telegraphed charge behavior layer
│   │   │           └── stomp.ts         # Hard-tier: AoE stomp behavior layer
│   │   ├── balance.ts                   # all tunable numbers in one place
│   │   └── index.ts
│   │
│   ├── net-protocol/src/
│   │   ├── serialize.ts                 # serialize<T>() / deserialize<T>() — JSON now, swap point for Phase 5
│   │   ├── envelope.ts                  # MessageEnvelope type discriminator
│   │   ├── event-names.ts               # string enum of all message type identifiers
│   │   ├── messages/
│   │   │   ├── server-to-host.ts        # SnapshotMsg, DeltaEventMsg union
│   │   │   ├── server-to-mobile.ts      # CooldownUpdateMsg, BondNotificationMsg, SpiritFormMsg
│   │   │   └── mobile-to-server.ts      # InputEventMsg, JoinRequestMsg
│   │   └── index.ts
│   │
│   ├── telemetry/src/                   # rebuilt per telemetry design (E10)
│   │
│   └── ui-kit/src/
│       ├── host/                        # host shared UI (populated across epics)
│       └── mobile/                      # mobile shared UI (populated across epics)
│
├── tests/
│   ├── e2e/
│   │   ├── join-room.test.ts            # E1: QR scan → player visible in hub
│   │   ├── full-run.test.ts             # E4+: 3-level run happy path
│   │   └── reconnect.test.ts            # E1+: disconnect + rejoin within grace period
│   ├── unit/
│   │   ├── xoshiro128.test.ts           # PRNG determinism and distribution
│   │   ├── fsm.test.ts                  # enemy FSM state transitions per difficulty
│   │   ├── bonds.test.ts                # bond assignment and buff/price application
│   │   └── generation.test.ts           # floor layout reproducibility given same seed
│   └── contract/
│       └── net-protocol.test.ts         # message shape contract tests
│
└── tools/
    ├── latency-baseline/                # Phase 0 LAN latency measurement scripts
    └── seed-visualizer/                 # dev tool: render floor layouts from seed inputs
```

### System → Location Mapping

| System | Location |
|---|---|
| Colyseus tick loop | `simulation-server/src/rooms/GameRoom.ts` |
| planck.js world | `game-rules/src/physics/world.ts` |
| xoshiro128++ PRNG | `game-rules/src/prng/xoshiro128.ts` |
| Floor generation | `game-rules/src/generation/floor.ts` |
| Enemy AI (FSM + layers) | `game-rules/src/systems/ai/` |
| Spirit Bond logic | `game-rules/src/systems/bonds.ts` |
| Revive timer / spirit form | `game-rules/src/systems/revive.ts` |
| PixiJS renderer | `host-client/src/pixi/renderer.ts` |
| Asset bundles | `host-client/src/pixi/assets/asset-manifest.ts` |
| Howler.js audio | `host-client/src/audio/audio-manager.ts` |
| Joystick + ability grid | `mobile-controller/src/components/` |
| Message serialize/deserialize | `net-protocol/src/serialize.ts` |
| Wire message types | `net-protocol/src/messages/` |
| Shared constants | `shared-types/src/constants.ts` |
| Balance values | `game-rules/src/balance.ts` |
| PostgreSQL | `backend-platform/src/db/postgres.ts` |
| Redis | `backend-platform/src/db/redis.ts` |

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` / `.tsx` | `game-state.ts`, `AbilityCell.tsx` |
| Classes / Types / Interfaces | `PascalCase` | `GameState`, `BondType`, `GameRoom` |
| Functions / methods | `camelCase` | `createRng()`, `applyDeltaEvent()` |
| Constants | `UPPER_SNAKE_CASE` | `TICK_RATE_HZ`, `RECONNECT_GRACE_S` |
| React components | `PascalCase.tsx` | `AbilityGrid.tsx`, `ReconnectScreen.tsx` |
| Internal sim events | `noun:verb` | `player:downed`, `bond:assigned` |
| Wire message types | `PascalCase + Msg/Evt suffix` | `SnapshotMsg`, `PlayerMovedEvt` |
| CSS classes | `kebab-case` | `ability-cell`, `cooldown-ring` |

### Architectural Boundaries

1. `game-rules` has zero knowledge of WebSocket, Colyseus, React, or PixiJS.
2. `host-client` and `mobile-controller` contain zero game logic — they render and relay only.
3. `net-protocol` is the sole owner of all wire message type definitions.
4. `shared-types/constants.ts` is the single source for all timing and session constants.
5. `backend-platform` is the only app that touches PostgreSQL — no direct DB calls from the sim server or clients.

---

## Implementation Patterns

These patterns are mandatory for all agent implementations. Deviation requires an explicit ADR.

### Novel Patterns

#### Split-Surface Authority

**Purpose:** Enforces at the code level that the simulation server is the only mutator of `GameState`, the host is a read-only renderer, and the mobile controller is a pure input source.

```typescript
// sim server — ONLY place GameState is mutated
// GameRoom.ts
onMessage(client: Client, msg: InputEventMsg) {
  const result = processInput(this.state, msg);  // game-rules → Result<DeltaEvent[], GameError>
  if (result.ok) {
    result.value.forEach(evt => {
      this.broadcast(EventNames.DELTA, serialize(evt));
      this.simEvents.emit(evt.type, evt);  // internal only
    });
  }
}

// host client — read-only mirror, never mutates sim state
// renderer.ts
socket.onDelta((evt: DeltaEventMsg) => {
  applyDelta(mirrorState, evt);  // pure function, updates local mirror only
  renderFrame(mirrorState);
});

// mobile controller — sends input only, never reads game state
// useControllerSession.ts
const sendInput = (input: InputEventMsg) => room.send(EventNames.INPUT, serialize(input));
```

**Enforcement:** ESLint `no-restricted-imports` rule blocks any import of `game-rules` in `host-client` or `mobile-controller`. Violations are a merge-gate failure.

---

#### Spirit Bond

**Purpose:** Cross-player buff+price pairs that accumulate across levels, interact with planck.js proximity sensors, and produce delta events consumed by the host renderer for tether visualization.

```typescript
// game-rules/src/systems/bonds.ts

// Called once at level end
export function assignBond(state: GameState, rng: () => number): Result<BondAssignedEvt, GameError> {
  const pair = selectBondPair(state.players, state.activeBonds, rng);
  const bondType = selectBondType(rng);
  const bond: BondState = { playerA: pair[0], playerB: pair[1], type: bondType };
  state.activeBonds.push(bond);
  return { ok: true, value: { type: 'bond:assigned', bond } };
}

// Called every tick — applies buff/price for each active bond
export function processBonds(state: GameState, world: planck.World): DeltaEvent[] {
  const events: DeltaEvent[] = [];
  for (const bond of state.activeBonds) {
    const inRange = checkSensor(world, bond.playerA, bond.playerB, BOND_SENSOR_ID);
    events.push(...applyBondEffects(state, bond, inRange));
  }
  return events;
}
```

**Host rendering rule:** On `BondAssignedEvt`, the host stores the pair and draws a colored tether between their screen positions every frame. The host never computes bond effects — it only visualizes them.

---

#### Behavior Layer Stack

**Purpose:** Difficulty-tier behaviors stack on top of the base enemy FSM without modifying it. Adding a Hard-tier behavior is adding a layer — never editing `fsm.ts`.

```typescript
// game-rules/src/systems/ai/fsm.ts
export interface BehaviorLayer {
  shouldActivate(ctx: EnemyContext): boolean;
  execute(enemy: EnemyState, ctx: EnemyContext): DeltaEvent[];
  cooldown: number;
  currentCooldown: number;
}

export function tickEnemy(
  enemy: EnemyState,
  ctx: EnemyContext,
  layers: BehaviorLayer[]
): DeltaEvent[] {
  for (const layer of layers) {
    if (layer.currentCooldown === 0 && layer.shouldActivate(ctx)) {
      layer.currentCooldown = layer.cooldown;
      return layer.execute(enemy, ctx);
    }
    if (layer.currentCooldown > 0) layer.currentCooldown--;
  }
  return tickBaseFSM(enemy, ctx);  // fallback — base always runs if no layer activates
}

// Hard enemy: prepend both layers, base FSM untouched
const hardEnemy = createEnemy(EnemyType.CORRUPTED_BOAR, [
  new ChargeLayer(),  // Normal-tier
  new StompLayer(),   // Hard-tier
]);
```

---

#### Hybrid Delta + Snapshot

**Purpose:** Host maintains a local mirror of `GameState` built from delta events, periodically overwritten by authoritative snapshots to prevent drift.

```typescript
// host-client/src/session/host-session.ts
let mirrorState: GameState = createEmptyState();

room.onMessage(EventNames.SNAPSHOT, (raw: string) => {
  mirrorState = deserialize<SnapshotMsg>(raw).state;  // full overwrite
});

room.onMessage(EventNames.DELTA, (raw: string) => {
  const evt = deserialize<DeltaEventMsg>(raw);
  mirrorState = applyDelta(mirrorState, evt);  // pure reducer
});

// net-protocol/src/messages/server-to-host.ts
// applyDelta is pure — same input always produces same output
export function applyDelta(state: GameState, evt: DeltaEventMsg): GameState {
  switch (evt.type) {
    case 'player:moved':  return { ...state, players: updatePlayer(state.players, evt) };
    case 'enemy:killed':  return { ...state, enemies: removeEnemy(state.enemies, evt.enemyId) };
    case 'bond:assigned': return { ...state, activeBonds: [...state.activeBonds, evt.bond] };
    default: return state;
  }
}
```

**Rule:** `applyDelta` lives in `net-protocol` and is a pure function. Both the host and any future spectator client import and use it identically.

---

### Standard Patterns

#### Entity Creation — Factory Functions

All game entities are created via typed factory functions. No `new EntityClass()` in game systems.

```typescript
// game-rules/src/entities/
export const createPlayer = (id: string, playerClass: PlayerClass): PlayerState => ({ ... });
export const createEnemy  = (type: EnemyType, layers: BehaviorLayer[]): EnemyState => ({ ... });
export const createBond   = (a: string, b: string, type: BondType): BondState => ({ ... });
```

#### Data Access — Direct Typed Import

No service locator, no singleton config manager, no globals. Constants are imported directly.

```typescript
import { TICK_RATE_HZ, RECONNECT_GRACE_S } from 'shared-types/constants';
import { REVIVE_WINDOWS, BOND_PROXIMITY_RADIUS } from 'game-rules/balance';
```

#### Component Communication — Typed EventEmitter

Internal simulation communication uses the typed `SimEvents` EventEmitter on the `GameRoom` instance. Wire communication uses `net-protocol` message types exclusively.

```typescript
// Typed event map — shared-types
interface SimEvents {
  'player:downed': { playerId: string; downCount: number };
  'bond:assigned': { playerA: string; playerB: string; bondType: BondType };
  'enemy:killed':  { enemyId: string; byPlayerId: string };
  'level:complete': { levelIndex: number };
}

sim.emit('player:downed', { playerId, downCount });  // internal only, never crosses WebSocket
```

### Consistency Rules

| Rule | Pattern | Enforcement |
|---|---|---|
| No game logic in clients | No `game-rules` import in `host-client` or `mobile-controller` | ESLint `no-restricted-imports` |
| All wire I/O serialized | Every WebSocket send/receive through `serialize()`/`deserialize()` | Code review |
| Factory functions only | No `new EntityClass()` in game systems | Code review |
| No magic numbers | All numeric constants from `shared-types/constants.ts` or `game-rules/balance.ts` | ESLint `no-magic-numbers` |
| Pure delta reducer | `applyDelta` has no side effects — verified by unit test | Automated test |
| No tick-loop logging | No `logger.info` inside 30hz tick — `logger.debug` opt-in only | Code review |

---

## Verified Technology Versions

All versions verified via web search on 2026-06-19.

| Technology | Package | Version | Notes |
|---|---|---|---|
| Node.js | runtime | 22 LTS | Required minimum for all server apps |
| TypeScript | `typescript` | 5.4+ | Already in scaffold |
| React | `react` | 18.3 | Already in scaffold |
| Vite | `vite` | 5.0+ | Already in scaffold |
| PixiJS | `pixi.js` | 8.18+ | Host renderer |
| Colyseus | `colyseus` | 0.17.10 | Simulation server room framework |
| planck.js | `planck` | 1.5.0 | Deterministic 2D physics (`npm i planck`) |
| Hono | `hono` + `@hono/node-server` | 4.12.26 | Backend-platform HTTP framework |
| Howler.js | `howler` | 2.2.4 | Host audio (mature/stable) |
| pino | `pino` | 10.3.1 | Structured logging for Node.js apps |
| Redis client | `ioredis` | verify at install | Session cache + Colyseus presence adapter |
| PostgreSQL client | `pg` | verify at install | Durable player data |
| Vitest | `vitest` | 2.0+ | Already in scaffold |
| Context7 MCP | `@upstash/context7-mcp` | latest | AI documentation lookup |

### Backend Platform — HTTP Framework

**Hono v4.12.26** (`hono` + `@hono/node-server`)

Rationale: TypeScript-first, minimal surface area, runs on Node.js via adapter and on edge runtimes natively — aligns with Phase 5 cloud deployment without a framework swap. Express rejected (aging, no native TypeScript). Fastify rejected (heavier than needed for 2 route files).

```typescript
// backend-platform/src/index.ts
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { authRoutes } from './routes/auth.js';
import { playerRoutes } from './routes/player.js';

const app = new Hono();
app.route('/auth', authRoutes);
app.route('/player', playerRoutes);

serve({ fetch: app.fetch, port: 4000 });
```

### Testing Pattern

All apps use **Vitest** (already in scaffold). Three categories:

| Category | Location | What it tests |
|---|---|---|
| Unit | `packages/game-rules/` + `apps/simulation-server/tests/` | Pure functions: PRNG, FSM, bond logic, delta reducer |
| Contract | `tests/contract/` | Message shapes match between sim, host, and mobile |
| E2E | `tests/e2e/` | Full flows: join, run, reconnect |

**Unit test pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { createRng } from '../src/prng/xoshiro128.js';

describe('xoshiro128++', () => {
  it('produces identical sequences for the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    expect([rng1(), rng1(), rng1()]).toEqual([rng2(), rng2(), rng2()]);
  });
});
```

**Contract test pattern:**
```typescript
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol/serialize';

describe('SnapshotMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: SnapshotMsg = { type: 'snapshot', state: mockGameState() };
    expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
  });
});
```

---

## Architecture Validation

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision Compatibility | ✅ Pass | No conflicts between any of the 10 decisions |
| GDD Coverage | ✅ Pass | All 12 core systems have architecture support |
| Pattern Completeness | ✅ Pass | 4 novel + 3 standard patterns; testing pattern added |
| Epic Mapping | ✅ Pass | All E1–E10 epics map to specific files and systems |
| Document Completeness | ✅ Pass | 5 minor gaps identified and resolved |

### Coverage Report

**Systems covered:** 12/12
**Decisions made:** 10 (2 deferred with defaults and revisit conditions)
**Novel patterns designed:** 4
**Standard patterns defined:** 3
**Consistency rules with enforcement:** 6

### Gaps Resolved During Validation

| Gap | Resolution |
|---|---|
| Howler.js version unverified | v2.2.4 — verified, mature/stable |
| pino version unverified | v10.3.1 — verified |
| Node.js version unspecified | Node.js 22 LTS added |
| Backend HTTP framework undecided | Hono v4.12.26 selected |
| Testing pattern undocumented | Vitest unit + contract + E2E pattern added |

### Validation Date

2026-06-19

### Overall Status

**PASS** — Architecture document is complete and ready to guide implementation.

---

## Development Environment

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22 LTS | All server apps and build tooling |
| npm | bundled with Node 22 | Package management (migrated from pnpm) |
| Docker | latest stable | Local PostgreSQL + Redis in dev |
| VS Code (or JetBrains) | latest | TypeScript IntelliSense; Claude Code extension |

### AI Tooling — MCP Servers

| MCP Server | Purpose | Package |
|---|---|---|
| Context7 | Live documentation lookup for all libraries in this stack | `@upstash/context7-mcp` |

**Setup:**
```bash
# In claude code settings or mcp config
npx @upstash/context7-mcp
```

Context7 gives AI agents live access to PixiJS, Colyseus, planck.js, Hono, and Vitest documentation during implementation — reducing hallucinated APIs.

### Setup Commands

```bash
# Clone and install
git clone <repo>
cd party-delve
npm install

# Start local infrastructure (PostgreSQL + Redis)
docker compose up -d

# Dev servers (run in separate terminals)
npm run dev --workspace=apps/simulation-server
npm run dev --workspace=apps/host-client
npm run dev --workspace=apps/mobile-controller
npm run dev --workspace=apps/backend-platform
```

### First Steps After Setup

1. Delete all ad-hoc `src/` contents (clean slate) — see "Clean Slate Policy" in Implementation Patterns
2. Scaffold `packages/shared-types/` and `packages/net-protocol/` per Project Structure section
3. Configure Context7 MCP per AI Tooling above
4. Implement simulation server `onCreate` → tick loop → `onJoin` → `onMessage` pipeline first (all other apps depend on this contract)

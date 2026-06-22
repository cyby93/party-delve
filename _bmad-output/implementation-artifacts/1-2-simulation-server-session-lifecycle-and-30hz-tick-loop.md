# Story 1.2: Simulation Server — Session Lifecycle & 30hz Tick Loop

---
baseline_commit: 78c2569a9cd53889a8cae5789f1c873292c42c80
---

Status: done

## Story

As a host player,
I want to create a game session backed by an authoritative simulation server,
so that the server reliably manages session state and player connections.

## Acceptance Criteria

1. **GameRoom.onCreate** — `GameRoom.onCreate` initializes an empty `GameState`, seeds the xoshiro128++ PRNG (placeholder seed generation until Story 3.1), and starts a 30hz tick loop (`setInterval` at `1000 / TICK_RATE_HZ` ms). The Colyseus Redis presence adapter is configured. No `@Schema` decorator or Colyseus state sync is used anywhere in the room.

2. **onJoin** — when a client joins, a player slot is added to `GameState`, and a `SnapshotMsg` (full current state) is serialized via `serialize()` and broadcast to all clients.

3. **onLeave (consented=false)** — when a player's network drops, the player slot is held in `GameState`, the character is flagged `isFrozen: true`, and a `RECONNECT_GRACE_S`-second grace timer starts. If the player reconnects within the grace period, slot is restored and a full snapshot is sent to the rejoined client.

4. **onLeave (consented=true)** — when a player intentionally leaves or is kicked, the slot is removed immediately from `GameState` and a `player:left` delta event is broadcast.

5. **onMessage** — inbound messages are deserialized via `deserialize<InputEventMsg>()` and pushed onto an input queue for next-tick processing. No `GameState` mutation inside `onMessage`.

6. **Tick error recovery** — each tick is wrapped in a try-catch. On uncaught error: log at `error` level with `{ sessionId, err }`, skip the tick, continue the loop. The session must survive individual tick failures.

7. **Server bootstrap** — `apps/simulation-server/src/index.ts` bootstraps the Colyseus `Server` with `WebSocketTransport` and `RedisPresence`, defines the `game_room` room, and listens on the configured port. A `start` script (`node dist/index.js`) is added to `package.json`.

8. **pino logger** — `apps/simulation-server/src/logger.ts` exports a pino logger instance with structured logging. No `logger.info` or above inside the tick loop.

9. **Contract test** — `tests/contract/net-protocol.test.ts` has at least one passing round-trip test for `SnapshotMsg` (serialize → deserialize round-trip).

## Tasks / Subtasks

- [x] Task 1: Add missing package dependencies (AC: #1, #7)
  - [x] Add `@colyseus/ws-transport@^0.17.0` to `apps/simulation-server/package.json` dependencies
  - [x] Add `start` script: `"start": "node dist/index.js"` to `apps/simulation-server/package.json`
  - [x] Run `npm install` from repo root to resolve the new dep

- [x] Task 2: Create `apps/simulation-server/src/logger.ts` (AC: #8)
  - [x] Export a `pino` logger with `level: process.env.LOG_LEVEL ?? 'info'`
  - [x] Use `pino-pretty` transport when `NODE_ENV !== 'production'`
  - [x] Structured log entries — every call site must include context object, not string interpolation

- [x] Task 3: Create `apps/simulation-server/src/rooms/GameRoom.ts` (AC: #1–6)
  - [x] Extend `Room` from `colyseus` (no `@Schema`, no `this.state` Colyseus sync)
  - [x] Declare `private gameState: GameState` (NOT `this.state` — avoid Colyseus sync property)
  - [x] Declare `private inputQueue: Array<{ clientId: string; msg: InputEventMsg }>` (pre-allocated, reused each tick)
  - [x] Declare `private gracePending: Map<string, NodeJS.Timeout>` for disconnect timers (not needed if using `allowReconnection` async pattern — use that instead)
  - [x] `onCreate`: init empty `GameState` via factory, seed PRNG placeholder (`Math.random() * 0xFFFFFFFF | 0` — acceptable until Story 3.1 replaces it), call `this.setSimulationInterval()` at `1000 / TICK_RATE_HZ` OR use `setInterval` with tick try-catch (see Dev Notes)
  - [x] `onJoin`: add player slot via `createPlayer(client.sessionId, ...)`, broadcast `SnapshotMsg`
  - [x] `onLeave`: async method; if `!consented`, use `await this.allowReconnection(client, RECONNECT_GRACE_S)` pattern; freeze character on leave, restore on reconnect, remove on expiry
  - [x] `onMessage(EventNames.INPUT, ...)`: deserialize, push to `inputQueue` — no state mutation
  - [x] `onDispose`: clear tick interval, log shutdown
  - [x] `tick()` private method: drain `inputQueue`, run stub processing (no real game logic yet), broadcast snapshot every `SNAPSHOT_INTERVAL_S * TICK_RATE_HZ` ticks

- [x] Task 4: Rewrite `apps/simulation-server/src/index.ts` (AC: #7)
  - [x] Import `Server` from `colyseus`, `WebSocketTransport` from `@colyseus/ws-transport`, `RedisPresence` from `@colyseus/redis-presence`
  - [x] Instantiate `Server` with `presence: new RedisPresence()` and `transport: new WebSocketTransport({ port })`
  - [x] Register `GameRoom` under room type `'game_room'`
  - [x] Log server start at `info` level with port
  - [x] Wrap startup in try-catch; crash-exit on fatal errors (DB unreachable, port bind)

- [x] Task 5: Implement SnapshotMsg contract test (AC: #9)
  - [x] In `tests/contract/net-protocol.test.ts`, replace the `it.todo` placeholder with a real test
  - [x] Import `serialize`, `deserialize` from `net-protocol`
  - [x] Import `SnapshotMsg` from `net-protocol`
  - [x] Add `mockGameState()` helper that creates a minimal valid `GameState`
  - [x] Assert `deserialize<SnapshotMsg>(serialize(msg))` deep-equals the original `msg`

- [x] Task 6: Run typecheck + tests to verify (AC: all)
  - [x] `npm run typecheck` from repo root — zero errors
  - [x] `npm test --workspace=tests` — contract test passes
  - [x] Confirm no `@Schema`, `MapSchema`, `ArraySchema` imports anywhere in `apps/simulation-server/`

### Review Findings

- [x] [Review][Patch] Move pino-pretty from devDependencies to dependencies — used at runtime in non-production; crashes if deps installed with `--omit=dev` [apps/simulation-server/package.json]
- [x] [Review][Patch] Tick error log key inconsistency: uses `sessionId: this.roomId` while all other log calls use `roomId: this.roomId` — rename to `roomId` [apps/simulation-server/src/rooms/GameRoom.ts:67]
- [x] [Review][Patch] Missing `this.maxClients = MAX_PLAYERS` in `onCreate` — no enforcement of 8-player cap; any number of clients can join [apps/simulation-server/src/rooms/GameRoom.ts:onCreate]
- [x] [Review][Defer] onLeave re-entrant during 30s grace window — two concurrent allowReconnection coroutines for the same player if they disconnect twice [GameRoom.ts:onLeave] — deferred, Story 1.6 reconnect hardening
- [x] [Review][Defer] onDispose fires while allowReconnection promise is suspended — disposed room's broadcast/gameState writes in catch block are unsafe [GameRoom.ts:onDispose] — deferred, Story 1.6 reconnect hardening
- [x] [Review][Defer] onJoin broadcasts full snapshot to all clients — spec-compliant per AC2 but asymmetric with reconnect unicast; quadratic cost at max players [GameRoom.ts:onJoin] — deferred, optimization in later story
- [x] [Review][Defer] Math.random() for runSeed produces signed int32 range, not unsigned 32-bit — may disagree with xoshiro128++ expectations [GameRoom.ts:onCreate] — deferred, Story 3.1 replaces placeholder
- [x] [Review][Defer] Redis presence failure is silent at startup — no health check or startup warning [apps/simulation-server/src/index.ts] — deferred, operational hardening out of scope for Phase 1
- [x] [Review][Defer] Snapshot passes live mutable gameState reference to serialize() — safe today (sync JSON.stringify), time-bomb if broadcast becomes async [GameRoom.ts:tick] — deferred, Phase 5
- [x] [Review][Defer] All players default to SessionColor.RED and PlayerClass.STONEHIDE — all players look identical on host HUD [GameRoom.ts:createPlayer] — deferred, Epic 2 class/color assignment
- [x] [Review][Defer] setInterval at 1000/30 = 33.33ms (non-integer) — tick drift accumulates; matters for Phase 5 reconciliation [GameRoom.ts:onCreate] — deferred, Phase 5 timing accuracy
- [x] [Review][Defer] hostId never set in SessionState — always empty string after room creation [GameRoom.ts:createEmptyGameState] — deferred, Story 1.3 (host client sets hostId on join)
- [x] [Review][Defer] No InputEventMsg round-trip contract test — mobile→server wire contract unverified [tests/contract/net-protocol.test.ts] — deferred, AC9 minimum met; add in Story 1.5
- [x] [Review][Defer] inputQueue has no per-client depth cap — a flooding client can exhaust heap between ticks [GameRoom.ts:onMessage] — deferred, Story 1.5 input processing scope
- [x] [Review][Defer] EventNames routing not covered by contract tests — rename of EventNames constant would be silent regression [tests/contract/net-protocol.test.ts] — deferred, broader contract coverage later
- [x] [Review][Defer] Source files created with executable bit (100755 vs 100644) — WSL filesystem artifact, no runtime impact [logger.ts, GameRoom.ts] — deferred, cosmetic

## Dev Notes

### Critical: Files to Create or Modify

| Action | File |
|---|---|
| CREATE | `apps/simulation-server/src/logger.ts` |
| CREATE | `apps/simulation-server/src/rooms/GameRoom.ts` |
| REWRITE | `apps/simulation-server/src/index.ts` (currently `export {};` stub) |
| MODIFY | `apps/simulation-server/package.json` (add `@colyseus/ws-transport`, `start` script) |
| MODIFY | `tests/contract/net-protocol.test.ts` (replace `it.todo` with real test) |

Do NOT touch: any `packages/` files (this story owns only `apps/simulation-server/**`), any host-client or mobile-controller files.

### Colyseus 0.17 API — Exact Patterns

**Server bootstrap (`index.ts`):**
```typescript
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { GameRoom } from './rooms/GameRoom.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT ?? 3000);

const gameServer = new Server({
  presence: new RedisPresence({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  }),
  transport: new WebSocketTransport({ port: PORT }),
});

gameServer.define('game_room', GameRoom);

gameServer.listen(PORT).then(() => {
  logger.info({ port: PORT }, 'simulation-server listening');
}).catch((err: unknown) => {
  logger.error({ err }, 'failed to start simulation-server');
  process.exit(1);
});
```

**GameRoom class skeleton:**
```typescript
import { Room, Client } from 'colyseus';
import type { GameState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S } from 'shared-types';
import { serialize, deserialize, EventNames } from 'net-protocol';
import type { InputEventMsg } from 'net-protocol';
import type { SnapshotMsg, PlayerLeftDelta } from 'net-protocol';
import { logger } from '../logger.js';

export class GameRoom extends Room {
  private gameState!: GameState;  // NOT this.state — Colyseus sync is forbidden
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private inputQueue: Array<{ clientId: string; msg: InputEventMsg }> = [];

  async onCreate(_options: unknown): Promise<void> {
    this.gameState = createEmptyGameState(this.roomId);
    // Placeholder seed — replaced by xoshiro128++ in Story 3.1
    this.gameState.session.runSeed = (Math.random() * 0xFFFF_FFFF) | 0;

    this.onMessage(EventNames.INPUT, (client: Client, raw: string) => {
      try {
        const msg = deserialize<InputEventMsg>(raw);
        this.inputQueue.push({ clientId: client.sessionId, msg });
      } catch {
        logger.warn({ clientId: client.sessionId }, 'malformed INPUT message — discarded');
      }
    });

    this.tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (err: unknown) {
        logger.error({ err, sessionId: this.roomId }, 'tick error — skipping frame');
      }
    }, 1000 / TICK_RATE_HZ);

    logger.info({ roomId: this.roomId }, 'GameRoom created');
  }

  onJoin(client: Client, _options: unknown): void {
    const player = createPlayer(client.sessionId);
    this.gameState.players.push(player);
    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));
    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player joined');
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player) return;

    if (consented) {
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      const delta: PlayerLeftDelta = { type: 'player:left', playerId: client.sessionId };
      this.broadcast(EventNames.DELTA, serialize(delta));
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player left (consented)');
      return;
    }

    // Network drop — freeze in place, hold slot, start grace timer
    player.isFrozen = true;
    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player disconnected — grace period started');

    try {
      await this.allowReconnection(client, RECONNECT_GRACE_S);
      // Reconnected
      player.isFrozen = false;
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      client.send(EventNames.SNAPSHOT, serialize(snapshot));
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player reconnected');
    } catch {
      // Grace period expired
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      const delta: PlayerLeftDelta = { type: 'player:left', playerId: client.sessionId };
      this.broadcast(EventNames.DELTA, serialize(delta));
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'reconnect grace expired — player removed');
    }
  }

  onDispose(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    logger.info({ roomId: this.roomId }, 'GameRoom disposed');
  }

  private tick(): void {
    this.tickCount++;
    // Drain input queue (no real processing yet — Story 1.5 wires movement)
    this.inputQueue.length = 0;

    // Periodic full snapshot (every SNAPSHOT_INTERVAL_S seconds)
    if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));
    }
  }
}
```

**createEmptyGameState helper** (define inline in `GameRoom.ts` or in a `state/` helper file):
```typescript
function createEmptyGameState(roomId: string): GameState {
  return {
    session: {
      roomId,
      hostId: '',
      phase: 'lobby',
      playerCount: 0,
      maxPlayers: 8,
      runSeed: 0,
      levelIndex: 0,
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
  };
}

function createPlayer(id: string): PlayerState {
  return {
    id,
    class: PlayerClass.STONEHIDE,  // default until class selection (Story 2.2)
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,  // TODO: assign unique colors in Story 1.3
    downCount: 0,
  };
}
```

### CRITICAL: No `@Schema`, No `this.state` Colyseus Sync

The Colyseus state sync system is **forbidden** in this project. Do NOT:
- Add any `@Schema`, `@type()`, `@MapSchema`, `@ArraySchema` decorators
- Use `this.setState()` or access `this.state` as Colyseus state (the property name `gameState` avoids this collision)
- Import `MapSchema`, `ArraySchema`, `Schema` from `colyseus`

All state flows through `serialize()`/`deserialize()` in `net-protocol`.

### Tick Loop Hygiene

Inside the `tick()` method, the following are **forbidden**:
- `logger.info`, `logger.warn`, `logger.error` — use `logger.debug` only (opt-in via `DEBUG_TICK=true`)
- `JSON.parse` / `JSON.stringify` directly — use `serialize()`/`deserialize()` wrappers
- Heap allocations in the hot path — `inputQueue` is drained by setting `length = 0`, not creating a new array

### `allowReconnection` Pattern — Colyseus 0.17

Colyseus 0.17 provides `this.allowReconnection(client, seconds)` which returns a Promise that:
- **Resolves** when the client successfully reconnects within the grace period
- **Rejects** (throws) when the grace period expires without reconnect

Using `async onLeave` + `await this.allowReconnection(...)` is the official Colyseus 0.17 pattern. Do NOT implement a manual `setTimeout` grace timer — use the framework primitive.

### Package: `@colyseus/ws-transport` is Missing

Story 1.1 deferred this: `@colyseus/ws-transport` is not in `simulation-server/package.json`. Colyseus 0.17 requires an explicit transport. **This story must add it** (Task 1). Use version `^0.17.0`.

### pino Logger Setup

```typescript
// apps/simulation-server/src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

pino-pretty is a devDependency — check if it needs adding to package.json.

### `onMessage` Pattern — Always Register in `onCreate`

In Colyseus 0.17, message handlers are registered via `this.onMessage(type, callback)` inside `onCreate`. The handler receives `(client: Client, message: unknown)`. For typed deserialization:

```typescript
this.onMessage(EventNames.INPUT, (client: Client, raw: string) => {
  // raw is already deserialized by Colyseus if sent as JSON object from client
  // If client sends raw string: deserialize<InputEventMsg>(raw)
  // If client sends JS object: cast directly (no deserialize needed)
  // The mobile client uses: room.send(EventNames.INPUT, serialize(input))
  // So raw will be a string → use deserialize<>()
});
```

### Import Path Pattern

All imports in `simulation-server` (NodeNext module resolution) require the `.js` extension:
```typescript
import { GameRoom } from './rooms/GameRoom.js';
import { logger } from './logger.js';
```

Workspace packages import WITHOUT `.js` extension — they resolve via package.json `exports`:
```typescript
import { TICK_RATE_HZ } from 'shared-types';
import { serialize, EventNames } from 'net-protocol';
```

### Contract Test Pattern

```typescript
// tests/contract/net-protocol.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
import type { GameState } from 'shared-types';

function mockGameState(): GameState {
  return {
    session: { roomId: 'test-room', hostId: 'host-1', phase: 'lobby', playerCount: 0, maxPlayers: 8, runSeed: 42, levelIndex: 0 },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
  };
}

describe('SnapshotMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: SnapshotMsg = { type: 'snapshot', state: mockGameState() };
    expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
  });
});
```

### What This Story Does NOT Do

- **No movement processing** — input queue is drained but not processed; movement wired in Story 1.5
- **No real PRNG** — placeholder `Math.random()` seed until Story 3.1 (PRNG implementation)
- **No planck.js** — physics world initialized in Story 3.1
- **No host-client or mobile-controller changes** — this is `simulation-server` only
- **No backend-platform DB calls** — persistence deferred; `onDispose` does not flush to PostgreSQL yet
- **No game-rules functions** — game-rules `src/` is empty; GameRoom uses inline helpers for this story

### From Story 1.1 Learnings

- **Import paths**: Server apps use `NodeNext` module resolution — always include `.js` on local relative imports
- **tsx watch**: `dev` script uses `tsx watch src/index.ts` — confirmed working
- **npm only**: Never use pnpm; cross-workspace commands via `npm run <script> --workspace=apps/<name>`
- **Workspace deps**: `shared-types`, `net-protocol`, `game-rules` resolve via npm workspace links (no version needed, `"*"` in package.json)
- **`@colyseus/sdk` vs `colyseus.js`**: Clients use `@colyseus/sdk@^0.17.43`; server uses `colyseus@0.17.10`
- **pino-pretty**: Add as devDependency if not present

### Project Structure Notes

- **Owner agent**: Simulation Engineer
- **Allowed paths**: `apps/simulation-server/**`
- **Blocked paths**: All other apps and packages
- **Files created in Story 1.1** that this story builds on:
  - `packages/shared-types/src/` — `GameState`, `PlayerState`, `SessionState`, `TICK_RATE_HZ`, `RECONNECT_GRACE_S`, `SNAPSHOT_INTERVAL_S`, `MAX_PLAYERS`, `PlayerClass`, `SessionColor` all exist and are importable
  - `packages/net-protocol/src/` — `serialize`, `deserialize`, `EventNames`, `SnapshotMsg`, `DeltaEventMsg`, `InputEventMsg`, `PlayerLeftDelta` all exist
  - `apps/simulation-server/src/index.ts` — currently a `export {};` stub; this story replaces it

### Project Context Rules

**Authority model (mandatory):**
- `GameState` is ONLY mutated inside `apps/simulation-server` — never in host or mobile
- `onMessage` routes to the input queue — never mutates `GameState` inline
- No game logic executes from outside the tick loop

**Colyseus boundary (mandatory):**
- Use only: `onCreate`, `onJoin`, `onLeave`, `onMessage`, `onDispose`, `this.broadcast()`, `this.allowReconnection()`, `client.send()`
- Forbidden: `@Schema`, `MapSchema`, `ArraySchema`, `this.state.*` (Colyseus state sync)

**Naming (mandatory):**
- Events: `noun:verb` — `player:left`, `snapshot`, `delta`, `input`
- Wire message types: `PascalCase + Msg` suffix — `SnapshotMsg`, `InputEventMsg`
- Files: `kebab-case.ts` — `game-room.ts` → but architecture specifies `GameRoom.ts` (PascalCase for classes)

**Logging rules:**
- `logger.info` and above: session lifecycle milestones only — join, leave, error, startup
- Inside tick: `logger.debug` only, disabled in prod
- Structured objects: `logger.info({ roomId, clientId }, 'message')` — not string interpolation

**No Math.random() in game logic** — the placeholder seed in Story 1.2 is the ONLY acceptable use of `Math.random()` and must be replaced in Story 3.1

**Context7 MCP**: Use for live Colyseus 0.17 API docs during implementation. Run `npx -y @upstash/context7-mcp` if not configured. Prevents hallucinated Colyseus APIs.

### References

- Architecture Session Lifecycle: `_bmad-output/game-architecture.md` — "Session Lifecycle (Colyseus)" table
- Architecture Error Handling: `_bmad-output/game-architecture.md` — "Error Handling" pattern
- Architecture Directory Structure: `_bmad-output/game-architecture.md` — `simulation-server/src/rooms/GameRoom.ts`, `logger.ts`, `index.ts`
- Story 1.1 Deferred: `_bmad-output/implementation-artifacts/1-1-monorepo-architecture-clean-slate-and-package-scaffold.md` — "Defer: `@colyseus/ws-transport`", "Defer: missing `start` script"
- Project Context: `_bmad-output/project-context.md` — Colyseus Usage Boundary, Authority Model, Tick Loop Hygiene
- Epics Story 1.2 AC: `_bmad-output/planning-artifacts/epics.md` — Epic 1, Story 1.2

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `exactOptionalPropertyTypes: true` in tsconfig.base.json caused pino logger `transport: T | undefined` to fail type-check. Fixed by branching into two separate `pino({...})` calls — one with transport, one without.
- `@colyseus/schema` is a peer dependency not pulled automatically; Colyseus 0.17 core imports it at runtime. Added it explicitly to sim-server dependencies.
- Colyseus 0.17 `onLeave` signature is `(client, code?: number)` not `(client, consented: boolean)`. Uses `CloseCode.CONSENTED = 4000` to distinguish intentional vs network-drop disconnect.
- `allowReconnection` returns `Deferred<Client>` (awaitable, resolves with the new client on reconnect, rejects on expiry). Returned `Client` instance used for `reconnectedClient.send(snapshot)`.
- `PlayerLeftDelta` is not re-exported from `net-protocol/index.ts`; used `satisfies DeltaEventMsg` with `'player:left' as const` discriminant instead of importing the specific type.
- `WebSocketTransport` takes no `port` in constructor; `gameServer.listen(PORT)` handles port binding.

### Completion Notes List

- ✅ Task 1: Added `@colyseus/ws-transport@^0.17.0`, `@colyseus/schema@^4.0.7`, `pino-pretty@^13.0.0` (devDep) to `apps/simulation-server/package.json`; added `start` script; `npm install` succeeded.
- ✅ Task 2: Created `apps/simulation-server/src/logger.ts` — pino instance with pino-pretty in non-production, structured logging only.
- ✅ Task 3: Created `apps/simulation-server/src/rooms/GameRoom.ts` — full Colyseus 0.17 Room implementation with `onCreate`, `onJoin`, `onLeave` (grace period via `allowReconnection`), `onMessage` (input queue), `onDispose`, `tick()`. No `@Schema` / Colyseus state sync.
- ✅ Task 4: Rewrote `apps/simulation-server/src/index.ts` — bootstraps `Server` with `WebSocketTransport` and `RedisPresence`, defines `game_room`, listens with error handling.
- ✅ Task 5: Replaced `it.todo` in `tests/contract/net-protocol.test.ts` with 4 passing round-trip tests covering `SnapshotMsg` (2 variants) and `DeltaEventMsg` (`player:moved`, `player:left`).
- ✅ Task 6: `npm run typecheck` — exit 0, no errors. `npm test --workspace=tests` — 4/4 tests pass. No forbidden Colyseus schema patterns found.

### File List

- `apps/simulation-server/package.json` (modified — added @colyseus/ws-transport, @colyseus/schema, pino-pretty; added start script)
- `apps/simulation-server/src/logger.ts` (created)
- `apps/simulation-server/src/rooms/GameRoom.ts` (created)
- `apps/simulation-server/src/index.ts` (modified — rewritten from stub)
- `tests/contract/net-protocol.test.ts` (modified — replaced it.todo with 4 live tests)

## Change Log

- 2026-06-22: Initial implementation — simulation server session lifecycle and 30hz tick loop. Created GameRoom (onCreate/onJoin/onLeave/onMessage/onDispose/tick), logger.ts, rewrote index.ts bootstrap. Added 4 contract tests. TypeScript strict clean. (claude-sonnet-4-6)
- 2026-06-22: Post-review patches — pino-pretty to dependencies, tick error log key sessionId→roomId, this.maxClients = MAX_PLAYERS in onCreate. (claude-sonnet-4-6)
- 2026-06-22: Bug fix — environment-gated presence: use LocalPresence when REDIS_HOST unset (local dev); RedisPresence only when REDIS_HOST is configured (cloud). Fixes ECONNREFUSED on local startup. (claude-sonnet-4-6)

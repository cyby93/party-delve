---
project_name: 'party-delve'
user_name: 'Cyby'
date: '2026-06-19'
sections_completed: ['technology_stack', 'engine_specific_rules', 'performance_rules', 'code_organization_rules', 'testing_rules', 'platform_build_rules', 'critical_dont_miss_rules']
status: 'complete'
---

# Project Context for AI Agents

_Critical rules and patterns AI agents must follow when implementing Party Delve. Focus on unobvious details — well-known language/framework basics are omitted._

---

## Technology Stack & Versions

| Package | Version | Notes |
|---|---|---|
| Node.js | 22 LTS | Minimum for all server apps |
| TypeScript | 5.4+ | Strict mode enabled |
| React | 18.3 | Host UI shell only — not used in game logic |
| Vite | 5.0+ | Build tooling |
| Colyseus | 0.17.10 | `colyseus` package |
| planck.js | 1.5.0 | `planck` package (`npm i planck`) |
| PixiJS | 8.18+ | `pixi.js` — host renderer only |
| Hono | 4.12.26 | `hono` + `@hono/node-server` |
| Howler.js | 2.2.4 | `howler` — host audio only |
| pino | 10.3.1 | Structured JSON logging |
| Vitest | 2.0+ | All test categories |

---

## Engine-Specific Rules

### Authority Model — Split-Surface

The simulation server (`apps/simulation-server`) is the **sole game authority**. Host and mobile are pure clients — they render and send input only.

- **Allowed in sim server:** mutation of `GameState`, tick loop, physics, AI, collision, combat, run logic
- **Forbidden in host client:** any `GameState` mutation; reading raw physics bodies; game rule checks
- **Forbidden in mobile controller:** any `GameState` mutation; sending state — only typed input events

### Colyseus Usage Boundary

Colyseus is used for **room lifecycle and message routing only**.

- **Use:** `onCreate`, `onJoin`, `onLeave`, `onMessage`, `onDispose`, `this.broadcast()`
- **Forbidden:** `@Schema`, `MapSchema`, `ArraySchema`, `this.state.*` — never use Colyseus state sync
- All game state flows through explicit typed event contracts in `packages/net-protocol`

### Colyseus Room Lifecycle Contract

```
onCreate  → init GameState, seed xoshiro128++ PRNG, start 30hz tick loop
onJoin    → add player slot, broadcast full snapshot
onLeave(consented=false) → hold slot, freeze character, start 30s grace timer
onLeave(consented=true)  → remove player slot immediately
onMessage → route typed message to sim input queue (never mutate state inline)
onDispose → flush Redis to PostgreSQL, release room
```

### Event Contract Discipline

All cross-surface communication flows through `packages/net-protocol`.

- **Phones send:** typed input events only (joystick vector, skill tap with direction)
- **Sim broadcasts:** typed delta events (`player:moved`, `enemy:killed`, `bond:assigned`, …)
- **Host applies:** `applyDelta(mirrorState, evt)` then `renderFrame(mirrorState)`
- **Never:** ad-hoc `JSON.stringify` of partial state, raw property access across surface boundary

### Serialization

- Phase 1–4: `serialize()`/`deserialize()` wrappers in `packages/net-protocol` (JSON under the hood)
- **Do not** call `JSON.stringify`/`JSON.parse` directly in app code — always use the wrappers
- Phase 5: swap wrappers to MessagePack — no app code changes required if wrappers are used

---

## Performance Rules

### Tick Loop Hygiene (30hz — 33ms budget)

The sim server runs a 30hz authoritative tick loop. This is the hottest path in the codebase.

- **Forbidden inside the tick:** `logger.info`, `logger.warn`, `logger.error` — use `logger.debug` (opt-in only, disabled in prod)
- **Forbidden inside the tick:** heap allocations in hot paths — pre-allocate arrays and reuse
- **Forbidden inside the tick:** `JSON.parse` / `JSON.stringify` — all serialization happens at message boundary
- Tick duration must stay well under 33ms; profile before optimizing, never guess

### PRNG — No Math.random() in Game Logic

All randomness in `packages/game-rules` and `apps/simulation-server` must use `xoshiro128++`.

```typescript
// Correct — one factory per generation system, seeded from run seed
const roomRng = createRng(runSeed ^ OFFSET_ROOM_LAYOUT);
const enemyRng = createRng(runSeed ^ OFFSET_ENEMY_SPAWN);

// Forbidden — breaks determinism
Math.random();
```

`Math.random()` is only permitted in non-simulation code (host UI animations, cosmetic effects).

### planck.js Physics

- Maintain a single meter-to-pixel scale constant; never mix planck units with pixel coordinates
- Always construct `Vec2` — never destructure to `{x, y}` and pass back in
- Run physics step only inside the sim server tick loop — never from host or mobile
- Spirit Bond proximity detection uses planck sensors (`isSensor: true`) — do not poll distance manually

### PixiJS Host Renderer

- Call `renderFrame(mirrorState)` once per tick with a snapshot reference — do not read `mirrorState` properties inside individual display object updates
- Use `Assets.backgroundLoad()` for non-critical bundles during hub scene — never block the render loop on asset loads
- No game logic, cooldown tracking, or collision checks inside any PixiJS display object

### Logging — pino

- `logger.info` and above: startup, shutdown, join, leave, errors only — never per-tick events
- `logger.debug`: the only level permitted inside hot loops; disabled in production
- Log structured objects: `logger.info({ playerId, roomId }, 'player joined')` — not string interpolation

---

## Code Organization Rules

### Monorepo Ownership — Strict Per Agent Role

Agents must not write outside their ownership area without explicit cross-context approval.

| Role | Allowed paths | Blocked paths |
|---|---|---|
| Protocol Architect | `packages/shared-types/**`, `packages/net-protocol/**`, `docs/adr/**`, `docs/specs/**` | Everything else |
| Simulation Engineer | `apps/simulation-server/**`, `packages/game-rules/**` | Host, mobile, backend-platform |
| Host Experience Engineer | `apps/host-client/**`, host UI in `packages/ui-kit/**` | Sim server, game-rules, mobile |
| Mobile Controller Engineer | `apps/mobile-controller/**`, mobile UI in `packages/ui-kit/**` | Sim server, game-rules, host |
| QA + Telemetry Engineer | `tests/**`, `tools/**`, `packages/telemetry/**`, CI config | `apps/**`, `packages/game-rules/**` |

### Package Responsibility Boundaries

- `packages/shared-types` — TypeScript interfaces, enums, constants; **no runtime logic**
- `packages/net-protocol` — serialize/deserialize wrappers, `applyDelta` reducer, message type guards; **no game rules**
- `packages/game-rules` — pure functions only; **no I/O, no Colyseus imports, no planck.js imports**
- `apps/simulation-server` — orchestrates game-rules + planck.js + Colyseus room; sole owner of `GameState` mutation

### Clean Slate Policy

All ad-hoc `src/` contents in `apps/*/` and `packages/*/` must be deleted before Phase 2 implementation begins. Do not migrate existing ad-hoc files — start from the architecture document.

### Naming Conventions

- **Events:** `noun:verb` — `player:moved`, `enemy:killed`, `bond:assigned`, `room:snapshot`
- **Files:** kebab-case — `xoshiro128.ts`, `apply-delta.ts`, `game-room.ts`
- **Wire message types:** PascalCase + `Msg` suffix — `SnapshotMsg`, `InputMsg`, `DeltaEventMsg`
- **Constants:** SCREAMING_SNAKE_CASE in `packages/shared-types/constants.ts` — `TICK_RATE_HZ`, `GRACE_PERIOD_MS`
- **PRNG offsets:** `OFFSET_` prefix — `OFFSET_ROOM_LAYOUT`, `OFFSET_ENEMY_SPAWN`

### Configuration Hierarchy

Do not hard-code values that belong in a higher tier:

1. `packages/shared-types/constants.ts` — cross-package constants (`TICK_RATE_HZ = 30`, `MAX_PLAYERS = 8`)
2. `packages/game-rules/balance.ts` — tunable gameplay values (cooldowns, damage, bond prices)
3. `.env` files — environment-specific (ports, DB URLs, Redis URLs)

---

## Testing Rules

### Three Test Categories — Strict Placement

| Category | Location | What it covers |
|---|---|---|
| Unit | `packages/game-rules/tests/`, `apps/simulation-server/tests/` | Pure functions: PRNG, FSM, bond logic, delta reducer |
| Contract | `tests/contract/` | Message shapes round-trip between sim, host, and mobile |
| E2E | `tests/e2e/` | Full flows: join, run, reconnect, disconnect grace |

### Unit Tests — Pure Functions Only

Game-rules functions must be testable with zero imports from Colyseus or planck.js. Test PRNG determinism: same seed must produce identical sequence across two independent instances.

```typescript
import { createRng } from '../src/prng/xoshiro128.js';
describe('xoshiro128++', () => {
  it('produces identical sequences for the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    expect([rng1(), rng1(), rng1()]).toEqual([rng2(), rng2(), rng2()]);
  });
});
```

### Contract Tests — Round-Trip Serialization

Every wire message type in `packages/net-protocol` must have a serialize → deserialize round-trip test.

```typescript
describe('SnapshotMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: SnapshotMsg = { type: 'snapshot', state: mockGameState() };
    expect(deserialize<SnapshotMsg>(serialize(msg))).toEqual(msg);
  });
});
```

### No Database Mocks in Integration Tests

Do not mock PostgreSQL or Redis — connect to real local instances (Docker Compose provides them). Mock-passing tests that fail against real infrastructure are worse than no tests.

### Contract-Change Hook

Any change to `packages/shared-types/**` or `packages/net-protocol/**` requires:
- Protocol Architect review
- At least one new or updated contract test
- Spec or ADR update if the change is additive

---

## Platform & Build Rules

### Surface Targets

| Surface | Platform | Input | Audio |
|---|---|---|---|
| Host client | Web browser (shared screen, TV/monitor) | Display only | Howler.js |
| Mobile controller | Mobile web browser (phone) | Touch only | None |
| Simulation server | Node.js 22 LTS | N/A | None |
| Backend platform | Node.js 22 LTS (Hono) | N/A | None |

### PC / Keyboard Input

Permanently out of scope — phones are the only controllers by design. Do not add keyboard input handling to host or mobile, even as a dev shortcut.

### Mobile Controller Constraints

- Touch targets minimum 44×44px
- UI stays minimal: left half = movement joystick, right half = 2×2 ability grid (standardized across all classes — only cell contents differ)
- No audio dependency on mobile — Howler.js is host-only
- The phone is a controller, not a game screen — players watch the host screen

### Host Screen Constraints

- Designed for couch distance (2–4m from TV) — minimum readable font size 24px at 1080p
- Host has no input device — display-only; all interaction flows from mobile controllers

### Build & Package Management

- Package manager: **npm** (migrated from pnpm — do not use pnpm commands)
- Cross-workspace: `npm run <script> --workspace=apps/<name>`
- TypeScript strict mode required in all packages — no `any` without explicit suppression comment
- Vite builds host-client and mobile-controller; esbuild/tsc for server packages

### Environment Variables

Each app has its own `.env` file. Never read `.env` from a sibling app. Shared values belong in `packages/shared-types/constants.ts`.

---

## Critical Don't-Miss Rules

### Authority Violations (Most Common Agent Mistake)

| Anti-pattern | Why it's wrong | Correct approach |
|---|---|---|
| Host client reads physics body positions directly | Breaks split-surface authority | Host reads only `mirrorState` built from `applyDelta` |
| Mobile sends current player position to sim | Phones send input events, not state | Mobile sends `InputMsg` (joystick vector, skill tap) only |
| Game rule check inside Colyseus `onMessage` | Business logic must live in game-rules | Route to sim input queue; process in tick |
| `@Schema` decorator on any class | Colyseus state sync is forbidden | Use explicit `DeltaEventMsg` + `SnapshotMsg` |

### Disconnected Player Handling

When `onLeave(consented=false)` fires:
- Hold the player's slot — do NOT remove it
- Freeze character in place (idle, no movement, no AI control)
- Start 30-second grace timer
- Reconnect within 30s → restore slot, send snapshot, resume
- Grace timer expires → remove slot, broadcast `player:left` delta

**Do not** put disconnected players into spirit form — that is the permanent-death state, not the disconnect state.

### Simulation Safety

- Never call `tick()` or `stepWorld()` from host or mobile code
- Never import `packages/game-rules` in `apps/host-client` or `apps/mobile-controller`
- Never import planck.js outside `apps/simulation-server`
- Treat `GameState` as read-only outside the sim server

### Result<T, E> — Never Throw from Game Rules

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Correct
function applySkill(state: GameState, input: SkillInput): Result<DeltaEvent[], SkillError> { … }

// Forbidden — crashes the tick loop
throw new Error('invalid skill');
```

Always return `Result` from game-rules functions. Never throw.

### Spirit Bond System

- Proximity detection uses planck sensors (`isSensor: true`) — do not poll distance in the tick
- Bond assignment happens at level transition, not during combat
- 3 bonds accumulate over 3 levels — never reset between levels, only between runs
- Each bond is a `{buff, price}` pair — never buff-only or price-only

### Typed EventEmitter — Internal Sim Communication

Internal sim communication uses a typed `SimEvents` interface with `noun:verb` event names. Always type the emitter against `SimEvents` — never use raw string event names with a bare `EventEmitter`.

---

## Usage Guidelines

**For AI Agents:** Read this file before implementing any game code. Follow all rules exactly. When in doubt, prefer the more restrictive option. If you discover a new invariant worth documenting, surface it for human review rather than adding it yourself.

**For Humans:** Keep this file lean and focused on agent needs. Update when the technology stack changes. Remove rules that become obvious over time.

_Last updated: 2026-06-19_

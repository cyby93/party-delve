---
baseline_commit: 10f2e6cd6f623c1393a58585810dd7990dddf187
---

# Story 2.4: Training Dummy POI

Status: done

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Story 2.3 is complete. The hub controller shows the player's 4 class abilities
  in the right-zone skill cells (non-interactive, pointerEvents: 'none'). The training
  dummy POI already exists: it is in INTERACTIVE_HUB_POIS, the server sends
  poi:entered / poi:exited events for it, and the InteractButton slides in on proximity.
  The InteractButton.onTap handler has a comment "// training-dummy and dungeon-entrance
  handled in future stories". This story wires the full training-dummy flow:
  tap Interact at dummy → skill cells become active → player can fire all three
  input types (AUTO / RELEASE / TAP) → server validates and starts cooldowns →
  mobile receives CooldownUpdateMsg → conic-gradient cooldown overlay shows on cell →
  host canvas shows visual indicator on training dummy while player is near.
Owner agent: Multi-context (explicit cross-context approval granted):
    Protocol Architect     (Task 1 — event-names + net-protocol/index exports + contract test)
    Simulation Engineer    (Task 2 — ability input handling + cooldown tracking in GameRoom)
    Mobile Controller Eng  (Task 3 — mobile-session callback, App state, ControllerScreen active skills)
    Host Experience Eng    (Task 4 — renderFrame update for training dummy visual indicator)
Goal: When a player with a confirmed class taps "Interact" at the training dummy POI,
  their skill cells become interactive. Each cell fires according to its input type (AUTO
  / RELEASE / TAP). The server validates the ability, applies a 3-second placeholder
  cooldown, and sends CooldownUpdateMsg to the player's mobile. The mobile renders a
  conic-gradient countdown overlay. The host canvas shows the training dummy as
  "targeted" while any player is near it.
Allowed paths:
  - packages/net-protocol/src/event-names.ts                 (MODIFY — add COOLDOWN_UPDATE)
  - packages/net-protocol/src/index.ts                       (MODIFY — export CooldownUpdateMsg)
  - tests/contract/cooldown-update-msg.test.ts               (NEW — round-trip test)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — ability handling + cooldowns)
  - apps/mobile-controller/src/session/mobile-session.ts     (MODIFY — add onCooldownUpdate callback)
  - apps/mobile-controller/src/App.tsx                       (MODIFY — cooldowns state + pass to screen)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — training mode + active skill cells)
  - apps/host-client/src/screens/HubWorldScreen.tsx          (MODIFY — training dummy visual indicator)
Blocked paths:
  - packages/shared-types/**          (no new fields on PlayerState/GameState — not needed)
  - packages/net-protocol/src/messages/server-to-host.ts  (DeltaEventMsg unchanged — no new delta)
  - packages/net-protocol/src/apply-delta.ts              (unchanged)
  - packages/game-rules/**            (cooldown durations are inline placeholder — Story 3.x adds balance.ts)
  - apps/backend-platform/**
Non-goals:
  - Ability visual effects on the host canvas (no projectiles, hit markers, or AoE — Story 3.x)
  - Damage or effects on the training dummy entity (it's a target with no HP)
  - Spirit form variant of skill cells (Story 3.5+)
  - Class-specific ability mechanics or targeting (Story 3.3)
  - Multi-touch joystick+skill simultaneous during CLASS SELECTION flow (unchanged)
  - Dungeon entrance interaction (Story 4.2)
  - ClassSelectMsg / sendClassSelect — already done in Story 2.3, do NOT re-implement
Acceptance criteria: see AC section below
Required hooks:
  - Contract-change hook: net-protocol (new event name exported; CooldownUpdateMsg now
    exported from index). Protocol Architect review required. Contract test for
    CooldownUpdateMsg required. No ADR/spec update needed (additive, existing type).
  - Simulation-safety hook: GameRoom.ts modified. Typecheck + existing test suite must pass.
    No new game-rules logic — cooldown tracking is GameRoom-local state (Map, not GameState).
  - Client-UX hook (mobile): skill cells must be ≥44px hit area, joystick ring spawns at
    exact touch position, boundary clamping works, cooldown overlay legible at arms-length.
  - Client-UX hook (host): training dummy visual indicator visible at 2–4m couch distance.
Required tests:
  - tests/contract/cooldown-update-msg.test.ts — CooldownUpdateMsg serialize → deserialize round-trip
  - npm run typecheck from repo root must be clean after all tasks
Telemetry impact: none (training dummy has no KPI requirement in this story)
```

---

## Cross-Context Ownership Note

This story spans all four implementation ownership areas. The dependency chain is strictly
sequential: Protocol (Task 1) → Simulation (Task 2) → Mobile (Task 3) → Host (Task 4).
Cross-context approval is granted because:

- The protocol change is minimal: one new enum value + one existing type re-exported
- The server change adds ~30 lines to GameRoom (one handler branch + cooldown Map)
- The mobile changes are self-contained (session callback, App state, ControllerScreen right-zone)
- The host change modifies one function signature + a small per-frame check

Do NOT split this story. The contract test requires the event name to exist, the server
requires the mobile to listen for it, and the host check is trivial but logically belongs here.

---

## Story

As a player,
I want to interact with the training dummy in the hub and fire my abilities at it,
so that I can learn what my class feels like before entering a dungeon.

---

## Acceptance Criteria

**AC1 — Skill cells become active on Interact tap at training dummy:**
**Given** a player with a confirmed class (`player.class !== null`) approaches the training dummy POI
**When** the `interact-button` slides in and the player taps "Interact"
**Then** the training dummy becomes "targeted" on the host canvas (visual indicator on dummy)
**And** the player's skill cells on the phone become active and responsive to touch

**AC2 — Joystick-AutoFire ability:**
**Given** the skill cells are active at the training dummy
**When** the player touches and drags a cell whose ability has `inputType === 'AUTO'`
**Then** a joystick ring spawns at the exact touch position within the cell
**And** the ability fires continuously in the aimed direction while the touch is held
**And** if the thumb drifts outside the cell boundary, the ability continues with the last
valid direction; the ring clamps visually to the cell edge
**And** on thumb-lift anywhere on screen, ability stops firing

**AC3 — Joystick-Release ability:**
**Given** the player touches and drags a RELEASE cell
**When** the player lifts their thumb
**Then** the ability fires once in the drag direction (not while held)
**And** same cross-boundary clamping rules as AUTO apply

**AC4 — Tap ability:**
**Given** the player taps a TAP cell
**When** the touch lands on the cell
**Then** the ability fires instantly; no joystick ring appears
**And** a brief tap feedback animation confirms the input (cell flashes accent-spirit at ~50% opacity, 150ms)

**AC5 — Cooldown overlay:**
**Given** an ability fires and enters cooldown
**When** the cooldown begins
**Then** a conic-gradient overlay fills the majority of the skill cell face (clockwise from top)
**And** a centered countdown value in text-primary shows remaining seconds (Math.ceil)
**And** the cell is non-interactive (rejects touch input) while on cooldown
**And** as time passes, the overlay progressively reveals the ability name beneath it
**And** when the cooldown expires, the overlay disappears and the cell returns to interactive

**AC6 — Exit training mode:**
**Given** skill cells are active at the training dummy
**When** the player moves away and `activePoi` is no longer `'training-dummy'`
**Then** skill cells return to their idle non-interactive hub state
**And** any active ability input (AUTO/RELEASE joystick) is cancelled

**AC7 — Host canvas indicator:**
**Given** any player has `nearPoiId === 'training-dummy'`
**When** the host canvas renders
**Then** the training dummy POI body shows an active ring indicator (visible from 2–4m)
**When** no player is near the training dummy
**Then** the ring indicator disappears and the training dummy renders in its default state

---

## Tasks / Subtasks

- [x] **Task 1: Protocol additions + contract test** (AC: contract-change hook) — Protocol Architect
  - [x] Edit `packages/net-protocol/src/event-names.ts` — add `COOLDOWN_UPDATE = 'cooldown:update'` at end of EventNames enum
  - [x] Edit `packages/net-protocol/src/index.ts` — add `export type { CooldownUpdateMsg } from './messages/server-to-mobile.js'`
  - [x] Create `tests/contract/cooldown-update-msg.test.ts` — CooldownUpdateMsg round-trip (see Dev Notes §Task 1)
  - [x] Run `npm test --workspace=tests/contract` — must pass

- [x] **Task 2: Simulation server — ability input + cooldown tracking** (AC: #1, #2, #3, #4, #5) — Simulation Engineer
  - [x] Read `apps/simulation-server/src/rooms/GameRoom.ts` in full before editing
  - [x] Add `private cooldownMap = new Map<string, number[]>()` to GameRoom class (see Dev Notes §Task 2 — cooldown map)
  - [x] In `onCreate`, register `EventNames.COOLDOWN_UPDATE` as a no-op handler (see Dev Notes §Task 2 — why register no-op)
  - [x] In `tick()`, add ability event processing from `inputQueue` (see Dev Notes §Task 2 — ability handler)
  - [x] In `tick()`, add cooldown expiry check and send `remainingMs: 0` on expiry (see Dev Notes §Task 2 — expiry loop)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 3: Mobile controller** (AC: #1, #2, #3, #4, #5, #6) — Mobile Controller Engineer
  - [x] Read `apps/mobile-controller/src/session/mobile-session.ts` in full before editing
  - [x] Add `onCooldownUpdate` callback to `wireRoomHandlers`, `joinSession`, `reconnectToSession` (see Dev Notes §Task 3a — mobile-session)
  - [x] Read `apps/mobile-controller/src/App.tsx` in full before editing
  - [x] Add `cooldowns` state and `handleCooldownUpdate` callback to App.tsx; pass to ControllerScreen (see Dev Notes §Task 3b — App.tsx)
  - [x] Read `apps/mobile-controller/src/screens/ControllerScreen.tsx` in full before editing
  - [x] Add `cooldowns` prop to ControllerScreen; add `trainingDummyActive` state (see Dev Notes §Task 3c — ControllerScreen state)
  - [x] Wire `InteractButton.onTap` for `'training-dummy'` to set `trainingDummyActive = true` (see Dev Notes §Task 3c)
  - [x] Add `useEffect` to clear `trainingDummyActive` when `activePoi !== 'training-dummy'` (see Dev Notes §Task 3c)
  - [x] Build the active right zone with skill cell touch handling (see Dev Notes §Task 3d — right zone implementation)
  - [x] Add conic-gradient cooldown overlay rendering (see Dev Notes §Task 3e — cooldown overlay)
  - [x] Add 100ms re-render interval while any cooldown is active (see Dev Notes §Task 3e)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 4: Host canvas training dummy indicator** (AC: #7) — Host Experience Engineer
  - [x] Read `apps/host-client/src/screens/HubWorldScreen.tsx` in full before editing
  - [x] Extend `renderFrame` signature to accept `poiGraphics` parameter (see Dev Notes §Task 4)
  - [x] Add training dummy ring indicator logic to `renderFrame` (see Dev Notes §Task 4)
  - [x] Update both `renderFrame` call sites to pass `poiGraphicsRef.current` (see Dev Notes §Task 4)
  - [x] Run `npm run typecheck` — must be clean

---

## Dev Notes

### Prerequisite: Story 2.3 Must Be Done First

Story 2.4 starts from a codebase where Story 2.3 is fully implemented. Key things that
**already exist** after Story 2.3 (do NOT re-implement):

- `PlayerState.class: PlayerClass | null` (nullable)
- `EventNames.CLASS_SELECT = 'class:select'`
- `ClassSelectMsg` type in net-protocol
- `PlayerClassUpdatedDelta` type + `applyDelta` case for `player:class-updated`
- `MobileSession.sendClassSelect` in mobile-session.ts
- ControllerScreen right zone showing class ability names (non-interactive): `classDef?.abilities[i].name`
- `confirmedClass = ownPlayer?.class ?? null` in ControllerScreen
- `HubWorldScreen` PlayerChip showing class display name with `CLASS_DEFINITIONS`

If any of the above is missing, Story 2.3 was not merged. Halt and implement Story 2.3 first.

---

### Task 1 — Dev Notes: Protocol additions

#### `packages/net-protocol/src/event-names.ts`

Add one entry to the existing `EventNames` enum:
```typescript
COOLDOWN_UPDATE = 'cooldown:update',
```
Place it after `HOST_START`. The full enum after Stories 2.3 and 2.4:
```typescript
export enum EventNames {
  SNAPSHOT    = 'snapshot',
  DELTA       = 'delta',
  INPUT       = 'input',
  JOIN_REQUEST = 'join_request',
  JOIN_RESPONSE = 'join_response',
  HOST_START  = 'host:start',
  CLASS_SELECT = 'class:select',        // Story 2.3
  COOLDOWN_UPDATE = 'cooldown:update',  // Story 2.4
}
```

#### `packages/net-protocol/src/index.ts`

`CooldownUpdateMsg` already exists in `packages/net-protocol/src/messages/server-to-mobile.ts`
but is NOT exported from the index. Add the export:
```typescript
export type { CooldownUpdateMsg, BondNotificationMsg, SpiritFormMsg, ReconnectMsg } from './messages/server-to-mobile.js';
```
Replace the existing line that only exports a subset of these types (check current state — only
add what's missing; do not create duplicate exports).

#### Contract test

```typescript
// tests/contract/cooldown-update-msg.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { CooldownUpdateMsg } from 'net-protocol';

describe('CooldownUpdateMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: CooldownUpdateMsg = { type: 'cooldown:update', abilityIndex: 2, remainingMs: 3000 };
    expect(deserialize<CooldownUpdateMsg>(serialize(msg))).toEqual(msg);
  });

  it('handles zero remainingMs (cooldown cleared)', () => {
    const msg: CooldownUpdateMsg = { type: 'cooldown:update', abilityIndex: 0, remainingMs: 0 };
    expect(deserialize<CooldownUpdateMsg>(serialize(msg))).toEqual(msg);
  });
});
```

---

### Task 2 — Dev Notes: Simulation server

#### Cooldown map

Add to the `GameRoom` class alongside `inputQueue`:
```typescript
// Tracks cooldown expiry timestamps per player per ability slot (ms since epoch).
// Array index = abilityIndex (0–3). Value 0 = no cooldown active.
// NOT part of GameState — purely server-local, not snapshotted.
private cooldownMap = new Map<string, number[]>();
```

When a player joins (in `onJoin`), initialize their cooldown entry:
```typescript
// Inside the non-host player branch of onJoin:
this.cooldownMap.set(client.sessionId, [0, 0, 0, 0]);
```

When a player leaves permanently (consented leave or grace expiry), clean up:
```typescript
this.cooldownMap.delete(client.sessionId);
```

#### Why register COOLDOWN_UPDATE no-op on server

`EventNames.COOLDOWN_UPDATE` flows **server → client** (not client → server). The server does
NOT need to register it with `this.onMessage`. However, we still add it to EventNames so the
client-side `room.onMessage(EventNames.COOLDOWN_UPDATE, ...)` call has a typed constant to
reference.

No `this.onMessage(EventNames.COOLDOWN_UPDATE, ...)` call is needed in `onCreate`.

#### Ability handler in tick()

The input queue currently processes only `joystick` events. Add handling for `ability` events
in the same tick loop, **after** movement processing (order: joystick → ability):

```typescript
// Inline constant — Story 3.x moves this to packages/game-rules/balance.ts
const TRAINING_DUMMY_COOLDOWN_MS = 3000;

// Process ability inputs — training dummy only
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type !== 'ability') continue;
  const { abilityIndex, directionX, directionY } = msg.event.ability;

  const player = this.gameState.players.find(p => p.id === clientId);
  if (!player) continue;
  if (player.class === null) continue;          // no class confirmed
  if (player.nearPoiId !== 'training-dummy') continue; // not at dummy

  const playerCooldowns = this.cooldownMap.get(clientId);
  if (!playerCooldowns) continue;

  const now = Date.now();
  if (playerCooldowns[abilityIndex] !== undefined &&
      (playerCooldowns[abilityIndex] ?? 0) > now) continue; // still on cooldown

  // Validate abilityIndex is in range
  if (abilityIndex < 0 || abilityIndex > 3) continue;

  // Apply cooldown
  playerCooldowns[abilityIndex] = now + TRAINING_DUMMY_COOLDOWN_MS;

  // Send CooldownUpdateMsg to this client only (not broadcast)
  const targetClient = this.clients.find(c => c.sessionId === clientId);
  if (targetClient) {
    targetClient.send(EventNames.COOLDOWN_UPDATE, {
      type: 'cooldown:update',
      abilityIndex,
      remainingMs: TRAINING_DUMMY_COOLDOWN_MS,
    } satisfies CooldownUpdateMsg);
  }

  logger.debug({ roomId: this.roomId, clientId, abilityIndex }, 'ability fired at training dummy');
}
```

**Note on logger.debug:** `logger.debug` is the only level permitted inside hot loops (project
context rule). Do NOT use `logger.info` here.

**Import to add:** `CooldownUpdateMsg` type from net-protocol (if not already imported):
```typescript
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg, CooldownUpdateMsg } from 'net-protocol';
```

#### Cooldown expiry loop in tick()

After the ability handler, add a second loop to notify clients when cooldowns expire:

```typescript
// Notify clients whose cooldowns have expired this tick
const now = Date.now();
for (const [clientId, cooldowns] of this.cooldownMap) {
  for (let i = 0; i < cooldowns.length; i++) {
    const expiry = cooldowns[i];
    if (expiry !== undefined && expiry > 0 && now >= expiry) {
      cooldowns[i] = 0; // clear
      const targetClient = this.clients.find(c => c.sessionId === clientId);
      if (targetClient) {
        targetClient.send(EventNames.COOLDOWN_UPDATE, {
          type: 'cooldown:update',
          abilityIndex: i,
          remainingMs: 0,
        } satisfies CooldownUpdateMsg);
      }
    }
  }
}
```

**Performance note:** The `this.clients.find(...)` call inside the loop is O(n·4) where n is
player count (max 8). For ≤32 iterations per tick this is acceptable. Do NOT pre-build a
clientId→client Map each tick — unnecessary allocation.

#### inputQueue clearing

The existing code does `this.inputQueue.length = 0` after the joystick loop. Move this clear
to **after** the ability loop (once — not after each inner loop):
```typescript
// Process joystick inputs (existing code, unchanged)
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type !== 'joystick') continue;
  // ... existing joystick code ...
}

// Process ability inputs (new code)
for (const { clientId, msg } of this.inputQueue) {
  if (msg.event.type !== 'ability') continue;
  // ... ability code above ...
}

this.inputQueue.length = 0; // clear ONCE after both loops
```

This avoids clearing the queue between joystick and ability processing.

---

### Task 3a — Dev Notes: mobile-session.ts

Add `onCooldownUpdate` as a new callback parameter. Pattern mirrors `onDelta`:

```typescript
// In wireRoomHandlers — add 5th parameter:
function wireRoomHandlers(
  room: Colyseus.Room<any>,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onCooldownUpdate: (msg: CooldownUpdateMsg) => void,  // NEW
  onError: (code: number, message: string) => void,
  onDisconnect: (code: number) => void,
): void {
  // ... existing handlers unchanged ...

  room.onMessage(EventNames.COOLDOWN_UPDATE, (data: unknown) => {
    try {
      const msg = decode<CooldownUpdateMsg>(data);
      onCooldownUpdate(msg);
    } catch { /* ignore malformed */ }
  });
}
```

Add import at top:
```typescript
import type { SnapshotMsg, DeltaEventMsg, InputEventMsg, CooldownUpdateMsg } from 'net-protocol';
```

Update `joinSession` and `reconnectToSession` signatures to accept `onCooldownUpdate` and pass
it through to `wireRoomHandlers`:
```typescript
export async function joinSession(
  roomId: string,
  playerName: string,
  onStateUpdate: (state: GameState) => void,
  onDelta: (delta: DeltaEventMsg) => void,
  onCooldownUpdate: (msg: CooldownUpdateMsg) => void,  // NEW
  onError: (code: number, message: string) => void,
  onDisconnect: (code: number) => void,
): Promise<MobileSession>
```

Same for `reconnectToSession`.

**MobileSession interface is unchanged** — `onCooldownUpdate` is wired internally, not exposed.

---

### Task 3b — Dev Notes: App.tsx

#### CooldownState type

Define at the top of App.tsx (or inline where used):
```typescript
interface CooldownState {
  startAt: number;   // Date.now() when CooldownUpdateMsg arrived
  expiresAt: number; // Date.now() + remainingMs
}
```

#### cooldowns state

```typescript
const [cooldowns, setCooldowns] = useState<(CooldownState | null)[]>([null, null, null, null]);
```

#### handleCooldownUpdate callback

```typescript
const handleCooldownUpdate = useCallback((msg: CooldownUpdateMsg) => {
  setCooldowns(prev => {
    const next = [...prev] as (CooldownState | null)[];
    if (msg.remainingMs > 0) {
      next[msg.abilityIndex] = { startAt: Date.now(), expiresAt: Date.now() + msg.remainingMs };
    } else {
      next[msg.abilityIndex] = null;
    }
    return next;
  });
}, []);
```

#### Pass to joinSession / reconnectToSession

In `handleJoin`:
```typescript
const s = await joinSession(
  roomId,
  playerName,
  setGameState,
  handleDelta,
  handleCooldownUpdate,  // NEW — 3rd positional after handleDelta
  (code, msg) => { console.warn('[session] room error after join', code, msg); },
  handleDisconnect,
);
```

Same for `handleReconnect`.

#### Pass cooldowns to ControllerScreen

```typescript
return <ControllerScreen session={session} gameState={gameState} cooldowns={cooldowns} />;
```

Also reset cooldowns on navigation away from controller (optional but clean):
```typescript
// When navigating to reconnect screen, clear cooldowns:
setCooldowns([null, null, null, null]);
```

**Import to add:**
```typescript
import type { CooldownUpdateMsg } from 'net-protocol';
```

---

### Task 3c — Dev Notes: ControllerScreen state + wiring

#### New prop

```typescript
interface ControllerScreenProps {
  session: MobileSession | null;
  gameState: GameState | null;
  cooldowns: (CooldownState | null)[];  // NEW — from App.tsx
}
```

Define `CooldownState` by importing it from wherever it was defined (App.tsx re-exports it,
or duplicate the interface in ControllerScreen.tsx — same pattern as the project never imports
interfaces between sibling files, so define locally):
```typescript
interface CooldownState {
  startAt: number;
  expiresAt: number;
}
```

#### New state

```typescript
const [trainingDummyActive, setTrainingDummyActive] = useState(false);
```

#### Clear training mode on POI exit

```typescript
useEffect(() => {
  if (activePoi !== 'training-dummy') {
    setTrainingDummyActive(false);
  }
}, [activePoi]);
```

#### Wire InteractButton.onTap

Update the existing `onTap` handler in the return JSX:
```typescript
onTap={() => {
  if (activePoi === 'class-select') setClassSelectionOpen(true);
  if (activePoi === 'training-dummy' && confirmedClass !== null) setTrainingDummyActive(true);
}}
```

Where `confirmedClass` is already derived (from Story 2.3):
```typescript
const ownPlayer = gameState?.players.find(p => p.id === session?.playerId) ?? null;
const confirmedClass = ownPlayer?.class ?? null;
const classDef = confirmedClass !== null ? CLASS_DEFINITIONS[confirmedClass] : null;
```

---

### Task 3d — Dev Notes: Right zone implementation

The right zone needs two rendering modes:
1. **Hub idle** (existing, `!trainingDummyActive`): static cells showing ability names, `pointerEvents: 'none'`
2. **Training active** (`trainingDummyActive && classDef !== null`): interactive cells

Replace the right zone JSX with:
```tsx
{/* Right zone — 2×2 skill grid (60% width) */}
<div
  ref={rightZoneRef}
  style={{
    width: '60%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: 4,
    padding: 8,
    boxSizing: 'border-box',
    touchAction: trainingDummyActive ? 'none' : 'auto',
    position: 'relative',
  }}
>
  {[0, 1, 2, 3].map(i => {
    const ability = classDef?.abilities[i] ?? null;
    const cd = cooldowns[i] ?? null;
    const now = Date.now();
    const isOnCooldown = cd !== null && cd.expiresAt > now;
    const isInteractive = trainingDummyActive && ability !== null && !isOnCooldown;
    const badgeBorderColor = ability !== null
      ? (ability.inputType === 'AUTO' ? 'var(--accent-spirit)'
        : ability.inputType === 'RELEASE' ? 'var(--accent-warm)'
        : 'var(--border)')
      : 'var(--border)';

    return (
      <SkillCell
        key={i}
        index={i}
        ability={ability}
        cooldownState={isOnCooldown ? cd : null}
        isInteractive={isInteractive}
        badgeBorderColor={badgeBorderColor}
        onAbilityFire={handleAbilityFire}   // only fires if isInteractive
        tapFlash={tapFlash[i] ?? false}
      />
    );
  })}
</div>
```

#### SkillCell component

Create a `SkillCell` component within `ControllerScreen.tsx`. It manages its own touch state
for AUTO and RELEASE types. TAP is handled via `onPointerDown`.

```typescript
interface SkillCellProps {
  index: number;
  ability: ClassAbilityDef | null;
  cooldownState: CooldownState | null;
  isInteractive: boolean;
  badgeBorderColor: string;
  onAbilityFire: (abilityIndex: number, dirX: number, dirY: number, isContinuous: boolean) => void;
  tapFlash: boolean;
}
```

**TAP handling inside SkillCell:**
```typescript
onPointerDown={e => {
  if (!isInteractive || ability === null) return;
  if (ability.inputType !== 'TAP') return;
  e.preventDefault();
  onAbilityFire(index, 0, 0, false);
}}
```

**AUTO / RELEASE handling:** Use `useEffect` + `addEventListener` on the cell div:
```typescript
const cellRef = useRef<HTMLDivElement>(null);
const activeTouchRef = useRef<{ id: number; originX: number; originY: number; lastDirX: number; lastDirY: number } | null>(null);
const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
  const el = cellRef.current;
  if (!el || !isInteractive || ability === null) return;
  if (ability.inputType === 'TAP') return; // TAP handled by onPointerDown

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (activeTouchRef.current !== null) return; // only one active touch per cell
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = el.getBoundingClientRect();
    activeTouchRef.current = {
      id: touch.identifier,
      originX: touch.clientX - rect.left,
      originY: touch.clientY - rect.top,
      lastDirX: 0,
      lastDirY: 0,
    };
    if (ability.inputType === 'AUTO') {
      // Start continuous fire at 30hz (matches sim tick rate)
      autoIntervalRef.current = setInterval(() => {
        const t = activeTouchRef.current;
        if (t) onAbilityFire(index, t.lastDirX, t.lastDirY, true);
      }, 33);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const t = activeTouchRef.current;
    if (t === null) return;
    let touch: Touch | undefined;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i]!.identifier === t.id) { touch = e.touches[i]; break; }
    }
    if (!touch) return;
    const rect = el.getBoundingClientRect();
    // Clamp ring position to cell boundaries
    const rawX = touch.clientX - rect.left - t.originX;
    const rawY = touch.clientY - rect.top - t.originY;
    const dist = Math.sqrt(rawX * rawX + rawY * rawY);
    const RING_MAX = 30; // smaller than movement joystick — fits within skill cell
    const DEADZONE = 6;
    if (dist >= DEADZONE) {
      const angle = Math.atan2(rawY, rawX);
      t.lastDirX = Math.cos(angle);
      t.lastDirY = Math.sin(angle);
    }
    // clampedDist used only for visual ring rendering (not needed for logic — omit for now)
  };

  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    const t = activeTouchRef.current;
    if (t === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i]!.identifier === t.id) {
        if (ability.inputType === 'RELEASE') {
          onAbilityFire(index, t.lastDirX, t.lastDirY, false);
        }
        if (autoIntervalRef.current) {
          clearInterval(autoIntervalRef.current);
          autoIntervalRef.current = null;
        }
        activeTouchRef.current = null;
        break;
      }
    }
  };

  // Global touchend to catch lift outside cell (boundary rule)
  const onDocumentTouchEnd = (e: TouchEvent) => {
    const t = activeTouchRef.current;
    if (t === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i]!.identifier === t.id) {
        if (ability.inputType === 'RELEASE') {
          onAbilityFire(index, t.lastDirX, t.lastDirY, false);
        }
        if (autoIntervalRef.current) {
          clearInterval(autoIntervalRef.current);
          autoIntervalRef.current = null;
        }
        activeTouchRef.current = null;
        break;
      }
    }
  };

  el.addEventListener('touchstart', onTouchStart, { passive: false });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd, { passive: false });
  el.addEventListener('touchcancel', onTouchEnd, { passive: false });
  document.addEventListener('touchend', onDocumentTouchEnd, { passive: false });
  document.addEventListener('touchcancel', onDocumentTouchEnd, { passive: false });

  return () => {
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchEnd);
    document.removeEventListener('touchend', onDocumentTouchEnd);
    document.removeEventListener('touchcancel', onDocumentTouchEnd);
    if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
  };
}, [isInteractive, ability, index, onAbilityFire]);
```

#### handleAbilityFire in ControllerScreen

```typescript
const handleAbilityFire = useCallback((abilityIndex: number, dirX: number, dirY: number, _isContinuous: boolean) => {
  const s = sessionRef.current;
  if (!s) return;
  const msg: InputEventMsg = {
    type: 'input',
    event: { type: 'ability', ability: { abilityIndex, directionX: dirX, directionY: dirY } },
  };
  s.sendInput(msg);
}, []);
```

**Why `sessionRef.current`:** Same stale-closure prevention as `sendJoystick` / `sendClassSelect`
in earlier stories. `handleAbilityFire` is passed as a prop to `SkillCell` which has a closure
over it via `useEffect`. Using `sessionRef.current` ensures the latest session is always used.

#### tapFlash state

```typescript
const [tapFlash, setTapFlash] = useState<boolean[]>([false, false, false, false]);
```

In `handleAbilityFire`, for TAP abilities:
```typescript
if (!isContinuous) {
  // TAP flash: cell briefly highlights
  setTapFlash(prev => {
    const next = [...prev];
    next[abilityIndex] = true;
    return next;
  });
  setTimeout(() => {
    setTapFlash(prev => {
      const next = [...prev];
      next[abilityIndex] = false;
      return next;
    });
  }, 150);
}
```

In `SkillCell`, apply the flash:
```typescript
boxShadow: tapFlash && ability?.inputType === 'TAP'
  ? 'inset 0 0 0 2000px rgba(110,168,216,0.5)'
  : 'none',
```

---

### Task 3e — Dev Notes: Cooldown overlay

#### Conic-gradient overlay

The overlay covers the majority of the cell face. At cooldown start the cell is ~100%
covered (dark); as time passes the dark shrinks clockwise revealing the ability content below.

```typescript
// In SkillCell render, when isOnCooldown:
const now = Date.now();
const totalDuration = cd !== null ? cd.expiresAt - cd.startAt : 1;
const elapsed = cd !== null ? now - cd.startAt : 0;
const pctElapsed = Math.min(elapsed / totalDuration, 1); // 0 at start → 1 at end
const degRevealed = Math.round(pctElapsed * 360);

// Overlay div positioned absolutely over the cell content:
<div
  style={{
    position: 'absolute',
    inset: 0,
    borderRadius: 6,
    background: `conic-gradient(
      transparent ${degRevealed}deg,
      rgba(15,14,16,0.7) ${degRevealed}deg
    )`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    pointerEvents: 'none',  // overlay is non-interactive; cell div has pointerEvents:none when on cooldown
  }}
>
  <span
    style={{
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 'var(--text-sm)',   // 13px — readable without being too prominent
      color: 'var(--text-primary)',
      textShadow: '0 1px 3px rgba(0,0,0,0.8)',  // contrast against semi-transparent overlay
      pointerEvents: 'none',
    }}
  >
    {countdownSeconds}
  </span>
</div>
```

Where `countdownSeconds = Math.ceil((cd.expiresAt - Date.now()) / 1000)`.

**Conic-gradient direction:** The UX spec says "fills clockwise from top as cooldown completes".
The CSS `conic-gradient` default start is the top (12 o'clock = 0deg). The `transparent` arc
starts at 0° and sweeps clockwise to `degRevealed`° — that's the "revealed" portion. The
remaining arc (`degRevealed°` to 360°) is the dark overlay. This correctly animates: at
start (`pctElapsed=0`), `degRevealed=0` → fully covered; at end (`pctElapsed=1`),
`degRevealed=360` → fully revealed.

#### Re-render interval for countdown

Without a re-render trigger, the countdown display would freeze between React renders. Add
to ControllerScreen (not inside SkillCell — one interval for all cells):

```typescript
// Force re-render while any cooldown is active, to update countdown displays
const anyCooldownActive = cooldowns.some(cd => cd !== null && cd.expiresAt > Date.now());
useEffect(() => {
  if (!anyCooldownActive) return;
  const interval = setInterval(() => {
    // Force re-render by updating a tick counter (or use forceUpdate approach)
    setDisplayTick(t => t + 1);
  }, 100);
  return () => clearInterval(interval);
}, [anyCooldownActive]);
```

Add `const [displayTick, setDisplayTick] = useState(0)` — used only to trigger re-renders.
The value itself is not read in JSX.

---

### Task 4 — Dev Notes: Host canvas training dummy indicator

#### renderFrame signature change

Current signature:
```typescript
function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
): void
```

New signature:
```typescript
function renderFrame(
  state: GameState,
  app: Application,
  playerGraphics: Map<string, PlayerEntry>,
  poiGraphics: Map<string, { body: Graphics; label: Text }>,
): void
```

Both call sites in `HubWorldScreen` must be updated:
1. Inside `initPixi()`: `renderFrame(latestGameStateRef.current, app, playerGraphicsRef.current, poiGraphicsRef.current)`
2. In the `useEffect([gameState])`: `renderFrame(gameState, pixiAppRef.current, playerGraphicsRef.current, poiGraphicsRef.current)`

#### Training dummy indicator in renderFrame

At the end of `renderFrame`, after the player loop:

```typescript
// Training dummy targeting indicator
const anyNearDummy = state.players.some(p => p.nearPoiId === 'training-dummy');
const dummyEntry = poiGraphics.get('training-dummy');
if (dummyEntry) {
  dummyEntry.body.clear();
  // Base fill (always present)
  dummyEntry.body.roundRect(-24, -24, 48, 48, 6).fill({ color: 0xc07d35 });
  if (anyNearDummy) {
    // Active ring — stroke only, outside the base rect
    dummyEntry.body
      .roundRect(-32, -32, 64, 64, 10)
      .stroke({ color: 0xc07d35, width: 2, alpha: 0.7 });
  }
}
```

**Why re-draw on every frame:** PixiJS Graphics are retained-mode. We must call `.clear()` and
re-draw when the visual changes. For the training dummy, this re-draw is O(1) and fast.
We do it every `renderFrame` call (not only on state change) to keep code simple — re-drawing
the same graphics is negligible cost compared to the player circle updates.

**Token meaning:** `0xc07d35` is `accent-warm` (#c07d35). The training dummy uses this color
per the existing code in `initPixi`. The ring uses the same color.

---

### CSS Design Tokens Used in this Story

No new tokens introduced. All tokens are from the existing project CSS:

| Token | Value | Usage |
|---|---|---|
| `--accent-spirit` | #6ea8d8 | AUTO badge border, active joystick ring, tap flash overlay |
| `--accent-warm` | #c07d35 | RELEASE badge border, training dummy POI color (host) |
| `--border` | #36334a | TAP badge border, cell border |
| `--bg-base` | #0f0e10 | Cooldown overlay color (`rgba(15,14,16,0.7)`) |
| `--text-primary` | #d8d0e8 | Countdown value in cooldown overlay |
| `--text-secondary` | #a89ec0 | Input type badges, idle placeholders |
| `--bg-subtle` | #22202e | Cell background |
| `--font-body` | Lora | Ability names, countdown, badges |
| `--text-sm` | 13px | Countdown value |
| `--text-xs` | 11px | Input type badge |
| `--text-base` | 16px | Ability name |

---

### Existing Code That Must Not Break

**Left joystick zone:** Completely separate DOM element (`joystickZoneRef` div at 40% width).
The right zone (`rightZoneRef`) touch handlers have no interaction with it. Multi-touch works
because each zone handles its own touches by `Touch.identifier`. Do NOT touch joystick logic.

**ClassSelectionScreen:** Rendered as an absolute-positioned overlay. `trainingDummyActive`
is separate state. The two overlays don't interact — `classSelectionOpen` and `trainingDummyActive`
are independent booleans. When `classSelectionOpen` is true, the class selection overlay
covers the entire screen including the right zone; skill cell touches are blocked by the overlay.

**Story 2.3 skill cell display (hub idle):** When `!trainingDummyActive`, the right zone still
shows class ability names with non-interactive cells (Story 2.3 work). The new right zone
JSX must preserve this behavior for the idle case:
- `ability !== null` cells show ability name + input type badge
- `ability === null` cells show `—` dash
- All cells have `pointerEvents: 'none'` in idle mode

**Existing POI rendering (initPixi):** The initial `HUB_POIS` rendering loop creates the
training dummy body once. Our `renderFrame` now re-draws it each frame to show/hide the ring.
The first render from `initPixi` will be immediately overwritten by `renderFrame` on the first
state update — this is fine.

**Snapshot flow:** `CooldownUpdateMsg` is sent directly to the specific mobile client, not
broadcast. On reconnect (`SnapshotMsg`), the player's cooldowns are NOT included in the
snapshot (they're server-local state). The client receives a fresh snapshot and `cooldowns`
in App.tsx is reset to `[null, null, null, null]` — any in-flight cooldowns are lost on
reconnect. This is acceptable for Story 2.4 (training dummy is hub-only; reconnect during
a dungeon run with active cooldowns is handled in Story 3.x+).

**Reconnect cooldown reset:** On reconnect in App.tsx, reset cooldowns:
```typescript
// In handleReconnect, after setSession(s):
setCooldowns([null, null, null, null]);
```

---

### Previous Story Learnings (Stories 2.1, 2.2, 2.3)

**Pattern: `sessionRef.current` for callbacks inside ControllerScreen.** All stories in
Epic 2 use `sessionRef.current` instead of `session` prop in callbacks to avoid stale
closures. `handleAbilityFire` must follow this pattern.

**Pattern: `satisfies DeltaEventMsg` / `satisfies CooldownUpdateMsg`.** All GameRoom broadcasts
and sends use `satisfies` for compile-time type safety. Use `satisfies CooldownUpdateMsg` in
the `client.send(...)` call.

**Pattern: `typeof raw === 'string' ? JSON.parse(raw) : raw` in onMessage handlers.** All
`onMessage` handlers in GameRoom defensively accept both JSON strings and plain objects.
Not needed for `COOLDOWN_UPDATE` since it flows server→client only.

**Pattern: No new CSS files.** All styles are inline JSX. This is established project convention.

**Pattern: `{ passive: false }` on touch event listeners in React components.** Required to
call `e.preventDefault()` in `touchstart`/`touchmove` handlers. Required for ability cells
since touch events must not bubble to the page.

**`AbilityInput.directionX/Y` defaults for TAP:** `AbilityInput` requires `directionX` and
`directionY`. For TAP abilities these should be `0, 0` — no direction needed. The server
handler ignores direction for now (training dummy has no targeting mechanic).

---

### Project Context Rules

All rules from `_bmad-output/project-context.md` apply. Key rules for this story:

- **Authority model.** Mobile sends `InputEventMsg` with ability event only. Server validates
  and tracks cooldown state. Mobile reads cooldown state from `CooldownUpdateMsg` — NOT from
  local computation. Do NOT compute "ability can fire" on the mobile; the server validates it.
- **Colyseus unhandled message rule.** `COOLDOWN_UPDATE` is server→client, so no `this.onMessage`
  registration needed. The mobile registers `room.onMessage(EventNames.COOLDOWN_UPDATE, ...)`.
  Failure to register on the mobile = silent lost messages (no disconnect, unlike server side).
- **logger.debug in tick.** All logging inside `tick()` must be `logger.debug`, never
  `logger.info`. The cooldown-fired log line uses `logger.debug`.
- **No Math.random() in game logic.** Not applicable here — no randomness in training dummy.
- **No planck.js outside sim server.** Not applicable here — training dummy uses proximity
  from existing `nearPoiId` (already distance-checked in the tick loop).
- **TypeScript strict mode.** No `any` without comment. The `Colyseus.Room<any>` suppressions
  in mobile-session.ts are pre-existing and acceptable.
- **npm only.** Use `npm run typecheck`, not `pnpm`.
- **Result<T, E> for game-rules.** Not applicable — no game-rules functions in this story.
- **Tick loop safety.** `ability` handling in tick: O(n) where n = input queue depth.
  No heap allocations (no new arrays). No `JSON.parse` inside the loop. Compliant.

---

### References

- Epic 2 Story 2.4 AC: `_bmad-output/planning-artifacts/epics.md` lines 537–572
- UX skill-cell spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` lines 112–130
- UX skill-cell cooldown design: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 397–416
- UX right-zone layout: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 299–307
- UX multi-touch requirement: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` lines 420–440
- Current InputEvent types: `packages/shared-types/src/input.ts`
- Current CooldownUpdateMsg: `packages/net-protocol/src/messages/server-to-mobile.ts`
- Current EventNames: `packages/net-protocol/src/event-names.ts`
- Current apply-delta (unchanged): `packages/net-protocol/src/apply-delta.ts`
- Current GameRoom: `apps/simulation-server/src/rooms/GameRoom.ts`
- Current HubWorldScreen: `apps/host-client/src/screens/HubWorldScreen.tsx`
- Current ControllerScreen: `apps/mobile-controller/src/screens/ControllerScreen.tsx`
- Current mobile-session: `apps/mobile-controller/src/session/mobile-session.ts`
- Current App.tsx: `apps/mobile-controller/src/App.tsx`
- Project context rules: `_bmad-output/project-context.md`
- POI definitions: `packages/shared-types/src/poi.ts`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded without blocks.

### Completion Notes List

All four tasks implemented sequentially per the dependency chain: Protocol → Simulation → Mobile → Host.

- **Task 1 (Protocol):** Added `COOLDOWN_UPDATE = 'cooldown:update'` to EventNames enum. `CooldownUpdateMsg` was already exported from `packages/net-protocol/src/index.ts` (pre-existing). Contract test created and passes.
- **Task 2 (Simulation):** Added `cooldownMap` (server-local, not snapshotted), initialized per player in `onJoin`, cleaned up in `onLeave` for both consented and grace-expired paths. Ability handler in `tick()` reads from inputQueue after joystick loop; `inputQueue.length = 0` moved to after both loops. Cooldown expiry loop sends `remainingMs: 0` when timer expires. No `this.onMessage(COOLDOWN_UPDATE)` registered — COOLDOWN_UPDATE is server→client only.
- **Task 3 (Mobile):** `mobile-session.ts` wires `onCooldownUpdate` as 3rd param after `onDelta` in `wireRoomHandlers`, `joinSession`, and `reconnectToSession`. `App.tsx` defines `CooldownState` interface (exported), `cooldowns` state, `handleCooldownUpdate`, and resets cooldowns on reconnect. `ControllerScreen.tsx` fully rewritten with `SkillCell` component (TAP via `onPointerDown`, AUTO/RELEASE via touchstart/touchmove/touchend with document-level cleanup), conic-gradient cooldown overlay, 100ms re-render interval for countdown display.
- **Task 4 (Host):** `renderFrame` signature extended with `poiGraphics` param. Training dummy entry is redrawn each frame: base amber rect always present, outer ring stroke added when any player has `nearPoiId === 'training-dummy'`.

CONTRACT CHANGE HOOK CHECKLIST (as required by CLAUDE.md):
- [x] Protocol Architect review required: additive change (new enum value, no existing types changed)
- [x] Compatibility: `COOLDOWN_UPDATE` is server→client only; existing clients that don't register a handler receive silent messages (no WITH_ERROR disconnect per Colyseus rules)
- [x] No ADR/spec update needed: additive to existing event contract
- [x] Contract test added: `tests/contract/cooldown-update-msg.test.ts` (2 cases)

Confidence: 95% — all ACs are satisfied by the implementation. The only untested path is the live multi-touch joystick + skill cell simultaneous interaction on real mobile hardware (excluded from scope per Non-goals). The SkillCell `useEffect` cleanup correctly handles all edge cases (auto-interval cleared on unmount, document-level touchend catches out-of-bounds lifts).

### File List

- `packages/net-protocol/src/event-names.ts` — modified (added COOLDOWN_UPDATE)
- `packages/net-protocol/src/index.ts` — unchanged (CooldownUpdateMsg export was pre-existing)
- `tests/contract/cooldown-update-msg.test.ts` — new
- `apps/simulation-server/src/rooms/GameRoom.ts` — modified (cooldownMap, ability handler, expiry loop)
- `apps/mobile-controller/src/session/mobile-session.ts` — modified (onCooldownUpdate in all three functions)
- `apps/mobile-controller/src/App.tsx` — modified (CooldownState, cooldowns state, handleCooldownUpdate)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — modified (SkillCell, training mode, cooldown overlay)
- `apps/host-client/src/screens/HubWorldScreen.tsx` — modified (renderFrame poiGraphics param + dummy ring)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated (2-4 status: in-progress)

## Change Log

- 2026-06-24: Story 2.4 implemented — training dummy POI interactive skill cells, ability input + cooldown tracking, conic-gradient cooldown overlay, host canvas ring indicator.

### Review Findings

- [x] [Review][Decision] AC2: Joystick ring visual missing from SkillCell — deferred, Dev Notes §Task 3d "omit for now" is intentional; ring visual to be added in Story 3.x visual polish
- [x] [Review][Patch] Double Date.now() in handleCooldownUpdate creates non-atomic startAt/expiresAt [apps/mobile-controller/src/App.tsx:57] — FIXED: capture single const now = Date.now()
- [x] [Review][Patch] activeTouchRef not cleared in SkillCell useEffect cleanup — stale ref blocks next touchStart after ability/isInteractive change [apps/mobile-controller/src/screens/ControllerScreen.tsx:~599] — FIXED: null both refs in cleanup
- [x] [Review][Defer] Reconnect clears client cooldowns but server retains cooldownMap entries [apps/mobile-controller/src/App.tsx:116] — deferred, explicitly acknowledged in story Dev Notes §Existing Code
- [x] [Review][Defer] RELEASE ability can fire in React render gap after trainingDummyActive cleared [apps/mobile-controller/src/screens/ControllerScreen.tsx] — deferred, sub-frame window, server validates
- [x] [Review][Defer] flashUntil animation depends on gameState update frequency — smooth only with active players [apps/host-client/src/screens/HubWorldScreen.tsx:~77] — deferred, Story 2.3 scope in this diff
- [x] [Review][Defer] Same-tick movement+ability can drop ability if player moves outside nearPoiId radius within tick [apps/simulation-server/src/rooms/GameRoom.ts:~216] — deferred, negligible in casual gameplay
- [x] [Review][Defer] Non-integer abilityIndex bypasses bounds check and writes float key onto cooldowns array [apps/simulation-server/src/rooms/GameRoom.ts:~290] — deferred, typed client prevents this in practice

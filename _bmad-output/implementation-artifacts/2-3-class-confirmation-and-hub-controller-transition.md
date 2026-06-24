---
baseline_commit: 10f2e6c
---

# Story 2.3: Class Confirmation & Hub Controller Transition

Status: done

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Story 2.2 is complete. The ClassSelectionScreen overlay is live on mobile.
  When a player taps "Pick Selected Class", the overlay closes locally (no-op — Story 2.3
  wires it). The right zone of the hub controller still shows 4 dashes. The PlayerChip on
  the host HUD hard-codes "Class TBD". This story wires the full confirmation flow:
  mobile sends a class:select message → server updates player.class → broadcasts
  player:class-updated delta → host chip shows the class name + brief flash animation →
  mobile skill cells show the confirmed class's 4 abilities (non-interactive in hub).
Owner agent: Multi-context (explicit cross-context approval granted):
    Protocol Architect     (Tasks 1-2 — shared-types type change, net-protocol additions)
    Simulation Engineer    (Task 3 — GameRoom onMessage handler, createPlayer fix)
    Mobile Controller Eng  (Task 4 — sendClassSelect wiring, skill cells update)
    Host Experience Eng    (Task 5 — PlayerChip class name, in-canvas flash animation)
Goal: When a player taps "Pick Selected Class" in the class selection overlay, a
  class:select message is sent to the simulation server. The server updates the player's
  class in GameState and broadcasts a player:class-updated delta. The host top strip
  updates the player's chip to show the chosen class display name. The host canvas briefly
  flashes the player's circle. The mobile skill cells update to show the 4 class abilities
  with name + input type badge. Skills are non-interactive in the hub.
Allowed paths:
  - packages/shared-types/src/player.ts                     (MODIFY — class: PlayerClass | null)
  - packages/net-protocol/src/event-names.ts                (MODIFY — add CLASS_SELECT)
  - packages/net-protocol/src/messages/mobile-to-server.ts  (MODIFY — add ClassSelectMsg)
  - packages/net-protocol/src/messages/server-to-host.ts    (MODIFY — add PlayerClassUpdatedDelta)
  - packages/net-protocol/src/apply-delta.ts                (MODIFY — add player:class-updated case)
  - packages/net-protocol/src/index.ts                      (MODIFY — add exports)
  - apps/mobile-controller/src/session/mobile-session.ts    (MODIFY — add sendClassSelect)
  - apps/simulation-server/src/rooms/GameRoom.ts            (MODIFY — handler + createPlayer fix)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx (MODIFY — wire + skill cells)
  - apps/host-client/src/screens/HubWorldScreen.tsx         (MODIFY — PlayerChip + flash)
  - apps/host-client/src/components/PlayerSlot.tsx          (MODIFY — remove STONEHIDE hack)
  - tests/contract/                                         (NEW — ClassSelectMsg + delta round-trips)
Blocked paths:
  - packages/game-rules/**          (Story 3.x territory — no game rules in this story)
  - apps/backend-platform/**
Non-goals:
  - Ability mechanics, cooldowns, or stat effects (Story 3.3)
  - Class deselection or re-selection after confirmation (future consideration)
  - Training dummy interaction (Story 2.4)
  - In-dungeon skill cell interaction (Story 3.3+)
  - planck.js physics (Story 3.1)
  - Class-specific character sprites or animations (polish phase)
  - Class locking (player can re-confirm same or different class freely in hub)
Acceptance criteria: see AC section below
Required hooks:
  - Contract-change hook: shared-types (player.ts type change) and net-protocol
    (new message + new delta). Protocol Architect review required. Contract tests
    for both new message types required. Spec or ADR update not required (additive
    message, no lifecycle change).
  - Simulation-safety hook: GameRoom.ts modified. Typecheck + existing test suite
    must pass. No new game-rules logic — handler is a simple state update.
  - Client-UX hook: mobile controller and host client both modified.
    Mobile: skill cells readable at couch-arms-length, touch targets preserved.
    Host: player chip class name legible at 2–4m (Lora 400 sm, text-secondary).
Required tests:
  - tests/contract/class-select-msg.test.ts — ClassSelectMsg round-trip
  - tests/contract/player-class-updated-delta.test.ts — PlayerClassUpdatedDelta round-trip
  - npm run typecheck from repo root must be clean after all tasks
Telemetry impact: none (class confirmation has no KPI requirement in this story)
```

---

## Cross-Context Ownership Note

This story spans all four implementation ownership areas. The dependency chain is strictly
sequential: Protocol changes must be done first (Tasks 1–2), then Simulation (Task 3), then
Mobile and Host (Tasks 4–5, which can be done in parallel). Explicit cross-context approval
is granted because:

- The protocol changes are small and additive (one new enum value, one new message, one new delta)
- The server change is a single `onMessage` registration (< 20 lines)
- The mobile and host changes each touch one file only
- The `PlayerState.class: PlayerClass | null` type change eliminates the existing
  STONEHIDE hack in `PlayerSlot.tsx` — a correctness improvement, not scope creep

Do NOT split this story. The test harness for the server handler requires the protocol types
to exist, and the host/mobile rendering requires the delta to flow. Splitting would produce
untestable partial stories.

---

## Story

As a player,
I want to confirm my class selection and have my phone switch to the landscape hub controller
with my class abilities loaded,
so that I can move freely in the hub world with my chosen class identity.

---

## Acceptance Criteria

**AC1 — Class selection message sent on confirm:**
**Given** a class is selected and the ability briefing panel is open
**When** the player taps "Pick Selected Class"
**Then** the mobile controller sends a `class:select` message to the simulation server
with the confirmed `classId`
**And** the class selection overlay closes on the phone

**AC2 — Server updates GameState and broadcasts delta:**
**Given** the `class:select` message arrives at the sim server
**When** the handler processes it
**Then** the matching player's `class` field in `GameState` is updated to the confirmed
`PlayerClass` value
**And** a `player:class-updated` delta is broadcast to all clients (host and all mobiles)

**AC3 — Host chip shows class name:**
**Given** the host receives a `player:class-updated` delta
**When** the delta is applied via `applyDelta`
**Then** the host top strip updates the player's chip: the "Class TBD" line is replaced
by the chosen class display name (e.g., "Stonehide") in Lora 400, sm, text-secondary
**And** a brief in-canvas animation on the PixiJS canvas shows the player's circle
flashing (alpha pulse from 1 → 0.2 → 1 over ~600ms) to signal the class change

**AC4 — Hub controller shows class abilities (non-interactive):**
**Given** the class is confirmed and the overlay closes
**When** the phone returns to the hub controller layout
**Then** the right zone displays 4 `skill-cell` components — one per class ability
**And** each cell shows the ability name in Lora 400 italic at base size, text-primary
**And** each cell shows the input type badge (AUTO / RELEASE / TAP) in Lora 400, xs,
text-secondary, in the bottom-left corner, with per-type left-border accent:
accent-spirit for AUTO, accent-warm for RELEASE, border color for TAP
**And** all skill cells remain non-interactive (pointerEvents: 'none') in hub mode
**And** the movement joystick zone continues to work exactly as before (no regression)

**AC5 — Legibility at couch distance:**
**Given** the host screen updates after class confirmation
**When** viewed at 2–4 meters from the TV
**Then** the player chip class name is legible in the top strip (Lora 400, sm = 14px
minimum — passes couch-distance NFR)

---

## Tasks / Subtasks

- [x] **Task 1: Shared-types and net-protocol additions** (AC: #1, #2, #3, #4) — Protocol Architect
  - [x] Edit `packages/shared-types/src/player.ts` — change `class: PlayerClass` to `class: PlayerClass | null`
  - [x] Edit `packages/net-protocol/src/event-names.ts` — add `CLASS_SELECT = 'class:select'`
  - [x] Edit `packages/net-protocol/src/messages/mobile-to-server.ts` — add `ClassSelectMsg`
  - [x] Edit `packages/net-protocol/src/messages/server-to-host.ts` — add `PlayerClassUpdatedDelta` + add it to the `DeltaEventMsg` union
  - [x] Edit `packages/net-protocol/src/apply-delta.ts` — add `player:class-updated` case
  - [x] Edit `packages/net-protocol/src/index.ts` — export new types
  - [x] Run `npm run typecheck` — expect failures until Tasks 2–5 fix the call sites

- [x] **Task 2: Contract tests** (AC: Contract-change hook) — Protocol Architect
  - [x] Create `tests/contract/class-select-msg.test.ts` — `ClassSelectMsg` serialize → deserialize round-trip
  - [x] Create `tests/contract/player-class-updated-delta.test.ts` — `PlayerClassUpdatedDelta` round-trip
  - [x] Run `npm test --workspace=tests/contract` — must pass

- [x] **Task 3: Simulation server handler** (AC: #2) — Simulation Engineer
  - [x] Read `apps/simulation-server/src/rooms/GameRoom.ts` in full before editing
  - [x] Fix `createPlayer`: change `class: PlayerClass.STONEHIDE` → `class: null`
  - [x] Register `this.onMessage(EventNames.CLASS_SELECT, ...)` handler (see Dev Notes §Task 3)
  - [x] Run `npm run typecheck` — must be clean (GameRoom now uses `PlayerClass | null`)

- [x] **Task 4: Mobile controller wiring + skill cells** (AC: #1, #4) — Mobile Controller Engineer
  - [x] Read `apps/mobile-controller/src/session/mobile-session.ts` in full before editing
  - [x] Add `sendClassSelect: (msg: ClassSelectMsg) => void` to `MobileSession` interface
  - [x] Implement `sendClassSelect` in both `joinSession` and `reconnectToSession` return objects
  - [x] Add `import type { ClassSelectMsg } from 'net-protocol'` to `mobile-session.ts`
  - [x] Read `apps/mobile-controller/src/screens/ControllerScreen.tsx` in full before editing
  - [x] Wire `onPickClass` in ControllerScreen — replace `// TODO Story 2.3` with actual `session.sendClassSelect(...)` call (see Dev Notes §Task 4 — onPickClass wiring)
  - [x] Add class import: `import { CLASS_DEFINITIONS } from 'shared-types'` (already imported in ClassSelectionScreen — check if top-level import already covers it; if so, no change needed)
  - [x] Replace the static dash skill cells with dynamic ability cells driven by confirmed class (see Dev Notes §Task 4 — skill cells)
  - [x] Run `npm run typecheck` — must be clean

- [x] **Task 5: Host HUD updates** (AC: #3, #5) — Host Experience Engineer
  - [x] Read `apps/host-client/src/screens/HubWorldScreen.tsx` in full before editing
  - [x] Read `apps/host-client/src/components/PlayerSlot.tsx` in full before editing
  - [x] Update `PlayerChip` in `HubWorldScreen.tsx`: show class display name or "Class TBD" based on `player.class` (see Dev Notes §Task 5 — PlayerChip)
  - [x] Add flash animation to `PlayerEntry` in HubWorldScreen: `flashUntil: number` field, detect class change in `renderFrame`, set alpha pulse (see Dev Notes §Task 5 — flash animation)
  - [x] Import `CLASS_DEFINITIONS` in `HubWorldScreen.tsx` to get display names
  - [x] Fix `PlayerSlot.tsx`: replace the STONEHIDE hack with a null check (see Dev Notes §Task 5 — PlayerSlot fix)
  - [x] Run `npm run typecheck` — must be clean

---

## Dev Notes

### Design Decision: `PlayerState.class: PlayerClass | null`

The current `PlayerState.class` is typed `PlayerClass` and defaults to `PlayerClass.STONEHIDE`
in `createPlayer`. This forces `PlayerSlot.tsx` to use a hack:
```typescript
player.class === PlayerClass.STONEHIDE ? 'Class TBD' : player.class;
```

This is wrong — if a player actually picks Stonehide, the chip still shows "Class TBD".

**Change to: `class: PlayerClass | null`**
- `null` = player has not confirmed a class (the initial state)
- Non-null = player has confirmed that class (including Stonehide)

This makes the "not chosen yet" state explicit and eliminates the hack. The trade-off is
that any code reading `player.class` must now handle null — TypeScript strict mode will
catch all omissions at compile time.

---

### Task 1 — Dev Notes: Protocol additions

#### `packages/shared-types/src/player.ts`

Change one line:
```typescript
// Before
class: PlayerClass;

// After
class: PlayerClass | null;
```

No other changes in this file.

#### `packages/net-protocol/src/event-names.ts`

Add one entry to the existing `EventNames` enum:
```typescript
CLASS_SELECT = 'class:select',
```

Current enum has: `SNAPSHOT`, `DELTA`, `INPUT`, `JOIN_REQUEST`, `JOIN_RESPONSE`, `HOST_START`.
Add `CLASS_SELECT` at the end.

#### `packages/net-protocol/src/messages/mobile-to-server.ts`

Add `ClassSelectMsg` alongside the existing `InputEventMsg` and `JoinRequestMsg`:
```typescript
import type { InputEvent, JoinRequest, PlayerClass } from 'shared-types';

export interface ClassSelectMsg {
  type: 'class:select';
  classId: PlayerClass;
}
```

The `PlayerClass` import must be added. The existing `InputEvent` and `JoinRequest` imports
stay. Note the import is already `import type { InputEvent, JoinRequest } from 'shared-types'`
— just add `PlayerClass` to the same import.

#### `packages/net-protocol/src/messages/server-to-host.ts`

Add `PlayerClassUpdatedDelta` and add it to the `DeltaEventMsg` union. The existing deltas in
`server-to-host.ts` already import from `shared-types`. Add `PlayerClass` to that import:

```typescript
import type { GameState, BondState, EssenceDrop, PlayerClass } from 'shared-types';

export type PlayerClassUpdatedDelta = {
  type: 'player:class-updated';
  playerId: string;
  class: PlayerClass;
};
```

Add `PlayerClassUpdatedDelta` to the `DeltaEventMsg` union at the end:
```typescript
export type DeltaEventMsg =
  | PlayerMovedDelta
  | PlayerDownedDelta
  | PlayerReviveDelta
  | PlayerLeftDelta
  | PlayerDisconnectedDelta
  | PlayerReconnectedDelta
  | EnemyKilledDelta
  | EnemyMovedDelta
  | BondAssignedDelta
  | EssenceDroppedDelta
  | EssenceCollectedDelta
  | PlayerPoiEnteredDelta
  | PlayerPoiExitedDelta
  | PlayerClassUpdatedDelta;   // ← add this
```

#### `packages/net-protocol/src/apply-delta.ts`

Add a case in the `applyDelta` switch before the `default`:

```typescript
case 'player:class-updated': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  const players = state.players.map(p =>
    p.id === evt.playerId ? { ...p, class: evt.class } : p
  );
  return { ...state, players };
}
```

`evt.class` is `PlayerClass` (not nullable) — the confirmed value is always non-null because
the handler only broadcasts this delta after a valid class is confirmed.

#### `packages/net-protocol/src/index.ts`

Add to the existing exports:
```typescript
export type { ClassSelectMsg } from './messages/mobile-to-server.js';
export type { PlayerClassUpdatedDelta } from './messages/server-to-host.js';
```

The existing `server-to-host.ts` export line already exports `DeltaEventMsg` (which now
includes `PlayerClassUpdatedDelta` via the union) — no change needed there.
Just add the explicit `PlayerClassUpdatedDelta` named export for contract tests.

---

### Task 2 — Dev Notes: Contract tests

Contract tests live in `tests/contract/`. Follow the same pattern as any existing contract
tests in that directory. The standard pattern (from project-context.md):

```typescript
// tests/contract/class-select-msg.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { ClassSelectMsg } from 'net-protocol';
import { PlayerClass } from 'shared-types';

describe('ClassSelectMsg round-trip', () => {
  it('survives serialize → deserialize', () => {
    const msg: ClassSelectMsg = { type: 'class:select', classId: PlayerClass.SOULDRINKER };
    expect(deserialize<ClassSelectMsg>(serialize(msg))).toEqual(msg);
  });
});
```

```typescript
// tests/contract/player-class-updated-delta.test.ts
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { PlayerClassUpdatedDelta } from 'net-protocol';
import { PlayerClass } from 'shared-types';

describe('PlayerClassUpdatedDelta round-trip', () => {
  it('survives serialize → deserialize', () => {
    const delta: PlayerClassUpdatedDelta = {
      type: 'player:class-updated',
      playerId: 'abc123',
      class: PlayerClass.STORMCALLER,
    };
    expect(deserialize<PlayerClassUpdatedDelta>(serialize(delta))).toEqual(delta);
  });
});
```

Run: `npm test --workspace=tests/contract` (or the equivalent for the test runner in this project).

---

### Task 3 — Dev Notes: GameRoom handler

#### `createPlayer` fix

Change the default class from `PlayerClass.STONEHIDE` to `null`:
```typescript
// Before (line ~43 in GameRoom.ts)
class: PlayerClass.STONEHIDE,

// After
class: null,
```

Also remove `PlayerClass` from the existing import if it's no longer used in `createPlayer`:
```typescript
// Check: is PlayerClass used anywhere else in GameRoom.ts?
// If only in createPlayer → remove from import
// If still used in CLASS_SELECT handler → keep
```

The `CLASS_SELECT` handler below uses `PlayerClass` for the `satisfies` check — keep the import.

#### `CLASS_SELECT` handler

Register this in `onCreate`, alongside the existing `HOST_START` and `INPUT` handlers:

```typescript
this.onMessage(EventNames.CLASS_SELECT, (client: Client, raw: unknown) => {
  try {
    const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { classId: unknown };
    // Basic validation — classId must be a known PlayerClass value
    const validClasses = Object.values(PlayerClass) as string[];
    if (typeof msg?.classId !== 'string' || !validClasses.includes(msg.classId)) {
      logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'invalid CLASS_SELECT payload — discarded');
      return;
    }
    const classId = msg.classId as PlayerClass;
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player) {
      logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'CLASS_SELECT from unknown player — discarded');
      return;
    }
    player.class = classId;
    const delta = {
      type: 'player:class-updated' as const,
      playerId: client.sessionId,
      class: classId,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, delta);
    logger.info({ roomId: this.roomId, clientId: client.sessionId, classId }, 'player class confirmed');
  } catch {
    logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse CLASS_SELECT message — discarded');
  }
});
```

**Why validate classId:** The message comes from untrusted client code. Checking against
`Object.values(PlayerClass)` rejects garbage without crashing the tick loop.

**Re-confirmation is allowed:** If a player taps "Pick Selected Class" twice (same or
different class), the handler simply overwrites `player.class` and re-broadcasts the delta.
No special handling needed.

**Import to add:** Add `ClassSelectMsg` is NOT needed in GameRoom.ts (we parse the raw
object). Add `DeltaEventMsg` type import if not already present in the import from
`net-protocol`.

---

### Task 4 — Dev Notes: Mobile controller

#### `mobile-session.ts` — MobileSession interface + implementation

Add `sendClassSelect` to the `MobileSession` interface:
```typescript
export interface MobileSession {
  playerId: string;
  roomId: string;
  sendInput: (msg: InputEventMsg) => void;
  sendClassSelect: (msg: ClassSelectMsg) => void;   // ← add this
  disconnect: () => void;
}
```

Add import at top of mobile-session.ts:
```typescript
import type { ClassSelectMsg } from 'net-protocol';
```

In both `joinSession` and `reconnectToSession` return objects, add:
```typescript
sendClassSelect: (msg: ClassSelectMsg) => room.send(EventNames.CLASS_SELECT, msg),
```

Pattern is identical to `sendInput` — Colyseus msgpack-encodes the object for us.

#### `ControllerScreen.tsx` — onPickClass wiring

Find the `onPickClass` callback (around line 741):
```typescript
onPickClass={(_classId) => {
  setClassSelectionOpen(false);
  // TODO Story 2.3 — send class:selected message to sim server and persist class
}}
```

Replace with:
```typescript
onPickClass={(classId) => {
  setClassSelectionOpen(false);
  const s = sessionRef.current;
  if (s) {
    s.sendClassSelect({ type: 'class:select', classId });
  }
}}
```

**Why `sessionRef.current`:** The callback is defined inside the `ControllerScreen`
component. `sessionRef` is already maintained in the component (see lines ~485-495) to
keep event handlers dep-free. Use the same pattern here — do NOT use `session` prop
directly (stale closure risk).

**Import to add:** `ClassSelectMsg` doesn't need to be imported in ControllerScreen.tsx
because the object literal is passed inline and TypeScript infers the type from the
`sendClassSelect` signature. But if needed, add:
```typescript
import type { ClassSelectMsg } from 'net-protocol';
```

#### `ControllerScreen.tsx` — skill cells

Add these derivations before the component's return statement:

```typescript
// Derive own player's confirmed class from game state
const ownPlayer = gameState?.players.find(p => p.id === session?.playerId) ?? null;
const confirmedClass = ownPlayer?.class ?? null;
const classDef = confirmedClass !== null ? CLASS_DEFINITIONS[confirmedClass] : null;
```

`CLASS_DEFINITIONS` is already imported at the top of ControllerScreen.tsx from Story 2.2
(`import { CLASS_DEFINITIONS, PlayerClass } from 'shared-types'`). No new import needed.

Replace the static right-zone grid (lines ~696-735):

```tsx
{/* Right zone — 2×2 skill grid (60% width) */}
<div
  style={{
    width: '60%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: 4,
    padding: 8,
    boxSizing: 'border-box',
  }}
>
  {[0, 1, 2, 3].map(i => {
    const ability = classDef?.abilities[i] ?? null;
    const badgeBorderColor = ability !== null
      ? (ability.inputType === 'AUTO' ? 'var(--accent-spirit)'
        : ability.inputType === 'RELEASE' ? 'var(--accent-warm)'
        : 'var(--border)')
      : 'var(--border)';
    return (
      <div
        key={i}
        style={{
          background: 'var(--bg-subtle)',
          borderRadius: 6,
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          padding: '6px 8px',
          opacity: ability !== null ? 1.0 : 0.6,
          pointerEvents: 'none',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {ability !== null ? (
          <>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                fontSize: 'var(--text-base)',
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              {ability.name}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 3,
                borderLeft: `3px solid ${badgeBorderColor}`,
                paddingLeft: 4,
                lineHeight: 1,
              }}
            >
              {ability.inputType}
            </span>
          </>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontStyle: 'italic',
              fontSize: 'var(--text-base)',
              color: 'var(--text-secondary)',
              margin: 'auto',
            }}
          >
            —
          </span>
        )}
      </div>
    );
  })}
</div>
```

**Why `margin: 'auto'` on the dash:** Centers the dash in the cell when no class is
confirmed, matching the Story 2.2 appearance exactly.

**Touch targets:** The right zone cells remain `pointerEvents: 'none'` in hub mode — no
touch target requirement applies. The joystick zone on the left is unchanged.

**`classDef.abilities` tuple:** `ClassDef.abilities` is typed as a 4-tuple
`[ClassAbilityDef, ClassAbilityDef, ClassAbilityDef, ClassAbilityDef]`. Indexing with `i`
(0–3) is safe — TypeScript knows the tuple has exactly 4 elements. No bounds check needed.

---

### Task 5 — Dev Notes: Host HUD

#### `HubWorldScreen.tsx` — PlayerChip class name

`PlayerChip` currently shows the hardcoded string "Class TBD":
```typescript
<span style={{ ... }}>Class TBD</span>
```

Update `PlayerChip` to receive the `playerClass` prop and derive the display name:

```typescript
// Import at top of HubWorldScreen.tsx (add to existing shared-types import line):
import { SessionColor, HUB_POIS, PoiType, PlayerClass } from 'shared-types';
import { CLASS_DEFINITIONS } from 'shared-types';
// (or combine: import { SessionColor, HUB_POIS, PoiType, PlayerClass, CLASS_DEFINITIONS } from 'shared-types')

// Updated PlayerChip:
function PlayerChip({ name, isFrozen, playerClass }: {
  name: string;
  isFrozen: boolean;
  playerClass: PlayerClass | null;
}) {
  const classLabel = playerClass !== null
    ? CLASS_DEFINITIONS[playerClass].displayName
    : 'Class TBD';

  return (
    <div style={{ ... }}>  {/* existing chip wrapper unchanged */}
      <span style={{ ... }}>{name}</span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {classLabel}
      </span>
    </div>
  );
}
```

In the JSX where `PlayerChip` is rendered (inside the top strip `players.map`):
```tsx
players.map(player => (
  <PlayerChip
    key={player.id}
    name={player.displayName}
    isFrozen={player.isFrozen}
    playerClass={player.class}   // ← add this prop
  />
))
```

#### `HubWorldScreen.tsx` — flash animation

The flash animation runs inside `renderFrame` via a `flashUntil` timestamp on `PlayerEntry`.

**Step 1:** Update the `PlayerEntry` interface (currently defined as `interface PlayerEntry` inside the `HubWorldScreen` function scope or at module level):

```typescript
interface PlayerEntry {
  circle: Graphics;
  chatBubble: Text;
  flashUntil: number;      // ← add: Unix timestamp; 0 = no flash active
}
```

**Step 2:** Initialize `flashUntil: 0` when creating new entries in `renderFrame`:
```typescript
if (!entry) {
  const circle = new Graphics();
  const chatBubble = new Text({ ... });
  // ...
  entry = { circle, chatBubble, flashUntil: 0 };   // ← add flashUntil
  playerGraphics.set(player.id, entry);
}
```

**Step 3:** In `renderFrame`, detect class change and set flash:

Add a per-player `prevClass` tracker. The cleanest way is to store it in `PlayerEntry`:

```typescript
interface PlayerEntry {
  circle: Graphics;
  chatBubble: Text;
  flashUntil: number;
  knownClass: PlayerClass | null;   // ← add: last known class to detect change
}
```

Initialize `knownClass: null` alongside `flashUntil: 0`.

In the renderFrame loop per player:
```typescript
// Detect class change → start flash
if (entry.knownClass !== player.class && player.class !== null) {
  entry.knownClass = player.class;
  entry.flashUntil = Date.now() + 600;
}

// Apply alpha based on flash state
const now = Date.now();
if (entry.flashUntil > 0 && now < entry.flashUntil) {
  const progress = (entry.flashUntil - now) / 600; // 1.0 → 0.0 over 600ms
  // Sine pulse: peaks at start, settles back to 1.0 at end
  circle.alpha = player.isFrozen ? 0.3 : (0.2 + 0.8 * Math.abs(Math.sin(progress * Math.PI * 2)));
} else {
  circle.alpha = player.isFrozen ? 0.3 : 1;
}
```

**Why this works with the existing render cadence:** `renderFrame` is called from the
React `useEffect` that fires whenever `gameState` changes. The server broadcasts a
`player:class-updated` delta, which triggers `applyDelta`, which triggers a `setGameState`
call in the host App, which triggers a re-render, which calls `renderFrame`. The first call
after class confirmation starts the flash. Subsequent delta/snapshot messages from the server
(30hz tick generates a full snapshot every `SNAPSHOT_INTERVAL_S`) keep calling `renderFrame`,
which advances the alpha pulse. The animation runs for ~600ms of real time regardless of
how many render calls occur in that window.

**What to add to the `PlayerEntry` init block:** When player first appears (no entry):
```typescript
entry = { circle, chatBubble, flashUntil: 0, knownClass: null };
```

**Import needed:** `PlayerClass` — already imported from `shared-types` in HubWorldScreen
after the chip update above. `CLASS_DEFINITIONS` also imported above.

#### `PlayerSlot.tsx` — remove STONEHIDE hack

```typescript
// Before
import { PlayerClass } from 'shared-types';

const classLabel =
  player.class === PlayerClass.STONEHIDE ? 'Class TBD' : player.class;

// After — remove PlayerClass import (no longer needed), use null check
const classLabel = player.class === null ? 'Class TBD' : player.class;
```

If `CLASS_DEFINITIONS` display names are desired in the lobby chip too, that's a nice-to-have.
For this story, showing the raw enum value string ('stonehide') for a confirmed class is
acceptable in the lobby (players can't confirm classes in the lobby anyway — class confirmation
happens in the hub world after the session starts). This is consistent with Story 2.2's approach.

Actually — since players can't confirm classes in the lobby, `player.class` will always
be `null` in the lobby. The class label in `PlayerSlot.tsx` will always show "Class TBD"
in the lobby. Still fix the STONEHIDE hack for correctness.

---

### Typecheck Impact Analysis

After `PlayerState.class: PlayerClass | null`, TypeScript will flag:
1. `apps/host-client/src/components/PlayerSlot.tsx` — `player.class === PlayerClass.STONEHIDE` → fix with null check (Task 5)
2. `apps/host-client/src/screens/HubWorldScreen.tsx` — `PlayerChip` needs `playerClass` prop (Task 5)
3. `apps/simulation-server/src/rooms/GameRoom.ts` — `class: PlayerClass.STONEHIDE` → change to `null` (Task 3)
4. `packages/net-protocol/src/apply-delta.ts` — no issue; `player:class-updated` sets `class` to `PlayerClass` (non-null)
5. `apps/mobile-controller/src/screens/ControllerScreen.tsx` — `player.class` read via optional chain already (no issue expected)

No other files read `player.class` (confirmed by grep). Run typecheck after each task to catch regressions early.

---

### CSS Design Tokens Used in this Story

Tokens already defined in the project's CSS (`--variable`). No new tokens introduced.

| Token | Value | Usage in this story |
|---|---|---|
| `--font-body` | Lora | Ability names, badges, class label in PlayerChip |
| `--text-base` | 16px | Ability name in skill cell |
| `--text-sm` | 14px | Class display name in PlayerChip |
| `--text-xs` | 11px | Input type badge in skill cell |
| `--text-primary` | #d8d0e8 | Ability names |
| `--text-secondary` | #a89ec0 | Input type badges, class label, dash placeholder |
| `--bg-subtle` | #22202e | Skill cell background |
| `--border` | #36334a | Default cell border, TAP badge left-border |
| `--accent-spirit` | #6ea8d8 | AUTO badge left-border |
| `--accent-warm` | #c07d35 | RELEASE badge left-border |

---

### Existing Code That Must Not Break

**Joystick zone (ControllerScreen.tsx):** The left zone's touch handlers (`onTouchStart`,
`onTouchMove`, `onTouchEnd`, `onTouchCancel`) are attached to `joystickZoneRef`. The skill
cell updates are in the sibling right zone div. No joystick logic is touched.

**POI detection (GameRoom.ts):** The proximity loop in `tick()` is unchanged. The `CLASS_SELECT`
handler only runs when a message arrives — it does not interact with the tick loop.

**Reconnect flow (mobile-session.ts):** `reconnectToSession` returns an identical `MobileSession`
shape (just adds `sendClassSelect`). `ReconnectScreen` doesn't call `sendClassSelect`, so no
reconnect regression.

**Snapshot flow (host-session.ts + mobile-session.ts):** Both clients receive the full
`GameState` via `SnapshotMsg` on join and reconnect. After `player.class` becomes nullable,
the snapshot still works — `PlayerState.class: PlayerClass | null` serializes to `null` as
JSON which round-trips cleanly.

**Lobby PlayerSlot:** `player.class` is always `null` in the lobby (class confirmation
happens in the hub world). The null check fix makes the lobby UI correct.

---

### Previous Story Learnings (Story 2.2)

**Pattern: `sessionRef.current` for callbacks inside ControllerScreen.** Story 2.2 established
that `sessionRef` is the canonical way to access the live session inside event handlers and
callbacks without stale closure. Use the same pattern for `sendClassSelect`.

**Pattern: `satisfies DeltaEventMsg` in GameRoom broadcast.** Story 2.2 (and all prior
stories) use the `satisfies` keyword for all broadcast delta objects to get type safety
at the call site. Use this same pattern for the `player:class-updated` broadcast.

**Pattern: `typeof raw === 'string' ? JSON.parse(raw) : raw` in onMessage handlers.**
The `INPUT` handler in GameRoom uses this pattern defensively for dual-mode payloads
(Colyseus msgpack vs legacy JSON string). Use the same pattern in `CLASS_SELECT` handler.

**`classLabel` display in `PlayerSlot.tsx`:** The current hack (`PlayerClass.STONEHIDE` → 'Class TBD')
will cause TypeScript to complain once `player.class` is `PlayerClass | null`. Fix it in Task 5.

**No new CSS files.** All styles are inline JSX. This was established in Stories 2.1 and 2.2.

---

### Project Context Rules

All rules from `_bmad-output/project-context.md` apply. Key rules for this story:

- **Authority model.** The mobile controller sends `ClassSelectMsg` only — the server owns
  the state mutation. Mobile reads the confirmed class from `gameState` (received via delta).
  NEVER mutate `GameState` on the client side. NEVER update skill cells based on the local
  user action — wait for the server delta.
- **Colyseus unhandled message rule.** The `CLASS_SELECT` handler must be registered in
  `onCreate`. If it is missing, Colyseus sends `WITH_ERROR` (4002) and disconnects the
  player. See `_bmad-output/project-context.md` (Colyseus gotchas).
- **Serialization wrappers.** `room.send(EventNames.CLASS_SELECT, msg)` uses Colyseus
  msgpack encoding — do NOT call `JSON.stringify` manually. The server handler accepts both
  plain objects and JSON strings defensively.
- **TypeScript strict mode.** No `any` without explicit suppression comment. The
  `classId as PlayerClass` cast in the GameRoom handler is acceptable after the
  `validClasses.includes()` guard — it's a validated narrowing.
- **npm only.** Use `npm run typecheck`, not `pnpm`. Run from repo root.
- **Tick loop safety.** The `CLASS_SELECT` handler is NOT called inside `tick()`. It is
  a Colyseus `onMessage` callback — it runs on the event loop between ticks. No 33ms
  budget concern.
- **No game-rules imports in mobile or host.** `CLASS_DEFINITIONS` is in `shared-types`
  (zero runtime logic, pure constants) — correct placement. Do NOT import from `game-rules`.
- **Result<T, E> for game-rules.** Not applicable — this story has no game-rules functions.

---

### References

- Epic 2 Story 2.3 AC: `_bmad-output/planning-artifacts/epics.md` lines 505–533
- UX player-chip spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` lines 177–187
- UX skill-cell spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 397–416
- UX right-zone layout: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 299–307
- Current PlayerState: `packages/shared-types/src/player.ts`
- Current net-protocol messages: `packages/net-protocol/src/messages/`
- Current apply-delta: `packages/net-protocol/src/apply-delta.ts`
- Current GameRoom: `apps/simulation-server/src/rooms/GameRoom.ts`
- Current HubWorldScreen: `apps/host-client/src/screens/HubWorldScreen.tsx`
- Current PlayerSlot: `apps/host-client/src/components/PlayerSlot.tsx`
- Current ControllerScreen (with Story 2.3 TODO at line ~741): `apps/mobile-controller/src/screens/ControllerScreen.tsx`
- Current mobile-session: `apps/mobile-controller/src/session/mobile-session.ts`
- Project context rules: `_bmad-output/project-context.md`
- Colyseus unhandled message gotcha: `/home/cyby/.claude/projects/-mnt-c-Workspace-party-delve/memory/project_colyseus_gotchas.md`
- CLASS_DEFINITIONS (Story 2.2): `packages/shared-types/src/class-definitions.ts`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues during implementation. All tasks completed in a single pass without retries.

### Completion Notes List

All 5 tasks implemented and validated:

- **Task 1 (Protocol):** `PlayerState.class` changed to `PlayerClass | null`. `CLASS_SELECT` added to EventNames. `ClassSelectMsg` added to mobile-to-server. `PlayerClassUpdatedDelta` added to server-to-host and the `DeltaEventMsg` union. `player:class-updated` case added to `applyDelta`. Both new types exported from `net-protocol/src/index.ts`.
- **Task 2 (Contract tests):** Two new test files created. `class-select-msg.test.ts` covers round-trip for all `PlayerClass` values. `player-class-updated-delta.test.ts` covers round-trip + `applyDelta` behavior (sets class, immutability, other players unaffected, unknown playerId returns same ref, re-confirmation). All 30 tests pass.
- **Task 3 (Server handler):** `createPlayer` now sets `class: null`. `CLASS_SELECT` handler registered in `onCreate` — validates classId against `Object.values(PlayerClass)`, updates `player.class`, broadcasts `player:class-updated` delta. Defensive JSON/object dual-decode pattern matches INPUT handler.
- **Task 4 (Mobile):** `MobileSession` interface extended with `sendClassSelect`. Both `joinSession` and `reconnectToSession` implement it via `room.send(EventNames.CLASS_SELECT, msg)`. `onPickClass` in `ControllerScreen` now calls `sessionRef.current.sendClassSelect(...)`. Static dash cells replaced with dynamic ability cells showing ability name (italic, base, text-primary) + input type badge (xs, text-secondary, per-type left-border: accent-spirit/AUTO, accent-warm/RELEASE, border/TAP). `classDef` derived from confirmed class in `gameState` (server delta drives state — no local mutation). `CLASS_DEFINITIONS` import was already present.
- **Task 5 (Host):** `PlayerChip` extended with `playerClass: PlayerClass | null` prop — shows `CLASS_DEFINITIONS[playerClass].displayName` or "Class TBD". `PlayerEntry` interface extended with `flashUntil: number` and `knownClass: PlayerClass | null`. `renderFrame` detects class change (knownClass !== player.class && player.class !== null) and starts 600ms alpha pulse (Math.sin-based, 0.2→1 range). `PlayerSlot.tsx` STONEHIDE hack replaced with null check; unused `PlayerClass` import removed.
- **Typecheck:** Clean after all 5 tasks. No regressions in existing tests.

Contract-change hook checklist:
- [x] Protocol Architect role covered (Tasks 1-2 are Protocol Architect scope; cross-context approval pre-granted in story header)
- [x] Contract tests for both new message types: `class-select-msg.test.ts`, `player-class-updated-delta.test.ts`
- [x] Spec/ADR update: not required (additive message, no lifecycle change — per story header)
- Note: Protocol Architect review required before merge

**Code review patches applied (2026-06-24):**
- Fixed flash alpha formula: was `0.2 + 0.8 * Math.abs(Math.sin(progress * π * 2))` (started at 0.2, double-oscillation). Correct formula: `0.6 + 0.4 * Math.cos(2π * (1 - progress))` → produces exactly 1→0.2→1 over 600ms (AC3).
- Fixed spurious flash on host reconnect: `knownClass` was initialized to `null` on new PlayerEntry, causing flash for every player who already had a confirmed class when the host rendered for the first time (or after pixi app remount). Now initializes to `player.class` so no flash fires unless the class actually changes.
- Added explicit `fontWeight: 400` to ability name span in ControllerScreen skill cells (AC4: "Lora 400 italic").

Confidence: 97% — all ACs satisfied, typecheck clean, tests pass, review findings addressed. Flash curve correctness can only be fully verified visually in-browser.

### File List

- packages/shared-types/src/player.ts
- packages/net-protocol/src/event-names.ts
- packages/net-protocol/src/messages/mobile-to-server.ts
- packages/net-protocol/src/messages/server-to-host.ts
- packages/net-protocol/src/apply-delta.ts
- packages/net-protocol/src/index.ts
- apps/simulation-server/src/rooms/GameRoom.ts
- apps/mobile-controller/src/session/mobile-session.ts
- apps/mobile-controller/src/screens/ControllerScreen.tsx
- apps/host-client/src/screens/HubWorldScreen.tsx
- apps/host-client/src/components/PlayerSlot.tsx
- tests/contract/class-select-msg.test.ts (NEW)
- tests/contract/player-class-updated-delta.test.ts (NEW)

### Review Findings

Ultra code review — 2026-06-24 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor)

- [x] [Review][Patch] Flash animation not driven by continuous rendering — already deferred as D-2.4-C; see deferred-work.md [apps/host-client/src/screens/HubWorldScreen.tsx:183-186]
- [x] [Review][Patch] CLASS_SELECT accepted from frozen player during grace period — add `if (player.isFrozen) return;` guard after player lookup [apps/simulation-server/src/rooms/GameRoom.ts:89-91]
- [x] [Review][Patch] Badge span missing explicit `fontWeight: 400` (AC4: "Lora 400, xs, text-secondary") [apps/mobile-controller/src/screens/ControllerScreen.tsx:656-666]
- [x] [Review][Defer] Flash animation not driven by RAF/ticker (already D-2.4-C in deferred-work.md) — deferred, pre-existing deferral from story 2.4 review
- [x] [Review][Defer] React Strict Mode double-mount can permanently lose flash during PixiJS async init [apps/host-client/src/screens/HubWorldScreen.tsx:117-181] — deferred, dev-mode only
- [x] [Review][Defer] No rate-limiting on CLASS_SELECT messages — spam possible [apps/simulation-server/src/rooms/GameRoom.ts:80-105] — deferred, general hardening
- [x] [Review][Defer] applyDelta missing exhaustiveness guard for unimplemented delta types [packages/net-protocol/src/apply-delta.ts:59] — deferred, pre-existing
- [x] [Review][Defer] RELEASE ability fires twice when lift occurs inside cell bounds (el + document touchend both call onAbilityFire) [apps/mobile-controller/src/screens/ControllerScreen.tsx:548-583] — deferred, story 2.4 territory
- [x] [Review][Defer] player:class-updated delta silently no-ops if it arrives before join snapshot [packages/net-protocol/src/apply-delta.ts:53] — deferred, acceptable race; periodic snapshot restores correct state

---

## Change Log

- 2026-06-24: Implemented story 2.3 — class confirmation + hub controller transition. Protocol types, server handler, mobile wiring, host HUD updates, and contract tests. 13 files changed, 2 new test files added.
- 2026-06-24: Post-review patches — fixed flash alpha formula (AC3 curve), spurious flash on host reconnect (knownClass init), explicit fontWeight: 400 on skill cell ability name (AC4).
- 2026-06-24: Ultra code review — 2 patches identified (frozen-player guard, badge fontWeight); 5 new deferred items logged.
